import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getDemandGaps } from '../../../../Services/adminService';
import { ChartTooltip, ErrorState } from '../../adminShared';

// ── Demand Gaps sub-tab ───────────────────────────────────────────────────────

function DemandGapsTab() {
    const [data, setData] = useState(null);
    const [loading, setL] = useState(true);
    const [error, setError] = useState(false);

    const load = useCallback(() => {
        setL(true);
        setError(false);
        getDemandGaps()
            .then((r) => setData(r.data))
            .catch(() => setError(true))
            .finally(() => setL(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const maxSpecDPD  = Math.max(...(data?.specAnalysis?.map(s => s.demandPerDoctor) ?? [1]), 1);

    if (error) return <ErrorState onRetry={load} />;

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-amber-950/40 to-slate-900 border border-amber-800/20 rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-400 text-[22px] mt-0.5 flex-shrink-0">info</span>
                <div>
                    <p className="text-sm font-bold text-amber-300">كيف تقرأ هذه البيانات؟</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        <strong>حجوزات لكل طبيب</strong> = إجمالي الحجوزات (آخر 30 يوم) ÷ عدد الأطباء في هذه المدينة/التخصص.
                        كلما ارتفع الرقم، كلما كان الطلب أعلى من العرض — فرصة لجذب أطباء جدد أو تقديم عروض تحفيزية.
                    </p>
                </div>
            </div>

            {/* Cities */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                <h3 className="font-black text-slate-200 mb-1 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-amber-400">location_city</span>
                    فجوة العرض والطلب — المدن
                </h3>
                <p className="text-xs text-slate-500 mb-5">عدد الأطباء النشطين مقابل الحجوزات الأخيرة</p>
                {loading
                    ? <div className="h-64 bg-slate-800 rounded-xl animate-pulse" />
                    : (
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={data?.cityAnalysis} layout="vertical" margin={{ right: 20, left: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="city" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12, direction: 'rtl' }}
                                    formatter={v => <span style={{ color: '#94a3b8' }}>{v}</span>} />
                                <Bar dataKey="doctors"         name="الأطباء"              fill="#3b82f6" radius={[0,3,3,0]} maxBarSize={16} />
                                <Bar dataKey="bookings"        name="الحجوزات (30 يوم)"  fill="#10b981" radius={[0,3,3,0]} maxBarSize={16} />
                                <Bar dataKey="demandPerDoctor" name="حجوزات/طبيب"          fill="#f59e0b" radius={[0,3,3,0]} maxBarSize={16} />
                            </BarChart>
                        </ResponsiveContainer>
                    )
                }
            </div>

            {/* Opportunity spotlight */}
            {!loading && data?.cityAnalysis?.length > 0 && (
                <div>
                    <h3 className="font-black text-slate-200 mb-3 text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-emerald-400">bolt</span>
                        أعلى فرص التوسع (مدن بطلب مرتفع وعرض منخفض)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {data.cityAnalysis.slice(0, 3).map((c, i) => (
                            <div key={c.city} className="bg-gradient-to-br from-amber-950/30 to-slate-900 rounded-2xl p-5 border border-amber-800/20">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className={`text-lg font-black ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-400' : 'text-orange-700'}`}>#{i + 1}</span>
                                    <span className="font-black text-slate-100">{c.city}</span>
                                </div>
                                <div className="space-y-1 text-xs text-slate-400">
                                    <p><span className="text-blue-400 font-bold">{c.doctors}</span> طبيب نشط</p>
                                    <p><span className="text-emerald-400 font-bold">{c.bookings}</span> حجز في آخر 30 يوم</p>
                                    <p><span className="text-amber-400 font-bold">{c.demandPerDoctor}</span> حجز لكل طبيب</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Specializations */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                <h3 className="font-black text-slate-200 mb-1 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-cyan-400">medical_services</span>
                    فجوة العرض والطلب — التخصصات
                </h3>
                <p className="text-xs text-slate-500 mb-5">التخصصات الأعلى طلباً نسبةً لعدد أطبائها</p>
                {loading
                    ? <div className="h-64 bg-slate-800 rounded-xl animate-pulse" />
                    : (
                        <div className="space-y-3">
                            {(data?.specAnalysis ?? []).map((s, i) => (
                                <div key={s.specialization} className="flex items-center gap-3">
                                    <span className={`text-xs font-black w-4 text-center ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-700' : 'text-slate-700'}`}>{i + 1}</span>
                                    <span className="text-xs text-slate-400 w-32 truncate text-right">{s.specialization}</span>
                                    <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                                        <div className="h-2 rounded-full bg-gradient-to-r from-amber-700 to-amber-400 transition-all"
                                            style={{ width: `${maxSpecDPD > 0 ? (s.demandPerDoctor / maxSpecDPD) * 100 : 0}%` }} />
                                    </div>
                                    <div className="text-right w-28 flex-shrink-0">
                                        <span className="text-xs font-black text-amber-400">{s.demandPerDoctor} ح/ط</span>
                                        <span className="text-[10px] text-slate-600 mr-1">({s.doctors} أطباء)</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                }
            </div>
        </div>
    );
}


export { DemandGapsTab };

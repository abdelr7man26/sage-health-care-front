import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getPatientDemographics } from '../../../../Services/adminService';
import { StatCard, BarRow, ChartTooltip, ErrorState } from '../../adminShared';

// ── Patient Demographics sub-tab ──────────────────────────────────────────────

function PatientDemographicsTab() {
    const [data, setData] = useState(null);
    const [loading, setL] = useState(true);
    const [error, setError] = useState(false);

    const load = useCallback(() => {
        setL(true);
        setError(false);
        getPatientDemographics()
            .then((r) => setData(r.data))
            .catch(() => setError(true))
            .finally(() => setL(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const maxCity    = Math.max(...(data?.topCities?.map(c => c.count) ?? [1]), 1);
    const maxDisease = Math.max(...(data?.topChronicDiseases?.map(d => d.count) ?? [1]), 1);
    const maxAllergy = Math.max(...(data?.topAllergies?.map(a => a.count) ?? [1]), 1);
    const maxBlood   = Math.max(...(data?.bloodTypes?.map(b => b.count) ?? [1]), 1);

    if (error) return <ErrorState onRetry={load} />;

    return (
        <div className="space-y-6">
            {/* Purpose banner */}
            <div className="bg-gradient-to-r from-violet-950/40 to-slate-900 border border-violet-800/20 rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-violet-400 text-[22px] mt-0.5 flex-shrink-0">diversity_3</span>
                <div>
                    <p className="text-sm font-bold text-violet-300">من هم مرضى المنصة؟</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        أعمار وأمراض وجغرافيا قاعدة المرضى — توجّه قرارات التعاقد مع التخصصات الجديدة والتسويق:
                        قاعدة كبار سن بأمراض مزمنة تحتاج باطنة وقلب، وقاعدة شباب تحتاج جلدية وأسنان.
                    </p>
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon="groups" label="إجمالي المرضى المسجلين" color="violet" loading={loading}
                    value={data?.totalPatients?.toLocaleString('ar-EG')}
                />
                <StatCard icon="cake" label="متوسط عمر المرضى" color="cyan" loading={loading}
                    value={data?.avgAge != null ? `${data.avgAge} سنة` : '—'}
                />
                <StatCard icon="wc" label="ذكور / إناث" color="blue" loading={loading}
                    value={data ? `${data.malePct}% / ${data.femalePct}%` : '—'}
                />
                <StatCard icon="clinical_notes" label="عبّأوا ملفهم الطبي" color="emerald" loading={loading}
                    value={data != null ? `${data.profileCompletionPct}%` : '—'}
                    sub={data ? `${data.withChronicPct}% من أصحاب الملفات لديهم أمراض مزمنة` : null}
                />
            </div>

            {/* Age pyramid */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                <h3 className="font-black text-slate-200 mb-5 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-violet-400">elderly</span>
                    توزيع المرضى حسب الفئة العمرية والنوع
                </h3>
                {loading
                    ? <div className="h-52 bg-slate-800 rounded-xl animate-pulse" />
                    : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={data?.ageBuckets} margin={{ right: 4, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12, direction: 'rtl' }}
                                    formatter={v => <span style={{ color: '#94a3b8' }}>{v}</span>} />
                                <Bar dataKey="male"   name="ذكور" stackId="g" fill="#3b82f6" maxBarSize={36} />
                                <Bar dataKey="female" name="إناث" stackId="g" fill="#ec4899" radius={[3,3,0,0]} maxBarSize={36} />
                            </BarChart>
                        </ResponsiveContainer>
                    )
                }
            </div>

            {/* Diseases + allergies + cities + blood types */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                    <h3 className="font-black text-slate-200 mb-5 text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-red-400">cardiology</span>
                        أكثر الأمراض المزمنة انتشاراً
                    </h3>
                    {loading
                        ? <div className="space-y-3">{[80,65,50,40,30].map((w,i) => <div key={i} className="h-4 bg-slate-800 rounded-full animate-pulse" style={{width:`${w}%`}} />)}</div>
                        : data?.topChronicDiseases?.length ? (
                            <div className="space-y-3">
                                {data.topChronicDiseases.map((d, i) => (
                                    <BarRow key={d.name} label={d.name} count={d.count} max={maxDisease} color="emerald" rank={i} />
                                ))}
                            </div>
                        ) : <p className="text-sm text-slate-600">لا توجد بيانات</p>}
                </div>

                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                    <h3 className="font-black text-slate-200 mb-5 text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-amber-400">allergy</span>
                        أكثر أنواع الحساسية انتشاراً
                    </h3>
                    {loading
                        ? <div className="space-y-3">{[75,60,45,35,25].map((w,i) => <div key={i} className="h-4 bg-slate-800 rounded-full animate-pulse" style={{width:`${w}%`}} />)}</div>
                        : data?.topAllergies?.length ? (
                            <div className="space-y-3">
                                {data.topAllergies.map((a, i) => (
                                    <BarRow key={a.name} label={a.name} count={a.count} max={maxAllergy} color="blue" rank={i} />
                                ))}
                            </div>
                        ) : <p className="text-sm text-slate-600">لا توجد بيانات</p>}
                </div>

                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                    <h3 className="font-black text-slate-200 mb-5 text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-blue-400">location_city</span>
                        أعلى المدن بعدد المرضى
                    </h3>
                    {loading
                        ? <div className="space-y-3">{[80,60,45,30].map((w,i) => <div key={i} className="h-4 bg-slate-800 rounded-full animate-pulse" style={{width:`${w}%`}} />)}</div>
                        : data?.topCities?.length ? (
                            <div className="space-y-3">
                                {data.topCities.map((c, i) => (
                                    <BarRow key={c.name} label={c.name} count={c.count} max={maxCity} color="blue" rank={i} />
                                ))}
                            </div>
                        ) : <p className="text-sm text-slate-600">لا توجد بيانات</p>}
                </div>

                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                    <h3 className="font-black text-slate-200 mb-5 text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-rose-400">bloodtype</span>
                        توزيع فصائل الدم
                    </h3>
                    {loading
                        ? <div className="grid grid-cols-4 gap-2">{Array.from({length:8}).map((_,i) => <div key={i} className="h-16 bg-slate-800 rounded-xl animate-pulse" />)}</div>
                        : data?.bloodTypes?.length ? (
                            <div className="grid grid-cols-4 gap-2">
                                {data.bloodTypes.map(b => (
                                    <div key={b.type} className="bg-slate-800/60 rounded-xl p-3 text-center border border-slate-700/40"
                                        style={{ opacity: 0.45 + 0.55 * (b.count / maxBlood) }}
                                    >
                                        <p className="text-base font-black text-rose-400" dir="ltr">{b.type}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{b.count.toLocaleString('ar-EG')}</p>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="text-sm text-slate-600">لا توجد بيانات</p>}
                </div>
            </div>
        </div>
    );
}


export { PatientDemographicsTab };

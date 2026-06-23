import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getClinicEfficiency } from '../../../../Services/adminService';
import { SkeletonRows, StatCard, inputCls, ChartTooltip, ECON_PERIODS, ErrorState } from '../../adminShared';

// ── Clinic Efficiency sub-tab ─────────────────────────────────────────────────

function ClinicEfficiencyTab() {
    const [data, setData]     = useState(null);
    const [loading, setL]     = useState(true);
    const [days, setDays]     = useState(90);
    const [search, setSearch] = useState('');
    const [error, setError]   = useState(false);

    const load = useCallback(() => {
        setL(true);
        setError(false);
        getClinicEfficiency({ days })
            .then((r) => setData(r.data))
            .catch(() => setError(true))
            .finally(() => setL(false));
    }, [days]);

    useEffect(() => { load(); }, [load]);

    const sum = data?.summary;

    const doctors = (data?.doctors ?? []).filter(d =>
        !search.trim()
        || d.name?.includes(search.trim())
        || d.specialization?.includes(search.trim())
        || d.city?.includes(search.trim()));

    const delayBadge = (delay) => {
        if (delay == null) return <span className="text-slate-700 text-xs">—</span>;
        if (delay <= 0) return <span className="inline-block px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400">مبكر {Math.abs(delay)} د</span>;
        if (delay <= 15) return <span className="inline-block px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400">+{delay} د</span>;
        return <span className="inline-block px-2 py-0.5 rounded-lg text-xs font-bold bg-red-500/20 text-red-400">+{delay} د</span>;
    };

    const waitBadge = (wait) => {
        if (wait == null) return <span className="text-slate-700 text-xs">—</span>;
        const cls = wait <= 20 ? 'bg-emerald-500/20 text-emerald-400' : wait <= 45 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400';
        return <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${cls}`}>{wait} دقيقة</span>;
    };

    if (error) return <ErrorState onRetry={load} />;

    return (
        <div className="space-y-6">
            {/* Purpose banner */}
            <div className="bg-gradient-to-r from-blue-950/40 to-slate-900 border border-blue-800/20 rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-blue-400 text-[22px] mt-0.5 flex-shrink-0">timer</span>
                <div>
                    <p className="text-sm font-bold text-blue-300">كفاءة سير العمل داخل العيادات</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        محسوبة من أوقات حقيقية: وصول المريض ← ضغط الطبيب «ابدأ الكشف». الأرقام تشمل فقط
                        الزيارات التي سُجّل لها وقت بدء فعلي — انتظار طويل = تجربة مريض سيئة وخطر فقدانه.
                    </p>
                </div>
            </div>

            {/* Period selector */}
            <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
                {ECON_PERIODS.map(p => (
                    <button key={p.days} onClick={() => setDays(p.days)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors
                            ${days === p.days ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >{p.label}</button>
                ))}
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon="hourglass_top" label="متوسط انتظار الزيارة المباشرة" color="cyan" loading={loading}
                    value={sum?.avgWalkInWait != null ? `${sum.avgWalkInWait} دقيقة` : '—'}
                    sub={sum ? `من ${sum.doneWalkIns?.toLocaleString('ar-EG')} زيارة منتهية` : null}
                />
                <StatCard icon="schedule" label="متوسط تأخير الحجز عن الموعد" color="blue" loading={loading}
                    value={sum?.avgStartDelay != null ? `${sum.avgStartDelay > 0 ? '+' : ''}${sum.avgStartDelay} دقيقة` : '—'}
                    sub="موجب = الطبيب يبدأ متأخراً عن وقت الحجز"
                />
                <StatCard icon="running_with_errors" label="نسبة المرضى المتأخرين" color="amber" loading={loading}
                    value={sum != null ? `${sum.latePct}%` : '—'}
                    sub={sum ? `${sum.lateCount?.toLocaleString('ar-EG')} من ${sum.totalBookings?.toLocaleString('ar-EG')} حجز` : null}
                />
                <StatCard icon="move_down" label="زيارات مُدرجة استثنائياً" color="violet" loading={loading}
                    value={sum != null ? `${sum.forceInsertedPct}%` : '—'}
                    sub={sum ? `${sum.forceInserted} زيارة أُدرجت في مكان مريض غائب` : null}
                />
            </div>

            {/* Wait distribution */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                <h3 className="font-black text-slate-200 mb-1 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-cyan-400">bar_chart</span>
                    توزيع أوقات الانتظار قبل دخول الكشف
                </h3>
                <p className="text-xs text-slate-500 mb-5">كم شخصاً انتظر كم دقيقة بعد موعده؟ — حجوزات المنصة والزيارات المباشرة</p>
                {loading
                    ? <div className="h-44 bg-slate-800 rounded-xl animate-pulse" />
                    : (
                        <ResponsiveContainer width="100%" height={210}>
                            <BarChart data={data?.waitDistribution} margin={{ right: 4, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12, direction: 'rtl' }}
                                    formatter={v => <span style={{ color: '#94a3b8' }}>{v}</span>} />
                                <Bar dataKey="bookings" name="حجوزات أونلاين"  fill="#3b82f6" radius={[4,4,0,0]} maxBarSize={32} />
                                <Bar dataKey="walkIns"  name="زيارات مباشرة"   fill="#06b6d4" radius={[4,4,0,0]} maxBarSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    )
                }
            </div>

            {/* Search */}
            <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="بحث باسم الطبيب أو التخصص أو المدينة..."
                className={`${inputCls} w-full md:w-80`}
            />

            {/* Per-doctor table */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm" dir="rtl">
                        <thead>
                            <tr className="bg-slate-800/60 border-b border-slate-700/50">
                                {['الطبيب','التخصص','المدينة','انتظار الزيارات','تأخير الحجز عن الموعد','تأخر المرضى','حجوزات الفترة'].map(h => (
                                    <th key={h} className="px-3 py-3 text-right text-[11px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <SkeletonRows cols={7} rows={6} /> : doctors.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-600">لا توجد بيانات كافية في هذه الفترة</td></tr>
                            ) : doctors.map((d) => (
                                <tr key={d.doctorProfileId} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                                    <td className="px-3 py-3">
                                        <p className="font-bold text-slate-200 text-sm whitespace-nowrap">د. {d.name}</p>
                                    </td>
                                    <td className="px-3 py-3 text-slate-400 text-xs whitespace-nowrap">{d.specialization}</td>
                                    <td className="px-3 py-3 text-slate-500 text-xs">{d.city}</td>
                                    <td className="px-3 py-3 whitespace-nowrap">
                                        {waitBadge(d.avgWalkInWait)}
                                        {d.walkInsMeasured > 0 && <p className="text-[10px] text-slate-600 mt-0.5">{d.walkInsMeasured} زيارة مقاسة</p>}
                                    </td>
                                    <td className="px-3 py-3 whitespace-nowrap">
                                        {delayBadge(d.avgStartDelay)}
                                        {d.bookingsMeasured > 0 && <p className="text-[10px] text-slate-600 mt-0.5">{d.bookingsMeasured} كشف مقاس</p>}
                                    </td>
                                    <td className="px-3 py-3 min-w-[110px]">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                <div className={`h-1.5 rounded-full ${d.latePct > 30 ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, d.latePct)}%` }} />
                                            </div>
                                            <span className="text-xs font-bold text-slate-300 w-8 text-left">{d.latePct}%</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 text-slate-300 font-bold text-sm">{d.totalBookings}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}


export { ClinicEfficiencyTab };

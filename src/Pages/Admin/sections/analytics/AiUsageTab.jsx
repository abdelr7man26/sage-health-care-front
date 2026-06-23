import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getAiUsage } from '../../../../Services/adminService';
import { StatCard, ChartTooltip, ECON_PERIODS, ErrorState } from '../../adminShared';

// ── AI Usage sub-tab ──────────────────────────────────────────────────────────

function AiUsageTab() {
    const [data, setData] = useState(null);
    const [loading, setL] = useState(true);
    const [days, setDays] = useState(30);
    const [error, setError] = useState(false);

    const load = useCallback(() => {
        setL(true);
        setError(false);
        getAiUsage({ days })
            .then((r) => setData(r.data))
            .catch(() => setError(true))
            .finally(() => setL(false));
    }, [days]);

    useEffect(() => { load(); }, [load]);

    const sum = data?.summary;

    if (error) return <ErrorState onRetry={load} />;

    return (
        <div className="space-y-6">
            {/* Purpose banner */}
            <div className="bg-gradient-to-r from-teal-950/40 to-slate-900 border border-teal-800/20 rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-teal-400 text-[22px] mt-0.5 flex-shrink-0">smart_toy</span>
                <div>
                    <p className="text-sm font-bold text-teal-300">استخدام المساعد الذكي SAGE</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        يُسجَّل حجم الاستخدام فقط — نص الأسئلة الطبية لا يُخزَّن أبداً.
                        «التحويل لحجز» = مريض سأل المساعد ثم حجز كشفاً خلال 48 ساعة — الرقم الذي يثبت أن الذكاء الاصطناعي يجلب حجوزات.
                        التسجيل بدأ من اليوم، فالأرقام تتراكم من الآن.
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
                <StatCard icon="forum" label="رسائل للمساعد الذكي" color="cyan" loading={loading}
                    value={sum?.messages?.toLocaleString('ar-EG')}
                    sub={sum ? `${sum.conversations?.toLocaleString('ar-EG')} محادثة جديدة` : null}
                />
                <StatCard icon="person" label="مرضى استخدموا المساعد" color="blue" loading={loading}
                    value={sum?.uniqueUsers?.toLocaleString('ar-EG')}
                />
                <StatCard icon="event_available" label="تحويل لحجز خلال 48 ساعة" color="emerald" loading={loading}
                    value={sum != null ? `${sum.conversionPct}%` : '—'}
                    sub={sum ? `${sum.convertedUsers} من ${sum.uniqueUsers} مستخدم حجزوا بعد المحادثة` : null}
                />
                <StatCard icon="error" label="نسبة فشل الردود" color={sum?.failurePct > 5 ? 'red' : 'violet'} loading={loading}
                    value={sum != null ? `${sum.failurePct}%` : '—'}
                    sub={sum?.avgDurationMs != null ? `متوسط زمن الرد ${(sum.avgDurationMs / 1000).toFixed(1)} ثانية` : null}
                />
            </div>

            {/* Daily trend */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                <h3 className="font-black text-slate-200 mb-5 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-teal-400">show_chart</span>
                    رسائل المساعد الذكي يومياً
                </h3>
                {loading
                    ? <div className="h-48 bg-slate-800 rounded-xl animate-pulse" />
                    : (data?.dailyTrend?.length ?? 0) === 0 ? (
                        <div className="text-center py-10">
                            <span className="material-symbols-outlined text-[40px] text-slate-700 block mb-2">hourglass_empty</span>
                            <p className="text-sm text-slate-600">لا توجد بيانات بعد — السجل بدأ من اليوم وسيمتلئ مع الاستخدام</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={data.dailyTrend} margin={{ right: 4, left: -20 }}>
                                <defs>
                                    <linearGradient id="gAiMsgs" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#14b8a6" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="_id" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Area type="monotone" dataKey="count" name="رسائل" stroke="#14b8a6" fill="url(#gAiMsgs)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )
                }
            </div>
        </div>
    );
}


export { AiUsageTab };

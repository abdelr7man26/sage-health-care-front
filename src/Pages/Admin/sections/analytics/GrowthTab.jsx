import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getGrowthAnalytics } from '../../../../Services/adminService';
import { CARD_COLORS, ChartTooltip, ErrorState } from '../../adminShared';

// ── Growth sub-tab ────────────────────────────────────────────────────────────

function GrowthTab() {
    const [data, setData]   = useState(null);
    const [loading, setL]   = useState(true);
    const [error, setError] = useState(false);

    const load = useCallback(() => {
        setL(true);
        setError(false);
        getGrowthAnalytics()
            .then((r) => setData(r.data))
            .catch(() => setError(true))
            .finally(() => setL(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const mom = data?.momGrowth;
    const cur = data?.timeline?.[11];

    const momBadge = (pct) => pct == null ? null : (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${pct >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
            {pct >= 0 ? '↑' : '↓'} {Math.abs(pct)}%
        </span>
    );

    if (error) return <ErrorState onRetry={load} />;

    return (
        <div className="space-y-6">
            {/* Month KPIs */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'مرضى جدد هذا الشهر', val: cur?.patients, mom: mom?.patients, color: 'emerald', icon: 'personal_injury' },
                    { label: 'أطباء جدد هذا الشهر', val: cur?.doctors,  mom: mom?.doctors,  color: 'blue',    icon: 'stethoscope' },
                    { label: 'حجوزات هذا الشهر',    val: cur ? cur.bookings + cur.walkIns : null, mom: mom?.bookings, color: 'violet', icon: 'calendar_month' },
                ].map(({ label, val, mom: m, color, icon }) => {
                    const c = CARD_COLORS[color];
                    return (
                        <div key={label} className={`bg-slate-900 rounded-2xl p-5 border ${c.border}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className={`w-10 h-10 rounded-xl ${c.icon} flex items-center justify-center`}>
                                    <span className="material-symbols-outlined text-[20px]">{icon}</span>
                                </div>
                                {!loading && momBadge(m)}
                            </div>
                            {loading
                                ? <div className="h-8 w-20 bg-slate-800 rounded-full animate-pulse" />
                                : <p className={`text-3xl font-black ${c.num}`}>{(val ?? 0).toLocaleString('ar-EG')}</p>
                            }
                            <p className="text-xs text-slate-500 mt-1">{label}</p>
                            {!loading && m != null && <p className="text-[10px] text-slate-600 mt-0.5">مقارنةً بالشهر السابق</p>}
                        </div>
                    );
                })}
            </div>

            {/* Users growth chart */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                <h3 className="font-black text-slate-200 mb-5 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-emerald-400">group_add</span>
                    نمو المستخدمين — آخر 12 شهراً
                </h3>
                {loading
                    ? <div className="h-52 bg-slate-800 rounded-xl animate-pulse" />
                    : (
                        <ResponsiveContainer width="100%" height={210}>
                            <AreaChart data={data?.timeline} margin={{ right: 4, left: -20 }}>
                                <defs>
                                    <linearGradient id="gPatients" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gDoctors" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12, direction: 'rtl' }}
                                    formatter={v => <span style={{ color: '#94a3b8' }}>{v}</span>} />
                                <Area type="monotone" dataKey="patients" name="مرضى جدد" stroke="#10b981" fill="url(#gPatients)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                <Area type="monotone" dataKey="doctors"  name="أطباء جدد" stroke="#3b82f6" fill="url(#gDoctors)"  strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )
                }
            </div>

            {/* Bookings volume chart */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                <h3 className="font-black text-slate-200 mb-5 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-violet-400">event_available</span>
                    حجم الحجوزات والزيارات المباشرة — آخر 12 شهراً
                </h3>
                {loading
                    ? <div className="h-52 bg-slate-800 rounded-xl animate-pulse" />
                    : (
                        <ResponsiveContainer width="100%" height={210}>
                            <BarChart data={data?.timeline} margin={{ right: 4, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12, direction: 'rtl' }}
                                    formatter={v => <span style={{ color: '#94a3b8' }}>{v}</span>} />
                                <Bar dataKey="bookings" name="حجوزات أونلاين" fill="#8b5cf6" radius={[3,3,0,0]} maxBarSize={28} />
                                <Bar dataKey="walkIns"  name="زيارات مباشرة"  fill="#06b6d4" radius={[3,3,0,0]} maxBarSize={28} />
                            </BarChart>
                        </ResponsiveContainer>
                    )
                }
            </div>
        </div>
    );
}


export { GrowthTab };

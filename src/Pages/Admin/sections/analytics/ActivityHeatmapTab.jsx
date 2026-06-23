import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getActivityHeatmap } from '../../../../Services/adminService';
import { ChartTooltip, ErrorState } from '../../adminShared';

// ── Activity Heatmap sub-tab ──────────────────────────────────────────────────

function ActivityHeatmapTab() {
    const [data, setData] = useState(null);
    const [loading, setL] = useState(true);
    const [error, setError] = useState(false);

    const load = useCallback(() => {
        setL(true);
        setError(false);
        getActivityHeatmap()
            .then((r) => setData(r.data))
            .catch(() => setError(true))
            .finally(() => setL(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const maxHour = Math.max(...(data?.hourData?.map(h => h.count) ?? [1]), 1);

    if (error) return <ErrorState onRetry={load} />;

    return (
        <div className="space-y-6">
            {/* Peak cards */}
            {!loading && data && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-violet-950/50 to-slate-900 rounded-2xl p-5 border border-violet-800/20">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-violet-400 text-[20px]">schedule</span>
                            <span className="text-sm font-bold text-slate-300">أعلى ساعة حجزاً</span>
                        </div>
                        <p className="text-4xl font-black text-violet-400">{data.peakHour?.label}</p>
                        <p className="text-xs text-slate-500 mt-1">{data.peakHour?.count?.toLocaleString('ar-EG')} حجز في آخر 90 يوم</p>
                    </div>
                    <div className="bg-gradient-to-br from-cyan-950/50 to-slate-900 rounded-2xl p-5 border border-cyan-800/20">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-cyan-400 text-[20px]">today</span>
                            <span className="text-sm font-bold text-slate-300">أعلى يوم حجزاً</span>
                        </div>
                        <p className="text-4xl font-black text-cyan-400">{data.peakDay?.label}</p>
                        <p className="text-xs text-slate-500 mt-1">{data.peakDay?.count?.toLocaleString('ar-EG')} حجز في آخر 90 يوم</p>
                    </div>
                </div>
            )}

            {/* Hour distribution */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                <h3 className="font-black text-slate-200 mb-5 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-violet-400">bar_chart_4_bars</span>
                    توزيع الحجوزات على مدار اليوم (آخر 90 يوم)
                </h3>
                {loading
                    ? <div className="h-44 bg-slate-800 rounded-xl animate-pulse" />
                    : (
                        <div className="flex items-end gap-1 h-40">
                            {data?.hourData?.map(h => {
                                const pct   = maxHour > 0 ? (h.count / maxHour) * 100 : 0;
                                const isPeak = h.hour === data.peakHour?.hour;
                                return (
                                    <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 group">
                                        <span className={`text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity ${isPeak ? 'text-violet-400' : 'text-slate-400'}`}>
                                            {h.count}
                                        </span>
                                        <div className="w-full flex flex-col justify-end h-32">
                                            <div
                                                className={`w-full rounded-t transition-all ${isPeak ? 'bg-violet-500' : 'bg-slate-700 group-hover:bg-slate-600'}`}
                                                style={{ height: `${Math.max(pct, 2)}%` }}
                                            />
                                        </div>
                                        {h.hour % 4 === 0 && (
                                            <span className="text-[9px] text-slate-600">{h.label}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )
                }
                <p className="text-xs text-slate-600 mt-3 text-center">الساعة المميزة بالبنفسجي هي الأعلى نشاطاً — مرّر على أي عمود لرؤية العدد</p>
            </div>

            {/* Day distribution */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                <h3 className="font-black text-slate-200 mb-5 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-cyan-400">calendar_view_week</span>
                    توزيع الحجوزات على أيام الأسبوع (آخر 90 يوم)
                </h3>
                {loading
                    ? <div className="h-40 bg-slate-800 rounded-xl animate-pulse" />
                    : (
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={data?.dayData} margin={{ right: 4, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Bar dataKey="count" name="الحجوزات" radius={[4,4,0,0]} maxBarSize={40}>
                                    {data?.dayData?.map((d) => (
                                        <Cell key={d.day}
                                            fill={d.day === data.peakDay?.day ? '#06b6d4' : '#1e293b'}
                                            stroke={d.day === data.peakDay?.day ? '#06b6d4' : '#334155'}
                                            strokeWidth={1}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )
                }
            </div>
        </div>
    );
}


export { ActivityHeatmapTab };

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { getPlatformStats, getAuditLogs } from '../../../Services/adminService';
import { StatCard, BarRow, SectionTitle, ACTION_META, ErrorState } from '../adminShared';
import { fmtDateTime } from '../../../utils/dateFormat';

function OverviewSection({ onNavigate, liveTick }) {
    const [stats, setStats]       = useState(null);
    const [recentLogs, setLogs]   = useState([]);
    const [loading, setLoading]   = useState(true);
    const [logsLoading, setLL]    = useState(true);
    const [error, setError]       = useState(false);

    const load = useCallback(() => {
        setError(false);
        getPlatformStats()
            .then((data) => setStats(data.data))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
        getAuditLogs({ limit: 7 })
            .then((data) => setLogs(data.data?.logs || []))
            .finally(() => setLL(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    // Live refetch on real-time events (skip the initial mount).
    const liveFirst = useRef(true);
    useEffect(() => {
        if (liveFirst.current) { liveFirst.current = false; return; }
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveTick]);

    const growthPct = stats?.newUsersLastWeek > 0
        ? Math.round(((stats.newUsersThisWeek - stats.newUsersLastWeek) / stats.newUsersLastWeek) * 100)
        : null;

    // True approval rate: approved ÷ (approved + rejected) — pending requests
    // are still undecided so they don't belong in the denominator.
    const approvalRate = stats && (stats.totalDoctors + (stats.rejectedDoctors ?? 0)) > 0
        ? Math.round((stats.totalDoctors / (stats.totalDoctors + (stats.rejectedDoctors ?? 0))) * 100)
        : null;

    // Cancellation rate this week: cancelled ÷ (cancelled + kept) over the same
    // 7-day slot-date window the weekly booking counts use.
    const weekBookingsTotal = (stats?.thisWeekBookings ?? 0) + (stats?.thisWeekCancelled ?? 0);
    const cancelRate = weekBookingsTotal > 0
        ? Math.round(((stats?.thisWeekCancelled ?? 0) / weekBookingsTotal) * 100)
        : null;

    if (error) return <ErrorState onRetry={load} />;

    return (
        <div className="space-y-8" dir="rtl">
            <SectionTitle icon="dashboard" title="نظرة عامة" subtitle="إحصائيات المنصة في الوقت الفعلي" />

            {/* Primary KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon="personal_injury"  label="المرضى المسجلين"   value={stats?.totalPatients?.toLocaleString('ar-EG')}  color="emerald" loading={loading} />
                <StatCard icon="directions_walk"  label="زيارات مباشرة اليوم" value={stats?.todayWalkIns?.toLocaleString('ar-EG')}   color="blue"    loading={loading} />
                <StatCard icon="today"            label="حجوزات اليوم"      value={stats?.todayBookings?.toLocaleString('ar-EG')}  color="cyan"    loading={loading} />
                <StatCard icon="smart_toy"        label="محادثات AI هذا الأسبوع" value={stats?.thisWeekAiChats?.toLocaleString('ar-EG')} color="violet" loading={loading}
                    sub={stats?.thisWeekAiMessages != null ? `${stats.thisWeekAiMessages.toLocaleString('ar-EG')} رسالة إجمالاً` : null} />
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard icon="stethoscope" label="الأطباء المفعّلين"        value={stats?.totalDoctors?.toLocaleString('ar-EG')}     color="emerald" loading={loading} />
                <StatCard icon="pending"    label="طلبات انتظار"              value={stats?.pendingDoctors?.toLocaleString('ar-EG')}   color="amber"   loading={loading}
                    sub="اضغط لفتح الطلبات" onClick={() => onNavigate?.('pending-doctors')} />
                <StatCard icon="block"      label="أطباء موقوفون"             value={stats?.suspendedDoctors?.toLocaleString('ar-EG')} color="red"     loading={loading} />
                <StatCard icon="person_add" label="مستخدمون جدد هذا الأسبوع" value={stats?.newUsersThisWeek?.toLocaleString('ar-EG')} color={growthPct >= 0 ? 'emerald' : 'red'} loading={loading} trend={growthPct}
                    sub={stats?.newUsersLastWeek != null ? `الأسبوع الماضي: ${stats.newUsersLastWeek}` : null} />
                <StatCard icon="event_available" label="حجوزات عبر المنصة هذا الأسبوع" value={stats?.thisWeekBookings?.toLocaleString('ar-EG')} color="blue" loading={loading} />
                <StatCard icon="door_front"      label="زيارات مباشرة هذا الأسبوع"     value={stats?.thisWeekWalkIns?.toLocaleString('ar-EG')}  color="cyan" loading={loading} />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top specializations */}
                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                    <h3 className="font-black text-slate-200 mb-5 flex items-center gap-2 text-sm">
                        <span className="material-symbols-outlined text-[18px] text-emerald-400">bar_chart</span>
                        أعلى التخصصات طلباً
                        <span className="text-[10px] text-slate-600 font-normal">(بعدد الحجوزات)</span>
                    </h3>
                    {loading ? (
                        <div className="space-y-3">{[80,65,50,40,30].map((w,i) => <div key={i} className="h-4 bg-slate-800 rounded-full animate-pulse" style={{width:`${w}%`}} />)}</div>
                    ) : stats?.topSpecializations?.length ? (
                        <div className="space-y-3">
                            {stats.topSpecializations.map((s, i) => (
                                <BarRow key={i} label={s.name} count={s.count} max={stats.topSpecializations[0].count} color="emerald" rank={i} />
                            ))}
                        </div>
                    ) : <p className="text-sm text-slate-600">لا توجد بيانات</p>}
                </div>

                {/* Top cities */}
                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                    <h3 className="font-black text-slate-200 mb-5 flex items-center gap-2 text-sm">
                        <span className="material-symbols-outlined text-[18px] text-blue-400">location_city</span>
                        أعلى المدن طلباً
                        <span className="text-[10px] text-slate-600 font-normal">(بعدد الحجوزات)</span>
                    </h3>
                    {loading ? (
                        <div className="space-y-3">{[75,60,45,35,25].map((w,i) => <div key={i} className="h-4 bg-slate-800 rounded-full animate-pulse" style={{width:`${w}%`}} />)}</div>
                    ) : stats?.topCities?.length ? (
                        <div className="space-y-3">
                            {stats.topCities.map((c, i) => (
                                <BarRow key={i} label={c.name} count={c.count} max={stats.topCities[0].count} color="blue" rank={i} />
                            ))}
                        </div>
                    ) : <p className="text-sm text-slate-600">لا توجد بيانات</p>}
                </div>

                {/* Recent activity */}
                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                    <h3 className="font-black text-slate-200 mb-5 flex items-center gap-2 text-sm">
                        <span className="material-symbols-outlined text-[18px] text-violet-400">history</span>
                        آخر الإجراءات
                    </h3>
                    {logsLoading ? (
                        <div className="space-y-4">
                            {[1,2,3,4,5].map(i => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-slate-800 animate-pulse flex-shrink-0" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-3 bg-slate-800 rounded-full animate-pulse w-3/4" />
                                        <div className="h-2 bg-slate-800 rounded-full animate-pulse w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : recentLogs.length ? (
                        <div className="space-y-3">
                            {recentLogs.map((log, i) => {
                                const meta = ACTION_META[log.action] || { label: log.action, icon: 'info', bg: 'bg-slate-700', text: 'text-slate-400' };
                                return (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className={`w-8 h-8 rounded-xl ${meta.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                            <span className={`material-symbols-outlined text-[14px] ${meta.text}`}>{meta.icon}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-bold ${meta.text}`}>{meta.label}</p>
                                            <p className="text-[11px] text-slate-600 truncate">{log.admin?.name ?? 'مشرف'} · {fmtDateTime(log.createdAt)}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : <p className="text-sm text-slate-600">لا توجد إجراءات حديثة</p>}
                </div>
            </div>

            {/* Metrics strip */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-emerald-950/60 to-slate-900 rounded-2xl p-5 border border-emerald-800/30">
                    <div className="flex items-center gap-2.5 mb-3">
                        <span className="material-symbols-outlined text-emerald-400 text-[20px]">verified</span>
                        <span className="text-sm font-bold text-slate-300">معدل قبول الأطباء</span>
                    </div>
                    {loading ? <div className="h-7 w-20 bg-slate-800 rounded animate-pulse" /> : (
                        <>
                            <p className="text-3xl font-black text-emerald-400">{approvalRate ?? '—'}<span className="text-lg">%</span></p>
                            <p className="text-xs text-slate-600 mt-1">{stats?.totalDoctors ?? 0} مقبول مقابل {stats?.rejectedDoctors ?? 0} مرفوض</p>
                            <div className="mt-3 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${approvalRate ?? 0}%` }} transition={{ duration: 1 }}
                                    className="h-1.5 bg-gradient-to-r from-emerald-700 to-emerald-400 rounded-full"
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="bg-gradient-to-br from-amber-950/40 to-slate-900 rounded-2xl p-5 border border-amber-900/30">
                    <div className="flex items-center gap-2.5 mb-3">
                        <span className="material-symbols-outlined text-amber-400 text-[20px]">event_busy</span>
                        <span className="text-sm font-bold text-slate-300">نسبة الإلغاء هذا الأسبوع</span>
                    </div>
                    {loading ? <div className="h-7 w-20 bg-slate-800 rounded animate-pulse" /> : (
                        <>
                            <p className="text-3xl font-black text-amber-400">{cancelRate ?? '—'}<span className="text-lg">%</span></p>
                            <p className="text-xs text-slate-600 mt-1">
                                {stats?.thisWeekCancelled ?? 0} ملغي من أصل {weekBookingsTotal} حجز خلال آخر 7 أيام
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}


export { OverviewSection };

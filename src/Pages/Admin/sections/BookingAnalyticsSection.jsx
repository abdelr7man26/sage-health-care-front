import { useState, useEffect, useCallback, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, PieChart, Pie } from 'recharts';
import { getBookingAnalytics } from '../../../Services/adminService';
import { StatCard, SectionTitle, ChartTooltip, ErrorState } from '../adminShared';

// ── Booking Analytics section ─────────────────────────────────────────────────

const BOOKING_STATUS_META = {
    completed:    { label: 'مكتملة',   fill: '#10b981' },
    confirmed:    { label: 'مؤكدة',    fill: '#3b82f6' },
    cancelled:    { label: 'ملغاة',    fill: '#ef4444' },
    'in-progress':{ label: 'جارية',    fill: '#f59e0b' },
    pending:      { label: 'معلقة',    fill: '#64748b' },
};
const WALKIN_STATUS_META = {
    done:      { label: 'منتهية',  fill: '#10b981' },
    waiting:   { label: 'منتظرة', fill: '#f59e0b' },
    cancelled: { label: 'ملغاة',  fill: '#ef4444' },
};
const OPERATION_STATUS_META = {
    done:      { label: 'منتهية',  fill: '#10b981' },
    scheduled: { label: 'مجدولة', fill: '#3b82f6' },
    cancelled: { label: 'ملغاة',  fill: '#ef4444' },
};

// ── Date-range picker (dark theme — admin) ────────────────────────────────────
// Same UX as the doctor analytics picker, restyled for the slate admin theme.
function AdminDateRangePicker({ startDate, endDate, onApply }) {
    const [open,       setOpen]       = useState(false);
    const [localStart, setLocalStart] = useState(startDate);
    const [localEnd,   setLocalEnd]   = useState(endDate);
    const ref = useRef(null);

    useEffect(() => { setLocalStart(startDate); setLocalEnd(endDate); }, [startDate, endDate]);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fmt = (d) => d
        ? new Date(d + 'T12:00:00').toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })
        : '—';

    const valid   = localStart && localEnd && localStart <= localEnd;
    const sameDay = startDate === endDate;

    return (
        <div ref={ref} className="relative" dir="rtl">
            {/* Trigger */}
            <button onClick={() => setOpen(o => !o)}
                className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-[13px] font-bold whitespace-nowrap transition-colors
                    ${open
                        ? 'bg-slate-800 text-slate-100 border-emerald-500/50'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'}`}
            >
                <span className="material-symbols-outlined text-[16px] text-emerald-400">calendar_month</span>
                <span>{fmt(startDate)}</span>
                {!sameDay && (
                    <>
                        <span className="text-slate-600 text-[10px]">←</span>
                        <span>{fmt(endDate)}</span>
                    </>
                )}
                <span className={`material-symbols-outlined text-[14px] text-slate-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
                    keyboard_arrow_down
                </span>
            </button>

            {/* Popover */}
            {open && (
                <div className="absolute top-[calc(100%+10px)] right-0 z-50 w-64 p-5 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl shadow-black/50">
                    <div className="space-y-3.5">
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold tracking-widest uppercase text-slate-500">من</label>
                            <input type="date" value={localStart} onChange={(e) => setLocalStart(e.target.value)}
                                style={{ colorScheme: 'dark' }}
                                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2.5 text-sm font-medium text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors" />
                        </div>
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold tracking-widest uppercase text-slate-500">إلى</label>
                            <input type="date" value={localEnd} min={localStart} onChange={(e) => setLocalEnd(e.target.value)}
                                style={{ colorScheme: 'dark' }}
                                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2.5 text-sm font-medium text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors" />
                        </div>
                    </div>
                    <div className="my-4 h-px bg-slate-800" />
                    <button onClick={() => { if (valid) { onApply(localStart, localEnd); setOpen(false); } }} disabled={!valid}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-[13px] font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                        تطبيق الفلتر
                    </button>
                </div>
            )}
        </div>
    );
}

const _pad2  = (n) => String(n).padStart(2, '0');
const _isoDay = (d) => `${d.getFullYear()}-${_pad2(d.getMonth() + 1)}-${_pad2(d.getDate())}`;

function BookingAnalyticsSection() {
    const [analyticsData, setAnalyticsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // الفترة الافتراضية: آخر 30 يوم حتى اليوم
    const [startDate, setStartDate] = useState(() => _isoDay(new Date(Date.now() - 29 * 86_400_000)));
    const [endDate,   setEndDate]   = useState(() => _isoDay(new Date()));

    // بيانات التحليل — تتغير بالفلتر الزمني
    const load = useCallback(() => {
        setLoading(true);
        setError(false);
        getBookingAnalytics({ startDate, endDate })
            .then((r) => setAnalyticsData(r.data))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [startDate, endDate]);

    useEffect(() => { load(); }, [load]);

    // توزيع الحالات — 3 donuts
    const bookingDist  = (analyticsData?.statusDistribution          ?? []).map(s => ({ ...s, label: BOOKING_STATUS_META[s._id]?.label   ?? s._id, fill: BOOKING_STATUS_META[s._id]?.fill   ?? '#64748b' }));
    const walkInDist   = (analyticsData?.walkInStatusDistribution    ?? []).map(s => ({ ...s, label: WALKIN_STATUS_META[s._id]?.label    ?? s._id, fill: WALKIN_STATUS_META[s._id]?.fill    ?? '#64748b' }));
    const opsDist      = (analyticsData?.operationStatusDistribution ?? []).map(s => ({ ...s, label: OPERATION_STATUS_META[s._id]?.label ?? s._id, fill: OPERATION_STATUS_META[s._id]?.fill ?? '#64748b' }));
    const bookingTotal = bookingDist.reduce((a, s) => a + s.count, 0);
    const walkInTotal  = walkInDist.reduce((a, s) => a + s.count, 0);
    const opsDistTotal = opsDist.reduce((a, s) => a + s.count, 0);
    const completedCount = bookingDist.find(s => s._id === 'completed')?.count ?? 0;

    // Merge daily bookings + walk-ins + operations into a combined dataset for Recharts
    const bookingsMap  = Object.fromEntries((analyticsData?.dailyTrend     ?? []).map(d => [d._id, d.count]));
    const walkInsMap   = Object.fromEntries((analyticsData?.walkInTrend    ?? []).map(d => [d._id, d.count]));
    const opsMap       = Object.fromEntries((analyticsData?.operationTrend ?? []).map(d => [d._id, d.count]));
    const allDates     = [...new Set([...Object.keys(bookingsMap), ...Object.keys(walkInsMap), ...Object.keys(opsMap)])].sort();
    const dailyChartData = allDates.map(date => ({
        label:     date.slice(5),     // "MM-DD"
        حجوزات:    bookingsMap[date]  ?? 0,
        زيارات:    walkInsMap[date]   ?? 0,
        عمليات:    opsMap[date]       ?? 0,
    }));

    const wi  = analyticsData?.walkIns;
    const ops = analyticsData?.operations;

    if (error) return <ErrorState onRetry={load} />;

    return (
        <div dir="rtl">
            <SectionTitle icon="analytics" title="إحصائيات العيادات" subtitle="نشاط الحجوزات والزيارات المباشرة والعمليات" />

            {/* فلتر الفترة الزمنية */}
            <div className="mb-6">
                <AdminDateRangePicker startDate={startDate} endDate={endDate}
                    onApply={(s, e) => { setStartDate(s); setEndDate(e); }} />
            </div>

            {/* حجوزات المنصة — 5 بطاقات */}
            <p className="text-[11px] font-black text-blue-400/80 uppercase tracking-widest mb-2">حجوزات المنصة</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <StatCard icon="calendar_month" label="إجمالي الحجوزات"
                    value={loading ? null : analyticsData?.totalBookings?.toLocaleString('ar-EG')}
                    color="blue" loading={loading} />
                <StatCard icon="task_alt" label="حجوزات مكتملة"
                    value={loading ? null : completedCount.toLocaleString('ar-EG')}
                    color="emerald" loading={loading} />
                <StatCard icon="percent" label="معدل الإتمام"
                    value={loading ? null : `${analyticsData?.completionRate ?? '—'}%`}
                    color="violet" loading={loading} />
                <StatCard icon="event_busy" label="معدل الإلغاء"
                    value={loading ? null : `${analyticsData?.cancellationRate ?? '—'}%`}
                    color="red" loading={loading} />
                <StatCard icon="today" label="متوسط يومي"
                    value={loading ? null : analyticsData?.avgDailyBookings?.toLocaleString('ar-EG')}
                    color="cyan" loading={loading} />
            </div>

            {/* الزيارات المباشرة — نفس البطاقات الخمس */}
            <p className="text-[11px] font-black text-cyan-400/80 uppercase tracking-widest mb-2">الزيارات المباشرة</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <StatCard icon="directions_walk" label="إجمالي الزيارات"
                    value={loading ? null : wi?.total?.toLocaleString('ar-EG')}
                    color="blue" loading={loading} />
                <StatCard icon="task_alt" label="زيارات منتهية"
                    value={loading ? null : wi?.done?.toLocaleString('ar-EG')}
                    color="emerald" loading={loading} />
                <StatCard icon="percent" label="معدل الإتمام"
                    value={loading ? null : `${wi?.completionRate ?? '—'}%`}
                    color="violet" loading={loading} />
                <StatCard icon="event_busy" label="معدل الإلغاء"
                    value={loading ? null : `${wi?.cancellationRate ?? '—'}%`}
                    color="red" loading={loading} />
                <StatCard icon="today" label="متوسط يومي"
                    value={loading ? null : wi?.avgDaily?.toLocaleString('ar-EG')}
                    color="cyan" loading={loading} />
            </div>

            {/* العمليات — مقاييس تناسب طبيعتها (نادرة ومجدولة مسبقاً) */}
            <p className="text-[11px] font-black text-amber-400/80 uppercase tracking-widest mb-2">العمليات</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <StatCard icon="medical_services" label="إجمالي العمليات"
                    value={loading ? null : ops?.total?.toLocaleString('ar-EG')}
                    color="blue" loading={loading} />
                <StatCard icon="task_alt" label="عمليات منتهية"
                    value={loading ? null : ops?.done?.toLocaleString('ar-EG')}
                    color="emerald" loading={loading} />
                <StatCard icon="event_upcoming" label="عمليات قادمة"
                    value={loading ? null : ops?.upcoming?.toLocaleString('ar-EG')}
                    sub="مجدولة بعد اليوم"
                    color="violet" loading={loading} />
                <StatCard icon="event_busy" label="معدل الإلغاء"
                    value={loading ? null : `${ops?.cancellationRate ?? '—'}%`}
                    color="red" loading={loading} />
                <StatCard icon="timer" label="متوسط مدة العملية"
                    value={loading ? null : ops?.avgDurationMin != null
                        ? (ops.avgDurationMin >= 60
                            ? `${Math.floor(ops.avgDurationMin / 60)}س ${ops.avgDurationMin % 60}د`
                            : `${ops.avgDurationMin} دقيقة`)
                        : '—'}
                    color="cyan" loading={loading} />
            </div>

            {/* رسوم بيانية */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* حجم الحجوزات اليومي — يتأثر بالفلتر */}
                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                    <h3 className="font-black text-slate-200 mb-5 flex items-center gap-2 text-sm">
                        <span className="material-symbols-outlined text-[18px] text-blue-400">show_chart</span>
                        النشاط اليومي — حجوزات وزيارات وعمليات
                        <span className="text-[10px] text-slate-600 font-normal">(خلال الفترة المحددة)</span>
                    </h3>
                    {loading
                        ? <div className="h-52 bg-slate-800 rounded-xl animate-pulse" />
                        : dailyChartData.length ? (
                            <ResponsiveContainer width="100%" height={210}>
                                <AreaChart data={dailyChartData} margin={{ right: 4, left: -20 }}>
                                    <defs>
                                        <linearGradient id="gBookings" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gWalkIns" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gOps" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false}
                                        interval={Math.floor(dailyChartData.length / 6)} />
                                    <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12, direction: 'rtl' }}
                                        formatter={v => <span style={{ color: '#94a3b8' }}>{v}</span>} />
                                    <Area type="monotone" dataKey="حجوزات" stroke="#3b82f6" fill="url(#gBookings)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                                    <Area type="monotone" dataKey="زيارات"  stroke="#06b6d4" fill="url(#gWalkIns)"  strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                                    <Area type="monotone" dataKey="عمليات"  stroke="#f59e0b" fill="url(#gOps)"      strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : <p className="text-sm text-slate-600">لا توجد بيانات</p>
                    }
                </div>

                {/* توزيع الحالات — 3 donuts */}
                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                    <h3 className="font-black text-slate-200 mb-5 flex items-center gap-2 text-sm">
                        <span className="material-symbols-outlined text-[18px] text-violet-400">donut_large</span>
                        توزيع الحالات
                        <span className="text-[10px] text-slate-600 font-normal">(خلال الفترة المحددة)</span>
                    </h3>
                    {loading ? (
                        <div className="grid grid-cols-3 gap-4">
                            {[1,2,3].map(i => (
                                <div key={i} className="flex flex-col items-center gap-3">
                                    <div className="w-24 h-24 bg-slate-800 rounded-full animate-pulse" />
                                    <div className="space-y-2 w-full">
                                        {[1,2,3].map(j => <div key={j} className="h-3 bg-slate-800 rounded animate-pulse" />)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { title: 'حجوزات',       data: bookingDist, total: bookingTotal,  accent: '#3b82f6' },
                                { title: 'زيارات مباشرة', data: walkInDist,  total: walkInTotal,   accent: '#06b6d4' },
                                { title: 'عمليات',        data: opsDist,     total: opsDistTotal,  accent: '#f59e0b' },
                            ].map(({ title, data, total, accent }) => (
                                <div key={title} className="flex flex-col items-center">
                                    <p className="text-[11px] font-black uppercase tracking-widest mb-2" style={{ color: accent }}>{title}</p>
                                    {data.length ? (
                                        <>
                                            <div className="relative w-full">
                                                <ResponsiveContainer width="100%" height={110}>
                                                    <PieChart>
                                                        <Pie data={data} cx="50%" cy="50%"
                                                            innerRadius={32} outerRadius={48}
                                                            dataKey="count" strokeWidth={2} stroke="#0f172a"
                                                            isAnimationActive>
                                                            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                                        </Pie>
                                                        <Tooltip
                                                            formatter={(v, _, p) => [v, p.payload.label]}
                                                            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 11 }}
                                                            itemStyle={{ color: '#94a3b8' }}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                    <span className="text-base font-black text-white leading-none">{total.toLocaleString('ar-EG')}</span>
                                                    <span className="text-[9px] text-slate-500 mt-0.5">إجمالي</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5 w-full mt-1">
                                                {data.map((s, i) => (
                                                    <div key={i} className="flex items-center gap-1.5 text-[11px]">
                                                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.fill }} />
                                                        <span className="text-slate-400 flex-1 truncate">{s.label}</span>
                                                        <span className="text-slate-200 font-bold tabular-nums">{s.count.toLocaleString('ar-EG')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-xs text-slate-600 mt-10">لا توجد بيانات</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}


export { BookingAnalyticsSection };

/**
 * Analytics.jsx
 *
 * Doctor analytics dashboard with period filter, revenue trend line chart,
 * peak-hours bar chart, projected revenue, patient satisfaction rating,
 * no-show rate, and month-over-month completion comparison.
 *
 * Charts: Recharts (LineChart, BarChart) + custom SVG donut (existing style).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ResponsiveContainer,
    LineChart, Line,
    BarChart, Bar,
    XAxis, YAxis,
    CartesianGrid, Tooltip,
    ReferenceLine,
} from 'recharts';
import axiosInstance from '../../api/axiosInstance';

// ── Constants ──────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('ar-EG');

// ── Shared tooltip for recharts ────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, suffix = '' }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs font-bold" dir="rtl">
            <p className="text-gray-400 mb-0.5">{label}</p>
            <p className="text-[#134e3a]">{fmt(payload[0].value)}{suffix}</p>
        </div>
    );
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ emoji, icon, iconColor, label, value, sub, badge, bg }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${bg} rounded-2xl p-5 flex items-start gap-4`}
        >
            <div className="w-11 h-11 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
                {emoji
                    ? <span className="text-xl">{emoji}</span>
                    : <span className={`material-symbols-outlined text-[22px] ${iconColor}`}>{icon}</span>
                }
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-gray-500 mb-0.5">{label}</p>
                <p className="text-2xl font-black text-[#191c1c] leading-none">{value}</p>
                {sub && <p className="text-[10px] text-gray-400 mt-1">{sub}</p>}
            </div>
            {badge && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>
                    {badge.text}
                </span>
            )}
        </motion.div>
    );
}

// ── Revenue trend — 4-line chart ──────────────────────────────────────────────
const REVENUE_LINES = [
    { key: 'bookingsRevenue',   label: 'الحجوزات',  color: '#10B981' },
    { key: 'walkinsRevenue',    label: 'Walk-in',    color: '#F59E0B' },
    { key: 'operationsRevenue', label: 'العمليات',  color: '#8B5CF6' },
    { key: 'totalRevenue',      label: 'الإجمالي',  color: '#3B82F6' },
];

function RevenueTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-xl px-4 py-3 min-w-[170px]" dir="rtl">
            <p className="text-[11px] font-bold text-gray-400 mb-2.5 border-b border-gray-50 pb-2">{label}</p>
            {REVENUE_LINES.map(({ key, label: lbl, color }) => {
                const entry = payload.find(p => p.dataKey === key);
                if (!entry) return null;
                return (
                    <div key={key} className="flex items-center justify-between gap-4 mb-1.5 last:mb-0">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                            <span className="text-[11px] text-gray-500">{lbl}</span>
                        </div>
                        <span className="text-[11px] font-black text-[#191c1c]">{fmt(entry.value)} ج</span>
                    </div>
                );
            })}
        </div>
    );
}

function RevenueTrendChart({ data }) {
    if (!data?.length) return null;
    const hasData = data.some(d => d.totalRevenue > 0);
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
                <div>
                    <h3 className="text-sm font-black text-[#191c1c]">منحنى الإيرادات</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">حجوزات · Walk-in · عمليات</p>
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-end max-w-[200px]">
                    {REVENUE_LINES.map(({ key, label, color }) => (
                        <span key={key} className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 whitespace-nowrap">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                            {label}
                        </span>
                    ))}
                </div>
            </div>

            {!hasData ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-300">
                    <span className="material-symbols-outlined text-[40px] mb-2">show_chart</span>
                    <p className="text-sm font-medium">لا توجد إيرادات في هذه الفترة</p>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={190}>
                    <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                        <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'Cairo' }}
                            axisLine={false} tickLine={false}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: '#d1d5db', fontFamily: 'Cairo' }}
                            axisLine={false} tickLine={false}
                            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                        />
                        <Tooltip content={<RevenueTooltip />} />
                        {REVENUE_LINES.map(({ key, color }) => (
                            <Line
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={color}
                                strokeWidth={key === 'totalRevenue' ? 2.5 : 1.8}
                                dot={false}
                                activeDot={{ r: 5, strokeWidth: 0, fill: color }}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}

// ── Peak hours bar chart ───────────────────────────────────────────────────────
const to12h = (h) => {
    if (h === 0)  return '12 ص';
    if (h < 12)   return `${h} ص`;
    if (h === 12) return '12 م';
    return `${h - 12} م`;
};

function PeakHoursChart({ data }) {
    if (!data?.length) return null;
    const chartData = data.map(d => ({ ...d, label: to12h(d.hour) }));
    const hasData = chartData.some(d => d.count > 0);
    const peakHour = hasData ? chartData.reduce((a, b) => b.count > a.count ? b : a, chartData[0]) : null;
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-black text-[#191c1c]">أوقات الزحمة</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">أكثر ساعات الحجز ازدحاماً</p>
                </div>
                {peakHour?.count > 0 && (
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-full">
                        ذروة: {peakHour.label}
                    </span>
                )}
            </div>
            {!hasData ? (
                <div className="flex flex-col items-center justify-center h-36 text-gray-300">
                    <span className="material-symbols-outlined text-[36px] mb-2">bar_chart</span>
                    <p className="text-sm font-medium">لا توجد بيانات للفترة المختارة</p>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={14}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'Cairo' }} axisLine={false} tickLine={false} interval={1} />
                        <YAxis tick={{ fontSize: 10, fill: '#d1d5db', fontFamily: 'Cairo' }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip suffix=" حجز" />} />
                        {peakHour && <ReferenceLine x={peakHour.label} stroke="#f97316" strokeDasharray="4 2" strokeWidth={1.5} />}
                        <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} opacity={0.85} />
                    </BarChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}

// ── SVG donut (completion vs cancellation) ─────────────────────────────────────
function DonutChart({ completed, cancelled, ops, prevMonthPct, prevLabel = 'عن الشهر الماضي' }) {
    const total        = completed + cancelled;
    const completedPct = total > 0 ? (completed / total) * 100 : 0;
    const currentPct   = Math.round(completedPct);

    const gradient = total === 0
        ? '#e5e7eb'
        : `conic-gradient(#10b981 0% ${completedPct}%, #fca5a5 ${completedPct}% 100%)`;

    const momDiff = prevMonthPct != null ? currentPct - prevMonthPct : null;

    return (
        <div className="flex flex-col items-center gap-5">
            <div className="relative" style={{ width: 148, height: 148 }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: gradient }} />
                <div className="absolute inset-0 flex items-center justify-center" style={{ margin: '20%' }}>
                    <div className="w-full h-full rounded-full bg-white flex flex-col items-center justify-center shadow-sm">
                        <span className="text-lg font-black text-[#134e3a] leading-none">{currentPct}%</span>
                        <span className="text-[9px] text-gray-400 mt-0.5">مكتملة</span>
                    </div>
                </div>
            </div>

            {/* MoM comparison badge */}
            {momDiff != null && (
                <div className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full ${
                    momDiff > 0 ? 'bg-emerald-50 text-emerald-600' :
                    momDiff < 0 ? 'bg-red-50 text-red-500'         :
                    'bg-gray-50 text-gray-500'
                }`}>
                    <span className="material-symbols-outlined text-[13px]">
                        {momDiff > 0 ? 'trending_up' : momDiff < 0 ? 'trending_down' : 'trending_flat'}
                    </span>
                    {momDiff > 0 ? `+${momDiff}%` : momDiff < 0 ? `${momDiff}%` : 'بدون تغيير'}
                    <span className="font-normal text-[10px] opacity-70">{prevLabel}</span>
                </div>
            )}

            <div className="flex flex-col gap-2 w-full">
                {[
                    { color: 'bg-emerald-400', label: 'كشوفات مكتملة', value: completed },
                    { color: 'bg-red-300',     label: 'ملغية',          value: cancelled },
                    { color: 'bg-purple-300',  label: 'عمليات',          value: ops       },
                ].map(({ color, label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                            <span className="text-xs text-gray-500">{label}</span>
                        </div>
                        <span className="text-xs font-bold text-[#191c1c]">{value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── SVG daily/weekly/yearly bar chart (reused from original) ───────────────────
function DailyBarChart({ dailyData }) {
    const [hovered, setHovered] = useState(null);
    if (!dailyData?.length) return null;

    const W = 620, H = 190;
    const PAD = { top: 24, right: 12, bottom: 28, left: 28 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top  - PAD.bottom;

    const maxVal  = Math.max(...dailyData.map(d => d.bookings), 1);
    const barW    = Math.max(Math.floor(cW / dailyData.length) - 2, 4);
    const topTick = maxVal === 1 ? 1 : Math.ceil(maxVal / 2) * 2;
    const yTicks  = [0, Math.ceil(topTick / 2), topTick];
    const hasLabel = dailyData.some(d => d.label);

    return (
        <div className="relative">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ fontFamily: 'Cairo, sans-serif' }}>
                {yTicks.map(tick => {
                    const y = PAD.top + cH - (tick / topTick) * cH;
                    return (
                        <g key={tick}>
                            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                                stroke={tick === 0 ? '#d1fae5' : '#f3f4f6'}
                                strokeWidth={tick === 0 ? 1 : 0.8} />
                            <text x={PAD.left - 4} y={y + 3.5} textAnchor="end" fontSize="8" fill="#d1d5db">{tick}</text>
                        </g>
                    );
                })}

                {dailyData.map((d, i) => {
                    const barH  = d.bookings > 0 ? Math.max((d.bookings / topTick) * cH, 3) : 0;
                    const x     = PAD.left + i * (barW + 2);
                    const y     = PAD.top + cH - barH;
                    const isHov = hovered?.day === d.day;
                    const showLabel = hasLabel
                        ? true
                        : (d.day === 1 || d.day % 5 === 0);

                    return (
                        <g key={d.day}
                            onMouseEnter={() => setHovered(d)}
                            onMouseLeave={() => setHovered(null)}
                            style={{ cursor: d.bookings > 0 ? 'pointer' : 'default' }}>
                            <rect x={x} y={PAD.top} width={barW} height={cH} fill="transparent" />
                            <rect
                                x={x} y={d.bookings > 0 ? y : PAD.top + cH - 1}
                                width={barW} height={d.bookings > 0 ? barH : 1}
                                rx="2" ry="2"
                                fill={isHov ? '#134e3a' : '#10b981'}
                                opacity={d.bookings === 0 ? 0.12 : 1}
                                style={{ transition: 'fill 0.12s' }}
                            />
                            {showLabel && (
                                <text x={x + barW / 2} y={H - 8}
                                    textAnchor="middle" fontSize="8" fill="#9ca3af">
                                    {d.label ?? d.day}
                                </text>
                            )}
                        </g>
                    );
                })}

                {hovered && (
                    <text x={W / 2} y={13} textAnchor="middle" fontSize="10" fill="#134e3a" fontWeight="700">
                        {hovered.label ?? `يوم ${hovered.day}`}: {hovered.bookings} مريض
                        {hovered.revenue > 0 ? ` · ${fmt(hovered.revenue)} جنيه` : ''}
                    </text>
                )}
            </svg>
            <p className="text-center text-[10px] text-gray-300 -mt-1">
                {dailyData.some(d => d.label) ? 'المحاور الزمنية' : 'أيام الشهر'}
            </p>
        </div>
    );
}

// ── Rating stars display ───────────────────────────────────────────────────────
function StarRating({ value }) {
    if (value == null) return <span className="text-xs text-gray-300">لا توجد تقييمات</span>;
    const stars = Math.round(value);
    return (
        <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={`material-symbols-outlined text-[16px] ${i < stars ? 'text-amber-400' : 'text-gray-200'}`}>
                    star
                </span>
            ))}
        </div>
    );
}

// ── Premium Date-Range Picker ──────────────────────────────────────────────────
function DateRangePicker({ startDate, endDate, onApply }) {
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

    const valid    = localStart && localEnd && localStart <= localEnd;
    const sameDay  = startDate === endDate;

    return (
        <div ref={ref} className="relative" dir="rtl">

            {/* ── Trigger ─────────────────────────────────────────────────────── */}
            <button
                onClick={() => setOpen(o => !o)}
                className={`
                    group inline-flex items-center gap-2.5 px-4 py-2.5 select-none
                    rounded-2xl border text-[13px] font-medium whitespace-nowrap
                    transition-all duration-200
                    ${open
                        ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20'
                        : 'bg-white/80 backdrop-blur-sm text-slate-700 border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md'
                    }
                `}
            >
                <span className={`material-symbols-outlined text-[15px] transition-colors ${open ? 'text-white/60' : 'text-slate-400 group-hover:text-slate-500'}`}>
                    calendar_month
                </span>

                <span className="font-semibold">{fmt(startDate)}</span>

                {!sameDay && (
                    <>
                        <span className={`text-[10px] ${open ? 'text-white/30' : 'text-slate-300'}`}>←</span>
                        <span className="font-semibold">{fmt(endDate)}</span>
                    </>
                )}

                <span className={`material-symbols-outlined text-[14px] transition-transform duration-300 ${open ? 'rotate-180 text-white/50' : 'text-slate-400'}`}>
                    keyboard_arrow_down
                </span>
            </button>

            {/* ── Popover ─────────────────────────────────────────────────────── */}
            {open && (
                <div className="absolute top-[calc(100%+10px)] left-0 z-50 w-64 p-5 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/70 shadow-2xl shadow-slate-300/40">

                    <div className="space-y-3.5">
                        {/* من */}
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold tracking-widest uppercase text-slate-400">
                                من
                            </label>
                            <input
                                type="date"
                                value={localStart}
                                onChange={e => setLocalStart(e.target.value)}
                                className="w-full rounded-xl border-0 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                            />
                        </div>

                        {/* إلى */}
                        <div>
                            <label className="block mb-1.5 text-[10px] font-bold tracking-widest uppercase text-slate-400">
                                إلى
                            </label>
                            <input
                                type="date"
                                value={localEnd}
                                min={localStart}
                                onChange={e => setLocalEnd(e.target.value)}
                                className="w-full rounded-xl border-0 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                            />
                        </div>
                    </div>

                    <div className="my-4 h-px bg-slate-100" />

                    <button
                        onClick={() => { if (valid) { onApply(localStart, localEnd); setOpen(false); } }}
                        disabled={!valid}
                        className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white text-[13px] font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
                    >
                        تطبيق الفلتر
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Skeleton primitives ────────────────────────────────────────────────────────
const S = ({ className = '' }) => <div className={`shimmer rounded-lg ${className}`} />;

function SkeletonCard() {
    return (
        <div className="bg-white rounded-2xl p-5 flex items-start gap-4 border border-gray-100 shadow-sm">
            <S className="w-11 h-11 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0 space-y-2 pt-0.5">
                <S className="h-2.5 w-16" />
                <S className="h-6 w-28" />
                <S className="h-2 w-20" />
            </div>
            <S className="h-5 w-14 rounded-full shrink-0 mt-0.5" />
        </div>
    );
}

function SkeletonChart({ areaH = 'h-[190px]', legendItems = 0 }) {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-5">
                <div className="space-y-2">
                    <S className="h-4 w-36" />
                    <S className="h-3 w-24" />
                </div>
                {legendItems > 0 && (
                    <div className="flex flex-wrap gap-2 justify-end max-w-[180px]">
                        {Array.from({ length: legendItems }).map((_, i) => (
                            <S key={i} className="h-3 w-14 rounded-full" />
                        ))}
                    </div>
                )}
            </div>
            <S className={`w-full rounded-xl ${areaH}`} />
        </div>
    );
}

// ── Skeleton loader ────────────────────────────────────────────────────────────
function Skeleton() {
    return (
        <div className="space-y-5">

            {/* Row 1 — 8 stat cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>

            {/* Row 2 — Revenue trend + Peak hours */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <SkeletonChart areaH="h-[190px]" legendItems={4} />
                <SkeletonChart areaH="h-[160px]" />
            </div>

            {/* Row 3 — Daily bar chart + Completion donut */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2">
                    <SkeletonChart areaH="h-[190px]" />
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="space-y-1.5 mb-5">
                        <S className="h-4 w-24" />
                        <S className="h-3 w-32" />
                    </div>
                    <div className="flex flex-col items-center gap-5">
                        {/* donut circle */}
                        <S className="w-[148px] h-[148px] rounded-full" />
                        {/* legend rows */}
                        <div className="w-full space-y-2.5">
                            {[0, 1, 2].map(i => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <S className="w-2.5 h-2.5 rounded-full" />
                                        <S className="h-2.5 w-20 rounded" />
                                    </div>
                                    <S className="h-2.5 w-5 rounded" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Row 4 — Patient analysis */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <S className="h-4 w-32 mb-4" />
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} className="rounded-xl border border-gray-100 p-3.5">
                            <div className="flex items-center gap-1.5 mb-2">
                                <S className="w-5 h-5 rounded" />
                                <S className="h-5 w-10 rounded" />
                            </div>
                            <S className="h-2.5 w-16 rounded" />
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}

// ── Compact info chip ──────────────────────────────────────────────────────────
function Chip({ emoji, label, value, cls }) {
    return (
        <div className={`rounded-xl border p-3.5 ${cls}`}>
            <div className="flex items-center gap-1.5 mb-1">
                <span className="text-base">{emoji}</span>
                <span className="text-xl font-black text-[#191c1c]">{value}</span>
            </div>
            <p className="text-[11px] font-bold text-gray-600">{label}</p>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Analytics({ refreshKey = 0 }) {
    const now = new Date();
    const _pad = (n) => String(n).padStart(2, '0');

    // Use local date (not UTC) so the default range is correct in UTC+ timezones
    const todayIso      = `${now.getFullYear()}-${_pad(now.getMonth() + 1)}-${_pad(now.getDate())}`;
    const monthStartIso = `${now.getFullYear()}-${_pad(now.getMonth() + 1)}-01`;

    const [startDate, setStartDate] = useState(monthStartIso);
    const [endDate,   setEndDate]   = useState(todayIso);
    const [data,      setData]      = useState(null);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        setError(false);
        const params = new URLSearchParams({ period: 'custom', startDate, endDate });
        axiosInstance.get(`/doctors/analytics?${params}`)
            .then(r => setData(r.data.data))
            .catch(() => { setData(null); setError(true); })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate, refreshKey]);

    useEffect(() => { load(); }, [load]);

    // Derived totals (same as original)
    const completedTotal = data ? data.completed + data.walkInCount : 0;
    const cancelledTotal = data ? data.cancelled + (data.walkInCancelled || 0) : 0;
    const grandTotal     = completedTotal + cancelledTotal;

    const fmtDateAr = (d) => new Date(d + 'T12:00:00').toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
    const periodLabel = startDate === endDate
        ? fmtDateAr(startDate)
        : `${fmtDateAr(startDate)} — ${fmtDateAr(endDate)}`;

    return (
        <div dir="rtl">
            {/* ── Header ────────────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between mb-6">
                <div>
                    <h2 className="text-xl font-black text-[#191c1c]">لوحة الإحصائيات</h2>
                    <p className="text-xs text-slate-400 mt-0.5 font-medium">{periodLabel}</p>
                </div>

                <DateRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    onApply={(s, e) => { setStartDate(s); setEndDate(e); }}
                />
            </div>

            <AnimatePresence mode="wait">
                {loading ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Skeleton />
                    </motion.div>
                ) : error ? (
                    <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-24 text-gray-400">
                        <span className="material-symbols-outlined text-[48px] mb-3">error_outline</span>
                        <p className="font-semibold mb-3">تعذّر تحميل الإحصائيات</p>
                        <button onClick={load} className="px-5 py-2 bg-[#134e3a] text-white rounded-xl text-sm font-bold">
                            إعادة المحاولة
                        </button>
                    </motion.div>
                ) : (
                    <motion.div
                        key={`${startDate}-${endDate}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="space-y-5"
                    >
                        {/* ── Row 1: Core stat cards ──────────────────────────── */}
                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                            <StatCard
                                emoji="💰"
                                label="إجمالي الإيراد"
                                value={`${fmt(data.totalRevenue)} جنيه`}
                                sub="كشوفات + عمليات"
                                bg="bg-emerald-50"
                                badge={(() => {
                                    const curr = data.totalRevenue ?? 0;
                                    const prev = data.prevRevenue;   // null = no prev period; 0 = prev had visits but 0 revenue
                                    // ① مفيش بيانات خالص
                                    if (curr === 0 && prev == null) return null;
                                    // ② مفيش فترة سابقة — static badge بالإيراد الحالي
                                    if (prev == null) return { text: `${fmt(curr)} جنيه`, cls: 'bg-emerald-50 text-emerald-700' };
                                    // ③ الفترة السابقة كانت صفر — مقارنة خاصة
                                    if (prev === 0 && curr === 0) return { text: 'بدون تغيير', cls: 'bg-gray-50 text-gray-500' };
                                    if (prev === 0) return { text: '▲ أول إيراد', cls: 'bg-green-50 text-green-600' };
                                    // ④ مقارنة عادية
                                    const diff = Math.round(((curr - prev) / prev) * 100);
                                    if (diff > 0) return { text: `▲ +${diff}% نمو`,          cls: 'bg-green-50 text-green-600' };
                                    if (diff < 0) return { text: `▼ ${Math.abs(diff)}% هبوط`, cls: 'bg-red-50 text-red-600'   };
                                    return           { text: 'بدون تغيير',                    cls: 'bg-gray-50 text-gray-500'  };
                                })()}
                            />
                            <StatCard
                                emoji="🔮"
                                label= "الايراد المتوقع"
                                value={`${fmt(data.projectedRevenue)} جنيه`}
                                sub="كشوفات + عمليات"
                                bg="bg-violet-50"
                            />
                            <StatCard
                                emoji="👥"
                                label="إجمالي المرضى"
                                value={fmt(data.patientCount)}
                                sub="المنصه + العياده"
                                bg="bg-blue-50"
                            />
                            <StatCard
                                emoji="⭐"
                                label="متوسط التقييم"
                                value={data.avgRating != null ? `${data.avgRating} / 5` : '—'}
                                sub={data.ratingCount > 0 ? `${fmt(data.ratingCount)} تقييم` : 'لا توجد تقييمات بعد'}
                                bg="bg-amber-50"
                            />
                            <StatCard
                                emoji="✅"
                                label="كشوفات مكتملة"
                                value={fmt(completedTotal)}
                                sub={`${fmt(data.completed)}  حجز اونلاين + ${fmt(data.walkInCount)} حجز  من العياده`}
                                bg="bg-teal-50"
                                badge={(() => {
                                    if (grandTotal === 0) return null;
                                    const currRate = Math.round((completedTotal / grandTotal) * 100);
                                    if (data.prevCompletionRate == null) {
                                        if (currRate === 0) return null;
                                        return { text: `${currRate}% إتمام`, cls: 'bg-green-50 text-green-600' };
                                    }
                                    const diff = Math.round(currRate - data.prevCompletionRate);
                                    if (diff > 0) return { text: `▲ +${diff}% عن السابق`,           cls: 'bg-green-50 text-green-600' };
                                    if (diff < 0) return { text: `▼ ${Math.abs(diff)}% عن السابق`, cls: 'bg-red-50 text-red-600'     };
                                    return           { text: `${currRate}% إتمام`,                   cls: 'bg-gray-50 text-gray-600'   };
                                })()}
                            />
                            <StatCard
                                emoji="❌"
                                label="كشوفات ملغية"
                                value={fmt(cancelledTotal)}
                                sub={grandTotal > 0 ? `${Math.round((cancelledTotal / grandTotal) * 100)}% من الإجمالي` : '—'}
                                bg="bg-red-50"
                                badge={(() => {
                                    // الشهر/الفترة المستقبلية — مفيش بيانات خالص
                                    if (grandTotal === 0) return null;
                                    const currRate = Math.round((cancelledTotal / grandTotal) * 100);
                                    // مفيش بيانات للفترة السابقة
                                    if (data.prevCancellationRate == null) {
                                        if (currRate === 0) return null;
                                        return { text: `${currRate}% إلغاء`, cls: 'bg-red-50 text-red-600' };
                                    }
                                    const diff = Math.round(currRate - data.prevCancellationRate);
                                    if (diff > 0)  return { text: `▲ +${diff}% عن السابق`,           cls: 'bg-red-50 text-red-600'   };
                                    if (diff < 0)  return { text: `▼ ${Math.abs(diff)}% عن السابق`, cls: 'bg-green-50 text-green-600' };
                                    return             { text: `${currRate}% إلغاء`,                  cls: 'bg-gray-100 text-gray-500'  };
                                })()}
                            />
                            <StatCard
                                emoji="🔬"
                                label="عمليات منجزة"
                                value={fmt(data.opCount)}
                                sub={`${fmt(data.opRevenue)} جنيه إيراد`}
                                bg="bg-purple-50"
                            />
                            <StatCard
                                emoji="🏥"
                                label="نسبة إشغال العيادة"
                                value={data.totalAvailableSlots > 0 ? `${data.currUtilization}%` : '—'}
                                sub={data.totalAvailableSlots > 0 ? `${fmt(data.totalAvailableSlots)} سلوت متاح` : 'لا توجد سلوتات في هذه الفترة'}
                                bg="bg-sky-50"
                                badge={(() => {
                                    if (!data.totalAvailableSlots || data.totalAvailableSlots === 0) return null;
                                    const curr = data.currUtilization ?? 0;
                                    const diff = data.utilizationDiff;
                                    // ① مفيش فترة سابقة — static badge بنسبة الإشغال الحالية
                                    if (diff == null) return curr > 0
                                        ? { text: `${curr}% إشغال`, cls: 'bg-sky-50 text-sky-600' }
                                        : null;
                                    // ② مقارنة عادية
                                    if (diff > 0) return { text: `▲ +${diff}% إشغال`,         cls: 'bg-green-50 text-green-600' };
                                    if (diff < 0) return { text: `▼ ${Math.abs(diff)}% هبوط`, cls: 'bg-red-50 text-red-600'     };
                                    return           { text: 'بدون تغيير',                     cls: 'bg-gray-50 text-gray-500'   };
                                })()}
                            />
                        </div>

                        {/* ── Row 2: Revenue Trend + Peak Hours ───────────────── */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <RevenueTrendChart data={data.revenueTrend} />
                            <PeakHoursChart   data={data.peakHoursData} />
                        </div>

                        {/* ── Row 3: Daily bar chart + Completion donut ────────── */}
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                            <div className="xl:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-sm font-black text-[#191c1c]">
                                            المرضى يوماً بيوم
                                        </h3>
                                        <p className="text-[11px] text-gray-400 mt-0.5">حجوزات الكشف + الزيارات</p>
                                    </div>
                                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                                        {periodLabel}
                                    </span>
                                </div>
                                {data.dailyData.every(d => d.bookings === 0) ? (
                                    <div className="flex flex-col items-center justify-center h-40 text-gray-300">
                                        <span className="material-symbols-outlined text-[40px] mb-2">bar_chart</span>
                                        <p className="text-sm font-medium">لا توجد بيانات للفترة المختارة</p>
                                    </div>
                                ) : (
                                    <DailyBarChart dailyData={data.dailyData} />
                                )}
                            </div>

                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <div className="mb-4">
                                    <h3 className="text-sm font-black text-[#191c1c]">نسبة الإتمام</h3>
                                    <p className="text-[11px] text-gray-400 mt-0.5">مكتملة مقابل ملغية</p>
                                </div>
                                {completedTotal === 0 && cancelledTotal === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-40 text-gray-300">
                                        <span className="material-symbols-outlined text-[40px] mb-2">pie_chart</span>
                                        <p className="text-sm font-medium">لا توجد بيانات</p>
                                    </div>
                                ) : (
                                    <DonutChart
                                        completed={completedTotal}
                                        cancelled={cancelledTotal}
                                        ops={data.opCount}
                                        prevMonthPct={data.prevMonthCompletionPct}
                                        prevLabel="عن الفترة السابقة"
                                    />
                                )}
                            </div>
                        </div>

                        {/* ── Row 4: Patient analysis ──────────────────────────── */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-lg">🧑‍⚕️</span>
                                <h3 className="text-sm font-black text-[#191c1c]">تحليل المرضى</h3>
                                {data.avgRating != null && (
                                    <div className="flex items-center gap-1.5 mr-auto">
                                        <StarRating value={data.avgRating} />
                                        <span className="text-xs font-bold text-amber-600">{data.avgRating}</span>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                <Chip
                                    emoji="✨"
                                    label="مرضى جدد"
                                    value={fmt(data.newPatients ?? 0)}
                                    cls="bg-rose-50 border-rose-100"
                                />
                                <Chip
                                    emoji="🔁"
                                    label="مرضى عائدون"
                                    value={fmt(data.returningPatients ?? 0)}
                                    cls="bg-sky-50 border-sky-100"
                                />
                                <Chip
                                    emoji="🏥"
                                    label="كشوفات"
                                    value={fmt(data.regularVisitCount ?? 0)}
                                    cls="bg-violet-50 border-violet-100"
                                />
                                <Chip
                                    emoji="🔄"
                                    label="إعادة كشف"
                                    value={fmt(data.followUpVisitCount ?? 0)}
                                    cls="bg-teal-50 border-teal-100"
                                />
                                <Chip
                                    emoji="📊"
                                    label="نسبة العودة"
                                    value={data.patientCount > 0
                                        ? `${Math.round(((data.returningPatients ?? 0) / data.patientCount) * 100)}%`
                                        : '—'}
                                    cls="bg-amber-50 border-amber-100"
                                />
                            </div>
                        </div>

                        {/* ── Row 5: Revenue breakdown ─────────────────────────── */}
                        {data.totalRevenue > 0 && (
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <h3 className="text-sm font-black text-[#191c1c] mb-4">تفاصيل الإيراد</h3>
                                <div className="space-y-3">
                                    {[
                                        { label: 'كشوفات مكتملة',    value: data.totalRevenue - data.walkInRevenue - data.opRevenue, icon: 'medical_services', color: 'text-emerald-600', bg: 'bg-emerald-50', barColor: 'bg-emerald-600' },
                                        { label: 'زيارات (Walk-in)',   value: data.walkInRevenue,  icon: 'directions_walk', color: 'text-orange-600',  bg: 'bg-orange-50',  barColor: 'bg-orange-500' },
                                        { label: 'عمليات',           value: data.opRevenue,      icon: 'content_cut',    color: 'text-purple-600',  bg: 'bg-purple-50',  barColor: 'bg-purple-600' },
                                    ].map(({ label, value, icon, color, bg, barColor }) => {
                                        const pct = data.totalRevenue > 0 ? (value / data.totalRevenue) * 100 : 0;
                                        return (
                                            <div key={label} className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                                                    <span className={`material-symbols-outlined text-[16px] ${color}`}>{icon}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs font-bold text-gray-600">{label}</span>
                                                        <span className="text-xs font-black text-[#134e3a]">{fmt(value)} جنيه</span>
                                                    </div>
                                                    <div className="h-1.5 rounded-full bg-gray-100">
                                                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%`, transition: 'width 0.6s ease' }} />
                                                    </div>
                                                </div>
                                                <span className="text-[10px] text-gray-400 shrink-0 w-8 text-left">{Math.round(pct)}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                                    <span className="text-sm font-bold text-gray-500">الإجمالي</span>
                                    <span className="text-lg font-black text-[#134e3a]">{fmt(data.totalRevenue)} جنيه</span>
                                </div>
                            </div>
                        )}

                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

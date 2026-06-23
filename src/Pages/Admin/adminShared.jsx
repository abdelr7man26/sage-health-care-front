/* eslint-disable react-refresh/only-export-components --
   Shared admin barrel: intentionally exports admin-only UI components alongside
   shared constants/styles in one module (per the project's structure decision).
   Fast-refresh degradation in dev is an acceptable trade-off here. */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SERVER_BASE = new URL(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').origin;

const roleLabel = { patient: 'مريض', doctor: 'طبيب', admin: 'مشرف', secretary: 'سكرتيرة' };

// ── Toast ─────────────────────────────────────────────────────────────────────
// State lives in the shared useToasts hook (src/hooks/useToasts.js); this is the renderer.

function ToastStack({ toasts, dismiss }) {
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-[100] pointer-events-none">
            <AnimatePresence>
                {toasts.map((t) => (
                    <motion.div key={t.id}
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl text-sm font-semibold text-white min-w-[260px] max-w-sm backdrop-blur-md border
                            ${t.type === 'error' ? 'bg-red-500/90 border-red-400/40' : t.type === 'warning' ? 'bg-amber-500/90 border-amber-400/40' : 'bg-emerald-600/90 border-emerald-400/40'}`}
                        dir="rtl"
                    >
                        <span className="material-symbols-outlined text-[18px]">
                            {t.type === 'error' ? 'error' : t.type === 'warning' ? 'warning' : 'check_circle'}
                        </span>
                        <span className="flex-1">{t.msg}</span>
                        <button onClick={() => dismiss(t.id)} className="opacity-70 hover:opacity-100">
                            <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

// ── Modals ────────────────────────────────────────────────────────────────────

function ConfirmModal({ open, icon, title, body, onConfirm, onCancel, loading, confirmLabel = 'تأكيد', danger = false }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && !loading && onCancel()}
        >
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl p-7 w-full max-w-sm" dir="rtl"
            >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${danger ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}>
                    <span className={`material-symbols-outlined text-[24px] ${danger ? 'text-red-400' : 'text-emerald-400'}`}>{icon}</span>
                </div>
                <h3 className="text-lg font-black text-slate-100 mb-1">{title}</h3>
                <p className="text-sm text-slate-400 mb-6 leading-relaxed">{body}</p>
                <div className="flex gap-3">
                    <button onClick={onConfirm} disabled={loading}
                        className={`flex-1 text-white font-bold py-3 rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2
                            ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                    >
                        {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        {confirmLabel}
                    </button>
                    <button onClick={onCancel} disabled={loading}
                        className="flex-1 border border-slate-600 text-slate-300 font-bold py-3 rounded-2xl hover:bg-slate-700 transition-colors disabled:opacity-40"
                    >رجوع</button>
                </div>
            </motion.div>
        </div>
    );
}

function ReasonModal({ open, title, onConfirm, onCancel, loading }) {
    const [reason, setReason] = useState('');
    if (!open) return null;
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && !loading && onCancel()}
        >
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl p-7 w-full max-w-sm" dir="rtl"
            >
                <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-[24px] text-amber-400">block</span>
                </div>
                <h3 className="text-lg font-black text-slate-100 mb-1">{title}</h3>
                <p className="text-sm text-slate-400 mb-4">سبب الإيقاف (اختياري)</p>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-2xl p-3 text-sm text-slate-200 resize-none focus:outline-none focus:border-amber-500 placeholder-slate-600"
                    rows={3} placeholder="اكتب سبب الإيقاف هنا..."
                />
                <div className="flex gap-3 mt-4">
                    <button onClick={() => { onConfirm(reason); setReason(''); }} disabled={loading}
                        className="flex-1 bg-amber-500 text-white font-bold py-3 rounded-2xl hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        تعليق الحساب
                    </button>
                    <button onClick={onCancel} disabled={loading}
                        className="flex-1 border border-slate-600 text-slate-300 font-bold py-3 rounded-2xl hover:bg-slate-700 transition-colors disabled:opacity-40"
                    >رجوع</button>
                </div>
            </motion.div>
        </div>
    );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRows({ cols = 5, rows = 5 }) {
    return Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-slate-800">
            {Array.from({ length: cols }).map((__, j) => (
                <td key={j} className="px-4 py-3.5">
                    <div className="h-4 bg-slate-800 rounded-full animate-pulse" style={{ width: `${60 + (j * 13) % 40}%` }} />
                </td>
            ))}
        </tr>
    ));
}

// ── Stat card ─────────────────────────────────────────────────────────────────

const CARD_COLORS = {
    emerald: { icon: 'bg-emerald-500/20 text-emerald-400', border: 'border-emerald-500/20', num: 'text-emerald-50' },
    blue:    { icon: 'bg-blue-500/20 text-blue-400',       border: 'border-blue-500/20',    num: 'text-blue-50' },
    amber:   { icon: 'bg-amber-500/20 text-amber-400',     border: 'border-amber-500/20',   num: 'text-amber-50' },
    red:     { icon: 'bg-red-500/20 text-red-400',         border: 'border-red-500/20',     num: 'text-red-50' },
    violet:  { icon: 'bg-violet-500/20 text-violet-400',   border: 'border-violet-500/20',  num: 'text-violet-50' },
    cyan:    { icon: 'bg-cyan-500/20 text-cyan-400',       border: 'border-cyan-500/20',    num: 'text-cyan-50' },
};

function StatCard({ icon, label, value, sub, color = 'emerald', loading, trend, onClick }) {
    const c = CARD_COLORS[color] || CARD_COLORS.emerald;
    return (
        <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.18 }}
            onClick={onClick}
            className={`bg-slate-900 rounded-2xl p-5 border ${c.border} hover:border-opacity-50 transition-all ${onClick ? 'cursor-pointer' : ''}`}
        >
            <div className="flex items-start justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.icon}`}>
                    <span className="material-symbols-outlined text-[22px]">{icon}</span>
                </div>
                {trend !== undefined && trend !== null && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${trend >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                        {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
                    </span>
                )}
            </div>
            {loading
                ? <div className="h-8 w-24 bg-slate-800 rounded-full animate-pulse mb-2" />
                : <p className={`text-3xl font-black ${c.num} leading-none`}>{value ?? '—'}</p>
            }
            <p className="text-sm text-slate-500 mt-2">{label}</p>
            {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
        </motion.div>
    );
}

// ── Nav item ──────────────────────────────────────────────────────────────────

function NavItem({ icon, label, active, onClick, badge }) {
    return (
        <button onClick={onClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                ${active
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-lg shadow-emerald-500/10'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'}`}
        >
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
            <span className="flex-1 text-right">{label}</span>
            {badge > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${active ? 'bg-emerald-400/20 text-emerald-300' : 'bg-amber-500/20 text-amber-400'}`}>
                    {badge}
                </span>
            )}
        </button>
    );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, pages, onPage }) {
    if (pages <= 1) return null;
    return (
        <div className="flex items-center justify-center gap-2 mt-4" dir="rtl">
            <button onClick={() => onPage(page - 1)} disabled={page <= 1}
                className="px-3 py-1.5 rounded-xl border border-slate-700 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30 transition-colors"
            >السابق</button>
            <span className="text-sm text-slate-500 font-semibold px-2">{page} / {pages}</span>
            <button onClick={() => onPage(page + 1)} disabled={page >= pages}
                className="px-3 py-1.5 rounded-xl border border-slate-700 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30 transition-colors"
            >التالي</button>
        </div>
    );
}

// ── Animated bar row ──────────────────────────────────────────────────────────

function BarRow({ label, count, max, color = 'emerald', rank }) {
    const rankStyle = ['text-amber-400', 'text-slate-400', 'text-orange-700'];
    return (
        <div className="flex items-center gap-3">
            <span className={`text-xs font-black w-4 text-center ${rankStyle[rank] || 'text-slate-700'}`}>{rank + 1}</span>
            <span className="text-xs text-slate-400 w-28 truncate text-right">{label}</span>
            <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / max) * 100}%` }}
                    transition={{ duration: 0.9, delay: rank * 0.08, ease: 'easeOut' }}
                    className={`h-2 rounded-full ${color === 'emerald'
                        ? 'bg-gradient-to-r from-emerald-700 to-emerald-400'
                        : 'bg-gradient-to-r from-blue-700 to-blue-400'}`}
                />
            </div>
            <span className="text-xs font-black text-slate-300 w-6 text-left">{count}</span>
        </div>
    );
}

// ── Section title ─────────────────────────────────────────────────────────────

function SectionTitle({ icon, title, subtitle }) {
    return (
        <div className="mb-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-emerald-400 text-[20px]">{icon}</span>
            </div>
            <div>
                <h2 className="text-xl font-black text-slate-100 leading-tight">{title}</h2>
                {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
        </div>
    );
}

// ── Dark table ────────────────────────────────────────────────────────────────

function DarkTable({ children, headers }) {
    return (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-800/60 border-b border-slate-700/50">
                            {headers.map((h) => (
                                <th key={h} className="px-4 py-3.5 text-right text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>{children}</tbody>
                </table>
            </div>
        </div>
    );
}

// ── Dark input / select ───────────────────────────────────────────────────────

const inputCls = "bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors";
const filterBtnCls = "px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors";

const ACTION_META = {
    user_suspended:     { label: 'تعليق مستخدم',      icon: 'block',        bg: 'bg-amber-500/20',   text: 'text-amber-400' },
    user_unsuspended:   { label: 'رفع إيقاف مستخدم',   icon: 'check_circle', bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    user_soft_deleted:  { label: 'حذف مستخدم',         icon: 'delete',       bg: 'bg-red-500/20',     text: 'text-red-400' },
    doctor_suspended:   { label: 'تعليق طبيب',         icon: 'block',        bg: 'bg-amber-500/20',   text: 'text-amber-400' },
    doctor_unsuspended: { label: 'رفع إيقاف طبيب',     icon: 'check_circle', bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    doctor_approved:    { label: 'قبول طبيب',           icon: 'verified',     bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    doctor_rejected:    { label: 'رفض طبيب',            icon: 'cancel',       bg: 'bg-red-500/20',     text: 'text-red-400' },
    review_deleted:     { label: 'حذف تقييم',           icon: 'star_off',     bg: 'bg-red-500/20',     text: 'text-red-400' },
};

function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 shadow-2xl" dir="rtl">
            <p className="text-[11px] text-slate-400 mb-2 font-bold">{label}</p>
            {payload.map((p, i) => (
                <p key={i} className="text-xs font-bold flex items-center gap-1.5" style={{ color: p.color }}>
                    <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: p.color }} />
                    {p.name}: {p.value?.toLocaleString('ar-EG')}
                </p>
            ))}
        </div>
    );
}


// ── Error state ───────────────────────────────────────────────────────────────

function ErrorState({ message = 'تعذّر تحميل البيانات', onRetry }) {
    return (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-10 flex flex-col items-center justify-center text-center gap-3" dir="rtl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-400 text-[26px]">cloud_off</span>
            </div>
            <p className="text-sm font-bold text-slate-300">{message}</p>
            {onRetry && (
                <button onClick={onRetry}
                    className="mt-1 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]">refresh</span>
                    إعادة المحاولة
                </button>
            )}
        </div>
    );
}

// ── Period options for analytics day-range filters (shared across tabs) ───────
const ECON_PERIODS = [
    { days: 30,  label: '30 يوم' },
    { days: 90,  label: '90 يوم' },
    { days: 365, label: 'سنة' },
];

export { SERVER_BASE, roleLabel, ToastStack, ConfirmModal, ReasonModal, SkeletonRows, StatCard, NavItem, Pagination, BarRow, SectionTitle, DarkTable, inputCls, filterBtnCls, ACTION_META, ChartTooltip, CARD_COLORS, ECON_PERIODS, ErrorState };

// Shared presentational UI atoms for the patient profile page. All pure/stateless
// and driven entirely by props, so they live outside the page component.

export function Spinner() {
    return <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>;
}

export function SectionCard({ title, icon, action, children }) {
    return (
        <div className="bg-white/[.06] rounded-2xl border border-white/[.1] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[.08]">
                <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-emerald-400 text-[20px]">{icon}</span>
                    <h3 className="font-bold text-white text-[15px]">{title}</h3>
                </div>
                {action && <div className="shrink-0">{action}</div>}
            </div>
            <div className="px-6 py-5">{children}</div>
        </div>
    );
}

export function InfoRow({ label, value }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{label}</span>
            <span className="text-sm font-medium text-white/80 leading-relaxed">{value || '—'}</span>
        </div>
    );
}

export function TagList({ items = [] }) {
    if (!items.length) return <span className="text-sm text-white/35">غير محدد</span>;
    return (
        <div className="flex flex-wrap gap-1.5">
            {items.map((item, i) => (
                <span key={i}
                    className="px-2.5 py-0.5 bg-emerald-900/40 text-emerald-300 border border-emerald-700/40 rounded-full text-xs font-semibold">
                    {item}
                </span>
            ))}
        </div>
    );
}

export function Field({ label, className = '', children }) {
    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            <label className="text-xs font-bold text-white/50">{label}</label>
            {children}
        </div>
    );
}

export function StepDot({ n, current }) {
    const done   = current > n;
    const active = current === n;
    return (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all shrink-0
            ${done   ? 'bg-emerald-500 border-emerald-500 text-white' :
              active ? 'bg-[#134e3a] border-emerald-500/60 text-white'    :
                       'bg-white/[.05] border-white/20 text-white/35'}`}>
            {done ? <span className="material-symbols-outlined text-[15px]">check</span> : n}
        </div>
    );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'تأكيد الحذف', onConfirm, onCancel }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
            {/* Card */}
            <div className="relative w-full max-w-sm bg-[#0f2d1e] border border-white/[.12] rounded-2xl shadow-2xl p-6 flex flex-col gap-5">
                {/* Icon */}
                <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto">
                    <span className="material-symbols-outlined text-red-400 text-[26px]">delete_forever</span>
                </div>
                {/* Text */}
                <div className="text-center space-y-1.5">
                    <p className="font-black text-white text-base">{title}</p>
                    <p className="text-sm text-white/50 leading-relaxed">{message}</p>
                </div>
                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 rounded-xl border border-white/[.15] text-white/60 text-sm font-bold hover:bg-white/[.07] transition-all">
                        إلغاء
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-all active:scale-95">
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

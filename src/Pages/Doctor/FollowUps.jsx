/**
 * FollowUps.jsx
 *
 * Sub-view mounted inside DoctorDashboard showing all patients the doctor
 * scheduled for a follow-up visit after a completed booking.
 *
 * Three filter tabs:
 *   الكل     — all follow-up records (sorted soonest first)
 *   قادمة    — scheduledFor >= today
 *   متأخرة   — scheduledFor < today (patient hasn't re-booked yet)
 *
 * Each card shows the patient's name, avatar, original visit date, the
 * scheduled follow-up date, and the closing note the doctor wrote at
 * the end of that visit.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosInstance from '../../api/axiosInstance';

const SERVER_BASE = new URL(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').origin;

const FILTERS = [
    { key: 'all',      label: 'الكل' },
    { key: 'upcoming', label: 'قادمة' },
    { key: 'overdue',  label: 'متأخرة' },
];

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

const daysDiff = (date) => {
    const target = new Date(date); target.setHours(0, 0, 0, 0);
    const today  = new Date();     today.setHours(0, 0, 0, 0);
    return Math.round((target - today) / (1000 * 60 * 60 * 24));
};

/** Single follow-up patient card — handles both booking and walk-in records. */
function FollowUpCard({ record, onOpenDrawer }) {
    const isWalkIn = record._type === 'walkin';
    const [reminding, setReminding] = useState(false);
    const [reminded,  setReminded]  = useState(false);

    // Walk-ins store the name directly; bookings reference a patient document.
    const patient   = record.patient;
    const name      = patient?.name ?? record.patientName ?? 'مريض غير معروف';
    const phone     = patient?.phone ?? record.phone ?? null;
    const avatar    = patient?.profilePicture ? `${SERVER_BASE}${patient.profilePicture}` : null;

    // Original visit date differs by type.
    const visitDate     = fmtDate(isWalkIn ? record.date : record.slotDetails?.date);
    const scheduledDate = record.followUp?.scheduledFor;
    const diff          = scheduledDate ? daysDiff(scheduledDate) : null;
    const isOverdue     = diff !== null && diff < 0;
    const hasBooked     = record.hasBooked;

    const handleRemind = async () => {
        if (reminding || reminded) return;
        setReminding(true);
        try {
            await axiosInstance.post(
                `/doctors/follow-ups/${record._id}/remind?type=${isWalkIn ? 'walkin' : 'booking'}`
            );
            setReminded(true);
            setTimeout(() => setReminded(false), 5_000);
        } catch { /* swallow */ }
        finally { setReminding(false); }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`bg-white rounded-2xl border shadow-sm p-5 flex gap-4 ${isOverdue ? 'border-red-100' : 'border-gray-100'}`}
        >
            {avatar ? (
                <img src={avatar} alt={name} className="w-12 h-12 rounded-2xl object-cover shrink-0 shadow-sm" />
            ) : (
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 ${isWalkIn ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {name.charAt(0)}
                </div>
            )}

            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-[#191c1c] text-sm">{name}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${isWalkIn ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                            {isWalkIn ? '🚶 زيارة' : '📅 حجز أونلاين'}
                        </span>
                        {hasBooked ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-emerald-50 text-emerald-700 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[11px]">check_circle</span>
                                حجز إعادة الكشف
                            </span>
                        ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-orange-50 text-orange-600">
                                لم يحجز بعد
                            </span>
                        )}
                    </div>
                    {scheduledDate && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                            isOverdue          ? 'bg-red-50 text-red-500'
                            : diff === 0       ? 'bg-amber-50 text-amber-600'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                            {isOverdue ? `متأخر ${Math.abs(diff)} يوم`
                                : diff === 0 ? 'اليوم'
                                : diff === 1 ? 'غداً'
                                : `بعد ${diff} يوم`}
                        </span>
                    )}
                </div>

                {phone && (
                    <p className="text-[11px] text-gray-400 mb-1.5 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">call</span>
                        {phone}
                    </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-2">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span className="material-symbols-outlined text-[14px] text-gray-400">event</span>
                        <span>الزيارة: {visitDate}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span className={`material-symbols-outlined text-[14px] ${isOverdue ? 'text-red-400' : 'text-emerald-500'}`}>autorenew</span>
                        <span>المتابعة: {fmtDate(scheduledDate)}</span>
                    </div>
                </div>

                {(record.closingNote || record.notes) && (
                    <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed line-clamp-2 mb-2">
                        {record.closingNote || record.notes}
                    </p>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                    {patient?._id && onOpenDrawer && (
                        <button
                            onClick={() => onOpenDrawer(patient._id)}
                            className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition"
                        >
                            <span className="material-symbols-outlined text-[14px]">person</span>
                            عرض الملف الطبي الكامل
                        </button>
                    )}
                    {!hasBooked && (
                        <button
                            onClick={handleRemind}
                            disabled={reminding || reminded}
                            className={`text-[11px] font-bold flex items-center gap-1 transition disabled:opacity-50 ${
                                reminded
                                    ? 'text-emerald-600'
                                    : 'text-sky-600 hover:text-sky-700'
                            }`}
                            title="إرسال تذكير بالحجز للمريض"
                        >
                            {reminding ? (
                                <span className="w-3 h-3 border-2 border-sky-300 border-t-sky-500 rounded-full animate-spin" />
                            ) : (
                                <span className="material-symbols-outlined text-[14px]">
                                    {reminded ? 'check_circle' : 'notifications'}
                                </span>
                            )}
                            {reminded ? 'تم الإرسال' : 'إرسال تذكير'}
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

/** Skeleton loader shown while the first page is fetching. */
function SkeletonCard() {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex gap-4 animate-pulse">
            <div className="w-12 h-12 rounded-2xl bg-gray-200 shrink-0" />
            <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
            </div>
        </div>
    );
}

export default function FollowUps({ onOpenDrawer }) {
    const [filter,  setFilter]  = useState('all');
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page,    setPage]    = useState(1);
    const [pages,   setPages]   = useState(1);
    const [total,   setTotal]   = useState(0);

    const load = useCallback(async (f, p) => {
        setLoading(true);
        try {
            const { data } = await axiosInstance.get(
                `/doctors/follow-ups?filter=${f}&page=${p}&limit=10`
            );
            setRecords(data.data ?? []);
            setPages(data.pagination?.pages ?? 1);
            setTotal(data.pagination?.total ?? 0);
        } catch {
            setRecords([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        setPage(1);
        load(filter, 1);
    }, [filter, load]);

    const handlePageChange = (p) => {
        setPage(p);
        load(filter, p);
    };

    return (
        <div dir="rtl">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-black text-[#191c1c]">قائمة المتابعات</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                        المرضى الذين حددت لهم موعد متابعة بعد الكشف
                    </p>
                </div>
                {total > 0 && (
                    <span className="text-sm font-bold text-[#134e3a] bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100">
                        {total} مريض
                    </span>
                )}
            </div>

            <div className="flex gap-2 mb-6">
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`px-4 py-2 rounded-2xl text-sm font-bold transition-all ${
                            filter === f.key
                                ? 'bg-[#134e3a] text-white shadow-sm'
                                : 'bg-white text-gray-500 border border-gray-100 hover:border-emerald-200'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
                </div>
            ) : records.length === 0 ? (
                <div className="bg-white rounded-2xl p-16 text-center shadow-sm border border-gray-100">
                    <span className="material-symbols-outlined text-[48px] text-gray-200 mb-3 block">
                        autorenew
                    </span>
                    <p className="text-gray-400 font-semibold">لا توجد متابعات</p>
                    <p className="text-xs text-gray-300 mt-1">
                        {filter === 'overdue' ? 'لا توجد متابعات متأخرة' :
                         filter === 'upcoming' ? 'لا توجد متابعات قادمة' :
                         'لم تقم بتحديد متابعة لأي مريض بعد'}
                    </p>
                </div>
            ) : (
                <>
                    <AnimatePresence mode="popLayout">
                        <div className="space-y-3">
                            {records.map((r) => (
                                <FollowUpCard key={r._id} record={r} onOpenDrawer={onOpenDrawer} />
                            ))}
                        </div>
                    </AnimatePresence>

                    {pages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-6">
                            <button
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page === 1}
                                className="w-9 h-9 rounded-xl border border-gray-100 bg-white text-gray-500 flex items-center justify-center hover:border-emerald-300 disabled:opacity-40 transition"
                            >
                                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                            </button>
                            <span className="text-sm text-gray-500 font-semibold">{page} / {pages}</span>
                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page === pages}
                                className="w-9 h-9 rounded-xl border border-gray-100 bg-white text-gray-500 flex items-center justify-center hover:border-emerald-300 disabled:opacity-40 transition"
                            >
                                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

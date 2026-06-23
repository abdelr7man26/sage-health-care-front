import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axiosInstance from '../../api/axiosInstance';
import { fmtTime } from '../../utils/timeFormat';
import Footer from '../../components/Footer';
import { useDoctor } from '../../hooks/usePatientData';

const ClinicMapPicker = lazy(() => import('../../components/ClinicMapPicker'));

const SERVER_BASE = new URL(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').origin;

function StarDisplay({ rating = 0, size = 'sm' }) {
    const sz = size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5';
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
                <svg key={i} className={`${sz} ${i <= Math.round(rating) ? 'text-amber-400' : 'text-white/20'}`}
                    fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
            ))}
        </div>
    );
}

function ReviewCard({ r }) {
    return (
        <div className="bg-white/[.05] rounded-xl p-4 border border-white/[.08] hover:bg-white/[.08] transition-colors">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                    {r.patient?.profilePicture ? (
                        <img src={`${SERVER_BASE}${r.patient.profilePicture}`} alt={r.patient.name}
                            className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-white/20"/>
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-white text-xs font-black shrink-0">
                            {r.patient?.name?.charAt(0) ?? '?'}
                        </div>
                    )}
                    <p className="text-sm font-bold text-white/80">{r.patient?.name ?? 'مريض'}</p>
                </div>
                <div className="flex items-center gap-1.5">
                    <StarDisplay rating={r.rating} />
                    <span className="text-[11px] text-white/35">
                        {new Date(r.createdAt).toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' })}
                    </span>
                </div>
            </div>
            {r.comment && (
                <p className="text-sm text-white/55 pr-10 leading-relaxed">{r.comment}</p>
            )}
        </div>
    );
}

function DoctorReviews({ doctorId }) {
    const [preview,    setPreview]    = useState(null);
    const [reviews,    setReviews]    = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [expanded,   setExpanded]   = useState(false);
    const [loadingAll, setLoadingAll] = useState(false);
    const [page,       setPage]       = useState(1);
    const [pages,      setPages]      = useState(1);
    const [total,      setTotal]      = useState(0);

    useEffect(() => {
        axiosInstance.get(`/reviews/doctor/${doctorId}?page=1&limit=1`)
            .then(({ data }) => {
                setPreview((data.data || [])[0] ?? null);
                setTotal(data.pagination?.total || 0);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [doctorId]);

    const loadPage = useCallback(async (p = 1) => {
        setLoadingAll(true);
        try {
            const { data } = await axiosInstance.get(`/reviews/doctor/${doctorId}?page=${p}&limit=6`);
            setReviews(data.data || []);
            setPage(data.pagination?.page || 1);
            setPages(data.pagination?.pages || 1);
        } catch { setReviews([]); }
        finally { setLoadingAll(false); }
    }, [doctorId]);

    const handleExpand = async () => {
        if (!expanded) await loadPage(1);
        setExpanded((o) => !o);
    };

    if (!loading && total === 0) return null;

    return (
        <div className="bg-white/[.07] rounded-2xl border border-white/[.1] overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[.08]">
                <span className="material-symbols-outlined text-amber-400 text-[18px]">star</span>
                <h2 className="font-black text-white text-sm">آراء المرضى</h2>
                {!loading && (
                    <span className="text-[11px] font-bold text-white/40 bg-white/10 px-2 py-0.5 rounded-full mr-auto">
                        {total} تقييم
                    </span>
                )}
            </div>

            <div className="p-5 space-y-3">
                {/* Loading skeleton */}
                {loading ? (
                    <div className="animate-pulse bg-white/[.05] rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-white/15 shrink-0"/>
                            <div className="h-3 bg-white/10 rounded w-1/4"/>
                        </div>
                        <div className="h-3 bg-white/[.07] rounded w-3/4 mt-1"/>
                    </div>
                ) : preview ? (
                    <>
                        {/* Latest review preview */}
                        <div className="relative">
                            <div className="absolute -top-1 -right-1 text-[9px] font-black text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                أحدث تقييم
                            </div>
                            <ReviewCard r={preview} />
                        </div>

                        {/* Expand / collapse toggle */}
                        {total > 1 && (
                            <button
                                onClick={handleExpand}
                                disabled={loadingAll}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[.1] bg-white/[.04] hover:bg-white/[.09] hover:border-white/[.18] transition-all text-xs font-bold text-white/55 hover:text-white group"
                            >
                                {loadingAll ? (
                                    <span className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin"/>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[16px] transition-transform duration-300 group-hover:text-emerald-400" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                            expand_more
                                        </span>
                                        {expanded ? 'إخفاء التقييمات' : `عرض كل التقييمات (${total - 1}+)`}
                                    </>
                                )}
                            </button>
                        )}

                        {/* Expanded reviews */}
                        {expanded && !loadingAll && (
                            <div className="space-y-3 pt-1">
                                {reviews.map((r) => (
                                    <ReviewCard key={r._id} r={r} />
                                ))}

                                {pages > 1 && (
                                    <div className="flex items-center justify-center gap-2 pt-3 border-t border-white/[.08]">
                                        <button onClick={() => loadPage(page - 1)} disabled={page === 1}
                                            className="w-8 h-8 rounded-lg bg-white/[.07] border border-white/[.1] text-white/50 flex items-center justify-center hover:bg-white/[.12] disabled:opacity-30 transition">
                                            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                                        </button>
                                        <span className="text-xs text-white/50 font-semibold px-2">{page} / {pages}</span>
                                        <button onClick={() => loadPage(page + 1)} disabled={page === pages}
                                            className="w-8 h-8 rounded-lg bg-white/[.07] border border-white/[.1] text-white/50 flex items-center justify-center hover:bg-white/[.12] disabled:opacity-30 transition">
                                            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : null}
            </div>
        </div>
    );
}

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const DAYS_AR   = ['أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];

const toDateKey = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

function DatePicker({ selected, onSelect, minDateKey = null }) {
    const today = new Date();
    const [year,  setYear]  = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1);

    const firstDay    = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const todayKey    = toDateKey(today);
    const effectiveMin = minDateKey && minDateKey > todayKey ? minDateKey : todayKey;

    const prevMonth = () => {
        if (month === 1) { setMonth(12); setYear((y) => y - 1); }
        else setMonth((m) => m - 1);
    };
    const nextMonth = () => {
        if (month === 12) { setMonth(1); setYear((y) => y + 1); }
        else setMonth((m) => m + 1);
    };

    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
        <div className="bg-white/[.07] rounded-2xl border border-white/[.1]">
            {minDateKey && minDateKey > todayKey && (
                <div className="flex items-center gap-2 text-xs text-sky-300 bg-sky-500/10 border-b border-sky-500/20 px-5 py-3 rounded-t-2xl">
                    <span className="material-symbols-outlined text-[15px]">info</span>
                    إعادة الكشف متاحة من {new Date(minDateKey).toLocaleDateString('ar-EG', { month: 'long', day: 'numeric' })} فأكثر
                </div>
            )}

            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[.08]">
                <button onClick={prevMonth}
                    className="w-8 h-8 rounded-xl hover:bg-white/[.1] flex items-center justify-center transition-colors text-white/50 hover:text-white">
                    <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
                <p className="font-black text-emerald-300 text-sm tracking-wide">{MONTHS_AR[month-1]} {year}</p>
                <button onClick={nextMonth}
                    className="w-8 h-8 rounded-xl hover:bg-white/[.1] flex items-center justify-center transition-colors text-white/50 hover:text-white">
                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
            </div>

            <div className="px-4 pt-4 pb-5">
                <div className="grid grid-cols-7 mb-3">
                    {DAYS_AR.map((d) => (
                        <div key={d} className="text-center text-[10px] font-bold text-white/30">{d}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-y-1.5">
                    {cells.map((day, i) => {
                        if (!day) return <div key={`e${i}`} />;
                        const key     = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                        const isPast  = key < effectiveMin;
                        const isSelected = selected === key;
                        const isToday    = key === todayKey;

                        return (
                            <button
                                key={key}
                                disabled={isPast}
                                onClick={() => onSelect(key)}
                                className={`h-9 w-full rounded-xl text-sm font-bold transition-all
                                    ${isPast
                                        ? 'text-white/15 cursor-not-allowed'
                                        : isSelected
                                            ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/50'
                                            : isToday
                                                ? 'ring-2 ring-emerald-400/60 text-emerald-300'
                                                : 'text-white/70 hover:bg-white/[.1] hover:text-white'
                                    }`}
                            >
                                {day}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

const isSlotPast = (slot, selectedDate) => {
    const todayKey = toDateKey(new Date());
    if (selectedDate !== todayKey) return false;
    const [h, m] = slot.startTime.split(':').map(Number);
    const slotMin = h * 60 + m;
    const now = new Date();
    return slotMin < now.getHours() * 60 + now.getMinutes();
};

function SlotChip({ slot, selected, onSelect, selectedDate }) {
    const past = isSlotPast(slot, selectedDate);
    const isSelected = selected?._id === slot._id;

    return (
        <button
            onClick={() => !past && onSelect(slot)}
            disabled={past}
            className={`py-3 px-3 rounded-xl border font-bold text-sm transition-all text-center
                ${past
                    ? 'border-white/[.05] bg-white/[.03] text-white/20 cursor-not-allowed'
                    : isSelected
                        ? 'border-emerald-400/60 bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-900/60 scale-[1.04]'
                        : 'border-white/[.1] bg-white/[.06] text-white/75 hover:bg-white/[.12] hover:border-emerald-400/40 hover:text-white'
                }`}
        >
            <span className="block text-sm font-black">{fmtTime(slot.startTime)}</span>
            <span className={`text-[10px] block font-medium mt-0.5 ${isSelected ? 'text-white/60' : 'text-white/35'}`}>
                حتى {fmtTime(slot.endTime)}
            </span>
        </button>
    );
}

function ConfirmModal({ doctor, slot, selectedDate, onConfirm, onClose, loading, isFollowUp, effectiveFee }) {
    const dateLabel = selectedDate
        ? new Date(selectedDate).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : '';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0,  opacity: 1 }}
                exit={{ y: 60,   opacity: 0 }}
                className="bg-[#0e3626] border border-white/[.12] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
                dir="rtl"
            >
                {/* Doctor header */}
                <div className="relative bg-gradient-to-br from-[#1a6b4e] to-[#134e3a] px-6 py-5 border-b border-white/[.1]">
                    <div className="flex items-center gap-3">
                        {doctor?.user?.profilePicture ? (
                            <img src={`${SERVER_BASE}${doctor.user.profilePicture}`}
                                alt={doctor.user.name}
                                className="w-14 h-14 rounded-2xl object-cover shrink-0 ring-2 ring-white/20 shadow-lg"/>
                        ) : (
                            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center font-black text-white text-xl">
                                {doctor?.user?.name?.charAt(0) ?? 'د'}
                            </div>
                        )}
                        <div className="flex-1">
                            <p className="font-black text-white">د. {doctor?.user?.name}</p>
                            <p className="text-sm text-white/55">{doctor?.specialization}</p>
                        </div>
                        <div className="text-left">
                            <p className="text-3xl font-black text-emerald-300">{effectiveFee}</p>
                            <p className="text-xs text-white/40 text-left">جنيه</p>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <div className="space-y-3 mb-6">
                        <ModalInfoRow icon="calendar_month" label="التاريخ"  value={dateLabel} />
                        <ModalInfoRow icon="schedule"       label="الوقت"    value={`${fmtTime(slot?.startTime)} — ${fmtTime(slot?.endTime)}`} />
                        <ModalInfoRow icon="stethoscope"    label="نوع الزيارة" value={isFollowUp ? 'إعادة كشف' : 'كشف جديد'} />
                    </div>

                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="w-full bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black py-4 rounded-2xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 mb-3 shadow-lg shadow-emerald-900/50"
                    >
                        {loading
                            ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>جاري تأكيد الحجز...</>
                            : <><span className="material-symbols-outlined text-[20px]">check_circle</span>تأكيد الحجز</>}
                    </button>
                    <button onClick={onClose} className="w-full text-white/35 text-sm font-bold py-2 hover:text-white/60 transition-colors">
                        إلغاء
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

function ModalInfoRow({ icon, label, value }) {
    return (
        <div className="flex items-center gap-3 bg-white/[.06] rounded-xl px-4 py-3">
            <span className="material-symbols-outlined text-[16px] text-emerald-400 shrink-0">{icon}</span>
            <span className="text-white/45 text-xs w-20 shrink-0">{label}</span>
            <span className="font-bold text-white/85 text-sm">{value}</span>
        </div>
    );
}

export default function BookDoctor() {
    const { doctorId } = useParams();
    const navigate     = useNavigate();

    // Doctor detail via TanStack Query — cached for 2 min so re-opening the same
    // doctor's booking page (e.g. back/forward navigation) is instant.
    const { data: doctor = null, isLoading: loadingDoc, isError: doctorError } = useDoctor(doctorId);

    const [selectedDate,   setSelectedDate]   = useState(null);
    const [slots,          setSlots]          = useState([]);
    const [loadingSlots,   setLoadingSlots]   = useState(false);
    const [selectedSlot,   setSelectedSlot]   = useState(null);
    const [confirming,     setConfirming]     = useState(false);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [success,        setSuccess]        = useState(false);
    const [error,          setError]          = useState(null);
    const [followUpInfo,   setFollowUpInfo]   = useState(null);

    // If the doctor can't be loaded (not found / not approved), bounce home —
    // mirrors the previous Promise.all .catch(() => navigate('/dashboard')).
    useEffect(() => {
        if (doctorError) navigate('/dashboard');
    }, [doctorError, navigate]);

    // Follow-up eligibility is a separate, non-cacheable check (depends on the
    // patient's recent visit history), so it stays a plain request.
    useEffect(() => {
        axiosInstance.get(`/bookings/patient/follow-up-check/${doctorId}`)
            .then((fuRes) => { if (fuRes?.data) setFollowUpInfo(fuRes.data); })
            .catch(() => { /* no follow-up — ignore */ });
    }, [doctorId]);

    useEffect(() => {
        if (!selectedDate || !doctor) return;
        setLoadingSlots(true);
        setSlots([]);
        setSelectedSlot(null);
        axiosInstance.get(`/bookings/doctor/${doctorId}/slots?date=${selectedDate}`)
            .then(({ data }) => setSlots(data.data ?? []))
            .catch(() => setSlots([]))
            .finally(() => setLoadingSlots(false));
    }, [selectedDate, doctorId, doctor]);

    const hasPendingFollowUp = followUpInfo?.hasFollowUp ?? false;
    const [bookingType, setBookingType] = useState('new');
    const resolvedType = hasPendingFollowUp ? bookingType : 'new';
    const isFollowUp   = resolvedType === 'followup';
    const effectiveFee = isFollowUp && followUpInfo?.followUpFee != null
        ? followUpInfo.followUpFee
        : (doctor?.consultationFee ?? 0);

    const handleBook = async () => {
        if (!selectedSlot) return;
        setBookingLoading(true);
        setError(null);
        try {
            await axiosInstance.post('/bookings', {
                doctorId,
                slotId:     selectedSlot._id,
                isFollowUp,
            });
            setConfirming(false);
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.message || 'حدث خطأ أثناء الحجز');
            setConfirming(false);
        } finally {
            setBookingLoading(false);
        }
    };

    // ── Success screen ──────────────────────────────────────────────────────────
    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#0b2d20] via-[#103d2a] to-[#1a4d35] flex items-center justify-center p-6 font-['Cairo']" dir="rtl">
                <motion.div
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-full max-w-sm"
                >
                    {/* Success icon */}
                    <div className="text-center mb-6">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-900/60 mb-4">
                            <span className="material-symbols-outlined text-[56px] text-white">check_circle</span>
                        </div>
                        <h1 className="text-2xl font-black text-white mb-1">تم الحجز بنجاح!</h1>
                        <p className="text-white/50 text-sm">مع د. {doctor?.user?.name}</p>
                    </div>

                    {/* Details card */}
                    <div className="bg-white/[.07] border border-white/[.12] rounded-2xl p-5 mb-5 space-y-3">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-emerald-400 text-[18px]">calendar_month</span>
                            <span className="text-white/45 text-xs w-16">التاريخ</span>
                            <span className="font-bold text-white/85 text-sm">
                                {new Date(selectedDate).toLocaleDateString('ar-EG', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-emerald-400 text-[18px]">schedule</span>
                            <span className="text-white/45 text-xs w-16">الوقت</span>
                            <span className="font-bold text-white/85">{fmtTime(selectedSlot?.startTime)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-emerald-400 text-[18px]">payments</span>
                            <span className="text-white/45 text-xs w-16">السعر</span>
                            <span className="font-black text-emerald-300">{effectiveFee} جنيه</span>
                        </div>
                    </div>

                    <button
                        onClick={() => navigate('/dashboard')}
                        className="w-full bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-emerald-900/50"
                    >
                        العودة للرئيسية
                    </button>
                </motion.div>
            </div>
        );
    }

    // ── Loading screen ──────────────────────────────────────────────────────────
    if (loadingDoc) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#0b2d20] via-[#103d2a] to-[#1a4d35] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-emerald-700 border-t-emerald-400 rounded-full animate-spin" />
            </div>
        );
    }

    const dateLabel = selectedDate
        ? new Date(selectedDate).toLocaleDateString('ar-EG', { weekday: 'long', month: 'long', day: 'numeric' })
        : null;

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0b2d20] via-[#103d2a] to-[#1a4d35] font-['Cairo']" dir="rtl">

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <header className="bg-[#1a6b4e] border-b border-[#155d44] shadow-md sticky top-0 z-30">
                <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-10 py-3.5 flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    >
                        <span className="material-symbols-outlined text-white text-[20px]">arrow_forward</span>
                    </button>
                    <div className="flex-1 min-w-0">
                        <p className="font-black text-white leading-tight">حجز موعد</p>
                        <p className="text-xs text-white/55 truncate">د. {doctor?.user?.name} — {doctor?.specialization}</p>
                    </div>
                    {/* Fee badge */}
                    <div className="flex items-center gap-1.5 bg-emerald-900/60 border border-emerald-500/30 rounded-xl px-3 py-1.5 shrink-0">
                        <span className="material-symbols-outlined text-emerald-400 text-[14px]">payments</span>
                        <span className="text-emerald-300 font-black text-sm">{effectiveFee} جنيه</span>
                    </div>
                </div>
            </header>

            {/* ── Doctor hero banner ─────────────────────────────────────────── */}
            <div className="relative bg-[#0b2d20] border-b border-white/[.06]">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div style={{
                        position:'absolute', top:'-30%', right:'-5%',
                        width:'50%', height:'160%',
                        background:'radial-gradient(ellipse, rgba(26,107,78,.45) 0%, transparent 70%)',
                    }}/>
                </div>
                <div className="relative z-10 max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-10 py-6">
                    <div className="flex items-center gap-5">
                        {/* Avatar */}
                        {doctor?.user?.profilePicture ? (
                            <img
                                src={`${SERVER_BASE}${doctor.user.profilePicture}`}
                                alt={doctor.user.name}
                                className="w-20 h-20 rounded-2xl object-cover shrink-0 shadow-xl ring-2 ring-white/15"
                            />
                        ) : (
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#134e3a] to-[#2d6a4f] flex items-center justify-center text-white font-black text-3xl shrink-0 shadow-xl">
                                {doctor?.user?.name?.charAt(0) ?? 'د'}
                            </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <h1 className="font-black text-white text-lg leading-tight">د. {doctor?.user?.name}</h1>
                            <p className="text-white/60 text-sm mt-0.5">{doctor?.specialization}{doctor?.degree ? ` — ${doctor.degree}` : ''}</p>

                            {/* Rating */}
                            {doctor?.numReviews > 0 && (
                                <div className="flex items-center gap-1.5 mt-2">
                                    <StarDisplay rating={doctor.rating} />
                                    <span className="text-amber-400 text-xs font-black">{Number(doctor.rating).toFixed(1)}</span>
                                    <span className="text-white/35 text-xs">({doctor.numReviews})</span>
                                </div>
                            )}

                            {/* Tags row */}
                            <div className="flex flex-wrap gap-2 mt-2">
                                {doctor?.address?.city && (
                                    <span className="flex items-center gap-1 text-[11px] text-white/45 bg-white/[.07] px-2.5 py-1 rounded-lg">
                                        <span className="material-symbols-outlined text-[12px]">location_on</span>
                                        {doctor.address.city}{doctor.address.area ? `، ${doctor.address.area}` : ''}
                                    </span>
                                )}
                                {doctor?.address?.clinicPhone && (
                                    <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-900/40 px-2.5 py-1 rounded-lg font-semibold">
                                        <span className="material-symbols-outlined text-[12px]">call</span>
                                        {doctor.address.clinicPhone}
                                    </span>
                                )}
                                {isFollowUp && (
                                    <span className="flex items-center gap-1 text-[11px] text-sky-300 bg-sky-900/40 px-2.5 py-1 rounded-lg font-bold">
                                        <span className="material-symbols-outlined text-[12px]">autorenew</span>
                                        إعادة كشف
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Stats column */}
                        <div className="hidden sm:flex flex-col gap-2 shrink-0">
                            {doctor?.numReviews > 0 && (
                                <div className="flex items-center gap-2 bg-white/[.06] border border-white/[.08] rounded-xl px-3 py-2">
                                    <span className="material-symbols-outlined text-amber-400 text-[16px]">star</span>
                                    <div>
                                        <p className="text-xs font-black text-white/80">{Number(doctor.rating).toFixed(1)}</p>
                                        <p className="text-[10px] text-white/35">{doctor.numReviews} تقييم</p>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-2 bg-white/[.06] border border-white/[.08] rounded-xl px-3 py-2">
                                <span className="material-symbols-outlined text-emerald-400 text-[16px]">verified</span>
                                <div>
                                    <p className="text-xs font-black text-white/80">موثّق</p>
                                    <p className="text-[10px] text-white/35">طبيب معتمد</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-emerald-900/40 border border-emerald-500/20 rounded-xl px-3 py-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"/>
                                <p className="text-[11px] font-bold text-emerald-300">متاح للحجز</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Main content ───────────────────────────────────────────────── */}
            <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-10 py-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px] gap-6 lg:gap-8">

                {/* Left column */}
                <div className="flex flex-col gap-5">

                    {/* Reviews — shown first, right under doctor info */}
                    <DoctorReviews doctorId={doctorId} />

                    {/* Clinic map */}
                    {doctor?.clinicLocation?.lat != null && (
                        <div className="bg-white/[.07] rounded-2xl border border-white/[.1] overflow-hidden">
                            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-white/[.08]">
                                <span className="material-symbols-outlined text-emerald-400 text-[17px]">location_on</span>
                                <p className="font-bold text-white/80 text-sm">موقع العيادة</p>
                                {doctor.address?.fullAddress && (
                                    <p className="text-xs text-white/35 mr-auto truncate max-w-xs">{doctor.address.fullAddress}</p>
                                )}
                            </div>
                            <div className="relative z-0">
                                <Suspense fallback={<div className="h-[200px] bg-white/[.04] animate-pulse" />}>
                                    <ClinicMapPicker
                                        position={{ lat: doctor.clinicLocation.lat, lon: doctor.clinicLocation.lon }}
                                        flyTarget={null}
                                        onPick={() => {}}
                                        interactive={false}
                                        height={200}
                                    />
                                </Suspense>
                            </div>
                        </div>
                    )}

                    {/* Visit type */}
                    {hasPendingFollowUp && (
                        <div>
                            <StepLabel num="1" label="نوع الزيارة" />
                            <div className="grid grid-cols-2 gap-3 mt-3">
                                <VisitTypeBtn
                                    active={bookingType === 'new'}
                                    icon="stethoscope"
                                    title="كشف جديد"
                                    price={`${doctor?.consultationFee} جنيه`}
                                    colorActive="emerald"
                                    onClick={() => { setBookingType('new'); setSelectedDate(null); setSelectedSlot(null); }}
                                />
                                <VisitTypeBtn
                                    active={bookingType === 'followup'}
                                    icon="autorenew"
                                    title="إعادة كشف"
                                    price={followUpInfo?.followUpFee != null ? `${followUpInfo.followUpFee} جنيه` : `${doctor?.consultationFee} جنيه`}
                                    subtitle={followUpInfo?.followUpDate
                                        ? `موعد المتابعة: ${new Date(followUpInfo.followUpDate).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}`
                                        : null}
                                    colorActive="sky"
                                    onClick={() => { setBookingType('followup'); setSelectedDate(null); setSelectedSlot(null); }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Date picker */}
                    <div>
                        <StepLabel num={hasPendingFollowUp ? '2' : '1'} label="اختر التاريخ" />
                        <div className="mt-3">
                            <DatePicker
                                selected={selectedDate}
                                onSelect={(key) => { setSelectedDate(key); setSelectedSlot(null); }}
                                minDateKey={isFollowUp && followUpInfo?.followUpDate
                                    ? toDateKey(new Date(followUpInfo.followUpDate))
                                    : null}
                            />
                        </div>
                    </div>

                    {/* Time slots */}
                    <AnimatePresence mode="wait">
                        {selectedDate && (
                            <motion.div
                                key={selectedDate}
                                initial={{ opacity: 0, y: 14 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                            >
                                <StepLabel
                                    num={hasPendingFollowUp ? '3' : '2'}
                                    label={`اختر الميعاد — ${dateLabel}`}
                                />
                                <div className="mt-3">
                                    {loadingSlots ? (
                                        <div className="bg-white/[.07] rounded-2xl border border-white/[.1] p-10 flex justify-center">
                                            <div className="w-8 h-8 border-4 border-emerald-700 border-t-emerald-400 rounded-full animate-spin" />
                                        </div>
                                    ) : slots.length === 0 ? (
                                        <div className="bg-white/[.07] rounded-2xl border border-white/[.1] p-10 text-center">
                                            <div className="w-14 h-14 rounded-2xl bg-white/[.06] flex items-center justify-center mx-auto mb-3">
                                                <span className="material-symbols-outlined text-[30px] text-white/25">event_busy</span>
                                            </div>
                                            <p className="text-sm font-bold text-white/50">لا توجد مواعيد متاحة في هذا اليوم</p>
                                            <p className="text-xs text-white/25 mt-1">جرّب يوماً آخر</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                                            {slots.map((slot) => (
                                                <SlotChip
                                                    key={slot._id}
                                                    slot={slot}
                                                    selected={selectedSlot}
                                                    onSelect={setSelectedSlot}
                                                    selectedDate={selectedDate}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-900/30 border border-red-500/30 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm text-red-300 font-semibold">
                            <span className="material-symbols-outlined text-[18px] text-red-400">error</span>
                            {error}
                        </div>
                    )}

                </div>

                {/* Right column — sticky booking summary */}
                <div className="lg:sticky lg:top-[68px] h-fit flex flex-col gap-4">

                    {/* Summary card */}
                    <div className="bg-white/[.07] rounded-2xl border border-white/[.1] overflow-hidden">
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[.08]">
                            <span className="material-symbols-outlined text-emerald-400 text-[18px]">receipt_long</span>
                            <h3 className="font-black text-white text-sm">ملخص الحجز</h3>
                        </div>

                        <div className="p-5 space-y-2.5">
                            <SummaryRow icon="person"           label="الطبيب"  value={`د. ${doctor?.user?.name ?? '—'}`} />
                            <SummaryRow icon="medical_services" label="التخصص"  value={doctor?.specialization ?? '—'} />
                            {doctor?.address?.clinicPhone && (
                                <SummaryRow icon="call" label="هاتف"  value={doctor.address.clinicPhone} />
                            )}
                            <div className="border-t border-white/[.08] pt-2.5 mt-1">
                                <SummaryRow icon="calendar_month" label="التاريخ" value={dateLabel ?? '—'} muted={!dateLabel} />
                            </div>
                            <SummaryRow
                                icon="schedule" label="الوقت"
                                value={selectedSlot ? `${fmtTime(selectedSlot.startTime)} — ${fmtTime(selectedSlot.endTime)}` : '—'}
                                muted={!selectedSlot}
                            />
                        </div>

                        {/* Fee highlight */}
                        <div className="mx-4 mb-4 bg-emerald-900/50 border border-emerald-500/25 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] text-white/40">{isFollowUp ? 'سعر إعادة الكشف' : 'سعر الكشف'}</p>
                                    {isFollowUp && (
                                        <p className="text-[10px] text-sky-400 font-semibold flex items-center gap-1 mt-0.5">
                                            <span className="material-symbols-outlined text-[11px]">autorenew</span>
                                            سعر المتابعة مطبّق
                                        </p>
                                    )}
                                </div>
                                <div className="text-left">
                                    <span className="text-2xl font-black text-emerald-300">{effectiveFee}</span>
                                    <span className="text-xs text-white/35 mr-1">جنيه</span>
                                </div>
                            </div>
                        </div>

                        <div className="px-4 pb-4">
                            <button
                                onClick={() => { setError(null); setConfirming(true); }}
                                disabled={!selectedSlot}
                                className="w-full bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black py-4 rounded-2xl transition-all disabled:opacity-35 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/50 disabled:shadow-none flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[20px]">event_available</span>
                                تأكيد الحجز
                            </button>
                            {!selectedSlot && (
                                <p className="text-center text-[11px] text-white/30 mt-2">اختر تاريخاً وميعاداً للمتابعة</p>
                            )}
                        </div>
                    </div>

                    {/* Quick actions */}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => navigate('/doctors')}
                            className="flex flex-col items-center gap-1.5 py-3.5 bg-white/[.05] border border-white/[.08] rounded-xl hover:bg-white/[.09] hover:border-white/[.15] transition-all"
                        >
                            <span className="material-symbols-outlined text-[20px] text-violet-400">groups</span>
                            <span className="text-[11px] font-bold text-white/60">أطباء آخرون</span>
                        </button>
                        <button
                            onClick={() => navigate('/appointments')}
                            className="flex flex-col items-center gap-1.5 py-3.5 bg-white/[.05] border border-white/[.08] rounded-xl hover:bg-white/[.09] hover:border-white/[.15] transition-all"
                        >
                            <span className="material-symbols-outlined text-[20px] text-teal-400">calendar_month</span>
                            <span className="text-[11px] font-bold text-white/60">مواعيدي</span>
                        </button>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {confirming && (
                    <ConfirmModal
                        doctor={doctor}
                        slot={selectedSlot}
                        selectedDate={selectedDate}
                        onConfirm={handleBook}
                        onClose={() => setConfirming(false)}
                        loading={bookingLoading}
                        isFollowUp={isFollowUp}
                        effectiveFee={effectiveFee}
                    />
                )}
            </AnimatePresence>

            <Footer />
        </div>
    );
}

function StepLabel({ num, label }) {
    return (
        <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-black shadow-sm shrink-0">
                {num}
            </div>
            <h2 className="font-black text-white/80 text-sm">{label}</h2>
        </div>
    );
}

function VisitTypeBtn({ active, icon, title, price, subtitle, colorActive, onClick }) {
    const activeStyles = colorActive === 'sky'
        ? 'border-sky-400/50 bg-sky-900/30'
        : 'border-emerald-400/50 bg-emerald-900/30';
    const iconColor = colorActive === 'sky' ? 'text-sky-300' : 'text-emerald-300';
    const titleColor = colorActive === 'sky' ? 'text-sky-200' : 'text-emerald-200';

    return (
        <button
            onClick={onClick}
            className={`rounded-2xl p-4 border text-right transition-all ${
                active
                    ? `${activeStyles} shadow-sm`
                    : 'border-white/[.1] bg-white/[.05] hover:bg-white/[.09] hover:border-white/[.18]'
            }`}
        >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 ${active ? 'bg-white/15' : 'bg-white/[.07]'}`}>
                <span className={`material-symbols-outlined text-[20px] ${active ? iconColor : 'text-white/40'}`}>{icon}</span>
            </div>
            <p className={`font-black text-sm ${active ? titleColor : 'text-white/60'}`}>{title}</p>
            <p className={`text-xs mt-0.5 ${active ? 'text-white/50' : 'text-white/30'}`}>{price}</p>
            {subtitle && <p className={`text-[10px] mt-1 font-semibold ${active ? 'text-sky-400/80' : 'text-white/25'}`}>{subtitle}</p>}
        </button>
    );
}

function SummaryRow({ icon, label, value, muted }) {
    return (
        <div className="flex items-center gap-2.5 text-xs">
            <span className="material-symbols-outlined text-[14px] text-emerald-400/70 shrink-0">{icon}</span>
            <span className="text-white/35 w-14 shrink-0">{label}</span>
            <span className={`truncate font-semibold ${muted ? 'text-white/20 italic' : 'text-white/70'}`}>
                {value}
            </span>
        </div>
    );
}

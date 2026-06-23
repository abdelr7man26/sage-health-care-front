import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import PatientHeader from '../../components/PatientHeader';
import { motion, AnimatePresence } from 'framer-motion';
import axiosInstance from '../../api/axiosInstance';
import { queryKeys } from '../../lib/queryClient';
import { fmtTime } from '../../utils/timeFormat';
import QueueTracker from '../../components/QueueTracker';
import Footer from '../../components/Footer';

const fmtDate = (d) =>
    new Date(d).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const fmtDateShort = (d) =>
    new Date(d).toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' });

// Slot dates are stored as UTC midnight — use UTC getters to avoid timezone shift
const slotUTCDateStr = (date) => {
    const d = new Date(date);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

const isMoreThan24hAway = (booking) => {
    const dateStr = slotUTCDateStr(booking.slotDetails?.date);
    const time    = booking.slotDetails?.startTime || '00:00';
    const apptTs  = new Date(`${dateStr}T${time}:00`).getTime();
    return apptTs - Date.now() > 24 * 60 * 60 * 1000;
};

// ── Status / badge configs — dark-theme colours ───────────────────────────────
const BOOKING_STATUS = {
    confirmed:     { ar: 'مؤكد',         bg: 'bg-emerald-500/20', text: 'text-emerald-300', dot: 'bg-emerald-400' },
    pending:       { ar: 'قيد المراجعة', bg: 'bg-amber-500/20',   text: 'text-amber-300',   dot: 'bg-amber-400'   },
    'in-progress': { ar: 'جارٍ الكشف',  bg: 'bg-blue-500/20',    text: 'text-blue-300',    dot: 'bg-blue-400'    },
    completed:     { ar: 'مكتمل',        bg: 'bg-blue-500/15',    text: 'text-blue-300',    dot: 'bg-blue-400'    },
    cancelled:     { ar: 'ملغي',         bg: 'bg-red-500/20',     text: 'text-red-300',     dot: 'bg-red-400'     },
};

const WALKIN_STATUS = {
    waiting:       { ar: 'في الانتظار',  bg: 'bg-amber-500/20',   text: 'text-amber-300',   dot: 'bg-amber-400'   },
    'in-progress': { ar: 'جارٍ الكشف',  bg: 'bg-blue-500/20',    text: 'text-blue-300',    dot: 'bg-blue-400'    },
    done:          { ar: 'مكتمل',        bg: 'bg-emerald-500/20', text: 'text-emerald-300', dot: 'bg-emerald-400' },
    cancelled:     { ar: 'ملغي',         bg: 'bg-red-500/20',     text: 'text-red-300',     dot: 'bg-red-400'     },
};

const OP_STATUS = {
    scheduled: { ar: 'مجدولة', bg: 'bg-violet-500/20', text: 'text-violet-300', dot: 'bg-violet-400' },
    done:      { ar: 'مكتملة', bg: 'bg-emerald-500/20',text: 'text-emerald-300',dot: 'bg-emerald-400'},
    cancelled: { ar: 'ملغية',  bg: 'bg-red-500/20',    text: 'text-red-300',    dot: 'bg-red-400'    },
};

const TYPE_BADGE = {
    booking:   { ar: 'حجز',       icon: 'calendar_month',   bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
    walkin:    { ar: 'زيارة',      icon: 'directions_walk',  bg: 'bg-amber-500/15',   text: 'text-amber-300'   },
    followup:  { ar: 'إعادة كشف', icon: 'autorenew',        bg: 'bg-sky-500/15',     text: 'text-sky-300'     },
    operation: { ar: 'عملية',     icon: 'medical_services', bg: 'bg-violet-500/15',  text: 'text-violet-300'  },
};

const TIME_PERIODS = [
    { key: 'morning', label: 'صباحاً', icon: 'wb_sunny',    test: (h) => h < 12 },
    { key: 'noon',    label: 'ظهراً',  icon: 'light_mode',  test: (h) => h >= 12 && h < 17 },
    { key: 'evening', label: 'مساءً',  icon: 'nights_stay', test: (h) => h >= 17 },
];

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
    return (
        <div className="animate-pulse bg-white/[.06] rounded-2xl border border-white/[.08] p-5 space-y-3">
            <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                    <div className="h-4 bg-white/10 rounded-lg w-2/5" />
                    <div className="h-3 bg-white/[.07] rounded w-1/3" />
                </div>
                <div className="h-6 w-16 bg-white/10 rounded-full" />
            </div>
            <div className="h-3 bg-white/[.07] rounded w-3/4" />
            <div className="h-3 bg-white/[.07] rounded w-1/2" />
            <div className="flex gap-2 pt-1 border-t border-white/[.06]">
                <div className="h-8 w-24 bg-white/10 rounded-xl" />
                <div className="h-8 w-20 bg-white/[.07] rounded-xl" />
            </div>
        </div>
    );
}

// ── Modal shell ───────────────────────────────────────────────────────────────
function ModalShell({ children, onClose, wide = false }) {
    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <motion.div
                initial={{ scale: 0.93, opacity: 0, y: 16 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.93, opacity: 0, y: 16 }}
                className={`bg-[#0d2e1f] border border-white/[.12] rounded-3xl shadow-2xl w-full p-6 ${wide ? 'max-w-lg' : 'max-w-md'}`}
                dir="rtl"
            >
                {children}
            </motion.div>
        </motion.div>
    );
}

function CloseBtn({ onClose }) {
    return (
        <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-white/40 hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
    );
}

// ── Star selector ─────────────────────────────────────────────────────────────
function StarSelector({ value, onChange }) {
    const [hovered, setHovered] = useState(0);
    return (
        <div className="flex items-center gap-1.5 justify-center">
            {[1,2,3,4,5].map((star) => (
                <button key={star} type="button"
                    onMouseEnter={() => setHovered(star)} onMouseLeave={() => setHovered(0)}
                    onClick={() => onChange(star)} className="transition-transform hover:scale-110">
                    <svg className={`w-9 h-9 transition-colors ${star <= (hovered || value) ? 'text-amber-400' : 'text-white/15'}`}
                        fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                </button>
            ))}
        </div>
    );
}

// ── Rate modal ────────────────────────────────────────────────────────────────
// isWalkIn=true → sends walkInId instead of bookingId
function RateModal({ booking, onClose, onSuccess, isWalkIn = false }) {
    const [rating,  setRating]  = useState(0);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState('');

    const LABELS = ['', 'سيء', 'مقبول', 'جيد', 'جيد جداً', 'ممتاز'];

    const submit = async () => {
        if (!rating) { setError('اختر عدد النجوم أولاً'); return; }
        setLoading(true); setError('');
        try {
            const payload = isWalkIn
                ? { walkInId: booking._id, rating, comment }
                : { bookingId: booking._id, rating, comment };
            await axiosInstance.post('/reviews', payload);
            onSuccess(booking._id);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'حدث خطأ، حاول مرة أخرى');
        } finally { setLoading(false); }
    };

    const doctorName = isWalkIn ? booking.doctor?.name : booking.doctor?.name;

    return (
        <ModalShell onClose={onClose}>
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-base font-black text-white">تقييم الدكتور</h2>
                    <p className="text-xs text-white/45 mt-0.5">د. {doctorName}</p>
                </div>
                <CloseBtn onClose={onClose} />
            </div>
            <div className="text-center mb-5">
                <StarSelector value={rating} onChange={setRating} />
                {rating > 0 && <p className="text-sm font-bold text-amber-400 mt-2">{LABELS[rating]}</p>}
            </div>
            <textarea
                value={comment} onChange={(e) => setComment(e.target.value)}
                maxLength={500} rows={3}
                placeholder="شاركنا تجربتك مع الدكتور..."
                className="w-full p-3.5 bg-white/[.07] border border-white/[.12] rounded-2xl text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-emerald-400/50 transition mb-4"
            />
            {error && <p className="text-red-300 text-sm bg-red-500/15 rounded-xl px-3 py-2 mb-4">{error}</p>}
            <div className="flex gap-3">
                <button onClick={onClose}
                    className="flex-1 py-3 border border-white/[.12] text-white/60 font-bold rounded-2xl hover:bg-white/[.07] transition-colors text-sm">
                    إلغاء
                </button>
                <button onClick={submit} disabled={loading || !rating}
                    className="flex-1 py-3 bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold rounded-2xl transition-all disabled:opacity-40 text-sm">
                    {loading ? 'جاري الإرسال...' : 'إرسال التقييم'}
                </button>
            </div>
        </ModalShell>
    );
}

// ── Cancel modal ──────────────────────────────────────────────────────────────
function CancelModal({ booking, onClose, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState('');

    const confirm = async () => {
        setLoading(true); setError('');
        try {
            await axiosInstance.patch(`/bookings/${booking._id}/cancel`);
            onSuccess(booking._id);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'حدث خطأ، حاول مرة أخرى');
            setLoading(false);
        }
    };

    return (
        <ModalShell onClose={onClose}>
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-black text-white">تأكيد الإلغاء</h2>
                <CloseBtn onClose={onClose} />
            </div>
            <div className="bg-red-500/15 border border-red-500/25 rounded-2xl p-4 mb-5">
                <p className="text-sm font-bold text-red-300 mb-2">سيتم إلغاء الموعد التالي:</p>
                <p className="text-sm text-white/80 font-semibold">د. {booking.doctor?.name}</p>
                <p className="text-sm text-white/50 mt-0.5">
                    {booking.slotDetails?.date ? fmtDate(booking.slotDetails.date) : '—'}
                    {booking.slotDetails?.startTime ? ` · ${fmtTime(booking.slotDetails.startTime)}` : ''}
                </p>
            </div>
            <p className="text-sm text-white/50 mb-5 leading-relaxed">
                هل أنت متأكد؟ سيتم إشعار الطبيب فور الإلغاء.
            </p>
            {error && <p className="text-red-300 text-sm bg-red-500/15 rounded-xl px-3 py-2 mb-4">{error}</p>}
            <div className="flex gap-3">
                <button onClick={onClose}
                    className="flex-1 py-3 border border-white/[.12] text-white/60 font-bold rounded-2xl hover:bg-white/[.07] transition-colors text-sm">
                    تراجع
                </button>
                <button onClick={confirm} disabled={loading}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl transition-colors disabled:opacity-50 text-sm">
                    {loading ? 'جاري الإلغاء...' : 'تأكيد الإلغاء'}
                </button>
            </div>
        </ModalShell>
    );
}

// ── Reschedule Wizard — shared by booking + walk-in ──────────────────────────
function RescheduleWizard({ doctorProfileId, currentDate, currentTime, onClose, onSubmit, title, subtitle }) {
    const [step,         setStep]         = useState(1);
    const [slots,        setSlots]        = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(true);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [submitting,   setSubmitting]   = useState(false);
    const [error,        setError]        = useState('');
    const direction = useRef(1);

    useEffect(() => {
        if (!doctorProfileId) { setLoadingSlots(false); return; }
        axiosInstance.get(`/bookings/doctor/${doctorProfileId}/slots`)
            .then((res) => setSlots(res.data.data || []))
            .catch(() => setError('تعذّر تحميل المواعيد المتاحة'))
            .finally(() => setLoadingSlots(false));
    }, [doctorProfileId]);

    const slotsByDate = useMemo(() => {
        const map = {};
        slots.forEach((s) => {
            const key = slotUTCDateStr(s.date);
            if (!map[key]) map[key] = [];
            map[key].push(s);
        });
        return map;
    }, [slots]);

    const availableDates   = Object.keys(slotsByDate).sort();
    const slotsForSelected = selectedDate ? (slotsByDate[selectedDate] || []) : [];
    const groupedSlots     = TIME_PERIODS
        .map((p) => ({ ...p, slots: slotsForSelected.filter((s) => p.test(parseInt(s.startTime?.split(':')[0] || '0'))) }))
        .filter((p) => p.slots.length > 0);

    const todayStr    = slotUTCDateStr(new Date());
    const tomorrowStr = slotUTCDateStr(new Date(Date.now() + 86400000));

    const dayLabel = (d) => {
        if (d === todayStr)    return 'اليوم';
        if (d === tomorrowStr) return 'غداً';
        return new Date(d + 'T12:00:00').toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    const goStep = (s) => { direction.current = s > step ? 1 : -1; setStep(s); };
    const handleDateSelect = (d) => { setSelectedDate(d); setSelectedSlot(null); goStep(2); };
    const handleBack       = ()  => { setSelectedSlot(null); goStep(1); };

    const handleSubmit = async () => {
        if (!selectedSlot) return;
        setSubmitting(true); setError('');
        try {
            await onSubmit(selectedSlot._id);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'حدث خطأ، حاول مرة أخرى');
            setSubmitting(false);
        }
    };

    const variants = {
        enter:  (d) => ({ x: d > 0 ? '50%' : '-50%', opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit:   (d) => ({ x: d > 0 ? '-50%' : '50%', opacity: 0 }),
    };

    return (
        <ModalShell onClose={onClose} wide>
            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-base font-black text-white">{title}</h2>
                    <p className="text-sm text-white/45 mt-0.5">{subtitle}</p>
                </div>
                <CloseBtn onClose={onClose} />
            </div>

            {/* ── Current slot ── */}
            <div className="bg-white/[.07] border border-white/[.1] rounded-2xl p-3 mb-4 flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[17px] text-white/35">calendar_month</span>
                <div>
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-wide">الموعد الحالي</p>
                    <p className="text-sm font-semibold text-white/70">
                        {currentDate ? fmtDate(currentDate) : '—'}
                        {currentTime ? ` · ${fmtTime(currentTime)}` : ''}
                    </p>
                </div>
            </div>

            {/* ── Step indicator ── */}
            <div className="flex items-center gap-2 mb-5">
                {[{ n: 1, label: 'التاريخ' }, { n: 2, label: 'الوقت' }].map(({ n, label }, i) => (
                    <div key={n} className="flex items-center gap-2">
                        {i > 0 && <div className={`h-px w-10 transition-colors duration-300 ${step >= n ? 'bg-emerald-500' : 'bg-white/15'}`} />}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black transition-all duration-300 ${
                            step === n ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                            : step > n  ? 'bg-emerald-500/25 text-emerald-400'
                                        : 'bg-white/[.08] text-white/30'
                        }`}>
                            {step > n
                                ? <span className="material-symbols-outlined text-[13px]">check</span>
                                : n === 1 ? '١' : '٢'}
                        </div>
                        <span className={`text-[11px] font-bold transition-colors duration-300 ${step === n ? 'text-white/70' : 'text-white/25'}`}>
                            {label}
                        </span>
                    </div>
                ))}
            </div>

            {/* ── Content area ── */}
            {loadingSlots ? (
                <div className="flex justify-center py-10">
                    <div className="w-8 h-8 border-4 border-emerald-700 border-t-emerald-400 rounded-full animate-spin" />
                </div>
            ) : !doctorProfileId ? (
                <p className="text-sm text-red-300 text-center py-6">تعذّر تحميل مواعيد الطبيب</p>
            ) : availableDates.length === 0 ? (
                <div className="text-center py-10">
                    <span className="material-symbols-outlined text-[40px] text-white/20 block mb-2">event_busy</span>
                    <p className="text-sm text-white/40 font-semibold">لا توجد مواعيد متاحة حالياً</p>
                </div>
            ) : (
                <div className="overflow-hidden min-h-[180px]">
                    <AnimatePresence mode="wait" custom={direction.current}>

                        {/* ── Step 1 : Date grid ── */}
                        {step === 1 && (
                            <motion.div key="date-step"
                                custom={direction.current} variants={variants}
                                initial="enter" animate="center" exit="exit"
                                transition={{ duration: 0.2, ease: 'easeInOut' }}
                            >
                                <p className="text-[11px] text-white/35 font-bold mb-3">اختر يوماً مناسباً</p>
                                <div className="max-h-[252px] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
                                    <div className="grid grid-cols-4 gap-2 pb-1">
                                        {availableDates.map((d) => {
                                            const dt         = new Date(d + 'T12:00:00');
                                            const isToday    = d === todayStr;
                                            const isTomorrow = d === tomorrowStr;
                                            return (
                                                <button key={d} onClick={() => handleDateSelect(d)}
                                                    className="flex flex-col items-center py-2.5 px-1 rounded-xl bg-white/[.07] border border-white/[.1] hover:border-emerald-400/50 hover:bg-white/[.11] transition-all group active:scale-95">
                                                    <span className={`text-[9px] font-black mb-0.5 ${isToday || isTomorrow ? 'text-emerald-400' : 'text-white/35'}`}>
                                                        {isToday ? 'اليوم' : isTomorrow ? 'غداً' : dt.toLocaleDateString('ar-EG', { weekday: 'short' })}
                                                    </span>
                                                    <span className="text-lg font-black text-white group-hover:text-emerald-300 transition-colors leading-none">
                                                        {dt.getDate()}
                                                    </span>
                                                    <span className="text-[9px] text-white/30 mt-0.5">
                                                        {dt.toLocaleDateString('ar-EG', { month: 'short' })}
                                                    </span>
                                                    <span className="mt-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                                                        {slotsByDate[d].length}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ── Step 2 : Time slots ── */}
                        {step === 2 && (
                            <motion.div key="time-step"
                                custom={direction.current} variants={variants}
                                initial="enter" animate="center" exit="exit"
                                transition={{ duration: 0.2, ease: 'easeInOut' }}
                            >
                                <button onClick={handleBack}
                                    className="flex items-center gap-1.5 mb-3 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
                                    <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
                                    {selectedDate && dayLabel(selectedDate)}
                                </button>
                                <div className="space-y-4 max-h-60 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
                                    {groupedSlots.map((period) => (
                                        <div key={period.key}>
                                            <p className="text-[10px] font-bold text-white/30 mb-2 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[13px]">{period.icon}</span>
                                                {period.label}
                                            </p>
                                            <div className="grid grid-cols-4 gap-1.5">
                                                {period.slots.map((slot) => (
                                                    <button key={slot._id} onClick={() => setSelectedSlot(slot)}
                                                        className={`py-2 rounded-xl text-sm font-bold transition-all ${
                                                            selectedSlot?._id === slot._id
                                                                ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-sm ring-1 ring-emerald-400/40'
                                                                : 'bg-white/[.07] border border-white/[.1] text-white/65 hover:border-emerald-400/40'
                                                        }`}
                                                    >
                                                        {fmtTime(slot.startTime)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>
            )}

            {error && <p className="text-red-300 text-sm bg-red-500/15 rounded-xl px-3 py-2 mt-3">{error}</p>}

            {/* ── Footer (step 2 only) ── */}
            {step === 2 && !loadingSlots && (
                <div className="flex gap-3 mt-4 pt-4 border-t border-white/[.07]">
                    <button onClick={handleBack}
                        className="flex items-center justify-center gap-1.5 px-4 py-3 border border-white/[.12] text-white/60 font-bold rounded-2xl hover:bg-white/[.07] transition-colors text-sm shrink-0">
                        <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
                        رجوع
                    </button>
                    <button onClick={handleSubmit} disabled={!selectedSlot || submitting}
                        className="flex-1 py-3 bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold rounded-2xl transition-all disabled:opacity-40 text-sm">
                        {submitting ? 'جاري التغيير...' : selectedSlot ? `تأكيد · ${fmtTime(selectedSlot.startTime)}` : 'اختر وقتاً أولاً'}
                    </button>
                </div>
            )}
        </ModalShell>
    );
}

// ── Reschedule modal (booking) ────────────────────────────────────────────────
function RescheduleModal({ booking, onClose, onSuccess }) {
    const doctorProfileId = typeof booking.doctorProfile === 'object'
        ? booking.doctorProfile._id : booking.doctorProfile;
    return (
        <RescheduleWizard
            doctorProfileId={doctorProfileId}
            currentDate={booking.slotDetails?.date}
            currentTime={booking.slotDetails?.startTime}
            title="إعادة جدولة الموعد"
            subtitle={`د. ${booking.doctor?.name}`}
            onClose={onClose}
            onSubmit={async (newSlotId) => {
                await axiosInstance.patch(`/bookings/${booking._id}/reschedule`, { newSlotId });
                onSuccess();
            }}
        />
    );
}

// ── Cancel walk-in modal ──────────────────────────────────────────────────────
function CancelWalkInModal({ item, onClose, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState('');

    const confirm = async () => {
        setLoading(true); setError('');
        try {
            await axiosInstance.delete(`/patients/my-walkins/${item._id}`);
            onSuccess(item._id);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'حدث خطأ، حاول مرة أخرى');
            setLoading(false);
        }
    };

    return (
        <ModalShell onClose={onClose}>
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-black text-white">تأكيد إلغاء الزيارة</h2>
                <CloseBtn onClose={onClose} />
            </div>
            <div className="bg-red-500/15 border border-red-500/25 rounded-2xl p-4 mb-5">
                <p className="text-sm font-bold text-red-300 mb-2">سيتم إلغاء الزيارة التالية:</p>
                <p className="text-sm text-white/80 font-semibold">د. {item.doctor?.name}</p>
                <p className="text-sm text-white/50 mt-0.5">
                    {item.date ? fmtDate(item.date) : '—'}
                    {item.arrivalTime ? ` · وصول ${fmtTime(item.arrivalTime)}` : ''}
                </p>
            </div>
            <p className="text-sm text-white/50 mb-5 leading-relaxed">
                هل أنت متأكد من إلغاء الزيارة؟ ستُحذف من قائمة الانتظار فوراً.
            </p>
            {error && <p className="text-red-300 text-sm bg-red-500/15 rounded-xl px-3 py-2 mb-4">{error}</p>}
            <div className="flex gap-3">
                <button onClick={onClose}
                    className="flex-1 py-3 border border-white/[.12] text-white/60 font-bold rounded-2xl hover:bg-white/[.07] transition-colors text-sm">
                    تراجع
                </button>
                <button onClick={confirm} disabled={loading}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl transition-colors disabled:opacity-50 text-sm">
                    {loading ? 'جاري الإلغاء...' : 'تأكيد الإلغاء'}
                </button>
            </div>
        </ModalShell>
    );
}

// ── Reschedule walk-in modal ───────────────────────────────────────────────────
function RescheduleWalkInModal({ item, onClose, onSuccess }) {
    return (
        <RescheduleWizard
            doctorProfileId={item.doctorProfileId}
            currentDate={item.date}
            currentTime={item.arrivalTime}
            title="تغيير موعد الزيارة"
            subtitle={`د. ${item.doctor?.name}`}
            onClose={onClose}
            onSubmit={async (newSlotId) => {
                await axiosInstance.patch(`/patients/my-walkins/${item._id}/reschedule`, { newSlotId });
                onSuccess();
            }}
        />
    );
}

// ── Booking card ──────────────────────────────────────────────────────────────
function BookingCard({ booking, reviewedIds, onRate, onCancel, onReschedule, today = false }) {
    const st           = BOOKING_STATUS[booking.status] || BOOKING_STATUS.pending;
    const date         = booking.slotDetails?.date;
    const start        = booking.slotDetails?.startTime;
    const end          = booking.slotDetails?.endTime;
    const alreadyRated = reviewedIds.has(booking._id);
    const isFollowUp   = booking.followUp?.enabled;
    const typeBadge    = isFollowUp ? TYPE_BADGE.followup : TYPE_BADGE.booking;
    const isUpcoming   = ['confirmed', 'pending'].includes(booking.status);
    const canModify    = isUpcoming && isMoreThan24hAway(booking);
    const tooSoon      = isUpcoming && !isMoreThan24hAway(booking);
    const hasTracker   = booking.status === 'confirmed' || booking.status === 'in-progress';
    const rowLayout    = today && hasTracker;

    const actionContent = (isUpcoming || booking.status === 'completed') && (
        booking.status === 'completed' ? (
            alreadyRated ? (
                <p className="text-sm text-amber-400 font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">star</span>تم التقييم
                </p>
            ) : (
                <button onClick={() => onRate(booking)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/20 hover:bg-amber-500/25 hover:border-amber-500/35 transition-all">
                    <span className="material-symbols-outlined text-[17px]">star_rate</span>قيّم الدكتور
                </button>
            )
        ) : canModify ? (
            <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onReschedule(booking)}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white bg-[#1a6b4e] border border-emerald-500/30 hover:bg-[#155d44] transition-all">
                    <span className="material-symbols-outlined text-[17px]">event_repeat</span>تغيير الموعد
                </button>
                <button onClick={() => onCancel(booking)}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-red-300 bg-red-500/15 border border-red-500/25 hover:bg-red-500/25 hover:border-red-400/40 transition-all">
                    <span className="material-symbols-outlined text-[17px]">event_busy</span>إلغاء الموعد
                </button>
            </div>
        ) : tooSoon ? (
            <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3.5 py-2.5">
                <span className="material-symbols-outlined text-[18px] text-amber-400 shrink-0">lock_clock</span>
                <div>
                    <p className="text-xs text-amber-300 font-bold">أقل من 24 ساعة على الموعد</p>
                    <p className="text-[11px] text-amber-400/60 mt-0.5">تواصل مع العيادة مباشرةً للتعديل</p>
                </div>
            </div>
        ) : null
    );

    return (
        <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white/[.07] rounded-2xl border border-white/[.1] p-4 hover:bg-white/[.09] transition-colors">
            {rowLayout ? (
                <div className="flex flex-col gap-2.5">
                    <div className="flex gap-3 items-start">
                        {/* Right: doctor info — no badge (RTL start) */}
                        <div className="w-[33%] shrink-0 flex flex-col gap-2">
                            <p className="font-black text-white text-sm leading-tight truncate">د. {booking.doctor?.name}</p>
                            {booking.doctorProfile?.specialization && (
                                <p className="text-xs text-white/45 truncate">{booking.doctorProfile.specialization}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${typeBadge.bg} ${typeBadge.text}`}>
                                    <span className="material-symbols-outlined text-[12px]">{typeBadge.icon}</span>{typeBadge.ar}
                                </span>
                                <span className="flex items-center gap-1 text-xs text-white/50">
                                    <span className="material-symbols-outlined text-[13px] text-white/30">calendar_month</span>
                                    {date ? fmtDateShort(date) : '—'}
                                </span>
                                {start && (
                                    <span className="flex items-center gap-1 text-xs text-white/50">
                                        <span className="material-symbols-outlined text-[13px] text-white/30">schedule</span>
                                        {fmtTime(start)}{end ? ` – ${fmtTime(end)}` : ''}
                                    </span>
                                )}
                            </div>
                            {booking.consultationFee > 0 && (
                                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/15 rounded-xl px-2.5 py-1.5 w-fit">
                                    <span className="material-symbols-outlined text-[14px]">payments</span>
                                    {booking.consultationFee} جنيه
                                </div>
                            )}
                        </div>
                        {/* Middle: embedded queue info */}
                        <div className="flex-1 min-w-0">
                            <QueueTracker bookingId={booking._id} doctorName={booking.doctor?.name}
                                slotTime={start} slotDate={date} bookingType="online" />
                        </div>
                        {/* Left: status badge only (RTL end) */}
                        <div className="shrink-0">
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${st.bg} ${st.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dot}`} />{st.ar}
                            </span>
                        </div>
                    </div>
                    {/* Full-width action below */}
                    {actionContent && (
                        <div className="pt-2.5 border-t border-white/[.07]">{actionContent}</div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-2.5">
                    {/* Header: doctor + status */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-white text-sm leading-tight">د. {booking.doctor?.name}</p>
                            <p className="text-xs text-white/45 mt-0.5">{booking.doctorProfile?.specialization}</p>
                        </div>
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1.5 ${st.bg} ${st.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dot}`} />{st.ar}
                        </span>
                    </div>
                    {/* Type badge + date + time */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${typeBadge.bg} ${typeBadge.text}`}>
                            <span className="material-symbols-outlined text-[12px]">{typeBadge.icon}</span>{typeBadge.ar}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-white/50">
                            <span className="material-symbols-outlined text-[14px] text-white/30">calendar_month</span>
                            {date ? fmtDate(date) : '—'}
                        </span>
                        {start && (
                            <span className="flex items-center gap-1.5 text-xs text-white/50">
                                <span className="material-symbols-outlined text-[14px] text-white/30">schedule</span>
                                {fmtTime(start)}{end ? ` – ${fmtTime(end)}` : ''}
                            </span>
                        )}
                    </div>
                    {/* Fee */}
                    {booking.consultationFee > 0 && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/15 rounded-xl px-2.5 py-1.5 w-fit">
                            <span className="material-symbols-outlined text-[14px]">payments</span>
                            {booking.consultationFee} جنيه
                        </div>
                    )}
                    {/* Queue tracker */}
                    {hasTracker && (
                        <QueueTracker bookingId={booking._id} doctorName={booking.doctor?.name}
                            slotTime={start} slotDate={date} bookingType="online" />
                    )}
                    {/* Closing note */}
                    {booking.closingNote && (
                        <div className="bg-white/[.05] rounded-xl px-3 py-2 border border-white/[.07]">
                            <p className="text-[10px] font-bold text-white/30 mb-0.5">ملاحظة الدكتور</p>
                            <p className="text-sm text-white/60">{booking.closingNote}</p>
                        </div>
                    )}
                    {actionContent && (
                        <div className="pt-2 border-t border-white/[.07]">{actionContent}</div>
                    )}
                </div>
            )}
        </motion.div>
    );

}

// ── Walk-in card ──────────────────────────────────────────────────────────────
const isWalkInToday = (d) => {
    if (!d) return false;
    const dt = new Date(d), now = new Date();
    return dt.getFullYear() === now.getFullYear() &&
           dt.getMonth()    === now.getMonth()    &&
           dt.getDate()     === now.getDate();
};

const isWalkInMoreThan24hAway = (item) => {
    if (!item.date) return false;
    const dateStr = slotUTCDateStr(item.date);
    const time    = item.arrivalTime || '00:00';
    const apptTs  = new Date(`${dateStr}T${time}:00`).getTime();
    return apptTs - Date.now() > 24 * 60 * 60 * 1000;
};

function WalkInCard({ item, onCancel, onReschedule, onRate, reviewedWalkInIds, today = false }) {
    const st           = WALKIN_STATUS[item.status] || WALKIN_STATUS.waiting;
    const tb           = TYPE_BADGE.walkin;
    const showTracker  = ['waiting', 'in-progress'].includes(item.status) && isWalkInToday(item.date);
    const canCancel    = item.status === 'waiting';
    const canModify    = canCancel && isWalkInMoreThan24hAway(item);
    const tooSoon      = canCancel && !isWalkInMoreThan24hAway(item);
    const inProgress   = item.status === 'in-progress';
    const isDone       = item.status === 'done';
    const alreadyRated = reviewedWalkInIds?.has(item._id);
    const rowLayout    = today && showTracker;

    const actionContent = (canCancel || inProgress || isDone) && (
        isDone ? (
            alreadyRated ? (
                <p className="text-sm text-amber-400 font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">star</span>تم التقييم
                </p>
            ) : (
                <button onClick={() => onRate(item)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/20 hover:bg-amber-500/25 hover:border-amber-500/35 transition-all">
                    <span className="material-symbols-outlined text-[17px]">star_rate</span>قيّم الدكتور
                </button>
            )
        ) : canModify ? (
            <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onReschedule(item)}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white bg-[#1a6b4e] border border-emerald-500/30 hover:bg-[#155d44] transition-all">
                    <span className="material-symbols-outlined text-[17px]">event_repeat</span>تغيير الموعد
                </button>
                <button onClick={() => onCancel(item)}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-red-300 bg-red-500/15 border border-red-500/25 hover:bg-red-500/25 hover:border-red-400/40 transition-all">
                    <span className="material-symbols-outlined text-[17px]">event_busy</span>إلغاء الزيارة
                </button>
            </div>
        ) : tooSoon ? (
            <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3.5 py-2.5">
                <span className="material-symbols-outlined text-[18px] text-amber-400 shrink-0">lock_clock</span>
                <div>
                    <p className="text-xs text-amber-300 font-bold">أقل من 24 ساعة على الزيارة</p>
                    <p className="text-[11px] text-amber-400/60 mt-0.5">تواصل مع العيادة مباشرةً للتعديل</p>
                </div>
            </div>
        ) : (
            <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3.5 py-2.5">
                <span className="material-symbols-outlined text-[18px] text-amber-400 shrink-0">lock_clock</span>
                <div>
                    <p className="text-xs text-amber-300 font-bold">الزيارة جارية الآن</p>
                    <p className="text-[11px] text-amber-400/60 mt-0.5">تواصل مع العيادة مباشرةً</p>
                </div>
            </div>
        )
    );

    return (
        <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white/[.07] rounded-2xl border border-white/[.1] p-4 hover:bg-white/[.09] transition-colors">
            {rowLayout ? (
                <div className="flex flex-col gap-2.5">
                    <div className="flex gap-3 items-start">
                        {/* Right: doctor info — no badge (RTL start) */}
                        <div className="w-[33%] shrink-0 flex flex-col gap-2">
                            <p className="font-black text-white text-sm leading-tight truncate">د. {item.doctor?.name}</p>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${tb.bg} ${tb.text}`}>
                                    <span className="material-symbols-outlined text-[12px]">{tb.icon}</span>{tb.ar}
                                </span>
                                <span className="flex items-center gap-1 text-xs text-white/50">
                                    <span className="material-symbols-outlined text-[13px] text-white/30">calendar_month</span>
                                    {item.date ? fmtDateShort(item.date) : '—'}
                                </span>
                                {item.arrivalTime && (
                                    <span className="flex items-center gap-1 text-xs text-white/50">
                                        <span className="material-symbols-outlined text-[13px] text-white/30">schedule</span>
                                        {fmtTime(item.arrivalTime)}
                                    </span>
                                )}
                            </div>
                            {item.fee > 0 && (
                                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/15 rounded-xl px-2.5 py-1.5 w-fit">
                                    <span className="material-symbols-outlined text-[14px]">payments</span>
                                    {item.fee} جنيه
                                </div>
                            )}
                        </div>
                        {/* Middle: embedded queue info */}
                        <div className="flex-1 min-w-0">
                            <QueueTracker walkInId={item._id} doctorName={item.doctor?.name}
                                slotTime={item.arrivalTime} bookingType="walkin" />
                        </div>
                        {/* Left: status badge only (RTL end) */}
                        <div className="shrink-0">
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${st.bg} ${st.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dot}`} />{st.ar}
                            </span>
                        </div>
                    </div>
                    {/* Full-width action below */}
                    {actionContent && (
                        <div className="pt-2.5 border-t border-white/[.07]">{actionContent}</div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-white text-sm leading-tight">د. {item.doctor?.name}</p>
                        </div>
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1.5 ${st.bg} ${st.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dot}`} />{st.ar}
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${tb.bg} ${tb.text}`}>
                            <span className="material-symbols-outlined text-[12px]">{tb.icon}</span>{tb.ar}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-white/50">
                            <span className="material-symbols-outlined text-[14px] text-white/30">calendar_month</span>
                            {item.date ? fmtDate(item.date) : '—'}
                        </span>
                        {item.arrivalTime && (
                            <span className="flex items-center gap-1.5 text-xs text-white/50">
                                <span className="material-symbols-outlined text-[14px] text-white/30">schedule</span>
                                وصول {fmtTime(item.arrivalTime)}
                            </span>
                        )}
                    </div>
                    {showTracker && (
                        <QueueTracker walkInId={item._id} doctorName={item.doctor?.name}
                            slotTime={item.arrivalTime} bookingType="walkin" />
                    )}
                    {item.complaint && (
                        <div className="bg-white/[.05] rounded-xl px-3 py-2 border border-white/[.07]">
                            <p className="text-[10px] font-bold text-white/30 mb-0.5">الشكوى</p>
                            <p className="text-sm text-white/60">{item.complaint}</p>
                        </div>
                    )}
                    {item.notes && (
                        <div className="bg-white/[.05] rounded-xl px-3 py-2 border border-white/[.07]">
                            <p className="text-[10px] font-bold text-white/30 mb-0.5">ملاحظة الدكتور</p>
                            <p className="text-sm text-white/60">{item.notes}</p>
                        </div>
                    )}
                    {item.fee > 0 && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/15 rounded-xl px-2.5 py-1.5 w-fit">
                            <span className="material-symbols-outlined text-[14px]">payments</span>
                            {item.fee} جنيه
                        </div>
                    )}
                    {actionContent && <div className="pt-2 border-t border-white/[.07]">{actionContent}</div>}
                </div>
            )}
        </motion.div>
    );
}

// ── Operation card ────────────────────────────────────────────────────────────
function OperationCard({ item }) {
    const st = OP_STATUS[item.status] || OP_STATUS.scheduled;
    const tb = TYPE_BADGE.operation;
    return (
        <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white/[.07] rounded-2xl border border-white/[.1] p-4 flex flex-col gap-2.5 hover:bg-white/[.09] transition-colors">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <p className="font-black text-white text-sm leading-tight">د. {item.doctor?.name}</p>
                    {item.operationType && <p className="text-sm text-white/45 mt-0.5 font-semibold">{item.operationType}</p>}
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1.5 ${st.bg} ${st.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dot}`} />
                    {st.ar}
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${tb.bg} ${tb.text}`}>
                    <span className="material-symbols-outlined text-[12px]">{tb.icon}</span>
                    {tb.ar}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-white/50">
                    <span className="material-symbols-outlined text-[14px] text-white/30">calendar_month</span>
                    {item.date ? fmtDate(item.date) : '—'}
                </span>
                {item.time && (
                    <span className="flex items-center gap-1.5 text-xs text-white/50">
                        <span className="material-symbols-outlined text-[14px] text-white/30">schedule</span>
                        {fmtTime(item.time)}
                    </span>
                )}
                {item.location && (
                    <span className="flex items-center gap-1.5 text-xs text-white/50">
                        <span className="material-symbols-outlined text-[14px] text-white/30">location_on</span>
                        {item.location}
                    </span>
                )}
            </div>

            {item.notes && (
                <div className="bg-white/[.05] rounded-xl px-3 py-2 border border-white/[.07]">
                    <p className="text-[10px] font-bold text-white/30 mb-0.5">ملاحظات</p>
                    <p className="text-sm text-white/60">{item.notes}</p>
                </div>
            )}
            {item.fee > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/15 rounded-xl px-2.5 py-1.5 w-fit">
                    <span className="material-symbols-outlined text-[14px]">payments</span>
                    {item.fee} جنيه
                </div>
            )}
        </motion.div>
    );
}

const PAGE_SIZE = 8;

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Appointments() {
    const qc = useQueryClient();

    // Mutations here (cancel/reschedule) change data the dashboard also shows.
    // The dashboard reads via TanStack Query, so invalidate the shared keys to
    // refresh its cache and avoid a stale window after the user navigates back.
    const syncDashboardCaches = useCallback(() => {
        qc.invalidateQueries({ queryKey: queryKeys.myWalkIns });
        qc.invalidateQueries({ queryKey: ['my-bookings'] });
        qc.invalidateQueries({ queryKey: queryKeys.myOperations });
    }, [qc]);

    const [bookings,    setBookings]    = useState([]);
    const [walkIns,     setWalkIns]     = useState([]);
    const [operations,  setOperations]  = useState([]);
    const [reviewedIds, setReviewedIds] = useState(new Set());
    const [loading,     setLoading]     = useState(true);

    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter,   setTypeFilter]   = useState('all');
    const [page,         setPage]         = useState(1);

    const [ratingItem,           setRatingItem]           = useState(null);
    const [cancelItem,           setCancelItem]           = useState(null);
    const [rescheduleItem,       setRescheduleItem]       = useState(null);
    const [cancelWalkInItem,     setCancelWalkInItem]     = useState(null);
    const [rescheduleWalkInItem, setRescheduleWalkInItem] = useState(null);
    const [rateWalkInItem,       setRateWalkInItem]       = useState(null);
    const [reviewedWalkInIds,    setReviewedWalkInIds]    = useState(new Set());

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [bRes, wRes, oRes, rRes] = await Promise.all([
                axiosInstance.get('/bookings/patient?limit=100'),
                axiosInstance.get('/patients/my-walkins'),
                axiosInstance.get('/patients/my-operations'),
                axiosInstance.get('/reviews/mine'),
            ]);
            setBookings(bRes.data.data || []);
            setWalkIns(wRes.data.data || []);
            setOperations(oRes.data.data || []);
            const reviews = rRes.data.data || [];
            setReviewedIds(new Set(reviews.map((r) => r.booking).filter(Boolean)));
            setReviewedWalkInIds(new Set(reviews.map((r) => r.walkIn).filter(Boolean)));
        } catch { /* axiosInstance interceptor logs */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    useEffect(() => {
        const handler = async () => {
            try {
                const { data } = await axiosInstance.get('/patients/my-walkins');
                setWalkIns(data.data || []);
            } catch { /* ignore */ }
        };
        window.addEventListener('sage:walkin-registered', handler);
        return () => window.removeEventListener('sage:walkin-registered', handler);
    }, []);

    const allItems = useMemo(() => {
        const toTs = (date, time) => {
            if (!date) return 0;
            const dateStr = slotUTCDateStr(date);
            return new Date(`${dateStr}T${time || '00:00'}:00`).getTime();
        };
        const b = bookings.map((b) => ({ ...b, _type: b.followUp?.enabled ? 'followup' : 'booking', _date: b.slotDetails?.date, _ts: toTs(b.slotDetails?.date, b.slotDetails?.startTime) }));
        const w = walkIns.map((w)  => ({ ...w, _type: 'walkin',    _date: w.date, _ts: toTs(w.date, w.arrivalTime) }));
        const o = operations.map((o) => ({ ...o, _type: 'operation', _date: o.date, _ts: toTs(o.date, o.time) }));
        return [...b, ...w, ...o].sort((a, z) => z._ts - a._ts);
    }, [bookings, walkIns, operations]);

    const filtered = useMemo(() => allItems.filter((item) => {
        if (typeFilter === 'booking'   && item._type !== 'booking')   return false;
        if (typeFilter === 'walkin'    && item._type !== 'walkin')    return false;
        if (typeFilter === 'followup'  && item._type !== 'followup')  return false;
        if (typeFilter === 'operation' && item._type !== 'operation') return false;

        if (statusFilter === 'upcoming') {
            if (item._type === 'booking' || item._type === 'followup')
                return ['pending', 'confirmed', 'in-progress'].includes(item.status);
            if (item._type === 'walkin') {
                if (!['waiting', 'in-progress'].includes(item.status)) return false;
                const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
                return new Date(item._date) >= midnight;
            }
            if (item._type === 'operation') return item.status === 'scheduled';
            return false;
        }
        if (statusFilter === 'completed') {
            if (item._type === 'booking' || item._type === 'followup') return item.status === 'completed';
            return item.status === 'done';
        }
        if (statusFilter === 'cancelled') return item.status === 'cancelled';
        return true;
    }), [allItems, typeFilter, statusFilter]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const todayActive = useMemo(() => {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end   = new Date(start); end.setDate(end.getDate() + 1);
        return pageItems.filter((item) => {
            if (!item._ts || item._ts < start.getTime() || item._ts >= end.getTime()) return false;
            if (item._type === 'walkin')   return ['waiting', 'in-progress'].includes(item.status);
            if (item._type === 'booking' || item._type === 'followup')
                return ['pending', 'confirmed', 'in-progress'].includes(item.status);
            return false;
        });
    }, [pageItems]);
    const restItems = useMemo(
        () => pageItems.filter((i) => !todayActive.some((a) => a._id === i._id)),
        [pageItems, todayActive]
    );

    const setStatus = (v) => { setStatusFilter(v); setPage(1); };
    const setType   = (v) => { setTypeFilter(v);   setPage(1); };

    const handleCancelSuccess           = (id) => { setBookings((prev) => prev.map((b) => b._id === id ? { ...b, status: 'cancelled' } : b)); syncDashboardCaches(); };
    const handleRescheduleSuccess       = ()   => { fetchAll(); syncDashboardCaches(); };
    const handleRateSuccess             = (id) => setReviewedIds((prev) => new Set([...prev, id]));
    const handleWalkInCancelSuccess     = (id) => { setWalkIns((prev) => prev.map((w) => w._id === id ? { ...w, status: 'cancelled' } : w)); syncDashboardCaches(); };
    const handleWalkInRescheduleSuccess = ()   => { fetchAll(); syncDashboardCaches(); };
    const handleWalkInRateSuccess       = (id) => setReviewedWalkInIds((prev) => new Set([...prev, id]));

    const STATUS_OPTS = [
        { key: 'all',       label: 'الكل'     },
        { key: 'upcoming',  label: 'القادمة'  },
        { key: 'completed', label: 'المكتملة' },
        { key: 'cancelled', label: 'الملغية'  },
    ];

    const TYPE_OPTS = [
        { key: 'all',       label: 'الكل'       },
        { key: 'booking',   label: '📅 حجز'     },
        { key: 'walkin',    label: '🚶 زيارة'    },
        { key: 'followup',  label: '🔄 إعادة كشف'},
        { key: 'operation', label: '🏥 عملية'   },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0b2d20] via-[#103d2a] to-[#1a4d35] font-['Cairo']" dir="rtl">
            <PatientHeader />

            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

                {/* Page title */}
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#1a6b4e] flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-white text-[20px]">calendar_month</span>
                    </div>
                    <div>
                        <h1 className="font-black text-white text-lg leading-tight">مواعيدي</h1>
                        <p className="text-xs text-white/40">كل حجوزاتك وزياراتك في مكان واحد</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                    {/* Status filter */}
                    <div className="flex items-center gap-1 bg-white/[.07] border border-white/[.1] rounded-2xl px-3 py-2">
                        <span className="text-xs font-bold text-white/35 ml-1.5">الحالة:</span>
                        {STATUS_OPTS.map((opt) => (
                            <button key={opt.key} onClick={() => setStatus(opt.key)}
                                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                                    statusFilter === opt.key
                                        ? 'bg-[#1a6b4e] text-white'
                                        : 'text-white/50 hover:bg-white/[.1] hover:text-white'
                                }`}>
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Type filter */}
                    <div className="flex items-center gap-1 bg-white/[.07] border border-white/[.1] rounded-2xl px-3 py-2">
                        <span className="text-xs font-bold text-white/35 ml-1.5">النوع:</span>
                        {TYPE_OPTS.map((opt) => (
                            <button key={opt.key} onClick={() => setType(opt.key)}
                                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                                    typeFilter === opt.key
                                        ? 'bg-[#1a6b4e] text-white'
                                        : 'text-white/50 hover:bg-white/[.1] hover:text-white'
                                }`}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                ) : pageItems.length === 0 ? (
                    <div className="text-center py-20 bg-white/[.05] rounded-2xl border border-white/[.08]">
                        <span className="material-symbols-outlined text-[48px] text-white/20 block mb-3">calendar_month</span>
                        <p className="font-bold text-white/40">لا توجد مواعيد</p>
                        <Link to="/dashboard" className="mt-4 inline-block text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
                            احجز موعداً الآن
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {todayActive.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                                    <span className="text-xs font-bold text-emerald-400 tracking-wide">اليوم</span>
                                </div>
                                <AnimatePresence>
                                    {todayActive.map((item) => {
                                        if (item._type === 'walkin')    return <WalkInCard    key={`w-${item._id}`} item={item} today onCancel={setCancelWalkInItem} onReschedule={setRescheduleWalkInItem} onRate={setRateWalkInItem} reviewedWalkInIds={reviewedWalkInIds} />;
                                        if (item._type === 'operation') return <OperationCard key={`o-${item._id}`} item={item} />;
                                        return <BookingCard key={`b-${item._id}`} booking={item} today reviewedIds={reviewedIds} onRate={setRatingItem} onCancel={setCancelItem} onReschedule={setRescheduleItem} />;
                                    })}
                                </AnimatePresence>
                            </div>
                        )}
                        {restItems.length > 0 && (
                            <div className="space-y-3">
                                {todayActive.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-white/35">مواعيد أخرى</span>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <AnimatePresence>
                                        {restItems.map((item) => {
                                            if (item._type === 'walkin')    return <WalkInCard    key={`w-${item._id}`} item={item} onCancel={setCancelWalkInItem} onReschedule={setRescheduleWalkInItem} onRate={setRateWalkInItem} reviewedWalkInIds={reviewedWalkInIds} />;
                                            if (item._type === 'operation') return <OperationCard key={`o-${item._id}`} item={item} />;
                                            return <BookingCard key={`b-${item._id}`} booking={item} reviewedIds={reviewedIds} onRate={setRatingItem} onCancel={setCancelItem} onReschedule={setRescheduleItem} />;
                                        })}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-2">
                        <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/[.07] border border-white/[.1] text-white/50 hover:border-emerald-400/40 disabled:opacity-30 transition">
                            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                            <button key={p} onClick={() => setPage(p)}
                                className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${
                                    p === page
                                        ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-sm'
                                        : 'bg-white/[.07] border border-white/[.1] text-white/50 hover:border-emerald-400/40'
                                }`}>
                                {p}
                            </button>
                        ))}
                        <button onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/[.07] border border-white/[.1] text-white/50 hover:border-emerald-400/40 disabled:opacity-30 transition">
                            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                        </button>
                    </div>
                )}
            </main>

            <Footer />

            <AnimatePresence>
                {ratingItem            && <RateModal             booking={ratingItem}            onClose={() => setRatingItem(null)}            onSuccess={handleRateSuccess} />}
                {cancelItem            && <CancelModal           booking={cancelItem}            onClose={() => setCancelItem(null)}            onSuccess={handleCancelSuccess} />}
                {rescheduleItem        && <RescheduleModal       booking={rescheduleItem}        onClose={() => setRescheduleItem(null)}        onSuccess={handleRescheduleSuccess} />}
                {cancelWalkInItem      && <CancelWalkInModal     item={cancelWalkInItem}         onClose={() => setCancelWalkInItem(null)}      onSuccess={handleWalkInCancelSuccess} />}
                {rescheduleWalkInItem  && <RescheduleWalkInModal item={rescheduleWalkInItem}     onClose={() => setRescheduleWalkInItem(null)}  onSuccess={handleWalkInRescheduleSuccess} />}
                {rateWalkInItem        && <RateModal             booking={rateWalkInItem}        onClose={() => setRateWalkInItem(null)}        onSuccess={handleWalkInRateSuccess} isWalkIn />}
            </AnimatePresence>
        </div>
    );
}

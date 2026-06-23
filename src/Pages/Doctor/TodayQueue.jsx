/**
 * TodayQueue.jsx
 *
 * Doctor's live queue view for the current day — bookings, walk-ins, and
 * operations sorted by appointment time. Each item advances through its own
 * status lifecycle; bookings open the ClosingNoteModal before completion so the
 * doctor can record a closing note and optional follow-up in one step.
 *
 * All three fetch calls include `?date=<todayISO>` so the server filters by
 * UTC boundaries rather than relying on client-side date comparison. This avoids
 * the edge case where the doctor's local day has changed but UTC has not.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosInstance from '../../api/axiosInstance';
import ShiftDelayButton from '../../components/ShiftDelayButton';
import LateCheckinModal from '../../components/LateCheckinModal';
import { fmtTime } from '../../utils/timeFormat';


const pad = (n) => String(n).padStart(2, '0');
const nowHHMM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
// Uses local calendar date (not UTC) so the queue stays correct after midnight
// local time when UTC is still the previous day (e.g. Egypt at UTC+3).
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

const TYPE_META = {
    booking:   { label: 'حجز أونلاين', bg: 'bg-blue-50',   text: 'text-blue-600',   dot: 'bg-blue-400',   icon: '📅' },
    walkin:    { label: 'زيارة',        bg: 'bg-amber-50',  text: 'text-amber-600',  dot: 'bg-amber-400',  icon: '🚶' },
    operation: { label: 'عملية',        bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-400', icon: '🔬' },
};

const STATUS_MAP = {
    confirmed:    { ar: 'مؤكد',    color: 'text-emerald-600', bg: 'bg-emerald-50' },
    waiting:      { ar: 'انتظار',  color: 'text-amber-600',   bg: 'bg-amber-50'   },
    'in-progress':{ ar: 'جاري',   color: 'text-blue-600',    bg: 'bg-blue-50'    },
    done:         { ar: 'اكتمل',   color: 'text-gray-400',    bg: 'bg-gray-50'    },
    completed:    { ar: 'اكتمل',   color: 'text-gray-400',    bg: 'bg-gray-50'    },
    scheduled:    { ar: 'مجدول',   color: 'text-purple-600',  bg: 'bg-purple-50'  },
    cancelled:    { ar: 'ملغي',    color: 'text-red-400',     bg: 'bg-red-50'     },
};

const DONE_STATUSES = new Set(['done', 'completed', 'cancelled']);

/**
 * AddWalkInForm — inline form for registering an unscheduled patient visit.
 *
 * Loads today's available slots in parallel with the doctor's fee config so
 * the walk-in can be optionally assigned to an existing slot (blocking it from
 * online booking). When no slot is selected the server auto-assigns the first
 * available one; when none exist the visit is recorded with arrival time only.
 */
/**
 * VisitTypeCards — shared selector for "كشف جديد" / "إعادة كشف".
 * Used identically in both regular and force walk-in modes so the logic
 * lives in exactly one place.
 */
function VisitTypeCards({ isFollowUp, onSelect, consultationFee, followUpFee }) {
    const opts = [
        {
            value: false,
            label: 'كشف جديد',
            icon: '🩺',
            fee: consultationFee,
            activeBorder: 'border-emerald-400 bg-emerald-50',
            activeText: 'text-emerald-700',
            activeFee: 'text-emerald-500',
        },
        {
            value: true,
            label: 'إعادة كشف',
            icon: '🔄',
            fee: followUpFee ?? consultationFee,
            activeBorder: 'border-violet-400 bg-violet-50',
            activeText: 'text-violet-700',
            activeFee: 'text-violet-500',
        },
    ];
    return (
        <div>
            <p className="text-xs text-gray-500 mb-2">نوع الزيارة</p>
            <div className="grid grid-cols-2 gap-2">
                {opts.map(opt => {
                    const selected = isFollowUp === opt.value;
                    return (
                        <button
                            key={String(opt.value)}
                            type="button"
                            onClick={() => onSelect(opt.value)}
                            className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all ${
                                selected ? opt.activeBorder : 'border-gray-200 bg-white'
                            }`}
                        >
                            <span className="text-xl">{opt.icon}</span>
                            <span className={`text-xs font-bold ${selected ? opt.activeText : 'text-gray-500'}`}>
                                {opt.label}
                            </span>
                            {opt.fee != null && (
                                <span className={`text-[11px] font-semibold ${selected ? opt.activeFee : 'text-gray-400'}`}>
                                    {opt.fee} جنيه
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function AddWalkInForm({ onAdded, onForceInserted, onClose }) {
    const [mode, setMode]         = useState('regular'); // 'regular' | 'force'
    const [form, setForm]         = useState({ patientName: '', phone: '', complaint: '', slotId: '', date: todayISO(), overrideQueuePosition: 1 });
    const [isFollowUp, setIsFollowUp] = useState(false);
    const [doctorFees, setDoctorFees] = useState({ consultationFee: null, followUpFee: null });
    const [slots, setSlots]       = useState([]);
    const [slotsLoading, setSlotsLoading] = useState(true);
    const [slotsError, setSlotsError]     = useState('');
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState('');
    const [autoFill, setAutoFill] = useState(null);
    const autoFilledRef           = useRef(false);
    const phoneTimerRef           = useRef(null);

    useEffect(() => {
        setForm(f => ({ ...f, patientName: '', phone: '', complaint: '', overrideQueuePosition: 1 }));
        setIsFollowUp(false);
        setAutoFill(null);
        setError('');
        autoFilledRef.current = false;
    }, [mode]);

    // Slots + fees — fees needed for both modes (visit-type cards); slots only rendered in regular mode
    useEffect(() => {
        setSlotsLoading(true);
        if (mode === 'force') {
            axiosInstance.get('/doctors/me')
                .then(meRes => {
                    const p = meRes.data.data;
                    setDoctorFees({ consultationFee: p?.consultationFee ?? null, followUpFee: p?.followUpFee ?? null });
                })
                .catch(() => {})
                .finally(() => setSlotsLoading(false));
            return;
        }
        Promise.all([
            axiosInstance.get(`/doctors/slots/date/${form.date}`),
            axiosInstance.get('/doctors/me'),
        ])
            .then(([slotsRes, meRes]) => {
                const nowMins = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
                const toMins  = (t) => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + m; };
                const isToday = form.date === todayISO();
                const avail = (slotsRes.data.data || []).filter(s =>
                    s.isAvailable && !s.isBooked && (!isToday || toMins(s.startTime) > nowMins())
                );
                setSlots(avail);
                setSlotsError('');
                const p = meRes.data.data;
                setDoctorFees({ consultationFee: p?.consultationFee ?? null, followUpFee: p?.followUpFee ?? null });
            })
            .catch((err) => { setSlotsError(err.response?.data?.message || 'تعذّر تحميل المواعيد'); setSlots([]); })
            .finally(() => setSlotsLoading(false));
    }, [form.date, mode]);  

    useEffect(() => {
        clearTimeout(phoneTimerRef.current);
        const phone = form.phone.trim();
        if (phone.length < 10) {
            if (autoFilledRef.current) { setForm(f => ({ ...f, patientName: '' })); setAutoFill(null); autoFilledRef.current = false; }

            return;
        }
        phoneTimerRef.current = setTimeout(async () => {
            try {
                const { data } = await axiosInstance.get(`/doctors/lookup-patient?phone=${encodeURIComponent(phone)}`);
                if (data.data) { setForm(f => ({ ...f, patientName: data.data.name })); setAutoFill(data.data); autoFilledRef.current = true; }
                else { setAutoFill(null); }
            } catch { /* silent */ }
        }, 500);
        return () => clearTimeout(phoneTimerRef.current);
    }, [form.phone]);  

    const effectiveFee = isFollowUp && doctorFees.followUpFee != null
        ? doctorFees.followUpFee : (doctorFees.consultationFee ?? '—');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.patientName.trim()) { setError('اسم المريض مطلوب'); return; }
        setLoading(true); setError('');
        try {
            if (mode === 'force') {
                // Force-insert: slot is auto-picked server-side from current active slot
                await axiosInstance.post('/doctors/walkin/force-insert', {
                    patientName:           form.patientName.trim(),
                    phone:                 form.phone.trim() || undefined,
                    complaint:             form.complaint.trim() || undefined,
                    overrideQueuePosition: Number(form.overrideQueuePosition),
                    isFollowUp,
                    date:                  form.date,
                });
                onForceInserted?.();
                onClose();
            } else {
                if (!form.phone.trim()) { setError('رقم الهاتف مطلوب'); setLoading(false); return; }
                const { data } = await axiosInstance.post('/doctors/walkin', {
                    patientName: form.patientName,
                    phone:       form.phone,
                    complaint:   form.complaint,
                    date:        form.date,
                    slotId:      form.slotId || undefined,
                    isFollowUp,
                });
                onAdded(data.data);
                onClose();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'حدث خطأ');
        } finally {
            setLoading(false);
        }
    };
    const isForce = mode === 'force';

    return (
        <motion.div
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className={`rounded-2xl border p-5 mb-4 shadow-sm transition-colors ${
                isForce
                    ? 'border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50'
                    : 'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50'
            }`}
        >
             {/* Header + mode toggle */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{isForce ? '⚡' : '🚶'}</span>
                    <h3 className={`font-black transition-colors ${isForce ? 'text-rose-800' : 'text-amber-800'}`}>
                        {isForce ? 'تسكين في الموعد الحالي' : 'تسجيل زيارة مريض'}
                    </h3>
                </div>
                <div className="flex bg-white rounded-xl p-0.5 border border-gray-200 shadow-sm gap-0.5">
                    <button type="button" onClick={() => setMode('regular')}
                        className={`px-3 py-1.5 rounded-[10px] text-xs font-bold transition-all ${
                            !isForce ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-400 hover:text-amber-600'
                        }`}>
                        🚶 عادي
                    </button>
                    <button type="button" onClick={() => setMode('force')}
                        className={`px-3 py-1.5 rounded-[10px] text-xs font-bold transition-all ${
                            isForce ? 'bg-rose-500 text-white shadow-sm' : 'text-gray-400 hover:text-rose-600'
                        }`}>
                        ⚡ تسكين فوري
                    </button>
                </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <input
                            className={`input-field w-full ${autoFill ? 'border-emerald-300 bg-emerald-50/40' : ''}`}
                            placeholder="اسم المريض *"
                            value={form.patientName}
                            onChange={(e) => { setForm(f => ({ ...f, patientName: e.target.value })); if (autoFilledRef.current) { setAutoFill(null); autoFilledRef.current = false; } }}
                        />
                        {autoFill && (
                            <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
                                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                {autoFill.source === 'registered' ? 'مسجّل على المنصة' : 'من سجلاتك السابقة'}
                            </p>
                        )}
                    </div>
                    <input
                        className="input-field"
                        placeholder={isForce ? 'رقم الهاتف (اختياري)' : 'رقم الهاتف *'}
                        value={form.phone}
                        onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    />
                </div>
                {/* ── Force mode extras ── */}
                {isForce && (
                    <>
                        {/* Complaint — inline with the force form, same width as name/phone fields */}
                        <input
                            className="input-field w-full"
                            placeholder="الشكوى (اختياري)"
                            value={form.complaint}
                            onChange={(e) => setForm(f => ({ ...f, complaint: e.target.value }))}
                        />

                        {/* Visit type */}
                        <VisitTypeCards
                            isFollowUp={isFollowUp}
                            onSelect={setIsFollowUp}
                            consultationFee={doctorFees.consultationFee}
                            followUpFee={doctorFees.followUpFee}
                        />

                        {/* Queue position */}
                        <div>
                            <p className="text-xs font-bold text-gray-600 mb-2">الترتيب في الطابور الحالي</p>
                            <div className="flex gap-2">
                                {[
                                    { n: 1, label: 'الأول' },
                                    { n: 2, label: 'الثاني' },
                                    { n: 3, label: 'الثالث' },
                                ].map(({ n, label }) => (
                                    <button
                                        key={n}
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, overrideQueuePosition: n }))}
                                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                                            form.overrideQueuePosition === n
                                                ? 'bg-rose-500 text-white shadow-md scale-105'
                                                : 'bg-white text-gray-500 border border-gray-200 hover:border-rose-300 hover:text-rose-600'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <p className="text-xs text-amber-700 leading-relaxed">
                                ⚠️ سيدخل المريض في <strong>الموعد الحالي النشط</strong> مباشرةً ويُرسَل تحديث تلقائي لجميع المرضى الباقين في الطابور.
                            </p>
                        </div>
                    </>
                )}

                {/* ── Regular mode extras ── */}
                {!isForce && (
                    <>
                        {/* 2-col: complaint + date/fee — mirrors the patient name/phone row above */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">الشكوى</label>
                                <input
                                    className="input-field w-full"
                                    placeholder="الشكوى (اختياري)"
                                    value={form.complaint}
                                    onChange={(e) => setForm(f => ({ ...f, complaint: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">تاريخ الزيارة</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={form.date}
                                    min={todayISO()}
                                    onChange={(e) => setForm(f => ({ ...f, date: e.target.value, slotId: '' }))}
                                />
                                <p className="text-[11px] text-gray-400 mt-1">
                                    سعر الجلسة: <span className="font-bold text-gray-600">{effectiveFee}{typeof effectiveFee === 'number' ? ' جنيه' : ''}</span>
                                </p>
                            </div>
                        </div>

                        <VisitTypeCards
                            isFollowUp={isFollowUp}
                            onSelect={setIsFollowUp}
                            consultationFee={doctorFees.consultationFee}
                            followUpFee={doctorFees.followUpFee}
                        />

                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">
                                تعيين موعد
                                <span className="text-amber-500 font-semibold mr-1">(اختياري — سيُعيَّن تلقائياً لأول موعد فاضي)</span>
                            </label>
                            {slotsLoading ? (
                                <div className="input-field text-gray-400 text-sm">جاري تحميل المواعيد...</div>
                            ) : slotsError ? (
                                <div className="input-field text-red-400 text-sm">{slotsError}</div>
                            ) : (
                                <select className="input-field" value={form.slotId}
                                    onChange={(e) => setForm(f => ({ ...f, slotId: e.target.value }))}>
                                    <option value="">— تعيين تلقائي لأول موعد فاضي —</option>
                                    {slots.map(s => (
                                        <option key={s._id} value={s._id}>{fmtTime(s.startTime)} – {fmtTime(s.endTime)}</option>
                                    ))}
                                </select>
                            )}
                            {!slotsLoading && !slotsError && slots.length === 0 && (
                                <p className="text-[11px] text-amber-500 mt-1">لا توجد مواعيد فاضية اليوم — سيُسجَّل بوقت الوصول فقط</p>
                            )}
                        </div>
                    </>
                )}

                {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}

                <div className="flex gap-2 justify-end pt-1">
                    <button type="button" onClick={onClose} className="btn-secondary">إلغاء</button>
                    <button type="submit" disabled={loading}
                         className={`px-5 py-2.5 text-white text-sm font-bold rounded-xl transition disabled:opacity-50 ${
                            isForce ? 'bg-rose-500 hover:bg-rose-600' : 'bg-amber-500 hover:bg-amber-600'
                        }`}>
                        {loading ? 'جاري الحفظ...' : isForce ? '⚡ تسكين فوري' : 'تسجيل'}
                    </button>
                </div>
            </form>
        </motion.div>
    );
}

/**
 * AddOperationForm — inline form for scheduling a surgery or procedure.
 * Overlapping slots for the operation's time range are automatically closed
 * by the server so they cannot be booked online during the operation window.
 */
function AddOperationForm({ onAdded, onClose }) {
    const [form, setForm] = useState({
        patientName: '', phone: '', operationType: '',
        date: todayISO(), time: nowHHMM(), duration: '60', location: '', notes: '', fee: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');
    const [autoFill, setAutoFill] = useState(null);
    const autoFilledRef           = useRef(false);
    const phoneTimerRef           = useRef(null);

    useEffect(() => {
        clearTimeout(phoneTimerRef.current);
        const phone = form.phone.trim();
        if (phone.length < 10) {
            if (autoFilledRef.current) {
                setForm(f => ({ ...f, patientName: '' }));
                setAutoFill(null);
                autoFilledRef.current = false;
            }
            return;
        }
        phoneTimerRef.current = setTimeout(async () => {
            try {
                const { data } = await axiosInstance.get(`/doctors/lookup-patient?phone=${encodeURIComponent(phone)}`);
                if (data.data) {
                    setForm(f => ({ ...f, patientName: data.data.name }));
                    setAutoFill(data.data);
                    autoFilledRef.current = true;
                } else {
                    setAutoFill(null);
                }
            } catch { /* silent */ }
        }, 500);
        return () => clearTimeout(phoneTimerRef.current);
    }, [form.phone]);  

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.patientName.trim() || !form.operationType.trim()) {
            setError('اسم المريض ونوع العملية مطلوبان'); return;
        }
        if (!form.phone.trim()) { setError('رقم الهاتف مطلوب'); return; }
        setLoading(true); setError('');
        try {
            const { data } = await axiosInstance.post('/doctors/operations', { ...form, duration: Number(form.duration), fee: Number(form.fee) || 0 });
            onAdded(data.data);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'حدث خطأ');
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 p-5 mb-4 shadow-sm"
        >
            <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🔬</span>
                <h3 className="font-black text-purple-800">جدولة عملية</h3>
                <span className="text-[11px] text-purple-500 mr-auto">المواعيد المتداخلة ستُغلق تلقائياً</span>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <input
                            className={`input-field w-full ${autoFill ? 'border-emerald-300 bg-emerald-50/40' : ''}`}
                            placeholder="اسم المريض *"
                            value={form.patientName}
                            onChange={(e) => {
                                setForm(f => ({ ...f, patientName: e.target.value }));
                                if (autoFilledRef.current) { setAutoFill(null); autoFilledRef.current = false; }
                            }}
                        />
                        {autoFill && (
                            <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
                                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                {autoFill.source === 'registered' ? 'مسجّل على المنصة' : 'من سجلاتك السابقة'}
                            </p>
                        )}
                    </div>
                    <input className="input-field" placeholder="رقم الهاتف *" value={form.phone}
                        onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <input className="input-field" placeholder="نوع العملية *" value={form.operationType}
                        onChange={(e) => setForm(f => ({ ...f, operationType: e.target.value }))} />
                    <input className="input-field" placeholder="مكان العملية / المستشفى" value={form.location}
                        onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <input className="input-field" type="date" value={form.date}
                        min={todayISO()}
                        onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
                    <input className="input-field" type="time" value={form.time}
                        onChange={(e) => setForm(f => ({ ...f, time: e.target.value }))} />
                    <select className="input-field" value={form.duration}
                        onChange={(e) => setForm(f => ({ ...f, duration: e.target.value }))}>
                        {[30, 45, 60, 90, 120, 180, 240].map(d => (
                            <option key={d} value={d}>{d < 60 ? `${d} دقيقة` : `${d / 60} ساعة`}</option>
                        ))}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <textarea className="input-field resize-none" rows={2} placeholder="ملاحظات قبل العملية"
                        value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
                    <input className="input-field" type="number" min="0" placeholder="تكلفة العملية (جنيه)"
                        value={form.fee} onChange={(e) => setForm(f => ({ ...f, fee: e.target.value }))} />
                </div>
                {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
                <div className="flex gap-2 justify-end pt-1">
                    <button type="button" onClick={onClose} className="btn-secondary">إلغاء</button>
                    <button type="submit" disabled={loading}
                        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
                        {loading ? 'جاري الحفظ...' : 'جدولة'}
                    </button>
                </div>
            </form>
        </motion.div>
    );
}

/**
 * ConfirmDeleteModal — shared confirmation dialog for booking cancellation,
 * walk-in removal, and operation deletion. The action label and icon adapt to
 * item._type so the doctor sees context-appropriate copy for each case.
 */
function ConfirmDeleteModal({ item, onConfirm, onClose, loading }) {
    const isOperation = item._type === 'operation';
    return (
        <motion.div
            key="confirm-delete-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
        >
            <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                className="bg-white rounded-2xl p-7 max-w-sm w-full shadow-2xl text-center"
                dir="rtl"
            >
                <span className="material-symbols-outlined text-[40px] text-red-400 mb-3 block">
                    {isOperation ? 'delete' : 'cancel'}
                </span>
                <h3 className="font-black text-[#191c1c] text-lg mb-1">
                    {isOperation ? 'تأكيد الحذف' : 'تأكيد الإلغاء'}
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                    {isOperation
                        ? 'هل أنت متأكد من حذف هذه العملية؟'
                        : 'هل أنت متأكد من إلغاء هذا الحجز؟ لا يمكن التراجع عن هذا الإجراء.'}
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="flex-1 bg-red-500 text-white font-bold py-3 rounded-2xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        {isOperation ? 'نعم، حذف' : 'نعم، إلغاء'}
                    </button>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-2xl hover:bg-gray-50 transition-colors disabled:opacity-40"
                    >
                        رجوع
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

/**
/**
 * WalkInClosingModal — mirrors ClosingNoteModal for walk-in visits.
 *
 * Shown when the doctor advances a walk-in from "in-progress" to "done".
 * Saves notes and an optional follow-up schedule in a single PATCH, then
 * marks the walk-in as done.
 */
export function WalkInClosingModal({ walkIn, onClose, onDone }) {
    const [note,     setNote]     = useState(walkIn.notes || '');
    const [followUp, setFollowUp] = useState(false);
    const [days,     setDays]     = useState(3);
    const [saving,   setSaving]   = useState(false);

    const complete = async () => {
        setSaving(true);
        try {
            const { data } = await axiosInstance.patch(`/doctors/walkin/${walkIn._id}`, {
                status:   'done',
                notes:    note,
                followUp: { enabled: followUp, daysAfter: days },
            });
            onDone(walkIn._id, data.data?.status || 'done');
            onClose();
        } catch {
            /* swallow — axiosInstance interceptor already logs */
        } finally {
            setSaving(false);
        }
    };

    return (
        <motion.div
            key="walkin-closing-bg"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <motion.div
                initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
                className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
                dir="rtl"
            >
                <h3 className="font-black text-[#134e3a] text-lg mb-0.5">ملاحظة الإغلاق</h3>
                <p className="text-xs text-gray-400 mb-4">{walkIn.patientName}</p>

                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={4}
                    placeholder="تشخيص، توصيات، وصفة... (اختياري)"
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />

                <div className="mt-4 flex items-center gap-3" dir="ltr">
                    <button
                        type="button"
                        onClick={() => setFollowUp(!followUp)}
                        className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${followUp ? 'bg-emerald-500' : 'bg-gray-200'}`}
                    >
                        <span className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${followUp ? 'translate-x-4' : ''}`} />
                    </button>
                    <span className="text-sm font-semibold text-gray-700">إعادة كشف بعد</span>
                    {followUp && (
                        <select
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                            className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm bg-white"
                        >
                            {[1, 2, 3, 5, 7, 10, 14, 30].map(d => (
                                <option key={d} value={d}>{d} يوم</option>
                            ))}
                        </select>
                    )}
                </div>

                <button
                    onClick={complete}
                    disabled={saving}
                    className="w-full mt-5 bg-amber-500 text-white font-bold py-3 rounded-2xl hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                    {saving ? 'جاري الحفظ...' : 'حفظ وإنهاء'}
                </button>
            </motion.div>
        </motion.div>
    );
}

/**
 * ClosingNoteModal — combined closing note + booking completion form.
 *
 * Presented when the doctor advances a booking to "completed". The doctor can
 * save a free-text note and an optional follow-up schedule in one action, or
 * skip the note and complete immediately via the secondary button.
 */
export function ClosingNoteModal({ booking, onClose, onDone }) {
    const [note, setNote]         = useState('');
    const [followUp, setFollowUp] = useState(false);
    const [days, setDays]         = useState(3);
    const [saving, setSaving]     = useState(false);

    const complete = async (withNote) => {
        setSaving(true);
        try {
            if (withNote) {
                await axiosInstance.patch(`/bookings/${booking._id}/notes`, {
                    closingNote: note,
                    followUp: { enabled: followUp, daysAfter: days },
                });
            }
            await axiosInstance.patch(`/bookings/${booking._id}/complete`, {});
            onDone(booking._id);
            onClose();
        } catch {
            /* swallow — axiosInstance interceptor already logs */
        } finally {
            setSaving(false);
        }
    };

    return (
        <motion.div
            key="closing-modal-bg"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <motion.div
                initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
                className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
                dir="rtl"
            >
                <h3 className="font-black text-[#134e3a] text-lg mb-0.5">ملاحظة الإغلاق</h3>
                <p className="text-xs text-gray-400 mb-4">{booking.patientName}</p>

                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={4}
                    placeholder="تشخيص، توصيات، وصفة... (اختياري)"
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />

                <div className="mt-4 flex items-center gap-3" dir="ltr">
                    <button
                        type="button"
                        onClick={() => setFollowUp(!followUp)}
                        className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${followUp ? 'bg-emerald-500' : 'bg-gray-200'}`}
                    >
                        <span className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${followUp ? 'translate-x-4' : ''}`} />
                    </button>
                    <span className="text-sm font-semibold text-gray-700">إعادة كشف بعد</span>
                    {followUp && (
                        <select
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                            className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm bg-white"
                        >
                            {[1, 2, 3, 5, 7, 10, 14, 30].map(d => (
                                <option key={d} value={d}>{d} يوم</option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="flex gap-3 mt-5">
                    <button
                        onClick={() => complete(true)}
                        disabled={saving}
                        className="flex-1 bg-[#134e3a] text-white font-bold py-3 rounded-2xl hover:bg-[#0d3829] transition-colors disabled:opacity-50"
                    >
                        {saving ? 'جاري الحفظ...' : 'حفظ وإنهاء'}
                    </button>
                    <button
                        onClick={() => complete(false)}
                        disabled={saving}
                        className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-2xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        إنهاء بدون ملاحظة
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

/**
 * QueueRow — one item in the today queue. Handles the status-advance action
 * inline: bookings open ClosingNoteModal before completion; walk-ins and
 * operations are advanced directly via PATCH to their respective endpoints.
 */
function QueueRow({ item, onStatusChange, onOpenClosingNote, onOpenWalkInClosing, onRequestDelete, onLateCheckin, nowTime }) {
    const meta       = TYPE_META[item._type];
    const statusInfo = STATUS_MAP[item.status] || { ar: item.status, color: 'text-gray-500', bg: 'bg-gray-50' };
    const [updating,  setUpdating]  = useState(false);
    const [reminding, setReminding] = useState(false);
    const [reminded,  setReminded]  = useState(false);
    const isDone = DONE_STATUSES.has(item.status);

    const handleRemind = async () => {
        if (reminding || reminded) return;
        setReminding(true);
        try {
            await axiosInstance.post(`/bookings/${item._id}/remind`);
            setReminded(true);
            setTimeout(() => setReminded(false), 5_000);
        } catch {
            /* swallow */
        } finally {
            setReminding(false);
        }
    };

    const NEXT_LABEL = {
        confirmed:    'ابدأ الكشف',
        'in-progress':'أنهِ الكشف',
        waiting:      'ابدأ الكشف',
        scheduled:    'تم التنفيذ',
    };

    const NEXT_STATUS = {
        booking:   { confirmed: 'in-progress', 'in-progress': 'completed' },
        walkin:    { waiting: 'in-progress', 'in-progress': 'done' },
        operation: { scheduled: 'done' },
    };

    const nextStatus = NEXT_STATUS[item._type]?.[item.status];

    const advance = async () => {
        if (!nextStatus || updating) return;
        // Booking in-progress → open closing note modal
        if (item._type === 'booking' && item.status === 'in-progress') {
            onOpenClosingNote(item);
            return;
        }
        // Walk-in in-progress → open walk-in closing modal
        if (item._type === 'walkin' && item.status === 'in-progress') {
            onOpenWalkInClosing(item);
            return;
        }
        setUpdating(true);
        try {
            let endpoint, body;
            if (item._type === 'booking') {
                // confirmed → in-progress
                endpoint = `/bookings/${item._id}/start`;
                body = {};
            } else if (item._type === 'walkin') {
                endpoint = `/doctors/walkin/${item._id}`;
                body = { status: nextStatus };
            } else {
                endpoint = `/doctors/operations/${item._id}`;
                body = { status: nextStatus };
            }
            const { data } = await axiosInstance.patch(endpoint, body);
            onStatusChange(item._id, item._type, data.data?.status || nextStatus);
        } catch {
            /* swallow — axiosInstance interceptor already logs */
        } finally {
            setUpdating(false);
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: isDone ? 0.55 : 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
                isDone
                    ? 'bg-gray-50 border-gray-100'
                    : item._type === 'operation'
                        ? 'bg-white border-purple-100 shadow-sm'
                        : item._type === 'walkin'
                            ? 'bg-white border-amber-100 shadow-sm'
                            : 'bg-white border-gray-100 shadow-sm'
            }`}
        >
            <div className={`w-14 text-center shrink-0 rounded-xl py-1.5 ${meta.bg}`}>
                <p className={`text-xs font-black font-mono ${meta.text}`}>{fmtTime(item._time) || '--:--'}</p>
            </div>

            <div className="flex flex-col items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-[#191c1c] text-sm truncate">{item.patientName}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.bg} ${meta.text} shrink-0`}>
                        {meta.icon} {meta.label}
                    </span>
                    {item.isFollowUp && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 shrink-0">
                            🔄 إعادة كشف
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                    {item.complaint   && <p className="text-[11px] text-gray-400 truncate">{item.complaint}</p>}
                    {item.operationType && <p className="text-[11px] text-gray-400 truncate">{item.operationType}</p>}
                    {item._type === 'booking' && item.phone && (
                        <p className="text-[11px] text-gray-400">📞 {item.phone}</p>
                    )}
                    {item._type === 'operation' && item.location && (
                        <p className="text-[11px] text-gray-400">📍 {item.location}</p>
                    )}
                    {item._type === 'walkin' && item.phone && (
                        <p className="text-[11px] text-gray-400">📞 {item.phone}</p>
                    )}
                </div>
            </div>

            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full shrink-0 ${statusInfo.bg} ${statusInfo.color}`}>
                {statusInfo.ar}
            </span>

            <div className="flex items-center gap-1.5 shrink-0">
                {nextStatus && !isDone && (
                    <button onClick={advance} disabled={updating}
                        className={`text-xs px-3 py-1.5 rounded-xl font-bold transition disabled:opacity-50 ${
                            item._type === 'operation'
                                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                : item._type === 'walkin'
                                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                    : 'bg-[#134e3a] hover:bg-[#0d3829] text-white'
                        }`}>
                        {updating ? '...' : NEXT_LABEL[item.status] || 'تقدم'}
                    </button>
                )}
                {item._type === 'booking' && !isDone && (
                    <button
                        onClick={handleRemind}
                        disabled={reminding || reminded}
                        title="إرسال إشعار تذكير للمريض"
                        className={`w-7 h-7 flex items-center justify-center rounded-xl transition disabled:opacity-40 ${
                            reminded
                                ? 'text-emerald-500 bg-emerald-50'
                                : 'text-sky-400 hover:text-sky-600 hover:bg-sky-50'
                        }`}
                    >
                        {reminding
                            ? <span className="w-3.5 h-3.5 border-2 border-sky-300 border-t-sky-500 rounded-full animate-spin" />
                            : <span className="material-symbols-outlined text-[16px]">
                                {reminded ? 'check_circle' : 'notifications'}
                              </span>
                        }
                    </button>
                )}
                                {(item._type === 'booking' || item._type === 'walkin')
                    && !isDone
                    && item.status !== 'in-progress'
                    && (nowTime ?? nowHHMM()) >= (item._time || '00:00')
                    && (
                    <button
                        onClick={() => onLateCheckin?.(item)}
                        title="تسجيل دخول متأخر"
                        className="text-[11px] px-2 py-1 rounded-xl font-bold transition bg-orange-50 text-orange-500 hover:bg-orange-100 border border-orange-200 shrink-0"
                    >
                        ⏱ متأخر
                    </button>
                )}
                {!isDone && (
                    <button onClick={() => onRequestDelete(item)}
                        className="w-7 h-7 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition text-sm">
                        ✕
                    </button>
                )}
            </div>
        </motion.div>
    );
}

export default function TodayQueue({ doctorName, isSecretary, onDataChange, onOpenDrawer }) {
    const [bookings,       setBookings]       = useState([]);
    const [walkIns,        setWalkIns]        = useState([]);
    const [operations,     setOperations]     = useState([]);
    const [loading,        setLoading]        = useState(true);
    const [showWalkIn,     setShowWalkIn]     = useState(false);
    const [showOp,         setShowOp]         = useState(false);
    const [showLateCheckin,    setShowLateCheckin]    = useState(false);
    const [selectedLateEntry,  setSelectedLateEntry]  = useState(null);
    const [shiftDelay,         setShiftDelay]         = useState(0);
    const [closingItem,       setClosingItem]       = useState(null);
    const [walkInClosingItem, setWalkInClosingItem] = useState(null);
    const [lastRefresh,    setLastRefresh]    = useState(Date.now());
    const [pendingDelete,  setPendingDelete]  = useState(null);
    const [deleteLoading,  setDeleteLoading]  = useState(false);
    const [nowTime,        setNowTime]        = useState(nowHHMM());

    // Refresh current time every 30 s so the "متأخر" button appears automatically
    // when an appointment's scheduled time arrives without requiring a page interaction.
    useEffect(() => {
        const t = setInterval(() => setNowTime(nowHHMM()), 30_000);
        return () => clearInterval(t);
    }, []);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const today = todayISO();
            const [bRes, wRes, oRes] = await Promise.all([
                // Pass ?date= so the backend filters to today only (server-side,
                // timezone-safe via UTC boundaries).  This also fixes the edge case
                // where the doctor has >200 total bookings and today's would be
                // pushed off the list by the old ASC sort + 200-item limit.
                axiosInstance.get(`/bookings/doctor?limit=200&date=${today}`),
                axiosInstance.get(`/doctors/walkin?date=${today}`),
                axiosInstance.get(`/doctors/operations?date=${today}`),
            ]);

            setBookings(bRes.data.data || []);
            setWalkIns(wRes.data.data || []);
            setOperations(oRes.data.data || []);
        } catch {
            /* swallow — axiosInstance interceptor already logs */
        } finally {
            setLoading(false);
            setLastRefresh(Date.now());
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── Build & sort queue ────────────────────────────────────────────────────
    // Force-inserted walk-ins carry an overrideQueuePosition (1/2/3…) that
    // determines where they appear among active patients.  All other items are
    // sorted by their scheduled/arrival time as before.
    const _allItems = [
        ...bookings.map(b => ({
            ...b, _type: 'booking',
            patientName: b.patient?.name || 'مريض',
            phone: b.patient?.phone || null,
            _time: b.slotDetails?.startTime,
        })),
        ...walkIns.map(w    => ({ ...w, _type: 'walkin',    _time: w.arrivalTime })),
        ...operations.map(o => ({ ...o, _type: 'operation', _time: o.time })),
    ];

    // Separate items with an override position (force-inserts + late check-ins) from the rest
    const _regular = _allItems.filter(i => i.overrideQueuePosition == null);
    const _forced  = _allItems.filter(i => i.overrideQueuePosition != null);

    // Sort regular items by scheduled/arrival time
    _regular.sort((a, b) => (a._time || '').localeCompare(b._time || ''));

    // Split regular into active/done so we insert force items into the right section
    const _regActive = _regular.filter(i => !DONE_STATUSES.has(i.status));
    const _regDone   = _regular.filter(i =>  DONE_STATUSES.has(i.status));

    // Split force items into active/done
    const _forActive = _forced.filter(i => !DONE_STATUSES.has(i.status))
        .sort((a, b) => (a.overrideQueuePosition || 1) - (b.overrideQueuePosition || 1));
    const _forDone   = _forced.filter(i =>  DONE_STATUSES.has(i.status));

    // Splice each active force-inserted patient into the position they were assigned
    // (1-indexed, clamped so it never goes out of bounds)
    _forActive.forEach(fi => {
        const idx = Math.min((fi.overrideQueuePosition || 1) - 1, _regActive.length);
        _regActive.splice(idx, 0, fi);
    });

    // Final queue: active first (with force items in the right spots), then done
    const queue    = [..._regActive, ..._forDone, ..._regDone];
    const active   = queue.filter(i => !DONE_STATUSES.has(i.status));
    const finished = queue.filter(i =>  DONE_STATUSES.has(i.status) && i.status !== 'cancelled');
    const cancelled = queue.filter(i => i.status === 'cancelled');
    const done       = [...finished, ...cancelled];

    const revenue = [
        ...bookings.filter(b => b.status === 'completed').map(b => b.consultationFee || 0),
        ...walkIns.filter(w  => w.status === 'done').map(w => w.fee || 0),
        ...operations.filter(o => o.status === 'done').map(o => o.fee || 0),
    ].reduce((s, v) => s + v, 0);

    const onStatusChange = (id, type, newStatus) => {
        if (type === 'booking')   setBookings(bs   => bs.map(b => b._id === id ? { ...b, status: newStatus } : b));
        if (type === 'walkin')    setWalkIns(ws    => ws.map(w => w._id === id ? { ...w, status: newStatus } : w));
        if (type === 'operation') setOperations(os => os.map(o => o._id === id ? { ...o, status: newStatus } : o));
        onDataChange?.();
    };

    const onDelete = (id, type) => {
        if (type === 'walkin')    setWalkIns(ws    => ws.filter(w => w._id !== id));
        if (type === 'operation') setOperations(os => os.filter(o => o._id !== id));
        onDataChange?.();
    };

    const handleConfirmDelete = async () => {
        if (!pendingDelete) return;
        const item = pendingDelete;
        setDeleteLoading(true);
        try {
            if (item._type === 'booking') {
                await axiosInstance.patch(`/bookings/${item._id}/cancel`);
                onStatusChange(item._id, 'booking', 'cancelled');
            } else if (item._type === 'walkin') {
                await axiosInstance.delete(`/doctors/walkin/${item._id}`);
                onStatusChange(item._id, 'walkin', 'cancelled');
            } else if (item._type === 'operation') {
                await axiosInstance.delete(`/doctors/operations/${item._id}`);
                onDelete(item._id, 'operation');
            }
            setPendingDelete(null);
        } catch {
            /* swallow — axiosInstance interceptor already logs */
        } finally {
            setDeleteLoading(false);
        }
    };

    const todayArabic = new Date().toLocaleDateString('ar-EG', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    const nextActive = active[0];

    return (
        <div className="space-y-5">

            <div className="rounded-3xl bg-gradient-to-br from-[#134e3a] to-[#1a6b50] text-white p-6 shadow-lg">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-emerald-200 text-sm font-semibold">{todayArabic}</p>
                        <h2 className="text-2xl font-black mt-1">
                            {doctorName ? `مرحباً، ${isSecretary ? '' : 'د. '}${doctorName} 👋` : 'لوحة اليوم'}
                        </h2>
                        {nextActive ? (
                            <p className="text-emerald-200 text-sm mt-1">
                                التالي: <span className="text-white font-bold">{nextActive.patientName}</span>
                                {nextActive._time && <span> الساعة {fmtTime(nextActive._time)}</span>}
                            </p>
                        ) : (
                            <p className="text-emerald-200 text-sm mt-1">لا يوجد مرضى قيد الانتظار ✓</p>
                        )}
                    </div>
                    <button onClick={fetchAll}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition text-white text-sm"
                        title="تحديث">
                        🔄
                    </button>
                </div>

                <div className="grid grid-cols-4 gap-3 mt-5">
                    {[
                        { icon: '📅', label: 'حجوزات',    value: bookings.length,    sub: `${bookings.filter(b => b.status === 'completed').length} مكتمل` },
                        { icon: '🚶', label: 'زيارة',      value: walkIns.length,     sub: `${walkIns.filter(w => w.status === 'done').length} انتهى` },
                        { icon: '🔬', label: 'عمليات',    value: operations.length,  sub: `${operations.filter(o => o.status === 'done').length} تم` },
                        { icon: '💰', label: 'الإيراد',   value: `${revenue}`, sub: 'جنيه اليوم' },
                    ].map(s => (
                        <div key={s.label} className="bg-white/10 backdrop-blur rounded-2xl p-3 text-center">
                            <p className="text-lg">{s.icon}</p>
                            <p className="text-xl font-black">{s.value}</p>
                            <p className="text-[10px] text-emerald-200">{s.label}</p>
                            <p className="text-[9px] text-emerald-300 mt-0.5">{s.sub}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap gap-3">
                <button
                    onClick={() => { setShowWalkIn(v => !v); setShowOp(false); }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
                        showWalkIn
                            ? 'bg-amber-500 text-white'
                            : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                    }`}>
                    🚶 تسجيل زيارة
                </button>
                <button
                    onClick={() => { setShowOp(v => !v); setShowWalkIn(false); }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
                        showOp
                            ? 'bg-purple-600 text-white'
                            : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                    }`}>
                    🔬 جدولة عملية
                </button>
     
                <ShiftDelayButton currentDelay={shiftDelay} onShifted={setShiftDelay} />
            </div>

            <AnimatePresence>
                {showWalkIn && (
                    <AddWalkInForm
                        key="wi"
                        onAdded={(item) => {
                            // Only add to the current queue if the walk-in is for today;
                            // future-dated walk-ins belong to that day's queue, not today's.
                            if (item?.date && item.date.slice(0, 10) === todayISO()) {
                                setWalkIns(w => [item, ...w]);
                            }
                            onDataChange?.();
                        }}
                            onForceInserted={() => {
                            fetchAll();
                            onDataChange?.();
                        }}
                        onClose={() => setShowWalkIn(false)}
                    />
                )}
                {showOp && (
                    <AddOperationForm
                        key="op"
                        onAdded={(item) => {
                            // Only add to today's queue if the operation is scheduled for today;
                            // future-dated operations belong in the upcoming appointments list instead.
                            if (item?.date && item.date.slice(0, 10) === todayISO()) {
                                setOperations(o => [item, ...o]);
                            }
                            onDataChange?.();
                        }}
                        onClose={() => setShowOp(false)}
                    />
                )}
            </AnimatePresence>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                    <p className="text-sm text-gray-400">جاري تحميل القائمة...</p>
                </div>
            ) : queue.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                    <p className="text-5xl mb-3">📭</p>
                    <p className="font-bold text-gray-400">لا يوجد مرضى اليوم</p>
                    <p className="text-sm text-gray-300 mt-1">يمكنك إضافة زيارة مريض أو جدولة عملية</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {active.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <p className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                    قيد الانتظار والتنفيذ — {active.length}
                                </p>
                            </div>
                            <AnimatePresence>
                                {active.map(item => (
                                    <QueueRow
                                        key={`${item._type}-${item._id}`}
                                        item={item}
                                        nowTime={nowTime}
                                        onStatusChange={onStatusChange}
                                        onDelete={onDelete}
                                        onOpenClosingNote={setClosingItem}
                                        onOpenWalkInClosing={setWalkInClosingItem}
                                        onRequestDelete={setPendingDelete}
                                        onOpenDrawer={onOpenDrawer}
                                        onLateCheckin={(entry) => {
                                            setSelectedLateEntry({
                                                _id:         entry._id,
                                                type:        entry._type,
                                                patientName: entry.patientName,
                                                slotTime:    entry._time,
                                            });
                                            setShowLateCheckin(true);
                                        }}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                    )}

                    {done.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-gray-300" />
                                <p className="text-xs font-black text-gray-400 uppercase tracking-wider">
                                    انتهى — {done.length}
                                </p>
                            </div>
                            <AnimatePresence>
                                {finished.map(item => (
                                    <QueueRow
                                        key={`${item._type}-${item._id}`}
                                        item={item}
                                        onStatusChange={onStatusChange}
                                        onDelete={onDelete}
                                        onOpenClosingNote={setClosingItem}
                                        onOpenWalkInClosing={setWalkInClosingItem}
                                        onRequestDelete={setPendingDelete}
                                        onOpenDrawer={onOpenDrawer}
                                    />
                                ))}
                            </AnimatePresence>
                            {cancelled.length > 0 && (
                                <>
                                    <div className="flex items-center gap-3 pt-1">
                                        <div className="flex-1 h-px bg-gray-200" />
                                        <span className="text-[10px] font-bold text-gray-300 shrink-0">ملغي — {cancelled.length}</span>
                                        <div className="flex-1 h-px bg-gray-200" />
                                    </div>
                                    <AnimatePresence>
                                        {cancelled.map(item => (
                                            <QueueRow
                                                key={`${item._type}-${item._id}`}
                                                item={item}
                                                onStatusChange={onStatusChange}
                                                onDelete={onDelete}
                                                onOpenClosingNote={setClosingItem}
                                                onOpenWalkInClosing={setWalkInClosingItem}
                                                onRequestDelete={setPendingDelete}
                                                onOpenDrawer={onOpenDrawer}
                                            />
                                        ))}
                                    </AnimatePresence>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            <p className="text-center text-[10px] text-gray-300">
                آخر تحديث: {new Date(lastRefresh).toLocaleTimeString('ar-EG')}
            </p>

            <AnimatePresence>
                {closingItem && (
                    <ClosingNoteModal
                        booking={closingItem}
                        onClose={() => setClosingItem(null)}
                        onDone={(id) => {
                            onStatusChange(id, 'booking', 'completed');
                            onDataChange?.();
                        }}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {walkInClosingItem && (
                    <WalkInClosingModal
                        walkIn={walkInClosingItem}
                        onClose={() => setWalkInClosingItem(null)}
                        onDone={(id, status) => {
                            onStatusChange(id, 'walkin', status);
                            onDataChange?.();
                        }}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {pendingDelete && (
                    <ConfirmDeleteModal
                        item={pendingDelete}
                        loading={deleteLoading}
                        onConfirm={handleConfirmDelete}
                        onClose={() => !deleteLoading && setPendingDelete(null)}
                    />
                )}
            </AnimatePresence>


            <LateCheckinModal
                open={showLateCheckin}
                entry={selectedLateEntry}
                totalActive={active.length}
                onClose={() => { setShowLateCheckin(false); setSelectedLateEntry(null); }}
                onCheckedIn={() => {
                    fetchAll();
                    onDataChange?.();
                }}
            />
        </div>
    );
}

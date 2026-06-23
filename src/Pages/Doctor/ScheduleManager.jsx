import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosInstance from '../../api/axiosInstance';
import { fmtTime } from '../../utils/timeFormat';


// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS_AR   = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const DURATIONS = [10, 15, 20, 30, 45, 60];

const toDateKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;


// ─── Mini Calendar ────────────────────────────────────────────────────────────

function MiniCalendar({ year, month, selected, counts, onSelectDay, onPrevMonth, onNextMonth }) {
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = toDateKey(new Date());

    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 select-none">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-5">
                <button onClick={onPrevMonth} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
                    <span className="material-symbols-outlined text-[18px] text-gray-500">chevron_right</span>
                </button>
                <h3 className="font-black text-[#134e3a] text-sm">
                    {MONTHS_AR[month - 1]} {year}
                </h3>
                <button onClick={onNextMonth} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
                    <span className="material-symbols-outlined text-[18px] text-gray-500">chevron_left</span>
                </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
                {DAYS_AR.map((d) => (
                    <div key={d} className="text-center text-[10px] font-bold text-gray-400 pb-1">{d}</div>
                ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-1">
                {cells.map((day, i) => {
                    if (!day) return <div key={`e${i}`} />;
                    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isSelected = selected === key;
                    const isToday    = key === today;
                    const c          = counts[key];
                    const hasSlots   = c && c.total > 0;

                    const isPastDay = key < today;

                    return (
                        <button
                            key={key}
                            onClick={() => onSelectDay(key)}
                            className={`relative flex flex-col items-center justify-center h-9 w-full rounded-xl text-sm font-bold transition-all
                                ${isPastDay  ? 'text-gray-300 hover:bg-gray-50' :
                                  isSelected ? 'bg-[#134e3a] text-white shadow-md' :
                                  isToday    ? 'border-2 border-[#134e3a] text-[#134e3a]' :
                                               'text-gray-700 hover:bg-gray-100'}
                                ${isSelected && isPastDay ? '!bg-gray-200 !text-gray-500 !shadow-none' : ''}`}
                        >
                            {day}
                            {hasSlots && (
                                <span className={`absolute bottom-1 w-1 h-1 rounded-full
                                    ${isSelected && !isPastDay ? 'bg-white' : isPastDay ? 'bg-gray-300' : c.available > 0 ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-50 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/> متاح</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block"/> مغلق</span>
            </div>
        </div>
    );
}

// ─── Slot Row ─────────────────────────────────────────────────────────────────

function SlotRow({ slot, onToggle, onDelete, toggling, deleting, isPastTime }) {
    const isBookedByPatient = slot.isBooked;
    const isDisabled        = !slot.isAvailable && !slot.isBooked;

    return (
        <div className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all
            ${isPastTime        ? 'bg-gray-50 border-gray-100 opacity-50' :
              isBookedByPatient ? 'bg-blue-50 border-blue-100' :
              isDisabled        ? 'bg-gray-50 border-gray-100 opacity-60' :
                                  'bg-white border-gray-100'}`}
        >
            <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full shrink-0
                    ${isPastTime        ? 'bg-gray-300' :
                      isBookedByPatient ? 'bg-blue-500' :
                      isDisabled        ? 'bg-gray-400' :
                                          'bg-emerald-500'}`} />
                <div>
                    <p className="text-sm font-bold text-[#191c1c]">
                        {fmtTime(slot.startTime)} — {fmtTime(slot.endTime)}
                    </p>
                    <p className="text-[11px] text-gray-400">
                        {isPastTime        ? 'انتهى الوقت' :
                         isBookedByPatient ? 'محجوز من مريض' :
                         isDisabled        ? 'معطّل يدوياً'  :
                                             'متاح للحجز'}
                    </p>
                </div>
            </div>

            {/* Hide actions for past unbooked slots — cleanup cron will handle them */}
            {!isBookedByPatient && !isPastTime && (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onToggle(slot._id)}
                        disabled={toggling === slot._id}
                        title={slot.isAvailable ? 'تعطيل الموعد' : 'تفعيل الموعد'}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors
                            ${slot.isAvailable
                                ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                    >
                        <span className="material-symbols-outlined text-[16px]">
                            {toggling === slot._id ? 'hourglass_empty' : slot.isAvailable ? 'block' : 'check_circle'}
                        </span>
                    </button>
                    <button
                        onClick={() => onDelete(slot._id)}
                        disabled={deleting === slot._id}
                        title="حذف الموعد"
                        className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-50 text-red-400 hover:bg-red-100 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[16px]">
                            {deleting === slot._id ? 'hourglass_empty' : 'delete'}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Add Block Form ───────────────────────────────────────────────────────────

function AddBlockForm({ selectedDate, onCreated }) {
    const [form, setForm]       = useState({ startTime: '09:00', endTime: '13:00', duration: 30 });
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const { data } = await axiosInstance.post('/doctors/slots/generate', {
                date:      selectedDate,
                startTime: form.startTime,
                endTime:   form.endTime,
                duration:  Number(form.duration),
            });
            onCreated(data.generated, data.skipped);
        } catch (err) {
            setError(err.response?.data?.message || 'حدث خطأ');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
            <h4 className="font-bold text-[#134e3a] text-sm mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                إضافة فترة عمل
            </h4>

            <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">من</label>
                    <input type="time" value={form.startTime}
                        onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                        className="w-full p-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                </div>
                <div>
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">إلى</label>
                    <input type="time" value={form.endTime}
                        onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
                        className="w-full p-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                </div>
                <div>
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">مدة الكشف</label>
                    <select value={form.duration}
                        onChange={(e) => setForm((p) => ({ ...p, duration: Number(e.target.value) }))}
                        className="w-full p-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                        {DURATIONS.map((d) => <option key={d} value={d}>{d} دقيقة</option>)}
                    </select>
                </div>
            </div>

            {error && (
                <p className="text-xs text-red-500 mb-3 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
            )}

            <button type="submit" disabled={loading}
                className="w-full bg-[#134e3a] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#0d3829] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
                {loading
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> جاري الإنشاء...</>
                    : <><span className="material-symbols-outlined text-[16px]">auto_fix_high</span>إنشاء المواعيد تلقائياً</>
                }
            </button>
        </form>
    );
}

// ─── Main ScheduleManager ─────────────────────────────────────────────────────

export default function ScheduleManager({ isSecretary = false }) {
    const today = new Date();
    const [year,  setYear]  = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [selectedDate, setSelectedDate] = useState(toDateKey(today));

    const [counts,  setCounts]  = useState({});   // { "2025-01-15": { total, booked, available } }
    const [slots,   setSlots]   = useState([]);
    const [operations, setOperations] = useState([]);
    const [walkIns,    setWalkIns]    = useState([]);
    const [bookings,   setBookings]   = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [toggling, setToggling]         = useState(null);
    const [deleting, setDeleting]         = useState(null);
    const [toast, setToast]               = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // ── Fetch month counts ─────────────────────────────────────────────────────
    const fetchCounts = useCallback(async () => {
        try {
            const { data } = await axiosInstance.get(`/doctors/slots/month/${year}/${month}`);
            setCounts(data.data ?? {});
        } catch { /* swallow */ }
    }, [year, month]);

    useEffect(() => { fetchCounts(); }, [fetchCounts]);

    // ── Fetch slots + operations + bookings + walk-ins for selected date ─────────
    const fetchSlots = useCallback(async (date) => {
        setLoadingSlots(true);
        try {
            const [slotsRes, opsRes, walkInsRes, bookingsRes] = await Promise.all([
                axiosInstance.get(`/doctors/slots/date/${date}`),
                axiosInstance.get(`/doctors/operations?date=${date}`),
                axiosInstance.get(`/doctors/walkin?date=${date}`),
                axiosInstance.get(`/bookings/doctor?date=${date}&limit=200`),
            ]);
            setSlots(slotsRes.data.data ?? []);
            setOperations(opsRes.data.data ?? []);
            setWalkIns(walkInsRes.data.data ?? []);
            setBookings(bookingsRes.data.data ?? []);
        } catch { setSlots([]); setOperations([]); setWalkIns([]); setBookings([]); }
        finally { setLoadingSlots(false); }
    }, []);

    useEffect(() => { fetchSlots(selectedDate); }, [selectedDate, fetchSlots]);

    // ── Month navigation ───────────────────────────────────────────────────────
    const prevMonth = () => {
        if (month === 1) { setMonth(12); setYear((y) => y - 1); }
        else setMonth((m) => m - 1);
    };
    const nextMonth = () => {
        if (month === 12) { setMonth(1); setYear((y) => y + 1); }
        else setMonth((m) => m + 1);
    };

    // ── Actions ────────────────────────────────────────────────────────────────
    const handleToggle = async (slotId) => {
        setToggling(slotId);
        try {
            const { data } = await axiosInstance.patch(`/doctors/slots/${slotId}/toggle`);
            setSlots((prev) => prev.map((s) => s._id === slotId ? data.data : s));
            fetchCounts();
            showToast(data.message);
        } catch (err) {
            showToast(err.response?.data?.message || 'حدث خطأ', 'error');
        } finally {
            setToggling(null);
        }
    };

    const handleDelete = async (slotId) => {
        if (!window.confirm('هل تريد حذف هذا الموعد؟')) return;
        setDeleting(slotId);
        try {
            await axiosInstance.delete(`/doctors/slots/${slotId}`);
            setSlots((prev) => prev.filter((s) => s._id !== slotId));
            fetchCounts();
            showToast('تم حذف الموعد');
        } catch (err) {
            showToast(err.response?.data?.message || 'لا يمكن حذف موعد محجوز', 'error');
        } finally {
            setDeleting(null);
        }
    };

    const handleCreated = (generated, skipped) => {
        fetchSlots(selectedDate);
        fetchCounts();
        showToast(`تم إنشاء ${generated} موعد${skipped > 0 ? ` (تم تجاهل ${skipped} موجودة)` : ''}`);
    };

    // ── Date label ─────────────────────────────────────────────────────────────
    const selectedDateLabel = selectedDate
        ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : '';

    const isPastDay      = selectedDate < toDateKey(new Date());
    const todayCounts    = counts[selectedDate];
    const bookingsCount  = bookings.filter(b => b.status !== 'cancelled').length;
    const walkInsCount   = walkIns.filter(w => w.status !== 'cancelled').length;
    const visitsCount    = bookingsCount + walkInsCount;

    return (
        <div className="flex flex-col gap-6 h-full" dir="rtl">

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold text-white
                            ${toast.type === 'error' ? 'bg-red-500' : 'bg-[#134e3a]'}`}
                    >
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">

                {/* ── Left: Calendar ─────────────────────────────────────────── */}
                <div className="flex flex-col gap-4">
                    <MiniCalendar
                        year={year} month={month}
                        selected={selectedDate}
                        counts={counts}
                        onSelectDay={setSelectedDate}
                        onPrevMonth={prevMonth}
                        onNextMonth={nextMonth}
                    />

                    {/* Summary for selected day — hidden from secretary */}
                    {!isSecretary && (todayCounts || operations.length > 0) && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                            <p className="text-xs font-bold text-gray-500 mb-3">ملخص اليوم المختار</p>

                            {/* Stats grid */}
                            {todayCounts && (
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-emerald-50 rounded-xl p-2">
                                        <p className="text-lg font-black text-emerald-700">{todayCounts.available}</p>
                                        <p className="text-[10px] text-gray-500">متاح</p>
                                    </div>
                                    <div className="bg-blue-50 rounded-xl p-2">
                                        <p className="text-lg font-black text-blue-700">{visitsCount}</p>
                                        <p className="text-[10px] text-gray-500">زيارات</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-2">
                                        <p className="text-lg font-black text-gray-500">{todayCounts.disabled}</p>
                                        <p className="text-[10px] text-gray-500">معطّل</p>
                                    </div>
                                </div>
                            )}

                            {/* Scheduled operations inside summary panel */}
                            {operations.length > 0 && (
                                <div className={todayCounts ? 'mt-3 pt-3 border-t border-gray-100' : ''}>
                                    <p className="text-[10px] font-bold text-purple-500 mb-2">عمليات مجدولة</p>
                                    <div className="flex flex-col gap-1.5">
                                        {operations.map((op) => (
                                            <div key={op._id} className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
                                                <span className="text-sm">🔬</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-purple-900 text-xs truncate">{op.operationType}</p>
                                                    <p className="text-[10px] text-purple-500 truncate">
                                                        {fmtTime(op.time)} · {op.patientName}{op.location ? ` · ${op.location}` : ''}
                                                    </p>
                                                </div>
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                                    op.status === 'done'      ? 'bg-gray-100 text-gray-400'  :
                                                    op.status === 'cancelled' ? 'bg-red-50 text-red-400'     :
                                                                                'bg-purple-100 text-purple-700'
                                                }`}>
                                                    {op.status === 'scheduled' ? 'مجدول' : op.status === 'done' ? 'تم' : 'ملغي'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Right: Slots for selected date ─────────────────────────── */}
                <div className="flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-[#191c1c] text-base flex items-center gap-2">
                                {selectedDateLabel}
                                {isPastDay && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                        <span className="material-symbols-outlined text-[12px]">history</span>
                                        عرض فقط
                                    </span>
                                )}
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {slots.length > 0 ? `${slots.length} موعد مسجّل` : 'لا توجد مواعيد لهذا اليوم'}
                            </p>
                        </div>
                    </div>

                    {/* Add block form — hidden for past days */}
                    {!isPastDay && <AddBlockForm selectedDate={selectedDate} onCreated={handleCreated} />}

                    {/* Slots list */}
                    {loadingSlots ? (
                        <div className="flex justify-center py-10">
                            <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                        </div>
                    ) : slots.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
                            <span className="material-symbols-outlined text-[40px] text-gray-200 block mb-2">event_available</span>
                            <p className="text-sm text-gray-400">
                                {isPastDay ? 'لا توجد مواعيد مسجّلة لهذا اليوم' : 'لا توجد مواعيد — أضف فترة عمل بالنموذج أعلاه'}
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <AnimatePresence>
                                {slots.map((slot) => (
                                    <motion.div
                                        key={slot._id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                    >
                                        <SlotRow
                                            slot={slot}
                                            onToggle={handleToggle}
                                            onDelete={handleDelete}
                                            toggling={toggling}
                                            deleting={deleting}
                                            isPastTime={(() => {
                                                if (isPastDay) return true;   // whole day is past
                                                if (selectedDate !== toDateKey(new Date())) return false;
                                                const [h, m] = slot.startTime.split(':').map(Number);
                                                const now = new Date();
                                                return (h * 60 + m) < (now.getHours() * 60 + now.getMinutes());
                                            })()}
                                        />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

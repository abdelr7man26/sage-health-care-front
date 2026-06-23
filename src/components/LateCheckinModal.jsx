/**
 * LateCheckinModal.jsx
 *
 * Lets the secretary check in a late patient (scheduled booking or walk-in)
 * and assign a new queue position.  Calls:
 *
 *   PATCH /bookings/:bookingId/late-checkin   — for online bookings
 *   PATCH /doctors/walkin/:id/late-checkin    — for walk-in records
 *
 * After success, onCheckedIn() is called so TodayQueue can refresh.
 *
 * Usage:
 *   <LateCheckinModal
 *     open={showLateCheckin}
 *     entry={selectedEntry}   // { _id, type:'booking'|'walkin', patientName, slotTime }
 *     totalActive={activeCount}
 *     onClose={() => setShowLateCheckin(false)}
 *     onCheckedIn={() => refresh()}
 *   />
 */
import { useState, useEffect } from 'react';
import axiosInstance from '../api/axiosInstance';
import { fmtTime } from '../utils/timeFormat';


export default function LateCheckinModal({ open, entry, totalActive = 1, onClose, onCheckedIn }) {
    const [position, setPosition] = useState(1);
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState('');

    // Reset when a new entry is shown
    useEffect(() => {
        if (open) {
            setPosition(1);
            setError('');
        }
    }, [open, entry]);

    if (!open || !entry) return null;

    // Build a list of available positions (1 to totalActive + 1)
    const maxPos  = Math.max(totalActive + 1, 5);
    const positions = Array.from({ length: maxPos }, (_, i) => i + 1);

    const handleSubmit = async () => {
        setLoading(true);
        setError('');
        try {
            if (entry.type === 'walkin') {
                await axiosInstance.patch(`/doctors/walkin/${entry._id}/late-checkin`, {
                    newQueuePosition: position,
                });
            } else {
                await axiosInstance.patch(`/bookings/${entry._id}/late-checkin`, {
                    newQueuePosition: position,
                });
            }
            onCheckedIn?.();
            onClose?.();
        } catch (err) {
            setError(err.response?.data?.message || 'فشل تسجيل الدخول المتأخر');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={(e) => e.target === e.currentTarget && onClose?.()}
        >
            <div
                dir="rtl"
                className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="font-black text-gray-800 text-lg">⏱ تسجيل دخول متأخر</h2>
                        <p className="text-sm text-gray-500 mt-0.5 font-medium">
                            {entry.patientName}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                    >✕</button>
                </div>

                {/* Info */}
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 mb-5">
                    <p className="text-xs text-blue-700 leading-relaxed">
                        المريض <strong>{entry.patientName}</strong> وصل متأخراً عن موعده
                        {entry.slotTime && <> الساعة <strong>{fmtTime(entry.slotTime)}</strong></>}.
                        حدد ترتيبه الجديد في الطابور ليراه الطبيب في الوقت المناسب.
                    </p>
                </div>

                {/* Position selector */}
                <div className="mb-5">
                    <p className="text-xs font-bold text-gray-600 mb-3">الترتيب الجديد في الطابور:</p>

                    <div className="grid grid-cols-4 gap-2">
                        {positions.slice(0, 8).map(p => (
                            <button
                                key={p}
                                onClick={() => setPosition(p)}
                                className={`py-3 rounded-xl text-sm font-black transition-all ${
                                    position === p
                                        ? 'bg-blue-600 text-white shadow-md scale-105'
                                        : 'bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600'
                                }`}
                            >
                                {p === 1 ? 'الأول' : p === 2 ? 'الثاني' : p === 3 ? 'الثالث' : `${p}#`}
                            </button>
                        ))}
                    </div>

                    {positions.length > 8 && (
                        <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-gray-500">أو أدخل الترتيب يدوياً:</span>
                            <input
                                type="number"
                                min={1}
                                max={maxPos}
                                value={position}
                                onChange={e => setPosition(Number(e.target.value))}
                                className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                        </div>
                    )}
                </div>

                {/* Selected summary */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 mb-4">
                    <p className="text-sm text-emerald-700 text-center font-bold">
                        سيدخل {entry.patientName}{' '}
                        {position === 1
                            ? 'كالحالة التالية مباشرةً'
                            : position === 2
                            ? 'بعد الحالة الحالية بحالة واحدة'
                            : `في الترتيب رقم ${position}`}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
                        <p className="text-xs text-red-600">{error}</p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl text-sm transition-all shadow disabled:opacity-50"
                    >
                        {loading ? 'جاري التسجيل...' : '✓ تأكيد الدخول'}
                    </button>
                    <button
                        onClick={onClose}
                        className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-sm transition-all"
                    >
                        إلغاء
                    </button>
                </div>
            </div>
        </div>
    );
}

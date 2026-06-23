/**
 * QueueTracker.jsx
 *
 * Patient-facing live queue widget.  Polls every 60 seconds and listens for
 * SSE 'queue-shift' events so the ETA updates in real time.
 *
 * Two modes (mutually exclusive):
 *   • Booking mode  — pass bookingId; polls GET /bookings/:id/queue-status
 *   • Walk-in mode  — pass walkInId;  polls GET /patients/my-walkins/:id/queue-status
 *
 * Also activates usePatientLocation (online bookings only) to share GPS
 * coordinates with the server so Stage-2 notifications fire based on real
 * travel time rather than a fixed "2 people ahead" threshold.
 *
 * Props:
 *   bookingId   string   — booking ID (booking mode)
 *   walkInId    string   — walk-in  ID (walk-in mode)
 *   doctorName  string   optional
 *   slotTime    string   "HH:MM"  — shown in stats grid
 *   slotDate    string   ISO date — component hides itself when not today
 *   bookingType string   'online'|'walkin' — disables GPS for walk-ins
 */
import { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../api/axiosInstance';
import usePatientLocation from '../hooks/usePatientLocation';
import { fmtTime } from '../utils/timeFormat';


const POLL_MS = 60_000;

// ── Status-driven UI config ───────────────────────────────────────────────────
const getUiConfig = (data) => {
    if (!data) return null;

    // Check isInProgress BEFORE isNow — when the patient's consultation is
    // actively running, isNow may also be true but "جاري الكشف" is more accurate.
    if (data.isInProgress) {
        return {
            icon:     '🩺',
            title:    'جاري الكشف الآن',
            subtitle: 'الدكتور معك الآن — استرخِ',
            bg:       'from-teal-500 to-emerald-600',
            urgency:  'in-progress',
        };
    }

    if (data.isNow) {
        return {
            icon:     '🟢',
            title:    'دورك الآن!',
            subtitle: 'توجّه إلى الطاقم الطبي فوراً',
            bg:       'from-emerald-500 to-teal-600',
            urgency:  'now',
        };
    }

    if (data.shouldHeadToClinic) {
        return {
            icon:     '🏃',
            title:    'توجّه للعيادة الآن',
            subtitle: `الوقت المتوقع لدورك: ${fmtTime(data.estimatedArrival)}`,
            bg:       'from-amber-500 to-orange-500',
            urgency:  'soon',
        };
    }

    return {
        icon:     '🕐',
     title:    `الوقت المتوقع: ${fmtTime(data.estimatedArrival)}`,
        subtitle: `موعدك المحجوز: ${fmtTime(data.slotTime)}`,
        bg:       'from-blue-500 to-indigo-600',
        urgency:  'waiting',
    };
};

const isTodayDate = (slotDate) => {
    if (!slotDate) return false;
    const d = new Date(slotDate);
    const t = new Date();
    return (
        d.getFullYear() === t.getFullYear() &&
        d.getMonth()    === t.getMonth()    &&
        d.getDate()     === t.getDate()
    );
};

// Colour token per urgency
const URGENCY_COLOR = {
    'in-progress': 'text-teal-400',
    'now':         'text-emerald-400',
    'soon':        'text-amber-400',
    'waiting':     'text-blue-400',
};

// ── Main component ────────────────────────────────────────────────────────────
export default function QueueTracker({
    bookingId,
    walkInId,
    slotTime,
    slotDate,
}) {
    const [data,        setData]        = useState(null);
    const [loading,     setLoading]     = useState(true);
    const [error,       setError]       = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    // Walk-in records are only ever active for today; skip the date guard.
    const today = walkInId ? true : isTodayDate(slotDate);

    // ── Location tracking (bookings + registered walk-ins) ───────────────────
    const { travelTimeMinutes, isEnRoute, permissionError } = usePatientLocation({
        bookingId,
        walkInId,
        slotDate,
        enabled: today,
    });

    // ── Queue status fetch ────────────────────────────────────────────────────
    const fetchStatus = useCallback(async () => {
        const endpoint = walkInId
            ? `/patients/my-walkins/${walkInId}/queue-status`
            : bookingId
                ? `/bookings/${bookingId}/queue-status`
                : null;
        if (!endpoint) return;
        try {
            const { data: res } = await axiosInstance.get(endpoint);
            setData(res.data);
            setError(false);
            setLastUpdated(new Date());
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [bookingId, walkInId]);

    useEffect(() => {
        fetchStatus();
        const id = setInterval(fetchStatus, POLL_MS);
        return () => clearInterval(id);
    }, [fetchStatus]);

    // ── SSE queue-shift listener ──────────────────────────────────────────────
    // TodayQueue / parent components broadcast 'queue-shift' via the SSE channel.
    // We re-fetch immediately on receiving it so the patient sees the new ETA
    // within seconds rather than waiting up to 60 s for the next poll.
    useEffect(() => {
        const handler = (e) => {
            try {
                const payload = e.detail ?? (e.data ? JSON.parse(e.data) : {});
                const isMe = walkInId
                    ? (payload.walkInId === walkInId   || payload.walkInId  === String(walkInId))
                    : (payload.bookingId === bookingId || payload.bookingId === String(bookingId));

                if (isMe) {
                    // Merge partial update; re-fetch for walk-ins (full re-calc)
                    if (walkInId) {
                        fetchStatus();
                    } else {
                        setData(prev => ({
                            ...prev,
                            estimatedArrival: payload.newETA          ?? prev?.estimatedArrival,
                            minutesUntilETA:  payload.minutesUntilETA ?? prev?.minutesUntilETA,
                            shiftDelay:       payload.shiftDelayMinutes ?? prev?.shiftDelay,
                        }));
                        setLastUpdated(new Date());
                    }
                } else if (walkInId) {
                    // Any queue-shift for the same doctor → re-fetch to get fresh ETA
                    fetchStatus();
                }
            } catch {
                // Non-JSON SSE events (e.g. heartbeat pings) are ignored
            }
        };

        window.addEventListener('sage:queue-shift', handler);
        return () => window.removeEventListener('sage:queue-shift', handler);
    }, [bookingId, walkInId, fetchStatus]);

    // Don't show tracker when appointment is not today
    if (!today) return null;

    const ui = getUiConfig(data);
    // Patch subtitle for walk-in waiting state
    if (ui && walkInId && ui.urgency === 'waiting') {
        ui.subtitle = `وقت وصولك: ${fmtTime(data?.slotTime)}`;
    }

    if (loading) {
        return <div className="animate-pulse h-14 bg-white/[.05] rounded-xl" />;
    }

    if (error || !ui) {
        return (
            <div className="text-xs text-white/30 py-1">
                تعذّر تحميل حالة القائمة
                <button onClick={fetchStatus} className="mr-1.5 text-emerald-400 hover:text-emerald-300">إعادة المحاولة</button>
            </div>
        );
    }

    const titleColor = URGENCY_COLOR[ui.urgency] || 'text-white';
    return (
        <div className="flex flex-col gap-2" dir="rtl">
            {/* Status header */}
            <div className="flex items-center gap-1.5">
                <span className="text-base leading-none">{ui.icon}</span>
                <span className={`text-sm font-black ${titleColor}`}>{ui.title}</span>
            </div>
            {ui.subtitle && <p className="text-xs text-white/50 leading-snug">{ui.subtitle}</p>}

            {/* Stats grid */}
            {!data?.isInProgress && (
                <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                    {[
                        { label: walkInId ? 'وقت وصولك' : 'موعدك المحجوز', value: fmtTime(slotTime || data?.slotTime) || '—' },
                        { label: 'الوقت المتوقع', value: fmtTime(data?.estimatedArrival) || '—' },
                    ].map(s => (
                        <div key={s.label} className="bg-white/[.08] border border-white/[.06] rounded-xl p-2 text-center">
                            <p className="text-sm font-black text-white">{s.value}</p>
                            <p className="text-[10px] text-white/40">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Shift delay + travel time */}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {data?.shiftDelay > 0 && (
                    <p className="text-[11px] text-white/35">⏰ متأخرة {data.shiftDelay} دقيقة</p>
                )}
                {travelTimeMinutes !== null && (
                    <p className="text-[11px] text-white/35">
                        🚗 {travelTimeMinutes < 1 ? 'أقل من دقيقة' : `${travelTimeMinutes} دقيقة`}
                        {isEnRoute && <span className="text-emerald-400"> • في الطريق</span>}
                    </p>
                )}
                {permissionError && (
                    <p className="text-[11px] text-white/25">💡 فعّل الموقع للتنبيهات</p>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-auto">
                <p className="text-[10px] text-white/25">
                    {lastUpdated
                        ? `آخر تحديث: ${lastUpdated.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`
                        : 'جاري التحديث التلقائي'}
                </p>
                <button onClick={fetchStatus}
                    className="text-[10px] text-white/35 hover:text-white/60 transition flex items-center gap-0.5">
                    🔄 تحديث
                </button>
            </div>
        </div>
    );
}

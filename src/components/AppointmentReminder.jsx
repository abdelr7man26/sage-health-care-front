/**
 * Static appointment card shown when today's booking exists.
 * No polling, no queue position — just scheduled time + "we'll notify you" message.
 * The actual "head to clinic" push/email arrives from the server at the right time.
 */
import { fmtTime } from '../utils/timeFormat';

export default function AppointmentReminder({ doctorName, slotTime, slotDate }) {
    const formattedDate = slotDate
        ? new Date(slotDate).toLocaleDateString('ar-EG', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })
        : '';

    return (
        <div
            className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5 shadow-lg"
            dir="rtl"
        >
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
                <span className="text-2xl">🏥</span>
                <div>
                    <h3 className="font-black text-base leading-tight">موعدك اليوم</h3>
                    {doctorName && (
                        <p className="text-white/70 text-xs mt-0.5">د. {doctorName}</p>
                    )}
                </div>
            </div>

            {/* Time block */}
            <div className="bg-white/15 rounded-xl p-3 text-center mb-4">
                <p className="text-3xl font-black tracking-wide">{fmtTime(slotTime) || '—'}</p>
                {formattedDate && (
                    <p className="text-white/70 text-xs mt-1">{formattedDate}</p>
                )}
            </div>

            {/* Notification notice */}
            <div className="flex items-start gap-2 bg-white/10 rounded-xl p-3">
                <span className="text-lg mt-0.5">🔔</span>
                <p className="text-sm text-white/90 leading-relaxed">
                    استرح في بيتك — سنُرسل لك إشعاراً عند حين التوجّه للعيادة.
                </p>
            </div>
        </div>
    );
}

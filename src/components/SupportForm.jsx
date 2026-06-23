import { useState } from 'react';
import axios from 'axios';

/**
 * SupportForm — Customer support ticket form.
 * Sends a POST /api/patients/support request with the user's message.
 * Rate-limited server-side to 3 tickets per hour.
 */
export default function SupportForm({ onClose }) {
    const [subject, setSubject]   = useState('');
    const [message, setMessage]   = useState('');
    const [loading, setLoading]   = useState(false);
    const [success, setSuccess]   = useState(false);
    const [error, setError]       = useState('');

    const SUBJECTS = [
        'مشكلة في تسجيل الدخول',
        'مشكلة في الحجز',
        'مشكلة في السجلات الطبية',
        'مشكلة تقنية أخرى',
        'سؤال عام',
        'بلاغ عن محتوى مسيء',
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!subject || !message.trim()) return;

        setLoading(true);
        setError('');

        try {
            await axios.post('/api/patients/support', { subject, message });
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.message || 'حدث خطأ، يرجى المحاولة لاحقاً');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="text-center py-8 px-6" dir="rtl">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-[32px] text-emerald-600">check_circle</span>
                </div>
                <h3 className="text-lg font-bold text-[#191c1c] mb-2">تم الإرسال بنجاح</h3>
                <p className="text-gray-500 text-sm mb-6">سنرد عليك على بريدك الإلكتروني خلال 24 ساعة.</p>
                <button
                    onClick={onClose}
                    className="bg-[#134e3a] text-white px-6 py-2.5 rounded-[10px] text-sm font-bold hover:bg-[#0c3326] transition-colors"
                >
                    إغلاق
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} dir="rtl" className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-[#eaf4ef] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px] text-[#2d6a4f]">support_agent</span>
                </div>
                <div>
                    <h3 className="font-bold text-[#191c1c] text-base">تواصل مع الدعم</h3>
                    <p className="text-xs text-gray-400">سنرد خلال 24 ساعة</p>
                </div>
            </div>

            {/* Subject */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    الموضوع <span className="text-red-500">*</span>
                </label>
                <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded-[10px] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/30 bg-white"
                >
                    <option value="">اختر موضوع الرسالة</option>
                    {SUBJECTS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </div>

            {/* Message */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    الرسالة <span className="text-red-500">*</span>
                </label>
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    maxLength={2000}
                    rows={5}
                    placeholder="اشرح مشكلتك بالتفصيل..."
                    className="w-full border border-gray-200 rounded-[10px] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/30 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-left">{message.length}/2000</p>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-[10px] px-3 py-2.5 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
                <button
                    type="submit"
                    disabled={loading || !subject || !message.trim()}
                    className="flex-1 bg-[#134e3a] hover:bg-[#0c3326] text-white py-2.5 rounded-[10px] text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <>
                            <span className="material-symbols-outlined text-[18px]">send</span>
                            إرسال
                        </>
                    )}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 border border-gray-200 rounded-[10px] text-gray-500 text-sm hover:bg-gray-50 transition-colors"
                >
                    إلغاء
                </button>
            </div>
        </form>
    );
}

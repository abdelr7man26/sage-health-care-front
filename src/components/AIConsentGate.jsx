import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * AIConsentGate
 * ─────────────
 * Wraps any SAGE AI surface (full chat page, dashboard card, …) and blocks
 * access until the user has given privacy consent for AI processing.
 *
 * Egyptian PDPL (Law 151/2020, Art.6 + Art.7) requires explicit consent before
 * symptom text is sent to a third-party processor (Groq). Keeping this gate in a
 * single component guarantees the consent can never be bypassed by mounting the
 * chat somewhere that forgot to add it.
 *
 * Consent is scoped per-user (key: sage:ai-consent:<userId>) so a different
 * account on the same device must give its own consent.
 *
 * Props:
 *   children    – the AI surface to reveal once consent is granted.
 *   onDecline   – optional. When provided, a "رجوع" button is shown that calls
 *                 it (e.g. navigate away on the full page). Omit it inside a
 *                 dashboard card where there is nowhere to go back to.
 */
export default function AIConsentGate({ children, onDecline }) {
    const { user } = useAuth();

    const consentKey = user?.id ? `sage:ai-consent:${user.id}` : 'sage:ai-consent';
    const [aiConsent, setAiConsent] = useState(
        () => localStorage.getItem(consentKey) === '1'
    );
    const [consentChecked, setConsentChecked] = useState(false);

    const acceptConsent = () => {
        localStorage.setItem(consentKey, '1');
        setAiConsent(true);
    };

    if (aiConsent) return children;

    return (
        /* Consent modal — required by Egyptian PDPL Art.6 before AI processing.
           overflow-y-auto so it stays usable inside short containers (e.g. the
           dashboard chat card) without being clipped. */
        <div className="h-full overflow-y-auto flex items-center justify-center p-6" dir="rtl">
            <div className="bg-white rounded-[24px] shadow-2xl max-w-md w-full p-8 border border-gray-100">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-[#eaf4ef] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[28px] text-[#2d6a4f]">smart_toy</span>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-[#191c1c]">SAGE AI — إشعار الخصوصية</h2>
                        <p className="text-xs text-gray-400">وفق قانون 151/2020</p>
                    </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-4 mb-5 text-sm text-amber-800 leading-relaxed">
                    <p className="font-bold mb-1">قبل استخدام المساعد الذكي، يُرجى العلم بأن:</p>
                    <ul className="list-disc list-inside space-y-1 text-amber-700">
                        <li>الأعراض التي تكتبها تُرسَل إلى <strong>Groq API</strong> (نموذج Llama 3.3) للتحليل.</li>
                        <li>لا تُرسَل بياناتك الشخصية (الاسم، الهاتف، الرقم القومي، السجلات الطبية).</li>
                        <li>يخضع هذا المعالجة لـ <a href="https://groq.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="underline font-bold">سياسة خصوصية Groq</a>.</li>
                        <li>المساعد يقترح تخصصات طبية فقط — <strong>لا يحل محل الطبيب</strong>.</li>
                    </ul>
                </div>

                <label className="flex items-start gap-3 cursor-pointer mb-6">
                    <input
                        type="checkbox"
                        checked={consentChecked}
                        onChange={(e) => setConsentChecked(e.target.checked)}
                        className="mt-1 w-4 h-4 accent-[#2d6a4f] flex-shrink-0"
                    />
                    <span className="text-[13px] text-gray-600 leading-relaxed">
                        أفهم ذلك وأوافق على إرسال وصف الأعراض إلى Groq API (Llama 3.3) لأغراض التحليل الطبي.
                    </span>
                </label>

                <div className="flex gap-3">
                    <button
                        onClick={acceptConsent}
                        disabled={!consentChecked}
                        className="flex-1 bg-[#134e3a] hover:bg-[#0c3326] text-white py-3 rounded-[12px] font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        موافق — ابدأ المحادثة
                    </button>
                    {onDecline && (
                        <button
                            onClick={onDecline}
                            className="px-4 py-3 border border-gray-200 rounded-[12px] text-gray-500 text-sm hover:bg-gray-50 transition-all"
                        >
                            رجوع
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

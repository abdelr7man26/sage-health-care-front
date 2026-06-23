import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const CONSENT_KEY = 'sage:cookie-consent';

/**
 * CookieConsentBanner
 *
 * Informs users about essential cookies as required by PDPL Art.6 and GDPR.
 * SAGE only uses ONE cookie: sage_refresh (httpOnly, essential for auth).
 * No tracking, no analytics, no advertising cookies.
 *
 * Because all cookies are strictly essential, users cannot opt out —
 * but we must still inform them. The banner dismisses on "مفهوم" and
 * never shows again (stored in localStorage).
 */
export default function CookieConsentBanner() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Show only if the user hasn't dismissed it before.
        if (!localStorage.getItem(CONSENT_KEY)) {
            // Small delay so the banner doesn't flash during the initial render.
            const t = setTimeout(() => setVisible(true), 800);
            return () => clearTimeout(t);
        }
    }, []);

    const dismiss = () => {
        localStorage.setItem(CONSENT_KEY, '1');
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div
            role="dialog"
            aria-live="polite"
            aria-label="إشعار ملفات تعريف الارتباط"
            dir="rtl"
            className="
                fixed bottom-4 left-4 right-4 z-50
                sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm
                bg-[#0f3d2a] text-white rounded-[20px] shadow-2xl
                border border-white/10 p-5
                animate-in slide-in-from-bottom-4 duration-300
            "
        >
            {/* Icon + title */}
            <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">cookie</span>
                </div>
                <p className="font-bold text-sm">ملفات تعريف الارتباط</p>
            </div>

            {/* Body */}
            <p className="text-white/75 text-xs leading-relaxed mb-4">
                نستخدم ملف تعريف ارتباط واحداً ضرورياً ({' '}
                <code className="bg-white/10 px-1 rounded text-[11px]">sage_refresh</code>
                {' '}) للحفاظ على جلسة تسجيل دخولك بشكل آمن.
                لا نستخدم أي ملفات تتبع أو إعلانية.{' '}
                <Link
                    to="/privacy-policy"
                    className="underline text-white/90 hover:text-white"
                    onClick={dismiss}
                >
                    سياسة الخصوصية
                </Link>
            </p>

            {/* Actions */}
            <div className="flex gap-2">
                <button
                    onClick={dismiss}
                    className="
                        flex-1 bg-[#1a6b4e] hover:bg-[#155d44]
                        text-white text-xs font-bold
                        py-2.5 rounded-[10px] transition-colors
                    "
                >
                    مفهوم
                </button>
                <Link
                    to="/privacy-policy"
                    onClick={dismiss}
                    className="
                        px-4 py-2.5 rounded-[10px]
                        border border-white/20 hover:bg-white/10
                        text-white/70 hover:text-white text-xs
                        transition-colors whitespace-nowrap
                    "
                >
                    تفاصيل أكثر
                </Link>
            </div>
        </div>
    );
}

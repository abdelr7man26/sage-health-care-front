import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SageAIChat from '../../components/SageAIChat';
import AIConsentGate from '../../components/AIConsentGate';

/**
 * AIChatPage
 * ──────────
 * Full-viewport dedicated chat page for the SAGE AI assistant.
 *
 * Height budget (flex column, 100dvh):
 *   ┌── page header   56px  (shrink-0) ────────────────────┐
 *   ├── SageAIChat    flex-1 (fills everything below) ──────┤
 *   │     ├── messages area   flex-1, overflow-y-auto       │
 *   │     ├── disclaimer      shrink-0                      │
 *   │     └── input bar       shrink-0                      │
 *   └────────────────────────────────────────────────────── ┘
 *
 * 100dvh (dynamic viewport height) is used instead of 100vh so the
 * layout is correct on mobile browsers where the address bar shrinks
 * the visible area.
 */
export default function AIChatPage() {
    const navigate    = useNavigate();
    const { user }    = useAuth();
    const displayName = user?.name || 'مريض';

    return (
        /*
         * Outer shell: exactly one viewport tall, flex column, no overflow.
         * Nothing here causes a page-level scrollbar — only the messages
         * area inside SageAIChat scrolls.
         */
        <div
            className="flex flex-col w-full bg-gradient-to-b from-[#0b2d20] via-[#103d2a] to-[#1a4d35] font-['Cairo']"
            style={{ height: '100dvh' }}
        >
            {/* ── Page header ──────────────────────────────────────────────────
                shrink-0 keeps it at exactly its natural height (56px).
                Full width, no max-width cap, sticky to the top.
            ────────────────────────────────────────────────────────────────── */}
            <header className="shrink-0 w-full bg-[#1a6b4e] border-b border-[#155d44] shadow-md">
                <div className="w-full px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

                    {/* Left: back button + brand */}
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-1.5 text-white/75 hover:text-white font-semibold text-sm transition-colors shrink-0"
                        >
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                            <span className="hidden sm:inline">الرئيسية</span>
                        </button>

                        {/* Divider */}
                        <span className="text-white/20 text-lg hidden sm:inline">|</span>

                        {/* SAGE AI identity */}
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-white text-[17px]">smart_toy</span>
                            </div>
                            <div className="min-w-0">
                                <p className="font-black text-white text-sm leading-none">SAGE AI</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse shrink-0" />
                                    <p className="text-[11px] text-white/60 truncate">مساعد طبي ذكي</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: user pill */}
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="hidden sm:flex items-center gap-2 bg-white/15 border border-white/20 rounded-xl px-3 py-1.5">
                            <div className="w-6 h-6 rounded-full bg-white/25 flex items-center justify-center text-white font-bold text-xs">
                                {displayName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-semibold text-white max-w-[120px] truncate">
                                {displayName}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Chat area / Consent gate ──────────────────────────────────── */}
            <div className="flex-1 min-h-0">
                <AIConsentGate onDecline={() => navigate('/dashboard')}>
                    <SageAIChat userName={displayName} />
                </AIConsentGate>
            </div>
        </div>
    );
}

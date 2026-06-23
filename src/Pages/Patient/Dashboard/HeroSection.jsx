import { memo, useState } from 'react';
import { isToday } from './dashboardHelpers';

// Immersive SAGE entry experience: dark ambient atmosphere + identity + smart actions.
// Uses pure CSS animated gradients — zero images, zero stock photos.
const HERO_CITIES = [
    'القاهرة','الجيزة','الإسكندرية','الشرقية','المنوفية',
    'القليوبية','الغربية','الدقهلية','أسيوط','المنيا',
    'سوهاج','قنا','الأقصر','أسوان','بورسعيد','السويس',
];

function HeroSection({ displayName, greeting, nextEvent, upcomingCount, activeMedCount, navigate }) {
    const [heroSearch, setHeroSearch] = useState('');
    const [heroCity,   setHeroCity]   = useState('');

    const handleHeroSearch = () => {
        const params = new URLSearchParams();
        if (heroSearch.trim()) params.set('q',    heroSearch.trim());
        if (heroCity)          params.set('city', heroCity);
        navigate(`/doctors${params.toString() ? `?${params}` : ''}`);
    };

    const actions = [
        { icon: 'smart_toy',      label: 'مساعد SAGE',   sub: 'تحليل AI',         action: () => navigate('/chat'),          iconColor: 'text-emerald-400' },
        { icon: 'event_available',label: 'احجز موعداً',  sub: 'اختر طبيباً',       action: () => navigate('/doctors'),       iconColor: 'text-violet-400'  },
        { icon: 'folder_open',    label: 'ملفاتي',        sub: 'السجلات الطبية',   action: () => navigate('/profile', { state: { section: 'medical' } }),    iconColor: 'text-amber-400'   },
        { icon: 'medication',     label: 'الأدوية',        sub: 'جدول اليوم',       action: () => navigate('/profile', { state: { section: 'medications' } }), iconColor: 'text-rose-400'    },
        { icon: 'calendar_month', label: 'مواعيدي',       sub: 'عرض الكل',          action: () => navigate('/appointments'),  iconColor: 'text-teal-400'    },
        { icon: 'groups',         label: 'كل الأطباء',   sub: 'استعرض الجميع',    action: () => navigate('/doctors'),       iconColor: 'text-sky-400'     },
    ];

    return (
        <>
            {/* Keyframe definitions — injected once, scoped to this component's orbs */}
            <style>{`
                @keyframes sageOrb1 {
                    0%,100% { transform: translate(0,0) scale(1);    opacity: .50; }
                    50%     { transform: translate(4%,-3%) scale(1.08); opacity: .70; }
                }
                @keyframes sageOrb2 {
                    0%,100% { transform: translate(0,0) scale(1.05); opacity: .30; }
                    50%     { transform: translate(-3%,4%) scale(1);  opacity: .50; }
                }
                @keyframes sageOrb3 {
                    0%,100% { transform: translate(0,0) scale(1);    opacity: .15; }
                    33%     { transform: translate(2%,2%) scale(1.04);  opacity: .28; }
                    66%     { transform: translate(-1%,-2%) scale(.97); opacity: .20; }
                }
            `}</style>

            <div className="relative overflow-hidden bg-[#0b2d20]" dir="rtl">

                {/* ── Ambient layer: orbs + dot grid ─────────────────────────── */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
                    {/* Primary brand-green orb — top-right */}
                    <div style={{
                        position:'absolute', top:'-20%', right:'-8%',
                        width:'55%', height:'140%',
                        background:'radial-gradient(ellipse, rgba(26,107,78,.55) 0%, transparent 70%)',
                        animation:'sageOrb1 10s ease-in-out infinite',
                        willChange:'transform',
                    }}/>
                    {/* Secondary emerald orb — bottom-left */}
                    <div style={{
                        position:'absolute', bottom:'-30%', left:'-5%',
                        width:'48%', height:'120%',
                        background:'radial-gradient(ellipse, rgba(16,185,129,.18) 0%, transparent 70%)',
                        animation:'sageOrb2 14s ease-in-out infinite',
                        willChange:'transform',
                    }}/>
                    {/* Tertiary diffuse accent — center */}
                    <div style={{
                        position:'absolute', top:'10%', left:'25%',
                        width:'38%', height:'70%',
                        background:'radial-gradient(ellipse, rgba(52,211,153,.11) 0%, transparent 70%)',
                        animation:'sageOrb3 18s ease-in-out infinite',
                        willChange:'transform',
                    }}/>
                    {/* Dot grid texture */}
                    <div style={{
                        position:'absolute', inset:0,
                        backgroundImage:'radial-gradient(circle, rgba(255,255,255,.045) 1px, transparent 1px)',
                        backgroundSize:'32px 32px',
                    }}/>
                    {/* Top accent line */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"/>
                </div>

                {/* ── Content ─────────────────────────────────────────────────── */}
                <div className="relative z-10 max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10 pt-10 sm:pt-12 pb-16">

                    {/* Identity row */}
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-9">

                        {/* Left: greeting + tagline + pulse stats */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"/>
                                <span className="text-emerald-400/80 text-[10px] font-bold tracking-[0.28em] uppercase">
                                    SAGE Intelligence · نظام صحي ذكي
                                </span>
                            </div>

                            <h1 className="text-3xl sm:text-[2.4rem] font-black text-white leading-tight mb-2.5">
                                {greeting}،{' '}
                                <span className="text-emerald-300">{displayName}</span>
                            </h1>

                            <p className="text-white/50 text-sm leading-relaxed max-w-[420px]">
                                مساعدك الذكي لإدارة الصحة — مواعيد، أدوية، واستشارات AI في منصة واحدة.
                            </p>

                            {/* Pulse stats */}
                            <div className="flex flex-wrap items-center gap-2.5 mt-5">
                                <div className="flex items-center gap-1.5 bg-white/[.07] border border-white/10 rounded-xl px-3 py-1.5">
                                    <span className="material-symbols-outlined text-emerald-400 text-[13px]">calendar_month</span>
                                    <span className="text-white/75 text-xs font-semibold">{upcomingCount} موعد قادم</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white/[.07] border border-white/10 rounded-xl px-3 py-1.5">
                                    <span className="material-symbols-outlined text-rose-400 text-[13px]">medication</span>
                                    <span className="text-white/75 text-xs font-semibold">{activeMedCount} دواء نشط</span>
                                </div>
                                {nextEvent && isToday(nextEvent.date) && nextEvent.raw?.status !== 'in-progress' && (
                                    <div className="flex items-center gap-1.5 bg-emerald-500/[.15] border border-emerald-500/25 rounded-xl px-3 py-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"/>
                                        <span className="text-emerald-300 text-xs font-semibold">
                                            {nextEvent._type === 'walkin' ? 'في قائمة الانتظار حالياً' : 'لديك موعد قريب'}
                                        </span>
                                    </div>
                                )}
                                {nextEvent && nextEvent.raw?.status === 'in-progress' && (
                                    <div className="flex items-center gap-1.5 bg-green-500/[.15] border border-green-500/30 rounded-xl px-3 py-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0"/>
                                        <span className="text-green-300 text-xs font-semibold">الكشف جارٍ الآن</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: SAGE brand mark — desktop only */}
                        <div className="hidden lg:block shrink-0">
                            <div className="flex items-center gap-3 bg-white/[.05] border border-white/[.09] rounded-2xl px-5 py-4">
                                <div className="w-11 h-11 rounded-xl bg-[#1a6b4e] flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white text-[22px]">clinical_notes</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-black text-white tracking-tight leading-none">SAGE</p>
                                    <p className="text-[9px] font-bold text-white/35 tracking-[0.25em] uppercase mt-0.5">Healthcare Platform</p>
                                </div>
                            </div>
                            <p className="text-white/20 text-[10px] text-center mt-2 tracking-wide">AI · Trusted · Private</p>
                        </div>
                    </div>

                    {/* ── Smart search bar ───────────────────────────────────── */}
                    <div className="bg-white/[.07] border border-white/[.12] rounded-2xl overflow-hidden mb-8">
                        <div className="flex items-center gap-2 p-2">
                            <span className="material-symbols-outlined text-white/40 text-[20px] pr-2 shrink-0">search</span>
                            <input
                                type="text"
                                value={heroSearch}
                                onChange={(e) => setHeroSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleHeroSearch()}
                                placeholder="ابحث بالاسم أو التخصص..."
                                className="flex-1 bg-transparent text-white placeholder-white/35 text-sm outline-none min-w-0"
                                dir="rtl"
                            />
                            <div className="w-px h-6 bg-white/15 shrink-0"/>
                            <select
                                value={heroCity}
                                onChange={(e) => setHeroCity(e.target.value)}
                                className="bg-transparent text-white/65 text-xs outline-none cursor-pointer px-2 shrink-0 max-w-[100px]"
                            >
                                <option value="" className="bg-[#0b2d20] text-white">كل المدن</option>
                                {HERO_CITIES.map((c) => (
                                    <option key={c} value={c} className="bg-[#0b2d20] text-white">{c}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleHeroSearch}
                                className="bg-[#1a6b4e] hover:bg-[#134e3a] text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors shrink-0"
                            >
                                بحث
                            </button>
                        </div>
                    </div>

                    {/* Smart actions grid — 6 modules */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
                        {actions.map(({ icon, label, sub, action, iconColor }) => (
                            <button
                                key={label}
                                onClick={action}
                                className="group flex flex-col items-center gap-2 py-4 px-2 rounded-2xl
                                    bg-white/[.05] border border-white/[.08]
                                    hover:bg-white/[.10] hover:border-white/[.18]
                                    transition-all duration-200 hover:-translate-y-0.5 active:scale-95 text-center"
                            >
                                <span className={`material-symbols-outlined text-[22px] ${iconColor} transition-colors duration-200`}>
                                    {icon}
                                </span>
                                <div>
                                    <p className="text-white text-[11px] sm:text-xs font-bold leading-tight">{label}</p>
                                    <p className="text-white/35 text-[9px] sm:text-[10px] mt-0.5 leading-tight hidden sm:block">{sub}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* No fade needed — page bg matches hero base color */}
            </div>
        </>
    );
}

export default memo(HeroSection);

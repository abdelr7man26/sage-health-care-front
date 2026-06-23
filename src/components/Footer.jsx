import { Link } from 'react-router-dom';

/* ── link sets ─────────────────────────────────────────────────────────── */
const PATIENT_NAV = [
    { to: '/dashboard',    label: 'الرئيسية'        },
    { to: '/appointments', label: 'مواعيدي'          },
    { to: '/doctors',      label: 'الأطباء'          },
    { to: '/chat',         label: 'مساعد AI'         },
];

const DOCTOR_NAV = [
    { to: '/doctor-dashboard', label: 'لوحة التحكم'  },
    { to: '/doctor-profile',   label: 'الملف الشخصي' },
];

const LEGAL_LINKS = [
    { to: '/privacy-policy', label: 'سياسة الخصوصية' },
    { to: '/terms',          label: 'شروط الاستخدام' },
];

/* ── component ─────────────────────────────────────────────────────────── */
export default function Footer({ variant = 'patient' }) {
    const isDoctor = variant === 'doctor';
    const year     = new Date().getFullYear();
    const navLinks = isDoctor ? DOCTOR_NAV : PATIENT_NAV;

    /* colour tokens */
    const t = isDoctor ? {
        wrap:       'bg-white border-t border-gray-100',
        top:        'border-gray-100',
        brand:      'text-[#0f5238]',
        tagline:    'text-[#134e3a]',
        desc:       'text-gray-400',
        colHead:    'text-[#191c1c]',
        link:       'text-gray-500 hover:text-[#134e3a]',
        contact:    'text-gray-500',
        accent:     'text-[#134e3a]',
        divider:    'border-gray-100',
        copy:       'text-gray-400',
        made:       'text-gray-400',
        madeIcon:   'text-[#134e3a]',
    } : {
        wrap:       'bg-[#071e12]',
        top:        'border-white/[.06]',
        brand:      'text-white',
        tagline:    'text-emerald-400',
        desc:       'text-white/40',
        colHead:    'text-white/80',
        link:       'text-white/45 hover:text-white',
        contact:    'text-white/45',
        accent:     'text-emerald-400',
        divider:    'border-white/[.06]',
        copy:       'text-white/30',
        made:       'text-white/30',
        madeIcon:   'text-emerald-500',
    };

    return (
        <footer dir="rtl" className={`font-['Cairo'] ${t.wrap}`}>

            {/* ── Upper section ───────────────────────────────────────────── */}
            <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-14 pb-10">

                {/* Brand row */}
                <div className={`pb-8 mb-10 border-b ${t.top}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`material-symbols-outlined text-[20px] ${t.accent}`}>
                            medical_services
                        </span>
                        <span className={`text-base font-black tracking-tight ${t.brand}`}>
                            SAGE Healthcare
                        </span>
                    </div>
                    <p className={`text-2xl font-black mb-2 ${t.tagline}`}>
                        صحتك، أولويتنا
                    </p>
                    <p className={`text-sm max-w-sm leading-relaxed ${t.desc}`}>
                        منصة صحية رقمية تربط المرضى بأطباء موثقين — احجز موعدك في ثوانٍ، وتابع صحتك بسهولة.
                    </p>
                </div>

                {/* Columns */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-10">

                    {/* Col 1 — Navigation */}
                    <div>
                        <h4 className={`text-xs font-black uppercase tracking-widest mb-4 ${t.colHead}`}>
                            التنقل السريع
                        </h4>
                        <ul className="space-y-2.5">
                            {navLinks.map((l) => (
                                <li key={l.to}>
                                    <Link
                                        to={l.to}
                                        className={`text-sm transition-colors ${t.link}`}
                                    >
                                        {l.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Col 2 — Support */}
                    <div>
                        <h4 className={`text-xs font-black uppercase tracking-widest mb-4 ${t.colHead}`}>
                            تواصل معنا
                        </h4>
                        <ul className="space-y-2.5">
                            <li className={`text-sm ${t.contact}`}>
                                support@sage-healthcare.com
                            </li>
                            <li className={`text-sm ${t.contact}`}>
                                دعم فني متاح 24 / 7
                            </li>
                            <li className={`text-sm ${t.contact}`}>
                                جمهورية مصر العربية
                            </li>
                        </ul>
                    </div>

                    {/* Col 3 — Legal */}
                    <div>
                        <h4 className={`text-xs font-black uppercase tracking-widest mb-4 ${t.colHead}`}>
                            قانوني
                        </h4>
                        <ul className="space-y-2.5">
                            {LEGAL_LINKS.map((l) =>
                                l.to ? (
                                    <li key={l.to}>
                                        <Link
                                            to={l.to}
                                            className={`text-sm transition-colors ${t.link}`}
                                        >
                                            {l.label}
                                        </Link>
                                    </li>
                                ) : (
                                    <li key={l.label} className={`text-sm ${t.contact}`}>
                                        {l.label}
                                    </li>
                                )
                            )}
                        </ul>
                    </div>
                </div>
            </div>

            {/* ── Bottom bar ──────────────────────────────────────────────── */}
            <div className={`border-t ${t.divider} py-5`}>
                <div className="max-w-7xl mx-auto px-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                    <p className={t.copy}>
                        &copy; {year} SAGE Healthcare. جميع الحقوق محفوظة.
                    </p>
                    <div className={`flex items-center gap-1.5 ${t.made}`}>
                        <span className={`material-symbols-outlined text-[13px] ${t.madeIcon}`}>
                            favorite
                        </span>
                        <span>صُنع في مصر</span>
                    </div>
                </div>
            </div>

        </footer>
    );
}

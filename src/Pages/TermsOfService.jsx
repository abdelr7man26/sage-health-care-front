import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/* ------------------------------------------------------------------ */
/*  Terms sections — data driven so the layout stays consistent        */
/* ------------------------------------------------------------------ */
const sections = [
    {
        id: 'acceptance',
        title: 'القبول بالشروط',
        body: (
            <p>
                باستخدامك لمنصة SAGE Healthcare («المنصة»)، فإنك توافق على الالتزام بهذه الشروط. إذا كنت لا توافق عليها، يرجى عدم استخدام المنصة.
            </p>
        ),
    },
    {
        id: 'service',
        title: 'وصف الخدمة',
        body: (
            <p>
                توفر SAGE Healthcare منصة إلكترونية لحجز المواعيد الطبية، وإدارة السجلات الصحية، والحصول على معلومات طبية عامة من خلال مساعد ذكاء اصطناعي. المنصة <strong>لا تُقدّم خدمات طبية مباشرة</strong> ولا تحل محل الاستشارة الطبية المتخصصة.
            </p>
        ),
    },
    {
        id: 'medical-disclaimer',
        title: 'إخلاء مسؤولية طبي',
        body: (
            <p>
                المعلومات المقدمة من مساعد SAGE AI هي <strong>لأغراض توعوية فقط</strong> وليست تشخيصاً طبياً أو وصفة علاجية. يجب عليك دائماً استشارة طبيب مؤهل قبل اتخاذ أي قرار صحي. في حالات الطوارئ، اتصل بالإسعاف فوراً.
            </p>
        ),
    },
    {
        id: 'registration',
        title: 'متطلبات التسجيل',
        body: (
            <p>
                يجب أن يكون عمرك 18 عاماً أو أكثر للتسجيل. أنت مسؤول عن الحفاظ على سرية بيانات حسابك. يُحظر تسجيل حسابات متعددة أو استخدام بيانات وهمية.
            </p>
        ),
    },
    {
        id: 'cancellation',
        title: 'سياسة الإلغاء والحجز',
        body: (
            <p>
                يمكن إلغاء الحجوزات مجاناً قبل 24 ساعة من موعد الكشف. الإلغاء في غضون الـ24 ساعة الأخيرة يستوجب التواصل المباشر مع العيادة. المنصة غير مسؤولة عن أي رسوم إلغاء تفرضها العيادة.
            </p>
        ),
    },
    {
        id: 'privacy',
        title: 'الخصوصية والبيانات',
        body: (
            <p>
                يخضع استخدامنا لبياناتك الشخصية لـ{' '}
                <Link to="/privacy-policy" className="text-[#134e3a] underline underline-offset-2 hover:text-[#0c3326]">سياسة الخصوصية</Link>{' '}
                المنشورة على المنصة والمتوافقة مع قانون حماية البيانات الشخصية المصري رقم 151 لسنة 2020.
            </p>
        ),
    },
    {
        id: 'doctor-verification',
        title: 'التحقق من الأطباء',
        body: (
            <p>
                تقوم إدارة المنصة بمراجعة بيانات الأطباء المتقدمين قبل الموافقة عليهم. المنصة تبذل جهوداً معقولة للتحقق من هوية الأطباء لكنها لا تضمن ذلك ضماناً مطلقاً. يتحمل الطبيب المسؤولية الكاملة عن صحة البيانات التي يقدمها.
            </p>
        ),
    },
    {
        id: 'liability',
        title: 'محدودية المسؤولية',
        body: (
            <>
                <p>لا تتحمل SAGE Healthcare مسؤولية أي ضرر ناجم عن:</p>
                <ul className="list-disc pr-5 space-y-2 marker:text-[#2d6a4f]">
                    <li>جودة الخدمات الطبية المقدمة من الأطباء.</li>
                    <li>قرارات طبية بُنيت على معلومات المساعد الذكي.</li>
                    <li>انقطاع الخدمة أو الأعطال التقنية.</li>
                </ul>
            </>
        ),
    },
    {
        id: 'amendments',
        title: 'التعديلات',
        body: (
            <p>
                تحتفظ المنصة بحق تعديل هذه الشروط في أي وقت. سيتم إشعارك بالتغييرات الجوهرية عبر البريد الإلكتروني أو إشعار داخل التطبيق. استمرارك في استخدام المنصة بعد التعديل يُعد قبولاً بالشروط الجديدة.
            </p>
        ),
    },
    {
        id: 'governing-law',
        title: 'القانون المطبّق',
        body: (
            <p>
                تخضع هذه الشروط لأحكام القانون المصري. تختص المحاكم المصرية المختصة بالفصل في أي نزاع ينشأ عن استخدام المنصة.
            </p>
        ),
    },
];

const TermsOfService = () => {
    const navigate = useNavigate();
    const [activeId, setActiveId] = useState(sections[0].id);

    // The page can be opened in a fresh tab (e.g. from the registration screen)
    // where there is no in-app history to step back to — fall back home.
    const goBack = () => {
        if (window.history.length > 1) navigate(-1);
        else navigate('/');
    };

    // Jump to a section WITHOUT pushing a browser history entry. A plain
    // "#anchor" link adds an entry per click, which would otherwise make the
    // "back" button step through each in-page jump instead of returning to the
    // page the user came from.
    const scrollToSection = (e, id) => {
        e.preventDefault();
        const el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveId(id);
        window.history.replaceState(window.history.state, '', `#${id}`);
    };

    // Scroll-spy: highlight the section currently in view inside the side nav.
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) setActiveId(e.target.id);
                });
            },
            { rootMargin: '-15% 0px -75% 0px', threshold: 0 },
        );
        sections.forEach((s) => {
            const el = document.getElementById(s.id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, []);

    return (
        <div className="min-h-screen bg-white text-[#1d1d1f] font-['Cairo'] scroll-smooth" dir="rtl">

            {/* Slim top bar */}
            <header className="sticky top-0 z-20 bg-[#134e3a] text-white">
                <div className="max-w-5xl mx-auto h-14 px-5 sm:px-8 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[20px]">medical_services</span>
                        <span className="text-base font-extrabold tracking-tight">SAGE</span>
                    </div>
                    <span className="text-[13px] font-medium text-white/70">شروط الاستخدام</span>
                </div>
            </header>

            {/* Hero */}
            <div className="bg-gradient-to-b from-[#134e3a] to-[#0f4230] text-white">
                <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-10 pb-16">
                    <p className="text-[13px] font-semibold text-[#9fd3bb] mb-3">الشروط والأحكام</p>
                    <h1 className="text-3xl sm:text-[40px] font-extrabold tracking-tight leading-[1.15] mb-4">
                        شروط الاستخدام
                    </h1>
                    <p className="text-white/75 text-[15px] max-w-2xl leading-8">
                        الشروط والأحكام التي تحكم استخدامك لمنصة SAGE للرعاية الصحية وكل الخدمات المتاحة من خلالها.
                    </p>
                    <p className="mt-6 text-[13px] text-white/50">آخر تحديث: يونيو 2026</p>
                </div>
            </div>

            {/* Content + sticky side nav */}
            <div className="max-w-5xl mx-auto px-5 sm:px-8 py-12 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-14">

                {/* Article */}
                <main className="min-w-0">
                    {/* Lead */}
                    <p className="text-[17px] leading-9 text-gray-700 mb-12 border-r-[3px] border-[#134e3a] pr-5">
                        تحكم هذه الشروط والأحكام استخدامك لمنصة <strong>SAGE</strong> وكل الخدمات المتاحة من خلالها.
                        توضّح هذه الصفحة طبيعة الخدمة، وحقوقك والتزاماتك، وحدود مسؤولية المنصة.
                        يُرجى قراءتها بعناية، وإذا كنت لا توافق عليها فالرجاء عدم استخدام المنصة.
                    </p>

                    {sections.map((s) => (
                        <section
                            key={s.id}
                            id={s.id}
                            className="scroll-mt-24 py-10 border-t border-gray-100"
                        >
                            <h2 className="text-[22px] font-bold tracking-tight leading-snug mb-5">{s.title}</h2>
                            <div className="text-[15px] leading-8 text-gray-600 space-y-3 [&_strong]:text-[#1d1d1f] [&_strong]:font-semibold">
                                {s.body}
                            </div>
                        </section>
                    ))}

                    {/* Footer action */}
                    <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <button
                            onClick={goBack}
                            className="flex items-center gap-2 rounded-lg bg-[#134e3a] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0c3326] transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                            رجوع
                        </button>
                        <div className="text-center sm:text-end">
                            <p className="text-[13px] text-gray-400">© 2026 SAGE Healthcare — جميع الحقوق محفوظة</p>
                            <p className="text-[12px] text-gray-400 mt-1">
                                للاستفسارات: <a href="mailto:support@sage-healthcare.com" className="text-[#134e3a] hover:underline">support@sage-healthcare.com</a>
                            </p>
                        </div>
                    </div>
                </main>

                {/* Sticky table of contents (desktop) */}
                <aside className="hidden lg:block">
                    <nav className="sticky top-24">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-4 px-3">
                            في هذه الصفحة
                        </p>
                        <ul className="space-y-0.5 border-r border-gray-100">
                            {sections.map((s, i) => {
                                const active = activeId === s.id;
                                return (
                                    <li key={s.id}>
                                        <a
                                            href={`#${s.id}`}
                                            onClick={(e) => scrollToSection(e, s.id)}
                                            className={`flex items-baseline gap-2.5 -mr-px border-r-2 pr-3 py-1.5 text-[13px] leading-6 transition-colors ${
                                                active
                                                    ? 'border-[#134e3a] text-[#134e3a] font-bold'
                                                    : 'border-transparent text-gray-500 hover:text-[#1d1d1f]'
                                            }`}
                                        >
                                            <span className="tabular-nums text-[11px] opacity-50 pt-0.5">{String(i + 1).padStart(2, '0')}</span>
                                            <span>{s.title}</span>
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                </aside>
            </div>
        </div>
    );
};

export default TermsOfService;

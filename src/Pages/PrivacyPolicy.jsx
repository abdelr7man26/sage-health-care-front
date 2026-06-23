import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/* ------------------------------------------------------------------ */
/*  Policy sections — data driven so the layout stays consistent       */
/* ------------------------------------------------------------------ */
const sections = [
    {
        id: 'controller',
        title: 'المسؤول عن معالجة البيانات',
        body: (
            <>
                <p><strong>الجهة:</strong> منصة SAGE للرعاية الصحية</p>
                <p><strong>البريد الإلكتروني للتواصل:</strong> privacy@sage-health.com</p>
                <p><strong>مسؤول حماية البيانات (DPO):</strong> يمكنك التواصل معه على نفس البريد الإلكتروني أعلاه.</p>
            </>
        ),
    },
    {
        id: 'data',
        title: 'البيانات التي نجمعها',
        body: (
            <>
                <p><strong>بيانات الحساب:</strong> الاسم، البريد الإلكتروني، رقم الهاتف، تاريخ الميلاد، الجنس.</p>
                <p><strong>البيانات الصحية (للمرضى):</strong> فصيلة الدم، الوزن، الطول، الأمراض المزمنة، الحساسيات، الأدوية الحالية، العمليات السابقة، التاريخ العائلي، الملفات والسجلات الطبية المرفوعة.</p>
                <p><strong>بيانات الحجوزات:</strong> مواعيد الكشف، الملاحظات الطبية، سعر الكشف.</p>
                <p><strong>بيانات الموقع الجغرافي:</strong> إحداثيات GPS المُبلَّغ عنها اختياريًا لحساب وقت الوصول إلى العيادة، ولا تُستخدم لأي غرض آخر.</p>
                <p><strong>بيانات الاستخدام:</strong> سجلات الجلسات، الإشعارات المُرسلة.</p>
            </>
        ),
    },
    {
        id: 'purposes',
        title: 'أغراض معالجة البيانات',
        body: (
            <ul className="list-disc pr-5 space-y-2 marker:text-[#2d6a4f]">
                <li>إنشاء وإدارة حسابك على المنصة.</li>
                <li>جدولة المواعيد الطبية وإدارة قوائم الانتظار.</li>
                <li>إرسال تذكيرات الأدوية والمواعيد عبر البريد الإلكتروني.</li>
                <li>تشغيل مساعد الذكاء الاصطناعي لتحليل الأعراض واقتراح التخصصات الطبية.</li>
                <li>حساب وقت الوصول المتوقع بناءً على موقعك الجغرافي (اختياري).</li>
                <li>تحسين جودة الخدمة وإعداد تقارير إحصائية مُجهَّلة الهوية.</li>
            </ul>
        ),
    },
    {
        id: 'sharing',
        title: 'مشاركة البيانات مع أطراف ثالثة',
        body: (
            <>
                <p>لا نبيع بياناتك ولا نشاركها تجارياً. نشارك بيانات محدودة فقط مع معالجي البيانات الآتيين:</p>
                <ul className="list-disc pr-5 space-y-3 marker:text-[#2d6a4f]">
                    <li><strong>الطبيب المختص:</strong> يطّلع على بياناتك الصحية اللازمة للكشف فقط.</li>
                    <li>
                        <strong>Groq, Inc. (الذكاء الاصطناعي):</strong> عند استخدام مساعد SAGE AI، تُرسَل الأعراض التي تُدخلها (فقط، دون بيانات تعريفية) إلى Groq API المُشغِّلة لنموذج llama-3.3-70b-versatile في الولايات المتحدة الأمريكية. تخضع هذه المعالجة لـ{' '}
                        <a href="https://groq.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-[#134e3a] underline underline-offset-2 hover:text-[#0c3326]">سياسة خصوصية Groq</a>.
                        يمكنك رفض هذه المعالجة بعدم استخدام مساعد الذكاء الاصطناعي.
                    </li>
                    <li><strong>خدمة OSRM (حساب وقت القيادة):</strong> عند تفعيل تتبع الموقع اختياريًا، تُرسَل إحداثيات GPS إلى خادم OSRM لحساب مسافة القيادة فقط. يمكنك رفض ذلك بعدم تفعيل تتبع الموقع.</li>
                    <li><strong>Gmail / Google (البريد الإلكتروني):</strong> تُستخدم خدمة Gmail لإرسال إشعارات وتذكيرات النظام إليك عبر بريدك الإلكتروني.</li>
                    <li><strong>السلطات المختصة:</strong> في حالات يقتضيها القانون المصري أو بأمر قضائي.</li>
                </ul>
                <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-[13px] font-bold text-[#1d1d1f] mb-1">تنبيه بشأن النقل الدولي</p>
                    <p className="text-[13px] leading-7 text-gray-500">
                        تُرسَل بيانات الذكاء الاصطناعي وبيانات الموقع إلى خوادم خارج مصر. باستخدامك لهذه الميزات فأنت توافق على هذا النقل الدولي وفق المادة (30) من قانون 151/2020.
                    </p>
                </div>
            </>
        ),
    },
    {
        id: 'encryption',
        title: 'تشفير البيانات وحمايتها',
        body: (
            <>
                <p>جميع البيانات الصحية الحساسة مشفّرة بمعيار <strong>AES-256-GCM</strong>، وهو المعيار الأعلى في الصناعة. يشمل ذلك:</p>
                <ul className="list-disc pr-5 space-y-2 marker:text-[#2d6a4f]">
                    <li>بيانات الملف الصحي (الأمراض، الأدوية، التاريخ الجراحي) — مشفّرة في قاعدة البيانات.</li>
                    <li>ملاحظات الكشف الطبي والزيارات الفورية.</li>
                    <li>الملفات الطبية المرفوعة (PDF، صور الأشعة) — مخزّنة في <strong>Cloudflare R2</strong> مع تشفير كامل على مستوى الخادم (SSE-AES-256)، ولا يمكن الوصول إليها إلا عبر روابط مؤقتة موقّعة.</li>
                    <li>إحداثيات GPS — مشفّرة في قاعدة البيانات ولا تُرسَل لأي خادم خارجي في بيئة الإنتاج.</li>
                </ul>
                <p>يتم نقل البيانات عبر HTTPS مشفّر (TLS 1.2/1.3)، وتُحفظ كلمات المرور بخوارزمية bcrypt ولا يمكن استرجاعها.</p>
            </>
        ),
    },
    {
        id: 'retention',
        title: 'مدة الاحتفاظ بالبيانات',
        body: (
            <>
                <p>نحتفظ ببياناتك طوال فترة نشاط حسابك. عند طلب حذف الحساب:</p>
                <ul className="list-disc pr-5 space-y-2 marker:text-[#2d6a4f]">
                    <li>تُحذف بيانات الملف الشخصي والصحي فور معالجة الطلب.</li>
                    <li>سجلات الحجوزات المكتملة تُحذف خلال 30 يوماً (لأغراض المحاسبة).</li>
                    <li>سجلات النظام التشغيلية (logs) تُحذف خلال 90 يوماً.</li>
                </ul>
            </>
        ),
    },
    {
        id: 'rights',
        title: 'حقوقك بموجب قانون 151/2020',
        body: (
            <>
                <ul className="list-disc pr-5 space-y-2 marker:text-[#2d6a4f]">
                    <li><strong>حق الوصول:</strong> يمكنك طلب نسخة من بياناتك المحفوظة في أي وقت.</li>
                    <li><strong>حق التنقل (Portability):</strong> يمكنك تحميل نسخة كاملة من جميع بياناتك الشخصية بصيغة JSON من خلال إعدادات حسابك.</li>
                    <li><strong>حق التصحيح:</strong> يمكنك تعديل بياناتك من خلال صفحة الملف الشخصي مباشرةً.</li>
                    <li><strong>حق الحذف:</strong> يمكنك طلب حذف حسابك وجميع بياناتك من إعدادات الحساب.</li>
                    <li><strong>حق الاعتراض:</strong> يمكنك الاعتراض على معالجة بياناتك لأغراض معينة.</li>
                    <li><strong>حق سحب الموافقة:</strong> يمكنك سحب موافقتك في أي وقت دون أن يؤثر ذلك على مشروعية المعالجة السابقة.</li>
                </ul>
                <p>لممارسة أي من هذه الحقوق، تواصل معنا عبر: <strong>privacy@sage-health.com</strong></p>
            </>
        ),
    },
    {
        id: 'breach',
        title: 'الإخطار بانتهاكات البيانات',
        body: (
            <p>
                في حالة حدوث أي اختراق أمني يؤثر على بياناتك، سنقوم بإخطارك ومركز حماية البيانات الشخصية خلال{' '}
                <strong>72 ساعة</strong> من اكتشاف الانتهاك وفق المادة (26) من القانون.
            </p>
        ),
    },
    {
        id: 'updates',
        title: 'تحديثات السياسة',
        body: (
            <p>
                قد نُحدّث هذه السياسة دورياً. سنُخطرك بأي تغييرات جوهرية عبر البريد الإلكتروني المسجّل. استمرارك في استخدام المنصة بعد نشر التحديثات يعني موافقتك عليها.
            </p>
        ),
    },
];

const PrivacyPolicy = () => {
    const navigate = useNavigate();
    const [activeId, setActiveId] = useState(sections[0].id);

    // The page is sometimes opened in a fresh tab (e.g. from the registration
    // screen) where there is no in-app history to step back to — fall back home.
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
                    <span className="text-[13px] font-medium text-white/70">سياسة الخصوصية</span>
                </div>
            </header>

            {/* Hero */}
            <div className="bg-gradient-to-b from-[#134e3a] to-[#0f4230] text-white">
                <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-10 pb-16">
                    <p className="text-[13px] font-semibold text-[#9fd3bb] mb-3">حماية البيانات والخصوصية</p>
                    <h1 className="text-3xl sm:text-[40px] font-extrabold tracking-tight leading-[1.15] mb-4">
                        سياسة الخصوصية
                    </h1>
                    <p className="text-white/75 text-[15px] max-w-2xl leading-8">
                        وفق أحكام قانون حماية البيانات الشخصية المصري رقم 151 لسنة 2020 ولائحته التنفيذية.
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
                        تلتزم منصة <strong>SAGE</strong> بحماية خصوصيتك ومعالجة بياناتك الشخصية بشفافية ومسؤولية.
                        توضّح هذه السياسة ما نجمعه من بيانات، وكيف نستخدمها، ومع من نشاركها، وحقوقك كاملةً.
                        باستخدامك للمنصة فأنت تقرّ بقراءة هذه السياسة والموافقة عليها.
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
                        <p className="text-[13px] text-gray-400">© 2026 SAGE Healthcare — جميع الحقوق محفوظة</p>
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

export default PrivacyPolicy;

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getErrorLogs } from '../../../Services/adminService';
import { Pagination, inputCls, filterBtnCls } from '../adminShared';
import { useDebounced } from '../../../hooks/useDebounced';

// ── Error Logs section ────────────────────────────────────────────────────────

// Maps technical error patterns → human-readable Arabic cards
const ERROR_CATEGORIES = [
    {
        pattern:  /mongo|mongoose|mongoclient|MongoServer/i,
        title:    'مشكلة في قاعدة البيانات',
        desc:     'النظام لم يتمكن من الوصول إلى قاعدة البيانات أو تخزين البيانات فيها.',
        fix:      'تأكد من تشغيل MongoDB وأن الاتصال بها سليم.',
        affected: 'جميع المستخدمين',
        icon:     'storage',
        severity: 'high',
        border:   'border-red-500/30',
        iconBg:   'bg-red-500/20',
        iconText: 'text-red-400',
        badge:    'bg-red-500/15 text-red-400',
    },
    {
        pattern:  /redis|ioredis|ECONNREFUSED.*6379/i,
        title:    'مشكلة في خدمة التخزين المؤقت',
        desc:     'توقّفت خدمة Redis عن العمل مما يؤثر على سرعة الاستجابة وجلسات المستخدمين.',
        fix:      'تأكد من تشغيل Redis على البورت الصحيح.',
        affected: 'جلسات الدخول وسرعة النظام',
        icon:     'memory',
        severity: 'high',
        border:   'border-amber-500/30',
        iconBg:   'bg-amber-500/20',
        iconText: 'text-amber-400',
        badge:    'bg-amber-500/15 text-amber-400',
    },
    {
        pattern:  /\[AI|ai.?engine|python|fastapi|chromadb|langchain|ECONNREFUSED.*8000/i,
        title:    'مشكلة في المساعد الذكي',
        desc:     'محرك الذكاء الاصطناعي غير متاح حالياً، لن يتمكن المستخدمون من استخدام المساعد الطبي.',
        fix:      'تأكد من تشغيل خدمة Python على البورت 8000.',
        affected: 'خدمة المساعد الذكي',
        icon:     'psychology',
        severity: 'medium',
        border:   'border-violet-500/30',
        iconBg:   'bg-violet-500/20',
        iconText: 'text-violet-400',
        badge:    'bg-violet-500/15 text-violet-400',
    },
    {
        pattern:  /email|smtp|nodemailer|sendmail|ECONNECTION|EAUTH/i,
        title:    'مشكلة في إرسال البريد الإلكتروني',
        desc:     'فشل النظام في إرسال رسالة بريد إلكتروني لأحد المستخدمين (تأكيد، إشعار، إلخ).',
        fix:      'تحقق من إعدادات SMTP وبيانات الاعتماد في ملف .env.',
        affected: 'إشعارات البريد الإلكتروني',
        icon:     'mail',
        severity: 'low',
        border:   'border-blue-500/30',
        iconBg:   'bg-blue-500/20',
        iconText: 'text-blue-400',
        badge:    'bg-blue-500/15 text-blue-400',
    },
    {
        pattern:  /jwt|token|JsonWebToken|invalid signature|expired/i,
        title:    'مشكلة في التحقق من الهوية',
        desc:     'حدث خطأ أثناء التحقق من جلسة مستخدم أو رمز الدخول.',
        fix:      'قد يكون الرمز منتهي الصلاحية — المستخدم سيُطلب منه تسجيل الدخول مجدداً.',
        affected: 'تسجيل دخول المستخدمين',
        icon:     'lock',
        severity: 'low',
        border:   'border-cyan-500/30',
        iconBg:   'bg-cyan-500/20',
        iconText: 'text-cyan-400',
        badge:    'bg-cyan-500/15 text-cyan-400',
    },
    {
        pattern:  /booking|appointment|slot|schedule/i,
        title:    'مشكلة في نظام الحجوزات',
        desc:     'حدث خطأ أثناء معالجة حجز طبي أو جدولة موعد.',
        fix:      'راجع تفاصيل الخطأ للتعرف على الحجز المتأثر.',
        affected: 'حجوزات المرضى',
        icon:     'calendar_month',
        severity: 'medium',
        border:   'border-emerald-500/30',
        iconBg:   'bg-emerald-500/20',
        iconText: 'text-emerald-400',
        badge:    'bg-emerald-500/15 text-emerald-400',
    },
    {
        pattern:  /push|notification|web.?push|vapid/i,
        title:    'مشكلة في الإشعارات الفورية',
        desc:     'فشل إرسال إشعار فوري لأحد المستخدمين.',
        fix:      'تحقق من إعدادات Web Push وشهادات VAPID.',
        affected: 'الإشعارات الفورية',
        icon:     'notifications',
        severity: 'low',
        border:   'border-slate-600/50',
        iconBg:   'bg-slate-700',
        iconText: 'text-slate-400',
        badge:    'bg-slate-700 text-slate-400',
    },
];

const SEVERITY_LABEL = {
    high:   { label: 'خطورة عالية',   bg: 'bg-red-500/20',    text: 'text-red-400' },
    medium: { label: 'خطورة متوسطة', bg: 'bg-amber-500/20',  text: 'text-amber-400' },
    low:    { label: 'خطورة منخفضة', bg: 'bg-slate-700',     text: 'text-slate-400' },
};

const DEFAULT_CATEGORY = {
    title:    'خطأ في السيرفر',
    desc:     'حدث خطأ غير متوقع في النظام.',
    fix:      'راجع التفاصيل التقنية لمزيد من المعلومات.',
    affected: 'قد يؤثر على بعض الوظائف',
    icon:     'warning',
    severity: 'medium',
    border:   'border-red-500/20',
    iconBg:   'bg-red-500/15',
    iconText: 'text-red-400',
    badge:    'bg-red-500/15 text-red-400',
};

function categorize(msg = '') {
    for (const cat of ERROR_CATEGORIES) {
        if (cat.pattern.test(msg)) return cat;
    }
    return DEFAULT_CATEGORY;
}

function fmtRelative(ts) {
    if (!ts) return '—';
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1)   return 'الآن';
    if (m < 60)  return `منذ ${m} دقيقة`;
    if (h < 24)  return `منذ ${h} ساعة`;
    if (d < 7)   return `منذ ${d} يوم`;
    return new Date(ts).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
}

function ErrorLogsSection() {
    const [data, setData]             = useState([]);
    const [total, setTotal]           = useState(0);
    const [todayCount, setTodayCount] = useState(0);
    const [serverCatCounts, setSCC]   = useState(null);
    const [pages, setPages]           = useState(1);
    const [page, setPage]             = useState(1);
    const [loading, setLoading]       = useState(true);
    const [loadError, setErr]         = useState(false);
    const [search, setSearch]         = useState('');
    const [expanded, setExpanded]     = useState(null);
    const [catFilter, setCatF]        = useState('');
    const dSearch = useDebounced(search);

    const load = useCallback((p = 1) => {
        setLoading(true);
        setErr(false);
        const params = { page: p, limit: 40 };
        if (dSearch.trim()) params.search = dSearch.trim();
        getErrorLogs(params)
            .then((r) => {
                setData(r.data?.logs || []);
                setTodayCount(r.data?.todayCount ?? 0);
                setSCC(r.data?.categoryCounts ?? null);
                setTotal(r.data?.pagination?.total || 0);
                setPages(r.data?.pagination?.pages || 1);
                setPage(p);
            })
            .catch(() => setErr(true))
            .finally(() => setLoading(false));
    }, [dSearch]);

    useEffect(() => { load(1); }, [load]);

    // Category filter applied client-side on current page
    const displayed = catFilter
        ? data.filter(log => categorize(log.message || '').title === catFilter)
        : data;

    // Server counts cover the whole log, not just this page;
    // fall back to a page-level tally if the API didn't send them.
    const catCounts = serverCatCounts ?? data.reduce((acc, log) => {
        const t = categorize(log.message || '').title;
        acc[t] = (acc[t] || 0) + 1;
        return acc;
    }, {});



    return (
        <div dir="rtl">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-red-400 text-[20px]">warning</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-100 leading-tight">مشاكل النظام</h2>
                        <p className="text-sm text-slate-500 mt-0.5">سجل بسيط لكل خطأ حدث في المنصة</p>
                    </div>
                </div>
                <button onClick={() => load(1)} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors disabled:opacity-40"
                >
                    <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
                    تحديث
                </button>
            </div>

            {/* Summary strip */}
            {!loading && !loadError && total > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 text-center">
                        <p className="text-2xl font-black text-red-400">{total}</p>
                        <p className="text-xs text-slate-500 mt-1">إجمالي الأخطاء</p>
                    </div>
                    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 text-center">
                        <p className={`text-2xl font-black ${todayCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{todayCount}</p>
                        <p className="text-xs text-slate-500 mt-1">أخطاء اليوم</p>
                    </div>
                    <div className="bg-slate-900 rounded-2xl p-4 border border-red-800/30 text-center col-span-2">
                        <p className="text-xs text-slate-500 mb-2">الأكثر تكراراً</p>
                        {Object.entries(catCounts).sort((a,b) => b[1]-a[1]).slice(0,1).map(([t, c]) => (
                            <p key={t} className="text-sm font-black text-red-300">{t} <span className="text-slate-500 font-normal">({c} مرة)</span></p>
                        ))}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-5">
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && load(1)}
                    placeholder="ابحث عن مشكلة معينة..."
                    className={`${inputCls} flex-1 min-w-48`}
                />
                <div className="flex flex-col gap-0.5">
                    <select value={catFilter} onChange={(e) => setCatF(e.target.value)} className={inputCls}>
                        <option value="">كل المشاكل</option>
                        {ERROR_CATEGORIES.map(c => (
                            <option key={c.title} value={c.title}>{c.title}</option>
                        ))}
                        <option value="خطأ في السيرفر">خطأ في السيرفر</option>
                    </select>
                    {catFilter && <span className="text-[10px] text-slate-600 px-1">يُطبَّق على الصفحة الحالية فقط</span>}
                </div>
                <button onClick={() => load(1)} className={filterBtnCls}>بحث</button>
                {(search || catFilter) && (
                    <button onClick={() => { setSearch(''); setCatF(''); }}
                        className="px-3 py-2.5 rounded-xl border border-slate-700 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >مسح الفلتر</button>
                )}
            </div>

            {loadError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center">
                    <span className="material-symbols-outlined text-red-400 text-[40px] block mb-3">cloud_off</span>
                    <p className="text-red-400 font-bold text-base">تعذّر تحميل سجل المشاكل</p>
                    <p className="text-slate-600 text-sm mt-1">تأكد من أن السيرفر يعمل وملف الأخطاء موجود</p>
                </div>
            )}

            {/* Error cards */}
            {!loadError && (
                <div className="space-y-3">
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-800 animate-pulse flex-shrink-0" />
                                    <div className="flex-1 space-y-2.5">
                                        <div className="h-4 bg-slate-800 rounded-full animate-pulse w-1/3" />
                                        <div className="h-3 bg-slate-800 rounded-full animate-pulse w-2/3" />
                                        <div className="h-3 bg-slate-800 rounded-full animate-pulse w-1/2" />
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : displayed.length === 0 ? (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center">
                            <span className="material-symbols-outlined text-[56px] text-emerald-700 block mb-4">verified</span>
                            <p className="text-slate-300 font-black text-xl">كل شيء يعمل بشكل ممتاز!</p>
                            <p className="text-slate-600 text-sm mt-2">لم يُسجَّل أي خطأ حتى الآن</p>
                        </div>
                    ) : displayed.map((log, i) => {
                        const cat      = categorize(log.message || '');
                        const sev      = SEVERITY_LABEL[cat.severity];
                        const isOpen   = expanded === i;
                        const relTime  = fmtRelative(log.timestamp);
                        const absTime  = log.timestamp
                            ? new Date(log.timestamp).toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : '—';

                        return (
                            <motion.div key={i} layout
                                className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all ${isOpen ? cat.border : 'border-slate-800 hover:border-slate-700'}`}
                            >
                                {/* Card header */}
                                <div className="flex items-start gap-4 p-5">
                                    {/* Icon */}
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${cat.iconBg}`}>
                                        <span className={`material-symbols-outlined text-[22px] ${cat.iconText}`}>{cat.icon}</span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <h3 className="font-black text-slate-100 text-sm">{cat.title}</h3>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${sev.bg} ${sev.text}`}>
                                                {sev.label}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-400 leading-relaxed mb-3">{cat.desc}</p>

                                        {/* Meta row */}
                                        <div className="flex flex-wrap items-center gap-3">
                                            {/* Affected */}
                                            <div className="flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-[14px] text-slate-600">person</span>
                                                <span className="text-xs text-slate-500">المتأثرون: <span className="text-slate-300 font-semibold">{cat.affected}</span></span>
                                            </div>
                                            {/* Time */}
                                            <div className="flex items-center gap-1.5" title={absTime}>
                                                <span className="material-symbols-outlined text-[14px] text-slate-600">schedule</span>
                                                <span className="text-xs text-slate-500">{relTime}</span>
                                            </div>
                                            {/* What to do */}
                                            <div className="flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-[14px] text-emerald-600">lightbulb</span>
                                                <span className="text-xs text-emerald-700">{cat.fix}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expand button */}
                                    <button
                                        onClick={() => setExpanded(isOpen ? null : i)}
                                        className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">code</span>
                                        {isOpen ? 'إخفاء' : 'التفاصيل'}
                                    </button>
                                </div>

                                {/* Technical details — hidden by default */}
                                <AnimatePresence>
                                    {isOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <div className="border-t border-slate-800 bg-slate-950 p-4">
                                                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">التفاصيل التقنية (للمطورين)</p>
                                                <p className="text-xs text-slate-400 mb-1 font-semibold">الرسالة:</p>
                                                <p className="text-xs text-amber-300/80 font-mono mb-3 leading-relaxed bg-slate-900 rounded-xl p-3 break-all">
                                                    {log.message || '(لا توجد رسالة)'}
                                                </p>
                                                {log.stack && (
                                                    <>
                                                        <p className="text-xs text-slate-400 mb-1 font-semibold">Stack Trace:</p>
                                                        <pre className="text-[11px] text-red-300/60 overflow-x-auto leading-relaxed whitespace-pre-wrap font-mono bg-slate-900 rounded-xl p-3 max-h-48 overflow-y-auto">
                                                            {log.stack}
                                                        </pre>
                                                    </>
                                                )}
                                                <p className="text-[10px] text-slate-700 mt-2">التوقيت الدقيق: {absTime}</p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            <div className="mt-5"><Pagination page={page} pages={pages} onPage={load} /></div>
        </div>
    );
}


export { ErrorLogsSection };

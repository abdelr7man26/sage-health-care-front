import { useState, useEffect, useCallback, useRef } from 'react';
import { getOpsCenter, updateInfraConfig } from '../../../Services/adminService';

// ── Ops Center ────────────────────────────────────────────────────────────────

// Cron job presentation: groups, status styling, and human-readable frequency.
const CRON_GROUPS = [
    { id: 'reminders',   label: 'تذكيرات المرضى' },
    { id: 'maintenance', label: 'صيانة وتنظيف' },
    { id: 'monitoring',  label: 'مراقبة وصحة' },
];
const CRON_STATUS_META = {
    ok:      { label: 'يعمل',    dot: 'bg-emerald-500',              pill: 'bg-emerald-500/10 text-emerald-400', border: 'border-slate-800' },
    stale:   { label: 'متأخر',   dot: 'bg-red-500 animate-pulse',    pill: 'bg-red-500/10 text-red-400',         border: 'border-red-500/30 bg-red-500/5' },
    pending: { label: 'لم يبدأ', dot: 'bg-slate-600',                pill: 'bg-slate-700/40 text-slate-400',     border: 'border-slate-800' },
};
// Maps the expected interval (seconds) to an Arabic cadence label.
const cronFreq = (sec) => {
    if (sec <= 60)      return 'كل دقيقة';
    if (sec < 3600)     return `كل ${Math.round(sec / 60)} دقائق`;
    if (sec === 3600)   return 'كل ساعة';
    if (sec <= 86400)   return 'يومياً';
    if (sec <= 604800)  return 'أسبوعياً';
    return 'شهرياً';
};

// Small table for request-traffic routes (slowest / busiest).
function RouteTable({ title, icon, rows, metric }) {
    return (
        <div className="bg-slate-800/40 rounded-xl p-3">
            <p className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-slate-500">{icon}</span>
                {title}
            </p>
            {rows?.length ? (
                <div className="space-y-1">
                    {rows.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px] py-1 border-b border-slate-800/60 last:border-0">
                            <span className="font-mono text-slate-400 truncate flex-1" dir="ltr" title={r.route}>{r.route}</span>
                            {r.errors > 0 && <span className="text-red-400 tabular-nums flex-shrink-0" title="أخطاء">⚠ {r.errors.toLocaleString('ar-EG')}</span>}
                            {metric === 'avg'
                                ? <span className={`font-bold tabular-nums flex-shrink-0 ${r.avgMs >= 500 ? 'text-amber-400' : 'text-slate-300'}`}>{r.avgMs.toLocaleString('ar-EG')} مس</span>
                                : <span className="font-bold tabular-nums flex-shrink-0 text-slate-300">{r.count.toLocaleString('ar-EG')}</span>}
                        </div>
                    ))}
                </div>
            ) : <p className="text-[11px] text-slate-600 py-2">لا توجد بيانات</p>}
        </div>
    );
}

function OpsCenterSection({ liveTick }) {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving]   = useState(false);
    const [form, setForm]       = useState({ domain: {}, vps: {}, ssl: {} });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getOpsCenter();
            setData(res.data);
            const ic = res.data.infraConfig;
            setForm({
                domain: {
                    name:       ic?.domain?.name       || '',
                    expiryDate: ic?.domain?.expiryDate ? ic.domain.expiryDate.split('T')[0] : '',
                    registrar:  ic?.domain?.registrar  || '',
                },
                vps: {
                    provider:    ic?.vps?.provider    || '',
                    renewalDate: ic?.vps?.renewalDate ? ic.vps.renewalDate.split('T')[0] : '',
                    plan:        ic?.vps?.plan        || '',
                },
                ssl: {
                    provider:   ic?.ssl?.provider   || '',
                    expiryDate: ic?.ssl?.expiryDate ? ic.ssl.expiryDate.split('T')[0] : '',
                    autoRenew:  ic?.ssl?.autoRenew  ?? true,
                },
            });
        } catch { /* silent */ }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // Live refetch on real-time events (skip the initial mount). Don't clobber the
    // infra form while the admin is editing it.
    const liveFirst = useRef(true);
    useEffect(() => {
        if (liveFirst.current) { liveFirst.current = false; return; }
        if (!editMode) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveTick]);

    const saveInfra = async () => {
        setSaving(true);
        try {
            await updateInfraConfig(form);
            await load();
            setEditMode(false);
        } catch { /* silent */ }
        setSaving(false);
    };

    const daysUntil = (dateStr) => {
        if (!dateStr) return null;
        const diff = new Date(dateStr) - new Date();
        return Math.ceil(diff / 86400000);
    };

    const renewalColor = (days) => {
        if (days === null) return 'text-slate-500';
        if (days <= 14)  return 'text-red-400';
        if (days <= 30)  return 'text-amber-400';
        return 'text-emerald-400';
    };

    const renewalBorder = (days) => {
        if (days === null) return 'border-slate-700';
        if (days <= 14)  return 'border-red-500/40';
        if (days <= 30)  return 'border-amber-500/40';
        return 'border-emerald-500/20';
    };

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
    const fmtLastRun = (iso) => {
        if (!iso) return null;
        const d = new Date(iso);
        const diffMin = Math.floor((Date.now() - d) / 60000);
        if (diffMin < 60)   return `منذ ${diffMin} دقيقة`;
        if (diffMin < 1440) return `منذ ${Math.floor(diffMin / 60)} ساعة`;
        return `منذ ${Math.floor(diffMin / 1440)} يوم`;
    };

    const infraItems = data ? [
        { label: 'Domain', icon: 'language',   days: daysUntil(data.infraConfig?.domain?.expiryDate), date: data.infraConfig?.domain?.expiryDate, sub: data.infraConfig?.domain?.name || '—' },
        { label: 'VPS',    icon: 'dns',        days: daysUntil(data.infraConfig?.vps?.renewalDate),   date: data.infraConfig?.vps?.renewalDate,   sub: data.infraConfig?.vps?.provider || '—' },
        { label: 'SSL',    icon: 'lock',       days: daysUntil(data.infraConfig?.ssl?.expiryDate),    date: data.infraConfig?.ssl?.expiryDate,    sub: data.infraConfig?.ssl?.autoRenew ? 'تجديد تلقائي' : 'تجديد يدوي' },
    ] : [];

    const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 placeholder-slate-600';

    return (
        <div className="space-y-6" dir="rtl">

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-slate-100">مركز العمليات</h2>
                    <p className="text-sm text-slate-500 mt-0.5">مراقبة البنية التحتية والأمان والمهام المجدولة</p>
                </div>
                <button onClick={load} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50">
                    <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
                    تحديث
                </button>
            </div>

            {/* ── Infrastructure Renewals ── */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[20px] text-blue-400">calendar_month</span>
                        <h3 className="font-bold text-slate-200">تجديدات البنية التحتية</h3>
                    </div>
                    <button onClick={() => setEditMode(e => !e)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">{editMode ? 'close' : 'edit'}</span>
                        {editMode ? 'إلغاء' : 'تعديل'}
                    </button>
                </div>

                {!editMode ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {loading ? Array.from({length:3}).map((_,i) => (
                            <div key={i} className="h-24 bg-slate-800 rounded-xl animate-pulse" />
                        )) : infraItems.map(({ label, icon, days, date, sub }) => (
                            <div key={label} className={`bg-slate-950 rounded-xl p-4 border ${renewalBorder(days)}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`material-symbols-outlined text-[18px] ${renewalColor(days)}`}>{icon}</span>
                                    <span className="font-bold text-slate-300 text-sm">{label}</span>
                                    {days !== null && days <= 30 && (
                                        <span className={`mr-auto text-xs font-bold px-2 py-0.5 rounded-lg ${days <= 14 ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                                            {days <= 0 ? 'منتهي!' : `${days} يوم`}
                                        </span>
                                    )}
                                </div>
                                <p className={`text-xl font-black ${renewalColor(days)}`}>
                                    {days === null ? '—' : days <= 0 ? 'منتهي' : `${days} يوم`}
                                </p>
                                <p className="text-xs text-slate-600 mt-1">{fmtDate(date)}</p>
                                <p className="text-xs text-slate-600">{sub}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Domain */}
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Domain</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <input className={inputCls} placeholder="اسم الدومين" value={form.domain.name} onChange={e => setForm(f => ({...f, domain: {...f.domain, name: e.target.value}}))} />
                                <input className={inputCls} type="date" value={form.domain.expiryDate} onChange={e => setForm(f => ({...f, domain: {...f.domain, expiryDate: e.target.value}}))} />
                                <input className={inputCls} placeholder="شركة التسجيل" value={form.domain.registrar} onChange={e => setForm(f => ({...f, domain: {...f.domain, registrar: e.target.value}}))} />
                            </div>
                        </div>
                        {/* VPS */}
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">VPS</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <input className={inputCls} placeholder="المزود (DigitalOcean / Hetzner)" value={form.vps.provider} onChange={e => setForm(f => ({...f, vps: {...f.vps, provider: e.target.value}}))} />
                                <input className={inputCls} type="date" value={form.vps.renewalDate} onChange={e => setForm(f => ({...f, vps: {...f.vps, renewalDate: e.target.value}}))} />
                                <input className={inputCls} placeholder="الباقة" value={form.vps.plan} onChange={e => setForm(f => ({...f, vps: {...f.vps, plan: e.target.value}}))} />
                            </div>
                        </div>
                        {/* SSL */}
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">SSL</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <input className={inputCls} placeholder="المزود" value={form.ssl.provider} onChange={e => setForm(f => ({...f, ssl: {...f.ssl, provider: e.target.value}}))} />
                                <input className={inputCls} type="date" value={form.ssl.expiryDate} onChange={e => setForm(f => ({...f, ssl: {...f.ssl, expiryDate: e.target.value}}))} />
                                <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                                    <input type="checkbox" checked={form.ssl.autoRenew} onChange={e => setForm(f => ({...f, ssl: {...f.ssl, autoRenew: e.target.checked}}))} className="accent-emerald-500" />
                                    تجديد تلقائي
                                </label>
                            </div>
                        </div>
                        <button onClick={saveInfra} disabled={saving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                            {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            حفظ التغييرات
                        </button>
                    </div>
                )}
            </div>

            {/* ── Security Events ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-[18px] text-red-400">gpp_bad</span>
                        <p className="font-bold text-slate-300 text-sm">هجمات Brute Force اليوم</p>
                    </div>
                    {loading ? <div className="h-8 w-16 bg-slate-800 rounded animate-pulse" /> : (
                        <p className={`text-3xl font-black ${(data?.breach?.bruteforceToday || 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {data?.breach?.bruteforceToday || 0}
                        </p>
                    )}
                    <p className="text-xs text-slate-600 mt-1">محاولات دخول مشبوهة</p>
                </div>
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-[18px] text-amber-400">warning</span>
                        <p className="font-bold text-slate-300 text-sm">طلبات غير مصرّح بها اليوم</p>
                    </div>
                    {loading ? <div className="h-8 w-16 bg-slate-800 rounded animate-pulse" /> : (
                        <p className={`text-3xl font-black ${(data?.breach?.highRateToday || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {data?.breach?.highRateToday || 0}
                        </p>
                    )}
                    <p className="text-xs text-slate-600 mt-1">ارتفاعات معدل الطلبات المرفوضة</p>
                </div>
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-[18px] text-emerald-400">shield</span>
                        <p className="font-bold text-slate-300 text-sm">حالة الحماية</p>
                    </div>
                    <p className="text-sm font-bold text-emerald-400">نشطة</p>
                    <p className="text-xs text-slate-600 mt-1">Brute Force + Rate Detector</p>
                </div>
            </div>

            {/* ── Security Log ── */}
            {!loading && data?.breach?.securityLog?.length > 0 && (
                <div className="bg-slate-900 rounded-2xl border border-red-500/20 p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined text-[18px] text-red-400">history</span>
                        <h3 className="font-bold text-slate-200">آخر الأحداث الأمنية</h3>
                    </div>
                    <div className="space-y-2">
                        {data.breach.securityLog.map((ev, i) => {
                            const parsed = typeof ev === 'string' ? JSON.parse(ev) : ev;
                            return (
                                <div key={i} className="flex items-start gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                                    <span className={`material-symbols-outlined text-[16px] mt-0.5 ${parsed.type === 'brute_force' ? 'text-red-400' : 'text-amber-400'}`}>
                                        {parsed.type === 'brute_force' ? 'gpp_bad' : 'warning'}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-300">{parsed.detail}</p>
                                        <p className="text-xs text-slate-600 mt-0.5">{new Date(parsed.ts).toLocaleString('ar-EG')}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Request Traffic ── */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
                <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[20px] text-blue-400">swap_vert</span>
                    <h3 className="font-bold text-slate-200">حركة الطلبات</h3>
                    <span className="text-xs text-slate-600">(اليوم)</span>
                </div>
                {loading ? (
                    <div className="h-40 bg-slate-800 rounded-xl animate-pulse" />
                ) : !data?.requestMetrics?.statusBreakdown?.total ? (
                    <p className="text-sm text-slate-600 py-6 text-center">لا توجد طلبات مسجّلة اليوم بعد</p>
                ) : (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                            <div className="bg-slate-800/60 rounded-xl p-3">
                                <p className="text-[11px] text-slate-500 mb-1">إجمالي الطلبات</p>
                                <p className="text-2xl font-black text-blue-400">{data.requestMetrics.statusBreakdown.total.toLocaleString('ar-EG')}</p>
                            </div>
                            <div className="bg-slate-800/60 rounded-xl p-3">
                                <p className="text-[11px] text-slate-500 mb-1">ناجحة (2xx/3xx)</p>
                                <p className="text-2xl font-black text-emerald-400">{data.requestMetrics.statusBreakdown.ok.toLocaleString('ar-EG')}</p>
                            </div>
                            <div className="bg-slate-800/60 rounded-xl p-3">
                                <p className="text-[11px] text-slate-500 mb-1">أخطاء العميل (4xx)</p>
                                <p className="text-2xl font-black text-amber-400">{data.requestMetrics.statusBreakdown.c4xx.toLocaleString('ar-EG')}</p>
                            </div>
                            <div className={`bg-slate-800/60 rounded-xl p-3 ${data.requestMetrics.statusBreakdown.c5xx > 0 ? 'ring-1 ring-red-500/40' : ''}`}>
                                <p className="text-[11px] text-slate-500 mb-1">أخطاء الخادم (5xx)</p>
                                <p className="text-2xl font-black text-red-400">{data.requestMetrics.statusBreakdown.c5xx.toLocaleString('ar-EG')}</p>
                            </div>
                        </div>
                        <div className="mb-5">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-500">نسبة الأخطاء</span>
                                <span className={`text-xs font-bold ${data.requestMetrics.statusBreakdown.errorRate >= 10 ? 'text-red-400' : data.requestMetrics.statusBreakdown.errorRate >= 3 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {data.requestMetrics.statusBreakdown.errorRate}%
                                </span>
                            </div>
                            <div className="bg-slate-800 rounded-full h-2 overflow-hidden">
                                <div className={`h-2 rounded-full ${data.requestMetrics.statusBreakdown.errorRate >= 10 ? 'bg-red-500' : data.requestMetrics.statusBreakdown.errorRate >= 3 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(100, data.requestMetrics.statusBreakdown.errorRate)}%` }} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <RouteTable title="أبطأ المسارات (متوسط الزمن)" icon="timer" rows={data.requestMetrics.slowest} metric="avg" />
                            <RouteTable title="أكثر المسارات طلباً" icon="local_fire_department" rows={data.requestMetrics.busiest} metric="count" />
                        </div>
                    </>
                )}
            </div>

            {/* ── Cron Jobs ── */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
                <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[20px] text-violet-400">schedule</span>
                    <h3 className="font-bold text-slate-200">حالة المهام المجدولة</h3>
                    {!loading && data?.cronJobs?.length > 0 && (
                        <span className="text-xs text-slate-600">({data.cronJobs.length} مهمة)</span>
                    )}
                </div>
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Array.from({length:8}).map((_,i) => <div key={i} className="h-12 bg-slate-800 rounded-xl animate-pulse" />)}
                    </div>
                ) : (
                    CRON_GROUPS.map(({ id, label }) => {
                        const jobs = (data?.cronJobs || []).filter(j => j.group === id);
                        if (!jobs.length) return null;
                        return (
                            <div key={id} className="mb-5 last:mb-0">
                                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">{label}</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {jobs.map(job => {
                                        const meta = CRON_STATUS_META[job.status] || CRON_STATUS_META.pending;
                                        const ago  = fmtLastRun(job.lastRun);
                                        return (
                                            <div key={job.key} className={`flex items-center gap-3 p-3 rounded-xl border ${meta.border}`}>
                                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-semibold text-slate-300 truncate">{job.label}</p>
                                                        <span className="text-[10px] text-slate-600 flex-shrink-0">· {cronFreq(job.every)}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-600">{ago || 'لم يعمل بعد'}</p>
                                                </div>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${meta.pill}`}>
                                                    {meta.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

        </div>
    );
}


export { OpsCenterSection };

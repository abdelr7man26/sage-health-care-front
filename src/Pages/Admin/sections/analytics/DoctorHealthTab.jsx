import { useState, useEffect, useCallback } from 'react';
import { getDoctorHealth } from '../../../../Services/adminService';
import { SkeletonRows, inputCls, ErrorState } from '../../adminShared';

// ── Doctor Health sub-tab ─────────────────────────────────────────────────────

const RISK_META = {
    EXCELLENT: { label: 'ممتاز',  icon: 'verified',       bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/20', bar: 'bg-emerald-500' },
    STABLE:    { label: 'مستقر',  icon: 'check_circle',   bg: 'bg-blue-500/20',    text: 'text-blue-400',    border: 'border-blue-500/20',    bar: 'bg-blue-500' },
    WARNING:   { label: 'تحذير',  icon: 'warning',        bg: 'bg-amber-500/20',   text: 'text-amber-400',   border: 'border-amber-500/20',   bar: 'bg-amber-500' },
    CRITICAL:  { label: 'حرج',    icon: 'emergency_home', bg: 'bg-red-500/20',     text: 'text-red-400',     border: 'border-red-500/20',     bar: 'bg-red-500' },
};

// Suggested commercial action per risk tier — subscriptions, no commission.
const RISK_OFFER = {
    EXCELLENT: 'عرض شراكة مميزة — تصدّر البحث + دعم أولوية',
    STABLE:    'عرض ترقية — ميزات إضافية على الاشتراك',
    WARNING:   'تواصل دعم — زيارة ومساعدة في تحسين الأداء',
    CRITICAL:  'إعادة تفعيل — فترة مجانية أو خصم على الاشتراك',
};

const ALERT_META = {
    license_expired:    { icon: 'gavel',           bg: 'bg-red-500/20',   text: 'text-red-400' },
    license_expiring:   { icon: 'badge',           bg: 'bg-amber-500/20', text: 'text-amber-400' },
    activity_drop:      { icon: 'trending_down',   bg: 'bg-amber-500/20', text: 'text-amber-400' },
    idle:               { icon: 'bedtime',         bg: 'bg-slate-700',    text: 'text-slate-400' },
    low_rating:         { icon: 'star_half',       bg: 'bg-amber-500/20', text: 'text-amber-400' },
    stale_verification: { icon: 'hourglass_empty', bg: 'bg-amber-500/20', text: 'text-amber-400' },
};

function DoctorHealthTab() {
    const [data, setData]       = useState(null);
    const [loading, setL]       = useState(true);
    const [riskFilter, setRF]   = useState('ALL');
    const [search, setSearch]   = useState('');
    const [showAllAlerts, setShowAllAlerts] = useState(false);
    const [error, setError] = useState(false);

    const load = useCallback(() => {
        setL(true);
        setError(false);
        getDoctorHealth()
            .then((r) => setData(r.data))
            .catch(() => setError(true))
            .finally(() => setL(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const sum = data?.summary;
    const doctors = (data?.doctors ?? [])
        .filter(d => riskFilter === 'ALL' || d.risk === riskFilter)
        .filter(d => !search.trim()
            || d.name?.includes(search.trim())
            || d.specialization?.includes(search.trim())
            || d.city?.includes(search.trim()));

    const alerts = showAllAlerts ? (data?.alerts ?? []) : (data?.alerts ?? []).slice(0, 6);

    const trendBadge = (pct) => (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pct >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
            {pct >= 0 ? '↑' : '↓'} {Math.abs(pct)}%
        </span>
    );

    const pctCell = (v) => v == null
        ? <span className="text-slate-700 text-xs">—</span>
        : <span className={`text-sm font-bold ${v >= 70 ? 'text-emerald-400' : v >= 40 ? 'text-slate-300' : 'text-red-400'}`}>{v}%</span>;

    const SUMMARY_KEYS = { EXCELLENT: 'excellent', STABLE: 'stable', WARNING: 'warning', CRITICAL: 'critical' };

    if (error) return <ErrorState onRetry={load} />;

    return (
        <div className="space-y-6">
            {/* Purpose banner */}
            <div className="bg-gradient-to-r from-red-950/30 to-slate-900 border border-red-900/20 rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-red-400 text-[22px] mt-0.5 flex-shrink-0">ecg_heart</span>
                <div>
                    <p className="text-sm font-bold text-red-300">مؤشر صحة الأطباء والتنبيهات الاستباقية</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        درجة مركّبة (نشاط 30 + إتمام 20 + استغلال 20 + تقييم 20 + اتجاه 10) — في نموذج الاشتراكات،
                        خسارة طبيب = خسارة كل إيراده. الجدول مرتّب بالأسوأ أولاً: اتصل بهؤلاء قبل أن ينسحبوا.
                    </p>
                </div>
            </div>

            {/* Alerts feed */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-black text-slate-200 text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-amber-400">notifications_active</span>
                        تنبيهات تحتاج إجراء
                        {!loading && <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400">{sum?.alertCount ?? 0}</span>}
                    </h3>
                    {!loading && (data?.alerts?.length ?? 0) > 6 && (
                        <button onClick={() => setShowAllAlerts(s => !s)}
                            className="text-xs font-bold text-emerald-400 hover:text-emerald-300"
                        >{showAllAlerts ? 'عرض أقل' : `عرض الكل (${data.alerts.length})`}</button>
                    )}
                </div>
                {loading ? (
                    <div className="space-y-3">
                        {[1,2,3].map(i => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-slate-800 animate-pulse flex-shrink-0" />
                                <div className="flex-1 space-y-1.5">
                                    <div className="h-3 bg-slate-800 rounded-full animate-pulse w-2/3" />
                                    <div className="h-2 bg-slate-800 rounded-full animate-pulse w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : alerts.length === 0 ? (
                    <div className="text-center py-6">
                        <span className="material-symbols-outlined text-[40px] text-emerald-500/40 block mb-2">task_alt</span>
                        <p className="text-sm text-slate-500 font-bold">لا توجد تنبيهات — كل شيء تحت السيطرة</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {alerts.map((a, i) => {
                            const m = ALERT_META[a.type] ?? { icon: 'info', bg: 'bg-slate-700', text: 'text-slate-400' };
                            return (
                                <div key={i} className={`flex items-start gap-3 rounded-xl p-3.5 border ${
                                    a.severity === 'critical' ? 'bg-red-950/30 border-red-900/30'
                                    : a.severity === 'warning' ? 'bg-amber-950/20 border-amber-900/20'
                                    : 'bg-slate-800/40 border-slate-700/40'}`}
                                >
                                    <div className={`w-9 h-9 rounded-xl ${m.bg} flex items-center justify-center flex-shrink-0`}>
                                        <span className={`material-symbols-outlined text-[16px] ${m.text}`}>{m.icon}</span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-xs font-bold ${a.severity === 'critical' ? 'text-red-300' : a.severity === 'warning' ? 'text-amber-300' : 'text-slate-300'}`}>{a.title}</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{a.detail}</p>
                                        {a.phone && (
                                            <a href={`tel:${a.phone}`} dir="ltr"
                                                className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
                                                <span className="material-symbols-outlined text-[13px]">call</span>
                                                {a.phone}
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Risk summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(RISK_META).map(([risk, m]) => (
                    <div key={risk}
                        className={`bg-slate-900 rounded-2xl p-4 border ${m.border} cursor-pointer transition-all ${riskFilter === risk ? 'ring-1 ring-slate-600' : ''}`}
                        onClick={() => setRF(riskFilter === risk ? 'ALL' : risk)}
                    >
                        <div className={`w-8 h-8 rounded-xl ${m.bg} flex items-center justify-center mb-2`}>
                            <span className={`material-symbols-outlined text-[16px] ${m.text}`}>{m.icon}</span>
                        </div>
                        {loading
                            ? <div className="h-6 w-10 bg-slate-800 rounded animate-pulse mb-1" />
                            : <p className={`text-2xl font-black ${m.text}`}>{sum?.[SUMMARY_KEYS[risk]] ?? '—'}</p>
                        }
                        <p className="text-xs text-slate-500 mt-0.5">{m.label}</p>
                    </div>
                ))}
            </div>

            {/* Search */}
            <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="بحث باسم الطبيب أو التخصص أو المدينة..."
                className={`${inputCls} w-full md:w-80`}
            />

            {/* Doctors table */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm" dir="rtl">
                        <thead>
                            <tr className="bg-slate-800/60 border-b border-slate-700/50">
                                {['الطبيب','التخصص','الدرجة','الحالة','نشاط 30 يوم','إتمام 90 يوم','استغلال 30 يوم','التقييم','آخر نشاط','الترخيص','العرض المقترح'].map(h => (
                                    <th key={h} className="px-3 py-3 text-right text-[11px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <SkeletonRows cols={11} rows={6} /> : doctors.length === 0 ? (
                                <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-600">لا توجد نتائج</td></tr>
                            ) : doctors.map((d) => {
                                const m = RISK_META[d.risk];
                                return (
                                    <tr key={d.doctorProfileId} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                                        <td className="px-3 py-3">
                                            <p className="font-bold text-slate-200 text-sm whitespace-nowrap">د. {d.name}</p>
                                            <p className="text-[10px] text-slate-600">{d.city}</p>
                                            {d.phone && (
                                                <a href={`tel:${d.phone}`} dir="ltr"
                                                    className="text-[10px] font-semibold text-emerald-500/90 hover:text-emerald-400 transition-colors whitespace-nowrap">
                                                    {d.phone}
                                                </a>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-slate-400 text-xs whitespace-nowrap">{d.specialization}</td>
                                        <td className="px-3 py-3 min-w-[120px]">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-base font-black ${m.text} w-7`}>{d.score}</span>
                                                <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                    <div className={`h-1.5 rounded-full ${m.bar}`} style={{ width: `${d.score}%` }} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold ${m.bg} ${m.text}`}>
                                                <span className="material-symbols-outlined text-[12px]">{m.icon}</span>
                                                {m.label}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap">
                                            <span className="text-sm font-black text-slate-200">{d.visits30}</span>
                                            <span className="mr-1.5">{trendBadge(d.trendPct)}</span>
                                        </td>
                                        <td className="px-3 py-3">{pctCell(d.completionRate90)}</td>
                                        <td className="px-3 py-3">{pctCell(d.utilization30)}</td>
                                        <td className="px-3 py-3 whitespace-nowrap">
                                            {d.numReviews > 0
                                                ? <><span className="text-amber-400 font-black text-sm">{d.rating?.toFixed(1)}</span><span className="text-slate-600 text-[10px] mr-0.5">({d.numReviews})</span></>
                                                : <span className="text-slate-700 text-xs">—</span>
                                            }
                                        </td>
                                        <td className="px-3 py-3 text-xs whitespace-nowrap">
                                            {d.daysSinceActivity == null
                                                ? <span className="text-slate-600">لا نشاط بعد</span>
                                                : <span className={d.daysSinceActivity > 30 ? 'text-red-400' : 'text-slate-400'}>منذ {d.daysSinceActivity} يوم</span>
                                            }
                                        </td>
                                        <td className="px-3 py-3 text-xs whitespace-nowrap">
                                            {d.licenseDaysLeft == null
                                                ? <span className="text-slate-700">—</span>
                                                : d.licenseDaysLeft <= 0
                                                    ? <span className="font-bold text-red-400">منتهي</span>
                                                    : d.licenseDaysLeft <= 60
                                                        ? <span className="font-bold text-amber-400">{d.licenseDaysLeft} يوم</span>
                                                        : <span className="text-slate-500">{d.licenseDaysLeft} يوم</span>
                                            }
                                        </td>
                                        <td className="px-3 py-3 text-[11px] text-slate-500 max-w-[180px]">{RISK_OFFER[d.risk]}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}


export { DoctorHealthTab };

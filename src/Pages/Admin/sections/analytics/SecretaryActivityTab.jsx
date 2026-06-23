import { useState, useEffect, useCallback } from 'react';
import { getSecretaryActivity } from '../../../../Services/adminService';
import { SkeletonRows, StatCard, ECON_PERIODS, ErrorState } from '../../adminShared';
import { fmtDateTime } from '../../../../utils/dateFormat';

// ── Secretary Activity sub-tab ────────────────────────────────────────────────

function SecretaryActivityTab() {
    const [data, setData] = useState(null);
    const [loading, setL] = useState(true);
    const [days, setDays] = useState(30);
    const [error, setError] = useState(false);

    const load = useCallback(() => {
        setL(true);
        setError(false);
        getSecretaryActivity({ days })
            .then((r) => setData(r.data))
            .catch(() => setError(true))
            .finally(() => setL(false));
    }, [days]);

    useEffect(() => { load(); }, [load]);

    const sum = data?.summary;

    if (error) return <ErrorState onRetry={load} />;

    return (
        <div className="space-y-6">
            {/* Purpose banner */}
            <div className="bg-gradient-to-r from-indigo-950/40 to-slate-900 border border-indigo-800/20 rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-indigo-400 text-[22px] mt-0.5 flex-shrink-0">support_agent</span>
                <div>
                    <p className="text-sm font-bold text-indigo-300">من يُسجّل الزيارات في كل عيادة؟</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        سكرتيرة نشطة = عيادة تستخدم المنصة فعلاً. سكرتيرة خاملة منذ أسابيع = عيادة تنزلق
                        خارج النظام — تواصل معها قبل أن يظهر طبيبها في تنبيهات صحة الأطباء.
                    </p>
                </div>
            </div>

            {/* Period selector */}
            <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
                {ECON_PERIODS.map(p => (
                    <button key={p.days} onClick={() => setDays(p.days)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors
                            ${days === p.days ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >{p.label}</button>
                ))}
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard icon="support_agent" label="سكرتيرات مسجلات" color="violet" loading={loading}
                    value={sum?.secretaryCount?.toLocaleString('ar-EG')}
                />
                <StatCard icon="edit_calendar" label="زيارات سجلتها السكرتارية" color="blue" loading={loading}
                    value={sum?.recordedBySecretaries?.toLocaleString('ar-EG')}
                    sub={sum != null ? `${sum.secretarySharePct}% من الزيارات معروفة المصدر` : null}
                />
                <StatCard icon="stethoscope" label="زيارات سجلها الأطباء بأنفسهم" color="emerald" loading={loading}
                    value={sum?.recordedByDoctors?.toLocaleString('ar-EG')}
                />
            </div>

            {/* Secretaries table */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm" dir="rtl">
                        <thead>
                            <tr className="bg-slate-800/60 border-b border-slate-700/50">
                                {['السكرتيرة','عيادة الطبيب','زيارات مسجلة','منتهية','ملغاة','متابعات مجدولة','إدراجات استثنائية','آخر نشاط'].map(h => (
                                    <th key={h} className="px-3 py-3 text-right text-[11px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <SkeletonRows cols={8} rows={4} /> : (data?.secretaries?.length ?? 0) === 0 ? (
                                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-600">لا توجد سكرتيرات مسجلات على المنصة</td></tr>
                            ) : data.secretaries.map((s) => (
                                <tr key={s.secretaryId} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                                    <td className="px-3 py-3">
                                        <p className="font-bold text-slate-200 text-sm whitespace-nowrap">
                                            {s.name}
                                            {s.isSuspended && <span className="mr-1.5 text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">موقوفة</span>}
                                        </p>
                                    </td>
                                    <td className="px-3 py-3 text-slate-400 text-xs whitespace-nowrap">د. {s.doctorName}</td>
                                    <td className="px-3 py-3"><span className="text-sm font-black text-slate-100">{s.recorded}</span></td>
                                    <td className="px-3 py-3 text-emerald-400 font-bold text-sm">{s.done}</td>
                                    <td className="px-3 py-3 text-red-400/80 font-bold text-sm">{s.cancelled}</td>
                                    <td className="px-3 py-3 text-cyan-400 font-bold text-sm">{s.followUps}</td>
                                    <td className="px-3 py-3 text-violet-400 font-bold text-sm">{s.forceInserted}</td>
                                    <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{s.lastActivity ? fmtDateTime(s.lastActivity) : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}


export { SecretaryActivityTab };

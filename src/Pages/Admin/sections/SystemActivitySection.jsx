import { useState, useEffect, useCallback } from 'react';
import { getSystemLogs } from '../../../Services/adminService';
import { roleLabel, SkeletonRows, Pagination, SectionTitle, DarkTable, inputCls, filterBtnCls } from '../adminShared';
import { fmtDate, fmtDateTime } from '../../../utils/dateFormat';

// ── System Activity section ───────────────────────────────────────────────────

const SYS_ACTION_META = {
    booking_created:   { label: 'حجز جديد',       icon: 'event',        bg: 'bg-blue-500/20',    text: 'text-blue-400' },
    booking_cancelled: { label: 'إلغاء حجز',       icon: 'event_busy',   bg: 'bg-red-500/20',     text: 'text-red-400' },
    booking_completed: { label: 'حجز مكتمل',       icon: 'event_available', bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    user_registered:   { label: 'تسجيل مستخدم',   icon: 'person_add',   bg: 'bg-violet-500/20',  text: 'text-violet-400' },
};

function SystemActivitySection() {
    const [data, setData]       = useState([]);
    const [total, setTotal]     = useState(0);
    const [pages, setPages]     = useState(1);
    const [page, setPage]       = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadError, setErr]   = useState(false);
    const [actionF, setAF]      = useState('');
    const [roleF, setRF]        = useState('');

    const load = useCallback((p = 1) => {
        setLoading(true);
        const params = { page: p, limit: 25 };
        if (actionF) params.action = actionF;
        if (roleF)   params.role   = roleF;
        getSystemLogs(params)
            .then((r) => {
                setErr(false);
                setData(r.data?.logs || []);
                setTotal(r.data?.pagination?.total || 0);
                setPages(r.data?.pagination?.pages || 1);
                setPage(p);
            })
            .catch(() => setErr(true))
            .finally(() => setLoading(false));
    }, [actionF, roleF]);

    useEffect(() => { load(1); }, [load]);

    const metaOf = (action) => SYS_ACTION_META[action] || { label: action, icon: 'info', bg: 'bg-slate-700', text: 'text-slate-400' };

    const metaPreview = (log) => {
        const m = log.metadata || {};
        if (log.action === 'booking_created')   return `مع د. ${m.doctorName || '—'} — ${fmtDate(m.date)}`;
        if (log.action === 'booking_cancelled')  return `بواسطة ${m.cancelledBy === 'doctor' ? 'الطبيب' : m.cancelledBy === 'admin' ? 'الإدارة' : 'المريض'} — ${fmtDate(m.date)}`;
        if (log.action === 'booking_completed')  return `رسوم: ${m.fee ?? '—'} ج — ${fmtDate(m.date)}`;
        if (log.action === 'user_registered')    return `${m.email || '—'}`;
        return '';
    };

    return (
        <div dir="rtl">
            <SectionTitle icon="monitoring" title="نشاط النظام" subtitle={`${total} حدث مسجّل`} />

            <div className="flex flex-wrap gap-3 mb-5">
                <select value={actionF} onChange={(e) => setAF(e.target.value)} className={inputCls}>
                    <option value="">كل الأحداث</option>
                    {Object.entries(SYS_ACTION_META).map(([k, { label }]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <select value={roleF} onChange={(e) => setRF(e.target.value)} className={inputCls}>
                    <option value="">كل الأدوار</option>
                    <option value="patient">مريض</option>
                    <option value="doctor">طبيب</option>
                    <option value="admin">مشرف</option>
                </select>
                <button onClick={() => load(1)} className={filterBtnCls}>تحديث</button>
            </div>

            {loadError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center mb-4">
                    <span className="material-symbols-outlined text-red-400 text-[28px] block mb-2">error</span>
                    <p className="text-red-400 text-sm font-bold">تعذّر تحميل سجل النشاط</p>
                </div>
            )}
            <DarkTable headers={['الحدث', 'المستخدم', 'الدور', 'التفاصيل', 'الوقت']}>
                {loading ? <SkeletonRows cols={5} rows={10} /> : data.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-600">
                        لا توجد أحداث — ستظهر الأحداث الجديدة فور حدوثها
                    </td></tr>
                ) : data.map((log, i) => {
                    const meta = metaOf(log.action);
                    return (
                        <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-3.5">
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-xl ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                                        <span className={`material-symbols-outlined text-[14px] ${meta.text}`}>{meta.icon}</span>
                                    </div>
                                    <span className={`text-xs font-bold ${meta.text}`}>{meta.label}</span>
                                </div>
                            </td>
                            <td className="px-4 py-3.5 text-slate-300 text-sm font-semibold">{log.actorName || '—'}</td>
                            <td className="px-4 py-3.5">
                                <span className="inline-block px-2 py-0.5 rounded-lg text-xs font-bold bg-slate-800 text-slate-400">
                                    {roleLabel[log.actorRole] ?? (log.actorRole || '—')}
                                </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 text-xs max-w-[220px] truncate">{metaPreview(log)}</td>
                            <td className="px-4 py-3.5 text-slate-600 text-xs whitespace-nowrap">{fmtDateTime(log.createdAt)}</td>
                        </tr>
                    );
                })}
            </DarkTable>
            <div className="mt-3"><Pagination page={page} pages={pages} onPage={load} /></div>
        </div>
    );
}


export { SystemActivitySection };

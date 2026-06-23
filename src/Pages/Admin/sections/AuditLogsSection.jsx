import { useState, useEffect, useCallback } from 'react';
import { getAuditLogs } from '../../../Services/adminService';
import { SkeletonRows, Pagination, SectionTitle, DarkTable, inputCls, filterBtnCls, ACTION_META } from '../adminShared';
import { fmtDateTime } from '../../../utils/dateFormat';

// ── Audit logs section ────────────────────────────────────────────────────────

function AuditLogsSection() {
    const [data, setData]           = useState([]);
    const [total, setTotal]         = useState(0);
    const [pages, setPages]         = useState(1);
    const [page, setPage]           = useState(1);
    const [loading, setLoading]     = useState(true);
    const [loadError, setErr]       = useState(false);
    const [actionFilter, setAF]     = useState('');
    const [fromDate, setFrom]       = useState('');
    const [toDate, setTo]           = useState('');

    const load = useCallback((p = 1) => {
        setLoading(true);
        setErr(false);
        const params = { page: p, limit: 20 };
        if (actionFilter) params.action = actionFilter;
        if (fromDate)     params.from   = fromDate;
        if (toDate)       params.to     = toDate;
        getAuditLogs(params)
            .then((r) => {
                setData(r.data?.logs || []);
                setTotal(r.data?.pagination?.total || 0);
                setPages(r.data?.pagination?.pages || 1);
                setPage(p);
            })
            .catch(() => setErr(true))
            .finally(() => setLoading(false));
    }, [actionFilter, fromDate, toDate]);

    useEffect(() => { load(1); }, [load]);

    return (
        <div dir="rtl">
            <SectionTitle icon="history" title="سجل العمليات" subtitle={`${total} عملية مسجّلة — للقراءة فقط`} />

            <div className="flex flex-wrap gap-3 mb-5">
                <select value={actionFilter} onChange={(e) => setAF(e.target.value)} className={inputCls}>
                    <option value="">كل الإجراءات</option>
                    {Object.entries(ACTION_META).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
                <input type="date" value={fromDate} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} text-slate-400`} title="من تاريخ" />
                <input type="date" value={toDate}   onChange={(e) => setTo(e.target.value)}   className={`${inputCls} text-slate-400`} title="إلى تاريخ" />
                <button onClick={() => load(1)} className={filterBtnCls}>تحديث</button>
                {(fromDate || toDate) && (
                    <button onClick={() => { setFrom(''); setTo(''); }} className="px-3 py-2.5 rounded-xl border border-slate-700 text-xs text-slate-500 hover:text-slate-300 transition-colors">مسح الفلتر</button>
                )}
            </div>

            {loadError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center mb-4">
                    <span className="material-symbols-outlined text-red-400 text-[28px] block mb-2">error</span>
                    <p className="text-red-400 text-sm font-bold">تعذّر تحميل سجل الإدارة</p>
                </div>
            )}

            <DarkTable headers={['الإجراء', 'المشرف', 'المستهدف', 'السبب', 'التاريخ', 'IP']}>
                {loading ? <SkeletonRows cols={6} /> : data.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-600">لا توجد سجلات</td></tr>
                ) : data.map((log, i) => {
                    const meta = ACTION_META[log.action] || { label: log.action, icon: 'info', bg: 'bg-slate-700', text: 'text-slate-400' };
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
                            <td className="px-4 py-3.5 text-slate-300 text-xs">{log.admin?.name ?? '—'}</td>
                            <td className="px-4 py-3.5 text-slate-400 text-xs">{log.targetUser?.name ?? '—'}</td>
                            <td className="px-4 py-3.5 text-slate-600 text-xs max-w-[160px] truncate">{log.reason || '—'}</td>
                            <td className="px-4 py-3.5 text-slate-600 text-xs whitespace-nowrap">{fmtDateTime(log.createdAt)}</td>
                            <td className="px-4 py-3.5 text-slate-700 text-xs font-mono">{log.ip || '—'}</td>
                        </tr>
                    );
                })}
            </DarkTable>
            <div className="mt-3"><Pagination page={page} pages={pages} onPage={load} /></div>
        </div>
    );
}


export { AuditLogsSection };

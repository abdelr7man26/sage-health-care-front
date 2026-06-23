import { useState, useEffect, useCallback, useRef } from 'react';
import { getAllUsers, suspendUser, unsuspendUser, deleteUser, restoreUser } from '../../../Services/adminService';
import { SERVER_BASE, roleLabel, ConfirmModal, ReasonModal, SkeletonRows, Pagination, SectionTitle, DarkTable, inputCls, filterBtnCls } from '../adminShared';
import { fmtDate } from '../../../utils/dateFormat';
import { useDebounced } from '../../../hooks/useDebounced';

// ── Users section ─────────────────────────────────────────────────────────────

const daysUntilPurge = (deletedAt) => {
    if (!deletedAt) return 30;
    const purgeAt  = new Date(new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000);
    const remaining = Math.ceil((purgeAt - Date.now()) / (24 * 60 * 60 * 1000));
    return Math.max(0, remaining);
};

function UsersSection({ toast, liveTick }) {
    const [data, setData]             = useState([]);
    const [total, setTotal]           = useState(0);
    const [pages, setPages]           = useState(1);
    const [page, setPage]             = useState(1);
    const [loading, setLoading]       = useState(true);
    const [search, setSearch]         = useState('');
    const [role, setRole]             = useState('');
    const [suspended, setSuspended]   = useState('');
    const [showDeleted, setShowDeleted] = useState(false);
    const [actionLoading, setAL]      = useState({});
    const [suspendTarget, setST]      = useState(null);
    const [deleteTarget, setDT]       = useState(null);
    const [deleteLoading, setDL]      = useState(false);
    const [restoreTarget, setRT]      = useState(null);
    const [restoreLoading, setRL]     = useState(false);
    const dSearch = useDebounced(search);

    const load = useCallback((p = 1) => {
        setLoading(true);
        const params = { page: p, limit: 20 };
        if (showDeleted) {
            params.deleted = 'true';
        } else {
            if (dSearch.trim())   params.search    = dSearch.trim();
            if (role !== '')      params.role      = role;
            if (suspended !== '') params.suspended = suspended;
        }
        getAllUsers(params)
            .then((r) => { setData(r.data); setTotal(r.total); setPages(r.pages); setPage(p); })
            .catch(() => toast('تعذّر تحميل المستخدمين', 'error'))
            .finally(() => setLoading(false));
    }, [dSearch, role, suspended, showDeleted, toast]);

    useEffect(() => { load(1); }, [load]);

    // Live refetch on real-time events (skip the initial mount), keeping current page.
    const liveFirst = useRef(true);
    useEffect(() => {
        if (liveFirst.current) { liveFirst.current = false; return; }
        load(page);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveTick]);

    const doSuspend = async (reason) => {
        if (!suspendTarget) return;
        const { id } = suspendTarget;
        setAL((p) => ({ ...p, [id]: 'suspend' }));
        try {
            await suspendUser(id, reason);
            toast('تم تعليق الحساب بنجاح');
            setST(null);
            load(page);
        } catch (err) {
            toast(err.message || 'حدث خطأ', 'error');
        } finally {
            setAL((p) => { const n = { ...p }; delete n[id]; return n; });
        }
    };

    const doUnsuspend = async (id) => {
        setAL((p) => ({ ...p, [id]: 'unsuspend' }));
        try {
            await unsuspendUser(id);
            toast('تم رفع الإيقاف بنجاح');
            load(page);
        } catch (err) {
            toast(err.message || 'حدث خطأ', 'error');
        } finally {
            setAL((p) => { const n = { ...p }; delete n[id]; return n; });
        }
    };

    const doDelete = async () => {
        if (!deleteTarget) return;
        setDL(true);
        try {
            await deleteUser(deleteTarget);
            toast('تم حذف الحساب بشكل آمن');
            setDT(null);
            load(page);
        } catch (err) {
            toast(err.message || 'حدث خطأ', 'error');
        } finally {
            setDL(false);
        }
    };

    const doRestore = async () => {
        if (!restoreTarget) return;
        setRL(true);
        try {
            await restoreUser(restoreTarget);
            toast('تم استعادة الحساب بنجاح');
            setRT(null);
            load(page);
        } catch (err) {
            toast(err.message || 'حدث خطأ', 'error');
        } finally {
            setRL(false);
        }
    };

    const roleColors = {
        patient:   'bg-emerald-500/20 text-emerald-400',
        doctor:    'bg-blue-500/20 text-blue-400',
        secretary: 'bg-violet-500/20 text-violet-400',
        admin:     'bg-amber-500/20 text-amber-400',
    };

    return (
        <div dir="rtl">
            <SectionTitle icon="people" title="إدارة المستخدمين" subtitle={`إجمالي ${total} ${showDeleted ? 'حساب محذوف' : 'مستخدم'}`} />

            {/* Tab toggle */}
            <div className="flex gap-2 mb-5">
                <button
                    onClick={() => { setShowDeleted(false); setPage(1); }}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${!showDeleted ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <span className="material-symbols-outlined text-[15px] align-[-3px] ml-1">people</span>
                    المستخدمون النشطون
                </button>
                <button
                    onClick={() => { setShowDeleted(true); setPage(1); }}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${showDeleted ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <span className="material-symbols-outlined text-[15px] align-[-3px] ml-1">delete_forever</span>
                    الحسابات المحذوفة
                </button>
            </div>

            {/* Filters — hidden in deleted view */}
            {!showDeleted && (
                <div className="flex flex-wrap gap-3 mb-5">
                    <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load(1)}
                        placeholder="بحث بالاسم أو البريد..." className={`${inputCls} w-56`} />
                    <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
                        <option value="">كل الأدوار</option>
                        <option value="patient">مريض</option>
                        <option value="doctor">طبيب</option>
                        <option value="secretary">سكرتيرة</option>
                    </select>
                    <select value={suspended} onChange={(e) => setSuspended(e.target.value)} className={inputCls}>
                        <option value="">كل الحالات</option>
                        <option value="false">نشط</option>
                        <option value="true">موقوف</option>
                    </select>
                    <button onClick={() => load(1)} className={filterBtnCls}>بحث</button>
                </div>
            )}

            {/* Active users table */}
            {!showDeleted && (
                <DarkTable headers={['الاسم', 'البريد', 'الدور', 'تاريخ الانضمام', 'الحالة', 'الإجراء']}>
                    {loading ? <SkeletonRows cols={6} /> : data.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-600">لا يوجد مستخدمون</td></tr>
                    ) : data.map((u) => (
                        <tr key={u._id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-3.5">
                                <div className="flex items-center gap-2.5">
                                    {u.profilePicture
                                        ? <img src={`${SERVER_BASE}${u.profilePicture}`} alt="" className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-700" />
                                        : <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 font-black text-sm">{u.name?.charAt(0) ?? '?'}</div>
                                    }
                                    <span className="font-bold text-slate-200 text-sm">{u.name}</span>
                                </div>
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 text-xs">{u.email}</td>
                            <td className="px-4 py-3.5">
                                <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${roleColors[u.role] || 'bg-slate-700 text-slate-400'}`}>
                                    {roleLabel[u.role] ?? u.role}
                                </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-600 text-xs">{fmtDate(u.createdAt)}</td>
                            <td className="px-4 py-3.5">
                                <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${u.isSuspended ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                    {u.isSuspended ? 'موقوف' : 'نشط'}
                                </span>
                            </td>
                            <td className="px-4 py-3.5">
                                <div className="flex gap-1.5">
                                    {u.isSuspended ? (
                                        <button onClick={() => doUnsuspend(u._id)} disabled={!!actionLoading[u._id]}
                                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
                                        >{actionLoading[u._id] === 'unsuspend' ? '...' : 'رفع الإيقاف'}</button>
                                    ) : (
                                        <button onClick={() => setST({ id: u._id })} disabled={!!actionLoading[u._id]}
                                            className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/30 transition-colors disabled:opacity-40"
                                        >تعليق</button>
                                    )}
                                    <button onClick={() => setDT(u._id)} disabled={!!actionLoading[u._id]}
                                        className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-colors disabled:opacity-40"
                                    >حذف</button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </DarkTable>
            )}

            {/* Deleted users table */}
            {showDeleted && (
                <DarkTable headers={['الاسم', 'البريد', 'الدور', 'تاريخ الحذف', 'الأيام المتبقية', 'الإجراء']}>
                    {loading ? <SkeletonRows cols={6} /> : data.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-600">لا توجد حسابات محذوفة</td></tr>
                    ) : data.map((u) => {
                        const days = daysUntilPurge(u.deletedAt);
                        return (
                            <tr key={u._id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors opacity-80">
                                <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-xl bg-red-900/30 flex items-center justify-center text-red-400 font-black text-sm">{u.name?.charAt(0) ?? '?'}</div>
                                        <span className="font-bold text-slate-400 text-sm line-through">{u.name}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3.5 text-slate-500 text-xs">{u.email}</td>
                                <td className="px-4 py-3.5">
                                    <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${roleColors[u.role] || 'bg-slate-700 text-slate-400'}`}>
                                        {roleLabel[u.role] ?? u.role}
                                    </span>
                                </td>
                                <td className="px-4 py-3.5 text-slate-600 text-xs">{fmtDate(u.deletedAt)}</td>
                                <td className="px-4 py-3.5">
                                    <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${days <= 5 ? 'bg-red-500/20 text-red-400' : days <= 14 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>
                                        {days === 0 ? 'سيُحذف اليوم' : `${days} يوم`}
                                    </span>
                                </td>
                                <td className="px-4 py-3.5">
                                    <button onClick={() => setRT(u._id)}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[13px] align-[-2px] ml-0.5">restore</span>
                                        استعادة
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </DarkTable>
            )}

            <div className="mt-3"><Pagination page={page} pages={pages} onPage={load} /></div>

            <ReasonModal open={!!suspendTarget} title="تعليق الحساب" onConfirm={doSuspend}
                onCancel={() => setST(null)} loading={suspendTarget ? !!actionLoading[suspendTarget.id] : false} />
            <ConfirmModal open={!!deleteTarget} icon="delete_forever" title="حذف الحساب"
                body="سيتم إلغاء تفعيل الحساب مع الحفاظ على جميع السجلات الطبية. هل أنت متأكد؟"
                onConfirm={doDelete} onCancel={() => setDT(null)} loading={deleteLoading}
                confirmLabel="حذف الحساب" danger />
            <ConfirmModal open={!!restoreTarget} icon="restore" title="استعادة الحساب"
                body="سيتم إعادة تفعيل الحساب وإزالة الحظر على الإيميل. هل تأكدت من تواصل المريض مع الدعم؟"
                onConfirm={doRestore} onCancel={() => setRT(null)} loading={restoreLoading}
                confirmLabel="استعادة الحساب" />
        </div>
    );
}


export { UsersSection };

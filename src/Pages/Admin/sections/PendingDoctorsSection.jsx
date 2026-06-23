import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getPendingDoctors, startDoctorReview, approveDoctor, rejectDoctor, getDoctorDocument } from '../../../Services/adminService';
import { SERVER_BASE, SkeletonRows, SectionTitle, DarkTable } from '../adminShared';
import { fmtDate } from '../../../utils/dateFormat';
import { useDebounced } from '../../../hooks/useDebounced';

// ── Verification status badge ─────────────────────────────────────────────────

const VSTATUS = {
    not_submitted: { label: 'لم يتقدم',      bg: 'bg-slate-700',       text: 'text-slate-400' },
    pending:       { label: 'في الانتظار',   bg: 'bg-amber-500/20',    text: 'text-amber-400' },
    under_review:  { label: 'قيد المراجعة',  bg: 'bg-indigo-500/20',   text: 'text-indigo-400' },
    approved:      { label: 'مقبول',         bg: 'bg-emerald-500/20',  text: 'text-emerald-400' },
    rejected:      { label: 'مرفوض',         bg: 'bg-red-500/20',      text: 'text-red-400' },
    suspended:     { label: 'موقوف',         bg: 'bg-orange-500/20',   text: 'text-orange-400' },
};

function VStatusBadge({ status }) {
    const s = VSTATUS[status] || VSTATUS.pending;
    return (
        <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold ${s.bg} ${s.text}`}>
            {s.label}
        </span>
    );
}

// ── Pending doctors ───────────────────────────────────────────────────────────

function PendingDoctorsSection({ toast, onCountChange, liveTick }) {
    const [data, setData]             = useState([]);
    const [total, setTotal]           = useState(0);
    const [pages, setPages]           = useState(1);
    const [page, setPage]             = useState(1);
    const [statusFilter, setSF]       = useState('actionable');
    const [search, setSearch]         = useState('');
    const [loading, setLoading]       = useState(true);
    const [actionLoading, setAL]      = useState({});
    const [rejectTarget, setRT]       = useState(null);
    const [rejectReason, setRR]       = useState('');
    const [rejectLoading, setRL]      = useState(false);
    const [expandedDiff, setExpandedDiff] = useState({});
    const dSearch = useDebounced(search);

    const load = useCallback((p = 1, sf = statusFilter, q = search) => {
        setLoading(true);
        const params = { page: p, limit: 15, status: sf };
        if (q.trim()) params.search = q.trim();
        getPendingDoctors(params)
            .then((r) => {
                setData(r.data);
                setTotal(r.total ?? r.data.length);
                setPages(r.pages ?? 1);
                setPage(p);
            })
            .catch(() => toast('تعذّر تحميل الطلبات', 'error'))
            .finally(() => setLoading(false));
    }, [toast, statusFilter, search]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load(1, statusFilter, dSearch); }, [statusFilter, dSearch]);

    // Live refetch when a real-time event fires (new application / decision elsewhere),
    // preserving the current page & filters. Skips the initial mount (liveTick starts 0).
    const liveFirst = useRef(true);
    useEffect(() => {
        if (liveFirst.current) { liveFirst.current = false; return; }
        load(page, statusFilter, dSearch);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveTick]);

    const handleSearch = (e) => {
        e.preventDefault();
        load(1, statusFilter, search);
    };

    const startReview = async (id) => {
        setAL((p) => ({ ...p, [id]: 'review' }));
        try {
            await startDoctorReview(id);
            toast('تم بدء مراجعة الطلب');
            load(page, statusFilter, search);
        } catch (err) {
            toast(err.message || 'حدث خطأ', 'error');
        } finally {
            setAL((p) => { const n = { ...p }; delete n[id]; return n; });
        }
    };

    const approve = async (id) => {
        setAL((p) => ({ ...p, [id]: 'approve' }));
        try {
            await approveDoctor(id);
            toast('تم تفعيل الطبيب بنجاح');
            load(page, statusFilter, search);
            onCountChange?.();
        } catch (err) {
            toast(err.message || 'حدث خطأ', 'error');
        } finally {
            setAL((p) => { const n = { ...p }; delete n[id]; return n; });
        }
    };

    const reject = async () => {
        if (!rejectTarget) return;
        if (!rejectReason.trim()) {
            toast('سبب الرفض مطلوب', 'error');
            return;
        }
        setRL(true);
        try {
            await rejectDoctor(rejectTarget, rejectReason);
            toast('تم رفض الطلب وإشعار الطبيب');
            load(page, statusFilter, search);
            onCountChange?.();
            setRT(null); setRR('');
        } catch (err) {
            toast(err.message || 'حدث خطأ', 'error');
        } finally {
            setRL(false);
        }
    };

    // Open a verification document securely via authenticated fetch (avoids
    // sending the URL directly in an <a href> which would strip the auth header).
    // R2 files come back as JSON { url } (a signed URL we open directly);
    // legacy local files come back as the raw file (opened via a blob URL).
    const openDocument = async (profileId, docType) => {
        // Open the tab synchronously on the click so popup blockers allow it,
        // then point it at the document once the request resolves.
        const win = window.open('', '_blank');
        try {
            const res = await getDoctorDocument(profileId, docType);
            const contentType = res.headers['content-type'] || '';
            let target;
            if (contentType.includes('application/json')) {
                target = JSON.parse(await res.data.text()).url;
            } else {
                target = URL.createObjectURL(res.data);
                setTimeout(() => URL.revokeObjectURL(target), 60_000);
            }
            if (win) win.location = target;
            else window.open(target, '_blank');
        } catch (err) {
            win?.close();
            let msg = 'فشل فتح الوثيقة';
            // responseType:'blob' wraps error bodies in a Blob — unwrap to read the message
            if (err.response?.data instanceof Blob) {
                try { msg = JSON.parse(await err.response.data.text()).message || msg; } catch { /* keep fallback */ }
            } else if (err.response?.data?.message) {
                msg = err.response.data.message;
            }
            toast(msg, 'error');
        }
    };

    const TABS = [
        { key: 'actionable', label: 'تحتاج إجراء' },
        { key: 'pending',    label: 'في الانتظار' },
        { key: 'under_review', label: 'قيد المراجعة' },
        { key: 'rejected',   label: 'مرفوضة' },
        { key: 'all',        label: 'الكل' },
    ];

    return (
        <div dir="rtl">
            <SectionTitle icon="pending" title="طلبات الأطباء"
                subtitle={loading ? 'جاري التحميل...' : `${total} طلب`}
            />

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
                {/* Status tabs */}
                <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 flex-wrap">
                    {TABS.map(t => (
                        <button key={t.key}
                            onClick={() => setSF(t.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors
                                ${statusFilter === t.key
                                    ? 'bg-emerald-600 text-white'
                                    : 'text-slate-400 hover:text-slate-200'}`}
                        >{t.label}</button>
                    ))}
                </div>

                {/* Search */}
                <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="بحث باسم الطبيب..."
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-600"
                    />
                    <button type="submit" className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-600">
                        بحث
                    </button>
                </form>
            </div>

            {!loading && data.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center">
                    <span className="material-symbols-outlined text-[56px] text-slate-700 block mb-4">check_circle</span>
                    <p className="text-slate-500 font-bold text-lg">لا توجد طلبات</p>
                </div>
            ) : (
                <>
                <DarkTable headers={['الطبيب', 'الحالة', 'الترخيص', 'التخصص / الدرجة', 'سعر الكشف', 'تاريخ التقديم', 'الأيام', 'المراجع', 'الوثائق', 'الإجراء']}>
                    {loading ? <SkeletonRows cols={10} rows={4} /> : data.map((d) => {
                        const isExpanded = !!expandedDiff[d._id];
                        const hasDiff    = d.requestType === 'update' && d.changedFields?.length > 0;
                        const ml  = d.verificationDocuments?.medicalLicense?.filePath;
                        const nif = d.verificationDocuments?.nationalIdFront?.filePath;
                        const nib = d.verificationDocuments?.nationalIdBack?.filePath;
                        const certs = d.verificationDocuments?.optionalCertificates || [];
                        const hasNewDocs = ml || nif || nib;
                        return (
                            <Fragment key={d._id}>
                                <tr className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                                    {/* Doctor name */}
                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-2.5">
                                            {d.user?.profilePicture
                                                ? <img src={`${SERVER_BASE}${d.user.profilePicture}`} alt="" className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-700" />
                                                : <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-sm">{d.user?.name?.charAt(0) ?? 'د'}</div>
                                            }
                                            <div>
                                                <p className="font-bold text-slate-200 text-sm">د. {d.user?.name ?? '—'}</p>
                                                <p className="text-xs text-slate-600">{d.user?.email}</p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Status */}
                                    <td className="px-4 py-3.5">
                                        <div className="flex flex-col gap-1">
                                            <VStatusBadge status={d.verificationStatus} />
                                            {d.requestType === 'update' ? (
                                                <button
                                                    onClick={() => hasDiff && setExpandedDiff((p) => ({ ...p, [d._id]: !p[d._id] }))}
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-400 text-[10px] font-bold ${hasDiff ? 'cursor-pointer hover:bg-blue-500/30' : 'cursor-default'}`}
                                                >
                                                    <span className="material-symbols-outlined text-[11px]">edit</span>
                                                    تحديث{hasDiff && ` (${d.changedFields.length})`}
                                                    {hasDiff && <span className="material-symbols-outlined text-[11px]" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>expand_more</span>}
                                                </button>
                                            ) : (
                                                <span className="text-[10px] text-slate-600">تسجيل جديد</span>
                                            )}
                                        </div>
                                    </td>

                                    {/* License number + expiry */}
                                    <td className="px-4 py-3.5">
                                        {d.licenseNumber ? (
                                            <div>
                                                <p className="text-xs font-mono text-indigo-300 font-bold">{d.licenseNumber}</p>
                                                {d.licenseExpiryDate && (
                                                    <p className={`text-[10px] mt-0.5 ${new Date(d.licenseExpiryDate) < new Date() ? 'text-red-400' : 'text-slate-500'}`}>
                                                        ينتهي: {fmtDate(d.licenseExpiryDate)}
                                                    </p>
                                                )}
                                            </div>
                                        ) : <span className="text-slate-700 text-xs">—</span>}
                                    </td>

                                    {/* Specialization / degree */}
                                    <td className="px-4 py-3.5">
                                        <p className="text-slate-300 text-sm font-semibold">{d.specialization}</p>
                                        <p className="text-slate-600 text-xs">{d.degree}</p>
                                    </td>

                                    {/* Fee */}
                                    <td className="px-4 py-3.5">
                                        {d.consultationFee != null
                                            ? <span className="text-amber-400 font-bold text-sm">{d.consultationFee} ج</span>
                                            : <span className="text-slate-700 text-xs">—</span>
                                        }
                                    </td>

                                    {/* Submitted date */}
                                    <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">{fmtDate(d.submittedAt ?? d.createdAt)}</td>

                                    {/* Days waiting */}
                                    <td className="px-4 py-3.5">
                                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${d.submittedDaysAgo > 7 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                            {d.submittedDaysAgo} يوم
                                        </span>
                                    </td>

                                    {/* Reviewer */}
                                    <td className="px-4 py-3.5">
                                        {d.verificationReviewedBy ? (
                                            <p className="text-xs text-slate-400">{d.verificationReviewedBy.name ?? '—'}</p>
                                        ) : <span className="text-slate-700 text-xs">—</span>}
                                        {d.verificationReviewedAt && (
                                            <p className="text-[10px] text-slate-600">{fmtDate(d.verificationReviewedAt)}</p>
                                        )}
                                    </td>

                                    {/* Documents */}
                                    <td className="px-4 py-3.5">
                                        <div className="flex flex-wrap gap-1">
                                            {hasNewDocs ? (
                                                <>
                                                    {ml && <button onClick={() => openDocument(d._id, 'medicalLicense')} className="text-[10px] px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-semibold cursor-pointer">ترخيص</button>}
                                                    {nif && <button onClick={() => openDocument(d._id, 'nationalIdFront')} className="text-[10px] px-2 py-0.5 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 font-semibold cursor-pointer">هوية أ</button>}
                                                    {nib && <button onClick={() => openDocument(d._id, 'nationalIdBack')} className="text-[10px] px-2 py-0.5 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 font-semibold cursor-pointer">هوية خ</button>}
                                                    {certs.map((c, i) => c.filePath && (
                                                        <button key={i} onClick={() => openDocument(d._id, `cert_${i}`)} className="text-[10px] px-2 py-0.5 rounded-lg bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 font-semibold cursor-pointer">شهادة {i + 1}</button>
                                                    ))}
                                                </>
                                            ) : (
                                                <span className="text-slate-700 text-xs">لا توجد</span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Actions */}
                                    <td className="px-4 py-3.5">
                                        <div className="flex flex-wrap gap-1.5">
                                            {/* Start Review — only for pending */}
                                            {(d.verificationStatus === 'pending' || !d.verificationStatus) && (
                                                <button onClick={() => startReview(d._id)} disabled={!!actionLoading[d._id]}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-400 text-xs font-bold hover:bg-indigo-500/30 transition-colors disabled:opacity-40"
                                                >
                                                    {actionLoading[d._id] === 'review' && <span className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />}
                                                    مراجعة
                                                </button>
                                            )}
                                            {/* Approve */}
                                            {['pending', 'under_review', undefined].includes(d.verificationStatus) && (
                                                <button onClick={() => approve(d._id)} disabled={!!actionLoading[d._id]}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
                                                >
                                                    {actionLoading[d._id] === 'approve' && <span className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />}
                                                    قبول
                                                </button>
                                            )}
                                            {/* Reject */}
                                            {['pending', 'under_review', undefined].includes(d.verificationStatus) && (
                                                <button onClick={() => { setRT(d._id); setRR(''); }} disabled={!!actionLoading[d._id]}
                                                    className="px-2.5 py-1.5 rounded-xl border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/15 transition-colors disabled:opacity-40"
                                                >رفض</button>
                                            )}
                                        </div>
                                        {/* Rejection reason preview */}
                                        {d.verificationStatus === 'rejected' && d.verificationRejectionReason && (
                                            <p className="text-[10px] text-red-400/70 mt-1 max-w-[140px] truncate" title={d.verificationRejectionReason}>
                                                {d.verificationRejectionReason}
                                            </p>
                                        )}
                                    </td>
                                </tr>

                                {/* Changed fields diff row */}
                                {isExpanded && hasDiff && (
                                    <tr className="bg-slate-950/60 border-b border-slate-800">
                                        <td colSpan={10} className="px-6 py-4" dir="rtl">
                                            <p className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-[15px] text-blue-400">compare_arrows</span>
                                                التغييرات المطلوبة ({d.changedFields.length} حقل)
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                {d.changedFields.map((f) => (
                                                    <div key={f.key} className="bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5">
                                                        <p className="text-[11px] font-bold text-slate-500 mb-1.5">{f.label}</p>
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-start gap-2">
                                                                <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded mt-0.5 shrink-0">قبل</span>
                                                                <span className="text-xs text-slate-400 line-through break-all">
                                                                    {f.before != null ? (f.key === 'bio' ? (f.before.length > 60 ? f.before.slice(0, 60) + '…' : f.before) : f.key === 'consultationFee' || f.key === 'followUpFee' ? `${f.before} ج` : f.before) : '—'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-start gap-2">
                                                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded mt-0.5 shrink-0">بعد</span>
                                                                <span className="text-xs text-slate-200 font-semibold break-all">
                                                                    {f.after != null ? (f.key === 'bio' ? (f.after.length > 60 ? f.after.slice(0, 60) + '…' : f.after) : f.key === 'consultationFee' || f.key === 'followUpFee' ? `${f.after} ج` : f.after) : '—'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        );
                    })}
                </DarkTable>

                {/* Pagination */}
                {pages > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                        {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                            <button key={p} onClick={() => load(p, statusFilter, search)}
                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors
                                    ${page === p ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                            >{p}</button>
                        ))}
                    </div>
                )}
                </>
            )}

            {/* Rejection Modal */}
            <AnimatePresence>
                {rejectTarget && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={(e) => e.target === e.currentTarget && !rejectLoading && setRT(null)}
                    >
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl p-7 w-full max-w-sm" dir="rtl"
                        >
                            <div className="w-12 h-12 bg-red-500/20 rounded-2xl flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-red-400 text-[24px]">cancel</span>
                            </div>
                            <h3 className="text-lg font-black text-slate-100 mb-1">رفض الطلب</h3>
                            <p className="text-sm text-slate-400 mb-4">سبب الرفض مطلوب — سيُرسل للطبيب عبر الإشعار والبريد</p>
                            <textarea value={rejectReason} onChange={(e) => setRR(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-600 rounded-2xl p-3 text-sm text-slate-200 resize-none focus:outline-none focus:border-red-500 placeholder-slate-600"
                                rows={3} placeholder="اكتب سبب الرفض بوضوح..."
                            />
                            <div className="flex gap-3 mt-4">
                                <button onClick={reject} disabled={rejectLoading || !rejectReason.trim()}
                                    className="flex-1 bg-red-500 text-white font-bold py-3 rounded-2xl hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {rejectLoading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    رفض وإرسال الإشعار
                                </button>
                                <button onClick={() => setRT(null)} disabled={rejectLoading}
                                    className="flex-1 border border-slate-600 text-slate-300 font-bold py-3 rounded-2xl hover:bg-slate-700 disabled:opacity-40"
                                >رجوع</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}


export { PendingDoctorsSection };

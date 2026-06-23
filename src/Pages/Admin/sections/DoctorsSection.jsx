import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAllDoctors, getDoctorBookings, suspendDoctor, unsuspendDoctor } from '../../../Services/adminService';
import { SERVER_BASE, ReasonModal, SkeletonRows, Pagination, SectionTitle, DarkTable, inputCls, filterBtnCls } from '../adminShared';
import { fmtDate } from '../../../utils/dateFormat';
import { useDebounced } from '../../../hooks/useDebounced';

// ── Status labels (shared) ────────────────────────────────────────────────────

const STATUS_LABELS = {
    confirmed:    { label: 'مؤكد',  bg: 'bg-blue-500/20',    text: 'text-blue-400' },
    completed:    { label: 'مكتمل', bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    cancelled:    { label: 'ملغي',  bg: 'bg-red-500/20',     text: 'text-red-400' },
    'in-progress':{ label: 'جاري',  bg: 'bg-amber-500/20',   text: 'text-amber-400' },
    pending:      { label: 'معلق',  bg: 'bg-slate-700',      text: 'text-slate-400' },
};

// ── Doctor Bookings Panel ─────────────────────────────────────────────────────

function DoctorBookingsPanel({ doctor, onClose, toast }) {
    const [bookings, setBookings] = useState([]);
    const [stats, setStats]       = useState(null);
    const [total, setTotal]       = useState(0);
    const [pages, setPages]       = useState(1);
    const [page, setPage]         = useState(1);
    const [statusFilter, setSF]   = useState('');
    const [loading, setLoading]   = useState(false);

    const loadBookings = useCallback((p = 1) => {
        setLoading(true);
        const params = { page: p, limit: 15 };
        if (statusFilter) params.status = statusFilter;
        getDoctorBookings(doctor._id, params)
            .then((r) => {
                setBookings(r.data?.bookings || []);
                setStats(r.data?.stats || null);
                setTotal(r.data?.pagination?.total || 0);
                setPages(r.data?.pagination?.pages || 1);
                setPage(p);
            })
            .catch(() => toast('تعذّر تحميل الحجوزات', 'error'))
            .finally(() => setLoading(false));
    }, [doctor._id, statusFilter, toast]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { loadBookings(1); }, [doctor._id]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { loadBookings(1); }, [statusFilter]);

    return (
        <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ duration: 0.2 }}
                className="bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl my-6"
                dir="rtl"
            >
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400 font-black text-lg flex-shrink-0">
                            {doctor.user?.name?.charAt(0) ?? 'د'}
                        </div>
                        <div>
                            <h2 className="font-black text-slate-100 text-lg leading-tight">د. {doctor.user?.name ?? '—'}</h2>
                            <p className="text-sm text-slate-500">{doctor.specialization}</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="w-9 h-9 rounded-xl border border-slate-700 flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {stats && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {[
                                { label: 'إجمالي الحجوزات', value: stats.total,                                    color: 'text-slate-200' },
                                { label: 'مكتملة',          value: stats.completed,                                 color: 'text-emerald-400' },
                                { label: 'ملغاة',           value: stats.cancelled,                                 color: 'text-red-400' },
                                { label: 'معدل الإتمام',    value: `${stats.completionRate}%`,                      color: 'text-blue-400' },
                                { label: 'إجمالي الرسوم',  value: `${stats.revenue?.toLocaleString('ar-EG')} ج`,  color: 'text-amber-400' },
                            ].map(({ label, value, color }) => (
                                <div key={label} className="bg-slate-900 rounded-xl p-4 border border-slate-800 text-center">
                                    <p className={`text-xl font-black ${color}`}>{value}</p>
                                    <p className="text-xs text-slate-500 mt-1">{label}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-3 items-center">
                        <select value={statusFilter} onChange={(e) => setSF(e.target.value)} className={inputCls}>
                            <option value="">كل الحالات</option>
                            {Object.entries(STATUS_LABELS).map(([k, { label }]) => (
                                <option key={k} value={k}>{label}</option>
                            ))}
                        </select>
                        <span className="text-sm text-slate-500 font-semibold">{total} حجز</span>
                    </div>

                    <DarkTable headers={['المريض', 'التاريخ', 'الوقت', 'الحالة', 'الرسوم', 'تاريخ الحجز']}>
                        {loading ? <SkeletonRows cols={6} rows={8} /> : bookings.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-600">لا توجد حجوزات</td></tr>
                        ) : bookings.map((b) => {
                            const st = STATUS_LABELS[b.status] || STATUS_LABELS.pending;
                            return (
                                <tr key={b._id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                                    <td className="px-4 py-3.5">
                                        <p className="text-sm font-bold text-slate-200">{b.patient?.name ?? '—'}</p>
                                        <p className="text-xs text-slate-600">{b.patient?.email}</p>
                                    </td>
                                    <td className="px-4 py-3.5 text-slate-400 text-sm whitespace-nowrap">{fmtDate(b.slotDetails?.date)}</td>
                                    <td className="px-4 py-3.5 text-slate-400 text-sm font-mono">{b.slotDetails?.startTime} – {b.slotDetails?.endTime}</td>
                                    <td className="px-4 py-3.5">
                                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${st.bg} ${st.text}`}>{st.label}</span>
                                    </td>
                                    <td className="px-4 py-3.5 text-amber-400 font-bold text-sm">{b.consultationFee} ج</td>
                                    <td className="px-4 py-3.5 text-slate-600 text-xs">{fmtDate(b.createdAt)}</td>
                                </tr>
                            );
                        })}
                    </DarkTable>
                    <Pagination page={page} pages={pages} onPage={loadBookings} />
                </div>
            </motion.div>
        </div>
    );
}

// ── Doctors section ───────────────────────────────────────────────────────────

function DoctorsSection({ toast, liveTick }) {
    const [data, setData]                   = useState([]);
    const [total, setTotal]                 = useState(0);
    const [pages, setPages]                 = useState(1);
    const [page, setPage]                   = useState(1);
    const [loading, setLoading]             = useState(true);
    const [search, setSearch]               = useState('');
    const [suspended, setSuspended]         = useState('');
    const [specialization, setSpec]         = useState('');
    const [suspendTarget, setST]            = useState(null);
    const [actionLoading, setAL]            = useState({});
    const [selectedDocForBookings, setSDFB] = useState(null);
    const dSearch = useDebounced(search);
    const dSpec   = useDebounced(specialization);

    const load = useCallback((p = 1) => {
        setLoading(true);
        const params = { page: p, limit: 20 };
        if (dSearch.trim())   params.search         = dSearch.trim();
        if (suspended !== '') params.suspended      = suspended;
        if (dSpec.trim())     params.specialization = dSpec.trim();
        getAllDoctors(params)
            .then((r) => { setData(r.data); setTotal(r.total); setPages(r.pages); setPage(p); })
            .catch(() => toast('تعذّر تحميل الأطباء', 'error'))
            .finally(() => setLoading(false));
    }, [dSearch, suspended, dSpec, toast]);

    useEffect(() => { load(1); }, [load]);

    // Live refetch on real-time events (skip the initial mount), keeping current page.
    const liveFirst = useRef(true);
    useEffect(() => {
        if (liveFirst.current) { liveFirst.current = false; return; }
        load(page);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveTick]);

    const doUnsuspend = async (profileId) => {
        setAL((p) => ({ ...p, [profileId]: true }));
        try {
            await unsuspendDoctor(profileId);
            toast('تم رفع الإيقاف عن الطبيب');
            load(page);
        } catch (err) {
            toast(err.message || 'حدث خطأ', 'error');
        } finally {
            setAL((p) => { const n = { ...p }; delete n[profileId]; return n; });
        }
    };

    const doSuspend = async (reason) => {
        if (!suspendTarget) return;
        const { profileId } = suspendTarget;
        setAL((p) => ({ ...p, [profileId]: true }));
        try {
            await suspendDoctor(profileId, reason);
            toast('تم تعليق الطبيب بنجاح');
            setST(null);
            load(page);
        } catch (err) {
            toast(err.message || 'حدث خطأ', 'error');
        } finally {
            setAL((p) => { const n = { ...p }; delete n[profileId]; return n; });
        }
    };

    return (
        <div dir="rtl">
            <SectionTitle icon="stethoscope" title="إدارة الأطباء" subtitle={`إجمالي ${total} طبيب مسجّل`} />

            <div className="flex flex-wrap gap-3 mb-5">
                <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load(1)}
                    placeholder="بحث باسم الطبيب..." className={`${inputCls} w-48`} />
                <input value={specialization} onChange={(e) => setSpec(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load(1)}
                    placeholder="التخصص..." className={`${inputCls} w-40`} />
                <select value={suspended} onChange={(e) => setSuspended(e.target.value)} className={inputCls}>
                    <option value="">الكل</option>
                    <option value="false">نشط</option>
                    <option value="true">موقوف</option>
                </select>
                <button onClick={() => load(1)} className={filterBtnCls}>بحث</button>
            </div>

            <DarkTable headers={['الاسم', 'التخصص', 'المدينة', 'التقييم', 'الحالة', 'الإجراء']}>
                {loading ? <SkeletonRows cols={6} /> : data.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-600">لا يوجد أطباء</td></tr>
                ) : data.map((d) => (
                    <tr key={d._id}
                        onClick={() => setSDFB(d)}
                        className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                        <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                                {d.user?.profilePicture
                                    ? <img src={`${SERVER_BASE}${d.user.profilePicture}`} alt="" className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-700" />
                                    : <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 font-black text-sm">{d.user?.name?.charAt(0) ?? 'د'}</div>
                                }
                                <span className="font-bold text-slate-200 text-sm">د. {d.user?.name ?? '—'}</span>
                            </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 text-sm">{d.specialization}</td>
                        <td className="px-4 py-3.5 text-slate-500 text-sm">{d.address?.city ?? '—'}</td>
                        <td className="px-4 py-3.5">
                            <span className="font-black text-amber-400">{d.rating?.toFixed(1) ?? '—'}</span>
                            <span className="text-xs text-slate-600 mr-1">({d.numReviews})</span>
                        </td>
                        <td className="px-4 py-3.5">
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${d.isSuspended ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                {d.isSuspended ? 'موقوف' : 'نشط'}
                            </span>
                        </td>
                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1.5">
                                {d.isSuspended ? (
                                    <button onClick={() => doUnsuspend(d._id)} disabled={actionLoading[d._id]}
                                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
                                    >{actionLoading[d._id] ? '...' : 'رفع الإيقاف'}</button>
                                ) : (
                                    <button onClick={() => setST({ profileId: d._id })} disabled={actionLoading[d._id]}
                                        className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/30 transition-colors disabled:opacity-40"
                                    >تعليق</button>
                                )}
                            </div>
                        </td>
                    </tr>
                ))}
            </DarkTable>
            <div className="mt-3"><Pagination page={page} pages={pages} onPage={load} /></div>

            <ReasonModal
                open={!!suspendTarget}
                title="تعليق حساب الطبيب"
                onConfirm={doSuspend}
                onCancel={() => setST(null)}
                loading={suspendTarget ? !!actionLoading[suspendTarget.profileId] : false}
            />

            <AnimatePresence>
                {selectedDocForBookings && (
                    <DoctorBookingsPanel
                        doctor={selectedDocForBookings}
                        onClose={() => setSDFB(null)}
                        toast={toast}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}


export { DoctorsSection };

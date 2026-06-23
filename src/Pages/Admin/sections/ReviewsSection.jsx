import { useState, useEffect, useCallback, useRef } from 'react';
import { getReviews, deleteReview } from '../../../Services/adminService';
import { ConfirmModal, SkeletonRows, Pagination, SectionTitle, DarkTable, inputCls, filterBtnCls } from '../adminShared';
import { fmtDate } from '../../../utils/dateFormat';
import { useDebounced } from '../../../hooks/useDebounced';

// ── Reviews section ───────────────────────────────────────────────────────────

function ReviewsSection({ toast, liveTick }) {
    const [data, setData]           = useState([]);
    const [total, setTotal]         = useState(0);
    const [pages, setPages]         = useState(1);
    const [page, setPage]           = useState(1);
    const [loading, setLoading]     = useState(true);
    const [search, setSearch]       = useState('');
    const [ratingFilter, setRating] = useState('');
    const [deleteTarget, setDT]     = useState(null);
    const [deleteLoading, setDL]    = useState(false);
    const dSearch = useDebounced(search);

    const load = useCallback((p = 1) => {
        setLoading(true);
        const params = { page: p, limit: 20 };
        if (dSearch.trim()) params.search = dSearch.trim();
        if (ratingFilter)   params.rating = ratingFilter;
        getReviews(params)
            .then((r) => { setData(r.data); setTotal(r.total); setPages(r.pages); setPage(p); })
            .catch(() => toast('تعذّر تحميل التقييمات', 'error'))
            .finally(() => setLoading(false));
    }, [dSearch, ratingFilter, toast]);

    useEffect(() => { load(1); }, [load]);

    // Live refetch when a new review arrives (skip the initial mount).
    const liveFirst = useRef(true);
    useEffect(() => {
        if (liveFirst.current) { liveFirst.current = false; return; }
        load(page);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveTick]);

    const doDelete = async () => {
        if (!deleteTarget) return;
        setDL(true);
        try {
            await deleteReview(deleteTarget);
            toast('تم حذف التقييم');
            setDT(null);
            setData((p) => p.filter((r) => r._id !== deleteTarget));
            setTotal((p) => p - 1);
        } catch (err) {
            toast(err.message || 'حدث خطأ', 'error');
        } finally {
            setDL(false);
        }
    };

    const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
    const starColor = (n) => n >= 4 ? 'text-amber-400' : n >= 3 ? 'text-amber-500' : 'text-orange-500';

    return (
        <div dir="rtl">
            <SectionTitle icon="star" title="إدارة التقييمات" subtitle={`إجمالي ${total} تقييم`} />

            <div className="flex flex-wrap gap-3 mb-5">
                <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load(1)}
                    placeholder="بحث في التعليقات..." className={`${inputCls} w-56`} />
                <select value={ratingFilter} onChange={(e) => setRating(e.target.value)} className={inputCls}>
                    <option value="">كل التقييمات</option>
                    <option value="5">★★★★★ — ممتاز</option>
                    <option value="4">★★★★☆ — جيد جداً</option>
                    <option value="3">★★★☆☆ — جيد</option>
                    <option value="2">★★☆☆☆ — مقبول</option>
                    <option value="1">★☆☆☆☆ — ضعيف</option>
                </select>
                <button onClick={() => load(1)} className={filterBtnCls}>بحث</button>
            </div>

            <DarkTable headers={['المريض', 'الطبيب', 'التقييم', 'التعليق', 'التاريخ', 'الإجراء']}>
                {loading ? <SkeletonRows cols={6} /> : data.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-600">لا توجد تقييمات</td></tr>
                ) : data.map((r) => (
                    <tr key={r._id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-slate-200 text-sm">{r.patient?.name ?? '—'}</td>
                        <td className="px-4 py-3.5 text-slate-400 text-sm">د. {r.doctor?.name ?? '—'}</td>
                        <td className="px-4 py-3.5">
                            <span className={`font-black text-base ${starColor(r.rating)}`}>{stars(r.rating)}</span>
                            <span className="text-xs text-slate-600 mr-1">{r.rating}/5</span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 text-xs max-w-xs truncate">
                            {r.comment || <span className="text-slate-700 italic">لا يوجد تعليق</span>}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 text-xs">{fmtDate(r.createdAt)}</td>
                        <td className="px-4 py-3.5">
                            <button onClick={() => setDT(r._id)}
                                className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-colors"
                            >حذف</button>
                        </td>
                    </tr>
                ))}
            </DarkTable>
            <div className="mt-3"><Pagination page={page} pages={pages} onPage={load} /></div>

            <ConfirmModal open={!!deleteTarget} icon="delete" title="حذف التقييم"
                body="سيتم حذف هذا التقييم نهائياً وتحديث تقييم الطبيب تلقائياً. هل أنت متأكد؟"
                onConfirm={doDelete} onCancel={() => setDT(null)} loading={deleteLoading}
                confirmLabel="حذف التقييم" danger />
        </div>
    );
}


export { ReviewsSection };

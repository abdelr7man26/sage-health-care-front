import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getSystemHealth, getAiServiceHealth, getMetricsHistory, rebuildAiEngine } from '../../../Services/adminService';
import { ConfirmModal, ChartTooltip } from '../adminShared';

// ── Health section ────────────────────────────────────────────────────────────

function StatusDot({ status }) {
    const map = {
        connected:    'bg-emerald-500 shadow-emerald-500/60',
        disconnected: 'bg-red-500 shadow-red-500/60',
        degraded:     'bg-amber-500 shadow-amber-500/60',
        starting:     'bg-sky-400 shadow-sky-400/60 animate-pulse',
        unknown:      'bg-slate-600',
    };
    return <span className={`inline-block w-2.5 h-2.5 rounded-full shadow-md ${map[status] ?? 'bg-slate-600'}`} />;
}

function HealthSection() {
    const [data, setData]                         = useState(null);
    const [aiHealth, setAiHealth]                 = useState(null);
    const [metrics, setMetrics]                   = useState([]);
    const [loading, setLoading]                   = useState(true);
    const [lastRefresh, setLR]                    = useState(null);
    const [showRebuildModal, setShowRebuildModal] = useState(false);
    const [isRebuilding, setIsRebuilding]         = useState(false);
    const [rebuildResult, setRebuildResult]       = useState(null); // {success, data?, message?}

    const load = useCallback(() => {
        setLoading(true);
        Promise.allSettled([
            getSystemHealth(),
            getAiServiceHealth(),
            getMetricsHistory(),
        ]).then(([serverRes, aiRes, metricsRes]) => {
            if (serverRes.status === 'fulfilled') setData(serverRes.value.data);
            else setData(null);
            if (aiRes.status === 'fulfilled') setAiHealth(aiRes.value.data);
            else setAiHealth(null);
            if (metricsRes.status === 'fulfilled') setMetrics(metricsRes.value.data || []);
            else setMetrics([]);
            setLR(new Date());
        }).finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleRebuild = async () => {
        setShowRebuildModal(false);
        setIsRebuilding(true);
        setRebuildResult(null);
        try {
            const r = await rebuildAiEngine();
            setRebuildResult({ success: true, data: r.data });
            load(); // refresh health cards after a successful rebuild
        } catch (err) {
            setRebuildResult({
                success: false,
                message: err.message || 'فشلت عملية إعادة البناء. تأكد من تشغيل محرك الذكاء الاصطناعي.',
            });
        } finally {
            setIsRebuilding(false);
        }
    };

    const uptimeStr = (s) => {
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        return `${d > 0 ? d + 'ي ' : ''}${h}س ${m}د`;
    };

    // AI status comes from the dedicated /ai/health call (aiHealth) — /admin/health no
    // longer probes the engine, so map its detailed status to the card's vocabulary.
    const aiEngineStatus = aiHealth
        ? ({ healthy: 'connected', initializing: 'starting', degraded: 'degraded' }[aiHealth.status] || 'disconnected')
        : 'disconnected';

    const services = data ? [
        { name: 'قاعدة البيانات MongoDB', status: data.mongodb,  icon: 'storage'    },
        { name: 'Redis Cache',            status: data.redis,    icon: 'memory'     },
        { name: 'محرك الذكاء الاصطناعي', status: aiEngineStatus, icon: 'psychology' },
    ] : [];

    const statusAr    = { connected: 'متصل', disconnected: 'غير متصل', degraded: 'متدهور', starting: 'جاري التشغيل', unknown: 'غير معروف' };
    const statusColor = { connected: 'text-emerald-400', disconnected: 'text-red-400', degraded: 'text-amber-400', starting: 'text-sky-400', unknown: 'text-slate-500' };
    const borderColor = { connected: 'border-emerald-800/40', disconnected: 'border-red-800/40', degraded: 'border-amber-800/40', starting: 'border-sky-800/40', unknown: 'border-slate-700' };

    const memPct  = data ? Math.min(100, Math.round((data.memory?.heapUsedMB / data.memory?.heapTotalMB) * 100)) : 0;
    const diskPct = data?.disk ? data.disk.usedPercent : null;

    // Time-series chart data — CPU% and heap% over the sampled window
    const metricsChartData = metrics.map(m => ({
        label:        new Date(m.t).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        'المعالج %':  m.cpu,
        'الذاكرة %':  m.mem,
    }));

    // Groq status → arabic label + colour
    const groqStatusLabel = (s) => {
        if (s === 'reachable') return { label: 'متصل', color: 'text-emerald-400', dot: 'connected' };
        if (!s || s === 'no_api_key') return { label: 'لا يوجد API Key', color: 'text-amber-400', dot: 'degraded' };
        return { label: 'غير متصل', color: 'text-red-400', dot: 'disconnected' };
    };

    return (
        <div dir="rtl">
            {/* ── Rebuild confirmation modal ───────────────────────────────────── */}
            <ConfirmModal
                open={showRebuildModal}
                icon="database_upload"
                title="إعادة بناء قاعدة المعرفة"
                body="ستُحذف قاعدة البيانات المتجهية الحالية ويُعاد بناؤها من ملفات CSV الموجودة في مجلد ai-engine/data/. العملية قد تستغرق عدة دقائق ولن تؤثر على المحادثات الجارية."
                confirmLabel="ابدأ إعادة البناء"
                onConfirm={handleRebuild}
                onCancel={() => setShowRebuildModal(false)}
                loading={false}
            />

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-emerald-400 text-[20px]">monitor_heart</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-100">صحة النظام</h2>
                        {lastRefresh && <p className="text-sm text-slate-500">آخر تحديث: {lastRefresh.toLocaleTimeString('ar-EG')}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Rebuild AI Index button */}
                    <button
                        onClick={() => setShowRebuildModal(true)}
                        disabled={isRebuilding || loading}
                        title="أعد بناء قاعدة المعرفة الخاصة بالذكاء الاصطناعي من ملفات CSV"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-sm font-semibold text-violet-400 hover:bg-violet-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isRebuilding
                            ? <span className="w-4 h-4 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                            : <span className="material-symbols-outlined text-[18px]">database_upload</span>
                        }
                        {isRebuilding ? 'جارٍ إعادة البناء…' : 'إعادة بناء AI'}
                    </button>
                    {/* Refresh button */}
                    <button onClick={load} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors disabled:opacity-40"
                    >
                        <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
                        تحديث
                    </button>
                </div>
            </div>

            {/* ── Rebuild result banner ────────────────────────────────────────── */}
            {rebuildResult && (
                <div className={`mb-6 flex items-start gap-3 p-4 rounded-2xl border ${rebuildResult.success ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <span className={`material-symbols-outlined text-[20px] mt-0.5 shrink-0 ${rebuildResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                        {rebuildResult.success ? 'check_circle' : 'error'}
                    </span>
                    <div className="flex-1 min-w-0">
                        {rebuildResult.success ? (
                            <>
                                <p className="font-bold text-emerald-400 text-sm">تمت إعادة البناء بنجاح</p>
                                <p className="text-emerald-300/70 text-xs mt-0.5">
                                    {rebuildResult.data?.chunks_indexed?.toLocaleString('ar-EG')} chunk مفهرس من {rebuildResult.data?.documents_loaded} ملف
                                </p>
                            </>
                        ) : (
                            <p className="font-bold text-red-400 text-sm">{rebuildResult.message}</p>
                        )}
                    </div>
                    <button onClick={() => setRebuildResult(null)} className="text-slate-500 hover:text-slate-300 shrink-0">
                        <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                </div>
            )}

            {/* ── Service status cards (MongoDB · Redis · AI ping) ─────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {loading ? [1,2,3].map(i => (
                    <div key={i} className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
                        <div className="h-5 w-32 bg-slate-800 rounded-full animate-pulse mb-3" />
                        <div className="h-4 w-16 bg-slate-800 rounded-full animate-pulse" />
                    </div>
                )) : services.map((s) => (
                    <div key={s.name} className={`bg-slate-900 rounded-2xl p-5 border transition-colors ${borderColor[s.status] || 'border-slate-800'}`}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[20px] text-slate-400">{s.icon}</span>
                            </div>
                            <p className="font-bold text-slate-200 text-sm">{s.name}</p>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <StatusDot status={s.status} />
                            <span className={`text-sm font-black ${statusColor[s.status] ?? 'text-slate-500'}`}>
                                {statusAr[s.status] ?? s.status}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── AI Engine details card ───────────────────────────────────────── */}
            <div className="mb-6">
                <div className={`bg-slate-900 rounded-2xl border p-5 transition-colors ${
                    !loading && aiHealth?.status === 'healthy' ? 'border-violet-800/40'
                    : !loading && aiHealth?.status === 'initializing' ? 'border-sky-800/40'
                    : !loading && aiHealth ? 'border-amber-800/40'
                    : 'border-slate-800'
                }`}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-violet-400 text-[18px]">psychology</span>
                            </div>
                            <p className="font-bold text-slate-200 text-sm">تفاصيل محرك الذكاء الاصطناعي</p>
                        </div>
                        {!loading && aiHealth && (
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                                aiHealth.status === 'healthy'        ? 'bg-emerald-500/15 text-emerald-400'
                                : aiHealth.status === 'initializing' ? 'bg-sky-500/15 text-sky-400'
                                : 'bg-amber-500/15 text-amber-400'
                            }`}>
                                {aiHealth.status === 'healthy'        ? 'سليم'
                                : aiHealth.status === 'initializing' ? 'جاري التشغيل'
                                : 'متدهور'}
                            </span>
                        )}
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[1,2,3,4].map(i => <div key={i} className="h-16 bg-slate-800 rounded-xl animate-pulse" />)}
                        </div>
                    ) : aiHealth?.status === 'initializing' ? (
                        <div className="flex items-center justify-center gap-3 py-6">
                            <span className="w-4 h-4 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
                            <p className="text-xs text-sky-400 font-bold">
                                المحرك قيد التشغيل — يتم تحميل نموذج الـ Embeddings وقاعدة المعرفة، عادةً أقل من دقيقة…
                            </p>
                        </div>
                    ) : aiHealth ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {/* Groq API */}
                            <div className="bg-slate-800/60 rounded-xl p-3">
                                <p className="text-[10px] text-slate-500 mb-2">Groq API</p>
                                <div className="flex items-center gap-1.5">
                                    <StatusDot status={groqStatusLabel(aiHealth.llm?.groq_status).dot} />
                                    <span className={`text-xs font-black ${groqStatusLabel(aiHealth.llm?.groq_status).color}`}>
                                        {groqStatusLabel(aiHealth.llm?.groq_status).label}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-600 mt-1 truncate">{aiHealth.llm?.model}</p>
                            </div>

                            {/* ChromaDB chunks */}
                            <div className="bg-slate-800/60 rounded-xl p-3">
                                <p className="text-[10px] text-slate-500 mb-1">قاعدة المعرفة</p>
                                <p className="text-xl font-black text-blue-400 leading-none">
                                    {aiHealth.vectorstore?.document_chunks?.toLocaleString('ar-EG') ?? '—'}
                                </p>
                                <p className="text-[10px] text-slate-600 mt-1">chunk مفهرس</p>
                            </div>

                            {/* Embeddings model */}
                            <div className="bg-slate-800/60 rounded-xl p-3">
                                <p className="text-[10px] text-slate-500 mb-2">نموذج الـ Embeddings</p>
                                <p className="text-xs font-bold text-slate-300">محلي</p>
                                <p className="text-[10px] text-slate-600 mt-0.5 truncate" title={aiHealth.embeddings?.model}>
                                    sentence-transformers
                                </p>
                            </div>

                            {/* Engine state */}
                            <div className="bg-slate-800/60 rounded-xl p-3">
                                <p className="text-[10px] text-slate-500 mb-2">حالة المحرك</p>
                                <div className="flex items-center gap-1.5">
                                    <StatusDot status={aiHealth.engine_initialized ? 'connected' : 'degraded'} />
                                    <span className={`text-xs font-black ${aiHealth.engine_initialized ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {aiHealth.engine_initialized ? 'جاهز' : 'غير جاهز'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-600 text-center py-4">تعذّر جلب تفاصيل محرك الذكاء الاصطناعي — تأكد من تشغيله</p>
                    )}
                </div>
            </div>

            {/* ── Server metrics (uptime · memory · CPU · disk) ───────────────── */}
            {data && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[18px] text-blue-400">timer</span>
                            <p className="font-bold text-slate-300 text-sm">وقت التشغيل</p>
                        </div>
                        <p className="text-2xl font-black text-blue-400">{uptimeStr(data.uptime)}</p>
                    </div>

                    <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[18px] text-violet-400">memory</span>
                            <p className="font-bold text-slate-300 text-sm">الذاكرة المستخدمة</p>
                        </div>
                        <p className="text-2xl font-black text-violet-400">{data.memory?.heapUsedMB} <span className="text-sm font-bold">MB</span></p>
                        <p className="text-xs text-slate-600 mt-1">من {data.memory?.heapTotalMB} MB heap</p>
                        <div className="mt-3 bg-slate-800 rounded-full h-2 overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${memPct}%` }} transition={{ duration: 1 }}
                                className={`h-2 rounded-full ${memPct > 80 ? 'bg-red-500' : memPct > 60 ? 'bg-amber-500' : 'bg-violet-500'}`}
                            />
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{memPct}%</p>
                    </div>

                    <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[18px] text-amber-400">speed</span>
                            <p className="font-bold text-slate-300 text-sm">استخدام المعالج</p>
                        </div>
                        <p className="text-2xl font-black text-amber-400">{data.cpuPct ?? 0}<span className="text-base">%</span></p>
                        <p className="text-xs text-slate-600 mt-1">متوسط منذ آخر فحص</p>
                    </div>

                    {diskPct !== null && (
                        <div className={`bg-slate-900 rounded-2xl p-5 border ${diskPct > 85 ? 'border-red-500/40' : 'border-slate-800'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className={`material-symbols-outlined text-[18px] ${diskPct > 85 ? 'text-red-400' : diskPct > 70 ? 'text-amber-400' : 'text-emerald-400'}`}>hard_drive</span>
                                    <p className="font-bold text-slate-300 text-sm">مساحة القرص</p>
                                </div>
                                {diskPct > 85 && (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-red-500/15 text-red-400">تحذير</span>
                                )}
                            </div>
                            <p className={`text-2xl font-black ${diskPct > 85 ? 'text-red-400' : diskPct > 70 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {diskPct}%
                            </p>
                            <p className="text-xs text-slate-600 mt-1">{data.disk.usedGB} GB من {data.disk.totalGB} GB</p>
                            <div className="mt-3 bg-slate-800 rounded-full h-2 overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${diskPct}%` }}
                                    transition={{ duration: 1 }}
                                    className={`h-2 rounded-full ${diskPct > 85 ? 'bg-red-500' : diskPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                />
                            </div>
                            <p className="text-xs text-slate-600 mt-1">متاح: {data.disk.freeGB} GB</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── Resource usage over time (time-series) ───────────────────────── */}
            {data && (
                <div className="mt-4 bg-slate-900 rounded-2xl p-6 border border-slate-800">
                    <h3 className="font-black text-slate-200 mb-4 flex items-center gap-2 text-sm">
                        <span className="material-symbols-outlined text-[18px] text-cyan-400">monitoring</span>
                        استهلاك الموارد عبر الوقت
                        <span className="text-[10px] text-slate-600 font-normal">(آخر ~24 ساعة · عيّنة كل 3 دقائق)</span>
                    </h3>
                    {metricsChartData.length > 1 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={metricsChartData} margin={{ right: 4, left: -20 }}>
                                <defs>
                                    <linearGradient id="gCpuHist" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gMemHist" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false}
                                    interval={Math.max(0, Math.floor(metricsChartData.length / 8))} />
                                <YAxis domain={[0, 100]} unit="%" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12, direction: 'rtl' }}
                                    formatter={v => <span style={{ color: '#94a3b8' }}>{v}</span>} />
                                <Area type="monotone" dataKey="المعالج %" stroke="#f59e0b" fill="url(#gCpuHist)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                                <Area type="monotone" dataKey="الذاكرة %" stroke="#8b5cf6" fill="url(#gMemHist)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-sm text-slate-600 py-10 text-center">
                            جارٍ جمع البيانات — أول عيّنة تُسجَّل خلال 3 دقائق من تشغيل السيرفر. ارجع بعد قليل.
                        </p>
                    )}
                </div>
            )}

            {/* ── Performance metrics (AI latency · MongoDB slow queries) ───────── */}
            {data && (
                <div className="mt-4">
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-cyan-400">speed</span>
                        مقاييس الأداء
                        <span className="text-[10px] text-slate-700 font-normal normal-case">(عيّنات حيّة من آخر فترة)</span>
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* AI engine latency */}
                        <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px] text-violet-400">network_intelligence</span>
                                    <p className="font-bold text-slate-300 text-sm">زمن استجابة الذكاء الاصطناعي</p>
                                </div>
                                {data.aiLatency?.count != null && (
                                    <span className="text-[10px] text-slate-600">{data.aiLatency.count.toLocaleString('ar-EG')} عيّنة</span>
                                )}
                            </div>
                            {data.aiLatency ? (
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { label: 'وسيط (p50)', val: data.aiLatency.p50, hint: 'نصف الردود أسرع من' },
                                        { label: 'p95',         val: data.aiLatency.p95, hint: '95% أسرع من' },
                                        { label: 'p99',         val: data.aiLatency.p99, hint: 'أبطأ 1%' },
                                    ].map(({ label, val, hint }) => {
                                        const sec   = val / 1000;
                                        const color = val >= 15000 ? 'text-red-400' : val >= 8000 ? 'text-amber-400' : 'text-emerald-400';
                                        return (
                                            <div key={label} className="bg-slate-800/60 rounded-xl p-3 text-center" title={hint}>
                                                <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                                                <p className={`text-lg font-black leading-none ${color}`}>
                                                    {sec >= 1 ? sec.toFixed(1) : (val).toString()}
                                                    <span className="text-[10px] font-bold mr-0.5">{sec >= 1 ? 'ث' : 'مس'}</span>
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-600 py-3 text-center">لا توجد عيّنات بعد — لم تُرسَل رسائل للمساعد الذكي مؤخراً</p>
                            )}
                            <p className="text-[10px] text-slate-700 mt-3">حدّ التنبيه: p95 أعلى من 15 ثانية</p>
                        </div>

                        {/* MongoDB slow queries */}
                        <div className={`bg-slate-900 rounded-2xl p-5 border ${(data.slowQueries?.count || 0) >= 10 ? 'border-amber-500/40' : 'border-slate-800'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className={`material-symbols-outlined text-[18px] ${(data.slowQueries?.count || 0) >= 10 ? 'text-amber-400' : 'text-blue-400'}`}>database</span>
                                    <p className="font-bold text-slate-300 text-sm">الاستعلامات البطيئة</p>
                                </div>
                                <span className="text-[10px] text-slate-600">آخر ساعة</span>
                            </div>
                            {data.slowQueries ? (
                                <>
                                    <div className="flex items-baseline gap-2">
                                        <p className={`text-3xl font-black leading-none ${data.slowQueries.count >= 10 ? 'text-amber-400' : 'text-blue-400'}`}>
                                            {data.slowQueries.count.toLocaleString('ar-EG')}
                                        </p>
                                        <span className="text-xs text-slate-500">استعلام تجاوز 500 مللي ثانية</span>
                                    </div>
                                    {data.slowQueries.last && (
                                        <div className="mt-3 bg-slate-800/60 rounded-xl p-3">
                                            <p className="text-[10px] text-slate-500 mb-1">آخر استعلام بطيء</p>
                                            <p className="text-xs font-mono text-slate-300 truncate" dir="ltr" title={data.slowQueries.last}>{data.slowQueries.last}</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex items-center gap-2 py-3">
                                    <span className="material-symbols-outlined text-[20px] text-emerald-400">check_circle</span>
                                    <p className="text-sm text-emerald-400 font-bold">لا توجد استعلامات بطيئة</p>
                                </div>
                            )}
                            <p className="text-[10px] text-slate-700 mt-3">حدّ التنبيه: أكثر من 10 استعلامات في الساعة</p>
                        </div>

                    </div>
                </div>
            )}

            {!loading && !data && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-10 text-center">
                    <span className="material-symbols-outlined text-[52px] text-red-500 block mb-3">error</span>
                    <p className="text-red-400 font-bold text-lg">تعذّر جلب بيانات صحة النظام</p>
                </div>
            )}
        </div>
    );
}


export { HealthSection };

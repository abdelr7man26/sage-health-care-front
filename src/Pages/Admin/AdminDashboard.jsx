import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getPendingDoctors, getSystemHealth, getSseTicket } from '../../Services/adminService';
import { useAuth } from '../../context/AuthContext';
import { ToastStack, NavItem } from './adminShared';
import { useToasts } from '../../hooks/useToasts';
import { OverviewSection } from './sections/OverviewSection';
import { PendingDoctorsSection } from './sections/PendingDoctorsSection';
import { DoctorsSection } from './sections/DoctorsSection';
import { UsersSection } from './sections/UsersSection';
import { ReviewsSection } from './sections/ReviewsSection';
import { AuditLogsSection } from './sections/AuditLogsSection';
import { HealthSection } from './sections/HealthSection';
import { SystemActivitySection } from './sections/SystemActivitySection';
import { BookingAnalyticsSection } from './sections/BookingAnalyticsSection';
import { ErrorLogsSection } from './sections/ErrorLogsSection';
import { OpsCenterSection } from './sections/OpsCenterSection';
import { AnalyticsSection } from './sections/analytics/AnalyticsSection';

// Valid sidebar tab keys. The active tab is mirrored in the URL (?tab=…) so the
// browser back/forward buttons step through tabs instead of leaving the site.
const SECTION_KEYS = new Set([
    'overview', 'booking-analytics', 'analytics', 'pending-doctors', 'doctors',
    'users', 'reviews', 'ops-center', 'system-activity', 'audit-logs', 'error-logs', 'health',
]);

export default function AdminDashboard() {
    const { user, signOut }                         = useAuth();
    const navigate                                  = useNavigate();
    const [searchParams, setSearchParams]           = useSearchParams();
    const tabParam                                  = searchParams.get('tab');
    const activeSection                             = SECTION_KEYS.has(tabParam) ? tabParam : 'overview';
    const [pendingCount, setPendingCount]           = useState(0);

    // Switch tab by updating the URL — each switch is its own history entry, so the
    // browser back button navigates between tabs (overview stays param-free).
    const setActiveSection = (key) => {
        const next = SECTION_KEYS.has(key) ? key : 'overview';
        if (next === activeSection) return;
        setSearchParams(next === 'overview' ? {} : { tab: next });
    };
    const [sysHealthy, setSysHealthy]               = useState(true);
    const { toasts, show: toast, dismiss }          = useToasts();

    // Shared with PendingDoctorsSection so the sidebar badge refreshes
    // immediately after an approve/reject without a full page reload.
    const refreshPendingCount = useCallback(() => {
        getPendingDoctors({ limit: 1 })
            .then((data) => setPendingCount(data.total ?? data.data?.length ?? 0))
            .catch(() => {});
    }, []);

    useEffect(() => {
        refreshPendingCount();
        getSystemHealth()
            .then((data) => {
                const d = data.data;
                setSysHealthy(d.mongodb === 'connected' && d.redis === 'connected');
            })
            .catch(() => setSysHealthy(false));
    }, [refreshPendingCount]);

    // ── Real-time updates (SSE) ──────────────────────────────────────────────
    // Listens for admin-wide events and refreshes the sidebar count + live-refetches
    // the open section, so changes from other users/admins appear without a reload.
    // liveTick is bumped on each relevant event; sections that accept it re-fetch.
    const [liveTick, setLiveTick] = useState(0);
    const toastRef   = useRef(toast);
    const refreshRef = useRef(refreshPendingCount);
    useEffect(() => { toastRef.current = toast; refreshRef.current = refreshPendingCount; });

    useEffect(() => {
        const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        let es = null, retryMs = 1000, retryTimer = null, unmounted = false;

        const connect = async () => {
            if (unmounted) return;
            // One-time ticket so the JWT never lands in the SSE URL (logs/history).
            let ticket;
            try {
                const data = await getSseTicket();
                ticket = data.ticket;
            } catch {
                if (!unmounted) retryTimer = setTimeout(() => { retryMs = Math.min(retryMs * 2, 30_000); connect(); }, retryMs);
                return;
            }
            if (unmounted) return;

            es = new EventSource(`${base}/admin/events?ticket=${ticket}`);

            es.addEventListener('doctor-application', (e) => {
                let info = {}; try { info = JSON.parse(e.data); } catch { /* ignore */ }
                refreshRef.current();          // sidebar badge
                setLiveTick(t => t + 1);       // live-refetch open section
                toastRef.current(`🔔 طلب طبيب جديد${info.doctorName ? ` — ${info.doctorName}` : ''}`);
                retryMs = 1000;
            });

            es.addEventListener('doctor-decision', () => {
                refreshRef.current();
                setLiveTick(t => t + 1);
                retryMs = 1000;
            });

            es.addEventListener('user-registered', () => {
                setLiveTick(t => t + 1);   // overview + users section refetch
                retryMs = 1000;
            });

            es.addEventListener('review-created', () => {
                setLiveTick(t => t + 1);   // reviews + overview refetch
                retryMs = 1000;
            });

            es.addEventListener('security-event', (e) => {
                let info = {}; try { info = JSON.parse(e.data); } catch { /* ignore */ }
                setLiveTick(t => t + 1);   // ops center refetch
                const label = info.type === 'brute_force' ? 'محاولة اختراق' : 'نشاط مشبوه';
                toastRef.current(`🛡️ تنبيه أمني: ${label}${info.detail ? ` — ${info.detail}` : ''}`, 'warning');
                retryMs = 1000;
            });

            es.onopen  = () => { retryMs = 1000; };
            es.onerror = () => {
                // EventSource auto-reconnect would reuse the consumed (one-time) ticket
                // and 401, so on a closed stream we fetch a fresh ticket and reconnect.
                if (es.readyState === EventSource.CLOSED) {
                    es.close();
                    if (!unmounted) retryTimer = setTimeout(() => { retryMs = Math.min(retryMs * 2, 30_000); connect(); }, retryMs);
                }
            };
        };

        connect();
        return () => { unmounted = true; if (es) es.close(); if (retryTimer) clearTimeout(retryTimer); };
    }, []);

    const handleLogout = () => { signOut(); navigate('/login'); };

    const navGroups = [
        {
            label: 'المنصة',
            items: [
                { key: 'overview',          icon: 'dashboard',     label: 'نظرة عامة' },
                { key: 'booking-analytics', icon: 'analytics',     label: 'إحصائيات العيادات' },
            ],
        },
        {
            label: 'ذكاء البيانات',
            items: [
                { key: 'analytics', icon: 'insights', label: 'تحليلات متقدمة' },
            ],
        },
        {
            label: 'المستخدمون',
            items: [
                { key: 'pending-doctors', icon: 'pending',     label: 'طلبات الأطباء', badge: pendingCount },
                { key: 'doctors',         icon: 'stethoscope', label: 'الأطباء' },
                { key: 'users',           icon: 'people',      label: 'المستخدمون' },
            ],
        },
        {
            label: 'المحتوى',
            items: [
                { key: 'reviews', icon: 'star', label: 'التقييمات' },
            ],
        },
        {
            label: 'النظام',
            items: [
                { key: 'ops-center',      icon: 'security',      label: 'مركز العمليات' },
                { key: 'system-activity', icon: 'monitoring',    label: 'نشاط النظام' },
                { key: 'audit-logs',      icon: 'history',       label: 'سجل الإدارة' },
                { key: 'error-logs',      icon: 'bug_report',    label: 'سجل الأخطاء' },
                { key: 'health',          icon: 'monitor_heart', label: 'صحة النظام' },
            ],
        },
    ];
    const navItems = navGroups.flatMap(g => g.items);

    return (
        <div className="min-h-screen bg-slate-950 flex font-['Poppins']" dir="rtl">

            {/* ── Sidebar ── */}
            <aside className="fixed inset-y-0 right-0 w-64 bg-slate-900 border-l border-slate-800 flex flex-col z-40">
                {/* Accent line */}
                <div className="h-0.5 w-full bg-gradient-to-l from-emerald-500 via-emerald-600/60 to-transparent" />

                {/* Logo */}
                <div className="px-5 py-5 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <span className="text-white text-sm font-black">S</span>
                        </div>
                        <div>
                            <p className="font-black text-slate-100 text-sm leading-tight">SAGE Admin</p>
                            <p className="text-xs text-slate-500">لوحة التحكم</p>
                        </div>
                    </div>
                </div>

                {/* Admin profile */}
                <div className="px-5 py-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-900 flex items-center justify-center font-black text-white text-base ring-2 ring-emerald-500/25">
                            {user?.name?.charAt(0) ?? 'A'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-100 text-sm leading-tight truncate">{user?.name ?? 'مشرف'}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[11px] text-emerald-400 font-semibold">نشط الآن</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 flex flex-col gap-0.5">
                    {navGroups.map((group) => (
                        <div key={group.label} className="mb-3">
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2 mb-1.5">{group.label}</p>
                            {group.items.map((item) => (
                                <NavItem key={item.key} icon={item.icon} label={item.label} badge={item.badge}
                                    active={activeSection === item.key} onClick={() => setActiveSection(item.key)} />
                            ))}
                        </div>
                    ))}
                </nav>

                {/* Logout */}
                <div className="px-4 pb-5 pt-3 border-t border-slate-800">
                    <button onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold text-red-400 rounded-xl hover:bg-red-500/10 hover:text-red-300 transition-colors border border-red-500/20"
                    >
                        <span className="material-symbols-outlined text-[18px]">logout</span>
                        تسجيل الخروج
                    </button>
                </div>
            </aside>

            {/* ── Main content ── */}
            <main className="flex-1 mr-64 min-h-screen flex flex-col">
                {/* Header */}
                <header className="sticky top-0 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 z-30 px-8 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-base font-black text-slate-100">
                            {navItems.find(n => n.key === activeSection)?.label || 'لوحة التحكم'}
                        </h1>
                        <p className="text-xs text-slate-500">مرحباً {user?.name ?? 'مشرف'} — SAGE Healthcare</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${sysHealthy ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${sysHealthy ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <span className={`text-xs font-bold ${sysHealthy ? 'text-emerald-400' : 'text-red-400'}`}>{sysHealthy ? 'النظام يعمل' : 'تحقق من صحة النظام'}</span>
                        </div>
                        <span className="material-symbols-outlined text-[22px] text-slate-700">admin_panel_settings</span>
                    </div>
                </header>

                {/* Page */}
                <div className="flex-1 p-8">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeSection}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.18 }}
                        >
                            {activeSection === 'overview'          && <OverviewSection onNavigate={setActiveSection} liveTick={liveTick} />}
                            {activeSection === 'booking-analytics' && <BookingAnalyticsSection />}
                            {activeSection === 'analytics'        && <AnalyticsSection />}
                            {activeSection === 'pending-doctors'  && <PendingDoctorsSection toast={toast} onCountChange={refreshPendingCount} liveTick={liveTick} />}
                            {activeSection === 'doctors'          && <DoctorsSection toast={toast} liveTick={liveTick} />}
                            {activeSection === 'users'            && <UsersSection toast={toast} liveTick={liveTick} />}
                            {activeSection === 'reviews'          && <ReviewsSection toast={toast} liveTick={liveTick} />}
                            {activeSection === 'system-activity'  && <SystemActivitySection />}
                            {activeSection === 'audit-logs'       && <AuditLogsSection />}
                            {activeSection === 'error-logs'       && <ErrorLogsSection />}
                            {activeSection === 'health'           && <HealthSection />}
                            {activeSection === 'ops-center'       && <OpsCenterSection liveTick={liveTick} />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>

            <ToastStack toasts={toasts} dismiss={dismiss} />
        </div>
    );
}

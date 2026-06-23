import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import SageAIChat from '../../components/SageAIChat';
import AIConsentGate from '../../components/AIConsentGate';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useQueryClient } from '@tanstack/react-query';
import { useMe, useDoctors, useMyBookings, useMyOperations, useMyFollowUps, useMyWalkIns } from '../../hooks/usePatientData';
import { queryKeys } from '../../lib/queryClient';
import { NOTIF_ICON, timeAgo } from '../../utils/notifHelpers';
import { fmtTime } from '../../utils/timeFormat';
import Footer from '../../components/Footer';
import { SERVER_BASE } from './Dashboard/serverBase';
import {
    getGreeting, getNextMedication, getNextEvent, isToday,
    getNowHHMM, slotDateKey, getTodayKey, formatDate,
} from './Dashboard/dashboardHelpers';
import { SkeletonCard, ReminderSkeleton } from './Dashboard/Skeletons';
import DoctorCard from './Dashboard/DoctorCard';
import HeroSection from './Dashboard/HeroSection';


// ── Main Component ─────────────────────────────────────────────────────────────
export default function PatientDashboard() {
    const { user, signOut, updateUser } = useAuth();
    const navigate = useNavigate();
    usePushNotifications(!!user);

    // ── Patient data via TanStack Query ───────────────────────────────────────
    // Each read is its own cached query (deduped by key). This replaces the old
    // Promise.all + useState loader and gives us: instant back-navigation within
    // staleTime, automatic request dedup across components, and SSE-driven
    // freshness (the SSE effect below calls qc.invalidateQueries on events).
    const qc = useQueryClient();
    const { data: patientData = null, isLoading: loadingProfile, error: meError, refetch: refetchMe } = useMe();
    const { data: doctors = [],    isLoading: loadingDoctors, refetch: refetchDoctors }   = useDoctors({ limit: 40 });
    const { data: bookings = [],   refetch: refetchBookings }   = useMyBookings({ upcoming: true, limit: 10 });
    const { data: operations = [], refetch: refetchOperations } = useMyOperations();
    const { data: followUps = [],  refetch: refetchFollowUps }  = useMyFollowUps();
    const { data: walkIns = [],    refetch: refetchWalkIns }    = useMyWalkIns();
    const profileError = meError ? (meError.message || 'Failed to load your profile') : null;

    const [walkInEta, setWalkInEta]             = useState(null);
    const [bookingEta, setBookingEta]           = useState(null);
    const [waterGlasses, setWaterGlasses]       = useState(0);
    const [specialtyFilter, setSpecialtyFilter] = useState('');
    const [mobileMenuOpen, setMobileMenuOpen]   = useState(false);
    const [userMenuOpen, setUserMenuOpen]       = useState(false);
    const patientCity = patientData?.medicalInfo?.city || '';
    const [userCoords, setUserCoords]           = useState(null); // { lat, lon }
    const [notifications, setNotifications]     = useState([]);
    const [notifOpen, setNotifOpen]             = useState(false);
    const [notifPos, setNotifPos]               = useState({ top: 0, right: 0 });
    const menuRef      = useRef(null);
    const notifRef     = useRef(null);   // button wrapper — click-outside anchor
    const notifPanelRef = useRef(null); // portal panel — click-outside anchor

    // ── Notifications ────────────────────────────────────────────────────────
    const fetchNotifications = useCallback(async () => {
        try {
            const { data } = await axiosInstance.get('/patients/notifications');
            setNotifications(data.data || []);
        } catch { /* ignore */ }
    }, []);
    const fetchNotificationsRef = useRef(fetchNotifications);
    useEffect(() => { fetchNotificationsRef.current = fetchNotifications; }, [fetchNotifications]);

    const markOneRead = useCallback(async (id) => {
        try {
            await axiosInstance.put(`/patients/notifications/${id}/read`);
            setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n));
        } catch { /* ignore */ }
    }, []);

    const markAllAsRead = useCallback(async () => {
        try {
            await axiosInstance.put('/patients/notifications/read-all');
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        } catch { /* ignore */ }
    }, []);

    const deleteNotif = useCallback(async (id) => {
        try {
            await axiosInstance.delete(`/patients/notifications/${id}`);
            setNotifications((prev) => prev.filter((n) => n._id !== id));
        } catch { /* ignore */ }
    }, []);

    // Recompute the notification panel's fixed position from the bell button's
    // current bounding rect. Called on open, scroll, and resize so the panel
    // always stays anchored to the bell even if the page scrolls.
    const updateNotifPos = useCallback(() => {
        if (notifRef.current) {
            const rect = notifRef.current.getBoundingClientRect();
            setNotifPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
        }
    }, []);

    const toggleNotif = useCallback(() => {
        if (!notifOpen && notifRef.current) {
            updateNotifPos();
            fetchNotificationsRef.current();
        }
        setNotifOpen((o) => !o);
    }, [notifOpen, updateNotifPos]);

    // Keep panel anchored when user scrolls or resizes the window
    useEffect(() => {
        if (!notifOpen) return;
        const onScrollOrResize = () => updateNotifPos();
        window.addEventListener('scroll', onScrollOrResize, { passive: true });
        window.addEventListener('resize', onScrollOrResize);
        return () => {
            window.removeEventListener('scroll', onScrollOrResize);
            window.removeEventListener('resize', onScrollOrResize);
        };
    }, [notifOpen, updateNotifPos]);

    // Manual full refresh — used by the error-banner "retry" button. The hooks
    // fetch automatically on mount, so this is only needed to recover from a
    // failed load.
    const refetchAll = useCallback(() => {
        refetchMe(); refetchBookings(); refetchOperations();
        refetchFollowUps(); refetchWalkIns(); refetchDoctors();
    }, [refetchMe, refetchBookings, refetchOperations, refetchFollowUps, refetchWalkIns, refetchDoctors]);

    // Keep the auth context's profilePicture in sync with the freshly-cached
    // profile (previously done inline in fetchProfileData). Runs only when the
    // value actually changes, so it can't loop.
    useEffect(() => {
        if (patientData?.profilePicture !== undefined) {
            updateUser({ profilePicture: patientData.profilePicture });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientData?.profilePicture]);

    // Lightweight re-fetch — only upcoming bookings, no full profile reload.
    // Called by the minute ticker when a slot's time has just passed; react-query
    // dedupes and updates the shared cache so any consumer re-renders.
    const fetchBookingsOnly = useCallback(() => { refetchBookings(); }, [refetchBookings]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // ── Browser geolocation — used to sort doctors by real distance ───────────
    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            () => setUserCoords(null), // permission denied or unavailable — fallback to city sort
            { timeout: 6000, maximumAge: 5 * 60 * 1000 }
        );
    }, []);

    // ── Walk-in ETA: fetch queue status when there's an active walk-in ─────────
    useEffect(() => {
        const todayKey = getTodayKey();
        const active = walkIns.find((w) => ['waiting', 'in-progress'].includes(w.status) && slotDateKey(w.date) === todayKey);
        if (!active) { setWalkInEta(null); return; }
        // In-progress: freeze to when the consultation actually started — no more recalculation
        if (active.status === 'in-progress') {
            setWalkInEta(active.consultationStartedAt || active.arrivalTime || null);
            return;
        }
        axiosInstance.get(`/patients/my-walkins/${active._id}/queue-status`)
            .then(({ data }) => setWalkInEta(data.data?.estimatedArrival || null))
            .catch(() => setWalkInEta(null));
    }, [walkIns]);

    // ── Booking ETA: fetch dynamic queue ETA for today's nearest booking ─────────
    useEffect(() => {
        const todayKey = getTodayKey();
        const todayBooking = bookings.find((b) =>
            ['confirmed', 'pending', 'in-progress'].includes(b.status) &&
            slotDateKey(b.slotDetails.date) === todayKey
        );
        if (!todayBooking) { setBookingEta(null); return; }
        // In-progress: freeze to when the consultation actually started — no more recalculation
        if (todayBooking.status === 'in-progress') {
            setBookingEta(todayBooking.consultationStartedAt || todayBooking.slotDetails?.startTime || null);
            return;
        }
        axiosInstance.get(`/bookings/${todayBooking._id}/queue-status`)
            .then(({ data }) => setBookingEta(data.data?.estimatedArrival || null))
            .catch(() => setBookingEta(null));
    }, [bookings]);

    // ── Patient real-time notifications via SSE ────────────────────────────────
    useEffect(() => {
        const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        let es         = null;
        let retryMs    = 1000;
        let retryTimer = null;
        let unmounted  = false;

        const connect = async () => {
            if (unmounted) return;
            let ticket;
            try {
                const { data } = await axiosInstance.get('/patients/sse-ticket');
                ticket = data.ticket;
            } catch {
                if (!unmounted) retryTimer = setTimeout(() => {
                    retryMs = Math.min(retryMs * 2, 30_000);
                    connect();
                }, retryMs);
                return;
            }
            if (unmounted) return;

            es = new EventSource(`${base}/patients/events?ticket=${ticket}`);

            es.addEventListener('appointment-reminder', (e) => {
                let info = {};
                try { info = JSON.parse(e.data); } catch { /* ignore */ }
                if (info.notification) {
                    setNotifications((prev) => [info.notification, ...prev]);
                } else {
                    fetchNotificationsRef.current();
                }
                retryMs = 1000;
            });

            // Walk-in registered — add in-app notification + refresh walk-ins state
            es.addEventListener('walkin-registered', (e) => {
                let info = {};
                try { info = JSON.parse(e.data); } catch { /* ignore */ }
                if (info.notification) {
                    setNotifications((prev) => [info.notification, ...prev]);
                }
                // Invalidate the cached walk-ins so react-query refetches and any
                // component reading useMyWalkIns re-renders with fresh data.
                qc.invalidateQueries({ queryKey: queryKeys.myWalkIns });
                window.dispatchEvent(new CustomEvent('sage:walkin-registered', { detail: info }));
                retryMs = 1000;
            });

            // Queue shift — relay to QueueTracker via window event
            es.addEventListener('queue-shift', (e) => {
                let payload = {};
                try { payload = JSON.parse(e.data); } catch { /* ignore */ }
                window.dispatchEvent(new CustomEvent('sage:queue-shift', { detail: payload }));
                retryMs = 1000;
            });

            // Late check-in (walk-in or booking) — show notification + signal QueueTracker
            es.addEventListener('late-checkin', (e) => {
                let info = {};
                try { info = JSON.parse(e.data); } catch { /* ignore */ }
                if (info.notification) {
                    setNotifications((prev) => [info.notification, ...prev]);
                }
                // Re-use the sage:queue-shift channel so WalkInQueueTracker re-fetches
                window.dispatchEvent(new CustomEvent('sage:queue-shift', { detail: info }));
                retryMs = 1000;
            });

            es.onopen = () => { retryMs = 1000; };

            es.onerror = () => {
                if (es.readyState === EventSource.CLOSED) {
                    es.close();
                    if (!unmounted) {
                        retryTimer = setTimeout(() => {
                            retryMs = Math.min(retryMs * 2, 30_000);
                            connect();
                        }, retryMs);
                    }
                }
            };
        };

        connect();

        return () => {
            unmounted = true;
            clearTimeout(retryTimer);
            es?.close();
        };
        // qc (QueryClient) is a stable reference, so this still runs once on mount.
    }, [qc]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setUserMenuOpen(false);
            }
            const inBtn   = notifRef.current?.contains(event.target);
            const inPanel = notifPanelRef.current?.contains(event.target);
            if (!inBtn && !inPanel) setNotifOpen(false);
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // ── Minute ticker ─────────────────────────────────────────────────────────
    //
    // Re-renders the component every 60 s so all time-derived values
    // (getGreeting, getNextMedication, getNextEvent) are always current.
    //
    // Smart re-fetch: when the ticker fires and any of today's bookings have
    // a startTime that has just become past, we re-fetch from the server.
    // This catches status changes made by the doctor (completed, cancelled)
    // so the card transitions to the next appointment with accurate data.
    //
    // Bug fixed: the previous version's `return () => clearInterval(interval)`
    // was inside the setTimeout callback — the return value of a setTimeout
    // callback is ignored, so the interval was NEVER cleared on unmount,
    // causing a memory leak and state updates on an unmounted component.
    const [, setTick]     = useState(0);
    const bookingsRef     = useRef(bookings);   // keep ref in sync for ticker closure
    const fetchBookingsRef = useRef(fetchBookingsOnly);
    useEffect(() => { bookingsRef.current      = bookings; },       [bookings]);
    useEffect(() => { fetchBookingsRef.current = fetchBookingsOnly; }, [fetchBookingsOnly]);

    useEffect(() => {
        let intervalId = null;

        const tick = () => {
            setTick((t) => t + 1);   // re-render → getNextEvent re-filters in-memory

            // Check if any today-booking just became past → re-fetch for fresh status
            const todayKey = getTodayKey();
            const nowHHMM  = getNowHHMM();
            const hasPastSlotToday = bookingsRef.current.some(
                (b) => slotDateKey(b.slotDetails.date) === todayKey &&
                        (b.slotDetails?.startTime ?? '00:00') <= nowHHMM
            );
            if (hasPastSlotToday) {
                fetchBookingsRef.current();
            }
        };

        // Align first tick to the start of the next calendar minute so the card
        // flips exactly when the clock minute changes (e.g. 14:59 → 15:00).
        const msUntilNextMinute = (60 - new Date().getSeconds()) * 1000;
        const firstTimeout = setTimeout(() => {
            tick();
            intervalId = setInterval(tick, 60_000);
        }, msUntilNextMinute);

        // Cleanup: both the alignment timeout AND the interval must be cleared
        return () => {
            clearTimeout(firstTimeout);
            if (intervalId) clearInterval(intervalId);
        };
    }, []); // stable — uses refs for mutable values
    
    const clearSpecialtyFilter = () => { setSpecialtyFilter(''); };

    const scrollToDoctors = () =>
        document.getElementById('doctors-section')?.scrollIntoView({ behavior: 'smooth' });

    // ── Derived state ─────────────────────────────────────────────────────────

    // Haversine distance in km between two {lat,lon} points
    const haversineKm = (a, b) => {
        const R = 6371;
        const dLat = (b.lat - a.lat) * Math.PI / 180;
        const dLon = (b.lon - a.lon) * Math.PI / 180;
        const s = Math.sin(dLat / 2) ** 2
                + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180)
                * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    };

    const sortedDoctors = useMemo(() => {
        const base = specialtyFilter
            ? doctors.filter((d) => d.specialization?.toLowerCase().includes(specialtyFilter.toLowerCase()))
            : [...doctors];

        if (userCoords) {
            // Sort by real GPS distance; doctors without coordinates go to the end
            return base.sort((a, b) => {
                const aCoords = a.clinicLocation?.lat != null ? { lat: a.clinicLocation.lat, lon: a.clinicLocation.lon } : null;
                const bCoords = b.clinicLocation?.lat != null ? { lat: b.clinicLocation.lat, lon: b.clinicLocation.lon } : null;
                if (!aCoords && !bCoords) return (b.rating ?? 0) - (a.rating ?? 0);
                if (!aCoords) return 1;
                if (!bCoords) return -1;
                return haversineKm(userCoords, aCoords) - haversineKm(userCoords, bCoords);
            });
        }

        // Fallback: same city as patient first, then others — keep rating within each group
        return base.sort((a, b) => {
            const aMatch = a.address?.city === patientCity ? 0 : 1;
            const bMatch = b.address?.city === patientCity ? 0 : 1;
            if (aMatch !== bMatch) return aMatch - bMatch;
            return (b.rating ?? 0) - (a.rating ?? 0);
        });
    }, [doctors, specialtyFilter, userCoords, patientCity]);

    const filteredDoctors = sortedDoctors;

    const medications    = patientData?.medicalInfo?.medications || [];
    const nextMed        = getNextMedication(medications);
    const nextEvent      = getNextEvent(bookings, operations, followUps, walkIns);
    const greeting       = getGreeting();
    const displayName    = patientData?.name || user?.name || 'مريض';
    const unreadCount    = notifications.filter((n) => !n.isRead).length;
    const upcomingCount  = bookings.filter((b) => ['confirmed', 'pending', 'in-progress'].includes(b.status)).length
                         + walkIns.filter((w) => ['waiting', 'in-progress'].includes(w.status)).length;
    const activeMedCount = medications.filter((m) => m.isActive !== false).length;

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0b2d20] via-[#103d2a] to-[#1a4d35] font-['Cairo']">

            {/* ── HEADER ──────────────────────────────────────────────────────── */}
            <header className="bg-[#1a6b4e] border-b border-[#155d44] shadow-md">
                    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10 py-3.5 flex items-center justify-between gap-4">

                    {/* Left: logo */}
                    <div className="flex items-center gap-2.5 group cursor-pointer">
                        <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center shadow-inner group-hover:bg-white/25 transition-all duration-200">
                            <span className="material-symbols-outlined text-white text-[22px] leading-none">
                                clinical_notes
                            </span>
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className="text-[18px] font-black text-white tracking-tighter flex items-center gap-0.5">
                                SAGE
                                <span className="w-1 h-1 bg-emerald-300 rounded-full animate-pulse"></span>
                            </span>
                            <span className="text-[9px] font-bold text-white/50 tracking-[0.2em] uppercase pl-0.5">
                                Health Care
                            </span>
                        </div>
                    </div>

                    {/* Center: Navigation */}
                    <nav className="hidden md:flex items-center gap-1 bg-white/10 rounded-2xl px-2 py-1.5">
                        {[
                            { to: '/dashboard',    icon: 'home',           label: 'الرئيسية'  },
                            { to: '/chat',         icon: 'smart_toy',      label: 'مساعد AI'  },
                            { to: '/appointments', icon: 'calendar_month', label: 'مواعيدي'   },
                            { to: '/doctors',      icon: 'groups',         label: 'الأطباء'   },
                        ].map(({ to, icon, label }) => (
                            <Link
                                key={to}
                                to={to}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                                    location.pathname === to
                                        ? 'bg-white text-[#134e3a] shadow-sm font-bold'
                                        : 'text-white/75 hover:text-white hover:bg-white/15'
                                }`}
                            >
                                <span className="material-symbols-outlined text-[17px]">{icon}</span>
                                {label}
                            </Link>
                        ))}
                    </nav>

                    {/* Right: CTA + Notifications + Avatar */}
                    <div className="flex items-center gap-2.5">
                        <Link
                            to="/doctor-register"
                            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 border-2 border-white/40 text-white font-bold text-xs rounded-xl hover:bg-white hover:text-[#134e3a] transition-all"
                        >
                            <span className="material-symbols-outlined text-[15px]">stethoscope</span>
                            انضم كطبيب
                        </Link>

                    {/* ── Notification bell ─────────────────────────────── */}
                    <div ref={notifRef}>
                        <button
                            onClick={toggleNotif}
                            className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/15 transition-colors"
                            aria-label="الإشعارات"
                        >
                            <span className="material-symbols-outlined text-[22px] text-white/80">notifications</span>
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>
                    </div>

                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                            className="flex items-center gap-3 min-w-0 hover:bg-white/10 p-1 pr-3 rounded-xl transition-all duration-200 active:scale-95 border border-transparent hover:border-white/20"
                        >
                            <div className="relative shrink-0">
                                {user?.profilePicture ? (
                                    <img
                                        src={`${SERVER_BASE}${user.profilePicture}`}
                                        alt="صورة الملف الشخصي"
                                        className="w-10 h-10 rounded-full object-cover shadow-sm ring-2 ring-white/30"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-base shadow-sm ring-2 ring-white/30">
                                        {displayName.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#134e3a] shadow-sm" />
                            </div>

                            <div className="hidden sm:block text-right min-w-0">
                                <p className="text-[11px] text-white/55 font-medium leading-none mb-0.5">
                                    {greeting}،
                                </p>
                                <div className="flex items-center gap-1">
                                    <p className="text-sm font-bold text-white truncate">{displayName}</p>
                                    <span className={`material-symbols-outlined text-white/60 text-[18px] transition-transform duration-300 ${userMenuOpen ? 'rotate-180' : ''}`}>
                                        keyboard_arrow_down
                                    </span>
                                </div>
                            </div>
                        </button>

                        {/* Dropdown — stays white for readability */}
                        {userMenuOpen && (
                            <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-[999] animate-in fade-in zoom-in duration-150 origin-top-right">
                                <div className="px-4 py-2 border-b border-gray-50 mb-1">
                                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">الحساب</p>
                                </div>
                                <Link
                                    to="/profile"
                                    onClick={() => setUserMenuOpen(false)}
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-[#134e3a] transition-colors group"
                                >
                                    <span className="material-symbols-outlined text-[20px] text-gray-400 group-hover:text-emerald-600">person</span>
                                    <span className="font-semibold">الملف الشخصي</span>
                                </Link>
                                <hr className="my-1 border-gray-50" />
                                <button
                                    onClick={() => { setUserMenuOpen(false); signOut(); navigate('/login'); }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors group"
                                >
                                    <span className="material-symbols-outlined text-[20px] text-red-400 group-hover:text-red-600">logout</span>
                                    <span className="font-semibold">تسجيل الخروج</span>
                                </button>
                            </div>
                        )}
                    </div>

                        {/* Mobile hamburger */}
                        <button
                            onClick={() => setMobileMenuOpen((o) => !o)}
                            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 transition-colors"
                            aria-label="Toggle navigation"
                        >
                            <span className="material-symbols-outlined text-[20px] text-white">
                                {mobileMenuOpen ? 'close' : 'menu'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Mobile dropdown */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t border-white/15 px-4 py-3 flex flex-col gap-1 bg-[#134e3a]">
                        {[
                            { to: '/dashboard',       icon: 'home',           label: 'الرئيسية'   },
                            { to: '/chat',            icon: 'smart_toy',      label: 'مساعد AI'   },
                            { to: '/appointments',    icon: 'calendar_month', label: 'مواعيدي'    },
                            { to: '/doctors',         icon: 'groups',         label: 'الأطباء'    },
                            { to: '/doctor-register', icon: 'stethoscope',    label: 'انضم كطبيب' },
                        ].map(({ to, icon, label }) => (
                            <Link
                                key={to}
                                to={to}
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-white/80 hover:bg-white/10 hover:text-white font-semibold text-sm transition-colors"
                            >
                                <span className="material-symbols-outlined text-[18px]">{icon}</span>
                                {label}
                            </Link>
                        ))}
                        <button
                            onClick={() => { signOut(); navigate('/login'); }}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-300 hover:bg-white/10 font-semibold text-sm transition-colors mt-1 border-t border-white/15 pt-3"
                        >
                            <span className="material-symbols-outlined text-[18px]">logout</span>
                            تسجيل الخروج
                        </button>
                    </div>
                )}
            </header>

            {/* ── HERO ──────────────────────────────────────────────────────── */}
            <HeroSection
                displayName={displayName}
                greeting={greeting}
                nextEvent={nextEvent}
                upcomingCount={upcomingCount}
                activeMedCount={activeMedCount}
                navigate={navigate}
                scrollToDoctors={scrollToDoctors}
            />

            {/* Notification panel — portal to body so it escapes the header's stacking context */}
            {notifOpen && createPortal(
                <div
                    ref={notifPanelRef}
                    style={{ position: 'fixed', top: notifPos.top, right: notifPos.right, zIndex: 9999 }}
                    className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
                    dir="rtl"
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <p className="font-black text-[#134e3a] text-sm">الإشعارات</p>
                            {unreadCount > 0 && (
                                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount} جديد</span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button onClick={markAllAsRead} className="text-xs text-emerald-600 font-bold hover:text-emerald-800 transition-colors">
                                تعليم الكل كمقروء
                            </button>
                        )}
                    </div>
                    <div className="max-h-[360px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-emerald-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-emerald-400 [scrollbar-width:thin] [scrollbar-color:rgba(167,243,208,0.8)_transparent]">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                                <span className="material-symbols-outlined text-[40px] mb-2">notifications_off</span>
                                <p className="text-sm font-medium">لا توجد إشعارات</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {notifications.map((n) => {
                                    const cfg = NOTIF_ICON[n.type] || NOTIF_ICON.system;
                                    return (
                                        <div
                                            key={n._id}
                                            onClick={() => !n.isRead && markOneRead(n._id)}
                                            className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50 cursor-pointer ${!n.isRead ? 'bg-emerald-50/60' : ''}`}
                                        >
                                            <div className={`w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                                                <span className={`material-symbols-outlined text-[16px] ${cfg.color}`}>{cfg.icon}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-[#191c1c] leading-snug">{n.title}</p>
                                                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                                                <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                                            </div>
                                            <div className="flex flex-col items-center gap-2 shrink-0">
                                                {!n.isRead && <span className="w-2 h-2 bg-emerald-500 rounded-full mt-1" />}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); deleteNotif(n._id); }}
                                                    className="text-gray-300 hover:text-red-400 transition-colors"
                                                    aria-label="حذف"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* ── MAIN ────────────────────────────────────────────────────────── */}
            <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10 pt-8 pb-10 space-y-6 xl:space-y-8">

                {/* Error banner */}
                {profileError && (
                    <div className="bg-red-900/30 border border-red-500/30 rounded-2xl px-5 py-4 flex items-center gap-3">
                        <span className="material-symbols-outlined text-red-400 shrink-0">error</span>
                        <p className="text-red-300 font-medium text-sm flex-1">{profileError}</p>
                        <button onClick={refetchAll} className="text-red-400 font-bold text-sm hover:underline shrink-0">
                            إعادة المحاولة
                        </button>
                    </div>
                )}

                {/* ── REMINDERS BAR — mobile/tablet only; desktop uses side panel ── */}
                <section aria-label="Today's reminders" className="xl:hidden">
                    <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">
                        تذكيرات اليوم
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                        {/* Medicine Card */}
                        {loadingProfile ? (
                            <div className="bg-white/[.07] rounded-2xl border border-white/[.1] p-5">
                                <ReminderSkeleton />
                            </div>
                        ) : nextMed ? (
                            /* ── HAS next dose: gradient card matching AppointmentReminder ── */
                            <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-xl" dir="rtl">
                                <div className="flex items-start gap-3 mb-4">
                                    <span className="text-2xl">💊</span>
                                    <div>
                                        <h3 className="font-black text-base leading-tight">دواءك القادم</h3>
                                        <p className="text-white/70 text-xs mt-0.5">
                                            {nextMed.name}{nextMed.dosage ? ` — ${nextMed.dosage}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="bg-white/15 rounded-xl p-3 text-center mb-4">
                                    <p className="text-3xl font-black tracking-wide">{fmtTime(nextMed.nextDose)}</p>
                                    <p className="text-white/70 text-xs mt-1">موعد الجرعة القادمة</p>
                                </div>
                                <div className="flex items-start gap-2 bg-white/10 rounded-xl p-3">
                                    <span className="text-lg mt-0.5">🔔</span>
                                    <p className="text-sm text-white/90 leading-relaxed">
                                        سيُرسل لك إشعار قبل موعد جرعتك تلقائياً.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            /* ── NO medicine today: plain glass card ── */
                            <div className="bg-white/[.07] rounded-2xl border border-white/[.1] p-5 hover:bg-white/[.1] hover:-translate-y-0.5 hover:border-white/[.18] transition-all duration-200">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-900/50 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-emerald-400 text-[22px]">medication</span>
                                    </div>
                                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-900/40 px-2.5 py-1 rounded-lg">الدواء</span>
                                </div>
                                <p className="font-semibold text-white/70">لا توجد أدوية</p>
                                <p className="text-white/40 text-xs mt-1">لا جرعات لهذا اليوم</p>
                            </div>
                        )}

                        {/* Appointment / Operation Card */}
                        {loadingProfile ? (
                            <div className="bg-white/[.07] rounded-2xl border border-white/[.1] p-5">
                                <ReminderSkeleton />
                            </div>
                        ) : nextEvent && nextEvent._type === 'walkin' && isToday(nextEvent.date) ? (
                            <div className="col-span-1 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 shadow-lg text-white transition-all duration-200 hover:-translate-y-1 hover:shadow-xl" dir="rtl">
                                {/* Header */}
                                <div className="flex items-start gap-3 mb-4">
                                    <span className="text-2xl">🚶</span>
                                    <div>
                                        <h3 className="font-black text-base leading-tight">
                                            {nextEvent.raw.status === 'in-progress' ? 'زيارتك الآن' : 'زيارتك اليوم'}
                                        </h3>
                                        {nextEvent.label && (
                                            <p className="text-white/70 text-xs mt-0.5">{nextEvent.label}</p>
                                        )}
                                    </div>
                                </div>
                                {/* Time block — arrival + expected */}
                                <div className="bg-white/15 rounded-xl p-3 mb-4">
                                    <div className="grid grid-cols-2 gap-3 text-center">
                                        <div>
                                            <p className="text-2xl font-black tracking-wide leading-none">
                                                {fmtTime(nextEvent.time) || '—'}
                                            </p>
                                            <p className="text-white/65 text-[11px] mt-1">وقت الوصول</p>
                                        </div>
                                        <div className="border-r border-white/20">
                                            <p className="text-2xl font-black tracking-wide leading-none">
                                                {walkInEta ? fmtTime(walkInEta) : '—'}
                                            </p>
                                            <p className="text-white/65 text-[11px] mt-1">
                                                {nextEvent.raw.status === 'in-progress' ? 'بدأ الكشف' : 'الوقت المتوقع'}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-white/60 text-[10px] text-center mt-2.5 pt-2 border-t border-white/15">
                                        {nextEvent.raw.status === 'in-progress' ? '🟢 جارٍ الكشف الآن' : '⏳ في قائمة الانتظار'}
                                    </p>
                                </div>
                                {/* Notification */}
                                <div className="flex items-start gap-2 bg-white/10 rounded-xl p-3">
                                    <span className="text-lg mt-0.5">🔔</span>
                                    <p className="text-sm text-white/90 leading-relaxed">
                                        {nextEvent.raw.status === 'in-progress'
                                            ? 'الطبيب يكشف عليك الآن، تفضّل للداخل.'
                                            : 'ستُعلَم عند قرب دورك تلقائياً.'}
                                    </p>
                                </div>
                            </div>
                        ) : nextEvent && nextEvent._type === 'walkin' ? (
                            <div className="col-span-1 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 shadow-lg text-white transition-all duration-200 hover:-translate-y-1 hover:shadow-xl" dir="rtl">
                                <div className="flex items-start gap-3 mb-4">
                                    <span className="text-2xl">🚶</span>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-base leading-tight">زيارتك القادمة</h3>
                                        <p className="text-white/70 text-xs mt-0.5">{nextEvent.label}</p>
                                    </div>
                                    <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-lg shrink-0">
                                        {formatDate(nextEvent.date)}
                                    </span>
                                </div>
                                {nextEvent.sublabel && (
                                    <p className="text-white/60 text-xs mb-3">{nextEvent.sublabel}</p>
                                )}
                                <div className="bg-white/15 rounded-xl p-3 mb-4">
                                    <div className="grid grid-cols-2 gap-3 text-center">
                                        <div>
                                            <p className="text-base font-black leading-tight">{formatDate(nextEvent.date)}</p>
                                            <p className="text-white/65 text-[11px] mt-1">التاريخ</p>
                                        </div>
                                        <div className="border-r border-white/20">
                                            <p className="text-3xl font-black tracking-wide leading-none">
                                                {fmtTime(nextEvent.time) || '—'}
                                            </p>
                                            <p className="text-white/65 text-[11px] mt-1">الوقت</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2 bg-white/10 rounded-xl p-3">
                                    <span className="text-lg mt-0.5">🔔</span>
                                    <p className="text-sm text-white/90 leading-relaxed">سيُرسل لك تذكير قبل زيارتك تلقائياً.</p>
                                </div>
                            </div>
                        ) : nextEvent && nextEvent._type === 'booking' ? (
                            <div className="col-span-1 bg-gradient-to-br from-blue-600 to-violet-600 rounded-2xl p-5 shadow-lg text-white transition-all duration-200 hover:-translate-y-1 hover:shadow-xl" dir="rtl">
                                <div className="flex items-start gap-3 mb-4">
                                    <span className="text-2xl">
                                        {nextEvent.raw?.status === 'in-progress' ? '🩺' : '📅'}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-base leading-tight">
                                            {nextEvent.raw?.status === 'in-progress' ? 'كشفك الآن' : 'موعدك القادم'}
                                        </h3>
                                        <p className="text-white/70 text-xs mt-0.5">{nextEvent.label}</p>
                                    </div>
                                    {nextEvent.raw?.status === 'in-progress' ? (
                                        <span className="flex items-center gap-1 text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-lg shrink-0">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse"/>
                                            جارٍ الآن
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-lg shrink-0">
                                            {isToday(nextEvent.date) ? 'اليوم' : formatDate(nextEvent.date)}
                                        </span>
                                    )}
                                </div>
                                {nextEvent.sublabel && (
                                    <p className="text-white/60 text-xs mb-3">{nextEvent.sublabel}</p>
                                )}
                                <div className="bg-white/15 rounded-xl p-3 mb-4">
                                    {(isToday(nextEvent.date) || nextEvent.raw?.status === 'in-progress') ? (
                                        <div className="grid grid-cols-2 gap-3 text-center">
                                            <div>
                                                <p className="text-3xl font-black tracking-wide leading-none">
                                                    {fmtTime(nextEvent.time) || '—'}
                                                </p>
                                                <p className="text-white/65 text-[11px] mt-1">وقت الحجز</p>
                                            </div>
                                            <div className="border-r border-white/20">
                                                <p className="text-3xl font-black tracking-wide leading-none">
                                                    {fmtTime(bookingEta) || '—'}
                                                </p>
                                                <p className="text-white/65 text-[11px] mt-1">
                                                    {nextEvent.raw?.status === 'in-progress' ? 'بدأ الكشف' : 'الوقت المتوقع'}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3 text-center">
                                            <div>
                                                <p className="text-base font-black leading-tight">
                                                    {formatDate(nextEvent.date)}
                                                </p>
                                                <p className="text-white/65 text-[11px] mt-1">التاريخ</p>
                                            </div>
                                            <div className="border-r border-white/20">
                                                <p className="text-3xl font-black tracking-wide leading-none">
                                                    {fmtTime(nextEvent.time) || '—'}
                                                </p>
                                                <p className="text-white/65 text-[11px] mt-1">الوقت</p>
                                            </div>
                                        </div>
                                    )}
                                    {nextEvent.raw?.status === 'in-progress' && (
                                        <p className="text-white/70 text-[10px] text-center mt-2 pt-2 border-t border-white/15">
                                            🟢 الطبيب يكشف عليك الآن
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-start gap-2 bg-white/10 rounded-xl p-3">
                                    <span className="text-lg mt-0.5">
                                        {nextEvent.raw?.status === 'in-progress' ? '✅' : '🔔'}
                                    </span>
                                    <p className="text-sm text-white/90 leading-relaxed">
                                        {nextEvent.raw?.status === 'in-progress'
                                            ? 'الطبيب يكشف عليك الآن، تفضّل للداخل.'
                                            : 'سيُرسل لك تذكير قبل موعدك تلقائياً.'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white/[.07] rounded-2xl border border-white/[.1] p-5 hover:bg-white/[.1] hover:-translate-y-0.5 hover:border-white/[.18] transition-all duration-200">
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                        nextEvent?._type === 'operation' ? 'bg-purple-900/50'
                                        : nextEvent?._type === 'followup' ? 'bg-teal-900/50'
                                        : 'bg-blue-900/50'
                                    }`}>
                                        <span className={`material-symbols-outlined text-[22px] ${
                                            nextEvent?._type === 'operation' ? 'text-purple-400'
                                            : nextEvent?._type === 'followup' ? 'text-teal-400'
                                            : 'text-blue-400'
                                        }`}>
                                            {nextEvent?._type === 'operation' ? 'surgical' : nextEvent?._type === 'followup' ? 'autorenew' : 'calendar_month'}
                                        </span>
                                    </div>
                                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                                        nextEvent?._type === 'operation' ? 'text-purple-400 bg-purple-900/40'
                                        : nextEvent?._type === 'followup' ? 'text-teal-400 bg-teal-900/40'
                                        : 'text-blue-400 bg-blue-900/40'
                                    }`}>
                                        {nextEvent?._type === 'operation' ? 'عملية' : nextEvent?._type === 'followup' ? 'إعادة كشف' : 'موعد'}
                                    </span>
                                </div>
                                {nextEvent ? (
                                    <>
                                        <p className="font-bold text-white text-base leading-tight">{nextEvent.label}</p>
                                        <p className="text-white/50 text-sm mt-0.5">{nextEvent.sublabel}</p>
                                        <div className={`mt-3 flex items-center gap-1.5 text-sm font-semibold rounded-xl px-3 py-1.5 ${
                                            nextEvent._type === 'operation' ? 'text-purple-400 bg-purple-900/30'
                                            : nextEvent._type === 'followup' ? 'text-teal-400 bg-teal-900/30'
                                            : 'text-blue-400 bg-blue-900/30'
                                        }`}>
                                            <span className="material-symbols-outlined text-[15px]">event</span>
                                            {formatDate(nextEvent.date)} · {fmtTime(nextEvent.time)}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p className="font-semibold text-white/70">لا توجد مواعيد قادمة</p>
                                        <p className="text-white/40 text-xs mt-1">احجز موعداً من الأسفل</p>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Water Tracker */}
                        <div className="bg-white/[.07] rounded-2xl border border-white/[.1] p-5 hover:bg-white/[.1] hover:-translate-y-0.5 hover:border-white/[.18] transition-all duration-200">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-xl bg-sky-900/50 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-sky-400 text-[22px]">water_drop</span>
                                </div>
                                <span className="text-[11px] font-bold text-sky-400 bg-sky-900/40 px-2.5 py-1 rounded-lg">
                                    الترطيب
                                </span>
                            </div>
                            <p className="font-bold text-white text-base">الماء اليومي</p>
                            <p className="text-white/40 text-xs mt-0.5 mb-3">الهدف: 8 كوب / يوم</p>
                            <div className="flex items-center gap-1 mb-2.5">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <button key={i} onClick={() => setWaterGlasses(i < waterGlasses ? i : i + 1)}
                                        className={`flex-1 h-5 rounded-md transition-all duration-150 ${
                                            i < waterGlasses ? 'bg-sky-400 hover:bg-sky-300' : 'bg-white/[.12] hover:bg-white/20'
                                        }`}
                                    />
                                ))}
                            </div>
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-white/60">
                                    <span className="font-black text-sky-400 text-base">{waterGlasses}</span> / 8 كوب
                                </p>
                                <div className="flex gap-1">
                                    <button onClick={() => setWaterGlasses((g) => Math.max(0, g - 1))}
                                        className="w-7 h-7 rounded-lg bg-white/[.1] hover:bg-white/20 text-white/70 font-bold flex items-center justify-center transition-colors">−</button>
                                    <button onClick={() => setWaterGlasses((g) => Math.min(8, g + 1))}
                                        className="w-7 h-7 rounded-lg bg-sky-900/50 hover:bg-sky-800/60 text-sky-400 font-bold flex items-center justify-center transition-colors">+</button>
                                </div>
                            </div>
                            {waterGlasses >= 8 && (
                                <p className="mt-2.5 text-center text-xs font-bold text-sky-400 bg-sky-900/30 rounded-xl py-1.5">
                                    تم تحقيق هدف اليوم! 🎉
                                </p>
                            )}
                        </div>
                    </div>
                </section>

                {/* ── AI CHAT + HEALTH SIDEBAR ──────────────────────────────────── */}
                <section aria-label="AI symptom assistant">
                    {/*
                     * Desktop (xl+): 2-column grid — AI chat on the left, sticky
                     * health reminders sidebar on the right.
                     * Mobile/tablet: single column, reminders shown in section above.
                     */}
                    <div className="xl:grid xl:grid-cols-[1fr_352px] xl:gap-6">

                        {/* ── Left column: AI Chat ─────────────────────────────────── */}
                        <div className="flex flex-col">
                            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">
                                مساعد SAGE الصحي
                            </p>
                            <div
                                className="bg-white/[.06] rounded-3xl border border-white/[.1] overflow-hidden flex flex-col h-[635px]"
                            >
                                {/* Card header */}
                                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[.08] shrink-0">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#134e3a] to-[#2d6a4f] flex items-center justify-center shadow-sm">
                                            <span className="material-symbols-outlined text-white text-[17px]">smart_toy</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-sm leading-none">SAGE AI Assistant</p>
                                            <p className="text-[11px] text-white/45 mt-0.5">تحليل الأعراض · إيجاد الأطباء</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            <span className="text-[11px] text-gray-500 font-medium">متصل</span>
                                        </div>
                                        <button
                                            onClick={() => navigate('/chat')}
                                            title="Open full chat page"
                                            className="ml-1 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#134e3a] hover:bg-emerald-50 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[17px]">open_in_full</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 min-h-0">
                                    <AIConsentGate>
                                        <SageAIChat userName={displayName} />
                                    </AIConsentGate>
                                </div>
                            </div>
                        </div>

                        {/* ── Right column: Health Sidebar (xl+ only) ──────────────── */}
                        <div className="hidden xl:flex flex-col gap-3 xl:self-start xl:sticky xl:top-6">
                            <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-0.5">
                                تذكيرات اليوم
                            </p>

                            {/* Medicine Card — compact */}
                            {loadingProfile ? (
                                <div className="bg-white/[.07] rounded-2xl border border-white/[.1] p-4">
                                    <ReminderSkeleton />
                                </div>
                            ) : nextMed ? (
                                /* ── HAS next dose: gradient card ── */
                                <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-4 shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-xl" dir="rtl">
                                    <div className="flex items-start gap-2.5 mb-3">
                                        <span className="text-xl">💊</span>
                                        <div>
                                            <h3 className="font-black text-sm leading-tight">دواءك القادم</h3>
                                            <p className="text-white/70 text-xs mt-0.5">
                                                {nextMed.name}{nextMed.dosage ? ` — ${nextMed.dosage}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="bg-white/15 rounded-xl p-2.5 text-center mb-3">
                                        <p className="text-2xl font-black tracking-wide">{fmtTime(nextMed.nextDose)}</p>
                                        <p className="text-white/70 text-[10px] mt-0.5">موعد الجرعة القادمة</p>
                                    </div>
                                    <div className="flex items-start gap-2 bg-white/10 rounded-xl p-2.5">
                                        <span className="text-base mt-0.5">🔔</span>
                                        <p className="text-xs text-white/90 leading-relaxed">
                                            سيُرسل لك إشعار قبل موعد جرعتك تلقائياً.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                /* ── NO medicine today: plain glass card ── */
                                <div className="bg-white/[.07] rounded-2xl border border-white/[.1] p-4 hover:bg-white/[.1] hover:-translate-y-0.5 hover:border-white/[.18] transition-all duration-200">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="w-9 h-9 rounded-xl bg-emerald-900/50 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-emerald-400 text-[20px]">medication</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/40 px-2 py-0.5 rounded-lg">الدواء</span>
                                    </div>
                                    <p className="font-semibold text-white/70 text-sm">لا توجد أدوية</p>
                                    <p className="text-white/40 text-xs mt-0.5">لا جرعات لهذا اليوم</p>
                                </div>
                            )}

                            {/* Appointment / Event Card — compact */}
                            {loadingProfile ? (
                                <div className="bg-white/[.07] rounded-2xl border border-white/[.1] p-4">
                                    <ReminderSkeleton />
                                </div>
                            ) : nextEvent && nextEvent._type === 'walkin' && isToday(nextEvent.date) ? (
                                <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-4 shadow-lg text-white transition-all duration-200 hover:-translate-y-1 hover:shadow-xl" dir="rtl">
                                    {/* Header */}
                                    <div className="flex items-start gap-2.5 mb-3">
                                        <span className="text-xl">🚶</span>
                                        <div>
                                            <h3 className="font-black text-sm leading-tight">
                                                {nextEvent.raw.status === 'in-progress' ? 'زيارتك الآن' : 'زيارتك اليوم'}
                                            </h3>
                                            {nextEvent.label && (
                                                <p className="text-white/70 text-xs mt-0.5">{nextEvent.label}</p>
                                            )}
                                        </div>
                                    </div>
                                    {/* Time block - 2 columns */}
                                    <div className="bg-white/15 rounded-xl p-2.5 mb-3">
                                        <div className="grid grid-cols-2 gap-3 text-center">
                                            <div>
                                                <p className="text-2xl font-black tracking-wide leading-none">
                                                    {fmtTime(nextEvent.time) || '—'}
                                                </p>
                                                <p className="text-white/65 text-[10px] mt-1">وقت الوصول</p>
                                            </div>
                                            <div className="border-r border-white/20">
                                                <p className="text-2xl font-black tracking-wide leading-none">
                                                    {walkInEta ? fmtTime(walkInEta) : '—'}
                                                </p>
                                                <p className="text-white/65 text-[10px] mt-1">
                                                    {nextEvent.raw.status === 'in-progress' ? 'بدأ الكشف' : 'الوقت المتوقع'}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-white/60 text-[10px] text-center mt-2 pt-1.5 border-t border-white/15">
                                            {nextEvent.raw.status === 'in-progress' ? '🟢 جارٍ الكشف الآن' : '⏳ في قائمة الانتظار'}
                                        </p>
                                    </div>
                                    {/* Notification */}
                                    <div className="flex items-start gap-2 bg-white/10 rounded-xl p-2.5">
                                        <span className="text-base mt-0.5">🔔</span>
                                        <p className="text-xs text-white/90 leading-relaxed">
                                            {nextEvent.raw.status === 'in-progress'
                                                ? 'الطبيب يكشف عليك الآن، تفضّل للداخل.'
                                                : 'ستُعلَم عند قرب دورك تلقائياً.'}
                                        </p>
                                    </div>
                                </div>
                            ) : nextEvent && nextEvent._type === 'walkin' ? (
                                <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-4 shadow-lg text-white transition-all duration-200 hover:-translate-y-1 hover:shadow-xl" dir="rtl">
                                    <div className="flex items-start gap-2.5 mb-3">
                                        <span className="text-xl">🚶</span>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-black text-sm leading-tight">زيارتك القادمة</h3>
                                            <p className="text-white/70 text-xs mt-0.5">{nextEvent.label}</p>
                                        </div>
                                        <span className="text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded-md shrink-0">
                                            {formatDate(nextEvent.date)}
                                        </span>
                                    </div>
                                    {nextEvent.sublabel && (
                                        <p className="text-white/60 text-[10px] mb-2.5">{nextEvent.sublabel}</p>
                                    )}
                                    <div className="bg-white/15 rounded-xl p-2.5 mb-3">
                                        <div className="grid grid-cols-2 gap-3 text-center">
                                            <div>
                                                <p className="text-sm font-black leading-tight">{formatDate(nextEvent.date)}</p>
                                                <p className="text-white/65 text-[10px] mt-1">التاريخ</p>
                                            </div>
                                            <div className="border-r border-white/20">
                                                <p className="text-2xl font-black tracking-wide leading-none">
                                                    {fmtTime(nextEvent.time) || '—'}
                                                </p>
                                                <p className="text-white/65 text-[10px] mt-1">الوقت</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2 bg-white/10 rounded-xl p-2.5">
                                        <span className="text-base mt-0.5">🔔</span>
                                        <p className="text-xs text-white/90 leading-relaxed">سيُرسل لك تذكير قبل زيارتك تلقائياً.</p>
                                    </div>
                                </div>
                            ) : nextEvent && nextEvent._type === 'booking' ? (
                                <div className="bg-gradient-to-br from-blue-600 to-violet-600 rounded-2xl p-4 shadow-lg text-white transition-all duration-200 hover:-translate-y-1 hover:shadow-xl" dir="rtl">
                                    <div className="flex items-start gap-2.5 mb-3">
                                        <span className="text-xl">
                                            {nextEvent.raw?.status === 'in-progress' ? '🩺' : '📅'}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-black text-sm leading-tight">
                                                {nextEvent.raw?.status === 'in-progress' ? 'كشفك الآن' : 'موعدك القادم'}
                                            </h3>
                                            <p className="text-white/70 text-xs mt-0.5">{nextEvent.label}</p>
                                        </div>
                                        {nextEvent.raw?.status === 'in-progress' ? (
                                            <span className="flex items-center gap-1 text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded-md shrink-0">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse"/>
                                                جارٍ
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded-md shrink-0">
                                                {isToday(nextEvent.date) ? 'اليوم' : formatDate(nextEvent.date)}
                                            </span>
                                        )}
                                    </div>
                                    {nextEvent.sublabel && (
                                        <p className="text-white/60 text-[10px] mb-2.5">{nextEvent.sublabel}</p>
                                    )}
                                    <div className="bg-white/15 rounded-xl p-2.5 mb-3">
                                        {(isToday(nextEvent.date) || nextEvent.raw?.status === 'in-progress') ? (
                                            <div className="grid grid-cols-2 gap-3 text-center">
                                                <div>
                                                    <p className="text-2xl font-black tracking-wide leading-none">
                                                        {fmtTime(nextEvent.time) || '—'}
                                                    </p>
                                                    <p className="text-white/65 text-[10px] mt-1">وقت الحجز</p>
                                                </div>
                                                <div className="border-r border-white/20">
                                                    <p className="text-2xl font-black tracking-wide leading-none">
                                                        {fmtTime(bookingEta) || '—'}
                                                    </p>
                                                    <p className="text-white/65 text-[10px] mt-1">
                                                        {nextEvent.raw?.status === 'in-progress' ? 'بدأ الكشف' : 'الوقت المتوقع'}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-3 text-center">
                                                <div>
                                                    <p className="text-sm font-black leading-tight">
                                                        {formatDate(nextEvent.date)}
                                                    </p>
                                                    <p className="text-white/65 text-[10px] mt-1">التاريخ</p>
                                                </div>
                                                <div className="border-r border-white/20">
                                                    <p className="text-2xl font-black tracking-wide leading-none">
                                                        {fmtTime(nextEvent.time) || '—'}
                                                    </p>
                                                    <p className="text-white/65 text-[10px] mt-1">الوقت</p>
                                                </div>
                                            </div>
                                        )}
                                        {nextEvent.raw?.status === 'in-progress' && (
                                            <p className="text-white/70 text-[10px] text-center mt-2 pt-1.5 border-t border-white/15">
                                                🟢 الطبيب يكشف عليك الآن
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-start gap-2 bg-white/10 rounded-xl p-2.5">
                                        <span className="text-base mt-0.5">
                                            {nextEvent.raw?.status === 'in-progress' ? '✅' : '🔔'}
                                        </span>
                                        <p className="text-xs text-white/90 leading-relaxed">
                                            {nextEvent.raw?.status === 'in-progress'
                                                ? 'الطبيب يكشف عليك الآن، تفضّل للداخل.'
                                                : 'سيُرسل لك تذكير قبل موعدك تلقائياً.'}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white/[.07] rounded-2xl border border-white/[.1] p-4 hover:bg-white/[.1] hover:-translate-y-0.5 hover:border-white/[.18] transition-all duration-200">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                            nextEvent?._type === 'operation' ? 'bg-purple-900/50'
                                            : nextEvent?._type === 'followup' ? 'bg-teal-900/50'
                                            : 'bg-blue-900/50'
                                        }`}>
                                            <span className={`material-symbols-outlined text-[20px] ${
                                                nextEvent?._type === 'operation' ? 'text-purple-400'
                                                : nextEvent?._type === 'followup' ? 'text-teal-400'
                                                : 'text-blue-400'
                                            }`}>
                                                {nextEvent?._type === 'operation' ? 'surgical' : nextEvent?._type === 'followup' ? 'autorenew' : 'calendar_month'}
                                            </span>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                                            nextEvent?._type === 'operation' ? 'text-purple-400 bg-purple-900/40'
                                            : nextEvent?._type === 'followup' ? 'text-teal-400 bg-teal-900/40'
                                            : 'text-blue-400 bg-blue-900/40'
                                        }`}>
                                            {nextEvent?._type === 'operation' ? 'عملية' : nextEvent?._type === 'followup' ? 'إعادة كشف' : 'موعد'}
                                        </span>
                                    </div>
                                    {nextEvent ? (
                                        <>
                                            <p className="font-bold text-white text-sm leading-tight">{nextEvent.label}</p>
                                            <p className="text-white/50 text-xs mt-0.5">{nextEvent.sublabel}</p>
                                            <div className={`mt-2 flex items-center gap-1.5 text-xs font-semibold rounded-xl px-2.5 py-1.5 ${
                                                nextEvent._type === 'operation' ? 'text-purple-400 bg-purple-900/30'
                                                : nextEvent._type === 'followup' ? 'text-teal-400 bg-teal-900/30'
                                                : 'text-blue-400 bg-blue-900/30'
                                            }`}>
                                                <span className="material-symbols-outlined text-[13px]">event</span>
                                                {formatDate(nextEvent.date)} · {fmtTime(nextEvent.time)}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <p className="font-semibold text-white/70 text-sm">لا توجد مواعيد قادمة</p>
                                            <p className="text-white/40 text-xs mt-0.5">احجز موعداً من الأسفل</p>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Water Tracker — compact & interactive */}
                            <div className="bg-white/[.07] rounded-2xl border border-white/[.1] p-4 hover:bg-white/[.1] hover:-translate-y-0.5 hover:border-white/[.18] transition-all duration-200">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="w-9 h-9 rounded-xl bg-sky-900/50 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-sky-400 text-[20px]">water_drop</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-sky-400 bg-sky-900/40 px-2 py-0.5 rounded-lg">الترطيب</span>
                                </div>
                                <p className="font-bold text-white text-sm">الماء اليومي</p>
                                <p className="text-white/40 text-xs mt-0.5 mb-2">الهدف: 8 كوب / يوم</p>
                                <div className="flex items-center gap-0.5 mb-2">
                                    {Array.from({ length: 8 }).map((_, i) => (
                                        <button key={i} onClick={() => setWaterGlasses(i < waterGlasses ? i : i + 1)}
                                            className={`flex-1 h-4 rounded-sm transition-all duration-150 ${
                                                i < waterGlasses ? 'bg-sky-400 hover:bg-sky-300' : 'bg-white/[.12] hover:bg-white/20'
                                            }`}
                                        />
                                    ))}
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-white/60">
                                        <span className="font-black text-sky-400">{waterGlasses}</span> / 8 كوب
                                    </p>
                                    <div className="flex gap-1">
                                        <button onClick={() => setWaterGlasses((g) => Math.max(0, g - 1))}
                                            className="w-6 h-6 rounded-md bg-white/[.1] hover:bg-white/20 text-white/70 font-bold flex items-center justify-center text-xs transition-colors">−</button>
                                        <button onClick={() => setWaterGlasses((g) => Math.min(8, g + 1))}
                                            className="w-6 h-6 rounded-md bg-sky-900/50 hover:bg-sky-800/60 text-sky-400 font-bold flex items-center justify-center text-xs transition-colors">+</button>
                                    </div>
                                </div>
                                {waterGlasses >= 8 && (
                                    <p className="mt-2 text-center text-xs font-bold text-sky-400 bg-sky-900/30 rounded-xl py-1">
                                        تم تحقيق هدف اليوم! 🎉
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── DOCTORS GRID ──────────────────────────────────────────────── */}
                <section id="doctors-section" aria-label="Doctors directory">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                        <div>
                            <h2 className="text-xl font-black text-white">
                                {specialtyFilter ? `متخصصو ${specialtyFilter}` : 'دكاترة مقترحون'}
                            </h2>
                            <p className="text-white/40 text-xs mt-0.5 font-medium">
                                {loadingDoctors ? 'جارٍ التحميل...' : `${filteredDoctors.length} طبيب متاح`}
                            </p>
                        </div>

                        <div>
                            <button
                                onClick={() => navigate('/doctors')}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[.08] border border-white/[.12] text-white/80 hover:bg-white/[.14] hover:text-white font-semibold text-sm transition-all active:scale-95"
                            >
                                <span className="material-symbols-outlined text-[17px]">groups</span>
                                عرض كل الأطباء
                            </button>
                        </div>
                    </div>

                    {loadingDoctors ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <SkeletonCard key={i} />
                            ))}
                        </div>
                    ) : filteredDoctors.length === 0 ? (
                        <div className="text-center py-20 bg-white/[.05] rounded-3xl border border-white/[.08]">
                            <span className="material-symbols-outlined text-[56px] text-white/20">person_search</span>
                            <p className="text-white/60 font-bold mt-3 text-lg">لا يوجد دكاترة</p>
                            <p className="text-white/35 text-sm mt-1">
                                {specialtyFilter ? `لا يوجد متخصصون في ${specialtyFilter} حالياً` : 'لا يوجد دكاترة معتمدون بعد'}
                            </p>
                            {specialtyFilter && (
                                <button onClick={clearSpecialtyFilter}
                                    className="mt-5 inline-flex items-center gap-1.5 text-emerald-400 font-bold text-sm hover:underline">
                                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                    عرض كل الدكاترة
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                            {filteredDoctors.map((doctor) => (
                                <DoctorCard key={doctor._id} doctor={doctor} navigate={navigate} />
                            ))}
                        </div>
                    )}
                </section>
            </main>

            <Footer />
        </div>
    );
}

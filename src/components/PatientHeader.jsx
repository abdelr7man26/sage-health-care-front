import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../api/axiosInstance';
import { NOTIF_ICON, timeAgo } from '../utils/notifHelpers';

const SERVER_BASE = new URL(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').origin;

const NAV_ITEMS = [
    { to: '/dashboard',    icon: 'home',           label: 'الرئيسية' },
    { to: '/chat',         icon: 'smart_toy',      label: 'مساعد AI' },
    { to: '/appointments', icon: 'calendar_month', label: 'مواعيدي'  },
    { to: '/doctors',      icon: 'groups',         label: 'الأطباء'  },
];

export default function PatientHeader() {
    const { user, signOut } = useAuth();
    const navigate  = useNavigate();
    const location  = useLocation();

    const [notifications, setNotifications] = useState([]);
    const [notifOpen,     setNotifOpen]     = useState(false);
    const [notifPos,      setNotifPos]      = useState({ top: 0, right: 0 });
    const [userMenuOpen,  setUserMenuOpen]  = useState(false);
    const [mobileMenuOpen,setMobileMenuOpen]= useState(false);

    const notifRef      = useRef(null);
    const notifPanelRef = useRef(null);
    const menuRef       = useRef(null);

    const displayName  = user?.name || 'مريض';
    const unreadCount  = notifications.filter((n) => !n.isRead).length;

    // ── Notifications ────────────────────────────────────────────────────────
    const fetchNotifications = useCallback(async () => {
        try {
            const { data } = await axiosInstance.get('/patients/notifications');
            setNotifications(data.data || []);
        } catch { /* silent */ }
    }, []);

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    const markOneRead = useCallback(async (id) => {
        try {
            await axiosInstance.put(`/patients/notifications/${id}/read`);
            setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n));
        } catch { /* silent */ }
    }, []);

    const markAllAsRead = useCallback(async () => {
        try {
            await axiosInstance.put('/patients/notifications/read-all');
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        } catch { /* silent */ }
    }, []);

    const deleteNotif = useCallback(async (id) => {
        try {
            await axiosInstance.delete(`/patients/notifications/${id}`);
            setNotifications((prev) => prev.filter((n) => n._id !== id));
        } catch { /* silent */ }
    }, []);

    // ── Notification panel position ──────────────────────────────────────────
    const updateNotifPos = useCallback(() => {
        if (notifRef.current) {
            const r = notifRef.current.getBoundingClientRect();
            setNotifPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
        }
    }, []);

    const toggleNotif = useCallback(() => {
        if (!notifOpen) { updateNotifPos(); fetchNotifications(); }
        setNotifOpen((o) => !o);
    }, [notifOpen, updateNotifPos, fetchNotifications]);

    useEffect(() => {
        if (!notifOpen) return;
        const h = () => updateNotifPos();
        window.addEventListener('scroll', h, { passive: true });
        window.addEventListener('resize', h);
        return () => { window.removeEventListener('scroll', h); window.removeEventListener('resize', h); };
    }, [notifOpen, updateNotifPos]);

    // ── Click outside ────────────────────────────────────────────────────────
    useEffect(() => {
        const h = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setUserMenuOpen(false);
            if (!notifRef.current?.contains(e.target) && !notifPanelRef.current?.contains(e.target))
                setNotifOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    return (
        <>
            <header className="bg-[#1a6b4e] border-b border-[#155d44] shadow-md" dir="ltr">
                <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10 py-3.5 flex items-center justify-between gap-4">

                    {/* Logo */}
                    <div className="flex items-center gap-2.5 group cursor-pointer" onClick={() => navigate('/dashboard')}>
                        <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center group-hover:bg-white/25 transition-all duration-200">
                            <span className="material-symbols-outlined text-white text-[22px] leading-none">clinical_notes</span>
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className="text-[18px] font-black text-white tracking-tighter flex items-center gap-0.5">
                                SAGE
                                <span className="w-1 h-1 bg-emerald-300 rounded-full animate-pulse" />
                            </span>
                            <span className="text-[9px] font-bold text-white/50 tracking-[0.2em] uppercase pl-0.5">
                                Health Care
                            </span>
                        </div>
                    </div>

                    {/* Center nav */}
                    <nav className="hidden md:flex items-center gap-1 bg-white/10 rounded-2xl px-2 py-1.5">
                        {NAV_ITEMS.map(({ to, icon, label }) => (
                            <Link key={to} to={to}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                                    location.pathname === to
                                        ? 'bg-white text-[#134e3a] shadow-sm font-bold'
                                        : 'text-white/75 hover:text-white hover:bg-white/15'
                                }`}>
                                <span className="material-symbols-outlined text-[17px]">{icon}</span>
                                {label}
                            </Link>
                        ))}
                    </nav>

                    {/* Right side */}
                    <div className="flex items-center gap-2.5">
                        <Link to="/doctor-register"
                            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 border-2 border-white/40 text-white font-bold text-xs rounded-xl hover:bg-white hover:text-[#134e3a] transition-all">
                            <span className="material-symbols-outlined text-[15px]">stethoscope</span>
                            انضم كطبيب
                        </Link>

                        {/* Notification bell */}
                        <div ref={notifRef}>
                            <button onClick={toggleNotif}
                                className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/15 transition-colors"
                                aria-label="الإشعارات">
                                <span className="material-symbols-outlined text-[22px] text-white/80">notifications</span>
                                {unreadCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* User avatar + menu */}
                        <div className="relative" ref={menuRef}>
                            <button onClick={() => setUserMenuOpen(!userMenuOpen)}
                                className="flex items-center gap-2.5 min-w-0 hover:bg-white/10 p-1 pr-3 rounded-xl transition-all duration-200 active:scale-95 border border-transparent hover:border-white/20">
                                <div className="relative shrink-0">
                                    {user?.profilePicture ? (
                                        <img src={`${SERVER_BASE}${user.profilePicture}`} alt="صورة الملف الشخصي"
                                            className="w-10 h-10 rounded-full object-cover shadow-sm ring-2 ring-white/30"/>
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-base ring-2 ring-white/30">
                                            {displayName.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#1a6b4e]" />
                                </div>
                                <div className="hidden sm:block text-right min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{displayName}</p>
                                </div>
                                <span className={`material-symbols-outlined text-white/60 text-[18px] transition-transform duration-300 ${userMenuOpen ? 'rotate-180' : ''}`}>
                                    keyboard_arrow_down
                                </span>
                            </button>

                            {userMenuOpen && (
                                <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-[999] animate-in fade-in zoom-in duration-150 origin-top-right">
                                    <div className="px-4 py-2 border-b border-gray-50 mb-1">
                                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">الحساب</p>
                                    </div>
                                    <Link to="/profile" onClick={() => setUserMenuOpen(false)}
                                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-[#134e3a] transition-colors group">
                                        <span className="material-symbols-outlined text-[20px] text-gray-400 group-hover:text-emerald-600">person</span>
                                        <span className="font-semibold">الملف الشخصي</span>
                                    </Link>
                                    <hr className="my-1 border-gray-50"/>
                                    <button onClick={() => { setUserMenuOpen(false); signOut(); navigate('/login'); }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors group">
                                        <span className="material-symbols-outlined text-[20px] text-red-400 group-hover:text-red-600">logout</span>
                                        <span className="font-semibold">تسجيل الخروج</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Mobile hamburger */}
                        <button onClick={() => setMobileMenuOpen((o) => !o)}
                            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 transition-colors">
                            <span className="material-symbols-outlined text-[20px] text-white">
                                {mobileMenuOpen ? 'close' : 'menu'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Mobile menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t border-white/15 px-4 py-3 flex flex-col gap-1 bg-[#134e3a]">
                        {[...NAV_ITEMS, { to: '/doctor-register', icon: 'stethoscope', label: 'انضم كطبيب' }].map(({ to, icon, label }) => (
                            <Link key={to} to={to} onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-white/80 hover:bg-white/10 hover:text-white font-semibold text-sm transition-colors">
                                <span className="material-symbols-outlined text-[18px]">{icon}</span>
                                {label}
                            </Link>
                        ))}
                        <button onClick={() => { signOut(); navigate('/login'); }}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-300 hover:bg-white/10 font-semibold text-sm transition-colors mt-1 border-t border-white/15 pt-3">
                            <span className="material-symbols-outlined text-[18px]">logout</span>
                            تسجيل الخروج
                        </button>
                    </div>
                )}
            </header>

            {/* Notification panel portal */}
            {notifOpen && createPortal(
                <div ref={notifPanelRef}
                    style={{ position: 'fixed', top: notifPos.top, right: notifPos.right, zIndex: 9999 }}
                    className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
                    dir="rtl">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <p className="font-black text-[#134e3a] text-sm">الإشعارات</p>
                            {unreadCount > 0 && (
                                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                    {unreadCount} جديد
                                </span>
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
                                        <div key={n._id} onClick={() => !n.isRead && markOneRead(n._id)}
                                            className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50 cursor-pointer ${!n.isRead ? 'bg-emerald-50/60' : ''}`}>
                                            <div className={`w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                                                <span className={`material-symbols-outlined text-[16px] ${cfg.color}`}>{cfg.icon}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-[#191c1c] leading-snug">{n.title}</p>
                                                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                                                <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                                            </div>
                                            <div className="flex flex-col items-center gap-2 shrink-0">
                                                {!n.isRead && <span className="w-2 h-2 bg-emerald-500 rounded-full mt-1"/>}
                                                <button onClick={(e) => { e.stopPropagation(); deleteNotif(n._id); }}
                                                    className="text-gray-300 hover:text-red-400 transition-colors" aria-label="حذف">
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
        </>
    );
}

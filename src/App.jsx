import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import CookieConsentBanner from './components/CookieConsentBanner';
import ProtectedRoute from './components/protectRoute';
import { useAuth } from './context/AuthContext';

// Page-level code splitting — each route is its own async chunk.
// DoctorDashboard alone is 2,500+ lines; lazy loading cuts the initial bundle
// by ~70% for patients and unauthenticated visitors.
const Register           = lazy(() => import('./Pages/auth/Register'));
const VerifyEmail        = lazy(() => import('./Pages/auth/VerifyEmail'));
const Login              = lazy(() => import('./Pages/auth/Login'));
const ForgotPassword     = lazy(() => import('./Pages/auth/ForgotPassword'));
const RoleSelection      = lazy(() => import('./Pages/auth/RoleSelection'));
const CompleteProfile    = lazy(() => import('./Pages/Patient/CompleteProfile'));
const PatientDashboard   = lazy(() => import('./Pages/Patient/PatientDashboard'));
const AIChatPage         = lazy(() => import('./Pages/Patient/AIChatPage'));
const PatientProfile     = lazy(() => import('./Pages/Patient/PatientProfile'));
const BookDoctor         = lazy(() => import('./Pages/Patient/BookDoctor'));
const Appointments       = lazy(() => import('./Pages/Patient/Appointments'));
const DoctorSearch       = lazy(() => import('./Pages/Patient/DoctorSearch'));
const DoctorRegistration = lazy(() => import('./Pages/Doctor/DoctorRegistration'));
const DoctorDashboard    = lazy(() => import('./Pages/Doctor/DoctorDashboard'));
const DoctorProfile      = lazy(() => import('./Pages/Doctor/DoctorProfile'));
const PrivacyPolicy      = lazy(() => import('./Pages/PrivacyPolicy'));
const TermsOfService     = lazy(() => import('./Pages/TermsOfService'));
const AdminDashboard     = lazy(() => import('./Pages/Admin/AdminDashboard'));

const PageLoader = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0b2d20] to-[#1a4d35]">
        <div className="w-10 h-10 border-4 border-[#134e3a] border-t-transparent rounded-full animate-spin" />
    </div>
);

// Where each role lands when they hit the site root.
const ROLE_HOME = {
    patient:   '/dashboard',
    doctor:    '/doctor-dashboard',
    secretary: '/doctor-dashboard',
    admin:     '/admin-dashboard',
};

// Root entry point: send authenticated users to their role's dashboard, guests to
// register. Waits for the session-restore check (loading) so a logged-in user
// opening "/" isn't bounced to /register before auth resolves.
const HomeRedirect = () => {
    const { isAuthenticated, user, loading } = useAuth();
    if (loading) return <PageLoader />;
    if (isAuthenticated) return <Navigate to={ROLE_HOME[user?.role] || '/dashboard'} replace />;
    return <Navigate to="/register" replace />;
};


// Users with wrong role hit a blank page with no explanation.
const Unauthorized = () => (
    <div className="min-h-screen bg-gradient-to-b from-[#0b2d20] to-[#1a4d35] flex items-center justify-center p-6 font-['Poppins']">
        <div className="bg-white rounded-[24px] shadow-2xl p-10 max-w-md w-full text-center">
            <span className="material-symbols-outlined text-[48px] text-orange-400 mb-4 block">lock</span>
            <h1 className="text-xl font-bold text-[#191c1c] mb-2">غير مصرح لك بالدخول</h1>
            <p className="text-gray-500 text-sm mb-6">
                ليس لديك الصلاحية للوصول إلى هذه الصفحة.
            </p>
            <a
                href="/login"
                className="inline-block bg-[#134e3a] text-white px-6 py-3 rounded-[12px] font-bold"
            >
                العودة لتسجيل الدخول
            </a>
        </div>
    </div>
);

function App() {
    // A focused <input type="number"> changes its value on mouse-wheel scroll,
    // so a doctor who types 500 then scrolls the page silently saves 494/496.
    // Blur any focused number input on wheel to neutralise this app-wide; the
    // page still scrolls normally because we never preventDefault.
    useEffect(() => {
        const onWheel = () => {
            const el = document.activeElement;
            if (el && el.tagName === 'INPUT' && el.type === 'number') el.blur();
        };
        document.addEventListener('wheel', onWheel, { passive: true });
        return () => document.removeEventListener('wheel', onWheel);
    }, []);

    return (
        <Suspense fallback={<PageLoader />}>
        <CookieConsentBanner />
        <Routes>
            {/* ── Public auth routes ───────────────────────────────────────── */}
            <Route path="/"                element={<HomeRedirect />} />
            <Route path="/register"        element={<Register />} />
            <Route path="/verify-email"    element={<VerifyEmail />} />
            <Route path="/login"           element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/complete-profile" element={<CompleteProfile />} />
            <Route path="/privacy-policy"  element={<PrivacyPolicy />} />
            <Route path="/terms"           element={<TermsOfService />} />
            <Route path="/unauthorized"    element={<Unauthorized />} />

            {/* ── Protected: any authenticated user ───────────────────────── */}
            <Route path="/role-selection"  element={<ProtectedRoute><RoleSelection /></ProtectedRoute>} />
            <Route path="/doctor-register" element={<ProtectedRoute><DoctorRegistration /></ProtectedRoute>} />
            <Route path="/book/:doctorId"  element={<ProtectedRoute><BookDoctor /></ProtectedRoute>} />

            {/* ── Protected: patient only ──────────────────────────────────── */}
            <Route path="/dashboard"    element={<ProtectedRoute allowedRoles={['patient']}><PatientDashboard /></ProtectedRoute>} />
            <Route path="/chat"         element={<ProtectedRoute allowedRoles={['patient']}><AIChatPage /></ProtectedRoute>} />
            <Route path="/profile"      element={<ProtectedRoute allowedRoles={['patient']}><PatientProfile /></ProtectedRoute>} />
            <Route path="/appointments" element={<ProtectedRoute allowedRoles={['patient']}><Appointments /></ProtectedRoute>} />
            <Route path="/doctors"      element={<ProtectedRoute allowedRoles={['patient']}><DoctorSearch /></ProtectedRoute>} />

            {/* ── Protected: doctor and secretary ─────────────────────────── */}
            <Route path="/doctor-dashboard" element={<ProtectedRoute allowedRoles={['doctor', 'secretary']}><DoctorDashboard /></ProtectedRoute>} />
            <Route path="/doctor-profile"   element={<ProtectedRoute allowedRoles={['doctor']}><DoctorProfile /></ProtectedRoute>} />

            {/* ── Protected: admin only ────────────────────────────────────── */}
            <Route path="/admin-dashboard"  element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />

            {/* ── Catch-all MUST be last — any route above takes precedence ── */}
            <Route path="*" element={<HomeRedirect />} />
        </Routes>
        </Suspense>
    );
}

export default App;
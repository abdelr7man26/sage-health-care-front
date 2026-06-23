import { useState, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { login } from '../../Services/authService';
import { useAuth } from "../../context/AuthContext";
import Notification from '../../components/notifications';

/**
 * Login Page
 *
 * Fixes applied:
 * 1. CRITICAL: reads response.role and response.user correctly (was response.role on top level,
 *    but backend returned it inside response.data — now backend is fixed to match this shape).
 * 2. Uses AuthContext.signIn() instead of scattered localStorage calls.
 * 3. Redirects back to the originally requested URL after login (via location.state.from).
 * 4. Replaces alert() with inline <Notification /> component.
 * 5. Prevents double-submit by disabling button while loading.
 */
const Login = () => {
    const navigate   = useNavigate();
    const location   = useLocation();
    const { signIn } = useAuth();

    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading]           = useState(false);
    const [notification, setNotification] = useState(null);
    const [credentials, setCredentials]   = useState({ email: '', password: '' });

    const emailRef    = useRef(null);
    const passwordRef = useRef(null);
    const submitRef   = useRef(null);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setCredentials((prev) => ({ ...prev, [id]: value }));
        if (notification) setNotification(null); // clear error on new input
    };

    const handleKeyDown = (e, nextRef) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nextRef.current?.focus();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setNotification(null);

        try {
            const response = await login(credentials);

            // FIX: Backend now returns { success, token, role, user: { id, name, role } }
            // signIn stores token + user in AuthContext (and localStorage via the context)
            signIn({ token: response.token, user: response.user });

            // Redirect to the originally-requested page, or role-appropriate home
            const from = location.state?.from?.pathname;
            const role = response.user?.role;
            const roleHome =
                (role === 'doctor' || role === 'secretary') ? '/doctor-dashboard' :
                role === 'admin' ? '/admin-dashboard' :
                '/dashboard';
            navigate(from || roleHome, { replace: true });
        } catch (err) {
            setNotification({ type: 'error', message: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-[#f8faf9] min-h-screen flex items-center justify-center p-6 font-['Poppins']">
            <main className="w-full max-w-[1000px] grid grid-cols-1 lg:grid-cols-12 bg-white rounded-[24px] shadow-2xl overflow-hidden min-h-[600px] border border-gray-100">

                {/* Left Side: Branding */}
                <section className="hidden lg:flex lg:col-span-5 relative flex-col justify-between p-12 bg-[#2d6a4f]">
                    <div className="relative z-10 text-white">
                        <div className="flex items-center gap-3 mb-10">
                            <span className="material-symbols-outlined text-[32px] border-2 border-white rounded-lg p-1">medical_services</span>
                            <h1 className="text-2xl font-black tracking-tighter">SAGE</h1>
                        </div>
                        <h2 className="text-4xl font-bold mb-6">Welcome Back!</h2>
                        <p className="text-white/80 text-lg font-light">Access your secure healthcare dashboard and manage your wellness journey.</p>
                    </div>
                </section>

                {/* Right Side: Login Form */}
                <section className="lg:col-span-7 flex flex-col justify-center items-center p-8 md:p-12 text-center lg:text-left">
                    <div className="w-full max-w-[400px]">
                        <header className="mb-8">
                            <h2 className="text-3xl font-bold text-[#191c1c] mb-2">Login</h2>
                            <p className="text-gray-500 text-sm">Enter your credentials to access your account.</p>
                        </header>

                        <form className="space-y-6" onSubmit={handleSubmit}>
                            {/* Inline error notification — replaces alert() */}
                            <Notification notification={notification} />

                            {/* Email */}
                            <div className="space-y-1 text-left">
                                <label className="text-[12px] font-bold text-gray-600 ml-1">Email Address</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">mail</span>
                                    <input
                                        id="email"
                                        ref={emailRef}
                                        value={credentials.email}
                                        onChange={handleChange}
                                        onKeyDown={(e) => handleKeyDown(e, passwordRef)}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-[12px] outline-none focus:border-[#2d6a4f]"
                                        placeholder="mail@example.com"
                                        type="email"
                                        required
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-1 text-left">
                                <label className="text-[12px] font-bold text-gray-600 ml-1">Password</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">lock</span>
                                    <input
                                        id="password"
                                        ref={passwordRef}
                                        value={credentials.password}
                                        onChange={handleChange}
                                        onKeyDown={(e) => handleKeyDown(e, submitRef)}
                                        className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-[12px] outline-none focus:border-[#2d6a4f]"
                                        placeholder="••••••••"
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                                        aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                                    >
                                        <span className="material-symbols-outlined text-[18px]">
                                            {showPassword ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                                <div className="text-right mt-2">
                                    <Link to="/forgot-password" className="text-xs text-[#2d6a4f] font-bold hover:underline">
                                        Forgot password?
                                    </Link>
                                </div>
                            </div>

                            <button
                                ref={submitRef}
                                disabled={loading}
                                className="w-full bg-[#134e3a] hover:bg-[#0c3326] text-white py-4 rounded-[14px] font-bold shadow-lg transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                                type="submit"
                            >
                                {loading ? 'Signing in...' : 'Login'}
                                <span className="material-symbols-outlined">login</span>
                            </button>

                            <div className="text-center pt-4">
                                <p className="text-sm text-gray-500 font-medium">
                                    New to SAGE?
                                    <Link to="/register" className="text-[#2d6a4f] font-extrabold hover:underline ml-1">
                                        Create an account
                                    </Link>
                                </p>
                            </div>
                        </form>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default Login;
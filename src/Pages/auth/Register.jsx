import { useState, useRef } from 'react';
import { register } from '../../Services/authService';
import { useNavigate, Link } from 'react-router-dom';
import {
    validatePasswordRequirements,
    getPasswordStrength,
    getStrengthLabel,
    isPasswordAcceptable,
} from '../../utils/passwordValidator';
import Notification from '../../components/notifications';

const Register = () => {
    const navigate = useNavigate();
    const [showPassword,     setShowPassword]     = useState(false);
    const [loading,          setLoading]          = useState(false);
    const [notification,     setNotification]     = useState(null);
    const [consentAccepted,  setConsentAccepted]  = useState(false);

    const [formData, setFormData] = useState({
        name:            '',
        email:           '',
        phone:           '',
        birthDate:       '',
        gender:          'male', // FIX (L-06): default to 'male' to match User schema default
        password:        '',
        confirmPassword: '',
    });

    const nameRef            = useRef(null);
    const emailRef           = useRef(null);
    const phoneRef           = useRef(null);
    const birthDateRef       = useRef(null);
    const genderRef          = useRef(null);
    const passwordRef        = useRef(null);
    const confirmPasswordRef = useRef(null);
    const submitRef          = useRef(null);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData((prev) => ({ ...prev, [id]: value }));
        if (notification) setNotification(null);
    };

    const handleKeyDown = (e, nextRef) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (nextRef === submitRef) nextRef.current?.click();
            else nextRef.current?.focus();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // FIX (L-06): guard against empty gender (can still occur if JS is bypassed)
        if (!formData.gender) {
            return setNotification({ type: 'error', message: 'يرجى اختيار الجنس' });
        }

        if (formData.password !== formData.confirmPassword) {
            return setNotification({ type: 'error', message: 'كلمتا المرور غير متطابقتين' });
        }

        if (!isPasswordAcceptable(formData.password)) {
            return setNotification({
                type: 'error',
                message: 'كلمة المرور ضعيفة جداً — يجب أن تحتوي على 8 أحرف، رقم، وحرف كبير على الأقل',
            });
        }

        if (!consentAccepted) {
            return setNotification({ type: 'error', message: 'يرجى الموافقة على سياسة الخصوصية للمتابعة' });
        }

        setLoading(true);
        setNotification(null);

        try {
            const result = await register(formData);
            if (result.success) {
                navigate('/verify-email', { state: { email: formData.email } });
            }
        } catch (err) {
            setNotification({ type: 'error', message: err.message });
        } finally {
            setLoading(false);
        }
    };

    const passwordStrength = getPasswordStrength(formData.password);
    const strengthLabel    = getStrengthLabel(passwordStrength);
    const requirements     = validatePasswordRequirements(formData.password);

    return (
        <div className="bg-[#f8faf9] min-h-screen flex items-center justify-center p-6 font-['Poppins']">
            <main className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-12 bg-white rounded-[24px] shadow-2xl overflow-hidden min-h-[850px] border border-gray-100">

                {/* Left Side: Branding */}
                <section className="hidden lg:flex lg:col-span-5 relative flex-col justify-between p-12 bg-[#2d6a4f]">
                    <div className="absolute inset-0 z-0">
                        <img
                            src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80"
                            className="w-full h-full object-cover opacity-15 mix-blend-overlay"
                            alt=""
                            aria-hidden="true"
                        />
                    </div>
                    <div className="relative z-10 text-white">
                        <div className="flex items-center gap-3 mb-10">
                            <span className="material-symbols-outlined text-[32px] border-2 border-white rounded-lg p-1">medical_services</span>
                            <h1 className="text-2xl font-black tracking-tighter">SAGE</h1>
                        </div>
                        <h2 className="text-4xl font-bold mb-6 leading-[1.2]">Your health journey, simplified and secured.</h2>
                        <p className="text-white/80 text-lg leading-relaxed font-light">Join thousands of patients who trust SAGE for clinical precision and empathetic healthcare management.</p>
                    </div>
                    <div className="relative z-10">
                        <div className="bg-white/10 backdrop-blur-md rounded-[20px] p-6 border border-white/20 text-white">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex -space-x-2">
                                    <div className="w-8 h-8 rounded-full bg-blue-400 border-2 border-[#2d6a4f]" />
                                    <div className="w-8 h-8 rounded-full bg-green-400 border-2 border-[#2d6a4f]" />
                                </div>
                                <span className="text-xs font-semibold">Trusted by 500+ Providers</span>
                            </div>
                            <p className="text-sm italic opacity-90">"SAGE has transformed how I manage my patient records."</p>
                        </div>
                    </div>
                </section>

                {/* Right Side: Form */}
                <section className="lg:col-span-7 flex flex-col justify-center items-center p-8 md:p-12">
                    <div className="w-full max-w-[460px]">
                        <header className="mb-8 text-center lg:text-left">
                            <h2 className="text-3xl font-bold text-[#191c1c] mb-2">Create Account</h2>
                            <p className="text-gray-500 text-sm">Enter your details to start your wellness journey.</p>
                        </header>

                        <form className="space-y-4" onSubmit={handleSubmit}>
                            <Notification notification={notification} />

                            {/* Name */}
                            <div className="space-y-1 text-left">
                                <label htmlFor="name" className="text-[12px] font-bold text-gray-600 ml-1">Full Name</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">person</span>
                                    <input
                                        id="name"
                                        ref={nameRef}
                                        value={formData.name}
                                        onChange={handleChange}
                                        onKeyDown={(e) => handleKeyDown(e, emailRef)}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-[12px] outline-none focus:border-[#2d6a4f]"
                                        placeholder="Your full name"
                                        type="text"
                                        required
                                        autoComplete="name"
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div className="space-y-1 text-left">
                                <label htmlFor="email" className="text-[12px] font-bold text-gray-600 ml-1">Email Address</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">mail</span>
                                    <input
                                        id="email"
                                        ref={emailRef}
                                        value={formData.email}
                                        onChange={handleChange}
                                        onKeyDown={(e) => handleKeyDown(e, phoneRef)}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-[12px] outline-none focus:border-[#2d6a4f]"
                                        placeholder="mail@example.com"
                                        type="email"
                                        required
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            {/* Phone */}
                            <div className="space-y-1 text-left">
                                <label htmlFor="phone" className="text-[12px] font-bold text-gray-600 ml-1">Phone Number</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">phone</span>
                                    <input
                                        id="phone"
                                        ref={phoneRef}
                                        value={formData.phone}
                                        onChange={handleChange}
                                        onKeyDown={(e) => handleKeyDown(e, birthDateRef)}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-[12px] outline-none focus:border-[#2d6a4f]"
                                        placeholder="+20 1XX XXX XXXX"
                                        type="tel"
                                        required
                                        autoComplete="tel"
                                    />
                                </div>
                            </div>

                            {/* Date of Birth + Gender */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label htmlFor="birthDate" className="text-[12px] font-bold text-gray-600 ml-1">Date of Birth</label>
                                    <input
                                        id="birthDate"
                                        ref={birthDateRef}
                                        value={formData.birthDate}
                                        onKeyDown={(e) => handleKeyDown(e, genderRef)}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-[12px] focus:border-[#2d6a4f] outline-none"
                                        type="date"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label htmlFor="gender" className="text-[12px] font-bold text-gray-600 ml-1">Gender</label>
                                    <div className="relative">
                                        {/* FIX (L-06): removed blank option; default is 'male' matching schema */}
                                        <select
                                            id="gender"
                                            ref={genderRef}
                                            onKeyDown={(e) => handleKeyDown(e, passwordRef)}
                                            value={formData.gender}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-[12px] focus:border-[#2d6a4f] outline-none appearance-none"
                                        >
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                        </select>
                                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">expand_more</span>
                                    </div>
                                </div>
                            </div>

                            {/* Password Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label htmlFor="password" className="text-[12px] font-bold text-gray-600 ml-1">Password</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">lock</span>
                                        <input
                                            id="password"
                                            ref={passwordRef}
                                            onKeyDown={(e) => handleKeyDown(e, confirmPasswordRef)}
                                            value={formData.password}
                                            onChange={handleChange}
                                            className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-[12px] outline-none focus:border-[#2d6a4f]"
                                            placeholder="••••••••"
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                                            aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                                        >
                                            <span className="material-symbols-outlined text-[15px]">
                                                {showPassword ? 'visibility_off' : 'visibility'}
                                            </span>
                                        </button>
                                    </div>
                                    {formData.password && (
                                        <div className="mt-2">
                                            <div className="h-1 w-full bg-gray-200 rounded-full">
                                                <div className={`h-full transition-all rounded-full ${strengthLabel.color} ${strengthLabel.width}`} />
                                            </div>
                                            <span className="text-[10px] text-gray-500">{strengthLabel.label}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <label htmlFor="confirmPassword" className="text-[12px] font-bold text-gray-600 ml-1">Confirm</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">lock_reset</span>
                                        <input
                                            id="confirmPassword"
                                            ref={confirmPasswordRef}
                                            onKeyDown={(e) => handleKeyDown(e, submitRef)}
                                            value={formData.confirmPassword}
                                            onChange={handleChange}
                                            className={`w-full pl-12 pr-4 py-3 bg-gray-50 border rounded-[12px] outline-none focus:border-[#2d6a4f] ${
                                                formData.confirmPassword && formData.confirmPassword !== formData.password
                                                    ? 'border-red-300'
                                                    : 'border-gray-200'
                                            }`}
                                            placeholder="••••••••"
                                            type="password"
                                            required
                                            autoComplete="new-password"
                                        />
                                    </div>
                                </div>

                                <div className="mt-2 text-sm space-y-1">
                                    <p className={requirements.hasMinLength ? 'text-green-600' : 'text-gray-500'}>
                                        {requirements.hasMinLength ? '✓' : '○'} 8 أحرف على الأقل
                                    </p>
                                    <p className={requirements.hasCapital ? 'text-green-600' : 'text-gray-500'}>
                                        {requirements.hasCapital ? '✓' : '○'} حرف كبير واحد على الأقل (A-Z)
                                    </p>
                                    <p className={requirements.hasNumber ? 'text-green-600' : 'text-gray-500'}>
                                        {requirements.hasNumber ? '✓' : '○'} رقم واحد على الأقل (0-9)
                                    </p>
                                </div>
                            </div>

                            {/* Consent checkbox — required by Egyptian Data Protection Law 151/2020 */}
                            <label className="flex items-start gap-3 cursor-pointer mt-2">
                                <input
                                    type="checkbox"
                                    checked={consentAccepted}
                                    onChange={(e) => setConsentAccepted(e.target.checked)}
                                    className="mt-1 w-4 h-4 accent-[#2d6a4f] flex-shrink-0"
                                />
                                <span className="text-[12px] text-gray-600 leading-relaxed">
                                    أوافق على{' '}
                                    <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#2d6a4f] font-bold hover:underline">
                                        سياسة الخصوصية
                                    </a>{' '}
                                    و{' '}
                                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#2d6a4f] font-bold hover:underline">
                                        شروط الاستخدام
                                    </a>{' '}
                                    والموافقة على معالجة بياناتي الصحية لأغراض تقديم خدمات منصة SAGE وفق قانون حماية البيانات الشخصية رقم 151 لسنة 2020.
                                </span>
                            </label>

                            <button
                                ref={submitRef}
                                type="submit"
                                disabled={loading || !consentAccepted}
                                className="w-full bg-[#134e3a] hover:bg-[#0c3326] text-white py-4 rounded-[14px] font-bold shadow-lg transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Creating account...' : 'Create Account'}
                                <span className="material-symbols-outlined">arrow_forward</span>
                            </button>

                            <div className="text-center pt-2">
                                <p className="text-sm text-gray-500 font-medium">
                                    Already have an account?
                                    <Link to="/login" className="text-[#2d6a4f] font-extrabold hover:underline ml-1">
                                        Login here
                                    </Link>
                                </p>
                            </div>

                            <div className="mt-6 flex items-center justify-center gap-2 bg-green-50 py-2 px-4 rounded-full border border-green-100">
                                <span className="material-symbols-outlined text-[16px] text-[#2d6a4f]">verified_user</span>
                                <span className="text-[10px] font-bold text-[#2d6a4f] uppercase tracking-tighter">مشفر AES-256 — محمي وفق قانون 151/2020</span>
                            </div>
                        </form>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default Register;
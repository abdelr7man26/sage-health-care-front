import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { forgotPassword, verifyResetCode, resetPassword } from '../../Services/authService';
import OtpInput from '../../components/Otpinput';
import Notification from '../../components/notifications';

// FIX (C-05): handleResetSubmit used alert() for password mismatch, success, and error.
// All three are now replaced with setNotification(), consistent with steps 1 and 2.

const ForgotPassword = () => {
    const navigate = useNavigate();

    const [step,                setStep]                = useState(1);
    const [isSending,           setIsSending]           = useState(false);
    const [loading,             setLoading]             = useState(false);
    const [resendLoading,       setResendLoading]       = useState(false);
    const [email,               setEmail]               = useState('');
    const [otp,                 setOtp]                 = useState(new Array(6).fill(''));
    const [timer,               setTimer]               = useState(30);
    const [formData,            setFormData]            = useState({ newPassword: '', confirmPassword: '' });
    const [notification,        setNotification]        = useState(null);
    const [showPassword,        setShowPassword]        = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    };

    // Timer — only ticks while on step 2
    useEffect(() => {
        if (step !== 2 || timer <= 0) return;
        const id = setInterval(() => setTimer((prev) => prev - 1), 1000);
        return () => clearInterval(id);
    }, [step, timer]);

    // ── Step 1 & resend: request / re-request the OTP ─────────────────────────
    const handleSendCode = async (e) => {
        if (e) e.preventDefault();
        // Synchronous guard — prevents double-click AND concurrent calls
        if (isSending) return;
        setIsSending(true);

        if (step === 2) setResendLoading(true);
        else            setLoading(true);
        setNotification(null);

        try {
            const response = await forgotPassword(email);
            // Show the server's own message — intentionally generic so it's accurate
            // for both found and not-found cases ("If this email is registered…").
            showNotification('success', response.message);
            // Only advance to the OTP step on the initial send (step 1).
            // On resend (step 2) the user is already on the OTP screen.
            if (step !== 2) setStep(2);
            setTimer(30);
            setOtp(new Array(6).fill(''));
        } catch (err) {
            showNotification('error', err.message || 'حدث خطأ في إرسال الكود');
        } finally {
            setIsSending(false);
            setLoading(false);
            setResendLoading(false);
        }
    };

    
    // ── Step 2: verify the OTP ────────────────────────────────────────────────
    const handleVerifyCode = async (e) => {
        e.preventDefault();
        const code = otp.join('');
        if (code.length < 6) return showNotification('error', 'يرجى إدخال الكود كاملاً');

        setLoading(true);
        setNotification(null);
        try {
            await verifyResetCode(email, code);
            setStep(3);
        } catch (err) {
            showNotification('error', err.message || 'الكود غير صحيح أو انتهت صلاحيته');
        } finally {
            setLoading(false);
        }
    };

    // ── Step 3: set the new password ──────────────────────────────────────────
    const handleResetSubmit = async (e) => {
        e.preventDefault();

        // FIX (C-05): was alert() — now uses setNotification
        if (formData.newPassword !== formData.confirmPassword) {
            return showNotification('error', 'كلمتا المرور غير متطابقتين');
        }

        setLoading(true);
        setNotification(null);
        try {
            await resetPassword({ email, code: otp.join(''), newPassword: formData.newPassword });
            showNotification('success', 'تم تغيير كلمة المرور بنجاح، جاري تحويلك...');
            setTimeout(() => navigate('/login'), 1500);
        } catch (err) {
            showNotification('error', err.message || 'حدث خطأ في تغيير كلمة المرور');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-[#f8faf9] min-h-screen flex items-center justify-center p-6 font-['Poppins']">
            <main className="w-full max-w-[500px] bg-white rounded-2xl shadow-[0px_4px_20px_rgba(45,106,79,0.08)] p-8 md:p-12 text-center">

                <div className="mb-4">
                    <Notification notification={notification} />
                </div>

                <span className="text-3xl font-bold text-[#0f5238] block mb-1">SAGE</span>
                <div className="h-1 w-12 bg-[#2d6a4f] mx-auto rounded-full mb-8" />

                {step === 1 && (
                    <form onSubmit={handleSendCode} className="space-y-6">
                        <h2 className="text-2xl font-semibold text-[#0f5238]">Forgot Password?</h2>
                        <input
                            type="email"
                            required
                            placeholder="Email Address"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2d6a4f]"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                        />
                        <button
                            type="submit"
                            disabled={loading || isSending}
                            className="w-full bg-[#2d6a4f] text-white py-3 rounded-xl font-semibold hover:bg-[#0f5238] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading || isSending ? 'Sending...' : 'Send Code'}
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleVerifyCode}>
                        <h2 className="text-2xl font-semibold text-[#0f5238] mb-2">Verify Code</h2>
                        <p className="text-gray-500 mb-8 text-sm">
                            We've sent a 6-digit code to <br />
                            <span className="font-semibold text-black">{email}</span>
                        </p>

                        <div className="mb-10">
                            <OtpInput value={otp} onChange={setOtp} length={6} disabled={loading} />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || resendLoading || isSending}
                            className="w-full bg-[#2d6a4f] text-white py-3 rounded-xl font-semibold hover:bg-[#0f5238] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Verifying...' : 'Verify'}
                            {!loading && <span className="material-symbols-outlined text-sm">check_circle</span>}
                        </button>

                        <div className="mt-6">
                            <p className="text-xs text-gray-400">Didn't receive the code?</p>
                            <button
                                type="button"
                                onClick={handleSendCode}
                                disabled={timer > 0 || resendLoading || loading || isSending}
                                className="text-[#0f5238] font-bold text-sm mt-1 disabled:text-gray-300 transition-colors"
                            >
                                {resendLoading || isSending ? 'Sending...' : timer > 0 ? `Resend in ${timer}s` : 'Resend Code'}
                            </button>
                        </div>
                    </form>
                )}

                {step === 3 && (
                    <form onSubmit={handleResetSubmit} className="space-y-4">
                        <h2 className="text-2xl font-semibold text-[#0f5238] mb-4">New Password</h2>

                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                placeholder="New Password"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2d6a4f]"
                                value={formData.newPassword}
                                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                                autoComplete="new-password"
                            />
                            <span
                                className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400"
                                onClick={() => setShowPassword(!showPassword)}
                                role="button"
                                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                            >
                                {showPassword ? 'visibility' : 'visibility_off'}
                            </span>
                        </div>

                        <div className="relative">
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                required
                                placeholder="Confirm Password"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2d6a4f]"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                autoComplete="new-password"
                            />
                            <span
                                className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                role="button"
                                aria-label={showConfirmPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                            >
                                {showConfirmPassword ? 'visibility' : 'visibility_off'}
                            </span>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#2d6a4f] text-white py-3 rounded-xl font-semibold hover:bg-[#0f5238] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>
                )}
            </main>
        </div>
    );
};

export default ForgotPassword;
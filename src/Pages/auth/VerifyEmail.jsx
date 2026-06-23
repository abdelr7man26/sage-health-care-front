import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { verifyEmail, resendCode } from '../../Services/authService';
import { useAuth } from '../../context/AuthContext';
import OtpInput from '../../components/Otpinput';
import Notification from '../../components/notifications';

const VerifyEmail = () => {
    const location = useLocation();
    const navigate  = useNavigate();
    const { signIn } = useAuth();

    // FIX (C-06): if there's no email in state, the user navigated here directly
    // (e.g., by typing the URL). Redirect them to register rather than sending
    // the string "User" as an email address to the backend.
    const email = location.state?.email;
    useEffect(() => {
        if (!email) navigate('/register', { replace: true });
    }, [email, navigate]);

    const [otp,          setOtp]          = useState(new Array(6).fill(''));
    // FIX (M-05): timer uses functional updater to avoid stale closure under StrictMode
    const [timer,        setTimer]        = useState(30);
    const [loading,      setLoading]      = useState(false);
    const [notification, setNotification] = useState(null);

    const showNotification = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    };

    useEffect(() => {
        if (timer <= 0) return;
        // FIX (M-05): prev => prev - 1 avoids stale closure
        const id = setInterval(() => setTimer((prev) => prev - 1), 1000);
        return () => clearInterval(id);
    }, [timer]);

    const handleResend = async () => {
        if (timer > 0) return;
        setLoading(true);
        setNotification(null);
        try {
            // FIX (L-03): removed unused `const response =` assignment
            await resendCode(email);
            showNotification('success', 'تم إعادة إرسال الكود بنجاح!');
            setTimer(30);
            setOtp(new Array(6).fill(''));
        } catch (err) {
            showNotification('error', err.message || 'حدث خطأ أثناء إعادة الإرسال');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        const code = otp.join('');
        if (code.length < 6) return showNotification('error', 'يرجى إدخال الكود كاملاً');

        setLoading(true);
        setNotification(null);
        try {
            const response = await verifyEmail({ email, code });
            showNotification('success', 'تم تفعيل الحساب بنجاح! جاري التوجيه...');

            if (response.token && response.user) {
                signIn({ token: response.token, user: response.user });
            }

            setTimeout(() => navigate('/role-selection'), 1500);
        } catch (err) {
            showNotification('error', err.message || 'كود التفعيل غير صحيح');
        } finally {
            setLoading(false);
        }
    };

    // While redirecting (no email) render nothing to avoid a flash
    if (!email) return null;

    return (
        <main className="min-h-screen bg-[#f8faf9] flex items-center justify-center p-6 font-['Poppins']">
            <div className="bg-white rounded-2xl p-12 shadow-[0px_4px_20px_rgba(45,106,79,0.08)] w-full max-w-md text-center">
                <span className="text-3xl font-bold text-[#0f5238] block mb-1">SAGE</span>
                <div className="h-1 w-12 bg-[#2d6a4f] mx-auto rounded-full mb-8" />

                <h1 className="text-2xl font-semibold text-[#0f5238] mb-2">Verify your email</h1>
                <p className="text-gray-500 mb-6 text-sm">
                    We've sent a 6-digit code to <br />
                    <span className="font-semibold text-black">{email}</span>
                </p>

                <div className="mb-6">
                    <Notification notification={notification} />
                </div>

                <div className="mb-10">
                    <OtpInput value={otp} onChange={setOtp} length={6} disabled={loading} />
                </div>

                <button
                    onClick={handleVerify}
                    disabled={loading}
                    className="w-full bg-[#2d6a4f] text-white py-3 rounded-xl font-semibold hover:bg-[#0f5238] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? 'Verifying...' : 'Verify'}
                    {!loading && <span className="material-symbols-outlined">check_circle</span>}
                </button>

                <div className="mt-6">
                    <p className="text-xs text-gray-400">Didn't receive the code?</p>
                    <button
                        onClick={handleResend}
                        disabled={timer > 0 || loading}
                        className="text-[#0f5238] font-bold text-sm mt-1 disabled:text-gray-300 transition-colors"
                    >
                        {timer > 0 ? `Resend in ${timer}s` : 'Resend Code'}
                    </button>
                </div>
            </div>
        </main>
    );
};

export default VerifyEmail;
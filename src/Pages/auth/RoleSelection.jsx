import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { initPatientProfile } from '../../Services/patientService';

const RoleSelection = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [selected, setSelected] = useState(null);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState(null);

    // البروفايل لم يعد يُنشأ تلقائياً عند التسجيل — يُنشأ هنا حسب الاختيار:
    // مريض → إنشاء الملف الطبي ثم إكمال البيانات، طبيب → نموذج التقديم
    const handleContinue = async () => {
        if (!selected || loading) return;
        if (selected === 'patient') {
            setLoading(true);
            setError(null);
            try {
                await initPatientProfile();
                navigate('/complete-profile');
            } catch (err) {
                setError(err.message || 'حدث خطأ غير متوقع');
            } finally {
                setLoading(false);
            }
        } else {
            navigate('/doctor-register');
        }
    };

    return (
        <div className="min-h-screen bg-[#f8faf9] flex flex-col items-center justify-center p-6 font-['Poppins']">

            {/* Logo */}
            <div className="flex items-center gap-2 mb-12">
                <span className="material-symbols-outlined text-[28px] text-[#134e3a] border-2 border-[#134e3a] rounded-lg p-1">
                    medical_services
                </span>
                <span className="text-2xl font-black text-[#134e3a] tracking-tight">SAGE</span>
            </div>

            {/* Heading */}
            <div className="text-center mb-10">
                <h1 className="text-3xl font-bold text-[#191c1c] mb-3">
                    {user?.name ? `مرحباً، ${user.name}` : 'مرحباً بك في SAGE'}
                </h1>
                <p className="text-gray-500 text-base max-w-md">
                    أخبرنا كيف ستستخدم المنصة حتى نُعدّ حسابك بشكل مناسب.
                </p>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl mb-10">

                {/* Patient Card */}
                <button
                    onClick={() => setSelected('patient')}
                    className={`relative flex flex-col items-center text-center p-8 rounded-2xl border-2 transition-all duration-200 cursor-pointer outline-none
                        ${selected === 'patient'
                            ? 'border-[#134e3a] bg-[#134e3a] text-white shadow-xl scale-[1.02]'
                            : 'border-gray-200 bg-white text-[#191c1c] hover:border-[#134e3a] hover:shadow-lg'
                        }`}
                >
                    {selected === 'patient' && (
                        <span className="absolute top-4 left-4 material-symbols-outlined text-[20px] text-white bg-white/20 rounded-full p-0.5">
                            check_circle
                        </span>
                    )}
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 text-4xl
                        ${selected === 'patient' ? 'bg-white/20' : 'bg-[#ecfdf5]'}`}>
                        🧑‍⚕️
                    </div>
                    <h2 className="text-xl font-bold mb-2">أنا مريض</h2>
                    <p className={`text-sm leading-relaxed ${selected === 'patient' ? 'text-white/80' : 'text-gray-500'}`}>
                        أحجز مواعيد، أتابع دوائي، وأحصل على استشارات طبية ذكية.
                    </p>
                </button>

                {/* Doctor Card */}
                <button
                    onClick={() => setSelected('doctor')}
                    className={`relative flex flex-col items-center text-center p-8 rounded-2xl border-2 transition-all duration-200 cursor-pointer outline-none
                        ${selected === 'doctor'
                            ? 'border-[#134e3a] bg-[#134e3a] text-white shadow-xl scale-[1.02]'
                            : 'border-gray-200 bg-white text-[#191c1c] hover:border-[#134e3a] hover:shadow-lg'
                        }`}
                >
                    {selected === 'doctor' && (
                        <span className="absolute top-4 left-4 material-symbols-outlined text-[20px] text-white bg-white/20 rounded-full p-0.5">
                            check_circle
                        </span>
                    )}
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 text-4xl
                        ${selected === 'doctor' ? 'bg-white/20' : 'bg-[#ecfdf5]'}`}>
                        👨‍⚕️
                    </div>
                    <h2 className="text-xl font-bold mb-2">أنا طبيب</h2>
                    <p className={`text-sm leading-relaxed ${selected === 'doctor' ? 'text-white/80' : 'text-gray-500'}`}>
                        أقدم خدماتي الطبية وأدير مواعيدي من خلال منصة SAGE.
                    </p>
                </button>
            </div>

            {/* Error message */}
            {error && (
                <p className="mb-4 text-sm font-bold text-red-600 text-center">{error}</p>
            )}

            {/* Continue Button */}
            <button
                onClick={handleContinue}
                disabled={!selected || loading}
                className={`w-full max-w-sm py-4 rounded-2xl text-base font-bold transition-all duration-200
                    ${selected && !loading
                        ? 'bg-[#134e3a] text-white hover:bg-[#0d3d2c] shadow-lg hover:shadow-xl'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
            >
                {loading ? 'جاري الإعداد...' : 'متابعة'}
            </button>

            <p className="mt-6 text-xs text-gray-400 text-center max-w-sm">
                يمكنك تغيير إعدادات حسابك لاحقاً من صفحة الملف الشخصي.
            </p>
        </div>
    );
};

export default RoleSelection;

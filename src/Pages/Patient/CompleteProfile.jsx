import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { completeMedicalProfile } from '../../Services/patientService';
import Notification from '../../components/notifications';

// FIX (C-04): was importing the dead `showNotification` (which called alert()).
// Now uses the proper <Notification> component + useState, consistent with all other pages.

const CompleteProfile = () => {
    const navigate = useNavigate();
    const [loading, setLoading]           = useState(false);
    const [notification, setNotification] = useState(null);

    const [formData, setFormData] = useState({
        bloodType:          '',
        weight:             '',
        height:             '',
        city:               '',
        emergencyContact:   '',
        chronicDiseases:    '',
        allergies:          '',
        currentMedications: '',
        pastSurgeries:      '',
        familyHistory:      '',
    });

    // FIX (M-06): centralised onChange — all inputs are now controlled via value={formData.field}
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (notification) setNotification(null);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const form = e.target.form;
            const index = Array.prototype.indexOf.call(form.elements, e.target);
            const next  = form.elements[index + 1];
            if (next && next.tagName !== 'BUTTON') {
                next.focus();
            }
        }
    };

    // الباك-إند (updateHealthInfo) يرفض chronicDiseases/allergies إذا لم تكن Array،
    // ويرفض bloodType الفارغ — لذلك نقسم النصوص على الفواصل ونحذف الحقول الفارغة
    const splitList = (val) =>
        val.split(/[،,]/).map((s) => s.trim()).filter(Boolean);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setNotification(null);

        try {
            const payload = {
                chronicDiseases: splitList(formData.chronicDiseases),
                allergies:       splitList(formData.allergies),
            };
            if (formData.bloodType)          payload.bloodType          = formData.bloodType;
            if (formData.weight)             payload.weight             = Number(formData.weight);
            if (formData.height)             payload.height             = Number(formData.height);
            if (formData.city)               payload.city               = formData.city.trim();
            if (formData.emergencyContact)   payload.emergencyContact   = formData.emergencyContact.trim();
            if (formData.currentMedications) payload.currentMedications = formData.currentMedications.trim();
            if (formData.pastSurgeries)      payload.pastSurgeries      = formData.pastSurgeries.trim();
            if (formData.familyHistory)      payload.familyHistory      = formData.familyHistory.trim();

            await completeMedicalProfile(payload);
            setNotification({ type: 'success', message: 'تم توثيق ملفك الطبي بنجاح!' });
            setTimeout(() => navigate('/dashboard'), 1500);
        } catch (err) {
            // FIX (H-05): patientService now throws a real Error object, so err.message is always a string
            setNotification({ type: 'error', message: err.message || 'حدث خطأ غير متوقع' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen w-full flex flex-col md:flex-row font-['Cairo'] bg-[#e4efe9] overflow-hidden">

            {/* Visual side */}
            <div className="hidden md:flex md:w-[40%] relative bg-[#134e3a] flex-col p-12 justify-between overflow-hidden">
                <div
                    className="absolute inset-0 z-0 opacity-30 bg-cover bg-center"
                    style={{ backgroundImage: `url('https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1000&q=80')` }}
                    aria-hidden="true"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-[#134e3a] via-[#134e3a]/80 to-transparent z-10" />

                <div className="relative z-20 flex items-center gap-4">
                    <div className="w-12 h-12 border-2 border-white/80 rounded-2xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-white text-2xl">medical_services</span>
                    </div>
                    <span className="text-4xl font-black text-white tracking-tight uppercase">SAGE</span>
                </div>

                <div className="relative z-20 text-right">
                    <h1 className="text-5xl font-black text-white leading-tight mb-4">
                        مرحباً بك <br/>
                        <span className="text-emerald-400">في عائلتنا الرقمية</span>
                    </h1>
                    <p className="text-lg text-emerald-50/80 leading-relaxed">
                        لقد أتممت التسجيل بنجاح! الآن، لنبني "هويتك الصحية" التي سترافقك في كل كشف واستشارة.
                    </p>
                </div>

                <div className="relative z-20 grid grid-cols-2 gap-6 border-t border-white/10 pt-8">
                    <div>
                        <h4 className="text-2xl font-bold text-white">100%</h4>
                        <p className="text-xs text-emerald-200/60 font-bold uppercase">خصوصية مشفرة</p>
                    </div>
                    <div>
                        <h4 className="text-2xl font-bold text-white">24/7</h4>
                        <p className="text-xs text-emerald-200/60 font-bold uppercase">وصول لبياناتك</p>
                    </div>
                </div>
            </div>

            {/* Form side */}
            <div className="w-full md:w-[60%] h-full bg-[#f0f7f3] flex flex-col p-8 md:p-12 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-emerald-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-emerald-500 [scrollbar-width:thin] [scrollbar-color:rgba(52,211,153,0.7)_transparent]">
                <div className="w-full max-w-3xl mx-auto flex flex-col h-full">

                    <div className="mb-8 text-right">
                        <span className="bg-emerald-50 text-emerald-700 px-4 py-1 rounded-full text-xs font-bold mb-3 inline-block">الخطوة الأخيرة</span>
                        <h2 className="text-4xl font-black text-gray-900 italic">توثيق الملف الطبي</h2>
                        <p className="text-gray-400 mt-2">أكمل بياناتك لنقوم بتخصيص تجربتك الصحية بدقة</p>
                    </div>

                    {/* FIX (C-04): Notification component replaces alert() */}
                    {notification && (
                        <div className="mb-6">
                            <Notification notification={notification} />
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between text-right" dir="rtl">

                        <div className="space-y-8">

                            {/* Vitals */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                                    <h3 className="font-bold text-gray-800">العلامات الحيوية والأساسيات</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <label htmlFor="bloodType" className="text-sm font-bold text-gray-500 mr-1">فصيلة الدم</label>
                                        {/* FIX (M-06): value prop added — input is now controlled */}
                                        <select
                                            id="bloodType"
                                            name="bloodType"
                                            value={formData.bloodType}
                                            onChange={handleChange}
                                            onKeyDown={handleKeyDown}
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-sm"
                                        >
                                            <option value="">اختر..</option>
                                            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="weight" className="text-sm font-bold text-gray-500 mr-1">الوزن (كجم)</label>
                                        <input
                                            id="weight"
                                            name="weight"
                                            type="number"
                                            min="1"
                                            placeholder="00"
                                            value={formData.weight}
                                            onChange={handleChange}
                                            onKeyDown={handleKeyDown}
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none shadow-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="height" className="text-sm font-bold text-gray-500 mr-1">الطول (سم)</label>
                                        <input
                                            id="height"
                                            name="height"
                                            type="number"
                                            min="1"
                                            placeholder="000"
                                            value={formData.height}
                                            onChange={handleChange}
                                            onKeyDown={handleKeyDown}
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* City + Emergency */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label htmlFor="city" className="text-sm font-bold text-gray-500 mr-1">المدينة</label>
                                    <input
                                        id="city"
                                        name="city"
                                        type="text"
                                        placeholder="مثلاً: القاهرة، الإسكندرية..."
                                        value={formData.city}
                                        onChange={handleChange}
                                        onKeyDown={handleKeyDown}
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none shadow-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="emergencyContact" className="text-sm font-bold text-gray-500 mr-1">رقم الطوارئ</label>
                                    <input
                                        id="emergencyContact"
                                        name="emergencyContact"
                                        type="text"
                                        placeholder="أقرب شخص لك"
                                        value={formData.emergencyContact}
                                        onChange={handleChange}
                                        onKeyDown={handleKeyDown}
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Chronic + Allergies (both comma-separated lists) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label htmlFor="chronicDiseases" className="text-sm font-bold text-gray-500 mr-1">الأمراض المزمنة (مفصولة بفاصلة)</label>
                                    <input
                                        id="chronicDiseases"
                                        name="chronicDiseases"
                                        type="text"
                                        placeholder="مثلاً: ضغط، سكري..."
                                        value={formData.chronicDiseases}
                                        onChange={handleChange}
                                        onKeyDown={handleKeyDown}
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none shadow-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="allergies" className="text-sm font-bold text-gray-500 mr-1">الحساسية (مفصولة بفاصلة)</label>
                                    <input
                                        id="allergies"
                                        name="allergies"
                                        type="text"
                                        placeholder="مثلاً: البنسلين، المكسرات..."
                                        value={formData.allergies}
                                        onChange={handleChange}
                                        onKeyDown={handleKeyDown}
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Current medications + Past surgeries */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label htmlFor="currentMedications" className="text-sm font-bold text-gray-500 mr-1">الأدوية الحالية</label>
                                    <input
                                        id="currentMedications"
                                        name="currentMedications"
                                        type="text"
                                        placeholder="أدوية تتناولها بانتظام..."
                                        value={formData.currentMedications}
                                        onChange={handleChange}
                                        onKeyDown={handleKeyDown}
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none shadow-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="pastSurgeries" className="text-sm font-bold text-gray-500 mr-1">عمليات جراحية سابقة</label>
                                    <input
                                        id="pastSurgeries"
                                        name="pastSurgeries"
                                        type="text"
                                        placeholder="اذكر العمليات إن وجدت"
                                        value={formData.pastSurgeries}
                                        onChange={handleChange}
                                        onKeyDown={handleKeyDown}
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Family history */}
                            <div className="space-y-2">
                                <label htmlFor="familyHistory" className="text-sm font-bold text-gray-500 mr-1">التاريخ العائلي المرضي</label>
                                <input
                                    id="familyHistory"
                                    name="familyHistory"
                                    type="text"
                                    placeholder="أمراض وراثية في العائلة؟"
                                    value={formData.familyHistory}
                                    onChange={handleChange}
                                    onKeyDown={handleKeyDown}
                                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none shadow-sm"
                                />
                            </div>
                        </div>

                        <div className="mt-12 pt-6 border-t border-gray-50">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#134e3a] text-white py-5 rounded-2xl font-black text-xl hover:bg-[#0d3b2c] transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-900/10 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? 'جاري الحفظ...' : 'حفظ الهوية الصحية ←'}
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/dashboard')}
                                className="w-full text-gray-400 text-sm font-bold hover:text-gray-600 transition-colors py-4 block text-center"
                            >
                                إكمال لاحقاً
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CompleteProfile;
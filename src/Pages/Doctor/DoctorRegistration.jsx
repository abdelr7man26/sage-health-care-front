import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import Notification from '../../components/notifications';
import { SPECIALIZATIONS } from '../../constants/specialties';

const DEGREES = [
    'بكالوريوس الطب والجراحة (MB.BCh)',
    'ماجستير (M.Sc.)',
    'دكتوراه (M.D. / Ph.D.)',
    'دبلوم تخصصي',
    'بورد عربي',
    'بورد أمريكي (USMLE)',
    'بورد أوروبي',
    'زمالة (Fellowship)',
    'استشاري',
];

const CITIES = [
    'القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'البحيرة', 'الشرقية',
    'المنوفية', 'القليوبية', 'الغربية', 'كفر الشيخ', 'دمياط', 'بورسعيد',
    'الإسماعيلية', 'السويس', 'شمال سيناء', 'جنوب سيناء', 'الفيوم',
    'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان',
    'البحر الأحمر', 'الوادي الجديد', 'مطروح',
];

const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SIZE_MB   = 10;

const inputCls = 'w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-sm text-gray-800 placeholder:text-gray-400';
const labelCls = 'text-sm font-bold text-gray-500 mr-1';

function SectionTitle({ icon, title }) {
    return (
        <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />
            <span className="material-symbols-outlined text-[#134e3a] text-[18px]">{icon}</span>
            <h3 className="font-bold text-gray-800">{title}</h3>
        </div>
    );
}

// ── File upload input component ───────────────────────────────────────────────

function FileInput({ label, name, required = true, multiple = false, file, files, onChange, hint }) {
    const ref = useRef();
    const count  = multiple ? (files?.length ?? 0) : (file ? 1 : 0);

    const validate = (f) => {
        if (!ACCEPTED_MIME.includes(f.type))
            return `${f.name}: نوع الملف غير مسموح به (PDF، JPEG، PNG فقط)`;
        if (f.size > MAX_SIZE_MB * 1024 * 1024)
            return `${f.name}: حجم الملف يتجاوز ${MAX_SIZE_MB} MB`;
        return null;
    };

    const handleChange = (e) => {
        const picked = Array.from(e.target.files || []);
        for (const f of picked) {
            const err = validate(f);
            if (err) { alert(err); e.target.value = ''; return; }
        }
        onChange(name, multiple ? picked : picked[0] || null);
    };

    return (
        <div className="space-y-2">
            <label className={labelCls}>
                {label} {required && <span className="text-red-400">*</span>}
            </label>
            <div
                onClick={() => ref.current?.click()}
                className={`w-full border-2 border-dashed rounded-2xl p-4 cursor-pointer transition-all
                    ${count > 0
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-gray-200 bg-gray-50 hover:border-emerald-300 hover:bg-emerald-50/40'}`}
            >
                <input
                    ref={ref}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    multiple={multiple}
                    onChange={handleChange}
                    className="hidden"
                />
                <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-[28px] ${count > 0 ? 'text-emerald-500' : 'text-gray-400'}`}>
                        {count > 0 ? 'task' : 'upload_file'}
                    </span>
                    <div className="text-right">
                        {count > 0 ? (
                            <p className="text-sm font-bold text-emerald-700">
                                {multiple
                                    ? `${count} ملف محدد`
                                    : (file?.name?.length > 30 ? file.name.slice(0, 30) + '…' : file?.name)}
                            </p>
                        ) : (
                            <p className="text-sm font-semibold text-gray-500">
                                {multiple ? 'اضغط لاختيار ملفات' : 'اضغط لاختيار ملف'}
                            </p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                            {hint || `PDF، JPEG أو PNG — حتى ${MAX_SIZE_MB} MB`}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Status screen shown when doctor already has an application ────────────────

const STATUS_UI = {
    approved: {
        icon: 'verified',
        iconBg: 'bg-emerald-50',
        iconColor: 'text-[#134e3a]',
        title: 'تم قبول طلبك!',
        titleColor: 'text-[#134e3a]',
        desc: 'حسابك مفعّل كطبيب. يمكنك الآن الوصول إلى لوحة تحكم الطبيب وإدارة مواعيدك.',
        btnLabel: 'الذهاب للوحة التحكم',
        btnRoute: '/doctor-dashboard',
    },
    pending: {
        icon: 'pending',
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-500',
        title: 'طلبك في الانتظار',
        titleColor: 'text-gray-900',
        desc: 'تم استلام طلبك وسيُراجَع من قِبل فريق SAGE خلال 3–5 أيام عمل.',
        btnLabel: 'العودة للوحة التحكم',
        btnRoute: '/dashboard',
    },
    under_review: {
        icon: 'manage_search',
        iconBg: 'bg-indigo-50',
        iconColor: 'text-indigo-600',
        title: 'طلبك قيد المراجعة',
        titleColor: 'text-indigo-800',
        desc: 'يقوم فريق الإدارة حالياً بمراجعة بياناتك ومستنداتك. ستصلك رسالة فور انتهاء المراجعة.',
        btnLabel: 'العودة للوحة التحكم',
        btnRoute: '/dashboard',
    },
    rejected: null, // allow re-apply — no status screen shown
    not_submitted: null,
};

function AlreadyAppliedScreen({ app, onReapply, navigate }) {
    const status = app.verificationStatus || (app.isApproved ? 'approved' : 'pending');
    const ui     = STATUS_UI[status];

    if (!ui) {
        // rejected or not_submitted → show re-apply prompt
        return (
            <div className="h-screen w-full flex items-center justify-center font-['Cairo'] bg-[#f8faf9] p-6">
                <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-12 max-w-md w-full text-center">
                    <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-[48px] text-red-400">cancel</span>
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 mb-3">تم رفض طلبك السابق</h1>
                    {app.verificationRejectionReason && (
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-right">
                            <p className="text-xs font-bold text-red-600 mb-1">سبب الرفض:</p>
                            <p className="text-sm text-red-700 leading-relaxed">{app.verificationRejectionReason}</p>
                        </div>
                    )}
                    <p className="text-gray-500 text-sm leading-relaxed mb-8">
                        يمكنك تصحيح بياناتك ومستنداتك وإعادة التقديم مرة أخرى.
                    </p>
                    <button
                        onClick={onReapply}
                        className="w-full bg-[#134e3a] text-white py-5 rounded-2xl font-black text-lg hover:bg-[#0d3b2c] transition-all shadow-xl shadow-emerald-900/10 active:scale-[0.98] mb-3"
                    >
                        إعادة التقديم ←
                    </button>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="w-full text-gray-400 text-sm font-bold hover:text-gray-600 transition-colors py-3"
                    >
                        العودة للوحة التحكم
                    </button>
                </div>
            </div>
        );
    }

    const appliedDate = app.verificationSubmittedAt
        ? new Date(app.verificationSubmittedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
        : null;

    return (
        <div className="h-screen w-full flex items-center justify-center font-['Cairo'] bg-[#f8faf9] p-6">
            <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-12 max-w-md w-full text-center">
                <div className={`w-20 h-20 rounded-full ${ui.iconBg} flex items-center justify-center mx-auto mb-6`}>
                    <span className={`material-symbols-outlined text-[48px] ${ui.iconColor}`}>{ui.icon}</span>
                </div>
                <h1 className={`text-2xl font-black ${ui.titleColor} mb-3`}>{ui.title}</h1>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">{ui.desc}</p>

                {status !== 'approved' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 text-right space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-500 text-[18px]">schedule</span>
                            <p className="text-amber-800 text-sm font-bold">المراجعة تستغرق 3–5 أيام عمل</p>
                        </div>
                        {appliedDate && (
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-amber-400 text-[18px]">calendar_today</span>
                                <p className="text-amber-700 text-sm">تاريخ التقديم: <strong>{appliedDate}</strong></p>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-400 text-[18px]">mail</span>
                            <p className="text-amber-700 text-sm">ستصلك رسالة بريد إلكتروني عند الرد</p>
                        </div>
                    </div>
                )}

                <button
                    onClick={() => navigate(ui.btnRoute)}
                    className="w-full bg-[#134e3a] text-white py-5 rounded-2xl font-black text-lg hover:bg-[#0d3b2c] transition-all shadow-xl shadow-emerald-900/10 active:scale-[0.98]"
                >
                    {ui.btnLabel} ←
                </button>
                {status !== 'approved' && (
                    <button
                        onClick={() => navigate(-1)}
                        className="w-full text-gray-400 text-sm font-bold hover:text-gray-600 transition-colors py-3 block text-center"
                    >
                        العودة للخلف
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

const DoctorRegistration = () => {
    const navigate = useNavigate();

    // Text fields
    const [formData, setFormData] = useState({
        specialization:  '',
        degree:          '',
        bio:             '',
        consultationFee: '',
        licenseNumber:   '',
        licenseExpiryDate: '',
        city:            '',
        area:            '',
        fullAddress:     '',
    });

    // File fields
    const [files, setFiles] = useState({
        medicalLicense:       null,   // File object
        nationalIdFront:      null,   // File object
        nationalIdBack:       null,   // File object
        optionalCertificates: [],     // File[]
    });

    const [loading,      setLoading]      = useState(false);
    const [notification, setNotification] = useState(null);
    const [submitted,    setSubmitted]    = useState(false);
    const [checkingApp,  setCheckingApp]  = useState(true);
    const [existingApp,  setExistingApp]  = useState(null);
    const [showForm,     setShowForm]     = useState(false); // true when re-applying after rejection

    useEffect(() => {
        axiosInstance.get('/auth/my-application')
            .then(({ data }) => { if (data.exists) setExistingApp(data); })
            .catch(() => {})
            .finally(() => setCheckingApp(false));
    }, []);

    const handleTextChange = (e) => {
        const { name, value } = e.target;
        setFormData((p) => ({ ...p, [name]: value }));
        if (notification) setNotification(null);
    };

    const handleFileChange = (name, value) => {
        setFiles((p) => ({ ...p, [name]: value }));
        if (notification) setNotification(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // ── Validation ──────────────────────────────────────────────────────
        if (!formData.specialization)
            return setNotification({ type: 'error', message: 'يرجى اختيار التخصص الطبي' });
        if (!formData.degree)
            return setNotification({ type: 'error', message: 'يرجى اختيار الدرجة العلمية' });
        if (formData.bio.trim().length < 20)
            return setNotification({ type: 'error', message: 'النبذة التعريفية يجب أن تكون 20 حرفاً على الأقل' });
        if (!formData.consultationFee || Number(formData.consultationFee) < 0)
            return setNotification({ type: 'error', message: 'يرجى إدخال سعر الكشف' });
        if (!formData.licenseNumber.trim())
            return setNotification({ type: 'error', message: 'رقم الترخيص الطبي مطلوب' });
        if (!formData.licenseExpiryDate)
            return setNotification({ type: 'error', message: 'تاريخ انتهاء الترخيص مطلوب' });
        if (new Date(formData.licenseExpiryDate) <= new Date())
            return setNotification({ type: 'error', message: 'تاريخ انتهاء الترخيص يجب أن يكون في المستقبل' });
        if (!formData.city)
            return setNotification({ type: 'error', message: 'يرجى اختيار المدينة' });
        if (!formData.area.trim())
            return setNotification({ type: 'error', message: 'يرجى إدخال المنطقة أو الحي' });
        if (!formData.fullAddress.trim())
            return setNotification({ type: 'error', message: 'يرجى إدخال العنوان التفصيلي للعيادة' });

        if (!files.medicalLicense)
            return setNotification({ type: 'error', message: 'يجب رفع صورة/مستند الترخيص الطبي' });
        if (!files.nationalIdFront)
            return setNotification({ type: 'error', message: 'يجب رفع الوجه الأمامي للبطاقة الشخصية' });
        if (!files.nationalIdBack)
            return setNotification({ type: 'error', message: 'يجب رفع الوجه الخلفي للبطاقة الشخصية' });

        // ── Build FormData ───────────────────────────────────────────────────
        const fd = new FormData();
        fd.append('specialization',  formData.specialization);
        fd.append('degree',          formData.degree);
        fd.append('bio',             formData.bio.trim());
        fd.append('consultationFee', formData.consultationFee);
        fd.append('licenseNumber',   formData.licenseNumber.trim());
        fd.append('licenseExpiryDate', formData.licenseExpiryDate);
        fd.append('address', JSON.stringify({
            city:        formData.city,
            area:        formData.area.trim(),
            fullAddress: formData.fullAddress.trim(),
        }));
        fd.append('medicalLicense',   files.medicalLicense);
        fd.append('nationalIdFront',  files.nationalIdFront);
        fd.append('nationalIdBack',   files.nationalIdBack);
        files.optionalCertificates.forEach((f) => fd.append('optionalCertificates', f));

        setLoading(true);
        setNotification(null);
        try {
            await axiosInstance.post('/auth/apply-doctor', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setSubmitted(true);
        } catch (err) {
            const msg = err.response?.data?.message || 'فشل إرسال الطلب، يرجى المحاولة مرة أخرى';
            setNotification({ type: 'error', message: msg });
        } finally {
            setLoading(false);
        }
    };

    // ── Loading state ──────────────────────────────────────────────────────────
    if (checkingApp) {
        return (
            <div className="h-screen w-full flex items-center justify-center font-['Cairo'] bg-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#134e3a] flex items-center justify-center shadow-md">
                        <span className="material-symbols-outlined text-white text-2xl animate-pulse">stethoscope</span>
                    </div>
                    <p className="text-gray-500 text-sm font-medium">جارٍ التحقق من حالة طلبك…</p>
                </div>
            </div>
        );
    }

    // ── Already applied (not re-applying) ─────────────────────────────────────
    const status = existingApp?.verificationStatus || (existingApp?.isApproved ? 'approved' : null);
    if (existingApp && !showForm && status !== 'rejected') {
        return (
            <AlreadyAppliedScreen
                app={existingApp}
                navigate={navigate}
                onReapply={() => setShowForm(true)}
            />
        );
    }
    // rejected → show re-apply prompt first, then form on button click
    if (existingApp && status === 'rejected' && !showForm) {
        return (
            <AlreadyAppliedScreen
                app={existingApp}
                navigate={navigate}
                onReapply={() => setShowForm(true)}
            />
        );
    }

    // ── Success screen ─────────────────────────────────────────────────────────
    if (submitted) {
        return (
            <div className="h-screen w-full flex items-center justify-center font-['Cairo'] bg-white p-6">
                <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-12 max-w-md w-full text-center">
                    <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-[48px] text-[#134e3a]">verified</span>
                    </div>
                    <h1 className="text-2xl font-black text-[#134e3a] mb-3">تم إرسال طلبك بنجاح!</h1>
                    <p className="text-gray-500 text-sm leading-relaxed mb-8">
                        سيقوم فريق SAGE بمراجعة بياناتك ومستنداتك خلال{' '}
                        <strong className="text-[#134e3a]">3–5 أيام عمل</strong>.
                        ستصلك رسالة بريد إلكتروني عند الموافقة على حسابك كطبيب.
                    </p>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-8 text-right">
                        <p className="text-amber-800 text-xs font-bold mb-1">⏳ في انتظار المراجعة</p>
                        <p className="text-amber-700 text-xs leading-relaxed">
                            يمكنك الاستمرار في استخدام المنصة كمريض حتى يتم تفعيل حسابك كطبيب.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="w-full bg-[#134e3a] text-white py-5 rounded-2xl font-black text-lg hover:bg-[#0d3b2c] transition-all shadow-xl shadow-emerald-900/10 active:scale-[0.98]"
                    >
                        الذهاب للوحة التحكم ←
                    </button>
                </div>
            </div>
        );
    }

    // ── Registration form ──────────────────────────────────────────────────────
    return (
        <div className="h-screen w-full flex flex-col md:flex-row font-['Cairo'] bg-white overflow-hidden">

            {/* ── LEFT: Visual panel ── */}
            <div className="hidden md:flex md:w-[40%] relative bg-[#134e3a] flex-col p-12 justify-between overflow-hidden">
                <div
                    className="absolute inset-0 z-0 opacity-30 bg-cover bg-center"
                    style={{ backgroundImage: `url('https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=1000&q=80')` }}
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
                    <span className="bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 px-4 py-1 rounded-full text-xs font-bold mb-4 inline-block">
                        انضمام كطبيب
                    </span>
                    <h1 className="text-5xl font-black text-white leading-tight mb-4">
                        وثّق خبرتك،<br />
                        <span className="text-emerald-400">وابدأ رحلتك معنا</span>
                    </h1>
                    <p className="text-lg text-emerald-50/80 leading-relaxed">
                        منصة SAGE تجمع بين الطبيب والمريض بذكاء — أدر عيادتك، تابع مواعيدك، وقدّم رعاية استثنائية.
                    </p>
                </div>

                <div className="relative z-20 grid grid-cols-2 gap-6 border-t border-white/10 pt-8">
                    <div>
                        <h4 className="text-2xl font-bold text-white">+500</h4>
                        <p className="text-xs text-emerald-200/60 font-bold uppercase">طبيب موثّق</p>
                    </div>
                    <div>
                        <h4 className="text-2xl font-bold text-white">3–5</h4>
                        <p className="text-xs text-emerald-200/60 font-bold uppercase">أيام للمراجعة</p>
                    </div>
                    <div>
                        <h4 className="text-2xl font-bold text-white">100%</h4>
                        <p className="text-xs text-emerald-200/60 font-bold uppercase">خصوصية مشفرة</p>
                    </div>
                    <div>
                        <h4 className="text-2xl font-bold text-white">24/7</h4>
                        <p className="text-xs text-emerald-200/60 font-bold uppercase">دعم فني</p>
                    </div>
                </div>
            </div>

            {/* ── RIGHT: Form ── */}
            <div className="w-full md:w-[60%] h-full bg-white flex flex-col p-8 md:p-12 overflow-y-auto">
                <div className="w-full max-w-3xl mx-auto flex flex-col h-full">

                    <div className="mb-8 text-right">
                        <span className="bg-emerald-50 text-emerald-700 px-4 py-1 rounded-full text-xs font-bold mb-3 inline-block">
                            توثيق الهوية المهنية
                        </span>
                        <h2 className="text-4xl font-black text-gray-900 italic">تسجيل الطبيب</h2>
                        <p className="text-gray-400 mt-2">أكمل بياناتك المهنية وارفع مستنداتك لنتحقق من هويتك</p>
                    </div>

                    {notification && (
                        <div className="mb-6">
                            <Notification notification={notification} />
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between text-right" dir="rtl">
                        <div className="space-y-8">

                            {/* ── Section 1: Professional Info ── */}
                            <div className="space-y-4">
                                <SectionTitle icon="badge" title="البيانات المهنية" />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className={labelCls}>التخصص الطبي <span className="text-red-400">*</span></label>
                                        <select name="specialization" value={formData.specialization} onChange={handleTextChange} className={inputCls}>
                                            <option value="">اختر تخصصك...</option>
                                            {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className={labelCls}>الدرجة العلمية <span className="text-red-400">*</span></label>
                                        <select name="degree" value={formData.degree} onChange={handleTextChange} className={inputCls}>
                                            <option value="">اختر درجتك العلمية...</option>
                                            {DEGREES.map((d) => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className={labelCls}>
                                        النبذة التعريفية <span className="text-red-400">*</span>
                                        <span className="text-gray-300 font-normal mr-2">({formData.bio.length}/500)</span>
                                    </label>
                                    <textarea
                                        name="bio"
                                        value={formData.bio}
                                        onChange={handleTextChange}
                                        rows={3}
                                        maxLength={500}
                                        placeholder="اكتب نبذة عن خبرتك ومجالاتك الطبية..."
                                        className={inputCls + ' resize-none h-28'}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className={labelCls}>سعر الكشف (جنيه مصري) <span className="text-red-400">*</span></label>
                                    <input type="number" name="consultationFee" value={formData.consultationFee}
                                        onChange={handleTextChange} min="0" placeholder="مثال: 300" className={inputCls} />
                                </div>
                            </div>

                            {/* ── Section 2: License Info ── */}
                            <div className="space-y-4">
                                <SectionTitle icon="assignment_ind" title="بيانات الترخيص" />

                                <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex items-start gap-3">
                                    <span className="material-symbols-outlined text-blue-400 text-[20px] mt-0.5 shrink-0">info</span>
                                    <p className="text-blue-700 text-sm leading-relaxed">
                                        هذه البيانات تُستخدم فقط للتحقق من هويتك الطبية ولن تُعرض للعامة أبداً.
                                        يتم تخزين مستنداتك بشكل آمن ومشفر.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className={labelCls}>رقم ترخيص مزاولة المهنة <span className="text-red-400">*</span></label>
                                        <input type="text" name="licenseNumber" value={formData.licenseNumber}
                                            onChange={handleTextChange} placeholder="مثال: 12345/2020" className={inputCls} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className={labelCls}>تاريخ انتهاء الترخيص <span className="text-red-400">*</span></label>
                                        <input type="date" name="licenseExpiryDate" value={formData.licenseExpiryDate}
                                            onChange={handleTextChange}
                                            min={new Date().toISOString().split('T')[0]}
                                            className={inputCls} />
                                    </div>
                                </div>
                            </div>

                            {/* ── Section 3: Document Uploads ── */}
                            <div className="space-y-4">
                                <SectionTitle icon="upload_file" title="رفع المستندات" />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FileInput
                                        label="مستند الترخيص الطبي"
                                        name="medicalLicense"
                                        file={files.medicalLicense}
                                        onChange={handleFileChange}
                                        hint="ترخيص مزاولة المهنة — PDF أو صورة"
                                    />
                                    <FileInput
                                        label="البطاقة الشخصية (الوجه الأمامي)"
                                        name="nationalIdFront"
                                        file={files.nationalIdFront}
                                        onChange={handleFileChange}
                                        hint="صورة واضحة للوجه الأمامي"
                                    />
                                </div>

                                <FileInput
                                    label="البطاقة الشخصية (الوجه الخلفي)"
                                    name="nationalIdBack"
                                    file={files.nationalIdBack}
                                    onChange={handleFileChange}
                                    hint="صورة واضحة للوجه الخلفي"
                                />

                                <FileInput
                                    label="شهادات إضافية (اختياري)"
                                    name="optionalCertificates"
                                    required={false}
                                    multiple={true}
                                    files={files.optionalCertificates}
                                    onChange={handleFileChange}
                                    hint="بورد، زمالة، شهادات تخصص — PDF أو صورة (حتى 5 ملفات)"
                                />
                            </div>

                            {/* ── Section 4: Clinic Address ── */}
                            <div className="space-y-4">
                                <SectionTitle icon="location_on" title="عنوان العيادة" />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className={labelCls}>المدينة <span className="text-red-400">*</span></label>
                                        <select name="city" value={formData.city} onChange={handleTextChange} className={inputCls}>
                                            <option value="">اختر المدينة...</option>
                                            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className={labelCls}>المنطقة / الحي <span className="text-red-400">*</span></label>
                                        <input type="text" name="area" value={formData.area}
                                            onChange={handleTextChange} placeholder="مثال: المعادي، مدينة نصر" className={inputCls} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className={labelCls}>العنوان التفصيلي <span className="text-red-400">*</span></label>
                                    <input type="text" name="fullAddress" value={formData.fullAddress}
                                        onChange={handleTextChange} placeholder="المبنى، الدور، رقم العيادة، الشارع..." className={inputCls} />
                                </div>
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="mt-12 pt-6 border-t border-gray-50">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#134e3a] text-white py-5 rounded-2xl font-black text-xl hover:bg-[#0d3b2c] transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-900/10 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        جاري الرفع والإرسال...
                                    </>
                                ) : 'إرسال الطلب للمراجعة ←'}
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="w-full text-gray-400 text-sm font-bold hover:text-gray-600 transition-colors py-4 block text-center"
                            >
                                العودة للخلف
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default DoctorRegistration;

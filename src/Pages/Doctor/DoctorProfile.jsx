/**
 * DoctorProfile.jsx — doctor's own profile management page.
 *
 * Three sections accessed via sidebar nav:
 *   البيانات الشخصية — read-only account info + profile picture upload
 *   بيانات العيادة   — editable professional details; any edit resets isApproved
 *                       so the admin must re-verify before the profile goes live
 *   تغيير كلمة المرور — 3-step OTP flow: request → verify code → set new password
 *
 * Profile picture is updated independently via a dedicated PUT endpoint that
 * returns the new path, then AuthContext is synced so the sidebar avatar
 * reflects the change immediately without a full page reload.
 */
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import Footer from '../../components/Footer';

const ClinicMapPicker = lazy(() => import('../../components/ClinicMapPicker'));

const SERVER_BASE = new URL(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').origin;

const MENU = [
    { id: 'personal',   label: 'البيانات الشخصية',  icon: 'person'         },
    { id: 'clinic',     label: 'بيانات العيادة',      icon: 'local_hospital' },
    { id: 'password',   label: 'تغيير كلمة المرور',  icon: 'lock'           },
    { id: 'secretary',  label: 'إدارة السكرتيرة',    icon: 'badge'          },
];

const getInitials = (name = '') =>
    name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '؟';

const inputCls = [
    'w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800',
    'outline-none transition-all focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100',
    'disabled:opacity-50 disabled:cursor-not-allowed',
].join(' ');

const textareaCls = [
    'w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800',
    'outline-none transition-all focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100',
    'disabled:opacity-50 disabled:cursor-not-allowed resize-none',
].join(' ');

const btnPrimary = [
    'flex items-center justify-center gap-2 bg-[#134e3a] hover:bg-[#0c3326] active:scale-95',
    'text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all',
    'disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100',
].join(' ');

const btnGhost = [
    'flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 active:scale-95',
    'text-gray-700 px-5 py-2.5 rounded-xl text-sm font-bold transition-all',
].join(' ');

function Spinner() {
    return <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>;
}

function SectionCard({ title, icon, action, children }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#134e3a] text-[20px]">{icon}</span>
                    <h3 className="font-bold text-gray-900 text-[15px]">{title}</h3>
                </div>
                {action && <div className="shrink-0">{action}</div>}
            </div>
            <div className="px-6 py-5">{children}</div>
        </div>
    );
}

function InfoRow({ label, value }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
            <span className="text-sm font-medium text-gray-800 leading-relaxed">{value || '—'}</span>
        </div>
    );
}

function Field({ label, className = '', children }) {
    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            <label className="text-xs font-bold text-gray-500">{label}</label>
            {children}
        </div>
    );
}

export default function DoctorProfile() {
    const navigate = useNavigate();
    const { signOut, updateUser } = useAuth();

    const [activeSection, setActiveSection] = useState('personal');

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving,  setSaving]  = useState(false);

    const [toast, setToast] = useState({ msg: '', type: 'success' });
    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast({ msg: '', type: 'success' }), 3500);
    }, []);

    // Defined AFTER showToast to avoid a TDZ ReferenceError in its dependency array.
    const picInputRef    = useRef(null);
    const [uploadingPic, setUploadingPic] = useState(false);

    const handlePicChange = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setUploadingPic(true);
            const fd = new FormData();
            fd.append('profilePicture', file);
            const { data } = await axiosInstance.put('/doctors/update-profile-picture', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setProfile((p) => ({ ...p, user: { ...(p?.user || {}), profilePicture: data.profilePicture } }));
            updateUser({ profilePicture: data.profilePicture });
            showToast('تم تحديث صورتك الشخصية بنجاح ✓');
        } catch (err) {
            showToast(err.response?.data?.message || 'فشل رفع الصورة.', 'error');
        } finally {
            setUploadingPic(false);
            e.target.value = '';
        }
    }, [showToast, updateUser]);

    const [editingClinic, setEditingClinic] = useState(false);

    const [clinicLocation,  setClinicLocation]  = useState(null);
    const [editingMap,      setEditingMap]      = useState(false);
    const [pendingLocation, setPendingLocation] = useState(null);
    const [savingLocation,  setSavingLocation]  = useState(false);
    const [mapFlyTarget,    setMapFlyTarget]    = useState(null);

    const [clinicForm, setClinicForm] = useState({
        specialization:  '',
        degree:          '',
        bio:             '',
        consultationFee: '',
        followUpFee:     '',
        city:            '',
        area:            '',
        fullAddress:     '',
        clinicPhone:     '',
    });

    const [pwStep, setPwStep] = useState(1);
    const [pwForm, setPwForm] = useState({ code: '', newPassword: '', confirmPassword: '' });
    const [pwBusy, setPwBusy] = useState(false);
    const [pwMsg,  setPwMsg]  = useState({ text: '', type: 'success' });
    const [showPw, setShowPw] = useState(false);

    // ── Secretary management ──────────────────────────────────────────────────
    const [secretaries,    setSecretaries]    = useState([]);
    const [secLoading,     setSecLoading]     = useState(false);
    const [showCreateSec,  setShowCreateSec]  = useState(false);
    const [secForm,        setSecForm]        = useState({ name: '', email: '', password: '', phone: '' });
    const [secCreating,    setSecCreating]    = useState(false);
    const [secFormErr,     setSecFormErr]     = useState('');
    const [changePwTarget, setChangePwTarget] = useState(null); // { _id, name }
    const [changePwVal,    setChangePwVal]    = useState('');
    const [changePwBusy,   setChangePwBusy]  = useState(false);
    const [deleteTarget,   setDeleteTarget]   = useState(null); // { _id, name }
    const [deleteBusy,     setDeleteBusy]     = useState(false);

    const fetchSecretaries = useCallback(async () => {
        setSecLoading(true);
        try {
            const { data } = await axiosInstance.get('/doctors/secretaries');
            setSecretaries(data.data || []);
        } catch {
            /* swallow */
        } finally {
            setSecLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeSection === 'secretary') fetchSecretaries();
    }, [activeSection, fetchSecretaries]);

    const createSecretary = async () => {
        setSecFormErr('');
        if (!secForm.name.trim())          { setSecFormErr('الاسم مطلوب');                                        return; }
        if (!secForm.email.trim())         { setSecFormErr('البريد الإلكتروني مطلوب');                             return; }
        if (!secForm.phone.trim())         { setSecFormErr('رقم الهاتف مطلوب');                                    return; }
        if (secForm.password.length < 8)   { setSecFormErr('كلمة المرور 8 أحرف على الأقل');                        return; }
        if (!/[0-9]/.test(secForm.password))  { setSecFormErr('كلمة المرور يجب أن تحتوي على رقم');                return; }
        if (!/[A-Z]/.test(secForm.password))  { setSecFormErr('كلمة المرور يجب أن تحتوي على حرف كبير (A-Z)');    return; }
        setSecCreating(true);
        try {
            const { data } = await axiosInstance.post('/doctors/secretary', secForm);
            setSecretaries(prev => [...prev, data.data]);
            setSecForm({ name: '', email: '', password: '', phone: '' });
            setShowCreateSec(false);
            showToast('تم إنشاء حساب السكرتيرة بنجاح ✓');
        } catch (err) {
            setSecFormErr(err.response?.data?.message || 'حدث خطأ أثناء الإنشاء');
        } finally {
            setSecCreating(false);
        }
    };

    const changeSecPassword = async () => {
        if (!changePwTarget) return;
        if (changePwVal.length < 8)        { showToast('كلمة المرور 8 أحرف على الأقل', 'error');             return; }
        if (!/[0-9]/.test(changePwVal))    { showToast('كلمة المرور يجب أن تحتوي على رقم', 'error');          return; }
        if (!/[A-Z]/.test(changePwVal))    { showToast('كلمة المرور يجب أن تحتوي على حرف كبير (A-Z)', 'error'); return; }
        setChangePwBusy(true);
        try {
            await axiosInstance.patch(`/doctors/secretary/${changePwTarget._id}/password`, { newPassword: changePwVal });
            setChangePwTarget(null);
            setChangePwVal('');
            showToast('تم تغيير كلمة المرور بنجاح ✓');
        } catch (err) {
            showToast(err.response?.data?.message || 'حدث خطأ', 'error');
        } finally {
            setChangePwBusy(false);
        }
    };

    const deleteSecretary = async () => {
        if (!deleteTarget) return;
        setDeleteBusy(true);
        try {
            await axiosInstance.delete(`/doctors/secretary/${deleteTarget._id}`);
            setSecretaries(prev => prev.filter(s => s._id !== deleteTarget._id));
            setDeleteTarget(null);
            showToast('تم حذف حساب السكرتيرة');
        } catch (err) {
            showToast(err.response?.data?.message || 'حدث خطأ', 'error');
        } finally {
            setDeleteBusy(false);
        }
    };

    const fetchProfile = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get('/doctors/me');
            const d   = res.data.data;
            setProfile(d);
            setClinicForm({
                specialization:  d.specialization  || '',
                degree:          d.degree          || '',
                bio:             d.bio             || '',
                consultationFee: d.consultationFee != null ? String(d.consultationFee) : '',
                followUpFee:     d.followUpFee     != null ? String(d.followUpFee)     : '',
                city:            d.address?.city        || '',
                area:            d.address?.area        || '',
                fullAddress:     d.address?.fullAddress  || '',
                clinicPhone:     d.address?.clinicPhone  || '',
            });
            setClinicLocation(
                d.clinicLocation?.lat != null
                    ? { lat: d.clinicLocation.lat, lon: d.clinicLocation.lon }
                    : null
            );
        } catch {
            showToast('تعذر تحميل بيانات الملف الشخصي.', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { fetchProfile(); }, [fetchProfile]);

    const saveClinicInfo = async () => {
        if (!clinicForm.specialization.trim()) { showToast('التخصص مطلوب.', 'error'); return; }
        if (!clinicForm.degree.trim())         { showToast('الدرجة العلمية مطلوبة.', 'error'); return; }
        if (!clinicForm.bio.trim())            { showToast('النبذة التعريفية مطلوبة.', 'error'); return; }
        if (!clinicForm.consultationFee || isNaN(Number(clinicForm.consultationFee))) {
            showToast('سعر الكشف يجب أن يكون رقماً.', 'error'); return;
        }
        if (!clinicForm.city.trim())        { showToast('المدينة مطلوبة.', 'error'); return; }
        if (!clinicForm.area.trim())        { showToast('المنطقة مطلوبة.', 'error'); return; }
        if (!clinicForm.fullAddress.trim()) { showToast('العنوان التفصيلي مطلوب.', 'error'); return; }

        try {
            setSaving(true);
            const payload = {
                specialization:  clinicForm.specialization,
                degree:          clinicForm.degree,
                bio:             clinicForm.bio,
                consultationFee: Number(clinicForm.consultationFee),
                followUpFee:     clinicForm.followUpFee !== '' ? Number(clinicForm.followUpFee) : null,
                address: {
                    city:        clinicForm.city,
                    area:        clinicForm.area,
                    fullAddress: clinicForm.fullAddress,
                    clinicPhone: clinicForm.clinicPhone || undefined,
                },
            };
            const res = await axiosInstance.put('/doctors/profile', payload);
            setProfile((p) => ({ ...p, ...res.data.data, isApproved: false }));
            setEditingClinic(false);
            showToast('تم حفظ البيانات بنجاح — البيانات قيد المراجعة ✓');
        } catch (err) {
            showToast(err.response?.data?.message || 'حدث خطأ أثناء الحفظ.', 'error');
        } finally { setSaving(false); }
    };

    const saveClinicLocation = async () => {
        if (!pendingLocation) { showToast('حدد موقع العيادة على الخريطة أولاً.', 'error'); return; }
        try {
            setSavingLocation(true);
            await axiosInstance.patch('/doctors/clinic-location', pendingLocation);
            setClinicLocation(pendingLocation);
            setEditingMap(false);
            showToast('تم حفظ موقع العيادة ✓');
        } catch (err) {
            showToast(err.response?.data?.message || 'حدث خطأ أثناء حفظ الموقع.', 'error');
        } finally {
            setSavingLocation(false);
        }
    };

    const requestPwReset = async () => {
        setPwBusy(true); setPwMsg({ text: '', type: 'success' });
        try {
            await axiosInstance.post('/auth/forgot-password', { email: profile?.user?.email });
            setPwStep(2);
            setPwMsg({ text: 'تم إرسال كود التحقق إلى بريدك الإلكتروني.', type: 'success' });
        } catch (err) {
            setPwMsg({ text: err.response?.data?.message || 'حدث خطأ. حاول مرة أخرى.', type: 'error' });
        } finally { setPwBusy(false); }
    };

    const verifyPwCode = async () => {
        if (!pwForm.code) { setPwMsg({ text: 'أدخل كود التحقق.', type: 'error' }); return; }
        setPwBusy(true); setPwMsg({ text: '', type: 'success' });
        try {
            await axiosInstance.post('/auth/verify-reset-code', { email: profile?.user?.email, code: pwForm.code });
            setPwStep(3);
            setPwMsg({ text: 'تم التحقق من الكود. أدخل كلمة المرور الجديدة.', type: 'success' });
        } catch (err) {
            setPwMsg({ text: err.response?.data?.message || 'الكود غير صحيح.', type: 'error' });
        } finally { setPwBusy(false); }
    };

    const doResetPassword = async () => {
        // نفس شروط الباك-إند (validatePassword) عشان مايبقاش فيه تناقض بين الواجهة والسيرفر
        if (pwForm.newPassword.length < 8)     { setPwMsg({ text: 'كلمة المرور 8 أحرف على الأقل.', type: 'error' }); return; }
        if (!/[0-9]/.test(pwForm.newPassword)) { setPwMsg({ text: 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل.', type: 'error' }); return; }
        if (!/[A-Z]/.test(pwForm.newPassword)) { setPwMsg({ text: 'كلمة المرور يجب أن تحتوي على حرف كبير واحد (A-Z).', type: 'error' }); return; }
        if (pwForm.newPassword !== pwForm.confirmPassword) { setPwMsg({ text: 'كلمتا المرور غير متطابقتين.', type: 'error' }); return; }
        setPwBusy(true); setPwMsg({ text: '', type: 'success' });
        try {
            await axiosInstance.post('/auth/reset-password', {
                email: profile?.user?.email, code: pwForm.code, newPassword: pwForm.newPassword,
            });
            setPwMsg({ text: 'تم تغيير كلمة المرور! جارٍ تسجيل الخروج...', type: 'success' });
            setTimeout(() => { signOut(); navigate('/login'); }, 2500);
        } catch (err) {
            setPwMsg({ text: err.response?.data?.message || 'حدث خطأ.', type: 'error' });
        } finally { setPwBusy(false); }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f0f4f2] flex items-center justify-center font-['Cairo']">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#134e3a] flex items-center justify-center shadow-md">
                        <span className="material-symbols-outlined text-white text-2xl animate-pulse">local_hospital</span>
                    </div>
                    <p className="text-gray-500 text-sm font-medium">جارٍ تحميل ملفك الشخصي…</p>
                </div>
            </div>
        );
    }

    const user        = profile?.user  || {};
    const isApproved  = profile?.isApproved;

    const rawPic    = user.profilePicture;
    const picPath   = rawPic ? (rawPic.startsWith('/') ? rawPic : `/${rawPic}`) : null;
    const avatarSrc = picPath ? `${SERVER_BASE}${picPath}` : null;

    const PersonalSection = (
        <div dir="rtl" className="space-y-5">

            <input
                ref={picInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePicChange}
            />

            <div className="bg-gradient-to-br from-[#134e3a] to-[#2d6a4f] rounded-2xl p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6 shadow-md">
                <button
                    type="button"
                    onClick={() => picInputRef.current?.click()}
                    disabled={uploadingPic}
                    className="relative w-24 h-24 rounded-2xl shrink-0 group focus:outline-none"
                    title="تغيير صورة الملف الشخصي"
                >
                    {avatarSrc ? (
                        <img
                            src={avatarSrc}
                            alt="صورة الملف الشخصي"
                            className="w-24 h-24 rounded-2xl object-cover shadow-inner ring-2 ring-white/30"
                        />
                    ) : (
                        <div className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner ring-2 ring-white/30">
                            <span className="text-3xl font-black text-white">{getInitials(user.name)}</span>
                        </div>
                    )}
                    <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        {uploadingPic
                            ? <span className="material-symbols-outlined text-white text-[28px] animate-spin">progress_activity</span>
                            : <span className="material-symbols-outlined text-white text-[28px]">photo_camera</span>
                        }
                    </div>
                </button>
                <div className="flex-1 min-w-0">
                    <p className="text-2xl font-black text-white leading-tight">د. {user.name || '—'}</p>
                    <p className="text-emerald-200 text-sm mt-0.5">{user.email || '—'}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            isApproved
                                ? 'bg-emerald-400/30 text-emerald-100'
                                : 'bg-yellow-400/30 text-yellow-100'
                        }`}>
                            {isApproved ? '✓ حساب موثق' : '⏳ قيد المراجعة'}
                        </span>
                        {profile?.specialization && (
                            <span className="px-3 py-1 bg-white/10 text-emerald-100 rounded-full text-xs font-semibold">
                                {profile.specialization}
                            </span>
                        )}
                        {user.phone && (
                            <span className="px-3 py-1 bg-white/10 text-emerald-100 rounded-full text-xs font-semibold">
                                📞 {user.phone}
                            </span>
                        )}
                    </div>
                    {profile?.numReviews > 0 && (
                        <div className="flex items-center gap-1.5 mt-3">
                            <span className="material-symbols-outlined text-yellow-300 text-[16px]">star</span>
                            <span className="text-white text-sm font-bold">
                                {profile.rating?.toFixed(1)}
                            </span>
                            <span className="text-emerald-200 text-xs">({profile.numReviews} تقييم)</span>
                        </div>
                    )}
                </div>
            </div>

            <SectionCard title="معلومات الحساب" icon="manage_accounts">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <InfoRow label="الاسم الكامل"       value={user.name}  />
                    <InfoRow label="البريد الإلكتروني"  value={user.email} />
                    <InfoRow label="رقم الهاتف"         value={user.phone} />
                    <InfoRow label="حالة الحساب"        value={isApproved ? 'موثق ✓' : 'قيد المراجعة ⏳'} />
                </div>
                <p className="text-[11px] text-gray-400 mt-5 bg-gray-50 rounded-xl px-4 py-3 leading-relaxed">
                    البيانات الشخصية (الاسم — البريد — الهاتف) لا يمكن تعديلها من هنا.
                    لأي تغييرات تواصل مع فريق الدعم.
                </p>
            </SectionCard>
        </div>
    );

    const ClinicSection = (
        <div dir="rtl" className="space-y-5">

            {!isApproved && (
                <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-2xl px-5 py-4">
                    <span className="material-symbols-outlined text-yellow-500 text-[20px] shrink-0 mt-0.5">info</span>
                    <p className="text-sm text-yellow-700 leading-relaxed">
                        بياناتك حالياً قيد المراجعة من الإدارة. لن يظهر ملفك للمرضى حتى تكتمل المراجعة.
                    </p>
                </div>
            )}

            <SectionCard
                title="البيانات المهنية"
                icon="school"
                action={
                    !editingClinic ? (
                        <button
                            onClick={() => setEditingClinic(true)}
                            className="flex items-center gap-1.5 text-xs font-bold text-[#134e3a] hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-all"
                        >
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                            تعديل
                        </button>
                    ) : null
                }
            >
                {!editingClinic ? (
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <InfoRow label="التخصص"         value={profile?.specialization} />
                            <InfoRow label="الدرجة العلمية" value={profile?.degree} />
                            <InfoRow label="سعر الكشف"      value={profile?.consultationFee != null ? `${profile.consultationFee} جنيه` : '—'} />
                            <InfoRow label="سعر إعادة الكشف" value={profile?.followUpFee != null ? `${profile.followUpFee} جنيه` : 'غير محدد'} />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">النبذة التعريفية</span>
                            <p className="text-sm text-gray-800 leading-relaxed mt-1.5 bg-gray-50 rounded-xl px-4 py-3">
                                {profile?.bio || '—'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="التخصص *">
                                <input
                                    className={inputCls}
                                    value={clinicForm.specialization}
                                    onChange={e => setClinicForm(f => ({ ...f, specialization: e.target.value }))}
                                    placeholder="مثال: طب الأطفال"
                                />
                            </Field>
                            <Field label="الدرجة العلمية *">
                                <input
                                    className={inputCls}
                                    value={clinicForm.degree}
                                    onChange={e => setClinicForm(f => ({ ...f, degree: e.target.value }))}
                                    placeholder="مثال: دكتوراه"
                                />
                            </Field>
                            <Field label="سعر الكشف (جنيه) *">
                                <input
                                    type="number"
                                    min="0"
                                    className={inputCls}
                                    value={clinicForm.consultationFee}
                                    onChange={e => setClinicForm(f => ({ ...f, consultationFee: e.target.value }))}
                                    placeholder="مثال: 200"
                                />
                            </Field>
                            <Field label="سعر إعادة الكشف (جنيه)">
                                <input
                                    type="number"
                                    min="0"
                                    className={inputCls}
                                    value={clinicForm.followUpFee}
                                    onChange={e => setClinicForm(f => ({ ...f, followUpFee: e.target.value }))}
                                    placeholder="اتركه فارغاً لاستخدام سعر الكشف"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">سيُطبَّق تلقائياً على مرضى المتابعة</p>
                            </Field>
                        </div>
                        <Field label="النبذة التعريفية *">
                            <textarea
                                rows={4}
                                maxLength={500}
                                className={textareaCls}
                                value={clinicForm.bio}
                                onChange={e => setClinicForm(f => ({ ...f, bio: e.target.value }))}
                                placeholder="اكتب نبذة مختصرة عن خبرتك وتخصصك..."
                            />
                            <p className="text-[11px] text-gray-400 text-left">{clinicForm.bio.length}/500</p>
                        </Field>
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => { setEditingClinic(false); }} className={btnGhost}>إلغاء</button>
                        </div>
                    </div>
                )}
            </SectionCard>

            <SectionCard title="عنوان العيادة وبيانات التواصل" icon="location_on">
                {!editingClinic ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <InfoRow label="المدينة"           value={profile?.address?.city}        />
                        <InfoRow label="المنطقة"           value={profile?.address?.area}        />
                        <InfoRow label="العنوان التفصيلي"  value={profile?.address?.fullAddress} />
                        <InfoRow label="هاتف العيادة"      value={profile?.address?.clinicPhone} />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="المدينة *">
                                <input
                                    className={inputCls}
                                    value={clinicForm.city}
                                    onChange={e => setClinicForm(f => ({ ...f, city: e.target.value }))}
                                    placeholder="مثال: القاهرة"
                                />
                            </Field>
                            <Field label="المنطقة *">
                                <input
                                    className={inputCls}
                                    value={clinicForm.area}
                                    onChange={e => setClinicForm(f => ({ ...f, area: e.target.value }))}
                                    placeholder="مثال: مدينة نصر"
                                />
                            </Field>
                            <Field label="العنوان التفصيلي *" className="sm:col-span-2">
                                <input
                                    className={inputCls}
                                    value={clinicForm.fullAddress}
                                    onChange={e => setClinicForm(f => ({ ...f, fullAddress: e.target.value }))}
                                    placeholder="مثال: ش عباس العقاد، برج الأطباء، دور 3"
                                />
                            </Field>
                            <Field label="هاتف العيادة" className="sm:col-span-2">
                                <input
                                    className={inputCls}
                                    type="tel"
                                    value={clinicForm.clinicPhone}
                                    onChange={e => setClinicForm(f => ({ ...f, clinicPhone: e.target.value }))}
                                    placeholder="مثال: 0201012345678"
                                />
                            </Field>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => { setEditingClinic(false); }} className={btnGhost}>إلغاء</button>
                            <button onClick={saveClinicInfo} disabled={saving} className={btnPrimary}>
                                {saving ? <Spinner /> : <span className="material-symbols-outlined text-[16px]">save</span>}
                                حفظ التغييرات
                            </button>
                        </div>
                    </div>
                )}
            </SectionCard>

            <SectionCard title="موقع العيادة على الخريطة" icon="map">
                {!editingMap ? (
                    <div className="space-y-3">
                        {clinicLocation ? (
                            <>
                                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2.5">
                                    <span className="material-symbols-outlined text-[16px]">location_on</span>
                                    <span className="font-semibold">تم تحديد موقع العيادة</span>
                                    <span className="text-xs text-gray-400 mr-auto" dir="ltr">
                                        {clinicLocation.lat.toFixed(5)}, {clinicLocation.lon.toFixed(5)}
                                    </span>
                                </div>
                                <div className="relative z-0">
                                    <Suspense fallback={<div className="h-[300px] bg-gray-100 rounded-xl animate-pulse" />}>
                                        <ClinicMapPicker
                                            position={clinicLocation}
                                            flyTarget={null}
                                            onPick={() => {}}
                                            interactive={false}
                                        />
                                    </Suspense>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                <span className="material-symbols-outlined text-[40px] mb-2">location_off</span>
                                <p className="text-sm font-medium">لم يتم تحديد موقع العيادة بعد</p>
                                <p className="text-xs mt-0.5">تحديد الموقع يتيح للمرضى معرفة وقت وصولهم</p>
                            </div>
                        )}
                        <button
                            onClick={() => {
                                setEditingMap(true);
                                setPendingLocation(clinicLocation);
                                setMapFlyTarget(null);
                            }}
                            className="flex items-center gap-1.5 text-xs font-bold text-[#134e3a] hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-xl transition-all"
                        >
                            <span className="material-symbols-outlined text-[15px]">edit_location</span>
                            {clinicLocation ? 'تعديل الموقع' : 'تحديد الموقع'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 flex items-start gap-2">
                            <span className="material-symbols-outlined text-blue-400 text-[16px] shrink-0 mt-0.5">info</span>
                            اضغط على أي نقطة في الخريطة لتحديد موقع العيادة
                        </p>
                        <div className="relative z-0">
                            <Suspense fallback={<div className="h-[300px] bg-gray-100 rounded-xl animate-pulse" />}>
                                <ClinicMapPicker
                                    position={pendingLocation}
                                    flyTarget={mapFlyTarget}
                                    onPick={(lat, lon) => setPendingLocation({ lat, lon })}
                                    interactive
                                />
                            </Suspense>
                        </div>
                        {pendingLocation && (
                            <p className="text-xs text-gray-400 text-center" dir="ltr">
                                📍 {pendingLocation.lat.toFixed(6)}, {pendingLocation.lon.toFixed(6)}
                            </p>
                        )}
                        <div className="flex items-center gap-3 flex-wrap">
                            <button
                                onClick={() => {
                                    if (!navigator.geolocation) {
                                        showToast('متصفحك لا يدعم تحديد الموقع.', 'error');
                                        return;
                                    }
                                    navigator.geolocation.getCurrentPosition(
                                        (pos) => {
                                            const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                                            setPendingLocation(loc);
                                            setMapFlyTarget({ ...loc });
                                        },
                                        () => showToast('لم يتم السماح بالوصول للموقع.', 'error'),
                                    );
                                }}
                                className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl transition-all"
                            >
                                <span className="material-symbols-outlined text-[15px]">my_location</span>
                                استخدام موقعي الحالي
                            </button>
                            <div className="flex-1" />
                            <button
                                onClick={() => { setEditingMap(false); setPendingLocation(null); setMapFlyTarget(null); }}
                                className={btnGhost}
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={saveClinicLocation}
                                disabled={savingLocation || !pendingLocation}
                                className={btnPrimary}
                            >
                                {savingLocation ? <Spinner /> : <span className="material-symbols-outlined text-[16px]">save</span>}
                                حفظ الموقع
                            </button>
                        </div>
                    </div>
                )}
            </SectionCard>
        </div>
    );

    const stepLabels = ['طلب الكود', 'التحقق', 'كلمة المرور الجديدة'];

    const PasswordSection = (
        <div dir="rtl" className="space-y-5">
            <SectionCard title="تغيير كلمة المرور" icon="lock">

                <div className="flex items-center justify-center gap-3 mb-8">
                    {stepLabels.map((lbl, idx) => {
                        const n      = idx + 1;
                        const done   = pwStep > n;
                        const active = pwStep === n;
                        return (
                            <div key={n} className="flex items-center gap-2">
                                <div className="flex flex-col items-center gap-1">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all shrink-0
                                        ${done   ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : active ? 'bg-[#134e3a] border-[#134e3a] text-white'
                                        :          'bg-white border-gray-300 text-gray-400'}`}>
                                        {done
                                            ? <span className="material-symbols-outlined text-[15px]">check</span>
                                            : n}
                                    </div>
                                    <span className={`text-[10px] font-bold ${active ? 'text-[#134e3a]' : 'text-gray-400'}`}>{lbl}</span>
                                </div>
                                {idx < 2 && (
                                    <div className={`w-10 h-0.5 mb-5 rounded-full ${pwStep > n ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                                )}
                            </div>
                        );
                    })}
                </div>

                {pwMsg.text && (
                    <div className={`mb-5 px-4 py-3 rounded-xl text-sm font-medium border ${
                        pwMsg.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-red-50 border-red-200 text-red-600'
                    }`}>
                        {pwMsg.text}
                    </div>
                )}

                {pwStep === 1 && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 leading-relaxed">
                            سيتم إرسال كود التحقق إلى بريدك الإلكتروني:
                            <span className="font-bold text-[#134e3a] mr-1">{user.email}</span>
                        </p>
                        <button onClick={requestPwReset} disabled={pwBusy} className={`${btnPrimary} w-full`}>
                            {pwBusy ? <Spinner /> : <span className="material-symbols-outlined text-[16px]">send</span>}
                            إرسال كود التحقق
                        </button>
                    </div>
                )}

                {pwStep === 2 && (
                    <div className="space-y-4">
                        <Field label="كود التحقق (6 أرقام)">
                            <input
                                className={inputCls}
                                placeholder="ادخل الكود"
                                value={pwForm.code}
                                onChange={e => setPwForm(f => ({ ...f, code: e.target.value }))}
                                maxLength={6}
                            />
                        </Field>
                        <div className="flex gap-3">
                            <button onClick={() => { setPwStep(1); setPwMsg({ text: '', type: 'success' }); }} className={btnGhost}>رجوع</button>
                            <button onClick={verifyPwCode} disabled={pwBusy} className={`${btnPrimary} flex-1`}>
                                {pwBusy ? <Spinner /> : null}
                                تحقق من الكود
                            </button>
                        </div>
                    </div>
                )}

                {pwStep === 3 && (
                    <div className="space-y-4">
                        <Field label="كلمة المرور الجديدة">
                            <div className="relative">
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    className={inputCls + ' pl-10'}
                                    placeholder="أدخل كلمة المرور"
                                    value={pwForm.newPassword}
                                    onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(v => !v)}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                >
                                    <span className="material-symbols-outlined text-[18px]">
                                        {showPw ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">
                                يجب أن تكون 8 أحرف على الأقل، وتحتوي على رقم وحرف كبير (A-Z).
                            </p>
                        </Field>
                        <Field label="تأكيد كلمة المرور">
                            <input
                                type={showPw ? 'text' : 'password'}
                                className={inputCls}
                                placeholder="أعد إدخال كلمة المرور"
                                value={pwForm.confirmPassword}
                                onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                            />
                        </Field>
                        <button onClick={doResetPassword} disabled={pwBusy} className={`${btnPrimary} w-full`}>
                            {pwBusy ? <Spinner /> : <span className="material-symbols-outlined text-[16px]">lock_reset</span>}
                            تغيير كلمة المرور
                        </button>
                    </div>
                )}
            </SectionCard>
        </div>
    );

    const SecretarySection = (
        <div dir="rtl" className="space-y-5">
            <SectionCard
                title="حسابات السكرتيرة"
                icon="badge"
                action={
                    !showCreateSec ? (
                        <button
                            onClick={() => { setShowCreateSec(true); setSecFormErr(''); }}
                            className="flex items-center gap-1.5 text-xs font-bold text-[#134e3a] hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-all"
                        >
                            <span className="material-symbols-outlined text-[15px]">person_add</span>
                            إضافة سكرتيرة
                        </button>
                    ) : null
                }
            >
                {/* Create form */}
                {showCreateSec && (
                    <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-3">
                        <p className="text-sm font-bold text-[#134e3a]">حساب جديد</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="الاسم *">
                                <input
                                    className={inputCls}
                                    placeholder="اسم السكرتيرة"
                                    value={secForm.name}
                                    onChange={e => setSecForm(f => ({ ...f, name: e.target.value }))}
                                />
                            </Field>
                            <Field label="رقم الهاتف *">
                                <input
                                    className={inputCls}
                                    type="tel"
                                    placeholder="مثال: 01012345678"
                                    value={secForm.phone}
                                    onChange={e => setSecForm(f => ({ ...f, phone: e.target.value }))}
                                />
                            </Field>
                            <Field label="البريد الإلكتروني *" className="sm:col-span-2">
                                <input
                                    className={inputCls}
                                    type="email"
                                    placeholder="example@email.com"
                                    value={secForm.email}
                                    onChange={e => setSecForm(f => ({ ...f, email: e.target.value }))}
                                />
                            </Field>
                            <Field label="كلمة المرور *" className="sm:col-span-2">
                                <input
                                    className={inputCls}
                                    type="password"
                                    placeholder="مثال: Secretary1"
                                    value={secForm.password}
                                    onChange={e => setSecForm(f => ({ ...f, password: e.target.value }))}
                                />
                                <p className="text-[10px] text-gray-400 mt-1">8 أحرف على الأقل، تحتوي على رقم وحرف كبير (A-Z)</p>
                            </Field>
                        </div>
                        {secFormErr && (
                            <p className="text-xs text-red-500 font-semibold bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                                {secFormErr}
                            </p>
                        )}
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => { setShowCreateSec(false); setSecForm({ name: '', email: '', password: '', phone: '' }); setSecFormErr(''); }} className={btnGhost}>
                                إلغاء
                            </button>
                            <button onClick={createSecretary} disabled={secCreating} className={btnPrimary}>
                                {secCreating ? <Spinner /> : <span className="material-symbols-outlined text-[16px]">person_add</span>}
                                إنشاء الحساب
                            </button>
                        </div>
                    </div>
                )}

                {/* Secretary list */}
                {secLoading ? (
                    <div className="flex justify-center py-10">
                        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                    </div>
                ) : secretaries.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <span className="material-symbols-outlined text-[40px] mb-2 block">badge</span>
                        <p className="text-sm font-medium">لا توجد حسابات سكرتيرة بعد</p>
                        <p className="text-xs mt-0.5">اضغط "إضافة سكرتيرة" لإنشاء حساب</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {secretaries.map(sec => (
                            <div key={sec._id} className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center font-black text-emerald-700 shrink-0">
                                    {sec.name?.charAt(0) ?? 'س'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-[#191c1c] truncate">{sec.name}</p>
                                    <p className="text-xs text-gray-400 truncate">{sec.email}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => { setChangePwTarget(sec); setChangePwVal(''); }}
                                        className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-all"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">lock_reset</span>
                                        كلمة المرور
                                    </button>
                                    <button
                                        onClick={() => setDeleteTarget(sec)}
                                        className="w-8 h-8 flex items-center justify-center rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <p className="text-[11px] text-gray-400 mt-5 bg-gray-50 rounded-xl px-4 py-3 leading-relaxed">
                    السكرتيرة تقدر تستخدم لوحة الطبيب — إدارة القائمة، walk-ins، العمليات، والجدول. لا تقدر ترى الإحصائيات أو التاريخ الطبي للمرضى.
                </p>
            </SectionCard>
        </div>
    );

    const sections = {
        personal:  PersonalSection,
        clinic:    ClinicSection,
        password:  PasswordSection,
        secretary: SecretarySection,
    };

    return (
        <div className="min-h-screen bg-[#f0f4f2] flex flex-col font-['Cairo']" dir="rtl">

            {toast.msg && (
                <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold
                    flex items-center gap-2 transition-all
                    ${toast.type === 'success'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-red-500 text-white'}`}>
                    <span className="material-symbols-outlined text-[17px]">
                        {toast.type === 'success' ? 'check_circle' : 'error'}
                    </span>
                    {toast.msg}
                </div>
            )}

            <div className="flex flex-1">
            <aside className="w-64 bg-white border-l border-gray-100 flex flex-col sticky top-0 h-screen shrink-0">
                <div className="px-6 py-6 border-b border-gray-50">
                    <p className="text-xl font-black text-[#134e3a] tracking-tight">SAGE</p>
                    <p className="text-xs text-gray-400">ملف الطبيب</p>
                </div>

                <div className="px-6 py-5 border-b border-gray-50">
                    <button
                        type="button"
                        onClick={() => picInputRef.current?.click()}
                        disabled={uploadingPic}
                        className="relative w-12 h-12 rounded-full mb-2 group focus:outline-none"
                        title="تغيير الصورة"
                    >
                        {avatarSrc ? (
                            <img
                                src={avatarSrc}
                                alt="صورة الملف الشخصي"
                                className="w-12 h-12 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center font-black text-emerald-700 text-lg">
                                {getInitials(user.name)}
                            </div>
                        )}
                        <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-[14px]">photo_camera</span>
                        </div>
                    </button>
                    <p className="font-bold text-[#191c1c] text-sm leading-tight">د. {user.name || '—'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{profile?.specialization || 'طبيب'}</p>
                    <div className={`flex items-center gap-1 mt-1.5`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isApproved ? 'bg-emerald-500' : 'bg-yellow-400'}`} />
                        <span className={`text-[11px] font-semibold ${isApproved ? 'text-emerald-600' : 'text-yellow-600'}`}>
                            {isApproved ? 'حساب موثق' : 'قيد المراجعة'}
                        </span>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-4 flex flex-col gap-1.5">
                    {MENU.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveSection(item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-bold transition-all text-right
                                ${activeSection === item.id
                                    ? 'bg-[#134e3a] text-white shadow-sm'
                                    : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="px-4 pb-6 flex flex-col gap-2">
                    <Link
                        to="/doctor-dashboard"
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-[#134e3a] rounded-2xl hover:bg-emerald-50 transition-colors border border-emerald-100"
                    >
                        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                        لوحة التحكم
                    </Link>
                </div>
            </aside>

            <main className="flex-1 p-8">
                <div className="max-w-3xl mx-auto">
                    <div className="mb-7">
                        <h1 className="text-2xl font-black text-[#191c1c]">
                            {MENU.find(m => m.id === activeSection)?.label}
                        </h1>
                        <p className="text-sm text-gray-400 mt-0.5">
                            {activeSection === 'personal'   && 'معلومات حسابك على المنصة'}
                            {activeSection === 'clinic'     && 'بيانات عيادتك وتخصصك — أي تعديل يستلزم مراجعة الإدارة'}
                            {activeSection === 'password'   && 'تغيير كلمة المرور عبر بريدك الإلكتروني'}
                            {activeSection === 'secretary'  && 'إنشاء وإدارة حسابات السكرتيرة المرتبطة بعيادتك'}
                        </p>
                    </div>

                    {sections[activeSection]}

                    {activeSection === 'secretary' && (
                        <>
                            {/* Change password modal */}
                            {changePwTarget && (
                                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && !changePwBusy && setChangePwTarget(null)}>
                                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" dir="rtl">
                                        <h3 className="font-black text-[#134e3a] text-lg mb-0.5">تغيير كلمة المرور</h3>
                                        <p className="text-xs text-gray-400 mb-4">{changePwTarget.name}</p>
                                        <Field label="كلمة المرور الجديدة">
                                            <input
                                                className={inputCls}
                                                type="password"
                                                placeholder="مثال: Secretary1"
                                                value={changePwVal}
                                                onChange={e => setChangePwVal(e.target.value)}
                                                autoFocus
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1">8 أحرف + رقم + حرف كبير (A-Z)</p>
                                        </Field>
                                        <div className="flex gap-3 mt-5">
                                            <button onClick={changeSecPassword} disabled={changePwBusy} className={`${btnPrimary} flex-1`}>
                                                {changePwBusy ? <Spinner /> : null}
                                                حفظ
                                            </button>
                                            <button onClick={() => setChangePwTarget(null)} disabled={changePwBusy} className={`${btnGhost} flex-1`}>
                                                إلغاء
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Delete confirm modal */}
                            {deleteTarget && (
                                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && !deleteBusy && setDeleteTarget(null)}>
                                    <div className="bg-white rounded-2xl p-7 max-w-sm w-full shadow-2xl text-center" dir="rtl">
                                        <span className="material-symbols-outlined text-[40px] text-red-400 mb-3 block">delete</span>
                                        <h3 className="font-black text-[#191c1c] text-lg mb-1">تأكيد الحذف</h3>
                                        <p className="text-sm text-gray-500 mb-6">
                                            هل أنت متأكد من حذف حساب <span className="font-bold text-[#191c1c]">{deleteTarget.name}</span>؟ لا يمكن التراجع.
                                        </p>
                                        <div className="flex gap-3">
                                            <button onClick={deleteSecretary} disabled={deleteBusy} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-2xl transition disabled:opacity-50 flex items-center justify-center gap-2">
                                                {deleteBusy && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                                نعم، حذف
                                            </button>
                                            <button onClick={() => setDeleteTarget(null)} disabled={deleteBusy} className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-2xl hover:bg-gray-50 transition disabled:opacity-40">
                                                إلغاء
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
            </div>

            <Footer variant="doctor" />
        </div>
    );
}

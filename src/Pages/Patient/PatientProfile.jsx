import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import { queryKeys } from '../../lib/queryClient';
import { fmtTime } from '../../utils/timeFormat';
import Footer from '../../components/Footer';
import {
    MENU, BLOOD_TYPES, GENDER_OPTIONS, FREQ_OPTIONS, FREQ_DEFAULTS,
    DURATION_OPTIONS, WEEKDAY_OPTIONS, RECORD_TYPES,
    inputCls, btnPrimary, btnGhost, btnOutline,
} from './Profile/profileConstants';
import { formatDate, getInitials, arrFromStr, toStr } from './Profile/profileHelpers';
import { Spinner, SectionCard, InfoRow, TagList, Field, StepDot, ConfirmDialog } from './Profile/atoms';

// Base URL for static uploads (strips /api from the API base)
// Extracts only protocol+host+port from the API URL (e.g. "http://localhost:5000")
// so we can build static-file URLs like SERVER_BASE + "/uploads/profile-pictures/..."
const SERVER_BASE = new URL(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').origin;

// ═════════════════════════════════════════════════════════════════════════════
//  PatientProfile — main component
// ═════════════════════════════════════════════════════════════════════════════
export default function PatientProfile() {
    const navigate = useNavigate();
    const location = useLocation();
    const { signOut, updateUser } = useAuth();
    const qc = useQueryClient();

    // ── Header state ──────────────────────────────────────────────────────────
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // ── Section nav ───────────────────────────────────────────────────────────
    const [activeSection, setActiveSection] = useState(
        location.state?.section || 'basic'
    );

    // ── Data ──────────────────────────────────────────────────────────────────
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving,  setSaving]  = useState(false);

    // ── Visit history ─────────────────────────────────────────────────────────
    const [visits,         setVisits]         = useState([]);
    const [visitsLoading,  setVisitsLoading]  = useState(false);
    const [expandedDoctor, setExpandedDoctor] = useState(null);

    // ── Export data (PDPL Art.15) ─────────────────────────────────────────────
    const [exporting, setExporting] = useState(false);

    const exportData = async () => {
        setExporting(true);
        try {
            const response = await axiosInstance.get('/patients/export-data', {
                responseType: 'blob',
            });
            const date     = new Date().toISOString().split('T')[0];
            const filename = `sage-data-export-${date}.json`;
            const url  = URL.createObjectURL(new Blob([response.data], { type: 'application/json' }));
            const link = document.createElement('a');
            link.href     = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
            showToast('تم تحميل بياناتك بنجاح ✓');
        } catch (err) {
            if (err.response?.status === 429) {
                showToast('تجاوزت الحد المسموح — يمكنك التصدير 3 مرات كل 15 دقيقة.', 'error');
            } else {
                showToast('حدث خطأ أثناء تصدير البيانات. حاول مرة أخرى.', 'error');
            }
        } finally {
            setExporting(false);
        }
    };

    // ── Delete account (Danger Zone) ─────────────────────────────────────────
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteConfirm,  setDeleteConfirm]  = useState(false);
    const [deleting,       setDeleting]       = useState(false);

    // ── Toast ─────────────────────────────────────────────────────────────────
    const [toast, setToast] = useState({ msg: '', type: 'success' });
    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast({ msg: '', type: 'success' }), 3500);
    }, []);

    // ── Profile picture ───────────────────────────────────────────────────────
    // Defined AFTER showToast to avoid TDZ ReferenceError in the dependency array
    const picInputRef   = useRef(null);
    const [uploadingPic, setUploadingPic] = useState(false);

    const handlePicChange = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setUploadingPic(true);
            const fd = new FormData();
            fd.append('profilePicture', file);
            const { data } = await axiosInstance.put('/patients/update-profile-picture', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            // Instant preview — update local profile state + auth context (for dashboards)
            setProfile((p) => ({ ...p, profilePicture: data.profilePicture }));
            updateUser({ profilePicture: data.profilePicture });
            showToast('تم تحديث صورتك الشخصية بنجاح ✓');
        } catch (err) {
            showToast(err.response?.data?.message || 'فشل رفع الصورة.', 'error');
        } finally {
            setUploadingPic(false);
            e.target.value = '';
        }
    }, [showToast, updateUser]);

    // ── Edit toggles ──────────────────────────────────────────────────────────
    const [editingBasic,   setEditingBasic]   = useState(false);
    const [editingMedical, setEditingMedical] = useState(false);
    const [addingMed,        setAddingMed]        = useState(false);
    const [addingRecord,     setAddingRecord]     = useState(false);
    const [deletingRecordId,   setDeletingRecordId]   = useState(null);
    const [deletingMedId,      setDeletingMedId]      = useState(null);
    const [confirmDialog,      setConfirmDialog]      = useState({ open: false, title: '', message: '', onConfirm: null });

    // ── Forms ─────────────────────────────────────────────────────────────────
    const [basicForm,   setBasicForm]   = useState({ name: '', phone: '', gender: '', birthDate: '', city: '' });
    const [medicalForm, setMedicalForm] = useState({
        bloodType: '', chronicDiseases: '', allergies: '',
        weight: '', height: '', emergencyContact: '',
        currentMedications: '', pastSurgeries: '', familyHistory: '',
    });
    const [medForm, setMedForm] = useState({
        name: '', dosage: '', frequency: 'once_daily',
        times: ['08:00'], duration: '', weekDay: new Date().getDay(),
    });
    const [recordForm, setRecordForm] = useState({ file: null, recordType: 'lab_result', note: '' });

    // ── Password (3-step OTP) ─────────────────────────────────────────────────
    const [pwStep, setPwStep] = useState(1);
    const [pwForm, setPwForm] = useState({ code: '', newPassword: '', confirmPassword: '' });
    const [pwBusy, setPwBusy] = useState(false);
    const [pwMsg,  setPwMsg]  = useState({ text: '', type: 'success' });
    const [showPw, setShowPw] = useState(false);


    // ── Fetch profile ─────────────────────────────────────────────────────────
    const fetchProfile = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get('/patients/me');
            const d   = res.data.data;
            setProfile(d);
            setBasicForm({
                name:      d.name      || '',
                phone:     d.phone     || '',
                gender:    d.gender    || '',
                birthDate: d.birthDate ? d.birthDate.split('T')[0] : '',
                city:      d.medicalInfo?.city || '',
            });
            const mi = d.medicalInfo || {};
            setMedicalForm({
                bloodType:          mi.bloodType          || '',
                chronicDiseases:    toStr(mi.chronicDiseases),
                allergies:          toStr(mi.allergies),
                weight:             mi.weight             || '',
                height:             mi.height             || '',
                emergencyContact:   mi.emergencyContact   || '',
                currentMedications: toStr(mi.currentMedications),
                pastSurgeries:      mi.pastSurgeries      || '',
                familyHistory:      mi.familyHistory      || '',
            });
        } catch {
            showToast('تعذر تحميل بيانات الملف الشخصي.', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { fetchProfile(); }, [fetchProfile]);

    // Write-through: keep the shared `me` cache (used by the dashboard) in sync
    // with every local profile mutation on this page — initial load and all the
    // optimistic setProfile updates from the save/upload handlers. This means an
    // edit here (avatar, city, medications) shows up on the dashboard without a
    // stale window, with no need to touch each individual handler.
    useEffect(() => {
        if (profile) qc.setQueryData(queryKeys.me, profile);
    }, [profile, qc]);

    useEffect(() => {
        if (activeSection !== 'history' || visits.length > 0) return;
        setVisitsLoading(true);
        axiosInstance.get('/patients/my-visit-history')
            .then(({ data }) => setVisits(data.data || []))
            .catch(() => {})
            .finally(() => setVisitsLoading(false));
    }, [activeSection, visits.length]);

    // ── Save: basic info ──────────────────────────────────────────────────────
    const saveBasicInfo = async () => {
        try {
            setSaving(true);
            const res = await axiosInstance.put('/patients/update-me', basicForm);
            setProfile((p) => ({
                ...p,
                ...res.data.data,
                medicalInfo: { ...(p?.medicalInfo || {}), city: basicForm.city },
            }));
            setEditingBasic(false);
            showToast('تم تحديث البيانات الأساسية بنجاح ✓');
        } catch (err) {
            showToast(err.response?.data?.message || 'حدث خطأ أثناء الحفظ.', 'error');
        } finally { setSaving(false); }
    };

    // ── Save: medical info ────────────────────────────────────────────────────
    const saveMedicalInfo = async () => {
        try {
            setSaving(true);
            const payload = {
                ...medicalForm,
                chronicDiseases:    arrFromStr(medicalForm.chronicDiseases),
                allergies:          arrFromStr(medicalForm.allergies),
                currentMedications: arrFromStr(medicalForm.currentMedications),
                weight: medicalForm.weight ? Number(medicalForm.weight) : undefined,
                height: medicalForm.height ? Number(medicalForm.height) : undefined,
            };
            const res = await axiosInstance.put('/patients/complete-medical-profile', payload);
            setProfile((p) => ({ ...p, medicalInfo: res.data.data }));
            setEditingMedical(false);
            showToast('تم تحديث البيانات الطبية بنجاح ✓');
        } catch (err) {
            showToast(err.response?.data?.message || 'حدث خطأ أثناء الحفظ.', 'error');
        } finally { setSaving(false); }
    };

    // ── Add medication ────────────────────────────────────────────────────────
    const addMedication = async () => {
        if (!medForm.name.trim()) { showToast('اسم الدواء مطلوب.', 'error'); return; }
        try {
            setSaving(true);
            const res = await axiosInstance.post('/patients/add-medication', medForm);
            setProfile((p) => ({
                ...p,
                medicalInfo: { ...(p.medicalInfo || {}), medications: res.data.data },
            }));
            setMedForm({ name: '', dosage: '', frequency: 'once_daily', times: ['08:00'], duration: '', weekDay: new Date().getDay() });
            setAddingMed(false);
            showToast('تم إضافة الدواء بنجاح ✓');
        } catch (err) {
            showToast(err.response?.data?.message || 'حدث خطأ.', 'error');
        } finally { setSaving(false); }
    };

    // ── Upload record ─────────────────────────────────────────────────────────
    const uploadRecord = async () => {
        if (!(recordForm.file instanceof File)) {
            showToast('اختر ملفاً أولاً.', 'error'); return;
        }
        try {
            setSaving(true);
            const fd = new FormData();
            fd.append('file', recordForm.file);
            fd.append('recordType', recordForm.recordType);
            if (recordForm.note) fd.append('note', recordForm.note);
            await axiosInstance.post('/patients/upload-record', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setRecordForm({ file: null, recordType: 'lab_result', note: '' });
            setAddingRecord(false);
            showToast('تم حفظ الملف الطبي بنجاح ✓');
            fetchProfile();
        } catch (err) {
            showToast(err.response?.data?.message || 'حدث خطأ.', 'error');
        } finally { setSaving(false); }
    };

    // ── Open medical record via short-lived signed URL ────────────────────────
    // 1. Ask the server for a 5-minute file-access token (requires Bearer auth).
    // 2. Open the file directly in a new tab using ?token= — no blob in memory,
    //    no Bearer token in the URL or browser history.
    const openRecord = async (fileUrl) => {
        try {
            // R2 files are stored as "r2:{key}" (no slash) — strip the prefix to get the
            // bare key the server matches on. Legacy URLs keep their last path segment.
            const filename = fileUrl.startsWith('r2:') ? fileUrl.slice(3) : fileUrl.split('/').pop();
            const { data } = await axiosInstance.get('/files/record-token', { params: { filename } });
            window.open(`${SERVER_BASE}/uploads/medical-records/${filename}?token=${data.token}`, '_blank');
        } catch {
            showToast('تعذر فتح الملف.', 'error');
        }
    };

    // ── Delete medical record ─────────────────────────────────────────────────
    const deleteRecord = async (recordId) => {
        try {
            setDeletingRecordId(recordId);
            await axiosInstance.delete(`/patients/delete-record/${recordId}`);
            setProfile((p) => ({
                ...p,
                medicalInfo: {
                    ...(p.medicalInfo || {}),
                    medicalRecords: (p.medicalInfo?.medicalRecords || []).filter((r) => r._id !== recordId),
                },
            }));
            showToast('تم حذف السجل الطبي بنجاح ✓');
        } catch (err) {
            showToast(err.response?.data?.message || 'حدث خطأ أثناء الحذف.', 'error');
        } finally {
            setDeletingRecordId(null);
        }
    };

    // ── Delete medication ─────────────────────────────────────────────────────
    const deleteMedication = async (medicationId) => {
        try {
            setDeletingMedId(medicationId);
            const { data } = await axiosInstance.delete(`/patients/delete-medication/${medicationId}`);
            setProfile((p) => ({
                ...p,
                medicalInfo: { ...(p.medicalInfo || {}), medications: data.data },
            }));
            showToast('تم حذف الدواء بنجاح ✓');
        } catch (err) {
            showToast(err.response?.data?.message || 'حدث خطأ أثناء الحذف.', 'error');
        } finally {
            setDeletingMedId(null);
        }
    };

    // ── Password OTP steps ────────────────────────────────────────────────────
    const requestPwReset = async () => {
        setPwBusy(true); setPwMsg({ text: '', type: 'success' });
        try {
            await axiosInstance.post('/auth/forgot-password', { email: profile?.email });
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
            await axiosInstance.post('/auth/verify-reset-code', { email: profile?.email, code: pwForm.code });
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
            // الباك-إند بيستنى الحقل باسم newPassword (مش password) — غير كده يرجّع "بيانات غير مكتملة"
            await axiosInstance.post('/auth/reset-password', {
                email: profile?.email, code: pwForm.code, newPassword: pwForm.newPassword,
            });
            setPwMsg({ text: 'تم تغيير كلمة المرور! جارٍ تسجيل الخروج...', type: 'success' });
            setTimeout(() => { signOut(); navigate('/login'); }, 2500);
        } catch (err) {
            setPwMsg({ text: err.response?.data?.message || 'حدث خطأ.', type: 'error' });
        } finally { setPwBusy(false); }
    };

    // ── Medication time slots ─────────────────────────────────────────────────
    const addTimeSlot    = () => setMedForm((f) => ({ ...f, times: [...f.times, '12:00'] }));
    const removeTimeSlot = (i) => setMedForm((f) => ({ ...f, times: f.times.filter((_, idx) => idx !== i) }));
    const updateTimeSlot = (i, v) => setMedForm((f) => { const t = [...f.times]; t[i] = v; return { ...f, times: t }; });

    const handleFrequencyChange = (freq) => {
        setMedForm((f) => ({
            ...f,
            frequency: freq,
            times: FREQ_DEFAULTS[freq] ?? ['08:00'],
            weekDay: freq === 'weekly' ? f.weekDay : new Date().getDay(),
        }));
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const mi             = profile?.medicalInfo || {};
    const medications    = mi.medications    || [];
    const medicalRecords = mi.medicalRecords || [];

    // ── Profile picture URL ───────────────────────────────────────────────────
    const rawPic    = profile?.profilePicture;                          // e.g. "/uploads/profile-pictures/abc.jpg" or ""
    const picPath   = rawPic ? (rawPic.startsWith('/') ? rawPic : `/${rawPic}`) : null;
    const avatarSrc = picPath ? `${SERVER_BASE}${picPath}` : null;      // full URL or null (show initials)
    console.log('[PatientProfile] profilePicture raw:', rawPic, '| SERVER_BASE:', SERVER_BASE, '| final URL:', avatarSrc);

    // ── Loading screen ────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#0b2d20] to-[#1a4d35] flex items-center justify-center font-['Cairo']">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#134e3a] flex items-center justify-center shadow-md">
                        <span className="material-symbols-outlined text-white text-2xl animate-pulse">person</span>
                    </div>
                    <p className="text-white/50 text-sm font-medium">جارٍ تحميل ملفك الشخصي…</p>
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  SECTIONS
    // ══════════════════════════════════════════════════════════════════════════

    /* ── البيانات الأساسية ────────────────────────────────────────────────── */
    const BasicSection = (
        <div dir="rtl" className="space-y-5">

            {/* Hidden file input */}
            <input
                ref={picInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePicChange}
            />

            {/* Hero card */}
            <div className="bg-gradient-to-br from-[#134e3a] to-[#2d6a4f] rounded-2xl p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6 shadow-md">
                {/* Clickable avatar */}
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
                            <span className="text-3xl font-black text-white">{getInitials(profile?.name)}</span>
                        </div>
                    )}
                    {/* Camera overlay */}
                    <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        {uploadingPic
                            ? <span className="material-symbols-outlined text-white text-[28px] animate-spin">progress_activity</span>
                            : <span className="material-symbols-outlined text-white text-[28px]">photo_camera</span>
                        }
                    </div>
                </button>
                <div className="flex-1 min-w-0">
                    <p className="text-2xl font-black text-white leading-tight">{profile?.name || '—'}</p>
                    <p className="text-emerald-200 text-sm mt-0.5">{profile?.email || '—'}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="px-3 py-1 bg-white/20 text-white rounded-full text-xs font-semibold">
                            مريض مسجل
                        </span>
                        {profile?.phone && (
                            <span className="px-3 py-1 bg-white/10 text-emerald-100 rounded-full text-xs font-semibold">
                                📞 {profile.phone}
                            </span>
                        )}
                        {profile?.gender && (
                            <span className="px-3 py-1 bg-white/10 text-emerald-100 rounded-full text-xs font-semibold">
                                {profile.gender === 'male' ? '👤 ذكر' : '👤 أنثى'}
                            </span>
                        )}
                    </div>
                </div>
                <div className="hidden md:flex flex-col items-end gap-1 shrink-0 text-left">
                    <p className="text-emerald-300 text-[10px] font-bold uppercase tracking-widest">تاريخ الميلاد</p>
                    <p className="text-white text-sm font-bold">{formatDate(profile?.birthDate)}</p>
                </div>
            </div>

            {/* Join as Doctor banner */}
            <div className="flex items-center justify-between gap-4 bg-gradient-to-l from-[#0d3d2c] to-[#134e3a] rounded-2xl px-6 py-5 shadow-md">
                <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl shrink-0">
                        👨‍⚕️
                    </div>
                    <div className="min-w-0">
                        <p className="text-white font-bold text-base leading-tight">هل أنت طبيب؟</p>
                        <p className="text-emerald-200 text-xs mt-0.5 leading-relaxed">
                            سجّل عيادتك وابدأ استقبال المرضى من خلال منصة SAGE.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/doctor-register')}
                    className="shrink-0 flex items-center gap-2 bg-white text-[#134e3a] px-5 py-2.5 rounded-xl text-sm font-black hover:bg-emerald-50 transition-colors active:scale-95 whitespace-nowrap"
                >
                    <span className="material-symbols-outlined text-[16px]">stethoscope</span>
                    انضم كطبيب
                </button>
            </div>

            {/* Personal info / edit card */}
            <SectionCard
                title="البيانات الشخصية"
                icon="person"
                action={
                    !editingBasic ? (
                        <button onClick={() => setEditingBasic(true)} className={btnOutline}>
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                            تعديل
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button onClick={() => setEditingBasic(false)} className={btnGhost} disabled={saving}>إلغاء</button>
                            <button onClick={saveBasicInfo}               className={btnPrimary} disabled={saving}>
                                {saving && <Spinner />} حفظ
                            </button>
                        </div>
                    )
                }
            >
                {!editingBasic ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-6">
                        <InfoRow label="الاسم الكامل"      value={profile?.name} />
                        <InfoRow label="البريد الإلكتروني" value={profile?.email} />
                        <InfoRow label="رقم الهاتف"        value={profile?.phone} />
                        <InfoRow label="الجنس"
                            value={profile?.gender === 'male' ? 'ذكر' : profile?.gender === 'female' ? 'أنثى' : null} />
                        <InfoRow label="تاريخ الميلاد"     value={formatDate(profile?.birthDate)} />
                        <InfoRow label="المدينة"            value={profile?.medicalInfo?.city} />
                    </div>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <Field label="الاسم الكامل">
                            <input className={inputCls} value={basicForm.name}
                                onChange={(e) => setBasicForm((f) => ({ ...f, name: e.target.value }))} />
                        </Field>
                        <Field label="رقم الهاتف">
                            <input className={inputCls} value={basicForm.phone}
                                onChange={(e) => setBasicForm((f) => ({ ...f, phone: e.target.value }))} />
                        </Field>
                        <Field label="الجنس">
                            <select className={inputCls} value={basicForm.gender}
                                onChange={(e) => setBasicForm((f) => ({ ...f, gender: e.target.value }))}>
                                <option value="">اختر…</option>
                                {GENDER_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                            </select>
                        </Field>
                        <Field label="تاريخ الميلاد">
                            <input type="date" className={inputCls} value={basicForm.birthDate}
                                onChange={(e) => setBasicForm((f) => ({ ...f, birthDate: e.target.value }))} />
                        </Field>
                        <Field label="المدينة">
                            <select className={inputCls} value={basicForm.city}
                                onChange={(e) => setBasicForm((f) => ({ ...f, city: e.target.value }))}>
                                <option value="">اختر مدينتك…</option>
                                {['القاهرة','الجيزة','الإسكندرية','الدقهلية','البحيرة','الشرقية','المنوفية','القليوبية','الغربية','كفر الشيخ','دمياط','بورسعيد','الإسماعيلية','السويس','الفيوم','بني سويف','المنيا','أسيوط','سوهاج','قنا','الأقصر','أسوان','البحر الأحمر','الوادي الجديد','مطروح','شمال سيناء','جنوب سيناء'].map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </Field>
                        <p className="col-span-2 lg:col-span-3 flex items-center gap-1.5 text-xs text-white/40">
                            <span className="material-symbols-outlined text-[13px]">info</span>
                            المدينة تُستخدم لعرض الدكاترة القريبين منك. البريد الإلكتروني لا يمكن تغييره.
                        </p>
                    </div>
                )}
            </SectionCard>
        </div>
    );

    /* ── البيانات الطبية ─────────────────────────────────────────────────── */
    const MedicalSection = (
        <div dir="rtl" className="space-y-5">
            <SectionCard
                title="المعلومات الصحية"
                icon="medical_information"
                action={
                    !editingMedical ? (
                        <button onClick={() => setEditingMedical(true)} className={btnOutline}>
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                            تعديل
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button onClick={() => setEditingMedical(false)} className={btnGhost} disabled={saving}>إلغاء</button>
                            <button onClick={saveMedicalInfo}               className={btnPrimary} disabled={saving}>
                                {saving && <Spinner />} حفظ
                            </button>
                        </div>
                    )
                }
            >
                {!editingMedical ? (
                    <div className="space-y-6">
                        {/* Vitals — prominent icon tiles */}
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: 'فصيلة الدم', value: mi.bloodType,                          icon: 'bloodtype',      bg: 'bg-red-500/15',    ring: 'ring-red-500/20',    tx: 'text-red-300'    },
                                { label: 'الوزن',       value: mi.weight ? `${mi.weight} كجم` : null, icon: 'monitor_weight', bg: 'bg-sky-500/15',    ring: 'ring-sky-500/20',    tx: 'text-sky-300'    },
                                { label: 'الطول',       value: mi.height ? `${mi.height} سم`  : null, icon: 'height',         bg: 'bg-violet-500/15', ring: 'ring-violet-500/20', tx: 'text-violet-300' },
                            ].map((v) => (
                                <div key={v.label}
                                    className={`${v.bg} rounded-2xl p-5 flex flex-col items-center gap-2 text-center ring-1 ${v.ring}`}>
                                    <span className={`material-symbols-outlined ${v.tx} text-[32px]`}>{v.icon}</span>
                                    <span className={`font-black text-xl leading-none ${v.tx}`}>{v.value || '—'}</span>
                                    <span className="text-[11px] text-white/50 font-semibold">{v.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Detail tiles */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            <div>
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">الأمراض المزمنة</p>
                                <TagList items={arrFromStr(mi.chronicDiseases)} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">الحساسية</p>
                                <TagList items={arrFromStr(mi.allergies)} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">الأدوية الحالية</p>
                                <TagList items={arrFromStr(mi.currentMedications)} />
                            </div>
                            <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                <InfoRow label="جهة الاتصال في الطوارئ" value={mi.emergencyContact} />
                                <InfoRow label="عمليات سابقة"           value={mi.pastSurgeries}    />
                                <InfoRow label="تاريخ المرض في العائلة" value={mi.familyHistory}    />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <Field label="فصيلة الدم">
                            <select className={inputCls} value={medicalForm.bloodType}
                                onChange={(e) => setMedicalForm((f) => ({ ...f, bloodType: e.target.value }))}>
                                <option value="">اختر…</option>
                                {BLOOD_TYPES.map((b) => <option key={b}>{b}</option>)}
                            </select>
                        </Field>
                        <Field label="الوزن (كجم)">
                            <input type="number" min="1" className={inputCls} value={medicalForm.weight}
                                onChange={(e) => setMedicalForm((f) => ({ ...f, weight: e.target.value }))} />
                        </Field>
                        <Field label="الطول (سم)">
                            <input type="number" min="1" className={inputCls} value={medicalForm.height}
                                onChange={(e) => setMedicalForm((f) => ({ ...f, height: e.target.value }))} />
                        </Field>
                        <Field label="جهة الاتصال في الطوارئ">
                            <input className={inputCls} placeholder="الاسم ورقم الهاتف" value={medicalForm.emergencyContact}
                                onChange={(e) => setMedicalForm((f) => ({ ...f, emergencyContact: e.target.value }))} />
                        </Field>
                        <Field label="الأمراض المزمنة (مفصولة بفاصلة)" className="col-span-2 lg:col-span-3">
                            <input className={inputCls} placeholder="مثال: سكر، ضغط" value={medicalForm.chronicDiseases}
                                onChange={(e) => setMedicalForm((f) => ({ ...f, chronicDiseases: e.target.value }))} />
                        </Field>
                        <Field label="الحساسية (مفصولة بفاصلة)">
                            <input className={inputCls} placeholder="مثال: بنسلين، غبار" value={medicalForm.allergies}
                                onChange={(e) => setMedicalForm((f) => ({ ...f, allergies: e.target.value }))} />
                        </Field>
                        <Field label="الأدوية الحالية (مفصولة بفاصلة)">
                            <input className={inputCls} placeholder="مثال: ميتفورمين" value={medicalForm.currentMedications}
                                onChange={(e) => setMedicalForm((f) => ({ ...f, currentMedications: e.target.value }))} />
                        </Field>
                        <Field label="عمليات سابقة">
                            <input className={inputCls} placeholder="اذكر أي عمليات جراحية" value={medicalForm.pastSurgeries}
                                onChange={(e) => setMedicalForm((f) => ({ ...f, pastSurgeries: e.target.value }))} />
                        </Field>
                        <Field label="تاريخ المرض في العائلة">
                            <input className={inputCls} placeholder="مثال: سكر في الوالد" value={medicalForm.familyHistory}
                                onChange={(e) => setMedicalForm((f) => ({ ...f, familyHistory: e.target.value }))} />
                        </Field>
                    </div>
                )}
            </SectionCard>

            {/* Medical Records */}
            <SectionCard
                title="الملفات الطبية"
                icon="folder_open"
                action={
                    !addingRecord && (
                        <button onClick={() => setAddingRecord(true)} className={btnOutline}>
                            <span className="material-symbols-outlined text-[16px]">upload_file</span>
                            إضافة ملف
                        </button>
                    )
                }
            >
                {addingRecord && (
                    <div className="mb-5 p-4 bg-white/[.05] rounded-xl border border-white/[.1] space-y-4">
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                            <Field label="نوع الملف">
                                <select className={inputCls} value={recordForm.recordType}
                                    onChange={(e) => setRecordForm((f) => ({ ...f, recordType: e.target.value }))}>
                                    {RECORD_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                            </Field>
                            <Field label="رفع ملف (PDF / صورة)">
                                <input
                                    type="file"
                                    accept=".pdf,image/jpeg,image/png,image/webp"
                                    className="block w-full text-sm text-white/60 file:mr-3 file:py-2 file:px-4
                                        file:rounded-xl file:border-0 file:text-sm file:font-bold
                                        file:bg-emerald-900/40 file:text-emerald-300 hover:file:bg-emerald-900/60 cursor-pointer"
                                    onChange={(e) => setRecordForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
                                />
                                {recordForm.file && (
                                    <p className="text-xs text-emerald-400 mt-1 font-semibold">
                                        ✓ {recordForm.file.name}
                                    </p>
                                )}
                            </Field>
                            <Field label="ملاحظة (اختياري)" className="col-span-2 lg:col-span-3">
                                <input className={inputCls} placeholder="مثال: تحليل سكر — يناير 2025"
                                    value={recordForm.note}
                                    onChange={(e) => setRecordForm((f) => ({ ...f, note: e.target.value }))} />
                            </Field>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setAddingRecord(false)} className={btnGhost}>إلغاء</button>
                            <button onClick={uploadRecord} className={btnPrimary} disabled={saving}>
                                {saving && <Spinner />} حفظ الملف
                            </button>
                        </div>
                    </div>
                )}

                {medicalRecords.length === 0 && !addingRecord ? (
                    <div className="text-center py-12">
                        <span className="material-symbols-outlined text-5xl text-white/20 block mb-3">folder_open</span>
                        <p className="text-sm text-white/40 font-medium">لا توجد ملفات طبية مرفوعة بعد.</p>
                        <button onClick={() => setAddingRecord(true)}
                            className="mt-4 text-sm text-emerald-400 font-bold hover:underline flex items-center gap-1 mx-auto">
                            <span className="material-symbols-outlined text-[15px]">add</span>
                            أضف أول ملف طبي
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-1">
                        {medicalRecords.map((rec, i) => {
                            const rt = RECORD_TYPES.find((r) => r.value === rec.recordType) || RECORD_TYPES[4];
                            return (
                                <div key={i} className="flex items-start gap-3 p-3.5 border border-white/[.1] rounded-xl hover:border-emerald-500/40 hover:bg-emerald-900/20 transition-all group">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-900/40 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-emerald-400 text-[18px]">{rt.icon}</span>
                                    </div>
                                    <button onClick={() => openRecord(rec.fileUrl)} className="flex-1 min-w-0 text-left">
                                        <p className="font-bold text-sm text-white/80 group-hover:text-emerald-300">{rt.label}</p>
                                        {rec.note && <p className="text-xs text-white/50 truncate mt-0.5">{rec.note}</p>}
                                        {rec.uploadedAt && <p className="text-[10px] text-white/35 mt-1">{formatDate(rec.uploadedAt)}</p>}
                                    </button>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => openRecord(rec.fileUrl)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/25 hover:text-emerald-400 hover:bg-emerald-900/30 transition-all"
                                            title="فتح الملف">
                                            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                        </button>
                                        <button
                                            onClick={() => setConfirmDialog({
                                                open: true,
                                                title: 'حذف السجل الطبي',
                                                message: 'هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.',
                                                onConfirm: () => { setConfirmDialog((d) => ({ ...d, open: false })); deleteRecord(rec._id); },
                                            })}
                                            disabled={deletingRecordId === rec._id}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/15 transition-all disabled:opacity-50"
                                            title="حذف السجل">
                                            {deletingRecordId === rec._id
                                                ? <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                                                : <span className="material-symbols-outlined text-[16px]">delete</span>
                                            }
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </SectionCard>
        </div>
    );

    /* ── جدول الأدوية ────────────────────────────────────────────────────── */
    const MedicationsSection = (
        <div dir="rtl" className="space-y-5">
            <SectionCard
                title="إضافة دواء جديد"
                icon="add_circle"
                action={
                    !addingMed && (
                        <button onClick={() => setAddingMed(true)} className={btnPrimary}>
                            <span className="material-symbols-outlined text-[16px]">add</span>
                            إضافة
                        </button>
                    )
                }
            >
                {addingMed ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                            <Field label="اسم الدواء *">
                                <input className={inputCls} placeholder="مثال: أسبرين" value={medForm.name}
                                    onChange={(e) => setMedForm((f) => ({ ...f, name: e.target.value }))} />
                            </Field>
                            <Field label="الجرعة">
                                <input className={inputCls} placeholder="مثال: 500 ملجم" value={medForm.dosage}
                                    onChange={(e) => setMedForm((f) => ({ ...f, dosage: e.target.value }))} />
                            </Field>
                            <Field label="التكرار">
                                <select className={inputCls} value={medForm.frequency}
                                    onChange={(e) => handleFrequencyChange(e.target.value)}>
                                    {FREQ_OPTIONS.map((fo) => <option key={fo.value} value={fo.value}>{fo.label}</option>)}
                                </select>
                            </Field>
                            <Field label="المدة">
                                <select className={inputCls} value={medForm.duration}
                                    onChange={(e) => setMedForm((f) => ({ ...f, duration: e.target.value }))}>
                                    {DURATION_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                                </select>
                            </Field>
                            {medForm.frequency === 'weekly' && (
                                <Field label="يوم الجرعة">
                                    <select className={inputCls} value={medForm.weekDay}
                                        onChange={(e) => setMedForm((f) => ({ ...f, weekDay: Number(e.target.value) }))}>
                                        {WEEKDAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                                    </select>
                                </Field>
                            )}
                        </div>

                        {/* Time slots */}
                        {medForm.frequency === 'as_needed' ? (
                            <div className="flex flex-col items-center justify-center py-4 rounded-xl bg-white/[.03] border border-white/[.08]">
                                <span className="material-symbols-outlined text-3xl text-white/20 mb-1">notifications_off</span>
                                <p className="text-xs text-white/40">لا يوجد تذكير تلقائي — الدواء يُؤخذ عند الحاجة فقط.</p>
                            </div>
                        ) : (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs font-bold text-white/50">أوقات الجرعة</label>
                                        <button type="button"
                                            onClick={() => setMedForm((f) => ({ ...f, times: FREQ_DEFAULTS[f.frequency] ?? ['08:00'] }))}
                                            className="text-[11px] text-white/30 hover:text-emerald-400 flex items-center gap-0.5 transition-colors"
                                            title="إعادة ضبط الأوقات للتكرار المختار">
                                            <span className="material-symbols-outlined text-[13px]">refresh</span>
                                            إعادة ضبط
                                        </button>
                                    </div>
                                    <button type="button" onClick={addTimeSlot}
                                        className="text-xs text-emerald-400 font-bold hover:text-emerald-300 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">add</span>
                                        إضافة وقت
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {medForm.times.map((t, idx) => (
                                        <div key={idx}
                                            className="flex items-center gap-1 bg-white/[.07] border border-white/[.15] rounded-xl overflow-hidden">
                                            <input type="time" value={t}
                                                onChange={(e) => updateTimeSlot(idx, e.target.value)}
                                                className="text-sm py-2 px-3 outline-none bg-transparent text-white" />
                                            {medForm.times.length > 1 && (
                                                <button onClick={() => removeTimeSlot(idx)}
                                                    className="w-7 h-7 flex items-center justify-center hover:bg-red-500/15 hover:text-red-300 text-white/30 transition-all ml-1 rounded-lg">
                                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pt-1">
                            <button onClick={() => setAddingMed(false)} className={btnGhost}>إلغاء</button>
                            <button onClick={addMedication} className={btnPrimary} disabled={saving}>
                                {saving && <Spinner />} إضافة الدواء
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-white/40 text-center py-4">
                        اضغط على <strong className="text-white/60">"إضافة"</strong> لإدراج دواء في جدولك اليومي.
                    </p>
                )}
            </SectionCard>

            <SectionCard title="الأدوية المسجلة" icon="medication">
                {medications.length === 0 ? (
                    <div className="text-center py-12">
                        <span className="material-symbols-outlined text-5xl text-white/20 block mb-3">medication</span>
                        <p className="text-sm text-white/40 font-medium">لا توجد أدوية مضافة بعد.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {medications.map((med, i) => {
                            const isActive = med.isActive !== false;
                            const freq     = FREQ_OPTIONS.find((f) => f.value === med.frequency)?.label || med.frequency || '';
                            return (
                                <div key={i}
                                    className={`flex items-start gap-4 p-4 rounded-xl border transition-all
                                        ${isActive ? 'border-emerald-700/30 bg-emerald-900/20' : 'border-white/10 bg-white/[.04] opacity-60'}`}>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                                        ${isActive ? 'bg-[#134e3a]' : 'bg-white/20'}`}>
                                        <span className="material-symbols-outlined text-white text-[18px]">medication</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center flex-wrap gap-2 mb-1">
                                            <p className="font-black text-white">{med.name}</p>
                                            {med.dosage && (
                                                <span className="text-xs bg-white/[.08] border border-white/[.15] rounded-full px-2 py-0.5 text-white/60">
                                                    {med.dosage}
                                                </span>
                                            )}
                                            <span className={`text-xs rounded-full px-2 py-0.5 font-bold
                                                ${isActive ? 'bg-emerald-900/40 text-emerald-300' : 'bg-white/10 text-white/40'}`}>
                                                {isActive ? 'نشط' : 'منتهي'}
                                            </span>
                                        </div>
                                        {freq && <p className="text-xs text-white/50">{freq}</p>}
                                        {med.times?.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {med.times.map((t, ti) => (
                                                    <span key={ti}
                                                        className="text-xs bg-white/[.08] border border-emerald-700/40 text-emerald-300 rounded-lg px-2.5 py-0.5 font-bold">
                                                        ⏰ {fmtTime(t)}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {(med.duration || (med.frequency === 'weekly' && med.weekDay !== null && med.weekDay !== undefined)) && (
                                            <p className="text-[11px] text-white/35 mt-1.5 flex flex-wrap gap-x-2">
                                                {med.duration && (
                                                    <span>المدة: {DURATION_OPTIONS.find(d => d.value === med.duration)?.label || med.duration}</span>
                                                )}
                                                {med.frequency === 'weekly' && med.weekDay !== null && med.weekDay !== undefined && (
                                                    <span>• يوم {WEEKDAY_OPTIONS.find(d => d.value === med.weekDay)?.label || ''}</span>
                                                )}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setConfirmDialog({
                                            open: true,
                                            title: `حذف دواء "${med.name}"`,
                                            message: 'سيتم حذف الدواء من جدولك اليومي. هل أنت متأكد؟',
                                            onConfirm: () => { setConfirmDialog((d) => ({ ...d, open: false })); deleteMedication(med._id); },
                                        })}
                                        disabled={deletingMedId === med._id}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/15 transition-all shrink-0 disabled:opacity-50"
                                        title="حذف الدواء">
                                        {deletingMedId === med._id
                                            ? <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                                            : <span className="material-symbols-outlined text-[16px]">delete</span>
                                        }
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </SectionCard>
        </div>
    );

    /* ── تغيير كلمة المرور ───────────────────────────────────────────────── */
    const PasswordSection = (
        <div dir="rtl">
            <SectionCard title="تغيير كلمة المرور" icon="lock">
                {/* Step indicator */}
                <div className="flex items-center gap-1 mb-7">
                    {[
                        { n: 1, label: 'طلب الكود'   },
                        { n: 2, label: 'التحقق'       },
                        { n: 3, label: 'كلمة المرور' },
                    ].map(({ n, label }, idx, arr) => (
                        <div key={n} className="flex items-center gap-1">
                            <div className="flex flex-col items-center gap-1">
                                <StepDot n={n} current={pwStep} />
                                <span className={`text-[10px] font-bold whitespace-nowrap
                                    ${pwStep >= n ? 'text-emerald-400' : 'text-white/35'}`}>
                                    {label}
                                </span>
                            </div>
                            {idx < arr.length - 1 && (
                                <div className={`h-0.5 w-10 mb-4 mx-1 rounded-full transition-all
                                    ${pwStep > n ? 'bg-emerald-400' : 'bg-white/15'}`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Feedback banner */}
                {pwMsg.text && (
                    <div className={`mb-5 p-3.5 rounded-xl text-sm font-medium flex items-center gap-2
                        ${pwMsg.type === 'success'
                            ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-700/40'
                            : 'bg-red-500/15 text-red-300 border border-red-500/30'}`}>
                        <span className="material-symbols-outlined text-[16px]">
                            {pwMsg.type === 'success' ? 'check_circle' : 'error'}
                        </span>
                        {pwMsg.text}
                    </div>
                )}

                {/* Step 1 */}
                {pwStep === 1 && (
                    <div className="space-y-4">
                        <p className="text-sm text-white/60">سيتم إرسال كود التحقق إلى بريدك الإلكتروني:</p>
                        <div className="flex items-center gap-2.5 px-4 py-3 bg-white/[.07] border border-white/[.15] rounded-xl">
                            <span className="material-symbols-outlined text-white/40 text-[18px]">mail</span>
                            <span className="text-sm font-semibold text-white/80">{profile?.email}</span>
                        </div>
                        <button onClick={requestPwReset} className={btnPrimary} disabled={pwBusy}>
                            {pwBusy && <Spinner />} إرسال كود التحقق
                        </button>
                    </div>
                )}

                {/* Step 2 */}
                {pwStep === 2 && (
                    <div className="space-y-4">
                        <Field label="الكود المرسل إلى بريدك الإلكتروني">
                            <input className={inputCls} placeholder="أدخل الكود المكوّن من 6 أرقام"
                                value={pwForm.code} maxLength={6}
                                onChange={(e) => setPwForm((f) => ({ ...f, code: e.target.value }))} />
                        </Field>
                        <div className="flex gap-2">
                            <button onClick={() => { setPwStep(1); setPwMsg({ text: '', type: 'success' }); }}
                                className={btnGhost}>رجوع</button>
                            <button onClick={verifyPwCode} className={btnPrimary} disabled={pwBusy}>
                                {pwBusy && <Spinner />} التحقق من الكود
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3 */}
                {pwStep === 3 && (
                    <div className="space-y-4">
                        <Field label="كلمة المرور الجديدة">
                            <div className="relative">
                                <input type={showPw ? 'text' : 'password'} className={inputCls}
                                    placeholder="أدخل كلمة المرور"
                                    value={pwForm.newPassword}
                                    onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))} />
                                <button type="button" onClick={() => setShowPw((s) => !s)}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                                    <span className="material-symbols-outlined text-[18px]">
                                        {showPw ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">
                                يجب أن تكون 8 أحرف على الأقل، وتحتوي على رقم وحرف كبير (A-Z).
                            </p>
                        </Field>
                        <Field label="تأكيد كلمة المرور">
                            <input type={showPw ? 'text' : 'password'} className={inputCls}
                                placeholder="أعد إدخال كلمة المرور"
                                value={pwForm.confirmPassword}
                                onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))} />
                        </Field>
                        {pwForm.newPassword && pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
                            <p className="text-xs text-red-300 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">error</span>
                                كلمتا المرور غير متطابقتين
                            </p>
                        )}
                        <button onClick={doResetPassword} className={btnPrimary} disabled={pwBusy}>
                            {pwBusy && <Spinner />} تغيير كلمة المرور
                        </button>
                    </div>
                )}
            </SectionCard>
        </div>
    );

    /* ── تاريخ الزيارات ─────────────────────────────────────────────────── */

    // Group visits (bookings + walk-ins) by doctor id
    const visitsByDoctor = visits.reduce((acc, v) => {
        const did = v.doctor?._id || 'unknown';
        if (!acc[did]) acc[did] = { doctor: v.doctor, doctorProfile: v.doctorProfile, visits: [] };
        acc[did].visits.push(v);
        return acc;
    }, {});
    const doctorGroups = Object.values(visitsByDoctor);

    const HistorySection = (
        <div dir="rtl" className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-black text-white text-base">تاريخ زياراتي</h3>
                    <p className="text-xs text-white/40 mt-0.5">الزيارات المكتملة مع ملاحظات الطبيب</p>
                </div>
                <span className="text-xs font-bold text-emerald-300 bg-emerald-900/30 px-3 py-1.5 rounded-full border border-emerald-700/40">
                    {doctorGroups.length} طبيب
                </span>
            </div>

            {visitsLoading ? (
                <div className="flex justify-center py-20">
                    <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                </div>
            ) : doctorGroups.length === 0 ? (
                <div className="bg-white/[.05] rounded-2xl border border-white/[.08] p-16 text-center">
                    <span className="material-symbols-outlined text-[48px] text-white/20 block mb-3">history</span>
                    <p className="text-white/40 font-semibold">لا توجد زيارات مكتملة بعد</p>
                    <p className="text-white/25 text-xs mt-1">ستظهر ملاحظات الطبيب هنا بعد انتهاء كل زيارة</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {doctorGroups.map((group) => {
                        const did      = group.doctor?._id || 'unknown';
                        const isOpen   = expandedDoctor === did;
                        const hasNotes = group.visits.some(v =>
                            v._source === 'walkin' ? v.notes : v.closingNote
                        );

                        return (
                            <div key={did} className="bg-white/[.06] rounded-2xl border border-white/[.1] overflow-hidden">
                                {/* Doctor header — clickable */}
                                <button
                                    onClick={() => setExpandedDoctor(isOpen ? null : did)}
                                    className="w-full flex items-center gap-4 px-6 py-5 hover:bg-white/[.05] transition-colors text-right"
                                >
                                    {/* Avatar */}
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#134e3a] to-[#2d6a4f] flex items-center justify-center shrink-0 shadow-sm">
                                        <span className="text-white font-black text-base">
                                            {group.doctor?.name?.charAt(0) || 'د'}
                                        </span>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 text-right">
                                        <p className="font-bold text-white text-sm">د. {group.doctor?.name || '—'}</p>
                                        <p className="text-xs text-white/40 mt-0.5">{group.doctorProfile?.specialization || '—'}</p>
                                    </div>

                                    {/* Meta chips */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs font-bold text-emerald-300 bg-emerald-900/30 px-2.5 py-1 rounded-full">
                                            {group.visits.length} {group.visits.length === 1 ? 'زيارة' : 'زيارات'}
                                        </span>
                                        {hasNotes && (
                                            <span className="text-xs font-bold text-blue-300 bg-blue-500/15 px-2.5 py-1 rounded-full">
                                                ملاحظات
                                            </span>
                                        )}
                                        <span className="material-symbols-outlined text-white/40 text-[20px] transition-transform duration-200"
                                            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                            keyboard_arrow_down
                                        </span>
                                    </div>
                                </button>

                                {/* Visits timeline — shown when expanded */}
                                {isOpen && (
                                    <div className="border-t border-white/[.08] px-6 py-4 space-y-4 bg-white/[.03]">
                                        {group.visits.map((v, idx) => {
                                            const isWalkIn  = v._source === 'walkin';
                                            const visitDate = isWalkIn ? v.date : v.slotDetails?.date;
                                            const visitTime = isWalkIn ? v.arrivalTime : v.slotDetails?.startTime;
                                            const visitNote = isWalkIn ? v.notes : v.closingNote;
                                            const visitFee  = isWalkIn ? v.fee : v.consultationFee;

                                            return (
                                                <div key={idx} className="flex gap-4">
                                                    {/* Timeline dot */}
                                                    <div className="flex flex-col items-center shrink-0">
                                                        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${isWalkIn ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                                                        {idx < group.visits.length - 1 && (
                                                            <div className="w-px flex-1 bg-white/20 mt-1.5" />
                                                        )}
                                                    </div>

                                                    {/* Visit card */}
                                                    <div className="flex-1 pb-4">
                                                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                                                            {/* Type badge */}
                                                            {isWalkIn ? (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 flex items-center gap-1">
                                                                    <span className="material-symbols-outlined text-[11px]">directions_walk</span>
                                                                    زيارة مباشرة
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center gap-1">
                                                                    <span className="material-symbols-outlined text-[11px]">calendar_month</span>
                                                                    حجز
                                                                </span>
                                                            )}
                                                            <span className="text-sm font-bold text-white/80">
                                                                {formatDate(visitDate)}
                                                            </span>
                                                            {visitTime && (
                                                                <span className="text-xs text-white/40 flex items-center gap-1">
                                                                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                                                                    {fmtTime(visitTime)}
                                                                </span>
                                                            )}
                                                            {visitFee > 0 && (
                                                                <span className="text-xs font-semibold text-emerald-300 bg-emerald-900/30 px-2 py-0.5 rounded-full mr-auto">
                                                                    {visitFee} جنيه
                                                                </span>
                                                            )}
                                                        </div>

                                                        {visitNote ? (
                                                            <div className="bg-white/[.05] rounded-xl border border-white/[.08] p-4">
                                                                <p className="text-[10px] font-bold text-white/35 uppercase tracking-wider mb-2">
                                                                    ملاحظة الطبيب
                                                                </p>
                                                                <p className="text-sm text-white/70 leading-relaxed">{visitNote}</p>
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-white/35 italic">لا توجد ملاحظات لهذه الزيارة</p>
                                                        )}

                                                        {v.followUp?.enabled && v.followUp?.scheduledFor && (
                                                            <div className="mt-2 flex items-center gap-2 text-xs text-teal-300 bg-teal-500/15 px-3 py-1.5 rounded-xl border border-teal-500/25 w-fit">
                                                                <span className="material-symbols-outlined text-[13px]">autorenew</span>
                                                                إعادة كشف: {formatDate(v.followUp.scheduledFor)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    // ── Danger Zone section — delete account (PDPL Art.16 Right to Erasure) ─────

    const handleDeleteAccount = async (e) => {
        e.preventDefault();
        if (!deletePassword) return;
        setDeleting(true);
        try {
            await axiosInstance.delete('/auth/account', { data: { password: deletePassword } });
            signOut();
            navigate('/register', { replace: true });
        } catch (err) {
            showToast(err.response?.data?.message || 'خطأ في حذف الحساب', 'error');
            setDeleting(false);
        }
    };

    const DangerSection = (
        <div className="space-y-6" dir="rtl">
            <div>
                <h2 className="text-xl font-bold text-white mb-1">البيانات والخصوصية</h2>
                <p className="text-white/50 text-sm">حقوقك بموجب قانون حماية البيانات الشخصية رقم 151 لسنة 2020.</p>
            </div>

            {/* ── Art.15 — تحميل نسخة من البيانات ────────────────────────────── */}
            <div className="bg-blue-950/30 border border-blue-500/30 rounded-2xl p-6">
                <div className="flex items-start gap-4 mb-4">
                    <span className="material-symbols-outlined text-blue-400 text-[28px] shrink-0 mt-0.5">download</span>
                    <div>
                        <h3 className="text-blue-300 font-bold text-base mb-1">تحميل نسخة من بياناتك</h3>
                        <p className="text-blue-200/70 text-sm leading-relaxed">
                            احصل على ملف يحتوي على جميع بياناتك الشخصية والصحية والحجوزات والزيارات بصيغة JSON.
                            <span className="block mt-1 text-blue-300/50 text-xs">المادة (15) — حق الحصول على البيانات ونقلها</span>
                        </p>
                    </div>
                </div>
                <button
                    onClick={exportData}
                    disabled={exporting}
                    className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/35 border border-blue-500/50 text-blue-300 px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {exporting
                        ? <><span className="w-4 h-4 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin shrink-0" /> جارٍ التحميل…</>
                        : <><span className="material-symbols-outlined text-[18px]">download</span> تحميل بياناتي (JSON)</>
                    }
                </button>
                <p className="text-xs text-blue-400/40 mt-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">info</span>
                    مسموح بـ 3 تنزيلات كل 15 دقيقة
                </p>
            </div>

            {/* ── Art.16 — حذف الحساب ─────────────────────────────────────────── */}
            <div className="bg-red-950/30 border border-red-500/40 rounded-2xl p-6">
                <div className="flex items-start gap-4 mb-5">
                    <span className="material-symbols-outlined text-red-400 text-[28px] shrink-0 mt-0.5">warning</span>
                    <div>
                        <h3 className="text-red-300 font-bold text-base mb-1">حذف الحساب نهائياً</h3>
                        <p className="text-red-200/70 text-sm leading-relaxed">
                            سيتم حذف حسابك، ملفك الصحي، جدول أدويتك، وجميع سجلاتك الطبية بشكل دائم لا يمكن استرجاعه.
                            <span className="block mt-1 text-red-300/50 text-xs">المادة (16) — حق المحو وإلغاء الموافقة</span>
                        </p>
                    </div>
                </div>

                {!deleteConfirm ? (
                    <button
                        onClick={() => setDeleteConfirm(true)}
                        className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-300 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
                    >
                        <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                        أريد حذف حسابي
                    </button>
                ) : (
                    <form onSubmit={handleDeleteAccount} className="space-y-4">
                        <p className="text-red-300 text-sm font-bold">أدخل كلمة المرور للتأكيد:</p>
                        <input
                            type="password"
                            value={deletePassword}
                            onChange={(e) => setDeletePassword(e.target.value)}
                            placeholder="كلمة المرور الحالية"
                            className="w-full bg-black/30 border border-red-500/40 text-white placeholder-white/30 px-4 py-3 rounded-xl text-sm outline-none focus:border-red-400"
                            required
                        />
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                disabled={deleting || !deletePassword}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {deleting
                                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> جارٍ الحذف...</>
                                    : <><span className="material-symbols-outlined text-[18px]">delete_forever</span> تأكيد حذف الحساب</>
                                }
                            </button>
                            <button
                                type="button"
                                onClick={() => { setDeleteConfirm(false); setDeletePassword(''); }}
                                className="px-5 py-2.5 border border-white/20 text-white/60 rounded-xl text-sm font-bold hover:bg-white/10 transition-all"
                            >
                                إلغاء
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );

    const sectionMap = {
        basic:       BasicSection,
        medical:     MedicalSection,
        medications: MedicationsSection,
        history:     HistorySection,
        password:    PasswordSection,
        danger:      DangerSection,
    };

    // ══════════════════════════════════════════════════════════════════════════
    //  RENDER
    // ══════════════════════════════════════════════════════════════════════════
    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0b2d20] via-[#103d2a] to-[#1a4d35] font-['Cairo'] flex flex-col">

            {/* ── Confirm dialog ─────────────────────────────────────────────── */}
            <ConfirmDialog
                {...confirmDialog}
                onCancel={() => setConfirmDialog((d) => ({ ...d, open: false }))}
            />

            {/* ── Toast notification ─────────────────────────────────────────── */}
            {toast.msg && (
                <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-2xl shadow-xl
                    text-sm font-bold flex items-center gap-2 pointer-events-none
                    ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-[#134e3a] text-white'}`}>
                    <span className="material-symbols-outlined text-[16px]">
                        {toast.type === 'error' ? 'error' : 'check_circle'}
                    </span>
                    {toast.msg}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                HEADER — matches PatientDashboard exactly
            ══════════════════════════════════════════════════════════════════ */}
            <header className="bg-[#1a6b4e] border-b border-[#155d44] shadow-md">
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

                    {/* Centre nav */}
                    <nav className="hidden md:flex items-center gap-1 bg-white/10 rounded-2xl px-2 py-1.5">
                        {[
                            { to: '/dashboard',    icon: 'home',           label: 'الرئيسية'  },
                            { to: '/chat',         icon: 'smart_toy',      label: 'مساعد AI'  },
                            { to: '/appointments', icon: 'calendar_month', label: 'مواعيدي'   },
                            { to: '/doctors',      icon: 'groups',         label: 'الأطباء'   },
                        ].map(({ to, icon, label }) => (
                            <Link key={to} to={to}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white/75 hover:text-white hover:bg-white/15 transition-all">
                                <span className="material-symbols-outlined text-[17px]">{icon}</span>
                                {label}
                            </Link>
                        ))}
                    </nav>

                    {/* Right: mobile hamburger */}
                    <div className="flex items-center gap-2.5">
                        <button onClick={() => setMobileMenuOpen((o) => !o)}
                            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 transition-colors">
                            <span className="material-symbols-outlined text-[20px] text-white">
                                {mobileMenuOpen ? 'close' : 'menu'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Mobile drawer */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t border-white/15 px-4 py-3 flex flex-col gap-1 bg-[#134e3a]">
                        {[
                            { to: '/dashboard',       icon: 'home',           label: 'الرئيسية'   },
                            { to: '/chat',            icon: 'smart_toy',      label: 'مساعد AI'   },
                            { to: '/appointments',    icon: 'calendar_month', label: 'مواعيدي'    },
                            { to: '/doctors',         icon: 'groups',         label: 'الأطباء'    },
                            { to: '/doctor-register', icon: 'stethoscope',    label: 'انضم كطبيب' },
                        ].map(({ to, icon, label }) => (
                            <Link key={to} to={to} onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-white/80 hover:bg-white/10 hover:text-white font-semibold text-sm transition-colors">
                                <span className="material-symbols-outlined text-[18px]">{icon}</span>
                                {label}
                            </Link>
                        ))}
                        {/* Profile section shortcuts */}
                        <div className="border-t border-white/15 pt-2 mt-1" dir="rtl">
                            <p className="px-4 pb-1 text-[10px] font-bold text-white/50 uppercase tracking-widest">
                                إعدادات الملف
                            </p>
                            {MENU.map((item) => (
                                <button key={item.id}
                                    onClick={() => { setActiveSection(item.id); setMobileMenuOpen(false); }}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors text-right
                                        ${activeSection === item.id ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                                    {item.label}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => { signOut(); navigate('/login'); }}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-300 hover:bg-white/10 font-semibold text-sm transition-colors mt-1 border-t border-white/15 pt-3">
                            <span className="material-symbols-outlined text-[18px]">logout</span>
                            تسجيل الخروج
                        </button>
                    </div>
                )}
            </header>

            {/* ══════════════════════════════════════════════════════════════════
                BODY — sidebar + content (dir=rtl makes sidebar appear on right)
            ══════════════════════════════════════════════════════════════════ */}
            <div dir="rtl" className="flex flex-1">

                {/* ── RIGHT SIDEBAR — desktop ──────────────────────────────── */}
                <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 flex-col sticky top-0 h-screen bg-white/[.05] border-l border-white/[.08] overflow-y-auto backdrop-blur-sm [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-emerald-700/50 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-emerald-600/70 [scrollbar-width:thin] [scrollbar-color:rgba(4,120,87,0.5)_transparent]">

                    {/* Mini profile */}
                    <div className="px-5 py-5 border-b border-white/[.08]">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => picInputRef.current?.click()}
                                disabled={uploadingPic}
                                className="relative w-12 h-12 rounded-xl shrink-0 group focus:outline-none"
                                title="تغيير الصورة"
                            >
                                {avatarSrc ? (
                                    <img
                                        src={avatarSrc}
                                        alt="صورة الملف الشخصي"
                                        className="w-12 h-12 rounded-xl object-cover"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#134e3a] to-[#2d6a4f] flex items-center justify-center shadow-sm">
                                        <span className="font-black text-white text-base">{getInitials(profile?.name)}</span>
                                    </div>
                                )}
                                <div className="absolute inset-0 rounded-xl bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white text-[14px]">photo_camera</span>
                                </div>
                            </button>
                            <div className="min-w-0">
                                <p className="font-bold text-white text-sm truncate">{profile?.name || 'مريض'}</p>
                                <p className="text-xs text-white/45 truncate">{profile?.email}</p>
                            </div>
                        </div>
                        {/* Completion nudge */}
                        {(!mi.bloodType || !mi.weight) && (
                            <div className="mt-3 px-3 py-2 bg-amber-500/15 border border-amber-500/25 rounded-xl flex items-center gap-2">
                                <span className="material-symbols-outlined text-amber-400 text-[15px]">info</span>
                                <p className="text-xs text-amber-300 font-semibold">أكمل بياناتك الطبية</p>
                            </div>
                        )}
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-3 py-4 space-y-0.5">
                        <p className="px-4 mb-2 text-[10px] font-bold text-white/35 uppercase tracking-widest">
                            إعدادات الملف
                        </p>
                        {MENU.map((item) => {
                            const isActive = activeSection === item.id;
                            if (item.danger) return (
                                <button key={item.id} onClick={() => setActiveSection(item.id)}
                                    className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-right mt-2 border-t border-white/[.06] pt-3
                                        ${isActive ? 'bg-red-900/40 text-red-300' : 'text-red-400/60 hover:bg-red-500/10 hover:text-red-300'}`}>
                                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                                    {item.label}
                                </button>
                            );
                            return (
                                <button key={item.id} onClick={() => setActiveSection(item.id)}
                                    className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-right
                                        ${isActive
                                            ? 'bg-emerald-900/40 text-emerald-300'
                                            : 'text-white/60 hover:bg-white/[.08] hover:text-white'}`}>
                                    {isActive && (
                                        <span className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-400 rounded-full" />
                                    )}
                                    <span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-emerald-400' : 'text-white/35'}`}>
                                        {item.icon}
                                    </span>
                                    {item.label}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Footer actions */}
                    <div className="px-3 pb-5 pt-2 border-t border-white/[.08] space-y-1">
                        <button onClick={() => navigate('/dashboard')}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-white/60 hover:bg-white/[.08] transition-all">
                            <span className="material-symbols-outlined text-[20px] text-white/35">arrow_back</span>
                            الرئيسية
                        </button>
                        <button onClick={() => { signOut(); navigate('/login'); }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/15 transition-all">
                            <span className="material-symbols-outlined text-[20px]">logout</span>
                            تسجيل الخروج
                        </button>
                    </div>
                </aside>

                {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
                <main className="flex-1 min-w-0">
                    <div className="max-w-[1440px] mx-auto px-6 md:px-10 py-8 pb-10 lg:pb-8">
                        {sectionMap[activeSection]}
                    </div>
                </main>
            </div>

            <Footer />

            {/* ── BOTTOM NAV — mobile only ──────────────────────────────────── */}
            <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0d2e1f]/95 backdrop-blur-sm border-t border-white/[.1] flex items-center justify-around px-2 py-1.5">
                {MENU.map((item) => (
                    <button key={item.id} onClick={() => setActiveSection(item.id)}
                        className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-0
                            ${activeSection === item.id ? 'text-emerald-400' : 'text-white/40'}`}>
                        <span className={`material-symbols-outlined text-[22px]
                            ${activeSection === item.id ? 'text-emerald-400' : 'text-white/40'}`}>
                            {item.icon}
                        </span>
                        <span className="text-[9px] font-bold truncate max-w-[56px] text-center">
                            {item.label.split(' ')[0]}
                        </span>
                    </button>
                ))}
                <button onClick={() => navigate('/dashboard')}
                    className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-white/40">
                    <span className="material-symbols-outlined text-[22px]">home</span>
                    <span className="text-[9px] font-bold">الرئيسية</span>
                </button>
            </nav>
        </div>
    );
}

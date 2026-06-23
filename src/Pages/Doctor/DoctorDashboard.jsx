/**
 * DoctorDashboard.jsx
 *
 * Root view for authenticated doctors. Manages all doctor-facing state: bookings,
 * walk-ins, operations, notifications, and the SSE real-time channel.
 *
 * Sub-views (TodayQueue, ScheduleManager, Analytics) are conditionally mounted
 * via activeSection so each view manages its own data loading independently.
 *
 * SSE strategy: a one-time ticket is fetched before opening EventSource so the
 * JWT access token never appears in server logs or browser history. Reconnects
 * with exponential backoff (1 s → 30 s cap) on disconnect.
 *
 * Fetch coordination: isFetchingRef prevents parallel in-flight requests from
 * SSE bursts or cancel/re-fetch races that would flood Redis and trip the rate
 * limiter. debouncedFetch collapses SSE events arriving within 400 ms into one
 * request; direct calls (mount, cancel, note-save) bypass the debounce.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import ScheduleManager from './ScheduleManager';
import TodayQueue, { ClosingNoteModal, WalkInClosingModal } from './TodayQueue';
import Analytics from './Analytics';
import FollowUps from './FollowUps';
import { NOTIF_ICON, timeAgo } from '../../utils/notifHelpers';
import { fmtTime } from '../../utils/timeFormat';
import Footer from '../../components/Footer';


const SERVER_BASE = new URL(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').origin;

/**
 * Plays a two-tone chime using the Web Audio API when an SSE event arrives.
 * No audio asset file is needed — the waveform is synthesized at runtime so
 * the bundle stays lean.
 */
const playNotificationSound = () => {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx  = new AudioCtx();
        const play = (freq, start, len) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.28, start + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, start + len);
            osc.start(start);
            osc.stop(start + len);
        };
        const t = ctx.currentTime;
        play(880,  t,        0.25);   // A5 — first tone
        play(1108, t + 0.18, 0.35);   // C#6 — higher tone
        setTimeout(() => ctx.close(), 1500);
    } catch { /* non-critical */ }
};

const fmt = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ar-EG', {
        year: 'numeric', month: 'long', day: 'numeric',
    });
};

const calcAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
};

const statusLabel = {
    pending:      { text: 'قيد الانتظار',  cls: 'bg-yellow-100 text-yellow-700'  },
    confirmed:    { text: 'مؤكد',          cls: 'bg-emerald-100 text-emerald-700' },
    'in-progress':{ text: 'جاري الكشف',   cls: 'bg-blue-100 text-blue-700'       },
    cancelled:    { text: 'ملغي',          cls: 'bg-red-100 text-red-700'         },
    completed:    { text: 'مكتمل',         cls: 'bg-gray-100 text-gray-500'       },
};

/** True if the given ISO date string falls on today's calendar date (local time). */
const isToday = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const t = new Date();
    return d.getFullYear() === t.getFullYear() &&
           d.getMonth()    === t.getMonth()    &&
           d.getDate()     === t.getDate();
};

/** Number of whole calendar days until the given ISO date (0 = today, 1 = tomorrow, …). */
const daysUntil = (dateStr) => {
    if (!dateStr) return 0;
    const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
    const t = new Date();        t.setHours(0, 0, 0, 0);
    return Math.ceil((d - t) / 86_400_000);
};

const bkStatusCategory = (s) => {
    if (['pending', 'confirmed', 'in-progress'].includes(s)) return 'pending';
    if (s === 'completed') return 'completed';
    return 'cancelled';
};

const wiStatusCategory = (s) => {
    if (['waiting', 'in-progress'].includes(s)) return 'pending';
    if (s === 'done') return 'completed';
    return 'cancelled';
};

/**
 * PatientDrawer — 360° patient profile panel.
 *
 * Fetches the full patient history for this doctor and merges bookings, walk-ins,
 * and operations into one timeline sorted newest-first. Also surfaces peer
 * specialist notes, medical profile data, and uploaded records in one view.
 * Rendered as a spring-animated slide-over overlay from the left edge.
 */

function SectionTitle({ icon, title }) {
    return (
        <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            <span className="material-symbols-outlined text-[16px] text-emerald-600">{icon}</span>
            <h3 className="font-black text-[#134e3a] text-sm">{title}</h3>
        </div>
    );
}

function InfoRow({ label, value }) {
    return (
        <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
            <p className="text-sm font-semibold text-[#191c1c]">{value || '—'}</p>
        </div>
    );
}

function TagRow({ label, tags, color }) {
    const colors = { red: 'bg-red-50 text-red-600', orange: 'bg-orange-50 text-orange-600', green: 'bg-emerald-50 text-emerald-700' };
    return (
        <div className="mt-3">
            <p className="text-[10px] text-gray-400 mb-1.5">{label}</p>
            <div className="flex flex-wrap gap-1.5">
                {tags.map((t, i) => (
                    <span key={i} className={`text-xs font-semibold px-3 py-1 rounded-full ${colors[color]}`}>{t}</span>
                ))}
            </div>
        </div>
    );
}

function NoteRow({ label, value }) {
    return (
        <div className="mt-3 bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 mb-1">{label}</p>
            <p className="text-xs text-gray-600 leading-relaxed">{value}</p>
        </div>
    );
}

function PatientDrawer({ patientId, onClose, isSecretary, historyOnly = false }) {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!patientId) return;
        setLoading(true);
        // Secretary gets admin-only info; doctor gets full medical history
        const endpoint = isSecretary
            ? `/doctors/patient/${patientId}/admin-info`
            : `/doctors/patient/${patientId}/history`;
        axiosInstance.get(endpoint)
            .then(({ data: res }) => setData(res.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [patientId, isSecretary]);

    // Secretary gets a flat admin-info object; doctor gets the full nested history object
    const p             = isSecretary ? (data ?? {}) : (data?.patient        ?? {});
    const mp            = isSecretary ? {}            : (data?.medicalProfile ?? {});
    const peerVisits    = isSecretary ? []            : (data?.peerVisits     ?? []);
    const records       = isSecretary ? []            : (mp?.medicalRecords   ?? []);
    const allOperations = isSecretary ? []            : (data?.allOperations  ?? []);

    const allVisits = [
        ...(data?.myVisits      ?? []).map(v => ({ ...v, _vtype: 'booking',   _date: v.slotDetails?.date })),
        ...(data?.myWalkIns     ?? []).map(v => ({ ...v, _vtype: 'walkin',    _date: v.date })),
        ...(data?.myOperations  ?? []).map(v => ({ ...v, _vtype: 'operation', _date: v.date })),
    ].sort((a, b) => new Date(b._date) - new Date(a._date));

    return (
        <motion.div
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed inset-y-0 left-0 w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto"
            dir="rtl"
        >
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3 z-10">
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                    <span className="material-symbols-outlined text-gray-500">close</span>
                </button>
                {p.profilePicture ? (
                    <img
                        src={`${SERVER_BASE}${p.profilePicture}`}
                        alt={p.name}
                        className="w-11 h-11 rounded-full object-cover border-2 border-emerald-100 shrink-0"
                    />
                ) : (
                    <div className="w-11 h-11 rounded-full bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-emerald-400 text-xl">person</span>
                    </div>
                )}
                <div>
                    <h2 className="font-black text-[#134e3a] text-base">{p.name || (historyOnly ? 'سجل الزيارات' : 'ملف المريض الشامل')}</h2>
                    <p className="text-xs text-gray-400">{historyOnly ? 'سجل الزيارات فقط' : '360° Patient View'}</p>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                </div>
            ) : !data ? (
                <div className="p-8 text-center text-gray-400">تعذّر تحميل البيانات</div>
            ) : (
                <div className="p-6 flex flex-col gap-6">
                    {isSecretary && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-500 text-[18px]">info</span>
                            <p className="text-xs text-amber-700 font-semibold">عرض البيانات الإدارية فقط — التاريخ الطبي متاح للطبيب</p>
                        </div>
                    )}
                    <section>
                        <SectionTitle icon="person" title="البيانات الشخصية" />
                        <div className="mt-3 grid grid-cols-2 gap-3">
                            <InfoRow label="الاسم"   value={p.name} />
                            <InfoRow label="الجنس"   value={p.gender === 'male' ? 'ذكر' : p.gender === 'female' ? 'أنثى' : '—'} />
                            <InfoRow label="العمر"   value={isSecretary ? (p.age != null ? `${p.age} سنة` : null) : (calcAge(p.birthDate) != null ? `${calcAge(p.birthDate)} سنة` : null)} />
                            <InfoRow label="الهاتف"  value={p.phone} />
                        </div>
                    </section>
                    {isSecretary && (
                        <section>
                            <SectionTitle icon="bloodtype" title="فصيلة الدم" />
                            <div className="mt-3">
                                <InfoRow label="فصيلة الدم" value={p.bloodType} />
                            </div>
                        </section>
                    )}

                    {!isSecretary && (<>
                    {!historyOnly && (<>
                    <section>
                        <SectionTitle icon="medical_information" title="المعلومات الطبية" />
                        <div className="mt-3 grid grid-cols-3 gap-3">
                            <InfoRow label="فصيلة الدم"  value={mp.bloodType} />
                            <InfoRow label="الوزن"       value={mp.weight ? `${mp.weight} كجم` : null} />
                            <InfoRow label="الطول"       value={mp.height ? `${mp.height} سم`  : null} />
                        </div>
                        {mp.chronicDiseases?.length > 0 && <TagRow label="الأمراض المزمنة" tags={mp.chronicDiseases} color="red" />}
                        {mp.allergies?.length        > 0 && <TagRow label="الحساسية"        tags={mp.allergies}       color="orange" />}

                        {(mp.pastSurgeries || allOperations.length > 0) && (
                            <div className="mt-3">
                                <p className="text-[10px] font-bold text-gray-400 mb-2">العمليات السابقة</p>
                                {mp.pastSurgeries && (
                                    <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-xs text-gray-600 border border-gray-100 mb-2 leading-relaxed">
                                        {mp.pastSurgeries}
                                    </div>
                                )}
                                {allOperations.map((op) => {
                                    const opStatusMap = {
                                        scheduled: { ar: 'مجدولة',  cls: 'bg-violet-100 text-violet-700' },
                                        done:      { ar: 'مكتملة',  cls: 'bg-emerald-100 text-emerald-700' },
                                        cancelled: { ar: 'ملغية',   cls: 'bg-red-100 text-red-600' },
                                    };
                                    const st = opStatusMap[op.status] ?? opStatusMap.scheduled;
                                    return (
                                        <div key={op._id} className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs mb-2">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-purple-800">{fmt(op.date)}</span>
                                                <div className="flex items-center gap-1.5">
                                                    {op.time && <span className="text-gray-400">{fmtTime(op.time)}</span>}
                                                    <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${st.cls}`}>{st.ar}</span>
                                                </div>
                                            </div>
                                            <p className="font-semibold text-purple-900">{op.operationType}</p>
                                            {op.doctor?.name && (
                                                <p className="text-gray-500 mt-0.5">
                                                    <span className="font-semibold">د. </span>{op.doctor.name}
                                                </p>
                                            )}
                                            {op.location && <p className="text-gray-500 mt-0.5">📍 {op.location}</p>}
                                            {op.notes    && <p className="text-gray-600 mt-1 leading-relaxed"><span className="font-semibold text-purple-700">ملاحظة: </span>{op.notes}</p>}
                                            {op.fee > 0  && <p className="text-emerald-600 font-semibold mt-1">{op.fee} جنيه</p>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {mp.familyHistory      && <NoteRow label="التاريخ العائلي"   value={mp.familyHistory} />}
                        {mp.emergencyContact   && <NoteRow label="جهة الطوارئ"       value={mp.emergencyContact} />}
                    </section>

                    {(mp.medications?.some(m => m.isActive) || mp.currentMedications) && (
                        <section>
                            <SectionTitle icon="medication" title="الأدوية" />
                            <div className="mt-3 flex flex-col gap-2">
                                {mp.medications?.filter(m => m.isActive).map((med, i) => (
                                    <div key={i} className="bg-emerald-50 rounded-xl p-3 text-sm">
                                        <p className="font-bold text-[#134e3a]">{med.name}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {[med.dosage, med.frequency].filter(Boolean).join(' — ')}
                                        </p>
                                    </div>
                                ))}
                                {mp.currentMedications && (
                                    <TagRow
                                        label="ملاحظات إضافية"
                                        tags={mp.currentMedications.split(/[،,]/).map((s) => s.trim()).filter(Boolean)}
                                        color="green"
                                    />
                                )}
                            </div>
                        </section>
                    )}

                    </>)}
                    <section>
                        <SectionTitle icon="history" title="سجل الزيارات" />
                        {allVisits.length === 0 ? (
                            <p className="mt-3 text-xs text-gray-400 bg-gray-50 rounded-xl p-3 text-center">
                                لا توجد زيارات مكتملة بعد
                            </p>
                        ) : (
                            <div className="mt-3 flex flex-col gap-2">
                                {allVisits.map((v) => {
                                    if (v._vtype === 'booking') {
                                        const bIsFollowUp = v.isFollowUp === true;
                                        return (
                                            <div key={`b-${v._id}`} className={`border rounded-xl p-3 text-xs ${bIsFollowUp ? 'bg-sky-50 border-sky-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className={`font-bold ${bIsFollowUp ? 'text-sky-700' : 'text-[#134e3a]'}`}>{fmt(v.slotDetails?.date)}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-400">{fmtTime(v.slotDetails?.startTime)}</span>
                                                        <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${bIsFollowUp ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                            {bIsFollowUp ? 'إعادة كشف' : 'كشف'}
                                                        </span>
                                                    </div>
                                                </div>
                                                {v.closingNote
                                                    ? <p className="text-gray-700 leading-relaxed mt-1"><span className={`font-semibold ${bIsFollowUp ? 'text-sky-700' : 'text-[#134e3a]'}`}>ملاحظة: </span>{v.closingNote}</p>
                                                    : <p className="text-gray-400 italic">بدون ملاحظة</p>}
                                            </div>
                                        );
                                    }
                                    if (v._vtype === 'walkin') {
                                        const wIsFollowUp = v.isFollowUp === true;
                                        return (
                                            <div key={`w-${v._id}`} className={`border rounded-xl p-3 text-xs ${wIsFollowUp ? 'bg-sky-50 border-sky-100' : 'bg-amber-50 border-amber-100'}`}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className={`font-bold ${wIsFollowUp ? 'text-sky-700' : 'text-amber-800'}`}>{fmt(v.date)}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-400">{fmtTime(v.arrivalTime)}</span>
                                                        <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${wIsFollowUp ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {wIsFollowUp ? 'إعادة كشف' : 'زيارة'}
                                                        </span>
                                                    </div>
                                                </div>
                                                {v.complaint && <p className="text-gray-600 mt-1"><span className={`font-semibold ${wIsFollowUp ? 'text-sky-700' : 'text-amber-700'}`}>الشكوى: </span>{v.complaint}</p>}
                                                {v.notes     && <p className="text-gray-600 mt-1"><span className={`font-semibold ${wIsFollowUp ? 'text-sky-700' : 'text-amber-700'}`}>ملاحظة: </span>{v.notes}</p>}
                                                {v.fee > 0   && <p className="text-emerald-600 font-semibold mt-1">{v.fee} جنيه</p>}
                                            </div>
                                        );
                                    }
                                    if (v._vtype === 'operation') return (
                                        <div key={`o-${v._id}`} className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-purple-800">{fmt(v.date)}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-gray-400">{fmtTime(v.time)}</span>
                                                    <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold text-[10px]">عملية</span>
                                                </div>
                                            </div>
                                            <p className="text-gray-700 font-semibold">{v.operationType}</p>
                                            {v.location && <p className="text-gray-500 mt-0.5">📍 {v.location}</p>}
                                            {v.notes    && <p className="text-gray-600 mt-1"><span className="font-semibold text-purple-700">ملاحظة: </span>{v.notes}</p>}
                                            {v.fee > 0  && <p className="text-emerald-600 font-semibold mt-1">{v.fee} جنيه</p>}
                                        </div>
                                    );
                                    return null;
                                })}
                            </div>
                        )}
                    </section>

                    {!historyOnly && peerVisits.length > 0 && (
                        <section>
                            <SectionTitle icon="group" title="ملاحظات متخصصين آخرين" />
                            <div className="mt-3 flex flex-col gap-2">
                                {peerVisits.map((b) => (
                                    <div key={b._id} className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-blue-700">{fmt(b.slotDetails?.date)}</span>
                                            <span className="text-[10px] text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full font-semibold">
                                                د. {b.doctor?.name}
                                            </span>
                                        </div>
                                        <p className="text-gray-700 leading-relaxed mt-1">
                                            <span className="font-semibold text-blue-700">ملاحظة: </span>
                                            {b.closingNote}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {!historyOnly && records.length > 0 && (
                        <section>
                            <SectionTitle icon="folder_open" title="الملفات والتقارير الطبية" />
                            <div className="mt-3 flex flex-col gap-2">
                                {records.map((r, i) => {
                                    const typeMap = {
                                        'Prescription': { label: 'روشتة',         icon: 'medication',    bg: 'bg-purple-50', border: 'border-purple-100', color: 'text-purple-600' },
                                        'Lab Test':     { label: 'تحليل مخبري',   icon: 'science',       bg: 'bg-orange-50', border: 'border-orange-100', color: 'text-orange-600' },
                                        'X-Ray':        { label: 'أشعة',           icon: 'radiology',     bg: 'bg-sky-50',    border: 'border-sky-100',    color: 'text-sky-600'    },
                                    };
                                    const t = typeMap[r.recordType] ?? { label: r.recordType, icon: 'description', bg: 'bg-gray-50', border: 'border-gray-100', color: 'text-gray-600' };
                                    // R2 files are stored as "r2:{key}" (no slash) — strip the prefix
                                    // to get the bare key the server matches on. Legacy URLs keep last path segment.
                                    const filename = r.fileUrl
                                        ? (r.fileUrl.startsWith('r2:') ? r.fileUrl.slice(3) : r.fileUrl.split('/').pop())
                                        : null;

                                    const openFile = async () => {
                                        if (!filename) return;
                                        try {
                                            const { data } = await axiosInstance.get(
                                                `/doctors/patient/${patientId}/record-token?filename=${encodeURIComponent(filename)}`
                                            );
                                            if (data?.token) {
                                                window.open(
                                                    `${SERVER_BASE}/uploads/medical-records/${encodeURIComponent(filename)}?token=${data.token}`,
                                                    '_blank',
                                                    'noopener,noreferrer'
                                                );
                                            }
                                        } catch {
                                            // silent — nothing to show the user
                                        }
                                    };

                                    return (
                                        <div key={i} className={`${t.bg} border ${t.border} rounded-xl p-3 text-xs`}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`material-symbols-outlined text-[15px] ${t.color}`}>{t.icon}</span>
                                                <span className={`font-bold ${t.color}`}>{t.label}</span>
                                                <span className="text-gray-400 mr-auto">
                                                    {r.uploadedAt ? new Date(r.uploadedAt).toLocaleDateString('ar-EG') : ''}
                                                </span>
                                                {filename && (
                                                    <button
                                                        onClick={openFile}
                                                        title="فتح الملف"
                                                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border ${t.border} ${t.color} hover:opacity-70 transition-opacity`}
                                                    >
                                                        <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                                                        <span>فتح</span>
                                                    </button>
                                                )}
                                            </div>
                                            {r.note && <p className="text-gray-600 leading-relaxed">{r.note}</p>}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                    </>)}
                </div>
            )}
        </motion.div>
    );
}

/**
 * RescheduleModal — lets the doctor pick a new slot for an existing booking.
 *
 * Flow:
 *   1. Doctor picks a date (date-picker, min = today).
 *   2. Available slots for that date are fetched from GET /doctors/slots/date/:date.
 *   3. Doctor selects a slot.
 *   4. On confirm → PATCH /bookings/:id/doctor-reschedule.
 *   5. onDone() triggers parent refetch and the modal closes.
 */
function RescheduleModal({ booking, onClose, onDone }) {
    const todayISO = new Date().toISOString().slice(0, 10);

    const [selectedDate, setSelectedDate] = useState('');
    const [slots,        setSlots]        = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [submitting,   setSubmitting]   = useState(false);
    const [error,        setError]        = useState('');

    // Fetch slots whenever the date changes
    useEffect(() => {
        if (!selectedDate) { setSlots([]); setSelectedSlot(null); return; }
        setLoadingSlots(true);
        setSelectedSlot(null);
        setError('');
        axiosInstance.get(`/doctors/slots/date/${selectedDate}`)
            .then(({ data }) => {
                // Keep only slots that are available and not booked
                const avail = (data.data ?? []).filter(s => s.isAvailable && !s.isBooked);
                setSlots(avail);
                if (avail.length === 0) setError('لا توجد مواعيد متاحة في هذا اليوم');
            })
            .catch(() => setError('تعذّر تحميل المواعيد، حاول مرة أخرى'))
            .finally(() => setLoadingSlots(false));
    }, [selectedDate]);

    const handleConfirm = async () => {
        if (!selectedSlot) return;
        setSubmitting(true);
        setError('');
        try {
            await axiosInstance.patch(`/bookings/${booking._id}/doctor-reschedule`, {
                newSlotId: selectedSlot._id,
            });
            onDone();
        } catch (err) {
            setError(err.response?.data?.message || 'حدث خطأ، يرجى المحاولة مرة أخرى');
        } finally {
            setSubmitting(false);
        }
    };

    return createPortal(
        <motion.div
            key="reschedule-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0,  opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
                dir="rtl"
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                    <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
                        <span className="material-symbols-outlined text-gray-400 text-[20px]">close</span>
                    </button>
                    <div>
                        <p className="font-black text-[#134e3a] text-sm">تعديل الموعد</p>
                        <p className="text-[11px] text-gray-400">{booking.patient?.name ?? 'مريض'}</p>
                    </div>
                </div>

                <div className="p-5 flex flex-col gap-4">
                    {/* Current appointment info */}
                    <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-500 flex items-center gap-3">
                        <span className="material-symbols-outlined text-gray-400 text-[16px]">event</span>
                        <span>
                            الموعد الحالي:{' '}
                            <span className="font-bold text-gray-700">
                                {new Date(booking.slotDetails?.date).toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'long' })}
                                {' — '}
                                {fmtTime(booking.slotDetails?.startTime)}
                            </span>
                        </span>
                    </div>

                    {/* Date picker */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1.5 block">اختر تاريخًا جديدًا</label>
                        <input
                            type="date"
                            min={todayISO}
                            value={selectedDate}
                            onChange={(e) => { setSelectedDate(e.target.value); setError(''); }}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#191c1c] focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-transparent"
                        />
                    </div>

                    {/* Slots list */}
                    {selectedDate && (
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1.5 block">اختر موعدًا</label>
                            {loadingSlots ? (
                                <div className="flex justify-center py-6">
                                    <div className="w-6 h-6 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                                </div>
                            ) : slots.length === 0 ? (
                                <p className="text-xs text-gray-400 bg-gray-50 rounded-xl py-4 text-center">
                                    {error || 'لا توجد مواعيد متاحة'}
                                </p>
                            ) : (
                                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                                    {slots.map(s => (
                                        <button
                                            key={s._id}
                                            onClick={() => { setSelectedSlot(s); setError(''); }}
                                            className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all ${
                                                selectedSlot?._id === s._id
                                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                    : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'
                                            }`}
                                        >
                                            {fmtTime(s.startTime)}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error */}
                    {error && slots.length > 0 && (
                        <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={onClose}
                            className="flex-1 border border-gray-200 text-gray-500 text-xs font-bold py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            إلغاء
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!selectedSlot || submitting}
                            className="flex-1 bg-emerald-600 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                        >
                            {submitting
                                ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <span className="material-symbols-outlined text-[14px]">check</span>
                            }
                            {!submitting && 'تأكيد التعديل'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>,
        document.body
    );
}

/**
 * WalkInRescheduleModal — same panel style as RescheduleModal but for walk-ins.
 * Date-only reschedule: picks a new date and optionally a new slot.
 * Old slot is unlocked server-side when the date changes.
 */
function WalkInRescheduleModal({ walkIn, onClose, onDone }) {
    const todayISO = new Date().toISOString().slice(0, 10);

    const [selectedDate, setSelectedDate] = useState('');
    const [slots,        setSlots]        = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [submitting,   setSubmitting]   = useState(false);
    const [error,        setError]        = useState('');

    useEffect(() => {
        if (!selectedDate) { setSlots([]); setSelectedSlot(null); return; }
        setLoadingSlots(true);
        setSelectedSlot(null);
        setError('');
        axiosInstance.get(`/doctors/slots/date/${selectedDate}`)
            .then(({ data }) => {
                const avail = (data.data ?? []).filter(s => s.isAvailable && !s.isBooked);
                setSlots(avail);
                if (avail.length === 0) setError('لا توجد مواعيد متاحة في هذا اليوم');
            })
            .catch(() => setError('تعذّر تحميل المواعيد، حاول مرة أخرى'))
            .finally(() => setLoadingSlots(false));
    }, [selectedDate]);

    const handleConfirm = async () => {
        if (!selectedDate) return;
        setSubmitting(true);
        setError('');
        try {
            await axiosInstance.patch(`/doctors/walkin/${walkIn._id}`, {
                date:   selectedDate,
                slotId: selectedSlot?._id ?? null,
            });
            onDone();
        } catch (err) {
            setError(err.response?.data?.message || 'حدث خطأ، يرجى المحاولة مرة أخرى');
        } finally {
            setSubmitting(false);
        }
    };

    return createPortal(
        <motion.div
            key="wi-reschedule-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0,  opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
                dir="rtl"
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                    <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
                        <span className="material-symbols-outlined text-gray-400 text-[20px]">close</span>
                    </button>
                    <div>
                        <p className="font-black text-[#134e3a] text-sm">تعديل الموعد</p>
                        <p className="text-[11px] text-gray-400">{walkIn.patientName}</p>
                    </div>
                </div>

                <div className="p-5 flex flex-col gap-4">
                    {/* Current info */}
                    <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-500 flex items-center gap-3">
                        <span className="material-symbols-outlined text-gray-400 text-[16px]">event</span>
                        <span>
                            الموعد الحالي:{' '}
                            <span className="font-bold text-gray-700">
                                {new Date(walkIn.date).toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'long' })}
                                {walkIn.arrivalTime ? ` — ${fmtTime(walkIn.arrivalTime)}` : ''}
                            </span>
                        </span>
                    </div>

                    {/* Date picker */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1.5 block">اختر تاريخًا جديدًا</label>
                        <input
                            type="date"
                            min={todayISO}
                            value={selectedDate}
                            onChange={(e) => { setSelectedDate(e.target.value); setError(''); }}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#191c1c] focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-transparent"
                        />
                    </div>

                    {/* Slots list (optional) */}
                    {selectedDate && (
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                                اختر موعدًا
                                <span className="font-normal text-gray-400 mr-1">(اختياري)</span>
                            </label>
                            {loadingSlots ? (
                                <div className="flex justify-center py-6">
                                    <div className="w-6 h-6 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                                </div>
                            ) : slots.length === 0 ? (
                                <p className="text-xs text-gray-400 bg-gray-50 rounded-xl py-4 text-center">
                                    {error || 'لا توجد مواعيد متاحة — سيُسجَّل بدون موعد'}
                                </p>
                            ) : (
                                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                                    {slots.map(s => (
                                        <button
                                            key={s._id}
                                            onClick={() => setSelectedSlot(prev => prev?._id === s._id ? null : s)}
                                            className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all ${
                                                selectedSlot?._id === s._id
                                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                    : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'
                                            }`}
                                        >
                                            {fmtTime(s.startTime)}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Submit error */}
                    {error && slots.length > 0 && (
                        <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                        <button onClick={onClose}
                            className="flex-1 border border-gray-200 text-gray-500 text-xs font-bold py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                            إلغاء
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!selectedDate || submitting}
                            className="flex-1 bg-emerald-600 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                        >
                            {submitting
                                ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <span className="material-symbols-outlined text-[14px]">check</span>
                            }
                            {!submitting && 'تأكيد التعديل'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>,
        document.body
    );
}

/**
 * BookingCard — unified card for online bookings in the upcoming appointments list.
 *
 * Mirrors the TodayQueue start/finish flow exactly:
 *   confirmed → ابدأ الكشف (PATCH /start) → in-progress
 *   → أنهِ الكشف → ClosingNoteModal (same modal as TodayQueue, saves note + completes)
 *
 * The closing modal is managed locally so no parent state is needed for it.
 * After completion onDataChange triggers a full refetch and the card disappears.
 */
function BookingCard({ booking, onOpenDrawer, onOpenHistory, onCancel, onDataChange }) {
    const [localStatus,    setLocalStatus]    = useState(booking.status);
    const [acting,         setActing]         = useState(false);
    const [showClosing,    setShowClosing]    = useState(false);
    const [showReschedule, setShowReschedule] = useState(false);

    // Sync from parent after a full data refetch
    useEffect(() => { setLocalStatus(booking.status); }, [booking.status]);

    const st               = statusLabel[localStatus] ?? { text: localStatus, cls: 'bg-gray-100 text-gray-600' };
    const patientName      = booking.patient?.name ?? 'مريض';
    const appointmentToday = isToday(booking.slotDetails?.date);

    const handleStart = async () => {
        setActing(true);
        try {
            await axiosInstance.patch(`/bookings/${booking._id}/start`);
            setLocalStatus('in-progress');
        } catch { /* swallow — axiosInstance interceptor logs */ }
        finally { setActing(false); }
    };

    // Shape the booking the way ClosingNoteModal expects
    const closingBooking = { ...booking, patientName };

    return (
        <>
            <motion.div
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3"
            >
                {/* ── Header ── */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                        {booking.patient?.profilePicture ? (
                            <img
                                src={`${SERVER_BASE}${booking.patient.profilePicture}`}
                                alt={patientName}
                                className="w-10 h-10 rounded-full object-cover border-2 border-emerald-100 shrink-0"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700 text-sm shrink-0">
                                {patientName.charAt(0)}
                            </div>
                        )}
                        <div>
                            <p className="font-bold text-[#191c1c] text-sm">{patientName}</p>
                            <p className="text-xs text-gray-400">{booking.patient?.phone ?? '—'}</p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${st.cls}`}>{st.text}</span>
                        <span className="text-[10px] font-semibold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">📅 أونلاين</span>
                    </div>
                </div>

                {/* ── Meta ── */}
                <div className="flex items-center gap-4 text-xs text-gray-500 border-t border-gray-50 pt-3 flex-wrap">
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">calendar_month</span>
                        {fmt(booking.slotDetails?.date)}
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        {fmtTime(booking.slotDetails?.startTime)} – {fmtTime(booking.slotDetails?.endTime)}
                    </span>
                    <span className="flex items-center gap-1 mr-auto font-semibold text-[#134e3a]">
                        <span className="material-symbols-outlined text-[14px]">payments</span>
                        {booking.consultationFee} جنيه
                    </span>
                </div>

                {/* ── Actions ── */}
                <div className="flex gap-2 flex-wrap">
                    {booking.patient?._id && (
                        ['cancelled', 'completed'].includes(localStatus) ? (
                            onOpenHistory && (
                                <button
                                    onClick={() => onOpenHistory(booking.patient._id)}
                                    className="flex-1 bg-[#134e3a] text-white text-xs font-bold py-2.5 rounded-xl hover:bg-[#0d3829] transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <span className="material-symbols-outlined text-[14px]">person_search</span>
                                    سجل الزيارات
                                </button>
                            )
                        ) : (
                            onOpenDrawer && (
                                <button
                                    onClick={() => onOpenDrawer(booking.patient._id)}
                                    className="flex-1 bg-[#134e3a] text-white text-xs font-bold py-2.5 rounded-xl hover:bg-[#0d3829] transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <span className="material-symbols-outlined text-[14px]">folder_open</span>
                                    ملف المريض
                                </button>
                            )
                        )
                    )}

                    {/* Today: ابدأ الكشف flow; Future: تعديل الموعد */}
                    {localStatus === 'confirmed' && appointmentToday && (
                        <button
                            onClick={handleStart}
                            disabled={acting}
                            className="flex-1 border border-emerald-200 text-emerald-700 text-xs font-bold py-2.5 rounded-xl hover:bg-emerald-50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            {acting
                                ? <span className="w-3.5 h-3.5 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
                                : <span className="material-symbols-outlined text-[14px]">play_circle</span>}
                            {!acting && 'ابدأ الكشف'}
                        </button>
                    )}
                    {localStatus === 'confirmed' && !appointmentToday && (
                        <button
                            onClick={() => setShowReschedule(true)}
                            className="flex-1 border border-emerald-200 text-emerald-700 text-xs font-bold py-2.5 rounded-xl hover:bg-emerald-50 transition-colors flex items-center justify-center gap-1.5"
                        >
                            <span className="material-symbols-outlined text-[14px]">edit_calendar</span>
                            تعديل الموعد
                        </button>
                    )}

                    {localStatus === 'in-progress' && (
                        <button
                            onClick={() => setShowClosing(true)}
                            className="flex-1 border border-blue-200 text-blue-700 text-xs font-bold py-2.5 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5"
                        >
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            أنهِ الكشف
                        </button>
                    )}

                    {!['cancelled', 'completed', 'in-progress'].includes(localStatus) && (
                        <button
                            onClick={() => onCancel(booking._id)}
                            className="border border-red-200 text-red-500 text-xs font-bold py-2.5 px-4 rounded-xl hover:bg-red-50 transition-colors flex items-center justify-center gap-1"
                        >
                            <span className="material-symbols-outlined text-[14px]">cancel</span>
                            إلغاء
                        </button>
                    )}
                </div>
            </motion.div>

            {/* ClosingNoteModal — same panel as TodayQueue */}
            <AnimatePresence>
                {showClosing && (
                    <ClosingNoteModal
                        booking={closingBooking}
                        onClose={() => setShowClosing(false)}
                        onDone={() => {
                            setShowClosing(false);
                            setLocalStatus('completed');
                            onDataChange?.();
                        }}
                    />
                )}
            </AnimatePresence>

            {/* RescheduleModal — doctor picks a new slot */}
            <AnimatePresence>
                {showReschedule && (
                    <RescheduleModal
                        booking={booking}
                        onClose={() => setShowReschedule(false)}
                        onDone={() => {
                            setShowReschedule(false);
                            onDataChange?.();
                        }}
                    />
                )}
            </AnimatePresence>
        </>
    );
}

/**
 * OperationCard — scheduled surgery card in a layout identical to BookingCard.
 * Purple accent colour distinguishes it visually while keeping the same structure:
 * avatar → name/phone header, date/time/fee meta row, action buttons row.
 */
function OperationCard({ op, onDelete, onOpenDrawer, onDataChange }) {
    const statusCls  = {
        scheduled: 'bg-purple-100 text-purple-700',
        done:      'bg-gray-100 text-gray-500',
        cancelled: 'bg-red-100 text-red-700',
    };
    const statusText = { scheduled: 'مجدول', done: 'اكتمل', cancelled: 'ملغي' };

    const [localStatus, setLocalStatus] = useState(op.status);
    const [acting,      setActing]      = useState(false);

    useEffect(() => { setLocalStatus(op.status); }, [op.status]);

    const patientId  = op.patient ? String(op.patient) : null;
    const opIsToday  = isToday(op.date);
    const countdown  = daysUntil(op.date);

    const handleMarkDone = async () => {
        setActing(true);
        try {
            await axiosInstance.patch(`/doctors/operations/${op._id}`, { status: 'done' });
            setLocalStatus('done');
            onDataChange?.();
        } catch { /* swallow */ }
        finally { setActing(false); }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-purple-100 flex flex-col gap-3"
        >
            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-lg shrink-0">
                        🔬
                    </div>
                    <div>
                        <p className="font-bold text-[#191c1c] text-sm flex items-center gap-1.5">
                            {op.patientName}
                            {patientId && (
                                <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">مسجّل</span>
                            )}
                        </p>
                        <p className="text-xs text-gray-400">{op.phone ?? '—'}</p>
                    </div>
                </div>
                <span className={`text-[11px] font-bold px-3 py-1 rounded-full shrink-0 ${statusCls[localStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                    {statusText[localStatus] ?? localStatus}
                </span>
            </div>

            {/* ── Operation type — prominent ── */}
            <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-500 text-[18px] shrink-0">medical_services</span>
                <p className="font-black text-purple-800 text-sm leading-tight">{op.operationType || '—'}</p>
            </div>

            {/* ── Meta ── */}
            <div className="flex items-center gap-3 text-xs text-gray-500 border-t border-gray-50 pt-3 flex-wrap">
                <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">calendar_month</span>
                    {fmt(op.date)}
                </span>
                {op.time && (
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        {fmtTime(op.time)}
                    </span>
                )}
                {op.duration && (
                    <span className="flex items-center gap-1 font-semibold text-purple-600">
                        <span className="material-symbols-outlined text-[14px]">timer</span>
                        {op.duration} دقيقة
                    </span>
                )}
                {op.location && (
                    <span className="flex items-center gap-1 font-semibold text-[#134e3a]">
                        <span className="material-symbols-outlined text-[14px]">location_on</span>
                        {op.location}
                    </span>
                )}
                {op.fee > 0 && (
                    <span className="flex items-center gap-1 mr-auto font-semibold text-[#134e3a]">
                        <span className="material-symbols-outlined text-[14px]">payments</span>
                        {op.fee} جنيه
                    </span>
                )}
            </div>

            {/* ── Actions ── */}
            <div className="flex gap-2 flex-wrap">
                {patientId && onOpenDrawer && (
                    <button
                        onClick={() => onOpenDrawer(patientId)}
                        className="flex-1 bg-[#134e3a] text-white text-xs font-bold py-2.5 rounded-xl hover:bg-[#0d3829] transition-colors flex items-center justify-center gap-1.5"
                    >
                        <span className="material-symbols-outlined text-[14px]">folder_open</span>
                        ملف المريض
                    </button>
                )}
                {localStatus === 'scheduled' && (
                    <>
                        {/* Today: mark done button; Future: countdown chip */}
                        {opIsToday ? (
                            <button
                                onClick={handleMarkDone}
                                disabled={acting}
                                className="flex-1 border border-purple-200 text-purple-700 text-xs font-bold py-2.5 rounded-xl hover:bg-purple-50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                                {acting
                                    ? <span className="w-3.5 h-3.5 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                                    : <span className="material-symbols-outlined text-[14px]">check_circle</span>}
                                {!acting && 'تمت العملية'}
                            </button>
                        ) : (
                            <div className="flex-1 flex items-center justify-center gap-1.5 bg-purple-50 border border-purple-100 rounded-xl py-2.5 px-3">
                                <span className="material-symbols-outlined text-purple-400 text-[14px]">hourglass_top</span>
                                <span className="text-xs font-bold text-purple-500">
                                    {countdown === 1 ? 'غداً' : `بعد ${countdown} أيام`}
                                </span>
                            </div>
                        )}
                        {onDelete && (
                            <button
                                onClick={() => onDelete(op._id)}
                                className="border border-red-200 text-red-500 text-xs font-bold py-2.5 px-4 rounded-xl hover:bg-red-50 transition-colors flex items-center justify-center gap-1"
                            >
                                <span className="material-symbols-outlined text-[14px]">delete</span>
                                حذف
                            </button>
                        )}
                    </>
                )}
            </div>
        </motion.div>
    );
}

/**
 * WalkInCard — walk-in card in a layout identical to BookingCard.
 * Amber accent colour distinguishes it. Supports the same ابدأ/أنهِ الكشف flow:
 * waiting → ابدأ الكشف → in-progress → أنهِ الكشف → done (disappears from list).
 */
function WalkInCard({ w, onOpenDrawer, onOpenHistory, onOpenWalkInProfile, onDataChange, onCancel, isSecretary }) {
    const statusCls  = {
        waiting:      'bg-amber-100 text-amber-700',
        'in-progress':'bg-blue-100 text-blue-700',
        done:         'bg-gray-100 text-gray-500',
        cancelled:    'bg-red-100 text-red-700',
    };
    const statusText = {
        waiting:      'في الانتظار',
        'in-progress':'جارٍ الكشف',
        done:         'اكتمل',
        cancelled:    'ملغي',
    };

    const [localStatus,       setLocalStatus]       = useState(w.status);
    const [acting,            setActing]            = useState(false);
    const [showWalkInClosing, setShowWalkInClosing] = useState(false);
    const [showReschedule,    setShowReschedule]    = useState(false);

    useEffect(() => { setLocalStatus(w.status); }, [w.status]);

    const patientId      = w.patient ? String(w.patient) : null;
    const isWalkInToday  = isToday(w.date);

    const handleAdvance = async () => {
        // waiting → in-progress: direct PATCH (no modal)
        if (localStatus === 'waiting') {
            setActing(true);
            try {
                await axiosInstance.patch(`/doctors/walkin/${w._id}`, { status: 'in-progress' });
                setLocalStatus('in-progress');
            } catch { /* swallow */ }
            finally { setActing(false); }
            return;
        }
        // in-progress → done: open closing modal (notes + follow-up) instead of direct PATCH
        if (localStatus === 'in-progress') {
            setShowWalkInClosing(true);
        }
    };


    return (
        <>
        <motion.div
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100 flex flex-col gap-3"
        >
            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center font-bold text-amber-700 text-sm shrink-0">
                        {w.patientName?.charAt(0) ?? '؟'}
                    </div>
                    <div>
                        <p className="font-bold text-[#191c1c] text-sm flex items-center gap-1.5">
                            {w.patientName}
                            {patientId && (
                                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">مسجّل</span>
                            )}
                        </p>
                        <p className="text-xs text-gray-400">{w.phone ?? '—'}</p>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${statusCls[localStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                        {statusText[localStatus] ?? localStatus}
                    </span>
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">🚶 زيارة</span>
                </div>
            </div>

            {/* ── Meta ── */}
            <div className="flex items-center gap-4 text-xs text-gray-500 border-t border-gray-50 pt-3 flex-wrap">
                <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">calendar_month</span>
                    {fmt(w.date)}
                </span>
                <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    {fmtTime(w.arrivalTime) || '—'}
                </span>
                {w.complaint && (
                    <span className="flex items-center gap-1 truncate max-w-[140px]">
                        <span className="material-symbols-outlined text-[14px]">medical_information</span>
                        {w.complaint}
                    </span>
                )}
                {w.fee > 0 && (
                    <span className="flex items-center gap-1 mr-auto font-semibold text-[#134e3a]">
                        <span className="material-symbols-outlined text-[14px]">payments</span>
                        {w.fee} جنيه
                    </span>
                )}
            </div>

            {/* ── Actions ── */}
            <div className="flex gap-2 flex-wrap">
                {patientId ? (
                    ['done', 'cancelled'].includes(localStatus) ? (
                        onOpenHistory && (
                            <button
                                onClick={() => onOpenHistory(patientId)}
                                className="flex-1 bg-[#134e3a] text-white text-xs font-bold py-2.5 rounded-xl hover:bg-[#0d3829] transition-colors flex items-center justify-center gap-1.5"
                            >
                                <span className="material-symbols-outlined text-[14px]">person_search</span>
                                سجل الزيارات
                            </button>
                        )
                    ) : (
                        onOpenDrawer && (
                            <button
                                onClick={() => onOpenDrawer(patientId)}
                                className="flex-1 bg-[#134e3a] text-white text-xs font-bold py-2.5 rounded-xl hover:bg-[#0d3829] transition-colors flex items-center justify-center gap-1.5"
                            >
                                <span className="material-symbols-outlined text-[14px]">folder_open</span>
                                ملف المريض
                            </button>
                        )
                    )
                ) : !isSecretary && w.phone && onOpenWalkInProfile ? (
                    <button
                        onClick={() => onOpenWalkInProfile(w.phone, w.patientName)}
                        className="flex-1 bg-[#134e3a] text-white text-xs font-bold py-2.5 rounded-xl hover:bg-[#0d3829] transition-colors flex items-center justify-center gap-1.5"
                    >
                        <span className="material-symbols-outlined text-[14px]">person_search</span>
                        سجل الزيارات
                    </button>
                ) : null}

                {isWalkInToday ? (
                    // Today: full ابدأ/أنهِ الكشف flow
                    ['waiting', 'in-progress'].includes(localStatus) && (
                        <button
                            onClick={handleAdvance}
                            disabled={acting}
                            className={`flex-1 text-xs font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                                localStatus === 'in-progress'
                                    ? 'border border-blue-200 text-blue-700 hover:bg-blue-50'
                                    : 'border border-amber-200 text-amber-700 hover:bg-amber-50'
                            }`}
                        >
                            {acting
                                ? <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                : <span className="material-symbols-outlined text-[14px]">
                                    {localStatus === 'in-progress' ? 'check_circle' : 'play_circle'}
                                  </span>
                            }
                            {!acting && (localStatus === 'in-progress' ? 'أنهِ الكشف' : 'ابدأ الكشف')}
                        </button>
                    )
                ) : (
                    // Future date: تعديل الموعد instead of ابدأ الكشف
                    localStatus === 'waiting' && (
                        <button
                            onClick={() => setShowReschedule(true)}
                            className="flex-1 border border-indigo-200 text-indigo-600 text-xs font-bold py-2.5 rounded-xl hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1.5"
                        >
                            <span className="material-symbols-outlined text-[14px]">edit_calendar</span>
                            تعديل الموعد
                        </button>
                    )
                )}
                {localStatus === 'waiting' && (
                    <button
                        onClick={() => onCancel?.(w._id, w.patientName)}
                        className="border border-red-200 text-red-500 text-xs font-bold py-2.5 px-4 rounded-xl hover:bg-red-50 transition-colors flex items-center justify-center gap-1"
                    >
                        <span className="material-symbols-outlined text-[14px]">cancel</span>
                        إلغاء
                    </button>
                )}
            </div>
        </motion.div>

        {/* WalkInClosingModal — notes + follow-up before marking done */}
        <AnimatePresence>
            {showWalkInClosing && (
                <WalkInClosingModal
                    walkIn={w}
                    onClose={() => setShowWalkInClosing(false)}
                    onDone={() => {
                        setShowWalkInClosing(false);
                        onDataChange?.();
                    }}
                />
            )}
        </AnimatePresence>

        {/* WalkInRescheduleModal — pick new date + optional slot */}
        <AnimatePresence>
            {showReschedule && (
                <WalkInRescheduleModal
                    walkIn={w}
                    onClose={() => setShowReschedule(false)}
                    onDone={() => {
                        setShowReschedule(false);
                        onDataChange?.();
                    }}
                />
            )}
        </AnimatePresence>
        </>
    );
}

/**
 * WalkInProfileModal — lightweight profile panel for walk-in patients.
 *
 * For patients with a phone number but no registered platform account, the full
 * PatientDrawer can't be used because it requires a User _id. This modal calls
 * GET /doctors/walkin-patient-history?phone=xxx to fetch all walk-in visits and
 * any operations for that phone number, presenting the same key information.
 *
 * If the phone turns out to be linked to a registered account, a "عرض الملف
 * الشامل" button is shown so the doctor can switch to the full PatientDrawer.
 */
/**
 * WalkInProfileModal — patient history panel for walk-in (phone-based) patients.
 *
 * Redesigned as a spring-animated slide-over from the left edge, matching the
 * PatientDrawer experience. Renders a backdrop overlay + the panel as siblings
 * inside a portal so they animate independently with AnimatePresence.
 *
 * Sections:
 *   • سجل الزيارات    — this doctor's walk-in visits + operations, merged by date.
 *   • ملاحظات أطباء التخصص — closing notes from peer doctors of the same specialty
 *                      (only shown when the patient has a registered account and the
 *                      backend found peer visits).
 *
 * If the patient is registered on the platform, a "الملف الشامل" button switches
 * to the full PatientDrawer which includes medical profile, medications, etc.
 */
function WalkInProfileModal({ phone, name: initialName, onClose, onOpenFullDrawer }) {
    const [data,    setData]    = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!phone) return;
        setLoading(true);
        axiosInstance.get(`/doctors/walkin-patient-history?phone=${encodeURIComponent(phone)}`)
            .then(({ data: res }) => setData(res.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [phone]);

    const displayName = data?.name ?? initialName ?? 'مريض';
    const profilePic  = data?.profilePicture ?? null;

    const opStatusMap = {
        scheduled: { ar: 'مجدولة', cls: 'bg-violet-100 text-violet-700' },
        done:      { ar: 'مكتملة', cls: 'bg-emerald-100 text-emerald-700' },
        cancelled: { ar: 'ملغية',  cls: 'bg-red-100 text-red-600' },
    };

    // Walk-in visits + operations merged newest-first
    const timeline = [
        ...(data?.visits     ?? []).map(v  => ({ ...v,  _kind: 'visit',     _date: v.date })),
        ...(data?.operations ?? []).map(op => ({ ...op, _kind: 'operation', _date: op.date })),
    ].sort((a, b) => new Date(b._date) - new Date(a._date));

    const peerVisits = data?.peerVisits ?? [];

    return createPortal(
        <>
            {/* Backdrop */}
            <motion.div
                key="wi-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/30 z-40"
                onClick={onClose}
            />

            {/* Slide-over panel — same spring + positioning as PatientDrawer */}
            <motion.div
                key="wi-drawer"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                className="fixed inset-y-0 left-0 w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto"
                dir="rtl"
            >
                {/* ── Sticky header ── */}
                <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3 z-10">
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                        <span className="material-symbols-outlined text-gray-500">close</span>
                    </button>
                    {profilePic ? (
                        <img
                            src={`${SERVER_BASE}${profilePic}`}
                            alt={displayName}
                            className="w-11 h-11 rounded-full object-cover border-2 border-amber-100 shrink-0"
                        />
                    ) : (
                        <div className="w-11 h-11 rounded-full bg-amber-100 border-2 border-amber-200 flex items-center justify-center font-bold text-amber-700 text-base shrink-0">
                            {displayName.charAt(0)}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <h2 className="font-black text-[#134e3a] text-base truncate">{displayName}</h2>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">call</span>
                            {phone}
                        </p>
                    </div>
                    {data?.linkedPatientId && onOpenFullDrawer && (
                        <button
                            onClick={() => { onClose(); onOpenFullDrawer(data.linkedPatientId); }}
                            className="shrink-0 text-[11px] font-bold text-emerald-600 border border-emerald-200 hover:bg-emerald-50 px-3 py-1.5 rounded-xl transition flex items-center gap-1"
                        >
                            <span className="material-symbols-outlined text-[13px]">folder_shared</span>
                            الملف الشامل
                        </button>
                    )}
                </div>

                {/* ── Body ── */}
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
                    </div>
                ) : !data ? (
                    <div className="p-8 text-center text-gray-400">تعذّر تحميل البيانات</div>
                ) : (
                    <div className="p-6 flex flex-col gap-6">

                        {/* Walk-in visits + operations timeline */}
                        <section>
                            <SectionTitle icon="history" title={`سجل الزيارات (${timeline.length})`} />
                            {timeline.length === 0 ? (
                                <p className="mt-3 text-xs text-gray-400 bg-gray-50 rounded-xl p-3 text-center">لا توجد زيارات بعد</p>
                            ) : (
                                <div className="mt-3 flex flex-col gap-2">
                                    {timeline.map((item) => {
                                        if (item._kind === 'visit') {
                                            const isFollowUp = item.isFollowUp === true;
                                            const card = isFollowUp
                                                ? { bg: 'bg-sky-50', border: 'border-sky-100', label: 'إعادة كشف', labelCls: 'bg-sky-100 text-sky-700', accent: 'text-sky-700' }
                                                : { bg: 'bg-amber-50', border: 'border-amber-100', label: 'زيارة',          labelCls: 'bg-amber-100 text-amber-700', accent: 'text-amber-700' };
                                            return (
                                                <div key={`v-${item._id}`} className={`${card.bg} border ${card.border} rounded-xl p-3 text-xs`}>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`font-bold ${card.accent}`}>{fmt(item.date)}</span>
                                                            <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${card.labelCls}`}>{card.label}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {item.arrivalTime && <span className="text-gray-400">{fmtTime(item.arrivalTime)}</span>}
                                                            <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                                                                item.status === 'done'          ? 'bg-emerald-100 text-emerald-700'
                                                                : item.status === 'in-progress' ? 'bg-blue-100 text-blue-700'
                                                                : 'bg-gray-100 text-gray-600'
                                                            }`}>
                                                                {item.status === 'done' ? 'منتهي' : item.status === 'in-progress' ? 'جارٍ' : 'انتظار'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {item.complaint && <p className="text-gray-600 mt-1"><span className={`font-semibold ${card.accent}`}>الشكوى: </span>{item.complaint}</p>}
                                                    {item.notes     && <p className="text-gray-700 mt-1 leading-relaxed"><span className={`font-semibold ${card.accent}`}>ملاحظة: </span>{item.notes}</p>}
                                                    {item.fee > 0   && <p className="text-emerald-600 font-semibold mt-1">{item.fee} جنيه</p>}
                                                    {item.followUp?.enabled && item.followUp?.scheduledFor && (
                                                        <p className="text-sky-600 mt-1 flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[12px]">autorenew</span>
                                                            متابعة مقررة: {fmt(item.followUp.scheduledFor)}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        }
                                        // Operation item
                                        const st = opStatusMap[item.status] ?? opStatusMap.scheduled;
                                        return (
                                            <div key={`op-${item._id}`} className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs">
                                                <div className="flex justify-between items-center mb-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-bold text-purple-800">{fmt(item.date)}</span>
                                                        <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-purple-100 text-purple-700">عملية</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        {item.time && <span className="text-gray-400">{fmtTime(item.time)}</span>}
                                                        <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${st.cls}`}>{st.ar}</span>
                                                    </div>
                                                </div>
                                                <p className="font-semibold text-purple-900">{item.operationType}</p>
                                                {item.location && <p className="text-gray-500 mt-0.5">📍 {item.location}</p>}
                                                {item.notes    && <p className="text-gray-600 mt-1 leading-relaxed"><span className="font-semibold text-purple-700">ملاحظة: </span>{item.notes}</p>}
                                                {item.fee > 0  && <p className="text-emerald-600 font-semibold mt-1">{item.fee} جنيه</p>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        {/* Peer specialist notes — only for registered patients */}
                        {peerVisits.length > 0 && (
                            <section>
                                <SectionTitle icon="groups" title="ملاحظات أطباء نفس التخصص" />
                                <div className="mt-3 flex flex-col gap-2">
                                    {peerVisits.map((v) => (
                                        <div key={v._id} className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs">
                                            <div className="flex justify-between items-center mb-1.5">
                                                <span className="font-bold text-indigo-700">{fmt(v.slotDetails?.date)}</span>
                                                <span className="text-gray-400">{fmtTime(v.slotDetails?.startTime)}</span>
                                            </div>
                                            <p className="text-[10px] font-bold text-indigo-400 mb-1">د. {v.doctor?.name}</p>
                                            <p className="text-gray-700 leading-relaxed">{v.closingNote}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                    </div>
                )}
            </motion.div>
        </>,
        document.body
    );
}

/** Sidebar navigation button with an optional unread-count badge. */
function NavItem({ icon, label, active, onClick, badge }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                active ? 'bg-[#134e3a] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
            }`}
        >
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
            <span className="flex-1 text-right">{label}</span>
            {badge > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                    {badge}
                </span>
            )}
        </button>
    );
}

/**
 * Pagination — compact page-range control with ellipsis collapsing for large
 * page counts. Returns null when pages ≤ 1 to avoid rendering an empty row.
 */
function Pagination({ page, pages, onPageChange }) {
    if (pages <= 1) return null;

    const getRange = () => {
        if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
        const left  = Math.max(2, page - 2);
        const right = Math.min(pages - 1, page + 2);
        const range = [];
        for (let i = left; i <= right; i++) range.push(i);
        const result = [1];
        if (left > 2) result.push('…');
        result.push(...range);
        if (right < pages - 1) result.push('…');
        result.push(pages);
        return result;
    };

    return (
        <div className="flex items-center justify-center gap-1.5 mt-8" dir="ltr">
            <button
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition text-lg font-bold"
            >‹</button>

            {getRange().map((p, i) =>
                p === '…'
                    ? <span key={`e${i}`} className="w-9 h-9 flex items-center justify-center text-gray-400 text-sm">…</span>
                    : <button
                        key={p}
                        onClick={() => onPageChange(p)}
                        className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-bold transition ${
                            p === page
                                ? 'bg-[#134e3a] text-white shadow-sm'
                                : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                    >{p}</button>
            )}

            <button
                onClick={() => onPageChange(page + 1)}
                disabled={page === pages}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition text-lg font-bold"
            >›</button>
        </div>
    );
}

// Valid sidebar tab keys. The active tab is mirrored in the URL (?tab=…) so it
// survives a refresh and the browser back/forward buttons step through tabs.
const SECTION_KEYS = new Set([
    'today', 'appointments', 'patients', 'schedule', 'analytics', 'followups',
]);

export default function DoctorDashboard() {
    const { user, signOut, updateUser } = useAuth();
    const isSecretary = user?.role === 'secretary';
    const navigate = useNavigate();

    const [bookings, setBookings]             = useState([]);
    const [operations, setOperations]         = useState([]);
    const [walkIns, setWalkIns]               = useState([]);
    const [loading, setLoading]               = useState(true);
    const [searchParams, setSearchParams]        = useSearchParams();
    const tabParam                               = searchParams.get('tab');
    // Secretary cannot access analytics/patients — those fall back to today, even
    // if reached via a stale ?tab= URL after a refresh.
    const isAllowedSection = (key) =>
        SECTION_KEYS.has(key) && !(isSecretary && (key === 'analytics' || key === 'patients'));
    const activeSection = isAllowedSection(tabParam) ? tabParam : 'today';

    // Switch tab by updating the URL (?tab=…) so the active section persists across
    // refreshes; each switch is its own history entry (today stays param-free).
    const setActiveSection = (section) => {
        if (!isAllowedSection(section)) return;
        if (section === activeSection) return;
        setSearchParams(section === 'today' ? {} : { tab: section });
    };
    const [drawerPatientId,  setDrawerPatientId]  = useState(null);
    const [drawerHistoryOnly, setDrawerHistoryOnly] = useState(false);
    const [walkInProfile,    setWalkInProfile]    = useState(null); // { phone, name }
    const [profile, setProfile]               = useState(null);

    const [allBkList,    setAllBkList]    = useState([]);
    const [allBkLoading, setAllBkLoading] = useState(false);
    const [allWiList,    setAllWiList]    = useState([]);
    const [allWiLoading, setAllWiLoading] = useState(false);
    const [allTypeFilter,   setAllTypeFilter]   = useState('all'); // 'all'|'bookings'|'walkins'
    const [allStatusFilter, setAllStatusFilter] = useState('all'); // 'all'|'pending'|'completed'|'cancelled'
    const [allMergedPage,   setAllMergedPage]   = useState(1);

    // Increments whenever a booking SSE event arrives; passed to <Analytics> so it
    // re-fetches projected revenue without requiring the doctor to leave and return.
    const [analyticsKey, setAnalyticsKey] = useState(0);

    const [sendingReminders, setSendingReminders] = useState(false);
    const [remindersSent,    setRemindersSent]    = useState(null); // null | number

    const [notifications, setNotifications] = useState([]);
    const [notifOpen, setNotifOpen]         = useState(false);
    const [notifPos, setNotifPos]           = useState({ top: 0, right: 0 });
    const notifRef      = useRef(null);
    const notifPanelRef = useRef(null);

    const fetchNotifications = useCallback(async () => {
        try {
            const { data } = await axiosInstance.get('/doctors/notifications');
            setNotifications(data.data || []);
        } catch { /* ignore */ }
    }, []);
    // Stable ref so the SSE effect can call the latest version without being in its dep array
    const fetchNotificationsRef = useRef(fetchNotifications);
    useEffect(() => { fetchNotificationsRef.current = fetchNotifications; }, [fetchNotifications]);

    const toggleNotif = useCallback(() => {
        if (!notifOpen && notifRef.current) {
            const rect = notifRef.current.getBoundingClientRect();
            setNotifPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
            // SWR: open immediately with cached state, silently refresh in the background
            fetchNotificationsRef.current();
        }
        setNotifOpen((o) => !o);
    }, [notifOpen]);

    const markOneRead = useCallback(async (id) => {
        try {
            await axiosInstance.put(`/doctors/notifications/${id}/read`);
            setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n));
        } catch { /* ignore */ }
    }, []);

    const markAllAsRead = useCallback(async () => {
        try {
            await axiosInstance.put('/doctors/notifications/read-all');
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        } catch { /* ignore */ }
    }, []);

    const deleteNotif = useCallback(async (id) => {
        try {
            await axiosInstance.delete(`/doctors/notifications/${id}`);
            setNotifications((prev) => prev.filter((n) => n._id !== id));
        } catch { /* ignore */ }
    }, []);

    const [cancelTarget, setCancelTarget] = useState(null); // bookingId pending confirmation
    const [cancelLoading, setCancelLoading] = useState(false);
    const [cancelWalkInTarget, setCancelWalkInTarget] = useState(null); // { id, name }
    const [cancelWalkInLoading, setCancelWalkInLoading] = useState(false);
    const [deleteOpTarget, setDeleteOpTarget] = useState(null); // operationId pending confirmation
    const [deleteOpLoading, setDeleteOpLoading] = useState(false);
    const [toasts, setToasts] = useState([]);
    const showToast = useCallback((msg, type = 'booking') => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, msg, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
    }, []);
    // Expose latest showToast to the SSE effect without re-running it
    const showToastRef = useRef(showToast);
    useEffect(() => { showToastRef.current = showToast; }, [showToast]);

    const { permissionBlocked } = usePushNotifications(!!user);

    // Guard: isFetchingRef prevents parallel in-flight fetches from SSE bursts
    // or cancel/re-fetch races that would flood Redis and trip the rate limiter.
    // Debounce: collapses SSE events arriving within 400 ms into one fetch.
    // Direct calls (mount, cancel, note-save) bypass the debounce.
    const isFetchingRef   = useRef(false);
    const fetchDebounceRef = useRef(null);

    const fetchBookings = useCallback(async () => {
        if (isFetchingRef.current) return;   // already in-flight → skip
        isFetchingRef.current = true;
        try {
              // Use local calendar date (not UTC) so the server's dayRange() stays
            // correct after midnight local time when UTC is still the previous day.
            const d = new Date();
            const localDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const [bRes, oRes, wRes] = await Promise.all([
                axiosInstance.get('/bookings/doctor?limit=200'),
                axiosInstance.get('/doctors/operations'),
                axiosInstance.get(`/doctors/walkin?upcoming=true&localDate=${localDate}`),
            ]);
            setBookings(bRes.data.data ?? []);
            setOperations(oRes.data.data ?? []);
            setWalkIns(wRes.data.data ?? []);
        } catch {
            /* swallow — errors are logged by axiosInstance interceptor */
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    }, []);   // setState functions are stable — no deps needed

    const fetchAllBookings = useCallback(async () => {
        setAllBkLoading(true);
        try {
            const { data } = await axiosInstance.get('/bookings/doctor?limit=500');
            setAllBkList(data.data ?? []);
        } catch {
            /* swallow */
        } finally {
            setAllBkLoading(false);
        }
    }, []);

    const fetchAllWalkInsHistory = useCallback(async () => {
        setAllWiLoading(true);
        try {
            const { data } = await axiosInstance.get('/doctors/walkin?history=true');
            setAllWiList(data.data ?? []);
        } catch {
            /* swallow */
        } finally {
            setAllWiLoading(false);
        }
    }, []);

    // Ref so the SSE effect can always call the latest fetchBookings without
    // being added to its dep array (which would re-create the EventSource).
    const fetchBookingsRef = useRef(fetchBookings);
    useEffect(() => { fetchBookingsRef.current = fetchBookings; }, [fetchBookings]);

    // Debounced variant used inside the SSE handler.
    const debouncedFetch = useCallback(() => {
        clearTimeout(fetchDebounceRef.current);
        fetchDebounceRef.current = setTimeout(() => fetchBookingsRef.current(), 400);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            const inBtn   = notifRef.current?.contains(e.target);
            const inPanel = notifPanelRef.current?.contains(e.target);
            if (!inBtn && !inPanel) setNotifOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        fetchBookings();   // direct call on mount — no debounce needed
        fetchNotifications();
        axiosInstance.get('/doctors/me').then(({ data }) => {
            setProfile(data.data);
            // Sync AuthContext so sidebar avatar always reflects the latest
            // profilePicture from the server — survives page refresh and login.
            const pic = data.data?.user?.profilePicture;
            if (pic !== undefined) updateUser({ profilePicture: pic });
        }).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchBookings]);

    // Refresh parent bookings data only when navigating to sections that actually
    // render booking cards.  Sections like 'schedule', 'analytics', and 'follow-ups'
    // manage their own data independently — triggering a 200-booking re-fetch on
    // every tab switch for those sections is wasteful.
    //
    // Sections that DO need fresh booking data from the parent state:
    //   'appointments' — renders the upcoming/history booking list
    //   'patients'     — renders the merged booking + walk-in patient list
    //
    // 'today' (TodayQueue) manages its own fetchAll() independently.
    // SSE events keep the data live for all other sections between navigations.
    const BOOKING_SECTIONS = ['appointments', 'patients'];
    useEffect(() => {
        if (BOOKING_SECTIONS.includes(activeSection)) fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSection, fetchBookings]);

    // Real-time booking notifications via SSE — with exponential-backoff reconnection
    useEffect(() => {
        const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        let es       = null;
        let retryMs  = 1000;   // start at 1 s, cap at 30 s
        let retryTimer = null;
        let unmounted  = false;

        const connect = async () => {
            if (unmounted) return;
            // Fetch a short-lived one-time ticket so the JWT never appears in the
            // SSE URL (which would expose it in server logs and browser history).
            let ticket;
            try {
                const { data } = await axiosInstance.get('/doctors/sse-ticket');
                ticket = data.ticket;
            } catch {
                if (!unmounted) retryTimer = setTimeout(() => {
                    retryMs = Math.min(retryMs * 2, 30_000);
                    connect();
                }, retryMs);
                return;
            }
            if (unmounted) return;

            es = new EventSource(`${base}/doctors/events?ticket=${ticket}`);

            es.addEventListener('new-booking', (e) => {
                let info = {};
                try { info = JSON.parse(e.data); } catch { /* ignore parse errors */ }

                debouncedFetch();
                setAnalyticsKey(k => k + 1);
                // Prepend the embedded notification directly — no HTTP round-trip
                if (info.notification) {
                    setNotifications((prev) => [info.notification, ...prev]);
                } else {
                    fetchNotificationsRef.current();
                }
                playNotificationSound();

                const patientName = info.patientName || 'مريض جديد';
                const timeLabel   = info.startTime   ? ` — الساعة ${fmtTime(info.startTime)}` : '';
                showToastRef.current(`📅 حجز جديد! ${patientName}${timeLabel}`);

                retryMs = 1000;
            });

            es.addEventListener('booking-cancelled', (e) => {
                let info = {};
                try { info = JSON.parse(e.data); } catch { /* ignore parse errors */ }

                debouncedFetch();
                setAnalyticsKey(k => k + 1);
                if (info.notification) {
                    setNotifications((prev) => [info.notification, ...prev]);
                } else {
                    fetchNotificationsRef.current();
                }
                playNotificationSound();

                const patientName = info.patientName || 'المريض';
                const timeLabel   = info.startTime   ? ` الساعة ${fmtTime(info.startTime)}` : '';
                showToastRef.current(`❌ إلغاء حجز — ${patientName}${timeLabel}`);

                retryMs = 1000;
            });

            es.addEventListener('booking-rescheduled', (e) => {
                let info = {};
                try { info = JSON.parse(e.data); } catch { /* ignore parse errors */ }

                debouncedFetch();
                setAnalyticsKey(k => k + 1);
                if (info.notification) {
                    setNotifications((prev) => [info.notification, ...prev]);
                } else {
                    fetchNotificationsRef.current();
                }
                playNotificationSound();

                const patientName = info.patientName || 'المريض';
                const timeLabel   = info.newStartTime ? ` إلى الساعة ${fmtTime(info.newStartTime)}` : '';
                showToastRef.current(`🔄 إعادة جدولة — ${patientName}${timeLabel}`);

                retryMs = 1000;
            });

            es.onopen = () => { retryMs = 1000; };

            es.onerror = () => {
                if (es.readyState === EventSource.CLOSED) {
                    es.close();
                    if (!unmounted) {
                        retryTimer = setTimeout(() => {
                            retryMs = Math.min(retryMs * 2, 30_000);
                            connect();
                        }, retryMs);
                    }
                }
            };
        };

        connect();

        return () => {
            unmounted = true;
            clearTimeout(retryTimer);
            es?.close();
        };
    }, [debouncedFetch]);

    // Load / reload the full list whenever the section becomes active
    useEffect(() => {
        if (activeSection === 'patients') {
            fetchAllBookings();
            fetchAllWalkInsHistory();
        }
    }, [activeSection, fetchAllBookings, fetchAllWalkInsHistory]);

    // Reset to first page when filters change
    useEffect(() => { setAllMergedPage(1); }, [allTypeFilter, allStatusFilter]);

    const handleCancel = (bookingId) => setCancelTarget(bookingId);

    const confirmCancel = async () => {
        if (!cancelTarget) return;
        setCancelLoading(true);
        try {
            await axiosInstance.patch(`/bookings/${cancelTarget}/cancel`);
            // Optimistic update for "جميع الكشوفات" — card reflects cancellation immediately
            // without waiting for the async refetch to complete
            setAllBkList(prev => prev.map(b =>
                String(b._id) === String(cancelTarget) ? { ...b, status: 'cancelled' } : b
            ));
            setCancelTarget(null);
            fetchBookings();
            if (activeSection === 'patients') { fetchAllBookings(); fetchAllWalkInsHistory(); }
        } catch (err) {
            showToast(err.response?.data?.message || 'تعذّر إلغاء الحجز، يرجى المحاولة مرة أخرى', 'error');
        } finally {
            setCancelLoading(false);
        }
    };

    const confirmCancelWalkIn = async () => {
        if (!cancelWalkInTarget) return;
        setCancelWalkInLoading(true);
        try {
            await axiosInstance.delete(`/doctors/walkin/${cancelWalkInTarget.id}`);
            // Optimistic update for "جميع الكشوفات" — remove the walk-in immediately
            setAllWiList(prev => prev.filter(w => String(w._id) !== String(cancelWalkInTarget.id)));
            setCancelWalkInTarget(null);
            fetchBookings();
        } catch (err) {
            showToast(err.response?.data?.message || 'تعذّر إلغاء الزيارة، يرجى المحاولة مرة أخرى', 'error');
        } finally {
            setCancelWalkInLoading(false);
        }
    };

    const confirmDeleteOp = async () => {
        if (!deleteOpTarget) return;
        setDeleteOpLoading(true);
        try {
            await axiosInstance.delete(`/doctors/operations/${deleteOpTarget}`);
            setDeleteOpTarget(null);
            fetchBookings();
        } catch (err) {
            showToast(err.response?.data?.message || 'تعذّر حذف العملية، يرجى المحاولة مرة أخرى', 'error');
        } finally {
            setDeleteOpLoading(false);
        }
    };

    const handleLogout = () => { signOut(); navigate('/login'); };

    const todayBookings   = bookings.filter(b => b.slotDetails?.date && isToday(b.slotDetails.date) && b.status !== 'cancelled');
    const todayOps        = operations.filter(o => o.date && isToday(o.date) && o.status !== 'cancelled');
    const activeWalkIns   = walkIns.filter(w => w.date && isToday(w.date) && w.status !== 'cancelled');

    // Badge: pending-only counts (excluding done/completed)
    const pendingTodayBookings = todayBookings.filter(b => ['confirmed', 'pending'].includes(b.status));
    const pendingTodayWalkIns  = activeWalkIns.filter(w => ['waiting', 'in-progress'].includes(w.status));
    const pendingTodayOps      = todayOps.filter(o => o.status === 'scheduled');
    const todayQueueCount      = pendingTodayBookings.length + pendingTodayWalkIns.length + pendingTodayOps.length;

    // Today's total patients = all non-cancelled items for today (including done)
    const totalPatients = todayBookings.length + activeWalkIns.length;

    const todayEarnings  =
        todayBookings.filter(b => b.status === 'completed').reduce((s, b) => s + (b.consultationFee ?? 0), 0) +
        activeWalkIns.filter(w => w.status === 'done').reduce((s, w) => s + (w.fee ?? 0), 0) +
        todayOps.filter(o => o.status === 'done').reduce((s, o) => s + (o.fee ?? 0), 0);

    const now = new Date(); now.setHours(0, 0, 0, 0); // local midnight, not UTC

    const upcomingBookings = bookings.filter(b =>
        ['confirmed', 'pending', 'in-progress'].includes(b.status) && new Date(b.slotDetails?.date) >= now
    );

    const upcomingOperations = operations.filter(o =>
        o.status === 'scheduled' && new Date(o.date) >= now
    );

    const todayWalkIns       = walkIns.filter(w => w.date && isToday(w.date));
    const todayActiveWalkIns = todayWalkIns.filter(w => w.status !== 'done');
    const futureWalkIns      = walkIns.filter(w => w.date && !isToday(w.date));

    // Split upcoming into today vs future for the appointments page
    const todayBk            = upcomingBookings.filter(b => isToday(b.slotDetails?.date));
    const futureBk           = upcomingBookings.filter(b => !isToday(b.slotDetails?.date));
    const todayScheduledOps  = upcomingOperations.filter(o => isToday(o.date));
    const futureScheduledOps = upcomingOperations.filter(o => !isToday(o.date));

    // Bookings scheduled for tomorrow (daysUntil === 1) — used for the reminder button
    const tomorrowBk = futureBk.filter(b => daysUntil(b.slotDetails?.date) === 1);

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    // ── "جميع الكشوفات" merged + filtered list ───────────────────────────────
    const MERGED_PER_PAGE = 10;
    const allMergedList = useMemo(() => {
        const bkItems = allTypeFilter !== 'walkins'
            ? allBkList
                .filter(b => allStatusFilter === 'all' || bkStatusCategory(b.status) === allStatusFilter)
                .map(b => ({ ...b, _itemType: 'booking', _sortDate: b.slotDetails?.date }))
            : [];
        const wiItems = allTypeFilter !== 'bookings'
            ? allWiList
                .filter(w => allStatusFilter === 'all' || wiStatusCategory(w.status) === allStatusFilter)
                .map(w => ({ ...w, _itemType: 'walkin', _sortDate: w.date }))
            : [];
        return [...bkItems, ...wiItems]
            .sort((a, b) => new Date(b._sortDate) - new Date(a._sortDate));
    }, [allBkList, allWiList, allTypeFilter, allStatusFilter]);
    const allMergedTotal     = allMergedList.length;
    const allMergedPages     = Math.max(1, Math.ceil(allMergedTotal / MERGED_PER_PAGE));
    const allMergedPageItems = allMergedList.slice(
        (allMergedPage - 1) * MERGED_PER_PAGE,
        allMergedPage * MERGED_PER_PAGE
    );
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-[#f0f4f2] flex flex-col font-['Cairo']" dir="rtl">

            <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map((t) => (
                        <motion.div
                            key={t.id}
                            initial={{ opacity: 0, y: -20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0,   scale: 1   }}
                            exit={{    opacity: 0, y: -20, scale: 0.9 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            className={`px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 pointer-events-auto max-w-sm w-full ${
                                t.type === 'error'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-[#134e3a] text-white'
                            }`}
                            dir="rtl"
                        >
                            <span className="text-xl shrink-0">{t.type === 'error' ? '⚠️' : '🔔'}</span>
                            <span className="text-sm font-bold leading-snug flex-1">{t.msg}</span>
                            <button
                                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                                className="text-white/60 hover:text-white transition-colors shrink-0 text-xs"
                            >
                                ✕
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {permissionBlocked && (
                <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 shadow-lg flex items-start gap-3" dir="rtl">
                    <span className="text-xl shrink-0">🔔</span>
                    <div>
                        <p className="text-sm font-bold text-amber-800">الإشعارات موقوفة في المتصفح</p>
                        <p className="text-xs text-amber-600 mt-0.5">
                            اضغط على 🔒 في شريط العنوان ← <b>إعدادات الموقع</b> ← غيّر الإشعارات من <b>محجوب</b> إلى <b>مسموح</b>، ثم أعد تحميل الصفحة.
                        </p>
                    </div>
                </div>
            )}

            <div className="flex flex-1">
            <aside className="w-64 bg-white border-l border-gray-100 flex flex-col sticky top-0 h-screen shrink-0 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                    <div>
                        <p className="text-xl font-black text-[#134e3a] tracking-tight">SAGE</p>
                        <p className="text-xs text-gray-400">لوحة الطبيب</p>
                    </div>

                    <div ref={notifRef}>
                        <button
                            onClick={toggleNotif}
                            className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
                            aria-label="الإشعارات"
                        >
                            <span className="material-symbols-outlined text-[22px] text-gray-500">notifications</span>
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                <div className="px-5 py-4 border-b border-gray-50">
                    {user?.profilePicture ? (
                        <img
                            src={`${SERVER_BASE}${user.profilePicture}`}
                            alt="صورة الملف الشخصي"
                            className="w-12 h-12 rounded-full object-cover mb-2"
                        />
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center font-black text-emerald-700 text-lg mb-2">
                            {user?.name?.charAt(0) ?? 'د'}
                        </div>
                    )}
                    <p className="font-bold text-[#191c1c] text-sm leading-tight">
                        {isSecretary ? user?.name : `د. ${user?.name ?? '—'}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                        {isSecretary ? 'سكرتيرة' : (profile?.specialization ?? 'طبيب')}
                    </p>
                    <div className="flex items-center gap-1 mt-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[11px] text-emerald-600 font-semibold">متاح الآن</span>
                    </div>
                </div>

                <nav className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-1.5">
                    <NavItem
                        icon="today"
                        label="لوحة اليوم"
                        active={activeSection === 'today'}
                        onClick={() => setActiveSection('today')}
                        badge={todayQueueCount}
                    />
                    <NavItem
                        icon="calendar_month"
                        label="المواعيد القادمة"
                        active={activeSection === 'appointments'}
                        onClick={() => setActiveSection('appointments')}
                        badge={upcomingBookings.length + upcomingOperations.length + todayActiveWalkIns.length + futureWalkIns.length}
                    />
                    {!isSecretary && (
                        <NavItem
                            icon="groups"
                            label="جميع الكشوفات"
                            active={activeSection === 'patients'}
                            onClick={() => setActiveSection('patients')}
                        />
                    )}
                    <NavItem
                        icon="edit_calendar"
                        label="إدارة الجدول"
                        active={activeSection === 'schedule'}
                        onClick={() => setActiveSection('schedule')}
                    />
                    {!isSecretary && (
                        <NavItem
                            icon="bar_chart_4_bars"
                            label="الإحصائيات"
                            active={activeSection === 'analytics'}
                            onClick={() => setActiveSection('analytics')}
                        />
                    )}
                    <NavItem
                        icon="autorenew"
                        label="المتابعات"
                        active={activeSection === 'followups'}
                        onClick={() => setActiveSection('followups')}
                    />
                </nav>

                <div className="shrink-0 px-4 pb-4 border-t border-gray-50 pt-3 flex flex-col gap-2">
                    <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 p-3 space-y-2">
                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">إحصائيات سريعة</p>
                        <div className="grid grid-cols-2 gap-1.5">
                            {[
                                { label: 'مريض',        value: totalPatients,                                                                       icon: '👥', full: false },
                                { label: 'إيراد اليوم', value: `${todayEarnings.toLocaleString('ar-EG')} ج`,                                       icon: '💰', full: false },
                                { label: 'اليوم',       value: todayBk.length + todayScheduledOps.length + todayActiveWalkIns.length, icon: '⏳', full: true  },
                            ].map(s => (
                                <div key={s.label} className={`bg-white rounded-xl p-2 text-center shadow-sm ${s.full ? 'col-span-2' : ''}`}>
                                    <p className="text-sm">{s.icon}</p>
                                    <p className="text-sm font-black text-[#134e3a]">{s.value}</p>
                                    <p className="text-[9px] text-gray-400">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {!isSecretary && (
                        <Link
                            to="/doctor-profile"
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-bold text-[#134e3a] rounded-2xl hover:bg-emerald-50 transition-colors border border-emerald-100"
                        >
                            <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
                            الملف الشخصي
                        </Link>
                    )}
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-bold text-red-400 rounded-2xl hover:bg-red-50 transition-colors border border-red-100"
                    >
                        <span className="material-symbols-outlined text-[18px]">logout</span>
                        تسجيل الخروج
                    </button>
                </div>
            </aside>

            {/* Notification panel — portal to body so it escapes the sidebar's stacking context */}
            {notifOpen && createPortal(
                <div
                    ref={notifPanelRef}
                    style={{ position: 'fixed', top: notifPos.top, right: notifPos.right, zIndex: 9999 }}
                    className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
                    dir="rtl"
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <p className="font-black text-[#134e3a] text-sm">الإشعارات</p>
                            {unreadCount > 0 && (
                                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                    {unreadCount} جديد
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button onClick={markAllAsRead} className="text-xs text-emerald-600 font-bold hover:text-emerald-800 transition-colors">
                                تعليم الكل كمقروء
                            </button>
                        )}
                    </div>
                    <div className="max-h-[360px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                                <span className="material-symbols-outlined text-[40px] mb-2">notifications_off</span>
                                <p className="text-sm font-medium">لا توجد إشعارات</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {notifications.map((n) => {
                                    const cfg = NOTIF_ICON[n.type] || NOTIF_ICON.system;
                                    return (
                                        <div
                                            key={n._id}
                                            onClick={() => !n.isRead && markOneRead(n._id)}
                                            className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50 cursor-pointer ${!n.isRead ? 'bg-emerald-50/60' : ''}`}
                                        >
                                            <div className={`w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                                                <span className={`material-symbols-outlined text-[16px] ${cfg.color}`}>{cfg.icon}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-[#191c1c] leading-snug">{n.title}</p>
                                                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                                                <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                                            </div>
                                            <div className="flex flex-col items-center gap-2 shrink-0">
                                                {!n.isRead && <span className="w-2 h-2 bg-emerald-500 rounded-full mt-1" />}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); deleteNotif(n._id); }}
                                                    className="text-gray-300 hover:text-red-400 transition-colors"
                                                    aria-label="حذف"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}

            <main className="flex-1 p-8">

                {activeSection === 'today' && <TodayQueue doctorName={user?.name} isSecretary={isSecretary} onDataChange={fetchBookings} onOpenDrawer={(pid) => setDrawerPatientId(pid)} />}

                {activeSection === 'schedule' && <ScheduleManager isSecretary={isSecretary} />}

                {activeSection === 'analytics' && <Analytics refreshKey={analyticsKey} />}

                {activeSection === 'followups' && <FollowUps onOpenDrawer={(pid) => setDrawerPatientId(pid)} />}

                {activeSection === 'appointments' && (
                    <>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-black text-[#191c1c]">المواعيد القادمة</h2>
                                <p className="text-xs text-gray-400 mt-0.5">الحجوزات المؤكدة والعمليات المجدولة — اليوم والأيام القادمة</p>
                            </div>
                            <span className="text-sm font-bold text-[#134e3a] bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100">
                                {upcomingBookings.length + upcomingOperations.length + todayActiveWalkIns.length + futureWalkIns.length} موعد
                            </span>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-24">
                                <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                            </div>
                        ) : upcomingBookings.length === 0 && upcomingOperations.length === 0 && todayActiveWalkIns.length === 0 && futureWalkIns.length === 0 ? (
                            <div className="bg-white rounded-2xl p-16 text-center shadow-sm border border-gray-100">
                                <span className="material-symbols-outlined text-[48px] text-gray-200 mb-3 block">event_busy</span>
                                <p className="text-gray-400 font-semibold">لا توجد مواعيد قادمة</p>
                            </div>
                        ) : (
                            <div className="space-y-10">

                                {/* ── Today ──────────────────────────────────────────── */}
                                {(todayBk.length > 0 || todayScheduledOps.length > 0 || todayActiveWalkIns.length > 0) && (
                                    <div>
                                        {/* Section header */}
                                        <div className="flex items-center gap-3 mb-5">
                                            <span className="bg-[#134e3a] text-white text-xs font-black px-3 py-1 rounded-full">
                                                اليوم
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                            </span>
                                            <span className="flex-1 h-px bg-gray-100" />
                                            <span className="text-xs font-bold text-gray-400">
                                                {todayBk.length + todayScheduledOps.length + todayActiveWalkIns.length} موعد
                                            </span>
                                        </div>

                                                        {/* Today layout: operations first, then bookings+walk-ins mixed by time */}
                                        <div className="space-y-5">
                                            {todayScheduledOps.length > 0 && (
                                                <div>
                                                    {(todayBk.length > 0 || todayActiveWalkIns.length > 0) && (
                                                        <p className="text-[11px] font-bold text-purple-500 uppercase tracking-wider mb-3">عمليات مجدولة</p>
                                                    )}
                                                    <motion.div layout className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                                        <AnimatePresence>
                                                            {todayScheduledOps
                                                                .slice()
                                                                .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
                                                                .map(op => (
                                                                <OperationCard key={op._id} op={op}
                                                                    onDelete={(id) => setDeleteOpTarget(id)}
                                                                    onOpenDrawer={(pid) => setDrawerPatientId(pid)}
                                                                    onDataChange={fetchBookings} />
                                                            ))}
                                                        </AnimatePresence>
                                                    </motion.div>
                                                </div>
                                            )}

                                            {/* Bookings + walk-ins mixed, sorted by appointment time */}
                                            {(todayBk.length > 0 || todayActiveWalkIns.length > 0) && (() => {
                                                const mixed = [
                                                    ...todayBk.map(b => ({ _type: 'booking', _time: b.slotDetails?.startTime ?? '00:00', data: b })),
                                                    ...todayActiveWalkIns.map(w => ({ _type: 'walkin',  _time: w.arrivalTime ?? '00:00',            data: w })),
                                                ].sort((a, b) => a._time.localeCompare(b._time));
                                                return (
                                                    <div>
                                                        {todayScheduledOps.length > 0 && (
                                                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">حجوزات وزيارات</p>
                                                        )}
                                                        <motion.div layout className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                                            <AnimatePresence>
                                                                {mixed.map(item =>
                                                                    item._type === 'booking' ? (
                                                                        <BookingCard key={`b-${item.data._id}`} booking={item.data}
                                                                            onOpenDrawer={(pid) => { setDrawerHistoryOnly(false); setDrawerPatientId(pid); }}
                                                                            onOpenHistory={(pid) => { setDrawerHistoryOnly(true); setDrawerPatientId(pid); }}
                                                                            onCancel={handleCancel}
                                                                            onDataChange={fetchBookings} />
                                                                    ) : (
                                                                        <WalkInCard key={`w-${item.data._id}`} w={item.data}
                                                                            onOpenDrawer={(pid) => { setDrawerHistoryOnly(false); setDrawerPatientId(pid); }}
                                                                            onOpenHistory={(pid) => { setDrawerHistoryOnly(true); setDrawerPatientId(pid); }}
                                                                            onOpenWalkInProfile={(ph, nm) => setWalkInProfile({ phone: ph, name: nm })}
                                                                            onDataChange={fetchBookings}
                                                                            onCancel={(id, name) => setCancelWalkInTarget({ id, name })}
                                                                            isSecretary={isSecretary} />
                                                                    )
                                                                )}
                                                            </AnimatePresence>
                                                        </motion.div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* ── Future days ────────────────────────────────────── */}
                                {(futureBk.length > 0 || futureScheduledOps.length > 0 || futureWalkIns.length > 0) && (
                                    <div>
                                        {/* Section header */}
                                        <div className="flex items-center gap-3 mb-5">
                                            <span className="bg-gray-100 text-gray-600 text-xs font-black px-3 py-1 rounded-full">
                                                الأيام القادمة
                                            </span>
                                            <span className="flex-1 h-px bg-gray-100" />
                                            {/* Tomorrow reminder button */}
                                            {tomorrowBk.length > 0 && (
                                                remindersSent !== null ? (
                                                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                                                        <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                                        تم إرسال {remindersSent} تذكير
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={async () => {
                                                            setSendingReminders(true);
                                                            try {
                                                                const { data } = await axiosInstance.post('/bookings/remind-tomorrow');
                                                                setRemindersSent(data.sent ?? 0);
                                                            } catch { /* swallow */ }
                                                            finally { setSendingReminders(false); }
                                                        }}
                                                        disabled={sendingReminders}
                                                        className="flex items-center gap-1.5 text-xs font-bold text-[#134e3a] bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors disabled:opacity-60"
                                                    >
                                                        {sendingReminders
                                                            ? <span className="w-3 h-3 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
                                                            : <span className="material-symbols-outlined text-[13px]">send</span>
                                                        }
                                                        {sendingReminders ? 'جارٍ الإرسال…' : `تذكير بكرا (${tomorrowBk.length})`}
                                                    </button>
                                                )
                                            )}
                                            <span className="text-xs font-bold text-gray-400">
                                                {futureBk.length + futureScheduledOps.length + futureWalkIns.length} موعد
                                            </span>
                                        </div>

                                        {/* Future layout: operations first sorted by date+time, then bookings sorted */}
                                        <div className="space-y-5">
                                            {futureScheduledOps.length > 0 && (
                                                <div>
                                                    {futureBk.length > 0 && (
                                                        <p className="text-[11px] font-bold text-purple-500 uppercase tracking-wider mb-3">عمليات مجدولة</p>
                                                    )}
                                                    <motion.div layout className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                                        <AnimatePresence>
                                                            {futureScheduledOps
                                                                .slice()
                                                                .sort((a, b) => {
                                                                    const diff = new Date(a.date) - new Date(b.date);
                                                                    return diff !== 0 ? diff : (a.time ?? '').localeCompare(b.time ?? '');
                                                                })
                                                                .map(op => (
                                                                <OperationCard key={op._id} op={op}
                                                                    onDelete={(id) => setDeleteOpTarget(id)}
                                                                    onOpenDrawer={(pid) => setDrawerPatientId(pid)}
                                                                    onDataChange={fetchBookings} />
                                                            ))}
                                                        </AnimatePresence>
                                                    </motion.div>
                                                </div>
                                            )}
                                            {(futureBk.length > 0 || futureWalkIns.length > 0) && (() => {
                                                const mixed = [
                                                    ...futureBk.map(b => ({ _type: 'booking', _date: b.slotDetails?.date, _time: b.slotDetails?.startTime ?? '00:00', data: b })),
                                                    ...futureWalkIns.map(w => ({ _type: 'walkin',  _date: w.date,             _time: w.arrivalTime ?? '00:00',              data: w })),
                                                ].sort((a, b) => {
                                                    const diff = new Date(a._date) - new Date(b._date);
                                                    return diff !== 0 ? diff : a._time.localeCompare(b._time);
                                                });
                                                return (
                                                    <div>
                                                        {futureScheduledOps.length > 0 && (
                                                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">حجوزات وزيارات</p>
                                                        )}
                                                        <motion.div layout className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                                            <AnimatePresence>
                                                                {mixed.map(item =>
                                                                    item._type === 'booking' ? (
                                                                        <BookingCard key={`b-${item.data._id}`} booking={item.data}
                                                                            onOpenDrawer={(pid) => { setDrawerHistoryOnly(false); setDrawerPatientId(pid); }}
                                                                            onOpenHistory={(pid) => { setDrawerHistoryOnly(true); setDrawerPatientId(pid); }}
                                                                            onCancel={handleCancel}
                                                                            onDataChange={fetchBookings} />
                                                                    ) : (
                                                                        <WalkInCard key={`w-${item.data._id}`} w={item.data}
                                                                            onOpenDrawer={(pid) => { setDrawerHistoryOnly(false); setDrawerPatientId(pid); }}
                                                                            onOpenHistory={(pid) => { setDrawerHistoryOnly(true); setDrawerPatientId(pid); }}
                                                                            onOpenWalkInProfile={(ph, nm) => setWalkInProfile({ phone: ph, name: nm })}
                                                                            onDataChange={fetchBookings}
                                                                            onCancel={(id, name) => setCancelWalkInTarget({ id, name })}
                                                                            isSecretary={isSecretary} />
                                                                    )
                                                                )}
                                                            </AnimatePresence>
                                                        </motion.div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}

                            </div>
                        )}
                    </>
                )}

                {activeSection === 'patients' && !isSecretary && (
                    <>
                        {/* ── Header ── */}
                        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                            <div>
                                <h2 className="text-xl font-black text-[#191c1c]">جميع الكشوفات</h2>
                                <p className="text-xs text-gray-400 mt-0.5">كل الحجوزات والزيارات</p>
                            </div>
                            {allMergedTotal > 0 && (
                                <span className="text-sm font-bold text-[#134e3a] bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100">
                                    {allMergedTotal} كشف
                                </span>
                            )}
                        </div>

                        {/* ── Filter bar ── */}
                        <div className="flex flex-wrap gap-3 mb-6">
                            <div className="flex items-center gap-1.5 bg-white rounded-2xl px-3 py-2 shadow-sm border border-gray-100">
                                <span className="text-xs font-bold text-gray-400 ml-1">النوع:</span>
                                {[
                                    { key: 'all',      label: 'الكل' },
                                    { key: 'bookings', label: '📅 أونلاين' },
                                    { key: 'walkins',  label: '🚶 زيارة' },
                                ].map(opt => (
                                    <button
                                        key={opt.key}
                                        onClick={() => { setAllTypeFilter(opt.key); setAllMergedPage(1); }}
                                        className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                                            allTypeFilter === opt.key
                                                ? 'bg-[#134e3a] text-white'
                                                : 'text-gray-500 hover:bg-gray-100'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-1.5 bg-white rounded-2xl px-3 py-2 shadow-sm border border-gray-100">
                                <span className="text-xs font-bold text-gray-400 ml-1">الحالة:</span>
                                {[
                                    { key: 'all',       label: 'الكل' },
                                    { key: 'pending',   label: 'قيد الانتظار' },
                                    { key: 'completed', label: 'مكتمل' },
                                    { key: 'cancelled', label: 'ملغي' },
                                ].map(opt => (
                                    <button
                                        key={opt.key}
                                        onClick={() => { setAllStatusFilter(opt.key); setAllMergedPage(1); }}
                                        className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                                            allStatusFilter === opt.key
                                                ? 'bg-[#134e3a] text-white'
                                                : 'text-gray-500 hover:bg-gray-100'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {(allBkLoading || allWiLoading) ? (
                            <div className="flex justify-center py-24">
                                <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                            </div>
                        ) : allMergedPageItems.length === 0 ? (
                            <div className="bg-white rounded-2xl p-16 text-center shadow-sm border border-gray-100">
                                <span className="material-symbols-outlined text-[48px] text-gray-200 mb-3 block">event_busy</span>
                                <p className="text-gray-400 font-semibold">لا توجد كشوفات</p>
                            </div>
                        ) : (
                            <>
                                <motion.div layout className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    <AnimatePresence>
                                        {allMergedPageItems.map(item =>
                                            item._itemType === 'booking' ? (
                                                <BookingCard key={`bk-${item._id}`} booking={item}
                                                    onOpenDrawer={(pid) => { setDrawerHistoryOnly(false); setDrawerPatientId(pid); }}
                                                    onOpenHistory={(pid) => { setDrawerHistoryOnly(true); setDrawerPatientId(pid); }}
                                                    onCancel={handleCancel}
                                                    onDataChange={() => { fetchAllBookings(); fetchAllWalkInsHistory(); }} />
                                            ) : (
                                                <WalkInCard key={`wi-${item._id}`} w={item}
                                                    onOpenDrawer={(pid) => { setDrawerHistoryOnly(false); setDrawerPatientId(pid); }}
                                                    onOpenHistory={(pid) => { setDrawerHistoryOnly(true); setDrawerPatientId(pid); }}
                                                    onOpenWalkInProfile={(phone, name) => setWalkInProfile({ phone, name })}
                                                    onDataChange={() => { fetchAllBookings(); fetchAllWalkInsHistory(); }}
                                                    onCancel={(id, name) => setCancelWalkInTarget({ id, name })}
                                                    isSecretary={false} />
                                            )
                                        )}
                                    </AnimatePresence>
                                </motion.div>

                                <Pagination
                                    page={allMergedPage}
                                    pages={allMergedPages}
                                    onPageChange={(p) => setAllMergedPage(p)}
                                />

                                <p className="text-center text-xs text-gray-400 mt-3">
                                    صفحة {allMergedPage} من {allMergedPages} — إجمالي {allMergedTotal} كشف
                                </p>
                            </>
                        )}
                    </>
                )}

            </main>
            </div>

            <Footer variant="doctor" />

            <AnimatePresence>
                {drawerPatientId && (
                    <>
                        <motion.div
                            key="overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/30 z-40"
                            onClick={() => setDrawerPatientId(null)}
                        />
                        <PatientDrawer
                            patientId={drawerPatientId}
                            onClose={() => { setDrawerPatientId(null); setDrawerHistoryOnly(false); }}
                            isSecretary={isSecretary}
                            historyOnly={drawerHistoryOnly}
                        />
                    </>
                )}
            </AnimatePresence>



            {walkInProfile && (
                <WalkInProfileModal
                    phone={walkInProfile.phone}
                    name={walkInProfile.name}
                    onClose={() => setWalkInProfile(null)}
                    onOpenFullDrawer={(pid) => { setWalkInProfile(null); setDrawerPatientId(pid); }}
                />
            )}

            {/* ── Unified confirmation modals ─────────────────────────────── */}

            {/* Booking cancel */}
            <AnimatePresence>
                {cancelTarget && (
                    <motion.div key="cancel-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
                        onClick={(e) => e.target === e.currentTarget && !cancelLoading && setCancelTarget(null)}
                    >
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-sm" dir="rtl"
                        >
                            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-red-500 text-[24px]">event_busy</span>
                            </div>
                            <h3 className="text-lg font-black text-gray-800 mb-1">إلغاء الحجز</h3>
                            <p className="text-sm text-gray-500 mb-6">هل أنت متأكد من إلغاء هذا الحجز؟ لا يمكن التراجع عن هذا الإجراء.</p>
                            <div className="flex gap-3">
                                <button onClick={confirmCancel} disabled={cancelLoading}
                                    className="flex-1 bg-red-500 text-white font-bold py-3 rounded-2xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                    {cancelLoading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    نعم، إلغاء الحجز
                                </button>
                                <button onClick={() => setCancelTarget(null)} disabled={cancelLoading}
                                    className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-2xl hover:bg-gray-50 transition-colors disabled:opacity-40">
                                    رجوع
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Walk-in cancel */}
            <AnimatePresence>
                {cancelWalkInTarget && (
                    <motion.div key="cancel-wi-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
                        onClick={(e) => e.target === e.currentTarget && !cancelWalkInLoading && setCancelWalkInTarget(null)}
                    >
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-sm" dir="rtl"
                        >
                            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-red-500 text-[24px]">person_cancel</span>
                            </div>
                            <h3 className="text-lg font-black text-gray-800 mb-1">إلغاء الزيارة</h3>
                            <p className="text-sm text-gray-500 mb-6">
                                سيتم إلغاء زيارة <span className="font-bold text-gray-700">{cancelWalkInTarget.name}</span>. لا يمكن التراجع عن هذا الإجراء.
                            </p>
                            <div className="flex gap-3">
                                <button onClick={confirmCancelWalkIn} disabled={cancelWalkInLoading}
                                    className="flex-1 bg-red-500 text-white font-bold py-3 rounded-2xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                    {cancelWalkInLoading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    نعم، إلغاء الزيارة
                                </button>
                                <button onClick={() => setCancelWalkInTarget(null)} disabled={cancelWalkInLoading}
                                    className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-2xl hover:bg-gray-50 transition-colors disabled:opacity-40">
                                    رجوع
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Operation delete */}
            <AnimatePresence>
                {deleteOpTarget && (
                    <motion.div key="delete-op-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
                        onClick={(e) => e.target === e.currentTarget && !deleteOpLoading && setDeleteOpTarget(null)}
                    >
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-sm" dir="rtl"
                        >
                            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-red-500 text-[24px]">delete</span>
                            </div>
                            <h3 className="text-lg font-black text-gray-800 mb-1">حذف العملية</h3>
                            <p className="text-sm text-gray-500 mb-6">هل أنت متأكد من حذف هذه العملية؟ سيتم تحرير المواعيد المحجوزة لها تلقائياً.</p>
                            <div className="flex gap-3">
                                <button onClick={confirmDeleteOp} disabled={deleteOpLoading}
                                    className="flex-1 bg-red-500 text-white font-bold py-3 rounded-2xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                    {deleteOpLoading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    نعم، حذف العملية
                                </button>
                                <button onClick={() => setDeleteOpTarget(null)} disabled={deleteOpLoading}
                                    className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-2xl hover:bg-gray-50 transition-colors disabled:opacity-40">
                                    رجوع
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

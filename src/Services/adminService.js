import axiosInstance from '../api/axiosInstance';

/**
 * Admin service layer.
 *
 * Wraps every admin-panel API call so components never touch axios directly —
 * consistent with authService.js / patientService.js. Each function returns the
 * parsed response body (response.data) on success and throws an Error carrying a
 * human-readable Arabic message on failure; read it via `err.message`.
 *
 * Exception: getDoctorDocument returns the RAW axios response (see its note).
 */

const extractError = (error, fallback = 'حدث خطأ في الاتصال بالسيرفر') =>
    error.response?.data?.message || fallback;

// ── Platform · overview · health ──────────────────────────────────────────────

export const getPlatformStats = async () => {
    try {
        const { data } = await axiosInstance.get('/admin/stats');
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل إحصائيات المنصة'));
    }
};

export const getSystemHealth = async () => {
    try {
        const { data } = await axiosInstance.get('/admin/health');
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل صحة النظام'));
    }
};

export const getMetricsHistory = async () => {
    try {
        const { data } = await axiosInstance.get('/admin/metrics-history');
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل سجل القياسات'));
    }
};

export const getSseTicket = async () => {
    try {
        const { data } = await axiosInstance.get('/admin/sse-ticket');
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر إصدار تذكرة الاتصال'));
    }
};

// ── Users ─────────────────────────────────────────────────────────────────────

export const getAllUsers = async (params) => {
    try {
        const { data } = await axiosInstance.get('/admin/users', { params });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل المستخدمين'));
    }
};

export const suspendUser = async (id, reason) => {
    try {
        const { data } = await axiosInstance.patch(`/admin/users/${id}/suspend`, { reason });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'فشل تعليق الحساب'));
    }
};

export const unsuspendUser = async (id) => {
    try {
        const { data } = await axiosInstance.patch(`/admin/users/${id}/unsuspend`);
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'فشل رفع الإيقاف'));
    }
};

export const deleteUser = async (id) => {
    try {
        const { data } = await axiosInstance.delete(`/admin/users/${id}`);
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'فشل حذف الحساب'));
    }
};

export const restoreUser = async (id) => {
    try {
        const { data } = await axiosInstance.patch(`/admin/users/${id}/restore`);
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'فشل استعادة الحساب'));
    }
};

// ── Doctors ───────────────────────────────────────────────────────────────────

export const getAllDoctors = async (params) => {
    try {
        const { data } = await axiosInstance.get('/admin/doctors', { params });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل الأطباء'));
    }
};

export const getDoctorBookings = async (doctorId, params) => {
    try {
        const { data } = await axiosInstance.get(`/admin/doctors/${doctorId}/bookings`, { params });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل الحجوزات'));
    }
};

export const suspendDoctor = async (profileId, reason) => {
    try {
        const { data } = await axiosInstance.patch(`/admin/doctors/${profileId}/suspend`, { reason });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'فشل تعليق الطبيب'));
    }
};

export const unsuspendDoctor = async (profileId) => {
    try {
        const { data } = await axiosInstance.patch(`/admin/doctors/${profileId}/unsuspend`);
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'فشل رفع الإيقاف عن الطبيب'));
    }
};

// ── Doctor verification (pending applications) ────────────────────────────────

export const getPendingDoctors = async (params) => {
    try {
        const { data } = await axiosInstance.get('/admin/pending-doctors', { params });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل الطلبات'));
    }
};

export const startDoctorReview = async (profileId) => {
    try {
        const { data } = await axiosInstance.patch(`/admin/doctors/${profileId}/start-review`);
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'فشل بدء مراجعة الطلب'));
    }
};

export const approveDoctor = async (profileId) => {
    try {
        const { data } = await axiosInstance.patch(`/admin/doctors/${profileId}/approve`);
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'فشل تفعيل الطبيب'));
    }
};

export const rejectDoctor = async (profileId, reason) => {
    try {
        const { data } = await axiosInstance.patch(`/admin/doctors/${profileId}/reject`, { reason });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'فشل رفض الطلب'));
    }
};

/**
 * EXCEPTION to the "return data / throw Error" convention: returns the RAW axios
 * response (responseType: 'blob') because the caller needs the Content-Type
 * header to tell a signed-URL JSON payload from a file blob, and unwraps the
 * blob error body itself.
 */
export const getDoctorDocument = (profileId, docType) =>
    axiosInstance.get(`/admin/doctors/${profileId}/documents/${docType}`, { responseType: 'blob' });

// ── Reviews ───────────────────────────────────────────────────────────────────

export const getReviews = async (params) => {
    try {
        const { data } = await axiosInstance.get('/admin/reviews', { params });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل التقييمات'));
    }
};

export const deleteReview = async (id) => {
    try {
        const { data } = await axiosInstance.delete(`/admin/reviews/${id}`);
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'فشل حذف التقييم'));
    }
};

// ── Logs ──────────────────────────────────────────────────────────────────────

export const getAuditLogs = async (params) => {
    try {
        const { data } = await axiosInstance.get('/admin/audit-logs', { params });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل سجل الإدارة'));
    }
};

export const getSystemLogs = async (params) => {
    try {
        const { data } = await axiosInstance.get('/admin/system-logs', { params });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل نشاط النظام'));
    }
};

export const getErrorLogs = async (params) => {
    try {
        const { data } = await axiosInstance.get('/admin/error-logs', { params });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل سجل الأخطاء'));
    }
};

// ── Booking analytics ─────────────────────────────────────────────────────────

export const getBookingAnalytics = async (params) => {
    try {
        const { data } = await axiosInstance.get('/admin/booking-analytics', { params });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل إحصائيات العيادات'));
    }
};

// ── Advanced analytics (data intelligence) ────────────────────────────────────

export const getGrowthAnalytics = async () => {
    try {
        const { data } = await axiosInstance.get('/admin/analytics/growth');
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل تحليلات النمو'));
    }
};

export const getDemandGaps = async () => {
    try {
        const { data } = await axiosInstance.get('/admin/analytics/demand-gaps');
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل فجوات الطلب'));
    }
};

export const getActivityHeatmap = async () => {
    try {
        const { data } = await axiosInstance.get('/admin/analytics/activity-heatmap');
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل خريطة النشاط'));
    }
};

export const getClinicEconomics = async (params) => {
    try {
        const { data } = await axiosInstance.get('/admin/analytics/clinic-economics', { params });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل اقتصاديات العيادات'));
    }
};

export const getClinicEfficiency = async (params) => {
    try {
        const { data } = await axiosInstance.get('/admin/analytics/clinic-efficiency', { params });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل كفاءة العيادات'));
    }
};

export const getPatientDemographics = async () => {
    try {
        const { data } = await axiosInstance.get('/admin/analytics/patient-demographics');
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل ديموغرافيا المرضى'));
    }
};

export const getDoctorHealth = async () => {
    try {
        const { data } = await axiosInstance.get('/admin/analytics/doctor-health');
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل صحة الأطباء'));
    }
};

export const getAiUsage = async (params) => {
    try {
        const { data } = await axiosInstance.get('/admin/analytics/ai-usage', { params });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل استخدام الذكاء الاصطناعي'));
    }
};

export const getSecretaryActivity = async (params) => {
    try {
        const { data } = await axiosInstance.get('/admin/analytics/secretary-activity', { params });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل نشاط السكرتارية'));
    }
};

// ── Ops center ────────────────────────────────────────────────────────────────

export const getOpsCenter = async () => {
    try {
        const { data } = await axiosInstance.get('/admin/ops-center');
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل مركز العمليات'));
    }
};

export const updateInfraConfig = async (form) => {
    try {
        const { data } = await axiosInstance.patch('/admin/ops-center/infra', form);
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'فشل حفظ إعدادات البنية التحتية'));
    }
};

// ── AI engine (invoked from the admin Health panel) ───────────────────────────

export const getAiServiceHealth = async () => {
    try {
        const { data } = await axiosInstance.get('/ai/health');
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'تعذّر تحميل صحة محرك الذكاء الاصطناعي'));
    }
};

export const rebuildAiEngine = async () => {
    try {
        // Rebuild can take several minutes — override the default short timeout.
        const { data } = await axiosInstance.post('/ai/rebuild', {}, { timeout: 300_000 });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'فشلت عملية إعادة البناء. تأكد من تشغيل محرك الذكاء الاصطناعي.'));
    }
};

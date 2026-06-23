import axiosInstance from '../api/axiosInstance';

/**
 * FIX (H-05): was throwing `error.response?.data` — a plain object, not an Error.
 * Callers that accessed `err.message` received `undefined` and the error display
 * showed nothing. Now throws a proper Error object, consistent with authService.js.
 */

const extractError = (error, fallback = 'حدث خطأ في الاتصال بالسيرفر') =>
    error.response?.data?.message || fallback;

// يُستدعى عند اختيار "مريض" في صفحة اختيار الدور — ينشئ الملف الطبي الفارغ
export const initPatientProfile = async () => {
    try {
        const { data } = await axiosInstance.post('/patients/init-profile');
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'حدث خطأ أثناء إعداد حسابك'));
    }
};

export const completeMedicalProfile = async (medicalData) => {
    try {
        const { data } = await axiosInstance.put('/patients/complete-medical-profile', medicalData);
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'حدث خطأ أثناء حفظ البيانات الطبية'));
    }
};
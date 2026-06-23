import axiosInstance from '../api/axiosInstance';

/**
 * Auth service layer.
 *
 * Every function returns the response.data object on success
 * and throws an Error with a human-readable Arabic message on failure.
 *
 * Callers never deal with raw axios errors or response shapes.
 */

const extractError = (error, fallback = 'حدث خطأ في الاتصال بالسيرفر') =>
    error.response?.data?.message || fallback;

export const login = async (credentials) => {
    try {
        const { data } = await axiosInstance.post('/auth/login', credentials);
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'فشل تسجيل الدخول'));
    }
};

export const register = async (userData) => {
    try {
        const { data } = await axiosInstance.post('/auth/register', userData);
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'فشل إنشاء الحساب'));
    }
};

export const verifyEmail = async (verificationData) => {
    try {
        const { data } = await axiosInstance.post('/auth/verify-email', verificationData);
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'كود التفعيل غير صحيح'));
    }
};

export const resendCode = async (email) => {
    try {
        const { data } = await axiosInstance.post('/auth/resend-code', { email });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'فشل إعادة إرسال الكود'));
    }
};

export const forgotPassword = async (email) => {
    try {
        const { data } = await axiosInstance.post('/auth/forgot-password', { email });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'فشل إرسال كود إعادة التعيين'));
    }
};

export const verifyResetCode = async (email, code) => {
    try {
        const { data } = await axiosInstance.post('/auth/verify-reset-code', { email, code });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'الكود غير صحيح أو انتهت صلاحيته'));
    }
};

export const resetPassword = async ({ email, code, newPassword }) => {
    try {
        const { data } = await axiosInstance.post('/auth/reset-password', { email, code, newPassword });
        return data;
    } catch (error) {
        throw new Error(extractError(error, 'فشل تغيير كلمة المرور'));
    }
};

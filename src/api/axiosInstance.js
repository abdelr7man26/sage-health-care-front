import axios from 'axios';
import { clearAuthData } from '../context/AuthContext';
import { getMemoryToken, setMemoryToken } from './tokenStore';
import { refreshSession } from './refreshSession';

/**
 * Central Axios instance.
 *
 * On 401:
 *   1. Attempts one silent token refresh via POST /api/auth/refresh.
 *      The browser automatically sends the httpOnly `sage_refresh` cookie.
 *   2. If the refresh succeeds → stores the new access token, retries the
 *      original request transparently (the caller never sees the 401).
 *   3. If the refresh fails (e.g. refresh token expired) → calls clearAuthData()
 *      to reset both localStorage AND React context state, then redirects to login.
 *
 * A queue is used for requests that arrive during an in-flight refresh so they
 * all wait for the single refresh rather than each triggering their own.
 */

const axiosInstance = axios.create({
    baseURL:         import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
    headers:         { 'Content-Type': 'application/json' },
    timeout:         15000,
    withCredentials: true, // Required: sends the httpOnly refresh cookie
});

// ── Request interceptor: attach in-memory access token ────────────────────────
axiosInstance.interceptors.request.use(
    (config) => {
        const token = getMemoryToken();
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    },
    (error) => Promise.reject(error)
);

// ── Refresh token state ────────────────────────────────────────────────────────
let isRefreshing   = false;
let refreshQueue   = []; // Pending requests waiting for the refresh to finish

const processQueue = (error, token = null) => {
    refreshQueue.forEach((prom) => {
        if (error) prom.reject(error);
        else       prom.resolve(token);
    });
    refreshQueue = [];
};

// ── Response interceptor: handle 401 ──────────────────────────────────────────
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Only intercept 401s that haven't already been retried
        if (error.response?.status === 401 && !originalRequest._retry) {
            // Don't refresh for auth endpoints — let the caller handle the error
            const AUTH_SKIP_URLS = ['/auth/refresh', '/auth/login', '/auth/register'];
            if (AUTH_SKIP_URLS.some((u) => originalRequest.url?.includes(u))) {
                if (originalRequest.url?.includes('/auth/refresh')) {
                    clearAuthData();
                    window.location.href = '/login';
                }
                return Promise.reject(error);
            }

            if (isRefreshing) {
                // Another refresh is already in flight — queue this request
                return new Promise((resolve, reject) => {
                    refreshQueue.push({ resolve, reject });
                }).then((newToken) => {
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    return axiosInstance(originalRequest);
                }).catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Shared single-flight refresh — dedupes with AuthContext's mount and
                // proactive refreshes so concurrent triggers collapse into ONE request.
                // (With token rotation, two parallel refreshes would 401 the loser and
                // wrongly log the user out.)
                const data = await refreshSession();
                const newToken = data.token;

                setMemoryToken(newToken);
                axiosInstance.defaults.headers.common.Authorization = `Bearer ${newToken}`;

                processQueue(null, newToken);
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return axiosInstance(originalRequest);

            } catch (refreshError) {
                processQueue(refreshError, null);
                clearAuthData();
                window.location.href = '/login';
                return Promise.reject(refreshError);

            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;

/* eslint-disable react-refresh/only-export-components --
   Context module: intentionally exports the AuthProvider component alongside the
   useAuth hook and AuthContext. Fast-refresh degradation here is acceptable. */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { setMemoryToken, clearMemoryToken } from '../api/tokenStore';
import { refreshSession } from '../api/refreshSession';

/**
 * AuthContext — single source of truth for authentication state.
 *
 * Security (M-12): access token is stored in JavaScript memory only.
 * localStorage no longer holds any token — an XSS script cannot steal it.
 *
 * Session restore: on mount, AuthProvider calls POST /auth/refresh.
 * The browser sends the httpOnly refresh cookie automatically. If it succeeds,
 * the new access token is placed in memory and the user is authenticated.
 * While this check is in flight, `loading` is true — ProtectedRoute waits
 * before redirecting to /login.
 *
 * The user object is still stored in localStorage (name, role, avatar) because
 * it contains no secrets — it is only used for display and is overwritten on
 * every login/refresh.
 */

const AuthContext = createContext(null);

const USER_KEY  = 'sage_user';
const apiBase   = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Module-level clear — safe to call from outside React (e.g. axios interceptor).
 * Dispatches a 'sage:signout' event so the AuthProvider can sync its state.
 */
export const clearAuthData = () => {
    clearMemoryToken();
    localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new Event('sage:signout'));
};

export const AuthProvider = ({ children }) => {
    const [token,   setToken]   = useState(null);
    const [user,    setUser]    = useState(() => {
        try {
            const stored = localStorage.getItem(USER_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });
    // True while we're waiting for the initial /auth/refresh call to resolve.
    // ProtectedRoute renders a spinner instead of redirecting to /login.
    const [loading, setLoading] = useState(true);

    // On mount: restore session from the httpOnly refresh cookie (M-12)
    useEffect(() => {
        refreshSession()
            .then((data) => {
                if (data.token) {
                    setMemoryToken(data.token);
                    setToken(data.token);
                }
                if (data.user) {
                    setUser(data.user);
                    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
                }
            })
            .catch(() => {
                // No valid refresh cookie — user must log in
                clearMemoryToken();
                localStorage.removeItem(USER_KEY);
                setUser(null);
            })
            .finally(() => setLoading(false));
    }, []);

    // Proactive token refresh — fires every 12 minutes to renew the 15-minute access
    // token before it expires (3-minute safety margin). Prevents 401s during active use.
    useEffect(() => {
        if (!token) return;
        const REFRESH_INTERVAL_MS = 12 * 60 * 1000; // 12 minutes
        const id = setInterval(() => {
            refreshSession()
                .then((data) => {
                    if (data.token) {
                        setMemoryToken(data.token);
                        setToken(data.token);
                    }
                })
                .catch(() => {
                    clearAuthData();
                    setToken(null);
                    setUser(null);
                });
        }, REFRESH_INTERVAL_MS);
        return () => clearInterval(id);
    }, [token]);

    // Listen for forced logout triggered by the axios 401 interceptor.
    useEffect(() => {
        const handleForceSignOut = () => {
            setToken(null);
            setUser(null);
        };
        window.addEventListener('sage:signout', handleForceSignOut);
        return () => window.removeEventListener('sage:signout', handleForceSignOut);
    }, []);

    const signIn = useCallback(({ token: newToken, user: newUser }) => {
        setMemoryToken(newToken);          // memory only — no localStorage
        localStorage.setItem(USER_KEY, JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
    }, []);

    const signOut = useCallback(() => {
        axios.post(`${apiBase}/auth/logout`, {}, { withCredentials: true }).catch(() => {});
        clearAuthData();
        setToken(null);
        setUser(null);
    }, []);

    const updateUser = useCallback((partial) => {
        setUser((prev) => {
            const next = { ...prev, ...partial };
            localStorage.setItem(USER_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const isAuthenticated = Boolean(token);

    return (
        <AuthContext.Provider value={{ token, user, isAuthenticated, loading, signIn, signOut, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
};

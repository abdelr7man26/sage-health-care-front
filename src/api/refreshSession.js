import axios from 'axios';

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Shared, deduped refresh promise.
 *
 * Both AuthContext (on page load) and the axios 401 interceptor call this
 * function. If a refresh is already in flight, both callers get the SAME
 * promise and therefore share the single HTTP request. Without this, two
 * concurrent refreshes can each rotate the cookie and cause the second one
 * to fail with 401, logging the user out unexpectedly.
 */
let _inflight = null;

export const refreshSession = () => {
    if (_inflight) return _inflight;

    _inflight = axios
        .post(`${apiBase}/auth/refresh`, {}, { withCredentials: true })
        .then(({ data }) => data)
        .finally(() => { _inflight = null; });

    return _inflight;
};

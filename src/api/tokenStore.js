/**
 * Module-level token store.
 *
 * Stores the access token in JavaScript memory only — never in localStorage
 * or sessionStorage. This eliminates the XSS attack surface where a script
 * injected into the page could steal the token via localStorage.getItem().
 *
 * Trade-off: the token is lost on page refresh. The AuthContext restores it
 * transparently by calling POST /auth/refresh on mount (the httpOnly refresh
 * cookie is sent automatically by the browser).
 */

let _token = null;

export const getMemoryToken   = () => _token;
export const setMemoryToken   = (t) => { _token = t; };
export const clearMemoryToken = () => { _token = null; };

/**
 * timeFormat.js
 *
 * Shared time formatting utility for the entire frontend.
 * All times in the system are stored/transmitted as "HH:MM" (24-hour).
 * This utility converts them to Arabic 12-hour display format: "H:MM ص/م"
 *
 * Examples:
 *   "09:00"  →  "9:00 ص"
 *   "14:30"  →  "2:30 م"
 *   "00:00"  →  "12:00 ص"
 *   "12:00"  →  "12:00 م"
 */

/**
 * Convert a "HH:MM" string to Arabic 12-hour format "H:MM ص/م".
 * Returns the original string unchanged if it is null/undefined/empty
 * or does not match the expected pattern (safe for display fallbacks).
 */
export const fmtTime = (t) => {
    if (!t || typeof t !== 'string') return t || '';
    const match = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return t;
    const h = Number(match[1]);
    const m = match[2];
    const suffix = h >= 12 ? 'م' : 'ص';
    const h12    = (h % 12) || 12;
    return `${h12}:${m} ${suffix}`;
};

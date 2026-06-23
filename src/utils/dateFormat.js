/**
 * dateFormat.js
 *
 * Calendar date / date-time formatting for the Arabic (ar-EG) UI.
 * Complements timeFormat.js, which handles "HH:MM" time-of-day strings.
 *
 *   fmtDate(d)     → date only   (e.g. "١٤ يونيو ٢٠٢٦")
 *   fmtDateTime(d) → date + time (e.g. "١٤ يونيو، ٠٢:٣٠ م")
 *
 * Both accept a Date, an ISO string, or a timestamp, and return "—" for
 * null/undefined so they are safe to drop directly into JSX.
 */

export const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export const fmtDateTime = (d) =>
    d ? new Date(d).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

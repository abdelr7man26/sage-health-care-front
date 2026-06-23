/**
 * Shared notification utilities used by both PatientDashboard and DoctorDashboard.
 * Centralised here so any change (new type, new icon, new colour) only needs
 * to happen in one place.
 */

export const NOTIF_ICON = {
    appointment: { icon: 'calendar_month', bg: 'bg-blue-100',   color: 'text-blue-600'   },
    booking:     { icon: 'event_note',     bg: 'bg-indigo-100', color: 'text-indigo-600' },
    medicine:    { icon: 'medication',     bg: 'bg-purple-100', color: 'text-purple-600' },
    water:       { icon: 'water_drop',     bg: 'bg-cyan-100',   color: 'text-cyan-600'   },
    system:      { icon: 'info',           bg: 'bg-gray-100',   color: 'text-gray-500'   },
};

/**
 * Returns a human-readable relative time string (Arabic).
 * e.g. "الآن", "منذ 5 د", "منذ 2 س", "منذ 3 ي"
 */
export const timeAgo = (date) => {
    const mins = Math.floor((Date.now() - new Date(date)) / 60_000);
    if (mins < 1)  return 'الآن';
    if (mins < 60) return `منذ ${mins} د`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `منذ ${hrs} س`;
    return `منذ ${Math.floor(hrs / 24)} ي`;
};

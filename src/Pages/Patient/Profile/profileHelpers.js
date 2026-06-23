// Pure formatting / parsing helpers for the patient profile page.

export const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

export const getInitials = (name = '') =>
    name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '؟';

// Normalise a comma/Arabic-comma separated string (or array) into a clean array.
export const arrFromStr = (val) =>
    Array.isArray(val) ? val
        : typeof val === 'string' ? val.split(/[،,]/).map((s) => s.trim()).filter(Boolean)
        : [];

// Inverse of arrFromStr — join an array back into a display string.
export const toStr = (val) => (Array.isArray(val) ? val.join('، ') : val || '');

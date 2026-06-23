// Strips /api from the API base so we can build static-asset URLs
// (e.g. SERVER_BASE + "/uploads/profile-pictures/..."). Shared by the dashboard
// container and DoctorCard so the origin is computed in exactly one place.
export const SERVER_BASE = new URL(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').origin;

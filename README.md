# SAGE Healthcare — Frontend

React 18 + Vite 5 single-page application for the SAGE Healthcare Platform.

## Tech Stack

| Category | Library |
|---|---|
| Framework | React 18 |
| Build tool | Vite 5 |
| Styling | Tailwind CSS 4 |
| Routing | React Router v6 |
| Data fetching | TanStack Query v5 |
| HTTP client | Axios |
| Charts | Recharts |
| Animations | Framer Motion |
| Maps | Leaflet + React Leaflet |

## Prerequisites

- Node.js >= 18

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server (proxies API calls to localhost:5000)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

> **Note:** The dev server proxies `/api` requests to the backend at `http://localhost:5000`.
> Make sure the backend is running before using auth or any data features.

## Project Structure

```
src/
├── api/            # Axios instance, token store, session refresh
├── components/     # Shared UI components
├── constants/      # Static data (specialties, etc.)
├── context/        # Auth context (AuthContext)
├── hooks/          # Custom React hooks
├── lib/            # TanStack Query client config
├── Pages/
│   ├── auth/       # Login, Register, RoleSelection, ForgotPassword, VerifyEmail
│   ├── Patient/    # Dashboard, Profile, BookDoctor, DoctorSearch, Appointments, AI Chat
│   ├── Doctor/     # Dashboard, Profile, ScheduleManager, TodayQueue, FollowUps, Analytics
│   └── Admin/      # AdminDashboard + sections (Analytics, Monitoring, Users, Doctors…)
├── Services/       # API service layer (authService, patientService, adminService)
└── utils/          # Date/time formatting, password validation, notification helpers
```

## Roles & Key Pages

### Patient
- Dashboard with nearby doctors and live queue status
- Doctor search and booking
- Appointments management
- AI chat (SAGE AI — powered by Groq / LLaMA 3.3)

### Doctor
- Today's queue with shift controls
- Schedule manager (slots, walk-ins, follow-ups)
- Analytics dashboard (bookings, ratings, revenue)
- Profile management and clinic location picker

### Admin
- Platform overview and user management
- Doctor verification queue
- Analytics (9 sub-tabs: Growth, Economics, Efficiency, Demographics, Demand Gaps, Activity Heatmap, Doctor Health, AI Usage, Secretary Activity)
- System health + ops center (real-time SSE updates)
- Audit logs and error logs

## Environment

The app reads no `.env` variables directly — all config is handled by the Vite proxy and the backend.
Copy `../.env.example` at the repo root and fill in the backend variables to get the full stack running.

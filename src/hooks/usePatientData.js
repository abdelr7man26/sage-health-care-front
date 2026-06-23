import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../api/axiosInstance';
import { queryKeys } from '../lib/queryClient';

/**
 * Patient read hooks (TanStack Query).
 *
 * Each hook wraps one cacheable GET endpoint. Because react-query dedupes by
 * queryKey, multiple components can call the same hook and only ONE network
 * request fires — this is what lets us split the dashboard into many small
 * components without prop-drilling or duplicate fetches.
 *
 * Per-hook staleTime overrides the 60s global default where the data changes
 * faster (bookings, walk-ins) or slower (doctor list) than a minute.
 */

// ── Doctor discovery (rarely changes → longer staleTime) ──────────────────────
export const useDoctors = (params = {}, options = {}) =>
    useQuery({
        queryKey: queryKeys.doctors(params),
        queryFn: async () => {
            const search = new URLSearchParams(params).toString();
            const { data } = await axiosInstance.get(`/patients/doctors${search ? `?${search}` : ''}`);
            return data.data || [];
        },
        staleTime: 5 * 60_000,
        ...options,
    });

export const useDoctor = (id, options = {}) =>
    useQuery({
        queryKey: queryKeys.doctor(id),
        queryFn: async () => {
            const { data } = await axiosInstance.get(`/patients/doctors/${id}`);
            return data.data;
        },
        enabled: !!id,
        staleTime: 2 * 60_000,
        ...options,
    });

// ── Patient profile ───────────────────────────────────────────────────────────
export const useMe = (options = {}) =>
    useQuery({
        queryKey: queryKeys.me,
        queryFn: async () => {
            const { data } = await axiosInstance.get('/patients/me');
            return data.data;
        },
        staleTime: 5 * 60_000,
        ...options,
    });

// ── Bookings / walk-ins / operations / follow-ups (kept fresh via SSE) ────────
export const useMyBookings = (params = { upcoming: true, limit: 10 }, options = {}) =>
    useQuery({
        queryKey: queryKeys.myBookings(params),
        queryFn: async () => {
            const search = new URLSearchParams(params).toString();
            const { data } = await axiosInstance.get(`/patients/my-bookings${search ? `?${search}` : ''}`);
            return data.data || [];
        },
        staleTime: 30_000,
        ...options,
    });

export const useMyWalkIns = (options = {}) =>
    useQuery({
        queryKey: queryKeys.myWalkIns,
        queryFn: async () => {
            const { data } = await axiosInstance.get('/patients/my-walkins');
            return data.data || [];
        },
        staleTime: 30_000,
        ...options,
    });

export const useMyOperations = (options = {}) =>
    useQuery({
        queryKey: queryKeys.myOperations,
        queryFn: async () => {
            const { data } = await axiosInstance.get('/patients/my-operations');
            return data.data || [];
        },
        ...options,
    });

export const useMyFollowUps = (options = {}) =>
    useQuery({
        queryKey: queryKeys.myFollowUps,
        queryFn: async () => {
            const { data } = await axiosInstance.get('/patients/my-follow-ups');
            return data.data || [];
        },
        ...options,
    });

// ── Notifications ─────────────────────────────────────────────────────────────
export const useNotifications = (options = {}) =>
    useQuery({
        queryKey: queryKeys.notifications,
        queryFn: async () => {
            const { data } = await axiosInstance.get('/patients/notifications');
            return data.data || [];
        },
        staleTime: 30_000,
        ...options,
    });

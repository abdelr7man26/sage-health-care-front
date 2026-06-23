import { QueryClient } from '@tanstack/react-query';

/**
 * Shared QueryClient — exported as a module singleton so non-React code
 * (e.g. the SSE event handlers in PatientDashboard) can call
 * `queryClient.invalidateQueries(...)` to push a server-driven refresh into
 * the cache without prop-drilling the client through the component tree.
 *
 * Defaults rationale:
 *   - staleTime 60s: a fetched value is considered "fresh" for a minute, so
 *     navigating away and back within that window serves instantly from cache
 *     with NO network request. Freshness beyond that is driven by SSE
 *     invalidation, not by polling.
 *   - gcTime 5m: keep unused data in memory for 5 minutes so quick back-and-forth
 *     navigation stays instant.
 *   - refetchOnWindowFocus false: we rely on SSE for real-time freshness, so we
 *     don't want a refetch storm every time the tab regains focus.
 *   - retry 1: one silent retry on transient failure; the axios interceptor
 *     already handles 401 refresh.
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime:            60_000,
            gcTime:               5 * 60_000,
            retry:                1,
            refetchOnWindowFocus: false,
        },
    },
});

/**
 * Centralised query keys — single source of truth so producers (hooks) and
 * consumers (SSE invalidation) never drift on the key shape.
 */
export const queryKeys = {
    me:           ['patient', 'me'],
    doctors:      (params = {}) => ['doctors', params],
    doctor:       (id)          => ['doctor', id],
    myBookings:   (params = {}) => ['my-bookings', params],
    myWalkIns:    ['my-walkins'],
    myOperations: ['my-operations'],
    myFollowUps:  ['my-follow-ups'],
    notifications:['notifications'],
};

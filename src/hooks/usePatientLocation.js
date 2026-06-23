/**
 * usePatientLocation.js
 *
 * React hook that shares the patient's GPS location with the server
 * periodically so the queue engine can compute accurate travel times.
 *
 * Works for both online bookings and walk-ins (registered patients only).
 *
 * Behaviour:
 *   - Calls navigator.geolocation.watchPosition to track the patient's location.
 *   - Every UPDATE_INTERVAL_MS (3 minutes by default), PATCHes the current
 *     coordinates to the appropriate endpoint:
 *       • Booking  → PATCH /bookings/:bookingId/location
 *       • Walk-in  → PATCH /patients/my-walkins/:walkInId/location
 *   - The server responds with { travelTimeMinutes, patientIsEnRoute } which
 *     is returned from the hook so the UI can display it.
 *   - Stops tracking automatically when the component unmounts.
 *   - Does nothing if geolocation is not supported or the user denies permission.
 *
 * Usage:
 *   const { travelTimeMinutes, isEnRoute, error } = usePatientLocation({
 *     bookingId,  // booking ID  (booking mode)
 *     walkInId,   // walk-in ID  (walk-in mode)
 *     slotDate,   // ISO string or Date — only activates for bookings when today
 *     enabled,    // boolean — parent can disable
 *   });
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import axiosInstance from '../api/axiosInstance';

const UPDATE_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

const isToday = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const t = new Date();
    return (
        d.getFullYear() === t.getFullYear() &&
        d.getMonth()    === t.getMonth()    &&
        d.getDate()     === t.getDate()
    );
};

export default function usePatientLocation({
    bookingId,
    walkInId,
    slotDate,
    enabled  = true,
}) {
    const [travelTimeMinutes, setTravelTimeMinutes] = useState(null);
    const [isEnRoute,         setIsEnRoute]         = useState(false);
    const [permissionError,   setPermissionError]   = useState(false);

    const lastPositionRef = useRef(null);
    const timerRef        = useRef(null);
    const watchIdRef      = useRef(null);

    // Walk-ins are always today; bookings require explicit date check
    const shouldActivate =
        enabled &&
        (!!walkInId || (!!bookingId && isToday(slotDate))) &&
        typeof navigator !== 'undefined' &&
        'geolocation' in navigator;

    const endpoint = walkInId
        ? `/patients/my-walkins/${walkInId}/location`
        : `/bookings/${bookingId}/location`;

    const sendLocation = useCallback(async (lat, lon) => {
        try {
            const res = await axiosInstance.patch(endpoint, { lat, lon });
            if (res.data.success) {
                setTravelTimeMinutes(res.data.travelTimeMinutes ?? null);
                setIsEnRoute(!!res.data.patientIsEnRoute);
            }
        } catch {
            // Fail silently — location updates are best-effort
        }
    }, [endpoint]);

    useEffect(() => {
        if (!shouldActivate) return;

        const onPosition = (pos) => {
            const { latitude: lat, longitude: lon } = pos.coords;
            lastPositionRef.current = { lat, lon };
        };

        const onError = (err) => {
            if (err.code === err.PERMISSION_DENIED) {
                setPermissionError(true);
            }
        };

        // Start watching position
        watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onError, {
            enableHighAccuracy: false,
            timeout:            10_000,
            maximumAge:         60_000,
        });

        // Send location on first available reading, then every UPDATE_INTERVAL_MS
        const tick = async () => {
            if (lastPositionRef.current) {
                await sendLocation(lastPositionRef.current.lat, lastPositionRef.current.lon);
            }
        };

        // First send after a short delay (give watchPosition time to get a fix)
        const firstTimer = setTimeout(tick, 5_000);
        timerRef.current = setInterval(tick, UPDATE_INTERVAL_MS);

        return () => {
            clearTimeout(firstTimer);
            clearInterval(timerRef.current);
            if (watchIdRef.current != null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, [shouldActivate, sendLocation]);

    return { travelTimeMinutes, isEnRoute, permissionError };
}

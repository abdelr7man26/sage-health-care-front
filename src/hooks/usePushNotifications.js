import { useEffect, useRef, useState } from 'react';
import axiosInstance from '../api/axiosInstance';

const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw     = atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
};

/**
 * Returns { permissionBlocked: bool }
 * permissionBlocked = true  → browser has notifications blocked; show UI hint
 * permissionBlocked = false → all good (or not yet determined)
 */
export const usePushNotifications = (isLoggedIn) => {
    const running = useRef(false);
    const [permissionBlocked, setPermissionBlocked] = useState(false);

    useEffect(() => {
        if (!isLoggedIn || running.current) return;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        // If permission already denied, surface it immediately — no point trying
        if (Notification.permission === 'denied') {
            setPermissionBlocked(true);
            return;
        }

        running.current = true;

        const register = async () => {
            try {
                const { data } = await axiosInstance.get('/notifications/vapid-public-key');
                const vapidKey = data.publicKey;
                if (!vapidKey) throw new Error('VAPID key missing');

                const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
                await navigator.serviceWorker.ready;

                let subscription = await reg.pushManager.getSubscription();

                if (subscription) {
                    const savedEndpoint = localStorage.getItem('push_endpoint');
                    if (savedEndpoint === subscription.endpoint) return; // already synced
                } else {
                    const permission = await Notification.requestPermission();
                    if (permission !== 'granted') {
                        setPermissionBlocked(true);
                        return;
                    }
                    subscription = await reg.pushManager.subscribe({
                        userVisibleOnly:      true,
                        applicationServerKey: urlBase64ToUint8Array(vapidKey),
                    });
                }

                await axiosInstance.post('/notifications/subscribe', { subscription });
                localStorage.setItem('push_endpoint', subscription.endpoint);
                setPermissionBlocked(false);

            } catch (err) {
                localStorage.removeItem('push_endpoint');
                console.warn('[Push] Registration failed:', err.message);
            }
        };

        register();
    }, [isLoggedIn]);

    return { permissionBlocked };
};

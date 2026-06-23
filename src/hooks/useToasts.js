import { useState, useCallback } from 'react';

/**
 * useToasts
 *
 * Lightweight toast-notification state. Returns the active toast list plus
 * `show(msg, type)` and `dismiss(id)` helpers. Each toast auto-dismisses after
 * 5 seconds. Pair with a renderer (e.g. the admin <ToastStack />) that maps
 * over `toasts` and calls `dismiss` on close.
 *
 *   type: 'success' (default) | 'error' | 'warning'
 */
export const useToasts = () => {
    const [toasts, setToasts] = useState([]);
    const show = useCallback((msg, type = 'success') => {
        const id = Date.now();
        setToasts((p) => [...p, { id, msg, type }]);
        setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 5000);
    }, []);
    const dismiss = useCallback((id) => setToasts((p) => p.filter((t) => t.id !== id)), []);
    return { toasts, show, dismiss };
};

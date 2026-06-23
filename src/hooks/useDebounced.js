import { useState, useEffect } from 'react';

/**
 * useDebounced
 *
 * Returns a debounced copy of `value` that only updates after `delay` ms of
 * no changes — useful for live search inputs so a request fires once the user
 * stops typing rather than on every keystroke.
 */
export const useDebounced = (value, delay = 400) => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
};

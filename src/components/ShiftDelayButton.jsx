/**
 * ShiftDelayButton.jsx
 *
 * Lets the doctor / secretary signal that the clinic is running late.
 * Sends POST /bookings/shift-delay with the chosen delay in minutes.
 * All confirmed patients for today receive a live SSE queue-shift update
 * automatically (handled server-side by broadcastQueueShift).
 *
 * Persists the active delay in localStorage so the countdown survives page refreshes.
 *
 * Usage (inside TodayQueue header):
 *   <ShiftDelayButton currentDelay={shiftDelay} onShifted={handleShifted} />
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import axiosInstance from '../api/axiosInstance';

const PRESETS = [15, 30, 45, 60, 90];
const STORAGE_KEY = 'clinic_shift_delay';

function readStored() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (Date.now() >= parsed.expiresAt) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

function fmtCountdown(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ShiftDelayButton({ onShifted }) {
    const [open,      setOpen]      = useState(false);
    const [minutes,   setMinutes]   = useState(30);
    const [loading,   setLoading]   = useState(false);
    const [success,   setSuccess]   = useState(false);
    const [error,     setError]     = useState('');
    const [remaining, setRemaining] = useState(() => {
        const stored = readStored();
        return stored ? Math.max(0, Math.floor((stored.expiresAt - Date.now()) / 1000)) : 0;
    });

    const intervalRef  = useRef(null);
    const onShiftedRef = useRef(onShifted);
    useEffect(() => { onShiftedRef.current = onShifted; }, [onShifted]);

    const startCountdown = useCallback((seconds) => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setRemaining(seconds);
        intervalRef.current = setInterval(() => {
            setRemaining(prev => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                    localStorage.removeItem(STORAGE_KEY);
                    onShiftedRef.current?.(0);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    // On mount: restore delay from localStorage, notify parent, start countdown
    useEffect(() => {
        const stored = readStored();
        if (stored) {
            const secs = Math.max(0, Math.floor((stored.expiresAt - Date.now()) / 1000));
            if (secs > 0) {
                onShiftedRef.current?.(stored.delayMinutes);
                startCountdown(secs);
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async () => {
        setLoading(true);
        setError('');
        try {
            const mins = Number(minutes);
            const res = await axiosInstance.post('/bookings/shift-delay', { delayMinutes: mins });
            if (res.data.success) {
                const expiresAt = Date.now() + mins * 60_000;
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ delayMinutes: mins, expiresAt }));
                startCountdown(mins * 60);
                setSuccess(true);
                onShifted?.(mins);
                setTimeout(() => {
                    setSuccess(false);
                    setOpen(false);
                }, 2000);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'فشل إرسال الترحيل');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async () => {
        setLoading(true);
        setError('');
        try {
            await axiosInstance.post('/bookings/shift-delay', { delayMinutes: 0 });
            localStorage.removeItem(STORAGE_KEY);
            if (intervalRef.current) clearInterval(intervalRef.current);
            setRemaining(0);
            onShifted?.(0);
            setOpen(false);
        } catch (err) {
            setError(err.response?.data?.message || 'فشل إعادة الضبط');
        } finally {
            setLoading(false);
        }
    };

    const isActive = remaining > 0;

    return (
        <div className="relative">
            {/* Trigger button */}
            <button
                onClick={() => setOpen(o => !o)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all ${
                    isActive
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
            >
                <span>⏰</span>
                <span>
                    {isActive
                        ? `تأخير ${fmtCountdown(remaining)}`
                        : 'ترحيل العيادة'}
                </span>
            </button>

            {/* Dropdown panel */}
            {open && (
                <div
                    dir="rtl"
                    className="absolute top-full mt-2 left-0 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4"
                    style={{ minWidth: 280 }}
                >
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-gray-800 text-sm">ترحيل موعد بدء العيادة</h3>
                        <button
                            onClick={() => setOpen(false)}
                            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                        >✕</button>
                    </div>

                    <p className="text-xs text-gray-500 mb-3">
                        سيتم إعادة حساب الوقت المتوقع لجميع المرضى تلقائياً وإرسال تنبيه للمرضى في الطريق.
                    </p>

                    {/* Preset chips */}
                    <div className="flex flex-wrap gap-2 mb-3">
                        {PRESETS.map(p => (
                            <button
                                key={p}
                                onClick={() => setMinutes(p)}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                                    minutes === p
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-amber-50'
                                }`}
                            >
                                {p} د
                            </button>
                        ))}
                    </div>

                    {/* Custom input */}
                    <div className="flex items-center gap-2 mb-4">
                        <input
                            type="number"
                            min={0}
                            max={480}
                            value={minutes}
                            onChange={e => setMinutes(e.target.value)}
                            className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <span className="text-sm text-gray-500">دقيقة</span>
                    </div>

                    {error && (
                        <p className="text-xs text-red-500 mb-2 bg-red-50 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}

                    {success && (
                        <p className="text-xs text-emerald-600 mb-2 bg-emerald-50 rounded-lg px-3 py-2 font-bold">
                            ✅ تم الترحيل وإرسال التحديثات للمرضى
                        </p>
                    )}

                    <div className="flex gap-2">
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-xl text-sm transition-all disabled:opacity-50"
                        >
                            {loading ? '...' : 'تطبيق الترحيل'}
                        </button>
                        {isActive && (
                            <button
                                onClick={handleReset}
                                disabled={loading}
                                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-sm transition-all"
                                title="إعادة الضبط"
                            >
                                ↺
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

import { useRef } from 'react';

/**
 * OtpInput
 *
 * Reusable 6-box OTP input component extracted from VerifyEmail and ForgotPassword,
 * where the same logic was duplicated verbatim (DRY violation).
 *
 * Fixes included:
 * - Backspace moves focus to the previous box (the original code didn't handle this,
 *   making it very hard to correct a mistyped digit).
 * - Paste support: pasting a 6-digit code fills all boxes automatically.
 * - Only numeric characters accepted.
 *
 * Props:
 *   value    — string[] of length `length`, e.g. ['','','1','','','']
 *   onChange — (newValue: string[]) => void
 *   length   — number of boxes (default 6)
 *   disabled — boolean
 */
const OtpInput = ({ value, onChange, length = 6, disabled = false }) => {
    const inputRefs = useRef([]);

    const handleChange = (e, index) => {
        const char = e.target.value.replace(/\D/g, '').slice(-1); // digits only, last char
        const next = [...value];
        next[index] = char;
        onChange(next);
        if (char && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace') {
            if (value[index]) {
                // Clear current box
                const next = [...value];
                next[index] = '';
                onChange(next);
            } else if (index > 0) {
                // Move to previous box and clear it
                inputRefs.current[index - 1]?.focus();
                const next = [...value];
                next[index - 1] = '';
                onChange(next);
            }
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
        if (!pasted) return;
        const next = Array(length).fill('');
        pasted.split('').forEach((char, i) => { next[i] = char; });
        onChange(next);
        // Focus last filled box
        const lastIndex = Math.min(pasted.length, length - 1);
        inputRefs.current[lastIndex]?.focus();
    };

    return (
        <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {value.map((digit, index) => (
                <input
                    key={index}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    disabled={disabled}
                    ref={(el) => (inputRefs.current[index] = el)}
                    value={digit}
                    onChange={(e) => handleChange(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    onFocus={(e) => e.target.select()}
                    className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-200 rounded-lg focus:border-[#2d6a4f] outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
            ))}
        </div>
    );
};
export default OtpInput;
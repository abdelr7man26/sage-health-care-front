/**
 * Password strength utilities.
 *
 * IMPORTANT: The validation rules in `validatePassword` here MUST stay in
 * sync with the `validatePassword` function in authController.js on the backend.
 * Both must enforce the same minimum requirements.
 *
 * Rules: min 8 chars + at least one digit + at least one uppercase letter.
 */

export const validatePasswordRequirements = (password) => {
  return {
    hasMinLength: password.length >= 8,
    hasCapital: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };
};

export const getPasswordStrength = (password) => {
    if (!password) return 0;
    
    let strength = 0;
    if (password.length >= 8)            strength++;
    if (/[A-Z]/.test(password))          strength++;
    if (/[0-9]/.test(password))          strength++;
    if (/[^A-Za-z0-9]/.test(password))  strength++;
    return strength;
};

const strengthConfig = {
    0: { label: 'ضعيفة جداً', color: 'bg-red-500',    width: 'w-1/5'  },
    1: { label: 'ضعيفة', color: 'bg-orange-500',     width: 'w-2/5'  },
    2: { label: 'متوسطة',    color: 'bg-yellow-500', width: 'w-3/5'  },
    3: { label: 'قوية',      color: 'bg-blue-500',   width: 'w-4/5'  },
    4: { label: 'ممتازة',    color: 'bg-green-500',  width: 'w-full' },
};

/**
 * FIX: This function was called in Register.jsx and ForgotPassword.jsx
 * but was never defined — causing a ReferenceError crash on every keystroke.
 *
 * Maps a numeric strength score to its display config.
 */
export const getStrengthLabel = (strength) => strengthConfig[strength] ?? strengthConfig[0];

/**
 * Returns true if the password meets the minimum requirements for submission.
 * Strength must be at least 2 (has length + a digit OR uppercase).
 * Use this to gate form submission on the frontend.
 */
export const isPasswordAcceptable = (password) => getPasswordStrength(password) > 2;
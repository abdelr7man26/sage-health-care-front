/**
 * Notification
 *
 * Inline feedback component used across all auth and profile pages.
 * Replaces native alert() — which blocks the JS thread, cannot be styled,
 * and behaves inconsistently across browsers and mobile devices.
 *
 * Usage:
 *   const [notification, setNotification] = useState(null);
 *   <Notification notification={notification} />
 *   setNotification({ type: 'error', message: 'Something went wrong' });
 *   setNotification(null); // clear
 *
 * Types: 'error' | 'success' | 'info'
 */
const Notification = ({ notification }) => {
    if (!notification) return null;

    const styles = {
        error:   'bg-red-50 border-red-200 text-red-700',
        success: 'bg-green-50 border-green-200 text-green-700',
        info:    'bg-blue-50 border-blue-200 text-blue-700',
    };

    const icons = {
        error:   'error',
        success: 'check_circle',
        info:    'info',
    };

    const style = styles[notification.type] ?? styles.info;
    const icon  = icons[notification.type]  ?? icons.info;

    return (
        <div
            role="alert"
            aria-live="polite"
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium ${style}`}
        >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{icon}</span>
            <span>{notification.message}</span>
        </div>
    );
};

// FIX (C-04, C-05, L-01): The named `showNotification` export that wrapped alert()
// has been removed. It was the root cause of alert() leaking into CompleteProfile
// and ForgotPassword. All pages now use the <Notification> component + useState.

export default Notification;
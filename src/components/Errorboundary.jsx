import { Component } from 'react';

/**
 * ErrorBoundary
 *
 * Catches any unhandled React rendering error and shows a graceful fallback
 * instead of a completely white/broken screen.
 *
 * Wrap the entire app (in main.jsx) and optionally individual page sections.
 */
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        // In production, send to an error tracking service (e.g. Sentry)
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-[#e4efe9] flex items-center justify-center p-6 font-['Poppins']">
                    <div className="bg-white rounded-[24px] shadow-2xl p-10 max-w-md w-full text-center">
                        <span className="material-symbols-outlined text-[48px] text-red-400 mb-4 block">error</span>
                        <h1 className="text-xl font-bold text-[#191c1c] mb-2">حدث خطأ غير متوقع</h1>
                        <p className="text-gray-500 text-sm mb-6">
                            عذراً، حدث خطأ في التطبيق. يرجى إعادة تحميل الصفحة أو المحاولة لاحقاً.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-[#134e3a] text-white px-6 py-3 rounded-[12px] font-bold"
                        >
                            إعادة تحميل الصفحة
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
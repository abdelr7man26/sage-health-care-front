// Loading placeholders for the dashboard while data is being fetched.

export function SkeletonCard() {
    return (
        <div className="animate-pulse bg-white/50 rounded-2xl p-6 border border-gray-100 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-gray-200 mx-auto" />
            <div className="h-3 bg-gray-200 rounded w-3/4 mx-auto" />
            <div className="h-2.5 bg-gray-100 rounded w-1/2 mx-auto" />
            <div className="h-2.5 bg-gray-100 rounded w-2/3 mx-auto" />
            <div className="h-9 bg-gray-200 rounded-xl mt-2" />
        </div>
    );
}

export function ReminderSkeleton() {
    return (
        <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
    );
}

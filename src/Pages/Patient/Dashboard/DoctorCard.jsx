import { memo } from 'react';
import StarRating from './StarRating';
import { SERVER_BASE } from './serverBase';

// Single doctor card in the dashboard's "featured doctors" grid.
// Wrapped in React.memo: the dashboard re-renders every 60s (minute ticker) and
// on every cache update, but a card only re-renders when its own `doctor` prop
// changes — and react-query hands back stable object references within staleTime,
// so the (potentially long) grid stays cheap on those re-renders.
function DoctorCard({ doctor, navigate }) {
    const initials = doctor.user?.name
        ? doctor.user.name
              .split(' ')
              .map((w) => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
        : 'DR';

    return (
        <div className="group bg-white/[.07] rounded-2xl border border-white/[.1] p-5 hover:bg-white/[.11] hover:-translate-y-1 transition-all duration-200 flex flex-col">
            {/* Avatar */}
            <div className="flex flex-col items-center text-center mb-4">
                {doctor.user?.profilePicture ? (
                    <img
                        src={`${SERVER_BASE}${doctor.user.profilePicture}`}
                        alt={doctor.user.name}
                        loading="lazy"
                        className="w-16 h-16 rounded-2xl object-cover shadow-md mb-3 group-hover:scale-105 transition-transform duration-200"
                    />
                ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#134e3a] to-[#2d6a4f] flex items-center justify-center text-white font-black text-xl shadow-md mb-3 group-hover:scale-105 transition-transform duration-200">
                        {initials}
                    </div>
                )}
                <h3 className="font-bold text-white text-sm leading-snug">د. {doctor.user?.name}</h3>
                <p className="text-white/55 text-xs mt-0.5 font-medium">{doctor.specialization}</p>
                <p className="text-white/35 text-xs">{doctor.degree}</p>
            </div>

            {/* Rating */}
            <div className="flex items-center justify-center mb-2">
                <StarRating rating={doctor.rating} />
                <span className="text-xs text-gray-400 ml-1">({doctor.numReviews || 0})</span>
            </div>

            {/* Location */}
            {doctor.address?.city && (
                <div className="flex items-center justify-center gap-1 mb-3 text-xs text-white/40">
                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                    {doctor.address.city}
                    {doctor.address.area ? `، ${doctor.address.area}` : ''}
                </div>
            )}

            {/* Fee */}
            <div className="flex items-center justify-center gap-1.5 mb-4 bg-emerald-900/40 rounded-xl py-2 mt-auto">
                <span className="material-symbols-outlined text-emerald-400 text-[15px]">payments</span>
                <span className="text-emerald-400 font-bold text-sm">{doctor.consultationFee} جنيه</span>
            </div>

            {/* Book Button */}
            <button
                onClick={() => navigate(`/book/${doctor._id}`)}
                className="w-full bg-[#134e3a] hover:bg-[#0c3326] text-white py-2.5 rounded-xl font-bold text-sm transition-all hover:shadow-md active:scale-95"
            >
                احجز الآن
            </button>
        </div>
    );
}

export default memo(DoctorCard);

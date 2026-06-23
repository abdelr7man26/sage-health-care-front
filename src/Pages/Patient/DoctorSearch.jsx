import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PatientHeader from '../../components/PatientHeader';
import axiosInstance from '../../api/axiosInstance';
import Footer from '../../components/Footer';
import { SPECIALTY_FILTER_OPTIONS as SPECIALTIES } from '../../constants/specialties';
import { useDoctors } from '../../hooks/usePatientData';

const SERVER_BASE = new URL(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').origin;

const EGYPTIAN_CITIES = [
    'القاهرة','الجيزة','الإسكندرية','الدقهلية','البحيرة','الشرقية',
    'المنوفية','القليوبية','الغربية','كفر الشيخ','دمياط','بورسعيد',
    'الإسماعيلية','السويس','الفيوم','بني سويف','المنيا','أسيوط',
    'سوهاج','قنا','الأقصر','أسوان',
];

const DEGREE_OPTIONS = [
    { value: '', label: 'كل الدرجات' },
    { value: 'بكالوريوس', label: 'بكالوريوس' },
    { value: 'ماجستير', label: 'ماجستير' },
    { value: 'دكتوراه', label: 'دكتوراه' },
    { value: 'دبلوم', label: 'دبلوم' },
    { value: 'زمالة', label: 'زمالة' },
    { value: 'استشاري', label: 'استشاري' },
];

const FEE_RANGES = [
    { value: '',     label: 'أي سعر',           max: Infinity },
    { value: '200',  label: 'أقل من 200 جنيه',   max: 200      },
    { value: '500',  label: 'أقل من 500 جنيه',   max: 500      },
    { value: '1000', label: 'أقل من 1000 جنيه',  max: 1000     },
];

const RATING_OPTS = [
    { value: 0, label: 'أي تقييم',  stars: 0 },
    { value: 3, label: '3+',         stars: 3 },
    { value: 4, label: '4+',         stars: 4 },
    { value: 4.5, label: '4.5+',     stars: 4.5 },
];

const GENDER_OPTIONS = [
    { value: '', label: 'الجنسان' },
    { value: 'male', label: 'رجال فقط' },
    { value: 'female', label: 'نساء فقط' },
];

const SORT_OPTIONS = [
    { value: 'default',  label: 'الافتراضي'      },
    { value: 'rating',   label: 'الأعلى تقييماً' },
    { value: 'fee_asc',  label: 'الأرخص أولاً'   },
    { value: 'fee_desc', label: 'الأغلى أولاً'   },
];

// ── Star display ───────────────────────────────────────────────────────────────
function StarRating({ rating = 0 }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1,2,3,4,5].map((i) => (
                <svg key={i} className={`w-3 h-3 ${i <= Math.round(rating) ? 'text-amber-400' : 'text-white/20'}`}
                    fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
            ))}
        </div>
    );
}

// ── Latest reviews horizontal strip ───────────────────────────────────────────
// eslint-disable-next-line no-unused-vars -- built component kept for future wiring
function ReviewsStrip() {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const scrollRef             = useRef(null);

    useEffect(() => {
        axiosInstance.get('/reviews/latest?limit=12')
            .then((r) => setReviews(r.data.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const scroll = (dir) => {
        scrollRef.current?.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
    };

    if (!loading && reviews.length === 0) return null;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-400 text-[18px]">star</span>
                    <h2 className="font-black text-white text-sm">آراء المرضى</h2>
                    {!loading && (
                        <span className="text-[11px] text-white/30 bg-white/[.06] px-2 py-0.5 rounded-full">
                            {reviews.length} تقييم
                        </span>
                    )}
                </div>
                <div className="flex gap-1">
                    <button onClick={() => scroll('left')}
                        className="w-7 h-7 rounded-lg bg-white/[.07] border border-white/[.1] flex items-center justify-center text-white/50 hover:bg-white/[.12] hover:text-white transition-all">
                        <span className="material-symbols-outlined text-[15px]">chevron_right</span>
                    </button>
                    <button onClick={() => scroll('right')}
                        className="w-7 h-7 rounded-lg bg-white/[.07] border border-white/[.1] flex items-center justify-center text-white/50 hover:bg-white/[.12] hover:text-white transition-all">
                        <span className="material-symbols-outlined text-[15px]">chevron_left</span>
                    </button>
                </div>
            </div>
            <div ref={scrollRef} className="flex gap-3 overflow-x-auto scrollbar-hide pb-1" style={{ scrollSnapType: 'x mandatory' }}>
                {loading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="animate-pulse shrink-0 w-60 bg-white/[.06] rounded-2xl border border-white/[.08] p-4 space-y-2.5" style={{ scrollSnapAlign: 'start' }}>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-white/15 shrink-0"/>
                                <div className="space-y-1.5 flex-1">
                                    <div className="h-2.5 bg-white/15 rounded w-3/4"/>
                                    <div className="h-2 bg-white/10 rounded w-1/2"/>
                                </div>
                            </div>
                            <div className="h-2 bg-white/10 rounded w-1/3"/>
                            <div className="space-y-1.5">
                                <div className="h-2 bg-white/[.08] rounded"/>
                                <div className="h-2 bg-white/[.08] rounded w-4/5"/>
                            </div>
                        </div>
                    ))
                    : reviews.map((rev) => {
                        const name     = rev.patient?.name || 'مريض';
                        const initials = name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
                        const dateStr  = new Date(rev.createdAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
                        return (
                            <div key={rev._id}
                                className="shrink-0 w-60 bg-white/[.07] border border-white/[.1] rounded-2xl p-4 flex flex-col gap-2.5 hover:bg-white/[.1] transition-colors"
                                style={{ scrollSnapAlign: 'start' }}>
                                <div className="flex items-center gap-2.5">
                                    {rev.patient?.profilePicture
                                        ? <img src={`${SERVER_BASE}${rev.patient.profilePicture}`} alt={name} className="w-8 h-8 rounded-xl object-cover shrink-0"/>
                                        : <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1a6b4e] to-[#2d6a4f] flex items-center justify-center text-white font-black text-[10px] shrink-0">{initials}</div>
                                    }
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-white/85 truncate">{name}</p>
                                        {rev.doctor?.name && <p className="text-[10px] text-white/35 truncate">د. {rev.doctor.name}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <StarRating rating={rev.rating}/>
                                    <span className="text-[10px] text-white/25">{dateStr}</span>
                                </div>
                                {rev.comment && <p className="text-[11px] text-white/55 leading-relaxed line-clamp-3">{rev.comment}</p>}
                            </div>
                        );
                    })
                }
            </div>
        </div>
    );
}

// ── Filter sidebar ─────────────────────────────────────────────────────────────
function FilterSection({ title, icon, children, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-white/[.07] last:border-0 pb-4 last:pb-0">
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex items-center justify-between w-full py-1 mb-3 group"
            >
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-emerald-400/70">{icon}</span>
                    <span className="text-xs font-black text-white/70 group-hover:text-white transition-colors">{title}</span>
                </div>
                <span className={`material-symbols-outlined text-[16px] text-white/30 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}>
                    expand_more
                </span>
            </button>
            {open && children}
        </div>
    );
}

function FilterSidebar({ filters, onChange, onReset, activeCount }) {
    return (
        <aside className="bg-white/[.06] border border-white/[.1] rounded-2xl p-4 space-y-4 h-fit">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[17px] text-emerald-400">tune</span>
                    <span className="font-black text-white text-sm">الفلاتر</span>
                    {activeCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center">
                            {activeCount}
                        </span>
                    )}
                </div>
                {activeCount > 0 && (
                    <button onClick={onReset}
                        className="text-[11px] text-red-400/70 hover:text-red-300 font-bold transition-colors flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[13px]">refresh</span>
                        إعادة ضبط
                    </button>
                )}
            </div>

            <div className="space-y-4">
                {/* Degree */}
                <FilterSection title="الدرجة العلمية" icon="school">
                    <div className="space-y-1.5">
                        {DEGREE_OPTIONS.map((opt) => (
                            <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group">
                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                    filters.degree === opt.value
                                        ? 'bg-emerald-500 border-emerald-500'
                                        : 'border-white/20 bg-white/[.05] group-hover:border-emerald-400/40'
                                }`}
                                    onClick={() => onChange('degree', opt.value)}>
                                    {filters.degree === opt.value && (
                                        <span className="material-symbols-outlined text-[11px] text-white">check</span>
                                    )}
                                </div>
                                <span className="text-xs text-white/60 group-hover:text-white/90 transition-colors">{opt.label}</span>
                            </label>
                        ))}
                    </div>
                </FilterSection>

                {/* Gender */}
                <FilterSection title="جنس الطبيب" icon="person">
                    <div className="grid grid-cols-3 gap-1.5">
                        {GENDER_OPTIONS.map((opt) => (
                            <button key={opt.value} onClick={() => onChange('gender', opt.value)}
                                className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all text-center ${
                                    filters.gender === opt.value
                                        ? 'bg-emerald-700/60 text-white border-emerald-500/50'
                                        : 'bg-white/[.05] text-white/50 border-white/[.1] hover:bg-white/[.1] hover:text-white'
                                }`}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </FilterSection>

                {/* Fee range */}
                <FilterSection title="نطاق السعر" icon="payments">
                    <div className="space-y-1.5">
                        {FEE_RANGES.map((opt) => (
                            <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group">
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                                    filters.feeRange === opt.value
                                        ? 'border-emerald-500 bg-emerald-500'
                                        : 'border-white/20 bg-white/[.05] group-hover:border-emerald-400/40'
                                }`}
                                    onClick={() => onChange('feeRange', opt.value)}>
                                    {filters.feeRange === opt.value && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-white block"/>
                                    )}
                                </div>
                                <span className="text-xs text-white/60 group-hover:text-white/90 transition-colors">{opt.label}</span>
                            </label>
                        ))}
                    </div>
                </FilterSection>

                {/* Min rating */}
                <FilterSection title="الحد الأدنى للتقييم" icon="star" defaultOpen={false}>
                    <div className="space-y-1.5">
                        {RATING_OPTS.map((opt) => (
                            <button key={opt.value} onClick={() => onChange('minRating', opt.value)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs transition-all ${
                                    filters.minRating === opt.value
                                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                        : 'bg-white/[.04] border-white/[.08] text-white/50 hover:bg-white/[.09] hover:text-white'
                                }`}>
                                {opt.stars > 0 ? (
                                    <div className="flex items-center gap-0.5">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <svg key={i} className={`w-3 h-3 ${i < opt.stars ? 'text-amber-400' : 'text-white/20'}`}
                                                fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                                            </svg>
                                        ))}
                                        <span className="mr-1">{opt.label}</span>
                                    </div>
                                ) : (
                                    <span>{opt.label}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </FilterSection>
            </div>
        </aside>
    );
}

// ── Skeleton card ──────────────────────────────────────────────────────────────
function SkeletonCard() {
    return (
        <div className="animate-pulse bg-white/[.07] rounded-2xl p-4 border border-white/[.1] space-y-3">
            <div className="flex items-start gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-white/15 shrink-0"/>
                <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3.5 bg-white/15 rounded w-3/5"/>
                    <div className="h-2.5 bg-white/10 rounded w-2/5"/>
                    <div className="h-2.5 bg-white/[.08] rounded w-1/3"/>
                </div>
                <div className="h-5 w-12 bg-white/10 rounded-full shrink-0"/>
            </div>
            <div className="h-px bg-white/[.07]"/>
            <div className="flex items-center justify-between">
                <div className="h-3 bg-white/10 rounded w-1/4"/>
                <div className="h-8 w-24 bg-white/15 rounded-xl"/>
            </div>
        </div>
    );
}

// ── Doctor card ────────────────────────────────────────────────────────────────
function DoctorCard({ doctor, navigate }) {
    const initials = doctor.user?.name
        ? doctor.user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
        : 'DR';

    return (
        <div
            onClick={() => navigate(`/book/${doctor._id}`)}
            className="group bg-white/[.07] rounded-2xl border border-white/[.1] p-4 hover:bg-white/[.1] hover:border-emerald-400/30 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
        >
            <div className="flex items-start gap-3.5">
                <div className="shrink-0">
                    {doctor.user?.profilePicture ? (
                        <img src={`${SERVER_BASE}${doctor.user.profilePicture}`} alt={doctor.user.name}
                            loading="lazy"
                            className="w-14 h-14 rounded-2xl object-cover ring-2 ring-white/[.1] group-hover:ring-emerald-400/35 transition-all"/>
                    ) : (
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#134e3a] to-[#2d6a4f] flex items-center justify-center text-white font-black text-lg ring-2 ring-white/[.1] group-hover:ring-emerald-400/35 transition-all">
                            {initials}
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <h3 className="font-black text-white text-sm leading-snug truncate group-hover:text-emerald-200 transition-colors">
                                د. {doctor.user?.name}
                            </h3>
                            <p className="text-[11px] text-white/50 mt-0.5 font-medium">
                                {doctor.specialization}
                                {doctor.degree && <span className="text-white/30"> · {doctor.degree}</span>}
                            </p>
                        </div>
                        <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-bold text-emerald-300 bg-emerald-500/[.15] border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                            <span className="material-symbols-outlined text-[11px]">verified</span>
                            موثّق
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-2">
                        {doctor.numReviews > 0 ? (
                            <>
                                <StarRating rating={doctor.rating}/>
                                <span className="text-amber-400 text-xs font-black">{Number(doctor.rating).toFixed(1)}</span>
                                <span className="text-white/30 text-[11px]">({doctor.numReviews} تقييم)</span>
                            </>
                        ) : (
                            <span className="text-white/25 text-[11px] flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">star_outline</span>
                                لا توجد تقييمات بعد
                            </span>
                        )}
                    </div>

                    {doctor.address?.city && (
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="material-symbols-outlined text-[12px] text-white/30">location_on</span>
                            <span className="text-[11px] text-white/40">
                                {doctor.address.city}{doctor.address.area ? `، ${doctor.address.area}` : ''}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-white/[.07]">
                <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-emerald-400 text-[14px]">payments</span>
                    <span className="text-emerald-300 font-black text-sm">{doctor.consultationFee}</span>
                    <span className="text-white/35 text-xs">جنيه</span>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/book/${doctor._id}`); }}
                    className="flex items-center gap-1.5 bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm group-hover:shadow-md group-hover:shadow-emerald-900/50"
                >
                    احجز الآن
                    <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                </button>
            </div>
        </div>
    );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ onClear }) {
    return (
        <div className="text-center py-20 bg-white/[.04] rounded-3xl border border-white/[.07]">
            <div className="w-16 h-16 rounded-2xl bg-white/[.07] flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-[34px] text-white/25">person_search</span>
            </div>
            <p className="font-black text-white/60 text-base mb-1">لا يوجد دكاترة</p>
            <p className="text-white/35 text-sm mb-5">جرّب تغيير الفلاتر أو إعادة الضبط</p>
            <button onClick={onClear}
                className="inline-flex items-center gap-1.5 text-emerald-400 font-bold text-sm hover:text-emerald-300 transition-colors">
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                عرض كل الأطباء
            </button>
        </div>
    );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function DoctorSearch() {
    const navigate                        = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Search bar state
    const [inputName,      setInputName]      = useState(searchParams.get('q')          || '');
    const [inputSpecialty, setInputSpecialty] = useState(searchParams.get('specialty')  || '');
    const [inputCity,      setInputCity]      = useState(searchParams.get('city')       || '');

    // Applied search params
    const [activeName,      setActiveName]      = useState(inputName);
    const [activeSpecialty, setActiveSpecialty] = useState(inputSpecialty);
    const [activeCity,      setActiveCity]      = useState(inputCity);

    // Sidebar filters
    const [filters, setFilters] = useState({ degree: '', gender: '', feeRange: '', minRating: 0 });

    // Sort
    const [sortBy, setSortBy] = useState('default');

    // Mobile sidebar toggle
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Doctor list via TanStack Query — cached per city, so switching cities and
    // coming back is instant (no refetch within staleTime). The query key carries
    // the city filter so each city's result is cached separately.
    const { data: doctors = [], isLoading: loading } = useDoctors(
        activeCity ? { city: activeCity } : {}
    );

    const applySearch = useCallback(() => {
        const params = {};
        if (inputName.trim())    params.q         = inputName.trim();
        if (inputSpecialty)      params.specialty  = inputSpecialty;
        if (inputCity)           params.city       = inputCity;
        setSearchParams(params, { replace: true });
        setActiveName(inputName.trim());
        setActiveSpecialty(inputSpecialty);
        setActiveCity(inputCity);
    }, [inputName, inputSpecialty, inputCity, setSearchParams]);

    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const resetAll = () => {
        setInputName(''); setInputSpecialty(''); setInputCity('');
        setActiveName(''); setActiveSpecialty(''); setActiveCity('');
        setFilters({ degree: '', gender: '', feeRange: '', minRating: 0 });
        setSortBy('default');
        setSearchParams({}, { replace: true });
    };

    // Client-side filtering
    const filtered = useMemo(() => doctors.filter((d) => {
        if (activeName && !d.user?.name?.toLowerCase().includes(activeName.toLowerCase())) return false;
        if (activeSpecialty && d.specialization !== activeSpecialty) return false;

        const { degree, gender, feeRange, minRating } = filters;
        if (degree && !d.degree?.toLowerCase().includes(degree.toLowerCase())) return false;
        if (gender) {
            const g = d.user?.gender || d.gender || '';
            if (g && g !== gender) return false;
        }
        if (feeRange) {
            const range = FEE_RANGES.find((r) => r.value === feeRange);
            if (range && d.consultationFee > range.max) return false;
        }
        if (minRating > 0 && (d.rating || 0) < minRating) return false;
        return true;
    }), [doctors, activeName, activeSpecialty, filters]);

    const sorted = useMemo(() => {
        const arr = [...filtered];
        if (sortBy === 'rating')   return arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        if (sortBy === 'fee_asc')  return arr.sort((a, b) => (a.consultationFee || 0) - (b.consultationFee || 0));
        if (sortBy === 'fee_desc') return arr.sort((a, b) => (b.consultationFee || 0) - (a.consultationFee || 0));
        return arr;
    }, [filtered, sortBy]);

    const activeFilterCount = [
        filters.degree, filters.gender, filters.feeRange, filters.minRating > 0 ? '1' : '',
    ].filter(Boolean).length;

    const hasSearch = activeName || activeSpecialty || activeCity;
    const resultLabel = activeSpecialty
        ? (SPECIALTIES.find((s) => s.value === activeSpecialty)?.label || activeSpecialty)
        : activeCity ? `أطباء ${activeCity}` : 'جميع الأطباء';

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0b2d20] via-[#103d2a] to-[#1a4d35] font-['Cairo']" dir="rtl">
            <PatientHeader />

            {/* ── Search hero ───────────────────────────────────────────────── */}
            <div className="bg-[#091f15] border-b border-white/[.07]">
                <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-4">

                    {/* Title */}
                    <div>
                        <h1 className="font-black text-white text-xl">ابحث عن طبيبك</h1>
                        <p className="text-white/40 text-xs mt-0.5">
                            {loading ? 'جاري التحميل...' : `${doctors.length} طبيب متاح${activeCity ? ` في ${activeCity}` : ''}`}
                        </p>
                    </div>

                    {/* Search bar: name + specialty + city */}
                    <div className="flex flex-col sm:flex-row items-stretch gap-2">
                        {/* Name input */}
                        <div className="flex items-center gap-2 flex-1 bg-white/[.08] border border-white/[.12] rounded-2xl px-3 py-2.5 focus-within:border-emerald-400/40 transition-colors min-w-0">
                            <span className="material-symbols-outlined text-white/35 text-[18px] shrink-0">search</span>
                            <input
                                type="text"
                                value={inputName}
                                onChange={(e) => setInputName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                                placeholder="ابحث باسم الدكتور..."
                                className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/30 min-w-0"
                                dir="rtl"
                                autoFocus
                            />
                            {inputName && (
                                <button onClick={() => setInputName('')}
                                    className="text-white/30 hover:text-white/60 transition-colors shrink-0">
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                            )}
                        </div>

                        {/* Specialty select */}
                        <div className="flex items-center gap-2 bg-white/[.08] border border-white/[.12] rounded-2xl px-3 py-2.5 focus-within:border-emerald-400/40 transition-colors sm:w-52">
                            <span className="material-symbols-outlined text-white/35 text-[16px] shrink-0">stethoscope</span>
                            <select
                                value={inputSpecialty}
                                onChange={(e) => setInputSpecialty(e.target.value)}
                                className="flex-1 bg-transparent text-white/70 text-sm outline-none cursor-pointer min-w-0 [&>option]:bg-[#0b2d20] [&>option]:text-white"
                            >
                                {SPECIALTIES.map((s) => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* City select */}
                        <div className="flex items-center gap-2 bg-white/[.08] border border-white/[.12] rounded-2xl px-3 py-2.5 focus-within:border-emerald-400/40 transition-colors sm:w-44">
                            <span className="material-symbols-outlined text-white/35 text-[16px] shrink-0">location_on</span>
                            <select
                                value={inputCity}
                                onChange={(e) => setInputCity(e.target.value)}
                                className="flex-1 bg-transparent text-white/70 text-sm outline-none cursor-pointer min-w-0 [&>option]:bg-[#0b2d20] [&>option]:text-white"
                            >
                                <option value="">كل المدن</option>
                                {EGYPTIAN_CITIES.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        {/* Search button */}
                        <button
                            onClick={applySearch}
                            className="bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-sm px-7 py-2.5 rounded-2xl transition-all shadow-sm shrink-0"
                        >
                            بحث
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Main content ──────────────────────────────────────────────── */}
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-6">

                {/* Results bar */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-black text-white text-base">{resultLabel}</h2>
                        {!loading && (
                            <span className="text-xs font-bold text-white/45 bg-white/[.08] border border-white/[.1] px-2.5 py-1 rounded-full">
                                {sorted.length} طبيب
                            </span>
                        )}
                        {(hasSearch || activeFilterCount > 0) && (
                            <button onClick={resetAll}
                                className="flex items-center gap-0.5 text-xs text-red-400/70 hover:text-red-300 font-semibold transition-colors">
                                <span className="material-symbols-outlined text-[13px]">close</span>
                                مسح الكل
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Mobile filter toggle */}
                        <button onClick={() => setSidebarOpen((o) => !o)}
                            className={`lg:hidden flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-all ${
                                activeFilterCount > 0
                                    ? 'bg-emerald-700/50 text-white border-emerald-500/40'
                                    : 'bg-white/[.07] text-white/60 border-white/[.1] hover:bg-white/[.12]'
                            }`}>
                            <span className="material-symbols-outlined text-[15px]">tune</span>
                            فلترة {activeFilterCount > 0 && `(${activeFilterCount})`}
                        </button>

                        {!loading && sorted.length > 1 && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-white/35 hidden sm:inline">ترتيب:</span>
                                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                                    className="bg-white/[.07] border border-white/[.1] text-white/70 text-xs font-bold rounded-xl px-3 py-1.5 outline-none cursor-pointer hover:bg-white/[.1] transition-colors [&>option]:bg-[#0b2d20] [&>option]:text-white">
                                    {SORT_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mobile sidebar (collapsible) */}
                {sidebarOpen && (
                    <div className="lg:hidden">
                        <FilterSidebar
                            filters={filters}
                            onChange={handleFilterChange}
                            onReset={() => setFilters({ degree: '', gender: '', feeRange: '', minRating: 0 })}
                            activeCount={activeFilterCount}
                        />
                    </div>
                )}

                {/* Desktop: sidebar + grid */}
                <div className="flex gap-6 items-start">

                    {/* Sidebar (desktop) */}
                    <div className="hidden lg:block w-64 shrink-0">
                        <FilterSidebar
                            filters={filters}
                            onChange={handleFilterChange}
                            onReset={() => setFilters({ degree: '', gender: '', feeRange: '', minRating: 0 })}
                            activeCount={activeFilterCount}
                        />
                    </div>

                    {/* Cards */}
                    <div className="flex-1 min-w-0">
                        {loading ? (
                            <div className="flex flex-col gap-3">
                                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i}/>)}
                            </div>
                        ) : sorted.length === 0 ? (
                            <EmptyState onClear={resetAll}/>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {sorted.map((doc) => (
                                    <DoctorCard key={doc._id} doctor={doc} navigate={navigate}/>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}

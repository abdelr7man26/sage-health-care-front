// Single source of truth for medical specialties.
//
// Used by:
//   - Doctor registration (the specialty picker) — what a doctor can choose.
//   - Patient doctor-search (the filter dropdown) — what a patient can filter by.
//
// The stored DoctorProfile.specialization value is exactly one of these strings,
// so the patient search filter compares against these same strings (not English
// keys). Keep this list as the only place specialties are defined so the picker
// and the filter can never drift apart.
export const SPECIALIZATIONS = [
    'طب عام', 'طب الأطفال', 'طب الباطنة', 'طب القلب والأوعية الدموية',
    'طب الأعصاب', 'طب العظام والمفاصل', 'طب العيون', 'طب الأنف والأذن والحنجرة',
    'طب الجلدية والتجميل', 'الطب النفسي', 'طب الأسنان', 'طب النساء والتوليد',
    'طب الكلى', 'طب الجهاز الهضمي', 'طب الغدد الصماء', 'طب الصدر والجهاز التنفسي',
    'جراحة عامة', 'جراحة القلب والصدر', 'جراحة المخ والأعصاب', 'جراحة التجميل',
    'جراحة الأوعية الدموية', 'جراحة العظام', 'طب الطوارئ والحوادث', 'طب الأورام',
    'طب المسالك البولية', 'تخدير وعناية مركزة', 'طب الروماتيزم', 'طب الحساسية والمناعة',
];

// Dropdown options for the patient search filter: a "كل التخصصات" (all) entry
// followed by every specialty. label === value so the filter match is exact.
export const SPECIALTY_FILTER_OPTIONS = [
    { label: 'كل التخصصات', value: '' },
    ...SPECIALIZATIONS.map((s) => ({ label: s, value: s })),
];

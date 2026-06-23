// Static option lists, sidebar menu, and shared Tailwind class tokens for the
// patient profile page. Extracted so the page component holds logic, not config.

// ── Sidebar menu ───────────────────────────────────────────────────────────────
export const MENU = [
    { id: 'basic',       label: 'البيانات الأساسية',  icon: 'person'              },
    { id: 'medical',     label: 'البيانات الطبية',     icon: 'medical_information' },
    { id: 'medications', label: 'جدول الأدوية',        icon: 'medication'          },
    { id: 'history',     label: 'تاريخ الزيارات',      icon: 'history'             },
    { id: 'password',    label: 'تغيير كلمة المرور',   icon: 'lock'                },
    { id: 'danger',      label: 'حذف الحساب',          icon: 'delete_forever',  danger: true },
];

// ── Static options ─────────────────────────────────────────────────────────────
export const BLOOD_TYPES    = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const GENDER_OPTIONS = [{ value: 'male', label: 'ذكر' }, { value: 'female', label: 'أنثى' }];
export const FREQ_OPTIONS   = [
    { value: 'once_daily',  label: 'مرة يومياً'       },
    { value: 'twice_daily', label: 'مرتين يومياً'     },
    { value: 'three_daily', label: 'ثلاث مرات يومياً' },
    { value: 'four_daily',  label: 'أربع مرات يومياً' },
    { value: 'as_needed',   label: 'عند الحاجة'       },
    { value: 'weekly',      label: 'أسبوعياً'         },
];
export const FREQ_DEFAULTS = {
    once_daily:  ['08:00'],
    twice_daily: ['08:00', '20:00'],
    three_daily: ['08:00', '14:00', '20:00'],
    four_daily:  ['08:00', '14:00', '20:00', '02:00'],
    as_needed:   [],
    weekly:      ['08:00'],
};
export const DURATION_OPTIONS = [
    { value: '',        label: 'غير محدد'           },
    { value: '3',       label: '3 أيام'             },
    { value: '5',       label: '5 أيام'             },
    { value: '7',       label: 'أسبوع (7 أيام)'    },
    { value: '10',      label: '10 أيام'            },
    { value: '14',      label: 'أسبوعان (14 يوم)'  },
    { value: '30',      label: 'شهر (30 يوم)'      },
    { value: '60',      label: 'شهران'              },
    { value: '90',      label: '3 أشهر'             },
    { value: '180',     label: '6 أشهر'             },
    { value: '365',     label: 'سنة'                },
    { value: 'ongoing', label: 'مستمر (بدون انتهاء)' },
];
export const WEEKDAY_OPTIONS = [
    { value: 0, label: 'الأحد'     },
    { value: 1, label: 'الاثنين'   },
    { value: 2, label: 'الثلاثاء'  },
    { value: 3, label: 'الأربعاء'  },
    { value: 4, label: 'الخميس'   },
    { value: 5, label: 'الجمعة'   },
    { value: 6, label: 'السبت'    },
];
export const RECORD_TYPES = [
    { value: 'lab_result',   label: 'نتيجة تحليل', icon: 'biotech'      },
    { value: 'scan',         label: 'أشعة / سكان',  icon: 'radiology'    },
    { value: 'prescription', label: 'روشتة',        icon: 'receipt_long' },
    { value: 'report',       label: 'تقرير طبي',    icon: 'description'  },
    { value: 'other',        label: 'أخرى',         icon: 'folder'       },
];

// ── Style tokens (shared Tailwind class strings) ───────────────────────────────
export const inputCls = [
    'w-full bg-white/[.08] border border-white/[.15] rounded-xl px-3.5 py-2.5 text-sm text-white',
    'outline-none transition-all focus:bg-white/[.13] focus:border-emerald-500/60',
    'placeholder-white/30 disabled:opacity-50 disabled:cursor-not-allowed',
    '[&>option]:bg-[#0f2d1e] [&>option]:text-white',
].join(' ');

export const btnPrimary = [
    'flex items-center justify-center gap-2 bg-[#134e3a] hover:bg-[#0c3326] active:scale-95',
    'text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all',
    'disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100',
].join(' ');

export const btnGhost = [
    'flex items-center justify-center gap-2 bg-white/[.08] hover:bg-white/[.15] active:scale-95',
    'text-white/70 px-5 py-2.5 rounded-xl text-sm font-bold transition-all',
    'disabled:opacity-60 disabled:cursor-not-allowed',
].join(' ');

export const btnOutline = [
    'flex items-center gap-2 border border-emerald-500/50 text-emerald-300',
    'hover:bg-emerald-500/15 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95',
].join(' ');

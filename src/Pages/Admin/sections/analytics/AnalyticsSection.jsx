import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SectionTitle } from '../../adminShared';
import { GrowthTab } from './GrowthTab';
import { DemandGapsTab } from './DemandGapsTab';
import { ActivityHeatmapTab } from './ActivityHeatmapTab';
import { ClinicEconomicsTab } from './ClinicEconomicsTab';
import { ClinicEfficiencyTab } from './ClinicEfficiencyTab';
import { PatientDemographicsTab } from './PatientDemographicsTab';
import { DoctorHealthTab } from './DoctorHealthTab';
import { AiUsageTab } from './AiUsageTab';
import { SecretaryActivityTab } from './SecretaryActivityTab';

// ── Analytics section (container) ─────────────────────────────────────────────

const ANALYTICS_TAB_GROUPS = [
    {
        label: 'البيزنس',
        tabs: [
            { key: 'doctor-health', label: 'صحة الأطباء',     icon: 'ecg_heart' },
            { key: 'economics',     label: 'اقتصاد العيادات', icon: 'payments' },
        ],
    },
    {
        label: 'التشغيل',
        tabs: [
            { key: 'efficiency',  label: 'كفاءة العيادات',   icon: 'timer' },
            { key: 'secretaries', label: 'نشاط السكرتارية',  icon: 'support_agent' },
            { key: 'ai-usage',    label: 'المساعد الذكي',    icon: 'smart_toy' },
        ],
    },
    {
        label: 'النمو والسوق',
        tabs: [
            { key: 'growth',   label: 'نمو المنصة',        icon: 'trending_up' },
            { key: 'patients', label: 'ديموغرافيا المرضى', icon: 'diversity_3' },
            { key: 'demand',   label: 'فجوات الطلب',       icon: 'network_check' },
            { key: 'heatmap',  label: 'أنماط النشاط',      icon: 'grid_view' },
        ],
    },
];

function AnalyticsSection() {
    const [activeTab, setActiveTab] = useState('doctor-health');

    return (
        <div dir="rtl">
            <SectionTitle
                icon="insights"
                title="ذكاء البيانات"
                subtitle="تحليلات متقدمة لنمو المنصة وأداء العيادات واتخاذ قرارات العروض"
            />

            {/* Sub-tabs grouped by purpose */}
            <div className="flex flex-wrap items-start gap-x-6 gap-y-3 mb-6">
                {ANALYTICS_TAB_GROUPS.map(group => (
                    <div key={group.label}>
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-1 mb-1.5">{group.label}</p>
                        <div className="flex flex-wrap gap-2">
                            {group.tabs.map(t => (
                                <button key={t.key} onClick={() => setActiveTab(t.key)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                        activeTab === t.key
                                            ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/40'
                                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <AnimatePresence mode="wait">
                <motion.div key={activeTab}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                >
                    {activeTab === 'growth'        && <GrowthTab />}
                    {activeTab === 'doctor-health' && <DoctorHealthTab />}
                    {activeTab === 'economics'  && <ClinicEconomicsTab />}
                    {activeTab === 'efficiency' && <ClinicEfficiencyTab />}
                    {activeTab === 'patients'    && <PatientDemographicsTab />}
                    {activeTab === 'ai-usage'    && <AiUsageTab />}
                    {activeTab === 'secretaries' && <SecretaryActivityTab />}
                    {activeTab === 'demand'  && <DemandGapsTab />}
                    {activeTab === 'heatmap' && <ActivityHeatmapTab />}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}


export { AnalyticsSection };

import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getClinicEconomics } from '../../../../Services/adminService';
import { SkeletonRows, StatCard, inputCls, ChartTooltip, CARD_COLORS, ECON_PERIODS, ErrorState } from '../../adminShared';

// ── Clinic Economics sub-tab ──────────────────────────────────────────────────

function ClinicEconomicsTab() {
    const [data, setData]     = useState(null);
    const [loading, setL]     = useState(true);
    const [days, setDays]     = useState(90);
    const [search, setSearch] = useState('');
    const [error, setError]   = useState(false);

    const load = useCallback(() => {
        setL(true);
        setError(false);
        getClinicEconomics({ days })
            .then((r) => setData(r.data))
            .catch(() => setError(true))
            .finally(() => setL(false));
    }, [days]);

    useEffect(() => { load(); }, [load]);

    const sum = data?.summary;
    const fmtMoney = (n) => `${(n ?? 0).toLocaleString('ar-EG')} ج`;

    const doctors = (data?.doctors ?? []).filter(d =>
        !search.trim()
        || d.name?.includes(search.trim())
        || d.specialization?.includes(search.trim())
        || d.city?.includes(search.trim()));

    const INCOME_SPLIT = [
        { label: 'كشوفات أونلاين',  income: sum?.bookingIncome,   count: sum?.completedBookings, unit: 'كشف',   color: 'emerald', icon: 'event_available' },
        { label: 'زيارات مباشرة',   income: sum?.walkInIncome,    count: sum?.doneWalkIns,       unit: 'زيارة', color: 'cyan',    icon: 'directions_walk' },
        { label: 'عمليات',          income: sum?.operationIncome, count: sum?.doneOperations,    unit: 'عملية', color: 'amber',   icon: 'medical_services' },
    ];

    if (error) return <ErrorState onRetry={load} />;

    return (
        <div className="space-y-6">
            {/* Purpose banner */}
            <div className="bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-800/20 rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-emerald-400 text-[22px] mt-0.5 flex-shrink-0">payments</span>
                <div>
                    <p className="text-sm font-bold text-emerald-300">دخل العيادات المسجّل على المنصة</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        مجموع رسوم الكشوفات المكتملة والزيارات المباشرة والعمليات المنتهية — لا يوجد دفع عبر المنصة،
                        هذه الأرقام توثّق القيمة التي تولّدها المنصة لكل عيادة وتُستخدم في تسعير وتجديد اشتراكات الأطباء.
                    </p>
                </div>
            </div>

            {/* Period selector */}
            <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
                {ECON_PERIODS.map(p => (
                    <button key={p.days} onClick={() => setDays(p.days)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors
                            ${days === p.days ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >{p.label}</button>
                ))}
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon="account_balance_wallet" label="إجمالي دخل العيادات" color="emerald" loading={loading}
                    value={fmtMoney(sum?.totalIncome)}
                    sub={`خلال آخر ${days} يوم`}
                />
                <StatCard icon="language" label="حصة الأونلاين من الزيارات" color="blue" loading={loading}
                    value={sum != null ? `${sum.onlineSharePct}%` : '—'}
                    sub={sum ? `${sum.completedBookings?.toLocaleString('ar-EG')} كشف أونلاين مقابل ${sum.doneWalkIns?.toLocaleString('ar-EG')} زيارة مباشرة` : null}
                />
                <StatCard icon="swap_horiz" label="تحويل المتابعات لحجوزات أونلاين" color="violet" loading={loading}
                    value={sum != null ? `${sum.followUpConversionPct}%` : '—'}
                    sub={sum ? `${sum.convertedToBooking} من ${sum.followUpsEnabled} متابعة مجدولة` : null}
                />
                <StatCard icon="repeat" label="زيارات مباشرة من مرضى عائدين" color="cyan" loading={loading}
                    value={sum != null ? `${sum.walkInReturningPct}%` : '—'}
                    sub={sum ? `${sum.registeredWalkInPct}% من زوار العيادات مسجّلون على المنصة` : null}
                />
            </div>

            {/* Income split */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {INCOME_SPLIT.map(({ label, income, count, unit, color, icon }) => {
                    const c = CARD_COLORS[color];
                    return (
                        <div key={label} className={`bg-slate-900 rounded-2xl p-5 border ${c.border}`}>
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className={`w-9 h-9 rounded-xl ${c.icon} flex items-center justify-center`}>
                                    <span className="material-symbols-outlined text-[18px]">{icon}</span>
                                </div>
                                <span className="text-sm font-bold text-slate-300">{label}</span>
                            </div>
                            {loading
                                ? <div className="h-7 w-24 bg-slate-800 rounded animate-pulse" />
                                : (
                                    <>
                                        <p className={`text-2xl font-black ${c.num}`}>{fmtMoney(income)}</p>
                                        <p className="text-xs text-slate-600 mt-1">{(count ?? 0).toLocaleString('ar-EG')} {unit}</p>
                                    </>
                                )
                            }
                        </div>
                    );
                })}
            </div>

            {/* 12-month income timeline */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                <h3 className="font-black text-slate-200 mb-5 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-emerald-400">stacked_bar_chart</span>
                    دخل العيادات الشهري — آخر 12 شهراً
                </h3>
                {loading
                    ? <div className="h-52 bg-slate-800 rounded-xl animate-pulse" />
                    : (
                        <ResponsiveContainer width="100%" height={230}>
                            <BarChart data={data?.timeline} margin={{ right: 4, left: -10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12, direction: 'rtl' }}
                                    formatter={v => <span style={{ color: '#94a3b8' }}>{v}</span>} />
                                <Bar dataKey="bookings"   name="كشوفات أونلاين" stackId="income" fill="#10b981" maxBarSize={28} />
                                <Bar dataKey="walkIns"    name="زيارات مباشرة"  stackId="income" fill="#06b6d4" maxBarSize={28} />
                                <Bar dataKey="operations" name="عمليات"         stackId="income" fill="#f59e0b" radius={[3,3,0,0]} maxBarSize={28} />
                            </BarChart>
                        </ResponsiveContainer>
                    )
                }
            </div>

            {/* Search */}
            <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="بحث باسم الطبيب أو التخصص أو المدينة..."
                className={`${inputCls} w-full md:w-80`}
            />

            {/* Per-doctor economics table */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm" dir="rtl">
                        <thead>
                            <tr className="bg-slate-800/60 border-b border-slate-700/50">
                                {['الطبيب','التخصص','المدينة','كشوفات أونلاين','زيارات مباشرة','عمليات','إجمالي الدخل','% أونلاين','تحويلات أونلاين'].map(h => (
                                    <th key={h} className="px-3 py-3 text-right text-[11px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <SkeletonRows cols={9} rows={6} /> : doctors.length === 0 ? (
                                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-600">لا توجد نتائج</td></tr>
                            ) : doctors.map((d) => (
                                <tr key={d.doctorProfileId} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                                    <td className="px-3 py-3">
                                        <p className="font-bold text-slate-200 text-sm whitespace-nowrap">د. {d.name}</p>
                                        {d.phone && (
                                            <a href={`tel:${d.phone}`} dir="ltr"
                                                className="text-[10px] font-semibold text-emerald-500/90 hover:text-emerald-400 transition-colors whitespace-nowrap">
                                                {d.phone}
                                            </a>
                                        )}
                                    </td>
                                    <td className="px-3 py-3 text-slate-400 text-xs whitespace-nowrap">{d.specialization}</td>
                                    <td className="px-3 py-3 text-slate-500 text-xs">{d.city}</td>
                                    <td className="px-3 py-3 whitespace-nowrap">
                                        <p className="text-sm font-black text-emerald-400">{fmtMoney(d.bookingIncome)}</p>
                                        <p className="text-[10px] text-slate-600">{d.completedBookings} كشف</p>
                                    </td>
                                    <td className="px-3 py-3 whitespace-nowrap">
                                        <p className="text-sm font-black text-cyan-400">{fmtMoney(d.walkInIncome)}</p>
                                        <p className="text-[10px] text-slate-600">{d.doneWalkIns} زيارة{d.returningWalkIns > 0 && ` · ${d.returningWalkIns} عائد`}</p>
                                    </td>
                                    <td className="px-3 py-3 whitespace-nowrap">
                                        <p className="text-sm font-black text-amber-400">{fmtMoney(d.operationIncome)}</p>
                                        <p className="text-[10px] text-slate-600">{d.doneOperations} عملية</p>
                                    </td>
                                    <td className="px-3 py-3 whitespace-nowrap">
                                        <span className="text-sm font-black text-slate-100">{fmtMoney(d.totalIncome)}</span>
                                    </td>
                                    <td className="px-3 py-3 min-w-[110px]">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${Math.min(100, d.onlinePct)}%` }} />
                                            </div>
                                            <span className="text-xs font-bold text-slate-300 w-8 text-left">{d.onlinePct}%</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3">
                                        {d.convertedToBooking > 0
                                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-violet-500/20 text-violet-400">
                                                <span className="material-symbols-outlined text-[12px]">swap_horiz</span>
                                                {d.convertedToBooking}
                                              </span>
                                            : <span className="text-slate-700 text-xs">—</span>
                                        }
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}


export { ClinicEconomicsTab };

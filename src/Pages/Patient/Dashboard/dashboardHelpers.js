// Pure, time-aware helpers extracted from PatientDashboard.
// Kept framework-free (no React) so they're trivially testable and reusable.

export const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'صباح الخير';
    if (h < 18) return 'مساء الخير';
    return 'مساء النور';
};

export const getNextMedication = (medications = []) => {
    const now = new Date();
    const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    let best = null;
    let bestTime = null;
    for (const med of medications.filter((m) => m.isActive)) {
        for (const t of med.times || []) {
            if (t >= current && (!bestTime || t < bestTime)) {
                bestTime = t;
                best = { ...med, nextDose: t };
            }
        }
    }
    // Nothing left today — show first dose of earliest active med as tomorrow's
    if (!best) {
        for (const med of medications.filter((m) => m.isActive)) {
            if (med.times?.length) {
                const earliest = [...med.times].sort()[0];
                if (!bestTime || earliest < bestTime) {
                    bestTime = earliest;
                    best = { ...med, nextDose: `${earliest} (غداً)` };
                }
            }
        }
    }
    return best;
};

// Returns the soonest upcoming event (booking, operation, or follow-up), normalized.
//
// bookings array is already pre-filtered and sorted ASC by the server
// (?upcoming=true), so we just need to map it and merge with operations/follow-ups
// before doing a final sort to find the absolute nearest across all three types.
//
// Time-awareness: on today's date the server filters by DATE only, not TIME.
// So a 3 PM slot is still in the array at 3:01 PM until the client re-fetches.
// We handle this here by skipping any slot whose startTime has already passed
// on today's date — the minute ticker re-renders this component every 60 s so
// the card advances automatically when the clock minute changes.
export const getNextEvent = (bookings = [], operations = [], followUps = [], walkIns = []) => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const todayKey = getTodayKey();
    const nowHHMM  = getNowHHMM();

    // bookings already filtered (confirmed/pending, date >= today) and sorted ASC
    const mappedBookings = bookings
        .filter((b) => {
            // Never drop an in-progress booking — the patient is being seen right now
            if (b.status === 'in-progress') return true;
            // Skip today's past slots (start time already elapsed)
            if (slotDateKey(b.slotDetails.date) === todayKey &&
                (b.slotDetails?.startTime ?? '00:00') <= nowHHMM) {
                return false;
            }
            return true;
        })
        .map((b) => ({
            _type:    'booking',
            date:     new Date(b.slotDetails.date),
            time:     b.slotDetails?.startTime,
            label:    `د. ${b.doctor?.name || ''}`,
            sublabel: b.doctorProfile?.specialization || '',
            raw:      b,
        }));

    // operations and follow-ups still need client-side filtering
    const mappedOps = operations
        .filter((o) => o.status === 'scheduled' && new Date(o.date) >= today)
        .map((o) => ({
            _type:    'operation',
            date:     new Date(o.date),
            time:     o.time,
            label:    o.operationType,
            sublabel: o.location || `د. ${o.doctor?.name || ''}`,
            raw:      o,
        }));

    const mappedFollowUps = followUps.map((f) => ({
        _type:    'followup',
        date:     new Date(f.followUp.scheduledFor),
        time:     f.slotDetails?.startTime || '—',
        label:    'إعادة كشف',
        sublabel: `د. ${f.doctor?.name || ''}`,
        raw:      f,
    }));

    // Walk-ins: today's active ones sort to the top (date=now); future ones use their real date
    const mappedWalkIns = walkIns
        .filter((w) => ['waiting', 'in-progress'].includes(w.status))
        .map((w) => ({
            _type:    'walkin',
            date:     slotDateKey(w.date) === todayKey ? new Date() : new Date(w.date),
            time:     w.arrivalTime || '—',
            label:    `د. ${w.doctor?.name || ''}`,
            sublabel: w.complaint || 'زيارة حضورية',
            raw:      w,
        }));

    // Final sort across all types to get absolute nearest
    return [...mappedWalkIns, ...mappedBookings, ...mappedOps, ...mappedFollowUps]
        .sort((a, b) => a.date - b.date)[0] || null;
};

export const isToday = (date) => {
    if (!date) return false;
    const d = new Date(date);
    const t = new Date();
    return d.getFullYear() === t.getFullYear() &&
           d.getMonth()    === t.getMonth()    &&
           d.getDate()     === t.getDate();
};

/** "HH:MM" of the current local time — zero-padded for safe string comparison. */
export const getNowHHMM = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Returns the UTC date portion of a slot Date as "YYYY-MM-DD".
 * Slot dates are stored as UTC midnight (new Date("YYYY-MM-DD")),
 * so we must use UTC getters to avoid timezone-shifting the day.
 */
export const slotDateKey = (date) => {
    const d = new Date(date);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

/** Today's date as "YYYY-MM-DD" in local time — for comparing against slotDateKey. */
export const getTodayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('ar-EG', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    });
};

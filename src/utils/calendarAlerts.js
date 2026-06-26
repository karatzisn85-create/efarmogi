/** Ειδοποιήσεις & φίλτρα χρονικού παραθύρου για το Ημερολόγιο Προθεσμιών */

import {
  CALENDAR_EVENT_LABELS,
  CALENDAR_EVENT_TYPES,
  formatEventDateTime,
  calendarEventRowKey,
} from './procurementCalendarEvents';

export const CALENDAR_TIME_WINDOWS = [
  { days: 7, label: '7 ημέρες' },
  { days: 14, label: '2 εβδομάδες' },
  { days: 30, label: '1 μήνας' },
  { days: 60, label: '2 μήνες' },
  { days: 90, label: '3 μήνες' },
  { days: 180, label: '6 μήνες' },
  { days: 365, label: '1 έτος' },
];

export function getCalendarWindowLabel(days) {
  const row = CALENDAR_TIME_WINDOWS.find((w) => w.days === days);
  return row?.label || `${days} ημέρες`;
}

/**
 * Επιλογή προθεσμιών για widget / λίστα — ταξινόμηση ανά ημέρες που απομένουν.
 */
function mapEventToAlertRow(ev) {
  return {
    id: calendarEventRowKey(ev),
    subprojectId: ev.subprojectId || '',
    customEventId: ev.customEventId || '',
    title: ev.subprojectTitle || ev.label || '(Χωρίς τίτλο)',
    projectTitle: ev.projectTitle || '',
    label: ev.label || CALENDAR_EVENT_LABELS[ev.type] || ev.type,
    type: ev.type,
    dateIso: ev.dateIso,
    dateLabel: formatEventDateTime(ev.dateIso),
    daysLeft: ev.daysLeft,
    urgency: ev.urgency,
    adam: ev.adam || '',
    description: ev.description || ev.complianceSummary || '',
    orimanthiProposalId: ev.orimanthiProposalId || '',
    isCustom: !!ev.isCustom || ev.type === CALENDAR_EVENT_TYPES.CUSTOM,
    isOrimanthiAepo: !!ev.isOrimanthiAepo || ev.type === CALENDAR_EVENT_TYPES.AEPO_RENEWAL,
  };
}

export function buildCalendarDeadlineAlerts(events, {
  maxDays = 30,
  minDays = 0,
  limit = 8,
  includePast = false,
} = {}) {
  const rows = [];

  for (const ev of events || []) {
    if (ev.type === CALENDAR_EVENT_TYPES.COMPLIANCE_12M) {
      rows.push(mapEventToAlertRow(ev));
      continue;
    }

    if (ev.daysLeft == null) continue;
    if (!includePast && ev.daysLeft < 0) continue;
    if (includePast && ev.daysLeft < 0 && Math.abs(ev.daysLeft) > maxDays) continue;
    if (ev.daysLeft >= 0 && ev.daysLeft > maxDays) continue;
    if (ev.daysLeft >= 0 && ev.daysLeft < minDays) continue;

    rows.push(mapEventToAlertRow(ev));
  }

  rows.sort(
    (a, b) => {
      const aPast = a.daysLeft != null && a.daysLeft < 0;
      const bPast = b.daysLeft != null && b.daysLeft < 0;
      if (aPast !== bPast) return aPast ? 1 : -1;
      return (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999)
        || (a.title || '').localeCompare(b.title || '', 'el', { sensitivity: 'base' });
    }
  );

  const totalCount = rows.length;
  const alerts = typeof limit === 'number' && limit > 0 ? rows.slice(0, limit) : rows;
  return { alerts, totalCount };
}

export function formatCalendarDaysLabel(daysLeft) {
  if (daysLeft == null) return '';
  if (daysLeft < 0) {
    const n = Math.abs(daysLeft);
    return n === 1 ? 'Έληξε χθες' : `Έληξε πριν ${n} ημ.`;
  }
  if (daysLeft === 0) return 'Σήμερα';
  if (daysLeft === 1) return '1 ημέρα';
  return `${daysLeft} ημέρες`;
}

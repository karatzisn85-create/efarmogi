/** Προθεσμίες ΑΕΠΟ (Ωρίμανση Έργων) — ενσωμάτωση στο Ημερολόγιο / Ραντάρ */

import {
  CALENDAR_EVENT_TYPES,
  toDateKey,
} from './procurementCalendarEvents';
import { daysUntilDate } from './procurementDeadlines';

function urgencyFromDaysLeft(daysLeft) {
  if (daysLeft == null) return 'normal';
  if (daysLeft < 0) return 'past';
  if (daysLeft <= 7) return 'urgent';
  if (daysLeft <= 30) return 'soon';
  return 'normal';
}

export function mapAepoAlertToCalendarRow(alert) {
  if (!alert?.id || !alert?.aepoRenewalDate) return null;
  const dateIso = String(alert.aepoRenewalDate).slice(0, 10);
  const daysLeft = alert.daysLeft != null ? alert.daysLeft : daysUntilDate(dateIso);
  return {
    type: CALENDAR_EVENT_TYPES.AEPO_RENEWAL,
    orimanthiProposalId: alert.id,
    label: 'Ανανέωση ΑΕΠΟ',
    subprojectTitle: alert.title || '(Χωρίς τίτλο)',
    projectTitle: alert.projectCategory || '',
    description: alert.status ? `Κατάσταση: ${alert.status}` : '',
    dateIso,
    dateKey: toDateKey(dateIso),
    daysLeft,
    urgency: urgencyFromDaysLeft(daysLeft),
    priority: daysLeft != null && daysLeft <= 30 ? 'high' : 'medium',
    isOrimanthiAepo: true,
  };
}

export function buildAepoCalendarEvents(alerts) {
  return (alerts || [])
    .map(mapAepoAlertToCalendarRow)
    .filter(Boolean);
}

/**
 * Προθεσμίες λήξης υποβολής προσκλήσεων — ενσωμάτωση στο Ημερολόγιο.
 * Η πηγή είναι το τρέχον πεδίο deadline της πρόσκλησης (ενημερώνεται και από τροποποιήσεις).
 */

import {
  CALENDAR_EVENT_TYPES,
  toDateKey,
} from './procurementCalendarEvents';
import { daysUntilDate } from './procurementDeadlines';
import { parseProsklisiDeadline } from './prosklisiDeadlineUtils';

function urgencyFromDaysLeft(daysLeft) {
  if (daysLeft == null) return 'normal';
  if (daysLeft < 0) return 'past';
  if (daysLeft <= 7) return 'urgent';
  if (daysLeft <= 30) return 'soon';
  return 'normal';
}

export function prosklisiDeadlineToIsoDate(deadline) {
  const d = parseProsklisiDeadline(deadline);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function mapProsklisiToCalendarRow(prosklisi) {
  if (!prosklisi?.prosklisiId) return null;
  const dateIso = prosklisiDeadlineToIsoDate(prosklisi.deadline);
  if (!dateIso) return null;
  const daysLeft = daysUntilDate(dateIso);
  const linked = Array.isArray(prosklisi.linkedProjects)
    ? prosklisi.linkedProjects
      .map((lp) => (typeof lp === 'string' ? lp : (lp?.title || lp?.projectTitle || '')))
      .filter(Boolean)
    : [];

  return {
    type: CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE,
    prosklisiId: prosklisi.prosklisiId,
    label: 'Λήξη υποβολής πρόσκλησης',
    subprojectTitle: prosklisi.title || '(Χωρίς τίτλο)',
    projectTitle: linked[0] || '',
    description: [
      prosklisi.status ? `Κατάσταση: ${prosklisi.status}` : '',
      linked.length ? `Έργα: ${linked.join(' · ')}` : '',
      prosklisi.code ? `Κωδικός: ${prosklisi.code}` : '',
    ].filter(Boolean).join(' · '),
    dateIso,
    dateKey: toDateKey(dateIso),
    daysLeft,
    urgency: urgencyFromDaysLeft(daysLeft),
    priority: daysLeft != null && daysLeft <= 30 ? 'high' : 'medium',
    isProsklisiDeadline: true,
  };
}

export function buildProsklisiCalendarEvents(proskliseis) {
  return (proskliseis || [])
    .map(mapProsklisiToCalendarRow)
    .filter(Boolean);
}

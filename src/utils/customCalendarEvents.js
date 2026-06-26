/** Ειδοποιήσεις ημερολογίου (καταχωρημένες από διαχειριστές) — renderer helpers */

import {
  CALENDAR_EVENT_TYPES,
  toDateKey,
  isDateOnlyCalendarIso,
  calendarEventRowKey,
} from './procurementCalendarEvents';
import { daysUntilDate } from './procurementDeadlines';
import { formatDateEl, formatDateTimeEl } from './dateFormat';

export const CUSTOM_VISIBILITY_ROLES = [
  { id: 'ADMIN', label: 'Διαχειριστές' },
  { id: 'ENGINEER', label: 'Μηχανικοί' },
  { id: 'USER', label: 'Χρήστες' },
];

function urgencyFromDaysLeft(daysLeft) {
  if (daysLeft == null) return 'normal';
  if (daysLeft < 0) return 'past';
  if (daysLeft <= 7) return 'urgent';
  if (daysLeft <= 30) return 'soon';
  return 'normal';
}

export function userCanSeeCustomEvent(event, user, { adminSeesAll = false } = {}) {
  if (!event || !user) return false;
  const role = String(user.role || '').trim().toUpperCase();
  const username = String(user.username || '').trim().toLowerCase();
  const createdBy = String(event.createdBy || '').trim().toLowerCase();

  if (role === 'SUPERADMIN') return true;
  if (username && createdBy && username === createdBy) return true;
  if (adminSeesAll && role === 'ADMIN') return true;

  const roles = Array.isArray(event.visibilityRoles) ? event.visibilityRoles : [];
  const usernames = Array.isArray(event.visibilityUsernames) ? event.visibilityUsernames : [];
  if (!roles.length && !usernames.length) return true;

  if (username && usernames.map((u) => String(u || '').trim().toLowerCase()).includes(username)) {
    return true;
  }

  const viewerRoles = role === 'SUPERADMIN' ? ['SUPERADMIN', 'ADMIN'] : [role];
  return roles.some((r) => viewerRoles.includes(String(r || '').trim().toUpperCase()));
}

export function canManageCustomEvent(event, user) {
  if (!user) return false;
  const role = String(user.role || '').trim().toUpperCase();
  if (role === 'SUPERADMIN') return true;
  if (role !== 'ADMIN') return false;
  if (!event) return true;
  const createdBy = String(event.createdBy || '').trim().toLowerCase();
  const username = String(user.username || '').trim().toLowerCase();
  return !createdBy || createdBy === username;
}

export function mapCustomEventToCalendarRow(event) {
  if (!event?.id || !event?.dateIso) return null;
  const daysLeft = daysUntilDate(event.dateIso);
  return {
    type: CALENDAR_EVENT_TYPES.CUSTOM,
    customEventId: event.id,
    label: 'Ειδοποίηση ημερολογίου',
    subprojectTitle: event.title || '(Χωρίς τίτλο)',
    projectTitle: '',
    description: event.description || '',
    dateIso: String(event.dateIso),
    dateKey: toDateKey(event.dateIso),
    daysLeft,
    urgency: urgencyFromDaysLeft(daysLeft),
    priority: 'high',
    createdBy: event.createdBy || '',
    createdByFullName: event.createdByFullName || '',
    visibilityRoles: event.visibilityRoles || [],
    visibilityUsernames: event.visibilityUsernames || [],
    isCustom: true,
  };
}

export function buildCustomCalendarEvents(customEvents) {
  return (customEvents || [])
    .map(mapCustomEventToCalendarRow)
    .filter(Boolean);
}

export function mergeCalendarEventLists(...lists) {
  const merged = [];
  lists.forEach((list) => {
    (list || []).forEach((ev) => merged.push(ev));
  });
  merged.sort((a, b) => {
    const da = new Date(a.dateIso).getTime() || 0;
    const db = new Date(b.dateIso).getTime() || 0;
    return da - db
      || (a.subprojectTitle || '').localeCompare(b.subprojectTitle || '', 'el', { sensitivity: 'base' });
  });
  return merged;
}

export function formatCustomEventDateTime(iso) {
  return isDateOnlyCalendarIso(iso) ? formatDateEl(iso) : formatDateTimeEl(iso);
}

export function describeCustomVisibility(event) {
  const roles = (event?.visibilityRoles || []).map((r) => {
    const row = CUSTOM_VISIBILITY_ROLES.find((x) => x.id === r);
    return row?.label || r;
  });
  const users = (event?.visibilityUsernames || []).filter(Boolean);
  if (!roles.length && !users.length) return 'Όλοι οι χρήστες';
  const parts = [];
  if (roles.length) parts.push(roles.join(', '));
  if (users.length) parts.push(users.join(', '));
  return parts.join(' · ');
}

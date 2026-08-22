/** Ειδοποιήσεις ημερολογίου (καταχωρημένες από διαχειριστές) — renderer helpers */

import calendarDeadlines from '../../app/core/calendarDeadlines';
import { isDateOnlyCalendarIso } from './procurementCalendarEvents';
import { formatDateEl, formatDateTimeEl } from './dateFormat';

export const CUSTOM_VISIBILITY_ROLES = [
  { id: 'ADMIN', label: 'Διαχειριστές' },
  { id: 'ENGINEER', label: 'Μηχανικοί' },
  { id: 'USER', label: 'Χρήστες' },
];

export const userCanSeeCustomEvent = calendarDeadlines.userCanSeeCustomEvent;
export const canManageCustomEvent = calendarDeadlines.canManageCustomEvent;
export const canCreateCustomCalendarEvent = calendarDeadlines.canCreateCustomCalendarEvent;
export const collectCustomEventRequiredErrors = calendarDeadlines.collectCustomEventRequiredErrors;
export const isoFromDateAndTime = calendarDeadlines.isoFromDateAndTime;
export const removeCustomEventFromList = calendarDeadlines.removeCustomEventFromList;
export const mapCustomEventToCalendarRow = calendarDeadlines.mapCustomEventToCalendarRow;
export const buildCustomCalendarEvents = calendarDeadlines.buildCustomCalendarEvents;
export const mergeCalendarEventLists = calendarDeadlines.mergeCalendarEventLists;

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

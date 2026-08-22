/** Ειδοποιήσεις & φίλτρα χρονικού παραθύρου για το Ημερολόγιο Προθεσμιών */

import calendarDeadlines from '../../app/core/calendarDeadlines';

export const CALENDAR_TIME_WINDOWS = calendarDeadlines.CALENDAR_TIME_WINDOWS;
export const buildCalendarDeadlineAlerts = calendarDeadlines.buildCalendarDeadlineAlerts;
export const formatCalendarDaysLabel = calendarDeadlines.formatCalendarDaysLabel;

export function getCalendarWindowLabel(days) {
  const row = CALENDAR_TIME_WINDOWS.find((w) => w.days === days);
  return row?.label || `${days} ημέρες`;
}

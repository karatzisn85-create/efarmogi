/**
 * Προθεσμίες λήξης υποβολής προσκλήσεων — ενσωμάτωση στο Ημερολόγιο.
 * Η πηγή είναι το τρέχον πεδίο deadline της πρόσκλησης (ενημερώνεται και από τροποποιήσεις).
 */
import calendarDeadlines from '../../app/core/calendarDeadlines';

export const prosklisiDeadlineToIsoDate = calendarDeadlines.prosklisiDeadlineToIsoDate;
export const mapProsklisiToCalendarRow = calendarDeadlines.mapProsklisiToCalendarRow;
export const buildProsklisiCalendarEvents = calendarDeadlines.buildProsklisiCalendarEvents;

/** Εξαγωγή αναφοράς προθεσμιών ημερολογίου (Excel) */

import * as XLSX from 'xlsx';
import { CALENDAR_EVENT_LABELS, formatEventDateTime, formatDaysLeftLabel } from './procurementCalendarEvents';
import { describeCustomVisibility } from './customCalendarEvents';
import { getCalendarWindowLabel } from './calendarAlerts';

function rowForExport(ev) {
  return {
    Ημερομηνία: formatEventDateTime(ev.dateIso),
    Τύπος: ev.label || CALENDAR_EVENT_LABELS[ev.type] || ev.type,
    Τίτλος: ev.subprojectTitle || '',
    Έργο: ev.projectTitle || '',
    ΑΔΑΜ: ev.adam || '',
    'Ημέρες που απομένουν': ev.daysLeft != null ? formatDaysLeftLabel(ev.daysLeft) : '',
    Περιγραφή: ev.description || ev.complianceSummary || '',
    Ορατότητα: ev.type === 'custom' ? describeCustomVisibility(ev) : '',
    'Δημιουργός': ev.createdByFullName || '',
  };
}

export function exportCalendarEventsToExcel(events, {
  windowDays,
  typeFilterLabel = 'Όλα',
} = {}) {
  const list = Array.isArray(events) ? events : [];
  if (!list.length) return { success: false, error: 'Δεν υπάρχουν εγγραφές για εξαγωγή' };

  const rows = list.map(rowForExport);
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 18 },
    { wch: 28 },
    { wch: 36 },
    { wch: 28 },
    { wch: 16 },
    { wch: 18 },
    { wch: 32 },
    { wch: 22 },
    { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Προθεσμίες');

  const today = new Date();
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const windowPart = windowDays ? getCalendarWindowLabel(windowDays).replace(/\s+/g, '-') : 'ολες';
  const filterPart = typeFilterLabel && typeFilterLabel !== 'Όλα'
    ? `-${String(typeFilterLabel).replace(/\s+/g, '-')}`
    : '';
  const fileName = `προθεσμίες-ημερολογίου-${windowPart}${filterPart}-${stamp}.xlsx`;

  XLSX.writeFile(wb, fileName);
  return { success: true, fileName, count: rows.length };
}

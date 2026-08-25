/** Λήξεις μητρώου αναδόχων — ενσωμάτωση στο ραντάρ / ημερολόγιο προθεσμιών */

import contractorRegistry from '../../app/core/contractorRegistry';
import calendarDeadlines from '../../app/core/calendarDeadlines';
import { buildContractorProfiles } from './contractorFields';

export function buildContractorRadarCalendarEvents({
  projects = [],
  records = [],
  role,
  visibleSubprojectIds = null,
  warnDays,
  urgentDays,
  todayIso,
} = {}) {
  const rows = contractorRegistry.buildContractorHubRows(
    buildContractorProfiles(projects),
    records,
  );
  const items = contractorRegistry.listContractorRadarItems(rows, {
    todayIso,
    warnDays,
    urgentDays,
  });
  const visible = contractorRegistry.filterRadarItemsForViewer(items, {
    role,
    visibleSubprojectIds,
  });
  return calendarDeadlines.buildContractorRadarCalendarEvents(visible);
}

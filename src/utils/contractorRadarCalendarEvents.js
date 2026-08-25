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
  const radarItems = contractorRegistry.listContractorRadarItems(rows, {
    todayIso,
    warnDays,
    urgentDays,
  });
  const visibleRadar = contractorRegistry.filterRadarItemsForViewer(radarItems, {
    role,
    visibleSubprojectIds,
  });

  const allExpiryItems = contractorRegistry.listAllGuaranteeExpiryItems(rows);
  const visibleExpiry = contractorRegistry.filterRadarItemsForViewer(allExpiryItems, {
    role,
    visibleSubprojectIds,
  });
  const expiryEvents = calendarDeadlines.buildGuaranteeExpiryCalendarEvents(visibleExpiry);

  const expiryKeys = new Set(visibleExpiry.map((i) => `${i.guaranteeId}|${i.dateIso}`));
  const acceptanceRadar = visibleRadar.filter(
    (item) => item.kind !== 'guarantee' || !expiryKeys.has(`${item.guaranteeId}|${item.dateIso}`)
  );
  const radarEvents = calendarDeadlines.buildContractorRadarCalendarEvents(acceptanceRadar);

  return calendarDeadlines.mergeCalendarEventLists(radarEvents, expiryEvents);
}

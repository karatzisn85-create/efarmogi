import React, { useMemo } from 'react';
import KhmdhsPanelDisplay from './KhmdhsPanelDisplay';
import {
  buildKhmdhsRequestCardSummary,
  buildKhmdhsRequestDisplayGroups,
  pickKhmdhsRequestSnapshot,
  projectHasKhmdhsRequestData,
} from '../utils/khmdhsRequestFields';
import { formatDateTimeEl } from '../utils/dateFormat';

function formatFetchedAt(fetchedAt) {
  if (!fetchedAt) return '';
  return formatDateTimeEl(fetchedAt, '') || fetchedAt;
}

/**
 * @param {{ project: object, variant?: 'detail'|'card', defaultExpanded?: boolean, extraRequestAdams?: string[] }} props
 */
export default function KhmdhsRequestDisplay({
  project,
  variant = 'detail',
  defaultExpanded = false,
  extraRequestAdams = [],
}) {
  const snapshot = useMemo(
    () => pickKhmdhsRequestSnapshot(project?.khmdhsRequestSnapshot),
    [project?.khmdhsRequestSnapshot]
  );
  const groups = useMemo(() => buildKhmdhsRequestDisplayGroups(snapshot), [snapshot]);
  const summary = useMemo(() => buildKhmdhsRequestCardSummary(snapshot), [snapshot]);

  if (!projectHasKhmdhsRequestData(project) || !snapshot) return null;

  const adam = String(project.khmdhsRequestAdam || snapshot.referenceNumber || '').trim();
  const extraAdams = (Array.isArray(extraRequestAdams) ? extraRequestAdams : [])
    .map((value) => String(value || '').trim().toUpperCase())
    .filter((value) => value && value !== String(adam).trim().toUpperCase());
  const uniqueExtra = [...new Set(extraAdams)];
  const groupsWithLinked = uniqueExtra.length
    ? [
      ...groups,
      {
        id: 'linked-requests',
        title: 'Άλλα πρωτογενή του ίδιου υποέργου',
        icon: '🔗',
        rows: uniqueExtra.map((value) => ({ label: 'ΑΔΑΜ', value, badge: true })),
      },
    ]
    : groups;
  const fetchedLabel = formatFetchedAt(project.khmdhsRequestFetchedAt);
  const subtitle = fetchedLabel ? `Τελευταία λήψη: ${fetchedLabel}` : '';

  const summaryChips = [];
  if (summary?.amount) {
    summaryChips.push({ label: 'Προϋπολογισμός', value: summary.amount, strong: true, highlight: true });
  }
  if (summary?.contractType) {
    summaryChips.push({ label: 'Είδος', value: summary.contractType });
  }
  if (summary?.status) {
    summaryChips.push({ label: 'Κατάσταση', value: summary.status });
  }
  if (summary?.cancelled) {
    summaryChips.push({ label: 'Κατάσταση', value: 'Ματαιωμένο', warn: true });
  }

  return (
    <KhmdhsPanelDisplay
      themeKey="request"
      title="📋 Πρωτογενές αίτημα (ΚΗΜΔΗΣ)"
      adam={adam}
      subtitle={variant === 'detail' ? subtitle : undefined}
      cardSubtitle={summary?.title || ''}
      groups={groupsWithLinked}
      summaryChips={summaryChips}
      variant={variant}
      defaultExpanded={defaultExpanded}
    />
  );
}

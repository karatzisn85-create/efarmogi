import React, { useMemo } from 'react';
import KhmdhsPanelDisplay from './KhmdhsPanelDisplay';
import {
  buildKhmdhsAwardCardSummary,
  buildKhmdhsAwardDisplayGroups,
  isLegacyKhmdhsAwardSnapshot,
  pickKhmdhsAwardSnapshot,
  projectHasKhmdhsAwardData,
} from '../utils/khmdhsAwardFields';
import { formatDateTimeEl } from '../utils/dateFormat';

function formatFetchedAt(fetchedAt) {
  if (!fetchedAt) return '';
  return formatDateTimeEl(fetchedAt, '') || fetchedAt;
}

/**
 * @param {{ project: object, variant?: 'detail'|'card', defaultExpanded?: boolean }} props
 */
export default function KhmdhsAwardDisplay({
  project,
  variant = 'detail',
  defaultExpanded = false,
}) {
  const snapshot = useMemo(
    () => pickKhmdhsAwardSnapshot(project?.khmdhsAwardSnapshot),
    [project?.khmdhsAwardSnapshot]
  );
  const groups = useMemo(() => buildKhmdhsAwardDisplayGroups(snapshot), [snapshot]);
  const summary = useMemo(() => buildKhmdhsAwardCardSummary(snapshot), [snapshot]);
  const legacySnapshot = useMemo(() => isLegacyKhmdhsAwardSnapshot(snapshot), [snapshot]);

  if (!projectHasKhmdhsAwardData(project) || !snapshot) return null;

  const adam = String(project.khmdhsAwardAdam || snapshot.referenceNumber || '').trim();
  const fetchedLabel = formatFetchedAt(project.khmdhsAwardFetchedAt);
  const subtitleParts = [
    legacySnapshot ? 'Παλιό snapshot — κάντε ξανά ανάκτηση ΚΗΜΔΗΣ για πλήρη στοιχεία' : '',
    fetchedLabel ? `Τελευταία λήψη: ${fetchedLabel}` : '',
  ].filter(Boolean);
  const subtitle = subtitleParts.join(' · ');

  const summaryChips = [];
  if (summary?.contractor) {
    summaryChips.push({ label: 'Ανάδοχος', value: summary.contractor });
  }
  if (summary?.amount) {
    summaryChips.push({ label: 'Αξία', value: summary.amount, strong: true, highlight: true });
  }
  if (summary?.awardDate) {
    summaryChips.push({ label: 'Ημ. ανάθεσης', value: summary.awardDate, strong: true });
  }
  if (snapshot.noticeReferenceNumber || (snapshot.noticeRefNos && snapshot.noticeRefNos[0])) {
    summaryChips.push({
      label: 'ΑΔΑΜ δημοσίευσης',
      value: snapshot.noticeReferenceNumber || snapshot.noticeRefNos[0],
    });
  }
  if (summary?.cancelled) {
    summaryChips.push({ label: 'Κατάσταση', value: 'Ματαιωμένη', warn: true });
  }

  return (
    <KhmdhsPanelDisplay
      themeKey="award"
      title="🏆 Ανάθεση (ΚΗΜΔΗΣ)"
      adam={adam}
      subtitle={variant === 'detail' ? subtitle : undefined}
      cardSubtitle={snapshot.title || ''}
      groups={groups}
      summaryChips={summaryChips}
      variant={variant}
      defaultExpanded={defaultExpanded}
    />
  );
}

import React, { useMemo } from 'react';
import KhmdhsPanelDisplay from './KhmdhsPanelDisplay';
import {
  buildKhmdhsCommitmentCardSummary,
  buildKhmdhsCommitmentDisplayGroups,
  collectKhmdhsCommitmentDecisions,
  pickKhmdhsCommitmentSnapshot,
} from '../utils/khmdhsChainExtraFields';
import { formatDateTimeEl } from '../utils/dateFormat';

function formatFetchedAt(fetchedAt) {
  if (!fetchedAt) return '';
  return formatDateTimeEl(fetchedAt, '') || fetchedAt;
}

function CommitmentPanel({ adam, snapshot, fetchedAt, index, variant, defaultExpanded }) {
  const snap = useMemo(() => pickKhmdhsCommitmentSnapshot(snapshot), [snapshot]);
  const groups = useMemo(() => buildKhmdhsCommitmentDisplayGroups(snap), [snap]);
  const summary = useMemo(() => buildKhmdhsCommitmentCardSummary(snap), [snap]);

  if (!snap) return null;

  const fetchedLabel = formatFetchedAt(fetchedAt);
  const subtitle = fetchedLabel ? `Τελευταία λήψη: ${fetchedLabel}` : '';
  const titleSuffix = index > 0 ? ` (${index + 1})` : '';

  const summaryChips = [];
  if (summary?.amount) {
    summaryChips.push({ label: 'Ποσό', value: summary.amount, strong: true, highlight: true });
  }
  if (summary?.contractType) {
    summaryChips.push({ label: 'Είδος', value: summary.contractType });
  }
  if (summary?.cancelled) {
    summaryChips.push({ label: 'Κατάσταση', value: 'Ματαιωμένο', warn: true });
  }

  return (
    <KhmdhsPanelDisplay
      themeKey="commitment"
      title={`🧾 Απόφαση ανάληψης υποχρέωσης (ΚΗΜΔΗΣ)${titleSuffix}`}
      adam={adam}
      subtitle={variant === 'detail' ? subtitle : undefined}
      cardSubtitle={summary?.title || ''}
      groups={groups}
      summaryChips={summaryChips}
      variant={variant}
      defaultExpanded={defaultExpanded}
    />
  );
}

/**
 * @param {{ project: object, variant?: 'detail'|'card', defaultExpanded?: boolean }} props
 */
export default function KhmdhsCommitmentDisplay({
  project,
  variant = 'detail',
  defaultExpanded = false,
}) {
  const decisions = useMemo(
    () => collectKhmdhsCommitmentDecisions(project),
    [project]
  );

  if (decisions.length === 0) return null;

  return (
    <>
      {decisions.map((d, i) => (
        <CommitmentPanel
          key={d.adam || i}
          adam={String(d.adam || d.snapshot?.referenceNumber || '').trim()}
          snapshot={d.snapshot}
          fetchedAt={d.fetchedAt}
          index={i}
          variant={variant}
          defaultExpanded={defaultExpanded && i === 0}
        />
      ))}
    </>
  );
}

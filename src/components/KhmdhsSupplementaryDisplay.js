import React, { useMemo } from 'react';
import KhmdhsPanelDisplay from './KhmdhsPanelDisplay';
import {
  buildKhmdhsSupplementaryCardSummary,
  buildKhmdhsSupplementaryDisplayGroups,
  buildSupplementaryStageTitle,
} from '../utils/khmdhsSupplementaryStageEntries';

/**
 * @param {{ entry: object, variant?: 'detail'|'card', defaultExpanded?: boolean }} props
 */
export default function KhmdhsSupplementaryDisplay({
  entry,
  variant = 'detail',
  defaultExpanded = false,
}) {
  const groups = useMemo(
    () => buildKhmdhsSupplementaryDisplayGroups(entry),
    [entry]
  );

  const summary = useMemo(
    () => buildKhmdhsSupplementaryCardSummary(entry),
    [entry]
  );

  if (!entry || (!entry.adam && !groups.length)) return null;

  const summaryChips = [];
  if (entry.contractor) {
    summaryChips.push({ label: 'Ανάδοχος', value: entry.contractor });
  }
  if (entry.amount) {
    summaryChips.push({ label: 'Διαφορά', value: `${entry.amount} €`, strong: true, highlight: true });
  } else if (entry.rawAmount) {
    summaryChips.push({ label: 'Ποσό', value: `${entry.rawAmount} €`, strong: true });
  }
  if (entry.signedDateDisplay) {
    summaryChips.push({
      label: entry.isExtension ? 'Καταληκτική ημ.' : 'Ημερομηνία',
      value: entry.signedDateDisplay,
    });
  }

  const title = buildSupplementaryStageTitle(entry);

  return (
    <KhmdhsPanelDisplay
      title={title}
      subtitle={entry.adam || ''}
      adam={entry.adam}
      groups={groups}
      summaryChips={summaryChips}
      summaryLine={summary}
      themeKey="supplementary"
      variant={variant}
      defaultExpanded={defaultExpanded}
    />
  );
}

import React, { useMemo } from 'react';
import KhmdhsPanelDisplay from './KhmdhsPanelDisplay';
import {
  buildKhmdhsAmendmentsDisplayGroup,
  buildKhmdhsContractCardSummary,
  buildKhmdhsContractChainHistoryGroup,
  buildKhmdhsContractDisplayGroups,
  pickKhmdhsContractSnapshot,
} from '../utils/khmdhsContractDisplayFields';
import { formatDateEl } from '../utils/dateFormat';
import { formatApeAmountDisplay } from '../utils/khmdhsApeEntry';

function formatFetchedAt(fetchedAt) {
  if (!fetchedAt) return '';
  return formatDateEl(fetchedAt, '') || fetchedAt;
}

/**
 * @param {{
 *   entry: { contractIndex?: number|null, adam?: string, snapshot?: object, fetchedAt?: string, amendments?: Array, chainHistory?: Array, roleLabel?: string },
 *   variant?: 'detail'|'card',
 *   defaultExpanded?: boolean,
 * }} props
 */
export default function KhmdhsContractDetailDisplay({
  entry,
  variant = 'detail',
  defaultExpanded = false,
  apeAmount = '',
  khmdhsAmount = '',
  apeFileName = '',
  symvChainPlan = null,
}) {
  const snapshot = useMemo(
    () => pickKhmdhsContractSnapshot(entry?.snapshot),
    [entry?.snapshot]
  );

  const groups = useMemo(() => {
    const displayOpts = { storedAmount: entry?.storedAmount || '', symvChainPlan };
    const base = buildKhmdhsContractDisplayGroups(snapshot, displayOpts);
    const chainGroup = buildKhmdhsContractChainHistoryGroup(entry?.chainHistory);
    const amendGroup = chainGroup
      ? null
      : buildKhmdhsAmendmentsDisplayGroup(entry?.amendments);
    return [...base, chainGroup, amendGroup].filter(Boolean);
  }, [snapshot, entry?.chainHistory, entry?.amendments, entry?.storedAmount, symvChainPlan]);

  const summary = useMemo(
    () => buildKhmdhsContractCardSummary(snapshot, { storedAmount: entry?.storedAmount || '' }),
    [snapshot, entry?.storedAmount]
  );

  const adam = String(entry?.adam || snapshot?.referenceNumber || '').trim();
  if (!adam && !snapshot) return null;

  const contractLabel = entry?.contractIndex != null ? `Σύμβαση ${entry.contractIndex}` : 'Σύμβαση';
  const fetchedLabel = formatFetchedAt(entry?.fetchedAt);
  const roleLabel = String(entry?.roleLabel || '').trim();
  const subtitle = [
    contractLabel !== 'Σύμβαση' ? contractLabel : '',
    roleLabel,
    fetchedLabel ? `Τελευταία λήψη: ${fetchedLabel}` : '',
  ].filter(Boolean).join(' · ');

  const summaryChips = [];
  if (summary?.contractor) {
    summaryChips.push({ label: 'Ανάδοχος', value: summary.contractor });
  }
  const apeFmt = formatApeAmountDisplay(apeAmount);
  const khmdhsFmt = formatApeAmountDisplay(khmdhsAmount || summary?.amount || '');
  if (apeFmt) {
    if (khmdhsFmt) {
      summaryChips.push({ label: 'Ποσό ΚΗΜΔΗΣ', value: `${khmdhsFmt} €` });
    }
    summaryChips.push({
      label: 'ΑΠΕ (τελικό)',
      value: `${apeFmt} €`,
      strong: true,
      highlight: true,
    });
  } else if (summary?.amount || khmdhsFmt) {
    summaryChips.push({
      label: 'Ποσό',
      value: summary?.amount || `${khmdhsFmt} €`,
      strong: true,
      highlight: true,
    });
  }
  if (summary?.signedDate) {
    summaryChips.push({ label: 'Υπογραφή', value: summary.signedDate });
  }
  if (String(apeFileName || '').trim()) {
    summaryChips.push({ label: 'Αρχείο ΑΠΕ', value: apeFileName, strong: true });
  }
  if (summary?.cancelled) {
    summaryChips.push({ label: 'Κατάσταση', value: 'Ματαιωμένη', warn: true });
  }
  if (buildKhmdhsContractChainHistoryGroup(entry?.chainHistory)) {
    const chainLen = (entry?.chainHistory || []).filter((h) => h?.adam).length;
    summaryChips.push({
      label: 'Αλυσίδα',
      value: String(chainLen),
      strong: true,
    });
  } else if (Array.isArray(entry?.amendments) && entry.amendments.length) {
    summaryChips.push({
      label: 'Τροποποιήσεις',
      value: String(entry.amendments.length),
      strong: true,
    });
  }

  return (
    <KhmdhsPanelDisplay
      themeKey="contract"
      title={`📄 ${contractLabel} — ΚΗΜΔΗΣ`}
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

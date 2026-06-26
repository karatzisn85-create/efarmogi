/**
 * Επιλογές χαρακτηρισμού πράξεων αλυσίδας — UI (renderer).
 * Αν τα στοιχεία review από δίσκο/API δεν έχουν kindOptions, συμπληρώνονται εδώ.
 */

import { formatDateEl, parseAppDate } from './dateFormat';
import { CHAIN_KIND_LABEL } from './khmdhsChainActions';
import { normalizeKhmdhsAdam } from './khmdhsDataQualityReport';
import { getChainHistoryForContract, findChainEntry } from './khmdhsChainFormAccess';
import { isMultipleContractsForm } from './khmdhsFields';

export const USER_CHAIN_KIND_SELECT_VALUES = [
  'modification',
  'extension',
  'republication',
  'other',
];

export function buildChainKindSelectOptions() {
  return USER_CHAIN_KIND_SELECT_VALUES.map((value) => ({
    value,
    label: (CHAIN_KIND_LABEL[value] || value).replace(/^./, (c) => c.toUpperCase()),
  }));
}

function toIsoDateOnly(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = parseAppDate(s);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildChainPeerSelectOptions(chainHistory, currentAdam) {
  const normCurrent = normalizeKhmdhsAdam(currentAdam);
  return (chainHistory || [])
    .filter((p) => p?.adam && normalizeKhmdhsAdam(p.adam) !== normCurrent)
    .map((p) => {
      const dateRaw = p.contractDate || p.endDate || '';
      const date = dateRaw ? formatDateEl(dateRaw) : '';
      const baseLabel = p.isRoot
        ? 'Αρχική σύμβαση'
        : (p.label || CHAIN_KIND_LABEL[p.kind] || 'πράξη');
      return {
        value: p.adam,
        label: [baseLabel, p.adam, date].filter(Boolean).join(' · '),
        isRoot: !!p.isRoot,
      };
    });
}

/** Συμπληρώνει kindOptions / peerOptions σε παλιά ή ελλιπή review items */
export function enrichChainKindReviewItem(item, formData) {
  if (!item || item.fieldId !== 'chainKindReview') return item;

  const adam = item.chainAdam;
  let history = [];
  if (item.contractIndex != null) {
    history = getChainHistoryForContract(formData, item.contractIndex);
  } else if (adam && isMultipleContractsForm(formData?.implementationForm)) {
    const { contractIndex: foundIdx } = findChainEntry(formData, adam);
    history = foundIdx != null ? getChainHistoryForContract(formData, foundIdx) : [];
  } else {
    history = getChainHistoryForContract(formData, null);
  }
  const entry = history.find(
    (h) => h?.adam && normalizeKhmdhsAdam(h.adam) === normalizeKhmdhsAdam(adam)
  );

  return {
    ...item,
    kindOptions: Array.isArray(item.kindOptions) && item.kindOptions.length
      ? item.kindOptions
      : buildChainKindSelectOptions(),
    peerOptions: Array.isArray(item.peerOptions) && item.peerOptions.length
      ? item.peerOptions
      : buildChainPeerSelectOptions(history, adam),
    defaultCorrectsAdam: item.defaultCorrectsAdam || entry?.prevAdam || null,
    endDateIso: item.endDateIso || toIsoDateOnly(entry?.endDate),
    hasAmount: item.hasAmount ?? !!(
      entry?.contractAmount && String(entry.contractAmount).trim()
    ),
    hasKhmdhsDate: item.hasKhmdhsDate ?? !!(entry?.contractDate && String(entry.contractDate).trim()),
    contractAmountDisplay: item.contractAmountDisplay || entry?.contractAmount || '',
    contractDateIso: item.contractDateIso || toIsoDateOnly(entry?.contractDate),
    title: item.title || entry?.snapshot?.title || entry?.title || '',
  };
}

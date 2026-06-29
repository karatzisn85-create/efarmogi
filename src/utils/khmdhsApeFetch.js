/**
 * Εξαγωγή υποψήφιου ποσού ΑΠΕ από snapshot σύμβασης ΚΗΜΔΗΣ.
 */

import { parseGreekAmountString } from './khmdhsFields';
import { formatApeAmountDisplay } from './khmdhsApeEntry';
import { formatDateEl, toIsoDateOnly } from './dateFormat';

function formatSnapshotAmount(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const n = parseGreekAmountString(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isKhmdhsContractAmendmentSnapshot(snapshot) {
  if (!snapshot) return false;
  return !!(
    String(snapshot.prevReferenceNo || '').trim()
    || snapshot.nextModified === true
    || snapshot.nextExtended === true
  );
}

/** Ημερομηνία εγγράφου ΑΠΕ από snapshot σύμβασης ΚΗΜΔΗΣ (ISO date-only). */
export function resolveKhmdhsApeDocumentDateFromSnapshot(snapshot) {
  if (!snapshot) return '';
  const amendment = isKhmdhsContractAmendmentSnapshot(snapshot);
  const candidates = amendment
    ? [
      snapshot.submissionDate,
      snapshot.lastUpdateDate,
      snapshot.contractSignedDate,
      snapshot.startDate,
      snapshot.signedDate,
      snapshot.signDate,
      snapshot.contractDate,
    ]
    : [
      snapshot.contractSignedDate,
      snapshot.startDate,
      snapshot.signedDate,
      snapshot.signDate,
      snapshot.contractDate,
      snapshot.submissionDate,
      snapshot.lastUpdateDate,
    ];
  for (const raw of candidates) {
    const iso = toIsoDateOnly(raw);
    if (iso) return iso;
  }
  return '';
}

/**
 * @param {object|null} snapshot
 * @param {string} [adam]
 * @returns {{ adam: string, title: string, amount: string, amountDisplay: string, signedDate: string, signedDateDisplay: string }}
 */
export function buildApeFetchPreview(snapshot, adam = '') {
  if (!snapshot) {
    return {
      adam: String(adam || '').trim(),
      title: '',
      amount: '',
      amountDisplay: '',
      signedDate: '',
      signedDateDisplay: '',
    };
  }
  const rawAmount = snapshot.totalCostWithVAT ?? snapshot.totalCost ?? snapshot.contractAmount ?? '';
  const amount = formatSnapshotAmount(rawAmount);
  const signedDate = resolveKhmdhsApeDocumentDateFromSnapshot(snapshot);
  return {
    adam: String(adam || snapshot.referenceNumber || '').trim(),
    title: String(snapshot.title || '').trim(),
    amount,
    amountDisplay: formatApeAmountDisplay(amount) || amount,
    signedDate,
    signedDateDisplay: formatDateEl(signedDate, ''),
  };
}

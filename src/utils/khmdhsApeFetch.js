/**
 * Εξαγωγή υποψήφιου ποσού ΑΠΕ από snapshot σύμβασης ΚΗΜΔΗΣ.
 */

import { parseGreekAmountString } from './khmdhsFields';
import { formatApeAmountDisplay } from './khmdhsApeEntry';
import { formatDateEl } from './dateFormat';

function formatSnapshotAmount(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const n = parseGreekAmountString(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const signedDate = String(
    snapshot.signedDate || snapshot.signDate || snapshot.contractDate || ''
  ).slice(0, 10);
  return {
    adam: String(adam || snapshot.referenceNumber || '').trim(),
    title: String(snapshot.title || '').trim(),
    amount,
    amountDisplay: formatApeAmountDisplay(amount) || amount,
    signedDate,
    signedDateDisplay: formatDateEl(signedDate, ''),
  };
}

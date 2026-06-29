/**
 * Μορφοποίηση / κανονικοποίηση ποσών έργου — αποφυγή λάθος κλίμακας (×100).
 */

import { parseGreekAmountString } from './khmdhsFields';
import { normalizeSuspiciousKhmdhsGross } from './khmdhsSupplementaryAmountLogic';
import { grossFromCostSnapshot } from './khmdhsVatHelper';

/** Αξιόπιστο ποσό αναφοράς (ανάθεση → δημοσίευση) για έλεγχο κλίμακας. */
export function getKhmdhsAmountSanityReference(project) {
  if (!project) return 0;
  const awardGross = grossFromCostSnapshot(project.khmdhsAwardSnapshot);
  if (Number.isFinite(awardGross) && awardGross > 0) return awardGross;
  const noticeGross = grossFromCostSnapshot(project.khmdhsNoticeSnapshot);
  if (Number.isFinite(noticeGross) && noticeGross > 0) return noticeGross;
  return 0;
}

export function resolveProjectAmountNumeric(value, sanityReference = 0) {
  let n = parseGreekAmountString(value);
  const ref = typeof sanityReference === 'number'
    ? sanityReference
    : parseGreekAmountString(sanityReference);
  if (ref > 0) {
    n = normalizeSuspiciousKhmdhsGross(n, ref);
  }
  return Number.isFinite(n) ? n : 0;
}

export function formatProjectAmountDisplay(value, sanityReference = 0) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const n = resolveProjectAmountNumeric(raw, sanityReference);
  if (!Number.isFinite(n) || n <= 0) return raw;
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Ελληνική μορφή για αποθήκευση — με διόρθωση κλίμακας όταν υπάρχει αναφορά. */
export function normalizeProjectAmountForStorage(value, sanityReference = 0) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const n = resolveProjectAmountNumeric(raw, sanityReference);
  if (!Number.isFinite(n) || n < 0) return raw;
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

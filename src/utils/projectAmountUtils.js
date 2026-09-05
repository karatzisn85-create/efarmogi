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

/**
 * Εμφάνιση ποσού σε αναφορές/PDF.
 * «162.000» (χιλιάδες χωρίς λεπτά) δεν διαβάζεται ως 162,00.
 */
export function formatEuroAmountLabel(value) {
  if (value == null || value === '') return '—';
  const raw = String(value).trim();
  if (!raw || raw === '—') return '—';
  if (!/\d/.test(raw)) return raw;
  const n = parseGreekAmountString(raw);
  if (!Number.isFinite(n)) return raw;
  return `${n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/**
 * Κανονικοποίηση ποσού όταν φεύγει το πεδίο (φόρμα υποέργου).
 * Μία τελεία με 3 ψηφία μετά είναι χιλιάδες («162.000» → 162.000,00), όχι δεκαδικό.
 */
export function formatTypedAmountOnBlur(value) {
  if (!value) return '';

  const hasMinusAtStart = String(value).trim().startsWith('-');
  let cleaned = String(value).replace(/[^\d,.]/g, '');
  if (!/\d/.test(cleaned)) return '';

  let integerPart = '';
  let decimalPart = '';

  if (cleaned.includes('.') && cleaned.includes(',')) {
    if (cleaned.indexOf(',') < cleaned.lastIndexOf('.')) {
      const parts = cleaned.split('.');
      integerPart = parts[0].replace(/,/g, '');
      decimalPart = parts[parts.length - 1].slice(0, 2);
    } else {
      const parts = cleaned.split(',');
      integerPart = parts[0].replace(/\./g, '');
      decimalPart = parts[parts.length - 1].slice(0, 2);
    }
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    integerPart = parts[0];
    decimalPart = parts[1] ? parts[1].slice(0, 2) : '';
  } else if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    if (parts.length === 2 && parts[1].length <= 2) {
      integerPart = parts[0];
      decimalPart = parts[1].slice(0, 2);
    } else {
      integerPart = cleaned.replace(/\./g, '');
    }
  } else {
    integerPart = cleaned;
  }

  integerPart = String(integerPart || '').replace(/[^\d]/g, '');

  let formattedInteger = '';
  if (integerPart.length > 3) {
    for (let i = integerPart.length - 1, count = 0; i >= 0; i--, count++) {
      if (count > 0 && count % 3 === 0) {
        formattedInteger = `.${formattedInteger}`;
      }
      formattedInteger = integerPart[i] + formattedInteger;
    }
  } else {
    formattedInteger = integerPart;
  }

  if (!decimalPart) decimalPart = '00';
  else if (decimalPart.length === 1) decimalPart += '0';

  let result = `${formattedInteger},${decimalPart}`;
  if (hasMinusAtStart) result = `-${result}`;
  return result;
}

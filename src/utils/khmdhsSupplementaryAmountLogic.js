/**
 * Λογική ποσών συμπληρωματικών — αποφυγή λάθος αυτόματης συμπλήρωσης από ΚΗΜΔΗΣ.
 */

import { parseGreekAmountString } from './khmdhsFields';
import { grossFromContractRecord } from './khmdhsVatHelper';

const MOD_AMOUNT_TYPE = {
  DELTA: 'delta',
  TOTAL: 'total',
};

const MAX_ABSOLUTE_EUROS = 50_000_000;
const MAX_DELTA_VS_BASE_RATIO = 3;

/** Είναι λογική η διαφορά ως προς το τρέχον σύνολο; */
export function isPlausibleSupplementaryDelta(delta, runningTotal) {
  const d = Number(delta);
  if (!Number.isFinite(d) || d <= 0) return false;
  if (d > MAX_ABSOLUTE_EUROS) return false;
  if (runningTotal > 0 && d > runningTotal * MAX_DELTA_VS_BASE_RATIO) return false;
  return true;
}

/**
 * Διόρθωση κλιμάκωσης (π.χ. 100×) όταν το ΚΗΜΔΗΣ επιστρέφει λάθος κλίμακα.
 */
export function normalizeSuspiciousKhmdhsGross(amount, runningTotal) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (!runningTotal || runningTotal <= 0) return n;
  if (n <= runningTotal * MAX_DELTA_VS_BASE_RATIO) return n;

  const scaled = n / 100;
  if (scaled > runningTotal * 0.05 && scaled <= runningTotal * MAX_DELTA_VS_BASE_RATIO) {
    return scaled;
  }
  return n;
}

function grossFromChainEntry(h, runningTotal) {
  if (!h) return 0;
  const fromSnap = grossFromContractRecord(h.snapshot);
  if (fromSnap != null && Number.isFinite(fromSnap) && fromSnap > 0) {
    return normalizeSuspiciousKhmdhsGross(fromSnap, runningTotal);
  }
  return normalizeSuspiciousKhmdhsGross(parseGreekAmountString(h.contractAmount), runningTotal);
}

/**
 * Υπολογίζει ποσό συμπληρωματικής από χαρακτηρισμό + αλυσίδα.
 * @returns {{ delta: number, amountType: string, rawAmount: number, commentSuffix: string }}
 */
export function resolveModificationSupplementaryAmount(h, choice, runningTotal, corrections) {
  const corrected = corrections?.get?.(h.adam);
  const fromUser = parseGreekAmountString(choice?.modAmount);
  let amountType = choice?.modAmountType || null;
  let rawAmount = 0;
  let commentSuffix = '';

  if (fromUser > 0) {
    rawAmount = fromUser;
    amountType = amountType || MOD_AMOUNT_TYPE.DELTA;
  } else if (corrected?.amount != null && corrected.amount > 0) {
    rawAmount = corrected.amount;
    amountType = amountType || MOD_AMOUNT_TYPE.DELTA;
  } else {
    const fromKhmdhs = normalizeSuspiciousKhmdhsGross(
      parseGreekAmountString(h.contractAmount),
      runningTotal
    );
    const fromSnap = grossFromChainEntry(h, runningTotal);
    const candidateTotal = Math.max(fromSnap, fromKhmdhs);

    if (candidateTotal > 0 && runningTotal > 0 && candidateTotal > runningTotal) {
      rawAmount = candidateTotal;
      amountType = amountType || MOD_AMOUNT_TYPE.TOTAL;
    } else if (fromKhmdhs > 0 && fromKhmdhs <= runningTotal) {
      rawAmount = fromKhmdhs;
      amountType = amountType || MOD_AMOUNT_TYPE.DELTA;
    }
  }

  if (!amountType) amountType = MOD_AMOUNT_TYPE.DELTA;

  let delta = rawAmount;
  if (amountType === MOD_AMOUNT_TYPE.TOTAL && rawAmount > 0 && runningTotal > 0) {
    delta = rawAmount - runningTotal;
    commentSuffix = ` · νέα συνολική αξία: ${rawAmount.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  }

  if (!isPlausibleSupplementaryDelta(delta, runningTotal)) {
    return {
      delta: 0,
      amountType: choice?.modAmountType || MOD_AMOUNT_TYPE.DELTA,
      rawAmount: 0,
      commentSuffix: '',
    };
  }

  return { delta, amountType, rawAmount, commentSuffix };
}

/** Προεπιλογή ποσού στη φόρμα συμπληρωματικής — όχι απίθανα μεγάλα ποσά. */
export function prefillSupplementaryModAmount(existingModAmount, enrichedItem, runningTotal = 0) {
  if (String(existingModAmount || '').trim()) return existingModAmount;
  const parsed = normalizeSuspiciousKhmdhsGross(
    parseGreekAmountString(enrichedItem?.contractAmountDisplay || ''),
    runningTotal
  );
  if (!parsed) return '';

  const formatEl = (n) => n.toLocaleString('el-GR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (runningTotal > 0) {
    if (parsed > runningTotal) {
      const delta = parsed - runningTotal;
      if (isPlausibleSupplementaryDelta(delta, runningTotal)) return formatEl(delta);
      return '';
    }
    if (!isPlausibleSupplementaryDelta(parsed, runningTotal)) return '';
    return formatEl(parsed);
  }

  if (parsed > MAX_ABSOLUTE_EUROS) return '';
  return formatEl(parsed);
}

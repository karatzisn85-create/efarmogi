/**
 * Λογική ποσών συμπληρωματικών — αποφυγή λάθος αυτόματης συμπλήρωσης από ΚΗΜΔΗΣ.
 */

import { isMultipleContractsForm, parseGreekAmountString } from './khmdhsFields';
import { grossFromContractRecord } from './khmdhsVatHelper';
import { chainKindReviewResolutionKey } from './khmdhsDataQualityReport';
import { SYMV_CHAIN_ROLE } from './khmdhsSymvChainPlanner';

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

function isExtensionSupplementaryRow(row, project) {
  if (!row) return false;
  if (row.chainKind === 'extension') return true;
  const comment = String(row.comments || '').trim();
  if (comment === 'Παράταση') return true;
  const adam = String(row.khmdhsAdam || '').trim().toUpperCase();
  if (!adam) return false;
  const planItem = (project?.khmdhsSymvChainPlan?.items || []).find(
    (i) => String(i?.adam || '').trim().toUpperCase() === adam
  );
  return planItem?.role === SYMV_CHAIN_ROLE.EXTENSION;
}

function readSupplementaryAmountType(row, project) {
  if (row?.amountType) return row.amountType;
  const adam = String(row?.khmdhsAdam || '').trim().toUpperCase();
  if (!adam || !project?.khmdhsDataQualityReview?.resolutions) return null;
  const key = chainKindReviewResolutionKey(adam);
  return project.khmdhsDataQualityReview.resolutions[key]?.meta?.modAmountType || null;
}

function sortSupplementaryRows(rows = []) {
  return [...rows].sort((a, b) => {
    const da = String(a?.date || '').slice(0, 10) || '9999';
    const db = String(b?.date || '').slice(0, 10) || '9999';
    return da.localeCompare(db);
  });
}

function resolveSupplementaryContribution(row, project, runningTotal) {
  const raw = String(row?.amount || '').trim();
  if (!raw) return 0;

  let amount = normalizeSuspiciousKhmdhsGross(parseGreekAmountString(raw), runningTotal);
  if (!amount || amount <= 0) return 0;

  const amountType = readSupplementaryAmountType(row, project) || MOD_AMOUNT_TYPE.DELTA;
  let delta = amount;

  if (amountType === MOD_AMOUNT_TYPE.TOTAL && runningTotal > 0) {
    delta = amount - runningTotal;
  } else if (runningTotal > 0 && amount > runningTotal * 1.02) {
    const asTotalDelta = amount - runningTotal;
    if (isPlausibleSupplementaryDelta(asTotalDelta, runningTotal)) {
      delta = asTotalDelta;
    } else if (!isPlausibleSupplementaryDelta(amount, runningTotal)) {
      return 0;
    }
  }

  if (!isPlausibleSupplementaryDelta(delta, runningTotal)) return 0;
  return delta;
}

/**
 * Τρέχον συνολικό ποσό σύμβασης (αρχική + νόμιμες συμπληρωματικές, όχι παρατάσεις).
 * Αποφεύγει διπλομέτρηση όταν τα ποσά από ΚΗΜΔΗΣ/SYMV είναι «νέα συνολική αξία».
 */
export function computeProjectContractTotal(project) {
  if (!project) return 0;

  let running = 0;
  if (isMultipleContractsForm(project.implementationForm)) {
    (project.contracts || []).forEach((c) => {
      running += parseGreekAmountString(c?.amount);
    });
  } else {
    running += parseGreekAmountString(project.contractAmount);
  }

  sortSupplementaryRows(project.supplementaryContracts || []).forEach((row) => {
    if (isExtensionSupplementaryRow(row, project)) return;
    running += resolveSupplementaryContribution(row, project, running);
  });

  return running;
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

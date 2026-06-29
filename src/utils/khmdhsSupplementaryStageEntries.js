/**
 * Συμπληρωματικές συμβάσεις — εμφάνιση στη ροή σταδίων ΚΗΜΔΗΣ (μετά SYMV, πριν PAY).
 */

import { getAllChainHistories } from './khmdhsChainFormAccess';
import { getChainKindChoice, enrichChainHistoryWithReview, MOD_AMOUNT_TYPE, CHAIN_KIND } from './khmdhsChainActions';
import { pickKhmdhsContractSnapshot } from './khmdhsContractDisplayFields';
import { formatDateEl } from './dateFormat';
import { parseGreekAmountString } from './khmdhsFields';
import {
  overlaySymvPlanLabelsOnChainHistory,
  SYMV_CHAIN_ROLE,
} from './khmdhsSymvChainPlanner';

export const MOD_AMOUNT_TYPE_LABEL = {
  [MOD_AMOUNT_TYPE.DELTA]: 'Διαφορά (αύξηση/μείωση)',
  [MOD_AMOUNT_TYPE.TOTAL]: 'Νέα συνολική αξία',
};

function sortKey(dateStr) {
  const d = String(dateStr || '').slice(0, 10);
  return d || '9999-99-99';
}

function buildHistoryByAdam(project) {
  const review = project?.khmdhsDataQualityReview || null;
  const map = new Map();
  getAllChainHistories(project).forEach(({ history }) => {
    const enriched = overlaySymvPlanLabelsOnChainHistory(
      enrichChainHistoryWithReview(history || [], review),
      project?.khmdhsSymvChainPlan
    );
    enriched.forEach((h) => {
      const adam = String(h?.adam || '').trim().toUpperCase();
      if (adam) map.set(adam, h);
    });
  });
  return map;
}

function resolveSuppEntryLabel(row, hist, project, adam) {
  const planItem = (project?.khmdhsSymvChainPlan?.items || []).find(
    (i) => String(i?.adam || '').trim().toUpperCase() === adam
  );
  if (planItem?.role === SYMV_CHAIN_ROLE.EXTENSION) return 'Παράταση';
  if (planItem?.role === SYMV_CHAIN_ROLE.SUPPLEMENTARY) return 'Συμπληρωματική σύμβαση';
  const effectiveKind = hist?.effectiveKind || hist?.kind || hist?.userKind;
  if (effectiveKind === CHAIN_KIND.EXTENSION) return 'Παράταση';
  if (effectiveKind === CHAIN_KIND.MODIFICATION) return 'Συμπληρωματική σύμβαση';
  const comments = String(row?.comments || '').trim();
  if (comments === 'Παράταση') return 'Παράταση';
  const histLabel = String(hist?.label || '').trim();
  if (histLabel === 'Παράταση' || histLabel === 'Συμπληρωματική σύμβαση') return histLabel;
  if (histLabel && histLabel !== 'Άλλο') return histLabel;
  return 'Συμπληρωματική σύμβαση';
}

function assignSupplementaryDisplayTitles(entries) {
  let suppNum = 0;
  let extNum = 0;
  const suppTotal = entries.filter((e) => e.label === 'Συμπληρωματική σύμβαση').length;
  const extTotal = entries.filter((e) => e.label === 'Παράταση').length;
  return entries.map((entry) => {
    if (entry.label === 'Παράταση') {
      extNum += 1;
      return {
        ...entry,
        displayTitle: extTotal > 1 ? `Παράταση ${extNum}` : 'Παράταση',
        isExtension: true,
      };
    }
    suppNum += 1;
    return {
      ...entry,
      displayTitle: suppTotal > 1 ? `Συμπληρωματική σύμβαση ${suppNum}` : 'Συμπληρωματική σύμβαση',
      isExtension: false,
    };
  });
}

export function buildSupplementaryStageTitle(entry) {
  return String(entry?.displayTitle || entry?.label || 'Συμπληρωματική σύμβαση').trim();
}

/** ΑΠΕ μόνο σε συμπληρωματικές — όχι σε παρατάσεις */
export function isSupplementaryApeEligible(entry) {
  if (!entry) return false;
  return !entry.isExtension && entry.label !== 'Παράταση';
}

/**
 * @returns {Array<{
 *   index: number, adam: string, date: string, amount: string,
 *   rawAmount: string, amountType: string|null, comments: string, note: string,
 *   khmdhsDerived: boolean, snapshot: object|null, title: string, label: string,
 *   contractor: string, khmdhsAmountDisplay: string, signedDateDisplay: string,
 * }>}
 */
export function getKhmdhsSupplementaryStageEntries(project) {
  const review = project?.khmdhsDataQualityReview || null;
  const contracts = Array.isArray(project?.supplementaryContracts)
    ? project.supplementaryContracts
    : [];
  if (!contracts.length) return [];

  const historyByAdam = buildHistoryByAdam(project);

  const entries = contracts
    .map((row, idx) => {
      const adam = String(row?.khmdhsAdam || '').trim().toUpperCase();
      const hist = adam ? historyByAdam.get(adam) : null;
      const choice = adam ? getChainKindChoice(review, adam) : null;
      const rawSnapshot = hist?.snapshot || null;
      const snapshot = pickKhmdhsContractSnapshot(rawSnapshot) || rawSnapshot;
      const khmdhsAmount = snapshot?.totalCostWithVAT ?? snapshot?.totalCost ?? hist?.contractAmount;
      const khmdhsAmountDisplay = khmdhsAmount != null && khmdhsAmount !== ''
        ? String(khmdhsAmount)
        : '';

      const date = String(row?.date || choice?.modDate || hist?.contractDate || '').slice(0, 10);
      const amount = String(row?.amount || '').trim();
      const rawAmount = String(choice?.modAmount || khmdhsAmountDisplay || '').trim();
      const amountType = row?.amountType || choice?.modAmountType || null;

      return {
        index: idx + 1,
        adam,
        date,
        amount,
        rawAmount,
        amountType,
        comments: String(row?.comments || '').trim(),
        note: String(choice?.note || '').trim(),
        khmdhsDerived: !!row?.khmdhsDerived,
        snapshot,
        title: String(snapshot?.title || hist?.title || '').trim(),
        label: resolveSuppEntryLabel(row, hist, project, adam),
        contractor: String(
          snapshot?.contractorName || snapshot?.anadoxosName || snapshot?.contractor || ''
        ).trim(),
        khmdhsAmountDisplay,
        signedDateDisplay: formatDateEl(date, ''),
      };
    })
    .filter((e) => e.adam || e.date || e.amount || e.rawAmount);

  return assignSupplementaryDisplayTitles(
    entries.sort((a, b) => sortKey(a.date).localeCompare(sortKey(b.date)))
  );
}

export function projectHasKhmdhsSupplementaryData(project) {
  return getKhmdhsSupplementaryStageEntries(project).length > 0;
}

export function buildKhmdhsSupplementaryCardSummary(entry) {
  if (!entry) return '';
  const parts = [];
  if (entry.adam) parts.push(entry.adam);
  if (entry.signedDateDisplay) parts.push(entry.signedDateDisplay);
  if (entry.amount) {
    const n = parseGreekAmountString(entry.amount);
    parts.push(n ? `${entry.amount} €` : entry.amount);
  } else if (entry.rawAmount) {
    parts.push(`${entry.rawAmount} €`);
  }
  return parts.join(' · ');
}

export function buildKhmdhsSupplementaryDisplayGroups(entry) {
  if (!entry) return [];

  const isExtension = !!entry.isExtension || entry.label === 'Παράταση';

  const identity = [];
  if (entry.adam) identity.push({ label: 'ΑΔΑΜ', value: entry.adam, mono: true });
  if (entry.title) identity.push({ label: 'Τίτλος', value: entry.title });
  if (entry.contractor) identity.push({ label: 'Ανάδοχος', value: entry.contractor });

  const financial = [];
  if (entry.signedDateDisplay) {
    financial.push({
      label: isExtension ? 'Καταληκτική ημερομηνία παράτασης' : 'Ημερομηνία',
      value: entry.signedDateDisplay,
      ...(isExtension ? { highlight: true } : {}),
    });
  }
  if (!isExtension) {
    if (entry.amount) {
      financial.push({ label: 'Διαφορά ποσού (με ΦΠΑ)', value: `${entry.amount} €`, strong: true, highlight: true });
    }
    if (entry.rawAmount && entry.rawAmount !== entry.amount) {
      financial.push({
        label: entry.amountType === MOD_AMOUNT_TYPE.TOTAL ? 'Νέα συνολική αξία' : 'Ποσό από έγγραφο',
        value: `${entry.rawAmount} €`,
      });
    }
    if (entry.amountType) {
      financial.push({
        label: 'Τύπος ποσού',
        value: MOD_AMOUNT_TYPE_LABEL[entry.amountType] || entry.amountType,
      });
    }
    if (entry.khmdhsAmountDisplay && entry.khmdhsAmountDisplay !== entry.rawAmount) {
      financial.push({ label: 'Ποσό ΚΗΜΔΗΣ', value: `${entry.khmdhsAmountDisplay} €` });
    }
  }

  const notes = [];
  if (entry.comments) notes.push({ label: 'Περιγραφή', value: entry.comments });
  if (entry.note) notes.push({ label: 'Σχόλιο χρήστη', value: entry.note });

  const groups = [];
  if (identity.length) groups.push({ id: 'identity', title: 'Ταυτότητα', rows: identity });
  if (financial.length) groups.push({ id: 'financial', title: 'Οικονομικά & ημερομηνίες', rows: financial });
  if (notes.length) groups.push({ id: 'notes', title: 'Σημειώσεις', rows: notes });
  return groups;
}

/** Ενιαία αντιστοίχιση για αναφορές PDF / εξαγωγές — ίδια λογική με την οθόνη σταδίων */
export function mapSupplementaryEntryForReport(entry) {
  if (!entry) return null;
  const isExtension = !!entry.isExtension || entry.label === 'Παράταση';
  const title = buildSupplementaryStageTitle(entry);
  const date = entry.signedDateDisplay || entry.date || '';
  let amount = '';
  let amountLabel = 'Ποσό';
  if (isExtension) {
    amountLabel = 'Αναφορικό ποσό';
    amount = String(entry.rawAmount || entry.khmdhsAmountDisplay || entry.amount || '').trim();
  } else {
    amount = String(entry.amount || entry.rawAmount || entry.khmdhsAmountDisplay || '').trim();
    if (entry.amountType === MOD_AMOUNT_TYPE.TOTAL && entry.rawAmount && entry.rawAmount !== entry.amount) {
      amountLabel = 'Νέα συνολική αξία';
      amount = String(entry.rawAmount).trim();
    } else if (!entry.amount && entry.rawAmount) {
      amountLabel = 'Ποσό από έγγραφο';
      amount = String(entry.rawAmount).trim();
    }
  }
  return {
    title,
    isExtension,
    adam: entry.adam || '',
    date,
    amount,
    amountLabel,
    contractor: entry.contractor || '',
    comments: entry.comments || '',
  };
}

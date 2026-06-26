/**
 * Ενιαία πρόσβαση στην αλυσίδα ΚΗΜΔΗΣ ανά μορφή υλοποίησης (μία / πολλές συμβάσεις).
 */

import { isMultipleContractsForm } from './khmdhsFields';
import { inferKhmdhsVatRate, isStandardKhmdhsVatRate } from './khmdhsVatHelper';
import { enrichChainHistoryWithReview } from './khmdhsChainActions';

function normalizeAdam(adam) {
  return String(adam || '').trim().toUpperCase().replace(/\*+$/, '');
}

/** Ιστορικό αλυσίδας για μία σύμβαση — contractIndex null = μία σύμβαση (επίπεδο έργου) */
export function getChainHistoryForContract(form, contractIndex = null) {
  if (!form) return [];
  if (!isMultipleContractsForm(form.implementationForm)) {
    return Array.isArray(form.khmdhsContractChainHistory) ? form.khmdhsContractChainHistory : [];
  }
  if (contractIndex == null || contractIndex < 0) return [];
  const row = form.contracts?.[contractIndex];
  return Array.isArray(row?.khmdhsContractChainHistory) ? row.khmdhsContractChainHistory : [];
}

/** Όλες οι αλυσίδες με δείκτη σύμβασης */
export function getAllChainHistories(form) {
  if (!form) return [];
  if (!isMultipleContractsForm(form.implementationForm)) {
    const history = getChainHistoryForContract(form, null);
    return history.length ? [{ contractIndex: null, history }] : [];
  }
  return (form.contracts || [])
    .map((row, contractIndex) => ({
      contractIndex,
      history: Array.isArray(row?.khmdhsContractChainHistory) ? row.khmdhsContractChainHistory : [],
    }))
    .filter(({ history }) => history.length > 0);
}

/** Όλοι οι ΑΔΑΜ αλυσίδας — προαιρετικά μόνο για μία γραμμή σύμβασης */
export function collectAllChainAdams(form, contractIndex = null) {
  const out = new Set();
  const addFromHistory = (hist) => {
    (hist || []).forEach((h) => {
      const a = normalizeAdam(h?.adam);
      if (a) out.add(a);
    });
  };

  if (contractIndex != null) {
    addFromHistory(getChainHistoryForContract(form, contractIndex));
    const primary = normalizeAdam(form.contracts?.[contractIndex]?.khmdhsAdam);
    if (primary) out.add(primary);
    return [...out];
  }

  if (!isMultipleContractsForm(form?.implementationForm)) {
    addFromHistory(getChainHistoryForContract(form, null));
    const primary = normalizeAdam(form?.khmdhsAdam);
    if (primary) out.add(primary);
    return [...out];
  }

  (form.contracts || []).forEach((_, i) => {
    collectAllChainAdams(form, i).forEach((a) => out.add(a));
  });
  return [...out];
}

/** Εύρεση πράξης στην αλυσίδα */
export function findChainEntry(form, adamRaw, contractIndex = null) {
  const adam = normalizeAdam(adamRaw);
  if (!adam) return { entry: null, contractIndex: null };

  if (contractIndex != null) {
    const entry = getChainHistoryForContract(form, contractIndex)
      .find((h) => normalizeAdam(h?.adam) === adam) || null;
    return { entry, contractIndex };
  }

  if (!isMultipleContractsForm(form?.implementationForm)) {
    const entry = getChainHistoryForContract(form, null)
      .find((h) => normalizeAdam(h?.adam) === adam) || null;
    return { entry, contractIndex: null };
  }

  for (let i = 0; i < (form.contracts || []).length; i += 1) {
    const found = getChainHistoryForContract(form, i)
      .find((h) => normalizeAdam(h?.adam) === adam);
    if (found) return { entry: found, contractIndex: i };
  }
  return { entry: null, contractIndex: null };
}

export function updateChainHistoryOnForm(form, contractIndex, history) {
  if (!isMultipleContractsForm(form?.implementationForm)) {
    return { ...form, khmdhsContractChainHistory: history };
  }
  if (contractIndex == null || contractIndex < 0) return form;
  const contracts = [...(form.contracts || [])];
  if (contractIndex >= contracts.length) return form;
  contracts[contractIndex] = {
    ...contracts[contractIndex],
    khmdhsContractChainHistory: history,
  };
  return { ...form, contracts };
}

/** Συγχρονίζει ετικέτες/χαρακτηρισμούς ιστορικού με τις επιλογές του πίνακα αναφορών. */
export function syncChainHistoryWithReview(form, review) {
  if (!form) return form;
  if (!isMultipleContractsForm(form.implementationForm)) {
    return {
      ...form,
      khmdhsContractChainHistory: enrichChainHistoryWithReview(
        form.khmdhsContractChainHistory,
        review
      ),
    };
  }
  const contracts = (form.contracts || []).map((row) => ({
    ...row,
    khmdhsContractChainHistory: enrichChainHistoryWithReview(
      row.khmdhsContractChainHistory,
      review
    ),
  }));
  return { ...form, contracts };
}

/** Μη-αρχικές πράξεις προς αφαίρεση — με ετικέτα σύμβασης */
export function getRemovableChainEntriesFromForm(form) {
  const out = [];
  getAllChainHistories(form).forEach(({ contractIndex, history }) => {
    history
      .filter((h) => h?.adam && !h.isRoot)
      .forEach((h) => {
        out.push({
          ...h,
          contractIndex: contractIndex != null ? contractIndex : undefined,
          contractLabel: contractIndex != null ? `Σύμβαση ${contractIndex + 1}` : '',
        });
      });
  });
  return out;
}

export function contractRowFieldKey(contractIndex, field) {
  return `contract:${contractIndex}:${field}`;
}

export function parseContractRowFieldKey(fieldKey) {
  const m = /^contract:(\d+):(date|amount|contractEndDate)$/.exec(String(fieldKey || ''));
  if (!m) return null;
  return { contractIndex: Number(m[1]), field: m[2] };
}

export const KHMDHS_CONTRACT_ROW_FIELD_LABELS = {
  date: 'Ημερομηνία σύμβασης',
  amount: 'Ποσό σύμβασης',
  contractEndDate: 'Ημερομηνία λήξης σύμβασης',
};

export function resolveSupplementaryTargetContractIndex(form, explicitIndex = null) {
  if (!isMultipleContractsForm(form?.implementationForm)) return null;
  if (explicitIndex != null && explicitIndex >= 0) return explicitIndex;
  const withHist = (form.contracts || []).findIndex(
    (row) => (row?.khmdhsContractChainHistory || []).length > 0
  );
  return withHist >= 0 ? withHist : 0;
}

/** Πλαίσιο ποσού για ορφανή συμπληρωματική — από snapshots φόρμας */
export function buildSupplementaryAmountContextFromForm(form, contractIndex = null) {
  const awardSnap = form?.khmdhsAwardSnapshot || null;
  const noticeSnap = form?.khmdhsNoticeSnapshot || null;
  const auctionVat = inferKhmdhsVatRate(
    awardSnap?.totalCostWithoutVAT,
    awardSnap?.totalCostWithVAT
  );
  const noticeVat = inferKhmdhsVatRate(
    noticeSnap?.totalCostWithoutVAT,
    noticeSnap?.totalCostWithVAT
  );
  const contextualVatRate = !isStandardKhmdhsVatRate(auctionVat)
    ? auctionVat
    : (!isStandardKhmdhsVatRate(noticeVat) ? noticeVat : null);
  return {
    linkedContractCount: 1,
    parallelCase: false,
    blockSharedAwardFallback: false,
    allowAwardFallback: true,
    auctionSnapshot: awardSnap,
    noticeSnapshot: noticeSnap,
    contextualVatRate,
    contractIndex,
  };
}

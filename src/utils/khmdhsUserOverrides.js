/**
 * Χειροκίνητες διορθώσεις / αφαιρέσεις στοιχείων ΚΗΜΔΗΣ στη φόρμα υποέργου.
 */

import { isMultipleContractsForm } from './khmdhsFields';
import { addExcludedChainAdam, purgeOverridesForAdam } from './khmdhsFieldOverrides';
import { reconcileReviewState } from './khmdhsDataQualityReport';
import {
  findChainEntry,
  getChainHistoryForContract,
  getRemovableChainEntriesFromForm,
} from './khmdhsChainFormAccess';

function reviewItemKey(item) {
  if (!item?.fieldId) return '';
  if (item.chainAdam) return `${item.fieldId}::${item.chainAdam}`;
  if (item.supplementaryIndex != null) {
    return `${item.fieldId}::supp::${item.supplementaryIndex}`;
  }
  const idx = item.contractIndex != null ? String(item.contractIndex) : 'shared';
  return `${item.fieldId}::${idx}`;
}

function normalizeAdamLocal(adam) {
  return String(adam || '').trim().toUpperCase().replace(/\*+$/, '');
}

function filterHistoryRow(row, adam) {
  return {
    ...row,
    khmdhsContractChainHistory: (row.khmdhsContractChainHistory || [])
      .filter((h) => normalizeAdamLocal(h?.adam) !== adam)
      .map((h, order) => ({ ...h, order })),
    khmdhsContractAmendments: (row.khmdhsContractAmendments || [])
      .filter((h) => normalizeAdamLocal(h?.adam) !== adam),
  };
}

export function reindexSupplementaryReviewAfterRemoval(review, removedIndex) {
  if (!review || removedIndex == null) return review;
  const items = (review.items || [])
    .filter((item) => item.supplementaryIndex !== removedIndex)
    .map((item) => {
      if (item.supplementaryIndex == null || item.supplementaryIndex < removedIndex) return item;
      return { ...item, supplementaryIndex: item.supplementaryIndex - 1 };
    });

  const resolutions = {};
  Object.entries(review.resolutions || {}).forEach(([key, val]) => {
    const item = (review.items || []).find((i) => reviewItemKey(i) === key);
    if (!item || item.supplementaryIndex == null) {
      resolutions[key] = val;
      return;
    }
    if (item.supplementaryIndex === removedIndex) return;
    const newIdx = item.supplementaryIndex > removedIndex
      ? item.supplementaryIndex - 1
      : item.supplementaryIndex;
    const newItem = { ...item, supplementaryIndex: newIdx };
    resolutions[reviewItemKey(newItem)] = val;
  });

  return { ...review, items, resolutions };
}

function purgeReviewForChainAdam(review, adam) {
  if (!review || !adam) return review;
  const items = (review.items || []).filter((item) => item.chainAdam !== adam);
  const resolutions = { ...(review.resolutions || {}) };
  (review.items || []).forEach((item) => {
    if (item.chainAdam === adam) delete resolutions[reviewItemKey(item)];
  });
  return { ...review, items, resolutions };
}

function touchReviewAfterFormChange(review, form) {
  if (!review) return review;
  return reconcileReviewState(review, form);
}

function removeAdamFromContractHistory(form, adam, contractIndex) {
  const norm = normalizeAdamLocal(adam);
  if (isMultipleContractsForm(form.implementationForm)) {
    if (contractIndex != null && contractIndex >= 0) {
      const contracts = [...(form.contracts || [])];
      if (contractIndex < contracts.length) {
        contracts[contractIndex] = filterHistoryRow(contracts[contractIndex], norm);
        return { ...form, contracts };
      }
      return form;
    }
    return {
      ...form,
      contracts: (form.contracts || []).map((row) => filterHistoryRow(row, norm)),
    };
  }
  return {
    ...form,
    khmdhsContractChainHistory: getChainHistoryForContract(form, null)
      .filter((h) => normalizeAdamLocal(h?.adam) !== norm)
      .map((h, order) => ({ ...h, order })),
    khmdhsContractAmendments: (form.khmdhsContractAmendments || [])
      .filter((h) => normalizeAdamLocal(h?.adam) !== norm),
  };
}

export function removeSupplementaryContractFromForm(form, index) {
  const list = Array.isArray(form?.supplementaryContracts) ? form.supplementaryContracts : [];
  const removed = list[index];
  if (!removed) return form;

  const adam = normalizeAdamLocal(removed.khmdhsAdam);
  let next = { ...form };

  next.supplementaryContracts = list.filter((_, i) => i !== index);
  next.hasSupplementaryContracts = next.supplementaryContracts.length > 0;

  if (adam && removed.khmdhsDerived) {
    let targetIdx = removed.sourceContractIndex;
    if (targetIdx == null && isMultipleContractsForm(form.implementationForm)) {
      targetIdx = findChainEntry(form, adam).contractIndex;
    }
    next = removeAdamFromContractHistory(
      next,
      adam,
      isMultipleContractsForm(form.implementationForm) ? targetIdx : null
    );
    if (!isMultipleContractsForm(form.implementationForm)) {
      next.khmdhsContractAmendments = (next.khmdhsContractAmendments || [])
        .filter((h) => normalizeAdamLocal(h?.adam) !== adam);
    }
    if (next.khmdhsDataQualityReview) {
      next.khmdhsDataQualityReview = purgeReviewForChainAdam(next.khmdhsDataQualityReview, adam);
    }
    next = addExcludedChainAdam(next, adam);
    next = purgeOverridesForAdam(next, adam);
  }

  if (next.khmdhsDataQualityReview) {
    next.khmdhsDataQualityReview = reindexSupplementaryReviewAfterRemoval(
      next.khmdhsDataQualityReview,
      index
    );
    next.khmdhsDataQualityReview = touchReviewAfterFormChange(next.khmdhsDataQualityReview, next);
  }

  return next;
}

export function removeNonRootChainHistoryEntry(form, adamRaw, contractIndex = null) {
  const adam = normalizeAdamLocal(adamRaw);
  if (!adam) return form;

  const located = contractIndex != null
    ? findChainEntry(form, adam, contractIndex)
    : findChainEntry(form, adam);
  const entry = located.entry;
  const rowIdx = located.contractIndex;
  if (!entry || entry.isRoot) return form;

  const suppIdx = (form.supplementaryContracts || []).findIndex(
    (c) => normalizeAdamLocal(c?.khmdhsAdam) === adam
  );
  if (suppIdx >= 0) {
    return removeSupplementaryContractFromForm(form, suppIdx);
  }

  let next = removeAdamFromContractHistory(form, adam, rowIdx);

  if (next.khmdhsDataQualityReview) {
    next.khmdhsDataQualityReview = purgeReviewForChainAdam(next.khmdhsDataQualityReview, adam);
    next.khmdhsDataQualityReview = touchReviewAfterFormChange(next.khmdhsDataQualityReview, next);
  }

  next = addExcludedChainAdam(next, adam);
  next = purgeOverridesForAdam(next, adam);

  return next;
}

export function getRemovableChainHistoryEntries(form) {
  return getRemovableChainEntriesFromForm(form);
}

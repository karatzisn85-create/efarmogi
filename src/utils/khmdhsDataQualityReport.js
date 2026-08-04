/** Βοηθητικά για έλεγχο πληρότητας στοιχείων ΚΗΜΔΗΣ (renderer) */

import { normalizeAmountForCompare } from './projectFormPhases';
import { collectAllChainAdams, contractRowFieldKey } from './khmdhsChainFormAccess';
import {
  parseGreekAmountString,
  isMultipleContractsForm,
  resolveEffectivePayableAmountGrossForPayments,
  resolveStoredApeAmount,
} from './khmdhsFields';
import {
  buildSupplementaryOverrideKey,
  hasFieldOverride,
  isTrackedKhmdhsScalarField,
  KHMDHS_OVERRIDE_FIELD_LABELS,
  recordKhmdhsFieldOverride,
} from './khmdhsFieldOverrides';
import {
  applyPaymentRolesToProject,
  mergePaymentLabelsFromProject,
  mergePaymentRolesFromProject,
  PAYMENT_DOCUMENT_ROLE_LABELS,
  validatePaymentRoleDraft,
} from './khmdhsPaymentDocumentRoles';
import { rebuildPaymentsReconciliationItem } from './khmdhsPaymentsReconciliationItem';
import { computePaymentsReconciliationFromForm } from './khmdhsPaymentReconciliation';

export const KHMDHS_REVIEW_STATUS = {
  COMPLETE: 'complete',
  NEEDS_REVIEW: 'needs_review',
  MISSING: 'missing',
};

export const KHMDHS_RESOLUTION_SOURCE = {
  KHMDHS_APPLIED: 'khmdhs_applied',
  USER_MANUAL: 'user_manual',
  USER_CONFIRMED: 'user_confirmed',
};

export function reviewItemKey(item) {
  if (!item?.fieldId) return '';
  if (item.chainAdam) return `${item.fieldId}::${normalizeAdamForLookup(item.chainAdam)}`;
  if (item.supplementaryIndex != null) {
    return `${item.fieldId}::supp::${item.supplementaryIndex}`;
  }
  const idx = item.contractIndex != null ? String(item.contractIndex) : 'shared';
  return `${item.fieldId}::${idx}`;
}

/** Σταθερό κλειδί επίλυσης χαρακτηρισμού πράξης — πάντα κανονικοποιημένο ΑΔΑΜ */
export function chainKindReviewResolutionKey(adam) {
  return `chainKindReview::${normalizeAdamForLookup(adam)}`;
}

export function normalizeKhmdhsAdam(adam) {
  return normalizeAdamForLookup(adam);
}

function normalizeAdamForLookup(adam) {
  return String(adam || '').trim().toUpperCase().replace(/\*+$/, '');
}

/** Εύρεση γραμμής συμπληρωματικής από κωδικό πράξης (προτεραιότητα έναντι index) */
export function findSupplementaryRowIndex(formData, adam) {
  const norm = normalizeAdamForLookup(adam);
  if (!norm) return -1;
  return (formData?.supplementaryContracts || []).findIndex(
    (c) => normalizeAdamForLookup(c?.khmdhsAdam) === norm
  );
}

function readSupplementaryField(formData, item, fieldKey) {
  const rowKey = fieldKey === 'supplementaryAmount' ? 'amount' : 'date';
  if (item?.chainAdam) {
    const idx = findSupplementaryRowIndex(formData, item.chainAdam);
    if (idx >= 0) return String(formData.supplementaryContracts[idx]?.[rowKey] || '').trim();
  }
  if (item?.supplementaryIndex != null) {
    return String(formData.supplementaryContracts?.[item.supplementaryIndex]?.[rowKey] || '').trim();
  }
  return '';
}

function patchSupplementaryField(formData, item, value) {
  if (!item) return null;
  const rowKey = item.fieldId === 'supplementaryAmount' ? 'amount' : 'date';
  const supp = [...(formData.supplementaryContracts || [])];
  let idx = item.chainAdam ? findSupplementaryRowIndex(formData, item.chainAdam) : -1;
  if (idx < 0 && item.supplementaryIndex != null) idx = item.supplementaryIndex;
  if (idx < 0 || !supp[idx]) return null;
  supp[idx] = { ...supp[idx], [rowKey]: value };
  return { supplementaryContracts: supp };
}

function supplementaryChainAdam(item, formData) {
  if (item?.chainAdam) return item.chainAdam;
  const idx = item?.supplementaryIndex;
  if (idx == null || !formData) return '';
  return String(formData.supplementaryContracts?.[idx]?.khmdhsAdam || '').trim();
}

/** Ποσό/ημ/νία συμπληρωματικής — μόνο μετά τον χαρακτηρισμό της πράξης */
export function isSupplementaryFieldDeferred(review, item, formData) {
  if (!item) return false;
  if (item.fieldId !== 'supplementaryAmount' && item.fieldId !== 'supplementaryDate') return false;
  const adam = supplementaryChainAdam(item, formData);
  if (!adam) return false;
  const choice = review?.resolutions?.[chainKindReviewResolutionKey(adam)];
  // Αποκλεισμός από κατανομή SYMV (παλιά κενή value ή σημείωση).
  const note = String(choice?.note || '');
  if (note.includes('Αποκλείστηκε στη κατανομή SYMV')) return true;
  if (choice?.value && choice.value !== 'modification') return true;
  const kindItem = getReviewItem(review, 'chainKindReview', null, null, adam);
  if (kindItem && !choice) return true;
  return false;
}

export function getReviewItem(review, fieldId, contractIndex = null, supplementaryIndex = null, chainAdam = null) {
  if (!review?.items?.length || !fieldId) return null;
  const normChain = chainAdam != null ? normalizeAdamForLookup(chainAdam) : null;
  return review.items.find((item) => {
    if (item.fieldId !== fieldId) return false;
    if (normChain != null) return normalizeAdamForLookup(item.chainAdam) === normChain;
    if (item.chainAdam) return false;
    if (supplementaryIndex != null) return item.supplementaryIndex === supplementaryIndex;
    if (contractIndex != null) return item.contractIndex === contractIndex;
    return item.contractIndex == null && item.supplementaryIndex == null;
  }) || null;
}

function emptyReviewBase() {
  return {
    items: [],
    hasActionRequired: false,
    generatedAt: null,
    context: null,
    acknowledgedAt: null,
    acknowledgedFieldIds: [],
    resolutions: {},
    resolutionHistory: [],
  };
}

function filterReviewItemsByExcludedAdams(items, excludedAdams) {
  const excluded = excludedAdams instanceof Set ? excludedAdams : new Set(excludedAdams || []);
  if (!excluded.size) return items;
  return (items || []).filter((item) => {
    if (item?.chainAdam && excluded.has(normalizeAdamForLookup(item.chainAdam))) return false;
    return true;
  });
}

/** Κρατά μόνο επιλύσεις που αντιστοιχούν σε υπάρχοντα review items */
export function pruneResolutionsToItems(review) {
  if (!review) return review;
  const itemKeys = new Set((review.items || []).map(reviewItemKey));
  const resolutions = {};
  Object.entries(review.resolutions || {}).forEach(([key, val]) => {
    if (itemKeys.has(key)) resolutions[key] = val;
  });
  const acknowledgedFieldIds = (review.acknowledgedFieldIds || []).filter((k) => itemKeys.has(k));
  return { ...review, resolutions, acknowledgedFieldIds };
}

/** Αφαιρεί επιλύσεις για πράξεις που δεν υπάρχουν πλέον στην αλυσίδα */
export function pruneResolutionsByChainAdams(review, chainAdams = []) {
  if (!review) return review;
  const adamSet = new Set((chainAdams || []).map(normalizeAdamForLookup).filter(Boolean));
  if (!adamSet.size) return review;

  const resolutions = { ...(review.resolutions || {}) };
  Object.keys(resolutions).forEach((key) => {
    if (key.startsWith('chainKindReview::')) {
      const adam = normalizeAdamForLookup(key.slice('chainKindReview::'.length));
      if (!adamSet.has(adam)) delete resolutions[key];
      return;
    }
    const parts = key.split('::');
    const maybeAdam = parts[parts.length - 1];
    if (
      parts[0]?.startsWith('supplementary')
      && maybeAdam
      && !maybeAdam.startsWith('supp')
      && !adamSet.has(normalizeAdamForLookup(maybeAdam))
    ) {
      delete resolutions[key];
    }
  });

  const acknowledgedFieldIds = (review.acknowledgedFieldIds || []).filter((k) => {
    if (resolutions[k] != null) return true;
    return (review.items || []).some((item) => reviewItemKey(item) === k);
  });
  return { ...review, resolutions, acknowledgedFieldIds };
}

/**
 * Συγχώνευση αναφοράς μετά από ανάκτηση ΚΗΜΔΗΣ — διατηρεί επιλύσεις χρήστη όπου ισχύουν.
 */
export function mergeKhmdhsReviewAfterFetch(existing, incoming, form, {
  contractIndex = null,
  singleContractRefresh = false,
} = {}) {
  const excluded = new Set(
    (form?.khmdhsUserEdits?.excludedChainAdams || []).map(normalizeAdamForLookup).filter(Boolean)
  );
  const incomingItems = filterReviewItemsByExcludedAdams(incoming?.items || [], excluded);
  const filteredIncoming = incomingItems.length
    ? { ...incoming, items: incomingItems }
    : incoming;

  let merged = mergeDataQualityReviews(existing, filteredIncoming, {
    contractIndex,
    singleContractRefresh,
  });
  merged = pruneResolutionsToItems(merged);
  merged = pruneResolutionsByChainAdams(merged, collectAllChainAdams(form));
  return merged;
}

/** Μία εγγραφή χαρακτηρισμού ανά ΑΔΑΜ — αποφυγή διπλοτύπων από παράλληλα fetches */
function dedupeChainKindReviewItems(items) {
  const seen = new Set();
  return (items || []).filter((item) => {
    if (item?.fieldId !== 'chainKindReview' || !item.chainAdam) return true;
    const key = normalizeAdamForLookup(item.chainAdam);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeDataQualityReviews(existing, incoming, {
  contractIndex = null,
  singleContractRefresh = false,
} = {}) {
  const base = existing && typeof existing === 'object'
    ? {
      ...existing,
      items: [...(existing.items || [])],
      resolutions: { ...(existing.resolutions || {}) },
      resolutionHistory: [...(existing.resolutionHistory || [])],
      acknowledgedFieldIds: [...(existing.acknowledgedFieldIds || [])],
    }
    : emptyReviewBase();

  const incomingItems = Array.isArray(incoming?.items) ? incoming.items : [];
  if (!incomingItems.length) return base;

  const tagged = incomingItems.map((item) => {
    if (contractIndex == null) return item;
    if (item.supplementaryIndex != null) {
      return { ...item, contractIndex };
    }
    if (
      item.fieldId === 'contractDate'
      || item.fieldId === 'contractAmount'
      || item.fieldId === 'chainKindReview'
    ) {
      return { ...item, contractIndex };
    }
    return item;
  });

  const replaceKeys = new Set(tagged.map(reviewItemKey));
  let kept;
  if (singleContractRefresh) {
    kept = [];
  } else if (contractIndex != null) {
    kept = (base.items || []).filter((item) => {
      if (replaceKeys.has(reviewItemKey(item))) return false;
      if (item.contractIndex === contractIndex) return false;
      return true;
    });
  } else {
    kept = (base.items || []).filter((item) => !replaceKeys.has(reviewItemKey(item)));
  }

  const mergedItems = dedupeChainKindReviewItems([...kept, ...tagged]);
  const itemKeys = new Set(mergedItems.map(reviewItemKey));
  const resolutions = {};
  Object.entries(base.resolutions || {}).forEach(([key, val]) => {
    if (itemKeys.has(key)) resolutions[key] = val;
  });
  const acknowledgedFieldIds = (base.acknowledgedFieldIds || []).filter((k) => itemKeys.has(k));

  return {
    ...base,
    items: mergedItems,
    resolutions,
    acknowledgedFieldIds,
    generatedAt: incoming.generatedAt || new Date().toISOString(),
    context: incoming.context || base.context,
    hasActionRequired: mergedItems.some(
      (item) => item.status === KHMDHS_REVIEW_STATUS.NEEDS_REVIEW
        || item.status === KHMDHS_REVIEW_STATUS.MISSING
    ),
  };
}

/** Τρέχον συμβατικό ποσό (με ΦΠΑ) από τη φόρμα — για επαναϋπολογισμό ενταλμάτων. */
export function resolveFormContractAmountGrossForPayments(formData, contractIndex = null) {
  return resolveEffectivePayableAmountGrossForPayments(formData, contractIndex);
}

function paymentsReferenceAmount(item) {
  const ref = (item?.references || []).find((r) => /τελικό πληρωτέο|συμβατικό ποσό/i.test(String(r?.label || '')));
  if (!ref?.value) return null;
  return parseGreekAmountString(ref.value);
}

function paymentsItemChanged(before, after) {
  if (!before || !after) return false;
  const beforeRecon = before.paymentsReconciliation;
  const afterRecon = after.paymentsReconciliation;
  if (!beforeRecon || !afterRecon) {
    const refBefore = paymentsReferenceAmount(before);
    const refAfter = paymentsReferenceAmount(after);
    if (refBefore != null && refAfter != null) {
      return Math.abs(refBefore - refAfter) > 0.5;
    }
    return false;
  }
  if (!!beforeRecon.coFinancingPattern !== !!afterRecon.coFinancingPattern) return true;
  if (Math.abs((beforeRecon.rawTotalGross || 0) - (afterRecon.rawTotalGross || 0)) > 0.01) return true;
  if (Math.abs((beforeRecon.estimatedContractorPaymentGross || 0) - (afterRecon.estimatedContractorPaymentGross || 0)) > 0.01) {
    return true;
  }
  const refBefore = paymentsReferenceAmount(before);
  const refAfter = paymentsReferenceAmount(after);
  if (refBefore != null && refAfter != null && Math.abs(refBefore - refAfter) > 0.5) return true;
  return false;
}

function clearStaleItemAcknowledgment(review, item) {
  const key = reviewItemKey(item);
  const ack = new Set(review.acknowledgedFieldIds || []);
  ack.delete(key);
  const resolutions = { ...(review.resolutions || {}) };
  delete resolutions[key];
  return { ...review, acknowledgedFieldIds: [...ack], resolutions };
}

/** Ενημέρωση ειδοποιήσεων που εξαρτώνται από το τρέχον συμβατικό ποσό. */
export function refreshAmountDependentReviewItems(review, formData) {
  if (!review?.items?.length || !formData) return review;

  let nextReview = review;
  const items = review.items.map((item) => {
    if (item.fieldId !== 'paymentsReconciliation') return item;

    const formGross = resolveFormContractAmountGrossForPayments(formData, item.contractIndex);
    if (formGross == null) return item;

    const apeRaw = item.contractIndex != null
      ? resolveStoredApeAmount(formData, item.contractIndex)
      : resolveStoredApeAmount(formData);

    const refreshed = rebuildPaymentsReconciliationItem(item, {
      formData,
      formContractAmountGross: formGross,
      apeAmount: apeRaw,
    });

    if (paymentsItemChanged(item, refreshed)) {
      const key = reviewItemKey(item);
      const resolution = nextReview?.resolutions?.[key];
      const hadPaymentClassification = resolution?.value === 'classified'
        || !!(resolution?.meta?.paymentRoles && Object.keys(resolution.meta.paymentRoles).length);
      const acknowledgedExceed = resolution?.meta?.acknowledgedPayableExceeds === true;
      const nowClassified = !refreshed.paymentsReconciliation?.needsClassification
        && !refreshed.paymentsReconciliation?.needsReview
        && refreshed.paymentsReconciliation?.hasUserClassification;
      if (!(hadPaymentClassification && (nowClassified || acknowledgedExceed))) {
        nextReview = clearStaleItemAcknowledgment(nextReview, item);
      }
    }
    return refreshed;
  });

  return { ...nextReview, items };
}

export function reconcileReviewState(review, formData) {
  if (!review) return review;
  let syncedForm = syncFormFromSupplementaryResolutions(formData, review);
  let synced = syncSupplementaryResolutionsToFormValues(review, syncedForm);
  const refreshed = refreshAmountDependentReviewItems(synced, syncedForm);
  return {
    ...refreshed,
    hasActionRequired: getUnresolvedReviewItems(refreshed, syncedForm).length > 0,
  };
}

/** Γράφει στην φόρμα ποσά/ημ/νίες συμπληρωματικής από ήδη αποθηκευμένες επιλύσεις (μετά χαρακτηρισμό). */
function syncFormFromSupplementaryResolutions(formData, review) {
  if (!review?.items?.length || !formData) return formData;
  let next = formData;
  let changed = false;

  (review.items || []).forEach((item) => {
    if (item.fieldId !== 'supplementaryAmount' && item.fieldId !== 'supplementaryDate') return;

    const adam = supplementaryChainAdam(item, next) || item.chainAdam;
    if (!adam) return;
    if (review?.resolutions?.[chainKindReviewResolutionKey(adam)]?.value !== 'modification') return;

    const resVal = review?.resolutions?.[reviewItemKey(item)]?.value;
    if (!String(resVal || '').trim()) return;
    if (String(getFormValueForReviewItem(next, item) || '').trim()) return;

    const patch = buildReviewFieldPatch(next, item, resVal);
    if (patch) {
      next = { ...next, ...patch };
      changed = true;
    }
  });

  return changed ? next : formData;
}

/** Ευθυγράμμιση επιλύσεων ποσού/ημ/νίας συμπληρωματικής με τις τιμές της φόρμας (μετά χαρακτηρισμό). */
function syncSupplementaryResolutionsToFormValues(review, formData) {
  if (!review?.items?.length || !formData) return review;
  let next = review;

  (review.items || []).forEach((item) => {
    if (item.fieldId !== 'supplementaryAmount' && item.fieldId !== 'supplementaryDate') return;

    const adam = supplementaryChainAdam(item, formData) || item.chainAdam;
    if (!adam) return;

    const kindKey = chainKindReviewResolutionKey(adam);
    if (next.resolutions?.[kindKey]?.value !== 'modification') return;

    const formVal = getFormValueForReviewItem(formData, item);
    if (!String(formVal || '').trim()) return;

    const key = reviewItemKey(item);
    const existing = next.resolutions?.[key];
    if (
      existing
      && normalizeReviewFieldValue(item, existing.value) === normalizeReviewFieldValue(item, formVal)
    ) {
      return;
    }

    next = resolveReviewItem(next, item, {
      value: formVal,
      source: existing?.source || KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED,
    });
  });

  return next;
}

export function normalizeReviewFieldValue(item, value) {
  if (value == null || value === '') return '';
  const fid = item?.fieldId || '';
  if (fid.includes('Amount') || fid === 'projectBudget') {
    return normalizeAmountForCompare(String(value));
  }
  if (fid.includes('Date') || fid === 'contractProcessStartDate') {
    const s = String(value).trim();
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return s.slice(0, 10);
  }
  return String(value).trim();
}

export function isReviewItemResolved(review, formData, item) {
  if (!item) return true;
  if (item.status === KHMDHS_REVIEW_STATUS.COMPLETE) return true;

  const key = reviewItemKey(item);
  const resolution = review?.resolutions?.[key];

  if (item.fieldId === 'chainKindReview') {
    return !!resolution;
  }

  if (item.fieldId === 'paymentsReconciliation') {
    const liveRecon = computePaymentsReconciliationFromForm(formData, item);
    const roles = mergePaymentRolesFromProject(formData, review, item);
    const active = (liveRecon?.entries || []).filter((e) => e?.active && e?.adam);
    if (!liveRecon?.needsClassification && !liveRecon?.needsReview) return true;
    if (active.length === 0) return !!resolution;
    const allClassified = active.every((e) => roles[String(e.adam || '').trim().toUpperCase()]);
    if (!allClassified) return false;
    if (liveRecon?.countableExceedsContract) {
      return !!(resolution?.meta?.acknowledgedPayableExceeds
        && (resolution?.meta?.paymentRoles || resolution?.value === 'classified'));
    }
    return !!(resolution?.meta?.paymentRoles || resolution?.value === 'classified');
  }

  if (isSupplementaryFieldDeferred(review, item, formData)) return true;

  if (resolution?.value != null && String(resolution.value).trim() !== '') {
    if (item.fieldId === 'supplementaryAmount' || item.fieldId === 'supplementaryDate') {
      const adam = supplementaryChainAdam(item, formData) || item.chainAdam;
      if (adam && review?.resolutions?.[chainKindReviewResolutionKey(adam)]?.value === 'modification') {
        return true;
      }
    }
    // Για acknowledge-type items, οποιαδήποτε αποθηκευμένη τιμή επίλυσης σημαίνει επιβεβαίωση.
    if (getReviewFieldInputKind(item) === 'acknowledge') return true;
    const formVal = getFormValueForReviewItem(formData, item);
    if (normalizeReviewFieldValue(item, formVal)
      === normalizeReviewFieldValue(item, resolution.value)) {
      return true;
    }
    // Μετά χαρακτηρισμό τροποποίησης: η φόρμα έχει υπολογισμένη διαφορά, η επίλυση μπορεί
    // να κρατά το ποσό που πληκτολόγησε ο χρήστης (π.χ. «νέο σύνολο») — δεν ξανα-εμφανίζουμε το βήμα.
    if (
      (item.fieldId === 'supplementaryAmount' || item.fieldId === 'supplementaryDate')
      && String(formVal || '').trim()
    ) {
      const adam = supplementaryChainAdam(item, formData) || item.chainAdam;
      if (adam && review?.resolutions?.[chainKindReviewResolutionKey(adam)]?.value === 'modification') {
        return true;
      }
    }
    return false;
  }

  const ack = new Set(review?.acknowledgedFieldIds || []);
  if (item.status === KHMDHS_REVIEW_STATUS.NEEDS_REVIEW && ack.has(key)) {
    // Τα informational items (paymentsReconciliation κ.ά.) δεν έχουν form value —
    // αρκεί η επιβεβαίωση από τον χρήστη (acknowledgment) για να θεωρηθούν επιλυμένα.
    const noFormValue = ['chainKindReview'];
    return !!getFormValueForReviewItem(formData, item) || noFormValue.includes(item.fieldId);
  }

  if (item.status === KHMDHS_REVIEW_STATUS.MISSING) {
    return !!getFormValueForReviewItem(formData, item);
  }

  return false;
}

export function khmdhsFieldRequiresManualInput(review, fieldId, contractIndex = null, supplementaryIndex = null, formData = null) {
  const item = getReviewItem(review, fieldId, contractIndex, supplementaryIndex);
  if (!item) return false;
  if (formData && isReviewItemResolved(review, formData, item)) return false;
  return item.status === KHMDHS_REVIEW_STATUS.MISSING
    || item.status === KHMDHS_REVIEW_STATUS.NEEDS_REVIEW;
}

export function supplementaryReviewLocked(review, fieldId, supplementaryIndex, formData = null) {
  const item = getReviewItem(review, fieldId, null, supplementaryIndex);
  if (!item) return false;
  if (item.status === KHMDHS_REVIEW_STATUS.COMPLETE) return true;
  if (formData && isReviewItemResolved(review, formData, item)) return true;
  return false;
}

export function getFormValueForReviewItem(formData, item) {
  if (!formData || !item) return '';
  const { fieldId, contractIndex } = item;
  if (fieldId === 'projectBudget') return String(formData.projectBudget || '').trim();
  if (fieldId === 'assignmentProcedure') return String(formData.assignmentProcedure || '').trim();
  if (fieldId === 'contractProcessStartDate') {
    return String(formData.contractProcessStartDate || '').trim();
  }
  if (fieldId === 'contractDate') {
    if (contractIndex != null) {
      return String(formData.contracts?.[contractIndex]?.date || '').trim();
    }
    return String(formData.contractDate || '').trim();
  }
  if (fieldId === 'contractAmount') {
    if (contractIndex != null) {
      return String(formData.contracts?.[contractIndex]?.amount || '').trim();
    }
    return String(formData.contractAmount || '').trim();
  }
  if (fieldId === 'supplementaryAmount') {
    return readSupplementaryField(formData, item, 'supplementaryAmount');
  }
  if (fieldId === 'supplementaryDate') {
    return readSupplementaryField(formData, item, 'supplementaryDate');
  }
  return '';
}

export function getUnresolvedReviewItems(review, formData) {
  if (!review?.items?.length) return [];
  return review.items.filter((item) => {
    if (isSupplementaryFieldDeferred(review, item, formData)) return false;
    return !isReviewItemResolved(review, formData, item);
  });
}

export function getUserResolvedReviewItems(review, formData) {
  if (!review?.items?.length) return [];
  return review.items.filter((item) => {
    const key = reviewItemKey(item);
    const userClassifiedPayments = item.fieldId === 'paymentsReconciliation'
      && (() => {
        const liveRecon = computePaymentsReconciliationFromForm(formData, item);
        return !!(liveRecon?.hasUserClassification && !liveRecon?.needsClassification);
      })();

    if (item.status === KHMDHS_REVIEW_STATUS.COMPLETE && !userClassifiedPayments) return false;
    if (!isReviewItemResolved(review, formData, item)) return false;
    if (review.resolutions?.[key]) return true;
    return userClassifiedPayments;
  });
}

export function getKhmdhsCompleteReviewItems(review) {
  return (review?.items || []).filter((item) => item.status === KHMDHS_REVIEW_STATUS.COMPLETE);
}

export function getResolutionConflict(review, item) {
  const key = reviewItemKey(item);
  const res = review?.resolutions?.[key];
  if (!res?.khmdhsSuggestedValue) return null;
  const newSuggested = parseReviewDisplayValue(item);
  if (!newSuggested) return null;
  if (normalizeReviewFieldValue(item, newSuggested)
    !== normalizeReviewFieldValue(item, res.khmdhsSuggestedValue)) {
    return {
      previousSuggestion: res.khmdhsSuggestedValue,
      currentSuggestion: newSuggested,
    };
  }
  return null;
}

export function formatResolutionSourceLabel(source) {
  switch (source) {
    case KHMDHS_RESOLUTION_SOURCE.KHMDHS_APPLIED:
      return 'Πρόταση ΚΗΜΔΗΣ';
    case KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED:
      return 'Επιβεβαιώθηκε με έγγραφα';
    case KHMDHS_RESOLUTION_SOURCE.USER_MANUAL:
      return 'Χειροκίνητη καταχώριση';
    default:
      return 'Επιλύθηκε';
  }
}

export function formatResolutionDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('el-GR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return '';
  }
}

export function resolveReviewItem(review, item, { value = '', source, resolvedBy = '', note = '', meta = null } = {}) {
  if (!review || !item) return review;
  const key = reviewItemKey(item);
  const prev = review.resolutions?.[key];
  const resolutions = { ...(review.resolutions || {}) };
  resolutions[key] = {
    value: value != null ? String(value) : '',
    source: source || KHMDHS_RESOLUTION_SOURCE.USER_MANUAL,
    resolvedAt: new Date().toISOString(),
    resolvedBy,
    khmdhsStatusAtResolve: item.status,
    khmdhsSuggestedValue: parseReviewDisplayValue(item) || String(item.displayValue || '').replace(/\s*€\s*$/i, '').trim(),
    label: item.label || '',
    note: note || '',
    meta: meta && typeof meta === 'object' ? meta : (prev?.meta || null),
  };
  const history = [
    ...(review.resolutionHistory || []),
    {
      key,
      action: prev ? 'updated' : 'created',
      at: new Date().toISOString(),
      oldValue: prev?.value || '',
      newValue: value != null ? String(value) : '',
      user: resolvedBy,
    },
  ].slice(-100);

  return {
    ...review,
    resolutions,
    resolutionHistory: history,
    acknowledgedFieldIds: [
      ...new Set([...(review.acknowledgedFieldIds || []), key]),
    ],
  };
}

export function revokeReviewResolution(review, key) {
  if (!review || !key) return review;
  const resolutions = { ...(review.resolutions || {}) };
  delete resolutions[key];
  const acknowledgedFieldIds = (review.acknowledgedFieldIds || []).filter((k) => k !== key);
  const history = [
    ...(review.resolutionHistory || []),
    { key, action: 'revoked', at: new Date().toISOString(), oldValue: '', newValue: '', user: '' },
  ].slice(-100);
  return { ...review, resolutions, acknowledgedFieldIds, resolutionHistory: history };
}

/** Επαναφορά τιμής φόρμας μετά από αναίρεση επίλυσης (όχι χαρακτηρισμός) */
export function revertScalarFieldForRevokedItem(formData, item, resolution) {
  if (!item || item.fieldId === 'chainKindReview') return null;
  const revertValue = resolution?.khmdhsSuggestedValue != null
    ? String(resolution.khmdhsSuggestedValue)
    : '';
  return buildReviewFieldPatch(formData, item, revertValue);
}

export function isChainKindReviewKey(key) {
  return String(key || '').startsWith('chainKindReview::');
}

export function validateKhmdhsDataQualityReview(formData) {
  const review = formData?.khmdhsDataQualityReview;
  if (!review?.hasActionRequired) return {};

  const errors = {};
  getUnresolvedReviewItems(review, formData).forEach((item) => {
    const key = reviewItemKey(item);
    if (item.status === KHMDHS_REVIEW_STATUS.MISSING) {
      let errKey = item.manualFieldKey;
      if (item.supplementaryIndex != null) {
        errKey = item.fieldId === 'supplementaryAmount'
          ? `supplementaryAmount${item.supplementaryIndex}`
          : `supplementaryDate${item.supplementaryIndex}`;
      } else if (item.contractIndex != null) {
        errKey = `${item.manualFieldKey}${item.contractIndex}`;
      }
      errors[errKey] = item.message || `Συμπληρώστε: ${item.label}`;
    } else if (item.status === KHMDHS_REVIEW_STATUS.NEEDS_REVIEW) {
      errors[`khmdhsReview_${key}`] = `Απαιτείται έλεγχος: ${item.label}`;
    }
  });

  if (Object.keys(errors).length && !errors.khmdhsDataQualityReview) {
    errors.khmdhsDataQualityReview = 'Υπάρχουν στοιχεία ΚΗΜΔΗΣ που χρειάζονται έλεγχο ή συμπλήρωση στην αναφορά.';
  }
  return errors;
}

export function acknowledgeDataQualityReview(review, acknowledgedFieldIds = [], formData = null) {
  if (!review) return null;
  const incoming = Array.isArray(acknowledgedFieldIds) ? acknowledgedFieldIds : [];
  const merged = new Set([...(review.acknowledgedFieldIds || []), ...incoming]);
  const next = {
    ...review,
    acknowledgedFieldIds: [...merged],
    acknowledgedAt: new Date().toISOString(),
  };
  if (formData) {
    return reconcileReviewState(next, formData);
  }
  return next;
}

export function countReviewItemsByStatus(review) {
  const counts = { complete: 0, needs_review: 0, missing: 0 };
  (review?.items || []).forEach((item) => {
    if (counts[item.status] != null) counts[item.status] += 1;
  });
  return counts;
}

const SECTION_ORDER = ['modification', 'contract', 'payments', 'case'];

function reviewItemDisplayPriority(item) {
  if (item?.fieldId === 'chainKindReview') return 0;
  if (item?.status === KHMDHS_REVIEW_STATUS.MISSING) return 1;
  if (item?.fieldId === 'paymentsReconciliation') return 4;
  if (item?.fieldId === 'supplementaryDate') return 2;
  if (item?.fieldId === 'supplementaryAmount') return 3;
  return 2;
}

/** Σύντομος οδηγός ενέργειας για ειδοποιήσεις / FAB */
export function getReviewItemUserGuide(item) {
  if (!item) {
    return { title: '', hint: '', cta: 'Άνοιγμα', priority: 99, icon: '📋' };
  }

  if (item.fieldId === 'chainKindReview') {
    const adam = item.chainAdam || extractKhmdhsAdamFromItem(item) || '';
    return {
      title: 'Χαρακτηρισμός εγγράφου',
      hint: adam
        ? `Δηλώστε τι είναι το ${adam} (συμπληρωματική, παράταση κ.λπ.)`
        : 'Επιλέξτε τι είδους έγγραφο είναι αυτή η πράξη',
      cta: 'Χαρακτηρισμός',
      priority: 0,
      icon: '🏷️',
    };
  }

  if (item.fieldId === 'paymentsReconciliation') {
    return {
      title: 'Έλεγχος ενταλμάτων πληρωμής',
      hint: 'Συγκρίνετε το άθροισμα με το συμβατικό ποσό — επιβεβαιώστε αν είναι σωστό',
      cta: 'Έλεγχος',
      priority: 4,
      icon: '💳',
    };
  }

  if (item.status === KHMDHS_REVIEW_STATUS.MISSING) {
    return {
      title: item.label || 'Συμπλήρωση στοιχείου',
      hint: 'Δεν βρέθηκε στο ΚΗΜΔΗΣ — συμπληρώστε από τα έγγραφά σας',
      cta: 'Συμπλήρωση',
      priority: 1,
      icon: '✏️',
    };
  }

  if (item.status === KHMDHS_REVIEW_STATUS.NEEDS_REVIEW) {
    return {
      title: item.label || 'Έλεγχος στοιχείου',
      hint: 'Ελέγξτε την πρόταση ΚΗΜΔΗΣ και επιβεβαιώστε ή διορθώστε',
      cta: 'Έλεγχος',
      priority: 2,
      icon: '⚠️',
    };
  }

  return {
    title: item.label || 'Στοιχείο',
    hint: item.message || '',
    cta: 'Προβολή',
    priority: 50,
    icon: '📋',
  };
}

/** Ταξινόμηση εκκρεμών — πρώτα χαρακτηρισμός εγγράφων, μετά συμπληρώσεις */
export function sortReviewItemsByUserPriority(items) {
  return [...(items || [])].sort((a, b) => {
    const pa = getReviewItemUserGuide(a).priority;
    const pb = getReviewItemUserGuide(b).priority;
    if (pa !== pb) return pa - pb;
    return String(a.label || '').localeCompare(String(b.label || ''), 'el');
  });
}

export function groupReviewItemsBySection(items) {
  const list = Array.isArray(items) ? items : [];
  const groups = new Map();
  list.forEach((item) => {
    const key = item.section || 'case';
    if (!groups.has(key)) {
      groups.set(key, {
        section: key,
        sectionLabel: item.sectionLabel || key,
        items: [],
      });
    }
    groups.get(key).items.push(item);
  });
  return SECTION_ORDER
    .filter((k) => groups.has(k))
    .map((k) => {
      const group = groups.get(k);
      return {
        ...group,
        items: [...group.items].sort(
          (a, b) => reviewItemDisplayPriority(a) - reviewItemDisplayPriority(b)
        ),
      };
    })
    .concat(
      [...groups.values()]
        .filter((g) => !SECTION_ORDER.includes(g.section))
        .map((g) => ({
          ...g,
          items: [...g.items].sort(
            (a, b) => reviewItemDisplayPriority(a) - reviewItemDisplayPriority(b)
          ),
        }))
    );
}

export function filterReviewItems(items, filter) {
  const list = Array.isArray(items) ? items : [];
  if (filter === 'all') return list;
  if (filter === 'complete') {
    return list.filter((i) => i.status === KHMDHS_REVIEW_STATUS.COMPLETE);
  }
  return list.filter(
    (i) => i.status === KHMDHS_REVIEW_STATUS.MISSING
      || i.status === KHMDHS_REVIEW_STATUS.NEEDS_REVIEW
  );
}

export function normalizeReviewSearchSteps(item, action = null) {
  if (Array.isArray(action?.steps) && action.steps.length) return action.steps;
  if (Array.isArray(item?.searchSteps)) return item.searchSteps;
  return [];
}

export function getReviewFieldInputKind(item) {
  if (!item) return 'text';
  const fieldId = String(item.fieldId || '');
  if (fieldId === 'chainKindReview') return 'chainKindReview';
  if (fieldId === 'paymentsReconciliation') return 'paymentClassification';
  if (fieldId === 'assignmentProcedure') return 'assignmentProcedure';
  if (fieldId.includes('Amount') || fieldId === 'projectBudget') return 'amount';
  if (fieldId.includes('Date') || fieldId === 'contractProcessStartDate') return 'date';
  return 'text';
}

export function getReviewFieldAnchorId(item) {
  if (!item?.fieldId) return '';
  const { fieldId, contractIndex, supplementaryIndex } = item;
  if (fieldId === 'chainKindReview') return 'khmdhs-chain-history';
  if (fieldId === 'supplementaryDate') return `khmdhs-supp-date-${supplementaryIndex ?? 0}`;
  if (fieldId === 'supplementaryAmount') return `khmdhs-supp-amount-${supplementaryIndex ?? 0}`;
  if (fieldId === 'contractDate') {
    return contractIndex != null ? `khmdhs-contract-date-${contractIndex}` : 'khmdhs-contract-date';
  }
  if (fieldId === 'contractAmount') {
    return contractIndex != null ? `khmdhs-contract-amount-${contractIndex}` : 'khmdhs-contract-amount';
  }
  if (fieldId === 'projectBudget') return 'khmdhs-project-budget';
  if (fieldId === 'assignmentProcedure') return 'khmdhs-assignment-procedure';
  if (fieldId === 'contractProcessStartDate') return 'khmdhs-process-start';
  return `khmdhs-field-${fieldId}`;
}

export function parseReviewDisplayValue(item) {
  const v = String(item?.displayValue || '').trim();
  if (!v) return '';
  const fid = item.fieldId || '';
  if (fid.includes('Amount') || fid === 'projectBudget') {
    return v.replace(/\s*€\s*$/i, '').trim();
  }
  if (fid.includes('Date') || fid === 'contractProcessStartDate') {
    const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  }
  return v;
}

export function getInitialEditorValue(item, formData) {
  const current = getFormValueForReviewItem(formData, item);
  if (current) return current;
  return parseReviewDisplayValue(item);
}

export function getReviewActionDescriptor(item) {
  if (!item) return { type: 'none', verb: '', gotoLabel: 'Δείτε στη φόρμα' };
  if (item.fieldId === 'paymentsReconciliation') {
    return {
      type: 'paymentClassification',
      verb: 'Χαρακτηρισμός εγγράφων',
      gotoLabel: 'Δείτε εντάλματα',
      checkLabel: 'Επιβεβαιώνω τους χαρακτηρισμούς',
      saveLabel: 'Αποθήκευση χαρακτηρισμών',
      steps: normalizeReviewSearchSteps(item),
    };
  }
  if (item.fieldId === 'chainKindReview') {
    return {
      type: 'chainKindReview',
      verb: 'Χαρακτηρισμός εγγράφου',
      gotoLabel: 'Δείτε ιστορικό αλυσίδας',
      checkLabel: 'Επιβεβαιώνω τον χαρακτηρισμό',
      saveLabel: 'Αποθήκευση χαρακτηρισμού',
    };
  }
  if (item.fieldId === 'paymentsReconciliation') {
    return {
      type: 'acknowledge',
      verb: 'Έλεγχος ενταλμάτων',
      gotoLabel: 'Δείτε εντάλματα',
      checkLabel: 'Ελέγχθηκαν τα εντάλματα — τα ποσά είναι σωστά',
      saveLabel: 'Εντάξει — ελέγχθηκαν',
      steps: normalizeReviewSearchSteps(item),
    };
  }
  if (item.status === KHMDHS_REVIEW_STATUS.MISSING) {
    return {
      type: 'fill',
      verb: 'Συμπλήρωση',
      gotoLabel: 'Δείτε στη φόρμα',
      saveLabel: 'Αποθήκευση τιμής',
    };
  }
  if (item.status === KHMDHS_REVIEW_STATUS.NEEDS_REVIEW) {
    return {
      type: 'verify',
      verb: 'Έλεγχος',
      gotoLabel: 'Δείτε στη φόρμα',
      applyLabel: 'Χρήση πρότασης ΚΗΜΔΗΣ',
      saveLabel: 'Επιβεβαίωση',
    };
  }
  return { type: 'none', verb: '', gotoLabel: 'Δείτε στη φόρμα' };
}

export function canApplySuggestedReviewValue(item, formData) {
  if (!item?.displayValue) return false;
  if (item.fieldId === 'chainKindReview' || item.fieldId === 'assignmentProcedure') return false;
  const parsed = parseReviewDisplayValue(item);
  if (!parsed) return false;
  const current = getFormValueForReviewItem(formData, item);
  return normalizeReviewFieldValue(item, current) !== normalizeReviewFieldValue(item, parsed);
}

export function buildReviewFieldPatch(formData, item, explicitValue) {
  const value = explicitValue != null && explicitValue !== ''
    ? String(explicitValue)
    : parseReviewDisplayValue(item);
  if (!value || !item) return null;
  if (item.fieldId === 'chainKindReview') return {};
  const { fieldId, contractIndex, supplementaryIndex } = item;

  if (fieldId === 'projectBudget') return { projectBudget: value };
  if (fieldId === 'contractProcessStartDate') return { contractProcessStartDate: value };
  if (fieldId === 'assignmentProcedure') return { assignmentProcedure: value };
  if (fieldId === 'contractDate') {
    if (contractIndex != null) {
      const contracts = [...(formData.contracts || [])];
      if (!contracts[contractIndex]) return null;
      contracts[contractIndex] = { ...contracts[contractIndex], date: value };
      return { contracts };
    }
    return { contractDate: value };
  }
  if (fieldId === 'contractAmount') {
    if (contractIndex != null) {
      const contracts = [...(formData.contracts || [])];
      if (!contracts[contractIndex]) return null;
      contracts[contractIndex] = { ...contracts[contractIndex], amount: value };
      return { contracts };
    }
    return { contractAmount: value };
  }
  if (fieldId === 'supplementaryDate' || fieldId === 'supplementaryAmount') {
    return patchSupplementaryField(formData, item, value);
  }
  return null;
}

export function applyAllSuggestedReviewValues(formData, review) {
  let draft = formData;
  let changed = false;
  getUnresolvedReviewItems(review, formData).forEach((item) => {
    if (!canApplySuggestedReviewValue(item, draft)) return;
    const patch = buildReviewFieldPatch(draft, item);
    if (!patch) return;
    draft = { ...draft, ...patch };
    changed = true;
  });
  return changed ? draft : null;
}

/** Συμπλήρωση κενών πεδίων φόρμας από ολοκληρωμένα στοιχεία αναφοράς ελέγχου (πριν αποθήκευση) */
export function syncKhmdhsCompleteReviewFieldsToForm(formData) {
  const review = formData?.khmdhsDataQualityReview;
  if (!review?.items?.length) return formData;

  let draft = { ...formData };
  let changed = false;
  const multi = Array.isArray(draft.contracts) && draft.contracts.length > 0;

  const applyValue = (fieldId, contractIndex, value) => {
    if (value == null || value === '') return;
    const patch = buildReviewFieldPatch(draft, {
      fieldId,
      contractIndex: contractIndex ?? null,
    }, value);
    if (patch) {
      draft = { ...draft, ...patch };
      changed = true;
    }
  };

  review.items.forEach((item) => {
    if (item.status !== KHMDHS_REVIEW_STATUS.COMPLETE) return;
    const parsed = parseReviewDisplayValue(item);
    if (!parsed) return;

    if (item.fieldId === 'contractAmount') {
      const empty = item.contractIndex != null
        ? !String(draft.contracts?.[item.contractIndex]?.amount || '').trim()
        : !String(draft.contractAmount || '').trim();
      if (empty) applyValue('contractAmount', item.contractIndex, parsed);
    } else if (item.fieldId === 'contractDate') {
      const empty = item.contractIndex != null
        ? !String(draft.contracts?.[item.contractIndex]?.date || '').trim()
        : !String(draft.contractDate || '').trim();
      if (empty) applyValue('contractDate', item.contractIndex, parsed);
    } else if (item.fieldId === 'projectBudget' && !String(draft.projectBudget || '').trim()) {
      applyValue('projectBudget', null, parsed);
    } else if (item.fieldId === 'assignmentProcedure' && !String(draft.assignmentProcedure || '').trim()) {
      applyValue('assignmentProcedure', null, parsed);
    } else if (item.fieldId === 'contractProcessStartDate' && !String(draft.contractProcessStartDate || '').trim()) {
      applyValue('contractProcessStartDate', null, parsed);
    } else if (
      (item.fieldId === 'supplementaryAmount' || item.fieldId === 'supplementaryDate')
      && !multi
    ) {
      const idx = item.supplementaryIndex != null
        ? item.supplementaryIndex
        : findSupplementaryRowIndex(draft, item.chainAdam);
      if (idx >= 0) {
        const rowKey = item.fieldId === 'supplementaryAmount' ? 'amount' : 'date';
        if (!String(draft.supplementaryContracts?.[idx]?.[rowKey] || '').trim()) {
          const patch = patchSupplementaryField(draft, { ...item, supplementaryIndex: idx }, parsed);
          if (patch) {
            draft = { ...draft, ...patch };
            changed = true;
          }
        }
      }
    }
  });

  return changed ? draft : formData;
}

export function reviewItemToOverrideFieldKey(formData, item) {
  if (!item?.fieldId) return null;
  const { fieldId, contractIndex } = item;
  if (fieldId === 'contractAmount') {
    if (contractIndex != null) return contractRowFieldKey(contractIndex, 'amount');
    return 'contractAmount';
  }
  if (fieldId === 'contractDate') {
    if (contractIndex != null) return contractRowFieldKey(contractIndex, 'date');
    return 'contractDate';
  }
  if (fieldId === 'projectBudget') return 'projectBudget';
  if (fieldId === 'assignmentProcedure') return 'assignmentProcedure';
  if (fieldId === 'contractProcessStartDate') return 'contractProcessStartDate';
  if (fieldId === 'supplementaryAmount' || fieldId === 'supplementaryDate') {
    const subField = fieldId === 'supplementaryAmount' ? 'amount' : 'date';
    const idx = item.supplementaryIndex != null
      ? item.supplementaryIndex
      : findSupplementaryRowIndex(formData, item.chainAdam);
    const contract = idx >= 0
      ? (formData.supplementaryContracts || [])[idx]
      : { khmdhsAdam: item.chainAdam };
    return buildSupplementaryOverrideKey(subField, contract);
  }
  return null;
}

/** Το ποσό σύμβασης δεν αντικαθίσταται από επανυπολογισμό αλυσίδας αν το έχει ορίσει ο χρήστης. */
export function isContractAmountUserProtected(form, review, contractIndex = null) {
  const fieldKey = contractIndex != null
    ? contractRowFieldKey(contractIndex, 'amount')
    : 'contractAmount';
  if (hasFieldOverride(form, fieldKey)) return true;

  const item = getReviewItem(review, 'contractAmount', contractIndex, null);
  if (!item) return false;
  const resolution = review?.resolutions?.[reviewItemKey(item)];
  if (!resolution?.value || !String(resolution.value).trim()) return false;

  const suggested = parseReviewDisplayValue(item);
  if (!suggested) {
    return resolution.source === KHMDHS_RESOLUTION_SOURCE.USER_MANUAL;
  }
  return normalizeReviewFieldValue(item, resolution.value)
    !== normalizeReviewFieldValue(item, suggested);
}

function formatRegistryPaymentLinkLabel(baseLabel, amount) {
  const label = String(baseLabel || '').trim();
  const amt = String(amount || '').trim();
  if (!label) return '';
  if (!amt) return label;
  return `${label} : ${amt}`;
}

function syncPaymentLabelsToDocumentRegistry(formData) {
  const registry = formData?.khmdhsDocumentRegistry;
  if (!Array.isArray(registry) || !registry.length) return formData;
  const labels = mergePaymentLabelsFromProject(formData);
  if (!Object.keys(labels).length) return formData;

  let changed = false;
  const nextRegistry = registry.map((entry) => {
    if (entry?.stage !== 'PAY') return entry;
    const adam = String(entry?.adam || '').trim().toUpperCase();
    const custom = labels[adam];
    if (!custom || entry.roleLabel === custom) return entry;
    changed = true;
    return {
      ...entry,
      roleLabel: custom,
      linkLabel: formatRegistryPaymentLinkLabel(custom, entry.amount),
    };
  });
  if (!changed) return formData;
  return { ...formData, khmdhsDocumentRegistry: nextRegistry };
}

export function applyReviewResolution(formData, review, item, { value, source, resolvedBy = '', note = '', meta = null } = {}) {
  const inputKind = getReviewFieldInputKind(item);
  let nextForm = formData;
  let finalValue = value;
  const previousValue = getFormValueForReviewItem(formData, item);
  const khmdhsBaseline = parseReviewDisplayValue(item)
    || String(item.displayValue || '').replace(/\s*€\s*$/i, '').trim()
    || previousValue;

  if (inputKind === 'paymentClassification') {
    const paymentRoles = meta?.paymentRoles && typeof meta.paymentRoles === 'object'
      ? meta.paymentRoles
      : {};
    const paymentLabels = meta?.paymentLabels && typeof meta.paymentLabels === 'object'
      ? meta.paymentLabels
      : {};
    const paymentAmounts = meta?.paymentAmounts && typeof meta.paymentAmounts === 'object'
      ? meta.paymentAmounts
      : {};
    nextForm = applyPaymentRolesToProject(formData, paymentRoles, paymentLabels, paymentAmounts);
    nextForm = syncPaymentLabelsToDocumentRegistry(nextForm);
    finalValue = 'classified';
  } else if (inputKind !== 'acknowledge' && inputKind !== 'chainKindReview') {
    if (finalValue == null || finalValue === '') {
      finalValue = parseReviewDisplayValue(item) || previousValue;
    }
    const patch = buildReviewFieldPatch(formData, item, finalValue);
    if (patch) nextForm = { ...formData, ...patch };
    finalValue = getFormValueForReviewItem(nextForm, item) || finalValue;

    const fieldKey = reviewItemToOverrideFieldKey(nextForm, item);
    if (fieldKey && isTrackedKhmdhsScalarField(fieldKey)) {
      nextForm = recordKhmdhsFieldOverride(nextForm, {
        fieldKey,
        label: item.label || KHMDHS_OVERRIDE_FIELD_LABELS[fieldKey] || fieldKey,
        newValue: finalValue,
        previousValue,
        khmdhsBaseline,
      });
    }
  } else if (inputKind === 'acknowledge' || inputKind === 'chainKindReview') {
    finalValue = item.displayValue || 'confirmed';
  }

  const resolvedSource = source
    || (inputKind === 'acknowledge' || inputKind === 'chainKindReview' || inputKind === 'paymentClassification'
      ? KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED
      : KHMDHS_RESOLUTION_SOURCE.USER_MANUAL);

  let nextReview = resolveReviewItem(review, item, {
    value: finalValue,
    source: resolvedSource,
    resolvedBy,
    note,
    meta: inputKind === 'paymentClassification'
      ? {
        paymentRoles: meta?.paymentRoles || {},
        paymentLabels: meta?.paymentLabels || {},
        paymentAmounts: meta?.paymentAmounts || {},
        ...(meta?.acknowledgedPayableExceeds ? { acknowledgedPayableExceeds: true } : {}),
      }
      : meta,
  });
  nextReview = reconcileReviewState(nextReview, nextForm);

  return { formData: nextForm, review: nextReview };
}

export function isReviewItemUnresolved(review, formData, item) {
  if (!item) return false;
  return !isReviewItemResolved(review, formData, item);
}

export function extractPaymentAdamsFromReviewItem(item) {
  const recon = item?.paymentsReconciliation;
  if (Array.isArray(recon?.entries) && recon.entries.length) {
    return recon.entries
      .map((e, idx) => {
        const adam = String(e?.adam || '').trim().toUpperCase();
        if (!adam) return null;
        const payer = e.payer?.shortLabel || e.payer?.label || '';
        return {
          adam,
          label: `Ένταλμα ${idx + 1}${payer ? ` — ${payer}` : ''}`,
          inactive: e.active === false,
        };
      })
      .filter(Boolean);
  }

  const out = [];
  (item?.relatedInfo || []).forEach((r) => {
    if (!/ένταλμα/i.test(String(r.label || ''))) return;
    const m = String(r.value || '').match(/\b(\d{2}[A-Z]{4}\d+)\b/i);
    if (!m) return;
    out.push({
      adam: m[1].toUpperCase(),
      label: String(r.label || '').trim(),
      inactive: /ακυρωμένο|πιστωτικό/i.test(String(r.value || '')),
    });
  });
  return out;
}

export function extractKhmdhsAdamFromItem(item) {
  if (item?.fieldId === 'paymentsReconciliation') {
    const payments = extractPaymentAdamsFromReviewItem(item);
    const preferred = payments.find((p) => !p.inactive) || payments[0];
    return preferred?.adam || '';
  }
  const refs = item?.references || [];
  const codeRef = refs.find((r) => /κωδικ/i.test(String(r.label || '')));
  return codeRef?.value ? String(codeRef.value).trim() : (item.chainAdam || '');
}

export function buildReviewContextLine(item) {
  const parts = [];
  if (item.displayValue) {
    parts.push(`ΚΗΜΔΗΣ: ${item.displayValue}`);
  } else {
    parts.push('ΚΗΜΔΗΣ: —');
  }
  const related = (item.relatedInfo || []).slice(0, 3);
  related.forEach((r) => {
    if (r?.label && r?.value) parts.push(`${r.label}: ${r.value}`);
  });
  return parts.join(' · ');
}

/** Μετά τον χαρακτηρισμό: κλείνει τα εκκρεμή πεδία που συμπληρώθηκαν στην ίδια κάρτα */
export function applyChainKindFollowUpResolutions(review, formData, adam, choice) {
  if (!review || !adam || !choice?.kind) return { review, formData };
  let next = review;
  let nextForm = formData;
  const items = review.items || [];
  const normAdam = normalizeKhmdhsAdam(adam);

  const findSuppItem = (fieldId) => {
    const direct = items.find(
      (i) => i.fieldId === fieldId
        && i.chainAdam
        && normalizeKhmdhsAdam(i.chainAdam) === normAdam
    );
    if (direct) return direct;
    const suppIdx = findSupplementaryRowIndex(nextForm, adam);
    return items.find(
      (i) => i.fieldId === fieldId
        && (
          (i.chainAdam && normalizeKhmdhsAdam(i.chainAdam) === normAdam)
          || (i.supplementaryIndex != null && suppIdx >= 0 && i.supplementaryIndex === suppIdx)
        )
    ) || null;
  };

  const resolveSupp = (fieldId, value) => {
    if (!value || !String(value).trim()) return;
    let suppIdx = findSupplementaryRowIndex(nextForm, adam);
    if (suppIdx < 0) {
      const row = {
        date: '',
        amount: '',
        comments: '',
        khmdhsAdam: adam,
        khmdhsDerived: true,
      };
      nextForm = {
        ...nextForm,
        supplementaryContracts: [...(nextForm.supplementaryContracts || []), row],
        hasSupplementaryContracts: true,
      };
      suppIdx = nextForm.supplementaryContracts.length - 1;
    }
    const target = findSuppItem(fieldId) || {
      fieldId,
      chainAdam: adam,
      supplementaryIndex: suppIdx,
    };
    next = resolveReviewItem(next, target, {
      value: String(value).trim(),
      source: KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED,
    });
    const patch = buildReviewFieldPatch(nextForm, { ...target, supplementaryIndex: suppIdx }, String(value).trim());
    if (patch) nextForm = { ...nextForm, ...patch };
  };

  if (choice.kind === 'modification') {
    const suppIdx = findSupplementaryRowIndex(nextForm, adam);
    const suppRow = suppIdx >= 0 ? nextForm.supplementaryContracts?.[suppIdx] : null;
    const amountVal = String(suppRow?.amount || '').trim() || String(choice.modAmount || '').trim();
    const dateVal = String(suppRow?.date || '').trim() || String(choice.modDate || '').trim();
    if (amountVal) resolveSupp('supplementaryAmount', amountVal);
    if (dateVal) resolveSupp('supplementaryDate', dateVal);
  }

  next = reconcileReviewState(next, nextForm);
  return { review: next, formData: nextForm };
}

export const KHMDHS_PORTAL_SEARCH_URL = 'https://cerpp.eprocurement.gov.gr/upgkimdis/unprotected/home.xhtml';

/** Παράγωγα πεδία φόρμας από πλήρη αλυσίδα σύμβασης ΚΗΜΔΗΣ */

import { pickKhmdhsContractSnapshot } from './khmdhsContractDisplayFields';
import { pickKhmdhsNoticeSnapshot, projectHasKhmdhsNoticeData } from './khmdhsNoticeFields';
import { projectHasKhmdhsRequestData } from './khmdhsRequestFields';
import { projectHasKhmdhsAwardData } from './khmdhsAwardFields';
import { projectHasKhmdhsData, getKhmdhsDisplayEntries, isMultipleContractsForm } from './khmdhsFields';
import { getAllChainHistories } from './khmdhsChainFormAccess';
import {
  getReviewItem,
  getUnresolvedReviewItems,
  khmdhsFieldRequiresManualInput,
  KHMDHS_REVIEW_STATUS,
} from './khmdhsDataQualityReport';
import { hasFieldOverride, buildSupplementaryOverrideKey } from './khmdhsFieldOverrides';
import { CHAIN_KIND, computeChainCharacterizationEffects } from './khmdhsChainActions';
import { SYMV_CHAIN_ROLE } from './khmdhsSymvChainPlanner';

const RE_FINANCIAL_MOD = /τροποποι|αύξησ|αυξησ|μείωσ|μειωσ|οικονομικ|προσαύξ|προσαυξ|συμπληρωματικ|αναθεώρησ\s+τιμ/i;

function hasFiniteAmountFromHistory(h) {
  const snap = h?.snapshot;
  const budget = snap?.contractBudget;
  return budget != null && budget !== '' && Number.isFinite(Number(budget));
}

function hasFinancialSupplementarySignals(h) {
  const title = String(h.snapshot?.title || h.title || h.label || '').toLowerCase();
  const hasAmount = !!(h.contractAmount && String(h.contractAmount).trim())
    || hasFiniteAmountFromHistory(h);
  if (hasAmount) return true;
  return RE_FINANCIAL_MOD.test(title);
}

function isPureExtensionOnly(h) {
  const kind = h.effectiveKind || h.userKind || h.kind;
  const link = h.khmdhsLinkKind;
  if (kind === CHAIN_KIND.REPUBLICATION) return false;
  if (hasFinancialSupplementarySignals(h)) return false;
  if (kind === CHAIN_KIND.EXTENSION) return true;
  if (link === CHAIN_KIND.EXTENSION && h.suggestedKind !== CHAIN_KIND.MODIFICATION) return true;
  return false;
}

function needsAmendmentKindReviewBeforeAmount(h) {
  if (!h || h.isRoot) return false;
  const kind = h.effectiveKind || h.userKind || h.kind;
  if (kind === CHAIN_KIND.EXTENSION || kind === CHAIN_KIND.REPUBLICATION) return false;
  if (hasFinancialSupplementarySignals(h)) return false;
  if (h.needsReview || h.confidence !== 'high') return true;
  if (kind === CHAIN_KIND.UNCERTAIN || kind === CHAIN_KIND.OTHER) return true;
  if (h.suggestedKind === CHAIN_KIND.EXTENSION) return true;
  return false;
}

export function isChainSupplementaryCandidate(h) {
  if (!h?.adam || h.isRoot) return false;
  if (h.orphanSupplementary) return true;
  const kind = h.effectiveKind || h.userKind || h.kind;
  if (kind === CHAIN_KIND.REPUBLICATION) return false;
  if (isPureExtensionOnly(h)) return false;
  if (needsAmendmentKindReviewBeforeAmount(h)) return false;
  if (kind === CHAIN_KIND.MODIFICATION) return true;
  if (h.suggestedKind === CHAIN_KIND.MODIFICATION && h.confidence === 'high') return true;
  if (hasFinancialSupplementarySignals(h)) return true;
  return false;
}

/** Συμπληρωματικές γραμμές — μόνο μετά χαρακτηρισμό (ή legacy υψηλή βεβαιότητα) */
export function deriveSupplementaryContractsFromChainHistory(chainHistory, review = null) {
  const list = Array.isArray(chainHistory) ? chainHistory : [];
  if (!list.length) return [];
  return computeChainCharacterizationEffects(list, review).supplementaryContracts;
}

function collectAllChainHistories(form) {
  return getAllChainHistories(form).map(({ contractIndex, history }) => ({
    contractIndex,
    history,
  }));
}

function collectDerivedSupplementaryContracts(form, review = null) {
  const histories = collectAllChainHistories(form);
  let derived = [];
  histories.forEach(({ contractIndex, history }) => {
    const fromChain = computeChainCharacterizationEffects(history, review).supplementaryContracts;
    derived = derived.concat(fromChain.map((c) => ({
      ...c,
      ...(contractIndex != null ? { sourceContractIndex: contractIndex } : {}),
    })));
  });
  return derived;
}

function mergeDerivedByAdam(manualSupp, derivedFromChain) {
  const derivedByAdam = new Map();
  derivedFromChain.forEach((c) => {
    if (c.khmdhsAdam) derivedByAdam.set(c.khmdhsAdam, c);
  });
  return [...manualSupp, ...derivedByAdam.values()];
}

export function mergeKhmdhsSupplementaryIntoForm(form) {
  if (form?.khmdhsSymvChainPlan?.items?.length) return form;
  const review = form?.khmdhsDataQualityReview || null;
  const manualSupp = (form.supplementaryContracts || []).filter((c) => !c?.khmdhsDerived);
  const derivedFromChain = collectDerivedSupplementaryContracts(form, review);
  const supplementaryContracts = mergeDerivedByAdam(manualSupp, derivedFromChain);
  return {
    ...form,
    supplementaryContracts,
    hasSupplementaryContracts: supplementaryContracts.length > 0,
  };
}

/**
 * Εμφάνιση πεδίων «Συμπληρωματικές» στη φόρμα — μόνο όταν χρειάζεται χειροκίνητη επεξεργασία,
 * όχι αντίγραφο κρίκων της αλυσίδας ΚΗΜΔΗΣ.
 */
export function formShouldShowKhmdhsSupplementaryEditor(form, review = null) {
  const rev = review ?? form?.khmdhsDataQualityReview ?? null;
  const rows = form?.supplementaryContracts || [];
  if (rows.some((c) => !c?.khmdhsDerived)) return true;

  const derived = rows.filter((c) => c?.khmdhsDerived);
  const hasOverrides = derived.some(
    (c) => hasFieldOverride(form, buildSupplementaryOverrideKey('amount', c))
      || hasFieldOverride(form, buildSupplementaryOverrideKey('date', c))
  );
  if (hasOverrides) return true;

  // Συμπληρωματικές από κατανομή SYMV — επεξεργασία ποσού/ημερομηνίας στη φόρμα
  if (form?.khmdhsSymvChainPlan?.items?.some(
    (i) => i.role === SYMV_CHAIN_ROLE.SUPPLEMENTARY || i.role === SYMV_CHAIN_ROLE.EXTENSION
  )) {
    return true;
  }

  // Αν η αλυσίδα εμφανίζει ήδη τους κρίκους, ο έλεγχος/συμπλήρωση γίνεται εκεί — όχι διπλό πλαίσιο
  if (formChainDisplaysContractPanels(form)) return false;

  const pendingSupp = getUnresolvedReviewItems(rev, form).filter(
    (item) => item.fieldId === 'supplementaryAmount' || item.fieldId === 'supplementaryDate'
  );
  return pendingSupp.length > 0;
}

export function khmdhsChainHasLinkedAmendments(project) {
  if (isMultipleContractsForm(project?.implementationForm)) {
    return getAllChainHistories(project).some(
      ({ history }) => history.some((h) => h && !h.isRoot)
    );
  }
  return (project?.khmdhsContractChainHistory || []).some((h) => h && !h.isRoot);
}

export function countSupplementaryCandidatesFromForm(form, review = null) {
  const histories = getAllChainHistories(form);
  if (!histories.length) {
    return deriveSupplementaryContractsFromChainHistory(
      form?.khmdhsContractChainHistory || [],
      review
    ).length;
  }
  return histories.reduce(
    (sum, { history }) => sum + deriveSupplementaryContractsFromChainHistory(history, review).length,
    0
  );
}

export function projectHasKhmdhsDerivedSupplementary(project) {
  return !!(
    project?.hasSupplementaryContracts
    && Array.isArray(project.supplementaryContracts)
    && project.supplementaryContracts.some((c) => c?.khmdhsDerived)
  );
}

/** Τα βασικά στοιχεία σύμβασης (ημ/νία, ποσό) καλύπτονται από panel SYMV */
export function khmdhsCoversCoreContractFields(project) {
  if (!project) return false;
  const snap = pickKhmdhsContractSnapshot(project.khmdhsContractSnapshot);
  return !!(String(project.khmdhsAdam || '').trim() && snap);
}

function reviewAllowsHideField(review, fieldId, contractIndex = null) {
  if (!review?.items?.length) return true;
  const item = getReviewItem(review, fieldId, contractIndex);
  if (!item) return true;
  return item.status === KHMDHS_REVIEW_STATUS.COMPLETE;
}

function formContractFieldEmpty(project, fieldKey, contractIndex = null) {
  if (contractIndex != null) {
    return !String(project.contracts?.[contractIndex]?.[fieldKey] || '').trim();
  }
  return !String(project[fieldKey === 'amount' ? 'contractAmount' : 'contractDate'] || '').trim();
}

/** Κρύβει ημερομηνία σύμβασης μόνο αν είναι πλήρης στο ΚΗΜΔΗΣ */
export function formKhmdhsHidesManualContractDate(project, contractIndex = null) {
  if (!project) return false;
  if (formContractFieldEmpty(project, 'date', contractIndex)) return false;
  const review = project.khmdhsDataQualityReview;
  if (review?.items?.length) {
    if (khmdhsFieldRequiresManualInput(review, 'contractDate', contractIndex, null, project)) {
      return false;
    }
    return reviewAllowsHideField(review, 'contractDate', contractIndex);
  }
  if (contractIndex != null) {
    const row = project.contracts?.[contractIndex];
    return !!(row?.khmdhsAdam && row?.date);
  }
  if (formChainDisplaysContractPanels(project)) return true;
  return khmdhsCoversCoreContractFields(project) && !!project.contractDate;
}

/** Κρύβει ποσό σύμβασης μόνο αν είναι πλήρες στο ΚΗΜΔΗΣ */
export function formKhmdhsHidesManualContractAmount(project, contractIndex = null) {
  if (!project) return false;
  if (formContractFieldEmpty(project, 'amount', contractIndex)) return false;
  const review = project.khmdhsDataQualityReview;
  if (review?.items?.length) {
    if (khmdhsFieldRequiresManualInput(review, 'contractAmount', contractIndex, null, project)) {
      return false;
    }
    return reviewAllowsHideField(review, 'contractAmount', contractIndex);
  }
  if (contractIndex != null) {
    const row = project.contracts?.[contractIndex];
    return !!(row?.khmdhsAdam && row?.amount);
  }
  if (formChainDisplaysContractPanels(project)) return true;
  return khmdhsCoversCoreContractFields(project) && !!project.contractAmount;
}

/** Κρύβει διαδικασία ανάθεσης μόνο αν αντιστοιχίστηκε πλήρως */
export function formKhmdhsHidesManualAssignmentProcedure(project) {
  if (!project) return false;
  const review = project.khmdhsDataQualityReview;
  if (review?.items?.length) {
    return reviewAllowsHideField(review, 'assignmentProcedure');
  }
  return khmdhsCoversAssignmentProcedureDisplay(project);
}

/** Κρύβει ημ. έναρξης διαδικασίας μόνο αν βρέθηκε πλήρως */
export function formKhmdhsHidesManualProcessStart(project) {
  if (!project) return false;
  const review = project.khmdhsDataQualityReview;
  if (review?.items?.length) {
    return reviewAllowsHideField(review, 'contractProcessStartDate');
  }
  return khmdhsCoversContractProcessStart(project) && !!project.contractProcessStartDate;
}

/** Κρύβει προϋπολογισμό αιτήματος μόνο αν βρέθηκε πλήρως */
export function formKhmdhsHidesManualProjectBudget(project) {
  if (!project) return false;
  const review = project.khmdhsDataQualityReview;
  if (review?.items?.length) {
    return reviewAllowsHideField(review, 'projectBudget');
  }
  return !!project.projectBudget;
}

/** Κρύβει ημερομηνία λήξης όταν προέρχεται από ΚΗΜΔΗΣ */
export function formKhmdhsHidesManualContractEndDate(project, contractIndex = null) {
  if (!project) return false;
  if (contractIndex != null) {
    const row = project.contracts?.[contractIndex];
    if (!row) return false;
    const snap = row.khmdhsContractSnapshot;
    if (snap?.noEndDate) return true;
    if (row.contractEndDate && (snap?.endDate || row.khmdhsAdam)) return true;
    return false;
  }
  const snap = project.khmdhsContractSnapshot;
  if (snap?.noEndDate) return true;
  if (project.contractEndDate && (snap?.endDate || project.khmdhsAdam)) return true;
  return false;
}

/** Στη φόρμα: κρύβουμε χειροκίνητα πεδία σύμβασης όταν υπάρχουν πλήρη αποτελέσματα ΚΗΜΔΗΣ */
export function formKhmdhsHidesManualContractCore(project, contractIndex = null) {
  if (!project) return false;
  if (formChainDisplaysContractPanels(project)) return true;
  const hasKhmdhsResults = (
    projectHasKhmdhsRequestData(project)
    || projectHasKhmdhsNoticeData(project)
    || projectHasKhmdhsAwardData(project)
    || projectHasKhmdhsData(project)
  );
  if (!hasKhmdhsResults) return false;
  return (
    formKhmdhsHidesManualContractDate(project, contractIndex)
    && formKhmdhsHidesManualContractAmount(project, contractIndex)
  );
}

/** Η αλυσίδα ΚΗΜΔΗΣ εμφανίζει ήδη panel σύμβασης (SYMV) — όχι διπλό πλαίσιο στη φόρμα */
export function formChainDisplaysContractPanels(project) {
  if (!project) return false;
  return getKhmdhsDisplayEntries(project).length > 0;
}

/** Ημ. έναρξης διαδικασίας — ήδη στο panel PROC */
export function khmdhsCoversContractProcessStart(project) {
  return !!pickKhmdhsNoticeSnapshot(project?.khmdhsNoticeSnapshot);
}

/** Διαδικασία ανάθεσης — ήδη στο panel PROC (ή λείπει από ΚΗΜΔΗΣ) */
export function khmdhsCoversAssignmentProcedureDisplay(project) {
  return khmdhsCoversContractProcessStart(project);
}

export { khmdhsFieldRequiresManualInput };

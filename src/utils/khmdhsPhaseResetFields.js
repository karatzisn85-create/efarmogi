/**
 * Πεδία που μηδενίζονται σε επαναφορά Φάσης Β ή πλήρη καθαρισμό ασύμβατων δεδομένων ΚΗΜΔΗΣ.
 */

import { emptyKhmdhsChainFields } from './khmdhsChainApply';
import { emptyKhmdhsUserEdits } from './khmdhsFieldOverrides';
import { emptyKhmdhsOnContract } from './khmdhsFields';

/** Καθαρισμός χειροκίνητων πεδίων σύμβασης/ΑΠΕ σε μία γραμμή contracts[] */
export function clearContractRowManualFields(row) {
  const base = row && typeof row === 'object' ? row : {};
  return {
    ...base,
    date: '',
    amount: '',
    contractEndDate: '',
    apeAmount: '',
    comments: '',
    ...emptyKhmdhsOnContract(),
  };
}

export function buildKhmdhsDocumentRegistryResetFields() {
  return {
    khmdhsDocumentRegistry: [],
    khmdhsDocumentRegistryDismissed: false,
    khmdhsRelatedDocuments: [],
  };
}

/** Πλήρης μηδενισμός Φάσης Β / αλυσίδας ΚΗΜΔΗΣ (όχι Φάση Α εκτός πεδίων σύμβασης). */
export function buildFullKhmdhsPhaseBResetFields() {
  return {
    ...emptyKhmdhsChainFields(),
    ...buildKhmdhsDocumentRegistryResetFields(),
    khmdhsChainSeedAdam: '',
    khmdhsBranchAnchorAdam: '',
    khmdhsBranchAnchorType: '',
    khmdhsActRootReqAdam: '',
    khmdhsAcknowledgedSituationIds: [],
    khmdhsUserEdits: emptyKhmdhsUserEdits(),
    assignmentProcedure: '',
    contractProcessStartDate: '',
    contractDate: '',
    contractEndDate: '',
    contractAmount: '',
    apeAmount: '',
    apeComments: '',
    projectBudget: '',
    contracts: [],
    hasSupplementaryContracts: false,
    supplementaryContracts: [],
  };
}

/** Αφαιρεί αποθηκευμένο σχέδιο SYMV χωρίς υπόλοιπα δεδομένα αλυσίδας (μετά ελλιπή επαναφορά). */
export function stripOrphanKhmdhsSymvPlan(form) {
  if (!form?.khmdhsSymvChainPlan?.items?.length) return form;
  const hasChainFootprint = !!(
    String(form.khmdhsChainSeedAdam || '').trim()
    || String(form.khmdhsAdam || '').trim()
    || (form.khmdhsContractChainHistory || []).length
    || (form.supplementaryContracts || []).length
    || form.khmdhsDataQualityReview?.items?.length
    || form.khmdhsContractSnapshot
    || (form.contracts || []).some((c) => c?.khmdhsAdam || c?.khmdhsContractSnapshot)
  );
  if (hasChainFootprint) return form;
  return {
    ...form,
    khmdhsSymvChainPlan: null,
    khmdhsSymvPlanAppliedAt: '',
    khmdhsChainLastRefreshedAt: '',
  };
}

/** Καθαρισμός σύμβασης/ενταλμάτων όταν η κατάσταση δεν απαιτεί υπογεγραμμένη σύμβαση. */
export function buildPreContractKhmdhsClearFields() {
  return {
    khmdhsAdam: '',
    khmdhsContractSnapshot: null,
    khmdhsContractFetchedAt: '',
    khmdhsAwardAdam: '',
    khmdhsAwardSnapshot: null,
    khmdhsAwardFetchedAt: '',
    khmdhsPayments: [],
    khmdhsContractAmendments: [],
    khmdhsContractChainHistory: [],
    khmdhsContractRoleLabel: '',
    khmdhsAdamChainMeta: null,
    khmdhsDataQualityReview: null,
    khmdhsSymvChainPlan: null,
    khmdhsSymvPlanAppliedAt: '',
    khmdhsChainLastRefreshedAt: '',
    ...buildKhmdhsDocumentRegistryResetFields(),
    khmdhsUserEdits: emptyKhmdhsUserEdits(),
    contractDate: '',
    contractEndDate: '',
    contractAmount: '',
    apeAmount: '',
    apeComments: '',
    contracts: [],
    hasSupplementaryContracts: false,
    supplementaryContracts: [],
  };
}

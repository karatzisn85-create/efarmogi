/**
 * Πεδία που μηδενίζονται σε επαναφορά Φάσης Β ή πλήρη καθαρισμό ασύμβατων δεδομένων ΚΗΜΔΗΣ.
 */

import { emptyKhmdhsChainFields } from './khmdhsChainApply';
import { emptyKhmdhsUserEdits } from './khmdhsFieldOverrides';
import { emptyKhmdhsOnContract } from './khmdhsFields';
import { emptyLegacyApeFields } from './khmdhsApeEntry';

/** Κατάσταση μετά από πλήρη επαναφορά αλυσίδας ΚΗΜΔΗΣ — χωρίς υποχρεωτικό ΑΔΑΜ για αποθήκευση. */
export const KHMDHS_CHAIN_RESET_PROJECT_STATUS = 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ';

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
    khmdhsChainStitchPlan: null,
    khmdhsAcknowledgedSituationIds: [],
    khmdhsUserEdits: emptyKhmdhsUserEdits(),
    assignmentProcedure: '',
    contractProcessStartDate: '',
    contractDate: '',
    contractEndDate: '',
    contractAmount: '',
    ...emptyLegacyApeFields(),
    projectBudget: '',
    contracts: [],
    hasSupplementaryContracts: false,
    supplementaryContracts: [],
  };
}

/** Πλήρης επαναφορά αλυσίδας + κατάσταση «Υπό βραχυπρόθεσμη ωρίμανση» για άμεση αποθήκευση. */
export function buildKhmdhsChainResetPayload() {
  return {
    ...buildFullKhmdhsPhaseBResetFields(),
    projectStatus: KHMDHS_CHAIN_RESET_PROJECT_STATUS,
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
    khmdhsChainStitchPlan: null,
    khmdhsChainLastRefreshedAt: '',
    ...buildKhmdhsDocumentRegistryResetFields(),
    khmdhsUserEdits: emptyKhmdhsUserEdits(),
    contractDate: '',
    contractEndDate: '',
    contractAmount: '',
    ...emptyLegacyApeFields(),
    contracts: [],
    hasSupplementaryContracts: false,
    supplementaryContracts: [],
  };
}

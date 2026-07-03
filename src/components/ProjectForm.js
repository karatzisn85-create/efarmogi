import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScrollLock';
import styled, { keyframes } from 'styled-components';
import { safeFileDialog } from '../utils/safeDialogs';
import { showConfirm } from '../utils/confirmModal';
import ProjectFormUnsavedModal from './ProjectFormUnsavedModal';
import {
  buildProjectFormFingerprint,
  hasUnsavedProjectFormChanges,
} from '../utils/projectFormUnsaved';
import { useToast } from './ToastProvider';
import { v4 as uuidv4 } from 'uuid';
import {
  IMPLEMENTATION_FORMS,
  PROJECT_TYPES,
  FUNDING_SOURCES,
  PROJECT_STATUSES,
  FUNDING_DETAILS,
  ASSIGNMENT_PROCEDURES,
  STATUSES_WITH_CONTRACT_FIELDS,
  STATUSES_WITH_KHMDHS_ADAM,
  statusShowsAssignmentProcedure,
  PROJECT_STATUS_CONTRACT_PROCESS,
  isAbandonedSubproject,
} from '../data/formOptions';
import {
  emptyKhmdhsOnContract,
  isMultipleContractsForm,
  normalizeContractsFromProject,
  resolveStoredApeAmount,
} from '../utils/khmdhsFields';
import {
  applyApeEntryToProject,
  buildDefaultApeFileGroupTitle,
  buildDefaultApeFileName,
  clearApeEntryFromProject,
  readContractApeFields,
  readSupplementaryApeFields,
  readApeFileRef,
  sanitizeLegacyApeCommentsPollution,
} from '../utils/khmdhsApeEntry';
import {
  pickKhmdhsNoticeSnapshot,
  resolveAssignmentProcedureFromNotice,
  resolveKhmdhsNoticeAssignmentProcedure,
  noticeDrivesAssignmentProcedure,
  formatKhmdhsDateOnly,
} from '../utils/khmdhsNoticeFields';
import KhmdhsLifecycleRail from './KhmdhsLifecycleRail';
import KhmdhsFormStageResults, { projectHasKhmdhsFormResults } from './KhmdhsFormStageResults';
import KhmdhsPendingFab from './KhmdhsPendingFab';
import KhmdhsInlineField from './KhmdhsInlineField';
import KhmdhsRemovableChainEntries from './KhmdhsRemovableChainEntries';
import KhmdhsUserEditsPanel from './KhmdhsUserEditsPanel';
import KhmdhsFieldOverrideBadge from './KhmdhsFieldOverrideBadge';
import KhmdhsPreSaveOverridesModal from './KhmdhsPreSaveOverridesModal';
import KhmdhsStatusCleanupModal from './KhmdhsStatusCleanupModal';
import FundingOptionsModal from './FundingOptionsModal';
import {
  checkProjectDirectAssignmentCompliance,
  formatViolationSummary
} from '../utils/directAssignmentCompliance';
import { isAppDateBefore } from '../utils/dateFormat';
import {
  pickPhaseASnapshot,
  serializePhaseASnapshot,
  isPhaseADirty,
} from '../utils/projectFormPhases';
import {
  getKhmdhsAdamGuidance,
  khmdhsAdamTypeById,
  parseKhmdhsAdamType,
  KHMDHS_ADAM_TYPES,
  suggestProjectStatusAfterKhmdhsChain,
} from '../utils/khmdhsAdamGuidance';
import {
  evaluateKhmdhsContractExpiryPrompt,
  KHMDHS_COMPLETED_STATUS_SUGGESTION,
} from '../utils/khmdhsContractExpiryPrompt';
import {
  needsKhmdhsLegacyUpgrade,
  getKhmdhsUpgradeSeedAdam,
  getKhmdhsUpgradeContractIndex,
  khmdhsLegacyUpgradePendingSave,
} from '../utils/khmdhsLegacyUpgrade';
import {
  formKhmdhsHidesManualContractCore,
  formKhmdhsHidesManualContractDate,
  formKhmdhsHidesManualContractAmount,
  formKhmdhsHidesManualContractEndDate,
  formKhmdhsHidesManualAssignmentProcedure,
  formKhmdhsHidesManualProcessStart,
  formKhmdhsHidesManualProjectBudget,
  formChainDisplaysContractPanels,
  khmdhsFieldRequiresManualInput,
  deriveSupplementaryContractsFromChainHistory,
  khmdhsChainHasLinkedAmendments,
  mergeKhmdhsSupplementaryIntoForm,
  formShouldShowKhmdhsSupplementaryEditor,
} from '../utils/khmdhsChainDerivedFields';
import {
  collectAllChainAdams,
  resolveSupplementaryTargetContractIndex,
  findChainEntry,
  buildSupplementaryAmountContextFromForm,
} from '../utils/khmdhsChainFormAccess';
import KhmdhsApeConflictModal from './KhmdhsApeConflictModal';
import KhmdhsApeEntryModal from './KhmdhsApeEntryModal';
import KhmdhsManualExtensionModal from './KhmdhsManualExtensionModal';
import {
  applyExtensionEntryToProject,
  clearExtensionEntryFromProject,
  listContractExtensionEntries,
  buildDefaultExtensionFileName,
} from '../utils/khmdhsManualContractExtension';
import { getKhmdhsAmountSanityReference } from '../utils/projectAmountUtils';
import KhmdhsSituationModal from './KhmdhsSituationModal';
import KhmdhsBranchPickerDialog from './KhmdhsBranchPickerDialog';
import KhmdhsDuplicateAnchorDialog from './KhmdhsDuplicateAnchorDialog';
import KhmdhsSupplementaryConfirmDialog from './KhmdhsSupplementaryConfirmDialog';
import KhmdhsContractExpiryPromptDialog from './KhmdhsContractExpiryPromptDialog';
import KhmdhsSymvChainPlannerDialog from './KhmdhsSymvChainPlannerDialog';
import { shouldOfferSymvChainPlanner, symvPlanMatchesChain } from '../utils/khmdhsSymvChainPlanner';
import KhmdhsDocumentRegistryModal from './KhmdhsDocumentRegistryModal';
import KhmdhsRelatedDocumentsModal from './KhmdhsRelatedDocumentsModal';
import {
  buildRegistryModalPayloadAfterReview,
  mergeKhmdhsDocumentRegistry,
  shouldOfferRegistryAfterReview,
} from '../utils/khmdhsDocumentRegistry';
import {
  buildRelatedDocumentEntry,
  mergeKhmdhsRelatedDocuments,
} from '../utils/khmdhsRelatedDocuments';
import {
  buildBranchCandidatesFromChainRes,
  branchPickerAllowsAllBranches,
  checkKhmdhsDuplicateConflicts,
  acknowledgeKhmdhsDuplicateConflict,
  checkTitleMismatchWarning,
  inferActRootReqAdam,
  mergeBranchAnchorFields,
  needsBranchPicker,
  normalizeKhmdhsAdam,
  resolveBranchAnchorFromChain,
  suggestBestBranchCandidate,
} from '../utils/khmdhsBranchAnchor';
import KhmdhsDataReviewModal, {
  KhmdhsDataReviewBanner,
  KhmdhsFieldReviewHint,
  KhmdhsChainReviewHints,
} from './KhmdhsDataReviewModal';
import {
  mergeDataQualityReviews,
  mergeKhmdhsReviewAfterFetch,
  pruneResolutionsToItems,
  pruneResolutionsByChainAdams,
  reconcileReviewState,
  validateKhmdhsDataQualityReview,
  applyReviewResolution,
  revokeReviewResolution,
  revertScalarFieldForRevokedItem,
  isChainKindReviewKey,
  reviewItemKey,
  getUnresolvedReviewItems,
  canApplySuggestedReviewValue,
  parseReviewDisplayValue,
  KHMDHS_RESOLUTION_SOURCE,
  applyChainKindFollowUpResolutions,
  syncKhmdhsCompleteReviewFieldsToForm,
} from '../utils/khmdhsDataQualityReport';
import { openExternalUrl } from '../utils/openExternalUrl';
import {
  removeSupplementaryContractFromForm,
  removeNonRootChainHistoryEntry,
} from '../utils/khmdhsUserOverrides';
import { appendChainEntryToDataQualityReview } from '../utils/khmdhsChainReviewItems';
import {
  applyUserEditsAfterKhmdhsFetch,
  recordKhmdhsFieldOverride,
  revertKhmdhsFieldOverride,
  buildSupplementaryOverrideKey,
  isTrackedKhmdhsScalarField,
  KHMDHS_OVERRIDE_FIELD_LABELS,
  contractRowFieldKey,
  KHMDHS_CONTRACT_ROW_FIELD_LABELS,
  clearAllKhmdhsUserEdits,
  emptyKhmdhsUserEdits,
  ensureKhmdhsUserEdits,
  hasFieldOverride,
  countActiveFieldOverrides,
  getActiveKhmdhsOverrides,
  updateKhmdhsFieldOverrideComment,
} from '../utils/khmdhsFieldOverrides';
import {
  resolveChainKindChoice,
  computeChainCharacterizationEffects,
  enrichChainHistoryWithReview,
  CHAIN_KIND_LABEL,
} from '../utils/khmdhsChainActions';
import {
  KHMDHS_SITUATION_ACTION,
  KHMDHS_SITUATION_ID_PARALLEL_CONTRACTS,
  shouldDeferKhmdhsApplyForSituation,
  shouldShowKhmdhsSituationModal,
  refineSituationReportForBranchSelection,
} from '../utils/khmdhsSituationActions';
import {
  migrateKhmdhsSingleToMultiForm,
  migrateKhmdhsMultiToSingleForm,
  purgeKhmdhsDataAfterContractRemoval,
} from '../utils/khmdhsImplementationFormMigration';
import {
  applyAdamChainResult,
  applyChainCharacterizationToForm,
  emptyKhmdhsChainFields,
} from '../utils/khmdhsChainApply';
import { mergeSymvChainPlanIntoDataQualityReview, shouldMergeSymvPlanIntoDataQualityReview } from '../utils/khmdhsSymvChainApply';
import {
  shouldRouteAdamAsSupplementaryAdd,
  getStoredChainSeedAdam,
} from '../utils/khmdhsChainPresence';
import { assessSupplementaryCrossAct } from '../utils/khmdhsSupplementaryAssess';
import {
  buildFullKhmdhsPhaseBResetFields,
  buildKhmdhsChainResetPayload,
  buildPreContractKhmdhsClearFields,
  clearContractRowManualFields,
  stripOrphanKhmdhsSymvPlan,
} from '../utils/khmdhsPhaseResetFields';

const ipcRenderer = window.electronAPI;

const ADAM_FORMAT_REGEX = /^(\d{2})([A-Z]{3,4})(\d{9})$/i;
const ADAM_MAX_LEN = 15; // 2 + 4 + 9

function loadContractsFromProject(project) {
  if (!project) return [];
  if (isMultipleContractsForm(project.implementationForm)) {
    return normalizeContractsFromProject(project);
  }
  return [];
}

function statusRequiresKhmdhsAdam(status) {
  return STATUSES_WITH_KHMDHS_ADAM.includes(status);
}

/** Μόνο έγκυροι χαρακτήρες ΑΔΑΜ κατά την πληκτρολόγηση */
function sanitizeAdamInput(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ADAM_MAX_LEN);
}

/**
 * @param {'live'|'strict'} mode — live: σφάλμα μόνο σε πλήρες μήκος (δεν «κολλάει» κατά την πληκτρολόγηση)
 */
function getAdamFieldError(value, mode = 'strict') {
  const adam = sanitizeAdamInput(value);
  if (!adam) return null;
  if (ADAM_FORMAT_REGEX.test(adam)) return null;
  if (mode === 'live' && adam.length < ADAM_MAX_LEN) return null;
  return 'Μη έγκυρη μορφή ΑΔΑΜ. Χρησιμοποιήστε μορφή όπως 26SYMV018523441 (έτος + τύπος π.χ. SYMV + 9 ψηφία).';
}

const NOTICE_ADAM_REGEX = /^(\d{2})PROC(\d{9})$/i;

function getNoticeAdamFieldError(value, mode = 'strict') {
  const adam = sanitizeAdamInput(value);
  if (!adam) return null;
  if (NOTICE_ADAM_REGEX.test(adam)) return null;
  if (mode === 'live' && adam.length < ADAM_MAX_LEN) return null;
  return 'Μη έγκυρη μορφή ΑΔΑΜ προκήρυξης/πρόσκλησης. Χρησιμοποιήστε μορφή 26PROC018492003 (έτος + PROC + 9 ψηφία).';
}

function isoFromKhmdhsDate(value) {
  if (!value) return '';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function resolveNoticeKhmdhsForSave(formData, editingProject) {
  const adam = sanitizeAdamInput(formData.khmdhsNoticeAdam);
  const snapshotForm = pickKhmdhsNoticeSnapshot(formData.khmdhsNoticeSnapshot);
  const snapshotStored = editingProject ? pickKhmdhsNoticeSnapshot(editingProject.khmdhsNoticeSnapshot) : null;
  const snapshot = snapshotForm || (adam && snapshotStored ? snapshotStored : null);
  const fetchedAt = adam
    ? String(formData.khmdhsNoticeFetchedAt || editingProject?.khmdhsNoticeFetchedAt || '')
    : '';
  if (!adam) {
    return { khmdhsNoticeAdam: '', khmdhsNoticeSnapshot: null, khmdhsNoticeFetchedAt: '' };
  }
  return {
    khmdhsNoticeAdam: adam,
    khmdhsNoticeSnapshot: snapshot,
    khmdhsNoticeFetchedAt: fetchedAt,
    assignmentProcedure: '',
  };
}

function statusRetainsKhmdhsNotice(status) {
  return statusShowsAssignmentProcedure(status);
}

function pickKhmdhsSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const out = {
    referenceNumber: snapshot.referenceNumber || null,
    title: snapshot.title || null,
    anadoxosName: snapshot.anadoxosName || null,
    anadoxosVat: snapshot.anadoxosVat != null ? String(snapshot.anadoxosVat) : null,
    assigningAuthority: snapshot.assigningAuthority || null,
    contractSignedDate: snapshot.contractSignedDate || null,
    startDate: snapshot.startDate || null,
    endDate: snapshot.endDate || null,
    noEndDate: snapshot.noEndDate === true,
    contractBudget: snapshot.contractBudget != null ? snapshot.contractBudget : null,
    contractBudgetSuppressed: snapshot.contractBudgetSuppressed === true,
    resolvedContractAmount: snapshot.resolvedContractAmount != null ? snapshot.resolvedContractAmount : null,
    contractAmountSource: snapshot.contractAmountSource || null,
    contractDuration: snapshot.contractDuration != null ? snapshot.contractDuration : null,
    contractDurationUnit: snapshot.contractDurationUnit || null,
    cancelled: snapshot.cancelled === true,
    prevReferenceNo: snapshot.prevReferenceNo || null,
    nextRefNo: snapshot.nextRefNo || null,
    nextExtended: snapshot.nextExtended === true,
    nextModified: snapshot.nextModified === true,
    noticeReferenceNumber: snapshot.noticeReferenceNumber || null,
    auctionRefNo: snapshot.auctionRefNo || null,
  };
  const hasData = out.anadoxosName || out.anadoxosVat || out.assigningAuthority
    || out.referenceNumber || out.contractSignedDate || out.contractBudget != null;
  if (!hasData) return null;
  return out;
}

function resolveSingleKhmdhsForSave(formData, editingProject) {
  const adam = sanitizeAdamInput(formData.khmdhsAdam);
  const snapshotForm = pickKhmdhsSnapshot(formData.khmdhsContractSnapshot);
  const snapshotStored = editingProject ? pickKhmdhsSnapshot(editingProject.khmdhsContractSnapshot) : null;
  const snapshot = snapshotForm || (adam && snapshotStored ? snapshotStored : null);
  const fetchedAt = adam
    ? String(formData.khmdhsContractFetchedAt || editingProject?.khmdhsContractFetchedAt || '')
    : '';
  if (!adam) {
    return { khmdhsAdam: '', khmdhsContractSnapshot: null, khmdhsContractFetchedAt: '' };
  }
  return { khmdhsAdam: adam, khmdhsContractSnapshot: snapshot, khmdhsContractFetchedAt: fetchedAt };
}

function resolveContractKhmdhsRow(contract, existingContract) {
  const adam = sanitizeAdamInput(contract?.khmdhsAdam);
  const snapshotForm = pickKhmdhsSnapshot(contract?.khmdhsContractSnapshot);
  const snapshotStored = existingContract ? pickKhmdhsSnapshot(existingContract.khmdhsContractSnapshot) : null;
  const snapshot = snapshotForm || (adam && snapshotStored ? snapshotStored : null);
  const fetchedAt = adam
    ? String(contract?.khmdhsContractFetchedAt || existingContract?.khmdhsContractFetchedAt || '')
    : '';
  if (!adam) {
    return { ...contract, ...emptyKhmdhsOnContract() };
  }
  return {
    ...contract,
    khmdhsAdam: adam,
    khmdhsContractSnapshot: snapshot,
    khmdhsContractFetchedAt: fetchedAt
  };
}

/** Διατήρηση ΑΔΑΜ/ΚΗΜΔΗΣ — μία σύμβαση στο έργο ή ανά σύμβαση στο contracts[] */
function resolveKhmdhsFieldsForSave(formData, editingProject) {
  if (isMultipleContractsForm(formData.implementationForm)) {
    const contracts = (formData.contracts || []).map((c, i) =>
      resolveContractKhmdhsRow(c, editingProject?.contracts?.[i])
    );
    return {
      contracts,
      khmdhsAdam: '',
      khmdhsContractSnapshot: null,
      khmdhsContractFetchedAt: ''
    };
  }
  return {
    contracts: [],
    ...resolveSingleKhmdhsForSave(formData, editingProject)
  };
}

/** Καθαρισμός πεδίων σύμβασης ανά μορφή υλοποίησης κατά την αποθήκευση */
function resolveContractStorageForSave(formData, editingProject) {
  const khmdhs = resolveKhmdhsFieldsForSave(formData, editingProject);
  if (isMultipleContractsForm(formData.implementationForm)) {
    return {
      ...khmdhs,
      contractDate: '',
      contractEndDate: '',
      contractAmount: '',
      apeAmount: '',
      apeComments: ''
    };
  }
  return khmdhs;
}



/** Πλήρης επαναφορά Φάσης Β — χωρίς επίδραση στη Φάση Α (εκτός κατάστασης έργου). */
function emptyPhaseBFields() {
  return buildKhmdhsChainResetPayload();
}

function projectHasPhaseBData(formData) {
  if (!formData) return false;
  if (projectHasKhmdhsFormResults(formData)) return true;
  if (sanitizeAdamInput(formData.khmdhsChainSeedAdam)) return true;
  if (formData.assignmentProcedure) return true;
  if (formData.contractProcessStartDate) return true;
  if (formData.contractDate || formData.contractEndDate || formData.contractAmount) return true;
  if (formData.apeAmount || formData.apeComments) return true;
  if ((formData.apeEntries || []).length > 0) return true;
  if (formData.apeSourceAdam || formData.apeDocumentDate || formData.apeFileName) return true;
  if (formData.projectBudget) return true;
  if ((formData.contracts || []).length > 0) return true;
  if ((formData.supplementaryContracts || []).length > 0) return true;
  if (formData.hasSupplementaryContracts) return true;
  if ((formData.khmdhsAcknowledgedSituationIds || []).length > 0) return true;
  if ((formData.khmdhsDocumentRegistry || []).length > 0) return true;
  if ((formData.khmdhsRelatedDocuments || []).length > 0) return true;
  if (formData.khmdhsSymvChainPlan?.items?.length) return true;
  if (formData.khmdhsDataQualityReview?.items?.length) return true;
  const overrides = formData.khmdhsUserEdits?.fieldOverrides;
  if (overrides && Object.keys(overrides).length > 0) return true;
  const excluded = formData.khmdhsUserEdits?.excludedChainAdams;
  if (excluded && excluded.length > 0) return true;
  return false;
}

function clearPhaseBErrors(prevErrors) {
  const next = { ...prevErrors };
  [
    'khmdhsChainSeedAdam',
    'khmdhsSupplementaryAdam',
    'khmdhsSharedChain',
    'khmdhsAdam',
    'khmdhsNoticeAdam',
    'assignmentProcedure',
    'contractProcessStartDate',
    'contractDate',
    'contractEndDate',
    'contractAmount',
    'apeAmount',
    'projectBudget',
  ].forEach((key) => { delete next[key]; });
  Object.keys(next).forEach((key) => {
    if (/^(khmdhsAdam|supplementaryAmount|supplementaryDate)\d+$/.test(key)) {
      delete next[key];
    }
  });
  return next;
}

/**
 * Ελέγχει αν η επιλεγμένη κατάσταση αντιφάτει με υπάρχοντα ΚΗΜΔΗΣ δεδομένα.
 * Επιστρέφει { message, clearFields } αν υπάρχει ασυμβατότητα, αλλιώς null.
 */
function detectStatusKhmdhsIncompatibility(formData) {
  const status = formData.projectStatus || '';
  const hasPayments = Array.isArray(formData.khmdhsPayments) && formData.khmdhsPayments.length > 0;
  const hasKhmdhsContract = !!(formData.khmdhsContractSnapshot || formData.khmdhsAdam);
  const hasAward = !!(formData.khmdhsAwardSnapshot || formData.khmdhsAwardAdam);
  const hasNotice = !!(formData.khmdhsNoticeSnapshot || formData.khmdhsNoticeAdam);
  const hasPhaseAContract = !!(
    formData.contractDate
    || formData.contractAmount
    || (Array.isArray(formData.contracts) && formData.contracts.length > 0)
  );
  const hasSymvPlan = !!(formData.khmdhsSymvChainPlan?.items?.length);
  const hasAnyData = hasPayments || hasKhmdhsContract || hasAward || hasNotice || hasPhaseAContract || hasSymvPlan;

  if (status === 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ' && hasAnyData) {
    return {
      scope: 'full',
      clearFields: buildFullKhmdhsPhaseBResetFields(),
    };
  }

  if (status === 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ' && (hasPayments || hasKhmdhsContract || hasSymvPlan)) {
    return {
      scope: 'partial',
      clearFields: buildPreContractKhmdhsClearFields(),
    };
  }

  return null;
}

function hasResolvedNoticeData(formData) {
  return !!(
    sanitizeAdamInput(formData.khmdhsNoticeAdam)
    && pickKhmdhsNoticeSnapshot(formData.khmdhsNoticeSnapshot)
  );
}

function contractRowHasKhmdhsData(contract) {
  return !!(
    sanitizeAdamInput(contract?.khmdhsAdam)
    && pickKhmdhsSnapshot(contract?.khmdhsContractSnapshot)
  );
}

function findDuplicateContractAdam(contracts, adam, excludeIndex = -1) {
  const norm = sanitizeAdamInput(adam);
  if (!norm) return -1;
  for (let i = 0; i < (contracts || []).length; i += 1) {
    if (i === excludeIndex) continue;
    if (sanitizeAdamInput(contracts[i]?.khmdhsAdam) === norm) return i;
  }
  return -1;
}


function projectHasResolvedChainData(formData) {
  const multi = isMultipleContractsForm(formData.implementationForm);
  const hasNotice = hasResolvedNoticeData(formData);
  const needsContractFields = STATUSES_WITH_CONTRACT_FIELDS.includes(formData.projectStatus);
  const needsProcedure = statusShowsAssignmentProcedure(formData.projectStatus);
  const hasPartialProcedureFetch = !!(
    sanitizeAdamInput(formData?.khmdhsChainSeedAdam)
    && projectHasKhmdhsFormResults(formData)
  );

  if (multi) {
    const rows = formData.contracts || [];
    if (needsContractFields) {
      if (rows.length === 0) return false;
      return hasNotice && rows.every((c) => contractRowHasKhmdhsData(c));
    }
    if (needsProcedure) {
      return hasNotice || hasPartialProcedureFetch;
    }
    return hasNotice || hasPartialProcedureFetch || rows.some((c) => contractRowHasKhmdhsData(c));
  }

  if (needsContractFields) {
    return !!(
      sanitizeAdamInput(formData.khmdhsAdam)
      && pickKhmdhsSnapshot(formData.khmdhsContractSnapshot)
    );
  }
  if (needsProcedure) {
    return hasNotice
      || hasPartialProcedureFetch
      || !!(
        sanitizeAdamInput(formData.khmdhsAdam)
        && pickKhmdhsSnapshot(formData.khmdhsContractSnapshot)
      );
  }
  return hasNotice
    || hasPartialProcedureFetch
    || !!(
      sanitizeAdamInput(formData.khmdhsAdam)
      && pickKhmdhsSnapshot(formData.khmdhsContractSnapshot)
    );
}

const FormOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1.5rem 3vw;
  overflow: hidden;
  overscroll-behavior: none;
`;

const FormContainer = styled.div`
  position: relative;
  background: #ffffff;
  border-radius: 18px;
  width: min(calc(100vw - 6vw), 1420px);
  max-height: min(calc(100vh - 3rem), 900px);
  display: flex;
  flex-direction: column;
  box-shadow:
    0 0 0 1px rgba(148, 163, 184, 0.20),
    0 24px 56px -16px rgba(15, 23, 42, 0.32),
    0 8px 24px rgba(79, 70, 229, 0.10);
  animation: formSlideIn 0.28s cubic-bezier(0.22, 1, 0.36, 1);
  overflow: hidden;
  overscroll-behavior: contain;
  box-sizing: border-box;

  @keyframes formSlideIn {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
`;

const FormHeader = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%);
  color: #fff;
  padding: 0.72rem 1.25rem 0.62rem;
  border-radius: 16px 16px 0 0;
  flex-shrink: 0;
`;

const FormHeaderText = styled.div`
  min-width: 0;
`;

const FormTitle = styled.h2`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.01em;
`;

const FormSubtitle = styled.p`
  margin: 0.25rem 0 0 0;
  font-size: 0.78rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.4;
`;

const FormHeaderClose = styled.button`
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.16);
  border: none;
  color: #fff;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.28);
  }

  &:disabled {
    opacity: 0.5;
    cursor: wait;
  }
`;

const FormScrollArea = styled.div`
  position: relative;
  padding: ${(p) => (p.$phaseB ? '0.65rem 1.1rem 0.75rem' : '1rem 1.5rem 1.25rem')};
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: rgba(99, 102, 241, 0.45) transparent;
  background: ${(p) => (p.$phaseB ? '#f8f9ff' : '#fafbff')};

  &::-webkit-scrollbar {
    width: 9px;
  }
  &::-webkit-scrollbar-track {
    background: rgba(148, 163, 184, 0.12);
    border-radius: 8px;
  }
  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #818cf8, #6366f1);
    border-radius: 8px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }
`;

const Section = styled.div`
  background: ${(p) => p.$bg || '#fff'};
  border-radius: 10px;
  padding: 0.85rem 1rem 0.9rem 1rem;
  ${(p) =>
    p.$flat
      ? `
    border-top: 4px solid ${p.$accent || '#6366f1'};
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  `
      : `
    border: 1px solid rgba(148, 163, 184, 0.28);
    border-left: 3px solid ${p.$accent || '#6366f1'};
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
  `}
  ${(p) => (p.$fullWidth ? 'grid-column: 1 / -1;' : '')}
`;

const PhaseDivider = styled.div`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0.1rem 0;
  padding: 0.2rem 0;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(148, 163, 184, 0.35);
  }
`;

const PhaseDividerLabel = styled.div`
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #6366f1;
  white-space: nowrap;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: #f5f3ff;
  border: 1px solid rgba(99, 102, 241, 0.18);
`;

const PhaseTabStrip = styled.div`
  display: flex;
  gap: 0.35rem;
  margin-top: 0.6rem;
  padding: 0.22rem;
  background: rgba(0, 0, 0, 0.18);
  border-radius: 10px;
  align-self: flex-start;
`;

const PhaseTab = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.42rem 1.15rem;
  border-radius: 7px;
  border: none;
  font-size: 0.8rem;
  font-weight: ${(p) => (p.$active ? 700 : 600)};
  cursor: pointer;
  letter-spacing: 0.02em;
  white-space: nowrap;
  position: relative;
  transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;

  background: ${(p) => (p.$active
    ? 'rgba(255,255,255,0.97)'
    : 'transparent')};
  color: ${(p) => (p.$active ? '#4f46e5' : 'rgba(255,255,255,0.6)')};
  box-shadow: ${(p) => (p.$active
    ? '0 2px 10px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.15)'
    : 'none')};
  transform: ${(p) => (p.$active ? 'translateY(-1px)' : 'none')};

  &:hover:not(:disabled) {
    background: ${(p) => (p.$active ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.12)')};
    color: ${(p) => (p.$active ? '#4f46e5' : 'rgba(255,255,255,0.9)')};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }
`;

const PhaseTabDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${(p) => p.$color || 'rgba(255,255,255,0.7)'};
  flex-shrink: 0;
  box-shadow: ${(p) => (p.$color && p.$color !== 'rgba(255,255,255,0.45)' ? `0 0 5px ${p.$color}` : 'none')};
`;

const PhaseALayout = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
  align-items: start;

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
  }
`;

const KhmdhsFetchBar = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: 0 0 2px 2px;
  overflow: hidden;
  background: rgba(255,255,255,0.15);
  opacity: ${(p) => (p.$active ? 1 : 0)};
  transition: opacity 0.3s ease;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: -40%;
    width: 40%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent);
    animation: ${(p) => (p.$active ? 'khmdhsSweep 1.1s ease-in-out infinite' : 'none')};
  }

  @keyframes khmdhsSweep {
    0%   { left: -40%; }
    100% { left: 100%; }
  }
`;

const FormProcessingOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 400;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(4px);
  border-radius: 18px;
  pointer-events: all;
  animation: khmdhsFadeIn 0.2s ease;
`;

const KhmdhsFetchOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: rgba(238, 242, 255, 0.82);
  backdrop-filter: blur(3px);
  border-radius: 0 0 16px 16px;
  pointer-events: all;
  animation: khmdhsFadeIn 0.2s ease;

  @keyframes khmdhsFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
`;

const KhmdhsFetchOverlayCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  background: #fff;
  border: 1.5px solid #c7d2fe;
  border-radius: 16px;
  padding: 1.5rem 2.2rem;
  box-shadow: 0 8px 32px rgba(79, 70, 229, 0.14), 0 2px 8px rgba(0,0,0,0.08);
`;

const KhmdhsFetchBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.7rem 1rem;
  border-radius: 10px;
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
  border: 1px solid #c7d2fe;
  color: #3730a3;
  font-size: 0.82rem;
  font-weight: 600;
`;

const SymvPlannerResumeBtn = styled.button`
  flex-shrink: 0;
  border: none;
  border-radius: 8px;
  padding: 0.42rem 0.85rem;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  background: #4f46e5;
  color: #fff;

  &:hover {
    background: #4338ca;
  }
`;

const FetchSpinner = styled.span`
  display: inline-block;
  width: ${(p) => (p.$large ? '40px' : '15px')};
  height: ${(p) => (p.$large ? '40px' : '15px')};
  border: ${(p) => (p.$large ? '4px' : '2px')} solid ${(p) => (p.$large ? '#e0e7ff' : '#c7d2fe')};
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: khmdhsSpin 0.75s linear infinite;
  flex-shrink: 0;

  @keyframes khmdhsSpin {
    to { transform: rotate(360deg); }
  }
`;

const KhmdhsPhaseShell = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const KhmdhsPhaseInner = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  ${(p) => (p.$locked ? 'opacity: 0.55; pointer-events: none; user-select: none; filter: grayscale(0.15);' : '')}
`;

const PhaseLockedBanner = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  background: linear-gradient(135deg, #fef3c7, #fffbeb);
  border: 1px solid #fcd34d;
  color: #92400e;
  font-size: 0.88rem;
  line-height: 1.45;
  font-weight: 600;
  margin-bottom: 0.5rem;
`;

const BudgetReadOnlyBox = styled.div`
  padding: 0.7rem 0.9rem;
  border-radius: 10px;
  background: #eef2ff;
  border: 1px dashed rgba(99, 102, 241, 0.45);
  font-weight: 700;
  color: #312e81;
  font-size: 0.95rem;
`;

const FixedFilesDock = styled.div`
  flex-shrink: 0;
  border-top: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  padding: ${(p) => (p.$slim ? '0.28rem 0.85rem' : '0.5rem 1.1rem 0.55rem')};
  box-shadow: 0 -2px 10px rgba(15, 23, 42, 0.04);
`;

const FixedFilesDockBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: ${(p) => (p.$slim ? '1.75rem' : '2.25rem')};
`;

const FixedFilesDockLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  flex-shrink: 1;
`;

const FixedFilesDockIcon = styled.span`
  font-size: 0.95rem;
  line-height: 1;
  opacity: 0.9;
`;

const FixedFilesDockLabel = styled.span`
  font-size: ${(p) => (p.$slim ? '0.72rem' : '0.78rem')};
  font-weight: 700;
  color: #334155;
  letter-spacing: 0.02em;
  white-space: nowrap;
`;

const FooterFileActions = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-left: auto;
`;

const FooterIconBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.45rem;
  border-radius: 8px;
  font-size: 0.95rem;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$variant === 'folder' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(99, 102, 241, 0.35)')};
  background: ${(p) => (p.$variant === 'folder' ? '#f0fdf4' : '#f5f3ff')};
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
  }
`;

const FooterFileCount = styled.span`
  font-size: 0.62rem;
  font-weight: 800;
  color: #4338ca;
  line-height: 1;
`;

const DockFileCount = styled.span`
  font-size: 0.68rem;
  font-weight: 700;
  color: #4338ca;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.22);
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  white-space: nowrap;
`;

const FixedFilesDockActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
`;

const DockUploadBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: ${(p) => (p.$iconOnly ? '0.38rem 0.5rem' : '0.38rem 0.72rem')};
  border-radius: 8px;
  font-size: ${(p) => (p.$iconOnly ? '0.95rem' : '0.76rem')};
  font-weight: 700;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$variant === 'folder' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(99, 102, 241, 0.35)')};
  background: ${(p) => (p.$variant === 'folder'
    ? 'linear-gradient(180deg, #ecfdf5, #f0fdf4)'
    : 'linear-gradient(180deg, #eef2ff, #f5f3ff)')};
  color: ${(p) => (p.$variant === 'folder' ? '#047857' : '#4338ca')};
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  white-space: nowrap;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 3px 10px ${(p) => (p.$variant === 'folder' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(99, 102, 241, 0.18)')};
    border-color: ${(p) => (p.$variant === 'folder' ? '#10b981' : '#6366f1')};
  }

  &:active {
    transform: translateY(0);
  }
`;

const DockFileScroll = styled.div`
  display: flex;
  flex-wrap: nowrap;
  gap: 0.35rem;
  overflow-x: auto;
  overflow-y: hidden;
  margin-top: 0.45rem;
  padding-bottom: 0.15rem;
  max-height: 4.5rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(99, 102, 241, 0.35) transparent;

  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(99, 102, 241, 0.35);
    border-radius: 4px;
  }
`;

const DockFileChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  max-width: 220px;
  padding: 0.28rem 0.45rem 0.28rem 0.55rem;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  font-size: 0.72rem;
  color: #334155;
  flex-shrink: 0;
`;

const DockFileChipName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
`;

const DockFileChipRemove = styled.button`
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  padding: 0 0.15rem;
  font-size: 0.85rem;
  line-height: 1;
  border-radius: 4px;

  &:hover {
    color: #dc2626;
    background: rgba(220, 38, 38, 0.08);
  }
`;

const DockGroupChip = styled(DockFileChip)`
  background: linear-gradient(180deg, #eef2ff, #f8fafc);
  border-color: rgba(99, 102, 241, 0.25);
  font-weight: 600;
`;

const SectionTitle = styled.div`
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${(p) => p.$color || '#64748b'};
  margin: 0 0 0.7rem 0;
  ${(p) =>
    p.$nobar
      ? ''
      : `
    padding-bottom: 0.45rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  `}
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(
    ${props => props.cols || 2},
    minmax(0, 1fr)
  );
  gap: 0.75rem 1rem;
  min-width: 0;
  width: 100%;

  @media (max-width: 900px) {
    grid-template-columns: repeat(
      ${props => Math.min(props.cols || 2, 2)},
      minmax(0, 1fr)
    );
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  grid-column: ${props => props.fullWidth ? `1 / -1` : 'span 1'};

  & > input,
  & > select,
  & > textarea {
    width: 100%;
  }
`;

const Label = styled.label`
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.45rem;
  font-size: 0.875rem;
  letter-spacing: 0.01em;
`;

const Input = styled.input`
  padding: 0.62rem 0.75rem;
  border: 1.5px solid ${props => {
    if (props.$hasError) return '#ef4444';
    if (props.$isValid && props.$touched) return '#22c55e';
    return '#cbd5e1';
  }};
  border-radius: 8px;
  font-size: 0.9rem;
  outline: none;
  background: #fff;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  box-sizing: border-box;
  min-width: 0;
  font-weight: 400;

  &::placeholder {
    color: #cbd5e1;
    font-weight: 400;
    font-family: inherit;
    opacity: 1;
  }

  &:focus {
    border-color: ${props => {
      if (props.$hasError) return '#ef4444';
      if (props.$isValid && props.$touched) return '#22c55e';
      return '#6366f1';
    }};
    box-shadow: 0 0 0 3px
      ${props => {
        if (props.$hasError) return 'rgba(239, 68, 68, 0.2)';
        if (props.$isValid && props.$touched) return 'rgba(34, 197, 94, 0.2)';
        return 'rgba(99, 102, 241, 0.22)';
      }};
  }

  &:disabled {
    background-color: #f1f5f9;
    cursor: not-allowed;
    color: #64748b;
  }
`;

const AdamInput = styled(Input)`
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.88rem;
  letter-spacing: 0.05em;
  padding: 0.65rem 0.8rem;

  &::placeholder {
    color: #cbd5e1;
    font-weight: 400;
    font-style: italic;
    letter-spacing: 0.03em;
    opacity: 1;
  }

  ${(p) => p.$hasValue && `
    color: #1e1b4b;
    font-weight: 800;
    font-style: normal;
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    border-color: #6366f1;
    box-shadow: inset 0 1px 2px rgba(99, 102, 241, 0.06);
  `}

  &:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
  }
`;

const TextArea = styled.textarea`
  padding: 0.62rem 0.75rem;
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.9rem;
  outline: none;
  background: #fff;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  resize: vertical;
  min-height: 72px;
  font-family: inherit;
  box-sizing: border-box;
  min-width: 0;

  &:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.22);
  }

  &:disabled {
    background-color: #f1f5f9;
    cursor: not-allowed;
    color: #64748b;
  }
`;

const Select = styled.select`
  padding: 0.78rem 0.85rem;
  border: 1.5px solid #cbd5e1;
  border-radius: 10px;
  font-size: 0.98rem;
  outline: none;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  box-sizing: border-box;
  min-width: 0;

  &:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.22);
  }
`;

const FieldHint = styled.div`
  font-size: 0.8rem;
  color: #64748b;
  margin-top: 0.45rem;
  line-height: 1.5;
  padding: 0.55rem 0.65rem;
  background: rgba(241, 245, 249, 0.95);
  border-radius: 8px;
  border-left: 3px solid #818cf8;
`;

const EngineerPickGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem 1.25rem;
  margin-top: 0.35rem;
  min-width: 0;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const EngineerPickCard = styled.div`
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(148, 163, 184, 0.45);
  border-radius: 12px;
  padding: 1rem 1.1rem;
  min-width: 0;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
`;

const EngineerPickCardTitle = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #4f46e5;
  margin-bottom: 0.55rem;
`;

const AuxiliaryParticipantBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
`;

const AuxiliaryEmpty = styled.div`
  padding: 0.75rem 0.55rem;
  font-size: 0.88rem;
  color: #64748b;
  line-height: 1.45;
  text-align: center;
  border: 1.5px dashed #cbd5e1;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.9);
`;

const AuxiliaryChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  min-height: 0;
`;

const AuxiliaryChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  max-width: 100%;
  padding: 0.28rem 0.4rem 0.28rem 0.5rem;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #312e81;
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
  border: 1px solid rgba(129, 140, 248, 0.55);
  line-height: 1.2;
`;

const AuxiliaryChipName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: min(22ch, 100%);
`;

const AuxiliaryChipRemove = styled.button`
  flex-shrink: 0;
  border: none;
  background: rgba(99, 102, 241, 0.15);
  color: #4338ca;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #b91c1c;
  }
`;

const MutedText = styled.p`
  margin: 0.35rem 0;
  color: #94a3b8;
  font-size: 0.82rem;
`;

const ContractsListWrap = styled.div`
  min-width: 0;
`;

const ContractPanel = styled.div`
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 12px;
  padding: 1rem 1.1rem;
  margin-bottom: 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.4);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
`;

const ContractPanelTitle = styled.div`
  font-size: 0.7rem;
  font-weight: 800;
  color: #4338ca;
  margin-bottom: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
`;

const SupplementaryOuter = styled.div`
  background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 55%, #f8fafc 100%);
  border-radius: 12px;
  padding: 1rem 1.1rem;
  border: 1px solid rgba(34, 197, 94, 0.35);
  margin-top: 0.5rem;
  box-shadow: 0 2px 10px rgba(16, 185, 129, 0.08);
`;

const SupplementarySectionTitle = styled.div`
  font-size: 0.7rem;
  font-weight: 800;
  color: #047857;
  margin-bottom: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
`;

const SupplementaryInner = styled.div`
  background: #fff;
  border-radius: 10px;
  padding: 0.85rem;
  margin-bottom: 0.55rem;
  border: 1px solid rgba(34, 197, 94, 0.22);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
`;

const FileGroupCard = styled.div`
  padding: 0.85rem 1rem;
  background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 50%, #ffffff 100%);
  border: 1px solid rgba(16, 185, 129, 0.28);
  border-radius: 12px;
  margin-top: 0.55rem;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.07);
`;

const FileGroupToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.45rem;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const FileGroupTitleBlock = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
  min-width: 0;
`;

const FileGroupMetaBadge = styled.span`
  font-size: 0.72rem;
  color: #047857;
  background: rgba(16, 185, 129, 0.12);
  padding: 0.2rem 0.45rem;
  border-radius: 6px;
  font-weight: 700;
`;

const SmallFileRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.55rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 0.28rem;
  gap: 0.5rem;
`;

const ToolbarDeleteBtn = styled.button`
  background: #fff;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 0.28rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  flex-shrink: 0;
  &:hover {
    background: #fef2f2;
    border-color: #f87171;
  }
`;

const ToolbarRemoveFileBtn = styled.button`
  background: #fffbeb;
  color: #a16207;
  border: 1px solid #fde68a;
  border-radius: 6px;
  padding: 0.18rem 0.45rem;
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  &:hover {
    background: #fef9c3;
  }
`;

const FileListLabel = styled.strong`
  font-size: 0.86rem;
  color: #475569;
  font-weight: 700;
  display: block;
  margin-bottom: 0.35rem;
`;

const FileUploadTitle = styled.strong`
  font-size: 1.02rem;
  color: #312e81;
`;

const FileUploadHint = styled.p`
  margin: 0.4rem 0 0 0;
  font-size: 0.86rem;
  color: #64748b;
  line-height: 1.45;
`;

const AddContractButton = styled.button`
  background: #28a745;
  color: white;
  border: none;
  padding: 0.6rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.3s ease;
  margin-top: 1rem;

  &:hover {
    background: #218838;
  }
`;

const RemoveContractButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.3s ease;
  margin-left: 0.5rem;

  &:hover {
    background: #c82333;
  }
`;

const FileUploadSection = styled.div`
  border: 2px dashed rgba(99, 102, 241, 0.45);
  border-radius: 14px;
  padding: 1.75rem 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  background: linear-gradient(180deg, rgba(238, 242, 255, 0.65) 0%, rgba(255, 255, 255, 0.9) 100%);

  &:hover {
    border-color: #6366f1;
    background: linear-gradient(180deg, rgba(224, 231, 255, 0.9) 0%, #fff 100%);
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.12);
  }
`;

const FolderUploadSection = styled(FileUploadSection)`
  border-color: rgba(16, 185, 129, 0.45);
  background: linear-gradient(180deg, rgba(236, 253, 245, 0.65) 0%, rgba(255, 255, 255, 0.9) 100%);

  &:hover {
    border-color: #10b981;
    background: linear-gradient(180deg, rgba(209, 250, 229, 0.9) 0%, #fff 100%);
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.12);
  }
`;

const FileUploadGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.85rem;
  margin: 1rem 0;
`;

const FileList = styled.div`
  margin-top: 1rem;
`;

const FileItem = styled.div`
  background: #fff;
  padding: 0.55rem 0.85rem;
  border-radius: 10px;
  margin: 0.45rem 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  gap: 0.5rem;
`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  margin: 1rem 0;
  padding: 0.85rem 1rem;
  background: linear-gradient(90deg, rgba(238, 242, 255, 0.9) 0%, rgba(248, 250, 252, 0.95) 100%);
  border-radius: 10px;
  border: 1px solid rgba(129, 140, 248, 0.35);
`;

const Checkbox = styled.input`
  margin-right: 0.5rem;
  transform: scale(1.2);
`;

const CheckboxLabel = styled.label`
  font-weight: 500;
  color: #495057;
  cursor: pointer;
`;

const AleCodesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const AleCodeItem = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
  width: 100%;
`;

const AleCodeInput = styled(Input)`
  flex: 1;
  min-width: 0;
`;

const AddAleButton = styled.button`
  padding: 0.5rem 1rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  
  &:hover {
    background: #218838;
    transform: translateY(-1px);
  }
`;

const RemoveAleButton = styled.button`
  padding: 0.5rem;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  min-width: 36px;
  transition: all 0.2s;
  
  &:hover {
    background: #c82333;
    transform: translateY(-1px);
  }
`;


const AddSupplementaryButton = styled.button`
  background: #28a745;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  margin-top: 0.5rem;

  &:hover {
    background: #218838;
  }
`;

const RemoveSupplementaryButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  margin-top: 0.5rem;

  &:hover {
    background: #c82333;
  }
`;

const StickyFooter = styled.div`
  display: flex;
  justify-content: ${(p) => (p.$slim ? 'flex-start' : 'center')};
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
  padding: ${(p) => (p.$slim ? '0.4rem 0.85rem 0.5rem' : '0.55rem 1rem 0.65rem')};
  border-top: 1px solid rgba(148, 163, 184, 0.22);
  background: #f8fafc;
  border-radius: 0 0 16px 16px;
  flex-shrink: 0;
  width: 100%;
`;

const SecondaryOutlineButton = styled.button`
  background: #fff;
  color: #4338ca;
  border: 1px solid rgba(99, 102, 241, 0.45);
  padding: 0.48rem 0.9rem;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease, box-shadow 0.15s ease;

  &:hover:not(:disabled) {
    background: #eef2ff;
    box-shadow: 0 2px 6px rgba(99, 102, 241, 0.15);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const SaveButton = styled.button`
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  border: none;
  padding: 0.48rem 1.25rem;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.28);
  }

  &:disabled {
    opacity: 0.65;
    cursor: wait;
    transform: none;
    box-shadow: none;
  }
`;

const CancelButton = styled.button`
  background: white;
  color: #64748b;
  border: 1px solid #cbd5e1;
  padding: 0.48rem 1.1rem;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: #f8fafc;
    border-color: #94a3b8;
  }

  &:disabled {
    opacity: 0.65;
    cursor: wait;
  }
`;

const DeleteFormButton = styled.button`
  background: white;
  color: #dc2626;
  border: 1px solid rgba(220, 38, 38, 0.35);
  padding: 0.48rem 1.1rem;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
  margin-left: auto;

  &:hover {
    background: #fef2f2;
  }
`;

const ErrorMessage = styled.div`
  color: #b91c1c;
  font-size: 0.78rem;
  font-weight: 600;
  margin-top: 0.35rem;
  padding: 0.35rem 0.5rem;
  background: rgba(254, 242, 242, 0.95);
  border-radius: 6px;
  border: 1px solid #fecaca;
`;

const ComplianceAlert = styled.div`
  margin-top: 0.5rem;
  padding: 0.75rem 0.9rem;
  border-radius: 10px;
  border: 1px solid ${(props) => (props.$warn ? '#fcd34d' : '#bfdbfe')};
  background: ${(props) => (props.$warn ? '#fffbeb' : '#eff6ff')};
  color: ${(props) => (props.$warn ? '#92400e' : '#1e40af')};
  font-size: 0.78rem;
  line-height: 1.45;
  font-weight: 600;
`;

const ComplianceAlertTitle = styled.div`
  font-weight: 800;
  margin-bottom: 0.35rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

const KhmdhsLegacyUpgradeBanner = styled.div`
  margin-bottom: 0.85rem;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  border: 1px solid ${(p) => (p.$pending ? '#93c5fd' : '#fcd34d')};
  background: ${(p) => (p.$pending ? 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)' : 'linear-gradient(135deg, #fffbeb 0%, #fff7ed 100%)')};
  color: ${(p) => (p.$pending ? '#1e3a8a' : '#92400e')};
  font-size: 0.8rem;
  line-height: 1.5;
`;

const KhmdhsLegacyUpgradeActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.65rem;
  align-items: center;
`;

const KhmdhsLegacyUpgradeButton = styled.button`
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  border: 1px solid #6366f1;
  background: #6366f1;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  &:hover:not(:disabled) {
    background: #4f46e5;
  }
`;

const KhmdhsGuideWrap = styled.div`
  grid-column: 1 / -1;
  margin-bottom: 0.15rem;
`;

const KhmdhsGuideStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.55rem;
  padding: 0.45rem 0.7rem;
  border-radius: 9px;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.28);
  font-size: 0.74rem;
  line-height: 1.35;
  color: #64748b;
`;

const KhmdhsGuideStripTitle = styled.span`
  font-weight: 700;
  color: #475569;
  white-space: nowrap;
`;

const KhmdhsGuideStripText = styled.span`
  color: #64748b;
`;

const KhmdhsStatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  background: ${(p) => (p.$tone === 'procedure' ? '#fff7ed' : '#eef2ff')};
  color: ${(p) => (p.$tone === 'procedure' ? '#c2410c' : '#4338ca')};
  border: 1px solid ${(p) => (p.$tone === 'procedure' ? '#fed7aa' : '#c7d2fe')};
  white-space: nowrap;
`;

const KhmdhsGuideTypes = styled.div`
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: center;
`;

const KhmdhsGuideTypePill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.12rem 0.4rem;
  border-radius: 6px;
  font-size: 0.68rem;
  font-weight: 600;
  border: 1px solid ${(p) => {
    if (p.$discouraged) return '#fecaca';
    if (p.$primary) return '#86efac';
    return '#bfdbfe';
  }};
  background: ${(p) => {
    if (p.$discouraged) return '#fef2f2';
    if (p.$primary) return '#ecfdf5';
    return '#eff6ff';
  }};
  color: ${(p) => {
    if (p.$discouraged) return '#991b1b';
    if (p.$primary) return '#047857';
    return '#1d4ed8';
  }};
  opacity: ${(p) => (p.$discouraged ? 0.65 : 1)};
  text-decoration: ${(p) => (p.$discouraged ? 'line-through' : 'none')};
`;

const KhmdhsGuideTypeCode = styled.span`
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 800;
  font-size: 0.66rem;
`;

const KhmdhsDiscouragedNote = styled.span`
  color: #b91c1c;
  font-size: 0.7rem;
  font-weight: 600;
`;

const AdamChainCard = styled.div`
  position: relative;
  margin-top: 0.35rem;
  padding: 0.75rem 0.85rem 0.85rem 1rem;
  border-radius: 12px;
  background: linear-gradient(145deg, #ffffff 0%, #f0fdf4 55%, #ecfdf5 100%);
  border: 1px solid rgba(16, 185, 129, 0.28);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.75) inset,
    0 6px 20px rgba(16, 185, 129, 0.1);

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 10px;
    bottom: 10px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: linear-gradient(180deg, #34d399, #059669);
  }
`;

const AdamChainTitle = styled.div`
  font-weight: 800;
  font-size: 0.86rem;
  color: #065f46;
  margin-bottom: 0.2rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

const AdamChainStepTag = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: #ecfdf5;
  border: 1px solid rgba(16, 185, 129, 0.35);
  color: #047857;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
`;

const AdamChainHint = styled.div`
  font-size: 0.72rem;
  color: #64748b;
  margin-bottom: 0.55rem;
  line-height: 1.4;
`;

const AdamChainRow = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: stretch;
`;

const KhmdhsAutoBadge = styled.span`
  display: inline-flex;
  align-items: center;
  margin-left: 0.45rem;
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  background: #dbeafe;
  color: #1e40af;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  vertical-align: middle;
`;

const KhmdhsFieldAnchor = styled.div`
  scroll-margin-top: 88px;
  border-radius: 10px;

  &[data-highlight='true'] {
    animation: khmdhsFieldPulse 2.2s ease;
    box-shadow: 0 0 0 3px #f59e0b, 0 0 0 7px rgba(245, 158, 11, 0.22);
  }

  @keyframes khmdhsFieldPulse {
    0%, 100% {
      box-shadow: 0 0 0 3px #f59e0b, 0 0 0 7px rgba(245, 158, 11, 0.22);
    }
    50% {
      box-shadow: 0 0 0 3px #d97706, 0 0 0 11px rgba(245, 158, 11, 0.12);
    }
  }
`;

/* ── Compact Action Strip — ενιαία γραμμή εντολών ΚΗΜΔΗΣ ─────────── */

const stripShimmer = keyframes`
  0% { background-position: 200% center; }
  100% { background-position: -200% center; }
`;

const ActionStrip = styled.div`
  position: relative;
  border-radius: 12px;
  background: linear-gradient(135deg, #f5f3ff 0%, #eef2ff 48%, #f8fafc 100%);
  border: 1px solid rgba(99, 102, 241, 0.22);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.65) inset,
    0 4px 18px rgba(99, 102, 241, 0.1);
  overflow: visible;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 8px;
    bottom: 8px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: linear-gradient(180deg, #818cf8, #6366f1, #4f46e5);
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background: linear-gradient(
      105deg,
      transparent 40%,
      rgba(255, 255, 255, 0.35) 50%,
      transparent 60%
    );
    background-size: 200% 100%;
    animation: ${stripShimmer} 6s ease-in-out infinite;
    opacity: 0.45;
  }
`;

const StripRow = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem 0.45rem;
  padding: 0.42rem 0.65rem 0.42rem 0.85rem;
  min-height: 36px;
`;

const StripBrand = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  flex-shrink: 0;
  font-size: 0.62rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #4338ca;
  white-space: nowrap;
`;

const StripBrandIcon = styled.span`
  font-size: 0.78rem;
  line-height: 1;
`;

const StripDivider = styled.span`
  width: 1px;
  height: 18px;
  background: rgba(99, 102, 241, 0.2);
  flex-shrink: 0;
`;

const StripMeta = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  flex-shrink: 1;
`;

const StripStatusDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${(p) => (p.$ok ? '#22c55e' : '#94a3b8')};
  box-shadow: ${(p) => (p.$ok ? '0 0 0 3px rgba(34, 197, 94, 0.22)' : 'none')};
`;

const StripStatusLabel = styled.span`
  font-size: 0.72rem;
  font-weight: 700;
  color: ${(p) => (p.$ok ? '#047857' : '#475569')};
  white-space: nowrap;
  line-height: 1.2;
`;

const StripAdamText = styled.button`
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.68rem;
  font-weight: 700;
  color: #4338ca;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 6px;
  padding: 0.12rem 0.38rem;
  max-width: 168px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: #fff;
    border-color: rgba(99, 102, 241, 0.45);
  }
`;

const StripTypeGroup = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  flex-shrink: 0;
`;

const StripTypeHint = styled.span`
  font-size: 0.58rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
`;

const StripTypePills = styled.div`
  display: inline-flex;
  gap: 0.2rem;
  flex-wrap: nowrap;
`;

const StripTypePill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.08rem 0.28rem;
  border-radius: 5px;
  font-size: 0.58rem;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  border: 1px solid ${(p) => (p.$primary ? '#86efac' : '#bfdbfe')};
  background: ${(p) => (p.$primary ? 'rgba(236, 253, 245, 0.9)' : 'rgba(239, 246, 255, 0.9)')};
  color: ${(p) => (p.$primary ? '#047857' : '#1d4ed8')};
  opacity: ${(p) => (p.$discouraged ? 0.4 : 1)};
  text-decoration: ${(p) => (p.$discouraged ? 'line-through' : 'none')};
  white-space: nowrap;
`;

const StripActions = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  flex-shrink: 0;
`;

const StripBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.32rem 0.62rem;
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: transform 0.14s ease, box-shadow 0.14s ease, background 0.14s ease;
  border: 1px solid ${(p) => (p.$secondary
    ? 'rgba(16, 185, 129, 0.4)'
    : 'rgba(99, 102, 241, 0.35)')};
  background: ${(p) => (p.$secondary
    ? 'linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%)'
    : 'linear-gradient(180deg, #ffffff 0%, #eef2ff 100%)')};
  color: ${(p) => (p.$secondary ? '#047857' : '#4338ca')};
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 3px 10px rgba(99, 102, 241, 0.18);
  }
  &:active:not(:disabled) { transform: translateY(0); }
  &:disabled { opacity: 0.45; cursor: not-allowed; }

  ${(p) => p.$active && `
    background: linear-gradient(180deg, #6366f1 0%, #4f46e5 100%);
    color: #fff;
    border-color: #4338ca;
    box-shadow: 0 2px 10px rgba(79, 70, 229, 0.35);
  `}
`;

const PhaseBResetBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
  padding: 0.32rem 0.55rem;
  border-radius: 8px;
  font-size: 0.66rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  border: 1px solid rgba(239, 68, 68, 0.38);
  background: linear-gradient(180deg, rgba(254, 242, 242, 0.95) 0%, rgba(254, 226, 226, 0.9) 100%);
  color: #b91c1c;
  transition: transform 0.14s ease, box-shadow 0.14s ease, background 0.14s ease;
  box-shadow: 0 1px 3px rgba(239, 68, 68, 0.08);

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    background: #fee2e2;
    box-shadow: 0 3px 10px rgba(239, 68, 68, 0.16);
  }
  &:active:not(:disabled) { transform: translateY(0); }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const StripDropdown = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 360px;
  background: #fff;
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 12px;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.14);
  padding: 0.75rem 0.85rem 0.8rem;
  z-index: 200;

  ${(p) => p.$secondary && `
    border-color: rgba(16, 185, 129, 0.25);
  `}
`;

const DropdownTitle = styled.div`
  font-size: 0.74rem;
  font-weight: 800;
  color: ${(p) => (p.$secondary ? '#065f46' : '#312e81')};
  margin-bottom: 0.35rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
`;

const DropdownHint = styled.div`
  font-size: 0.68rem;
  color: #64748b;
  margin-bottom: 0.55rem;
  line-height: 1.45;
`;

const DropdownRow = styled.div`
  display: flex;
  gap: 0.45rem;
  align-items: stretch;
`;

/* ── KhmdhsLockedPanel ─────────────────────────────────────────── */

const KhmdhsLockedPanel = styled.div`
  margin-top: 0.25rem;
  padding: 1rem;
  border-radius: 12px;
  background: #f1f5f9;
  border: 1px dashed #94a3b8;
  font-size: 0.82rem;
  line-height: 1.5;
  color: #64748b;
`;

/**
 * Εφαρμόζει τους χαρακτηρισμούς αλυσίδας στα παράγωγα πεδία του υποέργου.
 * Ξαναϋπολογίζει συμπληρωματικές, και (μόνο όταν ορθή επανάληψη διορθώνει) ποσό/ημ/νία.
 */

function ProjectForm({ isOpen, onClose, onSave, onDelete, editingProject = null, userRole = 'USER', allProjects = [] }) {
  const { showToast } = useToast();
  const canManageFunding = userRole === 'ADMIN' || userRole === 'SUPERADMIN';

  // Dynamic funding options (loaded from disk + merged with built-ins)
  const [fundingOptions, setFundingOptions] = useState({ sources: [], details: {} });
  const [showFundingModal, setShowFundingModal] = useState(false);
  const [fundingModalTab, setFundingModalTab] = useState('sources');
  const [fundingModalSource, setFundingModalSource] = useState(null);

  const loadFundingOptions = useCallback(async () => {
    try {
      const res = await ipcRenderer.invoke('load-funding-options');
      if (res?.success) {
        setFundingOptions(res.data);
      }
    } catch {
      // Fallback: leave empty (built-ins will still load on next try)
    }
  }, []);

  useEffect(() => {
    if (isOpen) loadFundingOptions();
  }, [isOpen, loadFundingOptions]);
  const [touched, setTouched] = useState({}); // Track which fields have been touched
  const [formData, setFormData] = useState({
    projectTitle: '',
    subprojectTitle: '',
    implementationForm: '',
    kaCode: '',
    noKaCode: false,
    eisigitikiEkthesi: '',
    aleCodes: [], // Array κωδικών Α.Λ.Ε.
    misPraxhsName: '',
    misPraxhsCode: '',
    projectType: '',
    fundingSource: '',
    fundingDetails: '',
    coFinanced: false,
    fundingSources: [], // [{ source, details, amount, ownResources }] — μόνο σε συγχρηματοδότηση
    approvedAmount: '',
    projectBudget: '',
    projectStatus: '',
    assignmentProcedure: '',
    contractProcessStartDate: '', // Ημερομηνία έναρξης διαδικασίας σύναψης Σύμβασης
    contractDate: '',
    contractEndDate: '',
    contractAmount: '',
    apeAmount: '',
    apeComments: '',
    supervisorEngineerIds: [],
    supervisorChargeOutsideEngineers: false,
    supervisorChargeFreePrimary: '',
    supervisorChargeFreeParticipants: '',
    comments: '',
    remainingAmount: '',
    remainingAmountYear: '2026',
    remainingAmountComments: '',
    aleRemainingAmounts: [],
    contracts: [],
    hasSupplementaryContracts: false,
    supplementaryContracts: [],
    files: [],
    fileGroups: [], // Νέα δομή για ομαδοποίηση αρχείων
    khmdhsAdam: '',
    khmdhsContractSnapshot: null,
    khmdhsContractFetchedAt: '',
    khmdhsNoticeAdam: '',
    khmdhsNoticeSnapshot: null,
    khmdhsNoticeFetchedAt: '',
    khmdhsAwardAdam: '',
    khmdhsAwardSnapshot: null,
    khmdhsContractAmendments: [],
    khmdhsContractChainHistory: [],
    khmdhsContractRoleLabel: '',
    khmdhsAdamChainMeta: null,
    khmdhsChainSeedAdam: '',
    khmdhsRequestAdam: '',
    khmdhsRequestSnapshot: null,
    khmdhsRequestFetchedAt: '',
    khmdhsCommitmentAdam: '',
    khmdhsCommitmentSnapshot: null,
    khmdhsCommitmentFetchedAt: '',
    khmdhsPayments: [],
    khmdhsUserEdits: emptyKhmdhsUserEdits(),
    khmdhsAcknowledgedSituationIds: [],
    khmdhsDocumentRegistry: [],
    khmdhsRelatedDocuments: [],
  });

  const [errors, setErrors] = useState({});
  const [selectedFiles, setSelectedFiles] = useState([]);
  const selectedFilesRef = React.useRef(selectedFiles);
  React.useEffect(() => { selectedFilesRef.current = selectedFiles; }, [selectedFiles]);
  const savedFormFingerprintRef = React.useRef(null);
  const [unsavedCloseModalOpen, setUnsavedCloseModalOpen] = useState(false);
  const [registeredEngineers, setRegisteredEngineers] = useState([]);
  const [auxPickerKey, setAuxPickerKey] = useState(0);
  const [khmdhsChainFetchTarget, setKhmdhsChainFetchTarget] = useState(null);

  // Ref που πάντα δείχνει στο τελευταίο formData — για χρήση σε async callbacks (αποφυγή stale closure)
  const formDataRef = React.useRef(formData);
  React.useEffect(() => { formDataRef.current = formData; });
  const [manualPhaseBaseline, setManualPhaseBaseline] = useState(null);
  const [manualPhaseSavedOnce, setManualPhaseSavedOnce] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatusText, setSaveStatusText] = useState('Αποθήκευση υποέργου…');
  const [activePhaseTab, setActivePhaseTab] = useState('A');
  const [apeConflictModal, setApeConflictModal] = useState(null);
  const [preSaveOverridesOpen, setPreSaveOverridesOpen] = useState(false);
  // { incompat: { message, clearFields, scope } } ή null
  const [statusCleanupModal, setStatusCleanupModal] = useState(null);
  const [dataReviewModalOpen, setDataReviewModalOpen] = useState(false);
  const [reviewFocusItemKey, setReviewFocusItemKey] = useState(null);
  const [khmdhsSituationModal, setKhmdhsSituationModal] = useState(null);
  const [khmdhsHighlightField, setKhmdhsHighlightField] = useState(null);
  const [adamInputDraft, setAdamInputDraft] = useState({ chain: '', contracts: {} });
  const [stripDropdown, setStripDropdown] = useState(null); // null | 'chain'
  const [branchPickerState, setBranchPickerState] = useState(null);
  const [duplicateAnchorModal, setDuplicateAnchorModal] = useState(null);
  const [khmdhsRegistryModal, setKhmdhsRegistryModal] = useState(null);
  const [relatedDocsModal, setRelatedDocsModal] = useState(null);
  const [supplementaryConfirm, setSupplementaryConfirm] = useState(null);
  const [contractExpiryPrompt, setContractExpiryPrompt] = useState(null);
  const [symvChainPlannerState, setSymvChainPlannerState] = useState(null);
  const [apeEntryTarget, setApeEntryTarget] = useState(null);
  const [manualExtensionTarget, setManualExtensionTarget] = useState(null);
  const [phaseBResetUnsaved, setPhaseBResetUnsaved] = useState(false);
  const stripDropdownRef = React.useRef(null);
  const khmdhsChainFetchGenRef = React.useRef({});
  const khmdhsPendingApplyRef = React.useRef(null);
  const khmdhsPendingDataReviewRef = React.useRef(false);
  const khmdhsPendingExpiryFormRef = React.useRef(null);
  const khmdhsPendingExpiryOptionsRef = React.useRef(null);
  const khmdhsDeferRegistryRef = React.useRef(null);
  const khmdhsLastChainResRef = React.useRef(null);
  const khmdhsChainInputRef = React.useRef(null);
  const phaseBResetUnsavedRef = React.useRef(false);
  const handleSaveRef = React.useRef(() => Promise.resolve());
  React.useEffect(() => { phaseBResetUnsavedRef.current = phaseBResetUnsaved; }, [phaseBResetUnsaved]);

  const flushPendingContractExpiryPrompt = useCallback(() => {
    const pending = khmdhsPendingExpiryFormRef.current;
    if (!pending) return;
    khmdhsPendingExpiryFormRef.current = null;
    const options = khmdhsPendingExpiryOptionsRef.current || {};
    khmdhsPendingExpiryOptionsRef.current = null;
    const prompt = evaluateKhmdhsContractExpiryPrompt(pending, options);
    if (prompt) setContractExpiryPrompt(prompt);
  }, []);

  const queueContractExpiryPrompt = useCallback((formSnapshot, options = {}) => {
    if (!formSnapshot) return;
    khmdhsPendingExpiryFormRef.current = formSnapshot;
    khmdhsPendingExpiryOptionsRef.current = options;
    window.setTimeout(() => {
      if (khmdhsPendingExpiryFormRef.current !== formSnapshot) return;
      flushPendingContractExpiryPrompt();
    }, 350);
  }, [flushPendingContractExpiryPrompt]);

  useEffect(() => {
    if (!isOpen || dataReviewModalOpen || khmdhsSituationModal) return undefined;
    if (!khmdhsPendingExpiryFormRef.current) return undefined;
    const timer = window.setTimeout(() => flushPendingContractExpiryPrompt(), 200);
    return () => window.clearTimeout(timer);
  }, [isOpen, dataReviewModalOpen, khmdhsSituationModal, flushPendingContractExpiryPrompt]);

  const directAssignmentCompliance = useMemo(() => {
    if (!isOpen) return { applicable: false, violations: [], missingData: false };
    const draftProject = {
      ...formData,
      subprojectId: editingProject?.subprojectId || formData.subprojectId || null,
      projectId: editingProject?.projectId || formData.projectId || null
    };
    return checkProjectDirectAssignmentCompliance(draftProject, allProjects);
  }, [isOpen, formData, editingProject, allProjects]);

  const cancelKhmdhsFetch = React.useCallback(() => {
    // Bump ALL per-key counters ώστε κάθε in-flight fetch να ακυρωθεί
    if (typeof khmdhsChainFetchGenRef.current === 'object' && khmdhsChainFetchGenRef.current !== null) {
      Object.keys(khmdhsChainFetchGenRef.current).forEach((k) => {
        khmdhsChainFetchGenRef.current[k] = (khmdhsChainFetchGenRef.current[k] || 0) + 1;
      });
    } else {
      khmdhsChainFetchGenRef.current = {};
    }
    setKhmdhsChainFetchTarget(null);
    setSymvChainPlannerState(null);
  }, []);

  useEffect(() => {
    if (isOpen) return undefined;
    cancelKhmdhsFetch();
    return undefined;
  }, [isOpen, cancelKhmdhsFetch]);

  useEffect(() => {
    if (!isOpen) return undefined;
    lockBodyScroll('project-form');
    return () => unlockBodyScroll('project-form');
  }, [isOpen]);

  useEffect(() => {
    if (!stripDropdown) return undefined;
    const handleOutside = (e) => {
      if (stripDropdownRef.current && !stripDropdownRef.current.contains(e.target)) {
        setStripDropdown(null);
      }
    };
    const handleEsc = (e) => { if (e.key === 'Escape') setStripDropdown(null); };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [stripDropdown]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await ipcRenderer.invoke('get-registered-engineers');
        if (cancelled) return;
        if (res?.success && Array.isArray(res.engineers)) {
          setRegisteredEngineers(res.engineers);
        } else {
          setRegisteredEngineers([]);
        }
      } catch {
        if (!cancelled) setRegisteredEngineers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const wasOpenRef = useRef(false);
  const phaseBDividerRef = useRef(null);
  const formScrollRef = useRef(null);
  const formOverlayRef = useRef(null);

  const handleFormOverlayWheel = useCallback((e) => {
    if (e.target.closest('[data-khmdhs-review-modal]')) return;
    if (e.target.closest('[data-khmdhs-situation-modal]')) return;
    if (e.target.closest('[data-khmdhs-document-registry-modal]')) return;
    if (e.target.closest('[data-khmdhs-branch-picker-modal]')) return;
    if (e.target.closest('[data-khmdhs-symv-planner-modal]')) return;
    if (e.target.closest('[data-khmdhs-ape-entry-modal]')) return;
    if (e.target.closest('[data-khmdhs-related-docs-modal]')) return;
    if (e.target.closest('[data-file-manager-modal]')) return;
    if (formScrollRef.current?.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Το onWheel του React είναι passive στη React 17+ — προσθέτουμε non-passive listener χειροκίνητα
  useEffect(() => {
    const el = formOverlayRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleFormOverlayWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleFormOverlayWheel, { passive: false });
  }, [handleFormOverlayWheel]);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      setContractExpiryPrompt(null);
      khmdhsPendingExpiryFormRef.current = null;
      return;
    }
    if (wasOpenRef.current) {
      return;
    }
    wasOpenRef.current = true;

    if (editingProject) {
      // Backward compatibility: μετατροπή aleCode string σε aleCodes array
      let aleCodes = [];
      if (editingProject.aleCodes && Array.isArray(editingProject.aleCodes)) {
        aleCodes = editingProject.aleCodes;
      } else if (editingProject.aleCode && typeof editingProject.aleCode === 'string') {
        aleCodes = [editingProject.aleCode];
      }
      
      // Backward compat για aleRemainingAmounts
      let aleRemainingAmounts = [];
      if (editingProject.aleRemainingAmounts && Array.isArray(editingProject.aleRemainingAmounts)) {
        aleRemainingAmounts = editingProject.aleRemainingAmounts;
        // Εξασφαλίζουμε ότι το μέγεθος ταιριάζει με τους κωδικούς
        while (aleRemainingAmounts.length < aleCodes.length) {
          aleRemainingAmounts = [...aleRemainingAmounts, ''];
        }
        aleRemainingAmounts = aleRemainingAmounts.slice(0, aleCodes.length);
      } else {
        // Δεν υπάρχουν δεδομένα - αρχικοποιούμε κενά
        aleRemainingAmounts = aleCodes.map(() => '');
      }

      const supervisorEngineerIds = Array.isArray(editingProject.supervisorEngineerIds)
        ? editingProject.supervisorEngineerIds.map((x) => String(x || '').trim()).filter(Boolean)
        : [];

      const fp0 = editingProject.supervisorChargeFreePrimary != null ? String(editingProject.supervisorChargeFreePrimary) : '';
      const fpart0 =
        editingProject.supervisorChargeFreeParticipants != null ? String(editingProject.supervisorChargeFreeParticipants) : '';
      const hadLegacyFree = !!(fp0.trim() || fpart0.trim());
      const explicitOutside = editingProject.supervisorChargeOutsideEngineers === true;
      const explicitInside = editingProject.supervisorChargeOutsideEngineers === false;
      const supervisorChargeOutsideEngineers =
        explicitOutside || (!explicitInside && hadLegacyFree && supervisorEngineerIds.length === 0);
      const mergedFree = [fp0.trim(), fpart0.trim()].filter(Boolean).join('\n');

      const { supervisor: _legacySupervisor, ...editingRest } = editingProject;
      const khmdhsNoticeSnapshotLoaded = pickKhmdhsNoticeSnapshot(editingProject.khmdhsNoticeSnapshot);
      const khmdhsDrivesProcedure = noticeDrivesAssignmentProcedure({
        ...editingProject,
        khmdhsNoticeSnapshot: khmdhsNoticeSnapshotLoaded,
      });
      const loadedForm = mergeKhmdhsSupplementaryIntoForm(
        applyChainCharacterizationToForm({
        ...editingRest,
        assignmentProcedure: khmdhsDrivesProcedure ? '' : (editingRest.assignmentProcedure || ''),
        aleCodes: aleCodes,
        aleRemainingAmounts: aleRemainingAmounts,
        coFinanced: editingProject.coFinanced === true,
        fundingSources: Array.isArray(editingProject.fundingSources) ? editingProject.fundingSources : [],
        contracts: loadContractsFromProject(editingProject),
        fileGroups: editingProject.fileGroups || [],
        supervisorEngineerIds,
        supervisorChargeOutsideEngineers,
        supervisorChargeFreePrimary: supervisorChargeOutsideEngineers ? mergedFree || fp0 : fp0,
        supervisorChargeFreeParticipants: supervisorChargeOutsideEngineers ? '' : fpart0,
        khmdhsAdam: editingProject.khmdhsAdam != null ? String(editingProject.khmdhsAdam) : '',
        khmdhsContractSnapshot: pickKhmdhsSnapshot(editingProject.khmdhsContractSnapshot),
        khmdhsContractFetchedAt: editingProject.khmdhsContractFetchedAt != null ? String(editingProject.khmdhsContractFetchedAt) : '',
        khmdhsNoticeAdam: editingProject.khmdhsNoticeAdam != null ? String(editingProject.khmdhsNoticeAdam) : '',
        khmdhsNoticeSnapshot: pickKhmdhsNoticeSnapshot(editingProject.khmdhsNoticeSnapshot),
        khmdhsNoticeFetchedAt: editingProject.khmdhsNoticeFetchedAt != null ? String(editingProject.khmdhsNoticeFetchedAt) : '',
        khmdhsAwardAdam: editingProject.khmdhsAwardAdam != null ? String(editingProject.khmdhsAwardAdam) : '',
        khmdhsAwardSnapshot: editingProject.khmdhsAwardSnapshot || null,
        khmdhsContractAmendments: Array.isArray(editingProject.khmdhsContractAmendments)
          ? editingProject.khmdhsContractAmendments
          : [],
        khmdhsContractChainHistory: Array.isArray(editingProject.khmdhsContractChainHistory)
          ? editingProject.khmdhsContractChainHistory
          : [],
        khmdhsContractRoleLabel: editingProject.khmdhsContractRoleLabel != null
          ? String(editingProject.khmdhsContractRoleLabel)
          : '',
        khmdhsAdamChainMeta: editingProject.khmdhsAdamChainMeta || null,
        khmdhsChainSeedAdam: getStoredChainSeedAdam(editingProject, editingProject),
        khmdhsRequestAdam: editingProject.khmdhsRequestAdam != null ? String(editingProject.khmdhsRequestAdam) : '',
        khmdhsRequestSnapshot: editingProject.khmdhsRequestSnapshot || null,
        khmdhsRequestFetchedAt: editingProject.khmdhsRequestFetchedAt != null ? String(editingProject.khmdhsRequestFetchedAt) : '',
        khmdhsCommitmentAdam: editingProject.khmdhsCommitmentAdam != null ? String(editingProject.khmdhsCommitmentAdam) : '',
        khmdhsCommitmentSnapshot: editingProject.khmdhsCommitmentSnapshot || null,
        khmdhsCommitmentFetchedAt: editingProject.khmdhsCommitmentFetchedAt != null ? String(editingProject.khmdhsCommitmentFetchedAt) : '',
        khmdhsCommitmentDecisions: Array.isArray(editingProject.khmdhsCommitmentDecisions) ? editingProject.khmdhsCommitmentDecisions : [],
        khmdhsPayments: Array.isArray(editingProject.khmdhsPayments) ? editingProject.khmdhsPayments : [],
        khmdhsDataQualityReview: editingProject.khmdhsDataQualityReview || null,
        khmdhsUserEdits: ensureKhmdhsUserEdits(editingProject),
        khmdhsAcknowledgedSituationIds: Array.isArray(editingProject.khmdhsAcknowledgedSituationIds) ? editingProject.khmdhsAcknowledgedSituationIds : [],
      }, editingProject.khmdhsDataQualityReview || null)
      );
      const sanitizedLoadedForm = sanitizeLegacyApeCommentsPollution(
        stripOrphanKhmdhsSymvPlan(loadedForm)
      );
      const withSymvDqr = (
        sanitizedLoadedForm.khmdhsSymvChainPlan?.items?.length
        && sanitizedLoadedForm.khmdhsDataQualityReview
        && shouldMergeSymvPlanIntoDataQualityReview(
          sanitizedLoadedForm.khmdhsDataQualityReview,
          sanitizedLoadedForm.khmdhsSymvChainPlan,
          sanitizedLoadedForm
        )
      )
        ? {
          ...sanitizedLoadedForm,
          khmdhsDataQualityReview: mergeSymvChainPlanIntoDataQualityReview(
            sanitizedLoadedForm.khmdhsDataQualityReview,
            sanitizedLoadedForm.khmdhsSymvChainPlan,
            sanitizedLoadedForm
          ),
        }
        : sanitizedLoadedForm;
      setFormData(withSymvDqr);
      savedFormFingerprintRef.current = buildProjectFormFingerprint(withSymvDqr, { selectedFilesCount: 0 });
      queueContractExpiryPrompt(withSymvDqr);
      setManualPhaseBaseline(serializePhaseASnapshot(pickPhaseASnapshot(
        sanitizeLegacyApeCommentsPollution({
        ...editingProject,
        aleCodes,
        aleRemainingAmounts,
        contracts: loadContractsFromProject(editingProject),
        supervisorEngineerIds,
        supervisorChargeOutsideEngineers,
        supervisorChargeFreePrimary: supervisorChargeOutsideEngineers ? mergedFree || fp0 : fp0,
        supervisorChargeFreeParticipants: supervisorChargeOutsideEngineers ? '' : fpart0,
        })
      )));
      setManualPhaseSavedOnce(true);
      setActivePhaseTab('B');
    } else {
      // Reset form for new project
      setActivePhaseTab('A');
      const emptyNewForm = {
        projectTitle: '',
        subprojectTitle: '',
        implementationForm: '',
        kaCode: '',
        noKaCode: false,
        eisigitikiEkthesi: '',
        aleCodes: [],
        misPraxhsName: '',
        misPraxhsCode: '',
        projectType: '',
        fundingSource: '',
        fundingDetails: '',
        coFinanced: false,
        fundingSources: [],
        approvedAmount: '',
        projectBudget: '',
        projectStatus: '',
        assignmentProcedure: '',
        contractProcessStartDate: '',
        contractDate: '',
        contractEndDate: '',
        contractAmount: '',
        apeAmount: '',
        apeComments: '',
        supervisorEngineerIds: [],
        supervisorChargeOutsideEngineers: false,
        supervisorChargeFreePrimary: '',
        supervisorChargeFreeParticipants: '',
        comments: '',
        remainingAmount: '',
        remainingAmountYear: '2026',
        remainingAmountComments: '',
        aleRemainingAmounts: [],
        contracts: [],
        hasSupplementaryContracts: false,
        supplementaryContracts: [],
        files: [],
        fileGroups: [],
        khmdhsAdam: '',
        khmdhsContractSnapshot: null,
        khmdhsContractFetchedAt: '',
        khmdhsNoticeAdam: '',
        khmdhsNoticeSnapshot: null,
        khmdhsNoticeFetchedAt: '',
        khmdhsAwardAdam: '',
        khmdhsAwardSnapshot: null,
        khmdhsContractAmendments: [],
        khmdhsContractChainHistory: [],
        khmdhsContractRoleLabel: '',
        khmdhsAdamChainMeta: null,
        khmdhsChainSeedAdam: '',
        khmdhsRequestAdam: '',
        khmdhsRequestSnapshot: null,
        khmdhsRequestFetchedAt: '',
        khmdhsCommitmentAdam: '',
        khmdhsCommitmentSnapshot: null,
        khmdhsCommitmentFetchedAt: '',
        khmdhsPayments: [],
        khmdhsUserEdits: emptyKhmdhsUserEdits(),
        khmdhsDocumentRegistry: [],
        khmdhsRelatedDocuments: [],
      };
      setFormData(emptyNewForm);
      savedFormFingerprintRef.current = buildProjectFormFingerprint(emptyNewForm, { selectedFilesCount: 0 });
      setManualPhaseBaseline(null);
      setManualPhaseSavedOnce(false);
    }
    setErrors({});
    setTouched({}); // Reset touched fields when form opens/closes
    setSelectedFiles([]);
    setAdamInputDraft({ chain: '', contracts: {} });
    setPhaseBResetUnsaved(false);
    setUnsavedCloseModalOpen(false);
  }, [editingProject, isOpen]);

  const validateKACode = (code) => {
    const pattern = /^\d{2}-\d{4}\.\d{3}$/;
    return pattern.test(code);
  };

  // Real-time validation functions
  const validateField = (field, value) => {
    switch (field) {
      case 'projectTitle':
        if (!value || value.trim().length === 0) {
          return 'Ο τίτλος έργου είναι υποχρεωτικός';
        }
        if (value.trim().length < 3) {
          return 'Ο τίτλος έργου πρέπει να είναι τουλάχιστον 3 χαρακτήρες';
        }
        if (value.trim().length > 500) {
          return 'Ο τίτλος έργου είναι πολύ μακρύς (μέγιστο 500 χαρακτήρες)';
        }
        return null; // Valid
        
      case 'subprojectTitle':
        if (!value || value.trim().length === 0) {
          return 'Ο τίτλος υποέργου είναι υποχρεωτικός';
        }
        if (value.trim().length < 3) {
          return 'Ο τίτλος υποέργου πρέπει να είναι τουλάχιστον 3 χαρακτήρες';
        }
        if (value.trim().length > 500) {
          return 'Ο τίτλος υποέργου είναι πολύ μακρύς (μέγιστο 500 χαρακτήρες)';
        }
        return null; // Valid
        
      case 'kaCode':
        if (formData.noKaCode) {
          return null; // No validation if noKaCode is checked
        }
        // Πλέον ο κωδικός ΚΑ δεν είναι υποχρεωτικός
        if (!value || value.trim().length === 0) {
          return null; // Επιτρέπεται κενό
        }
        if (!validateKACode(value)) {
          return 'Ο κωδικός ΚΑ πρέπει να έχει μορφή: 12-3456.789';
        }
        return null; // Valid
        
      case 'approvedAmount':
      case 'projectBudget':
      case 'contractAmount':
      case 'apeAmount':
        if (!value || value.trim().length === 0) {
          return null; // Allow empty for now, will be validated on submit
        }
        // Remove formatting (spaces, dots, commas) but keep minus
        let cleanValue = value.replace(/[\s.,]/g, '');
        // Handle comma as decimal separator
        if (value.includes(',')) {
          const parts = value.split(',');
          if (parts.length === 2) {
            cleanValue = parts[0].replace(/[\s.]/g, '') + '.' + parts[1];
          }
        }
        // Handle dot as decimal separator if no comma
        else if (value.includes('.') && !value.includes(',')) {
          const parts = value.split('.');
          if (parts.length === 2) {
            cleanValue = parts[0].replace(/[\s,]/g, '') + '.' + parts[1];
          }
        }
        // Keep minus if present
        const hasMinus = cleanValue.startsWith('-');
        cleanValue = cleanValue.replace(/[^\d.]/g, '');
        if (hasMinus) {
          cleanValue = '-' + cleanValue;
        }
        
        const numValue = parseFloat(cleanValue);
        if (isNaN(numValue)) {
          return 'Πρέπει να είναι αριθμός';
        }
        // Allow negative numbers (removed the < 0 check)
        if (Math.abs(numValue) > 999999999.99) {
          return 'Το ποσό είναι πολύ μεγάλο (μέγιστο 999.999.999,99)';
        }
        return null; // Valid
        
      default:
        return null;
    }
  };

  const formatAmount = (value) => {
    if (!value) return '';
    
    // Επιτρέπω πλην στην αρχή (για αρνητικούς αριθμούς)
    // Αφαίρεση όλων των χαρακτήρων εκτός από ψηφία, κόμματα, τελείες και πλην στην αρχή
    let cleaned = value;
    
    // Κρατάω πλην μόνο στην αρχή
    const hasMinusAtStart = cleaned.startsWith('-');
    cleaned = cleaned.replace(/[^\d,.]/g, '');
    if (hasMinusAtStart && cleaned.length > 0) {
      cleaned = '-' + cleaned;
    }
    
    // Αν δεν υπάρχουν ψηφία, επιστρέφω κενό
    if (!/\d/.test(cleaned)) return '';
    
    // Απλή καθαρισμό για typing - επιτρέπω ελεύθερη πληκτρολόγηση
    return cleaned;
  };

  const formatAmountOnBlur = (value) => {
    if (!value) return '';
    
    // Επιτρέπω πλην στην αρχή (για αρνητικούς αριθμούς)
    const hasMinusAtStart = value.trim().startsWith('-');
    // Αφαίρεση όλων των χαρακτήρων εκτός από ψηφία, κόμματα και τελείες
    let cleaned = value.replace(/[^\d,.]/g, '');
    
    if (!/\d/.test(cleaned)) return '';
    
    let integerPart = '';
    let decimalPart = '';
    
    // Αφαίρεση πλην προσωρινά για processing
    const isNegative = cleaned.startsWith('-');
    if (isNegative) {
      cleaned = cleaned.substring(1);
    }
    
    // Αναγνώριση του τρόπου εισαγωγής και μετατροπή σε ευρωπαϊκή μορφή
    if (cleaned.includes('.') && cleaned.includes(',')) {
      if (cleaned.indexOf(',') < cleaned.lastIndexOf('.')) {
        // Αμερικανική μορφή (25,254.25)
        let parts = cleaned.split('.');
        integerPart = parts[0].replace(/,/g, '');
        decimalPart = parts[parts.length - 1].slice(0, 2);
      } else {
        // Ευρωπαϊκή μορφή (25.254,25)
        let parts = cleaned.split(',');
        integerPart = parts[0].replace(/\./g, '');
        decimalPart = parts[parts.length - 1].slice(0, 2);
      }
    } else if (cleaned.includes(',')) {
      let parts = cleaned.split(',');
      integerPart = parts[0];
      decimalPart = parts[1] ? parts[1].slice(0, 2) : '';
    } else if (cleaned.includes('.')) {
      let parts = cleaned.split('.');
      if (parts[0].length <= 3 && parts[1]) {
        integerPart = parts[0];
        decimalPart = parts[1].slice(0, 2);
      } else {
        integerPart = cleaned.replace(/\./g, '');
      }
    } else {
      integerPart = cleaned;
    }
    
    // Μορφοποίηση του ακέραιου μέρους με τελείες για χιλιάδες
    let formattedInteger = '';
    if (integerPart.length > 3) {
      for (let i = integerPart.length - 1, count = 0; i >= 0; i--, count++) {
        if (count > 0 && count % 3 === 0) {
          formattedInteger = '.' + formattedInteger;
        }
        formattedInteger = integerPart[i] + formattedInteger;
      }
    } else {
      formattedInteger = integerPart;
    }
    
    let result = formattedInteger;
    if (decimalPart) {
      result += ',' + decimalPart;
    }
    
    // Προσθήκη πλην αν υπήρχε στην αρχή
    if (hasMinusAtStart) {
      result = '-' + result;
    }
    
    return result;
  };

  // ALE Codes management
  const handleAddAleCode = () => {
    setFormData(prev => ({
      ...prev,
      aleCodes: [...prev.aleCodes, ''],
      aleRemainingAmounts: [...(prev.aleRemainingAmounts || []), '']
    }));
  };

  const handleAleCodeChange = (index, value) => {
    setFormData(prev => {
      const newAleCodes = [...prev.aleCodes];
      newAleCodes[index] = value;
      return { ...prev, aleCodes: newAleCodes };
    });
  };

  const handleRemoveAleCode = (index) => {
    setFormData(prev => {
      const newAleCodes = prev.aleCodes.filter((_, i) => i !== index);
      const newAleRemainingAmounts = (prev.aleRemainingAmounts || []).filter((_, i) => i !== index);
      // Υπολογισμός νέου συνόλου
      const newTotal = newAleRemainingAmounts.reduce((sum, amt) => {
        const parsed = parseFormattedAmount(amt);
        return sum + (isNaN(parsed) ? 0 : parsed);
      }, 0);
      return {
        ...prev,
        aleCodes: newAleCodes,
        aleRemainingAmounts: newAleRemainingAmounts,
        remainingAmount: newAleCodes.length >= 1 && newTotal > 0
          ? formatNumberToEuropean(newTotal)
          : ''
      };
    });
  };

  // Helper: μετατροπή μορφοποιημένου ποσού σε αριθμό
  const parseFormattedAmount = (value) => {
    if (!value) return 0;
    const cleaned = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned);
  };

  // Helper: μετατροπή αριθμού σε ευρωπαϊκή μορφή (25.587,56)
  const formatNumberToEuropean = (num) => {
    if (isNaN(num) || num === 0) return '';
    return num.toLocaleString('el-GR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true
    });
  };

  const handleAleRemainingAmountChange = (index, value) => {
    value = formatAmount(value);
    setFormData(prev => {
      const newAmounts = [...(prev.aleRemainingAmounts || [])];
      newAmounts[index] = value;
      const total = newAmounts.reduce((sum, amt) => {
        const parsed = parseFormattedAmount(amt);
        return sum + (isNaN(parsed) ? 0 : parsed);
      }, 0);
      return {
        ...prev,
        aleRemainingAmounts: newAmounts,
        remainingAmount: total > 0 ? formatNumberToEuropean(total) : ''
      };
    });
  };

  const handleAleRemainingAmountBlur = (index) => {
    setFormData(prev => {
      const newAmounts = [...(prev.aleRemainingAmounts || [])];
      newAmounts[index] = formatAmountOnBlur(newAmounts[index] || '');
      const total = newAmounts.reduce((sum, amt) => {
        const parsed = parseFormattedAmount(amt);
        return sum + (isNaN(parsed) ? 0 : parsed);
      }, 0);
      return {
        ...prev,
        aleRemainingAmounts: newAmounts,
        remainingAmount: total > 0 ? formatNumberToEuropean(total) : ''
      };
    });
  };

  const validateForm = ({ includePhaseB = false, formSnapshot = null } = {}) => {
    const newErrors = {};
    const fd = formSnapshot || formData;

    if (!formData.projectTitle.trim()) {
      newErrors.projectTitle = 'Απαιτείται τίτλος έργου';
    }

    if (!formData.subprojectTitle.trim()) {
      newErrors.subprojectTitle = 'Απαιτείται τίτλος υποέργου';
    }

    if (
      !formData.noKaCode &&
      formData.kaCode &&
      formData.kaCode.trim().length > 0 &&
      !validateKACode(formData.kaCode)
    ) {
      newErrors.kaCode = 'Ο κωδικός ΚΑ πρέπει να έχει μορφή xx-xxxx.xxx';
    }

    // Validation για MIS ΠΡΑΞΗΣ: αν έχει ένα από τα δύο, πρέπει να έχει και το άλλο
    const hasMisPraxhsName = formData.misPraxhsName && formData.misPraxhsName.trim();
    const hasMisPraxhsCode = formData.misPraxhsCode && formData.misPraxhsCode.trim();
    
    if (hasMisPraxhsName && !hasMisPraxhsCode) {
      newErrors.misPraxhsCode = 'Παρακαλώ συμπληρώστε και τον κωδικό';
    }
    
    if (hasMisPraxhsCode && !hasMisPraxhsName) {
      newErrors.misPraxhsName = 'Παρακαλώ συμπληρώστε και το όνομα του κωδικού';
    }

    if (!formData.projectType) {
      newErrors.projectType = 'Επιλέξτε είδος';
    }

    if (formData.coFinanced) {
      const rows = Array.isArray(formData.fundingSources) ? formData.fundingSources : [];
      const validRows = rows.filter((r) => r && r.source && r.details && parseCoFinancingAmount(r.amount) > 0);
      if (validRows.length === 0) {
        newErrors.fundingSources = 'Προσθέστε τουλάχιστον μία πηγή χρηματοδότησης με πηγή, εξειδίκευση και ποσό';
      } else if (!validRows.some((r) => !r.ownResources)) {
        newErrors.fundingSources = 'Απαιτείται τουλάχιστον μία πηγή χρηματοδότησης εκτός ιδίων πόρων';
      }
    } else {
      if (!formData.fundingSource) {
        newErrors.fundingSource = 'Επιλέξτε πηγή χρηματοδότησης';
      }

      if (!formData.fundingDetails) {
        newErrors.fundingDetails = 'Επιλέξτε εξειδίκευση πηγής χρηματοδότησης';
      }

      if (!formData.approvedAmount) {
        newErrors.approvedAmount = 'Απαιτείται εγκεκριμένο ποσό';
      }
    }

    if (!formData.projectStatus) {
      newErrors.projectStatus = 'Επιλέξτε κατάσταση έργου';
    }

    if (!includePhaseB) {
      return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
    }

    if (!fd.implementationForm) {
      newErrors.implementationForm =
        'Επιλέξτε μορφή υλοποίησης ή κάντε ανάκτηση ΚΗΜΔΗΣ για αυτόματο συμπλήρωμα';
    }

    const needsKhmdhsPanel = fd.implementationForm
      && !isAbandonedSubproject(fd.projectStatus)
      && fd.projectStatus !== 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ'
      && (
        statusShowsAssignmentProcedure(fd.projectStatus)
        || STATUSES_WITH_CONTRACT_FIELDS.includes(fd.projectStatus)
      );

    if (needsKhmdhsPanel && !fd.projectBudget && formKhmdhsHidesManualProjectBudget(fd)) {
      newErrors.projectBudget = 'Απαιτείται προϋπολογισμός από ΚΗΜΔΗΣ (πρωτογενές αίτημα REQ) — κάντε ανάκτηση ΑΔΑΜ';
    }

    if (isMultipleContractsForm(fd.implementationForm)) {
      (fd.contracts || []).forEach((contract, index) => {
        const adam = sanitizeAdamInput(contract?.khmdhsAdam);
        if (!adam) return;
        const adamErr = getAdamFieldError(adam, 'strict');
        if (adamErr) newErrors[`khmdhsAdam${index}`] = adamErr;
      });
    } else {
      const adam = sanitizeAdamInput(fd.khmdhsAdam);
      if (adam) {
        const adamErr = getAdamFieldError(adam, 'strict');
        if (adamErr) newErrors.khmdhsAdam = adamErr;
      }
    }

    const noticeAdam = sanitizeAdamInput(fd.khmdhsNoticeAdam);
    if (noticeAdam) {
      const noticeAdamErr = getNoticeAdamFieldError(noticeAdam, 'strict');
      if (noticeAdamErr) newErrors.khmdhsNoticeAdam = noticeAdamErr;
    }

    const needsKhmdhsChain =
      needsKhmdhsPanel
      && (
        statusShowsAssignmentProcedure(fd.projectStatus)
        || STATUSES_WITH_CONTRACT_FIELDS.includes(fd.projectStatus)
      );
    if (needsKhmdhsChain && !projectHasResolvedChainData(fd)) {
      if (isMultipleContractsForm(fd.implementationForm)) {
        if (!hasResolvedNoticeData(fd)) {
          newErrors.khmdhsSharedChain = 'Απαιτείται ανάκτηση ΚΗΜΔΗΣ (τουλάχιστον μία σύμβαση) για κοινά στοιχεία δημοσίευσης';
        }
        (fd.contracts || []).forEach((contract, index) => {
          if (STATUSES_WITH_CONTRACT_FIELDS.includes(fd.projectStatus) && !contractRowHasKhmdhsData(contract)) {
            newErrors[`khmdhsAdam${index}`] = 'Απαιτείται ανάκτηση ΑΔΑΜ για αυτή τη σύμβαση';
          }
        });
      } else {
        newErrors.khmdhsChainSeedAdam = 'Απαιτείται επιτυχής ανάκτηση από ΚΗΜΔΗΣ (ΑΔΑΜ αλυσίδας)';
      }
    }

    // Validate contract process start date if status is "ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ"
    // Check if contractProcessStartDate is before contractDate (if contractDate exists)
    // This validation applies to all statuses from "ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ" onwards
    // Όταν το πεδίο είναι κλειδωμένο από ΚΗΜΔΗΣ, ο χρήστης δεν μπορεί να το διορθώσει — δεν μπλοκάρουμε την αποθήκευση.
    if (
      fd.projectStatus
      && PROJECT_STATUSES.indexOf(fd.projectStatus) >= PROJECT_STATUSES.indexOf('ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ')
      && fd.contractProcessStartDate
      && !formKhmdhsHidesManualProcessStart(fd)
    ) {
      if (fd.implementationForm === 'Μια Σύμβαση' && fd.contractDate) {
        if (!isAppDateBefore(fd.contractProcessStartDate, fd.contractDate)) {
          newErrors.contractProcessStartDate = 'Η ημερομηνία έναρξης διαδικασίας πρέπει να είναι προγενέστερη της ημερομηνίας σύμβασης';
        }
      }

      if (fd.implementationForm === 'Πολλές Συμβάσεις' && fd.contracts && fd.contracts.length > 0) {
        const invalidContracts = fd.contracts.filter((contract) => {
          if (contract.date) {
            return !isAppDateBefore(fd.contractProcessStartDate, contract.date);
          }
          return false;
        });
        if (invalidContracts.length > 0) {
          newErrors.contractProcessStartDate = 'Η ημερομηνία έναρξης διαδικασίας πρέπει να είναι προγενέστερη όλων των ημερομηνιών σύμβασης';
        }
      }
    }

    if (includePhaseB && STATUSES_WITH_CONTRACT_FIELDS.includes(fd.projectStatus)) {
      if (fd.implementationForm === 'Μια Σύμβαση') {
        if (!formKhmdhsHidesManualContractDate(fd) && !fd.contractDate) {
          newErrors.contractDate = 'Απαιτείται ημερομηνία υπογραφής σύμβασης';
        }
        if (!formKhmdhsHidesManualContractAmount(fd) && !fd.contractAmount) {
          newErrors.contractAmount = 'Απαιτείται ποσό σύμβασης';
        }
        if (formKhmdhsHidesManualContractDate(fd) && !fd.contractDate) {
          newErrors.contractDate = 'Απαιτείται ημερομηνία υπογραφής σύμβασης (ΚΗΜΔΗΣ)';
        }
        if (formKhmdhsHidesManualContractAmount(fd) && !fd.contractAmount) {
          newErrors.contractAmount = 'Απαιτείται ποσό σύμβασης (ΚΗΜΔΗΣ)';
        }
      } else if (isMultipleContractsForm(fd.implementationForm)) {
        if (!fd.contracts || fd.contracts.length === 0) {
          newErrors.contracts = 'Προσθέστε τουλάχιστον μία σύμβαση';
        } else {
          fd.contracts.forEach((contract, index) => {
            const hideDate = formKhmdhsHidesManualContractDate(fd, index);
            const hideAmount = formKhmdhsHidesManualContractAmount(fd, index);
            if (!hideDate && !contract.date) {
              newErrors[`contractDate${index}`] = 'Απαιτείται ημερομηνία';
            }
            if (!hideAmount && !contract.amount) {
              newErrors[`contractAmount${index}`] = 'Απαιτείται ποσό';
            }
            if (hideDate && !contract.date) {
              newErrors[`contractDate${index}`] = 'Απαιτείται ημερομηνία (ΚΗΜΔΗΣ)';
            }
            if (hideAmount && !contract.amount) {
              newErrors[`contractAmount${index}`] = 'Απαιτείται ποσό (ΚΗΜΔΗΣ)';
            }
          });
        }
      }
    }

    Object.assign(newErrors, validateKhmdhsDataQualityReview(fd));

    if (includePhaseB && !formKhmdhsHidesManualProjectBudget(fd) && needsKhmdhsPanel && !fd.projectBudget) {
      newErrors.projectBudget = 'Απαιτείται προϋπολογισμός — συμπληρώστε χειροκίνητα ή κάντε ανάκτηση ΑΔΑΜ';
    }

    if (includePhaseB && !formKhmdhsHidesManualAssignmentProcedure(fd) && statusShowsAssignmentProcedure(fd.projectStatus) && !fd.assignmentProcedure) {
      newErrors.assignmentProcedure = 'Επιλέξτε διαδικασία ανάθεσης';
    }

    if (includePhaseB && !formKhmdhsHidesManualProcessStart(fd) && statusShowsAssignmentProcedure(fd.projectStatus) && !fd.contractProcessStartDate) {
      newErrors.contractProcessStartDate = 'Συμπληρώστε την ημερομηνία έναρξης διαδικασίας σύμβασης';
    }

    setErrors(newErrors);
    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  const handleInputChange = (field, value) => {
    if (field === 'kaCode' && !formData.noKaCode) {
      // Auto-format KA code - επιτρέπω ψηφία, παύλα και τελεία
      value = value.replace(/[^\d\-.]/g, '');
      
      // Αυτόματη μορφοποίηση
      let digitsOnly = value.replace(/[^\d]/g, '');
      
      if (digitsOnly.length <= 2) {
        value = digitsOnly;
      } else if (digitsOnly.length <= 6) {
        value = digitsOnly.slice(0, 2) + '-' + digitsOnly.slice(2);
      } else if (digitsOnly.length <= 9) {
        value = digitsOnly.slice(0, 2) + '-' + digitsOnly.slice(2, 6) + '.' + digitsOnly.slice(6);
      } else {
        value = digitsOnly.slice(0, 2) + '-' + digitsOnly.slice(2, 6) + '.' + digitsOnly.slice(6, 9);
      }
    }

    if (field === 'approvedAmount' || field === 'projectBudget' || field === 'contractAmount' || field === 'apeAmount') {
      value = formatAmount(value);
    }

    if (field === 'khmdhsAdam') {
      cancelKhmdhsFetch();
      value = sanitizeAdamInput(value);
    }

    if (field === 'khmdhsChainSeedAdam') {
      cancelKhmdhsFetch();
      value = sanitizeAdamInput(value);
      setFormData((prev) => ({
        ...prev,
        khmdhsChainSeedAdam: value
      }));
      const err = getAdamFieldError(value, 'live');
      setErrors((prev) => {
        const next = { ...prev };
        if (err) next.khmdhsChainSeedAdam = err;
        else delete next.khmdhsChainSeedAdam;
        return next;
      });
      return;
    }

    if (field === 'implementationForm') {
      cancelKhmdhsFetch();
      setFormData((prev) => {
        const next = { ...prev, implementationForm: value };

        if (value === 'Πολλές Συμβάσεις') {
          const migrated = migrateKhmdhsSingleToMultiForm(prev);
          Object.assign(next, migrated);
          next.implementationForm = value;
          next.contractDate = '';
          next.contractAmount = '';
          next.apeAmount = '';
          next.apeComments = '';
          next.khmdhsAdam = '';
          next.khmdhsContractSnapshot = null;
          next.khmdhsContractFetchedAt = '';
          next.khmdhsContractAmendments = [];
          next.khmdhsContractChainHistory = [];
        } else if (value === 'Μια Σύμβαση') {
          const extraRows = (prev.contracts || []).slice(1).filter(
            (row) => row?.khmdhsAdam || row?.amount || row?.date || row?.apeAmount
          );
          if (extraRows.length > 0) {
            const ok = window.confirm(
              `Έχετε ${(prev.contracts || []).length} γραμμές σύμβασης. Με «Μια Σύμβαση» διατηρείται μόνο η 1η — οι υπόλοιπες ${extraRows.length} γραμμή/ές και τα στοιχεία τους θα χαθούν.\n\nΘέλετε να συνεχίσετε;`
            );
            if (!ok) return prev;
          }
          const migrated = migrateKhmdhsMultiToSingleForm(prev);
          Object.assign(next, migrated);
          next.implementationForm = value;
        }

        return next;
      });
      setErrors((prev) => {
        const next = { ...prev };
        delete next.contracts;
        delete next.contractDate;
        delete next.contractAmount;
        delete next.apeAmount;
        delete next.khmdhsAdam;
        Object.keys(next).forEach((key) => {
          if (key.startsWith('contractDate') || key.startsWith('contractAmount') || key.startsWith('apeAmount') || key.startsWith('khmdhsAdam')) {
            delete next[key];
          }
        });
        return next;
      });
      return;
    }

    if (field === 'khmdhsNoticeAdam') {
      cancelKhmdhsFetch();
      const adam = sanitizeAdamInput(value);
      setFormData((prev) => ({
        ...prev,
        khmdhsNoticeAdam: adam,
        ...(adam ? {} : {
          khmdhsNoticeSnapshot: null,
          khmdhsNoticeFetchedAt: ''
        })
      }));
      const err = getNoticeAdamFieldError(adam, 'live');
      setErrors((prev) => {
        const next = { ...prev };
        if (err) next.khmdhsNoticeAdam = err;
        else delete next.khmdhsNoticeAdam;
        return next;
      });
      return;
    }

    if (field === 'projectStatus') {
      cancelKhmdhsFetch();
      setFormData((prev) => {
        const next = { ...prev, projectStatus: value };
        const wasContractStatus = statusRequiresKhmdhsAdam(prev.projectStatus);
        const isContractStatus = statusRequiresKhmdhsAdam(value);
        if (wasContractStatus && !isContractStatus) {
          next.khmdhsAdam = '';
          next.khmdhsContractSnapshot = null;
          next.khmdhsContractFetchedAt = '';
          if (isMultipleContractsForm(prev.implementationForm) && prev.contracts?.length) {
            next.contracts = prev.contracts.map((c) => ({
              ...c,
              khmdhsAdam: '',
              khmdhsContractSnapshot: null,
              khmdhsContractFetchedAt: '',
              khmdhsContractAmendments: [],
              date: '',
              amount: '',
            }));
          }
        }
        if (!statusRetainsKhmdhsNotice(value)) {
          Object.assign(next, {
            khmdhsNoticeAdam: '',
            khmdhsNoticeSnapshot: null,
            khmdhsNoticeFetchedAt: '',
            khmdhsAwardAdam: '',
            khmdhsAwardSnapshot: null,
            assignmentProcedure: '',
            contractProcessStartDate: '',
          });
        }
        if (!statusShowsAssignmentProcedure(value)) {
          next.assignmentProcedure = '';
          next.contractProcessStartDate = '';
        }
        return next;
      });
      setErrors((prev) => {
        const next = { ...prev };
        delete next.khmdhsAdam;
        delete next.khmdhsNoticeAdam;
        return next;
      });
      return;
    }

    // ΔΕΝ κάνουμε normalization κατά την πληκτρολόγηση για κανένα πεδίο
    // Το normalization γίνεται μόνο κατά την αποθήκευση (στο handleSave)
    // Αυτό επιτρέπει κανονική πληκτρολόγηση με spaces σε όλα τα πεδία

    setFormData((prev) => {
      let next = { ...prev, [field]: value };
      const hasKhmdhsContext = !!(
        sanitizeAdamInput(prev.khmdhsAdam)
        || sanitizeAdamInput(prev.khmdhsChainSeedAdam)
        || sanitizeAdamInput(prev.khmdhsRequestAdam)
      );
      if (isTrackedKhmdhsScalarField(field) && hasKhmdhsContext) {
        const edits = ensureKhmdhsUserEdits(prev);
        const existing = edits.fieldOverrides[field];
        next = recordKhmdhsFieldOverride(next, {
          fieldKey: field,
          label: KHMDHS_OVERRIDE_FIELD_LABELS[field],
          newValue: value,
          previousValue: prev[field],
          khmdhsBaseline: existing?.khmdhsValue ?? prev[field],
        });
      }
      return next;
    });

    // Πάντα ενημέρωση/καθαρισμός σφάλματος πεδίου — ώστε να μην «κολλάει» μήνυμα μετά από διόρθωση
    const fieldError =
      field === 'khmdhsAdam'
        ? getAdamFieldError(value, 'live')
        : field === 'khmdhsChainSeedAdam'
          ? getAdamFieldError(value, 'live')
        : field === 'khmdhsNoticeAdam'
          ? getNoticeAdamFieldError(value, 'live')
          : validateField(field, value);

    if (fieldError && !touched[field]) {
      setTouched((prev) => ({ ...prev, [field]: true }));
    }

    setErrors((prev) => {
      const next = { ...prev };
      if (fieldError) next[field] = fieldError;
      else delete next[field];
      return next;
    });
  };

  const handleFieldBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    const value = field === 'khmdhsAdam'
      ? sanitizeAdamInput(formData[field])
      : field === 'khmdhsNoticeAdam' || field === 'khmdhsChainSeedAdam'
        ? sanitizeAdamInput(formData[field])
        : formData[field];
    const fieldError =
      field === 'khmdhsAdam' || field === 'khmdhsChainSeedAdam'
        ? getAdamFieldError(value, 'strict')
        : field === 'khmdhsNoticeAdam'
          ? getNoticeAdamFieldError(value, 'strict')
          : validateField(field, value);

    setErrors((prev) => {
      const next = { ...prev };
      if (fieldError) next[field] = fieldError;
      else delete next[field];
      return next;
    });
  };

  const handleAmountBlur = (field) => {
    const currentValue = formData[field];
    const formattedValue = formatAmountOnBlur(currentValue);
    
    if (formattedValue !== currentValue) {
      setFormData(prev => ({
        ...prev,
        [field]: formattedValue
      }));
    }
  };

  const handleNoKACodeChange = (checked) => {
    setFormData(prev => ({
      ...prev,
      noKaCode: checked,
      kaCode: checked ? 'ΔΕΝ ΥΠΑΡΧΕΙ' : ''
    }));
  };

  const handleFundingSourceChange = (source) => {
    setFormData(prev => ({
      ...prev,
      fundingSource: source,
      fundingDetails: '' // Reset funding details when source changes
    }));
  };

  // ── Συγχρηματοδότηση: πολλαπλές πηγές χρηματοδότησης ──
  const isOwnResourcesDetail = (details) => String(details || '').toUpperCase().includes('ΙΔΙΟΙ ΠΟΡΟΙ');

  const parseCoFinancingAmount = (val) => {
    if (val == null || val === '') return 0;
    const cleaned = String(val).trim().replace(/[^\d,.-]/g, '');
    if (!cleaned) return 0;
    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');
    let normalized;
    if (hasComma && hasDot) normalized = cleaned.replace(/\./g, '').replace(',', '.');
    else if (hasComma) normalized = cleaned.replace(',', '.');
    else if (hasDot) {
      const dotCount = (cleaned.match(/\./g) || []).length;
      if (dotCount === 1) {
        const [, frac = ''] = cleaned.split('.');
        normalized = frac.length <= 2 ? cleaned : cleaned.replace(/\./g, '');
      } else normalized = cleaned.replace(/\./g, '');
    } else normalized = cleaned;
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? n : 0;
  };

  const formatCoFinancingTotal = (num) => {
    if (!Number.isFinite(num) || num === 0) return '';
    return num.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleCoFinancedToggle = (checked) => {
    setFormData(prev => {
      if (checked) {
        const existing = Array.isArray(prev.fundingSources) ? prev.fundingSources : [];
        const seeded = existing.length > 0 ? existing : [{
          source: prev.fundingSource || '',
          details: prev.fundingDetails || '',
          amount: prev.approvedAmount || '',
          ownResources: isOwnResourcesDetail(prev.fundingDetails),
        }];
        return { ...prev, coFinanced: true, fundingSources: seeded };
      }
      return { ...prev, coFinanced: false };
    });
  };

  const handleAddFundingSource = () => {
    setFormData(prev => ({
      ...prev,
      fundingSources: [...(prev.fundingSources || []), { source: '', details: '', amount: '', ownResources: false }],
    }));
  };

  const handleRemoveFundingSource = (index) => {
    setFormData(prev => ({
      ...prev,
      fundingSources: (prev.fundingSources || []).filter((_, i) => i !== index),
    }));
  };

  const handleFundingSourceRowChange = (index, field, value) => {
    setFormData(prev => {
      const rows = [...(prev.fundingSources || [])];
      if (!rows[index]) return prev;
      const row = { ...rows[index], [field]: value };
      if (field === 'source') row.details = '';
      if (field === 'details') row.ownResources = isOwnResourcesDetail(value);
      rows[index] = row;
      return { ...prev, fundingSources: rows };
    });
  };

  const handleFundingSourceRowAmountBlur = (index) => {
    setFormData(prev => {
      const rows = [...(prev.fundingSources || [])];
      if (!rows[index]) return prev;
      const formatted = formatAmountOnBlur(String(rows[index].amount || ''));
      if (formatted === rows[index].amount) return prev;
      rows[index] = { ...rows[index], amount: formatted };
      return { ...prev, fundingSources: rows };
    });
  };

  // Εγκεκριμένο ποσό = άθροισμα πηγών ΕΚΤΟΣ ιδίων πόρων· καθρέφτισμα 1ης πηγής στα μονά πεδία.
  useEffect(() => {
    if (!formData.coFinanced) return;
    const rows = Array.isArray(formData.fundingSources) ? formData.fundingSources : [];
    const countable = rows.filter((r) => !r.ownResources);
    const sum = countable.reduce((s, r) => s + parseCoFinancingAmount(r.amount), 0);
    const computedApproved = formatCoFinancingTotal(sum);
    const primary = countable.find((r) => r.source) || rows.find((r) => r.source) || null;
    const nextSource = primary?.source || '';
    const nextDetails = primary?.details || '';
    if (
      formData.approvedAmount !== computedApproved
      || formData.fundingSource !== nextSource
      || formData.fundingDetails !== nextDetails
    ) {
      setFormData((prev) => ({
        ...prev,
        approvedAmount: computedApproved,
        fundingSource: nextSource,
        fundingDetails: nextDetails,
      }));
    }
  }, [formData.coFinanced, formData.fundingSources]); // eslint-disable-line react-hooks/exhaustive-deps

  const addContract = () => {
    setFormData(prev => ({
      ...prev,
      contracts: [...prev.contracts, { date: '', amount: '', contractEndDate: '', apeAmount: '', comments: '', ...emptyKhmdhsOnContract() }]
    }));
  };

  const updateContract = (index, field, value) => {
    if (field === 'amount' || field === 'apeAmount') {
      value = formatAmount(value);
    }
    if (field === 'khmdhsAdam') {
      cancelKhmdhsFetch();
      value = sanitizeAdamInput(value);
    }

    setFormData((prev) => {
      let next = {
        ...prev,
        contracts: prev.contracts.map((contract, i) => (i === index ? { ...contract, [field]: value } : contract)),
      };
      if (
        (field === 'date' || field === 'amount' || field === 'contractEndDate')
        && prev.contracts[index]?.khmdhsAdam
      ) {
        const fieldKey = contractRowFieldKey(index, field);
        const edits = ensureKhmdhsUserEdits(prev);
        const existing = edits.fieldOverrides[fieldKey];
        const inferredBaseline = field === 'amount'
          ? (prev.contracts[index]?.khmdhsInferredAmount || '')
          : '';
        next = recordKhmdhsFieldOverride(next, {
          fieldKey,
          label: `${KHMDHS_CONTRACT_ROW_FIELD_LABELS[field]} (Σύμβαση ${index + 1})`,
          newValue: value,
          previousValue: prev.contracts[index][field],
          khmdhsBaseline: existing?.khmdhsValue
            ?? (inferredBaseline || prev.contracts[index][field]),
        });
      }
      return next;
    });

    if (field === 'khmdhsAdam') {
      const adamErr = getAdamFieldError(value, 'live');
      const errKey = `khmdhsAdam${index}`;
      setErrors((prev) => {
        const next = { ...prev };
        if (adamErr) next[errKey] = adamErr;
        else delete next[errKey];
        return next;
      });
    }
  };


  const removeContract = (index) => {
    cancelKhmdhsFetch();
    setFormData((prev) => purgeKhmdhsDataAfterContractRemoval({
      ...prev,
      contracts: prev.contracts.filter((_, i) => i !== index),
    }, index));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`khmdhsAdam${index}`];
      return next;
    });
  };

  // Functions for supplementary contracts
  const addSupplementaryContract = () => {
    setFormData(prev => ({
      ...prev,
      supplementaryContracts: [...prev.supplementaryContracts, { 
        date: '', 
        amount: '', 
        comments: '' 
      }]
    }));
  };

  const updateSupplementaryContract = (index, field, value) => {
    if (field === 'amount') {
      value = formatAmount(value);
    }

    setFormData((prev) => {
      const contract = prev.supplementaryContracts?.[index];
      if (!contract) return prev;

      let next = {
        ...prev,
        supplementaryContracts: prev.supplementaryContracts.map((c, i) =>
          (i === index ? { ...c, [field]: value } : c)
        ),
      };

      if ((field === 'date' || field === 'amount') && contract.khmdhsDerived) {
        const edits = ensureKhmdhsUserEdits(prev);
        const fieldKey = buildSupplementaryOverrideKey(field, contract);
        const existing = edits.fieldOverrides[fieldKey];
        const label = field === 'date' ? 'Ημερομηνία συμπληρωματικής' : 'Ποσό συμπληρωματικής';
        next = recordKhmdhsFieldOverride(next, {
          fieldKey,
          label,
          newValue: value,
          previousValue: contract[field],
          khmdhsBaseline: existing?.khmdhsValue ?? contract[field],
        });
      }

      if (next.khmdhsDataQualityReview && (field === 'date' || field === 'amount')) {
        next = {
          ...next,
          khmdhsDataQualityReview: reconcileReviewState(next.khmdhsDataQualityReview, next),
        };
      }

      return next;
    });
  };

  const handleRevertKhmdhsFieldOverride = (fieldKey) => {
    setFormData((prev) => revertKhmdhsFieldOverride(prev, fieldKey));
    showToast('Η τιμή επανήφθη στην αρχική από ΚΗΜΔΗΣ.', 'info');
  };

  const handleKhmdhsOverrideCommentChange = (fieldKey, comment) => {
    setFormData((prev) => updateKhmdhsFieldOverrideComment(prev, fieldKey, comment));
  };

  const removeSupplementaryContract = (index) => {
    const contract = formData.supplementaryContracts?.[index];
    if (!contract) return;

    const isDerived = !!contract.khmdhsDerived;
    const label = contract.khmdhsAdam
      ? `σύμβαση ${contract.khmdhsAdam}`
      : `συμπληρωματική ${index + 1}`;

    if (isDerived) {
      const ok = window.confirm(
        `Θα αφαιρεθεί η ${label} από το υποέργο και από το ιστορικό αλυσίδας ΚΗΜΔΗΣ.\n\nΗ υπόλοιπη αλυσίδα (αίτημα, δημοσίευση, κύρια σύμβαση) θα παραμείνει.\n\nΣυνέχεια;`
      );
      if (!ok) return;
    }

    setFormData((prev) => removeSupplementaryContractFromForm(prev, index));
    if (isDerived) {
      showToast('Η συμπληρωματική αφαιρέθηκε από την αλυσίδα.', 'info');
    }
  };

  const handleRemoveChainHistoryEntry = (adam, contractIndex = null) => {
    const located = contractIndex != null
      ? { entry: findChainEntry(formData, adam, contractIndex).entry, contractIndex }
      : findChainEntry(formData, adam);
    const entry = located.entry;
    if (!entry) return;
    if (entry.isRoot) {
      showToast('Η αρχική σύμβαση δεν αφαιρείται από εδώ — χρησιμοποιήστε «Ακύρωση ανάκτησης» για πλήρη καθαρισμό ΚΗΜΔΗΣ.', 'warning');
      return;
    }
    const ok = window.confirm(
      `Θα αφαιρεθεί η πράξη ${entry.adam} (${entry.label || entry.kind || 'σχετική'}).\n\nΣυνέχεια;`
    );
    if (!ok) return;
    setFormData((prev) => removeNonRootChainHistoryEntry(prev, adam, located.contractIndex));
    showToast('Η πράξη αφαιρέθηκε από την αλυσίδα.', 'info');
  };

  const handleFileSelect = async () => {
    try {
      const result = await safeFileDialog('open-file-dialog');
      if (!result.canceled && result.filePaths.length > 0) {
        const newFiles = result.filePaths.map(path => ({
          path,
          name: path.split('\\').pop().split('/').pop()
        }));
        
        // Απλό modal για επιλογή ομαδοποίησης
        const groupingChoice = await showSimpleGroupingModal(newFiles.length, formData.fileGroups || []);
        
        if (groupingChoice !== null && groupingChoice !== false) {
          if (groupingChoice.action === 'new') {
            // Δημιουργία νέας ομάδας
            setFormData(prev => ({
              ...prev,
              fileGroups: [...(prev.fileGroups || []), {
                id: uuidv4(),
                title: groupingChoice.title,
                files: newFiles
              }]
            }));
          } else if (groupingChoice.action === 'existing') {
            // Προσθήκη σε υπάρχουσα ομάδα
            setFormData(prev => ({
              ...prev,
              fileGroups: (prev.fileGroups || []).map(group => 
                group.id === groupingChoice.groupId
                  ? { ...group, files: [...group.files, ...newFiles] }
                  : group
              )
            }));
          }
        } else {
          // Κανονική προσθήκη αρχείων χωρίς ομαδοποίηση
          setSelectedFiles(prev => [...prev, ...newFiles]);
        }
      }
    } catch (error) {
      console.error('Error selecting files:', error);
    }
  };

  const handleFolderSelect = async () => {
    try {
      const pick = await ipcRenderer.invoke('select-folder-files-flat', {
        title: 'Επιλογή φακέλου για το υποέργο'
      });

      if (pick.canceled) {
        return;
      }
      if (!pick.success) {
        showToast(pick.error || 'Αποτυχία επιλογής φακέλου', 'error');
        return;
      }

      const newFiles = (pick.files || []).map((file) => ({
        path: file.filePath || file.path,
        name: file.fileName || file.name || (file.filePath || file.path || '').split(/[/\\]/).pop()
      })).filter((file) => file.path);

      if (newFiles.length === 0) {
        showToast('Ο φάκελος δεν περιέχει αρχεία', 'warning');
        return;
      }

      const folderTitle = String(pick.folderName || 'Φάκελος').trim() || 'Φάκελος';
      setFormData((prev) => ({
        ...prev,
        fileGroups: [...(prev.fileGroups || []), {
          id: uuidv4(),
          title: folderTitle,
          files: newFiles
        }]
      }));
      showToast(`Προστέθηκαν ${newFiles.length} αρχείο(α) από τον φάκελο «${folderTitle}».`, 'success');
    } catch (error) {
      console.error('Error selecting folder:', error);
      showToast('Σφάλμα κατά την επιλογή φακέλου: ' + error.message, 'error');
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };


  const removeFileGroup = (groupId) => {
    setFormData(prev => ({
      ...prev,
      fileGroups: prev.fileGroups.filter(group => group.id !== groupId)
    }));
  };

  const removeFileFromGroup = (groupId, fileIndex) => {
    setFormData(prev => ({
      ...prev,
      fileGroups: prev.fileGroups.map(group => 
        group.id === groupId 
          ? { ...group, files: group.files.filter((_, i) => i !== fileIndex) }
          : group
      ).filter(group => group.files.length > 0) // Αφαιρούμε ομάδες χωρίς αρχεία
    }));
  };

  // Απλό modal για ομαδοποίηση αρχείων
  const showSimpleGroupingModal = (fileCount, existingGroups = []) => {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      const modalContent = document.createElement('div');
      modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 2rem;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      `;

      // Δημιουργία επιλογών για υπάρχουσες ομάδες
      const existingGroupsOptions = existingGroups.length > 0 
        ? existingGroups.map(group => `<option value="${group.id}">${group.title}</option>`).join('')
        : '';

      modalContent.innerHTML = `
        <h3 style="margin: 0 0 1rem 0; color: #333; font-size: 1.3rem;">
          📁 Ομαδοποίηση Αρχείων
        </h3>
        <p style="margin: 0 0 1.5rem 0; color: #666; font-size: 1rem;">
          Επιλέξατε ${fileCount} αρχείο(α). Πώς θέλετε να τα οργανώσετε;
        </p>
        <div style="display: grid; gap: 1rem; margin-bottom: 1.5rem;">
          <button id="newGroupBtn" style="
            padding: 0.8rem 1.5rem;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: 500;
            text-align: left;
          ">🆕 Νέα Ομάδα</button>
          ${existingGroups.length > 0 ? `
          <button id="existingGroupBtn" style="
            padding: 0.8rem 1.5rem;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: 500;
            text-align: left;
          ">📂 Προσθήκη σε Υπάρχουσα Ομάδα</button>
          ` : ''}
          <button id="noGroupBtn" style="
            padding: 0.8rem 1.5rem;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: 500;
            text-align: left;
          ">📄 Χωρίς Ομαδοποίηση</button>
        </div>
        <div id="newGroupSection" style="display: none;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">
            Τίτλος νέας ομάδας:
          </label>
          <input 
            type="text" 
            id="newGroupTitle" 
            placeholder="π.χ. Αρχεία Σύμβασης, Τεχνικά Σχέδια"
            style="
              width: 100%;
              padding: 0.8rem;
              border: 2px solid #ddd;
              border-radius: 6px;
              font-size: 1rem;
              margin-bottom: 1rem;
            "
          />
          <div style="display: flex; gap: 1rem;">
            <button id="confirmNewBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #28a745;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">Επιβεβαίωση</button>
            <button id="cancelNewBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #dc3545;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">Ακύρωση</button>
          </div>
        </div>
        <div id="existingGroupSection" style="display: none;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">
            Επιλέξτε υπάρχουσα ομάδα:
          </label>
          <select 
            id="existingGroupSelect" 
            style="
              width: 100%;
              padding: 0.8rem;
              border: 2px solid #ddd;
              border-radius: 6px;
              font-size: 1rem;
              margin-bottom: 1rem;
            "
          >
            <option value="">-- Επιλέξτε ομάδα --</option>
            ${existingGroupsOptions}
          </select>
          <div style="display: flex; gap: 1rem;">
            <button id="confirmExistingBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #007bff;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">Επιβεβαίωση</button>
            <button id="cancelExistingBtn" style="
              flex: 1;
              padding: 0.8rem 1.5rem;
              background: #dc3545;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
              font-weight: 500;
            ">Ακύρωση</button>
          </div>
        </div>
      `;

      modal.appendChild(modalContent);
      document.body.appendChild(modal);

      // Event listeners για τα κουμπιά
      const newGroupBtn = modalContent.querySelector('#newGroupBtn');
      const existingGroupBtn = modalContent.querySelector('#existingGroupBtn');
      const noGroupBtn = modalContent.querySelector('#noGroupBtn');
      
      const newGroupSection = modalContent.querySelector('#newGroupSection');
      const existingGroupSection = modalContent.querySelector('#existingGroupSection');
      
      const newGroupTitle = modalContent.querySelector('#newGroupTitle');
      const existingGroupSelect = modalContent.querySelector('#existingGroupSelect');
      
      const confirmNewBtn = modalContent.querySelector('#confirmNewBtn');
      const cancelNewBtn = modalContent.querySelector('#cancelNewBtn');
      const confirmExistingBtn = modalContent.querySelector('#confirmExistingBtn');
      const cancelExistingBtn = modalContent.querySelector('#cancelExistingBtn');

      // Νέα ομάδα
      newGroupBtn.addEventListener('click', () => {
        newGroupBtn.style.display = 'none';
        if (existingGroupBtn) existingGroupBtn.style.display = 'none';
        noGroupBtn.style.display = 'none';
        newGroupSection.style.display = 'block';
        newGroupTitle.focus();
      });

      // Υπάρχουσα ομάδα
      if (existingGroupBtn) {
        existingGroupBtn.addEventListener('click', () => {
          newGroupBtn.style.display = 'none';
          existingGroupBtn.style.display = 'none';
          noGroupBtn.style.display = 'none';
          existingGroupSection.style.display = 'block';
        });
      }

      // Χωρίς ομαδοποίηση
      noGroupBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(false);
      });

      // Επιβεβαίωση νέας ομάδας
      confirmNewBtn.addEventListener('click', () => {
        const title = newGroupTitle.value.trim();
        if (title) {
          document.body.removeChild(modal);
          resolve({ action: 'new', title });
        } else {
          showToast('Παρακαλώ εισάγετε τίτλο ομάδας', 'warning');
        }
      });

      // Ακύρωση νέας ομάδας
      cancelNewBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(false);
      });

      let handleKeyDown;
      const cleanup = (result) => {
        if (modal.parentNode === document.body) {
          document.body.removeChild(modal);
        }
        if (handleKeyDown) {
          document.removeEventListener('keydown', handleKeyDown);
        }
        resolve(result);
      };

      // Επιβεβαίωση υπάρχουσας ομάδας
      confirmExistingBtn.addEventListener('click', () => {
        const selectedGroupId = existingGroupSelect.value;
        if (selectedGroupId) {
          cleanup({ action: 'existing', groupId: selectedGroupId });
        } else {
          showToast('Παρακαλώ επιλέξτε ομάδα', 'warning');
        }
      });

      // Ακύρωση υπάρχουσας ομάδας
      cancelExistingBtn.addEventListener('click', () => {
        cleanup(false);
      });

      // Κλείσιμο με ESC
      handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          cleanup(false);
        }
      };
      document.addEventListener('keydown', handleKeyDown);
    });
  };

  // Συνάρτηση για normalization κειμένου
  const normalizeText = (text) => {
    if (!text) return '';
    return text
      .replace(/\\n/g, ' ')           // Αντιγράφει \n literals
      .replace(/\n/g, ' ')            // Αντιγράφει πραγματικά newlines
      .replace(/\r/g, ' ')            // Αντιγράφει carriage returns
      .replace(/\t/g, ' ')            // Αντιγράφει tabs
      .replace(/\s+/g, ' ')           // Αντικαθιστά όλα τα whitespace (συμπεριλαμβανομένων διπλών κενών) με ένα κενό
      .replace(/\u00A0/g, ' ')        // Αντιγράφει non-breaking spaces
      .replace(/[\u2000-\u200B]/g, ' ') // Αντιγράφει διάφορα είδη spaces (Unicode)
      .replace(/\u2028/g, ' ')        // Αντιγράφει line separator
      .replace(/\u2029/g, ' ')        // Αντιγράφει paragraph separator
      .trim();
  };


  const collectExistingKhmdhsChainAdams = (form, contractIndex = null) => {
    return collectAllChainAdams(form, contractIndex);
  };

  const applySupplementaryContractResult = (prev, res, { contractIndex = null } = {}) => {
    if (!res?.success || !res.chainHistoryEntry) return { form: prev, protectedCount: 0 };
    const entry = res.chainHistoryEntry;
    const multi = isMultipleContractsForm(prev.implementationForm);

    if (!multi) {
      let history = [...(prev.khmdhsContractChainHistory || [])];
      if (!history.some((h) => h.adam === entry.adam)) {
        history = [...history, { ...entry, order: history.length }];
      }
      let next = {
        ...prev,
        khmdhsContractChainHistory: history,
      };
      next.khmdhsDataQualityReview = appendChainEntryToDataQualityReview(
        prev.khmdhsDataQualityReview,
        history,
        entry
      );
      next.khmdhsDataQualityReview = reconcileReviewState(
        next.khmdhsDataQualityReview,
        next
      );
      next = applyChainCharacterizationToForm(next, next.khmdhsDataQualityReview);
      next = mergeKhmdhsSupplementaryIntoForm(next);
      next.khmdhsDataQualityReview = reconcileReviewState(
        next.khmdhsDataQualityReview,
        next
      );
      const { form, protectedCount } = applyUserEditsAfterKhmdhsFetch(prev, next);
      return { form, protectedCount };
    }

    const idx = resolveSupplementaryTargetContractIndex(prev, contractIndex);
    const contracts = [...(prev.contracts || [])];
    if (idx == null || idx >= contracts.length) {
      return { form: prev, protectedCount: 0 };
    }
    let history = [...(contracts[idx]?.khmdhsContractChainHistory || [])];
    if (!history.some((h) => h.adam === entry.adam)) {
      history = [...history, { ...entry, order: history.length }];
    }
    contracts[idx] = {
      ...contracts[idx],
      khmdhsContractChainHistory: history,
      khmdhsContractAmendments: [
        ...(contracts[idx]?.khmdhsContractAmendments || []),
        ...(entry.kind && !entry.isRoot ? [{ adam: entry.adam, kind: entry.kind, label: entry.label }] : []),
      ].filter((a, i, arr) => arr.findIndex((x) => x.adam === a.adam) === i),
    };
    let next = { ...prev, contracts };
    next.khmdhsDataQualityReview = appendChainEntryToDataQualityReview(
      prev.khmdhsDataQualityReview,
      history,
      entry,
      { contractIndex: idx }
    );
    next.khmdhsDataQualityReview = reconcileReviewState(
      next.khmdhsDataQualityReview,
      next
    );
    next = applyChainCharacterizationToForm(next, next.khmdhsDataQualityReview);
    next = mergeKhmdhsSupplementaryIntoForm(next);
    next.khmdhsDataQualityReview = reconcileReviewState(
      next.khmdhsDataQualityReview,
      next
    );
    const { form, protectedCount } = applyUserEditsAfterKhmdhsFetch(prev, next);
    return { form, protectedCount };
  };

  const runKhmdhsChainFetch = async ({
    adam,
    contractIndex = null,
    afterLegacyUpgrade = false,
    suppressSituationModal = false,
    forceChainFetch = false,
    suppressBranchPicker = false,
    skipDuplicateCheck = false,
    followAllBranches = false,
    branchAnchor = null,
    userSelectedBranch = false,
    preloadedChainRes = null,
    symvChainPlan = null,
  } = {}) => {
    const seed = sanitizeAdamInput(adam);
    if (!seed) return;

    const formatErr = getAdamFieldError(seed, 'strict');
    if (formatErr) {
      const errKey = contractIndex != null ? `khmdhsAdam${contractIndex}` : 'khmdhsChainSeedAdam';
      setErrors((prev) => ({ ...prev, [errKey]: formatErr }));
      setTouched((prev) => ({ ...prev, [errKey]: true }));
      return;
    }

    // Χρησιμοποιούμε το ref για να διαβάσουμε το πιο πρόσφατο formData
    // και να αποφύγουμε stale closures σε rapid/auto-fetches
    const currentFormData = formDataRef.current;
    const multi = isMultipleContractsForm(currentFormData.implementationForm);
    // Duplicate check μόνο για SYMV ADAMs — REQ/PROC/AWRD είναι κοινοί
    // κωδικοί αλυσίδας και δεν αποθηκεύονται ανά γραμμή σύμβασης.
    if (multi && contractIndex != null && parseKhmdhsAdamType(seed) === 'SYMV') {
      const dupAt = findDuplicateContractAdam(currentFormData.contracts, seed, contractIndex);
      if (dupAt >= 0) {
        showToast(`Ο ΑΔΑΜ χρησιμοποιείται ήδη στη Σύμβαση ${dupAt + 1}.`, 'warning');
        return;
      }
    }

    if (
      !forceChainFetch
      && shouldRouteAdamAsSupplementaryAdd(currentFormData, seed, { contractIndex })
    ) {
      return runKhmdhsSupplementaryFetch({ adam: seed, contractIndex: contractIndex ?? null });
    }

    const fetchTarget = contractIndex != null ? contractIndex : 'single';
    const genKey = String(fetchTarget);
    if (typeof khmdhsChainFetchGenRef.current !== 'object' || khmdhsChainFetchGenRef.current === null) {
      khmdhsChainFetchGenRef.current = {};
    }
    khmdhsChainFetchGenRef.current[genKey] = (khmdhsChainFetchGenRef.current[genKey] || 0) + 1;
    const gen = khmdhsChainFetchGenRef.current[genKey];
    setKhmdhsChainFetchTarget(fetchTarget);
    try {
      // Περνάμε το ΑΠΕ (αν υπάρχει) ώστε το DQR να χρησιμοποιεί το αναθεωρημένο ποσό
      const fetchApeAmount = resolveStoredApeAmount(
        currentFormData,
        contractIndex != null && contractIndex >= 0 ? contractIndex : null
      );
      let res;
      if (preloadedChainRes?.success) {
        res = preloadedChainRes;
      } else {
        const fetchPromise = ipcRenderer.invoke('khmdhs-resolve-adam-chain', { adam: seed, apeAmount: fetchApeAmount || null });
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Η ανάκτηση από το ΚΗΜΔΗΣ διήρκεσε πολύ. Δοκιμάστε ξανά.')), 120000);
        });
        res = await Promise.race([fetchPromise, timeoutPromise]);
      }
      if (gen !== khmdhsChainFetchGenRef.current[genKey]) return;

      const situationReport = refineSituationReportForBranchSelection(
        res?.situationReport,
        { userSelectedBranch }
      );

      if (res?.success) {
        khmdhsLastChainResRef.current = res;
        const fetchFormData = formDataRef.current;
        const fetchMulti = isMultipleContractsForm(fetchFormData.implementationForm);

        if (
          !suppressBranchPicker
          && !followAllBranches
          && contractIndex == null
          && !fetchMulti
          && !shouldOfferSymvChainPlanner(res)
        ) {
          const candidates = buildBranchCandidatesFromChainRes(res);
          if (needsBranchPicker(candidates)) {
            const suggested = suggestBestBranchCandidate(
              candidates,
              fetchFormData.subprojectTitle,
              res,
              seed
            );
            setKhmdhsChainFetchTarget(null);
            setBranchPickerState({
              candidates,
              suggestedAdam: suggested?.adam || '',
              subprojectTitle: fetchFormData.subprojectTitle || '',
              seedChainRes: res,
              allowsAllBranches: branchPickerAllowsAllBranches(candidates, res),
              fetchOptions: {
                seedAdam: seed,
                contractIndex,
                suppressSituationModal,
                forceChainFetch,
              },
            });
            return;
          }
        }

        const effectiveUserSelectedBranch = followAllBranches ? false : userSelectedBranch;

        if (
          !symvChainPlan
          && contractIndex == null
          && shouldOfferSymvChainPlanner(res)
        ) {
          setKhmdhsChainFetchTarget(null);
          setSymvChainPlannerState({
            open: true,
            seedChainRes: res,
            seedAdam: seed,
            subprojectTitle: fetchFormData.subprojectTitle || '',
            draftPlan: null,
            existingPlan: (
              fetchFormData.khmdhsSymvChainPlan
              && symvPlanMatchesChain(fetchFormData.khmdhsSymvChainPlan, res)
              && getStoredChainSeedAdam(fetchFormData, fetchFormData)
            )
              ? fetchFormData.khmdhsSymvChainPlan
              : null,
            fetchOptions: {
              seedAdam: seed,
              contractIndex,
              suppressSituationModal,
              forceChainFetch,
              branchAnchor: branchAnchor || null,
              userSelectedBranch,
            },
          });
          return;
        }

        const finishApply = ({ skipSituationModal = false, skipSuccessToast = false } = {}) => {
        const usedSymvPlan = !!(symvChainPlan?.items?.length);
        let applyWarnings = [];
        let pendingApeConflict = null;
        let statusAutoUpdated = null;
        let protectedFieldCount = 0;
        let implementationFormAutoUpdated = null;
        let capturedMergedDQR = null;
        let capturedFormAfterApply = null;
        let statusBeforeKhmdhsApply = null;
        let situationModalShown = false;
        const resolvedBranch = followAllBranches
          ? null
          : (branchAnchor || (
            usedSymvPlan
              ? {
                adam: inferActRootReqAdam(res, seed) || normalizeKhmdhsAdam(seed),
                type: 'REQ',
              }
              : contractIndex == null && !fetchMulti
                ? suggestBestBranchCandidate(
                  buildBranchCandidatesFromChainRes(res),
                  fetchFormData.subprojectTitle,
                  res,
                  seed
                )
                : null
          ));
        setFormData((prev) => {
          statusBeforeKhmdhsApply = prev.projectStatus;
          const result = applyAdamChainResult(prev, res, {
            seedAdam: seed,
            contractIndex: contractIndex != null ? contractIndex : -1,
            branchAnchor: resolvedBranch,
            suppressSituationModal,
            userSelectedBranch: effectiveUserSelectedBranch,
            symvChainPlan: usedSymvPlan ? symvChainPlan : null,
          });
          applyWarnings = result.warnings || [];
          pendingApeConflict = result.apeConflict || null;
          statusAutoUpdated = result.statusAutoUpdated || null;
          protectedFieldCount = result.protectedCount || 0;
          implementationFormAutoUpdated = result.implementationFormAutoUpdated || null;
          capturedMergedDQR = result.form.khmdhsDataQualityReview || null;
          capturedFormAfterApply = result.form;
          return result.form;
        });
        if (usedSymvPlan) {
          showToast(
            'Η κατανομή SYMV εφαρμόστηκε. Ελέγξτε τα αποτελέσματα και αποθηκεύστε το υποέργο.',
            'success'
          );
        }
        if (implementationFormAutoUpdated) {
          setManualPhaseBaseline((baseline) => {
            if (!baseline) return baseline;
            try {
              const snap = JSON.parse(baseline);
              snap.implementationForm = implementationFormAutoUpdated;
              return JSON.stringify(snap);
            } catch {
              return baseline;
            }
          });
          showToast(
            `Η μορφή υλοποίησης ορίστηκε σε «${implementationFormAutoUpdated}»${usedSymvPlan ? ' από την κατανομή SYMV που ορίσατε' : ' από τα στοιχεία ΚΗΜΔΗΣ'}.`,
            'info'
          );
        }

        if (applyWarnings.includes('symvPlannerRequired')) {
          showToast(
            'Η αλυσίδα έχει πολλαπλά έγγραφα SYMV — ορίστε την κατανομή τους πριν την εφαρμογή.',
            'warning'
          );
        }
        if (statusAutoUpdated) {
          setManualPhaseBaseline((baseline) => {
            if (!baseline) return baseline;
            try {
              const snap = JSON.parse(baseline);
              snap.projectStatus = statusAutoUpdated;
              return JSON.stringify(snap);
            } catch {
              return baseline;
            }
          });
          showToast(
            `Η κατάσταση ενημερώθηκε αυτόματα σε «${statusAutoUpdated}» — εντοπίστηκε σύμβαση στην αλυσίδα ΚΗΜΔΗΣ.`,
            'info'
          );
        }
        if (pendingApeConflict) {
          setApeConflictModal(pendingApeConflict);
        }
        const pendingReviewCountEarly = getUnresolvedReviewItems(
          capturedMergedDQR || capturedFormAfterApply?.khmdhsDataQualityReview,
          capturedFormAfterApply || formDataRef.current
        ).length;
        if (!applyWarnings.includes('symvPlannerRequired') && capturedFormAfterApply) {
          queueContractExpiryPrompt(capturedFormAfterApply, {
            statusBeforeKhmdhsRefresh: statusBeforeKhmdhsApply,
          });
        }
        if (!skipSituationModal && !suppressSituationModal && !usedSymvPlan && shouldShowKhmdhsSituationModal(situationReport)) {
          const acknowledgedIds = new Set(formData.khmdhsAcknowledgedSituationIds || []);
          // Ελέγχω αν το merged DQR (με τις παλιές επιλύσεις) έχει εκκρεμή items
          const dqrItems = capturedMergedDQR?.items || [];
          const dqrResolutions = capturedMergedDQR?.resolutions || {};
          const dqrAcknowledged = new Set(capturedMergedDQR?.acknowledgedFieldIds || []);
          const hasUnresolvedDQR = dqrItems.some((item) => {
            if (item.status !== 'needs_review') return false;
            const key = `${item.fieldId}::${item.contractIndex != null ? item.contractIndex : 'shared'}`;
            return !dqrResolutions[key] && !dqrAcknowledged.has(key);
          });
          const filteredSituations = (situationReport?.situations || []).filter((sit) => {
            if (sit.severity === 'error') return true;
            if (acknowledgedIds.has(sit.id)) return false;
            if (usedSymvPlan && sit.id === KHMDHS_SITUATION_ID_PARALLEL_CONTRACTS) return false;
            // Αν το DQR είναι πλήρως επιλυμένο, αποκρύπτω ειδοποιήσεις που αφορούν ελλιπή πεδία
            if (!hasUnresolvedDQR && (sit.id === 'incomplete_fields' || sit.id === 'contract_amount_fallback')) return false;
            return true;
          });
          const filteredReport = { ...situationReport, situations: filteredSituations };
          if (shouldShowKhmdhsSituationModal(filteredReport)) {
            situationModalShown = true;
            setKhmdhsSituationModal({
              report: filteredReport,
              contractIndex: contractIndex != null ? contractIndex : null,
              suggestedRetryAdam: null,
            });
          }
        }
        const reviewFormSnapshot = capturedFormAfterApply || formDataRef.current;
        const pendingReviewCount = getUnresolvedReviewItems(
          capturedMergedDQR || reviewFormSnapshot?.khmdhsDataQualityReview,
          reviewFormSnapshot
        ).length;
        if (pendingReviewCount > 0 && !suppressSituationModal) {
          if (situationModalShown) {
            khmdhsPendingDataReviewRef.current = true;
          } else {
            setDataReviewModalOpen(true);
          }
        }
        if (applyWarnings.includes('noticeConflict')) {
          showToast(
            'Προειδοποίηση: ο ΑΔΑΜ ανήκει σε διαφορετική δημοσίευση. Τα κοινά στοιχεία δημοσίευσης δεν άλλαξαν.',
            'warning'
          );
        }
        if (applyWarnings.includes('noContractInChain')) {
          showToast(
            'Βρέθηκαν κοινά στοιχεία (π.χ. δημοσίευση)· δώστε ΑΔΑΜ σύμβασης (SYMV) για ημερομηνία/ποσό αυτής της γραμμής.',
            'warning'
          );
        }
        setErrors((prev) => {
          const next = { ...prev };
          delete next.khmdhsChainSeedAdam;
          delete next.khmdhsSharedChain;
          if (contractIndex != null) delete next[`khmdhsAdam${contractIndex}`];
          delete next.khmdhsAdam;
          delete next.khmdhsNoticeAdam;
          return next;
        });
        if (contractIndex != null) {
          setAdamInputDraft((prev) => ({
            ...prev,
            contracts: { ...prev.contracts, [contractIndex]: '' },
          }));
        } else {
          setAdamInputDraft((prev) => ({ ...prev, chain: '' }));
        }
        const warn = res.warnings?.length ? ` (${res.warnings[0]})` : '';
        const blocksSuccessToast = skipSuccessToast
          || (!usedSymvPlan && shouldShowKhmdhsSituationModal(situationReport));
        if (!blocksSuccessToast && !usedSymvPlan) {
          showToast(`Ανακτήθηκαν από ΚΗΜΔΗΣ: ${res.summary || 'στοιχεία αλυσίδας'}${warn}`, 'success');
        }
        if (protectedFieldCount > 0) {
          showToast(
            `${protectedFieldCount} πεδί${protectedFieldCount === 1 ? 'ο' : 'α'} δεν άλλαξ${protectedFieldCount === 1 ? 'ε' : 'αν'} γιατί τα έχετε τροποποιήσει χειροκίνητα.`,
            'info'
          );
        }
        if (afterLegacyUpgrade) {
          showToast('Αποθηκεύστε το υποέργο για να οριστικοποιηθεί η αναβάθμιση.', 'info');
        }
        if (!suppressSituationModal) {
          const chainFetchedAt = new Date().toISOString();
          khmdhsDeferRegistryRef.current = { chainFetchedAt, chainRes: res };
          const needsDataReview = getUnresolvedReviewItems(
            capturedMergedDQR || reviewFormSnapshot?.khmdhsDataQualityReview,
            reviewFormSnapshot
          ).length > 0;
          if (!needsDataReview && !situationModalShown) {
            window.setTimeout(() => {
              const project = formDataRef.current;
              const chainResForRegistry = khmdhsLastChainResRef.current;
              if (!shouldOfferRegistryAfterReview(project, {
                dismissed: project?.khmdhsDocumentRegistryDismissed,
                chainFetchedAt,
                chainRes: chainResForRegistry,
              })) {
                khmdhsDeferRegistryRef.current = null;
                return;
              }
              setKhmdhsRegistryModal(
                buildRegistryModalPayloadAfterReview(project, chainFetchedAt, chainResForRegistry)
              );
              khmdhsDeferRegistryRef.current = null;
            }, 0);
          }
        }
        };

        const titleWarn = checkTitleMismatchWarning(fetchFormData.subprojectTitle, res);
        if (titleWarn) showToast(titleWarn.message, 'warning');

        if (!skipDuplicateCheck && contractIndex == null) {
          const conflicts = checkKhmdhsDuplicateConflicts(fetchFormData, allProjects, res);
          if (conflicts.length) {
            setKhmdhsChainFetchTarget(null);
            setDuplicateAnchorModal({
              conflict: conflicts[0],
              onConfirm: () => {
                setDuplicateAnchorModal(null);
                const conflict = conflicts[0];
                setFormData((prev) => acknowledgeKhmdhsDuplicateConflict(prev, conflict));
                runKhmdhsChainFetch({
                  adam: seed,
                  contractIndex,
                  afterLegacyUpgrade,
                  suppressSituationModal,
                  forceChainFetch,
                  suppressBranchPicker: true,
                  skipDuplicateCheck: true,
                  branchAnchor,
                  userSelectedBranch,
                  followAllBranches,
                  preloadedChainRes: res,
                  symvChainPlan,
                });
              },
            });
            return;
          }
        }

        if (
          !suppressSituationModal
          && shouldDeferKhmdhsApplyForSituation(situationReport)
          && shouldShowKhmdhsSituationModal(situationReport)
        ) {
          const acknowledgedIds = new Set(formData.khmdhsAcknowledgedSituationIds || []);
          const filteredSituations = (situationReport?.situations || []).filter((sit) => {
            if (sit.severity === 'error') return true;
            if (acknowledgedIds.has(sit.id)) return false;
            return true;
          });
          const filteredReport = { ...situationReport, situations: filteredSituations };
          if (shouldShowKhmdhsSituationModal(filteredReport)) {
            khmdhsPendingApplyRef.current = () => finishApply({
              skipSituationModal: true,
              skipSuccessToast: true,
            });
            khmdhsDeferRegistryRef.current = null;
            khmdhsPendingDataReviewRef.current = false;
            setKhmdhsSituationModal({
              report: filteredReport,
              contractIndex: contractIndex != null ? contractIndex : null,
              suggestedRetryAdam: null,
              deferApply: true,
            });
            return;
          }
        }

        finishApply();
      } else {
        if (shouldShowKhmdhsSituationModal(situationReport)) {
          const acknowledgedIds2 = new Set(formData.khmdhsAcknowledgedSituationIds || []);
          const filteredSit2 = (situationReport?.situations || []).filter(
            (sit) => sit.severity === 'error' || !acknowledgedIds2.has(sit.id)
          );
          const filteredReport2 = { ...situationReport, situations: filteredSit2 };
          if (shouldShowKhmdhsSituationModal(filteredReport2)) {
            setKhmdhsSituationModal({
              report: filteredReport2,
              contractIndex: contractIndex != null ? contractIndex : null,
              suggestedRetryAdam: null,
            });
          }
        }
        showToast(res?.error || 'Η ανάκτηση από το ΚΗΜΔΗΣ απέτυχε.', 'error');

      }
    } catch (e) {
      if (gen === khmdhsChainFetchGenRef.current[genKey]) {
        showToast(e?.message || 'Σφάλμα κατά την επικοινωνία με το ΚΗΜΔΗΣ.', 'error');
      }
    } finally {
      if (gen === khmdhsChainFetchGenRef.current[genKey]) {
        setKhmdhsChainFetchTarget(null);
      }
    }
  };

  const runKhmdhsSupplementaryFetch = async ({
    adam,
    contractIndex = null,
    skipCrossActConfirm = false,
  } = {}) => {
    const seed = sanitizeAdamInput(adam);
    if (!seed) return;

    const formatErr = getAdamFieldError(seed, 'strict');
    if (formatErr) {
      setErrors((prev) => ({ ...prev, khmdhsChainSeedAdam: formatErr }));
      return;
    }
    if (parseKhmdhsAdamType(seed) !== 'SYMV') {
      showToast('Ο κωδικός συμπληρωματικής πρέπει να είναι σύμβαση (SYMV).', 'warning');
      return;
    }

    const multi = isMultipleContractsForm(formDataRef.current.implementationForm);
    const targetIdx = multi ? resolveSupplementaryTargetContractIndex(formDataRef.current, contractIndex) : null;
    const primaryAdam = multi
      ? sanitizeAdamInput(formDataRef.current.contracts?.[targetIdx]?.khmdhsAdam)
      : sanitizeAdamInput(formDataRef.current.khmdhsAdam);

    if (!skipCrossActConfirm) {
      try {
        const preview = await ipcRenderer.invoke('khmdhs-fetch-contract-by-adam', { adam: seed });
        if (preview?.success && preview.snapshot) {
          const assess = assessSupplementaryCrossAct(
            preview.snapshot,
            formDataRef.current,
            multi ? targetIdx : null
          );
          if (assess.needsConfirmation) {
            setSupplementaryConfirm({
              adam: seed,
              contractIndex: multi ? targetIdx : null,
              message: assess.message,
            });
            return;
          }
        }
      } catch {
        // Συνεχίζουμε — ο κύριος handler θα επιστρέψει σφάλμα αν χρειαστεί
      }
    }

    const suppGenKey = multi && contractIndex != null ? `supp_${contractIndex}` : 'supplementary';
    if (typeof khmdhsChainFetchGenRef.current !== 'object' || khmdhsChainFetchGenRef.current === null) {
      khmdhsChainFetchGenRef.current = {};
    }
    khmdhsChainFetchGenRef.current[suppGenKey] = (khmdhsChainFetchGenRef.current[suppGenKey] || 0) + 1;
    const gen = khmdhsChainFetchGenRef.current[suppGenKey];
    setKhmdhsChainFetchTarget(multi && contractIndex != null ? contractIndex : 'supplementary');
    try {
      const liveForm = formDataRef.current;
      const existingChainAdams = collectExistingKhmdhsChainAdams(
        liveForm,
        multi ? targetIdx : null
      );
      const fetchPromise = ipcRenderer.invoke('khmdhs-fetch-supplementary-contract', {
        adam: seed,
        primaryContractAdam: primaryAdam,
        existingChainAdams,
        amountContext: buildSupplementaryAmountContextFromForm(liveForm, targetIdx),
      });
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Η ανάκτηση από το ΚΗΜΔΗΣ διήρκεσε πολύ. Δοκιμάστε ξανά.')), 60000);
      });
      const res = await Promise.race([fetchPromise, timeoutPromise]);
      if (gen !== khmdhsChainFetchGenRef.current[suppGenKey]) return;

      if (res?.success) {
        let protectedFieldCount = 0;
        setFormData((prev) => {
          const result = applySupplementaryContractResult(prev, res, { contractIndex: targetIdx });
          protectedFieldCount = result.protectedCount || 0;
          return result.form;
        });
        setAdamInputDraft((prev) => ({ ...prev, chain: '' }));
        if (res.dataQualityReport?.hasActionRequired
          || (res.chainHistoryEntry && res.chainHistoryEntry.needsReview)) {
          setDataReviewModalOpen(true);
        }
        showToast('Η συμπληρωματική σύμβαση προστέθηκε στην αλυσίδα — τα υπόλοιπα στοιχεία ΚΗΜΔΗΣ παρέμειναν.', 'success');
        if (protectedFieldCount > 0) {
          showToast(
            `${protectedFieldCount} πεδί${protectedFieldCount === 1 ? 'ο' : 'α'} δεν άλλαξ${protectedFieldCount === 1 ? 'ε' : 'αν'} γιατί τα έχετε τροποποιήσει χειροκίνητα.`,
            'info'
          );
        }
      } else {
        showToast(res?.error || 'Δεν ήταν δυνατή η ανάκτηση της συμπληρωματικής σύμβασης.', 'error');
      }
    } catch (e) {
      if (gen === khmdhsChainFetchGenRef.current[suppGenKey]) {
        showToast(e?.message || 'Σφάλμα ανάκτησης συμπληρωματικής από ΚΗΜΔΗΣ.', 'error');
      }
    } finally {
      if (gen === khmdhsChainFetchGenRef.current[suppGenKey]) {
        setKhmdhsChainFetchTarget(null);
      }
    }
  };

  const handleKhmdhsChainFetch = () => {
    // Χωρίς contractIndex — το runKhmdhsChainFetch χειρίζεται τόσο single
    // όσο και multi-contract mode. Σε multi-contract, το auto-detect
    // παράλληλων συμβάσεων ενεργοποιείται αυτόματα.
    runKhmdhsChainFetch({ adam: adamInputDraft.chain });
  };

  const handleKhmdhsContractChainFetch = (contractIndex) => {
    runKhmdhsChainFetch({
      adam: adamInputDraft.contracts[contractIndex] || '',
      contractIndex,
    });
  };

  const handleLegacyKhmdhsUpgrade = () => {
    const seed = getKhmdhsUpgradeSeedAdam(formData);
    if (!seed) {
      showToast('Δεν βρέθηκε καταχωρημένος ΑΔΑΜ για αναβάθμιση.', 'warning');
      return;
    }
    if (isMultipleContractsForm(formData.implementationForm)) {
      const idx = getKhmdhsUpgradeContractIndex(formData);
      const rowAdam = idx >= 0 ? formData.contracts?.[idx]?.khmdhsAdam : '';
      runKhmdhsChainFetch({
        adam: rowAdam || seed,
        contractIndex: idx >= 0 ? idx : null,
        afterLegacyUpgrade: true,
      });
      return;
    }
    setFormData((prev) => ({ ...prev, khmdhsChainSeedAdam: seed }));
    setAdamInputDraft((prev) => ({ ...prev, chain: seed }));
    runKhmdhsChainFetch({ adam: seed, afterLegacyUpgrade: true });
  };

  const khmdhsHasChainData = useMemo(
    () => projectHasResolvedChainData(formData),
    [
      formData.implementationForm,
      formData.contracts,
      formData.khmdhsNoticeAdam,
      formData.khmdhsNoticeSnapshot,
      formData.khmdhsAdam,
      formData.khmdhsContractSnapshot
    ]
  );

  const noticeHasFetchedData = useMemo(
    () => !!(
      sanitizeAdamInput(formData.khmdhsNoticeAdam)
      && pickKhmdhsNoticeSnapshot(formData.khmdhsNoticeSnapshot)
    ),
    [formData.khmdhsNoticeAdam, formData.khmdhsNoticeSnapshot]
  );

  const noticeProcedureAutoFilled = useMemo(
    () => noticeHasFetchedData && !!resolveAssignmentProcedureFromNotice(formData.khmdhsNoticeSnapshot),
    [noticeHasFetchedData, formData.khmdhsNoticeSnapshot]
  );

  const khmdhsResolvedProcedure = useMemo(
    () => resolveKhmdhsNoticeAssignmentProcedure(formData.khmdhsNoticeSnapshot),
    [formData.khmdhsNoticeSnapshot]
  );

  const noticeKhmdhsNoticeType = useMemo(() => {
    const snap = pickKhmdhsNoticeSnapshot(formData.khmdhsNoticeSnapshot);
    return snap?.noticeType ? String(snap.noticeType).trim() : '';
  }, [formData.khmdhsNoticeSnapshot]);

  const khmdhsContractFieldsAutoFilled = useMemo(
    () => {
      if (isMultipleContractsForm(formData.implementationForm)) {
        return (formData.contracts || []).some((c) => !!sanitizeAdamInput(c?.khmdhsAdam));
      }
      return !!sanitizeAdamInput(formData.khmdhsAdam);
    },
    [formData.implementationForm, formData.contracts, formData.khmdhsAdam]
  );

  const hideManualContractCore = useMemo(
    () => formKhmdhsHidesManualContractCore(formData),
    [formData]
  );

  const hideManualContractDate = useMemo(
    () => formKhmdhsHidesManualContractDate(formData),
    [formData]
  );

  const hideManualContractAmount = useMemo(
    () => formKhmdhsHidesManualContractAmount(formData),
    [formData]
  );

  const hideManualProcessStart = useMemo(
    () => formKhmdhsHidesManualProcessStart(formData),
    [formData]
  );

  const hideManualAssignmentProcedure = useMemo(
    () => formKhmdhsHidesManualAssignmentProcedure(formData),
    [formData]
  );

  const showManualProjectBudget = useMemo(
    () => khmdhsFieldRequiresManualInput(formData.khmdhsDataQualityReview, 'projectBudget', null, null, formData),
    [formData]
  );

  const tryOpenKhmdhsRegistryModal = useCallback(() => {
    const defer = khmdhsDeferRegistryRef.current;
    if (!defer) return;
    const project = formDataRef.current;
    const unresolvedChain = getUnresolvedReviewItems(project?.khmdhsDataQualityReview, project)
      .some((i) => i.fieldId === 'chainKindReview');
    if (unresolvedChain) return;

    if (!shouldOfferRegistryAfterReview(project, {
      dismissed: project?.khmdhsDocumentRegistryDismissed,
      chainFetchedAt: defer.chainFetchedAt,
      chainRes: defer.chainRes || khmdhsLastChainResRef.current,
    })) {
      khmdhsDeferRegistryRef.current = null;
      return;
    }
    const payload = buildRegistryModalPayloadAfterReview(
      project,
      defer.chainFetchedAt,
      defer.chainRes || khmdhsLastChainResRef.current
    );
    khmdhsDeferRegistryRef.current = null;
    setKhmdhsRegistryModal(payload);
  }, []);

  const openPendingKhmdhsReviewOrRegistry = useCallback(() => {
    if (khmdhsPendingDataReviewRef.current) {
      khmdhsPendingDataReviewRef.current = false;
      setDataReviewModalOpen(true);
      return;
    }
    window.setTimeout(() => tryOpenKhmdhsRegistryModal(), 0);
  }, [tryOpenKhmdhsRegistryModal]);

  const openKhmdhsDataReview = useCallback((itemKey = null) => {
    const safeKey = typeof itemKey === 'string' && itemKey.trim() ? itemKey.trim() : null;
    setReviewFocusItemKey(safeKey);
    setDataReviewModalOpen(true);
  }, []);

  const handleDataReviewConfirm = useCallback(() => {
    setDataReviewModalOpen(false);
    setReviewFocusItemKey(null);
    showToast('Ο έλεγχος στοιχείων ΚΗΜΔΗΣ ολοκληρώθηκε.', 'success');
    window.setTimeout(() => tryOpenKhmdhsRegistryModal(), 0);
  }, [showToast, tryOpenKhmdhsRegistryModal]);

  const handleDataReviewDismiss = useCallback(() => {
    setDataReviewModalOpen(false);
    setReviewFocusItemKey(null);
    const project = formDataRef.current;
    const unresolvedChain = getUnresolvedReviewItems(project?.khmdhsDataQualityReview, project)
      .some((i) => i.fieldId === 'chainKindReview');
    if (unresolvedChain && khmdhsDeferRegistryRef.current) {
      showToast(
        'Η καταγραφή εγγράφων θα προτείνεται αφού ολοκληρώσετε τους χαρακτηρισμούς.',
        'info'
      );
    } else {
      window.setTimeout(() => tryOpenKhmdhsRegistryModal(), 0);
    }
  }, [showToast, tryOpenKhmdhsRegistryModal]);

  const handleReviewResolveItem = useCallback((item, opts) => {
    setFormData((prev) => {
      const result = applyReviewResolution(prev, prev.khmdhsDataQualityReview, item, opts);
      showToast(`Αποθηκεύτηκε: ${item.label}`, 'success');
      return { ...result.formData, khmdhsDataQualityReview: result.review };
    });
  }, [showToast]);

  const handleReviewRevokeResolution = useCallback((key) => {
    setFormData((prev) => {
      const oldRes = prev.khmdhsDataQualityReview?.resolutions?.[key];
      const item = (prev.khmdhsDataQualityReview?.items || []).find(
        (i) => reviewItemKey(i) === key
      );
      let review = revokeReviewResolution(prev.khmdhsDataQualityReview, key);
      let next = { ...prev };

      if (isChainKindReviewKey(key)) {
        next.khmdhsDataQualityReview = review;
        next = applyChainCharacterizationToForm(next, review, { fullRecompute: true });
        next = mergeKhmdhsSupplementaryIntoForm(next);
        review = reconcileReviewState(review, next);
        next.khmdhsDataQualityReview = review;
      } else {
        const patch = item && oldRes
          ? revertScalarFieldForRevokedItem(prev, item, oldRes)
          : null;
        if (patch) next = { ...next, ...patch };
        if (item?.chainAdam) {
          next.khmdhsDataQualityReview = review;
          next = applyChainCharacterizationToForm(next, review, { fullRecompute: true });
          next = mergeKhmdhsSupplementaryIntoForm(next);
          review = reconcileReviewState(review, next);
          next.khmdhsDataQualityReview = review;
        } else {
          next.khmdhsDataQualityReview = reconcileReviewState(review, next);
        }
      }

      showToast('Η επιλογή ανακλήθηκε — τα πεδία επανυπολογίστηκαν.', 'info');
      return next;
    });
  }, [showToast]);

  const handleReviewResolveChainKind = useCallback((item, choice, opts = {}) => {
    const silent = opts?.silent === true;
    setFormData((prev) => {
      let review = resolveChainKindChoice(
        prev.khmdhsDataQualityReview,
        item,
        prev,
        { ...choice }
      );
      let next = { ...prev, khmdhsDataQualityReview: review };
      next = applyChainCharacterizationToForm(next, review);
      next = mergeKhmdhsSupplementaryIntoForm(next);
      const followUp = applyChainKindFollowUpResolutions(review, next, item.chainAdam, choice);
      next = followUp.formData;
      review = reconcileReviewState(followUp.review, next);
      next = { ...next, khmdhsDataQualityReview: review };
      const adamLabel = String(item.chainAdam || '').trim();
      const remainingKind = getUnresolvedReviewItems(review, next)
        .filter((i) => i.fieldId === 'chainKindReview').length;
      if (!silent) {
        if (remainingKind > 0) {
          showToast(
            adamLabel
              ? `Ολοκληρώθηκε ${adamLabel} — απομένουν ${remainingKind} ακόμη έγγραφα για χαρακτηρισμό.`
              : `Χαρακτηρισμός αποθηκεύτηκε — απομένουν ${remainingKind} έγγραφα.`,
            'success'
          );
        } else {
          showToast(
            adamLabel
              ? `Ολοκληρώθηκε ${adamLabel} — όλα τα έγγραφα χαρακτηρίστηκαν.`
              : `Χαρακτηρισμός αποθηκεύτηκε: ${CHAIN_KIND_LABEL[choice.kind] || ''}`,
            'success'
          );
        }
      }
      return next;
    });
  }, [showToast]);

  const handleReviewApplyAllSuggested = useCallback(() => {
    setFormData((prev) => {
      let nextForm = prev;
      let nextReview = prev.khmdhsDataQualityReview;
      let count = 0;
      getUnresolvedReviewItems(nextReview, nextForm).forEach((item) => {
        if (!canApplySuggestedReviewValue(item, nextForm)) return;
        const result = applyReviewResolution(nextForm, nextReview, item, {
          value: parseReviewDisplayValue(item),
          source: KHMDHS_RESOLUTION_SOURCE.KHMDHS_APPLIED,
        });
        nextForm = result.formData;
        nextReview = result.review;
        count += 1;
      });
      if (!count) return prev;
      showToast(`Εφαρμόστηκαν ${count} προτάσεις ΚΗΜΔΗΣ.`, 'success');
      return { ...nextForm, khmdhsDataQualityReview: nextReview };
    });
  }, [showToast]);

  const renderKhmdhsFieldAnchor = useCallback((anchorId, children) => (
    <KhmdhsFieldAnchor
      data-khmdhs-field={anchorId}
      data-highlight={khmdhsHighlightField === anchorId ? 'true' : undefined}
    >
      {children}
    </KhmdhsFieldAnchor>
  ), [khmdhsHighlightField]);

  const renderKhmdhsReviewHint = useCallback((fieldId, opts = {}) => (
    <KhmdhsFieldReviewHint
      review={formData.khmdhsDataQualityReview}
      formData={formData}
      fieldId={fieldId}
      contractIndex={opts.contractIndex}
      supplementaryIndex={opts.supplementaryIndex}
      onOpenReview={openKhmdhsDataReview}
    />
  ), [formData, openKhmdhsDataReview]);

  const khmdhsProcessDateAutoFilled = useMemo(
    () => noticeHasFetchedData && !!formData.contractProcessStartDate,
    [noticeHasFetchedData, formData.contractProcessStartDate]
  );

  const renderFieldLabel = (text, fromKhmdhs = false, overrideFieldKey = null) => (
    <Label>
      {text}
      {fromKhmdhs && <KhmdhsAutoBadge>από ΚΗΜΔΗΣ</KhmdhsAutoBadge>}
      {overrideFieldKey && hasFieldOverride(formData, overrideFieldKey) && (
        <KhmdhsFieldOverrideBadge />
      )}
    </Label>
  );

  const khmdhsAdamGuidance = useMemo(
    () =>
      getKhmdhsAdamGuidance({
        projectStatus: formData.projectStatus,
        implementationForm: formData.implementationForm,
      }),
    [formData.projectStatus, formData.implementationForm]
  );

  const renderKhmdhsLockedPanel = (reason) => (
    <KhmdhsLockedPanel>
      <strong>🔒 ΚΗΜΔΗΣ — μη διαθέσιμο ακόμα</strong>
      <div style={{ marginTop: '0.35rem' }}>
        {reason === 'implementation'
          ? 'Επιλέξτε πρώτα «Μορφή Υλοποίησης» (Μια Σύμβαση ή Πολλές Συμβάσεις) στην ενότητα Κωδικοί.'
          : 'Επιλέξτε κατάσταση που αφορά διαδικασία ανάθεσης ή υπογεγραμμένη σύμβαση.'}
      </div>
    </KhmdhsLockedPanel>
  );

  const renderKhmdhsSharedPanel = () => {
    if (!errors.khmdhsSharedChain) return null;
    return <ErrorMessage>{errors.khmdhsSharedChain}</ErrorMessage>;
  };

  const hasPhaseBData = useMemo(
    () => projectHasPhaseBData(formData),
    [formData]
  );

  const handleResetPhaseB = useCallback(async () => {
    const ok = await showConfirm({
      title: 'Επαναφορά Φάσης Β',
      message: 'Θα διαγραφούν όλα τα δεδομένα ανακτήσεων ΚΗΜΔΗΣ, η αλυσίδα, τα στοιχεία σύμβασης, το ΑΠΕ, τα εντάλματα, οι χαρακτηρισμοί, οι χειροκίνητες διορθώσεις, ο κατάλογος εγγράφων και οι σχετικές ρυθμίσεις της Φάσης Β. Η κατάσταση του υποέργου θα επιστρέψει σε «Υπό βραχυπρόθεσμη ωρίμανση».',
      detail: 'Η Φάση Α (βασικά στοιχεία υποέργου) δεν επηρεάζεται πέρα από την κατάσταση. Η ενέργεια δεν αναιρείται — χρειάζεται αποθήκευση για να οριστικοποιηθεί.',
      confirmLabel: 'Επαναφορά Φάσης Β',
      cancelLabel: 'Άκυρο',
      danger: true,
      icon: '↺',
    });
    if (!ok) return;

    cancelKhmdhsFetch();
    setStripDropdown(null);
    setDataReviewModalOpen(false);
    setKhmdhsSituationModal(null);
    setApeConflictModal(null);
    setKhmdhsHighlightField(null);
    setPreSaveOverridesOpen(false);
    khmdhsPendingApplyRef.current = null;
    khmdhsDeferRegistryRef.current = null;
    khmdhsPendingDataReviewRef.current = false;
    setSymvChainPlannerState(null);

    setFormData((prev) => ({
      ...prev,
      ...emptyPhaseBFields(),
    }));
    setAdamInputDraft({ chain: '', contracts: {} });
    setErrors((prev) => clearPhaseBErrors(prev));
    setPhaseBResetUnsaved(true);
    showToast('Η Φάση Β επαναφέρθηκε και η κατάσταση έγινε «Υπό βραχυπρόθεσμη ωρίμανση». Αποθηκεύστε για να οριστικοποιηθεί.', 'info');

    window.setTimeout(() => {
      formScrollRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
    }, 80);
  }, [cancelKhmdhsFetch, showToast]);

  const renderSymvPlannerResumeBanner = () => {
    if (!symvChainPlannerState || symvChainPlannerState.open) return null;
    const docCount = symvChainPlannerState.draftPlan?.items?.length
      || symvChainPlannerState.existingPlan?.items?.length
      || 0;
    return (
      <KhmdhsFetchBanner style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span>
          📋 Ανολοκλήρωτη κατανομή SYMV
          {docCount ? ` (${docCount} έγγραφα)` : ''}
          {' '}— οι επιλογές σας διατηρούνται.
        </span>
        <SymvPlannerResumeBtn
          type="button"
          onClick={() => setSymvChainPlannerState((prev) => (
            prev ? { ...prev, open: true } : prev
          ))}
        >
          Άνοιγμα κατανομής
        </SymvPlannerResumeBtn>
      </KhmdhsFetchBanner>
    );
  };

  const renderKhmdhsActionStrip = () => {
    const chainDraft = adamInputDraft.chain || '';
    const loadingChain = khmdhsChainFetchTarget === 'single'
      || typeof khmdhsChainFetchTarget === 'number'
      || khmdhsChainFetchTarget === 'supplementary';
    const hasChain = projectHasKhmdhsFormResults(formData);
    const guidance = khmdhsAdamGuidance;
    const seedAdam = getStoredChainSeedAdam(formData, editingProject);
    const isMulti = isMultipleContractsForm(formData.implementationForm);
    const allTypeIds = ['REQ', 'PROC', 'AWRD', 'SYMV'];

    if (khmdhsAwaitingRelevantStatus) {
      return renderKhmdhsLockedPanel('status');
    }

    if (!showPhaseBKhmdhs) return null;

    const closeDropdown = () => setStripDropdown(null);

    const handleCopySeedAdam = (e) => {
      e.stopPropagation();
      if (!seedAdam) return;
      navigator.clipboard?.writeText(seedAdam).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = seedAdam;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      });
    };

    const visibleTypeIds = guidance
      ? allTypeIds.filter((typeId) => {
        const allowed = guidance.allowedTypeIds.includes(typeId);
        const discouraged = guidance.discouragedTypeIds.includes(typeId);
        return allowed || discouraged;
      })
      : [];

    return (
      <ActionStrip ref={stripDropdownRef}>
        <StripRow>
          <StripBrand>
            <StripBrandIcon>🔗</StripBrandIcon>
            ΚΗΜΔΗΣ
          </StripBrand>

          <StripDivider />

          <StripMeta>
            <StripStatusDot $ok={hasChain} />
            <StripStatusLabel $ok={hasChain}>
              {hasChain ? 'Ανακτήθηκε' : 'Δώστε ΑΔΑΜ'}
            </StripStatusLabel>
            {hasChain && seedAdam && (
              <StripAdamText
                type="button"
                title={`${seedAdam} — κλικ για αντιγραφή`}
                onClick={handleCopySeedAdam}
              >
                {seedAdam}
              </StripAdamText>
            )}
          </StripMeta>

          {visibleTypeIds.length > 0 && (
            <>
              <StripDivider />
              <StripTypeGroup>
                <StripTypeHint>τύποι</StripTypeHint>
                <StripTypePills>
                  {visibleTypeIds.map((typeId) => {
                    const meta = khmdhsAdamTypeById(typeId);
                    if (!meta) return null;
                    const discouraged = guidance.discouragedTypeIds.includes(typeId);
                    const primary = guidance.primaryTypeIds?.includes(typeId);
                    return (
                      <StripTypePill
                        key={typeId}
                        $primary={primary && !discouraged}
                        $discouraged={discouraged}
                        title={meta.hint}
                      >
                        {typeId}
                      </StripTypePill>
                    );
                  })}
                </StripTypePills>
              </StripTypeGroup>
            </>
          )}

          <StripDivider />

          <StripActions>
            <StripBtn
              type="button"
              $active={stripDropdown === 'chain'}
              disabled={loadingChain}
              onClick={() => setStripDropdown((v) => (v === 'chain' ? null : 'chain'))}
              title={hasChain ? 'Νέος κωδικός ΑΔΑΜ (αλυσίδα ή συμπληρωματική)' : 'Ανάκτηση από ΚΗΜΔΗΣ'}
            >
              {loadingChain ? '⏳' : (hasChain ? '↻' : '🔍')}
              {hasChain ? 'ΑΔΑΜ' : 'Ανάκτηση'}
            </StripBtn>
          </StripActions>

          {hasPhaseBData && (
            <>
              <StripDivider />
              <PhaseBResetBtn
                type="button"
                disabled={loadingChain}
                onClick={handleResetPhaseB}
                title="Διαγραφή όλων των δεδομένων Φάσης Β και νέα αρχή"
              >
                ↺ Επαναφορά
              </PhaseBResetBtn>
            </>
          )}
        </StripRow>

        {/* Dropdown: κύρια αλυσίδα */}
        {stripDropdown === 'chain' && (
          <StripDropdown>
            <DropdownTitle>
              🔍 {hasChain ? 'Κωδικός ΑΔΑΜ' : 'Ανάκτηση από ΚΗΜΔΗΣ'}
            </DropdownTitle>
            <DropdownHint>
              {hasChain
                ? 'Δώστε REQ, PROC, AWRD ή SYMV. Αν υπάρχει ήδη αλυσίδα και δώσετε νέο SYMV, προστίθεται ως συμπληρωματική — η κύρια σύμβαση δεν αντικαθίσταται.'
                : (isMulti
                  ? 'Δώστε οποιονδήποτε ΑΔΑΜ (REQ, PROC, AWRD ή SYMV) — η εφαρμογή εντοπίζει αυτόματα όλες τις συμβάσεις της πράξης.'
                  : (guidance?.chainPanelHint || 'Δώστε τον κωδικό ΑΔΑΜ του πρωτογενούς αιτήματος, δημοσίευσης, ανάθεσης ή σύμβασης.'))}
            </DropdownHint>
            <DropdownRow>
              <AdamInput
                ref={khmdhsChainInputRef}
                type="text"
                style={{ flex: 1, minWidth: 0 }}
                value={chainDraft}
                $hasValue={!!chainDraft}
                onChange={(e) => {
                  const value = sanitizeAdamInput(e.target.value);
                  setAdamInputDraft((prev) => ({ ...prev, chain: value }));
                  setErrors((prev) => { const n = { ...prev }; delete n.khmdhsChainSeedAdam; return n; });
                }}
                onBlur={() => {
                  const err = getAdamFieldError(chainDraft, 'strict');
                  setErrors((prev) => { const n = { ...prev }; if (err) n.khmdhsChainSeedAdam = err; else delete n.khmdhsChainSeedAdam; return n; });
                }}
                placeholder={guidance?.placeholder || 'π.χ. 26PROC018492003'}
                maxLength={ADAM_MAX_LEN}
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && chainDraft) { handleKhmdhsChainFetch(); closeDropdown(); }
                  if (e.key === 'Escape') closeDropdown();
                }}
              />
              <SecondaryOutlineButton
                type="button"
                disabled={loadingChain || !chainDraft}
                onClick={() => { handleKhmdhsChainFetch(); closeDropdown(); }}
              >
                {loadingChain ? 'Λήψη…' : 'Ανάκτηση'}
              </SecondaryOutlineButton>
            </DropdownRow>
            {errors.khmdhsChainSeedAdam && (
              <ErrorMessage style={{ marginTop: '0.4rem' }}>{errors.khmdhsChainSeedAdam}</ErrorMessage>
            )}
          </StripDropdown>
        )}
      </ActionStrip>
    );
  };

  const renderContractKhmdhsBlock = (contractIndex) => {
    const contract = formData.contracts?.[contractIndex] || {};
    const contractDraft = adamInputDraft.contracts[contractIndex] || '';
    const hasDraft = !!String(contractDraft).trim();
    const loading = khmdhsChainFetchTarget === contractIndex;
    const snap = pickKhmdhsSnapshot(contract.khmdhsContractSnapshot);
    const guidance = khmdhsAdamGuidance;
    const inProcedure = guidance?.tone === 'procedure';

    return (
      <AdamChainCard style={{ marginBottom: '0.65rem' }}>
        <AdamChainTitle>
          <AdamChainStepTag>Βήμα 1</AdamChainStepTag>
          {guidance?.contractBlockTitle || 'ΑΔΑΜ (ΚΗΜΔΗΣ)'} {contractIndex + 1}
        </AdamChainTitle>
        <AdamChainHint>
          {guidance?.contractBlockHint ||
            'Δώστε τον ΑΔΑΜ και πατήστε «Ανάκτηση από ΚΗΜΔΗΣ».'}
        </AdamChainHint>
        <AdamChainRow>
          <AdamInput
            type="text"
            style={{ flex: '1 1 220px', minWidth: 0 }}
            value={contractDraft}
            $hasValue={hasDraft}
            onChange={(e) => {
              const value = sanitizeAdamInput(e.target.value);
              setAdamInputDraft((prev) => ({
                ...prev,
                contracts: { ...prev.contracts, [contractIndex]: value },
              }));
              setErrors((prev) => {
                const next = { ...prev };
                delete next[`khmdhsAdam${contractIndex}`];
                return next;
              });
            }}
            onBlur={() => {
              const err = getAdamFieldError(contractDraft, 'strict');
              setErrors((prev) => {
                const next = { ...prev };
                const key = `khmdhsAdam${contractIndex}`;
                if (err) next[key] = err;
                else delete next[key];
                return next;
              });
            }}
            placeholder={guidance?.placeholder || (inProcedure ? 'π.χ. 26PROC018492003' : 'π.χ. 26SYMV018523441')}
            maxLength={ADAM_MAX_LEN}
            autoComplete="off"
            spellCheck={false}
          />
          <SecondaryOutlineButton
            type="button"
            disabled={loading || !hasDraft}
            onClick={() => handleKhmdhsContractChainFetch(contractIndex)}
          >
            {loading ? 'Λήψη…' : 'Ανάκτηση από ΚΗΜΔΗΣ'}
          </SecondaryOutlineButton>
        </AdamChainRow>
        {errors[`khmdhsAdam${contractIndex}`] && (
          <ErrorMessage>{errors[`khmdhsAdam${contractIndex}`]}</ErrorMessage>
        )}
        {snap && (
          <FieldHint style={{ marginTop: '0.45rem', fontWeight: 600 }}>
            {snap.anadoxosName ? `Ανάδοχος: ${snap.anadoxosName}` : 'Στοιχεία ανακτήθηκαν από ΚΗΜΔΗΣ'}
          </FieldHint>
        )}
      </AdamChainCard>
    );
  };

  const renderKhmdhsChainHistoryBlock = (chainHistory, amendments) => {
    const history = Array.isArray(chainHistory) ? chainHistory : [];
    const list = history.length > 1
      ? enrichChainHistoryWithReview(history, formData.khmdhsDataQualityReview)
      : enrichChainHistoryWithReview(
        Array.isArray(amendments) ? amendments : [],
        formData.khmdhsDataQualityReview
      );
    if (list.length === 0) {
      return null;
    }
    const isFullChain = history.length > 0;
    const title = isFullChain
      ? `Ιστορικό αλυσίδας σύμβασης (${list.length} πράξεις)`
      : `Τροποποιήσεις / παρατάσεις (${list.length})`;
    return (
      <div
        style={{
          marginTop: '0.65rem',
          padding: '0.65rem 0.85rem',
          borderRadius: '10px',
          background: isFullChain ? '#f0f9ff' : '#fffbeb',
          border: `1px solid ${isFullChain ? '#7dd3fc' : '#fcd34d'}`,
          fontSize: '0.82rem',
          lineHeight: 1.45,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: '0.35rem', color: isFullChain ? '#0369a1' : '#92400e' }}>
          {title}
        </div>
        {list.map((a) => (
          <div
            key={a.adam}
            style={{
              marginBottom: '0.35rem',
              fontWeight: a.isSeed ? 700 : 400,
              color: a.isSeed ? '#0f172a' : undefined,
            }}
          >
            <strong>{a.label || a.kind}:</strong> {a.adam}
            {a.contractAmount ? ` · ${a.contractAmount} €` : ''}
            {a.contractDate ? ` · ${formatKhmdhsDateOnly(a.contractDate)}` : ''}
            {a.endDate ? ` · λήξη ${formatKhmdhsDateOnly(a.endDate)}` : ''}
            {a.kindNote ? (
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                {a.kindNote}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  const handleSave = async ({ skipOverridesCheck = false, skipDuplicateCheck = false, duplicateAck = null } = {}) => {
    if (isSaving) return;
    console.log('=== SAVE ATTEMPT ===');
    console.log('Form data:', formData);
    console.log('Selected files:', selectedFiles);
    console.log('Editing project:', editingProject);

    const isPhaseASaveOnly = !manualPhaseSavedOnce || isPhaseADirty(formData, manualPhaseBaseline);
    const includePhaseB = !isPhaseASaveOnly;
    let syncedForm = includePhaseB ? syncKhmdhsCompleteReviewFieldsToForm(formData) : formData;
    if (duplicateAck) {
      syncedForm = acknowledgeKhmdhsDuplicateConflict(syncedForm, duplicateAck);
    }
    if (syncedForm !== formData || duplicateAck) {
      setFormData(syncedForm);
    }

    // Έλεγχος ασυμβατότητας κατάστασης με ΚΗΜΔΗΣ δεδομένα
    if (!skipOverridesCheck) {
      const khmdhsIncompat = detectStatusKhmdhsIncompatibility(syncedForm);
      if (khmdhsIncompat) {
        setStatusCleanupModal({ incompat: khmdhsIncompat });
        return; // αναμένουμε απάντηση από το modal
      }
    }

    if (!skipDuplicateCheck) {
      const dupConflicts = checkKhmdhsDuplicateConflicts(syncedForm, allProjects);
      if (dupConflicts.length) {
        const conflict = dupConflicts[0];
        setDuplicateAnchorModal({
          conflict,
          onConfirm: () => {
            setDuplicateAnchorModal(null);
            handleSave({ skipOverridesCheck, skipDuplicateCheck: true, duplicateAck: conflict });
          },
        });
        return;
      }
    }

    const validation = validateForm({ includePhaseB, formSnapshot: syncedForm });
    if (!validation.isValid) {
      console.log('Validation failed, errors:', validation.errors);
      setErrors(validation.errors);
      setTouched((prev) => ({
        ...prev,
        ...Object.keys(validation.errors).reduce((acc, key) => {
          acc[key] = true;
          return acc;
        }, {})
      }));

      const phaseAKeys = new Set([
        'projectTitle',
        'subprojectTitle',
        'kaCode',
        'misPraxhsName',
        'misPraxhsCode',
        'projectType',
        'fundingSource',
        'fundingDetails',
        'approvedAmount',
        'projectStatus',
      ]);
      const hasPhaseBValidationError = includePhaseB
        && Object.keys(validation.errors).some((key) => !phaseAKeys.has(key));
      if (hasPhaseBValidationError) {
        setActivePhaseTab('B');
        window.requestAnimationFrame(() => {
          formScrollRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
        });
      }

      const firstError = Object.values(validation.errors).find(Boolean);
      showToast(
        firstError || 'Συμπληρώστε τα υποχρεωτικά πεδία πριν την αποθήκευση.',
        'error'
      );
      return;
    }

    console.log('Validation passed, proceeding with save...');

    const saveFormData = syncedForm;

    if (
      includePhaseB
      && !skipOverridesCheck
      && countActiveFieldOverrides(saveFormData) > 0
    ) {
      setPreSaveOverridesOpen(true);
      return;
    }

    if (directAssignmentCompliance.violations?.length > 0) {
      showToast(
        `Προειδοποίηση: ${directAssignmentCompliance.violations.length} πιθανή/ές παράβαση/εις κανόνα 12μήνου απευθείας ανάθεσης.`,
        'warning'
      );
    }

    try {
      setIsSaving(true);
      setSaveStatusText(
        isPhaseASaveOnly
          ? 'Αποθήκευση Φάσης Α…'
          : 'Αποθήκευση υποέργου…'
      );

      // Normalize τα κείμενα πριν την αποθήκευση
      let outside = Boolean(saveFormData.supervisorChargeOutsideEngineers);
      let supervisorEngineerIds = [];
      if (!outside) {
        const rawEng = Array.isArray(saveFormData.supervisorEngineerIds) ? saveFormData.supervisorEngineerIds : [];
        const pEng = String(rawEng[0] || '').trim();
        const seenEng = new Set();
        if (pEng) {
          supervisorEngineerIds.push(pEng);
          seenEng.add(pEng);
        }
        rawEng.slice(1).forEach((id) => {
          const s = String(id || '').trim();
          if (s && !seenEng.has(s)) {
            seenEng.add(s);
            supervisorEngineerIds.push(s);
          }
        });
      }

      let supervisorChargeFreePrimary = normalizeText(saveFormData.supervisorChargeFreePrimary || '');
      let supervisorChargeFreeParticipants = normalizeText(saveFormData.supervisorChargeFreeParticipants || '');

      // Πριν καθαρισμό πεδίων: ελεύθερο κείμενο χωρίς κατάλογο = χρέωση εκτός μηχανικών
      if (supervisorChargeFreePrimary.trim() && supervisorEngineerIds.length === 0) {
        outside = true;
      }

      if (outside) {
        supervisorChargeFreeParticipants = '';
      } else {
        supervisorChargeFreePrimary = '';
        supervisorChargeFreeParticipants = '';
      }

      const { supervisor: _legacySupervisorSave, ...formWithoutLegacy } = saveFormData;
      const normalizedFormData = {
        ...formWithoutLegacy,
        dataEntryMode: 'khmdhs',
        khmdhsChainSeedAdam: sanitizeAdamInput(saveFormData.khmdhsChainSeedAdam),
        khmdhsBranchAnchorAdam: sanitizeAdamInput(saveFormData.khmdhsBranchAnchorAdam),
        khmdhsBranchAnchorType: String(saveFormData.khmdhsBranchAnchorType || '').trim().toUpperCase(),
        khmdhsActRootReqAdam: sanitizeAdamInput(saveFormData.khmdhsActRootReqAdam),
        projectTitle: normalizeText(saveFormData.projectTitle),
        subprojectTitle: normalizeText(saveFormData.subprojectTitle),
        comments: normalizeText(saveFormData.comments),
        apeComments: normalizeText(saveFormData.apeComments),
        remainingAmountComments: normalizeText(saveFormData.remainingAmountComments),
        aleRemainingAmounts: saveFormData.aleRemainingAmounts || [],
        supervisorEngineerIds,
        supervisorChargeOutsideEngineers: outside,
        supervisorChargeFreePrimary,
        supervisorChargeFreeParticipants,
        ...resolveContractStorageForSave(saveFormData, editingProject),
        ...resolveNoticeKhmdhsForSave(saveFormData, editingProject)
      };

      const projectData = {
        ...normalizedFormData,
        files: selectedFiles,
        fileGroups: saveFormData.fileGroups || [],
        keepFormOpen: isPhaseASaveOnly,
      };

      if (editingProject) {
        // Έλεγχος αν ο τίτλος του έργου άλλαξε κατά την επεξεργασία
        const originalProjectTitle = editingProject.projectTitle;
        const newProjectTitle = formData.projectTitle;
        
        if (originalProjectTitle !== newProjectTitle) {
          console.log('⚠️ Project title changed during editing:', {
            original: originalProjectTitle,
            new: newProjectTitle
          });
          
          // Έλεγχος αν υπάρχει ήδη έργο με τον νέο τίτλο
          const existingProject = await ipcRenderer.invoke('find-project-by-title', newProjectTitle);
          
          if (existingProject && existingProject.projectId !== editingProject.projectId) {
            // Υπάρχει άλλο έργο με τον νέο τίτλο - δημιουργούμε νέο έργο
            console.log('🆕 Title conflict detected - creating new project');
            projectData.projectId = null; // Θα δημιουργηθεί νέο ID
          } else {
            // Δεν υπάρχει σύγκρουση - απλά ενημερώνουμε το υπάρχον έργο
            console.log('📝 Updating existing project with new title');
            projectData.projectId = editingProject.projectId;
          }
        } else {
          // Ο τίτλος δεν άλλαξε - κανονική επεξεργασία
          projectData.projectId = editingProject.projectId;
        }
        
        projectData.subprojectId = editingProject.subprojectId;
      } else if (formData.subprojectId && formData.projectId) {
        projectData.projectId = formData.projectId;
        projectData.subprojectId = formData.subprojectId;
      } else {
        // Έλεγχος αν υπάρχει έργο με τον ίδιο τίτλο (μόνο για νέα έργα)
        if (normalizedFormData.projectTitle) {
          const existingProject = await ipcRenderer.invoke(
            'find-project-by-title',
            normalizedFormData.projectTitle
          );
          if (existingProject) {
                  // Custom modal για επιλογή
                  const shouldAddToExisting = await new Promise((resolve) => {
                    const modal = document.createElement('div');
                    modal.style.cssText = `
                      position: fixed;
                      top: 0;
                      left: 0;
                      width: 100%;
                      height: 100%;
                      background: rgba(0, 0, 0, 0.7);
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      z-index: 10000;
                    `;

                    const modalContent = document.createElement('div');
                    modalContent.style.cssText = `
                      background: white;
                      border-radius: 12px;
                      padding: 2rem;
                      max-width: 500px;
                      width: 90%;
                      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    `;

                    modalContent.innerHTML = `
                      <h3 style="margin: 0 0 1rem 0; color: #333; font-size: 1.3rem;">
                        🔍 Υπάρχον Έργο Βρέθηκε
                      </h3>
                      <p style="margin: 0 0 1.5rem 0; color: #666; font-size: 1rem;">
                        Βρέθηκε υπάρχον έργο με τίτλο:<br>
                        <strong>"${formData.projectTitle}"</strong>
                      </p>
                      <p style="margin: 0 0 1.5rem 0; color: #333; font-size: 1rem; font-weight: 500;">
                        Θέλετε να προσθέσετε το νέο υποέργο στο υπάρχον έργο;
                      </p>
                      <div style="display: flex; gap: 1rem;">
                        <button id="yesBtn" style="
                          flex: 1;
                          padding: 0.8rem 1.5rem;
                          background: #28a745;
                          color: white;
                          border: none;
                          border-radius: 6px;
                          font-size: 1rem;
                          cursor: pointer;
                          font-weight: 500;
                        ">ΝΑΙ - Προσθήκη στο Υπάρχον</button>
                        <button id="noBtn" style="
                          flex: 1;
                          padding: 0.8rem 1.5rem;
                          background: #007bff;
                          color: white;
                          border: none;
                          border-radius: 6px;
                          font-size: 1rem;
                          cursor: pointer;
                          font-weight: 500;
                        ">ΟΧΙ - Νέο Έργο</button>
                      </div>
                    `;

                    modal.appendChild(modalContent);
                    document.body.appendChild(modal);

                    const yesBtn = modalContent.querySelector('#yesBtn');
                    const noBtn = modalContent.querySelector('#noBtn');

                    let handleKeyDown;
                    const cleanup = (result) => {
                      if (modal.parentNode === document.body) {
                        document.body.removeChild(modal);
                      }
                      if (handleKeyDown) {
                        document.removeEventListener('keydown', handleKeyDown);
                      }
                      resolve(result);
                    };

                    yesBtn.addEventListener('click', () => cleanup(true));
                    noBtn.addEventListener('click', () => cleanup(false));

                    // Κλείσιμο με ESC
                    handleKeyDown = (e) => {
                      if (e.key === 'Escape') {
                        cleanup(false);
                      }
                    };
                    document.addEventListener('keydown', handleKeyDown);
                  });
            
            if (shouldAddToExisting) {
              // Χρησιμοποιούμε το υπάρχον projectId
              projectData.projectId = existingProject.projectId;
              console.log('🔗 Adding subproject to existing project:', existingProject.projectId);
            } else {
              console.log('🆕 Creating new project with same title');
            }
          }
        }
      }

      console.log('Sending project data:', projectData);
      const saveResult = await onSave(projectData);
      if (!saveResult?.success) return;

      setPhaseBResetUnsaved(false);
      setSelectedFiles([]);

      savedFormFingerprintRef.current = buildProjectFormFingerprint(
        formDataRef.current,
        { selectedFilesCount: 0 }
      );

      setManualPhaseBaseline(serializePhaseASnapshot(pickPhaseASnapshot(formData)));
      setManualPhaseSavedOnce(true);
      setActivePhaseTab('B');

      if (projectData.keepFormOpen) {
        if (saveResult.projectId && saveResult.subprojectId) {
          setFormData((prev) => {
            const next = {
              ...prev,
              projectId: saveResult.projectId,
              subprojectId: saveResult.subprojectId,
            };
            savedFormFingerprintRef.current = buildProjectFormFingerprint(next, { selectedFilesCount: 0 });
            return next;
          });
        }
        showToast('Η Φάση Α αποθηκεύτηκε. Η Φάση Β ξεκλειδώθηκε.', 'success');
      }

      console.log('Project saved successfully');
    } catch (error) {
      console.error('Error saving project:', error);
    } finally {
      setIsSaving(false);
    }
  };

  handleSaveRef.current = handleSave;

  const isNewSubprojectForm = useCallback(() => {
    const fd = formDataRef.current;
    return !editingProject?.subprojectId && !fd?.subprojectId;
  }, [editingProject]);

  const formHasUnsavedChanges = useCallback(() => (
    hasUnsavedProjectFormChanges({
      formData: formDataRef.current,
      savedFingerprint: savedFormFingerprintRef.current,
      selectedFiles: selectedFilesRef.current,
      phaseBResetUnsaved: phaseBResetUnsavedRef.current,
      isNewProject: isNewSubprojectForm(),
    })
  ), [isNewSubprojectForm]);

  const handleRequestClose = useCallback(() => {
    if (isSaving) return;
    if (!formHasUnsavedChanges()) {
      onClose();
      return;
    }
    setUnsavedCloseModalOpen(true);
  }, [formHasUnsavedChanges, onClose, isSaving]);

  const handleUnsavedCloseCancel = useCallback(() => {
    setUnsavedCloseModalOpen(false);
  }, []);

  const handleUnsavedCloseDiscard = useCallback(() => {
    setUnsavedCloseModalOpen(false);
    setPhaseBResetUnsaved(false);
    onClose();
  }, [onClose]);

  const handleUnsavedCloseSave = useCallback(async () => {
    await handleSaveRef.current();
    if (!formHasUnsavedChanges()) {
      setUnsavedCloseModalOpen(false);
      onClose();
    }
  }, [formHasUnsavedChanges, onClose]);

  const canEditKhmdhsApe = userRole !== 'USER' && userRole !== 'ENGINEER';

  const handleOpenApeEntry = useCallback((target) => {
    if (!canEditKhmdhsApe) return;
    setApeEntryTarget(target || null);
  }, [canEditKhmdhsApe]);

  const handleFetchDiavgeiaByAda = useCallback(async (ada) => {
    const seed = String(ada || '').trim();
    if (!seed) {
      return { success: false, error: 'Συμπληρώστε τον ΑΔΑ.' };
    }
    try {
      return await ipcRenderer.invoke('diavgeia-fetch-decision-by-ada', { ada: seed });
    } catch (e) {
      return { success: false, error: e?.message || 'Σφάλμα ανάκτησης' };
    }
  }, []);

  const handleFetchApeByAdam = useCallback(async (adam) => {
    const seed = sanitizeAdamInput(adam);
    const formatErr = getAdamFieldError(seed, 'strict');
    if (formatErr) {
      return { success: false, error: formatErr };
    }
    try {
      return await ipcRenderer.invoke('khmdhs-fetch-contract-by-adam', { adam: seed });
    } catch (e) {
      return { success: false, error: e?.message || 'Σφάλμα ανάκτησης' };
    }
  }, []);

  const handleApplyApeEntry = useCallback(async ({
    apeAmount,
    documentDate,
    comments,
    file,
    sourceAdam,
    sourceDiavgeiaAda,
    diavgeiaPreview,
    khmdhsMeta,
  }) => {
    if (!apeEntryTarget) return;

    let filePayload = file;
    const targetTitle = apeEntryTarget.title || '';

    if (filePayload === undefined && sourceDiavgeiaAda) {
      try {
        const dl = await ipcRenderer.invoke('diavgeia-download-decision-pdf', {
          ada: sourceDiavgeiaAda,
          documentUrl: diavgeiaPreview?.documentUrl || '',
          fileName: buildDefaultApeFileName(targetTitle, '.pdf'),
        });
        if (dl?.success && dl.path) {
          filePayload = {
            sourcePath: dl.path,
            fileName: dl.fileName || buildDefaultApeFileName(targetTitle, dl.path),
            groupTitle: buildDefaultApeFileGroupTitle(targetTitle),
          };
        }
      } catch {
        /* προαιρετική λήψη — δεν μπλοκάρει την καταχώριση */
      }
    }

    setFormData((prev) => applyApeEntryToProject(prev, apeEntryTarget, {
      apeAmount,
      documentDate,
      comments,
      file: filePayload,
      sourceAdam,
      diavgeiaAda: sourceDiavgeiaAda,
      diavgeiaPreview,
      khmdhsMeta,
    }));
    setApeEntryTarget(null);
    const hasFile = filePayload && filePayload !== null && (filePayload.sourcePath || filePayload.fileName);
    const removedFile = filePayload === null;
    let msg = 'Ο ΑΠΕ εφαρμόστηκε στη φόρμα. Αποθηκεύστε το υποέργο για να οριστικοποιηθεί.';
    if (hasFile) {
      msg = removedFile
        ? msg
        : 'Ο ΑΠΕ και το αρχείο προστέθηκαν στη φόρμα. Αποθηκεύστε το υποέργο για να οριστικοποιηθούν.';
    }
    if (removedFile) msg = 'Το αρχείο ΑΠΕ αφαιρέθηκε από τη φόρμα. Αποθηκεύστε για οριστικοποίηση.';
    showToast(msg, 'success');
  }, [apeEntryTarget, showToast]);

  const handleRemoveApeEntry = useCallback(() => {
    if (!apeEntryTarget) return;
    setFormData((prev) => ({
      ...prev,
      ...clearApeEntryFromProject(prev, apeEntryTarget),
    }));
    setApeEntryTarget(null);
    showToast('Ο ΑΠΕ αφαιρέθηκε από τη φόρμα.', 'info');
  }, [apeEntryTarget, showToast]);

  const apeEntryModalProps = useMemo(() => {
    if (!apeEntryTarget) return null;
    const fileRef = readApeFileRef(formData, apeEntryTarget);
    if (apeEntryTarget.kind === 'supplementary') {
      const fields = readSupplementaryApeFields(formData, apeEntryTarget.arrayIndex);
      return {
        targetTitle: apeEntryTarget.title,
        khmdhsAmount: fields.khmdhsAmount,
        amountSanityReference: getKhmdhsAmountSanityReference(formData),
        initialApeAmount: fields.apeAmount,
        initialComments: fields.comments,
        initialFileName: fileRef.fileName,
        initialGroupTitle: fileRef.groupTitle,
        initialSourcePath: fileRef.sourcePath,
        initialSourceAdam: fields.sourceAdam,
        initialDiavgeiaAda: fields.diavgeiaAda,
      };
    }
    const fields = readContractApeFields(
      formData,
      apeEntryTarget.arrayIndex,
      apeEntryTarget.entryId || null
    );
    const isNewEntry = apeEntryTarget.kind === 'contract' && !apeEntryTarget.entryId;
    return {
      targetTitle: apeEntryTarget.title,
      khmdhsAmount: fields.khmdhsAmount,
      amountSanityReference: getKhmdhsAmountSanityReference(formData),
      initialApeAmount: isNewEntry ? '' : fields.apeAmount,
      initialDocumentDate: isNewEntry ? '' : fields.documentDate,
      initialComments: isNewEntry ? '' : fields.comments,
      initialFileName: isNewEntry ? '' : fileRef.fileName,
      initialGroupTitle: isNewEntry ? '' : fileRef.groupTitle,
      initialSourcePath: isNewEntry ? '' : fileRef.sourcePath,
      initialSourceAdam: isNewEntry ? '' : fields.sourceAdam,
      initialDiavgeiaAda: isNewEntry ? '' : fields.diavgeiaAda,
      isNewEntry,
    };
  }, [apeEntryTarget, formData]);

  const handleOpenManualExtension = useCallback((target) => {
    if (!canEditKhmdhsApe) return;
    setManualExtensionTarget(target || null);
  }, [canEditKhmdhsApe]);

  const handleApplyManualExtension = useCallback(async ({
    newEndDate,
    documentDate,
    comments,
    file,
    diavgeiaAda,
    diavgeiaPreview,
  }) => {
    if (!manualExtensionTarget) return;

    let filePayload = file;
    const targetTitle = manualExtensionTarget.title || '';

    if (filePayload === undefined && diavgeiaAda) {
      try {
        const dl = await ipcRenderer.invoke('diavgeia-download-decision-pdf', {
          ada: diavgeiaAda,
          documentUrl: diavgeiaPreview?.documentUrl || '',
          fileName: buildDefaultExtensionFileName(targetTitle, '.pdf'),
        });
        if (dl?.success && dl.path) {
          filePayload = {
            sourcePath: dl.path,
            fileName: dl.fileName || buildDefaultExtensionFileName(targetTitle, dl.path),
            groupTitle: buildDefaultApeFileGroupTitle(targetTitle),
          };
        }
      } catch {
        /* προαιρετική λήψη — δεν μπλοκάρει την καταχώριση */
      }
    }

    setFormData((prev) => applyExtensionEntryToProject(prev, manualExtensionTarget, {
      newEndDate,
      documentDate,
      comments,
      file: filePayload,
      diavgeiaAda,
      diavgeiaPreview,
    }));
    setManualExtensionTarget(null);
    const hasFile = filePayload && filePayload !== null && (filePayload.sourcePath || filePayload.fileName);
    const removedFile = filePayload === null;
    let msg = 'Η παράταση εφαρμόστηκε στη φόρμα. Αποθηκεύστε το υποέργο για να οριστικοποιηθεί.';
    if (hasFile) {
      msg = removedFile
        ? msg
        : 'Η παράταση και το αρχείο προστέθηκαν στη φόρμα. Αποθηκεύστε το υποέργο για να οριστικοποιηθούν.';
    }
    if (removedFile) msg = 'Το αρχείο παράτασης αφαιρέθηκε από τη φόρμα. Αποθηκεύστε για οριστικοποίηση.';
    showToast(msg, 'success');
  }, [manualExtensionTarget, showToast]);

  const handleRemoveManualExtension = useCallback(() => {
    if (!manualExtensionTarget) return;
    setFormData((prev) => ({
      ...prev,
      ...clearExtensionEntryFromProject(prev, manualExtensionTarget),
    }));
    setManualExtensionTarget(null);
    showToast('Η παράταση αφαιρέθηκε από τη φόρμα.', 'info');
  }, [manualExtensionTarget, showToast]);

  const manualExtensionModalProps = useMemo(() => {
    if (!manualExtensionTarget) return null;
    const arrayIndex = manualExtensionTarget.arrayIndex ?? 0;
    const entries = listContractExtensionEntries(formData, arrayIndex);
    const entry = manualExtensionTarget.entryId
      ? entries.find((e) => e.id === manualExtensionTarget.entryId)
      : null;
    const isNewEntry = !manualExtensionTarget.entryId;
    return {
      targetTitle: manualExtensionTarget.title,
      initialNewEndDate: entry?.newEndDate || '',
      initialDocumentDate: entry?.documentDate || '',
      initialComments: entry?.comments || '',
      initialFileName: entry?.fileName || '',
      initialGroupTitle: entry?.fileGroupTitle || '',
      initialSourcePath: entry?.fileSourcePath || '',
      initialDiavgeiaAda: entry?.diavgeiaAda || '',
      isNewEntry,
    };
  }, [manualExtensionTarget, formData]);

  const mergeSupervisorEngineerIds = (primaryId, auxiliaryIds) => {
    const p = String(primaryId || '').trim();
    const aux = Array.isArray(auxiliaryIds) ? auxiliaryIds : [];
    const seen = new Set();
    const out = [];
    if (p) {
      out.push(p);
      seen.add(p);
    }
    aux.forEach((id) => {
      const s = String(id || '').trim();
      if (s && !seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    });
    return out;
  };

  const primaryEngineerId = (formData.supervisorEngineerIds || [])[0] || '';
  const auxiliaryEngineerIds = (formData.supervisorEngineerIds || []).slice(1);
  const auxiliaryEngineerOptions = (registeredEngineers || []).filter((e) => e.id && e.id !== primaryEngineerId);

  const toggleAuxiliaryEngineer = (engineerId) => {
    const sid = String(engineerId || '').trim();
    if (!sid) return;
    setFormData((prev) => {
      const prim = (prev.supervisorEngineerIds || [])[0] || '';
      if (sid === prim) return prev;
      const ids = prev.supervisorEngineerIds || [];
      const aux = ids.slice(1);
      const has = aux.includes(sid);
      const nextAux = has ? aux.filter((x) => x !== sid) : [...aux, sid];
      return {
        ...prev,
        supervisorEngineerIds: mergeSupervisorEngineerIds(prim, nextAux)
      };
    });
  };

  const addAuxiliaryEngineerFromPicker = (engineerId) => {
    const sid = String(engineerId || '').trim();
    if (!sid) return;
    setFormData((prev) => {
      const prim = (prev.supervisorEngineerIds || [])[0] || '';
      const aux = (prev.supervisorEngineerIds || []).slice(1);
      if (sid === prim || aux.includes(sid)) return prev;
      return {
        ...prev,
        supervisorEngineerIds: mergeSupervisorEngineerIds(prim, [...aux, sid])
      };
    });
    setAuxPickerKey((k) => k + 1);
  };

  const auxiliaryAddDropdownOptions = auxiliaryEngineerOptions.filter((e) => !auxiliaryEngineerIds.includes(e.id));

  const labelForEngineerId = (id) => {
    const sid = String(id || '').trim();
    const eng = (registeredEngineers || []).find(
      (e) => e && e.id && String(e.id).trim().toLowerCase() === sid.toLowerCase()
    );
    return eng ? String(eng.fullName || eng.id).trim() || sid : sid;
  };

  const dockFileCount = useMemo(() => {
    const grouped = (formData.fileGroups || []).reduce((n, g) => n + (g.files?.length || 0), 0);
    return grouped + (selectedFiles?.length || 0);
  }, [formData.fileGroups, selectedFiles]);

  const legacyKhmdhsNeedsUpgrade = useMemo(
    () => needsKhmdhsLegacyUpgrade(formData),
    [formData]
  );

  const legacyKhmdhsPendingSave = useMemo(
    () => khmdhsLegacyUpgradePendingSave(formData, editingProject),
    [formData, editingProject]
  );

  const legacyUpgradeSeedAdam = useMemo(
    () => getKhmdhsUpgradeSeedAdam(formData),
    [formData]
  );

  if (!isOpen) return null;

  const showContractFields = STATUSES_WITH_CONTRACT_FIELDS.includes(formData.projectStatus);
  const isMultiContracts = isMultipleContractsForm(formData.implementationForm);
  const chainShowsContractPanels = formChainDisplaysContractPanels(formData);
  const khmdhsChainHasAmendments = khmdhsChainHasLinkedAmendments(formData);
  const khmdhsDerivedSupplementary = (formData.supplementaryContracts || []).some((c) => c?.khmdhsDerived);
  const showKhmdhsSupplementarySection = formShouldShowKhmdhsSupplementaryEditor(
    formData,
    formData.khmdhsDataQualityReview
  );
  const showManualSupplementaryToggle = !khmdhsChainHasAmendments && !chainShowsContractPanels;
  const hideLegacyContractSection = showContractFields && chainShowsContractPanels;
  const showKhmdhsChainPanel = (
    statusShowsAssignmentProcedure(formData.projectStatus) || showContractFields
  );
  const showMultiKhmdhsSection = isMultiContracts && showKhmdhsChainPanel;
  const khmdhsAwaitingRelevantStatus = !!formData.projectStatus && !showKhmdhsChainPanel;
  const visibleFundingSources = fundingOptions.sources.filter(s => !s.hidden);
  const visibleFundingDetails = (fundingOptions.details[formData.fundingSource] || []).filter(d => !d.hidden);

  const phaseADirty = isPhaseADirty(formData, manualPhaseBaseline);
  const phaseBEditable = manualPhaseSavedOnce && !phaseADirty;
  const isMaturationStatus = formData.projectStatus === 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ';
  const isAbandonedStatus = isAbandonedSubproject(formData.projectStatus);
  const showPhaseBKhmdhs = phaseBEditable && !isMaturationStatus && !isAbandonedStatus && showKhmdhsChainPanel;

  const showLegacyKhmdhsBanner = (() => {
    if (isMaturationStatus || isAbandonedStatus || !showKhmdhsChainPanel) return false;
    const persisted = !!(editingProject?.subprojectId || formData.subprojectId);
    if (!persisted) return false;
    return legacyKhmdhsNeedsUpgrade || legacyKhmdhsPendingSave;
  })();

  const renderKhmdhsLegacyUpgradeBanner = () => {
    if (!showLegacyKhmdhsBanner) return null;

    if (legacyKhmdhsPendingSave && !legacyKhmdhsNeedsUpgrade) {
      return (
        <KhmdhsLegacyUpgradeBanner $pending>
          <ComplianceAlertTitle>💾 Ολοκληρώστε την αναβάθμιση</ComplianceAlertTitle>
          Τα στοιχεία της αλυσίδας ΚΗΜΔΗΣ ανακτήθηκαν στη φόρμα.
          {' '}
          <strong>Αποθηκεύστε</strong> το υποέργο για να αποθηκευτούν μόνιμα (δημοσίευση, REQ, τροποποιήσεις κ.λπ.).
        </KhmdhsLegacyUpgradeBanner>
      );
    }

    return (
      <KhmdhsLegacyUpgradeBanner>
        <ComplianceAlertTitle>⬆️ Αναβάθμιση από παλιά μορφή</ComplianceAlertTitle>
        <div>
          Αυτό το υποέργο έχει καταχωρημένο ΑΔΑΜ
          {legacyUpgradeSeedAdam ? (
            <> (<span style={{ fontFamily: 'ui-monospace, monospace' }}>{legacyUpgradeSeedAdam}</span>)</>
          ) : null}
          {' '}
          από την προηγούμενη έκδοση, χωρίς πλήρη αλυσίδα ΚΗΜΔΗΣ.
          Πατήστε «Ανάκτηση από ΚΗΜΔΗΣ» για να συμπληρωθούν δημοσίευση, πρωτογενές αίτημα (REQ),
          ημερομηνίες και — όπου υπάρχει — στοιχεία σύμβασης.
        </div>
        <KhmdhsLegacyUpgradeActions>
          <KhmdhsLegacyUpgradeButton
            type="button"
            disabled={khmdhsChainFetchTarget !== null}
            onClick={handleLegacyKhmdhsUpgrade}
          >
            {khmdhsChainFetchTarget !== null ? 'Ανάκτηση…' : 'Ανάκτηση από ΚΗΜΔΗΣ'}
          </KhmdhsLegacyUpgradeButton>
          <FieldHint style={{ margin: 0, fontWeight: 600 }}>
            Μετά την ανάκτηση, αποθηκεύστε το υποέργο.
          </FieldHint>
        </KhmdhsLegacyUpgradeActions>
      </KhmdhsLegacyUpgradeBanner>
    );
  };

  const handleApeConflictAccept = () => {
    if (!apeConflictModal) return;
    const { suggested, contractIndex } = apeConflictModal;
    setFormData((prev) => {
      if (contractIndex != null && contractIndex >= 0) {
        const contracts = [...(prev.contracts || [])];
        if (contracts[contractIndex]) {
          contracts[contractIndex] = { ...contracts[contractIndex], apeAmount: suggested };
        }
        return { ...prev, contracts };
      }
      return { ...prev, apeAmount: suggested };
    });
    setApeConflictModal(null);
  };

  const handleContractExpiryAccept = () => {
    setFormData((prev) => ({
      ...prev,
      projectStatus: KHMDHS_COMPLETED_STATUS_SUGGESTION,
    }));
    setManualPhaseBaseline((baseline) => {
      if (!baseline) return baseline;
      try {
        const snap = JSON.parse(baseline);
        snap.projectStatus = KHMDHS_COMPLETED_STATUS_SUGGESTION;
        return JSON.stringify(snap);
      } catch {
        return baseline;
      }
    });
    setContractExpiryPrompt(null);
    showToast('Η κατάσταση ορίστηκε σε «Ολοκληρωμένο».', 'info');
  };

  const findSituationAction = (actionId, situationId) => {
    const situation = khmdhsSituationModal?.report?.situations?.find((s) => s.id === situationId);
    return situation?.actions?.find((a) => a.id === actionId) || null;
  };

  const focusKhmdhsAdamInput = (contractIndex, suggestedAdam = '') => {
    const adam = sanitizeAdamInput(suggestedAdam);
    if (adam) {
      setAdamInputDraft((prev) => ({ ...prev, chain: adam }));
    }
    setStripDropdown('chain');
    window.setTimeout(() => {
      khmdhsChainInputRef.current?.focus?.();
    }, 80);
  };

  const focusKhmdhsSupplementaryInput = (suggestedAdam = '') => {
    const adam = sanitizeAdamInput(suggestedAdam);
    if (adam) {
      setAdamInputDraft((prev) => ({ ...prev, chain: adam }));
    }
    setStripDropdown('chain');
    window.setTimeout(() => {
      khmdhsChainInputRef.current?.focus?.();
    }, 80);
  };

  const handleKhmdhsSituationAction = (actionId, situationId, actionOverride) => {
    // actionOverride: το πλήρες action object που στέλνει το modal (αποφεύγουμε
    // το .find() που επιστρέφει πάντα τη 1η εμφάνιση για ίδια actionId)
    const actionMeta = actionOverride || findSituationAction(actionId, situationId);
    const contractIndex = khmdhsSituationModal?.contractIndex;

    switch (actionId) {
      case KHMDHS_SITUATION_ACTION.OPEN_REVIEW:
        setDataReviewModalOpen(true);
        // Αποθήκευση αναγνώρισης — ο χρήστης εξετάζει το θέμα στην αναφορά ελέγχου
        if (situationId) {
          setFormData((prev) => ({
            ...prev,
            khmdhsAcknowledgedSituationIds: [
              ...new Set([...(prev.khmdhsAcknowledgedSituationIds || []), situationId]),
            ],
          }));
        }
        break;
      case KHMDHS_SITUATION_ACTION.RETRY_SEED: {
        khmdhsPendingApplyRef.current = null;
        khmdhsDeferRegistryRef.current = null;
        khmdhsPendingDataReviewRef.current = false;
        const suggested = sanitizeAdamInput(actionMeta?.suggestedAdam || '');
        if (suggested) {
          setKhmdhsSituationModal(null);
          if (contractIndex != null && contractIndex >= 0) {
            setAdamInputDraft((prev) => ({
              ...prev,
              contracts: { ...prev.contracts, [contractIndex]: suggested },
            }));
            runKhmdhsChainFetch({ adam: suggested, contractIndex });
          } else {
            setAdamInputDraft((prev) => ({ ...prev, chain: suggested }));
            runKhmdhsChainFetch({ adam: suggested });
          }
        } else {
          focusKhmdhsAdamInput(contractIndex, '');
          showToast('Δώστε νέο ΑΔΑΜ και πατήστε «Ανάκτηση από ΚΗΜΔΗΣ».', 'info');
          setKhmdhsSituationModal(null);
        }
        return;
      }
      case KHMDHS_SITUATION_ACTION.TRY_SYMV: {
        khmdhsPendingApplyRef.current = null;
        const trySuggestedAdam = sanitizeAdamInput(actionMeta?.suggestedAdam || '');
        if (trySuggestedAdam) {
          setKhmdhsSituationModal(null);
          // Βρίσκουμε τον αντίστοιχο contractIndex από τη γραμμή που έχει ήδη αυτόν τον ΑΔΑΜ
          let targetIdx = contractIndex != null && contractIndex >= 0 ? contractIndex : null;
          if (targetIdx == null) {
            const matchedIdx = (formData.contracts || []).findIndex(
              (c) => sanitizeAdamInput(c?.khmdhsAdam) === trySuggestedAdam
                || !sanitizeAdamInput(c?.khmdhsAdam)
            );
            targetIdx = matchedIdx >= 0 ? matchedIdx : 0;
          }
          window.setTimeout(() => {
            runKhmdhsChainFetch({ adam: trySuggestedAdam, contractIndex: targetIdx, forceChainFetch: true });
          }, 50);
          return;
        }
        focusKhmdhsAdamInput(contractIndex, '');
        showToast('Εισάγετε ΑΔΑΜ σύμβασης (SYMV) και πατήστε «Ανάκτηση από ΚΗΜΔΗΣ».', 'info');
        break;
      }
      case KHMDHS_SITUATION_ACTION.TRY_PRIMARY_SEED:
        setKhmdhsSituationModal(null);
        setAdamInputDraft((prev) => ({ ...prev, chain: '' }));
        focusKhmdhsAdamInput(contractIndex, '');
        showToast('Δώστε ΑΔΑΜ πρωτογενούς αιτήματος ή αρχικής σύμβασης για ολόκληρη την αλυσίδα.', 'info');
        return;
      case KHMDHS_SITUATION_ACTION.ADD_SUPPLEMENTARY_ADAM:
        setKhmdhsSituationModal(null);
        focusKhmdhsSupplementaryInput(actionMeta?.suggestedAdam || '');
        showToast('Δώστε τον ΑΔΑΜ της συμπληρωματικής σύμβασης και πατήστε «Προσθήκη συμπληρωματικής».', 'info');
        return;
      case KHMDHS_SITUATION_ACTION.CLEAR_KHMDHS:
        khmdhsPendingApplyRef.current = null;
        khmdhsDeferRegistryRef.current = null;
        khmdhsPendingDataReviewRef.current = false;
        setSymvChainPlannerState(null);
        setFormData((prev) => ({
          ...prev,
          ...buildKhmdhsChainResetPayload(),
        }));
        setAdamInputDraft({ chain: '', contracts: {} });
        setErrors((prev) => clearPhaseBErrors(prev));
        setPhaseBResetUnsaved(true);
        showToast('Τα στοιχεία ΚΗΜΔΗΣ διαγράφηκαν και η κατάσταση έγινε «Υπό βραχυπρόθεσμη ωρίμανση». Αποθηκεύστε για οριστική διαγραφή.', 'info');
        break;
      case KHMDHS_SITUATION_ACTION.MANUAL_CONTINUE:
        if (khmdhsSituationModal?.deferApply && khmdhsPendingApplyRef.current) {
          const pendingApply = khmdhsPendingApplyRef.current;
          khmdhsPendingApplyRef.current = null;
          pendingApply();
          showToast('Εφαρμόστηκαν τα διαθέσιμα στοιχεία ΚΗΜΔΗΣ. Συμπληρώστε χειροκίνητα τα υπόλοιπα.', 'info');
        } else {
          khmdhsPendingApplyRef.current = null;
          showToast('Συνεχίστε με χειροκίνητη συμπλήρωση των πεδίων.', 'info');
        }
        break;
      case KHMDHS_SITUATION_ACTION.ACCEPT_PARTIAL:
        if (khmdhsSituationModal?.deferApply && khmdhsPendingApplyRef.current) {
          const pendingApply = khmdhsPendingApplyRef.current;
          khmdhsPendingApplyRef.current = null;
          pendingApply();
          showToast('Κρατήθηκαν τα διαθέσιμα στοιχεία από ΚΗΜΔΗΣ (ακυρωμένο πρωτογενές).', 'info');
        }
        // fall through for acknowledgedIds
      case KHMDHS_SITUATION_ACTION.DISMISS:
        khmdhsPendingApplyRef.current = null;
        // Αποθήκευση αναγνώρισης — δεν εμφανίζεται ξανά σε επόμενη ανάκτηση
        if (situationId) {
          setFormData((prev) => ({
            ...prev,
            khmdhsAcknowledgedSituationIds: [
              ...new Set([...(prev.khmdhsAcknowledgedSituationIds || []), situationId]),
            ],
          }));
        }
        break;
      default:
        break;
    }
    openPendingKhmdhsReviewOrRegistry();
    setKhmdhsSituationModal(null);
  };

  const handleKhmdhsSituationDismiss = async () => {
    if (khmdhsSituationModal?.deferApply && khmdhsPendingApplyRef.current) {
      const discard = await showConfirm({
        title: 'Κλείσιμο χωρίς εφαρμογή',
        message: 'Αν κλείσετε τώρα, τα στοιχεία που ανακτήθηκαν από το ΚΗΜΔΗΣ δεν θα εφαρμοστούν στη φόρμα.',
        detail: 'Χρησιμοποιήστε «Χειροκίνητη συνέχιση» ή «Αποδοχή μερικών στοιχείων» αν θέλετε να κρατήσετε ό,τι διαθέσιμο.',
        confirmLabel: 'Κλείσιμο χωρίς εφαρμογή',
        cancelLabel: 'Πίσω',
        danger: true,
      });
      if (!discard) return;
      khmdhsDeferRegistryRef.current = null;
      khmdhsPendingDataReviewRef.current = false;
    } else {
      openPendingKhmdhsReviewOrRegistry();
    }
    khmdhsPendingApplyRef.current = null;
    setKhmdhsSituationModal(null);
  };

  const handleKhmdhsRegistryConfirm = (selected, neverAsk) => {
    const chainFetchedAt = khmdhsRegistryModal?.chainFetchedAt || new Date().toISOString();
    setFormData((prev) => ({
      ...prev,
      khmdhsDocumentRegistry: mergeKhmdhsDocumentRegistry(
        prev.khmdhsDocumentRegistry,
        selected,
        chainFetchedAt
      ),
      ...(neverAsk ? { khmdhsDocumentRegistryDismissed: true } : {}),
    }));
    setKhmdhsRegistryModal(null);
    showToast(
      `Καταγράφηκαν ${selected.length} έγγραφ${selected.length === 1 ? 'ο' : 'α'} ΚΗΜΔΗΣ. Αποθηκεύστε το υποέργο.`,
      'success'
    );
  };

  const handleRelatedDocsConfirm = (picked) => {
    const entries = (picked || [])
      .map(({ candidate, preview, linkLabel }) => buildRelatedDocumentEntry(candidate, {
        linkLabel,
        preview,
      }))
      .filter(Boolean);
    if (!entries.length) {
      setRelatedDocsModal(null);
      return;
    }
    setFormData((prev) => ({
      ...prev,
      khmdhsRelatedDocuments: mergeKhmdhsRelatedDocuments(
        prev.khmdhsRelatedDocuments,
        entries
      ),
    }));
    setRelatedDocsModal(null);
    showToast(
      `Καταγράφηκαν ${entries.length} σχετικ${entries.length === 1 ? 'ό' : 'ά'} έγγραφ${entries.length === 1 ? 'ο' : 'α'} ΚΗΜΔΗΣ. Αποθηκεύστε το υποέργο.`,
      'success'
    );
  };

  return (
    <>
    <FormOverlay
      ref={formOverlayRef}
      data-project-form-modal
      onClick={(e) => e.target === e.currentTarget && handleRequestClose()}
    >
      <FormContainer>
        {isSaving && (
          <FormProcessingOverlay>
            <KhmdhsFetchOverlayCard>
              <FetchSpinner $large />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#3730a3', marginBottom: '0.25rem' }}>
                  {saveStatusText}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: 500 }}>
                  Παρακαλώ περιμένετε — η διαδικασία μπορεί να διαρκέσει λίγα δευτερόλεπτα
                </div>
              </div>
            </KhmdhsFetchOverlayCard>
          </FormProcessingOverlay>
        )}
        {/* Header */}
        <FormHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <FormTitle style={{ margin: 0, fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
              {(editingProject || formData.subprojectId) ? 'Επεξεργασία υποέργου' : 'Νέο υποέργο'}
            </FormTitle>
            <FormHeaderClose type="button" onClick={handleRequestClose} disabled={isSaving} aria-label="Κλείσιμο">
              ×
            </FormHeaderClose>
          </div>
          <PhaseTabStrip>
            <PhaseTab
              type="button"
              $active={activePhaseTab === 'A'}
              onClick={() => setActivePhaseTab('A')}
            >
              <PhaseTabDot $color={phaseADirty ? '#fbbf24' : manualPhaseSavedOnce ? '#4ade80' : 'rgba(255,255,255,0.45)'} />
              Α — Στοιχεία
            </PhaseTab>
            <PhaseTab
              type="button"
              $active={activePhaseTab === 'B'}
              disabled={!manualPhaseSavedOnce}
              onClick={() => manualPhaseSavedOnce && setActivePhaseTab('B')}
            >
              {!manualPhaseSavedOnce
                ? <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>🔒</span>
                : <PhaseTabDot $color={khmdhsHasChainData ? '#4ade80' : 'rgba(255,255,255,0.45)'} />}
              Β — ΚΗΜΔΗΣ
            </PhaseTab>
          </PhaseTabStrip>
          <KhmdhsFetchBar $active={khmdhsChainFetchTarget !== null} />
        </FormHeader>

        <FormScrollArea ref={formScrollRef} $phaseB={activePhaseTab === 'B'}>

          {/* Overlay ανάκτησης ΚΗΜΔΗΣ — εμφανίζεται πάνω από όλο το περιεχόμενο */}
          {khmdhsChainFetchTarget !== null && (
            <KhmdhsFetchOverlay>
              <KhmdhsFetchOverlayCard>
                <FetchSpinner $large />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#3730a3', marginBottom: '0.25rem' }}>
                    Ανάκτηση από ΚΗΜΔΗΣ…
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: 500 }}>
                    Παρακαλώ περιμένετε — η εφαρμογή επικοινωνεί με το ΚΗΜΔΗΣ
                  </div>
                </div>
              </KhmdhsFetchOverlayCard>
            </KhmdhsFetchOverlay>
          )}

          {/* ══ ΦΑΣΗ Α ══ */}
          {activePhaseTab === 'A' && (
          <PhaseALayout>

          {/* ── SECTION 1: Τίτλοι ── */}
          <Section $flat $fullWidth $accent="#4f46e5" $bg="#f8f9ff">
            <SectionTitle $nobar $color="#4f46e5">📋 Στοιχεία Έργου & Υποέργου</SectionTitle>
            <FormGrid cols={2}>
              <FormGroup fullWidth cols={2}>
                <Label>Τίτλος Έργου / Τίτλος Πράξης *</Label>
                <Input
                  type="text"
                  value={formData.projectTitle}
                  onChange={(e) => handleInputChange('projectTitle', e.target.value)}
                  placeholder="Εισάγετε τίτλο έργου ή πράξης"
                />
                {errors.projectTitle && <ErrorMessage>{errors.projectTitle}</ErrorMessage>}
              </FormGroup>
              <FormGroup fullWidth cols={2}>
                <Label>Τίτλος Υποέργου *</Label>
                <Input
                  type="text"
                  value={formData.subprojectTitle}
                  onChange={(e) => handleInputChange('subprojectTitle', e.target.value)}
                  placeholder="Εισάγετε τίτλο υποέργου"
                />
                {errors.subprojectTitle && <ErrorMessage>{errors.subprojectTitle}</ErrorMessage>}
              </FormGroup>
            </FormGrid>
          </Section>

          {/* ── SECTION 2: Κωδικοί ── */}
          <Section $flat $accent="#7c3aed" $bg="#f6f4ff">
            <SectionTitle $nobar $color="#7c3aed">🔢 Κωδικοί</SectionTitle>
            <FormGrid cols={2}>
              <FormGroup>
                <Label>Μορφή Υλοποίησης{manualPhaseSavedOnce && !phaseADirty ? ' *' : ''}</Label>
                <Select
                  value={formData.implementationForm}
                  onChange={(e) => handleInputChange('implementationForm', e.target.value)}
                >
                  <option value="">Επιλέξτε μορφή (ή αφήστε κενό για αυτόματο από ΚΗΜΔΗΣ)</option>
                  {IMPLEMENTATION_FORMS.map(form => (
                    <option key={form} value={form}>{form}</option>
                  ))}
                </Select>
                {!formData.implementationForm && phaseBEditable && showKhmdhsChainPanel && (
                  <FieldHint style={{ marginTop: '0.35rem' }}>
                    Μπορείτε να αφήσετε κενό· θα συμπληρωθεί αυτόματα με την πρώτη ανάκτηση ΑΔΑΜ.
                  </FieldHint>
                )}
                {errors.implementationForm && <ErrorMessage>{errors.implementationForm}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Κωδικός ΚΑ (προαιρετικό)</Label>
                <Input
                  type="text"
                  value={formData.kaCode}
                  onChange={(e) => handleInputChange('kaCode', e.target.value)}
                  onBlur={() => handleFieldBlur('kaCode')}
                  disabled={formData.noKaCode}
                  placeholder="xx-xxxx.xxx"
                  maxLength="11"
                  $hasError={!!errors.kaCode}
                  $isValid={!errors.kaCode && formData.kaCode && validateKACode(formData.kaCode)}
                  $touched={touched.kaCode}
                />
                <CheckboxContainer style={{ marginTop: '0.4rem', padding: '0.5rem 0.7rem' }}>
                  <Checkbox
                    type="checkbox"
                    checked={formData.noKaCode}
                    onChange={(e) => handleNoKACodeChange(e.target.checked)}
                  />
                  <CheckboxLabel>Δεν υπάρχει ΚΑ</CheckboxLabel>
                </CheckboxContainer>
                {errors.kaCode && <ErrorMessage>{errors.kaCode}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Κωδ. Α.Λ.Ε.</Label>
                <AleCodesContainer>
                  {formData.aleCodes && formData.aleCodes.length > 0 ? (
                    formData.aleCodes.map((code, index) => (
                      <AleCodeItem key={index}>
                        <AleCodeInput
                          type="text"
                          value={code}
                          onChange={(e) => handleAleCodeChange(index, e.target.value)}
                          placeholder={`Α.Λ.Ε. ${index + 1}`}
                          maxLength="50"
                        />
                        <RemoveAleButton type="button" onClick={() => handleRemoveAleCode(index)} title="Αφαίρεση">✕</RemoveAleButton>
                      </AleCodeItem>
                    ))
                  ) : (
                    <MutedText>Δεν έχουν προστεθεί κωδικοί Α.Λ.Ε.</MutedText>
                  )}
                  <AddAleButton type="button" onClick={handleAddAleCode}>+ Προσθήκη Α.Λ.Ε.</AddAleButton>
                </AleCodesContainer>
              </FormGroup>

              <FormGroup>
                <Label>Όνομα Κωδικού Πράξης</Label>
                <Input
                  type="text"
                  value={formData.misPraxhsName}
                  onChange={(e) => handleInputChange('misPraxhsName', e.target.value)}
                  placeholder="π.χ. MIS (προαιρετικό)"
                />
                {errors.misPraxhsName && <ErrorMessage>{errors.misPraxhsName}</ErrorMessage>}
              </FormGroup>

              <FormGroup>
                <Label>Κωδικός Πράξης</Label>
                <Input
                  type="text"
                  value={formData.misPraxhsCode}
                  onChange={(e) => handleInputChange('misPraxhsCode', e.target.value)}
                  placeholder="Τιμή κωδικού (προαιρετικό)"
                />
                {errors.misPraxhsCode && <ErrorMessage>{errors.misPraxhsCode}</ErrorMessage>}
              </FormGroup>
            </FormGrid>
          </Section>

          {/* ── SECTION 3: Χρηματοδότηση & Ποσά ── */}
          <Section $flat $accent="#059669" $bg="#f0fdf6">
            <SectionTitle $nobar $color="#059669">💰 Χρηματοδότηση & Ποσά</SectionTitle>
            <FormGrid cols={2}>
              <FormGroup>
                <Label>Είδος *</Label>
                <Select
                  value={formData.projectType}
                  onChange={(e) => handleInputChange('projectType', e.target.value)}
                >
                  <option value="">Επιλέξτε είδος</option>
                  {PROJECT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </Select>
                {errors.projectType && <ErrorMessage>{errors.projectType}</ErrorMessage>}
              </FormGroup>

              <FormGroup fullWidth cols={2}>
                <CheckboxContainer style={{ marginTop: 0, marginBottom: '0.25rem' }}>
                  <Checkbox
                    type="checkbox"
                    id="coFinanced"
                    checked={!!formData.coFinanced}
                    onChange={(e) => handleCoFinancedToggle(e.target.checked)}
                  />
                  <Label htmlFor="coFinanced" style={{ margin: 0, cursor: 'pointer' }}>
                    Συγχρηματοδοτούμενο υποέργο (πολλαπλές πηγές χρηματοδότησης)
                  </Label>
                </CheckboxContainer>
              </FormGroup>

              {!formData.coFinanced && (
                <>
                  <FormGroup>
                    <Label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Βασική Πηγή Χρηματοδότησης *</span>
                      {canManageFunding && (
                        <button
                          type="button"
                          title="Διαχείριση βασικών πηγών"
                          onClick={() => { setFundingModalTab('sources'); setFundingModalSource(null); setShowFundingModal(true); }}
                          style={{ background: 'none', border: '1px solid #c7d2fe', borderRadius: '6px', color: '#6366f1', fontSize: '0.75rem', padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }}
                        >
                          ⚙ Διαχείριση
                        </button>
                      )}
                    </Label>
                    <Select
                      value={formData.fundingSource}
                      onChange={(e) => handleFundingSourceChange(e.target.value)}
                    >
                      <option value="">Επιλέξτε πηγή</option>
                      {visibleFundingSources.map(src => (
                        <option key={src.value} value={src.value}>{src.label}</option>
                      ))}
                    </Select>
                    {errors.fundingSource && <ErrorMessage>{errors.fundingSource}</ErrorMessage>}
                  </FormGroup>

                  <FormGroup>
                    <Label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Εξειδίκευση Πηγής *</span>
                      {canManageFunding && formData.fundingSource && (
                        <button
                          type="button"
                          title="Διαχείριση εξειδικεύσεων"
                          onClick={() => { setFundingModalTab('details'); setFundingModalSource(formData.fundingSource); setShowFundingModal(true); }}
                          style={{ background: 'none', border: '1px solid #c7d2fe', borderRadius: '6px', color: '#6366f1', fontSize: '0.75rem', padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }}
                        >
                          ⚙ Διαχείριση
                        </button>
                      )}
                    </Label>
                    <Select
                      value={formData.fundingDetails}
                      onChange={(e) => handleInputChange('fundingDetails', e.target.value)}
                      disabled={!formData.fundingSource}
                    >
                      <option value="">Επιλέξτε εξειδίκευση</option>
                      {visibleFundingDetails.map(det => (
                        <option key={det.value} value={det.value}>{det.label}</option>
                      ))}
                    </Select>
                    {errors.fundingDetails && <ErrorMessage>{errors.fundingDetails}</ErrorMessage>}
                  </FormGroup>

                  <FormGroup>
                    <Label>Εγκεκριμένο Ποσό *</Label>
                    <Input
                      type="text"
                      value={formData.approvedAmount}
                      onChange={(e) => handleInputChange('approvedAmount', e.target.value)}
                      onBlur={() => { handleAmountBlur('approvedAmount'); handleFieldBlur('approvedAmount'); }}
                      placeholder="π.χ. 25.254,25"
                      $hasError={!!errors.approvedAmount}
                      $isValid={!errors.approvedAmount && formData.approvedAmount && validateField('approvedAmount', formData.approvedAmount) === null}
                      $touched={touched.approvedAmount}
                    />
                    {errors.approvedAmount && <ErrorMessage>{errors.approvedAmount}</ErrorMessage>}
                  </FormGroup>
                </>
              )}

              {formData.coFinanced && (
                <FormGroup fullWidth cols={2}>
                  <Label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Πηγές Χρηματοδότησης *</span>
                    {canManageFunding && (
                      <button
                        type="button"
                        title="Διαχείριση βασικών πηγών"
                        onClick={() => { setFundingModalTab('sources'); setFundingModalSource(null); setShowFundingModal(true); }}
                        style={{ background: 'none', border: '1px solid #c7d2fe', borderRadius: '6px', color: '#6366f1', fontSize: '0.75rem', padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        ⚙ Διαχείριση
                      </button>
                    )}
                  </Label>
                  <MutedText style={{ marginBottom: '0.6rem' }}>
                    Όρισε κάθε βασική πηγή με την εξειδίκευση και το ποσό της. Το εγκεκριμένο ποσό προκύπτει αυτόματα από το άθροισμα, εξαιρώντας τις γραμμές «ίδιοι πόροι».
                  </MutedText>
                  {(formData.fundingSources || []).length === 0 && (
                    <MutedText>Δεν έχουν προστεθεί πηγές χρηματοδότησης.</MutedText>
                  )}
                  {(formData.fundingSources || []).map((row, index) => (
                    <div key={index} style={{ border: '1px solid #d1fae5', background: '#fff', borderRadius: '8px', padding: '0.6rem', marginBottom: '0.6rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <Label style={{ fontSize: '0.8rem' }}>Βασική Πηγή</Label>
                          <Select value={row.source || ''} onChange={(e) => handleFundingSourceRowChange(index, 'source', e.target.value)}>
                            <option value="">Επιλέξτε πηγή</option>
                            {visibleFundingSources.map(src => (
                              <option key={src.value} value={src.value}>{src.label}</option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <Label style={{ fontSize: '0.8rem' }}>Εξειδίκευση</Label>
                          <Select value={row.details || ''} onChange={(e) => handleFundingSourceRowChange(index, 'details', e.target.value)} disabled={!row.source}>
                            <option value="">Επιλέξτε εξειδίκευση</option>
                            {(fundingOptions.details[row.source] || []).filter(d => !d.hidden).map(det => (
                              <option key={det.value} value={det.value}>{det.label}</option>
                            ))}
                          </Select>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.8rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 160px' }}>
                          <Label style={{ fontSize: '0.8rem' }}>
                            Ποσό{row.ownResources ? <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>(ίδιοι πόροι — εκτός εγκεκριμένου)</span> : null}
                          </Label>
                          <Input type="text" value={row.amount || ''} onChange={(e) => handleFundingSourceRowChange(index, 'amount', e.target.value)} onBlur={() => handleFundingSourceRowAmountBlur(index)} placeholder="π.χ. 25.254,25" style={row.ownResources ? { background: '#fef3c7', color: '#92400e' } : {}} />
                        </div>
                        <RemoveAleButton type="button" onClick={() => handleRemoveFundingSource(index)} title="Αφαίρεση πηγής">✕</RemoveAleButton>
                      </div>
                    </div>
                  ))}
                  <AddAleButton type="button" onClick={handleAddFundingSource}>+ Προσθήκη Πηγής Χρηματοδότησης</AddAleButton>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.8rem', paddingTop: '0.7rem', borderTop: '2px solid #059669' }}>
                    <span style={{ minWidth: '150px', fontSize: '0.9rem', fontWeight: 700, color: '#065f46' }}>Εγκεκριμένο Ποσό:</span>
                    <Input type="text" value={formData.approvedAmount} disabled placeholder="Αυτόματος υπολογισμός" style={{ flex: 1, background: '#d1fae5', fontWeight: 700, color: '#065f46', cursor: 'not-allowed' }} />
                  </div>
                  <MutedText style={{ marginTop: '0.3rem' }}>= άθροισμα ποσών, εξαιρώντας γραμμές με εξειδίκευση «1099. ΙΔΙΟΙ ΠΟΡΟΙ».</MutedText>
                  {errors.approvedAmount && <ErrorMessage>{errors.approvedAmount}</ErrorMessage>}
                  {errors.fundingSources && <ErrorMessage>{errors.fundingSources}</ErrorMessage>}
                </FormGroup>
              )}

              {/* Υπόλοιπα */}
              {formData.aleCodes && formData.aleCodes.length >= 1 ? (
                <FormGroup fullWidth cols={2}>
                  <Label>Υπόλοιπα για το Έτος ανά Α.Λ.Ε.</Label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
                    <span style={{ fontSize: '0.82rem', color: '#666' }}>Έτος:</span>
                    <Select value={formData.remainingAmountYear} onChange={(e) => handleInputChange('remainingAmountYear', e.target.value)} style={{ minWidth: '90px' }}>
                      {Array.from({ length: 10 }, (_, i) => { const y = 2026 + i; return <option key={y} value={y.toString()}>{y}</option>; })}
                    </Select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.5rem' }}>
                    {formData.aleCodes.map((aleCode, index) => (
                      <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ minWidth: '110px', fontSize: '0.8rem', fontWeight: 600, color: '#1976d2', background: '#e3f2fd', padding: '0.35rem 0.5rem', borderRadius: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {aleCode || `Α.Λ.Ε. ${index + 1}`}
                        </span>
                        <Input type="text" value={(formData.aleRemainingAmounts || [])[index] || ''} onChange={(e) => handleAleRemainingAmountChange(index, e.target.value)} onBlur={() => handleAleRemainingAmountBlur(index)} placeholder="π.χ. 5.000,00" style={{ flex: 1 }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.7rem', paddingTop: '0.7rem', borderTop: '2px solid #28a745' }}>
                    <span style={{ minWidth: '110px', fontSize: '0.85rem', fontWeight: 700, color: '#155724' }}>Σύνολο:</span>
                    <Input type="text" value={formData.remainingAmount} disabled placeholder="Αυτόματος υπολογισμός" style={{ flex: 1, background: '#d4edda', fontWeight: 700, color: '#155724', cursor: 'not-allowed' }} />
                  </div>
                  {errors.remainingAmount && <ErrorMessage>{errors.remainingAmount}</ErrorMessage>}
                </FormGroup>
              ) : (
                <FormGroup>
                  <Label>Υπόλοιπα για το Έτος</Label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Input type="text" value={formData.remainingAmount} onChange={(e) => handleInputChange('remainingAmount', e.target.value)} onBlur={() => handleAmountBlur('remainingAmount')} placeholder="π.χ. 5.000,00" style={{ flex: 1 }} />
                    <Select value={formData.remainingAmountYear} onChange={(e) => handleInputChange('remainingAmountYear', e.target.value)} style={{ minWidth: '80px' }}>
                      {Array.from({ length: 10 }, (_, i) => { const y = 2026 + i; return <option key={y} value={y.toString()}>{y}</option>; })}
                    </Select>
                  </div>
                  {errors.remainingAmount && <ErrorMessage>{errors.remainingAmount}</ErrorMessage>}
                </FormGroup>
              )}

              <FormGroup>
                <Label>Σχόλια Υπολοίπων</Label>
                <TextArea value={formData.remainingAmountComments} onChange={(e) => handleInputChange('remainingAmountComments', e.target.value)} placeholder="Σχόλια για τα υπόλοιπα..." rows={2} style={{ minHeight: '56px' }} />
              </FormGroup>
            </FormGrid>
          </Section>

          {/* ── SECTION 4: Σχόλια ── */}
          <Section $flat $accent="#d97706" $bg="#fffcf0">
            <SectionTitle $nobar $color="#d97706">💬 Σχόλια και αναφορές</SectionTitle>
            <FormGrid cols={1}>
              <FormGroup fullWidth cols={3}>
                <Label>Σχόλια</Label>
                <TextArea
                  value={formData.comments}
                  onChange={(e) => handleInputChange('comments', e.target.value)}
                  placeholder="Γενικά σχόλια για το υποέργο..."
                  rows={3}
                />
              </FormGroup>
              <FormGroup fullWidth cols={3}>
                <Label>Αναφορά από πρόγραμμα Οικονομικής</Label>
                <TextArea
                  value={formData.eisigitikiEkthesi || ''}
                  onChange={(e) => handleInputChange('eisigitikiEkthesi', e.target.value)}
                  placeholder="Κείμενο αναφοράς από πρόγραμμα Οικονομικής..."
                  rows={5}
                  style={{ minHeight: '100px' }}
                />
              </FormGroup>
            </FormGrid>
          </Section>

          {/* ── SECTION 5: Μηχανικοί ── */}
          <Section $flat $accent="#0d9488" $bg="#f0fdfa">
            <SectionTitle $nobar $color="#0d9488">👷 Μηχανικοί & Χρέωση</SectionTitle>
            <FormGrid cols={1}>
              <FormGroup fullWidth cols={3}>
                <Label>Χρέωση από κατάλογο μηχανικών (προαιρετικό)</Label>
                <CheckboxContainer style={{ marginTop: 0, marginBottom: '0.75rem' }}>
                  <Checkbox
                    type="checkbox"
                    id="supervisorChargeOutsideEngineers"
                    checked={!!formData.supervisorChargeOutsideEngineers}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setFormData((prev) => ({
                        ...prev,
                        supervisorChargeOutsideEngineers: on,
                        ...(on
                          ? { supervisorEngineerIds: [] }
                          : {
                              supervisorChargeFreePrimary: '',
                              supervisorChargeFreeParticipants: ''
                            })
                      }));
                    }}
                  />
                  <CheckboxLabel htmlFor="supervisorChargeOutsideEngineers">Χρέωση εκτός μηχανικών</CheckboxLabel>
                </CheckboxContainer>

                {!formData.supervisorChargeOutsideEngineers ? (
                  <>
                    <EngineerPickGrid>
                      <EngineerPickCard>
                        <EngineerPickCardTitle>Επιβλέπων / Επιβλέπουσα (κατάλογος)</EngineerPickCardTitle>
                        <Select
                          value={primaryEngineerId}
                          onChange={(e) => {
                            const newPrimary = e.target.value;
                            const aux = auxiliaryEngineerIds.filter((x) => x !== newPrimary);
                            setFormData((prev) => ({
                              ...prev,
                              supervisorEngineerIds: mergeSupervisorEngineerIds(newPrimary, aux)
                            }));
                          }}
                        >
                          <option value="">— Καμία επιλογή —</option>
                          {(registeredEngineers || []).map((eng) => (
                            <option key={eng.id} value={eng.id}>
                              {eng.fullName}
                            </option>
                          ))}
                        </Select>
                        {registeredEngineers.length === 0 && (
                          <FieldHint style={{ marginTop: '0.5rem' }}>
                            Δεν υπάρχουν διαθέσιμοι μηχανικοί. Ορίστε χρήστες με ρόλο «Μηχανικός» στη Διαχείριση χρηστών.
                          </FieldHint>
                        )}
                      </EngineerPickCard>

                      <EngineerPickCard>
                        <EngineerPickCardTitle>Συμμετέχουν (κατάλογος)</EngineerPickCardTitle>
                        <AuxiliaryParticipantBlock>
                          {auxiliaryEngineerOptions.length === 0 ? (
                            <AuxiliaryEmpty>
                              {registeredEngineers.length === 0
                                ? 'Κενός κατάλογος.'
                                : registeredEngineers.length <= 1
                                  ? 'Μόνο ένας μηχανικός στον κατάλογο.'
                                  : 'Δεν υπάρχουν άλλοι διαθέσιμοι (εξαιρείται ο/η επιβλέπων/ουσα).'}
                            </AuxiliaryEmpty>
                          ) : (
                            <>
                              {auxiliaryAddDropdownOptions.length > 0 ? (
                                <Select
                                  key={auxPickerKey}
                                  defaultValue=""
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v) addAuxiliaryEngineerFromPicker(v);
                                  }}
                                  aria-label="Προσθήκη συμμετέχοντος από κατάλογο"
                                >
                                  <option value="">— Προσθήκη συμμετέχοντος —</option>
                                  {auxiliaryAddDropdownOptions.map((eng) => (
                                    <option key={eng.id} value={eng.id}>
                                      {eng.fullName}
                                    </option>
                                  ))}
                                </Select>
                              ) : (
                                <AuxiliaryEmpty>Όλοι οι διαθέσιμοι μηχανικοί έχουν προστεθεί ως συμμετέχοντες.</AuxiliaryEmpty>
                              )}
                              <AuxiliaryChips>
                                {auxiliaryEngineerIds.map((id) => (
                                  <AuxiliaryChip key={id}>
                                    <AuxiliaryChipName title={labelForEngineerId(id)}>
                                      {labelForEngineerId(id)}
                                    </AuxiliaryChipName>
                                    <AuxiliaryChipRemove
                                      type="button"
                                      aria-label={`Αφαίρεση ${labelForEngineerId(id)}`}
                                      onClick={() => toggleAuxiliaryEngineer(id)}
                                    >
                                      ×
                                    </AuxiliaryChipRemove>
                                  </AuxiliaryChip>
                                ))}
                              </AuxiliaryChips>
                            </>
                          )}
                        </AuxiliaryParticipantBlock>
                      </EngineerPickCard>
                    </EngineerPickGrid>
                    <FieldHint style={{ marginTop: '0.5rem' }}>
                      Επιβλέπων/επιβλέπουσα από το αριστερό πεδίο· συμμετέχοντες με προσθήκη από τη λίστα. Για χρέωση σε άλλη υπηρεσία, τικάρετε «Χρέωση εκτός μηχανικών».
                    </FieldHint>
                  </>
                ) : (
                  <>
                    <Label>Χρέωση (ελεύθερο κείμενο)</Label>
                    <TextArea
                      value={formData.supervisorChargeFreePrimary}
                      onChange={(e) => handleInputChange('supervisorChargeFreePrimary', e.target.value)}
                      placeholder="π.χ. Υπηρεσία, υπεύθυνος από άλλη υπηρεσία..."
                      rows={4}
                      style={{ minHeight: '100px' }}
                    />
                  </>
                )}
              </FormGroup>
            </FormGrid>
          </Section>

          {/* ── SECTION 6: Κατάσταση (τελευταίο πεδίο Φάσης Α) ── */}
          <Section $flat $fullWidth $accent="#dc2626" $bg="#fff5f5">
            <SectionTitle $nobar $color="#dc2626">📌 Κατάσταση Έργου</SectionTitle>
            <FormGrid cols={2}>
              <FormGroup>
                <Label>Κατάσταση Έργου *</Label>
                <Select
                  value={formData.projectStatus}
                  onChange={(e) => handleInputChange('projectStatus', e.target.value)}
                >
                  <option value="">Επιλέξτε κατάσταση</option>
                  {PROJECT_STATUSES.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </Select>
                {errors.projectStatus && <ErrorMessage>{errors.projectStatus}</ErrorMessage>}
              </FormGroup>
              {phaseADirty && manualPhaseSavedOnce && (
                <FormGroup>
                  <PhaseLockedBanner style={{ marginTop: '1.5rem' }}>
                    ⚠️ Υπάρχουν μη αποθηκευμένες αλλαγές στη Φάση Α. Αποθηκεύστε για να επεξεργαστείτε τη Φάση Β.
                  </PhaseLockedBanner>
                </FormGroup>
              )}
            </FormGrid>
          </Section>

          </PhaseALayout>
          )}

          {/* ══ ΦΑΣΗ Β ══ */}
          {activePhaseTab === 'B' && (
          <KhmdhsPhaseShell>
            <KhmdhsPendingFab
              review={formData.khmdhsDataQualityReview}
              formData={formData}
              onOpenReview={openKhmdhsDataReview}
            />
            {renderKhmdhsLegacyUpgradeBanner()}
            {!phaseBEditable && (
              <PhaseLockedBanner>
                🔒 {manualPhaseSavedOnce
                  ? 'Αποθηκεύστε τις αλλαγές της Φάσης Α για να ξεκλειδώσετε τη Φάση Β.'
                  : 'Αποθηκεύστε πρώτα τη Φάση Α (χειροκίνητα στοιχεία) για να ανοίξει η Φάση Β.'}
              </PhaseLockedBanner>
            )}
            {isMaturationStatus && phaseBEditable && (
              <PhaseLockedBanner style={{ background: '#ecfdf5', borderColor: '#6ee7b7', color: '#065f46' }}>
                ℹ️ Στην «Υπό ωρίμανση» δεν απαιτείται ΑΔΑΜ. Μπορείτε να φορτώσετε αρχεία από τη σταθερή γραμμή στο κάτω μέρος.
              </PhaseLockedBanner>
            )}
            {isAbandonedStatus && (
              <PhaseLockedBanner style={{ background: '#f1f5f9', borderColor: '#cbd5e1', color: '#475569' }}>
                Το υποέργο είναι απενταγμένο — τα δεδομένα ΚΗΜΔΗΣ παραμένουν ως είχαν.
              </PhaseLockedBanner>
            )}

            <KhmdhsPhaseInner $locked={!phaseBEditable}>
          <KhmdhsLifecycleRail project={formData} variant="slim" />

          {/* ── SECTION 7: ΚΉΜΔΗΣ action strip ── */}
          {!showPhaseBKhmdhs && phaseBEditable && hasPhaseBData && !isAbandonedStatus && (
            <ActionStrip>
              <StripRow>
                <StripBrand>
                  <StripBrandIcon>↺</StripBrandIcon>
                  Φάση Β
                </StripBrand>
                <StripDivider />
                <StripMeta>
                  <StripStatusDot />
                  <StripStatusLabel>Υπάρχουν στοιχεία από προηγούμενες ανακτήσεις</StripStatusLabel>
                </StripMeta>
                <StripDivider />
                <PhaseBResetBtn
                  type="button"
                  onClick={handleResetPhaseB}
                  title="Διαγραφή όλων των δεδομένων Φάσης Β και νέα αρχή"
                >
                  ↺ Επαναφορά Φάσης Β
                </PhaseBResetBtn>
              </StripRow>
            </ActionStrip>
          )}
          {renderKhmdhsActionStrip()}
          {renderSymvPlannerResumeBanner()}
          {renderKhmdhsSharedPanel()}
          {phaseBEditable && (
            <KhmdhsRemovableChainEntries
              formData={formData}
              onRemove={handleRemoveChainHistoryEntry}
            />
          )}

          {/* ── Πεδία φόρμας (διαδικασία, σύμβαση κ.λπ.) ── */}
          {statusShowsAssignmentProcedure(formData.projectStatus) && (
          <Section $flat $accent="#6366f1" $bg="#eef0ff">
          <FormGrid cols={3}>
          {statusShowsAssignmentProcedure(formData.projectStatus) && !hideManualAssignmentProcedure && (
                  renderKhmdhsFieldAnchor('khmdhs-assignment-procedure', (
                  <FormGroup fullWidth cols={3}>
                    <Label>
                      Διαδικασία Ανάθεσης *
                      {hasFieldOverride(formData, 'assignmentProcedure') && <KhmdhsFieldOverrideBadge />}
                    </Label>
                    {renderKhmdhsReviewHint('assignmentProcedure')}
                    <Select
                      value={formData.assignmentProcedure || ''}
                      onChange={(e) => handleInputChange('assignmentProcedure', e.target.value)}
                    >
                      <option value="">Επιλέξτε διαδικασία ανάθεσης</option>
                      {ASSIGNMENT_PROCEDURES.map((procedure) => (
                        <option key={procedure} value={procedure}>{procedure}</option>
                      ))}
                    </Select>
                    {errors.assignmentProcedure && (
                      <ErrorMessage style={{ marginTop: '0.45rem' }}>{errors.assignmentProcedure}</ErrorMessage>
                    )}
                    {noticeHasFetchedData && !khmdhsResolvedProcedure ? (
                      <ComplianceAlert $warn={false} style={{ marginTop: '0.65rem' }}>
                        <ComplianceAlertTitle>ℹ️ Δεν αντιστοιχίστηκε αυτόματα από ΚΗΜΔΗΣ</ComplianceAlertTitle>
                        {noticeKhmdhsNoticeType
                          ? `Ο τύπος δημοσίευσης «${noticeKhmdhsNoticeType}» δεν περιλαμβάνει διαδικασία ανάθεσης που να αντιστοιχεί στη λίστα της εφαρμογής. Επιλέξτε από τη λίστα.`
                          : 'Το ΚΗΜΔΗΣ δεν επέστρεψε τύπο διαδικασίας για αυτόν τον ΑΔΑΜ. Επιλέξτε από τη λίστα.'}
                      </ComplianceAlert>
                    ) : !khmdhsHasChainData ? (
                      <FieldHint style={{ marginTop: '0.35rem' }}>
                        {isMultiContracts
                          ? 'Θα συμπληρωθεί αυτόματα μετά την ανάκτηση ΑΔΑΜ σύμβασης.'
                          : 'Θα συμπληρωθεί αυτόματα αφού πατήσετε «Ανάκτηση» στο πεδίο ΑΔΑΜ αλυσίδας.'}
                      </FieldHint>
                    ) : null}
                    {directAssignmentCompliance.applicable && directAssignmentCompliance.missingData && (
                      <ComplianceAlert $warn={false}>
                        <ComplianceAlertTitle>ℹ️ Έλεγχος 12μήνου απευθείας ανάθεσης</ComplianceAlertTitle>
                        {directAssignmentCompliance.message}
                      </ComplianceAlert>
                    )}
                    {directAssignmentCompliance.violations?.length > 0 && (
                      <ComplianceAlert $warn>
                        <ComplianceAlertTitle>⚠️ Πιθανή παράβαση κανόνα 12 μηνών</ComplianceAlertTitle>
                        {directAssignmentCompliance.violations.map((v, idx) => (
                          <div key={idx} style={{ marginTop: idx > 0 ? '0.5rem' : 0 }}>
                            {formatViolationSummary(v)}
                          </div>
                        ))}
                      </ComplianceAlert>
                    )}
                  </FormGroup>
                  ))
              )}

              {statusShowsAssignmentProcedure(formData.projectStatus) && noticeProcedureAutoFilled && directAssignmentCompliance.violations?.length > 0 && (
                <FormGroup fullWidth cols={3}>
                  <ComplianceAlert $warn>
                    <ComplianceAlertTitle>⚠️ Πιθανή παράβαση κανόνα 12 μηνών</ComplianceAlertTitle>
                    {directAssignmentCompliance.violations.map((v, idx) => (
                      <div key={idx} style={{ marginTop: idx > 0 ? '0.5rem' : 0 }}>
                        {formatViolationSummary(v)}
                      </div>
                    ))}
                  </ComplianceAlert>
                </FormGroup>
              )}

              {statusShowsAssignmentProcedure(formData.projectStatus) && !hideManualProcessStart && (
                renderKhmdhsFieldAnchor('khmdhs-process-start', (
                <FormGroup>
                  {renderFieldLabel('Ημερ. Έναρξης Διαδικασίας Σύμβασης', khmdhsProcessDateAutoFilled, 'contractProcessStartDate')}
                  {renderKhmdhsReviewHint('contractProcessStartDate')}
                  <Input
                    type="date"
                    value={formData.contractProcessStartDate || ''}
                    onChange={(e) => handleInputChange('contractProcessStartDate', e.target.value)}
                    readOnly={hideManualProcessStart}
                    disabled={hideManualProcessStart}
                  />
                  {errors.contractProcessStartDate && <ErrorMessage>{errors.contractProcessStartDate}</ErrorMessage>}
                </FormGroup>
                ))
              )}

          </FormGrid>
          </Section>
          )}

          {showPhaseBKhmdhs && projectHasKhmdhsFormResults(formData) && (
            <>
              {renderKhmdhsFieldAnchor('khmdhs-chain-history', (
                <>
                  <KhmdhsFormStageResults
                    project={formData}
                    canEditApe={canEditKhmdhsApe}
                    onOpenApeEntry={handleOpenApeEntry}
                    onOpenManualExtension={handleOpenManualExtension}
                  />
                  <KhmdhsUserEditsPanel
                    formData={formData}
                    onRevert={handleRevertKhmdhsFieldOverride}
                    onCommentChange={handleKhmdhsOverrideCommentChange}
                  />
                </>
              ))}
              {showManualProjectBudget && (
                renderKhmdhsFieldAnchor('khmdhs-project-budget', (
                <FormGroup fullWidth cols={3} style={{ marginTop: '0.65rem' }}>
                  {renderFieldLabel('Προϋπολογισμός αιτήματος (με ΦΠΑ) *', false, 'projectBudget')}
                  {renderKhmdhsReviewHint('projectBudget')}
                  <FieldHint style={{ marginBottom: '0.35rem' }}>
                    Δεν βρέθηκε πλήρως στο ΚΗΜΔΗΣ — συμπληρώστε το ποσό από το πρωτογενές αίτημα.
                  </FieldHint>
                  <Input
                    type="text"
                    value={formData.projectBudget || ''}
                    onChange={(e) => handleInputChange('projectBudget', e.target.value)}
                    onBlur={() => handleAmountBlur('projectBudget')}
                    placeholder="π.χ. 150.000,00"
                  />
                  {errors.projectBudget && <ErrorMessage>{errors.projectBudget}</ErrorMessage>}
                </FormGroup>
                ))
              )}
              {!showManualProjectBudget && errors.projectBudget && (
                <ErrorMessage style={{ marginTop: '-0.35rem' }}>{errors.projectBudget}</ErrorMessage>
              )}
            </>
          )}

          {/* ── SECTION 8: Στοιχεία Σύμβασης (χωρίς διπλό SYMV όταν η αλυσίδα το καλύπτει) ── */}
          {showContractFields && !hideLegacyContractSection && (
            <Section $flat $accent="#6366f1" $bg="#f4f6ff">
              <SectionTitle $nobar $color="#4338ca">📝 {hideManualContractCore ? 'ΑΠΕ & ΣΤΟΙΧΕΙΑ ΕΦΑΡΜΟΓΗΣ' : 'Στοιχεία Σύμβασης'}</SectionTitle>

              {khmdhsHasChainData && !hideManualContractCore && (
                <FormGroup fullWidth cols={3} style={{ marginBottom: '0.75rem' }}>
                  <FieldHint style={{ fontWeight: 600 }}>
                    Τα πεδία ημερομηνίας και ποσού σύμβασης συμπληρώθηκαν από ΚΗΜΔΗΣ — μπορείτε να τα διορθώσετε αν χρειάζεται.
                    Το ΑΠΕ συμπληρώνετε πάντα μόνοι σας.
                  </FieldHint>
                </FormGroup>
              )}

              {hideManualContractCore && (
                <FormGroup fullWidth cols={3} style={{ marginBottom: '0.75rem' }}>
                  <FieldHint style={{ fontWeight: 600 }}>
                    Ημερομηνία, ποσό και ιστορικό αλυσίδας εμφανίζονται στα αποτελέσματα ΚΗΜΔΗΣ παραπάνω.
                    Συμπληρώστε εδώ μόνο ΑΠΕ και στοιχεία που δεν υπάρχουν στο ΚΗΜΔΗΣ.
                  </FieldHint>
                </FormGroup>
              )}

              {formData.implementationForm === 'Μια Σύμβαση' ? (
                <>
                  <FormGrid cols={hideManualContractCore ? 1 : 3}>
                    {!hideManualContractDate && (
                      renderKhmdhsFieldAnchor('khmdhs-contract-date', (
                      <FormGroup>
                        {renderKhmdhsReviewHint('contractDate')}
                        <KhmdhsInlineField
                          label="Ημερομηνία Υπογραφής"
                          required
                          type="date"
                          value={formData.contractDate || ''}
                          locked={!!(khmdhsContractFieldsAutoFilled && formData.contractDate)}
                          onChange={(v) => handleInputChange('contractDate', v)}
                          error={errors.contractDate}
                        />
                      </FormGroup>
                      ))
                    )}
                    {!hideManualContractAmount && (
                      renderKhmdhsFieldAnchor('khmdhs-contract-amount', (
                      <FormGroup>
                        {renderKhmdhsReviewHint('contractAmount')}
                        <KhmdhsInlineField
                          label="Ποσό Σύμβασης (με ΦΠΑ)"
                          required
                          type="text"
                          value={formData.contractAmount || ''}
                          locked={!!(khmdhsContractFieldsAutoFilled && formData.contractAmount)}
                          onChange={(v) => handleInputChange('contractAmount', v)}
                          onBlur={() => handleAmountBlur('contractAmount')}
                          placeholder="π.χ. 25.254,25"
                          error={errors.contractAmount}
                        />
                      </FormGroup>
                      ))
                    )}
                    <FormGroup>
                      <Label>ΑΠΕ + Συμπληρωματικές</Label>
                      <FieldHint style={{ marginBottom: '0.35rem' }}>Δεν υπάρχει στο ΚΗΜΔΗΣ — συμπληρώνετε μόνοι σας.</FieldHint>
                      <Input type="text" value={formData.apeAmount} onChange={(e) => handleInputChange('apeAmount', e.target.value)} onBlur={() => handleAmountBlur('apeAmount')} placeholder="π.χ. 2.500,00" />
                      <Input type="text" value={formData.apeComments} onChange={(e) => handleInputChange('apeComments', e.target.value)} placeholder="Σχόλια ΑΠΕ" style={{ marginTop: '0.4rem' }} />
                      {errors.apeAmount && <ErrorMessage>{errors.apeAmount}</ErrorMessage>}
                    </FormGroup>
                  </FormGrid>
                </>
              ) : (
                <ContractsListWrap>
                  {formData.contracts.map((contract, index) => (
                    <ContractPanel key={index}>
                      <ContractPanelTitle>Σύμβαση {index + 1}</ContractPanelTitle>
                      {/* ADAM read-only badge — εισαγωγή ΑΔΑΜ γίνεται από το κεντρικό πεδίο στην κορυφή */}
                      {(contract.khmdhsAdam || contract.khmdhsContractSnapshot) && (
                        <div style={{
                          marginBottom: '0.55rem',
                          padding: '0.4rem 0.7rem',
                          background: '#f0fdf4',
                          borderRadius: '8px',
                          border: '1px solid #86efac',
                          fontSize: '0.82rem',
                          color: '#166534',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          flexWrap: 'wrap',
                        }}>
                          <span>✅</span>
                          {contract.khmdhsAdam && (
                            <strong style={{ fontFamily: 'monospace', letterSpacing: '0.02em' }}>
                              {contract.khmdhsAdam}
                            </strong>
                          )}
                          {contract.khmdhsContractSnapshot?.anadoxosName && (
                            <span style={{ color: '#374151' }}>
                              · {contract.khmdhsContractSnapshot.anadoxosName}
                            </span>
                          )}
                          {contract.contractEndDate && (
                            <span style={{ color: '#374151' }}>
                              · λήξη {contract.contractEndDate}
                            </span>
                          )}
                          {(khmdhsChainFetchTarget === index) && (
                            <span style={{ color: '#6366f1', fontStyle: 'italic' }}>Ανάκτηση…</span>
                          )}
                        </div>
                      )}
                      {!contract.khmdhsAdam && !contract.khmdhsContractSnapshot && (
                        <div style={{
                          marginBottom: '0.55rem',
                          padding: '0.4rem 0.7rem',
                          background: '#fefce8',
                          borderRadius: '8px',
                          border: '1px solid #fde68a',
                          fontSize: '0.82rem',
                          color: '#92400e',
                        }}>
                          {khmdhsChainFetchTarget === index
                            ? '⏳ Ανάκτηση δεδομένων ΚΗΜΔΗΣ…'
                            : '⏳ Αναμονή ανάκτησης — χρησιμοποιήστε το πεδίο ΑΔΑΜ παραπάνω.'}
                        </div>
                      )}
                      <FormGrid cols={3}>
                        {!formKhmdhsHidesManualContractDate(formData, index) && (
                        renderKhmdhsFieldAnchor(`khmdhs-contract-date-${index}`, (
                        <FormGroup>
                          {renderFieldLabel(
                            'Ημερομηνία Υπογραφής *',
                            !!sanitizeAdamInput(contract.khmdhsAdam) && !!contract.date
                          )}
                          {renderKhmdhsReviewHint('contractDate', { contractIndex: index })}
                          <Input type="date" value={contract.date} onChange={(e) => updateContract(index, 'date', e.target.value)} />
                          {errors[`contractDate${index}`] && <ErrorMessage>{errors[`contractDate${index}`]}</ErrorMessage>}
                        </FormGroup>
                        ))
                        )}
                        {!formKhmdhsHidesManualContractAmount(formData, index) && (
                        renderKhmdhsFieldAnchor(`khmdhs-contract-amount-${index}`, (
                        <FormGroup>
                          {renderFieldLabel(
                            'Ποσό Σύμβασης (με ΦΠΑ) *',
                            !!sanitizeAdamInput(contract.khmdhsAdam) && !!contract.amount
                          )}
                          {renderKhmdhsReviewHint('contractAmount', { contractIndex: index })}
                          <Input type="text" value={contract.amount} onChange={(e) => updateContract(index, 'amount', e.target.value)} placeholder="π.χ. 25.254,25" />
                          {errors[`contractAmount${index}`] && <ErrorMessage>{errors[`contractAmount${index}`]}</ErrorMessage>}
                        </FormGroup>
                        ))
                        )}
                        {!formKhmdhsHidesManualContractEndDate(formData, index) && (
                        <FormGroup>
                          {renderFieldLabel(
                            'Ημερομηνία Λήξης Σύμβασης',
                            !!sanitizeAdamInput(contract.khmdhsAdam) && !!contract.contractEndDate
                          )}
                          <FieldHint style={{ marginBottom: '0.35rem' }}>
                            Από ΚΗΜΔΗΣ όταν υπάρχει ΑΔΑΜ — αλλιώς συμπληρώνετε χειροκίνητα για το ημερολόγιο.
                          </FieldHint>
                          <Input
                            type="date"
                            value={contract.contractEndDate || ''}
                            onChange={(e) => updateContract(index, 'contractEndDate', e.target.value)}
                          />
                        </FormGroup>
                        )}
                        <FormGroup>
                          <Label>ΑΠΕ + Συμπληρωματικές</Label>
                          <Input type="text" value={contract.apeAmount} onChange={(e) => updateContract(index, 'apeAmount', e.target.value)} placeholder="π.χ. 2.500,00" />
                          <Input type="text" value={contract.comments} onChange={(e) => updateContract(index, 'comments', e.target.value)} placeholder="Σχόλια" style={{ marginTop: '0.4rem' }} />
                          {errors[`apeAmount${index}`] && <ErrorMessage>{errors[`apeAmount${index}`]}</ErrorMessage>}
                        </FormGroup>
                      </FormGrid>
                      <RemoveContractButton onClick={() => removeContract(index)} style={{ marginTop: '0.5rem' }}>Αφαίρεση Σύμβασης</RemoveContractButton>
                    </ContractPanel>
                  ))}
                  <AddContractButton onClick={addContract}>+ Προσθήκη Σύμβασης</AddContractButton>
                  {errors.contracts && <ErrorMessage>{errors.contracts}</ErrorMessage>}
                </ContractsListWrap>
              )}

              {/* Συμπληρωματικές */}
              {showManualSupplementaryToggle && (
                <CheckboxContainer style={{ marginTop: '1rem' }}>
                  <Checkbox type="checkbox" id="hasSupplementaryContracts" checked={formData.hasSupplementaryContracts} onChange={(e) => handleInputChange('hasSupplementaryContracts', e.target.checked)} />
                  <CheckboxLabel htmlFor="hasSupplementaryContracts">Υπάρχει Συμπληρωματική Σύμβαση</CheckboxLabel>
                </CheckboxContainer>
              )}

              {(showManualSupplementaryToggle ? formData.hasSupplementaryContracts : showKhmdhsSupplementarySection) && (
                <SupplementaryOuter>
                  <SupplementarySectionTitle>
                    {showKhmdhsSupplementarySection
                      ? 'Συμπληρωματικές από ΚΗΜΔΗΣ'
                      : 'Συμπληρωματικές συμβάσεις'}
                  </SupplementarySectionTitle>
                  {showKhmdhsSupplementarySection && (
                    <FieldHint style={{ marginBottom: '0.65rem' }}>
                      Μπορείτε να διορθώσετε ποσό και ημερομηνία, ή να αφαιρέσετε λάθος συμπληρωματική — η κύρια αλυσίδα δεν επηρεάζεται.
                    </FieldHint>
                  )}
                  {formData.supplementaryContracts.map((contract, index) => (
                    <SupplementaryInner key={index}>
                      <FormGrid cols={3}>
                        {renderKhmdhsFieldAnchor(`khmdhs-supp-date-${index}`, (
                        <FormGroup>
                          {renderFieldLabel(`Ημερομηνία ${index + 1}`, false, buildSupplementaryOverrideKey('date', contract))}
                          {renderKhmdhsReviewHint('supplementaryDate', { supplementaryIndex: index })}
                          <Input
                            type="date"
                            value={contract.date}
                            onChange={(e) => updateSupplementaryContract(index, 'date', e.target.value)}
                          />
                          {errors[`supplementaryDate${index}`] && (
                            <ErrorMessage>{errors[`supplementaryDate${index}`]}</ErrorMessage>
                          )}
                        </FormGroup>
                        ))}
                        {renderKhmdhsFieldAnchor(`khmdhs-supp-amount-${index}`, (
                        <FormGroup>
                          {renderFieldLabel(`Ποσό ${index + 1}`, false, buildSupplementaryOverrideKey('amount', contract))}
                          {renderKhmdhsReviewHint('supplementaryAmount', { supplementaryIndex: index })}
                          <Input
                            type="text"
                            value={contract.amount}
                            onChange={(e) => updateSupplementaryContract(index, 'amount', e.target.value)}
                            placeholder="π.χ. 5.000,00"
                          />
                          {errors[`supplementaryAmount${index}`] && (
                            <ErrorMessage>{errors[`supplementaryAmount${index}`]}</ErrorMessage>
                          )}
                        </FormGroup>
                        ))}
                        <FormGroup>
                          <Label>Σχόλια {index + 1}</Label>
                          <Input type="text" value={contract.comments} onChange={(e) => updateSupplementaryContract(index, 'comments', e.target.value)} placeholder="Σχόλια" />
                        </FormGroup>
                      </FormGrid>
                      <RemoveSupplementaryButton onClick={() => removeSupplementaryContract(index)} style={{ marginTop: '0.5rem' }}>
                        {contract?.khmdhsDerived ? 'Αφαίρεση συμπληρωματικής' : 'Αφαίρεση'}
                      </RemoveSupplementaryButton>
                    </SupplementaryInner>
                  ))}
                  {!khmdhsChainHasAmendments && (
                    <AddSupplementaryButton onClick={addSupplementaryContract}>+ Προσθήκη Συμπληρωματικής</AddSupplementaryButton>
                  )}
                </SupplementaryOuter>
              )}

              {chainShowsContractPanels && khmdhsDerivedSupplementary && !showKhmdhsSupplementarySection && (
                <FieldHint style={{ marginTop: '0.75rem', fontWeight: 600 }}>
                  Η συμπληρωματική σύμβαση εμφανίζεται στον κρίκο της αλυσίδας ΚΗΜΔΗΣ· δεν χρειάζεται διπλή καταχώριση εδώ.
                </FieldHint>
              )}

              {chainShowsContractPanels && khmdhsDerivedSupplementary && showKhmdhsSupplementarySection && (
                <FieldHint style={{ marginTop: '0.75rem', fontWeight: 600 }}>
                  Οι τιμές εδώ συγχρονίζονται με τον κρίκο της αλυσίδας — δεν είναι ξεχωριστή καταχώριση.
                </FieldHint>
              )}
            </Section>
          )}

            </KhmdhsPhaseInner>
          </KhmdhsPhaseShell>
          )}

        </FormScrollArea>

        {activePhaseTab !== 'B' && (
        <FixedFilesDock $slim>
          <FixedFilesDockBar $slim>
            <FixedFilesDockLeft>
              <FixedFilesDockIcon aria-hidden>📁</FixedFilesDockIcon>
              <FixedFilesDockLabel $slim>Αρχεία υποέργου</FixedFilesDockLabel>
              {dockFileCount > 0 && (
                <DockFileCount>{dockFileCount} αρχ.</DockFileCount>
              )}
            </FixedFilesDockLeft>
            <FixedFilesDockActions>
              <DockUploadBtn type="button" $variant="file" $iconOnly title="Ανέβασμα αρχείων" onClick={handleFileSelect}>
                📤
              </DockUploadBtn>
              <DockUploadBtn type="button" $variant="folder" $iconOnly title="Ανέβασμα φακέλου" onClick={handleFolderSelect}>
                📁
              </DockUploadBtn>
            </FixedFilesDockActions>
          </FixedFilesDockBar>
        </FixedFilesDock>
        )}

        {errors.khmdhsDataQualityReview && (
          <div style={{
            padding: '0.45rem 1.25rem',
            background: '#fff7ed',
            borderTop: '1px solid rgba(234,88,12,0.18)',
            fontSize: '0.74rem',
            fontWeight: 700,
            color: '#9a3412',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}>
            🔔 {errors.khmdhsDataQualityReview}
            <button
              type="button"
              onClick={() => setDataReviewModalOpen(true)}
              style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 800, background: 'none', border: 'none', color: '#ea580c', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
            >
              Άνοιγμα αναφοράς
            </button>
          </div>
        )}
        <StickyFooter $slim={activePhaseTab === 'B'}>
          <CancelButton type="button" onClick={handleRequestClose} disabled={isSaving}>
            Ακύρωση
          </CancelButton>
          <SaveButton type="button" onClick={() => handleSave()} disabled={isSaving}>
            {isSaving
              ? 'Αποθήκευση…'
              : (manualPhaseSavedOnce && !isPhaseADirty(formData, manualPhaseBaseline))
                ? 'Αποθήκευση'
                : 'Αποθήκευση Φάσης Α'}
          </SaveButton>
          {activePhaseTab === 'B' && (
            <FooterFileActions>
              <FooterIconBtn type="button" $variant="file" title="Ανέβασμα αρχείων" onClick={handleFileSelect}>
                📤
              </FooterIconBtn>
              <FooterIconBtn type="button" $variant="folder" title="Ανέβασμα φακέλου" onClick={handleFolderSelect}>
                📁
                {dockFileCount > 0 && (
                  <FooterFileCount aria-label={`${dockFileCount} αρχεία`}>{dockFileCount}</FooterFileCount>
                )}
              </FooterIconBtn>
            </FooterFileActions>
          )}
          {(formData.projectId && formData.subprojectId) && onDelete && (
            <DeleteFormButton
              type="button"
              onClick={() => onDelete(formData.projectId, formData.subprojectId)}
            >
              Διαγραφή
            </DeleteFormButton>
          )}
        </StickyFooter>
      </FormContainer>
    </FormOverlay>
    {showFundingModal && (
      <FundingOptionsModal
        isOpen={showFundingModal}
        onClose={() => setShowFundingModal(false)}
        initialTab={fundingModalTab}
        activeSource={fundingModalSource}
        onOptionsChanged={loadFundingOptions}
      />
    )}
    <KhmdhsApeConflictModal
      isOpen={!!apeConflictModal}
      currentAmount={apeConflictModal?.current || ''}
      khmdhsAmount={apeConflictModal?.suggested || ''}
      contractLabel={apeConflictModal?.contractLabel || ''}
      onAcceptKhmdhs={handleApeConflictAccept}
      onKeepCurrent={() => setApeConflictModal(null)}
      onClose={() => setApeConflictModal(null)}
    />
    <KhmdhsPreSaveOverridesModal
      isOpen={preSaveOverridesOpen}
      overrides={getActiveKhmdhsOverrides(formData)}
      onConfirm={() => {
        setPreSaveOverridesOpen(false);
        handleSave({ skipOverridesCheck: true });
      }}
      onCancel={() => setPreSaveOverridesOpen(false)}
    />
    <KhmdhsStatusCleanupModal
      isOpen={!!statusCleanupModal}
      statusLabel={formData.projectStatus || ''}
      scope={statusCleanupModal?.incompat?.scope || 'full'}
      onConfirm={() => {
        const clearFields = statusCleanupModal?.incompat?.clearFields || {};
        setSymvChainPlannerState(null);
        setFormData((prev) => ({
          ...prev,
          ...clearFields,
        }));
        setStatusCleanupModal(null);
        handleSave({ skipOverridesCheck: true });
      }}
      onSkip={() => {
        setStatusCleanupModal(null);
        handleSave({ skipOverridesCheck: true });
      }}
      onClose={() => setStatusCleanupModal(null)}
    />
    <KhmdhsSituationModal
      isOpen={!!khmdhsSituationModal?.report}
      report={khmdhsSituationModal?.report}
      onAction={handleKhmdhsSituationAction}
      onDismiss={handleKhmdhsSituationDismiss}
      chainSnapshots={{
        contract: formData.khmdhsContractSnapshot || null,
        award: formData.khmdhsAwardSnapshot || null,
        notice: formData.khmdhsNoticeSnapshot || null,
        request: formData.khmdhsRequestSnapshot || null,
        contracts: (formData.contracts || []).map((c) => ({
          adam: c.khmdhsAdam || null,
          snapshot: c.khmdhsContractSnapshot || null,
          amount: c.amount || c.khmdhsInferredAmount || null,
          inferredSource: c.khmdhsInferredAmountSource || null,
        })),
      }}
      fetchingTargets={
        typeof khmdhsChainFetchTarget === 'number' ? [khmdhsChainFetchTarget] : []
      }
    />
    <KhmdhsDocumentRegistryModal
      isOpen={!!khmdhsRegistryModal?.candidates?.length}
      candidates={khmdhsRegistryModal?.candidates || []}
      existing={khmdhsRegistryModal?.existing || formData.khmdhsDocumentRegistry || []}
      onConfirm={handleKhmdhsRegistryConfirm}
      onDismiss={() => setKhmdhsRegistryModal(null)}
    />
    <KhmdhsSymvChainPlannerDialog
      isOpen={!!symvChainPlannerState?.open}
      chainRes={symvChainPlannerState?.seedChainRes || null}
      subprojectTitle={symvChainPlannerState?.subprojectTitle || ''}
      existingPlan={
        symvChainPlannerState?.draftPlan
        || symvChainPlannerState?.existingPlan
        || null
      }
      onDismiss={(draftPlan) => {
        setSymvChainPlannerState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            open: false,
            draftPlan: draftPlan || prev.draftPlan || null,
          };
        });
      }}
      onConfirm={(plan) => {
        const payload = symvChainPlannerState;
        if (!payload?.seedChainRes || !plan?.items?.length) {
          setSymvChainPlannerState(null);
          return;
        }
        setSymvChainPlannerState(null);
        const opts = payload.fetchOptions || {};
        runKhmdhsChainFetch({
          adam: opts.seedAdam || payload.seedAdam,
          contractIndex: opts.contractIndex ?? null,
          suppressSituationModal: opts.suppressSituationModal,
          forceChainFetch: true,
          suppressBranchPicker: true,
          branchAnchor: opts.branchAnchor || null,
          userSelectedBranch: opts.userSelectedBranch,
          symvChainPlan: plan,
          preloadedChainRes: payload.seedChainRes,
        });
      }}
    />
    <KhmdhsBranchPickerDialog
      isOpen={!!branchPickerState}
      candidates={branchPickerState?.candidates || []}
      suggestedAdam={branchPickerState?.suggestedAdam || ''}
      subprojectTitle={branchPickerState?.subprojectTitle || ''}
      seedChainRes={branchPickerState?.seedChainRes || null}
      allowsAllBranches={!!branchPickerState?.allowsAllBranches}
      onCancel={() => setBranchPickerState(null)}
      onConfirm={(selected, meta = {}) => {
        const opts = branchPickerState?.fetchOptions || {};
        const allCandidates = branchPickerState?.candidates || [];
        const seedChainRes = branchPickerState?.seedChainRes || null;
        setBranchPickerState(null);

        if (meta.mode === 'all') {
          const actRoot = inferActRootReqAdam(seedChainRes, opts.seedAdam)
            || seedChainRes?.request?.adam
            || opts.seedAdam;
          runKhmdhsChainFetch({
            adam: actRoot,
            contractIndex: opts.contractIndex ?? null,
            suppressSituationModal: opts.suppressSituationModal,
            forceChainFetch: true,
            suppressBranchPicker: true,
            followAllBranches: true,
            userSelectedBranch: false,
          });
          return;
        }

        const rejected = allCandidates.filter((c) => c.adam !== selected?.adam);
        if (!selected?.adam) return;
        if (rejected.some((c) => String(c.type || '').toUpperCase() === 'SYMV')) {
          setFormData((prev) => ({
            ...prev,
            khmdhsAcknowledgedSituationIds: [
              ...new Set([
                ...(prev.khmdhsAcknowledgedSituationIds || []),
                KHMDHS_SITUATION_ID_PARALLEL_CONTRACTS,
              ]),
            ],
          }));
        }
        runKhmdhsChainFetch({
          adam: selected.adam,
          contractIndex: opts.contractIndex ?? null,
          suppressSituationModal: opts.suppressSituationModal,
          forceChainFetch: true,
          suppressBranchPicker: true,
          branchAnchor: selected,
          userSelectedBranch: true,
        });
        if (rejected.length > 0) {
          setRelatedDocsModal({ candidates: rejected, seedChainRes, previews: meta.previews || {} });
        }
      }}
    />
    <KhmdhsRelatedDocumentsModal
      isOpen={!!relatedDocsModal?.candidates?.length}
      candidates={relatedDocsModal?.candidates || []}
      seedChainRes={relatedDocsModal?.seedChainRes || null}
      previews={relatedDocsModal?.previews || {}}
      onConfirm={handleRelatedDocsConfirm}
      onDismiss={() => setRelatedDocsModal(null)}
    />
    <KhmdhsDuplicateAnchorDialog
      isOpen={!!duplicateAnchorModal}
      conflict={duplicateAnchorModal?.conflict}
      onCancel={() => setDuplicateAnchorModal(null)}
      onConfirm={() => duplicateAnchorModal?.onConfirm?.()}
    />
    <KhmdhsSupplementaryConfirmDialog
      isOpen={!!supplementaryConfirm}
      adam={supplementaryConfirm?.adam || ''}
      message={supplementaryConfirm?.message || ''}
      onCancel={() => setSupplementaryConfirm(null)}
      onConfirm={() => {
        const payload = supplementaryConfirm;
        setSupplementaryConfirm(null);
        if (!payload?.adam) return;
        runKhmdhsSupplementaryFetch({
          adam: payload.adam,
          contractIndex: payload.contractIndex,
          skipCrossActConfirm: true,
        });
      }}
    />
    <KhmdhsContractExpiryPromptDialog
      isOpen={!!contractExpiryPrompt}
      prompt={contractExpiryPrompt}
      onDismiss={() => setContractExpiryPrompt(null)}
      onAccept={handleContractExpiryAccept}
    />
    <KhmdhsDataReviewModal
      isOpen={dataReviewModalOpen}
      review={formData.khmdhsDataQualityReview}
      formData={formData}
      focusItemKey={reviewFocusItemKey}
      onConfirm={handleDataReviewConfirm}
      onDismiss={handleDataReviewDismiss}
      onResolveItem={handleReviewResolveItem}
      onResolveChainKind={handleReviewResolveChainKind}
      onRevokeResolution={handleReviewRevokeResolution}
      onApplyAllSuggested={handleReviewApplyAllSuggested}
    />
    <ProjectFormUnsavedModal
      isOpen={unsavedCloseModalOpen}
      isNewProject={isNewSubprojectForm()}
      onCancel={handleUnsavedCloseCancel}
      onDiscard={handleUnsavedCloseDiscard}
      onSave={handleUnsavedCloseSave}
    />
    <KhmdhsApeEntryModal
      isOpen={!!apeEntryTarget}
      targetTitle={apeEntryModalProps?.targetTitle || ''}
      targetKind={apeEntryTarget?.kind || 'contract'}
      khmdhsAmount={apeEntryModalProps?.khmdhsAmount || ''}
      amountSanityReference={apeEntryModalProps?.amountSanityReference || 0}
      initialApeAmount={apeEntryModalProps?.initialApeAmount || ''}
      initialComments={apeEntryModalProps?.initialComments || ''}
      initialFileName={apeEntryModalProps?.initialFileName || ''}
      initialGroupTitle={apeEntryModalProps?.initialGroupTitle || ''}
      initialSourcePath={apeEntryModalProps?.initialSourcePath || ''}
      initialSourceAdam={apeEntryModalProps?.initialSourceAdam || ''}
      initialDiavgeiaAda={apeEntryModalProps?.initialDiavgeiaAda || ''}
      initialDocumentDate={apeEntryModalProps?.initialDocumentDate || ''}
      isNewEntry={!!apeEntryModalProps?.isNewEntry}
      onFetchByAdam={handleFetchApeByAdam}
      onFetchByDiavgeiaAda={handleFetchDiavgeiaByAda}
      onCancel={() => setApeEntryTarget(null)}
      onApply={handleApplyApeEntry}
      onRemove={apeEntryTarget?.entryId ? handleRemoveApeEntry : undefined}
    />
    <KhmdhsManualExtensionModal
      isOpen={!!manualExtensionTarget}
      targetTitle={manualExtensionModalProps?.targetTitle || ''}
      initialNewEndDate={manualExtensionModalProps?.initialNewEndDate || ''}
      initialDocumentDate={manualExtensionModalProps?.initialDocumentDate || ''}
      initialComments={manualExtensionModalProps?.initialComments || ''}
      initialFileName={manualExtensionModalProps?.initialFileName || ''}
      initialGroupTitle={manualExtensionModalProps?.initialGroupTitle || ''}
      initialSourcePath={manualExtensionModalProps?.initialSourcePath || ''}
      initialDiavgeiaAda={manualExtensionModalProps?.initialDiavgeiaAda || ''}
      isNewEntry={!!manualExtensionModalProps?.isNewEntry}
      onFetchByDiavgeiaAda={handleFetchDiavgeiaByAda}
      onCancel={() => setManualExtensionTarget(null)}
      onApply={handleApplyManualExtension}
      onRemove={manualExtensionTarget?.entryId ? handleRemoveManualExtension : undefined}
    />
    </>
  );
}

export default ProjectForm;

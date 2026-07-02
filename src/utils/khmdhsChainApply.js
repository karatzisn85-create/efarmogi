/**
 * Εφαρμογή αποτελέσματος ανάκτησης αλυσίδας ΚΗΜΔΗΣ σε δεδομένα υποέργου.
 */
import { isMultipleContractsForm, emptyKhmdhsOnContract, resolveStoredApeAmount } from './khmdhsFields';
import { syncPreservedContractApeAmount, hasRealStoredContractApe, emptyLegacyApeFields, stripPhantomContractApeFromForm } from './khmdhsApeEntry';
import { applyParallelContractAmountHints, resolveParallelContractSiblings } from './khmdhsParallelContractApply';
import { shouldOfferSymvChainPlanner } from './khmdhsSymvChainPlanner';
import { applySymvChainPlanToForm } from './khmdhsSymvChainApply';
import { normalizeAmountForCompare } from './projectFormPhases';
import { prepareFormForInferredImplementationForm } from './khmdhsImplementationFormInference';
import { suggestProjectStatusAfterKhmdhsChain } from './khmdhsAdamGuidance';
import { mergeKhmdhsSupplementaryIntoForm } from './khmdhsChainDerivedFields';
import { syncChainHistoryWithReview } from './khmdhsChainFormAccess';
import {
  mergeKhmdhsReviewAfterFetch,
  reconcileReviewState,
  isContractAmountUserProtected,
} from './khmdhsDataQualityReport';
import { applyUserEditsAfterKhmdhsFetch } from './khmdhsFieldOverrides';
import { computeChainCharacterizationEffects } from './khmdhsChainActions';
import { findSupplementaryRowIndex } from './khmdhsDataQualityReport';
import {
  inferActRootReqAdam,
  mergeBranchAnchorFields,
  resolveBranchAnchorFromChain,
} from './khmdhsBranchAnchor';

function sanitizeAdamInput(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16);
}

function createEmptyContractRow() {
  return { date: '', amount: '', apeAmount: '', comments: '', ...emptyKhmdhsOnContract() };
}

function applyApeFromChain(currentApe, suggestedApe) {
  const suggested = String(suggestedApe || '').trim();
  const current = String(currentApe || '').trim();
  if (!suggested) return { ape: current, conflict: null };
  // Το ΑΠΕ είναι πάντα χειροκίνητο «τελικό διαμορφωθέν» — δεν συμπληρώνεται αυτόματα από την αλυσίδα.
  if (!current) return { ape: '', conflict: null };
  if (normalizeAmountForCompare(current) === normalizeAmountForCompare(suggested)) {
    return { ape: current, conflict: null };
  }
  return { ape: current, conflict: { current, suggested } };
}

function mergeRequestFromChain(next, chainRes, { protect = false } = {}) {
  if (!chainRes?.request) return next;
  // Αν protect=true (auto-fetch παράλληλης σύμβασης) και υπάρχει ήδη REQ ΑΔΑΜ,
  // δεν αντικαθιστούμε τα REQ πεδία — αλλά επιτρέπουμε συμπλήρωση budget αν είναι κενό.
  if (!protect || !next.khmdhsRequestAdam) {
    next.khmdhsRequestAdam = chainRes.request.adam;
    next.khmdhsRequestSnapshot = chainRes.request.snapshot;
    next.khmdhsRequestFetchedAt = chainRes.request.fetchedAt;
  }
  if (chainRes.request.projectBudget && !next.projectBudget) {
    next.projectBudget = chainRes.request.projectBudget;
  }
  return next;
}

function mergeCommitmentAndPaymentsFromChain(next, chainRes, { protect = false } = {}) {
  const fromChain = Array.isArray(chainRes?.commitmentDecisions)
    ? chainRes.commitmentDecisions.filter((d) => d && (d.adam || d.snapshot))
    : [];
  const fromMeta = Array.isArray(chainRes?.chainMeta?.allBudgetCommitments)
    ? chainRes.chainMeta.allBudgetCommitments.filter((d) => d && (d.adam || d.snapshot))
    : [];
  const allDecisions = fromChain.length >= fromMeta.length ? fromChain : fromMeta;

  // Αν protect=true (auto-fetch παράλληλης σύμβασης), δεν αντικαθιστούμε δεσμεύσεις/πληρωμές
  // που ήδη γράφτηκαν — ελέγχουμε μόνο τον πίνακα (όχι μόνο το adam) ώστε ένα μερικό
  // αποτέλεσμα να μπορεί να αναβαθμιστεί σε πλήρη λίστα.
  const skipCommitments = protect && next.khmdhsCommitmentDecisions?.length > 0;
  const skipPayments = protect && next.khmdhsPayments?.length > 0;

  if (!skipCommitments) {
    if (allDecisions.length > 0) {
      next.khmdhsCommitmentDecisions = allDecisions;
      // Επιλογή κύριας απόφασης: χρονολογικά πρώτη (signedDate ή submissionDate), fallback στη σειρά API
      const sorted = [...allDecisions].sort((a, b) => {
        const da = a?.snapshot?.signedDate || a?.snapshot?.submissionDate || '';
        const db = b?.snapshot?.signedDate || b?.snapshot?.submissionDate || '';
        if (da && db) return da < db ? -1 : da > db ? 1 : 0;
        if (da) return -1;
        if (db) return 1;
        return 0;
      });
      const primary = sorted[0];
      next.khmdhsCommitmentAdam = primary.adam || '';
      next.khmdhsCommitmentSnapshot = primary.snapshot || null;
      next.khmdhsCommitmentFetchedAt = primary.fetchedAt || '';
    } else if (chainRes?.commitmentDecision?.adam) {
      next.khmdhsCommitmentAdam = chainRes.commitmentDecision.adam;
      next.khmdhsCommitmentSnapshot = chainRes.commitmentDecision.snapshot;
      next.khmdhsCommitmentFetchedAt = chainRes.commitmentDecision.fetchedAt;
    }
  }

  if (!skipPayments && Array.isArray(chainRes?.payments)) {
    next.khmdhsPayments = chainRes.payments;
  }
  return next;
}

export function emptyKhmdhsChainFields() {
  return {
    khmdhsAdam: '',
    khmdhsContractSnapshot: null,
    khmdhsContractFetchedAt: '',
    khmdhsNoticeAdam: '',
    khmdhsNoticeSnapshot: null,
    khmdhsNoticeFetchedAt: '',
    khmdhsAwardAdam: '',
    khmdhsAwardSnapshot: null,
    khmdhsAwardFetchedAt: '',
    khmdhsRequestAdam: '',
    khmdhsRequestSnapshot: null,
    khmdhsRequestFetchedAt: '',
    khmdhsCommitmentAdam: '',
    khmdhsCommitmentSnapshot: null,
    khmdhsCommitmentFetchedAt: '',
    khmdhsCommitmentDecisions: [],
    khmdhsPayments: [],
    khmdhsContractAmendments: [],
    khmdhsContractChainHistory: [],
    khmdhsContractRoleLabel: '',
    khmdhsAdamChainMeta: null,
    khmdhsDataQualityReview: null,
    khmdhsSymvChainPlan: null,
    khmdhsSymvPlanAppliedAt: '',
    khmdhsChainLastRefreshedAt: '',
  };
}

export function mergeSharedKhmdhsFromChain(prev, chainRes, { protect = false } = {}) {
  const warnings = [];
  const next = { ...prev };

  if (chainRes.notice) {
    const incoming = sanitizeAdamInput(chainRes.notice.adam);
    const existing = sanitizeAdamInput(prev.khmdhsNoticeAdam);
    if (existing && incoming && existing !== incoming) {
      warnings.push('noticeConflict');
      // Σε σύγκρουση: κρατάμε παλιά PROC αλλά διασφαλίζουμε ότι τα procedure fields
      // αντικατοπτρίζουν το υπάρχον notice (όχι τιμές από προηγούμενη ξεχωριστή ανάκτηση)
      if (prev.khmdhsNoticeSnapshot?.mappedAssignmentProcedure) {
        next.assignmentProcedure = prev.khmdhsNoticeSnapshot.mappedAssignmentProcedure;
      }
    } else {
      next.khmdhsNoticeAdam = chainRes.notice.adam;
      next.khmdhsNoticeSnapshot = chainRes.notice.snapshot;
      next.khmdhsNoticeFetchedAt = chainRes.notice.fetchedAt;
      if (chainRes.notice.mappedAssignmentProcedure) {
        // ΚΗΜΔΗΣ βρήκε τη διαδικασία — χρησιμοποιούμε την αυτόματη τιμή.
        next.assignmentProcedure = chainRes.notice.mappedAssignmentProcedure;
      } else {
        // ΚΗΜΔΗΣ δεν μπόρεσε να προσδιορίσει τη διαδικασία — διατηρούμε ό,τι είχε
        // καταχωρήσει χειροκίνητα ο χρήστης, χωρίς να το σβήνουμε (bug fix).
        next.assignmentProcedure = prev.assignmentProcedure || '';
      }
      if (chainRes.notice.contractProcessStartDate) {
        next.contractProcessStartDate = chainRes.notice.contractProcessStartDate;
      } else if (chainRes.contractProcessStartDate) {
        next.contractProcessStartDate = chainRes.contractProcessStartDate;
      }
    }
  } else if (chainRes.contractProcessStartDate) {
    next.contractProcessStartDate = chainRes.contractProcessStartDate;
  }

  if (chainRes.auction?.adam) {
    const incomingA = sanitizeAdamInput(chainRes.auction.adam);
    const existingA = sanitizeAdamInput(prev.khmdhsAwardAdam);
    if (!existingA || existingA === incomingA) {
      next.khmdhsAwardAdam = chainRes.auction.adam;
      next.khmdhsAwardSnapshot = chainRes.auction.snapshot;
      if (chainRes.auction.fetchedAt) {
        next.khmdhsAwardFetchedAt = chainRes.auction.fetchedAt;
      }
    }
  }

  // Αν protect=true (auto-fetch παράλληλης σύμβασης), το chainMeta γράφεται μόνο αν είναι κενό
  if (chainRes.chainMeta) {
    if (!protect || !next.khmdhsAdamChainMeta) {
      next.khmdhsAdamChainMeta = chainRes.chainMeta;
    }
  }

  mergeRequestFromChain(next, chainRes, { protect });
  mergeCommitmentAndPaymentsFromChain(next, chainRes, { protect });

  return { next, warnings };
}

/** Διατηρεί χειροκίνητα ποσά/ημ/νίες σε derived γραμμές όταν η αλυσίδα δεν έχει τιμή. */
function mergeDerivedSuppWithExisting(form, derivedSupp) {
  return (derivedSupp || []).map((row) => {
    const adam = row?.khmdhsAdam;
    if (!adam) return row;
    const idx = findSupplementaryRowIndex(form, adam);
    if (idx < 0) return row;
    const prev = form.supplementaryContracts?.[idx];
    if (!prev) return row;
    return {
      ...row,
      amount: String(row.amount || '').trim() || String(prev.amount || '').trim(),
      date: String(row.date || '').trim() || String(prev.date || '').trim(),
    };
  });
}

export function applyChainCharacterizationToForm(form, review, { fullRecompute = false } = {}) {
  if (form?.khmdhsSymvChainPlan?.items?.length) return form;
  const multi = isMultipleContractsForm(form.implementationForm);
  const manualSupp = (form.supplementaryContracts || []).filter((c) => !c?.khmdhsDerived);
  let derivedSupp = [];
  let nextForm = form;

  if (!multi) {
    const hist = form.khmdhsContractChainHistory || [];
    if (hist.length) {
      const eff = computeChainCharacterizationEffects(hist, review);
      derivedSupp = eff.supplementaryContracts;
      const patch = {};
      const preserveAmount = isContractAmountUserProtected(form, review, null);
      if ((fullRecompute || eff.correctedAmount) && eff.contractAmount && !preserveAmount) {
        patch.contractAmount = eff.contractAmount;
      }
      if ((fullRecompute || eff.correctedDate) && eff.contractDate) {
        patch.contractDate = eff.contractDate;
      }
      if (fullRecompute) {
        patch.contractEndDate = eff.contractDeadline
          ? String(eff.contractDeadline).slice(0, 10)
          : '';
      } else if (eff.contractDeadline) {
        patch.contractEndDate = String(eff.contractDeadline).slice(0, 10);
      }
      nextForm = { ...form, ...patch };
    }
  } else {
    const contracts = (form.contracts || []).map((row, contractIdx) => {
      const hist = row?.khmdhsContractChainHistory || [];
      if (!hist.length) return row;
      const eff = computeChainCharacterizationEffects(hist, review);
      derivedSupp = derivedSupp.concat(
        eff.supplementaryContracts.map((c) => ({
          ...c,
          sourceContractIndex: contractIdx,
        }))
      );
      let amount = row.amount;
      let date = row.date;
      let contractEndDate = row.contractEndDate || '';
      const preserveAmount = isContractAmountUserProtected(form, review, contractIdx);
      if ((fullRecompute || eff.correctedAmount) && !preserveAmount) {
        amount = eff.contractAmount || amount;
      }
      if (fullRecompute || eff.correctedDate) {
        date = eff.contractDate || date;
      }
      if (fullRecompute || eff.contractDeadline) {
        contractEndDate = eff.contractDeadline
          ? String(eff.contractDeadline).slice(0, 10)
          : (fullRecompute ? '' : contractEndDate);
      }
      return { ...row, amount, date, contractEndDate };
    });
    nextForm = { ...form, contracts };
  }

  const supplementaryContracts = [...manualSupp, ...mergeDerivedSuppWithExisting(form, derivedSupp)];
  return syncChainHistoryWithReview({
    ...nextForm,
    supplementaryContracts,
    hasSupplementaryContracts: supplementaryContracts.length > 0,
  }, review);
}

export function applyAdamChainResult(prev, chainRes, {
  seedAdam = '',
  contractIndex = -1,
  branchAnchor = null,
  suppressSituationModal = false,
  userSelectedBranch = false,
  symvChainPlan = null,
} = {}) {
  if (!chainRes?.success) {
    return {
      form: prev,
      warnings: [],
      apeConflict: null,
      statusAutoUpdated: null,
      protectedCount: 0,
      implementationFormAutoUpdated: null,
    };
  }

  if (symvChainPlan?.items?.length) {
    return applySymvChainPlanToForm(prev, chainRes, symvChainPlan, {
      seedAdam,
      branchAnchor,
      suppressSituationModal,
    });
  }

  const isSeedFetch = contractIndex == null || contractIndex < 0;
  if (isSeedFetch && shouldOfferSymvChainPlanner(chainRes)) {
    return {
      form: prev,
      warnings: ['symvPlannerRequired'],
      apeConflict: null,
      statusAutoUpdated: null,
      protectedCount: 0,
      implementationFormAutoUpdated: null,
    };
  }

  const prepared = prepareFormForInferredImplementationForm(prev, chainRes, {
    contractIndex,
    userSelectedBranch,
  });
  const workingPrev = prepared.form;
  const resolvedContractIndex = prepared.contractIndex;
  const implementationFormAutoUpdated = prepared.inferredForm;

  const multi = isMultipleContractsForm(workingPrev.implementationForm);
  const suggestedApe = chainRes.suggestedApeAmount || '';

  if (!multi) {
    // Διατηρούμε τα χειροκίνητα πεδία από τον χρήστη.
    // Τα ΚΗΜΔΗΣ πεδία (snapshots κ.λπ.) καθαρίζονται κανονικά για να ξαναφορτωθούν.
    // Οι χειροκίνητες συμπληρωματικές (χωρίς khmdhsDerived) επιβιώνουν — μόνο οι
    // παλιές ΚΗΜΔΗΣ-derived καθαρίζονται για να αντικατασταθούν από τα νέα δεδομένα.
    let next = {
      ...workingPrev,
      ...emptyKhmdhsChainFields(),
      khmdhsChainSeedAdam: seedAdam || workingPrev.khmdhsChainSeedAdam,
      // assignmentProcedure και contractProcessStartDate προέρχονται από τη Δημοσίευση (notice).
      // Αν δεν υπάρχει Δημοσίευση ή το ΚΗΜΔΗΣ δεν τα προσδιορίζει, διατηρούμε τις τιμές του χρήστη.
      contractProcessStartDate: '',
      ...emptyLegacyApeFields(),
      hasSupplementaryContracts: false,
      supplementaryContracts: (workingPrev.supplementaryContracts || []).filter((c) => !c?.khmdhsDerived),
    };

    if (chainRes.contract) {
      const ff = chainRes.contract.formFields || {};
      next.khmdhsAdam = chainRes.contract.adam;
      next.khmdhsContractSnapshot = chainRes.contract.snapshot;
      next.khmdhsContractFetchedAt = chainRes.contract.fetchedAt;
      next.khmdhsContractRoleLabel = chainRes.contract.roleLabel || '';
      // Το ΚΗΜΔΗΣ υπερισχύει ΜΟΝΟ αν επιστρέφει πραγματική τιμή.
      // Αν δεν επιστρέψει, διατηρείται η χειροκίνητη καταχώριση του χρήστη.
      if (ff.contractDate) next.contractDate = ff.contractDate;
      if (ff.contractEndDate) next.contractEndDate = ff.contractEndDate;
      if (ff.contractAmount && !ff.contractAmountSuppressed) {
        next.contractAmount = ff.contractAmount;
      } else if (ff.contractAmountSuppressed) {
        next.contractAmount = '';
      }
      // Αν το ΚΗΜΔΗΣ δεν δίνει ούτε ημερομηνία ούτε ποσό, τα πεδία του χρήστη
      // (workingPrev.contractDate, workingPrev.contractAmount κ.λπ.) παραμένουν
      // από το ...workingPrev παραπάνω — χωρίς να χρειάζεται επιπλέον κώδικας.
    }

    if (chainRes.notice) {
      next.khmdhsNoticeAdam = chainRes.notice.adam;
      next.khmdhsNoticeSnapshot = chainRes.notice.snapshot;
      next.khmdhsNoticeFetchedAt = chainRes.notice.fetchedAt;
      if (chainRes.notice.mappedAssignmentProcedure) {
        // ΚΗΜΔΗΣ βρήκε τη διαδικασία — χρησιμοποιούμε την αυτόματη τιμή.
        next.assignmentProcedure = chainRes.notice.mappedAssignmentProcedure;
      } else {
        // ΚΗΜΔΗΣ δεν μπόρεσε να προσδιορίσει τη διαδικασία.
        // Διατηρούμε ό,τι είχε επιλέξει ο χρήστης (αν υπάρχει), χωρίς να το σβήνουμε.
        next.assignmentProcedure = workingPrev.assignmentProcedure || '';
      }
      if (chainRes.notice.contractProcessStartDate) {
        next.contractProcessStartDate = chainRes.notice.contractProcessStartDate;
      } else if (chainRes.contractProcessStartDate) {
        next.contractProcessStartDate = chainRes.contractProcessStartDate;
      }
    } else if (chainRes.contractProcessStartDate) {
      next.contractProcessStartDate = chainRes.contractProcessStartDate;
    }

    if (chainRes.auction?.adam) {
      next.khmdhsAwardAdam = chainRes.auction.adam;
      next.khmdhsAwardSnapshot = chainRes.auction.snapshot;
      if (chainRes.auction.fetchedAt) {
        next.khmdhsAwardFetchedAt = chainRes.auction.fetchedAt;
      }
    }

    mergeRequestFromChain(next, chainRes);
    mergeCommitmentAndPaymentsFromChain(next, chainRes);

    next.khmdhsContractChainHistory = chainRes.contractChainHistory || [];
    next.khmdhsContractAmendments = chainRes.contractAmendments || [];
    next.khmdhsAdamChainMeta = chainRes.chainMeta || null;
    // Πρώτο πέρασμα: merge review χωρίς reconcile — το reconcile γίνεται ΜΕΤΑ
    // το applyUserEditsAfterKhmdhsFetch, ώστε τα protected πεδία (π.χ. assignmentProcedure)
    // να είναι ήδη επαναφερμένα όταν υπολογίζεται το hasActionRequired.
    next.khmdhsDataQualityReview = mergeKhmdhsReviewAfterFetch(
      prev.khmdhsDataQualityReview,
      chainRes.dataQualityReport,
      next,
      { singleContractRefresh: true }
    );

    next = applyChainCharacterizationToForm(next, next.khmdhsDataQualityReview);
    next = mergeKhmdhsSupplementaryIntoForm(next);

    let apeConflict = null;
    const userApe = hasRealStoredContractApe(workingPrev, 0)
      ? resolveStoredApeAmount(workingPrev)
      : '';
    const apeRes = applyApeFromChain(userApe, suggestedApe);
    next.apeAmount = apeRes.ape;
    if (apeRes.ape && hasRealStoredContractApe(workingPrev, 0)) {
      next = { ...next, ...syncPreservedContractApeAmount(next, 0, apeRes.ape, workingPrev) };
    } else {
      next = stripPhantomContractApeFromForm(next, workingPrev);
    }
    if (apeRes.conflict) {
      apeConflict = { ...apeRes.conflict, contractIndex: null, contractLabel: '' };
    }

    const statusAutoUpdated = suggestProjectStatusAfterKhmdhsChain(prev.projectStatus, chainRes);
    if (statusAutoUpdated) {
      next.projectStatus = statusAutoUpdated;
    }

    next.khmdhsChainLastRefreshedAt = new Date().toISOString();
    const resolvedAnchor = resolveBranchAnchorFromChain(chainRes, seedAdam, branchAnchor);
    next = mergeBranchAnchorFields(next, {
      anchorAdam: resolvedAnchor.adam,
      anchorType: resolvedAnchor.type,
      actRootReqAdam: inferActRootReqAdam(chainRes, seedAdam),
    });

    // Επαναφορά protected πεδίων (π.χ. assignmentProcedure από fieldOverrides)
    const { form: protectedForm, protectedCount } = applyUserEditsAfterKhmdhsFetch(prev, next);

    // Δεύτερο πέρασμα reconcile: τώρα τα πεδία έχουν τις σωστές τιμές —
    // το hasActionRequired υπολογίζεται με πλήρη εικόνα της φόρμας.
    protectedForm.khmdhsDataQualityReview = reconcileReviewState(
      protectedForm.khmdhsDataQualityReview,
      protectedForm
    );

    return {
      form: protectedForm,
      warnings: [],
      apeConflict,
      statusAutoUpdated,
      protectedCount,
      implementationFormAutoUpdated,
    };
  }

  let contracts = [...(workingPrev.contracts || [])];
  if (contracts.length === 0) contracts = [createEmptyContractRow()];
  const idx = resolvedContractIndex >= 0 ? resolvedContractIndex : 0;
  if (idx >= contracts.length) {
    return {
      form: prev,
      warnings: ['invalidIndex'],
      apeConflict: null,
      statusAutoUpdated: null,
      protectedCount: 0,
      implementationFormAutoUpdated: null,
    };
  }

  const rowWarnings = [];
  let apeConflict = null;

  if (chainRes.contract) {
    const ff = chainRes.contract.formFields || {};
    const prevRow = contracts[idx];
    const userApe = hasRealStoredContractApe(workingPrev, idx)
      ? resolveStoredApeAmount(workingPrev, idx)
      : '';
    const apeRes = applyApeFromChain(userApe, suggestedApe);
    const snapEnd = chainRes.contract.snapshot?.noEndDate
      ? ''
      : String(chainRes.contract.snapshot?.endDate || '').slice(0, 10);
    const apeClearPatch = hasRealStoredContractApe(workingPrev, idx) ? {} : emptyLegacyApeFields();
    contracts[idx] = {
      ...prevRow,
      ...apeClearPatch,
      khmdhsAdam: chainRes.contract.adam,
      khmdhsContractSnapshot: chainRes.contract.snapshot,
      khmdhsContractFetchedAt: chainRes.contract.fetchedAt,
      khmdhsContractRoleLabel: chainRes.contract.roleLabel || '',
      date: ff.contractDate || prevRow.date || '',
      amount: ff.contractAmountSuppressed ? '' : (ff.contractAmount || prevRow.amount || ''),
      contractEndDate: ff.contractEndDate || snapEnd || prevRow.contractEndDate || '',
      apeAmount: apeRes.ape,
      khmdhsContractChainHistory: chainRes.contractChainHistory || [],
      khmdhsContractAmendments: chainRes.contractAmendments || [],
    };
    if (apeRes.ape && hasRealStoredContractApe(workingPrev, idx)) {
      const syncPatch = syncPreservedContractApeAmount(
        { ...workingPrev, contracts },
        idx,
        apeRes.ape,
        workingPrev,
      );
      if (syncPatch.contracts) contracts = syncPatch.contracts;
    }
    if (apeRes.conflict) {
      apeConflict = {
        ...apeRes.conflict,
        contractIndex: idx,
        contractLabel: `Σύμβαση ${idx + 1}`,
      };
    }
  } else {
    const parallelSiblings = resolveParallelContractSiblings(chainRes);
    const rowHasContract = parallelSiblings.length > 1
      && parallelSiblings.every((adam) => {
        const norm = String(adam || '').trim().toUpperCase().replace(/\*+$/, '').replace(/\s+/g, '');
        return contracts.some((c) => {
          const rowAdam = String(c?.khmdhsAdam || '').trim().toUpperCase().replace(/\*+$/, '').replace(/\s+/g, '');
          return rowAdam === norm && (c?.khmdhsContractSnapshot || String(c?.amount || '').trim());
        });
      });
    if (!rowHasContract) {
      rowWarnings.push('noContractInChain');
    }
    contracts[idx] = {
      ...contracts[idx],
      khmdhsContractRoleLabel: '',
    };
  }

  const { next: shared, warnings: sharedWarnings } = mergeSharedKhmdhsFromChain(workingPrev, chainRes, { protect: suppressSituationModal });
  const statusAutoUpdated = chainRes.contract
    ? suggestProjectStatusAfterKhmdhsChain(prev.projectStatus, chainRes)
    : null;

  const mergedForm = {
    ...shared,
    ...(statusAutoUpdated ? { projectStatus: statusAutoUpdated } : {}),
    contracts,
    khmdhsContractAmendments: [],
    khmdhsContractChainHistory: [],
    khmdhsContractRoleLabel: '',
    khmdhsChainSeedAdam: seedAdam || shared.khmdhsChainSeedAdam || '',
    hasSupplementaryContracts: (contractIndex != null && contractIndex >= 0)
      ? !!prev.hasSupplementaryContracts
      : false,
    supplementaryContracts: (contractIndex != null && contractIndex >= 0)
      ? (prev.supplementaryContracts || [])
      : [],
    khmdhsDataQualityReview: mergeKhmdhsReviewAfterFetch(
      prev.khmdhsDataQualityReview,
      chainRes.dataQualityReport,
      { ...shared, ...(statusAutoUpdated ? { projectStatus: statusAutoUpdated } : {}), contracts },
      { contractIndex: idx }
    ),
    khmdhsChainLastRefreshedAt: new Date().toISOString(),
  };
  let nextForm = applyChainCharacterizationToForm(mergedForm, mergedForm.khmdhsDataQualityReview);
  nextForm = applyParallelContractAmountHints(nextForm, chainRes);
  nextForm = mergeKhmdhsSupplementaryIntoForm(nextForm);
  const resolvedAnchor = resolveBranchAnchorFromChain(chainRes, seedAdam, branchAnchor);
  nextForm = mergeBranchAnchorFields(nextForm, {
    anchorAdam: resolvedAnchor.adam,
    anchorType: resolvedAnchor.type,
    actRootReqAdam: inferActRootReqAdam(chainRes, seedAdam),
  });
  // Επαναφορά protected πεδίων πρώτα, μετά reconcile για σωστό hasActionRequired
  const { form: protectedForm, protectedCount } = applyUserEditsAfterKhmdhsFetch(prev, nextForm);
  protectedForm.khmdhsDataQualityReview = reconcileReviewState(
    protectedForm.khmdhsDataQualityReview,
    protectedForm
  );

  return {
    form: protectedForm,
    warnings: [...sharedWarnings, ...rowWarnings],
    apeConflict,
    statusAutoUpdated,
    protectedCount,
    implementationFormAutoUpdated,
  };
}

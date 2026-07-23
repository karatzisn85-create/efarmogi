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
import { mergeKhmdhsPaymentsFromChain } from './khmdhsPaymentsMerge';
import {
  mergeKhmdhsCommitmentsFromChain,
  pickPrimaryCommitmentDecision,
} from './khmdhsCommitmentsMerge';
import { detectStagesCoveredByChainRes } from './khmdhsChainStitchPlan';

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

function mergeCommitmentAndPaymentsFromChain(next, chainRes, {
  protect = false,
  prevPayments,
  prevCommitmentDecisions,
} = {}) {
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
  const baselineCommitments = Array.isArray(prevCommitmentDecisions)
    ? prevCommitmentDecisions
    : next.khmdhsCommitmentDecisions;
  const baselinePayments = Array.isArray(prevPayments)
    ? prevPayments
    : next.khmdhsPayments;
  const skipCommitments = protect && baselineCommitments?.length > 0;
  const skipPayments = protect && baselinePayments?.length > 0;

  if (!skipCommitments) {
    const incomingCommitments = allDecisions.length > 0
      ? allDecisions
      : (chainRes?.commitmentDecision?.adam
        ? [chainRes.commitmentDecision]
        : []);

    // Συγχώνευση όπως στα εντάλματα: stubs χωρίς snapshot δεν αντικαθιστούν καλές αποφάσεις
    // και δεν προστίθενται ως «νέες» όταν αποτυγχάνουν οι λεπτομέρειες.
    const hasBaseline = Array.isArray(baselineCommitments) && baselineCommitments.length > 0;
    if (incomingCommitments.length > 0 || hasBaseline) {
      const merged = mergeKhmdhsCommitmentsFromChain(
        baselineCommitments,
        incomingCommitments
      );
      if (merged.length > 0 || incomingCommitments.length > 0) {
        next.khmdhsCommitmentDecisions = merged;
        const primary = pickPrimaryCommitmentDecision(merged);
        if (primary) {
          next.khmdhsCommitmentAdam = primary.adam || '';
          next.khmdhsCommitmentSnapshot = primary.snapshot || null;
          next.khmdhsCommitmentFetchedAt = primary.fetchedAt || '';
        }
      }
    }
  }

  if (!skipPayments && Array.isArray(chainRes?.payments)) {
    next.khmdhsPayments = mergeKhmdhsPaymentsFromChain(
      baselinePayments,
      chainRes.payments,
      { skippedUnrelated: chainRes.skippedUnrelatedPayments || [] }
    );
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

function unionAdamLists(...lists) {
  const seen = new Set();
  const out = [];
  lists.flat().forEach((v) => {
    const a = sanitizeAdamInput(v);
    if (!a || seen.has(a)) return;
    seen.add(a);
    out.push(a);
  });
  return out;
}

/** Συγχώνευση meta μετά από stitch — δεν πετάει linked Adams του προηγούμενου τμήματος. */
export function mergeKhmdhsChainMetaForStitch(prevMeta, incomingMeta, formAfter) {
  const prev = prevMeta && typeof prevMeta === 'object' ? prevMeta : {};
  const inc = incomingMeta && typeof incomingMeta === 'object' ? incomingMeta : {};
  const prevLinked = prev.linkedAdams || {};
  const incLinked = inc.linkedAdams || {};
  const linkedAdams = {
    requests: unionAdamLists(prevLinked.requests, incLinked.requests, formAfter?.khmdhsRequestAdam),
    approvedRequests: unionAdamLists(prevLinked.approvedRequests, incLinked.approvedRequests),
    budgetCommitments: unionAdamLists(
      prevLinked.budgetCommitments,
      incLinked.budgetCommitments,
      formAfter?.khmdhsCommitmentAdam,
      ...(Array.isArray(formAfter?.khmdhsCommitmentDecisions)
        ? formAfter.khmdhsCommitmentDecisions.map((d) => d?.adam)
        : [])
    ),
    notices: unionAdamLists(prevLinked.notices, incLinked.notices, formAfter?.khmdhsNoticeAdam),
    auctions: unionAdamLists(prevLinked.auctions, incLinked.auctions, formAfter?.khmdhsAwardAdam),
    contracts: unionAdamLists(prevLinked.contracts, incLinked.contracts, formAfter?.khmdhsAdam),
    payments: unionAdamLists(
      prevLinked.payments,
      incLinked.payments,
      ...(Array.isArray(formAfter?.khmdhsPayments)
        ? formAfter.khmdhsPayments.map((p) => p?.adam)
        : [])
    ),
  };
  const allBudgetCommitments = [];
  const seenCommit = new Set();
  [
    ...(Array.isArray(prev.allBudgetCommitments) ? prev.allBudgetCommitments : []),
    ...(Array.isArray(inc.allBudgetCommitments) ? inc.allBudgetCommitments : []),
  ].forEach((d) => {
    const a = sanitizeAdamInput(d?.adam || d?.snapshot?.referenceNumber);
    if (!a || seenCommit.has(a)) return;
    seenCommit.add(a);
    allBudgetCommitments.push(d);
  });

  const hasUpstream = !!(
    linkedAdams.requests.length
    || linkedAdams.notices.length
    || linkedAdams.auctions.length
    || sanitizeAdamInput(formAfter?.khmdhsRequestAdam)
    || sanitizeAdamInput(formAfter?.khmdhsNoticeAdam)
    || sanitizeAdamInput(formAfter?.khmdhsAwardAdam)
  );

  return {
    ...prev,
    ...inc,
    seedAdam: inc.seedAdam || prev.seedAdam || '',
    seedType: inc.seedType || prev.seedType || '',
    resolvedAt: inc.resolvedAt || prev.resolvedAt || '',
    linkedAdams,
    allBudgetCommitments,
    stageCounts: {
      requests: linkedAdams.requests.length,
      approvedRequests: linkedAdams.approvedRequests.length,
      notices: linkedAdams.notices.length,
      auctions: linkedAdams.auctions.length,
      contracts: linkedAdams.contracts.length,
      payments: linkedAdams.payments.length,
    },
    isOrphanSymvSeed: hasUpstream ? false : !!(inc.isOrphanSymvSeed || prev.isOrphanSymvSeed),
    highlightAdams: {
      REQ: sanitizeAdamInput(formAfter?.khmdhsRequestAdam) || prev.highlightAdams?.REQ || inc.highlightAdams?.REQ || null,
      PROC: sanitizeAdamInput(formAfter?.khmdhsNoticeAdam) || prev.highlightAdams?.PROC || inc.highlightAdams?.PROC || null,
      AWRD: sanitizeAdamInput(formAfter?.khmdhsAwardAdam) || prev.highlightAdams?.AWRD || inc.highlightAdams?.AWRD || null,
      SYMV: sanitizeAdamInput(formAfter?.khmdhsAdam) || prev.highlightAdams?.SYMV || inc.highlightAdams?.SYMV || null,
    },
    stitchMerged: true,
  };
}

/**
 * Συρραφή χωρίς wipe: συμπληρώνει κενά, ενημερώνει ίδιο ΑΔΑΜ, δεν αντικαθιστά διαφορετικό ΑΔΑΜ.
 * Μόνο για «Μια Σύμβαση».
 */
export function applyAdamChainResultStitch(prev, chainRes, {
  seedAdam = '',
  branchAnchor = null,
  suppressSituationModal = false,
  userSelectedBranch = false,
} = {}) {
  if (!chainRes?.success) {
    return {
      form: prev,
      warnings: [],
      apeConflict: null,
      statusAutoUpdated: null,
      protectedCount: 0,
      protectedFields: [],
      implementationFormAutoUpdated: null,
      stitchFilledStages: [],
      stitchUpdatedStages: [],
      stitchConflictStages: [],
      stitchCoveredStages: [],
    };
  }

  if (isMultipleContractsForm(prev?.implementationForm)) {
    // Phase 1: δεν υποστηρίζεται — πέφτουμε στο κανονικό apply.
    return applyAdamChainResult(prev, chainRes, {
      seedAdam,
      contractIndex: -1,
      branchAnchor,
      suppressSituationModal,
      userSelectedBranch,
      applyMode: 'replace',
    });
  }

  const prepared = prepareFormForInferredImplementationForm(prev, chainRes, {
    contractIndex: -1,
    userSelectedBranch,
  });
  const workingPrev = prepared.form;
  const implementationFormAutoUpdated = prepared.inferredForm;
  const suggestedApe = chainRes.suggestedApeAmount || '';

  let next = { ...workingPrev };
  const filledStages = [];
  const updatedStages = [];
  const conflictStages = [];
  const warnings = [];

  const stitchScalarStage = ({
    stageId,
    existingAdam,
    existingSnap,
    existingFetched,
    incoming,
    applyIncoming,
  }) => {
    if (!incoming?.snapshot || !sanitizeAdamInput(incoming.adam)) return;
    const ex = sanitizeAdamInput(existingAdam);
    const inc = sanitizeAdamInput(incoming.adam);
    if (!ex) {
      applyIncoming(incoming);
      filledStages.push(stageId);
      return;
    }
    if (ex === inc) {
      applyIncoming(incoming);
      updatedStages.push(stageId);
      return;
    }
    conflictStages.push(stageId);
    warnings.push(`stitchConflict:${stageId.toLowerCase()}`);
  };

  stitchScalarStage({
    stageId: 'REQ',
    existingAdam: workingPrev.khmdhsRequestAdam,
    existingSnap: workingPrev.khmdhsRequestSnapshot,
    existingFetched: workingPrev.khmdhsRequestFetchedAt,
    incoming: chainRes.request,
    applyIncoming: (block) => {
      next.khmdhsRequestAdam = block.adam;
      next.khmdhsRequestSnapshot = block.snapshot;
      next.khmdhsRequestFetchedAt = block.fetchedAt || '';
      if (block.projectBudget && !next.projectBudget) {
        next.projectBudget = block.projectBudget;
      }
    },
  });

  stitchScalarStage({
    stageId: 'PROC',
    existingAdam: workingPrev.khmdhsNoticeAdam,
    existingSnap: workingPrev.khmdhsNoticeSnapshot,
    existingFetched: workingPrev.khmdhsNoticeFetchedAt,
    incoming: chainRes.notice,
    applyIncoming: (block) => {
      next.khmdhsNoticeAdam = block.adam;
      next.khmdhsNoticeSnapshot = block.snapshot;
      next.khmdhsNoticeFetchedAt = block.fetchedAt || '';
      if (block.mappedAssignmentProcedure) {
        next.assignmentProcedure = block.mappedAssignmentProcedure;
      }
      if (block.contractProcessStartDate) {
        next.contractProcessStartDate = block.contractProcessStartDate;
      } else if (chainRes.contractProcessStartDate && !next.contractProcessStartDate) {
        next.contractProcessStartDate = chainRes.contractProcessStartDate;
      }
    },
  });

  stitchScalarStage({
    stageId: 'AWRD',
    existingAdam: workingPrev.khmdhsAwardAdam,
    existingSnap: workingPrev.khmdhsAwardSnapshot,
    existingFetched: workingPrev.khmdhsAwardFetchedAt,
    incoming: chainRes.auction,
    applyIncoming: (block) => {
      next.khmdhsAwardAdam = block.adam;
      next.khmdhsAwardSnapshot = block.snapshot;
      next.khmdhsAwardFetchedAt = block.fetchedAt || '';
    },
  });

  stitchScalarStage({
    stageId: 'SYMV',
    existingAdam: workingPrev.khmdhsAdam,
    existingSnap: workingPrev.khmdhsContractSnapshot,
    existingFetched: workingPrev.khmdhsContractFetchedAt,
    incoming: chainRes.contract,
    applyIncoming: (block) => {
      const ff = block.formFields || {};
      next.khmdhsAdam = block.adam;
      next.khmdhsContractSnapshot = block.snapshot;
      next.khmdhsContractFetchedAt = block.fetchedAt || '';
      next.khmdhsContractRoleLabel = block.roleLabel || next.khmdhsContractRoleLabel || '';
      if (ff.contractDate) next.contractDate = ff.contractDate;
      if (ff.contractEndDate) next.contractEndDate = ff.contractEndDate;
      if (ff.contractAmount && !ff.contractAmountSuppressed) {
        next.contractAmount = ff.contractAmount;
      } else if (ff.contractAmountSuppressed) {
        next.contractAmount = '';
      }
      // Ιστορικό: ενημέρωση όταν εφαρμόζουμε/ενημερώνουμε σύμβαση από αυτό το fetch
      if (Array.isArray(chainRes.contractChainHistory) && chainRes.contractChainHistory.length) {
        next.khmdhsContractChainHistory = chainRes.contractChainHistory;
      }
      if (Array.isArray(chainRes.contractAmendments) && chainRes.contractAmendments.length) {
        next.khmdhsContractAmendments = chainRes.contractAmendments;
      }
    },
  });

  // Αναλήψεις / εντάλματα: πάντα merge κατά ΑΔΑΜ (ποτέ wipe)
  const commitBefore = Array.isArray(workingPrev.khmdhsCommitmentDecisions)
    ? workingPrev.khmdhsCommitmentDecisions.length
    : 0;
  const payBefore = Array.isArray(workingPrev.khmdhsPayments)
    ? workingPrev.khmdhsPayments.length
    : 0;
  mergeCommitmentAndPaymentsFromChain(next, chainRes, {
    prevPayments: workingPrev.khmdhsPayments,
    prevCommitmentDecisions: workingPrev.khmdhsCommitmentDecisions,
  });
  const commitAfter = Array.isArray(next.khmdhsCommitmentDecisions)
    ? next.khmdhsCommitmentDecisions.length
    : 0;
  const payAfter = Array.isArray(next.khmdhsPayments) ? next.khmdhsPayments.length : 0;
  if (commitAfter > commitBefore) filledStages.push('COMMIT');
  else if (commitAfter > 0 && commitBefore > 0) {
    const covered = detectStagesCoveredByChainRes(chainRes);
    if (covered.includes('COMMIT')) updatedStages.push('COMMIT');
  }
  if (payAfter > payBefore) filledStages.push('PAY');
  else if (payAfter > 0 && payBefore > 0) {
    const covered = detectStagesCoveredByChainRes(chainRes);
    if (covered.includes('PAY')) updatedStages.push('PAY');
  }

  next.khmdhsChainSeedAdam = seedAdam || workingPrev.khmdhsChainSeedAdam || '';
  next.khmdhsAdamChainMeta = mergeKhmdhsChainMetaForStitch(
    workingPrev.khmdhsAdamChainMeta,
    chainRes.chainMeta,
    next
  );

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
    actRootReqAdam: inferActRootReqAdam(chainRes, seedAdam)
      || workingPrev.khmdhsActRootReqAdam
      || '',
  });

  // Κρίσιμο: το σχέδιο συρραφής ΔΕΝ σβήνεται σε stitch (μόνο σε πλήρη καθαρισμό)
  if (workingPrev.khmdhsChainStitchPlan) {
    next.khmdhsChainStitchPlan = workingPrev.khmdhsChainStitchPlan;
  }

  const {
    form: protectedForm,
    protectedCount,
    protectedFields = [],
  } = applyUserEditsAfterKhmdhsFetch(prev, next);

  protectedForm.khmdhsDataQualityReview = reconcileReviewState(
    protectedForm.khmdhsDataQualityReview,
    protectedForm
  );

  const stitchCoveredStages = detectStagesCoveredByChainRes(chainRes);

  return {
    form: protectedForm,
    warnings,
    apeConflict,
    statusAutoUpdated,
    protectedCount,
    protectedFields,
    implementationFormAutoUpdated,
    stitchFilledStages: [...new Set(filledStages)],
    stitchUpdatedStages: [...new Set(updatedStages)],
    stitchConflictStages: [...new Set(conflictStages)],
    stitchCoveredStages,
  };
}

export function applyAdamChainResult(prev, chainRes, {
  seedAdam = '',
  contractIndex = -1,
  branchAnchor = null,
  suppressSituationModal = false,
  userSelectedBranch = false,
  symvChainPlan = null,
  applyMode = 'replace',
} = {}) {
  if (!chainRes?.success) {
    return {
      form: prev,
      warnings: [],
      apeConflict: null,
      statusAutoUpdated: null,
      protectedCount: 0,
      protectedFields: [],
      implementationFormAutoUpdated: null,
    };
  }

  if (applyMode === 'stitch' && (contractIndex == null || contractIndex < 0) && !symvChainPlan?.items?.length) {
    return applyAdamChainResultStitch(prev, chainRes, {
      seedAdam,
      branchAnchor,
      suppressSituationModal,
      userSelectedBranch,
    });
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
      protectedFields: [],
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

    // Φάση Β: όταν η ανάκτηση είναι μερική, δεν αδειάζουμε στάδια που είχαμε ήδη σωστά.
    // prevHadStage = είχε αποθηκευμένα στοιχεία πριν την ανάκτηση (ΑΔΑΜ ή snapshot).
    const prevHadStage = {
      contract: !!(workingPrev.khmdhsContractSnapshot || sanitizeAdamInput(workingPrev.khmdhsAdam)),
      notice: !!(workingPrev.khmdhsNoticeSnapshot || sanitizeAdamInput(workingPrev.khmdhsNoticeAdam)),
      award: !!(workingPrev.khmdhsAwardSnapshot || sanitizeAdamInput(workingPrev.khmdhsAwardAdam)),
      request: !!(workingPrev.khmdhsRequestSnapshot || sanitizeAdamInput(workingPrev.khmdhsRequestAdam)),
    };
    const preservedStages = [];
    let noticeConflict = false;

    if (chainRes.contract && chainRes.contract.snapshot) {
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
    } else if (prevHadStage.contract) {
      // Η σύμβαση δεν ήρθε (ή ήρθε χωρίς στοιχεία) — διατηρούμε την προηγούμενη.
      next.khmdhsAdam = workingPrev.khmdhsAdam || '';
      next.khmdhsContractSnapshot = workingPrev.khmdhsContractSnapshot || null;
      next.khmdhsContractFetchedAt = workingPrev.khmdhsContractFetchedAt || '';
      next.khmdhsContractRoleLabel = workingPrev.khmdhsContractRoleLabel || '';
      preservedStages.push('contract');
    }

    if (chainRes.notice && chainRes.notice.snapshot) {
      const incoming = sanitizeAdamInput(chainRes.notice.adam);
      const existing = sanitizeAdamInput(workingPrev.khmdhsNoticeAdam);
      if (existing && incoming && existing !== incoming) {
        // Ίδια πολιτική με το μονοπάτι πολλαπλών συμβάσεων: κράτα την παλιά δημοσίευση.
        noticeConflict = true;
        next.khmdhsNoticeAdam = workingPrev.khmdhsNoticeAdam || '';
        next.khmdhsNoticeSnapshot = workingPrev.khmdhsNoticeSnapshot || null;
        next.khmdhsNoticeFetchedAt = workingPrev.khmdhsNoticeFetchedAt || '';
        if (workingPrev.khmdhsNoticeSnapshot?.mappedAssignmentProcedure) {
          next.assignmentProcedure = workingPrev.khmdhsNoticeSnapshot.mappedAssignmentProcedure;
        } else {
          next.assignmentProcedure = workingPrev.assignmentProcedure || '';
        }
        next.contractProcessStartDate = workingPrev.contractProcessStartDate || '';
      } else {
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
      }
    } else if (prevHadStage.notice) {
      // Η δημοσίευση δεν ήρθε — διατηρούμε την προηγούμενη.
      next.khmdhsNoticeAdam = workingPrev.khmdhsNoticeAdam || '';
      next.khmdhsNoticeSnapshot = workingPrev.khmdhsNoticeSnapshot || null;
      next.khmdhsNoticeFetchedAt = workingPrev.khmdhsNoticeFetchedAt || '';
      next.assignmentProcedure = workingPrev.assignmentProcedure || '';
      next.contractProcessStartDate = workingPrev.contractProcessStartDate || '';
      preservedStages.push('notice');
    } else if (chainRes.contractProcessStartDate) {
      next.contractProcessStartDate = chainRes.contractProcessStartDate;
    }

    if (chainRes.auction?.adam && chainRes.auction?.snapshot) {
      next.khmdhsAwardAdam = chainRes.auction.adam;
      next.khmdhsAwardSnapshot = chainRes.auction.snapshot;
      if (chainRes.auction.fetchedAt) {
        next.khmdhsAwardFetchedAt = chainRes.auction.fetchedAt;
      }
    } else if (prevHadStage.award) {
      // Η ανάθεση/κατακύρωση δεν ήρθε — διατηρούμε την προηγούμενη.
      next.khmdhsAwardAdam = workingPrev.khmdhsAwardAdam || '';
      next.khmdhsAwardSnapshot = workingPrev.khmdhsAwardSnapshot || null;
      next.khmdhsAwardFetchedAt = workingPrev.khmdhsAwardFetchedAt || '';
      preservedStages.push('award');
    }

    if (chainRes.request && chainRes.request.snapshot) {
      mergeRequestFromChain(next, chainRes);
    } else if (prevHadStage.request) {
      // Το πρωτογενές αίτημα δεν ήρθε — διατηρούμε το προηγούμενο.
      next.khmdhsRequestAdam = workingPrev.khmdhsRequestAdam || '';
      next.khmdhsRequestSnapshot = workingPrev.khmdhsRequestSnapshot || null;
      next.khmdhsRequestFetchedAt = workingPrev.khmdhsRequestFetchedAt || '';
      preservedStages.push('request');
    }
    // emptyKhmdhsChainFields() μηδενίζει τις πληρωμές — περνάμε τα προηγούμενα ώστε
    // προσωρινή/μερική ανάκτηση να μην τα σβήσει.
    mergeCommitmentAndPaymentsFromChain(next, chainRes, {
      prevPayments: workingPrev.khmdhsPayments,
      prevCommitmentDecisions: workingPrev.khmdhsCommitmentDecisions,
    });

    // Όταν η σύμβαση διατηρήθηκε (δεν ήρθε), κρατάμε και το ιστορικό/τροποποιήσεις της.
    if (preservedStages.includes('contract')) {
      next.khmdhsContractChainHistory = workingPrev.khmdhsContractChainHistory || [];
      next.khmdhsContractAmendments = workingPrev.khmdhsContractAmendments || [];
    } else {
      next.khmdhsContractChainHistory = chainRes.contractChainHistory || [];
      next.khmdhsContractAmendments = chainRes.contractAmendments || [];
    }
    next.khmdhsAdamChainMeta = chainRes.chainMeta || workingPrev.khmdhsAdamChainMeta || null;
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
    const {
      form: protectedForm,
      protectedCount,
      protectedFields = [],
    } = applyUserEditsAfterKhmdhsFetch(prev, next);

    // Δεύτερο πέρασμα reconcile: τώρα τα πεδία έχουν τις σωστές τιμές —
    // το hasActionRequired υπολογίζεται με πλήρη εικόνα της φόρμας.
    protectedForm.khmdhsDataQualityReview = reconcileReviewState(
      protectedForm.khmdhsDataQualityReview,
      protectedForm
    );

    return {
      form: protectedForm,
      warnings: [
        ...preservedStages.map((s) => `stagePreserved:${s}`),
        ...(noticeConflict ? ['noticeConflict'] : []),
      ],
      apeConflict,
      statusAutoUpdated,
      protectedCount,
      protectedFields,
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
      protectedFields: [],
      implementationFormAutoUpdated: null,
    };
  }

  const rowWarnings = [];
  let apeConflict = null;

  if (chainRes.contract?.snapshot) {
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
  } else if (chainRes.contract && !chainRes.contract.snapshot) {
    // Μερική ανάκτηση σε «Πολλές Συμβάσεις»: ήρθε ΑΔΑΜ χωρίς στοιχεία.
    // Δεν αντικαθιστούμε καλή υπάρχουσα γραμμή με null (ίδια φιλοσοφία με Φάση Β στη μία σύμβαση).
    const prevRow = contracts[idx] || {};
    const hadRow = !!(prevRow.khmdhsContractSnapshot || sanitizeAdamInput(prevRow.khmdhsAdam));
    if (hadRow) {
      contracts[idx] = { ...prevRow };
      rowWarnings.push('stagePreserved:contract');
    } else {
      // Κενή γραμμή: καταγράφουμε μόνο τον ΑΔΑΜ/ετικέτα — χωρίς ψεύτικο snapshot.
      contracts[idx] = {
        ...prevRow,
        khmdhsAdam: chainRes.contract.adam || prevRow.khmdhsAdam || '',
        khmdhsContractRoleLabel: chainRes.contract.roleLabel || prevRow.khmdhsContractRoleLabel || '',
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
  // statusAutoUpdated μόνο όταν ήρθε πραγματική σύμβαση με στοιχεία
  const statusAutoUpdated = chainRes.contract?.snapshot
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
  const {
    form: protectedForm,
    protectedCount,
    protectedFields = [],
  } = applyUserEditsAfterKhmdhsFetch(prev, nextForm);
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
    protectedFields,
    implementationFormAutoUpdated,
  };
}

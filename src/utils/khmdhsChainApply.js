/**
 * Εφαρμογή αποτελέσματος ανάκτησης αλυσίδας ΚΗΜΔΗΣ σε δεδομένα υποέργου.
 */
import { isMultipleContractsForm, emptyKhmdhsOnContract, resolveStoredApeAmount } from './khmdhsFields';
import { syncPreservedContractApeAmount, hasRealStoredContractApe, emptyLegacyApeFields, stripPhantomContractApeFromForm } from './khmdhsApeEntry';
import { applyParallelContractAmountHints, resolveParallelContractSiblings } from './khmdhsParallelContractApply';
import { shouldOfferSymvChainPlanner, resolveReusableSymvChainPlan, mergeStitchChainResForSymvPlan } from './khmdhsSymvChainPlanner';
import { applySymvChainPlanToForm } from './khmdhsSymvChainApply';
import { normalizeAmountForCompare } from './projectFormPhases';
import { prepareFormForInferredImplementationForm } from './khmdhsImplementationFormInference';
import { migrateKhmdhsSingleToMultiForm } from './khmdhsImplementationFormMigration';
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
import {
  detectStagesCoveredByChainRes,
  filterChainResByStitchCovers,
  getStitchPlanSegmentForSeed,
} from './khmdhsChainStitchPlan';
import { filterUnrelatedPayments } from './khmdhsPaymentReconciliation';
import {
  confirmedCancelledAdamSet,
  stripConfirmedCancelledChainLinks,
} from './khmdhsCancelledLinkStrip';

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

function commitmentListSignature(list) {
  return (Array.isArray(list) ? list : [])
    .map((d) => sanitizeAdamInput(d?.adam))
    .filter(Boolean)
    .sort()
    .join('\n');
}

function applyMergedCommitmentsToForm(next, merged) {
  next.khmdhsCommitmentDecisions = merged;
  const primary = pickPrimaryCommitmentDecision(merged);
  if (primary) {
    next.khmdhsCommitmentAdam = primary.adam || '';
    next.khmdhsCommitmentSnapshot = primary.snapshot || null;
    next.khmdhsCommitmentFetchedAt = primary.fetchedAt || '';
  } else {
    next.khmdhsCommitmentAdam = '';
    next.khmdhsCommitmentSnapshot = null;
    next.khmdhsCommitmentFetchedAt = '';
  }
}

/** Κρατά εντάλματα μόνο για τις συμβάσεις της κάρτας και τα συνδεδεμένα πρωτογενή. */
function retainRelatedPaymentsOnForm(next) {
  if (!Array.isArray(next?.khmdhsPayments) || !next.khmdhsPayments.length) return;
  next.khmdhsPayments = filterUnrelatedPayments(next.khmdhsPayments, next);
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
  const skipCommitments = (protect && baselineCommitments?.length > 0)
    || chainRes?.skipCommitmentMerge === true;
  const skipPayments = (protect && baselinePayments?.length > 0)
    || chainRes?.skipPaymentMerge === true;
  const cancelledAdams = Array.isArray(chainRes?.chainMeta?.confirmedCancelledAdams)
    ? chainRes.chainMeta.confirmedCancelledAdams
    : [];

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
        incomingCommitments,
        { cancelledAdams }
      );
      applyMergedCommitmentsToForm(next, merged);
    }
  } else if (cancelledAdams.length) {
    // Συρραφή χωρίς στάδιο ανάληψης / protect: μην εφαρμόζεις νέα λίστα,
    // αλλά αφαίρεσε όσα το ΚΗΜΔΗΣ επιβεβαίωσε ως ακυρωμένα.
    const baseline = Array.isArray(baselineCommitments) && baselineCommitments.length
      ? baselineCommitments
      : (next.khmdhsCommitmentAdam
        ? [{
          adam: next.khmdhsCommitmentAdam,
          snapshot: next.khmdhsCommitmentSnapshot,
          fetchedAt: next.khmdhsCommitmentFetchedAt,
        }]
        : []);
    if (baseline.length) {
      const merged = mergeKhmdhsCommitmentsFromChain(baseline, [], { cancelledAdams });
      if (commitmentListSignature(merged) !== commitmentListSignature(baseline)) {
        applyMergedCommitmentsToForm(next, merged);
      }
    }
  }

  if (!skipPayments && Array.isArray(chainRes?.payments)) {
    next.khmdhsPayments = mergeKhmdhsPaymentsFromChain(
      baselinePayments,
      chainRes.payments,
      {
        skippedUnrelated: chainRes.skippedUnrelatedPayments || [],
        cancelledAdams,
      }
    );
  } else if (cancelledAdams.length && Array.isArray(baselinePayments) && baselinePayments.length) {
    next.khmdhsPayments = mergeKhmdhsPaymentsFromChain(
      baselinePayments,
      [],
      { cancelledAdams }
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

/** Μετά κατανομή SYMV, κράτα στάδια που γέμισαν από άλλα τμήματα συρραφής. */
export function preserveStitchedSharedKhmdhsFields(afterPlan, beforePlan) {
  if (!afterPlan || !beforePlan) return afterPlan;
  const sharedKeys = [
    'khmdhsNoticeAdam',
    'khmdhsNoticeSnapshot',
    'khmdhsNoticeFetchedAt',
    'khmdhsAwardAdam',
    'khmdhsAwardSnapshot',
    'khmdhsAwardFetchedAt',
    'khmdhsRequestAdam',
    'khmdhsRequestSnapshot',
    'khmdhsRequestFetchedAt',
    'khmdhsCommitmentAdam',
    'khmdhsCommitmentSnapshot',
    'khmdhsCommitmentFetchedAt',
    'khmdhsCommitmentDecisions',
    'khmdhsPayments',
  ];
  const out = { ...afterPlan };
  sharedKeys.forEach((key) => {
    const afterVal = out[key];
    const beforeVal = beforePlan[key];
    const afterEmpty = afterVal == null
      || afterVal === ''
      || (Array.isArray(afterVal) && afterVal.length === 0);
    const beforeHas = beforeVal != null
      && beforeVal !== ''
      && !(Array.isArray(beforeVal) && beforeVal.length === 0);
    if (afterEmpty && beforeHas) out[key] = beforeVal;
  });
  return out;
}

function appendLinkedStageSnapshot(next, {
  linkedKey,
  snapshotMapKey,
  adam,
  snapshot,
}) {
  const a = sanitizeAdamInput(adam);
  if (!a) return;
  const meta = next.khmdhsAdamChainMeta && typeof next.khmdhsAdamChainMeta === 'object'
    ? { ...next.khmdhsAdamChainMeta }
    : {};
  const linked = { ...(meta.linkedAdams || {}) };
  const prevList = Array.isArray(linked[linkedKey]) ? linked[linkedKey] : [];
  const seen = new Set(prevList.map((x) => sanitizeAdamInput(x)).filter(Boolean));
  linked[linkedKey] = seen.has(a) ? prevList : [...prevList, a];
  meta.linkedAdams = linked;
  if (snapshot) {
    meta[snapshotMapKey] = {
      ...(meta[snapshotMapKey] || {}),
      [a]: snapshot,
    };
  }
  next.khmdhsAdamChainMeta = meta;
}

function unionSnapshotMaps(...maps) {
  const out = {};
  maps.forEach((m) => {
    if (!m || typeof m !== 'object') return;
    Object.entries(m).forEach(([key, snap]) => {
      const adam = sanitizeAdamInput(key);
      if (adam && snap) out[adam] = snap;
    });
  });
  return out;
}

function filterSnapshotMapExcludingCancelled(map, cancelledSet) {
  const out = {};
  Object.entries(map || {}).forEach(([key, snap]) => {
    const adam = sanitizeAdamInput(key);
    if (!adam || !snap || cancelledSet.has(adam)) return;
    if (snap.cancelled === true) return;
    out[adam] = snap;
  });
  return out;
}

function applyCancelledLinkCleanup(form, chainRes, _prevForm) {
  const cancelled = confirmedCancelledAdamSet(chainRes);
  if (!cancelled.size) return form;
  return stripConfirmedCancelledChainLinks(form, cancelled).form;
}

export function mergeSharedKhmdhsFromChain(prev, chainRes, { protect = false } = {}) {
  const warnings = [];
  const next = { ...prev };
  const extraNotices = [];
  const extraAwards = [];
  const extraRequests = [];
  const cancelledSet = confirmedCancelledAdamSet(chainRes, prev);

  const prevHadNotice = !!(prev.khmdhsNoticeSnapshot || sanitizeAdamInput(prev.khmdhsNoticeAdam));
  const prevHadAward = !!(prev.khmdhsAwardSnapshot || sanitizeAdamInput(prev.khmdhsAwardAdam));
  const prevHadRequest = !!(prev.khmdhsRequestSnapshot || sanitizeAdamInput(prev.khmdhsRequestAdam));

  if (chainRes.notice && chainRes.notice.snapshot) {
    const incoming = sanitizeAdamInput(chainRes.notice.adam);
    const existing = sanitizeAdamInput(prev.khmdhsNoticeAdam);
    if (existing && incoming && existing !== incoming && !cancelledSet.has(existing)) {
      warnings.push('noticeConflict');
      extraNotices.push({ adam: incoming, snapshot: chainRes.notice.snapshot });
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
  } else if (chainRes.notice && !chainRes.notice.snapshot) {
    // Μερική ανάκτηση: ADAM χωρίς στοιχεία — δεν γράφουμε γυμνό stub πάνω σε καλά δεδομένα.
    if (prevHadNotice && !cancelledSet.has(sanitizeAdamInput(prev.khmdhsNoticeAdam))) {
      warnings.push('stagePreserved:notice');
    }
    // Αν δεν υπήρχε τίποτα πριν, απλώς αγνοούμε το stub (next μένει όπως το prev).
  } else if (chainRes.contractProcessStartDate) {
    next.contractProcessStartDate = chainRes.contractProcessStartDate;
  }

  if (chainRes.auction?.adam && chainRes.auction?.snapshot) {
    const incomingA = sanitizeAdamInput(chainRes.auction.adam);
    const existingA = sanitizeAdamInput(prev.khmdhsAwardAdam);
    if (!existingA || existingA === incomingA || cancelledSet.has(existingA)) {
      next.khmdhsAwardAdam = chainRes.auction.adam;
      next.khmdhsAwardSnapshot = chainRes.auction.snapshot;
      if (chainRes.auction.fetchedAt) {
        next.khmdhsAwardFetchedAt = chainRes.auction.fetchedAt;
      }
    } else {
      extraAwards.push({ adam: incomingA, snapshot: chainRes.auction.snapshot });
    }
  } else if (chainRes.auction && !chainRes.auction.snapshot) {
    if (prevHadAward && !cancelledSet.has(sanitizeAdamInput(prev.khmdhsAwardAdam))) {
      warnings.push('stagePreserved:award');
    }
  }

  // Ένωση meta ώστε να μην χαθούν προσκλήσεις/αιτήματα του προηγούμενου πρωτογενούς.
  if (chainRes.chainMeta) {
    if (next.khmdhsAdamChainMeta) {
      next.khmdhsAdamChainMeta = mergeKhmdhsChainMetaForStitch(
        next.khmdhsAdamChainMeta,
        chainRes.chainMeta,
        next
      );
    } else {
      next.khmdhsAdamChainMeta = chainRes.chainMeta;
    }
  }

  if (chainRes.request && chainRes.request.snapshot) {
    const incomingR = sanitizeAdamInput(chainRes.request.adam);
    const existingR = sanitizeAdamInput(next.khmdhsRequestAdam);
    if (existingR && incomingR && existingR !== incomingR && !cancelledSet.has(existingR)) {
      extraRequests.push({ adam: incomingR, snapshot: chainRes.request.snapshot });
      mergeRequestFromChain(next, chainRes, { protect: true });
    } else {
      mergeRequestFromChain(next, chainRes, { protect: false });
    }
  } else if (chainRes.request && !chainRes.request.snapshot) {
    if (prevHadRequest && !cancelledSet.has(sanitizeAdamInput(next.khmdhsRequestAdam))) {
      warnings.push('stagePreserved:request');
    }
  }

  extraNotices.forEach((row) => appendLinkedStageSnapshot(next, {
    linkedKey: 'notices',
    snapshotMapKey: 'noticeSnapshotsByAdam',
    adam: row.adam,
    snapshot: row.snapshot,
  }));
  extraAwards.forEach((row) => appendLinkedStageSnapshot(next, {
    linkedKey: 'auctions',
    snapshotMapKey: 'awardSnapshotsByAdam',
    adam: row.adam,
    snapshot: row.snapshot,
  }));
  extraRequests.forEach((row) => appendLinkedStageSnapshot(next, {
    linkedKey: 'requests',
    snapshotMapKey: 'requestSnapshotsByAdam',
    adam: row.adam,
    snapshot: row.snapshot,
  }));

  mergeCommitmentAndPaymentsFromChain(next, chainRes, { protect });

  return { next: applyCancelledLinkCleanup(next, chainRes, prev), warnings };
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
  if (form?.khmdhsSymvChainPlan?.items?.length) {
    // Η κατανομή κυβερνά ποσά/γραμμές — ενημερώνουμε μόνο ετικέτες ιστορικού από τον χαρακτηρισμό.
    return syncChainHistoryWithReview(form, review);
  }
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
  const thisRefreshCancelled = [...new Set(
    (Array.isArray(inc.confirmedCancelledAdams) ? inc.confirmedCancelledAdams : [])
      .map((a) => sanitizeAdamInput(a))
      .filter(Boolean)
  )];
  const confirmedCancelledAdams = [...new Set(
    [
      ...(Array.isArray(prev.confirmedCancelledAdams) ? prev.confirmedCancelledAdams : []),
      ...thisRefreshCancelled,
    ].map((a) => sanitizeAdamInput(a)).filter(Boolean)
  )];
  const cancelledSet = new Set(thisRefreshCancelled);
  const withoutCancelled = (list) => unionAdamLists(list)
    .filter((a) => !cancelledSet.has(a));
  const prevLinked = prev.linkedAdams || {};
  const incLinked = inc.linkedAdams || {};
  const linkedAdams = {
    requests: withoutCancelled(unionAdamLists(
      prevLinked.requests, incLinked.requests, formAfter?.khmdhsRequestAdam
    )),
    approvedRequests: withoutCancelled(unionAdamLists(
      prevLinked.approvedRequests, incLinked.approvedRequests
    )),
    budgetCommitments: withoutCancelled(unionAdamLists(
      prevLinked.budgetCommitments,
      incLinked.budgetCommitments,
      formAfter?.khmdhsCommitmentAdam,
      ...(Array.isArray(formAfter?.khmdhsCommitmentDecisions)
        ? formAfter.khmdhsCommitmentDecisions.map((d) => d?.adam)
        : [])
    )),
    notices: withoutCancelled(unionAdamLists(
      prevLinked.notices, incLinked.notices, formAfter?.khmdhsNoticeAdam
    )),
    auctions: withoutCancelled(unionAdamLists(
      prevLinked.auctions, incLinked.auctions, formAfter?.khmdhsAwardAdam
    )),
    contracts: withoutCancelled(unionAdamLists(
      prevLinked.contracts, incLinked.contracts, formAfter?.khmdhsAdam
    )),
    payments: withoutCancelled(unionAdamLists(
      prevLinked.payments,
      incLinked.payments,
      ...(Array.isArray(formAfter?.khmdhsPayments)
        ? formAfter.khmdhsPayments.map((p) => p?.adam)
        : [])
    )),
  };
  const allBudgetCommitments = [];
  const seenCommit = new Set();
  [
    ...(Array.isArray(prev.allBudgetCommitments) ? prev.allBudgetCommitments : []),
    ...(Array.isArray(inc.allBudgetCommitments) ? inc.allBudgetCommitments : []),
  ].forEach((d) => {
    const a = sanitizeAdamInput(d?.adam || d?.snapshot?.referenceNumber);
    if (!a || seenCommit.has(a) || cancelledSet.has(a)) return;
    if (d?.snapshot?.cancelled === true) return;
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
    confirmedCancelledAdams,
    noticeSnapshotsByAdam: filterSnapshotMapExcludingCancelled(unionSnapshotMaps(
      prev.noticeSnapshotsByAdam,
      inc.noticeSnapshotsByAdam,
      formAfter?.khmdhsNoticeAdam && formAfter?.khmdhsNoticeSnapshot
        ? { [sanitizeAdamInput(formAfter.khmdhsNoticeAdam)]: formAfter.khmdhsNoticeSnapshot }
        : null
    ), cancelledSet),
    awardSnapshotsByAdam: filterSnapshotMapExcludingCancelled(unionSnapshotMaps(
      prev.awardSnapshotsByAdam,
      inc.awardSnapshotsByAdam,
      formAfter?.khmdhsAwardAdam && formAfter?.khmdhsAwardSnapshot
        ? { [sanitizeAdamInput(formAfter.khmdhsAwardAdam)]: formAfter.khmdhsAwardSnapshot }
        : null
    ), cancelledSet),
    requestSnapshotsByAdam: filterSnapshotMapExcludingCancelled(unionSnapshotMaps(
      prev.requestSnapshotsByAdam,
      inc.requestSnapshotsByAdam,
      formAfter?.khmdhsRequestAdam && formAfter?.khmdhsRequestSnapshot
        ? { [sanitizeAdamInput(formAfter.khmdhsRequestAdam)]: formAfter.khmdhsRequestSnapshot }
        : null
    ), cancelledSet),
    contractSnapshotsByAdam: filterSnapshotMapExcludingCancelled(unionSnapshotMaps(
      prev.contractSnapshotsByAdam,
      inc.contractSnapshotsByAdam
    ), cancelledSet),
  };
}

/**
 * Συρραφή χωρίς wipe: συμπληρώνει κενά, ενημερώνει ίδιο ΑΔΑΜ, δεν αντικαθιστά διαφορετικό ΑΔΑΜ.
 * Για «Πολλές Συμβάσεις» δρομολογεί στο applyAdamChainResultStitchMulti.
 */
export function applyAdamChainResultStitch(prev, chainRes, {
  seedAdam = '',
  branchAnchor = null,
  suppressSituationModal = false,
  userSelectedBranch = false,
  stitchCoversStages = null,
} = {}) {
  const filteredChainRes = filterChainResByStitchCovers(chainRes, stitchCoversStages);
  if (!filteredChainRes?.success) {
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
    return applyAdamChainResultStitchMulti(prev, filteredChainRes, {
      seedAdam,
      branchAnchor,
      suppressSituationModal,
      userSelectedBranch,
      stitchCoversStages,
    });
  }

  chainRes = filteredChainRes;

  const existingSymv = sanitizeAdamInput(prev.khmdhsAdam)
    || sanitizeAdamInput(prev.contracts?.[0]?.khmdhsAdam);
  const incomingSymv = sanitizeAdamInput(chainRes.contract?.adam);
  if (
    existingSymv
    && incomingSymv
    && existingSymv !== incomingSymv
    && chainRes.contract?.snapshot
  ) {
    const promoted = migrateKhmdhsSingleToMultiForm({
      ...prev,
      implementationForm: 'Πολλές Συμβάσεις',
    });
    promoted.implementationForm = 'Πολλές Συμβάσεις';
    return applyAdamChainResultStitchMulti(promoted, chainRes, {
      seedAdam,
      branchAnchor,
      suppressSituationModal,
      userSelectedBranch,
      stitchCoversStages,
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
  const cancelledSet = confirmedCancelledAdamSet(chainRes, workingPrev);

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
    if (!ex || cancelledSet.has(ex)) {
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
    if (stageId === 'REQ') {
      appendLinkedStageSnapshot(next, {
        linkedKey: 'requests',
        snapshotMapKey: 'requestSnapshotsByAdam',
        adam: incoming.adam,
        snapshot: incoming.snapshot,
      });
    } else if (stageId === 'PROC') {
      appendLinkedStageSnapshot(next, {
        linkedKey: 'notices',
        snapshotMapKey: 'noticeSnapshotsByAdam',
        adam: incoming.adam,
        snapshot: incoming.snapshot,
      });
    } else if (stageId === 'AWRD') {
      appendLinkedStageSnapshot(next, {
        linkedKey: 'auctions',
        snapshotMapKey: 'awardSnapshotsByAdam',
        adam: incoming.adam,
        snapshot: incoming.snapshot,
      });
    }
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
  retainRelatedPaymentsOnForm(next);

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

  next = applyCancelledLinkCleanup(next, chainRes, workingPrev);

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

/** Γραμμή με χειροκίνητα ή ΚΗΜΔΗΣ στοιχεία — δεν θεωρείται «κενή» για συρραφή SYMV. */
function contractRowLooksOccupied(row) {
  if (!row || typeof row !== 'object') return false;
  if (sanitizeAdamInput(row.khmdhsAdam) || row.khmdhsContractSnapshot) return true;
  if (String(row.amount || '').trim() || String(row.date || '').trim()) return true;
  if (String(row.apeAmount || '').trim() || String(row.comments || '').trim()) return true;
  if (Array.isArray(row.khmdhsContractChainHistory) && row.khmdhsContractChainHistory.length) {
    return true;
  }
  return false;
}

/**
 * Δρομολόγηση SYMV σε γραμμή πολλών συμβάσεων: ίδιο ΑΔΑΜ → ενημέρωση·
 * πραγματικά κενή γραμμή → γέμισμα· διαφορετικός ΑΔΑΜ → νέα γραμμή (όχι αντικατάσταση).
 */
function resolveStitchMultiSymvRowIndex(contracts, incomingAdam) {
  const adam = sanitizeAdamInput(incomingAdam);
  if (!adam) return { idx: -1, mode: 'none' };
  const matchIdx = contracts.findIndex((c) => sanitizeAdamInput(c?.khmdhsAdam) === adam);
  if (matchIdx >= 0) return { idx: matchIdx, mode: 'match' };
  const emptyIdx = contracts.findIndex((c) => !contractRowLooksOccupied(c));
  if (emptyIdx >= 0) return { idx: emptyIdx, mode: 'empty' };
  return { idx: contracts.length, mode: 'append' };
}

/**
 * Συρραφή για «Πολλές Συμβάσεις»: κοινά στάδια στο υποέργο + SYMV μόνο στη στοχευμένη γραμμή.
 * Ποτέ wipe άλλων γραμμών / κοινών σταδίων.
 */
export function applyAdamChainResultStitchMulti(prev, chainRes, {
  seedAdam = '',
  branchAnchor = null,
  suppressSituationModal = false,
  userSelectedBranch = false,
  stitchCoversStages = null,
} = {}) {
  chainRes = filterChainResByStitchCovers(chainRes, stitchCoversStages);
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

  const prepared = prepareFormForInferredImplementationForm(prev, chainRes, {
    contractIndex: -1,
    userSelectedBranch,
  });
  const workingPrev = prepared.form;
  const implementationFormAutoUpdated = prepared.inferredForm;
  const suggestedApe = chainRes.suggestedApeAmount || '';

  let next = { ...workingPrev };
  let contracts = [...(workingPrev.contracts || [])];
  if (contracts.length === 0) contracts = [createEmptyContractRow()];

  const filledStages = [];
  const updatedStages = [];
  const conflictStages = [];
  const warnings = [];
  let apeConflict = null;
  let appliedSymvSnapshot = false;
  const cancelledSet = confirmedCancelledAdamSet(chainRes, workingPrev);

  const stitchScalarStage = ({
    stageId,
    existingAdam,
    incoming,
    applyIncoming,
  }) => {
    if (!incoming?.snapshot || !sanitizeAdamInput(incoming.adam)) return;
    const ex = sanitizeAdamInput(existingAdam);
    const inc = sanitizeAdamInput(incoming.adam);
    if (!ex || cancelledSet.has(ex)) {
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
    if (stageId === 'REQ') {
      appendLinkedStageSnapshot(next, {
        linkedKey: 'requests',
        snapshotMapKey: 'requestSnapshotsByAdam',
        adam: incoming.adam,
        snapshot: incoming.snapshot,
      });
    } else if (stageId === 'PROC') {
      appendLinkedStageSnapshot(next, {
        linkedKey: 'notices',
        snapshotMapKey: 'noticeSnapshotsByAdam',
        adam: incoming.adam,
        snapshot: incoming.snapshot,
      });
    } else if (stageId === 'AWRD') {
      appendLinkedStageSnapshot(next, {
        linkedKey: 'auctions',
        snapshotMapKey: 'awardSnapshotsByAdam',
        adam: incoming.adam,
        snapshot: incoming.snapshot,
      });
    }
  };

  stitchScalarStage({
    stageId: 'REQ',
    existingAdam: workingPrev.khmdhsRequestAdam,
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
    incoming: chainRes.auction,
    applyIncoming: (block) => {
      next.khmdhsAwardAdam = block.adam;
      next.khmdhsAwardSnapshot = block.snapshot;
      next.khmdhsAwardFetchedAt = block.fetchedAt || '';
    },
  });

  if (chainRes.contract?.snapshot && sanitizeAdamInput(chainRes.contract.adam)) {
    let { idx, mode } = resolveStitchMultiSymvRowIndex(contracts, chainRes.contract.adam);
    if (mode === 'append') {
      // Χειροκίνητη συρραφή (χωρίς φίλτρο σταδίων): νέα σύμβαση δίπλα στις υπάρχουσες.
      // Ανανέωση τεχνητής αλυσίδας (με covers): μην προσθέτεις SKIP / ξένα SYMV.
      const refreshingScoped = Array.isArray(stitchCoversStages) && stitchCoversStages.length > 0;
      if (refreshingScoped) {
        idx = -1;
        mode = 'none';
      } else {
        contracts = [...contracts, createEmptyContractRow()];
        idx = contracts.length - 1;
        mode = 'empty';
      }
    }
    if (idx < 0 || mode === 'none') {
      if (!(Array.isArray(stitchCoversStages) && stitchCoversStages.length > 0)) {
        conflictStages.push('SYMV');
        warnings.push('stitchConflict:symv');
      }
    } else {
      const prevRow = contracts[idx] || createEmptyContractRow();
      const ff = chainRes.contract.formFields || {};
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
        khmdhsContractRoleLabel: chainRes.contract.roleLabel || prevRow.khmdhsContractRoleLabel || '',
        date: ff.contractDate || prevRow.date || '',
        amount: ff.contractAmountSuppressed ? '' : (ff.contractAmount || prevRow.amount || ''),
        contractEndDate: ff.contractEndDate || snapEnd || prevRow.contractEndDate || '',
        apeAmount: apeRes.ape,
        khmdhsContractChainHistory: Array.isArray(chainRes.contractChainHistory)
          && chainRes.contractChainHistory.length
          ? chainRes.contractChainHistory
          : (prevRow.khmdhsContractChainHistory || []),
        khmdhsContractAmendments: Array.isArray(chainRes.contractAmendments)
          && chainRes.contractAmendments.length
          ? chainRes.contractAmendments
          : (prevRow.khmdhsContractAmendments || []),
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
      appliedSymvSnapshot = true;
      if (mode === 'empty' || !sanitizeAdamInput(prevRow.khmdhsAdam)) {
        filledStages.push('SYMV');
      } else {
        updatedStages.push('SYMV');
      }
    }
  }

  next.contracts = contracts;
  // Σε πολλές συμβάσεις το top-level SYMV ιστορικό δεν είναι η πηγή αλήθειας.
  next.khmdhsContractAmendments = [];
  next.khmdhsContractChainHistory = [];
  next.khmdhsContractRoleLabel = '';

  const commitBefore = Array.isArray(workingPrev.khmdhsCommitmentDecisions)
    ? workingPrev.khmdhsCommitmentDecisions.length
    : 0;
  const payBefore = Array.isArray(workingPrev.khmdhsPayments)
    ? workingPrev.khmdhsPayments.length
    : 0;
  // Συρραφή: πάντα merge αναλήψεων/ενταλμάτων — ποτέ skip λόγω suppressSituationModal.
  mergeCommitmentAndPaymentsFromChain(next, chainRes, {
    prevPayments: workingPrev.khmdhsPayments,
    prevCommitmentDecisions: workingPrev.khmdhsCommitmentDecisions,
    protect: false,
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
  retainRelatedPaymentsOnForm(next);

  next.khmdhsDataQualityReview = mergeKhmdhsReviewAfterFetch(
    prev.khmdhsDataQualityReview,
    chainRes.dataQualityReport,
    next,
    { contractIndex: null }
  );

  next = applyChainCharacterizationToForm(next, next.khmdhsDataQualityReview);
  next = applyParallelContractAmountHints(next, chainRes);
  next = mergeKhmdhsSupplementaryIntoForm(next);

  const statusAutoUpdated = appliedSymvSnapshot
    ? suggestProjectStatusAfterKhmdhsChain(prev.projectStatus, chainRes)
    : null;
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

  if (workingPrev.khmdhsChainStitchPlan) {
    next.khmdhsChainStitchPlan = workingPrev.khmdhsChainStitchPlan;
  }

  next = applyCancelledLinkCleanup(next, chainRes, workingPrev);

  const {
    form: protectedForm,
    protectedCount,
    protectedFields = [],
  } = applyUserEditsAfterKhmdhsFetch(prev, next);

  protectedForm.khmdhsDataQualityReview = reconcileReviewState(
    protectedForm.khmdhsDataQualityReview,
    protectedForm
  );

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
    stitchCoveredStages: detectStagesCoveredByChainRes(chainRes),
  };
}

/**
 * Διαδοχική εφαρμογή σπόρων τεχνητής αλυσίδας (κάρτα / μαζική ανανέωση).
 * Φιλτράρει στάδια ανά τμήμα σχεδίου και συγχωνεύει προειδοποιήσεις όλων των σπόρων.
 * Χωρίς stitchResults → μία εφαρμογή με applyMode stitch (ασφαλές για πολλές συμβάσεις).
 */
export function applyStitchRefreshResults(project, stitchResults, {
  fallbackChainRes = null,
  fallbackSeedAdam = '',
  symvChainPlan = null,
} = {}) {
  const plan = project?.khmdhsChainStitchPlan;
  let running = project;
  let lastApply = null;
  const allWarnings = [];
  const filled = [];
  const updated = [];
  const conflicts = [];

  (Array.isArray(stitchResults) ? stitchResults : []).forEach((item) => {
    if (!item?.success || !item.chainRes) return;
    const seg = getStitchPlanSegmentForSeed(plan, item.seedAdam);
    lastApply = applyAdamChainResult(running, item.chainRes, {
      seedAdam: item.seedAdam,
      applyMode: 'stitch',
      stitchCoversStages: Array.isArray(seg?.coversStages) && seg.coversStages.length
        ? seg.coversStages
        : null,
    });
    running = lastApply.form;
    if (Array.isArray(lastApply.warnings)) allWarnings.push(...lastApply.warnings);
    if (Array.isArray(lastApply.stitchFilledStages)) filled.push(...lastApply.stitchFilledStages);
    if (Array.isArray(lastApply.stitchUpdatedStages)) updated.push(...lastApply.stitchUpdatedStages);
    if (Array.isArray(lastApply.stitchConflictStages)) conflicts.push(...lastApply.stitchConflictStages);
  });

  if (!lastApply) {
    return applyAdamChainResult(project, fallbackChainRes, {
      seedAdam: fallbackSeedAdam,
      symvChainPlan,
      applyMode: 'stitch',
    });
  }

  // Μετά το stitch επαναφέρουμε/εφαρμόζουμε την κατανομή SYMV ώστε τα «Δεν καταχωρείται»
  // να μην χαθούν από την τμηματική ανανέωση. Χρησιμοποιούμε ενωμένη αλυσίδα όλων
  // των σπόρων· μετά επαναφέρουμε REQ/PROC/AWRD/PAY που γέμισαν από άλλα τμήματα.
  const planChainRes = mergeStitchChainResForSymvPlan(fallbackChainRes, stitchResults)
    || fallbackChainRes;
  let planToApply = symvChainPlan?.items?.length ? symvChainPlan : null;
  if (!planToApply && project?.khmdhsSymvChainPlan?.items?.length && planChainRes) {
    planToApply = resolveReusableSymvChainPlan(project.khmdhsSymvChainPlan, planChainRes, {
      form: project,
    });
  }

  if (planToApply?.items?.length && planChainRes?.success) {
    const planned = applySymvChainPlanToForm(running, planChainRes, planToApply, {
      seedAdam: fallbackSeedAdam,
      suppressSituationModal: true,
      applyMode: 'stitch',
    });
    return {
      ...planned,
      form: preserveStitchedSharedKhmdhsFields(planned.form, running),
      warnings: [...new Set([...(planned.warnings || []), ...allWarnings])],
      stitchFilledStages: [...new Set(filled)],
      stitchUpdatedStages: [...new Set(updated)],
      stitchConflictStages: [...new Set(conflicts)],
    };
  }

  if (
    planChainRes?.success
    && shouldOfferSymvChainPlanner(planChainRes)
    && !planToApply?.items?.length
  ) {
    return {
      form: project,
      warnings: [...new Set(['symvPlannerRequired', ...allWarnings])],
      apeConflict: null,
      statusAutoUpdated: null,
      protectedCount: 0,
      protectedFields: [],
      implementationFormAutoUpdated: null,
      stitchFilledStages: [...new Set(filled)],
      stitchUpdatedStages: [...new Set(updated)],
      stitchConflictStages: [...new Set(conflicts)],
    };
  }

  return {
    ...lastApply,
    warnings: [...new Set(allWarnings)],
    stitchFilledStages: [...new Set(filled)],
    stitchUpdatedStages: [...new Set(updated)],
    stitchConflictStages: [...new Set(conflicts)],
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
  stitchCoversStages = null,
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
      stitchCoversStages,
    });
  }

  if (symvChainPlan?.items?.length) {
    return applySymvChainPlanToForm(prev, chainRes, symvChainPlan, {
      seedAdam,
      branchAnchor,
      suppressSituationModal,
      applyMode,
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
    const cancelledSet = confirmedCancelledAdamSet(chainRes, workingPrev);

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
    } else if (
      prevHadStage.contract
      && !cancelledSet.has(sanitizeAdamInput(workingPrev.khmdhsAdam))
    ) {
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
      if (existing && incoming && existing !== incoming && !cancelledSet.has(existing)) {
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
    } else if (
      prevHadStage.notice
      && !cancelledSet.has(sanitizeAdamInput(workingPrev.khmdhsNoticeAdam))
    ) {
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
      const incomingA = sanitizeAdamInput(chainRes.auction.adam);
      const existingA = sanitizeAdamInput(workingPrev.khmdhsAwardAdam);
      if (existingA && incomingA && existingA !== incomingA && !cancelledSet.has(existingA)) {
        next.khmdhsAwardAdam = workingPrev.khmdhsAwardAdam || '';
        next.khmdhsAwardSnapshot = workingPrev.khmdhsAwardSnapshot || null;
        next.khmdhsAwardFetchedAt = workingPrev.khmdhsAwardFetchedAt || '';
        appendLinkedStageSnapshot(next, {
          linkedKey: 'auctions',
          snapshotMapKey: 'awardSnapshotsByAdam',
          adam: chainRes.auction.adam,
          snapshot: chainRes.auction.snapshot,
        });
      } else {
        next.khmdhsAwardAdam = chainRes.auction.adam;
        next.khmdhsAwardSnapshot = chainRes.auction.snapshot;
        if (chainRes.auction.fetchedAt) {
          next.khmdhsAwardFetchedAt = chainRes.auction.fetchedAt;
        }
      }
    } else if (
      prevHadStage.award
      && !cancelledSet.has(sanitizeAdamInput(workingPrev.khmdhsAwardAdam))
    ) {
      // Η ανάθεση/κατακύρωση δεν ήρθε — διατηρούμε την προηγούμενη.
      next.khmdhsAwardAdam = workingPrev.khmdhsAwardAdam || '';
      next.khmdhsAwardSnapshot = workingPrev.khmdhsAwardSnapshot || null;
      next.khmdhsAwardFetchedAt = workingPrev.khmdhsAwardFetchedAt || '';
      preservedStages.push('award');
    }

    if (chainRes.request && chainRes.request.snapshot) {
      const incomingR = sanitizeAdamInput(chainRes.request.adam);
      const existingR = sanitizeAdamInput(workingPrev.khmdhsRequestAdam);
      if (existingR && incomingR && existingR !== incomingR && !cancelledSet.has(existingR)) {
        next.khmdhsRequestAdam = workingPrev.khmdhsRequestAdam || '';
        next.khmdhsRequestSnapshot = workingPrev.khmdhsRequestSnapshot || null;
        next.khmdhsRequestFetchedAt = workingPrev.khmdhsRequestFetchedAt || '';
        appendLinkedStageSnapshot(next, {
          linkedKey: 'requests',
          snapshotMapKey: 'requestSnapshotsByAdam',
          adam: chainRes.request.adam,
          snapshot: chainRes.request.snapshot,
        });
      } else {
        mergeRequestFromChain(next, chainRes);
      }
    } else if (
      prevHadStage.request
      && !cancelledSet.has(sanitizeAdamInput(workingPrev.khmdhsRequestAdam))
    ) {
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
    next.khmdhsAdamChainMeta = mergeKhmdhsChainMetaForStitch(
      workingPrev.khmdhsAdamChainMeta,
      chainRes.chainMeta,
      next
    );
    if (noticeConflict && chainRes.notice?.adam && chainRes.notice?.snapshot) {
      appendLinkedStageSnapshot(next, {
        linkedKey: 'notices',
        snapshotMapKey: 'noticeSnapshotsByAdam',
        adam: chainRes.notice.adam,
        snapshot: chainRes.notice.snapshot,
      });
    }
    retainRelatedPaymentsOnForm(next);
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

    next = applyCancelledLinkCleanup(next, chainRes, workingPrev);

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
  retainRelatedPaymentsOnForm(mergedForm);
  let nextForm = applyChainCharacterizationToForm(mergedForm, mergedForm.khmdhsDataQualityReview);
  nextForm = applyParallelContractAmountHints(nextForm, chainRes);
  nextForm = mergeKhmdhsSupplementaryIntoForm(nextForm);
  const resolvedAnchor = resolveBranchAnchorFromChain(chainRes, seedAdam, branchAnchor);
  nextForm = mergeBranchAnchorFields(nextForm, {
    anchorAdam: resolvedAnchor.adam,
    anchorType: resolvedAnchor.type,
    actRootReqAdam: inferActRootReqAdam(chainRes, seedAdam),
  });
  nextForm = applyCancelledLinkCleanup(nextForm, chainRes, workingPrev);
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

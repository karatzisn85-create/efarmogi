/**
 * Ουρά εκκρεμοτήτων μετά την εφαρμογή ανάκτησης ΚΗΜΔΗΣ (Βήμα 1 — απλοποίηση ροής).
 * Προτεραιότητα: κατάσταση → συρραφή Β → μητρώο → ΑΠΕ → λήξη.
 */

import { getUnresolvedReviewItems } from './khmdhsDataQualityReport';
import {
  shouldShowKhmdhsSituationModal,
  KHMDHS_SITUATION_ID_PARALLEL_CONTRACTS,
} from './khmdhsSituationActions';
import { shouldOfferRegistryAfterReview } from './khmdhsDocumentRegistry';
import { evaluateKhmdhsContractExpiryPrompt } from './khmdhsContractExpiryPrompt';
import { formatStitchSegmentScopeLabel } from './khmdhsChainStitchPlan';

export const POST_APPLY_TASK = {
  DATA_REVIEW: 'data_review',
  SITUATION: 'situation',
  STITCH_B: 'stitch_b',
  REGISTRY: 'registry',
  APE: 'ape',
  EXPIRY: 'expiry',
};

const TASK_ORDER = [
  POST_APPLY_TASK.DATA_REVIEW,
  POST_APPLY_TASK.SITUATION,
  POST_APPLY_TASK.STITCH_B,
  POST_APPLY_TASK.REGISTRY,
  POST_APPLY_TASK.APE,
  POST_APPLY_TASK.EXPIRY,
];

/**
 * Φιλτράρισμα καταστάσεων όπως στο finishApply (ProjectForm).
 */
export function filterPostApplySituations(situationReport, {
  acknowledgedIds = [],
  usedSymvPlan = false,
  stitchApplyMode = 'replace',
  hasUnresolvedDQR = false,
} = {}) {
  const ack = new Set(acknowledgedIds || []);
  const filteredSituations = (situationReport?.situations || []).filter((sit) => {
    if (sit.severity === 'error') return true;
    if (ack.has(sit.id)) return false;
    if (usedSymvPlan && sit.id === KHMDHS_SITUATION_ID_PARALLEL_CONTRACTS) return false;
    if (stitchApplyMode === 'stitch' && sit.id === 'orphan_symv_seed') return false;
    if (!hasUnresolvedDQR && (sit.id === 'incomplete_fields' || sit.id === 'contract_amount_fallback')) {
      return false;
    }
    return true;
  });
  const filteredReport = situationReport
    ? { ...situationReport, situations: filteredSituations, hasSituations: filteredSituations.length > 0 }
    : null;
  const filteredHasActionable = filteredSituations.some(
    (sit) => sit.severity === 'error' || sit.severity === 'warning' || sit.requiresDecision
  );
  const shouldShow = !!(
    filteredReport
    && filteredHasActionable
    && shouldShowKhmdhsSituationModal(filteredReport)
  );
  return { filteredReport, shouldShow };
}

export function countUnresolvedDataReview(formAfter, dqr) {
  return getUnresolvedReviewItems(
    dqr || formAfter?.khmdhsDataQualityReview,
    formAfter
  ).length;
}

/**
 * Ποια γραμμή σύμβασης αφορά ενέργεια κατάστασης (λίστα εκκρεμοτήτων ή modal).
 * Προτεραιότητα: ρητό από task/λίστα → modal → null (κοινή αλυσίδα).
 */
export function resolveSituationActionContractIndex(...candidates) {
  for (const c of candidates) {
    if (c != null && Number.isFinite(Number(c)) && Number(c) >= 0) {
      return Number(c);
    }
  }
  return null;
}

/**
 * Χτίζει ουρά μετά-εφαρμογής. Δεν ανοίγει UI — μόνο δεδομένα.
 */
export function buildPostApplyQueue({
  formAfter,
  dqr = null,
  situationReport = null,
  acknowledgedIds = [],
  usedSymvPlan = false,
  stitchApplyMode = 'replace',
  stitchPromptBPayload = null,
  apeConflict = null,
  registryDefer = null,
  statusBeforeKhmdhsApply = null,
  skipExpiry = false,
  /** Γραμμή σύμβασης της ανάκτησης (πολλές συμβάσεις) — για RETRY_SEED από τη λίστα */
  situationContractIndex = null,
} = {}) {
  const unresolvedCount = countUnresolvedDataReview(formAfter, dqr);
  const hasUnresolvedDQR = unresolvedCount > 0;
  const { filteredReport, shouldShow: showSituation } = filterPostApplySituations(situationReport, {
    acknowledgedIds,
    usedSymvPlan,
    stitchApplyMode,
    hasUnresolvedDQR,
  });

  const tasks = [];

  if (hasUnresolvedDQR) {
    tasks.push({
      id: POST_APPLY_TASK.DATA_REVIEW,
      type: POST_APPLY_TASK.DATA_REVIEW,
      question: 'Ολοκληρώστε τον έλεγχο στοιχείων ΚΗΜΔΗΣ (ποσά, χαρακτηρισμοί, ελλείψεις).',
      detail: unresolvedCount === 1
        ? 'Υπάρχει 1 εκκρεμότητα.'
        : `Υπάρχουν ${unresolvedCount} εκκρεμότητες.`,
      priority: 'required',
      unresolvedCount,
    });
  }

  if (showSituation && filteredReport) {
    const primary = filteredReport.situations.find((s) => s.requiresDecision)
      || filteredReport.situations[0];
    const contractIndex = resolveSituationActionContractIndex(situationContractIndex);
    tasks.push({
      id: POST_APPLY_TASK.SITUATION,
      type: POST_APPLY_TASK.SITUATION,
      question: primary?.title || 'Ελέγξτε τις προειδοποιήσεις της ανάκτησης.',
      detail: primary?.message || primary?.summary || '',
      priority: filteredReport.requiresDecision ? 'required' : 'important',
      report: filteredReport,
      contractIndex,
      more: {
        situations: filteredReport.situations.map((s) => ({
          id: s.id,
          title: s.title,
          severity: s.severity,
          message: s.message || s.summary || '',
        })),
      },
    });
  }

  if (stitchPromptBPayload?.segments?.length >= 2) {
    tasks.push({
      id: POST_APPLY_TASK.STITCH_B,
      type: POST_APPLY_TASK.STITCH_B,
      question: 'Να θυμάται η εφαρμογή αυτή την τεχνητή αλυσίδα στις επόμενες ανανεώσεις;',
      detail: `Θα χρησιμοποιεί ${stitchPromptBPayload.segments.length} ΑΔΑΜ-σπόρους.`,
      priority: 'optional',
      payload: stitchPromptBPayload,
      more: {
        segments: stitchPromptBPayload.segments.map((seg) => ({
          adam: seg.seedAdam,
          stages: seg.coversStages || [],
          scopeLabel: formatStitchSegmentScopeLabel(seg),
        })),
      },
    });
  }

  if (registryDefer?.chainFetchedAt) {
    const offer = shouldOfferRegistryAfterReview(formAfter, {
      dismissed: formAfter?.khmdhsDocumentRegistryDismissed,
      chainFetchedAt: registryDefer.chainFetchedAt,
      chainRes: registryDefer.chainRes,
    });
    if (offer) {
      tasks.push({
        id: POST_APPLY_TASK.REGISTRY,
        type: POST_APPLY_TASK.REGISTRY,
        question: 'Θέλετε να καταγράψετε έγγραφα ΚΗΜΔΗΣ στα Αρχεία Υποέργου;',
        detail: 'Προαιρετικό — επιλέγετε ποια έγγραφα θα κρατηθούν.',
        priority: 'optional',
        defer: registryDefer,
      });
    }
  }

  if (apeConflict) {
    tasks.push({
      id: POST_APPLY_TASK.APE,
      type: POST_APPLY_TASK.APE,
      question: 'Το ποσό ΑΠΕ διαφέρει από αυτό που πρότεινε το ΚΗΜΔΗΣ. Τι κρατάτε;',
      detail: apeConflict.contractLabel
        ? `Γραμμή: ${apeConflict.contractLabel}`
        : 'Μπορείτε να κρατήσετε το τρέχον ή να δεχτείτε την πρόταση ΚΗΜΔΗΣ.',
      priority: 'optional',
      payload: apeConflict,
      more: {
        current: apeConflict.current,
        suggested: apeConflict.suggested,
      },
    });
  }

  if (!skipExpiry && formAfter) {
    const expiry = evaluateKhmdhsContractExpiryPrompt(formAfter, {
      statusBeforeKhmdhsRefresh: statusBeforeKhmdhsApply,
    });
    if (expiry) {
      tasks.push({
        id: POST_APPLY_TASK.EXPIRY,
        type: POST_APPLY_TASK.EXPIRY,
        question: 'Η σύμβαση φαίνεται ληγμένη ή κοντά στη λήξη. Να οριστεί η κατάσταση «Ολοκληρωμένο»;',
        detail: expiry.summary || expiry.message || '',
        priority: 'optional',
        payload: expiry,
        more: expiry,
      });
    }
  }

  tasks.sort(
    (a, b) => TASK_ORDER.indexOf(a.type) - TASK_ORDER.indexOf(b.type)
  );

  return {
    tasks,
    needsDataReviewFirst: hasUnresolvedDQR,
    hasFollowUpTasks: tasks.some((t) => t.type !== POST_APPLY_TASK.DATA_REVIEW),
  };
}

export function removeTaskFromQueue(queue, taskId) {
  const tasks = (queue?.tasks || []).filter((t) => t.id !== taskId);
  return {
    ...queue,
    tasks,
    needsDataReviewFirst: tasks.some((t) => t.type === POST_APPLY_TASK.DATA_REVIEW),
    hasFollowUpTasks: tasks.some((t) => t.type !== POST_APPLY_TASK.DATA_REVIEW),
  };
}

export function getFollowUpQueue(queue) {
  if (!queue) return { tasks: [], needsDataReviewFirst: false, hasFollowUpTasks: false };
  const tasks = (queue.tasks || []).filter((t) => t.type !== POST_APPLY_TASK.DATA_REVIEW);
  return {
    tasks,
    needsDataReviewFirst: false,
    hasFollowUpTasks: tasks.length > 0,
  };
}

/**
 * Ξανάνοιγμα λίστας μετά κλείσιμο προειδοποίησης / modal έξω από τη λίστα.
 * Κρατά ΟΛΗ την ουρά (συμπεριλαμβανομένου DATA_REVIEW) — σε αντίθεση με getFollowUpQueue.
 *
 * @returns {{ openPendingTasks: boolean, preserveQueue: true }}
 */
export function resolveReopenPendingList(queue) {
  return {
    openPendingTasks: queueHasPendingWork(queue),
    preserveQueue: true,
  };
}

/** Υπάρχει οποιαδήποτε εκκρεμότητα στην ουρά (υποχρεωτική ή προαιρετική). */
export function queueHasPendingWork(queue) {
  if (!queue) return false;
  if (queue.needsDataReviewFirst || queue.hasFollowUpTasks) return true;
  return Array.isArray(queue.tasks) && queue.tasks.length > 0;
}

/**
 * Μοναδικό αυτόματο UI μετά την ανάκτηση ΚΗΜΔΗΣ.
 * Κανόνας: ανοίγει ΜΟΝΟ η λίστα εκκρεμοτήτων — ποτέ απευθείας έλεγχος/μητρώο/κ.λπ.
 * Τα επιμέρους παράθυρα ανοίγουν μόνο όταν ο χρήστης πατήσει ενέργεια στη λίστα.
 *
 * @param {object} [options]
 * @param {boolean} [options.suppress] — μαζική ανανέωση / silent: χωρίς UI
 * @param {boolean} [options.skip] — συνώνυμο του suppress (όχι skipSituationModal της φόρμας)
 * @returns {{ openPendingTasks: boolean, openDataReview: boolean }}
 */
export function resolvePostFetchUi(queue, { suppress = false, skip = false } = {}) {
  if (suppress || skip) {
    return { openPendingTasks: false, openDataReview: false };
  }
  if (queueHasPendingWork(queue)) {
    return { openPendingTasks: true, openDataReview: false };
  }
  return { openPendingTasks: false, openDataReview: false };
}

/**
 * Μετά το κλείσιμο επιμέρους παραθύρου (έλεγχος / μητρώο): επιστροφή στη λίστα
 * αν μένουν εκκρεμότητες — αλλιώς κλείσιμο.
 */
export function resolveReturnToPendingList(queueAfterRemoval) {
  const hasWork = queueHasPendingWork(queueAfterRemoval);
  return {
    openPendingTasks: hasWork,
    allClear: !hasWork,
  };
}

/**
 * Συγχώνευση ουράς: νέα ανάκτηση (π.χ. συμπληρωματική) δεν σβήνει
 * εκκρεμότητες προηγούμενης κύριας ανάκτησης (μητρώο, ΑΠΕ, κ.λπ.).
 * Αντικαθιστά μόνο ομότυπες εργασίες (π.χ. νέος έλεγχος δεδομένων).
 */
export function mergePostApplyQueues(prev, incoming) {
  if (!incoming) {
    return prev || { tasks: [], needsDataReviewFirst: false, hasFollowUpTasks: false };
  }
  if (!prev?.tasks?.length) return incoming;

  const incomingTasks = Array.isArray(incoming.tasks) ? incoming.tasks : [];
  const incomingTypes = new Set(incomingTasks.map((t) => t.type));
  const keptPrev = (prev.tasks || []).filter((t) => !incomingTypes.has(t.type));
  const tasks = [...incomingTasks, ...keptPrev].sort(
    (a, b) => TASK_ORDER.indexOf(a.type) - TASK_ORDER.indexOf(b.type)
  );
  return {
    tasks,
    needsDataReviewFirst: tasks.some((t) => t.type === POST_APPLY_TASK.DATA_REVIEW),
    hasFollowUpTasks: tasks.some((t) => t.type !== POST_APPLY_TASK.DATA_REVIEW),
  };
}

/**
 * Κατάσταση αναφοράς μαζικής ανανέωσης ΚΗΜΔΗΣ (συγχώνευση εκτελέσεων, εκκρεμότητες).
 *
 * Η αναφορά είναι το ιστορικό της τελευταίας εκτέλεσης· η «Επανάληψη» ενημερώνει μόνο τα
 * υποέργα που ξανατρέξαμε και δεν σβήνει την υπόλοιπη εικόνα.
 *
 * Ο συγχρονισμός με τα υποέργα κλείνει εκκρεμότητες μόνο με θετική απόδειξη επίλυσης —
 * ποτέ επειδή λείπουν ακόμη τα ευρήματα από μια παλιά λίστα στη μνήμη.
 */

import {
  getActionableRefreshAttentionLines,
  getKhmdhsRefreshFindings,
  getKhmdhsSubprojectAttention,
  splitRefreshReportLineBuckets,
  KHMDHS_FINDING_ACTION,
} from './khmdhsRefreshFindings';
import { getUnresolvedReviewItems } from './khmdhsDataQualityReport';

const STATUS = {
  REFRESHED: 'refreshed',
  INTERVENED: 'intervened',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  RESOLVED: 'resolved',
};

function countByStatus(items, status) {
  return items.filter((i) => i.status === status).length;
}

function recount(results, items) {
  return {
    ...results,
    items,
    refreshed: countByStatus(items, STATUS.REFRESHED),
    needsIntervention: countByStatus(items, STATUS.INTERVENED),
    failed: countByStatus(items, STATUS.FAILED),
    skipped: countByStatus(items, STATUS.SKIPPED),
    interventionItems: items
      .filter((i) => i.status === STATUS.INTERVENED && i.id)
      .map((i) => ({ id: i.id, label: i.label })),
  };
}

/** Υπάρχουν αρκετά δεδομένα στο υποέργο για ασφαλή κρίση follow-up; */
function projectHasKhmdhsSyncEvidence(project) {
  if (!project) return false;
  if (getKhmdhsRefreshFindings(project)) return true;
  if (project.khmdhsDataQualityReview?.items?.length) return true;
  if (project.khmdhsSymvChainPlan?.items?.length) return true;
  return false;
}

/** Συγχώνευση αποτελεσμάτων επανάληψης πάνω στην υπάρχουσα αναφορά. */
export function mergeKhmdhsBatchResults(previous, next) {
  const prevItems = Array.isArray(previous?.items) ? previous.items : [];
  if (!prevItems.length) return next;

  const nextItems = Array.isArray(next?.items) ? next.items : [];
  const touched = new Set(nextItems.map((i) => i.id).filter(Boolean));
  const kept = prevItems.filter((i) => !i.id || !touched.has(i.id));
  return recount({ ...previous, ...next }, [...kept, ...nextItems]);
}

/** Μέγιστες αυτόματες στροφές μετά το κλικ «Επανάληψη» — μετά μένει το κουμπί για νέα προσπάθεια. */
export const KHMDHS_RETRY_MAX_ROUNDS = 8;
/** Παύση ανάμεσα σε υποέργα στην επανάληψη, ώστε να μην πνίγεται το ΚΗΜΔΗΣ. */
export const KHMDHS_RETRY_ITEM_GAP_MS = 1500;

/**
 * Υποέργα της αναφοράς που αξίζει να ξανατρέξουν: αποτυχίες, σε χρήση, ή που δεν προλάβαμε.
 */
export function pickKhmdhsBatchRetryCandidates(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter((i) => i?.id && (i.status === 'failed' || i.busy || i.notProcessed))
    .map((i) => ({ id: i.id, label: i.label || i.id }));
}

/** Παύση πριν την επόμενη αυτόματη προσπάθεια (1 = πρώτη παύση μετά το αρχικό πέρασμα). */
export function nextKhmdhsRetryDelayMs(roundAfterFirst) {
  const n = Math.max(1, Number(roundAfterFirst) || 1);
  return Math.min(8000 * n, 30000);
}

/** Σημειώνει υποέργο ως επιλυμένο, ώστε να μη μετρά ξανά ως εκκρεμότητα. */
export function markBatchItemsResolved(results, subprojectIds = []) {
  const ids = new Set(subprojectIds.filter(Boolean));
  const items = Array.isArray(results?.items) ? results.items : [];
  if (!ids.size || !items.length) return results;
  const nextItems = items.map((i) => (
    ids.has(i.id) && i.status === STATUS.INTERVENED
      ? { ...i, status: STATUS.RESOLVED }
      : i
  ));
  return recount(results, nextItems);
}

/** Έχει η εκτέλεση κάτι που αξίζει να κρατηθεί/εμφανιστεί; */
export function batchRunHasOutcome(results) {
  if (!results) return false;
  if ((results.refreshed || 0) > 0) return true;
  if ((results.needsIntervention || 0) > 0) return true;
  if ((results.failed || 0) > 0) return true;
  // Υποέργα που έμειναν σε χρήση ή δεν προλάβαμε: δεν ανανεώθηκαν και πρέπει να φανούν.
  return (results.items || []).some(
    (i) => i.busy || i.notProcessed || (i.actions?.length || 0) > 0
  );
}

/**
 * Εκκρεμεί ακόμη ο χαρακτηρισμός πολλαπλών SYMV για αυτό το υποέργο;
 * (θετική ένδειξη ανοιχτού χαρακτηρισμού — όχι «άγνωστο»).
 */
export function isKhmdhsCharacterizationPending(project) {
  if (!project) return false;
  if (project.khmdhsSymvChainPlan?.items?.length) return false;
  const findings = getKhmdhsRefreshFindings(project);
  const flagged = (findings?.actions || []).some(
    (a) => a.id === KHMDHS_FINDING_ACTION.CHARACTERIZE_SYMV
  );
  if (!flagged) return false;
  if (findings.acknowledgedAt) return false;
  return true;
}

/**
 * Θετική απόδειξη ότι ο χαρακτηρισμός SYMV ολοκληρώθηκε ή έκλεισε ρητά.
 * Η απουσία ευρήματος ΔΕΝ μετρά ως επίλυση (παλιά λίστα / αποτυχία αποθήκευσης).
 */
export function isKhmdhsCharacterizationResolved(project) {
  if (!project) return false;
  if (project.khmdhsSymvChainPlan?.items?.length) return true;
  const findings = getKhmdhsRefreshFindings(project);
  if (!findings) return false;
  const flagged = (findings.actions || []).some(
    (a) => a.id === KHMDHS_FINDING_ACTION.CHARACTERIZE_SYMV
  );
  if (flagged) return !!findings.acknowledgedAt;
  // Χωρίς CHARACTERIZE στα ευρήματα και χωρίς κατανομή: δεν θεωρείται επιλυμένο
  // από την αναφορά «intervened» (μπορεί να μην πρόλαβαν να φορτωθούν τα ευρήματα).
  return false;
}

/** Μια ενέργεια της αναφοράς εξακολουθεί να εκκρεμεί στο ζωντανό υποέργο; */
export function isKhmdhsBatchActionStillPending(project, actionId) {
  if (!project || !actionId) return true;
  switch (actionId) {
    case KHMDHS_FINDING_ACTION.CHARACTERIZE_SYMV:
      // Κρατάμε μέχρι θετική επίλυση — όχι μέχρι «δεν φαίνεται το flag».
      return !isKhmdhsCharacterizationResolved(project);

    case KHMDHS_FINDING_ACTION.DATA_REVIEW: {
      const review = project.khmdhsDataQualityReview;
      if (getUnresolvedReviewItems(review, project).length > 0) return true;
      const findings = getKhmdhsRefreshFindings(project);
      if (
        findings
        && !findings.acknowledgedAt
        && (findings.actions || []).some((a) => a.id === KHMDHS_FINDING_ACTION.DATA_REVIEW)
      ) {
        return true;
      }
      // Θετική ένδειξη φρέσκων δεδομένων: υπάρχει αναφορά ελέγχου ή ευρήματα χωρίς ανοιχτό DATA_REVIEW.
      if (review?.items?.length || findings) return false;
      // Παλιά λίστα χωρίς review/ευρήματα — μην καθαρίσεις την αναφορά.
      return true;
    }

    case KHMDHS_FINDING_ACTION.APE_CONFLICT: {
      const findings = getKhmdhsRefreshFindings(project);
      if (!findings) return true;
      if (findings.acknowledgedAt) return false;
      return (findings.actions || []).some((a) => a.id === KHMDHS_FINDING_ACTION.APE_CONFLICT);
    }

    case KHMDHS_FINDING_ACTION.RETRY_FETCH: {
      const findings = getKhmdhsRefreshFindings(project);
      if (!findings) return true;
      if (findings.acknowledgedAt) return false;
      return !!String(findings.error || '').trim()
        || (findings.actions || []).some((a) => a.id === KHMDHS_FINDING_ACTION.RETRY_FETCH);
    }

    default:
      // Άγνωστη ενέργεια: καλύτερα να μείνει ορατή παρά να εξαφανιστεί σιωπηλά.
      return true;
  }
}

/**
 * Συγχρονίζει την αναφορά μαζικής ανανέωσης με την τρέχουσα κατάσταση των υποέργων:
 * ό,τι λύθηκε στην επεξεργασία (έλεγχος στοιχείων, χαρακτηρισμός κ.λπ.) φεύγει από
 * τις ανοιχτές ενότητες «χρειάζονται ενέργεια».
 *
 * @returns {{ results, cleared: Array<{ id, label, kind }> }}
 */
export function syncBatchReportWithProjects(results, projects = []) {
  const empty = { results, cleared: [] };
  if (!results?.items?.length) return empty;

  const byId = new Map(
    (Array.isArray(projects) ? projects : [])
      .filter((p) => p?.subprojectId)
      .map((p) => [p.subprojectId, p])
  );
  const cleared = [];
  let changed = false;

  const nextItems = results.items.map((item) => {
    const project = byId.get(item.id);
    if (!project) return item;

    if (item.status === STATUS.INTERVENED) {
      if (isKhmdhsCharacterizationResolved(project)) {
        changed = true;
        cleared.push({ id: item.id, label: item.label, kind: 'characterize' });
        return { ...item, status: STATUS.RESOLVED };
      }
      return item;
    }

    if (item.status !== STATUS.REFRESHED || item.followUpClearedAt) return item;

    const actions = Array.isArray(item.actions) ? item.actions : [];
    const hadFollowUp = actions.length > 0 || item.category === 'attention';
    if (!hadFollowUp) return item;

    // Χωρίς ευρήματα/έλεγχο στο υποέργο δεν κρίνουμε — αποφεύγει ψευδή καθαρίσματα
    // αμέσως μετά τη μαζική ανανέωση με παλιά λίστα στη μνήμη.
    if (!projectHasKhmdhsSyncEvidence(project)) return item;

    const remaining = actions.filter((a) => isKhmdhsBatchActionStillPending(project, a.id));
    const attentionStillOpen = item.category === 'attention'
      && remaining.length === 0
      && actions.length === 0
      && getKhmdhsSubprojectAttention(project).total > 0;

    if (remaining.length === actions.length && (remaining.length > 0 || attentionStillOpen)) {
      return item;
    }

    if (remaining.length > 0 || attentionStillOpen) {
      changed = true;
      return { ...item, actions: remaining };
    }

    changed = true;
    cleared.push({ id: item.id, label: item.label, kind: 'followup' });
    return {
      ...item,
      actions: [],
      category: item.category === 'attention' ? 'unchanged' : (item.category || 'applied'),
      followUpClearedAt: new Date().toISOString(),
    };
  });

  if (!changed) return empty;
  return { results: recount(results, nextItems), cleared };
}

export function itemHasIncompleteConfirmation(item) {
  if (!item || item.status !== 'refreshed') return false;
  return splitRefreshReportLineBuckets(item).incompleteLines.length > 0;
}

/** Πραγματική εκκρεμότητα χρήστη — όχι «το ΚΗΜΔΗΣ δεν επιβεβαίωσε / δεν διαγράφηκε». */
export function itemNeedsBatchFollowUp(item) {
  if (!item || item.status !== 'refreshed' || item.followUpClearedAt) return false;
  if ((item.actions?.length || 0) > 0) return true;
  const { attentionLines } = splitRefreshReportLineBuckets(item);
  return getActionableRefreshAttentionLines(attentionLines).length > 0;
}

/**
 * Ομαδοποίηση ενοτήτων της αναφοράς μαζικής ανανέωσης.
 * Η ανεπιβεβαίωση ΚΗΜΔΗΣ είναι δική της ενότητα και δεν μετρά ως «χρειάζονται ενέργεια».
 */
export function partitionKhmdhsBatchReportItems(items = [], pendingItems) {
  const list = Array.isArray(items) ? items : [];
  const refreshedItems = list.filter((i) => i.status === 'refreshed' && i.category === 'applied');
  const unchangedItems = list.filter((i) => (
    i.status === 'refreshed'
    && (i.category === 'unchanged' || (!i.category && !i.hasSubstantiveChanges))
  ));
  const failedItems = list.filter((i) => i.status === 'failed');
  const laterItems = list.filter((i) => i.busy || i.notProcessed);
  const skippedItems = list.filter((i) => i.status === 'skipped' && !i.busy && !i.notProcessed);
  const intervenedFromItems = list.filter((i) => i.status === 'intervened');
  const interventionList = Array.isArray(pendingItems)
    ? pendingItems
    : intervenedFromItems;

  const followUpItems = list.filter((i) => itemNeedsBatchFollowUp(i));
  const followUpIds = new Set(followUpItems.map((i) => i.id));
  const incompleteItems = list.filter((i) => (
    itemHasIncompleteConfirmation(i) && !itemNeedsBatchFollowUp(i)
  ));
  const incompleteIds = new Set(incompleteItems.map((i) => i.id));
  const refreshedOnly = refreshedItems.filter((i) => (
    !followUpIds.has(i.id)
    && !incompleteIds.has(i.id)
    && splitRefreshReportLineBuckets(i).appliedLines.length > 0
  ));
  const unchangedOnly = unchangedItems.filter((i) => (
    !followUpIds.has(i.id) && !incompleteIds.has(i.id)
  ));

  return {
    refreshedItems,
    unchangedItems,
    failedItems,
    laterItems,
    skippedItems,
    intervenedFromItems,
    interventionList,
    followUpItems,
    incompleteItems,
    refreshedOnly,
    unchangedOnly,
  };
}

export function summarizeKhmdhsBatchLiveItems(items = []) {
  const list = Array.isArray(items) ? items : [];
  return {
    items: list,
    refreshed: list.filter((i) => i.status === 'refreshed').length,
    needsIntervention: list.filter((i) => i.status === 'intervened').length,
    failed: list.filter((i) => i.status === 'failed').length,
    skipped: list.filter((i) => i.status === 'skipped').length,
    interventionItems: list
      .filter((i) => i.status === 'intervened' && i.id)
      .map((i) => ({ id: i.id, label: i.label })),
  };
}

function liveSnapshotToReportResults(snap) {
  return {
    items: Array.isArray(snap?.items) ? snap.items : [],
    interventionItems: Array.isArray(snap?.interventionItems) ? snap.interventionItems : [],
    refreshed: snap?.refreshed || 0,
    failed: snap?.failed || 0,
    skipped: snap?.skipped || 0,
    needsIntervention: snap?.needsIntervention || 0,
    isRetry: !!snap?.isRetry,
  };
}

/**
 * Ενημερώνει την αναφορά από τη ζωντανή εικόνα.
 * Σάρωση / κενή έναρξη δεν σβήνουν την προηγούμενη αναφορά — μόνο όταν υπάρχει
 * πραγματική ουρά ξεκινάμε φρέσκια εικόνα.
 * @returns {object|null|undefined} την επόμενη αναφορά· ίδια αναφορά αν δεν πρέπει να αλλάξει
 */
export function applyKhmdhsLiveSnapshotToResults(previous, snap) {
  if (!snap) return previous;
  if (snap.phase === 'scan') return previous;

  const raw = liveSnapshotToReportResults(snap);
  const hasQueue = (Number(snap.total) || 0) > 0 || raw.items.length > 0;

  if (snap.reset && !snap.isRetry) {
    return hasQueue ? raw : previous;
  }
  if (raw.isRetry) {
    if (!raw.items.length) return previous;
    return mergeKhmdhsBatchResults(previous, raw);
  }
  if (!hasQueue) return previous;
  return raw;
}

export function buildKhmdhsLiveRunSnapshot({
  running = false,
  phase = 'run',
  current = 0,
  total = 0,
  itemLabel = '',
  stepMessage = '',
  cancelRequested = false,
  items = [],
  isRetry = false,
  reset = false,
} = {}) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeCurrent = Math.max(0, Number(current) || 0);
  const pct = safeTotal > 0 ? Math.min(100, Math.round((safeCurrent / safeTotal) * 100)) : 0;
  const summary = summarizeKhmdhsBatchLiveItems(items);
  return {
    running: !!running,
    phase: String(phase || 'run'),
    current: safeCurrent,
    total: safeTotal,
    pct,
    itemLabel: String(itemLabel || '').trim(),
    stepMessage: String(stepMessage || '').trim(),
    cancelRequested: !!cancelRequested,
    isRetry: !!isRetry,
    reset: !!reset,
    ...summary,
  };
}

export function formatKhmdhsLiveHeadline(live) {
  if (!live) return '';
  if (live.phase === 'scan') return 'Εντοπισμός υποέργων προς ανανέωση…';
  if (live.phase === 'wait') {
    return live.stepMessage || 'Αναμονή πριν την επόμενη προσπάθεια, για να μην πνιγεί το ΚΗΜΔΗΣ…';
  }
  if (live.phase === 'finishing') return 'Ολοκλήρωση και ενημέρωση της αναφοράς…';
  const of = live.total ? `${live.current} από ${live.total}` : '';
  const name = live.itemLabel;
  const step = live.stepMessage;
  if (name && step) return of ? `${of} — ${name} · ${step}` : `${name} · ${step}`;
  if (name) return of ? `${of} — ${name}` : name;
  if (step) return of ? `${of} — ${step}` : step;
  return of || 'Ανανέωση σε εξέλιξη…';
}

export function formatKhmdhsLiveDockLine(live, { running = false } = {}) {
  if (!running) {
    return 'Ολοκληρώθηκε — ανοίξτε την αναφορά';
  }
  if (!live) return 'Μαζική ανανέωση ΚΗΜΔΗΣ σε εξέλιξη…';
  if (live.phase === 'scan') return 'Εντοπισμός υποέργων…';
  if (live.phase === 'wait') return live.stepMessage || 'Αναμονή πριν την επόμενη προσπάθεια…';
  const count = live.total ? `${live.current} / ${live.total}` : '…';
  const name = live.itemLabel || 'Σε εξέλιξη';
  return `${count} · ${name}`;
}

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
  getKhmdhsRefreshFindings,
  getKhmdhsSubprojectAttention,
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

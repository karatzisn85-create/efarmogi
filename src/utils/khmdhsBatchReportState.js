/**
 * Κατάσταση αναφοράς μαζικής ανανέωσης ΚΗΜΔΗΣ (συγχώνευση εκτελέσεων, εκκρεμότητες).
 *
 * Η αναφορά είναι το ιστορικό της τελευταίας εκτέλεσης· η «Επανάληψη» ενημερώνει μόνο τα
 * υποέργα που ξανατρέξαμε και δεν σβήνει την υπόλοιπη εικόνα.
 */

import { getKhmdhsRefreshFindings, KHMDHS_FINDING_ACTION } from './khmdhsRefreshFindings';

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
 * Επιλύεται όταν οριστεί κατανομή SYMV ή όταν ο χρήστης κλείσει ρητά το εύρημα.
 */
export function isKhmdhsCharacterizationPending(project) {
  if (!project) return false;
  if (project.khmdhsSymvChainPlan?.items?.length) return false;
  const findings = getKhmdhsRefreshFindings(project);
  const flagged = (findings?.actions || []).some(
    (a) => a.id === KHMDHS_FINDING_ACTION.CHARACTERIZE_SYMV
  );
  if (flagged && findings.acknowledgedAt) return false;
  return true;
}

/**
 * Έλεγχοι ταυτόχρονης χρήσης για τα δεδομένα υποέργου.
 *
 * Δύο ανεξάρτητοι μηχανισμοί προστασίας:
 *  1. κλείδωμα — το υποέργο μπορεί να είναι πιασμένο είτε ως υποέργο (ανανέωση ΚΗΜΔΗΣ)
 *     είτε μέσω του έργου του (επεξεργασία από το UI)· πρέπει να ελέγχονται και τα δύο,
 *  2. έκδοση — ο καλών δηλώνει σε ποια εικόνα του υποέργου βασίστηκε, ώστε να μη γράψει
 *     πάνω σε αλλαγές που έγιναν στο μεταξύ από άλλον υπολογιστή.
 */

/**
 * Είναι πιασμένο κάποιο από τα κλειδιά κλειδώματος από άλλον χρήστη;
 * @param {string[]} lockKeys κλειδιά προς έλεγχο (υποέργο και έργο)
 * @param {string} username ο χρήστης που ζητά πρόσβαση
 * @param {(key: string) => {locked?: boolean, lockedBy?: string}} readLock
 */
function resolveBusyStatus(lockKeys, username, readLock) {
  const me = String(username || '').trim();
  const keys = Array.isArray(lockKeys) ? lockKeys : [];
  for (const key of keys) {
    if (!key) continue;
    const status = readLock(key) || {};
    if (status.locked && status.lockedBy && status.lockedBy !== me) {
      return { locked: true, lockedBy: status.lockedBy };
    }
  }
  return { locked: false };
}

/**
 * Άλλαξε το υποέργο στον δίσκο από τότε που το διάβασε ο καλών;
 * Χωρίς δηλωμένη έκδοση δεν μπλοκάρουμε τίποτα (συμβατότητα με παλιές διαδρομές).
 */
function detectSaveConflict(expectedUpdatedAt, existingUpdatedAt) {
  const expected = String(expectedUpdatedAt || '').trim();
  const actual = String(existingUpdatedAt || '').trim();
  if (!expected || !actual || expected === actual) return { conflict: false };
  return { conflict: true, updatedAt: actual };
}

module.exports = { resolveBusyStatus, detectSaveConflict };

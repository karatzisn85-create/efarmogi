/**
 * Πολιτική φόρτωσης αρχικής οθόνης / λίστας υποέργων (απόδοση σε κοινό φάκελο).
 *
 * - Τα egkrisi links φορτώνονται μέσα στο κεντρικό bundle φόρτωσης — όχι δεύτερη κλήση.
 * - Ο μαζικός καθαρισμός κλειδωμάτων γίνεται μία φορά στην έναρξη συνεδρίας,
 *   όχι σε κάθε ανανέωση λίστας.
 */

export const CLEAR_ALL_LOCKS_ON_EVERY_PROJECT_LIST_LOAD = false;

export function shouldClearAllLocksOnProjectListLoad() {
  return CLEAR_ALL_LOCKS_ON_EVERY_PROJECT_LIST_LOAD === true;
}

/**
 * Βήματα πρώτου ανοίγματος Dashboard.
 * @returns {{
 *   loadDataWithCache: true,
 *   loadLinkedEgkriseisSeparately: boolean,
 *   clearAllLocksOnceOnSessionStart: boolean
 * }}
 */
export function getDashboardStartupLoadSteps() {
  return {
    loadDataWithCache: true,
    // loadDataWithCache ήδη καλεί load-egkrisi-links
    loadLinkedEgkriseisSeparately: false,
    clearAllLocksOnceOnSessionStart: true,
  };
}

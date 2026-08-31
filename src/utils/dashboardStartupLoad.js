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

/**
 * Η οθόνη εκκίνησης είναι μόνο για το πρώτο άνοιγμα της αρχικής.
 * Αν είναι ήδη ανοιχτό overlay (Αρχεία Υποέργου, κάρτα, φόρμα),
 * η εμφάνισή της πίσω από το παράθυρο παγώνει την εφαρμογή.
 */
export function shouldShowStartupSplash({ loading, overlayOpen } = {}) {
  return Boolean(loading) && !overlayOpen;
}

/**
 * Ανανέωση δεδομένων με ανοιχτό overlay: χωρίς οθόνη εκκίνησης.
 * Πλήρες reload του χαρτοφυλακίου δεν χρειάζεται όταν άλλαξε μόνο ένα υποέργο.
 */
export function shouldFullReloadPortfolioAfterSubprojectFileUpload() {
  return false;
}

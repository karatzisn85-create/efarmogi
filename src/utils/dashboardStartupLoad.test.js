/**
 * @jest-environment node
 */
import {
  CLEAR_ALL_LOCKS_ON_EVERY_PROJECT_LIST_LOAD,
  shouldClearAllLocksOnProjectListLoad,
  getDashboardStartupLoadSteps,
  shouldShowStartupSplash,
  shouldFullReloadPortfolioAfterSubprojectFileUpload,
} from './dashboardStartupLoad';

describe('dashboardStartupLoad — απόδοση κοινού φακέλου', () => {
  test('η ανανέωση λίστας υποέργων ΔΕΝ καθαρίζει όλα τα κλειδώματα', () => {
    expect(CLEAR_ALL_LOCKS_ON_EVERY_PROJECT_LIST_LOAD).toBe(false);
    expect(shouldClearAllLocksOnProjectListLoad()).toBe(false);
  });

  test('στο άνοιγμα: κεντρική φόρτωση + καθαρισμός κολλημένων κλειδωμάτων, χωρίς διπλά egkrisi links', () => {
    const steps = getDashboardStartupLoadSteps();
    expect(steps.loadDataWithCache).toBe(true);
    expect(steps.loadLinkedEgkriseisSeparately).toBe(false);
    expect(steps.clearAllLocksOnceOnSessionStart).toBe(true);
    // Η ξεχωριστή φόρτωση egkrisi δεν πρέπει να ενεργοποιείται μαζί με την κεντρική
    // (θα προκαλούσε διπλό IPC αν υπήρχαν δύο mount effects).
    expect(steps.loadDataWithCache && steps.loadLinkedEgkriseisSeparately).toBe(false);
  });

  test('με ανοιχτά Αρχεία Υποέργου δεν εμφανίζεται η οθόνη εκκίνησης', () => {
    expect(shouldShowStartupSplash({ loading: true, overlayOpen: true })).toBe(false);
  });

  test('στο πρώτο άνοιγμα η οθόνη εκκίνησης εμφανίζεται', () => {
    expect(shouldShowStartupSplash({ loading: true, overlayOpen: false })).toBe(true);
  });

  test('όταν δεν φορτώνει, η οθόνη εκκίνησης δεν εμφανίζεται', () => {
    expect(shouldShowStartupSplash({ loading: false, overlayOpen: false })).toBe(false);
  });

  test('μετά από ανέβασμα αρχείων δεν ξαναφορτώνεται όλο το χαρτοφυλάκιο', () => {
    expect(shouldFullReloadPortfolioAfterSubprojectFileUpload()).toBe(false);
  });
});

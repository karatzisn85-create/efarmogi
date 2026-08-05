/**
 * @jest-environment node
 */
import {
  CLEAR_ALL_LOCKS_ON_EVERY_PROJECT_LIST_LOAD,
  shouldClearAllLocksOnProjectListLoad,
  getDashboardStartupLoadSteps,
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
});

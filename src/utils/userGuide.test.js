/**
 * @jest-environment node
 */
import {
  computeGuideTargetScrollTop,
  getTourSteps,
  groupedGuideFlows,
  isTourDone,
  markTourDone,
  shouldAutoStartTour,
  tourStorageKey,
  visibleGuideFlows,
} from './userGuide';

function memoryStore(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

describe('userGuide', () => {
  test('η ξενάγηση έχει 4 σκηνές δομής και η τελευταία ανοίγει λεπτομέρειες', () => {
    const steps = getTourSteps();
    expect(steps.map((s) => s.id)).toEqual(['act-group', 'card-body', 'card-actions', 'detail-tabs']);
    expect(steps[3].openDetail).toBe(true);
  });

  test('βήμα 3 εξηγεί μετάβαση σε σελίδα με την κάρτα του υποέργου, χωρίς «τομείς»', () => {
    const step = getTourSteps()[2];
    expect(step.body).toMatch(/αντίστοιχη σελίδα/);
    expect(step.body).toMatch(/ένταξη/);
    expect(step.body).toMatch(/έγκριση διάθεσης πίστωσης/);
    expect(step.body).not.toMatch(/τομέα/);
    expect(step.body).not.toMatch(/φάκελος αρχείων/i);
  });

  test('βήμα 4 εξηγεί κλικ στην κάρτα και δύο καρτέλες με όλα τα δεδομένα', () => {
    const step = getTourSteps()[3];
    expect(step.body).toMatch(/κάρτα του υποέργου/);
    expect(step.body).toMatch(/δύο καρτέλες/);
    expect(step.body).toMatch(/σύνολο των δεδομένων/);
    expect(step.body).not.toMatch(/όχι τα κουμπιά/);
  });

  test('ο οδηγός ομαδοποιεί κάρτες ανά τμήμα και κρατά τη δομή πρώτη', () => {
    const ids = visibleGuideFlows({ role: 'ADMIN', canManageKhmdhs: true }).map((f) => f.id);
    expect(ids.slice(0, 4)).toEqual(['home', 'card', 'files', 'role']);
    expect(ids).toEqual(expect.arrayContaining([
      'deadlines', 'khmdhs', 'notes', 'entaxis', 'proskliseis', 'egkriseis', 'tasks', 'backup',
    ]));
    const groups = groupedGuideFlows({ role: 'ADMIN', canManageKhmdhs: true });
    expect(groups.map((g) => g.id)).toEqual([
      'structure', 'home', 'corner', 'procedures', 'work', 'more',
    ]);
    expect(groups[0].title).toBe('Δομή χαρτοφυλακίου');
  });

  test('ο μηχανικός δεν βλέπει μαζική ΚΗΜΔΗΣ ούτε σύστημα, και η χρέωση εξηγεί τα δικά του έργα', () => {
    const flows = visibleGuideFlows({ role: 'ENGINEER', canManageKhmdhs: false });
    const ids = flows.map((f) => f.id);
    expect(ids).toContain('entaxis');
    expect(ids).toContain('tasks');
    expect(ids).toContain('notes');
    expect(ids).not.toContain('khmdhs');
    expect(ids).not.toContain('backup');
    expect(ids).not.toContain('ep-program');
    const charge = flows.find((f) => f.id === 'charge');
    expect(charge.title).toMatch(/γιατί βλέπω/i);
    const role = flows.find((f) => f.id === 'role');
    expect(role.body).toMatch(/χρεωθεί/);
  });

  test('ο αναγνώστης βλέπει δομή, σύνοψη, αναζήτηση και προθεσμίες', () => {
    const ids = visibleGuideFlows({ role: 'USER', canManageKhmdhs: false }).map((f) => f.id);
    expect(ids).toEqual(['home', 'card', 'files', 'role', 'overview', 'search', 'archive', 'deadlines']);
  });

  test('η πρώτη ξενάγηση ξεκινά μία φορά ανά χρήστη μετά το φόρτωμα', () => {
    const store = memoryStore();
    expect(shouldAutoStartTour({ username: 'maria', role: 'ADMIN', loading: true, storage: store })).toBe(false);
    expect(shouldAutoStartTour({ username: 'maria', role: 'ADMIN', loading: false, storage: store })).toBe(true);
    expect(shouldAutoStartTour({ username: 'maria', role: 'USER', loading: false, storage: store })).toBe(false);
    markTourDone('maria', store);
    expect(store.getItem(tourStorageKey('maria'))).toBe('1');
    expect(isTourDone('maria', store)).toBe(true);
    expect(shouldAutoStartTour({ username: 'maria', role: 'ADMIN', loading: false, storage: store })).toBe(false);
    expect(shouldAutoStartTour({ username: 'giorgos', role: 'ENGINEER', loading: false, storage: store })).toBe(true);
  });

  test('η κύλιση φέρνει το στοιχείο μέσα στο ορατό παράθυρο, χωρίς να κρύβεται κάτω από καπέλο ή κάρτα οδηγού', () => {
    const viewportHeight = 800;
    const headerOffset = 100;
    const bottomReserve = 280;

    const belowFold = computeGuideTargetScrollTop({
      elementTop: 900,
      elementHeight: 80,
      viewportHeight,
      headerOffset,
      bottomReserve,
      currentScroll: 0,
      maxScroll: 4000,
    });
    expect(belowFold).toBeGreaterThan(400);

    const alreadyVisible = computeGuideTargetScrollTop({
      elementTop: 180,
      elementHeight: 80,
      viewportHeight,
      headerOffset,
      bottomReserve,
      currentScroll: 200,
      maxScroll: 4000,
    });
    expect(alreadyVisible).toBe(200);

    const tallGroup = computeGuideTargetScrollTop({
      elementTop: 20,
      elementHeight: 1200,
      viewportHeight,
      headerOffset,
      bottomReserve,
      currentScroll: 0,
      maxScroll: 4000,
    });
    expect(tallGroup).toBe(0);

    const hiddenUnderHeader = computeGuideTargetScrollTop({
      elementTop: 10,
      elementHeight: 80,
      viewportHeight,
      headerOffset,
      bottomReserve,
      currentScroll: 400,
      maxScroll: 4000,
    });
    expect(hiddenUnderHeader).toBeLessThan(400);
  });
});

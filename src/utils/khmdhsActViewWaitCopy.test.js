/**
 * @jest-environment node
 */
import {
  KHMDHS_ACT_VIEW_WAIT_BODY,
  KHMDHS_ACT_VIEW_WAIT_TITLE,
  buildKhmdhsActViewWaitLabel,
} from './khmdhsActViewWaitCopy';
import {
  beginKhmdhsActViewWait,
  cancelKhmdhsActViewWait,
  endKhmdhsActViewWait,
  isKhmdhsActViewWaitGeneration,
  peekKhmdhsActViewWait,
  resetKhmdhsActViewWaitForTests,
  subscribeKhmdhsActViewWait,
} from './khmdhsActViewWaitBridge';

describe('khmdhsActViewWaitCopy', () => {
  test('το μήνυμα ρίχνει την καθυστέρηση στο ΚΗΜΔΗΣ, όχι στην εφαρμογή', () => {
    expect(KHMDHS_ACT_VIEW_WAIT_TITLE).toMatch(/ΚΗΜΔΗΣ/);
    expect(KHMDHS_ACT_VIEW_WAIT_BODY).toMatch(/ΚΗΜΔΗΣ/);
    expect(KHMDHS_ACT_VIEW_WAIT_BODY).toMatch(/μητρώο του Δημοσίου/);
    expect(KHMDHS_ACT_VIEW_WAIT_BODY).toMatch(/εφαρμογή/);
    expect(KHMDHS_ACT_VIEW_WAIT_BODY).toMatch(/ακυρώσετε την αναμονή/);
    expect(KHMDHS_ACT_VIEW_WAIT_BODY).not.toMatch(/σφάλμα της εφαρμογής|δεν αποκρίνεται η εφαρμογή/i);
  });

  test('η ετικέτα εγγράφου εμφανίζεται μόνο όταν υπάρχει όνομα', () => {
    expect(buildKhmdhsActViewWaitLabel('')).toBe('');
    expect(buildKhmdhsActViewWaitLabel('  ')).toBe('');
    expect(buildKhmdhsActViewWaitLabel('Πρωτογενές αίτημα')).toBe('Έγγραφο: Πρωτογενές αίτημα');
  });
});

describe('khmdhsActViewWaitBridge', () => {
  afterEach(() => {
    resetKhmdhsActViewWaitForTests();
  });

  test('ένθετες προβολές κλείνουν την αναμονή μόνο στο τελευταίο τέλος', () => {
    const seen = [];
    const unsub = subscribeKhmdhsActViewWait((state) => seen.push(state.active));
    beginKhmdhsActViewWait({ label: 'A' });
    beginKhmdhsActViewWait({ label: 'B' });
    expect(peekKhmdhsActViewWait().active).toBe(true);
    endKhmdhsActViewWait();
    expect(peekKhmdhsActViewWait().active).toBe(true);
    endKhmdhsActViewWait();
    expect(peekKhmdhsActViewWait().active).toBe(false);
    unsub();
    expect(seen.filter((v) => v === true).length).toBeGreaterThanOrEqual(1);
  });

  test('ακύρωση κλείνει αμέσως την αναμονή και ακυρώνει την γενιά', () => {
    const gen = beginKhmdhsActViewWait({ label: 'A', adam: '25SYMV1' });
    expect(peekKhmdhsActViewWait().active).toBe(true);
    expect(isKhmdhsActViewWaitGeneration(gen)).toBe(true);
    cancelKhmdhsActViewWait();
    expect(peekKhmdhsActViewWait().active).toBe(false);
    expect(isKhmdhsActViewWaitGeneration(gen)).toBe(false);
  });
});

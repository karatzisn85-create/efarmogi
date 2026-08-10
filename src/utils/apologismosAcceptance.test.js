/**
 * @jest-environment node
 *
 * Manual acceptance checklist (υπερδιαχειριστής) — τα παρακάτω είναι invariants
 * που πρέπει να ισχύουν πριν την επίδειξη στον Δήμαρχο. Η χειροκίνητη λίστα:
 * 1) Ένταξη 5–10 πραγματικών ολοκληρωμένων
 * 2) 2–3 legacy παλαιότερα
 * 3) Μίγμα οπτικοποιήσεων 1,2,4,6,8
 * 4) Αλλαγή ποσού → badge → ΟΚ
 * 5) Παρουσίαση οθόνης + PDF + PPTX
 */
const { CATEGORIES, VIZ_MODES, ELIGIBLE_STATUSES } = require('../../public/apologismosDomain');
const { OBJECTIVE_TO_CATEGORY } = require('../../public/apologismosEpSuggest');

describe('apologismos acceptance invariants', () => {
  test('σταθερές παρουσίασης κλειδωμένες', () => {
    expect(CATEGORIES).toHaveLength(9);
    expect(VIZ_MODES).toHaveLength(8);
    expect(ELIGIBLE_STATUSES).toEqual([
      'ΟΛΟΚΛΗΡΩΜΕΝΟ',
      'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ',
    ]);
  });

  test('χαρτογράφηση ΕΠ καλύπτει βασικούς τεχνικούς στόχους', () => {
    expect(OBJECTIVE_TO_CATEGORY['1.3.1']).toBe('roads');
    expect(OBJECTIVE_TO_CATEGORY['1.2.2']).toBe('regeneration');
    expect(OBJECTIVE_TO_CATEGORY['1.3.3']).toBe('water');
    expect(OBJECTIVE_TO_CATEGORY['1.3.6']).toBe('sewerage');
  });
});

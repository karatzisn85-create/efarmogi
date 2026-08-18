/**
 * @jest-environment node
 */
const {
  MANDATORY_PATCH_LAG,
  patchLag,
  isUpdateMandatory,
  enrichUpdateCheckResult,
} = require('../../public/appUpdatePolicy');

describe('appUpdatePolicy', () => {
  test('όριο τριών εκδόσεων στην ίδια γραμμή', () => {
    expect(MANDATORY_PATCH_LAG).toBe(3);
    expect(patchLag('1.4.64', '1.4.65')).toBe(1);
    expect(isUpdateMandatory('1.4.64', '1.4.65')).toBe(false);
    expect(isUpdateMandatory('1.4.63', '1.4.65')).toBe(false);
    expect(isUpdateMandatory('1.4.62', '1.4.65')).toBe(true);
    expect(isUpdateMandatory('1.4.61', '1.4.65')).toBe(true);
  });

  test('αλλαγή minor ή major είναι αμέσως υποχρεωτική', () => {
    expect(isUpdateMandatory('1.4.64', '1.5.0')).toBe(true);
    expect(isUpdateMandatory('1.4.64', '2.0.0')).toBe(true);
  });

  test('σημαία Dropbox κάνει υποχρεωτική και τη +1 έκδοση', () => {
    expect(isUpdateMandatory('1.4.64', '1.4.65', true)).toBe(true);
    expect(isUpdateMandatory('1.4.65', '1.4.65', true)).toBe(false);
  });

  test('χωρίς νέα έκδοση δεν είναι υποχρεωτική', () => {
    expect(isUpdateMandatory('1.4.65', '1.4.64')).toBe(false);
    expect(isUpdateMandatory('1.4.65', '1.4.65')).toBe(false);
    expect(isUpdateMandatory('', '1.4.65')).toBe(false);
  });

  test('εμπλουτισμός αποτελέσματος ελέγχου', () => {
    const enriched = enrichUpdateCheckResult(
      { available: true, version: '1.4.65', mandatory: false },
      '1.4.62'
    );
    expect(enriched.mandatory).toBe(true);
    expect(enriched.flaggedMandatory).toBe(false);
    expect(enriched.patchLag).toBe(3);
  });

  test('αποτυχία ελέγχου δεν χαρακτηρίζεται υποχρεωτική', () => {
    expect(enrichUpdateCheckResult({ available: false, error: 'timeout' }, '1.4.62')).toEqual({
      available: false,
      error: 'timeout',
    });
  });
});

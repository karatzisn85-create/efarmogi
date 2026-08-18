/**
 * @jest-environment node
 */
const {
  sanitizeKhmdhsDateValue,
  isPlausibleKhmdhsCalendarDate,
  pickPaymentDateForRelatedness,
  mapPaymentRecord,
} = require('../../public/khmdhsOpenData');

describe('sanitizeKhmdhsDateValue / PAY relatedness dates', () => {
  test('διορθώνει έτος 0026 → 2026 (πραγματικό bug ΚΗΜΔΗΣ)', () => {
    expect(sanitizeKhmdhsDateValue('0026-01-21T00:25:08')).toBe('2026-01-21T00:25:08');
    expect(isPlausibleKhmdhsCalendarDate('0026-01-21T00:25:08')).toBe(true);
  });

  test('αφήνει κανονικές ημερομηνίες ανέπαφες', () => {
    expect(sanitizeKhmdhsDateValue('2025-10-27T09:26:51.463')).toBe('2025-10-27T09:26:51.463');
  });

  test('pickPaymentDateForRelatedness δεν θεωρεί το 0026 πριν από σύμβαση 2025', () => {
    const payD = pickPaymentDateForRelatedness({
      signedDate: '0026-01-21T00:25:08',
      submissionDate: '2026-06-19T11:53:41.122',
    });
    expect(payD).toBeInstanceOf(Date);
    expect(payD.getFullYear()).toBe(2026);
    const contractDate = new Date('2025-07-18');
    expect(payD < contractDate).toBe(false);
  });

  test('αν το signedDate είναι αδύνατο χωρίς διόρθωση, πέφτει στο submissionDate', () => {
    const payD = pickPaymentDateForRelatedness({
      signedDate: '0999-01-01T00:00:00',
      submissionDate: '2026-06-19T11:53:41.122',
    });
    expect(payD.getFullYear()).toBe(2026);
  });

  test('mapPaymentRecord αποθηκεύει διορθωμένο signedDate', () => {
    const mapped = mapPaymentRecord({
      referenceNumber: '26PAY019269980',
      signedDate: '0026-01-21T00:25:08',
      submissionDate: '2026-06-19T11:53:41.122',
      contractRefNo: '25SYMV018253766',
      totalCostWithVAT: 14570,
    });
    expect(mapped.signedDate).toBe('2026-01-21T00:25:08');
  });
});

/**
 * @jest-environment node
 */
import { summarizeKhmdhsFetchFailure } from './khmdhsFetchFailureSummary';

describe('summarizeKhmdhsFetchFailure', () => {
  test('not-found style message → short retry guidance', () => {
    expect(summarizeKhmdhsFetchFailure(
      'Ο ΑΔΑΜ 26REQ019495415 δεν βρέθηκε ακόμα στα ανοικτά δεδομένα. Αν μόλις αναρτήθηκε, δοκιμάστε ξανά αργότερα.'
    )).toMatch(/δεν είναι ακόμα διαθέσιμος/i);
  });

  test('empty → generic failure', () => {
    expect(summarizeKhmdhsFetchFailure('')).toBe('Δεν ολοκληρώθηκε η ανανέωση');
  });
});

/**
 * @jest-environment node
 */
import {
  formatEuroAmountLabel,
  formatProjectAmountDisplay,
  formatTypedAmountOnBlur,
  normalizeProjectAmountForStorage,
  resolveProjectAmountNumeric,
} from './projectAmountUtils';

describe('projectAmountUtils', () => {
  const awardRef = 236290.21;

  test('διόρθωση ×100 όταν το ποσό είναι εμφανώς λάθος κλιμάκωσης', () => {
    expect(formatProjectAmountDisplay('23.629.021,00', awardRef)).toBe('236.290,21');
    expect(formatProjectAmountDisplay('236290.21', awardRef)).toBe('236.290,21');
    expect(resolveProjectAmountNumeric('23.629.021,00', awardRef)).toBe(236290.21);
  });

  test('διατήρηση σωστής ελληνικής μορφής', () => {
    expect(formatProjectAmountDisplay('236.290,21', awardRef)).toBe('236.290,21');
    expect(normalizeProjectAmountForStorage('236.290,21', awardRef)).toBe('236.290,21');
  });

  test('υπόλοιπο 162.000 χωρίς λεπτά δεν γίνεται 162,00 στην αναφορά', () => {
    expect(formatEuroAmountLabel('162.000')).toBe('162.000,00 €');
    expect(formatEuroAmountLabel('162.000,00')).toBe('162.000,00 €');
    expect(formatTypedAmountOnBlur('162.000')).toBe('162.000,00');
    expect(formatTypedAmountOnBlur('162000')).toBe('162.000,00');
    expect(formatTypedAmountOnBlur('162.000,00')).toBe('162.000,00');
  });

  test('διεθνές δεκαδικό με 1–2 ψηφία παραμένει δεκαδικό', () => {
    expect(formatEuroAmountLabel('162.00')).toBe('162,00 €');
    expect(formatTypedAmountOnBlur('162.00')).toBe('162,00');
  });

  test('πρόσθεση διαφοράς ΑΠΕ με λάθος μορφή σύμβασης', () => {
    const contract = resolveProjectAmountNumeric('236290.21', awardRef);
    const delta = resolveProjectAmountNumeric('62.286,89', awardRef);
    const total = Math.round((contract + delta) * 100) / 100;
    expect(total).toBeCloseTo(298577.1, 2);
  });
});

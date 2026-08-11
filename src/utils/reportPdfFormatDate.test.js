/**
 * @jest-environment node
 *
 * Kept under src/utils (not under components/pdf) because gitignore pattern
 * PDF folders would leave new tests in that folder untracked.
 */

jest.mock('@react-pdf/renderer', () => ({
  StyleSheet: { create: (styles) => styles },
  Font: { register: () => {} },
}));

import { formatDate, formatAmount } from '../components/pdf/ReportStyles';

describe('formatDate (PDF reports)', () => {
  test('YYYY-MM-DD χωρίς UTC shift', () => {
    expect(formatDate('2025-02-05')).toBe('05/02/2025');
  });

  test('ISO με ώρα', () => {
    expect(formatDate('2025-02-05T10:00:00.000Z')).toBe('05/02/2025');
  });

  test('ήδη DD/MM/YYYY', () => {
    expect(formatDate('5/2/2025')).toBe('05/02/2025');
  });

  test('κενό', () => {
    expect(formatDate('')).toBe('—');
    expect(formatDate(null)).toBe('—');
  });
});

describe('formatAmount (PDF reports)', () => {
  test('μηδενικό ποσό δεν γίνεται παύλα', () => {
    expect(formatAmount(0)).toMatch(/0[,.]00/);
  });

  test('κενό → παύλα', () => {
    expect(formatAmount('')).toBe('—');
    expect(formatAmount(null)).toBe('—');
  });

  test('ελληνική μορφοποίηση', () => {
    expect(formatAmount('12500.5')).toMatch(/12\.500,50/);
  });
});

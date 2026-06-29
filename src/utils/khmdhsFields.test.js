/**
 * @jest-environment node
 */
import { parseGreekAmountString } from './khmdhsFields';

describe('parseGreekAmountString', () => {
  test('ελληνική μορφή με χιλιάδες', () => {
    expect(parseGreekAmountString('236.290,21')).toBe(236290.21);
    expect(parseGreekAmountString('1.234.567,89')).toBe(1234567.89);
  });

  test('διεθνής μορφή με μοναδική τελεία ως δεκαδικό', () => {
    expect(parseGreekAmountString('236290.21')).toBe(236290.21);
    expect(parseGreekAmountString('190556.62')).toBe(190556.62);
  });

  test('ακέραια χωρίς διαχωριστικά', () => {
    expect(parseGreekAmountString('256680')).toBe(256680);
  });
});

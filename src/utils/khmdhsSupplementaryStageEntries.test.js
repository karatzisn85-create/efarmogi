/**
 * @jest-environment node
 */
import { isSupplementaryApeEligible } from './khmdhsSupplementaryStageEntries';

describe('isSupplementaryApeEligible', () => {
  test('συμπληρωματική — ναι', () => {
    expect(isSupplementaryApeEligible({
      label: 'Συμπληρωματική σύμβαση',
      isExtension: false,
    })).toBe(true);
  });

  test('παράταση — όχι', () => {
    expect(isSupplementaryApeEligible({
      label: 'Παράταση',
      isExtension: true,
      displayTitle: 'Παράταση 1',
    })).toBe(false);
  });
});

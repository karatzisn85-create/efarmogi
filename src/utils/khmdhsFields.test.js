/**
 * @jest-environment node
 */
import { parseGreekAmountString, sumNonExtensionSupplementaryGross } from './khmdhsFields';

describe('parseGreekAmountString', () => {
  test('ελληνική μορφή με χιλιάδες', () => {
    expect(parseGreekAmountString('236.290,21')).toBe(236290.21);
    expect(parseGreekAmountString('1.234.567,89')).toBe(1234567.89);
    expect(parseGreekAmountString('399.959,77')).toBe(399959.77);
  });

  test('διεθνής μορφή με μοναδική τελεία ως δεκαδικό', () => {
    expect(parseGreekAmountString('236290.21')).toBe(236290.21);
    expect(parseGreekAmountString('190556.62')).toBe(190556.62);
  });

  test('ακέραια χωρίς διαχωριστικά', () => {
    expect(parseGreekAmountString('256680')).toBe(256680);
  });

  test('μοναδική τελεία με 3 ψηφία είναι χιλιάδες, όχι δεκαδικό', () => {
    expect(parseGreekAmountString('162.000')).toBe(162000);
    expect(parseGreekAmountString('1.234')).toBe(1234);
  });
});

describe('sumNonExtensionSupplementaryGross — πλακίδιο κάρτας', () => {
  test('διαβάζει ελληνική μορφή χιλιάδων (όχι parseFloat)', () => {
    const project = {
      hasSupplementaryContracts: true,
      supplementaryContracts: [{ amount: '74.155,85' }],
    };
    expect(sumNonExtensionSupplementaryGross(project)).toBeCloseTo(74155.85, 2);
    expect(parseFloat(String('74.155,85').replace(',', '.'))).toBeCloseTo(74.155, 2);
  });

  test('δεν προσθέτει γραμμές παράτασης', () => {
    const project = {
      hasSupplementaryContracts: true,
      supplementaryContracts: [
        { amount: '10.000,00', comments: 'Συμπληρωματική' },
        { amount: '5.000,00', comments: 'Παράταση', chainKind: 'extension' },
      ],
    };
    expect(sumNonExtensionSupplementaryGross(project)).toBeCloseTo(10000, 2);
  });

  test('με ύποπτη κλίμακα ΚΗΜΔΗΣ δεν δείχνει εκατομμύρια (F6 / πλακίδιο)', () => {
    const project = {
      hasSupplementaryContracts: true,
      contractAmount: '332.101,10',
      supplementaryContracts: [{
        amount: '7.415.585,00',
        khmdhsDerived: true,
      }],
    };
    const n = sumNonExtensionSupplementaryGross(project);
    expect(n).toBeGreaterThan(70000);
    expect(n).toBeLessThan(80000);
  });
});

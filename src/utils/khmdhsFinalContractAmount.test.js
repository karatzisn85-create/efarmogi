/**
 * @jest-environment node
 */

import {
  resolveFinalContractAmountAfterApe,
  FINAL_CONTRACT_AFTER_APE_FULL_LABEL,
} from './khmdhsFields';

describe('resolveFinalContractAmountAfterApe', () => {
  test('χωρίς ΑΠΕ → hasRevision false', () => {
    const r = resolveFinalContractAmountAfterApe({
      contractAmount: '100.000,00',
      apeAmount: '',
      apeEntries: [],
    });
    expect(r.hasRevision).toBe(false);
    expect(r.amount).toBeNull();
  });

  test('τελευταίο χρονικά ΑΠΕ υπερισχύει', () => {
    const r = resolveFinalContractAmountAfterApe({
      contractAmount: '100.000,00',
      apeEntries: [
        { id: 'a', documentDate: '2024-01-10', apeAmount: '110.000,00' },
        { id: 'b', documentDate: '2025-06-01', apeAmount: '125.500,50' },
        { id: 'c', documentDate: '2024-08-20', apeAmount: '118.000,00' },
      ],
    });
    expect(r.hasRevision).toBe(true);
    expect(r.amount).toBeCloseTo(125500.5, 2);
    expect(r.apeDocumentDate).toBe('2025-06-01');
    expect(r.fullLabel).toBe(FINAL_CONTRACT_AFTER_APE_FULL_LABEL);
    expect(r.explanation).toMatch(/αναθεωρήσεις/);
  });

  test('φάντασμα ΑΠΕ ίδιο με σύμβαση αγνοείται', () => {
    const r = resolveFinalContractAmountAfterApe({
      contractAmount: '100.000,00',
      apeAmount: '100.000,00',
      apeEntries: [],
    });
    expect(r.hasRevision).toBe(false);
  });

  test('πολλές συμβάσεις — άθροισμα με ΑΠΕ όπου υπάρχει', () => {
    const r = resolveFinalContractAmountAfterApe({
      implementationForm: 'Πολλές Συμβάσεις',
      contracts: [
        {
          amount: '50.000,00',
          apeEntries: [{ id: '1', documentDate: '2025-01-01', apeAmount: '55.000,00' }],
        },
        {
          amount: '30.000,00',
          apeEntries: [],
        },
      ],
    });
    expect(r.hasRevision).toBe(true);
    expect(r.amount).toBeCloseTo(85000, 2);
  });
});

describe('parity ESM ↔ CJS resolveFinalContractAmountAfterApe', () => {
  const cjs = require('../../public/apologismosFinalContractAmount');

  test('ίδιο αποτέλεσμα σε κοινά σενάρια', () => {
    const samples = [
      { contractAmount: '100.000,00', apeEntries: [] },
      {
        contractAmount: '100.000,00',
        apeEntries: [
          { id: 'a', documentDate: '2024-01-10', apeAmount: '110.000,00' },
          { id: 'b', documentDate: '2025-06-01', apeAmount: '125.500,50' },
        ],
      },
      {
        contractAmount: '80.000,00',
        apeAmount: '80.000,00',
        apeEntries: [],
      },
    ];
    samples.forEach((form) => {
      const a = resolveFinalContractAmountAfterApe(form);
      const b = cjs.resolveFinalContractAmountAfterApe(form);
      expect(b.hasRevision).toBe(a.hasRevision);
      expect(b.amount).toEqual(a.amount);
      expect(b.apeDocumentDate).toBe(a.apeDocumentDate);
    });
  });
});

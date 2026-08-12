/**
 * @jest-environment node
 */
import {
  isCoFinancedProject,
  getVisibleFundingSourceRows,
  syncPrimaryFundingFieldsFromSources,
  parseCoFinancingAmount,
} from './coFinancingDisplay';

describe('coFinancingDisplay', () => {
  test('αναγνωρίζει συγχρηματοδοτούμενο με γραμμές', () => {
    expect(isCoFinancedProject({ coFinanced: true, fundingSources: [{ source: 'Α' }] })).toBe(true);
    expect(isCoFinancedProject({ coFinanced: true, fundingSources: [] })).toBe(false);
    expect(isCoFinancedProject({ fundingSource: 'Α' })).toBe(false);
  });

  test('εμφανίσιμες γραμμές αγνοούν κενές', () => {
    const rows = getVisibleFundingSourceRows({
      coFinanced: true,
      fundingSources: [
        { source: 'ΕΣΠΑ 2021_2027', details: 'κωδ.', amount: '100.000,00' },
        { source: '', details: '', amount: '' },
        { source: 'ΛΟΙΠΑ', details: '1099. ΙΔΙΟΙ ΠΟΡΟΙ', amount: '5.000,00', ownResources: true },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].source).toBe('ΕΣΠΑ 2021_2027');
  });

  test('parseCoFinancingAmount: EL και US δεκαδικά', () => {
    expect(parseCoFinancingAmount('10.000,00')).toBe(10000);
    expect(parseCoFinancingAmount('5000.00')).toBe(5000);
    expect(parseCoFinancingAmount('5,5')).toBe(5.5);
    expect(parseCoFinancingAmount(1200)).toBe(1200);
  });

  test('συγχρονίζει βασική πηγή και εγκεκριμένο από γραμμές', () => {
    const synced = syncPrimaryFundingFieldsFromSources({
      coFinanced: true,
      fundingSource: '',
      fundingDetails: '',
      approvedAmount: '',
      fundingSources: [
        { source: 'ΕΣΠΑ', details: 'Δ1', amount: '10.000,00' },
        { source: 'ΛΟΙΠΑ', details: '1099. ΙΔΙΟΙ ΠΟΡΟΙ', amount: '2.000,00', ownResources: true },
        { source: 'ΦΙΛΟΔΗΜΟΣ', details: 'Δ2', amount: '5.000,00' },
      ],
    });
    expect(synced.fundingSource).toBe('ΕΣΠΑ');
    expect(synced.fundingDetails).toBe('Δ1');
    expect(synced.approvedAmount).toBe('15.000,00');
  });

  test('συγχρονισμός δεν χαλάει ποσά τύπου 5000.00', () => {
    const synced = syncPrimaryFundingFieldsFromSources({
      coFinanced: true,
      fundingSources: [
        { source: 'ΕΣΠΑ', details: 'Δ1', amount: '5000.00' },
        { source: 'ΦΙΛΟΔΗΜΟΣ', details: 'Δ2', amount: '2500.50' },
      ],
    });
    expect(synced.approvedAmount).toBe('7.500,50');
  });
});

import {
  formatEntaxiAmount,
  formatEntaxiAmountDelta,
  getEntaxiCurrentTotal,
  getModificationAmountFlowEntry
} from './entaxiAmountUtils';

describe('entaxiAmountUtils', () => {
  const sampleEntaxi = {
    initialAmount: '160.000,00',
    modifications: [
      {
        modificationId: 'm1',
        changeAmount: false,
        amount: '',
        comments: 'Μόνο κείμενο'
      },
      {
        modificationId: 'm2',
        changeAmount: true,
        amount: '155.874,00',
        comments: 'Μείωση στο ποσό σύμβασης'
      },
      {
        modificationId: 'm3',
        changeAmount: true,
        amount: '155.285,47',
        comments: 'Μείωση στο ύψος πληρωμών'
      }
    ]
  };

  test('διαδοχικές απόλυτες αλλαγές ποσού αντικαθιστούν το σύνολο (όχι πρόσθεση)', () => {
    expect(getEntaxiCurrentTotal(sampleEntaxi)).toBeCloseTo(155285.47, 2);
    // Δεν πρέπει να βγει 160000 + 155874 + 155285.47
    expect(getEntaxiCurrentTotal(sampleEntaxi)).not.toBeCloseTo(471159.47, 0);
  });

  test('τροποποίηση χωρίς αλλαγή ποσού δεν επηρεάζει το σύνολο', () => {
    expect(getEntaxiCurrentTotal(sampleEntaxi, { upToIndexInclusive: 0 })).toBeCloseTo(160000, 2);
  });

  test('σύνολο πριν από νέα τροποποίηση = τελευταίο απόλυτο ποσό', () => {
    expect(getEntaxiCurrentTotal(sampleEntaxi, { beforeModificationId: 'm3' })).toBeCloseTo(155874, 2);
  });

  test('ροή εμφάνισης: χωρίς ποσό → none, με ποσό → absolute + σωστό delta', () => {
    expect(getModificationAmountFlowEntry(sampleEntaxi, 0)).toEqual({ kind: 'none' });

    const entry2 = getModificationAmountFlowEntry(sampleEntaxi, 1);
    expect(entry2.kind).toBe('absolute');
    expect(entry2.newTotal).toBeCloseTo(155874, 2);
    expect(entry2.previousTotal).toBeCloseTo(160000, 2);
    expect(entry2.delta).toBeCloseTo(-4126, 2);

    const entry3 = getModificationAmountFlowEntry(sampleEntaxi, 2);
    expect(entry3.newTotal).toBeCloseTo(155285.47, 2);
    expect(entry3.previousTotal).toBeCloseTo(155874, 2);
    expect(entry3.delta).toBeCloseTo(-588.53, 2);
  });

  test('format helpers', () => {
    expect(formatEntaxiAmount(155285.47)).toBe('155.285,47');
    expect(formatEntaxiAmountDelta(-588.53)).toBe('−588,53');
    expect(formatEntaxiAmountDelta(4126)).toBe('+4.126,00');
  });

  test('legacy: changeAmount true με κενό ποσό αγνοείται', () => {
    const entaxi = {
      initialAmount: '100.000,00',
      modifications: [{ changeAmount: true, amount: '' }]
    };
    expect(getEntaxiCurrentTotal(entaxi)).toBeCloseTo(100000, 2);
  });
});

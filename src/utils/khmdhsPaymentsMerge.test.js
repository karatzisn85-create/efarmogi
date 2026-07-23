/**
 * @jest-environment node
 */
import { mergeKhmdhsPaymentsFromChain } from './khmdhsPaymentsMerge';

describe('mergeKhmdhsPaymentsFromChain', () => {
  const pay1 = {
    adam: '26PAY000000001',
    snapshot: { referenceNumber: '26PAY000000001', totalCostWithVAT: 10000 },
    fetchedAt: '2026-01-01T00:00:00.000Z',
  };
  const pay2Stub = {
    adam: '26PAY000000002',
    snapshot: null,
    error: 'Το ΚΗΜΔΗΣ δέχεται πολλά αιτήματα αυτή τη στιγμή.',
  };

  test('διατηρεί παλιό ένταλμα που λείπει από το νέο fetch', () => {
    const merged = mergeKhmdhsPaymentsFromChain(
      [pay1, pay2Stub],
      [pay1],
      {}
    );
    expect(merged).toHaveLength(2);
    expect(merged.map((p) => p.adam).sort()).toEqual([
      '26PAY000000001',
      '26PAY000000002',
    ]);
  });

  test('δεν προσθέτει νέο stub χωρίς λεπτομέρειες (άγνωστη σχετικότητα)', () => {
    const merged = mergeKhmdhsPaymentsFromChain(
      [pay1],
      [
        pay1,
        {
          adam: '26PAY019269980',
          snapshot: null,
          error: 'πολλά αιτήματα',
        },
      ],
      {}
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].adam).toBe('26PAY000000001');
  });

  test('δεν αντικαθιστά καλό snapshot με null όταν αποτύχει η λεπτομέρεια', () => {
    const merged = mergeKhmdhsPaymentsFromChain(
      [pay1],
      [{ adam: '26PAY000000001', snapshot: null, error: 'timeout' }],
      {}
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].snapshot).toEqual(pay1.snapshot);
    expect(merged[0].error).toBe('timeout');
  });

  test('αναβαθμίζει stub όταν έρθει πραγματικό snapshot', () => {
    const fresh = {
      adam: '26PAY000000002',
      snapshot: { referenceNumber: '26PAY000000002', totalCostWithVAT: 5000 },
      fetchedAt: '2026-07-01T00:00:00.000Z',
    };
    const merged = mergeKhmdhsPaymentsFromChain([pay2Stub], [fresh], {});
    expect(merged).toHaveLength(1);
    expect(merged[0].snapshot.totalCostWithVAT).toBe(5000);
    expect(merged[0].error).toBe('');
  });

  test('μεταφέρει χειροκίνητα πεδία χρήστη στο νέο snapshot', () => {
    const prev = {
      ...pay1,
      userDocumentRole: 'informative',
      userDocumentLabel: 'Ενημερωτικό',
      userActualAmount: 8000,
    };
    const fresh = {
      adam: '26PAY000000001',
      snapshot: { referenceNumber: '26PAY000000001', totalCostWithVAT: 10000 },
      fetchedAt: '2026-07-01T00:00:00.000Z',
    };
    const merged = mergeKhmdhsPaymentsFromChain([prev], [fresh], {});
    expect(merged[0].userDocumentRole).toBe('informative');
    expect(merged[0].userDocumentLabel).toBe('Ενημερωτικό');
    expect(merged[0].userActualAmount).toBe(8000);
  });

  test('αφαιρεί ένταλμα μόνο αν είναι στα skippedUnrelated', () => {
    const merged = mergeKhmdhsPaymentsFromChain(
      [pay1, pay2Stub],
      [pay1],
      { skippedUnrelated: [{ adam: '26PAY000000002', unrelatedContractRef: '25SYMV999' }] }
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].adam).toBe('26PAY000000001');
  });

  test('κενό νέο fetch διατηρεί όλα τα προηγούμενα', () => {
    const merged = mergeKhmdhsPaymentsFromChain([pay1, pay2Stub], [], {});
    expect(merged).toHaveLength(2);
  });
});

/**
 * @jest-environment node
 */
import {
  mergeKhmdhsCommitmentsFromChain,
  pickPrimaryCommitmentDecision,
} from './khmdhsCommitmentsMerge';

describe('mergeKhmdhsCommitmentsFromChain', () => {
  const c1 = {
    adam: '25REQ016195275',
    snapshot: { referenceNumber: '25REQ016195275', signedDate: '2025-03-01', title: 'Απόφαση 1' },
    fetchedAt: '2026-01-01T00:00:00.000Z',
  };
  const c2Stub = {
    adam: '25REQ016195999',
    snapshot: null,
    error: 'Το ΚΗΜΔΗΣ δέχεται πολλά αιτήματα αυτή τη στιγμή.',
  };

  test('διατηρεί παλιά απόφαση που λείπει από το νέο fetch', () => {
    const merged = mergeKhmdhsCommitmentsFromChain([c1, c2Stub], [c1]);
    expect(merged).toHaveLength(2);
    expect(merged.map((d) => d.adam).sort()).toEqual([
      '25REQ016195275',
      '25REQ016195999',
    ]);
  });

  test('δεν προσθέτει νέο stub χωρίς λεπτομέρειες', () => {
    const merged = mergeKhmdhsCommitmentsFromChain(
      [c1],
      [
        c1,
        { adam: '25REQ019999999', snapshot: null, error: 'πολλά αιτήματα' },
      ]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].adam).toBe('25REQ016195275');
  });

  test('δεν αντικαθιστά καλό snapshot με null όταν αποτύχει η λεπτομέρεια', () => {
    const merged = mergeKhmdhsCommitmentsFromChain(
      [c1],
      [{ adam: '25REQ016195275', snapshot: null, error: 'timeout' }]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].snapshot).toEqual(c1.snapshot);
    expect(merged[0].error).toBe('timeout');
  });

  test('αναβαθμίζει stub όταν έρθει πραγματικό snapshot', () => {
    const fresh = {
      adam: '25REQ016195999',
      snapshot: { referenceNumber: '25REQ016195999', signedDate: '2025-04-01', title: 'Απόφαση 2' },
      fetchedAt: '2026-07-01T00:00:00.000Z',
    };
    const merged = mergeKhmdhsCommitmentsFromChain([c2Stub], [fresh]);
    expect(merged).toHaveLength(1);
    expect(merged[0].snapshot.title).toBe('Απόφαση 2');
    expect(merged[0].error).toBe('');
  });

  test('κενό νέο fetch διατηρεί όλες τις προηγούμενες', () => {
    const merged = mergeKhmdhsCommitmentsFromChain([c1, c2Stub], []);
    expect(merged).toHaveLength(2);
  });

  test('αφαιρεί μόνο επιβεβαιωμένα ακυρωμένη ανάληψη — η άλλη μένει', () => {
    const merged = mergeKhmdhsCommitmentsFromChain(
      [c1, c2Stub],
      [c1],
      { cancelledAdams: ['25REQ016195999'] }
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].adam).toBe('25REQ016195275');
  });

  test('κενό fetch χωρίς cancelledAdams δεν σβήνει τίποτα', () => {
    const merged = mergeKhmdhsCommitmentsFromChain([c1, c2Stub], [], {});
    expect(merged).toHaveLength(2);
  });

  test('κενό fetch με cancelledAdams αφαιρεί μόνο τον ακυρωμένο κρίκο', () => {
    const merged = mergeKhmdhsCommitmentsFromChain(
      [c1, c2Stub],
      [],
      { cancelledAdams: ['25REQ016195275**'] }
    );
    expect(merged.map((d) => d.adam)).toEqual(['25REQ016195999']);
  });

  test('incoming snapshot.cancelled δεν ξαναμπαίνει και φεύγει από τα προηγούμενα', () => {
    const merged = mergeKhmdhsCommitmentsFromChain(
      [c1],
      [{ adam: '25REQ016195275', snapshot: { cancelled: true, title: 'Ματαιώθηκε' } }]
    );
    expect(merged).toHaveLength(0);
  });
});

describe('pickPrimaryCommitmentDecision', () => {
  test('επιλέγει τη χρονολογικά πρώτη με snapshot', () => {
    const primary = pickPrimaryCommitmentDecision([
      {
        adam: '25REQ000000002',
        snapshot: { signedDate: '2025-06-01' },
      },
      {
        adam: '25REQ000000001',
        snapshot: { signedDate: '2025-03-01' },
      },
    ]);
    expect(primary.adam).toBe('25REQ000000001');
  });

  test('αγνοεί stubs χωρίς snapshot όταν υπάρχουν καλές', () => {
    const primary = pickPrimaryCommitmentDecision([
      { adam: '25REQ000000003', snapshot: null },
      {
        adam: '25REQ000000001',
        snapshot: { signedDate: '2025-03-01' },
      },
    ]);
    expect(primary.adam).toBe('25REQ000000001');
  });
});

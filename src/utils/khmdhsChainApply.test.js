import { mergeSharedKhmdhsFromChain } from './khmdhsChainApply';

describe('mergeSharedKhmdhsFromChain', () => {
  test('διατηρεί τη χειροκίνητη διαδικασία ανάθεσης όταν το ΚΗΜΔΗΣ δεν την προσδιορίζει', () => {
    const prev = {
      khmdhsNoticeAdam: '',
      assignmentProcedure: 'Απευθείας ανάθεση (χειροκίνητη καταχώριση)',
    };
    const chainRes = {
      notice: {
        adam: '24PROC012345678',
        snapshot: {},
        fetchedAt: '2026-07-01T00:00:00.000Z',
        // Το ΚΗΜΔΗΣ δεν βρήκε/χαρτογράφησε τη διαδικασία ανάθεσης αυτή τη φορά.
        mappedAssignmentProcedure: '',
      },
    };

    const { next } = mergeSharedKhmdhsFromChain(prev, chainRes);

    expect(next.assignmentProcedure).toBe('Απευθείας ανάθεση (χειροκίνητη καταχώριση)');
    expect(next.khmdhsNoticeAdam).toBe('24PROC012345678');
  });

  test('χρησιμοποιεί την αυτόματη διαδικασία όταν το ΚΗΜΔΗΣ την προσδιορίζει', () => {
    const prev = { khmdhsNoticeAdam: '', assignmentProcedure: '' };
    const chainRes = {
      notice: {
        adam: '24PROC012345678',
        snapshot: {},
        fetchedAt: '2026-07-01T00:00:00.000Z',
        mappedAssignmentProcedure: 'Ανοικτός διαγωνισμός',
      },
    };

    const { next } = mergeSharedKhmdhsFromChain(prev, chainRes);

    expect(next.assignmentProcedure).toBe('Ανοικτός διαγωνισμός');
  });
});

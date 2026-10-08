/**
 * @jest-environment node
 */
const {
  bulkRefreshMustDeferParallelContracts,
  BULK_PARALLEL_CONTRACTS_DEFER_REASON,
} = require('./khmdhsParallelContractApply');

function chainWithParallel(adams, snapshots = {}) {
  return {
    success: true,
    contract: { adam: adams[0] },
    chainMeta: {
      parallelContracts: adams,
      contractSnapshotsByAdam: snapshots,
    },
  };
}

describe('μαζική ανανέωση και πολλές συμβάσεις', () => {
  const four = ['24SYMV000000001', '24SYMV000000002', '24SYMV000000003', '24SYMV000000004'];

  test('χωρίς έτοιμο χαρακτηρισμό σταματά και δεν καταχωρεί καμία', () => {
    const chainRes = chainWithParallel(four, {
      '24SYMV000000001': { title: 'ΣΥΜΒΑΣΗ ΕΡΓΟΥ Α' },
      '24SYMV000000002': { title: 'ΣΥΜΒΑΣΗ ΕΡΓΟΥ Β' },
      '24SYMV000000003': { title: 'ΣΥΜΒΑΣΗ ΕΡΓΟΥ Γ' },
      '24SYMV000000004': { title: 'ΣΥΜΒΑΣΗ ΕΡΓΟΥ Δ' },
    });
    expect(bulkRefreshMustDeferParallelContracts(chainRes, { reusablePlan: null })).toBe(true);
    expect(BULK_PARALLEL_CONTRACTS_DEFER_REASON).toMatch(/Δεν καταχωρήθηκε καμία/);
    expect(BULK_PARALLEL_CONTRACTS_DEFER_REASON).toMatch(/ανάκτηση από τον ΑΔΑΜ/);
  });

  test('ο ήδη αποθηκευμένος χαρακτηρισμός αφήνει την ανανέωση να προχωρήσει', () => {
    const chainRes = chainWithParallel(four);
    expect(bulkRefreshMustDeferParallelContracts(chainRes, {
      reusablePlan: { items: [{ adam: four[0], role: 'main' }] },
    })).toBe(false);
  });

  test('μία σύμβαση δεν σταματά τη μαζική ανανέωση', () => {
    expect(bulkRefreshMustDeferParallelContracts(chainWithParallel(['24SYMV000000001']))).toBe(false);
  });

  test('κύρια σύμβαση και συμπληρωματική δεν μετρούν ως πολλές συμβάσεις', () => {
    const chainRes = chainWithParallel(
      ['24SYMV000000001', '24SYMV000000002'],
      {
        '24SYMV000000001': { title: 'ΣΥΜΒΑΣΗ ΕΡΓΟΥ' },
        '24SYMV000000002': { title: '1Η ΣΥΜΠΛΗΡΩΜΑΤΙΚΗ ΣΥΜΒΑΣΗ' },
      }
    );
    expect(bulkRefreshMustDeferParallelContracts(chainRes)).toBe(false);
  });

  test('παράταση της ίδιας σύμβασης δεν σταματά την ανανέωση', () => {
    const chainRes = chainWithParallel(
      ['24SYMV000000001', '24SYMV000000002'],
      {
        '24SYMV000000001': { title: 'ΣΥΜΒΑΣΗ ΕΡΓΟΥ' },
        '24SYMV000000002': { title: 'ΠΑΡΑΤΑΣΗ ΣΥΜΒΑΣΗΣ' },
      }
    );
    expect(bulkRefreshMustDeferParallelContracts(chainRes)).toBe(false);
  });

  test('δύο πραγματικές συμβάσεις σταματούν ακόμη κι αν η κάρτα λέει μία σύμβαση', () => {
    const chainRes = chainWithParallel(
      ['24SYMV000000001', '24SYMV000000002'],
      {
        '24SYMV000000001': { title: 'ΣΥΜΒΑΣΗ ΤΜΗΜΑ 1' },
        '24SYMV000000002': { title: 'ΣΥΜΒΑΣΗ ΤΜΗΜΑ 2' },
      }
    );
    expect(bulkRefreshMustDeferParallelContracts(chainRes, {
      reusablePlan: { items: [] },
    })).toBe(true);
  });
});

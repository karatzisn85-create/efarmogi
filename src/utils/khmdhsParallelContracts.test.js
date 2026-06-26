/**
 * @jest-environment node
 */
const {
  detectParallelContractSiblings,
  looksLikeSupplementaryContractRecord,
  validateOrphanSupplementaryCandidate,
} = require('../../public/khmdhsParallelContracts');

describe('khmdhsParallelContracts supplementary vs parallel', () => {
  const mainAdam = '22SYMV011799800';
  const suppAdam = '24SYMV015482244';
  const award = '22AWRD011136485';

  const recordsByAdam = new Map([
    [mainAdam, {
      title: 'ΔΙΑΚΗΡΥΞΗ ΓΙΑ ΤΟ ΕΡΓΟ ΜΕ ΤΙΤΛΟ: ΕΝΕΡΓΕΙΑΚΗ ΑΝΑΒΑΘΜΙΣΗ',
      auctionRefNo: award,
      contractSignedDate: '2022-12-01',
      contractBudget: 267823.47,
    }],
    [suppAdam, {
      title: '1Η ΣΥΜΠΛΗΡΩΜΑΤΙΚΗ ΣΥΜΒΑΣΗ ΓΙΑ ΤΟ ΕΡΓΟ',
      auctionRefNo: award,
      contractSignedDate: '2024-09-19',
      contractBudget: 267823.47,
    }],
  ]);

  test('supplementary with same award is not a parallel root', () => {
    expect(looksLikeSupplementaryContractRecord(recordsByAdam.get(suppAdam))).toBe(true);
    const info = detectParallelContractSiblings(recordsByAdam);
    expect(info.parallel).toBe(false);
    expect(info.siblingRoots).toEqual([mainAdam]);
    expect(info.actSupplementaryAdams).toEqual([suppAdam]);
  });

  test('validateOrphanSupplementary allows same-award supplementary title', () => {
    const res = validateOrphanSupplementaryCandidate(
      recordsByAdam.get(suppAdam),
      suppAdam,
      {
        primaryContractAdam: mainAdam,
        primaryContractRecord: recordsByAdam.get(mainAdam),
        existingChainAdams: [mainAdam],
      }
    );
    expect(res.ok).toBe(true);
  });
});

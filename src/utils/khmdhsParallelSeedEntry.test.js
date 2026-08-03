/**
 * @jest-environment node
 *
 * Ανάκτηση με ΑΔΑΜ σύμβασης όταν η ανάθεση έχει δύο παράλληλες συμβάσεις.
 * Πραγματική περίπτωση: 24AWRD015347369 (Δράσεις ηλεκτροκίνησης) — δύο τμήματα,
 * δύο ανάδοχοι, καμία ηλεκτρονική σύνδεση μεταξύ τους (prevReferenceNo: null).
 */
const {
  resolveMainContractEntryForSymvSeed,
} = require('../../public/khmdhsAdamChainService');
const { detectParallelContractSiblings } = require('../../public/khmdhsParallelContracts');
const { resolveKhmdhsContractAmount } = require('../../public/khmdhsOpenData');

const AWARD = '24AWRD015347369';
const CONTRACT_A = '24SYMV015347394';
const CONTRACT_B = '24SYMV015352975';

const recordsByAdam = new Map([
  [CONTRACT_A, {
    title: 'ΔΡΑΣΕΙΣ ΗΛΕΚΤΡΟΚΙΝΗΣΗΣ ΣΤΟ ΔΗΜΟ ΑΡΧΑΝΩΝ ΑΣΤΕΡΟΥΣΙΩΝ',
    referenceNumber: CONTRACT_A,
    prevReferenceNo: null,
    nextRefNo: null,
    auctionRefNo: AWARD,
    contractSignedDate: '2024-08-29',
    startDate: '2024-08-29',
    endDate: '2025-04-29',
    totalCostWithVAT: 256680,
  }],
  [CONTRACT_B, {
    title: 'ΔΡΑΣΕΙΣ ΗΛΕΚΤΡΟΚΙΝΗΣΗΣ ΣΤΟ ΔΗΜΟ ΑΡΧΑΝΩΝ ΑΣΤΕΡΟΥΣΙΩΝ (ΠΡΟΜΗΘΕΙΑ ΗΛΕΚΤΡΙΚΩΝ ΟΧΗΜΑΤΩΝ ΚΑΙ ΦΟΡΤΙΣΤΩΝ)',
    referenceNumber: CONTRACT_B,
    prevReferenceNo: null,
    nextRefNo: null,
    auctionRefNo: AWARD,
    contractSignedDate: '2024-08-30',
    startDate: '2024-08-30',
    endDate: '2025-04-30',
    totalCostWithVAT: 379621.99,
  }],
]);

const stages = {
  contracts: [
    { adam: CONTRACT_A, modified: false, cancelled: false },
    { adam: CONTRACT_B, modified: false, cancelled: false },
  ],
};

describe('σπόρος ΑΔΑΜ σύμβασης σε ανάθεση με παράλληλες συμβάσεις', () => {
  const parallelInfo = detectParallelContractSiblings(recordsByAdam);

  test('οι δύο συμβάσεις αναγνωρίζονται ως παράλληλες', () => {
    expect(parallelInfo.parallel).toBe(true);
    expect(parallelInfo.siblingRoots.sort()).toEqual([CONTRACT_A, CONTRACT_B].sort());
  });

  test('η σύμβαση του σπόρου παραμένει η αφετηρία — δεν κρεμιέται στην αδελφή της', async () => {
    const entry = await resolveMainContractEntryForSymvSeed(
      stages, CONTRACT_B, recordsByAdam, parallelInfo
    );
    expect(entry).toBe(CONTRACT_B);
  });

  test('το ίδιο ισχύει και αν ξεκινήσουμε από την άλλη σύμβαση', async () => {
    const entry = await resolveMainContractEntryForSymvSeed(
      stages, CONTRACT_A, recordsByAdam, parallelInfo
    );
    expect(entry).toBe(CONTRACT_A);
  });

  test('το ποσό κάθε παράλληλης σύμβασης έρχεται από τη συνολική της αξία', () => {
    const res = resolveKhmdhsContractAmount(recordsByAdam.get(CONTRACT_B), {
      auctionSnapshot: { totalCostWithVAT: 636301.99 },
      linkedContractCount: 2,
      parallelCase: true,
      blockSharedAwardFallback: true,
    });
    expect(res.amount).toBe(379621.99);
    expect(res.source).toMatch(/συνολική αξία/);
  });

  test('όταν υπάρχει ποσό σύμβασης, αυτό εξακολουθεί να προηγείται', () => {
    const res = resolveKhmdhsContractAmount(
      { contractBudget: 100000, totalCostWithVAT: 999999 },
      { linkedContractCount: 1 }
    );
    expect(res.amount).toBe(124000);
    expect(res.source).toBe('Σύμβαση (ΚΗΜΔΗΣ)');
  });

  test('κρίκος αλυσίδας δεν παίρνει ποσό από τη συνολική αξία', () => {
    const res = resolveKhmdhsContractAmount(
      { totalCostWithVAT: 379621.99 },
      { allowAwardFallback: false }
    );
    expect(res.amount).toBeNull();
  });

  test('γνήσια ορφανή συμπληρωματική εξακολουθεί να δείχνει στην αρχική σύμβαση', async () => {
    const suppAdam = '25SYMV018000001';
    const withSupp = new Map(recordsByAdam);
    withSupp.delete(CONTRACT_B);
    withSupp.set(suppAdam, {
      title: '1Η ΣΥΜΠΛΗΡΩΜΑΤΙΚΗ ΣΥΜΒΑΣΗ ΓΙΑ ΤΙΣ ΔΡΑΣΕΙΣ ΗΛΕΚΤΡΟΚΙΝΗΣΗΣ',
      referenceNumber: suppAdam,
      prevReferenceNo: null,
      auctionRefNo: AWARD,
      contractSignedDate: '2025-02-10',
      endDate: '2025-08-30',
    });
    const info = detectParallelContractSiblings(withSupp);
    const entry = await resolveMainContractEntryForSymvSeed(
      {
        contracts: [
          { adam: CONTRACT_A, modified: false, cancelled: false },
          { adam: suppAdam, modified: true, cancelled: false },
        ],
      },
      suppAdam,
      withSupp,
      info
    );
    expect(entry).toBe(CONTRACT_A);
  });
});

/**
 * @jest-environment node
 */
import { buildKhmdhsLifecycleRailColumns, countKhmdhsLifecycleRailNodes } from './khmdhsLifecycleRailGraph';

describe('khmdhsLifecycleRailGraph', () => {
  test('επεκτείνει συμβάσεις και ΑΠΕ ως δευτερεύοντα κρίκο', () => {
    const project = {
      implementationForm: 'Μια Σύμβαση',
      khmdhsRequestAdam: '23REQ001',
      khmdhsRequestSnapshot: { referenceNumber: '23REQ001' },
      khmdhsNoticeAdam: '23PROC001',
      khmdhsNoticeSnapshot: { referenceNumber: '23PROC001' },
      khmdhsAwardAdam: '24AWRD001',
      khmdhsAwardSnapshot: { referenceNumber: '24AWRD001' },
      khmdhsAdam: '24SYMV001',
      khmdhsContractSnapshot: { referenceNumber: '24SYMV001' },
      apeAmount: '1.416.302,98',
      apeDiavgeiaAda: 'ΡΩΕΚΩΨΜ-Σ0Υ',
      supplementaryContracts: [{
        date: '2025-10-31',
        amount: '0',
        khmdhsAdam: '25SYMV001',
        comments: 'Παράταση',
      }],
      khmdhsPayments: [{ adam: '25PAY001', snapshot: { referenceNumber: '25PAY001' } }],
    };

    const columns = buildKhmdhsLifecycleRailColumns(project);
    expect(columns.length).toBeGreaterThan(4);

    const symvCol = columns.find((c) => c.primary.stageId === 'SYMV');
    expect(symvCol).toBeTruthy();
    expect(symvCol.secondaries.some((s) => s.stageId === 'APE')).toBe(true);

    const extCol = columns.find((c) => c.primary.stageId === 'EXTENSION');
    expect(extCol).toBeTruthy();
    expect(extCol.primary.shortLabel).toBe('Παράτ.');
    expect(extCol.secondaries).toHaveLength(0);

    expect(countKhmdhsLifecycleRailNodes(columns)).toBeGreaterThan(columns.length);
  });

  test('δύο πρωτογενή εμφανίζονται ως χωριστοί κρίκοι στο πλήρες γράφημα', () => {
    const columns = buildKhmdhsLifecycleRailColumns({
      implementationForm: 'Πολλές Συμβάσεις',
      khmdhsRequestAdam: '25REQ016832258',
      khmdhsRequestSnapshot: { referenceNumber: '25REQ016832258' },
      khmdhsNoticeAdam: '25PROC001',
      khmdhsNoticeSnapshot: { referenceNumber: '25PROC001' },
      khmdhsAwardAdam: '25AWRD001',
      khmdhsAwardSnapshot: { referenceNumber: '25AWRD001' },
      khmdhsAdam: '25SYMV016948065',
      khmdhsContractSnapshot: { referenceNumber: '25SYMV016948065' },
      khmdhsChainStitchPlan: {
        status: 'confirmed',
        segments: [
          { seedAdam: '25REQ016832258' },
          { seedAdam: '24REQ015252599' },
        ],
      },
    });
    const reqCols = columns.filter((c) => c.primary.stageId === 'REQ');
    expect(reqCols).toHaveLength(2);
    expect(reqCols.map((c) => c.primary.adam)).toEqual([
      '25REQ016832258',
      '24REQ015252599',
    ]);
  });
});

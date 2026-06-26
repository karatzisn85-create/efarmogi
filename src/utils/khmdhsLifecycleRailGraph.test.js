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

    const extCol = columns.find((c) => c.primary.label === 'Παράταση' || c.primary.shortLabel === 'Παράτ.');
    expect(extCol).toBeTruthy();
    expect(extCol.secondaries).toHaveLength(0);

    expect(countKhmdhsLifecycleRailNodes(columns)).toBeGreaterThan(columns.length);
  });
});

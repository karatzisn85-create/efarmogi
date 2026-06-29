/**
 * @jest-environment node
 */
import { buildKhmdhsLifecycleStages } from './khmdhsLifecycleStages';

describe('buildKhmdhsLifecycleStages — παρατάσεις vs συμπληρωματικές', () => {
  const baseProject = {
    implementationForm: 'Μια Σύμβαση',
    khmdhsRequestAdam: '24REQ001',
    khmdhsRequestSnapshot: { referenceNumber: '24REQ001' },
    khmdhsNoticeAdam: '24PROC001',
    khmdhsNoticeSnapshot: { referenceNumber: '24PROC001' },
    khmdhsAwardAdam: '24AWRD001',
    khmdhsAwardSnapshot: { referenceNumber: '24AWRD001' },
    khmdhsAdam: '24SYMV001',
    khmdhsContractSnapshot: { referenceNumber: '24SYMV001' },
  };

  test('μόνο παρατάσεις — κρίκος Παράτ. όχι Συμπλ.', () => {
    const stages = buildKhmdhsLifecycleStages({
      ...baseProject,
      supplementaryContracts: [
        { date: '2024-07-19', amount: '236.290,21', khmdhsAdam: '25SYMV663', comments: 'Παράταση' },
        { date: '2025-07-19', amount: '236.290,21', khmdhsAdam: '25SYMV605', comments: 'Παράταση' },
      ],
    });
    const ext = stages.find((s) => s.id === 'EXTENSION');
    const supp = stages.find((s) => s.id === 'SUPP');
    expect(ext?.has).toBe(true);
    expect(ext?.shortLabel).toBe('Παράτ.');
    expect(ext?.extraLabel).toBe('2× παράτ.');
    expect(supp).toBeUndefined();
  });

  test('μόνο συμπληρωματικές — κρίκος Συμπλ.', () => {
    const stages = buildKhmdhsLifecycleStages({
      ...baseProject,
      supplementaryContracts: [
        { date: '2025-01-01', amount: '10.000,00', khmdhsAdam: '25SYMV999', comments: 'Συμπληρωματική' },
      ],
      khmdhsContractChainHistory: [
        { adam: '25SYMV999', kind: 'modification', label: 'Συμπληρωματική σύμβαση', order: 1 },
      ],
    });
    const supp = stages.find((s) => s.id === 'SUPP');
    const ext = stages.find((s) => s.id === 'EXTENSION');
    expect(supp?.has).toBe(true);
    expect(supp?.shortLabel).toBe('Συμπλ.');
    expect(ext).toBeUndefined();
  });
});

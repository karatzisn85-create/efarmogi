/**
 * @jest-environment node
 */
import { buildKhmdhsLifecycleStages, awardIndicatesNoPriorNotice } from './khmdhsLifecycleStages';
import { computeChainCharacterizationEffects } from './khmdhsChainActions';

describe('awardIndicatesNoPriorNotice — χωρίς δημοσίευση στο ΚΗΜΔΗΣ', () => {
  test('αναγνωρίζει διαπραγμάτευση χωρίς προηγούμενη δημοσίευση', () => {
    expect(awardIndicatesNoPriorNotice({
      khmdhsAwardSnapshot: {
        referenceNumber: '21AWRD009397008',
        procedureType: 'Διαπραγμάτευση χωρίς προηγούμενη δημοσίευση (αρ.32/αρ.269)',
      },
    })).toBe(true);
  });

  test('δεν ισχύει όταν υπάρχει δημοσίευση PROC', () => {
    expect(awardIndicatesNoPriorNotice({
      khmdhsNoticeAdam: '21PROC001',
      khmdhsNoticeSnapshot: { referenceNumber: '21PROC001', title: 'Διακήρυξη' },
      khmdhsAwardSnapshot: {
        referenceNumber: '21AWRD001',
        procedureType: 'Ανοιχτός διαγωνισμός',
      },
    })).toBe(false);
  });
});

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

  test('PROC ως «Χωρ. δημ.» όταν η ανάθεση είναι χωρίς προηγούμενη δημοσίευση', () => {
    const stages = buildKhmdhsLifecycleStages({
      implementationForm: 'Πολλές Συμβάσεις',
      khmdhsRequestAdam: '21REQ008539630',
      khmdhsRequestSnapshot: { referenceNumber: '21REQ008539630' },
      khmdhsAwardAdam: '21AWRD009397008',
      khmdhsAwardSnapshot: {
        referenceNumber: '21AWRD009397008',
        procedureType: 'Διαπραγμάτευση χωρίς προηγούμενη δημοσίευση (αρ.32/αρ.269)',
      },
      contracts: [{ khmdhsAdam: '21SYMV009397257', khmdhsContractSnapshot: { referenceNumber: '21SYMV009397257' } }],
    });
    const proc = stages.find((s) => s.id === 'PROC');
    expect(proc?.status).toBe('skipped');
    expect(proc?.extraLabel).toBe('Χωρ. δημ.');
  });

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

  test('παράταση από χαρακτηρισμό αλυσίδας εμφανίζεται ως κρίκος Παράτ.', () => {
    const extAdam = '25SYMVEXT001';
    const history = [
      {
        adam: '24SYMV001',
        isRoot: true,
        order: 0,
        contractAmount: '10.000,00',
        endDate: '2024-12-31',
      },
      {
        adam: extAdam,
        isRoot: false,
        order: 1,
        kind: 'extension',
        suggestedKind: 'extension',
        endDate: '2025-06-30',
        contractDate: '2025-01-10',
      },
    ];
    const review = {
      items: [{ fieldId: 'chainKindReview', chainAdam: extAdam, status: 'needs_review' }],
      resolutions: {
        [`chainKindReview::${extAdam}`]: { value: 'extension', meta: { endDate: '2025-06-30' } },
      },
    };
    const eff = computeChainCharacterizationEffects(history, review);
    const stages = buildKhmdhsLifecycleStages({
      ...baseProject,
      supplementaryContracts: eff.supplementaryContracts,
      khmdhsContractChainHistory: history,
      khmdhsDataQualityReview: review,
    });
    const ext = stages.find((s) => s.id === 'EXTENSION');
    expect(ext?.has).toBe(true);
    expect(ext?.adam).toBe(extAdam);
    expect(ext?.shortLabel).toBe('Παράτ.');
  });
});

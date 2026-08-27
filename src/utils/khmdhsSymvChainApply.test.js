/**
 * @jest-environment node
 */
import {
  mergeSymvChainPlanIntoDataQualityReview,
  shouldMergeSymvPlanIntoDataQualityReview,
  applySymvChainPlanToForm,
} from './khmdhsSymvChainApply';
import { SYMV_CHAIN_ROLE } from './khmdhsSymvChainPlanner';
import {
  getUnresolvedReviewItems,
  KHMDHS_REVIEW_STATUS,
} from './khmdhsDataQualityReport';

describe('mergeSymvChainPlanIntoDataQualityReview', () => {
  test('επιλύει ποσά και για παράλληλες συμβάσεις μετά την κατανομή SYMV', () => {
    const review = {
      items: [
        {
          fieldId: 'contractAmount',
          contractIndex: 0,
          status: KHMDHS_REVIEW_STATUS.NEEDS_REVIEW,
          label: 'Ποσό σύμβασης 1 (με ΦΠΑ)',
          displayValue: '256.680,00 €',
        },
        {
          fieldId: 'contractAmount',
          contractIndex: 1,
          status: KHMDHS_REVIEW_STATUS.NEEDS_REVIEW,
          label: 'Ποσό σύμβασης 2 (με ΦΠΑ)',
          displayValue: '379.621,99 €',
        },
      ],
      resolutions: {},
      acknowledgedFieldIds: [],
    };

    const plan = {
      items: [
        {
          adam: '24SYMV015347394',
          role: SYMV_CHAIN_ROLE.MAIN,
          amount: '256.680,00',
          date: '2025-04-29',
        },
        {
          adam: '24SYMV015352975',
          role: SYMV_CHAIN_ROLE.PARALLEL,
          amount: '379.621,99',
          date: '2025-04-30',
        },
      ],
    };

    const form = {
      implementationForm: 'Πολλές Συμβάσεις',
      contracts: [
        { khmdhsAdam: '24SYMV015347394', amount: '256.680,00', date: '2025-04-29' },
        { khmdhsAdam: '24SYMV015352975', amount: '379.621,99', date: '2025-04-30' },
      ],
    };

    const merged = mergeSymvChainPlanIntoDataQualityReview(review, plan, form);

    expect(getUnresolvedReviewItems(merged, form)).toHaveLength(0);
    expect(merged.resolutions['contractAmount::0']?.value).toBe('256.680,00');
    expect(merged.resolutions['contractAmount::1']?.value).toBe('379.621,99');
    expect(merged.hasActionRequired).toBe(false);
  });

  test('δεν ξανα-ενσωματώνει ήδη εφαρμοσμένο σχέδιο SYMV', () => {
    const review = {
      items: [],
      resolutions: {
        'chainKindReview::24SYMV015347394': { value: 'contract' },
      },
      acknowledgedFieldIds: [],
    };
    const plan = {
      items: [{ adam: '24SYMV015347394', role: SYMV_CHAIN_ROLE.MAIN, amount: '100.000,00' }],
    };
    const form = { khmdhsSymvPlanAppliedAt: '2025-06-01T10:00:00.000Z' };
    expect(shouldMergeSymvPlanIntoDataQualityReview(review, plan, form)).toBe(false);
  });
});

describe('applySymvChainPlanToForm stitch', () => {
  const prev = {
    implementationForm: 'Μια Σύμβαση',
    projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
    khmdhsRequestAdam: '25REQ016832258',
    khmdhsRequestSnapshot: { referenceNumber: '25REQ016832258' },
    khmdhsAdam: '25SYMV016948065',
    khmdhsContractSnapshot: { referenceNumber: '25SYMV016948065' },
    khmdhsChainSeedAdam: '25REQ016832258',
    contractAmount: '18600',
    contractDate: '2025-06-01',
    khmdhsPayments: [{ adam: '25PAY000000001', snapshot: { referenceNumber: '25PAY000000001' } }],
  };
  const chainRes = {
    success: true,
    request: {
      adam: '24REQ015252599',
      snapshot: { referenceNumber: '24REQ015252599' },
      fetchedAt: '2026-08-01T00:00:00.000Z',
    },
    payments: [{ adam: '25PAY000000002', snapshot: { referenceNumber: '25PAY000000002' } }],
    contract: {
      adam: '24SYMV015890933',
      snapshot: { referenceNumber: '24SYMV015890933' },
      roleLabel: 'Κύρια σύμβαση',
    },
    chainMeta: {
      contractSnapshotsByAdam: {
        '24SYMV015890933': { referenceNumber: '24SYMV015890933', contractSignedDate: '2025-01-15' },
        '25SYMV016155296': { referenceNumber: '25SYMV016155296', contractSignedDate: '2025-02-15' },
      },
    },
  };
  const plan = {
    items: [
      { adam: '24SYMV015890933', role: SYMV_CHAIN_ROLE.MAIN, date: '2025-01-15', amount: '10000' },
      { adam: '25SYMV016155296', role: SYMV_CHAIN_ROLE.PARALLEL, date: '2025-02-15', amount: '2313,20' },
      { adam: '24SYMV999999999', role: SYMV_CHAIN_ROLE.SKIP },
    ],
  };

  test('Διατήρηση + κατανομή κρατά την υπάρχουσα σύμβαση και το πρωτογενές', () => {
    const { form, stitchFilledStages } = applySymvChainPlanToForm(prev, chainRes, plan, {
      seedAdam: '24REQ015252599',
      applyMode: 'stitch',
    });
    const adams = [...new Set([
      form.khmdhsAdam,
      ...(form.contracts || []).map((c) => c.khmdhsAdam),
    ].filter(Boolean))];
    expect(adams).toEqual(expect.arrayContaining([
      '25SYMV016948065',
      '24SYMV015890933',
      '25SYMV016155296',
    ]));
    expect(adams).toHaveLength(3);
    expect(form.implementationForm).toBe('Πολλές Συμβάσεις');
    expect(form.khmdhsRequestAdam).toBe('25REQ016832258');
    expect(form.khmdhsChainSeedAdam).toBe('25REQ016832258');
    expect(form.khmdhsPayments.map((p) => p.adam).sort()).toEqual([
      '25PAY000000001',
      '25PAY000000002',
    ]);
    expect(stitchFilledStages).toContain('SYMV');
    expect(form.khmdhsSymvChainPlan.items.map((i) => i.adam)).toEqual(
      expect.arrayContaining(['25SYMV016948065', '24SYMV015890933', '25SYMV016155296'])
    );
    expect(form.khmdhsSymvChainPlan.items.find((i) => i.adam === '25SYMV016948065')?.role)
      .toBe(SYMV_CHAIN_ROLE.PARALLEL);
  });

  test('Διατήρηση δεν κρατά εντάλματα τμημάτων που αποκλείστηκαν στην κατανομή', () => {
    const { form } = applySymvChainPlanToForm(prev, {
      ...chainRes,
      payments: [
        {
          adam: '25PAY000000002',
          snapshot: { referenceNumber: '25PAY000000002', contractRefNo: '24SYMV015890933' },
        },
        {
          adam: '24PAY099999999',
          snapshot: { referenceNumber: '24PAY099999999', contractRefNo: '24SYMV999999999' },
        },
      ],
    }, plan, {
      seedAdam: '24REQ015252599',
      applyMode: 'stitch',
    });
    expect(form.khmdhsPayments.map((p) => p.adam)).toEqual(
      expect.arrayContaining(['25PAY000000001', '25PAY000000002'])
    );
    expect(form.khmdhsPayments.map((p) => p.adam)).not.toContain('24PAY099999999');
  });

  test('από την αρχή αντικαθιστά την αλυσίδα με όσα ορίζει το σχέδιο', () => {
    const { form } = applySymvChainPlanToForm(prev, chainRes, plan, {
      seedAdam: '24REQ015252599',
      applyMode: 'replace',
    });
    const adams = (form.contracts || []).map((c) => c.khmdhsAdam);
    expect(adams).toEqual(['24SYMV015890933', '25SYMV016155296']);
    expect(form.khmdhsRequestAdam).toBe('24REQ015252599');
    expect(form.khmdhsChainSeedAdam).toBe('24REQ015252599');
  });
});

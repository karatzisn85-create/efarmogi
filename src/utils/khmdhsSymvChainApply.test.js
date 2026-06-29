import {
  mergeSymvChainPlanIntoDataQualityReview,
  shouldMergeSymvPlanIntoDataQualityReview,
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

/**
 * @jest-environment node
 */
import {
  applyReviewResolution,
  isContractAmountUserProtected,
  KHMDHS_REVIEW_STATUS,
  KHMDHS_RESOLUTION_SOURCE,
} from './khmdhsDataQualityReport';
import { applyChainCharacterizationToForm } from './khmdhsChainApply';
import { buildKhmdhsContractDisplayGroups } from './khmdhsContractDisplayFields';

describe('khmdhs review amount protection', () => {
  const reviewItem = {
    fieldId: 'contractAmount',
    contractIndex: null,
    status: KHMDHS_REVIEW_STATUS.NEEDS_REVIEW,
    displayValue: '267.823,47 €',
    label: 'Ποσό σύμβασης (με ΦΠΑ)',
  };

  test('applyReviewResolution records override when amount differs from ΚΗΜΔΗΣ', () => {
    const form = {
      contractAmount: '',
      khmdhsUserEdits: { fieldOverrides: {}, excludedChainAdams: [], journal: [] },
    };
    const review = { items: [reviewItem], resolutions: {} };
    const { formData, review: nextReview } = applyReviewResolution(form, review, reviewItem, {
      value: '74.155,85',
      source: KHMDHS_RESOLUTION_SOURCE.USER_MANUAL,
    });
    expect(formData.contractAmount).toBe('74.155,85');
    expect(formData.khmdhsUserEdits.fieldOverrides.contractAmount?.value).toBe('74.155,85');
    expect(nextReview.resolutions['contractAmount::shared']?.value).toBe('74.155,85');
  });

  test('chain recompute does not overwrite user-protected contract amount', () => {
    const form = {
      contractAmount: '74.155,85',
      khmdhsContractChainHistory: [
        { adam: '22SYMV', isRoot: true, order: 0, contractAmount: '267.823,47' },
        { adam: '24SYMV', isRoot: false, order: 1, contractAmount: '74.155,85', kind: 'modification' },
      ],
      khmdhsUserEdits: {
        fieldOverrides: {
          contractAmount: {
            value: '74.155,85',
            khmdhsValue: '267.823,47',
            label: 'Ποσό σύμβασης',
          },
        },
        excludedChainAdams: [],
        journal: [],
      },
      khmdhsDataQualityReview: {
        items: [reviewItem],
        resolutions: {
          'contractAmount::shared': {
            value: '74.155,85',
            source: KHMDHS_RESOLUTION_SOURCE.USER_MANUAL,
          },
        },
      },
    };
    expect(isContractAmountUserProtected(form, form.khmdhsDataQualityReview, null)).toBe(true);
    const next = applyChainCharacterizationToForm(form, form.khmdhsDataQualityReview, { fullRecompute: true });
    expect(next.contractAmount).toBe('74.155,85');
  });

  test('display shows stored amount when it differs from ΚΗΜΔΗΣ snapshot', () => {
    const snapshot = {
      referenceNumber: '24SYMV015482244',
      contractBudget: 215987.47,
      contractAmountSource: 'award',
    };
    const groups = buildKhmdhsContractDisplayGroups(snapshot, { storedAmount: '74.155,85' });
    const financial = groups.find((g) => g.id === 'financial');
    const labels = financial.rows.map((r) => r.label);
    expect(labels.some((l) => /καταχωρημένο στο υποέργο/i.test(l))).toBe(true);
    expect(labels.some((l) => /από ΚΗΜΔΗΣ/i.test(l))).toBe(true);
  });
});

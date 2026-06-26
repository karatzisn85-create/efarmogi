/**
 * @jest-environment node
 */
import {
  findSupplementaryRowIndex,
  getFormValueForReviewItem,
  buildReviewFieldPatch,
  revokeReviewResolution,
  revertScalarFieldForRevokedItem,
  isChainKindReviewKey,
  reviewItemKey,
  normalizeReviewSearchSteps,
  getReviewFieldInputKind,
  applyChainKindFollowUpResolutions,
  reconcileReviewState,
  getUnresolvedReviewItems,
} from './khmdhsDataQualityReport';
import { mergeKhmdhsSupplementaryIntoForm } from './khmdhsChainDerivedFields';
import {
  resolveChainKindChoice,
  computeChainCharacterizationEffects,
  getChainKindChoice,
} from './khmdhsChainActions';

function applyCharacterizationLikeForm(form, review, { fullRecompute = false } = {}) {
  const hist = form.khmdhsContractChainHistory || [];
  if (!hist.length) return form;
  const eff = computeChainCharacterizationEffects(hist, review);
  const manualSupp = (form.supplementaryContracts || []).filter((c) => !c?.khmdhsDerived);
  const patch = {};
  if ((fullRecompute || eff.correctedAmount) && eff.contractAmount) {
    patch.contractAmount = eff.contractAmount;
  }
  if (fullRecompute) {
    patch.contractEndDate = eff.contractDeadline
      ? String(eff.contractDeadline).slice(0, 10)
      : '';
  } else if (eff.contractDeadline) {
    patch.contractEndDate = String(eff.contractDeadline).slice(0, 10);
  }
  const next = {
    ...form,
    ...patch,
    supplementaryContracts: [...manualSupp, ...eff.supplementaryContracts],
    hasSupplementaryContracts: manualSupp.length + eff.supplementaryContracts.length > 0,
  };
  return mergeKhmdhsSupplementaryIntoForm(next);
}

describe('khmdhs phase L2 review ↔ form sync', () => {
  const modAdam = '24SYMV016093873';
  const baseForm = {
    implementationForm: 'Μια Σύμβαση',
    contractAmount: '10.000,00',
    contractDate: '2024-01-01',
    contractEndDate: '2025-06-30',
    supplementaryContracts: [
      { date: '', amount: '', comments: '', khmdhsAdam: 'manual-1' },
    ],
    khmdhsContractChainHistory: [
      { adam: '24SYMV014848518', isRoot: true, order: 0, contractAmount: '10.000,00', contractDate: '2024-01-01', endDate: '2024-12-31' },
      { adam: modAdam, isRoot: false, order: 1, kind: 'modification', suggestedKind: 'modification', contractAmount: '2.000,00', contractDate: '2025-01-15' },
      { adam: '24SYMV099999999', isRoot: false, order: 2, kind: 'extension', suggestedKind: 'extension', endDate: '2025-06-30' },
    ],
    khmdhsDataQualityReview: {
      items: [
        { fieldId: 'chainKindReview', chainAdam: modAdam, status: 'needs_review' },
        { fieldId: 'supplementaryAmount', chainAdam: modAdam, supplementaryIndex: 0, status: 'missing' },
      ],
      resolutions: {},
    },
  };

  test('finds supplementary row by chainAdam not wrong index', () => {
    const form = {
      supplementaryContracts: [
        { amount: '100', khmdhsAdam: 'manual-1' },
        { amount: '2.000,00', khmdhsAdam: modAdam, khmdhsDerived: true },
      ],
    };
    expect(findSupplementaryRowIndex(form, modAdam)).toBe(1);
    const item = { fieldId: 'supplementaryAmount', chainAdam: modAdam, supplementaryIndex: 0 };
    expect(getFormValueForReviewItem(form, item)).toBe('2.000,00');
  });

  test('patches supplementary field by chainAdam', () => {
    const form = {
      supplementaryContracts: [
        { amount: '100', khmdhsAdam: 'manual-1' },
        { amount: '', khmdhsAdam: modAdam, khmdhsDerived: true },
      ],
    };
    const item = { fieldId: 'supplementaryAmount', chainAdam: modAdam, supplementaryIndex: 0 };
    const patch = buildReviewFieldPatch(form, item, '3.500,00');
    expect(patch.supplementaryContracts[1].amount).toBe('3.500,00');
    expect(patch.supplementaryContracts[0].amount).toBe('100');
  });

  test('patches assignmentProcedure from review modal save', () => {
    const form = { assignmentProcedure: '' };
    const item = { fieldId: 'assignmentProcedure', contractIndex: null };
    const patch = buildReviewFieldPatch(form, item, 'ΑΝΟΙΚΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ');
    expect(patch).toEqual({ assignmentProcedure: 'ΑΝΟΙΚΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ' });
  });

  test('modification uses user amount override instead of KHMDHS chain amount', () => {
    let review = baseForm.khmdhsDataQualityReview;
    const kindItem = review.items.find((i) => i.chainAdam === modAdam);
    review = resolveChainKindChoice(review, kindItem, baseForm, {
      kind: 'modification',
      modAmount: '1.500,00',
      modAmountType: 'delta',
    });
    const eff = computeChainCharacterizationEffects(baseForm.khmdhsContractChainHistory, review);
    const supp = eff.supplementaryContracts.find((c) => c.khmdhsAdam === modAdam);
    expect(supp?.amount).toBe('1.500,00');
  });

  test('merge drops orphaned derived supplementary rows', () => {
    const form = {
      ...baseForm,
      supplementaryContracts: [
        { khmdhsAdam: 'manual-1', amount: '100' },
        { khmdhsAdam: modAdam, amount: '2.000,00', khmdhsDerived: true },
      ],
      khmdhsDataQualityReview: { items: [], resolutions: {} },
    };
    const merged = mergeKhmdhsSupplementaryIntoForm(form);
    expect(merged.supplementaryContracts.some((c) => c.khmdhsAdam === modAdam)).toBe(false);
    expect(merged.supplementaryContracts.some((c) => c.khmdhsAdam === 'manual-1')).toBe(true);
  });

  test('full revoke flow removes derived modification row', () => {
    let review = baseForm.khmdhsDataQualityReview;
    const kindItem = review.items.find((i) => i.chainAdam === modAdam);
    review = resolveChainKindChoice(review, kindItem, baseForm, {
      kind: 'modification',
      modAmount: '2.000,00',
      modAmountType: 'delta',
    });
    let form = {
      ...baseForm,
      supplementaryContracts: [
        ...(baseForm.supplementaryContracts || []),
        {
          date: '2025-01-15',
          amount: '2.000,00',
          khmdhsAdam: modAdam,
          khmdhsDerived: true,
          chainKind: 'modification',
        },
      ],
    };
    form = applyCharacterizationLikeForm(form, review);

    const key = reviewItemKey(kindItem);
    review = revokeReviewResolution(review, key);
    form = applyCharacterizationLikeForm(form, review, { fullRecompute: true });
    form = mergeKhmdhsSupplementaryIntoForm(form);
    expect(form.supplementaryContracts.some((c) => c.khmdhsAdam === modAdam)).toBe(false);
  });

  test('clears extension deadline after extension kind revoke', () => {
    const extAdam = '24SYMV099999999';
    let review = baseForm.khmdhsDataQualityReview;
    const extItem = { fieldId: 'chainKindReview', chainAdam: extAdam, status: 'needs_review' };
    review = {
      ...review,
      items: [...review.items, extItem],
    };
    review = resolveChainKindChoice(review, extItem, baseForm, {
      kind: 'extension',
      endDate: '2025-06-30',
    });
    let form = applyCharacterizationLikeForm(baseForm, review, { fullRecompute: true });
    expect(form.contractEndDate).toBe('2025-06-30');

    review = revokeReviewResolution(review, reviewItemKey(extItem));
    form = applyCharacterizationLikeForm(form, review, { fullRecompute: true });
    expect(form.contractEndDate).toBe('2024-12-31');
  });

  test('isChainKindReviewKey detects chain kind keys', () => {
    expect(isChainKindReviewKey('chainKindReview::24SYMV016093873')).toBe(true);
    expect(isChainKindReviewKey('contractAmount::0')).toBe(false);
  });

  test('getChainKindChoice matches resolution when adam has trailing asterisk', () => {
    const starredAdam = `${modAdam}*`;
    let review = {
      items: [
        { fieldId: 'chainKindReview', chainAdam: starredAdam, status: 'needs_review' },
        { fieldId: 'supplementaryAmount', chainAdam: starredAdam, supplementaryIndex: 0, status: 'missing' },
      ],
      resolutions: {},
    };
    const kindItem = review.items[0];
    review = resolveChainKindChoice(review, kindItem, baseForm, {
      kind: 'modification',
      modAmount: '74.155,85',
      modAmountType: 'delta',
      modDate: '2024-05-08',
    });
    expect(getChainKindChoice(review, starredAdam)?.kind).toBe('modification');
    expect(getChainKindChoice(review, modAdam)?.modAmount).toBe('74.155,85');
  });

  test('applyChainKindFollowUpResolutions resolves supplementary amount with normalized adam', () => {
    const starredAdam = `${modAdam}*`;
    let review = {
      items: [
        { fieldId: 'chainKindReview', chainAdam: starredAdam, status: 'needs_review' },
        { fieldId: 'supplementaryAmount', chainAdam: starredAdam, supplementaryIndex: 0, status: 'missing' },
      ],
      resolutions: {
        [`chainKindReview::${modAdam}`]: {
          value: 'modification',
          meta: { modAmount: '2.000,00', modDate: '2024-05-08', modAmountType: 'delta' },
        },
      },
    };
    const form = {
      supplementaryContracts: [
        { amount: '1.500,00', date: '2024-05-08', khmdhsAdam: modAdam, khmdhsDerived: true },
      ],
    };
    review = applyChainKindFollowUpResolutions(review, form, starredAdam, {
      kind: 'modification',
      modAmount: '2.000,00',
      modDate: '2024-05-08',
      modAmountType: 'delta',
    }).review;
    const amountKey = reviewItemKey({ fieldId: 'supplementaryAmount', chainAdam: starredAdam });
    expect(review.resolutions[amountKey]?.value).toBe('1.500,00');
  });

  test('reconcileReviewState syncs stale supplementary resolution to form delta', () => {
    const adam = modAdam;
    const review = {
      items: [
        {
          fieldId: 'supplementaryAmount',
          chainAdam: adam,
          supplementaryIndex: 0,
          status: 'missing',
        },
      ],
      resolutions: {
        [`chainKindReview::${adam}`]: { value: 'modification' },
        [`supplementaryAmount::${adam}`]: { value: '267.823,47', source: 'user_confirmed' },
      },
    };
    const form = {
      supplementaryContracts: [
        { amount: '74.155,85', khmdhsAdam: adam, khmdhsDerived: true },
      ],
    };
    const synced = reconcileReviewState(review, form);
    const key = reviewItemKey({ fieldId: 'supplementaryAmount', chainAdam: adam });
    expect(synced.resolutions[key]?.value).toBe('74.155,85');
    expect(getUnresolvedReviewItems(synced, form)).toHaveLength(0);
  });

  test('supplementary amount not re-asked after modification characterization with modAmount', () => {
    const adam = '24SYMV015482244';
    const review = {
      items: [{
        fieldId: 'supplementaryAmount',
        chainAdam: adam,
        supplementaryIndex: 0,
        status: 'missing',
      }],
      resolutions: {},
    };
    const form = { supplementaryContracts: [] };
    const followUp = applyChainKindFollowUpResolutions(review, form, adam, {
      kind: 'modification',
      modAmount: '74.155,85',
      modDate: '2024-09-19',
      modAmountType: 'delta',
    });
    expect(followUp.formData.supplementaryContracts?.[0]?.amount).toBe('74.155,85');
    expect(getUnresolvedReviewItems(followUp.review, followUp.formData)).toHaveLength(0);
  });

  test('reverts scalar field to khmdhs suggestion on revoke', () => {
    const item = { fieldId: 'contractAmount', contractIndex: null, status: 'needs_review', displayValue: '12.000,00' };
    const resolution = { khmdhsSuggestedValue: '12.000,00', value: '11.000,00' };
    const form = { contractAmount: '11.000,00' };
    const patch = revertScalarFieldForRevokedItem(form, item, resolution);
    expect(patch.contractAmount).toBe('12.000,00');
  });

  test('normalizeReviewSearchSteps tolerates malformed stored steps', () => {
    expect(normalizeReviewSearchSteps({ searchSteps: { bad: true } })).toEqual([]);
    expect(normalizeReviewSearchSteps(
      { searchSteps: ['α'] },
      { steps: ['β'] }
    )).toEqual(['β']);
  });

  test('getReviewFieldInputKind tolerates missing fieldId', () => {
    expect(getReviewFieldInputKind({ fieldId: null })).toBe('text');
    expect(getReviewFieldInputKind({ fieldId: 'contractAmount' })).toBe('amount');
  });
});

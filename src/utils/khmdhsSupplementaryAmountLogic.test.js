/**
 * @jest-environment node
 */
import {
  isPlausibleSupplementaryDelta,
  normalizeSuspiciousKhmdhsGross,
  resolveModificationSupplementaryAmount,
  prefillSupplementaryModAmount,
} from './khmdhsSupplementaryAmountLogic';
import {
  computeChainCharacterizationEffects,
  resolveChainKindChoice,
} from './khmdhsChainActions';

describe('khmdhsSupplementaryAmountLogic', () => {
  const running = 223439.92;
  const modAdam = '24SYMV015482244';

  test('normalizeSuspiciousKhmdhsGross corrects 100x scale error', () => {
    expect(normalizeSuspiciousKhmdhsGross(7415585, running)).toBeCloseTo(74155.85, 0);
  });

  test('resolves plausible delta after scale correction from bad KHMDHS display', () => {
    const h = { adam: modAdam, contractAmount: '7.415.585,00' };
    const result = resolveModificationSupplementaryAmount(h, {}, running, new Map());
    expect(result.delta).toBeCloseTo(74155.85, 0);
  });

  test('uses explicit user modAmount over KHMDHS', () => {
    const h = { adam: modAdam, contractAmount: '7.415.585,00' };
    const result = resolveModificationSupplementaryAmount(
      h,
      { modAmount: '50.000,00', modAmountType: 'delta' },
      running,
      new Map()
    );
    expect(result.delta).toBeCloseTo(50000, 0);
  });

  test('computeChainCharacterizationEffects shows corrected amount not millions', () => {
    const hist = [
      { adam: '24SYMV000', isRoot: true, order: 0, contractAmount: '223.439,92' },
      { adam: modAdam, isRoot: false, order: 1, contractAmount: '7.415.585,00', contractDate: '2024-09-19' },
    ];
    let review = {
      items: [{ fieldId: 'chainKindReview', chainAdam: modAdam, status: 'needs_review' }],
      resolutions: {},
    };
    review = resolveChainKindChoice(
      review,
      { fieldId: 'chainKindReview', chainAdam: modAdam },
      {},
      { kind: 'modification' }
    );
    const eff = computeChainCharacterizationEffects(hist, review);
    const supp = eff.supplementaryContracts.find((c) => c.khmdhsAdam === modAdam);
    expect(supp?.amount).toBe('74.155,85');
  });

  test('prefillSupplementaryModAmount returns corrected formatted amount', () => {
    expect(prefillSupplementaryModAmount('', {
      contractAmountDisplay: '7.415.585,00',
    }, running)).toBe('74.155,85');
  });

  test('isPlausibleSupplementaryDelta rejects multi-million deltas', () => {
    expect(isPlausibleSupplementaryDelta(7000000, running)).toBe(false);
  });
});

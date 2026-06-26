/**
 * @jest-environment node
 */
import {
  mergeKhmdhsReviewAfterFetch,
  pruneResolutionsToItems,
} from './khmdhsDataQualityReport';

describe('khmdhs phase L3 review persistence on re-fetch', () => {
  const modAdam = '24SYMV016093873';
  const rootAdam = '24SYMV014848518';

  const existingReview = {
    items: [
      { fieldId: 'contractAmount', status: 'missing', contractIndex: null },
      { fieldId: 'chainKindReview', chainAdam: modAdam, status: 'needs_review' },
    ],
    resolutions: {
      [`chainKindReview::${modAdam}`]: {
        value: 'extension',
        source: 'user_confirmed',
        resolvedAt: '2025-01-01T00:00:00.000Z',
      },
      'contractAmount::shared': {
        value: '18.600,00',
        source: 'user_manual',
        resolvedAt: '2025-01-01T00:00:00.000Z',
      },
    },
    resolutionHistory: [],
    acknowledgedFieldIds: [],
  };

  const incomingReport = {
    generatedAt: '2025-06-01T00:00:00.000Z',
    items: [
      { fieldId: 'contractAmount', status: 'missing', contractIndex: null, displayValue: '' },
      { fieldId: 'chainKindReview', chainAdam: modAdam, status: 'needs_review' },
      { fieldId: 'chainKindReview', chainAdam: '24SYMV099999999', status: 'needs_review' },
    ],
  };

  const formWithChain = {
    implementationForm: 'Μια Σύμβαση',
    khmdhsContractChainHistory: [
      { adam: rootAdam, isRoot: true },
      { adam: modAdam, isRoot: false },
      { adam: '24SYMV099999999', isRoot: false },
    ],
    khmdhsUserEdits: { fieldOverrides: {}, excludedChainAdams: [], journal: [] },
  };

  test('singleContractRefresh preserves matching resolutions', () => {
    const merged = mergeKhmdhsReviewAfterFetch(
      existingReview,
      incomingReport,
      formWithChain,
      { singleContractRefresh: true }
    );
    expect(merged.resolutions[`chainKindReview::${modAdam}`]?.value).toBe('extension');
    expect(merged.resolutions['contractAmount::shared']?.value).toBe('18.600,00');
    expect(merged.items).toHaveLength(3);
  });

  test('drops resolution for ADAM removed from chain', () => {
    const form = {
      ...formWithChain,
      khmdhsContractChainHistory: [
        { adam: rootAdam, isRoot: true },
        { adam: modAdam, isRoot: false },
      ],
    };
    const merged = mergeKhmdhsReviewAfterFetch(
      existingReview,
      incomingReport,
      form,
      { singleContractRefresh: true }
    );
    expect(merged.resolutions[`chainKindReview::${modAdam}`]?.value).toBe('extension');
    expect(merged.resolutions['chainKindReview::24SYMV099999999']).toBeUndefined();
  });

  test('multi-contract fetch keeps other contract resolutions', () => {
    const prev = {
      items: [
        { fieldId: 'contractAmount', contractIndex: 0, status: 'missing' },
        { fieldId: 'contractAmount', contractIndex: 1, status: 'missing' },
      ],
      resolutions: {
        'contractAmount::0': { value: '18.600,00', source: 'user_manual' },
        'contractAmount::1': { value: '25.000,00', source: 'user_manual' },
      },
      resolutionHistory: [],
      acknowledgedFieldIds: [],
    };
    const incoming = {
      items: [
        { fieldId: 'contractAmount', status: 'missing', displayValue: '' },
        { fieldId: 'chainKindReview', chainAdam: modAdam, status: 'needs_review' },
      ],
    };
    const form = {
      implementationForm: 'Πολλές Συμβάσεις',
      contracts: [
        { khmdhsAdam: rootAdam, khmdhsContractChainHistory: [{ adam: rootAdam, isRoot: true }] },
        {
          khmdhsAdam: '25SYMV016401992',
          khmdhsContractChainHistory: [
            { adam: '25SYMV016401992', isRoot: true },
            { adam: modAdam, isRoot: false },
          ],
        },
      ],
      khmdhsUserEdits: { fieldOverrides: {}, excludedChainAdams: [], journal: [] },
    };
    const merged = mergeKhmdhsReviewAfterFetch(prev, incoming, form, { contractIndex: 1 });
    expect(merged.resolutions['contractAmount::0']?.value).toBe('18.600,00');
    expect(merged.items.some((i) => i.contractIndex === 0)).toBe(true);
    expect(merged.items.some((i) => i.contractIndex === 1 && i.fieldId === 'contractAmount')).toBe(true);
  });

  test('excluded ADAM not reintroduced in review items', () => {
    const form = {
      ...formWithChain,
      khmdhsUserEdits: {
        fieldOverrides: {},
        excludedChainAdams: [modAdam],
        journal: [],
      },
    };
    const merged = mergeKhmdhsReviewAfterFetch(
      existingReview,
      incomingReport,
      form,
      { singleContractRefresh: true }
    );
    expect(merged.items.some((i) => i.chainAdam === modAdam)).toBe(false);
    expect(merged.resolutions[`chainKindReview::${modAdam}`]).toBeUndefined();
  });

  test('pruneResolutionsToItems removes orphan keys', () => {
    const review = {
      items: [{ fieldId: 'contractAmount', contractIndex: null, status: 'missing' }],
      resolutions: {
        'contractAmount::shared': { value: '1' },
        'contractDate::shared': { value: 'x' },
      },
    };
    const pruned = pruneResolutionsToItems(review);
    expect(pruned.resolutions['contractAmount::shared']).toBeDefined();
    expect(pruned.resolutions['contractDate::shared']).toBeUndefined();
  });
});

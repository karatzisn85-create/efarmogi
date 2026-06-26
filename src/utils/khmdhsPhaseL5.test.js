/**
 * @jest-environment node
 */
import {
  migrateKhmdhsSingleToMultiForm,
  migrateKhmdhsMultiToSingleForm,
  purgeKhmdhsDataAfterContractRemoval,
} from './khmdhsImplementationFormMigration';

const { buildKhmdhsAmountContext } = require('../../public/khmdhsOpenData');
const { resolveKhmdhsContractAmount } = require('../../public/khmdhsOpenData');

describe('khmdhs phase L5', () => {
  test('single to multi preserves chain history on row 0', () => {
    const prev = {
      implementationForm: 'Μια Σύμβαση',
      contractDate: '2024-01-01',
      contractAmount: '10.000,00',
      khmdhsAdam: '24SYMV014322448',
      khmdhsContractChainHistory: [
        { adam: '24SYMV014322448', isRoot: true },
        { adam: '24SYMV015526678', isRoot: false, kind: 'extension' },
      ],
      khmdhsDataQualityReview: {
        items: [{ fieldId: 'contractAmount', contractIndex: null, status: 'missing' }],
        resolutions: { 'contractAmount::shared': { value: '10.000,00' } },
      },
    };
    const next = migrateKhmdhsSingleToMultiForm(prev);
    expect(next.contracts[0].khmdhsContractChainHistory).toHaveLength(2);
    expect(next.contracts[0].khmdhsAdam).toBe('24SYMV014322448');
    expect(next.khmdhsContractChainHistory).toHaveLength(0);
    expect(next.khmdhsDataQualityReview.items[0].contractIndex).toBe(0);
    expect(next.khmdhsDataQualityReview.resolutions['contractAmount::0']).toBeDefined();
  });

  test('multi to single restores top-level chain', () => {
    const prev = {
      implementationForm: 'Πολλές Συμβάσεις',
      contracts: [{
        date: '2024-01-01',
        amount: '10.000,00',
        khmdhsAdam: '24SYMV014322448',
        khmdhsContractChainHistory: [{ adam: '24SYMV014322448', isRoot: true }],
        khmdhsContractAmendments: [],
      }],
      khmdhsDataQualityReview: {
        items: [{ fieldId: 'contractAmount', contractIndex: 0, status: 'complete' }],
        resolutions: { 'contractAmount::0': { value: '10.000,00' } },
      },
    };
    const next = migrateKhmdhsMultiToSingleForm(prev);
    expect(next.khmdhsAdam).toBe('24SYMV014322448');
    expect(next.khmdhsContractChainHistory).toHaveLength(1);
    expect(next.contracts).toHaveLength(0);
    expect(next.khmdhsDataQualityReview.resolutions['contractAmount::shared']).toBeDefined();
  });

  test('purge review after contract row removal', () => {
    const form = {
      contracts: [{ khmdhsAdam: 'A' }, { khmdhsAdam: 'B' }],
      supplementaryContracts: [{ sourceContractIndex: 1, amount: '1' }],
      khmdhsDataQualityReview: {
        items: [
          { fieldId: 'contractAmount', contractIndex: 0 },
          { fieldId: 'contractAmount', contractIndex: 1 },
        ],
        resolutions: {
          'contractAmount::0': { value: '1' },
          'contractAmount::1': { value: '2' },
        },
        acknowledgedFieldIds: [],
      },
    };
    const next = purgeKhmdhsDataAfterContractRemoval({
      ...form,
      contracts: form.contracts.filter((_, i) => i !== 1),
    }, 1);
    expect(next.supplementaryContracts).toHaveLength(0);
    expect(next.khmdhsDataQualityReview.items).toHaveLength(1);
    expect(next.khmdhsDataQualityReview.resolutions['contractAmount::1']).toBeUndefined();
  });

  test('linear chain uses linkedContractCount 1 and allows award fallback', () => {
    const ctx = buildKhmdhsAmountContext({
      stages: { contracts: [{ adam: 'A' }, { adam: 'B' }] },
      contractWalk: { primaryAdam: '24SYMV014848518' },
      parallelContractInfo: { parallel: false, siblingRoots: ['24SYMV014848518'] },
      auctionSnapshot: { totalCostWithoutVAT: 10000, totalCostWithVAT: 12400 },
    });
    expect(ctx.linkedContractCount).toBe(1);
    expect(ctx.parallelCase).toBe(false);
    const resolved = resolveKhmdhsContractAmount(
      { contractBudget: null },
      ctx
    );
    expect(resolved.amount).toBe(12400);
  });

  test('parallel case blocks award fallback', () => {
    const ctx = buildKhmdhsAmountContext({
      stages: { contracts: [{ adam: 'A' }, { adam: 'B' }, { adam: 'C' }] },
      contractWalk: { primaryAdam: '25SYMV016457416' },
      parallelContractInfo: {
        parallel: true,
        siblingRoots: ['25SYMV016406876', '25SYMV016457416', '25SYMV016401992'],
      },
      auctionSnapshot: { totalCostWithoutVAT: 43400, totalCostWithVAT: 53776 },
    });
    const resolved = resolveKhmdhsContractAmount({ contractBudget: null }, ctx);
    expect(resolved.multipleContracts).toBe(true);
    expect(resolved.amount).toBeNull();
  });
});

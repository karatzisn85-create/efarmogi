/**
 * @jest-environment node
 */
import {
  getChainHistoryForContract,
  getAllChainHistories,
  collectAllChainAdams,
  findChainEntry,
  getRemovableChainEntriesFromForm,
  contractRowFieldKey,
} from './khmdhsChainFormAccess';
import { applyUserEditsAfterKhmdhsFetch } from './khmdhsFieldOverrides';
import {
  formKhmdhsHidesManualContractAmount,
  countSupplementaryCandidatesFromForm,
} from './khmdhsChainDerivedFields';

describe('khmdhs phase L1 multi-contract', () => {
  const multiForm = {
    implementationForm: 'Πολλές Συμβάσεις',
    contracts: [
      {
        khmdhsAdam: '25SYMV016457416',
        amount: '18.600,00',
        date: '2025-03-13',
        khmdhsContractChainHistory: [
          { adam: '25SYMV016457416', isRoot: true, order: 0 },
          { adam: '25SYMV999999999', isRoot: false, order: 1, kind: 'modification' },
        ],
      },
      {
        khmdhsAdam: '25SYMV016401992',
        amount: '',
        khmdhsContractChainHistory: [],
      },
    ],
    khmdhsContractChainHistory: [],
    supplementaryContracts: [],
    khmdhsUserEdits: {
      fieldOverrides: {
        [contractRowFieldKey(0, 'amount')]: {
          value: '18.600,00',
          khmdhsValue: '43.400,00',
          label: 'Ποσό σύμβασης (Σύμβαση 1)',
        },
      },
      excludedChainAdams: [],
      journal: [],
    },
    khmdhsDataQualityReview: {
      items: [{ fieldId: 'contractAmount', status: 'missing', contractIndex: 0 }],
      resolutions: {},
    },
  };

  test('reads chain history per contract row', () => {
    expect(getChainHistoryForContract(multiForm, 0)).toHaveLength(2);
    expect(getChainHistoryForContract(multiForm, 1)).toHaveLength(0);
    expect(getChainHistoryForContract(multiForm, null)).toHaveLength(0);
    expect(getAllChainHistories(multiForm)).toHaveLength(1);
  });

  test('collects ADAMs across rows', () => {
    expect(collectAllChainAdams(multiForm)).toContain('25SYMV016457416');
    expect(collectAllChainAdams(multiForm, 0)).toContain('25SYMV999999999');
    expect(findChainEntry(multiForm, '25SYMV999999999').contractIndex).toBe(0);
  });

  test('lists removable entries with contract label', () => {
    const removable = getRemovableChainEntriesFromForm(multiForm);
    expect(removable).toHaveLength(1);
    expect(removable[0].contractLabel).toBe('Σύμβαση 1');
  });

  test('protects per-row amount on re-fetch', () => {
    const fetched = {
      ...multiForm,
      contracts: multiForm.contracts.map((row, i) => (
        i === 0 ? { ...row, amount: '43.400,00' } : row
      )),
    };
    const { form, protectedCount } = applyUserEditsAfterKhmdhsFetch(multiForm, fetched);
    expect(form.contracts[0].amount).toBe('18.600,00');
    expect(protectedCount).toBeGreaterThanOrEqual(1);
  });

  test('shows amount field when review marks missing', () => {
    expect(formKhmdhsHidesManualContractAmount(multiForm, 0)).toBe(false);
  });

  test('counts supplementary candidates without error', () => {
    expect(countSupplementaryCandidatesFromForm(multiForm)).toBeGreaterThanOrEqual(0);
  });
});

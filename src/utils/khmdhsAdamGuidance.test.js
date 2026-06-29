/**
 * @jest-environment node
 */
import { PROJECT_STATUS_CONTRACT_PROCESS } from '../data/formOptions';
import {
  PROJECT_STATUS_EXECUTED,
  chainHasAtLeastOneContract,
  suggestProjectStatusAfterKhmdhsChain,
} from './khmdhsAdamGuidance';

describe('suggestProjectStatusAfterKhmdhsChain', () => {
  test('upgrades when resolved contract exists', () => {
    const chainRes = { contract: { adam: '25SYMV001' } };
    expect(suggestProjectStatusAfterKhmdhsChain(PROJECT_STATUS_CONTRACT_PROCESS, chainRes))
      .toBe(PROJECT_STATUS_EXECUTED);
  });

  test('upgrades from chainMeta when parallel REQ seed has no picked contract', () => {
    const chainRes = {
      contract: null,
      chainMeta: {
        hasParallelContracts: true,
        parallelContracts: ['25SYMV001', '25SYMV002'],
        linkedAdams: { contracts: ['25SYMV001', '25SYMV002'] },
        stageCounts: { contracts: 2 },
      },
    };
    expect(chainHasAtLeastOneContract(chainRes)).toBe(true);
    expect(suggestProjectStatusAfterKhmdhsChain(PROJECT_STATUS_CONTRACT_PROCESS, chainRes))
      .toBe(PROJECT_STATUS_EXECUTED);
  });

  test('does not upgrade without any contract signal', () => {
    const chainRes = {
      contract: null,
      chainMeta: { stageCounts: { contracts: 0 }, linkedAdams: { contracts: [] } },
    };
    expect(suggestProjectStatusAfterKhmdhsChain(PROJECT_STATUS_CONTRACT_PROCESS, chainRes)).toBeNull();
  });

  test('does not change ΟΛΟΚΛΗΡΩΜΕΝΟ when chain has contract', () => {
    const chainRes = { contract: { adam: '25SYMV001' } };
    expect(suggestProjectStatusAfterKhmdhsChain('ΟΛΟΚΛΗΡΩΜΕΝΟ', chainRes)).toBeNull();
  });

  test('does not change ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ when chain has contract', () => {
    const chainRes = { contract: { adam: '25SYMV001' } };
    expect(suggestProjectStatusAfterKhmdhsChain('ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ', chainRes)).toBeNull();
  });
});

/**
 * @jest-environment node
 */
import {
  formHasStoredKhmdhsChain,
  shouldRouteAdamAsSupplementaryAdd,
  getStoredChainSeedAdam,
} from './khmdhsChainPresence';
import { assessSupplementaryCrossAct } from './khmdhsSupplementaryAssess';

describe('khmdhsChainPresence', () => {
  const savedForm = {
    implementationForm: 'Μια Σύμβαση',
    khmdhsChainSeedAdam: '',
    khmdhsAdamChainMeta: { seedAdam: '21REQ009553549' },
    khmdhsRequestAdam: '21REQ009553549',
    khmdhsAdam: '22SYMV011799800',
    khmdhsContractSnapshot: { referenceNumber: '22SYMV011799800' },
    khmdhsContractChainHistory: [
      { adam: '22SYMV011799800', isRoot: true },
    ],
  };

  test('detects stored chain without khmdhsChainSeedAdam in form', () => {
    expect(formHasStoredKhmdhsChain(savedForm)).toBe(true);
  });

  test('restores seed from chain meta', () => {
    expect(getStoredChainSeedAdam(savedForm)).toBe('21REQ009553549');
  });

  test('routes new orphan SYMV as supplementary add', () => {
    expect(shouldRouteAdamAsSupplementaryAdd(savedForm, '24SYMV015482244')).toBe(true);
  });

  test('does not route existing chain adam as supplementary', () => {
    expect(shouldRouteAdamAsSupplementaryAdd(savedForm, '22SYMV011799800')).toBe(false);
  });

  test('does not route REQ as supplementary', () => {
    expect(shouldRouteAdamAsSupplementaryAdd(savedForm, '21REQ009553549')).toBe(false);
  });
});

describe('khmdhsSupplementaryAssess', () => {
  const form = {
    implementationForm: 'Μια Σύμβαση',
    khmdhsAdam: '22SYMV011799800',
    khmdhsContractSnapshot: { auctionRefNo: '22AWRD011136485' },
  };

  test('same award needs no confirmation', () => {
    const res = assessSupplementaryCrossAct(
      { auctionRefNo: '22AWRD011136485' },
      form
    );
    expect(res.needsConfirmation).toBe(false);
  });

  test('different award needs confirmation', () => {
    const res = assessSupplementaryCrossAct(
      { auctionRefNo: '99AWRD000000001' },
      form
    );
    expect(res.needsConfirmation).toBe(true);
  });
});

/**
 * @jest-environment node
 */
import {
  inferKhmdhsVatRate,
  isStandardKhmdhsVatRate,
  resolveKhmdhsGrossAmountDetailed,
} from './khmdhsVatHelper';

const {
  detectParallelContractSiblings,
  validateOrphanSupplementaryCandidate,
} = require('../../public/khmdhsParallelContracts');

describe('khmdhs phase L4', () => {
  describe('VAT rates', () => {
    test('infers 13% from KHMDHS amounts', () => {
      expect(inferKhmdhsVatRate(1000, 1130)).toBeCloseTo(0.13, 4);
      expect(isStandardKhmdhsVatRate(0.13)).toBe(false);
    });

    test('uses KHMDHS gross when above net (reduced VAT)', () => {
      const res = resolveKhmdhsGrossAmountDetailed({
        withoutVAT: 1000,
        withVAT: 1130,
      });
      expect(res.amount).toBe(1130);
      expect(res.vatFromKhmdhs).toBe(true);
      expect(res.vatRate).toBeCloseTo(0.13, 4);
    });

    test('applies 24% when withVAT equals net', () => {
      const res = resolveKhmdhsGrossAmountDetailed({
        withoutVAT: 1000,
        withVAT: 1000,
      });
      expect(res.amount).toBe(1240);
      expect(res.vatRate).toBe(0.24);
      expect(res.vatFromKhmdhs).toBe(false);
    });
  });

  describe('parallel contracts', () => {
    test('detects sibling roots', () => {
      const map = new Map([
        ['25SYMV016406876', { prevReferenceNo: null, nextRefNo: null, auctionRefNo: '25AWRD016385693' }],
        ['25SYMV016457416', { prevReferenceNo: null, nextRefNo: null, auctionRefNo: '25AWRD016385693' }],
        ['25SYMV016401992', { prevReferenceNo: null, nextRefNo: null, auctionRefNo: '25AWRD016385693' }],
      ]);
      const info = detectParallelContractSiblings(map);
      expect(info.parallel).toBe(true);
      expect(info.siblingRoots).toHaveLength(3);
    });

    test('linear chain is not parallel', () => {
      const map = new Map([
        ['24SYMV014848518', { prevReferenceNo: null, nextRefNo: '24SYMV016093873' }],
        ['24SYMV016093873', { prevReferenceNo: '24SYMV014848518', nextRefNo: null }],
      ]);
      const info = detectParallelContractSiblings(map);
      expect(info.parallel).toBe(false);
    });
  });

  describe('orphan supplementary validation', () => {
    test('rejects parallel sibling as supplementary', () => {
      const res = validateOrphanSupplementaryCandidate(
        { auctionRefNo: '25AWRD016385693', prevReferenceNo: null, nextRefNo: null },
        '25SYMV016457416',
        {
          primaryContractAdam: '25SYMV016406876',
          primaryContractRecord: { auctionRefNo: '25AWRD016385693' },
          existingChainAdams: ['24SYMV014322448'],
        }
      );
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/παράλληλη/i);
    });

    test('rejects electronically linked contract', () => {
      const res = validateOrphanSupplementaryCandidate(
        { prevReferenceNo: '24SYMV014322448', nextRefNo: null },
        '25SYMV016417575',
        {
          primaryContractAdam: '24SYMV014322448',
          existingChainAdams: [],
        }
      );
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/ηλεκτρονικά/i);
    });

    test('allows true orphan', () => {
      const res = validateOrphanSupplementaryCandidate(
        { prevReferenceNo: null, nextRefNo: null, auctionRefNo: null },
        '25SYMV016417575',
        {
          primaryContractAdam: '24SYMV014322448',
          primaryContractRecord: { auctionRefNo: null },
          existingChainAdams: [],
        }
      );
      expect(res.ok).toBe(true);
    });
  });
});

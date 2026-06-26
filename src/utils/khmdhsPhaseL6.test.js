/**
 * @jest-environment node
 */
import {
  classifyPaymentPayer,
  reconcileKhmdhsPayments,
  orgNamesMatch,
} from './khmdhsPaymentReconciliation';
import {
  reviewItemKey,
  normalizeKhmdhsAdam,
  syncKhmdhsCompleteReviewFieldsToForm,
  refreshAmountDependentReviewItems,
  reconcileReviewState,
  extractKhmdhsAdamFromItem,
  extractPaymentAdamsFromReviewItem,
  KHMDHS_REVIEW_STATUS,
} from './khmdhsDataQualityReport';
import {
  formKhmdhsHidesManualContractAmount,
} from './khmdhsChainDerivedFields';
import { buildSupplementaryAmountContextFromForm } from './khmdhsChainFormAccess';
import { resolveEffectivePayableAmountGrossForPayments } from './khmdhsFields';

const { buildKhmdhsDataQualityReport } = require('../../public/khmdhsDataQualityReport');
const { detectParallelContractSiblings } = require('../../public/khmdhsParallelContracts');

describe('khmdhs phase L6 — payment reconciliation', () => {
  const contractingOrg = 'ΔΗΜΟΣ ΑΡΧΑΝΩΝ - ΑΣΤΕΡΟΥΣΙΩΝ';

  const case25Payments = [
    {
      adam: '25PAY018003274',
      snapshot: {
        referenceNumber: '25PAY018003274',
        organization: 'ΠΕΡΙΦΕΡΕΙΑΚΟ ΤΑΜΕΙΟ ΑΝΑΠΤΥΞΗΣ ΚΡΗΤΗΣ',
        totalCostWithVAT: 12400,
        totalCostWithoutVAT: 10000,
        contractRefNo: '25SYMV017610655',
      },
    },
    {
      adam: '26PAY018328296',
      snapshot: {
        referenceNumber: '26PAY018328296',
        organization: 'ΔΗΜΟΣ ΑΡΧΑΝΩΝ - ΑΣΤΕΡΟΥΣΙΩΝ',
        totalCostWithVAT: 12400,
        totalCostWithoutVAT: 10000,
        contractRefNo: '25SYMV017610655',
      },
    },
  ];

  test('classifies regional fund and municipality payers', () => {
    expect(classifyPaymentPayer('ΠΕΡΙΦΕΡΕΙΑΚΟ ΤΑΜΕΙΟ ΑΝΑΠΤΥΞΗΣ ΚΡΗΤΗΣ').type).toBe('regional_fund');
    expect(classifyPaymentPayer('ΔΗΜΟΣ ΑΡΧΑΝΩΝ - ΑΣΤΕΡΟΥΣΙΩΝ', { contractingOrg }).type)
      .toBe('contracting_authority');
    expect(orgNamesMatch('ΔΗΜΟΣ ΑΡΧΑΝΩΝ-ΑΣΤΕΡΟΥΣΙΩΝ', contractingOrg)).toBe(true);
  });

  test('25SYMV017610655 pattern: raw 24800, estimated 12400, no review required', () => {
    const recon = reconcileKhmdhsPayments(case25Payments, {
      contractAmountGross: 12400,
      contractingOrg,
    });
    expect(recon.rawTotalGross).toBe(24800);
    expect(recon.estimatedContractorPaymentGross).toBe(12400);
    expect(recon.coFinancingPattern).toBeTruthy();
    expect(recon.needsReview).toBe(false);
    expect(recon.rawExceedsContract).toBe(true);
    expect(recon.estimatedExceedsContract).toBe(false);
  });

  test('two municipality payments at full contract triggers review', () => {
    const recon = reconcileKhmdhsPayments([
      {
        adam: '26PAY001',
        snapshot: { organization: 'ΔΗΜΟΣ Α', totalCostWithVAT: 12400 },
      },
      {
        adam: '26PAY002',
        snapshot: { organization: 'ΔΗΜΟΣ Α', totalCostWithVAT: 12400 },
      },
    ], { contractAmountGross: 12400, contractingOrg: 'ΔΗΜΟΣ Α' });
    expect(recon.rawTotalGross).toBe(24800);
    expect(recon.coFinancingPattern).toBeNull();
    expect(recon.needsReview).toBe(true);
  });

  test('DQR item complete for co-financing case', () => {
    const report = buildKhmdhsDataQualityReport({
      primaryRecord: { referenceNumber: '25SYMV017610655', title: 'Test', contractBudget: 10000 },
      amountContext: { linkedContractCount: 1 },
      auction: {
        adam: '25AWRD017595744',
        snapshot: { organization: contractingOrg, totalCostWithVAT: 12400, totalCostWithoutVAT: 10000 },
      },
      contract: { adam: '25SYMV017610655', primaryAdam: '25SYMV017610655' },
      payments: case25Payments,
    });
    const item = report.items.find((i) => i.fieldId === 'paymentsReconciliation');
    expect(item).toBeTruthy();
    expect(item.status).toBe('complete');
    expect(item.message).toMatch(/συγχρηματοδότησης/i);
    expect(item.status).not.toBe('needs_review');
  });

  test('DQR item needs review when sum exceeds without pattern', () => {
    const report = buildKhmdhsDataQualityReport({
      primaryRecord: { referenceNumber: '25SYMV001', title: 'Test', contractBudget: 10000 },
      amountContext: { linkedContractCount: 1 },
      auction: {
        adam: '25AWRD001',
        snapshot: { organization: 'ΔΗΜΟΣ Α', totalCostWithVAT: 12400 },
      },
      contract: { adam: '25SYMV001', primaryAdam: '25SYMV001' },
      payments: [
        { adam: '26PAY001', snapshot: { organization: 'ΔΗΜΟΣ Α', totalCostWithVAT: 12400 } },
        { adam: '26PAY002', snapshot: { organization: 'ΔΗΜΟΣ Α', totalCostWithVAT: 12400 } },
      ],
    });
    const item = report.items.find((i) => i.fieldId === 'paymentsReconciliation');
    expect(item.status).toBe('needs_review');
    expect(report.hasActionRequired).toBe(true);
  });

  test('payments warning refreshes when form contract amount increases after supplementary', () => {
    const payments = [
      { adam: '24PAY016003483', snapshot: { organization: 'ΔΗΜΟΣ ΑΡΧΑΝΩΝ - ΑΣΤΕΡΟΥΣΙΩΝ', totalCostWithVAT: 200000 } },
      { adam: '25PAY016915101', snapshot: { organization: 'ΔΗΜΟΣ ΑΡΧΑΝΩΝ - ΑΣΤΕΡΟΥΣΙΩΝ', totalCostWithVAT: 150000 } },
    ];
    const report = buildKhmdhsDataQualityReport({
      primaryRecord: { referenceNumber: '22SYMV011799800', title: 'Test', contractBudget: 215987.47 },
      amountContext: { linkedContractCount: 1, contextualVatRate: 0.24 },
      auction: {
        adam: '22AWRD011136485',
        snapshot: { organization: contractingOrg, totalCostWithVAT: 267823.47 },
      },
      contract: { adam: '22SYMV011799800', primaryAdam: '22SYMV011799800' },
      payments,
    });
    const payItem = report.items.find((i) => i.fieldId === 'paymentsReconciliation');
    expect(payItem.status).toBe('needs_review');
    expect(payItem.message).toMatch(/267\.824,46/);

    const review = {
      ...report,
      acknowledgedFieldIds: ['paymentsReconciliation::shared'],
      resolutions: { 'paymentsReconciliation::shared': { value: 'confirmed' } },
    };
    const formAfterSupplementary = {
      implementationForm: 'Μια Σύμβαση',
      contractAmount: '350.000,00',
    };
    const refreshed = reconcileReviewState(review, formAfterSupplementary);
    const updated = refreshed.items.find((i) => i.fieldId === 'paymentsReconciliation');
    const refText = JSON.stringify(updated.references || []);
    expect(refText).toMatch(/350\.000,00/);
    expect(refText).not.toMatch(/267\.824,46/);
    expect(updated.status).toBe('complete');
    expect(refreshed.acknowledgedFieldIds || []).not.toContain('paymentsReconciliation::shared');
  });

  test('payments review preview uses PAY ADAM not contract ADAM', () => {
    const payments = [
      { adam: '24PAY016003483', snapshot: { organization: 'ΔΗΜΟΣ', totalCostWithVAT: 1000 } },
    ];
    const report = buildKhmdhsDataQualityReport({
      primaryRecord: { referenceNumber: '22SYMV011799800', contractBudget: 1000 },
      amountContext: { linkedContractCount: 1 },
      auction: { adam: '22AWRD', snapshot: { organization: 'ΔΗΜΟΣ', totalCostWithVAT: 1000 } },
      contract: { adam: '22SYMV011799800', primaryAdam: '22SYMV011799800' },
      payments,
    });
    const payItem = report.items.find((i) => i.fieldId === 'paymentsReconciliation');
    expect(extractKhmdhsAdamFromItem(payItem)).toBe('24PAY016003483');
    expect(extractPaymentAdamsFromReviewItem(payItem).map((p) => p.adam)).toEqual(['24PAY016003483']);
  });

  test('review item key normalizes ADAM case', () => {
    const key = reviewItemKey({
      fieldId: 'chainKindReview',
      chainAdam: '25symv017610655',
    });
    expect(key).toBe('chainKindReview::25SYMV017610655');
    expect(normalizeKhmdhsAdam('25symv017610655')).toBe('25SYMV017610655');
  });

  test('sync complete review fills empty contract amount', () => {
    const form = {
      contractAmount: '',
      khmdhsDataQualityReview: {
        items: [{
          fieldId: 'contractAmount',
          status: KHMDHS_REVIEW_STATUS.COMPLETE,
          displayValue: '12.400,00 €',
          contractIndex: null,
        }],
        resolutions: {},
      },
    };
    const synced = syncKhmdhsCompleteReviewFieldsToForm(form);
    expect(synced.contractAmount).toBe('12.400,00');
  });

  test('hide contract amount when form empty returns false', () => {
    const form = {
      contractAmount: '',
      khmdhsDataQualityReview: {
        items: [{
          fieldId: 'contractAmount',
          status: KHMDHS_REVIEW_STATUS.COMPLETE,
          displayValue: '12.400,00 €',
        }],
      },
    };
    expect(formKhmdhsHidesManualContractAmount(form)).toBe(false);
  });

  test('supplementary amount context from form includes award snapshot', () => {
    const ctx = buildSupplementaryAmountContextFromForm({
      khmdhsAwardSnapshot: { totalCostWithoutVAT: 10000, totalCostWithVAT: 12400 },
    });
    expect(ctx.linkedContractCount).toBe(1);
    expect(ctx.allowAwardFallback).toBe(true);
    expect(ctx.auctionSnapshot).toBeTruthy();
  });

  test('parallel detection uses all contract markers', () => {
    const map = new Map();
    for (let i = 0; i < 10; i += 1) {
      map.set(`25SYMV01645741${i}`, { prevReferenceNo: null });
    }
    const info = detectParallelContractSiblings(map);
    expect(info.parallel).toBe(true);
    expect(info.siblingRoots.length).toBe(10);
  });

  test('DQR supplementary prefers chain amount over raw 24% budget', () => {
    const report = buildKhmdhsDataQualityReport({
      primaryRecord: { referenceNumber: '24SYMV001', title: 'Test' },
      amountContext: { contextualVatRate: 0.13, linkedContractCount: 1 },
      contractChainHistory: [{
        adam: '24SYMV002',
        kind: 'modification',
        label: 'Συμπληρωματική σύμβαση',
        contractAmount: '11.300,00',
        snapshot: { contractBudget: 10000, title: 'Mod' },
      }],
    });
    const item = report.items.find((i) => i.fieldId === 'supplementaryAmount');
    expect(item.displayValue).toContain('11.300');
  });

  test('payable amount sums contract + supplementary when no APE (22SYMV011799800 case)', () => {
    const form = {
      implementationForm: 'Μια Σύμβαση',
      contractAmount: '267.823,47',
      apeAmount: '',
      supplementaryContracts: [{
        amount: '74.155,85',
        khmdhsDerived: true,
        khmdhsAdam: '24SYMV015482244',
      }],
    };
    const payable = resolveEffectivePayableAmountGrossForPayments(form);
    expect(payable).toBeCloseTo(267823.47 + 74155.85, 1);
    const paymentsTotal = 343550;
    const pct = Math.round((paymentsTotal / payable) * 100);
    expect(pct).toBeLessThan(110);
  });

  test('APE is final formed amount, not added on top of contract', () => {
    const form = {
      implementationForm: 'Μια Σύμβαση',
      contractAmount: '20.000,00',
      apeAmount: '23.800,00',
      supplementaryContracts: [],
    };
    expect(resolveEffectivePayableAmountGrossForPayments(form)).toBeCloseTo(23800, 1);
  });

  test('APE final formed plus separate supplementary contract', () => {
    const form = {
      implementationForm: 'Μια Σύμβαση',
      contractAmount: '20.000,00',
      apeAmount: '23.800,00',
      supplementaryContracts: [{ amount: '10.000,00' }],
    };
    expect(resolveEffectivePayableAmountGrossForPayments(form)).toBeCloseTo(33800, 1);
  });

  test('APE plus supplementary contracts (always summed)', () => {
    const form = {
      implementationForm: 'Μια Σύμβαση',
      contractAmount: '20.000,00',
      apeAmount: '28.000,00',
      supplementaryContracts: [{ amount: '5.000,00' }],
    };
    expect(resolveEffectivePayableAmountGrossForPayments(form)).toBeCloseTo(33000, 1);
  });

  test('contract plus derived supplementary always summed', () => {
    const form = {
      implementationForm: 'Μια Σύμβαση',
      contractAmount: '297.595,00',
      apeAmount: '',
      supplementaryContracts: [{
        amount: '74.155,85',
        khmdhsDerived: true,
      }],
    };
    const payable = resolveEffectivePayableAmountGrossForPayments(form);
    expect(payable).toBeCloseTo(297595 + 74155.85, 0);
  });

  test('stored subproject case: contract 332101 + supplementary 74155', () => {
    const form = {
      implementationForm: 'Μια Σύμβαση',
      contractAmount: '332.101,10',
      apeAmount: '',
      supplementaryContracts: [{
        amount: '74.155,85',
        khmdhsDerived: true,
        khmdhsAdam: '24SYMV015482244',
      }],
    };
    const payable = resolveEffectivePayableAmountGrossForPayments(form);
    expect(payable).toBeCloseTo(332101.10 + 74155.85, 0);
    expect(Math.round((343550 / payable) * 100)).toBeLessThan(90);
  });

  test('multiple contracts: each row APE or amount, plus project supplementaries', () => {
    const form = {
      implementationForm: 'Πολλές Συμβάσεις',
      contracts: [
        { amount: '10.000,00', apeAmount: '12.000,00' },
        { amount: '5.000,00', apeAmount: '' },
      ],
      supplementaryContracts: [{ amount: '3.000,00' }],
    };
    expect(resolveEffectivePayableAmountGrossForPayments(form)).toBeCloseTo(20000, 1);
  });

  test('APE final formed plus separate KHMDHS supplementary (297595 + 74155)', () => {
    const form = {
      implementationForm: 'Μια Σύμβαση',
      contractAmount: '297.595,00',
      apeAmount: '297.595,77',
      supplementaryContracts: [{
        amount: '74.155,85',
        khmdhsDerived: true,
        khmdhsAdam: '24SYMV015482244',
      }],
    };
    const payable = resolveEffectivePayableAmountGrossForPayments(form);
    expect(payable).toBeCloseTo(297595.77 + 74155.85, 0);
  });
});

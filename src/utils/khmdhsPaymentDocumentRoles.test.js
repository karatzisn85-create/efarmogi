/**
 * @jest-environment node
 */
import {
  PAYMENT_DOCUMENT_ROLE,
  suggestPaymentDocumentRole,
  applyPaymentRolesToProject,
  paymentRoleCountsTowardTotal,
} from './khmdhsPaymentDocumentRoles';
import { reconcileKhmdhsPayments } from './khmdhsPaymentReconciliation';
import {
  buildKhmdhsPaymentsTotals,
  getKhmdhsPaymentsDisplayAmountGross,
} from './khmdhsChainExtraFields';

describe('khmdhsPaymentDocumentRoles', () => {
  const case25Payments = [
    {
      adam: '25PAY018003274',
      snapshot: {
        referenceNumber: '25PAY018003274',
        title: 'ΕΝΤΟΛΗ ΠΛΗΡΩΜΗΣ ΠΟΣΟΥ 12400€',
        organization: 'ΠΕΡΙΦΕΡΕΙΑΚΟ ΤΑΜΕΙΟ ΑΝΑΠΤΥΞΗΣ ΚΡΗΤΗΣ',
        totalCostWithVAT: 12400,
      },
    },
    {
      adam: '26PAY018328296',
      snapshot: {
        referenceNumber: '26PAY018328296',
        title: 'Χωματουργικές εργασίες πέριξ υδροταμιευτήρων',
        organization: 'ΔΗΜΟΣ ΑΡΧΑΝΩΝ - ΑΣΤΕΡΟΥΣΙΩΝ',
        totalCostWithVAT: 12400,
      },
    },
  ];

  test('suggests informative when title is not payment order', () => {
    const role = suggestPaymentDocumentRole({
      snapshot: case25Payments[1].snapshot,
      payer: { type: 'contracting_authority' },
    });
    expect(role).toBe(PAYMENT_DOCUMENT_ROLE.INFORMATIVE);
  });

  test('classification removes informative from countable total', () => {
    const classified = case25Payments.map((p, idx) => ({
      ...p,
      userDocumentRole: idx === 0
        ? PAYMENT_DOCUMENT_ROLE.CO_FINANCING
        : PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER,
    }));
    const recon = reconcileKhmdhsPayments(classified, {
      contractAmountGross: 12400,
      contractingOrg: 'ΔΗΜΟΣ ΑΡΧΑΝΩΝ - ΑΣΤΕΡΟΥΣΙΩΝ',
    });
    expect(recon.rawTotalGross).toBe(24800);
    expect(recon.countableTotalGross).toBe(12400);
    expect(recon.needsClassification).toBe(false);
    expect(paymentRoleCountsTowardTotal(PAYMENT_DOCUMENT_ROLE.INFORMATIVE)).toBe(false);
  });

  test('applyPaymentRolesToProject persists roles on payments array', () => {
    const form = { khmdhsPayments: case25Payments };
    const next = applyPaymentRolesToProject(form, {
      '26PAY018328296': PAYMENT_DOCUMENT_ROLE.INFORMATIVE,
      '25PAY018003274': PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER,
    });
    expect(next.khmdhsPayments[1].userDocumentRole).toBe(PAYMENT_DOCUMENT_ROLE.INFORMATIVE);
  });

  test('display total uses countable amount after user classification', () => {
    const project = {
      implementationForm: 'Μια Σύμβαση',
      contractAmount: '12.400,00',
      khmdhsAdam: '25SYMV017610655',
      khmdhsContractSnapshot: { organization: 'ΔΗΜΟΣ ΑΡΧΑΝΩΝ - ΑΣΤΕΡΟΥΣΙΩΝ' },
      khmdhsPayments: case25Payments.map((p, idx) => ({
        ...p,
        userDocumentRole: idx === 0
          ? PAYMENT_DOCUMENT_ROLE.INFORMATIVE
          : PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER,
        userDocumentLabel: idx === 0 ? 'Ενημερωτικό Δήμου' : '',
      })),
    };
    const totals = buildKhmdhsPaymentsTotals(project);
    expect(totals.rawTotalGross).toBe(24800);
    expect(totals.countableTotalGross).toBe(12400);
    expect(totals.displayTotalGross).toBe(12400);
    expect(getKhmdhsPaymentsDisplayAmountGross(totals)).toBe(12400);
  });
});

/**
 * @jest-environment node
 */
import {
  PAYMENT_DOCUMENT_ROLE,
  suggestPaymentDocumentRole,
  suggestPaymentDuplicateTitlePlan,
  parsePaymentAmountFromTitle,
  applyPaymentRolesToProject,
  paymentRoleCountsTowardTotal,
  mergePaymentAmountsFromProject,
  buildDefaultPaymentRoleDraft,
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

  test('mergePaymentAmountsFromProject διαβάζει όλα τα keys πληρωμών στο review', () => {
    const amounts = mergePaymentAmountsFromProject(
      { khmdhsPayments: [] },
      {
        resolutions: {
          'paymentsReconciliation::0': {
            meta: { paymentAmounts: { '25PAY000000001': 1000 } },
          },
          'paymentsReconciliation::1': {
            meta: { paymentAmounts: { '25PAY000000002': 2000 } },
          },
        },
      }
    );
    expect(amounts['25PAY000000001']).toBe(1000);
    expect(amounts['25PAY000000002']).toBe(2000);
  });

  test('parsePaymentAmountFromTitle δέχεται 18.999,00 και 18999,00', () => {
    expect(parsePaymentAmountFromTitle('ΠΛΗΡΩΜΗ ΠΟΣΟΥ 18.999,00 ΕΥΡΩ')).toBe(18999);
    expect(parsePaymentAmountFromTitle('ΕΝΤΟΛΗ ΠΛΗΡΩΜΗΣ ΠΟΣΟΥ 18999,00 ΕΥΡΩ')).toBe(18999);
    expect(parsePaymentAmountFromTitle('ΠΛΗΡΩΜΗ ΠΟΣΟΥ 14889,70 ΕΥΡΩ')).toBe(14889.7);
    expect(parsePaymentAmountFromTitle('ΕΝΤΟΛΗ ΠΛΗΡΩΜΗΣ ΠΟΣΟΥ 12400€')).toBe(12400);
    expect(parsePaymentAmountFromTitle('ΠΛΗΡΩΜΗ ΠΟΣΟΥ 18.999 ΕΥΡΩ')).toBe(18999);
  });

  test('duplicate εντολή+πληρωμή ίδιου ποσού: εντολή ενημερωτική, δόσεις από τίτλους', () => {
    const entries = [
      {
        adam: '26PAY000000001',
        active: true,
        gross: 33888.7,
        snapshot: { title: 'ΠΛΗΡΩΜΗ ΠΟΣΟΥ 18999,00 ΕΥΡΩ' },
      },
      {
        adam: '26PAY000000002',
        active: true,
        gross: 33888.7,
        snapshot: { title: 'ΕΝΤΟΛΗ ΠΛΗΡΩΜΗΣ ΠΟΣΟΥ 18999,00 ΕΥΡΩ' },
      },
      {
        adam: '26PAY000000003',
        active: true,
        gross: 33888.7,
        snapshot: { title: 'ΠΛΗΡΩΜΗ ΠΟΣΟΥ 14889,70 ΕΥΡΩ' },
      },
    ];
    const plan = suggestPaymentDuplicateTitlePlan(entries, { contractAmountGross: 33888.7 });
    expect(plan).not.toBeNull();
    expect(plan.roles['26PAY000000002']).toBe(PAYMENT_DOCUMENT_ROLE.INFORMATIVE);
    expect(plan.roles['26PAY000000001']).toBe(PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER);
    expect(plan.roles['26PAY000000003']).toBe(PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER);
    expect(plan.amounts['26PAY000000001']).toBe(18999);
    expect(plan.amounts['26PAY000000003']).toBe(14889.7);
    expect(plan.countableTotalGross).toBe(33888.7);

    const draft = buildDefaultPaymentRoleDraft(entries, null, { contractAmountGross: 33888.7 });
    expect(draft['26PAY000000002']).toBe(PAYMENT_DOCUMENT_ROLE.INFORMATIVE);
  });

  test('δύο πραγματικές πληρωμές ίδιου ποσού δεν ενώνονται', () => {
    const entries = [
      {
        adam: '26PAY000000011',
        active: true,
        gross: 33888.7,
        snapshot: { title: 'ΠΛΗΡΩΜΗ ΠΟΣΟΥ 18999,00 ΕΥΡΩ' },
      },
      {
        adam: '26PAY000000012',
        active: true,
        gross: 33888.7,
        snapshot: { title: 'ΠΛΗΡΩΜΗ ΠΟΣΟΥ 18999,00 ΕΥΡΩ' },
      },
      {
        adam: '26PAY000000013',
        active: true,
        gross: 33888.7,
        snapshot: { title: 'ΠΛΗΡΩΜΗ ΠΟΣΟΥ 14889,70 ΕΥΡΩ' },
      },
    ];
    expect(suggestPaymentDuplicateTitlePlan(entries, { contractAmountGross: 33888.7 })).toBeNull();
  });

  test('εντολή με σωστό ποσό ΚΗΜΔΗΣ δεν παραλείπεται ως διπλότυπο', () => {
    const entries = [
      {
        adam: '26PAY000000021',
        active: true,
        gross: 18999,
        snapshot: { title: 'ΕΝΤΟΛΗ ΠΛΗΡΩΜΗΣ ΠΟΣΟΥ 18999,00 ΕΥΡΩ' },
      },
      {
        adam: '26PAY000000022',
        active: true,
        gross: 18999,
        snapshot: { title: 'ΠΛΗΡΩΜΗ ΠΟΣΟΥ 18999,00 ΕΥΡΩ' },
      },
      {
        adam: '26PAY000000023',
        active: true,
        gross: 14889.7,
        snapshot: { title: 'ΠΛΗΡΩΜΗ ΠΟΣΟΥ 14889,70 ΕΥΡΩ' },
      },
    ];
    expect(suggestPaymentDuplicateTitlePlan(entries, { contractAmountGross: 33888.7 })).toBeNull();
  });

  test('εντολή φουσκωμένη + ένταλμα με σωστό ποσό ΚΗΜΔΗΣ: παραλείπει μόνο την εντολή', () => {
    const entries = [
      {
        adam: '26PAY000000031',
        active: true,
        gross: 33888.7,
        snapshot: { title: 'ΕΝΤΟΛΗ ΠΛΗΡΩΜΗΣ ΠΟΣΟΥ 18999,00 ΕΥΡΩ' },
      },
      {
        adam: '26PAY000000032',
        active: true,
        gross: 18999,
        snapshot: { title: 'ΠΛΗΡΩΜΗ ΠΟΣΟΥ 18999,00 ΕΥΡΩ' },
      },
      {
        adam: '26PAY000000033',
        active: true,
        gross: 14889.7,
        snapshot: { title: 'ΠΛΗΡΩΜΗ ΠΟΣΟΥ 14889,70 ΕΥΡΩ' },
      },
    ];
    const plan = suggestPaymentDuplicateTitlePlan(entries, { contractAmountGross: 33888.7 });
    expect(plan).not.toBeNull();
    expect(plan.roles['26PAY000000031']).toBe(PAYMENT_DOCUMENT_ROLE.INFORMATIVE);
    expect(plan.roles['26PAY000000032']).toBe(PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER);
    expect(plan.roles['26PAY000000033']).toBe(PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER);
    expect(plan.amounts['26PAY000000032']).toBeUndefined();
    expect(plan.countableTotalGross).toBe(33888.7);
  });

  test('εντολή + δύο εντάλματα ίδιου ποσού: δεν πετάει πραγματική δεύτερη δόση', () => {
    const entries = [
      {
        adam: '26PAY000000041',
        active: true,
        gross: 33888.7,
        snapshot: { title: 'ΕΝΤΟΛΗ ΠΛΗΡΩΜΗΣ ΠΟΣΟΥ 18999,00 ΕΥΡΩ' },
      },
      {
        adam: '26PAY000000042',
        active: true,
        gross: 33888.7,
        snapshot: { title: 'ΠΛΗΡΩΜΗ ΠΟΣΟΥ 18999,00 ΕΥΡΩ' },
      },
      {
        adam: '26PAY000000043',
        active: true,
        gross: 33888.7,
        snapshot: { title: 'ΠΛΗΡΩΜΗ ΠΟΣΟΥ 18999,00 ΕΥΡΩ' },
      },
    ];
    expect(suggestPaymentDuplicateTitlePlan(entries, { contractAmountGross: 33888.7 })).toBeNull();
  });

  test('μοτίβο συγχρηματοδότησης δεν χρησιμοποιεί την αυτόματη παράλειψη εντολής', () => {
    const entries = [
      {
        adam: '25PAY000000051',
        active: true,
        gross: 12400,
        snapshot: { title: 'ΕΝΤΟΛΗ ΠΛΗΡΩΜΗΣ ΠΟΣΟΥ 12400€' },
      },
      {
        adam: '26PAY000000052',
        active: true,
        gross: 12400,
        snapshot: { title: 'ΠΛΗΡΩΜΗ ΠΟΣΟΥ 12400€' },
      },
    ];
    expect(suggestPaymentDuplicateTitlePlan(entries, {
      contractAmountGross: 12400,
      coFinancingPattern: { id: 'regional_municipality_pair' },
    })).toBeNull();
  });

  test('ακυρωμένο ένταλμα δεν μπαίνει στο σχέδιο', () => {
    const entries = [
      {
        adam: '26PAY000000061',
        active: true,
        gross: 33888.7,
        snapshot: { title: 'ΕΝΤΟΛΗ ΠΛΗΡΩΜΗΣ ΠΟΣΟΥ 18999,00 ΕΥΡΩ' },
      },
      {
        adam: '26PAY000000062',
        active: true,
        gross: 33888.7,
        snapshot: { title: 'ΠΛΗΡΩΜΗ ΠΟΣΟΥ 18999,00 ΕΥΡΩ' },
      },
      {
        adam: '26PAY000000063',
        active: false,
        gross: 33888.7,
        snapshot: { title: 'ΠΛΗΡΩΜΗ ΠΟΣΟΥ 14889,70 ΕΥΡΩ' },
      },
    ];
    expect(suggestPaymentDuplicateTitlePlan(entries, { contractAmountGross: 33888.7 })).toBeNull();
  });

  test('δύο ζεύγη εντολής+πληρωμής για διαφορετικές δόσεις', () => {
    const entries = [
      {
        adam: '26PAY000000071',
        active: true,
        gross: 33888.7,
        snapshot: { title: 'ΕΝΤΟΛΗ ΠΛΗΡΩΜΗΣ ΠΟΣΟΥ 18999,00 ΕΥΡΩ' },
      },
      {
        adam: '26PAY000000072',
        active: true,
        gross: 33888.7,
        snapshot: { title: 'ΠΛΗΡΩΜΗ ΠΟΣΟΥ 18999,00 ΕΥΡΩ' },
      },
      {
        adam: '26PAY000000073',
        active: true,
        gross: 33888.7,
        snapshot: { title: 'ΕΝΤΟΛΗ ΠΛΗΡΩΜΗΣ ΠΟΣΟΥ 14889,70 ΕΥΡΩ' },
      },
      {
        adam: '26PAY000000074',
        active: true,
        gross: 33888.7,
        snapshot: { title: 'ΠΛΗΡΩΜΗ ΠΟΣΟΥ 14889,70 ΕΥΡΩ' },
      },
    ];
    const plan = suggestPaymentDuplicateTitlePlan(entries, { contractAmountGross: 33888.7 });
    expect(plan).not.toBeNull();
    expect(plan.roles['26PAY000000071']).toBe(PAYMENT_DOCUMENT_ROLE.INFORMATIVE);
    expect(plan.roles['26PAY000000073']).toBe(PAYMENT_DOCUMENT_ROLE.INFORMATIVE);
    expect(plan.roles['26PAY000000072']).toBe(PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER);
    expect(plan.roles['26PAY000000074']).toBe(PAYMENT_DOCUMENT_ROLE.PAYMENT_ORDER);
    expect(plan.countableTotalGross).toBe(33888.7);
  });
});

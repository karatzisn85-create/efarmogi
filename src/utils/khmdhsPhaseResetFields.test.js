/**
 * @jest-environment node
 */
import {
  buildFullKhmdhsPhaseBResetFields,
  buildKhmdhsChainResetPayload,
  buildPreContractKhmdhsClearFields,
  buildKhmdhsDocumentRegistryResetFields,
  clearContractRowManualFields,
  KHMDHS_CHAIN_RESET_PROJECT_STATUS,
  stripOrphanKhmdhsSymvPlan,
} from './khmdhsPhaseResetFields';

describe('khmdhsPhaseResetFields', () => {
  test('buildFullKhmdhsPhaseBResetFields clears review, registry and user edits', () => {
    const fields = buildFullKhmdhsPhaseBResetFields();
    expect(fields.khmdhsDataQualityReview).toBeNull();
    expect(fields.khmdhsDocumentRegistry).toEqual([]);
    expect(fields.khmdhsRelatedDocuments).toEqual([]);
    expect(fields.khmdhsUserEdits).toEqual({
      fieldOverrides: {},
      excludedChainAdams: [],
      journal: [],
    });
    expect(fields.supplementaryContracts).toEqual([]);
    expect(fields.hasSupplementaryContracts).toBe(false);
    expect(fields.khmdhsPayments).toEqual([]);
    expect(fields.apeAmount).toBe('');
    expect(fields.apeComments).toBe('');
    expect(fields.contracts).toEqual([]);
    expect(fields.khmdhsSymvChainPlan).toBeNull();
    expect(fields.khmdhsSymvPlanAppliedAt).toBe('');
  });

  test('clearContractRowManualFields strips APE and contract manual fields', () => {
    const row = clearContractRowManualFields({
      date: '2024-01-01',
      amount: '1.000,00',
      apeAmount: '500,00',
      comments: 'παλιό ΑΠΕ',
      khmdhsAdam: '26SYMV123456789',
    });
    expect(row.apeAmount).toBe('');
    expect(row.comments).toBe('');
    expect(row.amount).toBe('');
    expect(row.khmdhsAdam).toBe('');
  });

  test('buildKhmdhsDocumentRegistryResetFields clears dismissed flag', () => {
    expect(buildKhmdhsDocumentRegistryResetFields().khmdhsDocumentRegistryDismissed).toBe(false);
  });

  test('buildKhmdhsChainResetPayload sets maturation status', () => {
    const payload = buildKhmdhsChainResetPayload();
    expect(payload.projectStatus).toBe(KHMDHS_CHAIN_RESET_PROJECT_STATUS);
    expect(payload.khmdhsAdam).toBe('');
    expect(payload.contracts).toEqual([]);
  });

  test('stripOrphanKhmdhsSymvPlan removes plan without chain footprint', () => {
    const stripped = stripOrphanKhmdhsSymvPlan({
      khmdhsSymvChainPlan: { items: [{ adam: '22SYMV011799800', role: 'main' }] },
      khmdhsSymvPlanAppliedAt: '2026-01-01',
    });
    expect(stripped.khmdhsSymvChainPlan).toBeNull();
    expect(stripped.khmdhsSymvPlanAppliedAt).toBe('');
  });

  test('stripOrphanKhmdhsSymvPlan keeps plan when chain seed exists', () => {
    const plan = { items: [{ adam: '22SYMV011799800', role: 'main' }] };
    const kept = stripOrphanKhmdhsSymvPlan({
      khmdhsChainSeedAdam: '21REQ009553549',
      khmdhsSymvChainPlan: plan,
    });
    expect(kept.khmdhsSymvChainPlan).toBe(plan);
  });

  test('buildPreContractKhmdhsClearFields clears contract leftovers', () => {
    const fields = buildPreContractKhmdhsClearFields();
    expect(fields.khmdhsAdam).toBe('');
    expect(fields.supplementaryContracts).toEqual([]);
    expect(fields.khmdhsUserEdits.fieldOverrides).toEqual({});
    expect(fields.khmdhsSymvChainPlan).toBeNull();
  });
});

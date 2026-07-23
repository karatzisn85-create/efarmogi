/**
 * @jest-environment node
 */
import {
  detectStagesCoveredByChainRes,
  detectStagesCoveredByForm,
  projectHasSubstantialKhmdhsData,
  shouldOfferStitchPromptA,
  upsertStitchPlanSegment,
  clearKhmdhsStitchPlanFields,
  getConfirmedKhmdhsStitchPlan,
  getConfirmedStitchSeedAdams,
  buildConfirmedStitchPlanFromStitch,
  isConfirmedKhmdhsStitchPlan,
  shouldOfferStitchPromptB,
  evaluateStitchRefreshCompleteness,
} from './khmdhsChainStitchPlan';
import {
  getKhmdhsRefreshSeedAdams,
  hasConfirmedKhmdhsStitchPlan,
} from './khmdhsChainRefresh';
import {
  applyAdamChainResult,
  applyAdamChainResultStitch,
  emptyKhmdhsChainFields,
} from './khmdhsChainApply';
import { buildFullKhmdhsPhaseBResetFields } from './khmdhsPhaseResetFields';

describe('khmdhsChainStitchPlan helpers', () => {
  test('projectHasSubstantialKhmdhsData', () => {
    expect(projectHasSubstantialKhmdhsData({})).toBe(false);
    expect(projectHasSubstantialKhmdhsData({
      khmdhsNoticeAdam: '23PROC001',
      khmdhsNoticeSnapshot: { referenceNumber: '23PROC001' },
    })).toBe(true);
  });

  test('shouldOfferStitchPromptA μόνο όταν υπάρχει δεδομένα και διαφορετικός ΑΔΑΜ', () => {
    const form = {
      implementationForm: 'Μια Σύμβαση',
      khmdhsChainSeedAdam: '23REQ013047002',
      khmdhsNoticeAdam: '23PROC001',
      khmdhsNoticeSnapshot: { referenceNumber: '23PROC001' },
    };
    expect(shouldOfferStitchPromptA(form, '24SYMV014193944')).toBe(true);
    expect(shouldOfferStitchPromptA(form, '23REQ013047002')).toBe(false);
    expect(shouldOfferStitchPromptA(form, '24SYMV014193944', { isMultipleContracts: true })).toBe(false);
    expect(shouldOfferStitchPromptA({}, '24SYMV014193944')).toBe(false);
  });

  test('detectStagesCoveredByChainRes', () => {
    expect(detectStagesCoveredByChainRes({
      success: true,
      request: { adam: '23REQ1', snapshot: { referenceNumber: '23REQ1' } },
      notice: { adam: '23PROC1', snapshot: { referenceNumber: '23PROC1' } },
      contract: { adam: '24SYMV1', snapshot: { referenceNumber: '24SYMV1' } },
      payments: [{ adam: '24PAY1', snapshot: { referenceNumber: '24PAY1' } }],
    })).toEqual(['REQ', 'PROC', 'SYMV', 'PAY']);
  });

  test('upsertStitchPlanSegment και confirmed detection', () => {
    let plan = upsertStitchPlanSegment(null, {
      seedAdam: '23REQ1',
      seedType: 'REQ',
      coversStages: ['REQ', 'PROC'],
    });
    plan = upsertStitchPlanSegment(plan, {
      seedAdam: '24SYMV1',
      seedType: 'SYMV',
      coversStages: ['SYMV', 'PAY'],
    });
    expect(plan.segments).toHaveLength(2);
    expect(getConfirmedKhmdhsStitchPlan({ khmdhsChainStitchPlan: plan })).toBeNull();
    plan = { ...plan, status: 'confirmed' };
    expect(getConfirmedKhmdhsStitchPlan({ khmdhsChainStitchPlan: plan })).toBeTruthy();
    expect(clearKhmdhsStitchPlanFields()).toEqual({ khmdhsChainStitchPlan: null });
  });

  test('πλήρης καθαρισμός μηδενίζει stitch plan', () => {
    expect(buildFullKhmdhsPhaseBResetFields().khmdhsChainStitchPlan).toBeNull();
  });

  test('detectStagesCoveredByForm', () => {
    expect(detectStagesCoveredByForm({
      khmdhsRequestAdam: '23REQ1',
      khmdhsNoticeSnapshot: { referenceNumber: '23PROC1' },
      khmdhsPayments: [{ adam: '24PAY1' }],
    })).toEqual(['REQ', 'PROC', 'PAY']);
    expect(detectStagesCoveredByForm({})).toEqual([]);
  });

  test('buildConfirmedStitchPlanFromStitch: 2 segments confirmed', () => {
    const prevForm = {
      khmdhsChainSeedAdam: '23REQ013047002',
      khmdhsRequestAdam: '23REQ013047002',
      khmdhsRequestSnapshot: { referenceNumber: '23REQ013047002' },
      khmdhsNoticeAdam: '23PROC001',
      khmdhsNoticeSnapshot: { referenceNumber: '23PROC001' },
    };
    const plan = buildConfirmedStitchPlanFromStitch({
      existingPlan: null,
      prevSeedAdam: '23REQ013047002',
      prevForm,
      newSeedAdam: '24SYMV014193944',
      newSeedType: 'SYMV',
      newCoversStages: ['SYMV', 'PAY'],
      confirmedBy: 'Νίκος',
      now: '2026-07-23T10:00:00.000Z',
    });
    expect(isConfirmedKhmdhsStitchPlan(plan)).toBe(true);
    expect(plan.status).toBe('confirmed');
    expect(plan.confirmedBy).toBe('Νίκος');
    expect(plan.segments).toHaveLength(2);
    expect(plan.segments[0].seedAdam).toBe('23REQ013047002');
    expect(plan.segments[0].coversStages).toEqual(expect.arrayContaining(['REQ', 'PROC']));
    expect(plan.segments[1].seedAdam).toBe('24SYMV014193944');
    expect(plan.segments[1].coversStages).toEqual(['SYMV', 'PAY']);
    expect(getConfirmedStitchSeedAdams({ khmdhsChainStitchPlan: plan }))
      .toEqual(['23REQ013047002', '24SYMV014193944']);
  });

  test('buildConfirmedStitchPlanFromStitch χωρίς νέο σπόρο επιστρέφει existing', () => {
    expect(buildConfirmedStitchPlanFromStitch({ newSeedAdam: '' })).toBeNull();
  });

  test('shouldOfferStitchPromptB: filled stages', () => {
    expect(shouldOfferStitchPromptB({
      stitchApplyMode: 'stitch',
      stitchFilledStages: ['SYMV'],
      prevForm: { khmdhsRequestAdam: '23REQ1' },
      nextForm: { khmdhsRequestAdam: '23REQ1', khmdhsAdam: '24SYMV1' },
    })).toBe(true);
  });

  test('shouldOfferStitchPromptB: gained contract even if filled empty', () => {
    expect(shouldOfferStitchPromptB({
      stitchApplyMode: 'stitch',
      stitchFilledStages: [],
      prevForm: { khmdhsRequestAdam: '23REQ1', khmdhsAdam: '' },
      nextForm: { khmdhsRequestAdam: '23REQ1', khmdhsAdam: '24SYMV1', khmdhsContractSnapshot: { referenceNumber: '24SYMV1' } },
    })).toBe(true);
  });

  test('shouldOfferStitchPromptB: όχι σε replace mode', () => {
    expect(shouldOfferStitchPromptB({
      stitchApplyMode: 'replace',
      stitchFilledStages: ['SYMV'],
      prevForm: {},
      nextForm: { khmdhsAdam: '24SYMV1' },
    })).toBe(false);
  });

  test('evaluateStitchRefreshCompleteness: ok χωρίς σχέδιο', () => {
    expect(evaluateStitchRefreshCompleteness({ success: true })).toEqual({ ok: true });
    expect(evaluateStitchRefreshCompleteness({
      usesStitchPlan: true,
      stitchResults: [
        { seedAdam: '23REQ1', success: true },
        { seedAdam: '24SYMV1', success: true },
      ],
    })).toEqual({ ok: true });
  });

  test('evaluateStitchRefreshCompleteness: fail-closed σε μερική αποτυχία', () => {
    const r = evaluateStitchRefreshCompleteness({
      usesStitchPlan: true,
      stitchResults: [
        { seedAdam: '23REQ1', success: true },
        { seedAdam: '24SYMV1', success: false },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.failedAdams).toEqual(['24SYMV1']);
    expect(r.message).toMatch(/24SYMV1/);
  });
});

describe('getKhmdhsRefreshSeedAdams', () => {
  test('χωρίς σχέδιο: ένας σπόρος (REQ)', () => {
    const project = {
      khmdhsRequestAdam: '23REQ013047002',
      khmdhsRequestSnapshot: { referenceNumber: '23REQ013047002' },
    };
    const r = getKhmdhsRefreshSeedAdams(project);
    expect(r.usesStitchPlan).toBe(false);
    expect(r.adams).toEqual(['23REQ013047002']);
  });

  test('με επιβεβαιωμένο σχέδιο: σειρά σπόρων, αγνοεί άγκυρα', () => {
    const plan = {
      version: 1,
      status: 'confirmed',
      confirmedAt: '2026-07-23T10:00:00.000Z',
      segments: [
        { seedAdam: '23REQ013047002', coversStages: ['REQ', 'PROC'], fetchedAt: '' },
        { seedAdam: '24SYMV014193944', coversStages: ['SYMV', 'PAY'], fetchedAt: '' },
      ],
    };
    const project = {
      khmdhsBranchAnchorAdam: '24SYMV014193944',
      khmdhsRequestAdam: '23REQ013047002',
      khmdhsChainStitchPlan: plan,
    };
    expect(hasConfirmedKhmdhsStitchPlan(project)).toBe(true);
    const r = getKhmdhsRefreshSeedAdams(project);
    expect(r.usesStitchPlan).toBe(true);
    expect(r.adams).toEqual(['23REQ013047002', '24SYMV014193944']);
    expect(r.primary.adam).toBe('23REQ013047002');
  });
});

describe('applyAdamChainResultStitch', () => {
  const basePrev = {
    implementationForm: 'Μια Σύμβαση',
    projectStatus: 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ',
    khmdhsChainSeedAdam: '23REQ013047002',
    khmdhsRequestAdam: '23REQ013047002',
    khmdhsRequestSnapshot: { referenceNumber: '23REQ013047002', title: 'Πρωτογενές' },
    khmdhsRequestFetchedAt: '2026-01-01T00:00:00.000Z',
    khmdhsNoticeAdam: '23PROC001',
    khmdhsNoticeSnapshot: { referenceNumber: '23PROC001', title: 'Δημοσίευση' },
    khmdhsNoticeFetchedAt: '2026-01-01T00:00:00.000Z',
    assignmentProcedure: 'Ανοικτή',
    contractProcessStartDate: '2023-06-01',
    khmdhsAdamChainMeta: {
      seedAdam: '23REQ013047002',
      linkedAdams: {
        requests: ['23REQ013047002'],
        notices: ['23PROC001'],
        auctions: [],
        contracts: [],
        payments: [],
        approvedRequests: [],
        budgetCommitments: [],
      },
      isOrphanSymvSeed: false,
    },
  };

  const symvChainRes = {
    success: true,
    contract: {
      adam: '24SYMV014193944',
      snapshot: {
        referenceNumber: '24SYMV014193944',
        title: 'Σύμβαση',
        contractSignedDate: '2024-01-24',
      },
      fetchedAt: '2026-07-09T06:22:37.084Z',
      formFields: { contractDate: '2024-01-24', contractAmount: '154501.52' },
    },
    contractChainHistory: [
      { adam: '24SYMV014193944', label: 'Αρχική σύμβαση (επιλεγμένη)' },
    ],
    payments: [
      {
        adam: '24PAY015423143',
        snapshot: { referenceNumber: '24PAY015423143', signedDate: '2024-09-13', totalCostWithVAT: 22272.19 },
        fetchedAt: '2026-07-09T06:22:37.084Z',
      },
    ],
    chainMeta: {
      seedAdam: '24SYMV014193944',
      seedType: 'SYMV',
      linkedAdams: {
        requests: [],
        notices: [],
        auctions: [],
        contracts: ['24SYMV014193944'],
        payments: ['24PAY015423143'],
        approvedRequests: [],
        budgetCommitments: [],
      },
      isOrphanSymvSeed: true,
      allBudgetCommitments: [],
    },
  };

  test('συμπληρώνει SYMV+PAY χωρίς να σβήσει REQ/PROC', () => {
    const { form, stitchFilledStages, warnings } = applyAdamChainResultStitch(
      basePrev,
      symvChainRes,
      { seedAdam: '24SYMV014193944' }
    );
    expect(form.khmdhsRequestAdam).toBe('23REQ013047002');
    expect(form.khmdhsNoticeAdam).toBe('23PROC001');
    expect(form.khmdhsAdam).toBe('24SYMV014193944');
    expect(form.contractDate).toBe('2024-01-24');
    expect(form.khmdhsPayments).toHaveLength(1);
    expect(form.khmdhsPayments[0].adam).toBe('24PAY015423143');
    expect(stitchFilledStages).toEqual(expect.arrayContaining(['SYMV', 'PAY']));
    expect(warnings).toEqual([]);
    expect(form.khmdhsAdamChainMeta.isOrphanSymvSeed).toBe(false);
    expect(form.khmdhsAdamChainMeta.linkedAdams.requests).toContain('23REQ013047002');
    expect(form.khmdhsAdamChainMeta.linkedAdams.contracts).toContain('24SYMV014193944');
  });

  test('σύγκρουση διαφορετικού PROC δεν αντικαθιστά αθόρυβα', () => {
    const { form, warnings, stitchConflictStages } = applyAdamChainResultStitch(
      basePrev,
      {
        success: true,
        notice: {
          adam: '99PROC999',
          snapshot: { referenceNumber: '99PROC999', title: 'Άλλη δημοσίευση' },
          fetchedAt: '2026-02-01T00:00:00.000Z',
        },
      },
      { seedAdam: '99PROC999' }
    );
    expect(form.khmdhsNoticeAdam).toBe('23PROC001');
    expect(stitchConflictStages).toContain('PROC');
    expect(warnings).toContain('stitchConflict:proc');
  });

  test('ίδιος ΑΔΑΜ ενημερώνει snapshot', () => {
    const { form, stitchUpdatedStages } = applyAdamChainResultStitch(
      basePrev,
      {
        success: true,
        notice: {
          adam: '23PROC001',
          snapshot: { referenceNumber: '23PROC001', title: 'Ενημερωμένη δημοσίευση' },
          fetchedAt: '2026-03-01T00:00:00.000Z',
          mappedAssignmentProcedure: 'Διαπραγμάτευση',
        },
      },
      { seedAdam: '23PROC001' }
    );
    expect(form.khmdhsNoticeSnapshot.title).toBe('Ενημερωμένη δημοσίευση');
    expect(form.assignmentProcedure).toBe('Διαπραγμάτευση');
    expect(stitchUpdatedStages).toContain('PROC');
  });

  test('κανονικό replace wipe ΔΕΝ χρησιμοποιείται στο stitch — το replace σβήνει κενά στάδια αν δεν ήρθαν', () => {
    const wiped = applyAdamChainResult(basePrev, symvChainRes, {
      seedAdam: '24SYMV014193944',
      applyMode: 'replace',
    });
    // Με wipe+preserve: REQ/PROC διατηρούνται via stage preserve επειδή δεν ήρθαν
    // Αυτό είναι OK — το κρίσιμο είναι ότι stitch ΔΕΝ αδειάζει πριν.
    expect(wiped.form.khmdhsRequestAdam).toBe('23REQ013047002');

    // Αν όμως ήρθε διαφορετικό notice, το replace μπορεί να κρατήσει παλιό (noticeConflict)
    // Το stitch με κενό prev contract και μόνο payments ήδη δοκιμάστηκε παραπάνω.
    expect(emptyKhmdhsChainFields().khmdhsAdam).toBe('');
  });

  test('applyMode stitch μέσω applyAdamChainResult', () => {
    const { form } = applyAdamChainResult(basePrev, symvChainRes, {
      seedAdam: '24SYMV014193944',
      applyMode: 'stitch',
    });
    expect(form.khmdhsRequestAdam).toBe('23REQ013047002');
    expect(form.khmdhsAdam).toBe('24SYMV014193944');
  });

  test('διατηρεί υπάρχον stitch plan στο stitch path', () => {
    const plan = {
      version: 1,
      status: 'draft',
      segments: [{ seedAdam: '23REQ013047002', coversStages: ['REQ', 'PROC'], fetchedAt: '' }],
    };
    const { form } = applyAdamChainResultStitch(
      { ...basePrev, khmdhsChainStitchPlan: plan },
      symvChainRes,
      { seedAdam: '24SYMV014193944' }
    );
    expect(form.khmdhsChainStitchPlan).toEqual(plan);
  });
});

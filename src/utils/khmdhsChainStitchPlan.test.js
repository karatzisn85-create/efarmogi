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
  formatStitchSegmentScopeLabel,
  stitchPlanConflictsWithImplementationForm,
  filterChainResByStitchCovers,
  pickStitchedContractAdam,
  getKnownStitchSeedAdams,
} from './khmdhsChainStitchPlan';
import {
  getKhmdhsRefreshSeedAdams,
  hasConfirmedKhmdhsStitchPlan,
  buildKhmdhsRefreshChangeReport,
} from './khmdhsChainRefresh';
import {
  applyAdamChainResult,
  applyAdamChainResultStitch,
  applyAdamChainResultStitchMulti,
  applyStitchRefreshResults,
  emptyKhmdhsChainFields,
} from './khmdhsChainApply';
import { collectKhmdhsCommitmentDecisions } from './khmdhsChainExtraFields';
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
    expect(shouldOfferStitchPromptA(form, '24SYMV014193944', { isMultipleContracts: true })).toBe(true);
    expect(shouldOfferStitchPromptA({}, '24SYMV014193944')).toBe(false);
  });

  test('πολλές συμβάσεις: ουσιαστικά δεδομένα και SYMV από contracts[]', () => {
    const form = {
      implementationForm: 'Πολλές Συμβάσεις',
      contracts: [
        { khmdhsAdam: '25SYMV000000001', khmdhsContractSnapshot: { referenceNumber: '25SYMV000000001' } },
      ],
    };
    expect(projectHasSubstantialKhmdhsData(form)).toBe(true);
    expect(detectStagesCoveredByForm(form)).toContain('SYMV');
    expect(shouldOfferStitchPromptA({
      ...form,
      khmdhsChainSeedAdam: '24PROC012345678',
      khmdhsNoticeAdam: '24PROC012345678',
      khmdhsNoticeSnapshot: { referenceNumber: '24PROC012345678' },
    }, '25SYMV000000099')).toBe(true);
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
    expect(plan.segments[0].scope).toBe('shared');
    expect(plan.segments[1].scope).toBe('contract');
    expect(plan.segments[1].contractAdam).toBe('24SYMV014193944');
    expect(formatStitchSegmentScopeLabel(plan.segments[0])).toBe('Κοινά');
    expect(formatStitchSegmentScopeLabel(plan.segments[1])).toContain('Σύμβαση');
    expect(getConfirmedStitchSeedAdams({ khmdhsChainStitchPlan: plan }))
      .toEqual(['23REQ013047002', '24SYMV014193944']);
  });

  test('stitchPlanConflictsWithImplementationForm όταν άλλαξε μία↔πολλές', () => {
    const plan = {
      status: 'confirmed',
      implementationFormAtConfirm: 'Μια Σύμβαση',
      segments: [
        { seedAdam: '23REQ013047002', coversStages: ['REQ'] },
        { seedAdam: '24SYMV014193944', coversStages: ['SYMV'] },
      ],
    };
    expect(stitchPlanConflictsWithImplementationForm(plan, 'Πολλές Συμβάσεις')).toBe(true);
    expect(stitchPlanConflictsWithImplementationForm(plan, 'Μια Σύμβαση')).toBe(false);
    // Παλιά σχέδια χωρίς μορφή → conflict (να μην εφαρμοστούν σιωπηλά)
    expect(stitchPlanConflictsWithImplementationForm({
      ...plan,
      implementationFormAtConfirm: '',
    }, 'Πολλές Συμβάσεις')).toBe(true);
  });

  test('getKhmdhsRefreshSeedAdams αγνοεί σχέδιο σε mismatch μορφής', () => {
    const plan = {
      status: 'confirmed',
      implementationFormAtConfirm: 'Μια Σύμβαση',
      segments: [
        { seedAdam: '23REQ013047002', coversStages: ['REQ', 'PROC'] },
        { seedAdam: '24SYMV014193944', coversStages: ['SYMV'] },
      ],
    };
    const project = {
      implementationForm: 'Πολλές Συμβάσεις',
      khmdhsRequestAdam: '23REQ013047002',
      khmdhsChainStitchPlan: plan,
      contracts: [{ khmdhsAdam: '24SYMV014193944' }],
    };
    const r = getKhmdhsRefreshSeedAdams(project);
    expect(r.usesStitchPlan).toBe(false);
    expect(r.stitchPlanFormMismatch).toBe(true);
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
      implementationFormAtConfirm: 'Μια Σύμβαση',
      segments: [
        { seedAdam: '23REQ013047002', coversStages: ['REQ', 'PROC'], fetchedAt: '' },
        { seedAdam: '24SYMV014193944', coversStages: ['SYMV', 'PAY'], fetchedAt: '' },
      ],
    };
    const project = {
      implementationForm: 'Μια Σύμβαση',
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

  test('συρραφή χωρίς στάδιο COMMIT αφαιρεί ακυρωμένη ανάληψη από την κάρτα και δεν την ξαναφέρνει από το meta', () => {
    const live = {
      adam: '25REQ016195275',
      snapshot: { referenceNumber: '25REQ016195275', title: 'Ζωντανή', signedDate: '2025-03-01' },
    };
    const cancelled = {
      adam: '25REQ016195999',
      snapshot: { referenceNumber: '25REQ016195999', title: 'Ακυρωμένη', signedDate: '2025-04-01' },
    };
    const prev = {
      ...basePrev,
      khmdhsCommitmentDecisions: [live, cancelled],
      khmdhsCommitmentAdam: cancelled.adam,
      khmdhsCommitmentSnapshot: cancelled.snapshot,
      khmdhsAdamChainMeta: {
        ...basePrev.khmdhsAdamChainMeta,
        allBudgetCommitments: [live, cancelled],
        linkedAdams: {
          ...basePrev.khmdhsAdamChainMeta.linkedAdams,
          budgetCommitments: [live.adam, cancelled.adam],
        },
      },
    };
    const { form } = applyAdamChainResultStitch(
      prev,
      {
        ...symvChainRes,
        chainMeta: {
          ...symvChainRes.chainMeta,
          confirmedCancelledAdams: [cancelled.adam],
          allBudgetCommitments: [],
        },
      },
      { seedAdam: '24SYMV014193944', stitchCoversStages: ['SYMV', 'PAY'] }
    );

    expect(form.khmdhsCommitmentDecisions.map((d) => d.adam)).toEqual([live.adam]);
    expect(form.khmdhsCommitmentAdam).toBe(live.adam);
    expect(collectKhmdhsCommitmentDecisions(form).map((d) => d.adam)).toEqual([live.adam]);
    expect((form.khmdhsAdamChainMeta?.allBudgetCommitments || []).map((d) => d.adam))
      .toEqual([live.adam]);
  });

  test('συρραφή χωρίς στάδιο COMMIT δεν σβήνει ανάληψη που απλώς έλειπε από το fetch', () => {
    const kept = {
      adam: '25REQ016195275',
      snapshot: { referenceNumber: '25REQ016195275', title: 'Υπάρχουσα' },
    };
    const prev = {
      ...basePrev,
      khmdhsCommitmentDecisions: [kept],
      khmdhsCommitmentAdam: kept.adam,
      khmdhsCommitmentSnapshot: kept.snapshot,
    };
    const { form } = applyAdamChainResultStitch(
      prev,
      {
        ...symvChainRes,
        chainMeta: {
          ...symvChainRes.chainMeta,
          confirmedCancelledAdams: [],
          allBudgetCommitments: [],
        },
      },
      { seedAdam: '24SYMV014193944', stitchCoversStages: ['SYMV', 'PAY'] }
    );
    expect(form.khmdhsCommitmentDecisions.map((d) => d.adam)).toEqual([kept.adam]);
  });

  test('συρραφή χωρίς στάδιο PAY αφαιρεί ακυρωμένο ένταλμα', () => {
    const prev = {
      ...basePrev,
      khmdhsPayments: [
        {
          adam: '26PAY000000001',
          snapshot: { referenceNumber: '26PAY000000001', totalCostWithVAT: 1000 },
        },
        {
          adam: '26PAY000000002',
          snapshot: { referenceNumber: '26PAY000000002', totalCostWithVAT: 2000 },
        },
      ],
    };
    const { form } = applyAdamChainResultStitch(
      prev,
      {
        success: true,
        notice: {
          adam: '23PROC001',
          snapshot: { referenceNumber: '23PROC001', title: 'Δημοσίευση νέα' },
          fetchedAt: '2026-07-09T06:22:37.084Z',
        },
        chainMeta: {
          confirmedCancelledAdams: ['26PAY000000002'],
        },
      },
      { seedAdam: '23PROC001', stitchCoversStages: ['PROC'] }
    );
    expect(form.khmdhsPayments.map((p) => p.adam)).toEqual(['26PAY000000001']);
    expect(form.khmdhsNoticeAdam).toBe('23PROC001');
  });
});

describe('applyAdamChainResultStitchMulti — πολλές συμβάσεις', () => {
  const multiPrev = {
    implementationForm: 'Πολλές Συμβάσεις',
    projectStatus: 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ',
    khmdhsChainSeedAdam: '24PROC012345678',
    khmdhsNoticeAdam: '24PROC012345678',
    khmdhsNoticeSnapshot: { referenceNumber: '24PROC012345678', title: 'Διακήρυξη' },
    assignmentProcedure: 'Ανοικτός διαγωνισμός',
    contracts: [
      { date: '', amount: '', apeAmount: '', comments: '' },
      {
        khmdhsAdam: '25SYMV000000002',
        khmdhsContractSnapshot: { referenceNumber: '25SYMV000000002', title: 'Σύμβαση Β' },
        amount: '50.000,00',
        date: '2025-06-01',
      },
    ],
  };

  test('συμπληρώνει κενή δημοσίευση χωρίς να αγγίζει υπάρχουσες γραμμές', () => {
    const prev = {
      ...multiPrev,
      khmdhsNoticeAdam: '',
      khmdhsNoticeSnapshot: null,
      assignmentProcedure: '',
    };
    const { form, stitchFilledStages, warnings } = applyAdamChainResultStitchMulti(prev, {
      success: true,
      notice: {
        adam: '24PROC012345678',
        snapshot: { referenceNumber: '24PROC012345678', title: 'Νέα διακήρυξη' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        mappedAssignmentProcedure: 'Ανοικτός διαγωνισμός',
      },
    }, { seedAdam: '24PROC012345678' });
    expect(form.khmdhsNoticeAdam).toBe('24PROC012345678');
    expect(form.khmdhsNoticeSnapshot.title).toBe('Νέα διακήρυξη');
    expect(form.contracts[1].khmdhsAdam).toBe('25SYMV000000002');
    expect(form.contracts[1].amount).toBe('50.000,00');
    expect(stitchFilledStages).toContain('PROC');
    expect(warnings).toEqual([]);
  });

  test('SYMV νέου σπόρου πάει σε κενή γραμμή· δεν αντικαθιστά άλλη', () => {
    const { form, stitchFilledStages, warnings } = applyAdamChainResultStitchMulti(multiPrev, {
      success: true,
      contract: {
        adam: '25SYMV000000001',
        snapshot: { referenceNumber: '25SYMV000000001', title: 'Σύμβαση Α' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        formFields: { contractAmount: '100.000,00', contractDate: '2025-01-15' },
      },
    }, { seedAdam: '25SYMV000000001' });
    expect(form.contracts[0].khmdhsAdam).toBe('25SYMV000000001');
    expect(form.contracts[0].amount).toBe('100.000,00');
    expect(form.contracts[1].khmdhsAdam).toBe('25SYMV000000002');
    expect(form.contracts[1].amount).toBe('50.000,00');
    expect(form.khmdhsNoticeAdam).toBe('24PROC012345678');
    expect(stitchFilledStages).toContain('SYMV');
    expect(warnings).toEqual([]);
  });

  test('ίδιος ΑΔΑΜ ενημερώνει υπάρχουσα γραμμή', () => {
    const { form, stitchUpdatedStages } = applyAdamChainResultStitchMulti(multiPrev, {
      success: true,
      contract: {
        adam: '25SYMV000000002',
        snapshot: { referenceNumber: '25SYMV000000002', title: 'Σύμβαση Β ενημερωμένη' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        formFields: { contractAmount: '55.000,00', contractDate: '2025-06-01' },
      },
    }, { seedAdam: '25SYMV000000002' });
    expect(form.contracts[1].khmdhsContractSnapshot.title).toBe('Σύμβαση Β ενημερωμένη');
    expect(form.contracts[1].amount).toBe('55.000,00');
    expect(form.contracts[0].khmdhsAdam || '').toBe('');
    expect(stitchUpdatedStages).toContain('SYMV');
  });

  test('σύγκρουση SYMV όταν δεν υπάρχει κενή γραμμή για νέο ΑΔΑΜ', () => {
    const prev = {
      ...multiPrev,
      contracts: [
        {
          khmdhsAdam: '25SYMV000000001',
          khmdhsContractSnapshot: { referenceNumber: '25SYMV000000001' },
          amount: '10.000,00',
        },
        {
          khmdhsAdam: '25SYMV000000002',
          khmdhsContractSnapshot: { referenceNumber: '25SYMV000000002' },
          amount: '50.000,00',
        },
      ],
    };
    const { form, warnings, stitchConflictStages } = applyAdamChainResultStitchMulti(prev, {
      success: true,
      contract: {
        adam: '25SYMV000000099',
        snapshot: { referenceNumber: '25SYMV000000099', title: 'Άλλη' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        formFields: { contractAmount: '1,00' },
      },
    }, { seedAdam: '25SYMV000000099' });
    expect(form.contracts[0].khmdhsAdam).toBe('25SYMV000000001');
    expect(form.contracts[1].khmdhsAdam).toBe('25SYMV000000002');
    expect(stitchConflictStages).toContain('SYMV');
    expect(warnings).toContain('stitchConflict:symv');
  });

  test('σύγκρουση διαφορετικού PROC δεν αντικαθιστά', () => {
    const { form, warnings, stitchConflictStages } = applyAdamChainResultStitchMulti(multiPrev, {
      success: true,
      notice: {
        adam: '24PROC999999999',
        snapshot: { referenceNumber: '24PROC999999999', title: 'Άλλη' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
      },
    }, { seedAdam: '24PROC999999999' });
    expect(form.khmdhsNoticeAdam).toBe('24PROC012345678');
    expect(stitchConflictStages).toContain('PROC');
    expect(warnings).toContain('stitchConflict:proc');
  });

  test('applyMode stitch μέσω applyAdamChainResult δρομολογεί σε multi', () => {
    const { form, stitchFilledStages } = applyAdamChainResult(multiPrev, {
      success: true,
      contract: {
        adam: '25SYMV000000001',
        snapshot: { referenceNumber: '25SYMV000000001', title: 'Σύμβαση Α' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        formFields: { contractAmount: '100.000,00', contractDate: '2025-01-15' },
      },
    }, { seedAdam: '25SYMV000000001', applyMode: 'stitch' });
    expect(form.contracts[0].khmdhsAdam).toBe('25SYMV000000001');
    expect(form.contracts[1].khmdhsAdam).toBe('25SYMV000000002');
    expect(form.khmdhsNoticeAdam).toBe('24PROC012345678');
    expect(stitchFilledStages).toContain('SYMV');
  });

  test('χειροκίνητη γραμμή με ποσό δεν θεωρείται κενή για SYMV', () => {
    const prev = {
      ...multiPrev,
      contracts: [
        { date: '2025-01-01', amount: '10.000,00', apeAmount: '', comments: 'χειροκίνητα' },
        multiPrev.contracts[1],
      ],
    };
    const { form, warnings, stitchConflictStages } = applyAdamChainResultStitchMulti(prev, {
      success: true,
      contract: {
        adam: '25SYMV000000099',
        snapshot: { referenceNumber: '25SYMV000000099', title: 'Νέα' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        formFields: { contractAmount: '1,00' },
      },
    }, { seedAdam: '25SYMV000000099' });
    expect(form.contracts[0].amount).toBe('10.000,00');
    expect(form.contracts[0].khmdhsAdam || '').toBe('');
    expect(stitchConflictStages).toContain('SYMV');
    expect(warnings).toContain('stitchConflict:symv');
  });
});

describe('stitch hardenings — γνωστοί ΑΔΑΜ, covers filter, refresh helper', () => {
  test('shouldOfferStitchPromptA false όταν ο ΑΔΑΜ υπάρχει ήδη ως δημοσίευση', () => {
    const form = {
      khmdhsChainSeedAdam: '23REQ013047002',
      khmdhsNoticeAdam: '24PROC012345678',
      khmdhsNoticeSnapshot: { referenceNumber: '24PROC012345678' },
    };
    expect(getKnownStitchSeedAdams(form)).toEqual(expect.arrayContaining([
      '23REQ013047002',
      '24PROC012345678',
    ]));
    expect(shouldOfferStitchPromptA(form, '24PROC012345678')).toBe(false);
  });

  test('filterChainResByStitchCovers αφαιρεί SYMV από κοινό τμήμα', () => {
    const filtered = filterChainResByStitchCovers({
      success: true,
      notice: { adam: '24PROC1', snapshot: { referenceNumber: '24PROC1' } },
      contract: { adam: '25SYMV1', snapshot: { referenceNumber: '25SYMV1' } },
      payments: [{ adam: '26PAY1' }],
    }, ['REQ', 'PROC']);
    expect(filtered.notice?.adam).toBe('24PROC1');
    expect(filtered.contract).toBeUndefined();
    expect(filtered.payments).toBeUndefined();
    expect(filtered.skipCommitmentMerge).toBe(true);
  });

  test('pickStitchedContractAdam προτιμά νέο ΑΔΑΜ γραμμής / SYMV seed', () => {
    const prev = { contracts: [{ khmdhsAdam: '25SYMV000000002' }] };
    const next = {
      contracts: [
        { khmdhsAdam: '25SYMV000000001' },
        { khmdhsAdam: '25SYMV000000002' },
      ],
    };
    expect(pickStitchedContractAdam(prev, next, '25SYMV000000001')).toBe('25SYMV000000001');
  });

  test('applyStitchRefreshResults: κοινός σπόρος με SYMV στο chain δεν γεμίζει γραμμή', () => {
    const project = {
      implementationForm: 'Πολλές Συμβάσεις',
      khmdhsNoticeAdam: '24PROC012345678',
      khmdhsNoticeSnapshot: { referenceNumber: '24PROC012345678' },
      contracts: [
        { date: '', amount: '' },
        {
          khmdhsAdam: '25SYMV000000002',
          khmdhsContractSnapshot: { referenceNumber: '25SYMV000000002' },
          amount: '50.000,00',
        },
      ],
      khmdhsChainStitchPlan: {
        status: 'confirmed',
        implementationFormAtConfirm: 'Πολλές Συμβάσεις',
        segments: [
          { seedAdam: '24PROC012345678', coversStages: ['PROC'], scope: 'shared' },
          { seedAdam: '25SYMV000000001', coversStages: ['SYMV'], scope: 'contract', contractAdam: '25SYMV000000001' },
        ],
      },
    };
    const { form, warnings } = applyStitchRefreshResults(project, [
      {
        success: true,
        seedAdam: '24PROC012345678',
        chainRes: {
          success: true,
          notice: {
            adam: '24PROC012345678',
            snapshot: { referenceNumber: '24PROC012345678', title: 'Ενημ.' },
            fetchedAt: '2026-07-01T00:00:00.000Z',
          },
          // Απρόσμενα SYMV στο κοινό fetch — πρέπει να φιλτραριστεί από covers
          contract: {
            adam: '25SYMV000000099',
            snapshot: { referenceNumber: '25SYMV000000099' },
            formFields: { contractAmount: '9,00' },
          },
        },
      },
      {
        success: true,
        seedAdam: '25SYMV000000001',
        chainRes: {
          success: true,
          contract: {
            adam: '25SYMV000000001',
            snapshot: { referenceNumber: '25SYMV000000001', title: 'Σύμβαση Α' },
            formFields: { contractAmount: '100.000,00', contractDate: '2025-01-15' },
          },
        },
      },
    ]);
    expect(form.contracts[0].khmdhsAdam).toBe('25SYMV000000001');
    expect(form.contracts[0].amount).toBe('100.000,00');
    expect(form.contracts[1].khmdhsAdam).toBe('25SYMV000000002');
    expect(form.khmdhsNoticeSnapshot.title).toBe('Ενημ.');
    expect(warnings).not.toContain('stitchConflict:symv');
  });

  test('αναφορά: stitchConflict:proc εμφανίζεται ως προσοχή', () => {
    const report = buildKhmdhsRefreshChangeReport({}, {}, {
      warnings: ['stitchConflict:proc'],
    });
    expect(report.category).toBe('attention');
    expect(report.attentionLines.some((l) => l.includes('δημοσίευση'))).toBe(true);
  });

  test('buildConfirmed πάντα γράφει implementationFormAtConfirm', () => {
    const plan = buildConfirmedStitchPlanFromStitch({
      prevSeedAdam: '23REQ013047002',
      prevCoversStages: ['REQ'],
      newSeedAdam: '24SYMV014193944',
      newCoversStages: ['SYMV'],
      implementationForm: 'Πολλές Συμβάσεις',
    });
    expect(plan.implementationFormAtConfirm).toBe('Πολλές Συμβάσεις');
  });
});

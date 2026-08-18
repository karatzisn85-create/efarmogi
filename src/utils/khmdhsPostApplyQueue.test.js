/**
 * @jest-environment node
 */
import {
  buildPostApplyQueue,
  filterPostApplySituations,
  getFollowUpQueue,
  removeTaskFromQueue,
  resolvePostFetchUi,
  resolveReturnToPendingList,
  resolveReopenPendingList,
  resolveReopenAfterFailedFetch,
  resolveSituationActionContractIndex,
  queueHasPendingWork,
  countRemainingPendingTasks,
  mergePostApplyQueues,
  POST_APPLY_TASK,
} from './khmdhsPostApplyQueue';

const reviewForm = {
  projectStatus: 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ',
  khmdhsDataQualityReview: {
    items: [{
      fieldId: 'contractAmount',
      status: 'needs_review',
      label: 'Ποσό',
      contractIndex: null,
    }],
    resolutions: {},
    acknowledgedFieldIds: [],
  },
};

const cleanForm = {
  projectStatus: 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ',
  khmdhsDataQualityReview: { items: [], resolutions: {} },
};

describe('khmdhsPostApplyQueue', () => {
  test('data review comes first and follow-up excludes it', () => {
    const queue = buildPostApplyQueue({
      formAfter: reviewForm,
      dqr: reviewForm.khmdhsDataQualityReview,
      stitchPromptBPayload: {
        segments: [
          { seedAdam: '23REQ001', coversStages: ['REQ'] },
          { seedAdam: '24SYMV001', coversStages: ['SYMV'] },
        ],
      },
      apeConflict: { current: '1', suggested: '2' },
      skipExpiry: true,
    });
    expect(queue.needsDataReviewFirst).toBe(true);
    expect(queue.tasks[0].type).toBe(POST_APPLY_TASK.DATA_REVIEW);
    expect(queue.tasks.some((t) => t.type === POST_APPLY_TASK.STITCH_B)).toBe(true);
    expect(queue.tasks.some((t) => t.type === POST_APPLY_TASK.APE)).toBe(true);

    const follow = getFollowUpQueue(queue);
    expect(follow.tasks.every((t) => t.type !== POST_APPLY_TASK.DATA_REVIEW)).toBe(true);
    expect(follow.hasFollowUpTasks).toBe(true);
  });

  test('filters orphan_symv after stitch keep', () => {
    const { shouldShow, filteredReport } = filterPostApplySituations({
      hasSituations: true,
      requiresDecision: false,
      primarySeverity: 'warning',
      situations: [
        { id: 'orphan_symv_seed', severity: 'warning', title: 'Ορφανή' },
        { id: 'other', severity: 'warning', title: 'Άλλο', requiresDecision: true },
      ],
    }, { stitchApplyMode: 'stitch' });
    expect(filteredReport.situations.some((s) => s.id === 'orphan_symv_seed')).toBe(false);
    expect(shouldShow).toBe(true);
  });

  test('removeTaskFromQueue drops completed item', () => {
    const queue = {
      tasks: [
        { id: POST_APPLY_TASK.STITCH_B, type: POST_APPLY_TASK.STITCH_B },
        { id: POST_APPLY_TASK.APE, type: POST_APPLY_TASK.APE },
      ],
      needsDataReviewFirst: false,
      hasFollowUpTasks: true,
    };
    const next = removeTaskFromQueue(queue, POST_APPLY_TASK.STITCH_B);
    expect(next.tasks.map((t) => t.id)).toEqual([POST_APPLY_TASK.APE]);
  });

  test('no empty queue when nothing pending', () => {
    const queue = buildPostApplyQueue({
      formAfter: cleanForm,
      skipExpiry: true,
    });
    expect(queue.needsDataReviewFirst).toBe(false);
    expect(queue.hasFollowUpTasks).toBe(false);
    expect(queue.tasks).toHaveLength(0);
  });
});

describe('resolvePostFetchUi — ένα μονοπάτι μετά την ανάκτηση', () => {
  test('με εκκρεμότητες ελέγχου: ανοίγει ΜΟΝΟ τη λίστα, ποτέ απευθείας τον έλεγχο', () => {
    const queue = buildPostApplyQueue({
      formAfter: reviewForm,
      dqr: reviewForm.khmdhsDataQualityReview,
      skipExpiry: true,
    });
    expect(queue.needsDataReviewFirst).toBe(true);

    const ui = resolvePostFetchUi(queue);
    expect(ui.openPendingTasks).toBe(true);
    expect(ui.openDataReview).toBe(false);
  });

  test('με μόνο προαιρετικές εκκρεμότητες: ανοίγει τη λίστα, όχι άλλα παράθυρα', () => {
    const queue = buildPostApplyQueue({
      formAfter: cleanForm,
      stitchPromptBPayload: {
        segments: [
          { seedAdam: '23REQ001', coversStages: ['REQ'] },
          { seedAdam: '24SYMV001', coversStages: ['SYMV'] },
        ],
      },
      apeConflict: { current: '10', suggested: '20', contractLabel: 'Σύμβαση 1' },
      skipExpiry: true,
    });
    expect(queue.needsDataReviewFirst).toBe(false);
    expect(queue.hasFollowUpTasks).toBe(true);

    const ui = resolvePostFetchUi(queue);
    expect(ui.openPendingTasks).toBe(true);
    expect(ui.openDataReview).toBe(false);
  });

  test('καθαρή ανάκτηση χωρίς εκκρεμότητες: δεν ανοίγει τίποτα', () => {
    const queue = buildPostApplyQueue({
      formAfter: cleanForm,
      skipExpiry: true,
    });
    const ui = resolvePostFetchUi(queue);
    expect(ui.openPendingTasks).toBe(false);
    expect(ui.openDataReview).toBe(false);
  });

  test('suppress / skip: δεν ανοίγει λίστα ούτε έλεγχο (ακόμα κι αν υπάρχουν εκκρεμότητες)', () => {
    const queue = buildPostApplyQueue({
      formAfter: reviewForm,
      dqr: reviewForm.khmdhsDataQualityReview,
      skipExpiry: true,
    });
    expect(resolvePostFetchUi(queue, { suppress: true })).toEqual({
      openPendingTasks: false,
      openDataReview: false,
    });
    expect(resolvePostFetchUi(queue, { skip: true })).toEqual({
      openPendingTasks: false,
      openDataReview: false,
    });
  });

  test('μετά deferred apply (skipSituationModal): η λίστα ΠΡΕΠΕΙ να ανοίγει — όχι suppress', () => {
    // Η φόρμα περνά μόνο suppress στη resolvePostFetchUi· το skipSituationModal
    // αφαιρεί μόνο το SITUATION από την ουρά, δεν μπλοκάρει το UI.
    const queue = buildPostApplyQueue({
      formAfter: reviewForm,
      dqr: reviewForm.khmdhsDataQualityReview,
      situationReport: null, // όπως με skipSituationModal
      apeConflict: { current: '1', suggested: '2' },
      skipExpiry: true,
    });
    expect(queue.tasks.some((t) => t.type === POST_APPLY_TASK.DATA_REVIEW)).toBe(true);
    expect(queue.tasks.some((t) => t.type === POST_APPLY_TASK.SITUATION)).toBe(false);
    expect(resolvePostFetchUi(queue)).toEqual({
      openPendingTasks: true,
      openDataReview: false,
    });
    // getFollowUpQueue αφαιρεί DATA_REVIEW — γι' αυτό το reopen ΔΕΝ το χρησιμοποιεί
    const wronglyStripped = getFollowUpQueue(queue);
    expect(wronglyStripped.tasks.some((t) => t.type === POST_APPLY_TASK.DATA_REVIEW)).toBe(false);
    expect(queue.needsDataReviewFirst).toBe(true);
  });

  test('merge + resolvePostFetchUi: συμπληρωματική κενή δεν κρύβει προηγούμενες εκκρεμότητες στο UI', () => {
    const prev = buildPostApplyQueue({
      formAfter: cleanForm,
      apeConflict: { current: '1', suggested: '2' },
      skipExpiry: true,
    });
    const incoming = buildPostApplyQueue({
      formAfter: cleanForm,
      skipExpiry: true,
    });
    expect(incoming.tasks.length).toBe(0);
    const merged = mergePostApplyQueues(prev, incoming);
    expect(resolvePostFetchUi(incoming).openPendingTasks).toBe(false);
    expect(resolvePostFetchUi(merged).openPendingTasks).toBe(true);
  });

  test('ουδέποτε επιστρέφει openDataReview:true (κανόνας μονοπατιού)', () => {
    const cases = [
      buildPostApplyQueue({ formAfter: reviewForm, dqr: reviewForm.khmdhsDataQualityReview, skipExpiry: true }),
      buildPostApplyQueue({
        formAfter: cleanForm,
        apeConflict: { current: '1', suggested: '2' },
        skipExpiry: true,
      }),
      buildPostApplyQueue({ formAfter: cleanForm, skipExpiry: true }),
      null,
      undefined,
      { tasks: [], needsDataReviewFirst: true, hasFollowUpTasks: false },
    ];
    for (const queue of cases) {
      expect(resolvePostFetchUi(queue).openDataReview).toBe(false);
      expect(resolvePostFetchUi(queue, { suppress: true }).openDataReview).toBe(false);
    }
  });
});

describe('resolveReturnToPendingList — επιστροφή στη λίστα μετά επιμέρους παράθυρο', () => {
  test('αν μένουν εκκρεμότητες, επιστρέφει στη λίστα', () => {
    const queue = {
      tasks: [
        { id: POST_APPLY_TASK.APE, type: POST_APPLY_TASK.APE },
        { id: POST_APPLY_TASK.REGISTRY, type: POST_APPLY_TASK.REGISTRY },
      ],
      needsDataReviewFirst: false,
      hasFollowUpTasks: true,
    };
    const afterReview = removeTaskFromQueue(queue, POST_APPLY_TASK.APE);
    const ret = resolveReturnToPendingList(afterReview);
    expect(ret.openPendingTasks).toBe(true);
    expect(ret.allClear).toBe(false);
  });

  test('αν δεν μένει τίποτα, allClear και κλείσιμο λίστας', () => {
    const empty = { tasks: [], needsDataReviewFirst: false, hasFollowUpTasks: false };
    const ret = resolveReturnToPendingList(empty);
    expect(ret.openPendingTasks).toBe(false);
    expect(ret.allClear).toBe(true);
  });

  test('μετά ολοκλήρωση ελέγχου: follow-up ανοίγει ξανά τη λίστα', () => {
    const queue = buildPostApplyQueue({
      formAfter: reviewForm,
      dqr: reviewForm.khmdhsDataQualityReview,
      apeConflict: { current: '1', suggested: '2' },
      skipExpiry: true,
    });
    const withoutReview = removeTaskFromQueue(queue, POST_APPLY_TASK.DATA_REVIEW);
    const follow = getFollowUpQueue(withoutReview);
    const ret = resolveReturnToPendingList(follow);
    expect(follow.tasks.some((t) => t.type === POST_APPLY_TASK.APE)).toBe(true);
    expect(ret.openPendingTasks).toBe(true);
  });
});

describe('queueHasPendingWork', () => {
  test('true όταν needsDataReviewFirst ή hasFollowUpTasks ή tasks.length', () => {
    expect(queueHasPendingWork(null)).toBe(false);
    expect(queueHasPendingWork({ tasks: [], needsDataReviewFirst: false, hasFollowUpTasks: false })).toBe(false);
    expect(queueHasPendingWork({ tasks: [], needsDataReviewFirst: true, hasFollowUpTasks: false })).toBe(true);
    expect(queueHasPendingWork({
      tasks: [{ id: 'ape', type: POST_APPLY_TASK.APE }],
      needsDataReviewFirst: false,
      hasFollowUpTasks: true,
    })).toBe(true);
  });
});

describe('mergePostApplyQueues — συμπληρωματική δεν σβήνει προηγούμενες εκκρεμότητες', () => {
  test('κρατά REGISTRY/APE από την κύρια και αντικαθιστά DATA_REVIEW', () => {
    const main = {
      tasks: [
        { id: POST_APPLY_TASK.DATA_REVIEW, type: POST_APPLY_TASK.DATA_REVIEW, unresolvedCount: 1 },
        { id: POST_APPLY_TASK.REGISTRY, type: POST_APPLY_TASK.REGISTRY },
        { id: POST_APPLY_TASK.APE, type: POST_APPLY_TASK.APE },
      ],
      needsDataReviewFirst: true,
      hasFollowUpTasks: true,
    };
    const supp = buildPostApplyQueue({
      formAfter: reviewForm,
      dqr: reviewForm.khmdhsDataQualityReview,
      skipExpiry: true,
    });
    const merged = mergePostApplyQueues(main, supp);
    expect(merged.tasks.some((t) => t.type === POST_APPLY_TASK.DATA_REVIEW)).toBe(true);
    expect(merged.tasks.some((t) => t.type === POST_APPLY_TASK.REGISTRY)).toBe(true);
    expect(merged.tasks.some((t) => t.type === POST_APPLY_TASK.APE)).toBe(true);
    expect(merged.tasks.filter((t) => t.type === POST_APPLY_TASK.DATA_REVIEW)).toHaveLength(1);
    expect(merged.needsDataReviewFirst).toBe(true);
  });

  test('χωρίς προηγούμενη ουρά επιστρέφει την εισερχόμενη', () => {
    const supp = buildPostApplyQueue({
      formAfter: reviewForm,
      dqr: reviewForm.khmdhsDataQualityReview,
      skipExpiry: true,
    });
    expect(mergePostApplyQueues(null, supp)).toEqual(supp);
    expect(mergePostApplyQueues({ tasks: [] }, supp)).toEqual(supp);
  });

  test('χωρίς εισερχόμενη κρατά την προηγούμενη', () => {
    const main = {
      tasks: [{ id: POST_APPLY_TASK.APE, type: POST_APPLY_TASK.APE }],
      needsDataReviewFirst: false,
      hasFollowUpTasks: true,
    };
    expect(mergePostApplyQueues(main, null)).toEqual(main);
  });
});

describe('συμπληρωματική: toast μόνο όταν δεν ανοίγει λίστα', () => {
  test('όταν ανοίγει λίστα, το success toast πρέπει να μπλοκάρεται (ίδιος κανόνας με κύρια)', () => {
    const queue = buildPostApplyQueue({
      formAfter: reviewForm,
      dqr: reviewForm.khmdhsDataQualityReview,
      skipExpiry: true,
    });
    const ui = resolvePostFetchUi(queue);
    expect(ui.openPendingTasks).toBe(true);
    // Η φόρμα δείχνει toast μόνο όταν !openPendingTasks
    expect(!ui.openPendingTasks).toBe(false);
  });
});

describe('πλήρες σενάριο μονοπατιού: φέρνω → λίστα → αποθήκευση', () => {
  test('υποχρεωτικός έλεγχος + προαιρετικά: πρώτο UI = λίστα με όλες τις εργασίες στη σειρά', () => {
    const queue = buildPostApplyQueue({
      formAfter: reviewForm,
      dqr: reviewForm.khmdhsDataQualityReview,
      situationReport: {
        hasSituations: true,
        requiresDecision: true,
        situations: [{
          id: 'parallel',
          severity: 'warning',
          title: 'Παράλληλες',
          requiresDecision: true,
          actions: [{ id: 'dismiss', label: 'Το είδα' }],
        }],
      },
      stitchPromptBPayload: {
        segments: [
          { seedAdam: 'A', coversStages: ['REQ'] },
          { seedAdam: 'B', coversStages: ['SYMV'] },
        ],
      },
      apeConflict: { current: '1', suggested: '2' },
      skipExpiry: true,
    });

    const order = queue.tasks.map((t) => t.type);
    expect(order[0]).toBe(POST_APPLY_TASK.DATA_REVIEW);
    expect(order).toContain(POST_APPLY_TASK.SITUATION);
    expect(order).toContain(POST_APPLY_TASK.STITCH_B);
    expect(order).toContain(POST_APPLY_TASK.APE);

    // Αυτόματο άνοιγμα = μόνο λίστα
    const ui = resolvePostFetchUi(queue);
    expect(ui).toEqual({ openPendingTasks: true, openDataReview: false });

    // Χρήστης ολοκληρώνει έλεγχο → επιστροφή στη λίστα με τα υπόλοιπα
    const afterReview = getFollowUpQueue(removeTaskFromQueue(queue, POST_APPLY_TASK.DATA_REVIEW));
    expect(resolveReturnToPendingList(afterReview).openPendingTasks).toBe(true);

    // Ολοκλήρωση όλων → έτοιμο για αποθήκευση
    let remaining = afterReview;
    for (const t of [...afterReview.tasks]) {
      remaining = removeTaskFromQueue(remaining, t.id);
    }
    expect(resolveReturnToPendingList(remaining)).toEqual({
      openPendingTasks: false,
      allClear: true,
    });
  });

  test('συμπληρωματική σύμβαση με DQR: ίδιο μονοπάτι (λίστα, όχι απευθείας έλεγχος)', () => {
    const queue = buildPostApplyQueue({
      formAfter: reviewForm,
      dqr: reviewForm.khmdhsDataQualityReview,
      skipExpiry: true,
    });
    const ui = resolvePostFetchUi(queue);
    expect(ui.openPendingTasks).toBe(true);
    expect(ui.openDataReview).toBe(false);
    expect(queue.tasks.some((t) => t.type === POST_APPLY_TASK.DATA_REVIEW)).toBe(true);
  });
});

describe('resolveReopenPendingList — κλείσιμο προειδοποίησης χωρίς να χαθεί ο έλεγχος', () => {
  test('με DATA_REVIEW στην ουρά: ανοίγει λίστα και ΔΕΝ αφαιρεί τον έλεγχο', () => {
    const queue = buildPostApplyQueue({
      formAfter: reviewForm,
      dqr: reviewForm.khmdhsDataQualityReview,
      apeConflict: { current: '1', suggested: '2' },
      skipExpiry: true,
    });
    expect(queue.tasks.some((t) => t.type === POST_APPLY_TASK.DATA_REVIEW)).toBe(true);

    // Λάθος παλιό μονοπάτι: getFollowUpQueue σβήνει τον έλεγχο
    expect(getFollowUpQueue(queue).tasks.some((t) => t.type === POST_APPLY_TASK.DATA_REVIEW)).toBe(false);

    // Σωστό μονοπάτι μετά αποτυχημένη νέα ανάκτηση / κλείσιμο προειδοποίησης
    const reopen = resolveReopenPendingList(queue);
    expect(reopen.openPendingTasks).toBe(true);
    expect(reopen.preserveQueue).toBe(true);
    // Η ουρά παραμένει ανέπαφη — ο caller δεν πρέπει να την αντικαταστήσει με follow-up
    expect(queue.tasks.some((t) => t.type === POST_APPLY_TASK.DATA_REVIEW)).toBe(true);
    expect(queue.needsDataReviewFirst).toBe(true);
  });

  test('κενή ουρά: δεν ανοίγει λίστα', () => {
    const empty = buildPostApplyQueue({ formAfter: cleanForm, skipExpiry: true });
    expect(resolveReopenPendingList(empty)).toEqual({
      openPendingTasks: false,
      preserveQueue: true,
    });
  });

  test('σενάριο: επιτυχής ανάκτηση → κλείσιμο λίστας → αποτυχημένη νέα → reopen κρατά έλεγχο', () => {
    const afterSuccess = buildPostApplyQueue({
      formAfter: reviewForm,
      dqr: reviewForm.khmdhsDataQualityReview,
      skipExpiry: true,
    });
    // Χρήστης έκλεισε τη λίστα· ουρά παραμένει
    expect(queueHasPendingWork(afterSuccess)).toBe(true);

    // Αποτυχημένη νέα ανάκτηση δεν αντικαθιστά την ουρά (finishApply δεν τρέχει)
    // Στο κλείσιμο προειδοποίησης: reopen — όχι getFollowUpQueue
    const reopen = resolveReopenPendingList(afterSuccess);
    expect(reopen.openPendingTasks).toBe(true);
    expect(afterSuccess.tasks.map((t) => t.type)).toContain(POST_APPLY_TASK.DATA_REVIEW);
  });

  test('αποτυχημένη νέα ανάκτηση: ξανάνοιγμα αν η λίστα είναι κλειστή', () => {
    const afterSuccess = buildPostApplyQueue({
      formAfter: reviewForm,
      dqr: reviewForm.khmdhsDataQualityReview,
      skipExpiry: true,
    });
    expect(resolveReopenAfterFailedFetch(afterSuccess, { listAlreadyOpen: false })).toEqual({
      openPendingTasks: true,
      preserveQueue: true,
    });
    expect(resolveReopenAfterFailedFetch(afterSuccess, { listAlreadyOpen: true })).toEqual({
      openPendingTasks: false,
      preserveQueue: true,
    });
    expect(resolveReopenAfterFailedFetch(afterSuccess, { situationModalOpen: true })).toEqual({
      openPendingTasks: false,
      preserveQueue: true,
    });
    expect(afterSuccess.tasks.map((t) => t.type)).toContain(POST_APPLY_TASK.DATA_REVIEW);
  });

  test('«Θα το ελέγξω αργότερα» δεν αφαιρεί τον υποχρεωτικό έλεγχο', () => {
    const queue = buildPostApplyQueue({
      formAfter: reviewForm,
      dqr: reviewForm.khmdhsDataQualityReview,
      skipExpiry: true,
    });
    const later = resolveReopenPendingList(queue);
    expect(later.openPendingTasks).toBe(true);
    expect(later.preserveQueue).toBe(true);
    expect(queue.tasks.some((t) => t.type === POST_APPLY_TASK.DATA_REVIEW)).toBe(true);
    expect(getFollowUpQueue(queue).tasks.some((t) => t.type === POST_APPLY_TASK.DATA_REVIEW)).toBe(false);
  });

  test('countRemainingPendingTasks μετρά όσες δεν έχουν ολοκληρωθεί', () => {
    const queue = buildPostApplyQueue({
      formAfter: reviewForm,
      dqr: reviewForm.khmdhsDataQualityReview,
      skipExpiry: true,
    });
    const reviewId = queue.tasks.find((t) => t.type === POST_APPLY_TASK.DATA_REVIEW)?.id;
    expect(countRemainingPendingTasks(queue, [])).toBe(queue.tasks.length);
    expect(countRemainingPendingTasks(queue, [reviewId])).toBe(queue.tasks.length - 1);
  });
});

describe('situationContractIndex — πολλές συμβάσεις / RETRY_SEED από λίστα', () => {
  const situationReport = {
    hasSituations: true,
    requiresDecision: true,
    situations: [{
      id: 'no_linked_actions',
      severity: 'error',
      title: 'Δεν βρέθηκαν πράξεις',
      requiresDecision: true,
      actions: [{ id: 'retry_seed', label: 'Δοκιμή άλλου ΑΔΑΜ', suggestedAdam: '24SYMV999' }],
    }],
  };

  test('buildPostApplyQueue αποθηκεύει contractIndex στο SITUATION task', () => {
    const queue = buildPostApplyQueue({
      formAfter: cleanForm,
      situationReport,
      situationContractIndex: 1,
      skipExpiry: true,
    });
    const sit = queue.tasks.find((t) => t.type === POST_APPLY_TASK.SITUATION);
    expect(sit).toBeTruthy();
    expect(sit.contractIndex).toBe(1);
  });

  test('χωρίς situationContractIndex: contractIndex null (κοινή αλυσίδα)', () => {
    const queue = buildPostApplyQueue({
      formAfter: cleanForm,
      situationReport,
      skipExpiry: true,
    });
    const sit = queue.tasks.find((t) => t.type === POST_APPLY_TASK.SITUATION);
    expect(sit.contractIndex).toBeNull();
  });

  test('resolveSituationActionContractIndex: προτεραιότητα task από λίστα πάνω από modal', () => {
    expect(resolveSituationActionContractIndex(1, 0)).toBe(1);
    expect(resolveSituationActionContractIndex(null, 2)).toBe(2);
    expect(resolveSituationActionContractIndex(undefined, null)).toBeNull();
    expect(resolveSituationActionContractIndex(-1, 0)).toBe(0);
    expect(resolveSituationActionContractIndex('1', null)).toBe(1);
  });

  test('merge κρατά contractIndex του εισερχόμενου SITUATION', () => {
    const prev = buildPostApplyQueue({
      formAfter: cleanForm,
      situationReport,
      situationContractIndex: 0,
      skipExpiry: true,
    });
    const incoming = buildPostApplyQueue({
      formAfter: cleanForm,
      situationReport,
      situationContractIndex: 2,
      skipExpiry: true,
    });
    const merged = mergePostApplyQueues(prev, incoming);
    const sit = merged.tasks.find((t) => t.type === POST_APPLY_TASK.SITUATION);
    expect(sit.contractIndex).toBe(2);
  });
});

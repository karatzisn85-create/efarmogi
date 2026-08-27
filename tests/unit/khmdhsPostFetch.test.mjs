import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const pf = require('../../app/core/khmdhsPostFetch.js');

test('πριν την ανάκτηση: λάθος ΑΔΑΜ, διπλό SYMV, συμπληρωματική', () => {
  assert.equal(pf.resolveFetchStartGate({ invalidAdam: true }).next, pf.FETCH_START.INVALID_ADAM);
  assert.equal(pf.resolveFetchStartGate({ duplicateSymv: true }).next, pf.FETCH_START.DUPLICATE_SYMV);
  assert.equal(pf.resolveFetchStartGate({ routeSupplementary: true }).next, pf.FETCH_START.SUPPLEMENTARY);
  assert.equal(pf.resolveFetchStartGate({}).next, pf.FETCH_START.FETCH);
  assert.equal(pf.resolveFetchStartGate({ invalidAdam: true, duplicateSymv: true }).next, pf.FETCH_START.INVALID_ADAM);
});

test('πριν την εφαρμογή: συρραφή Α πριν την κατανομή όταν υπάρχουν ήδη δεδομένα', () => {
  assert.equal(pf.resolvePreApplyGate({
    offerStitchA: true,
    offerSymvPlanner: true,
  }).next, pf.PRE_APPLY.STITCH_A);
  assert.equal(pf.resolvePreApplyGate({
    offerStitchA: true,
    needsBranchPicker: true,
  }).next, pf.PRE_APPLY.STITCH_A);
  assert.equal(pf.resolvePreApplyGate({
    offerStitchA: true,
    skipStitchPromptA: true,
    offerSymvPlanner: true,
  }).next, pf.PRE_APPLY.SYMV_PLANNER);
});

test('πριν την εφαρμογή: σειρά κλάδος → σχεδιασμός → διπλό → αναβολή', () => {
  assert.equal(pf.resolvePreApplyGate({
    needsBranchPicker: true,
    offerSymvPlanner: true,
  }).next, pf.PRE_APPLY.SYMV_PLANNER);
  assert.equal(pf.resolvePreApplyGate({ needsBranchPicker: true }).next, pf.PRE_APPLY.BRANCH_PICKER);
  assert.equal(pf.resolvePreApplyGate({
    offerSymvPlanner: true,
    reusableSymvPlan: true,
    hasDuplicateConflict: true,
  }).next, pf.PRE_APPLY.DUPLICATE_ANCHOR);
  assert.equal(pf.resolvePreApplyGate({
    offerSymvPlanner: true,
    hasIncomingSymvPlan: true,
    offerStitchA: true,
  }).next, pf.PRE_APPLY.STITCH_A);
  assert.equal(pf.resolvePreApplyGate({
    offerStitchA: true,
    skipStitchPromptA: true,
    deferCancelledSeed: true,
  }).next, pf.PRE_APPLY.DEFER_SITUATION);
  assert.equal(pf.resolvePreApplyGate({
    needsBranchPicker: true,
    contractIndex: 0,
    hasDuplicateConflict: true,
  }).next, pf.PRE_APPLY.APPLY);
  assert.equal(pf.resolvePreApplyGate({}).next, pf.PRE_APPLY.APPLY);
});

test('μετά την εφαρμογή ανοίγει μόνο η λίστα — ποτέ απευθείας έλεγχος', () => {
  const queue = pf.assemblePostApplyTasks({ unresolvedReviewCount: 2 });
  assert.equal(queue.needsDataReviewFirst, true);
  const ui = pf.resolvePostFetchUi(queue);
  assert.deepEqual(ui, { openPendingTasks: true, openDataReview: false });
  assert.deepEqual(pf.resolvePostFetchUi(queue, { suppress: true }), {
    openPendingTasks: false,
    openDataReview: false,
  });
  assert.deepEqual(pf.resolvePostFetchUi(pf.assemblePostApplyTasks({}), {}), {
    openPendingTasks: false,
    openDataReview: false,
  });
});

test('σειρά εκκρεμοτήτων: έλεγχος, κατάσταση, συρραφή Β, μητρώο, ΑΠΕ, λήξη', () => {
  const queue = pf.assemblePostApplyTasks({
    unresolvedReviewCount: 1,
    showSituation: true,
    situation: { title: 'Προειδοποίηση', requiresDecision: true },
    stitchBSegments: [{}, {}],
    offerRegistry: true,
    apeConflict: { contractLabel: 'Σ1' },
    expiry: { summary: 'Έληξε' },
  });
  assert.deepEqual(queue.tasks.map((t) => t.type), [
    'data_review', 'situation', 'stitch_b', 'registry', 'ape', 'expiry',
  ]);
});

test('επιστροφή / αργότερα / αποτυχία / συγχώνευση', () => {
  const full = pf.assemblePostApplyTasks({
    unresolvedReviewCount: 1,
    offerRegistry: true,
  });
  const afterReview = pf.removeTaskFromQueue(full, 'data_review');
  assert.deepEqual(pf.resolveReturnToPendingList(afterReview), {
    openPendingTasks: true,
    allClear: false,
  });
  const later = pf.resolveReopenPendingList(full);
  assert.equal(later.openPendingTasks, true);
  assert.equal(later.preserveQueue, true);
  assert.deepEqual(pf.resolveReopenAfterFailedFetch(full, { listAlreadyOpen: true }), {
    openPendingTasks: false,
    preserveQueue: true,
  });
  const merged = pf.mergePostApplyQueues(
    pf.assemblePostApplyTasks({ offerRegistry: true, apeConflict: {} }),
    pf.assemblePostApplyTasks({ unresolvedReviewCount: 1 })
  );
  assert.deepEqual(merged.tasks.map((t) => t.type), ['data_review', 'registry', 'ape']);
});

test('χαρακτηρισμός: επιλογές χρήστη και υποχρεωτικά πεδία', () => {
  assert.deepEqual(pf.USER_CHAIN_KIND_SELECT_VALUES, [
    'modification', 'extension', 'republication', 'other',
  ]);
  assert.equal(pf.shouldShowCharacterizationCard({ isRoot: true }), false);
  assert.equal(pf.validateChainKindDraft({}).ok, false);
  assert.equal(pf.validateChainKindDraft({ kind: 'extension' }).message, 'Συμπληρώστε τη νέα ημερομηνία λήξης.');
  assert.equal(pf.validateChainKindDraft({ kind: 'extension', endDate: '2027-12-31' }).ok, true);
  assert.equal(pf.validateChainKindDraft({
    kind: 'modification',
    hasKhmdhsDate: false,
  }).message, 'Συμπληρώστε την ημερομηνία της συμπληρωματικής σύμβασης.');
  assert.equal(pf.validateChainKindDraft({
    kind: 'modification',
    hasKhmdhsDate: true,
    modAmount: '12.500,00',
    modAmountType: 'delta',
  }).ok, true);
  assert.equal(pf.validateChainKindDraft({
    kind: 'republication',
    correctsAdam: '24SYMV1',
  }).message, 'Επιλέξτε τι διορθώνει (τίτλος, ποσό ή ημερομηνία).');
  assert.equal(pf.validateChainKindDraft({ kind: 'other' }).ok, true);
  assert.equal(pf.canSaveKindCard('modification', { ok: false }), true);
  assert.equal(pf.canSaveKindCard('extension', { ok: false }), false);
});

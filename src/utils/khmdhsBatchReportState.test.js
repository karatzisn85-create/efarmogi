/**
 * @jest-environment node
 */
import {
  batchRunHasOutcome,
  isKhmdhsCharacterizationPending,
  markBatchItemsResolved,
  mergeKhmdhsBatchResults,
} from './khmdhsBatchReportState';
import {
  buildKhmdhsFindingAction,
  buildKhmdhsRefreshFindings,
  KHMDHS_FINDING_ACTION,
  KHMDHS_FINDING_OUTCOME,
} from './khmdhsRefreshFindings';

const previousRun = {
  refreshed: 2,
  needsIntervention: 1,
  failed: 1,
  skipped: 0,
  interventionItems: [{ id: 'c', label: 'Γ' }],
  items: [
    { status: 'refreshed', id: 'a', label: 'Α' },
    { status: 'refreshed', id: 'b', label: 'Β' },
    { status: 'intervened', id: 'c', label: 'Γ' },
    { status: 'failed', id: 'd', label: 'Δ' },
  ],
};

describe('mergeKhmdhsBatchResults', () => {
  it('η επανάληψη ενημερώνει μόνο τα υποέργα που ξανατρέξαμε', () => {
    const retry = {
      refreshed: 1,
      needsIntervention: 0,
      failed: 0,
      skipped: 0,
      interventionItems: [],
      isRetry: true,
      items: [{ status: 'refreshed', id: 'd', label: 'Δ' }],
    };
    const merged = mergeKhmdhsBatchResults(previousRun, retry);

    expect(merged.items).toHaveLength(4);
    expect(merged.refreshed).toBe(3);
    expect(merged.failed).toBe(0);
    expect(merged.needsIntervention).toBe(1);
    expect(merged.interventionItems).toEqual([{ id: 'c', label: 'Γ' }]);
  });

  it('χωρίς προηγούμενη αναφορά κρατά τη νέα ως έχει', () => {
    const next = { items: [{ status: 'refreshed', id: 'a' }] };
    expect(mergeKhmdhsBatchResults(null, next)).toBe(next);
  });
});

describe('markBatchItemsResolved', () => {
  it('βγάζει το υποέργο από τις εκκρεμότητες χωρίς να χαθεί από την αναφορά', () => {
    const updated = markBatchItemsResolved(previousRun, ['c']);
    expect(updated.items).toHaveLength(4);
    expect(updated.needsIntervention).toBe(0);
    expect(updated.interventionItems).toEqual([]);
    expect(updated.items.find((i) => i.id === 'c').status).toBe('resolved');
  });
});

describe('batchRunHasOutcome', () => {
  it('η άδεια ή ακυρωμένη εκτέλεση δεν θεωρείται αποτέλεσμα', () => {
    expect(batchRunHasOutcome(null)).toBe(false);
    expect(batchRunHasOutcome({
      refreshed: 0, needsIntervention: 0, failed: 0, skipped: 3, items: [],
    })).toBe(false);
  });

  it('μετρά τα υποέργα που ήταν σε χρήση από άλλον χρήστη', () => {
    expect(batchRunHasOutcome({
      refreshed: 0,
      needsIntervention: 0,
      failed: 0,
      skipped: 2,
      items: [
        { status: 'skipped', id: 'a', reason: 'Πρόσφατα ανανεωμένο' },
        { status: 'skipped', id: 'b', busy: true, reason: 'Το επεξεργάζεται ο/η maria' },
      ],
    })).toBe(true);
  });

  it('μετρά τα υποέργα που δεν προλάβαμε μετά από ακύρωση', () => {
    expect(batchRunHasOutcome({
      refreshed: 0,
      needsIntervention: 0,
      failed: 0,
      skipped: 1,
      items: [{ status: 'skipped', id: 'a', notProcessed: true, reason: 'Δεν προλάβαμε' }],
    })).toBe(true);
  });

  it('μετρά και τα υποέργα που ζητούν ενέργεια χωρίς άλλη αλλαγή', () => {
    expect(batchRunHasOutcome({
      refreshed: 0,
      needsIntervention: 0,
      failed: 0,
      items: [{ status: 'refreshed', id: 'a', actions: [{ id: 'data_review' }] }],
    })).toBe(true);
  });
});

describe('isKhmdhsCharacterizationPending', () => {
  const flagged = buildKhmdhsRefreshFindings({
    outcome: KHMDHS_FINDING_OUTCOME.INTERVENED,
    actions: [buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.CHARACTERIZE_SYMV)],
  });

  it('παραμένει εκκρεμές όσο δεν έχει οριστεί κατανομή SYMV', () => {
    expect(isKhmdhsCharacterizationPending({ khmdhsLastRefreshFindings: flagged })).toBe(true);
  });

  it('κλείνει όταν οριστεί κατανομή SYMV', () => {
    expect(isKhmdhsCharacterizationPending({
      khmdhsSymvChainPlan: { items: [{ adam: '24SYMV000000001' }] },
      khmdhsLastRefreshFindings: flagged,
    })).toBe(false);
  });

  it('κλείνει όταν ο χρήστης δηλώσει ρητά ότι το είδε', () => {
    expect(isKhmdhsCharacterizationPending({
      khmdhsLastRefreshFindings: { ...flagged, acknowledgedAt: new Date().toISOString() },
    })).toBe(false);
  });

  it('υποέργο που δεν υπάρχει πια δεν κρατά εκκρεμότητα', () => {
    expect(isKhmdhsCharacterizationPending(null)).toBe(false);
  });
});

/**
 * @jest-environment node
 */
import {
  batchRunHasOutcome,
  isKhmdhsCharacterizationPending,
  isKhmdhsCharacterizationResolved,
  markBatchItemsResolved,
  mergeKhmdhsBatchResults,
  nextKhmdhsRetryDelayMs,
  pickKhmdhsBatchRetryCandidates,
  syncBatchReportWithProjects,
} from './khmdhsBatchReportState';
import {
  acknowledgeKhmdhsRefreshFindings,
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

  it('η επανάληψη με όλα τα υποέργα της συνεδρίας δεν χάνει επιτυχίες προηγούμενης στροφής', () => {
    const afterRound1 = mergeKhmdhsBatchResults(previousRun, {
      isRetry: true,
      items: [{ status: 'refreshed', id: 'd', label: 'Δ' }],
    });
    const afterRound2 = mergeKhmdhsBatchResults(previousRun, {
      isRetry: true,
      items: [
        { status: 'refreshed', id: 'd', label: 'Δ' },
        { status: 'failed', id: 'e', label: 'Ε' },
      ],
    });
    expect(afterRound1.failed).toBe(0);
    expect(afterRound2.items.find((i) => i.id === 'd').status).toBe('refreshed');
    expect(afterRound2.failed).toBe(1);
  });
});

describe('pickKhmdhsBatchRetryCandidates', () => {
  it('παίρνει αποτυχίες, πιασμένα και όσα δεν προλάβαμε — όχι τα επιτυχημένα', () => {
    const items = [
      { status: 'failed', id: 'a', label: 'Α' },
      { status: 'refreshed', id: 'b', label: 'Β' },
      { status: 'skipped', id: 'c', label: 'Γ', busy: true },
      { status: 'skipped', id: 'd', label: 'Δ', notProcessed: true },
      { status: 'skipped', id: 'e', label: 'Ε', reason: 'Εκτός ελέγχου' },
      { status: 'failed', label: 'χωρίς id' },
    ];
    expect(pickKhmdhsBatchRetryCandidates(items)).toEqual([
      { id: 'a', label: 'Α' },
      { id: 'c', label: 'Γ' },
      { id: 'd', label: 'Δ' },
    ]);
  });
});

describe('nextKhmdhsRetryDelayMs', () => {
  it('αυξάνει την παύση και την κόβει στα 30″', () => {
    expect(nextKhmdhsRetryDelayMs(1)).toBe(8000);
    expect(nextKhmdhsRetryDelayMs(2)).toBe(16000);
    expect(nextKhmdhsRetryDelayMs(4)).toBe(30000);
    expect(nextKhmdhsRetryDelayMs(0)).toBe(8000);
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

  it('χωρίς εύρημα CHARACTERIZE_SYMV δεν θεωρείται εκκρεμότητα', () => {
    expect(isKhmdhsCharacterizationPending({
      khmdhsLastRefreshFindings: buildKhmdhsRefreshFindings({
        outcome: KHMDHS_FINDING_OUTCOME.APPLIED,
        actions: [buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.DATA_REVIEW)],
      }),
    })).toBe(false);
    expect(isKhmdhsCharacterizationPending({ projectTitle: 'Χ' })).toBe(false);
  });

  it('υποέργο που δεν υπάρχει πια δεν κρατά εκκρεμότητα', () => {
    expect(isKhmdhsCharacterizationPending(null)).toBe(false);
  });
});

describe('isKhmdhsCharacterizationResolved', () => {
  const flagged = buildKhmdhsRefreshFindings({
    outcome: KHMDHS_FINDING_OUTCOME.INTERVENED,
    actions: [buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.CHARACTERIZE_SYMV)],
  });

  it('θεωρεί επιλυμένο μόνο με κατανομή ή ρητό κλείσιμο', () => {
    expect(isKhmdhsCharacterizationResolved({
      khmdhsSymvChainPlan: { items: [{ adam: '24SYMV000000001' }] },
    })).toBe(true);
    expect(isKhmdhsCharacterizationResolved({
      khmdhsLastRefreshFindings: acknowledgeKhmdhsRefreshFindings(flagged, { by: 'kostas' }),
    })).toBe(true);
  });

  it('η απουσία ευρήματος δεν μετρά ως επίλυση', () => {
    expect(isKhmdhsCharacterizationResolved({ subprojectId: 'sp' })).toBe(false);
    expect(isKhmdhsCharacterizationResolved({
      khmdhsLastRefreshFindings: buildKhmdhsRefreshFindings({
        outcome: KHMDHS_FINDING_OUTCOME.ATTENTION,
        attentionLines: ['Άλλο σημείο'],
      }),
    })).toBe(false);
  });
});

describe('syncBatchReportWithProjects', () => {
  const dataReviewAction = buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.DATA_REVIEW);

  it('καθαρίζει follow-up όταν λύθηκε ο έλεγχος στοιχείων', () => {
    const results = {
      refreshed: 1,
      needsIntervention: 0,
      failed: 0,
      skipped: 0,
      interventionItems: [],
      items: [{
        status: 'refreshed',
        id: 'sp1',
        label: 'Υποέργο Α',
        category: 'attention',
        actions: [dataReviewAction],
      }],
    };
    const project = {
      subprojectId: 'sp1',
      // Αναφορά ελέγχου υπάρχει και δεν έχει ανοιχτά — θετική επίλυση.
      khmdhsDataQualityReview: {
        hasActionRequired: false,
        items: [{
          fieldId: 'contractAmount',
          status: 'complete',
          label: 'Ποσό σύμβασης',
          manualFieldKey: 'contractAmount',
        }],
        resolutions: {},
      },
      // Το DATA_REVIEW αφαιρέθηκε μετά την αποθήκευση (reconcile).
      khmdhsLastRefreshFindings: buildKhmdhsRefreshFindings({
        outcome: KHMDHS_FINDING_OUTCOME.APPLIED,
        appliedLines: ['Ενημερώθηκε ποσό σύμβασης'],
      }),
    };

    const { results: synced, cleared } = syncBatchReportWithProjects(results, [project]);
    expect(cleared).toEqual([{ id: 'sp1', label: 'Υποέργο Α', kind: 'followup' }]);
    expect(synced.items[0].followUpClearedAt).toBeTruthy();
    expect(synced.items[0].actions).toEqual([]);
  });

  it('κρατά follow-up όσο εκκρεμεί ο έλεγχος στοιχείων', () => {
    const results = {
      refreshed: 1,
      needsIntervention: 0,
      failed: 0,
      skipped: 0,
      interventionItems: [],
      items: [{
        status: 'refreshed',
        id: 'sp1',
        label: 'Υποέργο Α',
        category: 'attention',
        actions: [dataReviewAction],
      }],
    };
    const project = {
      subprojectId: 'sp1',
      khmdhsDataQualityReview: {
        hasActionRequired: true,
        items: [{
          fieldId: 'contractAmount',
          status: 'missing',
          label: 'Ποσό σύμβασης',
          manualFieldKey: 'contractAmount',
        }],
        resolutions: {},
      },
    };

    const { results: synced, cleared } = syncBatchReportWithProjects(results, [project]);
    expect(cleared).toEqual([]);
    expect(synced).toBe(results);
    expect(results.items[0].followUpClearedAt).toBeUndefined();
  });

  it('δεν καθαρίζει follow-up όταν η λίστα υποέργου δεν έχει ακόμη ευρήματα', () => {
    const results = {
      refreshed: 1,
      needsIntervention: 0,
      failed: 0,
      skipped: 0,
      interventionItems: [],
      items: [{
        status: 'refreshed',
        id: 'sp1',
        label: 'Υποέργο Α',
        category: 'attention',
        actions: [dataReviewAction],
      }],
    };
    // Παλιά κάρτα στη μνήμη — χωρίς review/ευρήματα μετά τη μαζική ανανέωση.
    const project = { subprojectId: 'sp1', projectTitle: 'Χ' };

    const { results: synced, cleared } = syncBatchReportWithProjects(results, [project]);
    expect(cleared).toEqual([]);
    expect(synced).toBe(results);
  });

  it('σημειώνει intervened ως resolved όταν ορίστηκε κατανομή SYMV', () => {
    const flagged = buildKhmdhsRefreshFindings({
      outcome: KHMDHS_FINDING_OUTCOME.INTERVENED,
      actions: [buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.CHARACTERIZE_SYMV)],
    });
    const results = {
      refreshed: 0,
      needsIntervention: 1,
      failed: 0,
      skipped: 0,
      interventionItems: [{ id: 'sp2', label: 'Υποέργο Β' }],
      items: [{ status: 'intervened', id: 'sp2', label: 'Υποέργο Β' }],
    };
    const project = {
      subprojectId: 'sp2',
      khmdhsSymvChainPlan: { items: [{ adam: '24SYMV000000001' }] },
      khmdhsLastRefreshFindings: flagged,
    };

    const { results: synced, cleared } = syncBatchReportWithProjects(results, [project]);
    expect(cleared).toEqual([{ id: 'sp2', label: 'Υποέργο Β', kind: 'characterize' }]);
    expect(synced.items[0].status).toBe('resolved');
    expect(synced.needsIntervention).toBe(0);
  });

  it('δεν κλείνει intervened όταν λείπουν ευρήματα από τη μνήμη', () => {
    const results = {
      refreshed: 0,
      needsIntervention: 1,
      failed: 0,
      skipped: 0,
      interventionItems: [{ id: 'sp2', label: 'Υποέργο Β' }],
      items: [{ status: 'intervened', id: 'sp2', label: 'Υποέργο Β' }],
    };
    const { results: synced, cleared } = syncBatchReportWithProjects(results, [
      { subprojectId: 'sp2', projectTitle: 'Παλιά κάρτα' },
    ]);
    expect(cleared).toEqual([]);
    expect(synced).toBe(results);
    expect(synced.items[0].status).toBe('intervened');
  });

  it('δεν αλλάζει γραμμές που το υποέργο λείπει από τη λίστα', () => {
    const results = {
      refreshed: 1,
      needsIntervention: 0,
      failed: 0,
      skipped: 0,
      interventionItems: [],
      items: [{
        status: 'refreshed',
        id: 'missing',
        label: 'Χ',
        category: 'attention',
        actions: [dataReviewAction],
      }],
    };
    const { results: synced, cleared } = syncBatchReportWithProjects(results, []);
    expect(cleared).toEqual([]);
    expect(synced).toBe(results);
  });
});

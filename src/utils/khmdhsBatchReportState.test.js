/**
 * @jest-environment node
 */
import {
  applyKhmdhsLiveSnapshotToResults,
  batchRunHasOutcome,
  describeKhmdhsBatchCardMeta,
  isKhmdhsCharacterizationPending,
  isKhmdhsCharacterizationResolved,
  itemNeedsBatchFollowUp,
  markBatchItemsResolved,
  mergeKhmdhsBatchResults,
  nextKhmdhsRetryDelayMs,
  partitionKhmdhsBatchReportItems,
  pickKhmdhsBatchIncompleteRetryCandidates,
  pickKhmdhsBatchRetryCandidates,
  isKhmdhsBatchActionStillPending,
  buildKhmdhsLiveRunSnapshot,
  formatKhmdhsLiveDockLine,
  formatKhmdhsLiveHeadline,
  summarizeKhmdhsSkippedReasons,
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

describe('pickKhmdhsBatchIncompleteRetryCandidates', () => {
  it('παίρνει μόνο ανεπιβεβαίωση χωρίς ενέργεια ανθρώπου', () => {
    const items = [
      {
        status: 'refreshed',
        id: 'inc',
        label: 'Ανεπιβεβαίωτο',
        incompleteLines: ['Το ΚΗΜΔΗΣ αυτή τη φορά δεν επιβεβαίωσε το ένταλμα πληρωμής 26PAY1 που ήδη υπάρχει στην κάρτα.'],
      },
      {
        status: 'refreshed',
        id: 'act',
        label: 'Ενέργεια',
        incompleteLines: ['Το ΚΗΜΔΗΣ αυτή τη φορά δεν επιβεβαίωσε το ένταλμα πληρωμής 26PAY1 που ήδη υπάρχει στην κάρτα.'],
        actions: [buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.APE_CONFLICT)],
      },
      { status: 'failed', id: 'fail', label: 'Αποτυχία' },
    ];
    expect(pickKhmdhsBatchIncompleteRetryCandidates(items)).toEqual([
      { id: 'inc', label: 'Ανεπιβεβαίωτο' },
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

describe('partitionKhmdhsBatchReportItems', () => {
  it('βάζει το παλιό «3 → 2» στην ανεπιβεβαίωση και όχι στα «χρειάζονται ενέργεια»', () => {
    const { followUpItems, incompleteItems, refreshedOnly } = partitionKhmdhsBatchReportItems([
      {
        status: 'refreshed',
        id: 'sp1',
        label: 'Υποέργο Α',
        category: 'applied',
        appliedLines: ['Αποφάσεις ανάληψης υποχρέωσης: από 3 → 2'],
      },
    ], []);
    expect(followUpItems).toHaveLength(0);
    expect(itemNeedsBatchFollowUp({
      status: 'refreshed',
      category: 'applied',
      appliedLines: ['Αποφάσεις ανάληψης υποχρέωσης: από 3 → 2'],
    })).toBe(false);
    expect(incompleteItems).toHaveLength(1);
    expect(refreshedOnly).toHaveLength(0);
  });

  it('κρατά πραγματική ενέργεια στο follow-up', () => {
    const { followUpItems, incompleteItems } = partitionKhmdhsBatchReportItems([
      {
        status: 'refreshed',
        id: 'sp1',
        label: 'Υποέργο Α',
        category: 'attention',
        attentionLines: ['⚠️ ΑΠΕ: διαφορά ποσού'],
        actions: [buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.APE_CONFLICT)],
      },
    ], []);
    expect(followUpItems).toHaveLength(1);
    expect(incompleteItems).toHaveLength(0);
  });

  it('υποέργο με νέο κρίκο και ανεπιβεβαίωση φαίνεται και στις δύο λίστες', () => {
    const { followUpItems, incompleteItems, refreshedOnly } = partitionKhmdhsBatchReportItems([
      {
        status: 'refreshed',
        id: 'sp1',
        label: 'Υποέργο Α',
        category: 'applied',
        appliedLines: ['Νέο ένταλμα πληρωμής: 26PAY000000099 — 1.000,00 €'],
        incompleteLines: [
          'Το ΚΗΜΔΗΣ αυτή τη φορά δεν επιβεβαίωσε το ένταλμα πληρωμής 26PAY000000001 που ήδη υπάρχει στην κάρτα. '
          + 'Δεν διαγράφηκε τίποτα — παραμένει όπως ήταν.',
        ],
      },
    ], []);
    expect(followUpItems).toHaveLength(0);
    expect(incompleteItems.map((i) => i.id)).toEqual(['sp1']);
    expect(refreshedOnly.map((i) => i.id)).toEqual(['sp1']);
    expect(describeKhmdhsBatchCardMeta(incompleteItems[0], 'incomplete')).toMatch(/Μπήκαν νέα στοιχεία/i);
    expect(describeKhmdhsBatchCardMeta(incompleteItems[0], 'incomplete')).not.toMatch(/έμεινε όπως ήταν/i);
  });

  it('«μόνο πρωτογενές αίτημα» πάει στην ανεπιβεβαίωση, όχι στην ενέργεια', () => {
    const { followUpItems, incompleteItems } = partitionKhmdhsBatchReportItems([
      {
        status: 'refreshed',
        id: 'sp1',
        label: 'Υποέργο Α',
        category: 'attention',
        attentionLines: [
          '⚠️ Δεν βρέθηκε πλήρης ηλεκτρονική αλυσίδα ΑΔΑΜ — ανακτήθηκε μόνο το πρωτογενές αίτημα.',
        ],
      },
    ], []);
    expect(followUpItems).toHaveLength(0);
    expect(incompleteItems).toHaveLength(1);
    expect(describeKhmdhsBatchCardMeta(incompleteItems[0], 'incomplete')).toMatch(/έμεινε όπως ήταν/i);
  });

  it('διαφορετική δημοσίευση που διατηρήθηκε δεν μετρά ως ενέργεια', () => {
    const { followUpItems, incompleteItems } = partitionKhmdhsBatchReportItems([
      {
        status: 'refreshed',
        id: 'sp1',
        label: 'Υποέργο Α',
        category: 'attention',
        attentionLines: [
          '⚠️ Το ΚΗΜΔΗΣ έδειξε διαφορετική δημοσίευση από την ήδη καταγεγραμμένη — διατηρήθηκε η κύρια «Δημοσίευση» στην αλυσίδα.',
        ],
      },
    ], []);
    expect(followUpItems).toHaveLength(0);
    expect(incompleteItems).toHaveLength(1);
  });
});

describe('summarizeKhmdhsSkippedReasons', () => {
  it('χωρίζει χωρίς ΑΔΑΜ, ολοκληρωμένα και πρόσφατα', () => {
    const summary = summarizeKhmdhsSkippedReasons([
      { reason: 'Χωρίς ΑΔΑΜ' },
      { reason: 'Χωρίς ΑΔΑΜ' },
      { reason: 'Ολοκληρωμένο' },
      { reason: 'Πρόσφατα ανανεωμένο (3 ημ.) — εκτός επιλογής' },
      { reason: 'Κλειδωμένο' },
    ]);
    expect(summary.noAdam).toBe(2);
    expect(summary.completed).toBe(1);
    expect(summary.fresh).toBe(1);
    expect(summary.locked).toBe(1);
    expect(summary.parts.join(' · ')).toMatch(/2 χωρίς ΑΔΑΜ/);
  });
});

describe('buildKhmdhsLiveRunSnapshot', () => {
  it('μετρά πρόοδο και εκκρεμότητες από τα ευρήματα ως τώρα', () => {
    const snap = buildKhmdhsLiveRunSnapshot({
      running: true,
      phase: 'run',
      current: 2,
      total: 8,
      itemLabel: 'Οδός Α',
      stepMessage: 'Ανάκτηση αλυσίδας…',
      items: [
        { status: 'refreshed', id: 'a', label: 'Α', category: 'applied' },
        { status: 'intervened', id: 'b', label: 'Β' },
      ],
    });
    expect(snap.pct).toBe(25);
    expect(snap.refreshed).toBe(1);
    expect(snap.needsIntervention).toBe(1);
    expect(snap.interventionItems).toEqual([{ id: 'b', label: 'Β' }]);
    expect(formatKhmdhsLiveHeadline(snap)).toMatch(/2 από 8/);
    expect(formatKhmdhsLiveHeadline(snap)).toMatch(/Οδός Α/);
    expect(formatKhmdhsLiveHeadline(snap)).toMatch(/Ανάκτηση αλυσίδας/);
    expect(formatKhmdhsLiveDockLine(snap, { running: true })).toBe('2 / 8 · Οδός Α');
    expect(formatKhmdhsLiveDockLine(snap, { running: false })).toMatch(/Ολοκληρώθηκε/);
  });
});

describe('applyKhmdhsLiveSnapshotToResults', () => {
  it('η σάρωση δεν σβήνει την προηγούμενη αναφορά', () => {
    const snap = buildKhmdhsLiveRunSnapshot({
      running: true,
      phase: 'scan',
      reset: true,
      items: [],
    });
    expect(applyKhmdhsLiveSnapshotToResults(previousRun, snap)).toBe(previousRun);
  });

  it('κενό τέλος χωρίς ουρά κρατά την προηγούμενη αναφορά', () => {
    const snap = buildKhmdhsLiveRunSnapshot({
      running: false,
      phase: 'finishing',
      current: 0,
      total: 0,
      items: [],
    });
    expect(applyKhmdhsLiveSnapshotToResults(previousRun, snap)).toBe(previousRun);
  });

  it('νέα εκτέλεση με ουρά ξεκινά φρέσκια αναφορά', () => {
    const snap = buildKhmdhsLiveRunSnapshot({
      running: true,
      phase: 'run',
      reset: true,
      current: 0,
      total: 4,
      items: [{ status: 'skipped', id: 'x', label: 'Χ', reason: 'Εκτός' }],
    });
    const next = applyKhmdhsLiveSnapshotToResults(previousRun, snap);
    expect(next).not.toBe(previousRun);
    expect(next.items).toHaveLength(1);
    expect(next.items[0].id).toBe('x');
    expect(next.skipped).toBe(1);
  });

  it('η επανάληψη με κενά στοιχεία δεν μηδενίζει την αναφορά', () => {
    const snap = buildKhmdhsLiveRunSnapshot({
      running: true,
      phase: 'run',
      isRetry: true,
      current: 0,
      total: 2,
      items: [],
    });
    expect(applyKhmdhsLiveSnapshotToResults(previousRun, snap)).toBe(previousRun);
  });

  it('η επανάληψη συγχωνεύει μόνο τα υποέργα που ξαναέτρεξαν', () => {
    const snap = buildKhmdhsLiveRunSnapshot({
      running: true,
      phase: 'run',
      isRetry: true,
      current: 1,
      total: 1,
      items: [{ status: 'refreshed', id: 'd', label: 'Δ' }],
    });
    const next = applyKhmdhsLiveSnapshotToResults(previousRun, snap);
    expect(next.items).toHaveLength(4);
    expect(next.items.find((i) => i.id === 'd').status).toBe('refreshed');
    expect(next.failed).toBe(0);
  });
});

describe('isKhmdhsBatchActionStillPending APE', () => {
  it('κλείνει όταν αφαιρεθεί η ενέργεια ή δηλωθεί ότι την είδε', () => {
    const flagged = buildKhmdhsRefreshFindings({
      outcome: KHMDHS_FINDING_OUTCOME.ATTENTION,
      actions: [buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.APE_CONFLICT)],
    });
    expect(isKhmdhsBatchActionStillPending({
      khmdhsLastRefreshFindings: flagged,
    }, KHMDHS_FINDING_ACTION.APE_CONFLICT)).toBe(true);
    expect(isKhmdhsBatchActionStillPending({
      khmdhsLastRefreshFindings: acknowledgeKhmdhsRefreshFindings(flagged, { by: 'kostas' }),
    }, KHMDHS_FINDING_ACTION.APE_CONFLICT)).toBe(false);
    expect(isKhmdhsBatchActionStillPending({
      khmdhsLastRefreshFindings: { ...flagged, actions: [] },
    }, KHMDHS_FINDING_ACTION.APE_CONFLICT)).toBe(false);
  });
});

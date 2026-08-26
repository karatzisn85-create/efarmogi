/**
 * @jest-environment node
 */
import {
  acknowledgeKhmdhsRefreshFindings,
  buildKhmdhsFindingAction,
  buildKhmdhsRefreshFindings,
  clarifyKhmdhsIncompleteLine,
  countKhmdhsFindingAttentionItems,
  getKhmdhsSubprojectAttention,
  khmdhsFindingsNeedAttention,
  reconcileKhmdhsFindingsWithProjectState,
  splitRefreshReportLineBuckets,
  KHMDHS_FINDING_ACTION,
  KHMDHS_FINDING_OUTCOME,
} from './khmdhsRefreshFindings';

describe('buildKhmdhsRefreshFindings', () => {
  it('δεν κρατά εγγραφή όταν δεν υπάρχει κανένα εύρημα', () => {
    expect(buildKhmdhsRefreshFindings({
      outcome: KHMDHS_FINDING_OUTCOME.UNCHANGED,
    })).toBeNull();
  });

  it('κρατά τις αλλαγές ακόμη κι όταν δεν χρειάζεται ενέργεια', () => {
    const findings = buildKhmdhsRefreshFindings({
      outcome: KHMDHS_FINDING_OUTCOME.APPLIED,
      appliedLines: ['Νέο ένταλμα: 24PAY000000001'],
    });
    expect(findings.appliedLines).toHaveLength(1);
    expect(khmdhsFindingsNeedAttention(findings)).toBe(false);
  });

  it('ζητά ενέργεια όταν υπάρχουν σημεία προσοχής ή ενέργειες', () => {
    const withAttention = buildKhmdhsRefreshFindings({
      outcome: KHMDHS_FINDING_OUTCOME.ATTENTION,
      attentionLines: ['⚠️ ΑΠΕ: η καταχωρημένη τιμή παραμένει «50.000», ενώ το ΚΗΜΔΗΣ δείχνει «52.000».'],
    });
    expect(khmdhsFindingsNeedAttention(withAttention)).toBe(true);
    expect(countKhmdhsFindingAttentionItems(withAttention)).toBe(1);

    const withAction = buildKhmdhsRefreshFindings({
      outcome: KHMDHS_FINDING_OUTCOME.INTERVENED,
      actions: [buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.CHARACTERIZE_SYMV)],
    });
    expect(khmdhsFindingsNeedAttention(withAction)).toBe(true);
  });

  it('ℹ️ διατηρημένη χειροκίνητη τιμή δεν ξανανοίγει badge σε κάθε ανανέωση', () => {
    const findings = buildKhmdhsRefreshFindings({
      outcome: KHMDHS_FINDING_OUTCOME.ATTENTION,
      attentionLines: [
        'ℹ️ Διατηρήθηκε η χειροκίνητη τιμή στο πεδίο «Ποσό σύμβασης (με ΦΠΑ)»: '
        + 'παρέμεινε «18.561,31» αντί για «18.561,30» που έδειξε το ΚΗΜΔΗΣ. '
        + 'Δεν απαιτείται ενέργεια — η εφαρμογή σεβάστηκε την προηγούμενη διόρθωσή σας.',
      ],
    });
    expect(findings).toBeTruthy();
    expect(findings.acknowledgedAt).toBeTruthy();
    expect(findings.outcome).toBe(KHMDHS_FINDING_OUTCOME.UNCHANGED);
    expect(khmdhsFindingsNeedAttention(findings)).toBe(false);
  });

  it('παύει να ζητά ενέργεια μετά το «Τα είδα»', () => {
    const findings = buildKhmdhsRefreshFindings({
      outcome: KHMDHS_FINDING_OUTCOME.FAILED,
      error: 'Η ανάκτηση απέτυχε',
    });
    const acknowledged = acknowledgeKhmdhsRefreshFindings(findings, { by: 'kostas' });
    expect(khmdhsFindingsNeedAttention(acknowledged)).toBe(false);
    expect(acknowledged.acknowledgedBy).toBe('kostas');
    expect(acknowledged.error).toBe('Η ανάκτηση απέτυχε');
  });
});

describe('getKhmdhsSubprojectAttention', () => {
  const unresolvedReview = {
    hasActionRequired: true,
    items: [{ fieldId: 'contractAmount', status: 'missing', label: 'Ποσό σύμβασης' }],
    resolutions: {},
  };

  it('επιστρέφει μηδενική εικόνα χωρίς εκκρεμότητες', () => {
    expect(getKhmdhsSubprojectAttention({}).level).toBe('none');
    expect(getKhmdhsSubprojectAttention(null).total).toBe(0);
  });

  it('αθροίζει έλεγχο στοιχείων και ευρήματα ανανέωσης', () => {
    const project = {
      khmdhsDataQualityReview: unresolvedReview,
      khmdhsLastRefreshFindings: buildKhmdhsRefreshFindings({
        outcome: KHMDHS_FINDING_OUTCOME.INTERVENED,
        actions: [buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.CHARACTERIZE_SYMV)],
      }),
    };
    const attention = getKhmdhsSubprojectAttention(project);
    expect(attention.reviewCount).toBe(1);
    expect(attention.findingCount).toBe(1);
    expect(attention.total).toBe(2);
    expect(attention.level).toBe('blocking');
    expect(attention.reasons.length).toBeGreaterThan(0);
  });

  it('τα σημεία προσοχής χωρίς ενέργειες δεν είναι blocking', () => {
    const project = {
      khmdhsLastRefreshFindings: buildKhmdhsRefreshFindings({
        outcome: KHMDHS_FINDING_OUTCOME.ATTENTION,
        attentionLines: ['⚠️ ΑΠΕ: η καταχωρημένη τιμή παραμένει «50.000», ενώ το ΚΗΜΔΗΣ δείχνει «52.000».'],
      }),
    };
    expect(getKhmdhsSubprojectAttention(project).level).toBe('attention');
  });

  it('η ανεπιβεβαίωση ΚΗΜΔΗΣ δεν ανοίγει badge ενέργειας', () => {
    const project = {
      khmdhsLastRefreshFindings: buildKhmdhsRefreshFindings({
        incompleteLines: [
          'Το ΚΗΜΔΗΣ αυτή τη φορά δεν επιβεβαίωσε την απόφαση ανάληψης 25REQ016195999 που ήδη υπάρχει στην κάρτα. '
          + 'Δεν διαγράφηκε τίποτα — παραμένει όπως ήταν.',
        ],
      }),
    };
    expect(khmdhsFindingsNeedAttention(project.khmdhsLastRefreshFindings)).toBe(false);
    expect(getKhmdhsSubprojectAttention(project).level).toBe('none');
    expect(project.khmdhsLastRefreshFindings.outcome).toBe(KHMDHS_FINDING_OUTCOME.INCOMPLETE);
  });
});

describe('reconcileKhmdhsFindingsWithProjectState', () => {
  it('αφαιρεί DATA_REVIEW όταν δεν εκκρεμεί έλεγχος στοιχείων', () => {
    const findings = buildKhmdhsRefreshFindings({
      outcome: KHMDHS_FINDING_OUTCOME.ATTENTION,
      actions: [
        buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.DATA_REVIEW),
        buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.APE_CONFLICT),
      ],
    });
    const next = reconcileKhmdhsFindingsWithProjectState({
      khmdhsLastRefreshFindings: findings,
      khmdhsDataQualityReview: { hasActionRequired: false, items: [], resolutions: {} },
    });
    expect(next.actions.map((a) => a.id)).toEqual([KHMDHS_FINDING_ACTION.APE_CONFLICT]);
    expect(next.acknowledgedAt).toBeFalsy();
  });

  it('κλείνει πλήρως τα ευρήματα όταν δεν μένει τίποτα ανοιχτό', () => {
    const findings = buildKhmdhsRefreshFindings({
      outcome: KHMDHS_FINDING_OUTCOME.ATTENTION,
      actions: [buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.DATA_REVIEW)],
    });
    const next = reconcileKhmdhsFindingsWithProjectState({
      khmdhsLastRefreshFindings: findings,
      khmdhsDataQualityReview: { hasActionRequired: false, items: [], resolutions: {} },
    }, { by: 'kostas' });
    expect(next.actions).toEqual([]);
    expect(next.acknowledgedAt).toBeTruthy();
    expect(next.acknowledgedBy).toBe('kostas');
  });
});

describe('splitRefreshReportLineBuckets', () => {
  it('μετατρέπει παλιό «ανάληψη 3 → 2» σε κατανοητή ανεπιβεβαίωση', () => {
    const buckets = splitRefreshReportLineBuckets({
      category: 'applied',
      appliedLines: ['Αποφάσεις ανάληψης υποχρέωσης: από 3 → 2'],
    });
    expect(buckets.appliedLines).toEqual([]);
    expect(buckets.incompleteLines).toHaveLength(1);
    expect(buckets.incompleteLines[0]).toMatch(/δεν επιβεβαίωσε όλες τις αποφάσεις ανάληψης/i);
    expect(buckets.incompleteLines[0]).toMatch(/Δεν διαγράφηκε τίποτα/);
  });

  it('βγάζει από την προσοχή παλιές γραμμές «εμφανίζονται 2 από 3»', () => {
    const buckets = splitRefreshReportLineBuckets({
      category: 'attention',
      attentionLines: [
        '⚠️ Δεν επιβεβαιώθηκαν όλες οι αποφάσεις ανάληψης σε αυτή την ανάκτηση (εμφανίζονται 2 από 3). Οι υπάρχουσες διατηρούνται — δοκιμάστε ξανά όταν το ΚΗΜΔΗΣ ανταποκρίνεται κανονικά.',
      ],
    });
    expect(buckets.attentionLines).toEqual([]);
    expect(buckets.incompleteLines[0]).toMatch(/Δεν διαγράφηκε τίποτα/);
  });

  it('δεν μπερδεύει πραγματική αλλαγή ποσού με ανεπιβεβαίωση', () => {
    expect(clarifyKhmdhsIncompleteLine('Ποσό σύμβασης: 100.000,00 → 120.000,00 €'))
      .toBe('Ποσό σύμβασης: 100.000,00 → 120.000,00 €');
    const buckets = splitRefreshReportLineBuckets({
      appliedLines: ['Ποσό σύμβασης: 100.000,00 → 120.000,00 €'],
    });
    expect(buckets.appliedLines).toHaveLength(1);
    expect(buckets.incompleteLines).toHaveLength(0);
  });
});

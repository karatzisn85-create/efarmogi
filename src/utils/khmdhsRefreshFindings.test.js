/**
 * @jest-environment node
 */
import {
  acknowledgeKhmdhsRefreshFindings,
  buildKhmdhsFindingAction,
  buildKhmdhsRefreshFindings,
  countKhmdhsFindingAttentionItems,
  getKhmdhsSubprojectAttention,
  khmdhsFindingsNeedAttention,
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
      attentionLines: ['Διατηρήθηκε χειροκίνητο ποσό σύμβασης'],
    });
    expect(khmdhsFindingsNeedAttention(withAttention)).toBe(true);
    expect(countKhmdhsFindingAttentionItems(withAttention)).toBe(1);

    const withAction = buildKhmdhsRefreshFindings({
      outcome: KHMDHS_FINDING_OUTCOME.INTERVENED,
      actions: [buildKhmdhsFindingAction(KHMDHS_FINDING_ACTION.CHARACTERIZE_SYMV)],
    });
    expect(khmdhsFindingsNeedAttention(withAction)).toBe(true);
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
        attentionLines: ['Η σύμβαση δεν επιβεβαιώθηκε — διατηρήθηκε η προηγούμενη.'],
      }),
    };
    expect(getKhmdhsSubprojectAttention(project).level).toBe('attention');
  });
});

/**
 * @jest-environment node
 */
import {
  parseReportDateLabel,
  buildNumberedFileInventory,
  buildPaymentSummaryForReport,
  buildCompletenessGapsForReport,
  buildChronologicalChainTimeline,
  buildExecutiveSummaryForReport,
} from './subprojectReportEnrichment';

describe('parseReportDateLabel', () => {
  test('DD/MM/YYYY', () => {
    const t = parseReportDateLabel('15/03/2024');
    expect(t).toBe(new Date(2024, 2, 15).getTime());
  });

  test('ISO prefix', () => {
    const t = parseReportDateLabel('2024-06-01T10:00:00.000Z');
    expect(t).toBe(new Date(2024, 5, 1).getTime());
  });

  test('κενό ή —', () => {
    expect(parseReportDateLabel('')).toBeNull();
    expect(parseReportDateLabel('—')).toBeNull();
  });
});

describe('buildNumberedFileInventory', () => {
  test('αριθμεί αρχεία σε όλες τις κατηγορίες', () => {
    const out = buildNumberedFileInventory({
      groups: [
        { title: 'Σύμβαση', files: ['a.pdf', 'b.pdf'] },
        { title: 'Τεχνικά', files: ['c.pdf'] },
      ],
      ungrouped: ['d.pdf'],
      totalCount: 4,
    });
    expect(out.totalCount).toBe(4);
    expect(out.groups[0].categoryNumber).toBe(1);
    expect(out.groups[0].files[0]).toEqual({ index: 1, name: 'a.pdf' });
    expect(out.groups[1].files[0].index).toBe(3);
    expect(out.ungrouped[0]).toEqual({ index: 4, name: 'd.pdf' });
  });
});

describe('buildPaymentSummaryForReport', () => {
  test('υπολογίζει υπόλοιπο και ποσοστό', () => {
    const basic = { totalContractAmount: 100000, contractAmount: '100.000,00' };
    const khmdhsChain = { pay: { count: 2, countableTotalGross: 40000 } };
    const s = buildPaymentSummaryForReport(basic, khmdhsChain);
    expect(s.paidAmount).toBe(40000);
    expect(s.remainingAmount).toBe(60000);
    expect(s.percentPaid).toBeCloseTo(40);
    expect(s.paymentCount).toBe(2);
  });

  test('προτιμά το displayTotalGross όταν υπάρχει συγχρηματοδότηση/χαρακτηρισμός', () => {
    // countableTotalGross διπλομετράει συγχρηματοδοτούμενες πληρωμές (Δήμος + Περιφ. Ταμείο)
    // όταν ο χρήστης δεν έχει ακόμα χαρακτηρίσει τα έγγραφα· το displayTotalGross έχει ήδη
    // την έξυπνη εκτίμηση και πρέπει να είναι αυτό που εμφανίζεται στην αναφορά.
    const basic = { totalContractAmount: 50000, contractAmount: '50.000,00' };
    const khmdhsChain = {
      pay: {
        count: 2,
        totalGross: 100000,
        countableTotalGross: 100000,
        estimatedContractorPaymentGross: 50000,
        displayTotalGross: 50000,
      },
    };
    const s = buildPaymentSummaryForReport(basic, khmdhsChain);
    expect(s.paidAmount).toBe(50000);
    expect(s.remainingAmount).toBe(0);
    expect(s.percentPaid).toBeCloseTo(100);
  });
});

describe('buildCompletenessGapsForReport', () => {
  test('προειδοποιεί για έλλειψη ΑΠΕ και ενταλμάτων', () => {
    const gaps = buildCompletenessGapsForReport(
      {},
      { contractAmount: '50.000,00', khmdhsAdam: '24SYMV0123456789', isMultipleContracts: false },
      { pay: { count: 0 } },
      { totalCount: 1 },
      []
    );
    const texts = gaps.map((g) => g.text);
    expect(texts.some((t) => t.includes('ΑΠΕ'))).toBe(true);
    expect(texts.some((t) => t.includes('εντάλματα'))).toBe(true);
  });
});

describe('buildChronologicalChainTimeline', () => {
  test('ταξινομεί ανά ημερομηνία', () => {
    const timeline = buildChronologicalChainTimeline(
      {
        req: { title: 'Αίτημα', adam: 'R1', signedDate: '01/06/2024', amount: '10.000,00' },
        awrd: { title: 'Ανάθεση', adam: 'A1', awardDate: '15/07/2024', amount: '10.000,00' },
      },
      null,
      { khmdhsAdam: 'S1', contractDate: '2024-08-01', contractAmount: '10.000,00' }
    );
    expect(timeline.length).toBeGreaterThanOrEqual(3);
    expect(timeline[0].type).toBe('req');
    expect(timeline[timeline.length - 1].type).toBe('symv');
  });

  test('πρωτογενές πάντα πρώτο — ίδια ημερομηνία με ανάληψη', () => {
    const timeline = buildChronologicalChainTimeline(
      {
        req: {
          title: 'Πρωτογενές',
          adam: '22REQ011931227',
          signedDate: '30/12/2022',
          amount: '2.300.000,00',
        },
        commit: Array.from({ length: 6 }, (_, i) => ({
          title: `Ανάληψη ${i + 1}`,
          adam: `23REQ012149${i}`,
          signedDate: i === 5 ? '30/12/2022' : `0${i + 1}/01/2023`,
          amount: '2.300.000,00',
        })),
      },
      null,
      {}
    );
    expect(timeline[0].type).toBe('req');
    expect(timeline[0].adam).toBe('22REQ011931227');
    const sameDayCommit = timeline.find((t) => t.type === 'commit' && t.dateLabel === '30/12/2022');
    expect(sameDayCommit).toBeTruthy();
    expect(timeline.indexOf(sameDayCommit)).toBeGreaterThan(0);
  });

  test('πρωτογενές πάντα πρώτο — ακόμα κι αν η ανάληψη έχει νωρίτερα timestamp', () => {
    const timeline = buildChronologicalChainTimeline(
      {
        req: {
          title: 'Πρωτογενές',
          adam: '22REQ011931227',
          signedDate: '',
          fetchedAt: '31/12/2022 10:00',
          amount: '2.300.000,00',
        },
        commit: [
          {
            title: 'Ανάληψη',
            adam: '22REQ011932182',
            signedDate: '30/12/2022',
            amount: '2.300.000,00',
          },
        ],
      },
      null,
      {}
    );
    expect(timeline[0].type).toBe('req');
  });

  test('πολλαπλές συμβάσεις', () => {
    const timeline = buildChronologicalChainTimeline(
      {},
      null,
      {
        isMultipleContracts: true,
        contracts: [
          { khmdhsAdam: 'S1', date: '01/01/2024', amount: '1.000,00', apeAmount: '100,00' },
          { khmdhsAdam: 'S2', date: '01/06/2024', amount: '2.000,00' },
        ],
      }
    );
    const symv = timeline.filter((t) => t.type === 'symv');
    expect(symv.length).toBe(2);
    expect(timeline.some((t) => t.type === 'ape')).toBe(true);
  });

  test('παρατάσεις στην αλυσίδα — όχι ως συμπληρωματικές', () => {
    const timeline = buildChronologicalChainTimeline(
      {},
      null,
      {
        khmdhsAdam: '23SYMV013398101',
        contractDate: '2023-09-08',
        contractAmount: '1.526.007,62',
        supplementaryStageEntries: [
          {
            title: 'Παράταση 1',
            isExtension: true,
            adam: '25SYMV016832490',
            date: '30/09/2025',
            amount: '1.526.007,62',
            amountLabel: 'Αναφορικό ποσό',
          },
          {
            title: 'Παράταση 2',
            isExtension: true,
            adam: '25SYMV017759521',
            date: '30/03/2026',
            amount: '1.526.007,62',
            amountLabel: 'Αναφορικό ποσό',
          },
        ],
      }
    );
    const supp = timeline.filter((t) => t.type === 'supp');
    expect(supp).toHaveLength(2);
    expect(supp[0].stageName).toBe('Παράταση 1');
    expect(supp[1].stageName).toBe('Παράταση 2');
    expect(supp[0].adam).toBe('25SYMV016832490');
  });

  test('προκήρυξη: ημερομηνία εγγράφου, όχι ανάκτησης', () => {
    const timeline = buildChronologicalChainTimeline(
      {
        commit: [
          { title: 'Ανάληψη', adam: '23REQ012275524', signedDate: '10/03/2023', amount: '1.000,00' },
        ],
        awrd: { title: 'Ανάθεση', adam: '23AWRD013315691', awardDate: '16/06/2023', amount: '1.000,00' },
      },
      {
        adam: '23PROC012273104',
        title: 'ΤΕΥΧΗ ΔΗΜΟΠΡΑΤΗΣΗΣ',
        documentDateLabel: '10/03/2023',
        signedDateLabel: '10/03/2023',
        submissionDateLabel: '10/03/2023 13:44',
        fetchedAtLabel: '21/06/2026 22:42',
        deadlineLabel: '',
      },
      {}
    );
    const proc = timeline.find((t) => t.type === 'proc');
    expect(proc).toBeTruthy();
    expect(proc.dateLabel).toBe('10/03/2023');
    expect(proc.dateLabel).not.toContain('2026');
    const procIndex = timeline.findIndex((t) => t.type === 'proc');
    const awrdIndex = timeline.findIndex((t) => t.type === 'awrd');
    expect(procIndex).toBeLessThan(awrdIndex);
  });
});

describe('buildExecutiveSummaryForReport', () => {
  test('συγκεντρώνει βασικά πεδία σύνοψης', () => {
    const summary = buildExecutiveSummaryForReport({
      basic: {
        projectTitle: 'Πράξη',
        subprojectTitle: 'Υποέργο',
        projectStatus: 'Σε εκτέλεση',
        displayChargePrimary: 'Μηχανικός Α',
        approvedAmount: '100.000,00',
      },
      khmdhsChain: {},
      paymentSummary: { contractAmountLabel: '50.000,00 €', paidAmountLabel: '10.000,00 €', paymentCount: 1 },
      completenessGaps: [{ level: 'info', text: 'test' }],
      chronologicalTimeline: [{ type: 'req' }, { type: 'symv' }],
      files: { totalCount: 3 },
      entaxeis: [{}],
      proskliseis: [],
      egkrisiTotal: 0,
      epActions: [],
      meta: {},
    });
    expect(summary.subprojectTitle).toBe('Υποέργο');
    expect(summary.supervisor).toBe('Μηχανικός Α');
    expect(summary.counts.files).toBe(3);
    expect(summary.timelinePreview.length).toBe(2);
  });
});

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

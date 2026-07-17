/**
 * @jest-environment node
 */
import {
  buildKhmdhsRefreshChangeSummary,
  buildKhmdhsRefreshChangeReport,
  KHMDHS_REFRESH_REPORT_NO_CHANGES,
} from './khmdhsChainRefresh';

describe('buildKhmdhsRefreshChangeSummary', () => {
  test('αναφέρει όταν δεν εντοπίστηκαν ουσιώδεις διαφορές', () => {
    const before = { projectStatus: 'Σε εξέλιξη', contractAmount: '100.000,00' };
    const after = { ...before };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines).toEqual([KHMDHS_REFRESH_REPORT_NO_CHANGES]);
  });

  test('αναφέρει νέα εντάλματα πληρωμής με ΑΔΑΜ', () => {
    const before = { khmdhsPayments: [{ adam: 'PAY1' }] };
    const after = { khmdhsPayments: [{ adam: 'PAY1' }, { adam: 'PAY2' }] };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines.some((l) => l.includes('Νέο ένταλμα πληρωμής') && l.includes('PAY2'))).toBe(true);
  });

  test('αναφέρει νέες καταχωρίσεις στο ιστορικό αλυσίδας με ΑΔΑΜ', () => {
    const before = { khmdhsContractChainHistory: [{ adam: 'SYMV1' }] };
    const after = {
      khmdhsContractChainHistory: [
        { adam: 'SYMV1' },
        { adam: '26SYMV999', title: 'Παράταση σύμβασης', type: 'παράταση' },
      ],
    };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines.some((l) => l.includes('Νέα καταχώριση στην αλυσίδα') && l.includes('26SYMV999'))).toBe(true);
  });

  test('αναφέρει ημ. λήξης ως παλιά → νέα', () => {
    const before = { contractEndDate: '2025-01-01' };
    const after = { contractEndDate: '2025-06-30' };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines.some((l) => l.includes('01/01/2025') && l.includes('30/06/2025'))).toBe(true);
  });

  test('αναφέρει ποσό σύμβασης ως παλιά → νέα', () => {
    const before = { contractAmount: '100.000,00' };
    const after = { contractAmount: '120.000,00' };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines.some((l) => l.includes('100.000,00') && l.includes('120.000,00'))).toBe(true);
  });

  test('αναφέρει νέα έγγραφα μητρώου με ΑΔΑΜ', () => {
    const before = { khmdhsDocumentRegistry: [{ adam: '22PROC010072052' }] };
    const after = {
      khmdhsDocumentRegistry: [
        { adam: '22PROC010072052' },
        { adam: '22PROC010072999', title: 'Νέα δημοσίευση' },
      ],
    };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines.some((l) => l.includes('22PROC010072999') && l.includes('Νέα δημοσίευση'))).toBe(true);
  });

  test('δεν αναφέρει τίποτα για το μητρώο εγγράφων όταν δεν προστέθηκε τίποτα νέο', () => {
    const before = { khmdhsDocumentRegistry: [{ adam: '22PROC010072052' }] };
    const after = { khmdhsDocumentRegistry: [{ adam: '22PROC010072052', title: 'Ενημερωμένος τίτλος' }] };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines.some((l) => l.includes('Αρχεία Υποέργου'))).toBe(false);
  });

  test('αναφέρει τη διαδικασία ανάθεσης όταν βρεθεί για πρώτη φορά', () => {
    const before = { assignmentProcedure: '' };
    const after = { assignmentProcedure: 'Ανοικτός διαγωνισμός' };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines.some((l) => l.includes('Διαδικασία ανάθεσης') && l.includes('Ανοικτός διαγωνισμός'))).toBe(true);
  });

  test('προειδοποιεί για σύγκρουση ΑΠΕ αντί να το αγνοεί σιωπηλά', () => {
    const before = {};
    const after = {};
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {
      apeConflict: { current: '50.000,00', suggested: '52.000,00' },
    });
    expect(lines.some((l) => l.startsWith('⚠️') && l.includes('ΑΠΕ'))).toBe(true);
  });

  test('αναφέρει συγκεκριμένα πεδία χειροκίνητης διατήρησης', () => {
    const lines = buildKhmdhsRefreshChangeSummary({}, {}, {
      protectedCount: 1,
      protectedFields: [{
        fieldKey: 'contractAmount',
        label: 'Ποσό σύμβασης',
        keptValue: '80.000,00',
        khmdhsValue: '90.000,00',
      }],
    });
    expect(lines.some((l) => (
      l.includes('Ποσό σύμβασης')
      && l.includes('80.000,00')
      && l.includes('90.000,00')
      && l.includes('Δεν απαιτείται ενέργεια')
    ))).toBe(true);
  });

  test('δεν αθροίζει σαν "νέα" ίδια εντάλματα ήδη γνωστά από πριν', () => {
    const before = { khmdhsPayments: [{ adam: 'PAY1' }, { adam: 'PAY2' }] };
    const after = { khmdhsPayments: [{ adam: 'PAY1' }, { adam: 'PAY2' }] };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines.some((l) => l.includes('ένταλμα'))).toBe(false);
  });
});

describe('buildKhmdhsRefreshChangeReport categories', () => {
  test('μόνο χειροκίνητη διατήρηση → category attention (όχι applied)', () => {
    const report = buildKhmdhsRefreshChangeReport({}, {}, {
      protectedCount: 1,
      protectedFields: [{
        fieldKey: 'contractAmount',
        label: 'Ποσό σύμβασης',
        keptValue: '80.000,00',
        khmdhsValue: '90.000,00',
      }],
    });
    expect(report.category).toBe('attention');
    expect(report.appliedLines).toHaveLength(0);
    expect(report.attentionLines.length).toBeGreaterThan(0);
  });

  test('πραγματική αλλαγή ποσού → category applied', () => {
    const report = buildKhmdhsRefreshChangeReport(
      { contractAmount: '100' },
      { contractAmount: '200' },
      {}
    );
    expect(report.category).toBe('applied');
  });

  test('καμία διαφορά → category unchanged', () => {
    const report = buildKhmdhsRefreshChangeReport(
      { contractAmount: '100' },
      { contractAmount: '100' },
      {}
    );
    expect(report.category).toBe('unchanged');
  });
});

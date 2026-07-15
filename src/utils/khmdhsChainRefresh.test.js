/**
 * @jest-environment node
 */
import { buildKhmdhsRefreshChangeSummary } from './khmdhsChainRefresh';

describe('buildKhmdhsRefreshChangeSummary', () => {
  test('αναφέρει όταν δεν εντοπίστηκαν ουσιώδεις διαφορές', () => {
    const before = { projectStatus: 'Σε εξέλιξη', contractAmount: '100.000,00' };
    const after = { ...before };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines).toEqual(['Δεν εντοπίστηκαν ουσιώδεις διαφορές — τα δεδομένα φαίνονται ενημερωμένα.']);
  });

  test('αναφέρει νέα εντάλματα πληρωμής', () => {
    const before = { khmdhsPayments: [{ adam: 'PAY1' }] };
    const after = { khmdhsPayments: [{ adam: 'PAY1' }, { adam: 'PAY2' }] };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines.some((l) => l.includes('νέα εντάλματα πληρωμής'))).toBe(true);
  });

  test('αναφέρει νέες καταχωρίσεις στο ιστορικό αλυσίδας (πχ παράταση)', () => {
    const before = { khmdhsContractChainHistory: [{ adam: 'SYMV1' }] };
    const after = { khmdhsContractChainHistory: [{ adam: 'SYMV1' }, { adam: 'PARAT1' }] };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines.some((l) => l.includes('αλυσίδα'))).toBe(true);
  });

  test('αναφέρει νέα ημ. λήξης όταν εντοπιστεί παράταση', () => {
    const before = { contractEndDate: '2025-01-01' };
    const after = { contractEndDate: '2025-06-30' };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines.some((l) => l.includes('Ημ. λήξης υλοποίησης'))).toBe(true);
  });

  test('αναφέρει πόσα έγγραφα καταγράφηκαν αυτόματα στα Αρχεία Υποέργου', () => {
    const before = { khmdhsDocumentRegistry: [{ adam: '22PROC010072052' }] };
    const after = {
      khmdhsDocumentRegistry: [
        { adam: '22PROC010072052' },
        { adam: '22PROC010072999' },
      ],
    };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines.some((l) => /1 νέο έγγραφο καταγράφηκε αυτόματα/.test(l))).toBe(true);
  });

  test('δεν αναφέρει τίποτα για το μητρώο εγγράφων όταν δεν προστέθηκε τίποτα νέο', () => {
    const before = { khmdhsDocumentRegistry: [{ adam: '22PROC010072052' }] };
    const after = { khmdhsDocumentRegistry: [{ adam: '22PROC010072052', title: 'Ενημερωμένος τίτλος' }] };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines.some((l) => l.includes('καταγράφηκ'))).toBe(false);
  });

  test('αναφέρει τη διαδικασία ανάθεσης όταν βρεθεί για πρώτη φορά', () => {
    const before = { assignmentProcedure: '' };
    const after = { assignmentProcedure: 'Ανοικτός διαγωνισμός' };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines.some((l) => l.includes('διαδικασία ανάθεσης'))).toBe(true);
  });

  test('προειδοποιεί για σύγκρουση ΑΠΕ αντί να το αγνοεί σιωπηλά', () => {
    const before = {};
    const after = {};
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {
      apeConflict: { current: '50.000,00', suggested: '52.000,00' },
    });
    expect(lines.some((l) => l.startsWith('⚠️') && l.includes('ΑΠΕ'))).toBe(true);
  });

  test('αναφέρει πεδία που δεν άλλαξαν λόγω χειροκίνητης διόρθωσης', () => {
    const lines = buildKhmdhsRefreshChangeSummary({}, {}, { protectedCount: 2 });
    expect(lines.some((l) => l.includes('2 πεδία δεν άλλαξαν'))).toBe(true);
  });

  test('δεν αθροίζει σαν "νέα" ίδια εντάλματα ήδη γνωστά από πριν', () => {
    const before = { khmdhsPayments: [{ adam: 'PAY1' }, { adam: 'PAY2' }] };
    const after = { khmdhsPayments: [{ adam: 'PAY1' }, { adam: 'PAY2' }] };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines.some((l) => l.includes('εντάλματα πληρωμής'))).toBe(false);
  });
});

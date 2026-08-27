/**
 * @jest-environment node
 */
import {
  buildKhmdhsRefreshChangeSummary,
  buildKhmdhsRefreshChangeReport,
  KHMDHS_REFRESH_REPORT_NO_CHANGES,
  KHMDHS_REGISTRY_REPORT_PREFIX,
  KHMDHS_REGISTRY_REPORT_PREFIX_LEGACY,
  splitKhmdhsRegistryChangeLines,
} from './khmdhsChainRefresh';
import { SYMV_CHAIN_ROLE } from './khmdhsSymvChainPlanner';

describe('buildKhmdhsRefreshChangeSummary', () => {
  test('αναφέρει όταν δεν εντοπίστηκαν ουσιώδεις διαφορές', () => {
    const before = { projectStatus: 'Σε εξέλιξη', contractAmount: '100.000,00' };
    const after = { ...before };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines).toEqual([KHMDHS_REFRESH_REPORT_NO_CHANGES]);
  });

  test('αναφέρει νέα εντάλματα πληρωμής με ΑΔΑΜ', () => {
    const before = {
      khmdhsPayments: [{
        adam: '26PAY000000001',
        snapshot: { referenceNumber: '26PAY000000001', totalCostWithVAT: 1000 },
      }],
    };
    const after = {
      khmdhsPayments: [
        {
          adam: '26PAY000000001',
          snapshot: { referenceNumber: '26PAY000000001', totalCostWithVAT: 1000 },
        },
        {
          adam: '26PAY000000002',
          snapshot: {
            referenceNumber: '26PAY000000002',
            totalCostWithVAT: 2000,
            title: 'Ένταλμα προκαταβολής',
            publishDate: '2026-03-15',
          },
        },
      ],
    };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    const payLine = lines.find((l) => l.includes('Νέο ένταλμα πληρωμής') && l.includes('26PAY000000002'));
    expect(payLine).toBeTruthy();
    expect(payLine).toMatch(/2\.000,00/);
    expect(payLine).toMatch(/Ένταλμα προκαταβολής/);
  });

  test('αναφέρει νέα γραμμή σύμβασης με ποσό', () => {
    const before = {
      implementationForm: 'Πολλές Συμβάσεις',
      contracts: [{ khmdhsAdam: '24SYMV000000001', contractAmount: '10.000,00' }],
    };
    const after = {
      implementationForm: 'Πολλές Συμβάσεις',
      contracts: [
        { khmdhsAdam: '24SYMV000000001', contractAmount: '10.000,00' },
        {
          khmdhsAdam: '25SYMV000000099',
          contractAmount: '45.000,00',
          contractDate: '2026-02-01',
          contractor: 'ΕΡΓΟΛΑΒΟΣ ΑΕ',
        },
      ],
    };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    const line = lines.find((l) => l.includes('Νέα σύμβαση') && l.includes('25SYMV000000099'));
    expect(line).toBeTruthy();
    expect(line).toMatch(/45\.000,00/);
    expect(line).toMatch(/ΕΡΓΟΛΑΒΟΣ ΑΕ/);
  });

  test('νέο ένταλμα χωρίς λεπτομέρειες → προσοχή, όχι καθαρή επιτυχία', () => {
    // Άμυνα αναφοράς: αν για οποιοδήποτε λόγο μείνει stub χωρίς snapshot, δεν μετρά ως «νέο».
    const before = {
      khmdhsPayments: [{
        adam: '26PAY000000001',
        snapshot: { referenceNumber: '26PAY000000001', totalCostWithVAT: 1000 },
      }],
    };
    const after = {
      khmdhsPayments: [
        {
          adam: '26PAY000000001',
          snapshot: { referenceNumber: '26PAY000000001', totalCostWithVAT: 1000 },
        },
        {
          adam: '26PAY000000002',
          snapshot: null,
          error: 'πολλά αιτήματα',
        },
      ],
    };
    const report = buildKhmdhsRefreshChangeReport(before, after, {});
    expect(report.category).toBe('unchanged');
    expect(report.appliedLines.some((l) => l.includes('Νέο ένταλμα'))).toBe(false);
    expect(report.incompleteLines.some((l) => (
      l.includes('26PAY000000002') && l.includes('χωρίς λεπτομέρειες') && l.includes('δεν διαγράφηκε')
    ))).toBe(true);
    expect(report.attentionLines.some((l) => l.includes('26PAY000000002'))).toBe(false);
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

  test('δεν αναφέρει στην αλυσίδα σύμβαση που αποκλείστηκε στην κατανομή', () => {
    const before = { khmdhsContractChainHistory: [{ adam: 'SYMV1' }] };
    const after = {
      khmdhsContractChainHistory: [
        { adam: 'SYMV1' },
        { adam: '26SYMV999', title: 'Άλλο τμήμα' },
      ],
      khmdhsSymvChainPlan: {
        items: [
          { adam: 'SYMV1', role: 'main' },
          { adam: '26SYMV999', role: 'skip' },
        ],
      },
    };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines.some((l) => l.includes('26SYMV999'))).toBe(false);
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

  test('γυμνό έγγραφο (isStub) δεν αναφέρεται ως «Νέο έγγραφο»', () => {
    const before = { khmdhsDocumentRegistry: [{ adam: '22PROC010072052' }] };
    const after = {
      khmdhsDocumentRegistry: [
        { adam: '22PROC010072052' },
        { adam: '22PROC010072999', isStub: true },
      ],
    };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines.some((l) => l.includes('22PROC010072999'))).toBe(false);
  });

  test('νέο έγγραφο στο μητρώο αναφέρεται ως καταγραφή ΚΗΜΔΗΣ', () => {
    const before = { khmdhsDocumentRegistry: [] };
    const after = {
      khmdhsDocumentRegistry: [
        { adam: '22PROC010072999', title: 'Διακήρυξη' },
      ],
    };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines.some((l) => (
      l.startsWith(KHMDHS_REGISTRY_REPORT_PREFIX)
      && l.includes('22PROC010072999')
      && l.includes('Διακήρυξη')
    ))).toBe(true);
  });

  test('παλιές γραμμές μητρώου ομαδοποιούνται μαζί με τις νέες', () => {
    const { other, registry } = splitKhmdhsRegistryChangeLines([
      'Νέα καταχώριση στην αλυσίδα: 25SYMV1',
      `${KHMDHS_REGISTRY_REPORT_PREFIX} 25PROC000000001 — Διακήρυξη`,
      `${KHMDHS_REGISTRY_REPORT_PREFIX_LEGACY} 24PROC000000002`,
    ]);
    expect(other).toEqual(['Νέα καταχώριση στην αλυσίδα: 25SYMV1']);
    expect(registry).toEqual([
      '25PROC000000001 — Διακήρυξη',
      '24PROC000000002',
    ]);
  });

  test('προειδοποίηση για ΑΔΑΜ που αποκλείστηκε στην κατανομή δεν εμφανίζεται', () => {
    const after = {
      khmdhsSymvChainPlan: {
        items: [{ adam: '24SYMV999999999', role: SYMV_CHAIN_ROLE.SKIP }],
      },
    };
    const report = buildKhmdhsRefreshChangeReport({}, after, {}, {
      chainWarnings: ['Δεν ανακτήθηκε το ένταλμα πληρωμής της σύμβασης 24SYMV999999999'],
    });
    expect(report.attentionLines.some((l) => l.includes('24SYMV999999999'))).toBe(false);
    expect(report.incompleteLines.some((l) => l.includes('24SYMV999999999'))).toBe(false);
  });

  test('σύγκρουση δημοσίευσης (noticeConflict) διατηρεί την κάρτα — δεν είναι ενέργεια', () => {
    const report = buildKhmdhsRefreshChangeReport({}, {}, { warnings: ['noticeConflict'] });
    expect(report.category).toBe('unchanged');
    expect(report.attentionLines.some((l) => l.includes('διαφορετική δημοσίευση'))).toBe(false);
    expect(report.incompleteLines.some((l) => l.includes('διαφορετική δημοσίευση'))).toBe(true);
    expect(report.incompleteLines.some((l) => /Διατηρήθηκε η κύρια|δεν διαγράφηκε τίποτα/i.test(l))).toBe(true);
  });

  test('νέα απόφαση ανάληψης χωρίς λεπτομέρειες → προσοχή, όχι καθαρή επιτυχία', () => {
    const before = {
      khmdhsCommitmentDecisions: [{
        adam: '25REQ016195275',
        snapshot: { referenceNumber: '25REQ016195275', signedDate: '2025-03-01' },
      }],
    };
    const after = {
      khmdhsCommitmentDecisions: [
        {
          adam: '25REQ016195275',
          snapshot: { referenceNumber: '25REQ016195275', signedDate: '2025-03-01' },
        },
        {
          adam: '25REQ016195999',
          snapshot: null,
          error: 'πολλά αιτήματα',
        },
      ],
    };
    const report = buildKhmdhsRefreshChangeReport(before, after, {});
    expect(report.category).toBe('unchanged');
    expect(report.appliedLines.some((l) => l.includes('Νέα απόφαση'))).toBe(false);
    expect(report.incompleteLines.some((l) => (
      l.includes('25REQ016195999') && l.includes('χωρίς λεπτομέρειες') && l.includes('δεν διαγράφηκε')
    ))).toBe(true);
    expect(report.attentionLines.some((l) => l.includes('25REQ016195999'))).toBe(false);
  });

  test('noContractInChain εμφανίζεται ως προσοχή', () => {
    const report = buildKhmdhsRefreshChangeReport({}, {}, { warnings: ['noContractInChain'] });
    expect(report.category).toBe('attention');
    expect(report.attentionLines.some((l) => l.includes('όχι σύμβαση') || l.includes('SYMV'))).toBe(true);
  });

  test('διατήρηση σταδίου (stagePreserved) είναι ανεπιβεβαίωση, όχι ενέργεια', () => {
    const report = buildKhmdhsRefreshChangeReport({}, {}, {
      warnings: ['stagePreserved:notice', 'stagePreserved:contract'],
    });
    expect(report.category).toBe('unchanged');
    expect(report.incompleteLines.some((l) => l.includes('δημοσίευση') && l.includes('διατηρήθηκε'))).toBe(true);
    expect(report.incompleteLines.some((l) => l.includes('σύμβαση') && l.includes('διατηρήθηκε'))).toBe(true);
    expect(report.attentionLines).toHaveLength(0);
  });

  test('προειδοποιήσεις ανάκτησης με πρόβλημα εμφανίζονται στην αναφορά', () => {
    const report = buildKhmdhsRefreshChangeReport({}, {}, {}, {
      chainWarnings: [
        'Δεν ανακτήθηκαν λεπτομέρειες για 1 ένταλμα/τα (26PAY000000002)',
        'Σύνοψη αλυσίδας: 3 πράξεις',
      ],
    });
    expect(report.category).toBe('unchanged');
    expect(report.incompleteLines.some((l) => l.includes('Δεν ανακτήθηκαν λεπτομέρειες'))).toBe(true);
    expect(report.attentionLines.some((l) => l.includes('Σύνοψη αλυσίδας'))).toBe(false);
  });

  test('παράλειψη ακυρωμένων πράξεων δεν μετράει ως «χρειάζονται προσοχή»', () => {
    const report = buildKhmdhsRefreshChangeReport({}, {}, {}, {
      chainWarnings: [
        'Παραλείφθηκαν 2 ακυρωμένες/ματαιωμένες πράξεις (/**/).',
      ],
    });
    expect(report.category).toBe('unchanged');
    expect(report.attentionLines.some((l) => l.includes('ακυρωμένες'))).toBe(false);
  });

  test('μόνο πρωτογενές αίτημα είναι ανεπιβεβαίωση — η κάρτα έμεινε', () => {
    const report = buildKhmdhsRefreshChangeReport({}, {}, {}, {
      chainWarnings: [
        'Δεν βρέθηκε πλήρης ηλεκτρονική αλυσίδα ΑΔΑΜ — ανακτήθηκε μόνο το πρωτογενές αίτημα.',
      ],
    });
    expect(report.category).toBe('unchanged');
    expect(report.attentionLines).toHaveLength(0);
    expect(report.incompleteLines.some((l) => (
      l.includes('μόνο το πρωτογενές αίτημα') && l.includes('Η κάρτα έμεινε όπως ήταν')
    ))).toBe(true);
  });

  test('μόνο σύμβαση χωρίς αλυσίδα είναι ανεπιβεβαίωση, όχι ενέργεια', () => {
    const report = buildKhmdhsRefreshChangeReport({}, {}, {}, {
      chainWarnings: [
        'Ανακτήθηκε μόνο η σύμβαση χωρίς ηλεκτρονικά συνδεδεμένη αλυσίδα — ελέγξτε χειροκίνητα αν λείπουν δημοσίευση/ανάθεση.',
      ],
    });
    expect(report.category).toBe('unchanged');
    expect(report.attentionLines).toHaveLength(0);
    expect(report.incompleteLines.some((l) => l.includes('μόνο τη σύμβαση'))).toBe(true);
  });

  test('αναφέρει ρητά αφαίρεση ακυρωμένης ανάληψης και όχι γενικό «από N → M»', () => {
    const before = {
      khmdhsCommitmentDecisions: [
        {
          adam: '25REQ016195275',
          snapshot: { referenceNumber: '25REQ016195275', title: 'Ζωντανή' },
        },
        {
          adam: '25REQ016195999',
          snapshot: { referenceNumber: '25REQ016195999', title: 'Ακυρωμένη' },
        },
      ],
    };
    const after = {
      khmdhsCommitmentDecisions: [
        {
          adam: '25REQ016195275',
          snapshot: { referenceNumber: '25REQ016195275', title: 'Ζωντανή' },
        },
      ],
      khmdhsAdamChainMeta: {
        confirmedCancelledAdams: ['25REQ016195999'],
      },
    };
    const report = buildKhmdhsRefreshChangeReport(before, after, {});
    expect(report.category).toBe('applied');
    expect(report.appliedLines.some((l) => (
      l.includes('25REQ016195999')
      && l.includes('ακυρωμένη ανάληψη')
      && l.includes('ματαιώσει')
    ))).toBe(true);
    expect(report.appliedLines.some((l) => /από 2 → 1/.test(l))).toBe(false);
    expect(report.attentionLines.some((l) => l.includes('Δεν επιβεβαιώθηκαν'))).toBe(false);
    expect(report.incompleteLines.some((l) => /από 2 → 1/.test(l))).toBe(false);
  });

  test('αναφέρει ρητά αφαίρεση ακυρωμένου εντάλματος', () => {
    const before = {
      khmdhsPayments: [
        {
          adam: '26PAY000000001',
          snapshot: { referenceNumber: '26PAY000000001', totalCostWithVAT: 1000 },
        },
        {
          adam: '26PAY000000002',
          snapshot: { referenceNumber: '26PAY000000002', totalCostWithVAT: 2000 },
        },
      ],
    };
    const after = {
      khmdhsPayments: [
        {
          adam: '26PAY000000001',
          snapshot: { referenceNumber: '26PAY000000001', totalCostWithVAT: 1000 },
        },
      ],
      khmdhsAdamChainMeta: {
        confirmedCancelledAdams: ['26PAY000000002'],
      },
    };
    const report = buildKhmdhsRefreshChangeReport(before, after, {});
    expect(report.category).toBe('applied');
    expect(report.appliedLines.some((l) => (
      l.includes('26PAY000000002')
      && l.includes('ακυρωμένο ένταλμα')
      && l.includes('ματαιώσει')
    ))).toBe(true);
    expect(report.appliedLines.some((l) => l.includes('άσχετα'))).toBe(false);
  });

  test('προειδοποίηση ενημέρωσης κάρτας για ακύρωση δεν μετράει ως προσοχή', () => {
    const report = buildKhmdhsRefreshChangeReport({}, {}, {}, {
      chainWarnings: [
        'Το ΚΗΜΔΗΣ έχει ακυρώσει/ματαιώσει 1 πράξη/εις της αλυσίδας (25REQ016195999). '
        + 'Η κάρτα του υποέργου ενημερώνεται χωρίς τους ακυρωμένους κρίκους (ανάληψη ή ένταλμα).',
      ],
    });
    expect(report.category).toBe('unchanged');
    expect(report.attentionLines.length).toBe(0);
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
    const pay = (adam) => ({
      adam,
      snapshot: { referenceNumber: adam, totalCostWithVAT: 1000 },
    });
    const before = { khmdhsPayments: [pay('26PAY000000001'), pay('26PAY000000002')] };
    const after = { khmdhsPayments: [pay('26PAY000000001'), pay('26PAY000000002')] };
    const lines = buildKhmdhsRefreshChangeSummary(before, after, {});
    expect(lines.some((l) => l.includes('ένταλμα'))).toBe(false);
  });
});

describe('buildKhmdhsRefreshChangeReport categories', () => {
  test('μόνο χειροκίνητη διατήρηση → category unchanged (ℹ️, όχι badge)', () => {
    const report = buildKhmdhsRefreshChangeReport({}, {}, {
      protectedCount: 1,
      protectedFields: [{
        fieldKey: 'contractAmount',
        label: 'Ποσό σύμβασης',
        keptValue: '80.000,00',
        khmdhsValue: '90.000,00',
      }],
    });
    expect(report.category).toBe('unchanged');
    expect(report.appliedLines).toHaveLength(0);
    expect(report.attentionLines.length).toBeGreaterThan(0);
    expect(report.attentionLines.every((l) => l.startsWith('ℹ️'))).toBe(true);
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

  test('λιγότερες αναλήψεις χωρίς ακύρωση → ανεπιβεβαίωση, όχι «από N → M»', () => {
    const before = {
      khmdhsCommitmentDecisions: [
        { adam: '25REQ016195275', snapshot: { referenceNumber: '25REQ016195275' } },
        { adam: '25REQ016195888', snapshot: { referenceNumber: '25REQ016195888' } },
        { adam: '25REQ016195999', snapshot: { referenceNumber: '25REQ016195999' } },
      ],
    };
    const after = {
      khmdhsCommitmentDecisions: [
        { adam: '25REQ016195275', snapshot: { referenceNumber: '25REQ016195275' } },
        { adam: '25REQ016195888', snapshot: { referenceNumber: '25REQ016195888' } },
      ],
    };
    const report = buildKhmdhsRefreshChangeReport(before, after, {});
    expect(report.category).toBe('unchanged');
    expect(report.appliedLines).toHaveLength(0);
    expect(report.appliedLines.some((l) => /από 3 → 2/.test(l))).toBe(false);
    expect(report.incompleteLines.some((l) => (
      l.includes('25REQ016195999')
      && l.includes('δεν επιβεβαίωσε')
      && l.includes('Δεν διαγράφηκε τίποτα')
    ))).toBe(true);
  });

  test('λιγότερα εντάλματα χωρίς ακύρωση → ανεπιβεβαίωση, όχι «άσχετα»', () => {
    const before = {
      khmdhsPayments: [
        { adam: '26PAY000000001', snapshot: { referenceNumber: '26PAY000000001' } },
        { adam: '26PAY000000002', snapshot: { referenceNumber: '26PAY000000002' } },
      ],
    };
    const after = {
      khmdhsPayments: [
        { adam: '26PAY000000001', snapshot: { referenceNumber: '26PAY000000001' } },
      ],
    };
    const report = buildKhmdhsRefreshChangeReport(before, after, {});
    expect(report.category).toBe('unchanged');
    expect(report.appliedLines.some((l) => l.includes('άσχετα') || /από 2 → 1/.test(l))).toBe(false);
    expect(report.incompleteLines.some((l) => (
      l.includes('26PAY000000002') && l.includes('Δεν διαγράφηκε τίποτα')
    ))).toBe(true);
  });
});

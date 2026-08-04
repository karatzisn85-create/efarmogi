/**
 * @jest-environment node
 */
import {
  buildProjectCardContractRows,
  buildSupplementaryCardSummary,
  shouldShowContractZone,
  shouldShowProcedureZone,
} from './projectCardDisplay';

describe('projectCardDisplay', () => {
  test('single contract row with deadline', () => {
    const rows = buildProjectCardContractRows({
      implementationForm: 'Μια Σύμβαση',
      contractDate: '2021-03-15',
      contractAmount: '100.000,00',
      contractEndDate: '2024-12-31',
      khmdhsContractChainHistory: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe('2021-03-15');
    expect(rows[0].deadline?.label).toBe('Λήξη υλοποίησης');
  });

  test('procedure zone when in contract process', () => {
    expect(shouldShowProcedureZone({
      projectStatus: 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ',
      assignmentProcedure: 'ΑΝΟΙΚΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ',
    })).toBe(true);
  });

  test('contract zone for executed status', () => {
    expect(shouldShowContractZone({
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      implementationForm: 'Μια Σύμβαση',
      contractDate: '2021-01-01',
    })).toBe(true);
  });

  test('supplementary summary on contract row', () => {
    const project = {
      implementationForm: 'Μια Σύμβαση',
      contractDate: '2022-12-01',
      contractAmount: '267.823,47',
      supplementaryContracts: [
        { amount: '74.155,85', khmdhsAdam: '24SYMV015482244', khmdhsDerived: true },
      ],
    };
    const summary = buildSupplementaryCardSummary(project);
    expect(summary.count).toBe(1);
    expect(summary.label).toBe('Συμπληρωματική');
    expect(summary.displayAmount).toBe('74.155,85');

    const rows = buildProjectCardContractRows(project);
    expect(rows[0].supplementarySummary?.displayAmount).toBe('74.155,85');
  });

  test('παράταση δεν εμφανίζεται ως Συμπληρωματική στην κάρτα', () => {
    const project = {
      implementationForm: 'Μια Σύμβαση',
      contractDate: '2024-03-28',
      contractAmount: '1.191.178,29',
      contractEndDate: '2025-03-28',
      supplementaryContracts: [
        {
          amount: '1.191.178,29',
          date: '2025-10-31',
          khmdhsAdam: '25SYMV017748918',
          khmdhsDerived: true,
          comments: 'Παράταση',
        },
      ],
      khmdhsContractChainHistory: [
        { adam: '25SYMV017748918', isRoot: false, kind: 'extension', endDate: '2025-10-31' },
      ],
    };
    const rows = buildProjectCardContractRows(project);
    expect(rows[0].supplementarySummary).toBeNull();
    expect(rows[0].amendmentsLine).toContain('παράταση');
  });

  test('παράταση — η κάρτα δείχνει την καταληκτική παράτασης όχι την αρχική λήξη', () => {
    const project = {
      implementationForm: 'Μια Σύμβαση',
      contractDate: '2024-03-28',
      contractAmount: '1.191.178,29',
      contractEndDate: '2025-08-14',
      supplementaryContracts: [
        {
          date: '2026-08-14',
          khmdhsAdam: '25SYMV017748918',
          khmdhsDerived: true,
          comments: 'Παράταση',
        },
      ],
      khmdhsContractChainHistory: [
        { adam: '24SYMV001', isRoot: true, endDate: '2025-08-14' },
        { adam: '25SYMV017748918', isRoot: false, kind: 'extension', endDate: '2025-08-14' },
      ],
      khmdhsDataQualityReview: {
        items: [],
        resolutions: {
          'chainKindReview:25SYMV017748918': {
            value: 'extension',
            source: 'user_confirmed',
            meta: { endDate: '2025-08-14' },
          },
        },
      },
    };
    const rows = buildProjectCardContractRows(project);
    expect(rows[0].deadline?.label).toContain('Παράταση');
    expect(rows[0].deadline?.value).toBe('14/08/2026');
  });

  test('multiple supplementaries show total on card row', () => {
    const summary = buildSupplementaryCardSummary({
      supplementaryContracts: [
        { amount: '10.000,00' },
        { amount: '5.000,00' },
      ],
    });
    expect(summary.label).toBe('Συμπληρωματικές (2)');
    expect(summary.totalFormatted).toBe('15.000,00');
  });

  test('σύνοψη εμφανίζει γραμμή με μόνο ημερομηνίες (χωρίς ποσό/ανάδοχο)', () => {
    const rows = buildProjectCardContractRows({
      implementationForm: 'Μια Σύμβαση',
      contractDate: '2023-06-01',
      contractEndDate: '2024-06-01',
      khmdhsContractChainHistory: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe('2023-06-01');
    expect(rows[0].amount).toBe('');
    expect(rows[0].contractorName).toBe('');
    expect(rows[0].deadline?.label).toBe('Λήξη υλοποίησης');
    expect(rows[0].deadline?.value).toBe('01/06/2024');
  });
});

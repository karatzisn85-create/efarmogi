/**
 * @jest-environment node
 */
import {
  getProjectApeAmountForExport,
  getProjectPayableAmountForExport,
  getProjectContractDatesRawForExport,
  getProjectDqrStatusForExport,
} from './khmdhsExportHelpers';
import { KHMDHS_REVIEW_STATUS } from './khmdhsDataQualityReport';

describe('khmdhsExportHelpers', () => {
  test('getProjectApeAmountForExport διαβάζει τελευταίο ΑΠΕ από apeEntries', () => {
    const project = {
      implementationForm: 'Μια Σύμβαση',
      apeAmount: '100,00',
      apeEntries: [
        { id: 'a', documentDate: '2024-01-01', apeAmount: '100,00' },
        { id: 'b', documentDate: '2024-06-01', apeAmount: '150.500,25' },
      ],
    };
    expect(getProjectApeAmountForExport(project)).toBe('150.500,25');
  });

  test('getProjectPayableAmountForExport = ΑΠΕ + συμπληρωματικές (όχι παρατάσεις)', () => {
    const project = {
      implementationForm: 'Μια Σύμβαση',
      contractAmount: '100.000,00',
      apeAmount: '120.000,00',
      apeEntries: [{ id: 'a', documentDate: '2024-01-01', apeAmount: '120.000,00' }],
      supplementaryContracts: [
        { amount: '10.000,00', comments: 'Συμπληρωματική σύμβαση' },
        { amount: '5.000,00', comments: 'Παράταση' },
      ],
    };
    // 120.000 ΑΠΕ + 10.000 συμπληρωματική (παράταση αγνοείται)
    expect(getProjectPayableAmountForExport(project)).toBe('130.000,00');
  });

  test('getProjectPayableAmountForExport χωρίς ΑΠΕ = σύμβαση + συμπληρωματικές', () => {
    const project = {
      implementationForm: 'Μια Σύμβαση',
      contractAmount: '50.000,00',
      supplementaryContracts: [
        { amount: '2.500,50', comments: 'Συμπληρωματική σύμβαση' },
      ],
    };
    expect(getProjectPayableAmountForExport(project)).toBe('52.500,50');
  });

  test('getProjectContractDatesRawForExport για πολλές συμβάσεις ενώνει ημερομηνίες', () => {
    const project = {
      implementationForm: 'Πολλές Συμβάσεις',
      contractDate: '',
      contracts: [
        { date: '2024-01-15', amount: '1.000,00' },
        { date: '2024-03-20', amount: '2.000,00' },
      ],
    };
    expect(getProjectContractDatesRawForExport(project)).toBe('2024-01-15 • 2024-03-20');
  });

  test('getProjectDqrStatusForExport μετρά πραγματικά ανοιχτά (needs_review)', () => {
    const project = {
      khmdhsDataQualityReview: {
        items: [
          { fieldId: 'contractAmount', status: KHMDHS_REVIEW_STATUS.NEEDS_REVIEW, contractIndex: null },
          { fieldId: 'contractDate', status: KHMDHS_REVIEW_STATUS.COMPLETE, contractIndex: null },
        ],
        resolutions: {},
        acknowledgedFieldIds: [],
      },
    };
    expect(getProjectDqrStatusForExport(project)).toBe('1 ανοιχτά');
  });

  test('getProjectDqrStatusForExport δεν λέει Επιλύθηκε όταν υπάρχουν ανοιχτά', () => {
    const project = {
      khmdhsDataQualityReview: {
        items: [
          { fieldId: 'anadoxosName', status: 'needs_review', actionRequired: true },
        ],
        resolutions: {},
      },
    };
    const value = getProjectDqrStatusForExport(project);
    expect(value).not.toBe('Επιλύθηκε');
    expect(value).toMatch(/ανοιχτά/);
  });
});

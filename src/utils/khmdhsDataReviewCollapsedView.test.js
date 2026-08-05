/**
 * @jest-environment node
 */
import {
  KHMDHS_REVIEW_STATUS,
  buildReviewItemCollapsedView,
  getReviewItemUserGuide,
} from './khmdhsDataQualityReport';

describe('buildReviewItemCollapsedView — μία ερώτηση + Περισσότερα', () => {
  test('MISSING: ερώτηση από guide.hint και CTA αποθήκευσης', () => {
    const item = {
      fieldId: 'contractDate',
      label: 'Ημερομηνία σύμβασης',
      status: KHMDHS_REVIEW_STATUS.MISSING,
      displayValue: '',
      message: 'Λείπει η ημερομηνία',
    };
    const view = buildReviewItemCollapsedView(item);
    const guide = getReviewItemUserGuide(item);
    expect(view.question).toBe(guide.hint);
    expect(view.primaryCta).toBe('Αποθήκευση τιμής');
    expect(view.statusLabel).toBe('Λείπει');
    expect(view.moreLines.some((l) => l.includes('ΚΗΜΔΗΣ'))).toBe(true);
  });

  test('NEEDS_REVIEW: ερώτηση ελέγχου και CTA επιβεβαίωσης', () => {
    const item = {
      fieldId: 'contractAmount',
      label: 'Ποσό σύμβασης',
      status: KHMDHS_REVIEW_STATUS.NEEDS_REVIEW,
      displayValue: '10.000,00 €',
      relatedInfo: [{ label: 'Πηγή', value: 'SYMV' }],
    };
    const view = buildReviewItemCollapsedView(item);
    expect(view.question).toMatch(/πρόταση ΚΗΜΔΗΣ/i);
    expect(view.primaryCta).toBe('Επιβεβαίωση');
    expect(view.moreLines.some((l) => l.includes('10.000'))).toBe(true);
    expect(view.moreLines.some((l) => l.includes('Πηγή: SYMV'))).toBe(true);
  });

  test('chainKindReview: ερώτηση με ΑΔΑΜ και CTA χαρακτηρισμού', () => {
    const item = {
      fieldId: 'chainKindReview',
      label: 'Χαρακτηρισμός',
      status: KHMDHS_REVIEW_STATUS.NEEDS_REVIEW,
      chainAdam: '24SYMV123456789',
      displayValue: 'Συμπληρωματική',
    };
    const view = buildReviewItemCollapsedView(item);
    expect(view.question).toContain('24SYMV123456789');
    expect(view.primaryCta).toBe('Αποθήκευση χαρακτηρισμού');
    expect(view.statusLabel).toBe('Επιλέξτε τύπο');
  });

  test('paymentsReconciliation: ερώτηση σύγκρισης ποσών', () => {
    const item = {
      fieldId: 'paymentsReconciliation',
      label: 'Εντάλματα',
      status: KHMDHS_REVIEW_STATUS.NEEDS_REVIEW,
      displayValue: 'άθροισμα',
      paymentsReconciliation: { entries: [] },
    };
    const view = buildReviewItemCollapsedView(item);
    expect(view.question).toMatch(/άθροισμα|συμβατικό/i);
    expect(view.primaryCta).toBe('Αποθήκευση χαρακτηρισμών');
    expect(view.icon).toBeTruthy();
  });

  test('περιορισμός: η ερώτηση δεν επαναλαμβάνεται στα moreLines', () => {
    const item = {
      fieldId: 'projectBudget',
      label: 'Προϋπολογισμός',
      status: KHMDHS_REVIEW_STATUS.MISSING,
      message: 'Δεν βρέθηκε στο ΚΗΜΔΗΣ — συμπληρώστε από τα έγγραφά σας',
      displayValue: '',
    };
    const view = buildReviewItemCollapsedView(item);
    expect(view.moreLines).not.toContain(view.question);
  });

  test('με resolution: who/when στα moreLines', () => {
    const item = {
      fieldId: 'contractDate',
      label: 'Ημερομηνία',
      status: KHMDHS_REVIEW_STATUS.NEEDS_REVIEW,
      displayValue: '2024-01-01',
    };
    const review = {
      resolutions: {
        'contractDate::shared': {
          value: '2024-01-01',
          source: 'user_confirmed',
          resolvedAt: '2026-08-05T10:00:00.000Z',
          resolvedBy: 'Μαρία',
        },
      },
    };
    const view = buildReviewItemCollapsedView(item, { review });
    expect(view.moreLines.some((l) => l.includes('Μαρία'))).toBe(true);
  });
});

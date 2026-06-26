/**
 * @jest-environment node
 */
import {
  enrichChainHistoryWithReview,
  CHAIN_KIND,
} from './khmdhsChainActions';

describe('enrichChainHistoryWithReview', () => {
  test('relabels act-wide supplementary as extension when user chose extension', () => {
    const history = [
      { adam: '22SYMV011799800', isRoot: true, label: 'Αρχική σύμβαση', order: 0 },
      {
        adam: '24SYMV015482244',
        isRoot: false,
        order: 1,
        kind: 'modification',
        suggestedKind: 'modification',
        label: 'Συμπληρωματική σύμβαση (ίδια ανάθεση)',
        actLinkedSupplementary: true,
        kindNote: 'Συμπληρωματική της ίδιας ανάθεσης — δεν συνδέεται με prev/next στην κύρια αλυσίδα.',
      },
    ];
    const review = {
      resolutions: {
        'chainKindReview::24SYMV015482244': {
          value: CHAIN_KIND.EXTENSION,
          source: 'user_confirmed',
        },
      },
    };
    const enriched = enrichChainHistoryWithReview(history, review);
    const entry = enriched.find((h) => h.adam === '24SYMV015482244');
    expect(entry.label).toBe('Παράταση');
    expect(entry.effectiveKind).toBe(CHAIN_KIND.EXTENSION);
    expect(entry.kindNote).toMatch(/Παράταση/);
  });
});

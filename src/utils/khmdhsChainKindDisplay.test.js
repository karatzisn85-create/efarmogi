/**
 * @jest-environment node
 */
import {
  enrichChainHistoryWithReview,
  computeChainCharacterizationEffects,
  describeChainKindAction,
  CHAIN_KIND,
} from './khmdhsChainActions';
import { enrichChainKindReviewItem, buildChainKindSelectOptions } from './khmdhsChainKindOptions';

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

  test('χαρακτηρισμός ΑΠΕ δεν δημιουργεί συμπληρωματική γραμμή', () => {
    const apeAdam = '25SYMVAPE000001';
    const history = [
      {
        adam: '24SYMV001',
        isRoot: true,
        order: 0,
        contractAmount: '100.000,00',
      },
      {
        adam: apeAdam,
        isRoot: false,
        order: 1,
        kind: 'modification',
        suggestedKind: 'ape',
        contractAmount: '112.000,00',
        title: 'Ανακεφαλαιωτικός Πίνακας Εργασιών',
      },
    ];
    const review = {
      resolutions: {
        [`chainKindReview::${apeAdam}`]: { value: CHAIN_KIND.APE },
      },
    };
    const eff = computeChainCharacterizationEffects(history, review);
    expect(eff.supplementaryContracts).toEqual([]);
    expect(eff.perAct.find((a) => a.adam === apeAdam)).toEqual({
      adam: apeAdam,
      kind: CHAIN_KIND.APE,
      effect: 'ape',
    });
    const enriched = enrichChainHistoryWithReview(history, review);
    expect(enriched[1].label).toBe('ΑΠΕ');
    expect(describeChainKindAction(CHAIN_KIND.APE)).toMatch(/ΑΠΕ/);
  });
});

describe('επιλογές χαρακτηρισμού', () => {
  test('πάντα περιλαμβάνουν ΑΠΕ — ακόμα και σε παλιά στοιχεία χωρίς την επιλογή', () => {
    const values = buildChainKindSelectOptions().map((o) => o.value);
    expect(values).toContain('ape');
    const stale = enrichChainKindReviewItem({
      fieldId: 'chainKindReview',
      chainAdam: '25SYMV000000001',
      kindOptions: [
        { value: 'modification', label: 'Συμπληρωματική σύμβαση' },
        { value: 'other', label: 'Άλλο' },
      ],
    }, {});
    expect(stale.kindOptions.map((o) => o.value)).toContain('ape');
  });
});

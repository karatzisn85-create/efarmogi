/**
 * @jest-environment node
 */
const { buildPresentationModel } = require('../../public/apologismosPresentation');
const { composeApologismosDeck } = require('../../public/apologismosPptxExport');
const { GEOM, SLIDE_W, SLIDE_H } = require('../../public/apologismosSlideDesign');

const period = {
  id: '2024-2028',
  startYear: 2024,
  endYear: 2028,
  label: 'Δημοτική περίοδος 2024–2028',
};

function card(overrides = {}) {
  return {
    id: 'c1',
    source: 'linked',
    title: 'Ανακατασκευή οδού',
    categoryId: 'roads',
    area: 'Δημοτική ενότητα Αρχανών',
    narrative: 'Πλήρης ανακατασκευή του οδοστρώματος και νέος φωτισμός.',
    approvedAmount: '200.000,00',
    contractAmount: '180.000,00',
    primaryViz: 'simple_card',
    photos: {},
    ...overrides,
  };
}

function modelWith(appearance) {
  return buildPresentationModel(
    {
      appearance,
      cards: [
        card({ id: '1' }),
        card({ id: '2', title: 'Ύδρευση οικισμού', categoryId: 'water', primaryViz: 'economy_phases' }),
        card({
          id: '3',
          title: 'Μετρήσεις έργου',
          categoryId: 'regeneration',
          primaryViz: 'metrics_table',
          metrics: [{ label: 'Μήκος', value: '1.200 μ.' }, { label: 'Πλάτος', value: '6 μ.' }],
        }),
      ],
    },
    period,
    { appConfig: { organizationName: 'Αρχανών Αστερουσίων' } }
  );
}

const deckText = (deck) => JSON.stringify(deck.slides);
/** Κείμενο χωρίς το εξώφυλλο — εκεί εμφανίζεται ούτως ή άλλως ο οργανισμός. */
const bodyText = (deck) => JSON.stringify(deck.slides.slice(1));

describe('εξαγωγή διαφανειών απολογισμού', () => {
  test('εξώφυλλο, διαφάνεια ανά κατηγορία και μία ανά έργο', () => {
    const deck = composeApologismosDeck(modelWith({}), { resolveMedia: () => null });
    // 1 εξώφυλλο + 1 περιεχόμενα + 3 κατηγορίες + 3 έργα
    expect(deck.slides).toHaveLength(8);
    expect(bodyText(deck)).toContain('Περιεχόμενα');
    expect(bodyText(deck)).toContain('ΟΔΗΓΟΣ ΠΑΡΟΥΣΙΑΣΗΣ');
  });

  test('η δομή προσαρμόζεται στις επιλογές του χρήστη', () => {
    const noDividers = composeApologismosDeck(modelWith({ sectionDividers: false }), { resolveMedia: () => null });
    expect(noDividers.slides).toHaveLength(5);
  });

  test('μήνυμα Δημάρχου προσθέτει διαφάνεια μετά τα περιεχόμενα', () => {
    const deck = composeApologismosDeck(modelWith({
      mayorMessage: {
        enabled: true,
        mayorName: 'Γιάννης Παπαδόπουλος',
        text: 'Σύντομο μήνυμα για τον απολογισμό.',
        photo: { relativePath: 'appearance/mayor.jpg' },
      },
    }), { resolveMedia: () => null });
    // 1 εξώφυλλο + 1 toc + 1 δήμαρχος + 3 κατηγορίες + 3 έργα
    expect(deck.slides).toHaveLength(9);
    expect(bodyText(deck)).toContain('Μήνυμα Δημάρχου');
    expect(bodyText(deck)).toContain('Σύντομο μήνυμα για τον απολογισμό.');
    expect(bodyText(deck)).toContain('Γιάννης Παπαδόπουλος');
  });

  test('το υποσέλιδο ακολουθεί την επιλογή εμφάνισης', () => {
    const full = bodyText(composeApologismosDeck(modelWith({}), { resolveMedia: () => null }));
    // Τα κεφαλαία γράφονται χωρίς τόνους, όπως επιβάλλει η ελληνική τυπογραφία.
    expect(full).toContain('ΔΗΜΟΣ ΑΡΧΑΝΩΝ ΑΣΤΕΡΟΥΣΙΩΝ');
    expect(full).toContain('2 / 8');

    const none = bodyText(composeApologismosDeck(modelWith({ footerMode: 'none' }), { resolveMedia: () => null }));
    expect(none).not.toContain('2 / 8');

    const minimal = bodyText(composeApologismosDeck(modelWith({ footerMode: 'minimal' }), { resolveMedia: () => null }));
    expect(minimal).toContain('2 / 8');
    expect(minimal).not.toContain('ΔΗΜΟΣ ΑΡΧΑΝΩΝ');
  });

  test('τα σύνολα εξωφύλλου κρύβονται όταν το ζητήσει ο χρήστης', () => {
    const withStats = JSON.stringify(
      composeApologismosDeck(modelWith({}), { resolveMedia: () => null }).slides[0]
    );
    expect(withStats).toContain('ΕΓΚΕΚΡΙΜΕΝΑ');
    const withoutStats = JSON.stringify(
      composeApologismosDeck(
        modelWith({ coverStats: false, sectionDividers: false }),
        { resolveMedia: () => null }
      ).slides[0]
    );
    expect(withoutStats).not.toContain('ΕΓΚΕΚΡΙΜΕΝΑ');
  });

  test('όλα τα σχήματα παραμένουν εντός της διαφάνειας', () => {
    const deck = composeApologismosDeck(modelWith({ textScale: 'large' }), { resolveMedia: () => null });
    const maxW = SLIDE_W / 96;
    const maxH = SLIDE_H / 96;
    deck.slides.forEach((slide) => {
      (slide._slideObjects || []).forEach((obj) => {
        const o = obj.options || {};
        if (typeof o.x !== 'number' || typeof o.w !== 'number') return;
        expect(o.x).toBeGreaterThanOrEqual(0);
        expect(o.x + o.w).toBeLessThanOrEqual(maxW + 0.01);
        expect(o.y).toBeGreaterThanOrEqual(-0.01);
        expect(o.y + o.h).toBeLessThanOrEqual(maxH + 0.01);
      });
    });
  });

  test('η γεωμετρία των διαφανειών προκύπτει από τον κοινό καμβά', () => {
    expect(GEOM.contentBottom).toBeLessThan(GEOM.footerRuleY);
    expect(GEOM.footerTextY + GEOM.footerTextH).toBeLessThan(SLIDE_H);
  });
});

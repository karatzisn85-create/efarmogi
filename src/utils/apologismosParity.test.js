/**
 * @jest-environment node
 */
const {
  resolveTocLayout,
  splitTocColumns,
  TOC_TWO_COLUMN_AT,
} = require('../../public/apologismosTocLayout');
const { flattenPresentationSlides, summarizeSlideTypes } = require('../../public/apologismosSlideFlatten');
const { buildPresentationModel } = require('../../public/apologismosPresentation');
const { composeApologismosDeck } = require('../../public/apologismosPptxExport');

describe('apologismosTocLayout', () => {
  test('πυκνότητα και δύο στήλες', () => {
    expect(resolveTocLayout({ items: [{}, {}, {}, {}, {}] }).compact).toBe(false);
    expect(resolveTocLayout({ items: Array(6).fill({}) }).compact).toBe(true);
    expect(resolveTocLayout({ items: Array(7).fill({}) }).dense).toBe(true);
    expect(resolveTocLayout({ items: Array(TOC_TWO_COLUMN_AT).fill({}) }).twoColumn).toBe(true);
    expect(resolveTocLayout({ items: Array(8).fill({}), preface: [{}] }).twoColumn).toBe(true);
  });

  test('splitTocColumns μισάζει τη λίστα', () => {
    const [a, b] = splitTocColumns([1, 2, 3, 4, 5]);
    expect(a).toEqual([1, 2, 3]);
    expect(b).toEqual([4, 5]);
  });
});

describe('ισοδυναμία παρουσίασης (flatten ↔ PPTX)', () => {
  function sampleModel() {
    const period = {
      id: '2024-2028',
      startYear: 2024,
      endYear: 2028,
      label: 'Δημοτική περίοδος 2024–2028',
    };
    const report = {
      appearance: {
        sectionDividers: true,
        coverStats: true,
        mayorMessage: {
          enabled: true,
          mayorName: 'Δήμαρχος',
          text: 'Κείμενο μηνύματος για τον απολογισμό.',
          photo: { relativePath: 'appearance/mayor.jpg', focusX: 0.5, focusY: 0.4, zoom: 1 },
        },
      },
      cards: [
        {
          id: 'c1',
          title: 'Έργο χάρτη',
          categoryId: 'roads',
          narrative: 'Περιγραφή',
          approvedAmount: '100.000,00',
          contractAmount: '90.000,00',
          primaryViz: 'map_path',
          mapSnapshot: 'media/map1.png',
          mapDrawing: {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              properties: { name: 'Α' },
              geometry: { type: 'Point', coordinates: [25.16, 35.18] },
            }],
          },
          mapView: { lat: 35.18, lng: 25.16, zoom: 12 },
          photos: {},
        },
        {
          id: 'c2',
          title: 'Έργο κειμένου',
          categoryId: 'buildings',
          narrative: 'Άλλο',
          approvedAmount: '50.000,00',
          contractAmount: '40.000,00',
          primaryViz: 'simple_card',
          photos: {},
        },
      ],
    };
    return buildPresentationModel(report, period, {
      appConfig: { organizationFullName: 'Δήμος Αρχανών Αστερουσίων' },
    });
  }

  test('flatten και PPTX έχουν ίδιο πλήθος διαφανειών / ίδιους τύπους σειράς', () => {
    const model = sampleModel();
    const flat = flattenPresentationSlides(model);
    const types = summarizeSlideTypes(flat);
    expect(types[0]).toBe('cover');
    expect(types).toContain('toc');
    expect(types).toContain('mayor');
    expect(types.filter((t) => t === 'category').length).toBe(2);
    expect(types).toContain('project:map');
    expect(types).toContain('project:simple');

    const mapSlide = flat.find((s) => s.pageType === 'map');
    expect(mapSlide.hasMapSnapshot).toBe(true);
    expect(mapSlide.hasMapDrawing).toBe(true);

    const pptx = composeApologismosDeck(model, {
      resolveMedia: () => null,
      coverFrames: [],
    });
    expect(pptx._slides.length).toBe(flat.length);
  });

  test('map page κρατά mapDrawing για ζωντανή οθόνη', () => {
    const model = sampleModel();
    const entry = model.sections
      .flatMap((s) => s.cards)
      .find((e) => e.card?.id === 'c1');
    const page = entry.contentPages.find((p) => p.type === 'map');
    expect(page.mapSnapshot).toBe('media/map1.png');
    expect(page.mapDrawing.features).toHaveLength(1);
    expect(page.mapView.zoom).toBe(12);
  });
});

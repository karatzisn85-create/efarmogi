/**
 * @jest-environment node
 */
const {
  buildPresentationModel,
  buildPhotoLayoutPlan,
} = require('../../public/apologismosPresentation');

const period = {
  id: '2024-2028',
  startYear: 2024,
  endYear: 2028,
  label: 'Δημοτική περίοδος 2024–2028',
};

function readyCard(overrides = {}) {
  return {
    id: 'c1',
    source: 'linked',
    title: 'Έργο Α',
    categoryId: 'roads',
    narrative: 'Περιγραφή έργου.',
    approvedAmount: '100.000,00',
    contractAmount: '80.000,00',
    primaryViz: 'simple_card',
    photos: {},
    ...overrides,
  };
}

describe('apologismosPresentation', () => {
  test('μόνο ready κάρτες· κενή κατηγορία παραλείπεται· totals σωστά', () => {
    const report = {
      cards: [
        readyCard({
          id: '1',
          title: 'Μεγάλο',
          approvedAmount: '200.000,00',
          categoryId: 'roads',
        }),
        readyCard({
          id: '2',
          title: 'Μικρό',
          approvedAmount: '50.000,00',
          categoryId: 'roads',
        }),
        readyCard({
          id: '3',
          title: 'Ανάπλαση',
          approvedAmount: '30.000,00',
          categoryId: 'regeneration',
        }),
        readyCard({
          id: '4',
          title: 'Εκκρεμές',
          narrative: '',
          categoryId: 'water',
        }),
      ],
    };
    const model = buildPresentationModel(report, period, {
      appConfig: { organizationName: 'Αρχανών Αστερουσίων' },
    });
    expect(model.totals.projectCount).toBe(3);
    expect(model.pendingCount).toBe(1);
    expect(model.sections).toHaveLength(2);
    expect(model.sections[0].categoryId).toBe('roads');
    expect(model.sections[0].cards.map((x) => x.card.title)).toEqual(['Μεγάλο', 'Μικρό']);
    expect(model.sections[0].count).toBe(2);
    expect(model.sections.find((s) => s.categoryId === 'water')).toBeUndefined();
    expect(model.theme).toBeTruthy();
    expect(model.theme.accent).toBeTruthy();
    expect(model.cover.organizationTitle).toBe('Δήμος Αρχανών Αστερουσίων');
    expect(model.cover.layoutId).toBe('hero_single');
    expect(model.appearance.paletteId).toBe('light_report');
    expect(model.motion).toEqual({ enabled: false, style: 'fade' });
  });

  test('photo layout: 3+3 → primary + leftover gallery pages', () => {
    const plan = buildPhotoLayoutPlan({
      primaryViz: 'before_after',
      photos: {
        before: ['b1', 'b2', 'b3'],
        after: ['a1', 'a2', 'a3'],
      },
    });
    expect(plan.primary.before).toBe('b1');
    expect(plan.primary.after).toBe('a1');
    expect(plan.leftovers).toHaveLength(4);
    expect(plan.pages[0].type).toBe('primary_photos');
    expect(plan.pages.length).toBeGreaterThan(1);
  });

  test('after_only: σελίδα φωτογραφίας Μετά + narrative στο display', () => {
    const { buildCardPresentationEntry } = require('../../public/apologismosPresentation');
    const entry = buildCardPresentationEntry(readyCard({
      primaryViz: 'after_only',
      narrative: 'Ολοκληρώθηκε η παρέμβαση.',
      photos: { after: ['a1', 'a2'] },
    }));
    expect(entry.display.narrative).toBe('Ολοκληρώθηκε η παρέμβαση.');
    expect(entry.display.showHeaderAmounts).toBe(true);
    expect(entry.display.showHeaderNarrative).toBe(true);
    expect(entry.contentPages[0].type).toBe('primary_photos');
    expect(entry.contentPages[0].primary).toEqual({ after: 'a1' });
    expect(entry.contentPages.some((p) => p.type === 'gallery')).toBe(true);
  });

  test('έμφαση ποσών: χωρίς ποσά στην κεφαλίδα· σώμα amounts', () => {
    const { buildCardPresentationEntry } = require('../../public/apologismosPresentation');
    const entry = buildCardPresentationEntry(readyCard({
      primaryViz: 'economy_phases',
    }));
    expect(entry.display.showHeaderAmounts).toBe(false);
    expect(entry.display.showHeaderNarrative).toBe(true);
    expect(entry.contentPages[0].type).toBe('amounts');
  });

  test('μόνο κείμενο: χωρίς narrative στην κεφαλίδα· σώμα simple τονισμένο', () => {
    const { buildCardPresentationEntry } = require('../../public/apologismosPresentation');
    const entry = buildCardPresentationEntry(readyCard({
      primaryViz: 'simple_card',
      narrative: 'Κυρίαρχο αφήγημα.',
    }));
    expect(entry.display.showHeaderAmounts).toBe(true);
    expect(entry.display.showHeaderNarrative).toBe(false);
    expect(entry.contentPages[0].type).toBe('simple');
    expect(entry.contentPages[0].emphasizeNarrative).toBe(true);
    expect(entry.contentPages[0].narrative).toBe('Κυρίαρχο αφήγημα.');
  });

  test('τρόπος 2 με 2/1/3 φωτό', () => {
    const plan = buildPhotoLayoutPlan({
      primaryViz: 'before_during_after',
      photos: {
        before: ['b1', 'b2'],
        during: ['d1'],
        after: ['a1', 'a2', 'a3'],
      },
    });
    expect(plan.primary).toEqual({ before: 'b1', during: 'd1', after: 'a1' });
    expect(plan.leftovers).toHaveLength(3);
  });

  test('έτος ολοκλήρωσης δεν περνά στο display', () => {
    const model = buildPresentationModel(
      {
        cards: [
          readyCard({
            source: 'legacy',
            area: 'Αρχάνες',
            completionYear: 2025,
          }),
        ],
      },
      period
    );
    const display = model.sections[0].cards[0].display;
    expect(display.completionYear).toBeUndefined();
    expect(display.area).toBe('Αρχάνες');
  });
});

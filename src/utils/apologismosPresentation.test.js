/**
 * @jest-environment node
 */
const {
  buildPresentationModel,
  buildPhotoLayoutPlan,
  buildPresentationToc,
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

  test('toc: κατηγορίες με πλήθος και σελίδα έναρξης μετά εξώφυλλο+περιεχόμενα', () => {
    const report = {
      cards: [
        readyCard({ id: '1', categoryId: 'roads', approvedAmount: '200.000,00' }),
        readyCard({ id: '2', categoryId: 'roads', approvedAmount: '50.000,00' }),
        readyCard({
          id: '3',
          categoryId: 'regeneration',
          approvedAmount: '30.000,00',
          primaryViz: 'before_after',
          photos: {
            before: ['media/x/before/a.jpg'],
            during: [],
            after: ['media/x/after/b.jpg'],
          },
        }),
      ],
    };
    const model = buildPresentationModel(report, period);
    expect(model.toc.items).toHaveLength(2);
    expect(model.toc.preface).toEqual([]);
    expect(model.mayorMessage).toEqual({ enabled: false });
    // Με διαχωριστικά κατηγορίας: εξώφυλλο(1) + toc(2) + divider roads(3) → roads start 3
    expect(model.toc.items[0]).toMatchObject({
      categoryId: 'roads',
      count: 2,
      startPage: 3,
    });
    // roads: divider + 2 simple pages = 3 · επόμενη κατηγορία στη 6
    expect(model.toc.items[1]).toMatchObject({
      categoryId: 'regeneration',
      count: 1,
      startPage: 6,
    });
    expect(model.toc.projectCount).toBe(3);
    expect(model.toc.categoryCount).toBe(2);

    const noDiv = buildPresentationToc(
      model.sections,
      { sectionDividers: false },
      model.totals,
      model.period
    );
    expect(noDiv.items[0].startPage).toBe(3);
    // χωρίς divider: 2 σελίδες roads → regeneration στη 5
    expect(noDiv.items[1].startPage).toBe(5);
  });

  test('toc: μήνυμα Δημάρχου στη σελ. 3 και κατηγορίες από 4', () => {
    const report = {
      appearance: {
        mayorMessage: {
          enabled: true,
          mayorName: 'Γιάννης Παπαδόπουλος',
          text: 'Σύντομο μήνυμα για τον απολογισμό.',
          photo: { relativePath: 'appearance/mayor.jpg', focusX: 0.5, focusY: 0.4, zoom: 1 },
        },
      },
      cards: [
        readyCard({ id: '1', categoryId: 'roads', approvedAmount: '200.000,00' }),
        readyCard({ id: '2', categoryId: 'regeneration', approvedAmount: '30.000,00' }),
      ],
    };
    const model = buildPresentationModel(report, period);
    expect(model.mayorMessage).toMatchObject({
      enabled: true,
      title: 'Μήνυμα Δημάρχου',
      mayorName: 'Γιάννης Παπαδόπουλος',
      text: 'Σύντομο μήνυμα για τον απολογισμό.',
    });
    expect(model.toc.preface).toEqual([{ label: 'Μήνυμα Δημάρχου', startPage: 3 }]);
    expect(model.toc.items[0]).toMatchObject({ categoryId: 'roads', startPage: 4 });
    // roads divider+1 + regeneration divider → start 6
    expect(model.toc.items[1]).toMatchObject({ categoryId: 'regeneration', startPage: 6 });
  });

  test('toc: ημιτελές μήνυμα Δημάρχου δεν μπαίνει στην παρουσίαση', () => {
    const model = buildPresentationModel({
      appearance: {
        mayorMessage: {
          enabled: true,
          text: '',
          photo: null,
        },
      },
      cards: [readyCard({ id: '1', categoryId: 'roads' })],
    }, period);
    expect(model.mayorMessage).toEqual({ enabled: false });
    expect(model.toc.preface).toEqual([]);
    expect(model.toc.items[0].startPage).toBe(3);
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

  test('τελικό ποσό μετά ΑΠΕ εμφανίζεται στην παρουσίαση μόνο με flag', () => {
    const hidden = buildPresentationModel(
      {
        cards: [
          readyCard({
            primaryViz: 'economy_phases',
            finalContractAmountAfterApe: '95.000,00',
            showFinalContractAmountInPresentation: false,
          }),
        ],
      },
      period
    );
    expect(hidden.sections[0].cards[0].display.showFinalContractAmount).toBe(false);

    const shown = buildPresentationModel(
      {
        cards: [
          readyCard({
            primaryViz: 'economy_phases',
            finalContractAmountAfterApe: '95.000,00',
            finalContractApeDate: '2025-04-01',
            showFinalContractAmountInPresentation: true,
          }),
        ],
      },
      period
    );
    const entry = shown.sections[0].cards[0];
    expect(entry.display.showFinalContractAmount).toBe(true);
    expect(entry.display.finalContractAmountAfterApe).toMatch(/95/);
    expect(entry.display.finalContractAmountExplanation).toMatch(/αναθεωρήσεις/);
    const amountsPage = entry.contentPages.find((p) => p.type === 'amounts');
    expect(amountsPage.showFinalContractAmount).toBe(true);
    expect(amountsPage.finalContractAmountShortLabel).toMatch(/ΑΠΕ/);
  });
});

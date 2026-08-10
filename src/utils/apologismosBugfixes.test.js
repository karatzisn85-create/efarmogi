/**
 * @jest-environment node
 */
/* Regression tests για τα bugs που εντοπίστηκαν στον απολογισμό. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  hasUsableAmount,
  syncCardAmountsFromSubproject,
  canAddPhotoToPhase,
  removePhotoFromPhase,
  movePhotoToPrimary,
  mergePhotoPhases,
  resolveMediaPathSafe,
  getCardReadiness,
  MAX_PHOTOS_PER_PHASE,
} = require('../../public/apologismosDomain');
const {
  buildPresentationModel,
  buildVizContentPages,
  buildCardPresentationEntry,
  formatAmountEl,
} = require('../../public/apologismosPresentation');
const {
  ensureDirs,
  addFromSubproject,
  updateCard,
  saveCardPhoto,
  removeCardPhoto,
  reorderCardPhotoPrimary,
  loadPeriods,
  resolveMediaMap,
  resolveCardMediaAbsolute,
  sanitizeReportPhotos,
  enrichReportWithReadiness,
  loadReport,
  saveReport,
  APOLOGISMOS_FOLDER,
} = require('../../public/apologismosService');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'eh-apolog-fix-'));
}

describe('bugfix — ποσά linked δεν «κολλάνε» / sync δεν σβήνει χειροκίνητα', () => {
  test('hasUsableAmount: κενό/άκυρο = false, έγκυρο = true', () => {
    expect(hasUsableAmount('')).toBe(false);
    expect(hasUsableAmount(null)).toBe(false);
    expect(hasUsableAmount('abc')).toBe(false);
    expect(hasUsableAmount('0')).toBe(true);
    expect(hasUsableAmount('10.000,00')).toBe(true);
  });

  test('sync: κενό ποσό υποέργου δεν αντικαθιστά χειροκίνητη τιμή κάρτας', () => {
    const card = {
      source: 'linked',
      approvedAmount: '50.000,00',
      contractAmount: '40.000,00',
      amountChangedBadge: false,
    };
    const r = syncCardAmountsFromSubproject(card, {
      approvedAmount: '',
      contractAmount: '',
    });
    expect(r.changed).toBe(false);
    expect(r.card.approvedAmount).toBe('50.000,00');
    expect(r.card.contractAmount).toBe('40.000,00');
  });

  test('sync: πραγματική αλλαγή από υποέργο ενημερώνει και βάζει badge', () => {
    const card = {
      source: 'linked',
      approvedAmount: '50.000,00',
      contractAmount: '40.000,00',
      amountChangedBadge: false,
    };
    const r = syncCardAmountsFromSubproject(card, {
      approvedAmount: '60.000,00',
      contractAmount: '40.000,00',
    });
    expect(r.changed).toBe(true);
    expect(r.card.approvedAmount).toBe('60.000,00');
    expect(r.card.amountChangedBadge).toBe(true);
  });

  test('linked κάρτα με χειροκίνητα ποσά γίνεται ready', () => {
    const card = {
      source: 'linked',
      title: 'Έργο χωρίς ποσά στο υποέργο',
      categoryId: 'roads',
      narrative: 'Συμπληρώθηκαν ποσά στον απολογισμό.',
      approvedAmount: '1000',
      contractAmount: '900',
      primaryViz: 'simple_card',
      photos: {},
    };
    expect(getCardReadiness(card).ready).toBe(true);
  });
});

describe('bugfix — φωτογραφίες: όριο πριν την αντιγραφή, διαγραφή, κύρια', () => {
  test('canAddPhotoToPhase απορρίπτει όταν η φάση είναι γεμάτη', () => {
    const photos = { before: ['a', 'b', 'c'], during: [], after: [] };
    expect(canAddPhotoToPhase(photos, 'before').ok).toBe(false);
    expect(canAddPhotoToPhase(photos, 'after').ok).toBe(true);
    expect(canAddPhotoToPhase(photos, 'after').remaining).toBe(MAX_PHOTOS_PER_PHASE);
  });

  test('removePhotoFromPhase αφαιρεί σωστά', () => {
    const r = removePhotoFromPhase(
      { before: ['a.jpg', 'b.jpg'], during: [], after: [] },
      'before',
      'a.jpg'
    );
    expect(r.ok).toBe(true);
    expect(r.photos.before).toEqual(['b.jpg']);
  });

  test('movePhotoToPrimary βάζει τη φωτογραφία στη θέση 0', () => {
    const r = movePhotoToPrimary(
      { before: ['a.jpg', 'b.jpg', 'c.jpg'], during: [], after: [] },
      'before',
      'c.jpg'
    );
    expect(r.ok).toBe(true);
    expect(r.photos.before[0]).toBe('c.jpg');
    expect(r.photos.before).toEqual(['c.jpg', 'a.jpg', 'b.jpg']);
  });

  test('mergePhotoPhases δεν μηδενίζει φάσεις που δεν στάλθηκαν', () => {
    const merged = mergePhotoPhases(
      { before: ['a'], during: ['d'], after: ['z'] },
      { before: ['a', 'b'] }
    );
    expect(merged.before).toEqual(['a', 'b']);
    expect(merged.during).toEqual(['d']);
    expect(merged.after).toEqual(['z']);
  });

  test('saveCardPhoto δεν αντιγράφει όταν η φάση είναι γεμάτη (όχι orphan)', () => {
    const dataDir = tempDir();
    try {
      ensureDirs(dataDir);
      const periods = loadPeriods(dataDir);
      const periodId = periods[0].id;
      const added = addFromSubproject(dataDir, {
        periodId,
        subproject: {
          subprojectId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          projectId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          subprojectTitle: 'Photo test',
          projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ',
          approvedAmount: '1',
          contractAmount: '1',
        },
        epActions: [],
      });
      expect(added.success).toBe(true);
      const cardId = added.card.id;
      const src = path.join(dataDir, 'src.jpg');
      fs.writeFileSync(src, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

      const full = { before: ['x1', 'x2', 'x3'], during: [], after: [] };
      const blocked = saveCardPhoto(dataDir, {
        cardId,
        phase: 'before',
        sourcePath: src,
        fileName: 'extra.jpg',
        currentPhotos: full,
      });
      expect(blocked.success).toBe(false);
      const mediaBefore = path.join(dataDir, APOLOGISMOS_FOLDER, 'media', cardId, 'before');
      const files = fs.existsSync(mediaBefore) ? fs.readdirSync(mediaBefore) : [];
      expect(files.filter((f) => f.includes('extra'))).toHaveLength(0);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  test('removeCardPhoto + reorderCardPhotoPrimary end-to-end', () => {
    const dataDir = tempDir();
    try {
      ensureDirs(dataDir);
      const periods = loadPeriods(dataDir);
      const periodId = periods[0].id;
      const added = addFromSubproject(dataDir, {
        periodId,
        subproject: {
          subprojectId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          projectId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          subprojectTitle: 'Reorder test',
          projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ',
          approvedAmount: '2',
          contractAmount: '2',
        },
        epActions: [],
      });
      const cardId = added.card.id;
      const prepared = updateCard(dataDir, {
        periodId,
        cardId,
        patch: {
          categoryId: 'roads',
          narrative: 'Reorder test narrative.',
          primaryViz: 'after_only',
        },
      });
      expect(prepared.success).toBe(true);
      const src1 = path.join(dataDir, 'p1.jpg');
      const src2 = path.join(dataDir, 'p2.jpg');
      fs.writeFileSync(src1, Buffer.from([1]));
      fs.writeFileSync(src2, Buffer.from([2]));

      const a1 = saveCardPhoto(dataDir, {
        cardId, phase: 'after', sourcePath: src1, fileName: 'p1.jpg', currentPhotos: {},
      });
      expect(a1.success).toBe(true);
      let card = updateCard(dataDir, {
        periodId, cardId, patch: { photos: { after: [a1.relativePath] } },
      }).card;

      const a2 = saveCardPhoto(dataDir, {
        cardId, phase: 'after', sourcePath: src2, fileName: 'p2.jpg', currentPhotos: card.photos,
      });
      expect(a2.success).toBe(true);
      card = updateCard(dataDir, {
        periodId,
        cardId,
        patch: { photos: { after: [a1.relativePath, a2.relativePath] } },
      }).card;

      const reordered = reorderCardPhotoPrimary(dataDir, {
        periodId, cardId, phase: 'after', relativePath: a2.relativePath,
      });
      expect(reordered.success).toBe(true);
      expect(reordered.card.photos.after[0]).toBe(a2.relativePath);

      const removed = removeCardPhoto(dataDir, {
        periodId, cardId, phase: 'after', relativePath: a1.relativePath,
      });
      expect(removed.success).toBe(true);
      expect(removed.card.photos.after).toEqual([a2.relativePath]);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});

describe('bugfix — μορφοποίηση αριθμητικών συνόλων παρουσίασης', () => {
  test('σύνολα (number) δεν φουσκώνουν αφαιρώντας την υποδιαστολή', () => {
    // Παλιό bug: String(414482.279).replace(/\./g,'') → "414482279"
    const broken = Number(String(414482.279).replace(/\./g, '').replace(',', '.'));
    expect(broken).toBe(414482279);
    expect(formatAmountEl(414482.279)).toBe('414.482,28 €');
    expect(formatAmountEl(1962000.08)).toBe('1.962.000,08 €');
  });

  test('ελληνικές συμβολοσειρές ποσών συνεχίζουν να μορφοποιούνται σωστά', () => {
    expect(formatAmountEl('1.250.000,50')).toBe('1.250.000,50 €');
  });
});

describe('bugfix — secondary viz + παρουσίαση χάρτη/ποσών', () => {
  test('secondary viz δημιουργεί επιπλέον content pages', () => {
    const card = {
      title: 'Ανάπλαση',
      categoryId: 'regeneration',
      narrative: 'Κείμενο.',
      approvedAmount: '10',
      contractAmount: '9',
      primaryViz: 'simple_card',
      secondaryViz: 'economy_phases',
      photos: {},
      metrics: [],
      mapPoints: [],
    };
    expect(getCardReadiness(card).ready).toBe(true);
    const entry = buildCardPresentationEntry(card);
    expect(entry.contentPages.some((p) => p.role === 'primary')).toBe(true);
    expect(entry.contentPages.some((p) => p.role === 'secondary' && p.type === 'amounts')).toBe(true);
  });

  test('παλιά amount_compare μετατρέπεται σε economy_phases και παραμένει ready', () => {
    const { migrateDeprecatedVizIds } = require('../../public/apologismosDomain');
    const { card, changed } = migrateDeprecatedVizIds({
      title: 'Ανάπλαση',
      categoryId: 'regeneration',
      narrative: 'Κείμενο.',
      approvedAmount: '10',
      contractAmount: '9',
      primaryViz: 'after_only',
      secondaryViz: 'amount_compare',
      photos: { after: ['media/c/after/1.jpg'] },
      metrics: [],
      mapPoints: [],
    });
    expect(changed).toBe(true);
    expect(card.secondaryViz).toBe('economy_phases');
    expect(getCardReadiness(card).ready).toBe(true);
    expect(
      buildCardPresentationEntry(card).contentPages
        .some((p) => p.role === 'secondary' && p.type === 'amounts' && p.vizId === 'economy_phases')
    ).toBe(true);
  });

  test('secondary χάρτης/αποτελέσματα: με συμπληρωμένα δεδομένα γίνεται ready και βγάζει σελίδα', () => {
    const withMap = {
      title: 'Οδοποιία',
      categoryId: 'roads',
      narrative: 'Κείμενο.',
      approvedAmount: '10',
      contractAmount: '9',
      primaryViz: 'after_only',
      secondaryViz: 'map_multi',
      photos: { after: ['media/c/after/1.jpg'] },
      metrics: [],
      mapSnapshot: 'media/c/map/snapshot.png',
      mapDrawing: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { name: 'Α' }, geometry: { type: 'Point', coordinates: [25.1, 35.1] } },
          { type: 'Feature', properties: { name: 'Β' }, geometry: { type: 'Point', coordinates: [25.2, 35.2] } },
        ],
      },
      mapPoints: [{ lat: 35.1, lng: 25.1, label: 'Α' }, { lat: 35.2, lng: 25.2, label: 'Β' }],
    };
    expect(getCardReadiness(withMap).ready).toBe(true);
    expect(
      buildCardPresentationEntry(withMap).contentPages
        .some((p) => p.role === 'secondary' && p.type === 'map' && p.mapSnapshot === 'media/c/map/snapshot.png')
    ).toBe(true);

    // Χωρίς στιγμιότυπο, το ίδιο secondary μπλοκάρει την κάρτα με σαφές μήνυμα
    const noSnap = { ...withMap, mapSnapshot: null };
    const readiness = getCardReadiness(noSnap);
    expect(readiness.ready).toBe(false);
    expect(readiness.errors.join(' ')).toMatch(/δευτερεύουσα|χάρτη/i);

    const withMetrics = {
      ...withMap,
      secondaryViz: 'metrics_table',
      mapSnapshot: null,
      mapDrawing: { type: 'FeatureCollection', features: [] },
      mapPoints: [],
      metrics: [{ label: 'Μέτρα', value: '1200' }],
    };
    expect(getCardReadiness(withMetrics).ready).toBe(true);
    expect(
      buildCardPresentationEntry(withMetrics).contentPages
        .some((p) => p.role === 'secondary' && p.type === 'metrics' && p.metrics.length === 1)
    ).toBe(true);
  });

  test('secondary μόνο κείμενο: η σελίδα κρατά τονισμένο αφήγημα', () => {
    const card = {
      title: 'Πλατεία',
      categoryId: 'regeneration',
      narrative: 'Σύντομο κείμενο έργου.',
      approvedAmount: '100',
      contractAmount: '90',
      primaryViz: 'after_only',
      secondaryViz: 'simple_card',
      photos: { after: ['media/c/after/1.jpg'] },
      metrics: [],
      mapPoints: [],
    };
    expect(getCardReadiness(card).ready).toBe(true);
    const entry = buildCardPresentationEntry(card);
    expect(entry.display.showHeaderAmounts).toBe(true);
    const page = entry.contentPages
      .find((p) => p.role === 'secondary' && p.type === 'simple');
    expect(page).toBeTruthy();
    expect(page.narrative).toBe('Σύντομο κείμενο έργου.');
    expect(page.emphasizeNarrative).toBe(true);
  });

  test('map viz παράγει σελίδα map με σημεία', () => {
    const pages = buildVizContentPages({
      mapPoints: [{ lat: 35.1, lng: 25.1, label: 'Α' }, { lat: 35.2, lng: 25.2, label: 'Β' }],
      photos: {},
    }, 'map_multi', 'primary');
    expect(pages[0].type).toBe('map');
    expect(pages[0].mapPoints).toHaveLength(2);
  });

  test('model παρουσίασης περιλαμβάνει secondary pages', () => {
    const period = { id: '2024-2028', startYear: 2024, endYear: 2028, label: '2024–2028' };
    const model = buildPresentationModel({
      cards: [{
        id: '1',
        source: 'linked',
        title: 'Έργο',
        categoryId: 'roads',
        narrative: 'Ναι.',
        approvedAmount: '100',
        contractAmount: '90',
        primaryViz: 'simple_card',
        secondaryViz: 'economy_phases',
        photos: {},
      }],
    }, period);
    const pages = model.sections[0].cards[0].contentPages;
    expect(pages.filter((p) => p.role === 'secondary')).toHaveLength(1);
  });
});

describe('bugfix — path guard & media data URL', () => {
  test('resolveMediaPathSafe απορρίπτει traversal και prefix confusion', () => {
    const dataDir = 'C:\\data';
    const root = 'C:\\data\\ΑΠΟΛΟΓΙΣΜΟΣ';
    expect(resolveMediaPathSafe(dataDir, root, '..\\secret.txt').ok).toBe(false);
    expect(resolveMediaPathSafe(dataDir, root, 'media/card/a.jpg').ok).toBe(true);
  });

  test('resolveMediaMap asDataUrl επιστρέφει data: URL', () => {
    const dataDir = tempDir();
    try {
      ensureDirs(dataDir);
      const periods = loadPeriods(dataDir);
      const periodId = periods[0].id;
      const added = addFromSubproject(dataDir, {
        periodId,
        subproject: {
          subprojectId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          projectId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          subprojectTitle: 'Media',
          projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ',
          approvedAmount: '1',
          contractAmount: '1',
        },
        epActions: [],
      });
      const src = path.join(dataDir, 'm.jpg');
      fs.writeFileSync(src, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
      const saved = saveCardPhoto(dataDir, {
        cardId: added.card.id,
        phase: 'after',
        sourcePath: src,
        fileName: 'm.jpg',
        currentPhotos: {},
      });
      expect(saved.success).toBe(true);
      const map = resolveMediaMap(dataDir, [saved.relativePath], { asDataUrl: true });
      expect(map[saved.relativePath]).toMatch(/^data:image\/jpeg;base64,/);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  test('λήψη φωτογραφίας: resolveCardMediaAbsolute δίνει υπαρκτό αρχείο, όχι traversal', () => {
    const dataDir = tempDir();
    try {
      ensureDirs(dataDir);
      const periods = loadPeriods(dataDir);
      const added = addFromSubproject(dataDir, {
        periodId: periods[0].id,
        subproject: {
          subprojectId: '11111111-1111-1111-1111-111111111111',
          projectId: '22222222-2222-2222-2222-222222222222',
          subprojectTitle: 'Λήψη',
          projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ',
          approvedAmount: '1',
          contractAmount: '1',
        },
        epActions: [],
      });
      const src = path.join(dataDir, 'download.jpg');
      fs.writeFileSync(src, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
      const saved = saveCardPhoto(dataDir, {
        cardId: added.card.id,
        phase: 'after',
        sourcePath: src,
        fileName: 'download.jpg',
        currentPhotos: {},
      });
      expect(saved.success).toBe(true);
      const abs = resolveCardMediaAbsolute(dataDir, saved.relativePath);
      expect(abs).toBeTruthy();
      expect(fs.existsSync(abs)).toBe(true);
      expect(resolveCardMediaAbsolute(dataDir, '..\\..\\users.json')).toBeNull();
      expect(resolveCardMediaAbsolute(dataDir, '../../users.json')).toBeNull();
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  test('ίδιο basename σε διαδοχικές αποθηκεύσεις → μοναδικά paths', () => {
    const dataDir = tempDir();
    try {
      ensureDirs(dataDir);
      const periods = loadPeriods(dataDir);
      const periodId = periods[0].id;
      const added = addFromSubproject(dataDir, {
        periodId,
        subproject: {
          subprojectId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          projectId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          subprojectTitle: 'Unique names',
          projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ',
          approvedAmount: '1',
          contractAmount: '1',
        },
        epActions: [],
      });
      const cardId = added.card.id;
      const src = path.join(dataDir, 'same.jpg');
      fs.writeFileSync(src, Buffer.from([1, 2, 3]));
      const a = saveCardPhoto(dataDir, {
        cardId, phase: 'after', sourcePath: src, fileName: 'same.jpg', currentPhotos: {},
      });
      const b = saveCardPhoto(dataDir, {
        cardId, phase: 'after', sourcePath: src, fileName: 'same.jpg',
        currentPhotos: { after: [a.relativePath] },
      });
      const c = saveCardPhoto(dataDir, {
        cardId, phase: 'after', sourcePath: src, fileName: 'same.jpg',
        currentPhotos: { after: [a.relativePath, b.relativePath] },
      });
      expect(a.success && b.success && c.success).toBe(true);
      const paths = [a.relativePath, b.relativePath, c.relativePath];
      expect(new Set(paths).size).toBe(3);
      paths.forEach((p) => expect(fs.existsSync(path.join(dataDir, APOLOGISMOS_FOLDER, p))).toBe(true));
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  test('ο τρόπος προβολής παραμένει μετά από αποθήκευση φωτογραφίας', () => {
    const dataDir = tempDir();
    try {
      ensureDirs(dataDir);
      const periodId = loadPeriods(dataDir)[0].id;
      const added = addFromSubproject(dataDir, {
        periodId,
        subproject: {
          subprojectId: '33333333-3333-3333-3333-333333333333',
          projectId: '44444444-4444-4444-4444-444444444444',
          subprojectTitle: 'Keep viz',
          projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ',
          approvedAmount: '10',
          contractAmount: '9',
        },
        epActions: [],
      });
      const cardId = added.card.id;
      const saved = updateCard(dataDir, {
        periodId,
        cardId,
        patch: {
          categoryId: 'roads',
          narrative: 'Αναβάθμιση οδού.',
          primaryViz: 'before_after',
          secondaryViz: 'economy_phases',
        },
      });
      expect(saved.card.primaryViz).toBe('before_after');

      const src = path.join(dataDir, 'v.jpg');
      fs.writeFileSync(src, Buffer.from([9]));
      const photo = saveCardPhoto(dataDir, {
        cardId, phase: 'before', sourcePath: src, fileName: 'v.jpg', currentPhotos: saved.card.photos,
      });
      const afterPhoto = updateCard(dataDir, {
        periodId,
        cardId,
        patch: { photos: { before: [photo.relativePath] } },
      });
      expect(afterPhoto.card.primaryViz).toBe('before_after');
      expect(afterPhoto.card.secondaryViz).toBe('economy_phases');
      expect(afterPhoto.card.narrative).toBe('Αναβάθμιση οδού.');
      expect(afterPhoto.card.photos.before).toEqual([photo.relativePath]);

      const reloaded = loadReport(dataDir, periodId).report.cards.find((c) => c.id === cardId);
      expect(reloaded.primaryViz).toBe('before_after');
      expect(reloaded.secondaryViz).toBe('economy_phases');
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  test('sanitizeReportPhotos καθαρίζει διπλότυπα στον δίσκο', () => {
    const dataDir = tempDir();
    try {
      ensureDirs(dataDir);
      const periods = loadPeriods(dataDir);
      const periodId = periods[0].id;
      const added = addFromSubproject(dataDir, {
        periodId,
        subproject: {
          subprojectId: '11111111-1111-1111-1111-111111111111',
          projectId: '22222222-2222-2222-2222-222222222222',
          subprojectTitle: 'Dup cleanup',
          projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ',
          approvedAmount: '1',
          contractAmount: '1',
        },
        epActions: [],
      });
      const dupPath = 'media/' + added.card.id + '/after/same.jpg';
      const loaded = loadReport(dataDir, periodId);
      const dirty = {
        ...loaded.report,
        cards: loaded.report.cards.map((c) => (
          c.id === added.card.id
            ? { ...c, photos: { before: [], during: [], after: [dupPath, dupPath, dupPath] } }
            : c
        )),
      };
      saveReport(dataDir, dirty);
      const reloaded = loadReport(dataDir, periodId);
      expect(reloaded.report.cards[0].photos.after).toHaveLength(3);
      const sanitized = sanitizeReportPhotos(dataDir, reloaded.report);
      expect(sanitized.changed).toBe(true);
      expect(sanitized.report.cards[0].photos.after).toEqual([dupPath]);
      const enriched = enrichReportWithReadiness(sanitized.report);
      expect(enriched.cards[0].photos.after).toHaveLength(1);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});

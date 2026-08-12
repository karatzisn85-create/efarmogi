/**
 * @jest-environment node
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ensureDirs,
  loadPeriods,
  loadReport,
  addFromSubproject,
  addLegacyCard,
  syncAmounts,
  dismissBadge,
  removeCard,
  updateCard,
  enrichReportWithReadiness,
  removeCardPhoto,
  saveCoverImage,
  updateAppearance,
  APOLOGISMOS_FOLDER,
} = require('../../public/apologismosService');
const { buildPresentationModel } = require('../../public/apologismosPresentation');
const domain = require('../../public/apologismosDomain');

function tempDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'eh-apolog-'));
}

describe('apologismosService — persistence & flow', () => {
  let dataDir;
  beforeEach(() => {
    dataDir = tempDataDir();
  });
  afterEach(() => {
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch (_) {}
  });

  test('ensureDirs + default period 2024-2028', () => {
    ensureDirs(dataDir);
    expect(fs.existsSync(path.join(dataDir, APOLOGISMOS_FOLDER))).toBe(true);
    const periods = loadPeriods(dataDir);
    expect(periods.some((p) => p.startYear === 2024 && p.endYear === 2028)).toBe(true);
  });

  test('add linked + reject duplicate + sync badge + dismiss + remove', () => {
    const periods = loadPeriods(dataDir);
    const periodId = periods[0].id;
    const sub = {
      subprojectId: '11111111-1111-1111-1111-111111111111',
      projectId: '22222222-2222-2222-2222-222222222222',
      subprojectTitle: 'Δοκιμαστικό έργο',
      projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ',
      approvedAmount: '100.000,00',
      contractAmount: '90.000,00',
    };
    const added = addFromSubproject(dataDir, { periodId, subproject: sub, epActions: [{ objectiveCode: '1.3.1' }] });
    expect(added.success).toBe(true);
    expect(added.card.suggestedCategoryId).toBe('roads');

    const dup = addFromSubproject(dataDir, { periodId, subproject: sub, epActions: [] });
    expect(dup.success).toBe(false);

    const synced = syncAmounts(dataDir, {
      periodId,
      subprojectById: {
        [sub.subprojectId]: { ...sub, approvedAmount: '120.000,00' },
      },
    });
    expect(synced.changed).toBe(true);
    const card = synced.report.cards[0];
    expect(card.amountChangedBadge).toBe(true);
    expect(card.approvedAmount).toBe('120.000,00');

    const dismissed = dismissBadge(dataDir, { periodId, cardId: card.id });
    expect(dismissed.card.amountChangedBadge).toBe(false);

    const removed = removeCard(dataDir, { periodId, cardId: card.id });
    expect(removed.success).toBe(true);
    expect(removed.report.cards).toHaveLength(0);
  });

  test('legacy εκτός περιόδου απορρίπτεται· εντός προστίθεται χωρίς subprojectId', () => {
    const periods = loadPeriods(dataDir);
    const periodId = periods[0].id;
    const bad = addLegacyCard(dataDir, {
      periodId,
      input: {
        title: 'Παλιό',
        area: 'Αρχάνες',
        completionYear: 2019,
        approvedAmount: '10',
        contractAmount: '9',
      },
    });
    expect(bad.success).toBe(false);

    const ok = addLegacyCard(dataDir, {
      periodId,
      input: {
        title: 'Παλιό 2025',
        area: 'Αρχάνες',
        completionYear: 2025,
        approvedAmount: '10',
        contractAmount: '9',
      },
    });
    expect(ok.success).toBe(true);
    expect(ok.card.source).toBe('legacy');
    expect(ok.card.subprojectId).toBe(null);
  });

  test('loadReport επιστρέφει enriched readiness', () => {
    const periods = loadPeriods(dataDir);
    const loaded = loadReport(dataDir, periods[0].id);
    expect(loaded.success).toBe(true);
    const enriched = enrichReportWithReadiness(loaded.report);
    expect(Array.isArray(enriched.cards)).toBe(true);
  });

  test('presentation model για εξαγωγή PDF/PPTX έχει ενότητες και ποσά', () => {
    const period = { id: '2024-2028', startYear: 2024, endYear: 2028, label: '2024–2028' };
    const report = {
      cards: [{
        id: 'c1',
        source: 'linked',
        title: 'Έργο',
        categoryId: 'roads',
        narrative: 'Κείμενο.',
        approvedAmount: '1000',
        contractAmount: '900',
        primaryViz: 'simple_card',
        photos: {},
      }],
    };
    const model = buildPresentationModel(report, period);
    expect(model.totals.projectCount).toBe(1);
    expect(model.sections).toHaveLength(1);
    expect(model.sections[0].cards[0].display.title).toBe('Έργο');
    expect(model.sections[0].totalApproved).toBe(1000);
  });

  test('updateCard: αφαίρεση τρόπου παρουσίασης καθαρίζει media από δίσκο', () => {
    const periods = loadPeriods(dataDir);
    const periodId = periods[0].id;
    const added = addLegacyCard(dataDir, {
      periodId,
      input: {
        title: 'Έργο με φωτο',
        area: 'Αρχάνες',
        completionYear: 2025,
        approvedAmount: '10',
        contractAmount: '9',
      },
    });
    expect(added.success).toBe(true);
    const cardId = added.card.id;
    const root = path.join(dataDir, APOLOGISMOS_FOLDER);
    const beforeRel = `media/${cardId}/before/a.jpg`;
    const afterRel = `media/${cardId}/after/c.jpg`;
    const mapRel = `media/${cardId}/map/snap.png`;
    for (const rel of [beforeRel, afterRel, mapRel]) {
      const abs = path.join(root, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, 'x');
    }

    const withAssets = updateCard(dataDir, {
      periodId,
      cardId,
      patch: {
        primaryViz: 'before_after',
        secondaryViz: 'map_path',
        photos: {
          before: [beforeRel],
          during: [],
          after: [afterRel],
        },
        mapSnapshot: mapRel,
        mapDrawing: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: { name: 'Α' },
            geometry: { type: 'Point', coordinates: [25, 35] },
          }],
        },
        metrics: [{ label: 'Μήκος', value: '1' }],
      },
    });
    expect(withAssets.success).toBe(true);
    expect(withAssets.card.photos.before).toEqual([beforeRel]);
    expect(fs.existsSync(path.join(root, beforeRel))).toBe(true);
    expect(fs.existsSync(path.join(root, mapRel))).toBe(true);

    const cleared = updateCard(dataDir, {
      periodId,
      cardId,
      patch: {
        primaryViz: '',
        secondaryViz: null,
      },
    });
    expect(cleared.success).toBe(true);
    expect(cleared.card.primaryViz).toBe('');
    expect(cleared.card.photos).toEqual({ before: [], during: [], after: [] });
    expect(cleared.card.metrics).toEqual([]);
    expect(cleared.card.mapSnapshot).toBe(null);
    expect(cleared.card.mapDrawing).toEqual(domain.emptyMapDrawing());
    expect(fs.existsSync(path.join(root, beforeRel))).toBe(false);
    expect(fs.existsSync(path.join(root, afterRel))).toBe(false);
    expect(fs.existsSync(path.join(root, mapRel))).toBe(false);
    expect(fs.existsSync(path.join(root, 'media', cardId))).toBe(false);
  });

  test('updateCard: αλλαγή σε simple_card αφήνει μόνο κείμενο — χωρίς φωτο/μετρικές', () => {
    const periods = loadPeriods(dataDir);
    const periodId = periods[0].id;
    const added = addLegacyCard(dataDir, {
      periodId,
      input: {
        title: 'Έργο Β',
        area: 'Κουνάβοι',
        completionYear: 2026,
        approvedAmount: '20',
        contractAmount: '18',
      },
    });
    const cardId = added.card.id;
    const root = path.join(dataDir, APOLOGISMOS_FOLDER);
    const beforeRel = `media/${cardId}/before/a.jpg`;
    fs.mkdirSync(path.dirname(path.join(root, beforeRel)), { recursive: true });
    fs.writeFileSync(path.join(root, beforeRel), 'x');

    updateCard(dataDir, {
      periodId,
      cardId,
      patch: {
        primaryViz: 'before_after',
        photos: { before: [beforeRel], during: [], after: [] },
        metrics: [{ label: 'Α', value: '1' }],
      },
    });

    const next = updateCard(dataDir, {
      periodId,
      cardId,
      patch: { primaryViz: 'simple_card', secondaryViz: null },
    });
    expect(next.card.primaryViz).toBe('simple_card');
    expect(next.card.photos.before).toEqual([]);
    expect(next.card.metrics).toEqual([]);
    expect(fs.existsSync(path.join(root, beforeRel))).toBe(false);
  });

  test('updateCard silent (pruneUnusedVisuals:false) δεν διαγράφει media — ρητή αποθήκευση καθαρίζει', () => {
    const periods = loadPeriods(dataDir);
    const periodId = periods[0].id;
    const added = addLegacyCard(dataDir, {
      periodId,
      input: {
        title: 'Silent prune guard',
        area: 'Αρχάνες',
        completionYear: 2025,
        approvedAmount: '10',
        contractAmount: '9',
      },
    });
    const cardId = added.card.id;
    const root = path.join(dataDir, APOLOGISMOS_FOLDER);
    const beforeRel = `media/${cardId}/before/a.jpg`;
    const afterRel = `media/${cardId}/after/c.jpg`;
    for (const rel of [beforeRel, afterRel]) {
      const abs = path.join(root, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, 'x');
    }
    updateCard(dataDir, {
      periodId,
      cardId,
      patch: {
        primaryViz: 'before_after',
        photos: { before: [beforeRel], during: [], after: [afterRel] },
      },
    });

    const silent = updateCard(dataDir, {
      periodId,
      cardId,
      patch: { primaryViz: 'after_only', secondaryViz: null },
      pruneUnusedVisuals: false,
    });
    expect(silent.success).toBe(true);
    expect(silent.card.primaryViz).toBe('after_only');
    // Χωρίς prune: τα before παραμένουν στο JSON και στον δίσκο
    expect(silent.card.photos.before).toEqual([beforeRel]);
    expect(fs.existsSync(path.join(root, beforeRel))).toBe(true);
    expect(fs.existsSync(path.join(root, afterRel))).toBe(true);

    const explicit = updateCard(dataDir, {
      periodId,
      cardId,
      patch: { primaryViz: 'after_only' },
      pruneUnusedVisuals: true,
    });
    expect(explicit.card.photos.before).toEqual([]);
    expect(explicit.card.photos.after).toEqual([afterRel]);
    expect(fs.existsSync(path.join(root, beforeRel))).toBe(false);
    expect(fs.existsSync(path.join(root, afterRel))).toBe(true);
  });

  test('updateCard φωτογραφιών χωρίς prune δεν σβήνει άλλες φάσεις — ρητή αποθήκευση καθαρίζει', () => {
    const periods = loadPeriods(dataDir);
    const periodId = periods[0].id;
    const added = addLegacyCard(dataDir, {
      periodId,
      input: {
        title: 'Photo no prune',
        area: 'Αρχάνες',
        completionYear: 2025,
        approvedAmount: '10',
        contractAmount: '9',
      },
    });
    const cardId = added.card.id;
    const root = path.join(dataDir, APOLOGISMOS_FOLDER);
    const beforeRel = `media/${cardId}/before/a.jpg`;
    const afterRel = `media/${cardId}/after/c.jpg`;
    for (const rel of [beforeRel, afterRel]) {
      const abs = path.join(root, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, 'x');
    }
    updateCard(dataDir, {
      periodId,
      cardId,
      patch: {
        primaryViz: 'before_after',
        photos: { before: [beforeRel], during: [], after: [afterRel] },
      },
    });
    updateCard(dataDir, {
      periodId,
      cardId,
      patch: { primaryViz: 'after_only' },
      pruneUnusedVisuals: false,
    });
    const afterUpload = updateCard(dataDir, {
      periodId,
      cardId,
      patch: { photos: { after: [afterRel] } },
      pruneUnusedVisuals: false,
    });
    expect(afterUpload.card.photos.before).toEqual([beforeRel]);
    expect(fs.existsSync(path.join(root, beforeRel))).toBe(true);

    const explicit = updateCard(dataDir, {
      periodId,
      cardId,
      patch: { primaryViz: 'after_only' },
      pruneUnusedVisuals: true,
    });
    expect(explicit.card.photos.before).toEqual([]);
    expect(fs.existsSync(path.join(root, beforeRel))).toBe(false);
  });

  test('loadReport: χαλασμένο JSON δεν αντικαθίσταται με κενό', () => {
    const periods = loadPeriods(dataDir);
    const periodId = periods[0].id;
    addLegacyCard(dataDir, {
      periodId,
      input: {
        title: 'Keep me',
        area: 'Αρχάνες',
        completionYear: 2025,
        approvedAmount: '10',
        contractAmount: '9',
      },
    });
    const reportFile = path.join(dataDir, APOLOGISMOS_FOLDER, 'reports', `${periodId}.json`);
    fs.writeFileSync(reportFile, '{not-json');
    const loaded = loadReport(dataDir, periodId);
    expect(loaded.success).toBe(false);
    expect(String(loaded.error || '')).toMatch(/ανάγνωσης|έγκυρο|JSON|Unexpected/i);
    expect(fs.readFileSync(reportFile, 'utf8')).toBe('{not-json');
  });

  test('loadReport: μετάβαση από καταργημένο viz καθαρίζει άσχετα media', () => {
    const periods = loadPeriods(dataDir);
    const periodId = periods[0].id;
    const added = addLegacyCard(dataDir, {
      periodId,
      input: {
        title: 'Deprecated viz',
        area: 'Αρχάνες',
        completionYear: 2025,
        approvedAmount: '10',
        contractAmount: '9',
      },
    });
    const cardId = added.card.id;
    const root = path.join(dataDir, APOLOGISMOS_FOLDER);
    const beforeRel = `media/${cardId}/before/a.jpg`;
    const abs = path.join(root, beforeRel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, 'x');

    // Χειροκίνητα γράφουμε παλιό amount_compare + φωτο στο report
    const reportPath = path.join(root, 'reports', `${periodId}.json`);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const idx = report.cards.findIndex((c) => c.id === cardId);
    report.cards[idx] = {
      ...report.cards[idx],
      primaryViz: 'amount_compare',
      photos: { before: [beforeRel], during: [], after: [] },
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    const loaded = loadReport(dataDir, periodId);
    expect(loaded.success).toBe(true);
    const card = loaded.report.cards.find((c) => c.id === cardId);
    expect(card.primaryViz).toBe('economy_phases');
    expect(card.photos.before).toEqual([]);
    expect(fs.existsSync(abs)).toBe(false);
  });

  test('removeCardPhoto αφαιρεί και άδειο φάκελο φάσης όταν δεν μένει τίποτα', () => {
    const periods = loadPeriods(dataDir);
    const periodId = periods[0].id;
    const added = addLegacyCard(dataDir, {
      periodId,
      input: {
        title: 'Empty folder cleanup',
        area: 'Αρχάνες',
        completionYear: 2025,
        approvedAmount: '10',
        contractAmount: '9',
      },
    });
    const cardId = added.card.id;
    const root = path.join(dataDir, APOLOGISMOS_FOLDER);
    updateCard(dataDir, {
      periodId,
      cardId,
      patch: { primaryViz: 'after_only', narrative: 'Κείμενο έργου.' },
    });
    const afterRel = `media/${cardId}/after/only.jpg`;
    const abs = path.join(root, afterRel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, 'x');
    updateCard(dataDir, {
      periodId,
      cardId,
      patch: { photos: { after: [afterRel] } },
    });

    const removed = removeCardPhoto(dataDir, {
      periodId, cardId, phase: 'after', relativePath: afterRel,
    });
    expect(removed.success).toBe(true);
    expect(fs.existsSync(abs)).toBe(false);
    expect(fs.existsSync(path.join(root, 'media', cardId, 'after'))).toBe(false);
  });

  test('saveCoverImage χωρίς commit δεν αλλάζει την αναφορά· updateAppearance καθαρίζει orphans', async () => {
    const periods = loadPeriods(dataDir);
    const periodId = periods[0].id;
    ensureDirs(dataDir);
    const src = path.join(dataDir, 'cover-src.jpg');
    fs.writeFileSync(src, Buffer.from([1, 2, 3]));

    const staged = await saveCoverImage(dataDir, {
      periodId,
      sourcePath: src,
      fileName: 'cover-src.jpg',
      slotIndex: 0,
      commitToReport: false,
    });
    expect(staged.success).toBe(true);
    expect(staged.relativePath).toMatch(/^appearance\//);
    const abs = path.join(dataDir, APOLOGISMOS_FOLDER, staged.relativePath);
    expect(fs.existsSync(abs)).toBe(true);

    const beforeCommit = loadReport(dataDir, periodId);
    expect(beforeCommit.report.appearance.coverImages || []).toEqual([]);

    const committed = updateAppearance(dataDir, {
      periodId,
      patch: {
        coverImages: [{
          relativePath: staged.relativePath,
          focusX: 0.5,
          focusY: 0.5,
          zoom: 1,
          slot: 0,
        }],
      },
    });
    expect(committed.success).toBe(true);
    expect(committed.appearance.coverImages[0].relativePath).toBe(staged.relativePath);

    const orphanSrc = path.join(dataDir, 'orphan.jpg');
    fs.writeFileSync(orphanSrc, Buffer.from([9]));
    const orphan = await saveCoverImage(dataDir, {
      periodId,
      sourcePath: orphanSrc,
      fileName: 'orphan.jpg',
      slotIndex: 0,
      commitToReport: false,
    });
    expect(fs.existsSync(path.join(dataDir, APOLOGISMOS_FOLDER, orphan.relativePath))).toBe(true);

    const restored = updateAppearance(dataDir, {
      periodId,
      patch: {
        coverImages: committed.appearance.coverImages,
      },
    });
    expect(restored.success).toBe(true);
    expect(fs.existsSync(path.join(dataDir, APOLOGISMOS_FOLDER, orphan.relativePath))).toBe(false);
    expect(fs.existsSync(abs)).toBe(true);
  });

  test('resolveMediaMap preview είναι ελαφρύτερο από full όταν υπάρχει μεγάλη εικόνα', async () => {
    const { saveCardPhoto, resolveMediaMap } = require('../../public/apologismosService');
    let sharp;
    try {
      sharp = require('sharp');
      await sharp({
        create: { width: 8, height: 8, channels: 3, background: { r: 0, g: 0, b: 0 } },
      }).png().toBuffer();
    } catch (_) {
      expect(true).toBe(true);
      return;
    }

    ensureDirs(dataDir);
    const periods = loadPeriods(dataDir);
    const periodId = periods[0].id;
    const added = addFromSubproject(dataDir, {
      periodId,
      subproject: {
        subprojectId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        projectId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        subprojectTitle: 'Preview media',
        projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ',
        approvedAmount: '1',
        contractAmount: '1',
      },
      epActions: [],
    });
    const src = path.join(dataDir, 'big.png');
    await sharp({
      create: {
        width: 1600,
        height: 1200,
        channels: 3,
        background: { r: 10, g: 80, b: 140 },
      },
    }).png().toFile(src);

    const saved = await saveCardPhoto(dataDir, {
      cardId: added.card.id,
      phase: 'after',
      sourcePath: src,
      fileName: 'big.png',
      currentPhotos: {},
    });
    expect(saved.success).toBe(true);

    const fullMap = await resolveMediaMap(dataDir, [saved.relativePath], {
      asDataUrl: true,
      variant: 'full',
    });
    const previewMap = await resolveMediaMap(dataDir, [saved.relativePath], {
      asDataUrl: true,
      variant: 'preview',
    });
    const fullUrl = fullMap[saved.relativePath];
    const previewUrl = previewMap[saved.relativePath];
    expect(fullUrl).toMatch(/^data:image\//);
    expect(previewUrl).toMatch(/^data:image\/jpeg/);
    expect(previewUrl.length).toBeLessThan(fullUrl.length);
  });
});

/**
 * @jest-environment node
 */
const {
  DEFAULT_PALETTE_ID,
  DEFAULT_COVER_LAYOUT_ID,
  normalizeAppearance,
  resolveOrganizationTitle,
  coverImageWarnings,
  normalizeCoverImage,
} = require('../../public/apologismosAppearance');
const { buildPresentationModel } = require('../../public/apologismosPresentation');
const domain = require('../../public/apologismosDomain');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ensureDirs,
  loadPeriods,
  updateAppearance,
  saveCoverImage,
  APOLOGISMOS_FOLDER,
} = require('../../public/apologismosService');

describe('apologismosAppearance', () => {
  test('normalizeAppearance: defaults και άγνωστα ids → fallback', () => {
    expect(normalizeAppearance(null)).toEqual({
      paletteId: DEFAULT_PALETTE_ID,
      coverLayoutId: DEFAULT_COVER_LAYOUT_ID,
      subtitle: '',
      coverImages: [],
      motionEnabled: false,
      motionStyle: 'fade',
      textScale: 'normal',
      footerMode: 'full',
      sectionDividers: true,
      coverStats: true,
      updatedAt: null,
    });
    const bad = normalizeAppearance({
      paletteId: 'neon_pink',
      coverLayoutId: 'unknown',
      subtitle: '  Hello  ',
      coverImages: [{ relativePath: '../escape.jpg', focusX: 2, zoom: 9 }],
      motionEnabled: 'yes',
      motionStyle: 'bounce',
    });
    expect(bad.paletteId).toBe(DEFAULT_PALETTE_ID);
    expect(bad.coverLayoutId).toBe(DEFAULT_COVER_LAYOUT_ID);
    expect(bad.subtitle).toBe('Hello');
    expect(bad.coverImages).toEqual([]);
    expect(bad.motionEnabled).toBe(false);
    expect(bad.motionStyle).toBe('fade');
  });

  test('motionEnabled true και resolveMotion', () => {
    const { resolveMotion } = require('../../public/apologismosAppearance');
    const a = normalizeAppearance({ motionEnabled: true, motionStyle: 'fade' });
    expect(a.motionEnabled).toBe(true);
    expect(resolveMotion(a)).toEqual({ enabled: true, style: 'fade' });
    expect(resolveMotion(null)).toEqual({ enabled: false, style: 'fade' });
  });

  test('resolveOrganizationTitle: fullName / name+type / κενό', () => {
    expect(resolveOrganizationTitle({ organizationFullName: 'Δήμος Αρχανών Αστερουσίων' }))
      .toBe('Δήμος Αρχανών Αστερουσίων');
    expect(resolveOrganizationTitle({ organizationName: 'Αρχανών Αστερουσίων', organizationType: 'Δήμος' }))
      .toBe('Δήμος Αρχανών Αστερουσίων');
    expect(resolveOrganizationTitle({ organizationName: 'Δήμος Ηρακλείου' }))
      .toBe('Δήμος Ηρακλείου');
    expect(resolveOrganizationTitle({})).toBe('');
  });

  test('cover layout απαιτεί 1 ή 2 εικόνες σωστά', () => {
    expect(coverImageWarnings({ coverLayoutId: 'hero_single', coverImages: [] })).toHaveLength(1);
    expect(coverImageWarnings({
      coverLayoutId: 'hero_single',
      coverImages: [{ relativePath: 'appearance/a.jpg' }],
    })).toHaveLength(0);
    expect(coverImageWarnings({
      coverLayoutId: 'hero_split',
      coverImages: [{ relativePath: 'appearance/a.jpg' }],
    }).some((w) => w.includes('2'))).toBe(true);
    expect(coverImageWarnings({
      coverLayoutId: 'hero_split',
      coverImages: [
        { relativePath: 'appearance/a.jpg' },
        { relativePath: 'appearance/b.jpg' },
      ],
    })).toHaveLength(0);
  });

  test('2η φωτογραφία κρατά το slot της όταν λείπει η 1η', () => {
    const { coverImagesBySlot, buildCoverDisplay } = require('../../public/apologismosAppearance');
    const a = normalizeAppearance({
      coverLayoutId: 'hero_split',
      coverImages: [{ relativePath: 'appearance/only-second.jpg', slot: 1, focusX: 0.3, focusY: 0.7, zoom: 1.2 }],
    });
    expect(a.coverImages).toHaveLength(1);
    expect(a.coverImages[0].slot).toBe(1);
    const slots = coverImagesBySlot(a);
    expect(slots[0]).toBeNull();
    expect(slots[1].relativePath).toBe('appearance/only-second.jpg');
    const cover = buildCoverDisplay({ appearance: a, period: { label: 'Π' }, organizationTitle: 'Δ' });
    expect(cover.images[0]).toBeNull();
    expect(cover.images[1].relativePath).toBe('appearance/only-second.jpg');
  });

  test('normalizeCoverImage path guards', () => {
    expect(normalizeCoverImage({ relativePath: 'media/x.jpg' })).toBeNull();
    expect(normalizeCoverImage({ relativePath: '../appearance/x.jpg' })).toBeNull();
    expect(normalizeCoverImage({ relativePath: '/appearance/x.jpg' })).toBeNull();
    const ok = normalizeCoverImage({
      relativePath: 'appearance/cover.jpg',
      focusX: 0.2,
      focusY: 0.8,
      zoom: 1.5,
    });
    expect(ok).toEqual({
      relativePath: 'appearance/cover.jpg',
      focusX: 0.2,
      focusY: 0.8,
      zoom: 1.5,
    });
  });

  test('presentation model περιέχει theme + cover', () => {
    const period = {
      id: '2024-2028',
      startYear: 2024,
      endYear: 2028,
      label: 'Δημοτική περίοδος 2024–2028',
    };
    const report = {
      appearance: {
        paletteId: 'charcoal_gold',
        coverLayoutId: 'hero_side',
        subtitle: 'Τεχνικό έργο',
        coverImages: [{ relativePath: 'appearance/c1.jpg', focusX: 0.4, focusY: 0.6, zoom: 1.2 }],
      },
      cards: [{
        id: 'c1',
        title: 'Έργο',
        categoryId: 'roads',
        narrative: 'Ναι',
        approvedAmount: '10.000,00',
        contractAmount: '9.000,00',
        primaryViz: 'simple_card',
        photos: {},
      }],
    };
    const model = buildPresentationModel(report, period, {
      appConfig: { organizationFullName: 'Δήμος Αρχανών Αστερουσίων' },
    });
    expect(model.theme.accent).toBe('#d4a017');
    expect(model.theme.darkBand).toBe('#18181b');
    expect(model.cover.layoutId).toBe('hero_side');
    expect(model.cover.organizationTitle).toBe('Δήμος Αρχανών Αστερουσίων');
    expect(model.cover.subtitle).toBe('Τεχνικό έργο');
    expect(model.cover.images).toHaveLength(1);
    expect(model.appearance.paletteId).toBe('charcoal_gold');
  });

  test('resolveMediaPathSafe απορρίπτει path traversal για appearance', () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eh-appear-'));
    try {
      const root = path.join(dataDir, APOLOGISMOS_FOLDER);
      fs.mkdirSync(path.join(root, 'appearance'), { recursive: true });
      const bad = domain.resolveMediaPathSafe(dataDir, root, '../users.json');
      expect(bad.ok).toBe(false);
      const ok = domain.resolveMediaPathSafe(dataDir, root, 'appearance/cover.jpg');
      expect(ok.ok).toBe(true);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  test('updateAppearance + saveCoverImage με path guard', () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eh-appear2-'));
    try {
      ensureDirs(dataDir);
      const periods = loadPeriods(dataDir);
      const periodId = periods[0].id;
      const updated = updateAppearance(dataDir, {
        periodId,
        patch: { paletteId: 'tech_green', coverLayoutId: 'hero_split', subtitle: 'Demo' },
      });
      expect(updated.success).toBe(true);
      expect(updated.appearance.paletteId).toBe('tech_green');
      expect(updated.appearance.coverLayoutId).toBe('hero_split');

      const src = path.join(dataDir, 'source.png');
      fs.writeFileSync(src, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const saved = saveCoverImage(dataDir, {
        periodId,
        sourcePath: src,
        fileName: 'source.png',
        slotIndex: 1,
      });
      expect(saved.success).toBe(true);
      expect(saved.relativePath.startsWith('appearance/')).toBe(true);
      expect(saved.appearance.coverImages).toHaveLength(1);
      expect(saved.appearance.coverImages[0].slot).toBe(1);
      expect(saved.appearance.coverImages[0].relativePath).toBe(saved.relativePath);
      expect(fs.existsSync(path.join(dataDir, APOLOGISMOS_FOLDER, saved.relativePath))).toBe(true);
      const { coverImagesBySlot } = require('../../public/apologismosAppearance');
      const slots = coverImagesBySlot(saved.appearance);
      expect(slots[0]).toBeNull();
      expect(slots[1].relativePath).toBe(saved.relativePath);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});

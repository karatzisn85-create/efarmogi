/**
 * @jest-environment node
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  loadMunicipalUnitsConfig,
  saveMunicipalUnitsConfig,
  normalizeUnits,
  resolveLogoPathSafe,
  saveMunicipalityLogo,
  clearMunicipalityLogo,
  getMunicipalityLogoDataUrl,
} = require('../../public/municipalUnitsConfigService');

function makeTempDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'municipal-units-'));
}

describe('municipalUnitsConfigService', () => {
  let dataDir;

  beforeEach(() => {
    dataDir = makeTempDataDir();
  });

  afterEach(() => {
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch (_) {}
  });

  test('normalizeUnits: trim, dedupe, ελληνική ταξινόμηση', () => {
    expect(normalizeUnits(['  Β  ', 'Α', 'β', '', null])).toEqual(['Α', 'Β']);
  });

  test('save/load units διατηρεί λογότυπο όταν δεν περνάει logoRelativePath', () => {
    saveMunicipalUnitsConfig(dataDir, { units: ['Κεντρική'], logoRelativePath: null });
    const brandingDir = path.join(dataDir, 'config', 'branding');
    fs.mkdirSync(brandingDir, { recursive: true });
    const logoAbs = path.join(brandingDir, 'municipality-logo_test.png');
    // 1x1 PNG
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(logoAbs, png);
    saveMunicipalUnitsConfig(dataDir, {
      units: ['Κεντρική'],
      logoRelativePath: 'branding/municipality-logo_test.png',
    });
    const afterUnitsOnly = saveMunicipalUnitsConfig(dataDir, { units: ['Ανατολική', 'Κεντρική'] });
    expect(afterUnitsOnly.units).toEqual(['Ανατολική', 'Κεντρική']);
    expect(afterUnitsOnly.logoRelativePath).toBe('branding/municipality-logo_test.png');
  });

  test('resolveLogoPathSafe απορρίπτει traversal', () => {
    expect(resolveLogoPathSafe(dataDir, '../escape.png').ok).toBe(false);
    expect(resolveLogoPathSafe(dataDir, 'branding/ok.png').ok).toBe(true);
  });

  test('saveMunicipalityLogo + getMunicipalityLogoDataUrl + clear', async () => {
    const src = path.join(dataDir, 'src-logo.png');
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(src, png);

    const saved = await saveMunicipalityLogo(dataDir, { sourcePath: src, fileName: 'src-logo.png' });
    expect(saved.success).toBe(true);
    expect(saved.relativePath).toMatch(/^branding\/municipality-logo_/);

    const got = getMunicipalityLogoDataUrl(dataDir);
    expect(got.dataUrl).toMatch(/^data:image\/png;base64,/);

    const cleared = clearMunicipalityLogo(dataDir);
    expect(cleared.success).toBe(true);
    expect(cleared.config.logoRelativePath).toBe(null);
    expect(getMunicipalityLogoDataUrl(dataDir).dataUrl).toBe(null);
    expect(loadMunicipalUnitsConfig(dataDir).units).toEqual([]);
  });

  test('backward compat: save με array units', () => {
    const cfg = saveMunicipalUnitsConfig(dataDir, ['Ζώνη Α', 'Ζώνη Β']);
    expect(cfg.units).toEqual(['Ζώνη Α', 'Ζώνη Β']);
    expect(cfg.logoRelativePath).toBe(null);
  });

  test('attachMunicipalityBranding: μόνο με opt-in και υπάρχον λογότυπο', async () => {
    const brandingDir = makeTempDataDir();
    try {
      const src = path.join(brandingDir, 'src-logo.png');
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
      );
      fs.writeFileSync(src, png);
      await saveMunicipalityLogo(brandingDir, { sourcePath: src, fileName: 'src-logo.png' });

      const { buildPresentationModel: buildModel } = require('../../public/apologismosService');
      const period = { id: 'p', startYear: 2024, endYear: 2028, label: 'Π' };
      const reportOff = {
        appearance: { showMunicipalityLogo: false },
        cards: [],
      };
      const off = buildModel(reportOff, period, {}, brandingDir);
      expect(off.branding).toEqual({ showLogo: false, logoDataUrl: null });

      const reportOn = {
        appearance: { showMunicipalityLogo: true },
        cards: [],
      };
      const on = buildModel(reportOn, period, {}, brandingDir);
      expect(on.branding.showLogo).toBe(true);
      expect(on.branding.logoDataUrl).toMatch(/^data:image\//);
    } finally {
      try { fs.rmSync(brandingDir, { recursive: true, force: true }); } catch (_) {}
    }
  });
});

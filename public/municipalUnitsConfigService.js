/**
 * Δημοτικές ενότητες δήμου + λογότυπο — ρύθμιση από SUPERADMIN.
 * Αποθήκευση: {dataDir}/config/municipal-units.json
 * Λογότυπο: {dataDir}/config/branding/municipality-logo.*
 */
const fs = require('fs');
const path = require('path');
const { safeWriteJSON } = require('./safeWrite');
const mediaIngest = require('./apologismosMediaIngest');

const CONFIG_DIR = 'config';
const CONFIG_FILE = 'municipal-units.json';
const BRANDING_DIR = 'branding';
const LOGO_REL_PREFIX = 'branding/';

function defaultConfig() {
  return {
    units: [],
    logoRelativePath: null,
    updatedAt: null,
  };
}

function getConfigDir(dataDir) {
  return path.join(dataDir, CONFIG_DIR);
}

function getConfigPath(dataDir) {
  return path.join(getConfigDir(dataDir), CONFIG_FILE);
}

function getBrandingDir(dataDir) {
  return path.join(getConfigDir(dataDir), BRANDING_DIR);
}

function normalizeUnits(units) {
  const seen = new Set();
  const result = [];
  for (const item of units || []) {
    const label = String(item || '').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  result.sort((a, b) => a.localeCompare(b, 'el', { sensitivity: 'base' }));
  return result;
}

function pathInsideRoot(rootResolved, childResolved) {
  const root = process.platform === 'win32'
    ? String(rootResolved || '').toLowerCase()
    : String(rootResolved || '');
  const child = process.platform === 'win32'
    ? String(childResolved || '').toLowerCase()
    : String(childResolved || '');
  const rootSep = root.endsWith(path.sep) ? root : root + path.sep;
  return child === root || child.startsWith(rootSep);
}

/**
 * Ασφαλές relative path λογοτύπου υπό config/.
 * @returns {{ ok: true, relativePath: string, resolved: string }|{ ok: false, error: string }}
 */
function resolveLogoPathSafe(dataDir, relativePath) {
  const rel = String(relativePath || '').replace(/\\/g, '/').trim();
  if (!rel) return { ok: false, error: 'Κενό path λογοτύπου' };
  if (rel.includes('..') || path.isAbsolute(rel) || rel.startsWith('/')) {
    return { ok: false, error: 'Μη επιτρεπτό path λογοτύπου' };
  }
  if (!rel.startsWith(LOGO_REL_PREFIX)) {
    return { ok: false, error: 'Το λογότυπο πρέπει να βρίσκεται στο branding/' };
  }
  const configDir = path.resolve(getConfigDir(dataDir));
  const resolved = path.resolve(configDir, rel);
  if (!pathInsideRoot(configDir, resolved)) {
    return { ok: false, error: 'Μη επιτρεπτό path λογοτύπου' };
  }
  if (!pathInsideRoot(path.resolve(dataDir), resolved)) {
    return { ok: false, error: 'Μη επιτρεπτό path λογοτύπου' };
  }
  return { ok: true, relativePath: rel, resolved };
}

function normalizeLogoRelativePath(dataDir, rawPath) {
  if (!rawPath) return null;
  const guard = resolveLogoPathSafe(dataDir, rawPath);
  if (!guard.ok) return null;
  if (!fs.existsSync(guard.resolved)) return null;
  return guard.relativePath;
}

function loadMunicipalUnitsConfig(dataDir) {
  try {
    const p = getConfigPath(dataDir);
    if (!fs.existsSync(p)) return defaultConfig();
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return {
      units: normalizeUnits(raw.units),
      logoRelativePath: normalizeLogoRelativePath(dataDir, raw.logoRelativePath),
      updatedAt: raw.updatedAt || null,
    };
  } catch {
    return defaultConfig();
  }
}

/**
 * @param {string} dataDir
 * @param {string[]|{ units?: string[], logoRelativePath?: string|null }} input
 */
function saveMunicipalUnitsConfig(dataDir, input = {}) {
  if (Array.isArray(input)) {
    input = { units: input };
  }
  const dir = getConfigDir(dataDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const prev = loadMunicipalUnitsConfig(dataDir);
  const units = Object.prototype.hasOwnProperty.call(input, 'units')
    ? normalizeUnits(input.units)
    : prev.units;

  let logoRelativePath = prev.logoRelativePath;
  if (Object.prototype.hasOwnProperty.call(input, 'logoRelativePath')) {
    logoRelativePath = input.logoRelativePath
      ? normalizeLogoRelativePath(dataDir, input.logoRelativePath)
      : null;
  }

  const config = {
    units,
    logoRelativePath,
    updatedAt: new Date().toISOString(),
  };
  safeWriteJSON(getConfigPath(dataDir), config);
  return config;
}

function mediaFileToDataUrl(absolutePath) {
  if (!absolutePath || !fs.existsSync(absolutePath)) return null;
  const ext = path.extname(absolutePath).toLowerCase().replace('.', '');
  const mime = ext === 'png' ? 'image/png'
    : ext === 'webp' ? 'image/webp'
      : ext === 'gif' ? 'image/gif'
        : 'image/jpeg';
  const buf = fs.readFileSync(absolutePath);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

const LOGO_MAX_DIMENSION = 1200;

/**
 * PNG/WebP διατηρούν διαφάνεια· JPEG μέσω κοινής συμπίεσης φωτογραφιών.
 * @returns {Promise<{ destAbs: string, destName: string, compressed: boolean, fallbackCopy: boolean }>}
 */
async function ingestLogoToBrandingDir(sourcePath, brandingDir, fileName) {
  const ext = path.extname(sourcePath || '').toLowerCase();
  const stamp = Date.now();
  if (ext === '.png' || ext === '.webp') {
    const outExt = ext === '.webp' ? '.webp' : '.png';
    const destName = `municipality-logo_${stamp}${outExt}`;
    const destAbs = path.join(brandingDir, destName);
    try {
      const sharp = require('sharp');
      let pipeline = sharp(sourcePath)
        .rotate()
        .resize({
          width: LOGO_MAX_DIMENSION,
          height: LOGO_MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        });
      if (outExt === '.png') pipeline = pipeline.png({ compressionLevel: 8 });
      else pipeline = pipeline.webp({ quality: 88 });
      await pipeline.toFile(destAbs);
      return { destAbs, destName, compressed: true, fallbackCopy: false };
    } catch (_) {
      fs.copyFileSync(sourcePath, destAbs);
      return { destAbs, destName, compressed: false, fallbackCopy: true };
    }
  }
  return mediaIngest.ingestImageToDir(
    sourcePath,
    brandingDir,
    `municipality-logo_${stamp}_`,
    String(fileName || path.basename(sourcePath) || 'logo.jpg'),
    { maxDimension: LOGO_MAX_DIMENSION }
  );
}

/**
 * @returns {Promise<{ success: true, config: object, relativePath: string }|{ success: false, error: string }>}
 */
async function saveMunicipalityLogo(dataDir, { sourcePath, fileName } = {}) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return { success: false, error: 'Δεν βρέθηκε αρχείο πηγής' };
  }
  const brandingDir = getBrandingDir(dataDir);
  if (!fs.existsSync(brandingDir)) fs.mkdirSync(brandingDir, { recursive: true });

  const ingest = await ingestLogoToBrandingDir(sourcePath, brandingDir, fileName);
  const relativePath = `${LOGO_REL_PREFIX}${ingest.destName}`;
  const guard = resolveLogoPathSafe(dataDir, relativePath);
  if (!guard.ok) {
    try { if (fs.existsSync(ingest.destAbs)) fs.unlinkSync(ingest.destAbs); } catch (_) {}
    return { success: false, error: guard.error };
  }

  const prev = loadMunicipalUnitsConfig(dataDir);
  if (prev.logoRelativePath && prev.logoRelativePath !== relativePath) {
    const old = resolveLogoPathSafe(dataDir, prev.logoRelativePath);
    if (old.ok && fs.existsSync(old.resolved)) {
      try { fs.unlinkSync(old.resolved); } catch (_) {}
    }
  }

  const config = saveMunicipalUnitsConfig(dataDir, {
    units: prev.units,
    logoRelativePath: relativePath,
  });
  return {
    success: true,
    config,
    relativePath,
    compressed: ingest.compressed,
    fallbackCopy: ingest.fallbackCopy,
  };
}

function clearMunicipalityLogo(dataDir) {
  const prev = loadMunicipalUnitsConfig(dataDir);
  if (prev.logoRelativePath) {
    const old = resolveLogoPathSafe(dataDir, prev.logoRelativePath);
    if (old.ok && fs.existsSync(old.resolved)) {
      try { fs.unlinkSync(old.resolved); } catch (_) {}
    }
  }
  const config = saveMunicipalUnitsConfig(dataDir, {
    units: prev.units,
    logoRelativePath: null,
  });
  return { success: true, config };
}

function getMunicipalityLogoDataUrl(dataDir) {
  const config = loadMunicipalUnitsConfig(dataDir);
  if (!config.logoRelativePath) return { success: true, dataUrl: null, relativePath: null };
  const guard = resolveLogoPathSafe(dataDir, config.logoRelativePath);
  if (!guard.ok || !fs.existsSync(guard.resolved)) {
    return { success: true, dataUrl: null, relativePath: null };
  }
  return {
    success: true,
    dataUrl: mediaFileToDataUrl(guard.resolved),
    relativePath: config.logoRelativePath,
  };
}

module.exports = {
  CONFIG_DIR,
  CONFIG_FILE,
  LOGO_REL_PREFIX,
  defaultConfig,
  loadMunicipalUnitsConfig,
  saveMunicipalUnitsConfig,
  normalizeUnits,
  resolveLogoPathSafe,
  saveMunicipalityLogo,
  clearMunicipalityLogo,
  getMunicipalityLogoDataUrl,
};

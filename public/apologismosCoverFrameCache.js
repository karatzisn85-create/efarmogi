/**
 * Cache καδραρισμένων JPEG εξωφύλλου/δημάρχου για εξαγωγή PDF/PPTX.
 * Αποφεύγει επανυπολογισμό sharp όταν πηγή + focus/zoom/στόχος δεν άλλαξαν.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const coverFrame = require('./apologismosCoverFrame');

const COVER_FRAME_CACHE_VERSION = 1;
const CACHE_FOLDER = path.join('cache', 'cover-frames');

function roundFocus(n, fallback = 0.5) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.round(Math.min(1, Math.max(0, x)) * 1000) / 1000;
}

function roundZoom(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 1;
  return Math.round(Math.min(2, Math.max(1, x)) * 1000) / 1000;
}

/**
 * Σταθερό κλειδί cache από παραμέτρους καδραρίσματος.
 * @param {{
 *   relativePath?: string,
 *   absolutePath?: string,
 *   mtimeMs?: number,
 *   size?: number,
 *   focusX?: number,
 *   focusY?: number,
 *   zoom?: number,
 *   width: number,
 *   height: number,
 *   background?: string,
 *   channel?: string,
 * }} parts
 * @returns {string} hex sha1
 */
function buildCoverFrameCacheKey(parts) {
  const payload = [
    `v${COVER_FRAME_CACHE_VERSION}`,
    String(parts.relativePath || parts.absolutePath || '').replace(/\\/g, '/'),
    String(Math.round(Number(parts.mtimeMs) || 0)),
    String(Math.round(Number(parts.size) || 0)),
    String(roundFocus(parts.focusX)),
    String(roundFocus(parts.focusY)),
    String(roundZoom(parts.zoom)),
    String(Math.round(Number(parts.width) || 0)),
    String(Math.round(Number(parts.height) || 0)),
    String(parts.background || '#1e293b').toLowerCase(),
    String(parts.channel || 'pdf'),
  ].join('|');
  return crypto.createHash('sha1').update(payload).digest('hex');
}

function getCoverFrameCacheDir(apologismosRoot) {
  const dir = path.join(apologismosRoot, CACHE_FOLDER);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cacheFilePath(apologismosRoot, key) {
  const safe = String(key || '').replace(/[^a-f0-9]/gi, '');
  if (safe.length < 16) return null;
  return path.join(getCoverFrameCacheDir(apologismosRoot), `${safe}.jpg`);
}

/**
 * Διαβάζει cached JPEG αν υπάρχει.
 * @returns {Buffer|null}
 */
function readCoverFrameCache(apologismosRoot, key) {
  const fp = cacheFilePath(apologismosRoot, key);
  if (!fp || !fs.existsSync(fp)) return null;
  try {
    return fs.readFileSync(fp);
  } catch (_) {
    return null;
  }
}

function writeCoverFrameCache(apologismosRoot, key, buffer) {
  const fp = cacheFilePath(apologismosRoot, key);
  if (!fp || !Buffer.isBuffer(buffer) || buffer.length < 32) return false;
  try {
    const tmp = `${fp}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, buffer);
    fs.renameSync(tmp, fp);
    return true;
  } catch (_) {
    try {
      fs.writeFileSync(fp, buffer);
      return true;
    } catch (e2) {
      return false;
    }
  }
}

/**
 * Σβήνει όλο το cache καδραρισμάτων (π.χ. μετά από αλλαγή εμφάνισης).
 */
function invalidateCoverFrameCache(apologismosRoot) {
  const dir = path.join(apologismosRoot, CACHE_FOLDER);
  if (!fs.existsSync(dir)) return { success: true, removed: 0 };
  let removed = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (_) {
    return { success: true, removed: 0 };
  }
  for (const name of entries) {
    if (!/\.jpe?g$/i.test(name) && !/\.tmp$/i.test(name)) continue;
    try {
      fs.unlinkSync(path.join(dir, name));
      removed += 1;
    } catch (_) {}
  }
  return { success: true, removed };
}

/**
 * Επιστρέφει Buffer καδραρίσματος από cache ή νέο render.
 * @returns {Promise<{ buffer: Buffer, cacheHit: boolean }>}
 */
async function getOrRenderCoverFrame(apologismosRoot, absolutePath, opts, {
  relativePath = '',
  channel = 'pdf',
} = {}) {
  let mtimeMs = 0;
  let size = 0;
  try {
    const st = fs.statSync(absolutePath);
    mtimeMs = st.mtimeMs;
    size = st.size;
  } catch (_) {}

  const key = buildCoverFrameCacheKey({
    relativePath: relativePath || absolutePath,
    mtimeMs,
    size,
    focusX: opts.focusX,
    focusY: opts.focusY,
    zoom: opts.zoom,
    width: opts.width,
    height: opts.height,
    background: opts.background,
    channel,
  });

  const cached = readCoverFrameCache(apologismosRoot, key);
  if (cached) {
    return { buffer: cached, cacheHit: true, key };
  }

  const buffer = await coverFrame.renderCoverFrame(absolutePath, opts);
  writeCoverFrameCache(apologismosRoot, key, buffer);
  return { buffer, cacheHit: false, key };
}

module.exports = {
  COVER_FRAME_CACHE_VERSION,
  CACHE_FOLDER,
  buildCoverFrameCacheKey,
  getCoverFrameCacheDir,
  readCoverFrameCache,
  writeCoverFrameCache,
  invalidateCoverFrameCache,
  getOrRenderCoverFrame,
};

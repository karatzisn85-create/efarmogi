/**
 * Συμπίεση / όριο διάστασης φωτογραφιών Απολογισμού κατά την εισαγωγή
 * και ελαφριές προεπισκοπήσεις για οθόνη (πλήρη αρχεία μόνο στην εξαγωγή).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/** Μέγιστη πλευρά σε pixels — ~150–200 dpi σε διαφάνεια 16:9 χωρίς υπερβολικό βάρος. */
const MAX_INGEST_DIMENSION = 2400;
const INGEST_JPEG_QUALITY = 85;

/** Προεπισκόπηση οθόνης — πλάτος καμβά διαφάνειας 960. */
const PREVIEW_MAX_DIMENSION = 960;
const PREVIEW_JPEG_QUALITY = 72;
const PREVIEW_CACHE_VERSION = 1;
const PREVIEW_CACHE_FOLDER = path.join('cache', 'preview-thumbs');

/**
 * Κανονικοποιεί όνομα αρχείου εισαγωγής σε `.jpg` (όταν η συμπίεση πετύχει).
 * @param {string} fileName
 * @returns {string}
 */
function normalizeIngestJpegFileName(fileName) {
  const raw = String(fileName || 'photo.jpg').replace(/[<>:"/\\|?*]/g, '_').slice(0, 80);
  const base = raw.replace(/\.[^.]+$/i, '') || 'photo';
  return `${base}.jpg`;
}

/**
 * Ασφαλές basename με διατήρηση επέκτασης πηγής (για fallback αντιγραφή).
 * @param {string} fileName
 * @param {string} [sourcePath]
 * @returns {string}
 */
function normalizeIngestKeepExtFileName(fileName, sourcePath = '') {
  const raw = String(fileName || path.basename(sourcePath) || 'photo.bin')
    .replace(/[<>:"/\\|?*]/g, '_')
    .slice(0, 80);
  const extMatch = raw.match(/(\.[a-z0-9]{1,8})$/i);
  const fromSource = path.extname(sourcePath || '');
  const ext = (extMatch ? extMatch[1] : fromSource) || '.bin';
  const base = raw.replace(/\.[^.]+$/i, '') || 'photo';
  return `${base}${ext.toLowerCase()}`;
}

/**
 * Κλειδί cache προεπισκόπησης από πηγή + μέγεθος/mtime.
 * @param {{ absolutePath: string, mtimeMs?: number, size?: number, maxDimension?: number }} parts
 * @returns {string}
 */
function buildPreviewThumbCacheKey(parts) {
  const maxDim = Math.max(64, Math.round(Number(parts.maxDimension) || PREVIEW_MAX_DIMENSION));
  const payload = [
    `v${PREVIEW_CACHE_VERSION}`,
    String(parts.absolutePath || '').replace(/\\/g, '/').toLowerCase(),
    String(Math.round(Number(parts.mtimeMs) || 0)),
    String(Math.round(Number(parts.size) || 0)),
    String(maxDim),
  ].join('|');
  return crypto.createHash('sha1').update(payload).digest('hex');
}

function getPreviewThumbCacheDir(apologismosRoot) {
  const dir = path.join(apologismosRoot, PREVIEW_CACHE_FOLDER);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function previewThumbCachePath(apologismosRoot, key) {
  const safe = String(key || '').replace(/[^a-f0-9]/gi, '');
  if (safe.length < 16) return null;
  return path.join(getPreviewThumbCacheDir(apologismosRoot), `${safe}.jpg`);
}

/**
 * @param {string} sourcePath
 * @param {string} destAbs
 * @param {{ maxDimension?: number, quality?: number }} [opts]
 * @returns {Promise<{ compressed: boolean, bytesWritten: number, fallbackCopy: boolean }>}
 */
async function compressImageForIngest(sourcePath, destAbs, {
  maxDimension = MAX_INGEST_DIMENSION,
  quality = INGEST_JPEG_QUALITY,
} = {}) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error('Δεν βρέθηκε αρχείο πηγής');
  }
  const destDir = path.dirname(destAbs);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  const sharp = require('sharp');
  const maxDim = Math.max(64, Math.round(Number(maxDimension) || MAX_INGEST_DIMENSION));
  const q = Math.min(95, Math.max(40, Math.round(Number(quality) || INGEST_JPEG_QUALITY)));

  await sharp(sourcePath)
    .rotate()
    .resize({
      width: maxDim,
      height: maxDim,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: q, mozjpeg: true })
    .toFile(destAbs);

  const st = fs.statSync(destAbs);
  return { compressed: true, bytesWritten: st.size, fallbackCopy: false };
}

/**
 * Συμπίεση σε JPEG· σε αποτυχία αντιγράφει με την αρχική επέκταση (όχι ψεύτικο .jpg).
 * @param {string} sourcePath
 * @param {string} destDir
 * @param {string} uniquePrefix π.χ. `${Date.now()}_${uuid8}_`
 * @param {string} fileName
 * @param {{ maxDimension?: number, quality?: number }} [opts]
 * @returns {Promise<{ destAbs: string, destName: string, compressed: boolean, fallbackCopy: boolean, bytesWritten: number }>}
 */
async function ingestImageToDir(sourcePath, destDir, uniquePrefix, fileName, opts = {}) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error('Δεν βρέθηκε αρχείο πηγής');
  }
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  const jpegName = `${uniquePrefix}${normalizeIngestJpegFileName(fileName || path.basename(sourcePath))}`;
  const jpegAbs = path.join(destDir, jpegName);
  try {
    const result = await compressImageForIngest(sourcePath, jpegAbs, opts);
    return {
      destAbs: jpegAbs,
      destName: jpegName,
      compressed: true,
      fallbackCopy: false,
      bytesWritten: result.bytesWritten,
    };
  } catch (_) {
    const keepName = `${uniquePrefix}${normalizeIngestKeepExtFileName(fileName, sourcePath)}`;
    const keepAbs = path.join(destDir, keepName);
    fs.copyFileSync(sourcePath, keepAbs);
    const st = fs.statSync(keepAbs);
    return {
      destAbs: keepAbs,
      destName: keepName,
      compressed: false,
      fallbackCopy: true,
      bytesWritten: st.size,
    };
  }
}

/**
 * @deprecated προτιμήστε ingestImageToDir — κρατείται για συμβατότητα tests.
 */
async function ingestImageToPath(sourcePath, destAbs, opts = {}) {
  try {
    return await compressImageForIngest(sourcePath, destAbs, opts);
  } catch (_) {
    fs.copyFileSync(sourcePath, destAbs);
    const st = fs.statSync(destAbs);
    return { compressed: false, bytesWritten: st.size, fallbackCopy: true };
  }
}

/**
 * Επιστρέφει απόλυτο path προεπισκόπησης (cache) ή το πρωτότυπο αν αποτύχει.
 * @param {string} apologismosRoot
 * @param {string} absolutePath
 * @param {{ maxDimension?: number, quality?: number }} [opts]
 * @returns {Promise<{ path: string, fromCache: boolean, created: boolean, fallbackOriginal: boolean }>}
 */
async function ensurePreviewThumb(apologismosRoot, absolutePath, {
  maxDimension = PREVIEW_MAX_DIMENSION,
  quality = PREVIEW_JPEG_QUALITY,
} = {}) {
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return {
      path: absolutePath || null,
      fromCache: false,
      created: false,
      fallbackOriginal: true,
    };
  }

  let mtimeMs = 0;
  let size = 0;
  try {
    const st = fs.statSync(absolutePath);
    mtimeMs = st.mtimeMs;
    size = st.size;
  } catch (_) {
    return {
      path: absolutePath,
      fromCache: false,
      created: false,
      fallbackOriginal: true,
    };
  }

  const maxDim = Math.max(64, Math.round(Number(maxDimension) || PREVIEW_MAX_DIMENSION));
  const key = buildPreviewThumbCacheKey({
    absolutePath,
    mtimeMs,
    size,
    maxDimension: maxDim,
  });
  const cachePath = previewThumbCachePath(apologismosRoot, key);
  if (cachePath && fs.existsSync(cachePath)) {
    return {
      path: cachePath,
      fromCache: true,
      created: false,
      fallbackOriginal: false,
    };
  }

  try {
    await compressImageForIngest(absolutePath, cachePath, {
      maxDimension: maxDim,
      quality: Math.min(92, Math.max(40, Math.round(Number(quality) || PREVIEW_JPEG_QUALITY))),
    });
    return {
      path: cachePath,
      fromCache: false,
      created: true,
      fallbackOriginal: false,
    };
  } catch (_) {
    return {
      path: absolutePath,
      fromCache: false,
      created: false,
      fallbackOriginal: true,
    };
  }
}

module.exports = {
  MAX_INGEST_DIMENSION,
  INGEST_JPEG_QUALITY,
  PREVIEW_MAX_DIMENSION,
  PREVIEW_JPEG_QUALITY,
  PREVIEW_CACHE_VERSION,
  PREVIEW_CACHE_FOLDER,
  normalizeIngestJpegFileName,
  normalizeIngestKeepExtFileName,
  buildPreviewThumbCacheKey,
  getPreviewThumbCacheDir,
  compressImageForIngest,
  ingestImageToPath,
  ingestImageToDir,
  ensurePreviewThumb,
};

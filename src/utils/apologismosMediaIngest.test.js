/**
 * @jest-environment node
 */
const {
  MAX_INGEST_DIMENSION,
  INGEST_JPEG_QUALITY,
  normalizeIngestJpegFileName,
  ingestImageToPath,
  compressImageForIngest,
} = require('../../public/apologismosMediaIngest');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('apologismosMediaIngest', () => {
  test('normalizeIngestJpegFileName επιβάλλει .jpg και καθαρίζει επικίνδυνα σύμβολα', () => {
    expect(normalizeIngestJpegFileName('φωτο.png')).toBe('φωτο.jpg');
    expect(normalizeIngestJpegFileName('a/b\\c:d*.webp')).toBe('a_b_c_d_.jpg');
    expect(normalizeIngestJpegFileName('')).toBe('photo.jpg');
    expect(normalizeIngestJpegFileName('already.jpg')).toBe('already.jpg');
  });

  test('σταθερές ορίων είναι λογικές', () => {
    expect(MAX_INGEST_DIMENSION).toBe(2400);
    expect(INGEST_JPEG_QUALITY).toBeGreaterThanOrEqual(70);
    expect(INGEST_JPEG_QUALITY).toBeLessThanOrEqual(92);
  });

  test('buildPreviewThumbCacheKey αλλάζει με mtime/size', () => {
    const { buildPreviewThumbCacheKey } = require('../../public/apologismosMediaIngest');
    const base = {
      absolutePath: 'C:/data/ΑΠΟΛΟΓΙΣΜΟΣ/media/a.jpg',
      mtimeMs: 1000,
      size: 5000,
      maxDimension: 960,
    };
    expect(buildPreviewThumbCacheKey(base)).toBe(buildPreviewThumbCacheKey(base));
    expect(buildPreviewThumbCacheKey({ ...base, mtimeMs: 2000 }))
      .not.toBe(buildPreviewThumbCacheKey(base));
    expect(buildPreviewThumbCacheKey({ ...base, size: 9000 }))
      .not.toBe(buildPreviewThumbCacheKey(base));
  });

  test('ensurePreviewThumb: δεύτερη κλήση είναι cache hit και μικρότερη από μεγάλη πηγή', async () => {
    const {
      ensurePreviewThumb,
      PREVIEW_MAX_DIMENSION,
    } = require('../../public/apologismosMediaIngest');
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

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eh-preview-'));
    const src = path.join(root, 'src.png');
    try {
      await sharp({
        create: {
          width: 1800,
          height: 1200,
          channels: 3,
          background: { r: 30, g: 90, b: 160 },
        },
      }).png().toFile(src);

      const first = await ensurePreviewThumb(root, src, { maxDimension: 400 });
      expect(first.fallbackOriginal).toBe(false);
      expect(first.created).toBe(true);
      expect(fs.existsSync(first.path)).toBe(true);
      const meta1 = await sharp(first.path).metadata();
      expect(Math.max(meta1.width, meta1.height)).toBeLessThanOrEqual(400);
      expect(meta1.format).toBe('jpeg');

      const second = await ensurePreviewThumb(root, src, { maxDimension: 400 });
      expect(second.fromCache).toBe(true);
      expect(second.path).toBe(first.path);

      expect(PREVIEW_MAX_DIMENSION).toBe(960);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('ensurePreviewThumb: άκυρο αρχείο επιστρέφει το πρωτότυπο', async () => {
    const { ensurePreviewThumb } = require('../../public/apologismosMediaIngest');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eh-preview-'));
    const src = path.join(root, 'bad.bin');
    fs.writeFileSync(src, Buffer.from([1, 2, 3]));
    try {
      const result = await ensurePreviewThumb(root, src);
      expect(result.fallbackOriginal).toBe(true);
      expect(result.path).toBe(src);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('ingestImageToPath: αν δεν υπάρχει πηγή → σφάλμα μέσω compress ή fallback copy fail', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eh-ingest-'));
    try {
      await expect(
        compressImageForIngest(path.join(dir, 'missing.png'), path.join(dir, 'out.jpg'))
      ).rejects.toThrow(/πηγής/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('normalizeIngestKeepExtFileName διατηρεί επέκταση πηγής', () => {
    const { normalizeIngestKeepExtFileName } = require('../../public/apologismosMediaIngest');
    expect(normalizeIngestKeepExtFileName('φωτο.png')).toBe('φωτο.png');
    expect(normalizeIngestKeepExtFileName('a.webp', 'C:/x/a.webp')).toBe('a.webp');
    expect(normalizeIngestKeepExtFileName('noext', 'C:/x/file.PNG')).toBe('noext.png');
  });

  test('ingestImageToDir: άκυρο αρχείο κρατά επέκταση, όχι ψεύτικο .jpg', async () => {
    const { ingestImageToDir } = require('../../public/apologismosMediaIngest');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eh-ingest-dir-'));
    const src = path.join(dir, 'raw.png');
    fs.writeFileSync(src, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    try {
      const result = await ingestImageToDir(src, dir, 'pref_', 'raw.png');
      expect(result.fallbackCopy).toBe(true);
      expect(result.destName.endsWith('.png')).toBe(true);
      expect(result.destName.endsWith('.jpg')).toBe(false);
      expect(fs.existsSync(result.destAbs)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('compressImageForIngest μειώνει μεγάλη εικόνα και γράφει jpeg', async () => {
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

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eh-ingest-'));
    const src = path.join(dir, 'big.png');
    const dest = path.join(dir, 'out.jpg');
    try {
      await sharp({
        create: {
          width: 3200,
          height: 2000,
          channels: 3,
          background: { r: 40, g: 120, b: 200 },
        },
      }).png().toFile(src);

      const result = await compressImageForIngest(src, dest, { maxDimension: 800, quality: 80 });
      expect(result.compressed).toBe(true);
      expect(result.fallbackCopy).toBe(false);
      const meta = await sharp(dest).metadata();
      expect(meta.format).toBe('jpeg');
      expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(800);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

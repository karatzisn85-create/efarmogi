/**
 * @jest-environment node
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildCoverFrameCacheKey,
  writeCoverFrameCache,
  readCoverFrameCache,
  invalidateCoverFrameCache,
  getOrRenderCoverFrame,
  getCoverFrameCacheDir,
} = require('../../public/apologismosCoverFrameCache');

describe('apologismosCoverFrameCache', () => {
  test('buildCoverFrameCacheKey σταθερό για ίδια είσοδο', () => {
    const base = {
      relativePath: 'appearance/cover_0.jpg',
      mtimeMs: 1000,
      size: 5000,
      focusX: 0.5,
      focusY: 0.5,
      zoom: 1,
      width: 1600,
      height: 900,
      background: '#1e293b',
      channel: 'pdf',
    };
    expect(buildCoverFrameCacheKey(base)).toBe(buildCoverFrameCacheKey(base));
  });

  test('αλλαγή focus ή zoom αλλάζει το κλειδί', () => {
    const base = {
      relativePath: 'appearance/cover_0.jpg',
      mtimeMs: 1000,
      size: 5000,
      focusX: 0.5,
      focusY: 0.5,
      zoom: 1,
      width: 1600,
      height: 900,
      background: '#1e293b',
      channel: 'pdf',
    };
    const moved = { ...base, focusX: 0.7 };
    const zoomed = { ...base, zoom: 1.5 };
    expect(buildCoverFrameCacheKey(moved)).not.toBe(buildCoverFrameCacheKey(base));
    expect(buildCoverFrameCacheKey(zoomed)).not.toBe(buildCoverFrameCacheKey(base));
  });

  test('αλλαγή mtime/size (νέο αρχείο) αλλάζει το κλειδί', () => {
    const a = {
      relativePath: 'appearance/cover_0.jpg',
      mtimeMs: 1000,
      size: 5000,
      focusX: 0.5,
      focusY: 0.5,
      zoom: 1,
      width: 200,
      height: 150,
      background: '#111',
      channel: 'pdf',
    };
    expect(buildCoverFrameCacheKey({ ...a, mtimeMs: 2000 })).not.toBe(buildCoverFrameCacheKey(a));
    expect(buildCoverFrameCacheKey({ ...a, size: 9000 })).not.toBe(buildCoverFrameCacheKey(a));
  });

  test('write/read/invalidate cache στο δίσκο', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eh-frame-cache-'));
    try {
      const key = buildCoverFrameCacheKey({
        relativePath: 'appearance/a.jpg',
        mtimeMs: 1,
        size: 2,
        focusX: 0.5,
        focusY: 0.5,
        zoom: 1,
        width: 10,
        height: 10,
        background: '#000',
        channel: 'pdf',
      });
      const payload = Buffer.alloc(64, 7);
      expect(writeCoverFrameCache(root, key, payload)).toBe(true);
      expect(readCoverFrameCache(root, key).equals(payload)).toBe(true);
      expect(fs.existsSync(getCoverFrameCacheDir(root))).toBe(true);
      const wiped = invalidateCoverFrameCache(root);
      expect(wiped.removed).toBeGreaterThanOrEqual(1);
      expect(readCoverFrameCache(root, key)).toBeNull();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('getOrRenderCoverFrame: δεύτερη κλήση είναι cache hit', async () => {
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

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eh-frame-cache-'));
    const src = path.join(root, 'src.png');
    try {
      await sharp({
        create: { width: 400, height: 300, channels: 3, background: { r: 20, g: 80, b: 160 } },
      }).png().toFile(src);

      const opts = {
        width: 200,
        height: 150,
        focusX: 0.4,
        focusY: 0.6,
        zoom: 1.2,
        background: '#0f172a',
      };
      const first = await getOrRenderCoverFrame(root, src, opts, {
        relativePath: 'appearance/src.png',
        channel: 'pdf',
      });
      expect(first.cacheHit).toBe(false);
      expect(Buffer.isBuffer(first.buffer)).toBe(true);

      const second = await getOrRenderCoverFrame(root, src, opts, {
        relativePath: 'appearance/src.png',
        channel: 'pdf',
      });
      expect(second.cacheHit).toBe(true);
      expect(second.buffer.equals(first.buffer)).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

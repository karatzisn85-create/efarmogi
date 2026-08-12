/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const {
  APOLOGISMOS_PDF_FONT_FAMILY,
  APOLOGISMOS_CSS_FONT_FAMILY,
  APOLOGISMOS_PPTX_FONT_FACE,
  APOLOGISMOS_CSS_FONT_STACK,
  resolveApologismosFontDir,
  getApologismosFontPaths,
  getApologismosPdfFontRegistration,
  FONT_FILES,
} = require('../../public/apologismosFonts');

describe('apologismosFonts (node)', () => {
  test('οικογένειες PDF / CSS / PPTX είναι συνεπείς για DejaVu', () => {
    expect(APOLOGISMOS_PDF_FONT_FAMILY).toBe('DejaVu');
    expect(APOLOGISMOS_CSS_FONT_FAMILY).toBe('DejaVu Sans');
    expect(APOLOGISMOS_PPTX_FONT_FACE).toBe('DejaVu Sans');
    expect(APOLOGISMOS_CSS_FONT_STACK).toContain('DejaVu Sans');
  });

  test('βρίσκει τοπικό φάκελο γραμματοσειρών με τα 4 βασικά αρχεία', () => {
    const dir = resolveApologismosFontDir();
    expect(dir).toBeTruthy();
    expect(fs.existsSync(path.join(dir, FONT_FILES.regular))).toBe(true);
    const paths = getApologismosFontPaths();
    expect(paths).not.toBeNull();
    expect(fs.existsSync(paths.regular)).toBe(true);
    expect(fs.existsSync(paths.bold)).toBe(true);
    expect(fs.existsSync(paths.italic)).toBe(true);
    expect(fs.existsSync(paths.boldItalic)).toBe(true);
  });

  test('getApologismosPdfFontRegistration προτιμά local χωρίς CDN', () => {
    const reg = getApologismosPdfFontRegistration();
    expect(reg.source).toBe('local');
    expect(reg.family).toBe('DejaVu');
    expect(reg.fonts).toHaveLength(4);
    reg.fonts.forEach((f) => {
      expect(f.src).not.toMatch(/^https?:\/\//);
      expect(fs.existsSync(f.src)).toBe(true);
    });
  });

  test('PPTX εξαγωγή χρησιμοποιεί την ίδια οικογένεια DejaVu Sans', () => {
    // Δεν ανοίγουμε όλο το pptxgen — μόνο η σταθερά που καταναλώνει το export.
    expect(APOLOGISMOS_PPTX_FONT_FACE).toBe('DejaVu Sans');
  });
});

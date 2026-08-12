/**
 * Κοινές γραμματοσειρές Απολογισμού (και γενικών PDF αναφορών).
 * Τοπικά αρχεία DejaVu — χωρίς εξάρτηση από CDN για ελληνικά.
 */

const fs = require('fs');
const path = require('path');

/** Οικογένεια στο @react-pdf (Font.register family). */
const APOLOGISMOS_PDF_FONT_FAMILY = 'DejaVu';
/** Οικογένεια CSS / @font-face στην οθόνη. */
const APOLOGISMOS_CSS_FONT_FAMILY = 'DejaVu Sans';
/** fontFace στο PowerPoint (όνομα TrueType οικογένειας DejaVu). */
const APOLOGISMOS_PPTX_FONT_FACE = 'DejaVu Sans';

const APOLOGISMOS_CSS_FONT_STACK = `"${APOLOGISMOS_CSS_FONT_FAMILY}", "${APOLOGISMOS_PDF_FONT_FAMILY}", "Segoe UI", Arial, sans-serif`;

const FONT_FILES = {
  regular: 'DejaVuSans.ttf',
  bold: 'DejaVuSans-Bold.ttf',
  italic: 'DejaVuSans-Oblique.ttf',
  boldItalic: 'DejaVuSans-BoldOblique.ttf',
};

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf';

function resolveApologismosFontDir() {
  const candidates = [
    path.join(__dirname, 'fonts', 'apologismos'),
    path.join(__dirname, '..', 'build', 'fonts', 'apologismos'),
    path.join(__dirname, '..', 'public', 'fonts', 'apologismos'),
    path.join(__dirname, '..', 'node_modules', 'dejavu-fonts-ttf', 'ttf'),
  ];
  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, FONT_FILES.regular))) return dir;
    } catch (_) {}
  }
  return null;
}

/**
 * @returns {{ regular: string, bold: string, italic: string, boldItalic: string }|null}
 */
function getApologismosFontPaths() {
  const dir = resolveApologismosFontDir();
  if (!dir) return null;
  const paths = {
    regular: path.join(dir, FONT_FILES.regular),
    bold: path.join(dir, FONT_FILES.bold),
    italic: path.join(dir, FONT_FILES.italic),
    boldItalic: path.join(dir, FONT_FILES.boldItalic),
  };
  for (const p of Object.values(paths)) {
    if (!fs.existsSync(p)) return null;
  }
  return paths;
}

function getApologismosFontCdnUrls() {
  return {
    regular: `${CDN_BASE}/${FONT_FILES.regular}`,
    bold: `${CDN_BASE}/${FONT_FILES.bold}`,
    italic: `${CDN_BASE}/${FONT_FILES.italic}`,
    boldItalic: `${CDN_BASE}/${FONT_FILES.boldItalic}`,
  };
}

/**
 * Περιγραφή πηγών για εγγραφή PDF (local file paths ή CDN URLs).
 * @returns {{ source: 'local'|'cdn', fonts: Array<{ src: string, fontWeight: string, fontStyle: string }> }}
 */
function getApologismosPdfFontRegistration() {
  const local = getApologismosFontPaths();
  const srcs = local || getApologismosFontCdnUrls();
  return {
    source: local ? 'local' : 'cdn',
    family: APOLOGISMOS_PDF_FONT_FAMILY,
    fonts: [
      { src: srcs.regular, fontWeight: 'normal', fontStyle: 'normal' },
      { src: srcs.bold, fontWeight: 'bold', fontStyle: 'normal' },
      { src: srcs.italic, fontWeight: 'normal', fontStyle: 'italic' },
      { src: srcs.boldItalic, fontWeight: 'bold', fontStyle: 'italic' },
    ],
  };
}

module.exports = {
  APOLOGISMOS_PDF_FONT_FAMILY,
  APOLOGISMOS_CSS_FONT_FAMILY,
  APOLOGISMOS_PPTX_FONT_FACE,
  APOLOGISMOS_CSS_FONT_STACK,
  FONT_FILES,
  resolveApologismosFontDir,
  getApologismosFontPaths,
  getApologismosFontCdnUrls,
  getApologismosPdfFontRegistration,
};

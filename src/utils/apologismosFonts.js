/**
 * Γραμματοσειρές Απολογισμού στον renderer (οθόνη + @react-pdf).
 * Τοπικά αρχεία από public/fonts/apologismos — CDN μόνο ως εφεδρεία.
 */

export const APOLOGISMOS_PDF_FONT_FAMILY = 'DejaVu';
export const APOLOGISMOS_CSS_FONT_FAMILY = 'DejaVu Sans';
export const APOLOGISMOS_PPTX_FONT_FACE = 'DejaVu Sans';
export const APOLOGISMOS_CSS_FONT_STACK = `"${APOLOGISMOS_CSS_FONT_FAMILY}", "${APOLOGISMOS_PDF_FONT_FAMILY}", "Segoe UI", Arial, sans-serif`;

const FONT_FILES = {
  regular: 'DejaVuSans.ttf',
  bold: 'DejaVuSans-Bold.ttf',
  italic: 'DejaVuSans-Oblique.ttf',
  boldItalic: 'DejaVuSans-BoldOblique.ttf',
};

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf';

let pdfFontsRegistered = false;
let screenFontsReady = false;

/**
 * URL τοπικής γραμματοσειράς σχετικά με το index της εφαρμογής.
 * @param {string} fileName
 * @returns {string}
 */
export function resolveApologismosFontUrl(fileName) {
  const safe = String(fileName || '').replace(/[<>:"\\|?*]/g, '');
  if (typeof window !== 'undefined' && window.location?.href) {
    try {
      return new URL(`fonts/apologismos/${safe}`, window.location.href).href;
    } catch (_) {}
  }
  const base = (typeof process !== 'undefined' && process.env.PUBLIC_URL) || '';
  const prefix = String(base).replace(/\/$/, '');
  return `${prefix}/fonts/apologismos/${safe}`.replace(/([^:]\/)\/+/g, '$1');
}

function cdnUrl(fileName) {
  return `${CDN_BASE}/${fileName}`;
}

/**
 * Εγγραφή DejaVu στο @react-pdf (μία φορά). Προτιμά τοπικά αρχεία.
 * @returns {Promise<{ ok: boolean, source: 'local'|'cdn'|'cached' }>}
 */
export async function registerApologismosPdfFonts() {
  if (pdfFontsRegistered) return { ok: true, source: 'cached' };

  const { Font } = await import('@react-pdf/renderer');

  const localFonts = [
    { src: resolveApologismosFontUrl(FONT_FILES.regular), fontWeight: 'normal', fontStyle: 'normal' },
    { src: resolveApologismosFontUrl(FONT_FILES.bold), fontWeight: 'bold', fontStyle: 'normal' },
    { src: resolveApologismosFontUrl(FONT_FILES.italic), fontWeight: 'normal', fontStyle: 'italic' },
    { src: resolveApologismosFontUrl(FONT_FILES.boldItalic), fontWeight: 'bold', fontStyle: 'italic' },
  ];

  try {
    Font.register({
      family: APOLOGISMOS_PDF_FONT_FAMILY,
      fonts: localFonts,
    });
    pdfFontsRegistered = true;
    return { ok: true, source: 'local' };
  } catch (_) {
    try {
      Font.register({
        family: APOLOGISMOS_PDF_FONT_FAMILY,
        fonts: [
          { src: cdnUrl(FONT_FILES.regular), fontWeight: 'normal', fontStyle: 'normal' },
          { src: cdnUrl(FONT_FILES.bold), fontWeight: 'bold', fontStyle: 'normal' },
          { src: cdnUrl(FONT_FILES.italic), fontWeight: 'normal', fontStyle: 'italic' },
          { src: cdnUrl(FONT_FILES.boldItalic), fontWeight: 'bold', fontStyle: 'italic' },
        ],
      });
      pdfFontsRegistered = true;
      return { ok: true, source: 'cdn' };
    } catch (e2) {
      return { ok: false, source: 'cdn' };
    }
  }
}

/**
 * Εισάγει @font-face στο document για την προβολή διαφανειών.
 */
export function ensureApologismosScreenFonts() {
  if (typeof document === 'undefined') return { ok: false };
  if (screenFontsReady || document.getElementById('apologismos-font-faces')) {
    screenFontsReady = true;
    return { ok: true, cached: true };
  }

  const style = document.createElement('style');
  style.id = 'apologismos-font-faces';
  style.textContent = `
@font-face {
  font-family: '${APOLOGISMOS_CSS_FONT_FAMILY}';
  src: url('${resolveApologismosFontUrl(FONT_FILES.regular)}') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: '${APOLOGISMOS_CSS_FONT_FAMILY}';
  src: url('${resolveApologismosFontUrl(FONT_FILES.bold)}') format('truetype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: '${APOLOGISMOS_CSS_FONT_FAMILY}';
  src: url('${resolveApologismosFontUrl(FONT_FILES.italic)}') format('truetype');
  font-weight: 400;
  font-style: italic;
  font-display: swap;
}
@font-face {
  font-family: '${APOLOGISMOS_CSS_FONT_FAMILY}';
  src: url('${resolveApologismosFontUrl(FONT_FILES.boldItalic)}') format('truetype');
  font-weight: 700;
  font-style: italic;
  font-display: swap;
}
`.trim();
  document.head.appendChild(style);
  screenFontsReady = true;
  return { ok: true, cached: false };
}

/** Για tests — επαναφορά flags. */
export function __resetApologismosFontRegistrationForTests() {
  pdfFontsRegistered = false;
  screenFontsReady = false;
}

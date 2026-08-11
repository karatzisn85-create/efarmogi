/**
 * Ενιαίο σύστημα σχεδίασης διαφανειών απολογισμού.
 *
 * Καμβάς αναφοράς 960×540 (16:9). Οι ίδιοι αριθμοί χρησιμοποιούνται σε:
 *  - οθόνη (1 μονάδα = 1 px στον καμβά της παρουσίασης)
 *  - PDF (1 μονάδα = 1 pt, σελίδα 960×540)
 *  - PowerPoint (1 μονάδα = 1/96 ίντσας, διαφάνεια 10×5.625 in)
 *
 * Καθρέφτης του src/utils/apologismosSlideDesign.js — κρατήστε τα συγχρονισμένα.
 */

const SLIDE_W = 960;
const SLIDE_H = 540;

const TEXT_SCALES = Object.freeze([
  Object.freeze({
    id: 'compact',
    label: 'Συμπαγές',
    description: 'Περισσότερο περιεχόμενο ανά διαφάνεια',
    factor: 0.92,
  }),
  Object.freeze({
    id: 'normal',
    label: 'Κανονικό',
    description: 'Ισορροπία κειμένου και εικόνας',
    factor: 1,
  }),
  Object.freeze({
    id: 'large',
    label: 'Ευανάγνωστο',
    description: 'Μεγαλύτερα γράμματα για προβολή σε αίθουσα',
    factor: 1.09,
  }),
]);

const FOOTER_MODES = Object.freeze([
  Object.freeze({
    id: 'full',
    label: 'Πλήρες',
    description: 'Οργανισμός, περίοδος, ERGOHUB και αρίθμηση διαφανειών',
  }),
  Object.freeze({
    id: 'minimal',
    label: 'Λιτό',
    description: 'ERGOHUB και αρίθμηση διαφανειών',
  }),
  Object.freeze({
    id: 'none',
    label: 'Χωρίς υποσέλιδο',
    description: 'Εντελώς καθαρή διαφάνεια',
  }),
]);

const DEFAULT_TEXT_SCALE = 'normal';
const DEFAULT_FOOTER_MODE = 'full';

const TEXT_SCALE_IDS = Object.freeze(TEXT_SCALES.map((s) => s.id));
const FOOTER_MODE_IDS = Object.freeze(FOOTER_MODES.map((f) => f.id));

/** Τυπογραφική κλίμακα στον καμβά αναφοράς (πριν τον συντελεστή χρήστη). */
const BASE_TYPE = Object.freeze({
  eyebrow: 12,
  titleHero: 42,
  titleSection: 38,
  title: 26,
  subtitle: 15,
  lead: 16,
  body: 13.5,
  narrative: 20,
  caption: 11,
  statLabel: 10.5,
  statValue: 17,
  kpiLabel: 11.5,
  kpiValue: 24,
  kpiValueHero: 34,
  footer: 10,
});

/** Γεωμετρία στον καμβά αναφοράς (σταθερή — δεν αλλάζει με την κλίμακα κειμένου). */
const GEOM = Object.freeze({
  slideW: SLIDE_W,
  slideH: SLIDE_H,
  marginX: 54,
  marginTop: 42,
  headerRuleW: 58,
  headerRuleH: 4,
  /** Ύψος επικεφαλίδας: τίτλος (2 γραμμές), σύντομο κείμενο και ποσά. */
  contentTop: 236,
  contentBottom: 470,
  footerRuleY: 480,
  footerTextY: 492,
  footerTextH: 16,
  gutter: 18,
  cardRadius: 10,
  kpiH: 96,
  kpiPad: 16,
  statH: 54,
  coverPadX: 56,
  coverPadY: 52,
  coverRuleW: 76,
});

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeHex(hex, fallback = '#000000') {
  const raw = String(hex || '').trim();
  const m = /^#?([0-9a-fA-F]{6})$/.exec(raw);
  if (m) return `#${m[1].toLowerCase()}`;
  const short = /^#?([0-9a-fA-F]{3})$/.exec(raw);
  if (short) {
    const [r, g, b] = short[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Ανάμειξη δύο χρωμάτων. ratio 0 = a, 1 = b. */
function mixHex(a, b, ratio) {
  const t = clampNumber(ratio, 0, 1, 0.5);
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const to2 = (n) => Math.round(n).toString(16).padStart(2, '0');
  return `#${to2(A.r + (B.r - A.r) * t)}${to2(A.g + (B.g - A.g) * t)}${to2(A.b + (B.b - A.b) * t)}`;
}

function rgbaOf(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clampNumber(alpha, 0, 1, 1)})`;
}

/** Σχετική φωτεινότητα — για επιλογή κειμένου πάνω σε χρωματιστό πλαίσιο. */
function luminanceOf(hex) {
  const { r, g, b } = hexToRgb(hex);
  const ch = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function readableTextOn(hex) {
  return luminanceOf(hex) > 0.55 ? '#0f172a' : '#ffffff';
}

function getTextScale(id) {
  return TEXT_SCALES.find((s) => s.id === id) || TEXT_SCALES.find((s) => s.id === DEFAULT_TEXT_SCALE);
}

function getFooterMode(id) {
  return FOOTER_MODES.find((f) => f.id === id) || FOOTER_MODES.find((f) => f.id === DEFAULT_FOOTER_MODE);
}

function roundHalf(n) {
  return Math.round(n * 2) / 2;
}

/**
 * Παράγει τα tokens σχεδίασης για μία εμφάνιση (παλέτα + επιλογές χρήστη).
 * @param {object} appearance normalized appearance (ή raw με τα ίδια πεδία)
 * @param {object} theme tokens παλέτας
 */
function resolveSlideDesign(appearance, theme) {
  const a = appearance && typeof appearance === 'object' ? appearance : {};
  const t = theme && typeof theme === 'object' ? theme : {};

  const scale = getTextScale(a.textScale);
  const footer = getFooterMode(a.footerMode);

  const surface = normalizeHex(t.surface, '#ffffff');
  const bg = normalizeHex(t.bg, '#f8fafc');
  const text = normalizeHex(t.text, '#0f172a');
  const muted = normalizeHex(t.muted, '#64748b');
  const accent = normalizeHex(t.accent, '#2563eb');
  const accentText = normalizeHex(t.accentText, readableTextOn(accent));
  const darkBand = normalizeHex(t.darkBand, '#1e293b');
  const darkText = normalizeHex(t.darkText, '#ffffff');
  const cardDark = normalizeHex(t.cardDark, '#334155');

  const type = {};
  Object.keys(BASE_TYPE).forEach((key) => {
    type[key] = roundHalf(BASE_TYPE[key] * scale.factor);
  });

  return {
    scaleId: scale.id,
    scaleFactor: scale.factor,
    footerMode: footer.id,
    sectionDividers: a.sectionDividers !== false,
    coverStats: a.coverStats !== false,
    type,
    geom: GEOM,
    colors: {
      surface,
      bg,
      text,
      muted,
      accent,
      accentText,
      darkBand,
      darkText,
      cardDark,
      /** Λεπτή γραμμή διαχωρισμού πάνω σε ανοιχτό φόντο. */
      hairline: mixHex(muted, surface, 0.74),
      /** Ήπιο πλαίσιο για ενότητες περιεχομένου. */
      panel: mixHex(bg, surface, 0.45),
      panelBorder: mixHex(muted, surface, 0.82),
      /** Απαλή απόχρωση έμφασης (π.χ. φόντο ετικέτας). */
      accentSoft: mixHex(accent, surface, 0.88),
      /** Κείμενο δεύτερης βαθμίδας πάνω σε σκούρο φόντο. */
      darkMuted: mixHex(darkText, darkBand, 0.34),
      darkHairline: mixHex(darkText, darkBand, 0.78),
      /** Διακριτικό αριθμητικό υδατογράφημα σε σκούρο φόντο. */
      darkGhost: mixHex(darkBand, darkText, 0.06),
      /** Πλαίσιο φωτογραφίας. */
      photoFrame: mixHex(muted, surface, 0.7),
      photoPlaceholder: mixHex(bg, muted, 0.16),
    },
    /** Διαφάνειες σκίασης εξωφύλλου (0..1). */
    scrim: {
      strong: 0.78,
      soft: 0.1,
    },
  };
}

const SCRIM = Object.freeze({ start: 0.28, end: 0.62, steps: 8, maxAlpha: 0.92 });

/**
 * Σκίαση εξωφύλλου ως ζώνες — ώστε τα κείμενα να διαβάζονται πάνω σε φωτεινές
 * φωτογραφίες. Χρησιμοποιείται αυτούσια σε έγγραφο και διαφάνειες, όπου δεν
 * υποστηρίζονται διαβαθμίσεις.
 */
function coverScrimBands() {
  const y0 = SLIDE_H * SCRIM.start;
  const y1 = SLIDE_H * SCRIM.end;
  const bandH = (y1 - y0) / SCRIM.steps;
  const bands = [];
  for (let i = 0; i < SCRIM.steps; i += 1) {
    const alpha = SCRIM.maxAlpha * (((i + 1) / SCRIM.steps) ** 1.6);
    bands.push({ y: y0 + i * bandH, height: bandH, alpha: Math.round(alpha * 1000) / 1000 });
  }
  bands.push({ y: y1, height: SLIDE_H - y1, alpha: SCRIM.maxAlpha });
  return bands;
}

/** Η ίδια σκίαση ως CSS διαβάθμιση για την παρουσίαση οθόνης. */
function coverScrimCss(hex) {
  const stops = [`${rgbaOf(hex, 0)} 0%`, `${rgbaOf(hex, 0)} ${(SCRIM.start * 100).toFixed(1)}%`];
  coverScrimBands().forEach((band) => {
    stops.push(`${rgbaOf(hex, band.alpha)} ${(((band.y + band.height) / SLIDE_H) * 100).toFixed(1)}%`);
  });
  return `linear-gradient(180deg, ${stops.join(', ')})`;
}

/** Κείμενα υποσέλιδου διαφάνειας. */
function buildFooter({ design, organizationTitle, periodLabel, index, total }) {
  const mode = design?.footerMode || DEFAULT_FOOTER_MODE;
  if (mode === 'none') return null;
  const position = Number.isFinite(Number(index)) && Number.isFinite(Number(total))
    ? `${Number(index) + 1} / ${Number(total)}`
    : '';
  const brand = 'Συντάχθηκε με ERGOHUB';
  if (mode === 'minimal') return { left: brand, right: position };
  const left = [organizationTitle, periodLabel, brand]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join('  ·  ');
  return { left, right: position };
}

/** Μονάδες καμβά → ίντσες PowerPoint. */
function toInches(units) {
  return Number(units || 0) / 96;
}

/** Μονάδες καμβά → μέγεθος γραμματοσειράς PowerPoint (pt). */
function toPptxFont(units) {
  return roundHalf(Number(units || 0) * 0.75);
}

/** Ισοκατανομή στηλών μέσα στο ωφέλιμο πλάτος. */
function columnLayout(count, { left = GEOM.marginX, width = SLIDE_W - GEOM.marginX * 2, gutter = GEOM.gutter } = {}) {
  const n = Math.max(1, Math.floor(count));
  const colW = (width - gutter * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({
    x: left + i * (colW + gutter),
    width: colW,
  }));
}

module.exports = {
  SLIDE_W,
  SLIDE_H,
  TEXT_SCALES,
  FOOTER_MODES,
  TEXT_SCALE_IDS,
  FOOTER_MODE_IDS,
  DEFAULT_TEXT_SCALE,
  DEFAULT_FOOTER_MODE,
  BASE_TYPE,
  GEOM,
  getTextScale,
  getFooterMode,
  resolveSlideDesign,
  coverScrimBands,
  coverScrimCss,
  buildFooter,
  toInches,
  toPptxFont,
  columnLayout,
  mixHex,
  rgbaOf,
  normalizeHex,
  readableTextOn,
  luminanceOf,
};

/**
 * Εμφάνιση απολογισμού: παλέτες, μορφές εξωφύλλου, normalize.
 * Pure module (Electron main + tests via require).
 * Καθρέφτης του src/utils/apologismosAppearance.js — κρατήστε τα συγχρονισμένα.
 */

const slideDesign = require('./apologismosSlideDesign');

const DEFAULT_PALETTE_ID = 'light_report';
const DEFAULT_COVER_LAYOUT_ID = 'hero_single';

const PALETTES = Object.freeze([
  Object.freeze({
    id: 'municipal_blue',
    label: 'Κλασικό δημοτικό',
    description: 'Σκούρο μπλε με χρυσή έμφαση',
    tokens: Object.freeze({
      bg: '#f8fafc',
      surface: '#ffffff',
      text: '#0f172a',
      muted: '#64748b',
      accent: '#c9a227',
      accentText: '#1e293b',
      darkBand: '#0f2744',
      darkText: '#ffffff',
      cardDark: '#1e3a5f',
    }),
  }),
  Object.freeze({
    id: 'light_report',
    label: 'Ανοιχτό απολογισμού',
    description: 'Λευκό / γκρι με μπλε έμφαση',
    tokens: Object.freeze({
      bg: '#f8fafc',
      surface: '#ffffff',
      text: '#0f172a',
      muted: '#64748b',
      accent: '#2563eb',
      accentText: '#ffffff',
      darkBand: '#1e293b',
      darkText: '#ffffff',
      cardDark: '#334155',
    }),
  }),
  Object.freeze({
    id: 'charcoal_gold',
    label: 'Ισχυρή παρουσίαση',
    description: 'Ανθρακί με χρυσή έμφαση',
    tokens: Object.freeze({
      bg: '#f5f5f4',
      surface: '#ffffff',
      text: '#18181b',
      muted: '#71717a',
      accent: '#d4a017',
      accentText: '#18181b',
      darkBand: '#18181b',
      darkText: '#ffffff',
      cardDark: '#27272a',
    }),
  }),
  Object.freeze({
    id: 'tech_green',
    label: 'Πράσινο τεχνικό',
    description: 'Βαθύ πράσινο με ανοιχτή επιφάνεια',
    tokens: Object.freeze({
      bg: '#f0fdf4',
      surface: '#ffffff',
      text: '#14532d',
      muted: '#4d7c5a',
      accent: '#15803d',
      accentText: '#ffffff',
      darkBand: '#14532d',
      darkText: '#ffffff',
      cardDark: '#166534',
    }),
  }),
]);

const COVER_LAYOUTS = Object.freeze([
  Object.freeze({
    id: 'hero_single',
    label: 'Μία μεγάλη φωτογραφία',
    description: 'Πλήρες φόντο με μπάρα τίτλου',
    imageSlots: 1,
  }),
  Object.freeze({
    id: 'hero_split',
    label: 'Δύο φωτογραφίες',
    description: 'Δίπλα-δίπλα με τίτλο κάτω',
    imageSlots: 2,
  }),
  Object.freeze({
    id: 'hero_side',
    label: 'Φωτογραφία + κείμενο',
    description: 'Εικόνα αριστερά, κείμενα δεξιά',
    imageSlots: 1,
  }),
]);

const PALETTE_IDS = Object.freeze(PALETTES.map((p) => p.id));
const COVER_LAYOUT_IDS = Object.freeze(COVER_LAYOUTS.map((l) => l.id));

function getPalette(paletteId) {
  return PALETTES.find((p) => p.id === paletteId) || PALETTES.find((p) => p.id === DEFAULT_PALETTE_ID);
}

function getCoverLayout(layoutId) {
  return COVER_LAYOUTS.find((l) => l.id === layoutId)
    || COVER_LAYOUTS.find((l) => l.id === DEFAULT_COVER_LAYOUT_ID);
}

function clamp01(n, fallback = 0.5) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(1, Math.max(0, x));
}

function clampZoom(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 1;
  return Math.min(2, Math.max(1, x));
}

function normalizeCoverImage(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const relativePath = String(raw.relativePath || '').trim().replace(/\\/g, '/');
  if (!relativePath || relativePath.includes('..') || relativePath.startsWith('/')) return null;
  if (!relativePath.startsWith('appearance/')) return null;
  return {
    relativePath,
    focusX: clamp01(raw.focusX, 0.5),
    focusY: clamp01(raw.focusY, 0.5),
    zoom: clampZoom(raw.zoom),
  };
}

const DEFAULT_MOTION_STYLE = 'fade';
const MOTION_STYLE_IDS = Object.freeze(['fade']);

const MAYOR_MESSAGE_TITLE = 'Μήνυμα Δημάρχου';
const MAYOR_NAME_MAX = 80;
const MAYOR_TEXT_MAX = 900;

function emptyMayorMessage() {
  return {
    enabled: false,
    mayorName: '',
    text: '',
    photo: null,
  };
}

function normalizeMayorMessage(raw) {
  if (!raw || typeof raw !== 'object') return emptyMayorMessage();
  const photo = normalizeCoverImage(raw.photo);
  // Χωρίς .trim() εδώ: το normalize τρέχει σε κάθε πλήκτρο στο UI και θα «έτρωγε» το Space.
  return {
    enabled: raw.enabled === true,
    mayorName: String(raw.mayorName ?? '').slice(0, MAYOR_NAME_MAX),
    text: String(raw.text ?? '').slice(0, MAYOR_TEXT_MAX),
    photo: photo || null,
  };
}

function emptyAppearance() {
  return {
    paletteId: DEFAULT_PALETTE_ID,
    coverLayoutId: DEFAULT_COVER_LAYOUT_ID,
    subtitle: '',
    coverImages: [],
    motionEnabled: false,
    motionStyle: DEFAULT_MOTION_STYLE,
    textScale: slideDesign.DEFAULT_TEXT_SCALE,
    footerMode: slideDesign.DEFAULT_FOOTER_MODE,
    sectionDividers: true,
    coverStats: true,
    mayorMessage: emptyMayorMessage(),
    updatedAt: null,
  };
}

/**
 * Εικόνες εξωφύλλου ανά θέση (0..imageSlots-1), με null στα κενά slots.
 * Σεβασμός πεδίου `slot` (ώστε η 2η φωτό να μην «πέφτει» στην 1η αν λείπει η πρώτη).
 */
function coverImagesBySlot(appearanceOrRaw) {
  const coverLayoutId = COVER_LAYOUT_IDS.includes(appearanceOrRaw?.coverLayoutId)
    ? appearanceOrRaw.coverLayoutId
    : DEFAULT_COVER_LAYOUT_ID;
  const layout = getCoverLayout(coverLayoutId);
  const rawList = Array.isArray(appearanceOrRaw?.coverImages) ? appearanceOrRaw.coverImages : [];
  const slots = Array.from({ length: layout.imageSlots }, () => null);
  const legacyDense = rawList.every((item) => item == null || item.slot === undefined || item.slot === null);
  rawList.forEach((item, i) => {
    const n = normalizeCoverImage(item);
    if (!n) return;
    let slot = i;
    if (!legacyDense) {
      const s = Number(item.slot);
      if (Number.isInteger(s)) slot = s;
    }
    if (slot < 0 || slot >= layout.imageSlots) return;
    if (slots[slot]) return;
    slots[slot] = { ...n, slot };
  });
  return slots;
}

function normalizeAppearance(raw) {
  const base = emptyAppearance();
  if (!raw || typeof raw !== 'object') return base;
  const paletteId = PALETTE_IDS.includes(raw.paletteId) ? raw.paletteId : DEFAULT_PALETTE_ID;
  const coverLayoutId = COVER_LAYOUT_IDS.includes(raw.coverLayoutId)
    ? raw.coverLayoutId
    : DEFAULT_COVER_LAYOUT_ID;
  const slots = coverImagesBySlot({ ...raw, paletteId, coverLayoutId });
  const motionEnabled = raw.motionEnabled === true;
  const motionStyle = MOTION_STYLE_IDS.includes(raw.motionStyle)
    ? raw.motionStyle
    : DEFAULT_MOTION_STYLE;
  return {
    paletteId,
    coverLayoutId,
    // Χωρίς .trim(): αλλιώς το διάστημα στο τέλος χάνεται σε κάθε πάτημα πλήκτρου.
    subtitle: String(raw.subtitle ?? '').slice(0, 120),
    coverImages: slots.filter(Boolean),
    motionEnabled,
    motionStyle,
    textScale: slideDesign.TEXT_SCALE_IDS.includes(raw.textScale)
      ? raw.textScale
      : slideDesign.DEFAULT_TEXT_SCALE,
    footerMode: slideDesign.FOOTER_MODE_IDS.includes(raw.footerMode)
      ? raw.footerMode
      : slideDesign.DEFAULT_FOOTER_MODE,
    sectionDividers: raw.sectionDividers !== false,
    coverStats: raw.coverStats !== false,
    mayorMessage: normalizeMayorMessage(raw.mayorMessage),
    updatedAt: raw.updatedAt || null,
  };
}

/** Σύνοψη κίνησης για presentation model. */
function resolveMotion(appearance) {
  const a = normalizeAppearance(appearance);
  return {
    enabled: a.motionEnabled === true,
    style: a.motionStyle || DEFAULT_MOTION_STYLE,
  };
}

/**
 * Όνομα οργανισμού για εξώφυλλο.
 * π.χ. «Δήμος Αρχανών Αστερουσίων» αν το name δεν ξεκινά ήδη με τύπο.
 */
function resolveOrganizationTitle(appConfig) {
  const full = String(appConfig?.organizationFullName || '').trim();
  if (full) return full;
  const name = String(appConfig?.organizationName || '').trim();
  if (!name) return '';
  const type = String(appConfig?.organizationType || 'Δήμος').trim() || 'Δήμος';
  if (name.toLocaleLowerCase('el-GR').startsWith(type.toLocaleLowerCase('el-GR'))) {
    return name;
  }
  return `${type} ${name}`;
}

function coverImageWarnings(appearance) {
  const a = normalizeAppearance(appearance);
  const layout = getCoverLayout(a.coverLayoutId);
  const have = a.coverImages.length;
  const need = layout.imageSlots;
  if (have >= need) return [];
  if (need === 1) {
    return ['Προσθέστε μία φωτογραφία εξωφύλλου για καλύτερο αποτέλεσμα.'];
  }
  return [`Προσθέστε ${need} φωτογραφίες εξωφύλλου (έχετε ${have}).`];
}

function buildCoverDisplay({ appearance, period, organizationTitle }) {
  const a = normalizeAppearance(appearance);
  const layout = getCoverLayout(a.coverLayoutId);
  const palette = getPalette(a.paletteId);
  return {
    layoutId: layout.id,
    layoutLabel: layout.label,
    imageSlots: layout.imageSlots,
    // Πάντα μήκος = imageSlots (null στα κενά) ώστε images[1] να είναι η 2η θέση.
    images: coverImagesBySlot(a),
    organizationTitle: organizationTitle || '',
    reportTitle: 'Απολογισμός τεχνικού έργου',
    periodLabel: period?.label || (period
      ? `Δημοτική περίοδος ${period.startYear}–${period.endYear}`
      : ''),
    subtitle: a.subtitle || '',
    warnings: coverImageWarnings(a),
    theme: palette.tokens,
    paletteId: palette.id,
    paletteLabel: palette.label,
  };
}

function resolveTheme(appearance) {
  return getPalette(normalizeAppearance(appearance).paletteId).tokens;
}

/** Tokens σχεδίασης διαφανειών (τυπογραφία, γεωμετρία, παράγωγα χρώματα). */
function resolveDesign(appearance) {
  const a = normalizeAppearance(appearance);
  return slideDesign.resolveSlideDesign(a, getPalette(a.paletteId).tokens);
}

module.exports = {
  DEFAULT_PALETTE_ID,
  DEFAULT_COVER_LAYOUT_ID,
  PALETTES,
  COVER_LAYOUTS,
  PALETTE_IDS,
  COVER_LAYOUT_IDS,
  getPalette,
  getCoverLayout,
  DEFAULT_MOTION_STYLE,
  MOTION_STYLE_IDS,
  MAYOR_MESSAGE_TITLE,
  MAYOR_NAME_MAX,
  MAYOR_TEXT_MAX,
  emptyMayorMessage,
  normalizeMayorMessage,
  emptyAppearance,
  normalizeAppearance,
  normalizeCoverImage,
  coverImagesBySlot,
  resolveOrganizationTitle,
  coverImageWarnings,
  buildCoverDisplay,
  resolveTheme,
  resolveDesign,
  resolveMotion,
  TEXT_SCALES: slideDesign.TEXT_SCALES,
  FOOTER_MODES: slideDesign.FOOTER_MODES,
};

/**
 * @jest-environment node
 */
import {
  SLIDE_W,
  SLIDE_H,
  GEOM,
  BASE_TYPE,
  TEXT_SCALES,
  FOOTER_MODES,
  resolveSlideDesign,
  buildFooter,
  toInches,
  toPptxFont,
  columnLayout,
  mixHex,
} from './apologismosSlideDesign';
import { normalizeAppearance, resolveDesign } from './apologismosAppearance';

const mainDesign = require('../../public/apologismosSlideDesign');
const mainAppearance = require('../../public/apologismosAppearance');

const THEME = {
  bg: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  accent: '#2563eb',
  accentText: '#ffffff',
  darkBand: '#1e293b',
  darkText: '#ffffff',
  cardDark: '#334155',
};

describe('σύστημα σχεδίασης διαφανειών', () => {
  test('ο καμβάς είναι 16:9 και ταιριάζει σε διαφάνεια 10 ιντσών', () => {
    expect(SLIDE_W / SLIDE_H).toBeCloseTo(16 / 9, 5);
    expect(toInches(SLIDE_W)).toBeCloseTo(10, 5);
    expect(toInches(SLIDE_H)).toBeCloseTo(5.625, 5);
  });

  test('μεγέθη κειμένου μετατρέπονται σε στιγμές PowerPoint', () => {
    expect(toPptxFont(BASE_TYPE.title)).toBeCloseTo(BASE_TYPE.title * 0.75, 5);
    expect(toPptxFont(40)).toBe(30);
  });

  test('η κλίμακα κειμένου επηρεάζει μόνο την τυπογραφία', () => {
    const normal = resolveSlideDesign({ textScale: 'normal' }, THEME);
    const large = resolveSlideDesign({ textScale: 'large' }, THEME);
    const compact = resolveSlideDesign({ textScale: 'compact' }, THEME);
    expect(large.type.title).toBeGreaterThan(normal.type.title);
    expect(compact.type.title).toBeLessThan(normal.type.title);
    expect(large.geom).toEqual(normal.geom);
  });

  test('άγνωστες επιλογές πέφτουν σε ασφαλείς προεπιλογές', () => {
    const d = resolveSlideDesign({ textScale: 'huge', footerMode: 'weird' }, THEME);
    expect(d.scaleId).toBe('normal');
    expect(d.footerMode).toBe('full');
    expect(d.sectionDividers).toBe(true);
    expect(d.coverStats).toBe(true);
  });

  test('παράγωγα χρώματα προκύπτουν από την παλέτα', () => {
    const d = resolveSlideDesign({}, THEME);
    expect(d.colors.hairline).toBe(mixHex(THEME.muted, THEME.surface, 0.74));
    expect(d.colors.accent).toBe('#2563eb');
    expect(d.colors.hairline).toMatch(/^#[0-9a-f]{6}$/);
  });

  test('υποσέλιδο ανά επιλογή χρήστη', () => {
    const base = { organizationTitle: 'Δήμος Αρχανών', periodLabel: 'Περίοδος 2024–2028', index: 2, total: 12 };
    const full = buildFooter({ design: resolveSlideDesign({ footerMode: 'full' }, THEME), ...base });
    expect(full.left).toContain('Δήμος Αρχανών');
    expect(full.left).toContain('Περίοδος 2024–2028');
    expect(full.left).toContain('ERGOHUB');
    expect(full.right).toBe('3 / 12');

    const minimal = buildFooter({ design: resolveSlideDesign({ footerMode: 'minimal' }, THEME), ...base });
    expect(minimal.left).toContain('ERGOHUB');
    expect(minimal.right).toBe('3 / 12');

    const none = buildFooter({ design: resolveSlideDesign({ footerMode: 'none' }, THEME), ...base });
    expect(none).toBeNull();
  });

  test('οι στήλες μοιράζονται το ωφέλιμο πλάτος', () => {
    const cols = columnLayout(3);
    const usable = SLIDE_W - GEOM.marginX * 2;
    expect(cols[0].x).toBe(GEOM.marginX);
    expect(cols[2].x + cols[2].width).toBeCloseTo(GEOM.marginX + usable, 5);
    expect(cols[0].width).toBeCloseTo(cols[2].width, 5);
  });
});

describe('συγχρονισμός renderer / main process', () => {
  test('ίδιες σταθερές καμβά και τυπογραφίας', () => {
    expect(mainDesign.SLIDE_W).toBe(SLIDE_W);
    expect(mainDesign.SLIDE_H).toBe(SLIDE_H);
    expect(mainDesign.BASE_TYPE).toEqual(BASE_TYPE);
    expect(mainDesign.GEOM).toEqual(GEOM);
    expect(mainDesign.TEXT_SCALES).toEqual(TEXT_SCALES);
    expect(mainDesign.FOOTER_MODES).toEqual(FOOTER_MODES);
  });

  test('ίδια tokens σχεδίασης από την ίδια εμφάνιση', () => {
    const appearance = { paletteId: 'municipal_blue', textScale: 'large', footerMode: 'minimal' };
    expect(resolveDesign(appearance)).toEqual(mainAppearance.resolveDesign(appearance));
  });

  test('ίδια κανονικοποίηση νέων παραμέτρων', () => {
    const raw = { textScale: 'compact', footerMode: 'none', sectionDividers: false, coverStats: false };
    expect(normalizeAppearance(raw)).toEqual(mainAppearance.normalizeAppearance(raw));
    const normalized = normalizeAppearance(raw);
    expect(normalized.textScale).toBe('compact');
    expect(normalized.footerMode).toBe('none');
    expect(normalized.sectionDividers).toBe(false);
    expect(normalized.coverStats).toBe(false);
  });
});

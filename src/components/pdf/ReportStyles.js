import { StyleSheet, Font } from '@react-pdf/renderer';

Font.register({
  family: 'DejaVu',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf', fontWeight: 'normal', fontStyle: 'normal' },
    { src: 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf', fontWeight: 'bold', fontStyle: 'normal' },
    { src: 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Oblique.ttf', fontWeight: 'normal', fontStyle: 'italic' },
    { src: 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-BoldOblique.ttf', fontWeight: 'bold', fontStyle: 'italic' },
  ],
});

/**
 * Print-safe palette — ανοιχτές αποχρώσεις για τα φόντα, σκούρα για κείμενο.
 * Όλες οι "Light" αποχρώσεις είναι >93% λευκές ώστε να τυπώνονται με ελάχιστη σπατάλη μελανιού.
 */
export const COLORS = {
  // ── Neutrals ──────────────────────────────────────────
  black:        '#1a1a1a',
  dark:         '#1e293b',
  mid:          '#475569',
  muted:        '#64748b',
  light:        '#94a3b8',
  hairline:     '#e2e8f0',
  rowAlt:       '#f8fafc',
  pageBg:       '#ffffff',

  // ── Indigo / Primary — ταυτότητα, βασικά στοιχεία ───
  accent:       '#3730a3',
  accentLight:  '#eef2ff',
  accentMid:    '#c7d2fe',

  // ── Sky / Κωδικοί ─────────────────────────────────────
  sky:          '#075985',
  skyLight:     '#f0f9ff',
  skyMid:       '#bae6fd',

  // ── Green / Χρηματοδότηση & Ποσά ─────────────────────
  green:        '#166534',
  greenLight:   '#f0fdf4',
  greenMid:     '#bbf7d0',

  // ── Teal / Ανάθεση & Διαδικασία ──────────────────────
  teal:         '#0d7490',
  tealLight:    '#f0fdfa',
  tealMid:      '#99f6e4',

  // ── Amber / REQ — Πρωτογενές αίτημα ─────────────────
  amber:        '#92400e',
  amberLight:   '#fffbeb',
  amberMid:     '#fde68a',

  // ── Violet / COMMIT — Ανάληψη υποχρέωσης ────────────
  violet:       '#5b21b6',
  violetLight:  '#f5f3ff',
  violetMid:    '#ddd6fe',

  // ── Purple / AWRD — Κατακύρωση ───────────────────────
  purple:       '#7e22ce',
  purpleLight:  '#faf5ff',
  purpleMid:    '#e9d5ff',

  // ── Rose / Συμβάσεις ΚΗΜΔΗΣ ──────────────────────────
  rose:         '#9f1239',
  roseLight:    '#fff1f2',
  roseMid:      '#fecdd3',

  // ── Slate / PAY — Εντάλματα ──────────────────────────
  slate:        '#334155',
  slateLight:   '#f8fafc',
  slateMid:     '#cbd5e1',

  // ── Warn / Προειδοποιήσεις ───────────────────────────
  warn:         '#92400e',
  warnBg:       '#fffbeb',
  warnBorder:   '#f59e0b',
};

/** A4 portrait: 595 × 842 pt */
export const PAGE_MARGIN_H = 42;
export const PAGE_MARGIN_TOP = 14;
export const PAGE_MARGIN_BOTTOM = 54;
/** Ύψος λιτής κεφαλίδας σελ. 2+ — συνυπολογίζεται στο paddingTop της σελίδας */
export const CONTINUATION_HEADER_H = 24;

export const S = StyleSheet.create({
  page: {
    fontFamily: 'DejaVu',
    backgroundColor: COLORS.pageBg,
    paddingTop: PAGE_MARGIN_TOP,
    paddingBottom: PAGE_MARGIN_BOTTOM,
    paddingHorizontal: PAGE_MARGIN_H,
  },

  headerBlock: {
    borderBottom: `2px solid ${COLORS.accent}`,
    paddingBottom: 9,
    marginBottom: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLogo: {
    width: 38,
    height: 38,
    objectFit: 'contain',
  },
  headerCenter: { flex: 1, paddingHorizontal: 10, alignItems: 'center' },
  headerRight:  { alignItems: 'flex-end', minWidth: 120 },
  headerTitle: {
    fontSize: 7,
    color: COLORS.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  headerOrgName: {
    fontSize: 10.5,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.dark,
    textAlign: 'right',
  },
  headerDept: {
    fontSize: 7.5,
    color: COLORS.muted,
    textAlign: 'right',
    marginTop: 1,
  },
  reportTitleBar: {
    backgroundColor: COLORS.accentLight,
    borderLeft: `3px solid ${COLORS.accent}`,
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportTitle: {
    fontSize: 10.5,
    fontFamily: 'DejaVu',
    fontWeight: 'bold',
    color: COLORS.accent,
    letterSpacing: 0.5,
  },
  reportDate: { fontSize: 7, color: COLORS.muted },

  body: {
    paddingTop: 4,
    paddingBottom: 4,
  },

  statsRow:  { flexDirection: 'row', gap: 6, marginBottom: 12 },
  statCard: {
    flex: 1,
    border: `1px solid ${COLORS.hairline}`,
    borderRadius: 4,
    borderTop: `2px solid ${COLORS.accent}`,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  statLabel: { fontSize: 6, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 3 },
  statValue: { fontSize: 14, fontFamily: 'DejaVu', fontWeight: 'bold', color: COLORS.dark },
  statSub:   { fontSize: 6, color: COLORS.muted, marginTop: 2 },

  sectionTitle: {
    fontSize: 8, fontFamily: 'DejaVu', fontWeight: 'bold',
    color: COLORS.accent, textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 4, marginTop: 2,
  },
  table: { width: '100%' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.accentLight,
    borderBottom: `1px solid ${COLORS.accentMid}`,
    paddingVertical: 4, paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontSize: 7, fontFamily: 'DejaVu', fontWeight: 'bold',
    color: COLORS.accent, paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 4,
    borderBottom: `1px solid ${COLORS.hairline}`,
  },
  tableRowEven: { backgroundColor: COLORS.rowAlt },
  tableRowOdd:  { backgroundColor: COLORS.pageBg },
  tableCell:    { fontSize: 7.5, color: COLORS.dark, paddingHorizontal: 4 },
  tableCellMuted: { fontSize: 7.5, color: COLORS.muted, paddingHorizontal: 4 },

  badge: {
    borderRadius: 3, paddingVertical: 2, paddingHorizontal: 5,
    fontSize: 6.5, fontFamily: 'DejaVu', fontWeight: 'bold', textAlign: 'center',
  },

  footer: {
    position: 'absolute',
    bottom: PAGE_MARGIN_BOTTOM - 38,
    left: PAGE_MARGIN_H,
    right: PAGE_MARGIN_H,
    borderTop: `1px solid ${COLORS.hairline}`,
    paddingTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.pageBg,
  },
  footerLeft:   { fontSize: 7, color: COLORS.accent, fontFamily: 'DejaVu', fontWeight: 'bold' },
  footerCenter: { fontSize: 7, color: COLORS.muted },
  footerRight:  { fontSize: 7, color: COLORS.muted },
  pageNumber:   { fontSize: 7, color: COLORS.muted },
});

export function formatAmount(val) {
  // Μηδενικό ποσό είναι έγκυρο — μην το εμφανίζεις ως παύλα
  if (val == null || val === '') return '—';
  const num = parseFloat(String(val).replace(/[.,]/g, (m, i, s) => {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastComma > lastDot) return m === ',' ? '.' : '';
    return m === '.' ? '.' : '';
  }));
  if (isNaN(num)) return String(val);
  return num.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const s = String(dateStr).trim();
  if (!s || s === '—') return '—';
  // YYYY-MM-DD (και ISO με ώρα) — χωρίς UTC shift
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) {
    return `${String(dmy[1]).padStart(2, '0')}/${String(dmy[2]).padStart(2, '0')}/${dmy[3]}`;
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function nowFormatted() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}  ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export function statusColor(status = '') {
  const s = status.toLowerCase();
  if (s.includes('εκτελ') || s.includes('υπο εκτελ')) return { bg: COLORS.skyLight,    text: COLORS.sky };
  if (s.includes('ολοκλ') || s.includes('αποπλ'))    return { bg: COLORS.greenLight,  text: COLORS.green };
  if (s.includes('ανεστ') || s.includes('ακυρ'))     return { bg: '#fff1f2',          text: '#b91c1c' };
  if (s.includes('υπογρ') || s.includes('σύμβ'))     return { bg: COLORS.amberLight,  text: COLORS.amber };
  if (s.includes('απενταγ'))                         return { bg: COLORS.slateLight,  text: COLORS.slate };
  return { bg: COLORS.slateLight, text: COLORS.slate };
}

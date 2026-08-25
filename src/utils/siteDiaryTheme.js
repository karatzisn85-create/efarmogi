/**
 * Κοινή οπτική γλώσσα του Ημερολογίου Εργοταξίου.
 *
 * Η παλέτα είναι το πετρόλ/κυανό της κατηγορίας «Διαδικασίες Έργων» (#0891b2),
 * ώστε η ενότητα να δένει με το σημείο απ' όπου ανοίγει και να ξεχωρίζει από το
 * πράσινο των Μελετών και το μωβ της Ωρίμανσης. Οι αποχρώσεις κατάστασης
 * (πράσινο / πορτοκαλί / κόκκινο / γκρι) είναι οι ίδιες με την υπόλοιπη εφαρμογή.
 */

export const C = {
  cyan: '#0891b2',
  cyanDark: '#0e7490',
  cyanDeep: '#155e75',
  cyanLight: '#ecfeff',
  cyanTint: '#cffafe',
  sky: '#06b6d4',
  teal: '#0d9488',
  indigo: '#6366f1',
  emerald: '#059669',
  amber: '#f59e0b',
  orange: '#ea580c',
  red: '#dc2626',
  rose: '#f43f5e',
  slate900: '#0f172a',
  slate800: '#1e293b',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748b',
  slate400: '#94a3b8',
  slate300: '#cbd5e1',
  slate200: '#e2e8f0',
  slate100: '#f1f5f9',
  slate50: '#f8fafc',
  white: '#ffffff',
};

export const HEADER_GRADIENT = `linear-gradient(135deg, ${C.slate800} 0%, ${C.cyanDark} 50%, ${C.sky} 100%)`;
export const HEADER_STRIPE = `linear-gradient(90deg, ${C.cyan}, ${C.sky}, ${C.teal}, ${C.indigo})`;
export const BODY_GRADIENT = `linear-gradient(180deg, ${C.cyanLight} 0%, ${C.slate50} 35%, ${C.slate50} 100%)`;
export const PRIMARY_GRADIENT = `linear-gradient(135deg, ${C.cyan} 0%, ${C.cyanDark} 100%)`;

const MONTHS_SHORT = ['ΙΑΝ', 'ΦΕΒ', 'ΜΑΡ', 'ΑΠΡ', 'ΜΑΪ', 'ΙΟΥΝ', 'ΙΟΥΛ', 'ΑΥΓ', 'ΣΕΠ', 'ΟΚΤ', 'ΝΟΕ', 'ΔΕΚ'];
const MONTHS_LONG = [
  'Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου',
  'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου',
];
const WEEKDAYS = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];

function parseIso(value) {
  const s = String(value || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** «25» — ο αριθμός της ημέρας για τη φούσκα του χρονολογίου. */
export function dayNumber(iso) {
  const d = parseIso(iso);
  return d ? String(d.getDate()) : '—';
}

/** «ΑΥΓ» */
export function monthShort(iso) {
  const d = parseIso(iso);
  return d ? MONTHS_SHORT[d.getMonth()] : '';
}

/** «Τρίτη» */
export function weekdayName(iso) {
  const d = parseIso(iso);
  return d ? WEEKDAYS[d.getDay()] : '';
}

/** «25 Αυγούστου 2026» */
export function longDate(iso) {
  const d = parseIso(iso);
  if (!d) return '—';
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** «25/08/2026» */
export function shortDate(iso) {
  const d = parseIso(iso);
  if (!d) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Σημερινή ημερομηνία σε μορφή για πεδίο ημερομηνίας (τοπική ώρα). */
export function todayInputValue() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function photoKey(subprojectId, entryId, name) {
  return `${subprojectId}|${entryId}|${name}`;
}

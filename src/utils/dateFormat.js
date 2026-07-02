/**
 * Ενιαία μορφοποίηση ημερομηνιών — πάντα DD/MM/YYYY (π.χ. 25/12/2026).
 * Για date-only ISO (YYYY-MM-DD) χωρίς UTC offset.
 */

/** Κανονικοποίηση σε YYYY-MM-DD (ISO date-only) */
export function toIsoDateOnly(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = parseAppDate(s);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseAppDate(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (!s) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dateOnly) {
    const y = Number(dateOnly[1]);
    const m = Number(dateOnly[2]) - 1;
    const d = Number(dateOnly[3]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return new Date(y, m, d, 0, 0, 0, 0);
  }

  const dmySlash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (dmySlash) {
    return new Date(Number(dmySlash[3]), Number(dmySlash[2]) - 1, Number(dmySlash[1]));
  }

  const dmyDash = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (dmyDash) {
    return new Date(Number(dmyDash[3]), Number(dmyDash[2]) - 1, Number(dmyDash[1]));
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Σύγκριση ημερομηνιών χωρίς ώρα/timezone — αρνητικό = a πριν από b */
export function compareAppDatesOnly(a, b) {
  const da = parseAppDate(a);
  const db = parseAppDate(b);
  if (!da || !db) return null;
  return da.getTime() - db.getTime();
}

export function isAppDateBefore(a, b) {
  const cmp = compareAppDatesOnly(a, b);
  return cmp != null && cmp < 0;
}

/** DD/MM/YYYY */
export function formatDateEl(value, empty = '—') {
  if (value == null || value === '') return empty;
  const d = parseAppDate(value);
  if (!d) return String(value);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/** DD/MM/YYYY HH:mm (ή μόνο ημερομηνία αν δεν υπάρχει ώρα) */
export function formatDateTimeEl(value, empty = '—') {
  if (value == null || value === '') return empty;
  const s = String(value).trim();
  const d = parseAppDate(value);
  if (!d) return String(value);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hasTime = /T|\d{1,2}:\d{2}/.test(s);
  if (!hasTime) return `${day}/${month}/${year}`;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

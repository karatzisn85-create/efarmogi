/**
 * Κοινή ανάλυση / μορφοποίηση ημερομηνιών ΚΗΜΔΗΣ (main process).
 * Αποφεύγει UTC offset σε date-only τιμές (π.χ. "2026-03-09").
 */

function parseKhmdhsDateTime(value) {
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

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysUntilKhmdhsDate(value) {
  const target = parseKhmdhsDateTime(value);
  if (!target) return null;
  const today = startOfLocalDay(new Date());
  const targetDay = startOfLocalDay(target);
  return Math.round((targetDay - today) / (24 * 60 * 60 * 1000));
}

function formatKhmdhsDateTimeEl(value) {
  const d = parseKhmdhsDateTime(value);
  if (!d) return '—';
  const hasTime = String(value).includes('T') && (d.getHours() !== 0 || d.getMinutes() !== 0);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  if (hasTime) {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
  return `${day}/${month}/${year}`;
}

module.exports = {
  parseKhmdhsDateTime,
  daysUntilKhmdhsDate,
  formatKhmdhsDateTimeEl,
};

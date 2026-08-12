/**
 * Κοινή λογική πυκνότητας / διάταξης Περιεχομένων απολογισμού
 * (οθόνη, PDF, PPTX).
 */

/** Από πόσα στοιχεία (κατηγορίες + πρόλογος Δημάρχου) αρχίζει συμπαγής λίστα. */
export const TOC_COMPACT_AT = 6;
/** Πιο πυκνή λίστα. */
export const TOC_DENSE_AT = 7;
/** Δύο στήλες όταν η λίστα γεμίζει υπερβολικά. */
export const TOC_TWO_COLUMN_AT = 9;

export function tocListCount(toc) {
  const items = Array.isArray(toc?.items) ? toc.items.length : 0;
  const preface = Array.isArray(toc?.preface) ? toc.preface.length : 0;
  return items + (preface > 0 ? 1 : 0);
}

export function resolveTocLayout(toc) {
  const listCount = tocListCount(toc);
  const compact = listCount >= TOC_COMPACT_AT;
  const dense = listCount >= TOC_DENSE_AT;
  const twoColumn = listCount >= TOC_TWO_COLUMN_AT;
  return {
    listCount,
    compact,
    dense,
    twoColumn,
    gap: dense ? 2 : compact ? 3 : 5,
    badge: dense ? 20 : compact ? 24 : 28,
    rowMaxH: dense ? 34 : compact ? 38 : 52,
    titleSizeKey: compact ? 'title' : 'titleSection',
  };
}

/**
 * Μοιράζει στοιχεία σε δύο στήλες (αριστερά ≈ μισό, δεξιά υπόλοιπο).
 * @param {Array} items
 * @returns {[Array, Array]}
 */
export function splitTocColumns(items) {
  const list = Array.isArray(items) ? items : [];
  if (list.length < 2) return [list, []];
  const mid = Math.ceil(list.length / 2);
  return [list.slice(0, mid), list.slice(mid)];
}

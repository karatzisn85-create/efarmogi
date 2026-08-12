/**
 * Κοινή λογική πυκνότητας / διάταξης Περιεχομένων απολογισμού
 * (οθόνη, PDF, PPTX) — main process mirror.
 */

const TOC_COMPACT_AT = 6;
const TOC_DENSE_AT = 7;
const TOC_TWO_COLUMN_AT = 9;

function tocListCount(toc) {
  const items = Array.isArray(toc?.items) ? toc.items.length : 0;
  const preface = Array.isArray(toc?.preface) ? toc.preface.length : 0;
  return items + (preface > 0 ? 1 : 0);
}

function resolveTocLayout(toc) {
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

function splitTocColumns(items) {
  const list = Array.isArray(items) ? items : [];
  if (list.length < 2) return [list, []];
  const mid = Math.ceil(list.length / 2);
  return [list.slice(0, mid), list.slice(mid)];
}

module.exports = {
  TOC_COMPACT_AT,
  TOC_DENSE_AT,
  TOC_TWO_COLUMN_AT,
  tocListCount,
  resolveTocLayout,
  splitTocColumns,
};

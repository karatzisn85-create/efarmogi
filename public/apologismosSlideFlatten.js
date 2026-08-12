/**
 * Κοινή ισοπέδωση διαφανειών παρουσίασης — ίδια σειρά για οθόνη / ελέγχους ισοδυναμίας.
 * @param {object} model presentation model από buildPresentationModel
 * @param {{ formatAmount?: (n: any) => string }} [opts]
 * @returns {Array<{ type: string }>}
 */
function formatAmountFallback(value) {
  if (value == null || value === '') return '—';
  let n;
  if (typeof value === 'number') n = value;
  else {
    const raw = String(value).trim();
    if (!raw) return '—';
    n = Number(raw.replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.'));
  }
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function flattenPresentationSlides(model, opts = {}) {
  const formatAmount = typeof opts.formatAmount === 'function'
    ? opts.formatAmount
    : formatAmountFallback;
  const slides = [];
  const cover = model?.cover || {};
  const showDividers = model?.design?.sectionDividers !== false;

  slides.push({
    type: 'cover',
    cover,
    totals: model?.totals,
    title: cover.reportTitle || 'Απολογισμός τεχνικού έργου',
    organizationTitle: cover.organizationTitle || '',
    subtitle: cover.subtitle || '',
    periodLabel: cover.periodLabel || model?.period?.label || '',
  });

  if (model?.toc?.items?.length) {
    slides.push({ type: 'toc', toc: model.toc });
  }
  if (model?.mayorMessage?.enabled) {
    slides.push({ type: 'mayor', mayorMessage: model.mayorMessage });
  }

  let sectionOrdinal = 0;
  for (const section of model?.sections || []) {
    if (showDividers) {
      sectionOrdinal += 1;
      slides.push({
        type: 'category',
        title: section.label,
        categoryId: section.categoryId,
        count: section.count,
        sectionIndex: sectionOrdinal,
        sectionTotal: (model.sections || []).length,
        heroPhoto: section.heroPhoto || null,
      });
    }
    for (const entry of section.cards || []) {
      const pages = entry.contentPages?.length
        ? entry.contentPages
        : [{ type: 'simple', role: 'primary' }];
      pages.forEach((page, idx) => {
        slides.push({
          type: 'project',
          pageType: page.type || 'simple',
          pageIndex: idx,
          sectionLabel: section.label,
          cardId: entry.card?.id || entry.id,
          hasMapSnapshot: !!(page.mapSnapshot || entry.card?.mapSnapshot),
          hasMapDrawing: !!(
            page.mapDrawing?.features?.length
            || entry.card?.mapDrawing?.features?.length
          ),
          approvedText: formatAmount(
            page.type === 'amounts' ? page.approvedAmount : entry.display?.approvedAmount
          ),
          contractText: formatAmount(
            page.type === 'amounts' ? page.contractAmount : entry.display?.contractAmount
          ),
        });
      });
    }
  }
  return slides;
}

function summarizeSlideTypes(slides) {
  return (slides || []).map((s) => {
    if (s.type === 'project') return `project:${s.pageType || 'simple'}`;
    return s.type;
  });
}

module.exports = {
  flattenPresentationSlides,
  summarizeSlideTypes,
  formatAmountFallback,
};

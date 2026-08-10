/**
 * Μοντέλο παρουσίασης απολογισμού (οθόνη / PDF / PPTX).
 */

const {
  CATEGORIES,
  getCategoryLabel,
  getCardReadiness,
  sortCardsByApprovedAmountDesc,
  getPrimaryPhoto,
  parseAmountNumber,
  sumAmounts,
  getVizMode,
  normalizeMetrics,
  photoPhaseLabelEl,
  showHeaderAmountsForPrimary,
  showHeaderNarrativeForPrimary,
  resolveVizId,
} = require('./apologismosDomain');
const appearanceMod = require('./apologismosAppearance');

/**
 * Διάταξη φωτογραφιών για συγκεκριμένο viz: κύριες πρώτα, επιπλέον σε gallery.
 */
function buildPhotoLayoutPlanForViz(card, vizId) {
  const viz = getVizMode(vizId);
  if (!viz || !viz.photoPhases.length) {
    return { primary: {}, leftovers: [], pages: [] };
  }
  const photos = card.photos || {};
  const primary = {};
  const leftovers = [];
  for (const phase of viz.photoPhases) {
    const list = Array.isArray(photos[phase]) ? photos[phase].filter(Boolean) : [];
    primary[phase] = list[0] || null;
    for (let i = 1; i < list.length; i += 1) {
      leftovers.push({
        phase,
        phaseLabel: photoPhaseLabelEl(phase),
        photo: list[i],
        index: i,
      });
    }
  }
  const pages = [];
  pages.push({ type: 'primary_photos', primary, vizId });
  for (let i = 0; i < leftovers.length; i += 2) {
    pages.push({
      type: 'gallery',
      items: leftovers.slice(i, i + 2),
      vizId,
    });
  }
  return { primary, leftovers, pages };
}

/** Πίσω συμβατότητα: layout για primary viz. */
function buildPhotoLayoutPlan(card) {
  return buildPhotoLayoutPlanForViz(card, card?.primaryViz);
}

/**
 * Σελίδες παρουσίασης ανά τρόπο οπτικοποίησης (primary ή secondary).
 */
function buildVizContentPages(card, vizId, role) {
  const viz = getVizMode(vizId);
  if (!viz) return [];
  const pages = [];
  const base = {
    role,
    vizId,
    vizLabel: viz.label,
  };

  if (viz.photoPhases.length) {
    const layout = buildPhotoLayoutPlanForViz(card, vizId);
    for (const page of layout.pages) {
      pages.push({ ...base, ...page });
    }
    return pages;
  }

  if (viz.id === 'map_path' || viz.id === 'map_multi') {
    pages.push({
      ...base,
      type: 'map',
      mapSnapshot: card.mapSnapshot || null,
      mapPoints: card.mapPoints || [],
      mapLine: card.mapLine || null,
    });
    return pages;
  }

  if (viz.id === 'metrics_table') {
    pages.push({
      ...base,
      type: 'metrics',
      metrics: normalizeMetrics(card.metrics),
    });
    return pages;
  }

  if (viz.id === 'economy_phases') {
    pages.push({
      ...base,
      type: 'amounts',
      mode: viz.id,
      approvedAmount: card.approvedAmount,
      contractAmount: card.contractAmount,
    });
    return pages;
  }

  // simple_card — τονισμένο κείμενο ως σώμα
  pages.push({
    ...base,
    type: 'simple',
    narrative: card.narrative || '',
    emphasizeNarrative: true,
  });
  return pages;
}

function buildCardPresentationEntry(card) {
  const primaryViz = resolveVizId(card.primaryViz) || card.primaryViz;
  const secondaryViz = card.secondaryViz ? resolveVizId(card.secondaryViz) : null;
  const primaryPages = buildVizContentPages(card, primaryViz, 'primary');
  const secondaryPages = secondaryViz
    ? buildVizContentPages(card, secondaryViz, 'secondary')
    : [];
  const contentPages = [...primaryPages, ...secondaryPages];
  if (contentPages.length === 0) {
    contentPages.push({
      role: 'primary',
      vizId: primaryViz,
      type: 'simple',
      narrative: card.narrative || '',
      emphasizeNarrative: true,
    });
  }

  return {
    card,
    photoLayout: buildPhotoLayoutPlan(card),
    contentPages,
    display: {
      title: card.title,
      narrative: card.narrative,
      area: card.area || '',
      approvedAmount: card.approvedAmount,
      contractAmount: card.contractAmount,
      primaryViz,
      secondaryViz: secondaryViz || null,
      showHeaderAmounts: showHeaderAmountsForPrimary(primaryViz),
      showHeaderNarrative: showHeaderNarrativeForPrimary(primaryViz),
      metrics: normalizeMetrics(card.metrics),
      mapPoints: card.mapPoints || [],
      mapLine: card.mapLine || null,
    },
  };
}

function buildCategorySections(readyCards) {
  const sorted = sortCardsByApprovedAmountDesc(readyCards);
  const byCat = {};
  for (const card of sorted) {
    const id = card.categoryId;
    if (!byCat[id]) byCat[id] = [];
    byCat[id].push(card);
  }
  const sections = [];
  for (const cat of CATEGORIES) {
    const cards = byCat[cat.id] || [];
    if (!cards.length) continue;
    sections.push({
      categoryId: cat.id,
      label: cat.label,
      count: cards.length,
      totalApproved: sumAmounts(cards, 'approvedAmount'),
      totalContract: sumAmounts(cards, 'contractAmount'),
      cards: cards.map((card) => buildCardPresentationEntry(card)),
    });
  }
  return sections;
}

/**
 * @param {object} report
 * @param {object} period
 * @param {object} [opts]
 * @param {object} [opts.appConfig]
 */
function buildPresentationModel(report, period, opts = {}) {
  const allCards = Array.isArray(report?.cards) ? report.cards : [];
  const readyCards = allCards.filter((c) => getCardReadiness(c).ready);
  const sections = buildCategorySections(readyCards);
  const appearance = appearanceMod.normalizeAppearance(report?.appearance);
  const theme = appearanceMod.resolveTheme(appearance);
  const organizationTitle = appearanceMod.resolveOrganizationTitle(opts.appConfig || {});
  const cover = appearanceMod.buildCoverDisplay({
    appearance,
    period,
    organizationTitle,
  });
  const motion = appearanceMod.resolveMotion(appearance);

  return {
    period: period
      ? {
          id: period.id,
          label: period.label || `Δημοτική περίοδος ${period.startYear}–${period.endYear}`,
          startYear: period.startYear,
          endYear: period.endYear,
        }
      : null,
    totals: {
      projectCount: readyCards.length,
      totalApproved: sumAmounts(readyCards, 'approvedAmount'),
      totalContract: sumAmounts(readyCards, 'contractAmount'),
    },
    sections,
    pendingCount: allCards.length - readyCards.length,
    appearance,
    theme,
    cover,
    motion,
  };
}

function formatAmountEl(value) {
  const n = parseAmountNumber(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

module.exports = {
  buildPhotoLayoutPlan,
  buildPhotoLayoutPlanForViz,
  buildVizContentPages,
  buildCardPresentationEntry,
  buildCategorySections,
  buildPresentationModel,
  formatAmountEl,
  getCategoryLabel,
  getPrimaryPhoto,
};

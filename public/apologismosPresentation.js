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
  cardShowsFinalContractAmountInPresentation,
  FINAL_CONTRACT_AFTER_APE_SHORT_LABEL,
  FINAL_CONTRACT_AFTER_APE_FULL_LABEL,
  FINAL_CONTRACT_AFTER_APE_EXPLANATION,
} = require('./apologismosDomain');
const appearanceMod = require('./apologismosAppearance');

function finalAmountPresentationFields(card) {
  const show = cardShowsFinalContractAmountInPresentation(card);
  if (!show) {
    return {
      showFinalContractAmount: false,
      finalContractAmountAfterApe: '',
      finalContractApeDate: '',
      finalContractAmountShortLabel: FINAL_CONTRACT_AFTER_APE_SHORT_LABEL,
      finalContractAmountFullLabel: FINAL_CONTRACT_AFTER_APE_FULL_LABEL,
      finalContractAmountExplanation: FINAL_CONTRACT_AFTER_APE_EXPLANATION,
    };
  }
  return {
    showFinalContractAmount: true,
    finalContractAmountAfterApe: card.finalContractAmountAfterApe,
    finalContractApeDate: card.finalContractApeDate || '',
    finalContractAmountShortLabel: FINAL_CONTRACT_AFTER_APE_SHORT_LABEL,
    finalContractAmountFullLabel: FINAL_CONTRACT_AFTER_APE_FULL_LABEL,
    finalContractAmountExplanation: FINAL_CONTRACT_AFTER_APE_EXPLANATION,
  };
}
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
      ...finalAmountPresentationFields(card),
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
      ...finalAmountPresentationFields(card),
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
 * Περιεχόμενα παρουσίασης — μετά το εξώφυλλο (σελ. 1) και τη σελίδα περιεχομένων (σελ. 2).
 * Αν υπάρχει μήνυμα Δημάρχου, μπαίνει στη σελ. 3 και οι κατηγορίες από τη σελ. 4.
 * Κάθε κατηγορία δείχνει πλήθος παρεμβάσεων και τη σελίδα από την οποία ξεκινά.
 */
function buildPresentationToc(sections, design, totals, period, opts = {}) {
  const showDividers = design?.sectionDividers !== false;
  const mayorEnabled = opts.mayorEnabled === true;
  // Σελ. 1 εξώφυλλο · σελ. 2 περιεχόμενα · [σελ. 3 μήνυμα Δημάρχου] · κατηγορίες
  let page = mayorEnabled ? 4 : 3;
  const preface = mayorEnabled
    ? [{ label: appearanceMod.MAYOR_MESSAGE_TITLE || 'Μήνυμα Δημάρχου', startPage: 3 }]
    : [];
  const items = [];
  for (const section of sections || []) {
    const startPage = page;
    if (showDividers) page += 1;
    for (const entry of section.cards || []) {
      const n = entry.contentPages?.length ? entry.contentPages.length : 1;
      page += Math.max(1, n);
    }
    items.push({
      index: items.length + 1,
      categoryId: section.categoryId,
      label: section.label,
      count: section.count,
      startPage,
      totalApproved: section.totalApproved,
      totalContract: section.totalContract,
    });
  }
  return {
    title: 'Περιεχόμενα',
    periodLabel: period?.label || '',
    categoryCount: items.length,
    projectCount: totals?.projectCount ?? items.reduce((acc, it) => acc + (it.count || 0), 0),
    totalApproved: totals?.totalApproved ?? 0,
    totalContract: totals?.totalContract ?? 0,
    preface,
    items,
    totalPages: Math.max(2, page - 1),
  };
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
  const design = appearanceMod.resolveDesign(appearance);
  const periodInfo = period
    ? {
        id: period.id,
        label: period.label || `Δημοτική περίοδος ${period.startYear}–${period.endYear}`,
        startYear: period.startYear,
        endYear: period.endYear,
      }
    : null;
  const totals = {
    projectCount: readyCards.length,
    totalApproved: sumAmounts(readyCards, 'approvedAmount'),
    totalContract: sumAmounts(readyCards, 'contractAmount'),
  };
  const mayorRaw = appearance.mayorMessage || appearanceMod.emptyMayorMessage();
  // Μόνο πλήρες μήνυμα (κείμενο + φωτό) μπαίνει στην παρουσίαση / TOC.
  const mayorEnabled = mayorRaw.enabled === true
    && !!String(mayorRaw.text || '').trim()
    && !!mayorRaw.photo?.relativePath;
  const mayorMessage = mayorEnabled
    ? {
        enabled: true,
        title: appearanceMod.MAYOR_MESSAGE_TITLE || 'Μήνυμα Δημάρχου',
        mayorName: mayorRaw.mayorName || '',
        text: mayorRaw.text || '',
        photo: mayorRaw.photo || null,
      }
    : { enabled: false };

  return {
    period: periodInfo,
    totals,
    sections,
    toc: buildPresentationToc(sections, design, totals, periodInfo, { mayorEnabled }),
    mayorMessage,
    pendingCount: allCards.length - readyCards.length,
    appearance,
    theme,
    design,
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
  buildPresentationToc,
  buildPresentationModel,
  formatAmountEl,
  getCategoryLabel,
  getPrimaryPhoto,
};

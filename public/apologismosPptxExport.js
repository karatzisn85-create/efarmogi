/**
 * Εξαγωγή απολογισμού σε PowerPoint.
 *
 * Χρησιμοποιεί τον ίδιο καμβά αναφοράς 960×540 με την παρουσίαση οθόνης και το
 * PDF — κάθε συντεταγμένη μετατρέπεται σε ίντσες (1 μονάδα = 1/96 in) και κάθε
 * μέγεθος γραμματοσειράς σε στιγμές (1 μονάδα = 0.75 pt).
 */
const PptxGenJS = require('pptxgenjs');
const { formatAmountEl } = require('./apologismosPresentation');
const domain = require('./apologismosDomain');
const design = require('./apologismosSlideDesign');
const appearanceMod = require('./apologismosAppearance');

const FONT = 'Arial';
const U = design.toInches;
const F = design.toPptxFont;
const { SLIDE_W, SLIDE_H } = design;

function hx(color, fallback = '1e293b') {
  const s = String(color || '').replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : fallback;
}

function resolveDesignFor(model) {
  if (model?.design?.colors && model?.design?.type) return model.design;
  return appearanceMod.resolveDesign(model?.appearance);
}

/** Χρώματα παλέτας σε μορφή PowerPoint (χωρίς #). */
function paletteOf(d) {
  const c = d.colors;
  return {
    surface: hx(c.surface, 'ffffff'),
    bg: hx(c.bg, 'f8fafc'),
    text: hx(c.text, '0f172a'),
    muted: hx(c.muted, '64748b'),
    accent: hx(c.accent, '2563eb'),
    accentText: hx(c.accentText, 'ffffff'),
    darkBand: hx(c.darkBand, '1e293b'),
    darkText: hx(c.darkText, 'ffffff'),
    cardDark: hx(c.cardDark, '334155'),
    hairline: hx(c.hairline, 'e2e8f0'),
    darkHairline: hx(c.darkHairline, '475569'),
    darkMuted: hx(c.darkMuted, '94a3b8'),
    panel: hx(c.panel, 'f1f5f9'),
    panelBorder: hx(c.panelBorder, 'cbd5e1'),
    darkGhost: hx(c.darkGhost, '243244'),
    photoFrame: hx(c.photoFrame, 'cbd5e1'),
    photoPlaceholder: hx(c.photoPlaceholder, 'e2e8f0'),
  };
}

function upper(text) {
  return String(text || '').toLocaleUpperCase('el-GR');
}

/** Κείμενο με συντεταγμένες σε μονάδες καμβά. */
function addText(slide, text, opts) {
  const {
    x, y, w, size, lines = 1, color, bold = false, caps = false,
    spacing = 0, align = 'left', italic = false, lineSpacingUnits,
  } = opts;
  if (text == null || text === '') return;
  slide.addText(caps ? upper(text) : String(text), {
    x: U(x),
    y: U(y),
    w: U(w),
    h: U(size * 1.3 * lines),
    fontSize: F(size),
    fontFace: FONT,
    color,
    bold,
    italic,
    align,
    valign: 'top',
    margin: 0,
    charSpacing: spacing ? F(size) * spacing : 0,
    lineSpacing: lineSpacingUnits ? F(lineSpacingUnits) : undefined,
    shrinkText: true,
  });
}

function addRect(slide, pptx, { x, y, w, h, color, transparency, radius }) {
  slide.addShape(radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {
    x: U(x),
    y: U(y),
    w: U(w),
    h: U(h),
    fill: transparency ? { color, transparency } : { color },
    line: { type: 'none' },
    ...(radius ? { rectRadius: U(radius) } : {}),
  });
}

function tryAddImage(slide, resolveMedia, rel, opts) {
  if (!rel || !resolveMedia) return false;
  try {
    const abs = resolveMedia(rel);
    if (!abs) return false;
    slide.addImage({ path: abs, ...opts });
    return true;
  } catch (_) {
    return false;
  }
}

function addPhoto(slide, resolveMedia, rel, { x, y, w, h, fit = 'cover' }) {
  return tryAddImage(slide, resolveMedia, rel, {
    x: U(x),
    y: U(y),
    w: U(w),
    h: U(h),
    sizing: { type: fit, w: U(w), h: U(h) },
  });
}

function dataUrlToPptxData(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  if (dataUrl.startsWith('data:')) return dataUrl.slice('data:'.length);
  if (dataUrl.toLowerCase().includes('base64,')) return dataUrl;
  return null;
}

function addCoverImage(slide, resolveMedia, img, frameDataUrl, box) {
  const b64 = dataUrlToPptxData(frameDataUrl);
  if (b64) {
    try {
      slide.addImage({ data: b64, x: U(box.x), y: U(box.y), w: U(box.w), h: U(box.h) });
      return true;
    } catch (_) { /* fallback στην αρχική φωτογραφία */ }
  }
  return addPhoto(slide, resolveMedia, img?.relativePath, box);
}

/** Κατακόρυφη στοίβα στοιχείων με γνωστό συνολικό ύψος. */
function makeStack() {
  const ops = [];
  let height = 0;
  return {
    add(h, draw, gapAfter = 0) {
      const offset = height;
      ops.push({ offset, draw });
      height += h + gapAfter;
    },
    gap(h) { height += h; },
    get height() { return height; },
    render(startY) { ops.forEach((op) => op.draw(startY + op.offset)); },
  };
}

const STAT_COL_W = 175;
const STAT_GAP = 26;

function statStripHeight(d) {
  return d.type.statLabel * 1.3 + 4 + d.type.statValue * 1.3;
}

function addStatStrip(slide, pptx, d, p, { x, y, stats, onDark = false, colWidth = STAT_COL_W }) {
  const labelColor = onDark ? p.darkMuted : p.muted;
  const valueColor = onDark ? p.darkText : p.text;
  stats.forEach((s, i) => {
    const sx = x + i * (colWidth + STAT_GAP);
    addRect(slide, pptx, { x: sx, y, w: 3, h: statStripHeight(d), color: p.accent });
    addText(slide, s.label, {
      x: sx + 11, y, w: colWidth - 11, size: d.type.statLabel, color: labelColor,
      bold: true, caps: true, spacing: 0.09,
    });
    addText(slide, s.value, {
      x: sx + 11,
      y: y + d.type.statLabel * 1.3 + 4,
      w: colWidth - 11,
      size: d.type.statValue,
      color: valueColor,
      bold: true,
    });
  });
}

function addKpiCards(slide, pptx, d, p, { y, items, height = design.GEOM.kpiH }) {
  const g = design.GEOM;
  const cols = design.columnLayout(items.length);
  items.forEach((k, i) => {
    const col = cols[i];
    const fill = k.tone === 'accent' ? p.accent : p.cardDark;
    const fg = k.tone === 'accent' ? p.accentText : p.darkText;
    addRect(slide, pptx, { x: col.x, y, w: col.width, h: height, color: fill, radius: g.cardRadius });
    addText(slide, k.label, {
      x: col.x + g.kpiPad, y: y + g.kpiPad + 2, w: col.width - g.kpiPad * 2,
      size: d.type.kpiLabel, color: fg, bold: true, caps: true, spacing: 0.08,
    });
    addText(slide, k.value, {
      x: col.x + g.kpiPad,
      y: y + g.kpiPad + d.type.kpiLabel * 1.3 + 10,
      w: col.width - g.kpiPad * 2,
      size: k.big ? d.type.kpiValueHero : d.type.kpiValue,
      color: fg,
      bold: true,
    });
  });
}

function addFooter(slide, pptx, d, p, { footerBase, index, total, onDark = false }) {
  if (!footerBase) return;
  const g = design.GEOM;
  const w = SLIDE_W - g.marginX * 2;
  addRect(slide, pptx, {
    x: g.marginX, y: g.footerRuleY, w, h: 1,
    color: onDark ? p.darkHairline : p.hairline,
  });
  const color = onDark ? p.darkMuted : p.muted;
  if (footerBase.left) {
    addText(slide, footerBase.left, {
      x: g.marginX, y: g.footerTextY, w: w * 0.7, size: d.type.footer,
      color, caps: true, bold: true, spacing: 0.06,
    });
  }
  addText(slide, `${index + 1} / ${total}`, {
    x: g.marginX + w * 0.7, y: g.footerTextY, w: w * 0.3, size: d.type.footer,
    color, bold: true, align: 'right',
  });
}

function addCoverMeta(slide, pptx, d, p, { model, x, width, bottom, centerY = null }) {
  const cover = model.cover || {};
  const totals = model.totals || {};
  const t = d.type;
  const g = design.GEOM;
  const stack = makeStack();

  stack.add(5, (y) => addRect(slide, pptx, { x, y, w: g.coverRuleW, h: 5, color: p.accent }), 18);

  if (cover.organizationTitle) {
    stack.add(t.eyebrow * 1.3, (y) => addText(slide, cover.organizationTitle, {
      x, y, w: width, size: t.eyebrow, color: p.darkText, bold: true, caps: true, spacing: 0.14,
    }), 12);
  }

  const title = cover.reportTitle || 'Απολογισμός τεχνικού έργου';
  stack.add(t.titleHero * 1.24, (y) => addText(slide, title, {
    x, y, w: width, size: t.titleHero, color: p.darkText, bold: true,
  }), 12);

  const periodLabel = cover.periodLabel || model.period?.label || '';
  if (periodLabel) {
    stack.add(t.subtitle * 1.3, (y) => addText(slide, periodLabel, {
      x, y, w: width, size: t.subtitle, color: p.darkText,
    }), cover.subtitle ? 6 : 0);
  }

  if (cover.subtitle) {
    stack.add(t.body * 1.4, (y) => addText(slide, cover.subtitle, {
      x, y, w: width, size: t.body, color: p.darkMuted,
    }));
  }

  if (d.coverStats) {
    stack.gap(20);
    stack.add(statStripHeight(d), (y) => addStatStrip(slide, pptx, d, p, {
      x,
      y,
      onDark: true,
      colWidth: Math.min(STAT_COL_W, (width - STAT_GAP * 2) / 3),
      stats: [
        { label: 'Έργα', value: String(totals.projectCount ?? 0) },
        { label: 'Εγκεκριμένα', value: formatAmountEl(totals.totalApproved) },
        { label: 'Συμβάσεις', value: formatAmountEl(totals.totalContract) },
      ],
    }));
  }

  const startY = centerY != null
    ? centerY - stack.height / 2
    : bottom - stack.height;
  stack.render(startY);
}

function addCoverSlide(pptx, model, d, p, resolveMedia, coverFrames = []) {
  const g = design.GEOM;
  const cover = model.cover || {};
  const imgs = cover.images || [];
  const slide = pptx.addSlide();
  addRect(slide, pptx, { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, color: p.darkBand });

  const layoutId = cover.layoutId || 'hero_single';

  if (layoutId === 'hero_side') {
    const imgW = Math.round(SLIDE_W * 0.52);
    addCoverImage(slide, resolveMedia, imgs[0], coverFrames[0], { x: 0, y: 0, w: imgW, h: SLIDE_H });
    addCoverMeta(slide, pptx, d, p, {
      model,
      x: imgW + g.coverPadX,
      width: SLIDE_W - imgW - g.coverPadX * 2,
      centerY: SLIDE_H / 2,
    });
    return;
  }

  if (layoutId === 'hero_split') {
    const half = Math.round((SLIDE_W - 3) / 2);
    addCoverImage(slide, resolveMedia, imgs[0], coverFrames[0], { x: 0, y: 0, w: half, h: SLIDE_H });
    addRect(slide, pptx, { x: half, y: 0, w: 3, h: SLIDE_H, color: p.accent });
    addCoverImage(slide, resolveMedia, imgs[1], coverFrames[1], { x: half + 3, y: 0, w: half, h: SLIDE_H });
  } else {
    addCoverImage(slide, resolveMedia, imgs[0], coverFrames[0], { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H });
  }

  // Σκίαση ώστε τα κείμενα να διαβάζονται πάνω από τη φωτογραφία.
  design.coverScrimBands().forEach((band) => {
    addRect(slide, pptx, {
      x: 0, y: band.y, w: SLIDE_W, h: band.height,
      color: p.darkBand, transparency: Math.round((1 - band.alpha) * 100),
    });
  });

  addCoverMeta(slide, pptx, d, p, {
    model,
    x: g.coverPadX,
    width: SLIDE_W - g.coverPadX * 2,
    bottom: SLIDE_H - g.coverPadY,
  });
}

function addCategorySlide(pptx, section, d, p, footerCtx, sectionIndex, sectionTotal) {
  const g = design.GEOM;
  const t = d.type;
  const slide = pptx.addSlide();
  addRect(slide, pptx, { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, color: p.darkBand });

  addText(slide, String(sectionIndex || ''), {
    x: SLIDE_W - g.marginX - 210, y: 54, w: 210, size: 210,
    color: p.darkGhost, bold: true, align: 'right',
  });

  const blockH = 5 + 18 + t.eyebrow * 1.3 + 12 + t.titleSection * 1.24 + 28 + g.kpiH;
  let y = (g.contentBottom + g.marginTop) / 2 - blockH / 2;

  addRect(slide, pptx, { x: g.marginX, y, w: g.coverRuleW, h: 5, color: p.accent });
  y += 5 + 18;
  addText(slide, sectionIndex && sectionTotal
    ? `Κατηγορία ${sectionIndex} από ${sectionTotal}`
    : 'Κατηγορία έργων', {
    x: g.marginX, y, w: 600, size: t.eyebrow, color: p.darkMuted, bold: true, caps: true, spacing: 0.14,
  });
  y += t.eyebrow * 1.3 + 12;
  addText(slide, section.label, {
    x: g.marginX, y, w: 700, size: t.titleSection, color: p.darkText, bold: true,
  });
  y += t.titleSection * 1.24 + 28;

  addKpiCards(slide, pptx, d, p, {
    y,
    items: [
      { label: 'Έργα', value: String(section.count), tone: 'accent', big: true },
      { label: 'Εγκεκριμένα', value: formatAmountEl(section.totalApproved), tone: 'dark' },
      { label: 'Συμβάσεις', value: formatAmountEl(section.totalContract), tone: 'dark' },
    ],
  });

  addFooter(slide, pptx, d, p, { ...footerCtx, onDark: true });
}

function addPhotoColumns(slide, pptx, d, p, resolveMedia, items) {
  const g = design.GEOM;
  const t = d.type;
  if (!items.length) return;
  const cols = design.columnLayout(items.length);
  const capH = t.caption * 1.3 + 8;
  items.forEach((item, i) => {
    const col = cols[i];
    addRect(slide, pptx, {
      x: col.x, y: g.contentTop + t.caption * 0.35, w: 6, h: 6, color: p.accent, radius: 3,
    });
    addText(slide, item.caption, {
      x: col.x + 13, y: g.contentTop, w: col.width - 13, size: t.caption,
      color: p.muted, bold: true, caps: true, spacing: 0.08,
    });
    const boxY = g.contentTop + capH;
    const boxH = g.contentBottom - boxY;
    addRect(slide, pptx, {
      x: col.x, y: boxY, w: col.width, h: boxH, color: p.photoPlaceholder, radius: g.cardRadius,
    });
    addPhoto(slide, resolveMedia, item.photo, { x: col.x, y: boxY, w: col.width, h: boxH });
  });
}

function addProjectSlides(pptx, entry, d, p, resolveMedia, sectionLabel, footerFor) {
  const g = design.GEOM;
  const t = d.type;
  const { card, display, contentPages } = entry;
  const pages = contentPages?.length ? contentPages : [{ type: 'simple', role: 'primary' }];
  const contentW = SLIDE_W - g.marginX * 2;

  pages.forEach((page, pageIndex) => {
    const slide = pptx.addSlide();
    addRect(slide, pptx, { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, color: p.surface });

    addText(slide, sectionLabel || '', {
      x: g.marginX, y: g.marginTop, w: contentW, size: t.eyebrow,
      color: p.muted, bold: true, caps: true, spacing: 0.14,
    });
    addText(slide, display.title || card.title, {
      x: g.marginX, y: g.marginTop + t.eyebrow * 1.3 + 8, w: contentW,
      size: t.title, color: p.text, bold: true, lines: 2,
    });

    const isFirst = pageIndex === 0;
    const showStats = isFirst && display.showHeaderAmounts !== false;
    const showNarrative = isFirst && display.showHeaderNarrative !== false && !!display.narrative;
    const metaBottom = g.contentTop - 12;

    if (showStats) {
      const stats = [
        { label: 'Εγκεκριμένο', value: formatAmountEl(display.approvedAmount) },
        { label: 'Συμβατικό', value: formatAmountEl(display.contractAmount) },
      ];
      if (display.area) stats.push({ label: 'Περιοχή', value: display.area });
      addStatStrip(slide, pptx, d, p, {
        x: g.marginX,
        y: metaBottom - statStripHeight(d),
        stats,
      });
    } else {
      let metaY = metaBottom - t.body * 1.3;
      if (page.role === 'secondary' && page.vizLabel) {
        addText(slide, page.vizLabel || page.vizId, {
          x: g.marginX, y: metaY, w: contentW, size: t.caption,
          color: p.muted, bold: true, caps: true, spacing: 0.09,
        });
        metaY -= t.caption * 1.3 + 4;
      }
      if (display.area) {
        addText(slide, display.area, {
          x: g.marginX, y: metaY, w: contentW, size: t.body, color: p.muted,
        });
      }
    }

    if (showNarrative) {
      const narrativeTop = g.marginTop + t.eyebrow * 1.3 + 8 + t.title * 1.24 + 8;
      addText(slide, display.narrative, {
        x: g.marginX,
        y: narrativeTop,
        w: contentW,
        size: t.body,
        color: p.text,
        lines: showStats ? 2 : 3,
        lineSpacingUnits: t.body * 1.35,
      });
    }

    const contentH = g.contentBottom - g.contentTop;

    if (page.type === 'primary_photos' || page.type === 'primary') {
      const primary = page.primary || {};
      const items = Object.keys(primary)
        .filter((k) => primary[k])
        .map((k) => ({ caption: domain.photoPhaseLabelEl(k), photo: primary[k] }));
      addPhotoColumns(slide, pptx, d, p, resolveMedia, items);
    } else if (page.type === 'gallery') {
      const items = (page.items || []).map((item) => ({
        caption: item.phaseLabel || domain.photoPhaseLabelEl(item.phase),
        photo: item.photo,
      }));
      addPhotoColumns(slide, pptx, d, p, resolveMedia, items);
    } else if (page.type === 'map') {
      addRect(slide, pptx, {
        x: g.marginX, y: g.contentTop, w: contentW, h: contentH,
        color: p.panel, radius: g.cardRadius,
      });
      const ok = page.mapSnapshot
        ? addPhoto(slide, resolveMedia, page.mapSnapshot, {
            x: g.marginX, y: g.contentTop, w: contentW, h: contentH, fit: 'contain',
          })
        : false;
      if (!ok) {
        addText(
          slide,
          (page.mapPoints || [])
            .map((pt, i) => `${i + 1}. ${pt.label || `Σημείο ${i + 1}`} — ${pt.lat}, ${pt.lng}`)
            .join('\n') || 'Χάρτης έργου',
          { x: g.marginX + 20, y: g.contentTop + 20, w: contentW - 40, size: t.body, color: p.text, lines: 8 }
        );
      }
    } else if (page.type === 'metrics') {
      const rows = page.metrics || [];
      const half = Math.ceil(rows.length / 2);
      const columns = [rows.slice(0, half), rows.slice(half)].filter((c) => c.length);
      const colW = (contentW - 40) / 2;
      const rowH = Math.min(42, contentH / Math.max(1, half));
      const blockTop = g.contentTop + Math.max(0, (contentH - rowH * half) / 2);
      columns.forEach((col, ci) => {
        const cx = g.marginX + ci * (colW + 40);
        col.forEach((m, i) => {
          const ry = blockTop + i * rowH;
          addText(slide, m.label, {
            x: cx, y: ry + 8, w: colW * 0.6, size: t.body, color: p.muted,
          });
          addText(slide, m.value, {
            x: cx + colW * 0.6, y: ry + 4, w: colW * 0.4, size: t.statValue,
            color: p.text, bold: true, align: 'right',
          });
          addRect(slide, pptx, { x: cx, y: ry + rowH - 1, w: colW, h: 1, color: p.hairline });
        });
      });
    } else if (page.type === 'amounts') {
      const cardH = 128;
      addKpiCards(slide, pptx, d, p, {
        y: g.contentTop + (contentH - cardH) / 2,
        height: cardH,
        items: [
          { label: 'Εγκεκριμένο ποσό', value: formatAmountEl(page.approvedAmount), tone: 'accent' },
          { label: 'Συμβατικό ποσό', value: formatAmountEl(page.contractAmount), tone: 'dark' },
        ],
      });
    } else {
      const narrative = page.narrative || display.narrative || '';
      const lines = 5;
      const blockH = t.narrative * 1.5 * lines;
      const blockY = g.contentTop + Math.max(0, (contentH - blockH) / 2);
      addRect(slide, pptx, { x: g.marginX, y: blockY, w: 4, h: blockH, color: p.accent });
      addText(slide, narrative, {
        x: g.marginX + 20, y: blockY, w: Math.min(760, contentW - 20),
        size: t.narrative, color: p.text, bold: true, lines,
        lineSpacingUnits: t.narrative * 1.5,
      });
    }

    addFooter(slide, pptx, d, p, footerFor());
  });
}

/** Συναρμολόγηση των διαφανειών (χωρίς εγγραφή αρχείου) — χρήσιμο και για tests. */
function composeApologismosDeck(model, { resolveMedia, coverFrames = [] } = {}) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'LAYOUT_16x9', width: 10, height: 5.625 });
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'ERGOHUB';
  pptx.title = model.period?.label || 'Απολογισμός';

  const d = resolveDesignFor(model);
  const p = paletteOf(d);

  // Πρώτο πέρασμα: πλήθος διαφανειών, ώστε το υποσέλιδο να δείχνει «x / σύνολο».
  let total = 1;
  for (const section of model.sections || []) {
    if (d.sectionDividers) total += 1;
    for (const entry of section.cards || []) {
      total += entry.contentPages?.length ? entry.contentPages.length : 1;
    }
  }

  const footerBase = design.buildFooter({
    design: d,
    organizationTitle: model.cover?.organizationTitle,
    periodLabel: model.cover?.periodLabel || model.period?.label,
  });
  let index = 0;
  const nextFooter = () => {
    const ctx = { footerBase, index, total };
    index += 1;
    return ctx;
  };

  addCoverSlide(pptx, model, d, p, resolveMedia, coverFrames);
  index += 1;

  const sectionTotal = (model.sections || []).length;
  let sectionOrdinal = 0;
  for (const section of model.sections || []) {
    if (d.sectionDividers) {
      sectionOrdinal += 1;
      addCategorySlide(pptx, section, d, p, nextFooter(), sectionOrdinal, sectionTotal);
    }
    for (const entry of section.cards || []) {
      addProjectSlides(pptx, entry, d, p, resolveMedia, section.label, nextFooter);
    }
  }

  return pptx;
}

async function buildApologismosPptx(model, opts = {}) {
  const pptx = composeApologismosDeck(model, opts);
  const output = await pptx.write({ outputType: 'nodebuffer' });
  const buf = Buffer.from(output);
  const motionOn = model?.motion?.enabled === true
    || model?.appearance?.motionEnabled === true;
  if (!motionOn) return buf;
  const { applyFormalSlideTransitions } = require('./apologismosPptxMotion');
  return applyFormalSlideTransitions(buf, { enabled: true });
}

module.exports = {
  buildApologismosPptx,
  composeApologismosDeck,
};

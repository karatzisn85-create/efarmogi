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
const tocLayout = require('./apologismosTocLayout');
const { APOLOGISMOS_PPTX_FONT_FACE } = require('./apologismosFonts');

const FONT = APOLOGISMOS_PPTX_FONT_FACE;
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
    accentSoft: hx(c.accentSoft, 'dbeafe'),
  };
}

function upper(text) {
  return String(text || '').toLocaleUpperCase('el-GR');
}

/**
 * Διακριτικό λογότυπο δήμου ανά τύπο διαφάνειας
 * (cover / backdrop / content — όχι σε σκούρες διαφάνειες κατηγορίας).
 */
function addMunicipalityBrand(slide, branding, variant = 'content') {
  const data = dataUrlToPptxData(branding?.showLogo ? branding.logoDataUrl : null);
  if (!data) return;
  if (variant === 'cover') {
    slide.addImage({
      data,
      x: U(SLIDE_W * 0.29),
      y: U(SLIDE_H * 0.22),
      w: U(SLIDE_W * 0.42),
      h: U(SLIDE_H * 0.42),
      transparency: 93,
    });
    slide.addImage({
      data,
      x: U(SLIDE_W - 156),
      y: U(28),
      w: U(120),
      h: U(58),
      transparency: 8,
    });
    return;
  }
  if (variant === 'backdrop') {
    slide.addImage({
      data,
      x: U(SLIDE_W - 380),
      y: U(SLIDE_H / 2 - 210),
      w: U(420),
      h: U(420),
      transparency: 91,
    });
    return;
  }
  if (variant === 'content') {
    slide.addImage({
      data,
      x: U(SLIDE_W - design.GEOM.marginX - 96),
      y: U(22),
      w: U(96),
      h: U(36),
      transparency: 78,
    });
  }
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
  const n = Math.max(1, (stats || []).length);
  const stripW = colWidth * n + STAT_GAP * Math.max(0, n - 1);
  const valueSizes = design.resolveStatValueSizes(stats, {
    totalWidth: stripW,
    gap: STAT_GAP,
    maxSize: d.type.statValue,
  });
  const valueH = Math.max(...valueSizes, d.type.statValue) * 1.3;
  const stripH = d.type.statLabel * 1.3 + 4 + valueH;
  (stats || []).forEach((s, i) => {
    const sx = x + i * (colWidth + STAT_GAP);
    const displayValue = design.keepAmountTogether(s.value);
    addRect(slide, pptx, { x: sx, y, w: 3, h: stripH, color: p.accent });
    addText(slide, s.label, {
      x: sx + 11, y, w: colWidth - 11, size: d.type.statLabel, color: labelColor,
      bold: true, caps: true, spacing: 0.09,
    });
    addText(slide, displayValue, {
      x: sx + 11,
      y: y + d.type.statLabel * 1.3 + 4,
      w: colWidth - 11,
      size: valueSizes[i] || d.type.statValue,
      color: valueColor,
      bold: true,
    });
  });
}

function addKpiCards(slide, pptx, d, p, { y, items, height = design.GEOM.kpiH }) {
  const g = design.GEOM;
  const cols = design.columnLayout(items.length);
  const valueSizes = design.resolveKpiValueSizes(items, { maxSize: d.type.kpiValue });
  items.forEach((k, i) => {
    const col = cols[i];
    const fill = k.tone === 'accent' ? p.accent : p.cardDark;
    const fg = k.tone === 'accent' ? p.accentText : p.darkText;
    addRect(slide, pptx, { x: col.x, y, w: col.width, h: height, color: fill, radius: g.cardRadius });
    addText(slide, k.label, {
      x: col.x + g.kpiPad, y: y + g.kpiPad + 2, w: col.width - g.kpiPad * 2,
      size: d.type.kpiLabel, color: fg, bold: true, caps: true, spacing: 0.08,
    });
    addText(slide, design.keepAmountTogether(k.value), {
      x: col.x + g.kpiPad,
      y: y + g.kpiPad + d.type.kpiLabel * 1.3 + 10,
      w: col.width - g.kpiPad * 2,
      size: valueSizes[i] || d.type.kpiValue,
      color: fg,
      bold: true,
    });
    if (k.note) {
      addText(slide, k.note, {
        x: col.x + g.kpiPad,
        y: y + height - g.kpiPad - d.type.caption * 1.4,
        w: col.width - g.kpiPad * 2,
        size: Math.max(10, d.type.caption - 1),
        color: fg,
        bold: true,
        lines: 2,
      });
    }
  });
}

/** Πίνακας αποτελεσμάτων — κάρτες με χρώμα παλέτας (ίδιο πνεύμα με την οθόνη). */
function addMetricsBoard(slide, pptx, d, p, { y, height, rows }) {
  const g = design.GEOM;
  const list = (rows || []).filter((r) => r && (r.label || r.value));
  const contentW = SLIDE_W - g.marginX * 2;
  const layout = design.resolveMetricsBoardLayout({
    count: list.length,
    availableHeight: height,
    type: d.type,
  });
  const {
    cols, gap, cardH, headH, padV, padH, labelSize, valueSize, dense, indexSize, labelMaxLines,
  } = layout;
  const badge = dense ? 24 : 28;

  addRect(slide, pptx, {
    x: g.marginX, y: y + 2, w: badge, h: badge, color: p.accent, radius: 8,
  });
  addText(slide, String(list.length), {
    x: g.marginX, y: y + (dense ? 5 : 7), w: badge, size: dense ? 11 : 12,
    color: p.accentText, bold: true, align: 'center',
  });
  addText(slide, 'Πίνακας αποτελεσμάτων', {
    x: g.marginX + badge + 10, y: y + 2, w: 360, size: Math.max(9, d.type.caption - (dense ? 1 : 0)),
    color: p.accent, bold: true, caps: true, spacing: 0.12,
  });
  if (!dense) {
    addText(slide, 'Μετρήσιμα μεγέθη του έργου', {
      x: g.marginX + badge + 10, y: y + 18, w: 320, size: d.type.caption, color: p.muted, bold: true,
    });
  }

  if (!list.length) return;

  const gridTop = y + headH + 4;
  const cardW = cols === 1 ? contentW : (contentW - gap) / 2;
  const labelBlockH = labelSize * 1.25 * labelMaxLines;

  list.forEach((m, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = g.marginX + col * (cardW + gap);
    const cy = gridTop + row * (cardH + gap);
    const featured = i % 2 === 0;
    addRect(slide, pptx, {
      x: cx, y: cy, w: cardW, h: cardH,
      color: featured ? p.accentSoft : p.surface,
      radius: dense ? 9 : 12,
    });
    addRect(slide, pptx, {
      x: cx, y: cy, w: 5, h: cardH, color: p.accent,
    });
    addText(slide, m.label, {
      x: cx + padH, y: cy + padV, w: cardW - padH - 36, size: labelSize,
      color: p.muted, bold: true, caps: true, spacing: 0.06, lines: labelMaxLines,
    });
    addText(slide, String(i + 1).padStart(2, '0'), {
      x: cx + cardW - 34, y: cy + padV, w: 24, size: indexSize,
      color: p.accent, bold: true, align: 'right',
    });
    addText(slide, m.value, {
      x: cx + padH, y: cy + padV + labelBlockH + 2,
      w: cardW - padH * 2, size: valueSize,
      color: featured ? p.accent : p.text, bold: true, lines: 1,
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
  const creditColor = onDark ? '94a3b8' : '94a3b8';
  if (footerBase.left) {
    addText(slide, footerBase.left, {
      x: g.marginX, y: g.footerTextY, w: w * 0.52, size: d.type.footer,
      color, bold: false, spacing: 0,
    });
  }
  let rightX = g.marginX + w * 0.62;
  if (footerBase.credit) {
    addText(slide, footerBase.credit, {
      x: rightX, y: g.footerTextY, w: w * 0.18, size: Math.max(9, d.type.footer - 0.5),
      color: creditColor, bold: false, align: 'right', spacing: 0,
    });
    rightX = g.marginX + w * 0.82;
  }
  addText(slide, `${index + 1} / ${total}`, {
    x: rightX, y: g.footerTextY, w: g.marginX + w - rightX, size: d.type.footer,
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
    addMunicipalityBrand(slide, model.branding, 'cover');
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
  addMunicipalityBrand(slide, model.branding, 'cover');
}

function addTocSlide(pptx, toc, d, p, footerCtx, branding = null) {
  const g = design.GEOM;
  const t = d.type;
  const items = toc?.items || [];
  const preface = toc?.preface || [];
  const layout = tocLayout.resolveTocLayout(toc);
  const { compact, dense } = layout;
  // Δύο στήλες εφαρμόζονται σε οθόνη/PDF· στο PPTX μένει μία πυκνή στήλη.
  const slide = pptx.addSlide();
  addRect(slide, pptx, { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, color: p.surface });
  addMunicipalityBrand(slide, branding, 'backdrop');
  addRect(slide, pptx, { x: 0, y: 0, w: 8, h: SLIDE_H, color: p.accent });

  const titleSize = compact ? t.title : t.titleSection;
  addText(slide, 'Οδηγός παρουσίασης', {
    x: g.marginX + 12, y: g.marginTop, w: 420, size: t.eyebrow,
    color: p.accent, bold: true, caps: true, spacing: 0.14,
  });
  addText(slide, toc?.title || 'Περιεχόμενα', {
    x: g.marginX + 12, y: g.marginTop + (compact ? 18 : 22), w: 520, size: titleSize,
    color: p.text, bold: true,
  });

  const chips = [
    { label: 'Κατηγορίες', value: String(toc?.categoryCount ?? items.length) },
    { label: 'Παρεμβάσεις', value: String(toc?.projectCount ?? 0) },
    { label: 'Εγκεκριμένα', value: formatAmountEl(toc?.totalApproved) },
  ];
  let chipX = g.marginX + 12;
  const chipY = g.marginTop + (compact ? 56 : 78);
  if (toc?.periodLabel) {
    addText(slide, toc.periodLabel, {
      x: g.marginX + 12, y: chipY - (compact ? 14 : 16), w: 280, size: t.caption, color: p.muted, bold: true,
    });
    chipX = g.marginX + 290;
  }
  chips.forEach((chip) => {
    const chipW = chip.label === 'Εγκεκριμένα' ? (compact ? 190 : 210) : (compact ? 120 : 140);
    addRect(slide, pptx, {
      x: chipX, y: chipY, w: chipW, h: compact ? 24 : 28, color: p.accentSoft, radius: 14,
    });
    addText(slide, `${chip.label}  ${chip.value}`, {
      x: chipX + 8, y: chipY + (compact ? 5 : 7), w: chipW - 16, size: compact ? 10 : 11,
      color: p.accent, bold: true, caps: true, spacing: 0.05,
    });
    chipX += chipW + 8;
  });

  let cursorY = chipY + (compact ? 30 : 40);
  const rowW = SLIDE_W - g.marginX * 2 - 12;
  const badge = dense ? 18 : compact ? 20 : 24;
  const nameSize = dense ? 11 : compact ? t.body - 0.5 : t.body;
  const pageSize = dense ? t.body : compact ? t.statValue - 1 : t.statValue;

  preface.forEach((pf) => {
    const prefH = compact ? 30 : 34;
    addRect(slide, pptx, {
      x: g.marginX + 12, y: cursorY, w: rowW, h: prefH,
      color: p.accentSoft, radius: 8,
    });
    addRect(slide, pptx, {
      x: g.marginX + 18, y: cursorY + (prefH - badge) / 2, w: badge, h: badge,
      color: p.accent, radius: 6,
    });
    addText(slide, '—', {
      x: g.marginX + 18, y: cursorY + (prefH - 10) / 2, w: badge, size: 10,
      color: p.accentText, bold: true, align: 'center',
    });
    addText(slide, pf.label, {
      x: g.marginX + 50, y: cursorY + (prefH - nameSize) / 2, w: 420, size: nameSize, color: p.text, bold: true,
    });
    addText(slide, '—', {
      x: g.marginX + 540, y: cursorY + (prefH - 10) / 2, w: 110, size: 10, color: p.muted, bold: true, align: 'right',
    });
    addText(slide, String(pf.startPage), {
      x: g.marginX + 670, y: cursorY + (prefH - pageSize) / 2, w: 60,
      size: pageSize, color: p.accent, bold: true, align: 'right',
    });
    cursorY += prefH + 6;
  });

  addText(slide, 'Κατηγορία', {
    x: g.marginX + 52, y: cursorY, w: 360, size: 9, color: p.muted, bold: true, caps: true, spacing: 0.1,
  });
  addText(slide, 'Παρεμβάσεις', {
    x: g.marginX + 540, y: cursorY, w: 110, size: 9, color: p.muted, bold: true, caps: true, align: 'right', spacing: 0.1,
  });
  addText(slide, 'Σελ.', {
    x: g.marginX + 670, y: cursorY, w: 60, size: 9, color: p.muted, bold: true, caps: true, align: 'right', spacing: 0.1,
  });

  const listTop = cursorY + 16;
  const avail = g.contentBottom - listTop;
  const n = Math.max(1, items.length);
  // Ισόποση κατανομή ώστε να χωρούν όλες οι γραμμές πριν το υποσέλιδο.
  const rowH = Math.min(dense ? 32 : compact ? 36 : 42, Math.max(dense ? 22 : 28, Math.floor(avail / n)));

  items.forEach((it, i) => {
    const y = listTop + i * rowH;
    const featured = i % 2 === 0;
    const innerH = Math.max(22, rowH - 3);
    addRect(slide, pptx, {
      x: g.marginX + 12, y, w: rowW, h: innerH,
      color: featured ? p.accentSoft : p.panel, radius: 8,
    });
    const badgeY = y + Math.max(2, (innerH - badge) / 2);
    addRect(slide, pptx, {
      x: g.marginX + 18, y: badgeY, w: badge, h: badge,
      color: featured ? p.accent : p.surface, radius: 6,
    });
    addText(slide, String(it.index).padStart(2, '0'), {
      x: g.marginX + 18, y: badgeY + 3, w: badge, size: dense ? 9 : 10,
      color: featured ? p.accentText : p.accent, bold: true, align: 'center',
    });
    const textY = compact ? y + Math.max(2, (innerH - nameSize * 2.2) / 2) : y + 3;
    addText(slide, it.label, {
      x: g.marginX + 50, y: textY, w: 420, size: nameSize, color: p.text, bold: true,
    });
    addText(slide, compact
      ? formatAmountEl(it.totalApproved)
      : `Εγκεκριμένα ${formatAmountEl(it.totalApproved)}`, {
      x: g.marginX + 50, y: textY + nameSize + 1, w: 420, size: compact ? 9 : 10, color: p.muted, bold: true,
    });
    addText(slide, String(it.count), {
      x: g.marginX + 540, y: y + Math.max(4, (innerH - nameSize) / 2), w: 110,
      size: nameSize, color: p.text, bold: true, align: 'right',
    });
    addText(slide, String(it.startPage), {
      x: g.marginX + 670, y: y + Math.max(3, (innerH - pageSize) / 2), w: 60,
      size: pageSize, color: p.accent, bold: true, align: 'right',
    });
  });

  addFooter(slide, pptx, d, p, footerCtx);
}

function addMayorSlide(pptx, mayorMessage, d, p, resolveMedia, footerCtx, branding = null) {
  const g = design.GEOM;
  const t = d.type;
  const mm = mayorMessage || {};
  const slide = pptx.addSlide();
  addRect(slide, pptx, { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, color: p.surface });
  addMunicipalityBrand(slide, branding, 'backdrop');
  addRect(slide, pptx, { x: 0, y: 0, w: 8, h: SLIDE_H, color: p.accent });

  const photoX = g.marginX + 24;
  const photoY = g.marginTop + 18;
  const photoW = 220;
  const photoH = 280;
  addRect(slide, pptx, {
    x: photoX, y: photoY, w: photoW, h: photoH, color: p.panel, radius: 14,
  });
  const framed = dataUrlToPptxData(mm.photo?.framedDataUrl);
  if (framed) {
    try {
      slide.addImage({
        data: framed,
        x: U(photoX), y: U(photoY), w: U(photoW), h: U(photoH),
      });
    } catch (_) {
      addPhoto(slide, resolveMedia, mm.photo?.relativePath, {
        x: photoX, y: photoY, w: photoW, h: photoH,
      });
    }
  } else {
    const ok = addPhoto(slide, resolveMedia, mm.photo?.relativePath, {
      x: photoX, y: photoY, w: photoW, h: photoH,
    });
    if (!ok) {
      addText(slide, 'Φωτογραφία Δημάρχου', {
        x: photoX + 16, y: photoY + photoH / 2 - 8, w: photoW - 32, size: t.caption,
        color: p.muted, bold: true, align: 'center',
      });
    }
  }
  addRect(slide, pptx, {
    x: photoX, y: photoY, w: 5, h: photoH, color: p.accent,
  });

  const name = String(mm.mayorName || '').trim();
  let labelY = photoY + photoH + 12;
  if (name) {
    addText(slide, name, {
      x: photoX, y: labelY, w: photoW, size: t.body, color: p.text, bold: true, align: 'center',
    });
    labelY += t.body + 4;
  }
  addText(slide, 'Δήμαρχος', {
    x: photoX, y: labelY, w: photoW, size: t.caption, color: p.accent, bold: true, align: 'center', caps: true, spacing: 0.12,
  });

  const textX = photoX + photoW + 36;
  const textW = SLIDE_W - textX - g.marginX;
  addText(slide, 'Οδηγός παρουσίασης', {
    x: textX, y: g.marginTop + 24, w: textW, size: t.eyebrow,
    color: p.accent, bold: true, caps: true, spacing: 0.14,
  });
  addText(slide, mm.title || 'Μήνυμα Δημάρχου', {
    x: textX, y: g.marginTop + 48, w: textW, size: t.titleSection, color: p.text, bold: true,
  });
  addRect(slide, pptx, {
    x: textX, y: g.marginTop + 92, w: 56, h: 4, color: p.accent, radius: 2,
  });
  addText(slide, String(mm.text || '').trim() || '—', {
    x: textX, y: g.marginTop + 114, w: textW,
    size: t.body + 1, color: p.text, bold: false, lines: 12,
  });

  addFooter(slide, pptx, d, p, footerCtx);
}

function addCategorySlide(pptx, section, d, p, footerCtx, sectionIndex, sectionTotal, resolveMedia, branding = null) {
  const g = design.GEOM;
  const t = d.type;
  const slide = pptx.addSlide();
  addRect(slide, pptx, { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, color: p.darkBand });
  if (section.heroPhoto) {
    addPhoto(slide, resolveMedia, section.heroPhoto, {
      x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, fit: 'cover',
    });
    addRect(slide, pptx, {
      x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, color: p.darkBand, transparency: 55,
    });
  }

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

function addProjectSlides(pptx, entry, d, p, resolveMedia, sectionLabel, footerFor, branding = null) {
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
    const officialTitleLabel = display.officialTitleLabel
      || ((display.title || card.title) ? 'Επίσημος τίτλος' : '');
    const titleKindTop = g.marginTop + t.eyebrow * 1.3 + 6;
    const titleKindSize = Math.max(10, t.caption);
    if (officialTitleLabel) {
      addText(slide, officialTitleLabel, {
        x: g.marginX, y: titleKindTop, w: contentW, size: titleKindSize,
        color: p.accent, bold: true, caps: true, spacing: 0.1,
      });
    }
    const titleTop = officialTitleLabel
      ? titleKindTop + titleKindSize * 1.3 + 6
      : g.marginTop + t.eyebrow * 1.3 + 8;
    const titleText = display.title || card.title || '';
    const titleSize = design.fitTitleFontSize(titleText, {
      maxWidth: contentW,
      maxSize: t.title,
      minSize: Math.max(14, t.title - 12),
      maxLines: 2,
    });
    addText(slide, titleText, {
      x: g.marginX, y: titleTop, w: contentW,
      size: titleSize, color: p.text, bold: true, lines: 2,
    });

    const hasImpact = !!String(display.impactLine || '').trim();
    const titleLines = Math.min(
      2,
      Math.max(1, design.estimateWrappedLineCount(titleText, titleSize, contentW) || 1)
    );
    let cursorY = titleTop + titleSize * 1.25 * titleLines;
    if (hasImpact) {
      const impactSize = design.fitTitleFontSize(display.impactLine, {
        maxWidth: contentW,
        maxSize: t.subtitle,
        minSize: Math.max(11, t.subtitle - 5),
        maxLines: 1,
      });
      addText(slide, display.impactLine, {
        x: g.marginX, y: cursorY + 4, w: contentW,
        size: impactSize, color: p.accent, bold: true, lines: 1,
      });
      cursorY += 4 + impactSize * 1.25;
    }

    const isFirst = pageIndex === 0;
    const showStats = isFirst && display.showHeaderAmounts !== false;
    const showNarrative = isFirst && display.showHeaderNarrative !== false && !!display.narrative;
    const metaBottom = g.contentTop - 12;
    const statsH = showStats ? statStripHeight(d) : 0;
    const statsY = showStats ? metaBottom - statsH : metaBottom;
    // Αν η κεφαλίδα φουσκώσει (μεγάλη κλίμακα κειμένου), μην επικαλύπτει τα ποσά.
    if (cursorY > statsY - 4) {
      cursorY = Math.max(titleTop + titleSize * 1.15, statsY - 4);
    }

    if (showStats) {
      const stats = [
        { label: 'Εγκεκριμένο', value: formatAmountEl(display.approvedAmount) },
        { label: 'Συμβατικό', value: formatAmountEl(display.contractAmount) },
      ];
      if (display.showFinalContractAmount) {
        stats.push({
          label: display.finalContractAmountShortLabel || 'Τελικό μετά ΑΠΕ',
          value: formatAmountEl(display.finalContractAmountAfterApe),
        });
      }
      if (display.area) stats.push({ label: 'Περιοχή', value: display.area });
      addStatStrip(slide, pptx, d, p, {
        x: g.marginX,
        y: metaBottom - statsH,
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
      const narrativeTop = cursorY + 8;
      const narrativeBottom = metaBottom - (showStats ? statsH + 6 : 4);
      const lineH = t.body * 1.35;
      const narrativeLines = design.resolveProjectHeaderNarrativeLines({
        type: t,
        hasImpact,
        showStats,
        titleSize,
        titleText,
        titleMaxWidth: contentW,
        hasOfficialTitleLabel: !!officialTitleLabel,
      });
      if (narrativeLines > 0 && narrativeBottom > narrativeTop + lineH * 0.8) {
        addText(slide, display.narrative, {
          x: g.marginX,
          y: narrativeTop,
          w: contentW,
          size: t.body,
          color: p.text,
          lines: narrativeLines,
          lineSpacingUnits: lineH,
        });
      }
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
      addMetricsBoard(slide, pptx, d, p, {
        y: g.contentTop,
        height: contentH,
        rows: page.metrics || [],
      });
    } else if (page.type === 'amounts') {
      const showFinal = !!page.showFinalContractAmount;
      const items = [
        { label: 'Εγκεκριμένο ποσό', value: formatAmountEl(page.approvedAmount), tone: 'accent' },
        { label: 'Συμβατικό ποσό', value: formatAmountEl(page.contractAmount), tone: 'dark' },
      ];
      if (showFinal) {
        items.push({
          label: page.finalContractAmountShortLabel || 'Τελικό μετά ΑΠΕ',
          value: formatAmountEl(page.finalContractAmountAfterApe),
          tone: 'dark',
          note: 'Διαμορφωθέν μετά από αναθεωρήσεις',
        });
      }
      const cardH = design.resolveAmountsKpiHeight({
        itemCount: items.length,
        availableHeight: contentH,
        hasNote: showFinal,
      });
      addKpiCards(slide, pptx, d, p, {
        y: g.contentTop + (contentH - cardH - (showFinal ? 36 : 0)) / 2,
        height: cardH,
        items,
      });
      if (showFinal) {
        addText(slide, page.finalContractAmountExplanation || '', {
          x: g.marginX,
          y: g.contentTop + (contentH - cardH - 36) / 2 + cardH + 10,
          w: contentW,
          size: d.type.caption,
          color: p.muted,
          bold: true,
          lines: 2,
        });
      }
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

    addMunicipalityBrand(slide, branding, 'content');
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
  const branding = model.branding || null;

  // Πρώτο πέρασμα: πλήθος διαφανειών, ώστε το υποσέλιδο να δείχνει «x / σύνολο».
  const hasToc = !!(model.toc?.items?.length);
  const hasMayor = !!(model.mayorMessage?.enabled);
  let total = 1 + (hasToc ? 1 : 0) + (hasMayor ? 1 : 0);
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
  if (hasToc) {
    addTocSlide(pptx, model.toc, d, p, nextFooter(), branding);
  }
  if (hasMayor) {
    addMayorSlide(pptx, model.mayorMessage, d, p, resolveMedia, nextFooter(), branding);
  }

  const sectionTotal = (model.sections || []).length;
  let sectionOrdinal = 0;
  for (const section of model.sections || []) {
    if (d.sectionDividers) {
      sectionOrdinal += 1;
      addCategorySlide(pptx, section, d, p, nextFooter(), sectionOrdinal, sectionTotal, resolveMedia, branding);
    }
    for (const entry of section.cards || []) {
      addProjectSlides(pptx, entry, d, p, resolveMedia, section.label, nextFooter, branding);
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

/**
 * Εξαγωγή απολογισμού σε PowerPoint — ίδια δομή/θέμα με την παρουσίαση οθόνης.
 */
const PptxGenJS = require('pptxgenjs');
const { formatAmountEl } = require('./apologismosPresentation');
const domain = require('./apologismosDomain');

const FONT = 'Arial';

function hex(c, fallback = '1e293b') {
  const s = String(c || fallback).replace(/^#/, '');
  return s.length === 6 ? s : fallback;
}

function themeOf(model) {
  const t = model?.theme || {};
  return {
    bg: hex(t.bg, 'f8fafc'),
    surface: hex(t.surface, 'ffffff'),
    text: hex(t.text, '0f172a'),
    muted: hex(t.muted, '64748b'),
    accent: hex(t.accent, '2563eb'),
    accentText: hex(t.accentText, 'ffffff'),
    darkBand: hex(t.darkBand, '1e293b'),
    darkText: hex(t.darkText, 'ffffff'),
    cardDark: hex(t.cardDark, '334155'),
  };
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

function dataUrlToPptxData(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  if (dataUrl.startsWith('data:')) return dataUrl.slice('data:'.length);
  if (dataUrl.toLowerCase().includes('base64,')) return dataUrl;
  return null;
}

function tryAddFramedOrPath(slide, resolveMedia, img, frameDataUrl, opts) {
  const b64 = dataUrlToPptxData(frameDataUrl);
  if (b64) {
    try {
      slide.addImage({ data: b64, ...opts });
      return true;
    } catch (_) { /* fallback */ }
  }
  return tryAddImage(slide, resolveMedia, img?.relativePath, opts);
}

function addCoverSlide(pptx, model, resolveMedia, coverFrames = []) {
  const theme = themeOf(model);
  const cover = model.cover || {};
  const imgs = cover.images || [];
  const slide = pptx.addSlide();
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 10, h: 5.625, fill: { color: theme.darkBand },
  });

  const layoutId = cover.layoutId || 'hero_single';
  if (layoutId === 'hero_split') {
    tryAddFramedOrPath(slide, resolveMedia, imgs[0], coverFrames[0], { x: 0, y: 0, w: 5, h: 5.625 });
    tryAddFramedOrPath(slide, resolveMedia, imgs[1], coverFrames[1], { x: 5, y: 0, w: 5, h: 5.625 });
  } else if (layoutId === 'hero_side') {
    tryAddFramedOrPath(slide, resolveMedia, imgs[0], coverFrames[0], { x: 0, y: 0, w: 5.2, h: 5.625 });
  } else {
    tryAddFramedOrPath(slide, resolveMedia, imgs[0], coverFrames[0], { x: 0, y: 0, w: 10, h: 5.625 });
  }

  const totalsLine = `${model.totals.projectCount} έργα · Εγκεκριμένα ${formatAmountEl(model.totals.totalApproved)} · Συμβάσεις ${formatAmountEl(model.totals.totalContract)}`;

  if (layoutId === 'hero_side') {
    const textX = 5.4;
    const textW = 4.2;
    let y = 1.35;
    if (cover.organizationTitle) {
      slide.addText(cover.organizationTitle, {
        x: textX, y, w: textW, h: 0.3, fontSize: 13, fontFace: FONT, color: theme.darkText,
      });
      y += 0.35;
    }
    slide.addText(cover.reportTitle || 'Απολογισμός τεχνικού έργου', {
      x: textX, y, w: textW, h: 0.55, fontSize: 24, bold: true, fontFace: FONT, color: theme.darkText,
    });
    y += 0.55;
    slide.addText(cover.periodLabel || model.period?.label || '', {
      x: textX, y, w: textW, h: 0.3, fontSize: 14, fontFace: FONT, color: theme.darkText,
    });
    y += 0.35;
    if (cover.subtitle) {
      slide.addText(cover.subtitle, {
        x: textX, y, w: textW, h: 0.28, fontSize: 12, fontFace: FONT, color: theme.darkText,
      });
      y += 0.35;
    }
    // Ίδια KPI με οθόνη: Έργα + Εγκεκριμένα
    slide.addShape(pptx.ShapeType.roundRect, {
      x: textX, y: y + 0.1, w: 1.9, h: 1.15,
      fill: { color: theme.accent }, rectRadius: 0.08,
    });
    slide.addText('Έργα', {
      x: textX + 0.12, y: y + 0.2, w: 1.65, h: 0.25, fontSize: 11, fontFace: FONT, color: theme.accentText,
    });
    slide.addText(String(model.totals.projectCount), {
      x: textX + 0.12, y: y + 0.5, w: 1.65, h: 0.5, fontSize: 24, bold: true, fontFace: FONT, color: theme.accentText,
    });
    slide.addShape(pptx.ShapeType.roundRect, {
      x: textX + 2.1, y: y + 0.1, w: 2.0, h: 1.15,
      fill: { color: theme.cardDark }, rectRadius: 0.08,
    });
    slide.addText('Εγκεκριμένα', {
      x: textX + 2.22, y: y + 0.2, w: 1.75, h: 0.25, fontSize: 11, fontFace: FONT, color: theme.darkText,
    });
    slide.addText(formatAmountEl(model.totals.totalApproved), {
      x: textX + 2.22, y: y + 0.5, w: 1.75, h: 0.5, fontSize: 12, bold: true, fontFace: FONT, color: theme.darkText,
    });
    return;
  }

  const textX = 0.5;
  const textW = 9;
  const textY = 3.15;
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 3.0, w: 10, h: 2.625, fill: { color: '000000', transparency: 40 },
  });
  if (cover.organizationTitle) {
    slide.addText(cover.organizationTitle, {
      x: textX, y: textY, w: textW, h: 0.3, fontSize: 13, fontFace: FONT, color: theme.darkText,
    });
  }
  slide.addText(cover.reportTitle || 'Απολογισμός τεχνικού έργου', {
    x: textX, y: textY + 0.3, w: textW, h: 0.45, fontSize: 26, bold: true, fontFace: FONT, color: theme.darkText,
  });
  slide.addText(cover.periodLabel || model.period?.label || '', {
    x: textX, y: textY + 0.8, w: textW, h: 0.3, fontSize: 14, fontFace: FONT, color: theme.darkText,
  });
  if (cover.subtitle) {
    slide.addText(cover.subtitle, {
      x: textX, y: textY + 1.1, w: textW, h: 0.28, fontSize: 12, fontFace: FONT, color: theme.darkText,
    });
  }
  slide.addText(totalsLine, {
    x: textX, y: textY + 1.45, w: textW, h: 0.35, fontSize: 12, bold: true, fontFace: FONT, color: theme.accent,
  });
}

function addCategorySlide(pptx, section, theme) {
  const slide = pptx.addSlide();
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 10, h: 5.625, fill: { color: theme.darkBand },
  });
  slide.addText('Κατηγορία', {
    x: 0.5, y: 1.4, w: 9, h: 0.3, fontSize: 12, fontFace: FONT, color: theme.darkText,
  });
  slide.addText(section.label, {
    x: 0.5, y: 1.8, w: 9, h: 0.55, fontSize: 28, bold: true, fontFace: FONT, color: theme.darkText,
  });

  const kpis = [
    { label: 'Έργα', value: String(section.count), fill: theme.accent, color: theme.accentText, big: true },
    { label: 'Εγκεκριμένα', value: formatAmountEl(section.totalApproved), fill: theme.cardDark, color: theme.darkText },
    { label: 'Συμβάσεις', value: formatAmountEl(section.totalContract), fill: theme.cardDark, color: theme.darkText },
  ];
  kpis.forEach((k, i) => {
    const x = 0.5 + i * 3.1;
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y: 2.8, w: 2.9, h: 1.3,
      fill: { color: k.fill },
      rectRadius: 0.1,
    });
    slide.addText(k.label, {
      x: x + 0.15, y: 2.95, w: 2.6, h: 0.3, fontSize: 12, fontFace: FONT, color: k.color,
    });
    slide.addText(k.value, {
      x: x + 0.15, y: 3.3, w: 2.6, h: 0.55, fontSize: k.big ? 26 : 14, bold: true, fontFace: FONT, color: k.color,
    });
  });
}

function addProjectSlides(pptx, entry, resolveMedia, theme, sectionLabel) {
  const { card, display, contentPages } = entry;
  const pages = contentPages?.length ? contentPages : [{ type: 'simple', role: 'primary' }];
  const showHeaderAmounts = display.showHeaderAmounts !== false;
  const showHeaderNarrative = display.showHeaderNarrative !== false;

  pages.forEach((page, pageIndex) => {
    const slide = pptx.addSlide();
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 10, h: 5.625, fill: { color: theme.surface },
    });

    slide.addText(sectionLabel || '', {
      x: 0.4, y: 0.2, w: 9.2, h: 0.25, fontSize: 11, fontFace: FONT, color: theme.muted,
    });
    slide.addText(display.title || card.title, {
      x: 0.4, y: 0.45, w: 9.2, h: 0.4, fontSize: 16, bold: true, fontFace: FONT, color: theme.text,
    });

    let y = 0.95;
    if (pageIndex === 0) {
      if (display.area) {
        slide.addText(display.area, {
          x: 0.4, y, w: 9.2, h: 0.25, fontSize: 11, fontFace: FONT, color: theme.muted,
        });
        y += 0.3;
      }
      if (showHeaderNarrative) {
        slide.addText(display.narrative || '', {
          x: 0.4, y, w: 9.2, h: 0.55, fontSize: 12, fontFace: FONT, color: theme.text,
        });
        y += 0.6;
      }
      if (showHeaderAmounts) {
        slide.addText(
          `Εγκεκριμένο: ${formatAmountEl(display.approvedAmount)}   ·   Συμβατικό: ${formatAmountEl(display.contractAmount)}`,
          { x: 0.4, y, w: 9.2, h: 0.3, fontSize: 12, bold: true, fontFace: FONT, color: theme.accent }
        );
        y += 0.4;
      }
    } else if (page.role === 'secondary') {
      slide.addText(`Δευτερεύουσα σελίδα: ${page.vizLabel || page.vizId}`, {
        x: 0.4, y, w: 9.2, h: 0.25, fontSize: 11, fontFace: FONT, color: theme.muted,
      });
      y += 0.35;
    }

    const y0 = Math.max(y + 0.05, pageIndex === 0 ? 1.5 : 1.15);

    if (page.type === 'primary_photos' || page.type === 'primary') {
      const primary = page.primary || {};
      const phases = Object.keys(primary).filter((k) => primary[k]);
      if (phases.length) {
        const w = Math.min(3.0, 8.5 / phases.length);
        phases.forEach((key, i) => {
          const x = 0.4 + i * (w + 0.25);
          slide.addText(domain.photoPhaseLabelEl(key), {
            x, y: y0, w, h: 0.25, fontSize: 10, bold: true, fontFace: FONT, color: theme.muted,
          });
          tryAddImage(slide, resolveMedia, primary[key], { x, y: y0 + 0.3, w, h: 2.4 });
        });
      }
    } else if (page.type === 'gallery') {
      slide.addText('Επιπλέον λήψεις', {
        x: 0.4, y: y0, w: 9, h: 0.3, fontSize: 12, fontFace: FONT, color: theme.muted,
      });
      (page.items || []).forEach((item, i) => {
        const x = 0.4 + i * 4.7;
        const label = item.phaseLabel || domain.photoPhaseLabelEl(item.phase);
        slide.addText(label, { x, y: y0 + 0.35, w: 4.4, h: 0.25, fontSize: 11, fontFace: FONT, color: theme.muted });
        tryAddImage(slide, resolveMedia, item.photo, { x, y: y0 + 0.65, w: 4.4, h: 2.8 });
      });
    } else if (page.type === 'map') {
      const snapOk = page.mapSnapshot
        ? tryAddImage(slide, resolveMedia, page.mapSnapshot, { x: 0.5, y: y0, w: 9, h: 3.4 })
        : false;
      if (!snapOk) {
        slide.addText(
          (page.mapPoints || []).map((p, i) => `${i + 1}. ${p.label || ''} (${p.lat}, ${p.lng})`).join('\n') || 'Χάρτης έργου',
          { x: 0.4, y: y0, w: 9, h: 2.8, fontSize: 11, fontFace: FONT, color: theme.text }
        );
      }
    } else if (page.type === 'metrics') {
      (page.metrics || []).forEach((m, i) => {
        slide.addText(`${m.label}: ${m.value}`, {
          x: 0.4, y: y0 + i * 0.35, w: 9, h: 0.3, fontSize: 12, fontFace: FONT, color: theme.text,
        });
      });
    } else if (page.type === 'amounts') {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.4, y: y0, w: 4.4, h: 1.6, fill: { color: theme.accent }, rectRadius: 0.1,
      });
      slide.addText('Εγκεκριμένο', {
        x: 0.55, y: y0 + 0.2, w: 4.1, h: 0.3, fontSize: 12, fontFace: FONT, color: theme.accentText,
      });
      slide.addText(formatAmountEl(page.approvedAmount), {
        x: 0.55, y: y0 + 0.55, w: 4.1, h: 0.7, fontSize: 22, bold: true, fontFace: FONT, color: theme.accentText,
      });
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 5.2, y: y0, w: 4.4, h: 1.6, fill: { color: theme.cardDark }, rectRadius: 0.1,
      });
      slide.addText('Συμβατικό', {
        x: 5.35, y: y0 + 0.2, w: 4.1, h: 0.3, fontSize: 12, fontFace: FONT, color: theme.darkText,
      });
      slide.addText(formatAmountEl(page.contractAmount), {
        x: 5.35, y: y0 + 0.55, w: 4.1, h: 0.7, fontSize: 22, bold: true, fontFace: FONT, color: theme.darkText,
      });
    } else if (page.type === 'simple') {
      slide.addText(page.narrative || display.narrative || '', {
        x: 0.4, y: y0, w: 9.2, h: 2.4, fontSize: 18, bold: true, fontFace: FONT, color: theme.text,
      });
    }
  });
}

async function buildApologismosPptx(model, { resolveMedia, coverFrames = [] } = {}) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'LAYOUT_16x9', width: 10, height: 5.625 });
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'ERGOHUB';
  pptx.title = model.period?.label || 'Απολογισμός';

  const theme = themeOf(model);
  addCoverSlide(pptx, model, resolveMedia, coverFrames);
  for (const section of model.sections || []) {
    addCategorySlide(pptx, section, theme);
    for (const entry of section.cards || []) {
      addProjectSlides(pptx, entry, resolveMedia, theme, section.label);
    }
  }

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
};

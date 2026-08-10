/**
 * Πλαίσιο κάλυψης εξωφύλλου (focusX/Y + zoom) — ίδια λογική με CSS background-size/% position.
 * Pure math + sharp render για PDF/PPTX.
 */

function clamp01(n, fallback = 0.5) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(1, Math.max(0, x));
}

function clampZoom(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 1;
  return Math.min(2, Math.max(1, x));
}

/**
 * Τοποθέτηση όπως `background-size: ${zoom*100}%` (ένα ποσοστό → πλάτος) +
 * `background-position: focusX% focusY%`.
 *
 * @returns {{ scaledW: number, scaledH: number, offsetX: number, offsetY: number }}
 */
function computeCssBackgroundPlacement({
  boxW, boxH, imgW, imgH, focusX = 0.5, focusY = 0.5, zoom = 1,
}) {
  const bw = Math.max(1, Number(boxW) || 1);
  const bh = Math.max(1, Number(boxH) || 1);
  const iw = Math.max(1, Number(imgW) || 1);
  const ih = Math.max(1, Number(imgH) || 1);
  const z = clampZoom(zoom);
  const fx = clamp01(focusX);
  const fy = clamp01(focusY);

  const scaledW = bw * z;
  const scaledH = scaledW * (ih / iw);
  const offsetX = (bw - scaledW) * fx;
  const offsetY = (bh - scaledH) * fy;
  return { scaledW, scaledH, offsetX, offsetY, boxW: bw, boxH: bh, imgW: iw, imgH: ih, zoom: z, focusX: fx, focusY: fy };
}

/**
 * Ορατό τμήμα της εικόνας στο κουτί (σε pixels πηγής) + πού μπαίνει στο κουτί.
 */
function computeVisibleCoverRegion(placement) {
  const {
    scaledW, scaledH, offsetX, offsetY, boxW, boxH, imgW, imgH,
  } = placement;

  const visLeft = Math.max(0, offsetX);
  const visTop = Math.max(0, offsetY);
  const visRight = Math.min(boxW, offsetX + scaledW);
  const visBottom = Math.min(boxH, offsetY + scaledH);
  const destW = Math.max(0, visRight - visLeft);
  const destH = Math.max(0, visBottom - visTop);
  if (destW < 1 || destH < 1) {
    return null;
  }

  const srcLeft = ((visLeft - offsetX) / scaledW) * imgW;
  const srcTop = ((visTop - offsetY) / scaledH) * imgH;
  const srcW = (destW / scaledW) * imgW;
  const srcH = (destH / scaledH) * imgH;

  return {
    extract: {
      left: Math.max(0, Math.floor(srcLeft)),
      top: Math.max(0, Math.floor(srcTop)),
      width: Math.max(1, Math.min(imgW, Math.ceil(srcW))),
      height: Math.max(1, Math.min(imgH, Math.ceil(srcH))),
    },
    dest: {
      left: Math.round(visLeft),
      top: Math.round(visTop),
      width: Math.round(destW),
      height: Math.round(destH),
    },
  };
}

/**
 * Στόχοι pixel ανά layout για PDF (A4) και PPTX (16:9).
 */
function coverFrameTargets(channel, layoutId) {
  if (channel === 'pptx') {
    const H = 844; // ~150 dpi * 5.625"
    if (layoutId === 'hero_split') {
      return [
        { width: 750, height: H },
        { width: 750, height: H },
      ];
    }
    if (layoutId === 'hero_side') {
      return [{ width: 780, height: H }];
    }
    return [{ width: 1500, height: H }];
  }
  // pdf 16:9 (~150dpi) — ίδιο aspect με παρουσίαση / διαφάνειες
  const W = 1600;
  const H = 900;
  if (layoutId === 'hero_split') {
    return [
      { width: Math.round(W / 2), height: H },
      { width: Math.round(W / 2), height: H },
    ];
  }
  if (layoutId === 'hero_side') {
    return [{ width: Math.round(W * 0.52), height: H }];
  }
  return [{ width: W, height: H }];
}

/**
 * @param {string} absolutePath
 * @param {{ focusX?: number, focusY?: number, zoom?: number, width: number, height: number, background?: string }} opts
 * @returns {Promise<Buffer>}
 */
async function renderCoverFrame(absolutePath, opts) {
  const sharp = require('sharp');
  const width = Math.max(8, Math.round(Number(opts.width) || 800));
  const height = Math.max(8, Math.round(Number(opts.height) || 600));
  const background = opts.background || '#1e293b';

  const base = sharp(absolutePath);
  const meta = await base.metadata();
  const imgW = meta.width || 1;
  const imgH = meta.height || 1;

  const placement = computeCssBackgroundPlacement({
    boxW: width,
    boxH: height,
    imgW,
    imgH,
    focusX: opts.focusX,
    focusY: opts.focusY,
    zoom: opts.zoom,
  });
  const region = computeVisibleCoverRegion(placement);

  const canvas = sharp({
    create: {
      width,
      height,
      channels: 3,
      background,
    },
  });

  if (!region) {
    return canvas.jpeg({ quality: 88 }).toBuffer();
  }

  // Διόρθωση extract αν ξεφεύγει λόγω στρογγυλοποίησης
  let { left, top, width: ew, height: eh } = region.extract;
  if (left + ew > imgW) ew = imgW - left;
  if (top + eh > imgH) eh = imgH - top;
  if (ew < 1 || eh < 1) {
    return canvas.jpeg({ quality: 88 }).toBuffer();
  }

  const piece = await sharp(absolutePath)
    .extract({ left, top, width: ew, height: eh })
    .resize(region.dest.width, region.dest.height, { fit: 'fill' })
    .png()
    .toBuffer();

  return canvas
    .composite([{
      input: piece,
      left: region.dest.left,
      top: region.dest.top,
    }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

function bufferToDataUrl(buf, mime = 'image/jpeg') {
  return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
}

module.exports = {
  clamp01,
  clampZoom,
  computeCssBackgroundPlacement,
  computeVisibleCoverRegion,
  coverFrameTargets,
  renderCoverFrame,
  bufferToDataUrl,
};

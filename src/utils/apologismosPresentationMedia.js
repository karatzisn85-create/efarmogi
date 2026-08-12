/**
 * Συλλογή διαδρομών μέσων απολογισμού — μόνο όσα εμφανίζονται σε διαφάνειες.
 * Χρησιμοποιείται για lazy φόρτωση παρουσίασης και στενό collect στην εξαγωγή.
 */

function pushUnique(out, set, rel) {
  const r = String(rel || '').trim();
  if (!r || set.has(r)) return;
  set.add(r);
  out.push(r);
}

/** Paths που χρειάζεται μία διαφάνεια παρουσίασης. */
export function collectPathsFromSlide(slide) {
  const out = [];
  const seen = new Set();
  if (!slide) return out;

  if (slide.type === 'cover') {
    for (const img of slide.cover?.images || []) {
      pushUnique(out, seen, img?.relativePath);
    }
  }

  if (slide.type === 'mayor') {
    pushUnique(out, seen, slide.mayorMessage?.photo?.relativePath);
  }

  if (slide.type === 'category') {
    pushUnique(out, seen, slide.heroPhoto);
  }

  if (slide.type === 'project') {
    const page = slide.page || {};
    if (page.primary && typeof page.primary === 'object') {
      Object.values(page.primary).forEach((p) => pushUnique(out, seen, p));
    }
    for (const item of page.items || []) {
      pushUnique(out, seen, item?.photo);
    }
    pushUnique(out, seen, page.mapSnapshot);
  }

  return out;
}

/** Paths για παράθυρο διαφανειών (π.χ. τρέχουσα ±1). */
export function collectPathsForSlideWindow(slides, centerIndex, radius = 1) {
  const list = Array.isArray(slides) ? slides : [];
  const center = Math.max(0, Math.floor(Number(centerIndex) || 0));
  const r = Math.max(0, Math.floor(Number(radius) || 0));
  const out = [];
  const seen = new Set();
  for (let i = center - r; i <= center + r; i += 1) {
    if (i < 0 || i >= list.length) continue;
    for (const rel of collectPathsFromSlide(list[i])) {
      pushUnique(out, seen, rel);
    }
  }
  return out;
}

/** Όλα τα εμφανιζόμενα μέσα του deck (στενό collect για εξαγωγή). */
export function collectPathsFromSlides(slides) {
  const list = Array.isArray(slides) ? slides : [];
  const out = [];
  const seen = new Set();
  for (const slide of list) {
    for (const rel of collectPathsFromSlide(slide)) {
      pushUnique(out, seen, rel);
    }
  }
  return out;
}

/**
 * Μέγεθος εικόνων για PDF.
 * Ο καμβάς είναι 960×540· τα πλήρη αρχεία (≤2400px) ως data URL καθυστερούν
 * πολύ χωρίς ορατό όφελος στην ποιότητα εκτύπωσης οθόνης/A4.
 * @returns {'full'|'preview'}
 */
export function resolvePdfMediaVariant(_projectCount, _pathCount) {
  return 'preview';
}

/**
 * Paths καρτών για PDF — χωρίς εξώφυλλο/δήμαρχο όταν θα καδραριστούν χωριστά.
 */
export function collectPdfCardMediaPaths(slides, { coverImages = [], mayorPhotoPath = null } = {}) {
  const skip = new Set();
  for (const img of coverImages || []) {
    const rel = String(img?.relativePath || '').trim();
    if (rel) skip.add(rel);
  }
  const mayor = String(mayorPhotoPath || '').trim();
  if (mayor) skip.add(mayor);
  return collectPathsFromSlides(slides).filter((rel) => !skip.has(rel));
}

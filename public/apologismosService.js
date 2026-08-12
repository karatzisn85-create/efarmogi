/**
 * Αποθήκευση / φόρτωση Απολογισμού (FS) υπό dataDir/ΑΠΟΛΟΓΙΣΜΟΣ.
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { safeWriteJSON } = require('./safeWrite');
const domain = require('./apologismosDomain');
const { suggestCategoryFromEpActions } = require('./apologismosEpSuggest');
const { buildPresentationModel } = require('./apologismosPresentation');
const appearanceMod = require('./apologismosAppearance');
const coverFrame = require('./apologismosCoverFrame');
const coverFrameCache = require('./apologismosCoverFrameCache');
const mediaIngest = require('./apologismosMediaIngest');

const APOLOGISMOS_FOLDER = 'ΑΠΟΛΟΓΙΣΜΟΣ';

function getRoot(dataDir) {
  return path.join(dataDir, APOLOGISMOS_FOLDER);
}

function ensureDirs(dataDir) {
  const root = getRoot(dataDir);
  const reports = path.join(root, 'reports');
  const media = path.join(root, 'media');
  const appearance = path.join(root, 'appearance');
  for (const d of [root, reports, media, appearance]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
  return root;
}

function periodsPath(dataDir) {
  return path.join(getRoot(dataDir), 'periods.json');
}

function reportPath(dataDir, periodId) {
  const safeId = String(periodId || '').replace(/[<>:"/\\|?*]/g, '_');
  return path.join(getRoot(dataDir), 'reports', `${safeId}.json`);
}

function loadPeriods(dataDir) {
  ensureDirs(dataDir);
  const fp = periodsPath(dataDir);
  if (!fs.existsSync(fp)) {
    const def = domain.createDefaultPeriod();
    const payload = { periods: [def], updatedAt: new Date().toISOString() };
    safeWriteJSON(fp, payload);
    return payload.periods;
  }
  try {
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const periods = Array.isArray(data.periods) ? data.periods : [];
    if (!periods.length) {
      const def = domain.createDefaultPeriod();
      safeWriteJSON(fp, { periods: [def], updatedAt: new Date().toISOString() });
      return [def];
    }
    return periods;
  } catch (e) {
    const def = domain.createDefaultPeriod();
    safeWriteJSON(fp, { periods: [def], updatedAt: new Date().toISOString() });
    return [def];
  }
}

function upsertPeriod(dataDir, periodInput) {
  ensureDirs(dataDir);
  const periods = loadPeriods(dataDir);
  const startYear = Number(periodInput.startYear);
  const endYear = Number(periodInput.endYear);
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear) || startYear > endYear) {
    return { success: false, error: 'Μη έγκυρα έτη περιόδου' };
  }
  const id = periodInput.id || `${startYear}-${endYear}`;
  const next = {
    id,
    startYear,
    endYear,
    label: periodInput.label || `Δημοτική περίοδος ${startYear}–${endYear}`,
    isCurrent: !!periodInput.isCurrent,
  };
  const idx = periods.findIndex((p) => p.id === id);
  let list = [...periods];
  if (next.isCurrent) {
    list = list.map((p) => ({ ...p, isCurrent: false }));
  }
  if (idx >= 0) list[idx] = { ...list[idx], ...next };
  else list.push(next);
  if (!list.some((p) => p.isCurrent) && list.length) {
    list[0] = { ...list[0], isCurrent: true };
  }
  safeWriteJSON(periodsPath(dataDir), { periods: list, updatedAt: new Date().toISOString() });
  return { success: true, periods: list, period: list.find((p) => p.id === id) };
}

function getPeriodById(dataDir, periodId) {
  const periods = loadPeriods(dataDir);
  return periods.find((p) => p.id === periodId) || null;
}

function getCurrentPeriod(dataDir) {
  const periods = loadPeriods(dataDir);
  return periods.find((p) => p.isCurrent) || periods[0] || null;
}

function loadReport(dataDir, periodId) {
  ensureDirs(dataDir);
  const period = getPeriodById(dataDir, periodId) || getCurrentPeriod(dataDir);
  if (!period) return { success: false, error: 'Δεν βρέθηκε δημοτική περίοδος' };
  const fp = reportPath(dataDir, period.id);
  if (!fs.existsSync(fp)) {
    const empty = domain.createEmptyReport(period.id);
    safeWriteJSON(fp, empty);
    return { success: true, report: empty, period };
  }
  try {
    const report = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (!Array.isArray(report.cards)) report.cards = [];
    report.periodId = period.id;
    let migrated = false;
    if (!report.appearance || typeof report.appearance !== 'object') {
      report.appearance = appearanceMod.emptyAppearance();
      migrated = true;
    } else {
      report.appearance = appearanceMod.normalizeAppearance(report.appearance);
    }
    report.cards = report.cards.map((card) => {
      const { card: next, changed } = domain.migrateDeprecatedVizIds(card);
      if (!changed) return card;
      // Παλιοί τρόποι παρουσίασης → καθαρισμός οπτικών που δεν ταιριάζουν πλέον.
      migrated = true;
      return applyVisualAssetPrune(dataDir, next).card;
    });
    if (migrated) {
      report.updatedAt = new Date().toISOString();
      safeWriteJSON(fp, report);
    }
    return { success: true, report, period };
  } catch (e) {
    // Μην αντικαθιστάς χαλασμένο αρχείο με κενό — απώλεια δεδομένων.
    return {
      success: false,
      error: `Αδυναμία ανάγνωσης απολογισμού: ${e.message || 'μη έγκυρο αρχείο'}`,
    };
  }
}

function saveReport(dataDir, report) {
  ensureDirs(dataDir);
  if (!report || !report.periodId) {
    return { success: false, error: 'Λείπει periodId' };
  }
  const next = {
    ...report,
    cards: Array.isArray(report.cards) ? report.cards : [],
    updatedAt: new Date().toISOString(),
    createdAt: report.createdAt || new Date().toISOString(),
  };
  safeWriteJSON(reportPath(dataDir, report.periodId), next);
  return { success: true, report: next };
}

function addFromSubproject(dataDir, { periodId, subproject, epActions }) {
  const loaded = loadReport(dataDir, periodId);
  if (!loaded.success) return loaded;
  const { report, period } = loaded;
  const check = domain.canAddLinkedSubproject(subproject, report.cards);
  if (!check.ok) return { success: false, error: check.error };

  const mapped = domain.mapSubprojectToCardFields(subproject);
  const suggested = suggestCategoryFromEpActions(epActions);
  const now = new Date().toISOString();
  const card = {
    id: uuidv4(),
    ...mapped,
    categoryId: suggested || '',
    narrative: '',
    impactLine: '',
    primaryViz: '',
    secondaryViz: null,
    photos: { before: [], during: [], after: [] },
    mapPoints: [],
    mapLine: null,
    mapDrawing: domain.emptyMapDrawing(),
    mapSnapshot: null,
    mapView: null,
    metrics: [],
    amountChangedBadge: false,
    suggestedCategoryId: suggested || null,
    createdAt: now,
    updatedAt: now,
  };
  report.cards.push(card);
  const saved = saveReport(dataDir, report);
  if (!saved.success) return saved;
  return { success: true, report: saved.report, period, card };
}

function addLegacyCard(dataDir, { periodId, input }) {
  const loaded = loadReport(dataDir, periodId);
  if (!loaded.success) return loaded;
  const { report, period } = loaded;
  const check = domain.validateLegacyCardInput(input, period);
  if (!check.ok) return { success: false, error: check.errors.join(' · ') };

  const now = new Date().toISOString();
  const card = {
    id: uuidv4(),
    source: 'legacy',
    subprojectId: null,
    projectId: null,
    title: check.normalized.title,
    area: check.normalized.area,
    completionYear: check.normalized.completionYear,
    approvedAmount: check.normalized.approvedAmount,
    contractAmount: check.normalized.contractAmount,
    finalContractAmountAfterApe: String(input.finalContractAmountAfterApe || '').trim(),
    finalContractApeDate: String(input.finalContractApeDate || '').trim(),
    hasFinalContractAmountAfterApe: !!String(input.finalContractAmountAfterApe || '').trim(),
    showFinalContractAmountInPresentation: !!input.showFinalContractAmountInPresentation,
    categoryId: input.categoryId || '',
    narrative: String(input.narrative || '').trim(),
    impactLine: domain.normalizeImpactLine(input.impactLine),
    primaryViz: input.primaryViz || '',
    secondaryViz: input.secondaryViz || null,
    photos: { before: [], during: [], after: [] },
    mapPoints: Array.isArray(input.mapPoints) ? input.mapPoints : [],
    mapLine: input.mapLine || null,
    mapDrawing: domain.normalizeMapDrawing(input.mapDrawing),
    mapSnapshot: input.mapSnapshot || null,
    mapView: domain.normalizeMapView(input.mapView),
    metrics: domain.normalizeMetrics(input.metrics),
    amountChangedBadge: false,
    createdAt: now,
    updatedAt: now,
  };
  report.cards.push(card);
  const saved = saveReport(dataDir, report);
  if (!saved.success) return saved;
  return { success: true, report: saved.report, period, card };
}

function updateCard(dataDir, { periodId, cardId, patch, pruneUnusedVisuals = true }) {
  const loaded = loadReport(dataDir, periodId);
  if (!loaded.success) return loaded;
  const { report, period } = loaded;
  const idx = report.cards.findIndex((c) => c.id === cardId);
  if (idx < 0) return { success: false, error: 'Δεν βρέθηκε κάρτα' };

  const prev = report.cards[idx];
  if (prev.source === 'legacy' && (patch.completionYear != null || patch.area != null)) {
    const check = domain.validateLegacyCardInput(
      {
        title: patch.title != null ? patch.title : prev.title,
        area: patch.area != null ? patch.area : prev.area,
        completionYear:
          patch.completionYear != null ? patch.completionYear : prev.completionYear,
        approvedAmount:
          patch.approvedAmount != null ? patch.approvedAmount : prev.approvedAmount,
        contractAmount:
          patch.contractAmount != null ? patch.contractAmount : prev.contractAmount,
      },
      period
    );
    if (!check.ok) return { success: false, error: check.errors.join(' · ') };
  }

  const next = {
    ...prev,
    ...patch,
    id: prev.id,
    source: prev.source,
    subprojectId: prev.subprojectId,
    projectId: prev.projectId,
    updatedAt: new Date().toISOString(),
  };
  if (patch.metrics) next.metrics = domain.normalizeMetrics(patch.metrics);
  if (Object.prototype.hasOwnProperty.call(patch, 'impactLine')) {
    next.impactLine = domain.normalizeImpactLine(patch.impactLine);
  }
  if (patch.photos) {
    next.photos = domain.mergePhotoPhases(prev.photos, patch.photos);
  }
  if (patch.mapDrawing !== undefined) {
    next.mapDrawing = domain.normalizeMapDrawing(patch.mapDrawing);
  }
  const migrated = domain.migrateDeprecatedVizIds(next).card;
  if (Object.prototype.hasOwnProperty.call(patch, 'showFinalContractAmountInPresentation')) {
    migrated.showFinalContractAmountInPresentation = !!patch.showFinalContractAmountInPresentation;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'finalContractAmountAfterApe')) {
    const raw = String(patch.finalContractAmountAfterApe || '').trim();
    migrated.finalContractAmountAfterApe = raw;
    migrated.hasFinalContractAmountAfterApe = !!raw;
    if (!raw) migrated.showFinalContractAmountInPresentation = false;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'finalContractApeDate')) {
    migrated.finalContractApeDate = String(patch.finalContractApeDate || '').trim();
  }
  // Σιωπηρή αποθήκευση (π.χ. πριν ανέβασμα φωτο): κρατάμε media ώστε το «Άκυρο» / αλλαγή γνώμης να μην χάνει αρχεία.
  // Ρητή αποθήκευση κάρτας (και αποθήκευση φωτο/χάρτη): καθαρισμός καταλοίπων.
  const finalCard = pruneUnusedVisuals
    ? applyVisualAssetPrune(dataDir, migrated).card
    : migrated;
  report.cards[idx] = finalCard;
  const saved = saveReport(dataDir, report);
  if (!saved.success) return saved;
  return { success: true, report: saved.report, period, card: finalCard };
}

function removeCard(dataDir, { periodId, cardId }) {
  const loaded = loadReport(dataDir, periodId);
  if (!loaded.success) return loaded;
  const { report, period } = loaded;
  const before = report.cards.length;
  report.cards = report.cards.filter((c) => c.id !== cardId);
  if (report.cards.length === before) {
    return { success: false, error: 'Δεν βρέθηκε κάρτα' };
  }
  // cleanup media folder
  const mediaDir = path.join(getRoot(dataDir), 'media', cardId);
  try {
    if (fs.existsSync(mediaDir)) {
      fs.rmSync(mediaDir, { recursive: true, force: true });
    }
  } catch (_) {}
  const saved = saveReport(dataDir, report);
  if (!saved.success) return saved;
  return { success: true, report: saved.report, period };
}

/**
 * @param {Record<string, object>} subprojectById map subprojectId -> subproject
 */
function syncAmounts(dataDir, { periodId, subprojectById }) {
  const loaded = loadReport(dataDir, periodId);
  if (!loaded.success) return loaded;
  const { report, period } = loaded;
  let changedAny = false;
  report.cards = report.cards.map((card) => {
    if (card.source !== 'linked' || !card.subprojectId) return card;
    const sub = subprojectById?.[card.subprojectId];
    if (!sub) return card;
    const { card: next, changed } = domain.syncCardAmountsFromSubproject(card, sub);
    if (changed) changedAny = true;
    return next;
  });
  if (changedAny) {
    const saved = saveReport(dataDir, report);
    if (!saved.success) return saved;
    return { success: true, report: saved.report, period, changed: true };
  }
  return { success: true, report, period, changed: false };
}

function dismissBadge(dataDir, { periodId, cardId }) {
  const loaded = loadReport(dataDir, periodId);
  if (!loaded.success) return loaded;
  const { report, period } = loaded;
  const idx = report.cards.findIndex((c) => c.id === cardId);
  if (idx < 0) return { success: false, error: 'Δεν βρέθηκε κάρτα' };
  report.cards[idx] = domain.dismissAmountBadge(report.cards[idx]);
  const saved = saveReport(dataDir, report);
  if (!saved.success) return saved;
  return { success: true, report: saved.report, period, card: report.cards[idx] };
}

function getCardMediaDir(dataDir, cardId) {
  ensureDirs(dataDir);
  const dir = path.join(getRoot(dataDir), 'media', cardId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function saveCardPhoto(dataDir, { cardId, phase, sourcePath, fileName, currentPhotos }) {
  const root = ensureDirs(dataDir);
  const slot = domain.canAddPhotoToPhase(currentPhotos, phase);
  if (!slot.ok) return { success: false, error: slot.error };
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return { success: false, error: 'Δεν βρέθηκε αρχείο πηγής' };
  }
  const mediaDir = getCardMediaDir(dataDir, cardId);
  const phaseDir = path.join(mediaDir, phase);
  if (!fs.existsSync(phaseDir)) fs.mkdirSync(phaseDir, { recursive: true });

  const uniquePrefix = `${Date.now()}_${uuidv4().slice(0, 8)}_`;
  const ingest = await mediaIngest.ingestImageToDir(
    sourcePath,
    phaseDir,
    uniquePrefix,
    String(fileName || path.basename(sourcePath))
  );
  const destName = ingest.destName;
  const destAbs = ingest.destAbs;
  const rel = path.join('media', cardId, phase, destName).replace(/\\/g, '/');
  const guard = domain.resolveMediaPathSafe(dataDir, root, rel);
  if (!guard.ok) {
    try { if (fs.existsSync(destAbs)) fs.unlinkSync(destAbs); } catch (_) {}
    return { success: false, error: guard.error };
  }

  try {
    await mediaIngest.ensurePreviewThumb(root, destAbs);
  } catch (_) {}
  return {
    success: true,
    relativePath: rel,
    absolutePath: destAbs,
    compressed: ingest.compressed,
    fallbackCopy: ingest.fallbackCopy,
  };
}

function deleteCardPhotoFile(dataDir, relativePath) {
  const abs = resolveCardMediaAbsolute(dataDir, relativePath);
  if (!abs) return { success: false, error: 'Μη επιτρεπτό path' };
  try {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (e) {
    return { success: false, error: e.message };
  }
  return { success: true };
}

/** Συλλέγει relative paths media που η κάρτα ακόμα αναφέρει. */
function referencedCardMediaPaths(card) {
  const refs = new Set();
  const photos = domain.normalizePhotoSlots(card?.photos || {}, ['before', 'during', 'after']);
  for (const phase of ['before', 'during', 'after']) {
    for (const rel of photos[phase]) {
      if (rel) refs.add(String(rel).replace(/\\/g, '/'));
    }
  }
  if (card?.mapSnapshot) refs.add(String(card.mapSnapshot).replace(/\\/g, '/'));
  return refs;
}

/**
 * Διαγράφει αρχεία κάτω από media/{cardId} που δεν αναφέρονται πλέον στην κάρτα,
 * και αφαιρεί άδειους φακέλους φάσης.
 */
function cleanupEmptyCardMediaDirs(dataDir, cardId, card) {
  if (!cardId) return;
  const root = getRoot(dataDir);
  const mediaDir = path.join(root, 'media', String(cardId));
  if (!fs.existsSync(mediaDir)) return;

  const keep = referencedCardMediaPaths(card);
  const walkAndPrune = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walkAndPrune(abs);
        try {
          if (fs.readdirSync(abs).length === 0) fs.rmdirSync(abs);
        } catch (_) {}
        continue;
      }
      if (!ent.isFile()) continue;
      const rel = path.relative(root, abs).replace(/\\/g, '/');
      if (!keep.has(rel)) {
        try {
          fs.unlinkSync(abs);
        } catch (_) {}
      }
    }
  };

  walkAndPrune(mediaDir);
  try {
    if (fs.existsSync(mediaDir) && fs.readdirSync(mediaDir).length === 0) {
      fs.rmdirSync(mediaDir);
    }
  } catch (_) {}
}

function isMediaPathForCard(relativePath, cardId) {
  if (!cardId || !relativePath) return false;
  const rel = String(relativePath).replace(/\\/g, '/');
  return rel.startsWith(`media/${cardId}/`);
}

/**
 * Καθαρίζει οπτικά πεδία της κάρτας + αντίστοιχα αρχεία στον δίσκο.
 * Χρησιμοποιείται σε ρητή αποθήκευση / οριστικές ενέργειες — όχι σε σιωπηρό save.
 */
function applyVisualAssetPrune(dataDir, card, pruneOptions = {}) {
  const migrated = domain.migrateDeprecatedVizIds(card).card;
  const { card: pruned, removedMediaPaths } = domain.pruneCardVisualAssets(migrated, pruneOptions);
  for (const rel of removedMediaPaths) {
    if (!isMediaPathForCard(rel, pruned.id)) continue;
    deleteCardPhotoFile(dataDir, rel);
  }
  cleanupEmptyCardMediaDirs(dataDir, pruned.id, pruned);
  return { card: pruned, removedMediaPaths };
}

function removeCardPhoto(dataDir, { periodId, cardId, phase, relativePath }) {
  const loaded = loadReport(dataDir, periodId);
  if (!loaded.success) return loaded;
  const { report, period } = loaded;
  const idx = report.cards.findIndex((c) => c.id === cardId);
  if (idx < 0) return { success: false, error: 'Δεν βρέθηκε κάρτα' };
  const card = report.cards[idx];
  const result = domain.removePhotoFromPhase(card.photos, phase, relativePath);
  if (!result.ok) return { success: false, error: result.error };
  if (isMediaPathForCard(relativePath, cardId)) {
    deleteCardPhotoFile(dataDir, relativePath);
  }
  const nextCard = {
    ...card,
    photos: result.photos,
    updatedAt: new Date().toISOString(),
  };
  cleanupEmptyCardMediaDirs(dataDir, cardId, nextCard);
  report.cards[idx] = nextCard;
  const saved = saveReport(dataDir, report);
  if (!saved.success) return saved;
  return { success: true, report: saved.report, period, card: nextCard };
}

function reorderCardPhotoPrimary(dataDir, { periodId, cardId, phase, relativePath }) {
  const loaded = loadReport(dataDir, periodId);
  if (!loaded.success) return loaded;
  const { report, period } = loaded;
  const idx = report.cards.findIndex((c) => c.id === cardId);
  if (idx < 0) return { success: false, error: 'Δεν βρέθηκε κάρτα' };
  const card = report.cards[idx];
  const result = domain.movePhotoToPrimary(card.photos, phase, relativePath);
  if (!result.ok) return { success: false, error: result.error };
  report.cards[idx] = {
    ...card,
    photos: result.photos,
    updatedAt: new Date().toISOString(),
  };
  const saved = saveReport(dataDir, report);
  if (!saved.success) return saved;
  return { success: true, report: saved.report, period, card: report.cards[idx] };
}

/**
 * Αποθήκευση στιγμιότυπου χάρτη (PNG data URL ή Buffer) + GeoJSON σχεδίων.
 */
function saveMapSnapshot(dataDir, {
  periodId, cardId, dataUrl, buffer, mapDrawing, mapPoints, mapView,
} = {}) {
  const loaded = loadReport(dataDir, periodId);
  if (!loaded.success) return loaded;
  const { report, period } = loaded;
  const idx = report.cards.findIndex((c) => c.id === cardId);
  if (idx < 0) return { success: false, error: 'Δεν βρέθηκε κάρτα' };

  let bytes = buffer;
  if (!bytes && dataUrl) {
    const m = String(dataUrl).match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
    if (!m) return { success: false, error: 'Μη έγκυρη εικόνα χάρτη' };
    bytes = Buffer.from(m[2], 'base64');
  }
  if (!bytes || !bytes.length) {
    return { success: false, error: 'Λείπει το στιγμιότυπο χάρτη' };
  }

  const root = ensureDirs(dataDir);
  const mediaDir = getCardMediaDir(dataDir, cardId);
  const mapDir = path.join(mediaDir, 'map');
  if (!fs.existsSync(mapDir)) fs.mkdirSync(mapDir, { recursive: true });

  const destName = `snapshot_${Date.now()}_${uuidv4().slice(0, 8)}.png`;
  const destAbs = path.join(mapDir, destName);
  const rel = path.join('media', cardId, 'map', destName).replace(/\\/g, '/');
  const guard = domain.resolveMediaPathSafe(dataDir, root, rel);
  if (!guard.ok) return { success: false, error: guard.error };

  fs.writeFileSync(destAbs, bytes);

  const prev = report.cards[idx];
  if (prev.mapSnapshot && prev.mapSnapshot !== rel) {
    deleteCardPhotoFile(dataDir, prev.mapSnapshot);
  }

  const drawing = domain.normalizeMapDrawing(mapDrawing || domain.resolveCardMapDrawing(prev));
  const pointsFromDrawing = drawing.features
    .filter((f) => f.geometry?.type === 'Point')
    .map((f) => {
      const [lng, lat] = f.geometry.coordinates || [];
      return {
        lat: Number(lat),
        lng: Number(lng),
        label: String(f.properties?.name || '').trim(),
      };
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  const nextView = domain.normalizeMapView(mapView);

  report.cards[idx] = {
    ...prev,
    mapSnapshot: rel,
    mapDrawing: drawing,
    mapView: nextView || prev.mapView || null,
    mapPoints: Array.isArray(mapPoints) && mapPoints.length
      ? mapPoints
      : pointsFromDrawing,
    updatedAt: new Date().toISOString(),
  };

  const saved = saveReport(dataDir, report);
  if (!saved.success) return saved;
  return {
    success: true,
    report: saved.report,
    period,
    card: report.cards[idx],
    relativePath: rel,
  };
}

function mediaFileToDataUrl(absolutePath) {
  if (!absolutePath || !fs.existsSync(absolutePath)) return null;
  const ext = path.extname(absolutePath).toLowerCase().replace('.', '');
  const mime = ext === 'png' ? 'image/png'
    : ext === 'webp' ? 'image/webp'
      : ext === 'gif' ? 'image/gif'
        : 'image/jpeg';
  const buf = fs.readFileSync(absolutePath);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

/**
 * @param {string} dataDir
 * @param {string[]} relativePaths
 * @param {{ asDataUrl?: boolean, variant?: 'full'|'preview' }} [opts]
 *   variant=preview → ελαφριά προεπισκόπηση για οθόνη· full → πρωτότυπο (εξαγωγή).
 */
async function resolveMediaMap(dataDir, relativePaths, { asDataUrl = false, variant = 'full' } = {}) {
  const root = ensureDirs(dataDir);
  const usePreview = variant === 'preview';
  const map = {};
  const list = [...new Set((relativePaths || []).map((r) => String(r || '').trim()).filter(Boolean))];
  const CONCURRENCY = 6;
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const chunk = list.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (rel) => {
      const abs = resolveCardMediaAbsolute(dataDir, rel);
      if (!abs || !fs.existsSync(abs)) return;
      let useAbs = abs;
      if (usePreview) {
        try {
          const thumb = await mediaIngest.ensurePreviewThumb(root, abs);
          if (thumb?.path) useAbs = thumb.path;
        } catch (_) {
          useAbs = abs;
        }
      }
      map[rel] = asDataUrl ? mediaFileToDataUrl(useAbs) : `file:///${useAbs.replace(/\\/g, '/')}`;
    }));
  }
  return map;
}

function resolveCardMediaAbsolute(dataDir, relativePath) {
  const root = ensureDirs(dataDir);
  const guard = domain.resolveMediaPathSafe(dataDir, root, relativePath);
  if (!guard.ok) return null;
  return guard.resolved;
}

function getMeta() {
  return {
    categories: domain.CATEGORIES,
    vizModes: domain.VIZ_MODES,
    eligibleStatuses: domain.ELIGIBLE_STATUSES,
    maxPhotosPerPhase: domain.MAX_PHOTOS_PER_PHASE,
    maxMetricsRows: domain.MAX_METRICS_ROWS,
    photoPhaseLabels: domain.PHOTO_PHASE_LABELS_EL,
    palettes: appearanceMod.PALETTES,
    coverLayouts: appearanceMod.COVER_LAYOUTS,
  };
}

function enrichReportWithReadiness(report) {
  const cards = (report.cards || []).map((card) => {
    const photos = domain.normalizePhotoSlots(card.photos || {}, ['before', 'during', 'after']);
    const { card: migrated } = domain.migrateDeprecatedVizIds({ ...card, photos });
    const readiness = domain.getCardReadiness(migrated);
    return { ...migrated, ready: readiness.ready, readinessErrors: readiness.errors };
  });
  return {
    ...report,
    appearance: appearanceMod.normalizeAppearance(report.appearance),
    cards: domain.sortCardsByApprovedAmountDesc(cards),
  };
}

function updateAppearance(dataDir, { periodId, patch }) {
  const loaded = loadReport(dataDir, periodId);
  if (!loaded.success) return loaded;
  const { report, period } = loaded;
  const prev = appearanceMod.normalizeAppearance(report.appearance);
  const next = appearanceMod.normalizeAppearance({
    ...prev,
    ...(patch || {}),
    coverImages: patch?.coverImages !== undefined ? patch.coverImages : prev.coverImages,
    mayorMessage: patch?.mayorMessage !== undefined ? patch.mayorMessage : prev.mayorMessage,
    updatedAt: new Date().toISOString(),
  });
  // Trim μόνο στην αποθήκευση — όχι κατά την πληκτρολόγηση.
  next.subtitle = String(next.subtitle || '').trim().slice(0, 120);
  next.mayorMessage = {
    ...next.mayorMessage,
    mayorName: String(next.mayorMessage?.mayorName || '').trim().slice(0, appearanceMod.MAYOR_NAME_MAX),
    text: String(next.mayorMessage?.text || '').trim().slice(0, appearanceMod.MAYOR_TEXT_MAX),
  };
  if (next.mayorMessage?.enabled) {
    if (!next.mayorMessage.text) {
      return { success: false, error: 'Για τη σελίδα Δημάρχου χρειάζεται σύντομο κείμενο.' };
    }
    if (!next.mayorMessage.photo?.relativePath) {
      return { success: false, error: 'Για τη σελίδα Δημάρχου χρειάζεται φωτογραφία.' };
    }
  }
  report.appearance = next;
  const saved = saveReport(dataDir, report);
  if (!saved.success) return saved;
  cleanupAppearanceOrphans(dataDir, next);
  // Focus/zoom/layout/palette μπορεί να άλλαξαν — ξαναφτιάχνουμε καδραρίσματα στην επόμενη εξαγωγή.
  coverFrameCache.invalidateCoverFrameCache(getRoot(dataDir));
  return { success: true, report: saved.report, period, appearance: next };
}

function deleteAppearanceFile(dataDir, relativePath) {
  if (!relativePath) return { success: false };
  const root = ensureDirs(dataDir);
  const guard = domain.resolveMediaPathSafe(dataDir, root, relativePath);
  if (!guard.ok) return { success: false, error: guard.error };
  const rel = String(relativePath).replace(/\\/g, '/');
  if (!rel.startsWith('appearance/')) return { success: false, error: 'Μη επιτρεπτό path' };
  try {
    if (fs.existsSync(guard.resolved)) fs.unlinkSync(guard.resolved);
  } catch (e) {
    return { success: false, error: e.message };
  }
  return { success: true };
}

/** Διαγράφει αρχεία εξωφύλλου που δεν αναφέρονται πια στην εμφάνιση. */
function cleanupAppearanceOrphans(dataDir, appearance) {
  const root = ensureDirs(dataDir);
  const appearanceDir = path.join(root, 'appearance');
  if (!fs.existsSync(appearanceDir)) return;
  const a = appearanceMod.normalizeAppearance(appearance);
  const keep = new Set(
    (a.coverImages || [])
      .map((img) => String(img?.relativePath || '').replace(/\\/g, '/'))
      .filter(Boolean)
  );
  const mayorRel = String(a.mayorMessage?.photo?.relativePath || '').replace(/\\/g, '/');
  if (mayorRel) keep.add(mayorRel);
  let entries;
  try {
    entries = fs.readdirSync(appearanceDir);
  } catch (_) {
    return;
  }
  for (const name of entries) {
    const abs = path.join(appearanceDir, name);
    try {
      if (!fs.statSync(abs).isFile()) continue;
    } catch (_) {
      continue;
    }
    const rel = path.join('appearance', name).replace(/\\/g, '/');
    if (keep.has(rel)) continue;
    try {
      fs.unlinkSync(abs);
    } catch (_) {}
  }
}

async function saveCoverImage(dataDir, {
  periodId, sourcePath, fileName, slotIndex = 0, commitToReport = true, kind = 'cover',
} = {}) {
  const loaded = loadReport(dataDir, periodId);
  if (!loaded.success) return loaded;
  const { report, period } = loaded;
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return { success: false, error: 'Δεν βρέθηκε αρχείο πηγής' };
  }
  const root = ensureDirs(dataDir);
  const appearanceDir = path.join(root, 'appearance');
  if (!fs.existsSync(appearanceDir)) fs.mkdirSync(appearanceDir, { recursive: true });
  const isMayor = kind === 'mayor';
  const uniquePrefix = isMayor
    ? `mayor_${Date.now()}_${uuidv4().slice(0, 8)}_`
    : `cover_${Number(slotIndex) || 0}_${Date.now()}_${uuidv4().slice(0, 8)}_`;
  const ingest = await mediaIngest.ingestImageToDir(
    sourcePath,
    appearanceDir,
    uniquePrefix,
    String(fileName || path.basename(sourcePath))
  );
  const destName = ingest.destName;
  const destAbs = ingest.destAbs;
  const rel = path.join('appearance', destName).replace(/\\/g, '/');
  const guard = domain.resolveMediaPathSafe(dataDir, root, rel);
  if (!guard.ok) {
    try { if (fs.existsSync(destAbs)) fs.unlinkSync(destAbs); } catch (_) {}
    return { success: false, error: guard.error };
  }

  try {
    await mediaIngest.ensurePreviewThumb(root, destAbs);
  } catch (_) {}

  if (!commitToReport) {
    return {
      success: true,
      relativePath: rel,
      absolutePath: destAbs,
      period,
      compressed: ingest.compressed,
      fallbackCopy: ingest.fallbackCopy,
    };
  }

  const appearance = appearanceMod.normalizeAppearance(report.appearance);

  if (isMayor) {
    const prevRel = appearance.mayorMessage?.photo?.relativePath
      ? String(appearance.mayorMessage.photo.relativePath).replace(/\\/g, '/')
      : null;
    const prevPhoto = appearance.mayorMessage?.photo || null;
    report.appearance = appearanceMod.normalizeAppearance({
      ...appearance,
      mayorMessage: {
        ...appearance.mayorMessage,
        photo: {
          relativePath: rel,
          focusX: prevPhoto?.focusX ?? 0.5,
          focusY: prevPhoto?.focusY ?? 0.5,
          zoom: prevPhoto?.zoom ?? 1,
        },
      },
      updatedAt: new Date().toISOString(),
    });
    const saved = saveReport(dataDir, report);
    if (!saved.success) return saved;
    if (prevRel && prevRel !== rel) {
      deleteAppearanceFile(dataDir, prevRel);
    }
    cleanupAppearanceOrphans(dataDir, report.appearance);
    coverFrameCache.invalidateCoverFrameCache(root);
    return {
      success: true,
      report: saved.report,
      period,
      appearance: report.appearance,
      relativePath: rel,
      compressed: ingest.compressed,
      fallbackCopy: ingest.fallbackCopy,
    };
  }

  const layout = appearanceMod.getCoverLayout(appearance.coverLayoutId);
  const idx = Math.max(0, Math.min(layout.imageSlots - 1, Number(slotIndex) || 0));
  const slots = appearanceMod.coverImagesBySlot(appearance);
  const prev = slots[idx];
  const prevRel = prev?.relativePath ? String(prev.relativePath).replace(/\\/g, '/') : null;
  slots[idx] = {
    relativePath: rel,
    focusX: prev?.focusX ?? 0.5,
    focusY: prev?.focusY ?? 0.5,
    zoom: prev?.zoom ?? 1,
    slot: idx,
  };

  report.appearance = appearanceMod.normalizeAppearance({
    ...appearance,
    coverImages: slots.filter(Boolean),
    updatedAt: new Date().toISOString(),
  });
  const saved = saveReport(dataDir, report);
  if (!saved.success) return saved;
  if (prevRel && prevRel !== rel) {
    deleteAppearanceFile(dataDir, prevRel);
  }
  cleanupAppearanceOrphans(dataDir, report.appearance);
  coverFrameCache.invalidateCoverFrameCache(root);
  return {
    success: true,
    report: saved.report,
    period,
    appearance: report.appearance,
    relativePath: rel,
    compressed: ingest.compressed,
    fallbackCopy: ingest.fallbackCopy,
  };
}

function buildPresentationModelForExport(report, period, appConfig, dataDir) {
  const model = buildPresentationModel(report, period, { appConfig: appConfig || {} });
  return attachMunicipalityBranding(model, dataDir);
}

/**
 * Προαιρετικό λογότυπο δήμου από ρυθμίσεις δημοτικών ενοτήτων.
 * @param {object} model
 * @param {string} [dataDir]
 */
function attachMunicipalityBranding(model, dataDir) {
  if (!model || typeof model !== 'object') return model;
  const show = model.appearance?.showMunicipalityLogo === true
    || model.design?.showMunicipalityLogo === true;
  if (!show || !dataDir) {
    model.branding = { showLogo: false, logoDataUrl: null };
    return model;
  }
  try {
    const municipalUnitsConfigService = require('./municipalUnitsConfigService');
    const logo = municipalUnitsConfigService.getMunicipalityLogoDataUrl(dataDir);
    model.branding = {
      showLogo: !!logo.dataUrl,
      logoDataUrl: logo.dataUrl || null,
    };
  } catch (_) {
    model.branding = { showLogo: false, logoDataUrl: null };
  }
  return model;
}

/**
 * Προετοιμασία καδραρισμένων φωτογραφιών εξωφύλλου για PDF/PPTX.
 * @returns {Promise<{ success: true, frames: Array<string|null>, layoutId: string }>}
 */
async function frameCoverImagesForExport(dataDir, { appearance, channel = 'pdf' } = {}) {
  const a = appearanceMod.normalizeAppearance(appearance);
  const slots = appearanceMod.coverImagesBySlot(a);
  const targets = coverFrame.coverFrameTargets(channel, a.coverLayoutId);
  const bg = appearanceMod.resolveTheme(a).darkBand || '#1e293b';
  const root = ensureDirs(dataDir);
  const frames = [];

  for (let i = 0; i < targets.length; i += 1) {
    const img = slots[i];
    const target = targets[i];
    if (!img?.relativePath || !target) {
      frames.push(null);
      continue;
    }
    const abs = resolveCardMediaAbsolute(dataDir, img.relativePath);
    if (!abs || !fs.existsSync(abs)) {
      frames.push(null);
      continue;
    }
    try {
      const { buffer } = await coverFrameCache.getOrRenderCoverFrame(
        root,
        abs,
        {
          focusX: img.focusX,
          focusY: img.focusY,
          zoom: img.zoom,
          width: target.width,
          height: target.height,
          background: bg,
        },
        { relativePath: img.relativePath, channel }
      );
      frames.push(coverFrame.bufferToDataUrl(buffer, 'image/jpeg'));
    } catch (_) {
      // Fallback: ανεπεξέργαστη εικόνα ως data URL
      try {
        frames.push(mediaFileToDataUrl(abs));
      } catch (e2) {
        frames.push(null);
      }
    }
  }

  let mayorFrame = null;
  const mayorPhoto = a.mayorMessage?.photo;
  if (mayorPhoto?.relativePath) {
    const abs = resolveCardMediaAbsolute(dataDir, mayorPhoto.relativePath);
    if (abs && fs.existsSync(abs)) {
      try {
        const { buffer } = await coverFrameCache.getOrRenderCoverFrame(
          root,
          abs,
          {
            focusX: mayorPhoto.focusX,
            focusY: mayorPhoto.focusY,
            zoom: mayorPhoto.zoom,
            width: 440,
            height: 560,
            background: appearanceMod.resolveTheme(a).surface || '#e2e8f0',
          },
          { relativePath: mayorPhoto.relativePath, channel: `${channel}:mayor` }
        );
        mayorFrame = coverFrame.bufferToDataUrl(buffer, 'image/jpeg');
      } catch (_) {
        try {
          mayorFrame = mediaFileToDataUrl(abs);
        } catch (_) {
          mayorFrame = null;
        }
      }
    }
  }

  return { success: true, frames, mayorFrame, layoutId: a.coverLayoutId, channel };
}

/** Αφαιρεί διπλότυπες διαδρομές φωτογραφιών από δίσκο (παλιό bug ίδιου ονόματος αρχείου). */
function sanitizeReportPhotos(dataDir, report) {
  let changed = false;
  const cards = (report.cards || []).map((card) => {
    const photos = domain.normalizePhotoSlots(card.photos || {}, ['before', 'during', 'after']);
    const prev = JSON.stringify(card.photos || {});
    const next = JSON.stringify(photos);
    if (prev !== next) {
      changed = true;
      return { ...card, photos, updatedAt: new Date().toISOString() };
    }
    return card;
  });
  if (!changed) return { success: true, report, changed: false };
  const saved = saveReport(dataDir, { ...report, cards });
  if (!saved.success) return saved;
  return { success: true, report: saved.report, changed: true };
}

module.exports = {
  APOLOGISMOS_FOLDER,
  ensureDirs,
  loadPeriods,
  upsertPeriod,
  getPeriodById,
  getCurrentPeriod,
  loadReport,
  saveReport,
  addFromSubproject,
  addLegacyCard,
  updateCard,
  removeCard,
  syncAmounts,
  dismissBadge,
  saveCardPhoto,
  saveMapSnapshot,
  removeCardPhoto,
  reorderCardPhotoPrimary,
  deleteCardPhotoFile,
  resolveCardMediaAbsolute,
  resolveMediaMap,
  mediaFileToDataUrl,
  frameCoverImagesForExport,
  getMeta,
  enrichReportWithReadiness,
  sanitizeReportPhotos,
  updateAppearance,
  saveCoverImage,
  deleteAppearanceFile,
  cleanupAppearanceOrphans,
  buildPresentationModel: buildPresentationModelForExport,
  appearance: appearanceMod,
  domain,
  mediaIngest,
  coverFrameCache,
};

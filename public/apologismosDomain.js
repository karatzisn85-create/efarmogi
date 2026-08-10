/**
 * Pure domain για Απολογισμό τεχνικού έργου (main + tests via require).
 * Καμία αναφορά/υπολογισμός εκπτώσεων.
 */

const ELIGIBLE_STATUSES = Object.freeze([
  'ΟΛΟΚΛΗΡΩΜΕΝΟ',
  'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ',
]);

const CATEGORIES = Object.freeze([
  { id: 'roads', label: 'Οδοποιία & οδικό δίκτυο' },
  { id: 'mobility', label: 'Κυκλοφορία, στάθμευση & κινητικότητα' },
  { id: 'regeneration', label: 'Αναπλάσεις & δημόσιος χώρος' },
  { id: 'water', label: 'Ύδρευση & άρδευση' },
  { id: 'sewerage', label: 'Αποχέτευση & λύματα' },
  { id: 'waste', label: 'Καθαριότητα & απορρίμματα' },
  { id: 'environment', label: 'Περιβάλλον, ρέματα & πράσινο' },
  { id: 'buildings', label: 'Κτιριακά, σχολεία & αθλητισμός' },
  { id: 'other', label: 'Μελέτες, προμήθειες & λοιπά τεχνικά' },
]);

const CATEGORY_IDS = Object.freeze(CATEGORIES.map((c) => c.id));

const VIZ_MODES = Object.freeze([
  { id: 'before_after', label: 'Πριν / Μετά', photoPhases: ['before', 'after'] },
  { id: 'before_during_after', label: 'Πριν / Κατά / Μετά', photoPhases: ['before', 'during', 'after'] },
  { id: 'after_only', label: 'Φωτογραφίες «Μετά»', photoPhases: ['after'] },
  { id: 'map_path', label: 'Χάρτης σημείου / διαδρομής', photoPhases: [] },
  { id: 'map_multi', label: 'Χάρτης πολλαπλών σημείων', photoPhases: [] },
  { id: 'economy_phases', label: 'Έμφαση στα ποσά', photoPhases: [] },
  { id: 'metrics_table', label: 'Πίνακας αποτελεσμάτων', photoPhases: [] },
  { id: 'simple_card', label: 'Μόνο κείμενο', photoPhases: [] },
]);

/** Οικογένεια χωρίς οπτικό υλικό — δεν συνδυάζονται ως κύριος+δευτερεύων. */
const TEXT_ONLY_VIZ_IDS = Object.freeze(['simple_card', 'economy_phases']);

/** Παλιά ids που καταργήθηκαν → τρέχον ισοδύναμο. */
const DEPRECATED_VIZ_ALIASES = Object.freeze({
  amount_compare: 'economy_phases',
});

const VIZ_MODE_IDS = Object.freeze(VIZ_MODES.map((v) => v.id));

const MAX_PHOTOS_PER_PHASE = 3;
const MAX_METRICS_ROWS = 6;
const MAX_NARRATIVE_LINES = 3;

function parseAmountNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value ?? '').trim();
  if (!raw) return NaN;
  const normalized = raw
    .replace(/[€\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/** true αν υπάρχει μη κενό, αριθμητικά έγκυρο ποσό (>= 0). */
function hasUsableAmount(value) {
  const n = parseAmountNumber(value);
  return Number.isFinite(n) && n >= 0 && String(value ?? '').trim() !== '';
}

function yearBelongsToPeriod(year, period) {
  const y = Number(year);
  if (!Number.isFinite(y) || !period) return false;
  const start = Number(period.startYear);
  const end = Number(period.endYear);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return y >= start && y <= end;
}

function isEligibleSubprojectStatus(status) {
  return ELIGIBLE_STATUSES.includes(String(status || '').trim());
}

function getCategoryLabel(categoryId) {
  const found = CATEGORIES.find((c) => c.id === categoryId);
  return found ? found.label : '';
}

function resolveVizId(vizId) {
  if (!vizId) return vizId;
  return DEPRECATED_VIZ_ALIASES[vizId] || vizId;
}

function getVizMode(vizId) {
  return VIZ_MODES.find((v) => v.id === resolveVizId(vizId)) || null;
}

function isEconomyEmphasisViz(vizId) {
  return resolveVizId(vizId) === 'economy_phases';
}

function isTextOnlyVizFamily(vizId) {
  return TEXT_ONLY_VIZ_IDS.includes(resolveVizId(vizId));
}

/** Συμπαγή ποσά στην κεφαλίδα — όχι όταν ο κύριος τρόπος είναι «Έμφαση στα ποσά». */
function showHeaderAmountsForPrimary(primaryViz) {
  return !isEconomyEmphasisViz(primaryViz);
}

/** Το σύντομο κείμενο στην κεφαλίδα — στο «Μόνο κείμενο» πάει τονισμένο στο σώμα. */
function showHeaderNarrativeForPrimary(primaryViz) {
  return resolveVizId(primaryViz) !== 'simple_card';
}

/** Κύριος «Μόνο κείμενο» + δευτερεύων «Έμφαση στα ποσά» (και αντίστροφα) δεν επιτρέπεται. */
function areIncompatibleTextOnlyPair(primaryViz, secondaryViz) {
  if (!primaryViz || !secondaryViz) return false;
  const a = resolveVizId(primaryViz);
  const b = resolveVizId(secondaryViz);
  if (a === b) return false;
  return isTextOnlyVizFamily(a) && isTextOnlyVizFamily(b);
}

/**
 * Μετατρέπει καταργημένους τρόπους προβολής (π.χ. amount_compare → economy_phases).
 * Αν κύριος και δευτερεύων γίνουν ίδιοι, καθαρίζει τον δευτερεύοντα.
 */
function migrateDeprecatedVizIds(card) {
  if (!card || typeof card !== 'object') return { card, changed: false };
  const primaryViz = resolveVizId(card.primaryViz || '') || '';
  let secondaryViz = card.secondaryViz ? resolveVizId(card.secondaryViz) : null;
  if (secondaryViz && secondaryViz === primaryViz) secondaryViz = null;
  if (
    secondaryViz
    && TEXT_ONLY_VIZ_IDS.includes(primaryViz)
    && TEXT_ONLY_VIZ_IDS.includes(secondaryViz)
    && primaryViz !== secondaryViz
  ) {
    secondaryViz = null;
  }
  const changed = primaryViz !== (card.primaryViz || '')
    || secondaryViz !== (card.secondaryViz || null);
  if (!changed) return { card, changed: false };
  return {
    card: { ...card, primaryViz, secondaryViz },
    changed: true,
  };
}

function normalizePhotoSlots(photosByPhase, phases) {
  const out = {};
  for (const phase of phases) {
    const list = Array.isArray(photosByPhase?.[phase]) ? photosByPhase[phase] : [];
    const seen = new Set();
    const unique = [];
    for (const item of list) {
      if (!item) continue;
      const key = String(item);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
      if (unique.length >= MAX_PHOTOS_PER_PHASE) break;
    }
    out[phase] = unique;
  }
  return out;
}

const PHOTO_PHASE_LABELS_EL = Object.freeze({
  before: 'Πριν',
  during: 'Κατά τη διάρκεια',
  after: 'Μετά',
});

function photoPhaseLabelEl(phase) {
  return PHOTO_PHASE_LABELS_EL[phase] || phase;
}

/** Φάσεις φωτογραφιών που χρειάζονται για τους επιλεγμένους τρόπους οπτικοποίησης. */
function requiredPhotoPhasesForVizIds(vizIds) {
  const set = new Set();
  for (const id of vizIds || []) {
    const viz = getVizMode(id);
    if (!viz) continue;
    for (const phase of viz.photoPhases || []) set.add(phase);
  }
  return ['before', 'during', 'after'].filter((p) => set.has(p));
}

/** Συγχώνευση patch φωτογραφιών χωρίς να μηδενίζει φάσεις που δεν στάλθηκαν. */
function mergePhotoPhases(existingPhotos, patchPhotos) {
  const base = {
    before: [...(existingPhotos?.before || [])],
    during: [...(existingPhotos?.during || [])],
    after: [...(existingPhotos?.after || [])],
  };
  if (!patchPhotos || typeof patchPhotos !== 'object') {
    return normalizePhotoSlots(base, ['before', 'during', 'after']);
  }
  for (const phase of ['before', 'during', 'after']) {
    if (Object.prototype.hasOwnProperty.call(patchPhotos, phase)) {
      base[phase] = Array.isArray(patchPhotos[phase]) ? patchPhotos[phase] : [];
    }
  }
  return normalizePhotoSlots(base, ['before', 'during', 'after']);
}

function canAddPhotoToPhase(photosByPhase, phase) {
  if (!['before', 'during', 'after'].includes(phase)) {
    return { ok: false, error: 'Μη έγκυρη φάση φωτογραφίας' };
  }
  const count = normalizePhotoSlots(photosByPhase || {}, [phase])[phase].length;
  if (count >= MAX_PHOTOS_PER_PHASE) {
    return { ok: false, error: `Μέγιστο ${MAX_PHOTOS_PER_PHASE} φωτογραφίες ανά φάση («${photoPhaseLabelEl(phase)}»)` };
  }
  return { ok: true, remaining: MAX_PHOTOS_PER_PHASE - count };
}

function removePhotoFromPhase(photosByPhase, phase, relativePath) {
  const photos = mergePhotoPhases(photosByPhase, null);
  if (!['before', 'during', 'after'].includes(phase)) {
    return { ok: false, error: 'Μη έγκυρη φάση φωτογραφίας', photos };
  }
  const before = photos[phase] || [];
  const next = before.filter((p) => p !== relativePath);
  if (next.length === before.length) {
    return { ok: false, error: 'Δεν βρέθηκε η φωτογραφία', photos };
  }
  photos[phase] = next;
  return { ok: true, photos, removedPath: relativePath };
}

/** Μετακινεί φωτογραφία στη θέση 0 (κύρια) της φάσης. */
function movePhotoToPrimary(photosByPhase, phase, relativePath) {
  const photos = mergePhotoPhases(photosByPhase, null);
  if (!['before', 'during', 'after'].includes(phase)) {
    return { ok: false, error: 'Μη έγκυρη φάση φωτογραφίας', photos };
  }
  const list = [...(photos[phase] || [])];
  const idx = list.indexOf(relativePath);
  if (idx < 0) return { ok: false, error: 'Δεν βρέθηκε η φωτογραφία', photos };
  if (idx === 0) return { ok: true, photos, changed: false };
  list.splice(idx, 1);
  list.unshift(relativePath);
  photos[phase] = list;
  return { ok: true, photos, changed: true };
}

function validatePhotoPhases(photosByPhase, phases, { minPerPhase = 1 } = {}) {
  const errors = [];
  const normalized = normalizePhotoSlots(photosByPhase, phases);
  for (const phase of phases) {
    const count = (normalized[phase] || []).length;
    const label = photoPhaseLabelEl(phase);
    if (count < minPerPhase) {
      errors.push(`Απαιτείται τουλάχιστον ${minPerPhase} φωτογραφία στη φάση «${label}»`);
    }
    if (count > MAX_PHOTOS_PER_PHASE) {
      errors.push(`Μέγιστο ${MAX_PHOTOS_PER_PHASE} φωτογραφίες ανά φάση («${label}»)`);
    }
  }
  return { ok: errors.length === 0, errors, photos: normalized };
}

/** Η πρώτη φωτογραφία κάθε φάσης είναι η κύρια. */
function getPrimaryPhoto(photosByPhase, phase) {
  const list = Array.isArray(photosByPhase?.[phase]) ? photosByPhase[phase] : [];
  return list[0] || null;
}

function normalizeMetrics(metrics) {
  const rows = Array.isArray(metrics) ? metrics : [];
  return rows
    .map((r) => ({
      label: String(r?.label || '').trim(),
      value: String(r?.value || '').trim(),
    }))
    .filter((r) => r.label || r.value)
    .slice(0, MAX_METRICS_ROWS);
}

function countNarrativeLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean).length;
}

function validateNarrative(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return { ok: false, error: 'Το σύντομο κείμενο είναι υποχρεωτικό' };
  const lines = countNarrativeLines(trimmed);
  if (lines > MAX_NARRATIVE_LINES) {
    return { ok: false, error: `Το κείμενο μπορεί να έχει έως ${MAX_NARRATIVE_LINES} γραμμές` };
  }
  return { ok: true, text: trimmed };
}

function validateMapPoints(points, { min = 1 } = {}) {
  const list = Array.isArray(points) ? points : [];
  const clean = list
    .map((p) => ({
      lat: Number(p?.lat),
      lng: Number(p?.lng),
      label: String(p?.label || '').trim(),
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
      && !(p.lat === 0 && p.lng === 0));
  if (clean.length < min) {
    return { ok: false, error: `Απαιτείται τουλάχιστον ${min} σημείο στον χάρτη`, points: clean };
  }
  return { ok: true, points: clean };
}

function emptyMapDrawing() {
  return { type: 'FeatureCollection', features: [] };
}

function normalizeLeaderStyleProps(props = {}) {
  const color = String(props.leaderColor || '#ffffff').trim() || '#ffffff';
  let weight = Number(props.leaderWeight);
  if (!Number.isFinite(weight) || weight < 0.5) weight = 1.5;
  if (weight > 8) weight = 8;
  const allowedDash = ['solid', 'dashed', 'dotted', 'dashdot'];
  const leaderDash = allowedDash.includes(props.leaderDash) ? props.leaderDash : 'solid';
  const labelLat = Number(props.labelLat);
  const labelLng = Number(props.labelLng);
  const hasLabelPos = Number.isFinite(labelLat) && Number.isFinite(labelLng)
    && !(labelLat === 0 && labelLng === 0);
  return {
    leaderColor: color,
    leaderWeight: weight,
    leaderDash,
    labelLat: hasLabelPos ? labelLat : null,
    labelLng: hasLabelPos ? labelLng : null,
  };
}

function normalizeMapDrawing(drawing) {
  if (!drawing || drawing.type !== 'FeatureCollection' || !Array.isArray(drawing.features)) {
    return emptyMapDrawing();
  }
  const features = drawing.features
    .filter((f) => f && f.type === 'Feature' && f.geometry && f.geometry.type)
    .map((f, i) => {
      const baseProps = f.properties && typeof f.properties === 'object' ? f.properties : {};
      const name = String(baseProps.name || baseProps.label || '').trim();
      const leader = normalizeLeaderStyleProps(baseProps);
      return {
        type: 'Feature',
        id: f.id != null ? f.id : `f-${i}`,
        properties: {
          ...baseProps,
          name,
          ...leader,
          // Χωρίς όνομα δεν κρατάμε θέση ετικέτας
          labelLat: name ? leader.labelLat : null,
          labelLng: name ? leader.labelLng : null,
        },
        geometry: f.geometry,
      };
    });
  return { type: 'FeatureCollection', features };
}

function countMapPointFeatures(drawing) {
  const normalized = normalizeMapDrawing(drawing);
  return normalized.features.filter((f) => f.geometry?.type === 'Point').length;
}

function countMapDrawableFeatures(drawing) {
  const normalized = normalizeMapDrawing(drawing);
  return normalized.features.filter((f) => (
    f.geometry?.type === 'Point'
    || f.geometry?.type === 'LineString'
    || f.geometry?.type === 'Polygon'
  )).length;
}

/** Μετατροπή παλιών mapPoints σε GeoJSON για τον επεξεργαστή. */
function legacyMapPointsToDrawing(points) {
  const validated = validateMapPoints(points, { min: 0 });
  const features = (validated.points || []).map((p, i) => ({
    type: 'Feature',
    id: `legacy-point-${i}`,
    properties: { name: p.label || `Σημείο ${i + 1}` },
    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
  }));
  return { type: 'FeatureCollection', features };
}

/** Σχέδιο κάρτας: αποθηκευμένο mapDrawing ή fallback από legacy mapPoints. */
function resolveCardMapDrawing(card) {
  const fromStored = normalizeMapDrawing(card?.mapDrawing);
  if (fromStored.features.length > 0) return fromStored;
  return legacyMapPointsToDrawing(card?.mapPoints);
}

function hasMapSnapshot(card) {
  return Boolean(card?.mapSnapshot && String(card.mapSnapshot).trim());
}

/**
 * Απαιτήσεις χάρτη: στιγμιότυπο + ελάχιστα σημεία (ή τουλάχιστον ένα στοιχείο σχεδίασης για map_path).
 */
function validateMapVizRequirements(card, { minPoints = 1 } = {}) {
  if (!hasMapSnapshot(card)) {
    return {
      ok: false,
      error: 'Απαιτείται αποθηκευμένος χάρτης από τον επεξεργαστή',
    };
  }
  const drawing = resolveCardMapDrawing(card);
  const pointCount = countMapPointFeatures(drawing);
  const drawableCount = countMapDrawableFeatures(drawing);
  if (minPoints >= 2) {
    if (pointCount < minPoints) {
      return {
        ok: false,
        error: `Απαιτούνται τουλάχιστον ${minPoints} σημεία στον χάρτη`,
        pointCount,
      };
    }
  } else if (drawableCount < 1 && pointCount < 1) {
    // Legacy: στιγμιότυπο + παλιά σημεία ήδη μέσα στο resolveCardMapDrawing
    const legacy = validateMapPoints(card?.mapPoints, { min: 1 });
    if (!legacy.ok) {
      return {
        ok: false,
        error: 'Απαιτείται τουλάχιστον ένα σημείο, γραμμή ή περιοχή στον χάρτη',
        pointCount,
      };
    }
  }
  return { ok: true, pointCount, drawing };
}

/**
 * Ελέγχει αν η κάρτα είναι έτοιμη για παρουσίαση.
 * @returns {{ ready: boolean, errors: string[] }}
 */
function getCardReadiness(card) {
  const errors = [];
  if (!card || typeof card !== 'object') {
    return { ready: false, errors: ['Μη έγκυρη κάρτα'] };
  }

  const { card: normalized } = migrateDeprecatedVizIds(card);

  if (!CATEGORY_IDS.includes(normalized.categoryId)) {
    errors.push('Απαιτείται κατηγορία απολογισμού');
  }

  const narrative = validateNarrative(normalized.narrative);
  if (!narrative.ok) errors.push(narrative.error);

  const approved = parseAmountNumber(normalized.approvedAmount);
  if (!Number.isFinite(approved) || approved < 0) {
    errors.push('Απαιτείται έγκυρο εγκεκριμένο ποσό');
  }
  const contract = parseAmountNumber(normalized.contractAmount);
  if (!Number.isFinite(contract) || contract < 0) {
    errors.push('Απαιτείται έγκυρο συμβατικό ποσό');
  }

  if (!normalized.title || !String(normalized.title).trim()) {
    errors.push('Απαιτείται τίτλος');
  }

  const vizErrors = collectVizRequirementErrors(normalized, normalized.primaryViz, 'κύρια');
  errors.push(...vizErrors);

  if (normalized.source === 'legacy') {
    if (!String(normalized.area || '').trim()) {
      errors.push('Απαιτείται περιοχή');
    }
    const year = Number(normalized.completionYear);
    if (!Number.isFinite(year) || year < 1990 || year > 2100) {
      errors.push('Απαιτείται έτος ολοκλήρωσης');
    }
  }

  if (normalized.secondaryViz) {
    if (!VIZ_MODE_IDS.includes(normalized.secondaryViz)) {
      errors.push('Μη έγκυρη δευτερεύουσα οπτικοποίηση');
    } else if (normalized.secondaryViz === normalized.primaryViz) {
      errors.push('Η δευτερεύουσα οπτικοποίηση πρέπει να διαφέρει από την κύρια');
    } else if (areIncompatibleTextOnlyPair(normalized.primaryViz, normalized.secondaryViz)) {
      errors.push('Το «Μόνο κείμενο» και η «Έμφαση στα ποσά» δεν συνδυάζονται· επιλέξτε ένα από τα δύο');
    } else {
      errors.push(...collectVizRequirementErrors(normalized, normalized.secondaryViz, 'δευτερεύουσα'));
    }
  }

  return { ready: errors.length === 0, errors };
}

function collectVizRequirementErrors(card, vizId, label) {
  const errors = [];
  const viz = getVizMode(vizId);
  if (!viz) {
    if (label === 'κύρια') errors.push('Απαιτείται κύριος τρόπος οπτικοποίησης');
    return errors;
  }
  const photos = card.photos || {};
  const prefix = label === 'κύρια' ? '' : `Για τη ${label} οπτικοποίηση: `;
  if (viz.id === 'before_after') {
    const r = validatePhotoPhases(photos, ['before', 'after']);
    if (!r.ok) errors.push(...r.errors.map((e) => prefix + e));
  } else if (viz.id === 'before_during_after') {
    const r = validatePhotoPhases(photos, ['before', 'during', 'after']);
    if (!r.ok) errors.push(...r.errors.map((e) => prefix + e));
  } else if (viz.id === 'after_only') {
    const r = validatePhotoPhases(photos, ['after']);
    if (!r.ok) errors.push(...r.errors.map((e) => prefix + e));
  } else if (viz.id === 'map_path' || viz.id === 'map_multi') {
    const r = validateMapVizRequirements(card, { minPoints: viz.id === 'map_multi' ? 2 : 1 });
    if (!r.ok) errors.push(prefix + r.error);
  } else if (viz.id === 'metrics_table') {
    const metrics = normalizeMetrics(card.metrics);
    if (metrics.length === 0) {
      errors.push(`${prefix}Απαιτείται τουλάχιστον μία γραμμή αποτελεσμάτων`);
    }
  }
  return errors;
}

function sortCardsByApprovedAmountDesc(cards) {
  return [...(cards || [])].sort((a, b) => {
    const aa = parseAmountNumber(a?.approvedAmount);
    const bb = parseAmountNumber(b?.approvedAmount);
    const na = Number.isFinite(aa) ? aa : 0;
    const nb = Number.isFinite(bb) ? bb : 0;
    if (nb !== na) return nb - na;
    return String(a?.title || '').localeCompare(String(b?.title || ''), 'el');
  });
}

function mapSubprojectToCardFields(subproject) {
  if (!subproject) return null;
  return {
    source: 'linked',
    subprojectId: subproject.subprojectId || null,
    projectId: subproject.projectId || null,
    title: String(subproject.subprojectTitle || subproject.projectTitle || '').trim(),
    approvedAmount: subproject.approvedAmount ?? '',
    contractAmount: subproject.contractAmount ?? '',
    projectStatus: subproject.projectStatus || '',
    area: String(subproject.municipalUnit || subproject.location || '').trim(),
  };
}

function canAddLinkedSubproject(subproject, existingCards) {
  if (!subproject) {
    return { ok: false, error: 'Δεν βρέθηκε υποέργο' };
  }
  if (!isEligibleSubprojectStatus(subproject.projectStatus)) {
    return {
      ok: false,
      error: 'Μόνο ολοκληρωμένα ή ολοκληρωμένα και αποπληρωμένα υποέργα μπορούν να ενταχθούν',
    };
  }
  const sid = subproject.subprojectId;
  if (!sid) {
    return { ok: false, error: 'Λείπει αναγνωριστικό υποέργου' };
  }
  const dup = (existingCards || []).some(
    (c) => c.source === 'linked' && c.subprojectId === sid
  );
  if (dup) {
    return { ok: false, error: 'Το υποέργο υπάρχει ήδη στον απολογισμό' };
  }
  return { ok: true };
}

function validateLegacyCardInput(input, period) {
  const errors = [];
  const title = String(input?.title || '').trim();
  if (!title) errors.push('Απαιτείται τίτλος');
  const area = String(input?.area || '').trim();
  if (!area) errors.push('Απαιτείται περιοχή');
  const year = Number(input?.completionYear);
  if (!Number.isFinite(year) || year < 1990 || year > 2100) {
    errors.push('Απαιτείται έγκυρο έτος ολοκλήρωσης');
  } else if (period && !yearBelongsToPeriod(year, period)) {
    errors.push(
      `Το έτος ολοκλήρωσης ${year} δεν ανήκει στη δημοτική περίοδο ${period.startYear}–${period.endYear}`
    );
  }
  const approved = parseAmountNumber(input?.approvedAmount);
  if (!Number.isFinite(approved) || approved < 0) {
    errors.push('Απαιτείται έγκυρο εγκεκριμένο ποσό');
  }
  const contract = parseAmountNumber(input?.contractAmount);
  if (!Number.isFinite(contract) || contract < 0) {
    errors.push('Απαιτείται έγκυρο συμβατικό ποσό');
  }
  return {
    ok: errors.length === 0,
    errors,
    normalized: {
      title,
      area,
      completionYear: year,
      approvedAmount: input?.approvedAmount,
      contractAmount: input?.contractAmount,
    },
  };
}

/**
 * Συγχρονίζει ποσά από πηγαίο υποέργο.
 * Κενό/άκυρο ποσό στο υποέργο ΔΕΝ αντικαθιστά χειροκίνητη τιμή στην κάρτα.
 * Αν αλλάξουν → amountChangedBadge = true.
 */
function syncCardAmountsFromSubproject(card, subproject) {
  if (!card || card.source !== 'linked' || !subproject) {
    return { card, changed: false };
  }
  const nextApproved = hasUsableAmount(subproject.approvedAmount)
    ? subproject.approvedAmount
    : card.approvedAmount;
  const nextContract = hasUsableAmount(subproject.contractAmount)
    ? subproject.contractAmount
    : card.contractAmount;
  const approvedChanged =
    String(nextApproved ?? '') !== String(card.approvedAmount ?? '');
  const contractChanged =
    String(nextContract ?? '') !== String(card.contractAmount ?? '');
  if (!approvedChanged && !contractChanged) {
    return { card, changed: false };
  }
  return {
    changed: true,
    card: {
      ...card,
      approvedAmount: nextApproved,
      contractAmount: nextContract,
      amountChangedBadge: true,
      updatedAt: new Date().toISOString(),
    },
  };
}

function dismissAmountBadge(card) {
  if (!card) return card;
  return {
    ...card,
    amountChangedBadge: false,
  };
}

function createEmptyReport(periodId) {
  const appearance = require('./apologismosAppearance').emptyAppearance();
  return {
    periodId,
    cards: [],
    appearance,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

function createDefaultPeriod() {
  return {
    id: '2024-2028',
    startYear: 2024,
    endYear: 2028,
    label: 'Δημοτική περίοδος 2024–2028',
    isCurrent: true,
  };
}

function resolveMediaPathSafe(dataDir, apologismosRoot, relativePath) {
  const pathMod = require('path');
  if (!relativePath || typeof relativePath !== 'string') {
    return { ok: false, error: 'Μη έγκυρο path' };
  }
  if (relativePath.includes('..') || pathMod.isAbsolute(relativePath)) {
    return { ok: false, error: 'Μη επιτρεπτό path' };
  }
  const root = pathMod.resolve(apologismosRoot);
  const dataRoot = pathMod.resolve(dataDir);
  const resolved = pathMod.resolve(pathMod.join(root, relativePath));
  const rootPrefix = root.endsWith(pathMod.sep) ? root : root + pathMod.sep;
  const dataPrefix = dataRoot.endsWith(pathMod.sep) ? dataRoot : dataRoot + pathMod.sep;
  const insideRoot = resolved === root || resolved.startsWith(rootPrefix);
  const insideData = resolved === dataRoot || resolved.startsWith(dataPrefix);
  if (!insideRoot || !insideData) {
    return { ok: false, error: 'Μη επιτρεπτό path' };
  }
  return { ok: true, resolved };
}

function sumAmounts(cards, field) {
  return (cards || []).reduce((acc, c) => {
    const n = parseAmountNumber(c?.[field]);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

module.exports = {
  ELIGIBLE_STATUSES,
  CATEGORIES,
  CATEGORY_IDS,
  VIZ_MODES,
  VIZ_MODE_IDS,
  MAX_PHOTOS_PER_PHASE,
  MAX_METRICS_ROWS,
  MAX_NARRATIVE_LINES,
  parseAmountNumber,
  hasUsableAmount,
  yearBelongsToPeriod,
  isEligibleSubprojectStatus,
  getCategoryLabel,
  getVizMode,
  resolveVizId,
  migrateDeprecatedVizIds,
  isEconomyEmphasisViz,
  isTextOnlyVizFamily,
  showHeaderAmountsForPrimary,
  showHeaderNarrativeForPrimary,
  areIncompatibleTextOnlyPair,
  TEXT_ONLY_VIZ_IDS,
  normalizePhotoSlots,
  mergePhotoPhases,
  canAddPhotoToPhase,
  removePhotoFromPhase,
  movePhotoToPrimary,
  validatePhotoPhases,
  getPrimaryPhoto,
  normalizeMetrics,
  countNarrativeLines,
  validateNarrative,
  validateMapPoints,
  emptyMapDrawing,
  normalizeMapDrawing,
  countMapPointFeatures,
  countMapDrawableFeatures,
  legacyMapPointsToDrawing,
  resolveCardMapDrawing,
  hasMapSnapshot,
  validateMapVizRequirements,
  collectVizRequirementErrors,
  getCardReadiness,
  sortCardsByApprovedAmountDesc,
  mapSubprojectToCardFields,
  canAddLinkedSubproject,
  validateLegacyCardInput,
  syncCardAmountsFromSubproject,
  dismissAmountBadge,
  createEmptyReport,
  createDefaultPeriod,
  resolveMediaPathSafe,
  sumAmounts,
  PHOTO_PHASE_LABELS_EL,
  photoPhaseLabelEl,
  requiredPhotoPhasesForVizIds,
};

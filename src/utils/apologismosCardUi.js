/**
 * Καθαρές συναρτήσεις για την οθόνη απολογισμού (λίστα, φωτογραφίες, απαιτήσεις οπτικοποίησης).
 * Μένουν εκτός component ώστε να ελέγχονται αυτόματα.
 */

export const PHOTO_PHASE_ORDER = ['before', 'during', 'after'];

const MAP_VIZ_IDS = ['map_path', 'map_multi'];
const TEXT_ONLY_VIZ_IDS = ['simple_card', 'economy_phases'];

/**
 * Πεζά χωρίς τόνους και με ενιαίο σίγμα: τα ελληνικά κεφαλαία γράφονται άτονα,
 * οπότε αναζήτηση «ΚΕΝΤΡΟ» πρέπει να βρίσκει «Κέντρο».
 */
function normalizeSearchTerm(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('el-GR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ς/g, 'σ');
}

/** Φιλτράρισμα λίστας καρτών με αναζήτηση σε τίτλο/περιοχή και κατάσταση ετοιμότητας. */
export function filterApologismosCards(cards, { search = '', status = 'all' } = {}) {
  const term = normalizeSearchTerm(search);
  return (cards || []).filter((card) => {
    if (status === 'ready' && !card?.ready) return false;
    if (status === 'pending' && card?.ready) return false;
    if (!term) return true;
    const haystack = normalizeSearchTerm(`${card?.title || ''} ${card?.area || ''}`);
    return haystack.includes(term);
  });
}

/** Ενιαία λίστα φωτογραφιών της κάρτας, με σειρά φάσεων και θέση εντός φάσης.
 * Αν υπάρχει αποθηκευμένος χάρτης, προστίθεται στο τέλος ως phase «map».
 */
export function flattenCardPhotos(card) {
  const photos = card?.photos || {};
  const out = [];
  for (const phase of PHOTO_PHASE_ORDER) {
    const list = Array.isArray(photos[phase]) ? photos[phase] : [];
    list.forEach((rel, idx) => {
      if (rel) out.push({ phase, rel, idx });
    });
  }
  const snap = card?.mapSnapshot && String(card.mapSnapshot).trim();
  if (snap) {
    out.push({ phase: 'map', rel: snap, idx: 0, kind: 'map' });
  }
  return out;
}

export function isMapViewerItem(item) {
  return Boolean(item && (item.phase === 'map' || item.kind === 'map'));
}

/** Επόμενη/προηγούμενη φωτογραφία με κυκλική μετάβαση. */
export function stepPhotoPath(list, currentPath, delta) {
  const items = Array.isArray(list) ? list : [];
  if (items.length === 0) return null;
  const current = items.findIndex((p) => p.rel === currentPath);
  const base = current >= 0 ? current : 0;
  const next = (base + delta + items.length) % items.length;
  return items[next].rel;
}

/** Οι τρόποι προβολής που χρησιμοποιεί η κάρτα (κύριος + δευτερεύων). */
export function cardVizIds(card) {
  return [card?.primaryViz, card?.secondaryViz].filter(Boolean);
}

export function needsMapInput(vizIds) {
  return (vizIds || []).some((id) => MAP_VIZ_IDS.includes(id));
}

export function needsMetricsInput(vizIds) {
  return (vizIds || []).includes('metrics_table');
}

/** Ελάχιστα σημεία χάρτη: 2 όταν εμπλέκεται ο χάρτης πολλαπλών σημείων. */
export function minMapPoints(vizIds) {
  return (vizIds || []).includes('map_multi') ? 2 : 1;
}

/** Φάσεις φωτογραφιών που απαιτούν συνολικά οι δοσμένοι τρόποι προβολής. */
export function photoPhasesForVizIds(vizModes, vizIds) {
  const set = new Set();
  for (const id of vizIds || []) {
    const viz = (vizModes || []).find((v) => v.id === id);
    for (const phase of viz?.photoPhases || []) set.add(phase);
  }
  return PHOTO_PHASE_ORDER.filter((phase) => set.has(phase));
}

/**
 * Ο δευτερεύων δεν μπορεί να είναι ίδιος με τον κύριο,
 * ούτε να ανήκει στην ίδια οικογένεια «χωρίς οπτικό υλικό» (μόνο κείμενο / έμφαση ποσών).
 */
export function secondaryVizOptions(vizModes, primaryViz) {
  return (vizModes || []).filter((v) => {
    if (!v?.id || v.id === primaryViz) return false;
    if (
      TEXT_ONLY_VIZ_IDS.includes(primaryViz)
      && TEXT_ONLY_VIZ_IDS.includes(v.id)
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Οδηγός ανά τρόπο προβολής: τι θα δει ο χρήστης στην παρουσίαση
 * και τι πρέπει να συμπληρώσει τώρα στην κάρτα.
 * @returns {{ shows: string, needs: string } | null}
 */
export function vizUserGuide(vizId, { vizModes = [], phaseLabel = (p) => p } = {}) {
  if (!vizId) return null;
  const phases = photoPhasesForVizIds(vizModes, [vizId]);
  const phaseList = phases.map(phaseLabel).join(', ');

  switch (vizId) {
    case 'before_after':
      return {
        shows: 'Κύριο περιεχόμενο: φωτογραφίες «Πριν» και «Μετά» δίπλα-δίπλα. Κάτω από τον τίτλο φαίνονται συμπαγή τα ποσά.',
        needs: `Ανεβάστε τουλάχιστον μία φωτογραφία σε κάθε φάση: ${phaseList}.`,
      };
    case 'before_during_after':
      return {
        shows: 'Κύριο περιεχόμενο: φωτογραφίες «Πριν», «Κατά τη διάρκεια» και «Μετά». Κάτω από τον τίτλο φαίνονται συμπαγή τα ποσά.',
        needs: `Ανεβάστε τουλάχιστον μία φωτογραφία σε κάθε φάση: ${phaseList}.`,
      };
    case 'after_only':
      return {
        shows: 'Κύριο περιεχόμενο: φωτογραφίες «Μετά». Το σύντομο κείμενο μένει στην ταυτότητα του έργου (κάτω από τον τίτλο).',
        needs: 'Ανεβάστε τουλάχιστον μία φωτογραφία «Μετά».',
      };
    case 'map_path':
      return {
        shows: 'Κύριο περιεχόμενο: αποθηκευμένο στιγμιότυπο χάρτη (σημείο, διαδρομή ή περιοχή).',
        needs: 'Ανοίξτε τον επεξεργαστή χάρτη, σχεδιάστε τουλάχιστον ένα στοιχείο και αποθηκεύστε.',
      };
    case 'map_multi':
      return {
        shows: 'Κύριο περιεχόμενο: αποθηκευμένο στιγμιότυπο χάρτη με πολλά σημεία.',
        needs: 'Ανοίξτε τον επεξεργαστή χάρτη, τοποθετήστε τουλάχιστον 2 σημεία και αποθηκεύστε.',
      };
    case 'economy_phases':
      return {
        shows: 'Τα ποσά εμφανίζονται μεγάλα ως κύριο περιεχόμενο· δεν επαναλαμβάνονται μικρά κάτω από τον τίτλο.',
        needs: 'Βεβαιωθείτε ότι τα ποσά στην ενότητα «Ποσά & περιοχή» είναι συμπληρωμένα.',
      };
    case 'metrics_table':
      return {
        shows: 'Κύριο περιεχόμενο: πίνακας αποτελεσμάτων με στήλες «Δείκτης / αποτέλεσμα» και «Τιμή».',
        needs: 'Συμπληρώστε τουλάχιστον μία γραμμή στον πίνακα αποτελεσμάτων παρακάτω.',
      };
    case 'simple_card':
      return {
        shows: 'Σελίδα χωρίς φωτογραφίες ή χάρτη· κυριαρχεί το σύντομο κείμενο. Τα ποσά φαίνονται συμπαγή κάτω από τον τίτλο.',
        needs: 'Συμπληρώστε τίτλο, σύντομο κείμενο και ποσά. Δεν απαιτούνται φωτογραφίες ή χάρτης.',
      };
    default:
      return null;
  }
}

/** Τι πρέπει να συμπληρωθεί για να λειτουργήσει ένας τρόπος προβολής. */
export function vizRequirementText(vizId, opts) {
  return vizUserGuide(vizId, opts)?.needs || '';
}

/** Τονίζει το σύντομο κείμενο όταν ο τρόπος το κάνει κύριο σώμα («Μόνο κείμενο»). */
export function needsNarrativeEmphasis(vizIds) {
  return (vizIds || []).some((id) => id === 'simple_card');
}

/** Τονίζει τα ποσά όταν ο τρόπος είναι «Έμφαση στα ποσά». */
export function needsAmountsEmphasis(vizIds) {
  return (vizIds || []).some((id) => id === 'economy_phases' || id === 'amount_compare');
}

/** Σταθερές στήλες πίνακα αποτελεσμάτων (όχι ελεύθερο Excel). */
export const METRICS_MAX_ROWS = 6;

export const METRICS_COLUMNS = Object.freeze([
  { id: 'label', title: 'Δείκτης / αποτέλεσμα', hint: 'Τι μετράμε ή τι ολοκληρώθηκε' },
  { id: 'value', title: 'Τιμή', hint: 'Αριθμός ή σύντομη τιμή με μονάδα' },
]);

/** Παράδειγμα στησίματος για το κουμπί βοήθειας «i». */
export const METRICS_EXAMPLE = Object.freeze({
  title: 'Παράδειγμα πίνακα αποτελεσμάτων',
  columns: METRICS_COLUMNS.map((c) => ({ id: c.id, title: c.title })),
  rows: Object.freeze([
    { label: 'Μήκος ασφαλτόστρωσης', value: '1,2 χλμ' },
    { label: 'Νέες θέσεις στάθμευσης', value: '48' },
    { label: 'Αντικατάσταση αγωγού ύδρευσης', value: '850 μ.' },
    { label: 'Δέντρα που φυτεύτηκαν', value: '120' },
  ]),
  note: 'Ο πίνακας έχει πάντα δύο στήλες με αυτά τα ονόματα. Συμπληρώνετε έως 6 γραμμές με μετρήσιμα αποτελέσματα του έργου.',
});

/** Γραμμές για επεξεργασία: τουλάχιστον μία κενή αν δεν υπάρχουν δεδομένα. */
export function draftMetricsRows(metrics, { minRows = 1, maxRows = METRICS_MAX_ROWS } = {}) {
  const rows = (Array.isArray(metrics) ? metrics : [])
    .map((r) => ({
      label: String(r?.label || ''),
      value: String(r?.value || ''),
    }))
    .slice(0, maxRows);
  while (rows.length < minRows) rows.push({ label: '', value: '' });
  return rows;
}

/** Καθαρισμός πριν την αποθήκευση (αγνοεί τελείως κενές γραμμές). */
export function cleanMetricsRows(rows, { maxRows = METRICS_MAX_ROWS } = {}) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      label: String(r?.label || '').trim(),
      value: String(r?.value || '').trim(),
    }))
    .filter((r) => r.label || r.value)
    .slice(0, maxRows);
}

export function updateMetricsRow(rows, index, patch, { maxRows = METRICS_MAX_ROWS } = {}) {
  const next = draftMetricsRows(rows, { minRows: 0, maxRows });
  if (index < 0 || index >= next.length) return next;
  next[index] = { ...next[index], ...patch };
  return next;
}

export function addMetricsRow(rows, { maxRows = METRICS_MAX_ROWS } = {}) {
  const next = draftMetricsRows(rows, { minRows: 0, maxRows });
  if (next.length >= maxRows) return next;
  return [...next, { label: '', value: '' }];
}

export function removeMetricsRow(rows, index, { minRows = 1, maxRows = METRICS_MAX_ROWS } = {}) {
  const next = draftMetricsRows(rows, { minRows: 0, maxRows }).filter((_, i) => i !== index);
  return draftMetricsRows(next, { minRows, maxRows });
}

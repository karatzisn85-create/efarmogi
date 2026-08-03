/**
 * Μόνιμα ευρήματα ανανέωσης ΚΗΜΔΗΣ ανά υποέργο.
 *
 * Η μαζική ανανέωση δεν ανοίγει τα παράθυρα εκκρεμοτήτων που ανοίγει η μεμονωμένη ανάκτηση
 * (έλεγχος στοιχείων, ΑΠΕ, λήξη σύμβασης, μητρώο εγγράφων). Τα ευρήματά της γράφονται εδώ,
 * μέσα στο ίδιο το υποέργο (`khmdhsLastRefreshFindings`), ώστε να επιβιώνουν κλεισίματος της
 * εφαρμογής και να παραμένουν ορατά μέχρι ο χρήστης να τα δει και να ενεργήσει.
 */

import { getUnresolvedReviewItems } from './khmdhsDataQualityReport';

export const KHMDHS_FINDINGS_FIELD = 'khmdhsLastRefreshFindings';
export const KHMDHS_FINDINGS_VERSION = 1;

export const KHMDHS_FINDING_OUTCOME = {
  APPLIED: 'applied',
  ATTENTION: 'attention',
  UNCHANGED: 'unchanged',
  INTERVENED: 'intervened',
  FAILED: 'failed',
};

/** Ενέργειες που στη μεμονωμένη ροή θα άνοιγαν παράθυρο και στη μαζική απλώς καταγράφονται. */
export const KHMDHS_FINDING_ACTION = {
  CHARACTERIZE_SYMV: 'characterize_symv',
  APE_CONFLICT: 'ape_conflict',
  DATA_REVIEW: 'data_review',
  RETRY_FETCH: 'retry_fetch',
};

const ACTION_PRESETS = {
  [KHMDHS_FINDING_ACTION.CHARACTERIZE_SYMV]: {
    icon: '📄',
    title: 'Χαρακτηρισμός πολλαπλών εγγράφων σύμβασης',
    detail: 'Η αλυσίδα έχει περισσότερα από ένα SYMV. Ορίστε ποιο είναι κύρια σύμβαση, ποιο παράταση '
      + 'και ποιο συμπληρωματική. Μέχρι τότε δεν αποθηκεύεται καμία αυτόματη αλλαγή.',
  },
  [KHMDHS_FINDING_ACTION.APE_CONFLICT]: {
    icon: '⚖️',
    title: 'Διαφορά ποσού ΑΠΕ',
    detail: 'Το ποσό ΑΠΕ που έχετε καταχωρημένο διαφέρει από αυτό που προτείνει το ΚΗΜΔΗΣ. '
      + 'Επιλέξτε ποιο κρατάτε.',
  },
  [KHMDHS_FINDING_ACTION.DATA_REVIEW]: {
    icon: '🔎',
    title: 'Εκκρεμεί έλεγχος στοιχείων ΚΗΜΔΗΣ',
    detail: 'Υπάρχουν πεδία που χρειάζονται συμπλήρωση ή επιβεβαίωση μετά την ανανέωση.',
  },
  [KHMDHS_FINDING_ACTION.RETRY_FETCH]: {
    icon: '🔁',
    title: 'Η ανάκτηση δεν ολοκληρώθηκε',
    detail: 'Δεν αποθηκεύτηκε καμία αλλαγή. Δοκιμάστε ξανά ανανέωση για αυτό το υποέργο.',
  },
};

function cleanLines(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map((l) => String(l || '').trim())
    .filter(Boolean);
}

export function buildKhmdhsFindingAction(id, overrides = {}) {
  const preset = ACTION_PRESETS[id] || {};
  return {
    id,
    icon: overrides.icon || preset.icon || '⚠️',
    title: overrides.title || preset.title || 'Χρειάζεται ενέργεια',
    detail: overrides.detail || preset.detail || '',
  };
}

/**
 * Δημιουργεί την εγγραφή ευρημάτων που αποθηκεύεται στο υποέργο.
 * Επιστρέφει `null` όταν δεν υπάρχει τίποτα άξιο αναφοράς (καθαρή ανανέωση χωρίς διαφορές).
 */
export function buildKhmdhsRefreshFindings({
  outcome,
  source = 'batch',
  runId = '',
  at = null,
  by = '',
  seedAdam = '',
  appliedLines = [],
  attentionLines = [],
  actions = [],
  error = '',
} = {}) {
  const applied = cleanLines(appliedLines);
  const attention = cleanLines(attentionLines);
  const actionList = (Array.isArray(actions) ? actions : []).filter(Boolean);
  const errorText = String(error || '').trim();

  const worthKeeping = attention.length > 0
    || actionList.length > 0
    || !!errorText
    || applied.length > 0;
  if (!worthKeeping) return null;

  return {
    version: KHMDHS_FINDINGS_VERSION,
    outcome: outcome || KHMDHS_FINDING_OUTCOME.ATTENTION,
    source,
    runId: String(runId || ''),
    at: at || new Date().toISOString(),
    by: String(by || ''),
    seedAdam: String(seedAdam || ''),
    appliedLines: applied,
    attentionLines: attention,
    actions: actionList,
    error: errorText,
    acknowledgedAt: null,
    acknowledgedBy: '',
  };
}

export function getKhmdhsRefreshFindings(project) {
  const f = project?.[KHMDHS_FINDINGS_FIELD];
  if (!f || typeof f !== 'object') return null;
  return f;
}

/**
 * Ευρήματα που ζητούν ενέργεια: όσο δεν έχουν επιβεβαιωθεί από τον χρήστη και έχουν
 * είτε σημεία προσοχής, είτε προτεινόμενες ενέργειες, είτε σφάλμα.
 */
export function khmdhsFindingsNeedAttention(findings) {
  if (!findings || findings.acknowledgedAt) return false;
  return (findings.attentionLines?.length || 0) > 0
    || (findings.actions?.length || 0) > 0
    || !!String(findings.error || '').trim();
}

export function countKhmdhsFindingAttentionItems(findings) {
  if (!khmdhsFindingsNeedAttention(findings)) return 0;
  const actions = findings.actions?.length || 0;
  const lines = findings.attentionLines?.length || 0;
  const err = String(findings.error || '').trim() ? 1 : 0;
  return actions + lines + err;
}

export function acknowledgeKhmdhsRefreshFindings(findings, { by = '', at = null } = {}) {
  if (!findings) return null;
  return {
    ...findings,
    acknowledgedAt: at || new Date().toISOString(),
    acknowledgedBy: String(by || ''),
  };
}

export function withAcknowledgedFindings(project, opts = {}) {
  const findings = getKhmdhsRefreshFindings(project);
  if (!findings) return project;
  return { ...project, [KHMDHS_FINDINGS_FIELD]: acknowledgeKhmdhsRefreshFindings(findings, opts) };
}

/**
 * Ενιαία εικόνα «τι χρειάζεται ο χρήστης να δει» για ένα υποέργο — τροφοδοτεί
 * τόσο την κάρτα στο dashboard όσο και το πάνελ μέσα στην επεξεργασία.
 *
 * @returns {{ total: number, reviewCount: number, findingCount: number,
 *   level: 'none'|'attention'|'blocking', reasons: string[] }}
 */
export function getKhmdhsSubprojectAttention(project) {
  const empty = { total: 0, reviewCount: 0, findingCount: 0, level: 'none', reasons: [] };
  if (!project) return empty;

  const review = project.khmdhsDataQualityReview;
  const reviewCount = review?.hasActionRequired
    ? getUnresolvedReviewItems(review, project).length
    : 0;

  const findings = getKhmdhsRefreshFindings(project);
  const findingCount = countKhmdhsFindingAttentionItems(findings);

  const total = reviewCount + findingCount;
  if (!total) return empty;

  const reasons = [];
  if (reviewCount) {
    reasons.push(reviewCount === 1
      ? '1 στοιχείο ΚΗΜΔΗΣ χρειάζεται έλεγχο'
      : `${reviewCount} στοιχεία ΚΗΜΔΗΣ χρειάζονται έλεγχο`);
  }
  (findings?.actions || []).forEach((a) => reasons.push(a.title));
  if (findings?.error) reasons.push(findings.error);
  if (!findings?.actions?.length && !findings?.error && findings?.attentionLines?.length) {
    reasons.push(findings.attentionLines.length === 1
      ? '1 σημείο προς προσοχή από την τελευταία ανανέωση'
      : `${findings.attentionLines.length} σημεία προς προσοχή από την τελευταία ανανέωση`);
  }

  const blocking = reviewCount > 0
    || (findings?.actions || []).some((a) => (
      a.id === KHMDHS_FINDING_ACTION.CHARACTERIZE_SYMV
      || a.id === KHMDHS_FINDING_ACTION.APE_CONFLICT
    ));

  return {
    total,
    reviewCount,
    findingCount,
    level: blocking ? 'blocking' : 'attention',
    reasons,
  };
}

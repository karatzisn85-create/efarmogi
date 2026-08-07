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
    detail: 'Η αλυσίδα έχει περισσότερα από ένα SYMV. Ανοίξτε την κατανομή για να ορίσετε ρόλους. '
      + 'Οι προηγούμενες επιλογές «Δεν καταχωρείται» διατηρούνται για τα ίδια ΑΔΑΜ.',
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

/**
 * Γραμμές τύπου «διατηρήθηκε χειροκίνητη τιμή — δεν απαιτείται ενέργεια».
 * Δεν πρέπει να ξανανοίγουν badge / μαζική αναφορά σε κάθε ανανέωση.
 */
export function isInformationalRefreshAttentionLine(line) {
  const s = String(line || '').trim();
  if (!s) return false;
  if (!s.startsWith('ℹ️')) return false;
  return /Δεν απαιτείται ενέργεια/i.test(s)
    || /σεβάστηκε την προηγούμενη διόρθωσ/i.test(s)
    || /Διατηρήθηκε η χειροκίνητη τιμή/i.test(s);
}

export function getActionableRefreshAttentionLines(lines) {
  return cleanLines(lines).filter((l) => !isInformationalRefreshAttentionLine(l));
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
  const actionableAttention = getActionableRefreshAttentionLines(attention);
  const actionList = (Array.isArray(actions) ? actions : []).filter(Boolean);
  const errorText = String(error || '').trim();

  const worthKeeping = attention.length > 0
    || actionList.length > 0
    || !!errorText
    || applied.length > 0;
  if (!worthKeeping) return null;

  // Μόνο ενημερωτικές ℹ️ γραμμές (π.χ. διαφορά 0,01 € που ήδη σεβαστήκαμε): αποθήκευση
  // για ιστορικό, αλλά αυτόματη επιβεβαίωση — αλλιώς κάθε μαζική ανανέωση ξανανοίγει badge.
  const infoOnly = actionableAttention.length === 0
    && actionList.length === 0
    && !errorText;

  return {
    version: KHMDHS_FINDINGS_VERSION,
    outcome: infoOnly
      ? (KHMDHS_FINDING_OUTCOME.UNCHANGED)
      : (outcome || KHMDHS_FINDING_OUTCOME.ATTENTION),
    source,
    runId: String(runId || ''),
    at: at || new Date().toISOString(),
    by: String(by || ''),
    seedAdam: String(seedAdam || ''),
    appliedLines: applied,
    attentionLines: attention,
    actions: actionList,
    error: errorText,
    acknowledgedAt: infoOnly ? (at || new Date().toISOString()) : null,
    acknowledgedBy: infoOnly ? 'system' : '',
  };
}

export function getKhmdhsRefreshFindings(project) {
  const f = project?.[KHMDHS_FINDINGS_FIELD];
  if (!f || typeof f !== 'object') return null;
  return f;
}

/**
 * Ευρήματα που ζητούν ενέργεια: αγνοούμε ενημερωτικές ℹ️ γραμμές
 * («διατηρήθηκε χειροκίνητη τιμή — δεν απαιτείται ενέργεια»).
 */
export function khmdhsFindingsNeedAttention(findings) {
  if (!findings || findings.acknowledgedAt) return false;
  return getActionableRefreshAttentionLines(findings.attentionLines).length > 0
    || (findings.actions?.length || 0) > 0
    || !!String(findings.error || '').trim();
}

export function countKhmdhsFindingAttentionItems(findings) {
  if (!khmdhsFindingsNeedAttention(findings)) return 0;
  const actions = findings.actions?.length || 0;
  const lines = getActionableRefreshAttentionLines(findings.attentionLines).length;
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
 * Μετά από επίλυση ελέγχου στοιχείων / κατανομής, αφαιρεί από τα ευρήματα
 * ενέργειες που δεν εκκρεμούν πια — ώστε να μην μένουν «νεκρές» επισημάνσεις.
 * Τρέχει και μετά από «Τα είδα», ώστε αν ολοκληρωθεί έλεγχος αργότερα να καθαρίζουν οι ενέργειες.
 */
export function reconcileKhmdhsFindingsWithProjectState(project, { by = '' } = {}) {
  const findings = getKhmdhsRefreshFindings(project);
  if (!findings) return findings;

  const nextActions = (findings.actions || []).filter((action) => {
    if (action.id === KHMDHS_FINDING_ACTION.DATA_REVIEW) {
      return getUnresolvedReviewItems(project.khmdhsDataQualityReview, project).length > 0;
    }
    if (action.id === KHMDHS_FINDING_ACTION.CHARACTERIZE_SYMV) {
      return !project.khmdhsSymvChainPlan?.items?.length;
    }
    if (action.id === KHMDHS_FINDING_ACTION.APE_CONFLICT) {
      return true;
    }
    if (action.id === KHMDHS_FINDING_ACTION.RETRY_FETCH) {
      return !!String(findings.error || '').trim();
    }
    return true;
  });

  if (nextActions.length === (findings.actions || []).length) return findings;

  const next = { ...findings, actions: nextActions };
  const stillNeeds = getActionableRefreshAttentionLines(next.attentionLines).length > 0
    || nextActions.length > 0
    || !!String(next.error || '').trim();
  if (!stillNeeds) {
    return acknowledgeKhmdhsRefreshFindings(next, { by });
  }
  return next;
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
  if (!findings?.actions?.length && !findings?.error) {
    const actionable = getActionableRefreshAttentionLines(findings?.attentionLines);
    if (actionable.length) {
      reasons.push(actionable.length === 1
        ? '1 σημείο προς προσοχή από την τελευταία ανανέωση'
        : `${actionable.length} σημεία προς προσοχή από την τελευταία ανανέωση`);
    }
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

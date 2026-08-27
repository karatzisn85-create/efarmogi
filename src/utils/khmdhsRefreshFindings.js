/**
 * Μόνιμα ευρήματα ανανέωσης ΚΗΜΔΗΣ ανά υποέργο.
 *
 * Η μαζική ανανέωση δεν ανοίγει τα παράθυρα εκκρεμοτήτων που ανοίγει η μεμονωμένη ανάκτηση
 * (έλεγχος στοιχείων, ΑΠΕ, λήξη σύμβασης, μητρώο εγγράφων). Τα ευρήματά της γράφονται εδώ,
 * μέσα στο ίδιο το υποέργο (`khmdhsLastRefreshFindings`), ώστε να επιβιώνουν κλεισίματος της
 * εφαρμογής και να παραμένουν ορατά μέχρι ο χρήστης να τα δει και να ενεργήσει.
 */

import { getUnresolvedReviewItems } from './khmdhsDataQualityReport';
import { resolveStoredApeAmount } from './khmdhsFields';
import { normalizeAmountForCompare } from './projectFormPhases';

export const KHMDHS_FINDINGS_FIELD = 'khmdhsLastRefreshFindings';
export const KHMDHS_FINDINGS_VERSION = 1;

export const KHMDHS_FINDING_OUTCOME = {
  APPLIED: 'applied',
  ATTENTION: 'attention',
  UNCHANGED: 'unchanged',
  INCOMPLETE: 'incomplete',
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

function stripReportLinePrefix(line) {
  return String(line || '').replace(/^[⚠️ℹ️✅➖\s]+/u, '').trim();
}

function normalizeIncompleteKey(line) {
  return stripReportLinePrefix(line).toLowerCase();
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

/**
 * Το ΚΗΜΔΗΣ δεν επιβεβαίωσε κρίκο που ήδη υπάρχει — τίποτα δεν διαγράφηκε.
 * Δεν είναι «χρειάζεται ενέργεια» και δεν είναι πραγματική αλλαγή στην κάρτα.
 */
export function isIncompleteConfirmationLine(line) {
  const s = stripReportLinePrefix(line);
  if (!s) return false;
  if (/ακυρωμέν/i.test(s) && /ματαιώσ/i.test(s)) return false;
  if (/Δεν επιβεβαιώθηκαν όλα/i.test(s)) return true;
  if (/δεν επιβεβαίωσε/i.test(s) && /ήδη/i.test(s)) return true;
  if (/χωρίς λεπτομέρειες/i.test(s) && /προσωρινό πρόβλημα/i.test(s)) return true;
  if (/δεν επιβεβαιώθηκε/i.test(s) && /διατηρήθηκε/i.test(s)) return true;
  if (/Δεν ανακτήθηκαν λεπτομέρειες/i.test(s)) return true;
  if (/Τα υπάρχοντα διατηρούνται|Οι υπάρχουσες διατηρούνται/i.test(s)) return true;
  if (/Δεν διαγράφηκε τίποτα|Δεν αφαιρέθηκε/i.test(s) && /ΚΗΜΔΗΣ/i.test(s)) return true;
  if (/αφαιρέθηκαν ως άσχετα/i.test(s)) return true;
  if (isKhmdhsCountDecreaseLine(s)) return true;
  if (/πλήρης ηλεκτρονική αλυσίδα/i.test(s) && /πρωτογενές αίτημα/i.test(s)) return true;
  if (/ανακτήθηκε μόνο το πρωτογενές αίτημα/i.test(s)) return true;
  if (/δεν βρέθηκε πλήρης/i.test(s) && /αλυσίδ/i.test(s)) return true;
  if (/ανακτήθηκε μόνο η σύμβαση/i.test(s) && /χωρίς ηλεκτρονικ/i.test(s)) return true;
  if (/διαφορετική δημοσίευση/i.test(s) && /διατηρήθηκε/i.test(s)) return true;
  return false;
}

/** Πτώση πλήθους ανάληψεων/ενταλμάτων (π.χ. 3 → 2) — όχι αύξηση που είναι πραγματική αλλαγή. */
function isKhmdhsCountDecreaseLine(s) {
  const text = String(s || '');
  if (!/(ανάληψ|ένταλμ)/i.test(text)) return false;
  const arrow = /από\s+(\d+)\s*→\s*(\d+)/i.exec(text);
  if (arrow) return Number(arrow[1]) > Number(arrow[2]);
  const shown = /εμφανίζονται\s+(\d+)\s+από\s+(\d+)/i.exec(text);
  if (shown) return Number(shown[1]) < Number(shown[2]);
  return false;
}

/** Παλιές γραμμές «ανάληψη 3 → 2» γίνονται κατανοητό κείμενο για τον χρήστη. */
export function clarifyKhmdhsIncompleteLine(line) {
  const s = stripReportLinePrefix(line);
  if (!s) return '';
  if (isKhmdhsCountDecreaseLine(s) && /ανάληψ/i.test(s)) {
    return 'Το ΚΗΜΔΗΣ αυτή τη φορά δεν επιβεβαίωσε όλες τις αποφάσεις ανάληψης που ήδη έχετε στην κάρτα. '
      + 'Δεν διαγράφηκε τίποτα — παραμένουν όπως ήταν. Ξαναδοκιμάστε όταν η υπηρεσία ανταποκρίνεται κανονικά.';
  }
  if (/αφαιρέθηκαν ως άσχετα/i.test(s)
    || (isKhmdhsCountDecreaseLine(s) && /ένταλμ/i.test(s))) {
    return 'Το ΚΗΜΔΗΣ αυτή τη φορά δεν επιβεβαίωσε όλα τα εντάλματα πληρωμής που ήδη έχετε στην κάρτα. '
      + 'Δεν διαγράφηκε τίποτα — παραμένουν όπως ήταν. Ξαναδοκιμάστε όταν η υπηρεσία ανταποκρίνεται κανονικά.';
  }
  if ((/πλήρης ηλεκτρονική αλυσίδα/i.test(s) && /πρωτογενές αίτημα/i.test(s))
    || /ανακτήθηκε μόνο το πρωτογενές αίτημα/i.test(s)
    || (/δεν βρέθηκε πλήρης/i.test(s) && /αλυσίδ/i.test(s))) {
    return 'Η ανάκτηση δεν ολοκληρώθηκε πλήρως — το ΚΗΜΔΗΣ επέστρεψε μόνο το πρωτογενές αίτημα, '
      + 'χωρίς δημοσίευση, ανάθεση ή σύμβαση. Η κάρτα έμεινε όπως ήταν· δεν διαγράφηκε τίποτα. '
      + 'Ξαναδοκιμάστε όταν η υπηρεσία ανταποκρίνεται κανονικά.';
  }
  if (/ανακτήθηκε μόνο η σύμβαση/i.test(s) && /χωρίς ηλεκτρονικ/i.test(s)) {
    return 'Η ανάκτηση δεν ολοκληρώθηκε πλήρως — το ΚΗΜΔΗΣ επέστρεψε μόνο τη σύμβαση, '
      + 'χωρίς συνδεδεμένο αίτημα, δημοσίευση ή ανάθεση. Η κάρτα έμεινε όπως ήταν· δεν διαγράφηκε τίποτα. '
      + 'Ξαναδοκιμάστε όταν η υπηρεσία ανταποκρίνεται κανονικά.';
  }
  if (/διαφορετική δημοσίευση/i.test(s) && /διατηρήθηκε/i.test(s)) {
    return 'Το ΚΗΜΔΗΣ έδειξε διαφορετική δημοσίευση από την ήδη καταγεγραμμένη. '
      + 'Διατηρήθηκε η κύρια στην κάρτα — δεν διαγράφηκε τίποτα. '
      + 'Τυχόν επιπλέον πράξη φαίνεται στα Αρχεία Υποέργου.';
  }
  return s;
}

function uniqueIncompleteLines(lines) {
  const out = [];
  const seen = new Set();
  cleanLines(lines).forEach((line) => {
    const clarified = clarifyKhmdhsIncompleteLine(line);
    if (!clarified) return;
    const key = normalizeIncompleteKey(clarified);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(clarified);
  });
  return out;
}

/**
 * Χωρίζει γραμμές αναφοράς σε αλλαγές / ανεπιβεβαίωση ΚΗΜΔΗΣ / πραγματική προσοχή.
 * Διαβάζει και παλιές αναφορές που είχαν το «3 → 2» μέσα στις αλλαγές.
 */
export function splitRefreshReportLineBuckets(item = {}) {
  const appliedRaw = cleanLines(
    item.appliedLines
    || (item.category === 'applied' ? item.changeLines : [])
  );
  const attentionRaw = cleanLines(
    item.attentionLines
    || (item.category === 'attention' ? item.changeLines : [])
  );
  const storedIncomplete = cleanLines(item.incompleteLines);

  const appliedLines = [];
  const attentionLines = [];
  const extractedIncomplete = [];

  appliedRaw.forEach((line) => {
    if (isIncompleteConfirmationLine(line)) extractedIncomplete.push(line);
    else appliedLines.push(line);
  });
  attentionRaw.forEach((line) => {
    if (isIncompleteConfirmationLine(line)) extractedIncomplete.push(line);
    else attentionLines.push(line);
  });

  return {
    appliedLines,
    attentionLines,
    incompleteLines: uniqueIncompleteLines([...storedIncomplete, ...extractedIncomplete]),
  };
}

/** Ετικέτα ομάδας ανεπιβεβαίωσης: μην λέμε «η κάρτα έμεινε» αν μπήκαν και νέα στοιχεία. */
export function describeKhmdhsIncompleteGroupLabel(hasAppliedChanges) {
  return hasAppliedChanges
    ? 'Δεν επιβεβαιώθηκαν όλοι οι παλιοί κρίκοι — δεν διαγράφηκε τίποτα'
    : 'Η κάρτα έμεινε όπως ήταν — δεν επιβεβαιώθηκαν όλα';
}

export function getActionableRefreshAttentionLines(lines) {
  return cleanLines(lines).filter((l) => (
    !isInformationalRefreshAttentionLine(l)
    && !isIncompleteConfirmationLine(l)
  ));
}

export function buildKhmdhsFindingAction(id, overrides = {}) {
  const preset = ACTION_PRESETS[id] || {};
  const action = {
    id,
    icon: overrides.icon || preset.icon || '⚠️',
    title: overrides.title || preset.title || 'Χρειάζεται ενέργεια',
    detail: overrides.detail || preset.detail || '',
  };
  if (overrides.suggested) action.suggested = String(overrides.suggested);
  if (overrides.current) action.current = String(overrides.current);
  if (overrides.contractIndex != null) action.contractIndex = overrides.contractIndex;
  return action;
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
  incompleteLines = [],
  actions = [],
  error = '',
} = {}) {
  const buckets = splitRefreshReportLineBuckets({
    appliedLines,
    attentionLines,
    incompleteLines,
  });
  const applied = buckets.appliedLines;
  const attention = buckets.attentionLines;
  const incomplete = buckets.incompleteLines;
  const actionableAttention = getActionableRefreshAttentionLines(attention);
  const actionList = (Array.isArray(actions) ? actions : []).filter(Boolean);
  const errorText = String(error || '').trim();

  const worthKeeping = attention.length > 0
    || incomplete.length > 0
    || actionList.length > 0
    || !!errorText
    || applied.length > 0;
  if (!worthKeeping) return null;

  // Μόνο ενημερωτικές ℹ️ γραμμές (π.χ. διαφορά 0,01 € που ήδη σεβαστήκαμε): αποθήκευση
  // για ιστορικό, αλλά αυτόματη επιβεβαίωση — αλλιώς κάθε μαζική ανανέωση ξανανοίγει badge.
  const infoOnly = actionableAttention.length === 0
    && incomplete.length === 0
    && actionList.length === 0
    && !errorText;

  let resolvedOutcome = infoOnly
    ? KHMDHS_FINDING_OUTCOME.UNCHANGED
    : (outcome || KHMDHS_FINDING_OUTCOME.ATTENTION);
  if (
    !infoOnly
    && incomplete.length > 0
    && !applied.length
    && !actionableAttention.length
    && !actionList.length
    && !errorText
  ) {
    resolvedOutcome = KHMDHS_FINDING_OUTCOME.INCOMPLETE;
  }

  return {
    version: KHMDHS_FINDINGS_VERSION,
    outcome: resolvedOutcome,
    source,
    runId: String(runId || ''),
    at: at || new Date().toISOString(),
    by: String(by || ''),
    seedAdam: String(seedAdam || ''),
    appliedLines: applied,
    attentionLines: attention,
    incompleteLines: incomplete,
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

function projectApeMatchesSuggested(project, suggested) {
  const want = normalizeAmountForCompare(suggested);
  if (!want) return false;
  const amounts = [
    project?.apeAmount,
    resolveStoredApeAmount(project, 0),
    ...(Array.isArray(project?.contracts)
      ? project.contracts.map((_, i) => resolveStoredApeAmount(project, i))
      : []),
  ];
  return amounts.some((v) => v && normalizeAmountForCompare(v) === want);
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
      if (action.suggested && projectApeMatchesSuggested(project, action.suggested)) {
        return false;
      }
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
 * Αφαιρεί μία ενέργεια ευρημάτων (π.χ. ΑΠΕ μετά «κρατάω το τρέχον» ή αποδοχή).
 * Αν δεν μένει τίποτα προς ενέργεια, κλείνει και τα ευρήματα.
 */
export function dropKhmdhsFindingAction(project, actionId, { by = '' } = {}) {
  const findings = getKhmdhsRefreshFindings(project);
  if (!findings) return project;
  const prevActions = findings.actions || [];
  const hadAction = prevActions.some((a) => a.id === actionId);
  const nextActions = prevActions.filter((a) => a.id !== actionId);
  let nextLines = Array.isArray(findings.attentionLines) ? findings.attentionLines : [];
  if (actionId === KHMDHS_FINDING_ACTION.APE_CONFLICT) {
    nextLines = nextLines.filter((l) => !/ΑΠΕ/.test(String(l || '')));
  }
  if (!hadAction && nextLines.length === (findings.attentionLines || []).length) {
    return project;
  }
  let next = { ...findings, actions: nextActions, attentionLines: nextLines };
  const stillNeeds = getActionableRefreshAttentionLines(next.attentionLines).length > 0
    || nextActions.length > 0
    || !!String(next.error || '').trim();
  if (!stillNeeds) {
    next = acknowledgeKhmdhsRefreshFindings(next, { by });
  }
  return { ...project, [KHMDHS_FINDINGS_FIELD]: next };
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

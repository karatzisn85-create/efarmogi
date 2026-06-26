/**
 * Χαρακτηρισμός πράξεων αλυσίδας σύμβασης ΚΗΜΔΗΣ.
 *
 * ΦΙΛΟΣΟΦΙΑ: Η εφαρμογή ΔΕΝ αποφασίζει σιωπηλά. Καταγράφει πιστά τα δεδομένα και
 * ΠΡΟΤΕΙΝΕΙ χαρακτηρισμό με βαθμό βεβαιότητας. Όταν δεν είναι σίγουρη, αφήνει την
 * πράξη ως «uncertain» (Χρειάζεται έλεγχος) και περιμένει την επιλογή του χρήστη.
 *
 * Είδη: contract (αρχική) | modification (τροποποίηση) | extension (παράταση)
 *       | republication (ορθή επανάληψη) | other (άλλο) | uncertain (αδιευκρίνιστο)
 */

const CHAIN_KIND = {
  CONTRACT: 'contract',
  MODIFICATION: 'modification',
  EXTENSION: 'extension',
  REPUBLICATION: 'republication',
  OTHER: 'other',
  UNCERTAIN: 'uncertain',
};

const CONFIDENCE = {
  HIGH: 'high',
  LOW: 'low',
  NONE: 'none',
};

/** Επιλογές που μπορεί να δώσει ο χρήστης για μη-αρχικές πράξεις */
const USER_CHAIN_KIND_OPTIONS = [
  CHAIN_KIND.MODIFICATION,
  CHAIN_KIND.EXTENSION,
  CHAIN_KIND.REPUBLICATION,
  CHAIN_KIND.OTHER,
];

function kindLabelEl(kind) {
  switch (kind) {
    case CHAIN_KIND.CONTRACT: return 'αρχική σύμβαση';
    case CHAIN_KIND.MODIFICATION: return 'τροποποίηση';
    case CHAIN_KIND.EXTENSION: return 'παράταση';
    case CHAIN_KIND.REPUBLICATION: return 'ορθή επανάληψη';
    case CHAIN_KIND.OTHER: return 'άλλο';
    case CHAIN_KIND.UNCERTAIN: return 'αδιευκρίνιστο';
    default: return 'σχετική πράξη';
  }
}

function classifyLinkKindFromParent(parentRecord) {
  if (!parentRecord) return 'amendment';
  if (parentRecord.nextExtended) return CHAIN_KIND.EXTENSION;
  if (parentRecord.nextModified) return CHAIN_KIND.MODIFICATION;
  return 'amendment';
}

function parseDateMs(value) {
  if (value == null || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function hasFiniteAmount(record) {
  if (!record) return false;
  const budget = record.contractBudget;
  return budget != null && budget !== '' && Number.isFinite(Number(budget));
}

function normalizeTitleText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function sameCalendarDate(a, b) {
  const ma = parseDateMs(a);
  const mb = parseDateMs(b);
  if (ma == null || mb == null) return false;
  const da = new Date(ma);
  const db = new Date(mb);
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate();
}

const RE_REPUBLICATION = /ορθή\s+επανάληψη|ορθη\s+επαναληψη|διορθωτικ\s*ανάρτη|διορθωτικ\s*αναρτη|επανάληψη\s+ανάρτη|επαναληψη\s+αναρτη|ορθή\s+επαν\.|ορθη\s+επαν\./i;
const RE_EXTENSION = /παράτασ|παρατασ|προθεσμ|χρόνου\s+εργασι|χρονικ\s+παρ|χρονοδιάγραμ|deadline/i;
const RE_FINANCIAL_MOD = /τροποποι|αύξησ|αυξησ|μείωσ|μειωσ|οικονομικ|προσαύξ|προσαυξ|συμπληρωματικ|αναθεώρησ\s+τιμ/i;
const RE_EXPLICIT_FINANCIAL = /τροποποι.*(αξ|ποσ|σύμβασ|συμβασ)|αύξησ.*(αξ|ποσ)|αυξησ.*(αξ|ποσ)|μείωσ.*(αξ|ποσ)|μειωσ.*(αξ|ποσ)/i;

/**
 * Ανίχνευση ορθής επανάληψης / διορθωτικής ανάρτησης.
 * @returns {{confidence:string, signals:string[]}|null}
 */
function detectCorrectiveRepublication(parentRecord, childRecord) {
  if (!parentRecord || !childRecord) return null;

  const title = String(childRecord.title || '').toLowerCase();
  const signals = [];

  if (RE_REPUBLICATION.test(title)) {
    signals.push('Ο τίτλος αναφέρει ρητά «ορθή επανάληψη»');
    return { confidence: CONFIDENCE.HIGH, signals };
  }

  const parentTitle = normalizeTitleText(parentRecord.title);
  const childTitle = normalizeTitleText(childRecord.title);
  const titleChanged = !!(parentTitle && childTitle && parentTitle !== childTitle);
  const sameSigned = sameCalendarDate(childRecord.contractSignedDate, parentRecord.contractSignedDate)
    || sameCalendarDate(childRecord.startDate, parentRecord.startDate);
  const sameEnd = sameCalendarDate(childRecord.endDate, parentRecord.endDate)
    || (!childRecord.endDate && !parentRecord.endDate);
  const noNewAmount = !hasFiniteAmount(childRecord);
  const noAmendmentKeywords = !RE_EXTENSION.test(title) && !RE_FINANCIAL_MOD.test(title);

  if (titleChanged && sameSigned && sameEnd && noNewAmount && noAmendmentKeywords) {
    signals.push('Ίδια ημ/νία υπογραφής και λήξης με την προηγούμενη πράξη');
    signals.push('Διαφορετικός τίτλος χωρίς νέο ποσό — πιθανή διορθωτική ανάρτηση');
    return { confidence: CONFIDENCE.LOW, signals };
  }

  return null;
}

/** Ενδείξεις από τίτλο/ποσό/ημερομηνίες της ίδιας της πράξης */
function gatherChildSignals(childRecord, parentRecord) {
  const title = String(childRecord?.title || '').toLowerCase();
  const signals = [];
  let extensionScore = 0;
  let modificationScore = 0;

  const parentSaysExtension = !!parentRecord?.nextExtended;
  const childHasAmount = hasFiniteAmount(childRecord);

  if (RE_EXTENSION.test(title)) {
    extensionScore += 2;
    signals.push('Ο τίτλος δείχνει παράταση/προθεσμία');
  }
  if (RE_FINANCIAL_MOD.test(title)) {
    modificationScore += 2;
    signals.push('Ο τίτλος δείχνει οικονομική τροποποίηση');
  }

  if (childHasAmount) {
    if (parentSaysExtension) {
      signals.push('Υπάρχει ποσό, αλλά το ΚΗΜΔΗΣ τη συνδέει ως παράταση');
    } else {
      modificationScore += 3;
      signals.push('Υπάρχει ποσό σύμβασης στο ΚΗΜΔΗΣ');
    }
  } else if (!childHasAmount && !RE_FINANCIAL_MOD.test(title)) {
    extensionScore += 2;
    signals.push('Χωρίς νέο ποσό σύμβασης στο ΚΗΜΔΗΣ');
    if (parentSaysExtension) extensionScore += 1;
  }

  const childStart = parseDateMs(childRecord?.startDate || childRecord?.contractSignedDate);
  const parentStart = parentRecord
    ? parseDateMs(parentRecord?.startDate || parentRecord?.contractSignedDate)
    : null;
  const MS_DAY = 86400000;
  if (childStart != null && parentStart != null && childStart > parentStart + 30 * MS_DAY) {
    extensionScore += 2;
    signals.push('Νέα ημερομηνία έναρξης μετά την αρχική σύμβαση');
  }

  const childEnd = parseDateMs(childRecord?.endDate);
  const parentEnd = parentRecord ? parseDateMs(parentRecord.endDate) : null;
  if (childEnd != null && parentEnd != null && childEnd !== parentEnd) {
    if (childEnd > parentEnd) {
      extensionScore += 2;
      signals.push('Επέκταση ημερομηνίας λήξης');
    } else {
      signals.push('Αλλαγή (μείωση) ημερομηνίας λήξης');
    }
  }

  if (parentSaysExtension) {
    extensionScore += 1;
    signals.push('Το ΚΗΜΔΗΣ τη συνδέει ως παράταση (nextExtended)');
  }
  if (parentRecord?.nextModified) {
    modificationScore += 1;
    signals.push('Το ΚΗΜΔΗΣ τη συνδέει ως τροποποίηση (nextModified)');
  }

  return { extensionScore, modificationScore, signals };
}

/**
 * Προτείνει χαρακτηρισμό για μια πράξη της αλυσίδας — χωρίς να αποφασίζει οριστικά.
 * @returns {{
 *   suggestedKind: string|null, confidence: string, khmdhsLinkKind: string,
 *   kind: string, needsReview: boolean, kindConflict: boolean,
 *   kindReclassified: boolean, kindNote: string, kindSignals: string[]
 * }}
 */
function resolveChainNodeKind(parentRecord, childRecord) {
  const khmdhsLinkKind = classifyLinkKindFromParent(parentRecord);

  // 1) Ορθή επανάληψη
  const republication = detectCorrectiveRepublication(parentRecord, childRecord);
  if (republication) {
    const khmdhsSaysAmendment = khmdhsLinkKind === CHAIN_KIND.MODIFICATION
      || khmdhsLinkKind === CHAIN_KIND.EXTENSION;
    return {
      suggestedKind: CHAIN_KIND.REPUBLICATION,
      confidence: republication.confidence,
      khmdhsLinkKind,
      kind: CHAIN_KIND.REPUBLICATION,
      needsReview: true,
      kindConflict: false,
      kindReclassified: khmdhsSaysAmendment,
      kindNote: khmdhsSaysAmendment
        ? `Το ΚΗΜΔΗΣ τη συνδέει ως «${kindLabelEl(khmdhsLinkKind)}», αλλά τα στοιχεία δείχνουν ορθή επανάληψη της ίδιας σύμβασης.`
        : 'Πιθανή ορθή επανάληψη/διορθωτική ανάρτηση.',
      kindSignals: republication.signals,
    };
  }

  // 2) Ενδείξεις από την πράξη
  const { extensionScore, modificationScore, signals } = gatherChildSignals(childRecord, parentRecord);
  const title = String(childRecord?.title || '').toLowerCase();
  const explicitFinancial = RE_EXPLICIT_FINANCIAL.test(title);

  let suggestedKind = null;
  let confidence = CONFIDENCE.NONE;

  const khmdhsIsAmendmentKind = khmdhsLinkKind === CHAIN_KIND.EXTENSION
    || khmdhsLinkKind === CHAIN_KIND.MODIFICATION;

  if (extensionScore > modificationScore + 1) {
    suggestedKind = CHAIN_KIND.EXTENSION;
    confidence = (khmdhsLinkKind === CHAIN_KIND.EXTENSION) ? CONFIDENCE.HIGH : CONFIDENCE.LOW;
  } else if (modificationScore > extensionScore + 1) {
    suggestedKind = CHAIN_KIND.MODIFICATION;
    confidence = (khmdhsLinkKind === CHAIN_KIND.MODIFICATION || explicitFinancial)
      ? CONFIDENCE.HIGH : CONFIDENCE.LOW;
  } else if (!hasFiniteAmount(childRecord) && !RE_FINANCIAL_MOD.test(title)
    && extensionScore >= modificationScore) {
  // Χωρίς ποσό: συχνά παράταση χρόνου ακόμα κι αν το ΚΗΜΔΗΣ λέει «τροποποίηση»
    suggestedKind = CHAIN_KIND.EXTENSION;
    confidence = khmdhsLinkKind === CHAIN_KIND.EXTENSION ? CONFIDENCE.HIGH : CONFIDENCE.LOW;
  } else if (khmdhsIsAmendmentKind) {
    suggestedKind = khmdhsLinkKind;
    confidence = CONFIDENCE.LOW;
  }

  // 3) Σύγκρουση ΚΗΜΔΗΣ vs ενδείξεων → αδιευκρίνιστο, εκτός αν πρόκειται για πιθανή παράταση χωρίς ποσό
  const likelyTimeExtension = suggestedKind === CHAIN_KIND.EXTENSION
    && !hasFiniteAmount(childRecord)
    && !RE_FINANCIAL_MOD.test(title)
    && extensionScore > modificationScore;

  const conflict = khmdhsIsAmendmentKind
    && suggestedKind != null
    && suggestedKind !== khmdhsLinkKind
    && confidence !== CONFIDENCE.HIGH
    && !likelyTimeExtension;

  if (conflict) {
    return {
      suggestedKind: null,
      confidence: CONFIDENCE.NONE,
      khmdhsLinkKind,
      kind: CHAIN_KIND.UNCERTAIN,
      needsReview: true,
      kindConflict: true,
      kindReclassified: false,
      kindNote: `Ασυμφωνία: το ΚΗΜΔΗΣ λέει «${kindLabelEl(khmdhsLinkKind)}», οι ενδείξεις δείχνουν «${kindLabelEl(suggestedKind)}». Χρειάζεται έλεγχος.`,
      kindSignals: signals,
    };
  }

  if (suggestedKind == null) {
    return {
      suggestedKind: null,
      confidence: CONFIDENCE.NONE,
      khmdhsLinkKind,
      kind: CHAIN_KIND.UNCERTAIN,
      needsReview: true,
      kindConflict: false,
      kindReclassified: false,
      kindNote: 'Δεν προέκυψε ασφαλής χαρακτηρισμός από τα στοιχεία. Χρειάζεται έλεγχος.',
      kindSignals: signals,
    };
  }

  return {
    suggestedKind,
    confidence,
    khmdhsLinkKind,
    kind: suggestedKind,
    needsReview: confidence !== CONFIDENCE.HIGH,
    kindConflict: false,
    kindReclassified: khmdhsIsAmendmentKind && suggestedKind !== khmdhsLinkKind,
    kindNote: (khmdhsIsAmendmentKind && suggestedKind === CHAIN_KIND.EXTENSION && khmdhsLinkKind === CHAIN_KIND.MODIFICATION)
      ? 'Το ΚΗΜΔΗΣ τη συνδέει ως τροποποίηση, αλλά χωρίς νέο ποσό πιθανότατα πρόκειται για παράταση χρόνου — επιβεβαιώστε από το PDF.'
      : '',
    kindSignals: signals,
  };
}

/**
 * Συμπληρωματική σύμβαση = οικονομική τροποποίηση (όχι καθαρή παράταση χωρίς ποσό, όχι ορθή επανάληψη).
 * Λαμβάνει υπόψη την επιλογή του χρήστη (effectiveKind) όταν υπάρχει.
 */

function hasFinancialSupplementarySignals(h) {
  const title = String(h.snapshot?.title || h.title || h.label || '').toLowerCase();
  const hasAmount = !!(h.contractAmount && String(h.contractAmount).trim())
    || hasFiniteAmount(h.snapshot);
  if (hasAmount) return true;
  return RE_FINANCIAL_MOD.test(title);
}

/** Παράταση μόνο (χωρίς οικονομική αλλαγή) — δεν είναι συμπληρωματική σύμβαση */
function isPureExtensionOnly(h) {
  const kind = h.effectiveKind || h.userKind || h.kind;
  const link = h.khmdhsLinkKind;
  if (kind === CHAIN_KIND.REPUBLICATION) return false;
  if (hasFinancialSupplementarySignals(h)) return false;
  if (kind === CHAIN_KIND.EXTENSION) return true;
  if (link === CHAIN_KIND.EXTENSION && h.suggestedKind !== CHAIN_KIND.MODIFICATION) return true;
  return false;
}

/** Πρώτα χαρακτηρισμός — όχι απαίτηση ποσού όταν δεν υπάρχουν οικονομικές ενδείξεις */
function needsAmendmentKindReviewBeforeAmount(h) {
  if (!h || h.isRoot) return false;
  const kind = h.effectiveKind || h.userKind || h.kind;
  if (kind === CHAIN_KIND.EXTENSION || kind === CHAIN_KIND.REPUBLICATION) return false;
  if (hasFinancialSupplementarySignals(h)) return false;
  if (h.needsReview || h.confidence !== CONFIDENCE.HIGH) return true;
  if (kind === CHAIN_KIND.UNCERTAIN || kind === CHAIN_KIND.OTHER) return true;
  if (h.suggestedKind === CHAIN_KIND.EXTENSION) return true;
  return false;
}

/**
 * Κάθε μη-αρχική πράξη που είναι επιβεβαιωμένη οικονομική τροποποίηση — όχι παράταση/ορθή επανάληψη.
 */
function isChainSupplementaryCandidate(h) {
  if (!h?.adam || h.isRoot) return false;
  const kind = h.effectiveKind || h.userKind || h.kind;
  if (kind === CHAIN_KIND.REPUBLICATION) return false;
  if (isPureExtensionOnly(h)) return false;
  if (needsAmendmentKindReviewBeforeAmount(h)) return false;
  if (kind === CHAIN_KIND.MODIFICATION) return true;
  if (h.suggestedKind === CHAIN_KIND.MODIFICATION && h.confidence === CONFIDENCE.HIGH) return true;
  if (hasFinancialSupplementarySignals(h)) return true;
  return false;
}

function isSupplementaryModificationEntry(h) {
  return isChainSupplementaryCandidate(h);
}

module.exports = {
  CHAIN_KIND,
  CONFIDENCE,
  USER_CHAIN_KIND_OPTIONS,
  classifyLinkKindFromParent,
  detectCorrectiveRepublication,
  resolveChainNodeKind,
  isSupplementaryModificationEntry,
  isChainSupplementaryCandidate,
  isPureExtensionOnly,
  kindLabelEl,
};

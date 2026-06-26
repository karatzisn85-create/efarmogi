/**
 * Κανόνες δράσης χαρακτηρισμού αλυσίδας ΚΗΜΔΗΣ (renderer).
 *
 * Ο χρήστης δίνει τον χαρακτηρισμό κάθε πράξης· εδώ ορίζεται ΤΙ ΚΑΝΕΙ η εφαρμογή
 * με τα στοιχεία του εγγράφου ανάλογα με τον χαρακτηρισμό:
 *
 *  - contract (αρχική)      → βάση: ποσό + ημ/νία + λήξη σύμβασης
 *  - republication (ορθή)   → ΑΝΤΙΚΑΘΙΣΤΑ στοιχεία της πράξης που διορθώνει (δεν προστίθεται)
 *  - extension (παράταση)   → ενημερώνει ΜΟΝΟ τη λήξη/προθεσμία (όχι ποσό)
 *  - modification (τροπ/ση) → νέα συμπληρωματική γραμμή· ποσό = διαφορά ή νέα συνολική αξία
 *  - other / uncertain      → καμία αυτόματη επίπτωση
 */

import { parseGreekAmountString } from './khmdhsFields';
import { resolveReviewItem, reconcileReviewState, KHMDHS_RESOLUTION_SOURCE, chainKindReviewResolutionKey, normalizeKhmdhsAdam } from './khmdhsDataQualityReport';
import { resolveModificationSupplementaryAmount } from './khmdhsSupplementaryAmountLogic';
import { getChainHistoryForContract } from './khmdhsChainFormAccess';

export const CHAIN_KIND = {
  CONTRACT: 'contract',
  MODIFICATION: 'modification',
  EXTENSION: 'extension',
  REPUBLICATION: 'republication',
  OTHER: 'other',
  UNCERTAIN: 'uncertain',
};

export const CHAIN_KIND_LABEL = {
  contract: 'Αρχική σύμβαση',
  modification: 'Συμπληρωματική σύμβαση',
  extension: 'Παράταση',
  republication: 'Ορθή επανάληψη',
  other: 'Άλλο',
  uncertain: 'Χρειάζεται έλεγχος',
};

export const MOD_AMOUNT_TYPE = {
  DELTA: 'delta',
  TOTAL: 'total',
};

export const CORRECTS_PART = {
  TITLE: 'title',
  AMOUNT: 'amount',
  DATE: 'date',
};

function chainKindKey(adam) {
  return chainKindReviewResolutionKey(adam);
}

function formatAmountString(n) {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return Number(n).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Διαβάζει την αποθηκευμένη επιλογή χαρακτηρισμού για μια πράξη */
export function getChainKindChoice(review, adam) {
  const res = review?.resolutions?.[chainKindKey(adam)];
  if (!res) return null;
  const meta = res.meta || {};
  return {
    kind: res.value || null,
    correctsAdam: meta.correctsAdam || null,
    correctsParts: Array.isArray(meta.correctsParts) ? meta.correctsParts : [],
    modAmountType: meta.modAmountType || null,
    modAmount: meta.modAmount || '',
    modDate: meta.modDate || '',
    endDate: meta.endDate || '',
    resolvedBy: res.resolvedBy || '',
    note: res.note || '',
  };
}

/** Ο ισχύων χαρακτηρισμός: επιλογή χρήστη → υψηλή πρόταση → αλλιώς «χρειάζεται έλεγχος» */
export function getEffectiveChainKind(h, review) {
  if (!h) return CHAIN_KIND.UNCERTAIN;
  if (h.isRoot) return CHAIN_KIND.CONTRACT;
  const choice = getChainKindChoice(review, h.adam);
  if (choice?.kind) return choice.kind;
  // Συμβατότητα παλιών υποέργων (πριν τον μηχανισμό χαρακτηρισμού)
  if (h.suggestedKind === undefined && h.confidence === undefined
    && h.kind && h.kind !== CHAIN_KIND.UNCERTAIN) {
    return h.kind;
  }
  return CHAIN_KIND.UNCERTAIN;
}

/** Αποθηκεύει την επιλογή του χρήστη (χαρακτηρισμός + υπο-επιλογές) στη μνήμη ελέγχου */
export function resolveChainKindChoice(review, item, formData, {
  kind,
  correctsAdam = null,
  correctsParts = [],
  modAmountType = null,
  modAmount = '',
  modDate = '',
  endDate = '',
  resolvedBy = '',
  note = '',
} = {}) {
  if (!review || !item || !kind) return review;
  const meta = {
    correctsAdam, correctsParts, modAmountType, modAmount, modDate, endDate,
  };
  let next = resolveReviewItem(review, item, {
    value: kind,
    source: KHMDHS_RESOLUTION_SOURCE.USER_CONFIRMED,
    resolvedBy,
    note,
    meta,
  });
  if (formData) next = reconcileReviewState(next, formData);
  return next;
}

/**
 * Υπολογίζει τα παράγωγα πεδία του υποέργου με βάση τους χαρακτηρισμούς του χρήστη.
 * @returns {{
 *   contractAmount: string, contractDate: string, contractDeadline: string,
 *   supplementaryContracts: Array, perAct: Array, hasUncertain: boolean
 * }}
 */
export function computeChainCharacterizationEffects(chainHistory, review) {
  const list = Array.isArray(chainHistory) ? [...chainHistory] : [];
  list.sort((a, b) => (a.order || 0) - (b.order || 0));

  const root = list.find((h) => h.isRoot) || list[0] || null;

  let baseAmount = root ? parseGreekAmountString(root.contractAmount) : 0;
  let contractDate = root ? (root.contractDate || '') : '';
  let contractDeadline = root ? (root.endDate || '') : '';

  // Πάσο 1: συγκέντρωσε τις ορθές επαναλήψεις (διορθώσεις) ανά πράξη-στόχο
  const corrections = new Map(); // targetAdam → { title, amount, date, end }
  list.forEach((h) => {
    if (h.isRoot) return;
    if (getEffectiveChainKind(h, review) !== CHAIN_KIND.REPUBLICATION) return;
    const choice = getChainKindChoice(review, h.adam);
    const target = choice?.correctsAdam || h.prevAdam || (root ? root.adam : null);
    if (!target) return;
    const parts = choice?.correctsParts?.length ? choice.correctsParts : [];
    const entry = corrections.get(target) || {};
    if (parts.includes(CORRECTS_PART.AMOUNT) || (!parts.length && h.contractAmount)) {
      const amt = parseGreekAmountString(h.contractAmount);
      if (amt) entry.amount = amt;
    }
    if (parts.includes(CORRECTS_PART.DATE) || (!parts.length && (h.contractDate || h.endDate))) {
      if (h.contractDate) entry.date = h.contractDate;
      if (h.endDate) entry.end = h.endDate;
    }
    if (parts.includes(CORRECTS_PART.TITLE) || !parts.length) {
      entry.title = h.title || (h.snapshot && h.snapshot.title) || entry.title;
    }
    corrections.set(target, entry);
  });

  // Εφαρμογή διορθώσεων στη ρίζα (αρχική σύμβαση)
  let correctedAmount = false;
  let correctedDate = false;
  if (root && corrections.has(root.adam)) {
    const c = corrections.get(root.adam);
    if (c.amount != null) { baseAmount = c.amount; correctedAmount = true; }
    if (c.date) { contractDate = c.date; correctedDate = true; }
    if (c.end) contractDeadline = c.end;
  }

  // Πάσο 2: πέρασμα κατά σειρά για συμπληρωματικές & παρατάσεις
  const supplementaryContracts = [];
  const perAct = [];
  let runningTotal = baseAmount;
  let hasUncertain = false;

  list.forEach((h) => {
    const kind = getEffectiveChainKind(h, review);
    if (h.isRoot) {
      perAct.push({ adam: h.adam, kind: CHAIN_KIND.CONTRACT, effect: 'base' });
      return;
    }
    const choice = getChainKindChoice(review, h.adam);

    if (kind === CHAIN_KIND.EXTENSION) {
      const endIso = (choice?.endDate || h.endDate || '').slice(0, 10);
      if (endIso && (!contractDeadline || endIso > String(contractDeadline).slice(0, 10))) {
        contractDeadline = endIso;
      }
      perAct.push({ adam: h.adam, kind, effect: 'deadline', endDate: endIso });
      return;
    }

    if (kind === CHAIN_KIND.MODIFICATION) {
      const resolved = resolveModificationSupplementaryAmount(h, choice, runningTotal, corrections);
      const delta = resolved.delta;
      let comment = [CHAIN_KIND_LABEL.modification, h.adam].filter(Boolean).join(' · ');
      if (resolved.commentSuffix) comment += resolved.commentSuffix;
      runningTotal += delta;
      supplementaryContracts.push({
        date: choice?.modDate || h.contractDate || '',
        amount: delta ? formatAmountString(delta) : '',
        comments: comment,
        khmdhsAdam: h.adam,
        khmdhsDerived: true,
        chainKind: kind,
        amountType: resolved.amountType,
      });
      perAct.push({ adam: h.adam, kind, effect: 'supplementary', delta });
      return;
    }

    if (kind === CHAIN_KIND.REPUBLICATION) {
      perAct.push({ adam: h.adam, kind, effect: 'correction' });
      return;
    }

    if (kind === CHAIN_KIND.UNCERTAIN) hasUncertain = true;
    perAct.push({ adam: h.adam, kind, effect: 'none' });
  });

  return {
    contractAmount: baseAmount ? formatAmountString(baseAmount) : (root?.contractAmount || ''),
    contractDate,
    contractDeadline,
    correctedAmount,
    correctedDate,
    supplementaryContracts,
    perAct,
    hasUncertain,
  };
}

/** Εφαρμόζει αποθηκευμένους χαρακτηρισμούς χρήστη σε μία εγγραφή ιστορικού αλυσίδας. */
export function enrichChainHistoryEntryWithReview(h, review) {
  if (!h?.adam) return h;

  const effectiveKind = getEffectiveChainKind(h, review);
  const choice = getChainKindChoice(review, h.adam);
  const hasUserChoice = !!choice?.kind;

  if (h.isRoot) {
    return {
      ...h,
      effectiveKind: CHAIN_KIND.CONTRACT,
      label: h.label || CHAIN_KIND_LABEL.contract,
    };
  }

  if (!hasUserChoice) return h;

  const genericOtherLabel = CHAIN_KIND_LABEL[CHAIN_KIND.OTHER];
  const storedLabel = String(h.label || '').trim();
  const label = (effectiveKind === CHAIN_KIND.OTHER && storedLabel
    && storedLabel !== genericOtherLabel
    && storedLabel !== 'Ενδιάμεσος κρίκος')
    ? storedLabel
    : (storedLabel && storedLabel !== genericOtherLabel
      ? storedLabel
      : (CHAIN_KIND_LABEL[effectiveKind] || storedLabel || h.label));
  let kindNote = h.kindNote;

  if (effectiveKind === CHAIN_KIND.EXTENSION) {
    if (h.actLinkedSupplementary) {
      kindNote = 'Παράταση — συμπληρωματική της ίδιας ανάθεσης (χωρίς σύνδεση prev/next στην κύρια αλυσίδα).';
    } else if (hasUserChoice) {
      kindNote = `Χαρακτηρισμός από χρήστη: ${label}.`;
    }
  } else if (hasUserChoice) {
    kindNote = `Χαρακτηρισμός από χρήστη: ${label}.`;
  }

  return {
    ...h,
    userKind: choice.kind,
    effectiveKind,
    kind: effectiveKind,
    label,
    role: effectiveKind,
    kindNote,
    needsReview: false,
    kindConflict: false,
  };
}

/** Εφαρμόζει όλους τους αποθηκευμένους χαρακτηρισμούς στο ιστορικό αλυσίδας. */
export function enrichChainHistoryWithReview(chainHistory, review) {
  if (!Array.isArray(chainHistory)) return [];
  return chainHistory.map((h) => enrichChainHistoryEntryWithReview(h, review));
}

/** Σύντομη περιγραφή δράσης για το UI ανά χαρακτηρισμό */
export function describeChainKindAction(kind) {
  switch (kind) {
    case CHAIN_KIND.CONTRACT:
      return 'Βάση: το ποσό και οι ημερομηνίες της θεωρούνται τα συμβατικά στοιχεία.';
    case CHAIN_KIND.MODIFICATION:
      return 'Δημιουργεί συμπληρωματική γραμμή και επηρεάζει το συνολικό ποσό.';
    case CHAIN_KIND.EXTENSION:
      return 'Ενημερώνει μόνο την προθεσμία/λήξη — δεν αλλάζει το ποσό.';
    case CHAIN_KIND.REPUBLICATION:
      return 'Διορθώνει στοιχεία προηγούμενης πράξης — δεν προστίθεται ως νέα.';
    case CHAIN_KIND.OTHER:
      return 'Καταγράφεται ως σχετική πράξη — χωρίς αυτόματη επίπτωση.';
    default:
      return 'Χρειάζεται να επιλέξετε χαρακτηρισμό για να ξέρει η εφαρμογή τι να κάνει.';
  }
}

/** Τρέχον σύνολο σύμβασης πριν από την πράξη targetAdam (για προεπιλογή ποσού). */
export function computeRunningTotalBeforeChainAdam(formData, review, item) {
  if (!formData || !item?.chainAdam) return 0;

  const history = item.contractIndex != null
    ? getChainHistoryForContract(formData, item.contractIndex)
    : (formData.khmdhsContractChainHistory || []);

  const list = [...(history || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const root = list.find((h) => h.isRoot) || list[0] || null;
  let running = root ? parseGreekAmountString(root.contractAmount) : 0;
  const normTarget = normalizeKhmdhsAdam(item.chainAdam);

  for (const h of list) {
    if (normalizeKhmdhsAdam(h.adam) === normTarget) break;
    if (h.isRoot) continue;
    if (getEffectiveChainKind(h, review) !== CHAIN_KIND.MODIFICATION) continue;
    const choice = getChainKindChoice(review, h.adam);
    const { delta } = resolveModificationSupplementaryAmount(h, choice, running, new Map());
    running += delta;
  }
  return running;
}

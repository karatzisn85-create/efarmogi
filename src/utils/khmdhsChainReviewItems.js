/**
 * Δημιουργία στοιχείων αναφοράς ελέγχου για νέες πράξεις αλυσίδας (renderer).
 */

import { mergeDataQualityReviews } from './khmdhsDataQualityReport';
import { CHAIN_KIND_LABEL } from './khmdhsChainActions';
import {
  buildChainKindSelectOptions,
  buildChainPeerSelectOptions,
} from './khmdhsChainKindOptions';
import { formatDateEl } from './dateFormat';

const KHMDHS_REVIEW_STATUS = {
  COMPLETE: 'complete',
  NEEDS_REVIEW: 'needs_review',
  MISSING: 'missing',
};

function kindLabelEl(kind) {
  return CHAIN_KIND_LABEL[kind] || kind || '';
}

/** Μία κάρτα «τι είδους είναι αυτό το έγγραφο» για πράξη αλυσίδας */
export function buildChainKindReviewItemForEntry(chainHistory, entry) {
  if (!entry?.adam || entry.isRoot) return null;

  const snap = entry.snapshot || {};
  const khmdhsLabel = entry.khmdhsLinkKind ? kindLabelEl(entry.khmdhsLinkKind) : 'δεν προσδιορίζεται';
  const suggested = entry.suggestedKind || null;
  const confidence = entry.confidence || 'none';
  const suggestedLabel = suggested ? kindLabelEl(suggested) : 'χρειάζεται έλεγχος';
  const refHint = ` (${entry.adam})`;

  const message = entry.kindConflict
    ? (entry.kindNote || `Ασυμφωνία: ΚΗΜΔΗΣ «${khmdhsLabel}», ενδείξεις διαφορετικές.`)
    : (entry.kindNote
      ? entry.kindNote
      : (suggested
        ? `Πρόταση εφαρμογής: «${suggestedLabel}» — επιλέξτε εσείς τον σωστό τύπο.`
        : 'Η εφαρμογή δεν είναι σίγουρη — επιλέξτε τι είδους έγγραφο είναι.'));

  return {
    fieldId: 'chainKindReview',
    isChainKind: true,
    chainAdam: entry.adam,
    label: `Τι είδους είναι αυτό το έγγραφο;${refHint}`,
    status: KHMDHS_REVIEW_STATUS.NEEDS_REVIEW,
    displayValue: suggested ? suggestedLabel.replace(/^./, (c) => c.toUpperCase()) : '',
    message,
    manualFieldKey: null,
    suggestedKind: suggested,
    confidence,
    khmdhsLinkKind: entry.khmdhsLinkKind || null,
    kindOptions: buildChainKindSelectOptions(),
    peerOptions: buildChainPeerSelectOptions(chainHistory, entry.adam),
    defaultCorrectsAdam: entry.prevAdam || null,
    hasAmount: !!(entry.contractAmount && String(entry.contractAmount).trim()),
    hasKhmdhsDate: !!(entry.contractDate && String(entry.contractDate).trim()),
    contractAmountDisplay: entry.contractAmount || '',
    endDateIso: entry.endDate ? String(entry.endDate).slice(0, 10) : '',
    section: 'modification',
    sectionLabel: 'Συμπληρωματικές συμβάσεις',
    references: [
      { label: 'Κωδικός πράξης (ΚΗΜΔΗΣ)', value: entry.adam },
      { label: 'Πώς τη συνδέει το ΚΗΜΔΗΣ', value: khmdhsLabel },
      { label: 'Πρόταση εφαρμογής', value: suggestedLabel },
      ...(snap.title || entry.title ? [{ label: 'Τίτλος', value: snap.title || entry.title }] : []),
      ...(entry.prevAdam ? [{ label: 'Προηγούμενη πράξη', value: entry.prevAdam }] : []),
    ],
    relatedInfo: [
      ...(entry.contractDate
        ? [{ label: 'Ημ. υπογραφής/έναρξης', value: formatDateEl(entry.contractDate) }]
        : []),
      ...(entry.endDate
        ? [{ label: 'Ημ. λήξης', value: formatDateEl(entry.endDate) }]
        : []),
      ...(entry.contractAmount
        ? [{ label: 'Ποσό (με ΦΠΑ)', value: `${String(entry.contractAmount).trim()} €` }]
        : []),
      ...(Array.isArray(entry.kindSignals)
        ? entry.kindSignals.map((s) => ({ label: 'Ένδειξη', value: s }))
        : []),
    ],
    searchSteps: [
      'Ανοίξτε την πράξη στο ΚΗΜΔΗΣ ή το PDF στον φάκελό σας.',
      'Επιλέξτε τι είδους έγγραφο είναι.',
      'Συμπληρώστε μόνο τα πεδία που εμφανίζονται για τον τύπο που διαλέξατε.',
    ],
    formLocation: 'Αναφορά ελέγχου → κάρτα «Τι είδους είναι αυτό το έγγραφο;».',
  };
}

/** Προσθήκη review items για νέα πράξη (π.χ. ορφανή συμπληρωματική) */
export function appendChainEntryToDataQualityReview(review, chainHistory, entry, { contractIndex = null } = {}) {
  const item = buildChainKindReviewItemForEntry(chainHistory, entry);
  if (!item) return review;
  const incoming = {
    items: [item],
    generatedAt: new Date().toISOString(),
    hasActionRequired: true,
  };
  return mergeDataQualityReviews(review, incoming, { contractIndex });
}

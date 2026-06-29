/** ΚΗΜΔΗΣ — έγκριση δέσμευσης (εγκεκριμένο REQ) & χρηματικά εντάλματα πληρωμής (PAY) */

import {
  formatKhmdhsDateOnly,
  formatKhmdhsDateTime,
  formatKhmdhsEuro,
} from './khmdhsNoticeFields';
import { formatKhmdhsCostSnapshotGross, grossFromCostSnapshot } from './khmdhsVatHelper';
import {
  classifyPaymentPayer,
  reconcileKhmdhsPaymentsFromProject,
  filterUnrelatedPayments,
} from './khmdhsPaymentReconciliation';
import {
  pickKhmdhsRequestSnapshot,
  buildKhmdhsRequestDisplayGroups,
} from './khmdhsRequestFields';

/* ── Έγκριση δέσμευσης (ΑΠΟΦΑΣΗ ΑΝΑΛΗΨΗΣ ΥΠΟΧΡΕΩΣΗΣ) ── */

export function pickKhmdhsCommitmentSnapshot(snapshot) {
  return pickKhmdhsRequestSnapshot(snapshot);
}

/**
 * Όλες οι Αποφάσεις Ανάληψης Υποχρέωσης — από αποθηκευμένη λίστα, chainMeta ή παλιό μεμονωμένο πεδίο.
 * @returns {Array<{ adam: string, snapshot: object|null, fetchedAt?: string }>}
 */
export function collectKhmdhsCommitmentDecisions(project) {
  const fromList = Array.isArray(project?.khmdhsCommitmentDecisions)
    ? project.khmdhsCommitmentDecisions.filter((d) => d && (d.adam || d.snapshot))
    : [];

  const fromMeta = Array.isArray(project?.khmdhsAdamChainMeta?.allBudgetCommitments)
    ? project.khmdhsAdamChainMeta.allBudgetCommitments.filter((d) => d && (d.adam || d.snapshot))
    : [];

  const merged = [];
  const seen = new Set();
  [...fromList, ...fromMeta].forEach((d) => {
    const key = String(d.adam || d.snapshot?.referenceNumber || '').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push({
      adam: d.adam || d.snapshot?.referenceNumber || '',
      snapshot: d.snapshot || null,
      fetchedAt: d.fetchedAt || '',
    });
  });

  if (merged.length > 0) return merged;

  const adam = String(project?.khmdhsCommitmentAdam || '').trim();
  const snap = pickKhmdhsCommitmentSnapshot(project?.khmdhsCommitmentSnapshot);
  if (adam || snap) {
    return [{
      adam: adam || snap?.referenceNumber || '',
      snapshot: snap,
      fetchedAt: project?.khmdhsCommitmentFetchedAt || '',
    }];
  }
  return [];
}

export function projectHasKhmdhsCommitmentData(project) {
  return collectKhmdhsCommitmentDecisions(project).length > 0;
}

function commitmentDecisionTimestamp(decision) {
  const snap = decision?.snapshot;
  const signed = snap?.signedDate ? Date.parse(snap.signedDate) : NaN;
  if (Number.isFinite(signed)) return signed;
  const fetched = decision?.fetchedAt ? Date.parse(decision.fetchedAt) : NaN;
  if (Number.isFinite(fetched)) return fetched;
  return 0;
}

/**
 * Η πιο πρόσφατη Απόφαση Ανάληψης Υποχρέωσης (ετήσια — όχι άθροισμα ετών).
 * @returns {{ adam: string, snapshot: object|null, fetchedAt?: string }|null}
 */
export function pickLatestKhmdhsCommitmentDecision(project) {
  const decisions = collectKhmdhsCommitmentDecisions(project);
  if (!decisions.length) return null;
  if (decisions.length === 1) return decisions[0];
  return [...decisions].sort(
    (a, b) => commitmentDecisionTimestamp(b) - commitmentDecisionTimestamp(a)
  )[0];
}

/** Ποσό της τελευταίας απόφασης ανάληψης (με ΦΠΑ), όχι άθροισμα ετήσιων αποφάσεων. */
export function latestKhmdhsCommitmentAmountGross(project) {
  const latest = pickLatestKhmdhsCommitmentDecision(project);
  const snap = pickKhmdhsCommitmentSnapshot(latest?.snapshot);
  if (!snap) return null;
  const v = grossFromCostSnapshot(snap);
  if (v != null && v > 0) return v;
  const n = Number(snap.totalCostWithVAT ?? snap.totalCostWithoutVAT);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function buildKhmdhsCommitmentDisplayGroups(snapshot) {
  return buildKhmdhsRequestDisplayGroups(snapshot);
}

export function buildKhmdhsCommitmentCardSummary(snapshot) {
  const snap = pickKhmdhsCommitmentSnapshot(snapshot);
  if (!snap) return null;
  return {
    adam: snap.referenceNumber || '',
    title: snap.title || '',
    amount: formatKhmdhsCostSnapshotGross(snap) || formatKhmdhsEuro(snap.totalCostWithVAT),
    contractType: snap.contractType || '',
    cancelled: !!snap.cancelled,
  };
}

/* ── Χρηματικά εντάλματα πληρωμής (PAY) ── */

export function pickKhmdhsPaymentSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const title = snapshot.title != null ? String(snapshot.title).trim() : '';
  const ref = snapshot.referenceNumber != null ? String(snapshot.referenceNumber).trim() : '';
  if (!title && !ref && snapshot.totalCostWithVAT == null && snapshot.totalCostWithoutVAT == null) {
    return null;
  }
  return snapshot;
}

/** Επιστρέφει τα εντάλματα του έργου ως λίστα { adam, snapshot, error } */
export function getKhmdhsPaymentEntries(project) {
  const rawList = Array.isArray(project?.khmdhsPayments) ? project.khmdhsPayments : [];
  // Φιλτράρισμα άσχετων ενταλμάτων — λειτουργεί και σε ήδη αποθηκευμένα δεδομένα
  const list = filterUnrelatedPayments(rawList, project);
  const contractingOrg = project?.khmdhsAwardSnapshot?.organization
    || project?.khmdhsContractSnapshot?.organization
    || '';
  return list
    .map((p) => {
      const snapshot = pickKhmdhsPaymentSnapshot(p?.snapshot);
      const org = snapshot?.organization || '';
      const userDocumentRole = p?.userDocumentRole || '';
      return {
        adam: String(p?.adam || snapshot?.referenceNumber || '').trim(),
        snapshot,
        error: p?.error || '',
        userDocumentRole,
        userDocumentLabel: String(p?.userDocumentLabel || '').trim(),
        payer: org ? classifyPaymentPayer(org, { contractingOrg }) : null,
      };
    })
    .filter((p) => p.adam || p.snapshot);
}

/** Ποσό για συνόψεις UI — μετά χαρακτηρισμό χρησιμοποιεί το ποσό που μετράει. */
export function getKhmdhsPaymentsDisplayAmountGross(totals) {
  if (!totals) return null;
  if (totals.hasUserClassification) return totals.countableTotalGross;
  if (totals.coFinancingPattern?.estimatedContractorPayment != null) {
    return totals.estimatedContractorPaymentGross;
  }
  return totals.rawTotalGross;
}

/** Άθροισμα ενταλμάτων (με ΦΠΑ) — ακατέργαστο & εκτιμώμενο προς εργολάβο */
export function buildKhmdhsPaymentsTotals(project) {
  const recon = reconcileKhmdhsPaymentsFromProject(project);
  const base = {
    count: recon.count,
    withAmount: recon.activeCount,
    totalGross: recon.rawTotalGross,
    rawTotalGross: recon.rawTotalGross,
    countableTotalGross: recon.countableTotalGross,
    estimatedContractorPaymentGross: recon.estimatedContractorPaymentGross,
    coFinancingPattern: recon.coFinancingPattern,
    rawExceedsContract: recon.rawExceedsContract,
    estimatedExceedsContract: recon.estimatedExceedsContract,
    needsReview: recon.needsReview,
    needsClassification: recon.needsClassification,
    hasUserClassification: recon.hasUserClassification,
    hasMultiplePayers: recon.hasMultiplePayers,
    entries: recon.entries,
  };
  return {
    ...base,
    displayTotalGross: getKhmdhsPaymentsDisplayAmountGross(base),
  };
}

export function projectHasKhmdhsPaymentData(project) {
  return getKhmdhsPaymentEntries(project).length > 0;
}

export function buildKhmdhsPaymentDisplayGroups(snapshot, payer = null, classification = null) {
  const snap = pickKhmdhsPaymentSnapshot(snapshot);
  if (!snap) return [];

  const mkRows = (entries) => entries.filter((r) => r && r.value);

  const role = classification?.role ? String(classification.role).trim() : '';
  const customLabel = classification?.customLabel ? String(classification.customLabel).trim() : '';
  const roleLabel = classification?.roleLabel ? String(classification.roleLabel).trim() : '';
  const countsTowardTotal = classification?.countsTowardTotal;

  const identity = mkRows([
    { label: 'Τίτλος', value: snap.title, fullWidth: true },
    { label: 'ΑΔΑΜ εντάλματος', value: snap.referenceNumber, badge: true },
    ...(customLabel
      ? [{ label: 'Ονομασία χαρακτηρισμού', value: customLabel, highlight: true, fullWidth: true }]
      : []),
    ...(roleLabel
      ? [{
        label: customLabel ? 'Τύπος εγγράφου' : 'Χαρακτηρισμός',
        value: roleLabel,
        highlight: countsTowardTotal === false,
      }]
      : []),
    ...(countsTowardTotal === false
      ? [{ label: 'Στο άθροισμα', value: 'Δεν μετράει', highlight: true }]
      : countsTowardTotal === true
        ? [{ label: 'Στο άθροισμα', value: 'Μετράει', highlight: true }]
        : []),
    { label: 'Είδος', value: snap.contractType },
    ...(snap.cancelled ? [{ label: 'Κατάσταση', value: 'Ακυρωμένο', highlight: true }] : []),
  ]);

  const authority = mkRows([
    { label: 'Αναθέτουσα αρχή / φορέας', value: snap.organization, fullWidth: true },
    ...(payer?.label ? [{ label: 'Κατηγορία φορέα', value: payer.label, highlight: true }] : []),
  ]);

  const dates = mkRows([
    { label: 'Ημ. εντάλματος', value: formatKhmdhsDateOnly(snap.signedDate) },
    { label: 'Ημ. καταχώρισης ΚΗΜΔΗΣ', value: formatKhmdhsDateTime(snap.submissionDate) },
    { label: 'Τελευταία ενημέρωση', value: formatKhmdhsDateTime(snap.lastUpdateDate) },
    ...(snap.cancelled ? [{ label: 'Ημ. ακύρωσης', value: formatKhmdhsDateTime(snap.cancellationDate) }] : []),
  ]);

  const amounts = mkRows([
    { label: 'Ποσό εντάλματος (με ΦΠΑ)', value: formatKhmdhsEuro(snap.totalCostWithVAT), highlight: true },
    { label: 'Ποσό (χωρίς ΦΠΑ)', value: formatKhmdhsEuro(snap.totalCostWithoutVAT) },
    { label: 'Αξία σύμβασης', value: formatKhmdhsEuro(snap.contractValue) },
    { label: 'Χρηματοδότηση', value: snap.fundingSummary, fullWidth: true },
  ]);

  const refs = mkRows([
    { label: 'Κωδικός σύμβασης', value: snap.contractRefNo },
    { label: 'Ανάθεση (AWRD)', value: snap.auctionRefNo },
    { label: 'Αίτημα (REQ)', value: snap.requestRefNo },
    { label: 'ΑΔΑ δαπάνης', value: snap.paymentRelatedAda },
    { label: 'Κωδ. δέσμευσης', value: snap.paymentCommitmentCode },
    { label: 'Αρ. δέσμευσης', value: snap.commitmentNo },
    { label: 'ΑΑΗΤ', value: snap.aaht },
    { label: 'Αρ. πρωτοκόλλου', value: snap.protocolNumber },
  ]);

  return [
    identity.length && { id: 'identity', title: 'Ταυτότητα', icon: '🧾', rows: identity },
    authority.length && { id: 'authority', title: 'Φορέας', icon: '🏛️', rows: authority },
    dates.length && { id: 'dates', title: 'Ημερομηνίες', icon: '📅', rows: dates },
    amounts.length && { id: 'amounts', title: 'Ποσά', icon: '💶', rows: amounts },
    refs.length && { id: 'refs', title: 'Συνδέσεις & στοιχεία', icon: '🔗', rows: refs },
  ].filter(Boolean);
}

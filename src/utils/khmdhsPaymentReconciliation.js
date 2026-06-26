/**
 * Συμφιλίωση ενταλμάτων πληρωμής (PAY) — ταξινόμηση φορέα & έξυπνο άθροισμα.
 */

import { resolveEffectivePayableAmountGrossForPayments } from './khmdhsFields';

export const PAYER_TYPE = {
  REGIONAL_FUND: 'regional_fund',
  CONTRACTING_AUTHORITY: 'contracting_authority',
  MUNICIPALITY: 'municipality',
  OTHER: 'other',
  UNKNOWN: 'unknown',
};

export const PAYER_LABELS = {
  [PAYER_TYPE.REGIONAL_FUND]: 'Περιφερειακό Ταμείο / ΠΕΠΑΚ',
  [PAYER_TYPE.CONTRACTING_AUTHORITY]: 'Αναθέτουσα αρχή',
  [PAYER_TYPE.MUNICIPALITY]: 'Δήμος / Τοπική αρχή',
  [PAYER_TYPE.OTHER]: 'Άλλος φορέας',
  [PAYER_TYPE.UNKNOWN]: 'Άγνωστος φορέας',
};

export const PAYER_SHORT_LABELS = {
  [PAYER_TYPE.REGIONAL_FUND]: 'Περιφ. Ταμείο',
  [PAYER_TYPE.CONTRACTING_AUTHORITY]: 'Αναθέτουσα',
  [PAYER_TYPE.MUNICIPALITY]: 'Δήμος',
  [PAYER_TYPE.OTHER]: 'Άλλος',
  [PAYER_TYPE.UNKNOWN]: '—',
};

const RE_REGIONAL_FUND = /ΠΕΡΙΦΕΡΕΙΑΚ(?:Ο|ΟΥ)\s+ΤΑΜΕΙΟ|ΠΕΠΑΚ|Π\.?\s*Τ\.?\s*Α\.?|ΠΕΡΙΦΕΡΕΙΑΚ(?:Ο|ΟΥ)\s+ΤΑΜ/i;
const RE_MUNICIPALITY = /\bΔΗΜ(?:ΟΣ|ΟΥ|ΩΝ|\.)|\bΚΟΙΝΟΤΗΤ/i;

function normalizeOrgName(name) {
  return String(name || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[–—\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function orgNamesMatch(a, b) {
  const na = normalizeOrgName(a);
  const nb = normalizeOrgName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const strip = (s) => s.replace(/^ΔΗΜΟΣ\s+/i, '').replace(/\s*-\s*/g, ' ');
  const sa = strip(na);
  const sb = strip(nb);
  return sa === sb || (sa.length > 3 && sb.length > 3 && (sa.includes(sb) || sb.includes(sa)));
}

export function classifyPaymentPayer(orgName, { contractingOrg = '' } = {}) {
  const org = normalizeOrgName(orgName);
  if (!org) {
    return { type: PAYER_TYPE.UNKNOWN, label: PAYER_LABELS[PAYER_TYPE.UNKNOWN], shortLabel: PAYER_SHORT_LABELS[PAYER_TYPE.UNKNOWN] };
  }
  if (RE_REGIONAL_FUND.test(org)) {
    return { type: PAYER_TYPE.REGIONAL_FUND, label: PAYER_LABELS[PAYER_TYPE.REGIONAL_FUND], shortLabel: PAYER_SHORT_LABELS[PAYER_TYPE.REGIONAL_FUND] };
  }
  if (contractingOrg && orgNamesMatch(orgName, contractingOrg)) {
    return { type: PAYER_TYPE.CONTRACTING_AUTHORITY, label: PAYER_LABELS[PAYER_TYPE.CONTRACTING_AUTHORITY], shortLabel: PAYER_SHORT_LABELS[PAYER_TYPE.CONTRACTING_AUTHORITY] };
  }
  if (RE_MUNICIPALITY.test(org)) {
    return { type: PAYER_TYPE.MUNICIPALITY, label: PAYER_LABELS[PAYER_TYPE.MUNICIPALITY], shortLabel: PAYER_SHORT_LABELS[PAYER_TYPE.MUNICIPALITY] };
  }
  const raw = String(orgName || '').trim();
  return { type: PAYER_TYPE.OTHER, label: raw || PAYER_LABELS[PAYER_TYPE.OTHER], shortLabel: PAYER_SHORT_LABELS[PAYER_TYPE.OTHER] };
}

export function parseAmount(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function paymentGross(snapshot) {
  if (!snapshot) return null;
  const gross = Number(snapshot.totalCostWithVAT);
  if (Number.isFinite(gross) && gross > 0) return gross;
  const net = Number(snapshot.totalCostWithoutVAT);
  if (Number.isFinite(net) && net > 0) return Math.round(net * 1.24 * 100) / 100;
  return null;
}

function isActivePaymentEntry(entry) {
  const snap = entry?.snapshot || entry;
  if (!snap) return false;
  return !snap.cancelled && !snap.credit;
}

function isLocalAuthorityPayer(payer) {
  return payer?.type === PAYER_TYPE.MUNICIPALITY || payer?.type === PAYER_TYPE.CONTRACTING_AUTHORITY;
}

function detectCoFinancingPattern(activeEntries, contractAmountGross) {
  if (activeEntries.length < 2) return null;

  const regional = activeEntries.filter((e) => e.payer.type === PAYER_TYPE.REGIONAL_FUND);
  const local = activeEntries.filter((e) => isLocalAuthorityPayer(e.payer));
  if (regional.length === 0 || local.length === 0) return null;

  const rawTotal = activeEntries.reduce((s, e) => s + (e.gross || 0), 0);
  const localSum = local.reduce((s, e) => s + (e.gross || 0), 0);
  const regionalSum = regional.reduce((s, e) => s + (e.gross || 0), 0);
  const tolerance = 0.5;

  if (contractAmountGross != null && rawTotal <= contractAmountGross + tolerance) return null;

  const contractRef = contractAmountGross != null ? contractAmountGross : null;

  if (local.length === 1 && regional.length === 1) {
    const lg = local[0].gross;
    const rg = regional[0].gross;
    if (lg != null && rg != null && Math.abs(lg - rg) <= tolerance) {
      if (contractRef == null || Math.abs(lg - contractRef) <= tolerance) {
        return {
          id: 'regional_municipality_pair',
          estimatedContractorPayment: lg,
          localTotal: lg,
          regionalTotal: rg,
        };
      }
    }
  }

  if (local.length >= 1 && contractRef != null && Math.abs(localSum - contractRef) <= tolerance) {
    return {
      id: 'regional_fund_with_local_authority',
      estimatedContractorPayment: localSum,
      localTotal: localSum,
      regionalTotal: regionalSum,
    };
  }

  return null;
}

export function reconcileKhmdhsPayments(payments, opts = {}) {
  const contractingOrg = String(opts.contractingOrg || opts.awardOrg || '').trim();
  const contractAmountGross = opts.contractAmountGross != null
    ? Number(opts.contractAmountGross)
    : null;

  const allEntries = (payments || []).map((p) => {
    const snap = p?.snapshot || p;
    const gross = paymentGross(snap);
    const org = snap?.organization || '';
    const payer = classifyPaymentPayer(org, { contractingOrg });
    return {
      adam: String(p?.adam || snap?.referenceNumber || '').trim(),
      gross,
      org,
      payer,
      cancelled: !!snap?.cancelled,
      credit: !!snap?.credit,
      active: isActivePaymentEntry(p),
    };
  });

  const activeEntries = allEntries.filter((e) => e.active && e.gross != null);
  const rawTotalGross = activeEntries.reduce((s, e) => s + e.gross, 0);
  const coFinancingPattern = detectCoFinancingPattern(activeEntries, contractAmountGross);

  let estimatedContractorPaymentGross = rawTotalGross;
  if (coFinancingPattern?.estimatedContractorPayment != null) {
    estimatedContractorPaymentGross = coFinancingPattern.estimatedContractorPayment;
  }

  const tolerance = 0.5;
  const rawExceedsContract = contractAmountGross != null && rawTotalGross > contractAmountGross + tolerance;
  const estimatedExceedsContract = contractAmountGross != null
    && estimatedContractorPaymentGross > contractAmountGross + tolerance;

  return {
    entries: allEntries,
    activeCount: activeEntries.length,
    count: allEntries.length,
    rawTotalGross,
    estimatedContractorPaymentGross,
    coFinancingPattern,
    rawExceedsContract,
    estimatedExceedsContract,
    needsReview: rawExceedsContract && !coFinancingPattern,
    contractAmountGross,
    hasMultiplePayers: new Set(activeEntries.map((e) => e.payer.type)).size > 1,
  };
}

/** Φιλτράρει εντάλματα που ανήκουν σε άσχετη αλυσίδα, χρησιμοποιώντας αποθηκευμένα
 *  στοιχεία REQ/SYMV του project. Χρησιμοποιείται για καθαρισμό ακόμα και σε αποθηκευμένα δεδομένα.
 */
export function filterUnrelatedPayments(payments, project) {
  // Γνωστές SYMV αλυσίδας
  const knownContracts = new Set();
  const addContract = (v) => { const s = String(v || '').trim().toUpperCase(); if (s) knownContracts.add(s); };

  // Κύρια/παράλληλες συμβάσεις
  (Array.isArray(project?.contracts) ? project.contracts : []).forEach((c) => {
    addContract(c?.khmdhsAdam);
    addContract(c?.khmdhsContractSnapshot?.referenceNumber);
    // Ιστορικό αλυσίδας ανά γραμμή σύμβασης (τροποποιήσεις)
    (Array.isArray(c?.khmdhsContractChainHistory) ? c.khmdhsContractChainHistory : []).forEach((h) => addContract(h?.adam));
    (Array.isArray(c?.khmdhsContractAmendments) ? c.khmdhsContractAmendments : []).forEach((h) => addContract(h?.adam));
  });
  const singleContract = String(project?.khmdhsAdam || project?.khmdhsContractSnapshot?.referenceNumber || '').trim().toUpperCase();
  if (singleContract) knownContracts.add(singleContract);
  // Ιστορικό αλυσίδας ενιαίας σύμβασης (τροποποιήσεις)
  (Array.isArray(project?.khmdhsContractChainHistory) ? project.khmdhsContractChainHistory : []).forEach((h) => addContract(h?.adam));
  (Array.isArray(project?.khmdhsContractAmendments) ? project.khmdhsContractAmendments : []).forEach((h) => addContract(h?.adam));

  // Γνωστές REQ αλυσίδας — συλλέγουμε από ΟΛΕΣ τις διαθέσιμες πηγές
  const knownReqs = new Set();
  const addReq = (v) => { const s = String(v || '').trim().toUpperCase(); if (s) knownReqs.add(s); };

  addReq(project?.khmdhsChainSeedAdam);
  addReq(project?.khmdhsCommitmentAdam);
  addReq(project?.khmdhsRequestAdam);
  addReq(project?.khmdhsRequestSnapshot?.referenceNumber);
  addReq(project?.khmdhsCommitmentSnapshot?.referenceNumber);
  // Από commitment decisions (πολλαπλές αποφάσεις ανάληψης)
  (Array.isArray(project?.khmdhsCommitmentDecisions) ? project.khmdhsCommitmentDecisions : []).forEach((d) => {
    addReq(d?.adam);
    addReq(d?.snapshot?.referenceNumber);
  });
  // Από το award snapshot (ο κρίκος AWRD γνωρίζει το requestRefNo του)
  addReq(project?.khmdhsAwardSnapshot?.requestRefNo);
  // Από contract snapshots
  addReq(project?.khmdhsContractSnapshot?.requestRefNo);
  (Array.isArray(project?.contracts) ? project.contracts : []).forEach((c) => {
    addReq(c?.khmdhsContractSnapshot?.requestRefNo);
  });

  // Παλαιότερη ημ/νία σύμβασης από αποθηκευμένα στοιχεία (Phase A)
  let earliestContractDate = null;
  const contractDateStr = String(project?.contractDate || '').trim();
  if (contractDateStr) {
    // Υποστηρίζει dd/MM/yyyy (ελληνικό) ή ISO
    let d;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(contractDateStr)) {
      const [dd, mm, yyyy] = contractDateStr.split('/');
      d = new Date(`${yyyy}-${mm}-${dd}`);
    } else {
      d = new Date(contractDateStr);
    }
    if (!isNaN(d.getTime())) earliestContractDate = d;
  }
  // Fallback: ελέγχουμε και τα contracts array
  if (!earliestContractDate) {
    (Array.isArray(project?.contracts) ? project.contracts : []).forEach((c) => {
      const s = String(c?.date || c?.contractDate || '').trim();
      if (!s) return;
      let d;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        const [dd, mm, yyyy] = s.split('/');
        d = new Date(`${yyyy}-${mm}-${dd}`);
      } else {
        d = new Date(s);
      }
      if (!isNaN(d.getTime()) && (!earliestContractDate || d < earliestContractDate)) {
        earliestContractDate = d;
      }
    });
  }

  return payments.filter((p) => {
    const snap = p?.snapshot;
    if (!snap) return true;
    const payContract = String(snap.contractRefNo || '').trim().toUpperCase();
    const payReq = String(snap.requestRefNo || '').trim().toUpperCase();

    // Αν αναφέρει SYMV εκτός αλυσίδας → άσχετο
    if (payContract && knownContracts.size > 0 && !knownContracts.has(payContract)) return false;
    // Αν δεν έχει SYMV αλλά αναφέρει REQ εκτός αλυσίδας → άσχετο
    if (!payContract && payReq && knownReqs.size > 0 && !knownReqs.has(payReq)) return false;
    // Ένταλμα ΠΡΙΝ τη σύμβαση = εξ ορισμού άσχετο
    if (earliestContractDate) {
      const rawDate = snap.issueDate || snap.submissionDate || snap.publicationDate || '';
      if (rawDate) {
        const payD = new Date(rawDate);
        if (!isNaN(payD.getTime()) && payD < earliestContractDate) return false;
      }
    }

    return true;
  });
}

export function reconcileKhmdhsPaymentsFromProject(project) {
  const rawPayments = Array.isArray(project?.khmdhsPayments) ? project.khmdhsPayments : [];
  const payments = filterUnrelatedPayments(rawPayments, project);

  const contractingOrg = project?.khmdhsAwardSnapshot?.organization
    || project?.khmdhsContractSnapshot?.organization
    || '';

  const contractAmountGross = resolveEffectivePayableAmountGrossForPayments(project);

  return reconcileKhmdhsPayments(payments, { contractAmountGross, contractingOrg });
}

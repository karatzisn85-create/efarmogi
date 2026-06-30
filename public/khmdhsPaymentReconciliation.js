/**
 * Συμφιλίωση ενταλμάτων πληρωμής (PAY) — ταξινόμηση φορέα & έξυπνο άθροισμα.
 * Σε έργα ΕΣΠΑ/ΠΕΠ συχνά υπάρχουν δύο εντάλματα (Δήμος + Περιφερειακό Ταμείο) για την ίδια πληρωμή.
 */

const RE_REGIONAL_FUND = /ΠΕΡΙΦΕΡΕΙΑΚ(?:Ο|ΟΥ)\s+ΤΑΜΕΙΟ|ΠΕΠΑΚ|Π\.?\s*Τ\.?\s*Α\.?|ΠΕΡΙΦΕΡΕΙΑΚ(?:Ο|ΟΥ)\s+ΤΑΜ/i;
const RE_MUNICIPALITY = /\bΔΗΜ(?:ΟΣ|ΟΥ|ΩΝ|\.)|\bΚΟΙΝΟΤΗΤ/i;

const PAYER_TYPE = {
  REGIONAL_FUND: 'regional_fund',
  CONTRACTING_AUTHORITY: 'contracting_authority',
  MUNICIPALITY: 'municipality',
  OTHER: 'other',
  UNKNOWN: 'unknown',
};

const PAYER_LABELS = {
  [PAYER_TYPE.REGIONAL_FUND]: 'Περιφερειακό Ταμείο / ΠΕΠΑΚ',
  [PAYER_TYPE.CONTRACTING_AUTHORITY]: 'Αναθέτουσα αρχή',
  [PAYER_TYPE.MUNICIPALITY]: 'Δήμος / Τοπική αρχή',
  [PAYER_TYPE.OTHER]: 'Άλλος φορέας',
  [PAYER_TYPE.UNKNOWN]: 'Άγνωστος φορέας',
};

const PAYER_SHORT_LABELS = {
  [PAYER_TYPE.REGIONAL_FUND]: 'Περιφ. Ταμείο',
  [PAYER_TYPE.CONTRACTING_AUTHORITY]: 'Αναθέτουσα',
  [PAYER_TYPE.MUNICIPALITY]: 'Δήμος',
  [PAYER_TYPE.OTHER]: 'Άλλος',
  [PAYER_TYPE.UNKNOWN]: '—',
};

function normalizeOrgName(name) {
  return String(name || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[–—\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function orgNamesMatch(a, b) {
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

function classifyPaymentPayer(orgName, { contractingOrg = '' } = {}) {
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

function parseAmount(value) {
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

function readPaymentDocumentRole(payment) {
  const role = String(payment?.userDocumentRole || PAYMENT_DOCUMENT_ROLE_PAYMENT).trim();
  if (role === PAYMENT_DOCUMENT_ROLE_INFORMATIVE
    || role === PAYMENT_DOCUMENT_ROLE_CO_FINANCING
    || role === PAYMENT_DOCUMENT_ROLE_EXCLUDED) return role;
  return PAYMENT_DOCUMENT_ROLE_PAYMENT;
}

function paymentRoleCountsTowardTotal(role) {
  return readPaymentDocumentRole({ userDocumentRole: role }) === PAYMENT_DOCUMENT_ROLE_PAYMENT;
}

const PAYMENT_DOCUMENT_ROLE_PAYMENT = 'payment_order';
const PAYMENT_DOCUMENT_ROLE_INFORMATIVE = 'informative';
const PAYMENT_DOCUMENT_ROLE_CO_FINANCING = 'co_financing_reimbursement';
const PAYMENT_DOCUMENT_ROLE_EXCLUDED = 'excluded';

/**
 * @param {Array<{ adam?: string, snapshot?: object }>} payments
 * @param {{ contractAmountGross?: number|null, contractingOrg?: string, awardOrg?: string }} opts
 */
function reconcileKhmdhsPayments(payments, opts = {}) {
  const contractingOrg = String(opts.contractingOrg || opts.awardOrg || '').trim();
  const contractAmountGross = opts.contractAmountGross != null
    ? Number(opts.contractAmountGross)
    : null;

  const allEntries = (payments || []).map((p) => {
    const snap = p?.snapshot || p;
    const gross = paymentGross(snap);
    const org = snap?.organization || '';
    const payer = classifyPaymentPayer(org, { contractingOrg });
    const userDocumentRole = readPaymentDocumentRole(p);
    return {
      adam: String(p?.adam || snap?.referenceNumber || '').trim(),
      gross,
      org,
      payer,
      userDocumentRole,
      countsTowardTotal: paymentRoleCountsTowardTotal(userDocumentRole),
      cancelled: !!snap?.cancelled,
      credit: !!snap?.credit,
      active: isActivePaymentEntry(p),
      // Υποψήφιο άσχετο ένταλμα: αναφέρει ΑΔΑΜ σύμβασης εκτός αλυσίδας
      unrelated: !!p?.unrelated,
      unrelatedContractRef: p?.unrelatedContractRef || null,
    };
  });

  // Εξαιρούμε τα ύποπτα-άσχετα εντάλματα από τον υπολογισμό αθροίσματος
  const activeEntries = allEntries.filter((e) => e.active && e.gross != null && !e.unrelated);
  const rawTotalGross = activeEntries.reduce((s, e) => s + e.gross, 0);
  const coFinancingPattern = detectCoFinancingPattern(activeEntries, contractAmountGross);

  const classifiedEntries = activeEntries.filter((e) => e.userDocumentRole);
  const hasUserClassification = classifiedEntries.length > 0;
  const countableEntries = activeEntries.filter((e) => {
    if (!e.userDocumentRole) return true;
    return paymentRoleCountsTowardTotal(e.userDocumentRole);
  });
  const countableTotalGross = countableEntries.reduce((s, e) => s + e.gross, 0);

  let estimatedContractorPaymentGross = rawTotalGross;
  if (hasUserClassification) {
    estimatedContractorPaymentGross = countableTotalGross;
  } else if (coFinancingPattern?.estimatedContractorPayment != null) {
    estimatedContractorPaymentGross = coFinancingPattern.estimatedContractorPayment;
  }

  const tolerance = 0.5;
  const rawExceedsContract = contractAmountGross != null && rawTotalGross > contractAmountGross + tolerance;
  const countableExceedsContract = contractAmountGross != null
    && countableTotalGross > contractAmountGross + tolerance;
  const estimatedExceedsContract = contractAmountGross != null
    && estimatedContractorPaymentGross > contractAmountGross + tolerance;

  const needsClassification = rawExceedsContract && (
    !hasUserClassification
    || countableExceedsContract
    || classifiedEntries.length < activeEntries.length
  );

  return {
    entries: allEntries,
    activeCount: activeEntries.length,
    count: allEntries.length,
    rawTotalGross,
    countableTotalGross,
    estimatedContractorPaymentGross,
    coFinancingPattern,
    rawExceedsContract,
    countableExceedsContract,
    estimatedExceedsContract,
    needsReview: needsClassification,
    needsClassification,
    hasUserClassification,
    contractAmountGross,
    hasMultiplePayers: new Set(activeEntries.map((e) => e.payer.type)).size > 1,
  };
}

function parseGreekAmountString(val) {
  if (!val) return 0;
  const cleaned = String(val).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

function isMultipleContractsForm(implementationForm) {
  return implementationForm === 'Πολλές Συμβάσεις';
}

function isExtensionSupplementaryRow(row, formData) {
  if (!row) return false;
  if (row.chainKind === 'extension') return true;
  const comment = String(row.comments || '').trim();
  if (comment === 'Παράταση') return true;
  const adam = String(row.khmdhsAdam || '').trim().toUpperCase();
  if (!adam) return false;
  const planItem = (formData?.khmdhsSymvChainPlan?.items || []).find(
    (i) => String(i?.adam || '').trim().toUpperCase() === adam
  );
  return planItem?.role === 'extension';
}

function parseSupplementaryParts(formData) {
  const suppRows = (formData?.supplementaryContracts || [])
    .filter((row) => !isExtensionSupplementaryRow(row, formData));
  const manualSuppPart = suppRows
    .filter((row) => !row?.khmdhsDerived)
    .reduce((sum, row) => sum + parseGreekAmountString(row?.amount), 0);
  const derivedSuppPart = suppRows
    .filter((row) => row?.khmdhsDerived)
    .reduce((sum, row) => sum + parseGreekAmountString(row?.amount), 0);
  return { manualSuppPart, derivedSuppPart, allSuppPart: manualSuppPart + derivedSuppPart };
}

function resolveMainContractTrackGross(formData) {
  const tolerance = 0.5;
  let contractPart = 0;
  if (isMultipleContractsForm(formData.implementationForm)) {
    contractPart = (formData.contracts || []).reduce(
      (sum, row) => sum + parseGreekAmountString(row?.amount), 0
    );
  } else {
    contractPart = parseGreekAmountString(formData.contractAmount);
  }

  let apePart = 0;
  const apeRaw = formData.apeAmount
    || (() => {
      const c = (formData.contracts || []).find((r) => parseGreekAmountString(r?.apeAmount) > 0);
      return c?.apeAmount || '';
    })();
  if (apeRaw != null && String(apeRaw).trim()) {
    apePart = parseGreekAmountString(apeRaw);
  }

  if (apePart > tolerance) return apePart;
  return contractPart;
}

function resolveSupplementaryGrossToAdd(formData) {
  const tolerance = 0.5;
  const { allSuppPart } = parseSupplementaryParts(formData);
  return allSuppPart > tolerance ? allSuppPart : 0;
}

function resolveEffectivePayableAmountGrossForPayments(formData) {
  if (!formData) return null;
  const tolerance = 0.5;

  if (isMultipleContractsForm(formData.implementationForm)) {
    const rowSum = (formData.contracts || []).reduce((sum, row) => {
      const contractPart = parseGreekAmountString(row?.amount);
      const apePart = parseGreekAmountString(row?.apeAmount);
      if (apePart > tolerance) return sum + apePart;
      return sum + contractPart;
    }, 0);
    const supp = resolveSupplementaryGrossToAdd(formData);
    const total = rowSum + supp;
    if (total > tolerance) return total;
    if (rowSum > tolerance) return rowSum;
    return null;
  }

  const mainTrack = resolveMainContractTrackGross(formData);
  const suppPart = resolveSupplementaryGrossToAdd(formData);
  const total = mainTrack + suppPart;
  if (total > tolerance) return total;
  if (mainTrack > tolerance) return mainTrack;
  return null;
}

function reconcileKhmdhsPaymentsFromProject(project) {
  const payments = Array.isArray(project?.khmdhsPayments) ? project.khmdhsPayments : [];
  const contractingOrg = project?.khmdhsAwardSnapshot?.organization
    || project?.khmdhsContractSnapshot?.organization
    || '';
  const contractAmountGross = resolveEffectivePayableAmountGrossForPayments(project);
  return reconcileKhmdhsPayments(payments, { contractAmountGross, contractingOrg });
}

module.exports = {
  PAYER_TYPE,
  PAYER_LABELS,
  PAYER_SHORT_LABELS,
  normalizeOrgName,
  orgNamesMatch,
  classifyPaymentPayer,
  parseAmount,
  paymentGross,
  reconcileKhmdhsPayments,
  reconcileKhmdhsPaymentsFromProject,
};

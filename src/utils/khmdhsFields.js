/** ΚΗΜΔΗΣ / ΑΔΑΜ — μία σύμβαση (επίπεδο έργου) ή ανά εγγραφή στο contracts[] */

import { containsSearchTerm } from './searchUtils';
import { enrichChainHistoryWithReview } from './khmdhsChainActions';
import { overlaySymvPlanLabelsOnChainHistory } from './khmdhsSymvChainPlanner';

export function emptyKhmdhsOnContract() {
  return {
    khmdhsAdam: '',
    khmdhsContractSnapshot: null,
    khmdhsContractFetchedAt: '',
    khmdhsContractAmendments: [],
    khmdhsContractChainHistory: [],
  };
}

export function normalizeContractRow(contract) {
  const c = contract && typeof contract === 'object' ? contract : {};
  return {
    date: c.date != null ? String(c.date) : '',
    amount: c.amount != null ? String(c.amount) : '',
    apeAmount: c.apeAmount != null ? String(c.apeAmount) : '',
    comments: c.comments != null ? String(c.comments) : '',
    contractEndDate: c.contractEndDate != null ? String(c.contractEndDate).slice(0, 10) : '',
    khmdhsAdam: c.khmdhsAdam != null ? String(c.khmdhsAdam) : '',
    khmdhsContractSnapshot: c.khmdhsContractSnapshot || null,
    khmdhsContractFetchedAt: c.khmdhsContractFetchedAt != null ? String(c.khmdhsContractFetchedAt) : '',
    khmdhsContractAmendments: Array.isArray(c.khmdhsContractAmendments) ? c.khmdhsContractAmendments : [],
    khmdhsContractChainHistory: Array.isArray(c.khmdhsContractChainHistory) ? c.khmdhsContractChainHistory : [],
  };
}

export function isMultipleContractsForm(implementationForm) {
  return implementationForm === 'Πολλές Συμβάσεις';
}

/** ΑΠΕ για ανάκτηση/DQR — χωρίς «διαρροή» από ορφανές γραμμές contracts[] */
export function resolveStoredApeAmount(form, contractIndex = null) {
  if (!form) return '';
  if (contractIndex != null && contractIndex >= 0) {
    return String(form.contracts?.[contractIndex]?.apeAmount || '').trim();
  }
  if (isMultipleContractsForm(form.implementationForm)) return '';
  return String(form.apeAmount || '').trim();
}

export function parseGreekAmountString(val) {
  if (!val) return 0;
  const cleaned = String(val).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function readLatestContractApeAmountRaw(formData, contractIndex = null) {
  if (!formData) return '';
  let entries = [];
  if (contractIndex != null && isMultipleContractsForm(formData.implementationForm)) {
    entries = formData.contracts?.[contractIndex]?.apeEntries || [];
    if (!entries.length) return String(formData.contracts?.[contractIndex]?.apeAmount || '').trim();
  } else {
    entries = formData.apeEntries || [];
    if (!entries.length) return String(formData.apeAmount || '').trim();
  }
  if (!entries.length) return '';
  const sorted = [...entries].sort((a, b) => {
    const da = String(a?.documentDate || a?.createdAt || '').slice(0, 10);
    const db = String(b?.documentDate || b?.createdAt || '').slice(0, 10);
    return da.localeCompare(db);
  });
  return String(sorted[sorted.length - 1]?.apeAmount || '').trim();
}

function parseApeAmountGross(formData, contractIndex = null) {
  const apeRaw = readLatestContractApeAmountRaw(formData, contractIndex);
  if (!apeRaw) return 0;
  return parseGreekAmountString(apeRaw);
}

function parseContractAmountGross(formData, contractIndex = null) {
  if (!formData) return 0;
  if (isMultipleContractsForm(formData.implementationForm)) {
    if (contractIndex != null) {
      return parseGreekAmountString(formData.contracts?.[contractIndex]?.amount);
    }
    return (formData.contracts || []).reduce(
      (sum, row) => sum + parseGreekAmountString(row?.amount), 0
    );
  }
  return parseGreekAmountString(formData.contractAmount);
}

function parseSupplementaryParts(formData) {
  const suppRows = formData?.supplementaryContracts || [];
  const manualSuppPart = suppRows
    .filter((row) => !row?.khmdhsDerived)
    .reduce((sum, row) => sum + parseGreekAmountString(row?.amount), 0);
  const derivedSuppPart = suppRows
    .filter((row) => row?.khmdhsDerived)
    .reduce((sum, row) => sum + parseGreekAmountString(row?.amount), 0);
  return { manualSuppPart, derivedSuppPart, allSuppPart: manualSuppPart + derivedSuppPart };
}

/**
 * Κύρια γραμμή: ΑΠΕ (τελικό διαμορφωθέν) αν υπάρχει, αλλιώς ποσό σύμβασης.
 * Το ΑΠΕ περιλαμβάνει ήδη τη σύμβαση και τυχόν αυξήσεις/μειώσεις — όχι ξεχωριστά το ποσό σύμβασης.
 */
function resolveMainContractTrackGross(formData, contractIndex = null) {
  const tolerance = 0.5;
  const apePart = parseApeAmountGross(formData, contractIndex);
  if (apePart > tolerance) return apePart;
  return parseContractAmountGross(formData, contractIndex);
}

/** Άθροισμα όλων των συμπληρωματικών συμβάσεων (αν υπάρχουν). */
function resolveSupplementaryGrossToAdd(formData) {
  const tolerance = 0.5;
  const { allSuppPart } = parseSupplementaryParts(formData);
  return allSuppPart > tolerance ? allSuppPart : 0;
}

/**
 * Τελικό πληρωτέο ποσό για έλεγχο ενταλμάτων:
 * - Με ΑΠΕ: ΑΠΕ + συμπληρωματικές
 * - Χωρίς ΑΠΕ: ποσό σύμβασης + συμπληρωματικές
 */
export function resolveEffectivePayableAmountGrossForPayments(formData, contractIndex = null) {
  if (!formData) return null;

  const tolerance = 0.5;

  if (isMultipleContractsForm(formData.implementationForm)) {
    if (contractIndex != null) {
      const main = resolveMainContractTrackGross(formData, contractIndex);
      const supp = resolveSupplementaryGrossToAdd(formData);
      const total = main + supp;
      if (total > tolerance) return total;
      return main > tolerance ? main : null;
    }
    const rowSum = (formData.contracts || []).reduce(
      (sum, _row, idx) => sum + resolveMainContractTrackGross(formData, idx),
      0
    );
    const supp = resolveSupplementaryGrossToAdd(formData);
    const total = rowSum + supp;
    if (total > tolerance) return total;
    if (rowSum > tolerance) return rowSum;
    return null;
  }

  const mainTrack = resolveMainContractTrackGross(formData, null);
  const suppPart = resolveSupplementaryGrossToAdd(formData);
  const total = mainTrack + suppPart;

  if (total > tolerance) return total;
  if (mainTrack > tolerance) return mainTrack;
  const { manualSuppPart, allSuppPart } = parseSupplementaryParts(formData);
  if (allSuppPart > tolerance) return allSuppPart;
  if (manualSuppPart > tolerance) return manualSuppPart;
  const apePart = parseApeAmountGross(formData, null);
  if (apePart > tolerance) return apePart;
  return null;
}

/** Περιγραφή τμημάτων τελικού πληρωτέου — για μηνύματα ελέγχου ενταλμάτων. */
export function describeEffectivePayableAmountParts(formData, contractIndex = null) {
  const contractPart = parseContractAmountGross(formData, contractIndex);
  const apePart = parseApeAmountGross(formData, contractIndex);
  const { manualSuppPart, derivedSuppPart, allSuppPart } = parseSupplementaryParts(formData);
  const mainTrack = resolveMainContractTrackGross(formData, contractIndex);
  const suppToAdd = resolveSupplementaryGrossToAdd(formData);
  const usesApeAsMain = apePart > 0.5;
  return {
    contractPart,
    manualSuppPart,
    derivedSuppPart,
    apePart,
    mainTrack,
    suppToAdd,
    hasApe: usesApeAsMain,
    usesApeAsMain,
    hasManualSupp: manualSuppPart > 0,
    hasDerivedSupp: derivedSuppPart > 0,
    suppIncludedInContract: false,
    suppIncludedInApe: false,
  };
}

/** Συνολικό ποσό σύμβασης — χωρίς διπλομέτρηση πεδίων επιπέδου έργου + contracts[] */
export function getTotalContractAmount(project) {
  if (!project) return 0;
  let total = 0;
  if (isMultipleContractsForm(project.implementationForm)) {
    (project.contracts || []).forEach((c) => {
      total += parseGreekAmountString(c.amount);
    });
  } else {
    total += parseGreekAmountString(project.contractAmount);
  }
  (project.supplementaryContracts || []).forEach((c) => {
    total += parseGreekAmountString(c.amount);
  });
  return total;
}

/** Μεταφορά παλιού ενιαίου ΑΔΑΜ στην 1η σύμβαση */
export function normalizeContractsFromProject(project) {
  if (!project) return [];
  let contracts = Array.isArray(project.contracts)
    ? project.contracts.map(normalizeContractRow)
    : [];
  if (isMultipleContractsForm(project.implementationForm) && project.khmdhsAdam && contracts.length > 0) {
    const topAdam = String(project.khmdhsAdam || '').trim();
    if (topAdam && !String(contracts[0].khmdhsAdam || '').trim()) {
      contracts = contracts.map((c, i) =>
        i === 0
          ? {
              ...c,
              khmdhsAdam: topAdam,
              khmdhsContractSnapshot: project.khmdhsContractSnapshot || c.khmdhsContractSnapshot,
              khmdhsContractFetchedAt:
                project.khmdhsContractFetchedAt != null ? String(project.khmdhsContractFetchedAt) : c.khmdhsContractFetchedAt
            }
          : c
      );
    }
  }
  return contracts;
}

/** Εγγραφές για κάρτα / λεπτομέρεια */
export function getKhmdhsDisplayEntries(project) {
  if (!project) return [];
  const review = project.khmdhsDataQualityReview || null;
  if (isMultipleContractsForm(project.implementationForm) && Array.isArray(project.contracts)) {
    return project.contracts
      .map((c, i) => ({
        contractIndex: i + 1,
        adam: String(c?.khmdhsAdam || '').trim(),
        snapshot: c?.khmdhsContractSnapshot || null,
        fetchedAt: c?.khmdhsContractFetchedAt || '',
        amendments: Array.isArray(c?.khmdhsContractAmendments) ? c.khmdhsContractAmendments : [],
        chainHistory: overlaySymvPlanLabelsOnChainHistory(
          enrichChainHistoryWithReview(
            Array.isArray(c?.khmdhsContractChainHistory) ? c.khmdhsContractChainHistory : [],
            review
          ),
          project.khmdhsSymvChainPlan
        ),
        roleLabel: c?.khmdhsContractRoleLabel || '',
        storedAmount: String(c?.amount || '').trim(),
      }))
      .filter((e) => e.adam || e.snapshot);
  }
  const adam = String(project.khmdhsAdam || '').trim();
  const snapshot = project.khmdhsContractSnapshot || null;
  if (!adam && !snapshot) return [];
  return [
    {
      contractIndex: null,
      adam,
      snapshot,
      fetchedAt: project.khmdhsContractFetchedAt || '',
      amendments: Array.isArray(project.khmdhsContractAmendments) ? project.khmdhsContractAmendments : [],
      chainHistory: overlaySymvPlanLabelsOnChainHistory(
        enrichChainHistoryWithReview(
          Array.isArray(project.khmdhsContractChainHistory) ? project.khmdhsContractChainHistory : [],
          review
        ),
        project.khmdhsSymvChainPlan
      ),
      roleLabel: project.khmdhsContractRoleLabel || '',
      storedAmount: String(project.contractAmount || '').trim(),
    }
  ];
}

export function projectHasKhmdhsData(project) {
  return getKhmdhsDisplayEntries(project).length > 0;
}

function normalizeVatDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function matchesAnadoxosVat(storedVat, query) {
  const q = String(query || '').trim();
  if (!q) return true;
  const stored = String(storedVat || '').trim();
  if (!stored) return false;
  if (containsSearchTerm(stored, q)) return true;
  const qDigits = normalizeVatDigits(q);
  const sDigits = normalizeVatDigits(stored);
  return qDigits.length > 0 && sDigits.includes(qDigits);
}

/** Κείμενο αναζήτησης από όλες τις εγγραφές ΚΗΜΔΗΣ του υποέργου. */
export function getProjectKhmdhsSearchText(project) {
  const parts = [];
  getKhmdhsDisplayEntries(project).forEach((entry) => {
    if (entry.adam) parts.push(entry.adam);
    const snap = entry.snapshot;
    if (!snap) return;
    if (snap.anadoxosName) parts.push(snap.anadoxosName);
    if (snap.anadoxosVat) parts.push(snap.anadoxosVat);
    if (snap.assigningAuthority) parts.push(snap.assigningAuthority);
  });
  return parts.join(' ');
}

/**
 * Φίλτρο επωνυμίας / ΑΦΜ ανάδοχου (στοιχεία από ΚΗΜΔΗΣ).
 * Αν συμπληρωθούν και τα δύο, πρέπει να ταιριάζουν στην ίδια σύμβαση.
 */
export function projectMatchesKhmdhsAnadoxosFilters(project, { anadoxosName = '', anadoxosVat = '' } = {}) {
  const nameQ = String(anadoxosName || '').trim();
  const vatQ = String(anadoxosVat || '').trim();
  if (!nameQ && !vatQ) return true;

  const entries = getKhmdhsDisplayEntries(project).filter((e) => e.snapshot);
  if (entries.length === 0) return false;

  return entries.some((entry) => {
    const snap = entry.snapshot;
    const nameOk = !nameQ || containsSearchTerm(snap.anadoxosName, nameQ);
    const vatOk = matchesAnadoxosVat(snap.anadoxosVat, vatQ);
    return nameOk && vatOk;
  });
}

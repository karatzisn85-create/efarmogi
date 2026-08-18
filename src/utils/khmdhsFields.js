/** ΚΗΜΔΗΣ / ΑΔΑΜ — μία σύμβαση (επίπεδο έργου) ή ανά εγγραφή στο contracts[] */

import { containsSearchTerm } from './searchUtils';
import { enrichChainHistoryWithReview } from './khmdhsChainActions';
import { overlaySymvPlanLabelsOnChainHistory } from './khmdhsSymvChainPlanner';
import {
  getKhmdhsAmountSanityReference,
  normalizeProjectAmountForStorage,
} from './projectAmountUtils';
import { SYMV_CHAIN_ROLE } from './khmdhsSymvChainPlanner';

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

/** ΑΠΕ για ανάκτηση/DQR — από apeEntries ή legacy apeAmount */
export function resolveStoredApeAmount(form, contractIndex = null) {
  if (!form) return '';
  if (isMultipleContractsForm(form.implementationForm) && (contractIndex == null || contractIndex < 0)) {
    return '';
  }
  return readLatestContractApeAmountRaw(form, contractIndex);
}

export function parseGreekAmountString(val) {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;

  const cleaned = String(val).trim().replace(/[^\d,.-]/g, '');
  if (!cleaned) return 0;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  let normalized;
  if (hasComma && hasDot) {
    // Ελληνική μορφή: 1.234.567,89
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.');
  } else if (hasDot) {
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount === 1) {
      const [, frac = ''] = cleaned.split('.');
      // Μοναδική τελεία με 1–2 δεκαδικά → διεθνής μορφή (π.χ. 236290.21)
      normalized = frac.length <= 2 ? cleaned : cleaned.replace(/\./g, '');
    } else {
      normalized = cleaned.replace(/\./g, '');
    }
  } else {
    normalized = cleaned;
  }

  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
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
  const latestAmount = String(sorted[sorted.length - 1]?.apeAmount || '').trim();
  if (latestAmount) return latestAmount;
  const legacyAmount = contractIndex != null && isMultipleContractsForm(formData.implementationForm)
    ? String(formData.contracts?.[contractIndex]?.apeAmount || '').trim()
    : String(formData.apeAmount || '').trim();
  if (!legacyAmount) return '';
  const contractRef = contractIndex != null && isMultipleContractsForm(formData.implementationForm)
    ? String(formData.contracts?.[contractIndex]?.amount || '').trim()
    : String(formData.contractAmount || '').trim();
  if (contractRef && legacyAmount) {
    const apeN = parseGreekAmountString(legacyAmount);
    const contractN = parseGreekAmountString(contractRef);
    if (apeN > 0 && contractN > 0 && Math.abs(apeN - contractN) < 0.01) {
      return '';
    }
  }
  return legacyAmount;
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

/** Παράταση — δεν αυξάνει το πληρωτέο ποσό (μόνο προθεσμία). */
export function isExtensionSupplementaryRow(row, formData) {
  if (!row) return false;
  if (row.chainKind === 'extension') return true;
  const comment = String(row.comments || '').trim();
  if (comment === 'Παράταση') return true;
  const adam = String(row.khmdhsAdam || '').trim().toUpperCase();
  if (!adam) return false;
  const planItem = (formData?.khmdhsSymvChainPlan?.items || []).find(
    (i) => String(i?.adam || '').trim().toUpperCase() === adam
  );
  return planItem?.role === SYMV_CHAIN_ROLE.EXTENSION;
}

function parseSupplementaryParts(formData) {
  const { parseNormalizedSupplementaryParts } = require('./khmdhsSupplementaryAmountLogic');
  return parseNormalizedSupplementaryParts(formData);
}

/** Άθροισμα συμπληρωματικών για εμφάνιση στην κάρτα — ελληνικά ποσά, χωρίς παρατάσεις. */
export function sumNonExtensionSupplementaryGross(formData) {
  if (!formData) return 0;
  return parseSupplementaryParts(formData).allSuppPart;
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

/** Ετικέτες για τελικό διαμορφωθέν ποσό μετά ΑΠΕ (αναφορά / απολογισμός). */
export const FINAL_CONTRACT_AFTER_APE_SHORT_LABEL = 'Τελικό μετά ΑΠΕ';
export const FINAL_CONTRACT_AFTER_APE_FULL_LABEL = 'Τελικό διαμορφωθέν ποσό σύμβασης (μετά ΑΠΕ)';
export const FINAL_CONTRACT_AFTER_APE_EXPLANATION =
  'Πρόκειται για το τελικό ποσό της σύμβασης όπως διαμορφώθηκε μετά από αναθεωρήσεις (ΑΠΕ). Ισχύει πάντα το πιο πρόσφατο ΑΠΕ κατά ημερομηνία.';

function formatEuroGrossLabel(n) {
  if (n == null || !Number.isFinite(n) || n <= 0) return '';
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function latestApeDocumentDate(formData, contractIndex = null) {
  if (!formData) return '';
  let entries = [];
  if (contractIndex != null && isMultipleContractsForm(formData.implementationForm)) {
    entries = formData.contracts?.[contractIndex]?.apeEntries || [];
  } else {
    entries = formData.apeEntries || [];
  }
  if (!entries.length) return '';
  const sorted = [...entries].sort((a, b) => {
    const da = String(a?.documentDate || a?.createdAt || '').slice(0, 10);
    const db = String(b?.documentDate || b?.createdAt || '').slice(0, 10);
    return da.localeCompare(db);
  });
  return String(sorted[sorted.length - 1]?.documentDate || '').slice(0, 10);
}

/**
 * Τελικό διαμορφωθέν ποσό σύμβασης βάσει του τελευταίου χρονικά ΑΠΕ.
 * Αν δεν υπάρχει πραγματικός ΑΠΕ → hasRevision: false (δεν εμφανίζεται ως ξεχωριστό πεδίο).
 * Σε πολλές συμβάσεις: άθροισμα (ΑΠΕ αν υπάρχει ανά σύμβαση, αλλιώς ποσό σύμβασης),
 * μόνο όταν τουλάχιστον μία έχει ΑΠΕ.
 */
export function resolveFinalContractAmountAfterApe(formData) {
  const empty = {
    hasRevision: false,
    amount: null,
    amountLabel: '',
    amountRaw: '',
    baseAmount: null,
    baseAmountLabel: '',
    apeDocumentDate: '',
    shortLabel: FINAL_CONTRACT_AFTER_APE_SHORT_LABEL,
    fullLabel: FINAL_CONTRACT_AFTER_APE_FULL_LABEL,
    explanation: FINAL_CONTRACT_AFTER_APE_EXPLANATION,
  };
  if (!formData) return empty;

  const tolerance = 0.5;

  if (isMultipleContractsForm(formData.implementationForm)) {
    const rows = formData.contracts || [];
    let hasRevision = false;
    let total = 0;
    let baseTotal = 0;
    let latestDate = '';
    rows.forEach((_row, idx) => {
      const ape = parseApeAmountGross(formData, idx);
      const base = parseContractAmountGross(formData, idx);
      baseTotal += base;
      if (ape > tolerance) {
        hasRevision = true;
        total += ape;
        const d = latestApeDocumentDate(formData, idx);
        if (d && (!latestDate || d.localeCompare(latestDate) > 0)) latestDate = d;
      } else {
        total += base;
      }
    });
    if (!hasRevision) {
      return {
        ...empty,
        baseAmount: baseTotal > tolerance ? baseTotal : null,
        baseAmountLabel: formatEuroGrossLabel(baseTotal),
      };
    }
    return {
      ...empty,
      hasRevision: true,
      amount: total,
      amountLabel: formatEuroGrossLabel(total),
      amountRaw: formatEuroGrossLabel(total),
      baseAmount: baseTotal > tolerance ? baseTotal : null,
      baseAmountLabel: formatEuroGrossLabel(baseTotal),
      apeDocumentDate: latestDate,
    };
  }

  const ape = parseApeAmountGross(formData, null);
  const base = parseContractAmountGross(formData, null);
  const hasEntryHistory = (formData.apeEntries || []).some((e) => String(e?.apeAmount || '').trim());
  const ghostSameAsContract = ape > tolerance
    && base > tolerance
    && Math.abs(ape - base) < 0.01
    && !hasEntryHistory;
  if (ape <= tolerance || ghostSameAsContract) {
    return {
      ...empty,
      baseAmount: base > tolerance ? base : null,
      baseAmountLabel: formatEuroGrossLabel(base),
    };
  }
  return {
    ...empty,
    hasRevision: true,
    amount: ape,
    amountLabel: formatEuroGrossLabel(ape),
    amountRaw: readLatestContractApeAmountRaw(formData, null) || formatEuroGrossLabel(ape),
    baseAmount: base > tolerance ? base : null,
    baseAmountLabel: formatEuroGrossLabel(base),
    apeDocumentDate: latestApeDocumentDate(formData, null),
  };
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

/** Συνολικό ποσό σύμβασης — τρέχον άθροισμα (αρχική + συμπληρωματικές, όχi αθέροισμα πλήρων τιμών ΚΗΜΔΗΣ) */
export function getTotalContractAmount(project) {
  const { computeProjectContractTotal } = require('./khmdhsSupplementaryAmountLogic');
  return computeProjectContractTotal(project);
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

function resolveStoredContractAmount(project, rawAmount) {
  const raw = String(rawAmount || '').trim();
  if (!raw) return '';
  const sanityRef = getKhmdhsAmountSanityReference(project);
  return normalizeProjectAmountForStorage(raw, sanityRef) || raw;
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
        storedAmount: resolveStoredContractAmount(project, c?.amount),
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
      storedAmount: resolveStoredContractAmount(project, project.contractAmount),
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

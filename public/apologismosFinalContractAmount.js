/**
 * Τελικό διαμορφωθέν ποσό σύμβασης βάσει του τελευταίου χρονικά ΑΠΕ.
 * CommonJS για electron / apologismosDomain (ίδια λογική με src/utils/khmdhsFields).
 */

const FINAL_CONTRACT_AFTER_APE_SHORT_LABEL = 'Τελικό μετά ΑΠΕ';
const FINAL_CONTRACT_AFTER_APE_FULL_LABEL = 'Τελικό διαμορφωθέν ποσό σύμβασης (μετά ΑΠΕ)';
const FINAL_CONTRACT_AFTER_APE_EXPLANATION =
  'Πρόκειται για το τελικό ποσό της σύμβασης όπως διαμορφώθηκε μετά από αναθεωρήσεις (ΑΠΕ). Ισχύει πάντα το πιο πρόσφατο ΑΠΕ κατά ημερομηνία.';

function parseGreekAmountString(val) {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const cleaned = String(val).trim().replace(/[^\d,.-]/g, '');
  if (!cleaned) return 0;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  let normalized;
  if (hasComma && hasDot) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.');
  } else if (hasDot) {
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount === 1) {
      const [, frac = ''] = cleaned.split('.');
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

function formatEuroGrossLabel(n) {
  if (n == null || !Number.isFinite(n) || n <= 0) return '';
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isMultipleContractsForm(implementationForm) {
  return String(implementationForm || '').trim() === 'Πολλές Συμβάσεις';
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
      (sum, row) => sum + parseGreekAmountString(row?.amount),
      0
    );
  }
  return parseGreekAmountString(formData.contractAmount);
}

function emptyResult() {
  return {
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
}

function resolveFinalContractAmountAfterApe(formData) {
  const empty = emptyResult();
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

/** Πεδία ποσού ΑΠΕ για sync απολογισμού από υποέργο. */
function extractFinalContractAmountFieldsFromSubproject(subproject) {
  const resolved = resolveFinalContractAmountAfterApe(subproject);
  if (!resolved.hasRevision) {
    return {
      finalContractAmountAfterApe: '',
      finalContractApeDate: '',
      hasFinalContractAmountAfterApe: false,
    };
  }
  return {
    finalContractAmountAfterApe: resolved.amountRaw || resolved.amountLabel,
    finalContractApeDate: resolved.apeDocumentDate || '',
    hasFinalContractAmountAfterApe: true,
  };
}

function cardShowsFinalContractAmountInPresentation(card) {
  if (!card || !card.showFinalContractAmountInPresentation) return false;
  const n = parseGreekAmountString(card.finalContractAmountAfterApe);
  return n > 0.5;
}

module.exports = {
  FINAL_CONTRACT_AFTER_APE_SHORT_LABEL,
  FINAL_CONTRACT_AFTER_APE_FULL_LABEL,
  FINAL_CONTRACT_AFTER_APE_EXPLANATION,
  resolveFinalContractAmountAfterApe,
  extractFinalContractAmountFieldsFromSubproject,
  cardShowsFinalContractAmountInPresentation,
};

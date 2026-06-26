/**
 * Μεταφορά δεδομένων ΚΗΜΔΗΣ όταν αλλάζει η μορφή υλοποίησης (Μια ↔ Πολλές).
 */

const CONTRACT_SCOPED_FIELDS = new Set(['contractAmount', 'contractDate', 'contractEndDate']);

function remapReviewKey(key, fromSuffix, toSuffix) {
  if (!key || typeof key !== 'string') return key;
  const suffix = `::${fromSuffix}`;
  if (key.endsWith(suffix)) {
    return `${key.slice(0, -suffix.length)}::${toSuffix}`;
  }
  return key;
}

function rekeyReviewResolutions(review, fromSuffix, toSuffix) {
  if (!review?.resolutions) return review;
  const resolutions = {};
  Object.entries(review.resolutions).forEach(([key, val]) => {
    resolutions[remapReviewKey(key, fromSuffix, toSuffix)] = val;
  });
  const acknowledgedFieldIds = (review.acknowledgedFieldIds || []).map(
    (k) => remapReviewKey(k, fromSuffix, toSuffix)
  );
  return { ...review, resolutions, acknowledgedFieldIds };
}

/** Μεταφορά fieldOverrides κατά αλλαγή μορφής: Single→Multi */
function remapOverridesSingleToMulti(fieldOverrides) {
  if (!fieldOverrides || typeof fieldOverrides !== 'object') return fieldOverrides;
  const out = { ...fieldOverrides };
  if (Object.prototype.hasOwnProperty.call(out, 'contractDate')) {
    out['contract:0:date'] = out.contractDate;
    delete out.contractDate;
  }
  if (Object.prototype.hasOwnProperty.call(out, 'contractAmount')) {
    out['contract:0:amount'] = out.contractAmount;
    delete out.contractAmount;
  }
  if (Object.prototype.hasOwnProperty.call(out, 'contractEndDate')) {
    out['contract:0:contractEndDate'] = out.contractEndDate;
    delete out.contractEndDate;
  }
  return out;
}

/** Μεταφορά fieldOverrides κατά αλλαγή μορφής: Multi→Single */
function remapOverridesMultiToSingle(fieldOverrides) {
  if (!fieldOverrides || typeof fieldOverrides !== 'object') return fieldOverrides;
  const out = { ...fieldOverrides };
  if (Object.prototype.hasOwnProperty.call(out, 'contract:0:date')) {
    out.contractDate = out['contract:0:date'];
    delete out['contract:0:date'];
  }
  if (Object.prototype.hasOwnProperty.call(out, 'contract:0:amount')) {
    out.contractAmount = out['contract:0:amount'];
    delete out['contract:0:amount'];
  }
  if (Object.prototype.hasOwnProperty.call(out, 'contract:0:contractEndDate')) {
    out.contractEndDate = out['contract:0:contractEndDate'];
    delete out['contract:0:contractEndDate'];
  }
  // Αφαίρεση τυχόν overrides γραμμών 1..N που δεν μεταφέρονται
  Object.keys(out).forEach((k) => {
    if (/^contract:[1-9]\d*:/.test(k)) delete out[k];
  });
  return out;
}

/** Μια σύμβαση → Πολλές: στοιχεία αναφοράς/αλυσίδας στην 1η γραμμή */
export function migrateKhmdhsSingleToMultiForm(prev) {
  const next = { ...prev };
  const history = Array.isArray(prev.khmdhsContractChainHistory) ? prev.khmdhsContractChainHistory : [];
  const amendments = Array.isArray(prev.khmdhsContractAmendments) ? prev.khmdhsContractAmendments : [];
  const contracts = [...(prev.contracts || [])];

  if (contracts.length === 0) {
    contracts.push({
      date: prev.contractDate || '',
      amount: prev.contractAmount || '',
      apeAmount: prev.apeAmount || '',
      comments: prev.apeComments || '',
      contractEndDate: prev.contractEndDate || '',
      khmdhsAdam: prev.khmdhsAdam || prev.khmdhsChainSeedAdam || '',
      khmdhsContractSnapshot: prev.khmdhsContractSnapshot || null,
      khmdhsContractFetchedAt: prev.khmdhsContractFetchedAt || '',
      khmdhsContractAmendments: amendments,
      khmdhsContractChainHistory: history,
    });
  } else {
    // Γραμμή ήδη υπάρχει — ξεκινάμε από αυτή και συμπληρώνουμε μόνο τα πεδία που λείπουν
    contracts[0] = {
      ...contracts[0],
      date: contracts[0].date || prev.contractDate || '',
      amount: contracts[0].amount || prev.contractAmount || '',
      apeAmount: contracts[0].apeAmount || prev.apeAmount || '',
      comments: contracts[0].comments || prev.apeComments || '',
      contractEndDate: contracts[0].contractEndDate || prev.contractEndDate || '',
      khmdhsAdam: contracts[0].khmdhsAdam || prev.khmdhsAdam || prev.khmdhsChainSeedAdam || '',
      khmdhsContractSnapshot: contracts[0].khmdhsContractSnapshot || prev.khmdhsContractSnapshot || null,
      khmdhsContractFetchedAt: contracts[0].khmdhsContractFetchedAt || prev.khmdhsContractFetchedAt || '',
      khmdhsContractAmendments: contracts[0].khmdhsContractAmendments?.length
        ? contracts[0].khmdhsContractAmendments
        : amendments,
      khmdhsContractChainHistory: contracts[0].khmdhsContractChainHistory?.length
        ? contracts[0].khmdhsContractChainHistory
        : history,
    };
  }

  next.contracts = contracts;

  if (prev.khmdhsDataQualityReview) {
    const items = (prev.khmdhsDataQualityReview.items || []).map((item) => {
      if (item.contractIndex != null) return item;
      if (CONTRACT_SCOPED_FIELDS.has(item.fieldId)) {
        return { ...item, contractIndex: 0 };
      }
      return item;
    });
    let review = { ...prev.khmdhsDataQualityReview, items };
    review = rekeyReviewResolutions(review, 'shared', '0');
    next.khmdhsDataQualityReview = review;
  }

  next.khmdhsContractChainHistory = [];
  next.khmdhsContractAmendments = [];

  if (next.khmdhsUserEdits?.fieldOverrides) {
    next.khmdhsUserEdits = {
      ...next.khmdhsUserEdits,
      fieldOverrides: remapOverridesSingleToMulti(next.khmdhsUserEdits.fieldOverrides),
    };
  }

  return next;
}

/** Πολλές → Μια: 1η γραμμή → επίπεδο έργου */
export function migrateKhmdhsMultiToSingleForm(prev) {
  const next = { ...prev };
  const first = prev.contracts?.[0];
  if (first) {
    next.contractDate = first.date || '';
    next.contractAmount = first.amount || '';
    next.contractEndDate = first.contractEndDate || prev.contractEndDate || '';
    next.apeAmount = first.apeAmount || '';
    next.apeComments = first.comments || '';
    next.khmdhsAdam = first.khmdhsAdam || '';
    next.khmdhsContractSnapshot = first.khmdhsContractSnapshot || null;
    next.khmdhsContractFetchedAt = first.khmdhsContractFetchedAt || '';
    next.khmdhsChainSeedAdam = first.khmdhsAdam || prev.khmdhsChainSeedAdam || '';
    next.khmdhsContractAmendments = Array.isArray(first.khmdhsContractAmendments)
      ? first.khmdhsContractAmendments
      : [];
    next.khmdhsContractChainHistory = Array.isArray(first.khmdhsContractChainHistory)
      ? first.khmdhsContractChainHistory
      : [];
  }
  next.contracts = [];

  if (prev.khmdhsDataQualityReview) {
    const items = (prev.khmdhsDataQualityReview.items || [])
      .filter((item) => item.contractIndex == null || item.contractIndex === 0)
      .map((item) => {
        if (item.contractIndex === 0 && CONTRACT_SCOPED_FIELDS.has(item.fieldId)) {
          const { contractIndex, ...rest } = item;
          return rest;
        }
        return item;
      });
    let review = { ...prev.khmdhsDataQualityReview, items };
    review = rekeyReviewResolutions(review, '0', 'shared');
    next.khmdhsDataQualityReview = review;
  }

  if (next.khmdhsUserEdits?.fieldOverrides) {
    next.khmdhsUserEdits = {
      ...next.khmdhsUserEdits,
      fieldOverrides: remapOverridesMultiToSingle(next.khmdhsUserEdits.fieldOverrides),
    };
  }

  return next;
}

export function reviewItemKeyForMigration(item) {
  if (!item?.fieldId) return '';
  if (item.chainAdam) return `${item.fieldId}::${item.chainAdam}`;
  if (item.supplementaryIndex != null) return `${item.fieldId}::supp::${item.supplementaryIndex}`;
  const idx = item.contractIndex != null ? String(item.contractIndex) : 'shared';
  return `${item.fieldId}::${idx}`;
}

/** Αφαίρεση γραμμής σύμβασης — καθαρισμός αναφοράς & συμπληρωματικών */
export function purgeKhmdhsDataAfterContractRemoval(form, removedIndex) {
  const idx = Number(removedIndex);
  if (!Number.isFinite(idx) || idx < 0) return form;

  const removedRow = form.contracts?.[idx];
  const removedAdams = new Set(
    [
      removedRow?.khmdhsAdam,
      ...(removedRow?.khmdhsContractChainHistory || []).map((h) => h?.adam),
    ]
      .map((a) => String(a || '').trim().toUpperCase().replace(/\*+$/, ''))
      .filter(Boolean)
  );

  let next = { ...form };

  next.supplementaryContracts = (next.supplementaryContracts || [])
    .filter((c) => c?.sourceContractIndex !== idx)
    .map((c) => {
      if (c?.sourceContractIndex != null && c.sourceContractIndex > idx) {
        return { ...c, sourceContractIndex: c.sourceContractIndex - 1 };
      }
      return c;
    });

  if (next.khmdhsDataQualityReview) {
    const items = (next.khmdhsDataQualityReview.items || [])
      .filter((item) => item.contractIndex !== idx)
      .filter((item) => !item.chainAdam || !removedAdams.has(
        String(item.chainAdam).trim().toUpperCase().replace(/\*+$/, '')
      ))
      .map((item) => {
        if (item.contractIndex != null && item.contractIndex > idx) {
          return { ...item, contractIndex: item.contractIndex - 1 };
        }
        return item;
      });

    const remapKey = (key) => {
      if (!key || typeof key !== 'string') return key;
      const m = /^(.+)::(\d+)$/.exec(key);
      if (!m) return key;
      const n = Number(m[2]);
      if (!Number.isFinite(n)) return key;
      if (n === idx) return null;
      if (n > idx) return `${m[1]}::${n - 1}`;
      return key;
    };

    const resolutions = {};
    Object.entries(next.khmdhsDataQualityReview.resolutions || {}).forEach(([key, val]) => {
      const nk = remapKey(key);
      if (nk) resolutions[nk] = val;
    });

    next.khmdhsDataQualityReview = {
      ...next.khmdhsDataQualityReview,
      items,
      resolutions,
      acknowledgedFieldIds: (next.khmdhsDataQualityReview.acknowledgedFieldIds || [])
        .map(remapKey)
        .filter(Boolean),
    };
  }

  return next;
}

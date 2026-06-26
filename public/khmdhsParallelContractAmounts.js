/**
 * Εκτίμηση ποσού ανά παράλληλη σύμβαση — από εντάλματα πληρωμής (κύρια πηγή).
 */

function normalizeAdamRef(value) {
  const t = String(value || '').trim().toUpperCase().replace(/\*+$/, '').replace(/\s+/g, '');
  return /^(\d{2})([A-Z]{3,4})(\d{9})$/i.test(t) ? t : '';
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function formatAmountEl(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sumPaymentsForContract(payments, contractAdam) {
  const target = normalizeAdamRef(contractAdam);
  if (!target) return null;

  let gross = 0;
  let net = 0;
  let count = 0;
  let hasNet = false;

  (payments || []).forEach((p) => {
    const snap = p?.snapshot;
    if (!snap || snap.cancelled) return;
    const ref = normalizeAdamRef(snap.contractRefNo);
    if (ref !== target) return;

    const g = Number(snap.totalCostWithVAT);
    const n = Number(snap.totalCostWithoutVAT);
    if (Number.isFinite(g)) {
      gross += g;
      count += 1;
    }
    if (Number.isFinite(n)) {
      net += n;
      hasNet = true;
    }
  });

  if (count === 0) return null;

  return {
    gross: roundMoney(gross),
    net: hasNet ? roundMoney(net) : null,
    paymentCount: count,
    source: 'payments',
    sourceLabel: count > 1
      ? `άθροισμα ${count} ενταλμάτων πληρωμής στο ΚΗΜΔΗΣ`
      : 'ένταλμα πληρωμής στο ΚΗΜΔΗΣ',
    confidence: 'high',
  };
}

/**
 * @param {{ siblingAdams: string[], payments: object[], contractRecordsByAdam?: Map }} params
 * @returns {Record<string, object>}
 */
function buildParallelContractAmountHints({
  siblingAdams = [],
  payments = [],
} = {}) {
  const hints = {};
  (siblingAdams || []).forEach((adam) => {
    const norm = normalizeAdamRef(adam);
    if (!norm) return;
    const fromPay = sumPaymentsForContract(payments, norm);
    if (fromPay) {
      hints[norm] = {
        ...fromPay,
        displayValue: formatAmountEl(fromPay.gross),
      };
    }
  });
  return hints;
}

function allSiblingsHaveAmountHints(siblingAdams, hints) {
  const list = (siblingAdams || []).map(normalizeAdamRef).filter(Boolean);
  if (list.length < 2) return false;
  return list.every((adam) => {
    const h = hints?.[adam];
    return h && Number.isFinite(Number(h.gross)) && Number(h.gross) > 0;
  });
}

/** Εμπλουτισμός εγγραφής σύμβασης με εκτιμώμενο ποσό (χωρίς να αντικαθιστά contractBudget). */
function enrichContractRecordWithParallelHint(record, adam, hints) {
  if (!record || !hints) return record;
  const norm = normalizeAdamRef(adam);
  const hint = norm ? hints[norm] : null;
  if (!hint?.gross) return record;
  if (record.contractBudget != null && record.contractBudget !== '' && Number.isFinite(Number(record.contractBudget))) {
    return record;
  }
  return {
    ...record,
    resolvedContractAmount: hint.gross,
    contractAmountSource: hint.sourceLabel,
    parallelAmountInferred: true,
    contractBudgetSuppressed: false,
  };
}

module.exports = {
  normalizeAdamRef,
  formatAmountEl,
  sumPaymentsForContract,
  buildParallelContractAmountHints,
  allSiblingsHaveAmountHints,
  enrichContractRecordWithParallelHint,
};

/**
 * Μετατροπή ποσών ΚΗΜΔΗΣ σε τιμές με ΦΠΑ 24%.
 * Τα πεδία withoutVAT / contractBudget στο ΚΗΜΔΗΣ είναι καθαρές αξίες.
 */

const KHMDHS_VAT_RATE = 0.24;
const KHMDHS_VAT_MULTIPLIER = 1 + KHMDHS_VAT_RATE;

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function isFiniteAmount(value) {
  if (value == null || value === '') return false;
  return Number.isFinite(Number(value));
}

/** Συντελεστής ΦΠΑ από καθαρό/με ΦΠΑ (π.χ. 0,13 για 13%) */
function inferKhmdhsVatRate(withoutVAT, withVAT) {
  const net = Number(withoutVAT);
  const gross = Number(withVAT);
  if (!Number.isFinite(net) || !Number.isFinite(gross) || net <= 0 || gross <= 0) return null;
  const ratio = gross / net;
  if (ratio < 1.001 || ratio > 1.30) return null;
  return Math.round((ratio - 1) * 10000) / 10000;
}

function isStandardKhmdhsVatRate(rate) {
  if (rate == null) return true;
  return Math.abs(rate - KHMDHS_VAT_RATE) < 0.005;
}

function formatKhmdhsVatRatePercent(rate) {
  if (rate == null) return '';
  return `${(rate * 100).toLocaleString('el-GR', { maximumFractionDigits: 1 })}%`;
}

/** Καθαρό ποσό → με ΦΠΑ 24% */
function applyKhmdhsVat24(netAmount) {
  if (!isFiniteAmount(netAmount)) return null;
  return roundMoney(Number(netAmount) * KHMDHS_VAT_MULTIPLIER);
}

function applyKhmdhsVat(netAmount, vatRate = KHMDHS_VAT_RATE) {
  if (!isFiniteAmount(netAmount)) return null;
  const rate = Number.isFinite(Number(vatRate)) ? Number(vatRate) : KHMDHS_VAT_RATE;
  return roundMoney(Number(netAmount) * (1 + rate));
}

/**
 * Επιλογή ποσού με ΦΠΑ από πεδία snapshot.
 * Το totalCostWithVAT του ΚΗΜΔΗΣ συχνά ισούται με το καθαρό — εφαρμόζουμε ×1,24
 * εκτός αν το withVAT είναι σαφώς μεγαλύτερο από το καθαρό (π.χ. μειωμένοι συντελεστές).
 */
function resolveKhmdhsGrossAmountDetailed({ withVAT, withoutVAT, fallbackAmount } = {}) {
  const net = isFiniteAmount(withoutVAT)
    ? Number(withoutVAT)
    : (isFiniteAmount(fallbackAmount) ? Number(fallbackAmount) : null);

  if (isFiniteAmount(withVAT) && Number(withVAT) > 0 && net != null) {
    const gross = Number(withVAT);
    if (gross > net * 1.001) {
      const inferred = inferKhmdhsVatRate(net, gross);
      return {
        amount: roundMoney(gross),
        vatRate: inferred,
        vatFromKhmdhs: true,
      };
    }
  } else if (isFiniteAmount(withVAT) && Number(withVAT) > 0 && net == null) {
    return {
      amount: roundMoney(Number(withVAT)),
      vatRate: null,
      vatFromKhmdhs: true,
    };
  }

  if (net != null) {
    return {
      amount: applyKhmdhsVat24(net),
      vatRate: KHMDHS_VAT_RATE,
      vatFromKhmdhs: false,
    };
  }
  return { amount: null, vatRate: null, vatFromKhmdhs: false };
}

function resolveKhmdhsGrossAmount(opts = {}) {
  return resolveKhmdhsGrossAmountDetailed(opts).amount;
}

/** Αίτημα / διαγωνισμός / ανάθεση */
function grossFromCostSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  return resolveKhmdhsGrossAmount({
    withVAT: snapshot.totalCostWithVAT,
    withoutVAT: snapshot.totalCostWithoutVAT,
    fallbackAmount: snapshot.auctionAmount ?? snapshot.budget,
  });
}

/** Ποσό σύμβασης SYMV (contractBudget = καθαρή αξία στο ΚΗΜΔΗΣ) */
function grossFromContractBudget(budget, vatRate = KHMDHS_VAT_RATE) {
  return applyKhmdhsVat(budget, vatRate);
}

/** Για εμφάνιση: αν είναι ήδη resolved (με ΦΠΑ) ή raw budget */
function grossFromContractRecord(record) {
  if (!record || typeof record !== 'object') return null;
  if (record.resolvedContractAmount != null && record.resolvedContractAmountGross !== false) {
    return roundMoney(Number(record.resolvedContractAmount));
  }
  if (isFiniteAmount(record.resolvedContractAmount)) {
    return roundMoney(Number(record.resolvedContractAmount));
  }
  // Παράλληλη σύμβαση: το contractBudget είναι αναξιόπιστο — επιστρέφουμε null
  if (record.contractBudgetSuppressed) return null;
  return grossFromContractBudget(record.contractBudget);
}

module.exports = {
  KHMDHS_VAT_RATE,
  KHMDHS_VAT_MULTIPLIER,
  applyKhmdhsVat24,
  applyKhmdhsVat,
  inferKhmdhsVatRate,
  isStandardKhmdhsVatRate,
  formatKhmdhsVatRatePercent,
  resolveKhmdhsGrossAmount,
  resolveKhmdhsGrossAmountDetailed,
  grossFromCostSnapshot,
  grossFromContractBudget,
  grossFromContractRecord,
};

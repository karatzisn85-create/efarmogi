/** Μετατροπή ποσών ΚΗΜΔΗΣ σε τιμές με ΦΠΑ 24% (renderer) */

export const KHMDHS_VAT_RATE = 0.24;
export const KHMDHS_VAT_MULTIPLIER = 1 + KHMDHS_VAT_RATE;

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function isFiniteAmount(value) {
  if (value == null || value === '') return false;
  return Number.isFinite(Number(value));
}

export function inferKhmdhsVatRate(withoutVAT, withVAT) {
  const net = Number(withoutVAT);
  const gross = Number(withVAT);
  if (!Number.isFinite(net) || !Number.isFinite(gross) || net <= 0 || gross <= 0) return null;
  const ratio = gross / net;
  if (ratio < 1.001 || ratio > 1.30) return null;
  return Math.round((ratio - 1) * 10000) / 10000;
}

export function isStandardKhmdhsVatRate(rate) {
  if (rate == null) return true;
  return Math.abs(rate - KHMDHS_VAT_RATE) < 0.005;
}

export function formatKhmdhsVatRatePercent(rate) {
  if (rate == null) return '';
  return `${(rate * 100).toLocaleString('el-GR', { maximumFractionDigits: 1 })}%`;
}

export function applyKhmdhsVat24(netAmount) {
  if (!isFiniteAmount(netAmount)) return null;
  return roundMoney(Number(netAmount) * KHMDHS_VAT_MULTIPLIER);
}

export function resolveKhmdhsGrossAmountDetailed({ withVAT, withoutVAT, fallbackAmount } = {}) {
  const net = isFiniteAmount(withoutVAT)
    ? Number(withoutVAT)
    : (isFiniteAmount(fallbackAmount) ? Number(fallbackAmount) : null);

  if (isFiniteAmount(withVAT) && Number(withVAT) > 0 && net != null) {
    const gross = Number(withVAT);
    if (gross > net * 1.001) {
      return {
        amount: roundMoney(gross),
        vatRate: inferKhmdhsVatRate(net, gross),
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

export function resolveKhmdhsGrossAmount(opts = {}) {
  return resolveKhmdhsGrossAmountDetailed(opts).amount;
}

export function grossFromCostSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  return resolveKhmdhsGrossAmount({
    withVAT: snapshot.totalCostWithVAT,
    withoutVAT: snapshot.totalCostWithoutVAT,
    fallbackAmount: snapshot.auctionAmount ?? snapshot.budget,
  });
}

export function grossFromContractBudget(budget, vatRate = KHMDHS_VAT_RATE) {
  if (!isFiniteAmount(budget)) return null;
  const rate = Number.isFinite(Number(vatRate)) ? Number(vatRate) : KHMDHS_VAT_RATE;
  return roundMoney(Number(budget) * (1 + rate));
}

export function grossFromContractRecord(record) {
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

export function formatKhmdhsGrossEuro(amount) {
  const gross = isFiniteAmount(amount) ? roundMoney(Number(amount)) : null;
  if (gross == null) return '';
  return `${gross.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € (με ΦΠΑ)`;
}

/** Ποσό με ΦΠΑ από snapshot αίτησης/διαγωνισμού/ανάθεσης — μορφοποιημένο */
export function formatKhmdhsCostSnapshotGross(snapshot) {
  const gross = grossFromCostSnapshot(snapshot);
  if (gross == null) return '';
  return `${gross.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

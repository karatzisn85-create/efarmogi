/**
 * Υπολογισμός παραγώγων αλυσίδας ΚΗΜΔΗΣ (main process) — ευθυγραμμισμένο με renderer khmdhsChainActions.
 */
const CHAIN_KIND = {
  CONTRACT: 'contract',
  MODIFICATION: 'modification',
  EXTENSION: 'extension',
  REPUBLICATION: 'republication',
  OTHER: 'other',
  UNCERTAIN: 'uncertain',
};

const MOD_AMOUNT_TYPE = {
  DELTA: 'delta',
  TOTAL: 'total',
};

const CORRECTS_PART = {
  TITLE: 'title',
  AMOUNT: 'amount',
  DATE: 'date',
};

function parseGreekAmountString(val) {
  if (!val) return 0;
  const cleaned = String(val).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function normalizeAdamForKey(adam) {
  return String(adam || '').trim().toUpperCase().replace(/\*+$/, '');
}

function chainKindKey(adam) {
  return `chainKindReview::${normalizeAdamForKey(adam)}`;
}

function formatAmountString(n) {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return Number(n).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getChainKindChoice(review, adam) {
  const res = review?.resolutions?.[chainKindKey(adam)];
  if (!res) return null;
  const meta = res.meta || {};
  return {
    kind: res.value || null,
    correctsAdam: meta.correctsAdam || null,
    correctsParts: Array.isArray(meta.correctsParts) ? meta.correctsParts : [],
    modAmountType: meta.modAmountType || null,
    modAmount: meta.modAmount || '',
    modDate: meta.modDate || '',
    endDate: meta.endDate || '',
  };
}

function getEffectiveChainKind(h, review) {
  if (!h) return CHAIN_KIND.UNCERTAIN;
  if (h.isRoot) return CHAIN_KIND.CONTRACT;
  const choice = getChainKindChoice(review, h.adam);
  if (choice?.kind) return choice.kind;
  if (h.suggestedKind === undefined && h.confidence === undefined
    && h.kind && h.kind !== CHAIN_KIND.UNCERTAIN) {
    return h.kind;
  }
  return CHAIN_KIND.UNCERTAIN;
}

function computeChainCharacterizationEffects(chainHistory, review) {
  const list = Array.isArray(chainHistory) ? [...chainHistory] : [];
  list.sort((a, b) => (a.order || 0) - (b.order || 0));

  const root = list.find((h) => h.isRoot) || list[0] || null;

  let baseAmount = root ? parseGreekAmountString(root.contractAmount) : 0;
  let contractDate = root ? (root.contractDate || '') : '';
  let contractDeadline = root ? (root.endDate || '') : '';

  const corrections = new Map();
  list.forEach((h) => {
    if (h.isRoot) return;
    if (getEffectiveChainKind(h, review) !== CHAIN_KIND.REPUBLICATION) return;
    const choice = getChainKindChoice(review, h.adam);
    const target = choice?.correctsAdam || h.prevAdam || (root ? root.adam : null);
    if (!target) return;
    const parts = choice?.correctsParts?.length ? choice.correctsParts : [];
    const entry = corrections.get(target) || {};
    if (parts.includes(CORRECTS_PART.AMOUNT) || (!parts.length && h.contractAmount)) {
      const amt = parseGreekAmountString(h.contractAmount);
      if (amt) entry.amount = amt;
    }
    if (parts.includes(CORRECTS_PART.DATE) || (!parts.length && (h.contractDate || h.endDate))) {
      if (h.contractDate) entry.date = h.contractDate;
      if (h.endDate) entry.end = h.endDate;
    }
    if (parts.includes(CORRECTS_PART.TITLE) || !parts.length) {
      entry.title = h.title || (h.snapshot && h.snapshot.title) || entry.title;
    }
    corrections.set(target, entry);
  });

  if (root && corrections.has(root.adam)) {
    const c = corrections.get(root.adam);
    if (c.amount != null) baseAmount = c.amount;
    if (c.date) contractDate = c.date;
    if (c.end) contractDeadline = c.end;
  }

  const supplementaryContracts = [];
  const perAct = [];
  let runningTotal = baseAmount;
  let hasUncertain = false;

  list.forEach((h) => {
    const kind = getEffectiveChainKind(h, review);
    if (h.isRoot) {
      perAct.push({ adam: h.adam, kind: CHAIN_KIND.CONTRACT, effect: 'base' });
      return;
    }
    const choice = getChainKindChoice(review, h.adam);

    if (kind === CHAIN_KIND.EXTENSION) {
      const endIso = (choice?.endDate || h.endDate || '').slice(0, 10);
      if (endIso && (!contractDeadline || endIso > String(contractDeadline).slice(0, 10))) {
        contractDeadline = endIso;
      }
      perAct.push({ adam: h.adam, kind, effect: 'deadline', endDate: endIso });
      return;
    }

    if (kind === CHAIN_KIND.MODIFICATION) {
      const corrected = corrections.get(h.adam);
      const fromUser = parseGreekAmountString(choice?.modAmount);
      const fromKhmdhs = parseGreekAmountString(h.contractAmount);
      const rawAmount = corrected?.amount != null ? corrected.amount : (fromUser || fromKhmdhs);
      let delta = rawAmount;
      let amountType = choice?.modAmountType || null;
      if (!amountType && rawAmount && runningTotal > 0 && rawAmount >= runningTotal * 0.9) {
        amountType = MOD_AMOUNT_TYPE.TOTAL;
      }
      if (!amountType) amountType = MOD_AMOUNT_TYPE.DELTA;
      if (amountType === MOD_AMOUNT_TYPE.TOTAL && rawAmount) {
        delta = rawAmount - runningTotal;
      }
      runningTotal += delta;
      supplementaryContracts.push({
        date: choice?.modDate || h.contractDate || '',
        amount: delta ? formatAmountString(delta) : '',
        khmdhsAdam: h.adam,
      });
      perAct.push({ adam: h.adam, kind, effect: 'supplementary', delta });
      return;
    }

    if (kind === CHAIN_KIND.REPUBLICATION) {
      perAct.push({ adam: h.adam, kind, effect: 'correction' });
      return;
    }

    if (kind === CHAIN_KIND.UNCERTAIN) hasUncertain = true;
    perAct.push({ adam: h.adam, kind, effect: 'none' });
  });

  return {
    contractAmount: baseAmount ? formatAmountString(baseAmount) : (root?.contractAmount || ''),
    contractDate,
    contractDeadline,
    supplementaryContracts,
    perAct,
    hasUncertain,
  };
}

module.exports = {
  computeChainCharacterizationEffects,
};

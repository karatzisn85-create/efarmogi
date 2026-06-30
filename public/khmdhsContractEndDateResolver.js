/**
 * Ημερομηνία λήξης σύμβασης (main process) — ευθυγραμμισμένο με renderer procurementCalendarEvents.
 */
const {
  computeChainCharacterizationEffects,
  getChainKindChoice,
  getEffectiveChainKind,
  CHAIN_KIND,
} = require('./khmdhsChainCharacterizationEffects');

const MULTIPLE_CONTRACTS_FORM = 'Πολλές Συμβάσεις';
const SYMV_EXTENSION_ROLE = 'extension';

function toIsoDateOnly(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmySlash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (dmySlash) {
    return `${dmySlash[3]}-${dmySlash[2]}-${dmySlash[1]}`;
  }
  const dmyDash = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (dmyDash) {
    return `${dmyDash[3]}-${dmyDash[2]}-${dmyDash[1]}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pickLatestIsoDate(...values) {
  const normalized = values.map((v) => toIsoDateOnly(v)).filter(Boolean);
  if (!normalized.length) return null;
  return normalized.sort().reverse()[0];
}

function isMultipleContractsForm(form) {
  return form === MULTIPLE_CONTRACTS_FORM;
}

function getAllChainHistories(project) {
  if (!project) return [];
  if (!isMultipleContractsForm(project.implementationForm)) {
    const history = Array.isArray(project.khmdhsContractChainHistory)
      ? project.khmdhsContractChainHistory
      : [];
    return history.length ? [{ history }] : [];
  }
  return (project.contracts || [])
    .map((row) => ({
      history: Array.isArray(row?.khmdhsContractChainHistory) ? row.khmdhsContractChainHistory : [],
    }))
    .filter(({ history }) => history.length > 0);
}

function collectExtensionEndDatesFromSupplementary(project, review) {
  const contracts = Array.isArray(project?.supplementaryContracts)
    ? project.supplementaryContracts
    : [];
  const dates = [];
  contracts.forEach((row) => {
    const adam = String(row?.khmdhsAdam || '').trim().toUpperCase();
    const choice = adam ? getChainKindChoice(review, adam) : null;
    const isExtension = choice?.kind === CHAIN_KIND.EXTENSION
      || String(row?.comments || '').trim() === 'Παράταση';
    if (!isExtension) return;
    const d = toIsoDateOnly(row?.date || choice?.endDate || '');
    if (d) dates.push(d);
  });
  return dates;
}

function collectAllExtensionEndIsos(project, contract = null) {
  if (!project) return [];
  const review = project.khmdhsDataQualityReview || null;
  const dates = [];

  const historyBundles = contract
    ? [{ history: contract.khmdhsContractChainHistory || [] }]
    : getAllChainHistories(project);

  historyBundles.forEach(({ history }) => {
    (history || []).forEach((h) => {
      if (h?.isRoot) return;
      if (getEffectiveChainKind(h, review) !== CHAIN_KIND.EXTENSION) return;
      const adam = String(h?.adam || '').trim().toUpperCase();
      const choice = adam ? getChainKindChoice(review, adam) : null;
      const d = toIsoDateOnly(choice?.endDate || h?.endDate || '');
      if (d) dates.push(d);
    });
  });

  dates.push(...collectExtensionEndDatesFromSupplementary(project, review));

  (project?.khmdhsSymvChainPlan?.items || []).forEach((item) => {
    if (item?.role !== SYMV_EXTENSION_ROLE) return;
    const d = toIsoDateOnly(item?.date || '');
    if (d) dates.push(d);
  });

  return [...new Set(dates)];
}

function collectLastExtensionEndIso(chainHistory, review) {
  let last = '';
  (chainHistory || []).forEach((h) => {
    if (h?.isRoot) return;
    if (getEffectiveChainKind(h, review) !== CHAIN_KIND.EXTENSION) return;
    const end = toIsoDateOnly(getChainKindChoice(review, h.adam)?.endDate || h.endDate);
    if (end && (!last || end > last)) last = end;
  });
  return last;
}

function resolveContractEndDateIso(project, contract = null) {
  if (!project) return null;
  const review = project.khmdhsDataQualityReview || null;
  const chainHistory = contract
    ? (contract.khmdhsContractChainHistory || [])
    : (project.khmdhsContractChainHistory || []);
  const effects = chainHistory.length
    ? computeChainCharacterizationEffects(chainHistory, review)
    : null;
  const snap = contract?.khmdhsContractSnapshot || project.khmdhsContractSnapshot;
  const fromSnap = snap?.noEndDate ? '' : (snap?.endDate || '');
  const allExtensionEnds = collectAllExtensionEndIsos(project, contract);

  const storedEnd = contract
    ? toIsoDateOnly(contract.contractEndDate)
    : toIsoDateOnly(project.contractEndDate);

  if (allExtensionEnds.length > 0) {
    return pickLatestIsoDate(
      storedEnd,
      effects?.contractDeadline,
      fromSnap,
      ...allExtensionEnds,
    );
  }

  const lastExtensionEnd = collectLastExtensionEndIso(chainHistory, review);

  if (contract) {
    return storedEnd
      || toIsoDateOnly(fromSnap)
      || toIsoDateOnly(effects?.contractDeadline)
      || lastExtensionEnd
      || null;
  }
  return storedEnd
    || toIsoDateOnly(effects?.contractDeadline)
    || toIsoDateOnly(fromSnap)
    || lastExtensionEnd
    || null;
}

module.exports = {
  resolveContractEndDateIso,
  toIsoDateOnly,
};

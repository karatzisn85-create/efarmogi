/**
 * Βοηθητικά για παράλληλες συμβάσεις (ποσά, γραμμές).
 * Η κατανομή ρόλων SYMV (κύρια/παράλληλη/συμπληρωματική) γίνεται αποκλειστικά
 * μέσω KhmdhsSymvChainPlanner → applySymvChainPlanToForm.
 */

import { isMultipleContractsForm, emptyKhmdhsOnContract } from './khmdhsFields';
import { migrateKhmdhsSingleToMultiForm } from './khmdhsImplementationFormMigration';
import { hasFieldOverride } from './khmdhsFieldOverrides';
import { contractRowFieldKey } from './khmdhsChainFormAccess';

import { isSubstantiveContractSymvSnapshot } from './khmdhsSubstantiveContractSymv';

function normalizeAdam(adam) {
  return String(adam || '').trim().toUpperCase().replace(/\*+$/, '').replace(/\s+/g, '');
}

function uniqueAdams(list) {
  return [...new Set((list || []).map(normalizeAdam).filter(Boolean))];
}

/** Όλες οι υποψήφιες παράλληλες SYMV (πριν το φιλτράρισμα συμβάσεων). */
export function resolveParallelContractCandidates(chainRes) {
  if (!chainRes?.success) return [];
  const fromCandidates = uniqueAdams(chainRes.chainMeta?.parallelContractCandidates);
  if (fromCandidates.length > 1) return fromCandidates;

  const fromMeta = uniqueAdams(chainRes.chainMeta?.parallelContracts);
  const snapshots = chainRes.chainMeta?.contractSnapshotsByAdam || {};
  const snapAdams = uniqueAdams(Object.keys(snapshots));
  const awardRefs = uniqueAdams(chainRes.auction?.snapshot?.contractRefNos);
  const merged = uniqueAdams([...fromMeta, ...snapAdams, ...awardRefs]);
  if (merged.length > 1) return merged;

  return fromMeta;
}

/** Αδέλφια SYMV που θεωρούνται πραγματικές συμβάσεις. */
export function resolveParallelContractSiblings(chainRes) {
  if (!chainRes?.success) return [];
  const fromMeta = uniqueAdams(chainRes.chainMeta?.parallelContracts);
  if (fromMeta.length > 1) return fromMeta;

  const candidates = resolveParallelContractCandidates(chainRes);
  const snapshots = chainRes.chainMeta?.contractSnapshotsByAdam || {};
  const substantive = candidates.filter((adam) => {
    const snap = snapshots[adam] || snapshots[normalizeAdam(adam)];
    return isSubstantiveContractSymvSnapshot(snap);
  });
  if (substantive.length > 1) return substantive;

  return fromMeta;
}

function buildParallelContractRow(adam, existing, chainRes) {
  const norm = normalizeAdam(adam);
  const snapshots = chainRes.chainMeta?.contractSnapshotsByAdam || {};
  const snap = snapshots[norm] || snapshots[adam] || null;
  const hints = chainRes.chainMeta?.parallelContractAmountsByAdam || {};
  const hint = hints[norm] || hints[adam];
  const formattedAmount = hint?.displayValue || formatInferredContractAmountGross(hint?.gross);
  const signedDate = snap?.contractSignedDate || snap?.startDate || '';
  const snapEnd = snap?.noEndDate ? '' : String(snap?.endDate || '').slice(0, 10);
  const fetchedAt = chainRes.chainMeta?.resolvedAt || new Date().toISOString();

  const base = existing && typeof existing === 'object'
    ? existing
    : { date: '', amount: '', apeAmount: '', comments: '', ...emptyKhmdhsOnContract() };

  return {
    ...base,
    khmdhsAdam: norm || base.khmdhsAdam || '',
    khmdhsContractSnapshot: snap || base.khmdhsContractSnapshot || null,
    khmdhsContractFetchedAt: snap
      ? (base.khmdhsContractFetchedAt || fetchedAt)
      : base.khmdhsContractFetchedAt,
    date: base.date || (signedDate ? String(signedDate).slice(0, 10) : ''),
    amount: base.amount || formattedAmount || '',
    contractEndDate: base.contractEndDate || snapEnd || '',
    khmdhsInferredAmount: base.khmdhsInferredAmount || formattedAmount || '',
    khmdhsInferredAmountSource: base.khmdhsInferredAmountSource
      || (formattedAmount ? (hint?.sourceLabel || hint?.source || 'payments') : ''),
  };
}

/**
 * Όταν η αλυσίδα έχει 2+ παράλληλες συμβάσεις, ορίζει «Πολλές Συμβάσεις» και γεμίζει όλες τις γραμμές.
 */
export function ensureParallelMultiContractFromChainMeta(form, chainRes, { selectedSiblings = null } = {}) {
  const siblings = uniqueAdams(
    selectedSiblings?.length ? selectedSiblings : resolveParallelContractSiblings(chainRes)
  );
  if (siblings.length < 2) return { form, upgraded: false };

  let next = { ...form };
  let upgraded = false;

  if (!isMultipleContractsForm(next.implementationForm)) {
    next = migrateKhmdhsSingleToMultiForm({ ...next, implementationForm: 'Πολλές Συμβάσεις' });
    upgraded = true;
  }

  const existing = next.contracts || [];
  const usedIndices = new Set();
  const newContracts = siblings.map((adam) => {
    const norm = normalizeAdam(adam);
    const matchedIdx = existing.findIndex((c) => normalizeAdam(c?.khmdhsAdam) === norm);
    if (matchedIdx >= 0) {
      usedIndices.add(matchedIdx);
      const merged = buildParallelContractRow(norm, existing[matchedIdx], chainRes);
      if (
        !existing[matchedIdx]?.khmdhsAdam
        || (!existing[matchedIdx]?.khmdhsContractSnapshot && merged.khmdhsContractSnapshot)
        || (!String(existing[matchedIdx]?.amount || '').trim() && merged.amount)
      ) {
        upgraded = true;
      }
      return merged;
    }
    const fallbackIdx = existing.findIndex(
      (c, i) => !usedIndices.has(i) && !normalizeAdam(c?.khmdhsAdam)
    );
    if (fallbackIdx >= 0) {
      usedIndices.add(fallbackIdx);
      upgraded = true;
      return buildParallelContractRow(norm, { ...existing[fallbackIdx], khmdhsAdam: norm }, chainRes);
    }
    upgraded = true;
    return buildParallelContractRow(norm, null, chainRes);
  });

  next.contracts = newContracts;
  next = applyParallelContractAmountHints(next, chainRes);
  return { form: next, upgraded };
}

export function formatInferredContractAmountGross(gross) {
  const n = Number(gross);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Συμπληρώνει ποσά γραμμών σύμβασης από chainMeta.parallelContractAmountsByAdam.
 * Δεν αντικαθιστά πεδία με ενεργό user override (khmdhsUserEdits).
 */
export function applyParallelContractAmountHints(form, chainRes) {
  const hints = chainRes?.chainMeta?.parallelContractAmountsByAdam;
  const siblings = resolveParallelContractSiblings(chainRes);
  if (!hints || siblings.length < 2 || !isMultipleContractsForm(form?.implementationForm)) {
    return form;
  }

  const contracts = (form.contracts || []).map((row, contractIndex) => {
    const adam = normalizeAdam(row?.khmdhsAdam);
    if (!adam) return row;

    const hint = hints[adam];
    if (!hint?.gross) return row;

    const fieldKey = contractRowFieldKey(contractIndex, 'amount');
    if (hasFieldOverride(form, fieldKey)) return row;

    const formatted = formatInferredContractAmountGross(hint.gross);
    if (!formatted) return row;

    const current = String(row.amount || '').trim();
    return {
      ...row,
      amount: current || formatted,
      khmdhsInferredAmount: formatted,
      khmdhsInferredAmountSource: hint.sourceLabel || hint.source || 'payments',
    };
  });

  return { ...form, contracts };
}

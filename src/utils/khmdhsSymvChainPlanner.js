/**
 * Συλλογή και προεπιλογή ρόλων για όλα τα SYMV της αλυσίδας ΚΗΜΔΗΣ.
 */

import { isSubstantiveContractSymvSnapshot, nonContractSymvReason } from './khmdhsSubstantiveContractSymv';

export const SYMV_CHAIN_ROLE = {
  SKIP: 'skip',
  MAIN: 'main',
  PARALLEL: 'parallel',
  SUPPLEMENTARY: 'supplementary',
  EXTENSION: 'extension',
  INTERMEDIATE: 'intermediate',
};

export const SYMV_CHAIN_ROLE_LABELS = {
  [SYMV_CHAIN_ROLE.SKIP]: '— Δεν καταχωρείται',
  [SYMV_CHAIN_ROLE.MAIN]: 'Κύρια σύμβαση',
  [SYMV_CHAIN_ROLE.PARALLEL]: 'Παράλληλη σύμβαση',
  [SYMV_CHAIN_ROLE.SUPPLEMENTARY]: 'Συμπληρωματική σύμβαση',
  [SYMV_CHAIN_ROLE.EXTENSION]: 'Παράταση / διατήρηση προθεσμίας',
  [SYMV_CHAIN_ROLE.INTERMEDIATE]: 'Ενδιάμεσος κρίκος αλυσίδας',
};

function normalizeAdam(adam) {
  return String(adam || '').trim().toUpperCase().replace(/\*+$/, '').replace(/\s+/g, '');
}

const RE_EXTENSION = /παράταση|παραταση|διατήρηση\s+προθεσμ|διατηρηση\s+προθεσμ/i;
const RE_SUPPLEMENTARY = /συμπληρωματικ/i;

function historyByAdam(chainRes) {
  const map = new Map();
  (chainRes?.contractChainHistory || []).forEach((h) => {
    const adam = normalizeAdam(h?.adam);
    if (adam) map.set(adam, h);
  });
  return map;
}

function signedDateKey(snapshot) {
  return String(snapshot?.contractSignedDate || snapshot?.startDate || '').slice(0, 10);
}

/** Όλα τα SYMV της υπόθεσης — ένωση αλυσίδας, markers, snapshots. */
export function collectSymvChainDocuments(chainRes) {
  if (!chainRes?.success) return [];

  const seen = new Set();
  const add = (adam) => {
    const norm = normalizeAdam(adam);
    if (!norm || !norm.includes('SYMV')) return;
    seen.add(norm);
  };

  (chainRes.chainMeta?.linkedAdams?.contracts || []).forEach(add);
  (chainRes.contractChainHistory || []).forEach((h) => add(h?.adam));
  (chainRes.chainMeta?.parallelContractCandidates || []).forEach(add);
  (chainRes.chainMeta?.parallelContracts || []).forEach(add);
  Object.keys(chainRes.chainMeta?.contractSnapshotsByAdam || {}).forEach(add);
  if (chainRes.contract?.adam) add(chainRes.contract.adam);

  const snapshots = chainRes.chainMeta?.contractSnapshotsByAdam || {};
  const histMap = historyByAdam(chainRes);
  const rootAdam = normalizeAdam(chainRes.chainMeta?.contractRootAdam || chainRes.contract?.adam);

  const docs = [...seen].map((adam) => {
    const snapshot = snapshots[adam] || snapshots[normalizeAdam(adam)] || null;
    const hist = histMap.get(adam) || null;
    const title = String(snapshot?.title || hist?.title || '').trim();
    const contractor = String(snapshot?.anadoxosName || '').trim();
    const signedDate = signedDateKey(snapshot) || String(hist?.contractDate || '').slice(0, 10);
    const hint = chainRes.chainMeta?.parallelContractAmountsByAdam?.[adam];
    const amountHint = hint?.displayValue
      || (hint?.gross != null
        ? Number(hint.gross).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '');
    const budget = snapshot?.contractBudget;
    const amountFromSnap = budget != null && budget !== ''
      ? Number(budget).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '';

    return {
      adam,
      title,
      contractor,
      signedDate,
      snapshot,
      historyLabel: String(hist?.label || '').trim(),
      isChainRoot: adam === rootAdam || !!hist?.isRoot,
      isChainSeed: !!hist?.isSeed,
      nonContractReason: nonContractSymvReason(snapshot || { title }),
      defaultAmount: amountHint || amountFromSnap || '',
      defaultDate: signedDate,
    };
  });

  return docs.sort((a, b) => {
    const da = a.defaultDate || '9999';
    const db = b.defaultDate || '9999';
    if (da !== db) return da.localeCompare(db);
    return a.adam.localeCompare(b.adam);
  });
}

export function inferDefaultSymvRole(doc, chainRes) {
  if (!doc) return SYMV_CHAIN_ROLE.SKIP;

  const title = String(doc.title || doc.historyLabel || '').toUpperCase();
  const isPrimary = doc.isChainRoot
    || doc.isChainSeed
    || normalizeAdam(chainRes?.contract?.adam) === doc.adam;

  if (isPrimary) {
    if (RE_EXTENSION.test(title)) return SYMV_CHAIN_ROLE.EXTENSION;
    if (RE_SUPPLEMENTARY.test(title)) return SYMV_CHAIN_ROLE.SUPPLEMENTARY;
    return SYMV_CHAIN_ROLE.MAIN;
  }

  if (doc.nonContractReason) return SYMV_CHAIN_ROLE.INTERMEDIATE;

  if (RE_EXTENSION.test(title)) return SYMV_CHAIN_ROLE.EXTENSION;
  if (RE_SUPPLEMENTARY.test(title)) return SYMV_CHAIN_ROLE.SUPPLEMENTARY;

  const parallelSet = new Set(
    (chainRes?.chainMeta?.parallelContractCandidates || []).map(normalizeAdam)
  );
  if (parallelSet.has(doc.adam) && isSubstantiveContractSymvSnapshot(doc.snapshot || { title: doc.title })) {
    return SYMV_CHAIN_ROLE.PARALLEL;
  }

  if (doc.historyLabel && !doc.isChainRoot) {
    if (/συμπληρωματικ/i.test(doc.historyLabel)) return SYMV_CHAIN_ROLE.SUPPLEMENTARY;
    if (/παράταση|παραταση/i.test(doc.historyLabel)) return SYMV_CHAIN_ROLE.EXTENSION;
  }

  return SYMV_CHAIN_ROLE.SKIP;
}

export function buildDefaultSymvChainPlan(chainRes) {
  const docs = collectSymvChainDocuments(chainRes);
  let mainAssigned = false;
  const items = docs.map((doc) => {
    let role = inferDefaultSymvRole(doc, chainRes);
    if (role === SYMV_CHAIN_ROLE.MAIN) {
      if (mainAssigned) role = SYMV_CHAIN_ROLE.SKIP;
      else mainAssigned = true;
    }
    if (role === SYMV_CHAIN_ROLE.PARALLEL && !doc.defaultAmount && !doc.contractor) {
      role = SYMV_CHAIN_ROLE.SKIP;
    }
    return {
      adam: doc.adam,
      role,
      date: doc.defaultDate || '',
      amount: role === SYMV_CHAIN_ROLE.SKIP
        || role === SYMV_CHAIN_ROLE.EXTENSION
        || role === SYMV_CHAIN_ROLE.INTERMEDIATE
        ? ''
        : (doc.defaultAmount || ''),
      label: '',
    };
  });
  return { items, createdAt: new Date().toISOString() };
}

export function validateSymvChainPlan(plan) {
  const items = (plan?.items || []).filter((i) => i?.adam && i.role !== SYMV_CHAIN_ROLE.SKIP);
  const mains = items.filter((i) => i.role === SYMV_CHAIN_ROLE.MAIN);
  const parallels = items.filter((i) => i.role === SYMV_CHAIN_ROLE.PARALLEL);
  const contractLike = [...mains, ...parallels];

  if (contractLike.length === 0) {
    return { ok: false, error: 'Επιλέξτε τουλάχιστον μία κύρια ή παράλληλη σύμβαση.' };
  }
  if (mains.length > 1) {
    return { ok: false, error: 'Μόνο μία κύρια σύμβαση επιτρέπεται — οι υπόλοιπες ως παράλληλες ή συμπληρωματικές.' };
  }
  const intermediates = items.filter((i) => i.role === SYMV_CHAIN_ROLE.INTERMEDIATE);
  const missingIntermediateDate = intermediates.find(
    (i) => !String(i.date || '').trim()
  );
  if (missingIntermediateDate) {
    return {
      ok: false,
      error: `Ορίστε ημερομηνία εγγράφου για τον ενδιάμεσο κρίκο ${missingIntermediateDate.adam}.`,
    };
  }
  return { ok: true, contractCount: contractLike.length };
}

export function symvPlanMatchesChain(plan, chainRes) {
  const docs = collectSymvChainDocuments(chainRes);
  if (!docs.length || !plan?.items?.length) return false;
  const docAdams = new Set(docs.map((d) => normalizeAdam(d.adam)));
  const planAdams = new Set(
    (plan.items || []).map((i) => normalizeAdam(i.adam)).filter(Boolean)
  );
  if (docAdams.size !== planAdams.size) return false;
  for (const adam of docAdams) {
    if (!planAdams.has(adam)) return false;
  }
  return true;
}

export function shouldOfferSymvChainPlanner(chainRes) {
  return collectSymvChainDocuments(chainRes).length >= 2;
}

/** Προσαρμοσμένο όνομα ενδιάμεσου κρίκου από σχέδιο κατανομής SYMV. */
export function getSymvPlanCustomLabel(plan, adam) {
  const norm = normalizeAdam(adam);
  if (!norm || !plan?.items?.length) return '';
  const item = plan.items.find((i) => normalizeAdam(i.adam) === norm);
  if (!item || item.role !== SYMV_CHAIN_ROLE.INTERMEDIATE) return '';
  return String(item.label || '').trim();
}

/** Εφαρμογή ονομάτων ενδιάμεσων κρίκων στο ιστορικό (αντί γενικού «Άλλο»). */
export function overlaySymvPlanLabelsOnChainHistory(history, plan) {
  if (!Array.isArray(history) || !plan?.items?.length) return history || [];
  return history.map((h) => {
    const custom = getSymvPlanCustomLabel(plan, h?.adam);
    const item = (plan.items || []).find((i) => normalizeAdam(i.adam) === normalizeAdam(h?.adam));
    if (!item || item.role !== SYMV_CHAIN_ROLE.INTERMEDIATE) return h;
    const label = custom || 'Ενδιάμεσος κρίκος';
    return {
      ...h,
      label,
      effectiveKind: 'other',
      kind: 'other',
      role: 'other',
      kindNote: custom ? `Ενδιάμεσος κρίκος: ${custom}` : (h.kindNote || 'Ενδιάμεσος κρίκος αλυσίδας'),
    };
  });
}

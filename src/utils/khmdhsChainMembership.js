/**
 * Ποιοι κρίκοι ΚΗΜΔΗΣ ανήκουν σε ΑΥΤΗ την κάρτα (αυτό το υποέργο).
 *
 * Ο διαγωνισμός μπορεί να είναι κοινός σε δύο εντάξεις. Η κάρτα κρατά
 * τα κοινά έγγραφα της διαδικασίας και μόνο τις συμβάσεις / κατακυρώσεις /
 * εντάλματα που ο υπάλληλος χαρακτήρισε ως δικά της.
 */

import { isSubstantiveContractSymvSnapshot } from './khmdhsSubstantiveContractSymv';

export const CHAIN_LINK_STAGE = {
  SYMV: 'SYMV',
  AWRD: 'AWRD',
  PAY: 'PAY',
};

/** Ρόλος μη-συμβατικού κρίκου στην κατανομή: ανήκει στην κάρτα. */
export const CHAIN_LINK_KEEP_ROLE = 'keep';

const SKIP_ROLE = 'skip';

export function normalizeChainMembershipAdam(value) {
  return String(value || '').trim().toUpperCase().replace(/\*+$/, '').replace(/\s+/g, '');
}

export function inferChainLinkStageFromAdam(adam) {
  const n = normalizeChainMembershipAdam(adam);
  if (/AWRD/.test(n)) return CHAIN_LINK_STAGE.AWRD;
  if (/PAY/.test(n)) return CHAIN_LINK_STAGE.PAY;
  if (/SYMV/.test(n)) return CHAIN_LINK_STAGE.SYMV;
  if (/PROC/.test(n)) return 'PROC';
  if (/REQ/.test(n)) return 'REQ';
  return '';
}

export function planItemStage(item) {
  const explicit = String(item?.stage || '').trim().toUpperCase();
  if (explicit) return explicit;
  return inferChainLinkStageFromAdam(item?.adam);
}

function planItems(projectOrPlan) {
  const plan = projectOrPlan?.khmdhsSymvChainPlan || projectOrPlan;
  return Array.isArray(plan?.items) ? plan.items : [];
}

export function findChainPlanItem(projectOrPlan, adam) {
  const norm = normalizeChainMembershipAdam(adam);
  if (!norm) return null;
  return planItems(projectOrPlan).find((i) => normalizeChainMembershipAdam(i?.adam) === norm) || null;
}

export function isAdamSkippedInChainPlan(projectOrPlan, adam) {
  return findChainPlanItem(projectOrPlan, adam)?.role === SKIP_ROLE;
}

export function isAdamKeptInChainPlan(projectOrPlan, adam) {
  const item = findChainPlanItem(projectOrPlan, adam);
  if (!item?.role) return false;
  return item.role !== SKIP_ROLE;
}

function cancelledAdamSet(project, chainRes = null) {
  const set = new Set();
  const add = (v) => {
    const n = normalizeChainMembershipAdam(v);
    if (n) set.add(n);
  };
  (project?.khmdhsAdamChainMeta?.confirmedCancelledAdams || []).forEach(add);
  (chainRes?.chainMeta?.confirmedCancelledAdams || []).forEach(add);
  return set;
}

function addAdamsToSet(set, values) {
  (Array.isArray(values) ? values : []).forEach((v) => {
    const n = normalizeChainMembershipAdam(v);
    if (n) set.add(n);
  });
}

function collectGraphContractAdams(project, chainRes = null) {
  const out = new Set();
  const meta = chainRes?.chainMeta || {};
  const pmeta = project?.khmdhsAdamChainMeta || {};
  addAdamsToSet(out, meta.linkedAdams?.contracts);
  addAdamsToSet(out, meta.parallelContracts);
  addAdamsToSet(out, Object.keys(meta.contractSnapshotsByAdam || {}));
  addAdamsToSet(out, chainRes?.contract?.adam ? [chainRes.contract.adam] : []);
  addAdamsToSet(out, pmeta.linkedAdams?.contracts);
  addAdamsToSet(out, pmeta.parallelContracts);
  addAdamsToSet(out, Object.keys(pmeta.contractSnapshotsByAdam || {}));
  return out;
}

function snapshotForGraphSymv(project, chainRes, adam) {
  const n = normalizeChainMembershipAdam(adam);
  if (!n) return null;
  return chainRes?.chainMeta?.contractSnapshotsByAdam?.[n]
    || project?.khmdhsAdamChainMeta?.contractSnapshotsByAdam?.[n]
    || null;
}

function collectParallelContractSet(project, chainRes = null) {
  const out = new Set();
  addAdamsToSet(out, chainRes?.chainMeta?.parallelContracts);
  addAdamsToSet(out, project?.khmdhsAdamChainMeta?.parallelContracts);
  return out;
}

/**
 * Υπάρχει άλλη πραγματική σύμβαση στο γράφημα ΚΗΜΔΗΣ που δεν ανήκει σε αυτή την κάρτα;
 * (άλλο τμήμα / άλλη ένταξη — όχι ακυρωμένη, όχι απόφαση/διακήρυξη με τύπο SYMV)
 */
export function graphHasOtherLotContract(project, chainRes = null) {
  const kept = collectKeptSymvAdams(project);
  const cancelled = cancelledAdamSet(project, chainRes);
  const parallel = collectParallelContractSet(project, chainRes);
  for (const adam of collectGraphContractAdams(project, chainRes)) {
    if (cancelled.has(adam) || kept.has(adam)) continue;
    const snap = snapshotForGraphSymv(project, chainRes, adam);
    if (snap) {
      if (!isSubstantiveContractSymvSnapshot(snap)) continue;
      return true;
    }
    if (parallel.has(adam)) return true;
  }
  return false;
}

function registryEntryForAdam(project, adam) {
  const n = normalizeChainMembershipAdam(adam);
  if (!n) return null;
  return (Array.isArray(project?.khmdhsDocumentRegistry) ? project.khmdhsDocumentRegistry : [])
    .find((e) => normalizeChainMembershipAdam(e?.adam) === n) || null;
}

function awardAmendsThisCard(project, snapshot) {
  const primary = normalizeChainMembershipAdam(
    project?.khmdhsAwardAdam || project?.khmdhsAwardSnapshot?.referenceNumber
  );
  if (!primary) return false;
  const amended = normalizeChainMembershipAdam(snapshot?.amendedAuctionADAM);
  if (amended && amended === primary) return true;
  const refs = Array.isArray(snapshot?.amendsAuctionRefNos) ? snapshot.amendsAuctionRefNos : [];
  return refs.some((r) => normalizeChainMembershipAdam(r) === primary);
}

/** Συμβάσεις που η κάρτα κρατά — όχι «Δεν καταχωρείται», όχι ακυρωμένες. */
export function collectKeptSymvAdams(project) {
  const out = new Set();
  const add = (v) => {
    const n = normalizeChainMembershipAdam(v);
    if (!n || isAdamSkippedInChainPlan(project, n)) return;
    if (cancelledAdamSet(project).has(n)) return;
    out.add(n);
  };

  const items = planItems(project);
  if (items.length) {
    items.forEach((item) => {
      if (planItemStage(item) !== CHAIN_LINK_STAGE.SYMV && !/SYMV/.test(normalizeChainMembershipAdam(item?.adam))) {
        return;
      }
      if (item?.role && item.role !== SKIP_ROLE) add(item.adam);
    });
  }

  add(project?.khmdhsAdam);
  add(project?.khmdhsContractSnapshot?.referenceNumber);
  (Array.isArray(project?.contracts) ? project.contracts : []).forEach((c) => {
    add(c?.khmdhsAdam);
    add(c?.khmdhsContractSnapshot?.referenceNumber);
  });
  (Array.isArray(project?.supplementaryContracts) ? project.supplementaryContracts : []).forEach((s) => {
    add(s?.khmdhsAdam);
  });
  return out;
}

function registryAdams(project) {
  const set = new Set();
  (Array.isArray(project?.khmdhsDocumentRegistry) ? project.khmdhsDocumentRegistry : []).forEach((e) => {
    const n = normalizeChainMembershipAdam(e?.adam);
    if (n) set.add(n);
  });
  return set;
}

function awardSnapshotForAdam(project, adam) {
  const n = normalizeChainMembershipAdam(adam);
  if (!n) return null;
  const snaps = project?.khmdhsAdamChainMeta?.awardSnapshotsByAdam || {};
  if (snaps[n]) return snaps[n];
  if (normalizeChainMembershipAdam(project?.khmdhsAwardAdam) === n) {
    return project?.khmdhsAwardSnapshot || null;
  }
  if (normalizeChainMembershipAdam(project?.khmdhsAwardSnapshot?.referenceNumber) === n) {
    return project?.khmdhsAwardSnapshot || null;
  }
  return null;
}

function contractRefsFromSnapshot(snapshot) {
  const out = [];
  const add = (v) => {
    const n = normalizeChainMembershipAdam(v);
    if (n) out.push(n);
  };
  const refs = snapshot?.contractRefNos;
  if (Array.isArray(refs)) refs.forEach(add);
  add(snapshot?.contractRefNo);
  return out;
}

function refsOnlySkipped(project, refs) {
  if (!refs.length) return false;
  return refs.every((r) => isAdamSkippedInChainPlan(project, r));
}

function refsIntersectKept(project, refs) {
  if (!refs.length) return false;
  const kept = collectKeptSymvAdams(project);
  return refs.some((r) => kept.has(r));
}

/**
 * Η κατακύρωση ανήκει σε αυτή την κάρτα;
 * Όχι απλώς «το ΚΗΜΔΗΣ την έδεσε στον διαγωνισμό».
 */
export function awardBelongsToThisCard(project, adam) {
  const n = normalizeChainMembershipAdam(adam);
  if (!n || !/AWRD/.test(n)) return false;
  if (cancelledAdamSet(project).has(n)) return false;
  if (isAdamSkippedInChainPlan(project, n)) return false;
  if (isAdamKeptInChainPlan(project, n)) return true;

  if (normalizeChainMembershipAdam(project?.khmdhsAwardAdam) === n) return true;
  if (normalizeChainMembershipAdam(project?.khmdhsAwardSnapshot?.referenceNumber) === n) return true;

  const snap = awardSnapshotForAdam(project, n);
  const refs = contractRefsFromSnapshot(snap);
  if (refsIntersectKept(project, refs)) return true;
  if (refs.length && refs.every((r) => isAdamSkippedInChainPlan(project, r))) return false;
  if (awardAmendsThisCard(project, snap)) return true;

  // Ήδη καταγεγραμμένη σε αυτή την κάρτα και όχι δεμένη μόνο με αποκλεισμένη σύμβαση.
  if (registryAdams(project).has(n) && !refsOnlySkipped(project, refs)) return true;

  // Ένα υποέργο, χωρίς άλλη σύμβαση στο γράφημα: επιπλέον κατακύρωση = τροποποίηση / ανάθεση 2.
  if (collectKeptSymvAdams(project).size > 0 && !graphHasOtherLotContract(project)) return true;

  return false;
}

/**
 * Ένταλμα ανήκει σε αυτή την κάρτα; (συμπλήρωμα του φίλτρου συμβάσεων)
 */
export function paymentAdamBelongsToThisCard(project, adam, snapshot = null) {
  const n = normalizeChainMembershipAdam(adam);
  if (!n) return false;
  if (cancelledAdamSet(project).has(n)) return false;
  if (isAdamSkippedInChainPlan(project, n)) return false;
  if (isAdamKeptInChainPlan(project, n)) return true;

  const snap = snapshot || registryEntryForAdam(project, n)?.snapshot || null;
  let payContract = normalizeChainMembershipAdam(snap?.contractRefNo);
  if (payContract && cancelledAdamSet(project).has(payContract)) payContract = '';
  if (payContract && isAdamSkippedInChainPlan(project, payContract)) return false;
  if (payContract && collectKeptSymvAdams(project).has(payContract)) return true;

  // linkedAdams.payments είναι όλο το γράφημα — μόνο όταν δεν υπάρχει άλλη σύμβαση.
  if (graphHasOtherLotContract(project)) return false;
  if (registryAdams(project).has(n) && /PAY/.test(n)) {
    const linkedPays = new Set(
      (project?.khmdhsAdamChainMeta?.linkedAdams?.payments || [])
        .map(normalizeChainMembershipAdam)
        .filter(Boolean)
    );
    if (linkedPays.has(n)) return true;
  }
  return false;
}

function uniqueAdams(values) {
  const out = [];
  const seen = new Set();
  (values || []).forEach((v) => {
    const n = normalizeChainMembershipAdam(v);
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  });
  return out;
}

function isCancelledSnapshot(snapshot) {
  return !!snapshot?.cancelled;
}

/**
 * Επιπλέον κατακυρώσεις / εντάλματα του ίδιου διαγωνισμού — για χαρακτηρισμό
 * «ανήκει εδώ» vs «άλλο υποέργο».
 */
export function collectExtraChainLinkDocuments(chainRes, project = null) {
  if (!chainRes?.success) return [];
  const cancelled = new Set(
    (chainRes.chainMeta?.confirmedCancelledAdams || []).map(normalizeChainMembershipAdam).filter(Boolean)
  );
  const addCancelled = (adam, snapshot) => {
    const n = normalizeChainMembershipAdam(adam);
    if (!n || cancelled.has(n) || isCancelledSnapshot(snapshot)) return null;
    return n;
  };

  const primaryAward = normalizeChainMembershipAdam(chainRes.auction?.adam);
  const awardSnaps = chainRes.chainMeta?.awardSnapshotsByAdam || {};
  const linkedAuctions = chainRes.chainMeta?.linkedAdams?.auctions || [];
  const awardAdams = uniqueAdams([
    ...linkedAuctions,
    ...Object.keys(awardSnaps),
    chainRes.auction?.adam,
  ]);

  const awards = [];
  awardAdams.forEach((adam) => {
    if (adam === primaryAward) return;
    const snapshot = awardSnaps[adam] || (adam === primaryAward ? chainRes.auction?.snapshot : null);
    if (!addCancelled(adam, snapshot)) return;
    awards.push({
      adam,
      stage: CHAIN_LINK_STAGE.AWRD,
      title: String(snapshot?.title || '').trim(),
      contractor: String(snapshot?.anadoxosName || '').trim(),
      snapshot: snapshot || null,
      defaultDate: String(snapshot?.awardDate || snapshot?.signedDate || '').slice(0, 10),
      defaultAmount: '',
      historyLabel: 'Κατακύρωση / ανάθεση',
    });
  });

  const paySnaps = {};
  (Array.isArray(chainRes.payments) ? chainRes.payments : []).forEach((p) => {
    const adam = normalizeChainMembershipAdam(p?.adam || p?.snapshot?.referenceNumber);
    if (adam) paySnaps[adam] = p?.snapshot || paySnaps[adam] || null;
  });
  const linkedPays = chainRes.chainMeta?.linkedAdams?.payments || [];
  const payAdams = uniqueAdams([
    ...Object.keys(paySnaps),
    ...linkedPays,
    ...(Array.isArray(chainRes.payments) ? chainRes.payments.map((p) => p?.adam) : []),
  ]);

  const payments = [];
  payAdams.forEach((adam) => {
    const snapshot = paySnaps[adam] || null;
    if (!addCancelled(adam, snapshot)) return;
    payments.push({
      adam,
      stage: CHAIN_LINK_STAGE.PAY,
      title: String(snapshot?.title || '').trim(),
      contractor: String(snapshot?.organization || '').trim(),
      snapshot: snapshot || null,
      defaultDate: String(snapshot?.signedDate || snapshot?.issueDate || '').slice(0, 10),
      defaultAmount: '',
      historyLabel: 'Ένταλμα πληρωμής',
    });
  });

  const plannedExtraAdams = new Set();
  planItems(project).forEach((item) => {
    const st = planItemStage(item);
    if (st !== CHAIN_LINK_STAGE.AWRD && st !== CHAIN_LINK_STAGE.PAY) return;
    const planned = normalizeChainMembershipAdam(item?.adam);
    if (planned) plannedExtraAdams.add(planned);
  });
  const otherLot = graphHasOtherLotContract(project, chainRes);

  const registry = registryAdams(project);
  const inferRole = (doc) => inferExtraLinkDefaultRole(doc, project, { registry, chainRes });
  const extras = [];
  awards.forEach((doc) => {
    const refs = contractRefsFromSnapshot(doc.snapshot);
    const onlySkipped = refs.length > 0 && refs.every((r) => isAdamSkippedInChainPlan(project, r));
    if (!otherLot && !plannedExtraAdams.has(doc.adam) && !onlySkipped) return;
    extras.push(doc);
  });
  payments.forEach((doc) => {
    if (plannedExtraAdams.has(doc.adam)) {
      extras.push(doc);
      return;
    }
    if (!otherLot) return;
    const payContract = normalizeChainMembershipAdam(doc.snapshot?.contractRefNo);
    if (payContract && collectKeptSymvAdams(project).has(payContract)) return;
    extras.push(doc);
  });
  return extras.map((doc) => ({
    ...doc,
    inferredRole: inferRole(doc),
  }));
}

export function inferExtraLinkDefaultRole(doc, project, { registry, chainRes } = {}) {
  const n = normalizeChainMembershipAdam(doc?.adam);
  if (!n) return SKIP_ROLE;
  const explicit = findChainPlanItem(project, n);
  if (explicit?.role) return explicit.role;

  const stage = doc.stage || inferChainLinkStageFromAdam(n);
  const snap = doc.snapshot;
  const otherLot = graphHasOtherLotContract(project, chainRes);
  const registrySet = registry || registryAdams(project);

  if (stage === CHAIN_LINK_STAGE.AWRD) {
    const refs = contractRefsFromSnapshot(snap);
    if (refs.length && refs.every((r) => isAdamSkippedInChainPlan(project, r))) return SKIP_ROLE;
    if (refsIntersectKept(project, refs)) return CHAIN_LINK_KEEP_ROLE;
    if (awardAmendsThisCard(project, snap)) return CHAIN_LINK_KEEP_ROLE;
    if (registrySet.has(n)) return CHAIN_LINK_KEEP_ROLE;
    if (!otherLot && collectKeptSymvAdams(project).size > 0) return CHAIN_LINK_KEEP_ROLE;
    return SKIP_ROLE;
  }

  if (stage === CHAIN_LINK_STAGE.PAY) {
    const payContract = normalizeChainMembershipAdam(snap?.contractRefNo);
    if (payContract && isAdamSkippedInChainPlan(project, payContract)) return SKIP_ROLE;
    if (payContract && collectKeptSymvAdams(project).has(payContract)) return CHAIN_LINK_KEEP_ROLE;
    if (registrySet.has(n)) return CHAIN_LINK_KEEP_ROLE;
    if (!otherLot) return CHAIN_LINK_KEEP_ROLE;
    return SKIP_ROLE;
  }

  return SKIP_ROLE;
}

/**
 * Νέος κρίκος που δεν μπορεί να κριθεί αυτόματα — η κάρτα ξαναρωτά.
 * Αυτόματο KEEP (ήδη στην κάρτα / δεμένο με κρατημένη σύμβαση) και αυτόματο SKIP
 * (δεμένο μόνο με αποκλεισμένη σύμβαση) δεν ξαναρωτούν.
 */
export function extraLinkNeedsUserDecision(doc, project, prevPlanAdams, chainRes = null) {
  const n = normalizeChainMembershipAdam(doc?.adam);
  if (!n) return false;
  if (prevPlanAdams instanceof Set && prevPlanAdams.has(n)) return false;
  if (findChainPlanItem(project, n)?.role) return false;

  const inferred = doc.inferredRole || inferExtraLinkDefaultRole(doc, project, { chainRes });
  const snap = doc.snapshot;
  const stage = doc.stage || inferChainLinkStageFromAdam(n);
  const otherLot = graphHasOtherLotContract(project, chainRes);

  if (stage === CHAIN_LINK_STAGE.AWRD) {
    const refs = contractRefsFromSnapshot(snap);
    if (refs.length && refs.every((r) => isAdamSkippedInChainPlan(project, r))) return false;
    if (inferred === CHAIN_LINK_KEEP_ROLE && (
      refsIntersectKept(project, refs)
      || registryAdams(project).has(n)
      || awardAmendsThisCard(project, snap)
    )) return false;
    if (inferred === CHAIN_LINK_KEEP_ROLE && !otherLot) return false;
    return otherLot;
  }

  if (stage === CHAIN_LINK_STAGE.PAY) {
    const payContract = normalizeChainMembershipAdam(snap?.contractRefNo);
    if (payContract && isAdamSkippedInChainPlan(project, payContract)) return false;
    if (payContract && collectKeptSymvAdams(project).has(payContract)) return false;
    if (inferred === CHAIN_LINK_KEEP_ROLE && registryAdams(project).has(n)) return false;
    if (!otherLot) return false;
    return true;
  }

  return inferred !== SKIP_ROLE;
}

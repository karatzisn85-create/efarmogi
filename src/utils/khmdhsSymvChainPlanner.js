/**
 * Συλλογή και προεπιλογή ρόλων για όλα τα SYMV της αλυσίδας ΚΗΜΔΗΣ.
 */

import { isSubstantiveContractSymvSnapshot, nonContractSymvReason } from './khmdhsSubstantiveContractSymv';
import { grossFromContractBudget, grossFromContractRecord } from './khmdhsVatHelper';
import {
  CHAIN_LINK_STAGE,
  collectExtraChainLinkDocuments,
  extraLinkNeedsUserDecision,
  inferExtraLinkDefaultRole,
  planItemStage,
} from './khmdhsChainMembership';

export const SYMV_CHAIN_ROLE = {
  SKIP: 'skip',
  KEEP: 'keep',
  MAIN: 'main',
  PARALLEL: 'parallel',
  SUPPLEMENTARY: 'supplementary',
  EXTENSION: 'extension',
  INTERMEDIATE: 'intermediate',
};

export const SYMV_CHAIN_ROLE_LABELS = {
  [SYMV_CHAIN_ROLE.SKIP]: '— Δεν καταχωρείται',
  [SYMV_CHAIN_ROLE.KEEP]: 'Ανήκει σε αυτό το υποέργο',
  [SYMV_CHAIN_ROLE.MAIN]: 'Κύρια σύμβαση',
  [SYMV_CHAIN_ROLE.PARALLEL]: 'Παράλληλη σύμβαση',
  [SYMV_CHAIN_ROLE.SUPPLEMENTARY]: 'Συμπληρωματική σύμβαση',
  [SYMV_CHAIN_ROLE.EXTENSION]: 'Παράταση / διατήρηση προθεσμίας',
  [SYMV_CHAIN_ROLE.INTERMEDIATE]: 'Ενδιάμεσος κρίκος αλυσίδας',
};

function normalizeAdam(adam) {
  return String(adam || '').trim().toUpperCase().replace(/\*+$/, '').replace(/\s+/g, '');
}

/** ΑΔΑΜ που ο χρήστης απέκλεισε στη κατανομή SYMV («Δεν καταχωρείται»). */
export function isAdamSkippedInSymvPlan(planOrProject, adam) {
  const plan = planOrProject?.khmdhsSymvChainPlan || planOrProject;
  const norm = normalizeAdam(adam);
  if (!norm || !plan?.items?.length) return false;
  const item = plan.items.find((i) => normalizeAdam(i?.adam) === norm);
  return item?.role === SYMV_CHAIN_ROLE.SKIP;
}

const RE_EXTENSION = /παράταση|παραταση|διατήρηση\s+προθεσμ|διατηρηση\s+προθεσμ/i;
const RE_SUPPLEMENTARY = /συμπληρωματικ/i;
const RE_REPUBLICATION = /ορθ[ήη]\s*επαν[άα]ληψ|ορθη\s*επαναληψ|ορθ[ήη]\s*επανέκδοσ|διορθωτικ[ήη]\s*επαν/i;

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
  // Οι πηγές parallelContracts/contract.adam ήδη αντιπροσωπεύουν επιβεβαιωμένες συμβάσεις
  // της υπόθεσης (ανεξάρτητα αν το ΑΔΑΜ τους ακολουθεί τυπικά τη μορφή «…SYMV…»), γι' αυτό
  // καταγράφονται πάντα («force»). Οι υπόλοιπες πηγές είναι πιο γενικές συλλογές συνδέσμων
  // και κρατάνε το φίλτρο «SYMV» ως ασφαλιστική δικλείδα ώστε να μην μπουν μη-συμβατικά έγγραφα.
  const add = (adam, { force = false } = {}) => {
    const norm = normalizeAdam(adam);
    if (!norm) return;
    if (!force && !norm.includes('SYMV')) return;
    seen.add(norm);
  };

  (chainRes.chainMeta?.linkedAdams?.contracts || []).forEach((a) => add(a));
  (chainRes.contractChainHistory || []).forEach((h) => add(h?.adam));
  (chainRes.chainMeta?.parallelContractCandidates || []).forEach((a) => add(a));
  (chainRes.chainMeta?.parallelContracts || []).forEach((a) => add(a, { force: true }));
  Object.keys(chainRes.chainMeta?.contractSnapshotsByAdam || {}).forEach((a) => add(a));
  if (chainRes.contract?.adam) add(chainRes.contract.adam, { force: true });

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
    const grossFromSnap = grossFromContractRecord(snapshot) ?? grossFromContractBudget(budget);
    const amountFromSnap = grossFromSnap != null
      ? Number(grossFromSnap).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
    // Ίδια (ή καμία) ημερομηνία — διατηρούμε τη σειρά εμφάνισης στην αλυσίδα ΚΗΜΔΗΣ
    // αντί για αλφαβητική σύγκριση ΑΔΑΜ, που δεν έχει καμία σχέση με τη χρονολογική σειρά.
    return 0;
  });
}

export function inferDefaultSymvRole(doc, chainRes) {
  if (!doc) return SYMV_CHAIN_ROLE.SKIP;

  const title = String(doc.title || doc.historyLabel || '').toUpperCase();
  const isPrimary = doc.isChainRoot
    || doc.isChainSeed
    || normalizeAdam(chainRes?.contract?.adam) === doc.adam;

  // Ορθή επανάληψη: δεν προτείνουμε συμπληρωματική (και ποσό) — αν είναι παράταση, κράτα παράταση.
  if (RE_REPUBLICATION.test(title) || RE_REPUBLICATION.test(String(doc.historyLabel || ''))) {
    if (RE_EXTENSION.test(title) || RE_EXTENSION.test(String(doc.historyLabel || ''))) {
      return SYMV_CHAIN_ROLE.EXTENSION;
    }
    if (isPrimary) return SYMV_CHAIN_ROLE.MAIN;
    return SYMV_CHAIN_ROLE.SKIP;
  }

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

export function collectPlannerChainDocuments(chainRes, project = null) {
  const symv = collectSymvChainDocuments(chainRes).map((doc) => ({
    ...doc,
    stage: CHAIN_LINK_STAGE.SYMV,
  }));
  const extras = collectExtraChainLinkDocuments(chainRes, project);
  const seen = new Set(symv.map((d) => normalizeAdam(d.adam)));
  extras.forEach((doc) => {
    const adam = normalizeAdam(doc.adam);
    if (!adam || seen.has(adam)) return;
    seen.add(adam);
    symv.push(doc);
  });
  return symv;
}

export function buildDefaultSymvChainPlan(chainRes, project = null) {
  const docs = collectPlannerChainDocuments(chainRes, project);
  let mainAssigned = false;
  const items = [];
  docs.forEach((doc) => {
    const stage = doc.stage || planItemStage(doc) || CHAIN_LINK_STAGE.SYMV;
    if (stage === CHAIN_LINK_STAGE.AWRD || stage === CHAIN_LINK_STAGE.PAY) return;
    let role = inferDefaultSymvRole(doc, chainRes);
    if (role === SYMV_CHAIN_ROLE.MAIN) {
      if (mainAssigned) role = SYMV_CHAIN_ROLE.SKIP;
      else mainAssigned = true;
    }
    if (role === SYMV_CHAIN_ROLE.PARALLEL && !doc.defaultAmount && !doc.contractor) {
      role = SYMV_CHAIN_ROLE.SKIP;
    }
    items.push({
      adam: doc.adam,
      stage: CHAIN_LINK_STAGE.SYMV,
      role,
      date: doc.defaultDate || '',
      amount: role === SYMV_CHAIN_ROLE.SKIP
        || role === SYMV_CHAIN_ROLE.EXTENSION
        || role === SYMV_CHAIN_ROLE.INTERMEDIATE
        ? ''
        : (doc.defaultAmount || ''),
      label: '',
    });
  });
  const ctx = {
    ...(project || {}),
    khmdhsSymvChainPlan: { items },
  };
  docs.forEach((doc) => {
    const stage = doc.stage || planItemStage(doc) || CHAIN_LINK_STAGE.SYMV;
    if (stage !== CHAIN_LINK_STAGE.AWRD && stage !== CHAIN_LINK_STAGE.PAY) return;
    items.push({
      adam: doc.adam,
      stage,
      role: inferExtraLinkDefaultRole(doc, ctx),
      date: doc.defaultDate || '',
      amount: '',
      label: '',
    });
  });
  return { items, createdAt: new Date().toISOString() };
}

function isSymvContractPlanItem(item) {
  if (!item?.adam) return false;
  const stage = planItemStage(item);
  if (stage === CHAIN_LINK_STAGE.AWRD || stage === CHAIN_LINK_STAGE.PAY) return false;
  return true;
}

export function validateSymvChainPlan(plan) {
  const items = (plan?.items || []).filter((i) => (
    i?.adam
    && i.role !== SYMV_CHAIN_ROLE.SKIP
    && isSymvContractPlanItem(i)
  ));
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

export function symvPlanMatchesChain(plan, chainRes, project = null) {
  const docs = collectPlannerChainDocuments(chainRes, project);
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

/**
 * Κρατά τους ρόλους/ποσά/ημ/νίες της προηγούμενης κατανομής για ΑΔΑΜ που εξακολουθούν
 * να υπάρχουν· για νέα ΑΔΑΜ χρησιμοποιεί την αυτόματη πρόταση.
 * Έτσι τα «Δεν καταχωρείται» δεν χάνονται όταν η αλυσίδα μεγαλώσει κατά 1 έγγραφο.
 */
export function mergeExistingSymvPlanOntoChain(existingPlan, chainRes, project = null) {
  const ctx = project
    ? { ...project, khmdhsSymvChainPlan: existingPlan }
    : { khmdhsSymvChainPlan: existingPlan };
  const base = buildDefaultSymvChainPlan(chainRes, ctx);
  if (!existingPlan?.items?.length) return base;

  const prevByAdam = new Map();
  existingPlan.items.forEach((item) => {
    const adam = normalizeAdam(item?.adam);
    if (adam) prevByAdam.set(adam, item);
  });

  const items = base.items.map((item) => {
    const prev = prevByAdam.get(normalizeAdam(item.adam));
    if (!prev?.role) return item;
    const role = prev.role;
    const keepAmount = role !== SYMV_CHAIN_ROLE.SKIP
      && role !== SYMV_CHAIN_ROLE.EXTENSION
      && role !== SYMV_CHAIN_ROLE.INTERMEDIATE
      && role !== SYMV_CHAIN_ROLE.KEEP;
    return {
      ...item,
      role,
      date: String(prev.date || item.date || '').slice(0, 10),
      amount: keepAmount
        ? (String(prev.amount || '').trim() || item.amount || '')
        : '',
      label: String(prev.label || item.label || '').trim(),
    };
  });

  // Μία κύρια το πολύ — επιπλέον «main» από παλιό σχέδιο γίνονται παράλληλες.
  let seenMain = false;
  const normalized = items.map((item) => {
    if (item.role !== SYMV_CHAIN_ROLE.MAIN) return item;
    if (!seenMain) {
      seenMain = true;
      return item;
    }
    return { ...item, role: SYMV_CHAIN_ROLE.PARALLEL };
  });

  return {
    items: normalized,
    createdAt: existingPlan.createdAt || base.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

/** ΑΔΑΜ συμβάσεων που ήδη υπάρχουν στην κάρτα (κύριες + συμπληρωματικές). */
export function collectFormPlacedSymvAdams(form) {
  const out = new Set();
  const add = (value) => {
    const n = normalizeAdam(value);
    if (n) out.add(n);
  };
  add(form?.khmdhsAdam);
  (form?.contracts || []).forEach((c) => add(c?.khmdhsAdam));
  (form?.supplementaryContracts || []).forEach((s) => add(s?.khmdhsAdam));
  return out;
}

/**
 * Μετά από συρραφή δύο πρωτογενών: βάζει στο σχέδιο κατανομής και τις
 * συμβάσεις που ήδη υπήρχαν στην κάρτα, ώστε η επόμενη ανανέωση να μην
 * τις βλέπει ως «νέα ΑΔΑΜ» και να ξαναρωτά.
 */
export function expandSymvPlanWithFormContracts(plan, form) {
  if (!plan?.items?.length || !form) return plan;
  const items = [...plan.items];
  const have = new Set(items.map((i) => normalizeAdam(i.adam)).filter(Boolean));
  const push = (adam, role) => {
    const n = normalizeAdam(adam);
    if (!n || have.has(n)) return;
    have.add(n);
    items.push({ adam: n, role, date: '', amount: '' });
  };
  push(form.khmdhsAdam, SYMV_CHAIN_ROLE.PARALLEL);
  (form.contracts || []).forEach((c) => push(c?.khmdhsAdam, SYMV_CHAIN_ROLE.PARALLEL));
  (form.supplementaryContracts || []).forEach((s) => {
    push(s?.khmdhsAdam, SYMV_CHAIN_ROLE.SUPPLEMENTARY);
  });
  return { ...plan, items };
}

function collectKnownPlanAdams(knownAdams, form) {
  const out = new Set();
  (Array.isArray(knownAdams) ? knownAdams : []).forEach((a) => {
    const n = normalizeAdam(a);
    if (n) out.add(n);
  });
  collectFormPlacedSymvAdams(form).forEach((a) => out.add(a));
  return out;
}

/**
 * Σχέδιο έτοιμο για αυτόματη εφαρμογή μετά ανανέωση:
 * - ακριβές ταίριασμα, ή
 * - μερική συγχώνευση χωρίς νέα ΑΔΑΜ που χρειάζονται απόφαση χρήστη, και έγκυρο validate.
 * already-on-card ΑΔΑΜ (form / knownAdams) δεν θεωρούνται νέα απόφαση.
 */
export function resolveReusableSymvChainPlan(existingPlan, chainRes, { knownAdams, form } = {}) {
  if (!existingPlan?.items?.length || !chainRes?.success) return null;
  if (symvPlanMatchesChain(existingPlan, chainRes, form)) return existingPlan;

  const merged = mergeExistingSymvPlanOntoChain(existingPlan, chainRes, form);
  const prevAdams = new Set(
    existingPlan.items.map((i) => normalizeAdam(i.adam)).filter(Boolean)
  );
  const placed = collectKnownPlanAdams(knownAdams, form);
  const docs = collectSymvChainDocuments(chainRes);
  const newDocsNeedUser = docs.some((doc) => {
    const adam = normalizeAdam(doc.adam);
    if (!adam || prevAdams.has(adam) || placed.has(adam)) return false;
    const item = merged.items.find((i) => normalizeAdam(i.adam) === adam);
    return item && item.role !== SYMV_CHAIN_ROLE.SKIP;
  });
  if (newDocsNeedUser) return null;
  const ctx = { ...(form || {}), khmdhsSymvChainPlan: merged };
  const extrasNeedUser = collectExtraChainLinkDocuments(chainRes, ctx).some((doc) => (
    extraLinkNeedsUserDecision(doc, ctx, prevAdams, chainRes)
  ));
  if (extrasNeedUser) return null;
  if (!validateSymvChainPlan(merged).ok) return null;
  return merged;
}

/**
 * Αλυσίδα για έλεγχο κατανομής μετά ανανέωση κάρτας / μαζικής.
 * Δέχεται το αποτέλεσμα preview-subproject-khmdhs-refresh ή απευθείας chainRes.
 */
export function resolvePlanChainResForKhmdhsRefresh(refreshRes) {
  if (!refreshRes) return null;
  if (refreshRes.chainRes) {
    return refreshRes.usesStitchPlan
      ? (mergeStitchChainResForSymvPlan(refreshRes.chainRes, refreshRes.stitchResults)
        || refreshRes.chainRes)
      : refreshRes.chainRes;
  }
  return refreshRes;
}

/** Επαναχρησιμοποιήσιμο σχέδιο μετά ανανέωση (ίδιος κανόνας κάρτας και μαζικής). */
export function resolveReusablePlanForKhmdhsRefresh(existingPlan, refreshRes, extra = {}) {
  return resolveReusableSymvChainPlan(
    existingPlan,
    resolvePlanChainResForKhmdhsRefresh(refreshRes),
    extra
  );
}

/** Νέα πραγματική σύμβαση (όχι auto-skip): η κάρτα ξαναρωτά κατανομή. */
export function needsSymvPlannerAfterKhmdhsRefresh(existingPlan, refreshRes, extra = {}) {
  const reusable = resolveReusablePlanForKhmdhsRefresh(existingPlan, refreshRes, extra);
  if (reusable?.items?.length) return false;
  if (!existingPlan?.items?.length) return false;
  return shouldOfferSymvChainPlanner(resolvePlanChainResForKhmdhsRefresh(refreshRes));
}

/**
 * Ενοποιεί τα SYMV / snapshots όλων των επιτυχημένων τμημάτων συρραφής
 * ώστε η επαναχρησιμοποίηση κατανομής να μη βλέπει μόνο τον πρώτο σπόρο.
 */
export function mergeStitchChainResForSymvPlan(primaryChainRes, stitchResults) {
  if (!primaryChainRes?.success) return primaryChainRes;
  const segments = (Array.isArray(stitchResults) ? stitchResults : [])
    .filter((seg) => seg?.success && seg.chainRes?.success);
  if (segments.length <= 1) return primaryChainRes;

  const snapshots = { ...(primaryChainRes.chainMeta?.contractSnapshotsByAdam || {}) };
  const awardSnaps = { ...(primaryChainRes.chainMeta?.awardSnapshotsByAdam || {}) };
  const history = [...(primaryChainRes.contractChainHistory || [])];
  const seenHistory = new Set(history.map((h) => normalizeAdam(h?.adam)).filter(Boolean));
  const parallelCandidates = new Set(
    (primaryChainRes.chainMeta?.parallelContractCandidates || []).map(normalizeAdam).filter(Boolean)
  );
  const parallelContracts = new Set(
    (primaryChainRes.chainMeta?.parallelContracts || []).map(normalizeAdam).filter(Boolean)
  );
  const linked = {
    requests: new Set((primaryChainRes.chainMeta?.linkedAdams?.requests || []).map(normalizeAdam).filter(Boolean)),
    notices: new Set((primaryChainRes.chainMeta?.linkedAdams?.notices || []).map(normalizeAdam).filter(Boolean)),
    auctions: new Set((primaryChainRes.chainMeta?.linkedAdams?.auctions || []).map(normalizeAdam).filter(Boolean)),
    payments: new Set((primaryChainRes.chainMeta?.linkedAdams?.payments || []).map(normalizeAdam).filter(Boolean)),
    contracts: new Set((primaryChainRes.chainMeta?.linkedAdams?.contracts || []).map(normalizeAdam).filter(Boolean)),
  };

  segments.forEach((seg) => {
    const cr = seg.chainRes;
    Object.assign(snapshots, cr.chainMeta?.contractSnapshotsByAdam || {});
    Object.assign(awardSnaps, cr.chainMeta?.awardSnapshotsByAdam || {});
    (cr.contractChainHistory || []).forEach((h) => {
      const adam = normalizeAdam(h?.adam);
      if (!adam || seenHistory.has(adam)) return;
      seenHistory.add(adam);
      history.push(h);
    });
    (cr.chainMeta?.parallelContractCandidates || []).forEach((a) => {
      const n = normalizeAdam(a);
      if (n) parallelCandidates.add(n);
    });
    (cr.chainMeta?.parallelContracts || []).forEach((a) => {
      const n = normalizeAdam(a);
      if (n) parallelContracts.add(n);
    });
    const segLinked = cr.chainMeta?.linkedAdams || {};
    (segLinked.requests || []).forEach((a) => { const n = normalizeAdam(a); if (n) linked.requests.add(n); });
    (segLinked.notices || []).forEach((a) => { const n = normalizeAdam(a); if (n) linked.notices.add(n); });
    (segLinked.auctions || []).forEach((a) => { const n = normalizeAdam(a); if (n) linked.auctions.add(n); });
    (segLinked.payments || []).forEach((a) => { const n = normalizeAdam(a); if (n) linked.payments.add(n); });
    (segLinked.contracts || []).forEach((a) => { const n = normalizeAdam(a); if (n) linked.contracts.add(n); });
  });

  return {
    ...primaryChainRes,
    success: true,
    contractChainHistory: history,
    chainMeta: {
      ...(primaryChainRes.chainMeta || {}),
      contractSnapshotsByAdam: snapshots,
      awardSnapshotsByAdam: awardSnaps,
      parallelContractCandidates: [...parallelCandidates],
      parallelContracts: [...parallelContracts],
      linkedAdams: {
        ...(primaryChainRes.chainMeta?.linkedAdams || {}),
        requests: [...linked.requests],
        notices: [...linked.notices],
        auctions: [...linked.auctions],
        payments: [...linked.payments],
        contracts: [...linked.contracts],
      },
    },
  };
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

/**
 * Άγκυρα κλάδου ΚΗΜΔΗΣ ανά υποέργο — κοινή πράξη, επιλογή κλάδου, διπλότυπα.
 */
import { parseKhmdhsAdamType } from './khmdhsAdamGuidance';

export const KHMDHS_BRANCH_ANCHOR_LABELS = {
  SYMV: 'Σύμβαση',
  PROC: 'Δημοσίευση / πρόσκληση',
  APPROVED_REQ: 'Εγκεκριμένο αίτημα / δέσμευση',
  REQ: 'Πρωτογενές αίτημα',
};

export function normalizeKhmdhsAdam(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .replace(/\*+$/, '');
}

function normalizeGreekText(value) {
  return String(value || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9Α-Ω\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ομοιότητα τίτλων 0–1 (απλή λέξη-προς-λέξη). */
export function titleSimilarityScore(titleA, titleB) {
  const a = normalizeGreekText(titleA);
  const b = normalizeGreekText(titleB);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const wordsA = new Set(a.split(' ').filter((w) => w.length > 3));
  const wordsB = new Set(b.split(' ').filter((w) => w.length > 3));
  if (!wordsA.size || !wordsB.size) return 0;
  let overlap = 0;
  wordsA.forEach((w) => { if (wordsB.has(w)) overlap += 1; });
  return overlap / Math.max(wordsA.size, wordsB.size);
}

export function getSubprojectBranchAnchor(project) {
  if (!project) return { adam: '', type: '' };
  const adam = normalizeKhmdhsAdam(project.khmdhsBranchAnchorAdam);
  const type = String(project.khmdhsBranchAnchorType || '').trim().toUpperCase()
    || parseKhmdhsAdamType(adam)
    || '';
  return { adam, type };
}

export function getSubprojectActRootReq(project) {
  return normalizeKhmdhsAdam(
    project?.khmdhsActRootReqAdam
    || project?.khmdhsRequestAdam
    || project?.khmdhsRequestSnapshot?.referenceNumber
  );
}

export function inferActRootReqAdam(chainRes, seedAdam = '') {
  const fromMeta = normalizeKhmdhsAdam(chainRes?.chainMeta?.actRootReqAdam);
  if (fromMeta) return fromMeta;
  const linkedReqs = (chainRes?.chainMeta?.linkedAdams?.requests || [])
    .map(normalizeKhmdhsAdam)
    .filter(Boolean)
    .sort(); // Σταθερή σειρά — αποφεύγουμε μη ντετερμινιστική επιλογή
  if (linkedReqs.length) return linkedReqs[0];
  const seed = normalizeKhmdhsAdam(seedAdam);
  if (parseKhmdhsAdamType(seed) === 'REQ') return seed;
  const reqAdam = normalizeKhmdhsAdam(chainRes?.request?.adam);
  if (reqAdam && parseKhmdhsAdamType(reqAdam) === 'REQ') return reqAdam;
  return '';
}

function pickTitleForAdam(chainRes, adam, type) {
  const norm = normalizeKhmdhsAdam(adam);
  if (!norm) return '';

  if (type === 'SYMV') {
    const snap = chainRes?.chainMeta?.contractSnapshotsByAdam?.[norm]
      || (normalizeKhmdhsAdam(chainRes?.contract?.adam) === norm ? chainRes.contract?.snapshot : null);
    return snap?.title || snap?.contractTitle || '';
  }
  if (type === 'PROC' && normalizeKhmdhsAdam(chainRes?.notice?.adam) === norm) {
    return chainRes.notice?.snapshot?.title || '';
  }
  if (type === 'REQ' && normalizeKhmdhsAdam(chainRes?.request?.adam) === norm) {
    return chainRes.request?.snapshot?.title || '';
  }

  const decisions = [
    ...(chainRes?.commitmentDecisions || []),
    ...(chainRes?.chainMeta?.allBudgetCommitments || []),
  ];
  const dec = decisions.find((d) => normalizeKhmdhsAdam(d?.adam) === norm);
  if (dec?.snapshot?.title) return dec.snapshot.title;

  return '';
}

function addCandidate(list, seen, entry) {
  const adam = normalizeKhmdhsAdam(entry.adam);
  if (!adam) return;
  const type = entry.type || parseKhmdhsAdamType(adam) || 'REQ';
  const key = `${type}:${adam}`;
  if (seen.has(key)) return;
  seen.add(key);
  list.push({
    adam,
    type,
    title: String(entry.title || pickTitleForAdam(entry.chainRes, adam, type) || '').trim(),
    subtitle: entry.subtitle || KHMDHS_BRANCH_ANCHOR_LABELS[type] || type,
    amount: entry.amount || '',
  });
}

function isBudgetCommitmentAdam(chainRes, adam) {
  const norm = normalizeKhmdhsAdam(adam);
  if (!norm || parseKhmdhsAdamType(norm) !== 'REQ') return false;
  const primary = normalizeKhmdhsAdam(chainRes?.request?.adam);
  if (norm === primary) return false;
  const budgetAdams = new Set(
    [
      ...(chainRes?.commitmentDecisions || []),
      ...(chainRes?.chainMeta?.allBudgetCommitments || []),
      ...(chainRes?.chainMeta?.linkedAdams?.budgetCommitments || []),
    ]
      .map((d) => normalizeKhmdhsAdam(d?.adam))
      .filter(Boolean)
  );
  if (budgetAdams.has(norm)) return true;
  if (normalizeKhmdhsAdam(chainRes?.commitmentDecision?.adam) === norm) return true;
  return false;
}

/** PROC που αντιπροσωπεύουν διαφορετικούς διαγωνισμούς — όχι προκήρυξη+διακήρυξη ίδιου. */
function filterDistinctProcBranches(chainRes, procAdams) {
  const unique = [...new Set(procAdams.map(normalizeKhmdhsAdam).filter(Boolean))];
  if (unique.length <= 1) return unique;

  const titles = unique.map((adam) => ({
    adam,
    title: pickTitleForAdam(chainRes, adam, 'PROC'),
  }));

  const titled = titles.filter((t) => t.title);
  if (titled.length >= 2) {
    const allSame = titled.every(
      (t) => titleSimilarityScore(t.title, titled[0].title) >= 0.85
    );
    if (allSame) return [];
  } else {
    // Χωρίς τίτλους για σύγκριση: στο ίδιο case πολλαπλά PROC = συνήθως στάδια, όχι κλάδοι
    return [];
  }

  return unique;
}

function symvRootCandidatesFromChain(chainRes) {
  const rootAdam = normalizeKhmdhsAdam(
    chainRes?.chainMeta?.contractRootAdam
    || chainRes?.contract?.adam
  );
  const parallel = [
    ...(chainRes?.chainMeta?.parallelContractCandidates || []),
    ...(chainRes?.chainMeta?.parallelContracts || []),
  ]
    .map(normalizeKhmdhsAdam)
    .filter(Boolean);
  const unique = [...new Set([
    ...(rootAdam ? [rootAdam] : []),
    ...parallel,
  ])];
  if (unique.length > 1) return unique;

  const roots = (chainRes?.chainMeta?.contractChain || [])
    .filter((c) => c.isRoot || c.kind === 'contract')
    .map((c) => normalizeKhmdhsAdam(c.adam))
    .filter(Boolean);
  const uniqueRoots = [...new Set(roots)];
  if (uniqueRoots.length > 1) return uniqueRoots;

  return [];
}

/**
 * Μόνο πραγματικοί κλάδοι (εναλλακτικές), όχι διαδοχικά στάδια (REQ→δέσμευση→SYMV).
 */
export function buildBranchCandidatesFromChainRes(chainRes) {
  if (!chainRes?.success) return [];
  const list = [];
  const seen = new Set();
  const linked = chainRes.chainMeta?.linkedAdams || {};

  const symvRoots = symvRootCandidatesFromChain(chainRes);
  if (symvRoots.length > 1) {
    symvRoots.forEach((adam) => {
      const snap = chainRes?.chainMeta?.contractSnapshotsByAdam?.[adam]
        || (normalizeKhmdhsAdam(chainRes?.contract?.adam) === adam
          ? chainRes.contract?.snapshot
          : null);
      addCandidate(list, seen, {
        adam,
        type: 'SYMV',
        chainRes,
        amount: snap?.contractBudget != null
          ? String(snap.contractBudget)
          : (chainRes.contract?.formFields?.contractAmount || ''),
      });
    });
    return list;
  }

  const procAdams = (linked.notices || []).map(normalizeKhmdhsAdam).filter(Boolean);
  const distinctProcs = filterDistinctProcBranches(chainRes, procAdams);
  if (distinctProcs.length > 1) {
    distinctProcs.forEach((adam) => {
      addCandidate(list, seen, { adam, type: 'PROC', chainRes });
    });
  }

  return list;
}

/** Προεπιλογή άγκυρας όταν δεν υπάρχει επιλογή κλάδου. */
export function inferDefaultBranchAnchor(chainRes, seedAdam = '') {
  const seed = normalizeKhmdhsAdam(seedAdam);
  const seedType = parseKhmdhsAdamType(seed);

  if (seedType === 'SYMV' && normalizeKhmdhsAdam(chainRes?.contract?.adam) === seed) {
    return { adam: seed, type: 'SYMV' };
  }
  if (seedType === 'PROC') {
    const procAdams = (chainRes?.chainMeta?.linkedAdams?.notices || [])
      .map(normalizeKhmdhsAdam)
      .filter(Boolean);
    if (procAdams.includes(seed)) {
      return { adam: seed, type: 'PROC' };
    }
  }
  if (seed && isBudgetCommitmentAdam(chainRes, seed)) {
    return { adam: seed, type: 'APPROVED_REQ' };
  }
  if (seedType === 'REQ') {
    const primary = normalizeKhmdhsAdam(chainRes?.request?.adam);
    if (seed === primary) {
      return { adam: seed, type: 'REQ' };
    }
  }

  if (chainRes?.contract?.adam) {
    return { adam: normalizeKhmdhsAdam(chainRes.contract.adam), type: 'SYMV' };
  }
  if (chainRes?.notice?.adam) {
    return { adam: normalizeKhmdhsAdam(chainRes.notice.adam), type: 'PROC' };
  }
  const commitAdam = normalizeKhmdhsAdam(
    chainRes?.commitmentDecision?.adam
    || chainRes?.commitmentDecisions?.[0]?.adam
    || chainRes?.chainMeta?.allBudgetCommitments?.[0]?.adam
  );
  if (commitAdam) {
    return { adam: commitAdam, type: 'APPROVED_REQ' };
  }
  if (chainRes?.request?.adam) {
    return { adam: normalizeKhmdhsAdam(chainRes.request.adam), type: 'REQ' };
  }
  if (seed) return { adam: seed, type: seedType || 'REQ' };
  return { adam: '', type: '' };
}

export function suggestBestBranchCandidate(candidates, subprojectTitle, chainRes = null, seedAdam = '') {
  if (candidates?.length > 1) {
    let best = candidates[0];
    let bestScore = -1;
    candidates.forEach((c) => {
      let score = titleSimilarityScore(subprojectTitle, c.title);
      if (c.type === 'SYMV') score += 0.05;
      if (c.type === 'PROC') score += 0.02;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    });
    return best;
  }
  if (candidates?.length === 1) return candidates[0];

  if (!chainRes) return null;
  const anchor = inferDefaultBranchAnchor(chainRes, seedAdam);
  if (!anchor.adam) return null;
  return {
    adam: anchor.adam,
    type: anchor.type,
    title: pickTitleForAdam(chainRes, anchor.adam, anchor.type),
    subtitle: KHMDHS_BRANCH_ANCHOR_LABELS[anchor.type] || anchor.type,
    amount: '',
  };
}

export function branchPickerAllowsAllBranches(candidates, chainRes = null) {
  const list = candidates || [];
  if (list.length < 2) return false;
  const allSymv = list.every((c) => String(c.type || '').toUpperCase() === 'SYMV');
  if (allSymv) return true;
  const parallel = chainRes?.chainMeta?.parallelContracts || [];
  if (parallel.length > 1) {
    return list.every((c) => parallel.includes(c.adam) || String(c.type || '').toUpperCase() === 'SYMV');
  }
  return false;
}

export function needsBranchPicker(candidates) {
  return (candidates || []).length > 1;
}

export function resolveBranchAnchorFromChain(chainRes, seedAdam, explicitAnchor = null) {
  if (explicitAnchor?.adam) {
    return {
      adam: normalizeKhmdhsAdam(explicitAnchor.adam),
      type: explicitAnchor.type || parseKhmdhsAdamType(explicitAnchor.adam) || '',
    };
  }
  return inferDefaultBranchAnchor(chainRes, seedAdam);
}

export function mergeBranchAnchorFields(form, { anchorAdam, anchorType, actRootReqAdam } = {}) {
  const next = { ...form };
  const adam = normalizeKhmdhsAdam(anchorAdam);
  if (adam) {
    next.khmdhsBranchAnchorAdam = adam;
    next.khmdhsBranchAnchorType = anchorType || parseKhmdhsAdamType(adam) || '';
  }
  const root = normalizeKhmdhsAdam(actRootReqAdam);
  if (root) next.khmdhsActRootReqAdam = root;
  return next;
}

function projectSymvAdam(project) {
  return normalizeKhmdhsAdam(
    project?.khmdhsAdam
    || project?.khmdhsContractSnapshot?.referenceNumber
    || (project?.khmdhsBranchAnchorType === 'SYMV' ? project?.khmdhsBranchAnchorAdam : '')
  );
}

export function findSubprojectsSharingSymv(allProjects, symvAdam, excludeSubprojectId = '') {
  const target = normalizeKhmdhsAdam(symvAdam);
  if (!target) return [];
  return (allProjects || []).filter((p) => {
    if (!p?.subprojectId || p.subprojectId === excludeSubprojectId) return false;
    return projectSymvAdam(p) === target;
  });
}

export function findSubprojectsSharingBranchAnchor(allProjects, anchorAdam, excludeSubprojectId = '') {
  const target = normalizeKhmdhsAdam(anchorAdam);
  if (!target) return [];
  return (allProjects || []).filter((p) => {
    if (!p?.subprojectId || p.subprojectId === excludeSubprojectId) return false;
    const anchor = getSubprojectBranchAnchor(p);
    if (anchor.adam === target) return true;
    return projectSymvAdam(p) === target;
  });
}

export function findActRootSiblings(allProjects, actRootReqAdam, excludeSubprojectId = '') {
  const root = normalizeKhmdhsAdam(actRootReqAdam);
  if (!root) return [];
  return (allProjects || []).filter((p) => {
    if (!p?.subprojectId || p.subprojectId === excludeSubprojectId) return false;
    return getSubprojectActRootReq(p) === root;
  });
}

export function checkKhmdhsDuplicateConflicts(formData, allProjects, chainRes = null) {
  const excludeId = formData?.subprojectId || '';
  const conflicts = [];
  const symvAdam = normalizeKhmdhsAdam(
    formData?.khmdhsAdam
    || chainRes?.contract?.adam
    || (formData?.khmdhsBranchAnchorType === 'SYMV' ? formData?.khmdhsBranchAnchorAdam : '')
  );
  if (symvAdam) {
    const dupSymv = findSubprojectsSharingSymv(allProjects, symvAdam, excludeId);
    if (dupSymv.length) {
      conflicts.push({
        kind: 'symv',
        adam: symvAdam,
        projects: dupSymv,
        message: `Η σύμβαση ${symvAdam} χρησιμοποιείται ήδη στο υποέργο «${dupSymv[0].subprojectTitle}».`,
      });
    }
  }

  const anchor = getSubprojectBranchAnchor(formData);
  if (anchor.adam && anchor.type === 'SYMV' && anchor.adam !== symvAdam) {
    const dupAnchor = findSubprojectsSharingBranchAnchor(allProjects, anchor.adam, excludeId);
    if (dupAnchor.length) {
      conflicts.push({
        kind: 'anchor',
        adam: anchor.adam,
        projects: dupAnchor,
        message: `Η άγκυρα ${anchor.adam} χρησιμοποιείται ήδη στο υποέργο «${dupAnchor[0].subprojectTitle}».`,
      });
    }
  }

  return conflicts;
}

export function checkTitleMismatchWarning(subprojectTitle, chainRes) {
  const contractTitle = chainRes?.contract?.snapshot?.title
    || chainRes?.contract?.snapshot?.contractTitle
    || chainRes?.notice?.snapshot?.title
    || chainRes?.request?.snapshot?.title
    || '';
  if (!contractTitle || !subprojectTitle) return null;
  const score = titleSimilarityScore(subprojectTitle, contractTitle);
  if (score >= 0.35) return null;
  return {
    score,
    khmdhsTitle: contractTitle,
    message: 'Ο τίτλος του υποέργου δεν ταιριάζει σαφώς με τα στοιχεία που επέστρεψε το ΚΗΜΔΗΣ — επιβεβαιώστε ότι επιλέξατε τον σωστό κλάδο.',
  };
}

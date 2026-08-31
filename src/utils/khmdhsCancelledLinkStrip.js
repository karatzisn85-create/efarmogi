/**
 * Αφαίρεση επιβεβαιωμένα ακυρωμένων κρίκων ΚΗΜΔΗΣ από την κάρτα.
 * Δεν αγγίζει κρίκους που απλώς δεν επιβεβαιώθηκαν σε αυτή την ανάκτηση.
 */

export function normalizeCancelledLinkAdam(value) {
  const t = String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .replace(/\*+$/, '');
  return /^(\d{2})[A-Z]{3,4}\d{9}$/.test(t) ? t : '';
}

export function collectCancelledAdamSet(...lists) {
  const set = new Set();
  lists.flat().forEach((raw) => {
    const adam = normalizeCancelledLinkAdam(raw);
    if (adam) set.add(adam);
  });
  return set;
}

export function confirmedCancelledAdamSet(chainRes, _prevForm) {
  // Μόνο η τρέχουσα ανάκτηση: παλιά καταγραφή ακύρωσης δεν σβήνει κρίκο
  // που το ΚΗΜΔΗΣ επανέφερε ως ενεργό.
  return collectCancelledAdamSet(
    chainRes?.chainMeta?.confirmedCancelledAdams,
  );
}

const STAGE_REPORT = {
  notice: {
    removed: 'Αφαιρέθηκε ακυρωμένη δημοσίευση',
    pronoun: 'την',
    replacementArticle: 'η',
  },
  award: {
    removed: 'Αφαιρέθηκε ακυρωμένη ανάθεση',
    pronoun: 'την',
    replacementArticle: 'η',
  },
  request: {
    removed: 'Αφαιρέθηκε ακυρωμένο πρωτογενές αίτημα',
    pronoun: 'το',
    replacementArticle: 'το',
  },
  contract: {
    removed: 'Αφαιρέθηκε ακυρωμένη σύμβαση',
    pronoun: 'την',
    replacementArticle: 'η',
  },
  commitment: {
    removed: 'Αφαιρέθηκε ακυρωμένη ανάληψη υποχρέωσης',
    pronoun: 'την',
    replacementArticle: 'η',
  },
  payment: {
    removed: 'Αφαιρέθηκε ακυρωμένο ένταλμα πληρωμής',
    pronoun: 'το',
    replacementArticle: 'το',
  },
};

export function describeCancelledLinkRemoval(stage, adam, replacementAdam = '') {
  const spec = STAGE_REPORT[stage];
  if (!spec || !adam) return '';
  const head = `${spec.removed} ${adam} — το ΚΗΜΔΗΣ ${spec.pronoun} έχει ματαιώσει`;
  const nextAdam = normalizeCancelledLinkAdam(replacementAdam);
  if (nextAdam && nextAdam !== adam) {
    return `${head}. Ισχύει πλέον ${spec.replacementArticle} ${nextAdam}.`;
  }
  return `${head} και δεν εμφανίζεται πλέον στην κάρτα.`;
}

function addAdam(set, raw) {
  const adam = normalizeCancelledLinkAdam(raw);
  if (adam) set.add(adam);
}

function collectFromHistory(list, set) {
  (Array.isArray(list) ? list : []).forEach((h) => {
    addAdam(set, h?.adam);
    addAdam(set, h?.snapshot?.referenceNumber);
  });
}

/** Όλοι οι καταγεγραμμένοι ΑΔΑΜ ανά στάδιο — για αναφορά αφαίρεσης. */
export function collectRecordedLinkAdamsByStage(project) {
  const meta = project?.khmdhsAdamChainMeta || {};
  const linked = meta.linkedAdams || {};
  const notice = new Set();
  addAdam(notice, project?.khmdhsNoticeAdam);
  addAdam(notice, project?.khmdhsNoticeSnapshot?.referenceNumber);
  (linked.notices || []).forEach((a) => addAdam(notice, a));
  Object.keys(meta.noticeSnapshotsByAdam || {}).forEach((a) => addAdam(notice, a));

  const award = new Set();
  addAdam(award, project?.khmdhsAwardAdam);
  addAdam(award, project?.khmdhsAwardSnapshot?.referenceNumber);
  (linked.auctions || []).forEach((a) => addAdam(award, a));
  Object.keys(meta.awardSnapshotsByAdam || {}).forEach((a) => addAdam(award, a));

  const request = new Set();
  addAdam(request, project?.khmdhsRequestAdam);
  addAdam(request, project?.khmdhsRequestSnapshot?.referenceNumber);
  (linked.requests || []).forEach((a) => addAdam(request, a));
  Object.keys(meta.requestSnapshotsByAdam || {}).forEach((a) => addAdam(request, a));

  const contract = new Set();
  addAdam(contract, project?.khmdhsAdam);
  addAdam(contract, project?.khmdhsContractSnapshot?.referenceNumber);
  (linked.contracts || []).forEach((a) => addAdam(contract, a));
  Object.keys(meta.contractSnapshotsByAdam || {}).forEach((a) => addAdam(contract, a));
  collectFromHistory(project?.khmdhsContractChainHistory, contract);
  (Array.isArray(project?.contracts) ? project.contracts : []).forEach((row) => {
    addAdam(contract, row?.khmdhsAdam);
    addAdam(contract, row?.khmdhsContractSnapshot?.referenceNumber);
    collectFromHistory(row?.khmdhsContractChainHistory, contract);
  });

  return { notice, award, request, contract };
}

function filterAdamList(list, cancelledSet) {
  const seen = new Set();
  const out = [];
  (Array.isArray(list) ? list : []).forEach((raw) => {
    const adam = normalizeCancelledLinkAdam(raw);
    if (!adam || cancelledSet.has(adam) || seen.has(adam)) return;
    seen.add(adam);
    out.push(adam);
  });
  return out;
}

function filterSnapshotMap(map, cancelledSet) {
  const out = {};
  if (!map || typeof map !== 'object') return out;
  Object.entries(map).forEach(([key, snap]) => {
    const adam = normalizeCancelledLinkAdam(key);
    if (!adam || cancelledSet.has(adam)) return;
    if (snap && snap.cancelled === true) return;
    out[adam] = snap;
  });
  return out;
}

function filterHistory(list, cancelledSet) {
  return (Array.isArray(list) ? list : []).filter((h) => {
    const adam = normalizeCancelledLinkAdam(h?.adam || h?.snapshot?.referenceNumber);
    if (!adam) return true;
    return !cancelledSet.has(adam);
  });
}

function snapshotPublishTime(snap) {
  if (!snap) return -Infinity;
  const raw = snap.signedDate || snap.finalSubmissionDate || snap.date || '';
  const t = raw ? Date.parse(String(raw)) : NaN;
  return Number.isNaN(t) ? -Infinity : t;
}

function noticeSnapshotPickScore(snap) {
  const nt = String(snap?.noticeType || '');
  const title = String(snap?.title || '');
  const titleNorm = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (/τευχ(η|ος)\s+δημοπρατησ/.test(titleNorm) || /τευχ(η|ος)\s+διαγωνισμ/.test(titleNorm)) {
    return 5;
  }
  if (/πρόσκληση/i.test(nt)) return 40;
  if (/προκήρυξ/i.test(nt)) return 35;
  if (/διακήρυξ/i.test(nt)) return 10;
  return 20;
}

function pickReplacementFromMap(map, cancelledSet) {
  const entries = Object.entries(map || {})
    .map(([adam, snap]) => ({ adam: normalizeCancelledLinkAdam(adam), snap }))
    .filter((e) => e.adam && e.snap && !cancelledSet.has(e.adam) && e.snap.cancelled !== true);
  entries.sort((a, b) => {
    const scoreDiff = noticeSnapshotPickScore(b.snap) - noticeSnapshotPickScore(a.snap);
    if (scoreDiff !== 0) return scoreDiff;
    const diff = snapshotPublishTime(b.snap) - snapshotPublishTime(a.snap);
    if (diff !== 0) return diff;
    return String(b.adam).localeCompare(String(a.adam));
  });
  return entries[0] || null;
}

function clearPrimary(next, adamKey, snapKey, fetchedKey) {
  next[adamKey] = '';
  next[snapKey] = null;
  next[fetchedKey] = '';
}

function applyPrimaryFromReplacement(next, adamKey, snapKey, fetchedKey, replacement) {
  next[adamKey] = replacement.adam;
  next[snapKey] = replacement.snap;
  next[fetchedKey] = replacement.snap?.fetchedAt || next[fetchedKey] || '';
}

function filterDecisionList(list, cancelledSet) {
  return (Array.isArray(list) ? list : []).filter((row) => {
    const adam = normalizeCancelledLinkAdam(row?.adam || row?.snapshot?.referenceNumber);
    return !adam || !cancelledSet.has(adam);
  });
}

/**
 * @returns {{
 *   form: object,
 *   removed: Array<{ adam: string, stage: string }>,
 *   promoted: Array<{ stage: string, fromAdam: string, toAdam: string }>,
 * }}
 */
export function stripConfirmedCancelledChainLinks(form, cancelledAdams) {
  const cancelledSet = cancelledAdams instanceof Set
    ? cancelledAdams
    : collectCancelledAdamSet(cancelledAdams);
  if (!form || !cancelledSet.size) {
    return { form, removed: [], promoted: [] };
  }

  const next = { ...form };
  const removed = [];
  const promoted = [];
  const noteRemoved = (adam, stage) => {
    const a = normalizeCancelledLinkAdam(adam);
    if (!a || !cancelledSet.has(a)) return;
    if (removed.some((r) => r.adam === a && r.stage === stage)) return;
    removed.push({ adam: a, stage });
  };

  const meta = { ...(next.khmdhsAdamChainMeta || {}) };
  const linked = { ...(meta.linkedAdams || {}) };

  ['requests', 'approvedRequests', 'notices', 'auctions', 'contracts', 'payments', 'budgetCommitments']
    .forEach((key) => {
      const before = linked[key] || [];
      before.forEach((a) => {
        const adam = normalizeCancelledLinkAdam(a);
        if (!adam || !cancelledSet.has(adam)) return;
        const stage = key === 'notices' ? 'notice'
          : key === 'auctions' ? 'award'
            : key === 'requests' || key === 'approvedRequests' ? 'request'
              : key === 'contracts' ? 'contract'
                : key === 'payments' ? 'payment'
                  : 'commitment';
        noteRemoved(adam, stage);
      });
      linked[key] = filterAdamList(before, cancelledSet);
    });

  meta.noticeSnapshotsByAdam = filterSnapshotMap(meta.noticeSnapshotsByAdam, cancelledSet);
  meta.awardSnapshotsByAdam = filterSnapshotMap(meta.awardSnapshotsByAdam, cancelledSet);
  meta.requestSnapshotsByAdam = filterSnapshotMap(meta.requestSnapshotsByAdam, cancelledSet);
  meta.contractSnapshotsByAdam = filterSnapshotMap(meta.contractSnapshotsByAdam, cancelledSet);

  if (Array.isArray(meta.allBudgetCommitments)) {
    meta.allBudgetCommitments = filterDecisionList(meta.allBudgetCommitments, cancelledSet);
  }

  const promoteSingleton = ({
    stage, adamKey, snapKey, fetchedKey, mapKey, linkedKey, afterPromote,
  }) => {
    const existing = normalizeCancelledLinkAdam(next[adamKey]);
    const snapshotCancelled = next[snapKey]?.cancelled === true;
    const existingCancelled = !!(existing && (cancelledSet.has(existing) || snapshotCancelled));
    // Ζωντανή κύρια: μην την αντικαταστήσεις από τον χάρτη (π.χ. επιπλέον κρίκοι).
    if (existing && !existingCancelled) return;

    if (existingCancelled) noteRemoved(existing, stage);

    const replacement = pickReplacementFromMap(meta[mapKey], cancelledSet);
    if (replacement && replacement.adam !== existing) {
      applyPrimaryFromReplacement(next, adamKey, snapKey, fetchedKey, replacement);
      if (existingCancelled) {
        promoted.push({ stage, fromAdam: existing, toAdam: replacement.adam });
      }
      linked[linkedKey] = filterAdamList(
        [...(linked[linkedKey] || []), replacement.adam],
        cancelledSet,
      );
      if (typeof afterPromote === 'function') afterPromote(replacement);
    } else if (existingCancelled) {
      clearPrimary(next, adamKey, snapKey, fetchedKey);
    }
  };

  promoteSingleton({
    stage: 'notice',
    adamKey: 'khmdhsNoticeAdam',
    snapKey: 'khmdhsNoticeSnapshot',
    fetchedKey: 'khmdhsNoticeFetchedAt',
    mapKey: 'noticeSnapshotsByAdam',
    linkedKey: 'notices',
    afterPromote: (replacement) => {
      if (replacement.snap?.mappedAssignmentProcedure) {
        next.assignmentProcedure = replacement.snap.mappedAssignmentProcedure;
      }
    },
  });

  promoteSingleton({
    stage: 'award',
    adamKey: 'khmdhsAwardAdam',
    snapKey: 'khmdhsAwardSnapshot',
    fetchedKey: 'khmdhsAwardFetchedAt',
    mapKey: 'awardSnapshotsByAdam',
    linkedKey: 'auctions',
  });

  promoteSingleton({
    stage: 'request',
    adamKey: 'khmdhsRequestAdam',
    snapKey: 'khmdhsRequestSnapshot',
    fetchedKey: 'khmdhsRequestFetchedAt',
    mapKey: 'requestSnapshotsByAdam',
    linkedKey: 'requests',
  });

  const existingContract = normalizeCancelledLinkAdam(next.khmdhsAdam);
  if (existingContract && cancelledSet.has(existingContract)) {
    noteRemoved(existingContract, 'contract');
    next.khmdhsContractChainHistory = filterHistory(next.khmdhsContractChainHistory, cancelledSet);
    next.khmdhsContractAmendments = filterHistory(next.khmdhsContractAmendments, cancelledSet);
    const fromHistEntry = (next.khmdhsContractChainHistory || []).find((h) => {
      const adam = normalizeCancelledLinkAdam(h?.adam);
      return adam && h?.snapshot && h.isRoot === true && !cancelledSet.has(adam);
    });
    const replacement = fromHistEntry
      ? { adam: normalizeCancelledLinkAdam(fromHistEntry.adam), snap: fromHistEntry.snapshot }
      : null;
    if (replacement) {
      next.khmdhsAdam = replacement.adam;
      next.khmdhsContractSnapshot = replacement.snap;
      next.khmdhsContractFetchedAt = replacement.snap?.fetchedAt || '';
      promoted.push({ stage: 'contract', fromAdam: existingContract, toAdam: replacement.adam });
      linked.contracts = filterAdamList([...(linked.contracts || []), replacement.adam], cancelledSet);
    } else {
      next.khmdhsAdam = '';
      next.khmdhsContractSnapshot = null;
      next.khmdhsContractFetchedAt = '';
      next.khmdhsContractRoleLabel = '';
    }
  } else {
    next.khmdhsContractChainHistory = filterHistory(next.khmdhsContractChainHistory, cancelledSet);
    next.khmdhsContractAmendments = filterHistory(next.khmdhsContractAmendments, cancelledSet);
  }

  if (Array.isArray(next.contracts)) {
    next.contracts = next.contracts.map((row) => {
      if (!row || typeof row !== 'object') return row;
      const history = filterHistory(row.khmdhsContractChainHistory, cancelledSet);
      const amendments = filterHistory(row.khmdhsContractAmendments, cancelledSet);
      const rowAdam = normalizeCancelledLinkAdam(row.khmdhsAdam);
      if (rowAdam && cancelledSet.has(rowAdam)) {
        noteRemoved(rowAdam, 'contract');
        const fromHistEntry = history.find((h) => {
          const adam = normalizeCancelledLinkAdam(h?.adam);
          return adam && h?.snapshot && h.isRoot === true && !cancelledSet.has(adam);
        });
        if (fromHistEntry) {
          const fromHist = {
            adam: normalizeCancelledLinkAdam(fromHistEntry.adam),
            snap: fromHistEntry.snapshot,
          };
          promoted.push({ stage: 'contract', fromAdam: rowAdam, toAdam: fromHist.adam });
          return {
            ...row,
            khmdhsAdam: fromHist.adam,
            khmdhsContractSnapshot: fromHist.snap,
            khmdhsContractFetchedAt: fromHist.snap?.fetchedAt || '',
            khmdhsContractChainHistory: history,
            khmdhsContractAmendments: amendments,
          };
        }
        return {
          ...row,
          khmdhsAdam: '',
          khmdhsContractSnapshot: null,
          khmdhsContractFetchedAt: '',
          khmdhsContractRoleLabel: '',
          khmdhsContractChainHistory: history,
          khmdhsContractAmendments: amendments,
        };
      }
      return {
        ...row,
        khmdhsContractChainHistory: history,
        khmdhsContractAmendments: amendments,
      };
    });
  }

  if (Array.isArray(next.khmdhsPayments)) {
    next.khmdhsPayments.forEach((p) => {
      noteRemoved(p?.adam || p?.snapshot?.referenceNumber, 'payment');
    });
    next.khmdhsPayments = filterDecisionList(next.khmdhsPayments, cancelledSet);
  }
  if (Array.isArray(next.khmdhsCommitmentDecisions)) {
    next.khmdhsCommitmentDecisions.forEach((d) => {
      noteRemoved(d?.adam || d?.snapshot?.referenceNumber, 'commitment');
    });
    next.khmdhsCommitmentDecisions = filterDecisionList(next.khmdhsCommitmentDecisions, cancelledSet);
  }
  const commitAdam = normalizeCancelledLinkAdam(next.khmdhsCommitmentAdam);
  if (commitAdam && cancelledSet.has(commitAdam)) {
    noteRemoved(commitAdam, 'commitment');
    const rest = next.khmdhsCommitmentDecisions || [];
    if (rest[0]) {
      next.khmdhsCommitmentAdam = rest[0].adam || '';
      next.khmdhsCommitmentSnapshot = rest[0].snapshot || null;
      next.khmdhsCommitmentFetchedAt = rest[0].fetchedAt || '';
    } else {
      next.khmdhsCommitmentAdam = '';
      next.khmdhsCommitmentSnapshot = null;
      next.khmdhsCommitmentFetchedAt = '';
    }
  }

  if (Array.isArray(next.supplementaryContracts)) {
    next.supplementaryContracts = next.supplementaryContracts.filter((row) => {
      if (!row?.khmdhsDerived) return true;
      const adam = normalizeCancelledLinkAdam(row.khmdhsAdam);
      return !adam || !cancelledSet.has(adam);
    });
  }

  if (Array.isArray(next.khmdhsDocumentRegistry)) {
    next.khmdhsDocumentRegistry = next.khmdhsDocumentRegistry.filter((e) => {
      const adam = normalizeCancelledLinkAdam(e?.adam);
      return !adam || !cancelledSet.has(adam);
    });
  }

  const highlight = { ...(meta.highlightAdams || {}) };
  const highlightMap = {
    PROC: normalizeCancelledLinkAdam(next.khmdhsNoticeAdam),
    AWRD: normalizeCancelledLinkAdam(next.khmdhsAwardAdam),
    REQ: normalizeCancelledLinkAdam(next.khmdhsRequestAdam),
    SYMV: normalizeCancelledLinkAdam(next.khmdhsAdam),
  };
  Object.entries(highlightMap).forEach(([key, adam]) => {
    if (cancelledSet.has(normalizeCancelledLinkAdam(highlight[key]))) {
      highlight[key] = adam || null;
    }
  });
  meta.highlightAdams = highlight;
  meta.linkedAdams = linked;
  meta.stageCounts = {
    requests: (linked.requests || []).length,
    approvedRequests: (linked.approvedRequests || []).length,
    notices: (linked.notices || []).length,
    auctions: (linked.auctions || []).length,
    contracts: (linked.contracts || []).length,
    payments: (linked.payments || []).length,
  };
  meta.confirmedCancelledAdams = [...new Set([
    ...(Array.isArray(meta.confirmedCancelledAdams) ? meta.confirmedCancelledAdams : []),
    ...cancelledSet,
  ].map((a) => normalizeCancelledLinkAdam(a)).filter(Boolean))];

  next.khmdhsAdamChainMeta = meta;
  return { form: next, removed, promoted };
}

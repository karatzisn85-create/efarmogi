/**
 * Επίλυση αλυσίδας ΑΔΑΜ ΚΗΜΔΗΣ — επιλογή ενεργών πράξεων, τροποποιήσεις/παρατάσεις.
 */
const {
  normalizeAdam,
  normalizeNoticeAdam,
  normalizeRequestAdam,
  fetchKhmdhsAdamChain,
  fetchKhmdhsContractByAdam,
  fetchKhmdhsNoticeByAdam,
  fetchKhmdhsAuctionByAdam,
  fetchKhmdhsRequestByAdam,
  fetchKhmdhsPaymentByAdam,
  pickKhmdhsNoticeSnapshot,
  pickKhmdhsRequestSnapshot,
  pickKhmdhsPaymentSnapshot,
  pickKhmdhsSnapshot,
  mapKhmdhsToAssignmentProcedure,
  resolveKhmdhsContractAmount,
  applyContractAmountResolution,
  buildKhmdhsAmountContext,
} = require('./khmdhsOpenData');
const { buildKhmdhsDataQualityReport } = require('./khmdhsDataQualityReport');
const { reconcileKhmdhsPayments } = require('./khmdhsPaymentReconciliation');
const { buildKhmdhsSituationReport } = require('./khmdhsSituationReport');
const { contractAmountFallbackWarning } = require('./khmdhsUserCopy');
const {
  resolveChainNodeKind,
  isSupplementaryModificationEntry,
  kindLabelEl,
} = require('./khmdhsChainKindClassifier');
const {
  grossFromCostSnapshot,
  grossFromContractBudget,
  grossFromContractRecord,
  inferKhmdhsVatRate,
  isStandardKhmdhsVatRate,
  formatKhmdhsVatRatePercent,
} = require('./khmdhsVatHelper');
const {
  detectParallelContractSiblings,
  filterSubstantiveParallelSiblings,
  pickContractAdamAmongSiblings,
  validateOrphanSupplementaryCandidate,
  looksLikeSupplementaryContractRecord,
  normalizeAdamRef,
  contractSignedDateKey,
} = require('./khmdhsParallelContracts');
const { parallelContractsExplanation } = require('./khmdhsUserCopy');
const {
  buildParallelContractAmountHints,
  allSiblingsHaveAmountHints,
  enrichContractRecordWithParallelHint,
} = require('./khmdhsParallelContractAmounts');

const MAX_CHAIN_WALK = 24;
const MAX_CANDIDATE_FETCH = 8;
/** Για ανίχνευση παράλληλων συμβάσεων — όλα τα markers, όχι δειγματοληψία 8 */
const MAX_PARALLEL_CONTRACT_FETCH = 64;

function parseChainMarker(raw) {
  const original = String(raw || '').trim();
  let s = original;
  let cancelled = false;
  let modified = false;
  if (s.endsWith('**')) {
    cancelled = true;
    s = s.slice(0, -2);
  } else if (s.endsWith('*')) {
    modified = true;
    s = s.slice(0, -1);
  }
  s = s.toUpperCase().replace(/\s+/g, '');
  return { original, adam: normalizeAdam(s) || normalizeNoticeAdam(s), cancelled, modified };
}

function parseChainLists(chainJson) {
  const chain = chainJson && typeof chainJson === 'object' ? chainJson : {};
  const stages = {
    requests: (chain.requests || []).map(parseChainMarker),
    approvedRequests: (chain.approvedRequests || []).map(parseChainMarker),
    notices: (chain.notices || []).map(parseChainMarker),
    auctions: (chain.auctions || []).map(parseChainMarker),
    contracts: (chain.contracts || []).map(parseChainMarker),
    payments: (chain.payments || []).map(parseChainMarker),
  };
  const skippedCancelled = [];
  Object.keys(stages).forEach((key) => {
    const kept = [];
    stages[key].forEach((m) => {
      if (m.cancelled) skippedCancelled.push({ stage: key, ...m });
      else if (m.adam) kept.push(m);
    });
    stages[key] = kept;
  });
  return { stages, skippedCancelled };
}

const CHAIN_STAGE_KEYS = [
  'requests', 'approvedRequests', 'notices', 'auctions', 'contracts', 'payments',
];

function mergeChainStageLists(base, incoming) {
  const merged = {};
  CHAIN_STAGE_KEYS.forEach((key) => {
    const seen = new Set((base[key] || []).map((m) => m.adam));
    merged[key] = [...(base[key] || [])];
    (incoming[key] || []).forEach((m) => {
      if (m.adam && !seen.has(m.adam)) {
        seen.add(m.adam);
        merged[key].push(m);
      }
    });
  });
  return merged;
}

/**
 * Το adamChain από SYMV/AWRD/PROC συχνά επιστρέφει μόνο 1 approvedRequest,
 * ενώ η πλήρης λίστα Αποφάσεων Ανάληψης Υποχρέωσης βρίσκεται στην αλυσίδα του πρωτογενούς REQ.
 */
async function enrichApprovedRequestsFromPrimary(stages, primaryRequestAdam) {
  const primary = normalizeRequestAdam(primaryRequestAdam);
  if (!primary) return { stages, enriched: false, skippedCancelled: [] };

  const chainRes = await fetchKhmdhsAdamChain(primary);
  if (!chainRes.success) return { stages, enriched: false, skippedCancelled: [] };

  const parsed = parseChainLists(chainRes.adamChain);
  const beforeCount = (stages.approvedRequests || []).length;
  const merged = mergeChainStageLists(stages, {
    approvedRequests: parsed.stages.approvedRequests || [],
  });
  const afterCount = (merged.approvedRequests || []).length;

  return {
    stages: { ...stages, approvedRequests: merged.approvedRequests },
    enriched: afterCount > beforeCount,
    skippedCancelled: parsed.skippedCancelled || [],
  };
}

/**
 * Το adamChain από PROC/AWRD/SYMV ενός κλάδου συχνά έχει 1 σύμβαση·
 * η πλήρης λίστα παράλληλων συμβάσεων/διαγωνισμών/αναθέσεων είναι στο πρωτογενές REQ.
 */
async function enrichActWideStagesFromPrimaryRequest(stages, primaryRequestAdam) {
  const primary = normalizeRequestAdam(primaryRequestAdam);
  if (!primary) return { stages, enriched: false, skippedCancelled: [] };

  const chainRes = await fetchKhmdhsAdamChain(primary);
  if (!chainRes.success) return { stages, enriched: false, skippedCancelled: [] };

  const parsed = parseChainLists(chainRes.adamChain);
  const beforeContracts = (stages.contracts || []).length;
  const beforeNotices = (stages.notices || []).length;
  const beforeAuctions = (stages.auctions || []).length;
  const merged = mergeChainStageLists(stages, parsed.stages);
  const enriched = (
    (merged.contracts || []).length > beforeContracts
    || (merged.notices || []).length > beforeNotices
    || (merged.auctions || []).length > beforeAuctions
  );

  return {
    stages: merged,
    enriched,
    skippedCancelled: parsed.skippedCancelled || [],
  };
}

function resolvePrimaryRequestAdam(stages, request) {
  const primaryMarkers = new Set(
    (stages.requests || []).map((m) => m.adam).filter(Boolean)
  );
  if (request?.adam && primaryMarkers.has(request.adam)) return request.adam;
  return (stages.requests || [])[0]?.adam || request?.adam || null;
}

/** Συλλογή υποψήφιων ΑΔΑΜ πρωτογενούς αιτήματος — επέκταση μέσω adamChain συνδεδεμένων REQ. */
async function collectPrimaryRequestCandidates(stages, extraHints = []) {
  const out = new Set();
  (stages.requests || []).forEach((m) => {
    const a = normalizeRequestAdam(m.adam);
    if (a) out.add(a);
  });
  (extraHints || []).forEach((raw) => {
    const a = normalizeRequestAdam(raw);
    if (a && adamType(a) === 'REQ') out.add(a);
  });

  const expandFrom = [
    ...(stages.approvedRequests || []),
    ...(stages.requests || []),
  ].map((m) => m.adam).filter(Boolean);

  for (const adam of expandFrom.slice(0, MAX_CANDIDATE_FETCH)) {
    const chainRes = await fetchKhmdhsAdamChain(adam);
    if (!chainRes.success) continue;
    const parsed = parseChainLists(chainRes.adamChain);
    (parsed.stages.requests || []).forEach((m) => {
      const a = normalizeRequestAdam(m.adam);
      if (a) out.add(a);
    });
  }
  return [...out];
}

/** Εντοπισμός πρωτογενούς REQ (isInitial) — όχι έγκριση δέσμευσης. */
async function discoverPrimaryRequestAdam(stages, extraHints = []) {
  const candidates = await collectPrimaryRequestCandidates(stages, extraHints);
  if (!candidates.length) return null;

  let fallback = null;
  let fallbackSnap = null;

  for (const adam of candidates) {
    const res = await fetchKhmdhsRequestByAdam(adam);
    if (!res.success || !res.snapshot) continue;
    const snap = res.snapshot;
    if (snap.isInitial === true) {
      return { adam, snapshot: snap };
    }
    if (!fallback) {
      fallback = adam;
      fallbackSnap = snap;
    }
  }

  const primaryMarker = (stages.requests || []).find((m) => m.adam)?.adam;
  if (primaryMarker) {
    const norm = normalizeRequestAdam(primaryMarker);
    if (candidates.includes(norm)) {
      const res = await fetchKhmdhsRequestByAdam(norm);
      if (res.success && res.snapshot) {
        return { adam: norm, snapshot: res.snapshot };
      }
    }
  }

  return fallback ? { adam: fallback, snapshot: fallbackSnap } : null;
}

/**
 * Επανακίνηση πλήρους αλυσίδας από πρωτογενές αίτημα όταν η ανάκτηση ξεκίνησε από μεταγενέστερο κρίκο.
 */
async function reanchorStagesFromPrimaryRequest(stages, { seedNorm, seedType, extraHints = [] } = {}) {
  const discovered = await discoverPrimaryRequestAdam(stages, extraHints);
  if (!discovered?.adam) {
    return { stages, reanchored: false, primaryReqAdam: null, skippedCancelled: [], warning: null };
  }

  const primary = normalizeRequestAdam(discovered.adam);
  const seedReq = seedType === 'REQ' ? normalizeRequestAdam(seedNorm) : null;

  if (seedType === 'REQ' && seedReq === primary && discovered.snapshot?.isInitial) {
    return { stages, reanchored: false, primaryReqAdam: primary, skippedCancelled: [], warning: null };
  }

  const beforeReq = (stages.requests || []).length;
  const beforePay = (stages.payments || []).length;

  const chainRes = await fetchKhmdhsAdamChain(primary);
  if (!chainRes.success) {
    return { stages, reanchored: false, primaryReqAdam: primary, skippedCancelled: [], warning: null };
  }

  const parsed = parseChainLists(chainRes.adamChain);
  const merged = mergeChainStageLists(parsed.stages, stages);
  const afterReq = (merged.requests || []).length;
  const afterPay = (merged.payments || []).length;

  const reanchored = primary !== seedReq || afterReq > beforeReq || afterPay > beforePay;

  return {
    stages: merged,
    reanchored,
    primaryReqAdam: primary,
    skippedCancelled: parsed.skippedCancelled || [],
    warning: reanchored
      ? 'Η αναζήτηση της αλυσίδας επανεκκίνησε από το πρωτογενές αίτημα ώστε να συμπεριληφθούν όλοι οι κρίκοι (αιτήματα, εντάλματα κ.λπ.).'
      : null,
  };
}

/**
 * SYMV σπόρος (π.χ. συμπληρωματική): βρίσκουμε πρωτογενές αίτημα και ξαναφέρνουμε
 * ΟΛΗ την πράξη από εκεί — όχι merge με τη μερική αλυσίδα του σπόρου.
 */
async function rebuildStagesFromPrimaryRequestForSymvSeed(stages, seedNorm) {
  const seed = normalizeAdam(seedNorm);
  let discovered = await discoverPrimaryRequestAdam(stages, []);

  if (!discovered?.adam && seed) {
    const seedRec = await fetchContractRecord(seed);
    const hints = [
      seedRec?.approvedRequestAdam,
      seedRec?.requestRefNo,
      seedRec?.requestAdam,
    ].filter(Boolean);
    if (hints.length) {
      discovered = await discoverPrimaryRequestAdam(stages, hints);
    }
  }

  if (!discovered?.adam) {
    return { stages, rebuilt: false, primaryReqAdam: null, skippedCancelled: [] };
  }

  const primaryReq = normalizeRequestAdam(discovered.adam);
  const primaryFetch = await fetchKhmdhsAdamChain(primaryReq);
  if (!primaryFetch.success) {
    return { stages, rebuilt: false, primaryReqAdam: primaryReq, skippedCancelled: [] };
  }

  const parsed = parseChainLists(primaryFetch.adamChain);
  let newStages = parsed.stages;

  if (seed) {
    const hasSeed = (newStages.contracts || []).some((m) => normalizeAdam(m.adam) === seed);
    if (!hasSeed) {
      const origMarker = (stages.contracts || []).find((m) => normalizeAdam(m.adam) === seed);
      newStages = {
        ...newStages,
        contracts: [
          ...(newStages.contracts || []),
          origMarker || { adam: seed, modified: false, cancelled: false },
        ],
      };
    }
  }

  return {
    stages: newStages,
    rebuilt: true,
    primaryReqAdam: primaryReq,
    skippedCancelled: parsed.skippedCancelled || [],
  };
}

function chainStagesNeedEnrichment(stages) {
  // Συνεχίζουμε enrichment εφόσον λείπει SYMV ή AWRD — διακόπτουμε μόνο όταν και τα δύο βρέθηκαν
  return !stages.contracts.length || !stages.auctions.length;
}

function collectChainEnrichmentCandidates(stages, seedNorm, extraAdams = []) {
  const seed = normalizeAdam(seedNorm) || normalizeNoticeAdam(seedNorm);
  const out = new Set();
  [...(stages.approvedRequests || []), ...(stages.requests || [])].forEach((m) => {
    if (m.adam && m.adam !== seed) out.add(m.adam);
  });
  (extraAdams || []).forEach((raw) => {
    const n = normalizeRequestAdam(raw) || normalizeAdam(raw) || normalizeNoticeAdam(raw);
    if (n && n !== seed) out.add(n);
  });
  return [...out];
}

/**
 * Το adamChain από PROC/AWRD συχνά επιστρέφει ελλιπή λίστα (χωρίς AWRD/SYMV).
 * Συμπληρώνουμε από adamChain συνδεδεμένων REQ / εγκεκριμένων αιτημάτων.
 */
async function enrichChainStagesFromRelatedAdams(stages, seedNorm, extraAdams = []) {
  let merged = stages;
  const extraSkipped = [];
  const tried = new Set(
    [normalizeAdam(seedNorm), normalizeNoticeAdam(seedNorm)].filter(Boolean)
  );
  let pendingExtras = [...(extraAdams || [])];

  while (chainStagesNeedEnrichment(merged) && tried.size < MAX_CANDIDATE_FETCH + 4) {
    const candidates = collectChainEnrichmentCandidates(merged, seedNorm, pendingExtras)
      .filter((a) => !tried.has(a));
    pendingExtras = [];
    if (!candidates.length) break;

    for (const adam of candidates.slice(0, MAX_CANDIDATE_FETCH)) {
      if (!chainStagesNeedEnrichment(merged)) break;
      tried.add(adam);
      const chainRes = await fetchKhmdhsAdamChain(adam);
      if (!chainRes.success) continue;
      const parsed = parseChainLists(chainRes.adamChain);
      extraSkipped.push(...parsed.skippedCancelled);
      merged = mergeChainStageLists(merged, parsed.stages);
    }
  }

  return {
    stages: merged,
    skippedCancelled: extraSkipped,
    enriched: tried.size > 1,
  };
}

async function loadContractRecordsForMarkers(markers, { limit = MAX_CANDIDATE_FETCH } = {}) {
  const map = new Map();
  const cap = Math.max(1, Number(limit) || MAX_CANDIDATE_FETCH);
  for (const m of (markers || []).slice(0, cap)) {
    if (!m?.adam) continue;
    const rec = await fetchContractRecord(m.adam);
    if (rec && !rec.cancelled) {
      // Φυλάσσουμε το modified marker (από '*' στη λίστα ΚΗΜΔΗΣ) στο record
      // ώστε το filterSupplementaryFromParallelRoots να το χρησιμοποιεί
      // ακόμα κι όταν ο τίτλος δεν αναφέρει ρητά «συμπληρωματική».
      map.set(m.adam, m.modified ? { ...rec, _khmdhsModified: true } : rec);
    }
  }
  return map;
}

async function pickInitialContractAdam(markers, seedAdam, { seedType = '' } = {}) {
  const seedHit = pickSeedFromList(markers, seedAdam);
  if (seedHit) {
    const recordsByAdam = await loadContractRecordsForMarkers(markers, { limit: MAX_PARALLEL_CONTRACT_FETCH });
    return {
      adam: seedHit,
      parallelInfo: detectParallelContractSiblings(recordsByAdam),
      parallelFetchTruncated: (markers || []).length > MAX_PARALLEL_CONTRACT_FETCH,
    };
  }

  const recordsByAdam = await loadContractRecordsForMarkers(markers, { limit: MAX_PARALLEL_CONTRACT_FETCH });
  const parallelInfo = detectParallelContractSiblings(recordsByAdam);
  const parallelFetchTruncated = (markers || []).length > MAX_PARALLEL_CONTRACT_FETCH;

  const amongSiblings = pickContractAdamAmongSiblings(recordsByAdam, seedType, seedAdam);
  if (amongSiblings) return { adam: amongSiblings, parallelInfo, parallelFetchTruncated };

  if (parallelInfo.parallel) {
    return { adam: null, parallelInfo, parallelFetchTruncated };
  }

  const plain = (markers || []).filter((m) => !m.modified).map((m) => m.adam).sort();
  const modified = (markers || []).filter((m) => m.modified).map((m) => m.adam).sort();
  let adam = null;
  if (plain.length) adam = plain[0];
  else if (modified.length) adam = modified[modified.length - 1];
  else adam = markers[0]?.adam || null;
  return { adam, parallelInfo, parallelFetchTruncated };
}

/**
 * Όταν ο σπόρος είναι συμπληρωματική χωρίς prev στην αλυσίδα, ξεκινάμε walk από την
 * αρχική σύμβαση που βρέθηκε μέσω πρωτογενούς αιτήματος / ανάθεσης — όχι από τη συμπληρωματική.
 */
async function resolveMainContractEntryForSymvSeed(stages, seedNorm, recordsByAdam, parallelInfo) {
  const seed = normalizeAdam(seedNorm);
  if (!seed) return seed;

  const markers = stages?.contracts || [];
  const seedMarker = markers.find((m) => normalizeAdam(m.adam) === seed);
  let seedRecord = recordsByAdam?.get(seed);
  if (!seedRecord) seedRecord = await fetchContractRecord(seed);

  const seedIsSupplementary = looksLikeSupplementaryContractRecord(seedRecord, {
    modifiedMarker: !!seedMarker?.modified,
  });
  const prevAdam = normalizeAdam(seedRecord?.prevReferenceNo);
  const prevInSet = prevAdam && (
    recordsByAdam?.has(prevAdam)
    || markers.some((m) => normalizeAdam(m.adam) === prevAdam)
  );

  // Αν υπάρχει ηλεκτρονικός δεσμός προς τα πίσω, το walk από τον σπόρο βρίσκει τη ρίζα.
  if (!seedIsSupplementary && prevInSet) return seed;
  if (prevAdam && !seedIsSupplementary) return seed;

  const markerModified = (adam) => {
    const m = markers.find((mm) => normalizeAdam(mm.adam) === normalizeAdam(adam));
    return !!m?.modified;
  };
  const isSuppAdam = (adam) => {
    const rec = recordsByAdam?.get(normalizeAdam(adam));
    return looksLikeSupplementaryContractRecord(rec, { modifiedMarker: markerModified(adam) });
  };

  const siblingRoots = parallelInfo?.siblingRoots || [];
  const mainFromSiblings = siblingRoots.find(
    (a) => normalizeAdam(a) !== seed && !isSuppAdam(a)
  );
  if (mainFromSiblings) return normalizeAdam(mainFromSiblings);

  const plainAdams = markers
    .filter((m) => !m.modified && !m.cancelled)
    .map((m) => normalizeAdam(m.adam))
    .filter((a) => a && a !== seed)
    .sort();
  if (plainAdams.length) return plainAdams[0];

  if (prevAdam && prevAdam !== seed) return prevAdam;

  const auctionRef = normalizeAdamRef(seedRecord?.auctionRefNo);
  if (auctionRef) {
    let best = null;
    let bestDate = '';
    recordsByAdam?.forEach((rec, adam) => {
      const norm = normalizeAdam(adam);
      if (!norm || norm === seed || isSuppAdam(norm)) return;
      if (normalizeAdamRef(rec?.auctionRefNo) !== auctionRef) return;
      const signed = contractSignedDateKey(rec);
      if (!best || (signed && signed < bestDate)) {
        best = norm;
        bestDate = signed;
      }
    });
    if (best) return best;
  }

  return seed;
}

/**
 * Συμπληρωματική χωρίς prev/next στην κύρια αλυσίδα — προστίθεται στο τέλος του walk.
 */
async function attachOrphanSupplementaryToContractWalk(walk, seedNorm, stages) {
  const seed = normalizeAdam(seedNorm);
  if (!walk?.success || !seed || (walk.chain || []).some((c) => c.adam === seed)) {
    return walk;
  }

  const seedRecord = await fetchContractRecord(seed);
  if (!seedRecord || seedRecord.cancelled) return walk;

  const mainAuction = normalizeAdamRef(walk.primaryRecord?.auctionRefNo);
  const seedAuction = normalizeAdamRef(seedRecord?.auctionRefNo);
  if (mainAuction && seedAuction && mainAuction !== seedAuction) return walk;

  const seedMarker = (stages?.contracts || []).find((m) => normalizeAdam(m.adam) === seed);
  const parentRecord = walk.primaryRecord || walk.chain?.[walk.chain.length - 1]?.record;
  const kindResolution = resolveChainNodeKind(parentRecord, seedRecord);
  const kind = kindResolution.kind;
  const label = buildChainNodeLabel(kind, { isRoot: false, isSeed: true, confidence: kindResolution.confidence });

  const chain = [
    ...(walk.chain || []),
    {
      adam: seed,
      kind,
      suggestedKind: kindResolution.suggestedKind,
      confidence: kindResolution.confidence,
      needsReview: !!kindResolution.needsReview,
      isRoot: false,
      isSeed: true,
      label,
      record: seedRecord,
      cancelled: false,
      khmdhsLinkKind: kindResolution.khmdhsLinkKind,
      kindConflict: kindResolution.kindConflict,
      kindReclassified: kindResolution.kindReclassified,
      kindNote: kindResolution.kindNote || (seedMarker?.modified ? 'Ορφανή συμπληρωματική — χωρίς prevReferenceNo στην κύρια αλυσίδα.' : ''),
      kindSignals: kindResolution.kindSignals,
    },
  ];

  return {
    ...walk,
    chain,
    tailAdam: seed,
    selectedAdam: seed,
  };
}

async function resolveContractWalkFromStages(stages, seedType, seedNorm, contractSelectedAdam) {
  let contractEntryAdam = null;
  let parallelInfo = null;

  if (seedType === 'SYMV') {
    const recordsByAdam = await loadContractRecordsForMarkers(stages.contracts, { limit: MAX_PARALLEL_CONTRACT_FETCH });
    parallelInfo = detectParallelContractSiblings(recordsByAdam);
    if ((stages.contracts || []).length > MAX_PARALLEL_CONTRACT_FETCH) {
      parallelInfo = { ...parallelInfo, fetchTruncated: true };
    }
    contractEntryAdam = await resolveMainContractEntryForSymvSeed(
      stages, seedNorm, recordsByAdam, parallelInfo
    );
  } else {
    const pick = await pickInitialContractAdam(stages.contracts, seedNorm, { seedType });
    contractEntryAdam = pick.adam;
    parallelInfo = pick.parallelInfo;
    if (pick.parallelFetchTruncated) {
      parallelInfo = { ...(parallelInfo || {}), fetchTruncated: true };
    }
  }

  if (!contractEntryAdam) {
    return { error: null, walk: null, parallelInfo };
  }

  const requireSelected = seedType === 'SYMV';
  let contractWalk = await resolveFullContractChain(contractEntryAdam, {
    selectedAdam: contractSelectedAdam,
    requireSelected,
  });

  if (!contractWalk.success && requireSelected && contractSelectedAdam) {
    const retryWalk = await resolveFullContractChain(contractEntryAdam, {
      selectedAdam: contractSelectedAdam,
      requireSelected: false,
    });
    if (retryWalk.success) {
      const withOrphan = await attachOrphanSupplementaryToContractWalk(
        retryWalk, contractSelectedAdam, stages
      );
      const seedInChain = (withOrphan.chain || []).some(
        (c) => c.adam === normalizeAdam(contractSelectedAdam)
      );
      if (seedInChain) {
        contractWalk = withOrphan;
      }
    }
  }

  if (!contractWalk.success) return { error: contractWalk.error, walk: null, parallelInfo };
  return { error: null, walk: contractWalk, parallelInfo };
}

function adamType(adam) {
  const m = /^(\d{2})([A-Z]{3,4})(\d{9})$/i.exec(String(adam || ''));
  return m ? m[2].toUpperCase() : '';
}

function toFormDate(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object' && value.value != null) {
    return toFormDate(value.value);
  }
  const s = String(value).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/** Ημ. έναρξης διαδικασίας σύμβασης — από διαγωνισμό (PROC), με εναλλακτικές ημερομηνίες */
function deriveContractProcessStartDate(noticeSnapshot, auctionSnapshot) {
  if (noticeSnapshot) {
    for (const key of ['signedDate', 'finalSubmissionDate', 'submissionDate', 'lastUpdateDate']) {
      const d = toFormDate(noticeSnapshot[key]);
      if (d) return d;
    }
  }
  if (auctionSnapshot) {
    for (const key of ['awardDate', 'signedDate', 'submissionDate']) {
      const d = toFormDate(auctionSnapshot[key]);
      if (d) return d;
    }
  }
  return '';
}

function formatAmountEl(amount) {
  if (amount == null || amount === '') return '';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pickSeedFromList(list, seedAdam) {
  const seed = normalizeAdam(seedAdam) || normalizeNoticeAdam(seedAdam);
  if (!seed) return null;
  const hit = list.find((m) => m.adam === seed);
  return hit ? hit.adam : null;
}

function pickInitialContractAdamFromMarkers(markers, seedAdam) {
  const seedHit = pickSeedFromList(markers, seedAdam);
  if (seedHit) return seedHit;
  const plain = markers.filter((m) => !m.modified).map((m) => m.adam).sort();
  const modified = markers.filter((m) => m.modified).map((m) => m.adam).sort();
  if (plain.length) return plain[0];
  if (modified.length) return modified[modified.length - 1];
  return markers[0]?.adam || null;
}

function classifyLinkKind(fromRecord) {
  if (!fromRecord) return 'amendment';
  if (fromRecord.nextExtended) return 'extension';
  if (fromRecord.nextModified) return 'modification';
  return 'amendment';
}

function chainKindBaseLabel(kind, isRoot) {
  if (isRoot) return 'Αρχική σύμβαση';
  switch (kind) {
    case 'extension': return 'Παράταση';
    case 'modification': return 'Συμπληρωματική σύμβαση';
    case 'republication': return 'Ορθή επανάληψη';
    case 'other': return 'Άλλο';
    case 'uncertain': return 'Χρειάζεται έλεγχος';
    default: return 'Σχετική πράξη';
  }
}

function buildChainNodeLabel(kind, { isRoot, isSeed, confidence = '' } = {}) {
  let base = chainKindBaseLabel(kind, isRoot);
  if (!isRoot && confidence === 'low' && kind !== 'uncertain') {
    base = `${base} (πρόταση)`;
  }
  return isSeed ? `${base} (επιλεγμένη)` : base;
}

async function fetchContractRecord(adam) {
  const normalized = normalizeAdam(adam);
  if (!normalized) return null;
  const res = await fetchKhmdhsContractByAdam(normalized);
  if (!res.success || !res.snapshot) return null;
  return res.snapshot;
}

/**
 * Ανακαλύπτει ολόκληρη την αλυσίδα σύμβασης (prev → root → next → tail).
 * @param {string} entryAdam — οποιοδήποτε ΑΔΑΜ SYMV της αλυσίδας
 * @param {{ selectedAdam?: string|null }} [options]
 *   selectedAdam: ο ΑΔΑΜ που έδωσε ο χήστης — επισημαίνεται, τα πεδία φόρμας αντιστοιχούν σε αυτόν.
 */
async function resolveFullContractChain(entryAdam, options = {}) {
  const entry = normalizeAdam(entryAdam);
  if (!entry) {
    return { success: false, error: 'Μη έγκυρος ΑΔΑΜ σύμβασης.' };
  }

  const skippedCancelledInChain = [];

  const entryRecord = await fetchContractRecord(entry);
  if (!entryRecord) {
    return { success: false, error: `Δεν βρέθηκε σύμβαση ${entry} στο ΚΗΜΔΗΣ.` };
  }
  if (entryRecord.cancelled) {
    return {
      success: false,
      error: `Η σύμβαση ${entry} είναι ακυρωμένη/ματαιωμένη στο ΚΗΜΔΗΣ.`,
      cancelledAdam: entry,
    };
  }

  const selected = normalizeAdam(options.selectedAdam);
  const requireSelected = options.requireSelected === true;

  let rootAdam = entry;
  let rootRecord = entryRecord;
  const visitedBack = new Set([entry]);
  let steps = 0;
  let prev = normalizeAdam(entryRecord.prevReferenceNo);

  while (prev && !visitedBack.has(prev) && steps < MAX_CHAIN_WALK) {
    steps += 1;
    const prevRecord = await fetchContractRecord(prev);
    if (!prevRecord) break;
    if (prevRecord.cancelled) {
      skippedCancelledInChain.push({ adam: prev, direction: 'backward' });
      prev = normalizeAdam(prevRecord.prevReferenceNo);
      continue;
    }
    visitedBack.add(prev);
    rootAdam = prev;
    rootRecord = prevRecord;
    prev = normalizeAdam(prevRecord.prevReferenceNo);
  }

  const chain = [];
  let currentAdam = rootAdam;
  let currentRecord = rootRecord;
  const visitedForward = new Set();
  steps = 0;

  while (currentAdam && !visitedForward.has(currentAdam) && steps < MAX_CHAIN_WALK) {
    visitedForward.add(currentAdam);
    const isRoot = chain.length === 0;
    const parentRecord = isRoot ? null : chain[chain.length - 1].record;
    const kindResolution = isRoot
      ? {
        kind: 'contract',
        suggestedKind: 'contract',
        confidence: 'high',
        khmdhsLinkKind: null,
        needsReview: false,
        kindConflict: false,
        kindReclassified: false,
        kindNote: '',
        kindSignals: [],
      }
      : resolveChainNodeKind(parentRecord, currentRecord);
    const kind = isRoot ? 'contract' : kindResolution.kind;
    const isSeed = requireSelected && selected && currentAdam === selected;

    chain.push({
      adam: currentAdam,
      kind,
      suggestedKind: kindResolution.suggestedKind,
      confidence: kindResolution.confidence,
      needsReview: !!kindResolution.needsReview,
      role: isRoot ? 'original' : kind,
      label: buildChainNodeLabel(kind, {
        isRoot,
        isSeed,
        confidence: kindResolution.confidence,
      }),
      isSeed,
      isRoot,
      record: currentRecord,
      prevAdam: isRoot ? null : chain[chain.length - 1].adam,
      khmdhsLinkKind: kindResolution.khmdhsLinkKind,
      kindConflict: kindResolution.kindConflict,
      kindReclassified: kindResolution.kindReclassified,
      kindNote: kindResolution.kindNote,
      kindSignals: kindResolution.kindSignals,
    });

    const nextAdam = normalizeAdam(currentRecord.nextRefNo);
    if (!nextAdam || nextAdam === currentAdam) break;

    const nextRecord = await fetchContractRecord(nextAdam);
    if (!nextRecord) break;
    if (nextRecord.cancelled) {
      skippedCancelledInChain.push({ adam: nextAdam, direction: 'forward' });
      const skipTo = normalizeAdam(nextRecord.nextRefNo);
      if (skipTo && skipTo !== nextAdam && !visitedForward.has(skipTo)) {
        const skipRecord = await fetchContractRecord(skipTo);
        if (skipRecord && !skipRecord.cancelled) {
          // Επαλήθευση: το skip target πρέπει να αναφέρει το ακυρωμένο ως προηγούμενο κρίκο
          const skipPrev = normalizeAdam(skipRecord.prevReferenceNo);
          if (!skipPrev || skipPrev === nextAdam) {
            currentAdam = skipTo;
            currentRecord = skipRecord;
            steps += 1;
            continue;
          }
        }
      }
      break;
    }
    currentAdam = nextAdam;
    currentRecord = nextRecord;
    steps += 1;
  }

  if (chain.length >= MAX_CHAIN_WALK) {
    return {
      success: false,
      error: `Η αλυσίδα σύμβασης υπερβαίνει το όριο ${MAX_CHAIN_WALK} πράξεων — ελέγξτε χειροκίνητα στο ΚΗΜΔΗΣ.`,
    };
  }

  if (requireSelected && selected) {
    const seedEntry = chain.find((c) => c.adam === selected);
    if (!seedEntry) {
      return {
        success: false,
        error: `Ο ΑΔΑΜ ${selected} δεν ανήκει στην ανακαλυφθείσα αλυσίδα σύμβασης.`,
      };
    }
  }

  const tailAdam = chain[chain.length - 1].adam;
  // Πάντα η κύρια σύμβαση = ο πρωτογενής κρίκος της αλυσίδας (μετά το backward walk).
  // Αν ο χρήστης έδωσε συμπληρωματική/παράταση, το selectedAdam μένει για επισήμανση (isSeed).
  const primaryAdam = rootAdam;
  const primaryRecord = rootRecord;

  return {
    success: true,
    chain,
    rootAdam,
    tailAdam,
    selectedAdam: selected || null,
    primaryAdam,
    primaryRecord,
    skippedCancelledInChain,
  };
}

function enrichChainHistoryEntries(chain, { seedAdam = '', seedType = '', amountContext = null } = {}) {
  const seed = normalizeAdam(seedAdam);
  const symvSeed = seedType === 'SYMV' && seed;
  return (chain || []).map((entry, order) => {
    const isSeed = symvSeed && entry.adam === seed;
    const isRoot = !!entry.isRoot;
    const kind = entry.kind;
    const entryContext = amountContext
      ? {
        ...amountContext,
        linkedContractCount: isRoot ? amountContext.linkedContractCount : 1,
        parallelCase: isRoot ? !!amountContext.parallelCase : false,
        blockSharedAwardFallback: isRoot ? !!amountContext.blockSharedAwardFallback : false,
        allowAwardFallback: isRoot,
      }
      : null;
    const resolvedRecord = entryContext
      ? applyContractAmountResolution(entry.record, entryContext)
      : entry.record;
    const vatRate = entryContext?.contextualVatRate ?? null;
    const displayAmount = grossFromContractRecord(resolvedRecord)
      ?? resolvedRecord.resolvedContractAmount
      ?? (resolvedRecord.contractBudgetSuppressed ? null
        : vatRate != null
          ? grossFromContractBudget(resolvedRecord.contractBudget, vatRate)
          : grossFromContractBudget(resolvedRecord.contractBudget));
    return {
      order,
      adam: entry.adam,
      kind,
      suggestedKind: entry.suggestedKind != null ? entry.suggestedKind : (isRoot ? 'contract' : null),
      confidence: entry.confidence || (isRoot ? 'high' : 'none'),
      needsReview: isRoot ? false : !!entry.needsReview,
      role: entry.role,
      label: entry.label || buildChainNodeLabel(isRoot ? 'contract' : kind, {
        isRoot,
        isSeed,
        confidence: entry.confidence,
      }),
      isSeed,
      isRoot,
      prevAdam: entry.prevAdam || null,
      snapshot: pickKhmdhsSnapshot(resolvedRecord),
      title: resolvedRecord.title || entry.record.title || '',
      contractDate: toFormDate(entry.record.contractSignedDate || entry.record.startDate),
      contractAmount: formatAmountEl(displayAmount),
      contractAmountSource: resolvedRecord.contractAmountSource || '',
      endDate: toFormDate(entry.record.endDate),
      startDate: toFormDate(entry.record.startDate),
      cancelled: !!entry.record.cancelled,
      khmdhsLinkKind: entry.khmdhsLinkKind || null,
      kindConflict: !!entry.kindConflict,
      kindReclassified: !!entry.kindReclassified,
      kindNote: entry.kindNote || '',
      kindSignals: Array.isArray(entry.kindSignals) ? entry.kindSignals : [],
    };
  });
}

/**
 * Προσθέτει συμπληρωματικές της ίδιας ανάθεσης που βρέθηκαν στην πράξη
 * αλλά δεν είναι στον κρίκο prev/next της κύριας αλυσίδας.
 */
function appendActWideSupplementariesToChainHistory(
  chainHistory,
  recordsByAdam,
  markers,
  rootAdam,
  { amountContext = null, seedAdam = '', seedType = '' } = {}
) {
  if (!Array.isArray(chainHistory) || !chainHistory.length || !recordsByAdam?.size) {
    return chainHistory || [];
  }

  const inChain = new Set(chainHistory.map((h) => normalizeAdam(h.adam)).filter(Boolean));
  const root = normalizeAdam(rootAdam);
  const rootRecord = root ? recordsByAdam.get(root) : null;
  const rootAuction = normalizeAdamRef(rootRecord?.auctionRefNo);
  if (!rootAuction) return chainHistory;

  const markerByAdam = new Map(
    (markers || []).map((m) => [normalizeAdam(m.adam), m]).filter(([adam]) => adam)
  );

  const candidates = [];
  recordsByAdam.forEach((record, adam) => {
    const norm = normalizeAdam(adam);
    if (!norm || inChain.has(norm)) return;
    const marker = markerByAdam.get(norm);
    if (!looksLikeSupplementaryContractRecord(record, { modifiedMarker: !!marker?.modified })) return;
    if (normalizeAdamRef(record?.auctionRefNo) !== rootAuction) return;
    candidates.push({ adam: norm, record });
  });

  if (!candidates.length) return chainHistory;

  candidates.sort(
    (a, b) => contractSignedDateKey(a.record).localeCompare(contractSignedDateKey(b.record))
  );

  const parentRecord = rootRecord
    || recordsByAdam.get(chainHistory[chainHistory.length - 1]?.adam)
    || null;

  let order = chainHistory.length;
  const extras = candidates.map(({ adam, record }) => {
    const kindResolution = resolveChainNodeKind(parentRecord, record);
    const entryContext = amountContext
      ? {
        ...amountContext,
        linkedContractCount: 1,
        parallelCase: false,
        blockSharedAwardFallback: false,
        allowAwardFallback: false,
      }
      : null;
    const resolvedRecord = entryContext
      ? applyContractAmountResolution(record, entryContext)
      : record;
    const kind = kindResolution.kind === 'contract' ? 'modification' : kindResolution.kind;
    const entry = {
      order,
      adam,
      kind,
      suggestedKind: 'modification',
      confidence: kindResolution.confidence === 'high' ? 'medium' : (kindResolution.confidence || 'low'),
      needsReview: true,
      role: 'modification',
      label: 'Συμπληρωματική σύμβαση (ίδια ανάθεση)',
      isSeed: seedType === 'SYMV' && adam === normalizeAdam(seedAdam),
      isRoot: false,
      prevAdam: root || null,
      snapshot: pickKhmdhsSnapshot(resolvedRecord),
      title: resolvedRecord.title || record.title || '',
      contractDate: toFormDate(record.contractSignedDate || record.startDate),
      contractAmount: '',
      contractAmountSource: '',
      endDate: toFormDate(record.endDate),
      startDate: toFormDate(record.startDate),
      cancelled: !!record.cancelled,
      khmdhsLinkKind: kindResolution.khmdhsLinkKind || null,
      kindConflict: !!kindResolution.kindConflict,
      kindReclassified: true,
      kindNote: 'Συμπληρωματική της ίδιας ανάθεσης — δεν συνδέεται με prev/next στην κύρια αλυσίδα. Το ποσό συμπληρώνεται από το έγγραφο/PDF.',
      kindSignals: [
        'Χωρίς prevReferenceNo στην κύρια αλυσίδα',
        'Τίτλος συμπληρωματικής',
      ],
      actLinkedSupplementary: true,
    };
    order += 1;
    return entry;
  });

  return [...chainHistory, ...extras];
}

function buildContractSnapshotsByAdam(recordsByAdam) {
  const out = {};
  (recordsByAdam || new Map()).forEach((rec, adam) => {
    const norm = normalizeAdam(adam);
    const snap = pickKhmdhsSnapshot(rec);
    if (norm && snap) out[norm] = snap;
  });
  return out;
}

function deriveSupplementaryContractsFromChainHistory(chainHistory) {
  return (chainHistory || [])
    .filter((h) => isSupplementaryModificationEntry(h))
    .map((h) => ({
      date: h.contractDate || '',
      amount: h.contractAmount || '',
      comments: [h.label || 'Συμπληρωματική σύμβαση', h.adam].filter(Boolean).join(' · '),
      khmdhsAdam: h.adam,
      khmdhsDerived: true,
    }));
}

function isOrphanSymvChainSeed(chainMeta, seedType, request, notice, auction) {
  if (seedType !== 'SYMV') return false;
  if (request?.adam || notice?.adam || auction?.adam) return false;
  const linked = chainMeta?.linkedAdams || {};
  const hasLinkedStages = (
    (linked.requests || []).length > 0
    || (linked.approvedRequests || []).length > 0
    || (linked.notices || []).length > 0
    || (linked.auctions || []).length > 0
  );
  return !hasLinkedStages;
}

/**
 * Αποφάσεις Ανάληψης Υποχρέωσης — όλα τα `approvedRequests` του ΚΗΜΔΗΣ chain.
 *
 * Το ΚΗΜΔΗΣ API ονομάζει «approvedRequests» αποκλειστικά τις Αποφάσεις Ανάληψης
 * Υποχρέωσης (κρίκος 2). Δεν περιέχει ποτέ εγκρίσεις συμπληρωματικής εργασίας.
 * Επιστρέφει { followUps: [], budgetCommitments: [{adam, snapshot, fetchedAt}] }.
 */
async function findFollowUpCommitmentsWithoutContract(stages) {
  const budgetCommitments = [];
  const seen = new Set();
  for (const m of (stages.approvedRequests || [])) {
    if (!m.adam || seen.has(m.adam)) continue;
    seen.add(m.adam);
    const res = await fetchKhmdhsRequestByAdam(m.adam);
    budgetCommitments.push({
      adam: m.adam,
      snapshot: (res.success && res.snapshot) ? res.snapshot : null,
      fetchedAt: new Date().toISOString(),
    });
  }
  return { followUps: [], budgetCommitments };
}

function buildOrphanSupplementaryHistoryEntry(record, adam, amountContext = null) {
  const orphanContext = amountContext
    ? {
      ...amountContext,
      linkedContractCount: 1,
      parallelCase: false,
      blockSharedAwardFallback: false,
      allowAwardFallback: true,
    }
    : null;
  const resolved = orphanContext
    ? applyContractAmountResolution(record, orphanContext)
    : record;
  return {
    order: 0,
    adam,
    kind: 'modification',
    suggestedKind: 'modification',
    confidence: 'low',
    needsReview: true,
    role: 'modification',
    label: 'Συμπληρωματική σύμβαση (χωρίς ηλεκτρονική σύνδεση)',
    isSeed: false,
    isRoot: false,
    prevAdam: null,
    snapshot: pickKhmdhsSnapshot(resolved),
    title: resolved.title || record.title || '',
    contractDate: toFormDate(record.contractSignedDate || record.startDate),
    contractAmount: '',
    contractAmountSource: '',
    endDate: toFormDate(record.endDate),
    startDate: toFormDate(record.startDate),
    cancelled: !!record.cancelled,
    khmdhsLinkKind: null,
    kindConflict: false,
    kindReclassified: false,
    kindNote: 'Ορφανή καταχώριση — δεν συνδέεται ηλεκτρονικά με την κύρια αλυσίδα στο ΚΗΜΔΗΣ. Το ποσό συμπληρώνεται από το έγγραφο/PDF.',
    kindSignals: ['Χωρίς prevReferenceNo / nextRefNo στην κύρια αλυσίδα'],
    orphanSupplementary: true,
  };
}

/**
 * Ανάκτηση ορφανής συμπληρωματικής SYMV και ένταξή της σε υπάρχουσα αλυσίδα (χωρίς αντικατάσταση κύριας).
 */
async function resolveKhmdhsSupplementaryContract(adamRaw, options = {}) {
  const adam = normalizeAdam(adamRaw);
  if (!adam) {
    return { success: false, error: 'Μη έγκυρος ΑΔΑΜ σύμβασης.' };
  }
  if (adamType(adam) !== 'SYMV') {
    return { success: false, error: 'Ο κωδικός συμπληρωματικής πρέπει να είναι σύμβαση (SYMV).' };
  }
  const existing = new Set((options.existingChainAdams || []).map((a) => normalizeAdam(a)).filter(Boolean));
  if (existing.has(adam)) {
    return { success: false, error: 'Αυτός ο ΑΔΑΜ υπάρχει ήδη στην αλυσίδα του υποέργου.' };
  }
  const primaryAdam = normalizeAdam(options.primaryContractAdam);
  if (primaryAdam && adam === primaryAdam) {
    return { success: false, error: 'Ο κωδικός συμπληρωματικής δεν μπορεί να είναι ο ίδιος με την αρχική σύμβαση.' };
  }

  const res = await fetchKhmdhsContractByAdam(adam);
  if (!res.success || !res.snapshot) {
    return { success: false, error: res.error || 'Δεν βρέθηκε σύμβαση στο ΚΗΜΔΗΣ.' };
  }
  if (res.snapshot.cancelled) {
    return { success: false, error: `Η σύμβαση ${adam} είναι ακυρωμένη/ματαιωμένη στο ΚΗΜΔΗΣ.` };
  }

  let primaryRecord = null;
  if (primaryAdam) {
    primaryRecord = await fetchContractRecord(primaryAdam);
  }

  const validation = validateOrphanSupplementaryCandidate(res.snapshot, adam, {
    primaryContractAdam: primaryAdam,
    primaryContractRecord: primaryRecord,
    existingChainAdams: options.existingChainAdams || [],
  });
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }

  const chainHistoryEntry = buildOrphanSupplementaryHistoryEntry(res.snapshot, adam, options.amountContext);
  const supplementary = {
    date: chainHistoryEntry.contractDate || '',
    amount: chainHistoryEntry.contractAmount || '',
    comments: [chainHistoryEntry.label, adam].filter(Boolean).join(' · '),
    khmdhsAdam: adam,
    khmdhsDerived: true,
    orphanSupplementary: true,
  };

  return {
    success: true,
    supplementary,
    chainHistoryEntry,
    snapshot: pickKhmdhsSnapshot(res.snapshot),
    fetchedAt: new Date().toISOString(),
  };
}

function buildChainHighlightAdams(seedNorm, seedType, resolved) {
  const out = { REQ: null, PROC: null, AWRD: null, SYMV: null };
  if (!seedNorm || !seedType) return out;
  if (seedType === 'REQ') out.REQ = seedNorm;
  else if (seedType === 'PROC') out.PROC = normalizeNoticeAdam(seedNorm) || seedNorm;
  else if (seedType === 'AWRD') out.AWRD = seedNorm;
  else if (seedType === 'SYMV') out.SYMV = seedNorm;
  if (resolved?.request?.adam) out.REQ = out.REQ || resolved.request.adam;
  if (resolved?.notice?.adam) out.PROC = out.PROC || resolved.notice.adam;
  if (resolved?.auction?.adam) out.AWRD = out.AWRD || resolved.auction.adam;
  if (resolved?.contract?.adam) out.SYMV = out.SYMV || resolved.contract.adam;
  return out;
}

function chainHistoryToAmendments(history) {
  return (history || []).filter((h) => !h.isRoot);
}

function summarizeContractChainHistory(history, selectedAdam) {
  if (!history?.length) return '';
  const counts = {
    original: 0, extension: 0, modification: 0,
    republication: 0, other: 0, uncertain: 0, amendment: 0,
  };
  history.forEach((h) => {
    const effective = h.userKind || h.effectiveKind || h.kind;
    const key = h.isRoot ? 'original' : (effective || 'amendment');
    if (counts[key] != null) counts[key] += 1;
    else counts.amendment += 1;
  });
  const parts = [];
  if (counts.original) parts.push(`${counts.original} αρχική σύμβαση`);
  if (counts.extension) parts.push(`${counts.extension} παράταση/εις`);
  if (counts.modification) parts.push(`${counts.modification} συμπληρωματική/ές`);
  if (counts.republication) parts.push(`${counts.republication} ορθή/ές επανάληψη/εις`);
  if (counts.other) parts.push(`${counts.other} άλλη/ες πράξη/εις`);
  if (counts.uncertain) parts.push(`${counts.uncertain} προς έλεγχο`);
  if (counts.amendment) parts.push(`${counts.amendment} σχετική/ές πράξη/εις`);
  const summary = parts.join(', ');
  const seedNote = selectedAdam && history.some((h) => h.isSeed && !h.isRoot)
    ? ` Επιλεγμένος ΑΔΑΜ: ${selectedAdam}.`
    : '';
  return `Ανακαλύφθηκε αλυσίδα ${history.length} πράξεων (${summary}).${seedNote}`;
}

/** @deprecated — χρήση resolveFullContractChain */
async function walkContractChain(startAdam, options = {}) {
  const selected = normalizeAdam(options.anchorAdam || options.selectedAdam || startAdam);
  return resolveFullContractChain(startAdam, { selectedAdam: selected });
}

async function fetchNoticeRecord(adam, { allowCancelled = false } = {}) {
  const nAdam = normalizeNoticeAdam(adam) || normalizeAdam(adam);
  if (!nAdam || adamType(nAdam) !== 'PROC') return null;
  const res = await fetchKhmdhsNoticeByAdam(nAdam);
  if (!res.success || !res.snapshot) return null;
  const snap = pickKhmdhsNoticeSnapshot(res.snapshot);
  if (!snap || (!allowCancelled && snap.cancelled)) return null;
  return { adam: nAdam, snapshot: snap, raw: res.snapshot };
}

async function fetchNoticeIfActive(adam) {
  return fetchNoticeRecord(adam, { allowCancelled: false });
}

async function fetchRequestRecord(adam, { allowCancelled = false } = {}) {
  const rAdam = normalizeRequestAdam(adam);
  if (!rAdam) return null;
  const res = await fetchKhmdhsRequestByAdam(rAdam);
  if (!res.success || !res.snapshot) return null;
  const snap = pickKhmdhsRequestSnapshot(res.snapshot);
  if (!snap || (!allowCancelled && snap.cancelled)) return null;
  return { adam: rAdam, snapshot: snap, raw: res.snapshot };
}

async function fetchRequestIfActive(adam) {
  return fetchRequestRecord(adam, { allowCancelled: false });
}

async function fetchAuctionRecord(adam, { allowCancelled = false } = {}) {
  const aAdam = normalizeAdam(adam);
  if (!aAdam || adamType(aAdam) !== 'AWRD') return null;
  const res = await fetchKhmdhsAuctionByAdam(aAdam);
  if (!res.success || !res.snapshot) return null;
  const snap = res.snapshot;
  if (!snap || (!allowCancelled && snap.cancelled)) return null;
  return { adam: aAdam, snapshot: snap };
}

function stageLabelEl(seedType) {
  const labels = {
    REQ: 'πρωτογενές αίτημα',
    PROC: 'δημοσίευση',
    AWRD: 'ανάθεση',
    SYMV: 'σύμβαση',
    PAY: 'ένταλμα πληρωμής',
  };
  return labels[seedType] || 'έγγραφο';
}

function plainAmountSourcePhrase(source) {
  const s = String(source || '').trim();
  if (/σύμβαση/i.test(s)) return 'από τη σύμβαση στο ΚΗΜΔΗΣ';
  if (/ανάθεση/i.test(s) || /awrd/i.test(s)) return 'από την απόφαση ανάθεσης';
  if (/διαγων/i.test(s) || /proc/i.test(s) || /δημοσιεύ/i.test(s)) return 'από τη δημοσίευση';
  return 'από συνδεδεμένη πράξη της ίδιας υπόθεσης';
}

function warnIfCancelledSeed(warnings, seedType, adam, snapshot) {
  if (!snapshot?.cancelled) return;
  const label = stageLabelEl(seedType);
  warnings.push(
    `Ο κωδικός ${adam} (${label}) είναι ακυρωμένος ή ματαιωμένος στο ΚΗΜΔΗΣ — εμφανίζονται όσα στοιχεία υπάρχουν ακόμα.`
  );
}

async function resolveSeedDirectRecord(seedNorm, seedType) {
  if (seedType === 'REQ') {
    return fetchRequestRecord(seedNorm, { allowCancelled: true });
  }
  if (seedType === 'PROC') {
    return fetchNoticeRecord(seedNorm, { allowCancelled: true });
  }
  if (seedType === 'AWRD') {
    return fetchAuctionRecord(seedNorm, { allowCancelled: true });
  }
  if (seedType === 'SYMV') {
    const res = await fetchKhmdhsContractByAdam(seedNorm);
    if (!res.success || !res.snapshot) return null;
    const snap = pickKhmdhsSnapshot(res.snapshot);
    if (!snap) return null;
    return { adam: seedNorm, snapshot: snap, record: res.snapshot };
  }
  return null;
}

async function resolveRequestAdam(stages, seedAdam, noticeSnapshot) {
  const candidateAdams = new Set();
  const hint = normalizeRequestAdam(noticeSnapshot?.approvedRequestAdam);
  if (hint) candidateAdams.add(hint);
  const seed = normalizeRequestAdam(seedAdam);
  if (seed && adamType(seed) === 'REQ') candidateAdams.add(seed);
  (stages.requests || []).forEach((m) => { if (m.adam) candidateAdams.add(m.adam); });
  (stages.approvedRequests || []).forEach((m) => { if (m.adam) candidateAdams.add(m.adam); });

  const ordered = [];
  const seen = new Set();
  [...(stages.requests || []).map((m) => m.adam), ...candidateAdams].forEach((a) => {
    const norm = normalizeRequestAdam(a);
    if (!norm || seen.has(norm)) return;
    seen.add(norm);
    ordered.push(norm);
  });

  for (const c of ordered.slice(0, MAX_CANDIDATE_FETCH)) {
    const fetched = await fetchRequestIfActive(c);
    if (fetched?.snapshot?.isInitial) return fetched;
  }

  if (hint) {
    const fetched = await fetchRequestIfActive(hint);
    if (fetched) return fetched;
  }

  if (seed && adamType(seed) === 'REQ') {
    const fetched = await fetchRequestIfActive(seed);
    if (fetched) return fetched;
    const cancelledSeed = await fetchRequestRecord(seed, { allowCancelled: true });
    if (cancelledSeed) return cancelledSeed;
  }

  for (const c of ordered.slice(0, MAX_CANDIDATE_FETCH)) {
    const fetched = await fetchRequestIfActive(c);
    if (fetched) return fetched;
  }
  return null;
}

function buildRequestFormFields(snapshot) {
  if (!snapshot) return {};
  const gross = grossFromCostSnapshot(snapshot);
  return { projectBudget: gross != null ? formatAmountEl(gross) : '' };
}

const MAX_PAYMENT_FETCH = 15;

/** Έγκριση δέσμευσης (ΑΠΟΦΑΣΗ ΑΝΑΛΗΨΗΣ ΥΠΟΧΡΕΩΣΗΣ) — εγκεκριμένο αίτημα REQ, διακριτό από το πρωτογενές */
async function resolveCommitmentDecision(stages, excludeAdam) {
  const exclude = normalizeAdam(excludeAdam) || excludeAdam || null;
  for (const m of (stages.approvedRequests || [])) {
    if (!m.adam || m.adam === exclude) continue;
    const res = await fetchKhmdhsRequestByAdam(m.adam);
    if (res.success && res.snapshot) {
      return { adam: m.adam, snapshot: res.snapshot };
    }
  }
  return null;
}

/** Χρηματικά εντάλματα πληρωμής (PAY) — μπορεί να είναι πολλαπλά ανά σύμβαση.
 *  @param {object} stages
 *  @param {Set<string>} knownContractAdams — οι ΑΔΑΜ συμβάσεων της τρέχουσας αλυσίδας
 *  @param {Set<string>} knownRequestAdams  — οι ΑΔΑΜ αιτημάτων (REQ) της τρέχουσας αλυσίδας
 *  @param {Date|null}   earliestContractDate — η παλαιότερη ημ/νία σύμβασης (PAY πριν από αυτή = άσχετο)
 */
async function resolvePayments(
  stages,
  knownContractAdams = new Set(),
  knownRequestAdams = new Set(),
  earliestContractDate = null,
) {
  const out = [];
  const allPayments = stages.payments || [];
  const payFetchTruncated = allPayments.length > MAX_PAYMENT_FETCH;
  const list = allPayments.slice(0, MAX_PAYMENT_FETCH);
  for (const m of list) {
    if (!m.adam) continue;
    const res = await fetchKhmdhsPaymentByAdam(m.adam);
    if (res.success && res.snapshot) {
      const snap = res.snapshot;
      const payContractRef = normalizeAdam(snap.contractRefNo);
      const payRequestRef = normalizeAdam(snap.requestRefNo);

      let isUnrelated = false;
      let unrelatedReason = null;

      if (payContractRef && knownContractAdams.size > 0 && !knownContractAdams.has(payContractRef)) {
        // Ο ΑΔΑΜ σύμβασης που αναφέρει το ένταλμα δεν ανήκει στην αλυσίδα
        isUnrelated = true;
        unrelatedReason = snap.contractRefNo;
      } else if (!payContractRef && payRequestRef && knownRequestAdams.size > 0 && !knownRequestAdams.has(payRequestRef)) {
        // Δεν υπάρχει contractRefNo — fallback: ελέγχουμε αν το REQ είναι γνωστό
        isUnrelated = true;
        unrelatedReason = snap.requestRefNo;
      }

      // Ένταλμα ΠΡΙΝ από την υπογραφή σύμβασης = αδύνατο, άρα άσχετο
      // Χρησιμοποιούμε signedDate (ημ/νία έκδοσης) ή submissionDate ως fallback
      if (!isUnrelated && earliestContractDate instanceof Date) {
        const rawPayDate = snap.signedDate || snap.submissionDate || '';
        if (rawPayDate) {
          const payD = new Date(rawPayDate);
          if (!isNaN(payD.getTime()) && payD < earliestContractDate) {
            isUnrelated = true;
            unrelatedReason = `ημ/νία εντάλματος (${rawPayDate}) προ σύμβασης`;
          }
        }
      }

      if (isUnrelated) {
        // Αποκλεισμός από τη λίστα — καταγράφεται στα skippedUnrelated για το DQR
        out._skippedUnrelated = out._skippedUnrelated || [];
        out._skippedUnrelated.push({ adam: m.adam, unrelatedContractRef: unrelatedReason, snapshot: snap });
        continue;
      }
      out.push({
        adam: m.adam,
        snapshot: snap,
        fetchedAt: new Date().toISOString(),
      });
    } else {
      out.push({ adam: m.adam, snapshot: null, error: res.error || 'Δεν ανακτήθηκαν στοιχεία.' });
    }
  }
  out._payFetchTruncated = payFetchTruncated;
  out._totalPaymentsInChain = allPayments.length;
  return out;
}

/** Άθροισμα ενταλμάτων (με ΦΠΑ) για σύγκριση με το συμβατικό ποσό */
function sumPaymentsGross(payments) {
  let total = 0;
  let count = 0;
  (payments || []).forEach((p) => {
    const g = grossFromCostSnapshot(p?.snapshot);
    if (g != null && Number.isFinite(g)) { total += g; count += 1; }
  });
  return { total, count };
}

function deriveSuggestedApeAmount(contractWalk, contractChainHistory) {
  const history = Array.isArray(contractChainHistory) ? contractChainHistory : [];
  const root = history.find((h) => h.isRoot);
  if (!root?.snapshot) return '';
  const primaryGross = grossFromContractRecord(root.snapshot)
    ?? (root.snapshot?.contractBudgetSuppressed ? null : grossFromContractBudget(root.snapshot?.contractBudget));
  if (primaryGross == null || !Number.isFinite(primaryGross)) return '';
  const mods = history.filter(
    (h) => isSupplementaryModificationEntry(h) && h.snapshot?.contractBudget != null
  );
  if (!mods.length) return '';
  const lastMod = mods[mods.length - 1];
  const revisedGross = grossFromContractBudget(lastMod.snapshot.contractBudget);
  if (revisedGross == null || !Number.isFinite(revisedGross) || revisedGross <= primaryGross) return '';
  return formatAmountEl(revisedGross - primaryGross);
}

async function resolveNoticeAdam(noticeMarkers, seedAdam, contractRecord, auctionRecord) {
  const hints = [
    contractRecord?.noticeReferenceNumber,
    auctionRecord?.noticeReferenceNumber,
  ].map((h) => normalizeNoticeAdam(h)).filter(Boolean);

  for (const hint of hints) {
    const fetched = await fetchNoticeIfActive(hint);
    if (fetched) return fetched;
  }

  const seed = normalizeNoticeAdam(seedAdam);
  if (seed && adamType(seed) === 'PROC') {
    const fetched = await fetchNoticeIfActive(seed);
    if (fetched) return fetched;
    const cancelledSeed = await fetchNoticeRecord(seed, { allowCancelled: true });
    if (cancelledSeed) return cancelledSeed;
  }

  const candidates = noticeMarkers.map((m) => m.adam).slice(0, MAX_CANDIDATE_FETCH);
  const fetchedList = [];
  for (const c of candidates) {
    const f = await fetchNoticeIfActive(c);
    if (f) fetchedList.push(f);
  }
  if (!fetchedList.length) return null;

  const byAdam = new Map(fetchedList.map((f) => [f.adam, f]));
  const amendedBy = new Map();
  fetchedList.forEach((f) => {
    const parent = normalizeNoticeAdam(f.snapshot?.amendedNoticeADAM || f.raw?.amendedNoticeADAM);
    if (parent && byAdam.has(parent)) amendedBy.set(parent, f.adam);
  });

  const leaves = fetchedList.filter((f) => !amendedBy.has(f.adam));
  if (leaves.length >= 1) {
    return leaves.sort((a, b) => String(b.adam).localeCompare(String(a.adam)))[0];
  }
  return fetchedList.sort((a, b) => String(b.adam).localeCompare(String(a.adam)))[0];
}

async function resolveAuctionAdam(auctionMarkers, seedAdam, contractRecord) {
  const hints = [];
  const contractHint = normalizeAdam(contractRecord?.auctionRefNo);
  if (contractHint) hints.push(contractHint);

  for (const hint of hints) {
    const fetched = await fetchAuctionRecord(hint, { allowCancelled: false });
    if (fetched) return fetched;
  }

  const seed = normalizeAdam(seedAdam);
  if (seed && adamType(seed) === 'AWRD') {
    const fetched = await fetchAuctionRecord(seed, { allowCancelled: false });
    if (fetched) return fetched;
    const cancelledSeed = await fetchAuctionRecord(seed, { allowCancelled: true });
    if (cancelledSeed) return cancelledSeed;
  }

  const candidates = (auctionMarkers || []).map((m) => m.adam).slice(0, MAX_CANDIDATE_FETCH);
  const fetchedList = [];
  for (const c of candidates) {
    const f = await fetchAuctionRecord(c, { allowCancelled: false });
    if (f) fetchedList.push(f);
  }
  if (!fetchedList.length) return null;

  const byAdam = new Map(fetchedList.map((f) => [f.adam, f]));
  const amendedBy = new Map();
  fetchedList.forEach((f) => {
    const parent = normalizeAdam(f.snapshot?.amendedAuctionADAM);
    if (parent && byAdam.has(parent)) amendedBy.set(parent, f.adam);
  });

  const leaves = fetchedList.filter((f) => !amendedBy.has(f.adam));
  if (leaves.length >= 1) {
    return leaves.sort((a, b) => String(b.adam).localeCompare(String(a.adam)))[0];
  }
  return fetchedList.sort((a, b) => String(b.adam).localeCompare(String(a.adam)))[0];
}

function mapNoticeProcedure(snapshot) {
  if (!snapshot) return '';
  const stored = String(snapshot.mappedAssignmentProcedure || '').trim();
  if (stored) return stored;
  return mapKhmdhsToAssignmentProcedure(snapshot) || String(snapshot.typeOfProcedure || '').trim();
}

function buildContractFormFields(record, primaryAdam) {
  if (!record) return {};
  // grossFromContractRecord ελέγχει ήδη contractBudgetSuppressed —
  // δεν κάνουμε fallback στο contractBudget αν είναι αναξιόπιστο.
  const gross = grossFromContractRecord(record)
    ?? (record.contractBudgetSuppressed ? null : grossFromContractBudget(record.contractBudget));
  return {
    contractDate: toFormDate(record.contractSignedDate || record.startDate),
    contractAmount: formatAmountEl(gross),
    contractEndDate: record.noEndDate ? '' : toFormDate(record.endDate),
    // Σημαία: το ποσό εσκεμμένα κενό λόγω παράλληλης σύμβασης —
    // ο renderer δεν πρέπει να κάνει fallback σε αποθηκευμένο παλιό ποσό.
    contractAmountSuppressed: record.contractBudgetSuppressed === true,
    khmdhsAdam: primaryAdam,
  };
}


async function resolveKhmdhsAdamChain(seedAdamRaw, opts = {}) {
  const seedAdam = String(seedAdamRaw || '').trim().toUpperCase().replace(/\*+$/, '');
  const seedNorm = normalizeAdam(seedAdam) || normalizeNoticeAdam(seedAdam);
  if (!seedNorm) {
    return { success: false, error: 'Μη έγκυρος ΑΔΑΜ.' };
  }

  const seedType = adamType(seedNorm);
  const warnings = [];
  let skippedCancelled = [];

  let chainRes = await fetchKhmdhsAdamChain(seedNorm);
  let stages;
  let symvRebuiltFromPrimary = false;
  let symvPrimaryReqAdam = null;

  if (!chainRes.success) {
    if (seedType === 'SYMV') {
      const direct = await fetchContractRecord(seedNorm);
      if (direct && !direct.cancelled) {
        warnings.push(
          'Δεν βρέθηκε ηλεκτρονική αλυσίδα ΑΔΑΜ — ανακτήθηκε μόνο η σύμβαση. Τα στοιχεία προκύπτουν από την καταχώριση της σύμβασης.'
        );
        stages = {
          requests: [],
          approvedRequests: [],
          notices: [],
          auctions: [],
          contracts: [{ adam: seedNorm, modified: false, cancelled: false }],
          payments: [],
        };
      } else {
        return { success: false, error: chainRes.error || 'Αποτυχία ανάκτησης αλυσίδας ΑΔΑΜ.' };
      }
    } else if (seedType === 'PAY') {
      // Fallback: άμεση ανάκτηση εντάλματος όταν η αλυσίδα αποτύχει
      const directPay = await fetchKhmdhsPaymentByAdam(seedNorm);
      if (directPay?.success && directPay.snapshot) {
        const snap = directPay.snapshot;
        warnings.push(
          'Δεν βρέθηκε ηλεκτρονική αλυσίδα ΑΔΑΜ — ανακτήθηκε μόνο το ένταλμα πληρωμής. Τα στοιχεία προκύπτουν από την καταχώριση του εντάλματος.'
        );
        if (snap.cancelled) {
          warnings.push('Το ένταλμα πληρωμής έχει ακυρωθεί στο ΚΗΜΔΗΣ.');
        }
        const contractAdam = snap.contractRefNo ? normalizeAdam(snap.contractRefNo) : null;
        stages = {
          requests: [],
          approvedRequests: [],
          notices: [],
          auctions: [],
          contracts: contractAdam ? [{ adam: contractAdam, modified: false, cancelled: false }] : [],
          payments: [{ adam: seedNorm, modified: false, cancelled: !!snap.cancelled }],
        };
      } else {
        return { success: false, error: chainRes.error || 'Αποτυχία ανάκτησης αλυσίδας ΑΔΑΜ. Το ένταλμα πληρωμής δεν βρέθηκε.' };
      }
    } else {
      return { success: false, error: chainRes.error || 'Αποτυχία ανάκτησης αλυσίδας ΑΔΑΜ.' };
    }
  } else {
    const parsed = parseChainLists(chainRes.adamChain);
    stages = parsed.stages;
    skippedCancelled = [...parsed.skippedCancelled];
  }

  const stagesBeforeEnrich = {
    contracts: stages.contracts.length,
    auctions: stages.auctions.length,
  };

  const enrich1 = await enrichChainStagesFromRelatedAdams(stages, seedNorm);
  stages = enrich1.stages;
  skippedCancelled.push(...enrich1.skippedCancelled);
  if (enrich1.enriched && (
    stagesBeforeEnrich.contracts !== stages.contracts.length
    || stagesBeforeEnrich.auctions !== stages.auctions.length
  )) {
    warnings.push(
      'Η αλυσίδα συμπληρώθηκε μέσω συνδεδεμένου αιτήματος — όταν ξεκινάτε από δημοσίευση, το ΚΗΜΔΗΣ δεν επιστρέφει πάντα ανάθεση ή σύμβαση.'
    );
  }

  if (seedType === 'SYMV') {
    const symvRebuild = await rebuildStagesFromPrimaryRequestForSymvSeed(stages, seedNorm);
    if (symvRebuild.rebuilt) {
      stages = symvRebuild.stages;
      skippedCancelled.push(...(symvRebuild.skippedCancelled || []));
      symvRebuiltFromPrimary = true;
      symvPrimaryReqAdam = symvRebuild.primaryReqAdam;
      warnings.push(
        `Η ανάκτηση ολοκληρώθηκε από το πρωτογενές αίτημα ${symvRebuild.primaryReqAdam} (ξεκινήσατε από ${seedNorm}).`
      );
    }
  } else if (seedType !== 'REQ') {
    const earlyReanchor = await reanchorStagesFromPrimaryRequest(stages, {
      seedNorm,
      seedType,
      extraHints: [],
    });
    if (earlyReanchor.reanchored) {
      stages = earlyReanchor.stages;
      skippedCancelled.push(...(earlyReanchor.skippedCancelled || []));
      if (earlyReanchor.warning) warnings.push(earlyReanchor.warning);
    }
  }

  let contractWalk = null;
  let contractChainHistory = [];
  let contractSelectedAdam = null;
  if (seedType === 'SYMV') {
    contractSelectedAdam = seedNorm;
  }

  let contractRes = await resolveContractWalkFromStages(
    stages, seedType, seedNorm, contractSelectedAdam
  );
  if (contractRes?.error) warnings.push(contractRes.error);
  contractWalk = contractRes?.walk || null;
  let parallelContractInfo = contractRes?.parallelInfo || null;

  let auction = await resolveAuctionAdam(
    stages.auctions,
    seedNorm,
    contractWalk?.primaryRecord || null
  );

  // Εμπλουτισμός: αν η AWRD έχει contractRefNos που δεν είναι στα stages.contracts
  // (π.χ. SYMV seed επέστρεψε μόνο τη δική του αλυσίδα χωρίς τα siblings),
  // τα προσθέτουμε και επανυπολογίζουμε το parallelContractInfo.
  // Μετά πλήρη ανάκτηση από πρωτογενές αίτημα, τα stages είναι ήδη πλήρη.
  if (!symvRebuiltFromPrimary && auction?.snapshot?.contractRefNos?.length > 1) {
    const stageAdams = new Set((stages.contracts || []).map((m) => normalizeAdam(m.adam)).filter(Boolean));
    const missingSymvs = (auction.snapshot.contractRefNos || [])
      .map((a) => normalizeAdam(a))
      .filter((a) => a && !stageAdams.has(a));
    if (missingSymvs.length > 0) {
      stages = {
        ...stages,
        contracts: [
          ...stages.contracts,
          ...missingSymvs.map((a) => ({ adam: a, modified: false, cancelled: false })),
        ],
      };
      const recordsByAdam = await loadContractRecordsForMarkers(stages.contracts, { limit: MAX_PARALLEL_CONTRACT_FETCH });
      const enrichedParallelInfo = detectParallelContractSiblings(recordsByAdam);
      if (enrichedParallelInfo.parallel || !parallelContractInfo?.parallel) {
        parallelContractInfo = enrichedParallelInfo;
      }
    }
  }

  let request = null;
  if (seedType === 'REQ') {
    request = await resolveRequestAdam(stages, seedNorm, null);
  }

  let notice = await resolveNoticeAdam(
    stages.notices,
    seedType === 'PROC' ? seedNorm : '',
    contractWalk?.primaryRecord,
    auction?.snapshot
  );

  if (!contractWalk && notice?.snapshot?.approvedRequestAdam) {
    const enrich2 = await enrichChainStagesFromRelatedAdams(
      stages,
      seedNorm,
      [notice.snapshot.approvedRequestAdam]
    );
    if (enrich2.enriched) {
      stages = enrich2.stages;
      skippedCancelled.push(...enrich2.skippedCancelled);
      contractRes = await resolveContractWalkFromStages(
        stages, seedType, seedNorm, contractSelectedAdam
      );
      if (contractRes?.error && !contractWalk) warnings.push(contractRes.error);
      if (contractRes?.walk) contractWalk = contractRes.walk;
      if (contractRes?.parallelInfo) parallelContractInfo = contractRes.parallelInfo;
      if (!auction) {
        auction = await resolveAuctionAdam(stages.auctions, seedNorm, contractWalk?.primaryRecord);
      }
    }
  }

  if (!request) {
    request = await resolveRequestAdam(stages, seedNorm, notice?.snapshot);
  }

  const lateReanchor = symvRebuiltFromPrimary
    ? { reanchored: false, stages, skippedCancelled: [], warning: null, primaryReqAdam: symvPrimaryReqAdam }
    : await reanchorStagesFromPrimaryRequest(stages, {
      seedNorm,
      seedType,
      extraHints: [
        notice?.snapshot?.approvedRequestAdam,
        request?.adam,
      ].filter(Boolean),
    });
  if (lateReanchor.reanchored) {
    stages = lateReanchor.stages;
    skippedCancelled.push(...(lateReanchor.skippedCancelled || []));
    if (lateReanchor.warning) warnings.push(lateReanchor.warning);
    if (!request || !request.snapshot?.isInitial) {
      request = await resolveRequestAdam(stages, seedNorm, notice?.snapshot);
    }
    contractRes = await resolveContractWalkFromStages(
      stages, seedType, seedNorm, contractSelectedAdam
    );
    if (contractRes?.error) warnings.push(contractRes.error);
    contractWalk = contractRes?.walk || contractWalk;
    if (contractRes?.parallelInfo) parallelContractInfo = contractRes.parallelInfo;
    if (!auction) {
      auction = await resolveAuctionAdam(stages.auctions, seedNorm, contractWalk?.primaryRecord);
    }
    if (!notice) {
      notice = await resolveNoticeAdam(
        stages.notices,
        seedType === 'PROC' ? seedNorm : '',
        contractWalk?.primaryRecord,
        auction?.snapshot
      );
    }
  }

  // Έγκριση δέσμευσης (εγκεκριμένο αίτημα) — διακριτή από το πρωτογενές
  let commitmentDecision = await resolveCommitmentDecision(stages, null);
  // Αν ο αντιπροσωπευτικός «request» ταυτίζεται με την έγκριση, προσπάθησε να φέρεις το πρωτογενές χωριστά
  if (request && commitmentDecision && request.adam === commitmentDecision.adam) {
    const primaryMarker = (stages.requests || []).find((mm) => mm.adam && mm.adam !== commitmentDecision.adam);
    if (primaryMarker) {
      const pr = await fetchKhmdhsRequestByAdam(primaryMarker.adam);
      if (pr.success && pr.snapshot) request = { adam: primaryMarker.adam, snapshot: pr.snapshot };
    }
  }
  // Αν υπάρχει μόνο ένα REQ, μην το διπλασιάζεις
  if (request && commitmentDecision && request.adam === commitmentDecision.adam) {
    commitmentDecision = null;
  }

  const discoveredPrimary = await discoverPrimaryRequestAdam(stages, [
    notice?.snapshot?.approvedRequestAdam,
    request?.adam,
    lateReanchor?.primaryReqAdam,
  ].filter(Boolean));
  const primaryRequestAdam = discoveredPrimary?.adam
    || resolvePrimaryRequestAdam(stages, request);
  if (primaryRequestAdam) {
    const commitEnrich = await enrichApprovedRequestsFromPrimary(stages, primaryRequestAdam);
    if (commitEnrich.enriched) {
      stages = commitEnrich.stages;
      skippedCancelled.push(...(commitEnrich.skippedCancelled || []));
      warnings.push(
        'Βρέθηκαν επιπλέον Αποφάσεις Ανάληψης Υποχρέωσης μέσω του πρωτογενούς αιτήματος — το ΚΗΜΔΗΣ δεν τις επιστρέφει πάντα όταν ξεκινάτε από σύμβαση ή ανάθεση.'
      );
    }

    const actEnrich = symvRebuiltFromPrimary
      ? { stages, enriched: false, skippedCancelled: [] }
      : await enrichActWideStagesFromPrimaryRequest(stages, primaryRequestAdam);
    if (actEnrich.enriched) {
      stages = actEnrich.stages;
      skippedCancelled.push(...(actEnrich.skippedCancelled || []));
      warnings.push(
        'Βρέθηκαν επιπλέον συμβάσεις ή κλάδοι μέσω του πρωτογενούς αιτήματος — όταν ξεκινάτε από μια δημοσίευση ή σύμβαση, το ΚΗΜΔΗΣ δεν επιστρέφει πάντα όλη την πράξη.'
      );
      const recordsByAdam = await loadContractRecordsForMarkers(stages.contracts, {
        limit: MAX_PARALLEL_CONTRACT_FETCH,
      });
      const enrichedParallelInfo = detectParallelContractSiblings(recordsByAdam);
      if (
        enrichedParallelInfo.siblingRoots?.length > (parallelContractInfo?.siblingRoots?.length || 0)
        || (enrichedParallelInfo.parallel && !parallelContractInfo?.parallel)
      ) {
        parallelContractInfo = enrichedParallelInfo;
      }
      if (seedType === 'SYMV') {
        contractRes = await resolveContractWalkFromStages(
          stages, seedType, seedNorm, contractSelectedAdam
        );
        if (contractRes?.error) warnings.push(contractRes.error);
        if (contractRes?.walk) contractWalk = contractRes.walk;
        if (contractRes?.parallelInfo) parallelContractInfo = contractRes.parallelInfo;
        if (!auction) {
          auction = await resolveAuctionAdam(stages.auctions, seedNorm, contractWalk?.primaryRecord);
        }
      }
    }
  }

  // Σύνολο γνωστών ΑΔΑΜ συμβάσεων — χρησιμοποιείται για φιλτράρισμα άσχετων ενταλμάτων
  // Συμπεριλαμβάνουμε και τροποποιήσεις/παρατάσεις από chain walk
  const knownContractAdams = new Set(
    (stages.contracts || []).map((m) => normalizeAdam(m.adam)).filter(Boolean)
  );
  if (contractWalk?.primaryAdam) knownContractAdams.add(contractWalk.primaryAdam);
  (contractWalk?.chain || []).forEach((entry) => {
    if (entry?.adam) knownContractAdams.add(normalizeAdam(entry.adam));
  });

  // Σύνολο γνωστών ΑΔΑΜ αιτήσεων (REQ) — fallback αν δεν υπάρχει contractRefNo
  const knownRequestAdams = new Set([
    ...(stages.requests || []).map((m) => normalizeAdam(m.adam)).filter(Boolean),
    ...(stages.approvedRequests || []).map((m) => normalizeAdam(m.adam)).filter(Boolean),
  ]);
  if (seedType === 'REQ' && seedNorm) knownRequestAdams.add(seedNorm);

  // Παλαιότερη ημ/νία σύμβασης — ένταλμα πριν από αυτή είναι εξ ορισμού άσχετο
  let earliestContractDate = null;
  const contractDateCandidates = [];
  if (contractWalk?.primaryRecord?.contractSignedDate) contractDateCandidates.push(contractWalk.primaryRecord.contractSignedDate);
  if (contractWalk?.primaryRecord?.startDate) contractDateCandidates.push(contractWalk.primaryRecord.startDate);
  (contractWalk?.chain || []).forEach((c) => {
    if (c.record?.contractSignedDate) contractDateCandidates.push(c.record.contractSignedDate);
    if (c.record?.startDate) contractDateCandidates.push(c.record.startDate);
  });
  if (contractDateCandidates.length > 0) {
    const parsed = contractDateCandidates.map((d) => new Date(d)).filter((d) => !isNaN(d.getTime()));
    if (parsed.length > 0) earliestContractDate = new Date(Math.min(...parsed.map((d) => d.getTime())));
  }

  const payments = await resolvePayments(stages, knownContractAdams, knownRequestAdams, earliestContractDate);
  const skippedUnrelatedPayments = payments._skippedUnrelated || [];
  const payFetchTruncated = !!payments._payFetchTruncated;
  const totalPaymentsInChain = payments._totalPaymentsInChain || 0;
  delete payments._skippedUnrelated;
  delete payments._payFetchTruncated;
  delete payments._totalPaymentsInChain;

  const noticeVatRate = inferKhmdhsVatRate(
    notice?.snapshot?.totalCostWithoutVAT,
    notice?.snapshot?.totalCostWithVAT
  );
  const auctionVatRate = inferKhmdhsVatRate(
    auction?.snapshot?.totalCostWithoutVAT,
    auction?.snapshot?.totalCostWithVAT
  );
  const contextualVatRate = !isStandardKhmdhsVatRate(auctionVatRate)
    ? auctionVatRate
    : (!isStandardKhmdhsVatRate(noticeVatRate) ? noticeVatRate : null);

  const actContractRecords = await loadContractRecordsForMarkers(stages.contracts, {
    limit: MAX_PARALLEL_CONTRACT_FETCH,
  });
  const refreshedParallelInfo = detectParallelContractSiblings(actContractRecords);
  if ((refreshedParallelInfo.siblingRoots || []).length) {
    parallelContractInfo = {
      ...parallelContractInfo,
      ...refreshedParallelInfo,
      fetchTruncated: parallelContractInfo?.fetchTruncated || false,
    };
  }

  const amountContext = buildKhmdhsAmountContext({
    stages,
    contractWalk,
    parallelContractInfo,
    auctionSnapshot: auction?.snapshot || null,
    noticeSnapshot: notice?.snapshot || null,
    contextualVatRate,
  });

  if (contextualVatRate != null) {
    warnings.push(
      `Στα στοιχεία της υπόθεσης εμφανίζεται ΦΠΑ ${formatKhmdhsVatRatePercent(contextualVatRate)} — τα καθαρά ποσά σύμβασης υπολογίζονται με αυτόν τον συντελεστή.`
    );
  }

  let parallelContractSiblings = parallelContractInfo?.parallel
    ? (parallelContractInfo.siblingRoots || [])
    : [];

  if (parallelContractSiblings.length < 2) {
    const refreshedRoots = refreshedParallelInfo?.siblingRoots || [];
    if (refreshedRoots.length > 1) {
      parallelContractSiblings = refreshedRoots;
    }
  }
  if (parallelContractSiblings.length < 2) {
    const awardRefs = (auction?.snapshot?.contractRefNos || [])
      .map((a) => normalizeAdam(a))
      .filter(Boolean);
    const uniqueAward = [...new Set(awardRefs)];
    if (uniqueAward.length > 1) {
      parallelContractSiblings = uniqueAward;
    }
  }

  // Ο χρήστης έδωσε συμπληρωματική/παράταση — μία αλυσίδα, όχι «Πολλές Συμβάσεις».
  const seedIsNonRootSymvLink = (
    seedType === 'SYMV'
    && contractWalk?.rootAdam
    && contractWalk?.selectedAdam
    && contractWalk.rootAdam !== contractWalk.selectedAdam
  );
  if (seedIsNonRootSymvLink) {
    parallelContractSiblings = [contractWalk.rootAdam];
    warnings.push(
      `Ξεκινήσατε από ${contractWalk.selectedAdam} (συμπληρωματική/τροποποίηση) — η κύρια σύμβαση είναι ${contractWalk.rootAdam}. Ανακτήθηκε ολόκληρη η αλυσίδα.`
    );
  }

  const parallelContractCandidates = [...parallelContractSiblings];
  parallelContractSiblings = filterSubstantiveParallelSiblings(
    actContractRecords,
    parallelContractSiblings
  );
  if (
    parallelContractCandidates.length > parallelContractSiblings.length
    && parallelContractSiblings.length <= 1
  ) {
    warnings.push(
      'Στην αλυσίδα εμφανίζονται πράξεις SYMV που δεν είναι συμβάσεις (π.χ. διακήρυξη ή απόφαση). Επιλέξτε ποιες καταχωρείτε στο υποέργο.'
    );
  }

  let parallelContractAmountsByAdam = {};
  let parallelAmountsFullyInferred = false;
  if (parallelContractSiblings.length > 1) {
    parallelContractAmountsByAdam = buildParallelContractAmountHints({
      siblingAdams: parallelContractSiblings,
      payments,
    });
    parallelAmountsFullyInferred = allSiblingsHaveAmountHints(
      parallelContractSiblings,
      parallelContractAmountsByAdam
    );

    if (parallelAmountsFullyInferred) {
      warnings.push(
        `Βρέθηκαν ${parallelContractSiblings.length} ανεξάρτητες συμβάσεις — τα ποσά προτάθηκαν αυτόματα από εντάλματα πληρωμής. Ελέγξτε και διορθώστε αν δεν συμφωνούν με τα συμφωνητικά.`
      );
    } else if (seedType !== 'SYMV' && !contractWalk) {
      warnings.push(parallelContractsExplanation(parallelContractSiblings.length));
    } else {
      warnings.push(
        `Στην ίδια υπόθεση υπάρχουν ${parallelContractSiblings.length} ανεξάρτητες συμβάσεις — τα στοιχεία αφορούν τον ΑΔΑΜ ${contractWalk?.primaryAdam || seedNorm}.`
      );
    }

    if (contractWalk?.primaryRecord && contractWalk?.primaryAdam) {
      contractWalk.primaryRecord = enrichContractRecordWithParallelHint(
        contractWalk.primaryRecord,
        contractWalk.primaryAdam,
        parallelContractAmountsByAdam
      );
      contractWalk.primaryRecord = applyContractAmountResolution(
        contractWalk.primaryRecord,
        amountContext
      );
    }
  }

  if (parallelContractInfo?.fetchTruncated) {
    warnings.push(
      `Στην υπόθεση εμφανίζονται πάνω από ${MAX_PARALLEL_CONTRACT_FETCH} συμβάσεις — η ανίχνευση παράλληλων υποθέσεων μπορεί να είναι ελλιπής. Ελέγξτε χειροκίνητα τα ποσά ανά σύμβαση.`
    );
  }

  if (payFetchTruncated) {
    warnings.push(
      `Στην αλυσίδα εντοπίστηκαν ${totalPaymentsInChain} εντάλματα πληρωμής — ανακτήθηκαν μόνο τα ${MAX_PAYMENT_FETCH}. Ελέγξτε χειροκίνητα στο ΚΗΜΔΗΣ για πλήρη εικόνα.`
    );
  }

  if (contractWalk?.primaryRecord) {
    contractWalk.primaryRecord = applyContractAmountResolution(
      contractWalk.primaryRecord,
      amountContext
    );
  }

  // Έλεγχος: σε παράλληλη υπόθεση, το ποσό μιας μεμονωμένης σύμβασης
  // δεν μπορεί να υπερβαίνει το σύνολο ανάθεσης — αν το υπερβαίνει,
  // είναι βέβαια λάθος καταχώριση στο ΚΗΜΔΗΣ.
  if (parallelContractInfo?.parallel && contractWalk?.primaryRecord) {
    const resolvedBudget = Number(contractWalk.primaryRecord.contractBudget);
    const awardTotal = Number(auction?.snapshot?.totalCostWithoutVAT);
    if (Number.isFinite(resolvedBudget) && Number.isFinite(awardTotal) && resolvedBudget > awardTotal * 1.005) {
      const fmtBudget = resolvedBudget.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const fmtAward = awardTotal.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      warnings.push(
        `Προσοχή: Το ποσό σύμβασης που εμφανίζεται στο ΚΗΜΔΗΣ (${fmtBudget}€ χωρίς ΦΠΑ) υπερβαίνει το συνολικό ποσό ανάθεσης (${fmtAward}€) — αδύνατο για μία από τις ${parallelContractSiblings.length} παράλληλες συμβάσεις. Πιθανό λάθος καταχώρισης στο ΚΗΜΔΗΣ. Ελέγξτε το υπογεγραμμένο συμφωνητικό (PDF) και διορθώστε χειροκίνητα το ποσό.`
      );
    }
  }

  if (contractWalk?.chain?.length) {
    contractChainHistory = enrichChainHistoryEntries(contractWalk.chain, {
      seedAdam: seedNorm,
      seedType,
      amountContext,
    });
    contractChainHistory = appendActWideSupplementariesToChainHistory(
      contractChainHistory,
      actContractRecords,
      stages.contracts,
      contractWalk.rootAdam,
      { amountContext, seedAdam: seedNorm, seedType }
    );
    const actSupp = parallelContractInfo?.actSupplementaryAdams || [];
    if (actSupp.length) {
      warnings.push(
        `Βρέθηκε συμπληρωματική σύμβαση της ίδιας ανάθεσης (${actSupp.join(', ')}) — χαρακτηρίστε την πράξη και δηλώστε το ποσό από το έγγραφο/PDF.`
      );
    }

    const chainSummary = summarizeContractChainHistory(
      contractChainHistory,
      seedType === 'SYMV' ? seedNorm : null
    );
    if (chainSummary) warnings.push(chainSummary);

    if (contractWalk.skippedCancelledInChain?.length) {
      warnings.push(
        `Παραλείφθηκαν ${contractWalk.skippedCancelledInChain.length} ακυρωμένες πράξεις στη μέση της αλυσίδας — ελέγξτε χειροκίνητα αν λείπει κάτι.`
      );
    }

    if (
      contractWalk.primaryRecord?.resolvedContractAmount != null
      && contractWalk.primaryRecord?.contractBudget == null
    ) {
      const srcPhrase = plainAmountSourcePhrase(contractWalk.primaryRecord.contractAmountSource);
      warnings.push(
        contractAmountFallbackWarning(
          formatAmountEl(contractWalk.primaryRecord.resolvedContractAmount),
          srcPhrase
        )
      );
    }
  }

  if (skippedCancelled.length) {
    warnings.push(`Παραλείφθηκαν ${skippedCancelled.length} ακυρωμένες/ματαιωμένες πράξεις (/**/).`);
  }

  if (!contractWalk && seedType === 'PROC' && notice) {
    warnings.push('Στα δεδομένα του ΚΗΜΔΗΣ βρέθηκε δημοσίευση, αλλά όχι συνδεδεμένη ηλεκτρονική σύμβαση — η φυσική σύμβαση μπορεί να υπάρχει ήδη στον φάκελό σας.');
  }

  if (!contractWalk && !notice && !auction && !request) {
    const directSeed = await resolveSeedDirectRecord(seedNorm, seedType);
    if (directSeed) {
      if (seedType === 'REQ') request = directSeed;
      else if (seedType === 'PROC') notice = directSeed;
      else if (seedType === 'AWRD') auction = directSeed;
      else if (seedType === 'SYMV') {
        contractWalk = {
          success: true,
          primaryAdam: seedNorm,
          rootAdam: seedNorm,
          tailAdam: seedNorm,
          primaryRecord: directSeed.record || directSeed.snapshot,
          chain: [{
            adam: seedNorm,
            record: directSeed.record || directSeed.snapshot,
            isRoot: true,
          }],
        };
        warnings.push(
          'Ανακτήθηκε μόνο η σύμβαση χωρίς ηλεκτρονικά συνδεδεμένη αλυσίδα — ελέγξτε χειροκίνητα αν λείπουν δημοσίευση/ανάθεση.'
        );
      }
    }
  }

  if (contractWalk?.chain?.length && !contractChainHistory.length) {
    if (contractWalk.primaryRecord) {
      contractWalk.primaryRecord = applyContractAmountResolution(
        contractWalk.primaryRecord,
        amountContext
      );
    }
    contractChainHistory = enrichChainHistoryEntries(contractWalk.chain, {
      seedAdam: seedNorm,
      seedType,
      amountContext,
    });
    if (contractChainHistory.length) {
      const chainSummary = summarizeContractChainHistory(
        contractChainHistory,
        seedType === 'SYMV' ? seedNorm : null
      );
      if (chainSummary) warnings.push(chainSummary);
    }
  }

  const contractAmendments = chainHistoryToAmendments(contractChainHistory);

  const primaryContractSnap = contractWalk?.primaryRecord
    ? pickKhmdhsSnapshot(contractWalk.primaryRecord)
    : null;

  const mappedProcedure = notice ? mapNoticeProcedure(notice.snapshot) : '';
  const noticeProcessStart = deriveContractProcessStartDate(notice?.snapshot, auction?.snapshot);

  const derivedSupplementaryContracts = deriveSupplementaryContractsFromChainHistory(contractChainHistory);

  const chainMeta = {
    seedAdam: seedNorm,
    seedType,
    actRootReqAdam: primaryRequestAdam || discoveredPrimary?.adam || null,
    resolvedAt: new Date().toISOString(),
    skippedCancelled: skippedCancelled.map((s) => ({ stage: s.stage, adam: s.original })),
    stageCounts: {
      requests: stages.requests.length,
      approvedRequests: stages.approvedRequests.length,
      notices: stages.notices.length,
      auctions: stages.auctions.length,
      contracts: stages.contracts.length,
      payments: stages.payments.length,
    },
    linkedAdams: {
      requests: stages.requests.map((m) => m.adam),
      approvedRequests: stages.approvedRequests.map((m) => m.adam),
      budgetCommitments: [],
      notices: stages.notices.map((m) => m.adam),
      auctions: stages.auctions.map((m) => m.adam),
      contracts: stages.contracts.map((m) => m.adam),
      payments: stages.payments.map((m) => m.adam),
    },
    contractChain: contractChainHistory.map((h) => ({
      adam: h.adam,
      kind: h.kind,
      label: h.label,
      isSeed: h.isSeed,
      isRoot: h.isRoot,
    })),
    contractRootAdam: contractWalk?.rootAdam || null,
    contractTailAdam: contractWalk?.tailAdam || null,
    parallelContractCandidates,
    parallelContracts: parallelContractSiblings,
    hasParallelContracts: parallelContractSiblings.length > 1,
    parallelContractAmountsByAdam,
    parallelAmountsFullyInferred,
    contractSnapshotsByAdam: buildContractSnapshotsByAdam(actContractRecords),
    actSupplementaryAdams: parallelContractInfo?.actSupplementaryAdams || [],
  };

  const followUpResult = await findFollowUpCommitmentsWithoutContract(stages);
  const followUpCommitmentsWithoutContract = followUpResult.followUps;
  const allBudgetCommitments = followUpResult.budgetCommitments; // [{adam, snapshot, fetchedAt}]
  const budgetCommitmentAdamSet = new Set(allBudgetCommitments.map((b) => b.adam));

  // Αποθήκευση πλήρων δεδομένων για όλες τις Αποφάσεις Ανάληψης Υποχρέωσης στο chainMeta
  chainMeta.linkedAdams.budgetCommitments = [...budgetCommitmentAdamSet];
  chainMeta.allBudgetCommitments = allBudgetCommitments; // με snapshots
  chainMeta.linkedAdams.approvedRequests = chainMeta.linkedAdams.approvedRequests
    .filter((a) => !budgetCommitmentAdamSet.has(a));

  const isOrphanSymvSeed = isOrphanSymvChainSeed(
    chainMeta,
    seedType,
    request,
    notice,
    auction
  );

  chainMeta.followUpCommitmentsWithoutContract = followUpCommitmentsWithoutContract;
  chainMeta.isOrphanSymvSeed = isOrphanSymvSeed;

  chainMeta.highlightAdams = buildChainHighlightAdams(seedNorm, seedType, {
    request,
    notice,
    auction,
    contract: contractWalk ? { adam: contractWalk.primaryAdam } : null,
  });

  if (request?.snapshot?.cancelled) {
    warnIfCancelledSeed(warnings, 'REQ', request.adam, request.snapshot);
  }
  if (notice?.snapshot?.cancelled) {
    warnIfCancelledSeed(warnings, 'PROC', notice.adam, notice.snapshot);
  }
  if (auction?.snapshot?.cancelled) {
    warnIfCancelledSeed(warnings, 'AWRD', auction.adam, auction.snapshot);
  }

  const hasAnything = contractWalk || notice || auction || request
    || commitmentDecision || (payments && payments.length);
  if (!hasAnything) {
    const onlyCancelled = skippedCancelled.some(
      (s) => s.adam === seedNorm || parseChainMarker(seedNorm).adam === s.adam
    );
    const situationReport = buildKhmdhsSituationReport({
      success: false,
      error: onlyCancelled
        ? `Ο ΑΔΑΜ ${seedNorm} είναι ακυρωμένος/ματαιωμένος στο ΚΗΜΔΗΣ (/**/) και δεν βρέθηκαν ενεργές συνδεδεμένες πράξεις.`
        : 'Δεν βρέθηκαν ενεργές συνδεδεμένες πράξεις για αυτόν τον ΑΔΑΜ.',
      warnings,
      chainMeta,
      request,
      notice,
      auction,
      contract: null,
    });
    return {
      success: false,
      error: onlyCancelled
        ? `Ο ΑΔΑΜ ${seedNorm} είναι ακυρωμένος/ματαιωμένος στο ΚΗΜΔΗΣ (/**/) και δεν βρέθηκαν ενεργές συνδεδεμένες πράξεις.`
        : 'Δεν βρέθηκαν ενεργές συνδεδεμένες πράξεις για αυτόν τον ΑΔΑΜ.',
      chainMeta,
      warnings,
      situationReport,
    };
  }

  const summaryParts = [];
  if (contractWalk?.primaryAdam) summaryParts.push('σύμβαση');
  if (notice?.adam) summaryParts.push('δημοσίευση');
  if (auction?.adam) summaryParts.push('ανάθεση');
  if (contractChainHistory.length > 1) {
    summaryParts.push(`αλυσίδα ${contractChainHistory.length} πράξεων`);
  } else if (contractAmendments.length) {
    summaryParts.push(`${contractAmendments.length} συμπληρωματική ή παράταση`);
  }
  if (request?.adam) summaryParts.push('πρωτογενές αίτημα');
  if (commitmentDecision?.adam) summaryParts.push('έγκριση δέσμευσης');
  if (payments && payments.length) {
    summaryParts.push(`${payments.length} ένταλμα/τα πληρωμής`);
  }

  const requestFormFields = request ? buildRequestFormFields(request.snapshot) : {};
  const suggestedApeAmount = deriveSuggestedApeAmount(contractWalk, contractChainHistory);

  const dataQualityReport = buildKhmdhsDataQualityReport({
    primaryRecord: contractWalk?.primaryRecord || null,
    amountContext,
    notice,
    request,
    auction,
    contract: contractWalk ? {
      adam: contractWalk.primaryAdam,
      primaryAdam: contractWalk.primaryAdam,
      rootAdam: contractWalk.rootAdam,
      snapshot: primaryContractSnap,
    } : null,
    mappedProcedure,
    noticeProcessStart,
    contractChainHistory,
    chainMeta,
    contractIndex: null,
    payments,
    skippedUnrelatedPayments,
    apeAmount: opts.apeAmount ?? null,
  });

  const situationReport = buildKhmdhsSituationReport({
    success: true,
    warnings,
    chainMeta,
    request,
    notice,
    auction,
    contract: contractWalk ? { adam: contractWalk.primaryAdam } : null,
    dataQualityReport,
    isOrphanSymvSeed,
    followUpCommitmentsWithoutContract,
    derivedSupplementaryCount: derivedSupplementaryContracts.length,
  });

  return {
    success: true,
    summary: summaryParts.join(', '),
    warnings,
    chainMeta,
    suggestedApeAmount,
    dataQualityReport,
    situationReport,
    contract: contractWalk ? {
      adam: contractWalk.primaryAdam,
      snapshot: primaryContractSnap,
      formFields: buildContractFormFields(contractWalk.primaryRecord, contractWalk.primaryAdam),
      fetchedAt: new Date().toISOString(),
      role: contractChainHistory.find((h) => h.adam === contractWalk?.primaryAdam)?.role
        || (contractWalk?.rootAdam === contractWalk?.primaryAdam ? 'original' : 'contract'),
      roleLabel: contractChainHistory.find((h) => h.adam === contractWalk?.primaryAdam)?.label
        || 'Αρχική σύμβαση',
    } : null,
    contractChainHistory,
    contractAmendments,
    derivedSupplementaryContracts,
    notice: notice ? {
      adam: notice.adam,
      snapshot: notice.snapshot,
      mappedAssignmentProcedure: mappedProcedure,
      contractProcessStartDate: noticeProcessStart,
      fetchedAt: new Date().toISOString(),
    } : null,
    auction: auction ? {
      adam: auction.adam,
      snapshot: auction.snapshot,
      fetchedAt: new Date().toISOString(),
    } : null,
    request: request ? {
      adam: request.adam,
      snapshot: request.snapshot,
      formFields: requestFormFields,
      projectBudget: requestFormFields.projectBudget || '',
      fetchedAt: new Date().toISOString(),
    } : null,
    commitmentDecision: commitmentDecision ? {
      adam: commitmentDecision.adam,
      snapshot: commitmentDecision.snapshot,
      fetchedAt: new Date().toISOString(),
    } : null,
    commitmentDecisions: allBudgetCommitments.map((b) => ({
      adam: b.adam,
      snapshot: b.snapshot,
      fetchedAt: b.fetchedAt,
    })),
    payments: (payments || []).map((p) => ({
      adam: p.adam,
      snapshot: p.snapshot || null,
      error: p.error || '',
      fetchedAt: p.fetchedAt || new Date().toISOString(),
    })),
    paymentsSummary: (() => {
      const s = sumPaymentsGross(payments);
      const contractingOrg = auction?.snapshot?.organization || '';
      const contractGross = contractWalk?.primaryRecord?.resolvedContractAmount ?? null;
      const recon = reconcileKhmdhsPayments(payments, {
        contractAmountGross: contractGross,
        contractingOrg,
      });
      return {
        count: payments ? payments.length : 0,
        withAmount: s.count,
        totalGross: s.total,
        rawTotalGross: recon.rawTotalGross,
        estimatedContractorPaymentGross: recon.estimatedContractorPaymentGross,
        coFinancingPattern: recon.coFinancingPattern?.id || null,
        needsReview: recon.needsReview,
      };
    })(),
    requests: {
      primary: stages.requests[0]?.adam || stages.approvedRequests[0]?.adam || null,
      all: [
        ...stages.requests.map((m) => m.adam),
        ...stages.approvedRequests.map((m) => m.adam),
      ],
    },
  };
}

module.exports = {
  resolveKhmdhsAdamChain,
  resolveKhmdhsSupplementaryContract,
  resolveFullContractChain,
  deriveContractProcessStartDate,
  parseChainMarker,
  parseChainLists,
};

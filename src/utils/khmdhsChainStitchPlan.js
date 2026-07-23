/**
 * Σχέδιο χειροκίνητης συρραφής αλυσίδας ΚΗΜΔΗΣ (multi-seed).
 * Phase 1: helpers + detection. Confirmed plan για μελλοντικές ανανεώσεις σε επόμενη φάση.
 */

export const KHMDHS_STITCH_PLAN_VERSION = 1;

export const KHMDHS_STITCH_STAGE_IDS = [
  'REQ',
  'COMMIT',
  'PROC',
  'AWRD',
  'SYMV',
  'PAY',
];

function sanitizeAdam(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .replace(/\*+$/, '')
    .slice(0, 16);
}

export function normalizeStitchAdam(value) {
  return sanitizeAdam(value);
}

/** Υπάρχουν ήδη ουσιαστικά δεδομένα ΚΗΜΔΗΣ στο υποέργο; */
export function projectHasSubstantialKhmdhsData(form) {
  if (!form || typeof form !== 'object') return false;
  if (sanitizeAdam(form.khmdhsRequestAdam) || form.khmdhsRequestSnapshot) return true;
  if (sanitizeAdam(form.khmdhsCommitmentAdam) || form.khmdhsCommitmentSnapshot) return true;
  if (Array.isArray(form.khmdhsCommitmentDecisions) && form.khmdhsCommitmentDecisions.length > 0) {
    return true;
  }
  if (sanitizeAdam(form.khmdhsNoticeAdam) || form.khmdhsNoticeSnapshot) return true;
  if (sanitizeAdam(form.khmdhsAwardAdam) || form.khmdhsAwardSnapshot) return true;
  if (sanitizeAdam(form.khmdhsAdam) || form.khmdhsContractSnapshot) return true;
  if (Array.isArray(form.khmdhsPayments) && form.khmdhsPayments.length > 0) return true;
  if (Array.isArray(form.khmdhsContractChainHistory) && form.khmdhsContractChainHistory.length > 0) {
    return true;
  }
  return false;
}

/** Στάδια που υπάρχουν ήδη αποθηκευμένα στο υποέργο (με snapshot ή ΑΔΑΜ). */
export function detectStagesCoveredByForm(form) {
  const covered = [];
  if (!form || typeof form !== 'object') return covered;
  if (sanitizeAdam(form.khmdhsRequestAdam) || form.khmdhsRequestSnapshot) covered.push('REQ');
  if (
    sanitizeAdam(form.khmdhsCommitmentAdam)
    || form.khmdhsCommitmentSnapshot
    || (Array.isArray(form.khmdhsCommitmentDecisions) && form.khmdhsCommitmentDecisions.length > 0)
  ) {
    covered.push('COMMIT');
  }
  if (sanitizeAdam(form.khmdhsNoticeAdam) || form.khmdhsNoticeSnapshot) covered.push('PROC');
  if (sanitizeAdam(form.khmdhsAwardAdam) || form.khmdhsAwardSnapshot) covered.push('AWRD');
  if (sanitizeAdam(form.khmdhsAdam) || form.khmdhsContractSnapshot) covered.push('SYMV');
  if (Array.isArray(form.khmdhsPayments) && form.khmdhsPayments.length > 0) covered.push('PAY');
  return covered;
}

/** Στάδια που πραγματικά ήρθαν από ένα chainRes (με snapshot όπου απαιτείται). */
export function detectStagesCoveredByChainRes(chainRes) {
  const covered = [];
  if (!chainRes?.success) return covered;
  if (chainRes.request?.snapshot && sanitizeAdam(chainRes.request.adam)) covered.push('REQ');
  const commits = Array.isArray(chainRes.commitmentDecisions)
    ? chainRes.commitmentDecisions
    : (chainRes.commitmentDecision?.adam ? [chainRes.commitmentDecision] : []);
  const hasCommit = commits.some((d) => d && (d.snapshot || d.adam));
  const metaCommits = chainRes.chainMeta?.allBudgetCommitments;
  if (hasCommit || (Array.isArray(metaCommits) && metaCommits.length > 0)) {
    covered.push('COMMIT');
  }
  if (chainRes.notice?.snapshot && sanitizeAdam(chainRes.notice.adam)) covered.push('PROC');
  if (chainRes.auction?.snapshot && sanitizeAdam(chainRes.auction.adam)) covered.push('AWRD');
  if (chainRes.contract?.snapshot && sanitizeAdam(chainRes.contract.adam)) covered.push('SYMV');
  const pays = Array.isArray(chainRes.payments) ? chainRes.payments : [];
  if (pays.some((p) => p && (p.adam || p.snapshot))) covered.push('PAY');
  return covered;
}

export function getKnownStitchSeedAdams(form) {
  const out = [];
  const seen = new Set();
  const push = (v) => {
    const a = sanitizeAdam(v);
    if (!a || seen.has(a)) return;
    seen.add(a);
    out.push(a);
  };
  push(form?.khmdhsChainSeedAdam);
  const segments = form?.khmdhsChainStitchPlan?.segments;
  if (Array.isArray(segments)) {
    segments.forEach((s) => push(s?.seedAdam));
  }
  return out;
}

/**
 * Ερώτηση Α: υπάρχει ήδη αλυσίδα ΚΑΙ ο νέος ΑΔΑΜ διαφέρει από γνωστούς σπόρους.
 * Μόνο «Μια Σύμβαση» (όχι πολλαπλές).
 */
export function shouldOfferStitchPromptA(form, newSeedAdam, { isMultipleContracts = false } = {}) {
  if (isMultipleContracts) return false;
  if (!projectHasSubstantialKhmdhsData(form)) return false;
  const seed = sanitizeAdam(newSeedAdam);
  if (!seed) return false;
  const known = getKnownStitchSeedAdams(form);
  if (known.includes(seed)) return false;
  return true;
}

export function isConfirmedKhmdhsStitchPlan(plan) {
  return !!(
    plan
    && plan.status === 'confirmed'
    && Array.isArray(plan.segments)
    && plan.segments.length >= 2
    && plan.segments.filter((s) => sanitizeAdam(s?.seedAdam)).length >= 2
  );
}

export function getConfirmedKhmdhsStitchPlan(form) {
  const plan = form?.khmdhsChainStitchPlan;
  return isConfirmedKhmdhsStitchPlan(plan) ? plan : null;
}

/** Οι σπόροι ανανέωσης του επιβεβαιωμένου σχεδίου με τη σειρά (μοναδικοί). */
export function getConfirmedStitchSeedAdams(form) {
  const plan = getConfirmedKhmdhsStitchPlan(form);
  if (!plan) return [];
  const seen = new Set();
  const out = [];
  plan.segments.forEach((s) => {
    const a = sanitizeAdam(s?.seedAdam);
    if (!a || seen.has(a)) return;
    seen.add(a);
    out.push(a);
  });
  return out;
}

/**
 * Δημιουργεί/ενημερώνει ΕΠΙΒΕΒΑΙΩΜΕΝΟ σχέδιο συρραφής μετά από επιτυχημένη stitch.
 * Segment προηγούμενου σπόρου = στάδια που υπήρχαν πριν· segment νέου σπόρου = στάδια που έφερε.
 */
/**
 * Πρέπει να εμφανιστεί η Ερώτηση Β μετά από stitch;
 * Ναι αν γέμισαν κενά στάδια, ή αν αποκτήθηκε κύρια σύμβαση που πριν έλειπε.
 */
/**
 * Έλεγχος αποτελέσματος ανανέωσης τεχνητής αλυσίδας.
 * Αν έστω ένας σπόρος απέτυχε → δεν επιτρέπεται αποθήκευση μεικτού αποτελέσματος.
 * @returns {{ ok: true } | { ok: false, failedAdams: string[], message: string }}
 */
export function evaluateStitchRefreshCompleteness(res) {
  if (!res?.usesStitchPlan || !Array.isArray(res.stitchResults) || !res.stitchResults.length) {
    return { ok: true };
  }
  const failedAdams = res.stitchResults
    .filter((s) => !s?.success)
    .map((s) => sanitizeAdam(s?.seedAdam))
    .filter(Boolean);
  if (!failedAdams.length) return { ok: true };
  return {
    ok: false,
    failedAdams,
    message: failedAdams.length === 1
      ? `Η τεχνητή αλυσίδα δεν ανανεώθηκε πλήρως — απέτυχε ο κωδικός ${failedAdams[0]}. Δεν αποθηκεύτηκαν αλλαγές.`
      : `Η τεχνητή αλυσίδα δεν ανανεώθηκε πλήρως — απέτυχαν οι κωδικοί ${failedAdams.join(', ')}. Δεν αποθηκεύτηκαν αλλαγές.`,
  };
}

export function shouldOfferStitchPromptB({
  stitchApplyMode = 'replace',
  stitchFilledStages = [],
  prevForm = null,
  nextForm = null,
} = {}) {
  if (stitchApplyMode !== 'stitch') return false;
  if (Array.isArray(stitchFilledStages) && stitchFilledStages.length > 0) return true;
  const prevHadContract = !!(
    sanitizeAdam(prevForm?.khmdhsAdam) || prevForm?.khmdhsContractSnapshot
  );
  const nextHasContract = !!(
    sanitizeAdam(nextForm?.khmdhsAdam) || nextForm?.khmdhsContractSnapshot
  );
  if (!prevHadContract && nextHasContract) return true;
  const prevPays = Array.isArray(prevForm?.khmdhsPayments) ? prevForm.khmdhsPayments.length : 0;
  const nextPays = Array.isArray(nextForm?.khmdhsPayments) ? nextForm.khmdhsPayments.length : 0;
  if (prevPays === 0 && nextPays > 0) return true;
  return false;
}

export function buildConfirmedStitchPlanFromStitch({
  existingPlan = null,
  prevSeedAdam = '',
  prevForm = null,
  prevCoversStages = null,
  newSeedAdam = '',
  newSeedType = '',
  newCoversStages = [],
  confirmedBy = '',
  now = '',
} = {}) {
  const prevSeed = sanitizeAdam(prevSeedAdam);
  const newSeed = sanitizeAdam(newSeedAdam);
  if (!newSeed) return existingPlan || null;
  const stamp = now || new Date().toISOString();

  const prevCovers = (Array.isArray(prevCoversStages)
    ? prevCoversStages
    : detectStagesCoveredByForm(prevForm))
    .filter((s) => KHMDHS_STITCH_STAGE_IDS.includes(s));
  const newCovers = (newCoversStages || []).filter((s) => KHMDHS_STITCH_STAGE_IDS.includes(s));

  let plan = existingPlan && typeof existingPlan === 'object'
    ? { ...existingPlan }
    : {
      version: KHMDHS_STITCH_PLAN_VERSION,
      status: 'draft',
      createdAt: stamp,
      confirmedAt: '',
      confirmedBy: '',
      segments: [],
      notes: '',
    };

  if (prevSeed && prevSeed !== newSeed && prevCovers.length) {
    plan = upsertStitchPlanSegment(plan, {
      seedAdam: prevSeed,
      seedType: '',
      coversStages: prevCovers,
      fetchedAt: stamp,
    });
  }
  plan = upsertStitchPlanSegment(plan, {
    seedAdam: newSeed,
    seedType: newSeedType,
    coversStages: newCovers,
    fetchedAt: stamp,
  });

  return {
    ...plan,
    version: KHMDHS_STITCH_PLAN_VERSION,
    status: 'confirmed',
    confirmedAt: stamp,
    confirmedBy: String(confirmedBy || plan.confirmedBy || ''),
  };
}

export function clearKhmdhsStitchPlanFields() {
  return { khmdhsChainStitchPlan: null };
}

/**
 * Δημιουργεί/ενημερώνει draft plan μετά από επιτυχημένη συρραφή (Phase 2 θα το κάνει confirmed).
 * Δεν καλείται ακόμα από UI Phase 1 — έτοιμο για Prompt Β.
 */
export function upsertStitchPlanSegment(existingPlan, {
  seedAdam,
  seedType = '',
  coversStages = [],
  fetchedAt = '',
} = {}) {
  const adam = sanitizeAdam(seedAdam);
  if (!adam) return existingPlan || null;
  const now = fetchedAt || new Date().toISOString();
  const segment = {
    seedAdam: adam,
    seedType: String(seedType || '').trim(),
    coversStages: (coversStages || []).filter((s) => KHMDHS_STITCH_STAGE_IDS.includes(s)),
    fetchedAt: now,
  };
  const base = existingPlan && typeof existingPlan === 'object'
    ? { ...existingPlan }
    : {
      version: KHMDHS_STITCH_PLAN_VERSION,
      status: 'draft',
      createdAt: now,
      confirmedAt: '',
      confirmedBy: '',
      segments: [],
      notes: '',
    };
  const segments = Array.isArray(base.segments) ? [...base.segments] : [];
  const idx = segments.findIndex((s) => sanitizeAdam(s?.seedAdam) === adam);
  if (idx >= 0) {
    segments[idx] = {
      ...segments[idx],
      ...segment,
      coversStages: segment.coversStages.length
        ? segment.coversStages
        : (segments[idx].coversStages || []),
    };
  } else {
    segments.push(segment);
  }
  return {
    ...base,
    version: KHMDHS_STITCH_PLAN_VERSION,
    segments,
  };
}

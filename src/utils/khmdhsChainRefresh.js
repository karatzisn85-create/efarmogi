/**
 * Ανανέωση αλυσίδας ΚΗΜΔΗΣ — seed ΑΔΑΜ, παλαιότητα, σύνοψη αλλαγών, δικαιώματα.
 */
import { isKhmdhsChainClosedSubproject } from '../data/formOptions';
import { parseKhmdhsAdamType } from './khmdhsAdamGuidance';
import { projectVisibleToAssignedEngineer } from './supervisorChargeDisplay';
import { projectHasAnyKhmdhsLifecycleData } from './khmdhsLifecycleStages';
import { getKhmdhsPaymentEntries } from './khmdhsChainExtraFields';
import { getUnresolvedReviewItems } from './khmdhsDataQualityReport';

export const KHMDHS_FRESHNESS_YELLOW_DAYS = 30;
export const KHMDHS_FRESHNESS_YELLOW_MAX = 50;
export const KHMDHS_FRESHNESS_RED_MIN = 50;
export const KHMDHS_FRESHNESS_RED_MAX = 70;

function sanitizeAdam(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .replace(/\*+$/, '');
}

function pickFirstAdam(...candidates) {
  for (const raw of candidates) {
    const adam = sanitizeAdam(raw);
    if (adam) return adam;
  }
  return '';
}

/**
 * ΑΔΑΜ εκκίνησης για ανανέωση: πρωτογενές REQ → fallbacks PROC/AWRD/SYMV.
 * @returns {{ adam: string, source: string, label: string }}
 */
export function getKhmdhsRefreshSeedAdam(project) {
  if (!project) {
    return { adam: '', source: 'none', label: '' };
  }

  const branchAdam = pickFirstAdam(project.khmdhsBranchAnchorAdam);
  if (branchAdam) {
    const branchType = parseKhmdhsAdamType(branchAdam);
    const branchLabels = {
      SYMV: 'άγκυρα — σύμβαση',
      PROC: 'άγκυρα — δημοσίευση',
      REQ: 'άγκυρα — αίτημα',
      APPROVED_REQ: 'άγκυρα — δέσμευση',
    };
    return {
      adam: branchAdam,
      source: 'branch',
      label: branchLabels[branchType] || 'άγκυρα υποέργου',
    };
  }

  const reqAdam = pickFirstAdam(
    project.khmdhsRequestAdam,
    project.khmdhsRequestSnapshot?.referenceNumber,
  );
  if (reqAdam && parseKhmdhsAdamType(reqAdam) === 'REQ') {
    return { adam: reqAdam, source: 'req', label: 'πρωτογενές αίτημα (REQ)' };
  }

  const procAdam = pickFirstAdam(
    project.khmdhsNoticeAdam,
    project.khmdhsNoticeSnapshot?.referenceNumber,
  );
  if (procAdam) {
    return { adam: procAdam, source: 'proc', label: 'δημοσίευση / πρόσκληση (PROC)' };
  }

  const awrdAdam = pickFirstAdam(
    project.khmdhsAwardAdam,
    project.khmdhsAwardSnapshot?.referenceNumber,
  );
  if (awrdAdam) {
    return { adam: awrdAdam, source: 'awrd', label: 'ανάθεση (AWRD)' };
  }

  const symvAdam = pickFirstAdam(
    project.khmdhsAdam,
    project.khmdhsContractSnapshot?.referenceNumber,
    ...(project.contracts || []).map((c) => c?.khmdhsAdam),
    project.khmdhsChainSeedAdam,
  );
  if (symvAdam) {
    return { adam: symvAdam, source: 'symv', label: 'σύμβαση (SYMV)' };
  }

  const legacy = pickFirstAdam(project.khmdhsChainSeedAdam);
  if (legacy) {
    return { adam: legacy, source: 'legacy', label: 'αποθηκευμένος ΑΔΑΜ αλυσίδας' };
  }

  return { adam: '', source: 'none', label: '' };
}

/** Συλλογή όλων των ημερομηνιών ανάκτησης αλυσίδας */
export function collectKhmdhsFetchedAtTimestamps(project) {
  if (!project) return [];
  const stamps = [];
  const push = (iso) => {
    if (!iso) return;
    const t = Date.parse(String(iso));
    if (!Number.isNaN(t)) stamps.push(t);
  };

  push(project.khmdhsRequestFetchedAt);
  push(project.khmdhsNoticeFetchedAt);
  push(project.khmdhsAwardFetchedAt);
  push(project.khmdhsContractFetchedAt);
  push(project.khmdhsCommitmentFetchedAt);
  push(project.khmdhsChainLastRefreshedAt);

  (project.khmdhsCommitmentDecisions || []).forEach((d) => push(d?.fetchedAt));
  (project.khmdhsPayments || []).forEach((p) => push(p?.fetchedAt));
  (project.contracts || []).forEach((c) => push(c?.khmdhsContractFetchedAt));

  return stamps;
}

/**
 * @returns {{ level: 'none'|'yellow'|'red', days: number|null, lastFetchedAt: string|null, label: string }}
 */
export function getKhmdhsChainFreshness(project) {
  if (isKhmdhsChainClosedSubproject(project)) {
    return { level: 'none', days: null, lastFetchedAt: null, label: '' };
  }
  if (!projectHasAnyKhmdhsLifecycleData(project)) {
    return { level: 'none', days: null, lastFetchedAt: null, label: '' };
  }

  const stamps = collectKhmdhsFetchedAtTimestamps(project);
  if (!stamps.length) {
    return {
      level: 'yellow',
      days: null,
      lastFetchedAt: null,
      label: 'Άγνωστη ημερομηνία ανάκτησης — προτείνεται ανανέωση',
    };
  }

  // Χρησιμοποιούμε το παλαιότερο timestamp για freshness (πότε ανακτήθηκε το πιο παλιό κομμάτι)
  // αλλά εμφανίζουμε το πιο πρόσφατο ως "τελευταία ανανέωση"
  const oldestMs = Math.min(...stamps);
  const newestMs = Math.max(...stamps);
  const days = Math.floor((Date.now() - oldestMs) / (24 * 60 * 60 * 1000));
  const lastFetchedAt = new Date(newestMs).toISOString();

  if (days < KHMDHS_FRESHNESS_YELLOW_DAYS) {
    return { level: 'none', days, lastFetchedAt, label: '' };
  }
  if (days < KHMDHS_FRESHNESS_YELLOW_MAX) {
    return {
      level: 'yellow',
      days,
      lastFetchedAt,
      label: `Προτείνεται ανανέωση (${days} ημέρες από τελευταία ανάκτηση)`,
    };
  }
  if (days < KHMDHS_FRESHNESS_RED_MAX) {
    return {
      level: 'red',
      days,
      lastFetchedAt,
      label: `Αναγκαία ανανέωση (${days} ημέρες)`,
    };
  }
  return {
    level: 'red',
    days,
    lastFetchedAt,
    label: `Επείγουσα ανανέωση (${days} ημέρες)`,
  };
}

export function canUserRefreshKhmdhsChain({ userRole, currentUser, project, engineerContext, engineerCatalog }) {
  if (!project) return false;
  if (isKhmdhsChainClosedSubproject(project)) return false;
  if (userRole === 'USER') return false;
  if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') return true;
  if (userRole === 'ENGINEER') {
    return projectVisibleToAssignedEngineer(project, engineerContext, engineerCatalog);
  }
  return false;
}

function countPayments(project) {
  return getKhmdhsPaymentEntries(project).length;
}

function paymentAdams(project) {
  return new Set(
    getKhmdhsPaymentEntries(project).map((p) => sanitizeAdam(p?.adam)).filter(Boolean)
  );
}

/** Όλα τα ΑΔΑΜ ιστορικού αλυσίδας σύμβασης (μονή ή πολλαπλές συμβάσεις) */
function collectChainHistoryAdams(project) {
  const set = new Set();
  (project?.khmdhsContractChainHistory || []).forEach((h) => {
    const a = sanitizeAdam(h?.adam);
    if (a) set.add(a);
  });
  (project?.contracts || []).forEach((c) => {
    (c?.khmdhsContractChainHistory || []).forEach((h) => {
      const a = sanitizeAdam(h?.adam);
      if (a) set.add(a);
    });
  });
  return set;
}

/** Πιο πρόσφατη ημ. λήξης (deadline) που εμφανίζεται στη φόρμα — για ανίχνευση νέας παράτασης */
function latestContractEndDate(project) {
  const dates = [];
  if (project?.contractEndDate) dates.push(String(project.contractEndDate).slice(0, 10));
  (project?.contracts || []).forEach((c) => {
    if (c?.contractEndDate) dates.push(String(c.contractEndDate).slice(0, 10));
  });
  if (!dates.length) return '';
  return dates.sort().reverse()[0];
}

function countPendingReviewItems(project) {
  const review = project?.khmdhsDataQualityReview;
  if (!review?.items?.length) return 0;
  return getUnresolvedReviewItems(review, project).length;
}

function formatDateElShort(iso) {
  const s = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function displayOrDash(value) {
  const s = String(value ?? '').trim();
  return s || '—';
}

function findChainHistoryEntry(project, adam) {
  const target = sanitizeAdam(adam);
  const pools = [
    ...(project?.khmdhsContractChainHistory || []),
    ...((project?.contracts || []).flatMap((c) => c?.khmdhsContractChainHistory || [])),
  ];
  return pools.find((h) => sanitizeAdam(h?.adam) === target) || null;
}

function describeHistoryEntry(entry, adam) {
  const type = String(entry?.type || entry?.kind || entry?.documentType || '').trim();
  const title = String(entry?.title || entry?.subject || '').trim();
  const typeLabel = type
    ? type
    : (adam.includes('SYMV') ? 'σύμβαση'
      : adam.includes('MOD') ? 'τροποποίηση'
        : adam.includes('EXT') || adam.includes('PAR') ? 'παράταση'
          : 'έγγραφο αλυσίδας');
  if (title) return `${adam} (${typeLabel}: ${title})`;
  return `${adam} (${typeLabel})`;
}

export const KHMDHS_REFRESH_REPORT_NO_CHANGES =
  'Δεν εντοπίστηκαν ουσιώδεις διαφορές — τα δεδομένα φαίνονται ενημερωμένα.';

/**
 * Αναλυτική αναφορά αλλαγών ανανέωσης ΚΗΜΔΗΣ.
 * @returns {{
 *   lines: string[],
 *   category: 'applied' | 'attention' | 'unchanged',
 *   appliedLines: string[],
 *   attentionLines: string[],
 * }}
 * category:
 * - applied: εφαρμόστηκαν πραγματικές αλλαγές δεδομένων από το ΚΗΜΔΗΣ
 * - attention: δεν προστέθηκαν νέα δεδομένα· διατηρήθηκαν χειροκίνητες τιμές ή υπάρχει σημείο προς έλεγχο
 * - unchanged: τίποτα ουσιαστικό δεν άλλαξε
 */
export function buildKhmdhsRefreshChangeReport(before, after, applyResult = {}) {
  const appliedLines = [];
  const attentionLines = [];
  const {
    statusAutoUpdated,
    protectedCount = 0,
    protectedFields = [],
    apeConflict = null,
  } = applyResult;

  const beforePaySet = paymentAdams(before);
  const afterPayEntries = getKhmdhsPaymentEntries(after);
  const newPayAdams = [];
  afterPayEntries.forEach((p) => {
    const a = sanitizeAdam(p?.adam);
    if (a && !beforePaySet.has(a)) newPayAdams.push(a);
  });
  if (newPayAdams.length) {
    newPayAdams.forEach((adam) => {
      appliedLines.push(`Νέο ένταλμα πληρωμής: ${adam}`);
    });
  } else {
    const beforePay = countPayments(before);
    const afterPay = countPayments(after);
    if (afterPay < beforePay) {
      appliedLines.push(
        `Εντάλματα πληρωμής: από ${beforePay} → ${afterPay} (αφαιρέθηκαν ή αντικαταστάθηκαν εγγραφές)`
      );
    }
  }

  const beforeCommitAdams = new Set(
    [
      ...(before?.khmdhsCommitmentDecisions || []).map((d) => sanitizeAdam(d?.adam)),
      sanitizeAdam(before?.khmdhsCommitmentAdam),
    ].filter(Boolean)
  );
  const afterCommitList = [
    ...(after?.khmdhsCommitmentDecisions || []),
    ...(after?.khmdhsCommitmentAdam && !(after?.khmdhsCommitmentDecisions || []).length
      ? [{ adam: after.khmdhsCommitmentAdam }]
      : []),
  ];
  afterCommitList.forEach((d) => {
    const a = sanitizeAdam(d?.adam);
    if (a && !beforeCommitAdams.has(a)) {
      appliedLines.push(`Νέα απόφαση ανάληψης υποχρέωσης: ${a}`);
    }
  });

  const beforeHistory = collectChainHistoryAdams(before);
  const afterHistory = collectChainHistoryAdams(after);
  afterHistory.forEach((adam) => {
    if (beforeHistory.has(adam)) return;
    const entry = findChainHistoryEntry(after, adam);
    appliedLines.push(`Νέα καταχώριση στην αλυσίδα: ${describeHistoryEntry(entry, adam)}`);
  });

  const beforeEnd = latestContractEndDate(before);
  const afterEnd = latestContractEndDate(after);
  if (afterEnd && afterEnd !== beforeEnd) {
    appliedLines.push(
      `Ημ. λήξης υλοποίησης: ${formatDateElShort(beforeEnd)} → ${formatDateElShort(afterEnd)}`
    );
  }

  if (statusAutoUpdated && before?.projectStatus !== after?.projectStatus) {
    appliedLines.push(
      `Κατάσταση έργου: ${displayOrDash(before?.projectStatus)} → ${displayOrDash(after?.projectStatus)}`
      + ' (αυτόματη ενημέρωση επειδή βρέθηκε σύμβαση στο ΚΗΜΔΗΣ)'
    );
  }

  const beforeAmount = String(before?.contractAmount || '').trim();
  const afterAmount = String(after?.contractAmount || '').trim();
  if (afterAmount && beforeAmount !== afterAmount) {
    appliedLines.push(
      `Ποσό σύμβασης: ${displayOrDash(beforeAmount)} → ${afterAmount} €`
    );
  }

  const beforeProc = String(before?.assignmentProcedure || '').trim();
  const afterProc = String(after?.assignmentProcedure || '').trim();
  if (!beforeProc && afterProc) {
    appliedLines.push(`Διαδικασία ανάθεσης: — → ${afterProc}`);
  } else if (beforeProc && afterProc && beforeProc !== afterProc) {
    appliedLines.push(`Διαδικασία ανάθεσης: ${beforeProc} → ${afterProc}`);
  }

  const beforeRegistryByAdam = new Map(
    (before?.khmdhsDocumentRegistry || [])
      .filter((e) => e?.adam)
      .map((e) => [String(e.adam).toUpperCase(), e])
  );
  (after?.khmdhsDocumentRegistry || []).forEach((entry) => {
    const adam = String(entry?.adam || '').toUpperCase();
    if (!adam || beforeRegistryByAdam.has(adam)) return;
    const title = String(entry?.title || entry?.documentTitle || '').trim();
    appliedLines.push(
      title
        ? `Νέο έγγραφο στα Αρχεία Υποέργου: ${adam} — ${title}`
        : `Νέο έγγραφο στα Αρχεία Υποέργου: ${adam}`
    );
  });

  if (apeConflict) {
    attentionLines.push(
      `⚠️ ΑΠΕ: η καταχωρημένη τιμή παραμένει «${apeConflict.current}», ενώ το ΚΗΜΔΗΣ δείχνει «${apeConflict.suggested}».`
      + ' Δεν άλλαξε αυτόματα — ελέγξτε το στην επεξεργασία αν χρειάζεται.'
    );
  }

  const beforePending = countPendingReviewItems(before);
  const afterPending = countPendingReviewItems(after);
  if (afterPending > beforePending) {
    const diff = afterPending - beforePending;
    attentionLines.push(
      `⚠️ Προστέθηκαν ${diff} νέ${diff === 1 ? 'ο σημείο' : 'α σημεία'} προς έλεγχο στα δεδομένα ΚΗΜΔΗΣ`
      + ' (ανοίξτε την επεξεργασία του υποέργου για λεπτομέρειες).'
    );
  }

  const fields = Array.isArray(protectedFields) && protectedFields.length
    ? protectedFields
    : [];
  if (fields.length) {
    fields.forEach((f) => {
      attentionLines.push(
        `ℹ️ Διατηρήθηκε η χειροκίνητη τιμή στο πεδίο «${f.label || f.fieldKey}»:`
        + ` παρέμεινε «${displayOrDash(f.keptValue)}» αντί για «${displayOrDash(f.khmdhsValue)}» που έδειξε το ΚΗΜΔΗΣ.`
        + ' Δεν απαιτείται ενέργεια — η εφαρμογή σεβάστηκε την προηγούμενη διόρθωσή σας.'
      );
    });
  } else if (protectedCount > 0) {
    attentionLines.push(
      `ℹ️ Διατηρήθηκαν ${protectedCount} χειροκίνητ${protectedCount === 1 ? 'η τιμή' : 'ες τιμές'}`
      + ' που είχατε ορίσει προηγουμένως (το ΚΗΜΔΗΣ έδειξε διαφορετική τιμή, αλλά δεν αντικαταστάθηκε).'
      + ' Δεν απαιτείται ενέργεια.'
    );
  }

  const lines = [...appliedLines, ...attentionLines];
  if (!lines.length) {
    lines.push(KHMDHS_REFRESH_REPORT_NO_CHANGES);
  }

  let category = 'unchanged';
  if (appliedLines.length) category = 'applied';
  else if (attentionLines.length) category = 'attention';

  return {
    lines,
    category,
    appliedLines,
    attentionLines,
  };
}

/**
 * Σύνοψη αλλαγών μετά merge ανανέωσης (πίνακας γραμμών για UI).
 * Για κατηγοριοποίηση χρησιμοποιήστε `buildKhmdhsRefreshChangeReport`.
 */
export function buildKhmdhsRefreshChangeSummary(before, after, applyResult = {}) {
  return buildKhmdhsRefreshChangeReport(before, after, applyResult).lines;
}

/**
 * Ανανέωση αλυσίδας ΚΗΜΔΗΣ — seed ΑΔΑΜ, παλαιότητα, σύνοψη αλλαγών, δικαιώματα.
 */
import { isKhmdhsChainClosedSubproject } from '../data/formOptions';
import { parseKhmdhsAdamType } from './khmdhsAdamGuidance';
import { projectVisibleToAssignedEngineer } from './supervisorChargeDisplay';
import { projectHasAnyKhmdhsLifecycleData } from './khmdhsLifecycleStages';
import { getKhmdhsPaymentEntries } from './khmdhsChainExtraFields';

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

/**
 * Σύνοψη αλλαγών μετά merge ανανέωσης.
 */
export function buildKhmdhsRefreshChangeSummary(before, after, applyResult = {}) {
  const lines = [];
  const { statusAutoUpdated, protectedCount = 0 } = applyResult;

  const beforePay = countPayments(before);
  const afterPay = countPayments(after);
  if (afterPay > beforePay) {
    lines.push(`+${afterPay - beforePay} νέα εντάλματα πληρωμής`);
  } else if (afterPay < beforePay) {
    lines.push(`${beforePay - afterPay} εντάλματα πληρωμής αφαιρέθηκαν/ενημερώθηκαν`);
  }

  const beforePaySet = paymentAdams(before);
  const afterPaySet = paymentAdams(after);
  let newPayCount = 0;
  afterPaySet.forEach((a) => { if (!beforePaySet.has(a)) newPayCount += 1; });
  if (newPayCount > 0 && afterPay <= beforePay) {
    lines.push(`${newPayCount} νέα/διαφορετικά εντάλματα πληρωμής`);
  }

  const beforeCommit = (before?.khmdhsCommitmentDecisions || []).length
    || (before?.khmdhsCommitmentAdam ? 1 : 0);
  const afterCommit = (after?.khmdhsCommitmentDecisions || []).length
    || (after?.khmdhsCommitmentAdam ? 1 : 0);
  if (afterCommit > beforeCommit) {
    lines.push(`+${afterCommit - beforeCommit} αποφάσεις ανάληψης υποχρέωσης`);
  }

  if (statusAutoUpdated && before?.projectStatus !== after?.projectStatus) {
    lines.push(
      `Κατάσταση: ${before?.projectStatus || '—'} → ${after?.projectStatus || '—'} (πρόταση)`
    );
  }

  if (String(before?.contractAmount || '') !== String(after?.contractAmount || '') && after?.contractAmount) {
    lines.push(`Ποσό σύμβασης: ${after.contractAmount} €`);
  }

  if (protectedCount > 0) {
    lines.push(
      `${protectedCount} πεδί${protectedCount === 1 ? 'ο' : 'α'} δεν άλλαξ${protectedCount === 1 ? 'ε' : 'αν'} (χειροκίνητη διόρθωση)`
    );
  }

  if (!lines.length) {
    lines.push('Δεν εντοπίστηκαν ουσιώδεις διαφορές — τα δεδομένα φαίνονται ενημερωμένα.');
  }

  return lines;
}

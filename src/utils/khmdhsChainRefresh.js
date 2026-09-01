/**
 * Ανανέωση αλυσίδας ΚΗΜΔΗΣ — seed ΑΔΑΜ, παλαιότητα, σύνοψη αλλαγών, δικαιώματα.
 */
import { isKhmdhsChainClosedSubproject } from '../data/formOptions';
import khmdhsRefresh from '../../app/core/khmdhsRefresh';
import { parseKhmdhsAdamType } from './khmdhsAdamGuidance';
import { projectVisibleToAssignedEngineer } from './supervisorChargeDisplay';
import { projectHasAnyKhmdhsLifecycleData } from './khmdhsLifecycleStages';
import { getKhmdhsPaymentEntries } from './khmdhsChainExtraFields';
import { getUnresolvedReviewItems } from './khmdhsDataQualityReport';
import { formatKhmdhsDateOnly, formatKhmdhsEuro } from './khmdhsNoticeFields';
import { formatKhmdhsCostSnapshotGross } from './khmdhsVatHelper';
import {
  getConfirmedKhmdhsStitchPlan,
  getConfirmedStitchSeedAdams,
  stitchPlanConflictsWithImplementationForm,
} from './khmdhsChainStitchPlan';
import { isAdamSkippedInSymvPlan } from './khmdhsSymvChainPlanner';
import {
  getActionableRefreshAttentionLines,
  clarifyKhmdhsIncompleteLine,
  isIncompleteConfirmationLine,
} from './khmdhsRefreshFindings';
import {
  collectRecordedLinkAdamsByStage,
  describeCancelledLinkRemoval,
} from './khmdhsCancelledLinkStrip';

export const KHMDHS_REGISTRY_REPORT_PREFIX = 'Νέο έγγραφο ΚΗΜΔΗΣ στο μητρώο:';
export const KHMDHS_REGISTRY_REPORT_PREFIX_LEGACY = 'Νέο έγγραφο στα Αρχεία Υποέργου:';
export const KHMDHS_REGISTRY_REMOVED_PREFIX = 'Αφαιρέθηκε έγγραφο ΚΗΜΔΗΣ από τα Αρχεία:';

const KHMDHS_REGISTRY_REPORT_PREFIXES = [
  KHMDHS_REGISTRY_REPORT_PREFIX,
  KHMDHS_REGISTRY_REPORT_PREFIX_LEGACY,
];

/** Χωρίζει γραμμές αναφοράς σε μητρώο / αφαιρέσεις / υπόλοιπες — και παλιό και νέο πρόθεμα. */
export function splitKhmdhsRegistryChangeLines(changeLines) {
  const other = [];
  const registry = [];
  const removed = [];
  (Array.isArray(changeLines) ? changeLines : []).forEach((line) => {
    const text = String(line || '');
    if (text.startsWith(KHMDHS_REGISTRY_REMOVED_PREFIX)) {
      removed.push(text.slice(KHMDHS_REGISTRY_REMOVED_PREFIX.length).trim());
      return;
    }
    const prefix = KHMDHS_REGISTRY_REPORT_PREFIXES.find((p) => text.startsWith(p));
    if (prefix) {
      registry.push(text.slice(prefix.length).trim());
    } else {
      other.push(line);
    }
  });
  return { other, registry, removed };
}

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

/**
 * Έχει το υποέργο επιβεβαιωμένο σχέδιο τεχνητής (συρραμμένης) αλυσίδας;
 */
export function hasConfirmedKhmdhsStitchPlan(project) {
  return !!getConfirmedKhmdhsStitchPlan(project);
}

/**
 * ΑΔΑΜ εκκίνησης ανανέωσης — λίστα με σειρά.
 * Αν υπάρχει επιβεβαιωμένο σχέδιο συρραφής, ακολουθεί τους σπόρους του σχεδίου
 * (αγνοεί τη μονή άγκυρα). Αλλιώς ένας σπόρος (όπως σήμερα).
 * @returns {{ adams: string[], usesStitchPlan: boolean, primary: {adam,source,label} }}
 */
export function getKhmdhsRefreshSeedAdams(project) {
  const plan = project?.khmdhsChainStitchPlan;
  const planConflict = stitchPlanConflictsWithImplementationForm(
    plan,
    project?.implementationForm
  );
  const planSeeds = planConflict ? [] : getConfirmedStitchSeedAdams(project);
  if (planSeeds.length >= 2) {
    return {
      adams: planSeeds,
      usesStitchPlan: true,
      primary: { adam: planSeeds[0], source: 'stitch', label: 'τεχνητή αλυσίδα (πολλοί ΑΔΑΜ)' },
      stitchPlanFormMismatch: false,
    };
  }
  const single = getKhmdhsRefreshSeedAdam(project);
  return {
    adams: single.adam ? [single.adam] : [],
    usesStitchPlan: false,
    primary: single,
    stitchPlanFormMismatch: planConflict,
  };
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

  const { ageDays: days, lastRefreshed: lastFetchedAt } = khmdhsRefresh.getKhmdhsRefreshAge(project);
  if (days == null) {
    return {
      level: 'yellow',
      days: null,
      lastFetchedAt: null,
      label: 'Άγνωστη ημερομηνία ανάκτησης — προτείνεται ανανέωση',
    };
  }

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
  const visibleToEngineer = projectVisibleToAssignedEngineer(project, engineerContext, engineerCatalog);
  return khmdhsRefresh.canUserRefreshKhmdhs(
    { role: userRole, username: currentUser?.username },
    project,
    { visibleToEngineer }
  );
}

function paymentAdams(project) {
  return new Set(
    getKhmdhsPaymentEntries(project).map((p) => sanitizeAdam(p?.adam)).filter(Boolean)
  );
}

/** Όλα τα ΑΔΑΜ ιστορικού αλυσίδας σύμβασης (μονή ή πολλαπλές συμβάσεις) */
function collectChainHistoryAdams(project) {
  const set = new Set();
  const add = (adam) => {
    const a = sanitizeAdam(adam);
    if (!a || isAdamSkippedInSymvPlan(project, a)) return;
    set.add(a);
  };
  (project?.khmdhsContractChainHistory || []).forEach((h) => add(h?.adam));
  (project?.contracts || []).forEach((c) => {
    (c?.khmdhsContractChainHistory || []).forEach((h) => add(h?.adam));
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

function truncateReportText(value, max = 90) {
  const s = String(value || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

function snapshotAmountLabel(snapshot) {
  return formatKhmdhsCostSnapshotGross(snapshot)
    || formatKhmdhsEuro(snapshot?.totalCostWithVAT)
    || formatKhmdhsEuro(snapshot?.totalCostWithoutVAT)
    || '';
}

function snapshotDateLabel(snapshot) {
  return formatKhmdhsDateOnly(
    snapshot?.publishDate
    || snapshot?.awardDate
    || snapshot?.dateSigned
    || snapshot?.protocolDate
    || snapshot?.signedDate
  ) || '';
}

/** Πλήρης περιγραφή νέου εντάλματος / απόφασης για την αναφορά ανανέωσης. */
function describeDocumentAddition(kindLabel, adam, snapshot) {
  const parts = [`${kindLabel}: ${adam}`];
  const amount = snapshotAmountLabel(snapshot);
  if (amount) parts.push(amount);
  const date = snapshotDateLabel(snapshot);
  if (date) parts.push(`ημ. ${date}`);
  const title = truncateReportText(snapshot?.title || snapshot?.subject || '');
  if (title) parts.push(title);
  return parts.join(' — ');
}

function collectContractRowAdams(project) {
  const set = new Set();
  const main = sanitizeAdam(project?.khmdhsAdam);
  if (main) set.add(main);
  (Array.isArray(project?.contracts) ? project.contracts : []).forEach((c) => {
    const a = sanitizeAdam(c?.khmdhsAdam);
    if (a) set.add(a);
  });
  return set;
}

function describeContractRowAddition(row, adam) {
  const parts = [`Νέα σύμβαση: ${adam}`];
  const amount = String(row?.contractAmount || '').trim();
  if (amount) parts.push(`${amount} €`);
  const date = formatDateElShort(row?.contractDate);
  if (date && date !== '—') parts.push(`ημ. ${date}`);
  const contractor = truncateReportText(row?.contractor || row?.contractorName || '');
  if (contractor) parts.push(contractor);
  return parts.join(' — ');
}

export const KHMDHS_REFRESH_REPORT_NO_CHANGES =
  'Δεν εντοπίστηκαν ουσιώδεις διαφορές — τα δεδομένα φαίνονται ενημερωμένα.';

const STAGE_PRESERVED_LABELS = {
  contract: 'Η σύμβαση δεν επιβεβαιώθηκε σε αυτή την ανάκτηση — διατηρήθηκε η προηγούμενη.',
  notice: 'Η δημοσίευση (διακήρυξη/πρόσκληση) δεν επιβεβαιώθηκε — διατηρήθηκε η προηγούμενη.',
  award: 'Η απόφαση ανάθεσης/κατακύρωσης δεν επιβεβαιώθηκε — διατηρήθηκε η προηγούμενη.',
  request: 'Το πρωτογενές αίτημα δεν επιβεβαιώθηκε — διατηρήθηκε το προηγούμενο.',
};

function normalizeReportLine(line) {
  return String(line || '').replace(/^[⚠️ℹ️✅➖\s]+/u, '').trim().toLowerCase();
}

/**
 * Επιλέγει από τις προειδοποιήσεις της ανάκτησης μόνο όσες υποδεικνύουν πρόβλημα ή έλλειψη
 * (π.χ. δεν ανακτήθηκαν στοιχεία, ελλιπής αλυσίδα), ώστε να μην «θορυβούν» τα καθαρά
 * επεξηγηματικά μηνύματα (σύνοψη αλυσίδας, παράλειψη ήδη ακυρωμένων πράξεων κ.λπ.).
 *
 * Σημ.: «Παραλείφθηκαν N ακυρωμένες/ματαιωμένες πράξεις» ΔΕΝ είναι πρόβλημα —
 * η εφαρμογή έκανε σωστά τη δουλειά της· δεν απαιτείται ενέργεια στο υποέργο.
 */
function isProblemChainWarning(w) {
  const s = String(w || '').trim();
  if (!s) return false;
  // Κανονική παράλειψη ακυρωμένων/ματαιωμένων — πληροφοριακό, όχι «προσοχή».
  if (/παραλείφθηκ.*ακυρωμ|παραλείφθηκ.*ματαιωμ/i.test(s)) return false;
  // Επιβεβαιωμένη ακύρωση που εφαρμόζεται στην κάρτα — η αναφορά αλλαγών το λέει ρητά.
  if (/έχει ακυρώσει\/ματαιώσει|ενημερώνεται χωρίς τους ακυρωμένους/i.test(s)) return false;
  return /(δεν ανακτήθηκ|δεν βρέθηκ|απέτυχ|αποτυχία|ελλιπ|χωρίς ηλεκτρονικ|προσωρινό πρόβλημα|δεν επιβεβαι)/i.test(s);
}

function isIncompleteFetchChainWarning(w) {
  const s = String(w || '').trim();
  if (!s || !isProblemChainWarning(s)) return false;
  return isIncompleteConfirmationLine(s)
    || /(δεν ανακτήθηκ|δεν επιβεβαι|προσωρινό πρόβλημα|μόνο το πρωτογενές αίτημα)/i.test(s);
}

const ADAM_IN_WARNING_RE = /\d{2}[A-Z]{3,4}\d{9}/g;

function chainWarningMentionsSkippedAdam(text, project) {
  const matches = String(text || '').toUpperCase().match(ADAM_IN_WARNING_RE) || [];
  return matches.some((adam) => isAdamSkippedInSymvPlan(project, adam));
}

export function filterKhmdhsChainWarningsForDisplay(warnings, project) {
  return (Array.isArray(warnings) ? warnings : []).filter(
    (w) => !chainWarningMentionsSkippedAdam(w, project)
  );
}

function describeUnconfirmedExisting(kind, adams) {
  const list = (Array.isArray(adams) ? adams : []).filter(Boolean);
  const n = list.length;
  if (!n) return '';
  if (kind === 'payment') {
    if (n === 1) {
      return `Το ΚΗΜΔΗΣ αυτή τη φορά δεν επιβεβαίωσε το ένταλμα πληρωμής ${list[0]} που ήδη υπάρχει στην κάρτα. `
        + 'Δεν διαγράφηκε τίποτα — παραμένει όπως ήταν. Ξαναδοκιμάστε όταν η υπηρεσία ανταποκρίνεται κανονικά.';
    }
    return `Το ΚΗΜΔΗΣ αυτή τη φορά δεν επιβεβαίωσε ${n} εντάλματα πληρωμής που ήδη υπάρχουν στην κάρτα (${list.join(', ')}). `
      + 'Δεν διαγράφηκε τίποτα — παραμένουν όπως ήταν. Ξαναδοκιμάστε όταν η υπηρεσία ανταποκρίνεται κανονικά.';
  }
  if (n === 1) {
    return `Το ΚΗΜΔΗΣ αυτή τη φορά δεν επιβεβαίωσε την απόφαση ανάληψης ${list[0]} που ήδη υπάρχει στην κάρτα. `
      + 'Δεν διαγράφηκε τίποτα — παραμένει όπως ήταν. Ξαναδοκιμάστε όταν η υπηρεσία ανταποκρίνεται κανονικά.';
  }
  return `Το ΚΗΜΔΗΣ αυτή τη φορά δεν επιβεβαίωσε ${n} αποφάσεις ανάληψης που ήδη υπάρχουν στην κάρτα (${list.join(', ')}). `
    + 'Δεν διαγράφηκε τίποτα — παραμένουν όπως ήταν. Ξαναδοκιμάστε όταν η υπηρεσία ανταποκρίνεται κανονικά.';
}

function collectReportCancelledAdamSet(after, opts = {}) {
  const set = new Set();
  const addAll = (list) => {
    (Array.isArray(list) ? list : []).forEach((raw) => {
      const a = sanitizeAdam(raw);
      if (a) set.add(a);
    });
  };
  addAll(after?.khmdhsAdamChainMeta?.confirmedCancelledAdams);
  addAll(opts.confirmedCancelledAdams);
  return set;
}

function listRemovedCancelledAdams(beforeAdamSet, afterAdamSet, cancelledSet, beforeByAdam) {
  const removed = [];
  beforeAdamSet.forEach((a) => {
    if (!a || afterAdamSet.has(a)) return;
    const prev = beforeByAdam.get(a);
    if (cancelledSet.has(a) || prev?.snapshot?.cancelled === true) {
      removed.push(a);
    }
  });
  return removed;
}

/**
 * Αναλυτική αναφορά αλλαγών ανανέωσης ΚΗΜΔΗΣ.
 * @returns {{
 *   lines: string[],
 *   category: 'applied' | 'attention' | 'unchanged',
 *   appliedLines: string[],
 *   attentionLines: string[],
 *   incompleteLines: string[],
 * }}
 * category:
 * - applied: εφαρμόστηκαν πραγματικές αλλαγές δεδομένων από το ΚΗΜΔΗΣ
 * - attention: δεν προστέθηκαν νέα δεδομένα· υπάρχει σημείο προς έλεγχο ή ενέργεια
 * - unchanged: τίποτα ουσιαστικό δεν άλλαξε (η ανεπιβεβαίωση ΚΗΜΔΗΣ δεν μετρά ως αλλαγή)
 */
export function buildKhmdhsRefreshChangeReport(before, after, applyResult = {}, opts = {}) {
  const appliedLines = [];
  const attentionLines = [];
  const incompleteLines = [];
  const {
    statusAutoUpdated,
    protectedCount = 0,
    protectedFields = [],
    apeConflict = null,
    warnings: applyWarnings = [],
  } = applyResult;
  const chainWarnings = Array.isArray(opts.chainWarnings) ? opts.chainWarnings : [];
  const cancelledAdamSet = collectReportCancelledAdamSet(after, opts);

  const beforePaySet = paymentAdams(before);
  const afterPayEntries = getKhmdhsPaymentEntries(after);
  const newPayWithDetails = [];
  const newPayWithoutDetails = [];
  afterPayEntries.forEach((p) => {
    const a = sanitizeAdam(p?.adam);
    if (!a || beforePaySet.has(a)) return;
    if (p.snapshot) newPayWithDetails.push(p);
    else newPayWithoutDetails.push(a);
  });
  newPayWithDetails.forEach((entry) => {
    appliedLines.push(
      describeDocumentAddition('Νέο ένταλμα πληρωμής', sanitizeAdam(entry?.adam), entry?.snapshot)
    );
  });
  newPayWithoutDetails.forEach((adam) => {
    incompleteLines.push(
      `Εντοπίστηκε ένταλμα ${adam} χωρίς λεπτομέρειες (προσωρινό πρόβλημα ΚΗΜΔΗΣ). `
      + 'Δεν προστέθηκε ως νέο και δεν διαγράφηκε τίποτα υπάρχον — δοκιμάστε ξανά σε λίγο.'
    );
  });
  const afterPaySet = new Set(afterPayEntries.map((p) => sanitizeAdam(p?.adam)).filter(Boolean));
  const beforePayByAdam = new Map();
  getKhmdhsPaymentEntries(before).forEach((p) => {
    const a = sanitizeAdam(p?.adam);
    if (a) beforePayByAdam.set(a, p);
  });
  const cancelledRemovedPays = listRemovedCancelledAdams(
    beforePaySet,
    afterPaySet,
    cancelledAdamSet,
    beforePayByAdam
  );
  cancelledRemovedPays.forEach((adam) => {
    appliedLines.push(
      `Αφαιρέθηκε ακυρωμένο ένταλμα πληρωμής ${adam} — το ΚΗΜΔΗΣ το έχει ματαιώσει`
      + ' και δεν εμφανίζεται πλέον στην κάρτα.'
    );
  });
  const missingPayAdams = [];
  beforePaySet.forEach((a) => {
    if (!a || afterPaySet.has(a) || cancelledRemovedPays.includes(a)) return;
    missingPayAdams.push(a);
  });
  if (missingPayAdams.length) {
    incompleteLines.push(describeUnconfirmedExisting('payment', missingPayAdams));
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
      ? [{ adam: after.khmdhsCommitmentAdam, snapshot: after.khmdhsCommitmentSnapshot }]
      : []),
  ];
  const newCommitWithDetails = [];
  const newCommitWithoutDetails = [];
  afterCommitList.forEach((d) => {
    const a = sanitizeAdam(d?.adam);
    if (!a || beforeCommitAdams.has(a)) return;
    if (d.snapshot) newCommitWithDetails.push(d);
    else newCommitWithoutDetails.push(a);
  });
  newCommitWithDetails.forEach((entry) => {
    appliedLines.push(
      describeDocumentAddition(
        'Νέα απόφαση ανάληψης υποχρέωσης',
        sanitizeAdam(entry?.adam),
        entry?.snapshot
      )
    );
  });
  newCommitWithoutDetails.forEach((adam) => {
    incompleteLines.push(
      `Εντοπίστηκε απόφαση ανάληψης ${adam} χωρίς λεπτομέρειες (προσωρινό πρόβλημα ΚΗΜΔΗΣ). `
      + 'Δεν προστέθηκε ως νέα και δεν διαγράφηκε τίποτα υπάρχον — δοκιμάστε ξανά σε λίγο.'
    );
  });
  const afterCommitAdams = new Set(
    afterCommitList.map((d) => sanitizeAdam(d?.adam)).filter(Boolean)
  );
  const beforeCommitByAdam = new Map();
  [
    ...(before?.khmdhsCommitmentDecisions || []),
    ...(before?.khmdhsCommitmentAdam
      ? [{ adam: before.khmdhsCommitmentAdam, snapshot: before.khmdhsCommitmentSnapshot }]
      : []),
  ].forEach((d) => {
    const a = sanitizeAdam(d?.adam);
    if (a && !beforeCommitByAdam.has(a)) beforeCommitByAdam.set(a, d);
  });
  const cancelledRemovedCommits = listRemovedCancelledAdams(
    beforeCommitAdams,
    afterCommitAdams,
    cancelledAdamSet,
    beforeCommitByAdam
  );
  cancelledRemovedCommits.forEach((adam) => {
    appliedLines.push(
      `Αφαιρέθηκε ακυρωμένη ανάληψη υποχρέωσης ${adam} — το ΚΗΜΔΗΣ την έχει ματαιώσει`
      + ' και δεν εμφανίζεται πλέον στην κάρτα.'
    );
  });
  const missingCommitAdams = [];
  beforeCommitAdams.forEach((a) => {
    if (!a || afterCommitAdams.has(a) || cancelledRemovedCommits.includes(a)) return;
    missingCommitAdams.push(a);
  });
  if (missingCommitAdams.length) {
    incompleteLines.push(describeUnconfirmedExisting('commitment', missingCommitAdams));
  }

  const beforeLinks = collectRecordedLinkAdamsByStage(before);
  const afterLinks = collectRecordedLinkAdamsByStage(after);
  const emptySnapMap = new Map();
  const cancelledStageSpecs = [
    { stage: 'notice', beforePrimary: sanitizeAdam(before?.khmdhsNoticeAdam), afterPrimary: sanitizeAdam(after?.khmdhsNoticeAdam) },
    { stage: 'award', beforePrimary: sanitizeAdam(before?.khmdhsAwardAdam), afterPrimary: sanitizeAdam(after?.khmdhsAwardAdam) },
    { stage: 'request', beforePrimary: sanitizeAdam(before?.khmdhsRequestAdam), afterPrimary: sanitizeAdam(after?.khmdhsRequestAdam) },
    { stage: 'contract', beforePrimary: sanitizeAdam(before?.khmdhsAdam), afterPrimary: sanitizeAdam(after?.khmdhsAdam) },
  ];
  cancelledStageSpecs.forEach(({ stage, beforePrimary, afterPrimary }) => {
    const removed = listRemovedCancelledAdams(
      beforeLinks[stage],
      afterLinks[stage],
      cancelledAdamSet,
      emptySnapMap
    );
    removed.forEach((adam) => {
      const replacement = (adam === beforePrimary && afterPrimary && afterPrimary !== adam)
        ? afterPrimary
        : '';
      appliedLines.push(describeCancelledLinkRemoval(stage, adam, replacement));
    });
  });

  // Νέες γραμμές σύμβασης (πολλές συμβάσεις) ή πρώτη κύρια σύμβαση — πριν το ιστορικό,
  // ώστε η ίδια SYMV να μην εμφανιστεί δύο φορές.
  const beforeContractAdams = collectContractRowAdams(before);
  const newlyAddedContractAdams = new Set();
  const afterMainAdam = sanitizeAdam(after?.khmdhsAdam);
  if (afterMainAdam && !beforeContractAdams.has(afterMainAdam)) {
    appliedLines.push(describeContractRowAddition({
      contractAmount: after?.contractAmount,
      contractDate: after?.contractDate,
      contractor: after?.contractor || after?.contractorName,
    }, afterMainAdam));
    newlyAddedContractAdams.add(afterMainAdam);
  }
  (Array.isArray(after?.contracts) ? after.contracts : []).forEach((row) => {
    const adam = sanitizeAdam(row?.khmdhsAdam);
    if (!adam || beforeContractAdams.has(adam) || newlyAddedContractAdams.has(adam)) return;
    appliedLines.push(describeContractRowAddition(row, adam));
    newlyAddedContractAdams.add(adam);
  });

  const beforeHistory = collectChainHistoryAdams(before);
  const afterHistory = collectChainHistoryAdams(after);
  afterHistory.forEach((adam) => {
    if (beforeHistory.has(adam) || newlyAddedContractAdams.has(adam)) return;
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
  const afterRegistryByAdam = new Map(
    (after?.khmdhsDocumentRegistry || [])
      .filter((e) => e?.adam)
      .map((e) => [String(e.adam).toUpperCase(), e])
  );
  (after?.khmdhsDocumentRegistry || []).forEach((entry) => {
    const adam = String(entry?.adam || '').toUpperCase();
    if (!adam || beforeRegistryByAdam.has(adam)) return;
    // Γυμνά ΑΔΑΜ χωρίς πραγματικά στοιχεία (isStub) δεν αναφέρονται ως «Νέο έγγραφο» —
    // δεν ξέρουμε ακόμα τι είναι· καταγράφονται μόλις έρθουν στοιχεία/τίτλος.
    if (entry?.isStub) return;
    const title = String(entry?.title || entry?.documentTitle || '').trim();
    appliedLines.push(
      title
        ? `${KHMDHS_REGISTRY_REPORT_PREFIX} ${adam} — ${title}`
        : `${KHMDHS_REGISTRY_REPORT_PREFIX} ${adam}`
    );
  });
  (before?.khmdhsDocumentRegistry || []).forEach((entry) => {
    const adam = String(entry?.adam || '').toUpperCase();
    if (!adam || afterRegistryByAdam.has(adam)) return;
    if (entry?.isRelated || entry?.stage === 'RELATED' || entry?.stage === 'APE') return;
    if (String(entry?.source || '').toLowerCase() === 'diavgeia') return;
    if (String(entry?.type || '').toUpperCase() === 'DIAV') return;
    const title = String(entry?.title || entry?.documentTitle || '').trim();
    appliedLines.push(
      title
        ? `${KHMDHS_REGISTRY_REMOVED_PREFIX} ${adam} — ${title}`
        : `${KHMDHS_REGISTRY_REMOVED_PREFIX} ${adam}`
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

  // #12 — Σύγκρουση δημοσίευσης: το ΚΗΜΔΗΣ επέστρεψε διαφορετική διακήρυξη/πρόσκληση από
  // την ήδη καταγεγραμμένη και κρατήθηκε η προηγούμενη. Δεν είναι ενέργεια στο υποέργο.
  if (
    Array.isArray(applyWarnings)
    && (
      applyWarnings.includes('noticeConflict')
      || applyWarnings.includes('stitchConflict:proc')
    )
  ) {
    const beforeNotice = sanitizeAdam(before?.khmdhsNoticeAdam);
    const afterNotice = sanitizeAdam(after?.khmdhsNoticeAdam);
    const cancelledPrimaryReplaced = beforeNotice
      && cancelledAdamSet.has(beforeNotice)
      && afterNotice
      && afterNotice !== beforeNotice;
    if (!cancelledPrimaryReplaced) {
      incompleteLines.push(
        'Το ΚΗΜΔΗΣ έδειξε διαφορετική δημοσίευση από την ήδη καταγεγραμμένη. '
        + 'Διατηρήθηκε η κύρια στην κάρτα — δεν διαγράφηκε τίποτα. '
        + 'Τυχόν επιπλέον πράξη φαίνεται στα Αρχεία Υποέργου, όχι ως νέο στάδιο Ανάθεσης/Σύμβασης.'
      );
    }
  }

  // Γραμμή πολλαπλών συμβάσεων χωρίς ηλεκτρονική σύμβαση στην αλυσίδα.
  if (Array.isArray(applyWarnings) && applyWarnings.includes('noContractInChain')) {
    attentionLines.push(
      '⚠️ Βρέθηκαν κοινά στοιχεία (π.χ. δημοσίευση), αλλά όχι σύμβαση (SYMV) για αυτή τη γραμμή.'
      + ' Δώστε ΑΔΑΜ σύμβασης στην επεξεργασία για ημερομηνία/ποσό.'
    );
  }

  // Φάση Β — Διατήρηση σταδίου σε μερική ανάκτηση: ένα στάδιο (αίτημα/δημοσίευση/ανάθεση/
  // σύμβαση) δεν επιβεβαιώθηκε και κρατήθηκε το προηγούμενο αντί να χαθεί.
  (Array.isArray(applyWarnings) ? applyWarnings : []).forEach((w) => {
    const m = /^stagePreserved:(.+)$/.exec(String(w || ''));
    if (!m) return;
    const label = STAGE_PRESERVED_LABELS[m[1]];
    if (label) {
      incompleteLines.push(
        `${label} Δεν χάθηκαν δεδομένα — δοκιμάστε ξανά όταν το ΚΗΜΔΗΣ ανταποκρίνεται κανονικά.`
      );
    }
  });

  // #5 — Προειδοποιήσεις της ίδιας της ανάκτησης (π.χ. εντάλματα/έγγραφα που δεν ανακτήθηκαν,
  // ακυρωμένες πράξεις). Εμφανίζονται μόνο όσες δηλώνουν πρόβλημα/έλλειψη, όχι τα επεξηγηματικά.
  const seenLines = new Set(
    [...appliedLines, ...incompleteLines, ...attentionLines].map((l) => normalizeReportLine(l))
  );
  chainWarnings.forEach((w) => {
    if (!isProblemChainWarning(w)) return;
    const raw = String(w).trim();
    if (chainWarningMentionsSkippedAdam(raw, after)) return;
    const line = isIncompleteFetchChainWarning(raw) ? raw : `⚠️ ${raw}`;
    const key = normalizeReportLine(line);
    if (seenLines.has(key)) return;
    seenLines.add(key);
    if (isIncompleteFetchChainWarning(raw)) {
      incompleteLines.push(clarifyKhmdhsIncompleteLine(raw) || raw);
    } else {
      attentionLines.push(line);
    }
  });

  const lines = [...appliedLines, ...incompleteLines, ...attentionLines];
  if (!lines.length) {
    lines.push(KHMDHS_REFRESH_REPORT_NO_CHANGES);
  }

  // Μόνο ℹ️ «δεν απαιτείται ενέργεια» και η ανεπιβεβαίωση ΚΗΜΔΗΣ δεν μετρά ως «χρειάζεται ενέργεια».
  const actionableAttention = getActionableRefreshAttentionLines(attentionLines);
  let category = 'unchanged';
  if (appliedLines.length) category = 'applied';
  else if (actionableAttention.length) category = 'attention';

  return {
    lines,
    category,
    appliedLines,
    attentionLines,
    incompleteLines,
  };
}

/**
 * Σύνοψη αλλαγών μετά merge ανανέωσης (πίνακας γραμμών για UI).
 * Για κατηγοριοποίηση χρησιμοποιήστε `buildKhmdhsRefreshChangeReport`.
 */
export function buildKhmdhsRefreshChangeSummary(before, after, applyResult = {}, opts = {}) {
  return buildKhmdhsRefreshChangeReport(before, after, applyResult, opts).lines;
}

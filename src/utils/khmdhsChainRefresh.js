/**
 * Ανανέωση αλυσίδας ΚΗΜΔΗΣ — seed ΑΔΑΜ, παλαιότητα, σύνοψη αλλαγών, δικαιώματα.
 */
import { isKhmdhsChainClosedSubproject } from '../data/formOptions';
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
  return /(δεν ανακτήθηκ|δεν βρέθηκ|απέτυχ|αποτυχία|ελλιπ|χωρίς ηλεκτρονικ|προσωρινό πρόβλημα|δεν επιβεβαι)/i.test(s);
}

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
export function buildKhmdhsRefreshChangeReport(before, after, applyResult = {}, opts = {}) {
  const appliedLines = [];
  const attentionLines = [];
  const {
    statusAutoUpdated,
    protectedCount = 0,
    protectedFields = [],
    apeConflict = null,
    warnings: applyWarnings = [],
  } = applyResult;
  const chainWarnings = Array.isArray(opts.chainWarnings) ? opts.chainWarnings : [];

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
    attentionLines.push(
      `⚠️ Εντοπίστηκε ένταλμα ${adam} χωρίς λεπτομέρειες (προσωρινό πρόβλημα ΚΗΜΔΗΣ).`
      + ' Δοκιμάστε ξανά ανανέωση σε λίγο — δεν διαγράφεται αυτόματα.'
    );
  });
  if (!newPayWithDetails.length && !newPayWithoutDetails.length) {
    const beforePay = countPayments(before);
    const afterPay = countPayments(after);
    if (afterPay < beforePay) {
      const afterHasFetchGaps = afterPayEntries.some((p) => !p.snapshot || p.error);
      if (afterHasFetchGaps) {
        attentionLines.push(
          `⚠️ Δεν επιβεβαιώθηκαν όλα τα εντάλματα σε αυτή την ανάκτηση`
          + ` (εμφανίζονται ${afterPay} από ${beforePay}).`
          + ' Τα υπάρχοντα διατηρούνται — δοκιμάστε ξανά όταν το ΚΗΜΔΗΣ ανταποκρίνεται κανονικά.'
        );
      } else {
        appliedLines.push(
          `Εντάλματα πληρωμής: από ${beforePay} → ${afterPay} (αφαιρέθηκαν ως άσχετα ή αντικαταστάθηκαν)`
        );
      }
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
    attentionLines.push(
      `⚠️ Εντοπίστηκε απόφαση ανάληψης ${adam} χωρίς λεπτομέρειες (προσωρινό πρόβλημα ΚΗΜΔΗΣ).`
      + ' Δοκιμάστε ξανά ανανέωση σε λίγο — δεν διαγράφεται αυτόματα.'
    );
  });
  if (!newCommitWithDetails.length && !newCommitWithoutDetails.length) {
    const beforeCommitCount = beforeCommitAdams.size;
    const afterCommitCount = new Set(
      afterCommitList.map((d) => sanitizeAdam(d?.adam)).filter(Boolean)
    ).size;
    if (afterCommitCount < beforeCommitCount) {
      const afterHasFetchGaps = afterCommitList.some((d) => !d.snapshot || d.error);
      if (afterHasFetchGaps) {
        attentionLines.push(
          `⚠️ Δεν επιβεβαιώθηκαν όλες οι αποφάσεις ανάληψης σε αυτή την ανάκτηση`
          + ` (εμφανίζονται ${afterCommitCount} από ${beforeCommitCount}).`
          + ' Οι υπάρχουσες διατηρούνται — δοκιμάστε ξανά όταν το ΚΗΜΔΗΣ ανταποκρίνεται κανονικά.'
        );
      } else {
        appliedLines.push(
          `Αποφάσεις ανάληψης υποχρέωσης: από ${beforeCommitCount} → ${afterCommitCount}`
        );
      }
    }
  }

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
  (after?.khmdhsDocumentRegistry || []).forEach((entry) => {
    const adam = String(entry?.adam || '').toUpperCase();
    if (!adam || beforeRegistryByAdam.has(adam)) return;
    // Γυμνά ΑΔΑΜ χωρίς πραγματικά στοιχεία (isStub) δεν αναφέρονται ως «Νέο έγγραφο» —
    // δεν ξέρουμε ακόμα τι είναι· καταγράφονται μόλις έρθουν στοιχεία/τίτλος.
    if (entry?.isStub) return;
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

  // #12 — Σύγκρουση δημοσίευσης: το ΚΗΜΔΗΣ επέστρεψε διαφορετική διακήρυξη/πρόσκληση από
  // την ήδη καταγεγραμμένη και κρατήθηκε η προηγούμενη. Χωρίς μήνυμα η αλλαγή ήταν αόρατη.
  if (
    Array.isArray(applyWarnings)
    && (
      applyWarnings.includes('noticeConflict')
      || applyWarnings.includes('stitchConflict:proc')
    )
  ) {
    attentionLines.push(
      '⚠️ Το ΚΗΜΔΗΣ έδειξε διαφορετική δημοσίευση (διακήρυξη/πρόσκληση) από την ήδη'
      + ' καταγεγραμμένη — διατηρήθηκε η προηγούμενη. Ελέγξτε στην επεξεργασία αν χρειάζεται αλλαγή.'
    );
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
      attentionLines.push(
        `⚠️ ${label} Δεν χάθηκαν δεδομένα — δοκιμάστε ξανά όταν το ΚΗΜΔΗΣ ανταποκρίνεται κανονικά.`
      );
    }
  });

  // #5 — Προειδοποιήσεις της ίδιας της ανάκτησης (π.χ. εντάλματα/έγγραφα που δεν ανακτήθηκαν,
  // ακυρωμένες πράξεις). Εμφανίζονται μόνο όσες δηλώνουν πρόβλημα/έλλειψη, όχι τα επεξηγηματικά.
  const seenLines = new Set([...appliedLines, ...attentionLines].map((l) => normalizeReportLine(l)));
  chainWarnings.forEach((w) => {
    if (!isProblemChainWarning(w)) return;
    const line = `⚠️ ${String(w).trim()}`;
    const key = normalizeReportLine(line);
    if (seenLines.has(key)) return;
    seenLines.add(key);
    attentionLines.push(line);
  });

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
export function buildKhmdhsRefreshChangeSummary(before, after, applyResult = {}, opts = {}) {
  return buildKhmdhsRefreshChangeReport(before, after, applyResult, opts).lines;
}

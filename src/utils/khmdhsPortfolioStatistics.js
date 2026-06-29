/**
 * khmdhsPortfolioStatistics.js
 *
 * Κεντρικός aggregator για στατιστικά αλυσίδας ΚΗΜΔΗΣ.
 * Αξιοποιεί τα snapshots κάθε σταδίου (REQ → COMMIT → PROC → AWRD → SYMV → PAY)
 * χωρίς αλλαγή στο μοντέλο δεδομένων.
 */

import { projectHasKhmdhsRequestData, pickKhmdhsRequestSnapshot } from './khmdhsRequestFields';
import { projectHasKhmdhsNoticeData, pickKhmdhsNoticeSnapshot } from './khmdhsNoticeFields';
import { projectHasKhmdhsAwardData, pickKhmdhsAwardSnapshot } from './khmdhsAwardFields';
import {
  collectKhmdhsCommitmentDecisions,
  buildKhmdhsPaymentsTotals,
  projectHasKhmdhsPaymentData,
  latestKhmdhsCommitmentAmountGross,
} from './khmdhsChainExtraFields';
import { getKhmdhsDisplayEntries } from './khmdhsFields';
import { computeProjectContractTotal } from './khmdhsSupplementaryAmountLogic';
import { pickKhmdhsContractSnapshot } from './khmdhsContractDisplayFields';
import { grossFromCostSnapshot, grossFromContractRecord, grossFromContractBudget } from './khmdhsVatHelper';
import {
  getKhmdhsChainFreshness,
  collectKhmdhsFetchedAtTimestamps,
  KHMDHS_FRESHNESS_YELLOW_DAYS,
} from './khmdhsChainRefresh';
import { getKhmdhsEstimatedAmounts } from './khmdhsExportFields';
import { getUnresolvedReviewItems } from './khmdhsDataQualityReport';
import { STATUSES_WITH_KHMDHS_ADAM, PROJECT_STATUS_ABANDONED, PROJECT_STATUS_CONTRACT_PROCESS } from '../data/formOptions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isoYear(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).slice(0, 4);
  const y = parseInt(s, 10);
  return y > 2000 && y < 2100 ? y : null;
}

function isoMonth(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).slice(0, 7).split('-');
  if (parts.length < 2) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (y > 2000 && m >= 1 && m <= 12) return `${y}-${String(m).padStart(2, '0')}`;
  return null;
}

function paymentGross(snap) {
  if (!snap) return null;
  const v = snap.totalCostWithVAT ?? snap.totalCostWithoutVAT;
  return v != null ? safeNum(v) : null;
}

function parseApprovedAmount(val) {
  if (val == null || val === '') return 0;
  const str = typeof val === 'number' ? String(val) : String(val);
  const cleaned = str.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// ─── Stage presence per project ───────────────────────────────────────────────

function hasREQ(p) { return projectHasKhmdhsRequestData(p); }
function hasCOMMIT(p) { return collectKhmdhsCommitmentDecisions(p).length > 0; }
function hasPROC(p) { return projectHasKhmdhsNoticeData(p); }
function hasAWRD(p) { return projectHasKhmdhsAwardData(p); }
function hasSYMV(p) { return getKhmdhsDisplayEntries(p).length > 0; }
function hasPAY(p) { return projectHasKhmdhsPaymentData(p); }
function hasRELATED(p) {
  return Array.isArray(p?.khmdhsRelatedDocuments) && p.khmdhsRelatedDocuments.length > 0;
}
function hasAny(p) {
  return hasREQ(p) || hasCOMMIT(p) || hasPROC(p) || hasAWRD(p) || hasSYMV(p) || hasPAY(p);
}
function hasKhmdhsCoverage(p) {
  return hasAny(p) || hasRELATED(p);
}

/** Αριθμός σταδίων με δεδομένα (0-6) */
function chainDepth(p) {
  return (
    (hasREQ(p) ? 1 : 0)
    + (hasCOMMIT(p) ? 1 : 0)
    + (hasPROC(p) ? 1 : 0)
    + (hasAWRD(p) ? 1 : 0)
    + (hasSYMV(p) ? 1 : 0)
    + (hasPAY(p) ? 1 : 0)
  );
}

/** «Πλήρης» αλυσίδα: REQ + PROC + AWRD + SYMV (COMMIT/PAY προαιρετικά) */
function isFullChain(p) {
  return hasREQ(p) && hasPROC(p) && hasAWRD(p) && hasSYMV(p);
}

/** Όλα τα κενά αλυσίδας για ένα υποέργο (μπορεί να έχει περισσότερα από ένα) */
function getAllStuckReasons(p) {
  const reasons = [];
  if (hasAWRD(p) && !hasSYMV(p)) reasons.push('awrd_no_symv');
  if (hasPROC(p) && !hasAWRD(p)) {
    const procSnap = pickKhmdhsNoticeSnapshot(p?.khmdhsNoticeSnapshot);
    if (procSnap?.cancelled) reasons.push('proc_cancelled');
    else reasons.push('proc_no_awrd');
  }
  const EXECUTING = 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ';
  if (hasSYMV(p) && !hasPAY(p) && p.projectStatus === EXECUTING) reasons.push('symv_no_pay');
  return reasons;
}

// ─── Amount extractors per stage ──────────────────────────────────────────────

function reqAmount(p) {
  const s = pickKhmdhsRequestSnapshot(p?.khmdhsRequestSnapshot);
  if (!s) return null;
  const v = grossFromCostSnapshot(s) ?? safeNum(s.totalCostWithVAT ?? s.totalCostWithoutVAT);
  return v > 0 ? v : null;
}

/** Ποσό τελευταίας ετήσιας απόφασης ανάληψης υποχρέωσης — όχι άθροισμα ετών. */
function commitAmount(p) {
  return latestKhmdhsCommitmentAmountGross(p);
}

function procAmount(p) {
  const amounts = getKhmdhsEstimatedAmounts(p);
  return amounts?.gross > 0 ? amounts.gross : null;
}

function awrdAmount(p) {
  const s = pickKhmdhsAwardSnapshot(p?.khmdhsAwardSnapshot);
  if (!s) return null;
  const v = grossFromCostSnapshot(s) ?? safeNum(s.totalCostWithVAT ?? s.auctionAmount ?? s.totalCostWithoutVAT);
  return v > 0 ? v : null;
}

function symvAmount(p) {
  // Προτεραιότητα: ό,τι έχει καταχωρίσει ο χρήστης (συμβάσεις + συμπληρωματικές).
  // Αν ο χρήστης έχει πληκτρολογήσει ποσό, αυτό υπερισχύει έναντι του ΚΗΜΔΗΣ snapshot.
  const manualTotal = computeProjectContractTotal(p);
  if (manualTotal > 0) return manualTotal;

  // Fallback: ποσά από ΚΗΜΔΗΣ snapshots όταν δεν υπάρχει χειροκίνητη καταχώριση.
  const entries = getKhmdhsDisplayEntries(p);
  if (!entries.length) return null;
  let total = 0;
  let found = false;
  entries.forEach((entry) => {
    const snap = pickKhmdhsContractSnapshot(entry?.snapshot);
    if (!snap || snap.contractBudgetSuppressed) return;
    const v = grossFromContractRecord(snap) ?? grossFromContractBudget(snap.contractBudget);
    if (v != null && v > 0) {
      total += v;
      found = true;
    }
  });
  return found ? total : null;
}

function payAmount(p) {
  const totals = buildKhmdhsPaymentsTotals(p);
  const v = totals.rawTotalGross;
  return v != null && v > 0 ? v : null;
}

const GAP_ATTENTION_LABELS = {
  awrd_no_symv: 'Ανάθεση χωρίς Σύμβαση',
  proc_no_awrd: 'Δημοσίευση χωρίς Ανάθεση',
  proc_cancelled: 'Ματαιωμένη Δημοσίευση',
  symv_no_pay: 'Σύμβαση χωρίς Εντάλματα',
};

function hasCancelledStage(p) {
  const req = pickKhmdhsRequestSnapshot(p?.khmdhsRequestSnapshot);
  if (req?.cancelled) return true;
  const proc = pickKhmdhsNoticeSnapshot(p?.khmdhsNoticeSnapshot);
  if (proc?.cancelled) return true;
  const awrd = pickKhmdhsAwardSnapshot(p?.khmdhsAwardSnapshot);
  if (awrd?.cancelled) return true;
  return false;
}

function shouldExpectKhmdhs(p) {
  const st = p?.projectStatus;
  if (!st || st === PROJECT_STATUS_ABANDONED || st === 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ') return false;
  return STATUSES_WITH_KHMDHS_ADAM.includes(st) || st === PROJECT_STATUS_CONTRACT_PROCESS;
}

// ─── Timeline helpers ─────────────────────────────────────────────────────────

function symvSignedDate(p) {
  const entries = getKhmdhsDisplayEntries(p);
  if (!entries.length) return null;
  const snap = pickKhmdhsContractSnapshot(entries[0]?.snapshot);
  return snap?.contractSignedDate || null;
}

function payDates(p) {
  const entries = p.khmdhsPayments || [];
  return entries
    .map((pay) => pay?.snapshot?.signedDate || null)
    .filter(Boolean);
}

// ─── Drill-down helpers ───────────────────────────────────────────────────────

export const PORTFOLIO_DRILL_LABELS = {
  fullChain: 'Πλήρης αλυσίδα ΚΗΜΔΗΣ',
  inProgress: 'Σε εξέλιξη (μερική αλυσίδα)',
  stuck: 'Κολλημένα',
  withKhmdhs: 'Με δεδομένα ΚΗΜΔΗΣ',
  withRelated: 'Με σχετικά έγγραφα ΚΗΜΔΗΣ',
  freshnessOld: 'Παλιά ανακτήση ΚΗΜΔΗΣ',
  freshnessStale: 'Προτείνεται ανανέωση ΚΗΜΔΗΣ',
  withSymv: 'Με σύμβαση ΚΗΜΔΗΣ',
};

/**
 * Επιστρέφει subprojectIds για drill-down φίλτρο λίστας υποέργων.
 * @param {KhmdhsPortfolioStats} stats
 * @param {string} key
 * @param {{ subprojectId?: string, gapKey?: string }} [extra]
 */
export function resolvePortfolioDrillIds(stats, key, extra = {}) {
  if (!stats) return [];
  if (extra.subprojectId) return [extra.subprojectId];
  if (extra.gapKey && stats.gaps?.[extra.gapKey]) {
    return stats.gaps[extra.gapKey].map((item) => item.subprojectId);
  }
  if (key?.startsWith('stage_')) {
    const stage = key.replace('stage_', '');
    return stats.funnel?.[stage] || [];
  }
  switch (key) {
    case 'fullChain':
      return stats.fullChainIds || [];
    case 'inProgress':
      return stats.inProgressIds || [];
    case 'stuck':
      return stats.stuckIds || [];
    case 'withKhmdhs':
      return stats.withKhmdhsIds || stats.funnel?.any || [];
    case 'withRelated':
      return stats.funnel?.RELATED || [];
    case 'freshnessOld':
      return stats.freshness?.old || [];
    case 'freshnessStale':
      return stats.freshness?.stale || [];
    case 'withSymv':
      return (stats.varianceRows || [])
        .filter((row) => row.symvAmount != null && row.symvAmount > 0)
        .map((row) => row.subprojectId);
    case 'attention':
      return (stats.attentionList || []).map((item) => item.subprojectId);
    default:
      return [];
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Υπολογίζει όλα τα portfolio metrics από τη λίστα υποέργων.
 *
 * @param {Array<object>} projects
 * @returns {KhmdhsPortfolioStats}
 */
export function buildKhmdhsPortfolioStatistics(projects) {
  const list = Array.isArray(projects) ? projects : [];

  // ── Funnel counts ──────────────────────────────────────────────────────────
  const funnel = {
    any:     list.filter(hasAny).map((p) => p.subprojectId),
    RELATED: list.filter(hasRELATED).map((p) => p.subprojectId),
    REQ:     list.filter(hasREQ).map((p) => p.subprojectId),
    COMMIT:  list.filter(hasCOMMIT).map((p) => p.subprojectId),
    PROC:    list.filter(hasPROC).map((p) => p.subprojectId),
    AWRD:    list.filter(hasAWRD).map((p) => p.subprojectId),
    SYMV:    list.filter(hasSYMV).map((p) => p.subprojectId),
    PAY:     list.filter(hasPAY).map((p) => p.subprojectId),
  };
  const withKhmdhsIds = list.filter(hasKhmdhsCoverage).map((p) => p.subprojectId);

  // ── Full chain & depth ────────────────────────────────────────────────────
  const fullChainIds = list.filter(isFullChain).map(p => p.subprojectId);
  const avgDepth = list.length
    ? Math.round((list.reduce((s, p) => s + chainDepth(p), 0) / list.length) * 10) / 10
    : 0;

  // ── Gap analysis ──────────────────────────────────────────────────────────
  const gaps = {
    awrd_no_symv:   [],
    proc_no_awrd:   [],
    proc_cancelled: [],
    symv_no_pay:    [],
  };
  list.forEach((p) => {
    getAllStuckReasons(p).forEach((reason) => {
      if (gaps[reason]) {
        gaps[reason].push({
          subprojectId: p.subprojectId,
          projectTitle: p.projectTitle,
          subprojectTitle: p.subprojectTitle,
        });
      }
    });
  });

  // ── Financial pipeline (totals) ────────────────────────────────────────────
  let approvedTotal = 0;
  let reqTotal = 0;   let reqCount = 0;
  let commitTotal = 0; let commitCount = 0;
  let procTotal = 0;  let procCount = 0;
  let awrdTotal = 0;  let awrdCount = 0;
  let symvTotal = 0;  let symvCount = 0;
  let payTotal = 0;   let payCount = 0;

  // Stage-level data for cards
  const stageDetails = {
    REQ:    { total: 0, count: 0, cancelledIds: [] },
    COMMIT: { total: 0, count: 0, multipleIds: [], cancelledIds: [] },
    PROC:   { total: 0, count: 0, cancelledIds: [] },
    AWRD:   { total: 0, count: 0, cancelledIds: [] },
    SYMV:   { total: 0, count: 0, cancelledIds: [], multipleIds: [] },
    PAY:    { total: 0, count: 0, totalEntries: 0 },
  };

  // Timeline: SYMV by year, PAY by month (count + amount)
  const symvByYear = {};
  const payByMonth = {};
  const payByMonthAmounts = {};

  // Per-project financial variance rows
  const varianceRows = [];

  list.forEach((p) => {
    // Approved amount
    const app = parseApprovedAmount(p.approvedAmount);
    approvedTotal += app;

    // REQ
    const rAmt = reqAmount(p);
    if (rAmt != null) { reqTotal += rAmt; reqCount++; stageDetails.REQ.total += rAmt; stageDetails.REQ.count++; }
    const reqSnap = pickKhmdhsRequestSnapshot(p?.khmdhsRequestSnapshot);
    if (reqSnap?.cancelled) stageDetails.REQ.cancelledIds.push(p.subprojectId);

    // COMMIT
    const cAmt = commitAmount(p);
    const decisions = collectKhmdhsCommitmentDecisions(p);
    if (cAmt != null) { commitTotal += cAmt; commitCount++; stageDetails.COMMIT.total += cAmt; stageDetails.COMMIT.count++; }
    if (decisions.length > 1) stageDetails.COMMIT.multipleIds.push(p.subprojectId);

    // PROC
    const pAmt = procAmount(p);
    if (pAmt != null) { procTotal += pAmt; procCount++; stageDetails.PROC.total += pAmt; stageDetails.PROC.count++; }
    const procSnap = pickKhmdhsNoticeSnapshot(p?.khmdhsNoticeSnapshot);
    if (procSnap?.cancelled) stageDetails.PROC.cancelledIds.push(p.subprojectId);

    // AWRD
    const aAmt = awrdAmount(p);
    if (aAmt != null) { awrdTotal += aAmt; awrdCount++; stageDetails.AWRD.total += aAmt; stageDetails.AWRD.count++; }
    const awrdSnap = pickKhmdhsAwardSnapshot(p?.khmdhsAwardSnapshot);
    if (awrdSnap?.cancelled) stageDetails.AWRD.cancelledIds.push(p.subprojectId);

    // SYMV
    const sAmt = symvAmount(p);
    if (sAmt != null) { symvTotal += sAmt; symvCount++; stageDetails.SYMV.total += sAmt; stageDetails.SYMV.count++; }
    const symvEntries = getKhmdhsDisplayEntries(p);
    if (symvEntries.length > 1) stageDetails.SYMV.multipleIds.push(p.subprojectId);
    const symvYear = isoYear(symvSignedDate(p));
    if (symvYear) symvByYear[symvYear] = (symvByYear[symvYear] || 0) + 1;

    // PAY
    const payTotals = buildKhmdhsPaymentsTotals(p);
    if (payTotals.rawTotalGross != null && payTotals.rawTotalGross > 0) {
      payTotal += payTotals.rawTotalGross;
      payCount++;
      stageDetails.PAY.total += payTotals.rawTotalGross;
      stageDetails.PAY.count++;
      stageDetails.PAY.totalEntries += payTotals.count || 0;
    }
    payDates(p).forEach((d) => {
      const ym = isoMonth(d);
      if (ym) payByMonth[ym] = (payByMonth[ym] || 0) + 1;
    });
    (p.khmdhsPayments || []).forEach((pay) => {
      const snap = pay?.snapshot;
      if (!snap) return;
      const ym = isoMonth(snap.signedDate);
      const amt = paymentGross(snap);
      if (ym && amt != null && amt > 0) {
        payByMonthAmounts[ym] = (payByMonthAmounts[ym] || 0) + amt;
      }
    });

    // Variance row (PROC / SYMV / PAY)
    const vProc = procAmount(p);
    const vSymv = symvAmount(p);
    const vPay = payAmount(p);
    if (vSymv != null || vProc != null || vPay != null) {
      const executionPct = vSymv > 0 && vPay != null
        ? Math.round((vPay / vSymv) * 100)
        : null;
      const procVsSymvPct = vProc > 0 && vSymv != null
        ? Math.round(((vSymv - vProc) / vProc) * 100)
        : null;
      varianceRows.push({
        subprojectId: p.subprojectId,
        projectTitle: p.projectTitle || '',
        subprojectTitle: p.subprojectTitle || '',
        procAmount: vProc,
        symvAmount: vSymv,
        payAmount: vPay,
        approvedAmount: app > 0 ? app : null,
        executionPct,
        procVsSymvPct,
      });
    }
  });

  varianceRows.sort((a, b) => {
    if (a.executionPct != null && b.executionPct != null) return a.executionPct - b.executionPct;
    if (a.executionPct != null) return -1;
    if (b.executionPct != null) return 1;
    return (b.symvAmount || 0) - (a.symvAmount || 0);
  });

  // ── Coverage ratios ────────────────────────────────────────────────────────
  const symvVsApprovedPct = approvedTotal > 0
    ? Math.round((symvTotal / approvedTotal) * 100)
    : null;
  const payVsSymvPct = symvTotal > 0
    ? Math.round((payTotal / symvTotal) * 100)
    : null;

  // ── Freshness distribution ─────────────────────────────────────────────────
  const freshness = { none: [], fresh: [], stale: [], old: [] };
  list.forEach((p) => {
    if (!hasKhmdhsCoverage(p)) {
      freshness.none.push(p.subprojectId);
      return;
    }
    const { level, days } = getKhmdhsChainFreshness(p);
    if (level === 'red') {
      freshness.old.push(p.subprojectId);
      return;
    }
    if (level === 'yellow') {
      freshness.stale.push(p.subprojectId);
      return;
    }
    if (days != null && days < KHMDHS_FRESHNESS_YELLOW_DAYS) {
      freshness.fresh.push(p.subprojectId);
      return;
    }
    const stamps = collectKhmdhsFetchedAtTimestamps(p);
    if (stamps.length) freshness.fresh.push(p.subprojectId);
    else freshness.stale.push(p.subprojectId);
  });

  // ── Quality & reliability ───────────────────────────────────────────────────
  let dqrCleanCount = 0;
  let khmdhsWithCancelled = 0;
  const attentionList = [];

  list.forEach((p) => {
    const issues = [];
    const unresolved = getUnresolvedReviewItems(p.khmdhsDataQualityReview, p);

    if (hasAny(p)) {
      if (unresolved.length === 0) dqrCleanCount++;
      else issues.push(`${unresolved.length} εκκρεμή θέματα έλεγχου`);

      if (hasCancelledStage(p)) {
        khmdhsWithCancelled++;
        issues.push('Ματαιωμένο στάδιο αλυσίδας');
      }

      if (freshness.old.includes(p.subprojectId)) {
        issues.push('Παλιά ανακτήση ΚΗΜΔΗΣ');
      } else if (freshness.stale.includes(p.subprojectId)) {
        issues.push('Προτείνεται ανανέωση ΚΗΜΔΗΣ');
      }
    } else if (hasRELATED(p)) {
      if (freshness.old.includes(p.subprojectId)) {
        issues.push('Παλιά ανακτήση ΚΗΜΔΗΣ');
      } else if (freshness.stale.includes(p.subprojectId)) {
        issues.push('Προτείνεται ανανέωση ΚΗΜΔΗΣ');
      }
      issues.push('Μόνο σχετικά έγγραφα (χωρίς κύρια αλυσίδα)');
    } else if (shouldExpectKhmdhs(p)) {
      issues.push('Λείπουν δεδομένα ΚΗΜΔΗΣ');
    }

    getAllStuckReasons(p).forEach((stuck) => {
      issues.push(GAP_ATTENTION_LABELS[stuck] || stuck);
    });

    if (issues.length) {
      attentionList.push({
        subprojectId: p.subprojectId,
        projectTitle: p.projectTitle || '',
        subprojectTitle: p.subprojectTitle || '',
        projectStatus: p.projectStatus || '',
        issues,
        unresolvedCount: unresolved.length,
        priority:
          unresolved.length * 10
          + (getAllStuckReasons(p).length * 5)
          + (freshness.old.includes(p.subprojectId) ? 2 : 0)
          + (freshness.stale.includes(p.subprojectId) ? 1 : 0)
          + (!hasKhmdhsCoverage(p) && shouldExpectKhmdhs(p) ? 8 : 0),
      });
    }
  });

  attentionList.sort((a, b) => b.priority - a.priority || b.unresolvedCount - a.unresolvedCount);

  const khmdhsCount = withKhmdhsIds.length;
  const freshOrStaleCount = freshness.fresh.length + freshness.stale.length;
  const totalCount = list.length;

  const scoreParts = totalCount === 0 ? null : {
    khmdhsCoverage: Math.round((khmdhsCount / totalCount) * 100),
    dqrClean: funnel.any.length > 0 ? Math.round((dqrCleanCount / funnel.any.length) * 100) : 100,
    freshnessGood: khmdhsCount > 0 ? Math.round((freshOrStaleCount / khmdhsCount) * 100) : 100,
    noCancelled: funnel.any.length > 0
      ? Math.round(((funnel.any.length - khmdhsWithCancelled) / funnel.any.length) * 100)
      : 100,
  };

  const reliabilityScore = scoreParts == null ? null : Math.round(
    scoreParts.khmdhsCoverage * 0.25
    + scoreParts.dqrClean * 0.25
    + scoreParts.freshnessGood * 0.25
    + scoreParts.noCancelled * 0.25
  );

  const stuckIdSet = new Set();
  Object.values(gaps).forEach((arr) => {
    arr.forEach((item) => stuckIdSet.add(item.subprojectId));
  });
  const stuckIds = [...stuckIdSet];
  const fullSet = new Set(fullChainIds);
  const inProgressIds = withKhmdhsIds.filter((id) => !fullSet.has(id) && !stuckIdSet.has(id));

  const procVsSymvAggregatePct = procTotal > 0 && symvTotal > 0
    ? Math.round(((symvTotal - procTotal) / procTotal) * 100)
    : null;

  const healthBar = {
    fullChain: fullChainIds.length,
    inProgress: inProgressIds.length,
    stuck: stuckIds.length,
    khmdhsCoverage: khmdhsCount,
    relatedDocs: funnel.RELATED.length,
    payVsSymvPct,
    payTotal,
    symvTotal,
  };

  return {
    total: list.length,

    // Funnel: IDs at each stage
    funnel,
    withKhmdhsIds,

    // Chain quality
    fullChainIds,
    inProgressIds,
    stuckIds,
    avgDepth,

    // Gaps (stuck projects)
    gaps,

    // Financial pipeline
    pipeline: {
      approved:     approvedTotal,
      reqTotal,     reqCount,
      commitTotal,  commitCount,
      procTotal,    procCount,
      awrdTotal,    awrdCount,
      symvTotal,    symvCount,
      payTotal,     payCount,
    },

    // Coverage ratios
    symvVsApprovedPct,
    payVsSymvPct,
    procVsSymvAggregatePct,

    // Per-stage details
    stageDetails,

    // Timelines
    symvByYear,
    payByMonth,
    payByMonthAmounts,

    // Per-project financial comparison
    varianceRows,

    // Freshness
    freshness,

    // Quality
    reliabilityScore,
    scoreParts,
    attentionList,
    healthBar,
    dqrCleanCount,
    khmdhsWithCancelled,
    relatedDocsCount: funnel.RELATED.length,
  };
}

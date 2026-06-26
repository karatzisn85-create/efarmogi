/** Στατιστικά δημοσίευσης (ΚΗΜΔΗΣ PROC) */

import { PROJECT_STATUS_CONTRACT_PROCESS } from '../data/formOptions';
import { computeKhmdhsContractVariance } from './khmdhsExportFields';
import {
  pickKhmdhsNoticeSnapshot,
  projectHasKhmdhsNoticeData,
  resolveKhmdhsNoticeAssignmentProcedure
} from './khmdhsNoticeFields';
import { grossFromCostSnapshot } from './khmdhsVatHelper';

function getNoticeEstimatedAmount(project) {
  const snap = pickKhmdhsNoticeSnapshot(project?.khmdhsNoticeSnapshot);
  if (!snap) return 0;
  const gross = grossFromCostSnapshot(snap);
  return gross != null ? gross : 0;
}

export function isActiveProcurement(project) {
  if (project?.projectStatus !== PROJECT_STATUS_CONTRACT_PROCESS) return false;
  if (!projectHasKhmdhsNoticeData(project)) return false;
  const snap = pickKhmdhsNoticeSnapshot(project.khmdhsNoticeSnapshot);
  return !!(snap && !snap.cancelled);
}

export function buildProcurementStatistics(projects, { varianceThresholdPct = 10 } = {}) {
  const list = projects || [];

  const active = list.filter(isActiveProcurement);
  const withNotice = list.filter(projectHasKhmdhsNoticeData);
  const cancelled = withNotice.filter((p) => {
    const snap = pickKhmdhsNoticeSnapshot(p.khmdhsNoticeSnapshot);
    return !!snap?.cancelled;
  });

  let totalEstimatedValue = 0;
  active.forEach((p) => {
    totalEstimatedValue += getNoticeEstimatedAmount(p);
  });

  const procedureDistribution = {};
  const noticeTypeDistribution = {};
  let signedToDeadlineDaysSum = 0;
  let signedToDeadlineCount = 0;

  withNotice.forEach((p) => {
    const snap = pickKhmdhsNoticeSnapshot(p.khmdhsNoticeSnapshot);
    if (!snap) return;

    const proc = resolveKhmdhsNoticeAssignmentProcedure(snap) || 'Άγνωστο';
    procedureDistribution[proc] = (procedureDistribution[proc] || 0) + 1;

    const nt = snap.noticeType || 'Άγνωστο';
    noticeTypeDistribution[nt] = (noticeTypeDistribution[nt] || 0) + 1;

    if (snap.signedDate && snap.finalSubmissionDate) {
      const signed = new Date(snap.signedDate);
      const deadline = new Date(snap.finalSubmissionDate);
      if (!Number.isNaN(signed.getTime()) && !Number.isNaN(deadline.getTime())) {
        signedToDeadlineDaysSum += Math.round((deadline - signed) / (24 * 60 * 60 * 1000));
        signedToDeadlineCount += 1;
      }
    }
  });

  const varianceRows = [];
  list.forEach((p) => {
    const v = computeKhmdhsContractVariance(p);
    if (!v) return;
    const snap = pickKhmdhsNoticeSnapshot(p.khmdhsNoticeSnapshot);
    varianceRows.push({
      subprojectId: p.subprojectId,
      subprojectTitle: p.subprojectTitle || '',
      projectTitle: p.projectTitle || '',
      adam: snap?.referenceNumber || p.khmdhsNoticeAdam || '',
      estimatedNet: v.estimatedNet,
      estimatedGross: v.estimatedGross,
      contract: v.contract,
      diff: v.diff,
      pct: v.pct,
      exceedsThreshold: Math.abs(v.pct) >= varianceThresholdPct
    });
  });
  varianceRows.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

  const activeEstimatedByProcedure = {};
  active.forEach((p) => {
    const snap = pickKhmdhsNoticeSnapshot(p.khmdhsNoticeSnapshot);
    const proc = resolveKhmdhsNoticeAssignmentProcedure(snap) || 'Άγνωστο';
    if (!activeEstimatedByProcedure[proc]) {
      activeEstimatedByProcedure[proc] = { count: 0, amount: 0 };
    }
    activeEstimatedByProcedure[proc].count += 1;
    activeEstimatedByProcedure[proc].amount += getNoticeEstimatedAmount(p);
  });

  return {
    activeCount: active.length,
    totalEstimatedValue,
    withNoticeCount: withNotice.length,
    cancelledCount: cancelled.length,
    procedureDistribution,
    noticeTypeDistribution,
    activeEstimatedByProcedure,
    avgDaysSignedToDeadline: signedToDeadlineCount > 0
      ? Math.round(signedToDeadlineDaysSum / signedToDeadlineCount)
      : null,
    varianceRows,
    varianceAboveThresholdCount: varianceRows.filter((r) => r.exceedsThreshold).length,
    varianceThresholdPct
  };
}

/** Προθεσμίες δημοσίευσης από snapshot ΚΗΜΔΗΣ (PROC) */

import {
  PROJECT_STATUS_CONTRACT_PROCESS,
  STATUSES_WITH_KHMDHS_ADAM,
  statusShowsAssignmentProcedure
} from '../data/formOptions';
import { getTotalContractAmount } from './khmdhsFields';
import {
  formatKhmdhsEuro,
  pickKhmdhsNoticeSnapshot,
  projectHasKhmdhsNoticeData
} from './khmdhsNoticeFields';
import { grossFromCostSnapshot } from './khmdhsVatHelper';

export function daysUntilDate(isoDate) {
  if (!isoDate) return null;
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

export function projectHasSignedContractStatus(project) {
  return STATUSES_WITH_KHMDHS_ADAM.includes(project?.projectStatus);
}

/** Η φάση δημοσίευσης έχει ολοκληρωθεί — δεν εμφανίζουμε καταληκτικές / countdown */
export function projectProcurementPhaseConcluded(project) {
  if (!project) return false;
  if (projectHasSignedContractStatus(project)) return true;
  if (getTotalContractAmount(project) <= 0) return false;
  if (project.contractDate) return true;
  if (Array.isArray(project.contracts) && project.contracts.some((c) => c?.date)) return true;
  return false;
}

export function getProcurementDeadlineInfo(project) {
  if (projectProcurementPhaseConcluded(project)) {
    return { kind: 'none' };
  }

  const snap = pickKhmdhsNoticeSnapshot(project?.khmdhsNoticeSnapshot);
  if (!snap?.finalSubmissionDate) {
    return { kind: 'none' };
  }

  const deadlineIso = String(snap.finalSubmissionDate);
  const daysLeft = daysUntilDate(deadlineIso);

  if (snap.cancelled) {
    return {
      kind: 'cancelled',
      daysLeft,
      urgency: 'muted',
      deadlineIso,
      adam: snap.referenceNumber || project?.khmdhsNoticeAdam || '',
      title: snap.title || project?.subprojectTitle || '',
      estimatedAmount: grossFromCostSnapshot(snap)
    };
  }

  if (daysLeft === null) {
    return { kind: 'none' };
  }

  let kind = 'upcoming';
  if (daysLeft < 0) kind = 'past';
  else if (daysLeft === 0) kind = 'today';

  let urgency = 'normal';
  if (kind === 'past') urgency = 'past';
  else if (daysLeft <= 7) urgency = 'urgent';
  else if (daysLeft <= 30) urgency = 'soon';

  return {
    kind,
    daysLeft,
    urgency,
    deadlineIso,
    adam: snap.referenceNumber || project?.khmdhsNoticeAdam || '',
    title: snap.title || project?.subprojectTitle || '',
    estimatedAmount: grossFromCostSnapshot(snap)
  };
}

export function formatDeadlineCountdownLabel(info) {
  if (!info || info.kind === 'none') return '';
  if (info.kind === 'cancelled') return 'Ματαιωμένη δημοσίευση';
  if (info.kind === 'past') {
    const n = Math.abs(info.daysLeft);
    return n === 1 ? 'Έληξε χθες' : `Έληξε πριν ${n} ημέρες`;
  }
  if (info.kind === 'today') return 'Καταληκτική σήμερα';
  if (info.daysLeft === 1) return 'Καταληκτική αύριο';
  return `Απομένουν ${info.daysLeft} ημέρες`;
}

export function isExpiredWithoutContract(project) {
  const info = getProcurementDeadlineInfo(project);
  if (info.kind !== 'past') return false;
  if (projectHasSignedContractStatus(project)) return false;
  if (!statusShowsAssignmentProcedure(project?.projectStatus)) return false;
  return getTotalContractAmount(project) <= 0;
}

export function matchesKhmdhsDeadlineFilter(project, filterKey, windowDays = 30) {
  if (!filterKey) return true;
  if (!projectHasKhmdhsNoticeData(project)) return false;

  const info = getProcurementDeadlineInfo(project);
  const snap = pickKhmdhsNoticeSnapshot(project?.khmdhsNoticeSnapshot);

  switch (filterKey) {
    case 'upcoming30':
      return (info.kind === 'upcoming' || info.kind === 'today')
        && info.daysLeft != null
        && info.daysLeft >= 0
        && info.daysLeft <= windowDays;
    case 'expiredNoContract':
      return isExpiredWithoutContract(project);
    case 'cancelled':
      return !!(snap?.cancelled || info.kind === 'cancelled');
    default:
      return true;
  }
}

export function buildProcurementDeadlineAlerts(projects, { maxDays = 90, limit = 8 } = {}) {
  const rows = [];

  for (const p of projects || []) {
    if (p.projectStatus !== PROJECT_STATUS_CONTRACT_PROCESS) continue;
    const info = getProcurementDeadlineInfo(p);
    if (info.kind !== 'upcoming' && info.kind !== 'today') continue;
    if (info.daysLeft == null || info.daysLeft > maxDays) continue;

    rows.push({
      subprojectId: p.subprojectId,
      projectId: p.projectId,
      subprojectTitle: p.subprojectTitle || '(Χωρίς τίτλο)',
      projectTitle: p.projectTitle || '',
      adam: info.adam,
      daysLeft: info.daysLeft,
      deadlineIso: info.deadlineIso,
      urgency: info.urgency,
      amountLabel: formatKhmdhsEuro(info.estimatedAmount)
    });
  }

  rows.sort(
    (a, b) => a.daysLeft - b.daysLeft
      || (a.subprojectTitle || '').localeCompare(b.subprojectTitle || '', 'el', { sensitivity: 'base' })
  );

  return rows.slice(0, limit);
}

/** ΚΗΜΔΗΣ — οπτική αλυσίδα σταδίων REQ → PROC → AWRD → SYMV */

import {
  STATUSES_WITH_CONTRACT_FIELDS,
  statusShowsAssignmentProcedure,
  PROJECT_STATUS_CONTRACT_PROCESS,
} from '../data/formOptions';
import { getKhmdhsDisplayEntries } from './khmdhsFields';
import { pickKhmdhsNoticeSnapshot, projectHasKhmdhsNoticeData } from './khmdhsNoticeFields';
import { pickKhmdhsRequestSnapshot, projectHasKhmdhsRequestData } from './khmdhsRequestFields';
import { pickKhmdhsAwardSnapshot, projectHasKhmdhsAwardData } from './khmdhsAwardFields';
import { getProjectAssignmentProcedure } from './khmdhsNoticeFields';
import { filterUnrelatedPayments } from './khmdhsPaymentReconciliation';
import { collectKhmdhsCommitmentDecisions } from './khmdhsChainExtraFields';
import { getKhmdhsSupplementaryStageEntries } from './khmdhsSupplementaryStageEntries';

export const LIFECYCLE_STAGE_META = {
  REQ: {
    id: 'REQ',
    label: 'Πρωτογενές αίτημα',
    shortLabel: 'Αίτημα',
    icon: '📋',
    accent: '#6366f1',
    accentDark: '#4338ca',
    bg: '#eef2ff',
    border: 'rgba(99, 102, 241, 0.35)',
  },
  COMMIT: {
    id: 'COMMIT',
    label: 'Αποφάσεις ανάληψης υποχρέωσης',
    shortLabel: 'Ανάληψη',
    icon: '🧾',
    accent: '#8b5cf6',
    accentDark: '#6d28d9',
    bg: '#f5f3ff',
    border: 'rgba(139, 92, 246, 0.35)',
  },
  PROC: {
    id: 'PROC',
    label: 'Δημοσίευση',
    shortLabel: 'Δημοσίευση',
    icon: '🌐',
    accent: '#10b981',
    accentDark: '#047857',
    bg: '#ecfdf5',
    border: 'rgba(16, 185, 129, 0.35)',
  },
  AWRD: {
    id: 'AWRD',
    label: 'Ανάθεση',
    shortLabel: 'Ανάθεση',
    icon: '🏆',
    accent: '#0891b2',
    accentDark: '#0e7490',
    bg: '#ecfeff',
    border: 'rgba(6, 182, 212, 0.35)',
  },
  SYMV: {
    id: 'SYMV',
    label: 'Σύμβαση',
    shortLabel: 'Σύμβαση',
    icon: '📄',
    accent: '#d97706',
    accentDark: '#b45309',
    bg: '#fffbeb',
    border: 'rgba(217, 119, 6, 0.35)',
  },
  SUPP: {
    id: 'SUPP',
    label: 'Συμπληρωματικές συμβάσεις',
    shortLabel: 'Συμπλ.',
    icon: '➕',
    accent: '#7c3aed',
    accentDark: '#6d28d9',
    bg: '#f5f3ff',
    border: 'rgba(124, 58, 237, 0.35)',
  },
  EXTENSION: {
    id: 'EXTENSION',
    label: 'Παρατάσεις',
    shortLabel: 'Παράτ.',
    icon: '⏱️',
    accent: '#9333ea',
    accentDark: '#7e22ce',
    bg: '#faf5ff',
    border: 'rgba(147, 51, 234, 0.35)',
  },
  PAY: {
    id: 'PAY',
    label: 'Εντάλματα πληρωμής',
    shortLabel: 'Εντάλματα',
    icon: '💶',
    accent: '#0d9488',
    accentDark: '#0f766e',
    bg: '#f0fdfa',
    border: 'rgba(13, 148, 136, 0.35)',
  },
  APE: {
    id: 'APE',
    label: 'ΑΠΕ',
    shortLabel: 'ΑΠΕ',
    icon: '📑',
    accent: '#0d9488',
    accentDark: '#0f766e',
    bg: '#ecfdf5',
    border: 'rgba(13, 148, 136, 0.38)',
  },
};

const STAGE_ORDER = ['REQ', 'PROC', 'AWRD', 'SYMV'];

/** Διαδικασίες όπου δεν υπάρχει (ούτε απαιτείται) ηλεκτρονική προκήρυξη/διακήρυξη στο ΚΗΜΔΗΣ. */
function awardIndicatesNoPriorNotice(project) {
  const awrdSnap = pickKhmdhsAwardSnapshot(project?.khmdhsAwardSnapshot);
  const procedure = String(
    awrdSnap?.procedureType
    || awrdSnap?.typeOfProcedure
    || getProjectAssignmentProcedure(project)
    || project?.assignmentProcedure
    || ''
  ).trim();
  if (!procedure) return false;

  if (/χωρίς\s+προηγούμενη\s+δημοσίευση/i.test(procedure)) return true;
  if (/άμεσ[ηα]\s+ανάθεση/i.test(procedure)) return true;
  if (procedure === 'ΑΠΕΥΘΕΙΑΣ ΑΝΑΘΕΣΗ') return true;

  if (!projectHasKhmdhsAwardData(project)) return false;
  const hasNoticeRefs = !!String(awrdSnap?.noticeReferenceNumber || '').trim()
    || (Array.isArray(awrdSnap?.noticeRefNos) && awrdSnap.noticeRefNos.length > 0);
  if (!hasNoticeRefs && /διαπραγμάτευση/i.test(procedure)) return true;

  return false;
}

function isProcStageNotApplicable(project) {
  if (projectHasKhmdhsNoticeData(project)) return false;
  if (!projectHasKhmdhsAwardData(project) && !getSymvStageInfo(project).has) return false;
  return awardIndicatesNoPriorNotice(project);
}

function getCommitmentStageInfo(project) {
  const decisions = collectKhmdhsCommitmentDecisions(project);

  if (decisions.length > 0) {
    const first = decisions[0];
    const allCancelled = decisions.every((d) => d.snapshot?.cancelled);
    return {
      has: true,
      adam: String(first.adam || first.snapshot?.referenceNumber || '').trim(),
      cancelled: allCancelled,
      extraLabel: decisions.length > 1 ? `${decisions.length}× ανάληψη` : null,
    };
  }

  return { has: false, adam: '', cancelled: false, extraLabel: null };
}

function getSupplementaryStageInfo(project) {
  const entries = getKhmdhsSupplementaryStageEntries(project);
  const supplementaries = entries.filter((e) => !e.isExtension);
  if (supplementaries.length === 0) {
    return { has: false, adam: '', cancelled: false, extraLabel: null };
  }
  return {
    has: true,
    adam: supplementaries[0].adam || '',
    cancelled: false,
    extraLabel: supplementaries.length > 1 ? `${supplementaries.length}× συμπλ.` : null,
  };
}

function getExtensionStageInfo(project) {
  const entries = getKhmdhsSupplementaryStageEntries(project);
  const extensions = entries.filter((e) => e.isExtension);
  if (extensions.length === 0) {
    return { has: false, adam: '', cancelled: false, extraLabel: null };
  }
  return {
    has: true,
    adam: extensions[0].adam || '',
    cancelled: false,
    extraLabel: extensions.length > 1 ? `${extensions.length}× παράτ.` : null,
  };
}

function getPaymentsStageInfo(project) {
  const rawList = Array.isArray(project?.khmdhsPayments) ? project.khmdhsPayments : [];
  const list = filterUnrelatedPayments(rawList, project);
  const valid = list.filter((p) => p && (p.adam || p.snapshot?.referenceNumber));
  if (valid.length === 0) {
    return { has: false, adam: '', cancelled: false, extraLabel: null };
  }
  const allCancelled = valid.every((p) => p.snapshot?.cancelled);
  return {
    has: true,
    adam: valid[0].adam || valid[0].snapshot?.referenceNumber || '',
    cancelled: allCancelled,
    extraLabel: valid.length > 1 ? `${valid.length}× εντάλ.` : null,
  };
}

function getSymvStageInfo(project) {
  const entries = getKhmdhsDisplayEntries(project);
  if (entries.length === 0) {
    const adam = String(project?.khmdhsAdam || '').trim();
    const snap = project?.khmdhsContractSnapshot;
    if (!adam && !snap) {
      return { has: false, adam: '', cancelled: false, extraLabel: null };
    }
    return {
      has: true,
      adam: adam || snap?.referenceNumber || '',
      cancelled: !!snap?.cancelled,
      extraLabel: null,
    };
  }
  // Επιλογή κύριας σύμβασης: προτεραιότητα στη ρίζα (isRoot) ή στη seed (isSeed)
  const root = entries.find((e) => e.isRoot) || entries.find((e) => e.isSeed) || entries[0];
  return {
    has: true,
    adam: String(root.adam || root.snapshot?.referenceNumber || '').trim(),
    cancelled: entries.some((e) => e.snapshot?.cancelled),
    extraLabel: entries.length > 1 ? `${entries.length} συμβάσεις` : null,
  };
}

export function projectHasAnyKhmdhsLifecycleData(project) {
  if (!project) return false;
  return (
    projectHasKhmdhsRequestData(project)
    || projectHasKhmdhsNoticeData(project)
    || projectHasKhmdhsAwardData(project)
    || getKhmdhsDisplayEntries(project).length > 0
    || !!String(project.khmdhsChainSeedAdam || '').trim()
    || !!String(project.khmdhsAdam || '').trim()
    || !!String(project.khmdhsNoticeAdam || '').trim()
    || !!String(project.khmdhsCommitmentAdam || '').trim()
    || filterUnrelatedPayments(Array.isArray(project.khmdhsPayments) ? project.khmdhsPayments : [], project).length > 0
  );
}

/** Εμφάνιση αλυσίδας: διαδικασία ανάθεσης / σύμβαση ή δεδομένα ΚΗΜΔΗΣ */
export function shouldShowKhmdhsLifecycleRail(project) {
  if (!project) return false;
  if (projectHasAnyKhmdhsLifecycleData(project)) return true;
  if (statusShowsAssignmentProcedure(project.projectStatus)) return true;
  if (STATUSES_WITH_CONTRACT_FIELDS.includes(project.projectStatus)) return true;
  return false;
}

/**
 * @returns {Array<{
 *   id: string, label: string, shortLabel: string, icon: string,
 *   accent: string, accentDark: string, bg: string, border: string,
 *   has: boolean, adam: string, cancelled: boolean, extraLabel?: string|null,
 *   status: 'pending'|'current'|'complete'|'cancelled'
 * }>}
 */
function inferCurrentStageIndex(project, raw) {
  const anyData = raw.some((s) => s.has);
  if (anyData) return -1;

  const status = project?.projectStatus;
  if (!status || !statusShowsAssignmentProcedure(status)) return -1;

  if (STATUSES_WITH_CONTRACT_FIELDS.includes(status)) {
    return STAGE_ORDER.indexOf('SYMV');
  }
  if (status === PROJECT_STATUS_CONTRACT_PROCESS) {
    return STAGE_ORDER.indexOf('SYMV');
  }
  return STAGE_ORDER.indexOf('PROC');
}

export function buildKhmdhsLifecycleStages(project) {
  const reqSnap = pickKhmdhsRequestSnapshot(project?.khmdhsRequestSnapshot);
  const procSnap = pickKhmdhsNoticeSnapshot(project?.khmdhsNoticeSnapshot);
  const awrdSnap = pickKhmdhsAwardSnapshot(project?.khmdhsAwardSnapshot);
  const symv = getSymvStageInfo(project);

  const raw = STAGE_ORDER.map((id) => {
    const meta = LIFECYCLE_STAGE_META[id];
    if (id === 'REQ') {
      return {
        ...meta,
        has: projectHasKhmdhsRequestData(project),
        adam: String(project?.khmdhsRequestAdam || reqSnap?.referenceNumber || '').trim(),
        cancelled: !!reqSnap?.cancelled,
        extraLabel: null,
      };
    }
    if (id === 'PROC') {
      return {
        ...meta,
        has: projectHasKhmdhsNoticeData(project),
        adam: String(project?.khmdhsNoticeAdam || procSnap?.referenceNumber || '').trim(),
        cancelled: !!procSnap?.cancelled,
        extraLabel: null,
      };
    }
    if (id === 'AWRD') {
      return {
        ...meta,
        has: projectHasKhmdhsAwardData(project),
        adam: String(project?.khmdhsAwardAdam || awrdSnap?.referenceNumber || '').trim(),
        cancelled: !!awrdSnap?.cancelled,
        extraLabel: null,
      };
    }
    return {
      ...meta,
      has: symv.has,
      adam: symv.adam,
      cancelled: symv.cancelled,
      extraLabel: symv.extraLabel,
    };
  });

  let lastFilledIndex = -1;
  raw.forEach((s, i) => {
    if (s.has) lastFilledIndex = i;
  });

  const allComplete = lastFilledIndex === raw.length - 1
    && raw.every((s) => s.has && !s.cancelled);

  const inferredCurrent = inferCurrentStageIndex(project, raw);

  const procNotApplicable = isProcStageNotApplicable(project);

  const coreStages = raw.map((s, i) => {
    if (s.id === 'PROC' && procNotApplicable) {
      return {
        ...s,
        has: false,
        notApplicable: true,
        status: 'skipped',
        extraLabel: 'Χωρ. δημ.',
      };
    }

    let status = 'pending';
    if (s.cancelled) {
      status = 'cancelled';
    } else if (s.has) {
      if (allComplete) status = 'complete';
      else if (i < lastFilledIndex) status = 'complete';
      else if (i === lastFilledIndex) status = 'current';
      else status = 'complete';
    } else if (inferredCurrent >= 0) {
      if (i < inferredCurrent) status = 'complete';
      else if (i === inferredCurrent) status = 'current';
    }
    return { ...s, status };
  });

  // Μετά το skip PROC, επανυπολογισμός ροής (REQ → AWRD χωρίς κενό)
  let flowLastIndex = -1;
  coreStages.forEach((s, i) => {
    if (s.has || s.status === 'skipped') flowLastIndex = i;
  });
  coreStages.forEach((s, i) => {
    if (s.status === 'skipped' || s.notApplicable) return;
    if (!s.has && s.status === 'pending' && flowLastIndex >= 0 && i < flowLastIndex) {
      s.status = 'complete';
    }
  });

  // Προαιρετικά στάδια: εμφανίζονται μόνο όταν υπάρχουν δεδομένα, χωρίς να αλλοιώνουν τη βασική ροή
  const commitment = getCommitmentStageInfo(project);
  const supplementaries = getSupplementaryStageInfo(project);
  const extensions = getExtensionStageInfo(project);
  const payments = getPaymentsStageInfo(project);

  const result = [];
  coreStages.forEach((s) => {
    result.push(s);
    if (s.id === 'REQ' && commitment.has) {
      result.push({
        ...LIFECYCLE_STAGE_META.COMMIT,
        ...commitment,
        status: commitment.cancelled ? 'cancelled' : 'complete',
        optional: true,
      });
    }
    if (s.id === 'SYMV' && extensions.has) {
      result.push({
        ...LIFECYCLE_STAGE_META.EXTENSION,
        ...extensions,
        status: 'complete',
        optional: true,
      });
    }
    if (s.id === 'SYMV' && supplementaries.has) {
      result.push({
        ...LIFECYCLE_STAGE_META.SUPP,
        ...supplementaries,
        status: 'complete',
        optional: true,
      });
    }
    if (s.id === 'SYMV' && payments.has) {
      result.push({
        ...LIFECYCLE_STAGE_META.PAY,
        ...payments,
        status: payments.cancelled ? 'cancelled' : 'complete',
        optional: true,
      });
    }
  });

  return result;
}

export function getKhmdhsLifecycleProgress(stages) {
  const list = Array.isArray(stages) ? stages : [];
  const countable = list.filter((s) => !s.notApplicable);
  const filled = countable.filter((s) => (s.has || s.status === 'skipped') && s.status !== 'cancelled').length;
  const total = countable.length || 4;
  const current = list.find((s) => s.status === 'current')
    || list.filter((s) => s.has || s.status === 'skipped').pop()
    || list[0];
  const inferredDone = list.filter((s) => s.status === 'complete' || s.status === 'skipped').length;
  const pct = filled > 0
    ? Math.round((filled / total) * 100)
    : Math.round((inferredDone / total) * 100);
  return {
    filled: filled || inferredDone,
    total,
    pct,
    currentLabel: current?.label || '',
  };
}

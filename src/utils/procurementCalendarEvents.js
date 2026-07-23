/** Events για Ημερολόγιο Προθεσμιών (Φάση 3α) */

import { isAbandonedSubproject, PROJECT_STATUS_CONTRACT_PROCESS } from '../data/formOptions';
import { computeChainCharacterizationEffects, CHAIN_KIND, getChainKindChoice, getEffectiveChainKind } from './khmdhsChainActions';
import {
  findDirectAssignmentViolations,
  formatViolationSummary
} from './directAssignmentCompliance';
import {
  getTotalContractAmount,
  isMultipleContractsForm,
  normalizeContractsFromProject
} from './khmdhsFields';
import {
  pickKhmdhsNoticeSnapshot,
  projectHasKhmdhsNoticeData
} from './khmdhsNoticeFields';
import {
  buildEngineerVisibilityContext,
  projectVisibleToAssignedEngineer
} from './supervisorChargeDisplay';
import { formatDateEl, formatDateTimeEl, toIsoDateOnly } from './dateFormat';
import { getAllChainHistories } from './khmdhsChainFormAccess';
import { getKhmdhsSupplementaryStageEntries } from './khmdhsSupplementaryStageEntries';
import { SYMV_CHAIN_ROLE } from './khmdhsSymvChainPlanner';
import {
  daysUntilDate,
  projectProcurementPhaseConcluded
} from './procurementDeadlines';

export const CALENDAR_EVENT_TYPES = {
  DEADLINE: 'deadline',
  OFFERS_EXPIRY: 'offers_expiry',
  CONTRACT_END: 'contract_end',
  COMPLIANCE_12M: 'compliance_12m',
  CUSTOM: 'custom',
  AEPO_RENEWAL: 'aepo_renewal',
  PROSKLISI_DEADLINE: 'prosklisi_deadline',
};

export const CALENDAR_EVENT_LABELS = {
  [CALENDAR_EVENT_TYPES.DEADLINE]: 'Καταληκτική υποβολής προσφορών',
  [CALENDAR_EVENT_TYPES.OFFERS_EXPIRY]: 'Λήξη ισχύος προσφορών',
  [CALENDAR_EVENT_TYPES.CONTRACT_END]: 'Λήξη σύμβασης',
  [CALENDAR_EVENT_TYPES.COMPLIANCE_12M]: 'Παράβαση κανόνα 12 μηνών',
  [CALENDAR_EVENT_TYPES.CUSTOM]: 'Ειδοποίηση ημερολογίου',
  [CALENDAR_EVENT_TYPES.AEPO_RENEWAL]: 'Ανανέωση ΑΕΠΟ',
  [CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE]: 'Λήξη υποβολής πρόσκλησης',
};

export const PROCUREMENT_DEADLINE_EVENT_TYPES = [
  CALENDAR_EVENT_TYPES.DEADLINE,
  CALENDAR_EVENT_TYPES.OFFERS_EXPIRY
];

export const ALL_CALENDAR_EVENT_TYPES = [
  ...PROCUREMENT_DEADLINE_EVENT_TYPES,
  CALENDAR_EVENT_TYPES.CONTRACT_END,
  CALENDAR_EVENT_TYPES.COMPLIANCE_12M,
  CALENDAR_EVENT_TYPES.CUSTOM,
  CALENDAR_EVENT_TYPES.AEPO_RENEWAL,
  CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE,
];

function parseIsoDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDateKey(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : parseIsoDate(isoOrDate);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Ημερομηνία χωρίς ώρα (π.χ. custom ειδοποίηση με T12:00:00.000Z). */
export function isDateOnlyCalendarIso(iso) {
  const s = String(iso || '');
  if (!s.includes('T')) return true;
  return /^\d{4}-\d{2}-\d{2}T12:00:00(\.000)?Z$/i.test(s)
    || /^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?Z$/i.test(s);
}

/** Μοναδικό κλειδί React για γραμμές ημερολογίου (ξεχωριστά ανά σύμβαση). */
export function calendarEventRowKey(ev, prefix = '') {
  if (ev?.customEventId) {
    return `${prefix}${ev.type}-${ev.customEventId}-${ev.dateKey}`;
  }
  if (ev?.orimanthiProposalId) {
    return `${prefix}${ev.type}-${ev.orimanthiProposalId}-${ev.dateKey}`;
  }
  if (ev?.prosklisiId) {
    return `${prefix}${ev.type}-${ev.prosklisiId}-${ev.dateKey}`;
  }
  const contractPart = ev?.contractIndex != null
    ? `-c${ev.contractIndex}`
    : (ev?.adam ? `-a${ev.adam}` : '');
  const id = `${ev?.subprojectId || 'x'}${contractPart}`;
  return `${prefix}${ev?.type}-${id}-${ev?.dateKey}`;
}

/**
 * ΚΗΜΔΗΣ μονάδες: "1" ημέρες, "2" εβδομάδες, "3" μήνες, "4" έτη
 * (και ελληνικό/αγγλικό κείμενο, ή object { key, value }).
 * Άγνωστη μονάδα → null (όχι εικασία σε ημέρες).
 */
function resolveDurationUnitKind(unit) {
  let raw = unit;
  if (raw && typeof raw === 'object') {
    raw = raw.value != null && String(raw.value).trim() !== ''
      ? raw.value
      : raw.key;
  }
  const u = String(raw || '').trim().toLowerCase();
  if (!u) return null;
  if (u === '1' || /ημέρ|ημερ|day/i.test(u)) return 'days';
  if (u === '2' || /εβδομ|week/i.test(u)) return 'weeks';
  if (u === '3' || /μήν|μην|month/i.test(u)) return 'months';
  if (u === '4' || /έτ|ετ|year/i.test(u)) return 'years';
  return null;
}

function addDurationToIso(isoStart, amount, unit) {
  const n = Number(amount);
  const start = parseIsoDate(isoStart);
  if (!start || Number.isNaN(n) || n <= 0) return null;
  const kind = resolveDurationUnitKind(unit);
  if (!kind) return null;
  const d = new Date(start);
  if (kind === 'months') d.setMonth(d.getMonth() + n);
  else if (kind === 'years') d.setFullYear(d.getFullYear() + n);
  else if (kind === 'weeks') d.setDate(d.getDate() + Math.round(n * 7));
  else d.setDate(d.getDate() + Math.round(n));
  return d.toISOString();
}

function urgencyFromDaysLeft(daysLeft) {
  if (daysLeft == null) return 'normal';
  if (daysLeft < 0) return 'past';
  if (daysLeft <= 7) return 'urgent';
  if (daysLeft <= 30) return 'soon';
  return 'normal';
}

export function isActiveProcurementProject(project) {
  if (!project) return false;
  if (project.projectStatus !== PROJECT_STATUS_CONTRACT_PROCESS) return false;
  if (projectProcurementPhaseConcluded(project)) return false;
  if (!projectHasKhmdhsNoticeData(project)) return false;
  const snap = pickKhmdhsNoticeSnapshot(project.khmdhsNoticeSnapshot);
  return !!(snap && !snap.cancelled);
}

export function filterProjectsForCalendar(projects, { userRole, currentUser, engineerCatalog = [] } = {}) {
  const list = projects || [];
  if (userRole !== 'ENGINEER') return list;

  const assigned = Array.isArray(currentUser?.assignedSupervisors)
    ? currentUser.assignedSupervisors.map((s) => String(s || '').trim()).filter(Boolean)
    : [];
  const ctx = buildEngineerVisibilityContext(currentUser, assigned);
  return list.filter((p) => projectVisibleToAssignedEngineer(p, ctx, engineerCatalog));
}

function pushEvent(events, seen, payload) {
  const dateIso = payload.dateIso;
  if (!dateIso) return;
  let dedupeKey;
  if (payload.type === CALENDAR_EVENT_TYPES.CUSTOM) {
    dedupeKey = `${payload.type}|${payload.customEventId}|${toDateKey(dateIso)}`;
  } else if (payload.type === CALENDAR_EVENT_TYPES.AEPO_RENEWAL) {
    dedupeKey = `${payload.type}|${payload.orimanthiProposalId}|${toDateKey(dateIso)}`;
  } else if (payload.type === CALENDAR_EVENT_TYPES.CONTRACT_END) {
    const contractPart = payload.adam
      || (payload.contractIndex != null ? `i${payload.contractIndex}` : '');
    dedupeKey = `${payload.type}|${payload.subprojectId}|${contractPart}|${toDateKey(dateIso)}`;
  } else {
    dedupeKey = `${payload.type}|${payload.subprojectId}|${toDateKey(dateIso)}`;
  }
  if (seen.has(dedupeKey)) return;
  seen.add(dedupeKey);
  const daysLeft = daysUntilDate(dateIso);
  events.push({
    ...payload,
    dateKey: toDateKey(dateIso),
    daysLeft,
    urgency: urgencyFromDaysLeft(daysLeft)
  });
}

/** Ημερομηνία λήξης σύμβασης — project + chain ΚΗΜΔΗΣ + snapshot */
function collectLastExtensionEndIso(chainHistory, review) {
  let last = '';
  (chainHistory || []).forEach((h) => {
    if (h?.isRoot) return;
    const kind = getEffectiveChainKind(h, review);
    if (kind !== CHAIN_KIND.EXTENSION) return;
    const end = toIsoDateOnly(getChainKindChoice(review, h.adam)?.endDate || h.endDate);
    if (end && (!last || end > last)) last = end;
  });
  return last;
}

function collectExtensionEndDatesFromSupplementary(project, review) {
  const contracts = Array.isArray(project?.supplementaryContracts)
    ? project.supplementaryContracts
    : [];
  const dates = [];
  contracts.forEach((row) => {
    const adam = String(row?.khmdhsAdam || '').trim().toUpperCase();
    const choice = adam ? getChainKindChoice(review, adam) : null;
    const isExtension = choice?.kind === CHAIN_KIND.EXTENSION
      || String(row?.comments || '').trim() === 'Παράταση';
    if (!isExtension) return;
    const d = toIsoDateOnly(row?.date || choice?.endDate || '');
    if (d) dates.push(d);
  });
  return dates;
}

/** Όλες οι ημερομηνίες λήξης από παρατάσεις — όλες οι αλυσίδες + συμπληρωματικά + κατανομή SYMV */
function collectAllExtensionEndIsos(project, contract = null) {
  if (!project) return [];
  const review = project.khmdhsDataQualityReview || null;
  const dates = [];

  const historyBundles = contract
    ? [{ history: contract.khmdhsContractChainHistory || [] }]
    : getAllChainHistories(project).map(({ history }) => ({ history }));

  historyBundles.forEach(({ history }) => {
    (history || []).forEach((h) => {
      if (h?.isRoot) return;
      if (getEffectiveChainKind(h, review) !== CHAIN_KIND.EXTENSION) return;
      const adam = String(h?.adam || '').trim().toUpperCase();
      const choice = adam ? getChainKindChoice(review, adam) : null;
      const d = toIsoDateOnly(choice?.endDate || h?.endDate || '');
      if (d) dates.push(d);
    });
  });

  dates.push(...collectExtensionEndDatesFromSupplementary(project, review));

  (project?.khmdhsSymvChainPlan?.items || []).forEach((item) => {
    if (item?.role !== SYMV_CHAIN_ROLE.EXTENSION) return;
    const d = toIsoDateOnly(item?.date || '');
    if (d) dates.push(d);
  });

  getKhmdhsSupplementaryStageEntries(project)
    .filter((e) => e.isExtension || e.label === 'Παράταση')
    .forEach((e) => {
      const adam = String(e.adam || '').trim().toUpperCase();
      const choice = adam ? getChainKindChoice(review, adam) : null;
      const d = toIsoDateOnly(choice?.endDate || e.date || '');
      if (d) dates.push(d);
    });

  const manualExtensions = contract
    ? (contract.contractExtensions || [])
    : (project.contractExtensions || []);
  manualExtensions.forEach((e) => {
    const d = toIsoDateOnly(e?.newEndDate || '');
    if (d) dates.push(d);
  });

  return [...new Set(dates)];
}

function pickLatestIsoDate(...values) {
  const normalized = values.map((v) => toIsoDateOnly(v)).filter(Boolean);
  if (!normalized.length) return null;
  return normalized.sort().reverse()[0];
}

export function resolveContractEndDateIso(project, contract = null) {
  if (!project) return null;
  const review = project.khmdhsDataQualityReview || null;
  const chainHistory = contract
    ? (contract.khmdhsContractChainHistory || [])
    : (project.khmdhsContractChainHistory || []);
  const effects = chainHistory.length
    ? computeChainCharacterizationEffects(chainHistory, review)
    : null;
  const snap = contract?.khmdhsContractSnapshot || project.khmdhsContractSnapshot;
  const fromSnap = snap?.noEndDate ? '' : (snap?.endDate || '');
  const allExtensionEnds = collectAllExtensionEndIsos(project, contract);

  const storedEnd = contract
    ? toIsoDateOnly(contract.contractEndDate)
    : toIsoDateOnly(project.contractEndDate);

  if (allExtensionEnds.length > 0) {
    return pickLatestIsoDate(
      storedEnd,
      effects?.contractDeadline,
      fromSnap,
      ...allExtensionEnds,
    );
  }

  const lastExtensionEnd = collectLastExtensionEndIso(chainHistory, review);

  if (contract) {
    return storedEnd
      || toIsoDateOnly(fromSnap)
      || toIsoDateOnly(effects?.contractDeadline)
      || lastExtensionEnd
      || null;
  }
  return storedEnd
    || toIsoDateOnly(effects?.contractDeadline)
    || toIsoDateOnly(fromSnap)
    || lastExtensionEnd
    || null;
}

function buildNoticeDeadlineEvents(project, snap, events, seen) {
  const base = {
    subprojectId: project.subprojectId,
    projectId: project.projectId,
    subprojectTitle: project.subprojectTitle || snap.title || '(Χωρίς τίτλο)',
    projectTitle: project.projectTitle || '',
    adam: snap.referenceNumber || project.khmdhsNoticeAdam || ''
  };

  if (snap.finalSubmissionDate) {
    pushEvent(events, seen, {
      ...base,
      type: CALENDAR_EVENT_TYPES.DEADLINE,
      priority: 'high',
      label: CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.DEADLINE],
      dateIso: String(snap.finalSubmissionDate)
    });

    if (snap.offersValidTime != null && snap.offersValidTime !== '') {
      const expiryIso = addDurationToIso(
        snap.finalSubmissionDate,
        snap.offersValidTime,
        snap.offersValidTimeUnit
      );
      const expiryKey = toDateKey(expiryIso);
      const deadlineKey = toDateKey(snap.finalSubmissionDate);
      if (expiryIso && expiryKey && expiryKey !== deadlineKey) {
        pushEvent(events, seen, {
          ...base,
          type: CALENDAR_EVENT_TYPES.OFFERS_EXPIRY,
          priority: 'medium',
          label: CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.OFFERS_EXPIRY],
          dateIso: expiryIso
        });
      }
    }
  }
}

function buildProjectEvents(project) {
  if (!isActiveProcurementProject(project)) return [];
  const snap = pickKhmdhsNoticeSnapshot(project.khmdhsNoticeSnapshot);
  if (!snap) return [];

  const events = [];
  const seen = new Set();
  buildNoticeDeadlineEvents(project, snap, events, seen);
  return events;
}

function buildContractEndEvents(project) {
  if (!project?.subprojectId || isAbandonedSubproject(project)) return [];
  if (getTotalContractAmount(project) <= 0) return [];

  const events = [];
  const seen = new Set();
  const review = project.khmdhsDataQualityReview || null;

  const pushContractEnd = (endIso, { contractLabel = '', contractAdam = '', contractIndex = null } = {}) => {
    if (!endIso) return;
    const snap = project.khmdhsContractSnapshot;
    const titleSuffix = contractLabel ? ` (${contractLabel})` : '';
    pushEvent(events, seen, {
      type: CALENDAR_EVENT_TYPES.CONTRACT_END,
      priority: 'medium',
      label: CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.CONTRACT_END],
      dateIso: endIso,
      contractIndex,
      subprojectId: project.subprojectId,
      projectId: project.projectId,
      subprojectTitle: `${project.subprojectTitle || '(Χωρίς τίτλο)'}${titleSuffix}`,
      projectTitle: project.projectTitle || '',
      adam: contractAdam || snap?.referenceNumber || project.khmdhsAdam || project.khmdhsNoticeAdam || ''
    });
  };

  if (isMultipleContractsForm(project.implementationForm)) {
    const contracts = normalizeContractsFromProject(project);
    contracts.forEach((contract, index) => {
      const endIso = resolveContractEndDateIso(project, contract);
      if (!endIso) return;
      const chainHistory = contract.khmdhsContractChainHistory || [];
      const effects = chainHistory.length
        ? computeChainCharacterizationEffects(chainHistory, review)
        : null;
      const hasExtension = (effects?.perAct || []).some((a) => a.effect === 'deadline');
      const label = hasExtension
        ? `Σύμβαση ${index + 1} — λήξη μετά από παράταση`
        : `Σύμβαση ${index + 1}`;
      pushContractEnd(endIso, {
        contractLabel: label,
        contractAdam: contract.khmdhsAdam || '',
        contractIndex: index,
      });
    });
    return events;
  }

  const endIso = resolveContractEndDateIso(project);
  const chainHistory = project.khmdhsContractChainHistory || [];
  const effects = chainHistory.length
    ? computeChainCharacterizationEffects(chainHistory, review)
    : null;
  const hasExtension = (effects?.perAct || []).some((a) => a.effect === 'deadline');
  pushContractEnd(endIso, {
    contractLabel: hasExtension ? 'λήξη μετά από παράταση' : '',
    contractAdam: project.khmdhsAdam || ''
  });
  return events;
}

function buildComplianceEvents(projects, visibleSubprojectIds) {
  const violations = findDirectAssignmentViolations(projects);
  const events = [];
  const seen = new Set();

  violations.forEach((v) => {
    const later = v.laterEvent;
    if (!later?.subprojectId || !visibleSubprojectIds.has(later.subprojectId)) return;
    const displayDate = v.allowedFromDate || later.contractDate;
    if (!displayDate) return;

    pushEvent(events, seen, {
      type: CALENDAR_EVENT_TYPES.COMPLIANCE_12M,
      priority: 'high',
      label: CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.COMPLIANCE_12M],
      dateIso: String(displayDate),
      subprojectId: later.subprojectId,
      projectId: later.projectId,
      subprojectTitle: later.subprojectTitle || '(Χωρίς τίτλο)',
      projectTitle: later.projectTitle || '',
      adam: later.adam || '',
      complianceSummary: formatViolationSummary(v)
    });
  });

  return events;
}

/**
 * @param {object[]} projects
 * @param {{ userRole?: string, currentUser?: object, engineerCatalog?: object[] }} options
 */
export function buildProcurementCalendarEvents(projects, options = {}) {
  const scoped = filterProjectsForCalendar(projects, options);
  const visibleIds = new Set(scoped.map((p) => p.subprojectId).filter(Boolean));

  const events = [];
  scoped.forEach((p) => {
    events.push(...buildProjectEvents(p));
    events.push(...buildContractEndEvents(p));
  });
  events.push(...buildComplianceEvents(scoped, visibleIds));

  events.sort(
    (a, b) => {
      const da = parseIsoDate(a.dateIso)?.getTime() ?? 0;
      const db = parseIsoDate(b.dateIso)?.getTime() ?? 0;
      return da - db
        || (a.subprojectTitle || '').localeCompare(b.subprojectTitle || '', 'el', { sensitivity: 'base' });
    }
  );

  return events;
}

export function filterCalendarEventsByType(events, filterKey) {
  if (!filterKey || filterKey === 'all') {
    return events.filter((e) => ALL_CALENDAR_EVENT_TYPES.includes(e.type));
  }
  if (filterKey === 'deadlines') {
    return events.filter((e) => PROCUREMENT_DEADLINE_EVENT_TYPES.includes(e.type));
  }
  if (filterKey === 'contracts') {
    return events.filter((e) => e.type === CALENDAR_EVENT_TYPES.CONTRACT_END);
  }
  if (filterKey === 'compliance') {
    return events.filter((e) => e.type === CALENDAR_EVENT_TYPES.COMPLIANCE_12M);
  }
  if (filterKey === 'custom') {
    return events.filter((e) => e.type === CALENDAR_EVENT_TYPES.CUSTOM);
  }
  if (filterKey === 'aepo') {
    return events.filter((e) => e.type === CALENDAR_EVENT_TYPES.AEPO_RENEWAL);
  }
  if (filterKey === 'proskliseis') {
    return events.filter((e) => e.type === CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE);
  }
  return events;
}

/** Μία εγγραφή ανά υποέργο ανά ημέρα — η πιο σημαντική προθεσμία */
const EVENT_TYPE_RANK = {
  [CALENDAR_EVENT_TYPES.COMPLIANCE_12M]: 0,
  [CALENDAR_EVENT_TYPES.CUSTOM]: 1,
  [CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE]: 2,
  [CALENDAR_EVENT_TYPES.DEADLINE]: 3,
  [CALENDAR_EVENT_TYPES.OFFERS_EXPIRY]: 4,
  [CALENDAR_EVENT_TYPES.CONTRACT_END]: 5,
  [CALENDAR_EVENT_TYPES.AEPO_RENEWAL]: 6,
};

export function dedupeEventsForMonthDay(events) {
  const byBucket = new Map();

  events.forEach((ev) => {
    let bucketKey;
    if (ev.type === CALENDAR_EVENT_TYPES.CUSTOM) {
      bucketKey = `custom|${ev.customEventId}|${ev.dateKey}`;
    } else if (ev.type === CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE || ev.prosklisiId) {
      bucketKey = `prosklisi|${ev.prosklisiId}|${ev.dateKey}`;
    } else if (ev.type === CALENDAR_EVENT_TYPES.AEPO_RENEWAL || ev.orimanthiProposalId) {
      bucketKey = `aepo|${ev.orimanthiProposalId}|${ev.dateKey}`;
    } else {
      bucketKey = `${ev.subprojectId}|${ev.dateKey}`;
    }
    const existing = byBucket.get(bucketKey);
    if (!existing) {
      byBucket.set(bucketKey, ev);
      return;
    }
    const rankA = EVENT_TYPE_RANK[ev.type] ?? 99;
    const rankB = EVENT_TYPE_RANK[existing.type] ?? 99;
    if (rankA < rankB) byBucket.set(bucketKey, ev);
  });

  return Array.from(byBucket.values());
}

export function eventsInMonth(events, year, monthIndex) {
  return events.filter((e) => {
    const d = parseIsoDate(e.dateIso);
    if (!d) return false;
    return d.getFullYear() === year && d.getMonth() === monthIndex;
  });
}

const PAST_DEADLINE_EVENT_TYPES = [
  CALENDAR_EVENT_TYPES.DEADLINE,
  CALENDAR_EVENT_TYPES.OFFERS_EXPIRY,
  CALENDAR_EVENT_TYPES.CONTRACT_END,
  CALENDAR_EVENT_TYPES.CUSTOM,
  CALENDAR_EVENT_TYPES.AEPO_RENEWAL,
  CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE,
];

export function eventsWithinDays(events, maxDays, { includePastDeadlines = true } = {}) {
  return events.filter((e) => {
    if (e.type === CALENDAR_EVENT_TYPES.COMPLIANCE_12M) return true;
    if (e.daysLeft == null) return false;
    if (e.daysLeft >= 0 && e.daysLeft <= maxDays) return true;
    if (includePastDeadlines && e.daysLeft < 0 && PAST_DEADLINE_EVENT_TYPES.includes(e.type)) {
      return Math.abs(e.daysLeft) <= maxDays;
    }
    return false;
  });
}

export function formatEventDateTime(iso) {
  return isDateOnlyCalendarIso(iso) ? formatDateEl(iso) : formatDateTimeEl(iso);
}

export function formatDaysLeftLabel(daysLeft) {
  if (daysLeft == null) return '';
  if (daysLeft < 0) {
    const n = Math.abs(daysLeft);
    return n === 1 ? 'Έληξε χθες' : `Έληξε πριν ${n} ημέρες`;
  }
  if (daysLeft === 0) return 'Σήμερα';
  if (daysLeft === 1) return 'Αύριο';
  return `Σε ${daysLeft} ημέρες`;
}

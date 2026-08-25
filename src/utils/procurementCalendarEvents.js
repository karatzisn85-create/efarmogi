/** Events για Ημερολόγιο Προθεσμιών (Φάση 3α) */

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
import calendarDeadlines from '../../app/core/calendarDeadlines';
import { formatDateEl, formatDateTimeEl, toIsoDateOnly } from './dateFormat';
import { getAllChainHistories } from './khmdhsChainFormAccess';
import { getKhmdhsSupplementaryStageEntries } from './khmdhsSupplementaryStageEntries';
import { SYMV_CHAIN_ROLE } from './khmdhsSymvChainPlanner';
import {
  daysUntilDate,
  projectProcurementPhaseConcluded
} from './procurementDeadlines';

export const CALENDAR_EVENT_TYPES = calendarDeadlines.CALENDAR_EVENT_TYPES;
export const CALENDAR_EVENT_LABELS = calendarDeadlines.CALENDAR_EVENT_LABELS;
export const PROCUREMENT_DEADLINE_EVENT_TYPES = calendarDeadlines.PROCUREMENT_DEADLINE_EVENT_TYPES;
export const ALL_CALENDAR_EVENT_TYPES = calendarDeadlines.ALL_CALENDAR_EVENT_TYPES;
export const toDateKey = calendarDeadlines.toDateKey;
export const isDateOnlyCalendarIso = calendarDeadlines.isDateOnlyCalendarIso;
export const calendarEventRowKey = calendarDeadlines.calendarEventRowKey;
export const isContractorCalendarEvent = calendarDeadlines.isContractorCalendarEvent;
export const filterProjectsForCalendar = calendarDeadlines.filterProjectsForCalendar;
export const filterCalendarEventsByType = calendarDeadlines.filterCalendarEventsByType;
export const eventsInMonth = calendarDeadlines.eventsInMonth;
export const eventsWithinDays = calendarDeadlines.eventsWithinDays;

function parseIsoDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function urgencyFromDaysLeft(daysLeft) {
  if (daysLeft == null) return 'normal';
  if (daysLeft < 0) return 'past';
  if (daysLeft <= 7) return 'urgent';
  if (daysLeft <= 30) return 'soon';
  return 'normal';
}

export const addDurationToIso = calendarDeadlines.addDurationToIso;
export const resolveDurationUnitKind = calendarDeadlines.resolveDurationUnitKind;

export function isActiveProcurementProject(project) {
  return calendarDeadlines.isActiveProcurementProject(project, {
    phaseConcluded: projectProcurementPhaseConcluded(project),
  });
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

function buildProjectEvents(project) {
  return calendarDeadlines.buildNoticeDeadlineCalendarEvents(project, {
    phaseConcluded: projectProcurementPhaseConcluded(project),
  });
}

function buildContractEndEvents(project) {
  if (!calendarDeadlines.shouldShowContractEndEvent(project, {
    hasPositiveAmount: getTotalContractAmount(project) > 0,
  })) return [];

  const events = [];
  const seen = new Set();
  const review = project.khmdhsDataQualityReview || null;

  const pushContractEnd = (endIso, { contractLabel = '', contractAdam = '', contractIndex = null } = {}) => {
    const row = calendarDeadlines.mapContractEndToCalendarRow(project, endIso, {
      contractLabel,
      contractAdam,
      contractIndex,
    });
    if (!row) return;
    pushEvent(events, seen, row);
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
    } else if (ev.type === CALENDAR_EVENT_TYPES.CONTRACTOR_REGISTRY || ev.isContractorRegistry) {
      bucketKey = `contractor|${ev.guaranteeId || ev.acceptanceId || ev.contractorRowKey}|${ev.dateKey}`;
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

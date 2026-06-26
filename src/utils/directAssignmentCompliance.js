import { isAbandonedSubproject, normalizeProjectType } from '../data/formOptions';
import { getKhmdhsDisplayEntries, parseGreekAmountString } from './khmdhsFields';
import { getProjectAssignmentProcedure } from './khmdhsNoticeFields';
import { formatDateEl } from './dateFormat';

export const DIRECT_ASSIGNMENT_PROCEDURE = 'ΑΠΕΥΘΕΙΑΣ ΑΝΑΘΕΣΗ';
export const DIRECT_ASSIGNMENT_COOLING_MONTHS = 12;

const RESTRICTED_PROJECT_TYPES = new Set(['ΕΡΓΟ', 'ΜΕΛΕΤΗ']);

export function formatComplianceDate(dateStr) {
  return formatDateEl(dateStr, '—');
}

/** Έργο ή μελέτη με διαδικασία απευθείας ανάθεσης */
export function isDirectAssignmentRestrictedProject(project) {
  if (!project) return false;
  const type = normalizeProjectType(project.projectType);
  if (!RESTRICTED_PROJECT_TYPES.has(type)) return false;
  const proc = getProjectAssignmentProcedure(project);
  return proc === DIRECT_ASSIGNMENT_PROCEDURE;
}

function contractorKeyFromSnapshot(snapshot) {
  const vatDigits = snapshot?.anadoxosVat != null
    ? String(snapshot.anadoxosVat).replace(/\D/g, '')
    : '';
  if (vatDigits) return `vat:${vatDigits}`;
  const name = snapshot?.anadoxosName?.trim();
  return name ? `name:${name.toUpperCase()}` : null;
}

function getContractDateForEntry(project, entry) {
  if (!project || !entry) return '';
  if (entry.contractIndex != null && Array.isArray(project.contracts)) {
    return project.contracts[entry.contractIndex - 1]?.date || '';
  }
  return project.contractDate || '';
}

function getContractAmountForEntry(project, entry) {
  if (!project || !entry) return 0;
  if (entry.contractIndex != null && Array.isArray(project.contracts)) {
    return parseGreekAmountString(project.contracts[entry.contractIndex - 1]?.amount);
  }
  return parseGreekAmountString(project.contractAmount);
}

function parseContractDateMs(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

/** true αν η later σύμβαση υπέρβησε το διάστημα αναμονής 12 μηνών */
export function isWithinDirectAssignmentCoolingPeriod(earlierDateMs, laterDateMs) {
  if (earlierDateMs == null || laterDateMs == null) return false;
  const earliestAllowed = addMonths(new Date(earlierDateMs), DIRECT_ASSIGNMENT_COOLING_MONTHS);
  return laterDateMs < earliestAllowed.getTime();
}

export function getMonthsBetweenContractDates(earlierDateMs, laterDateMs) {
  const a = new Date(earlierDateMs);
  const b = new Date(laterDateMs);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return Math.max(0, months);
}

export function getCoolingPeriodEndDate(earlierDateStr) {
  const ms = parseContractDateMs(earlierDateStr);
  if (ms == null) return null;
  return addMonths(new Date(ms), DIRECT_ASSIGNMENT_COOLING_MONTHS).toISOString().slice(0, 10);
}

/**
 * Εξαγωγή συμβάσεων απευθείας ανάθεσης (έργο/μελέτη) με ανάδοχο και ημερομηνία.
 */
export function extractDirectAssignmentEvents(projects, { excludeSubprojectId } = {}) {
  const events = [];

  (projects || []).forEach((project) => {
    if (excludeSubprojectId && project.subprojectId === excludeSubprojectId) return;
    if (isAbandonedSubproject(project)) return;
    if (!isDirectAssignmentRestrictedProject(project)) return;

    getKhmdhsDisplayEntries(project).forEach((entry) => {
      if (!entry.snapshot?.anadoxosName) return;
      const contractDate = getContractDateForEntry(project, entry);
      const contractDateMs = parseContractDateMs(contractDate);
      if (contractDateMs == null) return;

      const contractorKey = contractorKeyFromSnapshot(entry.snapshot);
      if (!contractorKey) return;

      events.push({
        contractorKey,
        contractorName: String(entry.snapshot.anadoxosName).trim(),
        contractorVat: entry.snapshot.anadoxosVat != null ? String(entry.snapshot.anadoxosVat).trim() : '',
        subprojectId: project.subprojectId,
        projectId: project.projectId,
        projectTitle: project.projectTitle || '',
        subprojectTitle: project.subprojectTitle || '',
        projectType: normalizeProjectType(project.projectType),
        contractDate,
        contractDateMs,
        amount: getContractAmountForEntry(project, entry),
        contractIndex: entry.contractIndex,
        adam: entry.adam || ''
      });
    });
  });

  return events;
}

function buildViolation(earlier, later) {
  const monthsBetween = getMonthsBetweenContractDates(earlier.contractDateMs, later.contractDateMs);
  const allowedFrom = getCoolingPeriodEndDate(earlier.contractDate);
  return {
    contractorKey: earlier.contractorKey,
    contractorName: earlier.contractorName,
    contractorVat: earlier.contractorVat,
    earlierEvent: earlier,
    laterEvent: later,
    monthsBetween,
    monthsShortfall: Math.max(0, DIRECT_ASSIGNMENT_COOLING_MONTHS - monthsBetween),
    allowedFromDate: allowedFrom
  };
}

function pairKey(a, b) {
  return [
    a.subprojectId,
    a.contractIndex ?? 0,
    b.subprojectId,
    b.contractIndex ?? 0
  ].join('|');
}

/**
 * Εντοπίζει ζεύγη συμβάσεων ίδιου αναδόχου εντός 12 μηνών.
 */
export function findDirectAssignmentViolations(projects, options = {}) {
  const { excludeSubprojectId } = options;
  const events = extractDirectAssignmentEvents(projects, { excludeSubprojectId });
  const byContractor = {};

  events.forEach((event) => {
    if (!byContractor[event.contractorKey]) byContractor[event.contractorKey] = [];
    byContractor[event.contractorKey].push(event);
  });

  const violations = [];
  const seen = new Set();

  Object.values(byContractor).forEach((contractorEvents) => {
    const sorted = [...contractorEvents].sort((a, b) => a.contractDateMs - b.contractDateMs);
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const earlier = sorted[i];
        const later = sorted[j];
        if (!isWithinDirectAssignmentCoolingPeriod(earlier.contractDateMs, later.contractDateMs)) {
          continue;
        }
        const key = pairKey(earlier, later);
        if (seen.has(key)) continue;
        seen.add(key);
        violations.push(buildViolation(earlier, later));
      }
    }
  });

  return violations.sort((a, b) => b.laterEvent.contractDateMs - a.laterEvent.contractDateMs);
}

/** Έλεγχος ενός υποέργου (π.χ. φόρμα) έναντι των υπολοίπων */
export function checkProjectDirectAssignmentCompliance(project, allProjects) {
  if (!isDirectAssignmentRestrictedProject(project)) {
    return { applicable: false, violations: [], missingData: false };
  }

  const draftEvents = extractDirectAssignmentEvents([project]);
  if (draftEvents.length === 0) {
    return {
      applicable: true,
      violations: [],
      missingData: true,
      message: 'Για έλεγχο 12μήνου απαιτούνται ανάδοχος (ΚΗΜΔΗΣ) και ημερομηνία σύμβασης.'
    };
  }

  const excludeId = project.subprojectId || null;
  const otherEvents = extractDirectAssignmentEvents(allProjects, { excludeSubprojectId: excludeId });
  const violations = [];
  const seen = new Set();

  draftEvents.forEach((draft) => {
    otherEvents
      .filter((other) => other.contractorKey === draft.contractorKey)
      .forEach((other) => {
        const earlier = draft.contractDateMs <= other.contractDateMs ? draft : other;
        const later = draft.contractDateMs > other.contractDateMs ? draft : other;
        if (!isWithinDirectAssignmentCoolingPeriod(earlier.contractDateMs, later.contractDateMs)) return;
        const key = pairKey(earlier, later);
        if (seen.has(key)) return;
        seen.add(key);
        violations.push(buildViolation(earlier, later));
      });
  });

  return { applicable: true, violations, missingData: false };
}

export function getViolationSubprojectIds(violations) {
  const ids = new Set();
  (violations || []).forEach((v) => {
    ids.add(v.earlierEvent.subprojectId);
    ids.add(v.laterEvent.subprojectId);
  });
  return ids;
}

export function getViolationsForSubproject(violations, subprojectId) {
  if (!subprojectId) return [];
  return (violations || []).filter(
    (v) => v.earlierEvent.subprojectId === subprojectId || v.laterEvent.subprojectId === subprojectId
  );
}

export function formatViolationSummary(violation) {
  const { contractorName, earlierEvent, laterEvent, monthsBetween, allowedFromDate } = violation;
  return `Ο ανάδοχος «${contractorName}» έχει δύο συμβάσεις απευθείας ανάθεσης (έργο/μελέτη) με διαφορά ${monthsBetween} μηνών (${formatComplianceDate(earlierEvent.contractDate)} → ${formatComplianceDate(laterEvent.contractDate)}). Απαιτούνται 12 μήνες — επιτρέπεται νέα σύμβαση από ${formatComplianceDate(allowedFromDate)}.`;
}

/**
 * Κατασκευή εγγραφών προθεσμιών για email υπενθυμίσεις — ευθυγραμμισμένο με το ημερολόγιο.
 */
const { pickKhmdhsNoticeSnapshot, STATUSES_WITH_KHMDHS_ADAM } = require('./khmdhsOpenData');
const { daysUntilKhmdhsDate } = require('./khmdhsDateUtils');
const { projectVisibleToEngineerContext } = require('./chargeFilterUtils');
const { computeChainCharacterizationEffects } = require('./khmdhsChainCharacterizationEffects');
const { resolveContractEndDateIso } = require('./khmdhsContractEndDateResolver');
const calendarCustomEventsService = require('./calendarCustomEventsService');
const calendarDeadlinesCore = require('../app/core/calendarDeadlines');

const PROJECT_STATUS_ABANDONED = 'ΑΠΕΝΤΑΓΜΕΝΟ';
const MULTIPLE_CONTRACTS_FORM = 'Πολλές Συμβάσεις';
const DIRECT_ASSIGNMENT_PROCEDURE = 'ΑΠΕΥΘΕΙΑΣ ΑΝΑΘΕΣΗ';
const DIRECT_ASSIGNMENT_COOLING_MONTHS = 12;

const EVENT_TYPES = {
  DEADLINE: 'deadline',
  OFFERS_EXPIRY: 'offers_expiry',
  CONTRACT_END: 'contract_end',
  COMPLIANCE_12M: 'compliance_12m',
  CUSTOM: 'custom',
  PROSKLISI_DEADLINE: 'prosklisi_deadline',
  CONTRACTOR_REGISTRY: 'contractor_registry',
};

const EVENT_LABELS = {
  [EVENT_TYPES.DEADLINE]: 'Καταληκτική υποβολής προσφορών',
  [EVENT_TYPES.OFFERS_EXPIRY]: 'Λήξη ισχύος προσφορών',
  [EVENT_TYPES.CONTRACT_END]: 'Λήξη σύμβασης',
  [EVENT_TYPES.COMPLIANCE_12M]: 'Παράβαση κανόνα 12 μηνών',
  [EVENT_TYPES.CUSTOM]: 'Ειδοποίηση ημερολογίου',
  [EVENT_TYPES.PROSKLISI_DEADLINE]: 'Λήξη υποβολής πρόσκλησης',
  [EVENT_TYPES.CONTRACTOR_REGISTRY]: 'Λήξη εγγυητικής ή χρόνου εγγύησης',
};

function parseProsklisiDeadlineToIso(dateString) {
  if (!dateString || dateString === '-') return '';
  const raw = String(dateString).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(raw)) {
    const sep = raw.includes('/') ? '/' : '-';
    const [dd, mm, yyyy] = raw.split(sep);
    return `${yyyy}-${mm}-${dd}`;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseGreekAmount(val) {
  if (!val) return 0;
  const cleaned = String(val).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function isAbandoned(project) {
  return project?.projectStatus === PROJECT_STATUS_ABANDONED;
}

function isMultipleContractsForm(form) {
  return form === MULTIPLE_CONTRACTS_FORM;
}

function normalizeContractRow(contract) {
  const c = contract && typeof contract === 'object' ? contract : {};
  return {
    date: c.date != null ? String(c.date) : '',
    amount: c.amount != null ? String(c.amount) : '',
    contractEndDate: c.contractEndDate != null ? String(c.contractEndDate).slice(0, 10) : '',
    khmdhsAdam: c.khmdhsAdam != null ? String(c.khmdhsAdam) : '',
    khmdhsContractSnapshot: c.khmdhsContractSnapshot || null,
    khmdhsContractChainHistory: Array.isArray(c.khmdhsContractChainHistory) ? c.khmdhsContractChainHistory : [],
  };
}

function normalizeContractsFromProject(project) {
  if (!project) return [];
  let contracts = Array.isArray(project.contracts)
    ? project.contracts.map(normalizeContractRow)
    : [];
  if (isMultipleContractsForm(project.implementationForm) && project.khmdhsAdam && contracts.length > 0) {
    const topAdam = String(project.khmdhsAdam || '').trim();
    if (topAdam && !String(contracts[0].khmdhsAdam || '').trim()) {
      contracts = contracts.map((c, i) => (i === 0
        ? {
          ...c,
          khmdhsAdam: topAdam,
          khmdhsContractSnapshot: project.khmdhsContractSnapshot || c.khmdhsContractSnapshot,
        }
        : c));
    }
  }
  return contracts;
}

function getTotalContractAmount(project) {
  if (!project) return 0;
  let total = 0;
  if (isMultipleContractsForm(project.implementationForm)) {
    (project.contracts || []).forEach((c) => { total += parseGreekAmount(c?.amount); });
  } else {
    total += parseGreekAmount(project.contractAmount);
  }
  (project.supplementaryContracts || []).forEach((c) => { total += parseGreekAmount(c?.amount); });
  return total;
}

function projectProcurementPhaseConcluded(project) {
  if (!project) return false;
  if (STATUSES_WITH_KHMDHS_ADAM.includes(project.projectStatus)) return true;
  if (getTotalContractAmount(project) <= 0) return false;
  if (project.contractDate) return true;
  if (Array.isArray(project.contracts) && project.contracts.some((c) => c?.date)) return true;
  return false;
}

function isActiveProcurementProject(project) {
  return calendarDeadlinesCore.isActiveProcurementProject(project, {
    phaseConcluded: projectProcurementPhaseConcluded(project),
  });
}

function toDateKey(isoOrDate) {
  if (!isoOrDate) return '';
  const s = String(isoOrDate);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDurationToIso(isoStart, amount, unit) {
  return calendarDeadlinesCore.addDurationToIso(isoStart, amount, unit);
}

function getKhmdhsDisplayEntries(project) {
  if (!project) return [];
  if (isMultipleContractsForm(project.implementationForm) && Array.isArray(project.contracts)) {
    return project.contracts
      .map((c, i) => ({
        contractIndex: i + 1,
        adam: String(c?.khmdhsAdam || '').trim(),
        snapshot: c?.khmdhsContractSnapshot || null,
      }))
      .filter((e) => e.adam || e.snapshot);
  }
  const adam = String(project.khmdhsAdam || '').trim();
  const snapshot = project.khmdhsContractSnapshot || null;
  if (!adam && !snapshot) return [];
  return [{ contractIndex: null, adam, snapshot }];
}

function normalizeProjectType(type) {
  return String(type || '').trim().toUpperCase();
}

function getProjectAssignmentProcedure(project) {
  if (!project) return '';
  const snap = pickKhmdhsNoticeSnapshot(project.khmdhsNoticeSnapshot);
  if (snap?.typeOfProcedure) return String(snap.typeOfProcedure).trim();
  return String(project.assignmentProcedure || '').trim();
}

function isDirectAssignmentRestrictedProject(project) {
  const type = normalizeProjectType(project?.projectType);
  if (type !== 'ΕΡΓΟ' && type !== 'ΜΕΛΕΤΗ') return false;
  return getProjectAssignmentProcedure(project) === DIRECT_ASSIGNMENT_PROCEDURE;
}

function contractorKeyFromSnapshot(snapshot) {
  const vatDigits = snapshot?.anadoxosVat != null ? String(snapshot.anadoxosVat).replace(/\D/g, '') : '';
  if (vatDigits) return `vat:${vatDigits}`;
  const name = snapshot?.anadoxosName?.trim();
  return name ? `name:${name.toUpperCase()}` : null;
}

function getContractDateForEntry(project, entry) {
  if (entry?.contractIndex != null && Array.isArray(project.contracts)) {
    return project.contracts[entry.contractIndex - 1]?.date || '';
  }
  return project.contractDate || '';
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

function isWithinDirectAssignmentCoolingPeriod(earlierDateMs, laterDateMs) {
  if (earlierDateMs == null || laterDateMs == null) return false;
  const earliestAllowed = addMonths(new Date(earlierDateMs), DIRECT_ASSIGNMENT_COOLING_MONTHS);
  return laterDateMs < earliestAllowed.getTime();
}

function getCoolingPeriodEndDate(earlierDateStr) {
  const ms = parseContractDateMs(earlierDateStr);
  if (ms == null) return null;
  return addMonths(new Date(ms), DIRECT_ASSIGNMENT_COOLING_MONTHS).toISOString().slice(0, 10);
}

function findDirectAssignmentViolations(projects) {
  const events = [];
  (projects || []).forEach((project) => {
    if (isAbandoned(project) || !isDirectAssignmentRestrictedProject(project)) return;
    getKhmdhsDisplayEntries(project).forEach((entry) => {
      if (!entry.snapshot?.anadoxosName) return;
      const contractorKey = contractorKeyFromSnapshot(entry.snapshot);
      if (!contractorKey) return;
      const contractDate = getContractDateForEntry(project, entry);
      const contractDateMs = parseContractDateMs(contractDate);
      if (contractDateMs == null) return;
      events.push({
        contractorKey,
        subprojectId: project.subprojectId,
        projectId: project.projectId,
        subprojectTitle: project.subprojectTitle || '',
        projectTitle: project.projectTitle || '',
        contractDate,
        contractDateMs,
        contractIndex: entry.contractIndex,
        adam: entry.adam || '',
      });
    });
  });

  const violations = [];
  const seen = new Set();
  const byContractor = {};
  events.forEach((ev) => {
    if (!byContractor[ev.contractorKey]) byContractor[ev.contractorKey] = [];
    byContractor[ev.contractorKey].push(ev);
  });

  Object.values(byContractor).forEach((contractorEvents) => {
    const sorted = [...contractorEvents].sort((a, b) => a.contractDateMs - b.contractDateMs);
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const earlier = sorted[i];
        const later = sorted[j];
        if (!isWithinDirectAssignmentCoolingPeriod(earlier.contractDateMs, later.contractDateMs)) continue;
        const key = [earlier.subprojectId, earlier.contractIndex ?? 0, later.subprojectId, later.contractIndex ?? 0].join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        violations.push({
          pairKey: key,
          earlierEvent: earlier,
          laterEvent: later,
          allowedFromDate: getCoolingPeriodEndDate(earlier.contractDate),
        });
      }
    }
  });
  return violations;
}

function makeItem({
  itemKey,
  eventType,
  subprojectId = '',
  customEventId = '',
  prosklisiId = '',
  project = null,
  customEvent = null,
  subprojectTitle,
  projectTitle = '',
  adam = '',
  label,
  deadlineIso,
}) {
  const daysLeft = daysUntilKhmdhsDate(deadlineIso);
  if (daysLeft === null) return null;
  return {
    itemKey,
    eventType,
    subprojectId,
    customEventId,
    prosklisiId,
    project,
    customEvent,
    subprojectTitle: subprojectTitle || '(Χωρίς τίτλο)',
    projectTitle,
    adam,
    label: label || EVENT_LABELS[eventType] || eventType,
    deadlineIso,
    daysLeft,
  };
}

function collectProsklisiItems(proskliseis) {
  const items = [];
  const seen = new Set();
  for (const prosklisi of proskliseis || []) {
    const prosklisiId = prosklisi?.prosklisiId;
    if (!prosklisiId) continue;
    const deadlineIso = parseProsklisiDeadlineToIso(prosklisi.deadline);
    if (!deadlineIso) continue;
    const linked = Array.isArray(prosklisi.linkedProjects)
      ? prosklisi.linkedProjects
        .map((lp) => (typeof lp === 'string' ? lp : (lp?.title || lp?.projectTitle || '')))
        .filter(Boolean)
      : [];
    // itemKey includes date so a changed deadline can re-trigger thresholds
    const itemKey = `${EVENT_TYPES.PROSKLISI_DEADLINE}:${prosklisiId}:${deadlineIso}`;
    if (seen.has(itemKey)) continue;
    seen.add(itemKey);
    const row = makeItem({
      itemKey,
      eventType: EVENT_TYPES.PROSKLISI_DEADLINE,
      prosklisiId,
      subprojectId: '',
      subprojectTitle: prosklisi.title || '(Χωρίς τίτλο)',
      projectTitle: linked[0] || '',
      adam: '',
      label: EVENT_LABELS[EVENT_TYPES.PROSKLISI_DEADLINE],
      deadlineIso,
    });
    if (row) items.push(row);
  }
  return items;
}

function collectProcurementItems(projects) {
  const items = [];
  const seen = new Set();

  const push = (row) => {
    if (!row || seen.has(row.itemKey)) return;
    seen.add(row.itemKey);
    items.push(row);
  };

  for (const project of projects || []) {
    if (isAbandoned(project)) continue;

    if (isActiveProcurementProject(project)) {
      const snap = calendarDeadlinesCore.resolveEffectiveNoticeSnapshot(project);
      const base = {
        project,
        subprojectId: project.subprojectId,
        subprojectTitle: project.subprojectTitle || snap?.title || '(Χωρίς τίτλο)',
        projectTitle: project.projectTitle || '',
        adam: snap?.referenceNumber || project.khmdhsNoticeAdam || '',
      };

      if (snap?.finalSubmissionDate) {
        const deadlineKey = toDateKey(snap.finalSubmissionDate);
        push(makeItem({
          ...base,
          // Ημερομηνία στο κλειδί: αλλαγή προθεσμίας → νέες υπενθυμίσεις (όχι μπλοκ από παλιά)
          itemKey: `${EVENT_TYPES.DEADLINE}:${project.subprojectId}:${deadlineKey || String(snap.finalSubmissionDate).slice(0, 10)}`,
          eventType: EVENT_TYPES.DEADLINE,
          label: EVENT_LABELS[EVENT_TYPES.DEADLINE],
          deadlineIso: String(snap.finalSubmissionDate),
        }));

        if (snap.offersValidTime != null && snap.offersValidTime !== '') {
          const expiryIso = addDurationToIso(
            snap.finalSubmissionDate,
            snap.offersValidTime,
            snap.offersValidTimeUnit
          );
          const expiryKey = toDateKey(expiryIso);
          if (expiryIso && expiryKey && expiryKey !== deadlineKey) {
            push(makeItem({
              ...base,
              itemKey: `${EVENT_TYPES.OFFERS_EXPIRY}:${project.subprojectId}:${expiryKey}`,
              eventType: EVENT_TYPES.OFFERS_EXPIRY,
              label: EVENT_LABELS[EVENT_TYPES.OFFERS_EXPIRY],
              deadlineIso: expiryIso,
            }));
          }
        }
      }
    }

    if (calendarDeadlinesCore.shouldShowContractEndEvent(project, {
      hasPositiveAmount: getTotalContractAmount(project) > 0,
    })) {
      const pushContract = (endIso, { contractAdam = '', contractIndex = null } = {}) => {
        if (!endIso) return;
        const suffix = contractIndex != null ? `:${contractIndex}` : '';
        const adamPart = contractAdam || project.khmdhsAdam || '';
        const endKey = toDateKey(endIso) || String(endIso).slice(0, 10);
        push(makeItem({
          project,
          subprojectId: project.subprojectId,
          subprojectTitle: project.subprojectTitle || '(Χωρίς τίτλο)',
          projectTitle: project.projectTitle || '',
          adam: adamPart || project.khmdhsNoticeAdam || '',
          itemKey: `${EVENT_TYPES.CONTRACT_END}:${project.subprojectId}:${adamPart}${suffix}:${endKey}`,
          eventType: EVENT_TYPES.CONTRACT_END,
          label: EVENT_LABELS[EVENT_TYPES.CONTRACT_END],
          deadlineIso: endIso,
        }));
      };

      if (isMultipleContractsForm(project.implementationForm)) {
        normalizeContractsFromProject(project).forEach((contract, index) => {
          const endIso = resolveContractEndDateIso(project, contract);
          pushContract(endIso, { contractAdam: contract.khmdhsAdam || '', contractIndex: index });
        });
      } else {
        pushContract(resolveContractEndDateIso(project));
      }
    }
  }

  const violations = findDirectAssignmentViolations(projects);
  violations.forEach((v) => {
    const later = v.laterEvent;
    const displayDate = v.allowedFromDate || later.contractDate;
    push(makeItem({
      project: projects.find((p) => p.subprojectId === later.subprojectId) || null,
      subprojectId: later.subprojectId,
      subprojectTitle: later.subprojectTitle || '(Χωρίς τίτλο)',
      projectTitle: later.projectTitle || '',
      adam: later.adam || '',
      itemKey: `${EVENT_TYPES.COMPLIANCE_12M}:${v.pairKey}`,
      eventType: EVENT_TYPES.COMPLIANCE_12M,
      label: EVENT_LABELS[EVENT_TYPES.COMPLIANCE_12M],
      deadlineIso: String(displayDate),
    }));
  });

  return items;
}

function collectCustomItems(dataDir) {
  if (!dataDir) return [];
  const store = calendarCustomEventsService.loadStore(dataDir);
  return (store.events || []).map((ev) => makeItem({
    customEvent: ev,
    customEventId: ev.id,
    subprojectId: '',
    subprojectTitle: ev.title,
    projectTitle: '',
    adam: '',
    itemKey: `${EVENT_TYPES.CUSTOM}:${ev.id}:${toDateKey(ev.dateIso) || String(ev.dateIso || '').slice(0, 10)}`,
    eventType: EVENT_TYPES.CUSTOM,
    label: EVENT_LABELS[EVENT_TYPES.CUSTOM],
    deadlineIso: ev.dateIso,
  })).filter(Boolean);
}

function collectGuaranteeReminderItems(records, projects) {
  const bySubId = new Map();
  (projects || []).forEach((p) => {
    const id = String(p?.subprojectId || '').trim();
    if (id) bySubId.set(id, p);
  });
  const items = [];
  const seen = new Set();
  for (const rec of records || []) {
    for (const g of rec.guarantees || []) {
      if (!g || g.status !== 'ενεργή') continue;
      const deadlineIso = String(g.expiresOn || '').trim();
      if (!deadlineIso) continue;
      const gid = String(g.id || `${rec.id || rec.identityKey || ''}:${g.letterNumber || ''}`).trim();
      const dateKey = toDateKey(deadlineIso) || deadlineIso.slice(0, 10);
      const itemKey = `${EVENT_TYPES.CONTRACTOR_REGISTRY}:${gid}:${dateKey}`;
      if (!gid || seen.has(itemKey)) continue;
      seen.add(itemKey);
      const project = bySubId.get(String(g.subprojectId || '').trim()) || null;
      const typePart = String(g.type || '').trim();
      const row = makeItem({
        itemKey,
        eventType: EVENT_TYPES.CONTRACTOR_REGISTRY,
        project,
        subprojectId: g.subprojectId || '',
        subprojectTitle: rec.name || '(Ανάδοχος)',
        projectTitle: project?.subprojectTitle || project?.projectTitle || '',
        adam: g.letterNumber || '',
        label: typePart
          ? `${EVENT_LABELS[EVENT_TYPES.CONTRACTOR_REGISTRY]} (${typePart})`
          : EVENT_LABELS[EVENT_TYPES.CONTRACTOR_REGISTRY],
        deadlineIso,
      });
      if (row) items.push(row);
    }
    for (const acc of rec.acceptances || []) {
      if (!acc) continue;
      const deadlineIso = String(acc.warrantyEndsOn || '').trim();
      if (!deadlineIso) continue;
      const aid = String(acc.id || `${rec.id || rec.identityKey || ''}:${acc.subprojectId || ''}`).trim();
      const dateKey = toDateKey(deadlineIso) || deadlineIso.slice(0, 10);
      const itemKey = `${EVENT_TYPES.CONTRACTOR_REGISTRY}:w:${aid}:${dateKey}`;
      if (!aid || seen.has(itemKey)) continue;
      seen.add(itemKey);
      const project = bySubId.get(String(acc.subprojectId || '').trim()) || null;
      const row = makeItem({
        itemKey,
        eventType: EVENT_TYPES.CONTRACTOR_REGISTRY,
        project,
        subprojectId: acc.subprojectId || '',
        subprojectTitle: rec.name || '(Ανάδοχος)',
        projectTitle: project?.subprojectTitle || project?.projectTitle || '',
        adam: '',
        label: 'Λήξη χρόνου εγγύησης',
        deadlineIso,
      });
      if (row) items.push(row);
    }
  }
  return items;
}

function collectAllCalendarReminderItems({ dataDir, projects, proskliseis, contractorRecords }) {
  const procurement = collectProcurementItems(projects);
  const custom = collectCustomItems(dataDir);
  const prosklisiItems = collectProsklisiItems(proskliseis);
  const guaranteeItems = collectGuaranteeReminderItems(contractorRecords, projects);
  const merged = [...procurement, ...custom, ...prosklisiItems, ...guaranteeItems];
  merged.sort(
    (a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999)
      || (a.subprojectTitle || '').localeCompare(b.subprojectTitle || '', 'el', { sensitivity: 'base' })
  );
  return merged;
}

function itemVisibleToRecipient(item, recipient) {
  if (!recipient) return false;
  const role = String(recipient.role || '').trim().toUpperCase();

  if (item.eventType === EVENT_TYPES.CUSTOM) {
    return calendarCustomEventsService.userCanSeeCustomEvent(
      item.customEvent,
      { username: recipient.username, role: recipient.role },
      { adminSeesAll: false }
    );
  }

  // Προσκλήσεις: ορατές σε όσους έχουν επιλεγεί ως παραλήπτες (ρόλος/χρήστης στο κέντρο ειδοποιήσεων)
  if (item.eventType === EVENT_TYPES.PROSKLISI_DEADLINE) {
    return role === 'ADMIN' || role === 'SUPERADMIN' || role === 'USER' || role === 'ENGINEER';
  }

  if (item.eventType === EVENT_TYPES.CONTRACTOR_REGISTRY) {
    if (role === 'USER') return false;
    if (role === 'ADMIN' || role === 'SUPERADMIN') return true;
    if (role === 'ENGINEER') {
      return !!(item.project && projectVisibleToEngineerContext(item.project, recipient.engineerContext));
    }
    return false;
  }

  if (role === 'ADMIN' || role === 'SUPERADMIN' || role === 'USER') return true;
  if (role === 'ENGINEER') {
    return item.project && projectVisibleToEngineerContext(item.project, recipient.engineerContext);
  }
  return false;
}

function filterItemsForRecipient(items, recipient) {
  return (items || []).filter((item) => itemVisibleToRecipient(item, recipient));
}

module.exports = {
  EVENT_TYPES,
  EVENT_LABELS,
  collectAllCalendarReminderItems,
  collectProcurementItems,
  collectProsklisiItems,
  collectGuaranteeReminderItems,
  filterItemsForRecipient,
  itemVisibleToRecipient,
};

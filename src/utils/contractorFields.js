import { statusShowsAssignmentProcedure } from '../data/formOptions';
import { getKhmdhsDisplayEntries, parseGreekAmountString } from './khmdhsFields';

function getContractAmountForKhmdhsEntry(project, entry) {
  if (!project || !entry) return 0;
  if (entry.contractIndex != null && Array.isArray(project.contracts)) {
    return parseGreekAmountString(project.contracts[entry.contractIndex - 1]?.amount);
  }
  return parseGreekAmountString(project.contractAmount);
}

function getContractDateForKhmdhsEntry(project, entry) {
  if (!project || !entry) return '';
  if (entry.contractIndex != null && Array.isArray(project.contracts)) {
    return project.contracts[entry.contractIndex - 1]?.date || '';
  }
  return project.contractDate || '';
}

/** Επωνυμίες αναδόχων (ΚΗΜΔΗΣ) για εξαγωγή — χωριστές με « • » */
export function getProjectAnadoxosNamesExport(project) {
  const names = [];
  const seen = new Set();
  getKhmdhsDisplayEntries(project).forEach((entry) => {
    const name = entry.snapshot?.anadoxosName?.trim();
    if (!name) return;
    const key = name.toUpperCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(name);
  });
  return names.join(' • ');
}

/** ΑΦΜ αναδόχων (ΚΗΜΔΗΣ) για εξαγωγή */
export function getProjectAnadoxosVatsExport(project) {
  const vats = [];
  const seen = new Set();
  getKhmdhsDisplayEntries(project).forEach((entry) => {
    const vat = entry.snapshot?.anadoxosVat != null ? String(entry.snapshot.anadoxosVat).trim() : '';
    if (!vat) return;
    const key = vat.replace(/\D/g, '') || vat;
    if (seen.has(key)) return;
    seen.add(key);
    vats.push(vat);
  });
  return vats.join(' • ');
}

/** ΑΔΑΜ σύμβασης/συμβάσεων για εξαγωγή */
export function getProjectKhmdhsAdamExport(project) {
  const adams = [];
  const seen = new Set();
  getKhmdhsDisplayEntries(project).forEach((entry) => {
    const adam = entry.adam?.trim();
    if (!adam || seen.has(adam)) return;
    seen.add(adam);
    adams.push(adam);
  });
  return adams.join(' • ');
}

/** Διαδικασία ανάθεσης — μόνο για σχετικές καταστάσεις */
export function getProjectAssignmentProcedureExport(project) {
  if (!statusShowsAssignmentProcedure(project?.projectStatus)) return '';
  return (project?.assignmentProcedure && String(project.assignmentProcedure).trim()) || '';
}

function contractorProfileKey(snapshot) {
  const vatDigits = snapshot?.anadoxosVat != null
    ? String(snapshot.anadoxosVat).replace(/\D/g, '')
    : '';
  if (vatDigits) return `vat:${vatDigits}`;
  const name = snapshot?.anadoxosName?.trim();
  return name ? `name:${name.toUpperCase()}` : null;
}

/**
 * Πλήρη προφίλ αναδόχων με ιστορικό αναθέσεων, διαδικασίες, χρονοδιάγραμμα.
 * @returns {Array<{ key, name, vat, count, amount, assignments, procedureCounts, contractsByYear, firstContractDate, lastContractDate }>}
 */
export function buildContractorProfiles(projects) {
  const map = {};

  (projects || []).forEach((project) => {
    const entries = getKhmdhsDisplayEntries(project).filter((e) => e.snapshot?.anadoxosName);
    entries.forEach((entry) => {
      const key = contractorProfileKey(entry.snapshot);
      if (!key) return;

      const name = String(entry.snapshot.anadoxosName).trim();
      const amount = getContractAmountForKhmdhsEntry(project, entry);
      const contractDate = getContractDateForKhmdhsEntry(project, entry);
      const procedure = getProjectAssignmentProcedureExport(project) || 'Χωρίς καταχώριση';

      if (!map[key]) {
        map[key] = {
          key,
          name,
          vat: entry.snapshot.anadoxosVat != null ? String(entry.snapshot.anadoxosVat).trim() : '',
          count: 0,
          amount: 0,
          assignments: [],
          procedureCounts: {},
          contractsByYear: {}
        };
      }

      const profile = map[key];
      profile.count += 1;
      profile.amount += amount;
      profile.assignments.push({
        projectId: project.projectId,
        subprojectId: project.subprojectId,
        projectTitle: project.projectTitle || '',
        subprojectTitle: project.subprojectTitle || '',
        projectStatus: project.projectStatus || '',
        projectType: project.projectType || '',
        assignmentProcedure: procedure,
        contractDate,
        amount,
        fundingSource: project.fundingSource || '',
        adam: entry.adam || '',
        implementationForm: project.implementationForm || '',
        contractIndex: entry.contractIndex
      });
      profile.procedureCounts[procedure] = (profile.procedureCounts[procedure] || 0) + 1;

      if (contractDate) {
        const d = new Date(contractDate);
        if (!Number.isNaN(d.getTime())) {
          const year = d.getFullYear();
          profile.contractsByYear[year] = (profile.contractsByYear[year] || 0) + 1;
        }
      }
    });
  });

  return Object.values(map)
    .map((profile) => {
      const validDates = profile.assignments
        .map((a) => a.contractDate)
        .filter(Boolean)
        .map((d) => new Date(d))
        .filter((d) => !Number.isNaN(d.getTime()));

      const sortedAssignments = [...profile.assignments].sort(
        (a, b) => (b.contractDate || '').localeCompare(a.contractDate || '')
      );

      return {
        ...profile,
        assignments: sortedAssignments,
        firstContractDate: validDates.length
          ? new Date(Math.min(...validDates.map((d) => d.getTime()))).toISOString().slice(0, 10)
          : null,
        lastContractDate: validDates.length
          ? new Date(Math.max(...validDates.map((d) => d.getTime()))).toISOString().slice(0, 10)
          : null
      };
    })
    .sort((a, b) => b.amount - a.amount || b.count - a.count);
}

/** Συγκεντρωτικό χρονοδιάγραμμα συμβάσεων ανά έτος (όλοι οι ανάδοχοι) */
export function getContractsTimelineByYear(profiles) {
  const byYear = {};
  (profiles || []).forEach((profile) => {
    Object.entries(profile.contractsByYear || {}).forEach(([year, count]) => {
      byYear[year] = (byYear[year] || 0) + count;
    });
  });
  return byYear;
}

/** Συνολικό ποσό συμβάσεων ανά έτος */
export function getContractorAmountByYear(profiles) {
  const byYear = {};
  (profiles || []).forEach((profile) => {
    (profile.assignments || []).forEach((a) => {
      if (!a.contractDate) return;
      const d = new Date(a.contractDate);
      if (Number.isNaN(d.getTime())) return;
      const year = d.getFullYear();
      byYear[year] = (byYear[year] || 0) + (Number(a.amount) || 0);
    });
  });
  return byYear;
}

/** Χρονολογική λίστα όλων των συμβάσεων με στοιχεία αναδόχου */
export function buildContractorChronology(profiles) {
  const events = [];
  (profiles || []).forEach((profile) => {
    (profile.assignments || []).forEach((a) => {
      if (!a.contractDate) return;
      const d = new Date(a.contractDate);
      if (Number.isNaN(d.getTime())) return;
      events.push({
        ...a,
        contractorKey: profile.key,
        contractorName: profile.name,
        contractorVat: profile.vat
      });
    });
  });
  return events.sort((a, b) => (a.contractDate || '').localeCompare(b.contractDate || ''));
}

/** Ομαδοποίηση χρονολογίου ανά έτος με στατιστικά */
export function groupChronologyByYear(events) {
  const groups = {};
  (events || []).forEach((e) => {
    const year = new Date(e.contractDate).getFullYear();
    if (!groups[year]) groups[year] = [];
    groups[year].push(e);
  });
  return Object.keys(groups)
    .map(Number)
    .sort((a, b) => a - b)
    .map((year) => {
      const yearEvents = groups[year];
      return {
        year,
        events: yearEvents,
        contractCount: yearEvents.length,
        totalAmount: yearEvents.reduce((s, e) => s + (Number(e.amount) || 0), 0),
        contractorCount: new Set(yearEvents.map((e) => e.contractorKey)).size
      };
    });
}

/** Έλεγχος αν το υποέργο έχει καταγεγραμμένο στοιχείο ανάδοχου */
export function projectHasAnadoxosData(project) {
  return getKhmdhsDisplayEntries(project).some((e) => e.snapshot?.anadoxosName);
}

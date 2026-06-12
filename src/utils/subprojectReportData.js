import {
  getCharacterization,
  normalizeProjectType,
  statusShowsAssignmentProcedure
} from '../data/formOptions';
import { getProjectChargeDisplay } from './supervisorChargeDisplay';
import { getKhmdhsDisplayEntries, getTotalContractAmount, isMultipleContractsForm } from './khmdhsFields';
import { formatViolationSummary } from './directAssignmentCompliance';

function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fileNameFromEntry(file) {
  if (!file) return '';
  return typeof file === 'string' ? file : (file.name || file.fileName || '');
}

export function getLinkedEntaxeis(entaxeis, subprojectId) {
  return (entaxeis || []).filter(
    (e) => Array.isArray(e.subprojectIds) && e.subprojectIds.includes(subprojectId)
  );
}

export function getLinkedProskliseis(proskliseis, project) {
  const normTitle = normalizeText(project.projectTitle);
  const seen = new Set();
  const matches = [];

  for (const p of proskliseis || []) {
    let linked = false;
    if (p.linkedSubprojectId === project.subprojectId) linked = true;
    if (normalizeText(p.title) === normTitle) linked = true;
    if (Array.isArray(p.linkedProjects)) {
      linked = linked || p.linkedProjects.some(
        (lp) => lp.id === project.projectId || normalizeText(lp.title) === normTitle
      );
    }
    if (linked && p.prosklisiId && !seen.has(p.prosklisiId)) {
      seen.add(p.prosklisiId);
      matches.push(p);
    }
  }
  return matches;
}

export function getLinkedEgkrisiLinks(linkedEgkriseis, subprojectId) {
  return Object.values(linkedEgkriseis || {}).filter((l) => l?.subprojectId === subprojectId);
}

export function buildFileInventory(fileGroups = [], ungroupedFiles = []) {
  const groups = (fileGroups || []).map((group) => ({
    title: group.title || group.name || 'Ομάδα αρχείων',
    files: (group.files || []).map(fileNameFromEntry).filter(Boolean)
  })).filter((g) => g.files.length > 0);

  const ungrouped = (ungroupedFiles || []).map(fileNameFromEntry).filter(Boolean);

  return { groups, ungrouped, totalCount: groups.reduce((n, g) => n + g.files.length, 0) + ungrouped.length };
}

function buildBasicFields(project, engineerCatalog) {
  const { displayChargePrimary, displayChargeParticipants } = getProjectChargeDisplay(project, engineerCatalog);
  const characterization = getCharacterization(project);
  const khmdhsEntries = getKhmdhsDisplayEntries(project);
  const totalContractAmount = getTotalContractAmount(project);
  const showAssignment = statusShowsAssignmentProcedure(project.projectStatus);

  const aleCodes = (project.aleCodes || []).filter((c) => c && String(c).trim());

  return {
    projectTitle: project.projectTitle || '',
    subprojectTitle: project.subprojectTitle || '',
    implementationForm: project.implementationForm || '',
    projectType: normalizeProjectType(project.projectType),
    projectStatus: project.projectStatus || '',
    characterization,
    kaCode: project.kaCode || '',
    aleCodes,
    misPraxhsName: project.misPraxhsName || '',
    misPraxhsCode: project.misPraxhsCode || '',
    fundingSource: project.fundingSource || '',
    fundingDetails: project.fundingDetails || '',
    approvedAmount: project.approvedAmount || '',
    projectBudget: project.projectBudget || '',
    remainingAmount: project.remainingAmount || '',
    remainingAmountYear: project.remainingAmountYear || '',
    remainingAmountComments: project.remainingAmountComments || '',
    aleRemainingAmounts: project.aleRemainingAmounts || [],
    assignmentProcedure: showAssignment ? (project.assignmentProcedure || '') : '',
    contractProcessStartDate: showAssignment ? (project.contractProcessStartDate || '') : '',
    displayChargePrimary,
    displayChargeParticipants,
    khmdhsEntries,
    comments: project.comments || '',
    eisigitikiEkthesi: project.eisigitikiEkthesi || '',
    isMultipleContracts: isMultipleContractsForm(project.implementationForm),
    contractDate: project.contractDate || '',
    contractAmount: project.contractAmount || '',
    apeAmount: project.apeAmount || '',
    apeComments: project.apeComments || '',
    contracts: project.contracts || [],
    hasSupplementaryContracts: !!project.hasSupplementaryContracts,
    supplementaryContracts: project.supplementaryContracts || [],
    totalContractAmount,
    createdAt: project.createdAt || '',
    updatedAt: project.updatedAt || '',
    portalPublished: !!project.portalPublished
  };
}

function mapEntaxiForReport(entaxi) {
  const mods = entaxi.modifications || [];
  const lastMod = mods.length > 0 ? mods[mods.length - 1] : null;
  return {
    entaxiId: entaxi.entaxiId,
    documentDate: entaxi.documentDate || '',
    fundingAuthority: entaxi.fundingAuthority || '',
    initialAmount: entaxi.initialAmount || '',
    currentAmount: lastMod?.newAmount || lastMod?.amount || entaxi.initialAmount || '',
    subject: entaxi.subject || '',
    projectTitle: entaxi.projectTitle || '',
    comments: entaxi.comments || '',
    prosklisiId: entaxi.prosklisiId || '',
    entaxiPDFs: entaxi.entaxiPDFs || [],
    approvalPDFs: entaxi.approvalPDFs || [],
    modifications: mods.map((m, i) => ({
      index: i + 1,
      date: m.date || m.documentDate || '',
      amount: m.newAmount || m.amount || '',
      description: m.description || m.subject || m.comments || ''
    }))
  };
}

function mapProsklisiForReport(prosklisi, modifications = []) {
  return {
    prosklisiId: prosklisi.prosklisiId,
    title: prosklisi.title || '',
    axis: prosklisi.axis || '',
    code: prosklisi.code || '',
    fundingSource: prosklisi.fundingSource || '',
    budgetRange: prosklisi.budgetRange || '',
    deadline: prosklisi.deadline || '',
    status: prosklisi.status || '',
    linkedSubprojectId: prosklisi.linkedSubprojectId || '',
    comments: prosklisi.comments || '',
    modifications: (modifications || []).map((m, i) => ({
      index: i + 1,
      date: m.date || m.modificationDate || '',
      title: m.modifiedData?.title || m.title || '',
      status: m.modifiedData?.status || m.status || '',
      budgetRange: m.modifiedData?.budgetRange || m.budgetRange || '',
      notes: m.notes || m.comments || ''
    }))
  };
}

function mapEgkrisiRecord(eg, subprojectTitle, kaCode) {
  return {
    id: eg.id,
    subprojectTitle,
    kaCode,
    date: eg.date || '',
    fileName: eg.fileName || '',
    type: eg.type === 'modification' ? 'Τροποποίηση' : 'Αρχική',
    notes: eg.notes || ''
  };
}

export function buildSubprojectReportPayload({
  project,
  entaxeis = [],
  proskliseis = [],
  linkedEgkriseis = {},
  engineerCatalog = [],
  files = { groups: [], ungrouped: [] },
  egkriseisRecords = [],
  epActions = [],
  linkedNotes = [],
  directAssignmentViolations = [],
  isPublishedToPortal = false,
  appVersion = ''
}) {
  const linkedEntaxeis = getLinkedEntaxeis(entaxeis, project.subprojectId).map(mapEntaxiForReport);
  const linkedProskliseisRaw = getLinkedProskliseis(proskliseis, project);
  const linkedProskliseis = linkedProskliseisRaw.map((p) =>
    mapProsklisiForReport(p, p._modifications || [])
  );
  const egkrisiLinks = getLinkedEgkrisiLinks(linkedEgkriseis, project.subprojectId);

  const inlineEgkriseis = (project.egkriseisDialthesisPistosis || []).map((eg) =>
    mapEgkrisiRecord(eg, project.subprojectTitle, project.kaCode)
  );

  const loadedEgkriseis = (egkriseisRecords || []).flatMap((sub) =>
    (sub.egkriseis || []).map((eg) =>
      mapEgkrisiRecord(eg, sub.subprojectTitle || project.subprojectTitle, sub.kaCode || project.kaCode)
    )
  );

  const egkriseisMerged = [...inlineEgkriseis];
  const seenEgkrisi = new Set(inlineEgkriseis.map((e) => e.id || e.fileName));
  for (const eg of loadedEgkriseis) {
    const key = eg.id || eg.fileName;
    if (!seenEgkrisi.has(key)) {
      seenEgkrisi.add(key);
      egkriseisMerged.push(eg);
    }
  }

  const fileInventory = buildFileInventory(files.groups, files.ungrouped);

  return {
    basic: buildBasicFields(project, engineerCatalog),
    files: fileInventory,
    entaxeis: linkedEntaxeis,
    proskliseis: linkedProskliseis,
    egkriseis: egkriseisMerged,
    egkrisiLinks: egkrisiLinks.map((l) => ({
      egkrisiTitle: l.egkrisiTitle || l.subprojectTitle || '',
      egkrisiProjectKey: l.egkrisiProjectKey || '',
      egkrisiSubprojectKey: l.egkrisiSubprojectKey || '',
      autoLinked: !!l.autoLinked
    })),
    epActions: (epActions || []).map((a) => ({
      aa: a.aa,
      title: a.title || '',
      axisCode: a.axisCode || '',
      measureCode: a.measureCode || '',
      objectiveCode: a.objectiveCode || '',
      actionType: a.actionType || '',
      location: a.location || '',
      programTitle: a.programTitle || ''
    })),
    linkedNotes: (linkedNotes || []).map((n) => ({
      title: n.title || n.noteTitle || 'Σημείωση',
      preview: (n.preview || n.content || '').slice(0, 200)
    })),
    complianceWarnings: (directAssignmentViolations || []).map(formatViolationSummary),
    meta: {
      isPublishedToPortal,
      appVersion,
      subprojectId: project.subprojectId,
      projectId: project.projectId
    }
  };
}

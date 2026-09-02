import {
  getCharacterization,
  normalizeProjectType,
  statusShowsAssignmentProcedure
} from '../data/formOptions';
import { getProjectChargeDisplay } from './supervisorChargeDisplay';
import { getKhmdhsDisplayEntries, getTotalContractAmount, isMultipleContractsForm, normalizeContractRow, resolveStoredApeAmount, resolveFinalContractAmountAfterApe, resolveEffectivePayableAmountGrossForPayments } from './khmdhsFields';
import { getLatestContractApeAmount } from './khmdhsApeEntry';
import { formatViolationSummary } from './directAssignmentCompliance';
import {
  buildKhmdhsNoticeDisplayGroups,
  formatKhmdhsDateTime,
  formatKhmdhsDateOnly,
  getProjectAssignmentProcedure,
  pickKhmdhsNoticeDocumentDateForTimeline,
  pickKhmdhsNoticeSnapshot,
  projectHasKhmdhsNoticeData
} from './khmdhsNoticeFields';
import {
  formatDeadlineCountdownLabel,
  getProcurementDeadlineInfo
} from './procurementDeadlines';
import { countMeletiFiles } from './meletaiHelpers';
import {
  buildChronologicalChainTimeline,
  buildPaymentSummaryForReport,
} from './subprojectReportEnrichment';
import {
  pickKhmdhsRequestSnapshot,
  projectHasKhmdhsRequestData,
  buildKhmdhsRequestCardSummary,
} from './khmdhsRequestFields';
import {
  pickKhmdhsAwardSnapshot,
  buildKhmdhsAwardCardSummary,
  collectKhmdhsAwardEntries,
} from './khmdhsAwardFields';
import {
  collectKhmdhsCommitmentDecisions,
  buildKhmdhsCommitmentCardSummary,
  buildKhmdhsPaymentsTotals,
  getKhmdhsPaymentEntries,
} from './khmdhsChainExtraFields';
import { formatKhmdhsCostSnapshotGross } from './khmdhsVatHelper';
import {
  getKhmdhsSupplementaryStageEntries,
  mapSupplementaryEntryForReport,
} from './khmdhsSupplementaryStageEntries';
import reportsExport from '../../app/core/reportsExport';

function fileNameFromEntry(file) {
  if (!file) return '';
  return typeof file === 'string' ? file : (file.name || file.fileName || '');
}

export function getLinkedEntaxeis(entaxeis, subprojectId) {
  return reportsExport.getLinkedEntaxeis(entaxeis, subprojectId);
}

export function getLinkedProskliseis(proskliseis, project) {
  return reportsExport.getLinkedProskliseis(proskliseis, project);
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

function mapContractForReport(contract, project = null, arrayIndex = 0) {
  const c = normalizeContractRow(contract);
  const latestApe = project
    ? (getLatestContractApeAmount(project, arrayIndex) || c.apeAmount || '')
    : (c.apeAmount || '');
  return {
    date: c.date,
    amount: c.amount,
    apeAmount: latestApe,
    comments: c.comments,
    khmdhsAdam: c.khmdhsAdam,
    khmdhsAnadoxos: c.khmdhsContractSnapshot?.anadoxosName || '',
    khmdhsVat: c.khmdhsContractSnapshot?.anadoxosVat || '',
    khmdhsAuthority: c.khmdhsContractSnapshot?.assigningAuthority || '',
    khmdhsFetchedAt: c.khmdhsContractFetchedAt
  };
}

function buildKhmdhsChainForReport(project) {
  const chain = {};

  // REQ — Πρωτογενές αίτημα
  if (projectHasKhmdhsRequestData(project)) {
    const snap = pickKhmdhsRequestSnapshot(project.khmdhsRequestSnapshot);
    const summary = buildKhmdhsRequestCardSummary(snap);
    chain.req = {
      adam: String(project.khmdhsRequestAdam || snap?.referenceNumber || '').trim(),
      title: snap?.title || '',
      amount: summary?.amount || formatKhmdhsCostSnapshotGross(snap) || '',
      contractType: snap?.contractType || '',
      statusText: [snap?.isInitial && 'Πρωτογενές', snap?.isApproved && 'Εγκεκριμένο'].filter(Boolean).join(' · '),
      organization: snap?.organization || '',
      signedDate: snap?.signedDate ? formatKhmdhsDateOnly(snap.signedDate) : '',
      cancelled: !!snap?.cancelled,
      fetchedAt: project.khmdhsRequestFetchedAt ? formatKhmdhsDateTime(project.khmdhsRequestFetchedAt) : '',
    };
  }

  // COMMIT — Αποφάσεις ανάληψης υποχρέωσης
  const commitDecisions = collectKhmdhsCommitmentDecisions(project);
  if (commitDecisions.length > 0) {
    chain.commit = commitDecisions.map((d) => {
      const sum = buildKhmdhsCommitmentCardSummary(d.snapshot);
      return {
        adam: d.adam || '',
        title: d.snapshot?.title || '',
        amount: sum?.amount || '',
        organization: d.snapshot?.organization || '',
        signedDate: d.snapshot?.signedDate ? formatKhmdhsDateOnly(d.snapshot.signedDate) : '',
        cancelled: !!d.snapshot?.cancelled,
        fetchedAt: d.fetchedAt ? formatKhmdhsDateTime(d.fetchedAt) : '',
      };
    });
  }

  // AWRD — Κατακύρωση
  const awardEntries = collectKhmdhsAwardEntries(project);
  if (awardEntries.length > 0) {
    chain.awrd = awardEntries.map((entry) => {
      const snap = pickKhmdhsAwardSnapshot(entry.snapshot) || entry.snapshot;
      const summary = buildKhmdhsAwardCardSummary(snap);
      const contractors = Array.isArray(snap?.contractors) && snap.contractors.length
        ? snap.contractors.map((c) => [c.name, c.vat ? `ΑΦΜ ${c.vat}` : ''].filter(Boolean).join(' ')).join(' · ')
        : snap?.anadoxosName || '';
      return {
        adam: entry.adam || '',
        title: snap?.title || entry.title || '',
        amount: summary?.amount || '',
        contractor: contractors,
        contractorVat: snap?.anadoxosVat || '',
        organization: snap?.organization || '',
        awardDate: summary?.awardDate || '',
        cancelled: !!snap?.cancelled,
        fetchedAt: entry.fetchedAt ? formatKhmdhsDateTime(entry.fetchedAt) : '',
      };
    });
    if (chain.awrd.length === 1) {
      chain.awrd = chain.awrd[0];
    }
  }

  // PAY — Εντάλματα πληρωμής
  const paymentEntries = getKhmdhsPaymentEntries(project);
  if (paymentEntries.length > 0) {
    const totals = buildKhmdhsPaymentsTotals(project);
    chain.pay = {
      count: totals.count,
      totalGross: totals.rawTotalGross,
      countableTotalGross: totals.countableTotalGross,
      estimatedContractorPaymentGross: totals.estimatedContractorPaymentGross,
      displayTotalGross: totals.displayTotalGross,
      needsClassification: totals.needsClassification,
      entries: paymentEntries.map((e) => ({
        adam: e.adam || '',
        title: e.snapshot?.title || '',
        amount: e.snapshot?.totalCostWithVAT != null
          ? formatKhmdhsCostSnapshotGross(e.snapshot)
          : '',
        signedDate: e.snapshot?.signedDate ? formatKhmdhsDateOnly(e.snapshot.signedDate) : '',
        organization: e.snapshot?.organization || '',
        cancelled: !!e.snapshot?.cancelled,
      })),
    };
  }

  return Object.keys(chain).length > 0 ? chain : null;
}

function buildKhmdhsNoticeBlock(project) {
  if (!projectHasKhmdhsNoticeData(project)) return null;
  const snapshot = pickKhmdhsNoticeSnapshot(project.khmdhsNoticeSnapshot);
  const deadlineInfo = getProcurementDeadlineInfo(project);
  const docDates = pickKhmdhsNoticeDocumentDateForTimeline(snapshot);
  return {
    adam: project.khmdhsNoticeAdam || snapshot?.referenceNumber || '',
    title: snapshot?.title || '',
    cancelled: !!snapshot?.cancelled,
    documentDateLabel: docDates.dateLabel,
    signedDateLabel: docDates.signedDateLabel,
    submissionDateLabel: docDates.submissionDateLabel,
    fetchedAt: project.khmdhsNoticeFetchedAt || '',
    fetchedAtLabel: project.khmdhsNoticeFetchedAt ? formatKhmdhsDateTime(project.khmdhsNoticeFetchedAt) : '',
    deadlineLabel: formatDeadlineCountdownLabel(deadlineInfo),
    groups: buildKhmdhsNoticeDisplayGroups(snapshot)
  };
}

function mapMeletiForReport(meleti) {
  if (!meleti) return null;
  const fileGroups = (meleti.fileGroups || []).map((g) => ({
    label: g.label || 'Κατηγορία',
    files: (g.files || []).map((f) => {
      if (f?.kind === 'folder') return `${f.name || f.label || 'Φάκελος'} (${f.fileCount || 0} αρχεία)`;
      return f?.name || f?.fileName || String(f || '');
    }).filter(Boolean)
  })).filter((g) => g.files.length > 0);

  return {
    studyNumber: meleti.studyNumber || '',
    title: meleti.title || '',
    category: meleti.category || '',
    assignedTo: meleti.assignedTo || '',
    notes: meleti.notes || '',
    linkedProjectTitle: meleti.linkedProjectTitle || '',
    fileCount: countMeletiFiles(meleti),
    fileGroups,
    updatedAt: meleti.updatedAt || meleti.createdAt || ''
  };
}

function buildBasicFields(project, engineerCatalog) {
  const { displayChargePrimary, displayChargeParticipants } = getProjectChargeDisplay(project, engineerCatalog);
  const characterization = getCharacterization(project);
  const khmdhsEntries = getKhmdhsDisplayEntries(project);
  const totalContractAmount = getTotalContractAmount(project);
  const showAssignment = statusShowsAssignmentProcedure(project.projectStatus);

  const aleCodes = (project.aleCodes || []).filter((c) => c && String(c).trim());
  if (!aleCodes.length && project.aleCode) {
    aleCodes.push(String(project.aleCode).trim());
  }

  const contracts = (project.contracts || []).map((c, i) => mapContractForReport(c, project, i));
  const supplementaryContracts = (project.supplementaryContracts || []).map((c) => mapContractForReport(c));
  const supplementaryStageEntries = getKhmdhsSupplementaryStageEntries(project)
    .map(mapSupplementaryEntryForReport)
    .filter(Boolean);
  const finalAfterApe = resolveFinalContractAmountAfterApe(project);
  const paymentReferenceAmount = resolveEffectivePayableAmountGrossForPayments(project);

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
    assignmentProcedure: showAssignment ? getProjectAssignmentProcedure(project) : '',
    assignmentFromKhmdhs: showAssignment && !!(project.khmdhsNoticeAdam && pickKhmdhsNoticeSnapshot(project.khmdhsNoticeSnapshot)),
    contractProcessStartDate: showAssignment ? (project.contractProcessStartDate || '') : '',
    displayChargePrimary,
    displayChargeParticipants,
    khmdhsEntries,
    khmdhsNotice: buildKhmdhsNoticeBlock(project),
    comments: project.comments || '',
    eisigitikiEkthesi: project.eisigitikiEkthesi || '',
    isMultipleContracts: isMultipleContractsForm(project.implementationForm),
    contractDate: project.contractDate || '',
    contractAmount: project.contractAmount || '',
    apeAmount: resolveStoredApeAmount(project, null) || project.apeAmount || '',
    apeComments: project.apeComments || '',
    hasFinalContractAmountAfterApe: !!finalAfterApe.hasRevision,
    finalContractAmountAfterApe: finalAfterApe.hasRevision ? (finalAfterApe.amountRaw || finalAfterApe.amountLabel) : '',
    finalContractApeDate: finalAfterApe.apeDocumentDate || '',
    finalContractAfterApeLabel: finalAfterApe.fullLabel,
    finalContractAfterApeExplanation: finalAfterApe.explanation,
    paymentReferenceAmount: paymentReferenceAmount != null ? paymentReferenceAmount : null,
    khmdhsAdam: project.khmdhsAdam || '',
    khmdhsContractSnapshot: project.khmdhsContractSnapshot || null,
    khmdhsContractFetchedAt: project.khmdhsContractFetchedAt || '',
    contracts,
    hasSupplementaryContracts: !!project.hasSupplementaryContracts,
    supplementaryContracts,
    supplementaryStageEntries,
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
  egkriseisRecords = [],
  epActions = [],
  linkedNotes = [],
  directAssignmentViolations = [],
  isPublishedToPortal = false,
  meleti = null,
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

  const basic = buildBasicFields(project, engineerCatalog);
  const khmdhsChain = buildKhmdhsChainForReport(project);
  const paymentSummary = buildPaymentSummaryForReport(basic, khmdhsChain);
  const chronologicalTimeline = buildChronologicalChainTimeline(
    khmdhsChain,
    basic.khmdhsNotice,
    basic
  );

  return {
    basic,
    khmdhsChain,
    paymentSummary,
    chronologicalTimeline,
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
      programTitle: a.programTitle || '',
      priority: a.priority || '',
      total: a.total != null ? a.total : null,
      isNew: a.isNew
    })),
    linkedNotes: (linkedNotes || []).map((n) => ({
      title: n.title || n.noteTitle || 'Σημείωση',
      content: n.content || n.preview || '',
      updatedAt: n.updatedAt || n.createdAt || ''
    })),
    meleti: mapMeletiForReport(meleti),
    complianceWarnings: (directAssignmentViolations || []).map(formatViolationSummary),
    meta: {
      isPublishedToPortal,
      appVersion,
      subprojectId: project.subprojectId,
      projectId: project.projectId
    }
  };
}

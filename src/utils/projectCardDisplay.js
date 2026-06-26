/**
 * Σύνοψη στοιχείων σύμβασης για την κάρτα υποέργου (Dashboard).
 */

import {
  STATUSES_WITH_CONTRACT_FIELDS,
  statusShowsAssignmentProcedure,
} from '../data/formOptions';
import { formatDateEl } from './dateFormat';
import {
  getKhmdhsDisplayEntries,
  isMultipleContractsForm,
  parseGreekAmountString,
} from './khmdhsFields';
import {
  getKhmdhsSupplementaryStageEntries,
} from './khmdhsSupplementaryStageEntries';
import { noticeDrivesAssignmentProcedure } from './khmdhsNoticeFields';
import {
  CHAIN_KIND,
  computeChainCharacterizationEffects,
  getChainKindChoice,
  getEffectiveChainKind,
} from './khmdhsChainActions';

function formatDate(value) {
  return formatDateEl(value, '');
}

function pickContractor(snapshot) {
  if (!snapshot) return { name: '', vat: '' };
  return {
    name: String(snapshot.anadoxosName || snapshot.contractorName || '').trim(),
    vat: String(snapshot.anadoxosVat || snapshot.contractorVat || '').trim(),
  };
}

function collectAmendmentStats(chainHistory, review) {
  let modifications = 0;
  let extensions = 0;
  let lastExtensionEnd = '';

  (chainHistory || []).forEach((h) => {
    if (h?.isRoot) return;
    const kind = getEffectiveChainKind(h, review);
    if (kind === CHAIN_KIND.MODIFICATION) modifications += 1;
    if (kind === CHAIN_KIND.EXTENSION) {
      extensions += 1;
      const end = (getChainKindChoice(review, h.adam)?.endDate || h.endDate || '').slice(0, 10);
      if (end && (!lastExtensionEnd || end > lastExtensionEnd)) {
        lastExtensionEnd = end;
      }
    }
  });

  return { modifications, extensions, lastExtensionEnd };
}

function buildAmendmentsSummaryLine(chainHistory, review) {
  const { modifications, extensions } = collectAmendmentStats(chainHistory, review);

  const parts = [];
  if (modifications > 0) {
    parts.push(`${modifications} τροποποίηση${modifications > 1 ? 'είς' : ''}`);
  }
  if (extensions > 0) {
    parts.push(`${extensions} παράταση${extensions > 1 ? 'ες' : ''}`);
  }
  return parts.length ? parts.join(' · ') : '';
}

function formatEuroTotal(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return amount.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Σύντομη σύνοψη συμπληρωματικών για την κάρτα υποέργου (όχι παρατάσεις) */
export function buildSupplementaryCardSummary(project) {
  const entries = getKhmdhsSupplementaryStageEntries(project || {})
    .filter((e) => !e.isExtension && e.label !== 'Παράταση');
  if (!entries.length) return null;

  const items = entries.map((e) => ({
    amount: String(e.amount || e.rawAmount || '').trim(),
    date: String(e.date || '').trim(),
    adam: String(e.adam || '').trim(),
  })).filter((it) => it.amount || it.date || it.adam);
  if (!items.length) return null;

  const totalNumeric = items.reduce((sum, it) => sum + parseGreekAmountString(it.amount), 0);
  const totalFormatted = formatEuroTotal(totalNumeric);

  return {
    count: items.length,
    totalFormatted,
    items,
    label: items.length === 1 ? 'Συμπληρωματική' : `Συμπληρωματικές (${items.length})`,
    displayAmount: items.length === 1
      ? (items[0].amount || (items[0].date ? formatDate(items[0].date) : ''))
      : (totalFormatted || ''),
  };
}

function buildDeadlineLine(chainHistory, review, contractEndDate) {
  const { extensions, lastExtensionEnd } = collectAmendmentStats(chainHistory, review);
  const endIso = String(contractEndDate || lastExtensionEnd || '').slice(0, 10);
  if (!endIso) return null;

  const formatted = formatDate(endIso);
  if (!formatted) return null;

  if (extensions > 0) {
    return { label: '(Λήξη μετά από Παράταση)', value: formatted };
  }
  return { label: 'Λήξη υλοποίησης', value: formatted };
}

function buildSingleContractRow(project) {
  const review = project.khmdhsDataQualityReview || null;
  const chainHistory = project.khmdhsContractChainHistory || [];
  const entry = getKhmdhsDisplayEntries(project)[0];
  const effects = chainHistory.length
    ? computeChainCharacterizationEffects(chainHistory, review)
    : null;

  const deadlineEnd = project.contractEndDate || effects?.contractDeadline || '';
  const contractor = pickContractor(entry?.snapshot || project.khmdhsContractSnapshot);

  return {
    label: null,
    date: project.contractDate || effects?.contractDate || '',
    amount: project.contractAmount || effects?.contractAmount || '',
    apeAmount: project.apeAmount || '',
    contractorName: contractor.name,
    contractorVat: contractor.vat,
    deadline: buildDeadlineLine(chainHistory, review, deadlineEnd),
    amendmentsLine: buildAmendmentsSummaryLine(chainHistory, review),
    supplementarySummary: buildSupplementaryCardSummary(project),
  };
}

function buildMultiContractRow(project, contract, index) {
  const review = project.khmdhsDataQualityReview || null;
  const chainHistory = contract.khmdhsContractChainHistory || [];
  const contractor = pickContractor(contract.khmdhsContractSnapshot);

  return {
    label: `Σύμβαση ${index + 1}`,
    date: contract.date || '',
    amount: contract.amount || '',
    apeAmount: contract.apeAmount || '',
    contractorName: contractor.name,
    contractorVat: contractor.vat,
    deadline: buildDeadlineLine(chainHistory, review, project.contractEndDate),
    amendmentsLine: buildAmendmentsSummaryLine(chainHistory, review),
    supplementarySummary: index === 0
      ? buildSupplementaryCardSummary(project)
      : null,
  };
}

/** Γραμμές σύμβασης για την κάρτα — κενές γραμμές παραλείπονται στο UI */
export function buildProjectCardContractRows(project) {
  if (!project) return [];

  if (isMultipleContractsForm(project.implementationForm)) {
    return (project.contracts || [])
      .map((c, i) => buildMultiContractRow(project, c, i))
      .filter((row) => row.date || row.amount || row.apeAmount
        || row.deadline || row.amendmentsLine || row.supplementarySummary
        || row.contractorName || row.contractorVat);
  }

  const row = buildSingleContractRow(project);
  if (!row.date && !row.amount && !row.apeAmount && !row.deadline
    && !row.amendmentsLine && !row.supplementarySummary && !row.contractorName) {
    return [];
  }
  return [row];
}

export function shouldShowProcedureZone(project) {
  if (!project) return false;
  const hasProcedure = !!String(project.assignmentProcedure || '').trim();
  if (!hasProcedure) return false;
  return statusShowsAssignmentProcedure(project.projectStatus)
    || noticeDrivesAssignmentProcedure(project);
}

export function shouldShowContractZone(project) {
  if (!project) return false;
  if (STATUSES_WITH_CONTRACT_FIELDS.includes(project.projectStatus)) return true;
  return buildProjectCardContractRows(project).length > 0;
}

export function formatAleCodes(project) {
  if (project?.aleCodes?.length) {
    return project.aleCodes.filter((c) => c && String(c).trim()).join(' · ');
  }
  return String(project?.aleCode || '').trim();
}

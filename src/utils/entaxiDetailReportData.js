import { formatDateEl } from './dateFormat';
import {
  formatEntaxiAmount,
  formatEntaxiAmountDelta,
  getEntaxiCurrentTotal,
  getModificationAmountFlowEntry,
} from './entaxiAmountUtils';
import { parseGreekAmountString } from './khmdhsFields';
import { getEntaxiDiavgeiaAdaText, getEntaxiDiavgeiaViewUrl } from './entaxiDiavgeiaRegistry';
import entaxiCatalog from '../../app/core/entaxiCatalog';

function basenameFromPath(filePath) {
  const parts = String(filePath || '').split(/[/\\]/);
  return (parts[parts.length - 1] || '').trim();
}

export function fileNameFromEntaxiRef(file) {
  if (!file) return '';
  if (typeof file === 'string') return file;
  return String(file.fileName || file.name || basenameFromPath(file.filePath) || '').trim();
}

function listFileNames(files) {
  if (!files) return [];
  const arr = Array.isArray(files) ? files : [files];
  return arr.map(fileNameFromEntaxiRef).filter(Boolean);
}

function formatAmountOrEmpty(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return `${formatEntaxiAmount(value)} €`;
  }
  const n = parseGreekAmountString(value);
  if (!Number.isFinite(n) || (n === 0 && String(value).trim() === '')) return '';
  return `${formatEntaxiAmount(n)} €`;
}

function mapModification(entaxi, mod, index) {
  const flow = getModificationAmountFlowEntry(entaxi, index);
  const files = [
    ...listFileNames(mod?.modificationPDF).map((name) => ({ kind: 'Τροποποίηση', name })),
    ...listFileNames(mod?.approvalPDF).map((name) => ({ kind: 'Αποδοχή χρηματοδότησης', name })),
  ];
  const ada = getEntaxiDiavgeiaAdaText(mod) || '';
  return {
    index: index + 1,
    date: formatDateEl(mod?.date || mod?.documentDate, ''),
    comments: String(mod?.comments || '').trim(),
    changeAmount: !!(mod?.changeAmount && flow.kind === 'absolute'),
    amountLabel: flow.kind === 'absolute' ? formatAmountOrEmpty(flow.newTotal) : '',
    deltaLabel: flow.kind === 'absolute' ? `${formatEntaxiAmountDelta(flow.delta)} €` : '',
    previousTotalLabel: flow.kind === 'absolute' ? formatAmountOrEmpty(flow.previousTotal) : '',
    ada,
    adaUrl: ada ? getEntaxiDiavgeiaViewUrl({ ada }) : '',
    endDate: formatDateEl(mod?.endDate, ''),
    legalCommitmentDeadline: formatDateEl(mod?.legalCommitmentDeadline, ''),
    files,
  };
}

/**
 * Δεδομένα για την οθόνη λεπτομερειών και την αναφορά PDF της ένταξης.
 */
export function buildEntaxiDetailReportPayload({
  entaxi,
  prosklisiTitle = '',
  linkedNotes = [],
  appVersion = '',
  organizationName = '',
} = {}) {
  const e = entaxi || {};
  const initialTotal = parseGreekAmountString(e.initialAmount);
  const currentTotal = getEntaxiCurrentTotal(e);
  const amountDelta = currentTotal - initialTotal;
  const mods = Array.isArray(e.modifications) ? e.modifications : [];
  const ada = getEntaxiDiavgeiaAdaText(e);
  const unlinked = entaxiCatalog.isEntaxiUnlinked(e);
  const notes = (linkedNotes || []).map((n) => ({
    title: n.title || n.noteTitle || 'Σημείωση',
    content: String(n.content || '').trim(),
    updatedAt: formatDateEl(n.updatedAt || n.createdAt, ''),
  }));

  return {
    subject: String(e.subject || '').trim(),
    projectTitle: entaxiCatalog.formatEntaxiProjectTitles(e) || String(e.projectTitle || '').trim(),
    unlinked,
    documentDate: formatDateEl(e.documentDate, ''),
    fundingAuthority: String(e.fundingAuthority || '').trim(),
    beneficiary: String(e.beneficiary || '').trim(),
    comments: String(e.comments || '').trim(),
    opsCode: String(e.opsCode || '').trim(),
    diavgeiaAda: ada,
    diavgeiaUrl: ada ? getEntaxiDiavgeiaViewUrl({ ada }) : '',
    startDate: formatDateEl(e.startDate, ''),
    endDate: formatDateEl(e.endDate, ''),
    legalCommitmentDeadline: formatDateEl(e.legalCommitmentDeadline, ''),
    initialAmountLabel: formatAmountOrEmpty(initialTotal),
    currentAmountLabel: formatAmountOrEmpty(currentTotal),
    amountDeltaLabel: Math.abs(amountDelta) > 0.001
      ? `${formatEntaxiAmountDelta(amountDelta)} €`
      : '',
    amountDeltaNegative: amountDelta < 0,
    modificationsCount: mods.length,
    modifications: mods.map((mod, i) => mapModification(e, mod, i)),
    prosklisiTitle: String(prosklisiTitle || '').trim(),
    prosklisiId: e.prosklisiId || '',
    subprojectCount: Array.isArray(e.subprojectIds) ? e.subprojectIds.length : 0,
    files: {
      entaxi: listFileNames(e.entaxiPDFs),
      approval: listFileNames(e.approvalPDFs),
    },
    notes,
    createdAt: formatDateEl(e.createdAt, ''),
    updatedAt: formatDateEl(e.updatedAt, ''),
    meta: {
      appVersion: String(appVersion || '').trim(),
      organizationName: String(organizationName || '').trim(),
    },
  };
}

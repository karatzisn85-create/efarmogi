/**
 * Καταχώριση ΑΠΕ (τελικό διαμορφωθέν ποσό) ανά σύμβαση ή συμπληρωματική.
 */

import { v4 as uuidv4 } from 'uuid';
import { isMultipleContractsForm, parseGreekAmountString } from './khmdhsFields';
import { normalizeDiavgeiaAda } from './diavgeiaApeFetch';
import { mergeApeIntoDocumentRegistry, removeApeFromDocumentRegistry } from './khmdhsApeRegistry';
import { isSupplementaryApeEligible } from './khmdhsSupplementaryStageEntries';
import { toIsoDateOnly } from './dateFormat';
import {
  formatProjectAmountDisplay,
  getKhmdhsAmountSanityReference,
  normalizeProjectAmountForStorage,
  resolveProjectAmountNumeric,
} from './projectAmountUtils';
import { normalizeAmountForCompare } from './projectFormPhases';

export function getApeKhmdhsReferenceAmountLabel({ kind, parentTitle } = {}) {
  const title = String(parentTitle || '').trim().toLowerCase();
  if (kind === 'supplementary') {
    if (title.includes('παράταση')) return 'Ποσό παράτασης (ΚΗΜΔΗΣ)';
    return 'Ποσό συμπληρωματικής (ΚΗΜΔΗΣ)';
  }
  if (title.includes('αρχική') || title === 'σύμβαση') {
    return 'Ποσό αρχικής σύμβασης';
  }
  if (title.startsWith('σύμβαση')) return 'Ποσό σύμβασης';
  return 'Ποσό σύμβασης';
}

function parseApeAmountValue(value, contractReference = '', sanityReference = 0) {
  const ref = resolveProjectAmountNumeric(contractReference, sanityReference)
    || (typeof sanityReference === 'number' ? sanityReference : parseGreekAmountString(sanityReference));
  return resolveProjectAmountNumeric(value, ref);
}

export function formatApeAmountDisplay(value, contractReference = '', sanityReference = 0) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const ref = resolveProjectAmountNumeric(contractReference, sanityReference)
    || (typeof sanityReference === 'number' ? sanityReference : parseGreekAmountString(sanityReference));
  const n = parseApeAmountValue(raw, contractReference, ref);
  if (!Number.isFinite(n) || n <= 0) return raw;
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function apeEntrySortKey(entry) {
  const d = String(entry?.documentDate || '').slice(0, 10);
  if (d) return d;
  return String(entry?.createdAt || entry?.updatedAt || '').slice(0, 10) || '0000-00-00';
}

function normalizeApeEntryRow(entry = {}) {
  return {
    id: String(entry.id || '').trim() || uuidv4(),
    documentDate: String(entry.documentDate || '').slice(0, 10),
    apeAmount: String(entry.apeAmount || '').trim(),
    comments: String(entry.comments || entry.apeComments || '').trim(),
    apeSourceAdam: String(entry.apeSourceAdam || entry.sourceAdam || '').trim().toUpperCase(),
    apeDiavgeiaAda: String(entry.apeDiavgeiaAda || entry.diavgeiaAda || '').trim(),
    apeFileName: String(entry.apeFileName || '').trim(),
    apeFileGroupId: String(entry.apeFileGroupId || '').trim(),
    apeFileGroupTitle: String(entry.apeFileGroupTitle || '').trim(),
    apeFileSourcePath: String(entry.apeFileSourcePath || '').trim(),
    createdAt: String(entry.createdAt || new Date().toISOString()),
    updatedAt: String(entry.updatedAt || new Date().toISOString()),
  };
}

function contractAmountRefForSlice(form, arrayIndex = 0) {
  if (!form) return '';
  if (isMultipleContractsForm(form.implementationForm)) {
    return String(form.contracts?.[arrayIndex]?.amount || '').trim();
  }
  return String(form.contractAmount || '').trim();
}

function isMeaningfulApeAmount(amount) {
  const raw = String(amount || '').trim();
  if (!raw) return false;
  const n = normalizeAmountForCompare(raw);
  return n != null && n >= 0.01;
}

function hasApeSpecificMetadata(slice = {}) {
  return !!(
    String(slice.apeSourceAdam || '').trim()
    || String(slice.apeDiavgeiaAda || '').trim()
    || String(slice.apeFileName || '').trim()
    || String(slice.apeComments || '').trim()
    || (Array.isArray(slice.apeEntries) && slice.apeEntries.some((e) => (
      String(e?.apeSourceAdam || e?.sourceAdam || '').trim()
      || String(e?.apeDiavgeiaAda || e?.diavgeiaAda || '').trim()
      || String(e?.apeFileName || '').trim()
      || String(e?.comments || '').trim()
    )))
  );
}

function apeAmountDiffersFromContract(apeAmount, contractAmount) {
  const apeRaw = String(apeAmount || '').trim();
  if (!apeRaw) return false;
  const contractRaw = String(contractAmount || '').trim();
  if (!contractRaw) return true;
  const apeN = normalizeAmountForCompare(apeRaw);
  const contractN = normalizeAmountForCompare(contractRaw);
  if (apeN == null || contractN == null) return apeRaw !== contractRaw;
  return Math.abs(apeN - contractN) >= 0.01;
}

/** Υπάρχει πραγματικός καταχωρημένος ΑΠΕ (όχι «φάντασμα» ίδιο με ποσό σύμβασης). */
export function hasRealStoredContractApe(form, arrayIndex = 0) {
  if (!form) return false;
  const slice = getContractApeSlice(form, arrayIndex);
  if (hasApeSpecificMetadata(slice)) return true;
  const legacyAmount = String(slice.apeAmount || '').trim();
  if (!isMeaningfulApeAmount(legacyAmount)) return false;
  return apeAmountDiffersFromContract(legacyAmount, contractAmountRefForSlice(form, arrayIndex));
}

export function emptyLegacyApeFields() {
  return {
    apeEntries: [],
    apeAmount: '',
    apeComments: '',
    apeSourceAdam: '',
    apeDiavgeiaAda: '',
    apeDocumentDate: '',
    apeFileName: '',
    apeFileGroupId: '',
    apeFileGroupTitle: '',
    apeFileSourcePath: '',
  };
}

/** Αφαιρεί ψευδο-ΑΠΕ που ισούται με ποσό σύμβασης χωρίς μεταδεδομένα ΑΠΕ. */
export function stripPhantomContractApeFromForm(form, referenceForm = form) {
  if (!form) return form;
  if (isMultipleContractsForm(form.implementationForm)) {
    const contracts = (form.contracts || []).map((row, idx) => (
      hasRealStoredContractApe(referenceForm, idx)
        ? row
        : { ...row, ...emptyLegacyApeFields() }
    ));
    return { ...form, contracts };
  }
  if (hasRealStoredContractApe(referenceForm, 0)) return form;
  return { ...form, ...emptyLegacyApeFields() };
}

function migrateLegacyContractApeEntries(slice = {}, contractAmountRef = '') {
  const existing = Array.isArray(slice.apeEntries) ? slice.apeEntries.map(normalizeApeEntryRow) : [];
  const legacyAmount = String(slice.apeAmount || '').trim();
  const realLegacyAmount = isMeaningfulApeAmount(legacyAmount)
    && (hasApeSpecificMetadata(slice) || apeAmountDiffersFromContract(legacyAmount, contractAmountRef));
  if (existing.length) {
    const filled = realLegacyAmount
      ? existing.map((entry, idx) => {
        if (String(entry.apeAmount || '').trim()) return entry;
        if (existing.length === 1 || idx === existing.length - 1) {
          return normalizeApeEntryRow({ ...entry, apeAmount: legacyAmount });
        }
        return entry;
      })
      : existing;
    return filled.filter(hasContractApeEntryData);
  }
  const hasMeta = realLegacyAmount
    || String(slice.apeSourceAdam || '').trim()
    || String(slice.apeDiavgeiaAda || '').trim()
    || String(slice.apeFileName || '').trim()
    || String(slice.apeComments || '').trim();
  if (!hasMeta) return [];
  return [normalizeApeEntryRow({
    id: uuidv4(),
    documentDate: slice.apeDocumentDate || slice.contractDate || slice.date || '',
    apeAmount: realLegacyAmount ? legacyAmount : '',
    comments: slice.apeComments || '',
    apeSourceAdam: slice.apeSourceAdam || '',
    apeDiavgeiaAda: slice.apeDiavgeiaAda || '',
    apeFileName: slice.apeFileName || '',
    apeFileGroupId: slice.apeFileGroupId || '',
    apeFileGroupTitle: slice.apeFileGroupTitle || '',
    apeFileSourcePath: slice.apeFileSourcePath || '',
  })].filter(hasContractApeEntryData);
}

function getContractApeSlice(project, arrayIndex = 0) {
  if (!project) return {};
  if (isMultipleContractsForm(project.implementationForm)) {
    return project.contracts?.[arrayIndex] || {};
  }
  return project;
}

/** Όλες οι καταχωρήσεις ΑΠΕ σύμβασης — ταξινόμηση κατά ημερομηνία εγγράφου (παλαιότερο → νεότερο). */
export function listContractApeEntries(project, arrayIndex = 0) {
  const slice = getContractApeSlice(project, arrayIndex);
  const contractRef = contractAmountRefForSlice(project, arrayIndex);
  return migrateLegacyContractApeEntries(slice, contractRef)
    .sort((a, b) => apeEntrySortKey(a).localeCompare(apeEntrySortKey(b)));
}

export function getLatestContractApeEntry(project, arrayIndex = 0) {
  const entries = listContractApeEntries(project, arrayIndex);
  return entries.length ? entries[entries.length - 1] : null;
}

export function getLatestContractApeAmount(project, arrayIndex = 0) {
  return String(getLatestContractApeEntry(project, arrayIndex)?.apeAmount || '').trim();
}

/** Είναι αυτή η καταχώριση ΑΠΕ η πιο πρόσφατη (κατά ημερομηνία εγγράφου); */
export function isLatestContractApeEntry(project, arrayIndex, entryId) {
  if (!entryId) return false;
  const latest = getLatestContractApeEntry(project, arrayIndex ?? 0);
  return !!latest && latest.id === entryId;
}

/** Ποσό ΑΠΕ που ισχύει για υπολογισμούς — μόνο η πιο πρόσφατη καταχώριση. */
export function getEffectiveContractApeAmount(project, arrayIndex = 0) {
  return getLatestContractApeAmount(project, arrayIndex);
}

function fieldsFromApeEntry(entry, khmdhsAmount = '') {
  if (!entry) {
    return { khmdhsAmount, apeAmount: '', comments: '', sourceAdam: '', diavgeiaAda: '', documentDate: '' };
  }
  return {
    khmdhsAmount,
    apeAmount: String(entry.apeAmount || '').trim(),
    comments: String(entry.comments || '').trim(),
    sourceAdam: String(entry.apeSourceAdam || '').trim(),
    diavgeiaAda: String(entry.apeDiavgeiaAda || '').trim(),
    documentDate: String(entry.documentDate || '').slice(0, 10),
  };
}

function legacyApePatchFromEntries(entries) {
  const latest = entries.length ? entries[entries.length - 1] : null;
  if (!latest) {
    return {
      apeEntries: [],
      apeAmount: '',
      apeComments: '',
      apeSourceAdam: '',
      apeDiavgeiaAda: '',
      apeDocumentDate: '',
      apeFileName: '',
      apeFileGroupId: '',
      apeFileGroupTitle: '',
      apeFileSourcePath: '',
    };
  }
  return {
    apeEntries: entries,
    apeAmount: latest.apeAmount || '',
    apeComments: latest.comments || '',
    comments: latest.comments || '',
    apeSourceAdam: latest.apeSourceAdam || '',
    apeDiavgeiaAda: latest.apeDiavgeiaAda || '',
    apeDocumentDate: latest.documentDate || '',
    apeFileName: latest.apeFileName || '',
    apeFileGroupId: latest.apeFileGroupId || '',
    apeFileGroupTitle: latest.apeFileGroupTitle || '',
    apeFileSourcePath: latest.apeFileSourcePath || '',
  };
}

function writeContractApeEntries(project, arrayIndex, entries) {
  const normalized = entries.map(normalizeApeEntryRow)
    .sort((a, b) => apeEntrySortKey(a).localeCompare(apeEntrySortKey(b)));
  const patch = legacyApePatchFromEntries(normalized);
  if (isMultipleContractsForm(project?.implementationForm)) {
    const contracts = [...(project.contracts || [])];
    while (contracts.length <= arrayIndex) {
      contracts.push({ date: '', amount: '', apeAmount: '', comments: '' });
    }
    contracts[arrayIndex] = { ...contracts[arrayIndex], ...patch };
    return { contracts };
  }
  return patch;
}

function suppRoleLabelComments(value) {
  const c = String(value || '').trim();
  return c === 'Παράταση' || c === 'Συμπληρωματική σύμβαση';
}

function readSupplementaryApeComments(row = {}) {
  const dedicated = String(row.apeComments || '').trim();
  if (dedicated) return dedicated;
  const amount = String(row.apeAmount || '').trim();
  const hasApeMeta = amount
    || String(row.apeSourceAdam || '').trim()
    || String(row.apeDiavgeiaAda || '').trim()
    || String(row.apeFileName || '').trim()
    || row.apeRecorded === true;
  if (!hasApeMeta) return '';
  const legacy = String(row.comments || '').trim();
  if (suppRoleLabelComments(legacy)) return '';
  return legacy;
}

function findContractApeEntry(project, arrayIndex, entryId) {
  if (!entryId) return null;
  return listContractApeEntries(project, arrayIndex).find((e) => e.id === entryId) || null;
}

function hasContractApeEntryData(entry) {
  if (!entry) return false;
  return !!(
    isMeaningfulApeAmount(entry.apeAmount)
    || String(entry.apeSourceAdam || '').trim()
    || String(entry.apeDiavgeiaAda || '').trim()
    || String(entry.apeFileName || '').trim()
    || String(entry.comments || '').trim()
  );
}

function normalizeAmountInput(value, contractReference = '', sanityReference = 0) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const ref = resolveProjectAmountNumeric(contractReference, sanityReference)
    || (typeof sanityReference === 'number' ? sanityReference : parseGreekAmountString(sanityReference));
  const n = parseApeAmountValue(raw, contractReference, ref);
  if (!Number.isFinite(n) || n < 0) return raw;
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sanitizeFileName(name) {
  return String(name || '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

function fileEntryName(file) {
  if (!file) return '';
  if (typeof file === 'string') return file;
  return String(file.name || file.fileName || '').trim();
}

function getFileExtension(name) {
  const m = /\.[^./\\]+$/.exec(String(name || ''));
  return m ? m[0] : '';
}

function basenameFromPath(filePath) {
  const parts = String(filePath || '').split(/[/\\]/);
  return parts[parts.length - 1] || '';
}

/** Προτεινόμενος τίτλος ομάδας — κάτω από τη σχετική σύμβαση */
export function buildDefaultApeFileGroupTitle(targetTitle = '') {
  return String(targetTitle || 'Σύμβαση').trim() || 'Σύμβαση';
}

/** Προτεινόμενο όνομα αρχείου ΑΠΕ */
export function buildDefaultApeFileName(targetTitle = '', sourcePath = '') {
  const ext = getFileExtension(sourcePath) || getFileExtension(basenameFromPath(sourcePath)) || '.pdf';
  const label = sanitizeFileName(`ΑΠΕ — ${String(targetTitle || 'Σύμβαση').trim() || 'Σύμβαση'}`);
  return `${label}${ext.toLowerCase()}`;
}

function readApeFileRefFromRow(row = {}) {
  return {
    fileName: String(row.apeFileName || '').trim(),
    groupId: String(row.apeFileGroupId || '').trim(),
    groupTitle: String(row.apeFileGroupTitle || '').trim(),
    sourcePath: String(row.apeFileSourcePath || '').trim(),
  };
}

function writeApeFileRefToRow(row, ref) {
  const next = { ...row };
  if (!ref || (!ref.fileName && !ref.groupId)) {
    delete next.apeFileName;
    delete next.apeFileGroupId;
    delete next.apeFileGroupTitle;
    delete next.apeFileSourcePath;
    return next;
  }
  next.apeFileName = ref.fileName || '';
  next.apeFileGroupId = ref.groupId || '';
  next.apeFileGroupTitle = ref.groupTitle || '';
  if (ref.sourcePath) {
    next.apeFileSourcePath = ref.sourcePath;
  } else {
    delete next.apeFileSourcePath;
  }
  return next;
}

/** @returns {{ fileName: string, groupId: string, groupTitle: string, sourcePath: string }} */
export function readApeFileRef(project, { kind, arrayIndex = 0, entryId = null } = {}) {
  if (!project) {
    return { fileName: '', groupId: '', groupTitle: '', sourcePath: '' };
  }
  if (kind === 'supplementary') {
    return readApeFileRefFromRow(project.supplementaryContracts?.[arrayIndex]);
  }
  if (entryId) {
    return readApeFileRefFromRow(findContractApeEntry(project, arrayIndex, entryId) || {});
  }
  const latest = getLatestContractApeEntry(project, arrayIndex);
  if (latest) return readApeFileRefFromRow(latest);
  if (isMultipleContractsForm(project.implementationForm)) {
    return readApeFileRefFromRow(project.contracts?.[arrayIndex]);
  }
  return {
    fileName: String(project.apeFileName || '').trim(),
    groupId: String(project.apeFileGroupId || '').trim(),
    groupTitle: String(project.apeFileGroupTitle || '').trim(),
    sourcePath: String(project.apeFileSourcePath || '').trim(),
  };
}

export function hasApeFile(project, target) {
  const ref = readApeFileRef(project, target);
  return !!ref.fileName;
}

function applyApeFileRefToProjectSlice(project, kind, arrayIndex, ref) {
  if (kind === 'supplementary') {
    const supplementaryContracts = [...(project.supplementaryContracts || [])];
    while (supplementaryContracts.length <= arrayIndex) {
      supplementaryContracts.push({ date: '', amount: '', comments: '' });
    }
    supplementaryContracts[arrayIndex] = writeApeFileRefToRow(supplementaryContracts[arrayIndex], ref);
    return { supplementaryContracts };
  }
  if (isMultipleContractsForm(project?.implementationForm)) {
    const contracts = [...(project.contracts || [])];
    while (contracts.length <= arrayIndex) {
      contracts.push({ date: '', amount: '', apeAmount: '', comments: '' });
    }
    contracts[arrayIndex] = writeApeFileRefToRow(contracts[arrayIndex], ref);
    return { contracts };
  }
  if (!ref || (!ref.fileName && !ref.groupId)) {
    return {
      apeFileName: '',
      apeFileGroupId: '',
      apeFileGroupTitle: '',
      apeFileSourcePath: '',
    };
  }
  return {
    apeFileName: ref.fileName || '',
    apeFileGroupId: ref.groupId || '',
    apeFileGroupTitle: ref.groupTitle || '',
    apeFileSourcePath: ref.sourcePath || '',
  };
}

/**
 * Προσθήκη/αντικατάσταση αρχείου ΑΠΕ σε fileGroups.
 * @returns {{ fileGroups: object[], groupId: string }}
 */
export function mergeApeFileIntoFileGroups(fileGroups = [], {
  groupId = '',
  groupTitle = '',
  fileName = '',
  sourcePath = '',
  previousFileName = '',
} = {}) {
  const safeName = sanitizeFileName(fileName);
  if (!safeName) {
    return { fileGroups: [...(fileGroups || [])], groupId: groupId || '' };
  }

  const groups = [...(fileGroups || [])];
  let idx = groupId ? groups.findIndex((g) => g.id === groupId) : -1;
  if (idx < 0 && groupTitle) {
    idx = groups.findIndex((g) => String(g.title || '').trim() === String(groupTitle).trim());
  }

  const fileEntry = sourcePath
    ? { path: sourcePath, name: safeName }
    : { name: safeName };

  const dropName = (files, nameToDrop) => (files || []).filter((f) => fileEntryName(f) !== nameToDrop);

  if (idx >= 0) {
    const group = groups[idx];
    let files = [...(group.files || [])];
    if (previousFileName) files = dropName(files, previousFileName);
    files = dropName(files, safeName);
    files.push(fileEntry);
    groups[idx] = {
      ...group,
      title: groupTitle || group.title,
      files,
    };
    return { fileGroups: groups, groupId: group.id };
  }

  const newId = groupId || uuidv4();
  groups.push({
    id: newId,
    title: groupTitle || 'ΑΠΕ',
    files: [fileEntry],
  });
  return { fileGroups: groups, groupId: newId };
}

export function removeApeFileFromFileGroups(fileGroups = [], { groupId = '', fileName = '' } = {}) {
  const safeName = String(fileName || '').trim();
  if (!safeName) return { fileGroups: [...(fileGroups || [])] };

  const groups = (fileGroups || []).map((group) => {
    if (groupId && group.id !== groupId) return group;
    const files = (group.files || []).filter((f) => fileEntryName(f) !== safeName);
    return { ...group, files };
  }).filter((group) => (group.files || []).length > 0);

  return { fileGroups: groups };
}

/** @returns {{ khmdhsAmount: string, apeAmount: string, comments: string, sourceAdam: string, diavgeiaAda: string, documentDate?: string }} */
export function readContractApeFields(project, arrayIndex = 0, entryId = null) {
  if (!project) {
    return { khmdhsAmount: '', apeAmount: '', comments: '', sourceAdam: '', diavgeiaAda: '', documentDate: '' };
  }
  const rawKhmdhs = isMultipleContractsForm(project.implementationForm)
    ? String(project.contracts?.[arrayIndex]?.amount || '').trim()
    : String(project.contractAmount || '').trim();
  const sanityRef = getKhmdhsAmountSanityReference(project);
  const khmdhsAmount = normalizeProjectAmountForStorage(rawKhmdhs, sanityRef) || rawKhmdhs;
  if (entryId) {
    return fieldsFromApeEntry(findContractApeEntry(project, arrayIndex, entryId), khmdhsAmount);
  }
  return fieldsFromApeEntry(getLatestContractApeEntry(project, arrayIndex), khmdhsAmount);
}

export function hasContractApe(project, arrayIndex = 0) {
  return !!getLatestContractApeAmount(project, arrayIndex);
}

/** Υπάρχουν καταχωρημένα στοιχεία ΑΠΕ (ποσό ή επιπλέον μεταδεδομένα). */
export function hasApeEntryData(project, target = {}) {
  if (!project) return false;
  const kind = target?.kind || 'contract';
  const arrayIndex = target?.arrayIndex ?? 0;
  const entryId = target?.entryId || null;
  if (kind === 'contract') {
    if (entryId) return hasContractApeEntryData(findContractApeEntry(project, arrayIndex, entryId));
    return listContractApeEntries(project, arrayIndex).some(hasContractApeEntryData);
  }
  const fields = readSupplementaryApeFields(project, arrayIndex);
  const file = readApeFileRef(project, { kind, arrayIndex });
  const row = project?.supplementaryContracts?.[arrayIndex] || {};
  return !!(
    String(fields.apeAmount || '').trim()
    || String(fields.sourceAdam || '').trim()
    || String(fields.diavgeiaAda || '').trim()
    || String(file.fileName || '').trim()
    || row.apeRecorded === true
  );
}

export function shouldShowApeSubCard(project, target = {}, stageEntry = null) {
  if (target?.kind === 'supplementary' && stageEntry && !isSupplementaryApeEligible(stageEntry)) {
    return false;
  }
  if (target?.kind === 'contract') {
    return listContractApeEntries(project, target?.arrayIndex ?? 0).length > 0;
  }
  return hasApeEntryData(project, target);
}

export function buildApeCardSummary(project, target = {}) {
  if (target?.kind === 'contract' && target?.entryId) {
    const fields = readContractApeFields(project, target.arrayIndex ?? 0, target.entryId);
    const parts = [];
    const fmt = formatApeAmountDisplay(fields.apeAmount, fields.khmdhsAmount);
    if (fmt) parts.push(`ΑΠΕ: ${fmt} €`);
    const file = readApeFileRef(project, target);
    if (file.fileName) parts.push(`📎 ${file.fileName}`);
    if (fields.diavgeiaAda) parts.push(`Διαύγεια: ${fields.diavgeiaAda}`);
    return parts.join(' · ');
  }
  return buildApeSummarySuffix(project, {
    kind: target?.kind || 'contract',
    arrayIndex: target?.arrayIndex ?? 0,
  });
}

/** @returns {object} patched project slice */
export function applyContractApeFields(project, arrayIndex, {
  apeAmount, comments, sourceAdam, diavgeiaAda, documentDate, entryId = null,
}) {
  const khmdhsRef = readContractApeFields(project, arrayIndex).khmdhsAmount;
  const sanityRef = getKhmdhsAmountSanityReference(project);
  const amount = normalizeAmountInput(apeAmount, khmdhsRef, sanityRef);
  const note = String(comments || '').trim();
  const adam = String(sourceAdam || '').trim().toUpperCase();
  const ada = normalizeDiavgeiaAda(diavgeiaAda);
  const date = String(documentDate || '').slice(0, 10);
  const now = new Date().toISOString();
  const slice = getContractApeSlice(project, arrayIndex);
  const rawEntries = Array.isArray(slice.apeEntries)
    ? slice.apeEntries.map(normalizeApeEntryRow)
    : [];
  let nextEntries;

  if (entryId) {
    const entries = rawEntries.length
      ? rawEntries
      : listContractApeEntries(project, arrayIndex);
    nextEntries = entries.map((row) => (
      row.id === entryId
        ? normalizeApeEntryRow({
          ...row,
          documentDate: date || row.documentDate,
          apeAmount: amount,
          comments: note,
          apeSourceAdam: adam,
          apeDiavgeiaAda: ada,
          updatedAt: now,
        })
        : row
    ));
  } else {
    const newRow = normalizeApeEntryRow({
      documentDate: date,
      apeAmount: amount,
      comments: note,
      apeSourceAdam: adam,
      apeDiavgeiaAda: ada,
      createdAt: now,
      updatedAt: now,
    });
    nextEntries = rawEntries.length ? [...rawEntries, newRow] : [newRow];
  }

  return writeContractApeEntries(project, arrayIndex, nextEntries);
}

/**
 * Μετά ανάκτηση ΚΗΜΔΗΣ: συγχρονίζει preserved ΑΠΕ στο apeEntries[] (όχι μόνο στο legacy πεδίο).
 */
export function syncPreservedContractApeAmount(
  form,
  arrayIndex = 0,
  preservedAmount = '',
  referenceForm = form,
) {
  const amount = String(preservedAmount || '').trim();
  if (!isMeaningfulApeAmount(amount)) return {};
  if (!hasRealStoredContractApe(referenceForm || form, arrayIndex)) return {};

  const slice = getContractApeSlice(form, arrayIndex);
  const refSlice = getContractApeSlice(referenceForm || form, arrayIndex);
  const rawEntries = Array.isArray(slice.apeEntries) ? slice.apeEntries.map(normalizeApeEntryRow) : [];

  if (!rawEntries.length) {
    return writeContractApeEntries(form, arrayIndex, [normalizeApeEntryRow({
      documentDate: refSlice.apeDocumentDate || slice.contractDate || slice.date || form.contractDate || '',
      apeAmount: amount,
      comments: refSlice.apeComments || '',
      apeSourceAdam: refSlice.apeSourceAdam || '',
      apeDiavgeiaAda: refSlice.apeDiavgeiaAda || '',
      apeFileName: refSlice.apeFileName || '',
      apeFileGroupId: refSlice.apeFileGroupId || '',
      apeFileGroupTitle: refSlice.apeFileGroupTitle || '',
      apeFileSourcePath: refSlice.apeFileSourcePath || '',
    })]);
  }

  const needsFill = rawEntries.some((entry) => !String(entry.apeAmount || '').trim());
  if (!needsFill) return {};

  const filled = rawEntries.map((entry, idx) => {
    if (String(entry.apeAmount || '').trim()) return entry;
    if (rawEntries.length === 1 || idx === rawEntries.length - 1) {
      return normalizeApeEntryRow({ ...entry, apeAmount: amount });
    }
    return entry;
  });
  return writeContractApeEntries(form, arrayIndex, filled);
}

export function clearContractApeFields(project, arrayIndex = 0, entryId = null) {
  if (!entryId) {
    return writeContractApeEntries(project, arrayIndex, []);
  }
  const entries = listContractApeEntries(project, arrayIndex).filter((row) => row.id !== entryId);
  return writeContractApeEntries(project, arrayIndex, entries);
}

/** @returns {{ khmdhsAmount: string, apeAmount: string, comments: string, sourceAdam: string, diavgeiaAda: string }} */
export function readSupplementaryApeFields(project, arrayIndex = 0) {
  const row = project?.supplementaryContracts?.[arrayIndex] || {};
  return {
    khmdhsAmount: String(row.amount || '').trim(),
    apeAmount: String(row.apeAmount || '').trim(),
    comments: readSupplementaryApeComments(row),
    sourceAdam: String(row.apeSourceAdam || '').trim(),
    diavgeiaAda: String(row.apeDiavgeiaAda || '').trim(),
  };
}

export function hasSupplementaryApe(project, arrayIndex = 0) {
  return hasApeEntryData(project, { kind: 'supplementary', arrayIndex });
}

export function applySupplementaryApeFields(project, arrayIndex, { apeAmount, comments, sourceAdam, diavgeiaAda }) {
  const khmdhsRef = readSupplementaryApeFields(project, arrayIndex).khmdhsAmount;
  const amount = normalizeAmountInput(apeAmount, khmdhsRef);
  const note = String(comments || '').trim();
  const adam = String(sourceAdam || '').trim().toUpperCase();
  const ada = normalizeDiavgeiaAda(diavgeiaAda);
  const supplementaryContracts = [...(project.supplementaryContracts || [])];
  while (supplementaryContracts.length <= arrayIndex) {
    supplementaryContracts.push({ date: '', amount: '', comments: '' });
  }
  supplementaryContracts[arrayIndex] = {
    ...supplementaryContracts[arrayIndex],
    apeAmount: amount,
    apeRecorded: !!amount,
    apeComments: note,
    apeSourceAdam: adam,
    apeDiavgeiaAda: ada,
  };
  return { supplementaryContracts };
}

export function clearSupplementaryApeFields(project, arrayIndex = 0) {
  const supplementaryContracts = [...(project.supplementaryContracts || [])];
  if (!supplementaryContracts[arrayIndex]) return {};
  supplementaryContracts[arrayIndex] = writeApeFileRefToRow({
    ...supplementaryContracts[arrayIndex],
    apeAmount: '',
    apeRecorded: false,
    apeComments: '',
    apeSourceAdam: '',
    apeDiavgeiaAda: '',
  }, null);
  return { supplementaryContracts };
}

/**
 * Εφαρμογή ποσού/σχολίων και προαιρετικού αρχείου ΑΠΕ.
 * @param {object} project
 * @param {{ kind: 'contract'|'supplementary', arrayIndex: number, title?: string }} target
 * @param {{ apeAmount: string, comments?: string, file?: { sourcePath?: string, fileName?: string, groupTitle?: string }|null }} payload
 */
export function applyApeEntryToProject(project, target, payload) {
  const kind = target?.kind || 'contract';
  const arrayIndex = target?.arrayIndex ?? 0;
  const entryId = target?.entryId || null;
  const amountPatch = kind === 'supplementary'
    ? applySupplementaryApeFields(project, arrayIndex, payload)
    : applyContractApeFields(project, arrayIndex, { ...payload, entryId });

  let next = { ...project, ...amountPatch };
  const previousRef = readApeFileRef(project, { kind, arrayIndex, entryId });

  const resolvedEntryId = kind === 'contract'
    ? (entryId || getLatestContractApeEntry(next, arrayIndex)?.id || null)
    : null;

  if (payload?.file === null) {
    const { fileGroups } = removeApeFileFromFileGroups(next.fileGroups, {
      groupId: previousRef.groupId,
      fileName: previousRef.fileName,
    });
    next = { ...next, fileGroups };
    if (kind === 'contract' && resolvedEntryId) {
      const entries = listContractApeEntries(next, arrayIndex).map((row) => (
        row.id === resolvedEntryId ? writeApeFileRefToRow(row, null) : row
      ));
      next = { ...next, ...writeContractApeEntries(next, arrayIndex, entries) };
    } else {
      next = {
        ...next,
        ...applyApeFileRefToProjectSlice(next, kind, arrayIndex, null),
      };
    }
  } else {
    const file = payload?.file;
    if (file && (file.sourcePath || file.fileName)) {
      const fileName = sanitizeFileName(
        file.fileName || buildDefaultApeFileName(target?.title, file.sourcePath)
      );
      const groupTitle = String(
        file.groupTitle || previousRef.groupTitle || buildDefaultApeFileGroupTitle(target?.title)
      ).trim();
      const { fileGroups, groupId } = mergeApeFileIntoFileGroups(next.fileGroups, {
        groupId: previousRef.groupId,
        groupTitle,
        fileName,
        sourcePath: file.sourcePath || previousRef.sourcePath || '',
        previousFileName: previousRef.fileName,
      });
      next = { ...next, fileGroups };
      const fileRef = { fileName, groupId, groupTitle, sourcePath: file.sourcePath || '' };
      if (kind === 'contract' && resolvedEntryId) {
        const entries = listContractApeEntries(next, arrayIndex).map((row) => (
          row.id === resolvedEntryId ? writeApeFileRefToRow(row, fileRef) : row
        ));
        next = { ...next, ...writeContractApeEntries(next, arrayIndex, entries) };
      } else {
        next = {
          ...next,
          ...applyApeFileRefToProjectSlice(next, kind, arrayIndex, fileRef),
        };
      }
    }
  }

  const registryPatch = mergeApeIntoDocumentRegistry(next, target, {
    targetTitle: target?.title || '',
    sourceAdam: payload?.sourceAdam || '',
    diavgeiaAda: payload?.diavgeiaAda || '',
    diavgeiaPreview: payload?.diavgeiaPreview || null,
    khmdhsMeta: payload?.khmdhsMeta || null,
  });
  next = { ...next, ...registryPatch };

  return next;
}

/** Πλήρης αφαίρεση ΑΠΕ (ποσό, σχόλια, αρχείο) */
export function clearApeEntryFromProject(project, target) {
  const kind = target?.kind || 'contract';
  const arrayIndex = target?.arrayIndex ?? 0;
  const entryId = target?.entryId || null;
  const previousRef = readApeFileRef(project, { kind, arrayIndex, entryId });
  const amountPatch = kind === 'supplementary'
    ? clearSupplementaryApeFields(project, arrayIndex)
    : clearContractApeFields(project, arrayIndex, entryId);
  const { fileGroups } = removeApeFileFromFileGroups(project.fileGroups, {
    groupId: previousRef.groupId,
    fileName: previousRef.fileName,
  });
  return {
    ...amountPatch,
    fileGroups,
    ...(kind === 'supplementary'
      ? applyApeFileRefToProjectSlice({ ...project, ...amountPatch }, kind, arrayIndex, null)
      : {}),
    ...removeApeFromDocumentRegistry(project, target),
  };
}

export function buildApeSummarySuffix(project, { kind, arrayIndex }) {
  const parts = [];
  if (kind === 'contract') {
    const { apeAmount, khmdhsAmount } = readContractApeFields(project, arrayIndex);
    const fmt = formatApeAmountDisplay(apeAmount, khmdhsAmount);
    if (fmt) parts.push(`ΑΠΕ: ${fmt} €`);
    const latest = getLatestContractApeEntry(project, arrayIndex);
    if (latest?.apeFileName) parts.push(`📎 ${latest.apeFileName}`);
    if (latest?.apeDiavgeiaAda) parts.push(`Διαύγεια: ${latest.apeDiavgeiaAda}`);
  } else if (kind === 'supplementary') {
    const { apeAmount, khmdhsAmount } = readSupplementaryApeFields(project, arrayIndex);
    const fmt = formatApeAmountDisplay(apeAmount, khmdhsAmount);
    if (fmt) parts.push(`ΑΠΕ: ${fmt} €`);
    if (hasApeFile(project, { kind, arrayIndex })) {
      const { fileName } = readApeFileRef(project, { kind, arrayIndex });
      if (fileName) parts.push(`📎 ${fileName}`);
    }
    const { diavgeiaAda } = readSupplementaryApeFields(project, arrayIndex);
    if (diavgeiaAda) parts.push(`Διαύγεια: ${diavgeiaAda}`);
  }
  return parts.join(' · ');
}

/** Ημερομηνία εγγράφου (YYYY-MM-DD) από προεπισκόπηση ανάκτησης ΚΗΜΔΗΣ. */
export function apeDocumentDateFromKhmdhsPreview(preview) {
  if (!preview) return '';
  return toIsoDateOnly(preview.signedDate || preview.signedDateDisplay || '');
}

/** Ημερομηνία εγγράφου (YYYY-MM-DD) από προεπισκόπηση Διαύγειας. */
export function apeDocumentDateFromDiavgeiaPreview(preview) {
  if (!preview) return '';
  return toIsoDateOnly(preview.issueDate || preview.issueDateDisplay || '');
}

export function formatApeAmountForStorage(value, contractReference = '') {
  const n = typeof value === 'number' ? value : parseApeAmountValue(value, contractReference);
  if (!Number.isFinite(n) || n <= 0) {
    return String(value || '').trim();
  }
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Ζητά διευκρίνιση όταν το ποσό ΑΠΕ είναι μικρότερο από το ποσό σύμβασης αναφοράς. */
export function shouldPromptApeAmountInterpretation(enteredAmount, contractReferenceAmount, sanityReference = 0) {
  const contract = resolveProjectAmountNumeric(contractReferenceAmount, sanityReference);
  const entered = parseApeAmountValue(
    enteredAmount,
    contractReferenceAmount,
    sanityReference || contract
  );
  if (!Number.isFinite(entered) || entered <= 0) return false;
  if (!Number.isFinite(contract) || contract <= 0.5) return false;
  return entered + 0.5 < contract;
}

/**
 * @param {'total' | 'delta'} interpretation
 * total — το ποσό είναι το τελικό διαμορφωθέν
 * delta — το ποσό προστίθεται στο ποσό σύμβασης
 */
export function resolveApeTotalFromInterpretation(
  enteredAmount,
  contractReferenceAmount,
  interpretation,
  sanityReference = 0,
) {
  const contract = resolveProjectAmountNumeric(contractReferenceAmount, sanityReference);
  const entered = parseApeAmountValue(
    enteredAmount,
    contractReferenceAmount,
    sanityReference || contract
  );
  if (!Number.isFinite(entered) || entered <= 0) {
    return formatApeAmountForStorage(enteredAmount, contractReferenceAmount);
  }
  if (interpretation === 'delta' && Number.isFinite(contract) && contract > 0) {
    return formatApeAmountForStorage(Math.round((contract + entered) * 100) / 100, contractReferenceAmount);
  }
  return formatApeAmountForStorage(entered, contractReferenceAmount);
}

export function buildApeEntryModalSnapshot({
  apeAmount = '',
  comments = '',
  documentDate = '',
  fileName = '',
  groupTitle = '',
  sourcePath = '',
  fileCleared = false,
  apeAdam = '',
  diavgeiaAda = '',
  confirmedSourceAdam = '',
  confirmedDiavgeiaAda = '',
  khmdhsFetchPreview = null,
  diavgeiaFetchPreview = null,
} = {}) {
  return JSON.stringify({
    apeAmount: String(apeAmount || '').trim(),
    comments: String(comments || '').trim(),
    documentDate: String(documentDate || '').slice(0, 10),
    fileName: String(fileName || '').trim(),
    groupTitle: String(groupTitle || '').trim(),
    sourcePath: String(sourcePath || '').trim(),
    fileCleared: !!fileCleared,
    apeAdam: String(apeAdam || '').trim(),
    diavgeiaAda: String(diavgeiaAda || '').trim(),
    confirmedSourceAdam: String(confirmedSourceAdam || '').trim(),
    confirmedDiavgeiaAda: String(confirmedDiavgeiaAda || '').trim(),
    hasKhmdhsPreview: !!khmdhsFetchPreview,
    hasDiavPreview: !!diavgeiaFetchPreview,
  });
}

export function isApeEntryModalDirty(current, baseline) {
  if (!baseline) return false;
  return buildApeEntryModalSnapshot(current) !== baseline;
}

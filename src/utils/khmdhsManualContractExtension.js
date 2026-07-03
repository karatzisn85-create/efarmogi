/**
 * Χειροκίνητη παράταση λήξης σύμβασης (εκτός ΚΗΜΔΗΣ, π.χ. απόφαση δημάρχου).
 * Ίδιο μοτίβο με khmdhsApeEntry.js, χωρίς λογική ποσού/ΚΗΜΔΗΣ ΑΔΑΜ ανάκτησης —
 * το έγγραφο εξ ορισμού δεν αναρτάται στο ΚΗΜΔΗΣ.
 */

import { v4 as uuidv4 } from 'uuid';
import { isMultipleContractsForm } from './khmdhsFields';
import { normalizeDiavgeiaAda } from './diavgeiaApeFetch';
import {
  mergeApeFileIntoFileGroups,
  removeApeFileFromFileGroups,
  buildDefaultApeFileGroupTitle,
} from './khmdhsApeEntry';
import {
  mergeKhmdhsDocumentRegistry,
  annotateRegistryLinkLabels,
} from './khmdhsDocumentRegistry';

export const EXTENSION_REGISTRY_STAGE = 'EXT';

function sanitizeFileName(name) {
  return String(name || '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

function getFileExtension(name) {
  const m = /\.[^./\\]+$/.exec(String(name || ''));
  return m ? m[0] : '';
}

function basenameFromPath(filePath) {
  const parts = String(filePath || '').split(/[/\\]/);
  return parts[parts.length - 1] || '';
}

/** Προτεινόμενο όνομα αρχείου παράτασης */
export function buildDefaultExtensionFileName(targetTitle = '', sourcePath = '') {
  const ext = getFileExtension(sourcePath) || getFileExtension(basenameFromPath(sourcePath)) || '.pdf';
  const label = sanitizeFileName(`Παράταση — ${String(targetTitle || 'Σύμβαση').trim() || 'Σύμβαση'}`);
  return `${label}${ext.toLowerCase()}`;
}

function extensionEntrySortKey(entry) {
  const d = String(entry?.documentDate || '').slice(0, 10);
  if (d) return d;
  return String(entry?.createdAt || entry?.updatedAt || '').slice(0, 10) || '0000-00-00';
}

function normalizeExtensionEntryRow(entry = {}) {
  return {
    id: String(entry.id || '').trim() || uuidv4(),
    newEndDate: String(entry.newEndDate || '').slice(0, 10),
    documentDate: String(entry.documentDate || '').slice(0, 10),
    comments: String(entry.comments || '').trim(),
    diavgeiaAda: normalizeDiavgeiaAda(entry.diavgeiaAda || ''),
    fileName: String(entry.fileName || '').trim(),
    fileGroupId: String(entry.fileGroupId || '').trim(),
    fileGroupTitle: String(entry.fileGroupTitle || '').trim(),
    fileSourcePath: String(entry.fileSourcePath || '').trim(),
    createdAt: String(entry.createdAt || new Date().toISOString()),
    updatedAt: String(entry.updatedAt || new Date().toISOString()),
  };
}

function getContractSlice(project, arrayIndex = 0) {
  if (!project) return {};
  if (isMultipleContractsForm(project.implementationForm)) {
    return project.contracts?.[arrayIndex] || {};
  }
  return project;
}

/** Όλες οι καταχωρήσεις παράτασης — ταξινόμηση κατά ημερομηνία εγγράφου (παλαιότερο → νεότερο). */
export function listContractExtensionEntries(project, arrayIndex = 0) {
  const slice = getContractSlice(project, arrayIndex);
  const entries = Array.isArray(slice.contractExtensions)
    ? slice.contractExtensions.map(normalizeExtensionEntryRow)
    : [];
  return entries.sort((a, b) => extensionEntrySortKey(a).localeCompare(extensionEntrySortKey(b)));
}

export function getLatestContractExtensionEntry(project, arrayIndex = 0) {
  const entries = listContractExtensionEntries(project, arrayIndex);
  return entries.length ? entries[entries.length - 1] : null;
}

export function hasContractExtensionEntries(project, arrayIndex = 0) {
  return listContractExtensionEntries(project, arrayIndex).length > 0;
}

function findContractExtensionEntry(project, arrayIndex, entryId) {
  if (!entryId) return null;
  return listContractExtensionEntries(project, arrayIndex).find((e) => e.id === entryId) || null;
}

/** Είναι αυτή η καταχώριση η πιο πρόσφατη (κατά ημερομηνία εγγράφου); */
export function isLatestContractExtensionEntry(project, arrayIndex, entryId) {
  if (!entryId) return false;
  const latest = getLatestContractExtensionEntry(project, arrayIndex ?? 0);
  return !!latest && latest.id === entryId;
}

function writeContractExtensionEntries(project, arrayIndex, entries) {
  const normalized = entries.map(normalizeExtensionEntryRow)
    .sort((a, b) => extensionEntrySortKey(a).localeCompare(extensionEntrySortKey(b)));
  if (isMultipleContractsForm(project?.implementationForm)) {
    const contracts = [...(project.contracts || [])];
    while (contracts.length <= arrayIndex) {
      contracts.push({ date: '', amount: '', contractEndDate: '', comments: '' });
    }
    contracts[arrayIndex] = { ...contracts[arrayIndex], contractExtensions: normalized };
    return { contracts };
  }
  return { contractExtensions: normalized };
}

export function readExtensionFileRef(project, { arrayIndex = 0, entryId = null } = {}) {
  const entry = entryId
    ? findContractExtensionEntry(project, arrayIndex, entryId)
    : getLatestContractExtensionEntry(project, arrayIndex);
  return {
    fileName: String(entry?.fileName || '').trim(),
    groupId: String(entry?.fileGroupId || '').trim(),
    groupTitle: String(entry?.fileGroupTitle || '').trim(),
    sourcePath: String(entry?.fileSourcePath || '').trim(),
  };
}

/**
 * Δημιουργία/επεξεργασία καταχώρισης παράτασης.
 * @param {object} project
 * @param {number} arrayIndex
 * @param {{ newEndDate, documentDate, comments, diavgeiaAda, entryId? }} payload
 */
export function applyContractExtensionFields(project, arrayIndex, {
  newEndDate, documentDate, comments, diavgeiaAda, entryId = null,
}) {
  const endDate = String(newEndDate || '').slice(0, 10);
  const docDate = String(documentDate || '').slice(0, 10);
  const note = String(comments || '').trim();
  const ada = normalizeDiavgeiaAda(diavgeiaAda);
  const now = new Date().toISOString();
  const existing = listContractExtensionEntries(project, arrayIndex);
  let nextEntries;

  if (entryId) {
    nextEntries = existing.map((row) => (
      row.id === entryId
        ? normalizeExtensionEntryRow({
          ...row,
          newEndDate: endDate || row.newEndDate,
          documentDate: docDate || row.documentDate,
          comments: note,
          diavgeiaAda: ada,
          updatedAt: now,
        })
        : row
    ));
  } else {
    const newRow = normalizeExtensionEntryRow({
      newEndDate: endDate,
      documentDate: docDate,
      comments: note,
      diavgeiaAda: ada,
      createdAt: now,
      updatedAt: now,
    });
    nextEntries = [...existing, newRow];
  }

  return writeContractExtensionEntries(project, arrayIndex, nextEntries);
}

export function clearContractExtensionFields(project, arrayIndex = 0, entryId = null) {
  if (!entryId) {
    return writeContractExtensionEntries(project, arrayIndex, []);
  }
  const entries = listContractExtensionEntries(project, arrayIndex).filter((row) => row.id !== entryId);
  return writeContractExtensionEntries(project, arrayIndex, entries);
}

function writeFileRefToEntry(entry, ref) {
  const next = { ...entry };
  if (!ref || (!ref.fileName && !ref.groupId)) {
    next.fileName = '';
    next.fileGroupId = '';
    next.fileGroupTitle = '';
    next.fileSourcePath = '';
    return next;
  }
  next.fileName = ref.fileName || '';
  next.fileGroupId = ref.groupId || '';
  next.fileGroupTitle = ref.groupTitle || '';
  next.fileSourcePath = ref.sourcePath || '';
  return next;
}

/**
 * Εφαρμογή νέας ημερομηνίας λήξης/σχολίων και προαιρετικού αρχείου παράτασης.
 * @param {object} project
 * @param {{ arrayIndex: number, entryId?: string|null, title?: string }} target
 * @param {{ newEndDate, documentDate, comments, diavgeiaAda, diavgeiaPreview, file }} payload
 */
export function applyExtensionEntryToProject(project, target, payload) {
  const arrayIndex = target?.arrayIndex ?? 0;
  const entryId = target?.entryId || null;
  const amountPatch = applyContractExtensionFields(project, arrayIndex, { ...payload, entryId });

  let next = { ...project, ...amountPatch };
  const previousRef = readExtensionFileRef(project, { arrayIndex, entryId });
  const resolvedEntryId = entryId || getLatestContractExtensionEntry(next, arrayIndex)?.id || null;

  if (payload?.file === null) {
    const { fileGroups } = removeApeFileFromFileGroups(next.fileGroups, {
      groupId: previousRef.groupId,
      fileName: previousRef.fileName,
    });
    next = { ...next, fileGroups };
    if (resolvedEntryId) {
      const entries = listContractExtensionEntries(next, arrayIndex).map((row) => (
        row.id === resolvedEntryId ? writeFileRefToEntry(row, null) : row
      ));
      next = { ...next, ...writeContractExtensionEntries(next, arrayIndex, entries) };
    }
  } else {
    const file = payload?.file;
    if (file && (file.sourcePath || file.fileName)) {
      const fileName = sanitizeFileName(
        file.fileName || buildDefaultExtensionFileName(target?.title, file.sourcePath)
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
      if (resolvedEntryId) {
        const entries = listContractExtensionEntries(next, arrayIndex).map((row) => (
          row.id === resolvedEntryId ? writeFileRefToEntry(row, fileRef) : row
        ));
        next = { ...next, ...writeContractExtensionEntries(next, arrayIndex, entries) };
      }
    }
  }

  const registryPatch = mergeManualExtensionIntoDocumentRegistry(next, target, {
    targetTitle: target?.title || '',
    diavgeiaAda: payload?.diavgeiaAda || '',
    diavgeiaPreview: payload?.diavgeiaPreview || null,
  });
  next = { ...next, ...registryPatch };

  return next;
}

export function clearExtensionEntryFromProject(project, target) {
  const arrayIndex = target?.arrayIndex ?? 0;
  const entryId = target?.entryId || null;
  const previousRef = readExtensionFileRef(project, { arrayIndex, entryId });
  const amountPatch = clearContractExtensionFields(project, arrayIndex, entryId);
  const { fileGroups } = removeApeFileFromFileGroups(project.fileGroups, {
    groupId: previousRef.groupId,
    fileName: previousRef.fileName,
  });
  return {
    ...amountPatch,
    fileGroups,
    ...removeManualExtensionFromDocumentRegistry(project, target),
  };
}

// ── Κατάλογος εγγράφων (Διαύγεια) ───────────────────────────────────────────

export function buildManualExtensionRegistryLinkKey(target) {
  const idx = target?.arrayIndex ?? 0;
  const entryId = target?.entryId || '';
  return `ext:contract:${idx}:${entryId}`;
}

function buildDiavgeiaExtensionRegistryEntry(preview, { roleLabel = 'Παράταση', linkKey = '' } = {}) {
  const ada = normalizeDiavgeiaAda(preview?.ada);
  if (!ada) return null;
  const openUrl = preview?.documentUrl
    || `https://diavgeia.gov.gr/doc/${encodeURIComponent(ada)}`;
  return {
    id: uuidv4(),
    adam: ada,
    type: 'DIAV',
    stage: EXTENSION_REGISTRY_STAGE,
    source: 'diavgeia',
    stageLabel: 'Παράταση (Διαύγεια)',
    title: String(preview?.subject || '').trim(),
    subtitle: [preview?.organization, preview?.decisionType].filter(Boolean).join(' · '),
    amount: '',
    date: String(preview?.issueDateDisplay || preview?.issueDate || '').trim(),
    openUrl,
    roleLabel: String(roleLabel || 'Παράταση').trim(),
    linkLabel: '',
    recordedAt: '',
    chainFetchedAt: '',
    apeLinkKey: linkKey,
    isStub: false,
  };
}

export function mergeManualExtensionIntoDocumentRegistry(project, target, {
  targetTitle = '',
  diavgeiaAda = '',
  diavgeiaPreview = null,
} = {}) {
  const linkKey = buildManualExtensionRegistryLinkKey(target);
  const withoutOld = (project?.khmdhsDocumentRegistry || []).filter(
    (e) => e?.apeLinkKey !== linkKey
  );
  const roleLabel = targetTitle ? `Παράταση — ${targetTitle}` : 'Παράταση';
  const preview = diavgeiaPreview || (diavgeiaAda ? { ada: normalizeDiavgeiaAda(diavgeiaAda) } : null);
  const entry = buildDiavgeiaExtensionRegistryEntry(preview, { roleLabel, linkKey });
  if (!entry) {
    return { khmdhsDocumentRegistry: withoutOld };
  }
  return {
    khmdhsDocumentRegistry: mergeKhmdhsDocumentRegistry(withoutOld, [entry]),
  };
}

export function removeManualExtensionFromDocumentRegistry(project, target) {
  const linkKey = buildManualExtensionRegistryLinkKey(target);
  const next = (project?.khmdhsDocumentRegistry || []).filter(
    (e) => e?.apeLinkKey !== linkKey
  );
  if (next.length === (project?.khmdhsDocumentRegistry || []).length) return {};
  return { khmdhsDocumentRegistry: annotateRegistryLinkLabels(next) };
}

// ── Dirty-check για modal ────────────────────────────────────────────────

export function buildExtensionModalSnapshot({
  newEndDate = '',
  documentDate = '',
  comments = '',
  fileName = '',
  groupTitle = '',
  sourcePath = '',
  fileCleared = false,
  diavgeiaAda = '',
  confirmedDiavgeiaAda = '',
  diavgeiaFetchPreview = null,
} = {}) {
  return JSON.stringify({
    newEndDate: String(newEndDate || '').slice(0, 10),
    documentDate: String(documentDate || '').slice(0, 10),
    comments: String(comments || '').trim(),
    fileName: String(fileName || '').trim(),
    groupTitle: String(groupTitle || '').trim(),
    sourcePath: String(sourcePath || '').trim(),
    fileCleared: !!fileCleared,
    diavgeiaAda: String(diavgeiaAda || '').trim(),
    confirmedDiavgeiaAda: String(confirmedDiavgeiaAda || '').trim(),
    hasDiavPreview: !!diavgeiaFetchPreview,
  });
}

export function isExtensionModalDirty(current, baseline) {
  if (!baseline) return false;
  return buildExtensionModalSnapshot(current) !== baseline;
}

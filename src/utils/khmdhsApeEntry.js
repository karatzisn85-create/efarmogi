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
  // Σταθερό ID για migration legacy entry — ώστε οι επαναλαμβανόμενες κλήσεις
  // στο ίδιο slice να επιστρέφουν πάντα το ίδιο ID (αποφυγή UUID mismatch στο display).
  const legacyMigrationId = 'legacy-ape-0';
  return [normalizeApeEntryRow({
    id: legacyMigrationId,
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

export function findContractApeEntryBySourceAdam(project, arrayIndex, adam) {
  const norm = String(adam || '').trim().toUpperCase();
  if (!norm) return null;
  return listContractApeEntries(project, arrayIndex).find((row) => (
    String(row?.apeSourceAdam || row?.sourceAdam || '').trim().toUpperCase() === norm
  )) || null;
}

/**
 * Στόχος παραθύρου ΑΠΕ από έγγραφο αλυσίδας ΚΗΜΔΗΣ (χαρακτηρισμός).
 * Αν υπάρχει ήδη καταχώριση με τον ίδιο ΑΔΑΜ, ανοίγει για επεξεργασία.
 */
export function buildApeEntryTargetFromChainKind(project, item = {}) {
  const adam = String(item.chainAdam || item.adam || '').trim().toUpperCase();
  const arrayIndex = item.contractIndex != null && Number.isFinite(Number(item.contractIndex))
    ? Number(item.contractIndex)
    : resolveApeContractArrayIndex(project, adam);
  const existing = findContractApeEntryBySourceAdam(project, arrayIndex, adam);
  const title = String(item.title || '').trim() || 'ΑΠΕ';
  return {
    kind: 'contract',
    arrayIndex,
    title,
    entryId: existing?.id || null,
    prefillSourceAdam: adam,
    prefillApeAmount: existing ? '' : String(item.contractAmountDisplay || '').trim(),
    prefillDocumentDate: existing ? '' : String(item.contractDateIso || item.contractDate || '').slice(0, 10),
  };
}

export function getLatestContractApeEntry(project, arrayIndex = 0) {
  const entries = listContractApeEntries(project, arrayIndex);
  return entries.length ? entries[entries.length - 1] : null;
}

export function getLatestContractApeAmount(project, arrayIndex = 0) {
  return String(getLatestContractApeEntry(project, arrayIndex)?.apeAmount || '').trim();
}

/** Άθροισμα τελευταίου ΑΠΕ για εμφάνιση στην κάρτα — ελληνικά ποσά με χιλιάδες. */
export function getTotalApeAmountGross(project) {
  if (!project) return 0;
  if (isMultipleContractsForm(project.implementationForm)) {
    const rows = Array.isArray(project.contracts) ? project.contracts : [];
    return rows.reduce(
      (sum, _row, idx) => sum + parseGreekAmountString(getLatestContractApeAmount(project, idx)),
      0
    );
  }
  const latest = getLatestContractApeAmount(project, 0);
  if (latest) return parseGreekAmountString(latest);
  return parseGreekAmountString(project.apeAmount);
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

function collectFileGroupNames(fileGroups = []) {
  const names = [];
  (fileGroups || []).forEach((group) => {
    (group.files || []).forEach((file) => {
      const name = fileEntryName(file);
      if (name) names.push(name);
    });
  });
  return names;
}

function uniqueFileNameAmong(desiredName, takenNames = []) {
  const safe = sanitizeFileName(desiredName);
  if (!safe) return '';
  const taken = new Set(
    (takenNames || []).map((n) => String(n || '').trim().toLowerCase()).filter(Boolean)
  );
  if (!taken.has(safe.toLowerCase())) return safe;
  const ext = getFileExtension(safe);
  const stem = ext ? safe.slice(0, -ext.length) : safe;
  let n = 1;
  let candidate = `${stem} (${n})${ext}`;
  while (taken.has(candidate.toLowerCase())) {
    n += 1;
    candidate = `${stem} (${n})${ext}`;
  }
  return candidate;
}

/** Ομάδα αρχείων υποέργου για όσα φορτώνει ο υπάλληλος χειροκίνητα για ΑΠΕ. */
export const APE_RELATED_FILES_GROUP_TITLE = 'ΣΧΕΤΙΚΑ ΑΡΧΕΙΑ ΑΠΕ';

function normalizeApeAdam(adam) {
  return String(adam || '').trim().toUpperCase().replace(/\*+$/, '');
}

function looksLikeContractFolderLabel(label = '') {
  const t = String(label || '').trim();
  if (!t) return false;
  return /σύμβαση/i.test(t) || /αρχικ/i.test(t);
}

function looksLikeSupplementaryFolderLabel(label = '') {
  const t = String(label || '').trim();
  if (!t) return false;
  return /συμπληρωματικ/i.test(t) || /παράταση/i.test(t) || /παραταση/i.test(t);
}

function apeRelatedFilesContractSuffix(target = {}) {
  const idx = Number.isFinite(Number(target?.arrayIndex)) ? Number(target.arrayIndex) : 0;
  const label = String(target?.title || '').trim();
  if (looksLikeContractFolderLabel(label)) return label;
  return `Σύμβαση ${idx + 1}`;
}

/**
 * Φάκελος χειροκίνητων αρχείων ΑΠΕ.
 * Μία σύμβαση → «ΣΧΕΤΙΚΑ ΑΡΧΕΙΑ ΑΠΕ».
 * Πολλές συμβάσεις / συμπληρωματική → ξεχωριστός φάκελος ανά σύμβαση.
 */
export function buildApeRelatedFilesGroupTitle(target = {}, project = null) {
  const kind = target?.kind || 'contract';
  const idx = Number.isFinite(Number(target?.arrayIndex)) ? Number(target.arrayIndex) : 0;
  const label = String(target?.title || '').trim();
  const multi = isMultipleContractsForm(project?.implementationForm)
    || (Array.isArray(project?.contracts) && project.contracts.length > 1);

  if (kind === 'supplementary') {
    const suffix = looksLikeSupplementaryFolderLabel(label) ? label : `Συμπληρωματική ${idx + 1}`;
    return `${APE_RELATED_FILES_GROUP_TITLE} — ${suffix}`;
  }
  if (multi) {
    return `${APE_RELATED_FILES_GROUP_TITLE} — ${apeRelatedFilesContractSuffix(target)}`;
  }
  return APE_RELATED_FILES_GROUP_TITLE;
}

/** Πλησιέστερη κύρια/παράλληλη σύμβαση στην κατανομή SYMV πριν από τον ΑΠΕ. */
function resolveApeIndexFromSymvPlan(form, apeAdam) {
  const items = form?.khmdhsSymvChainPlan?.items || [];
  const rows = Array.isArray(form?.contracts) ? form.contracts : [];
  if (!items.length || !rows.length) return null;

  let lastContractAdam = '';
  for (const item of items) {
    const adam = normalizeApeAdam(item?.adam);
    const role = String(item?.role || '').trim();
    if (!adam) continue;
    if (role === 'main' || role === 'parallel') lastContractAdam = adam;
    if (adam === apeAdam && role === 'ape' && lastContractAdam) {
      const idx = rows.findIndex((row) => normalizeApeAdam(row?.khmdhsAdam) === lastContractAdam);
      return idx >= 0 ? idx : null;
    }
  }
  return null;
}

/** Σε ποια γραμμή σύμβασης ανήκει ο ΑΠΕ (ΑΔΑΜ σύμβασης, κατανομή, καταχώριση). */
export function resolveApeContractArrayIndex(form, adam) {
  const norm = normalizeApeAdam(adam);
  if (!form || !norm) return 0;
  const rows = Array.isArray(form.contracts) ? form.contracts : [];
  const multi = isMultipleContractsForm(form.implementationForm) || rows.length > 1;
  if (!multi) return 0;

  for (let i = 0; i < rows.length; i += 1) {
    if (normalizeApeAdam(rows[i]?.khmdhsAdam) === norm) return i;
  }

  const fromPlan = resolveApeIndexFromSymvPlan(form, norm);
  if (fromPlan != null) return fromPlan;

  for (let i = 0; i < rows.length; i += 1) {
    if (findContractApeEntryBySourceAdam(form, i, adam)) return i;
  }

  const historyHits = [];
  rows.forEach((row, i) => {
    const hist = row?.khmdhsContractChainHistory || [];
    if (hist.some((h) => normalizeApeAdam(h?.adam) === norm)) historyHits.push(i);
  });
  if (historyHits.length === 1) return historyHits[0];

  return 0;
}

/** Όνομα όπως το επέλεξε ο υπάλληλος — όχι υποχρεωτικά «ΑΠΕ — τίτλος». */
export function pickedApeFileNameFromPath(sourcePath = '') {
  return sanitizeFileName(basenameFromPath(sourcePath))
    || buildDefaultApeFileName('', sourcePath);
}

/** Σταθερός φάκελος χειροκίνητων αρχείων ΑΠΕ όταν υπάρχει μία σύμβαση. */
export function buildDefaultApeFileGroupTitle(_targetTitle = '') {
  return APE_RELATED_FILES_GROUP_TITLE;
}

/** Προτεινόμενος τίτλος ομάδας για χειροκίνητη παράταση. */
export function buildDefaultExtensionFileGroupTitle(targetTitle = '') {
  return String(targetTitle || 'Σύμβαση').trim() || 'Σύμβαση';
}

function resolveApeRelatedFilesGroupId(fileGroups = [], previousGroupId = '', groupTitle = '') {
  const wanted = String(groupTitle || APE_RELATED_FILES_GROUP_TITLE).trim()
    || APE_RELATED_FILES_GROUP_TITLE;
  const groups = Array.isArray(fileGroups) ? fileGroups : [];
  const byTitle = groups.find((g) => String(g?.title || '').trim() === wanted);
  if (byTitle?.id) return byTitle.id;
  if (!previousGroupId) return '';
  const prev = groups.find((g) => g?.id === previousGroupId);
  if (prev && String(prev.title || '').trim() === wanted) return prev.id;
  return '';
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

function makeApeFileEntry(sourcePath, fileName) {
  const safeName = sanitizeFileName(fileName);
  if (!safeName) return null;
  return sourcePath
    ? { path: sourcePath, name: safeName }
    : { name: safeName };
}

/**
 * Προσθήκη/αντικατάσταση αρχείου ΑΠΕ σε fileGroups.
 * Τα extraFiles προστίθενται δίπλα — δεν αντικαθιστούν το κύριο ούτε άλλα αρχεία της ομάδας.
 * @returns {{ fileGroups: object[], groupId: string }}
 */
export function mergeApeFileIntoFileGroups(fileGroups = [], {
  groupId = '',
  groupTitle = '',
  fileName = '',
  sourcePath = '',
  previousFileName = '',
  extraFiles = [],
} = {}) {
  const extras = Array.isArray(extraFiles) ? extraFiles : [];
  const primary = makeApeFileEntry(sourcePath, fileName);
  if (!primary && extras.length === 0) {
    return { fileGroups: [...(fileGroups || [])], groupId: groupId || '' };
  }

  const groups = [...(fileGroups || [])];
  let idx = groupId ? groups.findIndex((g) => g.id === groupId) : -1;
  if (idx < 0 && groupTitle) {
    idx = groups.findIndex((g) => String(g.title || '').trim() === String(groupTitle).trim());
  }

  const dropName = (files, nameToDrop) => {
    const needle = String(nameToDrop || '').trim();
    if (!needle) return files || [];
    return (files || []).filter((f) => fileEntryName(f) !== needle);
  };

  const appendUnique = (files, entry, groupsForUnique) => {
    if (!entry) return files;
    const uniqueName = uniqueFileNameAmong(entry.name, [
      ...collectFileGroupNames(groupsForUnique),
      ...files.map((f) => fileEntryName(f)),
    ].filter(Boolean));
    if (!uniqueName) return files;
    const named = entry.path
      ? { path: entry.path, name: uniqueName }
      : { name: uniqueName };
    return [...files, named];
  };

  if (idx >= 0) {
    const group = groups[idx];
    const ensuredId = group.id || groupId || uuidv4();
    let files = [...(group.files || [])];
    if (primary) {
      if (previousFileName) files = dropName(files, previousFileName);
      files = dropName(files, primary.name);
      files.push(primary);
    }
    extras.forEach((extra) => {
      const entry = makeApeFileEntry(extra?.sourcePath, extra?.fileName);
      files = appendUnique(files, entry, groups.map((g, i) => (i === idx ? { ...g, files } : g)));
    });
    groups[idx] = {
      ...group,
      id: ensuredId,
      title: groupTitle || group.title,
      files,
    };
    return { fileGroups: groups, groupId: ensuredId };
  }

  const newId = groupId || uuidv4();
  let files = primary ? [primary] : [];
  extras.forEach((extra) => {
    const entry = makeApeFileEntry(extra?.sourcePath, extra?.fileName);
    files = appendUnique(files, entry, [{ id: newId, files }]);
  });
  groups.push({
    id: newId,
    title: groupTitle || 'ΑΠΕ',
    files,
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
    if (file && (file.sourcePath || file.fileName || (file.extraFiles || []).length)) {
      const hasPrimary = !!(file.fileName || file.sourcePath);
      const extrasOnly = !hasPrimary && (file.extraFiles || []).length > 0;
      const fileName = sanitizeFileName(
        file.fileName
        || (file.sourcePath ? buildDefaultApeFileName(target?.title, file.sourcePath) : '')
      );
      const groupTitle = buildApeRelatedFilesGroupTitle(target, next);
      const { fileGroups, groupId } = mergeApeFileIntoFileGroups(next.fileGroups, {
        groupId: resolveApeRelatedFilesGroupId(next.fileGroups, extrasOnly ? '' : previousRef.groupId, groupTitle),
        groupTitle,
        fileName,
        sourcePath: file.sourcePath || (extrasOnly ? '' : previousRef.sourcePath) || '',
        previousFileName: extrasOnly ? '' : previousRef.fileName,
        extraFiles: file.extraFiles || [],
      });
      next = { ...next, fileGroups };
      const keepAutoApeRef = extrasOnly && !!(previousRef.fileName || previousRef.groupId);
      if (keepAutoApeRef) {
        const currentRef = readApeFileRef(next, { kind, arrayIndex, entryId: resolvedEntryId });
        if (!currentRef.fileName && !currentRef.groupId) {
          if (kind === 'contract' && resolvedEntryId) {
            const entries = listContractApeEntries(next, arrayIndex).map((row) => (
              row.id === resolvedEntryId ? writeApeFileRefToRow(row, previousRef) : row
            ));
            next = { ...next, ...writeContractApeEntries(next, arrayIndex, entries) };
          } else {
            next = {
              ...next,
              ...applyApeFileRefToProjectSlice(next, kind, arrayIndex, previousRef),
            };
          }
        }
      } else {
        const fileRef = extrasOnly
          ? {
            fileName: sanitizeFileName(file.extraFiles[0]?.fileName)
              || pickedApeFileNameFromPath(file.extraFiles[0]?.sourcePath),
            groupId,
            groupTitle,
            sourcePath: file.extraFiles[0]?.sourcePath || '',
          }
          : {
            fileName: fileName || previousRef.fileName,
            groupId,
            groupTitle,
            sourcePath: file.sourcePath || (fileName ? '' : previousRef.sourcePath) || '',
          };
        if (fileRef.fileName || fileRef.groupId) {
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

/**
 * Καταχώριση ΑΠΕ στην κάρτα από ρόλους κατανομής SYMV (ποσό/ημ/νία/ΑΔΑΜ).
 * Χωρίς αυτό, ο ΑΠΕ μένει μόνο στα αρχεία ΚΗΜΔΗΣ και δεν φαίνεται στις λεπτομέρειες.
 */
export function applyPlannerApeItemsToForm(form, apeItems = [], chainRes = null) {
  const items = (apeItems || []).filter((item) => String(item?.adam || '').trim());
  if (!form || !items.length) return form;

  let next = form;
  const snapshots = chainRes?.chainMeta?.contractSnapshotsByAdam || {};

  items.forEach((item) => {
    const adam = String(item.adam || '').trim().toUpperCase().replace(/\*+$/, '');
    if (!adam) return;
    const arrayIndex = resolveApeContractArrayIndex(next, adam);
    const existing = findContractApeEntryBySourceAdam(next, arrayIndex, adam);
    const snap = snapshots[adam] || snapshots[item.adam] || null;
    const plannedAmount = String(item.amount || '').trim();
    const plannedDate = String(item.date || '').slice(0, 10);
    const apeAmount = plannedAmount || String(existing?.apeAmount || '').trim();
    const documentDate = plannedDate
      || String(existing?.documentDate || '').slice(0, 10)
      || String(snap?.contractSignedDate || snap?.startDate || '').slice(0, 10);
    const multi = isMultipleContractsForm(next.implementationForm);
    const title = multi
      ? `Σύμβαση ${arrayIndex + 1}`
      : (String(snap?.title || item.title || 'ΑΠΕ').trim() || 'ΑΠΕ');

    next = applyApeEntryToProject(next, {
      kind: 'contract',
      arrayIndex,
      title,
      entryId: existing?.id || null,
    }, {
      apeAmount,
      documentDate,
      sourceAdam: adam,
      comments: String(existing?.comments || '').trim(),
      khmdhsMeta: {
        title,
        signedDate: documentDate,
        signedDateDisplay: documentDate,
      },
    });
  });

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
  extraFiles = [],
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
    extraFiles: (Array.isArray(extraFiles) ? extraFiles : []).map((f) => ({
      sourcePath: String(f?.sourcePath || '').trim(),
      fileName: String(f?.fileName || '').trim(),
    })),
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

/**
 * Καθαρισμός παλιών δεδομένων όπου τα σχόλια ΑΠΕ είχαν αντιγραφεί λάθος
 * στα γενικά σχόλια υποέργου/σύμβασης (legacy bug).
 */
export function sanitizeLegacyApeCommentsPollution(form) {
  if (!form) return form;
  let next = form;
  const rootApe = String(form.apeComments || '').trim();
  const rootComments = String(form.comments || '').trim();
  if (rootApe && rootComments === rootApe) {
    next = { ...next, comments: '' };
  }
  if (isMultipleContractsForm(form.implementationForm) && Array.isArray(form.contracts)) {
    let changed = false;
    const contracts = form.contracts.map((row) => {
      const apeNote = String(row?.apeComments || '').trim();
      const rowComments = String(row?.comments || '').trim();
      if (apeNote && rowComments === apeNote) {
        changed = true;
        return { ...row, comments: '' };
      }
      return row;
    });
    if (changed) next = { ...next, contracts };
  }
  return next;
}

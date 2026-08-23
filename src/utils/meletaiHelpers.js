import meletaiCatalog from '../../app/core/meletaiCatalog';

export function filterMeletiBudgetInput(raw) {
  return String(raw ?? '').replace(/[^\d,.\s€]/gi, '').replace(/\s+/g, ' ');
}

export function normalizeMeletiBudgetStored(value) {
  return String(value || '').trim().replace(/\s+/g, '').replace(/€/gi, '');
}

export function formatMeletiBudgetDisplay(value) {
  const s = normalizeMeletiBudgetStored(value);
  if (!s) return '—';
  return `${s} €`;
}

export function normalizeStudyApprovalDate(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * Το πεδίο «Χρεωμένη σε» παραμένει ενιαίο string (συμβατό με αναζήτηση/εξαγωγές/αναφορές)
 * αλλά μπορεί να περιέχει πάνω από ένα ονόματα, χωρισμένα με κόμμα.
 */
export function parseAssignedToNames(value) {
  return String(value || '')
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatAssignedToNames(names) {
  const seen = new Set();
  const out = [];
  (Array.isArray(names) ? names : []).forEach((raw) => {
    const name = String(raw || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(name);
  });
  return out.join(', ');
}

export function countMeletiFiles(meleti) {
  return meletaiCatalog.countMeletiFiles(meleti);
}

/** Αυστηρή μορφή: αριθμός/έτος π.χ. 2/2026 — μόνο ψηφία, μία κάθετος, έτος 4 ψηφία */
export const STUDY_NUMBER_REGEX = meletaiCatalog.STUDY_NUMBER_REGEX;
export const filterStudyNumberInput = meletaiCatalog.filterStudyNumberInput;
export const validateStudyNumberFormat = meletaiCatalog.validateStudyNumberFormat;
export const normalizeStudyNumberKey = meletaiCatalog.normalizeStudyNumberKey;

/** Μόνο πεδία κειμένου — για έλεγχο «μη αποθηκευμένες αλλαγές» (όχι αρχεία/σύνδεση που αποθηκεύονται άμεσα). */
export function meletiTextFingerprint(meleti) {
  if (!meleti) return '';
  return JSON.stringify({
    studyNumber: meleti.studyNumber || '',
    title: meleti.title || '',
    assignedTo: meleti.assignedTo || '',
    category: meleti.category || '',
    notes: meleti.notes || '',
    projectExpenditureBudget: meleti.projectExpenditureBudget || '',
    studyApprovalDate: meleti.studyApprovalDate || '',
  });
}

/** Συγχώνευση απάντησης server με τοπικές μη αποθηκευμένες αλλαγές κειμένου. */
export function mergeMeletiServerUpdate(local, server, savedTextFingerprint) {
  if (!server) return local;
  if (!local || local.id !== server.id) return server;
  if (meletiTextFingerprint(local) === savedTextFingerprint) return server;
  return {
    ...server,
    studyNumber: local.studyNumber,
    title: local.title,
    assignedTo: local.assignedTo,
    category: local.category,
    notes: local.notes,
    projectExpenditureBudget: local.projectExpenditureBudget,
    studyApprovalDate: local.studyApprovalDate,
  };
}

export function emptyMeleti(id, createdBy = '') {
  return {
    id,
    studyNumber: '',
    title: '',
    assignedTo: '',
    category: '',
    notes: '',
    projectExpenditureBudget: '',
    studyApprovalDate: '',
    linkedSubprojectId: null,
    linkedProjectTitle: '',
    linkedSubprojectTitle: '',
    fileGroups: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy,
  };
}

export function meletiPersistFingerprint(meleti) {
  return meletiTextFingerprint(meleti);
}

export function formatMeletiDisplayTitle(meleti) {
  if (!meleti) return '';
  const num = meleti.studyNumber || '';
  const title = meleti.title || '';
  if (num && title) return `${num} — ${title}`;
  return num || title || '(Χωρίς τίτλο)';
}

/** Ταξινόμηση αριθμού μελέτης (έτος, μετά αριθμός) — desc = νεότερα πρώτα */
export function parseStudyNumberSortKey(value) {
  const match = String(value || '').trim().match(STUDY_NUMBER_REGEX);
  if (!match) return { year: 0, num: 0, valid: false };
  return {
    year: parseInt(match[2], 10),
    num: parseInt(match[1], 10),
    valid: true,
  };
}

export function compareStudyNumbers(a, b, direction = 'desc') {
  const ka = parseStudyNumberSortKey(a);
  const kb = parseStudyNumberSortKey(b);
  const sign = direction === 'asc' ? 1 : -1;
  if (ka.valid && kb.valid) {
    if (ka.year !== kb.year) return sign * (ka.year - kb.year);
    if (ka.num !== kb.num) return sign * (ka.num - kb.num);
    return 0;
  }
  if (ka.valid !== kb.valid) return ka.valid ? -1 : 1;
  return String(a || '').localeCompare(String(b || ''), 'el', { numeric: true });
}

export function formatMeletiBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function getMeletiFileTypeStyle(fileName) {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  if (['pdf'].includes(ext)) return { label: 'PDF', bg: 'linear-gradient(135deg, #047857, #059669)' };
  if (['doc', 'docx'].includes(ext)) return { label: 'DOC', bg: 'linear-gradient(135deg, #2563eb, #3b82f6)' };
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { label: 'XLS', bg: 'linear-gradient(135deg, #059669, #10b981)' };
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return { label: 'IMG', bg: 'linear-gradient(135deg, #f59e0b, #fbbf24)' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { label: 'ZIP', bg: 'linear-gradient(135deg, #6b7280, #9ca3af)' };
  return { label: ext.toUpperCase().slice(0, 4) || 'FILE', bg: 'linear-gradient(135deg, #475569, #64748b)' };
}

export const MELETI_FOLDER_TYPE_STYLE = { label: '📁', bg: 'linear-gradient(135deg, #f59e0b, #d97706)' };

export function countMeletiGroupFileEntries(group) {
  return (group?.files || []).reduce((sum, entry) => {
    if (entry?.kind === 'folder') return sum + (entry.fileCount || 0);
    return sum + 1;
  }, 0);
}

export function isMeletiFolderEntry(entry) {
  return entry?.kind === 'folder';
}

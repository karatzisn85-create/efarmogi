/**
 * Ανίχνευση μη αποθηκευμένων αλλαγών στη φόρμα υποέργου.
 */
import { pickPhaseASnapshot, PHASE_A_FIELD_KEYS } from './projectFormPhases';

/** Πεδία που δεν επηρεάζουν το «αποθηκευμένο» snapshot (μόνο UI / προσωρινά). */
const FINGERPRINT_OMIT_KEYS = new Set([
  'files',
]);

function normalizeForFingerprint(value) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForFingerprint(item));
  }
  if (typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach((key) => {
      out[key] = normalizeForFingerprint(value[key]);
    });
    return out;
  }
  if (typeof value === 'boolean') return value;
  return String(value);
}

export function buildProjectFormFingerprint(formData, { selectedFilesCount = 0 } = {}) {
  if (!formData || typeof formData !== 'object') {
    return JSON.stringify({ form: null, selectedFilesCount });
  }
  const snap = {};
  Object.keys(formData).sort().forEach((key) => {
    if (FINGERPRINT_OMIT_KEYS.has(key)) return;
    snap[key] = formData[key];
  });
  return JSON.stringify({
    form: normalizeForFingerprint(snap),
    selectedFilesCount: Number(selectedFilesCount) || 0,
  });
}

function isPhaseAEmpty(formData) {
  const a = pickPhaseASnapshot(formData);
  return PHASE_A_FIELD_KEYS.every((key) => {
    const v = a[key];
    if (Array.isArray(v)) {
      return v.length === 0 || v.every((x) => !String(x).trim());
    }
    if (typeof v === 'boolean') {
      if (key === 'noKaCode') return !v;
      return !v;
    }
    if (key === 'remainingAmountYear') {
      const s = String(v || '').trim();
      return !s || s === '2026';
    }
    return !String(v || '').trim();
  });
}

/** Υπάρχει καταχωρημένο περιεχόμενο σε νέο (κενό) υποέργο; */
export function projectFormHasDraftContent(formData, selectedFiles = []) {
  if ((selectedFiles || []).length > 0) return true;
  if (!formData) return false;
  if (!isPhaseAEmpty(formData)) return true;

  if (formData.assignmentProcedure) return true;
  if (formData.contractProcessStartDate) return true;
  if (formData.contractDate || formData.contractEndDate || formData.contractAmount) return true;
  if (formData.apeAmount || formData.apeComments) return true;
  if (formData.projectBudget) return true;
  if ((formData.contracts || []).some((c) => (
    c?.date || c?.amount || c?.apeAmount || c?.khmdhsAdam
  ))) return true;
  if ((formData.supplementaryContracts || []).length > 0) return true;
  if (formData.hasSupplementaryContracts) return true;
  if (sanitizeAdam(formData.khmdhsChainSeedAdam)) return true;
  if (sanitizeAdam(formData.khmdhsAdam)) return true;
  if (sanitizeAdam(formData.khmdhsNoticeAdam)) return true;
  if (formData.khmdhsContractSnapshot || formData.khmdhsNoticeSnapshot) return true;
  if ((formData.khmdhsPayments || []).length > 0) return true;
  if ((formData.khmdhsDocumentRegistry || []).length > 0) return true;
  if ((formData.khmdhsRelatedDocuments || []).length > 0) return true;
  if ((formData.fileGroups || []).some((g) => (g.files || []).length > 0)) return true;
  return false;
}

function sanitizeAdam(value) {
  return String(value || '').trim();
}

export function hasUnsavedProjectFormChanges({
  formData,
  savedFingerprint,
  selectedFiles = [],
  phaseBResetUnsaved = false,
  isNewProject = false,
} = {}) {
  if (phaseBResetUnsaved) return true;
  if (isNewProject) {
    return projectFormHasDraftContent(formData, selectedFiles);
  }
  if (!savedFingerprint) return false;
  const current = buildProjectFormFingerprint(formData, {
    selectedFilesCount: (selectedFiles || []).length,
  });
  return current !== savedFingerprint;
}

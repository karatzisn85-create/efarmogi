/** Πεδία Φάσης Α (χειροκίνητη καταχώριση) — για dirty-check & baseline */

export const PHASE_A_FIELD_KEYS = [
  'projectTitle',
  'subprojectTitle',
  'implementationForm',
  'kaCode',
  'noKaCode',
  'eisigitikiEkthesi',
  'aleCodes',
  'misPraxhsName',
  'misPraxhsCode',
  'projectType',
  'fundingSource',
  'fundingDetails',
  'coFinanced',
  'fundingSources',
  'approvedAmount',
  'remainingAmount',
  'remainingAmountYear',
  'remainingAmountComments',
  'aleRemainingAmounts',
  'comments',
  'supervisorEngineerIds',
  'supervisorChargeOutsideEngineers',
  'supervisorChargeFreePrimary',
  'supervisorChargeFreeParticipants',
  'projectStatus',
];

export function pickPhaseASnapshot(formData) {
  if (!formData || typeof formData !== 'object') return {};
  const snap = {};
  PHASE_A_FIELD_KEYS.forEach((key) => {
    const val = formData[key];
    if (Array.isArray(val)) {
      snap[key] = val.map((x) => {
        if (x == null) return '';
        if (typeof x === 'object') return JSON.stringify(x);
        return String(x);
      });
    } else if (typeof val === 'boolean') {
      snap[key] = val;
    } else {
      snap[key] = val == null ? '' : String(val);
    }
  });
  return snap;
}

export function serializePhaseASnapshot(snap) {
  return JSON.stringify(snap || {});
}

export function isPhaseADirty(formData, baselineSerialized) {
  if (!baselineSerialized) return true;
  try {
    return serializePhaseASnapshot(pickPhaseASnapshot(formData)) !== baselineSerialized;
  } catch {
    return true;
  }
}

/** Κανονικοποίηση ποσού για σύγκριση ΑΠΕ */
export function normalizeAmountForCompare(value) {
  if (value == null || value === '') return '';
  const s = String(value).trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return String(value).trim();
  return n.toFixed(2);
}

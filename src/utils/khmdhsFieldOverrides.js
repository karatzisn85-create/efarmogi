/**
 * Φάση Β — χειροκίνητες τιμές που προστατεύονται από επαναληπτικές ανακτήσεις ΚΗΜΔΗΣ.
 */

import { normalizeAmountForCompare } from './projectFormPhases';
import { isMultipleContractsForm } from './khmdhsFields';
import {
  parseContractRowFieldKey,
  contractRowFieldKey,
  KHMDHS_CONTRACT_ROW_FIELD_LABELS,
} from './khmdhsChainFormAccess';

export { contractRowFieldKey, KHMDHS_CONTRACT_ROW_FIELD_LABELS };

export const KHMDHS_OVERRIDE_FIELD_LABELS = {
  contractDate: 'Ημερομηνία σύμβασης',
  contractAmount: 'Ποσό σύμβασης',
  projectBudget: 'Προϋπολογισμός αιτήματος',
  assignmentProcedure: 'Τρόπος ανάθεσης',
  contractProcessStartDate: 'Έναρξη διαδικασίας σύμβασης',
};

const TRACKED_SCALAR_FIELDS = new Set(Object.keys(KHMDHS_OVERRIDE_FIELD_LABELS));

function normalizeAdam(adam) {
  return String(adam || '').trim().toUpperCase().replace(/\*+$/, '');
}

function normalizeCompareValue(fieldKey, value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (fieldKey.includes('amount') || fieldKey === 'projectBudget' || fieldKey === 'contractAmount') {
    const n = normalizeAmountForCompare(s);
    return n != null ? String(n) : s;
  }
  return s;
}

function valuesEqual(fieldKey, a, b) {
  return normalizeCompareValue(fieldKey, a) === normalizeCompareValue(fieldKey, b);
}

export function emptyKhmdhsUserEdits() {
  return {
    fieldOverrides: {},
    excludedChainAdams: [],
    journal: [],
  };
}

export function ensureKhmdhsUserEdits(form) {
  if (!form?.khmdhsUserEdits || typeof form.khmdhsUserEdits !== 'object') {
    return emptyKhmdhsUserEdits();
  }
  return {
    fieldOverrides: { ...(form.khmdhsUserEdits.fieldOverrides || {}) },
    excludedChainAdams: [...(form.khmdhsUserEdits.excludedChainAdams || [])],
    journal: [...(form.khmdhsUserEdits.journal || [])],
  };
}

export function buildSupplementaryOverrideKey(field, contract) {
  const adam = normalizeAdam(contract?.khmdhsAdam);
  if (adam) return `supplementary:${field}::${adam}`;
  return `supplementary:${field}::manual`;
}

export function isTrackedKhmdhsScalarField(field) {
  return TRACKED_SCALAR_FIELDS.has(field) || !!parseContractRowFieldKey(field);
}

function appendJournal(edits, entry) {
  const journal = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      ...entry,
    },
    ...(edits.journal || []),
  ].slice(0, 80);
  return { ...edits, journal };
}

/** Καταγραφή χειροκίνητης αλλαγής σε πεδίο που σχετίζεται με ΚΗΜΔΗΣ */
export function recordKhmdhsFieldOverride(form, {
  fieldKey,
  label,
  newValue,
  previousValue,
  khmdhsBaseline = previousValue,
}) {
  if (!fieldKey) return form;
  const edits = ensureKhmdhsUserEdits(form);
  const baseline = khmdhsBaseline != null ? khmdhsBaseline : previousValue;

  if (valuesEqual(fieldKey, newValue, baseline)) {
    if (!edits.fieldOverrides[fieldKey]) return form;
    const nextOverrides = { ...edits.fieldOverrides };
    delete nextOverrides[fieldKey];
    const nextEdits = appendJournal(edits, {
      action: 'revert',
      fieldKey,
      label: label || fieldKey,
      from: String(previousValue ?? ''),
      to: String(baseline ?? ''),
    });
    return {
      ...form,
      khmdhsUserEdits: { ...nextEdits, fieldOverrides: nextOverrides },
    };
  }

  const nextOverrides = {
    ...edits.fieldOverrides,
    [fieldKey]: {
      value: String(newValue ?? ''),
      khmdhsValue: String(baseline ?? ''),
      label: label || KHMDHS_OVERRIDE_FIELD_LABELS[fieldKey] || fieldKey,
      comment: edits.fieldOverrides[fieldKey]?.comment || '',
      updatedAt: new Date().toISOString(),
    },
  };
  const nextEdits = appendJournal(edits, {
    action: 'override',
    fieldKey,
    label: label || KHMDHS_OVERRIDE_FIELD_LABELS[fieldKey] || fieldKey,
    from: String(previousValue ?? ''),
    to: String(newValue ?? ''),
  });
  return {
    ...form,
    khmdhsUserEdits: { ...nextEdits, fieldOverrides: nextOverrides },
  };
}

export function addExcludedChainAdam(form, adamRaw) {
  const adam = normalizeAdam(adamRaw);
  if (!adam) return form;
  const edits = ensureKhmdhsUserEdits(form);
  if (edits.excludedChainAdams.includes(adam)) {
    return { ...form, khmdhsUserEdits: edits };
  }
  const nextEdits = appendJournal(edits, {
    action: 'exclude_adam',
    fieldKey: `chain::${adam}`,
    label: `Αφαίρεση πράξης ${adam}`,
    from: adam,
    to: '',
  });
  return {
    ...form,
    khmdhsUserEdits: {
      ...nextEdits,
      excludedChainAdams: [...nextEdits.excludedChainAdams, adam],
    },
  };
}

function applyScalarOverrideToForm(form, fieldKey, value) {
  const contractParsed = parseContractRowFieldKey(fieldKey);
  if (contractParsed) {
    const contracts = [...(form.contracts || [])];
    const { contractIndex, field } = contractParsed;
    if (contractIndex < contracts.length) {
      contracts[contractIndex] = { ...contracts[contractIndex], [field]: value };
      return { ...form, contracts };
    }
    return form;
  }
  if (fieldKey.startsWith('supplementary:')) {
    const parts = fieldKey.split('::');
    const subField = fieldKey.split(':')[1];
    const adamOrManual = parts[parts.length - 1];
    const list = [...(form.supplementaryContracts || [])];
    const idx = adamOrManual === 'manual'
      ? list.findIndex((c) => !c?.khmdhsDerived)
      : list.findIndex((c) => normalizeAdam(c?.khmdhsAdam) === adamOrManual);
    if (idx < 0) return form;
    list[idx] = { ...list[idx], [subField]: value };
    return { ...form, supplementaryContracts: list, hasSupplementaryContracts: list.length > 0 };
  }
  if (TRACKED_SCALAR_FIELDS.has(fieldKey)) {
    return { ...form, [fieldKey]: value };
  }
  return form;
}

/** Μετά από ανάκτηση ΚΗΜΔΗΣ: επαναφορά προστατευμένων τιμών και αποκλεισμένων πράξεων */
export function applyUserEditsAfterKhmdhsFetch(prevForm, fetchedForm) {
  const edits = ensureKhmdhsUserEdits(prevForm);
  const excluded = new Set((edits.excludedChainAdams || []).map(normalizeAdam));

  let next = {
    ...fetchedForm,
    khmdhsUserEdits: edits,
  };

  if (excluded.size) {
    if (isMultipleContractsForm(next.implementationForm)) {
      next.contracts = (next.contracts || []).map((row) => ({
        ...row,
        khmdhsContractChainHistory: (row.khmdhsContractChainHistory || [])
          .filter((h) => !excluded.has(normalizeAdam(h?.adam)))
          .map((h, order) => ({ ...h, order })),
        khmdhsContractAmendments: (row.khmdhsContractAmendments || [])
          .filter((h) => !excluded.has(normalizeAdam(h?.adam))),
      }));
    } else {
      next.khmdhsContractChainHistory = (next.khmdhsContractChainHistory || [])
        .filter((h) => !excluded.has(normalizeAdam(h?.adam)))
        .map((h, order) => ({ ...h, order }));
      next.khmdhsContractAmendments = (next.khmdhsContractAmendments || [])
        .filter((h) => !excluded.has(normalizeAdam(h?.adam)));
    }
    next.supplementaryContracts = (next.supplementaryContracts || [])
      .filter((c) => !c?.khmdhsAdam || !excluded.has(normalizeAdam(c.khmdhsAdam)));
    next.hasSupplementaryContracts = (next.supplementaryContracts || []).length > 0;

    // Αποκλεισμός και από εντάλματα πληρωμής (PAY) και αποφάσεις ανάληψης (COMMIT)
    if (Array.isArray(next.khmdhsPayments)) {
      next.khmdhsPayments = next.khmdhsPayments.filter(
        (p) => !excluded.has(normalizeAdam(p?.adam))
      );
    }
    if (Array.isArray(next.khmdhsCommitmentDecisions)) {
      next.khmdhsCommitmentDecisions = next.khmdhsCommitmentDecisions.filter(
        (d) => !excluded.has(normalizeAdam(d?.adam))
      );
      // Ανανέωση primary commitment αν αποκλείστηκε
      if (
        next.khmdhsCommitmentDecisions.length > 0
        && excluded.has(normalizeAdam(next.khmdhsCommitmentAdam))
      ) {
        const newPrimary = next.khmdhsCommitmentDecisions[0];
        next.khmdhsCommitmentAdam = newPrimary.adam || '';
        next.khmdhsCommitmentSnapshot = newPrimary.snapshot || null;
        next.khmdhsCommitmentFetchedAt = newPrimary.fetchedAt || '';
      } else if (
        next.khmdhsCommitmentDecisions.length === 0
        && excluded.has(normalizeAdam(next.khmdhsCommitmentAdam))
      ) {
        next.khmdhsCommitmentAdam = '';
        next.khmdhsCommitmentSnapshot = null;
        next.khmdhsCommitmentFetchedAt = '';
      }
    }
  }

  let protectedCount = 0;
  Object.entries(edits.fieldOverrides || {}).forEach(([fieldKey, override]) => {
    if (!override?.value && override?.value !== '') return;
    const incoming = readFormFieldValue(next, fieldKey);
    if (!valuesEqual(fieldKey, incoming, override.value)) {
      protectedCount += 1;
    }
    next = applyScalarOverrideToForm(next, fieldKey, override.value);
  });

  return { form: next, protectedCount };
}

function readFormFieldValue(form, fieldKey) {
  const contractParsed = parseContractRowFieldKey(fieldKey);
  if (contractParsed) {
    return form.contracts?.[contractParsed.contractIndex]?.[contractParsed.field] ?? '';
  }
  if (fieldKey.startsWith('supplementary:')) {
    const parts = fieldKey.split('::');
    const subField = fieldKey.split(':')[1];
    const adamOrManual = parts[parts.length - 1];
    const list = form.supplementaryContracts || [];
    const row = adamOrManual === 'manual'
      ? list.find((c) => !c?.khmdhsDerived)
      : list.find((c) => normalizeAdam(c?.khmdhsAdam) === adamOrManual);
    return row?.[subField] ?? '';
  }
  return form?.[fieldKey] ?? '';
}

export function hasFieldOverride(form, fieldKey) {
  if (!fieldKey) return false;
  return !!ensureKhmdhsUserEdits(form).fieldOverrides[fieldKey];
}

export function getFieldOverride(form, fieldKey) {
  return ensureKhmdhsUserEdits(form).fieldOverrides[fieldKey] || null;
}

export function countActiveFieldOverrides(form) {
  return Object.keys(ensureKhmdhsUserEdits(form).fieldOverrides || {}).length;
}

export function updateKhmdhsFieldOverrideComment(form, fieldKey, comment) {
  if (!fieldKey) return form;
  const edits = ensureKhmdhsUserEdits(form);
  const override = edits.fieldOverrides[fieldKey];
  if (!override) return form;
  return {
    ...form,
    khmdhsUserEdits: {
      ...edits,
      fieldOverrides: {
        ...edits.fieldOverrides,
        [fieldKey]: { ...override, comment: String(comment ?? '') },
      },
    },
  };
}

export function purgeOverridesForAdam(form, adamRaw) {
  const adam = normalizeAdam(adamRaw);
  if (!adam) return form;
  const edits = ensureKhmdhsUserEdits(form);
  const nextOverrides = { ...edits.fieldOverrides };
  Object.keys(nextOverrides).forEach((key) => {
    if (key.includes(`::${adam}`)) delete nextOverrides[key];
  });
  return {
    ...form,
    khmdhsUserEdits: { ...edits, fieldOverrides: nextOverrides },
  };
}

export function revertKhmdhsFieldOverride(form, fieldKey) {
  const edits = ensureKhmdhsUserEdits(form);
  const override = edits.fieldOverrides[fieldKey];
  if (!override) return form;

  const nextOverrides = { ...edits.fieldOverrides };
  delete nextOverrides[fieldKey];
  let next = applyScalarOverrideToForm(form, fieldKey, override.khmdhsValue);
  const nextEdits = appendJournal(edits, {
    action: 'revert',
    fieldKey,
    label: override.label || fieldKey,
    from: override.value,
    to: override.khmdhsValue,
  });
  next = {
    ...next,
    khmdhsUserEdits: { ...nextEdits, fieldOverrides: nextOverrides },
  };
  return next;
}

export function clearAllKhmdhsUserEdits(form) {
  return { ...form, khmdhsUserEdits: emptyKhmdhsUserEdits() };
}

export function getActiveKhmdhsOverrides(form) {
  const edits = ensureKhmdhsUserEdits(form);
  return Object.entries(edits.fieldOverrides || {}).map(([fieldKey, o]) => ({
    fieldKey,
    ...o,
  }));
}

export function formHasKhmdhsUserEdits(form) {
  const edits = form?.khmdhsUserEdits;
  if (!edits) return false;
  return (
    Object.keys(edits.fieldOverrides || {}).length > 0
    || (edits.excludedChainAdams || []).length > 0
    || (edits.journal || []).length > 0
  );
}

export function formatJournalActionLabel(entry) {
  switch (entry?.action) {
    case 'override': return 'Τροποποίηση';
    case 'revert': return 'Επαναφορά';
    case 'exclude_adam': return 'Αφαίρεση πράξης';
    default: return 'Αλλαγή';
  }
}

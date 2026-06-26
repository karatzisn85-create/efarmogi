/**
 * Έλεγχος Φάσης Γ — σχόλια overrides, ένδειξη πεδίων, σύγκριση πριν αποθήκευση.
 */
const assert = require('assert');

function emptyKhmdhsUserEdits() {
  return { fieldOverrides: {}, excludedChainAdams: [], journal: [] };
}

function ensureKhmdhsUserEdits(form) {
  if (!form?.khmdhsUserEdits) return emptyKhmdhsUserEdits();
  return {
    fieldOverrides: { ...(form.khmdhsUserEdits.fieldOverrides || {}) },
    excludedChainAdams: [...(form.khmdhsUserEdits.excludedChainAdams || [])],
    journal: [...(form.khmdhsUserEdits.journal || [])],
  };
}

function recordOverride(form, fieldKey, newValue, baseline) {
  const edits = ensureKhmdhsUserEdits(form);
  return {
    ...form,
    [fieldKey]: newValue,
    khmdhsUserEdits: {
      ...edits,
      fieldOverrides: {
        ...edits.fieldOverrides,
        [fieldKey]: {
          value: String(newValue),
          khmdhsValue: String(baseline),
          label: fieldKey,
          comment: '',
        },
      },
    },
  };
}

function hasFieldOverride(form, fieldKey) {
  return !!ensureKhmdhsUserEdits(form).fieldOverrides[fieldKey];
}

function countActiveFieldOverrides(form) {
  return Object.keys(ensureKhmdhsUserEdits(form).fieldOverrides || {}).length;
}

function updateKhmdhsFieldOverrideComment(form, fieldKey, comment) {
  const edits = ensureKhmdhsUserEdits(form);
  const override = edits.fieldOverrides[fieldKey];
  if (!override) return form;
  return {
    ...form,
    khmdhsUserEdits: {
      ...edits,
      fieldOverrides: {
        ...edits.fieldOverrides,
        [fieldKey]: { ...override, comment: String(comment || '').trim() },
      },
    },
  };
}

function testCommentOnOverride() {
  let form = recordOverride(
    { contractAmount: '55.000,00', khmdhsUserEdits: emptyKhmdhsUserEdits() },
    'contractAmount',
    '55.000,00',
    '50.000,00'
  );
  form = updateKhmdhsFieldOverrideComment(form, 'contractAmount', 'Διόρθωση μετά από έλεγχο');
  assert.strictEqual(
    form.khmdhsUserEdits.fieldOverrides.contractAmount.comment,
    'Διόρθωση μετά από έλεγχο'
  );
  console.log('OK override comment');
}

function testHasOverrideBadgeSignal() {
  const form = recordOverride(
    { contractDate: '2025-01-15', khmdhsUserEdits: emptyKhmdhsUserEdits() },
    'contractDate',
    '2025-01-20',
    '2025-01-15'
  );
  assert.ok(hasFieldOverride(form, 'contractDate'));
  assert.strictEqual(countActiveFieldOverrides(form), 1);
  console.log('OK hasFieldOverride');
}

testCommentOnOverride();
testHasOverrideBadgeSignal();
console.log('\nΦάση Γ: όλοι οι έλεγχοι πέρασαν.');

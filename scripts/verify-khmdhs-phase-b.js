/**
 * Έλεγχος Φάσης Β — προστασία χειροκίνητων τιμών μετά από ανάκτηση ΚΗΜΔΗΣ.
 */
const assert = require('assert');

function normalizeAdam(adam) {
  return String(adam || '').trim().toUpperCase().replace(/\*+$/, '');
}

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

function valuesEqual(fieldKey, a, b) {
  return String(a ?? '').trim() === String(b ?? '').trim();
}

function recordKhmdhsFieldOverride(form, { fieldKey, label, newValue, previousValue, khmdhsBaseline }) {
  const edits = ensureKhmdhsUserEdits(form);
  const baseline = khmdhsBaseline != null ? khmdhsBaseline : previousValue;
  if (valuesEqual(fieldKey, newValue, baseline)) {
    const nextOverrides = { ...edits.fieldOverrides };
    delete nextOverrides[fieldKey];
    return { ...form, khmdhsUserEdits: { ...edits, fieldOverrides: nextOverrides } };
  }
  return {
    ...form,
    [fieldKey]: newValue,
    khmdhsUserEdits: {
      ...edits,
      fieldOverrides: {
        ...edits.fieldOverrides,
        [fieldKey]: {
          value: String(newValue ?? ''),
          khmdhsValue: String(baseline ?? ''),
          label: label || fieldKey,
        },
      },
      journal: [{ action: 'override', fieldKey, label }, ...(edits.journal || [])],
    },
  };
}

function applyScalarOverrideToForm(form, fieldKey, value) {
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
    return { ...form, supplementaryContracts: list };
  }
  return { ...form, [fieldKey]: value };
}

function applyUserEditsAfterKhmdhsFetch(prevForm, fetchedForm) {
  const edits = ensureKhmdhsUserEdits(prevForm);
  const excluded = new Set((edits.excludedChainAdams || []).map(normalizeAdam));
  let next = { ...fetchedForm, khmdhsUserEdits: edits };

  if (excluded.size) {
    next.khmdhsContractChainHistory = (next.khmdhsContractChainHistory || [])
      .filter((h) => !excluded.has(normalizeAdam(h?.adam)));
    next.supplementaryContracts = (next.supplementaryContracts || [])
      .filter((c) => !c?.khmdhsAdam || !excluded.has(normalizeAdam(c.khmdhsAdam)));
  }

  let protectedCount = 0;
  Object.entries(edits.fieldOverrides || {}).forEach(([fieldKey, override]) => {
    const incoming = fieldKey.startsWith('supplementary:')
      ? (() => {
          const parts = fieldKey.split('::');
          const subField = fieldKey.split(':')[1];
          const adam = parts[parts.length - 1];
          const row = (next.supplementaryContracts || []).find(
            (c) => normalizeAdam(c?.khmdhsAdam) === adam
          );
          return row?.[subField] ?? '';
        })()
      : next[fieldKey] ?? '';
    if (!valuesEqual(fieldKey, incoming, override.value)) protectedCount += 1;
    next = applyScalarOverrideToForm(next, fieldKey, override.value);
  });

  return { form: next, protectedCount };
}

function testFieldOverrideSurvivesFetch() {
  let form = {
    contractAmount: '50.000,00',
    khmdhsAdam: '24SYMV014322448',
    khmdhsUserEdits: emptyKhmdhsUserEdits(),
  };
  form = recordKhmdhsFieldOverride(form, {
    fieldKey: 'contractAmount',
    label: 'Ποσό σύμβασης',
    newValue: '55.000,00',
    previousValue: '50.000,00',
  });
  assert.strictEqual(form.contractAmount, '55.000,00');
  assert.ok(form.khmdhsUserEdits.fieldOverrides.contractAmount);

  const fetched = {
    contractAmount: '50.000,00',
    khmdhsAdam: '24SYMV014322448',
    khmdhsContractChainHistory: [],
  };
  const { form: merged, protectedCount } = applyUserEditsAfterKhmdhsFetch(form, fetched);
  assert.strictEqual(merged.contractAmount, '55.000,00');
  assert.strictEqual(protectedCount, 1);
  console.log('OK field override survives fetch');
}

function testExcludedAdamNotReAdded() {
  const prev = {
    khmdhsUserEdits: {
      ...emptyKhmdhsUserEdits(),
      excludedChainAdams: ['25SYMV016417575'],
    },
    supplementaryContracts: [],
  };
  const fetched = {
    supplementaryContracts: [
      { khmdhsAdam: '25SYMV016417575', amount: '56.823,97', khmdhsDerived: true },
    ],
    khmdhsContractChainHistory: [
      { adam: '24SYMV014322448', isRoot: true },
      { adam: '25SYMV016417575', isRoot: false },
    ],
  };
  const { form: merged } = applyUserEditsAfterKhmdhsFetch(prev, fetched);
  assert.strictEqual(merged.supplementaryContracts.length, 0);
  assert.strictEqual(merged.khmdhsContractChainHistory.length, 1);
  console.log('OK excluded ADAM not re-added');
}

function testSupplementaryOverride() {
  const prev = {
    supplementaryContracts: [
      { khmdhsAdam: '25SYMV016417575', date: '2025-03-04', amount: '56.823,97', khmdhsDerived: true },
    ],
    khmdhsUserEdits: {
      fieldOverrides: {
        'supplementary:amount::25SYMV016417575': {
          value: '60.000,00',
          khmdhsValue: '56.823,97',
          label: 'Συμπληρωματικό ποσό',
        },
      },
      excludedChainAdams: [],
      journal: [],
    },
  };
  const fetched = {
    supplementaryContracts: [
      { khmdhsAdam: '25SYMV016417575', date: '2025-03-04', amount: '56.823,97', khmdhsDerived: true },
    ],
  };
  const { form: merged } = applyUserEditsAfterKhmdhsFetch(prev, fetched);
  assert.strictEqual(merged.supplementaryContracts[0].amount, '60.000,00');
  console.log('OK supplementary override survives fetch');
}

testFieldOverrideSurvivesFetch();
testExcludedAdamNotReAdded();
testSupplementaryOverride();
console.log('\nΦάση Β: όλοι οι έλεγχοι πέρασαν.');

/**
 * Έλεγχος Φάσης Α — διαγραφή συμπληρωματικής / πράξεων αλυσίδας.
 */
const assert = require('assert');

// CommonJS αντίγραφο για node έλεγχο (η εφαρμογή χρησιμοποιεί το src/utils module μέσω bundler)
function reviewItemKey(item) {
  if (!item?.fieldId) return '';
  if (item.chainAdam) return `${item.fieldId}::${item.chainAdam}`;
  if (item.supplementaryIndex != null) return `${item.fieldId}::supp::${item.supplementaryIndex}`;
  return `${item.fieldId}::shared`;
}

function removeSupplementaryContractFromForm(form, index) {
  const list = form?.supplementaryContracts || [];
  const removed = list[index];
  if (!removed) return form;
  const adam = String(removed.khmdhsAdam || '').trim().toUpperCase();
  let next = { ...form };
  next.supplementaryContracts = list.filter((_, i) => i !== index);
  next.hasSupplementaryContracts = next.supplementaryContracts.length > 0;
  if (adam && removed.khmdhsDerived) {
    next.khmdhsContractChainHistory = (next.khmdhsContractChainHistory || [])
      .filter((h) => String(h?.adam || '').toUpperCase() !== adam);
    next.khmdhsContractAmendments = (next.khmdhsContractAmendments || [])
      .filter((h) => String(h?.adam || '').toUpperCase() !== adam);
    if (next.khmdhsDataQualityReview) {
      next.khmdhsDataQualityReview = {
        ...next.khmdhsDataQualityReview,
        items: (next.khmdhsDataQualityReview.items || []).filter((i) => i.chainAdam !== adam),
      };
    }
  }
  return next;
}

function removeNonRootChainHistoryEntry(form, adamRaw) {
  const adam = String(adamRaw || '').trim().toUpperCase();
  const entry = (form?.khmdhsContractChainHistory || []).find((h) => String(h?.adam).toUpperCase() === adam);
  if (!entry || entry.isRoot) return form;
  const suppIdx = (form.supplementaryContracts || []).findIndex((c) => String(c?.khmdhsAdam).toUpperCase() === adam);
  if (suppIdx >= 0) return removeSupplementaryContractFromForm(form, suppIdx);
  return {
    ...form,
    khmdhsContractChainHistory: (form.khmdhsContractChainHistory || []).filter((h) => String(h?.adam).toUpperCase() !== adam),
    khmdhsContractAmendments: (form.khmdhsContractAmendments || []).filter((h) => String(h?.adam).toUpperCase() !== adam),
  };
}

function getRemovableChainHistoryEntries(form) {
  return (form?.khmdhsContractChainHistory || []).filter((h) => h?.adam && !h.isRoot);
}

function testRemoveDerivedSupplementary() {
  const form = {
    khmdhsAdam: '24SYMV014322448',
    supplementaryContracts: [
      { date: '2025-03-04', amount: '56.823,97', khmdhsAdam: '25SYMV016417575', khmdhsDerived: true },
    ],
    hasSupplementaryContracts: true,
    khmdhsContractChainHistory: [
      { order: 0, adam: '24SYMV014322448', isRoot: true, kind: 'contract' },
      { order: 1, adam: '25SYMV016417575', isRoot: false, orphanSupplementary: true, kind: 'modification' },
    ],
    khmdhsContractAmendments: [
      { adam: '25SYMV016417575' },
    ],
    khmdhsDataQualityReview: {
      items: [
        { fieldId: 'supplementaryAmount', supplementaryIndex: 0, status: 'complete', label: 'Ποσό' },
        { fieldId: 'chainKind', chainAdam: '25SYMV016417575', status: 'needs_review', label: 'Χαρακτηρισμός' },
      ],
      resolutions: {},
    },
  };

  const next = removeSupplementaryContractFromForm(form, 0);
  assert.strictEqual(next.supplementaryContracts.length, 0);
  assert.strictEqual(next.hasSupplementaryContracts, false);
  assert.strictEqual(next.khmdhsContractChainHistory.length, 1);
  assert.strictEqual(next.khmdhsContractChainHistory[0].adam, '24SYMV014322448');
  assert.strictEqual(next.khmdhsContractAmendments.length, 0);
  assert.ok(!next.khmdhsDataQualityReview.items.some((i) => i.chainAdam === '25SYMV016417575'));
  console.log('OK removeSupplementaryContractFromForm');
}

function testRemoveExtensionFromChain() {
  const form = {
    supplementaryContracts: [],
    khmdhsContractChainHistory: [
      { order: 0, adam: '24SYMV014322448', isRoot: true },
      { order: 1, adam: '24SYMV015526678', isRoot: false, kind: 'extension', label: 'Παράταση' },
    ],
    khmdhsContractAmendments: [{ adam: '24SYMV015526678' }],
  };

  const next = removeNonRootChainHistoryEntry(form, '24SYMV015526678');
  assert.strictEqual(next.khmdhsContractChainHistory.length, 1);
  assert.strictEqual(getRemovableChainHistoryEntries(next).length, 0);
  console.log('OK removeNonRootChainHistoryEntry');
}

function testCannotRemoveRoot() {
  const form = {
    khmdhsContractChainHistory: [{ adam: '24SYMV014322448', isRoot: true }],
  };
  const next = removeNonRootChainHistoryEntry(form, '24SYMV014322448');
  assert.strictEqual(next.khmdhsContractChainHistory.length, 1);
  console.log('OK root protected');
}

testRemoveDerivedSupplementary();
testRemoveExtensionFromChain();
testCannotRemoveRoot();
console.log('\nΦάση Α: όλοι οι έλεγχοι πέρασαν.');

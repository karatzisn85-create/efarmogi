import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const clf = require('../../public/khmdhsChainKindClassifier.js');

test('επιλογές χρήστη περιλαμβάνουν ΑΠΕ', () => {
  assert.deepEqual(clf.USER_CHAIN_KIND_OPTIONS, [
    'modification', 'extension', 'republication', 'ape', 'other',
  ]);
  assert.equal(clf.kindLabelEl('ape'), 'ΑΠΕ');
});

test('τίτλος ΑΠΕ προτείνει ΑΠΕ και όχι συμπληρωματική — ακόμα κι αν έχει ποσό', () => {
  const parent = { nextModified: true, title: 'Αρχική σύμβαση' };
  const child = {
    title: 'Ανακεφαλαιωτικός Πίνακας Εργασιών',
    contractBudget: 112000,
    totalCostWithVAT: 112000,
  };
  const res = clf.resolveChainNodeKind(parent, child);
  assert.equal(res.suggestedKind, 'ape');
  assert.equal(res.kind, 'ape');
  assert.equal(res.needsReview, true);
  assert.equal(clf.isChainSupplementaryCandidate({
    adam: '25SYMVAPE1',
    isRoot: false,
    suggestedKind: 'ape',
    kind: 'ape',
    contractAmount: '112.000,00',
    title: child.title,
    snapshot: child,
  }), false);
});

test('συντομογραφία ΑΠΕ στον τίτλο', () => {
  const res = clf.detectApeDocument({ title: 'Έγκριση ΑΠΕ αρ. 3' });
  assert.ok(res);
  assert.equal(res.confidence, 'high');
});

test('συμπληρωματική με ποσό δεν γίνεται ΑΠΕ χωρίς λέξη στον τίτλο', () => {
  const res = clf.resolveChainNodeKind(
    { nextModified: true },
    { title: 'Τροποποίηση σύμβασης — αύξηση ποσού', contractBudget: 5000, totalCostWithVAT: 5000 }
  );
  assert.equal(res.suggestedKind, 'modification');
  assert.equal(res.kind, 'modification');
});

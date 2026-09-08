import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ent = require('../../app/core/entaxiCatalog.js');

const sample = {
  initialAmount: '160.000,00',
  modifications: [
    { modificationId: 'm1', changeAmount: false, amount: '' },
    { modificationId: 'm2', changeAmount: true, amount: '155.285,47' },
  ],
};

test('τρέχον ποσό: η τροποποίηση αντικαθιστά, δεν προσθέτει', () => {
  assert.ok(Math.abs(ent.getEntaxiCurrentTotal(sample) - 155285.47) < 0.01);
  assert.ok(Math.abs(ent.getEntaxiCurrentTotal(sample) - 471159.47) > 1);
  assert.equal(ent.formatEntaxiAmount(ent.getEntaxiCurrentTotal(sample)), '155.285,47');
});

test('χωρίς έργο: κενός τίτλος ή κενά υποέργα', () => {
  assert.equal(ent.isEntaxiUnlinked({ projectTitle: '', subprojectIds: [] }), true);
  assert.equal(ent.isEntaxiUnlinked({ projectTitle: 'Οδικό', subprojectIds: [] }), true);
  assert.equal(ent.isEntaxiUnlinked({ projectTitle: 'Οδικό', subprojectIds: ['sub-1'] }), false);
  assert.equal(ent.isEntaxiUnlinked({
    projectTitle: '',
    linkedProjects: [{ projectId: 'p1', projectTitle: 'Οδικό' }, { projectId: 'p2', projectTitle: 'Ύδρευση' }],
    subprojectIds: ['sub-1', 'sub-2'],
  }), false);
});

test('ομαδοποίηση με κενό τίτλο πάει στις μη συσχετισμένες', () => {
  const groups = ent.groupEntaxeisByProjectTitle([
    { entaxiId: 'a', projectTitle: 'Οδικό δίκτυο Αρχανών' },
    { entaxiId: 'b', projectTitle: '' },
  ]);
  assert.equal(groups['Οδικό δίκτυο Αρχανών'].length, 1);
  assert.equal(groups[ent.UNLINKED_GROUP_TITLE][0].entaxiId, 'b');
});

test('πολλά έργα: μία κάρτα στην πρώτη ομάδα, φίλτρο έργου τη βρίσκει', () => {
  const row = {
    entaxiId: 'multi',
    linkedProjects: [
      { projectId: 'p1', projectTitle: 'Οδικό δίκτυο Αρχανών' },
      { projectId: 'p2', projectTitle: 'Ύδρευση Αστερουσίων' },
    ],
    subprojectIds: ['sub-bridge', 'sub-tank'],
  };
  const groups = ent.groupEntaxeisByProjectTitle([row]);
  assert.equal(groups['Οδικό δίκτυο Αρχανών'][0].entaxiId, 'multi');
  assert.equal(groups['Ύδρευση Αστερουσίων'], undefined);
  const filtered = ent.groupEntaxeisByProjectTitle([row], 'Ύδρευση Αστερουσίων');
  assert.equal(filtered['Ύδρευση Αστερουσίων'][0].entaxiId, 'multi');
  assert.equal(ent.entaxiLinksProjectTitle(row, 'Ύδρευση Αστερουσίων'), true);
  assert.equal(ent.entaxiLinksProjectTitle(row, 'Άλλο'), false);
  assert.equal(ent.formatEntaxiProjectTitles(row), 'Οδικό δίκτυο Αρχανών · Ύδρευση Αστερουσίων');
  const snap = ent.buildEntaxiLinkSnapshot(row.linkedProjects, row.subprojectIds);
  assert.equal(snap.projectTitle, 'Οδικό δίκτυο Αρχανών · Ύδρευση Αστερουσίων');
  assert.equal(snap.projectId, 'p1');
  assert.deepEqual(snap.subprojectIds, ['sub-bridge', 'sub-tank']);
});

test('αποθήκευση κρατά μόνο έργα με επιλεγμένα υποέργα', () => {
  const blocks = [
    { projectId: 'p1', projectTitle: 'Οδικό', subprojectIds: ['sub-bridge', 'sub-light'] },
    { projectId: 'p2', projectTitle: 'Ύδρευση', subprojectIds: ['sub-tank'] },
  ];
  const pruned = ent.pruneEntaxiLinkSnapshot(blocks, ['sub-bridge']);
  assert.equal(pruned.linkedProjects.length, 1);
  assert.equal(pruned.linkedProjects[0].projectId, 'p1');
  assert.deepEqual(pruned.subprojectIds, ['sub-bridge']);
  assert.equal(pruned.projectTitle, 'Οδικό');
  const both = ent.pruneEntaxiLinkSnapshot(blocks, ['sub-bridge', 'sub-tank']);
  assert.equal(both.linkedProjects.length, 2);
  assert.equal(both.projectTitle, 'Οδικό · Ύδρευση');
  const notReady = ent.pruneEntaxiLinkSnapshot(
    [{ projectId: 'p1', projectTitle: 'Οδικό', subprojectIds: [] }],
    ['sub-bridge']
  );
  assert.deepEqual(notReady.subprojectIds, ['sub-bridge']);
  assert.equal(notReady.linkedProjects[0].projectTitle, 'Οδικό');
});

test('ίδιο έργο: ταυτίζεται με κωδικό ή τίτλο, όχι με κενό κωδικό', () => {
  assert.equal(ent.isSameEntaxiLinkedProject(
    { projectId: '', projectTitle: 'Οδικό' },
    { projectId: '', projectTitle: 'Ύδρευση' }
  ), false);
  assert.equal(ent.isSameEntaxiLinkedProject(
    { projectId: '', projectTitle: 'Οδικό' },
    { projectId: 'p1', projectTitle: 'Οδικό' }
  ), true);
  assert.equal(ent.isSameEntaxiLinkedProject(
    { projectId: 'p1', projectTitle: 'Οδικό' },
    { projectId: 'p1', projectTitle: 'Άλλο' }
  ), true);
});

test('Νέα Ένταξη μόνο για διαχειριστή', () => {
  assert.equal(ent.showNewEntaxiButton('ADMIN'), true);
  assert.equal(ent.showNewEntaxiButton('ENGINEER'), false);
  assert.equal(ent.showNewEntaxiButton('USER'), false);
});

test('νέα ένταξη: ημερομηνία, φορέας, ποσό, θέμα και αρχείο', () => {
  const empty = ent.collectEntaxiRequiredErrors({}, { isNew: true });
  assert.equal(empty.documentDate, 'Η ημερομηνία είναι υποχρεωτική');
  assert.equal(empty.fundingAuthority, 'Ο φορέας χρηματοδότησης είναι υποχρεωτικός');
  assert.equal(empty.initialAmount, 'Το ποσό είναι υποχρεωτικό');
  assert.equal(empty.subject, 'Το θέμα είναι υποχρεωτικό');
  assert.equal(empty.entaxiPDFs, 'Τουλάχιστον ένα αρχείο ένταξης είναι υποχρεωτικό');
  const edit = ent.collectEntaxiRequiredErrors({
    documentDate: '2026-03-12',
    fundingAuthority: 'ΠΕΠ',
    initialAmount: '10',
    subject: 'Θέμα',
    entaxiPDFs: [],
  }, { isNew: false });
  assert.deepEqual(edit, {});
  const spaces = ent.collectEntaxiRequiredErrors({
    documentDate: '2026-03-12',
    fundingAuthority: 'ΠΕΠ',
    initialAmount: '10',
    subject: '  ',
    entaxiPDFs: [{ fileName: 'a.pdf' }],
  }, { isNew: true });
  assert.equal(spaces.subject, undefined);
});

test('γρήγορη αναζήτηση βρίσκει ΑΔΑ και ΟΠΣ', () => {
  const row = {
    subject: 'Μελέτη ανάπλασης',
    projectTitle: 'Αρχάνες',
    opsCode: '5225302',
    diavgeiaAda: 'ΨΩΚΖ7ΛΚ-8ΦΤ',
  };
  assert.equal(ent.entaxiMatchesQuickSearch(row, '5225302'), true);
  assert.equal(ent.entaxiMatchesQuickSearch(row, 'ΨΩΚΖ7ΛΚ-8ΦΤ'), true);
  assert.equal(ent.entaxiMatchesQuickSearch(row, 'γέφυρα'), false);
});

test('διαγραφή ένταξης χρειάζεται ταυτότητα και αφαιρεί μόνο αυτή', () => {
  assert.equal(ent.evaluateEntaxiDelete('').ok, false);
  assert.equal(ent.evaluateEntaxiDelete('ent-1').ok, true);
  assert.equal(ent.showEntaxiDeleteAction('ADMIN'), true);
  assert.equal(ent.showEntaxiDeleteAction('ENGINEER'), false);
  const next = ent.removeEntaxiFromList([
    { entaxiId: 'a' },
    { entaxiId: 'b' },
  ], 'a');
  assert.deepEqual(next.map((e) => e.entaxiId), ['b']);
});

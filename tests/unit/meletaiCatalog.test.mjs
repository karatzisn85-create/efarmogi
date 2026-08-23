import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const mlt = require('../../app/core/meletaiCatalog.js');

test('κουμπί μητρώου μελετών σε όλους τους ρόλους', () => {
  assert.equal(mlt.showMeletaiButton('ADMIN'), true);
  assert.equal(mlt.showMeletaiButton('SUPERADMIN'), true);
  assert.equal(mlt.showMeletaiButton('ENGINEER'), true);
  assert.equal(mlt.showMeletaiButton('USER'), true);
});

test('επεξεργασία: διαχειριστές πάντα· χρήστης/μηχανικός μόνο με δικαίωμα', () => {
  assert.equal(mlt.isMeletaiReadOnly({ role: 'ADMIN', meletaiCanEdit: false }), false);
  assert.equal(mlt.isMeletaiReadOnly({ role: 'USER', meletaiCanEdit: false }), true);
  assert.equal(mlt.isMeletaiReadOnly({ role: 'USER', meletaiCanEdit: true }), false);
  assert.equal(mlt.isMeletaiReadOnly({ role: 'ENGINEER', meletaiCanEdit: false }), true);
  assert.equal(mlt.canManageMeletai({ role: 'ADMIN' }), true);
  assert.equal(mlt.canManageMeletai({ role: 'USER', meletaiCanEdit: false }), false);
  assert.equal(mlt.canManageMeletai({ role: 'USER', meletaiCanEdit: true }), true);
});

test('αριθμός μελέτης: μορφή αριθμός/έτος και υποχρεωτικός τίτλος', () => {
  assert.match(mlt.evaluateNewMeleti({ studyNumber: '', title: 'Α' }).error, /αριθμός μελέτης/);
  assert.match(mlt.evaluateNewMeleti({ studyNumber: '2-2026', title: 'Α' }).error, /Μορφή/);
  assert.match(mlt.evaluateNewMeleti({ studyNumber: '2/1980', title: 'Α' }).error, /1990/);
  assert.match(mlt.evaluateNewMeleti({ studyNumber: '0/2026', title: 'Α' }).error, /θετικός/);
  assert.match(mlt.evaluateNewMeleti({ studyNumber: '2/2026', title: '' }).error, /τίτλος/);
  const ok = mlt.evaluateNewMeleti({ studyNumber: '02/2026', title: '  Ύδρευση  ' });
  assert.equal(ok.ok, true);
  assert.equal(ok.studyNumber, '2/2026');
  assert.equal(ok.title, 'Ύδρευση');
});

test('αναζήτηση: τίτλος και αριθμός ναι, όνομα αρχείου όχι', () => {
  const row = {
    studyNumber: '2/2026',
    title: 'Ύδρευση Χουδετσίου',
    assignedTo: 'Μαρία Παπαδοπούλου',
    notes: 'αναμονή τοπογραφικού',
    linkedSubprojectTitle: 'Γέφυρα Αγίου Σύλλα',
    fileGroups: [{ files: [{ name: 'ΚΑ-777-μελέτη.pdf' }] }],
  };
  assert.equal(mlt.parseMeletiSearch(row, 'Χουδετσίου'), true);
  assert.equal(mlt.parseMeletiSearch(row, '2/2026'), true);
  assert.equal(mlt.parseMeletiSearch(row, 'τοπογραφικού'), true);
  assert.equal(mlt.parseMeletiSearch(row, 'ΚΑ-777'), false);
});

test('φίλτρα: συνδεδεμένες / χωρίς αρχεία· μηχανικός συνδέει μόνο χρεωμένα', () => {
  const rows = [
    { id: 'a', title: 'Α', linkedSubprojectId: 'sub-bridge', fileGroups: [{ files: [{ name: 'α.pdf' }] }] },
    { id: 'b', title: 'Β', linkedSubprojectId: null, fileGroups: [] },
  ];
  assert.deepEqual(mlt.filterMeletaiHub(rows, { quickFilter: 'linked' }).map((r) => r.id), ['a']);
  assert.deepEqual(mlt.filterMeletaiHub(rows, { quickFilter: 'unlinked' }).map((r) => r.id), ['b']);
  assert.deepEqual(mlt.filterMeletaiHub(rows, { quickFilter: 'with_files' }).map((r) => r.id), ['a']);
  assert.deepEqual(mlt.filterMeletaiHub(rows, { quickFilter: 'without_files' }).map((r) => r.id), ['b']);
  assert.equal(mlt.canLinkSubprojectForRole({
    role: 'ENGINEER',
    visibleSubprojectIds: new Set(['sub-bridge']),
    subprojectId: 'sub-tank',
  }), false);
  assert.equal(mlt.canLinkSubprojectForRole({
    role: 'ADMIN',
    visibleSubprojectIds: new Set(['sub-bridge']),
    subprojectId: 'sub-tank',
  }), true);
});

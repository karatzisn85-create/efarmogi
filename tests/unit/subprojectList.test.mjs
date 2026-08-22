import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const list = require('../../app/core/subprojectList.js');

test('ομαδοποίηση με βάση projectId, όχι τίτλο', () => {
  const groups = list.groupSubprojectsByProjectId([
    { projectId: 'p1', subprojectId: 'a', projectTitle: 'Α', subprojectTitle: 'Γέφυρα' },
    { projectId: 'p1', subprojectId: 'b', projectTitle: 'α', subprojectTitle: 'Φωτισμός' },
    { projectId: 'p2', subprojectId: 'c', projectTitle: 'Β', subprojectTitle: 'Δεξαμενή' },
  ]);
  assert.equal(groups.p1.length, 2);
  assert.equal(groups.p2.length, 1);
});

test('τίτλος ομάδας: πιο συχνός· σε ισοπαλία ο μακρύτερος', () => {
  const title = list.pickDisplayProjectTitleForGroup([
    { projectTitle: 'Οδικό' },
    { projectTitle: 'Οδικό δίκτυο Αρχανών' },
    { projectTitle: 'Οδικό' },
  ]);
  assert.equal(title, 'Οδικό');
  const tie = list.pickDisplayProjectTitleForGroup([
    { projectTitle: 'Α' },
    { projectTitle: 'ΑΑΑ' },
  ]);
  assert.equal(tie, 'ΑΑΑ');
});

test('ΥΠΗΡΕΣΙΑ κανονικοποιείται σε ΓΕΝΙΚΕΣ ΥΠΗΡΕΣΙΕΣ', () => {
  assert.equal(list.normalizeProjectType('ΥΠΗΡΕΣΙΑ'), 'ΓΕΝΙΚΕΣ ΥΠΗΡΕΣΙΕΣ');
  assert.equal(list.projectMatchesQuickType({ projectType: 'ΥΠΗΡΕΣΙΑ' }, 'ΓΕΝΙΚΕΣ ΥΠΗΡΕΣΙΕΣ'), true);
});

test('αρχειοθετημένα κρύβονται· με το κουμπί μένουν μόνο αυτά', () => {
  const rows = [
    { subprojectId: 'a', projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ' },
    { subprojectId: 'b', projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ' },
    { subprojectId: 'c', projectStatus: 'ΑΠΕΝΤΑΓΜΕΝΟ' },
  ];
  const normal = list.applyArchivedAbandonedVisibility(rows, { showArchivedProjects: false });
  assert.deepEqual(normal.map((p) => p.subprojectId), ['a']);
  const archived = list.applyArchivedAbandonedVisibility(rows, { showArchivedProjects: true });
  assert.deepEqual(archived.map((p) => p.subprojectId), ['b']);
});

test('ρητό φίλτρο απενταγμένου: πρώτα η κατάσταση, μετά δεν τα κρύβει η ορατότητα', () => {
  const rows = [
    { subprojectId: 'a', projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ' },
    { subprojectId: 'c', projectStatus: 'ΑΠΕΝΤΑΓΜΕΝΟ' },
  ];
  const afterStatus = rows.filter((p) => list.projectMatchesQuickStatus(p, 'ΑΠΕΝΤΑΓΜΕΝΟ'));
  const shown = list.applyArchivedAbandonedVisibility(afterStatus, {
    showArchivedProjects: false,
    quickSearchStatus: 'ΑΠΕΝΤΑΓΜΕΝΟ',
  });
  assert.deepEqual(shown.map((p) => p.subprojectId), ['c']);
});

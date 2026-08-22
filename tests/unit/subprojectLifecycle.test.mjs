import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const life = require('../../app/core/subprojectLifecycle.js');

const validPhaseA = {
  projectTitle: 'Νέο έργο δοκιμής',
  subprojectTitle: 'Υποέργο δοκιμής',
  projectType: 'ΕΡΓΟ',
  projectStatus: 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ',
  fundingSource: 'ΔΗΜΟΤΙΚΟΙ ΠΟΡΟΙ',
  fundingDetails: 'ΚΑΠ',
  approvedAmount: '10000',
};

test('ΚΑ: κενό επιτρέπεται· λάθος μορφή απορρίπτεται', () => {
  assert.equal(life.validateKACode('10-2024.001'), true);
  assert.equal(life.validateKACode('ΚΑ-100'), false);
  assert.equal(life.validateKACode(''), false);
  const emptyKa = life.collectPhaseARequiredErrors(validPhaseA);
  assert.equal(emptyKa.kaCode, undefined);
  const bad = life.collectPhaseARequiredErrors({ ...validPhaseA, kaCode: 'ΚΑ-100' });
  assert.equal(bad.kaCode, 'Ο κωδικός ΚΑ πρέπει να έχει μορφή xx-xxxx.xxx');
});

test('κενή φόρμα νέου υποέργου: υποχρεωτικά Φάσης Α', () => {
  const errors = life.collectPhaseARequiredErrors({});
  assert.equal(errors.projectTitle, 'Απαιτείται τίτλος έργου');
  assert.equal(errors.subprojectTitle, 'Απαιτείται τίτλος υποέργου');
  assert.equal(errors.projectType, 'Επιλέξτε είδος');
  assert.equal(errors.fundingSource, 'Επιλέξτε πηγή χρηματοδότησης');
  assert.equal(errors.fundingDetails, 'Επιλέξτε εξειδίκευση πηγής χρηματοδότησης');
  assert.equal(errors.approvedAmount, 'Απαιτείται εγκεκριμένο ποσό');
  assert.equal(errors.projectStatus, 'Επιλέξτε κατάσταση έργου');
});

test('συμπληρωμένη Φάση Α χωρίς σφάλματα', () => {
  assert.deepEqual(life.collectPhaseARequiredErrors(validPhaseA), {});
});

test('ίδιος τίτλος έργου αγνοεί κενά και πεζά', () => {
  const projects = [{ projectId: 'proj-road', projectTitle: 'Οδικό δίκτυο Αρχανών' }];
  const found = life.findExistingProjectByTitle(projects, '  οδικό  δίκτυο   αρχανών ');
  assert.equal(found.projectId, 'proj-road');
});

test('ΝΑΙ βάζει το υπάρχον id· ΟΧΙ το αφήνει κενό', () => {
  const existing = { projectId: 'proj-road', projectTitle: 'Οδικό δίκτυο Αρχανών' };
  assert.equal(life.applyAddToExistingChoice(existing, true).projectId, 'proj-road');
  assert.equal(life.applyAddToExistingChoice(existing, false).projectId, '');
});

test('αποθήκευση χωρίς id: αν υπάρχει ίδιος τίτλος, μπαίνει στο υπάρχον — και μετά από ΟΧΙ', () => {
  const projects = [{ projectId: 'proj-road', projectTitle: 'Οδικό δίκτυο Αρχανών' }];
  const afterNo = life.applyAddToExistingChoice(projects[0], false);
  const resolved = life.resolveProjectIdWhenMissing(afterNo.projectId, 'Οδικό δίκτυο Αρχανών', projects);
  assert.equal(resolved.reusedExisting, true);
  assert.equal(resolved.projectId, 'proj-road');
});

test('διαγραφή: χωρίς ids ή με κλείδωμα απορρίπτεται', () => {
  assert.deepEqual(life.evaluateSubprojectDelete({}), { ok: false, reason: 'invalid-ids' });
  assert.deepEqual(
    life.evaluateSubprojectDelete({ projectId: 'p', subprojectId: 's', locked: true }),
    { ok: false, reason: 'locked' }
  );
  assert.deepEqual(
    life.evaluateSubprojectDelete({ projectId: 'p', subprojectId: 's' }),
    { ok: true }
  );
});

test('κουμπί διαγραφής μόνο όταν υπάρχουν και τα δύο ids', () => {
  assert.equal(life.showDeleteOnForm({}), false);
  assert.equal(life.showDeleteOnForm({ projectId: 'p' }), false);
  assert.equal(life.showDeleteOnForm({ projectId: 'p', subprojectId: 's' }), true);
});

test('αφαίρεση από τη λίστα μόνο το ζητούμενο υποέργο', () => {
  const result = life.removeSubprojectFromList(
    [
      { subprojectId: 'a', projectId: 'p1' },
      { subprojectId: 'b', projectId: 'p1' },
    ],
    'a'
  );
  assert.equal(result.changed, true);
  assert.deepEqual(result.projects.map((p) => p.subprojectId), ['b']);
});

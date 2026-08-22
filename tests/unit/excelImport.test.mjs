import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const excel = require('../../app/core/excelImport.js');

test('κουμπί εισαγωγής μόνο στον υπερδιαχειριστή', () => {
  assert.equal(excel.showExcelImportButton('SUPERADMIN'), true);
  assert.equal(excel.showExcelImportButton('ADMIN'), false);
  assert.equal(excel.showExcelImportButton('ENGINEER'), false);
  assert.equal(excel.showExcelImportButton('USER'), false);
});

test('πρόσβαση: ανενεργός ή άλλος ρόλος απορρίπτεται', () => {
  assert.equal(excel.evaluateExcelImportAccess({ actor: null }).ok, false);
  assert.equal(excel.evaluateExcelImportAccess({
    actor: { role: 'ADMIN', active: true },
  }).ok, false);
  assert.equal(excel.evaluateExcelImportAccess({
    actor: { role: 'SUPERADMIN', active: false },
  }).ok, false);
  assert.equal(excel.evaluateExcelImportAccess({
    actor: { role: 'ADMIN', active: true },
    action: 'template',
  }).error, 'Μόνο ο υπερδιαχειριστής μπορεί να δημιουργήσει το πρότυπο εισαγωγής.');
  assert.equal(excel.evaluateExcelImportAccess({
    actor: { role: 'SUPERADMIN', active: true },
  }).ok, true);
});

test('επιβεβαίωση μόνο με έγκυρες γραμμές χωρίς λάθη', () => {
  assert.equal(excel.canCommitImport(null), false);
  assert.equal(excel.canCommitImport({ parseErrors: [{ message: 'x' }], validCount: 2 }), false);
  assert.equal(excel.canCommitImport({ errorRows: [{ excelRow: 2 }], validCount: 1 }), false);
  assert.equal(excel.canCommitImport({ validCount: 0 }), false);
  assert.equal(excel.canCommitImport({ validCount: 2, parseErrors: [], errorRows: [] }), true);
  assert.equal(excel.evaluateCommitImport({ validCount: 0 }).error, 'Δεν βρέθηκαν έγκυρες γραμμές προς εισαγωγή.');
  assert.equal(excel.evaluateCommitImport({ validCount: 1 }, 'boom').error, 'Μη έγκυρη πολιτική διπλοτύπων.');
  assert.equal(excel.evaluateCommitImport({ validCount: 1 }, 'skip').ok, true);
});

test('επιλογές διατήρησης / διπλοτύπων όπως στην οθόνη', () => {
  const report = {
    existingCount: 3,
    existingDuplicates: [{ excelRow: 2 }],
  };
  assert.equal(excel.showExistingWorksChoice(report), true);
  assert.equal(excel.showDuplicatePolicyChoice(report, 'keep'), true);
  assert.equal(excel.showDuplicatePolicyChoice(report, 'wipe'), false);
  assert.equal(excel.showDuplicatePolicyChoice({ existingCount: 3, existingDuplicates: [] }, 'keep'), false);
});

test('πολιτική γραμμής: νέο / παράλειψη / ενημέρωση / δημιουργία', () => {
  assert.equal(excel.resolveRowAction({ isDuplicate: false, wipeExisting: false, duplicatePolicy: 'skip' }), 'create');
  assert.equal(excel.resolveRowAction({ isDuplicate: true, wipeExisting: true, duplicatePolicy: 'skip' }), 'create');
  assert.equal(excel.resolveRowAction({ isDuplicate: true, wipeExisting: false, duplicatePolicy: 'skip' }), 'skip');
  assert.equal(excel.resolveRowAction({ isDuplicate: true, wipeExisting: false, duplicatePolicy: 'update' }), 'update');
  assert.equal(excel.resolveRowAction({ isDuplicate: true, wipeExisting: false, duplicatePolicy: 'create' }), 'create');
});

test('τίτλοι με κενά ή κεφαλαία μετράνε ως ίδιο κλειδί', () => {
  assert.equal(excel.normalizeTitleKey('  Οδικό  δίκτυο  '), 'οδικό δίκτυο');
  assert.equal(
    excel.buildDupKey('Οδικό δίκτυο Αρχανών', 'Γέφυρα Αγίου Σύλλα'),
    excel.buildDupKey('  οδικό δίκτυο αρχανών  ', 'γέφυρα αγίου σύλλα')
  );
});

test('σχέδιο εισαγωγής: παράλειψη / ενημέρωση / δημιουργία / διαγραφή', () => {
  const existing = [{
    projectId: 'proj-road',
    subprojectId: 'sub-bridge',
    projectTitle: 'Οδικό δίκτυο Αρχανών',
    subprojectTitle: 'Γέφυρα Αγίου Σύλλα',
    kaCode: 'ΚΑ-100',
  }];
  const rows = [
    { excelRow: 2, projectTitle: 'Οδικό δίκτυο Αρχανών', subprojectTitle: 'Γέφυρα Αγίου Σύλλα', kaCode: 'ΚΑ-999' },
    { excelRow: 3, projectTitle: 'Νέο έργο', subprojectTitle: 'Νέο υποέργο', kaCode: 'ΚΑ-700' },
  ];

  const skipped = excel.applyImportPlan(existing, rows, { duplicatePolicy: 'skip' });
  assert.equal(skipped.created, 1);
  assert.equal(skipped.skipped, 1);
  assert.equal(skipped.projects.find((p) => p.subprojectId === 'sub-bridge').kaCode, 'ΚΑ-100');

  const updated = excel.applyImportPlan(existing, rows, { duplicatePolicy: 'update' });
  assert.equal(updated.updated, 1);
  assert.equal(updated.created, 1);
  const bridge = updated.projects.find((p) => p.subprojectId === 'sub-bridge');
  assert.equal(bridge.projectId, 'proj-road');
  assert.equal(bridge.kaCode, 'ΚΑ-999');

  const created = excel.applyImportPlan(existing, rows, { duplicatePolicy: 'create' });
  assert.equal(created.created, 2);
  assert.equal(created.projects.filter((p) => p.subprojectTitle === 'Γέφυρα Αγίου Σύλλα').length, 2);

  const wiped = excel.applyImportPlan(existing, rows, { wipeExisting: true, duplicatePolicy: 'skip' });
  assert.equal(wiped.created, 2);
  assert.equal(wiped.deletedProjects, 1);
  assert.equal(wiped.projects.some((p) => p.subprojectId === 'sub-bridge'), false);
});

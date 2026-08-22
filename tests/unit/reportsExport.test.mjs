import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const reports = require('../../app/core/reportsExport.js');

test('κουμπιά: στατιστικά/εξαγωγή σε όλους· τεχνικό όχι στον μηχανικό', () => {
  assert.equal(reports.showStatisticsButton('USER'), true);
  assert.equal(reports.showDataExportButton('ENGINEER'), true);
  assert.equal(reports.showTechnicalProgramButton('ADMIN'), true);
  assert.equal(reports.showTechnicalProgramButton('USER'), true);
  assert.equal(reports.showTechnicalProgramButton('ENGINEER'), false);
});

test('σύνοψη: έργα ανά τίτλο· ολοκληρωμένο μόνο χωρίς αποπληρωμή', () => {
  const stats = reports.countOverviewStatistics([
    { projectTitle: 'Οδικό', projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ', projectType: 'ΕΡΓΟ' },
    { projectTitle: 'Οδικό', projectStatus: 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ', projectType: 'ΕΡΓΟ' },
    { projectTitle: 'Σχολείο', projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ', projectType: 'ΕΡΓΟ' },
    { projectTitle: 'Παλιό', projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ', projectType: 'ΕΡΓΟ' },
  ]);
  assert.equal(stats.totalProjects, 4);
  assert.equal(stats.uniqueProjects, 3);
  assert.equal(stats.inProgressCount, 1);
  assert.equal(stats.completedCount, 1);
});

test('σημείωμα μηχανικού και φίλτρου', () => {
  assert.equal(reports.engineerStatisticsScopeNote('ADMIN', 10), '');
  assert.equal(reports.engineerStatisticsScopeNote('ENGINEER', 4), 'Μόνο υποέργα της χρέωσής σας (4)');
  assert.equal(reports.buildStatisticsFilterNote({ scopeCount: 4 }), '4 υποέργα');
  assert.match(
    reports.buildStatisticsFilterNote({
      scopeCount: 1,
      searchText: 'Γέφυρα Αγίου Σύλλα',
    }),
    /αναζήτηση «Γέφυρα Αγίου Σύλλα»/
  );
});

test('εξαγωγή: απενταγμένα έξω, εκτός αν ζητηθούν ρητά', () => {
  const rows = [
    { subprojectId: 'a', projectStatus: 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ' },
    { subprojectId: 'b', projectStatus: 'ΑΠΕΝΤΑΓΜΕΝΟ' },
  ];
  assert.deepEqual(
    reports.resolveExportProjects({ filteredProjects: rows }).map((p) => p.subprojectId),
    ['a']
  );
  assert.deepEqual(
    reports.resolveExportProjects({ filteredProjects: rows, explicitAbandoned: true }).map((p) => p.subprojectId),
    ['a', 'b']
  );
  assert.equal(reports.isExportFilterActive(4, 5), true);
  assert.equal(reports.canCommitDataExport(0), false);
  assert.equal(reports.evaluateDataExport(0).error, 'Παρακαλώ επιλέξτε τουλάχιστον ένα πεδίο για εξαγωγή.');
  assert.equal(reports.evaluateDataExport(2).ok, true);
});

test('αναφορά PDF: σύνοψη μετρά αποπληρωμένα ως ολοκληρωμένα', () => {
  const summary = reports.countPdfSubprojectsSummary([
    { projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ' },
    { projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ' },
    { projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ' },
    { projectStatus: 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ' },
  ]);
  assert.equal(summary.total, 4);
  assert.equal(summary.executing, 1);
  assert.equal(summary.completed, 2);
  assert.equal(reports.canSavePdfReport({ generating: true }), false);
  assert.equal(reports.canSavePdfReport({ saving: true }), false);
  assert.equal(reports.canSavePdfReport({}), true);
  assert.equal(reports.showPdfReportsButton('USER'), true);
  assert.equal(reports.showCardReportButton(), true);
  assert.equal(reports.PDF_TABS.length, 4);
});

test('αναφορά κάρτας: ένταξη ανά υποέργο, πρόσκληση ανά τίτλο έργου', () => {
  const project = { projectId: 'proj-road', subprojectId: 'sub-bridge', projectTitle: 'Οδικό δίκτυο Αρχανών' };
  const ents = reports.getLinkedEntaxeis([
    { entaxiId: 'mine', subprojectIds: ['sub-bridge'] },
    { entaxiId: 'other', subprojectIds: ['sub-tank'] },
    { entaxiId: 'none', subprojectIds: [] },
  ], 'sub-bridge');
  assert.deepEqual(ents.map((e) => e.entaxiId), ['mine']);
  const psks = reports.getLinkedProskliseis([
    { prosklisiId: 'a', title: 'Σχολεία', linkedProjects: [{ title: 'Οδικό δίκτυο Αρχανών' }] },
    { prosklisiId: 'b', title: 'Μακρινή', linkedProjects: [{ title: 'Άλλο έργο' }] },
    { prosklisiId: 'c', title: 'Οδικό δίκτυο Αρχανών' },
  ], project);
  assert.deepEqual(psks.map((p) => p.prosklisiId), ['a', 'c']);
});

test('τεχνικό πρόγραμμα: έτος, κενό έτος ταιριάζει, μηδέν υπόλοιπο έξω', () => {
  const projects = [
    { subprojectId: 'y26', remainingAmount: '15.000,00', remainingAmountYear: '2026' },
    { subprojectId: 'y25', remainingAmount: '8000', remainingAmountYear: '2025' },
    { subprojectId: 'any', remainingAmount: '3000', remainingAmountYear: '' },
    { subprojectId: 'zero', remainingAmount: '0', remainingAmountYear: '2026' },
  ];
  const y26 = reports.buildTechnicalProgramRows(projects, '2026');
  assert.deepEqual(y26.map((r) => r.project.subprojectId), ['y26', 'any']);
  const y25 = reports.buildTechnicalProgramRows(projects, '2025');
  assert.deepEqual(y25.map((r) => r.project.subprojectId), ['y25', 'any']);
  const empty = reports.buildTechnicalProgramRows(projects, '2024');
  assert.deepEqual(empty.map((r) => r.project.subprojectId), ['any']);
  assert.equal(reports.canCommitTechnicalExport([]), false);
  assert.match(reports.evaluateTechnicalExport([], '2024').error, /2024/);
});

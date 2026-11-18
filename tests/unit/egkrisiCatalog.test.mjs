import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const egk = require('../../app/core/egkrisiCatalog.js');

const road = [
  { projectId: 'proj-road', subprojectId: 'sub-bridge', projectTitle: 'Οδικό δίκτυο Αρχανών', subprojectTitle: 'Γέφυρα Αγίου Σύλλα', kaCode: 'ΚΑ-100' },
  { projectId: 'proj-road', subprojectId: 'sub-lights', projectTitle: 'Οδικό δίκτυο Αρχανών', subprojectTitle: 'Φωτισμός κόμβου', kaCode: 'ΚΑ-101' },
];
const water = [
  { projectId: 'proj-water', subprojectId: 'sub-tank', projectTitle: 'Ύδρευση Αστερουσίων', subprojectTitle: 'Δεξαμενή Παρανύμφων', kaCode: 'ΚΑ-200', aleCode: '71-1234.001' },
];

test('αναζήτηση: όλη η ομάδα μένει αν ταιριάζει ένα υποέργο· όχι όνομα αρχείου', () => {
  const byTitle = egk.filterEgkrisiProjectGroups([road, water], 'γέφυρα');
  assert.equal(byTitle.length, 1);
  assert.equal(byTitle[0].length, 2);
  assert.equal(byTitle[0][1].subprojectId, 'sub-lights');

  const byKa = egk.filterEgkrisiProjectGroups([road, water], 'ΚΑ-200');
  assert.equal(byKa.length, 1);
  assert.equal(byKa[0][0].subprojectId, 'sub-tank');

  const byAle = egk.filterEgkrisiProjectGroups([road, water], '71-1234');
  assert.equal(byAle[0][0].subprojectId, 'sub-tank');

  assert.equal(egk.filterEgkrisiProjectGroups([road, water], 'ΑΔΑ-XYZ').length, 0);
});

test('ίδιο υποέργο σε δεύτερη ομάδα εμφανίζεται μία φορά', () => {
  const dup = [
    ...road,
    { projectId: 'proj-other', subprojectId: 'sub-bridge', projectTitle: 'Άλλο', subprojectTitle: 'Γέφυρα Αγίου Σύλλα', kaCode: 'ΚΑ-100' },
  ];
  const groups = egk.filterEgkrisiProjectGroups([road, dup], '');
  const ids = groups.flat().map((p) => p.subprojectId);
  assert.equal(ids.filter((id) => id === 'sub-bridge').length, 1);
});

test('τύπος και ρόλοι: Νέα Έγκριση πάντα· ενέργειες όχι σε μηχανικό / χρήστη', () => {
  assert.equal(egk.formatEgkrisiType('initial'), 'Αρχική');
  assert.equal(egk.formatEgkrisiType('modification'), 'Τροποποίηση');
  assert.equal(egk.formatEgkrisiType(''), '');
  assert.equal(egk.showNewEgkrisiButton('ENGINEER'), true);
  assert.equal(egk.showNewEgkrisiButton('USER'), true);
  assert.equal(egk.canManageEgkrisiActions('ADMIN'), true);
  assert.equal(egk.canManageEgkrisiActions('ENGINEER'), false);
  assert.equal(egk.canManageEgkrisiActions('USER'), false);
});

test('αυτόνομο PDF: ακριβής τίτλος, πρώτο αρχική, ήδη φορτωμένο αγνοείται', () => {
  const groups = [road, [
    { projectId: 'proj-old', subprojectId: 'sub-legacy', projectTitle: 'Παλιό έργο πλατείας', subprojectTitle: 'Ανάπλαση κεντρικής πλατείας' },
  ]];
  const existing = {
    'proj-road': [{ subprojectId: 'sub-lights', egkriseis: [{ id: 'keep', fileName: 'υπάρχον.pdf' }] }],
  };
  const merged = egk.mergeStandaloneEgkriseis(existing, {
    projects: {
      road: {
        title: 'Οδικό δίκτυο Αρχανών',
        subprojects: { lights: { title: 'Φωτισμός κόμβου', pdfs: ['should-not-appear.pdf'] } },
      },
      plateia: {
        title: 'Παλιό έργο πλατείας',
        subprojects: { anaplasi: { title: 'Ανάπλαση κεντρικής πλατείας', pdfs: ['α.pdf', 'β.pdf'] } },
      },
      ghost: {
        title: 'Άγνωστο έργο',
        subprojects: { x: { title: 'Κάτι', pdfs: ['ghost.pdf'] } },
      },
    },
  }, groups);

  assert.equal(merged['proj-road'][0].egkriseis[0].fileName, 'υπάρχον.pdf');
  assert.equal(merged['proj-old'][0].egkriseis[0].type, 'initial');
  assert.equal(merged['proj-old'][0].egkriseis[1].type, 'modification');
  assert.equal(merged['proj-old'][0].egkriseis[0].id, 'standalone_plateia_anaplasi_0');
  assert.ok(!Object.values(merged).some((list) =>
    (list || []).some((row) => (row.egkriseis || []).some((e) => e.fileName === 'ghost.pdf'))
  ));
});

test('σύνδεση: ίδιος τίτλος σε άλλη έγκριση δεν φαίνεται συνδεδεμένος', () => {
  const link = {
    egkrisiId: 'manual_egkrisi_row-a_abc',
    egkrisiProjectKey: 'egk-a',
    egkrisiSubprojectKey: 'row-a',
    egkrisiTitle: 'Γέφυρα Αγίου Σύλλα',
    egkrisiProjectTitle: 'Έγκριση Α',
    subprojectId: 'sub-bridge',
  };
  const rowA = { folderName: 'egk-a', title: 'Έγκριση Α' };
  const subA = { folderName: 'row-a', number: '1', title: 'Γέφυρα Αγίου Σύλλα' };
  const rowB = { folderName: 'egk-b', title: 'Έγκριση Β' };
  const subB = { folderName: 'row-b', number: '1', title: 'Γέφυρα Αγίου Σύλλα' };

  assert.equal(egk.linkMatchesApprovalRow(link, rowA, subA), true);
  assert.equal(egk.linkMatchesApprovalRow(link, rowB, subB), false);
  assert.equal(egk.findLinkForApprovalRow([link], rowB, subB), null);
});

test('σύνδεση: μετονομασία δεν την ξεκολλάει όταν κρατιέται το κλειδί ή ο αριθμός', () => {
  const byFolder = {
    egkrisiProjectKey: 'egk-a',
    egkrisiSubprojectKey: 'row-a',
    egkrisiTitle: 'Παλιός τίτλος',
    egkrisiProjectTitle: 'Έγκριση Α',
  };
  const renamed = { folderName: 'row-a', number: '1', title: 'Νέος τίτλος' };
  assert.equal(egk.linkMatchesApprovalRow(byFolder, { folderName: 'egk-a', title: 'Έγκριση Α' }, renamed), true);

  const byNumber = {
    egkrisiProjectKey: 'egk-a',
    egkrisiSubprojectKey: '1',
    egkrisiTitle: 'Παλιός τίτλος',
    egkrisiProjectTitle: 'Έγκριση Α',
  };
  assert.equal(egk.linkMatchesApprovalRow(byNumber, { folderName: 'egk-a', title: 'Έγκριση Α' }, renamed), true);
});

test('σύνδεση: χωρίς κλειδιά μετράει τίτλος έγκρισης και πράξης', () => {
  const link = { egkrisiTitle: 'Γέφυρα', egkrisiProjectTitle: 'Πράξη Α' };
  assert.equal(egk.linkMatchesApprovalRow(link, { title: 'Πράξη Α' }, { title: 'Γέφυρα' }), true);
  assert.equal(egk.linkMatchesApprovalRow(link, { title: 'Πράξη Β' }, { title: 'Γέφυρα' }), false);
});

test('σύνδεση: μοναδικός τίτλος δένεται, διπλός όχι', () => {
  const projects = [
    { subprojectId: 'sub-bridge', subprojectTitle: 'Γέφυρα Αγίου Σύλλα' },
    { subprojectId: 'sub-lights', subprojectTitle: 'Φωτισμός κόμβου' },
    { subprojectId: 'sub-bridge-2', subprojectTitle: 'Φωτισμός κόμβου' },
  ];
  assert.equal(egk.portfolioSubprojectsWithExactTitle(projects, 'Γέφυρα Αγίου Σύλλα').length, 1);
  assert.equal(egk.portfolioSubprojectsWithExactTitle(projects, 'γέφυρα αγίου σύλλα')[0].subprojectId, 'sub-bridge');
  assert.equal(egk.portfolioSubprojectsWithExactTitle(projects, 'Φωτισμός κόμβου').length, 2);
  assert.equal(egk.portfolioSubprojectsWithExactTitle(projects, '').length, 0);
  assert.equal(
    egk.portfolioSubprojectForDirectLink(projects, 'Γέφυρα Αγίου Σύλλα', []).subprojectId,
    'sub-bridge'
  );
  assert.equal(
    egk.portfolioSubprojectForDirectLink(projects, 'Γέφυρα Αγίου Σύλλα', [{ subprojectId: 'sub-bridge' }]),
    null
  );
  assert.equal(egk.portfolioSubprojectForDirectLink(projects, 'Φωτισμός κόμβου', []), null);
});

test('σύνδεση: δεύτερη γραμμή με ίδιο τίτλο δεν σβήνει την πρώτη', () => {
  const existing = [{
    egkrisiId: 'manual_egkrisi_row-a_old',
    egkrisiProjectKey: 'egk-a',
    egkrisiSubprojectKey: 'row-a',
    egkrisiTitle: 'Γέφυρα Αγίου Σύλλα',
    egkrisiProjectTitle: 'Έγκριση Α',
    subprojectId: 'sub-bridge',
  }];
  const again = egk.classifyManualEgkrisiLink(existing, {
    egkrisiProjectKey: 'egk-a',
    egkrisiSubprojectKey: 'row-a',
    egkrisiTitle: 'Γέφυρα Αγίου Σύλλα',
    egkrisiProjectTitle: 'Έγκριση Α',
    subprojectId: 'sub-bridge',
  });
  assert.equal(again.action, 'keep');

  const otherRow = egk.classifyManualEgkrisiLink(existing, {
    egkrisiProjectKey: 'egk-b',
    egkrisiSubprojectKey: 'row-b',
    egkrisiTitle: 'Γέφυρα Αγίου Σύλλα',
    egkrisiProjectTitle: 'Έγκριση Β',
    subprojectId: 'sub-bridge',
  });
  assert.equal(otherRow.action, 'reject-subproject');

  const otherPortfolio = egk.classifyManualEgkrisiLink(existing, {
    egkrisiProjectKey: 'egk-b',
    egkrisiSubprojectKey: 'row-b',
    egkrisiTitle: 'Γέφυρα Αγίου Σύλλα',
    egkrisiProjectTitle: 'Έγκριση Β',
    subprojectId: 'sub-lights',
  });
  assert.equal(otherPortfolio.action, 'create');
  assert.notEqual(otherPortfolio.egkrisiId, existing[0].egkrisiId);

  const steal = egk.classifyManualEgkrisiLink(existing, {
    egkrisiProjectKey: 'egk-a',
    egkrisiSubprojectKey: 'row-a',
    egkrisiTitle: 'Γέφυρα Αγίου Σύλλα',
    egkrisiProjectTitle: 'Έγκριση Α',
    subprojectId: 'sub-lights',
  });
  assert.equal(steal.action, 'reject-approval');
});

test('μετονομασία ενημερώνει μόνο τη σύνδεση της γραμμής', () => {
  const links = [
    { egkrisiId: 'a', egkrisiProjectKey: 'egk-a', egkrisiSubprojectKey: 'row-a', egkrisiTitle: 'Παλιός', subprojectTitle: 'Παλιός' },
    { egkrisiId: 'b', egkrisiProjectKey: 'egk-a', egkrisiSubprojectKey: '1', egkrisiTitle: 'Παλιός', subprojectTitle: 'Παλιός' },
    { egkrisiId: 'c', egkrisiProjectKey: 'egk-a', egkrisiSubprojectKey: '1', egkrisiTitle: 'Άλλος', subprojectTitle: 'Άλλος' },
    { egkrisiId: 'd', egkrisiProjectKey: 'egk-b', egkrisiSubprojectKey: 'row-a', egkrisiTitle: 'Παλιός', subprojectTitle: 'Παλιός' },
  ];
  const updated = egk.egkrisiLinksForSubprojectTitleChange(links, {
    projectKey: 'egk-a',
    subprojectKey: 'row-a',
    number: '1',
    oldTitle: 'Παλιός',
    newTitle: 'Νέος',
  });
  const ids = updated.map((l) => l.egkrisiId).sort();
  assert.deepEqual(ids, ['a', 'b']);
  assert.equal(updated.find((l) => l.egkrisiId === 'b').egkrisiTitle, 'Νέος');
  assert.equal(links.find((l) => l.egkrisiId === 'c').egkrisiTitle, 'Άλλος');
});

test('αφαίρεση ένδειξης από ένα υποέργο αφήνει το κοινό αρχείο στα υπόλοιπα', () => {
  const project = {
    modifications: [],
    subprojects: {
      keep: { title: 'Σωστό', number: '1', pdfs: ['koino.pdf', 'mono.pdf'] },
      drop: { title: 'Διπλό', number: 'ΝΕΟ 1', pdfs: ['koino.pdf'] },
    },
  };
  const outcome = egk.removeEgkrisiPdfFromSubproject(project, 'drop', 'koino.pdf');
  assert.equal(outcome.foundSubproject, true);
  assert.equal(outcome.removed, true);
  assert.equal(outcome.fileStillNeeded, true);
  assert.deepEqual(project.subprojects.drop.pdfs, []);
  assert.deepEqual(project.subprojects.keep.pdfs, ['koino.pdf', 'mono.pdf']);

  const last = egk.removeEgkrisiPdfFromSubproject(project, 'keep', 'koino.pdf');
  assert.equal(last.fileStillNeeded, false);
  assert.deepEqual(project.subprojects.keep.pdfs, ['mono.pdf']);
});

test('αφαίρεση από όλα τα υποέργα δεν σβήνει αρχείο που μένει στις τροποποιήσεις', () => {
  const project = {
    modifications: ['koino.pdf'],
    subprojects: {
      a: { pdfs: ['koino.pdf'] },
      b: { pdfs: ['koino.pdf'] },
    },
  };
  const outcome = egk.removeEgkrisiPdfFromAllSubprojects(project, 'koino.pdf');
  assert.equal(outcome.removedCount, 2);
  assert.equal(outcome.fileStillNeeded, true);
  assert.deepEqual(project.subprojects.a.pdfs, []);
  assert.deepEqual(project.subprojects.b.pdfs, []);
});

test('διαγραφή υποέργου σβήνει μόνο τα αρχεία που δεν τα έχει άλλη γραμμή', () => {
  const project = {
    title: 'Στάδιο',
    modifications: ['tropop.pdf'],
    subprojects: {
      keep: { title: 'Σωστό', number: '1', pdfs: ['koino.pdf', 'mono.pdf'] },
      drop: { title: 'Διπλό', number: 'ΝΕΟ 1', pdfs: ['koino.pdf', 'mono-tou.pdf', 'tropop.pdf'] },
    },
  };
  const plan = egk.planEgkrisiSubprojectRemoval(project, 'drop');
  assert.equal(plan.found, true);
  assert.equal(plan.projectBecomesEmpty, false);
  assert.deepEqual(plan.filesToDelete, ['mono-tou.pdf']);
  assert.equal(project.subprojects.drop.pdfs.length, 3);

  egk.applyEgkrisiSubprojectRemoval(project, 'drop');
  assert.equal(project.subprojects.drop, undefined);
  assert.deepEqual(project.subprojects.keep.pdfs, ['koino.pdf', 'mono.pdf']);

  const last = egk.planEgkrisiSubprojectRemoval({
    modifications: [],
    subprojects: { only: { title: 'Μόνο', number: '1', pdfs: ['a.pdf'] } },
  }, 'only');
  assert.equal(last.projectBecomesEmpty, true);
  assert.deepEqual(last.filesToDelete, ['a.pdf']);
});

test('διαγραφή γραμμής και πράξης παίρνει μόνο τις δικές τους συνδέσεις', () => {
  const links = [
    { egkrisiId: 'row', egkrisiProjectKey: 'act-a', egkrisiSubprojectKey: 'drop' },
    { egkrisiId: 'other-row', egkrisiProjectKey: 'act-a', egkrisiSubprojectKey: 'keep' },
    { egkrisiId: 'other-act', egkrisiProjectKey: 'act-b', egkrisiSubprojectKey: 'drop' },
    { egkrisiId: 'by-title', egkrisiProjectTitle: 'Στάδιο', egkrisiTitle: 'Παλιό' },
  ];
  const project = { title: 'Στάδιο', folderName: 'act-a' };
  const rowLinks = egk.egkrisiLinksForRowRemoval(links, project, { title: 'Διπλό', folderName: 'drop', number: 'ΝΕΟ 1' });
  assert.deepEqual(rowLinks.map((l) => l.egkrisiId), ['row']);

  const projectLinks = egk.egkrisiLinksForProjectRemoval(links, project);
  assert.deepEqual(projectLinks.map((l) => l.egkrisiId).sort(), ['by-title', 'other-row', 'row']);
});

test('το κουμπί της κάρτας σβήνει όταν η έγκριση δεν έχει πια αρχεία', () => {
  const flags = egk.creditApprovalFlagsFromCatalog({
    projects: {
      a: {
        title: 'Έγκριση γέφυρας Α',
        modifications: [],
        subprojects: {
          row: { title: 'Γέφυρα Αγίου Σύλλα', pdfs: ['a.pdf'] },
          empty: { title: 'Χωρίς αρχείο', pdfs: [] },
        },
      },
    },
  });
  assert.equal(flags['Έγκριση γέφυρας Α-Γέφυρα Αγίου Σύλλα'], true);
  assert.equal(flags['Έγκριση γέφυρας Α-Χωρίς αρχείο'], undefined);
  assert.deepEqual(egk.creditApprovalFlagsFromCatalog(null), {});
});

test('άγνωστη γραμμή δεν πειράζει τις υπόλοιπες ενδείξεις', () => {
  const project = {
    modifications: [],
    subprojects: { a: { pdfs: ['koino.pdf'] } },
  };
  const outcome = egk.removeEgkrisiPdfFromSubproject(project, 'missing', 'koino.pdf');
  assert.equal(outcome.foundSubproject, false);
  assert.equal(outcome.removed, false);
  assert.deepEqual(project.subprojects.a.pdfs, ['koino.pdf']);
});

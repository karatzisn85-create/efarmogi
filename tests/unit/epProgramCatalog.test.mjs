import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ep = require('../../app/core/epProgramCatalog.js');

test('κουμπί επιχειρησιακού μόνο σε διαχειριστή / υπερδιαχειριστή', () => {
  assert.equal(ep.showEpProgramButton('ADMIN'), true);
  assert.equal(ep.showEpProgramButton('SUPERADMIN'), true);
  assert.equal(ep.showEpProgramButton('ENGINEER'), false);
  assert.equal(ep.showEpProgramButton('USER'), false);
  assert.equal(ep.canManageEpProgram({ role: 'ADMIN' }), true);
  assert.equal(ep.canManageEpProgram({ role: 'ENGINEER' }), false);
});

test('εισαγωγή: τετραετία / πενταετία και αρχείο υποχρεωτικά', () => {
  assert.match(ep.evaluateEpImport({ startYear: '', endYear: '2028', filePath: 'a.xlsx' }).error, /έτος/);
  assert.match(ep.evaluateEpImport({ startYear: '2024', endYear: '', filePath: 'a.xlsx' }).error, /έτος/);
  assert.match(ep.evaluateEpImport({ startYear: '2024', endYear: '2028', filePath: '' }).error, /Excel/);
  assert.match(ep.evaluateEpImport({ startYear: '2024', endYear: '2026', filePath: 'a.xlsx' }).error, /τετραετία ή πενταετία/);
  const penta = ep.evaluateEpImport({ startYear: '2024', endYear: '2028', filePath: 'C:\\tmp\\ep.xlsx' });
  assert.equal(penta.ok, true);
  assert.equal(penta.period.kind, 'penta');
  assert.equal(penta.period.label, 'Πενταετία 2024–2028');
  const tetra = ep.evaluateEpImport({ startYear: '2024', endYear: '2027', filePath: 'C:\\tmp\\ep.xlsx' });
  assert.equal(tetra.ok, true);
  assert.equal(tetra.period.kind, 'tetra');
  assert.equal(ep.defaultImportEndYear('2024'), '2028');
  assert.equal(ep.defaultImportEndYear('2024', 4), '2027');
  assert.equal(ep.filterImportYearInput('20a2b4xxx'), '2024');
  assert.equal(ep.evaluateImportWizardStep('period', { startYear: '2024' }).ok, false);
  assert.equal(ep.evaluateImportWizardStep('file', { filePath: '' }).ok, false);
});

test('μεταφορά συνδέσεων: ίδιο Α/Α ή τίτλος· χωρίς διπλότυπα στην κάρτα', () => {
  const oldActions = [
    { aa: 1, title: 'Ύδρευση Χουδετσίου', linkedSubprojectIds: ['sub-a'] },
    { aa: 2, title: 'Πλατεία', linkedSubprojectIds: ['sub-b'] },
    { aa: 9, title: 'Χωρίς ταίρι', linkedSubprojectIds: ['sub-c'] }
  ];
  const next = [
    { id: 'n1', aa: 1, title: 'Ύδρευση Χουδετσίου ανανέωση' },
    { id: 'n2', aa: 8, title: 'Πλατεία' }
  ];
  const moved = ep.transferEpActionLinks(oldActions, next);
  assert.equal(moved.transferred, 2);
  assert.equal(moved.unmatched, 1);
  assert.deepEqual(moved.actions[0].linkedSubprojectIds, ['sub-a']);
  assert.deepEqual(moved.actions[1].linkedSubprojectIds, ['sub-b']);
  const programs = [
    { id: 'old', startYear: 2019, endYear: 2023, isActive: false, title: 'Παλιό', actions: oldActions },
    { id: 'now', startYear: 2024, endYear: 2028, isActive: true, title: 'Νέο', actions: moved.actions }
  ];
  const onCard = ep.collectEpActionsForSubproject(programs, 'sub-a');
  assert.equal(onCard.length, 1);
  assert.equal(onCard[0].programId, 'now');
  const leftover = ep.collectEpActionsForSubproject(programs, 'sub-c');
  assert.equal(leftover.length, 1);
  assert.equal(leftover[0].isActive, false);
  const afterUnlink = {
    ...programs[1],
    actions: moved.actions.map((row) => ({ ...row, linkedSubprojectIds: [] }))
  };
  assert.equal(ep.collectEpActionsForSubproject([programs[0], afterUnlink], 'sub-a').length, 0);
  assert.equal(ep.isSameEpPeriod({ startYear: 2024, endYear: 2028 }, '2024', '2028'), true);
  assert.equal(ep.isSameEpPeriod({ startYear: 2024, endYear: 2028 }, 2029, 2033), false);
  const sameReload = ep.describeEpImportReload(
    [{ id: 'now', startYear: 2024, endYear: 2028, isActive: true, title: 'ΕΠ 2024-2028' }],
    '2024',
    '2028',
    { transferred: 1, unmatched: 0 }
  );
  assert.equal(sameReload.show, true);
  assert.equal(sameReload.kind, 'samePeriod');
  assert.match(sameReload.title, /ήδη/);
  assert.match(sameReload.body, /ίδια περίοδο/);
  assert.match(sameReload.body, /1 σύνδεση/);
  const beforeYears = ep.describeEpImportReload(
    [{ id: 'now', startYear: 2024, endYear: 2028, isActive: true, title: 'ΕΠ' }],
    '',
    ''
  );
  assert.equal(beforeYears.kind, 'hasExisting');
  const otherPeriod = ep.describeEpImportReload(
    [{ id: 'now', startYear: 2024, endYear: 2028, isActive: true, title: 'ΕΠ' }],
    2029,
    2033
  );
  assert.equal(otherPeriod.kind, 'newPeriod');
  assert.equal(ep.describeEpImportReload([], 2024, 2028).show, false);
});

test('πρότυπο Excel: τετραετία / πενταετία, έτη και στήλες εισαγωγής', () => {
  assert.equal(ep.canDownloadEpTemplate({ role: 'ADMIN' }), true);
  assert.equal(ep.canDownloadEpTemplate({ role: 'ENGINEER' }), false);
  const penta = ep.buildEpImportTemplateModel(2024, 2028);
  assert.equal(penta.ok, true);
  assert.deepEqual(penta.years, [2024, 2025, 2026, 2027, 2028]);
  assert.equal(penta.actionsRows[1][10], '2024');
  assert.match(String(penta.actionsRows[1][15]), /ΣΥΝΟΛΟ/);
  assert.match(String(penta.actionsRows[0][16]), /ΠΗΓΗ/);
  assert.equal(penta.actionsRows[2][0], 1);
  assert.match(penta.actionsRows[2][4], /ΠΑΡΑΔΕΙΓΜΑ/);
  assert.match(penta.filename, /2024-2028/);
  const guide = penta.instructionRows.map((row) => row.join(' ')).join('\n');
  assert.match(guide, /στατιστικ/);
  assert.match(guide, /Στήλη Α/);
  assert.match(guide, /Στήλη Ε/);
  assert.match(guide, /αυτόματα/);
  assert.equal(penta.instructionSectionTitles['Σημαντικό για εσάς'], 'highlight');
  assert.match(ep.flattenEpTemplateInstructions(penta), /Στήλη Α/);
  const copy = ep.epImportScreenCopy();
  assert.match(copy.emptyHelp, /στατιστικ/);
  assert.match(copy.periodHelp, /αυτόματα/);
  assert.match(copy.fileHelp, /στήλη/);
  const tetra = ep.buildEpImportTemplateModel(2024, 2027);
  assert.deepEqual(tetra.years, [2024, 2025, 2026, 2027]);
  assert.match(ep.buildEpImportTemplateModel(2024, 2026).error, /τετραετία ή πενταετία/);
  const resolved = ep.resolveTemplatePeriod({ nowYear: 2026 });
  assert.equal(resolved.startYear, 2026);
  assert.equal(resolved.endYear, 2030);
  assert.equal(ep.evaluateTemplateDownload({ startYear: '', endYear: '' }).ok, false);
  const asked = ep.evaluateTemplateDownload({ startYear: '2024', endYear: '2027' });
  assert.equal(asked.ok, true);
  assert.equal(asked.period.kind, 'tetra');
  assert.equal(ep.pickEpTemplateExampleLocation(['Αστερουσίων']), 'Δ.Ε. Αστερουσίων');
  assert.equal(ep.pickEpTemplateExampleLocation(['Δ.Ε. Αρχανών']), 'Δ.Ε. Αρχανών');
  assert.equal(ep.pickEpTemplateExampleLocation([]), 'Δ.Ε. Θεσσαλονίκης');
  assert.equal(ep.buildEpImportTemplateModel(2024, 2028, { municipalUnits: ['Αστερουσίων'] }).exampleLocation, 'Δ.Ε. Αστερουσίων');
  assert.equal(ep.buildEpImportTemplateModel(2024, 2028, {}).exampleLocation, 'Δ.Ε. Θεσσαλονίκης');
  const lists = ep.buildEpTemplateListModel({ municipalUnits: ['Αστερουσίων'] });
  assert.equal(lists.listsSheetName, 'ΛΙΣΤΕΣ');
  assert.deepEqual(lists.growing.map((c) => c.col), ['B', 'C', 'D']);
  assert.deepEqual(lists.fixed.map((c) => c.col), ['F', 'G', 'I', 'H']);
  assert.ok(lists.fixed.find((c) => c.key === 'actionType').values.includes('Έργο'));
  assert.ok(lists.fixed.find((c) => c.key === 'location').values.includes('Δ.Ε. Αστερουσίων'));
  assert.match(penta.instructionRows.flat().join(' '), /ΛΙΣΤΕΣ/);
  assert.equal(penta.listModel.growing.length, 3);
});

test('πρότυπο: έτοιμες λίστες και κενές που γεμίζουν από ό,τι γράφει ο χρήστης', () => {
  const lists = ep.buildEpTemplateListModel({ municipalUnits: ['Αρχανών', 'Αστερουσίων'] });
  assert.equal(lists.growFromRow, lists.exampleRow + 1);
  assert.ok(lists.dataEndRow > lists.growFromRow);
  assert.deepEqual(lists.growing.map((c) => c.key), ['axis', 'measure', 'objective']);
  assert.deepEqual(lists.growing.map((c) => c.namedRange), ['EPAXIS', 'EPMEASURE', 'EPOBJECTIVE']);
  const types = lists.fixed.find((c) => c.key === 'actionType');
  assert.equal(types.allowCustom, false);
  assert.equal(types.namedRange, 'EPTYPES');
  assert.equal(types.listCol, 'A');
  assert.deepEqual(types.values, ep.ACTION_TYPES);
  assert.deepEqual(lists.fixed.find((c) => c.key === 'newCont').values, ep.NEW_OR_CONTINUING);
  assert.deepEqual(lists.fixed.find((c) => c.key === 'priority').values, ep.PRIORITIES);
  const loc = lists.fixed.find((c) => c.key === 'location');
  assert.equal(loc.allowCustom, true);
  assert.ok(loc.values.includes('Δ.Ε. Αρχανών'));
  assert.ok(loc.values.includes('Δ.Ε. Αστερουσίων'));
  assert.deepEqual(ep.collectEpTemplateLocations(['Αρχανών', 'Αρχανών', 'Δ.Ε. Αρχανών']), ['Δ.Ε. Αρχανών']);
  assert.deepEqual(ep.collectEpTemplateLocations([]), ['Δ.Ε. Θεσσαλονίκης']);
  const guide = ep.flattenEpTemplateInstructions(ep.buildEpImportTemplateModel(2024, 2028, { municipalUnits: ['Αστερουσίων'] }));
  assert.match(guide, /ξεκινά κενή/);
  assert.match(guide, /ΛΙΣΤΕΣ/);
  assert.match(guide, /Επιλέξτε από τη λίστα/);
  assert.equal(ep.quoteEpExcelSheetName("ΛΙΣΤΕΣ"), "'ΛΙΣΤΕΣ'");
  const fixedRef = ep.epTemplateFixedListFormula(types);
  assert.match(fixedRef, /^'ΛΙΣΤΕΣ'!\$A\$2:\$A\$/);
  const grow = ep.epTemplateGrowingListFormula('B', lists.growFromRow, lists.dataEndRow);
  assert.match(grow, /OFFSET\(\$B\$4/);
  assert.match(grow, /COUNTA\(\$B\$4:\$B\$/);
  assert.equal(grow.includes('!'), false);
});

test('πρότυπο: περίοδος υποχρεωτική, χωροθέτηση Δήμου, γραμμή-παράδειγμα αγνοείται', () => {
  assert.equal(ep.evaluateTemplateDownload({ startYear: '2024', endYear: '2026' }).ok, false);
  const draft = ep.suggestTemplatePeriodDraft({ startYear: '2024', endYear: '2028' });
  assert.equal(draft.startYear, '2024');
  assert.equal(draft.endYear, '2028');
  assert.equal(draft.span, 5);
  const fallback = ep.suggestTemplatePeriodDraft({ startYear: '2029', endYear: '2028', nowYear: 2026 });
  assert.equal(fallback.startYear, '2026');
  assert.equal(fallback.endYear, '2030');
  assert.equal(ep.pickEpTemplateExampleLocation(['', '  ', 'Αρχανών']), 'Δ.Ε. Αρχανών');
  assert.equal(ep.pickEpTemplateExampleLocation('Αστερουσίων'), 'Δ.Ε. Αστερουσίων');
  assert.equal(ep.formatEpTemplateLocation('Δημοτική Ενότητα Αρχανών'), 'Δημοτική Ενότητα Αρχανών');
  const tetra = ep.buildEpImportTemplateModel(2024, 2027, { municipalUnits: ['Αστερουσίων'] });
  assert.deepEqual(tetra.years, [2024, 2025, 2026, 2027]);
  assert.match(tetra.filename, /2024-2027/);
  assert.equal(tetra.actionsRows[2][7], 'Δ.Ε. Αστερουσίων');
  assert.equal(tetra.listModel.growing.length, 3);
  assert.equal(tetra.listModel.fixed.length, 4);
  assert.ok(tetra.listModel.fixed.find((c) => c.key === 'location').values.includes('Δ.Ε. Αστερουσίων'));
  assert.match(tetra.instructionRows.flat().join(' '), /Δ\.Ε\. Αστερουσίων/);
  assert.equal(ep.isEpTemplateExampleTitle(tetra.exampleTitle), true);
  assert.equal(ep.isEpTemplateExampleTitle('ΠΑΡΑΔΕΙΓΜΑ — διαγράψτε ή αντικαταστήστε τη γραμμή'), true);
  assert.equal(ep.isEpTemplateExampleTitle('Ύδρευση Χουδετσίου'), false);
});

test('νέα δράση: υποχρεωτικός τίτλος και Α/Α· διαγραφή μόνο με δικαίωμα', () => {
  assert.match(ep.evaluateEpActionSave({ title: '' }).error, /τίτλος/);
  assert.match(ep.evaluateEpActionSave({ title: 'Ύδρευση' }).error, /Α\/Α/);
  assert.match(ep.evaluateEpActionSave({ title: 'Ύδρευση', aa: '0' }).error, /θετικός/);
  const saved = ep.evaluateEpActionSave({ title: '  Ύδρευση  ', aa: '12' });
  assert.equal(saved.ok, true);
  assert.equal(saved.title, 'Ύδρευση');
  assert.equal(saved.aa, 12);
  assert.match(ep.evaluateEpActionSave({ title: 'Ύδρευση', aa: '1', existingAas: [1] }).error, /χρησιμοποιείται/);
  assert.equal(ep.suggestNextEpActionAa([{ aa: 3 }, { aa: 12 }]), 13);
  assert.equal(
    ep.formatEpCardLinkLabel({ aa: 1, title: 'Ύδρευση Χουδετσίου', periodLabel: 'Πενταετία 2024–2028' }),
    'ΕΠ · Πενταετία 2024–2028 · #1 Ύδρευση Χουδετσίου'
  );
  assert.equal(ep.evaluateEpActionDelete({ role: 'USER', actionId: 'a' }).ok, false);
  assert.equal(ep.evaluateEpActionDelete({ role: 'ADMIN', actionId: '' }).ok, false);
  assert.equal(ep.evaluateEpActionDelete({ role: 'ADMIN', actionId: 'a' }).ok, true);
});

test('αναζήτηση: τίτλος / τόπος / υπηρεσία / πηγή ναι, κωδικός άξονα όχι', () => {
  const row = {
    aa: 12,
    axisCode: '1',
    measureCode: '1.1',
    title: 'Ύδρευση Χουδετσίου',
    location: 'Χουδέτσι',
    responsibleService: 'Διεύθυνση Τεχνικών Υπηρεσιών',
    fundingSources: ['ΕΣΠΑ 2021-2027'],
    actionType: 'Έργο',
    isNew: true
  };
  assert.equal(ep.parseEpActionSearch(row, 'Χουδετσίου'), true);
  assert.equal(ep.parseEpActionSearch(row, 'Χουδέτσι'), true);
  assert.equal(ep.parseEpActionSearch(row, 'Τεχνικών'), true);
  assert.equal(ep.parseEpActionSearch(row, 'ΕΣΠΑ'), true);
  assert.equal(ep.parseEpActionSearch(row, '1.1'), false);
  assert.equal(ep.parseEpActionSearch(row, '12'), false);
});

test('φίλτρα άξονα / είδους / νέας· ομαδοποίηση· αρχειοθετημένα', () => {
  const rows = [
    { id: 'a', axisCode: '1', actionType: 'Έργο', isNew: true, title: 'Α' },
    { id: 'b', axisCode: '2', actionType: 'Μελέτη', isNew: false, title: 'Β' }
  ];
  assert.deepEqual(ep.filterEpActionsHub(rows, { filterAxis: '1' }).map((r) => r.id), ['a']);
  assert.deepEqual(ep.filterEpActionsHub(rows, { filterType: 'Μελέτη' }).map((r) => r.id), ['b']);
  assert.deepEqual(ep.filterEpActionsHub(rows, { filterNew: 'continuing' }).map((r) => r.id), ['b']);
  const grouped = ep.groupEpActionsByAxis(rows);
  assert.deepEqual(grouped['1'].map((r) => r.id), ['a']);
  assert.deepEqual(ep.sortedAxisKeys(grouped), ['1', '2']);
  assert.equal(ep.countArchivedPrograms([
    { isActive: true },
    { isActive: false },
    { isActive: false }
  ]), 2);
  assert.equal(ep.findActiveProgram([{ id: 'old', isActive: false }, { id: 'now', isActive: true }]).id, 'now');
});

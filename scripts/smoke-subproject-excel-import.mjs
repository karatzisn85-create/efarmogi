/**
 * Γρήγορος έλεγχος: δημιουργία προτύπου → buffer → parse → validate (χωρίς Electron).
 * Εκτέλεση: node scripts/smoke-subproject-excel-import.mjs
 */
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const require = createRequire(import.meta.url);
const ExcelJS = require(path.join(root, 'node_modules/exceljs'));
const m = require(path.join(root, 'public/subprojectExcelImport.js'));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const wb = m.buildTemplateWorkbook(ExcelJS);

  assert(wb.getWorksheet('LISTS'), 'Missing hidden sheet LISTS');
  assert(wb.getWorksheet('META'), 'Missing hidden sheet META');
  assert(wb.getWorksheet('Οδηγίες'), 'Missing sheet Οδηγίες');
  const ws = wb.getWorksheet('Υποέργα');
  assert(ws, 'Missing sheet Υποέργα');

  const cf = ws.conditionalFormattings || ws.model?.conditionalFormattings;
  const nRules = Array.isArray(cf) ? cf.length : 0;
  assert(nRules >= 5, `Expected conditional rules, got ${nRules}`);

  const dvm = ws.dataValidations?.model;
  const nDv = dvm && typeof dvm === 'object' ? Object.keys(dvm).length : 0;
  assert(nDv >= 7, `Expected data validations (dropdowns), got ${nDv}`);

  // Parse φρέσκου προτύπου (κενό) — έγκυρη έκδοση, χωρίς parse errors, χωρίς γραμμές
  const buf = await wb.xlsx.writeBuffer();
  const parsed = await m.parseImportWorkbookBuffer(Buffer.from(buf));
  assert(parsed.versionOk, 'versionOk false on fresh template');
  assert(parsed.parseErrors.length === 0, JSON.stringify(parsed.parseErrors));
  assert(parsed.rows.length === 0, `Expected 0 rows on fresh template, got ${parsed.rows.length}`);

  // Μία έγκυρη γραμμή (μη συγχρηματοδοτούμενη)
  const keys = m.COLUMN_KEYS;
  const r = ws.getRow(2);
  const set = (key, val) => {
    const i = keys.indexOf(key);
    if (i < 0) throw new Error('unknown key ' + key);
    r.getCell(i + 1).value = val;
  };
  set('projectTitle', 'Ανάπλαση πλατείας κέντρου');
  set('subprojectTitle', 'Κατασκευή έργου ανάπλασης');
  set('projectType', 'ΕΡΓΟ');
  set('projectStatus', 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ');
  set('aleCodes', '02.15.6262 / 02.30.7331');
  set('coFinanced', 'Όχι');
  set('fundingSource1', 'ΠΡΟΓΡΑΜΜΑ ΦΙΛΟΔΗΜΟΣ ΙΙ');
  set('fundingDetails1', 'Π001. Προμήθεια μηχανημάτων έργου, οχημάτων ή/και συνοδευτικού εξοπλισμού');
  set('amount1', '25.125,23');
  r.commit && r.commit();

  const buf2 = await wb.xlsx.writeBuffer();
  const p2 = await m.parseImportWorkbookBuffer(Buffer.from(buf2));
  assert(p2.rows.length === 1, `Expected 1 row, got ${p2.rows.length}`);
  const v2 = m.validateAllRows(p2.rows);
  assert(v2.errors.length === 0, 'Expected valid row: ' + JSON.stringify(v2.errors));
  assert(v2.validRows.length === 1, 'Expected 1 valid row');
  const proj = v2.validRows[0].project;
  assert(proj.approvedAmount === '25.125,23', 'approvedAmount mismatch: ' + proj.approvedAmount);
  assert(Array.isArray(proj.aleCodes) && proj.aleCodes.length === 2, 'aleCodes split failed');
  assert(proj.implementationForm === '', 'implementationForm should stay empty for KHMDHS later');
  assert(proj.khmdhsAdam === '', 'khmdhsAdam should stay empty for KHMDHS later');
  assert(!proj.projectId && !proj.subprojectId, 'project should not carry ids');

  // Έλεγχος συγχρηματοδότησης (2 πηγές, άθροισμα)
  const r3 = ws.getRow(3);
  const set3 = (key, val) => { r3.getCell(keys.indexOf(key) + 1).value = val; };
  set3('projectTitle', 'Ανάπλαση πλατείας κέντρου');
  set3('subprojectTitle', 'Προμήθεια αστικού εξοπλισμού');
  set3('projectType', 'ΠΡΟΜΗΘΕΙΑ');
  set3('projectStatus', 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ');
  set3('aleCodes', '02.15.6262');
  set3('coFinanced', 'Ναι');
  set3('fundingSource1', 'ΠΡΟΓΡΑΜΜΑ ΦΙΛΟΔΗΜΟΣ ΙΙ');
  set3('fundingDetails1', 'Π001. Προμήθεια μηχανημάτων έργου, οχημάτων ή/και συνοδευτικού εξοπλισμού');
  set3('amount1', '10.000,00');
  set3('fundingSource2', 'ΛΟΙΠΑ ΠΡΟΓΡΑΜΜΑΤΑ ή ΠΟΡΟΙ');
  set3('fundingDetails2', '1099. ΙΔΙΟΙ ΠΟΡΟΙ');
  set3('amount2', '5.000,00');

  const buf3 = await wb.xlsx.writeBuffer();
  const p3 = await m.parseImportWorkbookBuffer(Buffer.from(buf3));
  const v3 = m.validateAllRows(p3.rows);
  assert(v3.errors.length === 0, 'Expected valid co-financed row: ' + JSON.stringify(v3.errors));
  const co = v3.validRows.find((x) => x.project.coFinanced);
  assert(co, 'co-financed project missing');
  // Άθροισμα εκτός ιδίων πόρων = 10.000,00
  assert(co.project.approvedAmount === '10.000,00', 'co approvedAmount mismatch: ' + co.project.approvedAmount);
  assert(co.project.fundingSources.length === 2, 'expected 2 funding sources');

  console.log('smoke-subproject-excel-import: OK (template, CF, DV, parse, validate, co-financing)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

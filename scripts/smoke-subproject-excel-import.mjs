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

async function main() {
  const wb = await m.buildTemplateWorkbook(ExcelJS);
  const wsLists = wb.getWorksheet('ΛίστεςΕπιλογών');
  if (!wsLists) throw new Error('Missing hidden sheet ΛίστεςΕπιλογών');
  const ws = wb.getWorksheet('Υποέργα');
  if (!ws) throw new Error('Missing sheet Υποέργα');
  const cf = ws.conditionalFormattings || ws.model?.conditionalFormattings;
  const nRules = Array.isArray(cf) ? cf.length : 0;
  if (nRules < 5) throw new Error(`Expected conditional rules, got ${nRules}`);
  const dvm = ws.dataValidations?.model;
  const nDv = dvm && typeof dvm === 'object' ? Object.keys(dvm).length : 0;
  if (nDv < 8) throw new Error(`Expected data validations (dropdowns), got ${nDv}`);

  const buf = await wb.xlsx.writeBuffer();
  const parsed = await m.parseImportWorkbookBuffer(Buffer.from(buf));
  if (!parsed.versionOk) throw new Error('versionOk false on fresh template');
  if (parsed.parseErrors.length) throw new Error(JSON.stringify(parsed.parseErrors));

  // Μία γραμμή: «Υπο βραχυπρόθεσμη ωρίμανση» + «Μια Σύμβαση» — δεν απαιτούνται πεδία σύμβασης
  const r = ws.addRow([]);
  const keys = m.COLUMN_KEYS;
  const set = (key, val) => {
    const i = keys.indexOf(key);
    if (i < 0) throw new Error(key);
    r.getCell(i + 1).value = val;
  };
  set('projectTitle', 'Smoke Έργο');
  set('subprojectTitle', 'Smoke Υποέργο');
  set('implementationForm', 'Μια Σύμβαση');
  set('projectType', 'ΕΡΓΟ');
  set('fundingSource', 'ΠΡΟΓΡΑΜΜΑ ΦΙΛΟΔΗΜΟΣ ΙΙ');
  set('fundingDetails', 'Π001. Προμήθεια μηχανημάτων έργου, οχημάτων ή/και συνοδευτικού εξοπλισμού');
  set('approvedAmount', '1.000,00');
  set('projectBudget', '2.000,00');
  set('projectStatus', 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ');

  const buf2 = await wb.xlsx.writeBuffer();
  const p2 = await m.parseImportWorkbookBuffer(Buffer.from(buf2));
  const v2 = m.validateAllRows(p2.rows);
  if (v2.errors.length) throw new Error('Expected valid row: ' + JSON.stringify(v2.errors));

  console.log('smoke-subproject-excel-import: OK (template, parse, CF rules, validate sample row)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

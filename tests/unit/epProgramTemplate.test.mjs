import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { writeEpImportTemplateFile } = require('../../public/epProgramTemplate.js');
const ExcelJS = require('exceljs');

function loadJsZip() {
  try { return require('jszip'); } catch (_e) { /* συνεχίζουμε */ }
  try { return require('exceljs/node_modules/jszip'); } catch (_e) { return null; }
}

function validationsByColumn(sheet) {
  const model = (sheet.dataValidations && sheet.dataValidations.model) || {};
  const byCol = {};
  Object.entries(model).forEach(([range, rule]) => {
    const clean = String(range).replace(/\$/g, '').toUpperCase();
    const col = clean.charAt(0);
    if (!/^[B-I]$/.test(col)) return;
    if (!byCol[col] || clean === `${col}3` || clean.startsWith(`${col}3:`)) {
      byCol[col] = { range, rule };
    }
  });
  return byCol;
}

async function writeAndRead(opts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-tpl-'));
  const written = await writeEpImportTemplateFile({
    startYear: 2024,
    endYear: 2028,
    tempDir: dir,
    ...opts
  });
  assert.equal(written.success, true);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(written.outputPath);
  return { written, wb };
}

test('το πρότυπο Excel έχει φύλλο λιστών και αναπτυσσόμενες στήλες', async () => {
  const { wb } = await writeAndRead({ municipalUnits: ['Αστερουσίων'] });
  const lists = wb.getWorksheet('ΛΙΣΤΕΣ');
  assert.ok(lists);
  assert.match(String(lists.getCell('A2').value || ''), /Έργο/);
  assert.match(String(lists.getCell('B2').value || ''), /Νέα/);
  assert.match(String(lists.getCell('C2').value || ''), /Α/);
  assert.match(String(lists.getCell('D2').value || ''), /Αστερουσίων/);
  const byCol = validationsByColumn(wb.getWorksheet('ΕΠ_ΔΡΑΣΕΙΣ'));
  assert.ok(byCol.B, 'λίστα άξονα');
  assert.ok(byCol.C, 'λίστα μέτρου');
  assert.ok(byCol.D, 'λίστα ειδικού στόχου');
  assert.ok(byCol.F, 'λίστα είδους');
  assert.ok(byCol.G, 'λίστα νέας/συνεχιζόμενης');
  assert.ok(byCol.H, 'λίστα χωροθέτησης');
  assert.ok(byCol.I, 'λίστα προτεραιότητας');
});

test('οι κενές λίστες άξονα γεμίζουν από τις επόμενες γραμμές, όχι από το παράδειγμα', async () => {
  const { wb } = await writeAndRead({ municipalUnits: ['Αστερουσίων'] });
  const byCol = validationsByColumn(wb.getWorksheet('ΕΠ_ΔΡΑΣΕΙΣ'));
  const formulaB = String((byCol.B.rule.formulae || [])[0] || '');
  const formulaC = String((byCol.C.rule.formulae || [])[0] || '');
  const formulaD = String((byCol.D.rule.formulae || [])[0] || '');
  assert.match(formulaB, /OFFSET\(\$B\$4/);
  assert.match(formulaB, /COUNTA/);
  assert.equal(formulaB.includes('!'), false);
  assert.match(formulaC, /\$C\$4/);
  assert.match(formulaD, /\$D\$4/);
  assert.equal(!!byCol.B.rule.showErrorMessage, false);
  assert.equal(!!byCol.C.rule.showErrorMessage, false);
  assert.equal(!!byCol.D.rule.showErrorMessage, false);
  assert.equal(byCol.F.rule.showErrorMessage, true);
  assert.equal(byCol.G.rule.showErrorMessage, true);
  assert.equal(byCol.I.rule.showErrorMessage, true);
  assert.equal(!!byCol.H.rule.showErrorMessage, false);
  assert.equal(byCol.H.rule.errorStyle, 'warning');
  assert.equal(String((byCol.F.rule.formulae || [])[0] || ''), 'EPTYPES');
  assert.equal(String((byCol.H.rule.formulae || [])[0] || ''), 'EPLOCATION');
});

test('το πρότυπο είναι έγκυρο xlsx και οι λίστες δεν έχουν σκέτα ελληνικά ονόματα φύλλων', async () => {
  const { written, wb } = await writeAndRead({ municipalUnits: ['Αστερουσίων'] });
  const buf = fs.readFileSync(written.outputPath);
  assert.equal(buf[0], 0x50);
  assert.equal(buf[1], 0x4b);
  const names = JSON.stringify((wb.definedNames && wb.definedNames.model) || {});
  assert.match(names, /EPTYPES/);
  assert.match(names, /EPLOCATION/);
  const byCol = validationsByColumn(wb.getWorksheet('ΕΠ_ΔΡΑΣΕΙΣ'));
  assert.match(String((byCol.B.rule.formulae || [])[0] || ''), /OFFSET\(\$B\$4/);
  assert.equal(String((byCol.F.rule.formulae || [])[0] || ''), 'EPTYPES');
  Object.values(byCol).forEach(({ rule }) => {
    const formula = String((rule.formulae || [])[0] || '');
    assert.equal(/[Α-Ωα-ω].*!/.test(formula), false, formula);
  });
  const JSZip = loadJsZip();
  if (JSZip) {
    const zip = await JSZip.loadAsync(buf);
    const xmlNames = Object.keys(zip.files).filter((n) => /\.(xml|rels)$/i.test(n));
    assert.ok(xmlNames.includes('xl/workbook.xml'));
    assert.ok(xmlNames.some((n) => /worksheets\/sheet/i.test(n)));
    for (const name of xmlNames) {
      const xml = await zip.file(name).async('string');
      assert.ok(xml.includes('<'), name);
      assert.equal(xml.includes('undefined'), false, name);
    }
    const book = await zip.file('xl/workbook.xml').async('string');
    assert.match(book, /definedName[^>]*name="EPTYPES"/);
    const sheetXmls = [];
    for (const name of xmlNames.filter((n) => /worksheets\/sheet\d+\.xml$/i.test(n))) {
      sheetXmls.push(await zip.file(name).async('string'));
    }
    const dvXml = sheetXmls.find((xml) => xml.includes('dataValidations')) || '';
    assert.match(dvXml, /EPTYPES/);
    assert.match(dvXml, /OFFSET/);
    assert.equal(/formula1[^<]*[Α-Ωα-ω]/.test(dvXml), false);
  }
});

test('χωρίς δημοτικές ενότητες η λίστα χωροθέτησης έχει παράδειγμα μεγάλου δήμου', async () => {
  const { wb } = await writeAndRead({ municipalUnits: [] });
  const lists = wb.getWorksheet('ΛΙΣΤΕΣ');
  assert.match(String(lists.getCell('D2').value || ''), /Θεσσαλονίκης/);
});

test('τετραετία κρατά τις ίδιες λίστες στις στήλες δράσεων', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-tpl-'));
  const written = await writeEpImportTemplateFile({
    startYear: 2024,
    endYear: 2027,
    tempDir: dir,
    municipalUnits: ['Αστερουσίων']
  });
  assert.equal(written.success, true);
  assert.match(written.filename, /2024-2027/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(written.outputPath);
  const byCol = validationsByColumn(wb.getWorksheet('ΕΠ_ΔΡΑΣΕΙΣ'));
  assert.ok(byCol.B && byCol.C && byCol.D && byCol.F && byCol.G && byCol.H && byCol.I);
  assert.match(String(wb.getWorksheet('ΛΙΣΤΕΣ').getCell('A2').value || ''), /Έργο/);
});

test('άκυρη περίοδος δεν γράφει αρχείο προτύπου', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-tpl-'));
  const written = await writeEpImportTemplateFile({
    startYear: 2024,
    endYear: 2026,
    tempDir: dir
  });
  assert.equal(written.ok, false);
  assert.match(String(written.error || ''), /τετραετία ή πενταετία/);
});

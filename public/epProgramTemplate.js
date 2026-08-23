/**
 * Πρότυπο Excel εισαγωγής Επιχειρησιακού Προγράμματος.
 * Γράφεται μία φορά με ExcelJS (ίδια λογική με το πρότυπο μαζικής εισαγωγής),
 * ώστε το Excel να μην το βλέπει ως κατεστραμμένο.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const epProgramCatalog = require('../app/core/epProgramCatalog');

const THIN = { style: 'thin', color: { argb: 'FFCBD5E1' } };
const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN };

function paint(cell, spec) {
  if (spec.font) cell.font = spec.font;
  if (spec.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: spec.fill } };
  if (spec.alignment) cell.alignment = spec.alignment;
  if (spec.border) cell.border = BORDER;
}

const STYLE = {
  headerGroup: {
    font: { bold: true, size: 10, color: { argb: 'FFFFFFFF' } },
    fill: 'FF4F46E5',
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: true
  },
  headerCol: {
    font: { bold: true, size: 9, color: { argb: 'FF1E293B' } },
    fill: 'FFC7D2FE',
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: true
  },
  example: {
    font: { italic: true, size: 10, color: { argb: 'FF334155' } },
    fill: 'FFFEF9C3',
    alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
    border: true
  },
  empty: {
    alignment: { horizontal: 'left', vertical: 'middle' },
    border: true
  },
  title: {
    font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' } },
    fill: 'FF4F46E5',
    alignment: { horizontal: 'left', vertical: 'middle' }
  },
  sub: {
    font: { bold: true, size: 12, color: { argb: 'FF4338CA' } },
    fill: 'FFEEF2FF'
  },
  section: {
    font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
    fill: 'FF6366F1'
  },
  body: {
    font: { size: 10, color: { argb: 'FF1E293B' } },
    alignment: { wrapText: true, vertical: 'middle' }
  },
  highlight: {
    font: { bold: true, size: 11, color: { argb: 'FF92400E' } },
    fill: 'FFFEF3C3',
    alignment: { wrapText: true, vertical: 'middle' }
  },
  highlightBody: {
    font: { size: 11, color: { argb: 'FF78350F' } },
    fill: 'FFFFFBEB',
    alignment: { wrapText: true, vertical: 'middle' }
  }
};

function writeRow(sheet, rowIndex, values, style) {
  const row = sheet.getRow(rowIndex);
  (values || []).forEach((value, idx) => {
    const cell = row.getCell(idx + 1);
    cell.value = value == null ? '' : value;
    paint(cell, style);
  });
  return row;
}

function applyEpTemplateDropdowns(wb, listModel) {
  if (!wb || !listModel) return;
  const data = wb.getWorksheet(epProgramCatalog.TEMPLATE_ACTIONS_SHEET);
  if (!data) return;
  const endRow = listModel.dataEndRow;
  const growFrom = listModel.growFromRow || 4;
  const startRow = listModel.dataStartRow;

  (listModel.fixed || []).forEach((col) => {
    if (col.namedRange) {
      wb.definedNames.add(epProgramCatalog.epTemplateFixedListFormula(col), col.namedRange);
    }
    data.dataValidations.add(`${col.col}${startRow}:${col.col}${endRow}`, {
      type: 'list',
      allowBlank: true,
      formulae: [col.namedRange],
      showErrorMessage: !col.allowCustom,
      errorStyle: col.allowCustom ? 'warning' : 'stop',
      errorTitle: 'Επιλογή',
      error: col.allowCustom
        ? 'Επιλέξτε από τη λίστα ή γράψτε νέα τιμή.'
        : 'Επιλέξτε τιμή από τη λίστα.',
      showInputMessage: true,
      promptTitle: col.header,
      prompt: col.allowCustom
        ? 'Επιλέξτε δημοτική ενότητα ή γράψτε νέα. Για επανάληψη, προσθέστε την στο φύλλο Λίστες.'
        : 'Επιλέξτε τιμή από τη λίστα.'
    });
  });

  (listModel.growing || []).forEach((col) => {
    data.dataValidations.add(`${col.col}${startRow}:${col.col}${endRow}`, {
      type: 'list',
      allowBlank: true,
      formulae: [epProgramCatalog.epTemplateGrowingListFormula(col.col, growFrom, endRow)],
      showErrorMessage: false,
      showInputMessage: true,
      promptTitle: col.header,
      prompt: 'Η λίστα ξεκινά κενή. Γράψτε την πρώτη τιμή· στις επόμενες γραμμές θα εμφανίζεται ως επιλογή.'
    });
  });
}

function buildEpImportTemplateWorkbook(startYear, endYear, options) {
  const model = epProgramCatalog.buildEpImportTemplateModel(startYear, endYear, options);
  if (!model.ok) return model;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'ERGOHUB';
  wb.created = new Date();

  const actions = wb.addWorksheet(epProgramCatalog.TEMPLATE_ACTIONS_SHEET, {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 2, activeCell: 'A3' }]
  });
  const widths = [6, 36, 28, 28, 48, 14, 18, 18, 12, 28]
    .concat(model.years.map(() => 12))
    .concat([12, 22, 22, 22]);
  widths.forEach((w, i) => { actions.getColumn(i + 1).width = w; });
  model.actionsRows.forEach((values, idx) => {
    const style = idx === 0 ? STYLE.headerGroup : idx === 1 ? STYLE.headerCol : idx === 2 ? STYLE.example : STYLE.empty;
    const row = writeRow(actions, idx + 1, values, style);
    row.height = idx < 2 ? 28 : 20;
  });

  const info = wb.addWorksheet(epProgramCatalog.TEMPLATE_INFO_SHEET);
  info.getColumn(1).width = 46;
  info.getColumn(2).width = 88;
  const sections = model.instructionSectionTitles || {};
  model.instructionRows.forEach((values, idx) => {
    const title = String((values || [])[0] || '');
    const prev = String((model.instructionRows[idx - 1] || [])[0] || '');
    let style = STYLE.body;
    if (idx === 0) style = STYLE.title;
    else if (idx === 1) style = STYLE.sub;
    else if (sections[title] === 'highlight') style = STYLE.highlight;
    else if (sections[title] === 'section') style = STYLE.section;
    else if (idx > 0 && sections[prev] === 'highlight') style = STYLE.highlightBody;
    const row = writeRow(info, idx + 1, values, style);
    const text = (values || []).join(' ');
    const lines = Math.max(1, Math.ceil(text.length / 90));
    row.height = idx === 0 ? 28 : Math.min(64, 18 + (lines - 1) * 14);
  });
  info.mergeCells(1, 1, 1, 2);
  info.mergeCells(2, 1, 2, 2);

  const listModel = model.listModel;
  if (listModel) {
    const lists = wb.addWorksheet(listModel.listsSheetName);
    const fixedByKey = {};
    (listModel.fixed || []).forEach((col) => { fixedByKey[col.key] = col; });
    const typeVals = (fixedByKey.actionType && fixedByKey.actionType.values) || [];
    const newVals = (fixedByKey.newCont && fixedByKey.newCont.values) || [];
    const prioVals = (fixedByKey.priority && fixedByKey.priority.values) || [];
    const locVals = (fixedByKey.location && fixedByKey.location.values) || [];
    const extraBlank = 20;
    const maxLen = Math.max(typeVals.length, newVals.length, prioVals.length, locVals.length + extraBlank, 1);
    writeRow(lists, 1, ['ΕΙΔΟΣ ΔΡΑΣΗΣ', 'ΝΕΑ / ΣΥΝΕΧΙΖΟΜΕΝΗ', 'ΠΡΟΤΕΡΑΙΟΤΗΤΑ', 'ΧΩΡΟΘΕΤΗΣΗ'], STYLE.headerCol);
    for (let i = 0; i < maxLen; i += 1) {
      writeRow(lists, i + 2, [
        typeVals[i] || '',
        newVals[i] || '',
        prioVals[i] || '',
        locVals[i] || ''
      ], STYLE.empty);
    }
    lists.getColumn(1).width = 22;
    lists.getColumn(2).width = 22;
    lists.getColumn(3).width = 16;
    lists.getColumn(4).width = 28;
    applyEpTemplateDropdowns(wb, listModel);
  }

  wb.views = [{ activeTab: 0, firstSheet: 0 }];
  return {
    ok: true,
    workbook: wb,
    filename: model.filename,
    period: model.period,
    years: model.years,
    listModel: listModel
  };
}

async function writeEpImportTemplateFile({ startYear, endYear, tempDir, municipalUnits, exampleLocation }) {
  const built = buildEpImportTemplateWorkbook(startYear, endYear, { municipalUnits, exampleLocation });
  if (!built.ok) return built;
  const outDir = tempDir || path.join(os.tmpdir(), 'ergohub_ep_template');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outputPath = path.join(outDir, built.filename);
  await built.workbook.xlsx.writeFile(outputPath);
  return {
    ok: true,
    success: true,
    filename: built.filename,
    outputPath,
    periodLabel: built.period.label,
    yearCount: built.years.length
  };
}

module.exports = {
  buildEpImportTemplateWorkbook,
  applyEpTemplateDropdowns,
  writeEpImportTemplateFile
};

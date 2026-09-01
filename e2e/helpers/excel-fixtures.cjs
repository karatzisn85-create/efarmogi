'use strict';

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { buildTemplateWorkbook, SHEET_DATA, COLUMNS } = require('../../public/subprojectExcelImport');

const VALID_ROW = {
  projectTitle: 'Νέο έργο Excel Αρχανών',
  subprojectTitle: 'Υποέργο εισαγωγής Α',
  projectType: 'ΕΡΓΟ',
  projectStatus: 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ',
  aleCodes: '10.10.10',
  coFinanced: 'Όχι',
  fundingSource1: 'ΕΣΠΑ 2021_2027',
  fundingDetails1: '0501. ΕΠ Ανταγωνιστικότητα',
  amount1: 25000,
};

const DUP_BRIDGE = {
  ...VALID_ROW,
  projectTitle: 'Οδικό δίκτυο Αρχανών',
  subprojectTitle: 'Γέφυρα Αγίου Σύλλα',
  amount1: 99999,
};

async function writeImportXlsx(filePath, rows) {
  const wb = buildTemplateWorkbook(ExcelJS);
  const sheet = wb.getWorksheet(SHEET_DATA);
  rows.forEach((row, i) => {
    COLUMNS.forEach((col, ci) => {
      if (row[col.key] != null && row[col.key] !== '') {
        sheet.getCell(i + 2, ci + 1).value = row[col.key];
      }
    });
  });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await wb.xlsx.writeFile(filePath);
  return filePath;
}

async function writeJunkXlsx(filePath) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Φύλλο1');
  ws.getCell('A1').value = 'αυτό δεν είναι πρότυπο';
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await wb.xlsx.writeFile(filePath);
  return filePath;
}

module.exports = {
  VALID_ROW,
  DUP_BRIDGE,
  writeImportXlsx,
  writeJunkXlsx,
};

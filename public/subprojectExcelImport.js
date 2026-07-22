/**
 * Μαζική εισαγωγή υποέργων μέσω Excel (μόνο SUPERADMIN).
 *
 * Το module είναι αυτόνομο (χωρίς Electron) ώστε να δοκιμάζεται και εκτός εφαρμογής:
 *  - buildTemplateWorkbook(ExcelJS)  → πλήρως μορφοποιημένο πρότυπο προς συμπλήρωση
 *  - parseImportWorkbookBuffer(buf)  → ανάγνωση + καθαρισμός αόρατων χαρακτήρων
 *  - validateAllRows(rows)           → έλεγχοι + έτοιμα αντικείμενα υποέργων
 *
 * Οι λίστες τιμών για είδος/κατάσταση έρχονται από το subprojectImportEnums.json
 * (snapshot του src/data/formOptions.js — `npm run export-subproject-import-enums`).
 * Οι πηγές χρηματοδότησης / εξειδικεύσεις μπορούν να δοθούν live μέσω options.fundingEnums
 * (από τις ρυθμίσεις του Δήμου στην εφαρμογή).
 * Μορφή υλοποίησης και ΑΔΑΜ δεν ζητούνται στο Excel — συμπληρώνονται αργότερα από ΚΗΜΔΗΣ/εφαρμογή.
 */

'use strict';

const path = require('path');

let ENUMS;
try {
  ENUMS = require('./subprojectImportEnums.json');
} catch (e) {
  ENUMS = {
    IMPLEMENTATION_FORMS: [],
    PROJECT_TYPES: [],
    FUNDING_SOURCES: [],
    PROJECT_STATUSES: [],
    FUNDING_DETAILS: {},
    STATUSES_WITH_CONTRACT_FIELDS: [],
  };
}

const TEMPLATE_VERSION = 'ERGOHUB_SUBPROJECT_IMPORT_V7';

const SHEET_DATA = 'Υποέργα';
const SHEET_INFO = 'Οδηγίες';
const SHEET_LISTS = 'LISTS';
const SHEET_META = 'META';

/** Καταστάσεις που ΔΕΝ εισάγονται στην αρχική μαζική εισαγωγή. */
const EXCLUDED_STATUSES = new Set([
  'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ',
  'ΑΠΕΝΤΑΓΜΕΝΟ',
]);

const ALLOWED_STATUSES = (ENUMS.PROJECT_STATUSES || []).filter(
  (s) => !EXCLUDED_STATUSES.has(s)
);

const YES = 'Ναι';
const NO = 'Όχι';

const DATA_ROWS = 500; // χωρητικότητα προτύπου (γραμμές προς συμπλήρωση)

/**
 * Ορισμός στηλών (σειρά = σειρά στο Excel).
 * kind: text | list | source | details | amount
 */
const COLUMNS = [
  { key: 'projectTitle', header: 'Τίτλος Έργου / Πράξης', required: true, kind: 'text', width: 36 },
  { key: 'subprojectTitle', header: 'Τίτλος Υποέργου', required: true, kind: 'text', width: 36 },
  { key: 'projectType', header: 'Είδος', required: true, kind: 'list', list: 'EIDI', width: 22 },
  { key: 'projectStatus', header: 'Κατάσταση Έργου', required: true, kind: 'list', list: 'KATASTASI', width: 28 },
  { key: 'aleCodes', header: 'Κωδ. Α.Λ.Ε. (πολλαπλά με /)', required: true, kind: 'text', width: 26 },
  { key: 'coFinanced', header: 'Συγχρηματοδοτούμενο', required: true, kind: 'list', list: 'NAIOXI', width: 16 },
  { key: 'fundingSource1', header: 'Πηγή Χρηματοδότησης 1', required: true, kind: 'source', srcIndex: 1, width: 26 },
  { key: 'fundingDetails1', header: 'Εξειδίκευση Πηγής 1', required: true, kind: 'details', srcIndex: 1, width: 34 },
  { key: 'amount1', header: 'Ποσό 1', required: true, kind: 'amount', width: 16 },
  { key: 'fundingSource2', header: 'Πηγή Χρηματοδότησης 2 (μόνο αν Ναι)', required: false, kind: 'source', srcIndex: 2, width: 28 },
  { key: 'fundingDetails2', header: 'Εξειδίκευση Πηγής 2 (μόνο αν Ναι)', required: false, kind: 'details', srcIndex: 2, width: 34 },
  { key: 'amount2', header: 'Ποσό 2 (μόνο αν Ναι)', required: false, kind: 'amount', width: 16 },
  { key: 'comments', header: 'Σχόλια', required: false, kind: 'text', width: 30 },
  { key: 'eisigitikiEkthesi', header: 'Αναφορά προγράμματος Οικονομικής', required: false, kind: 'text', width: 30 },
];

const COLUMN_KEYS = COLUMNS.map((c) => c.key);
const COL_BY_KEY = {};
COLUMNS.forEach((c, i) => { COL_BY_KEY[c.key] = { ...c, colNumber: i + 1 }; });

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Μετατροπή αριθμού στήλης (1-based) σε γράμμα (A, B, ..., AA). */
function numToCol(n) {
  let s = '';
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/**
 * Καθαρισμός κειμένου κελιού από αόρατες/ύποπτες διαφορές που προκύπτουν συχνά
 * από αντιγραφή-επικόλληση (BOM, zero-width, NBSP, αλλαγές γραμμής, διπλά κενά).
 */
function sanitizeCellText(value) {
  if (value == null) return '';
  let s = String(value);
  // Zero-width & word-joiner & BOM
  s = s.replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, '');
  // Όλα τα «περίεργα» κενά → κανονικό κενό
  s = s.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
  // Αλλαγές γραμμής / tabs → κενό
  s = s.replace(/\r\n?|\n|\u000B|\u000C|\u0085|\u2028|\u2029|\t/g, ' ');
  // Σύμπτυξη πολλαπλών κενών
  s = s.replace(/\s+/g, ' ').trim();
  try { s = s.normalize('NFC'); } catch (e) { /* noop */ }
  return s;
}

/** Κανονικοποίηση τίτλου για σύγκριση/ομαδοποίηση (ίδια λογική με electron.js). */
function normalizeTitleKey(text) {
  return sanitizeCellText(text).toLowerCase();
}

/** Είναι «ίδιοι πόροι» η εξειδίκευση; (εξαιρείται από το εγκεκριμένο ποσό) */
function isOwnResourcesDetail(details) {
  return String(details || '').toUpperCase().includes('ΙΔΙΟΙ ΠΟΡΟΙ');
}

/**
 * Μετατροπή τιμής ποσού σε αριθμό. Δέχεται είτε αριθμό (από αριθμητικό κελί) είτε
 * κείμενο ελληνικής μορφής «25.125,23» ή διεθνούς «25125.23».
 * Επιστρέφει NaN αν δεν αναγνωρίζεται.
 */
function amountToNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const cleaned = sanitizeCellText(value).replace(/[^\d,.-]/g, '');
  if (!cleaned) return NaN;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  let normalized;
  if (hasComma && hasDot) normalized = cleaned.replace(/\./g, '').replace(',', '.');
  else if (hasComma) normalized = cleaned.replace(',', '.');
  else if (hasDot) {
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount === 1) {
      const [, frac = ''] = cleaned.split('.');
      normalized = frac.length <= 2 ? cleaned : cleaned.replace(/\./g, '');
    } else normalized = cleaned.replace(/\./g, '');
  } else normalized = cleaned;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/** Μορφοποίηση αριθμού σε ελληνική μορφή «25.125,23» (χωρίς εξάρτηση από locale). */
function formatAmountGr(num) {
  if (!Number.isFinite(num)) return '';
  const neg = num < 0;
  const fixed = Math.abs(num).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + withThousands + ',' + decPart;
}

/** Διάσπαση κωδικών Α.Λ.Ε. σε array — διαχωριστής «/», με ανοχή σε κενά γύρω του. */
function splitAleCodes(text) {
  return sanitizeCellText(text)
    .split('/')
    .map((x) => x.trim())
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Πρότυπο (template) workbook
// ─────────────────────────────────────────────────────────────────────────────

const COLOR = {
  headerReq: 'FF4F46E5',
  headerOpt: 'FF64748B',
  headerFont: 'FFFFFFFF',
  info: 'FF1E293B',
  infoAccent: 'FF6366F1',
  zebra: 'FFF8FAFF',
  border: 'FFCBD5E1',
  warnFill: 'FFFDE68A',
};

function thinBorder() {
  return {
    top: { style: 'thin', color: { argb: COLOR.border } },
    left: { style: 'thin', color: { argb: COLOR.border } },
    bottom: { style: 'thin', color: { argb: COLOR.border } },
    right: { style: 'thin', color: { argb: COLOR.border } },
  };
}

/**
 * Επιστρέφει τις λίστες πηγών/εξειδικεύσεων προς χρήση σε πρότυπο & validation.
 * Αν δοθεί override (από τις live ρυθμίσεις της εφαρμογής), αυτό υπερισχύει.
 */
function resolveFundingEnums(override) {
  const sources = (override && Array.isArray(override.FUNDING_SOURCES) && override.FUNDING_SOURCES.length)
    ? override.FUNDING_SOURCES
    : (ENUMS.FUNDING_SOURCES || []);
  const details = (override && override.FUNDING_DETAILS && typeof override.FUNDING_DETAILS === 'object')
    ? override.FUNDING_DETAILS
    : (ENUMS.FUNDING_DETAILS || {});
  return { FUNDING_SOURCES: sources, FUNDING_DETAILS: details };
}

function buildTemplateWorkbook(ExcelJSArg, options = {}) {
  const ExcelJS = ExcelJSArg || require('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ERGOHUB';
  wb.created = new Date();

  const funding = resolveFundingEnums(options.fundingEnums);

  // ── ΟΔΗΓΙΕΣ (πρώτο ορατό φύλλο)
  buildInfoSheet(wb);

  // ── ΥΠΟΕΡΓΑ (κύριο φύλλο — ενεργό στην έναρξη)
  const ws = wb.addWorksheet(SHEET_DATA, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2' }],
  });

  // ── LISTS: ΟΡΑΤΟ (όχι veryHidden). Το Excel αδυνατεί να γεμίσει
  //    εξαρτημένες λίστες (INDIRECT) όταν οι ονομαστικές περιοχές δείχνουν σε veryHidden φύλλο.
  const lists = wb.addWorksheet(SHEET_LISTS);
  const sources = funding.FUNDING_SOURCES || [];
  const types = ENUMS.PROJECT_TYPES || [];
  const fundingDetails = funding.FUNDING_DETAILS || {};

  lists.getCell('A1').value = 'ΠΗΓΕΣ';
  sources.forEach((v, i) => { lists.getCell(`A${i + 2}`).value = v; });
  lists.getCell('B1').value = 'ΕΙΔΗ';
  types.forEach((v, i) => { lists.getCell(`B${i + 2}`).value = v; });
  lists.getCell('C1').value = 'ΚΑΤΑΣΤΑΣΕΙΣ';
  ALLOWED_STATUSES.forEach((v, i) => { lists.getCell(`C${i + 2}`).value = v; });
  lists.getCell('D1').value = 'ΝΑΙ/ΟΧΙ';
  lists.getCell('D2').value = YES;
  lists.getCell('D3').value = NO;

  // Σημείωση για τον χρήστη (μακριά από τις λίστες που διαβάζει το Excel)
  lists.getCell('S1').value = 'ΜΗΝ ΕΠΕΞΕΡΓΑΖΕΣΤΕ αυτό το φύλλο — τροφοδοτεί τις λίστες επιλογής του φύλλου «Υποέργα».';
  lists.getCell('S1').font = { bold: true, color: { argb: 'FFB45309' }, size: 11 };
  lists.getColumn(19).width = 70;

  // Map H/I στο LISTS: μόνο για αναφορά
  lists.getCell('H1').value = 'MAP_ΠΗΓΗ';
  lists.getCell('I1').value = 'MAP_Εύρος';

  // Ονομαστικές περιοχές (απλές λίστες)
  if (sources.length) wb.definedNames.add(`${SHEET_LISTS}!$A$2:$A$${sources.length + 1}`, 'PIGES');
  if (types.length) wb.definedNames.add(`${SHEET_LISTS}!$B$2:$B$${types.length + 1}`, 'EIDI');
  if (ALLOWED_STATUSES.length) wb.definedNames.add(`${SHEET_LISTS}!$C$2:$C$${ALLOWED_STATUSES.length + 1}`, 'KATASTASI');
  wb.definedNames.add(`${SHEET_LISTS}!$D$2:$D$3`, 'NAIOXI');

  // ── META (κρυφό): έκδοση προτύπου
  const meta = wb.addWorksheet(SHEET_META, { state: 'veryHidden' });
  meta.getCell('A1').value = TEMPLATE_VERSION;

  // Κεφαλίδα Υποέργων
  const headerRow = ws.getRow(1);
  headerRow.height = 46;
  COLUMNS.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.required ? `${c.header} *` : c.header;
    cell.font = { bold: true, color: { argb: COLOR.headerFont }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.required ? COLOR.headerReq : COLOR.headerOpt } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder();
  });

  // Πλάτη + στοίχιση/αναδίπλωση στηλών, μορφή ποσού
  COLUMNS.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.width || 20;
    col.alignment = {
      vertical: 'top',
      horizontal: c.kind === 'amount' ? 'right' : 'left',
      wrapText: true,
    };
    if (c.kind === 'amount') col.numFmt = '#,##0.00';
  });

  // Στυλ κελιών δεδομένων (borders + zebra) για DATA_ROWS γραμμές
  for (let r = 2; r <= DATA_ROWS + 1; r++) {
    const row = ws.getRow(r);
    for (let ci = 1; ci <= COLUMNS.length; ci++) {
      const cell = row.getCell(ci);
      cell.border = thinBorder();
      if (r % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.zebra } };
      }
    }
  }

  // Εξειδικεύσεις ΣΤΟ ΙΔΙΟ φύλλο (κρυφές στήλες δεξιά) — CHOOSE δουλεύει αξιόπιστα
  // μόνο με αναφορές στο ίδιο φύλλο με το data validation.
  const DETAIL_HIDDEN_START = COLUMNS.length + 3; // κενό buffer μετά τα ορατά
  const detailRangeAddrs = [];
  sources.forEach((src, i) => {
    const colNum = DETAIL_HIDDEN_START + i;
    const col = numToCol(colNum);
    ws.getCell(`${col}1`).value = `DV:${src}`;
    ws.getCell(`${col}1`).font = { size: 8, color: { argb: 'FF94A3B8' } };
    const details = fundingDetails[src] || [];
    details.forEach((d, j) => { ws.getCell(`${col}${j + 2}`).value = d; });
    const lastDetailRow = Math.max(2, details.length + 1);
    // Ίδιο φύλλο → χωρίς όνομα φύλλου (πιο συμβατό για DV)
    const rangeAddr = `$${col}$2:$${col}$${lastDetailRow}`;
    detailRangeAddrs.push(rangeAddr);
    lists.getCell(`H${i + 2}`).value = src;
    lists.getCell(`I${i + 2}`).value = rangeAddr;
    ws.getColumn(colNum).hidden = true;
    ws.getColumn(colNum).width = 12;
  });
  if (sources.length) {
    wb.definedNames.add(`${SHEET_LISTS}!$H$2:$I$${sources.length + 1}`, 'SRCMAP');
  }

  addDataValidations(ws, detailRangeAddrs);
  addConditionalHighlights(ws);

  // Άνοιγμα στο φύλλο «Υποέργα» (index: Οδηγίες=0, Υποέργα=1, LISTS=2)
  wb.views = [{ activeTab: 1, firstSheet: 0 }];

  return wb;
}

function addDataValidations(ws, detailRangeAddrs = []) {
  const lastRow = DATA_ROWS + 1;
  const listFor = {
    EIDI: 'EIDI', KATASTASI: 'KATASTASI', NAIOXI: 'NAIOXI',
  };

  COLUMNS.forEach((c, i) => {
    const colLetter = numToCol(i + 1);
    const range = `${colLetter}2:${colLetter}${lastRow}`;

    if (c.kind === 'list') {
      ws.dataValidations.add(range, {
        type: 'list',
        allowBlank: true,
        formulae: [listFor[c.list]],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Μη έγκυρη τιμή',
        error: 'Επιλέξτε τιμή από τη λίστα.',
      });
    } else if (c.kind === 'source') {
      ws.dataValidations.add(range, {
        type: 'list',
        allowBlank: true,
        formulae: ['PIGES'],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Μη έγκυρη πηγή',
        error: 'Επιλέξτε πηγή χρηματοδότησης από τη λίστα.',
      });
    } else if (c.kind === 'details') {
      const srcCol = COL_BY_KEY[`fundingSource${c.srcIndex}`].colNumber;
      const srcLetter = numToCol(srcCol);
      // CHOOSE+MATCH χωρίς INDIRECT — αξιόπιστο σε Excel/WPS για εξαρτημένες λίστες.
      // CHOOSE(MATCH(πηγή,PIGES,0), εύρος1, εύρος2, ...)
      let detailsFormula;
      if (detailRangeAddrs.length > 0) {
        detailsFormula = `CHOOSE(MATCH($${srcLetter}2,PIGES,0),${detailRangeAddrs.join(',')})`;
      } else {
        detailsFormula = `INDIRECT(VLOOKUP($${srcLetter}2,SRCMAP,2,FALSE))`;
      }
      ws.dataValidations.add(range, {
        type: 'list',
        allowBlank: true,
        formulae: [detailsFormula],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Μη έγκυρη εξειδίκευση',
        error: 'Επιλέξτε πρώτα Πηγή· η εξειδίκευση προκύπτει από αυτήν.',
      });
    }
  });
}

function addConditionalHighlights(ws) {
  const lastRow = DATA_ROWS + 1;
  const aCol = numToCol(COL_BY_KEY.projectTitle.colNumber); // A
  const bCol = numToCol(COL_BY_KEY.subprojectTitle.colNumber); // B
  const missingStyle = {
    fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFECACA' } },
  };
  // «Ενεργή» γραμμή = υπάρχει τίτλος έργου ή υποέργου
  const activeExpr = (r) => `OR($${aCol}${r}<>"",$${bCol}${r}<>"")`;

  COLUMNS.forEach((c, i) => {
    if (!c.required) return;
    const colLetter = numToCol(i + 1);
    ws.addConditionalFormatting({
      ref: `${colLetter}2:${colLetter}${lastRow}`,
      rules: [
        {
          type: 'expression',
          formulae: [`AND(${activeExpr(2)},${colLetter}2="")`],
          style: missingStyle,
          priority: i + 1,
        },
      ],
    });
  });
}

function buildInfoSheet(wb) {
  const ws = wb.addWorksheet(SHEET_INFO, {
    views: [{ showGridLines: false }],
  });
  ws.getColumn(1).width = 3;
  ws.getColumn(2).width = 46;
  ws.getColumn(3).width = 90;

  const title = ws.getCell('B2');
  title.value = 'ΕΡΓΟHUB — Φόρμα Αρχικής Εισαγωγής Έργων & Υποέργων';
  title.font = { bold: true, size: 16, color: { argb: COLOR.infoAccent } };

  const lines = [
    ['', ''],
    ['Πώς συμπληρώνεται', 'Συμπληρώστε ΕΝΑ υποέργο ανά γραμμή, στο φύλλο «Υποέργα». Τα κελιά με λίστα ανοίγουν με βελάκι — επιλέξτε τιμή, μην πληκτρολογείτε ελεύθερα.'],
    ['Υποχρεωτικά πεδία', 'Όσες στήλες έχουν αστερίσκο (*) στην κεφαλίδα είναι υποχρεωτικές. Προαιρετικά είναι μόνο: Σχόλια και Αναφορά προγράμματος Οικονομικής.'],
    ['Έργα με πολλά υποέργα', 'Γράψτε τον ΙΔΙΟ τίτλο Πράξης σε κάθε γραμμή του. Αν επαναλαμβάνεται, κάντε αντιγραφή-επικόλληση τον τίτλο από προηγούμενη γραμμή ώστε να είναι πανομοιότυπος. Έτσι τα υποέργα ομαδοποιούνται σωστά στην ίδια Πράξη.'],
    ['Ποια έργα ΔΕΝ μπαίνουν', 'Δεν εισάγονται τα «Ολοκληρωμένα & Αποπληρωμένα» (κλεισμένα) έργα. Η λίστα κατάστασης δεν τα περιλαμβάνει.'],
    ['Χρηματοδότηση', 'Επιλέξτε πρώτα «Πηγή Χρηματοδότησης 1» και μετά «Εξειδίκευση Πηγής 1» (η λίστα εξειδίκευσης ανοίγει με βελάκι και δείχνει μόνο τις εξειδικεύσεις της επιλεγμένης πηγής). Το «Ποσό 1» είναι το εγκεκριμένο ποσό. Οι λίστες πηγών/εξειδικεύσεων είναι αυτές που ισχύουν στην εφαρμογή τη στιγμή του κατεβάσματος. Το φύλλο «LISTS» τροφοδοτεί τις λίστες — μην το επεξεργάζεστε.'],
    ['Συγχρηματοδοτούμενα', 'Αν το υποέργο έχει δύο πηγές, βάλτε «Συγχρηματοδοτούμενο = Ναι» και συμπληρώστε την 2η πηγή/εξειδίκευση/ποσό (στήλες με ένδειξη «μόνο αν Ναι»). Το εγκεκριμένο ποσό υπολογίζεται αυτόματα ως άθροισμα (εξαιρώντας τους «ΙΔΙΟΥΣ ΠΟΡΟΥΣ»). Αν υπάρχει και 3η πηγή, καταγράφεται αργότερα μέσα στην εφαρμογή.'],
    ['Ποσά', 'Γράψτε τα ποσά σε μορφή 25.125,23 (τελεία για χιλιάδες, κόμμα για δεκαδικά).'],
    ['Κωδ. Α.Λ.Ε.', 'Αν υπάρχουν πολλοί κωδικοί Α.Λ.Ε., χωρίστε τους με κάθετο «/». Τα κενά γύρω από το / αγνοούνται (π.χ. 02.15.6262 / 02.30.7331 ή 02.15.6262/02.30.7331).'],
    ['Μορφή υλοποίησης & ΑΔΑΜ', 'Δεν συμπληρώνονται στο Excel. Μετά την εισαγωγή, όταν φέρετε δεδομένα από ΚΗΜΔΗΣ μέσα στην εφαρμογή, συμπληρώνονται αυτόματα όπου χρειάζεται — αποφεύγεται λάθος καταχώριση ΑΔΑΜ ως σύμβασης όταν το έργο είναι ακόμη σε διαδικασία σύναψης.'],
    ['Πριν την εισαγωγή', 'Η εφαρμογή θα σας δείξει ΑΝΑΦΟΡΑ ελέγχου (λάθη ανά γραμμή, διπλότυπα) πριν αποθηκευτεί οτιδήποτε. Μπορείτε να ακυρώσετε, να διορθώσετε το αρχείο και να ξαναδοκιμάσετε.'],
  ];
  let r = 3;
  lines.forEach(([k, v]) => {
    const kc = ws.getCell(`B${r}`);
    const vc = ws.getCell(`C${r}`);
    kc.value = k;
    vc.value = v;
    kc.font = { bold: true, color: { argb: COLOR.info } };
    kc.alignment = { vertical: 'top', wrapText: true };
    vc.alignment = { vertical: 'top', wrapText: true };
    ws.getRow(r).height = v && v.length > 90 ? 44 : 26;
    r += 1;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Ανάγνωση (parse)
// ─────────────────────────────────────────────────────────────────────────────

function readCellRaw(cell) {
  if (!cell) return null;
  const v = cell.value;
  if (v == null) return null;
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if (v.text !== undefined) return v.text;
    if (v.result !== undefined) return v.result;
    if (v.hyperlink !== undefined) return v.text || v.hyperlink;
    if (v instanceof Date) return v;
    return v;
  }
  return v;
}

function readCellString(cell) {
  return sanitizeCellText(readCellRaw(cell));
}

async function parseImportWorkbookBuffer(buffer, ExcelJSArg) {
  const ExcelJS = ExcelJSArg || require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const parseErrors = [];

  // Έκδοση προτύπου
  let versionOk = false;
  const meta = wb.getWorksheet(SHEET_META);
  if (meta) {
    const marker = sanitizeCellText(readCellRaw(meta.getCell('A1')));
    versionOk = marker === TEMPLATE_VERSION;
  }

  const ws = wb.getWorksheet(SHEET_DATA);
  if (!ws) {
    parseErrors.push({ message: `Δεν βρέθηκε το φύλλο «${SHEET_DATA}» στο αρχείο.` });
    return { versionOk, rows: [], parseErrors };
  }

  // Αντιστοίχιση κεφαλίδων → στήλες (ανθεκτικό σε αόρατους χαρακτήρες / αστερίσκο)
  const headerRow = ws.getRow(1);
  const headerToKey = new Map();
  COLUMNS.forEach((c) => headerToKey.set(sanitizeCellText(c.header), c.key));
  const keyToCol = {};
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    let h = sanitizeCellText(readCellRaw(cell));
    h = h.replace(/\s*\*+\s*$/, '').trim();
    const key = headerToKey.get(h);
    if (key && !keyToCol[key]) keyToCol[key] = colNumber;
  });

  // Fallback θέσης όταν κάποια κεφαλίδα δεν αναγνωρίστηκε
  COLUMNS.forEach((c, i) => { if (!keyToCol[c.key]) keyToCol[c.key] = i + 1; });

  const missingRequiredHeaders = COLUMNS.filter((c) => c.required && !Number.isInteger(keyToCol[c.key]));
  if (missingRequiredHeaders.length) {
    parseErrors.push({
      message: 'Λείπουν στήλες από το αρχείο: ' + missingRequiredHeaders.map((c) => c.header).join(', '),
    });
  }

  const rows = [];
  const lastRow = ws.rowCount;
  for (let r = 2; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const values = {};
    const rawAmounts = {};
    let anyContent = false;
    COLUMNS.forEach((c) => {
      const colNumber = keyToCol[c.key];
      const cell = row.getCell(colNumber);
      if (c.kind === 'amount') {
        const raw = readCellRaw(cell);
        rawAmounts[c.key] = raw;
        const str = sanitizeCellText(raw);
        values[c.key] = str;
        if (str) anyContent = true;
      } else {
        const str = readCellString(cell);
        values[c.key] = str;
        if (str) anyContent = true;
      }
    });
    if (!anyContent) continue;
    rows.push({ excelRow: r, values, rawAmounts });
  }

  return { versionOk, rows, parseErrors };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Έλεγχοι (validation) + κατασκευή αντικειμένων υποέργου
// ─────────────────────────────────────────────────────────────────────────────

const TYPES_SET = new Set(ENUMS.PROJECT_TYPES || []);
const STATUS_SET = new Set(ALLOWED_STATUSES);

function detailBelongsToSource(source, details, fundingDetails) {
  const list = (fundingDetails || ENUMS.FUNDING_DETAILS || {})[source] || [];
  return list.includes(details);
}

function parseYesNo(text) {
  const s = sanitizeCellText(text).toLowerCase();
  if (['ναι', 'nai', 'yes', 'true', '1'].includes(s)) return true;
  if (['όχι', 'οχι', 'ochi', 'oxi', 'no', 'false', '0'].includes(s)) return true; // αναγνωρίσιμο ως τιμή
  return null; // μη αναγνωρίσιμο
}

function isYes(text) {
  const s = sanitizeCellText(text).toLowerCase();
  return ['ναι', 'nai', 'yes', 'true', '1'].includes(s);
}

/**
 * Έλεγχος μιας γραμμής. Επιστρέφει { errors:[msg], project|null, dupKey }.
 * @param {object} rowObj
 * @param {object} [fundingEnums] - live πηγές/εξειδικεύσεις από την εφαρμογή
 */
function validateRow(rowObj, fundingEnums) {
  const funding = resolveFundingEnums(fundingEnums);
  const sourcesSet = new Set(funding.FUNDING_SOURCES || []);
  const v = rowObj.values;
  const errors = [];
  const field = (label, msg) => errors.push(`${label}: ${msg}`);

  const projectTitle = v.projectTitle;
  const subprojectTitle = v.subprojectTitle;

  if (!projectTitle) field('Τίτλος Έργου', 'υποχρεωτικό');
  else if (projectTitle.length < 3) field('Τίτλος Έργου', 'πολύ σύντομος (≥3 χαρακτήρες)');
  else if (projectTitle.length > 500) field('Τίτλος Έργου', 'πολύ μακρύς (≤500)');

  if (!subprojectTitle) field('Τίτλος Υποέργου', 'υποχρεωτικό');
  else if (subprojectTitle.length < 3) field('Τίτλος Υποέργου', 'πολύ σύντομος (≥3 χαρακτήρες)');
  else if (subprojectTitle.length > 500) field('Τίτλος Υποέργου', 'πολύ μακρύς (≤500)');

  if (!v.projectType) field('Είδος', 'υποχρεωτικό');
  else if (!TYPES_SET.has(v.projectType)) field('Είδος', 'δεν είναι από τη λίστα');

  if (!v.projectStatus) field('Κατάσταση', 'υποχρεωτική');
  else if (!STATUS_SET.has(v.projectStatus)) {
    if (EXCLUDED_STATUSES.has(v.projectStatus)) field('Κατάσταση', 'δεν εισάγεται (ολοκληρωμένο & αποπληρωμένο)');
    else field('Κατάσταση', 'δεν είναι από τη λίστα');
  }

  const ale = splitAleCodes(v.aleCodes);
  if (ale.length === 0) field('Κωδ. Α.Λ.Ε.', 'υποχρεωτικό (≥1 κωδικός)');

  const coRaw = v.coFinanced;
  if (!coRaw) field('Συγχρηματοδοτούμενο', 'υποχρεωτικό (Ναι/Όχι)');
  else if (parseYesNo(coRaw) === null) field('Συγχρηματοδοτούμενο', 'γράψτε Ναι ή Όχι');
  const coFinanced = isYes(coRaw);

  // Πηγές χρηματοδότησης (έως 2 στο Excel)
  const sets = [1, 2].map((idx) => ({
    idx,
    source: v[`fundingSource${idx}`],
    details: v[`fundingDetails${idx}`],
    amount: rowObj.rawAmounts[`amount${idx}`],
    amountStr: v[`amount${idx}`],
  }));

  const validateSet = (s, requireAll) => {
    const present = s.source || s.details || s.amountStr;
    if (!present) {
      if (requireAll) field(`Πηγή ${s.idx}`, 'υποχρεωτική');
      return null;
    }
    let ok = true;
    if (!s.source) { field(`Πηγή ${s.idx}`, 'λείπει η πηγή'); ok = false; }
    else if (!sourcesSet.has(s.source)) { field(`Πηγή ${s.idx}`, 'δεν είναι από τη λίστα'); ok = false; }
    if (!s.details) { field(`Εξειδίκευση ${s.idx}`, 'λείπει'); ok = false; }
    else if (s.source && !detailBelongsToSource(s.source, s.details, funding.FUNDING_DETAILS)) { field(`Εξειδίκευση ${s.idx}`, 'δεν αντιστοιχεί στην πηγή'); ok = false; }
    const num = amountToNumber(s.amount);
    if (s.amountStr === '' || s.amountStr == null) { field(`Ποσό ${s.idx}`, 'λείπει'); ok = false; }
    else if (!Number.isFinite(num)) { field(`Ποσό ${s.idx}`, 'μη έγκυρο (π.χ. 25.125,23)'); ok = false; }
    if (!ok) return null;
    return { source: s.source, details: s.details, amount: num, ownResources: isOwnResourcesDetail(s.details) };
  };

  let project = null;
  if (errors.length === 0) {
    if (!coFinanced) {
      // Μόνο η 1η πηγή· η 2η πρέπει να είναι κενή
      const extra = sets.slice(1).some((s) => s.source || s.details || s.amountStr);
      if (extra) field('Πηγή 2', 'αφήστε κενή όταν δεν είναι συγχρηματοδοτούμενο');
      const s1 = validateSet(sets[0], true);
      if (errors.length === 0 && s1) {
        project = buildProjectFromRow(rowObj, {
          coFinanced: false,
          fundingSource: s1.source,
          fundingDetails: s1.details,
          approvedAmount: formatAmountGr(s1.amount),
          fundingSources: [],
          aleCodes: ale,
        });
      }
    } else {
      const built = [];
      let hadError = false;
      sets.forEach((s, i) => {
        const requireAll = i === 0; // η 1η υποχρεωτική· η 2η επίσης για συγχρηματοδότηση
        const res = validateSet(s, requireAll || i === 1);
        if (res) built.push({ source: res.source, details: res.details, amount: formatAmountGr(res.amount), ownResources: res.ownResources, num: res.amount });
        else if (i === 0 || i === 1) hadError = true;
      });
      if (built.length < 2) field('Συγχρηματοδότηση', 'χρειάζονται 2 πηγές (ή βάλτε «Όχι»)');
      if (errors.length === 0 && !hadError) {
        const countable = built.filter((b) => !b.ownResources);
        if (countable.length === 0) field('Συγχρηματοδότηση', 'χρειάζεται τουλάχιστον μία πηγή εκτός «ιδίων πόρων»');
        if (errors.length === 0) {
          const sum = countable.reduce((acc, b) => acc + b.num, 0);
          const primary = countable.find((b) => b.source) || built[0];
          project = buildProjectFromRow(rowObj, {
            coFinanced: true,
            fundingSource: primary ? primary.source : '',
            fundingDetails: primary ? primary.details : '',
            approvedAmount: formatAmountGr(sum),
            fundingSources: built.map((b) => ({ source: b.source, details: b.details, amount: b.amount, ownResources: b.ownResources })),
            aleCodes: ale,
          });
        }
      }
    }
  }

  const dupKey = `${normalizeTitleKey(projectTitle)}|||${normalizeTitleKey(subprojectTitle)}`;
  return { errors, project: errors.length === 0 ? project : null, dupKey };
}

function buildProjectFromRow(rowObj, funding) {
  const v = rowObj.values;
  return {
    // ΧΩΡΙΣ projectId/subprojectId → δημιουργούνται & ομαδοποιούνται από τον main process
    projectTitle: v.projectTitle,
    subprojectTitle: v.subprojectTitle,
    // Συμπληρώνονται αργότερα από ΚΗΜΔΗΣ / κάρτα υποέργου — όχι από το Excel
    implementationForm: '',
    projectType: v.projectType,
    projectStatus: v.projectStatus,
    kaCode: '',
    noKaCode: false,
    aleCodes: funding.aleCodes,
    misPraxhsName: '',
    misPraxhsCode: '',
    coFinanced: funding.coFinanced,
    fundingSource: funding.fundingSource,
    fundingDetails: funding.fundingDetails,
    fundingSources: funding.fundingSources,
    approvedAmount: funding.approvedAmount,
    projectBudget: '',
    khmdhsAdam: '',
    comments: v.comments || '',
    eisigitikiEkthesi: v.eisigitikiEkthesi || '',
    supervisorEngineerIds: [],
    supervisorChargeOutsideEngineers: false,
    supervisorChargeFreePrimary: '',
    supervisorChargeFreeParticipants: '',
    remainingAmount: '',
    remainingAmountYear: String(new Date().getFullYear()),
    remainingAmountComments: '',
    aleRemainingAmounts: [],
    contracts: [],
    hasSupplementaryContracts: false,
    supplementaryContracts: [],
    fileGroups: [],
    egkriseisDialthesisPistosis: [],
    importedViaExcel: true,
  };
}

/**
 * Έλεγχος όλων των γραμμών. Επιστρέφει:
 *  { errors:[{excelRow, messages[]}], validRows:[{excelRow, project, dupKey}], count }
 * Περιλαμβάνει έλεγχο διπλότυπων ΜΕΣΑ στο αρχείο (ίδιος τίτλος Πράξης + Υποέργου).
 * @param {object[]} rows
 * @param {{ fundingEnums?: object }} [options]
 */
function validateAllRows(rows, options = {}) {
  const errors = [];
  const validRows = [];
  const seen = new Map(); // dupKey → excelRow
  const fundingEnums = options.fundingEnums;

  rows.forEach((rowObj) => {
    const res = validateRow(rowObj, fundingEnums);
    const rowErrors = [...res.errors];

    if (res.dupKey && seen.has(res.dupKey)) {
      rowErrors.push(`Διπλότυπο μέσα στο αρχείο (ίδιο με γραμμή ${seen.get(res.dupKey)})`);
    } else if (res.dupKey) {
      seen.set(res.dupKey, rowObj.excelRow);
    }

    if (rowErrors.length) {
      errors.push({ excelRow: rowObj.excelRow, messages: rowErrors });
    } else {
      validRows.push({ excelRow: rowObj.excelRow, project: res.project, dupKey: res.dupKey });
    }
  });

  return { errors, validRows, count: rows.length };
}

module.exports = {
  TEMPLATE_VERSION,
  SHEET_DATA,
  SHEET_INFO,
  SHEET_LISTS,
  COLUMNS,
  COLUMN_KEYS,
  ALLOWED_STATUSES,
  EXCLUDED_STATUSES,
  sanitizeCellText,
  normalizeTitleKey,
  amountToNumber,
  formatAmountGr,
  splitAleCodes,
  buildTemplateWorkbook,
  parseImportWorkbookBuffer,
  validateAllRows,
  validateRow,
  resolveFundingEnums,
};

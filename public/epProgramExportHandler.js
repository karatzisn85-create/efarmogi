/**
 * epProgramExportHandler.js
 * Εξαγωγή Επιχειρησιακού Προγράμματος σε μορφοποιημένο Excel (xlsx-js-style).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const XLSX = require('xlsx-js-style');

const APP_NAME = 'ERGOHUB';

// ─── Στυλ ─────────────────────────────────────────────────────────────────────
const STYLES = {
  title: {
    font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '4F46E5' } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: borderAll('4F46E5')
  },
  subtitle: {
    font: { bold: true, sz: 11, color: { rgb: '4338CA' } },
    fill: { fgColor: { rgb: 'EEF2FF' } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: borderAll('C7D2FE')
  },
  header: {
    font: { bold: true, sz: 10, color: { rgb: '1E293B' } },
    fill: { fgColor: { rgb: 'B4C7E7' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: borderAll('000000')
  },
  headerAlt: {
    font: { bold: true, sz: 10, color: { rgb: '1E293B' } },
    fill: { fgColor: { rgb: 'C5D9F1' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: borderAll('000000')
  },
  cell: {
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
    border: borderAll('D0D0D0')
  },
  cellCenter: {
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: borderAll('D0D0D0')
  },
  cellNumber: {
    alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
    border: borderAll('D0D0D0'),
    numFmt: '#,##0.00'
  },
  cellAlt: {
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
    fill: { fgColor: { rgb: 'F8FAFC' } },
    border: borderAll('D0D0D0')
  },
  statLabel: {
    font: { bold: true, sz: 11, color: { rgb: '334155' } },
    fill: { fgColor: { rgb: 'E2E8F0' } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: borderAll('94A3B8')
  },
  statValue: {
    font: { bold: true, sz: 12, color: { rgb: '4338CA' } },
    alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
    border: borderAll('94A3B8')
  },
  infoSection: {
    font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '6366F1' } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: borderAll('4F46E5')
  },
  infoLabel: {
    font: { bold: true, sz: 10, color: { rgb: '475569' } },
    fill: { fgColor: { rgb: 'F1F5F9' } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: borderAll('CBD5E1')
  },
  infoValue: {
    font: { sz: 10, color: { rgb: '1E293B' } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: borderAll('CBD5E1')
  },
  infoValueAccent: {
    font: { bold: true, sz: 11, color: { rgb: '4338CA' } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: borderAll('A5B4FC'),
    fill: { fgColor: { rgb: 'EEF2FF' } }
  },
  infoNote: {
    font: { sz: 10, color: { rgb: '334155' }, italic: true },
    fill: { fgColor: { rgb: 'F8FAFC' } },
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
    border: borderAll('94A3B8')
  },
  totalRow: {
    font: { bold: true, sz: 10, color: { rgb: '1E293B' } },
    fill: { fgColor: { rgb: 'FEF3C7' } },
    alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
    border: borderAll('000000'),
    numFmt: '#,##0.00'
  }
};

function borderAll(color) {
  const c = { style: 'thin', color: { rgb: color } };
  return { top: c, bottom: c, left: c, right: c };
}

function formatExportTimestamp(date = new Date()) {
  return date.toLocaleString('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function buildLookupMaps(program) {
  const axisMap = {};
  const measureMap = {};
  const objectiveMap = {};
  for (const a of program.axes || []) axisMap[a.code] = a.title;
  for (const m of program.measures || []) measureMap[m.code] = m.title;
  for (const o of program.objectives || []) objectiveMap[o.code] = o.title;
  return { axisMap, measureMap, objectiveMap };
}

function sumBudgetYears(budgetYears = {}) {
  return Object.values(budgetYears).reduce((s, v) => s + (Number(v) || 0), 0);
}

function aggregateByKey(actions, keyFn, budgetYears) {
  const map = new Map();
  for (const a of actions) {
    const key = keyFn(a) || '—';
    if (!map.has(key)) {
      map.set(key, { label: key, count: 0, total: 0, newCount: 0, continuingCount: 0, byYear: {} });
    }
    const entry = map.get(key);
    entry.count += 1;
    entry.total += Number(a.total) || sumBudgetYears(a.budgetYears);
    if (a.isNew) entry.newCount += 1;
    else entry.continuingCount += 1;
    for (const y of budgetYears) {
      entry.byYear[y] = (entry.byYear[y] || 0) + (Number((a.budgetYears || {})[y]) || 0);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

// ─── Sheet builders ───────────────────────────────────────────────────────────

const ERGOHUB_EXPORT_NOTE =
  'Το παρόν έγγραφο εξήχθη αυτόματα από την εφαρμογή ERGOHUB (Ergohub) — σύστημα διαχείρισης και παρακολούθησης έργων. ' +
  'Περιέχει πλήρη αποτύπωση του Επιχειρησιακού Προγράμματος όπως καταχωρείται στη βάση δεδομένων κατά τη στιγμή της εξαγωγής. ' +
  'Όλα τα οικονομικά ποσά αναφέρονται σε ευρώ (€). ' +
  'Για επίσημες χρήσεις ή υποβολές, συνιστάται η επαλήθευση των στοιχείων έναντι των εγκεκριμένων εκδόσεων του προγράμματος.';

function buildInfoRows(program, exportedAt) {
  const budgetYears = program.budgetYears || [];
  const actions = program.actions || [];
  const totalBudget = actions.reduce((s, a) => s + (Number(a.total) || 0), 0);
  const linkedCount = actions.filter(a => (a.linkedSubprojectIds || []).length > 0).length;

  return [
    ['ΕΞΑΓΩΓΗ ΕΠΙΧΕΙΡΗΣΙΑΚΟΥ ΠΡΟΓΡΑΜΜΑΤΟΣ'],
    [],
    ['ΣΤΟΙΧΕΙΑ ΕΞΑΓΩΓΗΣ'],
    ['Εφαρμογή', `${APP_NAME} (Ergohub)`],
    ['Ημερομηνία & ώρα εξαγωγής', exportedAt],
    [],
    ['ΣΤΟΙΧΕΙΑ ΠΡΟΓΡΑΜΜΑΤΟΣ'],
    ['Τίτλος προγράμματος', program.title || '—'],
    ['Περίοδος', `${program.startYear} – ${program.endYear}`],
    ['Κατάσταση', program.isActive ? 'Ενεργό' : 'Αρχειοθετημένο'],
    [],
    ['ΣΥΝΟΨΗ ΔΕΔΟΜΕΝΩΝ'],
    ['Σύνολο δράσεων', actions.length],
    ['Άξονες', (program.axes || []).length],
    ['Μέτρα', (program.measures || []).length],
    ['Ειδικοί στόχοι', (program.objectives || []).length],
    ['Συνολικός προϋπολογισμός (€)', totalBudget],
    ['Δράσεις με συνδεδεμένα υποέργα', linkedCount],
    ['Έτη προϋπολογισμού', budgetYears.join(', ')],
    [],
    ['ΠΡΟΕΛΕΥΣΗ ΕΓΓΡΑΦΟΥ'],
    [ERGOHUB_EXPORT_NOTE]
  ];
}

function applyInfoSheetFormatting(sheet, { totalBudgetRow } = {}) {
  if (!sheet['!ref']) return;
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const merges = [];
  const sectionTitles = new Set([
    'ΣΤΟΙΧΕΙΑ ΕΞΑΓΩΓΗΣ',
    'ΣΤΟΙΧΕΙΑ ΠΡΟΓΡΑΜΜΑΤΟΣ',
    'ΣΥΝΟΨΗ ΔΕΔΟΜΕΝΩΝ',
    'ΠΡΟΕΛΕΥΣΗ ΕΓΓΡΑΦΟΥ'
  ]);

  for (let R = range.s.r; R <= range.e.r; R++) {
    const aCell = sheet[XLSX.utils.encode_cell({ r: R, c: 0 })];
    const aVal = aCell ? String(aCell.v || '') : '';
    const bAddr = XLSX.utils.encode_cell({ r: R, c: 1 });
    const isTitle = R === 0;
    const isSection = sectionTitles.has(aVal);
    const isNote = aVal === ERGOHUB_EXPORT_NOTE || (R > 0 && !sheet[bAddr] && aVal.length > 80);
    const isEmpty = !aVal && (!sheet[bAddr] || sheet[bAddr].v === '' || sheet[bAddr].v == null);

    if (isTitle || isSection) {
      merges.push({ s: { r: R, c: 0 }, e: { r: R, c: 1 } });
    }
    if (isNote) {
      merges.push({ s: { r: R, c: 0 }, e: { r: R, c: 1 } });
    }

    for (let C = 0; C <= 1; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!sheet[addr]) sheet[addr] = { t: 's', v: '' };

      if (isTitle) {
        sheet[addr].s = STYLES.title;
      } else if (isSection) {
        sheet[addr].s = STYLES.infoSection;
      } else if (isNote) {
        sheet[addr].s = STYLES.infoNote;
      } else if (isEmpty) {
        sheet[addr].s = { fill: { fgColor: { rgb: 'FFFFFF' } } };
      } else if (C === 0) {
        sheet[addr].s = STYLES.infoLabel;
      } else if (R === totalBudgetRow) {
        sheet[addr].t = 'n';
        sheet[addr].s = { ...STYLES.infoValueAccent, numFmt: '#,##0.00' };
      } else if (typeof sheet[addr].v === 'number') {
        sheet[addr].t = 'n';
        sheet[addr].s = { ...STYLES.infoValueAccent, numFmt: '#,##0' };
      } else {
        sheet[addr].s = STYLES.infoValue;
      }
    }
  }

  sheet['!merges'] = merges;
  sheet['!cols'] = [{ wch: 34 }, { wch: 58 }];
  const rowHeights = [];
  for (let R = range.s.r; R <= range.e.r; R++) {
    const aCell = sheet[XLSX.utils.encode_cell({ r: R, c: 0 })];
    const aVal = aCell ? String(aCell.v || '') : '';
    if (R === 0) rowHeights.push({ hpt: 40 });
    else if (sectionTitles.has(aVal)) rowHeights.push({ hpt: 26 });
    else if (aVal === ERGOHUB_EXPORT_NOTE) rowHeights.push({ hpt: 88 });
    else if (!aVal && !sheet[XLSX.utils.encode_cell({ r: R, c: 1 })]) rowHeights.push({ hpt: 10 });
    else rowHeights.push({ hpt: 24 });
  }
  sheet['!rows'] = rowHeights;
}

function buildInfoSheet(program, exportedAt) {
  const aoa = buildInfoRows(program, exportedAt);
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const totalBudgetRow = aoa.findIndex(
    row => Array.isArray(row) && row[0] === 'Συνολικός προϋπολογισμός (€)'
  );
  applyInfoSheetFormatting(sheet, { totalBudgetRow });
  return sheet;
}

function buildActionsRows(program) {
  const { axisMap, measureMap, objectiveMap } = buildLookupMaps(program);
  const budgetYears = program.budgetYears || [];

  const header = [
    'Α/Α', 'ΑΞΟΝΑΣ', 'ΜΕΤΡΟ', 'ΕΙΔΙΚΟΣ ΣΤΟΧΟΣ', 'ΤΙΤΛΟΣ ΔΡΑΣΗΣ',
    'ΕΙΔΟΣ ΔΡΑΣΗΣ', 'ΝΕΑ/ΣΥΝΕΧΙΖΟΜΕΝΗ', 'ΧΩΡΟΘΕΤΗΣΗ', 'ΠΡΟΤΕΡΑΙΟΤΗΤΑ', 'ΑΡΜΟΔΙΑ ΥΠΗΡΕΣΙΑ',
    ...budgetYears.map(y => String(y)),
    'ΣΥΝΟΛΟ', 'ΠΗΓΗ ΧΡΗΜΑΤΟΔΟΤΗΣΗΣ 1η', 'ΠΗΓΗ ΧΡΗΜΑΤΟΔΟΤΗΣΗΣ 2η', 'ΠΗΓΗ ΧΡΗΜΑΤΟΔΟΤΗΣΗΣ 3η',
    'ΣΥΝΔΕΔΕΜΕΝΑ ΥΠΟΕΡΓΑ'
  ];

  const rows = [header];
  const sorted = [...(program.actions || [])].sort((a, b) => (a.aa || 0) - (b.aa || 0));

  for (const a of sorted) {
    const sources = a.fundingSources || [];
    rows.push([
      a.aa,
      axisMap[a.axisCode] || a.axisCode || '',
      measureMap[a.measureCode] || a.measureCode || '',
      objectiveMap[a.objectiveCode] || a.objectiveCode || '',
      a.title || '',
      a.actionType || '',
      a.isNew ? 'Νέα' : 'Συνεχιζόμενη',
      a.location || '',
      a.priority || '',
      a.responsibleService || '',
      ...budgetYears.map(y => Number((a.budgetYears || {})[y]) || 0),
      Number(a.total) || sumBudgetYears(a.budgetYears),
      sources[0] || '',
      sources[1] || '',
      sources[2] || '',
      (a.linkedSubprojectIds || []).length
    ]);
  }

  return { rows, budgetYears };
}

function buildSummaryRows(program) {
  const actions = program.actions || [];
  const budgetYears = program.budgetYears || [];
  const total = actions.reduce((s, a) => s + (Number(a.total) || 0), 0);
  const newCount = actions.filter(a => a.isNew).length;
  const contCount = actions.length - newCount;

  const rows = [
    ['ΣΥΓΚΕΝΤΡΩΤΙΚΑ ΣΤΟΙΧΕΙΑ', ''],
    ['Μετρική', 'Τιμή'],
    ['Σύνολο δράσεων', actions.length],
    ['Νέες δράσεις', newCount],
    ['Συνεχιζόμενες δράσεις', contCount],
    ['Συνολικός προϋπολογισμός (€)', total],
    ['Μέσος προϋπολογισμός ανά δράση (€)', actions.length ? total / actions.length : 0],
    [],
    ['ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ ΑΝΑ ΕΤΟΣ', 'ΠΟΣΟ (€)']
  ];

  for (const y of budgetYears) {
    const yearTotal = actions.reduce((s, a) => s + (Number((a.budgetYears || {})[y]) || 0), 0);
    rows.push([String(y), yearTotal]);
  }

  return rows;
}

function buildGroupedRows(title, headers, items, budgetYears) {
  const rows = [[title], [], headers];
  let grandTotal = 0;
  let grandCount = 0;
  const yearTotals = {};
  for (const y of budgetYears) yearTotals[y] = 0;

  for (const item of items) {
    grandTotal += item.total;
    grandCount += item.count;
    const row = [item.label, item.count, item.newCount, item.continuingCount, item.total];
    for (const y of budgetYears) {
      const v = item.byYear[y] || 0;
      yearTotals[y] += v;
      row.push(v);
    }
    rows.push(row);
  }

  const totalRow = ['ΣΥΝΟΛΟ', grandCount, '', '', grandTotal];
  for (const y of budgetYears) totalRow.push(yearTotals[y]);
  rows.push([]);
  rows.push(totalRow);

  return rows;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function applySheetFromAoA(aoa, options = {}) {
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  applyFormatting(sheet, {
    headerRows: options.headerRows || [0],
    titleRows: options.titleRows || [],
    numberCols: options.numberCols || [],
    centerCols: options.centerCols || [],
    freezeRow: options.freezeRow,
    colWidths: options.colWidths
  });
  return sheet;
}

function applyFormatting(sheet, opts) {
  if (!sheet['!ref']) return;
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const headerSet = new Set(opts.headerRows || []);
  const titleSet = new Set(opts.titleRows || []);
  const numberSet = new Set(opts.numberCols || []);
  const centerSet = new Set(opts.centerCols || []);

  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!sheet[addr]) sheet[addr] = { t: 's', v: '' };

      if (titleSet.has(R)) {
        sheet[addr].s = STYLES.title;
      } else if (headerSet.has(R)) {
        sheet[addr].s = C % 2 === 0 ? STYLES.header : STYLES.headerAlt;
      } else if (numberSet.has(C) && R > Math.max(...headerSet, -1)) {
        const v = sheet[addr].v;
        if (typeof v === 'number') {
          sheet[addr].t = 'n';
          sheet[addr].s = STYLES.cellNumber;
        } else {
          sheet[addr].s = STYLES.cell;
        }
      } else if (centerSet.has(C)) {
        sheet[addr].s = STYLES.cellCenter;
      } else {
        sheet[addr].s = R % 2 === 0 ? STYLES.cell : STYLES.cellAlt;
      }
    }
  }

  if (opts.colWidths) {
    sheet['!cols'] = opts.colWidths;
  } else {
    sheet['!cols'] = autoColWidths(sheet, range);
  }

  if (opts.freezeRow != null) {
    sheet['!freeze'] = { xSplit: 0, ySplit: opts.freezeRow, topLeftCell: `A${opts.freezeRow + 1}`, activePane: 'bottomLeft' };
  }

  const rowHeights = [];
  for (let R = range.s.r; R <= range.e.r; R++) {
    if (titleSet.has(R)) rowHeights.push({ hpt: 36 });
    else if (headerSet.has(R)) rowHeights.push({ hpt: 48 });
    else rowHeights.push({ hpt: Math.min(calculateRowHeight(sheet, R, range.e.c), 120) });
  }
  sheet['!rows'] = rowHeights;
}

function autoColWidths(sheet, range) {
  const widths = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    let maxW = 10;
    for (let R = range.s.r; R <= range.e.r; R++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })];
      if (!cell || cell.v == null) continue;
      const lines = String(cell.v).split('\n');
      const maxLen = Math.max(...lines.map(l => l.length));
      if (maxLen > 80) maxW = Math.max(maxW, 55);
      else if (maxLen > 40) maxW = Math.max(maxW, 32);
      else if (maxLen > 20) maxW = Math.max(maxW, 18);
      else maxW = Math.max(maxW, maxLen * 1.15 + 2);
    }
    widths.push({ wch: Math.min(Math.max(maxW, 10), 60) });
  }
  return widths;
}

function calculateRowHeight(sheet, rowIndex, maxCol) {
  let maxLines = 1;
  for (let C = 0; C <= maxCol; C++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: C })];
    if (!cell || cell.v == null) continue;
    const text = String(cell.v);
    const lines = text.split('\n').length;
    const est = Math.ceil(text.length / 50);
    maxLines = Math.max(maxLines, lines, est);
  }
  return Math.max(22, 18 + (maxLines - 1) * 14);
}

// ─── Main export ──────────────────────────────────────────────────────────────

function exportEpProgramToWorkbook(program, { exportedBy, appVersion } = {}) {
  const exportedAt = formatExportTimestamp();
  const budgetYears = program.budgetYears || [];
  const actions = program.actions || [];
  const { axisMap, measureMap } = buildLookupMaps(program);

  const wb = XLSX.utils.book_new();

  // 1. Πληροφορίες
  const infoSheet = buildInfoSheet(program, exportedAt);
  XLSX.utils.book_append_sheet(wb, infoSheet, 'ΠΛΗΡΟΦΟΡΙΕΣ');

  // 2. ΕΠ_ΔΡΑΣΕΙΣ
  const { rows: actionRows } = buildActionsRows(program);
  const yearStartCol = 10;
  const yearEndCol = yearStartCol + budgetYears.length - 1;
  const totalCol = yearEndCol + 1;
  const numberCols = [];
  for (let c = yearStartCol; c <= totalCol; c++) numberCols.push(c);
  numberCols.push(actionRows[0].length - 1); // linked count col

  const actionsSheet = applySheetFromAoA(actionRows, {
    headerRows: [0],
    numberCols,
    centerCols: [0, 6, 8, actionRows[0].length - 1],
    freezeRow: 1
  });
  XLSX.utils.book_append_sheet(wb, actionsSheet, 'ΕΠ_ΔΡΑΣΕΙΣ');

  // 3. Συγκεντρωτικά
  const summaryAoA = buildSummaryRows(program);
  const summarySheet = applySheetFromAoA(summaryAoA, {
    titleRows: [0],
    headerRows: [2, 8],
    numberCols: [1],
    colWidths: [{ wch: 38 }, { wch: 22 }]
  });
  XLSX.utils.book_append_sheet(wb, summarySheet, 'ΣΥΓΚΕΝΤΡΩΤΙΚΑ');

  const groupHeaders = ['Κατηγορία', 'Πλήθος', 'Νέες', 'Συνεχιζόμενες', 'Σύνολο (€)', ...budgetYears.map(String)];

  // 4. Ανά άξονα
  const byAxis = aggregateByKey(actions, a => axisMap[a.axisCode] || `Άξονας ${a.axisCode}`, budgetYears);
  const axisSheet = applySheetFromAoA(
    buildGroupedRows('ΚΑΤΑΝΟΜΗ ΑΝΑ ΑΞΟΝΑ', groupHeaders, byAxis, budgetYears),
    { titleRows: [0], headerRows: [2], numberCols: [1, 2, 3, 4, ...budgetYears.map((_, i) => 5 + i)], freezeRow: 3 }
  );
  XLSX.utils.book_append_sheet(wb, axisSheet, 'ΑΝΑ ΑΞΟΝΑ');

  // 5. Ανά μέτρο
  const byMeasure = aggregateByKey(actions, a => {
    const m = (program.measures || []).find(x => x.code === a.measureCode);
    return m?.title || a.measureCode || '—';
  }, budgetYears);
  const measureSheet = applySheetFromAoA(
    buildGroupedRows('ΚΑΤΑΝΟΜΗ ΑΝΑ ΜΕΤΡΟ', groupHeaders, byMeasure, budgetYears),
    { titleRows: [0], headerRows: [2], numberCols: [1, 2, 3, 4, ...budgetYears.map((_, i) => 5 + i)], freezeRow: 3 }
  );
  XLSX.utils.book_append_sheet(wb, measureSheet, 'ΑΝΑ ΜΕΤΡΟ');

  // 6. Ανά είδος
  const byType = aggregateByKey(actions, a => a.actionType || '—', budgetYears);
  const typeSheet = applySheetFromAoA(
    buildGroupedRows('ΚΑΤΑΝΟΜΗ ΑΝΑ ΕΙΔΟΣ ΔΡΑΣΗΣ', groupHeaders, byType, budgetYears),
    { titleRows: [0], headerRows: [2], numberCols: [1, 2, 3, 4, ...budgetYears.map((_, i) => 5 + i)], freezeRow: 3 }
  );
  XLSX.utils.book_append_sheet(wb, typeSheet, 'ΑΝΑ ΕΙΔΟΣ');

  // 7. Ανά πηγή χρηματοδότησης
  const fundingMap = new Map();
  for (const a of actions) {
    const sources = (a.fundingSources || []).filter(s => s && s.trim());
    const list = sources.length ? sources : ['—'];
    const portion = list.length > 1 ? (Number(a.total) || 0) / list.length : (Number(a.total) || 0);
    for (const src of list) {
      if (!fundingMap.has(src)) {
        fundingMap.set(src, { label: src, count: 0, total: 0, newCount: 0, continuingCount: 0, byYear: {} });
      }
      const e = fundingMap.get(src);
      e.count += 1;
      e.total += portion;
      if (a.isNew) e.newCount += 1;
      else e.continuingCount += 1;
      for (const y of budgetYears) {
        const yv = list.length > 1
          ? (Number((a.budgetYears || {})[y]) || 0) / list.length
          : (Number((a.budgetYears || {})[y]) || 0);
        e.byYear[y] = (e.byYear[y] || 0) + yv;
      }
    }
  }
  const byFunding = Array.from(fundingMap.values()).sort((a, b) => b.total - a.total);

  const fundingSheet = applySheetFromAoA(
    buildGroupedRows('ΚΑΤΑΝΟΜΗ ΑΝΑ ΠΗΓΗ ΧΡΗΜΑΤΟΔΟΤΗΣΗΣ', groupHeaders, byFunding, budgetYears),
    { titleRows: [0], headerRows: [2], numberCols: [1, 2, 3, 4, ...budgetYears.map((_, i) => 5 + i)], freezeRow: 3 }
  );
  XLSX.utils.book_append_sheet(wb, fundingSheet, 'ΑΝΑ ΠΗΓΗ');

  // 8. Ανά χωροθέτηση
  const byLocation = aggregateByKey(actions, a => a.location || '—', budgetYears);
  const locSheet = applySheetFromAoA(
    buildGroupedRows('ΚΑΤΑΝΟΜΗ ΑΝΑ ΧΩΡΟΘΕΤΗΣΗ', groupHeaders, byLocation, budgetYears),
    { titleRows: [0], headerRows: [2], numberCols: [1, 2, 3, 4, ...budgetYears.map((_, i) => 5 + i)], freezeRow: 3 }
  );
  XLSX.utils.book_append_sheet(wb, locSheet, 'ΑΝΑ ΧΩΡΟΘΕΤΗΣΗ');

  // 9. Ανά προτεραιότητα
  const byPriority = aggregateByKey(actions, a => a.priority || '—', budgetYears);
  const prioSheet = applySheetFromAoA(
    buildGroupedRows('ΚΑΤΑΝΟΜΗ ΑΝΑ ΠΡΟΤΕΡΑΙΟΤΗΤΑ', groupHeaders, byPriority, budgetYears),
    { titleRows: [0], headerRows: [2], numberCols: [1, 2, 3, 4, ...budgetYears.map((_, i) => 5 + i)], freezeRow: 3 }
  );
  XLSX.utils.book_append_sheet(wb, prioSheet, 'ΑΝΑ ΠΡΟΤΕΡΑΙΟΤΗΤΑ');

  const safeTitle = (program.title || 'EP')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 60);
  const filename = `${APP_NAME}_EP_${program.startYear}-${program.endYear}_${safeTitle}.xlsx`;

  return { workbook: wb, filename, exportedAt };
}

/**
 * Εξαγωγή σε προσωρινό αρχείο — επιστρέφει path για save dialog.
 */
async function exportEpProgram({ program, exportedBy, appVersion, tempDir }) {
  if (!program) {
    return { success: false, error: 'Δεν βρέθηκε πρόγραμμα για εξαγωγή' };
  }

  const { workbook, filename, exportedAt } = exportEpProgramToWorkbook(program, { exportedBy, appVersion });

  const outDir = tempDir || path.join(os.tmpdir(), 'ergohub_ep_export');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outputPath = path.join(outDir, filename);
  XLSX.writeFile(workbook, outputPath);

  return {
    success: true,
    filename,
    outputPath,
    exportedAt,
    actionCount: (program.actions || []).length,
    sheetCount: workbook.SheetNames.length
  };
}

module.exports = { exportEpProgram, exportEpProgramToWorkbook };

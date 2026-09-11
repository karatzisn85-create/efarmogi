/**
 * Excel καρτέλες ωρίμανσης: ένας πίνακας ανά έργο,
 * όπως η αναφορά της οθόνης — Α/Α, συγχωνεύσεις καθ’ ύψος,
 * μελέτες / άδειες μόνο όσες έχει το έργο.
 */
const XLSX = require('xlsx-js-style');
const checklist = require('../app/core/orimanthiFileChecklist');

const APP_NAME = 'ERGOHUB';
const APP_TAGLINE = 'Σύστημα Διαχείρισης Έργων Δήμου';
const REPORT_TITLE = 'ΑΝΑΦΟΡΑ ΩΡΙΜΑΝΣΗΣ ΕΡΓΩΝ';
const REPORT_SUBTITLE = `${APP_TAGLINE} — καρτέλες έργων υπό ωρίμανση`;
const REPORT_CREDIT = `Το παρόν εξήχθη από την εφαρμογή ${APP_NAME}`;

const COLS = 10;
const BANNER_ROW_COUNT = 2;
const COL = {
  serial: 0,
  title: 1,
  status: 2,
  municipal: 3,
  settlement: 4,
  category: 5,
  studyName: 6,
  studyMark: 7,
  permitName: 8,
  permitMark: 9,
};

const DEFAULT_EXCEL_OPTIONS = {
  columns: {
    status: true,
    municipal: true,
    settlement: true,
    category: true,
  },
  includeStudies: true,
  includePermits: true,
};

const COL_WIDTH = {
  serial: 6,
  title: 28,
  status: 16,
  municipal: 18,
  settlement: 16,
  category: 24,
  studyName: 26,
  studyMark: 5,
  permitName: 28,
  permitMark: 5,
};

const LEFT_COL_KEYS = ['serial', 'title', 'status', 'municipal', 'settlement', 'category'];

function asBool(value, fallback) {
  if (value === true || value === false) return value;
  return fallback;
}

function normalizeExcelOptions(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const columns = src.columns && typeof src.columns === 'object' ? src.columns : {};
  return {
    columns: {
      status: asBool(columns.status, true),
      municipal: asBool(columns.municipal, true),
      settlement: asBool(columns.settlement, true),
      category: asBool(columns.category, true),
    },
    includeStudies: asBool(src.includeStudies, true),
    includePermits: asBool(src.includePermits, true),
  };
}

function layoutFromOptions(raw) {
  const options = normalizeExcelOptions(raw);
  const col = { serial: 0, title: 1 };
  let n = 2;
  if (options.columns.status) col.status = n++;
  if (options.columns.municipal) col.municipal = n++;
  if (options.columns.settlement) col.settlement = n++;
  if (options.columns.category) col.category = n++;
  if (options.includeStudies) {
    col.studyName = n++;
    col.studyMark = n++;
  }
  if (options.includePermits) {
    col.permitName = n++;
    col.permitMark = n++;
  }
  return { COL: col, COLS: n, options };
}

const STATUS_LABELS = {
  draft: 'Αρχική καταγραφή',
  maturing: 'Υπό ωρίμανση',
  ready: 'Πλήρως ώριμο',
  submitted: 'Σε διαδικασία έγκρισης',
  approved: 'Εγκεκριμένο',
  rejected: 'Απορρίφθηκε',
};

function borderAll(color) {
  const c = { style: 'thin', color: { rgb: color } };
  return { top: c, bottom: c, left: c, right: c };
}

const LINE = 'E2E8F0';
const S = {
  headLeft: {
    font: { bold: true, sz: 9, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '4338CA' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: borderAll('3730A3'),
  },
  headStudies: {
    font: { bold: true, sz: 9, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '4F46E5' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: borderAll('3730A3'),
  },
  headPermits: {
    font: { bold: true, sz: 9, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '0D9488' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: borderAll('0F766E'),
  },
  serial: {
    font: { bold: true, sz: 11, color: { rgb: '1E293B' } },
    fill: { fgColor: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll(LINE),
  },
  project: {
    font: { bold: true, sz: 11, color: { rgb: '0F172A' } },
    fill: { fgColor: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: borderAll(LINE),
  },
  meta: {
    font: { sz: 10, color: { rgb: '1E293B' } },
    fill: { fgColor: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: borderAll(LINE),
  },
  studyName: {
    font: { sz: 10, color: { rgb: '1E293B' } },
    fill: { fgColor: { rgb: 'F5F3FF' } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: borderAll('DDD6FE'),
  },
  permitName: {
    font: { sz: 10, color: { rgb: '1E293B' } },
    fill: { fgColor: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: borderAll(LINE),
  },
  markOk: {
    font: { bold: true, sz: 12, color: { rgb: '047857' } },
    fill: { fgColor: { rgb: 'D1FAE5' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll('A7F3D0'),
  },
  markEmpty: {
    font: { bold: true, sz: 12, color: { rgb: '94A3B8' } },
    fill: { fgColor: { rgb: 'F8FAFC' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll(LINE),
  },
  markPending: {
    font: { bold: true, sz: 12, color: { rgb: 'B45309' } },
    fill: { fgColor: { rgb: 'FEF3C7' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll('FDE68A'),
  },
  notes: {
    font: { sz: 9, color: { rgb: '475569' }, italic: true },
    fill: { fgColor: { rgb: 'F8FAFC' } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: borderAll(LINE),
  },
  separator: {
    fill: { fgColor: { rgb: '1E1B4B' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  },
  gap: {
    fill: { fgColor: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  },
  reportTitle: {
    font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '312E81' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll('312E81'),
  },
  reportMetaLeft: {
    font: { sz: 9, color: { rgb: '64748B' } },
    fill: { fgColor: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: borderAll('FFFFFF'),
  },
  reportMetaRight: {
    font: { sz: 9, color: { rgb: '64748B' } },
    fill: { fgColor: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: borderAll('FFFFFF'),
  },
  reportCredit: {
    font: { sz: 8, color: { rgb: '94A3B8' } },
    fill: { fgColor: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  },
  blank: {
    alignment: { horizontal: 'left', vertical: 'center' },
  },
};

function emptyRow(colCount) {
  return Array.from({ length: colCount }, () => ({ v: '', kind: 'blank' }));
}

function setCol(row, col, key, cell) {
  if (col[key] == null) return;
  row[col[key]] = cell;
}

function addMerge(merges, r1, c1, r2, c2) {
  if (r2 < r1 || c2 < c1) return;
  if (r1 === r2 && c1 === c2) return;
  merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
}

function markKind(item) {
  if (!item) return 'markEmpty';
  if (item.kind === 'issued' || item.kind === 'hasFile') return 'markOk';
  if (item.kind === 'pending') return 'markPending';
  return 'markEmpty';
}

function fillMergedBlock(row, fromCol, toCol, value, kind) {
  for (let c = fromCol; c <= toCol; c += 1) {
    row[c] = { v: c === fromCol ? value : '', kind };
  }
}

function buildCardRows(card, statusLabels, serial, excelOptions) {
  const labels = statusLabels || STATUS_LABELS;
  const { COL: col, COLS: colCount, options } = layoutFromOptions(excelOptions);
  const rows = [];
  const merges = [];
  const studies = options.includeStudies ? (card.meletes || []) : [];
  const permits = options.includePermits ? (card.adeiodotiseis || []) : [];
  const span = Math.max(studies.length, permits.length, 1);

  const push = (cells) => {
    rows.push(cells);
    return rows.length - 1;
  };

  const header = emptyRow(colCount);
  setCol(header, col, 'serial', { v: 'Α/Α', kind: 'headLeft' });
  setCol(header, col, 'title', { v: 'Τίτλος έργου', kind: 'headLeft' });
  setCol(header, col, 'status', { v: 'Κατάσταση', kind: 'headLeft' });
  setCol(header, col, 'municipal', { v: 'Δημοτική ενότητα', kind: 'headLeft' });
  setCol(header, col, 'settlement', { v: 'Οικισμός', kind: 'headLeft' });
  setCol(header, col, 'category', { v: 'Κατηγορία / Εξειδίκευση', kind: 'headLeft' });
  if (options.includeStudies) {
    fillMergedBlock(header, col.studyName, col.studyMark, 'ΜΕΛΕΤΕΣ ΕΡΓΟΥ', 'headStudies');
  }
  if (options.includePermits) {
    fillMergedBlock(header, col.permitName, col.permitMark, 'ΑΔΕΙΟΔΟΤΗΣΕΙΣ', 'headPermits');
  }
  const headerRow = push(header);
  if (options.includeStudies) addMerge(merges, headerRow, col.studyName, headerRow, col.studyMark);
  if (options.includePermits) addMerge(merges, headerRow, col.permitName, headerRow, col.permitMark);

  const dataStart = rows.length;
  for (let i = 0; i < span; i += 1) {
    const row = emptyRow(colCount);
    if (i === 0) {
      setCol(row, col, 'serial', { v: String(serial || 1), kind: 'serial' });
      setCol(row, col, 'title', { v: card.title || '(Χωρίς τίτλο)', kind: 'project' });
      setCol(row, col, 'status', { v: labels[card.status] || card.status || '—', kind: 'meta' });
      setCol(row, col, 'municipal', { v: card.municipalUnit || '—', kind: 'meta' });
      setCol(row, col, 'settlement', { v: card.settlement || '—', kind: 'meta' });
      setCol(row, col, 'category', { v: card.category || '—', kind: 'meta' });
    } else {
      setCol(row, col, 'serial', { v: '', kind: 'serial' });
      setCol(row, col, 'title', { v: '', kind: 'project' });
      setCol(row, col, 'status', { v: '', kind: 'meta' });
      setCol(row, col, 'municipal', { v: '', kind: 'meta' });
      setCol(row, col, 'settlement', { v: '', kind: 'meta' });
      setCol(row, col, 'category', { v: '', kind: 'meta' });
    }

    if (options.includeStudies) {
      const study = studies[i];
      if (study) {
        row[col.studyName] = { v: study.spec, kind: 'studyName' };
        row[col.studyMark] = { v: study.mark, kind: markKind(study) };
      } else if (i === 0 && studies.length === 0) {
        row[col.studyName] = { v: '—', kind: 'studyName' };
        row[col.studyMark] = { v: '', kind: 'markEmpty' };
      } else {
        row[col.studyName] = { v: '', kind: 'studyName' };
        row[col.studyMark] = { v: '', kind: 'markEmpty' };
      }
    }

    if (options.includePermits) {
      const permit = permits[i];
      if (permit) {
        row[col.permitName] = { v: permit.spec, kind: 'permitName' };
        row[col.permitMark] = { v: permit.mark, kind: markKind(permit) };
      } else if (i === 0 && permits.length === 0) {
        row[col.permitName] = { v: '—', kind: 'permitName' };
        row[col.permitMark] = { v: '', kind: 'markEmpty' };
      } else {
        row[col.permitName] = { v: '', kind: 'permitName' };
        row[col.permitMark] = { v: '', kind: 'markEmpty' };
      }
    }
    push(row);
  }
  const dataEnd = dataStart + span - 1;

  LEFT_COL_KEYS.forEach((key) => {
    if (col[key] == null) return;
    addMerge(merges, dataStart, col[key], dataEnd, col[key]);
  });

  if (options.includeStudies) {
    if (studies.length <= 1) {
      addMerge(merges, dataStart, col.studyName, dataEnd, col.studyName);
      addMerge(merges, dataStart, col.studyMark, dataEnd, col.studyMark);
    } else if (studies.length < span) {
      addMerge(merges, dataStart + studies.length, col.studyName, dataEnd, col.studyName);
      addMerge(merges, dataStart + studies.length, col.studyMark, dataEnd, col.studyMark);
    }
  }
  if (options.includePermits) {
    if (permits.length <= 1) {
      addMerge(merges, dataStart, col.permitName, dataEnd, col.permitName);
      addMerge(merges, dataStart, col.permitMark, dataEnd, col.permitMark);
    } else if (permits.length < span) {
      addMerge(merges, dataStart + permits.length, col.permitName, dataEnd, col.permitName);
      addMerge(merges, dataStart + permits.length, col.permitMark, dataEnd, col.permitMark);
    }
  }

  if (card.notes) {
    const noteRow = emptyRow(colCount);
    fillMergedBlock(noteRow, 0, colCount - 1, `Σημειώσεις: ${card.notes}`, 'notes');
    const r = push(noteRow);
    addMerge(merges, r, 0, r, colCount - 1);
  }

  return { rows, merges };
}

function buildBannerRows({ exportedAt, exportedBy, projectCount } = {}, excelOptions) {
  const { COL: col, COLS: colCount } = layoutFromOptions(excelOptions);
  const rows = [];
  const merges = [];

  const title = emptyRow(colCount);
  fillMergedBlock(title, 0, colCount - 1, REPORT_TITLE, 'reportTitle');
  rows.push(title);
  addMerge(merges, 0, 0, 0, colCount - 1);

  const left = [
    exportedAt ? `Ημερομηνία: ${exportedAt}` : null,
    projectCount != null ? `Έργα: ${projectCount}` : null,
  ].filter(Boolean).join('   ·   ');
  const right = exportedBy ? `Εξαγωγή: ${exportedBy}` : '';
  const leftEnd = ['category', 'settlement', 'municipal', 'status', 'title']
    .map((key) => col[key])
    .find((idx) => idx != null);
  const mid = leftEnd == null ? 0 : leftEnd;
  const meta = emptyRow(colCount);
  fillMergedBlock(meta, 0, mid, left || APP_TAGLINE, 'reportMetaLeft');
  if (mid + 1 <= colCount - 1) {
    fillMergedBlock(meta, mid + 1, colCount - 1, right, 'reportMetaRight');
  } else if (right) {
    meta[0] = { v: left ? `${left}   ·   ${right}` : right, kind: 'reportMetaLeft' };
  }
  rows.push(meta);
  addMerge(merges, 1, 0, 1, mid);
  if (mid + 1 <= colCount - 1) addMerge(merges, 1, mid + 1, 1, colCount - 1);

  return { rows, merges };
}

function buildFooterRows(excelOptions) {
  const { COLS: colCount } = layoutFromOptions(excelOptions);
  const rows = [];
  const merges = [];
  const gap = emptyRow(colCount);
  for (let c = 0; c < colCount; c += 1) gap[c] = { v: '', kind: 'gap' };
  rows.push(gap);
  const credit = emptyRow(colCount);
  fillMergedBlock(credit, 0, colCount - 1, REPORT_CREDIT, 'reportCredit');
  rows.push(credit);
  addMerge(merges, 1, 0, 1, colCount - 1);
  return { rows, merges };
}

function appendBlock(allRows, allMerges, block) {
  const offset = allRows.length;
  block.merges.forEach((m) => {
    allMerges.push({
      s: { r: m.s.r + offset, c: m.s.c },
      e: { r: m.e.r + offset, c: m.e.c },
    });
  });
  block.rows.forEach((row) => allRows.push(row));
}

function buildSeparatorRows(excelOptions) {
  const { COLS: colCount } = layoutFromOptions(excelOptions);
  const merges = [];
  const bar = emptyRow(colCount);
  fillMergedBlock(bar, 0, colCount - 1, '', 'separator');
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } });
  return { rows: [bar], merges };
}

function buildHubExcelModel(proposals, statusLabels, headerInfo, excelOptions) {
  const cards = checklist.buildHubCards(proposals);
  const allRows = [];
  const allMerges = [];
  appendBlock(allRows, allMerges, buildBannerRows({
    exportedAt: headerInfo && headerInfo.exportedAt,
    exportedBy: headerInfo && headerInfo.exportedBy,
    projectCount: cards.length,
  }, excelOptions));
  cards.forEach((card, index) => {
    if (index > 0) appendBlock(allRows, allMerges, buildSeparatorRows(excelOptions));
    appendBlock(allRows, allMerges, buildCardRows(card, statusLabels, index + 1, excelOptions));
  });
  appendBlock(allRows, allMerges, buildFooterRows(excelOptions));
  return { cards, rows: allRows, merges: allMerges };
}

function styleForKind(kind) {
  return S[kind] || S.blank;
}

function writeHubExcelWorkbook({ proposals, destFilePath, exportedBy, appVersion, exportedAt, excelOptions }) {
  const model = buildHubExcelModel(proposals, null, { exportedAt, exportedBy, appVersion }, excelOptions);
  const { COL: col, COLS: colCount } = layoutFromOptions(excelOptions);
  const aoa = model.rows.map((row) => row.map((cell) => cell.v));
  const ws = XLSX.utils.aoa_to_sheet(aoa.length ? aoa : [['(Χωρίς έργα)']]);

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = range.s.r; R <= range.e.r; R += 1) {
    const modelRow = model.rows[R];
    for (let C = range.s.c; C <= range.e.c; C += 1) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      const kind = modelRow ? modelRow[C].kind : 'blank';
      ws[addr].s = styleForKind(kind);
    }
  }

  ws['!merges'] = model.merges;
  const colKeys = Object.entries(col).sort((a, b) => a[1] - b[1]).map(([key]) => key);
  ws['!cols'] = Array.from({ length: colCount }, (_, i) => {
    const key = colKeys[i];
    return { wch: (key && COL_WIDTH[key]) || 12 };
  });
  ws['!rows'] = model.rows.map((row) => {
    if (row[0].kind === 'reportTitle') return { hpt: 26 };
    if (row[0].kind === 'reportMetaLeft') return { hpt: 18 };
    if (row[0].kind === 'reportCredit') return { hpt: 16 };
    if (row[0].kind === 'headLeft') return { hpt: 22 };
    if (row[0].kind === 'notes') return { hpt: 20 };
    if (row[0].kind === 'separator') return { hpt: 6 };
    if (row[0].kind === 'gap') return { hpt: 12 };
    return { hpt: 22 };
  });

  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: REPORT_TITLE,
    Subject: REPORT_SUBTITLE,
    Author: APP_NAME,
    Company: APP_NAME,
  };
  XLSX.utils.book_append_sheet(wb, ws, 'Καρτέλες έργων');

  const totalFiles = model.cards.reduce((sum, c) => sum + (Number(c.files) || 0), 0);
  const meta = [
    [REPORT_TITLE],
    [APP_NAME, APP_TAGLINE],
    ['Ημερομηνία εξαγωγής', exportedAt || '—'],
    ['Εξαγωγή από', exportedBy || '—'],
    ['Έκδοση εφαρμογής', appVersion || '—'],
    ['Σύνολο έργων', model.cards.length],
    ['Σύνολο αρχείων', totalFiles],
    [''],
    ['Υπόμνημα'],
    ['✓', 'Υπάρχει αρχείο μελέτης / Η άδεια εκδόθηκε'],
    ['—', 'Δεν έχει καταχωρηθεί αρχείο μελέτης'],
    ['×', 'Εκκρεμεί η άδεια (δεν έχει σημειωθεί έκδοση)'],
    [''],
    ['Κάθε έργο είναι ξεχωριστή καρτέλα. Εμφανίζονται μόνο οι κατηγορίες που έχουν δημιουργηθεί στο έργο.'],
    [REPORT_CREDIT],
  ];
  const metaWs = XLSX.utils.aoa_to_sheet(meta);
  if (metaWs['A1']) {
    metaWs['A1'].s = S.reportTitle;
    metaWs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  }
  if (metaWs['A2']) metaWs['A2'].s = S.reportCredit;
  if (metaWs['B2']) metaWs['B2'].s = S.reportCredit;
  metaWs['!cols'] = [{ wch: 28 }, { wch: 72 }];
  XLSX.utils.book_append_sheet(wb, metaWs, 'Πληροφορίες');
  XLSX.writeFile(wb, destFilePath);
  return {
    success: true,
    filePath: destFilePath,
    rowCount: model.cards.length,
    sheetCount: wb.SheetNames.length,
    exportedAt,
    format: 'excel',
  };
}

module.exports = {
  APP_NAME,
  APP_TAGLINE,
  REPORT_TITLE,
  REPORT_CREDIT,
  COLS,
  COL,
  BANNER_ROW_COUNT,
  DEFAULT_EXCEL_OPTIONS,
  STATUS_LABELS,
  normalizeExcelOptions,
  layoutFromOptions,
  buildCardRows,
  buildHubExcelModel,
  writeHubExcelWorkbook,
};

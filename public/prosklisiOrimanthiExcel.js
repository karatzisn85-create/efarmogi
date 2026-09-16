/**
 * Μικτή εξαγωγή προσκλήσεων + καρτέλες ωρίμανσης συσχετισμένων έργων.
 * Αριστερά τα στοιχεία της πρόσκλησης (συγχώνευση καθ’ ύψος),
 * δεξιά η ίδια διακλάδωση μελετών / αδειών όπως στην εξαγωγή ωρίμανσης.
 */
const XLSX = require('xlsx-js-style');
const checklist = require('../app/core/orimanthiFileChecklist');
const prosklisiCatalog = require('../app/core/prosklisiCatalog');
const hub = require('./orimanthiHubExcel');

const REPORT_TITLE = 'ΕΞΑΓΩΓΗ ΠΡΟΣΚΛΗΣΕΩΝ ΜΕ ΩΡΙΜΑΝΣΗ ΕΡΓΩΝ';
const REPORT_SUBTITLE = `${hub.APP_TAGLINE} — προσκλήσεις και καρτέλες συσχετισμένων έργων`;
const MIXED_SHEET_NAME = 'Προσκλήσεις και ωρίμανση';
// A4 οριζόντια με τα περιθώρια του φύλλου. Το πόσες προσκλήσεις χωράνε
// βγαίνει από το ύψος κάθε πρόσκλησης μετά τη σμίκρυνση στο πλάτος της σελίδας.
const A4_LANDSCAPE_PRINTABLE_PT = Math.round(((210 / 25.4) - 0.55 - 0.45) * 72);
const A4_LANDSCAPE_PRINTABLE_WIDTH_PT = Math.round(((297 / 25.4) - 0.4 - 0.4) * 72);
const PRINT_SAFETY_PT = 24;
const DEFAULT_PRINTABLE_PAGE_PT = A4_LANDSCAPE_PRINTABLE_PT - PRINT_SAFETY_PT;
const EXCEL_PT_PER_CHAR = 7 * 72 / 96;
const GROUP_INVITATION = 'ΠΡΟΣΚΛΗΣΗ';
const GROUP_ORIMANTHI = 'ΩΡΙΜΑΝΣΗ ΕΡΓΩΝ';
const EMPTY_ORIMANTHI_CARD = {
  title: '—',
  status: '',
  actionResponsible: '—',
  municipalUnit: '—',
  settlement: '—',
  category: '—',
  notes: '',
  meletes: [],
  adeiodotiseis: [],
  subprojectTitles: [''],
};

const MIXED_CORE_FIELD_IDS = [
  'rowNumber',
  'title',
  'axis',
  'fundingSource',
  'deadline',
  'budgetRange',
];

const INVITATION_FIELDS = [
  { id: 'rowNumber', label: 'Α/Α', width: 6 },
  { id: 'title', label: 'Τίτλος πρόσκλησης', width: 42 },
  { id: 'axis', label: 'Άξονας / δράση', width: 26 },
  { id: 'fundingSource', label: 'Πηγή χρηματοδότησης', width: 26 },
  { id: 'deadline', label: 'Ημ. λήξης', width: 14 },
  { id: 'budgetRange', label: 'Εύρος Π/Υ', width: 16 },
  { id: 'code', label: 'Κωδικός ΟΠΣ', width: 16 },
  { id: 'originalDeadline', label: 'Αρχική λήξη', width: 14 },
  { id: 'lastModificationDate', label: 'Ημ. τροποποίησης', width: 16 },
  { id: 'status', label: 'Κατάσταση', width: 16 },
  { id: 'diavgeiaAda', label: 'ΑΔΑ Διαύγειας', width: 16 },
  { id: 'linkedProjectsLabel', label: 'Συσχετισμένα έργα', width: 28 },
  { id: 'relatedEntaxeisCount', label: 'Εντάξεις', width: 10 },
  { id: 'createdAt', label: 'Ημ. δημιουργίας', width: 14 },
  { id: 'updatedAt', label: 'Ημ. ενημέρωσης', width: 14 },
  { id: 'modificationsCount', label: 'Τροποποιήσεις', width: 12 },
];

const MIXED_LABELS = INVITATION_FIELDS.reduce((acc, field) => {
  acc[field.id] = field.label;
  return acc;
}, {});

const DATE_FIELD_IDS = {
  deadline: true,
  originalDeadline: true,
  lastModificationDate: true,
  createdAt: true,
  updatedAt: true,
};

const INV_COL_WIDTH = INVITATION_FIELDS.reduce((acc, field) => {
  acc[field.id] = field.width;
  return acc;
}, {});

const ORI_COL_WIDTH = {
  ...hub.COL_WIDTH,
  serial: 10,
  title: 32,
  status: 16,
  municipal: 18,
  settlement: 16,
  category: 24,
  studyName: 24,
  studyMark: 8,
  permitName: 26,
  permitMark: 9,
};

const ORI_HEADER_LABELS = {
  serial: 'Α/Α έργου',
  title: 'Τίτλος έργου',
  subprojects: 'Υποέργα',
  actionResponsible: 'Υπεύθυνος πράξης',
  status: 'Κατάσταση',
  municipal: 'Δημοτική ενότητα',
  settlement: 'Οικισμός',
  category: 'Κατηγορία / εξειδίκευση',
  studyName: 'Ονομασία',
  studyMark: 'Αρχείο',
  permitName: 'Ονομασία',
  permitMark: 'Έκδοση',
};

function borderAll(color) {
  const c = { style: 'thin', color: { rgb: color } };
  return { top: c, bottom: c, left: c, right: c };
}

function style(font, fill, alignment, border) {
  return {
    font: { name: 'Calibri', ...font },
    fill: { fgColor: { rgb: fill } },
    alignment: {
      wrapText: !!(alignment && alignment.wrapText),
      horizontal: 'center',
      vertical: 'center',
    },
    border: borderAll(border),
  };
}

const LINE = 'C7D2FE';
const MIXED_S = {
  invHeadGroup: style(
    { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
    '312E81',
    { horizontal: 'center', vertical: 'center' },
    '1E1B4B'
  ),
  oriHeadGroup: style(
    { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
    '4338CA',
    { horizontal: 'center', vertical: 'center' },
    '3730A3'
  ),
  invHead: style(
    { bold: true, sz: 9, color: { rgb: 'FFFFFF' } },
    '4F46E5',
    { horizontal: 'center', vertical: 'center', wrapText: true },
    '3730A3'
  ),
  headLeft: style(
    { bold: true, sz: 9, color: { rgb: 'FFFFFF' } },
    '4338CA',
    { horizontal: 'center', vertical: 'center', wrapText: true },
    '3730A3'
  ),
  headStudies: style(
    { bold: true, sz: 9, color: { rgb: 'FFFFFF' } },
    '7C3AED',
    { horizontal: 'center', vertical: 'center', wrapText: true },
    '6D28D9'
  ),
  headPermits: style(
    { bold: true, sz: 9, color: { rgb: 'FFFFFF' } },
    '0D9488',
    { horizontal: 'center', vertical: 'center', wrapText: true },
    '0F766E'
  ),
  invSerial: style(
    { bold: true, sz: 12, color: { rgb: '312E81' } },
    'EEF2FF',
    { horizontal: 'center', vertical: 'top' },
    LINE
  ),
  invTitle: style(
    { bold: true, sz: 11, color: { rgb: '1E1B4B' } },
    'EEF2FF',
    { horizontal: 'left', vertical: 'top', wrapText: true },
    LINE
  ),
  invMeta: style(
    { sz: 10, color: { rgb: '1E293B' } },
    'EEF2FF',
    { horizontal: 'left', vertical: 'top', wrapText: true },
    LINE
  ),
  serial: style(
    { bold: true, sz: 11, color: { rgb: '1E293B' } },
    'FFFFFF',
    { horizontal: 'center', vertical: 'top' },
    'E2E8F0'
  ),
  project: style(
    { bold: true, sz: 11, color: { rgb: '0F172A' } },
    'FFFFFF',
    { horizontal: 'left', vertical: 'top', wrapText: true },
    'E2E8F0'
  ),
  subproject: style(
    { sz: 8, color: { rgb: '475569' } },
    'F8FAFC',
    { horizontal: 'left', vertical: 'center', wrapText: true },
    'E2E8F0'
  ),
  meta: style(
    { sz: 10, color: { rgb: '1E293B' } },
    'FFFFFF',
    { horizontal: 'left', vertical: 'top', wrapText: true },
    'E2E8F0'
  ),
  studyName: style(
    { sz: 10, color: { rgb: '4C1D95' } },
    'F5F3FF',
    { horizontal: 'left', vertical: 'center', wrapText: true },
    'DDD6FE'
  ),
  serialAlt: style(
    { bold: true, sz: 11, color: { rgb: '1E293B' } },
    'F8FAFC',
    { horizontal: 'center', vertical: 'top' },
    'E2E8F0'
  ),
  projectAlt: style(
    { bold: true, sz: 11, color: { rgb: '0F172A' } },
    'F8FAFC',
    { horizontal: 'left', vertical: 'top', wrapText: true },
    'E2E8F0'
  ),
  subprojectAlt: style(
    { sz: 8, color: { rgb: '475569' } },
    'F1F5F9',
    { horizontal: 'left', vertical: 'center', wrapText: true },
    'E2E8F0'
  ),
  metaAlt: style(
    { sz: 10, color: { rgb: '1E293B' } },
    'F8FAFC',
    { horizontal: 'left', vertical: 'top', wrapText: true },
    'E2E8F0'
  ),
  permitName: style(
    { sz: 10, color: { rgb: '134E4A' } },
    'F0FDFA',
    { horizontal: 'left', vertical: 'center', wrapText: true },
    'CCFBF1'
  ),
  markOk: style(
    { bold: true, sz: 12, color: { rgb: '047857' } },
    'D1FAE5',
    { horizontal: 'center', vertical: 'center' },
    'A7F3D0'
  ),
  markEmpty: style(
    { bold: true, sz: 12, color: { rgb: '94A3B8' } },
    'F8FAFC',
    { horizontal: 'center', vertical: 'center' },
    'E2E8F0'
  ),
  markPending: style(
    { bold: true, sz: 12, color: { rgb: 'B45309' } },
    'FEF3C7',
    { horizontal: 'center', vertical: 'center' },
    'FDE68A'
  ),
  markApplied: style(
    { bold: true, sz: 12, color: { rgb: '4338CA' } },
    'EEF2FF',
    { horizontal: 'center', vertical: 'center' },
    'C7D2FE'
  ),
  notes: style(
    { sz: 9, color: { rgb: '475569' }, italic: true },
    'F8FAFC',
    { horizontal: 'left', vertical: 'center', wrapText: true },
    'E2E8F0'
  ),
  separator: style(
    { sz: 8, color: { rgb: '312E81' } },
    '312E81',
    { horizontal: 'center', vertical: 'center' },
    '1E1B4B'
  ),
  projectBreak: style(
    { sz: 8, color: { rgb: 'C7D2FE' } },
    'E2E8F0',
    { horizontal: 'center', vertical: 'center' },
    'CBD5E1'
  ),
  gap: style(
    { sz: 8, color: { rgb: 'FFFFFF' } },
    'FFFFFF',
    { horizontal: 'left', vertical: 'center' },
    'FFFFFF'
  ),
  reportTitle: style(
    { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
    '312E81',
    { horizontal: 'center', vertical: 'center' },
    '312E81'
  ),
  reportMetaLeft: style(
    { sz: 9, color: { rgb: '3730A3' } },
    'EEF2FF',
    { horizontal: 'left', vertical: 'center' },
    'C7D2FE'
  ),
  reportMetaRight: style(
    { sz: 9, color: { rgb: '3730A3' } },
    'EEF2FF',
    { horizontal: 'right', vertical: 'center' },
    'C7D2FE'
  ),
  reportCredit: style(
    { sz: 8, color: { rgb: '64748B' } },
    'FFFFFF',
    { horizontal: 'center', vertical: 'center' },
    'FFFFFF'
  ),
  blank: {
    font: { name: 'Calibri', sz: 10 },
    alignment: { horizontal: 'center', vertical: 'center' },
  },
};

function mixedStyle(kind) {
  return MIXED_S[kind] || MIXED_S.blank;
}

function asBool(value, fallback) {
  if (value === true || value === false) return value;
  return fallback;
}

function keepWholeInvitationsEnabled(excelOptions) {
  return asBool(excelOptions && excelOptions.keepWholeInvitations, true);
}

function mixedFieldLabel(field) {
  if (!field) return '';
  return MIXED_LABELS[field.id] || field.label || field.id;
}

function formatExportDate(value) {
  if (value == null || value === '') return '—';
  const text = String(value).trim();
  if (!text || text === '-') return '—';
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const dmy = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) return `${dmy[1]}/${dmy[2]}/${dmy[3]}`;
  return text;
}

function resolveMixedInvitationFields(selectedFields) {
  const selected = new Set(Array.isArray(selectedFields) ? selectedFields : []);
  const extras = INVITATION_FIELDS.filter((field) => (
    selected.has(field.id) && !MIXED_CORE_FIELD_IDS.includes(field.id)
  ));
  const core = INVITATION_FIELDS.filter((field) => MIXED_CORE_FIELD_IDS.includes(field.id));
  return core.concat(extras);
}

function invitationCellKind(fieldId) {
  if (fieldId === 'rowNumber') return 'invSerial';
  if (fieldId === 'title') return 'invTitle';
  return 'invMeta';
}

function getInvitationCellValue(invitation, field, index) {
  if (field.id === 'rowNumber') return String(index + 1);
  if (DATE_FIELD_IDS[field.id]) return formatExportDate(invitation && invitation[field.id]);
  if (field.id === 'modificationsCount') {
    if (Number.isFinite(invitation && invitation.modificationsCount)) {
      return String(invitation.modificationsCount);
    }
    const mods = invitation && invitation.modifications;
    return String(Array.isArray(mods) ? mods.length : 0);
  }
  if (field.id === 'diavgeiaAda') {
    return (invitation && (invitation.diavgeiaAda || (invitation.diavgeiaMeta && invitation.diavgeiaMeta.ada))) || '—';
  }
  if (field.id === 'linkedProjectsLabel') {
    if (invitation && invitation.linkedProjectsLabel) return invitation.linkedProjectsLabel;
    if (invitation && Array.isArray(invitation.linkedProjects)) {
      const titles = invitation.linkedProjects
        .map((row) => (typeof row === 'string' ? row : (row && (row.title || row.projectTitle)) || ''))
        .filter(Boolean);
      return titles.join(' · ') || '—';
    }
    return '—';
  }
  if (field.id === 'relatedEntaxeisCount') {
    return Number.isFinite(invitation && invitation.relatedEntaxeisCount)
      ? String(invitation.relatedEntaxeisCount)
      : '0';
  }
  const value = invitation && invitation[field.id];
  if (value == null || value === '') return '—';
  return String(value);
}

function proposalIndexById(proposals) {
  const map = new Map();
  (proposals || []).forEach((proposal) => {
    if (proposal && proposal.id) map.set(String(proposal.id), proposal);
  });
  return map;
}

function resolveLinkedProposals(invitation, allProposals) {
  const links = prosklisiCatalog.normalizeLinkedOrimanthiProposals(
    invitation && invitation.linkedOrimanthiProposals
  );
  const byId = proposalIndexById(allProposals);
  return links.map((link) => {
    const live = byId.get(link.id);
    if (live) return live;
    return {
      id: link.id,
      title: link.title || '—',
      status: link.status || '',
      projectCategory: link.projectCategory || '',
      municipalUnit: link.municipalUnit || '',
      settlement: '',
      notes: '',
      fileGroups: [],
    };
  });
}

function shiftBlock(block, colOffset, totalCols) {
  const rows = (block.rows || []).map((row) => {
    const next = hub.emptyRow(totalCols);
    for (let i = 0; i < row.length; i += 1) {
      next[i + colOffset] = row[i];
    }
    return next;
  });
  const merges = (block.merges || []).map((m) => ({
    s: { r: m.s.r, c: m.s.c + colOffset },
    e: { r: m.e.r, c: m.e.c + colOffset },
  }));
  return { rows, merges };
}

function fillInvitationCells(row, columns, invitation, index, onlyFirst) {
  columns.forEach((field, col) => {
    row[col] = {
      v: onlyFirst ? getInvitationCellValue(invitation, field, index) : '',
      kind: invitationCellKind(field.id),
    };
  });
}

function orimanthiLeftLastIndex(excelOptions) {
  const { COL: col, COLS: colCount } = hub.layoutFromOptions(excelOptions);
  return hub.lastLeftColIndex(col, colCount);
}

function buildMixedBanner({ exportedAt, exportedBy, invitationCount, projectCount } = {}, totalCols, invColCount) {
  const rows = [];
  const merges = [];
  const title = hub.emptyRow(totalCols);
  hub.fillMergedBlock(title, 0, totalCols - 1, REPORT_TITLE, 'reportTitle');
  rows.push(title);
  hub.addMerge(merges, 0, 0, 0, totalCols - 1);

  const left = [
    exportedAt ? `Ημερομηνία: ${exportedAt}` : null,
    invitationCount != null ? `Προσκλήσεις: ${invitationCount}` : null,
    projectCount != null ? `Έργα ωρίμανσης: ${projectCount}` : null,
  ].filter(Boolean).join('   ·   ');
  const right = exportedBy ? `Εξαγωγή: ${exportedBy}` : '';
  const mid = Math.max(0, invColCount - 1);
  const meta = hub.emptyRow(totalCols);
  hub.fillMergedBlock(meta, 0, mid, left || hub.APP_TAGLINE, 'reportMetaLeft');
  if (mid + 1 <= totalCols - 1) {
    hub.fillMergedBlock(meta, mid + 1, totalCols - 1, right, 'reportMetaRight');
  }
  rows.push(meta);
  hub.addMerge(merges, 1, 0, 1, mid);
  if (mid + 1 <= totalCols - 1) hub.addMerge(merges, 1, mid + 1, 1, totalCols - 1);
  return { rows, merges };
}

function fillOrimanthiHeaderRows(excelOptions, colOffset, totalCols) {
  const { COL: col, options } = hub.layoutFromOptions(excelOptions);
  const group = hub.emptyRow(totalCols);
  const detail = hub.emptyRow(totalCols);
  const merges = [];
  const oriLeftEnd = colOffset + orimanthiLeftLastIndex(excelOptions);

  hub.fillMergedBlock(group, colOffset, oriLeftEnd, GROUP_ORIMANTHI, 'oriHeadGroup');
  hub.addMerge(merges, 0, colOffset, 0, oriLeftEnd);

  if (options.includeStudies) {
    hub.fillMergedBlock(group, colOffset + col.studyName, colOffset + col.studyMark, 'ΜΕΛΕΤΕΣ ΕΡΓΟΥ', 'headStudies');
    hub.addMerge(merges, 0, colOffset + col.studyName, 0, colOffset + col.studyMark);
  }
  if (options.includePermits) {
    hub.fillMergedBlock(group, colOffset + col.permitName, colOffset + col.permitMark, 'ΑΔΕΙΟΔΟΤΗΣΕΙΣ', 'headPermits');
    hub.addMerge(merges, 0, colOffset + col.permitName, 0, colOffset + col.permitMark);
  }

  Object.keys(ORI_HEADER_LABELS).forEach((key) => {
    if (col[key] == null) return;
    detail[colOffset + col[key]] = { v: ORI_HEADER_LABELS[key], kind: 'headLeft' };
  });
  if (options.includeStudies) {
    detail[colOffset + col.studyName].kind = 'headStudies';
    detail[colOffset + col.studyMark].kind = 'headStudies';
  }
  if (options.includePermits) {
    detail[colOffset + col.permitName].kind = 'headPermits';
    detail[colOffset + col.permitMark].kind = 'headPermits';
  }

  return { rows: [group, detail], merges };
}

function buildMixedHeader(columns, excelOptions) {
  const { COLS: orimanthiCols } = hub.layoutFromOptions(excelOptions);
  const invCount = columns.length;
  const totalCols = invCount + orimanthiCols;
  const ori = fillOrimanthiHeaderRows(excelOptions, invCount, totalCols);
  const group = ori.rows[0];
  const detail = ori.rows[1];
  const merges = ori.merges.slice();

  hub.fillMergedBlock(group, 0, invCount - 1, GROUP_INVITATION, 'invHeadGroup');
  hub.addMerge(merges, 0, 0, 0, invCount - 1);

  columns.forEach((field, idx) => {
    detail[idx] = { v: mixedFieldLabel(field), kind: 'invHead' };
  });

  return {
    rows: [group, detail],
    merges,
    totalCols,
    orimanthiCols,
    headerRowCount: 2,
  };
}

const ALT_CARD_KINDS = {
  serial: 'serialAlt',
  project: 'projectAlt',
  subproject: 'subprojectAlt',
  meta: 'metaAlt',
};

function toAlternateCardRows(block) {
  return {
    merges: block.merges,
    rows: (block.rows || []).map((row) => row.map((cell) => (
      cell && ALT_CARD_KINDS[cell.kind]
        ? { ...cell, kind: ALT_CARD_KINDS[cell.kind] }
        : cell
    ))),
  };
}

function buildOrimanthiProjectBreak(colOffset, totalCols) {
  const bar = hub.emptyRow(totalCols);
  if (colOffset <= totalCols - 1) {
    hub.fillMergedBlock(bar, colOffset, totalCols - 1, '', 'projectBreak');
  }
  return {
    rows: [bar],
    merges: colOffset <= totalCols - 1
      ? [{ s: { r: 0, c: colOffset }, e: { r: 0, c: totalCols - 1 } }]
      : [],
  };
}

function appendLocalBlock(rows, merges, block, invitation, columns, index, writeInvitationValues) {
  const localStart = rows.length;
  (block.rows || []).forEach((row, rowIndex) => {
    fillInvitationCells(row, columns, invitation, index, writeInvitationValues && rowIndex === 0);
    rows.push(row);
  });
  (block.merges || []).forEach((m) => {
    merges.push({
      s: { r: m.s.r + localStart, c: m.s.c },
      e: { r: m.e.r + localStart, c: m.e.c },
    });
  });
}

function buildInvitationBlock(invitation, index, columns, cards, excelOptions, totalCols) {
  const rows = [];
  const merges = [];
  const linkedCards = cards.length ? cards : [EMPTY_ORIMANTHI_CARD];
  linkedCards.forEach((card, cardIndex) => {
    if (cardIndex > 0) {
      appendLocalBlock(
        rows,
        merges,
        buildOrimanthiProjectBreak(columns.length, totalCols),
        invitation,
        columns,
        index,
        false
      );
    }
    const serial = cards.length ? cardIndex + 1 : '—';
    const dataBlock = hub.buildCardRows(card, null, serial, excelOptions, {
      includeHeader: false,
      attachNotesToTitle: true,
    });
    const shifted = shiftBlock(dataBlock, columns.length, totalCols);
    appendLocalBlock(
      rows,
      merges,
      cardIndex % 2 === 1 ? toAlternateCardRows(shifted) : shifted,
      invitation,
      columns,
      index,
      cardIndex === 0
    );
  });
  if (rows.length > 1) {
    columns.forEach((_, col) => {
      hub.addMerge(merges, 0, col, rows.length - 1, col);
    });
  }
  return { rows, merges };
}

function buildMixedFooter(totalCols) {
  const rows = [];
  const merges = [];
  const gap = hub.emptyRow(totalCols);
  for (let c = 0; c < totalCols; c += 1) gap[c] = { v: '', kind: 'gap' };
  rows.push(gap);
  const credit = hub.emptyRow(totalCols);
  hub.fillMergedBlock(credit, 0, totalCols - 1, hub.REPORT_CREDIT, 'reportCredit');
  rows.push(credit);
  hub.addMerge(merges, 1, 0, 1, totalCols - 1);
  return { rows, merges };
}

function buildMixedSeparator(totalCols) {
  const bar = hub.emptyRow(totalCols);
  hub.fillMergedBlock(bar, 0, totalCols - 1, '', 'separator');
  return {
    rows: [bar],
    merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }],
  };
}

function buildMixedProsklisiOrimanthiModel({
  invitations,
  allProposals,
  selectedFields,
  columns,
  excelOptions,
  headerInfo,
} = {}) {
  const invitationColumns = Array.isArray(columns) && columns.length
    ? columns
    : resolveMixedInvitationFields(selectedFields);
  const header = buildMixedHeader(invitationColumns, excelOptions);
  const allRows = [];
  const allMerges = [];
  const invitationList = Array.isArray(invitations) ? invitations : [];
  const linkedCardsByInvitation = invitationList.map((invitation) => (
    checklist.buildHubCards(resolveLinkedProposals(invitation, allProposals))
  ));
  const projectCount = linkedCardsByInvitation.reduce((sum, cards) => sum + cards.length, 0);

  hub.appendBlock(allRows, allMerges, buildMixedBanner({
    exportedAt: headerInfo && headerInfo.exportedAt,
    exportedBy: headerInfo && headerInfo.exportedBy,
    invitationCount: invitationList.length,
    projectCount,
  }, header.totalCols, invitationColumns.length));
  hub.appendBlock(allRows, allMerges, header);

  const invitationBlocks = [];
  invitationList.forEach((invitation, index) => {
    if (index > 0) hub.appendBlock(allRows, allMerges, buildMixedSeparator(header.totalCols));
    const startRow = allRows.length;
    hub.appendBlock(
      allRows,
      allMerges,
      buildInvitationBlock(
        invitation,
        index,
        invitationColumns,
        linkedCardsByInvitation[index],
        excelOptions,
        header.totalCols
      )
    );
    invitationBlocks.push({
      startRow,
      endRow: allRows.length - 1,
      separatorRow: null,
    });
  });
  invitationBlocks.forEach((block, index) => {
    if (index >= invitationBlocks.length - 1) return;
    block.separatorRow = invitationBlocks[index + 1].startRow - 1;
  });
  const footerStartRow = allRows.length;
  hub.appendBlock(allRows, allMerges, buildMixedFooter(header.totalCols));

  return {
    rows: allRows,
    merges: allMerges,
    columns: invitationColumns,
    totalCols: header.totalCols,
    invitationCount: invitationList.length,
    projectCount,
    headerRowCount: header.headerRowCount,
    freezeRows: 2 + header.headerRowCount,
    invitationBlocks,
    footerStartRow,
    excelOptions: hub.normalizeExcelOptions(excelOptions),
  };
}

function rowHeightFor(row) {
  if (!row || !row.length) return 22;
  const kinds = row.map((cell) => cell && cell.kind);
  if (kinds.some((kind) => kind === 'separator')) return 18;
  if (kinds.some((kind) => kind === 'projectBreak')) return 8;
  if (kinds.some((kind) => kind === 'notes')) return 24;
  if (kinds[0] === 'reportTitle') return 30;
  if (kinds[0] === 'reportMetaLeft' || kinds[0] === 'reportMetaRight') return 20;
  if (kinds.some((kind) => kind === 'invHeadGroup' || kind === 'oriHeadGroup')) return 22;
  if (kinds.some((kind) => kind === 'invHead' || kind === 'headLeft' || kind === 'headStudies' || kind === 'headPermits')) {
    return 32;
  }
  if (kinds[0] === 'reportCredit') return 18;
  if (kinds.some((kind) => kind === 'gap')) return 14;
  return 28;
}

function estimateWrappedHeight(text, widthChars, fontPt, minHpt) {
  const value = String(text || '').trim();
  if (!value) return minHpt;
  const perLine = Math.max(8, Math.floor(Number(widthChars) || 12));
  const lines = value.split(/\n/).reduce((sum, part) => (
    sum + Math.max(1, Math.ceil(part.length / perLine))
  ), 0);
  return Math.min(96, Math.max(minHpt, lines * (fontPt + 6) + 10));
}

function columnWidthFor(colIndex, columns, excelOptions) {
  if (colIndex < columns.length) {
    const field = columns[colIndex];
    return (field && INV_COL_WIDTH[field.id]) || 16;
  }
  const { COL: oriCol } = hub.layoutFromOptions(excelOptions);
  const oriIndex = colIndex - columns.length;
  const found = Object.entries(oriCol).find(([, idx]) => idx === oriIndex);
  const key = found && found[0];
  return (key && ORI_COL_WIDTH[key]) || 14;
}

const WRAPPED_TEXT_KINDS = {
  invTitle: true,
  invMeta: true,
  project: true,
  projectAlt: true,
  subproject: true,
  subprojectAlt: true,
  meta: true,
  metaAlt: true,
  studyName: true,
  permitName: true,
  notes: true,
};

function wrappedFontPt(kind) {
  if (kind === 'subproject' || kind === 'subprojectAlt' || kind === 'notes') return 8;
  if (
    kind === 'invMeta'
    || kind === 'studyName'
    || kind === 'permitName'
    || kind === 'meta'
    || kind === 'metaAlt'
  ) return 10;
  return 11;
}

function verticalMergeEnds(model) {
  const ends = new Map();
  ((model && model.merges) || []).forEach((m) => {
    if (m.e.r > m.s.r) ends.set(`${m.s.r}:${m.s.c}`, m.e.r);
  });
  return ends;
}

function computeMixedRowHeights(model) {
  const columns = (model && model.columns) || [];
  const rows = (model && model.rows) || [];
  const heights = rows.map((row) => rowHeightFor(row));
  const mergeEnds = verticalMergeEnds(model);

  rows.forEach((row, rowIndex) => {
    (row || []).forEach((cell, col) => {
      if (!cell || !cell.v) return;
      if (!WRAPPED_TEXT_KINDS[cell.kind]) return;
      const fontPt = wrappedFontPt(cell.kind);
      const minH = (cell.kind === 'subproject' || cell.kind === 'subprojectAlt' || cell.kind === 'notes')
        ? 22
        : 28;
      const needed = estimateWrappedHeight(
        cell.v,
        columnWidthFor(col, columns, model.excelOptions),
        fontPt,
        minH
      );
      const lastRow = mergeEnds.get(`${rowIndex}:${col}`);
      if (lastRow == null) {
        heights[rowIndex] = Math.max(heights[rowIndex], needed);
        return;
      }
      // Το κείμενο απλώνεται σε όλο το ενωμένο κελί — μοιράζουμε μόνο ό,τι λείπει.
      let available = 0;
      for (let r = rowIndex; r <= lastRow; r += 1) available += heights[r];
      if (available >= needed) return;
      const extra = (needed - available) / (lastRow - rowIndex + 1);
      for (let r = rowIndex; r <= lastRow; r += 1) heights[r] += extra;
    });
  });

  return heights.map((hpt) => ({ hpt: Math.round(hpt * 10) / 10 }));
}

function sumRowHeights(heights, from, toInclusive) {
  let total = 0;
  for (let i = from; i <= toInclusive; i += 1) {
    const row = heights[i];
    total += (row && Number(row.hpt)) || 0;
  }
  return total;
}

function invitationPackEndRow(block, lastRowIndex) {
  if (block && block.separatorRow != null) return block.separatorRow;
  return block ? block.endRow : lastRowIndex;
}

function sheetWidthPtFromCols(cols) {
  const chars = (Array.isArray(cols) ? cols : []).reduce((sum, col) => (
    sum + Math.max(1, Number(col && col.wch) || 14)
  ), 0);
  return chars * EXCEL_PT_PER_CHAR;
}

function fitToWidthPrintScale(cols, printableWidthPt) {
  const pageW = Number(printableWidthPt) > 0
    ? Number(printableWidthPt)
    : A4_LANDSCAPE_PRINTABLE_WIDTH_PT;
  const sheetW = sheetWidthPtFromCols(cols);
  if (!(sheetW > 0)) return 1;
  return Math.min(1, pageW / sheetW);
}

function computeInvitationPageBreaks(model, heights, opts = {}) {
  const freezeRows = (model && model.freezeRows) || 4;
  const blocks = (model && model.invitationBlocks) || [];
  if (!blocks.length) return [];
  const printable = Number(opts.printablePagePt) > 0
    ? Number(opts.printablePagePt)
    : DEFAULT_PRINTABLE_PAGE_PT;
  const scale = Math.max(
    0.15,
    Math.min(1, Number(opts.printScale) > 0 ? Number(opts.printScale) : 1)
  );
  const headerPaper = sumRowHeights(heights, 0, Math.max(0, freezeRows - 1)) * scale;
  const capacity = Math.max(80, printable - headerPaper);
  const lastRowIndex = Math.max(0, ((heights && heights.length) || 0) - 1);
  const breaks = [];
  let used = 0;
  let prevPackEnd = null;

  blocks.forEach((block) => {
    const packEnd = invitationPackEndRow(block, lastRowIndex);
    const height = sumRowHeights(heights, block.startRow, packEnd) * scale;
    if (used > 0 && used + height > capacity) {
      const breakAfter = prevPackEnd + 1;
      if (breakAfter >= 1 && breakAfter < heights.length) breaks.push(breakAfter);
      used = height;
    } else {
      used += height;
    }
    prevPackEnd = packEnd;
  });
  return breaks;
}

async function writeMixedWorkbook({
  invitations,
  allProposals,
  selectedFields,
  columns,
  excelOptions,
  destFilePath,
  exportedBy,
  appVersion,
  exportedAt,
  organizationName,
}) {
  const model = buildMixedProsklisiOrimanthiModel({
    invitations,
    allProposals,
    selectedFields,
    columns,
    excelOptions,
    headerInfo: { exportedAt, exportedBy, appVersion, organizationName },
  });
  const { COL: orimanthiCol } = hub.layoutFromOptions(excelOptions);
  const aoa = model.rows.map((row) => row.map((cell) => (cell && cell.v != null ? cell.v : '')));
  const ws = XLSX.utils.aoa_to_sheet(aoa.length ? aoa : [['(Χωρίς προσκλήσεις)']]);

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = range.s.r; R <= range.e.r; R += 1) {
    const modelRow = model.rows[R];
    for (let C = range.s.c; C <= range.e.c; C += 1) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      const kind = modelRow && modelRow[C] ? modelRow[C].kind : 'blank';
      ws[addr].s = mixedStyle(kind);
    }
  }

  ws['!merges'] = model.merges;
  const invOffset = model.columns.length;
  const orimanthiKeys = Object.entries(orimanthiCol).sort((a, b) => a[1] - b[1]).map(([key]) => key);
  ws['!cols'] = Array.from({ length: model.totalCols }, (_, i) => {
    if (i < invOffset) {
      const field = model.columns[i];
      return { wch: (field && INV_COL_WIDTH[field.id]) || 16 };
    }
    const key = orimanthiKeys[i - invOffset];
    return { wch: (key && ORI_COL_WIDTH[key]) || 14 };
  });
  ws['!rows'] = computeMixedRowHeights(model);
  const freezeRows = model.freezeRows || 4;
  ws['!freeze'] = {
    xSplit: 0,
    ySplit: freezeRows,
    topLeftCell: `A${freezeRows + 1}`,
    activePane: 'bottomLeft',
  };
  ws['!margins'] = {
    left: 0.4,
    right: 0.4,
    top: 0.55,
    bottom: 0.45,
    header: 0.2,
    footer: 0.2,
  };
  const keepWholeInvitations = keepWholeInvitationsEnabled(excelOptions);
  const rowHeights = ws['!rows'];
  const printScale = keepWholeInvitations ? fitToWidthPrintScale(ws['!cols']) : 1;
  const rowBreaks = keepWholeInvitations
    ? computeInvitationPageBreaks(model, rowHeights, { printScale })
    : [];
  if (keepWholeInvitations) {
    ws['!pageSetup'] = {
      paperSize: 9,
      orientation: 'landscape',
      fitToWidth: 1,
      fitToHeight: 0,
    };
  }

  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: REPORT_TITLE,
    Subject: REPORT_SUBTITLE,
    Author: hub.APP_NAME,
    Company: hub.APP_NAME,
  };
  XLSX.utils.book_append_sheet(wb, ws, MIXED_SHEET_NAME);

  const org = String(organizationName || '').trim();
  const meta = [
    [REPORT_TITLE],
    [hub.APP_NAME, hub.APP_TAGLINE],
    ['Φορέας', org || '—'],
    ['Ημερομηνία εξαγωγής', exportedAt || '—'],
    ['Εξαγωγή από', exportedBy || '—'],
    ['Έκδοση εφαρμογής', appVersion || '—'],
    ['Σύνολο προσκλήσεων', model.invitationCount],
    ['Συσχετισμένα έργα ωρίμανσης', model.projectCount],
    [''],
    ['Υπόμνημα ωρίμανσης'],
    ['✓', 'Υπάρχει αρχείο μελέτης / Η άδεια εκδόθηκε'],
    ['—', 'Δεν έχει καταχωρηθεί αρχείο μελέτης'],
    ['Αιτ.', 'Έχει γίνει αίτηση (εκκρεμεί η έκδοση)'],
    ['×', 'Εκκρεμεί η άδεια (δεν έχει σημειωθεί αίτηση ούτε έκδοση)'],
    [''],
    ['Αριστερά συγχωνεύονται τα στοιχεία της πρόσκλησης. Δεξιά κάθε συσχετισμένο έργο διακλαδώνει μελέτες και άδειες όπως στην εξαγωγή ωρίμανσης.'],
    [hub.REPORT_CREDIT],
  ];
  const metaWs = XLSX.utils.aoa_to_sheet(meta);
  const metaRange = XLSX.utils.decode_range(metaWs['!ref'] || 'A1');
  for (let R = metaRange.s.r; R <= metaRange.e.r; R += 1) {
    for (let C = metaRange.s.c; C <= metaRange.e.c; C += 1) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!metaWs[addr]) continue;
      metaWs[addr].s = (R === 0) ? MIXED_S.reportTitle : MIXED_S.blank;
    }
  }
  if (metaWs['A1']) {
    metaWs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  }
  metaWs['!cols'] = [{ wch: 32 }, { wch: 72 }];
  XLSX.utils.book_append_sheet(wb, metaWs, 'Πληροφορίες');
  XLSX.writeFile(wb, destFilePath);
  await patchMixedWorkbookView(destFilePath, {
    freezeRows,
    keepWholeInvitations,
    rowBreaks,
    sheetName: MIXED_SHEET_NAME,
  });
  return {
    success: true,
    filePath: destFilePath,
    rowCount: model.invitationCount,
    projectCount: model.projectCount,
    sheetCount: wb.SheetNames.length,
    exportedAt,
    format: 'excel',
  };
}

function loadJSZip() {
  try {
    return require('jszip');
  } catch (_) {
    try {
      const exceljsEntry = require.resolve('exceljs');
      return require(require.resolve('jszip', { paths: [require('path').dirname(exceljsEntry)] }));
    } catch (err) {
      return null;
    }
  }
}

async function patchMixedWorkbookView(destFilePath, {
  freezeRows,
  keepWholeInvitations = false,
  rowBreaks = [],
  sheetName = MIXED_SHEET_NAME,
} = {}) {
  const rows = Math.max(1, Number(freezeRows) || 4);
  try {
    const JSZip = loadJSZip();
    if (!JSZip) return;
    const fs = require('fs');
    const zip = await JSZip.loadAsync(fs.readFileSync(destFilePath));
    const sheetPath = 'xl/worksheets/sheet1.xml';
    const sheetFile = zip.file(sheetPath);
    if (!sheetFile) return;
    let xml = await sheetFile.async('string');
    if (/<sheetViews>[\s\S]*?<\/sheetViews>/.test(xml)) {
      const topLeft = `A${rows + 1}`;
      const views = `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${rows}" topLeftCell="${topLeft}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="${topLeft}" sqref="${topLeft}"/></sheetView></sheetViews>`;
      xml = xml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, views);
    }
    if (keepWholeInvitations) {
      xml = applyPrintLayoutXml(xml, {
        rowBreaks: Array.isArray(rowBreaks) ? rowBreaks : [],
      });
      const workbookPath = 'xl/workbook.xml';
      const workbookFile = zip.file(workbookPath);
      if (workbookFile) {
        let workbookXml = await workbookFile.async('string');
        workbookXml = applyPrintTitlesXml(workbookXml, sheetName, rows);
        zip.file(workbookPath, workbookXml);
      }
    }
    zip.file(sheetPath, xml);
    const out = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    fs.writeFileSync(destFilePath, out);
  } catch (_) {
    // Αν αποτύχει το πάγωμα / η εκτύπωση, το αρχείο μένει ανοίξιμο χωρίς τις ρυθμίσεις.
  }
}

function applyPrintLayoutXml(xml, { rowBreaks }) {
  let next = xml;
  if (!/<pageSetUpPr\b/.test(next)) {
    if (/<sheetPr\b[^>]*\/>/.test(next)) {
      next = next.replace(/<sheetPr\b([^>]*)\/>/, '<sheetPr$1><pageSetUpPr fitToPage="1"/></sheetPr>');
    } else if (/<sheetPr\b[^>]*>/.test(next)) {
      next = next.replace(/<sheetPr\b([^>]*)>/, '<sheetPr$1><pageSetUpPr fitToPage="1"/>');
    } else {
      next = next.replace(/<worksheet\b([^>]*)>/, '<worksheet$1><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
    }
  }
  const pageSetupXml = '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0" usePrinterDefaults="0"/>';
  if (/<pageSetup\b/.test(next)) {
    next = next.replace(/<pageSetup\b[^>]*\/>/, pageSetupXml);
    next = next.replace(/<pageSetup\b[\s\S]*?<\/pageSetup>/, pageSetupXml);
  } else if (/<pageMargins\b[^>]*\/>/.test(next)) {
    next = next.replace(/<pageMargins\b[^>]*\/>/, (m) => `${m}${pageSetupXml}`);
  } else if (/<\/pageMargins>/.test(next)) {
    next = next.replace(/<\/pageMargins>/, `</pageMargins>${pageSetupXml}`);
  } else {
    next = next.replace(/<\/worksheet>/, `${pageSetupXml}</worksheet>`);
  }
  next = next.replace(/<rowBreaks\b[\s\S]*?<\/rowBreaks>/g, '');
  const breaks = (rowBreaks || []).filter((id) => Number.isFinite(id) && id >= 1);
  if (breaks.length) {
    const brkXml = breaks
      .map((id) => `<brk id="${id}" max="16383" man="1"/>`)
      .join('');
    const rowBreaksXml = `<rowBreaks count="${breaks.length}" manualBreakCount="${breaks.length}">${brkXml}</rowBreaks>`;
    if (/<pageSetup\b[^>]*\/>/.test(next)) {
      next = next.replace(/<pageSetup\b[^>]*\/>/, (m) => `${m}${rowBreaksXml}`);
    } else {
      next = next.replace(/<\/worksheet>/, `${rowBreaksXml}</worksheet>`);
    }
  }
  return next;
}

function quoteSheetName(name) {
  return `'${String(name || MIXED_SHEET_NAME).replace(/'/g, "''")}'`;
}

function applyPrintTitlesXml(workbookXml, sheetName, lastTitleRow) {
  const formula = `${quoteSheetName(sheetName)}!$1:$${lastTitleRow}`;
  const entry = `<definedName name="_xlnm.Print_Titles">${formula}</definedName>`;
  if (/name="_xlnm\.Print_Titles"/.test(workbookXml)) {
    return workbookXml.replace(
      /<definedName name="_xlnm\.Print_Titles">[\s\S]*?<\/definedName>/,
      entry
    );
  }
  if (/<definedNames>/.test(workbookXml)) {
    return workbookXml.replace('<definedNames>', `<definedNames>${entry}`);
  }
  return workbookXml.replace('</workbook>', `<definedNames>${entry}</definedNames></workbook>`);
}

module.exports = {
  REPORT_TITLE,
  GROUP_INVITATION,
  GROUP_ORIMANTHI,
  MIXED_CORE_FIELD_IDS,
  INVITATION_FIELDS,
  EMPTY_ORIMANTHI_CARD,
  MIXED_SHEET_NAME,
  DEFAULT_PRINTABLE_PAGE_PT,
  formatExportDate,
  resolveMixedInvitationFields,
  getInvitationCellValue,
  resolveLinkedProposals,
  buildMixedProsklisiOrimanthiModel,
  computeMixedRowHeights,
  computeInvitationPageBreaks,
  fitToWidthPrintScale,
  keepWholeInvitationsEnabled,
  writeMixedWorkbook,
};

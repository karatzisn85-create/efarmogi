/**
 * Excel πρότυπο / εισαγωγή υποέργων (MVP).
 * Τα enums φορτώνονται από subprojectImportEnums.json (γεννημένο από src/data/formOptions.js).
 * Μετά από αλλαγή στα enums: npm run export-subproject-import-enums
 * Χειροκίνητα QA (μετά από αλλαγή σε formOptions / validation):
 * 1) npm run export-subproject-import-enums
 * 2) Λήψη προτύπου → κενό αρχείο → προεπισκόπηση (0 γραμμές, χωρίς σφάλματα μορφής)
 * 3) Μία έγκυρη γραμμή (Μια Σύμβαση, κατάσταση χωρίς σύμβαση) → εισαγωγή → έλεγχος κάρτας στο dashboard
 * 4) Δύο γραμμές ίδιο projectTitle → ένα έργο, δύο υποέργα
 * 5) Λάθος enum / λάθος fundingDetails για πηγή → αποτυχία επικύρωσης
 * 6) Κατάσταση με πεδία σύμβασης χωρίς ημερομηνία → σφάλμα
 * 7) Πολλές Συμβάσεις με έγκυρο contractsJson
 * 8) Μορφοποίηση υπό όρους στο «Υποέργα» (γκρι/διαγράμμιση) ευθυγραμμισμένη με κατάσταση/μορφή
 */

const path = require('path');
const fs = require('fs');

const TEMPLATE_VERSION = 3;
const MAX_IMPORT_ROWS = 2000;
const SHEET_DATA = 'Υποέργα';
/** Φύλλο τεχνικών στοιχείων (κρυφό) — παλιά ονόματα αρχείων: «Meta». */
const SHEET_META = 'Τεχνικά';
const SHEET_META_LEGACY = 'Meta';
const SHEET_INSTRUCTIONS = 'Οδηγίες';
/** Κρυφό φύλλο με τις ίδιες λίστες επιλογών όπως στη φόρμα (για αναπτυσσόμενα στο Excel). */
const SHEET_LISTS = 'ΛίστεςΕπιλογών';
const DV_LAST_ROW = 2000;
/** Γραμμή όπου αποθηκεύονται οι πηγές χρηματοδότησης με τη σειρά στηλών FD0… (για INDIRECT). */
const LIST_SOURCE_ANCHOR_ROW = 500;

/** Σειρά εσωτερικών κλειδιών (σταθερή σειρά στηλών δεδομένων). */
const COLUMN_KEYS = [
  'projectTitle',
  'subprojectTitle',
  'implementationForm',
  'kaCode',
  'noKaCode',
  'misPraxhsName',
  'misPraxhsCode',
  'projectType',
  'fundingSource',
  'fundingDetails',
  'approvedAmount',
  'projectBudget',
  'projectStatus',
  'contractProcessStartDate',
  'contractDate',
  'contractAmount',
  'apeAmount',
  'apeComments',
  'contractsJson',
  'eisigitikiEkthesi',
  'comments',
  'remainingAmount',
  'remainingAmountYear',
  'remainingAmountComments',
  'aleCodes',
  'aleRemainingAmounts',
  'hasSupplementaryContracts',
  'supplementaryContractsJson'
];

/**
 * Τίτλοι στηλών όπως στη φόρμα «Νέο υποέργο» (ProjectForm) — εμφανίζονται στη 1η γραμμή του φύλλου «Υποέργα».
 * @type {Record<string, string>}
 */
const COLUMN_HEADER_LABELS = {
  projectTitle: 'Τίτλος Έργου',
  subprojectTitle: 'Τίτλος Υποέργου',
  implementationForm: 'Μορφή Υλοποίησης',
  kaCode: 'Κωδικός ΚΑ (προαιρετικό)',
  noKaCode: 'Δεν υπάρχει ΚΑ (ΝΑΙ/ΟΧΙ)',
  misPraxhsName: 'Όνομα Κωδικού Πράξης',
  misPraxhsCode: 'Κωδικός Πράξης',
  projectType: 'Είδος',
  fundingSource: 'Βασική Πηγή Χρηματοδότησης',
  fundingDetails: 'Εξειδίκευση Πηγής',
  approvedAmount: 'Εγκεκριμένο Ποσό',
  projectBudget: 'Προϋπολογισμός Έργου',
  projectStatus: 'Κατάσταση Έργου',
  contractProcessStartDate: 'Ημερ. Έναρξης Διαδικασίας Σύμβασης',
  contractDate: 'Ημερομηνία Υπογραφής',
  contractAmount: 'Ποσό Σύμβασης',
  apeAmount: 'ΑΠΕ + Συμπληρωματικές',
  apeComments: 'Σχόλια ΑΠΕ',
  contractsJson: 'Συμβάσεις (κείμενο λίστας)',
  eisigitikiEkthesi: 'Εισηγητική Έκθεση',
  comments: 'Σχόλια',
  remainingAmount: 'Υπόλοιπα για το Έτος',
  remainingAmountYear: 'Έτος υπολοίπου',
  remainingAmountComments: 'Σχόλια Υπολοίπων',
  aleCodes: 'Κωδ. Α.Λ.Ε.',
  aleRemainingAmounts: 'Υπόλοιπα ανά Α.Λ.Ε.',
  hasSupplementaryContracts: 'Υπάρχει Συμπληρωματική Σύμβαση (ΝΑΙ/ΟΧΙ)',
  supplementaryContractsJson: 'Συμπληρωματικές (κείμενο λίστας)'
};

let _enums = null;
function loadEnums() {
  if (_enums) return _enums;
  const p = path.join(__dirname, 'subprojectImportEnums.json');
  _enums = JSON.parse(fs.readFileSync(p, 'utf8'));
  return _enums;
}

function normalizeText(text) {
  if (text == null) return '';
  return String(text)
    .replace(/\\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/\u2028/g, ' ')
    .replace(/\u2029/g, ' ')
    .trim();
}

function parseBoolCell(v) {
  if (v === true || v === false) return v;
  const s = String(v == null ? '' : v).trim().toLowerCase();
  if (['ναι', 'yes', 'true', '1', 'y', 'nai', 'ν'].includes(s)) return true;
  if (['οχι', 'όχι', 'oxi', 'no', 'false', '0', 'n', ''].includes(s)) return false;
  return false;
}

function cellToScalar(val) {
  if (val == null || val === '') return '';
  if (val instanceof Date) {
    try {
      return val.toISOString().split('T')[0];
    } catch {
      return String(val);
    }
  }
  if (typeof val === 'object' && val !== null) {
    if (val.richText && Array.isArray(val.richText)) {
      return normalizeText(val.richText.map((r) => r.text).join(''));
    }
    if (val.text != null) return normalizeText(val.text);
    if (val.result != null) return cellToScalar(val.result);
  }
  return normalizeText(String(val));
}

function validateKACode(code) {
  if (!code || !String(code).trim()) return true;
  const pattern = /^\d{2}-\d{4}\.\d{3}$/;
  return pattern.test(String(code).trim());
}

/** Κανονικοποίηση κειμένου κεφαλίδας στήλης για αντιστοίχιση. */
function normalizeHeaderLabel(text) {
  return normalizeText(String(text || ''))
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Χάρτης «κανονικοποιημένη κεφαλίδα» → εσωτερικό κλειδί (ελληνικά + αγγλικά legacy + συνώνυμα οδηγιών). */
function buildLabelToKeyLookup() {
  /** @type {Record<string, string>} */
  const map = {};
  for (const key of COLUMN_KEYS) {
    const label = COLUMN_HEADER_LABELS[key];
    map[normalizeHeaderLabel(label)] = key;
    map[normalizeHeaderLabel(key)] = key;
  }
  const aliases = {
    'κωδικός κα': 'kaCode',
    'χωρίς κα (ναι/οχι)': 'noKaCode',
    'χωρίς κα (ναι/όχι)': 'noKaCode',
    'όνομα mis πράξης': 'misPraxhsName',
    'κωδικός mis πράξης': 'misPraxhsCode',
    'πηγή χρηματοδότησης': 'fundingSource',
    'εξειδίκευση πηγής': 'fundingDetails',
    'εξειδίκευση πηγής χρηματοδότησης': 'fundingDetails',
    'κατάσταση έργου': 'projectStatus',
    'έναρξη διαδικασίας σύμβασης': 'contractProcessStartDate',
    'ημερομηνία σύμβασης': 'contractDate',
    'ποσό σύμβασης': 'contractAmount',
    'ποσό απε': 'apeAmount',
    'σχόλια απε': 'apeComments',
    'πολλές συμβάσεις (κείμενο δομής)': 'contractsJson',
    'παρατηρήσεις': 'comments',
    'υπόλοιπο': 'remainingAmount',
    'κωδ. α.λ.ε.': 'aleCodes',
    'υπόλοιπα α.λ.ε.': 'aleRemainingAmounts',
    'κωδικοί αλε': 'aleCodes',
    'υπόλοιπα αλε': 'aleRemainingAmounts',
    'συμπληρωματικές συμβάσεις (ναι/οχι)': 'hasSupplementaryContracts',
    'συμπληρωματικές συμβάσεις (ναι/όχι)': 'hasSupplementaryContracts',
    'συμπληρωματικές (κείμενο δομής)': 'supplementaryContractsJson'
  };
  for (const [a, key] of Object.entries(aliases)) {
    if (!map[a]) map[a] = key;
  }
  return map;
}

let _labelToKeyCache = null;
function labelToKeyLookup() {
  if (!_labelToKeyCache) _labelToKeyCache = buildLabelToKeyLookup();
  return _labelToKeyCache;
}

function excelColumnLetter(col1Based) {
  let n = col1Based;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function sheetQuoted(sheetName) {
  return `'${String(sheetName).replace(/'/g, "''")}'`;
}

function colLetterForFieldKey(fieldKey) {
  const ix = COLUMN_KEYS.indexOf(fieldKey);
  if (ix < 0) throw new Error(`Unknown field key: ${fieldKey}`);
  return excelColumnLetter(ix + 1);
}

/** Έτη όπως στο ProjectForm (Array.from 10 ετών από 2026). */
function remainingYearChoices() {
  return Array.from({ length: 10 }, (_, i) => String(2026 + i));
}

/**
 * Κρυφό φύλλο λιστών + ονομασμένα εύρη FD0… για εξαρτώμενη λίστα εξειδίκευσης πηγής.
 */
function addHiddenListsWorksheet(wb) {
  const enums = loadEnums();
  const ws = wb.addWorksheet(SHEET_LISTS, { state: 'veryHidden' });

  const writeCol = (col1Based, startRow, values) => {
    values.forEach((v, i) => {
      ws.getCell(startRow + i, col1Based).value = v;
    });
  };

  writeCol(1, 2, enums.IMPLEMENTATION_FORMS);
  writeCol(2, 2, enums.PROJECT_TYPES);
  writeCol(3, 2, enums.FUNDING_SOURCES);
  writeCol(4, 2, enums.PROJECT_STATUSES);
  writeCol(5, 2, ['ΝΑΙ', 'ΟΧΙ']);
  writeCol(6, 2, remainingYearChoices());

  const sources = enums.FUNDING_SOURCES;
  const fd = enums.FUNDING_DETAILS || {};
  const baseCol = 7;
  sources.forEach((src, i) => {
    const details = fd[src] || [];
    const col = baseCol + i;
    writeCol(col, 2, details);
    const letter = excelColumnLetter(col);
    const endRow = Math.max(2 + details.length - 1, 2);
    wb.definedNames.add(`${sheetQuoted(SHEET_LISTS)}!$${letter}$2:$${letter}$${endRow}`, `FD${i}`);
    ws.getCell(LIST_SOURCE_ANCHOR_ROW + i, 1).value = src;
  });

  /** Κενό κελί για IFERROR στην επικύρωση εξειδίκευσης πηγής (κενή λίστα). */
  ws.getCell(999, 27).value = null;
}

function addDataSheetDropdownValidations(wb, ws) {
  const enums = loadEnums();
  const ql = sheetQuoted(SHEET_LISTS);
  const dvCommon = {
    type: 'list',
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Λίστα επιλογών',
    error: 'Επιλέξτε μία από τις τιμές της αναπτυσσόμενης λίστας (ίδιες επιλογές με τη φόρμα «Νέο υποέργο» στην εφαρμογή).'
  };

  const addCol = (fieldKey, formula, allowBlank) => {
    const letter = colLetterForFieldKey(fieldKey);
    ws.dataValidations.add(`${letter}2:${letter}${DV_LAST_ROW}`, {
      ...dvCommon,
      allowBlank: Boolean(allowBlank),
      formulae: [formula]
    });
  };

  const rangeCol = (colLetter, start, len) => {
    const end = start + len - 1;
    return `=${ql}!$${colLetter}$${start}:$${colLetter}$${end}`;
  };

  addCol('implementationForm', rangeCol('A', 2, enums.IMPLEMENTATION_FORMS.length), false);
  addCol('projectType', rangeCol('B', 2, enums.PROJECT_TYPES.length), false);
  addCol('fundingSource', rangeCol('C', 2, enums.FUNDING_SOURCES.length), false);

  const nSrc = enums.FUNDING_SOURCES.length;
  const aEnd = LIST_SOURCE_ANCHOR_ROW + nSrc - 1;
  const fdFormula = `=IFERROR(INDIRECT("FD"&(MATCH(I2,${ql}!$A$${LIST_SOURCE_ANCHOR_ROW}:$A$${aEnd},0)-1)),${ql}!$AA$999:$AA$999)`;
  addCol('fundingDetails', fdFormula, true);

  addCol('projectStatus', rangeCol('D', 2, enums.PROJECT_STATUSES.length), false);

  addCol('noKaCode', rangeCol('E', 2, 2), true);
  addCol('hasSupplementaryContracts', rangeCol('E', 2, 2), true);

  addCol('remainingAmountYear', rangeCol('F', 2, remainingYearChoices().length), true);
}

/** Διπλό εισαγωγικό μέσα σε literal συνάρτησης Excel. */
function escapeExcelFormulaLiteral(text) {
  return String(text || '').replace(/"/g, '""');
}

/**
 * Μορφοποίηση υπό όρους στο φύλλο «Υποέργα»: γκρι φόντο + διαγράμμιση όταν το κελί
 * συνήθως δεν χρειάζεται με βάση κατάσταση / μορφή / άλλες στήλες (ίδια λογική με τη φόρμα).
 * Δεν εμποδίζει πληκτρολόγηση· η επικύρωση στην εφαρμογή παραμένει η τελική αλήθεια.
 */
function addDataSheetDependentFormatting(ws) {
  const enums = loadEnums();
  const DATA_LAST_ROW = 2000;
  const dimStyle = {
    font: { strike: true, italic: true, color: { argb: 'FF94A3B8' }, size: 10 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
  };

  const pushCf = (colLetter, formula) => {
    ws.addConditionalFormatting({
      ref: `${colLetter}2:${colLetter}${DATA_LAST_ROW}`,
      rules: [{ type: 'expression', formulae: [formula], style: dimStyle }]
    });
  };

  const PS = enums.PROJECT_STATUSES;
  const statusFrom = 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ';
  const cut = PS.indexOf(statusFrom);
  const earlyStatuses = cut > 0 ? PS.slice(0, cut) : [];
  const earlyOr =
    earlyStatuses.length > 0
      ? earlyStatuses.map((s) => `$M2="${escapeExcelFormulaLiteral(s)}"`).join(',')
      : 'FALSE';
  pushCf('N', `OR($M2="",${earlyOr})`);

  const contractStatuses = enums.STATUSES_WITH_CONTRACT_FIELDS || [];
  const inContract =
    contractStatuses.length > 0
      ? contractStatuses.map((s) => `$M2="${escapeExcelFormulaLiteral(s)}"`).join(',')
      : 'FALSE';
  const notContract =
    contractStatuses.length > 0 ? `NOT(OR(${inContract}))` : 'TRUE';
  const singleDim = `OR(${notContract},$C2="",$C2="Πολλές Συμβάσεις")`;
  ['O', 'P', 'Q', 'R'].forEach((col) => pushCf(col, singleDim));

  const multiDim = `OR(${notContract},$C2="",$C2="Μια Σύμβαση")`;
  pushCf('S', multiDim);

  pushCf(
    'D',
    'OR($E2="ΝΑΙ",$E2="ναι",$E2="Ν",$E2="Yes",$E2="yes",$E2="YES",$E2=TRUE)'
  );

  pushCf('J', 'OR($I2="",$I2=" ")');

  pushCf('AB', notContract);

  const abYes =
    'OR($AB2="ΝΑΙ",$AB2="ναι",$AB2="Ν",$AB2="Yes",$AB2="yes",$AB2="YES",$AB2=TRUE)';
  pushCf('AC', `OR(${notContract},NOT(${abYes}))`);
}

function getTechSheet(wb) {
  return wb.getWorksheet(SHEET_META) || wb.getWorksheet(SHEET_META_LEGACY);
}

function readMetaVersion(worksheet) {
  if (!worksheet) return null;
  let version = null;
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const k = normalizeHeaderLabel(cellToScalar(row.getCell(1).value));
    const v = cellToScalar(row.getCell(2).value);
    if (k === 'templateversion' || k === 'έκδοση προτύπου') {
      const n = Number(v);
      if (!Number.isNaN(n)) version = n;
    }
  });
  return version;
}

/**
 * @param {string[]} headers 1-based sparse: headers[colIndex] = raw header text
 * @returns {{ headerToCol: Record<string, number>, missingKeys: string[] }}
 */
function resolveHeaderRowToColumns(headers) {
  const lookup = labelToKeyLookup();
  const maxCol = Math.max(COLUMN_KEYS.length, headers.filter(Boolean).length);
  const headerToCol = {};
  for (let c = 1; c <= maxCol; c++) {
    const raw = headers[c] ? String(headers[c]).trim() : '';
    if (!raw) continue;
    const key = lookup[normalizeHeaderLabel(raw)];
    if (key && headerToCol[key] == null) headerToCol[key] = c;
  }
  const missingKeys = COLUMN_KEYS.filter((k) => headerToCol[k] == null);
  return { headerToCol, missingKeys };
}

function rowObjectToProjectData(raw) {
  const enums = loadEnums();
  const noKaCode = parseBoolCell(raw.noKaCode);
  let kaCode = normalizeText(raw.kaCode);
  if (noKaCode) kaCode = 'ΔΕΝ ΥΠΑΡΧΕΙ';

  const aleCodesStr = normalizeText(raw.aleCodes);
  const aleCodes = aleCodesStr
    ? aleCodesStr.split('|').map((s) => normalizeText(s)).filter(Boolean)
    : [];
  const aleRemStr = normalizeText(raw.aleRemainingAmounts);
  let aleRemainingAmounts = aleRemStr
    ? aleRemStr.split('|').map((s) => normalizeText(s))
    : [];
  while (aleRemainingAmounts.length < aleCodes.length) aleRemainingAmounts.push('');
  aleRemainingAmounts = aleRemainingAmounts.slice(0, aleCodes.length);

  let contracts = [];
  const impl = normalizeText(raw.implementationForm);
  const cj = normalizeText(raw.contractsJson);
  if (impl === 'Πολλές Συμβάσεις' && cj) {
    try {
      const parsed = JSON.parse(cj);
      if (Array.isArray(parsed)) contracts = parsed;
    } catch {
      contracts = [];
    }
  }

  let supplementaryContracts = [];
  const sj = normalizeText(raw.supplementaryContractsJson);
  if (sj) {
    try {
      const parsed = JSON.parse(sj);
      if (Array.isArray(parsed)) supplementaryContracts = parsed;
    } catch {
      supplementaryContracts = [];
    }
  }

  const yearDefault = String(new Date().getFullYear());
  const remainingAmountYear = normalizeText(raw.remainingAmountYear) || yearDefault;

  return {
    projectTitle: normalizeText(raw.projectTitle),
    subprojectTitle: normalizeText(raw.subprojectTitle),
    implementationForm: impl,
    kaCode,
    noKaCode,
    eisigitikiEkthesi: normalizeText(raw.eisigitikiEkthesi),
    aleCodes,
    misPraxhsName: normalizeText(raw.misPraxhsName),
    misPraxhsCode: normalizeText(raw.misPraxhsCode),
    projectType: normalizeText(raw.projectType),
    fundingSource: normalizeText(raw.fundingSource),
    fundingDetails: normalizeText(raw.fundingDetails),
    approvedAmount: normalizeText(raw.approvedAmount),
    projectBudget: normalizeText(raw.projectBudget),
    projectStatus: normalizeText(raw.projectStatus),
    contractProcessStartDate: normalizeText(raw.contractProcessStartDate),
    contractDate: normalizeText(raw.contractDate),
    contractAmount: normalizeText(raw.contractAmount),
    apeAmount: normalizeText(raw.apeAmount),
    apeComments: normalizeText(raw.apeComments),
    comments: normalizeText(raw.comments),
    remainingAmount: normalizeText(raw.remainingAmount),
    remainingAmountYear,
    remainingAmountComments: normalizeText(raw.remainingAmountComments),
    aleRemainingAmounts,
    contracts,
    hasSupplementaryContracts: parseBoolCell(raw.hasSupplementaryContracts),
    supplementaryContracts,
    egkriseisDialthesisPistosis: [],
    files: [],
    fileGroups: []
  };
}

/**
 * Επιστρέφει { errors: Record<string,string> } ίδια λογική με ProjectForm.validateForm (συγχρονισμός χειροκίνητος).
 */
function validateProjectDataForImport(formData) {
  const newErrors = {};
  const enums = loadEnums();
  const { PROJECT_STATUSES, STATUSES_WITH_CONTRACT_FIELDS, FUNDING_DETAILS } = enums;

  if (!formData.projectTitle.trim()) {
    newErrors.projectTitle = 'Απαιτείται τίτλος έργου';
  }
  if (!formData.subprojectTitle.trim()) {
    newErrors.subprojectTitle = 'Απαιτείται τίτλος υποέργου';
  }
  if (!formData.implementationForm) {
    newErrors.implementationForm = 'Επιλέξτε μορφή υλοποίησης';
  } else if (!enums.IMPLEMENTATION_FORMS.includes(formData.implementationForm)) {
    newErrors.implementationForm = `Μη έγκυρη τιμή. Επιτρέπονται: ${enums.IMPLEMENTATION_FORMS.join(' | ')}`;
  }

  if (
    !formData.noKaCode &&
    formData.kaCode &&
    formData.kaCode.trim().length > 0 &&
    !validateKACode(formData.kaCode)
  ) {
    newErrors.kaCode = 'Ο κωδικός ΚΑ πρέπει να έχει μορφή xx-xxxx.xxx';
  }

  const hasMisPraxhsName = formData.misPraxhsName && formData.misPraxhsName.trim();
  const hasMisPraxhsCode = formData.misPraxhsCode && formData.misPraxhsCode.trim();
  if (hasMisPraxhsName && !hasMisPraxhsCode) {
    newErrors.misPraxhsCode = 'Παρακαλώ συμπληρώστε και τον κωδικό';
  }
  if (hasMisPraxhsCode && !hasMisPraxhsName) {
    newErrors.misPraxhsName = 'Παρακαλώ συμπληρώστε και το όνομα του κωδικού';
  }

  if (!formData.projectType) {
    newErrors.projectType = 'Επιλέξτε είδος';
  } else if (!enums.PROJECT_TYPES.includes(formData.projectType)) {
    newErrors.projectType = `Μη έγκυρη τιμή. Επιτρέπονται: ${enums.PROJECT_TYPES.join(' | ')}`;
  }

  if (!formData.fundingSource) {
    newErrors.fundingSource = 'Επιλέξτε πηγή χρηματοδότησης';
  } else if (!enums.FUNDING_SOURCES.includes(formData.fundingSource)) {
    newErrors.fundingSource = 'Μη έγκυρη πηγή χρηματοδότησης';
  }

  if (!formData.fundingDetails) {
    newErrors.fundingDetails = 'Επιλέξτε εξειδίκευση πηγής χρηματοδότησης';
  } else if (formData.fundingSource && FUNDING_DETAILS[formData.fundingSource]) {
    const allowed = FUNDING_DETAILS[formData.fundingSource];
    if (!allowed.includes(formData.fundingDetails)) {
      newErrors.fundingDetails = 'Η εξειδίκευση δεν αντιστοιχεί στην επιλεγμένη πηγή χρηματοδότησης';
    }
  }

  if (!formData.approvedAmount) {
    newErrors.approvedAmount = 'Απαιτείται εγκεκριμένο ποσό';
  }
  if (!formData.projectBudget) {
    newErrors.projectBudget = 'Απαιτείται προϋπολογισμός έργου';
  }

  if (!formData.projectStatus) {
    newErrors.projectStatus = 'Επιλέξτε κατάσταση έργου';
  } else if (!enums.PROJECT_STATUSES.includes(formData.projectStatus)) {
    newErrors.projectStatus = 'Μη έγκυρη κατάσταση έργου';
  }

  if (formData.projectStatus && PROJECT_STATUSES.indexOf(formData.projectStatus) >= PROJECT_STATUSES.indexOf('ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ')) {
    if (formData.contractProcessStartDate) {
      const processStartDate = new Date(formData.contractProcessStartDate);
      if (formData.implementationForm === 'Μια Σύμβαση' && formData.contractDate) {
        const contractDate = new Date(formData.contractDate);
        if (!isNaN(processStartDate) && !isNaN(contractDate) && processStartDate >= contractDate) {
          newErrors.contractProcessStartDate = 'Η ημερομηνία έναρξης διαδικασίας πρέπει να είναι προγενέστερη της ημερομηνίας σύμβασης';
        }
      }
      if (formData.implementationForm === 'Πολλές Συμβάσεις' && formData.contracts && formData.contracts.length > 0) {
        const invalidContracts = formData.contracts.filter((contract) => {
          if (contract.date) {
            const contractDate = new Date(contract.date);
            return !isNaN(processStartDate) && !isNaN(contractDate) && processStartDate >= contractDate;
          }
          return false;
        });
        if (invalidContracts.length > 0) {
          newErrors.contractProcessStartDate = 'Η ημερομηνία έναρξης διαδικασίας πρέπει να είναι προγενέστερη όλων των ημερομηνιών σύμβασης';
        }
      }
    }
  }

  if (STATUSES_WITH_CONTRACT_FIELDS.includes(formData.projectStatus)) {
    if (formData.implementationForm === 'Μια Σύμβαση') {
      if (!formData.contractDate) {
        newErrors.contractDate = 'Απαιτείται ημερομηνία υπογραφής σύμβασης';
      }
      if (!formData.contractAmount) {
        newErrors.contractAmount = 'Απαιτείται ποσό σύμβασης';
      }
      if (!formData.apeAmount) {
        newErrors.apeAmount = 'Απαιτείται ποσό ΑΠΕ + Συμπληρωματικές συμβάσεις';
      }
    } else if (formData.implementationForm === 'Πολλές Συμβάσεις') {
      if (!formData.contracts || formData.contracts.length === 0) {
        newErrors.contractsJson =
          `Για «Πολλές Συμβάσεις» απαιτείται έγκυρο κείμενο λίστας στη στήλη «${COLUMN_HEADER_LABELS.contractsJson}».`;
      } else {
        formData.contracts.forEach((contract, index) => {
          if (!contract.date) {
            newErrors[`contractDate${index}`] = 'Απαιτείται ημερομηνία';
          }
          if (!contract.amount) {
            newErrors[`contractAmount${index}`] = 'Απαιτείται ποσό';
          }
          if (!contract.apeAmount) {
            newErrors[`apeAmount${index}`] = 'Απαιτείται ποσό ΑΠΕ';
          }
        });
      }
    }
  }

  return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
}

function flattenErrors(errorsObj) {
  return Object.entries(errorsObj).map(([field, message]) => ({ field, message }));
}

async function buildTemplateWorkbook(ExcelJS) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ErgoHub';
  wb.created = new Date();

  const BORDER_THIN = { style: 'thin', color: { argb: 'FFCBD5E1' } };
  const borderAll = { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN };
  const FILL_TITLE = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF134E4A' } };
  const FILL_SECTION = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14B8A6' } };
  const FILL_HEADER_DATA = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  const FILL_ZEBRA = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

  const INSTRUCTION_ROWS = [
    ['projectTitle', 'Υποχρεωτικό. Ίδιος τίτλος σε πολλές γραμμές σημαίνει το ίδιο έργο με πολλά υποέργα.'],
    ['subprojectTitle', 'Υποχρεωτικό.'],
    [
      'implementationForm',
      'Υποχρεωτικό. Επιλέξτε από το αναπτυσσόμενο στη στήλη (ίδιες επιλογές με τη φόρμα).'
    ],
    [
      'kaCode',
      'Προαιρετικό αν έχετε επιλέξει «Δεν υπάρχει ΚΑ». Μορφή 12-3456.789. Αν δεν υπάρχει ΚΑ, αφήστε κενό ή γράψτε ΔΕΝ ΥΠΑΡΧΕΙ.'
    ],
    ['noKaCode', 'ΝΑΙ ή ΟΧΙ (αναπτυσσόμενο). Αν ΝΑΙ, το ΚΑ θεωρείται «ΔΕΝ ΥΠΑΡΧΕΙ».'],
    ['misPraxhsName', 'Προαιρετικό· αν συμπληρωθεί ο κωδικός πράξης, συμπληρώστε και το όνομα και το αντίστροφο.'],
    ['misPraxhsCode', 'Προαιρετικό· συμπληρώνεται μαζί με το όνομα πράξης.'],
    ['projectType', 'Μία από τις επιλογές του αναπτυσσόμενου στη στήλη (ίδιες με τη φόρμα).'],
    ['fundingSource', 'Επιλέξτε από το αναπτυσσόμενο· μετά ενημερώνεται η λίστα εξειδίκευσης πηγής.'],
    [
      'fundingDetails',
      'Επιλέξτε από το αναπτυσσόμενο μετά την «Βασική Πηγή Χρηματοδότησης»· οι επιλογές εξαρτώνται από την πηγή της ίδιας γραμμής.'
    ],
    ['approvedAmount', 'Υποχρεωτικό. Ποσό σε ευρωπαϊκή μορφή (π.χ. 1.234,56).'],
    ['projectBudget', 'Υποχρεωτικό.'],
    ['projectStatus', 'Μία από τις επιλογές του αναπτυσσόμενου στη στήλη (ίδιες με τη φόρμα).'],
    [
      'contractProcessStartDate',
      'Προαιρετικό. Ημερομηνία ως έτος-μήνας-ημέρα (π.χ. 2024-06-01). Αν συμπληρωθεί, πρέπει να προηγείται της ημερομηνίας ή των ημερομηνιών σύμβασης όταν η κατάσταση απαιτεί έλεγχο σύμβασης.'
    ],
    ['contractDate', 'Για «Μια Σύμβαση»: όταν η κατάσταση απαιτεί στοιχεία σύμβασης.'],
    ['contractAmount', 'Για «Μια Σύμβαση»: όταν απαιτείται.'],
    ['apeAmount', 'Για «Μια Σύμβαση»: όταν απαιτείται.'],
    ['apeComments', 'Προαιρετικό κείμενο.'],
    [
      'contractsJson',
      'Μόνο για «Πολλές Συμβάσεις»: κείμενο λίστας με αγκύλες όπου κάθε σύμβαση έχει ημερομηνία, ποσό σύμβασης και ποσό «ΑΠΕ + Συμπληρωματικές». Ζητήστε παράδειγμα από τον διαχειριστή αν δεν το έχετε ξαναχρησιμοποιήσει.'
    ],
    ['eisigitikiEkthesi', 'Προαιρετικό.'],
    ['comments', 'Προαιρετικό.'],
    ['remainingAmount', 'Προαιρετικό.'],
    ['remainingAmountYear', 'Έτος από το αναπτυσσόμενο (2026–2035, όπως στη φόρμα).'],
    ['remainingAmountComments', 'Προαιρετικό.'],
    ['aleCodes', 'Προαιρετικό. Πολλοί κωδικοί χωρισμένοι με κάθετο (|).'],
    ['aleRemainingAmounts', 'Προαιρετικό. Ένα ποσό ανά κωδικό, ίδιος αριθμός τμημάτων με τους κωδικούς, διαχωρισμός με κάθετο (|).'],
    ['hasSupplementaryContracts', 'ΝΑΙ ή ΟΧΙ (αναπτυσσόμενο).'],
    ['supplementaryContractsJson', 'Προαιρετικό· μόνο αν χρειάζεται, σε μορφή λίστας όπως στη φόρμα έργου.']
  ];

  const wsInst = wb.addWorksheet(SHEET_INSTRUCTIONS);
  wsInst.columns = [{ width: 36 }, { width: 92 }];

  wsInst.mergeCells('A1:B1');
  const titleCell = wsInst.getCell('A1');
  titleCell.value = 'ErgoHub — Οδηγίες συμπλήρωσης';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = FILL_TITLE;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  wsInst.getRow(1).height = 38;

  const introTexts = [
    'Συμπληρώνετε μόνο τις γραμμές από τη 2η και κάτω στο φύλλο «Υποέργα». Στην 1η γραμμή παραμένουν οι τίτλοι στηλών όπως στη φόρμα «Νέο υποέργο» — μην αλλάζετε κείμενο, σειρά ή αριθμό στηλών. Όπου υπάρχει λίστα στη φόρμα, η αντίστοιχη στήλη στο Excel έχει αναπτυσσόμενο με τις ίδιες επιλογές.',
    'Κάθε γραμμή στο «Υποέργα» είναι ένα υποέργο. Ίδιος τίτλος έργου σε πολλές γραμμές σημαίνει το ίδιο έργο με περισσότερα υποέργα.',
    'Κελιά με ανοιχτό γκρι φόντο και διαγράμμιση υποδηλώνουν ότι συνήθως δεν χρειάζονται με βάση την κατάσταση, τη μορφή υλοποίησης ή άλλες επιλογές της ίδιας γραμμής. Μπορείτε να τα αφήσετε κενά· η εφαρμογή εξακολουθεί να ελέγχει πριν την εισαγωγή.'
  ];
  introTexts.forEach((text, i) => {
    const rn = i + 2;
    wsInst.mergeCells(`A${rn}:B${rn}`);
    const c = wsInst.getCell(`A${rn}`);
    c.value = text;
    c.alignment = { wrapText: true, vertical: 'top' };
    c.font = { size: 11, color: { argb: 'FF334155' } };
    c.fill = i % 2 === 0 ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } : undefined;
    c.border = borderAll;
    wsInst.getRow(rn).height = 46;
  });

  wsInst.getRow(5).height = 10;

  const hdrRow = 6;
  wsInst.getCell(`A${hdrRow}`).value = 'Πεδίο (όπως στη φόρμα)';
  wsInst.getCell(`B${hdrRow}`).value = 'Οδηγίες';
  [wsInst.getCell(`A${hdrRow}`), wsInst.getCell(`B${hdrRow}`)].forEach((cell) => {
    cell.fill = FILL_SECTION;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = borderAll;
  });
  wsInst.getRow(hdrRow).height = 28;
  wsInst.views = [{ state: 'frozen', ySplit: hdrRow, topLeftCell: `A${hdrRow + 1}`, activeCell: `A${hdrRow + 1}` }];

  INSTRUCTION_ROWS.forEach(([key, help], idx) => {
    const r = wsInst.addRow([COLUMN_HEADER_LABELS[key], help]);
    r.height = 28;
    r.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = borderAll;
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.font = { size: 10, color: { argb: 'FF1E293B' } };
      if (idx % 2 === 1 && colNumber <= 2) cell.fill = FILL_ZEBRA;
    });
  });

  addHiddenListsWorksheet(wb);

  const headerLabels = COLUMN_KEYS.map((k) => COLUMN_HEADER_LABELS[k]);
  const ws = wb.addWorksheet(SHEET_DATA);
  const headerRow = ws.addRow(headerLabels);
  headerRow.height = 30;
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = FILL_HEADER_DATA;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = borderAll;
  });
  COLUMN_KEYS.forEach((_, i) => {
    const label = headerLabels[i];
    ws.getColumn(i + 1).width = Math.min(44, Math.max(16, String(label).length + 3));
  });
  const lastCol = excelColumnLetter(COLUMN_KEYS.length);
  ws.autoFilter = { from: 'A1', to: `${lastCol}1` };
  ws.views = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2', activeCell: 'A2' }];

  addDataSheetDropdownValidations(wb, ws);
  addDataSheetDependentFormatting(ws);

  const wsTech = wb.addWorksheet(SHEET_META, { state: 'veryHidden' });
  wsTech.columns = [{ width: 34 }, { width: 22 }];
  wsTech.getCell('A1').value = 'Έκδοση προτύπου';
  wsTech.getCell('B1').value = TEMPLATE_VERSION;
  wsTech.getCell('A2').value = 'Όνομα φύλλου δεδομένων';
  wsTech.getCell('B2').value = SHEET_DATA;
  [1, 2].forEach((rn) => {
    wsTech.getRow(rn).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = borderAll;
      cell.font = { size: 10, color: { argb: 'FF0F172A' } };
      if (rn === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.font = { bold: true, size: 10 };
      }
    });
  });

  return wb;
}

/**
 * @param {Buffer} buffer
 * @returns {{ versionOk: boolean, metaVersion: number|null, rows: Array<{ excelRow: number, raw: object }>, parseErrors: Array<{ excelRow: number, message: string }> }}
 */
async function parseImportWorkbookBuffer(buffer) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const metaSheet = getTechSheet(wb);
  let metaVersion = metaSheet ? readMetaVersion(metaSheet) : null;

  const ws = wb.getWorksheet(SHEET_DATA);
  if (!ws) {
    return {
      versionOk: false,
      metaVersion,
      rows: [],
      parseErrors: [{ excelRow: 0, message: `Δεν βρέθηκε το φύλλο «${SHEET_DATA}»` }]
    };
  }

  const headerRow = ws.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = cellToScalar(cell.value);
  });

  const { headerToCol, missingKeys } = resolveHeaderRowToColumns(headers);

  let versionOk =
    metaVersion === TEMPLATE_VERSION ||
    metaVersion === 1 ||
    (metaVersion == null && missingKeys.length === 0);

  const parseErrors = [];
  if (missingKeys.length > 0) {
    parseErrors.push({
      excelRow: 1,
      message:
        'Λείπουν ή δεν αναγνωρίζονται στήλες στην πρώτη γραμμή του φύλλου «Υποέργα». Χρησιμοποιήστε το τρέχον πρότυπο χωρίς αλλαγή τίτλων στηλών.'
    });
  }
  if (!versionOk) {
    parseErrors.push({
      excelRow: 0,
      message: `Το αρχείο δεν ταιριάζει με την αναμενόμενη έκδοση προτύπου (${TEMPLATE_VERSION}). Κάντε λήψη νέου προτύπου από την εφαρμογή.`
    });
  }

  const rows = [];
  let lastRow = ws.rowCount;
  for (let r = 2; r <= lastRow; r++) {
    const row = ws.getRow(r);
    let any = false;
    const raw = {};
    for (const key of COLUMN_KEYS) {
      const col = headerToCol[key];
      let val = '';
      if (col != null) {
        const cell = row.getCell(col);
        val = cell.value;
        if (val != null && val !== '') any = true;
      }
      raw[key] = cellToScalar(val);
    }
    if (!any) continue;
    if (rows.length >= MAX_IMPORT_ROWS) {
      parseErrors.push({ excelRow: r, message: `Μέγιστο ${MAX_IMPORT_ROWS} μη κενές γραμμές ανά αρχείο` });
      break;
    }
    rows.push({ excelRow: r, raw });
  }

  return { versionOk, metaVersion, rows, parseErrors };
}

function validateAllRows(parsedRows) {
  /** @type {{ excelRow: number, field?: string, message: string }[]} */
  const errors = [];
  /** @type {{ excelRow: number, projectData: object }[]} */
  const ok = [];

  for (const { excelRow, raw } of parsedRows) {
    const projectData = rowObjectToProjectData(raw);
    const { isValid, errors: e } = validateProjectDataForImport(projectData);
    if (!isValid) {
      for (const [field, message] of Object.entries(e)) {
        errors.push({ excelRow, field, message });
      }
    } else {
      ok.push({ excelRow, projectData });
    }
  }
  return { ok, errors };
}

function duplicateWarnings(importOkList, existingProjects) {
  const warnings = [];
  const set = new Set();
  for (const p of existingProjects || []) {
    const k = `${normalizeText(p.projectTitle)}||${normalizeText(p.subprojectTitle)}`.toLowerCase();
    set.add(k);
  }
  for (const { excelRow, projectData } of importOkList) {
    const k = `${projectData.projectTitle}||${projectData.subprojectTitle}`.toLowerCase();
    if (set.has(k)) {
      warnings.push({
        excelRow,
        message: 'Υπάρχει ήδη υποέργο με τον ίδιο τίτλο έργου και τίτλο υποέργου (προειδοποίηση, η εισαγωγή επιτρέπεται).'
      });
    }
  }
  return warnings;
}

module.exports = {
  TEMPLATE_VERSION,
  MAX_IMPORT_ROWS,
  SHEET_DATA,
  SHEET_META,
  COLUMN_KEYS,
  COLUMN_HEADER_LABELS,
  loadEnums,
  buildTemplateWorkbook,
  parseImportWorkbookBuffer,
  rowObjectToProjectData,
  validateProjectDataForImport,
  validateAllRows,
  duplicateWarnings,
  normalizeText
};

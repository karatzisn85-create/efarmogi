/**
 * epProgramService.js
 * Υπηρεσία διαχείρισης Επιχειρησιακού Προγράμματος.
 * Παρέχει parse xlsx, αποθήκευση/φόρτωση/αρχειοθέτηση προγραμμάτων.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const { safeWriteJSON } = require('./safeWrite');
const epProgramCatalog = require('../app/core/epProgramCatalog');

const EP_FOLDER = 'ΕΠΙΧΕΙΡΗΣΙΑΚΟ_ΠΡΟΓΡΑΜΜΑ';

function getEpDir(dataDir) {
  return path.join(dataDir, EP_FOLDER);
}

function ensureEpDir(dataDir) {
  const dir = getEpDir(dataDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function findProgramFilePath(dataDir, programId) {
  const dir = getEpDir(dataDir);
  if (!fs.existsSync(dir) || !programId) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (data.id === programId) return path.join(dir, file);
    } catch (e) { /* αγνόησε κατεστραμμένα */ }
  }
  return null;
}

function resolveProgramSavePath(dataDir, program) {
  const existing = findProgramFilePath(dataDir, program && program.id);
  if (existing) return existing;
  const sy = program && program.startYear;
  const ey = program && program.endYear;
  const id = (program && program.id) || uuidv4();
  return path.join(getEpDir(dataDir), `${sy}_${ey}_${id}.json`);
}

function loadAllProgramsFull(dataDir) {
  const dir = getEpDir(dataDir);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const programs = [];
  for (const file of files) {
    try {
      programs.push(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
    } catch (e) { /* αγνόησε κατεστραμμένα */ }
  }
  return programs.sort((a, b) => (b.startYear || 0) - (a.startYear || 0));
}

/** Επιστρέφει λίστα όλων των προγραμμάτων (σύνοψη χωρίς actions). */
function loadAllPrograms(dataDir) {
  const dir = getEpDir(dataDir);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const programs = [];

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      programs.push({
        id: data.id,
        title: data.title,
        startYear: data.startYear,
        endYear: data.endYear,
        isActive: data.isActive,
        budgetYears: data.budgetYears || [],
        axesCount: (data.axes || []).length,
        measuresCount: (data.measures || []).length,
        objectivesCount: (data.objectives || []).length,
        actionCount: (data.actions || []).length,
        importedAt: data.importedAt,
        importedBy: data.importedBy
      });
    } catch (e) {
      // Αγνόησε κατεστραμμένα αρχεία
    }
  }

  return programs.sort((a, b) => b.startYear - a.startYear);
}

/** Επιστρέφει το ενεργό πρόγραμμα με όλα τα δεδομένα. */
function getActiveProgram(dataDir) {
  const dir = getEpDir(dataDir);
  if (!fs.existsSync(dir)) return null;

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (data.isActive) return data;
    } catch (e) {}
  }
  return null;
}

/** Επιστρέφει ένα συγκεκριμένο πρόγραμμα βάσει id. */
function getProgramById(dataDir, programId) {
  const dir = getEpDir(dataDir);
  if (!fs.existsSync(dir)) return null;

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (data.id === programId) return data;
    } catch (e) {}
  }
  return null;
}

/** Αρχειοθετεί όλα τα ενεργά προγράμματα (isActive → false). */
function archiveAllPrograms(dataDir) {
  const dir = getEpDir(dataDir);
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (data.isActive) {
        data.isActive = false;
        safeWriteJSON(filePath, data);
      }
    } catch (e) {}
  }
}

/**
 * Κάνει parse το Excel αρχείο ΕΠ και επιστρέφει τα δεδομένα.
 * Αναμένει φύλλο "ΕΠ_ΔΡΑΣΕΙΣ" με 2-γραμμή header (rows[0] + rows[1]).
 * Δεδομένα ξεκινούν από rows[2].
 */
function parseEpExcel(filePath) {
  let workbook;
  try {
    workbook = XLSX.readFile(filePath, { raw: false, defval: null });
  } catch (e) {
    throw new Error(`Αδυναμία ανάγνωσης αρχείου Excel: ${e.message}`);
  }

  const sheetName = workbook.SheetNames.find(n =>
    n.replace(/\s/g, '').toUpperCase().includes('ΕΠ_ΔΡΑΣΕΙΣ') ||
    n.replace(/\s/g, '').toUpperCase().includes('ΕΠΔΡΑΣΕΙΣ')
  );
  if (!sheetName) {
    throw new Error(
      `Δεν βρέθηκε φύλλο "ΕΠ_ΔΡΑΣΕΙΣ" στο Excel. Διαθέσιμα φύλλα: ${workbook.SheetNames.join(', ')}`
    );
  }

  const ws = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });

  if (rows.length < 3) {
    throw new Error('Το φύλλο δεδομένων είναι κενό ή δεν έχει τη σωστή δομή (< 3 γραμμές)');
  }

  const headerRow1 = rows[0] || [];
  const headerRow2 = rows[1] || [];

  // Εύρεση στηλών προϋπολογισμού από τη 2η γραμμή header (Κ+ = index 10+)
  const budgetYears = [];
  const budgetColMap = {}; // year -> column index

  for (let ci = 9; ci < headerRow2.length; ci++) {
    const val = headerRow2[ci];
    if (val && /^\d{4}$/.test(String(val).trim())) {
      const year = parseInt(String(val).trim(), 10);
      if (!budgetColMap[year]) {
        budgetYears.push(year);
        budgetColMap[year] = ci;
      }
    }
  }
  budgetYears.sort((a, b) => a - b);

  // Εύρεση στήλης ΣΥΝΟΛΟ (μετά τα έτη)
  let totalCol = -1;
  for (let ci = 9; ci < headerRow2.length; ci++) {
    const val = headerRow2[ci];
    if (val && String(val).trim().toUpperCase().includes('ΣΥΝΟΛΟ')) {
      totalCol = ci;
      break;
    }
  }
  // Fallback: αμέσως μετά την τελευταία στήλη ετών
  if (totalCol === -1 && budgetYears.length > 0) {
    const lastYearCol = Math.max(...Object.values(budgetColMap));
    totalCol = lastYearCol + 1;
  }

  // Εύρεση στηλών ΠΗΓΗ ΧΡΗΜΑΤΟΔΟΤΗΣΗΣ από την 1η γραμμή header
  const fundingCols = [];
  for (let ci = 0; ci < headerRow1.length; ci++) {
    const val = headerRow1[ci];
    if (val && String(val).toUpperCase().includes('ΠΗΓΗ')) {
      fundingCols.push(ci);
    }
  }
  if (fundingCols.length === 0) {
    // Fallback στις default θέσεις Q, R, S
    fundingCols.push(16, 17, 18);
  }

  const axesMap = {};
  const measuresMap = {};
  const objectivesMap = {};
  const actions = [];

  for (let ri = 2; ri < rows.length; ri++) {
    const row = rows[ri];
    if (!row) continue;

    const aaRaw = row[0];
    if (!aaRaw || isNaN(Number(aaRaw))) continue;
    const aa = parseInt(aaRaw, 10);

    const axisRaw = (row[1] || '').toString().trim();
    const measureRaw = (row[2] || '').toString().trim();
    const objectiveRaw = (row[3] || '').toString().trim();
    const title = (row[4] || '').toString().trim();

    if (!title) continue;
    if (epProgramCatalog.isEpTemplateExampleTitle(title)) continue;

    // Εξαγωγή κωδικών από τα πεδία
    const axisCodeMatch = axisRaw.match(/^(\d+)/);
    const axisCode = axisCodeMatch ? axisCodeMatch[1] : '';

    const measureCodeMatch = measureRaw.match(/^(\d+\.\d+)/);
    const measureCode = measureCodeMatch ? measureCodeMatch[1] : '';

    const objectiveCodeMatch = objectiveRaw.match(/^(\d+\.\d+\.\d+)/);
    const objectiveCode = objectiveCodeMatch ? objectiveCodeMatch[1] : '';

    if (axisCode && !axesMap[axisCode]) {
      axesMap[axisCode] = { code: axisCode, title: axisRaw };
    }
    if (measureCode && !measuresMap[measureCode]) {
      measuresMap[measureCode] = { code: measureCode, axisCode, title: measureRaw };
    }
    if (objectiveCode && !objectivesMap[objectiveCode]) {
      objectivesMap[objectiveCode] = { code: objectiveCode, measureCode, axisCode, title: objectiveRaw };
    }

    // Προϋπολογισμός ανά έτος
    const budgetYearsObj = {};
    for (const year of budgetYears) {
      const raw = row[budgetColMap[year]];
      const val = parseFloat(String(raw || '0').replace(/[^\d.-]/g, '')) || 0;
      budgetYearsObj[year] = val;
    }

    // Σύνολο
    let total = 0;
    if (totalCol >= 0 && row[totalCol] != null) {
      total = parseFloat(String(row[totalCol]).replace(/[^\d.-]/g, '')) || 0;
    }
    if (total === 0) {
      total = Object.values(budgetYearsObj).reduce((s, v) => s + v, 0);
    }

    // Πηγές χρηματοδότησης
    const fundingSources = fundingCols
      .map(ci => (row[ci] || '').toString().trim())
      .filter(s => s && s !== '0' && s !== '-');

    // Νέα / Συνεχιζόμενη
    const typeRaw = (row[6] || '').toString().trim().toLowerCase();
    const isNew = !typeRaw.includes('συνεχ');

    actions.push({
      id: uuidv4(),
      aa,
      axisCode,
      measureCode,
      objectiveCode,
      title,
      actionType: (row[5] || '').toString().trim(),
      isNew,
      location: (row[7] || '').toString().trim(),
      priority: (row[8] || '').toString().trim(),
      responsibleService: (row[9] || '').toString().trim(),
      budgetYears: budgetYearsObj,
      total,
      fundingSources,
      linkedSubprojectIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  const sortCodes = (arr) => arr.sort((a, b) => {
    const ap = a.code.split(/[.\-]/).map(Number);
    const bp = b.code.split(/[.\-]/).map(Number);
    for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
      if ((ap[i] || 0) !== (bp[i] || 0)) return (ap[i] || 0) - (bp[i] || 0);
    }
    return 0;
  });

  return {
    axes: sortCodes(Object.values(axesMap)),
    measures: sortCodes(Object.values(measuresMap)),
    objectives: sortCodes(Object.values(objectivesMap)),
    actions,
    budgetYears
  };
}

function buildImportedProgram(dataDir, { filePath, startYear, endYear, importedBy }) {
  const parsed = parseEpExcel(filePath);
  const sy = parseInt(startYear, 10);
  const ey = parseInt(endYear, 10);
  const period = epProgramCatalog.describeEpPeriod(sy, ey);
  const existing = loadAllProgramsFull(dataDir);
  const source = epProgramCatalog.pickLinkSourceProgram(existing, sy, ey);
  const transfer = source
    ? epProgramCatalog.transferEpActionLinks(source.actions || [], parsed.actions || [])
    : { actions: parsed.actions || [], transferred: 0, unmatched: 0 };
  if (!transfer.actions.length) {
    throw new Error('Δεν βρέθηκαν δράσεις στο φύλλο. Ελέγξτε ότι υπάρχει στήλη Α/Α και τίτλος.');
  }
  return {
    parsed,
    period,
    transfer,
    source,
    program: {
      id: uuidv4(),
      title: period.title || `ΕΠΙΧΕΙΡΗΣΙΑΚΟ ΠΡΟΓΡΑΜΜΑ ${sy}-${ey}`,
      startYear: sy,
      endYear: ey,
      isActive: true,
      budgetYears: parsed.budgetYears,
      axes: parsed.axes,
      measures: parsed.measures,
      objectives: parsed.objectives,
      actions: transfer.actions,
      importedAt: new Date().toISOString(),
      importedBy: importedBy || 'unknown'
    }
  };
}

function previewEpProgram(dataDir, { filePath, startYear, endYear }) {
  const built = buildImportedProgram(dataDir, { filePath, startYear, endYear, importedBy: 'preview' });
  const existing = loadAllProgramsFull(dataDir);
  const impact = epProgramCatalog.summarizeImportImpact(existing, built.program.startYear, built.program.endYear);
  return {
    success: true,
    title: built.program.title,
    period: built.period,
    actionCount: built.program.actions.length,
    axesCount: built.parsed.axes.length,
    measuresCount: built.parsed.measures.length,
    objectivesCount: built.parsed.objectives.length,
    impact: {
      ...impact,
      transferred: built.transfer.transferred,
      unmatched: built.transfer.unmatched
    }
  };
}

/**
 * Εισάγει Επιχειρησιακό Πρόγραμμα από Excel.
 * Αρχειοθετεί το τρέχον χωρίς να το διαγράψει· οι συνδέσεις της ίδιας
 * περιόδου αντιγράφονται στις νέες δράσεις (Α/Α ή τίτλος).
 */
function importEpProgram(dataDir, { filePath, startYear, endYear, importedBy }) {
  const built = buildImportedProgram(dataDir, { filePath, startYear, endYear, importedBy });
  archiveAllPrograms(dataDir);
  ensureEpDir(dataDir);
  safeWriteJSON(resolveProgramSavePath(dataDir, built.program), built.program);
  return {
    success: true,
    programId: built.program.id,
    title: built.program.title,
    periodLabel: built.period.label,
    actionCount: built.program.actions.length,
    axesCount: built.parsed.axes.length,
    measuresCount: built.parsed.measures.length,
    objectivesCount: built.parsed.objectives.length,
    transferredLinks: built.transfer.transferred,
    unmatchedLinks: built.transfer.unmatched
  };
}

function assertWritableProgram(program) {
  if (!program) throw new Error('Πρόγραμμα δεν βρέθηκε');
  if (!program.isActive) {
    throw new Error('Το αρχειοθετημένο πρόγραμμα είναι μόνο για ανάγνωση. Οι συνδέσεις του διατηρούνται.');
  }
}

/** Αποθηκεύει ή ενημερώνει μια δράση ΕΠ. */
function saveEpAction(dataDir, { programId, action }) {
  const program = getProgramById(dataDir, programId);
  assertWritableProgram(program);

  const now = new Date().toISOString();
  const idx = program.actions.findIndex(a => a.id === action.id);

  if (idx >= 0) {
    const prev = program.actions[idx];
    const nextLinks = Array.isArray(action && action.linkedSubprojectIds)
      ? action.linkedSubprojectIds
      : (prev.linkedSubprojectIds || []);
    program.actions[idx] = { ...prev, ...action, linkedSubprojectIds: nextLinks, updatedAt: now };
  } else {
    program.actions.push({
      ...action,
      id: action.id || uuidv4(),
      linkedSubprojectIds: action.linkedSubprojectIds || [],
      createdAt: now,
      updatedAt: now
    });
  }

  safeWriteJSON(resolveProgramSavePath(dataDir, program), program);
  return { success: true };
}

/** Διαγράφει μια δράση ΕΠ. */
function deleteEpAction(dataDir, { programId, actionId }) {
  const program = getProgramById(dataDir, programId);
  assertWritableProgram(program);

  program.actions = program.actions.filter(a => a.id !== actionId);
  safeWriteJSON(resolveProgramSavePath(dataDir, program), program);
  return { success: true };
}

/** Επιστρέφει τις δράσεις ΕΠ που έχουν συνδεθεί με ένα συγκεκριμένο υποέργο. */
function getEpActionsForSubproject(dataDir, subprojectId) {
  return epProgramCatalog.collectEpActionsForSubproject(loadAllProgramsFull(dataDir), subprojectId);
}

/** Προσθέτει ή αφαιρεί ένα υποέργο από τα linkedSubprojectIds μιας δράσης. */
function linkEpSubproject(dataDir, { programId, actionId, subprojectId, link }) {
  const program = getProgramById(dataDir, programId);
  assertWritableProgram(program);

  const idx = program.actions.findIndex(a => a.id === actionId);
  if (idx < 0) throw new Error('Δράση δεν βρέθηκε');

  const action = program.actions[idx];
  if (!Array.isArray(action.linkedSubprojectIds)) action.linkedSubprojectIds = [];

  if (link) {
    if (!action.linkedSubprojectIds.includes(subprojectId)) {
      action.linkedSubprojectIds.push(subprojectId);
    }
  } else {
    action.linkedSubprojectIds = action.linkedSubprojectIds.filter(id => id !== subprojectId);
  }

  action.updatedAt = new Date().toISOString();
  program.actions[idx] = action;

  safeWriteJSON(resolveProgramSavePath(dataDir, program), program);
  return { success: true };
}

module.exports = {
  loadAllPrograms,
  loadAllProgramsFull,
  getActiveProgram,
  getProgramById,
  previewEpProgram,
  importEpProgram,
  saveEpAction,
  deleteEpAction,
  getEpActionsForSubproject,
  linkEpSubproject
};

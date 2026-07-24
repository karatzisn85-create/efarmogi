/**
 * Ελαφρύ ευρετήριο υποέργων (Φάση 2 απόδοσης).
 * Δεν αντικαθιστά τα data.json — κρατά μονοπάτια + βασικά πεδία για γρήγορη φόρτωση.
 * Αν το ευρετήριο είναι άκυρο/κατεστραμμένο → επιστρέφει null και ο καλών κάνει πλήρη σάρωση.
 */

const fs = require('fs');
const path = require('path');
const { safeWriteJSON } = require('./safeWrite');

const INDEX_FILE_NAME = 'projects_index.json';
const INDEX_VERSION = 1;

function getProjectsIndexPath(dataDir) {
  return path.join(dataDir, INDEX_FILE_NAME);
}

function createEmptyIndex() {
  return {
    version: INDEX_VERSION,
    updatedAt: new Date().toISOString(),
    entries: [],
  };
}

function readProjectsIndex(dataDir) {
  if (!dataDir) return null;
  const indexPath = getProjectsIndexPath(dataDir);
  if (!fs.existsSync(indexPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    if (!raw || raw.version !== INDEX_VERSION || !Array.isArray(raw.entries)) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

function writeProjectsIndex(dataDir, index) {
  if (!dataDir || !index) return false;
  try {
    const payload = {
      version: INDEX_VERSION,
      updatedAt: new Date().toISOString(),
      entries: Array.isArray(index.entries) ? index.entries : [],
    };
    safeWriteJSON(getProjectsIndexPath(dataDir), payload);
    return true;
  } catch (err) {
    console.error('writeProjectsIndex failed:', err?.message || err);
    return false;
  }
}

function buildRelPath(projectId, subprojectId) {
  return path.join(String(projectId), String(subprojectId), 'data.json');
}

function entryFromDisk(dataDir, projectId, subprojectId, data) {
  const relPath = buildRelPath(projectId, subprojectId);
  const abs = path.join(dataDir, relPath);
  let mtimeMs = 0;
  try {
    mtimeMs = fs.statSync(abs).mtimeMs;
  } catch {
    mtimeMs = Date.now();
  }
  return {
    projectId: String(projectId),
    subprojectId: String(subprojectId),
    relPath: relPath.split(path.sep).join('/'),
    mtimeMs,
    projectTitle: data?.projectTitle || '',
    subprojectTitle: data?.subprojectTitle || '',
  };
}

function rebuildProjectsIndex(dataDir, projects) {
  const entries = (projects || [])
    .filter((p) => p && p.projectId && p.subprojectId)
    .map((p) => entryFromDisk(dataDir, p.projectId, p.subprojectId, p));
  return writeProjectsIndex(dataDir, { entries });
}

function upsertProjectsIndexEntry(dataDir, projectData) {
  if (!dataDir || !projectData?.projectId || !projectData?.subprojectId) return false;
  const index = readProjectsIndex(dataDir) || createEmptyIndex();
  const entry = entryFromDisk(dataDir, projectData.projectId, projectData.subprojectId, projectData);
  const sid = entry.subprojectId;
  const next = index.entries.filter((e) => e.subprojectId !== sid);
  next.push(entry);
  index.entries = next;
  return writeProjectsIndex(dataDir, index);
}

function removeProjectsIndexEntry(dataDir, subprojectId) {
  if (!dataDir || !subprojectId) return false;
  const index = readProjectsIndex(dataDir);
  if (!index) return false;
  const sid = String(subprojectId);
  const before = index.entries.length;
  index.entries = index.entries.filter((e) => e.subprojectId !== sid);
  if (index.entries.length === before) return true;
  return writeProjectsIndex(dataDir, index);
}

function invalidateProjectsIndex(dataDir) {
  if (!dataDir) return;
  const indexPath = getProjectsIndexPath(dataDir);
  try {
    if (fs.existsSync(indexPath)) fs.unlinkSync(indexPath);
  } catch (err) {
    console.error('invalidateProjectsIndex failed:', err?.message || err);
  }
}

/**
 * Γρήγορη φόρτωση μέσω ευρετηρίου.
 * Επιστρέφει λίστα projects ή null αν χρειάζεται πλήρης σάρωση.
 */
function loadProjectsViaIndex(dataDir, {
  skipRoot,
  normalizeProjectTypeField,
  isProjectLocked,
  loggedSubprojectIdMismatches,
}) {
  const index = readProjectsIndex(dataDir);
  if (!index || !index.entries.length) return null;

  const projects = [];
  for (const entry of index.entries) {
    if (!entry?.relPath || !entry.projectId || !entry.subprojectId) {
      return null;
    }
    // Αγνόησε ρίζες συστήματος (αναθέσεις, μελέτες κ.λπ.) πριν διαβάσουμε data.json
    // — αποφεύγει θόρυβο mismatch από παλιές εγγραφές ευρετηρίου.
    const projectDir = entry.projectId;
    if (skipRoot && skipRoot.has(projectDir)) continue;

    const relNorm = String(entry.relPath).split('/').join(path.sep);
    const jsonPath = path.join(dataDir, relNorm);
    if (!fs.existsSync(jsonPath)) {
      return null;
    }
    try {
      const st = fs.statSync(jsonPath);
      // Αν άλλαξε το αρχείο εκτός εφαρμογής, ξαναχτίζουμε
      if (entry.mtimeMs && Math.abs(st.mtimeMs - entry.mtimeMs) > 2) {
        return null;
      }
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (typeof normalizeProjectTypeField === 'function') {
        normalizeProjectTypeField(data);
      }
      const pTitle = data.projectTitle == null ? '' : String(data.projectTitle).trim();
      const sTitle = data.subprojectTitle == null ? '' : String(data.subprojectTitle).trim();
      if (!pTitle || !sTitle || pTitle === 'undefined' || sTitle === 'undefined') {
        continue;
      }

      const lockStatus = typeof isProjectLocked === 'function'
        ? isProjectLocked(projectDir)
        : { locked: false };

      data.isLocked = !!lockStatus.locked;
      if (lockStatus.locked) {
        data.lockedBy = lockStatus.pid;
        data.lockMessage = 'Ανοιχτό από άλλον χρήστη';
      }

      if (data.projectId !== projectDir) {
        data.projectId = projectDir;
      }
      const subDir = entry.subprojectId;
      if (data.subprojectId !== subDir) {
        if (loggedSubprojectIdMismatches && !loggedSubprojectIdMismatches.has(subDir)) {
          loggedSubprojectIdMismatches.add(subDir);
          console.log(`⚠️ SubprojectId mismatch detected: data.json has "${data.subprojectId}" but folder is "${subDir}". Using folder name.`);
        }
        data.subprojectId = subDir;
      }

      if (data.remainingAmountsByYear && Array.isArray(data.remainingAmountsByYear) && data.remainingAmountsByYear.length > 0) {
        const sortedEntries = [...data.remainingAmountsByYear].sort((a, b) => parseInt(b.year) - parseInt(a.year));
        const latestEntry = sortedEntries.find((row) => {
          const amount = (row.amount || '').toString().trim();
          return amount && amount !== '0' && amount !== '0,00';
        });
        if (latestEntry) {
          data.remainingAmount = latestEntry.amount;
          data.remainingAmountYear = latestEntry.year;
        } else {
          data.remainingAmount = sortedEntries[0].amount || '';
          data.remainingAmountYear = sortedEntries[0].year || '';
        }
      }

      projects.push(data);
    } catch {
      return null;
    }
  }

  return projects;
}

function findIndexedSubprojectPath(dataDir, subprojectId) {
  const sid = String(subprojectId || '').trim();
  if (!sid) return null;
  const index = readProjectsIndex(dataDir);
  if (!index) return null;
  const entry = index.entries.find((e) => e.subprojectId === sid);
  if (!entry?.relPath) return null;
  const abs = path.join(dataDir, String(entry.relPath).split('/').join(path.sep));
  return fs.existsSync(abs) ? abs : null;
}

module.exports = {
  INDEX_FILE_NAME,
  INDEX_VERSION,
  getProjectsIndexPath,
  readProjectsIndex,
  writeProjectsIndex,
  rebuildProjectsIndex,
  upsertProjectsIndexEntry,
  removeProjectsIndexEntry,
  invalidateProjectsIndex,
  loadProjectsViaIndex,
  findIndexedSubprojectPath,
  entryFromDisk,
};

/**
 * Ελαφρύ ευρετήριο υποέργων (Φάση 2 απόδοσης).
 * Δεν αντικαθιστά τα data.json — κρατά μονοπάτια + βασικά πεδία για γρήγορη φόρτωση.
 * Αν το ευρετήριο είναι άκυρο/κατεστραμμένο → επιστρέφει null και ο καλών κάνει πλήρη σάρωση.
 */

const fs = require('fs');
const path = require('path');
const { safeWriteJSON } = require('./safeWrite');
const { withServiceLock } = require('./fileLock');

const INDEX_FILE_NAME = 'projects_index.json';
const INDEX_LOCK_FILE_NAME = 'projects_index.lock';
const INDEX_VERSION = 1;

/** Ανοχή mtime σε κοινό φάκελο (SMB/FAT συχνά στρογγυλοποιούν· 2ms ακύρωνε το ευρετήριο συνέχεια). */
const MTIME_TOLERANCE_MS = 2000;

/** Φάκελοι έργων = UUID v4 — αγνοούμε temp/NAS/σκουπίδια στον έλεγχο ελλείψεων. */
const PROJECT_DIR_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getProjectsIndexPath(dataDir) {
  return path.join(dataDir, INDEX_FILE_NAME);
}

function getProjectsIndexLockPath(dataDir) {
  return path.join(dataDir, INDEX_LOCK_FILE_NAME);
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
  return withServiceLock(
    getProjectsIndexLockPath(dataDir),
    () => writeProjectsIndex(dataDir, { entries })
  );
}

/**
 * Ενημέρωση του ευρετηρίου με προστασία από ταυτόχρονη εγγραφή.
 *
 * Το ευρετήριο είναι ένα ενιαίο αρχείο που ξαναγράφεται ολόκληρο: αν δύο υπολογιστές το
 * διαβάσουν και το γράψουν την ίδια στιγμή, ο ένας σβήνει την εγγραφή του άλλου και το
 * υποέργο «εξαφανίζεται» από τις λίστες. Γι' αυτό το διάβασμα και το γράψιμο γίνονται μέσα
 * σε κλείδωμα, και μετά την εγγραφή επιβεβαιώνουμε το αποτέλεσμα — αν χάθηκε, ξαναγράφουμε.
 *
 * @param {(index: object) => object|null} mutate επιστρέφει το νέο ευρετήριο ή null αν δεν χρειάζεται εγγραφή
 * @param {(saved: object|null) => boolean} verify επιβεβαιώνει ότι η αλλαγή έμεινε στον δίσκο
 */
function updateProjectsIndexSafely(dataDir, mutate, verify) {
  const result = withServiceLock(getProjectsIndexLockPath(dataDir), () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const index = readProjectsIndex(dataDir);
      const next = mutate(index);
      if (next === null) return true;
      if (!writeProjectsIndex(dataDir, next)) return false;
      if (verify(readProjectsIndex(dataDir))) return true;
    }
    console.warn('projectsIndex: η ενημέρωση δεν επιβεβαιώθηκε — το ευρετήριο θα ξαναχτιστεί');
    invalidateProjectsIndex(dataDir);
    return false;
  });
  // Lock δεν αποκτήθηκε → δεν γράψαμε
  return result === true;
}

function upsertProjectsIndexEntry(dataDir, projectData) {
  if (!dataDir || !projectData?.projectId || !projectData?.subprojectId) return false;
  const entry = entryFromDisk(dataDir, projectData.projectId, projectData.subprojectId, projectData);
  const sid = entry.subprojectId;
  return updateProjectsIndexSafely(
    dataDir,
    // Χωρίς υπάρχον ευρετήριο δεν φτιάχνουμε καινούργιο με μία μόνο εγγραφή: θα έκρυβε
    // όλα τα υπόλοιπα υποέργα. Ξαναχτίζεται ολόκληρο στην επόμενη πλήρη φόρτωση.
    (index) => (index
      ? { ...index, entries: [...index.entries.filter((e) => e.subprojectId !== sid), entry] }
      : null),
    (saved) => !!saved && saved.entries.some((e) => e.subprojectId === sid)
  );
}

function removeProjectsIndexEntry(dataDir, subprojectId) {
  if (!dataDir || !subprojectId) return false;
  const sid = String(subprojectId);
  return updateProjectsIndexSafely(
    dataDir,
    (index) => (index && index.entries.some((e) => e.subprojectId === sid)
      ? { ...index, entries: index.entries.filter((e) => e.subprojectId !== sid) }
      : null),
    (saved) => !saved || !saved.entries.some((e) => e.subprojectId === sid)
  );
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

function looksLikeProjectDir(dirName) {
  return PROJECT_DIR_UUID_RE.test(String(dirName || ''));
}

/**
 * Λείπει ολόκληρο έργο από το ευρετήριο ενώ υπάρχει στον δίσκο;
 *
 * Δίχτυ ασφαλείας: ένα ελλιπές ευρετήριο θα «εξαφάνιζε» υποέργα από όλες τις οθόνες χωρίς
 * κανένα άλλο σημάδι. Εξετάζουμε μόνο φακέλους που μοιάζουν με UUID έργου (όχι temp/NAS).
 * Χωρίς cache αποτελέσματος: σε κοινό φάκελο άλλος υπολογιστής μπορεί να πρόσθεσε έργο
 * χωρίς να ενημερώσει το ευρετήριο — cache θα το έκρυβε προσωρινά.
 */
function indexIsMissingProjects(dataDir, index, skipRoot) {
  try {
    const indexedProjects = new Set(index.entries.map((e) => e.projectId));
    for (const dir of fs.readdirSync(dataDir)) {
      if (skipRoot && skipRoot.has(dir)) continue;
      if (indexedProjects.has(dir)) continue;
      // Πραγματικά έργα έχουν UUID φάκελο — αγνοούμε σκουπίδια / temp / μη-έργα.
      if (!looksLikeProjectDir(dir)) continue;
      const projectPath = path.join(dataDir, dir);
      try {
        if (!fs.statSync(projectPath).isDirectory()) continue;
        // Μετράμε μόνο υποέργα που θα έμπαιναν όντως στο ευρετήριο· αλλιώς ένα χαλασμένο
        // αρχείο θα επέβαλλε πλήρη σάρωση σε κάθε φόρτωση για πάντα.
        const hasIndexableSubproject = fs.readdirSync(projectPath).some((sub) => {
          const jsonPath = path.join(projectPath, sub, 'data.json');
          if (!fs.existsSync(jsonPath)) return false;
          try {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            return !!(String(data?.projectTitle || '').trim() && String(data?.subprojectTitle || '').trim());
          } catch {
            return false;
          }
        });
        if (hasIndexableSubproject) return true;
      } catch { /* προσπερνάμε προβληματικό φάκελο */ }
    }
    return false;
  } catch {
    return false;
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
  if (indexIsMissingProjects(dataDir, index, skipRoot)) return null;

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
      // Αν άλλαξε ουσιαστικά το αρχείο εκτός εφαρμογής, ξαναχτίζουμε.
      // Ανοχή για SMB/κοινό φάκελο — πολύ μικρό όριο ακύρωνε το ευρετήριο σε κάθε φόρτωση.
      if (entry.mtimeMs && Math.abs(st.mtimeMs - entry.mtimeMs) > MTIME_TOLERANCE_MS) {
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
  INDEX_LOCK_FILE_NAME,
  INDEX_VERSION,
  MTIME_TOLERANCE_MS,
  getProjectsIndexPath,
  getProjectsIndexLockPath,
  readProjectsIndex,
  writeProjectsIndex,
  rebuildProjectsIndex,
  upsertProjectsIndexEntry,
  removeProjectsIndexEntry,
  invalidateProjectsIndex,
  loadProjectsViaIndex,
  findIndexedSubprojectPath,
  entryFromDisk,
  looksLikeProjectDir,
};

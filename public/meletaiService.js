/**
 * meletaiService.js — Μητρώο Μελετών (CRUD, σύνδεση υποέργων, αρχεία)
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { safeWriteJSON } = require('./safeWrite');

const MELETAI_DIR_NAME = 'ΜΕΛΕΤΕΣ';
const DEFAULT_FILES_GROUP_LABEL = 'ΑΡΧΕΙΑ';

const DATA_DIR_SKIP_ROOT_DIRS = new Set([
  'entaxeis', 'ΠΡΟΣΚΛΗΣΕΙΣ', 'locks', 'egkriseis_links', 'subproject_links',
  'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ', 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ',
  'ΣΗΜΕΙΩΣΕΙΣ', 'ANATHESEIS_ERGASION', 'ΥΠΟΔΕΙΓΜΑΤΑ_ΕΓΓΡΑΦΩΝ',
  'ΜΕΛΕΤΕΣ', 'ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ', 'ΕΠΙΧΕΙΡΗΣΙΑΚΟ_ΠΡΟΓΡΑΜΜΑ', 'config', 'backups',
]);
const MELETI_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STUDY_NUMBER_REGEX = /^(\d{1,4})\/(\d{4})$/;

function validateStudyNumberFormat(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Απαιτείται αριθμός μελέτης' };
  }
  const match = trimmed.match(STUDY_NUMBER_REGEX);
  if (!match) {
    return {
      ok: false,
      error: 'Μορφή: αριθμός/έτος (π.χ. 2/2026). Μόνο ψηφία, χωρίς κενά ή σύμβολα.',
    };
  }
  const year = parseInt(match[2], 10);
  if (year < 1990 || year > 2100) {
    return { ok: false, error: 'Το έτος πρέπει να είναι μεταξύ 1990 και 2100' };
  }
  const num = parseInt(match[1], 10);
  if (!Number.isFinite(num) || num < 1) {
    return { ok: false, error: 'Ο αριθμός μελέτης πρέπει να είναι θετικός' };
  }
  return { ok: true, studyNumber: `${num}/${match[2]}` };
}

function normalizeStudyNumberKey(value) {
  const v = validateStudyNumberFormat(value);
  if (v.ok) return v.studyNumber;
  return String(value || '').trim().toLowerCase();
}

function countFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const walk = (current) => {
    for (const ent of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, ent.name);
      if (ent.isFile()) count += 1;
      else if (ent.isDirectory()) walk(full);
    }
  };
  walk(dir);
  return count;
}

function folderStatsRecursive(dir) {
  if (!fs.existsSync(dir)) return { fileCount: 0, totalSize: 0 };
  let fileCount = 0;
  let totalSize = 0;
  const walk = (current) => {
    for (const ent of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, ent.name);
      if (ent.isFile()) {
        fileCount += 1;
        try {
          totalSize += fs.statSync(full).size;
        } catch {
          /* skip unreadable file */
        }
      } else if (ent.isDirectory()) walk(full);
    }
  };
  walk(dir);
  return { fileCount, totalSize };
}

function resolveSafeDestPath(baseDir, relativePath) {
  const safeRel = String(relativePath || '').split(/[/\\]/).filter(Boolean).join(path.sep);
  if (!safeRel) return null;
  const destPath = path.resolve(baseDir, safeRel);
  const resolvedBase = path.resolve(baseDir);
  if (destPath !== resolvedBase && !destPath.startsWith(resolvedBase + path.sep)) {
    return null;
  }
  return destPath;
}

function normalizeStudyNumber(value) {
  const v = validateStudyNumberFormat(value);
  return v.ok ? v.studyNumber : String(value || '').trim().replace(/\s+/g, ' ');
}

function resolveUploadFileRef(file) {
  if (!file) return null;
  if (typeof file === 'string') {
    return fs.existsSync(file) ? { path: file, name: path.basename(file), relativePath: null } : null;
  }
  const sourcePath = file.filePath || file.path;
  if (!sourcePath || !fs.existsSync(sourcePath)) return null;
  return {
    path: sourcePath,
    name: file.fileName || file.name || path.basename(sourcePath),
    relativePath: file.relativePath || file.relative || null,
  };
}

function splitSafeRelativeParts(relativePath) {
  return String(relativePath || '').split(/[/\\]/).filter(Boolean).map((part) => {
    const base = path.basename(String(part || '').trim());
    if (!base || base === '.' || base === '..') {
      throw new Error('Μη επιτρεπτό path αρχείου');
    }
    return base;
  });
}

function createMeletaiService({ dataDir }) {
  const mutationQueues = new Map();
  let studyNumberIndexCache = null;

  function invalidateStudyNumberCache() {
    studyNumberIndexCache = null;
  }

  function getStudyNumberIndex() {
    if (studyNumberIndexCache) return studyNumberIndexCache;
    const index = new Map();
    for (const m of loadAllMeletai()) {
      const key = normalizeStudyNumberKey(m.studyNumber);
      if (key) index.set(key, m);
    }
    studyNumberIndexCache = index;
    return index;
  }

  function getMeletaiDir() {
    return path.join(dataDir, MELETAI_DIR_NAME);
  }

  function ensureMeletaiDir() {
    const dir = getMeletaiDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  function getMeletiDir(meletiId) {
    return path.join(ensureMeletaiDir(), meletiId);
  }

  function getMeletiDataPath(meletiId) {
    return path.join(getMeletiDir(meletiId), 'data.json');
  }

  function assertValidMeletiId(meletiId) {
    const id = String(meletiId || '').trim();
    if (!MELETI_ID_RE.test(id)) {
      return { ok: false, error: 'Μη έγκυρο αναγνωριστικό μελέτης' };
    }
    const resolved = path.resolve(getMeletiDir(id));
    const rootResolved = path.resolve(getMeletaiDir());
    if (!resolved.startsWith(rootResolved + path.sep)) {
      return { ok: false, error: 'Μη επιτρεπτό path μελέτης' };
    }
    return { ok: true, id };
  }

  function loadMeleti(meletiId) {
    const dataPath = getMeletiDataPath(meletiId);
    if (!fs.existsSync(dataPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch {
      return null;
    }
  }

  function loadAllMeletai() {
    const rootDir = ensureMeletaiDir();
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    const list = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const meleti = loadMeleti(entry.name);
      if (meleti) list.push(meleti);
    }
    list.sort((a, b) => {
      const na = normalizeStudyNumberKey(a.studyNumber || '');
      const nb = normalizeStudyNumberKey(b.studyNumber || '');
      if (na !== nb) return nb.localeCompare(na, 'el');
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    return list;
  }

  function findMeletiByStudyNumber(studyNumber, excludeId = null) {
    const key = normalizeStudyNumberKey(studyNumber);
    if (!key) return null;
    const match = getStudyNumberIndex().get(key);
    if (!match || match.id === excludeId) return null;
    return match;
  }

  function findMeletiBySubprojectId(subprojectId, excludeId = null) {
    const sid = String(subprojectId || '').trim();
    if (!sid) return null;
    return loadAllMeletai().find(
      (m) => m.linkedSubprojectId === sid && m.id !== excludeId
    ) || null;
  }

  function checkStudyNumberAvailable(studyNumber, excludeId = null) {
    const fmt = validateStudyNumberFormat(studyNumber);
    if (!fmt.ok) {
      return { available: false, error: fmt.error, invalidFormat: true };
    }
    const existing = findMeletiByStudyNumber(fmt.studyNumber, excludeId);
    if (existing) {
      return {
        available: false,
        error: `Ο αριθμός «${fmt.studyNumber}» είναι ήδη καταχωρημένος (${existing.title || 'χωρίς τίτλο'})`,
        existingId: existing.id,
      };
    }
    return { available: true, studyNumber: fmt.studyNumber };
  }

  function resolveGroupPath(meletiId, groupId, ...parts) {
    const target = path.resolve(path.join(getMeletiDir(meletiId), 'files', groupId, ...parts));
    const root = path.resolve(getMeletaiDir());
    if (!target.startsWith(root + path.sep)) {
      throw new Error('Μη επιτρεπτό path');
    }
    return target;
  }

  function requireMeletiGroup(meletiId, groupId) {
    const idCheck = assertValidMeletiId(meletiId);
    if (!idCheck.ok) return idCheck;
    const meleti = loadMeleti(idCheck.id);
    if (!meleti) return { ok: false, error: 'Η μελέτη δεν βρέθηκε' };
    const group = (meleti.fileGroups || []).find((g) => g.id === groupId);
    if (!group) return { ok: false, error: 'Η κατηγορία δεν βρέθηκε στη μελέτη' };
    return { ok: true, meletiId: idCheck.id, meleti, group };
  }

  function ensureDefaultFileGroup(meleti) {
    const groups = [...(meleti.fileGroups || [])];
    const defaultGroup = groups.find((g) => g.label === DEFAULT_FILES_GROUP_LABEL);
    if (defaultGroup) return { groups, defaultGroupId: defaultGroup.id };
    const newGroup = { id: uuidv4(), label: DEFAULT_FILES_GROUP_LABEL, files: [] };
    groups.push(newGroup);
    return { groups, defaultGroupId: newGroup.id };
  }

  function mergeUploadedFilesIntoMeleti(meletiId, groupId, savedFiles) {
    const meleti = loadMeleti(meletiId);
    if (!meleti) return null;
    const groupExists = (meleti.fileGroups || []).some((g) => g.id === groupId);
    if (!groupExists) return null;
    const updatedGroups = (meleti.fileGroups || []).map((g) => {
      if (g.id !== groupId) return g;
      const existingKeys = new Set((g.files || []).map((f) => (f.kind === 'folder' ? f.id : f.name)));
      const merged = [...(g.files || [])];
      savedFiles.forEach((f) => {
        const key = f.kind === 'folder' ? f.id : f.name;
        if (!existingKeys.has(key)) merged.push(f);
      });
      return { ...g, files: merged };
    });
    const toSave = { ...meleti, fileGroups: updatedGroups, updatedAt: new Date().toISOString() };
    safeWriteJSON(getMeletiDataPath(meletiId), toSave);
    return loadMeleti(meletiId);
  }

  function enqueueMutation(meletiId, fn) {
    const key = String(meletiId || '').trim() || '__none__';
    const prev = mutationQueues.get(key) || Promise.resolve();
    const run = prev.then(() => Promise.resolve().then(fn));
    mutationQueues.set(key, run.catch((err) => {
      console.error('[meletai] mutation failed:', err?.message || err);
    }));
    return run;
  }

  function validateMeletiPayload(meleti, excludeId = null) {
    const fmt = validateStudyNumberFormat(meleti?.studyNumber);
    if (!fmt.ok) return { ok: false, error: fmt.error, invalidFormat: true };
    const numCheck = checkStudyNumberAvailable(fmt.studyNumber, excludeId);
    if (!numCheck.available) return { ok: false, error: numCheck.error, duplicate: true };
    const title = String(meleti?.title || '').trim();
    if (!title) return { ok: false, error: 'Απαιτείται τίτλος μελέτης' };
    return { ok: true, studyNumber: fmt.studyNumber, title };
  }

  function validateLink(subprojectId, meletiId) {
    const sid = String(subprojectId || '').trim();
    if (!sid) return { ok: true, subprojectId: null };

    const otherStudy = findMeletiBySubprojectId(sid, meletiId);
    if (otherStudy) {
      return {
        ok: false,
        error: `Το υποέργο είναι ήδη συνδεδεμένο με τη μελέτη «${otherStudy.studyNumber} — ${otherStudy.title || ''}»`,
      };
    }
    return { ok: true, subprojectId: sid };
  }

  function saveMeletiInner(meleti, { expectedUpdatedAt } = {}) {
    if (!meleti?.id) return { success: false, error: 'Μη έγκυρα δεδομένα μελέτης' };
    const idCheck = assertValidMeletiId(meleti.id);
    if (!idCheck.ok) return { success: false, error: idCheck.error };

    const validation = validateMeletiPayload(meleti, idCheck.id);
    if (!validation.ok) return { success: false, error: validation.error, duplicate: !!validation.duplicate };

    const meletiDir = getMeletiDir(idCheck.id);
    const dataPath = getMeletiDataPath(idCheck.id);
    const existedBefore = fs.existsSync(dataPath);
    const existing = existedBefore ? loadMeleti(idCheck.id) : null;

    const linkSubprojectId = existing
      ? (existing.linkedSubprojectId ?? null)
      : (meleti.linkedSubprojectId || null);
    const linkCheck = validateLink(linkSubprojectId, idCheck.id);
    if (!linkCheck.ok) return { success: false, error: linkCheck.error };

    if (existing && expectedUpdatedAt && existing.updatedAt !== expectedUpdatedAt) {
      return {
        success: false,
        conflict: true,
        error: 'Η μελέτη τροποποιήθηκε από άλλη ενέργεια. Φορτώστε ξανά και επαναλάβετε.',
        meleti: existing,
      };
    }

    if (!fs.existsSync(meletiDir)) fs.mkdirSync(meletiDir, { recursive: true });

    const freshExisting = existedBefore ? loadMeleti(idCheck.id) : null;
    const now = new Date().toISOString();
    const toSave = {
      ...(freshExisting || {}),
      ...meleti,
      id: idCheck.id,
      studyNumber: validation.studyNumber,
      title: validation.title,
      assignedTo: String(meleti.assignedTo || '').trim(),
      category: String(meleti.category || '').trim(),
      notes: String(meleti.notes || '').trim(),
      updatedAt: now,
    };

    if (freshExisting) {
      toSave.createdAt = freshExisting.createdAt;
      toSave.linkedSubprojectId = freshExisting.linkedSubprojectId ?? null;
      toSave.linkedProjectTitle = String(freshExisting.linkedProjectTitle || '').trim();
      toSave.linkedSubprojectTitle = String(freshExisting.linkedSubprojectTitle || '').trim();
      toSave.fileGroups = Array.isArray(freshExisting.fileGroups) ? freshExisting.fileGroups : [];
    } else {
      toSave.linkedSubprojectId = meleti.linkedSubprojectId || null;
      toSave.linkedProjectTitle = String(meleti.linkedProjectTitle || '').trim();
      toSave.linkedSubprojectTitle = String(meleti.linkedSubprojectTitle || '').trim();
      toSave.fileGroups = Array.isArray(meleti.fileGroups) ? meleti.fileGroups : [];
      if (!toSave.createdAt) toSave.createdAt = now;
    }

    const finalNumCheck = checkStudyNumberAvailable(toSave.studyNumber, idCheck.id);
    if (!finalNumCheck.available) {
      return { success: false, error: finalNumCheck.error, duplicate: true };
    }

    safeWriteJSON(dataPath, toSave);
    invalidateStudyNumberCache();
    return { success: true, meleti: toSave, isNew: !existedBefore, previous: freshExisting || existing };
  }

  function saveMeleti(meleti, options = {}) {
    if (!meleti?.id) return Promise.resolve({ success: false, error: 'Μη έγκυρα δεδομένα μελέτης' });
    const idCheck = assertValidMeletiId(meleti.id);
    if (!idCheck.ok) return Promise.resolve({ success: false, error: idCheck.error });
    return enqueueMutation(idCheck.id, () => saveMeletiInner(meleti, options));
  }

  function deleteMeletiInner(meletiId) {
    const idCheck = assertValidMeletiId(meletiId);
    if (!idCheck.ok) return { success: false, error: idCheck.error };
    const resolved = path.resolve(getMeletiDir(idCheck.id));
    const rootResolved = path.resolve(getMeletaiDir());
    if (!resolved.startsWith(rootResolved + path.sep)) {
      return { success: false, error: 'Μη επιτρεπτό path' };
    }
    const meleti = loadMeleti(idCheck.id);
    if (fs.existsSync(resolved)) fs.rmSync(resolved, { recursive: true, force: true });
    invalidateStudyNumberCache();
    return { success: true, meleti };
  }

  function deleteMeleti(meletiId) {
    const idCheck = assertValidMeletiId(meletiId);
    if (!idCheck.ok) return Promise.resolve({ success: false, error: idCheck.error });
    return enqueueMutation(idCheck.id, () => deleteMeletiInner(idCheck.id));
  }

  function linkSubprojectInner(meletiId, subprojectId, projectTitle, subprojectTitle) {
    const idCheck = assertValidMeletiId(meletiId);
    if (!idCheck.ok) return { success: false, error: idCheck.error };
    const meleti = loadMeleti(idCheck.id);
    if (!meleti) return { success: false, error: 'Η μελέτη δεν βρέθηκε' };

    const linkCheck = validateLink(subprojectId, idCheck.id);
    if (!linkCheck.ok) return { success: false, error: linkCheck.error };

    if (meleti.linkedSubprojectId && meleti.linkedSubprojectId !== subprojectId) {
      return {
        success: false,
        error: `Η μελέτη είναι ήδη συνδεδεμένη με «${meleti.linkedSubprojectTitle || meleti.linkedSubprojectId}». Αποσυνδέστε πρώτα.`,
      };
    }

    const toSave = {
      ...meleti,
      linkedSubprojectId: subprojectId || null,
      linkedProjectTitle: projectTitle || '',
      linkedSubprojectTitle: subprojectTitle || '',
      updatedAt: new Date().toISOString(),
    };
    safeWriteJSON(getMeletiDataPath(idCheck.id), toSave);
    return { success: true, meleti: toSave };
  }

  function linkSubproject(meletiId, subprojectId, projectTitle, subprojectTitle) {
    const idCheck = assertValidMeletiId(meletiId);
    if (!idCheck.ok) return Promise.resolve({ success: false, error: idCheck.error });
    return enqueueMutation(idCheck.id, () => linkSubprojectInner(idCheck.id, subprojectId, projectTitle, subprojectTitle));
  }

  function unlinkSubprojectInner(meletiId) {
    const idCheck = assertValidMeletiId(meletiId);
    if (!idCheck.ok) return { success: false, error: idCheck.error };
    const meleti = loadMeleti(idCheck.id);
    if (!meleti) return { success: false, error: 'Η μελέτη δεν βρέθηκε' };
    const previous = { ...meleti };
    const toSave = {
      ...meleti,
      linkedSubprojectId: null,
      linkedProjectTitle: '',
      linkedSubprojectTitle: '',
      updatedAt: new Date().toISOString(),
    };
    safeWriteJSON(getMeletiDataPath(idCheck.id), toSave);
    return { success: true, meleti: toSave, previous };
  }

  function unlinkSubproject(meletiId) {
    const idCheck = assertValidMeletiId(meletiId);
    if (!idCheck.ok) return Promise.resolve({ success: false, error: idCheck.error });
    return enqueueMutation(idCheck.id, () => unlinkSubprojectInner(idCheck.id));
  }

  function getMeletiBySubprojectId(subprojectId) {
    return findMeletiBySubprojectId(subprojectId);
  }

  function addFileGroupInner(meletiId, label) {
    const idCheck = assertValidMeletiId(meletiId);
    if (!idCheck.ok) return { success: false, error: idCheck.error };
    const meleti = loadMeleti(idCheck.id);
    if (!meleti) return { success: false, error: 'Η μελέτη δεν βρέθηκε' };
    const trimmed = String(label || '').trim();
    if (!trimmed) return { success: false, error: 'Απαιτείται όνομα κατηγορίας' };
    const groups = [...(meleti.fileGroups || [])];
    if (groups.some((g) => g.label === trimmed)) {
      return { success: false, error: 'Η κατηγορία υπάρχει ήδη' };
    }
    const newGroup = { id: uuidv4(), label: trimmed, files: [] };
    groups.push(newGroup);
    const toSave = { ...meleti, fileGroups: groups, updatedAt: new Date().toISOString() };
    safeWriteJSON(getMeletiDataPath(idCheck.id), toSave);
    return { success: true, meleti: toSave, group: newGroup };
  }

  function addFileGroup(meletiId, label) {
    const idCheck = assertValidMeletiId(meletiId);
    if (!idCheck.ok) return Promise.resolve({ success: false, error: idCheck.error });
    return enqueueMutation(idCheck.id, () => addFileGroupInner(idCheck.id, label));
  }

  function resolveOrEnsureGroupId(meletiId, groupId) {
    const meleti = loadMeleti(meletiId);
    if (!meleti) return { ok: false, error: 'Η μελέτη δεν βρέθηκε' };
    if (groupId) {
      const group = (meleti.fileGroups || []).find((g) => g.id === groupId);
      if (!group) return { ok: false, error: 'Η κατηγορία δεν βρέθηκε' };
      return { ok: true, groupId, meleti };
    }
    const { groups, defaultGroupId } = ensureDefaultFileGroup(meleti);
    if (groups !== meleti.fileGroups) {
      const toSave = { ...meleti, fileGroups: groups, updatedAt: new Date().toISOString() };
      safeWriteJSON(getMeletiDataPath(meletiId), toSave);
    }
    return { ok: true, groupId: defaultGroupId, meleti: loadMeleti(meletiId) };
  }

  async function uploadFiles(meletiId, groupId, files) {
    const idCheck = assertValidMeletiId(meletiId);
    if (!idCheck.ok) return { success: false, error: idCheck.error };
    if (!Array.isArray(files) || files.length === 0) {
      return { success: false, error: 'Δεν επιλέχθηκαν αρχεία' };
    }

    return enqueueMutation(idCheck.id, async () => {
      const groupResolved = resolveOrEnsureGroupId(idCheck.id, groupId);
      if (!groupResolved.ok) return { success: false, error: groupResolved.error };
      const gid = groupResolved.groupId;

      const groupDir = resolveGroupPath(idCheck.id, gid);
      if (!fs.existsSync(groupDir)) fs.mkdirSync(groupDir, { recursive: true });

      const saved = [];
      let skipped = 0;
      for (const file of files) {
        const ref = resolveUploadFileRef(file);
        if (!ref) {
          skipped += 1;
          continue;
        }
        let baseName = path.basename(ref.name || ref.path);
        let destPath = path.join(groupDir, baseName);
        let counter = 1;
        while (fs.existsSync(destPath)) {
          const ext = path.extname(baseName);
          const nameNoExt = path.basename(baseName, ext);
          destPath = path.join(groupDir, `${nameNoExt}_${counter}${ext}`);
          counter += 1;
        }
        fs.copyFileSync(ref.path, destPath);
        saved.push({
          kind: 'file',
          name: path.basename(destPath),
          originalName: baseName,
          size: fs.statSync(destPath).size,
          uploadedAt: new Date().toISOString(),
        });
      }
      if (!saved.length) {
        return {
          success: false,
          error: skipped > 0 ? 'Δεν αντιγράφηκε κανένα αρχείο' : 'Δεν αντιγράφηκε κανένα αρχείο',
          skipped,
          requested: files.length,
        };
      }

      const updated = mergeUploadedFilesIntoMeleti(idCheck.id, gid, saved);
      if (!updated) {
        saved.forEach((f) => {
          try {
            const p = path.join(groupDir, f.name);
            if (fs.existsSync(p)) fs.unlinkSync(p);
          } catch { /* ignore */ }
        });
        return { success: false, error: 'Αποτυχία αποθήκευσης metadata', skipped, requested: files.length };
      }
      return {
        success: true,
        files: saved,
        meleti: updated,
        groupId: gid,
        skipped,
        requested: files.length,
      };
    });
  }

  async function uploadFolder(meletiId, groupId, folderName, files) {
    const idCheck = assertValidMeletiId(meletiId);
    if (!idCheck.ok) return { success: false, error: idCheck.error };
    if (!Array.isArray(files) || files.length === 0) {
      return { success: false, error: 'Ο φάκελος είναι κενός' };
    }

    return enqueueMutation(idCheck.id, async () => {
      const groupResolved = resolveOrEnsureGroupId(idCheck.id, groupId);
      if (!groupResolved.ok) return { success: false, error: groupResolved.error };
      const gid = groupResolved.groupId;

      const groupDir = resolveGroupPath(idCheck.id, gid);
      if (!fs.existsSync(groupDir)) fs.mkdirSync(groupDir, { recursive: true });

      const folderId = uuidv4();
      const folderDir = resolveGroupPath(idCheck.id, gid, folderId);
      fs.mkdirSync(folderDir, { recursive: true });

      let totalSize = 0;
      let copied = 0;
      let skipped = 0;
      for (const file of files) {
        const ref = resolveUploadFileRef(file);
        if (!ref) {
          skipped += 1;
          continue;
        }
        const rel = ref.relativePath || ref.name || path.basename(ref.path);
        const destPath = resolveSafeDestPath(folderDir, rel);
        if (!destPath) {
          skipped += 1;
          continue;
        }
        const destParent = path.dirname(destPath);
        if (!fs.existsSync(destParent)) fs.mkdirSync(destParent, { recursive: true });
        fs.copyFileSync(ref.path, destPath);
        totalSize += fs.statSync(destPath).size;
        copied += 1;
      }
      if (!copied) {
        try { fs.rmSync(folderDir, { recursive: true, force: true }); } catch { /* ignore */ }
        return {
          success: false,
          error: 'Δεν αντιγράφηκε κανένα αρχείο',
          skipped,
          requested: files.length,
        };
      }

      const filesOnDisk = countFilesRecursive(folderDir);

      const folderEntry = {
        kind: 'folder',
        id: folderId,
        name: String(folderName || 'Φάκελος').trim() || 'Φάκελος',
        fileCount: filesOnDisk,
        size: totalSize,
        uploadedAt: new Date().toISOString(),
      };

      const updated = mergeUploadedFilesIntoMeleti(idCheck.id, gid, [folderEntry]);
      if (!updated) {
        try { fs.rmSync(folderDir, { recursive: true, force: true }); } catch { /* ignore */ }
        return { success: false, error: 'Αποτυχία αποθήκευσης metadata φακέλου' };
      }
      return {
        success: true,
        folder: folderEntry,
        meleti: updated,
        groupId: gid,
        skipped,
        requested: files.length,
        copied,
      };
    });
  }

  function deleteFileInner(meletiId, groupId, fileName) {
    const groupCheck = requireMeletiGroup(meletiId, groupId);
    if (!groupCheck.ok) return { success: false, error: groupCheck.error };
    const filePath = resolveGroupPath(groupCheck.meletiId, groupId, fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    const updatedGroups = (groupCheck.meleti.fileGroups || []).map((g) => {
      if (g.id !== groupId) return g;
      return { ...g, files: (g.files || []).filter((f) => !(f.kind !== 'folder' && f.name === fileName)) };
    });
    const toSave = { ...groupCheck.meleti, fileGroups: updatedGroups, updatedAt: new Date().toISOString() };
    safeWriteJSON(getMeletiDataPath(groupCheck.meletiId), toSave);
    return { success: true, meleti: toSave };
  }

  function deleteFile(meletiId, groupId, fileName) {
    const idCheck = assertValidMeletiId(meletiId);
    if (!idCheck.ok) return Promise.resolve({ success: false, error: idCheck.error });
    return enqueueMutation(idCheck.id, () => deleteFileInner(idCheck.id, groupId, fileName));
  }

  function deleteFolderInner(meletiId, groupId, folderId) {
    const groupCheck = requireMeletiGroup(meletiId, groupId);
    if (!groupCheck.ok) return { success: false, error: groupCheck.error };
    const folderPath = resolveGroupPath(groupCheck.meletiId, groupId, folderId);
    if (fs.existsSync(folderPath)) fs.rmSync(folderPath, { recursive: true, force: true });

    const updatedGroups = (groupCheck.meleti.fileGroups || []).map((g) => {
      if (g.id !== groupId) return g;
      return { ...g, files: (g.files || []).filter((f) => !(f.kind === 'folder' && f.id === folderId)) };
    });
    const toSave = { ...groupCheck.meleti, fileGroups: updatedGroups, updatedAt: new Date().toISOString() };
    safeWriteJSON(getMeletiDataPath(groupCheck.meletiId), toSave);
    return { success: true, meleti: toSave };
  }

  function deleteFolder(meletiId, groupId, folderId) {
    const idCheck = assertValidMeletiId(meletiId);
    if (!idCheck.ok) return Promise.resolve({ success: false, error: idCheck.error });
    return enqueueMutation(idCheck.id, () => deleteFolderInner(idCheck.id, groupId, folderId));
  }

  function deleteFolderFileInner(meletiId, groupId, folderId, fileName) {
    const groupCheck = requireMeletiGroup(meletiId, groupId);
    if (!groupCheck.ok) return { success: false, error: groupCheck.error };
    let relParts;
    try {
      relParts = splitSafeRelativeParts(fileName);
    } catch (e) {
      return { success: false, error: e.message };
    }
    const filePath = resolveGroupPath(groupCheck.meletiId, groupId, folderId, ...relParts);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    const folderPath = resolveGroupPath(groupCheck.meletiId, groupId, folderId);
    const { fileCount: remaining, totalSize } = fs.existsSync(folderPath)
      ? folderStatsRecursive(folderPath)
      : { fileCount: 0, totalSize: 0 };

    let updatedGroups;
    if (remaining === 0) {
      if (fs.existsSync(folderPath)) fs.rmSync(folderPath, { recursive: true, force: true });
      updatedGroups = (groupCheck.meleti.fileGroups || []).map((g) => {
        if (g.id !== groupId) return g;
        return { ...g, files: (g.files || []).filter((f) => !(f.kind === 'folder' && f.id === folderId)) };
      });
    } else {
      updatedGroups = (groupCheck.meleti.fileGroups || []).map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          files: (g.files || []).map((f) => (
            f.kind === 'folder' && f.id === folderId
              ? { ...f, fileCount: remaining, size: totalSize }
              : f
          )),
        };
      });
    }
    const toSave = { ...groupCheck.meleti, fileGroups: updatedGroups, updatedAt: new Date().toISOString() };
    safeWriteJSON(getMeletiDataPath(groupCheck.meletiId), toSave);
    return { success: true, meleti: toSave, removedFolder: remaining === 0 };
  }

  function deleteFolderFile(meletiId, groupId, folderId, fileName) {
    const idCheck = assertValidMeletiId(meletiId);
    if (!idCheck.ok) return Promise.resolve({ success: false, error: idCheck.error });
    return enqueueMutation(idCheck.id, () => deleteFolderFileInner(idCheck.id, groupId, folderId, fileName));
  }

  function renameFileInner(meletiId, groupId, oldName, newName, folderId = null) {
    const groupCheck = requireMeletiGroup(meletiId, groupId);
    if (!groupCheck.ok) return { success: false, error: groupCheck.error };

    if (folderId) {
      let oldParts;
      let newParts;
      try {
        oldParts = splitSafeRelativeParts(oldName);
        newParts = splitSafeRelativeParts(newName);
      } catch (e) {
        return { success: false, error: e.message };
      }
      if (newParts.length !== oldParts.length) {
        return { success: false, error: 'Η μετονομασία δεν επιτρέπει αλλαγή δομής φακέλου' };
      }
      const parentParts = oldParts.slice(0, -1);
      const newBase = newParts[newParts.length - 1];
      const newRelParts = [...parentParts, newBase];
      const oldPath = resolveGroupPath(groupCheck.meletiId, groupId, folderId, ...oldParts);
      const newPath = resolveGroupPath(groupCheck.meletiId, groupId, folderId, ...newRelParts);
      if (!fs.existsSync(oldPath)) return { success: false, error: 'Το αρχείο δεν βρέθηκε' };
      if (fs.existsSync(newPath) && oldPath !== newPath) {
        return { success: false, error: 'Υπάρχει ήδη αρχείο με αυτό το όνομα' };
      }
      const newParent = path.dirname(newPath);
      if (!fs.existsSync(newParent)) fs.mkdirSync(newParent, { recursive: true });
      fs.renameSync(oldPath, newPath);

      const folderPath = resolveGroupPath(groupCheck.meletiId, groupId, folderId);
      const { fileCount, totalSize } = folderStatsRecursive(folderPath);
      const updatedGroups = (groupCheck.meleti.fileGroups || []).map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          files: (g.files || []).map((f) => (
            f.kind === 'folder' && f.id === folderId
              ? { ...f, fileCount, size: totalSize }
              : f
          )),
        };
      });
      const toSave = { ...groupCheck.meleti, fileGroups: updatedGroups, updatedAt: new Date().toISOString() };
      safeWriteJSON(getMeletiDataPath(groupCheck.meletiId), toSave);
      return { success: true, meleti: toSave };
    }

    const safeNew = path.basename(String(newName || '').trim());
    if (!safeNew) return { success: false, error: 'Μη έγκυρο όνομα αρχείου' };

    const oldPath = resolveGroupPath(groupCheck.meletiId, groupId, oldName);
    const newPath = resolveGroupPath(groupCheck.meletiId, groupId, safeNew);
    if (!fs.existsSync(oldPath)) return { success: false, error: 'Το αρχείο δεν βρέθηκε' };
    if (fs.existsSync(newPath) && oldPath !== newPath) {
      return { success: false, error: 'Υπάρχει ήδη αρχείο με αυτό το όνομα' };
    }
    fs.renameSync(oldPath, newPath);

    const updatedGroups = (groupCheck.meleti.fileGroups || []).map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        files: (g.files || []).map((f) => (
          f.kind !== 'folder' && f.name === oldName ? { ...f, name: safeNew } : f
        )),
      };
    });
    const toSave = { ...groupCheck.meleti, fileGroups: updatedGroups, updatedAt: new Date().toISOString() };
    safeWriteJSON(getMeletiDataPath(groupCheck.meletiId), toSave);
    return { success: true, meleti: toSave };
  }

  function renameFile(meletiId, groupId, oldName, newName, folderId = null) {
    const idCheck = assertValidMeletiId(meletiId);
    if (!idCheck.ok) return Promise.resolve({ success: false, error: idCheck.error });
    return enqueueMutation(idCheck.id, () => renameFileInner(idCheck.id, groupId, oldName, newName, folderId));
  }

  function deleteGroupInner(meletiId, groupId) {
    const groupCheck = requireMeletiGroup(meletiId, groupId);
    if (!groupCheck.ok) return { success: false, error: groupCheck.error };
    const groupDir = resolveGroupPath(groupCheck.meletiId, groupId);
    if (fs.existsSync(groupDir)) fs.rmSync(groupDir, { recursive: true, force: true });

    const updatedGroups = (groupCheck.meleti.fileGroups || []).filter((g) => g.id !== groupId);
    const toSave = { ...groupCheck.meleti, fileGroups: updatedGroups, updatedAt: new Date().toISOString() };
    safeWriteJSON(getMeletiDataPath(groupCheck.meletiId), toSave);
    return { success: true, meleti: toSave };
  }

  function deleteGroup(meletiId, groupId) {
    const idCheck = assertValidMeletiId(meletiId);
    if (!idCheck.ok) return Promise.resolve({ success: false, error: idCheck.error });
    return enqueueMutation(idCheck.id, () => deleteGroupInner(idCheck.id, groupId));
  }

  function listFolderFilesRecursive(folderPath, relativePrefix = '') {
    const rows = [];
    if (!fs.existsSync(folderPath)) return rows;
    let entries;
    try {
      entries = fs.readdirSync(folderPath, { withFileTypes: true });
    } catch {
      return rows;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(folderPath, entry.name);
      const rel = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
      try {
        if (entry.isDirectory()) {
          rows.push(...listFolderFilesRecursive(full, rel));
        } else if (entry.isFile()) {
          rows.push(rel);
        }
      } catch {
        /* skip */
      }
    }
    return rows;
  }

  function buildFileInventory(meletiId) {
    const idCheck = assertValidMeletiId(meletiId);
    if (!idCheck.ok) return { success: false, error: idCheck.error };
    const meleti = loadMeleti(idCheck.id);
    if (!meleti) return { success: false, error: 'Η μελέτη δεν βρέθηκε' };

    const rows = [];
    for (const group of meleti.fileGroups || []) {
      const groupLabel = group.label || group.title || 'Ομάδα';
      for (const entry of group.files || []) {
        if (entry?.kind === 'folder') {
          const folderName = entry.name || 'Φάκελος';
          const folderPath = resolveGroupPath(idCheck.id, group.id, entry.id);
          const names = listFolderFilesRecursive(folderPath);
          if (names.length === 0) {
            rows.push({
              category: groupLabel,
              entryType: 'Φάκελος (κενός)',
              container: folderName,
              fileName: '—',
            });
          } else {
            names.forEach((fileName) => {
              rows.push({
                category: groupLabel,
                entryType: 'Αρχείο σε φάκελο',
                container: folderName,
                fileName,
              });
            });
          }
        } else {
          rows.push({
            category: groupLabel,
            entryType: 'Αρχείο',
            container: '—',
            fileName: entry.name || entry.fileName || '—',
          });
        }
      }
    }
    return { success: true, rows, meleti };
  }

  function getFolderFiles(meletiId, groupId, folderId) {
    const groupCheck = requireMeletiGroup(meletiId, groupId);
    if (!groupCheck.ok) return { success: false, error: groupCheck.error };
    const folderPath = resolveGroupPath(groupCheck.meletiId, groupId, folderId);
    if (!fs.existsSync(folderPath)) return { success: true, files: [] };
    const relNames = listFolderFilesRecursive(folderPath);
    const files = relNames.map((rel) => {
      const fp = path.join(folderPath, ...rel.split('/'));
      const st = fs.statSync(fp);
      return { name: rel, size: st.size, uploadedAt: st.mtime.toISOString() };
    });
    return { success: true, files };
  }

  function getFilePath(meletiId, groupId, fileName, folderId) {
    const idCheck = assertValidMeletiId(meletiId);
    if (!idCheck.ok) return { success: false, error: idCheck.error };
    let relParts;
    try {
      relParts = splitSafeRelativeParts(fileName);
    } catch (e) {
      return { success: false, error: e.message };
    }
    const fp = folderId
      ? resolveGroupPath(idCheck.id, groupId, folderId, ...relParts)
      : resolveGroupPath(idCheck.id, groupId, ...relParts);
    if (!fs.existsSync(fp)) return { success: false, error: 'Το αρχείο δεν βρέθηκε' };
    return { success: true, filePath: fp };
  }

  function listAllSubprojectsBrief() {
    const list = [];
    if (!dataDir || !fs.existsSync(dataDir)) return list;
    for (const dir of fs.readdirSync(dataDir)) {
      if (DATA_DIR_SKIP_ROOT_DIRS.has(dir)) continue;
      const projectPath = path.join(dataDir, dir);
      try {
        if (!fs.statSync(projectPath).isDirectory()) continue;
        for (const sub of fs.readdirSync(projectPath)) {
          const jsonPath = path.join(projectPath, sub, 'data.json');
          if (!fs.existsSync(jsonPath)) continue;
          try {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            if (data.subprojectId && data.subprojectTitle && data.projectTitle) {
              list.push({
                subprojectId: data.subprojectId,
                subprojectTitle: data.subprojectTitle,
                projectTitle: data.projectTitle,
                projectId: data.projectId,
              });
            }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }
    return list;
  }

  function collectSubprojectIds() {
    const ids = new Set();
    for (const sp of listAllSubprojectsBrief()) {
      if (sp.subprojectId) ids.add(sp.subprojectId);
    }
    return ids;
  }

  function runMeletaiMaintenance() {
    const migration = migrateStudyNumbersAndResolveDuplicates();
    const cleared = reconcileOrphanSubprojectLinks();
    invalidateStudyNumberCache();
    return { migration, cleared };
  }

  function reconcileOrphanSubprojectLinks() {
    const validIds = collectSubprojectIds();
    const clearedItems = [];
    for (const meleti of loadAllMeletai()) {
      const sid = meleti.linkedSubprojectId;
      if (!sid || validIds.has(sid)) continue;
      const previous = { ...meleti };
      const toSave = {
        ...meleti,
        linkedSubprojectId: null,
        linkedProjectTitle: '',
        linkedSubprojectTitle: '',
        linkOrphanClearedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      safeWriteJSON(getMeletiDataPath(meleti.id), toSave);
      clearedItems.push({ previous, meleti: toSave });
    }
    return clearedItems;
  }

  function clearStudyCategoryFromAllMeletai(label) {
    const trimmed = String(label || '').trim();
    if (!trimmed) return { updated: 0 };
    let updated = 0;
    for (const meleti of loadAllMeletai()) {
      if (meleti.category !== trimmed) continue;
      const toSave = { ...meleti, category: '', updatedAt: new Date().toISOString() };
      safeWriteJSON(getMeletiDataPath(meleti.id), toSave);
      updated += 1;
    }
    return { updated };
  }

  function unlinkStudiesForSubproject(subprojectId) {
    const sid = String(subprojectId || '').trim();
    if (!sid) return { success: true, unlinked: 0 };
    const meleti = findMeletiBySubprojectId(sid);
    if (!meleti) return { success: true, unlinked: 0 };
    const result = unlinkSubprojectInner(meleti.id);
    return {
      ...result,
      unlinked: result.success ? 1 : 0,
      meletiId: meleti.id,
      previous: result.previous || meleti,
    };
  }

  function findNextAvailableStudyNumber(year, excludeId) {
    const used = new Set();
    for (const m of loadAllMeletai()) {
      const fmt = validateStudyNumberFormat(m.studyNumber);
      if (!fmt.ok) continue;
      const parts = fmt.studyNumber.split('/');
      if (parseInt(parts[1], 10) !== year) continue;
      if (m.id === excludeId) continue;
      used.add(parseInt(parts[0], 10));
    }
    let n = 1;
    while (used.has(n)) n += 1;
    return `${n}/${year}`;
  }

  function migrateStudyNumbersAndResolveDuplicates() {
    ensureMeletaiDir();
    let formatFixed = 0;
    let duplicatesResolved = 0;

    for (const entry of fs.readdirSync(getMeletaiDir(), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const meleti = loadMeleti(entry.name);
      if (!meleti) continue;
      const fmt = validateStudyNumberFormat(meleti.studyNumber);
      if (fmt.ok && meleti.studyNumber !== fmt.studyNumber) {
        const toSave = { ...meleti, studyNumber: fmt.studyNumber, updatedAt: new Date().toISOString() };
        safeWriteJSON(getMeletiDataPath(meleti.id), toSave);
        formatFixed += 1;
      }
    }

    const all = loadAllMeletai();
    const groups = new Map();
    for (const m of all) {
      const key = normalizeStudyNumberKey(m.studyNumber);
      if (!key || !validateStudyNumberFormat(m.studyNumber).ok) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    }

    for (const [, items] of groups) {
      if (items.length <= 1) continue;
      items.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
      for (let i = 1; i < items.length; i += 1) {
        const dup = items[i];
        const year = parseInt(String(dup.studyNumber).split('/')[1], 10);
        const newNum = findNextAvailableStudyNumber(year, dup.id);
        const toSave = { ...dup, studyNumber: newNum, updatedAt: new Date().toISOString() };
        safeWriteJSON(getMeletiDataPath(dup.id), toSave);
        duplicatesResolved += 1;
      }
    }

    const invalidGroups = new Map();
    for (const m of loadAllMeletai()) {
      if (validateStudyNumberFormat(m.studyNumber).ok) continue;
      const key = normalizeStudyNumberKey(m.studyNumber);
      if (!key) continue;
      if (!invalidGroups.has(key)) invalidGroups.set(key, []);
      invalidGroups.get(key).push(m);
    }
    for (const [, items] of invalidGroups) {
      if (items.length <= 1) continue;
      items.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
      for (let i = 1; i < items.length; i += 1) {
        const dup = items[i];
        const yearFromCreated = dup.createdAt ? new Date(dup.createdAt).getFullYear() : new Date().getFullYear();
        const newNum = findNextAvailableStudyNumber(yearFromCreated, dup.id);
        const toSave = { ...dup, studyNumber: newNum, updatedAt: new Date().toISOString() };
        safeWriteJSON(getMeletiDataPath(dup.id), toSave);
        duplicatesResolved += 1;
      }
    }

    invalidateStudyNumberCache();
    return { formatFixed, duplicatesResolved };
  }

  function syncLinkedTitlesForSubproject(subprojectId, { projectTitle, subprojectTitle } = {}) {
    const sid = String(subprojectId || '').trim();
    if (!sid) return 0;
    ensureMeletaiDir();
    let updated = 0;
    const pt = String(projectTitle || '').trim();
    const st = String(subprojectTitle || '').trim();
    for (const meleti of loadAllMeletai()) {
      if (meleti.linkedSubprojectId !== sid) continue;
      const toSave = {
        ...meleti,
        linkedProjectTitle: pt,
        linkedSubprojectTitle: st,
        updatedAt: new Date().toISOString(),
      };
      safeWriteJSON(getMeletiDataPath(meleti.id), toSave);
      updated += 1;
    }
    return updated;
  }

  function pickAuditSnapshot(meleti) {
    if (!meleti) return {};
    const fileGroups = meleti.fileGroups || [];
    let fileEntries = 0;
    fileGroups.forEach((g) => { fileEntries += (g.files || []).length; });
    return {
      studyNumber: meleti.studyNumber || '',
      title: meleti.title || '',
      assignedTo: meleti.assignedTo || '',
      category: meleti.category || '',
      notes: meleti.notes || '',
      linkedSubprojectId: meleti.linkedSubprojectId || '',
      linkedSubprojectTitle: meleti.linkedSubprojectTitle || '',
      fileCategories: fileGroups.length,
      fileEntries,
    };
  }

  return {
    MELETAI_DIR_NAME,
    DEFAULT_FILES_GROUP_LABEL,
    normalizeStudyNumber,
    getMeletaiDir,
    loadAllMeletai,
    loadMeleti,
    saveMeleti,
    deleteMeleti,
    checkStudyNumberAvailable,
    findMeletiBySubprojectId,
    getMeletiBySubprojectId,
    linkSubproject,
    unlinkSubproject,
    addFileGroup,
    uploadFiles,
    uploadFolder,
    deleteFile,
    deleteFolder,
    deleteFolderFile,
    renameFile,
    deleteGroup,
    getFolderFiles,
    buildFileInventory,
    getFilePath,
    assertValidMeletiId,
    pickAuditSnapshot,
    resolveGroupPath,
    reconcileOrphanSubprojectLinks,
    clearStudyCategoryFromAllMeletai,
    unlinkStudiesForSubproject,
    migrateStudyNumbersAndResolveDuplicates,
    runMeletaiMaintenance,
    listAllSubprojectsBrief,
    syncLinkedTitlesForSubproject,
    validateStudyNumberFormat,
  };
}

module.exports = {
  MELETAI_DIR_NAME,
  DEFAULT_FILES_GROUP_LABEL,
  DATA_DIR_SKIP_ROOT_DIRS,
  createMeletaiService,
};

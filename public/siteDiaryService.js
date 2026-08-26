/**
 * siteDiaryService.js — Ημερολόγιο Εργοταξίου
 *
 * Δομή στον δίσκο:
 *   dataDir/ΗΜΕΡΟΛΟΓΙΟ ΕΡΓΟΤΑΞΙΟΥ/<subprojectId>/data.json
 *   dataDir/ΗΜΕΡΟΛΟΓΙΟ ΕΡΓΟΤΑΞΙΟΥ/<subprojectId>/ΦΩΤΟΓΡΑΦΙΕΣ/<entryId>/<αρχείο>
 *
 * Οι φωτογραφίες μένουν σε δικό τους χώρο και δεν ανακατεύονται με τα
 * «Αρχεία Υποέργου».
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { safeWriteJSON } = require('./safeWrite');
const siteDiary = require('../app/core/siteDiary');
const { ingestImageToDir, ensurePreviewThumb } = require('./apologismosMediaIngest');

const SITE_DIARY_DIR_NAME = siteDiary.SITE_DIARY_DIR_NAME;
const PHOTOS_DIR_NAME = 'ΦΩΤΟΓΡΑΦΙΕΣ';

/** Αποθηκευμένη φωτογραφία — αρκετά μεγάλη για μεγέθυνση, χωρίς βάρος κινητού. */
const PHOTO_INGEST_MAX_DIMENSION = 2000;
const PHOTO_INGEST_QUALITY = 82;

/**
 * Προεπισκοπήσεις οθόνης. Η μικρογραφία στο χρονολόγιο είναι ~104×78 σημεία·
 * τα 360 pixel φτάνουν και με το παραπάνω και κρατούν ελαφρύ το φόρτωμα.
 */
const THUMB_MAX_DIMENSION = 360;
const THUMB_QUALITY = 70;
const FULL_MAX_DIMENSION = 1600;
const FULL_QUALITY = 82;

const MAX_PHOTOS_PER_ENTRY = 20;

const SAFE_ID_RE = /^[A-Za-z0-9_-]{4,64}$/;
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i;

function isImageFileName(name) {
  return IMAGE_EXT_RE.test(String(name || ''));
}

function mimeForExt(ext) {
  switch (String(ext || '').toLowerCase()) {
    case '.png': return 'image/png';
    case '.webp': return 'image/webp';
    case '.gif': return 'image/gif';
    case '.bmp': return 'image/bmp';
    default: return 'image/jpeg';
  }
}

/**
 * Ασύγχρονη ανάγνωση: με σύγχρονη, το διάβασμα δεκάδων φωτογραφιών κρατούσε
 * απασχολημένο το κύριο νήμα και η εφαρμογή έδειχνε «κολλημένη».
 */
async function fileToDataUrl(absolutePath) {
  if (!absolutePath) return null;
  try {
    const buf = await fs.promises.readFile(absolutePath);
    return `data:${mimeForExt(path.extname(absolutePath))};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

function resolveUploadFileRef(file) {
  if (!file) return null;
  if (typeof file === 'string') {
    return fs.existsSync(file) ? { path: file, name: path.basename(file) } : null;
  }
  const sourcePath = file.filePath || file.path;
  if (!sourcePath || !fs.existsSync(sourcePath)) return null;
  return {
    path: sourcePath,
    name: file.fileName || file.name || path.basename(sourcePath),
  };
}

function createSiteDiaryService({ dataDir }) {
  const mutationQueues = new Map();

  function getDiaryRoot() {
    return path.join(dataDir, SITE_DIARY_DIR_NAME);
  }

  function ensureDiaryRoot() {
    const dir = getDiaryRoot();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  function assertSafeId(value, label) {
    const id = String(value || '').trim();
    if (!SAFE_ID_RE.test(id)) {
      return { ok: false, error: `Μη έγκυρο αναγνωριστικό ${label}` };
    }
    return { ok: true, id };
  }

  function getSubprojectDir(subprojectId) {
    return path.join(getDiaryRoot(), subprojectId);
  }

  function getSubprojectDataPath(subprojectId) {
    return path.join(getSubprojectDir(subprojectId), 'data.json');
  }

  function getEntryPhotosDir(subprojectId, entryId) {
    return path.join(getSubprojectDir(subprojectId), PHOTOS_DIR_NAME, entryId);
  }

  /** Κάθε path που φτιάχνουμε πρέπει να μένει μέσα στον φάκελο του ημερολογίου. */
  function assertInsideRoot(targetPath) {
    const resolved = path.resolve(targetPath);
    const root = path.resolve(getDiaryRoot());
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      return { ok: false, error: 'Μη επιτρεπτό path ημερολογίου' };
    }
    return { ok: true, resolved };
  }

  function enqueueMutation(subprojectId, fn) {
    const key = String(subprojectId || '').trim() || '__none__';
    const prev = mutationQueues.get(key) || Promise.resolve();
    const run = prev.then(() => Promise.resolve().then(fn));
    mutationQueues.set(key, run.catch((err) => {
      console.error('[siteDiary] mutation failed:', err?.message || err);
    }));
    return run;
  }

  function emptyDiary(subprojectId, meta = {}) {
    const now = new Date().toISOString();
    return {
      subprojectId,
      projectId: String(meta.projectId || '').trim(),
      projectTitle: String(meta.projectTitle || '').trim(),
      subprojectTitle: String(meta.subprojectTitle || '').trim(),
      entries: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  function readDiaryFile(subprojectId) {
    const dataPath = getSubprojectDataPath(subprojectId);
    if (!fs.existsSync(dataPath)) return null;
    try {
      const parsed = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      if (!parsed || typeof parsed !== 'object') return null;
      return { ...parsed, entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
    } catch {
      return null;
    }
  }

  function loadSubprojectDiary(subprojectId) {
    const idCheck = assertSafeId(subprojectId, 'υποέργου');
    if (!idCheck.ok) return { success: false, error: idCheck.error };
    const pathCheck = assertInsideRoot(getSubprojectDir(idCheck.id));
    if (!pathCheck.ok) return { success: false, error: pathCheck.error };
    const diary = readDiaryFile(idCheck.id);
    return {
      success: true,
      diary: diary || emptyDiary(idCheck.id),
      exists: !!diary,
    };
  }

  function loadAllDiaries() {
    const root = ensureDiaryRoot();
    const list = [];
    let entries;
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      return list;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!SAFE_ID_RE.test(entry.name)) continue;
      const diary = readDiaryFile(entry.name);
      if (diary) list.push(diary);
    }
    return list;
  }

  /** Ελαφρύ: μόνο πλήθος εγγραφών ανά υποέργο, για τα κουμπιά των καρτών. */
  function getEntryCountsBySubproject() {
    const counts = {};
    for (const diary of loadAllDiaries()) {
      const sid = String(diary.subprojectId || '').trim();
      if (sid) counts[sid] = (diary.entries || []).length;
    }
    return counts;
  }

  function writeDiary(subprojectId, diary) {
    const dir = getSubprojectDir(subprojectId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const toSave = { ...diary, updatedAt: new Date().toISOString() };
    safeWriteJSON(getSubprojectDataPath(subprojectId), toSave);
    return toSave;
  }

  function findEntry(diary, entryId) {
    return (diary.entries || []).find((e) => e && e.id === entryId) || null;
  }

  function addEntryInner({ subprojectId, subprojectMeta, draft, author }) {
    const validation = siteDiary.validateEntry(draft);
    if (!validation.ok) return { success: false, error: validation.error, field: validation.field };

    const existing = readDiaryFile(subprojectId) || emptyDiary(subprojectId, subprojectMeta);
    const now = new Date().toISOString();

    const entry = {
      id: uuidv4(),
      visitDate: validation.visitDate,
      visitTime: validation.visitTime,
      progress: validation.progress,
      notes: validation.notes,
      contractorOrder: validation.contractorOrder,
      photos: [],
      authorUsername: String((author && author.username) || '').trim(),
      authorFullName: String((author && author.fullName) || '').trim(),
      createdAt: now,
      updatedAt: now,
    };

    const meta = subprojectMeta || {};
    const merged = {
      ...existing,
      subprojectId,
      projectId: String(meta.projectId || existing.projectId || '').trim(),
      projectTitle: String(meta.projectTitle || existing.projectTitle || '').trim(),
      subprojectTitle: String(meta.subprojectTitle || existing.subprojectTitle || '').trim(),
      entries: [...(existing.entries || []), entry],
    };

    const saved = writeDiary(subprojectId, merged);
    return { success: true, diary: saved, entry };
  }

  function addEntry(input) {
    const idCheck = assertSafeId(input && input.subprojectId, 'υποέργου');
    if (!idCheck.ok) return Promise.resolve({ success: false, error: idCheck.error });
    const pathCheck = assertInsideRoot(getSubprojectDir(idCheck.id));
    if (!pathCheck.ok) return Promise.resolve({ success: false, error: pathCheck.error });
    return enqueueMutation(idCheck.id, () => addEntryInner({ ...input, subprojectId: idCheck.id }));
  }

  function updateEntryInner({ subprojectId, entryId, draft }) {
    const diary = readDiaryFile(subprojectId);
    if (!diary) return { success: false, error: 'Το ημερολόγιο δεν βρέθηκε' };
    const previous = findEntry(diary, entryId);
    if (!previous) return { success: false, error: 'Η εγγραφή δεν βρέθηκε' };

    const validation = siteDiary.validateEntry(draft);
    if (!validation.ok) return { success: false, error: validation.error, field: validation.field };

    const updated = {
      ...previous,
      visitDate: validation.visitDate,
      visitTime: validation.visitTime,
      progress: validation.progress,
      notes: validation.notes,
      contractorOrder: validation.contractorOrder,
      updatedAt: new Date().toISOString(),
    };

    const saved = writeDiary(subprojectId, {
      ...diary,
      entries: (diary.entries || []).map((e) => (e && e.id === entryId ? updated : e)),
    });
    return { success: true, diary: saved, entry: updated, previous };
  }

  function updateEntry(input) {
    const idCheck = assertSafeId(input && input.subprojectId, 'υποέργου');
    if (!idCheck.ok) return Promise.resolve({ success: false, error: idCheck.error });
    const entryCheck = assertSafeId(input && input.entryId, 'εγγραφής');
    if (!entryCheck.ok) return Promise.resolve({ success: false, error: entryCheck.error });
    return enqueueMutation(idCheck.id, () => updateEntryInner({
      ...input,
      subprojectId: idCheck.id,
      entryId: entryCheck.id,
    }));
  }

  function deleteEntryInner({ subprojectId, entryId }) {
    const diary = readDiaryFile(subprojectId);
    if (!diary) return { success: false, error: 'Το ημερολόγιο δεν βρέθηκε' };
    const previous = findEntry(diary, entryId);
    if (!previous) return { success: false, error: 'Η εγγραφή δεν βρέθηκε' };

    const photosDir = getEntryPhotosDir(subprojectId, entryId);
    const pathCheck = assertInsideRoot(photosDir);
    if (pathCheck.ok && fs.existsSync(pathCheck.resolved)) {
      try { fs.rmSync(pathCheck.resolved, { recursive: true, force: true }); } catch { /* ignore */ }
    }

    const saved = writeDiary(subprojectId, {
      ...diary,
      entries: (diary.entries || []).filter((e) => !(e && e.id === entryId)),
    });
    return { success: true, diary: saved, previous };
  }

  function deleteEntry(input) {
    const idCheck = assertSafeId(input && input.subprojectId, 'υποέργου');
    if (!idCheck.ok) return Promise.resolve({ success: false, error: idCheck.error });
    const entryCheck = assertSafeId(input && input.entryId, 'εγγραφής');
    if (!entryCheck.ok) return Promise.resolve({ success: false, error: entryCheck.error });
    return enqueueMutation(idCheck.id, () => deleteEntryInner({
      subprojectId: idCheck.id,
      entryId: entryCheck.id,
    }));
  }

  async function addEntryPhotosInner({ subprojectId, entryId, files }) {
    const diary = readDiaryFile(subprojectId);
    if (!diary) return { success: false, error: 'Το ημερολόγιο δεν βρέθηκε' };
    const entry = findEntry(diary, entryId);
    if (!entry) return { success: false, error: 'Η εγγραφή δεν βρέθηκε' };

    const already = (entry.photos || []).length;
    if (already >= MAX_PHOTOS_PER_ENTRY) {
      return { success: false, error: `Έχετε ήδη ${MAX_PHOTOS_PER_ENTRY} φωτογραφίες σε αυτή την επίσκεψη` };
    }

    const photosDir = getEntryPhotosDir(subprojectId, entryId);
    const pathCheck = assertInsideRoot(photosDir);
    if (!pathCheck.ok) return { success: false, error: pathCheck.error };
    if (!fs.existsSync(pathCheck.resolved)) fs.mkdirSync(pathCheck.resolved, { recursive: true });

    const saved = [];
    let skipped = 0;
    const room = MAX_PHOTOS_PER_ENTRY - already;

    for (const file of (files || []).slice(0, room)) {
      const ref = resolveUploadFileRef(file);
      if (!ref || !isImageFileName(ref.name)) {
        skipped += 1;
        continue;
      }
      try {
        const result = await ingestImageToDir(
          ref.path,
          pathCheck.resolved,
          `${Date.now()}_${uuidv4().slice(0, 8)}_`,
          ref.name,
          { maxDimension: PHOTO_INGEST_MAX_DIMENSION, quality: PHOTO_INGEST_QUALITY }
        );
        saved.push({
          name: result.destName,
          originalName: path.basename(ref.name),
          size: result.bytesWritten,
          addedAt: new Date().toISOString(),
        });
      } catch {
        skipped += 1;
      }
    }

    if ((files || []).length > room) skipped += (files || []).length - room;

    if (!saved.length) {
      return { success: false, error: 'Δεν προστέθηκε καμία φωτογραφία', skipped };
    }

    // Ξαναδιαβάζουμε πριν το γράψιμο: μπορεί άλλος να άλλαξε το ημερολόγιο ενδιάμεσα.
    const fresh = readDiaryFile(subprojectId) || diary;
    const freshEntry = findEntry(fresh, entryId);
    if (!freshEntry) {
      saved.forEach((p) => {
        try { fs.unlinkSync(path.join(pathCheck.resolved, p.name)); } catch { /* ignore */ }
      });
      return { success: false, error: 'Η εγγραφή διαγράφηκε στο μεταξύ' };
    }

    const updatedEntry = { ...freshEntry, photos: [...(freshEntry.photos || []), ...saved], updatedAt: new Date().toISOString() };
    const savedDiary = writeDiary(subprojectId, {
      ...fresh,
      entries: (fresh.entries || []).map((e) => (e && e.id === entryId ? updatedEntry : e)),
    });
    return { success: true, diary: savedDiary, entry: updatedEntry, photos: saved, skipped };
  }

  function addEntryPhotos(input) {
    const idCheck = assertSafeId(input && input.subprojectId, 'υποέργου');
    if (!idCheck.ok) return Promise.resolve({ success: false, error: idCheck.error });
    const entryCheck = assertSafeId(input && input.entryId, 'εγγραφής');
    if (!entryCheck.ok) return Promise.resolve({ success: false, error: entryCheck.error });
    if (!Array.isArray(input.files) || input.files.length === 0) {
      return Promise.resolve({ success: false, error: 'Δεν επιλέχθηκαν φωτογραφίες' });
    }
    return enqueueMutation(idCheck.id, () => addEntryPhotosInner({
      subprojectId: idCheck.id,
      entryId: entryCheck.id,
      files: input.files,
    }));
  }

  function resolvePhotoAbsolutePath(subprojectId, entryId, photoName) {
    const idCheck = assertSafeId(subprojectId, 'υποέργου');
    if (!idCheck.ok) return { ok: false, error: idCheck.error };
    const entryCheck = assertSafeId(entryId, 'εγγραφής');
    if (!entryCheck.ok) return { ok: false, error: entryCheck.error };
    const base = path.basename(String(photoName || '').trim());
    if (!base || base === '.' || base === '..') {
      return { ok: false, error: 'Μη έγκυρο όνομα φωτογραφίας' };
    }
    const target = path.join(getEntryPhotosDir(idCheck.id, entryCheck.id), base);
    const pathCheck = assertInsideRoot(target);
    if (!pathCheck.ok) return { ok: false, error: pathCheck.error };
    return { ok: true, absolutePath: pathCheck.resolved, name: base };
  }

  function deleteEntryPhotoInner({ subprojectId, entryId, photoName }) {
    const resolved = resolvePhotoAbsolutePath(subprojectId, entryId, photoName);
    if (!resolved.ok) return { success: false, error: resolved.error };

    const diary = readDiaryFile(subprojectId);
    if (!diary) return { success: false, error: 'Το ημερολόγιο δεν βρέθηκε' };
    const entry = findEntry(diary, entryId);
    if (!entry) return { success: false, error: 'Η εγγραφή δεν βρέθηκε' };

    // Σβήνουμε μόνο φωτογραφία που ανήκει όντως στην επίσκεψη — έτσι ένα λάθος ή
    // πειραγμένο όνομα δεν καταλήγει σε άσκοπη εγγραφή στον δίσκο.
    const listed = (entry.photos || []).some((p) => p && p.name === resolved.name);
    if (!listed) return { success: false, error: 'Η φωτογραφία δεν βρέθηκε στην επίσκεψη' };

    if (fs.existsSync(resolved.absolutePath)) {
      try { fs.unlinkSync(resolved.absolutePath); } catch { /* ignore */ }
    }

    const updatedEntry = {
      ...entry,
      photos: (entry.photos || []).filter((p) => p && p.name !== resolved.name),
      updatedAt: new Date().toISOString(),
    };
    const saved = writeDiary(subprojectId, {
      ...diary,
      entries: (diary.entries || []).map((e) => (e && e.id === entryId ? updatedEntry : e)),
    });
    return { success: true, diary: saved, entry: updatedEntry };
  }

  function deleteEntryPhoto(input) {
    const idCheck = assertSafeId(input && input.subprojectId, 'υποέργου');
    if (!idCheck.ok) return Promise.resolve({ success: false, error: idCheck.error });
    return enqueueMutation(idCheck.id, () => deleteEntryPhotoInner(input));
  }

  /**
   * Επιστρέφει εικόνες ως data URL για την οθόνη.
   * @param {{ subprojectId: string, entryId: string, name: string }[]} items
   * @param {'thumb'|'full'} variant
   */
  async function resolvePhotos(items, variant = 'thumb') {
    const root = ensureDiaryRoot();
    const isFull = variant === 'full';
    const opts = isFull
      ? { maxDimension: FULL_MAX_DIMENSION, quality: FULL_QUALITY }
      : { maxDimension: THUMB_MAX_DIMENSION, quality: THUMB_QUALITY };

    const map = {};
    const list = (items || []).slice(0, 400);
    const CONCURRENCY = 6;

    for (let i = 0; i < list.length; i += CONCURRENCY) {
      const chunk = list.slice(i, i + CONCURRENCY);
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(chunk.map(async (item) => {
        const resolved = resolvePhotoAbsolutePath(item?.subprojectId, item?.entryId, item?.name);
        if (!resolved.ok || !fs.existsSync(resolved.absolutePath)) return;
        const key = `${item.subprojectId}|${item.entryId}|${resolved.name}`;
        try {
          const preview = await ensurePreviewThumb(root, resolved.absolutePath, opts);
          const dataUrl = await fileToDataUrl(preview?.path || resolved.absolutePath);
          if (dataUrl) map[key] = dataUrl;
        } catch {
          const dataUrl = await fileToDataUrl(resolved.absolutePath);
          if (dataUrl) map[key] = dataUrl;
        }
      }));
    }
    return map;
  }

  function getPhotoPath(subprojectId, entryId, photoName) {
    const resolved = resolvePhotoAbsolutePath(subprojectId, entryId, photoName);
    if (!resolved.ok) return { success: false, error: resolved.error };
    if (!fs.existsSync(resolved.absolutePath)) {
      return { success: false, error: 'Η φωτογραφία δεν βρέθηκε' };
    }
    return { success: true, filePath: resolved.absolutePath };
  }

  /** Καθαρισμός όταν διαγράφεται ολόκληρο υποέργο. */
  function deleteSubprojectDiary(subprojectId) {
    const idCheck = assertSafeId(subprojectId, 'υποέργου');
    if (!idCheck.ok) return Promise.resolve({ success: false, error: idCheck.error });
    const pathCheck = assertInsideRoot(getSubprojectDir(idCheck.id));
    if (!pathCheck.ok) return Promise.resolve({ success: false, error: pathCheck.error });
    return enqueueMutation(idCheck.id, () => {
      if (fs.existsSync(pathCheck.resolved)) {
        fs.rmSync(pathCheck.resolved, { recursive: true, force: true });
      }
      return { success: true };
    });
  }

  function pickAuditSnapshot(entry) {
    if (!entry) return {};
    return {
      visitDate: entry.visitDate || '',
      visitTime: entry.visitTime || '',
      progress: entry.progress || '',
      notes: entry.notes || '',
      contractorOrder: entry.contractorOrder || '',
      photoCount: (entry.photos || []).length,
      authorFullName: entry.authorFullName || '',
    };
  }

  return {
    SITE_DIARY_DIR_NAME,
    PHOTOS_DIR_NAME,
    MAX_PHOTOS_PER_ENTRY,
    getDiaryRoot,
    loadSubprojectDiary,
    loadAllDiaries,
    getEntryCountsBySubproject,
    addEntry,
    updateEntry,
    deleteEntry,
    addEntryPhotos,
    deleteEntryPhoto,
    resolvePhotos,
    getPhotoPath,
    deleteSubprojectDiary,
    pickAuditSnapshot,
  };
}

module.exports = {
  SITE_DIARY_DIR_NAME,
  PHOTOS_DIR_NAME,
  createSiteDiaryService,
};

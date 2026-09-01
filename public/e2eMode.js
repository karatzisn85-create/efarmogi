/**
 * Απομονωμένη λειτουργία ελέγχων: προσωρινός φάκελος δεδομένων,
 * χωρίς δείκτη στον πραγματικό φάκελο του Δήμου.
 * Native διάλογοι και ΚΗΜΔΗΣ δεν ανοίγουν το πραγματικό σύστημα αρχείων / πύλη.
 */
function isE2EProcess() {
  const v = String(process.env.ERGOHUB_E2E || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

let queuedOpenFiles = null;
let queuedFolderPick = null;
let queuedSavePath = undefined; // undefined = δεν έχει οριστεί, null = ακύρωση, string = διαδρομή
let khmdhsByAdam = Object.create(null);
let khmdhsLive = false;

function queueE2EOpenFiles(filePaths) {
  queuedOpenFiles = Array.isArray(filePaths) ? filePaths.slice() : [];
}

function takeE2EOpenFiles() {
  if (!isE2EProcess() || queuedOpenFiles == null) return null;
  const next = queuedOpenFiles;
  queuedOpenFiles = null;
  return next;
}

function queueE2EFolderPick(payload) {
  queuedFolderPick = payload && typeof payload === 'object' ? payload : null;
}

function takeE2EFolderPick() {
  if (!isE2EProcess() || queuedFolderPick == null) return null;
  const next = queuedFolderPick;
  queuedFolderPick = null;
  return next;
}

function queueE2ESavePath(filePath) {
  queuedSavePath = filePath == null || filePath === '' ? null : String(filePath);
}

function takeE2ESavePath() {
  if (!isE2EProcess() || queuedSavePath === undefined) return undefined;
  const next = queuedSavePath;
  queuedSavePath = undefined;
  return next;
}

function queueE2EKhmdhsFixtures(byAdam) {
  khmdhsByAdam = byAdam && typeof byAdam === 'object' ? { ...byAdam } : Object.create(null);
}

function setE2EKhmdhsLive(enabled) {
  khmdhsLive = !!enabled;
}

function extractAdamFromRequest(url, options) {
  try {
    const body = options && options.body;
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    const fromBody = parsed && (parsed.referenceNumber || parsed.adam || parsed.ada);
    if (fromBody) return String(fromBody).trim().toUpperCase();
  } catch {
    /* σώμα χωρίς JSON */
  }
  const m = String(url || '').match(/(\d{2}[A-Z]{3,4}\d{9})/i);
  return m ? m[1].toUpperCase() : '';
}

function resolveE2EKhmdhsHttp(url, options) {
  if (!isE2EProcess()) return null;
  const adam = extractAdamFromRequest(url, options);
  if (adam && khmdhsByAdam[adam]) return khmdhsByAdam[adam];
  if (khmdhsLive) return { live: true };
  return {
    ok: false,
    status: 404,
    body: { message: 'E2E: δεν υπάρχει απάντηση ΚΗΜΔΗΣ' },
  };
}

function installE2EDialogHooks(dialog) {
  if (!isE2EProcess() || !dialog) return;
  const origOpen = dialog.showOpenDialog.bind(dialog);
  const origSave = dialog.showSaveDialog.bind(dialog);

  dialog.showOpenDialog = async function e2eShowOpenDialog(...args) {
    const queued = takeE2EOpenFiles();
    if (queued) {
      return { canceled: queued.length === 0, filePaths: queued };
    }
    return origOpen(...args);
  };

  dialog.showSaveDialog = async function e2eShowSaveDialog(...args) {
    const queued = takeE2ESavePath();
    if (queued !== undefined) {
      if (!queued) return { canceled: true };
      return { canceled: false, filePath: queued };
    }
    return origSave(...args);
  };
}

module.exports = {
  isE2EProcess,
  queueE2EOpenFiles,
  takeE2EOpenFiles,
  queueE2EFolderPick,
  takeE2EFolderPick,
  queueE2ESavePath,
  takeE2ESavePath,
  queueE2EKhmdhsFixtures,
  setE2EKhmdhsLive,
  resolveE2EKhmdhsHttp,
  installE2EDialogHooks,
};

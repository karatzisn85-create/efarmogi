/**
 * Φόρτωση και εγγραφή του φακέλου εξαγωγής υποέργου.
 * Τα ονόματα τα αποφασίζει το σχέδιο· εδώ αντιγράφονται μόνο αρχεία μέσα στα δεδομένα.
 */
const fs = require('fs');
const path = require('path');
const planCore = require('../app/core/subprojectFolderPlan');
const groupsCore = require('../app/core/prosklisiFileGroups');
const egkrisiCatalog = require('../app/core/egkrisiCatalog');
const prosklisiCatalog = require('../app/core/prosklisiCatalog');
const orimanthiChecklist = require('../app/core/orimanthiFileChecklist');

function isInside(child, parent) {
  if (!child || !parent) return false;
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function safeId(value) {
  const id = String(value || '').trim();
  if (!id || id.includes('..') || /[\\/]/.test(id)) return '';
  return id;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function looseNames(list) {
  const out = [];
  (Array.isArray(list) ? list : []).forEach((item) => {
    if (item == null || item === '') return;
    const raw = typeof item === 'string' ? item : (item.name || item.fileName || item.originalName || '');
    const name = path.basename(String(raw || ''));
    if (name) out.push(name);
  });
  return out;
}

function groupedFileNames(groups, into = new Set()) {
  (groups || []).forEach((group) => {
    if (!group) return;
    looseNames(group.files).forEach((name) => into.add(name.toLowerCase()));
    groupedFileNames(group.subgroups, into);
  });
  return into;
}

function withFilesShownInManager(project, filesDir) {
  const grouped = groupedFileNames(project && project.fileGroups);
  const known = new Set(looseNames(project && project.files).map((name) => name.toLowerCase()));
  const extra = [];
  const add = (name) => {
    const key = String(name || '').toLowerCase();
    if (!key.endsWith('.pdf') || grouped.has(key) || known.has(key)) return;
    known.add(key);
    extra.push(name);
  };
  const legacy = looseNames(project && project.subprojectFiles);
  if (legacy.length) {
    legacy.forEach(add);
  } else if (fs.existsSync(filesDir)) {
    fs.readdirSync(filesDir).forEach((name) => {
      const full = path.join(filesDir, name);
      try {
        if (!fs.statSync(full).isFile()) return;
      } catch {
        return;
      }
      add(name);
    });
  }
  if (!extra.length) return project;
  return { ...project, files: [...(project.files || []), ...extra] };
}

function listEntaxiDiskFiles(entaxiDir) {
  const filesDir = path.join(entaxiDir, 'ΑΡΧΕΙΑ_ΕΝΤΑΞΗΣ');
  if (!fs.existsSync(filesDir)) return [];
  return fs.readdirSync(filesDir).filter((name) => {
    if (!name || name.startsWith('.')) return false;
    try {
      return fs.statSync(path.join(filesDir, name)).isFile();
    } catch {
      return false;
    }
  });
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function basenameList(list) {
  const out = [];
  const arr = Array.isArray(list) ? list : (list ? [list] : []);
  arr.forEach((item) => {
    if (item == null || item === '') return;
    if (typeof item === 'string') {
      const name = path.basename(item);
      if (name) out.push(name);
      return;
    }
    const name = path.basename(String(item.fileName || item.name || item.originalName || ''));
    if (name) out.push(name);
  });
  return out;
}

function findFileByName(rootDir, fileName) {
  const wanted = path.basename(String(fileName || ''));
  if (!wanted || !fs.existsSync(rootDir)) return null;
  const direct = path.join(rootDir, wanted);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile() && isInside(direct, rootDir)) return direct;
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    let items = [];
    try { items = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
    for (const item of items) {
      const next = path.join(current, item.name);
      if (!isInside(next, rootDir)) continue;
      if (item.isDirectory()) stack.push(next);
      else if (item.isFile() && item.name === wanted) return next;
    }
  }
  return null;
}

function collectOrimanthiFiles(dataDir, prosklisi) {
  const links = prosklisiCatalog.normalizeLinkedOrimanthiProposals(prosklisi && prosklisi.linkedOrimanthiProposals);
  const out = [];
  links.forEach((link) => {
    const id = safeId(link && link.id);
    if (!id) return;
    const proposalDir = path.join(dataDir, 'ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ', id);
    const dataPath = path.join(proposalDir, 'data.json');
    if (!isInside(dataPath, dataDir) || !fs.existsSync(dataPath)) return;
    const proposal = readJson(dataPath);
    if (!proposal) return;
    (proposal.fileGroups || []).forEach((group) => {
      if (!orimanthiChecklist.isProsklisiLinkableGroup(group)) return;
      const info = orimanthiChecklist.getGroupCategoryInfo(group);
      (group.files || []).forEach((entry) => {
        if (!entry || entry.kind === 'folder') return;
        const sent = Array.isArray(entry.sentToProskliseis) ? entry.sentToProskliseis : [];
        if (!sent.includes(prosklisi.prosklisiId)) return;
        const fileName = path.basename(String(entry.name || entry.fileName || ''));
        const groupId = path.basename(String(group.id || ''));
        if (!fileName || !groupId || groupId === '.' || groupId === '..') return;
        const sourcePath = path.join(proposalDir, 'files', groupId, fileName);
        if (!isInside(sourcePath, dataDir)) return;
        out.push({
          fileName,
          originalName: entry.originalName || fileName,
          categoryLabel: info.rootLabel,
          subtitle: info.spec,
          sourceProposalTitle: proposal.title || link.title || '',
          sourceProposalId: id,
          sourcePath,
        });
      });
    });
  });
  return out;
}

function loadEgkrisiRows(dataDir, subprojectId) {
  const linksDir = path.join(dataDir, 'egkriseis_links');
  const links = [];
  if (fs.existsSync(linksDir)) {
    fs.readdirSync(linksDir).forEach((file) => {
      if (!file.endsWith('.json')) return;
      const link = readJson(path.join(linksDir, file));
      if (link && String(link.subprojectId || '') === String(subprojectId || '')) links.push(link);
    });
  }
  const dataPath = path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ', 'egkriseis-data.json');
  const data = fs.existsSync(dataPath) ? readJson(dataPath) : null;
  const projects = (data && data.projects) || {};
  const rows = [];
  const seen = {};
  links.forEach((link) => {
    Object.keys(projects).forEach((projectKey) => {
      const project = projects[projectKey] || {};
      const enriched = { ...project, folderName: projectKey, title: project.title || '' };
      const subs = project.subprojects || {};
      Object.keys(subs).forEach((subKey) => {
        const sub = { ...(subs[subKey] || {}), folderName: subKey };
        if (!egkrisiCatalog.linkMatchesApprovalRow(link, enriched, sub)) return;
        const rowKey = `${projectKey}/${subKey}`;
        if (seen[rowKey]) return;
        seen[rowKey] = true;
        rows.push({
          projectFolder: projectKey,
          actTitle: project.title || projectKey,
          subTitle: sub.title || subKey,
          pdfs: basenameList(sub.pdfs),
          modifications: basenameList(project.modifications),
        });
      });
    });
  });
  return rows;
}

function loadFolderInput(dataDir, projectId, subprojectId) {
  const pid = safeId(projectId);
  const sid = safeId(subprojectId);
  if (!pid || !sid) return { ok: false, error: 'Μη έγκυρο υποέργο' };
  const projectPath = path.join(dataDir, pid, sid, 'data.json');
  if (!isInside(projectPath, dataDir) || !fs.existsSync(projectPath)) {
    return { ok: false, error: 'Το υποέργο δεν βρέθηκε' };
  }
  const stored = readJson(projectPath);
  if (!stored) return { ok: false, error: 'Το υποέργο δεν διαβάζεται' };
  const project = withFilesShownInManager(stored, path.join(dataDir, pid, sid, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ'));

  const entaxeis = [];
  listDirs(path.join(dataDir, 'entaxeis')).forEach((id) => {
    const data = readJson(path.join(dataDir, 'entaxeis', id, 'data.json'));
    if (data) {
      entaxeis.push({
        ...data,
        entaxiId: data.entaxiId || id,
        diskFiles: listEntaxiDiskFiles(path.join(dataDir, 'entaxeis', id)),
      });
    }
  });

  const proskliseis = [];
  listDirs(path.join(dataDir, 'ΠΡΟΣΚΛΗΣΕΙΣ')).forEach((id) => {
    const dir = path.join(dataDir, 'ΠΡΟΣΚΛΗΣΕΙΣ', id);
    const data = readJson(path.join(dir, 'data.json'));
    if (!data) return;
    const sidecar = readJson(path.join(dir, 'prosklisi_data.json'));
    if (sidecar && (!Array.isArray(data.fileGroups) || data.fileGroups.length === 0) && Array.isArray(sidecar.fileGroups)) {
      data.fileGroups = sidecar.fileGroups;
    }
    if (sidecar && !Array.isArray(data.prosklisiFiles) && Array.isArray(sidecar.prosklisiFiles)) {
      data.prosklisiFiles = sidecar.prosklisiFiles;
    }
    const mods = readJson(path.join(dir, 'modifications.json'));
    const prosklisi = {
      ...data,
      prosklisiId: data.prosklisiId || id,
      modifications: Array.isArray(mods) ? mods : (data.modifications || []),
    };
    prosklisi.orimanthiFiles = collectOrimanthiFiles(dataDir, prosklisi);
    proskliseis.push(prosklisi);
  });

  let meleti = null;
  const meletaiRoot = path.join(dataDir, 'ΜΕΛΕΤΕΣ');
  if (fs.existsSync(meletaiRoot)) {
    for (const id of listDirs(meletaiRoot)) {
      const data = readJson(path.join(meletaiRoot, id, 'data.json'));
      if (data && String(data.linkedSubprojectId || '') === sid) {
        meleti = { ...data, id: data.id || id };
        break;
      }
    }
  }

  return {
    ok: true,
    input: {
      project,
      entaxeis: planCore.linkedEntaxeis(entaxeis, sid),
      proskliseis: planCore.linkedProskliseis(proskliseis, project),
      egkriseis: loadEgkrisiRows(dataDir, sid),
      meleti,
      khmdhsEntries: [],
    },
  };
}

function locateProsklisiFile(prosklisiDir, titles, fileName) {
  const safeName = path.basename(String(fileName || ''));
  if (!safeName) return null;
  const main = path.join(prosklisiDir, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
  if (!titles || !titles.length) {
    return findFileByName(main, safeName);
  }
  const safeTitles = titles.map((title) => groupsCore.sanitizeFolderName(title));
  const attachments = path.join(main, groupsCore.ATTACHMENTS_WRAPPER);
  const candidates = [
    path.join(attachments, ...safeTitles, safeName),
    path.join(main, ...safeTitles, safeName),
  ];
  for (const candidate of candidates) {
    if (isInside(candidate, main) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return findFileByName(main, safeName);
}

function locateEntaxiFile(entaxiRoot, fileName) {
  const safeName = path.basename(String(fileName || ''));
  if (!safeName) return null;
  const main = path.join(entaxiRoot, 'ΑΡΧΕΙΑ_ΕΝΤΑΞΗΣ', safeName);
  if (isInside(main, entaxiRoot) && fs.existsSync(main)) return main;
  const mods = path.join(entaxiRoot, 'ΤΡΟΠΟΠΟΙΗΣΕΙΣ');
  if (!fs.existsSync(mods)) return null;
  for (const dir of fs.readdirSync(mods)) {
    const candidate = path.join(mods, dir, safeName);
    if (isInside(candidate, entaxiRoot) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function locateProsklisiModFile(prosklisiDir, modificationId, fileName) {
  const filesDir = path.join(prosklisiDir, 'modification_files');
  const byName = fileName ? path.join(filesDir, path.basename(fileName)) : '';
  if (byName && isInside(byName, prosklisiDir) && fs.existsSync(byName)) return byName;
  const id = safeId(modificationId) || String(modificationId || '').replace(/[\\/]/g, '');
  if (!id) return null;
  const candidates = ['.pdf', '.docx', '.doc'].map((ext) => path.join(filesDir, `modification_${id}${ext}`));
  return candidates.find((candidate) => fs.existsSync(candidate) && isInside(candidate, prosklisiDir)) || null;
}

function copyFileInto(src, dest, allowedRoot) {
  if (!src || !fs.existsSync(src)) return false;
  let real = src;
  try { real = fs.realpathSync(src); } catch { return false; }
  if (!isInside(real, allowedRoot)) return false;
  const stat = fs.statSync(real);
  if (!stat.isFile()) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(real, dest);
  return true;
}

function copyTreeInto(srcDir, destDir, allowedRoot) {
  if (!srcDir || !fs.existsSync(srcDir)) return false;
  let real = srcDir;
  try { real = fs.realpathSync(srcDir); } catch { return false; }
  if (!isInside(real, allowedRoot) || !fs.statSync(real).isDirectory()) return false;
  const walk = (from, to) => {
    fs.readdirSync(from, { withFileTypes: true }).forEach((entry) => {
      const nextFrom = path.join(from, entry.name);
      const nextTo = path.join(to, entry.name);
      if (!isInside(nextFrom, allowedRoot) || !isInside(nextTo, destDir)) return;
      if (entry.isDirectory()) {
        fs.mkdirSync(nextTo, { recursive: true });
        walk(nextFrom, nextTo);
      } else if (entry.isFile()) {
        fs.mkdirSync(path.dirname(nextTo), { recursive: true });
        fs.copyFileSync(nextFrom, nextTo);
      }
    });
  };
  fs.mkdirSync(destDir, { recursive: true });
  walk(real, destDir);
  return true;
}

function resolveCopy(dataDir, source) {
  const kind = source && source.type;
  if (kind === 'subproject-file') {
    const pid = safeId(source.projectId);
    const sid = safeId(source.subprojectId);
    if (!pid || !sid) return null;
    const root = path.join(dataDir, pid, sid, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ');
    return { file: findFileByName(root, source.fileName), root };
  }
  if (kind === 'prosklisi-file') {
    const id = safeId(source.prosklisiId);
    if (!id) return null;
    const dir = path.join(dataDir, 'ΠΡΟΣΚΛΗΣΕΙΣ', id);
    return { file: locateProsklisiFile(dir, source.titles, source.fileName), root: dir };
  }
  if (kind === 'prosklisi-tree') {
    const id = safeId(source.prosklisiId);
    const folderName = path.basename(String(source.folderName || ''));
    if (!id || !folderName) return null;
    const main = path.join(dataDir, 'ΠΡΟΣΚΛΗΣΕΙΣ', id, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
    const attachments = path.join(main, groupsCore.ATTACHMENTS_WRAPPER);
    const dir = source.targetFolder === 'attachments'
      ? path.join(attachments, folderName)
      : path.join(main, folderName);
    return { tree: dir, root: main };
  }
  if (kind === 'prosklisi-mod-file') {
    const id = safeId(source.prosklisiId);
    if (!id) return null;
    const dir = path.join(dataDir, 'ΠΡΟΣΚΛΗΣΕΙΣ', id);
    return { file: locateProsklisiModFile(dir, source.modificationId, source.fileName), root: dir };
  }
  if (kind === 'entaxi-file') {
    const id = safeId(source.entaxiId);
    if (!id) return null;
    const dir = path.join(dataDir, 'entaxeis', id);
    return { file: locateEntaxiFile(dir, source.fileName), root: dir };
  }
  if (kind === 'egkrisi') {
    const folder = safeId(source.projectFolder) || path.basename(String(source.projectFolder || ''));
    if (!folder || folder.includes('..')) return null;
    const dir = path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ', folder);
    if (!isInside(dir, dataDir)) return null;
    return { file: findFileByName(dir, source.fileName), root: dir };
  }
  if (kind === 'path') {
    return { file: source.path, root: dataDir };
  }
  if (kind === 'meleti-file' || kind === 'meleti-folder') {
    return { meleti: source, root: path.join(dataDir, 'ΜΕΛΕΤΕΣ') };
  }
  if (kind === 'khmdhs') {
    return { khmdhs: source };
  }
  return null;
}

function destFor(destRoot, relativePath) {
  const rel = String(relativePath || '').replace(/\\/g, '/');
  if (!rel || rel.split('/').some((part) => !part || part === '.' || part === '..')) return null;
  const dest = path.resolve(destRoot, ...rel.split('/'));
  if (!isInside(dest, destRoot)) return null;
  return dest;
}

function dangerousDestination(dest, dataDir) {
  const resolved = path.resolve(dest);
  const root = path.parse(resolved).root;
  if (!resolved || resolved === root) return true;
  if (isInside(resolved, dataDir) || isInside(dataDir, resolved)) return true;
  return false;
}

async function writeSubprojectFolder({
  dataDir,
  destDir,
  plan,
  pdfs,
  downloadKhmdhs,
}) {
  if (!plan || !destDir) return { success: false, error: 'Λείπει ο προορισμός' };
  if (dangerousDestination(destDir, dataDir)) {
    return { success: false, error: 'Ο φάκελος δεν μπορεί να γραφτεί μέσα στα δεδομένα της εφαρμογής' };
  }
  const parent = path.dirname(path.resolve(destDir));
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) {
    return { success: false, error: 'Ο φάκελος αποθήκευσης δεν υπάρχει' };
  }
  const finalDir = path.resolve(destDir);
  const stage = `${finalDir}.__ergohub_tmp`;
  const backup = `${finalDir}.__ergohub_old`;
  if (dangerousDestination(stage, dataDir) || dangerousDestination(backup, dataDir)) {
    return { success: false, error: 'Ο φάκελος δεν μπορεί να γραφτεί μέσα στα δεδομένα της εφαρμογής' };
  }
  fs.rmSync(stage, { recursive: true, force: true });
  const target = stage;
  let stageReady = false;
  let movedAside = false;
  try {
  fs.mkdirSync(target, { recursive: true });
  stageReady = true;

  const allowedPdf = {};
  (plan.pdfs || []).forEach((slot) => {
    allowedPdf[String(slot.relativePath || '').replace(/\\/g, '/')] = true;
  });
  let pdfWritten = 0;
  (pdfs || []).forEach((item) => {
    const rel = String(item && item.relativePath || '').replace(/\\/g, '/');
    if (!allowedPdf[rel]) return;
    const dest = destFor(target, rel);
    if (!dest) return;
    const raw = item.buffer;
    const bytes = Buffer.isBuffer(raw)
      ? raw
      : raw instanceof Uint8Array
        ? Buffer.from(raw)
        : (raw && Array.isArray(raw.data) ? Buffer.from(raw.data) : Buffer.from(raw || []));
    if (!bytes.length) return;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, bytes);
    pdfWritten += 1;
  });

  let copied = 0;
  let skipped = 0;
  let khmdhsMissing = 0;

  for (const copy of plan.copies || []) {
    const dest = destFor(target, copy.relativePath);
    const resolved = resolveCopy(dataDir, copy.source);
    if (!dest || !resolved) {
      skipped += 1;
      continue;
    }
    if (resolved.khmdhs) {
      let pdfPath = null;
      try {
        if (typeof downloadKhmdhs === 'function') pdfPath = await downloadKhmdhs(resolved.khmdhs.adam);
      } catch {
        pdfPath = null;
      }
      if (pdfPath && copyFileInto(pdfPath, dest, path.dirname(pdfPath))) copied += 1;
      else khmdhsMissing += 1;
      continue;
    }
    if (resolved.meleti) {
      const meletiId = safeId(resolved.meleti.meletiId);
      const groupId = path.basename(String(resolved.meleti.groupId || ''));
      const leaf = path.basename(String(
        resolved.meleti.type === 'meleti-folder' ? resolved.meleti.folderId : resolved.meleti.fileName
      ));
      const root = path.join(dataDir, 'ΜΕΛΕΤΕΣ');
      const src = meletiId && groupId && leaf
        ? path.join(root, meletiId, 'files', groupId, leaf)
        : '';
      const ok = src && isInside(src, root) && (
        resolved.meleti.type === 'meleti-folder'
          ? copyTreeInto(src, dest, root)
          : copyFileInto(src, dest, root)
      );
      if (ok) copied += 1;
      else skipped += 1;
      continue;
    }
    if (resolved.tree) {
      if (copyTreeInto(resolved.tree, dest, resolved.root)) copied += 1;
      else skipped += 1;
      continue;
    }
    if (copyFileInto(resolved.file, dest, resolved.root)) copied += 1;
    else skipped += 1;
  }

  if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });
  if (fs.existsSync(finalDir)) {
    fs.renameSync(finalDir, backup);
    movedAside = true;
  }
  fs.renameSync(stage, finalDir);
  stageReady = false;
  movedAside = false;
  try {
    if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });
  } catch { /* ο νέος φάκελος είναι ήδη στη θέση του */ }
  return {
    success: true,
    path: finalDir,
    pdfWritten,
    copied,
    skipped,
    khmdhsMissing,
  };
  } catch {
    if (stageReady) {
      try { fs.rmSync(stage, { recursive: true, force: true }); } catch { /* ο προσωρινός φάκελος μένει μόνο αν δεν σβήνεται */ }
    }
    if (movedAside && !fs.existsSync(finalDir) && fs.existsSync(backup)) {
      try { fs.renameSync(backup, finalDir); } catch { /* ο προηγούμενος φάκελος έμεινε με προσωρινό όνομα */ }
    }
    const restored = fs.existsSync(finalDir);
    return {
      success: false,
      error: restored
        ? 'Ο φάκελος δεν αποθηκεύτηκε. Ο προηγούμενος φάκελος έμεινε ως είχε.'
        : 'Ο φάκελος δεν αποθηκεύτηκε.',
    };
  }
}

function khmdhsRetryWaitMs(attempt) {
  const n = Math.max(1, Number(attempt) || 1);
  return Math.min(3000 * n, 15000);
}

/**
 * Ξαναζητά το PDF του κρίκου μέχρι να έρθει. Χωρίς σύνδεσμο επιστρέφει αμέσως,
 * γιατί δεν υπάρχει αρχείο να κατέβει.
 */
async function downloadKhmdhsWithRetry(adam, {
  hasAttachment,
  download,
  notify,
  sleep,
  clearCancel,
} = {}) {
  if (typeof hasAttachment === 'function' && !hasAttachment(adam)) return null;
  if (typeof download !== 'function') return null;
  let attempt = 0;
  for (;;) {
    attempt += 1;
    if (typeof notify === 'function') notify({ waiting: true, attempt });
    if (typeof clearCancel === 'function') clearCancel(adam);
    try {
      const pdfPath = await download(adam);
      if (pdfPath) return pdfPath;
    } catch {
      /* προσωρινή αποτυχία — μένουμε στη διαδικασία */
    }
    const waitMs = khmdhsRetryWaitMs(attempt);
    if (typeof sleep === 'function') await sleep(waitMs);
    else await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

module.exports = {
  isInside,
  dangerousDestination,
  loadFolderInput,
  writeSubprojectFolder,
  downloadKhmdhsWithRetry,
  khmdhsRetryWaitMs,
};

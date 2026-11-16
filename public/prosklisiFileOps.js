/**
 * Δίσκος αρχείων πρόσκλησης: ομάδες / υποομάδες, μεταφορά, διαγραφή.
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { safeWriteJSON } = require('./safeWrite');
const groupsCore = require('../app/core/prosklisiFileGroups');
const submissionsCore = require('../app/core/prosklisiSubmissions');
const managedFiles = require('../app/core/managedFiles');
const managedFileRename = require('./managedFileRename');

const FILES_ROOT_NAME = 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ';

function dirsOf(prosklisiDir) {
  const mainFilesDir = path.join(prosklisiDir, FILES_ROOT_NAME);
  const attachmentsDir = path.join(mainFilesDir, groupsCore.ATTACHMENTS_WRAPPER);
  return { prosklisiDir, mainFilesDir, attachmentsDir };
}

function isPathInside(child, parent) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readProsklisiData(prosklisiDir) {
  const dataPath = path.join(prosklisiDir, 'data.json');
  const sidecarPath = path.join(prosklisiDir, 'prosklisi_data.json');
  const data = readJsonIfExists(dataPath);
  if (!data) return { ok: false, error: 'Η πρόσκληση δεν βρέθηκε' };
  const sidecar = readJsonIfExists(sidecarPath) || {};
  if (!Array.isArray(data.fileGroups) || data.fileGroups.length === 0) {
    if (Array.isArray(sidecar.fileGroups) && sidecar.fileGroups.length) {
      data.fileGroups = sidecar.fileGroups;
    }
  }
  data.fileGroups = groupsCore.cloneGroups(data.fileGroups || []);
  data.prosklisiFiles = Array.isArray(data.prosklisiFiles) ? data.prosklisiFiles : [];
  data.submissions = submissionsCore.normalizeSubmissions(data.submissions).submissions;
  return { ok: true, data, dataPath, sidecarPath, sidecar };
}

function persistProsklisiData(prosklisiDir, data) {
  const dataPath = path.join(prosklisiDir, 'data.json');
  const sidecarPath = path.join(prosklisiDir, 'prosklisi_data.json');
  const next = { ...data, updatedAt: new Date().toISOString() };
  safeWriteJSON(dataPath, next);
  const sidecar = readJsonIfExists(sidecarPath) || {};
  safeWriteJSON(sidecarPath, {
    ...sidecar,
    ...next,
    prosklisiFiles: next.prosklisiFiles,
    fileGroups: next.fileGroups,
    submissions: next.submissions,
    prosklisiFolders: next.prosklisiFolders,
    updatedAt: next.updatedAt,
  });
  return next;
}

function ensureBaseDirs(prosklisiDir) {
  const { mainFilesDir, attachmentsDir } = dirsOf(prosklisiDir);
  if (!fs.existsSync(mainFilesDir)) fs.mkdirSync(mainFilesDir, { recursive: true });
  if (!fs.existsSync(attachmentsDir)) fs.mkdirSync(attachmentsDir, { recursive: true });
  return { mainFilesDir, attachmentsDir };
}

function uniqueDestPath(dir, fileName) {
  const planned = managedFiles.nextAvailableName(
    fileName,
    fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((n) => {
        try { return fs.statSync(path.join(dir, n)).isFile(); } catch { return false; }
      })
      : []
  );
  return managedFileRename.resolveInside(dir, planned || fileName);
}

function findGroupFolder(mainFilesDir, attachmentsDir, titlesPath) {
  const safeTitles = (titlesPath || []).map((t) => groupsCore.sanitizeFolderName(t));
  if (!safeTitles.length) return null;
  const candidates = [
    path.join(mainFilesDir, ...safeTitles),
    path.join(attachmentsDir, ...safeTitles),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      if (!isPathInside(candidate, mainFilesDir)) continue;
      return candidate;
    }
  }
  return null;
}

function ensureGroupFolder(prosklisiDir, titlesPath) {
  const { mainFilesDir, attachmentsDir } = ensureBaseDirs(prosklisiDir);
  const existing = findGroupFolder(mainFilesDir, attachmentsDir, titlesPath);
  if (existing) return existing;
  const safeTitles = (titlesPath || []).map((t) => groupsCore.sanitizeFolderName(t));
  if (!safeTitles.length) return mainFilesDir;
  const dest = path.join(mainFilesDir, ...safeTitles);
  if (!isPathInside(dest, mainFilesDir) || dest === mainFilesDir) {
    throw new Error('Μη επιτρεπτό όνομα ομάδας');
  }
  fs.mkdirSync(dest, { recursive: true });
  return dest;
}

const STORED_TREE_DEPTH = 24;

function locatePhysicalFile(prosklisiDir, fileName) {
  const { mainFilesDir } = dirsOf(prosklisiDir);
  return managedFileRename.findNamedFile(
    mainFilesDir,
    path.basename(String(fileName || '')),
    STORED_TREE_DEPTH
  );
}

function moveFilesToGroupFolder(prosklisiDir, files, titlesPath) {
  const destDir = ensureGroupFolder(prosklisiDir, titlesPath);
  (files || []).forEach((file) => {
    const name = groupsCore.fileNameOf(file);
    if (!name) return;
    const found = locatePhysicalFile(prosklisiDir, name);
    if (!found || !fs.existsSync(found)) return;
    const dest = uniqueDestPath(destDir, path.basename(found));
    if (!dest) return;
    if (path.resolve(found) === path.resolve(dest)) return;
    fs.renameSync(found, dest);
  });
  return destDir;
}

function unlinkStoredFile(prosklisiDir, file) {
  const { mainFilesDir } = dirsOf(prosklisiDir);
  const name = path.basename(groupsCore.fileNameOf(file) || '');
  const found = name ? locatePhysicalFile(prosklisiDir, name) : null;
  if (found && fs.existsSync(found) && isPathInside(found, mainFilesDir)) {
    const resolved = path.resolve(found);
    if (resolved !== path.resolve(mainFilesDir)) {
      try { fs.unlinkSync(found); } catch { /* το αρχείο έφυγε ήδη */ }
    }
  }
  const raw = file && typeof file === 'object' ? String(file.filePath || '') : '';
  if (raw && fs.existsSync(raw) && isPathInside(raw, mainFilesDir) && path.resolve(raw) !== path.resolve(mainFilesDir)) {
    try { fs.unlinkSync(raw); } catch { /* το αρχείο έφυγε ήδη */ }
  }
}

function folderContainsFile(folder) {
  if (!folder || !fs.existsSync(folder)) return false;
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return false; }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isFile()) return true;
      if (entry.isDirectory() && walk(full)) return true;
    }
    return false;
  };
  return walk(folder);
}

function folderOwnedByGroup(prosklisiDir, groups, folderPath) {
  const { mainFilesDir, attachmentsDir } = dirsOf(prosklisiDir);
  const target = path.resolve(folderPath);
  let owned = false;
  const walk = (list, parentTitles) => {
    (list || []).forEach((group) => {
      if (owned || !group) return;
      const titles = parentTitles.concat([group.title || 'Ομάδα']);
      const found = findGroupFolder(mainFilesDir, attachmentsDir, titles);
      if (found && path.resolve(found) === target) owned = true;
      else walk(group.subgroups, titles);
    });
  };
  walk(groups, []);
  return owned;
}

function removeFolderTree(folder, mainFilesDir) {
  if (!folder || !fs.existsSync(folder)) return;
  const root = path.resolve(mainFilesDir);
  const resolved = path.resolve(folder);
  const attachmentsDir = path.resolve(mainFilesDir, groupsCore.ATTACHMENTS_WRAPPER);
  if (!isPathInside(resolved, root)) return;
  if (resolved === root || resolved === attachmentsDir) return;
  fs.rmSync(resolved, { recursive: true, force: true });
}

function organizeFiles(prosklisiDir, options) {
  const {
    action,
    title,
    groupId,
    parentGroupId,
    fileNames = [],
    newGroupId,
    submissionId,
  } = options || {};
  const loaded = readProsklisiData(prosklisiDir);
  if (!loaded.ok) return loaded;

  const data = loaded.data;
  const names = Array.isArray(fileNames) ? fileNames : [];
  const pulled = groupsCore.pullFilesByName(data.prosklisiFiles, data.fileGroups, names);
  const pulledKeys = new Set(pulled.files.map((f) => groupsCore.fileNameOf(f)));
  names.forEach((name) => {
    if (pulledKeys.has(name)) return;
    const found = locatePhysicalFile(prosklisiDir, name);
    if (!found) return;
    pulled.files.push({ fileName: name, originalName: name, targetFolder: 'attachments' });
    pulledKeys.add(name);
  });

  if (names.length > 0 && pulled.files.length === 0) {
    return { ok: false, error: 'Τα αρχεία δεν βρέθηκαν' };
  }

  if (action === 'existing') {
    if (!groupId || !groupsCore.findGroupById(pulled.fileGroups, groupId)) {
      return { ok: false, error: 'Η ομάδα δεν βρέθηκε' };
    }
    const fileGroups = groupsCore.addFilesToGroup(pulled.fileGroups, groupId, pulled.files);
    const titles = groupsCore.titlesPathForGroup(fileGroups, groupId);
    moveFilesToGroupFolder(prosklisiDir, pulled.files, titles);
    persistProsklisiData(prosklisiDir, {
      ...data,
      prosklisiFiles: pulled.prosklisiFiles,
      fileGroups,
    });
    return { ok: true, groupId };
  }

  if (action === 'new' || action === 'subgroup') {
    const parentId = action === 'subgroup' ? parentGroupId : parentGroupId || null;
    if (parentId && !groupsCore.findGroupById(pulled.fileGroups, parentId)) {
      return { ok: false, error: 'Η ομάδα δεν βρέθηκε' };
    }
    const resolvedTitle = String(title || '').trim() || 'Ομάδα';
    const ownerId = !parentId && submissionId ? String(submissionId) : '';
    const titleCheck = groupsCore.canUseGroupTitle(
      pulled.fileGroups,
      resolvedTitle,
      parentId || null,
      ownerId
    );
    if (!titleCheck.ok) return titleCheck;
    const id = newGroupId || uuidv4();
    const newGroup = {
      id,
      title: resolvedTitle,
      files: pulled.files,
      subgroups: [],
    };
    if (ownerId) newGroup.submissionId = ownerId;
    const fileGroups = parentId
      ? groupsCore.createSubgroup(pulled.fileGroups, parentId, newGroup)
      : groupsCore.createGroup(pulled.fileGroups, newGroup);
    const titles = groupsCore.titlesPathForGroup(fileGroups, id);
    moveFilesToGroupFolder(prosklisiDir, pulled.files, titles);
    persistProsklisiData(prosklisiDir, {
      ...data,
      prosklisiFiles: pulled.prosklisiFiles,
      fileGroups,
    });
    return { ok: true, groupId: id };
  }

  return { ok: false, error: 'Άγνωστη ενέργεια ομαδοποίησης' };
}

function namesPresentInTree(looseFiles, groups, names) {
  const wanted = new Set(names);
  const present = new Set();
  const consider = (file) => {
    const name = path.basename(groupsCore.fileNameOf(file) || '');
    if (wanted.has(name)) present.add(name);
    const raw = groupsCore.fileNameOf(file);
    if (wanted.has(raw)) present.add(raw);
  };
  (looseFiles || []).forEach(consider);
  const walk = (list) => {
    (list || []).forEach((group) => {
      (group.files || []).forEach(consider);
      walk(group.subgroups);
    });
  };
  walk(groups);
  return present;
}

function deleteFiles(prosklisiDir, fileNames) {
  const loaded = readProsklisiData(prosklisiDir);
  if (!loaded.ok) return loaded;
  const names = Array.isArray(fileNames) ? fileNames.map((n) => path.basename(String(n || ''))).filter(Boolean) : [];
  if (!names.length) return { ok: false, error: 'Δεν δόθηκαν αρχεία' };

  const present = namesPresentInTree(loaded.data.prosklisiFiles, loaded.data.fileGroups, names);
  const missing = [];
  names.forEach((name) => {
    const found = locatePhysicalFile(prosklisiDir, name);
    if (found && fs.existsSync(found) && isPathInside(found, dirsOf(prosklisiDir).mainFilesDir)) {
      fs.unlinkSync(found);
    } else {
      missing.push(name);
    }
  });

  const next = groupsCore.removeFilesFromTree(loaded.data.prosklisiFiles, loaded.data.fileGroups, names);
  persistProsklisiData(prosklisiDir, {
    ...loaded.data,
    prosklisiFiles: next.prosklisiFiles,
    fileGroups: next.fileGroups,
  });
  const deleted = names.filter((name) => !missing.includes(name) || present.has(name)).length;
  return { ok: true, deleted, missing };
}

function deleteGroup(prosklisiDir, groupId) {
  const loaded = readProsklisiData(prosklisiDir);
  if (!loaded.ok) return loaded;
  const titles = groupsCore.titlesPathForGroup(loaded.data.fileGroups, groupId);
  const removed = groupsCore.removeGroupById(loaded.data.fileGroups, groupId);
  if (!removed.removed) return { ok: false, error: 'Ο φάκελος δεν βρέθηκε' };
  const files = groupsCore.flattenRemovedFiles(removed.removed);
  files.forEach((file) => unlinkStoredFile(prosklisiDir, file));
  const { mainFilesDir, attachmentsDir } = dirsOf(prosklisiDir);
  const folder = findGroupFolder(mainFilesDir, attachmentsDir, titles);
  if (folder && !folderContainsFile(folder)) removeFolderTree(folder, mainFilesDir);
  persistProsklisiData(prosklisiDir, {
    ...loaded.data,
    fileGroups: removed.fileGroups,
  });
  return { ok: true, title: removed.removed.title, deletedFiles: files.length };
}

function indexStoredBaseNames(prosklisiDir) {
  const { mainFilesDir } = dirsOf(prosklisiDir);
  const names = new Set();
  const walk = (dir, depth) => {
    if (depth > STORED_TREE_DEPTH || !fs.existsSync(dir)) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    entries.forEach((entry) => {
      if (entry.name.startsWith('.')) return;
      if (entry.isFile()) names.add(entry.name.normalize('NFC').toLowerCase());
      else if (entry.isDirectory()) walk(path.join(dir, entry.name), depth + 1);
    });
  };
  walk(mainFilesDir, 0);
  return names;
}

function storedFileExists(index, file) {
  const base = path.basename(groupsCore.fileNameOf(file) || '').normalize('NFC').toLowerCase();
  if (base && index.has(base)) return true;
  const raw = file && typeof file === 'object' ? String(file.filePath || '') : '';
  return !!(raw && fs.existsSync(raw));
}

function pruneMissingFileRecords(prosklisiDir) {
  const loaded = readProsklisiData(prosklisiDir);
  if (!loaded.ok) return loaded;
  const index = indexStoredBaseNames(prosklisiDir);
  const names = [];
  const consider = (file) => {
    if (file && typeof file === 'object' && file.sourceProposalId) return;
    if (storedFileExists(index, file)) return;
    const name = groupsCore.fileNameOf(file);
    if (name) names.push(name);
  };
  (loaded.data.prosklisiFiles || []).forEach(consider);
  const walk = (list) => {
    (list || []).forEach((group) => {
      (group.files || []).forEach(consider);
      walk(group.subgroups);
    });
  };
  walk(loaded.data.fileGroups);
  if (!names.length) return { ok: true, removed: 0 };
  const next = groupsCore.removeFilesFromTree(loaded.data.prosklisiFiles, loaded.data.fileGroups, names);
  persistProsklisiData(prosklisiDir, {
    ...loaded.data,
    prosklisiFiles: next.prosklisiFiles,
    fileGroups: next.fileGroups,
  });
  return { ok: true, removed: names.length };
}

function deletePhysicalFolder(prosklisiDir, folderName, targetFolder) {
  const { mainFilesDir, attachmentsDir } = dirsOf(prosklisiDir);
  const base = targetFolder === 'attachments' ? attachmentsDir : mainFilesDir;
  const safeName = path.basename(String(folderName || ''));
  const folderPath = path.resolve(base, safeName);
  if (!safeName || safeName === '.' || safeName === '..' || !isPathInside(folderPath, mainFilesDir)) {
    return { ok: false, error: 'Μη επιτρεπτός φάκελος' };
  }
  if (path.resolve(folderPath) === path.resolve(mainFilesDir) || path.resolve(folderPath) === path.resolve(attachmentsDir)) {
    return { ok: false, error: 'Μη επιτρεπτός φάκελος' };
  }
  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    return { ok: false, error: 'Ο φάκελος δεν βρέθηκε' };
  }

  const loaded = readProsklisiData(prosklisiDir);
  const dropIds = [];
  if (loaded.ok) {
    const mark = (groups, parentTitles) => {
      (groups || []).forEach((group) => {
        const titles = parentTitles.concat([group.title]);
        const owned = findGroupFolder(mainFilesDir, attachmentsDir, titles);
        if (owned && path.resolve(owned) === folderPath) dropIds.push(group.id);
        else mark(group.subgroups, titles);
      });
    };
    mark(loaded.data.fileGroups, []);
  }

  fs.rmSync(folderPath, { recursive: true, force: true });

  if (loaded.ok && dropIds.length) {
    let groups = loaded.data.fileGroups;
    dropIds.forEach((id) => {
      const removed = groupsCore.removeGroupById(groups, id);
      groups = removed.fileGroups;
    });
    persistProsklisiData(prosklisiDir, {
      ...loaded.data,
      fileGroups: groups,
    });
  }
  // Μένουν οι εγγραφές που το αρχείο τους υπάρχει ακόμα αλλού, με το ίδιο όνομα.
  pruneMissingFileRecords(prosklisiDir);
  return { ok: true, title: safeName };
}

function pushZipFile(entries, absPath, zipPath) {
  if (!absPath || !fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) return;
  const safeZip = String(zipPath || '').split(/[\\/]/).filter((part) => part && part !== '.' && part !== '..').join('/');
  if (!safeZip) return;
  entries.push({ absPath, zipPath: safeZip });
}

function collectGroupZipEntries(prosklisiDir, groupId) {
  const loaded = readProsklisiData(prosklisiDir);
  if (!loaded.ok) return loaded;
  const group = groupsCore.findGroupById(loaded.data.fileGroups, groupId);
  if (!group) return { ok: false, error: 'Ο φάκελος δεν βρέθηκε' };
  const { mainFilesDir } = dirsOf(prosklisiDir);
  const entries = [];
  const walk = (node, prefix) => {
    const folder = prefix.concat([groupsCore.sanitizeFolderName(node.title || 'Φάκελος')]);
    (node.files || []).forEach((file) => {
      if (file && file.sourceProposalId) return;
      const name = path.basename(groupsCore.fileNameOf(file) || '');
      let abs = name ? locatePhysicalFile(prosklisiDir, name) : null;
      if ((!abs || !fs.existsSync(abs)) && file && file.filePath && fs.existsSync(file.filePath)) {
        abs = file.filePath;
      }
      if (!abs || !isPathInside(abs, mainFilesDir)) return;
      pushZipFile(entries, abs, folder.concat([path.basename(abs)]).join('/'));
    });
    (node.subgroups || []).forEach((sub) => walk(sub, folder));
  };
  walk(group, []);
  if (!entries.length) return { ok: false, error: 'Ο φάκελος δεν έχει αρχεία για λήψη' };
  return {
    ok: true,
    entries,
    suggestedName: `${groupsCore.sanitizeFolderName(group.title || 'Φάκελος')}.zip`,
  };
}

function collectDirectoryZipEntries(prosklisiDir, folderName, targetFolder) {
  const { mainFilesDir, attachmentsDir } = dirsOf(prosklisiDir);
  const base = targetFolder === 'attachments' ? attachmentsDir : mainFilesDir;
  const safeName = path.basename(String(folderName || ''));
  const folderPath = path.resolve(base, safeName);
  if (!safeName || !isPathInside(folderPath, mainFilesDir) || !fs.existsSync(folderPath)) {
    return { ok: false, error: 'Ο φάκελος δεν βρέθηκε' };
  }
  const entries = [];
  const walk = (dir, prefix) => {
    let listing;
    try { listing = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    listing.forEach((entry) => {
      if (entry.name.startsWith('.')) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, prefix.concat([entry.name]));
      else if (entry.isFile()) pushZipFile(entries, full, prefix.concat([entry.name]).join('/'));
    });
  };
  walk(folderPath, [safeName]);
  if (!entries.length) return { ok: false, error: 'Ο φάκελος δεν έχει αρχεία για λήψη' };
  return {
    ok: true,
    entries,
    suggestedName: `${groupsCore.sanitizeFolderName(safeName)}.zip`,
  };
}

function writeZipEntries(destPath, entries) {
  return new Promise((resolve) => {
    const archive = require('archiver')('zip', { zlib: { level: 6 } });
    const output = fs.createWriteStream(destPath);
    output.on('close', () => resolve({ ok: true }));
    output.on('error', (err) => resolve({ ok: false, error: err.message }));
    archive.on('error', (err) => resolve({ ok: false, error: err.message }));
    archive.pipe(output);
    (entries || []).forEach((entry) => archive.file(entry.absPath, { name: entry.zipPath }));
    archive.finalize();
  });
}

function splitRelativeDir(relativeDir) {
  return String(relativeDir || '')
    .split(/[\\/]+/)
    .map((part) => part.trim())
    .filter((part) => part && part !== '.' && part !== '..');
}

function importFolderTree(prosklisiDir, spec) {
  const source = spec || {};
  const rootTitle = String(source.rootTitle || '').trim() || 'Φάκελος';
  const ownerId = source.submissionId ? String(source.submissionId) : '';
  const loaded = readProsklisiData(prosklisiDir);
  if (!loaded.ok) return loaded;
  const titleCheck = groupsCore.canUseGroupTitle(loaded.data.fileGroups, rootTitle, null, ownerId);
  if (!titleCheck.ok) return titleCheck;

  const root = { title: rootTitle, files: [], children: new Map() };
  const ensureChild = (node, title) => {
    const key = groupsCore.sanitizeFolderName(title).toLowerCase();
    if (!node.children.has(key)) {
      node.children.set(key, { title: String(title).trim() || 'Φάκελος', files: [], children: new Map() });
    }
    return node.children.get(key);
  };
  const ensurePath = (parts) => {
    let node = root;
    parts.forEach((part) => {
      node = ensureChild(node, part);
    });
    return node;
  };

  (source.directories || []).forEach((dir) => ensurePath(splitRelativeDir(dir)));
  const incoming = Array.isArray(source.files) ? source.files : [];
  incoming.forEach((file) => {
    ensurePath(splitRelativeDir(file && file.relativeDir)).files.push(file);
  });
  if (!incoming.length && root.children.size === 0) {
    return { ok: false, error: 'Ο φάκελος δεν περιέχει αρχεία' };
  }

  const { mainFilesDir, attachmentsDir } = dirsOf(prosklisiDir);
  const existingRoot = findGroupFolder(mainFilesDir, attachmentsDir, [rootTitle]);
  if (existingRoot && !folderOwnedByGroup(prosklisiDir, loaded.data.fileGroups, existingRoot)) {
    return {
      ok: false,
      error: 'Υπάρχει ήδη φάκελος με αυτό το όνομα στην πρόσκληση. Μετονόμασε τον φάκελο που θέλεις να προσθέσεις και δοκίμασε ξανά.',
    };
  }

  const used = managedFiles.collectExistingFileNames(loaded.data.prosklisiFiles, loaded.data.fileGroups);
  indexStoredBaseNames(prosklisiDir).forEach((name) => used.push(name));
  let fileCount = 0;
  let folderCount = 0;

  const materialize = (node, parentTitles, isRoot) => {
    const titles = parentTitles.concat([node.title]);
    const destDir = ensureGroupFolder(prosklisiDir, titles);
    const files = [];
    (node.files || []).forEach((file) => {
      const sourcePath = file && file.filePath;
      if (!sourcePath || !fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) return;
      const original = path.basename(String(file.fileName || sourcePath)).replace(/[<>:"/\\|?*]/g, '_').trim();
      if (!original) return;
      let stored = managedFiles.nextAvailableName(original, used);
      if (!stored) return;
      let dest = managedFileRename.resolveInside(destDir, stored);
      if (!dest || !isPathInside(dest, dirsOf(prosklisiDir).mainFilesDir)) return;
      if (fs.existsSync(dest)) {
        dest = uniqueDestPath(destDir, stored);
        if (!dest) return;
        stored = path.basename(dest);
      }
      fs.copyFileSync(sourcePath, dest);
      used.push(stored);
      files.push({
        fileName: stored,
        originalName: original,
        targetFolder: 'attachments',
      });
      fileCount += 1;
    });
    const subgroups = [];
    node.children.forEach((child) => {
      subgroups.push(materialize(child, titles, false));
      folderCount += 1;
    });
    const group = {
      id: uuidv4(),
      title: node.title,
      files,
      subgroups,
    };
    if (isRoot && ownerId) group.submissionId = ownerId;
    return group;
  };

  const group = materialize(root, [], true);
  persistProsklisiData(prosklisiDir, {
    ...loaded.data,
    fileGroups: groupsCore.createGroup(loaded.data.fileGroups, group),
  });
  return {
    ok: true,
    groupId: group.id,
    title: rootTitle,
    fileCount,
    folderCount,
  };
}

function rewriteRenamedFile(prosklisiDir, oldName, newName) {
  const loaded = readProsklisiData(prosklisiDir);
  if (!loaded.ok) return loaded;
  const next = groupsCore.rewriteFileName(loaded.data.prosklisiFiles, loaded.data.fileGroups, oldName, newName);
  persistProsklisiData(prosklisiDir, {
    ...loaded.data,
    prosklisiFiles: next.prosklisiFiles,
    fileGroups: next.fileGroups,
  });
  return { ok: true };
}

function materializeFormGroups(prosklisiDir, incomingGroups, existingGroups) {
  const { mainFilesDir } = ensureBaseDirs(prosklisiDir);
  const existingById = {};
  function indexExisting(groups) {
    (groups || []).forEach((g) => {
      if (g && g.id) existingById[g.id] = g;
      indexExisting(g && g.subgroups);
    });
  }
  indexExisting(existingGroups);

  function walk(groups, titlesPath) {
    const saved = [];
    (groups || []).forEach((group) => {
      if (!group) return;
      const titles = titlesPath.concat([group.title || 'Ομάδα']);
      const folderPath = ensureGroupFolder(prosklisiDir, titles);
      const existing = existingById[group.id] || {};
      const groupFiles = [...(existing.files || [])];
      (group.files || []).forEach((file) => {
        if (file && file.filePath && fs.existsSync(file.filePath)) {
          const originalFileName = path.basename(file.fileName || file.filePath);
          const destPath = uniqueDestPath(folderPath, originalFileName);
          if (!destPath || !isPathInside(destPath, mainFilesDir)) return;
          fs.copyFileSync(file.filePath, destPath);
          const storedName = path.basename(destPath);
          if (!groupFiles.some((gf) => gf.fileName === storedName)) {
            groupFiles.push({
              fileName: storedName,
              originalName: file.fileName || storedName,
            });
          }
        } else if (file && file.fileName && !groupFiles.some((gf) => gf.fileName === file.fileName)) {
          const candidate = path.basename(String(file.fileName));
          if (fs.existsSync(path.join(folderPath, candidate)) || locatePhysicalFile(prosklisiDir, candidate)) {
            groupFiles.push(file);
          }
        }
      });
      const node = {
        id: group.id,
        title: group.title,
        files: groupFiles,
        subgroups: walk(group.subgroups, titles),
      };
      const owner = group.submissionId || existing.submissionId;
      if (owner) node.submissionId = String(owner);
      saved.push(node);
      if (node.id) existingById[node.id] = node;
    });
    return saved;
  }

  const saved = walk(incomingGroups, []);
  (existingGroups || []).forEach((existingGroup) => {
    if (existingGroup && existingGroup.id && !groupsCore.findGroupById(saved, existingGroup.id)) {
      saved.push(groupsCore.normalizeGroup(existingGroup));
    }
  });
  return saved;
}

function rememberSubmissionChange(prosklisiDir, next) {
  const loaded = readProsklisiData(prosklisiDir);
  if (!loaded.ok) return loaded;
  const healed = submissionsCore.rewriteOwners(
    next.fileGroups != null ? next.fileGroups : loaded.data.fileGroups,
    next.prosklisiFiles != null ? next.prosklisiFiles : loaded.data.prosklisiFiles,
    next.idRemap || {}
  );
  const submissions = submissionsCore.normalizeSubmissions(
    next.submissions != null ? next.submissions : loaded.data.submissions
  ).submissions;
  persistProsklisiData(prosklisiDir, {
    ...loaded.data,
    submissions,
    fileGroups: healed.fileGroups,
    prosklisiFiles: healed.looseFiles,
  });
  return { ok: true, submissions, status: loaded.data.status || '' };
}

function ensureSubmissionRecord(prosklisiDir, spec) {
  const loaded = readProsklisiData(prosklisiDir);
  if (!loaded.ok) return loaded;
  const result = submissionsCore.ensureSubmission(
    loaded.data.submissions,
    spec || {},
    (spec && spec.newId) || uuidv4()
  );
  if (!result.ok) return result;
  const saved = rememberSubmissionChange(prosklisiDir, {
    submissions: result.submissions,
    idRemap: result.idRemap,
  });
  if (!saved.ok) return saved;
  return { ok: true, submission: result.submission, created: result.created, status: saved.status };
}

function setSubmissionDeclared(prosklisiDir, submissionId, submitted, submittedOn) {
  const loaded = readProsklisiData(prosklisiDir);
  if (!loaded.ok) return loaded;
  const result = submissionsCore.setSubmitted(loaded.data.submissions, submissionId, {
    submitted: !!submitted,
    submittedOn,
    today: new Date().toISOString().slice(0, 10),
  });
  if (!result.ok) return result;
  const saved = rememberSubmissionChange(prosklisiDir, {
    submissions: result.submissions,
    idRemap: result.idRemap,
  });
  if (!saved.ok) return saved;
  return { ok: true, submission: result.submission, status: saved.status };
}

function assignGroupToSubmission(prosklisiDir, groupId, submissionId) {
  const loaded = readProsklisiData(prosklisiDir);
  if (!loaded.ok) return loaded;
  const result = submissionsCore.assignGroup(loaded.data.fileGroups, groupId, submissionId || '');
  if (!result.ok) return result;
  const saved = rememberSubmissionChange(prosklisiDir, { fileGroups: result.fileGroups });
  if (!saved.ok) return saved;
  return { ok: true, status: saved.status };
}

function placeLooseFileOnShelf(prosklisiDir, fileName, shelf) {
  const loaded = readProsklisiData(prosklisiDir);
  if (!loaded.ok) return loaded;
  const result = submissionsCore.placeLooseFile(loaded.data.prosklisiFiles, fileName, shelf);
  if (!result.ok) return result;
  const saved = rememberSubmissionChange(prosklisiDir, { prosklisiFiles: result.looseFiles });
  if (!saved.ok) return saved;
  return { ok: true, status: saved.status };
}

function listForUi(prosklisiDir) {
  pruneMissingFileRecords(prosklisiDir);
  const { mainFilesDir, attachmentsDir } = dirsOf(prosklisiDir);
  const loaded = readProsklisiData(prosklisiDir);
  const fileGroups = loaded.ok ? loaded.data.fileGroups : [];
  const groupedNames = new Set(groupsCore.collectGroupFileNames(fileGroups));
  const groupFolderNames = groupsCore.topLevelGroupFolderNames(fileGroups);

  const files = { main: [], attachments: [] };
  const folders = { main: [], attachments: [] };

  if (fs.existsSync(mainFilesDir)) {
    fs.readdirSync(mainFilesDir).forEach((name) => {
      const full = path.join(mainFilesDir, name);
      let stat;
      try { stat = fs.statSync(full); } catch { return; }
      if (stat.isDirectory()) {
        if (groupsCore.isWrapperFolderName(name) || groupFolderNames[name]) return;
        folders.main.push({ folderName: name, originalName: name });
        return;
      }
      if (stat.isFile() && !groupedNames.has(name)) {
        files.main.push({ fileName: name, originalName: name, isGrouped: false, targetFolder: 'main' });
      }
    });
  }

  if (loaded.ok) {
    (loaded.data.prosklisiFiles || []).forEach((file) => {
      const fileName = file.fileName;
      if (!fileName || groupedNames.has(fileName)) return;
      const bucket = file.targetFolder === 'main' ? files.main : files.attachments;
      const existing = bucket.find((f) => f.fileName === fileName);
      if (existing) {
        if (file.shelf) existing.shelf = file.shelf;
        return;
      }
      const row = {
        fileName,
        originalName: file.originalName || fileName,
        isGrouped: false,
        targetFolder: file.targetFolder === 'main' ? 'main' : 'attachments',
      };
      if (file.shelf) row.shelf = file.shelf;
      bucket.push(row);
    });
  }

  if (fs.existsSync(attachmentsDir)) {
    fs.readdirSync(attachmentsDir).forEach((name) => {
      const full = path.join(attachmentsDir, name);
      let stat;
      try { stat = fs.statSync(full); } catch { return; }
      if (stat.isDirectory()) {
        if (groupFolderNames[name]) return;
        folders.attachments.push({ folderName: name, originalName: name });
        return;
      }
      if (stat.isFile() && !groupedNames.has(name) && !files.attachments.some((f) => f.fileName === name)) {
        files.attachments.push({
          fileName: name,
          originalName: name,
          isGrouped: false,
          targetFolder: 'attachments',
        });
      }
    });
  }

  return {
    files,
    folders,
    fileGroups,
    submissions: loaded.ok ? loaded.data.submissions : [],
    linkedOrimanthiProposals: loaded.ok ? (loaded.data.linkedOrimanthiProposals || []) : [],
    prosklisiStatus: loaded.ok ? (loaded.data.status || '') : '',
    documentRegistry: loaded.ok ? (loaded.data.documentRegistry || []) : [],
    diavgeiaMeta: loaded.ok ? (loaded.data.diavgeiaMeta || null) : null,
    diavgeiaAda: loaded.ok ? (loaded.data.diavgeiaAda || '') : '',
  };
}

module.exports = {
  FILES_ROOT_NAME,
  dirsOf,
  readProsklisiData,
  persistProsklisiData,
  ensureBaseDirs,
  locatePhysicalFile,
  uniqueDestPath,
  organizeFiles,
  importFolderTree,
  deleteFiles,
  deleteGroup,
  deletePhysicalFolder,
  pruneMissingFileRecords,
  collectGroupZipEntries,
  collectDirectoryZipEntries,
  writeZipEntries,
  rewriteRenamedFile,
  materializeFormGroups,
  ensureSubmissionRecord,
  setSubmissionDeclared,
  assignGroupToSubmission,
  placeLooseFileOnShelf,
  listForUi,
  isPathInside,
};

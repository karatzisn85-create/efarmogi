/**
 * Δίσκος αρχείων πρόσκλησης: ομάδες / υποομάδες, μεταφορά, διαγραφή.
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { safeWriteJSON } = require('./safeWrite');
const groupsCore = require('../app/core/prosklisiFileGroups');
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

function locatePhysicalFile(prosklisiDir, fileName) {
  const { mainFilesDir } = dirsOf(prosklisiDir);
  return managedFileRename.findNamedFile(mainFilesDir, path.basename(String(fileName || '')));
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

function hoistFilesToAttachments(prosklisiDir, files) {
  const { attachmentsDir } = ensureBaseDirs(prosklisiDir);
  (files || []).forEach((file) => {
    const name = groupsCore.fileNameOf(file);
    if (!name) return;
    const found = locatePhysicalFile(prosklisiDir, name);
    if (!found || !fs.existsSync(found)) return;
    const dest = uniqueDestPath(attachmentsDir, path.basename(found));
    if (!dest) return;
    if (path.resolve(found) === path.resolve(dest)) return;
    fs.renameSync(found, dest);
  });
}

function dirContainsFiles(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return true;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isFile()) return true;
    if (entry.isDirectory() && dirContainsFiles(full)) return true;
  }
  return false;
}

function removeGroupFolderIfSafe(prosklisiDir, titlesPath) {
  const { mainFilesDir, attachmentsDir } = dirsOf(prosklisiDir);
  const folder = findGroupFolder(mainFilesDir, attachmentsDir, titlesPath);
  if (!folder) return;
  if (!isPathInside(folder, mainFilesDir)) return;
  if (folder === mainFilesDir || folder === attachmentsDir) return;
  try {
    if (!dirContainsFiles(folder)) {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  } catch {
    /* ignore */
  }
}

function organizeFiles(prosklisiDir, options) {
  const {
    action,
    title,
    groupId,
    parentGroupId,
    fileNames = [],
    newGroupId,
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
    const titleCheck = groupsCore.canUseGroupTitle(pulled.fileGroups, resolvedTitle, parentId || null);
    if (!titleCheck.ok) return titleCheck;
    const id = newGroupId || uuidv4();
    const newGroup = {
      id,
      title: resolvedTitle,
      files: pulled.files,
      subgroups: [],
    };
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

function deleteFiles(prosklisiDir, fileNames) {
  const loaded = readProsklisiData(prosklisiDir);
  if (!loaded.ok) return loaded;
  const names = Array.isArray(fileNames) ? fileNames.map((n) => path.basename(String(n || ''))).filter(Boolean) : [];
  if (!names.length) return { ok: false, error: 'Δεν δόθηκαν αρχεία' };

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
  return { ok: true, deleted: names.length - missing.length, missing };
}

function deleteGroup(prosklisiDir, groupId) {
  const loaded = readProsklisiData(prosklisiDir);
  if (!loaded.ok) return loaded;
  const titles = groupsCore.titlesPathForGroup(loaded.data.fileGroups, groupId);
  const removed = groupsCore.removeGroupById(loaded.data.fileGroups, groupId);
  if (!removed.removed) return { ok: false, error: 'Η ομάδα δεν βρέθηκε' };
  const files = groupsCore.flattenRemovedFiles(removed.removed);
  hoistFilesToAttachments(prosklisiDir, files);
  removeGroupFolderIfSafe(prosklisiDir, titles);
  persistProsklisiData(prosklisiDir, {
    ...loaded.data,
    fileGroups: removed.fileGroups,
    prosklisiFiles: [...(loaded.data.prosklisiFiles || []), ...files],
  });
  return { ok: true, title: removed.removed.title, files };
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

function listForUi(prosklisiDir) {
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
      if (bucket.some((f) => f.fileName === fileName)) return;
      bucket.push({
        fileName,
        originalName: file.originalName || fileName,
        isGrouped: false,
        targetFolder: file.targetFolder === 'main' ? 'main' : 'attachments',
      });
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
  deleteFiles,
  deleteGroup,
  rewriteRenamedFile,
  materializeFormGroups,
  listForUi,
  isPathInside,
};

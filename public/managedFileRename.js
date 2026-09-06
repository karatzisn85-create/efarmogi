/**
 * Μετονομασία φυσικού αρχείου εντός φακέλου δεδομένων — χωρίς άνοιγμα Εξερευνητή.
 */
const path = require('path');
const fs = require('fs');
const managedFiles = require('../app/core/managedFiles');

function resolveInside(dir, fileName) {
  if (!dir) return null;
  const root = path.resolve(dir);
  const base = path.basename(String(fileName || ''));
  if (!base || base === '.' || base === '..') return null;
  const dest = path.resolve(root, base);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (dest !== root && !dest.startsWith(prefix)) return null;
  return dest;
}

function samePathIgnoreCase(a, b) {
  return String(a || '').toLowerCase() === String(b || '').toLowerCase();
}

function renamePhysicalFile(dir, oldName, newName) {
  const from = resolveInside(dir, oldName);
  const to = resolveInside(dir, newName);
  if (!from || !to) return { ok: false, error: 'Μη επιτρεπτό όνομα αρχείου' };
  if (!fs.existsSync(from)) return { ok: false, error: 'Το αρχείο δεν βρέθηκε' };
  if (from === to) return { ok: true, newName: path.basename(to) };
  const caseOnlyChange = process.platform === 'win32' && samePathIgnoreCase(from, to);
  if (fs.existsSync(to) && !caseOnlyChange) {
    return { ok: false, error: 'Υπάρχει ήδη αρχείο με αυτό το όνομα' };
  }
  if (caseOnlyChange) {
    let tmp = null;
    for (let n = 0; n < 30; n += 1) {
      const tmpName = `.${path.basename(from)}.${process.pid}${n ? `.${n}` : ''}.case`;
      tmp = resolveInside(dir, tmpName);
      if (tmp && !fs.existsSync(tmp)) break;
      tmp = null;
    }
    if (!tmp) return { ok: false, error: 'Μη επιτρεπτό όνομα αρχείου' };
    fs.renameSync(from, tmp);
    try {
      fs.renameSync(tmp, to);
    } catch (err) {
      try { if (fs.existsSync(tmp)) fs.renameSync(tmp, from); } catch { /* επαναφορά */ }
      throw err;
    }
    return { ok: true, newName: path.basename(to) };
  }
  fs.renameSync(from, to);
  return { ok: true, newName: path.basename(to) };
}

function findNamedFile(rootDir, fileName, maxDepth = 6) {
  const target = path.basename(String(fileName || ''));
  if (!rootDir || !target || !fs.existsSync(rootDir)) return null;
  const targetKey = target.toLowerCase();
  const walk = (dir, depth, exactOnly) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
    let fuzzy = null;
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isFile()) {
        if (entry.name === target) return full;
        if (!exactOnly && !fuzzy && entry.name.toLowerCase() === targetKey) fuzzy = full;
      }
      if (entry.isDirectory() && depth < maxDepth) {
        const found = walk(full, depth + 1, exactOnly);
        if (found) return found;
      }
    }
    return fuzzy;
  };
  return walk(rootDir, 0, true) || walk(rootDir, 0, false);
}

function renameFoundFile(rootDir, oldName, newName) {
  const found = findNamedFile(rootDir, oldName);
  if (!found) return { ok: false, error: 'Το αρχείο δεν βρέθηκε' };
  return renamePhysicalFile(path.dirname(found), oldName, newName);
}

function planRename(oldName, typedName) {
  return managedFiles.buildRenamedFileName(oldName, typedName);
}

module.exports = {
  resolveInside,
  renamePhysicalFile,
  findNamedFile,
  renameFoundFile,
  planRename,
};

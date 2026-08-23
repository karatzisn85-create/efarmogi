/**
 * Ασφαλής πλήρης επαναφορά: αντιγραφή από έτοιμο φάκελο πάνω στα ζωντανά δεδομένα,
 * χωρίς να αγγίζει αντίγραφα / κλειδώματα / προσωρινά.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');

const DEFAULT_EXCLUDE = new Set([
  'backups',
  'locks',
  'app-config.json',
  'data-dir.json',
  'backup_settings.json',
  'backup_location.json',
]);

function isProtectedEntry(name, opts) {
  const exclude = (opts && opts.exclude) || DEFAULT_EXCLUDE;
  if (!name || exclude.has(name)) return true;
  if (name.startsWith('.')) return true;
  if (name.startsWith('temp_')) return true;
  const dataDir = opts && opts.dataDir;
  const backupDir = opts && opts.backupDir;
  if (dataDir && backupDir && path.resolve(dataDir, name) === path.resolve(backupDir)) {
    return true;
  }
  return false;
}

function resolveExtractedSourceDir(tempExtractDir) {
  if (!tempExtractDir || !fs.existsSync(tempExtractDir)) return null;
  const nested = path.join(tempExtractDir, 'dedomena_ergon');
  return fs.existsSync(nested) ? nested : tempExtractDir;
}

function listRestoreEntries(dir, opts) {
  if (!dir || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => !isProtectedEntry(name, opts));
}

function isExtractedRestoreReady(sourceDir, opts) {
  return listRestoreEntries(sourceDir, opts).length > 0;
}

function resolveSafeExtractPath(extractTo, entryName) {
  const root = path.resolve(extractTo);
  const resolved = path.resolve(root, entryName);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

function yieldTick() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function applyFullRestore(input) {
  const opts = input || {};
  const dataDir = opts.dataDir;
  const sourceDir = opts.sourceDir;
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
  if (!dataDir || !sourceDir) {
    throw new Error('Απαιτείται φάκελος δεδομένων και προέλευσης');
  }
  const ctx = {
    dataDir,
    backupDir: opts.backupDir,
    exclude: opts.exclude || DEFAULT_EXCLUDE,
  };
  if (!isExtractedRestoreReady(sourceDir, ctx)) {
    throw new Error('Το αντίγραφο είναι κενό ή δεν μπορεί να διαβαστεί.');
  }

  const sourceNames = fs.readdirSync(sourceDir);
  const toCopy = sourceNames.filter((name) => !isProtectedEntry(name, ctx));
  const applied = [];
  for (let i = 0; i < toCopy.length; i++) {
    const name = toCopy[i];
    const src = path.join(sourceDir, name);
    const dest = path.join(dataDir, name);
    const st = fs.statSync(src);
    if (st.isDirectory()) {
      if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
      fse.copySync(src, dest);
    } else {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      fs.copyFileSync(src, dest);
    }
    applied.push(name);
    if (onProgress) {
      onProgress({
        phase: opts.phase || 'restore-apply',
        entries: i + 1,
        total: toCopy.length,
        current: name,
      });
    }
    await yieldTick();
  }

  const sourceSet = new Set(toCopy);
  for (const name of fs.readdirSync(dataDir)) {
    if (isProtectedEntry(name, ctx)) continue;
    if (sourceSet.has(name)) continue;
    const dest = path.join(dataDir, name);
    const st = fs.statSync(dest);
    if (st.isDirectory()) fs.rmSync(dest, { recursive: true, force: true });
    else fs.unlinkSync(dest);
  }

  return { applied };
}

module.exports = {
  DEFAULT_EXCLUDE,
  isProtectedEntry,
  resolveExtractedSourceDir,
  isExtractedRestoreReady,
  resolveSafeExtractPath,
  applyFullRestore,
};

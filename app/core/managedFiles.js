/**
 * Ονόματα αρχείων: μετονομασία, διπλότυπα, χωρίς άνοιγμα φακέλου δίσκου.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubManagedFiles = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ILLEGAL = /[\\/:*?"<>|]/;

  function fileBaseName(fileName) {
    var raw = String(fileName || '');
    var parts = raw.split(/[/\\]/);
    return parts[parts.length - 1] || '';
  }

  function nameKey(fileName) {
    return fileBaseName(fileName).toLowerCase();
  }

  function toNameKeySet(used) {
    var taken = new Set();
    if (!used) return taken;
    if (typeof used.forEach === 'function') {
      used.forEach(function (n) {
        var k = nameKey(n);
        if (k) taken.add(k);
      });
      return taken;
    }
    return taken;
  }

  function splitFileName(fileName) {
    var base = fileBaseName(fileName);
    var lastDot = base.lastIndexOf('.');
    if (lastDot <= 0) return { stem: base, ext: '' };
    return { stem: base.slice(0, lastDot), ext: base.slice(lastDot) };
  }

  function entryName(entry) {
    if (typeof entry === 'string') return fileBaseName(entry);
    if (!entry || typeof entry !== 'object') return '';
    return fileBaseName(entry.name || entry.fileName || '');
  }

  function collectExistingFileNames(files, fileGroups) {
    var names = [];
    (files || []).forEach(function (f) {
      var n = entryName(f);
      if (n) names.push(n);
    });
    (fileGroups || []).forEach(function (g) {
      ((g && g.files) || []).forEach(function (f) {
        var n = entryName(f);
        if (n) names.push(n);
      });
    });
    return names;
  }

  function findNameConflicts(incomingNames, existingNames) {
    var existing = {};
    (existingNames || []).forEach(function (n) {
      var k = nameKey(n);
      if (k) existing[k] = true;
    });
    var seenConflict = {};
    var conflicts = [];
    var unique = [];
    (incomingNames || []).forEach(function (raw) {
      var name = fileBaseName(raw);
      if (!name) return;
      var k = nameKey(name);
      if (existing[k]) {
        if (!seenConflict[k]) {
          seenConflict[k] = true;
          conflicts.push(name);
        }
      } else unique.push(name);
    });
    return { conflicts: conflicts, unique: unique };
  }

  function nextAvailableName(desiredName, used) {
    var name = fileBaseName(desiredName);
    if (!name) return '';
    var taken = toNameKeySet(used);
    if (!taken.has(nameKey(name))) return name;
    var parts = splitFileName(name);
    var n = 1;
    var candidate;
    do {
      candidate = parts.stem + ' (' + n + ')' + parts.ext;
      n += 1;
    } while (taken.has(nameKey(candidate)));
    return candidate;
  }

  /**
   * policy: 'replace' | 'keep-both'
   * Επιστρέφει λίστα { original, dest, replace }
   */
  function applyConflictPolicy(incomingNames, existingNames, policy) {
    var used = new Set();
    var canonical = {};
    (existingNames || []).forEach(function (n) {
      var base = fileBaseName(n);
      if (!base) return;
      var k = nameKey(base);
      used.add(k);
      if (!canonical[k]) canonical[k] = base;
    });
    var replaceMode = policy === 'replace';
    var out = [];
    (incomingNames || []).forEach(function (raw) {
      var original = fileBaseName(raw);
      if (!original) {
        out.push({ original: '', dest: '', replace: false });
        return;
      }
      var key = nameKey(original);
      var exists = used.has(key);
      var dest = original;
      var replace = false;
      if (exists && replaceMode) {
        replace = true;
        dest = canonical[key] || original;
      } else if (exists) {
        dest = nextAvailableName(original, used);
        used.add(nameKey(dest));
        canonical[nameKey(dest)] = dest;
      } else {
        used.add(key);
        canonical[key] = dest;
      }
      out.push({ original: original, dest: dest, replace: replace });
    });
    return out;
  }

  function buildRenamedFileName(oldName, typedName) {
    var oldBase = fileBaseName(oldName);
    var typed = String(typedName || '').trim();
    if (!oldBase) return { ok: false, error: 'Δεν ορίστηκε αρχείο' };
    if (!typed) return { ok: false, error: 'Δώστε ένα όνομα αρχείου' };
    if (typed.indexOf('..') !== -1 || /[\\/]/.test(typed)) {
      return { ok: false, error: 'Μη έγκυρο όνομα αρχείου' };
    }
    if (ILLEGAL.test(typed)) {
      return { ok: false, error: 'Το όνομα περιέχει μη επιτρεπτούς χαρακτήρες' };
    }
    var old = splitFileName(oldBase);
    var stem = typed;
    if (old.ext && stem.toLowerCase().endsWith(old.ext.toLowerCase())) {
      stem = stem.slice(0, -old.ext.length);
    }
    stem = String(stem || '').trim();
    if (!stem) return { ok: false, error: 'Δώστε ένα όνομα αρχείου' };
    var newName = fileBaseName(stem + old.ext);
    if (!newName || newName === '.' || newName === '..') {
      return { ok: false, error: 'Μη έγκυρο όνομα αρχείου' };
    }
    return { ok: true, newName: newName };
  }

  function renameEntry(entry, oldName, newName) {
    if (typeof entry === 'string') {
      return entry === oldName ? newName : entry;
    }
    if (!entry || typeof entry !== 'object') return entry;
    var n = entry.name || entry.fileName || '';
    if (n !== oldName) return entry;
    var next = Object.assign({}, entry);
    if (Object.prototype.hasOwnProperty.call(entry, 'name')) next.name = newName;
    if (Object.prototype.hasOwnProperty.call(entry, 'fileName')) next.fileName = newName;
    if (typeof entry.path === 'string' && entry.path) {
      next.path = String(entry.path).replace(/[^/\\]+$/, newName);
    }
    return next;
  }

  function renameFileInSubprojectData(data, oldName, newName) {
    if (!data || !oldName || !newName || oldName === newName) return data;
    if (Array.isArray(data.files)) {
      data.files = data.files.map(function (f) { return renameEntry(f, oldName, newName); });
    }
    if (Array.isArray(data.subprojectFiles)) {
      data.subprojectFiles = data.subprojectFiles.map(function (f) { return renameEntry(f, oldName, newName); });
    }
    if (Array.isArray(data.fileGroups)) {
      data.fileGroups = data.fileGroups.map(function (group) {
        return Object.assign({}, group, {
          files: (group.files || []).map(function (f) { return renameEntry(f, oldName, newName); })
        });
      });
    }
    return data;
  }

  function renameFileInStringList(list, oldName, newName) {
    return (list || []).map(function (item) {
      return item === oldName ? newName : item;
    });
  }

  return {
    fileBaseName: fileBaseName,
    splitFileName: splitFileName,
    entryName: entryName,
    collectExistingFileNames: collectExistingFileNames,
    findNameConflicts: findNameConflicts,
    nextAvailableName: nextAvailableName,
    applyConflictPolicy: applyConflictPolicy,
    buildRenamedFileName: buildRenamedFileName,
    renameEntry: renameEntry,
    renameFileInSubprojectData: renameFileInSubprojectData,
    renameFileInStringList: renameFileInStringList
  };
});

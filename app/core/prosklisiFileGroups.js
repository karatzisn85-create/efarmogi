/**
 * Ομάδες / υποομάδες αρχείων πρόσκλησης — χωρίς άνοιγμα δίσκου.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubProsklisiFileGroups = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ATTACHMENTS_WRAPPER = 'Επισυναπτόμενα Αρχεία Υποβολής';
  var FILES_EXPORT_WRAPPER = 'Αρχεία πρόσκλησης';
  var ORIMANTHI_GROUP_TITLE = 'Αρχεία από την ωρίμανση';

  function sanitizeFolderName(name, maxLen) {
    var limit = maxLen || 50;
    var sanitized = String(name || 'Ομάδα')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/[\x00-\x1f]/g, '')
      .trim();
    if (!sanitized) sanitized = 'Ομάδα';
    if (sanitized.length > limit) sanitized = sanitized.substring(0, limit).trim();
    return sanitized || 'Ομάδα';
  }

  function isWrapperFolderName(name) {
    var n = String(name || '');
    return n === ATTACHMENTS_WRAPPER || n === FILES_EXPORT_WRAPPER;
  }

  function fileNameOf(entry) {
    if (typeof entry === 'string') return entry;
    if (!entry || typeof entry !== 'object') return '';
    return String(entry.fileName || entry.originalName || entry.name || '');
  }

  function normalizeGroup(group) {
    var g = group || {};
    return {
      id: g.id,
      title: String(g.title || '').trim() || 'Ομάδα',
      files: Array.isArray(g.files) ? g.files.slice() : [],
      subgroups: (g.subgroups || []).map(normalizeGroup)
    };
  }

  function cloneGroups(groups) {
    return (groups || []).map(normalizeGroup);
  }

  function flattenGroups(groups, parentId, prefix, acc) {
    var out = acc || [];
    (groups || []).forEach(function (g) {
      if (!g || !g.id) return;
      var label = prefix ? prefix + ' › ' + (g.title || '') : (g.title || '');
      out.push({
        id: g.id,
        title: g.title || '',
        label: label,
        parentId: parentId || null
      });
      flattenGroups(g.subgroups, g.id, label, out);
    });
    return out;
  }

  function findGroupById(groups, groupId) {
    var list = groups || [];
    for (var i = 0; i < list.length; i += 1) {
      var g = list[i];
      if (g && g.id === groupId) return g;
      var nested = findGroupById(g && g.subgroups, groupId);
      if (nested) return nested;
    }
    return null;
  }

  function titlesPathForGroup(groups, groupId) {
    function walk(list, pathTitles) {
      var items = list || [];
      for (var i = 0; i < items.length; i += 1) {
        var g = items[i];
        if (!g) continue;
        var next = pathTitles.concat([g.title || 'Ομάδα']);
        if (g.id === groupId) return next;
        var nested = walk(g.subgroups, next);
        if (nested) return nested;
      }
      return null;
    }
    return walk(groups, []) || [];
  }

  function collectGroupFileNames(groups) {
    var names = [];
    function walk(list) {
      (list || []).forEach(function (g) {
        ((g && g.files) || []).forEach(function (f) {
          var n = fileNameOf(f);
          if (n) names.push(n);
        });
        walk(g && g.subgroups);
      });
    }
    walk(groups);
    return names;
  }

  function countGroupFiles(group) {
    if (!group) return 0;
    var n = (group.files || []).length;
    (group.subgroups || []).forEach(function (sg) {
      n += countGroupFiles(sg);
    });
    return n;
  }

  function pullFilesByName(prosklisiFiles, groups, fileNames) {
    var wanted = {};
    (fileNames || []).forEach(function (n) {
      var key = String(n || '');
      if (key) wanted[key] = true;
    });
    var pulled = [];
    var remainingUngrouped = [];
    (prosklisiFiles || []).forEach(function (f) {
      var n = fileNameOf(f);
      if (wanted[n]) pulled.push(f);
      else remainingUngrouped.push(f);
    });
    function strip(list) {
      return (list || []).map(function (g) {
        var files = [];
        (g.files || []).forEach(function (f) {
          var n = fileNameOf(f);
          if (wanted[n]) pulled.push(f);
          else files.push(f);
        });
        return {
          id: g.id,
          title: g.title,
          files: files,
          subgroups: strip(g.subgroups)
        };
      });
    }
    return {
      files: pulled,
      prosklisiFiles: remainingUngrouped,
      fileGroups: strip(groups)
    };
  }

  function addFilesToGroup(groups, groupId, files) {
    return (groups || []).map(function (g) {
      if (g.id === groupId) {
        return {
          id: g.id,
          title: g.title,
          files: (g.files || []).concat(files || []),
          subgroups: g.subgroups || []
        };
      }
      return {
        id: g.id,
        title: g.title,
        files: g.files || [],
        subgroups: addFilesToGroup(g.subgroups, groupId, files)
      };
    });
  }

  function createGroup(groups, newGroup) {
    return (groups || []).concat([normalizeGroup(newGroup)]);
  }

  function titleKey(title) {
    return sanitizeFolderName(String(title || '').trim() || 'Ομάδα').toLowerCase();
  }

  function siblingGroups(groups, parentId) {
    if (!parentId) return groups || [];
    var parent = findGroupById(groups, parentId);
    return (parent && parent.subgroups) || [];
  }

  function canUseGroupTitle(groups, title, parentId) {
    var key = titleKey(title);
    if (!parentId && key === titleKey(ORIMANTHI_GROUP_TITLE)) {
      return {
        ok: false,
        error: 'Η ομάδα «' + ORIMANTHI_GROUP_TITLE + '» δημιουργείται αυτόματα από την ωρίμανση. Δώστε άλλο όνομα.'
      };
    }
    var siblings = siblingGroups(groups, parentId);
    for (var i = 0; i < siblings.length; i += 1) {
      if (titleKey(siblings[i] && siblings[i].title) === key) {
        return { ok: false, error: 'Υπάρχει ήδη ομάδα με αυτό το όνομα. Δώστε διαφορετικό τίτλο.' };
      }
    }
    return { ok: true };
  }

  function createSubgroup(groups, parentId, newGroup) {
    return (groups || []).map(function (g) {
      if (g.id === parentId) {
        return {
          id: g.id,
          title: g.title,
          files: g.files || [],
          subgroups: (g.subgroups || []).concat([normalizeGroup(newGroup)])
        };
      }
      return {
        id: g.id,
        title: g.title,
        files: g.files || [],
        subgroups: createSubgroup(g.subgroups, parentId, newGroup)
      };
    });
  }

  function removeGroupById(groups, groupId) {
    var removed = null;
    function walk(list) {
      var out = [];
      (list || []).forEach(function (g) {
        if (g && g.id === groupId) {
          removed = g;
          return;
        }
        out.push({
          id: g.id,
          title: g.title,
          files: g.files || [],
          subgroups: walk(g.subgroups)
        });
      });
      return out;
    }
    return { fileGroups: walk(groups), removed: removed };
  }

  function flattenRemovedFiles(group) {
    if (!group) return [];
    var files = (group.files || []).slice();
    (group.subgroups || []).forEach(function (sg) {
      files = files.concat(flattenRemovedFiles(sg));
    });
    return files;
  }

  function removeFilesFromTree(prosklisiFiles, groups, fileNames) {
    var wanted = {};
    (fileNames || []).forEach(function (n) {
      var key = String(n || '');
      if (key) wanted[key] = true;
    });
    function walk(list) {
      return (list || []).map(function (g) {
        return {
          id: g.id,
          title: g.title,
          files: (g.files || []).filter(function (f) { return !wanted[fileNameOf(f)]; }),
          subgroups: walk(g.subgroups)
        };
      });
    }
    return {
      prosklisiFiles: (prosklisiFiles || []).filter(function (f) { return !wanted[fileNameOf(f)]; }),
      fileGroups: walk(groups)
    };
  }

  function rewriteFileName(prosklisiFiles, groups, oldName, newName) {
    function rewriteEntry(entry) {
      if (!entry || typeof entry !== 'object') return entry;
      var next = {};
      Object.keys(entry).forEach(function (k) { next[k] = entry[k]; });
      if (next.fileName === oldName) next.fileName = newName;
      if (next.originalName === oldName) next.originalName = newName;
      return next;
    }
    function walk(list) {
      return (list || []).map(function (g) {
        return {
          id: g.id,
          title: g.title,
          files: (g.files || []).map(rewriteEntry),
          subgroups: walk(g.subgroups)
        };
      });
    }
    return {
      prosklisiFiles: (prosklisiFiles || []).map(rewriteEntry),
      fileGroups: walk(groups)
    };
  }

  function applyFormChoice(fileGroups, ungroupedFiles, choice, newFiles, newGroupId) {
    var groups = cloneGroups(fileGroups);
    var ungrouped = (ungroupedFiles || []).slice();
    var files = (newFiles || []).slice();
    if (choice === null) {
      return { fileGroups: groups, ungroupedFiles: ungrouped };
    }
    if (choice && choice.action === 'new') {
      return {
        fileGroups: createGroup(groups, { id: newGroupId, title: choice.title, files: files, subgroups: [] }),
        ungroupedFiles: ungrouped
      };
    }
    if (choice && choice.action === 'existing') {
      return {
        fileGroups: addFilesToGroup(groups, choice.groupId, files),
        ungroupedFiles: ungrouped
      };
    }
    if (choice && choice.action === 'subgroup') {
      return {
        fileGroups: createSubgroup(groups, choice.parentId, {
          id: newGroupId,
          title: choice.title,
          files: files,
          subgroups: []
        }),
        ungroupedFiles: ungrouped
      };
    }
    return { fileGroups: groups, ungroupedFiles: ungrouped.concat(files) };
  }

  function topLevelGroupFolderNames(groups) {
    var names = {};
    (groups || []).forEach(function (g) {
      if (!g) return;
      names[String(g.title || '')] = true;
      names[sanitizeFolderName(g.title)] = true;
    });
    return names;
  }

  function isBlankOrimanthiSubtitle(value) {
    var s = String(value || '').trim();
    if (!s) return true;
    if (s === '—' || s === '-' || s === '–' || s === '−') return true;
    if (s === 'Εξειδίκευση') return true;
    return false;
  }

  function uniqueProposalKeys(files) {
    var seen = {};
    var keys = [];
    (files || []).forEach(function (lf) {
      var key = String((lf && (lf.sourceProposalId || lf.sourceProposalTitle)) || '').trim() || '__none__';
      if (!seen[key]) {
        seen[key] = true;
        keys.push(key);
      }
    });
    return keys;
  }

  function makeLinkedSubgroup(id, title, files, subgroups) {
    return {
      id: id,
      title: title,
      files: files || [],
      subgroups: subgroups || [],
      linked: true
    };
  }

  function nestLinkedByCategory(items, idPrefix) {
    var cats = {};
    var order = [];
    (items || []).forEach(function (lf) {
      var cat = String((lf && lf.categoryLabel) || 'ΑΡΧΕΙΑ ΩΡΙΜΑΝΣΗΣ').trim() || 'ΑΡΧΕΙΑ ΩΡΙΜΑΝΣΗΣ';
      if (!cats[cat]) {
        cats[cat] = [];
        order.push(cat);
      }
      cats[cat].push(lf);
    });
    return order.map(function (cat) {
      var bucket = cats[cat];
      var specs = {};
      var specOrder = [];
      bucket.forEach(function (lf) {
        var spec = isBlankOrimanthiSubtitle(lf && lf.subtitle) ? '' : String(lf.subtitle).trim();
        if (!specs[spec]) {
          specs[spec] = [];
          specOrder.push(spec);
        }
        specs[spec].push(lf);
      });
      var direct = [];
      var subs = [];
      specOrder.forEach(function (spec) {
        if (!spec) {
          direct = direct.concat(specs[spec]);
        } else {
          subs.push(makeLinkedSubgroup(idPrefix + '/' + cat + '/' + spec, spec, specs[spec], []));
        }
      });
      return makeLinkedSubgroup(idPrefix + '/' + cat, cat, direct, subs);
    });
  }

  function buildOrimanthiLinkedGroup(linkedFiles) {
    var files = (linkedFiles || []).filter(Boolean);
    if (!files.length) return null;
    var keys = uniqueProposalKeys(files);
    var subgroups;
    if (keys.length > 1) {
      var byKey = {};
      files.forEach(function (lf) {
        var key = String((lf && (lf.sourceProposalId || lf.sourceProposalTitle)) || '').trim() || '__none__';
        if (!byKey[key]) {
          byKey[key] = {
            title: (lf && lf.sourceProposalTitle) || 'Έργο ωρίμανσης',
            items: []
          };
        }
        byKey[key].items.push(lf);
      });
      subgroups = keys.map(function (key) {
        var bucket = byKey[key];
        return makeLinkedSubgroup(
          'orimanthi/' + key,
          bucket.title,
          [],
          nestLinkedByCategory(bucket.items, 'orimanthi/' + key)
        );
      });
    } else {
      subgroups = nestLinkedByCategory(files, 'orimanthi');
    }
    return makeLinkedSubgroup('orimanthi-linked', ORIMANTHI_GROUP_TITLE, [], subgroups);
  }

  function orimanthiExportDirSegments(file, allFiles) {
    var segs = [ORIMANTHI_GROUP_TITLE];
    var files = allFiles || [];
    if (uniqueProposalKeys(files).length > 1) {
      segs.push(sanitizeFolderName((file && file.sourceProposalTitle) || 'Έργο ωρίμανσης', 80));
    }
    segs.push(sanitizeFolderName((file && file.categoryLabel) || 'ΑΡΧΕΙΑ ΩΡΙΜΑΝΣΗΣ', 80));
    if (!isBlankOrimanthiSubtitle(file && file.subtitle)) {
      segs.push(sanitizeFolderName(file.subtitle, 80));
    }
    return segs;
  }

  return {
    ATTACHMENTS_WRAPPER: ATTACHMENTS_WRAPPER,
    FILES_EXPORT_WRAPPER: FILES_EXPORT_WRAPPER,
    ORIMANTHI_GROUP_TITLE: ORIMANTHI_GROUP_TITLE,
    sanitizeFolderName: sanitizeFolderName,
    isWrapperFolderName: isWrapperFolderName,
    fileNameOf: fileNameOf,
    normalizeGroup: normalizeGroup,
    cloneGroups: cloneGroups,
    flattenGroups: flattenGroups,
    findGroupById: findGroupById,
    titlesPathForGroup: titlesPathForGroup,
    collectGroupFileNames: collectGroupFileNames,
    countGroupFiles: countGroupFiles,
    pullFilesByName: pullFilesByName,
    addFilesToGroup: addFilesToGroup,
    createGroup: createGroup,
    createSubgroup: createSubgroup,
    removeGroupById: removeGroupById,
    flattenRemovedFiles: flattenRemovedFiles,
    removeFilesFromTree: removeFilesFromTree,
    rewriteFileName: rewriteFileName,
    applyFormChoice: applyFormChoice,
    topLevelGroupFolderNames: topLevelGroupFolderNames,
    isBlankOrimanthiSubtitle: isBlankOrimanthiSubtitle,
    buildOrimanthiLinkedGroup: buildOrimanthiLinkedGroup,
    orimanthiExportDirSegments: orimanthiExportDirSegments,
    canUseGroupTitle: canUseGroupTitle
  };
});

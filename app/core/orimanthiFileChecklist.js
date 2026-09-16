/**
 * Κατάλογος μελετών / αδειοδοτήσεων για καρτέλα έργου ωρίμανσης
 * και για την εξαγωγή Excel. Χωρίς αποθήκευση στον δίσκο.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubOrimanthiFileChecklist = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ROOT_MELETES = 'meletes';
  var ROOT_ADEIODOTISEIS = 'adeiodotiseis';
  var LABEL_SEP = ' · ';
  var ROOT_LABELS = {
    meletes: 'ΜΕΛΕΤΕΣ ΕΡΓΟΥ',
    adeiodotiseis: 'ΑΔΕΙΟΔΟΤΗΣΕΙΣ'
  };

  var MARK_HAS_FILE = '✓';
  var MARK_NO_FILE = '—';
  var MARK_PERMIT_ISSUED = '✓';
  var MARK_PERMIT_APPLIED = 'Αιτ.';
  var MARK_PERMIT_PENDING = '×';
  var MAX_IMPLEMENTATION_SUBPROJECTS = 30;

  function clampImplementationSubprojectCount(value) {
    var n = parseInt(value, 10);
    if (!isFinite(n) || n < 1) n = 1;
    if (n > MAX_IMPLEMENTATION_SUBPROJECTS) n = MAX_IMPLEMENTATION_SUBPROJECTS;
    return n;
  }

  function resizeImplementationSubprojectTitles(currentTitles, nextCount) {
    var count = clampImplementationSubprojectCount(nextCount);
    var src = Array.isArray(currentTitles) ? currentTitles : [];
    var titles = [];
    var i;
    for (i = 0; i < count; i += 1) {
      titles.push(String(src[i] != null ? src[i] : ''));
    }
    return { count: count, titles: titles };
  }

  function liveImplementationSubprojects(proposal) {
    var srcTitles = Array.isArray(proposal && proposal.implementationSubprojectTitles)
      ? proposal.implementationSubprojectTitles
      : [];
    var rawCount = proposal && proposal.implementationSubprojectCount != null
      ? proposal.implementationSubprojectCount
      : (srcTitles.length || 1);
    return resizeImplementationSubprojectTitles(srcTitles, rawCount);
  }

  function normalizeImplementationSubprojects(proposal) {
    var next = liveImplementationSubprojects(proposal);
    next.titles = next.titles.map(function (title) {
      return String(title || '').trim();
    });
    return next;
  }

  function formatSubprojectExportLine(index, title) {
    var text = String(title || '').trim();
    return (index + 1) + '. ' + (text || '—');
  }

  function parseFileGroupLabel(label) {
    var text = String(label || '').trim();
    if (!text) return { rootId: null, spec: null };
    var keys = Object.keys(ROOT_LABELS);
    for (var i = 0; i < keys.length; i += 1) {
      var rootId = keys[i];
      var prefix = ROOT_LABELS[rootId] + LABEL_SEP;
      if (text.indexOf(prefix) === 0) {
        return { rootId: rootId, spec: text.slice(prefix.length).trim() };
      }
    }
    return { rootId: null, spec: text };
  }

  function getFileGroupIdentity(group) {
    if (group && group.fileCategoryRoot && group.fileCategorySpec) {
      return {
        rootId: group.fileCategoryRoot,
        spec: String(group.fileCategorySpec).trim()
      };
    }
    return parseFileGroupLabel(group && group.label);
  }

  function isAdeiodotiseisGroup(group) {
    return getFileGroupIdentity(group).rootId === ROOT_ADEIODOTISEIS;
  }

  function isMeletesGroup(group) {
    return getFileGroupIdentity(group).rootId === ROOT_MELETES;
  }

  function getRootLabel(rootId) {
    return ROOT_LABELS[rootId] || '';
  }

  // Κατηγορία (ρίζα) + υπότιτλος (εξειδίκευση) μιας ομάδας αρχείων.
  // Χρησιμοποιείται για την προβολή συνδεδεμένων αρχείων στις προσκλήσεις.
  function getGroupCategoryInfo(group) {
    var identity = getFileGroupIdentity(group);
    return {
      rootId: identity.rootId || null,
      rootLabel: getRootLabel(identity.rootId),
      spec: (identity.spec || '').trim()
    };
  }

  function isProsklisiLinkableGroup(group) {
    var rootId = getFileGroupIdentity(group).rootId;
    return rootId === ROOT_MELETES || rootId === ROOT_ADEIODOTISEIS;
  }

  function countGroupFiles(group) {
    return ((group && group.files) || []).reduce(function (sum, entry) {
      if (entry && entry.kind === 'folder') return sum + (entry.fileCount || 0);
      return sum + 1;
    }, 0);
  }

  function isPermitIssued(group) {
    return !!(group && group.permitIssued);
  }

  function isPermitApplied(group) {
    return !!(group && group.permitApplied);
  }

  function studyMark(group) {
    return countGroupFiles(group) > 0 ? MARK_HAS_FILE : MARK_NO_FILE;
  }

  function permitMark(group) {
    if (isPermitIssued(group)) return MARK_PERMIT_ISSUED;
    if (isPermitApplied(group)) return MARK_PERMIT_APPLIED;
    return MARK_PERMIT_PENDING;
  }

  function classifyGroup(group) {
    var identity = getFileGroupIdentity(group);
    if (identity.rootId === ROOT_ADEIODOTISEIS) {
      var permitKind = 'pending';
      if (isPermitIssued(group)) permitKind = 'issued';
      else if (isPermitApplied(group)) permitKind = 'applied';
      return {
        rootId: ROOT_ADEIODOTISEIS,
        spec: identity.spec || (group && group.label) || 'Αδειοδότηση',
        mark: permitMark(group),
        kind: permitKind
      };
    }
    return {
      rootId: identity.rootId === ROOT_MELETES ? ROOT_MELETES : ROOT_MELETES,
      spec: identity.spec || (group && group.label) || 'Μελέτη',
      mark: studyMark(group),
      kind: countGroupFiles(group) > 0 ? 'hasFile' : 'noFile'
    };
  }

  function formatAepoDate(value) {
    if (!value) return '';
    var isoMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return isoMatch[3] + '/' + isoMatch[2] + '/' + isoMatch[1];
    var d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      var day = String(d.getDate()).padStart(2, '0');
      var month = String(d.getMonth() + 1).padStart(2, '0');
      return day + '/' + month + '/' + d.getFullYear();
    }
    return String(value);
  }

  function buildProposalCard(proposal) {
    var groups = (proposal && proposal.fileGroups) || [];
    var meletes = [];
    var adeiodotiseis = [];
    var other = [];
    groups.forEach(function (group) {
      var identity = getFileGroupIdentity(group);
      var row = classifyGroup(group);
      if (identity.rootId === ROOT_ADEIODOTISEIS) adeiodotiseis.push(row);
      else if (identity.rootId === ROOT_MELETES) meletes.push(row);
      else other.push(row);
    });
    var files = groups.reduce(function (sum, g) { return sum + countGroupFiles(g); }, 0);
    var category = [
      (proposal && proposal.projectCategory) || '',
      (proposal && proposal.infrastructureSpecialization) || ''
    ].filter(Boolean).join(' · ');
    var subprojects = normalizeImplementationSubprojects(proposal);
    return {
      title: (proposal && proposal.title) || '(Χωρίς τίτλο)',
      status: (proposal && proposal.status) || '',
      actionResponsible: String((proposal && proposal.actionResponsible) || '').trim() || '—',
      subprojectCount: subprojects.count,
      subprojectTitles: subprojects.titles,
      category: category || '—',
      municipalUnit: (proposal && proposal.municipalUnit) || '—',
      settlement: (proposal && proposal.settlement) || '—',
      aepo: (proposal && proposal.aepoRenewalDate)
        ? formatAepoDate(proposal.aepoRenewalDate)
        : '—',
      files: files,
      description: String((proposal && proposal.description) || '').trim(),
      notes: String((proposal && proposal.notes) || '').trim(),
      meletes: meletes.concat(other),
      adeiodotiseis: adeiodotiseis
    };
  }

  function buildHubCards(proposals) {
    return (proposals || []).map(buildProposalCard);
  }

  function setGroupPermitFlags(fileGroups, groupId, flags) {
    var patch = flags || {};
    return (fileGroups || []).map(function (group) {
      if (!group || group.id !== groupId) return group;
      var next = Object.assign({}, group);
      if (Object.prototype.hasOwnProperty.call(patch, 'permitIssued')) {
        next.permitIssued = !!patch.permitIssued;
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'permitApplied')) {
        next.permitApplied = !!patch.permitApplied;
      }
      return next;
    });
  }

  function setGroupPermitIssued(fileGroups, groupId, issued) {
    return setGroupPermitFlags(fileGroups, groupId, { permitIssued: issued });
  }

  function applyPermitIssuedFromSaved(local, saved, groupId) {
    if (!local) return local;
    var diskGroup = ((saved && saved.fileGroups) || []).filter(function (g) {
      return g && g.id === groupId;
    })[0];
    var localGroup = ((local.fileGroups) || []).filter(function (g) {
      return g && g.id === groupId;
    })[0];
    var issued = diskGroup ? !!diskGroup.permitIssued : !!(localGroup && localGroup.permitIssued);
    var applied = diskGroup
      ? !!diskGroup.permitApplied
      : !!(localGroup && localGroup.permitApplied);
    return Object.assign({}, local, {
      updatedAt: (saved && saved.updatedAt) || local.updatedAt,
      fileGroups: ((local.fileGroups) || []).map(function (g) {
        if (!g || g.id !== groupId) return g;
        return Object.assign({}, g, { permitIssued: issued, permitApplied: applied });
      })
    });
  }

  function mergeFileGroupsFromDisk(localGroups, savedGroups) {
    var localList = localGroups || [];
    var savedList = savedGroups || [];
    var localById = {};
    localList.forEach(function (group) {
      if (group && group.id) localById[group.id] = group;
    });
    var savedIds = {};
    var merged = savedList.map(function (savedGroup) {
      if (!savedGroup) return savedGroup;
      savedIds[savedGroup.id] = true;
      var localGroup = localById[savedGroup.id];
      if (!localGroup) return savedGroup;
      var overlay = {};
      if (Object.prototype.hasOwnProperty.call(localGroup, 'permitIssued')) {
        overlay.permitIssued = localGroup.permitIssued;
      }
      if (Object.prototype.hasOwnProperty.call(localGroup, 'permitApplied')) {
        overlay.permitApplied = localGroup.permitApplied;
      }
      if (!Object.keys(overlay).length) return savedGroup;
      return Object.assign({}, savedGroup, overlay);
    });
    localList.forEach(function (localGroup) {
      if (localGroup && localGroup.id && !savedIds[localGroup.id]) merged.push(localGroup);
    });
    return merged;
  }

  function mergeProposalFromDisk(local, saved) {
    if (!saved) return local;
    if (!local) return saved;
    return Object.assign({}, local, saved, {
      title: local.title,
      status: local.status,
      actionResponsible: local.actionResponsible,
      projectCategory: local.projectCategory,
      infrastructureSpecialization: local.infrastructureSpecialization,
      municipalUnit: local.municipalUnit,
      settlement: local.settlement,
      aepoRenewalDate: local.aepoRenewalDate,
      description: local.description,
      notes: local.notes,
      implementationSubprojectCount: local.implementationSubprojectCount,
      implementationSubprojectTitles: local.implementationSubprojectTitles,
      updatedAt: saved.updatedAt || local.updatedAt,
      fileGroups: mergeFileGroupsFromDisk(local.fileGroups, saved.fileGroups)
    });
  }

  function buildPersistedFileGroupFromStaged(group, files) {
    return {
      id: group && group.id,
      label: group && group.label,
      fileCategoryRoot: group && group.fileCategoryRoot,
      fileCategorySpec: group && group.fileCategorySpec,
      permitIssued: !!(group && group.permitIssued),
      permitApplied: !!(group && group.permitApplied),
      files: files || []
    };
  }

  return {
    ROOT_MELETES: ROOT_MELETES,
    ROOT_ADEIODOTISEIS: ROOT_ADEIODOTISEIS,
    MARK_HAS_FILE: MARK_HAS_FILE,
    MARK_NO_FILE: MARK_NO_FILE,
    MARK_PERMIT_ISSUED: MARK_PERMIT_ISSUED,
    MARK_PERMIT_APPLIED: MARK_PERMIT_APPLIED,
    MARK_PERMIT_PENDING: MARK_PERMIT_PENDING,
    ROOT_LABELS: ROOT_LABELS,
    getFileGroupIdentity: getFileGroupIdentity,
    getRootLabel: getRootLabel,
    getGroupCategoryInfo: getGroupCategoryInfo,
    isProsklisiLinkableGroup: isProsklisiLinkableGroup,
    isAdeiodotiseisGroup: isAdeiodotiseisGroup,
    isMeletesGroup: isMeletesGroup,
    countGroupFiles: countGroupFiles,
    isPermitIssued: isPermitIssued,
    isPermitApplied: isPermitApplied,
    studyMark: studyMark,
    permitMark: permitMark,
    classifyGroup: classifyGroup,
    formatAepoDate: formatAepoDate,
    MAX_IMPLEMENTATION_SUBPROJECTS: MAX_IMPLEMENTATION_SUBPROJECTS,
    clampImplementationSubprojectCount: clampImplementationSubprojectCount,
    resizeImplementationSubprojectTitles: resizeImplementationSubprojectTitles,
    liveImplementationSubprojects: liveImplementationSubprojects,
    normalizeImplementationSubprojects: normalizeImplementationSubprojects,
    formatSubprojectExportLine: formatSubprojectExportLine,
    buildProposalCard: buildProposalCard,
    buildHubCards: buildHubCards,
    setGroupPermitFlags: setGroupPermitFlags,
    setGroupPermitIssued: setGroupPermitIssued,
    applyPermitIssuedFromSaved: applyPermitIssuedFromSaved,
    mergeFileGroupsFromDisk: mergeFileGroupsFromDisk,
    mergeProposalFromDisk: mergeProposalFromDisk,
    buildPersistedFileGroupFromStaged: buildPersistedFileGroupFromStaged
  };
});

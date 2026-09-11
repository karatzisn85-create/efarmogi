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
  var MARK_PERMIT_PENDING = '×';

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

  function countGroupFiles(group) {
    return ((group && group.files) || []).reduce(function (sum, entry) {
      if (entry && entry.kind === 'folder') return sum + (entry.fileCount || 0);
      return sum + 1;
    }, 0);
  }

  function isPermitIssued(group) {
    return !!(group && group.permitIssued);
  }

  function studyMark(group) {
    return countGroupFiles(group) > 0 ? MARK_HAS_FILE : MARK_NO_FILE;
  }

  function permitMark(group) {
    return isPermitIssued(group) ? MARK_PERMIT_ISSUED : MARK_PERMIT_PENDING;
  }

  function classifyGroup(group) {
    var identity = getFileGroupIdentity(group);
    if (identity.rootId === ROOT_ADEIODOTISEIS) {
      return {
        rootId: ROOT_ADEIODOTISEIS,
        spec: identity.spec || (group && group.label) || 'Αδειοδότηση',
        mark: permitMark(group),
        kind: isPermitIssued(group) ? 'issued' : 'pending'
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
    return {
      title: (proposal && proposal.title) || '(Χωρίς τίτλο)',
      status: (proposal && proposal.status) || '',
      category: category || '—',
      municipalUnit: (proposal && proposal.municipalUnit) || '—',
      settlement: (proposal && proposal.settlement) || '—',
      aepo: (proposal && proposal.aepoRenewalDate)
        ? formatAepoDate(proposal.aepoRenewalDate)
        : '—',
      files: files,
      notes: String((proposal && proposal.notes) || '').trim(),
      meletes: meletes.concat(other),
      adeiodotiseis: adeiodotiseis
    };
  }

  function buildHubCards(proposals) {
    return (proposals || []).map(buildProposalCard);
  }

  function setGroupPermitIssued(fileGroups, groupId, issued) {
    return (fileGroups || []).map(function (group) {
      if (!group || group.id !== groupId) return group;
      return Object.assign({}, group, { permitIssued: !!issued });
    });
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
    return Object.assign({}, local, {
      updatedAt: (saved && saved.updatedAt) || local.updatedAt,
      fileGroups: ((local.fileGroups) || []).map(function (g) {
        if (!g || g.id !== groupId) return g;
        return Object.assign({}, g, { permitIssued: issued });
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
      if (!localGroup || !Object.prototype.hasOwnProperty.call(localGroup, 'permitIssued')) {
        return savedGroup;
      }
      return Object.assign({}, savedGroup, { permitIssued: localGroup.permitIssued });
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
      projectCategory: local.projectCategory,
      infrastructureSpecialization: local.infrastructureSpecialization,
      municipalUnit: local.municipalUnit,
      settlement: local.settlement,
      aepoRenewalDate: local.aepoRenewalDate,
      description: local.description,
      notes: local.notes,
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
      files: files || []
    };
  }

  return {
    ROOT_MELETES: ROOT_MELETES,
    ROOT_ADEIODOTISEIS: ROOT_ADEIODOTISEIS,
    MARK_HAS_FILE: MARK_HAS_FILE,
    MARK_NO_FILE: MARK_NO_FILE,
    MARK_PERMIT_ISSUED: MARK_PERMIT_ISSUED,
    MARK_PERMIT_PENDING: MARK_PERMIT_PENDING,
    getFileGroupIdentity: getFileGroupIdentity,
    isAdeiodotiseisGroup: isAdeiodotiseisGroup,
    isMeletesGroup: isMeletesGroup,
    countGroupFiles: countGroupFiles,
    isPermitIssued: isPermitIssued,
    studyMark: studyMark,
    permitMark: permitMark,
    classifyGroup: classifyGroup,
    formatAepoDate: formatAepoDate,
    buildProposalCard: buildProposalCard,
    buildHubCards: buildHubCards,
    setGroupPermitIssued: setGroupPermitIssued,
    applyPermitIssuedFromSaved: applyPermitIssuedFromSaved,
    mergeFileGroupsFromDisk: mergeFileGroupsFromDisk,
    mergeProposalFromDisk: mergeProposalFromDisk,
    buildPersistedFileGroupFromStaged: buildPersistedFileGroupFromStaged
  };
});

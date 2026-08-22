/**
 * Αρχεία υποέργου: ομαδοποίηση, φάκελος, αφαίρεση, ποιος μπορεί να προσθέσει.
 * Δεν αγγίζει δίσκο — μόνο την απόφαση πάνω στη λίστα.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubSubprojectFiles = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function cloneGroups(fileGroups) {
    return (fileGroups || []).map(function (g) {
      return {
        id: g && g.id,
        title: g && g.title,
        files: ((g && g.files) || []).slice()
      };
    });
  }

  function isNewGroupTitleValid(title) {
    return !!String(title || '').trim();
  }

  function folderGroupTitle(folderName) {
    return String(folderName || 'Φάκελος').trim() || 'Φάκελος';
  }

  /** Στο ανέβασμα από τη λίστα αρχείων: null = ακύρωση όλου του ανεβάσματος. */
  function isUploadGroupingCancelled(choice) {
    return choice === null;
  }

  function showSubprojectFileUpload(userRole) {
    return userRole !== 'USER';
  }

  function isSubprojectFileUploadBlocked(project, userRole) {
    if (!showSubprojectFileUpload(userRole)) return true;
    return !!(project && project.isLocked);
  }

  /**
   * Νέα ομάδα / υπάρχουσα / false = χωρίς ομάδα / null = ακύρωση (τίποτα δεν προστίθεται).
   */
  function applyFormFileGrouping(fileGroups, ungroupedFiles, choice, newFiles, newGroupId) {
    var groups = cloneGroups(fileGroups);
    var ungrouped = (ungroupedFiles || []).slice();
    var files = (newFiles || []).slice();
    if (choice === null) {
      return { fileGroups: groups, ungroupedFiles: ungrouped };
    }
    if (choice && choice.action === 'new') {
      groups.push({
        id: newGroupId,
        title: choice.title,
        files: files
      });
      return { fileGroups: groups, ungroupedFiles: ungrouped };
    }
    if (choice && choice.action === 'existing') {
      groups = groups.map(function (g) {
        if (g.id !== choice.groupId) return g;
        return { id: g.id, title: g.title, files: g.files.concat(files) };
      });
      return { fileGroups: groups, ungroupedFiles: ungrouped };
    }
    return { fileGroups: groups, ungroupedFiles: ungrouped.concat(files) };
  }

  function applyFolderAsNewGroup(fileGroups, folderName, newFiles, newGroupId) {
    return applyFormFileGrouping(
      fileGroups,
      [],
      { action: 'new', title: folderGroupTitle(folderName) },
      newFiles,
      newGroupId
    ).fileGroups;
  }

  function removeFileGroupById(fileGroups, groupId) {
    return (fileGroups || []).filter(function (g) { return !g || g.id !== groupId; });
  }

  function removeFileFromGroup(fileGroups, groupId, fileIndex) {
    return (fileGroups || []).map(function (g) {
      if (!g || g.id !== groupId) return g;
      return {
        id: g.id,
        title: g.title,
        files: (g.files || []).filter(function (_f, i) { return i !== fileIndex; })
      };
    }).filter(function (g) { return g && (g.files || []).length > 0; });
  }

  function countVisibleSubprojectFiles(fileGroups, ungroupedFiles) {
    var grouped = (fileGroups || []).reduce(function (n, g) {
      return n + ((g && g.files && g.files.length) || 0);
    }, 0);
    return grouped + ((ungroupedFiles && ungroupedFiles.length) || 0);
  }

  return {
    isNewGroupTitleValid: isNewGroupTitleValid,
    folderGroupTitle: folderGroupTitle,
    isUploadGroupingCancelled: isUploadGroupingCancelled,
    showSubprojectFileUpload: showSubprojectFileUpload,
    isSubprojectFileUploadBlocked: isSubprojectFileUploadBlocked,
    applyFormFileGrouping: applyFormFileGrouping,
    applyFolderAsNewGroup: applyFolderAsNewGroup,
    removeFileGroupById: removeFileGroupById,
    removeFileFromGroup: removeFileFromGroup,
    countVisibleSubprojectFiles: countVisibleSubprojectFiles
  };
});

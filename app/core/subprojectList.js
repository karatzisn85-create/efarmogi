/**
 * Λίστα καταλόγου: ομαδοποίηση, ταξινόμηση, ορατότητα αρχείου / απενταγμένων.
 * Ίδιες αποφάσεις με τον κατάλογο της εφαρμογής.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubSubprojectList = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ARCHIVED_STATUS = 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ';
  var PROJECT_STATUS_ABANDONED = 'ΑΠΕΝΤΑΓΜΕΝΟ';
  var LEGACY_PROJECT_TYPE_ALIASES = {
    'ΥΠΗΡΕΣΙΑ': 'ΓΕΝΙΚΕΣ ΥΠΗΡΕΣΙΕΣ'
  };

  function normalizeProjectType(type) {
    if (!type) return '';
    var t = String(type).trim();
    return LEGACY_PROJECT_TYPE_ALIASES[t] || t;
  }

  function isAbandonedSubproject(projectOrStatus) {
    var status = typeof projectOrStatus === 'string'
      ? projectOrStatus
      : projectOrStatus && projectOrStatus.projectStatus;
    return status === PROJECT_STATUS_ABANDONED;
  }

  function excludeAbandonedSubprojects(projects) {
    return (projects || []).filter(function (p) { return !isAbandonedSubproject(p); });
  }

  function pickDisplayProjectTitleForGroup(subprojects) {
    if (!subprojects || !subprojects.length) return '';
    var counts = {};
    for (var i = 0; i < subprojects.length; i += 1) {
      var t = String((subprojects[i] && subprojects[i].projectTitle) || '').trim();
      if (!t) continue;
      counts[t] = (counts[t] || 0) + 1;
    }
    var best = (subprojects[0] && subprojects[0].projectTitle) || '';
    var bestCount = -1;
    Object.keys(counts).forEach(function (title) {
      var c = counts[title];
      if (c > bestCount || (c === bestCount && title.length > best.length)) {
        best = title;
        bestCount = c;
      }
    });
    return best;
  }

  function groupSubprojectsByProjectId(projects) {
    var groups = {};
    (projects || []).forEach(function (project) {
      var key = (project && project.projectId)
        || ('__missing_project_id__:' + ((project && project.subprojectId) || 'unknown'));
      if (!groups[key]) groups[key] = [];
      groups[key].push(project);
    });
    return groups;
  }

  function sortGroupedEntries(groups) {
    return Object.keys(groups).map(function (key) {
      return [key, groups[key]];
    }).sort(function (a, b) {
      var titleA = pickDisplayProjectTitleForGroup(a[1]);
      var titleB = pickDisplayProjectTitleForGroup(b[1]);
      return titleA.localeCompare(titleB, 'el', { sensitivity: 'base' });
    });
  }

  function sortSubprojectsInGroup(subprojects) {
    return (subprojects || []).slice().sort(function (a, b) {
      return String(a.subprojectTitle || '').localeCompare(String(b.subprojectTitle || ''), 'el', { sensitivity: 'base' });
    });
  }

  function projectMatchesQuickStatus(project, status) {
    if (!status) return true;
    return (project && project.projectStatus) === status;
  }

  function projectMatchesQuickType(project, type) {
    if (!type) return true;
    return normalizeProjectType(project && project.projectType) === type;
  }

  function userExplicitlyFilteredByStatus(filterStatuses, quickSearchStatus, status) {
    var list = Array.isArray(filterStatuses) ? filterStatuses : [];
    return list.indexOf(status) !== -1 || quickSearchStatus === status;
  }

  /**
   * Τελευταίο βήμα καταλόγου: αρχειοθετημένα / απενταγμένα.
   * Αν ο χρήστης διάλεξε ρητά την κατάσταση, δεν τα κρύβουμε.
   */
  function applyArchivedAbandonedVisibility(projects, options) {
    var opts = options || {};
    var showArchived = !!opts.showArchivedProjects;
    var quickSearchStatus = opts.quickSearchStatus || '';
    var filterStatuses = opts.filterStatuses || [];
    var filtered = Array.isArray(projects) ? projects.slice() : [];

    var userExplicitlyFilteredByArchived = userExplicitlyFilteredByStatus(
      filterStatuses, quickSearchStatus, ARCHIVED_STATUS
    );
    var userExplicitlyFilteredByAbandoned = userExplicitlyFilteredByStatus(
      filterStatuses, quickSearchStatus, PROJECT_STATUS_ABANDONED
    );

    if (showArchived) {
      filtered = filtered.filter(function (p) { return p.projectStatus === ARCHIVED_STATUS; });
    } else if (!userExplicitlyFilteredByArchived) {
      filtered = filtered.filter(function (p) { return p.projectStatus !== ARCHIVED_STATUS; });
    }

    if (!userExplicitlyFilteredByAbandoned) {
      filtered = filtered.filter(function (p) { return !isAbandonedSubproject(p); });
    }
    return filtered;
  }

  return {
    ARCHIVED_STATUS: ARCHIVED_STATUS,
    PROJECT_STATUS_ABANDONED: PROJECT_STATUS_ABANDONED,
    LEGACY_PROJECT_TYPE_ALIASES: LEGACY_PROJECT_TYPE_ALIASES,
    normalizeProjectType: normalizeProjectType,
    isAbandonedSubproject: isAbandonedSubproject,
    excludeAbandonedSubprojects: excludeAbandonedSubprojects,
    pickDisplayProjectTitleForGroup: pickDisplayProjectTitleForGroup,
    groupSubprojectsByProjectId: groupSubprojectsByProjectId,
    sortGroupedEntries: sortGroupedEntries,
    sortSubprojectsInGroup: sortSubprojectsInGroup,
    projectMatchesQuickStatus: projectMatchesQuickStatus,
    projectMatchesQuickType: projectMatchesQuickType,
    applyArchivedAbandonedVisibility: applyArchivedAbandonedVisibility
  };
});

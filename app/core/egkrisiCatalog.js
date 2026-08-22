/**
 * Κατάλογος εγκρίσεων διάθεσης πίστωσης: αναζήτηση ομάδας, τύπος, ρόλοι, αυτόνομα PDF.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubEgkrisiCatalog = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  function cardApi() {
    try {
      if (typeof require === 'function') return require('./subprojectCard');
    } catch (e) { /* harness */ }
    return (root && root.ErgoHubSubprojectCard) || {};
  }

  function contains(text, term) {
    var card = cardApi();
    if (card.containsSearchTerm) return card.containsSearchTerm(text, term);
    return false;
  }

  /**
   * Αναζήτηση καταλόγου εγκρίσεων: τρέχων τίτλος έργου/υποέργου, ΚΑ, ΑΛΕ.
   * Δεν κοιτάει όνομα αρχείου έγκρισης ούτε χρέωση.
   */
  function egkrisiRowMatchesSearch(subproject, searchTerm) {
    if (!searchTerm) return true;
    var p = subproject || {};
    var aleCodesMatch = (p.aleCodes && Array.isArray(p.aleCodes)
      && p.aleCodes.some(function (code) { return contains(code, searchTerm); }))
      || contains(p.aleCode, searchTerm);
    return contains(p.projectTitle, searchTerm)
      || contains(p.subprojectTitle, searchTerm)
      || contains(p.kaCode, searchTerm)
      || aleCodesMatch;
  }

  function toEgkrisiProjectGroups(flatProjects) {
    var groups = {};
    (flatProjects || []).forEach(function (project) {
      var key = (project && project.projectId)
        || ('__missing_project_id__:' + ((project && project.subprojectId) || 'unknown'));
      if (!groups[key]) groups[key] = [];
      groups[key].push(project);
    });
    return Object.keys(groups).map(function (k) { return groups[k]; });
  }

  /**
   * Κρατάει ολόκληρη την ομάδα αν κάποιο υποέργο ταιριάζει.
   * Ίδιο subprojectId σε δεύτερη ομάδα παραλείπεται.
   */
  function filterEgkrisiProjectGroups(projectGroups, searchTerm) {
    if (!Array.isArray(projectGroups)) return [];
    var term = searchTerm == null ? '' : String(searchTerm);
    var filtered = projectGroups.filter(function (projectGroup) {
      if (!projectGroup || !Array.isArray(projectGroup) || projectGroup.length === 0) return false;
      if (!term) return true;
      return projectGroup.some(function (p) {
        return p && egkrisiRowMatchesSearch(p, term);
      });
    });

    var seenSubprojectIds = {};
    return filtered.map(function (projectGroup) {
      if (!projectGroup || !Array.isArray(projectGroup)) return projectGroup;
      return projectGroup.filter(function (subproject) {
        if (!subproject || !subproject.subprojectId) return false;
        if (seenSubprojectIds[subproject.subprojectId]) return false;
        seenSubprojectIds[subproject.subprojectId] = true;
        return true;
      });
    }).filter(function (projectGroup) {
      return projectGroup && projectGroup.length > 0;
    });
  }

  function getEgkriseisForSubproject(egkriseisByProjectId, projectId, subprojectId) {
    var list = (egkriseisByProjectId && egkriseisByProjectId[projectId]) || [];
    var found = null;
    for (var i = 0; i < list.length; i += 1) {
      if (list[i] && list[i].subprojectId === subprojectId) {
        found = list[i];
        break;
      }
    }
    return (found && Array.isArray(found.egkriseis)) ? found.egkriseis : [];
  }

  function formatEgkrisiType(type) {
    if (!type) return '';
    return type === 'initial' ? 'Αρχική' : 'Τροποποίηση';
  }

  function isEgkrisiLinked(egkrisi, linkedMap) {
    return !!(egkrisi && linkedMap && linkedMap[egkrisi.id]);
  }

  /**
   * Η παραγωγή δείχνει πάντα το κουμπί — δεν κρύβεται σε μηχανικό / χρήστη.
   */
  function showNewEgkrisiButton(_userRole) {
    return true;
  }

  function canManageEgkrisiActions(userRole) {
    return userRole !== 'USER' && userRole !== 'ENGINEER';
  }

  function findProjectIdByExactTitle(projectGroups, title) {
    if (!Array.isArray(projectGroups)) return null;
    for (var i = 0; i < projectGroups.length; i += 1) {
      var group = projectGroups[i];
      if (!group || !Array.isArray(group)) continue;
      for (var j = 0; j < group.length; j += 1) {
        if (group[j] && group[j].projectTitle === title) return group[j].projectId;
      }
    }
    return null;
  }

  function findSubprojectIdByExactTitle(projectGroups, projectId, title) {
    if (!Array.isArray(projectGroups)) return null;
    for (var i = 0; i < projectGroups.length; i += 1) {
      var group = projectGroups[i];
      if (!group || !Array.isArray(group)) continue;
      for (var j = 0; j < group.length; j += 1) {
        var p = group[j];
        if (p && p.subprojectTitle === title && p.projectId === projectId) return p.subprojectId;
      }
    }
    return null;
  }

  function standaloneSubprojectTitle(subVal, subKey) {
    if (subVal && subVal.title) return subVal.title;
    return String(subKey || '').replace(/_/g, ' ');
  }

  function buildEgkriseisFromStandalonePdfs(pdfs, projKey, subKey) {
    return (pdfs || []).map(function (pdf, idx) {
      return {
        id: 'standalone_' + projKey + '_' + subKey + '_' + idx,
        fileName: pdf,
        date: null,
        type: idx === 0 ? 'initial' : 'modification',
        projectKey: projKey,
        subprojectKey: subKey
      };
    });
  }

  function subprojectAlreadyHasEgkriseis(existingList, subprojectId) {
    return (existingList || []).some(function (e) { return e && e.subprojectId === subprojectId; });
  }

  function cloneEgkriseisMap(src) {
    var out = {};
    var map = src || {};
    Object.keys(map).forEach(function (k) {
      out[k] = Array.isArray(map[k]) ? map[k].slice() : map[k];
    });
    return out;
  }

  function mergeStandaloneEgkriseis(allEgkriseis, standaloneData, projectGroups) {
    var out = cloneEgkriseisMap(allEgkriseis);
    var projects = standaloneData && standaloneData.projects;
    if (!projects || typeof projects !== 'object') return out;

    Object.keys(projects).forEach(function (projKey) {
      var projVal = projects[projKey];
      if (!projVal || !projVal.subprojects) return;
      var projTitle = projVal.title || projKey;
      var matchedProjectId = findProjectIdByExactTitle(projectGroups, projTitle);
      if (!matchedProjectId) return;

      Object.keys(projVal.subprojects).forEach(function (subKey) {
        var subVal = projVal.subprojects[subKey];
        if (!subVal || !subVal.pdfs || subVal.pdfs.length === 0) return;
        var subTitle = standaloneSubprojectTitle(subVal, subKey);
        var matchedSubId = findSubprojectIdByExactTitle(projectGroups, matchedProjectId, subTitle);
        if (!matchedSubId) return;
        if (subprojectAlreadyHasEgkriseis(out[matchedProjectId], matchedSubId)) return;

        if (!out[matchedProjectId]) out[matchedProjectId] = [];
        out[matchedProjectId].push({
          subprojectId: matchedSubId,
          subprojectTitle: subTitle,
          egkriseis: buildEgkriseisFromStandalonePdfs(subVal.pdfs, projKey, subKey)
        });
      });
    });
    return out;
  }

  return {
    egkrisiRowMatchesSearch: egkrisiRowMatchesSearch,
    toEgkrisiProjectGroups: toEgkrisiProjectGroups,
    filterEgkrisiProjectGroups: filterEgkrisiProjectGroups,
    getEgkriseisForSubproject: getEgkriseisForSubproject,
    formatEgkrisiType: formatEgkrisiType,
    isEgkrisiLinked: isEgkrisiLinked,
    showNewEgkrisiButton: showNewEgkrisiButton,
    canManageEgkrisiActions: canManageEgkrisiActions,
    findProjectIdByExactTitle: findProjectIdByExactTitle,
    findSubprojectIdByExactTitle: findSubprojectIdByExactTitle,
    standaloneSubprojectTitle: standaloneSubprojectTitle,
    buildEgkriseisFromStandalonePdfs: buildEgkriseisFromStandalonePdfs,
    subprojectAlreadyHasEgkriseis: subprojectAlreadyHasEgkriseis,
    mergeStandaloneEgkriseis: mergeStandaloneEgkriseis
  };
});

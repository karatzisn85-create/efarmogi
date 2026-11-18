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

  function foldEgkrisiText(text) {
    return String(text || '')
      .replace(/\\n/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/ά/g, 'α').replace(/έ/g, 'ε').replace(/ή/g, 'η')
      .replace(/ί/g, 'ι').replace(/ό/g, 'ο').replace(/ύ/g, 'υ').replace(/ώ/g, 'ω')
      .replace(/ΐ/g, 'ι').replace(/ΰ/g, 'υ');
  }

  function approvalProjectKey(project) {
    return String((project && (project.folderName || project.projectId)) || '').trim();
  }

  function approvalSubprojectKey(subproject) {
    return String((subproject && subproject.folderName) || '').trim();
  }

  function approvalSubprojectNumber(subproject) {
    if (!subproject || subproject.number == null) return '';
    return String(subproject.number).trim();
  }

  /**
   * Η σύνδεση ανήκει σε αυτή τη γραμμή έγκρισης.
   * Πρώτα τα κλειδιά της γραμμής (φάκελος ή αριθμός), ώστε ίδιος τίτλος
   * σε άλλη έγκριση να μην φαίνεται συνδεδεμένος. Χωρίς κλειδιά, τίτλος
   * έγκρισης και τίτλος πράξης μαζί.
   */
  function linkMatchesApprovalRow(link, project, subproject) {
    if (!link || !subproject) return false;
    var projectKey = approvalProjectKey(project);
    var subKey = approvalSubprojectKey(subproject);
    var number = approvalSubprojectNumber(subproject);
    var linkProjectKey = String(link.egkrisiProjectKey || '').trim();
    var linkSubKey = String(link.egkrisiSubprojectKey || '').trim();

    if (linkProjectKey && projectKey) {
      if (linkProjectKey !== projectKey) return false;
      if (linkSubKey && subKey && linkSubKey === subKey) return true;
      if (linkSubKey && number && linkSubKey === number) return true;
      if (linkSubKey) return false;
    }

    var rowTitle = foldEgkrisiText(subproject.title);
    var linkTitle = foldEgkrisiText(link.egkrisiTitle || link.subprojectTitle);
    if (!rowTitle || linkTitle !== rowTitle) return false;
    var rowProject = foldEgkrisiText(project && project.title);
    var linkProject = foldEgkrisiText(link.egkrisiProjectTitle);
    if (rowProject && linkProject && rowProject !== linkProject) return false;
    return true;
  }

  function findLinkForApprovalRow(links, project, subproject) {
    var list = links && !Array.isArray(links) ? Object.keys(links).map(function (k) { return links[k]; }) : (links || []);
    for (var i = 0; i < list.length; i += 1) {
      if (linkMatchesApprovalRow(list[i], project, subproject)) return list[i];
    }
    return null;
  }

  /**
   * Αυτόματη σύνδεση μόνο όταν υπάρχει ένα υποέργο με αυτόν τον τίτλο
   * και δεν έχει ήδη έγκριση. Αλλιώς ο υπάλληλος διαλέγει από την αναζήτηση.
   */
  function portfolioSubprojectForDirectLink(projects, title, links) {
    var matches = portfolioSubprojectsWithExactTitle(projects, title);
    if (matches.length !== 1) return null;
    var id = String(matches[0].subprojectId || '');
    var list = links && !Array.isArray(links)
      ? Object.keys(links).map(function (k) { return links[k]; })
      : (links || []);
    for (var i = 0; i < list.length; i += 1) {
      if (list[i] && String(list[i].subprojectId || '') === id) return null;
    }
    return matches[0];
  }

  /** Υποέργα χαρτοφυλακίου με ακριβώς τον ίδιο τίτλο. Ένα = ασφαλής σύνδεση. */
  function portfolioSubprojectsWithExactTitle(projects, title) {
    var wanted = foldEgkrisiText(title);
    if (!wanted) return [];
    var seen = {};
    var out = [];
    (projects || []).forEach(function (project) {
      if (!project || !project.subprojectId) return;
      if (foldEgkrisiText(project.subprojectTitle) !== wanted) return;
      if (seen[project.subprojectId]) return;
      seen[project.subprojectId] = true;
      out.push(project);
    });
    return out;
  }

  function cleanEgkrisiIdPart(value, maxLen) {
    var clean = String(value || '')
      .replace(/\\n/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .trim()
      .substring(0, maxLen || 50);
    return clean;
  }

  function egkrisiIdHash(value) {
    try {
      return require('crypto').createHash('md5').update(String(value || '')).digest('hex').substring(0, 8);
    } catch (e) {
      return '00000000';
    }
  }

  /** Νέες συνδέσεις παίρνουν ταυτότητα από τα κλειδιά της γραμμής, όχι από τον τίτλο. */
  function manualEgkrisiStorageId(input) {
    var src = input || {};
    var projectKey = String(src.egkrisiProjectKey || '').trim();
    var subKey = String(src.egkrisiSubprojectKey || '').trim();
    if (projectKey && subKey) {
      var part = cleanEgkrisiIdPart(subKey, 40) || 'row';
      return 'manual_egkrisi_' + part + '_' + egkrisiIdHash(projectKey + '::' + subKey);
    }
    var titlePart = cleanEgkrisiIdPart(src.egkrisiTitle, 50) || 'row';
    return 'manual_egkrisi_' + titlePart + '_' + egkrisiIdHash(
      String(src.egkrisiProjectTitle || '').trim() + '_' + String(src.egkrisiTitle || '').trim()
    );
  }

  /**
   * keep: η ίδια γραμμή είναι ήδη δεμένη σε αυτό το υποέργο — δεν ξαναγράφεται.
   * reject-approval: η γραμμή δείχνει αλλού.
   * reject-subproject: το υποέργο έχει ήδη άλλη έγκριση.
   * create: καινούργια σύνδεση, με ταυτότητα από τα κλειδιά.
   */
  function classifyManualEgkrisiLink(existingLinks, incoming) {
    var list = Array.isArray(existingLinks) ? existingLinks : [];
    var src = incoming || {};
    var projectKey = String(src.egkrisiProjectKey || '').trim();
    var subKey = String(src.egkrisiSubprojectKey || '').trim();
    var subprojectId = String(src.subprojectId || '').trim();
    var storageId = manualEgkrisiStorageId(src);
    var i;
    var sameRow = null;

    for (i = 0; i < list.length; i += 1) {
      var link = list[i];
      if (!link) continue;
      var sameKeys = !!(projectKey && subKey
        && String(link.egkrisiProjectKey || '').trim() === projectKey
        && String(link.egkrisiSubprojectKey || '').trim() === subKey);
      var sameId = !!(link.egkrisiId && link.egkrisiId === storageId);
      if (sameKeys || sameId) {
        sameRow = link;
        break;
      }
    }

    if (sameRow) {
      if (String(sameRow.subprojectId || '') === subprojectId) {
        return { action: 'keep', link: sameRow };
      }
      return {
        action: 'reject-approval',
        link: sameRow,
        error: 'Αυτή η έγκριση είναι ήδη συνδεδεμένη με άλλο υποέργο. Ακυρώστε πρώτα εκείνη τη σύνδεση.'
      };
    }

    for (i = 0; i < list.length; i += 1) {
      if (list[i] && String(list[i].subprojectId || '') === subprojectId) {
        return {
          action: 'reject-subproject',
          link: list[i],
          error: 'Το υποέργο έχει ήδη συσχετισμένη έγκριση'
        };
      }
    }

    return { action: 'create', egkrisiId: storageId };
  }

  function egkrisiLinksForSubprojectTitleChange(links, opts) {
    var options = opts || {};
    var projectKey = String(options.projectKey || '').trim();
    var subKey = String(options.subprojectKey || '').trim();
    var number = String(options.number == null ? '' : options.number).trim();
    var oldTitle = foldEgkrisiText(options.oldTitle);
    return (Array.isArray(links) ? links : []).filter(function (link) {
      if (!link || String(link.egkrisiProjectKey || '').trim() !== projectKey) return false;
      var stored = String(link.egkrisiSubprojectKey || '').trim();
      if (stored && subKey && stored === subKey) return true;
      if (stored && number && stored === number && foldEgkrisiText(link.egkrisiTitle) === oldTitle) return true;
      return false;
    }).map(function (link) {
      return Object.assign({}, link, {
        egkrisiTitle: String(options.newTitle || '').trim(),
        subprojectTitle: String(options.newTitle || '').trim()
      });
    });
  }

  function egkrisiLinksForProjectTitleChange(links, projectKey, newTitle) {
    var key = String(projectKey || '').trim();
    var title = String(newTitle || '').trim();
    return (Array.isArray(links) ? links : []).filter(function (link) {
      return link && String(link.egkrisiProjectKey || '').trim() === key;
    }).map(function (link) {
      return Object.assign({}, link, { egkrisiProjectTitle: title });
    });
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

  function modificationListsPdf(modifications, pdfFileName) {
    var name = String(pdfFileName || '');
    return (Array.isArray(modifications) ? modifications : []).some(function (item) {
      if (item == null) return false;
      if (typeof item === 'string') return item === name;
      return item.fileName === name || item.name === name;
    });
  }

  /** Το αρχείο μένει αν το έχει ακόμη έστω ένα υποέργο ή οι τροποποιήσεις της πράξης. */
  function egkrisiPdfStillNeeded(projectData, pdfFileName) {
    var name = String(pdfFileName || '');
    if (!name) return false;
    var project = projectData || {};
    var subs = project.subprojects || {};
    var usedBySubproject = Object.keys(subs).some(function (key) {
      var pdfs = subs[key] && Array.isArray(subs[key].pdfs) ? subs[key].pdfs : [];
      return pdfs.indexOf(name) !== -1;
    });
    return usedBySubproject || modificationListsPdf(project.modifications, name);
  }

  function removeEgkrisiPdfFromSubproject(projectData, subprojectKey, pdfFileName) {
    var project = projectData || {};
    var subs = project.subprojects || {};
    var key = String(subprojectKey || '');
    if (!subs[key]) {
      return { foundSubproject: false, removed: false, fileStillNeeded: true };
    }
    var pdfs = Array.isArray(subs[key].pdfs) ? subs[key].pdfs : [];
    var idx = pdfs.indexOf(pdfFileName);
    if (idx !== -1) pdfs.splice(idx, 1);
    return {
      foundSubproject: true,
      removed: idx !== -1,
      fileStillNeeded: egkrisiPdfStillNeeded(project, pdfFileName)
    };
  }

  function removeEgkrisiPdfFromAllSubprojects(projectData, pdfFileName) {
    var project = projectData || {};
    var subs = project.subprojects || {};
    var removedCount = 0;
    Object.keys(subs).forEach(function (key) {
      var pdfs = subs[key] && Array.isArray(subs[key].pdfs) ? subs[key].pdfs : [];
      var idx = pdfs.indexOf(pdfFileName);
      if (idx !== -1) {
        pdfs.splice(idx, 1);
        removedCount += 1;
      }
    });
    return {
      removedCount: removedCount,
      fileStillNeeded: egkrisiPdfStillNeeded(project, pdfFileName)
    };
  }

  function pdfNameOf(item) {
    if (item == null) return '';
    if (typeof item === 'string') return item;
    return item.fileName || item.name || '';
  }

  function collectPdfNames(list) {
    var seen = {};
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (item) {
      var name = pdfNameOf(item);
      if (!name || seen[name]) return;
      seen[name] = true;
      out.push(name);
    });
    return out;
  }

  function linksAsList(links) {
    if (!links) return [];
    if (Array.isArray(links)) return links;
    return Object.keys(links).map(function (key) { return links[key]; });
  }

  /** Ονόματα αρχείων που μένουν στην πράξη αν φύγει μία γραμμή. */
  function egkrisiPdfNamesKeptAfterSubprojectRemoval(projectData, subprojectKey) {
    var project = projectData || {};
    var kept = {};
    collectPdfNames(project.modifications).forEach(function (name) { kept[name] = true; });
    var subs = project.subprojects || {};
    Object.keys(subs).forEach(function (key) {
      if (key === subprojectKey) return;
      collectPdfNames(subs[key] && subs[key].pdfs).forEach(function (name) { kept[name] = true; });
    });
    return kept;
  }

  function planEgkrisiSubprojectRemoval(projectData, subprojectKey) {
    var project = projectData || {};
    var key = String(subprojectKey || '');
    var subs = project.subprojects || {};
    if (!key || !subs[key]) {
      return { found: false, filesToDelete: [], projectBecomesEmpty: false };
    }
    var kept = egkrisiPdfNamesKeptAfterSubprojectRemoval(project, key);
    var ownFiles = collectPdfNames(subs[key].pdfs);
    var filesToDelete = ownFiles.filter(function (name) { return !kept[name]; });
    var remainingSubs = Object.keys(subs).filter(function (other) { return other !== key; });
    return {
      found: true,
      filesToDelete: filesToDelete,
      projectBecomesEmpty: remainingSubs.length === 0 && collectPdfNames(project.modifications).length === 0,
      removed: {
        title: subs[key].title || '',
        number: subs[key].number == null ? '' : String(subs[key].number),
        pdfs: ownFiles
      }
    };
  }

  function applyEgkrisiSubprojectRemoval(projectData, subprojectKey) {
    var plan = planEgkrisiSubprojectRemoval(projectData, subprojectKey);
    if (!plan.found || !projectData || !projectData.subprojects) return plan;
    delete projectData.subprojects[subprojectKey];
    return plan;
  }

  function egkrisiLinksForRowRemoval(links, project, subproject) {
    return linksAsList(links).filter(function (link) {
      return linkMatchesApprovalRow(link, project, subproject);
    });
  }

  function creditApprovalFlagsFromCatalog(egkriseisData) {
    var approvals = {};
    var projects = egkriseisData && egkriseisData.projects;
    if (!projects) return approvals;
    Object.keys(projects).forEach(function (key) {
      var project = projects[key];
      if (!project) return;
      var title = String(project.title || '');
      if (project.modifications && project.modifications.length > 0) {
        approvals[title + '-' + title] = true;
      }
      var subs = project.subprojects || {};
      Object.keys(subs).forEach(function (subKey) {
        var sub = subs[subKey];
        if (sub && sub.pdfs && sub.pdfs.length > 0) {
          approvals[title + '-' + String(sub.title || '')] = true;
        }
      });
    });
    return approvals;
  }

  function egkrisiLinksForProjectRemoval(links, project) {
    var projectKey = approvalProjectKey(project);
    var projectTitle = foldEgkrisiText(project && project.title);
    return linksAsList(links).filter(function (link) {
      if (!link) return false;
      var linkProjectKey = String(link.egkrisiProjectKey || '').trim();
      if (linkProjectKey && projectKey) return linkProjectKey === projectKey;
      if (linkProjectKey) return false;
      var linkProject = foldEgkrisiText(link.egkrisiProjectTitle);
      return !!(projectTitle && linkProject && linkProject === projectTitle);
    });
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
    mergeStandaloneEgkriseis: mergeStandaloneEgkriseis,
    foldEgkrisiText: foldEgkrisiText,
    linkMatchesApprovalRow: linkMatchesApprovalRow,
    findLinkForApprovalRow: findLinkForApprovalRow,
    portfolioSubprojectsWithExactTitle: portfolioSubprojectsWithExactTitle,
    portfolioSubprojectForDirectLink: portfolioSubprojectForDirectLink,
    manualEgkrisiStorageId: manualEgkrisiStorageId,
    classifyManualEgkrisiLink: classifyManualEgkrisiLink,
    egkrisiLinksForSubprojectTitleChange: egkrisiLinksForSubprojectTitleChange,
    egkrisiLinksForProjectTitleChange: egkrisiLinksForProjectTitleChange,
    egkrisiPdfStillNeeded: egkrisiPdfStillNeeded,
    removeEgkrisiPdfFromSubproject: removeEgkrisiPdfFromSubproject,
    removeEgkrisiPdfFromAllSubprojects: removeEgkrisiPdfFromAllSubprojects,
    planEgkrisiSubprojectRemoval: planEgkrisiSubprojectRemoval,
    applyEgkrisiSubprojectRemoval: applyEgkrisiSubprojectRemoval,
    egkrisiLinksForRowRemoval: egkrisiLinksForRowRemoval,
    egkrisiLinksForProjectRemoval: egkrisiLinksForProjectRemoval,
    creditApprovalFlagsFromCatalog: creditApprovalFlagsFromCatalog
  };
});

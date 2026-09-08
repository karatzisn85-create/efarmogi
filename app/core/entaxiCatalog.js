/**
 * Κατάλογος εντάξεων: αναζήτηση, ομαδοποίηση, χωρίς έργο, τρέχον ποσό,
 * υποχρεωτικά νέας ένταξης και διαγραφή.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubEntaxiCatalog = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var UNLINKED_GROUP_TITLE = 'Εντάξεις Μη Συσχετισμένες με Κάποιο Έργο';

  function cardApi() {
    try {
      if (typeof require === 'function') return require('./subprojectCard');
    } catch (e) { /* harness */ }
    return (root && root.ErgoHubSubprojectCard) || {};
  }

  function parseGreekAmountString(val) {
    if (val == null || val === '') return 0;
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
    var cleaned = String(val).trim().replace(/[^\d,.-]/g, '');
    if (!cleaned) return 0;
    var hasComma = cleaned.indexOf(',') !== -1;
    var hasDot = cleaned.indexOf('.') !== -1;
    var normalized;
    if (hasComma && hasDot) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
      normalized = cleaned.replace(',', '.');
    } else if (hasDot) {
      var dotCount = (cleaned.match(/\./g) || []).length;
      if (dotCount === 1) {
        var frac = cleaned.split('.')[1] || '';
        normalized = frac.length <= 2 ? cleaned : cleaned.replace(/\./g, '');
      } else {
        normalized = cleaned.replace(/\./g, '');
      }
    } else {
      normalized = cleaned;
    }
    var n = parseFloat(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  function modificationChangesAmount(mod) {
    if (!mod || !mod.changeAmount) return false;
    var raw = mod.amount;
    if (raw == null || String(raw).trim() === '') return false;
    return true;
  }

  function getEntaxiCurrentTotal(entaxi, options) {
    var opts = options || {};
    if (!entaxi) return 0;
    var total = parseGreekAmountString(entaxi.initialAmount);
    var mods = Array.isArray(entaxi.modifications) ? entaxi.modifications : [];
    var stopAtExclusive = mods.length;
    if (opts.beforeModificationId) {
      var idx = mods.findIndex(function (m) { return m && m.modificationId === opts.beforeModificationId; });
      if (idx >= 0) stopAtExclusive = idx;
    } else if (typeof opts.upToIndexInclusive === 'number' && Number.isFinite(opts.upToIndexInclusive)) {
      stopAtExclusive = Math.min(mods.length, opts.upToIndexInclusive + 1);
    }
    for (var i = 0; i < stopAtExclusive; i += 1) {
      if (modificationChangesAmount(mods[i])) {
        total = parseGreekAmountString(mods[i].amount);
      }
    }
    return total;
  }

  function formatEntaxiAmount(value) {
    var n = typeof value === 'number' ? value : parseGreekAmountString(value);
    if (!Number.isFinite(n)) return '0,00';
    return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function isEntaxiUnlinked(entaxi) {
    var titles = getEntaxiLinkedProjects(entaxi).filter(function (p) {
      return p.projectTitle;
    });
    return !titles.length || !entaxi || !entaxi.subprojectIds || entaxi.subprojectIds.length === 0;
  }

  function normalizeLinkedProject(item) {
    if (!item || typeof item !== 'object') return null;
    var title = String(item.projectTitle || item.title || '').trim();
    var id = String(item.projectId || item.id || '').trim();
    if (!title && !id) return null;
    return { projectId: id, projectTitle: title };
  }

  function getEntaxiLinkedProjects(entaxi) {
    var e = entaxi || {};
    if (Array.isArray(e.linkedProjects) && e.linkedProjects.length) {
      var out = [];
      var seen = {};
      e.linkedProjects.forEach(function (item) {
        var n = normalizeLinkedProject(item);
        if (!n) return;
        var key = n.projectId || n.projectTitle;
        if (!key || seen[key]) return;
        seen[key] = true;
        out.push(n);
      });
      if (out.length) return out;
    }
    var legacyTitle = String(e.projectTitle || '').trim();
    if (!legacyTitle) return [];
    return [{ projectId: String(e.projectId || '').trim(), projectTitle: legacyTitle }];
  }

  function formatEntaxiProjectTitles(entaxi) {
    return getEntaxiLinkedProjects(entaxi)
      .map(function (p) { return p.projectTitle; })
      .filter(Boolean)
      .join(' · ');
  }

  function entaxiLinksProjectTitle(entaxi, projectTitle) {
    var needle = String(projectTitle || '').trim();
    if (!needle) return true;
    return getEntaxiLinkedProjects(entaxi).some(function (p) {
      return p.projectTitle === needle;
    });
  }

  function isSameEntaxiLinkedProject(a, b) {
    var na = normalizeLinkedProject(a);
    var nb = normalizeLinkedProject(b);
    if (!na || !nb) return false;
    if (na.projectId && nb.projectId && na.projectId === nb.projectId) return true;
    if (na.projectTitle && nb.projectTitle && na.projectTitle === nb.projectTitle) return true;
    return false;
  }

  function pruneEntaxiLinkSnapshot(projectBlocks, selectedSubprojectIds) {
    var blocks = projectBlocks || [];
    var catalogReady = false;
    blocks.forEach(function (block) {
      var rowIds = [];
      if (Array.isArray(block.subprojectIds) && block.subprojectIds.length) {
        rowIds = block.subprojectIds;
      } else if (Array.isArray(block.subprojects) && block.subprojects.length) {
        rowIds = block.subprojects.map(function (s) { return s && s.subprojectId; }).filter(Boolean);
      }
      if (rowIds.length) catalogReady = true;
    });
    if (!catalogReady) {
      return buildEntaxiLinkSnapshot(blocks, selectedSubprojectIds);
    }
    var selected = {};
    (selectedSubprojectIds || []).forEach(function (id) {
      if (id) selected[String(id)] = true;
    });
    var keptLinks = [];
    var keptIds = [];
    var seenId = {};
    blocks.forEach(function (block) {
      var link = normalizeLinkedProject(block);
      if (!link) return;
      var rowIds = [];
      if (Array.isArray(block.subprojectIds)) {
        rowIds = block.subprojectIds;
      } else if (Array.isArray(block.subprojects)) {
        rowIds = block.subprojects.map(function (s) { return s && s.subprojectId; }).filter(Boolean);
      }
      var matched = rowIds.filter(function (id) { return selected[String(id)]; });
      if (!matched.length) return;
      keptLinks.push(link);
      matched.forEach(function (id) {
        var sid = String(id);
        if (seenId[sid]) return;
        seenId[sid] = true;
        keptIds.push(sid);
      });
    });
    return buildEntaxiLinkSnapshot(keptLinks, keptIds);
  }

  function buildEntaxiLinkSnapshot(linkedProjects, subprojectIds) {
    var links = [];
    var seen = {};
    (linkedProjects || []).forEach(function (item) {
      var n = normalizeLinkedProject(item);
      if (!n) return;
      var key = n.projectId || n.projectTitle;
      if (!key || seen[key]) return;
      seen[key] = true;
      links.push(n);
    });
    var titles = links.map(function (p) { return p.projectTitle; }).filter(Boolean);
    return {
      linkedProjects: links,
      projectTitle: titles.length <= 1 ? (titles[0] || '') : titles.join(' · '),
      projectId: (links[0] && links[0].projectId) || '',
      subprojectIds: Array.isArray(subprojectIds) ? subprojectIds.slice() : []
    };
  }

  function groupEntaxeisByProjectTitle(entaxeis, preferredTitle) {
    var prefer = String(preferredTitle || '').trim();
    var groups = {};
    (entaxeis || []).forEach(function (entaxi) {
      var linked = getEntaxiLinkedProjects(entaxi).filter(function (p) { return p.projectTitle; });
      if (!linked.length) {
        if (!groups[UNLINKED_GROUP_TITLE]) groups[UNLINKED_GROUP_TITLE] = [];
        groups[UNLINKED_GROUP_TITLE].push(entaxi);
        return;
      }
      var key = linked[0].projectTitle;
      if (prefer) {
        var match = null;
        linked.forEach(function (p) {
          if (!match && p.projectTitle === prefer) match = p;
        });
        if (match) key = match.projectTitle;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(entaxi);
    });
    return groups;
  }

  function entaxiMatchesQuickSearch(entaxi, term) {
    var q = String(term || '').trim();
    if (!q) return true;
    var card = cardApi();
    var contains = card.containsSearchTerm || function () { return false; };
    var e = entaxi || {};
    return contains(e.subject, q)
      || contains(formatEntaxiProjectTitles(e), q)
      || contains(e.projectTitle, q)
      || contains(e.opsCode, q)
      || contains(e.diavgeiaAda, q)
      || contains(e.diavgeiaMeta && e.diavgeiaMeta.ada, q)
      || contains(e.beneficiary, q)
      || contains(e.fundingAuthority, q);
  }

  function showNewEntaxiButton(userRole) {
    return userRole !== 'USER' && userRole !== 'ENGINEER';
  }

  function showEntaxiDeleteAction(userRole) {
    return showNewEntaxiButton(userRole);
  }

  /**
   * Ίδια υποχρεωτικά με τη φόρμα ένταξης.
   * Κενό string κόβει· μόνο κενά στο θέμα περνάνε (όπως σήμερα).
   * Αρχείο ένταξης απαιτείται μόνο σε νέα εγγραφή.
   */
  function collectEntaxiRequiredErrors(formData, options) {
    var fd = formData || {};
    var opts = options || {};
    var isNew = opts.isNew !== false && !opts.editing;
    var errors = {};

    if (!fd.documentDate) {
      errors.documentDate = 'Η ημερομηνία είναι υποχρεωτική';
    }
    if (!fd.fundingAuthority) {
      errors.fundingAuthority = 'Ο φορέας χρηματοδότησης είναι υποχρεωτικός';
    }
    if (!fd.initialAmount) {
      errors.initialAmount = 'Το ποσό είναι υποχρεωτικό';
    }
    if (!fd.subject) {
      errors.subject = 'Το θέμα είναι υποχρεωτικό';
    }
    if (isNew && (!fd.entaxiPDFs || fd.entaxiPDFs.length === 0)) {
      errors.entaxiPDFs = 'Τουλάχιστον ένα αρχείο ένταξης είναι υποχρεωτικό';
    }
    return errors;
  }

  function evaluateEntaxiDelete(entaxiId) {
    if (!String(entaxiId || '').trim()) {
      return { ok: false, reason: 'missing-id' };
    }
    return { ok: true };
  }

  function removeEntaxiFromList(entaxeis, entaxiId) {
    var id = String(entaxiId || '').trim();
    var list = Array.isArray(entaxeis) ? entaxeis : [];
    if (!id) return list.slice();
    return list.filter(function (e) {
      return String((e && e.entaxiId) || '') !== id;
    });
  }

  function applyEntaxiDailyFilters(entaxeis, options) {
    var opts = options || {};
    var list = Array.isArray(entaxeis) ? entaxeis.slice() : [];
    if (opts.prosklisiIdFilter) {
      list = list.filter(function (e) { return e.prosklisiId === opts.prosklisiIdFilter; });
    }
    if (opts.projectFilter) {
      list = list.filter(function (e) { return entaxiLinksProjectTitle(e, opts.projectFilter); });
    }
    if (opts.quickSearchTerm) {
      list = list.filter(function (e) { return entaxiMatchesQuickSearch(e, opts.quickSearchTerm); });
    }
    if (opts.showUnlinkedOnly) {
      list = list.filter(isEntaxiUnlinked);
    }
    return list;
  }

  return {
    UNLINKED_GROUP_TITLE: UNLINKED_GROUP_TITLE,
    parseGreekAmountString: parseGreekAmountString,
    getEntaxiCurrentTotal: getEntaxiCurrentTotal,
    formatEntaxiAmount: formatEntaxiAmount,
    isEntaxiUnlinked: isEntaxiUnlinked,
    getEntaxiLinkedProjects: getEntaxiLinkedProjects,
    formatEntaxiProjectTitles: formatEntaxiProjectTitles,
    entaxiLinksProjectTitle: entaxiLinksProjectTitle,
    isSameEntaxiLinkedProject: isSameEntaxiLinkedProject,
    pruneEntaxiLinkSnapshot: pruneEntaxiLinkSnapshot,
    buildEntaxiLinkSnapshot: buildEntaxiLinkSnapshot,
    groupEntaxeisByProjectTitle: groupEntaxeisByProjectTitle,
    entaxiMatchesQuickSearch: entaxiMatchesQuickSearch,
    showNewEntaxiButton: showNewEntaxiButton,
    showEntaxiDeleteAction: showEntaxiDeleteAction,
    collectEntaxiRequiredErrors: collectEntaxiRequiredErrors,
    evaluateEntaxiDelete: evaluateEntaxiDelete,
    removeEntaxiFromList: removeEntaxiFromList,
    applyEntaxiDailyFilters: applyEntaxiDailyFilters
  };
});

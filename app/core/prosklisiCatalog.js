/**
 * Κατάλογος προσκλήσεων: ισχύουσα λήξη, καρτέλες, αναζήτηση,
 * υποχρεωτικά νέας πρόσκλησης και διαγραφή.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubProsklisiCatalog = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  function calendarApi() {
    try {
      if (typeof require === 'function') return require('./calendarDeadlines');
    } catch (e) { /* harness */ }
    return (root && root.ErgoHubCalendarDeadlines) || {};
  }

  function cardApi() {
    try {
      if (typeof require === 'function') return require('./subprojectCard');
    } catch (e) { /* harness */ }
    return (root && root.ErgoHubSubprojectCard) || {};
  }

  var PROSKLISI_VIEW_TABS = {
    ACTIVE: 'active',
    EXPIRED: 'expired',
    SUBMITTED: 'submitted'
  };

  function parseProsklisiDeadline(dateString) {
    return calendarApi().parseProsklisiDeadline(dateString);
  }

  function isUsableDeadlineValue(value) {
    if (value == null) return false;
    var s = String(value).trim();
    return !!s && s !== '-';
  }

  function modificationTimeMs(mod) {
    var candidates = [mod && mod.modificationDocumentDate, mod && mod.createdAt, mod && mod.updatedAt];
    for (var i = 0; i < candidates.length; i += 1) {
      var c = candidates[i];
      if (!c) continue;
      var parsed = parseProsklisiDeadline(c);
      if (parsed) return parsed.getTime();
      var t = Date.parse(c);
      if (!Number.isNaN(t)) return t;
    }
    return 0;
  }

  function sortModificationsChronologically(modifications) {
    return (modifications || []).slice().sort(function (a, b) {
      var ta = modificationTimeMs(a);
      var tb = modificationTimeMs(b);
      if (ta !== tb) return ta - tb;
      return String((a && a.createdAt) || '').localeCompare(String((b && b.createdAt) || ''));
    });
  }

  function getOriginalProsklisiDeadline(prosklisi, modifications) {
    var mods = sortModificationsChronologically(modifications || []);
    var deadlineChanges = mods.filter(function (m) {
      return m && m.changes && m.changes.deadline;
    });
    for (var i = 0; i < deadlineChanges.length; i += 1) {
      var orig = deadlineChanges[i].changes.deadline.original;
      if (isUsableDeadlineValue(orig)) return orig;
    }
    return (prosklisi && prosklisi.deadline) || '';
  }

  function getEffectiveProsklisiDeadline(prosklisi, modifications) {
    var mods = sortModificationsChronologically(modifications || []);
    var deadlineChanges = mods.filter(function (m) {
      return isUsableDeadlineValue(m && m.changes && m.changes.deadline && m.changes.deadline.current);
    });
    if (deadlineChanges.length > 0) {
      var deadline = deadlineChanges[0].changes.deadline.original;
      if (!isUsableDeadlineValue(deadline)) {
        deadline = (prosklisi && prosklisi.deadline) || '';
      }
      for (var i = 0; i < deadlineChanges.length; i += 1) {
        deadline = deadlineChanges[i].changes.deadline.current;
      }
      return deadline;
    }
    return (prosklisi && prosklisi.deadline) || '';
  }

  function getProsklisiDeadlineUrgency(deadline, now) {
    var d = parseProsklisiDeadline(deadline);
    if (!d) return 'none';
    var today = now ? new Date(now) : new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    var diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return 'expired';
    if (diffDays <= 7) return 'urgent';
    if (diffDays <= 30) return 'soon';
    return 'ok';
  }

  function getProsklisiDeadlineDaysLeft(deadline, now) {
    var d = parseProsklisiDeadline(deadline);
    if (!d) return null;
    var today = now ? new Date(now) : new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - today.getTime()) / 86400000);
  }

  function isProsklisiDeadlineExpiringSoon(deadline, withinDays, now) {
    var windowDays = withinDays == null ? 30 : withinDays;
    var urgency = getProsklisiDeadlineUrgency(deadline, now);
    if (urgency === 'expired' || urgency === 'urgent' || urgency === 'soon') {
      if (windowDays <= 7) return urgency === 'expired' || urgency === 'urgent';
      return true;
    }
    return false;
  }

  function isProsklisiDeadlineUpcomingSoon(deadline, withinDays, now) {
    var windowDays = withinDays == null ? 30 : withinDays;
    var urgency = getProsklisiDeadlineUrgency(deadline, now);
    if (urgency !== 'urgent' && urgency !== 'soon') return false;
    if (windowDays <= 7) return urgency === 'urgent';
    return true;
  }

  function getLatestProsklisiModificationDate(modifications) {
    var mods = sortModificationsChronologically(modifications || []);
    if (!mods.length) return '';
    var last = mods[mods.length - 1] || {};
    return last.modificationDocumentDate || last.createdAt || '';
  }

  function prosklisiHasModifications(prosklisi, modsMap) {
    var mods = (modsMap && prosklisi && modsMap[prosklisi.prosklisiId])
      || (prosklisi && prosklisi.modifications)
      || [];
    return Array.isArray(mods) && mods.length > 0;
  }

  function pushUniqueProsklisiAda(out, seen, val) {
    var s = String(val || '').trim();
    if (!s || seen[s]) return;
    seen[s] = true;
    out.push(s);
  }

  function collectProsklisiDiavgeiaAdaValues(prosklisi, modifications, adaFromMap) {
    var out = [];
    var seen = {};
    pushUniqueProsklisiAda(out, seen, adaFromMap);
    var p = prosklisi || {};
    pushUniqueProsklisiAda(out, seen, p.diavgeiaAda);
    if (p.diavgeiaMeta) pushUniqueProsklisiAda(out, seen, p.diavgeiaMeta.ada);
    var registry = Array.isArray(p.documentRegistry) ? p.documentRegistry : [];
    for (var i = 0; i < registry.length; i++) {
      var entry = registry[i];
      if (entry && entry.source === 'diavgeia') {
        pushUniqueProsklisiAda(out, seen, entry.ada || entry.adam);
      }
    }
    var mods = Array.isArray(modifications)
      ? modifications
      : (Array.isArray(p.modifications) ? p.modifications : []);
    for (var j = 0; j < mods.length; j++) {
      var mod = mods[j] || {};
      if (mod.diavgeiaMeta) pushUniqueProsklisiAda(out, seen, mod.diavgeiaMeta.ada);
      if (mod.diavgeiaDocument) pushUniqueProsklisiAda(out, seen, mod.diavgeiaDocument.ada);
      pushUniqueProsklisiAda(out, seen, mod.diavgeiaAda);
    }
    return out;
  }

  function getProsklisiDiavgeiaAdaText(prosklisi, modifications, adaFromMap) {
    return collectProsklisiDiavgeiaAdaValues(prosklisi, modifications, adaFromMap).join(' · ');
  }

  function prosklisiHasDiavgeiaAda(prosklisi, adaFromMap, modifications) {
    return collectProsklisiDiavgeiaAdaValues(prosklisi, modifications, adaFromMap).length > 0;
  }

  function prosklisiHasRelatedEntaxi(prosklisi, countsById) {
    var n = countsById && prosklisi ? countsById[prosklisi.prosklisiId] : 0;
    return Number(n) > 0;
  }

  function isProsklisiSubmittedStatus(status) {
    var s = String(status || '').trim();
    return s === 'Υποβληθέν ΤΔΠ' || s === 'Υποβληθέν';
  }

  function getProsklisiViewTab(prosklisi, modifications, now) {
    if (isProsklisiSubmittedStatus(prosklisi && prosklisi.status)) {
      return PROSKLISI_VIEW_TABS.SUBMITTED;
    }
    var deadline = getEffectiveProsklisiDeadline(prosklisi, modifications || []);
    if (getProsklisiDeadlineUrgency(deadline, now) === 'expired') {
      return PROSKLISI_VIEW_TABS.EXPIRED;
    }
    return PROSKLISI_VIEW_TABS.ACTIVE;
  }

  function deadlineSortKey(prosklisi, modificationsById) {
    var mods = (modificationsById && prosklisi && modificationsById[prosklisi.prosklisiId]) || [];
    var d = parseProsklisiDeadline(getEffectiveProsklisiDeadline(prosklisi, mods));
    return d ? d.getTime() : null;
  }

  function compareActiveProskliseis(a, b, modificationsById) {
    var ta = deadlineSortKey(a, modificationsById || {});
    var tb = deadlineSortKey(b, modificationsById || {});
    if (ta == null && tb == null) return 0;
    if (ta == null) return 1;
    if (tb == null) return -1;
    return ta - tb;
  }

  function compareExpiredProskliseis(a, b, modificationsById) {
    var ta = deadlineSortKey(a, modificationsById || {});
    var tb = deadlineSortKey(b, modificationsById || {});
    if (ta == null && tb == null) return 0;
    if (ta == null) return 1;
    if (tb == null) return -1;
    return tb - ta;
  }

  function compareProskliseisByDeadline(a, b) {
    var da = parseProsklisiDeadline(a && a.deadline);
    var db = parseProsklisiDeadline(b && b.deadline);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.getTime() - db.getTime();
  }

  function partitionProskliseisByViewTab(proskliseis, modificationsById, now) {
    var modsMap = modificationsById || {};
    var out = {};
    out[PROSKLISI_VIEW_TABS.ACTIVE] = [];
    out[PROSKLISI_VIEW_TABS.EXPIRED] = [];
    out[PROSKLISI_VIEW_TABS.SUBMITTED] = [];
    (proskliseis || []).forEach(function (p) {
      var tab = getProsklisiViewTab(p, modsMap[p.prosklisiId] || [], now);
      out[tab].push(p);
    });
    out[PROSKLISI_VIEW_TABS.ACTIVE].sort(function (a, b) {
      return compareActiveProskliseis(a, b, modsMap);
    });
    out[PROSKLISI_VIEW_TABS.EXPIRED].sort(function (a, b) {
      return compareExpiredProskliseis(a, b, modsMap);
    });
    out[PROSKLISI_VIEW_TABS.SUBMITTED].sort(function (a, b) {
      return String((a && a.title) || '').localeCompare(String((b && b.title) || ''), 'el', { sensitivity: 'base' });
    });
    return out;
  }

  function linkedTitlesText(prosklisi) {
    return linkedProjectTitlesOf(prosklisi).join(' ');
  }

  function isProsklisiUnlinked(prosklisi) {
    return !Array.isArray(prosklisi && prosklisi.linkedProjects) || prosklisi.linkedProjects.length === 0;
  }

  function prosklisiMatchesQuickSearch(prosklisi, searchTerm, extra) {
    var term = String(searchTerm || '').trim();
    if (!term) return true;
    var card = cardApi();
    var contains = card.containsSearchTerm || function () { return false; };
    var p = prosklisi || {};
    var ada = (extra && extra.diavgeiaAda) || '';
    return contains(p.title, term)
      || contains(p.axis, term)
      || contains(p.fundingSource, term)
      || contains(p.code, term)
      || contains(p.status, term)
      || contains(linkedTitlesText(p), term)
      || contains(ada, term);
  }

  function showNewProsklisiButton(userRole) {
    return userRole !== 'USER' && userRole !== 'ENGINEER';
  }

  function showProsklisiDeleteAction(userRole) {
    return showNewProsklisiButton(userRole);
  }

  /**
   * Ίδια υποχρεωτικά με τη φόρμα πρόσκλησης: μόνο τίτλος και άξονας, με trim.
   */
  function collectProsklisiRequiredErrors(formData) {
    var fd = formData || {};
    var errors = {};
    if (!String(fd.title || '').trim()) {
      errors.title = 'Ο τίτλος είναι υποχρεωτικός';
    }
    if (!String(fd.axis || '').trim()) {
      errors.axis = 'Ο άξονας προτεραιότητας είναι υποχρεωτικός';
    }
    return errors;
  }

  function evaluateProsklisiDelete(prosklisiId) {
    if (!String(prosklisiId || '').trim()) {
      return { ok: false, reason: 'missing-id' };
    }
    return { ok: true };
  }

  function removeProsklisiFromList(proskliseis, prosklisiId) {
    var id = String(prosklisiId || '').trim();
    var list = Array.isArray(proskliseis) ? proskliseis : [];
    if (!id) return list.slice();
    return list.filter(function (p) {
      return String((p && p.prosklisiId) || '') !== id;
    });
  }

  function parseProsklisiAmount(val) {
    if (val == null || val === '') return NaN;
    if (typeof val === 'number') return Number.isFinite(val) ? val : NaN;
    var cleaned = String(val).trim().replace(/[^\d,.-]/g, '');
    if (!cleaned) return NaN;
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
    return Number.isFinite(n) ? n : NaN;
  }

  function parseProsklisiBudgetRange(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    var parts = raw.split(/\s*(?:έως|εως|[-–—/])\s*/i).filter(Boolean);
    var amounts = [];
    parts.forEach(function (part) {
      var n = parseProsklisiAmount(part);
      if (Number.isFinite(n)) amounts.push(n);
    });
    if (!amounts.length) {
      var fallback = parseProsklisiAmount(raw);
      if (!Number.isFinite(fallback)) return null;
      return { min: fallback, max: fallback };
    }
    return {
      min: Math.min.apply(null, amounts),
      max: Math.max.apply(null, amounts)
    };
  }

  function prosklisiMatchesBudgetWindow(prosklisi, minBudget, maxBudget) {
    var range = parseProsklisiBudgetRange(prosklisi && prosklisi.budgetRange);
    if (!range) return false;
    var minRaw = String(minBudget == null ? '' : minBudget).trim();
    var maxRaw = String(maxBudget == null ? '' : maxBudget).trim();
    if (minRaw) {
      var minQ = parseProsklisiAmount(minRaw);
      if (Number.isFinite(minQ) && range.min + 0.001 < minQ) return false;
    }
    if (maxRaw) {
      var maxQ = parseProsklisiAmount(maxRaw);
      if (Number.isFinite(maxQ) && range.max - 0.001 > maxQ) return false;
    }
    return true;
  }

  function linkedProjectTitlesOf(prosklisi) {
    return (prosklisi && Array.isArray(prosklisi.linkedProjects) ? prosklisi.linkedProjects : [])
      .map(function (lp) {
        return typeof lp === 'string' ? lp : ((lp && (lp.title || lp.projectTitle)) || '');
      })
      .map(function (t) { return String(t || '').trim(); })
      .filter(Boolean);
  }

  function uniqueLinkedProjectTitles(proskliseis) {
    var seen = {};
    var out = [];
    (proskliseis || []).forEach(function (p) {
      linkedProjectTitlesOf(p).forEach(function (title) {
        if (seen[title]) return;
        seen[title] = true;
        out.push(title);
      });
    });
    return out.sort(function (a, b) {
      return a.localeCompare(b, 'el', { sensitivity: 'base' });
    });
  }

  function prosklisiLinksProjectTitle(prosklisi, title) {
    var want = String(title || '').trim();
    if (!want) return true;
    return linkedProjectTitlesOf(prosklisi).indexOf(want) !== -1;
  }

  function applyProsklisiAdvancedFilters(proskliseis, options) {
    var opts = options || {};
    var advanced = opts.advancedFilters || {};
    var modsMap = opts.modificationsById || {};
    var list = Array.isArray(proskliseis) ? proskliseis.slice() : [];
    var projectFilter = String(opts.projectFilter || '').trim();
    if (projectFilter) {
      list = list.filter(function (p) {
        return String((p && p.title) || '') === projectFilter
          || prosklisiLinksProjectTitle(p, projectFilter);
      });
    }
    if (String(advanced.axis || '').trim()) {
      list = list.filter(function (p) { return String((p && p.axis) || '') === String(advanced.axis).trim(); });
    }
    if (String(advanced.fundingSource || '').trim()) {
      list = list.filter(function (p) {
        return String((p && p.fundingSource) || '') === String(advanced.fundingSource).trim();
      });
    }
    if (String(advanced.linkedProject || '').trim()) {
      list = list.filter(function (p) {
        return prosklisiLinksProjectTitle(p, advanced.linkedProject);
      });
    }
    if (String(advanced.minBudget || '').trim() || String(advanced.maxBudget || '').trim()) {
      list = list.filter(function (p) {
        return prosklisiMatchesBudgetWindow(p, advanced.minBudget, advanced.maxBudget);
      });
    }
    var adaPresence = String(advanced.diavgeiaAda || '').trim();
    if (adaPresence === 'yes' || adaPresence === 'no') {
      var adaMap = opts.diavgeiaAdaById || {};
      list = list.filter(function (p) {
        var hasAda = prosklisiHasDiavgeiaAda(
          p,
          p && adaMap[p.prosklisiId],
          modsMap[p.prosklisiId] || (p && p.modifications)
        );
        return adaPresence === 'yes' ? hasAda : !hasAda;
      });
    }
    var entaxiPresence = String(advanced.relatedEntaxi || '').trim();
    if (entaxiPresence === 'yes' || entaxiPresence === 'no') {
      var counts = opts.relatedEntaxiCountById || {};
      list = list.filter(function (p) {
        var hasEntaxi = prosklisiHasRelatedEntaxi(p, counts);
        return entaxiPresence === 'yes' ? hasEntaxi : !hasEntaxi;
      });
    }
    if (advanced.dateFrom || advanced.dateTo) {
      list = list.filter(function (p) {
        var deadline = getEffectiveProsklisiDeadline(p, modsMap[p.prosklisiId] || []);
        if (!deadline) return false;
        if (advanced.dateFrom) {
          var fromCmp = compareProskliseisByDeadline({ deadline: deadline }, { deadline: advanced.dateFrom });
          if (fromCmp < 0) return false;
        }
        if (advanced.dateTo) {
          var toCmp = compareProskliseisByDeadline({ deadline: deadline }, { deadline: advanced.dateTo });
          if (toCmp > 0) return false;
        }
        return true;
      });
    }
    if (opts.selectedProsklisiId) {
      list = list.filter(function (p) { return p && p.prosklisiId === opts.selectedProsklisiId; });
    }
    return list;
  }

  var PROSKLISI_EXPORT_SCOPE = {
    VISIBLE_TAB: 'visibleTab',
    ALL_FILTERED: 'allFiltered'
  };

  var PROSKLISI_EXPORT_FORMAT = {
    EXCEL: 'excel',
    PDF: 'pdf'
  };

  function uniqueSortedProsklisiFieldValues(proskliseis, field) {
    var seen = {};
    var out = [];
    (proskliseis || []).forEach(function (p) {
      var v = String((p && p[field]) || '').trim();
      if (!v || seen[v]) return;
      seen[v] = true;
      out.push(v);
    });
    return out.sort(function (a, b) {
      return a.localeCompare(b, 'el', { sensitivity: 'base' });
    });
  }

  function statusesForProsklisiViewTab(statuses, viewTab) {
    var list = uniqueSortedProsklisiFieldValues(
      (statuses || []).map(function (s) { return { status: s }; }),
      'status'
    );
    if (viewTab === PROSKLISI_VIEW_TABS.SUBMITTED) {
      return list.filter(isProsklisiSubmittedStatus);
    }
    if (viewTab === PROSKLISI_VIEW_TABS.ACTIVE || viewTab === PROSKLISI_VIEW_TABS.EXPIRED) {
      return list.filter(function (s) { return !isProsklisiSubmittedStatus(s); });
    }
    return list;
  }

  function collectProsklisiFilterChips(options) {
    var opts = options || {};
    var advanced = opts.advancedFilters || {};
    var chips = [];
    var search = String(opts.searchTerm || '').trim();
    if (search) {
      chips.push({ id: 'search', label: 'Αναζήτηση: «' + search + '»' });
    }
    if (opts.quickSearchStatus) {
      chips.push({ id: 'status', label: 'Κατάσταση: ' + opts.quickSearchStatus });
    }
    if (opts.showExpiringSoonOnly) {
      chips.push({ id: 'expiringSoon', label: 'Λήγουν σύντομα' });
    }
    if (opts.showUnlinkedOnly) {
      chips.push({ id: 'unlinked', label: 'Χωρίς έργο' });
    }
    if (opts.showWithModificationsOnly) {
      chips.push({ id: 'withModifications', label: 'Με τροποποιήσεις' });
    }
    if (String(advanced.axis || '').trim()) {
      chips.push({ id: 'axis', label: 'Άξονας: ' + String(advanced.axis).trim() });
    }
    if (String(advanced.fundingSource || '').trim()) {
      chips.push({ id: 'fundingSource', label: 'Πηγή: ' + String(advanced.fundingSource).trim() });
    }
    if (String(advanced.linkedProject || '').trim()) {
      chips.push({ id: 'linkedProject', label: 'Έργο: ' + String(advanced.linkedProject).trim() });
    }
    if (String(advanced.minBudget || '').trim()) {
      chips.push({ id: 'minBudget', label: 'Π/Υ από ' + String(advanced.minBudget).trim() });
    }
    if (String(advanced.maxBudget || '').trim()) {
      chips.push({ id: 'maxBudget', label: 'Π/Υ έως ' + String(advanced.maxBudget).trim() });
    }
    if (String(advanced.dateFrom || '').trim()) {
      chips.push({ id: 'dateFrom', label: 'Λήξη από ' + String(advanced.dateFrom).trim() });
    }
    if (String(advanced.dateTo || '').trim()) {
      chips.push({ id: 'dateTo', label: 'Λήξη έως ' + String(advanced.dateTo).trim() });
    }
    if (advanced.diavgeiaAda === 'yes') {
      chips.push({ id: 'diavgeiaAda', label: 'Με ΑΔΑ Διαύγειας' });
    } else if (advanced.diavgeiaAda === 'no') {
      chips.push({ id: 'diavgeiaAda', label: 'Χωρίς ΑΔΑ Διαύγειας' });
    }
    if (advanced.relatedEntaxi === 'yes') {
      chips.push({ id: 'relatedEntaxi', label: 'Με σχετική ένταξη' });
    } else if (advanced.relatedEntaxi === 'no') {
      chips.push({ id: 'relatedEntaxi', label: 'Χωρίς σχετική ένταξη' });
    }
    return chips;
  }

  function countProsklisiActiveFilters(options) {
    return collectProsklisiFilterChips(options).length;
  }

  function resolveProsklisiExportRows(scope, lists) {
    var pack = lists || {};
    var visible = Array.isArray(pack.visibleRows) ? pack.visibleRows : [];
    var allFiltered = Array.isArray(pack.allFilteredRows) ? pack.allFilteredRows : [];
    if (scope === PROSKLISI_EXPORT_SCOPE.ALL_FILTERED) return allFiltered.slice();
    return visible.slice();
  }

  function buildProsklisiExportRecord(prosklisi, extras) {
    extras = extras || {};
    var p = prosklisi || {};
    var mods = Array.isArray(extras.modifications)
      ? extras.modifications
      : (Array.isArray(p.modifications) ? p.modifications : []);
    var record = {};
    Object.keys(p).forEach(function (key) {
      record[key] = p[key];
    });
    record.originalDeadline = extras.originalDeadline != null
      ? extras.originalDeadline
      : getOriginalProsklisiDeadline(p, mods);
    record.deadline = getEffectiveProsklisiDeadline(p, mods);
    record.lastModificationDate = extras.lastModificationDate != null
      ? extras.lastModificationDate
      : getLatestProsklisiModificationDate(mods);
    record.modificationsCount = extras.modificationsCount != null
      ? extras.modificationsCount
      : mods.length;
    record.diavgeiaAda = extras.diavgeiaAda != null
      ? extras.diavgeiaAda
      : getProsklisiDiavgeiaAdaText(p, mods);
    if (extras.linkedProjectsLabel != null) record.linkedProjectsLabel = extras.linkedProjectsLabel;
    if (extras.relatedEntaxeisCount != null) record.relatedEntaxeisCount = extras.relatedEntaxeisCount;
    return record;
  }

  function escapeProsklisiExportHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildProsklisiExportHtml(options) {
    var opts = options || {};
    var columns = Array.isArray(opts.columns) ? opts.columns : [];
    var rows = Array.isArray(opts.rows) ? opts.rows : [];
    var meta = opts.meta || {};
    var org = String(meta.organizationName || '').trim();
    var scopeLabel = String(meta.scopeLabel || '').trim();
    var exportedAt = String(meta.exportedAt || '').trim();
    var filters = Array.isArray(meta.filterSummary)
      ? meta.filterSummary.map(function (item) { return String(item || '').trim(); }).filter(Boolean)
      : [];
    var brand = org ? org + '  |  Δημιουργήθηκε με ERGOHUB' : 'Δημιουργήθηκε με ERGOHUB';
    var headerCells = columns.map(function (col) {
      return '<th>' + escapeProsklisiExportHtml((col && (col.label || col.id)) || '') + '</th>';
    }).join('');
    var bodyRows = rows.map(function (row, index) {
      var cells = columns.map(function (col) {
        var id = col && col.id;
        var val = row && id ? row[id] : '';
        return '<td>' + escapeProsklisiExportHtml(val) + '</td>';
      }).join('');
      return '<tr class="' + (index % 2 ? 'odd' : 'even') + '">' + cells + '</tr>';
    }).join('');
    var filterLine = filters.length
      ? '<p class="filters">Ισχύουν: ' + escapeProsklisiExportHtml(filters.join(' · ')) + '</p>'
      : '';
    return '<!DOCTYPE html><html lang="el"><head><meta charset="utf-8"/><title>Εξαγωγή Προσκλήσεων</title><style>'
      + 'body{margin:0;padding:0;font-family:"Segoe UI",Arial,sans-serif;color:#1e293b;background:#fff;font-size:10pt;-webkit-print-color-adjust:exact;print-color-adjust:exact;}'
      + '.header{background:linear-gradient(135deg,#4f46e5 0%,#4338ca 100%);color:#fff;padding:18px 22px;}'
      + '.brand{font-size:9px;font-weight:800;letter-spacing:.14em;opacity:.88;margin:0 0 6px;}'
      + 'h1{margin:0 0 6px;font-size:18px;}'
      + '.sub{margin:0;font-size:11px;opacity:.92;}'
      + '.content{padding:16px 22px 20px;}'
      + '.filters{margin:0 0 12px;color:#4338ca;font-weight:600;font-size:10px;}'
      + 'table{width:100%;border-collapse:collapse;table-layout:auto;}'
      + 'th{background:#4f46e5;color:#fff;font-size:9px;padding:6px 5px;text-align:center;border:1px solid #4338ca;}'
      + 'td{padding:5px;border:1px solid #e2e8f0;font-size:9px;text-align:center;vertical-align:top;}'
      + 'tr.even td{background:#eef2ff;}'
      + '.foot{margin-top:14px;padding-top:8px;border-top:1px solid #c7d2fe;color:#4338ca;font-size:9px;font-style:italic;text-align:center;}'
      + '</style></head><body><div class="header"><p class="brand">ERGOHUB</p>'
      + '<h1>Εξαγωγή Προσκλήσεων</h1>'
      + '<p class="sub">' + escapeProsklisiExportHtml(scopeLabel || (rows.length + ' προσκλήσεις'))
      + (exportedAt ? ' · ' + escapeProsklisiExportHtml(exportedAt) : '')
      + '</p></div><div class="content">'
      + filterLine
      + '<table><thead><tr>' + headerCells + '</tr></thead><tbody>' + bodyRows + '</tbody></table>'
      + '<p class="foot">' + escapeProsklisiExportHtml(brand) + '</p>'
      + '</div></body></html>';
  }

  function applyProsklisiDailyFilters(proskliseis, options) {
    var opts = options || {};
    var modsMap = opts.modificationsById || {};
    var now = opts.now;
    var list = Array.isArray(proskliseis) ? proskliseis.slice() : [];
    if (String(opts.searchTerm || '').trim()) {
      list = list.filter(function (p) {
        return prosklisiMatchesQuickSearch(p, opts.searchTerm, {
          diavgeiaAda: opts.diavgeiaAdaById && p.prosklisiId
            ? (opts.diavgeiaAdaById[p.prosklisiId] || '')
            : ''
        });
      });
    }
    if (opts.quickSearchStatus) {
      list = list.filter(function (p) { return p.status === opts.quickSearchStatus; });
    }
    if (opts.showExpiringSoonOnly) {
      list = list.filter(function (p) {
        var deadline = getEffectiveProsklisiDeadline(p, modsMap[p.prosklisiId] || []);
        return isProsklisiDeadlineUpcomingSoon(deadline, 30, now);
      });
    }
    if (opts.showUnlinkedOnly) {
      list = list.filter(isProsklisiUnlinked);
    }
    if (opts.showWithModificationsOnly) {
      list = list.filter(function (p) {
        return prosklisiHasModifications(p, modsMap);
      });
    }
    if (opts.sortByDeadline || opts.showExpiringSoonOnly) {
      list = list.slice().sort(function (a, b) {
        return compareProskliseisByDeadline(
          { deadline: getEffectiveProsklisiDeadline(a, modsMap[a.prosklisiId] || []) },
          { deadline: getEffectiveProsklisiDeadline(b, modsMap[b.prosklisiId] || []) }
        );
      });
    }
    return list;
  }

  return {
    PROSKLISI_VIEW_TABS: PROSKLISI_VIEW_TABS,
    parseProsklisiDeadline: parseProsklisiDeadline,
    getEffectiveProsklisiDeadline: getEffectiveProsklisiDeadline,
    getOriginalProsklisiDeadline: getOriginalProsklisiDeadline,
    getProsklisiDeadlineUrgency: getProsklisiDeadlineUrgency,
    getProsklisiDeadlineDaysLeft: getProsklisiDeadlineDaysLeft,
    isProsklisiDeadlineExpiringSoon: isProsklisiDeadlineExpiringSoon,
    isProsklisiDeadlineUpcomingSoon: isProsklisiDeadlineUpcomingSoon,
    getLatestProsklisiModificationDate: getLatestProsklisiModificationDate,
    prosklisiHasModifications: prosklisiHasModifications,
    getProsklisiDiavgeiaAdaText: getProsklisiDiavgeiaAdaText,
    prosklisiHasDiavgeiaAda: prosklisiHasDiavgeiaAda,
    prosklisiHasRelatedEntaxi: prosklisiHasRelatedEntaxi,
    isProsklisiSubmittedStatus: isProsklisiSubmittedStatus,
    getProsklisiViewTab: getProsklisiViewTab,
    compareActiveProskliseis: compareActiveProskliseis,
    compareExpiredProskliseis: compareExpiredProskliseis,
    compareProskliseisByDeadline: compareProskliseisByDeadline,
    partitionProskliseisByViewTab: partitionProskliseisByViewTab,
    linkedTitlesText: linkedTitlesText,
    isProsklisiUnlinked: isProsklisiUnlinked,
    prosklisiMatchesQuickSearch: prosklisiMatchesQuickSearch,
    showNewProsklisiButton: showNewProsklisiButton,
    showProsklisiDeleteAction: showProsklisiDeleteAction,
    collectProsklisiRequiredErrors: collectProsklisiRequiredErrors,
    evaluateProsklisiDelete: evaluateProsklisiDelete,
    removeProsklisiFromList: removeProsklisiFromList,
    applyProsklisiDailyFilters: applyProsklisiDailyFilters,
    applyProsklisiAdvancedFilters: applyProsklisiAdvancedFilters,
    parseProsklisiAmount: parseProsklisiAmount,
    parseProsklisiBudgetRange: parseProsklisiBudgetRange,
    prosklisiMatchesBudgetWindow: prosklisiMatchesBudgetWindow,
    uniqueLinkedProjectTitles: uniqueLinkedProjectTitles,
    prosklisiLinksProjectTitle: prosklisiLinksProjectTitle,
    PROSKLISI_EXPORT_SCOPE: PROSKLISI_EXPORT_SCOPE,
    PROSKLISI_EXPORT_FORMAT: PROSKLISI_EXPORT_FORMAT,
    uniqueSortedProsklisiFieldValues: uniqueSortedProsklisiFieldValues,
    statusesForProsklisiViewTab: statusesForProsklisiViewTab,
    collectProsklisiFilterChips: collectProsklisiFilterChips,
    countProsklisiActiveFilters: countProsklisiActiveFilters,
    resolveProsklisiExportRows: resolveProsklisiExportRows,
    buildProsklisiExportRecord: buildProsklisiExportRecord,
    buildProsklisiExportHtml: buildProsklisiExportHtml
  };
});

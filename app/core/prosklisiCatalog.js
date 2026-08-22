/**
 * Κατάλογος προσκλήσεων: ισχύουσα λήξη, καρτέλες, αναζήτηση, «λήγουν σύντομα», «χωρίς έργο».
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
    return (prosklisi && Array.isArray(prosklisi.linkedProjects) ? prosklisi.linkedProjects : [])
      .map(function (lp) {
        return typeof lp === 'string' ? lp : ((lp && (lp.title || lp.projectTitle)) || '');
      })
      .filter(Boolean)
      .join(' ');
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
        return isProsklisiDeadlineExpiringSoon(deadline, 30, now);
      });
    }
    if (opts.showUnlinkedOnly) {
      list = list.filter(isProsklisiUnlinked);
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
    getProsklisiDeadlineUrgency: getProsklisiDeadlineUrgency,
    getProsklisiDeadlineDaysLeft: getProsklisiDeadlineDaysLeft,
    isProsklisiDeadlineExpiringSoon: isProsklisiDeadlineExpiringSoon,
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
    applyProsklisiDailyFilters: applyProsklisiDailyFilters
  };
});

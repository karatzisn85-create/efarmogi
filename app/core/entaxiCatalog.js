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
    return !entaxi || !entaxi.projectTitle || entaxi.projectTitle === ''
      || !entaxi.subprojectIds || entaxi.subprojectIds.length === 0;
  }

  function groupEntaxeisByProjectTitle(entaxeis) {
    var groups = {};
    (entaxeis || []).forEach(function (entaxi) {
      var key = (entaxi && entaxi.projectTitle) || UNLINKED_GROUP_TITLE;
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
    return contains(e.subject, q) || contains(e.projectTitle, q);
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
      list = list.filter(function (e) { return e.projectTitle === opts.projectFilter; });
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

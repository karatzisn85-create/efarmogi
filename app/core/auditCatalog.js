/**
 * Ιστορικό ενεργειών: ποιος το ανοίγει, τι βλέπει κάθε ρόλος, φίλτρα, εκκαθάριση.
 * Ίδιες αποφάσεις με την οθόνη και την αποθήκευση.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubAuditCatalog = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DEFAULT_LIMIT = 1000;

  var ENTITY_TYPE_LABELS = {
    project: 'Έργο',
    subproject: 'Υποέργο',
    prosklisi: 'Πρόσκληση',
    entaxi: 'Ένταξη',
    egkrisi: 'Έγκριση Διάθεσης Πίστωσης',
    egkrisi_subproject: 'Υποέργο Εγκρίσεων',
    prosklisi_modification: 'Τροποποίηση Πρόσκλησης',
    entaxi_modification: 'Τροποποίηση Ένταξης',
    user: 'Χρήστης',
    file: 'Αρχείο',
    file_group: 'Ομάδα Αρχείων',
    document_template: 'Υπόδειγμα Εγγράφου',
    document_category: 'Κατηγορία Εγγράφων',
    note: 'Σημείωση',
    note_group: 'Ομάδα Σημειώσεων',
    egkrisi_link: 'Σύνδεση Έγκρισης',
    proposal: 'Έργο Ωρίμανσης',
    meleti: 'Μελέτη',
    meletai_hub: 'Μητρώο Μελετών',
    calendarConfig: 'Ρυθμίσεις Ημερολογίου',
    municipalUnitsConfig: 'Δημοτικές Ενότητες'
  };

  var ACTION_LABELS = {
    create: 'Δημιουργία',
    update: 'Ενημέρωση',
    delete: 'Διαγραφή',
    import: 'Εισαγωγή',
    export: 'Εξαγωγή'
  };

  function showAuditLogButton(userRole) {
    return userRole === 'ADMIN' || userRole === 'SUPERADMIN' || userRole === 'ENGINEER';
  }

  function canReadAuditLog(actor) {
    return !!(actor && actor.active !== false);
  }

  function filterLogsByViewerRole(logs, actor) {
    var role = actor && actor.role;
    var reqUsername = String((actor && actor.username) || '').toLowerCase();
    var reqFullName = String((actor && actor.fullName) || '').toLowerCase();
    var list = logs || [];

    if (role === 'ENGINEER' || role === 'USER') {
      return list.filter(function (log) {
        var logUser = String((log && (log.userFullName || log.user)) || '').toLowerCase();
        return logUser === reqFullName || logUser === reqUsername;
      });
    }
    if (role === 'ADMIN') {
      return list.filter(function (log) {
        var logRole = String((log && log.userRole) || '').toUpperCase();
        return logRole === 'ADMIN' || !logRole;
      });
    }
    return list.slice();
  }

  function applyAuditListFilters(logs, options) {
    var opts = options || {};
    var filtered = (logs || []).slice();

    if (opts.entityType) {
      filtered = filtered.filter(function (log) { return log.entityType === opts.entityType; });
    }
    if (opts.entityId) {
      filtered = filtered.filter(function (log) { return log.entityId === opts.entityId; });
    }
    if (opts.action) {
      filtered = filtered.filter(function (log) { return log.action === opts.action; });
    }
    if (opts.startDate) {
      var start = new Date(opts.startDate);
      filtered = filtered.filter(function (log) { return new Date(log.timestamp) >= start; });
    }
    if (opts.endDate) {
      var end = new Date(opts.endDate);
      filtered = filtered.filter(function (log) { return new Date(log.timestamp) <= end; });
    }

    var limit = opts.limit == null ? DEFAULT_LIMIT : opts.limit;
    return filtered.slice(0, limit);
  }

  function evaluateGetAuditLog(logs, actor, options) {
    if (!canReadAuditLog(actor)) {
      return { ok: false, error: 'Δεν έχετε δικαίωμα πρόσβασης στο ιστορικό' };
    }
    var all = logs || [];
    var visible = filterLogsByViewerRole(all, actor);
    return {
      ok: true,
      logs: applyAuditListFilters(visible, options),
      total: all.length
    };
  }

  function evaluateClearAuditLog(actorIsSuperAdmin) {
    if (!actorIsSuperAdmin) {
      return { ok: false, error: 'Δεν έχετε δικαίωμα εκκαθάρισης ιστορικού ενεργειών' };
    }
    return { ok: true };
  }

  function clearAuditLogs(logs, keepLast) {
    var keep = Math.max(0, Number(keepLast) || 0);
    var list = logs || [];
    if (list.length > keep) {
      return { logs: list.slice(0, keep), deletedCount: list.length - keep };
    }
    return { logs: list.slice(), deletedCount: 0 };
  }

  function shouldSkipEmptyUpdate(type, changes) {
    return type === 'update' && !!changes && Object.keys(changes).length === 0;
  }

  function normalizeAuditText(s) {
    if (typeof s !== 'string') return s;
    return s.normalize('NFC')
      .replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function dropEmptyUpdateLogs(logs) {
    return (logs || []).map(function (log) {
      if (!log || log.action !== 'update' || !log.changes) return log;
      var realChanges = {};
      Object.keys(log.changes).forEach(function (field) {
        var change = log.changes[field] || {};
        var o = normalizeAuditText(change.old);
        var n = normalizeAuditText(change.new);
        if (o !== n) realChanges[field] = change;
      });
      var next = {};
      Object.keys(log).forEach(function (k) { next[k] = log[k]; });
      next.changes = realChanges;
      return next;
    }).filter(function (log) {
      if (log && log.action === 'update' && log.changes && Object.keys(log.changes).length === 0) {
        return false;
      }
      return true;
    });
  }

  function showClearAuditButton(userRole, logsLength) {
    return userRole === 'SUPERADMIN' && logsLength > 0;
  }

  function getAuditVisibilityText(role) {
    if (role === 'SUPERADMIN') return 'Βλέπετε τις ενέργειες ΟΛΩΝ των χρηστών.';
    if (role === 'ADMIN') return 'Βλέπετε τις ενέργειες όλων των Διαχειριστών και Μηχανικών.';
    return 'Βλέπετε μόνο τις δικές σας ενέργειες.';
  }

  function summarizeAuditStats(logs) {
    var list = logs || [];
    return {
      total: list.length,
      creates: list.filter(function (l) { return l.action === 'create'; }).length,
      updates: list.filter(function (l) { return l.action === 'update'; }).length,
      deletes: list.filter(function (l) { return l.action === 'delete'; }).length
    };
  }

  function getActionLabel(action) {
    return ACTION_LABELS[action] || action;
  }

  function getEntityTypeLabel(entityType) {
    return ENTITY_TYPE_LABELS[entityType] || entityType;
  }

  return {
    DEFAULT_LIMIT: DEFAULT_LIMIT,
    ENTITY_TYPE_LABELS: ENTITY_TYPE_LABELS,
    ACTION_LABELS: ACTION_LABELS,
    showAuditLogButton: showAuditLogButton,
    canReadAuditLog: canReadAuditLog,
    filterLogsByViewerRole: filterLogsByViewerRole,
    applyAuditListFilters: applyAuditListFilters,
    evaluateGetAuditLog: evaluateGetAuditLog,
    evaluateClearAuditLog: evaluateClearAuditLog,
    clearAuditLogs: clearAuditLogs,
    shouldSkipEmptyUpdate: shouldSkipEmptyUpdate,
    normalizeAuditText: normalizeAuditText,
    dropEmptyUpdateLogs: dropEmptyUpdateLogs,
    showClearAuditButton: showClearAuditButton,
    getAuditVisibilityText: getAuditVisibilityText,
    summarizeAuditStats: summarizeAuditStats,
    getActionLabel: getActionLabel,
    getEntityTypeLabel: getEntityTypeLabel
  };
});

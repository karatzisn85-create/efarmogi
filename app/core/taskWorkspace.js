/**
 * Χώρος εργασίας και αποθήκη: ποιος βλέπει τι, καρτέλες, αναζήτηση, δημιουργία.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubTaskWorkspace = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  function cardApi() {
    try {
      if (typeof require === 'function') return require('./subprojectCard');
    } catch (e) { /* harness */ }
    return (root && root.ErgoHubSubprojectCard) || {};
  }

  var TASK_STATUS_LABELS = {
    pending: 'Εκκρεμεί',
    in_progress: 'Σε εξέλιξη',
    completed: 'Ολοκληρώθηκε',
    cancelled: 'Κλειστός',
    rejected: 'Αποχώρησε (legacy)'
  };

  function sameUser(a, b) {
    return String(a || '').toLowerCase() === String(b || '').toLowerCase();
  }

  function isTaskAssigner(task, username) {
    return !!(task && task.createdBy && sameUser(task.createdBy, username));
  }

  function isTaskAssignee(task, username) {
    if (!task || !username) return false;
    return (task.assignees || []).some(function (a) { return sameUser(a, username); });
  }

  function isTaskWithdrawnByAssigner(task) {
    return !!(task && task.status === 'cancelled' && task.withdrawnByAssigner);
  }

  function hasLeftWorkArchive(task, username) {
    if (!task || !username) return false;
    return (task.leftArchiveBy || []).some(function (x) { return sameUser(x, username); });
  }

  function isTaskHiddenFromPureAssignee(task, username) {
    if (isTaskAssigner(task, username)) return false;
    if (!isTaskAssignee(task, username)) return false;
    if (isTaskWithdrawnByAssigner(task)) return true;
    if (task.status === 'completed' && hasLeftWorkArchive(task, username)) return true;
    return false;
  }

  function canAccessTask(task, username, isSuperAdmin) {
    if (!task) return false;
    if (isSuperAdmin) return true;
    if (isTaskAssigner(task, username)) return true;
    if (isTaskAssignee(task, username)) return !isTaskHiddenFromPureAssignee(task, username);
    return false;
  }

  function showCreateTaskButton(canAssign, isWorkArchive) {
    return !!canAssign && !isWorkArchive;
  }

  function taskMatchesQuickSearch(task, searchTerm) {
    if (!searchTerm) return true;
    var card = cardApi();
    var contains = card.containsSearchTerm || function () { return false; };
    var t = task || {};
    var blob = [t.title, t.description, t.createdBy].concat(t.assignees || []).join(' ');
    return contains(blob, searchTerm);
  }

  function applyTaskDailyFilters(tasks, options) {
    var opts = options || {};
    var isWorkArchive = !!opts.isWorkArchive;
    return (tasks || []).filter(function (t) {
      if (isWorkArchive) {
        if (t.status !== 'completed') return false;
      } else if (t.status === 'completed') {
        return false;
      }
      if (opts.statusFilter && t.status !== opts.statusFilter) return false;
      if (!taskMatchesQuickSearch(t, opts.search)) return false;
      return true;
    });
  }

  function listTasksForView(tasks, options) {
    var opts = options || {};
    var username = opts.actingUsername;
    var view = opts.view || 'asAssignee';
    var isSA = !!opts.isSuperAdmin;
    var canAssign = !!opts.canAssign || isSA;
    var list = (tasks || []).slice();

    if (view === 'asAssigner') {
      if (!canAssign) return [];
      list = list.filter(function (t) { return isTaskAssigner(t, username); });
    } else if (!(view === 'all' && isSA)) {
      list = list.filter(function (t) {
        return isTaskAssignee(t, username) || isTaskAssigner(t, username);
      });
    }

    if (opts.listScope === 'workArchive') {
      list = list.filter(function (t) { return t.status === 'completed'; });
    } else if (opts.listScope === 'default' || !opts.listScope) {
      list = list.filter(function (t) { return t.status !== 'completed'; });
    }

    if (!(view === 'all' && isSA)) {
      list = list.filter(function (t) {
        if (isSA) return true;
        return !isTaskHiddenFromPureAssignee(t, username);
      });
    }

    list.sort(function (a, b) {
      return String((b && b.updatedAt) || '').localeCompare(String((a && a.updatedAt) || ''));
    });
    return list;
  }

  return {
    TASK_STATUS_LABELS: TASK_STATUS_LABELS,
    isTaskAssigner: isTaskAssigner,
    isTaskAssignee: isTaskAssignee,
    isTaskWithdrawnByAssigner: isTaskWithdrawnByAssigner,
    hasLeftWorkArchive: hasLeftWorkArchive,
    isTaskHiddenFromPureAssignee: isTaskHiddenFromPureAssignee,
    canAccessTask: canAccessTask,
    showCreateTaskButton: showCreateTaskButton,
    taskMatchesQuickSearch: taskMatchesQuickSearch,
    applyTaskDailyFilters: applyTaskDailyFilters,
    listTasksForView: listTasksForView
  };
});

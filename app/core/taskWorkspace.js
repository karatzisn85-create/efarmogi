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
      /* Συμμετέχω: μόνο χώροι όπου σας έβαλαν άλλοι — όχι όσα ανοίξατε εσείς. */
      list = list.filter(function (t) {
        return isTaskAssignee(t, username) && !isTaskAssigner(t, username);
      });
    }

    if (opts.listScope === 'workArchive') {
      list = list.filter(function (t) { return t.status === 'completed'; });
    } else if (opts.listScope === 'assignerAll') {
      /* ανοιχτά + ολοκληρωμένα + κλειστά — για όψη ανά άτομο του αναθέτη */
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

  function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isOpenWorkStatus(status) {
    return status === 'pending' || status === 'in_progress';
  }

  function canInviteAssigneesToTask(task, username, opts) {
    var options = opts || {};
    var canAssign = !!(options.canAssign || options.isSuperAdmin);
    if (!task || !username || !canAssign) return false;
    if (!isOpenWorkStatus(task.status)) return false;
    if (isTaskWithdrawnByAssigner(task)) return false;
    if (options.isSuperAdmin) return true;
    return isTaskAssignee(task, username) || isTaskAssigner(task, username);
  }

  function mergeAddedAssignees(task, usernamesToAdd) {
    var existing = Array.isArray(task && task.assignees) ? task.assignees.slice() : [];
    var seen = {};
    existing.forEach(function (a) {
      seen[normalizeUsername(a)] = true;
    });
    var added = [];
    (usernamesToAdd || []).forEach(function (raw) {
      var name = String(raw || '').trim();
      if (!name) return;
      var key = normalizeUsername(name);
      if (seen[key]) return;
      seen[key] = true;
      added.push(name);
    });
    return {
      assignees: existing.concat(added),
      added: added,
      createdBy: task && task.createdBy
    };
  }

  function lookupUser(usersMap, username) {
    var map = usersMap || {};
    if (map[username]) return map[username];
    var key = normalizeUsername(username);
    var names = Object.keys(map);
    for (var i = 0; i < names.length; i += 1) {
      if (normalizeUsername(names[i]) === key) return map[names[i]];
    }
    return null;
  }

  function displayNameOf(usersMap, username) {
    var u = lookupUser(usersMap, username);
    return (u && u.fullName) || username;
  }

  /** Συμμετέχοντες που μετράνε στην όψη ανά άτομο — χωρίς τον αναθέτη. */
  function rosterAssignees(task, assignerUsername) {
    var left = {};
    (task.leftArchiveBy || []).forEach(function (x) {
      left[normalizeUsername(x)] = true;
    });
    var seen = {};
    return (task.assignees || []).filter(function (a) {
      if (!String(a || '').trim()) return false;
      if (sameUser(a, assignerUsername)) return false;
      if (task.status === 'completed' && left[normalizeUsername(a)]) return false;
      var key = normalizeUsername(a);
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function taskCountsAsOpenForPerson(task) {
    if (!task) return false;
    if (isTaskWithdrawnByAssigner(task)) return false;
    return isOpenWorkStatus(task.status);
  }

  function isTaskOverdueAt(task, now) {
    if (!task || !task.dueDate) return false;
    if (!isOpenWorkStatus(task.status)) return false;
    var d = new Date(String(task.dueDate) + 'T' + (task.dueTime || '23:59'));
    if (isNaN(d.getTime())) return false;
    var today = now instanceof Date ? new Date(now.getTime()) : new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  }

  function togetherWithLabel(task, selectedUsername, usersMap) {
    var seen = {};
    var others = (task.assignees || []).filter(function (a) {
      if (!String(a || '').trim()) return false;
      if (sameUser(a, selectedUsername)) return false;
      if (task && sameUser(a, task.createdBy)) return false;
      var key = normalizeUsername(a);
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
    if (others.length === 0) return '';
    var names = others.map(function (u) { return displayNameOf(usersMap, u); });
    return 'μαζί με ' + names.join(', ');
  }

  /**
   * Όσα δημιούργησε ο αναθέτης, ομαδοποιημένα ανά συμμετέχοντα.
   * Ένας ομαδικός χώρος = μία υπόθεση στο σύνολο, μία γραμμή σε κάθε άτομο.
   */
  function buildAssignerPersonRoster(tasks, options) {
    var opts = options || {};
    var assigner = opts.actingUsername;
    var usersMap = opts.usersMap || {};
    var now = opts.now || new Date();
    var search = opts.search || '';
    var byKey = {};

    function ensure(username) {
      var key = normalizeUsername(username);
      if (!byKey[key]) {
        var meta = lookupUser(usersMap, username);
        byKey[key] = {
          username: (meta && meta.username) || username,
          fullName: (meta && meta.fullName) || username,
          openCount: 0,
          completedCount: 0,
          overdueCount: 0,
          closedCount: 0,
          openTasks: [],
          completedTasks: [],
          closedTasks: []
        };
      }
      return byKey[key];
    }

    var openSpaceIds = {};
    (tasks || []).forEach(function (task) {
      if (!isTaskAssigner(task, assigner)) return;
      var open = taskCountsAsOpenForPerson(task);
      var done = task.status === 'completed';
      var onPeople = rosterAssignees(task, assigner);
      if (open && onPeople.length > 0) openSpaceIds[task.id] = true;
      if (!open && !done && task.status !== 'cancelled') return;
      onPeople.forEach(function (uname) {
        var row = ensure(uname);
        if (open) {
          row.openCount += 1;
          row.openTasks.push(task);
          if (isTaskOverdueAt(task, now)) row.overdueCount += 1;
        } else if (done) {
          row.completedCount += 1;
          row.completedTasks.push(task);
        } else {
          row.closedCount += 1;
          row.closedTasks.push(task);
        }
      });
    });

    var people = Object.keys(byKey).map(function (k) { return byKey[k]; });
    people.sort(function (a, b) {
      if (b.openCount !== a.openCount) return b.openCount - a.openCount;
      return String(a.fullName).localeCompare(String(b.fullName), 'el');
    });

    var seen = {};
    people.forEach(function (p) { seen[normalizeUsername(p.username)] = true; });
    var idleCount = 0;
    (opts.assignableUsernames || []).forEach(function (u) {
      if (sameUser(u, assigner)) return;
      if (!seen[normalizeUsername(u)]) idleCount += 1;
    });
    var peopleWithWorkCount = people.filter(function (p) { return p.openCount > 0; }).length;
    var openSpaceCount = Object.keys(openSpaceIds).length;

    if (search) {
      people = people.filter(function (p) {
        if (taskMatchesQuickSearch({
          title: p.fullName,
          description: p.username,
          createdBy: '',
          assignees: []
        }, search)) return true;
        return p.openTasks.concat(p.completedTasks, p.closedTasks).some(function (t) {
          return taskMatchesQuickSearch(t, search);
        });
      });
    }

    return {
      people: people,
      openSpaceCount: openSpaceCount,
      peopleWithWorkCount: peopleWithWorkCount,
      idleCount: idleCount
    };
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
    listTasksForView: listTasksForView,
    canInviteAssigneesToTask: canInviteAssigneesToTask,
    mergeAddedAssignees: mergeAddedAssignees,
    togetherWithLabel: togetherWithLabel,
    buildAssignerPersonRoster: buildAssignerPersonRoster,
    isTaskOverdueAt: isTaskOverdueAt
  };
});

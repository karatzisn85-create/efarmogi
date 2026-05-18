/**
 * Χώρος Εργασίας — αυτόνομο module (ξεχωριστό από έργα).
 */
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { safeWriteJSON } = require('./safeWrite');

const TASKS_ROOT = 'ANATHESEIS_ERGASION';
const FILES_SUBDIR = 'ARXEIA';

const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];
const OPEN_STATUSES = ['pending', 'in_progress'];
const DEFAULT_REMINDER_OFFSETS = [7, 3, 1, 0];

function normalizeTaskAssignment(raw) {
  if (!raw || typeof raw !== 'object') {
    return { canAssign: false, assignableScope: 'none', assignableUsernames: [] };
  }
  const canAssign = raw.canAssign === true;
  let assignableScope = String(raw.assignableScope || 'none').trim();
  if (!['none', 'all', 'selected'].includes(assignableScope)) {
    assignableScope = canAssign ? 'all' : 'none';
  }
  if (!canAssign) assignableScope = 'none';
  const assignableUsernames = Array.isArray(raw.assignableUsernames)
    ? [...new Set(raw.assignableUsernames.map((u) => String(u || '').trim()).filter(Boolean))]
    : [];
  return { canAssign, assignableScope, assignableUsernames };
}

function sanitizeTaskAssignmentForClient(ta) {
  return normalizeTaskAssignment(ta || {});
}

function findUser(users, username) {
  const u = String(username || '').trim();
  if (!u) return null;
  return users.find((x) => x.username.toLowerCase() === u.toLowerCase()) || null;
}

function isActiveApprovedUser(user) {
  return user && user.active !== false && user.approved !== false;
}

function getEligibleAssigneeUsernames(users, excludeUsername) {
  const ex = String(excludeUsername || '').trim().toLowerCase();
  return users
    .filter((u) => isActiveApprovedUser(u) && u.username.toLowerCase() !== ex)
    .map((u) => u.username);
}

function isSuperAdminRole(users, username) {
  const u = findUser(users, username);
  return !!(u && u.role === 'SUPERADMIN');
}

function canUserAssignTo(users, assignerUsername, assigneeUsernames) {
  const assigner = findUser(users, assignerUsername);
  if (!assigner) return { ok: false, error: 'Άγνωστος χρήστης' };

  const targets = [...new Set((assigneeUsernames || []).map((x) => String(x || '').trim()).filter(Boolean))];
  if (targets.length === 0) return { ok: false, error: 'Επιλέξτε τουλάχιστον έναν συνάδελφο' };

  if (isSuperAdminRole(users, assignerUsername)) {
    const assignees = [...new Set(
      targets.map((t) => {
        const u = findUser(users, t);
        return u ? u.username : t;
      })
    )];
    return { ok: true, assignees };
  }

  const ta = normalizeTaskAssignment(assigner.taskAssignment);
  if (!ta.canAssign) return { ok: false, error: 'Δεν έχετε δικαίωμα δημιουργίας χώρου εργασίας' };

  const allowed =
    ta.assignableScope === 'all'
      ? getEligibleAssigneeUsernames(users, assigner.username)
      : ta.assignableUsernames.filter((name) => {
          const u = findUser(users, name);
          return u && isActiveApprovedUser(u) && name.toLowerCase() !== assigner.username.toLowerCase();
        });

  const allowedSet = new Set(allowed.map((x) => x.toLowerCase()));
  const invalid = targets.filter((t) => !allowedSet.has(t.toLowerCase()));
  if (invalid.length > 0) {
    return { ok: false, error: `Μη επιτρεπτοί συνάδελφοι: ${invalid.join(', ')}` };
  }
  const assignees = [...new Set(
    targets.map((t) => {
      const u = findUser(users, t);
      return u ? u.username : t;
    })
  )];
  return { ok: true, assignees };
}

function createTaskAssignmentService(deps) {
  const { dataDir, loadUsers, getTempDir, onNotifyMainWindow } = deps;

  function getRoot() {
    return path.join(dataDir, TASKS_ROOT);
  }

  function getIndexPath() {
    return path.join(getRoot(), 'index.json');
  }

  function getNotificationsPath() {
    return path.join(getRoot(), 'notifications.json');
  }

  function getTaskDir(taskId) {
    return path.join(getRoot(), taskId);
  }

  function getTaskDataPath(taskId) {
    return path.join(getTaskDir(taskId), 'data.json');
  }

  function getTaskFilesDir(taskId) {
    return path.join(getTaskDir(taskId), FILES_SUBDIR);
  }

  function ensureTaskStorage() {
    const root = getRoot();
    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
    const idx = getIndexPath();
    if (!fs.existsSync(idx)) {
      safeWriteJSON(idx, { version: 1, tasks: [], updatedAt: new Date().toISOString() });
    }
    const notif = getNotificationsPath();
    if (!fs.existsSync(notif)) {
      safeWriteJSON(notif, { version: 1, items: [], updatedAt: new Date().toISOString() });
    }
  }

  function readIndex() {
    ensureTaskStorage();
    try {
      const raw = JSON.parse(fs.readFileSync(getIndexPath(), 'utf8'));
      return Array.isArray(raw.tasks) ? raw : { version: 1, tasks: [], updatedAt: '' };
    } catch {
      return { version: 1, tasks: [], updatedAt: '' };
    }
  }

  function writeIndex(tasks) {
    safeWriteJSON(getIndexPath(), {
      version: 1,
      tasks,
      updatedAt: new Date().toISOString()
    });
  }

  function taskToIndexEntry(task) {
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate || '',
      dueTime: task.dueTime || '',
      assignees: task.assignees || [],
      createdBy: task.createdBy,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      withdrawnByAssigner: !!task.withdrawnByAssigner,
      leftArchiveBy: Array.isArray(task.leftArchiveBy) ? task.leftArchiveBy : []
    };
  }

  /** Μετατροπή παλιάς κατάστασης «απορρίφθηκε» σε αποχώρηση συμμετέχοντα. */
  function migrateLegacyTask(task) {
    if (!task) return { task: null, changed: false };
    let t = { ...task };
    let changed = false;

    if (t.status === 'rejected') {
      t.status = 'pending';
      changed = true;
    }

    const legacyRejecter = t.rejectedBy ? String(t.rejectedBy).trim() : '';
    if (legacyRejecter) {
      const rbLower = legacyRejecter.toLowerCase();
      const assignees = Array.isArray(t.assignees) ? [...t.assignees] : [];
      if (assignees.some((a) => String(a).toLowerCase() === rbLower)) {
        t.assignees = assignees.filter((a) => String(a).toLowerCase() !== rbLower);
        changed = true;
      }
      t.departedAssignees = Array.isArray(t.departedAssignees) ? [...t.departedAssignees] : [];
      if (!t.departedAssignees.some((d) => String(d.username || '').toLowerCase() === rbLower)) {
        t.departedAssignees.push({
          username: legacyRejecter,
          at: t.rejectedAt || t.updatedAt || new Date().toISOString(),
          note: t.rejectionReason ? String(t.rejectionReason).trim() || null : null
        });
        changed = true;
      }
    }

    for (const key of ['rejectedAt', 'rejectedBy', 'rejectionReason']) {
      if (t[key] != null) {
        delete t[key];
        changed = true;
      }
    }
    if (!Array.isArray(t.departedAssignees)) {
      t.departedAssignees = [];
      changed = true;
    }

    const activeSet = new Set((t.assignees || []).map((a) => String(a).toLowerCase()));
    const syncedDeparted = (t.departedAssignees || []).filter(
      (d) => !activeSet.has(String(d.username || '').toLowerCase())
    );
    if (syncedDeparted.length !== (t.departedAssignees || []).length) {
      t.departedAssignees = syncedDeparted;
      changed = true;
    }

    return { task: t, changed };
  }

  function readTask(taskId) {
    const fp = getTaskDataPath(taskId);
    if (!fs.existsSync(fp)) return null;
    try {
      const parsed = JSON.parse(fs.readFileSync(fp, 'utf8'));
      const { task, changed } = migrateLegacyTask(parsed);
      if (changed && task) writeTask(task);
      return task;
    } catch {
      return null;
    }
  }

  function writeTask(task) {
    const dir = getTaskDir(task.id);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filesDir = getTaskFilesDir(task.id);
    if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });
    safeWriteJSON(getTaskDataPath(task.id), task);

    const idx = readIndex();
    const entry = taskToIndexEntry(task);
    const i = idx.tasks.findIndex((t) => t.id === task.id);
    if (i >= 0) idx.tasks[i] = entry;
    else idx.tasks.push(entry);
    writeIndex(idx.tasks);
  }

  function deleteTaskFromDisk(taskId) {
    const dir = getTaskDir(taskId);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    const idx = readIndex();
    writeIndex(idx.tasks.filter((t) => t.id !== taskId));
  }

  function isAssigner(task, username) {
    return task.createdBy && task.createdBy.toLowerCase() === String(username || '').toLowerCase();
  }

  function isAssignee(task, username) {
    const u = String(username || '').toLowerCase();
    return (task.assignees || []).some((a) => String(a).toLowerCase() === u);
  }

  function hasLeftArchive(task, username) {
    const u = String(username || '').toLowerCase();
    return (task.leftArchiveBy || []).some((x) => String(x).toLowerCase() === u);
  }

  function isSuperAdmin(users, username) {
    const u = findUser(users, username);
    return u && u.role === 'SUPERADMIN';
  }

  function canAccessTask(users, task, username) {
    if (!task) return false;
    if (isSuperAdmin(users, username)) return true;
    if (isAssigner(task, username)) return true;
    if (isAssignee(task, username)) {
      if (task.status === 'cancelled' && task.withdrawnByAssigner) return false;
      if (task.status === 'completed' && hasLeftArchive(task, username)) return false;
      return true;
    }
    return false;
  }

  function readNotifications() {
    ensureTaskStorage();
    try {
      const raw = JSON.parse(fs.readFileSync(getNotificationsPath(), 'utf8'));
      return Array.isArray(raw.items) ? raw.items : [];
    } catch {
      return [];
    }
  }

  function writeNotifications(items) {
    safeWriteJSON(getNotificationsPath(), {
      version: 1,
      items,
      updatedAt: new Date().toISOString()
    });
  }

  /** Διαγραφή όλων των ειδοποιήσεων που αναφέρονται σε ανάθεση (π.χ. μετά από διαγραφή task). */
  function removeNotificationsForTask(taskId) {
    const tid = String(taskId || '').trim();
    if (!tid) return;
    const before = readNotifications();
    const items = before.filter((n) => String(n.taskId || '').trim() !== tid);
    if (items.length !== before.length) {
      writeNotifications(items);
    }
  }

  function pushNotification({ username, type, taskId, title, message }) {
    const items = readNotifications();
    const entry = {
      id: uuidv4(),
      username: String(username || '').trim(),
      type,
      taskId,
      title: String(title || '').trim(),
      message: String(message || '').trim(),
      createdAt: new Date().toISOString(),
      readAt: null
    };
    items.unshift(entry);
    if (items.length > 8000) items.length = 8000;
    writeNotifications(items);
    if (typeof onNotifyMainWindow === 'function') {
      onNotifyMainWindow({ username: entry.username, notification: entry });
    }
    return entry;
  }

  function notifyTaskEvent(task, type, message, extraUsernames = [], options = {}) {
    const exclude = new Set((options.excludeUsernames || []).map((x) => String(x || '').toLowerCase()));
    const recipients = new Set();
    const title = task.title || 'Χώρος εργασίας';
    if (type === 'assignment_created') {
      (task.assignees || []).forEach((u) => recipients.add(u));
    } else if (type === 'assignment_updated') {
      (task.assignees || []).forEach((u) => recipients.add(u));
    } else if (
      type === 'status_changed' ||
      type === 'assignment_completed' ||
      type === 'assignment_departed'
    ) {
      recipients.add(task.createdBy);
      (task.assignees || []).forEach((u) => recipients.add(u));
    } else if (type === 'assignment_withdrawn') {
      (task.assignees || []).forEach((u) => recipients.add(u));
    } else if (type === 'archive_left') {
      recipients.add(task.createdBy);
      (task.assignees || []).forEach((u) => recipients.add(u));
    } else if (type === 'comment_added') {
      extraUsernames.forEach((u) => recipients.add(u));
    } else if (type === 'due_soon' || type === 'overdue') {
      recipients.add(task.createdBy);
      (task.assignees || []).forEach((u) => recipients.add(u));
    }
    recipients.forEach((username) => {
      if (!username) return;
      if (exclude.has(String(username).toLowerCase())) return;
      try {
        pushNotification({ username, type, taskId: task.id, title, message });
      } catch (err) {
        console.error('[taskAssignment] pushNotification failed:', err?.message || err);
      }
    });
  }

  /** Ειδοποιήσεις — δεν πρέπει να ακυρώνουν την αποθήκευση χώρου (π.χ. κοινό δίσκο). */
  function safeNotifyTaskEvent(task, type, message, extraUsernames = [], options = {}) {
    try {
      notifyTaskEvent(task, type, message, extraUsernames, options);
    } catch (err) {
      console.error('[taskAssignment] notifyTaskEvent failed:', err?.message || err);
    }
  }

  function normalizeTaskPayload(payload, existing = null) {
    const base = existing || {};
    const title = String(payload.title != null ? payload.title : base.title || '').trim();
    const description = String(payload.description != null ? payload.description : base.description || '').trim();
    const priority = ['low', 'normal', 'high'].includes(payload.priority) ? payload.priority : base.priority || 'normal';
    const dueDate = payload.dueDate != null ? String(payload.dueDate).trim() : base.dueDate || '';
    const dueTime = payload.dueTime != null ? String(payload.dueTime).trim() : base.dueTime || '';
    let reminderOffsets = payload.reminderOffsets;
    if (!Array.isArray(reminderOffsets)) {
      reminderOffsets = Array.isArray(base.reminderOffsets) ? base.reminderOffsets : DEFAULT_REMINDER_OFFSETS;
    }
    reminderOffsets = reminderOffsets.map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n));
    const assignees = payload.assignees != null
      ? [...new Set((payload.assignees || []).map((x) => String(x || '').trim()).filter(Boolean))]
      : base.assignees || [];
    return {
      title,
      description,
      priority,
      dueDate,
      dueTime,
      reminderOffsets,
      assignees
    };
  }

  function buildNewTask(createdBy, payload) {
    const norm = normalizeTaskPayload(payload);
    const now = new Date().toISOString();
    return {
      id: uuidv4(),
      title: norm.title,
      description: norm.description,
      createdBy,
      createdAt: now,
      updatedAt: now,
      assignees: norm.assignees,
      status: 'pending',
      priority: norm.priority,
      dueDate: norm.dueDate,
      dueTime: norm.dueTime,
      reminderOffsets: norm.reminderOffsets,
      reminderSentKeys: [],
      files: [],
      comments: [],
      statusHistory: [{ status: 'pending', at: now, by: createdBy, note: 'Δημιουργία χώρου' }],
      completedAt: null,
      completedBy: null,
      departedAssignees: [],
      leftArchiveBy: []
    };
  }

  function copyFilesToTask(taskId, fileObjects, uploadedBy) {
    const filesDir = getTaskFilesDir(taskId);
    if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });
    const saved = [];
    for (const file of fileObjects || []) {
      const sourcePath = typeof file === 'string' ? file : file.filePath || file.path;
      if (!sourcePath || !fs.existsSync(sourcePath)) continue;
      const baseName = typeof file === 'string'
        ? path.basename(sourcePath)
        : file.fileName || file.name || path.basename(sourcePath);
      const safeName = baseName.replace(/[<>:"/\\|?*]/g, '_');
      let destName = safeName;
      let destPath = path.join(filesDir, destName);
      let counter = 1;
      while (fs.existsSync(destPath)) {
        const ext = path.extname(safeName);
        const stem = path.basename(safeName, ext);
        destName = `${stem}_${counter}${ext}`;
        destPath = path.join(filesDir, destName);
        counter += 1;
      }
      fs.copyFileSync(sourcePath, destPath);
      saved.push({
        id: uuidv4(),
        name: destName,
        path: destPath,
        uploadedBy,
        uploadedAt: new Date().toISOString()
      });
    }
    return saved;
  }

  function loadAssignments({ actingUsername, view = 'asAssignee', listScope = 'default' }) {
    const users = loadUsers();
    const actor = findUser(users, actingUsername);
    if (!actor) return { success: false, error: 'Άγνωστος χρήστης' };

    const idx = readIndex();
    const ta = normalizeTaskAssignment(actor.taskAssignment);
    const isSA = isSuperAdmin(users, actingUsername);
    /** SUPERADMIN δεν έχει πάντα taskAssignment στο users.json — πρέπει να βλέπει και τους χώρους που δημιούργησε ως αναθέτης. */
    const assignerListVisibility = ta.canAssign || isSA;

    let list = idx.tasks.map((meta) => {
      const full = readTask(meta.id);
      return full || meta;
    });

    if (view === 'all' && isSA) {
      // all tasks
    } else if (view === 'asAssigner') {
      if (!assignerListVisibility) return { success: false, error: 'Δεν έχετε δικαίωμα δημιουργίας χώρου' };
      list = list.filter((t) => isAssigner(t, actingUsername));
    } else {
      list = list.filter(
        (t) =>
          isAssignee(t, actingUsername) ||
          (assignerListVisibility && isAssigner(t, actingUsername))
      );
      if (view === 'asAssignee') {
        list = list.filter((t) => isAssignee(t, actingUsername) || isAssigner(t, actingUsername));
      }
    }

    if (listScope === 'workArchive') {
      list = list.filter((t) => t.status === 'completed');
    } else if (listScope === 'default') {
      list = list.filter((t) => t.status !== 'completed');
    }

    if (!(view === 'all' && isSA)) {
      list = list.filter((t) => {
        if (isSA) return true;
        const hiddenForPureAssignee =
          t.status === 'cancelled' &&
          t.withdrawnByAssigner &&
          isAssignee(t, actingUsername) &&
          !isAssigner(t, actingUsername);
        if (hiddenForPureAssignee) return false;
        if (
          t.status === 'completed' &&
          hasLeftArchive(t, actingUsername) &&
          isAssignee(t, actingUsername) &&
          !isAssigner(t, actingUsername)
        ) {
          return false;
        }
        return true;
      });
    }

    list.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return { success: true, tasks: list, canAssign: ta.canAssign || isSA };
  }

  function getAssignableTargets(actingUsername) {
    const users = loadUsers();
    const assigner = findUser(users, actingUsername);
    if (!assigner) return { success: false, error: 'Άγνωστος χρήστης', users: [] };
    const ta = normalizeTaskAssignment(assigner.taskAssignment);
    if (!ta.canAssign && !isSuperAdmin(users, actingUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα δημιουργίας χώρου', users: [] };
    }
    let targets = [];
    if (isSuperAdmin(users, actingUsername)) {
      targets = getEligibleAssigneeUsernames(users, actingUsername);
    } else if (ta.assignableScope === 'all') {
      targets = getEligibleAssigneeUsernames(users, actingUsername);
    } else {
      targets = ta.assignableUsernames.filter((name) => {
        const u = findUser(users, name);
        return u && isActiveApprovedUser(u);
      });
    }
    const userDetails = targets
      .map((username) => {
        const u = findUser(users, username);
        return u ? { username: u.username, fullName: u.fullName, role: u.role } : null;
      })
      .filter(Boolean);
    return { success: true, users: userDetails };
  }

  function getTask({ actingUsername, taskId }) {
    const users = loadUsers();
    const task = readTask(taskId);
    if (!task) return { success: false, error: 'Ο χώρος δεν βρέθηκε' };
    if (!canAccessTask(users, task, actingUsername)) {
      return { success: false, error: 'Δεν έχετε πρόσβαση σε αυτόν τον χώρο' };
    }
    return { success: true, task };
  }

  function createTask({ actingUsername, payload, newFiles = [] }) {
    const users = loadUsers();
    const assigner = findUser(users, actingUsername);
    if (!assigner) return { success: false, error: 'Άγνωστος χρήστης' };
    if (!isSuperAdminRole(users, actingUsername)) {
      const ta = normalizeTaskAssignment(assigner.taskAssignment);
      if (!ta.canAssign) {
        return { success: false, error: 'Δεν έχετε δικαίωμα δημιουργίας χώρου εργασίας' };
      }
    }

    const norm = normalizeTaskPayload(payload);
    if (!norm.title) return { success: false, error: 'Ο τίτλος είναι υποχρεωτικός' };

    const assignCheck = canUserAssignTo(users, actingUsername, norm.assignees);
    if (!assignCheck.ok) return { success: false, error: assignCheck.error };

    const task = buildNewTask(actingUsername, { ...norm, assignees: assignCheck.assignees });
    try {
      const copied = copyFilesToTask(task.id, newFiles, actingUsername);
      task.files = copied;
      writeTask(task);
    } catch (err) {
      return { success: false, error: err?.message || 'Αποτυχία αποθήκευσης χώρου στον δίσκο' };
    }

    const byLabel = assigner.fullName ? `${assigner.fullName} (${actingUsername})` : actingUsername;
    let msg = `Ο/H ${byLabel} σας προσκάλεσε σε νέο χώρο εργασίας.`;
    if (norm.description) {
      const ex = norm.description.length > 180 ? `${norm.description.slice(0, 177)}…` : norm.description;
      msg = `${msg} «${ex}»`;
    }
    safeNotifyTaskEvent(task, 'assignment_created', msg);
    return { success: true, task };
  }

  function updateTask({ actingUsername, taskId, payload, newFiles = [] }) {
    const users = loadUsers();
    const existing = readTask(taskId);
    if (!existing) return { success: false, error: 'Ο χώρος δεν βρέθηκε' };
    if (!isAssigner(existing, actingUsername) && !isSuperAdmin(users, actingUsername)) {
      return { success: false, error: 'Μόνο ο αναθέτων μπορεί να επεξεργαστεί τον χώρο' };
    }
    if (existing.status === 'completed') {
      return { success: false, error: 'Ο χώρος είναι κλειστός και δεν επεξεργάζεται' };
    }
    if (existing.status === 'cancelled' && !existing.withdrawnByAssigner) {
      return { success: false, error: 'Ο χώρος είναι κλειστός και δεν επεξεργάζεται' };
    }

    const norm = normalizeTaskPayload(payload, existing);
    if (!norm.title) return { success: false, error: 'Ο τίτλος είναι υποχρεωτικός' };

    const assignCheck = canUserAssignTo(users, actingUsername, norm.assignees);
    if (!assignCheck.ok) return { success: false, error: assignCheck.error };

    const now = new Date().toISOString();
    const copied = copyFilesToTask(taskId, newFiles, actingUsername);
    const newAssignees = assignCheck.assignees;
    const activeSet = new Set(newAssignees.map((a) => String(a).toLowerCase()));
    const prevDeparted = Array.isArray(existing.departedAssignees) ? existing.departedAssignees : [];
    const rejoined = prevDeparted.filter((d) => activeSet.has(String(d.username || '').toLowerCase()));
    const departedAssignees = prevDeparted.filter(
      (d) => !activeSet.has(String(d.username || '').toLowerCase())
    );
    let statusHistory = Array.isArray(existing.statusHistory) ? [...existing.statusHistory] : [];
    if (rejoined.length > 0) {
      rejoined.forEach((d) => {
        const u = findUser(users, d.username);
        const name = u?.fullName ? `${u.fullName} (${d.username})` : d.username;
        statusHistory.push({
          status: existing.status,
          at: now,
          by: actingUsername,
          note: `Επαναπρόσκληση συνάδελφου: ${name}`,
          event: 'assignee_rejoined'
        });
      });
    }
    const task = {
      ...existing,
      ...norm,
      assignees: newAssignees,
      departedAssignees,
      statusHistory,
      files: [...(existing.files || []), ...copied],
      updatedAt: now
    };
    try {
      writeTask(task);
    } catch (err) {
      return { success: false, error: err?.message || 'Αποτυχία αποθήκευσης χώρου στον δίσκο' };
    }
    safeNotifyTaskEvent(task, 'assignment_updated', `Ενημέρωση χώρου: ${task.title}`);
    return { success: true, task };
  }

  function deleteTask({ actingUsername, taskId }) {
    const users = loadUsers();
    const existing = readTask(taskId);
    if (!existing) return { success: false, error: 'Ο χώρος δεν βρέθηκε' };
    if (!isAssigner(existing, actingUsername) && !isSuperAdmin(users, actingUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα διαγραφής' };
    }
    deleteTaskFromDisk(taskId);
    removeNotificationsForTask(taskId);
    return { success: true };
  }

  function updateStatus({ actingUsername, taskId, status, reason = '', withdrawFromAssignees = false }) {
    const users = loadUsers();
    const task = readTask(taskId);
    if (!task) return { success: false, error: 'Ο χώρος δεν βρέθηκε' };

    const isAssignerUser = isAssigner(task, actingUsername);
    const isAssigneeUser = isAssignee(task, actingUsername);
    const isSA = isSuperAdmin(users, actingUsername);

    if (!isAssignerUser && !isAssigneeUser && !isSA) {
      return { success: false, error: 'Δεν έχετε πρόσβαση' };
    }

    if (!VALID_STATUSES.includes(status)) return { success: false, error: 'Μη έγκυρη κατάσταση' };

    if (status === 'cancelled' && !isAssignerUser && !isSA) {
      return { success: false, error: 'Μόνο ο αναθέτων μπορεί να κλείσει τον χώρο' };
    }

    /** Ολοκληρωμένος χώρος στην αποθήκη: μόνο ο αναθέτης (ή SA) μπορεί να τον επαναφέρει σε ενεργή κατάσταση. */
    if (task.status === 'completed' && status !== 'completed') {
      if (!isAssignerUser && !isSA) {
        return {
          success: false,
          error: 'Μόνο ο αναθέτης μπορεί να επαναφέρει ολοκληρωμένο χώρο στον ενεργό χώρο εργασίας'
        };
      }
    }

    /** Εκκρεμεί / σε εξέλιξη / ολοκληρωμένη: και ο αναθέτης και ο συνάδελφος (ή SA). */
    const sharedFlowStatuses = ['pending', 'in_progress', 'completed'];
    if (sharedFlowStatuses.includes(status)) {
      if (!isAssignerUser && !isAssigneeUser && !isSA) {
        return { success: false, error: 'Δεν έχετε πρόσβαση σε αυτόν τον χώρο' };
      }
    }

    const now = new Date().toISOString();
    const history = Array.isArray(task.statusHistory) ? [...task.statusHistory] : [];
    const reopeningFromArchive = task.status === 'completed' && status !== 'completed';
    const withdrawNote =
      status === 'cancelled' && withdrawFromAssignees && isAssignerUser
        ? 'Κλείσιμο για συναδέλφους — ο χώρος δεν εμφανίζεται πλέον στους συναδέλφους'
        : '';
    const reopenNote = reopeningFromArchive ? 'Επαναφορά από αποθήκη — ενεργός χώρος εργασίας' : '';
    history.push({
      status,
      at: now,
      by: actingUsername,
      note: reopenNote || withdrawNote
    });

    let withdrawnByAssigner = !!task.withdrawnByAssigner;
    if (status === 'cancelled' && withdrawFromAssignees && isAssignerUser) {
      withdrawnByAssigner = true;
    } else if (status !== 'cancelled') {
      withdrawnByAssigner = false;
    }

    const updated = {
      ...task,
      status,
      withdrawnByAssigner,
      statusHistory: history,
      updatedAt: now,
      completedAt: status === 'completed' ? now : null,
      completedBy: status === 'completed' ? actingUsername : null,
      leftArchiveBy: reopeningFromArchive ? [] : task.leftArchiveBy || []
    };

    try {
      writeTask(updated);
    } catch (err) {
      return { success: false, error: err?.message || 'Αποτυχία αποθήκευσης χώρου στον δίσκο' };
    }

    if (status === 'completed') {
      safeNotifyTaskEvent(updated, 'assignment_completed', `Ολοκληρώθηκε: ${updated.title}`);
    } else if (reopeningFromArchive) {
      safeNotifyTaskEvent(
        updated,
        'status_changed',
        `Ο χώρος «${updated.title}» επανήλθε στον ενεργό χώρο εργασίας`
      );
    } else if (status === 'cancelled' && withdrawFromAssignees && isAssignerUser) {
      safeNotifyTaskEvent(
        updated,
        'assignment_withdrawn',
        `Ο αναθέτης έκλεισε τον χώρο «${updated.title}» — δεν εμφανίζεται πλέον στη λίστα σας.`
      );
    } else {
      safeNotifyTaskEvent(updated, 'status_changed', `Νέα κατάσταση (${status}): ${updated.title}`);
    }

    return { success: true, task: updated };
  }

  /** Συνάδελφος αποχωρεί από ενεργό χώρο — οι υπόλοιποι συνεχίζουν κανονικά. */
  function leaveWorkspace({ actingUsername, taskId, note = '' }) {
    const users = loadUsers();
    const task = readTask(taskId);
    if (!task) return { success: false, error: 'Ο χώρος δεν βρέθηκε' };

    if (isAssigner(task, actingUsername)) {
      return {
        success: false,
        error: 'Ο δημιουργός δεν αποχωρεί από τον χώρο — χρησιμοποιήστε «Κλείσιμο χώρου» αν θέλετε να τον κλείσετε'
      };
    }
    if (!isAssignee(task, actingUsername)) {
      return { success: false, error: 'Δεν συμμετέχετε σε αυτόν τον χώρο' };
    }
    if (['completed', 'cancelled'].includes(task.status)) {
      return { success: false, error: 'Ο χώρος δεν είναι ενεργός' };
    }

    const uLower = String(actingUsername || '').toLowerCase();
    const assignees = (task.assignees || []).filter((a) => String(a).toLowerCase() !== uLower);
    if (assignees.length === (task.assignees || []).length) {
      return { success: false, error: 'Δεν είστε ενεργός συμμετέχων σε αυτόν τον χώρο' };
    }

    const now = new Date().toISOString();
    const noteTrim = String(note || '').trim();
    const departedAssignees = Array.isArray(task.departedAssignees) ? [...task.departedAssignees] : [];
    if (!departedAssignees.some((d) => String(d.username || '').toLowerCase() === uLower)) {
      departedAssignees.push({
        username: actingUsername,
        at: now,
        note: noteTrim || null
      });
    }

    const history = Array.isArray(task.statusHistory) ? [...task.statusHistory] : [];
    history.push({
      status: task.status,
      at: now,
      by: actingUsername,
      note: noteTrim ? `Αποχώρηση: ${noteTrim}` : 'Αποχώρηση από τον χώρο εργασίας',
      event: 'assignee_departed'
    });

    const updated = {
      ...task,
      assignees,
      departedAssignees,
      statusHistory: history,
      updatedAt: now
    };
    delete updated.rejectedAt;
    delete updated.rejectedBy;
    delete updated.rejectionReason;

    try {
      writeTask(updated);
    } catch (err) {
      return { success: false, error: err?.message || 'Αποτυχία αποθήκευσης' };
    }

    const leaver = findUser(users, actingUsername);
    const leaverLabel = leaver?.fullName ? `${leaver.fullName} (${actingUsername})` : actingUsername;
    const title = updated.title || 'Χώρος εργασίας';
    const departMsg = noteTrim
      ? `Ο/Η ${leaverLabel} αποχώρησε από τον χώρο «${title}»: «${noteTrim.length > 180 ? `${noteTrim.slice(0, 177)}…` : noteTrim}»`
      : `Ο/Η ${leaverLabel} αποχώρησε από τον χώρο «${title}»`;
    safeNotifyTaskEvent(updated, 'assignment_departed', departMsg, [], {
      excludeUsernames: [actingUsername]
    });

    return { success: true, task: updated, leftWorkspace: true };
  }

  /** Συνάδελφος αφαιρεί ολοκληρωμένο χώρο από τη δική του λίστα αποθήκης (τα δεδομένα παραμένουν). */
  function leaveWorkArchive({ actingUsername, taskId }) {
    const users = loadUsers();
    const task = readTask(taskId);
    if (!task) return { success: false, error: 'Ο χώρος δεν βρέθηκε' };
    if (task.status !== 'completed') {
      return { success: false, error: 'Μόνο ολοκληρωμένες εργασίες βρίσκονται στην αποθήκη' };
    }
    if (isAssigner(task, actingUsername)) {
      return { success: false, error: 'Ο αναθέτης διατηρεί την αποθήκη — δεν μπορεί να αποχωρήσει' };
    }
    if (!isAssignee(task, actingUsername)) {
      return { success: false, error: 'Δεν έχετε πρόσβαση' };
    }
    if (hasLeftArchive(task, actingUsername)) {
      return { success: true, task };
    }

    const now = new Date().toISOString();
    const uLower = String(actingUsername || '').toLowerCase();
    const leftArchiveBy = [...(task.leftArchiveBy || [])];
    if (!leftArchiveBy.some((x) => String(x).toLowerCase() === uLower)) {
      leftArchiveBy.push(actingUsername);
    }

    const leaver = findUser(users, actingUsername);
    const leaverLabel = leaver?.fullName ? `${leaver.fullName} (${actingUsername})` : actingUsername;

    const updated = {
      ...task,
      leftArchiveBy,
      statusHistory: [
        ...(task.statusHistory || []),
        { status: task.status, at: now, by: actingUsername, note: 'Αποχώρηση από αποθήκη εργασιών' }
      ],
      updatedAt: now
    };
    try {
      writeTask(updated);
    } catch (err) {
      return { success: false, error: err?.message || 'Αποτυχία αποθήκευσης' };
    }

    safeNotifyTaskEvent(
      updated,
      'archive_left',
      `Ο/Η ${leaverLabel} αποχώρησε από την αποθήκη εργασιών του χώρου «${updated.title}»`,
      [],
      { excludeUsernames: [actingUsername] }
    );

    return { success: true, task: updated };
  }

  const ARCHIVE_LOCKED_MSG =
    'Ο χώρος είναι στην Αποθήκη Εργασιών (ολοκληρωμένος) και δεν δέχεται νέα σχόλια ή αρχεία. Για επανενεργοποίηση, ο αναθέτης πρέπει να αλλάξει την κατάσταση.';

  function addComment({ actingUsername, taskId, text }) {
    const users = loadUsers();
    const task = readTask(taskId);
    if (!task) return { success: false, error: 'Ο χώρος δεν βρέθηκε' };
    if (['completed', 'cancelled'].includes(task.status)) {
      return { success: false, error: ARCHIVE_LOCKED_MSG };
    }
    if (!canAccessTask(users, task, actingUsername)) {
      return { success: false, error: 'Δεν έχετε πρόσβαση' };
    }
    const body = String(text || '').trim();
    if (!body) return { success: false, error: 'Κενό σχόλιο' };

    const comment = {
      id: uuidv4(),
      author: actingUsername,
      text: body,
      createdAt: new Date().toISOString()
    };
    const recipients = new Set();
    if (isAssigner(task, actingUsername)) {
      (task.assignees || []).forEach((u) => recipients.add(u));
    } else {
      recipients.add(task.createdBy);
      (task.assignees || []).forEach((u) => {
        if (u.toLowerCase() !== actingUsername.toLowerCase()) recipients.add(u);
      });
    }

    const commenter = findUser(users, actingUsername);
    const authorLabel = commenter?.fullName ? `${commenter.fullName} (${actingUsername})` : actingUsername;
    const excerpt = body.length > 200 ? `${body.slice(0, 197)}…` : body;

    const updated = {
      ...task,
      comments: [...(task.comments || []), comment],
      updatedAt: comment.createdAt
    };
    try {
      writeTask(updated);
    } catch (err) {
      return { success: false, error: err?.message || 'Αποτυχία αποθήκευσης σχολίου' };
    }
    safeNotifyTaskEvent(updated, 'comment_added', `${authorLabel}: «${excerpt}»`, [...recipients]);
    return { success: true, task: updated };
  }

  function addFiles({ actingUsername, taskId, newFiles = [] }) {
    const users = loadUsers();
    const task = readTask(taskId);
    if (!task) return { success: false, error: 'Ο χώρος δεν βρέθηκε' };
    if (['completed', 'cancelled'].includes(task.status)) {
      return { success: false, error: ARCHIVE_LOCKED_MSG };
    }
    if (!canAccessTask(users, task, actingUsername)) {
      return { success: false, error: 'Δεν έχετε πρόσβαση' };
    }
    const copied = copyFilesToTask(taskId, newFiles, actingUsername);
    if (copied.length === 0) return { success: false, error: 'Δεν προστέθηκαν αρχεία' };
    const updated = {
      ...task,
      files: [...(task.files || []), ...copied],
      updatedAt: new Date().toISOString()
    };
    try {
      writeTask(updated);
    } catch (err) {
      return { success: false, error: err?.message || 'Αποτυχία αποθήκευσης αρχείων' };
    }
    return { success: true, task: updated };
  }

  function loadNotifications({ actingUsername, unreadOnly = false }) {
    const u = String(actingUsername || '').trim().toLowerCase();
    let items = readNotifications().filter((n) => String(n.username || '').toLowerCase() === u);
    if (unreadOnly) items = items.filter((n) => !n.readAt);
    return { success: true, notifications: items, unreadCount: items.filter((n) => !n.readAt).length };
  }

  function markNotificationsRead({ actingUsername, notificationIds = null }) {
    const u = String(actingUsername || '').toLowerCase();
    const now = new Date().toISOString();
    const ids = notificationIds ? new Set(notificationIds) : null;
    const items = readNotifications().map((n) => {
      if (String(n.username || '').toLowerCase() !== u) return n;
      if (ids && !ids.has(n.id)) return n;
      if (!ids && n.readAt) return n;
      return { ...n, readAt: n.readAt || now };
    });
    writeNotifications(items);
    return { success: true };
  }

  /** Σημειώνει όλες τις ειδοποιήσεις για συγκεκριμένη ανάθεση ως διαβασμένες (προβολή ανάθεσης). */
  function markNotificationsReadForTask({ actingUsername, taskId }) {
    const u = String(actingUsername || '').toLowerCase();
    const tid = String(taskId || '').trim();
    if (!tid) return { success: false, error: 'Κενό αναγνωριστικό χώρου' };
    const now = new Date().toISOString();
    const items = readNotifications().map((n) => {
      if (String(n.username || '').toLowerCase() !== u) return n;
      if (String(n.taskId || '') !== tid) return n;
      return { ...n, readAt: n.readAt || now };
    });
    writeNotifications(items);
    return { success: true };
  }

  function userHasTaskAccess(actingUsername) {
    const users = loadUsers();
    const actor = findUser(users, actingUsername);
    if (!actor) return { canAssign: false, hasInvolvement: false, unreadCount: 0 };
    const ta = normalizeTaskAssignment(actor.taskAssignment);
    const idx = readIndex();
    const involved = idx.tasks.some((meta) => {
      const t = readTask(meta.id) || meta;
      if (isAssigner(t, actingUsername)) return true;
      if (!isAssignee(t, actingUsername)) return false;
      if (t.status === 'cancelled' && t.withdrawnByAssigner) return false;
      if (t.status === 'completed' && hasLeftArchive(t, actingUsername)) return false;
      return true;
    });
    const notif = loadNotifications({ actingUsername, unreadOnly: true });
    const canAssign = ta.canAssign || isSuperAdmin(users, actingUsername);
    return {
      canAssign,
      hasInvolvement: involved,
      unreadCount: notif.unreadCount || 0,
      showModule: canAssign || involved || (notif.unreadCount || 0) > 0
    };
  }

  function parseDueDate(task) {
    if (!task.dueDate) return null;
    const timePart = task.dueTime ? String(task.dueTime).trim() : '23:59';
    const iso = `${task.dueDate}T${timePart.length === 5 ? timePart : '23:59'}:00`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function resolveTaskFilePath({ actingUsername, taskId, filePath }) {
    const users = loadUsers();
    const task = readTask(taskId);
    if (!task) return { success: false, error: 'Ο χώρος δεν βρέθηκε' };
    if (!canAccessTask(users, task, actingUsername)) {
      return { success: false, error: 'Δεν έχετε πρόσβαση' };
    }
    const filesDir = path.resolve(getTaskFilesDir(taskId));
    const resolved = path.resolve(String(filePath || ''));
    if (!resolved.startsWith(filesDir + path.sep)) {
      return { success: false, error: 'Μη επιτρεπόμενο αρχείο' };
    }
    const owned = (task.files || []).some((f) => f.path && path.resolve(f.path) === resolved);
    if (!owned) return { success: false, error: 'Το αρχείο δεν ανήκει σε αυτόν τον χώρο' };
    if (!fs.existsSync(resolved)) return { success: false, error: 'Το αρχείο δεν βρέθηκε' };
    return { success: true, filePath: resolved };
  }

  function runDueDateChecks() {
    const idx = readIndex();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    idx.tasks.forEach((meta) => {
      if (!OPEN_STATUSES.includes(meta.status)) return;
      const task = readTask(meta.id);
      if (!task || !task.dueDate) return;

      const due = parseDueDate(task);
      if (!due) return;

      const offsets = Array.isArray(task.reminderOffsets) ? task.reminderOffsets : DEFAULT_REMINDER_OFFSETS;
      const sent = new Set(Array.isArray(task.reminderSentKeys) ? task.reminderSentKeys : []);
      let changed = false;

      offsets.forEach((daysBefore) => {
        const key = `due_soon_${daysBefore}`;
        if (sent.has(key)) return;
        const reminderDate = new Date(due);
        reminderDate.setDate(reminderDate.getDate() - daysBefore);
        const reminderDay = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
        if (reminderDay.getTime() === startOfToday.getTime()) {
          notifyTaskEvent(
            task,
            'due_soon',
            daysBefore === 0
              ? `Ο χώρος «${task.title}» λήγει σήμερα`
              : `Ο χώρος «${task.title}» λήγει σε ${daysBefore} ημέρα(ες)`
          );
          sent.add(key);
          changed = true;
        }
      });

      if (due < startOfToday && !sent.has('overdue')) {
        notifyTaskEvent(task, 'overdue', `Ο χώρος «${task.title}» έχει εκπρόθεσμη προθεσμία`);
        sent.add('overdue');
        changed = true;
      }

      if (changed) {
        writeTask({ ...task, reminderSentKeys: [...sent] });
      }
    });

    return { success: true };
  }

  return {
    normalizeTaskAssignment,
    sanitizeTaskAssignmentForClient,
    ensureTaskStorage,
    loadAssignments,
    getAssignableTargets,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    updateStatus,
    leaveWorkspace,
    leaveWorkArchive,
    resolveTaskFilePath,
    addComment,
    addFiles,
    loadNotifications,
    markNotificationsRead,
    markNotificationsReadForTask,
    userHasTaskAccess,
    runDueDateChecks,
    readIndex,
    isAssignee,
    isAssigner
  };
}

module.exports = {
  createTaskAssignmentService,
  normalizeTaskAssignment,
  sanitizeTaskAssignmentForClient,
  TASKS_ROOT
};

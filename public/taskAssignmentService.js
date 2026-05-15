/**
 * Αναθέσεις εργασιών — αυτόνομο module (ξεχωριστό από έργα).
 */
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { safeWriteJSON } = require('./safeWrite');

const TASKS_ROOT = 'ANATHESEIS_ERGASION';
const FILES_SUBDIR = 'ARXEIA';

const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'rejected', 'cancelled'];
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

function canUserAssignTo(users, assignerUsername, assigneeUsernames) {
  const assigner = findUser(users, assignerUsername);
  if (!assigner) return { ok: false, error: 'Άγνωστος χρήστης' };
  const ta = normalizeTaskAssignment(assigner.taskAssignment);
  if (!ta.canAssign) return { ok: false, error: 'Δεν έχετε δικαίωμα ανάθεσης' };

  const targets = [...new Set((assigneeUsernames || []).map((x) => String(x || '').trim()).filter(Boolean))];
  if (targets.length === 0) return { ok: false, error: 'Επιλέξτε τουλάχιστον έναν παραλήπτη' };

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
    return { ok: false, error: `Μη επιτρεπτοί παραλήπτες: ${invalid.join(', ')}` };
  }
  return { ok: true, assignees: targets };
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
      updatedAt: task.updatedAt
    };
  }

  function readTask(taskId) {
    const fp = getTaskDataPath(taskId);
    if (!fs.existsSync(fp)) return null;
    try {
      return JSON.parse(fs.readFileSync(fp, 'utf8'));
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

  function isSuperAdmin(users, username) {
    const u = findUser(users, username);
    return u && u.role === 'SUPERADMIN';
  }

  function canAccessTask(users, task, username) {
    if (!task) return false;
    if (isSuperAdmin(users, username)) return true;
    return isAssigner(task, username) || isAssignee(task, username);
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
    if (items.length > 5000) items.length = 5000;
    writeNotifications(items);
    if (typeof onNotifyMainWindow === 'function') {
      onNotifyMainWindow({ username: entry.username, notification: entry });
    }
    return entry;
  }

  function notifyTaskEvent(task, type, message, extraUsernames = []) {
    const recipients = new Set();
    const title = task.title || 'Ανάθεση';
    if (type === 'assignment_created') {
      (task.assignees || []).forEach((u) => recipients.add(u));
    } else if (type === 'assignment_updated') {
      (task.assignees || []).forEach((u) => recipients.add(u));
    } else if (type === 'status_changed' || type === 'assignment_completed' || type === 'assignment_rejected') {
      recipients.add(task.createdBy);
      (task.assignees || []).forEach((u) => recipients.add(u));
    } else if (type === 'comment_added') {
      extraUsernames.forEach((u) => recipients.add(u));
    } else if (type === 'due_soon' || type === 'overdue') {
      recipients.add(task.createdBy);
      (task.assignees || []).forEach((u) => recipients.add(u));
    }
    recipients.forEach((username) => {
      if (username) pushNotification({ username, type, taskId: task.id, title, message });
    });
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
      statusHistory: [{ status: 'pending', at: now, by: createdBy, note: 'Δημιουργία ανάθεσης' }],
      completedAt: null,
      completedBy: null,
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: null
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

  function loadAssignments({ actingUsername, view = 'asAssignee' }) {
    const users = loadUsers();
    const actor = findUser(users, actingUsername);
    if (!actor) return { success: false, error: 'Άγνωστος χρήστης' };

    const idx = readIndex();
    const ta = normalizeTaskAssignment(actor.taskAssignment);
    const isSA = isSuperAdmin(users, actingUsername);
    const uLower = actingUsername.toLowerCase();

    let list = idx.tasks.map((meta) => {
      const full = readTask(meta.id);
      return full || meta;
    });

    if (view === 'all' && isSA) {
      // all tasks
    } else if (view === 'asAssigner') {
      if (!ta.canAssign && !isSA) return { success: false, error: 'Δεν έχετε δικαίωμα ανάθεσης' };
      list = list.filter((t) => isAssigner(t, actingUsername));
    } else {
      list = list.filter(
        (t) =>
          isAssignee(t, actingUsername) ||
          (ta.canAssign && isAssigner(t, actingUsername))
      );
      if (view === 'asAssignee') {
        list = list.filter((t) => isAssignee(t, actingUsername) || isAssigner(t, actingUsername));
      }
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
      return { success: false, error: 'Δεν έχετε δικαίωμα ανάθεσης', users: [] };
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
    if (!task) return { success: false, error: 'Η ανάθεση δεν βρέθηκε' };
    if (!canAccessTask(users, task, actingUsername)) {
      return { success: false, error: 'Δεν έχετε πρόσβαση σε αυτή την ανάθεση' };
    }
    return { success: true, task };
  }

  function createTask({ actingUsername, payload, newFiles = [] }) {
    const users = loadUsers();
    const norm = normalizeTaskPayload(payload);
    if (!norm.title) return { success: false, error: 'Ο τίτλος είναι υποχρεωτικός' };

    const assignCheck = canUserAssignTo(users, actingUsername, norm.assignees);
    if (!assignCheck.ok) return { success: false, error: assignCheck.error };

    const task = buildNewTask(actingUsername, { ...norm, assignees: assignCheck.assignees });
    const copied = copyFilesToTask(task.id, newFiles, actingUsername);
    task.files = copied;
    writeTask(task);
    const assigner = findUser(users, actingUsername);
    const byLabel = assigner?.fullName ? `${assigner.fullName} (${actingUsername})` : actingUsername;
    let msg = `Ο/H ${byLabel} σας ανέθεσε νέα εργασία.`;
    if (norm.description) {
      const ex = norm.description.length > 180 ? `${norm.description.slice(0, 177)}…` : norm.description;
      msg = `${msg} «${ex}»`;
    }
    notifyTaskEvent(task, 'assignment_created', msg);
    return { success: true, task };
  }

  function updateTask({ actingUsername, taskId, payload, newFiles = [] }) {
    const users = loadUsers();
    const existing = readTask(taskId);
    if (!existing) return { success: false, error: 'Η ανάθεση δεν βρέθηκε' };
    if (!isAssigner(existing, actingUsername) && !isSuperAdmin(users, actingUsername)) {
      return { success: false, error: 'Μόνο ο αναθέτων μπορεί να επεξεργαστεί την ανάθεση' };
    }
    if (['completed', 'rejected', 'cancelled'].includes(existing.status)) {
      return { success: false, error: 'Η ανάθεση είναι κλειστή και δεν επεξεργάζεται' };
    }

    const norm = normalizeTaskPayload(payload, existing);
    if (!norm.title) return { success: false, error: 'Ο τίτλος είναι υποχρεωτικός' };

    const assignCheck = canUserAssignTo(users, actingUsername, norm.assignees);
    if (!assignCheck.ok) return { success: false, error: assignCheck.error };

    const now = new Date().toISOString();
    const copied = copyFilesToTask(taskId, newFiles, actingUsername);
    const task = {
      ...existing,
      ...norm,
      assignees: assignCheck.assignees,
      files: [...(existing.files || []), ...copied],
      updatedAt: now
    };
    writeTask(task);
    notifyTaskEvent(task, 'assignment_updated', `Ενημέρωση ανάθεσης: ${task.title}`);
    return { success: true, task };
  }

  function deleteTask({ actingUsername, taskId }) {
    const users = loadUsers();
    const existing = readTask(taskId);
    if (!existing) return { success: false, error: 'Η ανάθεση δεν βρέθηκε' };
    if (!isAssigner(existing, actingUsername) && !isSuperAdmin(users, actingUsername)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα διαγραφής' };
    }
    deleteTaskFromDisk(taskId);
    return { success: true };
  }

  function updateStatus({ actingUsername, taskId, status, reason = '' }) {
    const users = loadUsers();
    const task = readTask(taskId);
    if (!task) return { success: false, error: 'Η ανάθεση δεν βρέθηκε' };

    const isAssignerUser = isAssigner(task, actingUsername);
    const isAssigneeUser = isAssignee(task, actingUsername);
    const isSA = isSuperAdmin(users, actingUsername);

    if (!isAssignerUser && !isAssigneeUser && !isSA) {
      return { success: false, error: 'Δεν έχετε πρόσβαση' };
    }

    if (!VALID_STATUSES.includes(status)) return { success: false, error: 'Μη έγκυρη κατάσταση' };

    if (status === 'cancelled' && !isAssignerUser && !isSA) {
      return { success: false, error: 'Μόνο ο αναθέτων μπορεί να ακυρώσει' };
    }

    if (status === 'rejected') {
      if (!isAssigneeUser && !isSA) {
        return { success: false, error: 'Μόνο ο παραλήπτης μπορεί να απορρίψει' };
      }
      if (!String(reason || '').trim()) {
        return { success: false, error: 'Απαιτείται αιτιολογία απόρριψης' };
      }
    }

    /** Εκκρεμεί / σε εξέλιξη / ολοκληρωμένη: και ο αναθέτων και ο παραλήπτης (ή SA). */
    const sharedFlowStatuses = ['pending', 'in_progress', 'completed'];
    if (sharedFlowStatuses.includes(status)) {
      if (!isAssignerUser && !isAssigneeUser && !isSA) {
        return { success: false, error: 'Δεν έχετε πρόσβαση σε αυτή την ανάθεση' };
      }
    }

    const now = new Date().toISOString();
    const history = Array.isArray(task.statusHistory) ? [...task.statusHistory] : [];
    history.push({
      status,
      at: now,
      by: actingUsername,
      note: status === 'rejected' ? String(reason).trim() : ''
    });

    const updated = {
      ...task,
      status,
      statusHistory: history,
      updatedAt: now,
      rejectionReason: status === 'rejected' ? String(reason).trim() : task.rejectionReason,
      rejectedAt: status === 'rejected' ? now : task.rejectedAt,
      rejectedBy: status === 'rejected' ? actingUsername : task.rejectedBy,
      completedAt: status === 'completed' ? now : null,
      completedBy: status === 'completed' ? actingUsername : null
    };

    writeTask(updated);

    if (status === 'completed') {
      notifyTaskEvent(updated, 'assignment_completed', `Ολοκληρώθηκε: ${updated.title}`);
    } else if (status === 'rejected') {
      notifyTaskEvent(updated, 'assignment_rejected', `Απορρίφθηκε: ${updated.title}`);
    } else {
      notifyTaskEvent(updated, 'status_changed', `Νέα κατάσταση (${status}): ${updated.title}`);
    }

    return { success: true, task: updated };
  }

  function addComment({ actingUsername, taskId, text }) {
    const users = loadUsers();
    const task = readTask(taskId);
    if (!task) return { success: false, error: 'Η ανάθεση δεν βρέθηκε' };
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
    writeTask(updated);
    notifyTaskEvent(updated, 'comment_added', `${authorLabel}: «${excerpt}»`, [...recipients]);
    return { success: true, task: updated };
  }

  function addFiles({ actingUsername, taskId, newFiles = [] }) {
    const users = loadUsers();
    const task = readTask(taskId);
    if (!task) return { success: false, error: 'Η ανάθεση δεν βρέθηκε' };
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
    writeTask(updated);
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
    if (!tid) return { success: false, error: 'Κενό αναγνωριστικό ανάθεσης' };
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
    const involved = idx.tasks.some(
      (t) =>
        isAssignee(t, actingUsername) ||
        isAssigner(t, actingUsername)
    );
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
              ? `Η ανάθεση «${task.title}» λήγει σήμερα`
              : `Η ανάθεση «${task.title}» λήγει σε ${daysBefore} ημέρα(ες)`
          );
          sent.add(key);
          changed = true;
        }
      });

      if (due < startOfToday && !sent.has('overdue')) {
        notifyTaskEvent(task, 'overdue', `Η ανάθεση «${task.title}» έχει εκπρόθεσμη προθεσμία`);
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

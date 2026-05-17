export const TASK_STATUS_LABELS = {
  pending: 'Εκκρεμεί',
  in_progress: 'Σε εξέλιξη',
  completed: 'Ολοκληρώθηκε',
  rejected: 'Απορρίφθηκε',
  cancelled: 'Κλειστός'
};

/** Κλειστός χώρος για συναδέλφους: μένει στον αναθέτη, οι συνάδελφοι δεν τον βλέπουν πλέον. */
export function isTaskWithdrawnByAssigner(task) {
  return !!(task && task.status === 'cancelled' && task.withdrawnByAssigner);
}

/** Συνάδελφος που αποχώρησε από την αποθήκη ολοκληρωμένων χώρων. */
export function hasLeftWorkArchive(task, username) {
  if (!task || !username) return false;
  const u = String(username).toLowerCase();
  return (task.leftArchiveBy || []).some((x) => String(x).toLowerCase() === u);
}

/** Συνάδελφοι που δεν έχουν αποχωρήσει από την αποθήκη (για εμφάνιση στη λίστα). */
export function getActiveAssignees(task) {
  if (!task) return [];
  const left = new Set((task.leftArchiveBy || []).map((x) => String(x).toLowerCase()));
  return (task.assignees || []).filter((a) => !left.has(String(a).toLowerCase()));
}

export function formatAssigneeDisplayNames(task, usersMap) {
  return getActiveAssignees(task)
    .map((u) => usersMap?.[u]?.fullName || u)
    .join(', ');
}

export function formatLeftArchiveDisplayNames(task, usersMap) {
  return (task.leftArchiveBy || [])
    .map((u) => usersMap?.[u]?.fullName || u)
    .join(', ');
}

export const ARCHIVE_READONLY_ERROR =
  'Ο χώρος είναι στην Αποθήκη Εργασιών (ολοκληρωμένος) και δεν δέχεται νέα σχόλια ή αρχεία.';

export function getArchiveReadonlyMessage(task, actingUsername, canEditAsAssigner = false) {
  const isAssigner =
    task?.createdBy && String(task.createdBy).toLowerCase() === String(actingUsername || '').toLowerCase();
  if (isAssigner && canEditAsAssigner) {
    return `${ARCHIVE_READONLY_ERROR} Για να ενεργοποιηθεί ξανά, αλλάξτε την κατάσταση από «Επαναφορά από αποθήκη» (π.χ. Εκκρεμεί ή Σε εξέλιξη).`;
  }
  return `${ARCHIVE_READONLY_ERROR} Για επανενεργοποίηση, ο αναθέτης πρέπει πρώτα να αλλάξει την κατάσταση του χώρου.`;
}

export const TASK_PRIORITY_LABELS = {
  low: 'Χαμηλή',
  normal: 'Κανονική',
  high: 'Υψηλή'
};

export const DEFAULT_REMINDER_OFFSETS = [7, 3, 1, 0];

export function formatTaskDueDate(dueDate, dueTime) {
  if (!dueDate) return '—';
  try {
    const d = new Date(`${dueDate}T${dueTime || '23:59'}`);
    if (Number.isNaN(d.getTime())) return dueDate;
    return d.toLocaleString('el-GR', { dateStyle: 'short', timeStyle: dueTime ? 'short' : undefined });
  } catch {
    return dueDate;
  }
}

export function isTaskOverdue(task) {
  if (!task || !task.dueDate) return false;
  if (!['pending', 'in_progress'].includes(task.status)) return false;
  const d = new Date(`${task.dueDate}T${task.dueTime || '23:59'}`);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export function emptyTaskAssignmentPerms() {
  return { canAssign: false, assignableScope: 'none', assignableUsernames: [] };
}

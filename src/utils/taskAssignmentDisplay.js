export const TASK_STATUS_LABELS = {
  pending: 'Εκκρεμεί',
  in_progress: 'Σε εξέλιξη',
  completed: 'Ολοκληρώθηκε',
  rejected: 'Απορρίφθηκε',
  cancelled: 'Ακυρώθηκε'
};

export const TASK_PRIORITY_LABELS = {
  low: 'Χαμηλή',
  normal: 'Κανονική',
  high: 'Υψηλή'
};

export const DEFAULT_REMINDER_OFFSETS = [7, 3, 1, 0];

export function formatTaskDueDate(dueDate, dueTime) {
  if (!dueDate) return '—';
  try {
    const d = new Date(`${dueDate}T${dueTime || '12:00'}`);
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

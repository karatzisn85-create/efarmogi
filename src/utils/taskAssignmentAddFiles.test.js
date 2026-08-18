/**
 * @jest-environment node
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createTaskAssignmentService } = require('../../public/taskAssignmentService');

function makeUsers() {
  return [
    {
      username: 'maria',
      fullName: 'Μαρία',
      role: 'ADMIN',
      active: true,
      approved: true,
      taskAssignment: { canAssign: true, assignableScope: 'all', assignableUsernames: [] },
    },
    {
      username: 'nikos',
      fullName: 'Νίκος',
      role: 'ENGINEER',
      active: true,
      approved: true,
      taskAssignment: { canAssign: false, assignableScope: 'none', assignableUsernames: [] },
    },
  ];
}

describe('προσθήκη αρχείων χώρου εργασίας', () => {
  let dataDir;
  let sourceFile;
  let svc;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eh-tasks-'));
    sourceFile = path.join(dataDir, 'memo.txt');
    fs.writeFileSync(sourceFile, 'περιεχόμενο');
    svc = createTaskAssignmentService({
      dataDir,
      loadUsers: makeUsers,
      getTempDir: () => dataDir,
    });
  });

  afterEach(() => {
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  test('μετά την αποθήκευση αρχείου καταγράφεται ειδοποίηση στον συνάδελφο', () => {
    const created = svc.createTask({
      actingUsername: 'maria',
      payload: { title: 'Έλεγχος δικτύου', assignees: ['nikos'] },
    });
    expect(created.success).toBe(true);

    const added = svc.addFiles({
      actingUsername: 'maria',
      taskId: created.task.id,
      newFiles: [{ filePath: sourceFile, fileName: 'memo.txt' }],
      batch: { kind: 'files' },
    });
    expect(added.success).toBe(true);
    expect(added.task.files.length).toBe(1);

    const notif = svc.loadNotifications({ actingUsername: 'nikos', unreadOnly: true });
    expect(notif.success).toBe(true);
    const aboutFiles = (notif.notifications || []).filter(
      (n) => n.taskId === created.task.id && String(n.message || '').includes('memo.txt')
    );
    expect(aboutFiles.length).toBeGreaterThan(0);
  });
});

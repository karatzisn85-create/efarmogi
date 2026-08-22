import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const tw = require('../../app/core/taskWorkspace.js');

const tasks = [
  { id: 'open', title: 'Έλεγχος γέφυρας', status: 'pending', createdBy: 'admin', assignees: ['maria'], updatedAt: '2' },
  { id: 'done', title: 'Ολοκληρωμένη αποτύπωση', status: 'completed', createdBy: 'admin', assignees: ['maria'], updatedAt: '1' },
  { id: 'withdrawn', title: 'Κλειστός', status: 'cancelled', withdrawnByAssigner: true, createdBy: 'admin', assignees: ['maria'], updatedAt: '0' },
  { id: 'left', title: 'Αποθήκη', status: 'completed', leftArchiveBy: ['maria'], createdBy: 'admin', assignees: ['maria'], updatedAt: '0' },
];

test('χώρος κρύβει ολοκληρωμένα· αποθήκη μόνο αυτά', () => {
  const work = tw.applyTaskDailyFilters(tasks, { isWorkArchive: false });
  assert.deepEqual(work.map((t) => t.id), ['open', 'withdrawn']);
  const archive = tw.applyTaskDailyFilters(tasks, { isWorkArchive: true });
  assert.deepEqual(archive.map((t) => t.id).sort(), ['done', 'left']);
});

test('κλειστός / αποχώρηση: κρύβεται από συνάδελφο, όχι από αναθέτη', () => {
  assert.equal(tw.canAccessTask(tasks[2], 'maria', false), false);
  assert.equal(tw.canAccessTask(tasks[2], 'admin', false), true);
  assert.equal(tw.canAccessTask(tasks[3], 'maria', false), false);
  assert.equal(tw.canAccessTask(tasks[3], 'admin', false), true);

  const mariaWork = tw.listTasksForView(tasks, {
    actingUsername: 'maria', view: 'asAssignee', listScope: 'default'
  });
  assert.deepEqual(mariaWork.map((t) => t.id), ['open']);

  const mariaArchive = tw.listTasksForView(tasks, {
    actingUsername: 'maria', view: 'asAssignee', listScope: 'workArchive'
  });
  assert.deepEqual(mariaArchive.map((t) => t.id), ['done']);
});

test('Δημιουργία Χώρου μόνο εκτός αποθήκης και με δικαίωμα ανάθεσης', () => {
  assert.equal(tw.showCreateTaskButton(true, false), true);
  assert.equal(tw.showCreateTaskButton(true, true), false);
  assert.equal(tw.showCreateTaskButton(false, false), false);
});

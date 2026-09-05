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

const usersMap = {
  maria: { username: 'maria', fullName: 'Μαρία Κοντού' },
  kostas: { username: 'kostas', fullName: 'Κώστας Λαμπράκης' },
  eleni: { username: 'eleni', fullName: 'Ελένη Σηφάκη' },
  giannis: { username: 'giannis', fullName: 'Γιάννης Μαθιουδάκης' },
  admin: { username: 'admin', fullName: 'Προϊστάμενος' },
};

function space(partial) {
  return {
    createdBy: 'admin',
    assignees: ['maria'],
    status: 'pending',
    withdrawnByAssigner: false,
    leftArchiveBy: [],
    updatedAt: '1',
    ...partial,
  };
}

test('ομαδικός χώρος μετράει μία υπόθεση και μία γραμμή σε κάθε άτομο', () => {
  const roster = tw.buildAssignerPersonRoster([
    space({ id: 'g', title: 'Προσφυγή', assignees: ['maria', 'kostas', 'eleni'] }),
    space({ id: 's', title: 'Έγγραφο', assignees: ['maria'] }),
  ], { actingUsername: 'admin', usersMap });

  assert.equal(roster.openSpaceCount, 2);
  assert.equal(roster.peopleWithWorkCount, 3);
  const maria = roster.people.find((p) => p.username === 'maria');
  const kostas = roster.people.find((p) => p.username === 'kostas');
  assert.equal(maria.openCount, 2);
  assert.equal(kostas.openCount, 1);
  assert.equal(tw.togetherWithLabel(space({ assignees: ['maria', 'kostas', 'eleni'] }), 'maria', usersMap), 'μαζί με Κώστας Λαμπράκης, Ελένη Σηφάκη');
  assert.equal(tw.togetherWithLabel(space({ assignees: ['maria'] }), 'maria', usersMap), '');
  assert.equal(tw.togetherWithLabel(space({ assignees: ['admin', 'maria', 'kostas'] }), 'maria', usersMap), 'μαζί με Κώστας Λαμπράκης');
  assert.equal(tw.togetherWithLabel(space({ assignees: ['kostas', 'Kostas', 'eleni'] }), 'maria', usersMap), 'μαζί με Κώστας Λαμπράκης, Ελένη Σηφάκη');
});

test('ο αναθέτης δεν μπαίνει στη λίστα ατόμων κι ας είναι συμμετέχων', () => {
  const roster = tw.buildAssignerPersonRoster([
    space({ id: 'g', assignees: ['admin', 'maria'] }),
  ], { actingUsername: 'admin', usersMap });
  assert.equal(roster.people.some((p) => p.username === 'admin'), false);
  assert.equal(roster.people.length, 1);
  assert.equal(roster.people[0].username, 'maria');
});

test('κλειστός χώρος δεν φουσκώνει τα ανοιχτά· ολοκληρωμένος πάει στα κλειστά του ατόμου', () => {
  const roster = tw.buildAssignerPersonRoster([
    space({ id: 'w', status: 'cancelled', withdrawnByAssigner: true, assignees: ['maria'] }),
    space({ id: 'd', status: 'completed', assignees: ['maria'] }),
    space({ id: 'o', status: 'pending', assignees: ['maria'] }),
  ], { actingUsername: 'admin', usersMap });
  const maria = roster.people.find((p) => p.username === 'maria');
  assert.equal(maria.openCount, 1);
  assert.equal(maria.completedCount, 1);
  assert.equal(roster.openSpaceCount, 1);
  assert.equal(maria.openTasks.some((t) => t.id === 'w'), false);
  assert.equal(maria.closedCount, 1);
  assert.equal(maria.closedTasks[0].id, 'w');
  const onlyClosed = tw.buildAssignerPersonRoster([
    space({ id: 'w', status: 'cancelled', withdrawnByAssigner: true, assignees: ['maria'] }),
  ], { actingUsername: 'admin', usersMap });
  assert.equal(onlyClosed.people.length, 1);
  assert.equal(onlyClosed.openSpaceCount, 0);
  assert.equal(onlyClosed.peopleWithWorkCount, 0);
  assert.equal(onlyClosed.people[0].closedCount, 1);
});

test('εκπρόθεσμο μετράει μόνο σε ανοιχτό χώρο με προθεσμία', () => {
  const now = new Date('2026-09-05T12:00:00');
  const roster = tw.buildAssignerPersonRoster([
    space({ id: 'late', dueDate: '2026-09-01', assignees: ['maria'] }),
    space({ id: 'ok', dueDate: '2026-09-20', assignees: ['kostas'] }),
    space({ id: 'done-late', status: 'completed', dueDate: '2026-09-01', assignees: ['eleni'] }),
  ], { actingUsername: 'admin', usersMap, now });
  assert.equal(roster.people.find((p) => p.username === 'maria').overdueCount, 1);
  assert.equal(roster.people.find((p) => p.username === 'kostas').overdueCount, 0);
  assert.equal(roster.people.find((p) => p.username === 'eleni').overdueCount, 0);
});

test('αποθήκη: όποιος αποχώρησε δεν φαίνεται στα ολοκληρωμένα του', () => {
  const roster = tw.buildAssignerPersonRoster([
    space({
      id: 'left',
      status: 'completed',
      assignees: ['maria', 'kostas'],
      leftArchiveBy: ['maria'],
    }),
  ], { actingUsername: 'admin', usersMap });
  assert.equal(roster.people.find((p) => p.username === 'maria'), undefined);
  assert.equal(roster.people.find((p) => p.username === 'kostas').completedCount, 1);
});

test('assignerAll φέρνει και ολοκληρωμένα για την όψη ανά άτομο', () => {
  const all = tw.listTasksForView(tasks, {
    actingUsername: 'admin', view: 'asAssigner', listScope: 'assignerAll', canAssign: true,
  });
  assert.deepEqual(all.map((t) => t.id).sort(), ['done', 'left', 'open', 'withdrawn']);
});

test('χωρίς χρέωση από εσάς: μετράει τους υπόλοιπους που μπορείτε να χρεώσετε', () => {
  const roster = tw.buildAssignerPersonRoster([
    space({ id: 's', assignees: ['maria'] }),
  ], {
    actingUsername: 'admin',
    usersMap,
    assignableUsernames: ['maria', 'kostas', 'eleni', 'giannis'],
  });
  assert.equal(roster.idleCount, 3);
});

test('αναζήτηση δεν αλλάζει τα σύνολα ούτε το «χωρίς χρέωση»', () => {
  const opts = {
    actingUsername: 'admin',
    usersMap,
    assignableUsernames: ['maria', 'kostas', 'eleni', 'giannis'],
  };
  const list = [
    space({ id: 's', title: 'Έγγραφο Μαρίας', assignees: ['maria'] }),
    space({ id: 'k', title: 'Έλεγχος Κώστα', assignees: ['kostas'] }),
  ];
  const all = tw.buildAssignerPersonRoster(list, opts);
  const filtered = tw.buildAssignerPersonRoster(list, { ...opts, search: 'Έγγραφο' });
  assert.equal(all.openSpaceCount, 2);
  assert.equal(filtered.openSpaceCount, 2);
  assert.equal(all.peopleWithWorkCount, 2);
  assert.equal(filtered.peopleWithWorkCount, 2);
  assert.equal(all.idleCount, 2);
  assert.equal(filtered.idleCount, 2);
  assert.equal(filtered.people.length, 1);
  assert.equal(filtered.people[0].username, 'maria');
});

test('χώρος μόνο στον αναθέτη δεν μετράει ως χρέωση συναδέλφου', () => {
  const roster = tw.buildAssignerPersonRoster([
    space({ id: 'self', assignees: ['admin'] }),
    space({ id: 'm', assignees: ['maria'] }),
  ], { actingUsername: 'admin', usersMap });
  assert.equal(roster.openSpaceCount, 1);
  assert.equal(roster.people.length, 1);
  assert.equal(roster.people[0].username, 'maria');
});

test('συμμετέχω δεν δείχνει χώρους που δημιούργησα, ακόμα κι αν είμαι στη λίστα', () => {
  const mine = [
    space({ id: 'self', createdBy: 'admin', assignees: ['admin', 'maria'], updatedAt: '3' }),
    space({ id: 'charged', createdBy: 'admin', assignees: ['maria'], updatedAt: '2' }),
    space({ id: 'incoming', createdBy: 'maria', assignees: ['admin'], updatedAt: '1' }),
  ];
  const asParticipant = tw.listTasksForView(mine, {
    actingUsername: 'admin', view: 'asAssignee', listScope: 'default', canAssign: true,
  });
  assert.deepEqual(asParticipant.map((t) => t.id), ['incoming']);
  const asCreator = tw.listTasksForView(mine, {
    actingUsername: 'admin', view: 'asAssigner', listScope: 'default', canAssign: true,
  });
  assert.deepEqual(asCreator.map((t) => t.id).sort(), ['charged', 'self']);
  const mariaSees = tw.listTasksForView(mine, {
    actingUsername: 'maria', view: 'asAssignee', listScope: 'default',
  });
  assert.deepEqual(mariaSees.map((t) => t.id).sort(), ['charged', 'self']);
});

test('διπλό όνομα στη λίστα συμμετεχόντων μετράει μία φορά', () => {
  const roster = tw.buildAssignerPersonRoster([
    space({ id: 'd', assignees: ['maria', 'Maria', 'maria'] }),
  ], { actingUsername: 'admin', usersMap });
  assert.equal(roster.people.find((p) => p.username === 'maria').openCount, 1);
});

test('συμμετέχων με δικαίωμα χρέωσης μπορεί να προσθέσει συναδέλφους· ο δημιουργός δεν αλλάζει', () => {
  const received = space({ id: 'from-dir', createdBy: 'admin', assignees: ['kostas'] });
  assert.equal(tw.canInviteAssigneesToTask(received, 'kostas', { canAssign: true }), true);
  assert.equal(tw.canInviteAssigneesToTask(received, 'kostas', { canAssign: false }), false);
  assert.equal(tw.canInviteAssigneesToTask(received, 'maria', { canAssign: true }), false);
  assert.equal(tw.canInviteAssigneesToTask(received, 'admin', { canAssign: true }), true);
  assert.equal(tw.canInviteAssigneesToTask(
    space({ status: 'completed', assignees: ['kostas'] }),
    'kostas',
    { canAssign: true }
  ), false);
  assert.equal(tw.canInviteAssigneesToTask(
    space({ status: 'cancelled', withdrawnByAssigner: true, assignees: ['kostas'] }),
    'kostas',
    { canAssign: true }
  ), false);
  const merged = tw.mergeAddedAssignees(received, ['maria', 'kostas', 'eleni']);
  assert.equal(merged.createdBy, 'admin');
  assert.deepEqual(merged.added, ['maria', 'eleni']);
  assert.deepEqual(merged.assignees, ['kostas', 'maria', 'eleni']);
});

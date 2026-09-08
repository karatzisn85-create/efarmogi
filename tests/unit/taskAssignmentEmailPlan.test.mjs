import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const svc = require('../../public/taskAssignmentEmailService.js');

const users = [
  { username: 'boss', email: 'boss@gmail.com' },
  { username: 'maria', email: 'maria@gmail.com' },
  { username: 'nikos' }
];
const cfg = { gmail: { user: 'app@gmail.com', appPassword: 'secret' } };

test('σχέδιο αποστολής: ON στέλνει στους συμμετέχοντες με email, όχι στον δημιουργό', () => {
  const task = {
    createdBy: 'boss',
    assignees: ['maria', 'nikos'],
    emailNotifications: true,
    title: 'Δοκιμή'
  };
  const planned = svc.planWorkspaceSend(task, users, cfg);
  assert.equal(planned.send, true);
  assert.deepEqual(planned.recipients, ['maria@gmail.com']);
});

test('σχέδιο αποστολής: OFF ή χωρίς παραλήπτες παραλείπει', () => {
  const off = svc.planWorkspaceSend(
    { createdBy: 'boss', assignees: ['maria'], emailNotifications: false },
    users,
    cfg
  );
  assert.equal(off.send, false);
  const none = svc.planWorkspaceSend(
    { createdBy: 'boss', assignees: ['nikos'], emailNotifications: true },
    users,
    cfg
  );
  assert.equal(none.send, false);
  assert.match(none.reason, /παραληπτ/);
});

test('αποτέλεσμα προς την οθόνη δεν περιλαμβάνει διευθύνσεις', () => {
  const client = svc.emailResultForClient({
    success: true,
    sentTo: ['maria@gmail.com', 'other@gmail.com']
  });
  assert.equal(client.success, true);
  assert.equal(client.sentCount, 2);
  assert.equal(client.sentTo, undefined);
});

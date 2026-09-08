import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const em = require('../../app/core/emailCatalog.js');

test('ρυθμίσεις email μόνο υπερδιαχειριστής', () => {
  assert.equal(em.showEmailSettingsButton('SUPERADMIN'), true);
  assert.equal(em.showEmailSettingsButton('ADMIN'), false);
  assert.equal(em.canOpenNotificationCenter('ADMIN'), true);
  assert.equal(em.canOpenEmailHistory('SUPERADMIN'), true);
  assert.equal(em.canOpenNotificationCenter('ENGINEER'), false);
  assert.equal(em.canOpenEmailHistory('USER'), false);
});

test('αποθήκευση SMTP: Gmail και App Password, χωρίς αποκάλυψη κωδικού', () => {
  assert.match(em.evaluateSaveEmailConfig({ role: 'ADMIN', gmailUser: 'a@gmail.com', appPassword: 'x' }).error, /δικαίωμα/);
  assert.match(em.evaluateSaveEmailConfig({ role: 'SUPERADMIN', gmailUser: '', appPassword: 'x' }).error, /Gmail/);
  assert.match(em.evaluateSaveEmailConfig({ role: 'SUPERADMIN', gmailUser: 'a@outlook.com', appPassword: 'x' }).error, /gmail.com/);
  assert.match(em.evaluateSaveEmailConfig({ role: 'SUPERADMIN', gmailUser: 'a@gmail.com' }).error, /App Password/);
  const ok = em.evaluateSaveEmailConfig({
    role: 'SUPERADMIN',
    gmailUser: 'ergohubapp',
    appPassword: 'abcd efgh'
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.gmailUser, 'ergohubapp@gmail.com');
  const client = em.sanitizeEmailConfigForClient({
    gmail: { user: 'ergohubapp@gmail.com', appPassword: 'SECRET' }
  });
  assert.equal(client.gmail.appPasswordSet, true);
  assert.equal(client.gmail.appPassword, undefined);
});

test('δοκιμαστική αποστολή χωρίς ρύθμιση απορρίπτεται', () => {
  assert.match(em.evaluateTestEmail({ role: 'SUPERADMIN', config: {} }).error, /ρυθμίσεις email/);
  const ok = em.evaluateTestEmail({
    role: 'SUPERADMIN',
    config: { gmail: { user: 'a@gmail.com', appPasswordSet: true } }
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.simulated, true);
});

test('email χώρου και παραλήπτες υπενθυμίσεων', () => {
  const cfg = { gmail: { user: 'a@gmail.com', appPasswordSet: true } };
  assert.equal(em.showWorkspaceEmailToggle({ isAssigner: true, config: cfg }), true);
  assert.equal(em.showWorkspaceEmailToggle({ isAssigner: false, config: cfg }), false);
  assert.equal(em.evaluateWorkspaceCreatedEmail({ config: cfg, emailEnabled: false }).send, false);
  assert.equal(em.evaluateWorkspaceCreatedEmail({ config: cfg, emailEnabled: true }).send, true);
  assert.equal(em.evaluateWorkspaceCreatedEmail({ config: cfg }).send, false);
  const users = [
    { username: 's', role: 'SUPERADMIN', approved: true, notificationPreferences: {} },
    { username: 'a', role: 'ADMIN', approved: true, notificationPreferences: { aepoEmail: false } },
    { username: 'e', role: 'ENGINEER', approved: true, notificationPreferences: {} }
  ];
  assert.equal(em.evaluateCalendarReminderRecipients({ calendarRemindersEnabled: false, users }).length, 0);
  assert.equal(em.evaluateCalendarReminderRecipients({ calendarRemindersEnabled: true, users }).length, 3);
  const aepo = em.evaluateAepoReminderRecipients({ users });
  assert.deepEqual(aepo.map((u) => u.username), ['s']);
});

test('πρόσκληση χώρου: παραλήπτες με email, χωρίς τον δημιουργό', () => {
  const cfg = { gmail: { user: 'a@gmail.com', appPasswordSet: true } };
  const task = {
    createdBy: 'boss',
    assignees: ['maria', 'nikos', 'boss'],
    title: 'Δοκιμή'
  };
  const users = [
    { username: 'boss', email: 'boss@gmail.com' },
    { username: 'maria', email: 'maria@gmail.com' },
    { username: 'nikos', fullName: 'Νίκος' },
    { username: 'elena', email: 'elena@gmail.com' }
  ];
  assert.deepEqual(
    em.getWorkspaceRecipientEmails(task, users, { excludeUsernames: ['boss'] }),
    ['maria@gmail.com']
  );
  const off = em.planWorkspaceCreatedEmail({ config: cfg, emailEnabled: false, task, users });
  assert.equal(off.send, false);
  assert.equal(off.reason, 'workspace-off');
  const planned = em.planWorkspaceCreatedEmail({ config: cfg, emailEnabled: true, task, users });
  assert.equal(planned.send, true);
  assert.deepEqual(planned.recipients, ['maria@gmail.com']);
  const none = em.planWorkspaceCreatedEmail({
    config: cfg,
    emailEnabled: true,
    task: { createdBy: 'boss', assignees: ['nikos'] },
    users
  });
  assert.equal(none.send, false);
  assert.equal(none.reason, 'no-recipients');
  const added = em.getWorkspaceRecipientEmails(task, users, {
    onlyUsernames: ['elena'],
    excludeUsernames: ['boss']
  });
  assert.deepEqual(added, ['elena@gmail.com']);
});

test('μήνυμα προς τον δημιουργό μετά την αποστολή', () => {
  const ok = em.workspaceEmailUserMessage({ success: true, sentTo: ['a@x.gr', 'b@x.gr'] }, 'created');
  assert.equal(ok.type, 'success');
  assert.match(ok.text, /2 συναδέλφους/);
  const missing = em.workspaceEmailUserMessage({ skipped: true, reason: 'Δεν βρέθηκαν email παραληπτών' }, 'created');
  assert.equal(missing.type, 'warning');
  assert.match(missing.text, /δεν έχει email/);
  const fail = em.workspaceEmailUserMessage({ success: false, error: 'EMAIL_DECRYPT_FAILED' }, 'created');
  assert.equal(fail.type, 'warning');
  assert.match(fail.text, /κωδικό/);
});

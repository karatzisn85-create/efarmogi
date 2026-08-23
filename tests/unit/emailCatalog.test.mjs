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

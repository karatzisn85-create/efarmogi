'use strict';

const fs = require('fs');
const path = require('path');
const { test, expect } = require('./helpers/real-app.cjs');

test('P17-01 κάθε χρήστης ανοίγει την αποστολή email και το κενό μήνυμα δεν φεύγει', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('USER');
  await expect(window.getByTestId('btn-send-user-email')).toBeVisible();
  await window.getByTestId('btn-send-user-email').click();
  await expect(window.getByTestId('user-message-window')).toBeVisible();
  await expect(window.getByTestId('user-message-sender')).toContainText('Απλός Χρήστης');
  await expect(window.getByTestId('user-message-person-maria')).toBeVisible();
  await expect(window.getByTestId('user-message-person-pending')).toHaveCount(0);
  await window.getByTestId('user-message-body').fill('');
  await window.getByTestId('user-message-send').click();
  await expect(window.getByTestId('user-message-error')).toContainText('παραλήπτη');
  await window.getByTestId('user-message-person-maria').check();
  await window.getByTestId('user-message-subject').fill('');
  await window.getByTestId('user-message-send').click();
  await expect(window.getByTestId('user-message-error')).toContainText('θέμα');
  await window.getByTestId('user-message-subject').fill('Συνάντηση');
  await window.getByTestId('user-message-send').click();
  await expect(window.getByTestId('user-message-error')).toContainText('μήνυμα');
});

test('P17-02 το μήνυμα φεύγει προς τα προσωπικά email και φαίνεται ο αποστολέας', async ({ app }) => {
  const { window, testDir } = app;
  await app.loginAsRole('USER');
  await window.getByTestId('btn-send-user-email').click();
  await window.getByTestId('user-message-search').fill('Μαρία Παπ');
  await window.getByTestId('user-message-person-maria').check();
  await window.getByTestId('user-message-subject').fill('Συνάντηση στο εργοτάξιο');
  await window.getByTestId('user-message-body').fill('Τα λέμε αύριο το πρωί.');
  const attachment = path.join(testDir, 'semeioma.txt');
  fs.writeFileSync(attachment, 'σημείωμα', 'utf8');
  await window.evaluate(async (filePath) => {
    await window.electronAPI.invoke('e2e-queue-open-files', [filePath]);
  }, attachment);
  await window.getByTestId('user-message-attach').click();
  await expect(window.getByTestId('user-message-file-semeioma.txt')).toBeVisible();
  await window.getByTestId('user-message-send').click();
  await expect(window.getByText('Το μήνυμα στάλθηκε. Αντίγραφο έρχεται και στο email σου.')).toBeVisible({ timeout: 20000 });
  const out = await window.evaluate(async () => window.electronAPI.invoke('e2e-mail-outbox'));
  expect(out.success).toBe(true);
  const message = (out.messages || []).find((row) => row.subject === 'Συνάντηση στο εργοτάξιο');
  expect(message).toBeTruthy();
  expect(message.to).toContain('ergohubapp@gmail.com');
  expect(message.replyTo).toContain('Απλός Χρήστης');
  expect(message.replyTo).toContain('ergohubapp@gmail.com');
  expect(message.html).toContain('Απλός Χρήστης');
  expect(message.html).toContain('Μαρία Παπαδοπούλου');
  expect(message.html).toContain('Τα λέμε αύριο το πρωί.');
  expect(message.html).toContain('semeioma.txt');
  expect(message.html).not.toContain('<script>');
});

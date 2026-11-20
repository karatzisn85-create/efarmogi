import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const mail = require('../../public/userMessageEmail');

const actor = { username: 'viewer', fullName: 'Απλός Χρήστης', email: 'viewer@example.com', active: true, approved: true, role: 'USER' };
const users = [
  actor,
  { username: 'maria', fullName: 'Μαρία Παπαδοπούλου', email: 'maria@example.com', active: true, approved: true },
  { username: 'pending', fullName: 'Σε Αναμονή', email: 'pending@example.com', active: true, approved: false },
  { username: 'no-mail', fullName: 'Χωρίς Email', email: '', active: true, approved: true },
];

test('ο κατάλογος έχει μόνο ενεργούς χρήστες με email, χωρίς τον ίδιο τον αποστολέα', () => {
  const listed = mail.listRecipients(users, actor);
  assert.deepEqual(listed.recipients.map((person) => person.username), ['maria']);
  assert.equal(listed.me.email, 'viewer@example.com');
});

test('το μήνυμα πάει και στον αποστολέα και η απάντηση στα προσωπικά email', () => {
  const prepared = mail.prepareUserMessage({
    actor,
    users,
    recipientUsernames: ['maria', 'pending'],
    subject: 'Συνάντηση',
    body: 'Τα λέμε αύριο.\nΦέρε τα σχέδια.',
    files: [],
  });
  assert.equal(prepared.ok, false);

  const ok = mail.prepareUserMessage({
    actor,
    users,
    recipientUsernames: ['maria'],
    subject: 'Συνάντηση',
    body: 'Τα λέμε αύριο.\n<script>alert(1)</script>',
    files: [{ name: 'σχέδιο.png', bytes: 2000 }, { name: 'εργο.exe', bytes: 20 }],
  });
  assert.equal(ok.ok, false);
  assert.match(ok.error, /δεν μπορεί να σταλεί/);

  const sent = mail.prepareUserMessage({
    actor,
    users,
    recipientUsernames: ['maria'],
    subject: 'Συνάντηση',
    body: 'Τα λέμε αύριο.\n<script>alert(1)</script>',
    files: [{ name: 'σχέδιο.png', bytes: 2000 }],
  });
  assert.equal(sent.ok, true);
  assert.deepEqual(sent.to.sort(), ['maria@example.com', 'viewer@example.com'].sort());
  assert.match(sent.replyTo, /viewer@example.com/);
  assert.match(sent.replyTo, /maria@example.com/);
  assert.match(sent.html, /Απλός Χρήστης/);
  assert.match(sent.html, /Μαρία Παπαδοπούλου/);
  assert.match(sent.html, /Τα λέμε αύριο\.<br>&lt;script&gt;/);
  assert.doesNotMatch(sent.html, /<script>/);
  assert.match(sent.html, /cid:user-message-0@ergohub/);
  assert.match(sent.html, /σχέδιο.png/);
});

test('χωρίς email αποστολέα ή χωρίς κείμενο το μήνυμα δεν ετοιμάζεται', () => {
  const noMail = mail.prepareUserMessage({
    actor: { ...actor, email: '' },
    users,
    recipientUsernames: ['maria'],
    subject: 'Θέμα',
    body: 'Κείμενο',
    files: [],
  });
  assert.equal(noMail.ok, false);
  const empty = mail.prepareUserMessage({
    actor,
    users,
    recipientUsernames: ['maria'],
    subject: 'Θέμα',
    body: '   ',
    files: [],
  });
  assert.equal(empty.ok, false);
  assert.match(empty.error, /μήνυμα/);
});

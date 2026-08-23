import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const users = require('../../app/core/userCatalog.js');

const sample = [
  { username: 'superadmin', role: 'SUPERADMIN', approved: true, active: true },
  { username: 'admin', role: 'ADMIN', approved: true, active: true },
  { username: 'pending', role: 'USER', approved: false, active: true },
];

test('διαχείριση χρηστών μόνο στον υπερδιαχειριστή', () => {
  assert.equal(users.showUserManagementButton('SUPERADMIN'), true);
  assert.equal(users.showUserManagementButton('ADMIN'), false);
  assert.equal(users.showUserManagementButton('ENGINEER'), false);
  assert.equal(users.showUserManagementButton('USER'), false);
});

test('νέος χρήστης: όνομα και κωδικός 8 χαρακτήρες', () => {
  const empty = users.collectCreateUserRequiredErrors({}, { isEdit: false });
  assert.equal(empty.username, 'Εισάγετε όνομα χρήστη');
  assert.equal(empty.password, 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες');
  const short = users.collectCreateUserRequiredErrors({
    username: 'giorgos',
    password: '1234567',
  }, { isEdit: false });
  assert.equal(short.password, 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες');
  assert.deepEqual(users.collectCreateUserRequiredErrors({
    username: 'giorgos',
    password: 'secret123',
  }, { isEdit: false }), {});
});

test('δημιουργία: μόνο υπερδιαχειριστής· διπλό όνομα· νέος USER σε αναμονή', () => {
  assert.equal(users.evaluateCreateUser({
    actorIsSuperAdmin: false,
    username: 'giorgos',
    password: 'secret123',
    role: 'USER',
    users: sample,
  }).ok, false);
  assert.equal(users.evaluateCreateUser({
    actorIsSuperAdmin: true,
    username: 'Admin',
    password: 'secret123',
    role: 'USER',
    users: sample,
  }).error, 'Το όνομα χρήστη υπάρχει ήδη');
  assert.equal(users.evaluateCreateUser({
    actorIsSuperAdmin: true,
    username: 'giorgos',
    password: 'secret123',
    role: 'USER',
    users: sample,
  }).ok, true);
  assert.equal(users.newUserStartsApproved('USER'), false);
  assert.equal(users.newUserStartsApproved('SUPERADMIN'), true);
});

test('αυτοεγγραφή μόνο ADMIN / USER', () => {
  assert.equal(users.evaluateRegisterUser({
    username: 'new',
    password: 'secret123',
    role: 'ENGINEER',
    users: sample,
  }).ok, false);
  assert.equal(users.evaluateRegisterUser({
    username: 'new',
    password: 'secret123',
    role: 'ADMIN',
    users: sample,
  }).ok, true);
});

test('διαγραφή: όχι τελευταίος υπερδιαχειριστής· αφαίρεση μόνο του ζητούμενου', () => {
  assert.equal(users.evaluateDeleteUser({
    actorIsSuperAdmin: true,
    target: sample[0],
    users: sample,
  }).error, 'Δεν μπορεί να διαγραφεί ο τελευταίος SUPERADMIN');
  assert.equal(users.showUserDeleteAction('superadmin', sample[0]), false);
  assert.equal(users.showUserDeleteAction('superadmin', sample[1]), true);
  const next = users.removeUserFromList(sample, 'admin');
  assert.deepEqual(next.map((u) => u.username), ['superadmin', 'pending']);
});

test('σύνδεση: σωστός κωδικός, λάθος κωδικός, αναμονή έγκρισης', () => {
  const list = [
    { username: 'nikolas', passwordHash: 'secret123', role: 'SUPERADMIN', fullName: 'Νικόλας', approved: true, active: true },
    { username: 'pending', passwordHash: 'secret123', role: 'USER', fullName: 'Εκκρεμής', approved: false, active: true }
  ];
  const ok = users.evaluateAuthenticate({ users: list, username: 'NIKOLAS', password: 'secret123' });
  assert.equal(ok.ok, true);
  assert.equal(ok.user.username, 'nikolas');
  assert.equal(ok.user.passwordHash, undefined);
  assert.match(users.evaluateAuthenticate({ users: list, username: 'nikolas', password: 'nope' }).error, /κωδικός/);
  assert.match(users.evaluateAuthenticate({ users: list, username: 'pending', password: 'secret123' }).error, /έγκριση/);
});

test('έγκριση μεταφέρει από αιτήματα στους ενεργούς', () => {
  const parts = users.partitionUsersByApproval(sample);
  assert.deepEqual(parts.pending.map((u) => u.username), ['pending']);
  const after = users.approveUserInList(sample, 'pending');
  assert.deepEqual(users.partitionUsersByApproval(after).pending, []);
  assert.equal(after.find((u) => u.username === 'pending').approved, true);
});

import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const audit = require('../../app/core/auditCatalog.js');

const logs = [
  {
    id: 'a1',
    timestamp: '2026-08-20T10:00:00.000Z',
    userFullName: 'Διαχειριστής Δήμου',
    userRole: 'ADMIN',
    user: 'Διαχειριστής Δήμου',
    action: 'create',
    entityType: 'subproject',
    entityId: 'sub-bridge',
    entityTitle: 'Γέφυρα Αγίου Σύλλα',
  },
  {
    id: 'a2',
    timestamp: '2026-08-19T10:00:00.000Z',
    userFullName: 'Μαρία Παπαδοπούλου',
    userRole: 'ENGINEER',
    user: 'Μαρία Παπαδοπούλου',
    action: 'update',
    entityType: 'subproject',
    entityId: 'sub-tank',
    entityTitle: 'Δεξαμενή Παρανύμφων',
    changes: { 'Τίτλος υποέργου': { old: 'Παλιό', new: 'Δεξαμενή Παρανύμφων' } },
  },
  {
    id: 'a3',
    timestamp: '2026-08-18T10:00:00.000Z',
    userFullName: 'Υπερδιαχειριστής',
    userRole: 'SUPERADMIN',
    user: 'Υπερδιαχειριστής',
    action: 'delete',
    entityType: 'user',
    entityId: 'old-user',
    entityTitle: 'Παλιός χρήστης',
  },
  {
    id: 'a4',
    timestamp: '2026-08-16T10:00:00.000Z',
    userFullName: 'Παλιά καταγραφή',
    userRole: '',
    user: 'Παλιά καταγραφή',
    action: 'create',
    entityType: 'prosklisi',
    entityId: 'psk-old',
    entityTitle: 'Παλιά πρόσκληση',
  },
];

test('ιστορικό ενεργειών μόνο σε διαχειριστή / υπερδιαχειριστή / μηχανικό', () => {
  assert.equal(audit.showAuditLogButton('ADMIN'), true);
  assert.equal(audit.showAuditLogButton('SUPERADMIN'), true);
  assert.equal(audit.showAuditLogButton('ENGINEER'), true);
  assert.equal(audit.showAuditLogButton('USER'), false);
});

test('ορατότητα: υπερδιαχειριστής όλα· μηχανικός τα δικά του· διαχειριστής μόνο ADMIN ή χωρίς ρόλο', () => {
  const superIds = audit.filterLogsByViewerRole(logs, {
    username: 'superadmin',
    role: 'SUPERADMIN',
    fullName: 'Υπερδιαχειριστής',
  }).map((l) => l.id);
  assert.deepEqual(superIds, ['a1', 'a2', 'a3', 'a4']);

  const engIds = audit.filterLogsByViewerRole(logs, {
    username: 'maria',
    role: 'ENGINEER',
    fullName: 'Μαρία Παπαδοπούλου',
  }).map((l) => l.id);
  assert.deepEqual(engIds, ['a2']);

  const adminIds = audit.filterLogsByViewerRole(logs, {
    username: 'admin',
    role: 'ADMIN',
    fullName: 'Διαχειριστής Δήμου',
  }).map((l) => l.id);
  assert.deepEqual(adminIds, ['a1', 'a4']);
});

test('ανενεργός ή άγνωστος δεν διαβάζει· φίλτρο τύπου / ενέργειας', () => {
  assert.equal(audit.evaluateGetAuditLog(logs, null).ok, false);
  assert.equal(audit.evaluateGetAuditLog(logs, { username: 'x', role: 'ADMIN', active: false }).ok, false);
  const byType = audit.evaluateGetAuditLog(logs, { username: 'superadmin', role: 'SUPERADMIN' }, {
    entityType: 'subproject',
  });
  assert.deepEqual(byType.logs.map((l) => l.id), ['a1', 'a2']);
  assert.equal(byType.total, 4);
  const byAction = audit.evaluateGetAuditLog(logs, { username: 'superadmin', role: 'SUPERADMIN' }, {
    action: 'delete',
  });
  assert.deepEqual(byAction.logs.map((l) => l.id), ['a3']);
});

test('ενημέρωση χωρίς αλλαγές δεν καταγράφεται· κενά μετά από κανονικοποίηση κρύβονται', () => {
  assert.equal(audit.shouldSkipEmptyUpdate('update', {}), true);
  assert.equal(audit.shouldSkipEmptyUpdate('update', { Τίτλος: { old: 'α', new: 'β' } }), false);
  assert.equal(audit.shouldSkipEmptyUpdate('create', {}), false);
  const cleaned = audit.dropEmptyUpdateLogs([
    {
      id: 'empty',
      action: 'update',
      changes: { Τίτλος: { old: 'Φωτισμός κόμβου', new: 'Φωτισμός  κόμβου' } },
    },
    logs[1],
  ]);
  assert.deepEqual(cleaned.map((l) => l.id), ['a2']);
});

test('εκκαθάριση μόνο υπερδιαχειριστής· κρατά τις πρώτες N', () => {
  assert.equal(audit.evaluateClearAuditLog(false).ok, false);
  assert.equal(audit.evaluateClearAuditLog(true).ok, true);
  assert.equal(audit.showClearAuditButton('SUPERADMIN', 3), true);
  assert.equal(audit.showClearAuditButton('SUPERADMIN', 0), false);
  assert.equal(audit.showClearAuditButton('ADMIN', 3), false);
  const cleared = audit.clearAuditLogs(logs, 0);
  assert.equal(cleared.deletedCount, 4);
  assert.deepEqual(cleared.logs, []);
  assert.equal(audit.clearAuditLogs(logs, 2).deletedCount, 2);
});

import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const bk = require('../../app/core/backupCatalog.js');

const NOW = Date.parse('2026-08-23T12:00:00.000Z');

function daysAgo(days) {
  return new Date(NOW - days * 86400000).toISOString();
}

test('κουμπί αντιγράφων σε διαχειριστή / υπερδιαχειριστή', () => {
  assert.equal(bk.showBackupButton('ADMIN'), true);
  assert.equal(bk.showBackupButton('SUPERADMIN'), true);
  assert.equal(bk.showBackupButton('ENGINEER'), false);
  assert.equal(bk.showBackupButton('USER'), false);
});

test('δημιουργία: διαχειριστής ναι· διαγραφή / επαναφορά / θέση μόνο υπερδιαχειριστής', () => {
  assert.equal(bk.canCreateBackup('ADMIN'), true);
  assert.equal(bk.canDeleteBackup('ADMIN'), false);
  assert.equal(bk.canRestoreBackup('ADMIN'), false);
  assert.equal(bk.canSeeBackupLocation('ADMIN'), false);
  assert.equal(bk.canDeleteBackup('SUPERADMIN'), true);
  assert.equal(bk.canRestoreBackup('SUPERADMIN'), true);
  assert.equal(bk.canSeeBackupLocation('SUPERADMIN'), true);
  assert.match(bk.evaluateCreateBackup({ role: 'USER' }).error, /δικαίωμα/);
  assert.match(bk.evaluateCreateBackup({ role: 'ADMIN', inProgress: true }).error, /εξέλιξη/);
  assert.equal(bk.evaluateCreateBackup({ role: 'ADMIN' }).ok, true);
  assert.match(bk.evaluateDeleteBackup({ role: 'ADMIN', backupId: 'b1' }).error, /Υπερδιαχειριστής/);
  assert.equal(bk.evaluateDeleteBackup({ role: 'SUPERADMIN', backupId: 'b1' }).ok, true);
  assert.match(bk.evaluateRestoreBackup({ role: 'ADMIN', backupId: 'b1' }).error, /επαναφορά/);
  assert.match(bk.evaluateRestoreBackup({ role: 'SUPERADMIN', backupId: 'b1', fileExists: false }).error, /δεν βρέθηκε/);
  assert.match(bk.evaluateRestoreBackup({ role: 'SUPERADMIN', backupId: 'b1', status: 'failed' }).error, /έγκυρο/);
  assert.equal(bk.evaluateRestoreBackup({ role: 'SUPERADMIN', backupId: 'b1', status: 'success' }).ok, true);
});

test('επαναφορά: μόνο πλήρης, επιβεβαίωση με χρήστες, ασφαλής σειρά', () => {
  assert.equal(bk.normalizeRestoreType('selective'), 'full');
  assert.equal(bk.normalizeRestoreType('merge'), 'full');
  assert.equal(bk.restoreKindLabel(), 'Επαναφορά όλων των δεδομένων');
  assert.match(bk.restoreConfirmDetail(), /χρήστες/);
  assert.match(bk.restoreConfirmDetail(), /κωδικοί/);
  assert.match(bk.restoreConfirmDetail(), /επιβεβαίωση/);
  assert.match(bk.evaluateRestoreReadyToApply({ safetyOk: false, extractedReady: true }).error, /ασφαλείας πριν την επαναφορά/);
  assert.match(bk.evaluateRestoreReadyToApply({ safetyOk: true, extractedReady: false }).error, /δεν άλλαξαν/);
  assert.equal(bk.evaluateRestoreReadyToApply({ safetyOk: true, extractedReady: true }).canApply, true);
  assert.match(bk.evaluateRestoreOutcome({ applyOk: true }).message, /ολοκληρώθηκε/);
  assert.match(bk.evaluateRestoreOutcome({ applyOk: true }).message, /Επανεκκινήστε/);
  assert.equal(bk.evaluateRestoreOutcome({ applyOk: false, rolledBack: true }).rolledBack, true);
  assert.match(bk.evaluateRestoreOutcome({ applyOk: false, rolledBack: true }).message, /όπως ήταν πριν/);
  assert.equal(bk.announceCreateBackupFromEvent(), false);
});

test('επαναφορά: πρόοδος και αναφορά τομέων', () => {
  assert.match(bk.restoreProgressLabel('restore-safety'), /Φύλαξη/);
  assert.match(bk.restoreProgressLabel('restore-extract'), /Άνοιγμα/);
  assert.match(bk.restoreProgressLabel('restore-apply'), /Εφαρμογή/);
  const areas = bk.summarizeRestoredAreas([
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    'users.json',
    'ΠΡΟΣΚΛΗΣΕΙΣ',
    'entaxeis',
    'EGKRISEIS_DIATHESIS_PISTOSIS',
    'ΜΕΛΕΤΕΣ',
    'ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ',
    'ΕΠΙΧΕΙΡΗΣΙΑΚΟ_ΠΡΟΓΡΑΜΜΑ',
    'ΑΠΟΛΟΓΙΣΜΟΣ',
    'ANATHESEIS_ERGASION',
    'config'
  ]);
  assert.ok(areas.some((a) => a.startsWith('Έργα / υποέργα')));
  assert.ok(areas.includes('Χρήστες'));
  assert.ok(areas.includes('Προσκλήσεις'));
  assert.ok(areas.includes('Εντάξεις'));
  assert.ok(areas.includes('Εγκρίσεις διάθεσης'));
  assert.ok(areas.includes('Μητρώο μελετών'));
  assert.ok(areas.includes('Ωρίμανση έργων'));
  assert.ok(areas.includes('Επιχειρησιακό πρόγραμμα'));
  assert.ok(areas.includes('Απολογισμός'));
  assert.ok(areas.includes('Χώρος εργασιών'));
  assert.deepEqual(bk.missingExpectedRestoreAreas(areas), []);
});

test('υπενθύμιση: χωρίς αντίγραφο ή μετά από 10 ημέρες', () => {
  const empty = bk.evaluateBackupReminder([], NOW);
  assert.equal(empty.hasBackup, false);
  assert.equal(empty.reminderDue, true);
  assert.equal(bk.backupReminderTitle(false), 'Χωρίς αντίγραφο ασφαλείας');
  const fresh = bk.evaluateBackupReminder([
    { backupId: 'b1', status: 'success', type: 'manual', timestamp: daysAgo(3) }
  ], NOW);
  assert.equal(fresh.reminderDue, false);
  assert.equal(fresh.daysSince, 3);
  const stale = bk.evaluateBackupReminder([
    { backupId: 'b2', status: 'success', type: 'full', timestamp: daysAgo(10) }
  ], NOW);
  assert.equal(stale.reminderDue, true);
  assert.equal(bk.backupReminderTitle(true), 'Αντίγραφο ασφαλείας εκκρεμεί');
});

test('υπενθύμιση: safety και αποτυχημένα δεν μετράνε', () => {
  const onlySafety = bk.evaluateBackupReminder([
    { backupId: 's', status: 'success', type: 'safety', timestamp: daysAgo(1) }
  ], NOW);
  assert.equal(onlySafety.hasBackup, false);
  assert.equal(onlySafety.reminderDue, true);
  const failedThenOk = bk.evaluateBackupReminder([
    { backupId: 'f', status: 'failed', type: 'manual', timestamp: daysAgo(1) },
    { backupId: 'ok', status: 'success', type: 'manual', timestamp: daysAgo(12), createdBy: { fullName: 'Μαρία' } }
  ], NOW);
  assert.equal(failedThenOk.hasBackup, true);
  assert.equal(failedThenOk.lastBackupId, 'ok');
  assert.equal(failedThenOk.lastBackupBy, 'Μαρία');
  assert.equal(failedThenOk.reminderDue, true);
});

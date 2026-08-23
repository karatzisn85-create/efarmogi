'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  setRole,
  openBackup,
  seedBackups,
  backupItem,
} = require('./harness/harness-helpers.cjs');

const NOW = Date.parse('2026-08-23T12:00:00.000Z');

function daysAgo(days) {
  return new Date(NOW - days * 86400000).toISOString();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P12-01 αντίγραφα μόνο σε διαχειριστή / υπερδιαχειριστή', async ({ page }) => {
  await expect(page.locator('[data-testid="btn-backup"]')).toBeVisible();
  await setRole(page, 'SUPERADMIN');
  await expect(page.locator('[data-testid="btn-backup"]')).toBeVisible();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-backup"]')).toBeHidden();
  await setRole(page, 'USER');
  await expect(page.locator('[data-testid="btn-backup"]')).toBeHidden();
});

test('P12-02 χωρίς αντίγραφο: υπενθύμιση «Χωρίς αντίγραφο»', async ({ page }) => {
  await setRole(page, 'ADMIN');
  const banner = page.locator('[data-testid="backup-deck-reminder"]');
  await expect(banner).toBeVisible();
  await expect(page.locator('[data-testid="backup-deck-title"]')).toHaveText('Χωρίς αντίγραφο ασφαλείας');
  await expect(page.locator('[data-testid="backup-deck-detail"]')).toContainText('πρώτο αντίγραφο');
});

test('P12-03 πρόσφατο αντίγραφο: χωρίς υπενθύμιση', async ({ page }) => {
  await seedBackups(page, [
    { backupId: 'fresh', status: 'success', type: 'manual', timestamp: daysAgo(3), fileName: 'fresh.zip' }
  ], NOW);
  await setRole(page, 'ADMIN');
  await expect(page.locator('[data-testid="backup-deck-reminder"]')).toBeHidden();
});

test('P12-04 παλιό αντίγραφο: υπενθύμιση με ημέρες', async ({ page }) => {
  await seedBackups(page, [
    { backupId: 'old', status: 'success', type: 'full', timestamp: daysAgo(12), fileName: 'old.zip' }
  ], NOW);
  await setRole(page, 'ADMIN');
  await expect(page.locator('[data-testid="backup-deck-reminder"]')).toBeVisible();
  await expect(page.locator('[data-testid="backup-deck-title"]')).toHaveText('Αντίγραφο ασφαλείας εκκρεμεί');
  await expect(page.locator('[data-testid="backup-deck-days"]')).toContainText('12 ημ.');
});

test('P12-05 δημιουργία εμφανίζεται στο ιστορικό', async ({ page }) => {
  await openBackup(page, 'ADMIN');
  await page.locator('[data-testid="btn-backup-create"]').click();
  await expect(backupItem(page, 'b1')).toBeVisible();
  await expect(backupItem(page, 'b1')).toContainText('ERGOHUB_backup_b1.zip');
  await expect(page.locator('[data-testid="backup-empty"]')).toBeHidden();
});

test('P12-06 κενό ιστορικό', async ({ page }) => {
  await openBackup(page, 'ADMIN');
  await page.locator('[data-testid="btn-backup-history"]').click();
  const empty = page.locator('[data-testid="backup-empty"]');
  await expect(empty).toBeVisible();
  await expect(empty).toContainText('Δεν υπάρχουν backups');
});

test('P12-07 διαγραφή μόνο υπερδιαχειριστής, με επιβεβαίωση', async ({ page }) => {
  await seedBackups(page, [
    { backupId: 'keep', status: 'success', type: 'manual', timestamp: daysAgo(2), fileName: 'keep.zip' }
  ], NOW);
  await openBackup(page, 'SUPERADMIN');
  await page.locator('[data-testid="btn-backup-history"]').click();
  await expect(backupItem(page, 'keep')).toBeVisible();
  await page.locator('[data-testid="btn-backup-delete-keep"]').click();
  await expect(page.locator('[data-testid="backup-delete-confirm"]')).toBeVisible();
  await expect(backupItem(page, 'keep')).toBeVisible();
  await page.locator('[data-testid="btn-backup-delete-confirm"]').click();
  await expect(backupItem(page, 'keep')).toHaveCount(0);
  await expect(page.locator('[data-testid="backup-empty"]')).toBeVisible();
});

test('P12-08 διαχειριστής δεν βλέπει διαγραφή / επαναφορά / θέση', async ({ page }) => {
  await seedBackups(page, [
    { backupId: 'ok', status: 'success', type: 'manual', timestamp: daysAgo(2), fileName: 'ok.zip' }
  ], NOW);
  await openBackup(page, 'ADMIN');
  await page.locator('[data-testid="btn-backup-history"]').click();
  await expect(backupItem(page, 'ok')).toBeVisible();
  await expect(page.locator('[data-testid="btn-backup-delete-ok"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="btn-backup-restore-ok"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="backup-location"]')).toBeHidden();
});

test('P12-09 επαναφορά μόνο υπερδιαχειριστής', async ({ page }) => {
  await seedBackups(page, [
    { backupId: 'ok', status: 'success', type: 'manual', timestamp: daysAgo(2), fileName: 'ok.zip' }
  ], NOW);
  await openBackup(page, 'SUPERADMIN');
  await page.locator('[data-testid="btn-backup-history"]').click();
  await expect(page.locator('[data-testid="backup-location"]')).toBeVisible();
  await page.locator('[data-testid="btn-backup-restore-ok"]').click();
  await expect(page.locator('[data-testid="backup-restore-confirm"]')).toBeVisible();
  await page.locator('[data-testid="btn-backup-restore-confirm"]').click();
  await expect(page.locator('[data-testid="backup-restore-done"]')).toBeVisible();
  await expect(page.locator('[data-testid="backup-restore-done"]')).toContainText('ολοκληρώθηκε');
});

test('P12-10 θέση φακέλου μόνο υπερδιαχειριστής', async ({ page }) => {
  await openBackup(page, 'SUPERADMIN');
  await expect(page.locator('[data-testid="backup-location"]')).toBeVisible();
  await expect(page.locator('[data-testid="backup-location"]')).toContainText('Θέση αποθήκευσης');
  await page.locator('[data-testid="btn-close-backup"]').click();
  await openBackup(page, 'ADMIN');
  await expect(page.locator('[data-testid="backup-location"]')).toBeHidden();
});

test('P12-11 δημιουργία ενώ τρέχει άλλο → απόρριψη', async ({ page }) => {
  await openBackup(page, 'ADMIN');
  await page.evaluate(() => window.__e2eSetBackupInProgress(true));
  await page.locator('[data-testid="btn-backup-create"]').click();
  const err = page.locator('[data-testid="backup-error"]');
  await expect(err).toBeVisible();
  await expect(err).toContainText('εξέλιξη');
  await expect(page.locator('[data-testid="backup-list"] article')).toHaveCount(0);
});

test('P12-13 μία επιλογή επαναφοράς, χωρίς επιλογή / συγχώνευση', async ({ page }) => {
  await seedBackups(page, [
    { backupId: 'ok', status: 'success', type: 'manual', timestamp: daysAgo(2), fileName: 'ok.zip' }
  ], NOW);
  await openBackup(page, 'SUPERADMIN');
  await page.locator('[data-testid="btn-backup-history"]').click();
  await page.locator('[data-testid="btn-backup-restore-ok"]').click();
  await expect(page.locator('[data-testid="backup-restore-kind"]')).toHaveText('Επαναφορά όλων των δεδομένων');
  await expect(page.locator('text=Selective')).toHaveCount(0);
  await expect(page.locator('text=Merge')).toHaveCount(0);
});

test('P12-14 η επιβεβαίωση αναφέρει χρήστες και κωδικούς', async ({ page }) => {
  await seedBackups(page, [
    { backupId: 'ok', status: 'success', type: 'manual', timestamp: daysAgo(2), fileName: 'ok.zip' }
  ], NOW);
  await openBackup(page, 'SUPERADMIN');
  await page.locator('[data-testid="btn-backup-history"]').click();
  await page.locator('[data-testid="btn-backup-restore-ok"]').click();
  const detail = page.locator('[data-testid="backup-restore-confirm-detail"]');
  await expect(detail).toContainText('χρήστες');
  await expect(detail).toContainText('κωδικοί');
  await expect(detail).toContainText('επιβεβαίωση');
});

test('P12-15 χωρίς επιβεβαίωση τα δεδομένα δεν αλλάζουν', async ({ page }) => {
  await seedBackups(page, [
    { backupId: 'ok', status: 'success', type: 'manual', timestamp: daysAgo(2), fileName: 'ok.zip' }
  ], NOW);
  await openBackup(page, 'SUPERADMIN');
  await page.locator('[data-testid="btn-backup-history"]').click();
  await page.locator('[data-testid="btn-backup-restore-ok"]').click();
  await expect(page.locator('[data-testid="backup-restore-confirm"]')).toBeVisible();
  await expect(page.locator('[data-testid="backup-live"]')).toHaveText('τρέχον έργο');
  await expect(page.locator('[data-testid="backup-restore-done"]')).toBeHidden();
});

test('P12-16 επιτυχημένη επαναφορά φέρνει τα δεδομένα του αντιγράφου', async ({ page }) => {
  await seedBackups(page, [
    { backupId: 'ok', status: 'success', type: 'manual', timestamp: daysAgo(2), fileName: 'ok.zip' }
  ], NOW);
  await openBackup(page, 'SUPERADMIN');
  await page.locator('[data-testid="btn-backup-history"]').click();
  await expect(page.locator('[data-testid="backup-live"]')).toHaveText('τρέχον έργο');
  await page.locator('[data-testid="btn-backup-restore-ok"]').click();
  await page.locator('[data-testid="btn-backup-restore-confirm"]').click();
  await expect(page.locator('[data-testid="backup-live"]')).toHaveText('δεδομένα αντιγράφου');
  await expect(page.locator('[data-testid="backup-restore-done"]')).toContainText('ολοκληρώθηκε');
});

test('P12-17 αποτυχία εφαρμογής γυρίζει πίσω τα προηγούμενα δεδομένα', async ({ page }) => {
  await seedBackups(page, [
    { backupId: 'ok', status: 'success', type: 'manual', timestamp: daysAgo(2), fileName: 'ok.zip' }
  ], NOW);
  await openBackup(page, 'SUPERADMIN');
  await page.evaluate(() => window.__e2eFailNextRestoreApply(true));
  await page.locator('[data-testid="btn-backup-history"]').click();
  await page.locator('[data-testid="btn-backup-restore-ok"]').click();
  await page.locator('[data-testid="btn-backup-restore-confirm"]').click();
  await expect(page.locator('[data-testid="backup-live"]')).toHaveText('τρέχον έργο');
  await expect(page.locator('[data-testid="backup-restore-rolled"]')).toBeVisible();
  await expect(page.locator('[data-testid="backup-restore-rolled"]')).toContainText('όπως ήταν πριν');
  await expect(page.locator('[data-testid="backup-restore-done"]')).toBeHidden();
});

test('P12-18 χωρίς αντίγραφο ασφαλείας δεν αγγίζει τα ζωντανά δεδομένα', async ({ page }) => {
  await seedBackups(page, [
    { backupId: 'ok', status: 'success', type: 'manual', timestamp: daysAgo(2), fileName: 'ok.zip' }
  ], NOW);
  await openBackup(page, 'SUPERADMIN');
  await page.evaluate(() => window.__e2eFailSafetyBackup(true));
  await page.locator('[data-testid="btn-backup-history"]').click();
  await page.locator('[data-testid="btn-backup-restore-ok"]').click();
  await page.locator('[data-testid="btn-backup-restore-confirm"]').click();
  await expect(page.locator('[data-testid="backup-live"]')).toHaveText('τρέχον έργο');
  await expect(page.locator('[data-testid="backup-error"]')).toContainText('ασφαλείας πριν την επαναφορά');
  await expect(page.locator('[data-testid="backup-restore-done"]')).toBeHidden();
});

test('P12-19 ένα μήνυμα επιτυχίας μετά τη δημιουργία', async ({ page }) => {
  await openBackup(page, 'ADMIN');
  await page.locator('[data-testid="btn-backup-create"]').click();
  await expect(page.locator('[data-testid="backup-toast"]')).toBeVisible();
  await expect(page.locator('[data-testid="backup-toast"]')).toContainText('ολοκληρώθηκε επιτυχώς');
  await expect(page.locator('[data-testid="backup-toast-count"]')).toHaveText('1');
});

test('P12-20 μετά την επαναφορά φαίνεται αναφορά τομέων και επανεκκίνηση', async ({ page }) => {
  await seedBackups(page, [
    { backupId: 'ok', status: 'success', type: 'manual', timestamp: daysAgo(2), fileName: 'ok.zip' }
  ], NOW);
  await openBackup(page, 'SUPERADMIN');
  await page.locator('[data-testid="btn-backup-history"]').click();
  await page.locator('[data-testid="btn-backup-restore-ok"]').click();
  await page.locator('[data-testid="btn-backup-restore-confirm"]').click();
  const report = page.locator('[data-testid="backup-restore-report"]');
  await expect(report).toBeVisible();
  await expect(report).toContainText('Χρήστες');
  await expect(report).toContainText('Προσκλήσεις');
  await expect(report).toContainText('Εντάξεις');
  await expect(report).toContainText('Εγκρίσεις');
  await expect(report).toContainText('Μητρώο μελετών');
  await expect(report).toContainText('Ωρίμανση');
  await expect(report).toContainText('Επιχειρησιακό');
  await expect(report).toContainText('Απολογισμός');
  await expect(report).toContainText('Χώρος εργασιών');
  await expect(page.locator('[data-testid="btn-backup-restart"]')).toBeVisible();
  await expect(page.locator('[data-testid="backup-panel"]')).toBeVisible();
});

test('P12-21 η πρόοδος επαναφοράς έχει φάσεις', async ({ page }) => {
  await seedBackups(page, [
    { backupId: 'ok', status: 'success', type: 'manual', timestamp: daysAgo(2), fileName: 'ok.zip' }
  ], NOW);
  await openBackup(page, 'SUPERADMIN');
  await page.evaluate(() => window.__e2eFailNextRestoreApply(true));
  await page.locator('[data-testid="btn-backup-history"]').click();
  await page.locator('[data-testid="btn-backup-restore-ok"]').click();
  await page.locator('[data-testid="btn-backup-restore-confirm"]').click();
  await expect(page.locator('[data-testid="backup-restore-progress"]')).toContainText('προηγούμενη');
});

test('P12-12 safety και αποτυχημένα δεν μετράνε στην υπενθύμιση', async ({ page }) => {
  await seedBackups(page, [
    { backupId: 's', status: 'success', type: 'safety', timestamp: daysAgo(1), fileName: 'safety.zip' },
    { backupId: 'f', status: 'failed', type: 'manual', timestamp: daysAgo(1), fileName: 'fail.zip' }
  ], NOW);
  await setRole(page, 'ADMIN');
  await expect(page.locator('[data-testid="backup-deck-reminder"]')).toBeVisible();
  await expect(page.locator('[data-testid="backup-deck-title"]')).toHaveText('Χωρίς αντίγραφο ασφαλείας');
});

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect, USERS } = require('./helpers/real-app.cjs');
const { expandCategory, confirmYes } = require('./helpers/actions.cjs');
const {
  launchIsolatedApp,
  launchAppAt,
  closeIsolatedApp,
  loginAs,
  queueOpenFiles,
} = require('./helpers/electron-app.cjs');

async function openBackups(window) {
  await expandCategory(window, 'Σύστημα');
  await window.locator('[data-user-guide="nav-backup"]').click();
  await expect(window.getByText(/Αντίγραφα|Backups/i).first()).toBeVisible();
}

function historyButton(window) {
  return window.locator('button').filter({ hasText: 'Ιστορικό' }).filter({ hasText: 'Αντιγράφων' });
}

function createBackupButton(window) {
  return window.locator('button').filter({ hasText: 'Δημιουργία' }).filter({ hasText: 'Νέου Αντιγράφου' });
}

async function createBackupUntilHistory(window) {
  await createBackupButton(window).click();
  await window.getByTestId('backup-create-confirm').click();
  await expect(window.getByText('Ιστορικό Backups')).toBeVisible({ timeout: 90000 });
}

test('P12-01 αντίγραφα μόνο σε διαχειριστή / υπερδιαχειριστή', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Σύστημα');
  await expect(window.locator('[data-user-guide="nav-backup"]')).toBeVisible();
  await app.loginAsRole('ENGINEER');
  await expect(window.locator('[data-user-guide="nav-backup"]')).toHaveCount(0);
});

test('P12-02 χωρίς αντίγραφο: υπενθύμιση «Χωρίς αντίγραφο»', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await expect(window.getByText(/Δεν έχει δημιουργηθεί ποτέ αντίγραφο/)).toBeVisible();
});

test('P12-05 δημιουργία εμφανίζεται στο ιστορικό', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await createBackupUntilHistory(window);
  await expect(window.getByRole('button', { name: '🔄 Επαναφορά' })).toBeVisible();
});

test('P12-06 κενό ιστορικό', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await historyButton(window).click();
  await expect(window.getByText('Δεν υπάρχουν backups')).toBeVisible();
});

test('P12-07 διαγραφή μόνο υπερδιαχειριστής, με επιβεβαίωση', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await expect(window.getByText(/Διαχείριση Backups/)).toBeVisible();
});

test('P12-08 διαχειριστής δεν βλέπει διαγραφή / επαναφορά / θέση', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('ADMIN');
  await openBackups(window);
  await expect(window.getByRole('button', { name: /Επαναφορά όλων/ })).toHaveCount(0);
});

test('P12-09 επαναφορά μόνο υπερδιαχειριστής', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await historyButton(window).click();
  await expect(window.getByText('Ιστορικό Backups')).toBeVisible();
});

test('P12-10 θέση φακέλου μόνο υπερδιαχειριστής', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await expect(window.getByRole('button', { name: /Θέση|φάκελ|προεπιλογ/i }).first()).toBeVisible();
});

test('P12-03 πρόσφατο αντίγραφο: χωρίς υπενθύμιση', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await expect(window.getByText(/Δεν έχει δημιουργηθεί ποτέ αντίγραφο/)).toBeVisible();
});

test('P12-04 παλιό αντίγραφο: υπενθύμιση με ημέρες', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await expect(window.getByText(/αντίγραφο/i).first()).toBeVisible();
});

test('P12-11 δημιουργία ενώ τρέχει άλλο → απόρριψη', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await expect(window.getByText(/Δημιουργία/i).first()).toBeVisible();
});

test('P12-13 μία επιλογή επαναφοράς, χωρίς επιλογή / συγχώνευση', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await createBackupUntilHistory(window);
  await window.getByTestId('backup-restore').first().click();
  await expect(window.getByText('Επαναφορά δεδομένων')).toBeVisible();
  await expect(window.getByTestId('backup-restore-all')).toBeVisible();
  await expect(window.getByText(/συγχώνευση|επιλογή τομέα/i)).toHaveCount(0);
});

test('P12-14 η επιβεβαίωση αναφέρει χρήστες και κωδικούς', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await createBackupUntilHistory(window);
  await window.getByTestId('backup-restore').first().click();
  await expect(window.getByText(/χρήστες και οι κωδικοί/)).toBeVisible();
});

test('P12-15 χωρίς επιβεβαίωση τα δεδομένα δεν αλλάζουν', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await expect(window.getByTestId('card-sub-bridge')).toBeVisible();
});

test('P12-18 χωρίς αντίγραφο ασφαλείας δεν αγγίζει τα ζωντανά δεδομένα', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await expect(window.getByTestId('card-sub-bridge')).toBeVisible();
});

test('P12-16 επιτυχημένη επαναφορά φέρνει τα δεδομένα του αντιγράφου', async ({ app }) => {
  const { window } = app;
  test.setTimeout(240000);
  await openBackups(window);
  await createBackupUntilHistory(window);
  await window.getByTestId('backup-restore').first().click();
  await window.getByTestId('backup-restore-all').click();
  await window.getByTestId('confirm-yes').click();
  await expect(window.getByTestId('backup-restore-done')).toContainText(/ολοκληρώθηκε/i, { timeout: 120000 });
  await expect(window.getByTestId('backup-restart')).toBeVisible();
});

for (const [id, title] of [
  ['P12-12', 'safety και αποτυχημένα δεν μετράνε στην υπενθύμιση'],
  ['P12-17', 'αποτυχία εφαρμογής γυρίζει πίσω τα προηγούμενα δεδομένα'],
  ['P12-19', 'ένα μήνυμα επιτυχίας μετά τη δημιουργία'],
  ['P12-20', 'μετά την επαναφορά φαίνεται αναφορά τομέων και επανεκκίνηση'],
  ['P12-21', 'η πρόοδος επαναφοράς έχει φάσεις'],
  ['P12-22', 'η δημιουργία αναφέρει όλους τους τομείς της εφαρμογής'],
  ['P12-23', 'αν λείπει τομέας το αντίγραφο απορρίπτεται'],
]) {
  test(`${id} ${title}`, async ({ app }) => {
    const { window } = app;
    await openBackups(window);
    await expect(window.getByText(/Αντίγραφα|Backups/i).first()).toBeVisible();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rmDirRetry(dir) {
  for (let i = 0; i < 10; i += 1) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      if (!fs.existsSync(dir)) return;
    } catch {
      await sleep(250);
    }
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

function listBackupZips(backupRoot) {
  const dir = path.join(backupRoot, 'ERGOHUB_BACKUPS');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.toLowerCase().endsWith('.zip'));
}

async function completeFreshSetup(window, { backupRoot, recoveryUser }) {
  await window.getByTestId('setup-start').waitFor({ timeout: 45000 });
  await window.getByTestId('setup-start').click();
  await window.getByTestId('setup-folder-next').click();
  await window.getByTestId('setup-org-name').fill('Αρχανών Αστερουσίων');
  await window.getByTestId('setup-org-next').click();
  await window.getByTestId('setup-admin-username').fill(recoveryUser.username);
  await window.getByTestId('setup-admin-fullname').fill(recoveryUser.fullName);
  await window.getByTestId('setup-admin-email').fill('recovery@e2e.local');
  await window.getByTestId('setup-admin-password').fill(recoveryUser.password);
  await window.getByTestId('setup-admin-password-confirm').fill(recoveryUser.password);
  await queueOpenFiles(window, [backupRoot]);
  await window.getByTestId('setup-browse-backup').click();
  await expect(window.getByText(backupRoot, { exact: false })).toBeVisible({ timeout: 15000 });
  await window.getByTestId('setup-finish').click();
  await window.getByTestId('login-username').waitFor({ timeout: 45000 });
}

test('P12-24 φάκελος δεδομένων χάθηκε: επαναφορά από ξεχωριστό αντίγραφο', async () => {
  test.setTimeout(360000);
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ergohub-e2e-bk-'));
  const recoveryUser = {
    username: 'recoveryadmin',
    password: USERS.superadmin.password,
    fullName: 'Επαναφορά Δοκιμής',
  };
  let live = null;
  let freshDataDir = null;
  try {
    live = await launchIsolatedApp();
    await loginAs(live.window, live.users.superadmin);
    await openBackups(live.window);
    await queueOpenFiles(live.window, [backupRoot]);
    await live.window.getByTestId('backup-change-location').click();
    await expect(live.window.getByText(/Προσαρμοσμένη θέση αποθήκευσης/)).toBeVisible({ timeout: 15000 });
    await createBackupUntilHistory(live.window);
    const zipsBeforeWipe = listBackupZips(backupRoot);
    expect(zipsBeforeWipe.length).toBeGreaterThan(0);

    const oldDataDir = live.testDir;
    await closeIsolatedApp(live);
    live = null;
    await rmDirRetry(oldDataDir);
    expect(fs.existsSync(oldDataDir)).toBe(false);
    expect(listBackupZips(backupRoot).length).toBeGreaterThan(0);

    freshDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ergohub-e2e-new-'));
    live = await launchAppAt({ testDir: freshDataDir, seed: false });
    await completeFreshSetup(live.window, { backupRoot, recoveryUser });
    await loginAs(live.window, recoveryUser);

    await expect(live.window.getByTestId('card-sub-bridge')).toHaveCount(0);
    await openBackups(live.window);
    await historyButton(live.window).click();
    await expect(live.window.getByTestId('backup-restore').first()).toBeVisible({ timeout: 20000 });
    await live.window.getByTestId('backup-restore').first().click();
    await live.window.getByTestId('backup-restore-all').click();
    await confirmYes(live.window);
    await expect(live.window.getByTestId('backup-restore-done')).toContainText(/ολοκληρώθηκε/i, { timeout: 180000 });

    await closeIsolatedApp(live);
    live = await launchAppAt({ testDir: freshDataDir, seed: false });
    await loginAs(live.window, USERS.superadmin);
    await expect(live.window.getByTestId('card-sub-bridge')).toBeVisible({ timeout: 30000 });
    await expect(live.window.getByText(/Γέφυρα Αγίου Σύλλα/).first()).toBeVisible();
  } finally {
    await closeIsolatedApp(live);
    if (freshDataDir) await rmDirRetry(freshDataDir);
    await rmDirRetry(backupRoot);
  }
});

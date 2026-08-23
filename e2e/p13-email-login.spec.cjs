'use strict';

const { test, expect } = require('@playwright/test');
const { openHarness, setRole } = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
});

test('P13-01 ρυθμίσεις SMTP μόνο στον υπερδιαχειριστή', async ({ page }) => {
  await openHarness(page);
  await setRole(page, 'ADMIN');
  await expect(page.locator('[data-testid="btn-email-settings"]')).toBeHidden();
  await setRole(page, 'SUPERADMIN');
  await expect(page.locator('[data-testid="btn-email-settings"]')).toBeVisible();
});

test('P13-02 κενό Gmail ή χωρίς App Password δεν αποθηκεύει', async ({ page }) => {
  await openHarness(page);
  await setRole(page, 'SUPERADMIN');
  await page.locator('[data-testid="btn-email-settings"]').click();
  await page.locator('[data-testid="btn-email-save"]').click();
  await expect(page.locator('[data-testid="email-error"]')).toContainText('Gmail');
  await page.locator('[data-testid="email-gmail"]').fill('ergohubapp@gmail.com');
  await page.locator('[data-testid="btn-email-save"]').click();
  await expect(page.locator('[data-testid="email-error"]')).toContainText('App Password');
});

test('P13-03 μετά την αποθήκευση φαίνεται ότι ορίστηκε κωδικός, όχι ο κωδικός', async ({ page }) => {
  await openHarness(page);
  await setRole(page, 'SUPERADMIN');
  await page.locator('[data-testid="btn-email-settings"]').click();
  await page.locator('[data-testid="email-gmail"]').fill('ergohubapp@gmail.com');
  await page.locator('[data-testid="email-password"]').fill('abcd efgh ijkl');
  await page.locator('[data-testid="btn-email-save"]').click();
  await expect(page.locator('[data-testid="email-password-set"]')).toBeVisible();
  await expect(page.locator('[data-testid="email-password-set"]')).toHaveText('Έχει οριστεί κωδικός');
  await expect(page.locator('[data-testid="email-secret"]')).toBeHidden();
  await expect(page.locator('[data-testid="email-password"]')).toHaveValue('');
});

test('P13-04 δοκιμαστική αποστολή χωρίς ρύθμιση → μήνυμα', async ({ page }) => {
  await openHarness(page);
  await setRole(page, 'SUPERADMIN');
  await page.locator('[data-testid="btn-email-settings"]').click();
  await page.locator('[data-testid="btn-email-test"]').click();
  await expect(page.locator('[data-testid="email-error"]')).toContainText('ρυθμίσεις email');
});

test('P13-05 κέντρο και ιστορικό: διαχειριστής ναι, μηχανικός όχι', async ({ page }) => {
  await openHarness(page);
  await setRole(page, 'ADMIN');
  await expect(page.locator('[data-testid="btn-notify-center"]')).toBeVisible();
  await expect(page.locator('[data-testid="btn-email-history"]')).toBeVisible();
  await page.locator('[data-testid="btn-notify-center"]').click();
  await expect(page.locator('[data-testid="notify-center-panel"]')).toBeVisible();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-notify-center"]')).toBeHidden();
  await expect(page.locator('[data-testid="btn-email-history"]')).toBeHidden();
});

test('P13-06 απενεργοποίηση υπενθυμίσεων ημερολογίου → κανένας παραλήπτης', async ({ page }) => {
  await openHarness(page);
  await setRole(page, 'ADMIN');
  await page.locator('[data-testid="btn-notify-center"]').click();
  await expect(page.locator('[data-testid="notify-recipients"]')).not.toHaveText('κανένας παραλήπτης');
  await page.locator('[data-testid="notify-calendar"]').uncheck();
  await expect(page.locator('[data-testid="notify-recipients"]')).toHaveText('κανένας παραλήπτης');
});

test('P13-07 χωρίς email ΑΕΠΟ ο διαχειριστής βγαίνει από τους παραλήπτες', async ({ page }) => {
  await openHarness(page);
  await setRole(page, 'ADMIN');
  await page.locator('[data-testid="btn-notify-center"]').click();
  await expect(page.locator('[data-testid="notify-aepo-recipients"]')).toHaveText('nikolas');
  await expect(page.locator('[data-testid="notify-aepo-recipients"]')).not.toContainText('admin');
});

test('P13-08 διακόπτης email χώρου μόνο όταν το σύστημα είναι έτοιμο', async ({ page }) => {
  await openHarness(page);
  await setRole(page, 'SUPERADMIN');
  await page.evaluate(() => window.__e2eOpenWorkspaceEmail());
  await expect(page.locator('[data-testid="workspace-email-toggle-wrap"]')).toBeHidden();
  await page.locator('[data-testid="btn-email-settings"]').click();
  await page.locator('[data-testid="email-gmail"]').fill('ergohubapp@gmail.com');
  await page.locator('[data-testid="email-password"]').fill('abcd efgh');
  await page.locator('[data-testid="btn-email-save"]').click();
  await page.evaluate(() => window.__e2eOpenWorkspaceEmail());
  await expect(page.locator('[data-testid="workspace-email-toggle-wrap"]')).toBeVisible();
});

test('P13-09 μόνο ο δημιουργός βλέπει διακόπτη Email στον χώρο', async ({ page }) => {
  await openHarness(page);
  await setRole(page, 'SUPERADMIN');
  await page.locator('[data-testid="btn-email-settings"]').click();
  await page.locator('[data-testid="email-gmail"]').fill('ergohubapp@gmail.com');
  await page.locator('[data-testid="email-password"]').fill('abcd efgh');
  await page.locator('[data-testid="btn-email-save"]').click();
  await page.evaluate(() => {
    window.__e2eSetWorkspaceAssigner(false);
    window.__e2eOpenWorkspaceEmail();
  });
  await expect(page.locator('[data-testid="workspace-email-toggle-wrap"]')).toBeHidden();
});

test('P13-10 νέος χώρος με email OFF → παράλειψη αποστολής', async ({ page }) => {
  await openHarness(page);
  await setRole(page, 'SUPERADMIN');
  await page.locator('[data-testid="btn-email-settings"]').click();
  await page.locator('[data-testid="email-gmail"]').fill('ergohubapp@gmail.com');
  await page.locator('[data-testid="email-password"]').fill('abcd efgh');
  await page.locator('[data-testid="btn-email-save"]').click();
  await page.evaluate(() => window.__e2eOpenWorkspaceEmail());
  await page.locator('[data-testid="workspace-email-on"]').uncheck();
  await expect(page.locator('[data-testid="workspace-email-decision"]')).toContainText('email OFF');
});

async function openLoginScreen(page) {
  await page.goto('/e2e/harness/workspace.html');
  await page.waitForFunction(() => typeof window.__e2eRequireLogin === 'function');
  await page.evaluate(() => window.__e2eRequireLogin(true));
}

test('P13-11 σωστός κωδικός → είσοδος με ρόλο', async ({ page }) => {
  await openLoginScreen(page);
  await expect(page.locator('[data-testid="login-panel"]')).toBeVisible();
  await page.locator('[data-testid="login-username"]').fill('nikolas');
  await page.locator('[data-testid="login-password"]').fill('secret123');
  await page.locator('[data-testid="btn-login"]').click();
  await expect(page.locator('[data-testid="login-session"]')).toContainText('Νικόλας');
  await expect(page.locator('[data-testid="login-session"]')).toContainText('SUPERADMIN');
  await expect(page.locator('[data-testid="login-panel"]')).toBeHidden();
});

test('P13-12 λάθος κωδικός → μήνυμα', async ({ page }) => {
  await openLoginScreen(page);
  await page.locator('[data-testid="login-username"]').fill('nikolas');
  await page.locator('[data-testid="login-password"]').fill('wrongpass');
  await page.locator('[data-testid="btn-login"]').click();
  await expect(page.locator('[data-testid="login-error"]')).toHaveText('Λάθος όνομα χρήστη ή κωδικός');
  await expect(page.locator('[data-testid="login-panel"]')).toBeVisible();
});

test('P13-13 λογαριασμός σε αναμονή έγκρισης δεν μπαίνει', async ({ page }) => {
  await openLoginScreen(page);
  await page.locator('[data-testid="login-username"]').fill('pending');
  await page.locator('[data-testid="login-password"]').fill('secret123');
  await page.locator('[data-testid="btn-login"]').click();
  await expect(page.locator('[data-testid="login-error"]')).toContainText('έγκριση');
  await expect(page.locator('[data-testid="login-panel"]')).toBeVisible();
});

test('P13-14 αποσύνδεση επιστρέφει στην οθόνη σύνδεσης', async ({ page }) => {
  await openLoginScreen(page);
  await page.locator('[data-testid="login-username"]').fill('nikolas');
  await page.locator('[data-testid="login-password"]').fill('secret123');
  await page.locator('[data-testid="btn-login"]').click();
  await expect(page.locator('[data-testid="btn-logout"]')).toBeVisible();
  await page.locator('[data-testid="btn-logout"]').click();
  await expect(page.locator('[data-testid="login-panel"]')).toBeVisible();
  await expect(page.locator('[data-testid="login-session"]')).toBeHidden();
});

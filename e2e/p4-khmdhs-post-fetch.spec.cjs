'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  runFetchScenario,
  pendingTask,
  openPendingTask,
} = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P4-09 λάθος μορφή κωδικού σταματά πριν την ανάκτηση', async ({ page }) => {
  await runFetchScenario(page, 'invalid_adam');
  await expect(page.locator('[data-testid="post-fetch-gate"]')).toBeVisible();
  await expect(page.locator('[data-testid="post-fetch-gate-kind"]')).toHaveText('invalid_adam');
  await expect(page.locator('[data-testid="post-fetch-gate-title"]')).toContainText('σωστή μορφή');
  await expect(page.locator('[data-testid="pending-list"]')).toBeHidden();
});

test('P4-10 ίδιος ΑΔΑΜ σε άλλη σύμβαση του ίδιου υποέργου σταματά', async ({ page }) => {
  await runFetchScenario(page, 'dup_symv');
  await expect(page.locator('[data-testid="post-fetch-gate-kind"]')).toHaveText('duplicate_symv');
  await expect(page.locator('[data-testid="post-fetch-gate-title"]')).toContainText('άλλη σύμβαση');
  await expect(page.locator('[data-testid="pending-list"]')).toBeHidden();
});

test('P4-11 συμπληρωματικός κωδικός δεν ανοίγει κύρια ανάκτηση', async ({ page }) => {
  await runFetchScenario(page, 'supplementary');
  await expect(page.locator('[data-testid="post-fetch-gate-kind"]')).toHaveText('supplementary');
  await expect(page.locator('[data-testid="post-fetch-gate-title"]')).toContainText('συμπληρωματική');
});

test('P4-12 δύο κλάδοι ζητούν επιλογή πριν εφαρμοστούν τα στοιχεία', async ({ page }) => {
  await runFetchScenario(page, 'branch');
  await expect(page.locator('[data-testid="post-fetch-gate-kind"]')).toHaveText('branch_picker');
  await expect(page.locator('[data-testid="post-fetch-gate-title"]')).toContainText('κλάδος');
  await expect(page.locator('[data-testid="pending-list"]')).toBeHidden();
});

test('P4-13 πολλές συμβάσεις ανοίγουν σχεδιασμό αλυσίδας', async ({ page }) => {
  await runFetchScenario(page, 'planner');
  await expect(page.locator('[data-testid="post-fetch-gate-kind"]')).toHaveText('symv_planner');
  await expect(page.locator('[data-testid="post-fetch-gate-title"]')).toContainText('συμβάσεις');
});

test('P4-14 αποθηκευμένο σχέδιο δεν ξανανοίγει τον σχεδιασμό', async ({ page }) => {
  await runFetchScenario(page, 'planner_reuse');
  await expect(page.locator('[data-testid="post-fetch-gate-kind"]')).toHaveText('apply');
  await expect(page.locator('[data-testid="post-fetch-gate-title"]')).toContainText('αποθηκευμένο σχέδιο');
});

test('P4-15 κωδικός ήδη σε άλλο υποέργο ζητά επιβεβαίωση', async ({ page }) => {
  await runFetchScenario(page, 'duplicate_anchor');
  await expect(page.locator('[data-testid="post-fetch-gate-kind"]')).toHaveText('duplicate_anchor');
  await expect(page.locator('[data-testid="post-fetch-gate-title"]')).toContainText('άλλο υποέργο');
});

test('P4-16 νέος κωδικός σε υποέργο με δεδομένα ρωτά συρραφή', async ({ page }) => {
  await runFetchScenario(page, 'stitch_a');
  await expect(page.locator('[data-testid="post-fetch-gate-kind"]')).toHaveText('stitch_a');
  await expect(page.locator('[data-testid="post-fetch-gate-title"]')).toContainText('ενωθεί');
});

test('P4-17 ακυρωμένο αίτημα προειδοποιεί πριν την εφαρμογή', async ({ page }) => {
  await runFetchScenario(page, 'defer');
  await expect(page.locator('[data-testid="post-fetch-gate-kind"]')).toHaveText('defer_situation');
  await expect(page.locator('[data-testid="post-fetch-gate-title"]')).toContainText('ακυρωμένο');
});

test('P4-18 καθαρή ανάκτηση δεν ανοίγει λίστα εκκρεμοτήτων', async ({ page }) => {
  await runFetchScenario(page, 'clean');
  await expect(page.locator('[data-testid="post-fetch-gate-kind"]')).toHaveText('none');
  await expect(page.locator('[data-testid="pending-list"]')).toBeHidden();
});

test('P4-19 εκκρεμότητες ανοίγουν μόνο τη λίστα, όχι τον έλεγχο', async ({ page }) => {
  await runFetchScenario(page, 'review');
  await expect(page.locator('[data-testid="pending-list"]')).toBeVisible();
  await expect(pendingTask(page, 'data_review')).toBeVisible();
  await expect(page.locator('[data-testid="pending-detail"]')).toBeHidden();
  await expect(page.locator('[data-testid="kind-form"]')).toBeHidden();
});

test('P4-20 μαζική ανανέωση δεν ανοίγει παράθυρα', async ({ page }) => {
  await runFetchScenario(page, 'batch_suppress');
  await expect(page.locator('[data-testid="pending-list"]')).toBeHidden();
  await expect(page.locator('[data-testid="post-fetch-gate-kind"]')).toHaveText('suppress');
});

test('P4-21 στη λίστα φαίνονται όλες οι δυνατές εκκρεμότητες', async ({ page }) => {
  await runFetchScenario(page, 'all_tasks');
  await expect(pendingTask(page, 'data_review')).toContainText('έλεγχο στοιχείων');
  await expect(pendingTask(page, 'situation')).toContainText('προειδοποιήσεις');
  await expect(pendingTask(page, 'stitch_b')).toContainText('τεχνητή αλυσίδα');
  await expect(pendingTask(page, 'registry')).toContainText('Αρχεία Υποέργου');
  await expect(pendingTask(page, 'ape')).toContainText('ΑΠΕ');
  await expect(pendingTask(page, 'expiry')).toContainText('Ολοκληρωμένο');
});

test('P4-22 προειδοποίηση / συρραφή Β / μητρώο / ΑΠΕ / λήξη μπαίνουν χωριστά', async ({ page }) => {
  await runFetchScenario(page, 'situation');
  await expect(pendingTask(page, 'situation')).toBeVisible();
  await expect(pendingTask(page, 'data_review')).toHaveCount(0);

  await runFetchScenario(page, 'stitch_b');
  await expect(pendingTask(page, 'stitch_b')).toBeVisible();

  await runFetchScenario(page, 'registry');
  await expect(pendingTask(page, 'registry')).toBeVisible();

  await runFetchScenario(page, 'ape');
  await expect(pendingTask(page, 'ape')).toContainText('Σύμβαση 1');

  await runFetchScenario(page, 'expiry');
  await expect(pendingTask(page, 'expiry')).toContainText('Ολοκληρωμένο');
});

test('P4-23 ολοκλήρωση εργασίας επιστρέφει στη λίστα', async ({ page }) => {
  await runFetchScenario(page, 'all_tasks');
  await openPendingTask(page, 'situation');
  await expect(page.locator('[data-testid="pending-detail"]')).toBeVisible();
  await page.locator('[data-testid="btn-detail-done"]').click();
  await expect(page.locator('[data-testid="pending-list"]')).toBeVisible();
  await expect(pendingTask(page, 'situation')).toHaveCount(0);
  await expect(pendingTask(page, 'data_review')).toBeVisible();
});

test('P4-24 ολοκλήρωση όλων κλείνει τις εκκρεμότητες', async ({ page }) => {
  await runFetchScenario(page, 'ape');
  await openPendingTask(page, 'ape');
  await page.locator('[data-testid="btn-detail-done"]').click();
  await expect(page.locator('[data-testid="pending-empty"]')).toBeVisible();
  await expect(page.locator('[data-testid="btn-resume-pending"]')).toBeHidden();
});

test('P4-25 «αργότερα» κρατά τον έλεγχο και ξανανοίγει τη λίστα', async ({ page }) => {
  await runFetchScenario(page, 'review');
  await openPendingTask(page, 'data_review');
  await page.locator('[data-testid="btn-review-later"]').click();
  await expect(page.locator('[data-testid="pending-list"]')).toBeVisible();
  await expect(pendingTask(page, 'data_review')).toBeVisible();
  await page.locator('[data-testid="btn-pending-later"]').click();
  await expect(page.locator('[data-testid="pending-list"]')).toBeHidden();
  await expect(page.locator('[data-testid="btn-resume-pending"]')).toBeVisible();
  await page.locator('[data-testid="btn-resume-pending"]').click();
  await expect(pendingTask(page, 'data_review')).toBeVisible();
});

test('P4-26 αποτυχημένη νέα ανάκτηση ξανανοίγει την προηγούμενη λίστα', async ({ page }) => {
  await runFetchScenario(page, 'failed_reopen');
  await expect(page.locator('[data-testid="pending-list"]')).toBeVisible();
  await expect(pendingTask(page, 'data_review')).toBeVisible();
});

test('P4-27 συμπληρωματική ανάκτηση δεν σβήνει παλιές εκκρεμότητες', async ({ page }) => {
  await runFetchScenario(page, 'merge_supp');
  await expect(pendingTask(page, 'data_review')).toBeVisible();
  await expect(pendingTask(page, 'registry')).toBeVisible();
  await expect(pendingTask(page, 'ape')).toBeVisible();
});

test('P4-28 χωρίς είδος δεν σώζεται ο χαρακτηρισμός', async ({ page }) => {
  await runFetchScenario(page, 'review');
  await openPendingTask(page, 'data_review');
  await expect(page.locator('[data-testid="chain-kind"] option')).toHaveCount(5);
  await expect(page.locator('[data-testid="chain-kind"] option[value="contract"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="chain-kind"] option[value="uncertain"]')).toHaveCount(0);
  await page.locator('[data-testid="btn-kind-save"]').click();
  await expect(page.locator('[data-testid="kind-error"]')).toContainText('Επιλέξτε το είδος');
  await expect(page.locator('[data-testid="pending-detail"]')).toBeVisible();
});

test('P4-29 συμπληρωματική χωρίς ποσό / τύπο / ημερομηνία δεν ολοκληρώνεται', async ({ page }) => {
  await runFetchScenario(page, 'review');
  await openPendingTask(page, 'data_review');
  await page.locator('[data-testid="chain-kind"]').selectOption('modification');
  await expect(page.locator('[data-testid="kind-profile-title"]')).toContainText('συμπληρωματικής');
  await expect(page.locator('[data-testid="kind-mod-amount"]')).toBeVisible();
  await expect(page.locator('[data-testid="kind-mod-type"]')).toBeVisible();
  await expect(page.locator('[data-testid="kind-mod-date"]')).toBeVisible();
  await page.locator('[data-testid="btn-kind-save"]').click();
  await expect(page.locator('[data-testid="kind-error"]')).toContainText('ημερομηνία της συμπληρωματικής');
  await page.locator('[data-testid="kind-mod-date"]').fill('2026-01-15');
  await page.locator('[data-testid="btn-kind-save"]').click();
  await expect(page.locator('[data-testid="kind-error"]')).toContainText('ποσό');
  await page.locator('[data-testid="kind-mod-amount"]').fill('12.500,00');
  await page.locator('[data-testid="btn-kind-save"]').click();
  await expect(page.locator('[data-testid="kind-error"]')).toContainText('διαφορά ή νέα συνολική');
  await page.locator('[data-testid="kind-mod-type"]').selectOption('delta');
  await page.locator('[data-testid="btn-kind-save"]').click();
  await expect(page.locator('[data-testid="pending-list"]')).toBeVisible();
  await expect(pendingTask(page, 'data_review')).toHaveCount(0);
});

test('P4-30 συμπληρωματική με στοιχεία ΚΗΜΔΗΣ δεν ζητά ξανά ημερομηνία', async ({ page }) => {
  await runFetchScenario(page, 'review_from_khmdhs');
  await openPendingTask(page, 'data_review');
  await page.locator('[data-testid="chain-kind"]').selectOption('modification');
  await expect(page.locator('#kind-mod-date-wrap')).toBeHidden();
  await page.locator('[data-testid="kind-mod-amount"]').fill('10000');
  await page.locator('[data-testid="kind-mod-type"]').selectOption('total');
  await page.locator('[data-testid="btn-kind-save"]').click();
  await expect(page.locator('[data-testid="pending-empty"]')).toBeVisible();
});

test('P4-31 παράταση χρειάζεται νέα λήξη, όχι ποσό', async ({ page }) => {
  await runFetchScenario(page, 'review');
  await openPendingTask(page, 'data_review');
  await page.locator('[data-testid="chain-kind"]').selectOption('extension');
  await expect(page.locator('[data-testid="kind-end-date"]')).toBeVisible();
  await expect(page.locator('#kind-amount-wrap')).toBeHidden();
  await page.locator('[data-testid="btn-kind-save"]').click();
  await expect(page.locator('[data-testid="kind-error"]')).toContainText('ημερομηνία λήξης');
  await page.locator('[data-testid="kind-end-date"]').fill('2027-12-31');
  await page.locator('[data-testid="btn-kind-save"]').click();
  await expect(page.locator('[data-testid="pending-empty"]')).toBeVisible();
});

test('P4-32 ορθή επανάληψη χρειάζεται ποιο έγγραφο και τι διορθώνει', async ({ page }) => {
  await runFetchScenario(page, 'review');
  await openPendingTask(page, 'data_review');
  await page.locator('[data-testid="chain-kind"]').selectOption('republication');
  await expect(page.locator('[data-testid="kind-corrects-adam"]')).toBeVisible();
  await page.locator('[data-testid="btn-kind-save"]').click();
  await expect(page.locator('[data-testid="kind-error"]')).toContainText('ποιο έγγραφο διορθώνει');
  await page.locator('[data-testid="kind-corrects-adam"]').selectOption('24SYMV000000001');
  await page.locator('[data-testid="kind-part-title"]').uncheck();
  await page.locator('[data-testid="btn-kind-save"]').click();
  await expect(page.locator('[data-testid="kind-error"]')).toContainText('τι διορθώνει');
  await page.locator('[data-testid="kind-part-title"]').check();
  await page.locator('[data-testid="btn-kind-save"]').click();
  await expect(page.locator('[data-testid="pending-empty"]')).toBeVisible();
});

test('P4-33 «Άλλο» σώζεται χωρίς επιπλέον πεδία', async ({ page }) => {
  await runFetchScenario(page, 'review');
  await openPendingTask(page, 'data_review');
  await page.locator('[data-testid="chain-kind"]').selectOption('other');
  await expect(page.locator('#kind-amount-wrap')).toBeHidden();
  await expect(page.locator('#kind-end-wrap')).toBeHidden();
  await page.locator('[data-testid="btn-kind-save"]').click();
  await expect(page.locator('[data-testid="pending-empty"]')).toBeVisible();
});

test('P4-34 αρχική σύμβαση δεν έχει κάρτα χαρακτηρισμού', async ({ page }) => {
  await runFetchScenario(page, 'root_no_card');
  await openPendingTask(page, 'data_review');
  await expect(page.locator('[data-testid="kind-root-note"]')).toBeVisible();
  await page.locator('[data-testid="btn-detail-done"]').click();
  await expect(page.locator('[data-testid="pending-empty"]')).toBeVisible();
});

'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  setRole,
  openMeletai,
  setMeletaiCanEdit,
  searchMeletai,
  setMeletaiQuick,
  mltCard,
  openMeletaiCreate,
  fillMeletaiCreate,
  submitMeletaiCreate,
} = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P9-01 μητρώο μελετών σε όλους τους ρόλους', async ({ page }) => {
  await expect(page.locator('[data-testid="btn-meletai"]')).toBeVisible();
  await setRole(page, 'SUPERADMIN');
  await expect(page.locator('[data-testid="btn-meletai"]')).toBeVisible();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-meletai"]')).toBeVisible();
  await setRole(page, 'USER');
  await expect(page.locator('[data-testid="btn-meletai"]')).toBeVisible();
});

test('P9-02 απλός χρήστης χωρίς δικαίωμα: μόνο ανάγνωση', async ({ page }) => {
  await setRole(page, 'USER');
  await setMeletaiCanEdit(page, false);
  await openMeletai(page);
  await expect(page.locator('[data-testid="meletai-readonly"]')).toBeVisible();
  await expect(page.locator('[data-testid="btn-meletai-new"]')).toBeHidden();
  await expect(page.locator('[data-testid="btn-meletai-delete"]')).toBeHidden();
});

test('P9-03 απλός χρήστης με δικαίωμα: μπορεί νέα μελέτη', async ({ page }) => {
  await setRole(page, 'USER');
  await setMeletaiCanEdit(page, true);
  await openMeletai(page);
  await expect(page.locator('[data-testid="meletai-readonly"]')).toBeHidden();
  await expect(page.locator('[data-testid="btn-meletai-new"]')).toBeVisible();
});

test('P9-04 μηχανικός χωρίς δικαίωμα: μόνο ανάγνωση', async ({ page }) => {
  await setRole(page, 'ENGINEER');
  await setMeletaiCanEdit(page, false);
  await openMeletai(page);
  await expect(page.locator('[data-testid="meletai-readonly"]')).toBeVisible();
  await expect(page.locator('[data-testid="btn-meletai-new"]')).toBeHidden();
});

test('P9-05 διαχειριστής επεξεργάζεται χωρίς ειδικό δικαίωμα', async ({ page }) => {
  await setMeletaiCanEdit(page, false);
  await openMeletai(page);
  await expect(page.locator('[data-testid="meletai-readonly"]')).toBeHidden();
  await expect(page.locator('[data-testid="btn-meletai-new"]')).toBeVisible();
});

test('P9-06 νέα μελέτη χωρίς αριθμό δεν δημιουργείται', async ({ page }) => {
  await openMeletai(page);
  await openMeletaiCreate(page);
  await fillMeletaiCreate(page, { studyNumber: '', title: 'Νέα μελέτη' });
  await submitMeletaiCreate(page);
  await expect(page.locator('[data-testid="meletai-error"]')).toContainText('αριθμός μελέτης');
  await expect(mltCard(page, 'mlt-new-1')).toHaveCount(0);
});

test('P9-07 λάθος μορφή αριθμού δεν δημιουργείται', async ({ page }) => {
  await openMeletai(page);
  await openMeletaiCreate(page);
  await fillMeletaiCreate(page, { studyNumber: '2-2026', title: 'Νέα μελέτη' });
  await submitMeletaiCreate(page);
  await expect(page.locator('[data-testid="meletai-error"]')).toContainText('Μορφή');
});

test('P9-08 νέα μελέτη χωρίς τίτλο δεν δημιουργείται', async ({ page }) => {
  await openMeletai(page);
  await openMeletaiCreate(page);
  await fillMeletaiCreate(page, { studyNumber: '4/2026', title: '' });
  await submitMeletaiCreate(page);
  await expect(page.locator('[data-testid="meletai-error"]')).toContainText('τίτλος');
});

test('P9-09 ίδιος αριθμός μελέτης δεν ξαναδημιουργείται', async ({ page }) => {
  await openMeletai(page);
  await openMeletaiCreate(page);
  await fillMeletaiCreate(page, { studyNumber: '2/2026', title: 'Άλλη μελέτη' });
  await submitMeletaiCreate(page);
  await expect(page.locator('[data-testid="meletai-error"]')).toContainText('ήδη');
});

test('P9-10 νέα μελέτη με αριθμό και τίτλο εμφανίζεται', async ({ page }) => {
  await openMeletai(page);
  await openMeletaiCreate(page);
  await fillMeletaiCreate(page, { studyNumber: '4/2026', title: 'Νέα μελέτη Πεζών' });
  await submitMeletaiCreate(page);
  await expect(mltCard(page, 'mlt-new-1')).toBeVisible();
  await expect(mltCard(page, 'mlt-new-1')).toContainText('4/2026');
});

test('P9-11 αναζήτηση τίτλου ναι, όνομα αρχείου όχι', async ({ page }) => {
  await openMeletai(page);
  await searchMeletai(page, 'Χουδετσίου');
  await expect(mltCard(page, 'mlt-water')).toBeVisible();
  await expect(mltCard(page, 'mlt-square')).toHaveCount(0);
  await searchMeletai(page, 'ΚΑ-777');
  await expect(mltCard(page, 'mlt-water')).toHaveCount(0);
});

test('P9-12 αναζήτηση αριθμού μελέτης', async ({ page }) => {
  await openMeletai(page);
  await searchMeletai(page, '15/2025');
  await expect(mltCard(page, 'mlt-square')).toBeVisible();
  await expect(mltCard(page, 'mlt-water')).toHaveCount(0);
});

test('P9-13 φίλτρο συνδεδεμένων / χωρίς υποέργο', async ({ page }) => {
  await openMeletai(page);
  await setMeletaiQuick(page, 'unlinked');
  await expect(mltCard(page, 'mlt-square')).toBeVisible();
  await expect(mltCard(page, 'mlt-water')).toHaveCount(0);
  await setMeletaiQuick(page, 'linked');
  await expect(mltCard(page, 'mlt-water')).toBeVisible();
  await expect(mltCard(page, 'mlt-square')).toHaveCount(0);
});

test('P9-14 φίλτρο με αρχεία', async ({ page }) => {
  await openMeletai(page);
  await setMeletaiQuick(page, 'with_files');
  await expect(mltCard(page, 'mlt-water')).toBeVisible();
  await expect(mltCard(page, 'mlt-square')).toHaveCount(0);
});

test('P9-15 διαγραφή μόνο με δικαίωμα επεξεργασίας', async ({ page }) => {
  await setRole(page, 'USER');
  await setMeletaiCanEdit(page, false);
  await openMeletai(page);
  await mltCard(page, 'mlt-square').click();
  await expect(page.locator('[data-testid="btn-meletai-delete"]')).toBeHidden();
  await setMeletaiCanEdit(page, true);
  await mltCard(page, 'mlt-square').click();
  await page.locator('[data-testid="btn-meletai-delete"]').click();
  await page.locator('[data-testid="btn-meletai-delete-confirm"]').click();
  await expect(mltCard(page, 'mlt-square')).toHaveCount(0);
});

test('P9-16 μηχανικός βλέπει όλες τις μελέτες, όχι μόνο τις χρεωμένες', async ({ page }) => {
  await setRole(page, 'ENGINEER');
  await openMeletai(page);
  await expect(mltCard(page, 'mlt-water')).toBeVisible();
  await expect(mltCard(page, 'mlt-square')).toBeVisible();
  await expect(mltCard(page, 'mlt-road')).toBeVisible();
});

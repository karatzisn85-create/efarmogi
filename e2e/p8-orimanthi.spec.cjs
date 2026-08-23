'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  setRole,
  openOrimanthi,
  setOrimanthiCanEdit,
  searchOrimanthi,
  setOrimanthiStatus,
  setOrimanthiCategory,
  setOrimanthiQuick,
  oriCard,
  openOrimanthiCreate,
  fillOrimanthiCreate,
  submitOrimanthiCreate,
  fillOrimanthiTitle,
  saveOrimanthiEdit,
} = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P8-01 ωρίμανση σε όλους τους ρόλους', async ({ page }) => {
  await expect(page.locator('[data-testid="btn-orimanthi"]')).toBeVisible();
  await setRole(page, 'SUPERADMIN');
  await expect(page.locator('[data-testid="btn-orimanthi"]')).toBeVisible();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-orimanthi"]')).toBeVisible();
  await setRole(page, 'USER');
  await expect(page.locator('[data-testid="btn-orimanthi"]')).toBeVisible();
});

test('P8-02 απλός χρήστης χωρίς δικαίωμα: μόνο ανάγνωση', async ({ page }) => {
  await setRole(page, 'USER');
  await setOrimanthiCanEdit(page, false);
  await openOrimanthi(page);
  await expect(page.locator('[data-testid="orimanthi-readonly"]')).toBeVisible();
  await expect(page.locator('[data-testid="btn-orimanthi-new"]')).toBeHidden();
  await expect(page.locator('[data-testid="btn-orimanthi-delete"]')).toBeHidden();
  await expect(page.locator('[data-testid="orimanthi-aepo-calendar"]')).toHaveText('ΝΑΙ');
});

test('P8-03 απλός χρήστης με δικαίωμα: μπορεί νέο έργο', async ({ page }) => {
  await setRole(page, 'USER');
  await setOrimanthiCanEdit(page, true);
  await openOrimanthi(page);
  await expect(page.locator('[data-testid="orimanthi-readonly"]')).toBeHidden();
  await expect(page.locator('[data-testid="btn-orimanthi-new"]')).toBeVisible();
  await expect(page.locator('[data-testid="orimanthi-aepo-calendar"]')).toHaveText('ΝΑΙ');
});

test('P8-04 μηχανικός χωρίς δικαίωμα: μόνο ανάγνωση', async ({ page }) => {
  await setRole(page, 'ENGINEER');
  await setOrimanthiCanEdit(page, false);
  await openOrimanthi(page);
  await expect(page.locator('[data-testid="orimanthi-readonly"]')).toBeVisible();
  await expect(page.locator('[data-testid="btn-orimanthi-new"]')).toBeHidden();
  await expect(page.locator('[data-testid="orimanthi-aepo-calendar"]')).toHaveText('ΝΑΙ');
});

test('P8-05 διαχειριστής επεξεργάζεται χωρίς ειδικό δικαίωμα', async ({ page }) => {
  await setOrimanthiCanEdit(page, false);
  await openOrimanthi(page);
  await expect(page.locator('[data-testid="orimanthi-readonly"]')).toBeHidden();
  await expect(page.locator('[data-testid="btn-orimanthi-new"]')).toBeVisible();
  await expect(page.locator('[data-testid="orimanthi-aepo-calendar"]')).toHaveText('ΝΑΙ');
});

test('P8-06 νέο έργο χωρίς τίτλο δεν δημιουργείται', async ({ page }) => {
  await openOrimanthi(page);
  await openOrimanthiCreate(page);
  await fillOrimanthiCreate(page, { title: '', projectCategory: 'ΟΔΟΠΟΙΙΑ' });
  await submitOrimanthiCreate(page);
  await expect(page.locator('[data-testid="orimanthi-error"]')).toContainText('τίτλο');
  await expect(oriCard(page, 'ori-new-1')).toHaveCount(0);
});

test('P8-07 νέο έργο χωρίς κατηγορία δεν δημιουργείται', async ({ page }) => {
  await openOrimanthi(page);
  await openOrimanthiCreate(page);
  await fillOrimanthiCreate(page, { title: 'Νέο έργο δοκιμής', projectCategory: '' });
  await submitOrimanthiCreate(page);
  await expect(page.locator('[data-testid="orimanthi-error"]')).toContainText('κατηγορία');
});

test('P8-08 υδραυλικά χωρίς εξειδίκευση δεν δημιουργείται', async ({ page }) => {
  await openOrimanthi(page);
  await openOrimanthiCreate(page);
  await fillOrimanthiCreate(page, { title: 'Νέο υδραυλικό', projectCategory: 'ΥΔΡΑΥΛΙΚΑ' });
  await submitOrimanthiCreate(page);
  await expect(page.locator('[data-testid="orimanthi-error"]')).toContainText('εξειδίκευση');
});

test('P8-09 νέο έργο με τίτλο και οδοποιία μπαίνει σε ωρίμανση', async ({ page }) => {
  await openOrimanthi(page);
  await openOrimanthiCreate(page);
  await fillOrimanthiCreate(page, { title: 'Νέα οδοποιία Πεζών', projectCategory: 'ΟΔΟΠΟΙΙΑ' });
  await submitOrimanthiCreate(page);
  await expect(oriCard(page, 'ori-new-1')).toBeVisible();
  await expect(oriCard(page, 'ori-new-1')).toContainText('maturing');
});

test('P8-10 αναζήτηση τίτλου ναι, όνομα αρχείου όχι', async ({ page }) => {
  await openOrimanthi(page);
  await searchOrimanthi(page, 'Χουδετσίου');
  await expect(oriCard(page, 'ori-water')).toBeVisible();
  await expect(oriCard(page, 'ori-road')).toHaveCount(0);
  await searchOrimanthi(page, 'ΚΑ-888');
  await expect(oriCard(page, 'ori-water')).toHaveCount(0);
});

test('P8-11 αναζήτηση κειμένου εκκρεμότητας', async ({ page }) => {
  await openOrimanthi(page);
  await searchOrimanthi(page, 'Αρχαιολογική');
  await expect(oriCard(page, 'ori-water')).toBeVisible();
  await expect(oriCard(page, 'ori-draft')).toHaveCount(0);
});

test('P8-12 φίλτρο κατάστασης', async ({ page }) => {
  await openOrimanthi(page);
  await setOrimanthiStatus(page, 'ready');
  await expect(oriCard(page, 'ori-road')).toBeVisible();
  await expect(oriCard(page, 'ori-water')).toHaveCount(0);
});

test('P8-13 φίλτρο χωρίς κατηγορία', async ({ page }) => {
  await openOrimanthi(page);
  await setOrimanthiCategory(page, '__uncategorized__');
  await expect(oriCard(page, 'ori-draft')).toBeVisible();
  await expect(oriCard(page, 'ori-water')).toHaveCount(0);
});

test('P8-14 ΑΕΠΟ που λήγει σύντομα περιλαμβάνει και τη ληγμένη', async ({ page }) => {
  await openOrimanthi(page);
  await setOrimanthiQuick(page, 'aepo_soon');
  await expect(oriCard(page, 'ori-water')).toBeVisible();
  await expect(oriCard(page, 'ori-expired')).toBeVisible();
  await expect(oriCard(page, 'ori-road')).toHaveCount(0);
});

test('P8-15 φίλτρο ανοιχτών εκκρεμοτήτων', async ({ page }) => {
  await openOrimanthi(page);
  await setOrimanthiQuick(page, 'pending');
  await expect(oriCard(page, 'ori-water')).toBeVisible();
  await expect(oriCard(page, 'ori-expired')).toHaveCount(0);
});

test('P8-16 διαγραφή μόνο με δικαίωμα επεξεργασίας', async ({ page }) => {
  await setRole(page, 'USER');
  await setOrimanthiCanEdit(page, false);
  await openOrimanthi(page);
  await oriCard(page, 'ori-draft').click();
  await expect(page.locator('[data-testid="btn-orimanthi-delete"]')).toBeHidden();
  await setOrimanthiCanEdit(page, true);
  await oriCard(page, 'ori-draft').click();
  await page.locator('[data-testid="btn-orimanthi-delete"]').click();
  await page.locator('[data-testid="btn-orimanthi-delete-confirm"]').click();
  await expect(oriCard(page, 'ori-draft')).toHaveCount(0);
});

test('P8-17 αποθήκευση χωρίς τίτλο δεν αλλάζει το έργο', async ({ page }) => {
  await openOrimanthi(page);
  await oriCard(page, 'ori-draft').click();
  await fillOrimanthiTitle(page, '');
  await saveOrimanthiEdit(page);
  await expect(page.locator('[data-testid="orimanthi-error"]')).toContainText('τίτλο');
  await expect(oriCard(page, 'ori-draft')).toContainText('Κτίριο δημοτικού');
});

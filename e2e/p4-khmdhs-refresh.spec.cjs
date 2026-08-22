'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  setRole,
  openRead,
  toggleArchived,
  openKhmdhsBatch,
  khmdhsEligible,
  khmdhsSkipped,
  setKhmdhsAll,
  refreshKhmdhsFromRead,
} = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P4-01 απλός χρήστης δεν ανανεώνει ΚΗΜΔΗΣ', async ({ page }) => {
  await expect(page.locator('[data-testid="btn-batch-khmdhs"]')).toBeVisible();
  await openRead(page, 'sub-bridge');
  await expect(page.locator('[data-testid="btn-khmdhs-refresh"]')).toBeVisible();
  await setRole(page, 'USER');
  await expect(page.locator('[data-testid="btn-batch-khmdhs"]')).toBeHidden();
  await expect(page.locator('[data-testid="btn-khmdhs-refresh"]')).toBeHidden();
});

test('P4-02 μηχανικός ανανεώνει μόνο χρεωμένο με ΑΔΑΜ', async ({ page }) => {
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-batch-khmdhs"]')).toBeHidden();
  await openRead(page, 'sub-bridge');
  await expect(page.locator('[data-testid="btn-khmdhs-refresh"]')).toBeVisible();
  await openRead(page, 'sub-lights');
  await expect(page.locator('[data-testid="btn-khmdhs-refresh"]')).toBeHidden();
});

test('P4-03 ολοκληρωμένο και αποπληρωμένο δεν ανανεώνεται', async ({ page }) => {
  await toggleArchived(page);
  await openRead(page, 'sub-paid');
  await expect(page.locator('[data-testid="btn-khmdhs-refresh"]')).toBeHidden();
  await openKhmdhsBatch(page);
  await expect(khmdhsSkipped(page, 'sub-paid')).toBeVisible();
  await expect(khmdhsSkipped(page, 'sub-paid')).toContainText('Ολοκληρωμένο');
  await expect(khmdhsEligible(page, 'sub-paid')).toHaveCount(0);
});

test('P4-04 χωρίς ΑΔΑΜ παραλείπεται και δεν έχει ανανέωση στην κάρτα', async ({ page }) => {
  await openRead(page, 'sub-lights');
  await expect(page.locator('[data-testid="btn-khmdhs-refresh"]')).toBeHidden();
  await openKhmdhsBatch(page);
  await expect(khmdhsSkipped(page, 'sub-lights')).toContainText('Χωρίς ΑΔΑΜ');
  await expect(khmdhsEligible(page, 'sub-lights')).toHaveCount(0);
});

test('P4-05 κλειδωμένο δεν ανανεώνεται και παραλείπεται στη μαζική', async ({ page }) => {
  await openRead(page, 'sub-legacy');
  await expect(page.locator('[data-testid="btn-khmdhs-refresh"]')).toBeVisible();
  await refreshKhmdhsFromRead(page);
  await expect(page.locator('[data-testid="khmdhs-refresh-error"]')).toContainText('Νίκος');
  await openKhmdhsBatch(page);
  await expect(khmdhsSkipped(page, 'sub-legacy')).toContainText('Κλειδωμένο');
});

test('P4-06 μαζική ανανέωση μόνο στον διαχειριστή', async ({ page }) => {
  await expect(page.locator('[data-testid="btn-batch-khmdhs"]')).toBeVisible();
  await setRole(page, 'SUPERADMIN');
  await expect(page.locator('[data-testid="btn-batch-khmdhs"]')).toBeVisible();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-batch-khmdhs"]')).toBeHidden();
});

test('P4-07 μόνο παλαιά κρύβει το φρέσκο· όλα το δείχνουν', async ({ page }) => {
  await openKhmdhsBatch(page);
  await expect(khmdhsEligible(page, 'sub-bridge')).toBeVisible();
  await expect(khmdhsEligible(page, 'sub-tank')).toHaveCount(0);
  await setKhmdhsAll(page);
  await expect(khmdhsEligible(page, 'sub-bridge')).toBeVisible();
  await expect(khmdhsEligible(page, 'sub-tank')).toBeVisible();
});

test('P4-08 ανανέωση σε ένα υποέργο το βγάζει από τα παλαιά', async ({ page }) => {
  await openRead(page, 'sub-bridge');
  await refreshKhmdhsFromRead(page);
  await expect(page.locator('[data-testid="khmdhs-refresh-error"]')).toBeHidden();
  await openKhmdhsBatch(page);
  await expect(khmdhsEligible(page, 'sub-bridge')).toHaveCount(0);
  await setKhmdhsAll(page);
  await expect(khmdhsEligible(page, 'sub-bridge')).toBeVisible();
});

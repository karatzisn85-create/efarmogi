'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  setRole,
  openFiles,
  startAddFiles,
} = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P3-24 νέα ομάδα αρχείων με τίτλο', async ({ page }) => {
  await openFiles(page, 'sub-bridge');
  await startAddFiles(page, 'σχέδιο.pdf');
  await page.locator('[data-testid="file-choice-new"]').click();
  await page.locator('[data-testid="file-new-title"]').fill('Τεχνικά σχέδια');
  await page.locator('[data-testid="file-confirm-new"]').click();
  await expect(page.locator('[data-testid="file-list"]', { hasText: 'Τεχνικά σχέδια' })).toBeVisible();
  await expect(page.locator('[data-testid="file-row-σχέδιο.pdf"]')).toBeVisible();
  await expect(page.locator('[data-testid="file-row-σύμβαση.pdf"]')).toBeVisible();
});

test('P3-25 προσθήκη σε υπάρχουσα ομάδα', async ({ page }) => {
  await openFiles(page, 'sub-bridge');
  await startAddFiles(page, 'παράρτημα.pdf');
  await page.locator('[data-testid="file-choice-existing"]').click();
  await page.locator('[data-testid="file-existing-select"]').selectOption('grp-contract');
  await page.locator('[data-testid="file-confirm-existing"]').click();
  const group = page.locator('[data-testid="file-group-grp-contract"]');
  await expect(group.locator('[data-testid="file-row-σύμβαση.pdf"]')).toBeVisible();
  await expect(group.locator('[data-testid="file-row-παράρτημα.pdf"]')).toBeVisible();
  await expect(page.locator('[data-testid="file-ungrouped-παράρτημα.pdf"]')).toHaveCount(0);
});

test('P3-26 χωρίς ομαδοποίηση και ακύρωση ανεβάσματος', async ({ page }) => {
  await openFiles(page, 'sub-bridge');
  await startAddFiles(page, 'σημείωμα.pdf');
  await page.locator('[data-testid="file-choice-none"]').click();
  await expect(page.locator('[data-testid="file-ungrouped-σημείωμα.pdf"]')).toBeVisible();
  await startAddFiles(page, 'ακυρωμένο.pdf');
  await page.locator('[data-testid="file-choice-cancel"]').click();
  await expect(page.locator('[data-testid="file-ungrouped-ακυρωμένο.pdf"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="file-row-ακυρωμένο.pdf"]')).toHaveCount(0);
});

test('P3-27 φάκελος γίνεται ομάδα με το όνομα του φακέλου', async ({ page }) => {
  await openFiles(page, 'sub-bridge');
  await page.locator('[data-testid="file-pending-names"]').fill('α.pdf');
  await page.locator('[data-testid="file-folder-name"]').fill('Προσφορές');
  await page.locator('[data-testid="btn-add-folder"]').click();
  await expect(page.locator('[data-testid="file-list"]', { hasText: 'Προσφορές' })).toBeVisible();
  await expect(page.locator('[data-testid="file-row-α.pdf"]')).toBeVisible();
});

test('P3-28 αφαίρεση τελευταίου αρχείου διαγράφει την ομάδα', async ({ page }) => {
  await openFiles(page, 'sub-bridge');
  await expect(page.locator('[data-testid="file-group-grp-contract"]')).toBeVisible();
  await page.locator('[data-testid="file-remove-grp-contract-0"]').click();
  await expect(page.locator('[data-testid="file-group-grp-contract"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="file-row-σύμβαση.pdf"]')).toHaveCount(0);
});

test('P3-29 απλός χρήστης δεν βλέπει προσθήκη αρχείων', async ({ page }) => {
  await setRole(page, 'USER');
  await openFiles(page, 'sub-bridge');
  await expect(page.locator('[data-testid="file-row-σύμβαση.pdf"]')).toBeVisible();
  await expect(page.locator('[data-testid="btn-add-files"]')).toBeHidden();
  await expect(page.locator('[data-testid="btn-add-folder"]')).toBeHidden();
});

'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  card,
  openRead,
  setQuickStatus,
  setQuickType,
  setChargeFilter,
  toggleArchived,
} = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P1-01 ομαδοποίηση καρτών με βάση το έργο — δύο υποέργα στην ίδια ομάδα', async ({ page }) => {
  const group = page.locator('[data-testid="group-proj-road"]');
  await expect(group).toBeVisible();
  await expect(group.locator('[data-testid="group-title-proj-road"]')).toHaveText('Οδικό δίκτυο Αρχανών');
  await expect(group.locator('[data-testid="card-sub-bridge"]')).toBeVisible();
  await expect(group.locator('[data-testid="card-sub-lights"]')).toBeVisible();
  await expect(page.locator('[data-testid="group-proj-water"]')).toBeVisible();
});

test('P1-02 κλικ στην κάρτα ανοίγει ανάγνωση, όχι επεξεργασία', async ({ page }) => {
  await openRead(page, 'sub-bridge');
  await expect(page.locator('[data-testid="read-panel"]')).toBeVisible();
  await expect(page.locator('[data-testid="edit-panel"]')).toBeHidden();
  await expect(page.locator('[data-testid="read-project-title"]')).toHaveText('Οδικό δίκτυο Αρχανών');
  await expect(page.locator('[data-testid="read-subproject-title"]')).toHaveText('Γέφυρα Αγίου Σύλλα');
  await expect(page.locator('[data-testid="read-ka"]')).toHaveText('ΚΑ-100');
  await expect(page.locator('[data-testid="read-charge"]')).toHaveText('Μαρία Παπαδοπούλου');
});

test('P1-03 γρήγορο φίλτρο κατάστασης', async ({ page }) => {
  await setQuickStatus(page, 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ');
  await expect(card(page, 'sub-lights')).toBeVisible();
  await expect(card(page, 'sub-tank')).toBeVisible();
  await expect(card(page, 'sub-bridge')).toHaveCount(0);
});

test('P1-04 γρήγορο φίλτρο είδους', async ({ page }) => {
  await setQuickType(page, 'ΠΡΟΜΗΘΕΙΑ');
  await expect(card(page, 'sub-tank')).toBeVisible();
  await expect(card(page, 'sub-bridge')).toHaveCount(0);
  await expect(card(page, 'sub-lights')).toHaveCount(0);
});

test('P1-05 φίλτρο χρέωσης — μόνο τα χρεωμένα στον επιλεγμένο', async ({ page }) => {
  await setChargeFilter(page, 'user:maria');
  await expect(card(page, 'sub-bridge')).toBeVisible();
  await expect(card(page, 'sub-lights')).toBeVisible();
  await expect(card(page, 'sub-tank')).toHaveCount(0);
});

test('P1-06 ολοκληρωμένα και αποπληρωμένα κρύβονται, εμφανίζονται μόνο με το κουμπί', async ({ page }) => {
  await expect(card(page, 'sub-paid')).toHaveCount(0);
  await expect(card(page, 'sub-abandoned')).toHaveCount(0);
  await toggleArchived(page);
  await expect(card(page, 'sub-paid')).toBeVisible();
  await expect(card(page, 'sub-bridge')).toHaveCount(0);
  await expect(card(page, 'sub-abandoned')).toHaveCount(0);
});

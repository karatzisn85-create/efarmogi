'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  setRole,
  openRead,
  openPortal,
  togglePortalEnabled,
  searchPortal,
  setPortalPublishedFilter,
} = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P7-01 πύλη σε διαχειριστή / υπερδιαχειριστή / μηχανικό — όχι στον απλό χρήστη', async ({ page }) => {
  await expect(page.locator('[data-testid="btn-portal"]')).toBeVisible();
  await setRole(page, 'SUPERADMIN');
  await expect(page.locator('[data-testid="btn-portal"]')).toBeVisible();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-portal"]')).toBeVisible();
  await setRole(page, 'USER');
  await expect(page.locator('[data-testid="btn-portal"]')).toBeHidden();
});

test('P7-02 ανενεργή πύλη: ο διαχειριστής βλέπει κλείδωμα, ο υπερδιαχειριστής τη λίστα', async ({ page }) => {
  await setRole(page, 'SUPERADMIN');
  await openPortal(page);
  await togglePortalEnabled(page);
  await expect(page.locator('[data-testid="portal-state"]')).toHaveText('ΑΝΕΝΕΡΓΗ');
  await expect(page.locator('[data-testid="portal-workspace"]')).toBeVisible();
  await setRole(page, 'ADMIN');
  await expect(page.locator('[data-testid="portal-locked"]')).toBeVisible();
  await expect(page.locator('[data-testid="portal-workspace"]')).toBeHidden();
});

test('P7-03 μηχανικός: μόνο ανάγνωση, χωρίς εξαγωγή', async ({ page }) => {
  await setRole(page, 'ENGINEER');
  await openPortal(page);
  await expect(page.locator('[data-testid="portal-readonly"]')).toBeVisible();
  await expect(page.locator('[data-testid="portal-workspace"]')).toBeHidden();
  await expect(page.locator('[data-testid="btn-portal-export"]')).toBeHidden();
});

test('P7-04 ρυθμίσεις πύλης μόνο στον υπερδιαχειριστή', async ({ page }) => {
  await openPortal(page);
  await expect(page.locator('[data-testid="portal-settings"]')).toBeHidden();
  await setRole(page, 'SUPERADMIN');
  await expect(page.locator('[data-testid="portal-settings"]')).toBeVisible();
});

test('P7-05 χωρίς αναγνωριστικό Δήμου δεν εξάγεται', async ({ page }) => {
  await setRole(page, 'SUPERADMIN');
  await openPortal(page);
  await page.locator('[data-testid="portal-uid"]').fill('');
  await expect(page.locator('[data-testid="btn-portal-export"]')).toBeDisabled();
});

test('P7-06 χωρίς επιλογή δεν εξάγεται· με επιλογή ενεργοποιείται', async ({ page }) => {
  await openPortal(page);
  await expect(page.locator('[data-testid="btn-portal-export"]')).toBeDisabled();
  await page.locator('[data-testid="portal-check-sub-bridge"]').check();
  await expect(page.locator('[data-testid="btn-portal-export"]')).toBeEnabled();
});

test('P7-07 η λίστα πύλης δείχνει και απενταγμένα / αποπληρωμένα', async ({ page }) => {
  await openPortal(page);
  await expect(page.locator('[data-testid="portal-row-sub-bridge"]')).toBeVisible();
  await expect(page.locator('[data-testid="portal-row-sub-abandoned"]')).toBeVisible();
  await expect(page.locator('[data-testid="portal-row-sub-paid"]')).toBeVisible();
});

test('P7-08 η εξαγωγή κόβει τα απενταγμένα, ακόμα κι αν είναι επιλεγμένα', async ({ page }) => {
  await openPortal(page);
  await page.locator('[data-testid="btn-portal-select-filtered"]').click();
  await page.locator('[data-testid="btn-portal-export"]').click();
  await expect(page.locator('[data-testid="portal-export-sub-bridge"]')).toBeVisible();
  await expect(page.locator('[data-testid="portal-export-sub-abandoned"]')).toHaveCount(0);
});

test('P7-09 αναζήτηση πύλης: τίτλος ναι, ΚΑ όχι', async ({ page }) => {
  await openPortal(page);
  await searchPortal(page, 'Γέφυρα');
  await expect(page.locator('[data-testid="portal-row-sub-bridge"]')).toBeVisible();
  await expect(page.locator('[data-testid="portal-row-sub-tank"]')).toHaveCount(0);
  await searchPortal(page, 'ΚΑ-100');
  await expect(page.locator('[data-testid="portal-row-sub-bridge"]')).toHaveCount(0);
});

test('P7-10 σήμανση από την κάρτα μπαίνει στην επόμενη εξαγωγή, όχι στα δημοσιευμένα', async ({ page }) => {
  await openRead(page, 'sub-bridge');
  await page.locator('[data-testid="btn-read-portal-toggle"]').click();
  await expect(page.locator('[data-testid="read-portal-status"]')).toContainText('Σημειωμένο για την επόμενη δημοσίευση');
  await openPortal(page);
  await expect(page.locator('[data-testid="portal-queued-sub-bridge"]')).toBeVisible();
  await expect(page.locator('[data-testid="portal-published-sub-bridge"]')).toHaveCount(0);
  await setPortalPublishedFilter(page, 'published');
  await expect(page.locator('[data-testid="portal-row-sub-bridge"]')).toHaveCount(0);
});

test('P7-11 η σήμανση στην κάρτα δεν ανεβάζει από μόνη της', async ({ page }) => {
  await openRead(page, 'sub-bridge');
  await page.locator('[data-testid="btn-read-portal-toggle"]').click();
  await openPortal(page);
  await expect(page.locator('[data-testid="portal-queued-sub-bridge"]')).toBeVisible();
  await expect(page.locator('[data-testid="portal-export-preview"]')).toBeHidden();
});

test('P7-12 εξαίρεση μετά την εξαγωγή: μένει δημόσιο μέχρι νέα δημοσίευση', async ({ page }) => {
  await openPortal(page);
  await page.locator('[data-testid="portal-check-sub-bridge"]').check();
  await page.locator('[data-testid="btn-portal-export"]').click();
  await expect(page.locator('[data-testid="portal-published-sub-bridge"]')).toBeVisible();
  await openRead(page, 'sub-bridge');
  await expect(page.locator('[data-testid="read-portal-status"]')).toContainText('Στην επόμενη δημοσίευση');
  await page.locator('[data-testid="btn-read-portal-toggle"]').click();
  await expect(page.locator('[data-testid="read-portal-status"]')).toContainText('Ακόμα δημόσιο');
  await expect(page.locator('[data-testid="portal-published-sub-bridge"]')).toBeVisible();
  await expect(page.locator('[data-testid="portal-leaving-sub-bridge"]')).toBeVisible();
  await expect(page.locator('[data-testid="portal-check-sub-bridge"]')).not.toBeChecked();
  await setPortalPublishedFilter(page, 'published');
  await expect(page.locator('[data-testid="portal-row-sub-bridge"]')).toBeVisible();
});

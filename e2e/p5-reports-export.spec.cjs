'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  setRole,
  search,
  setQuickStatus,
  toggleArchived,
  openStats,
  openTechnical,
  setTechnicalYear,
  openExportData,
} = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P5-01 στατιστικά εμφανίζονται σε όλους τους ρόλους', async ({ page }) => {
  await expect(page.locator('[data-testid="btn-stats"]')).toBeVisible();
  await setRole(page, 'SUPERADMIN');
  await expect(page.locator('[data-testid="btn-stats"]')).toBeVisible();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-stats"]')).toBeVisible();
  await setRole(page, 'USER');
  await expect(page.locator('[data-testid="btn-stats"]')).toBeVisible();
});

test('P5-02 προεπιλογή: έργα ανά τίτλο, εκτελούμενα μόνο συμβασιοποιημένα', async ({ page }) => {
  await openStats(page);
  await expect(page.locator('[data-testid="stats-unique"]')).toHaveText('3');
  await expect(page.locator('[data-testid="stats-total"]')).toHaveText('4');
  await expect(page.locator('[data-testid="stats-progress"]')).toHaveText('2');
  await expect(page.locator('[data-testid="stats-completed"]')).toHaveText('0');
  await expect(page.locator('[data-testid="stats-filter-note"]')).toHaveText('4 υποέργα');
  await expect(page.locator('[data-testid="stats-scope-note"]')).toBeHidden();
});

test('P5-03 μηχανικός: σημείωση χρέωσης και μόνο τα δικά του στον αριθμό', async ({ page }) => {
  await setRole(page, 'ENGINEER');
  await openStats(page);
  await expect(page.locator('[data-testid="stats-scope-note"]')).toContainText('χρέωσής σας (4)');
  await expect(page.locator('[data-testid="stats-total"]')).toHaveText('2');
  await expect(page.locator('[data-testid="stats-progress"]')).toHaveText('1');
  await expect(page.locator('[data-testid="stats-filter-note"]')).toContainText('2 υποέργα');
});

test('P5-04 η αναζήτηση αλλάζει το σημείωμα και τον αριθμό', async ({ page }) => {
  await openStats(page);
  await search(page, 'Γέφυρα Αγίου Σύλλα');
  await expect(page.locator('[data-testid="stats-total"]')).toHaveText('1');
  await expect(page.locator('[data-testid="stats-filter-note"]')).toContainText('αναζήτηση «Γέφυρα Αγίου Σύλλα»');
});

test('P5-05 αποπληρωμένο δεν μετρά ως ολοκληρωμένο', async ({ page }) => {
  await toggleArchived(page);
  await openStats(page);
  await expect(page.locator('[data-testid="stats-total"]')).toHaveText('1');
  await expect(page.locator('[data-testid="stats-completed"]')).toHaveText('0');
});

test('P5-06 τεχνικό πρόγραμμα όχι στον μηχανικό', async ({ page }) => {
  await expect(page.locator('[data-testid="btn-technical"]')).toBeVisible();
  await setRole(page, 'USER');
  await expect(page.locator('[data-testid="btn-technical"]')).toBeVisible();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-technical"]')).toBeHidden();
});

test('P5-07 τεχνικό 2026: μόνο υπόλοιπο του έτους', async ({ page }) => {
  await openTechnical(page);
  await setTechnicalYear(page, '2026');
  await expect(page.locator('[data-testid="tech-row-sub-bridge"]')).toBeVisible();
  await expect(page.locator('[data-testid="tech-row-sub-tank"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="technical-rows"]')).toHaveText('1');
  await expect(page.locator('[data-testid="btn-technical-export"]')).toBeEnabled();
});

test('P5-08 τεχνικό 2025: άλλο υπόλοιπο', async ({ page }) => {
  await openTechnical(page);
  await setTechnicalYear(page, '2025');
  await expect(page.locator('[data-testid="tech-row-sub-tank"]')).toBeVisible();
  await expect(page.locator('[data-testid="tech-row-sub-bridge"]')).toHaveCount(0);
});

test('P5-09 έτος χωρίς υπόλοιπα δεν εξάγεται', async ({ page }) => {
  await openTechnical(page);
  await setTechnicalYear(page, '2024');
  await expect(page.locator('[data-testid="technical-rows"]')).toHaveText('0');
  await expect(page.locator('[data-testid="technical-empty"]')).toContainText('2024');
  await expect(page.locator('[data-testid="btn-technical-export"]')).toBeDisabled();
});

test('P5-10 εξαγωγή δεδομένων σε όλους τους ρόλους', async ({ page }) => {
  await expect(page.locator('[data-testid="btn-export"]')).toBeVisible();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-export"]')).toBeVisible();
  await setRole(page, 'USER');
  await expect(page.locator('[data-testid="btn-export"]')).toBeVisible();
});

test('P5-11 προεπιλογή εξαγωγής: χωρίς απενταγμένα, λιγότερα από το σύνολο', async ({ page }) => {
  await openExportData(page);
  await expect(page.locator('[data-testid="export-total"]')).toHaveText('5');
  await expect(page.locator('[data-testid="export-count"]')).toHaveText('4');
  await expect(page.locator('[data-testid="export-filter-banner"]')).toContainText('4 από 5');
  await expect(page.locator('[data-testid="export-row-sub-abandoned"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="export-row-sub-paid"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="export-row-sub-bridge"]')).toBeVisible();
});

test('P5-12 χωρίς στήλες δεν εξάγεται', async ({ page }) => {
  await openExportData(page);
  await page.locator('[data-testid="btn-export-clear-fields"]').click();
  await expect(page.locator('[data-testid="btn-export-commit"]')).toBeDisabled();
  await expect(page.locator('[data-testid="export-fields"]')).toHaveText('0');
});

test('P5-13 ρητό φίλτρο απενταγμένου τα βάζει στην εξαγωγή', async ({ page }) => {
  await setQuickStatus(page, 'ΑΠΕΝΤΑΓΜΕΝΟ');
  await openExportData(page);
  await expect(page.locator('[data-testid="export-row-sub-abandoned"]')).toBeVisible();
  await expect(page.locator('[data-testid="export-count"]')).toHaveText('1');
});

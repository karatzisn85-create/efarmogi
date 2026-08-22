'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  setRole,
  setQuickStatus,
  toggleArchived,
  openPdfReports,
  setPdfTab,
  openCardReport,
} = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P6-01 αναφορές PDF σε όλους τους ρόλους', async ({ page }) => {
  await expect(page.locator('[data-testid="btn-pdf"]')).toBeVisible();
  await setRole(page, 'SUPERADMIN');
  await expect(page.locator('[data-testid="btn-pdf"]')).toBeVisible();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-pdf"]')).toBeVisible();
  await setRole(page, 'USER');
  await expect(page.locator('[data-testid="btn-pdf"]')).toBeVisible();
});

test('P6-02 προεπιλογή: ίδια λίστα με την εξαγωγή — χωρίς απενταγμένα / αποπληρωμένα', async ({ page }) => {
  await openPdfReports(page);
  await expect(page.locator('[data-testid="pdf-total"]')).toHaveText('4');
  await expect(page.locator('[data-testid="pdf-executing"]')).toHaveText('2');
  await expect(page.locator('[data-testid="pdf-completed"]')).toHaveText('0');
  await expect(page.locator('[data-testid="pdf-row-sub-bridge"]')).toBeVisible();
  await expect(page.locator('[data-testid="pdf-row-sub-abandoned"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="pdf-row-sub-paid"]')).toHaveCount(0);
});

test('P6-03 καρτέλες αναφοράς αλλάζουν τον τίτλο', async ({ page }) => {
  await openPdfReports(page);
  await expect(page.locator('[data-testid="pdf-tab-subprojects"]')).toBeVisible();
  await expect(page.locator('[data-testid="pdf-tab-entaxeis"]')).toBeVisible();
  await expect(page.locator('[data-testid="pdf-tab-proskliseis"]')).toBeVisible();
  await expect(page.locator('[data-testid="pdf-tab-egkriseis"]')).toBeVisible();
  await expect(page.locator('[data-testid="pdf-tab-name"]')).toHaveText('Αναφορά Υποέργων');
  await setPdfTab(page, 'entaxeis');
  await expect(page.locator('[data-testid="pdf-tab-name"]')).toHaveText('Αναφορά Εντάξεων');
  await setPdfTab(page, 'proskliseis');
  await expect(page.locator('[data-testid="pdf-tab-name"]')).toHaveText('Αναφορά Προσκλήσεων');
  await setPdfTab(page, 'egkriseis');
  await expect(page.locator('[data-testid="pdf-tab-name"]')).toHaveText('Αναφορά Εγκρίσεων Διάθεσης Πίστωσης');
});

test('P6-04 αποθήκευση ενεργή όταν η προεπισκόπηση είναι έτοιμη', async ({ page }) => {
  await openPdfReports(page);
  await expect(page.locator('[data-testid="btn-pdf-save"]')).toBeEnabled();
});

test('P6-05 στην αναφορά PDF το αποπληρωμένο μετρά ως ολοκληρωμένο', async ({ page }) => {
  await toggleArchived(page);
  await openPdfReports(page);
  await expect(page.locator('[data-testid="pdf-total"]')).toHaveText('1');
  await expect(page.locator('[data-testid="pdf-completed"]')).toHaveText('1');
  await expect(page.locator('[data-testid="pdf-executing"]')).toHaveText('0');
});

test('P6-06 κουμπί αναφοράς κάρτας σε όσα υποέργα φαίνονται', async ({ page }) => {
  await expect(page.locator('[data-testid="card-report-sub-bridge"]')).toBeVisible();
  await setRole(page, 'USER');
  await expect(page.locator('[data-testid="card-report-sub-bridge"]')).toBeVisible();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="card-report-sub-bridge"]')).toBeVisible();
  await expect(page.locator('[data-testid="card-report-sub-tank"]')).toHaveCount(0);
});

test('P6-07 αναφορά κάρτας: μόνο συνδεδεμένη πρόσκληση του έργου', async ({ page }) => {
  await openCardReport(page, 'sub-bridge');
  await expect(page.locator('[data-testid="card-report-psk-psk-schools"]')).toBeVisible();
  await expect(page.locator('[data-testid="card-report-psk-psk-far"]')).toHaveCount(0);
});

test('P6-08 αναφορά κάρτας: μόνο ένταξη του υποέργου', async ({ page }) => {
  await openCardReport(page, 'sub-bridge');
  await expect(page.locator('[data-testid="card-report-ent-ent-road"]')).toBeVisible();
  await expect(page.locator('[data-testid="card-report-ent-ent-water"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="card-report-ent-ent-orphan"]')).toHaveCount(0);
});

test('P6-09 ρητό φίλτρο απενταγμένου τα βάζει στην αναφορά PDF', async ({ page }) => {
  await setQuickStatus(page, 'ΑΠΕΝΤΑΓΜΕΝΟ');
  await openPdfReports(page);
  await expect(page.locator('[data-testid="pdf-row-sub-abandoned"]')).toBeVisible();
  await expect(page.locator('[data-testid="pdf-total"]')).toHaveText('1');
});

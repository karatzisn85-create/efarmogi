'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  setRole,
  search,
  card,
  readPersisted,
  runExcelScenario,
  setExcelExisting,
  setExcelDupPolicy,
  commitExcel,
} = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P4-35 μαζική εισαγωγή μόνο στον υπερδιαχειριστή', async ({ page }) => {
  await expect(page.locator('[data-testid="btn-excel"]')).toBeHidden();
  await setRole(page, 'ADMIN');
  await expect(page.locator('[data-testid="btn-excel"]')).toBeHidden();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-excel"]')).toBeHidden();
  await setRole(page, 'USER');
  await expect(page.locator('[data-testid="btn-excel"]')).toBeHidden();
  await setRole(page, 'SUPERADMIN');
  await expect(page.locator('[data-testid="btn-excel"]')).toBeVisible();
});

test('P4-36 αρχείο που δεν διαβάστηκε δεν εισάγεται', async ({ page }) => {
  await setRole(page, 'SUPERADMIN');
  await runExcelScenario(page, 'parse_error');
  await expect(page.locator('[data-testid="excel-block"]')).toBeVisible();
  await expect(page.locator('[data-testid="btn-excel-commit"]')).toBeDisabled();
  await expect(card(page, 'sub-bridge')).toBeVisible();
});

test('P4-37 γραμμές με λάθη δεν εισάγονται', async ({ page }) => {
  await setRole(page, 'SUPERADMIN');
  await runExcelScenario(page, 'row_errors');
  await expect(page.locator('[data-testid="excel-block"]')).toContainText('δεν μπορεί να προχωρήσει');
  await expect(page.locator('[data-testid="btn-excel-commit"]')).toBeDisabled();
  await expect(page.locator('[data-testid="excel-errors"]')).toHaveText('1');
});

test('P4-38 χωρίς έγκυρες γραμμές δεν προχωρά', async ({ page }) => {
  await setRole(page, 'SUPERADMIN');
  await runExcelScenario(page, 'empty_valid');
  await expect(page.locator('[data-testid="excel-empty"]')).toBeVisible();
  await expect(page.locator('[data-testid="btn-excel-commit"]')).toBeDisabled();
});

test('P4-39 καθαρό αρχείο δημιουργεί νέες κάρτες', async ({ page }) => {
  await setRole(page, 'SUPERADMIN');
  await runExcelScenario(page, 'clean_new');
  await expect(page.locator('[data-testid="btn-excel-commit"]')).toBeEnabled();
  await commitExcel(page);
  await expect(page.locator('[data-testid="excel-created"]')).toHaveText('2');
  await expect(page.locator('[data-testid="excel-updated"]')).toHaveText('0');
  await search(page, 'Άρδευση Τεμένους');
  await expect(page.locator('[data-testid="card-imp-sub-1"]')).toBeVisible();
  await expect(page.locator('[data-testid="card-imp-sub-2"]')).toBeVisible();
  await expect(page.locator('[data-testid="card-imp-sub-1"]')).toContainText('Δίκτυο Άνω Αρχανών');
});

test('P4-40 διπλότυπο με παράλειψη κρατά το υπάρχον', async ({ page }) => {
  await setRole(page, 'SUPERADMIN');
  await runExcelScenario(page, 'with_duplicate');
  await setExcelDupPolicy(page, 'skip');
  await commitExcel(page);
  await expect(page.locator('[data-testid="excel-created"]')).toHaveText('1');
  await expect(page.locator('[data-testid="excel-skipped"]')).toHaveText('1');
  await search(page, 'Γέφυρα Αγίου Σύλλα');
  await expect(card(page, 'sub-bridge')).toContainText('ΚΑ-100');
  await search(page, 'Νέο υποέργο εισαγωγής');
  await expect(page.locator('[data-testid="card-imp-sub-1"]')).toBeVisible();
});

test('P4-41 διπλότυπο με ενημέρωση αλλάζει στοιχεία, ίδια ταυτότητα', async ({ page }) => {
  await setRole(page, 'SUPERADMIN');
  await runExcelScenario(page, 'with_duplicate');
  await setExcelDupPolicy(page, 'update');
  await commitExcel(page);
  await expect(page.locator('[data-testid="excel-updated"]')).toHaveText('1');
  await expect(page.locator('[data-testid="excel-created"]')).toHaveText('1');
  await search(page, 'Γέφυρα Αγίου Σύλλα');
  await expect(card(page, 'sub-bridge')).toContainText('ΚΑ-999');
  const dump = await readPersisted(page);
  const bridge = dump.projects.find((p) => p.subprojectId === 'sub-bridge');
  expect(bridge.projectId).toBe('proj-road');
  expect(bridge.kaCode).toBe('ΚΑ-999');
});

test('P4-42 διπλότυπο με δημιουργία νέου προσθέτει δεύτερη κάρτα', async ({ page }) => {
  await setRole(page, 'SUPERADMIN');
  await runExcelScenario(page, 'with_duplicate');
  await setExcelDupPolicy(page, 'create');
  await commitExcel(page);
  await expect(page.locator('[data-testid="excel-created"]')).toHaveText('2');
  await search(page, 'Γέφυρα Αγίου Σύλλα');
  await expect(card(page, 'sub-bridge')).toBeVisible();
  await expect(page.locator('[data-testid="card-imp-sub-1"]')).toBeVisible();
  await expect(page.locator('[data-testid="card-imp-sub-1"]')).toContainText('Γέφυρα Αγίου Σύλλα');
});

test('P4-43 πλήρης διαγραφή αντικαθιστά τα υπάρχοντα', async ({ page }) => {
  await setRole(page, 'SUPERADMIN');
  await runExcelScenario(page, 'with_duplicate');
  await setExcelExisting(page, 'wipe');
  await expect(page.locator('[data-testid="excel-dup-choice"]')).toBeHidden();
  await commitExcel(page);
  await expect(page.locator('[data-testid="excel-deleted-wrap"]')).toBeVisible();
  await expect(page.locator('[data-testid="excel-created"]')).toHaveText('2');
  await search(page, 'Γέφυρα Αγίου Σύλλα');
  await expect(card(page, 'sub-bridge')).toHaveCount(0);
  await expect(page.locator('[data-testid^="card-imp-sub-"]')).toHaveCount(1);
  await search(page, 'Νέο υποέργο εισαγωγής');
  await expect(page.locator('[data-testid^="card-imp-sub-"]')).toHaveCount(1);
});

test('P4-44 επιλογή διπλοτύπου μόνο όταν κρατάμε τα υπάρχοντα', async ({ page }) => {
  await setRole(page, 'SUPERADMIN');
  await runExcelScenario(page, 'with_duplicate');
  await expect(page.locator('[data-testid="excel-existing-choice"]')).toBeVisible();
  await expect(page.locator('[data-testid="excel-dup-choice"]')).toBeVisible();
  await setExcelExisting(page, 'wipe');
  await expect(page.locator('[data-testid="excel-dup-choice"]')).toBeHidden();
  await setExcelExisting(page, 'keep');
  await expect(page.locator('[data-testid="excel-dup-choice"]')).toBeVisible();
});

test('P4-45 ίδιος τίτλος με άλλα κεφαλαία ή κενά μετρά ως διπλότυπο', async ({ page }) => {
  await setRole(page, 'SUPERADMIN');
  await runExcelScenario(page, 'case_spaces');
  await expect(page.locator('[data-testid="excel-dup-choice"]')).toBeVisible();
  await expect(page.locator('[data-testid="excel-dup-count"]')).toHaveText('1');
  await commitExcel(page);
  await expect(page.locator('[data-testid="excel-skipped"]')).toHaveText('1');
  await expect(page.locator('[data-testid="excel-created"]')).toHaveText('0');
  await search(page, 'Γέφυρα Αγίου Σύλλα');
  await expect(card(page, 'sub-bridge')).toContainText('ΚΑ-100');
});

'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  setRole,
  openApo,
  searchApo,
  setApoFilter,
  apoCard,
  addApoFromPaid,
  fillApoLegacy,
  submitApoLegacy,
} = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P11-01 απολογισμός μόνο στον υπερδιαχειριστή', async ({ page }) => {
  await expect(page.locator('[data-testid="btn-apo"]')).toBeHidden();
  await setRole(page, 'SUPERADMIN');
  await expect(page.locator('[data-testid="btn-apo"]')).toBeVisible();
  await setRole(page, 'ADMIN');
  await expect(page.locator('[data-testid="btn-apo"]')).toBeHidden();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-apo"]')).toBeHidden();
  await setRole(page, 'USER');
  await expect(page.locator('[data-testid="btn-apo"]')).toBeHidden();
});

test('P11-02 κενός απολογισμός: μήνυμα ένταξης', async ({ page }) => {
  await openApo(page);
  const empty = page.locator('[data-testid="apo-empty"]');
  await expect(empty).toBeVisible();
  await expect(empty).toContainText('ολοκληρωμένα');
  await expect(empty).toContainText('παλαιότερο');
  await expect(page.locator('[data-testid="apo-period-label"]')).toContainText('2024–2028');
});

test('P11-03 εκτελούμενο δεν εμφανίζεται στα ολοκληρωμένα', async ({ page }) => {
  await openApo(page);
  await page.locator('[data-testid="btn-apo-eligible"]').click();
  await expect(page.locator('[data-testid="apo-eligible-sub-paid"]')).toBeVisible();
  await expect(page.locator('[data-testid="apo-eligible-sub-lights"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="apo-eligible-sub-abandoned"]')).toHaveCount(0);
});

test('P11-04 ολοκληρωμένο εντάσσεται ως εκκρεμές', async ({ page }) => {
  await openApo(page);
  await addApoFromPaid(page);
  const card = apoCard(page, 'apo-1');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Αίθουσα εκδηλώσεων');
  await expect(card).toContainText('Εκκρεμές');
  await expect(page.locator('[data-testid="apo-counts"]')).toContainText('0 έτοιμες');
});

test('P11-05 το ίδιο υποέργο δεν εντάσσεται δεύτερη φορά', async ({ page }) => {
  await openApo(page);
  await addApoFromPaid(page);
  await page.locator('[data-testid="btn-apo-eligible"]').click();
  await expect(page.locator('[data-testid="apo-eligible-empty"]')).toBeVisible();
  await expect(page.locator('[data-testid="apo-eligible-sub-paid"]')).toHaveCount(0);
});

test('P11-06 παλαιότερο χωρίς τίτλο δεν καταχωρείται', async ({ page }) => {
  await openApo(page);
  await page.locator('[data-testid="btn-apo-legacy"]').click();
  await fillApoLegacy(page, {
    title: '',
    area: 'Αρχάνες',
    year: '2025',
    approved: '10.000,00',
    contract: '9.000,00',
  });
  await submitApoLegacy(page);
  await expect(page.locator('[data-testid="apo-error"]')).toContainText('τίτλος');
  await expect(apoCard(page, 'apo-1')).toHaveCount(0);
});

test('P11-07 παλαιότερο εκτός περιόδου δεν καταχωρείται', async ({ page }) => {
  await openApo(page);
  await page.locator('[data-testid="btn-apo-legacy"]').click();
  await fillApoLegacy(page, {
    title: 'Παλιό υδραγωγείο',
    area: 'Χουδέτσι',
    year: '2018',
    approved: '10.000,00',
    contract: '9.000,00',
  });
  await submitApoLegacy(page);
  await expect(page.locator('[data-testid="apo-error"]')).toContainText(/δεν ανήκει/);
  await expect(apoCard(page, 'apo-1')).toHaveCount(0);
});

test('P11-08 παλαιότερο με έγκυρα στοιχεία εμφανίζεται', async ({ page }) => {
  await openApo(page);
  await page.locator('[data-testid="btn-apo-legacy"]').click();
  await fillApoLegacy(page, {
    title: 'Παλιό υδραγωγείο',
    area: 'Χουδέτσι',
    year: '2025',
    approved: '10.000,00',
    contract: '9.000,00',
  });
  await submitApoLegacy(page);
  await expect(apoCard(page, 'apo-1')).toContainText('Παλιό υδραγωγείο');
  await expect(apoCard(page, 'apo-1')).toContainText('Χουδέτσι');
});

test('P11-09 αναζήτηση: τίτλος και έργο ναι, ΚΑ όχι', async ({ page }) => {
  await openApo(page);
  await addApoFromPaid(page);
  await searchApo(page, 'σχολείου');
  await expect(apoCard(page, 'apo-1')).toBeVisible();
  await searchApo(page, 'ΚΑ-400');
  await expect(apoCard(page, 'apo-1')).toHaveCount(0);
  await expect(page.locator('[data-testid="apo-none"]')).toBeVisible();
});

test('P11-10 αναζήτηση περιοχής', async ({ page }) => {
  await openApo(page);
  await addApoFromPaid(page);
  await searchApo(page, 'Αρχανών');
  await expect(apoCard(page, 'apo-1')).toBeVisible();
  await searchApo(page, 'Χουδέτσι');
  await expect(apoCard(page, 'apo-1')).toHaveCount(0);
});

test('P11-11 φίλτρο εκκρεμών / έτοιμων', async ({ page }) => {
  await openApo(page);
  await addApoFromPaid(page);
  await setApoFilter(page, 'ready');
  await expect(apoCard(page, 'apo-1')).toHaveCount(0);
  await setApoFilter(page, 'pending');
  await expect(apoCard(page, 'apo-1')).toBeVisible();
});

test('P11-12 χωρίς έτοιμες κάρτες η παρουσίαση δεν ανοίγει', async ({ page }) => {
  await openApo(page);
  await addApoFromPaid(page);
  await page.locator('[data-testid="btn-apo-present"]').click();
  await expect(page.locator('[data-testid="apo-present"]')).toContainText(/έτοιμες κάρτες/);
});

test('P11-13 ολοκλήρωση κάρτας: γίνεται έτοιμη και ανοίγει παρουσίαση', async ({ page }) => {
  await openApo(page);
  await addApoFromPaid(page);
  await apoCard(page, 'apo-1').click();
  await page.locator('[data-testid="btn-apo-complete"]').click();
  await expect(apoCard(page, 'apo-1')).toContainText('Έτοιμο');
  await setApoFilter(page, 'ready');
  await expect(apoCard(page, 'apo-1')).toBeVisible();
  await page.locator('[data-testid="btn-apo-present"]').click();
  await expect(page.locator('[data-testid="apo-present"]')).toHaveText('Παρουσίαση έτοιμη');
});

test('P11-14 αφαίρεση κάρτας με επιβεβαίωση', async ({ page }) => {
  await openApo(page);
  await addApoFromPaid(page);
  await apoCard(page, 'apo-1').click();
  await page.locator('[data-testid="btn-apo-delete"]').click();
  await expect(page.locator('[data-testid="apo-delete-confirm"]')).toBeVisible();
  await page.locator('[data-testid="btn-apo-delete-confirm"]').click();
  await expect(apoCard(page, 'apo-1')).toHaveCount(0);
  await expect(page.locator('[data-testid="apo-empty"]')).toBeVisible();
});

test('P11-15 ανάποδα έτη περιόδου απορρίπτονται', async ({ page }) => {
  await openApo(page);
  await page.locator('[data-testid="apo-period-start"]').fill('2029');
  await page.locator('[data-testid="apo-period-end"]').fill('2024');
  await page.locator('[data-testid="btn-apo-period-save"]').click();
  await expect(page.locator('[data-testid="apo-error"]')).toContainText(/έτη περιόδου/);
  await expect(page.locator('[data-testid="apo-period-label"]')).toContainText('2024–2028');
});

'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  setRole,
  openEntaxeis,
  searchEntaxeis,
  toggleEntaxiUnlinked,
  entCard,
} = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P3-14 ομαδοποίηση εντάξεων ανά τίτλο έργου', async ({ page }) => {
  await openEntaxeis(page);
  const road = page.locator('[data-testid="ent-group-Οδικό δίκτυο Αρχανών"]');
  await expect(road.locator('[data-testid="ent-card-ent-road"]')).toBeVisible();
  await expect(road.locator('[data-testid="ent-card-ent-mod"]')).toBeVisible();
  await expect(page.locator('[data-testid="ent-group-Ύδρευση Αστερουσίων"] [data-testid="ent-card-ent-water"]'))
    .toBeVisible();
  await expect(page.locator('[data-testid="ent-group-unlinked"] [data-testid="ent-card-ent-free"]'))
    .toBeVisible();
});

test('P3-15 αναζήτηση μόνο στο τρέχον θέμα / έργο', async ({ page }) => {
  await openEntaxeis(page);
  await searchEntaxeis(page, 'γέφυρας');
  await expect(entCard(page, 'ent-road')).toBeVisible();
  await expect(entCard(page, 'ent-water')).toHaveCount(0);
  await searchEntaxeis(page, '160.000');
  await expect(entCard(page, 'ent-mod')).toHaveCount(0);
});

test('P3-16 χωρίς έργο: κενός τίτλος ή χωρίς υποέργο', async ({ page }) => {
  await openEntaxeis(page);
  await toggleEntaxiUnlinked(page);
  await expect(entCard(page, 'ent-free')).toBeVisible();
  await expect(entCard(page, 'ent-orphan')).toBeVisible();
  await expect(entCard(page, 'ent-road')).toHaveCount(0);
  await expect(entCard(page, 'ent-water')).toHaveCount(0);
});

test('P3-17 τροποποίηση ποσού αντικαθιστά το σύνολο, δεν το προσθέτει', async ({ page }) => {
  await openEntaxeis(page);
  await expect(entCard(page, 'ent-mod').locator('[data-field="amount"]')).toHaveText('155.285,47');
  await expect(entCard(page, 'ent-road').locator('[data-field="amount"]')).toHaveText('100.000,00');
});

test('P3-18 μηχανικός και χρήστης δεν βλέπουν Νέα Ένταξη', async ({ page }) => {
  await openEntaxeis(page);
  await expect(page.locator('[data-testid="btn-new-entaxi"]')).toBeVisible();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-new-entaxi"]')).toBeHidden();
  await setRole(page, 'USER');
  await expect(page.locator('[data-testid="btn-new-entaxi"]')).toBeHidden();
});

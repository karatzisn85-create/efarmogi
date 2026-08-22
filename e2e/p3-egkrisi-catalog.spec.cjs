'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  setRole,
  openEgkriseis,
  searchEgkriseis,
  egkCard,
  egkSub,
} = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P3-19 ομαδοποίηση εγκρίσεων ανά έργο και υποέργο', async ({ page }) => {
  await openEgkriseis(page);
  const road = page.locator('[data-testid="egk-group-Οδικό δίκτυο Αρχανών"]');
  await expect(road.locator('[data-testid="egk-sub-sub-bridge"]')).toBeVisible();
  await expect(road.locator('[data-testid="egk-card-egk-bridge-1"]')).toBeVisible();
  await expect(road.locator('[data-testid="egk-card-egk-lights-1"]')).toBeVisible();
  await expect(page.locator('[data-testid="egk-group-Ύδρευση Αστερουσίων"] [data-testid="egk-card-egk-tank-1"]'))
    .toBeVisible();
});

test('P3-20 αναζήτηση μόνο σε τρέχοντα τίτλο / ΚΑ — η ομάδα μένει ολόκληρη', async ({ page }) => {
  await openEgkriseis(page);
  await searchEgkriseis(page, 'γέφυρα');
  await expect(egkSub(page, 'sub-bridge')).toBeVisible();
  await expect(egkSub(page, 'sub-lights')).toBeVisible();
  await expect(egkSub(page, 'sub-tank')).toHaveCount(0);
  await searchEgkriseis(page, 'ΚΑ-200');
  await expect(egkSub(page, 'sub-tank')).toBeVisible();
  await expect(egkSub(page, 'sub-bridge')).toHaveCount(0);
  await searchEgkriseis(page, 'ΑΔΑ-XYZ');
  await expect(egkCard(page, 'egk-bridge-1')).toHaveCount(0);
  await expect(egkSub(page, 'sub-bridge')).toHaveCount(0);
});

test('P3-21 αρχική και τροποποίηση φαίνονται με τη σωστή ετικέτα', async ({ page }) => {
  await openEgkriseis(page);
  await expect(egkCard(page, 'egk-lights-1').locator('[data-field="type"]')).toHaveText('Αρχική');
  await expect(egkCard(page, 'egk-lights-2').locator('[data-field="type"]')).toHaveText('Τροποποίηση');
});

test('P3-22 αυτόνομο αρχείο: ίδιο τίτλο μπαίνει, άγνωστο και ήδη φορτωμένο όχι', async ({ page }) => {
  await openEgkriseis(page);
  await expect(egkCard(page, 'standalone_plateia_anaplasi_0')).toBeVisible();
  await expect(egkCard(page, 'standalone_plateia_anaplasi_1').locator('[data-field="type"]'))
    .toHaveText('Τροποποίηση');
  await expect(page.locator('[data-field="file"]', { hasText: 'should-not-appear.pdf' })).toHaveCount(0);
  await expect(page.locator('[data-field="file"]', { hasText: 'ghost.pdf' })).toHaveCount(0);
});

test('P3-23 Νέα Έγκριση φαίνεται σε όλους· συσχέτιση / διαγραφή μόνο στον διαχειριστή', async ({ page }) => {
  await openEgkriseis(page);
  await expect(page.locator('[data-testid="btn-new-egkrisi"]')).toBeVisible();
  await expect(page.locator('[data-testid="egk-link-egk-bridge-1"]')).toBeVisible();
  await expect(page.locator('[data-testid="egk-delete-egk-bridge-1"]')).toBeVisible();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-new-egkrisi"]')).toBeVisible();
  await expect(page.locator('[data-testid="egk-link-egk-bridge-1"]')).toBeHidden();
  await expect(page.locator('[data-testid="egk-delete-egk-bridge-1"]')).toBeHidden();
  await setRole(page, 'USER');
  await expect(page.locator('[data-testid="btn-new-egkrisi"]')).toBeVisible();
  await expect(page.locator('[data-testid="egk-link-egk-bridge-1"]')).toBeHidden();
});

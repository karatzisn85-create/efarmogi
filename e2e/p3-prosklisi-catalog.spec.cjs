'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  setRole,
  openProskliseis,
  setProsklisiTab,
  searchProskliseis,
  toggleExpiringSoon,
  toggleUnlinked,
  pskCard,
} = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P3-07 ενεργές: ανοιχτές με ισχύουσα λήξη, όχι ληγμένες ή υποβληθείσες', async ({ page }) => {
  await openProskliseis(page);
  await expect(pskCard(page, 'psk-schools')).toBeVisible();
  await expect(pskCard(page, 'psk-far')).toBeVisible();
  await expect(pskCard(page, 'psk-modded')).toBeVisible();
  await expect(pskCard(page, 'psk-expired')).toHaveCount(0);
  await expect(pskCard(page, 'psk-submitted')).toHaveCount(0);
});

test('P3-08 καρτέλες ληγμένων και υποβληθεισών', async ({ page }) => {
  await openProskliseis(page);
  await setProsklisiTab(page, 'expired');
  await expect(pskCard(page, 'psk-expired')).toBeVisible();
  await expect(pskCard(page, 'psk-schools')).toHaveCount(0);
  await setProsklisiTab(page, 'submitted');
  await expect(pskCard(page, 'psk-submitted')).toBeVisible();
  await expect(pskCard(page, 'psk-expired')).toHaveCount(0);
});

test('P3-09 λήγουν σύντομα κρύβει τη μακρινή', async ({ page }) => {
  await openProskliseis(page);
  await toggleExpiringSoon(page);
  await expect(pskCard(page, 'psk-schools')).toBeVisible();
  await expect(pskCard(page, 'psk-modded')).toBeVisible();
  await expect(pskCard(page, 'psk-far')).toHaveCount(0);
});

test('P3-10 χωρίς έργο δείχνει μόνο όσες δεν έχουν σύνδεση', async ({ page }) => {
  await openProskliseis(page);
  await toggleUnlinked(page);
  await expect(pskCard(page, 'psk-far')).toBeVisible();
  await expect(pskCard(page, 'psk-schools')).toHaveCount(0);
});

test('P3-11 αναζήτηση μόνο με τρέχοντα κωδικό / τίτλο', async ({ page }) => {
  await openProskliseis(page);
  await searchProskliseis(page, 'PSK-100');
  await expect(pskCard(page, 'psk-schools')).toBeVisible();
  await expect(pskCard(page, 'psk-far')).toHaveCount(0);
  await searchProskliseis(page, 'μακρινή');
  await expect(pskCard(page, 'psk-far')).toBeVisible();
  await expect(pskCard(page, 'psk-schools')).toHaveCount(0);
});

test('P3-12 τροποποίηση λήξης: μετράει η νέα ημερομηνία, όχι η παλιά', async ({ page }) => {
  await openProskliseis(page);
  await expect(pskCard(page, 'psk-modded')).toBeVisible();
  await expect(pskCard(page, 'psk-modded').locator('[data-field="deadline"]'))
    .not.toHaveText(/-400/);
  await setProsklisiTab(page, 'expired');
  await expect(pskCard(page, 'psk-modded')).toHaveCount(0);
});

test('P3-13 μηχανικός και απλός χρήστης δεν βλέπουν Νέα Πρόσκληση', async ({ page }) => {
  await openProskliseis(page);
  await expect(page.locator('[data-testid="btn-new-prosklisi"]')).toBeVisible();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-new-prosklisi"]')).toBeHidden();
  await setRole(page, 'USER');
  await expect(page.locator('[data-testid="btn-new-prosklisi"]')).toBeHidden();
});

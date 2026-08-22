'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  setRole,
  openCalendar,
  setCalendarType,
  setCalendarWindow,
  calEvent,
  calRadar,
} = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P3-01 κοντινή πρόσκληση φαίνεται στο ραντάρ και στη λίστα', async ({ page }) => {
  await openCalendar(page);
  await expect(calEvent(page, 'psk-schools')).toBeVisible();
  await expect(calRadar(page, 'psk-schools')).toBeVisible();
  await expect(calEvent(page, 'psk-schools')).toContainText('Πρόσκληση σχολείων');
});

test('P3-02 μακρινή πρόσκληση κρύβεται στον μήνα και φαίνεται στο έτος', async ({ page }) => {
  await openCalendar(page);
  await expect(calEvent(page, 'psk-far')).toHaveCount(0);
  await setCalendarWindow(page, 365);
  await expect(calEvent(page, 'psk-far')).toBeVisible();
});

test('P3-03 φίλτρο ειδοποιήσεων κρύβει τις προσκλήσεις', async ({ page }) => {
  await openCalendar(page);
  await setCalendarType(page, 'custom');
  await expect(calEvent(page, 'evt-all')).toBeVisible();
  await expect(calEvent(page, 'psk-schools')).toHaveCount(0);
});

test('P3-04 χρήστης δεν βλέπει ειδοποίηση μόνο για μηχανικούς', async ({ page }) => {
  await setRole(page, 'USER');
  await openCalendar(page);
  await expect(calEvent(page, 'evt-all')).toBeVisible();
  await expect(calEvent(page, 'evt-eng')).toHaveCount(0);
  await setRole(page, 'ENGINEER');
  await expect(calEvent(page, 'evt-eng')).toBeVisible();
});

test('P3-05 φίλτρο προσκλήσεων δείχνει μόνο προσκλήσεις', async ({ page }) => {
  await openCalendar(page);
  await setCalendarType(page, 'proskliseis');
  await expect(calEvent(page, 'psk-schools')).toBeVisible();
  await expect(calEvent(page, 'evt-all')).toHaveCount(0);
});

test('P3-06 κλικ στην πρόσκληση ανοίγει την προθεσμία', async ({ page }) => {
  await openCalendar(page);
  await calEvent(page, 'psk-schools').click();
  await expect(page.locator('[data-testid="calendar-detail"]')).toBeVisible();
  await expect(page.locator('[data-testid="calendar-detail-title"]')).toHaveText('Πρόσκληση σχολείων');
  await expect(page.locator('[data-testid="calendar-detail-label"]')).toHaveText('Λήξη υποβολής πρόσκλησης');
});

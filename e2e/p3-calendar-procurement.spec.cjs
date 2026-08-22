'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  setRole,
  openCalendar,
  setCalendarType,
  setCalendarWindow,
  calEvent,
  openCustomCreate,
  fillCustomCreate,
  submitCustomCreate,
} = require('./harness/harness-helpers.cjs');

function isoDaysFromToday(offset) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P3-41 καταληκτική ΚΗΜΔΗΣ φαίνεται· ακυρωμένη όχι', async ({ page }) => {
  await openCalendar(page);
  await expect(calEvent(page, 'deadline-sub-tender')).toBeVisible();
  await expect(calEvent(page, 'deadline-sub-tender')).toContainText('Διαγωνισμός Η/Υ');
  await expect(calEvent(page, 'deadline-sub-tender')).toContainText('Καταληκτική υποβολής προσφορών');
  await expect(calEvent(page, 'deadline-sub-notice-cancelled')).toHaveCount(0);
});

test('P3-42 λήξη ισχύος προσφορών μόνο στο μεγαλύτερο παράθυρο', async ({ page }) => {
  await openCalendar(page);
  await expect(calEvent(page, 'deadline-sub-tender')).toBeVisible();
  await expect(calEvent(page, 'offers_expiry-sub-tender')).toHaveCount(0);
  await setCalendarWindow(page, 365);
  await expect(calEvent(page, 'offers_expiry-sub-tender')).toBeVisible();
  await expect(calEvent(page, 'offers_expiry-sub-tender')).toContainText('Λήξη ισχύος προσφορών');
});

test('P3-43 λήξη σύμβασης με ποσό φαίνεται· χωρίς ποσό όχι', async ({ page }) => {
  await openCalendar(page);
  await expect(calEvent(page, 'contract_end-sub-signed')).toBeVisible();
  await expect(calEvent(page, 'contract_end-sub-signed')).toContainText('Σύμβαση φωτισμού');
  await expect(calEvent(page, 'contract_end-sub-signed')).toContainText('Λήξη σύμβασης');
  await expect(calEvent(page, 'contract_end-sub-zero-contract')).toHaveCount(0);
});

test('P3-44 φίλτρο συμβάσεων κρύβει καταληκτικές ΚΗΜΔΗΣ', async ({ page }) => {
  await openCalendar(page);
  await setCalendarType(page, 'contracts');
  await expect(calEvent(page, 'contract_end-sub-signed')).toBeVisible();
  await expect(calEvent(page, 'deadline-sub-tender')).toHaveCount(0);
  await expect(calEvent(page, 'psk-schools')).toHaveCount(0);
  await setCalendarType(page, 'deadlines');
  await expect(calEvent(page, 'deadline-sub-tender')).toBeVisible();
  await expect(calEvent(page, 'contract_end-sub-signed')).toHaveCount(0);
});

test('P3-45 κενή ειδοποίηση δεν αποθηκεύει', async ({ page }) => {
  await openCalendar(page);
  await openCustomCreate(page);
  await submitCustomCreate(page);
  await expect(page.locator('[data-testid="custom-create-error"]')).toBeVisible();
  await expect(page.locator('[data-testid="custom-create-error"]')).toHaveText('Συμπληρώστε τίτλο.');
  await expect(page.locator('[data-testid="custom-create-panel"]')).toBeVisible();
  await expect(calEvent(page, 'evt-created')).toHaveCount(0);
});

test('P3-46 νέα ειδοποίηση εμφανίζεται· μόνο μηχανικοί την κρύβει από χρήστη', async ({ page }) => {
  await openCalendar(page);
  await openCustomCreate(page);
  await fillCustomCreate(page, {
    title: 'Υποβολή στοιχείων στην ΕΑΔΗΣΥ',
    date: isoDaysFromToday(15),
    engineerOnly: true,
  });
  await submitCustomCreate(page);
  await expect(page.locator('[data-testid="custom-create-panel"]')).toBeHidden();
  await expect(calEvent(page, 'evt-created')).toBeVisible();
  await expect(calEvent(page, 'evt-created')).toContainText('Υποβολή στοιχείων στην ΕΑΔΗΣΥ');
  await setRole(page, 'USER');
  await expect(calEvent(page, 'evt-created')).toHaveCount(0);
  await setRole(page, 'ENGINEER');
  await expect(calEvent(page, 'evt-created')).toBeVisible();
});

test('P3-47 μηχανικός δεν βλέπει νέα προθεσμία', async ({ page }) => {
  await setRole(page, 'ENGINEER');
  await openCalendar(page);
  await expect(page.locator('[data-testid="btn-new-custom"]')).toBeHidden();
  await setRole(page, 'USER');
  await expect(page.locator('[data-testid="btn-new-custom"]')).toBeHidden();
});

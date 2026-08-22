'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  openEntaxeis,
  openProskliseis,
  entCard,
  pskCard,
  openNewEntaxi,
  fillNewEntaxi,
  submitNewEntaxi,
  requestEntaxiDelete,
  openNewProsklisi,
  fillNewProsklisi,
  submitNewProsklisi,
  requestProsklisiDelete,
  confirmWorkflowDelete,
} = require('./harness/harness-helpers.cjs');

const completeEntaxi = {
  documentDate: '2026-03-12',
  fundingAuthority: 'ΠΕΠ Κρήτης',
  initialAmount: '25.000,00',
  subject: 'Νέα ένταξη δοκιμής',
  hasPdf: true,
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P3-35 κενή φόρμα νέας ένταξης δεν αποθηκεύει', async ({ page }) => {
  await openEntaxeis(page);
  await openNewEntaxi(page);
  await submitNewEntaxi(page);
  await expect(page.locator('[data-testid="ent-create-errors"]')).toBeVisible();
  await expect(page.locator('[data-error-field="documentDate"]')).toHaveText('Η ημερομηνία είναι υποχρεωτική');
  await expect(page.locator('[data-error-field="fundingAuthority"]')).toHaveText('Ο φορέας χρηματοδότησης είναι υποχρεωτικός');
  await expect(page.locator('[data-error-field="initialAmount"]')).toHaveText('Το ποσό είναι υποχρεωτικό');
  await expect(page.locator('[data-error-field="subject"]')).toHaveText('Το θέμα είναι υποχρεωτικό');
  await expect(page.locator('[data-error-field="entaxiPDFs"]')).toHaveText('Τουλάχιστον ένα αρχείο ένταξης είναι υποχρεωτικό');
  await expect(page.locator('[data-testid="entaxi-create-panel"]')).toBeVisible();
  await expect(entCard(page, 'ent-created')).toHaveCount(0);
});

test('P3-36 νέα ένταξη με τα υποχρεωτικά εμφανίζεται στον κατάλογο', async ({ page }) => {
  await openEntaxeis(page);
  await openNewEntaxi(page);
  await fillNewEntaxi(page, completeEntaxi);
  await submitNewEntaxi(page);
  await expect(page.locator('[data-testid="entaxi-create-panel"]')).toBeHidden();
  await expect(entCard(page, 'ent-created')).toBeVisible();
  await expect(entCard(page, 'ent-created').locator('h3')).toHaveText('Νέα ένταξη δοκιμής');
  await expect(page.locator('[data-testid="ent-group-unlinked"] [data-testid="ent-card-ent-created"]'))
    .toBeVisible();
});

test('P3-37 διαγραφή ένταξης με επιβεβαίωση την αφαιρεί', async ({ page }) => {
  await openEntaxeis(page);
  await expect(entCard(page, 'ent-free')).toBeVisible();
  await requestEntaxiDelete(page, 'ent-free');
  await expect(page.locator('[data-testid="workflow-delete-title"]')).toHaveText('Διαγραφή Ένταξης');
  await confirmWorkflowDelete(page);
  await expect(entCard(page, 'ent-free')).toHaveCount(0);
  await expect(entCard(page, 'ent-road')).toBeVisible();
});

test('P3-38 κενή φόρμα νέας πρόσκλησης δεν αποθηκεύει', async ({ page }) => {
  await openProskliseis(page);
  await openNewProsklisi(page);
  await submitNewProsklisi(page);
  await expect(page.locator('[data-testid="psk-create-errors"]')).toBeVisible();
  await expect(page.locator('[data-error-field="title"]')).toHaveText('Ο τίτλος είναι υποχρεωτικός');
  await expect(page.locator('[data-error-field="axis"]')).toHaveText('Ο άξονας προτεραιότητας είναι υποχρεωτικός');
  await expect(page.locator('[data-testid="psk-create-panel"]')).toBeVisible();
  await expect(pskCard(page, 'psk-created')).toHaveCount(0);
});

test('P3-39 νέα πρόσκληση με τίτλο και άξονα εμφανίζεται στις ενεργές', async ({ page }) => {
  await openProskliseis(page);
  await openNewProsklisi(page);
  await fillNewProsklisi(page, {
    title: 'Νέα πρόσκληση δοκιμής',
    axis: 'Άξονας 1',
  });
  await submitNewProsklisi(page);
  await expect(page.locator('[data-testid="psk-create-panel"]')).toBeHidden();
  await expect(pskCard(page, 'psk-created')).toBeVisible();
  await expect(pskCard(page, 'psk-created').locator('h3')).toHaveText('Νέα πρόσκληση δοκιμής');
});

test('P3-40 διαγραφή πρόσκλησης με επιβεβαίωση την αφαιρεί', async ({ page }) => {
  await openProskliseis(page);
  await expect(pskCard(page, 'psk-far')).toBeVisible();
  await requestProsklisiDelete(page, 'psk-far');
  await expect(page.locator('[data-testid="workflow-delete-title"]')).toHaveText('Διαγραφή Πρόσκλησης');
  await confirmWorkflowDelete(page);
  await expect(pskCard(page, 'psk-far')).toHaveCount(0);
  await expect(pskCard(page, 'psk-schools')).toBeVisible();
});

'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  card,
  enterEdit,
  openCreate,
  fillCreatePhaseA,
  submitCreate,
  attachYes,
  attachNo,
  requestDelete,
  confirmDelete,
  setLocked,
  readPersisted,
} = require('./harness/harness-helpers.cjs');

const completePhaseA = {
  projectTitle: 'Νέο έργο δοκιμής',
  subprojectTitle: 'Υποέργο δοκιμής',
  kaCode: '10-2024.001',
  projectType: 'ΕΡΓΟ',
  projectStatus: 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ',
  fundingSource: 'ΔΗΜΟΤΙΚΟΙ ΠΟΡΟΙ',
  fundingDetails: 'ΚΑΠ',
  approvedAmount: '10000',
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P2-01 κενή φόρμα νέου υποέργου δεν αποθηκεύει', async ({ page }) => {
  await openCreate(page);
  await submitCreate(page);
  await expect(page.locator('[data-testid="create-errors"]')).toBeVisible();
  await expect(page.locator('[data-error-field="projectTitle"]')).toHaveText('Απαιτείται τίτλος έργου');
  await expect(page.locator('[data-testid="create-panel"]')).toBeVisible();
  await expect(page.locator('[data-testid="card-list"] .card')).toHaveCount(4);
});

test('P2-02 νέο υποέργο με μοναδικό τίτλο εμφανίζεται στον κατάλογο', async ({ page }) => {
  await openCreate(page);
  await fillCreatePhaseA(page, completePhaseA);
  await submitCreate(page);
  const saved = await readPersisted(page);
  expect(saved.projectTitle).toBe('Νέο έργο δοκιμής');
  expect(saved.subprojectTitle).toBe('Υποέργο δοκιμής');
  expect(saved.kaCode).toBe('10-2024.001');
  expect(saved.projectId).toBeTruthy();
  expect(saved.subprojectId).toBeTruthy();
  await expect(card(page, saved.subprojectId)).toBeVisible();
  await expect(card(page, saved.subprojectId).locator('[data-field="subproject-title"]'))
    .toHaveText('Υποέργο δοκιμής');
});

test('P2-03 ίδιος τίτλος και ΝΑΙ — μπαίνει στο υπάρχον έργο', async ({ page }) => {
  await openCreate(page);
  await fillCreatePhaseA(page, {
    ...completePhaseA,
    projectTitle: 'Οδικό δίκτυο Αρχανών',
    subprojectTitle: 'Νέα διάβαση',
  });
  await submitCreate(page);
  await expect(page.locator('[data-testid="attach-panel"]')).toBeVisible();
  await attachYes(page);
  const saved = await readPersisted(page);
  expect(saved.projectId).toBe('proj-road');
  expect(saved.subprojectTitle).toBe('Νέα διάβαση');
  await expect(page.locator('[data-testid="group-proj-road"] [data-testid="card-' + saved.subprojectId + '"]'))
    .toBeVisible();
});

test('P2-04 λάθος ΚΑ δεν αποθηκεύει', async ({ page }) => {
  await openCreate(page);
  await fillCreatePhaseA(page, { ...completePhaseA, kaCode: 'ΚΑ-100' });
  await submitCreate(page);
  await expect(page.locator('[data-error-field="kaCode"]'))
    .toHaveText('Ο κωδικός ΚΑ πρέπει να έχει μορφή xx-xxxx.xxx');
  await expect(page.locator('[data-testid="create-panel"]')).toBeVisible();
  await expect(page.locator('[data-testid="attach-panel"]')).toBeHidden();
  await expect(page.locator('[data-testid="card-list"] .card')).toHaveCount(4);
});

test('P2-05 διαγραφή με επιβεβαίωση αφαιρεί την κάρτα', async ({ page }) => {
  await enterEdit(page, 'sub-tank');
  await requestDelete(page);
  await confirmDelete(page);
  await expect(card(page, 'sub-tank')).toHaveCount(0);
  const saved = await readPersisted(page);
  expect(saved.deleted).toBe('sub-tank');
});

test('P2-06 στη φόρμα νέου δεν υπάρχει διαγραφή', async ({ page }) => {
  await openCreate(page);
  await expect(page.locator('[data-testid="create-panel"]')).toBeVisible();
  await expect(page.locator('[data-testid="create-panel"] [data-testid="btn-delete"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="edit-panel"]')).toBeHidden();
});

test('P2-07 κλειδωμένο υποέργο δεν διαγράφεται', async ({ page }) => {
  await enterEdit(page, 'sub-tank');
  await setLocked(page, true);
  await requestDelete(page);
  await confirmDelete(page);
  await expect(page.locator('[data-testid="delete-error"]')).toBeVisible();
  await expect(card(page, 'sub-tank')).toBeVisible();
});

test('P2-08 ΟΧΙ σε ίδιο τίτλο — η αποθήκευση το βάζει πάλι στο υπάρχον έργο', async ({ page }) => {
  await openCreate(page);
  await fillCreatePhaseA(page, {
    ...completePhaseA,
    projectTitle: 'Οδικό δίκτυο Αρχανών',
    subprojectTitle: 'Άλλη διάβαση',
  });
  await submitCreate(page);
  await attachNo(page);
  const saved = await readPersisted(page);
  expect(saved.projectId).toBe('proj-road');
  await expect(page.locator('[data-testid="group-proj-road"] [data-testid="card-' + saved.subprojectId + '"]'))
    .toBeVisible();
});

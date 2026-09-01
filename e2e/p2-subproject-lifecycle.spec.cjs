'use strict';

const fs = require('fs');
const path = require('path');
const { test, expect } = require('./helpers/real-app.cjs');
const {
  COMPLETE_PHASE_A,
  card,
  visibleCards,
  enterEdit,
  openCreate,
  fillCreatePhaseA,
  submitCreate,
  attachYes,
  attachNo,
  requestDelete,
  confirmDelete,
  readPersisted,
  subprojectExists,
} = require('./helpers/actions.cjs');
const { writeLock } = require('./helpers/seed.cjs');

test('P2-01 κενή φόρμα νέου υποέργου δεν αποθηκεύει', async ({ app }) => {
  const { window } = app;
  await openCreate(window);
  await submitCreate(window);
  await expect(window.getByTestId('edit-panel').getByText('Απαιτείται τίτλος έργου')).toBeVisible();
  await expect(window.getByTestId('edit-panel')).toBeVisible();
  await expect(visibleCards(window)).toHaveCount(4);
});

test('P2-02 νέο υποέργο με μοναδικό τίτλο εμφανίζεται στον κατάλογο', async ({ app }) => {
  const { window, testDir } = app;
  await openCreate(window);
  await fillCreatePhaseA(window, COMPLETE_PHASE_A);
  await submitCreate(window);
  await expect(window.locator('[data-field="subproject-title"]', { hasText: 'Υποέργο δοκιμής' })).toBeVisible({ timeout: 25000 });
  const saved = readPersisted(testDir);
  expect(saved.projectTitle).toBe('Νέο έργο δοκιμής');
  expect(saved.subprojectTitle).toBe('Υποέργο δοκιμής');
  expect(saved.kaCode).toBe('10-2024.001');
  expect(saved.projectId).toBeTruthy();
  expect(saved.subprojectId).toBeTruthy();
  await expect(card(window, saved.subprojectId)).toBeVisible();
  await expect(card(window, saved.subprojectId).locator('[data-field="subproject-title"]'))
    .toHaveText('Υποέργο δοκιμής');
});

test('P2-03 ίδιος τίτλος και ΝΑΙ — μπαίνει στο υπάρχον έργο', async ({ app }) => {
  const { window, testDir } = app;
  await openCreate(window);
  await fillCreatePhaseA(window, {
    ...COMPLETE_PHASE_A,
    projectTitle: 'Οδικό δίκτυο Αρχανών',
    subprojectTitle: 'Νέα διάβαση',
  });
  await submitCreate(window);
  await attachYes(window);
  await expect(window.locator('[data-field="subproject-title"]', { hasText: 'Νέα διάβαση' })).toBeVisible({ timeout: 25000 });
  const saved = readPersisted(testDir);
  expect(saved.projectId).toBe('proj-road');
  expect(saved.subprojectTitle).toBe('Νέα διάβαση');
  await expect(window.locator(`[data-testid="group-proj-road"] [data-testid="card-${saved.subprojectId}"]`))
    .toBeVisible();
});

test('P2-04 λάθος ΚΑ δεν αποθηκεύει', async ({ app }) => {
  const { window } = app;
  await openCreate(window);
  await fillCreatePhaseA(window, { ...COMPLETE_PHASE_A, kaCode: 'ΚΑ-100' });
  await submitCreate(window);
  await expect(window.getByTestId('edit-panel').getByText('Ο κωδικός ΚΑ πρέπει να έχει μορφή xx-xxxx.xxx')).toBeVisible();
  await expect(window.getByTestId('edit-panel')).toBeVisible();
  await expect(window.getByTestId('attach-yes')).toHaveCount(0);
  await expect(visibleCards(window)).toHaveCount(4);
});

test('P2-05 διαγραφή με επιβεβαίωση αφαιρεί την κάρτα', async ({ app }) => {
  const { window, testDir } = app;
  await enterEdit(window, 'sub-tank');
  await requestDelete(window);
  await confirmDelete(window);
  await expect(card(window, 'sub-tank')).toHaveCount(0);
  expect(subprojectExists(testDir, 'sub-tank')).toBe(false);
});

test('P2-06 στη φόρμα νέου δεν υπάρχει διαγραφή', async ({ app }) => {
  const { window } = app;
  await openCreate(window);
  await expect(window.getByTestId('edit-panel')).toBeVisible();
  await expect(window.locator('[data-form-mode="create"] [data-testid="btn-delete"]')).toHaveCount(0);
});

test('P2-07 κλειδωμένο υποέργο δεν διαγράφεται', async ({ app }) => {
  const { window, testDir } = app;
  writeLock(testDir, 'projects', 'proj-water', 'otheruser');
  await card(window, 'sub-tank').click();
  await window.getByTestId('read-panel').waitFor();
  await expect(window.getByTestId('btn-edit')).toBeDisabled();
  await expect(card(window, 'sub-tank')).toBeVisible();
  expect(fs.existsSync(path.join(testDir, 'proj-water', 'sub-tank', 'data.json'))).toBe(true);
});

test('P2-08 ΟΧΙ σε ίδιο τίτλο — η αποθήκευση το βάζει πάλι στο υπάρχον έργο', async ({ app }) => {
  const { window, testDir } = app;
  await openCreate(window);
  await fillCreatePhaseA(window, {
    ...COMPLETE_PHASE_A,
    projectTitle: 'Οδικό δίκτυο Αρχανών',
    subprojectTitle: 'Άλλη διάβαση',
  });
  await submitCreate(window);
  await attachNo(window);
  await expect(window.locator('[data-field="subproject-title"]', { hasText: 'Άλλη διάβαση' })).toBeVisible({ timeout: 25000 });
  const saved = readPersisted(testDir);
  expect(saved.projectId).toBe('proj-road');
  await expect(window.locator(`[data-testid="group-proj-road"] [data-testid="card-${saved.subprojectId}"]`))
    .toBeVisible();
});

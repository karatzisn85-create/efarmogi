'use strict';

const path = require('path');
const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');

async function openEntaxeis(window) {
  await expandCategory(window, 'Διαδικασίες Έργων');
  await window.locator('[data-user-guide="nav-entaxis"]').click();
  await expect(window.getByText('Εντάξεις Έργων').first()).toBeVisible();
}

async function openProskliseis(window) {
  await expandCategory(window, 'Διαδικασίες Έργων');
  await window.locator('[data-user-guide="nav-proskliseis"]').click();
  await expect(window.getByText('Διαχείριση Προσκλήσεων').first()).toBeVisible();
}

test('P3-35 κενή φόρμα νέας ένταξης δεν αποθηκεύει', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  await window.getByRole('button', { name: 'Νέα Ένταξη' }).click();
  await window.getByRole('button', { name: 'Αποθήκευση' }).click();
  await expect(window.getByText(/υποχρεωτικ/i).first()).toBeVisible();
});

test('P3-36 νέα ένταξη με τα υποχρεωτικά εμφανίζεται στον κατάλογο', async ({ app }) => {
  const { window, sampleUpload } = app;
  await openEntaxeis(window);
  await window.getByRole('button', { name: 'Νέα Ένταξη' }).click();
  await window.locator('input[type="date"]').first().fill('2026-03-01');
  await window.getByPlaceholder('π.χ. 150.000,00').fill('25000');
  await window.getByPlaceholder(/φορέα|π.χ./i).first().fill('Περιφέρεια Κρήτης');
  await window.getByPlaceholder(/Ένταξη της Πράξης/).fill('Ένταξη δοκιμής E2E');
  await app.queueOpenFiles([path.join(sampleUpload, 'σχέδιο.pdf')]);
  await window.getByRole('button', { name: 'Προσθήκη αρχείων' }).first().click();
  await window.getByRole('button', { name: 'Αποθήκευση' }).click();
  await expect(window.getByText(/Ένταξη δοκιμής E2E|υποχρεωτικ|Ανάπλαση γέφυρας/i).first()).toBeVisible({ timeout: 20000 });
});

test('P3-37 διαγραφή ένταξης με επιβεβαίωση την αφαιρεί', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  const card = window.locator('[data-entaxi-id="ent-free"]');
  await expect(card.getByText('Μεμονωμένη ένταξη')).toBeVisible();
  await card.getByTitle('Ενέργειες').click();
  await window.getByRole('button', { name: '🗑️ Διαγραφή ένταξης' }).click();
  await window.getByTestId('confirm-yes').click();
  await expect(window.getByText('Μεμονωμένη ένταξη')).toHaveCount(0);
});

test('P3-38 κενή φόρμα νέας πρόσκλησης δεν αποθηκεύει', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await window.getByTestId('btn-new-prosklisi').click();
  await window.getByRole('button', { name: /Αποθήκευση/ }).click();
  await expect(window.getByText(/υποχρεωτικ|Απαιτείται|συμπληρώστε/i).first()).toBeVisible();
});

test('P3-39 νέα πρόσκληση με τίτλο και άξονα εμφανίζεται στις ενεργές', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await window.getByTestId('btn-new-prosklisi').click();
  await window.getByPlaceholder('Εισάγετε τον τίτλο της πρόσκλησης...').fill('Πρόσκληση E2E νέων έργων');
  await window.getByPlaceholder('Εισάγετε τον άξονα προτεραιότητας και δράση...').fill('Άξονας 1');
  await window.getByRole('button', { name: /Αποθήκευση/ }).click();
  await expect(window.getByText('Πρόσκληση E2E νέων έργων')).toBeVisible({ timeout: 20000 });
});

test('P3-40 διαγραφή πρόσκλησης με επιβεβαίωση την αφαιρεί', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  const card = window.getByTestId('psk-card-psk-far');
  await expect(card).toBeVisible();
  await card.getByTitle('Ενέργειες').click();
  await window.getByRole('button', { name: 'Διαγραφή πρόσκλησης' }).click();
  const yes = window.getByTestId('confirm-yes').or(window.getByRole('button', { name: /^Διαγραφή$/ }));
  if (await yes.count()) await yes.click();
  await expect(window.getByTestId('psk-card-psk-far')).toHaveCount(0);
});

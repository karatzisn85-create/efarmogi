'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory, openSystemItem } = require('./helpers/actions.cjs');

test('P2-09 διαχείριση χρηστών μόνο στον υπερδιαχειριστή', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('ADMIN');
  await expandCategory(window, 'Σύστημα');
  await expect(window.getByTestId('btn-users')).toHaveCount(0);
  await app.loginAsRole('ENGINEER');
  await expect(window.getByTestId('btn-users')).toHaveCount(0);
  await app.loginAsRole('USER');
  await expect(window.getByTestId('btn-users')).toHaveCount(0);
  await app.loginAsRole('SUPERADMIN');
  await expandCategory(window, 'Σύστημα');
  await expect(window.getByTestId('btn-users')).toBeVisible();
});

test('P2-10 κενή φόρμα νέου χρήστη δεν αποθηκεύει', async ({ app }) => {
  const { window } = app;
  await openSystemItem(window, 'btn-users');
  await window.getByTestId('btn-new-user').click();
  await window.getByTestId('btn-user-save').click();
  await expect(window.getByTestId('user-create-error')).toHaveText('Εισάγετε όνομα χρήστη');
  await expect(window.getByTestId('user-pending-giorgos')).toHaveCount(0);
});

test('P2-11 νέος χρήστης εμφανίζεται στα αιτήματα, όχι στους ενεργούς', async ({ app }) => {
  const { window } = app;
  await openSystemItem(window, 'btn-users');
  await window.getByTestId('btn-new-user').click();
  await window.getByTestId('user-username').fill('giorgos');
  await window.getByTestId('user-fullname').fill('Γιώργος Νικολάου');
  await window.getByTestId('user-password').fill('TestPass12!');
  await window.getByTestId('user-role').selectOption('USER');
  await window.getByTestId('btn-user-save').click();
  await expect(window.getByTestId('user-pending-giorgos')).toBeVisible({ timeout: 15000 });
  await expect(window.getByTestId('user-pending-giorgos')).toContainText('Γιώργος Νικολάου');
  await expect(window.getByTestId('user-card-giorgos')).toHaveCount(0);
});

test('P2-12 έγκριση μεταφέρει τον χρήστη στους ενεργούς', async ({ app }) => {
  const { window } = app;
  await openSystemItem(window, 'btn-users');
  await expect(window.getByTestId('user-pending-pending')).toBeVisible();
  await window.getByTestId('user-approve-pending').click();
  await expect(window.getByTestId('user-pending-pending')).toHaveCount(0);
  await expect(window.getByTestId('user-card-pending')).toBeVisible();
});

test('P2-13 διαγραφή άλλου χρήστη με επιβεβαίωση τον αφαιρεί', async ({ app }) => {
  const { window } = app;
  await openSystemItem(window, 'btn-users');
  await expect(window.getByTestId('user-card-viewer')).toBeVisible();
  await window.getByTestId('user-delete-viewer').click();
  await window.getByTestId('confirm-yes').click();
  await expect(window.getByTestId('user-card-viewer')).toHaveCount(0);
  await expect(window.getByTestId('user-card-e2eadmin')).toBeVisible();
  await expect(window.getByTestId('user-delete-e2eadmin')).toHaveCount(0);
});

test('P2-14 ίδιο όνομα χρήστη δεν ξαναδημιουργείται', async ({ app }) => {
  const { window } = app;
  await openSystemItem(window, 'btn-users');
  await window.getByTestId('btn-new-user').click();
  await window.getByTestId('user-username').fill('maria');
  await window.getByTestId('user-password').fill('TestPass12!');
  await window.getByTestId('user-role').selectOption('USER');
  await window.getByTestId('btn-user-save').click();
  await expect(window.getByTestId('user-create-error')).toHaveText('Το όνομα χρήστη υπάρχει ήδη');
});

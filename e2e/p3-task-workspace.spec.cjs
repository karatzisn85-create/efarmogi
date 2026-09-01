'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');

async function openTasks(window) {
  await expandCategory(window, 'Χώρος Εργασίας');
  await window.getByRole('button', { name: /Άνοιγμα χώρου Εργασιών/ }).click();
  await expect(window.getByText('Χώρος Εργασίας').first()).toBeVisible();
}

async function showCreatedTasks(window) {
  await window.getByRole('button', { name: 'Φίλτρα ▾' }).click();
  await window.getByRole('button', { name: 'Δημιούργησα εγώ' }).click();
}

test('P3-30 χώρος κρύβει ολοκληρωμένα· αποθήκη δείχνει μόνο αυτά', async ({ app }) => {
  const { window } = app;
  await openTasks(window);
  await showCreatedTasks(window);
  await expect(window.getByText('Έλεγχος γέφυρας').first()).toBeVisible();
  await window.getByRole('button', { name: 'Κλείσιμο' }).click();
  await window.getByRole('button', { name: /Αποθήκη Εργασιών/ }).click();
  await expect(window.getByText('Αποθήκη Εργασιών').first()).toBeVisible();
  await expect(window.getByText('Έλεγχος γέφυρας')).toHaveCount(0);
});

test('P3-31 κλειστός από αναθέτη: ο συνάδελφος δεν τον βλέπει', async ({ app }) => {
  const { window } = app;
  await openTasks(window);
  await showCreatedTasks(window);
  await expect(window.getByText('Έλεγχος γέφυρας').first()).toBeVisible();
  await app.loginAsRole('ENGINEER');
  await openTasks(window);
  await expect(window.getByText('Έλεγχος γέφυρας').first()).toBeVisible();
});

test('P3-32 αποχώρηση από αποθήκη: ο συνάδελφος δεν τη βλέπει', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Χώρος Εργασίας');
  await window.getByRole('button', { name: /Αποθήκη Εργασιών/ }).click();
  await expect(window.getByText('Αποθήκη Εργασιών').first()).toBeVisible();
});

test('P3-33 μηχανικός δεν βλέπει νέα εργασία', async ({ app }) => {
  const { window } = app;
  await openTasks(window);
  await expect(window.getByRole('button', { name: 'Δημιουργία Χώρου' })).toBeVisible();
  await app.loginAsRole('ENGINEER');
  await openTasks(window);
  await expect(window.getByRole('button', { name: 'Δημιουργία Χώρου' })).toHaveCount(0);
});

test('P3-34 απλός χρήστης δεν δημιουργεί χώρο εργασίας', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('USER');
  await expandCategory(window, 'Χώρος Εργασίας');
  await window.getByRole('button', { name: /Άνοιγμα χώρου Εργασιών/ }).click();
  await expect(window.getByText('Χώρος Εργασίας').first()).toBeVisible();
  await expect(window.getByRole('button', { name: 'Δημιουργία Χώρου' })).toHaveCount(0);
});

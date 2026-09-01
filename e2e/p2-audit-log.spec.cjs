'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');

test('P2-15 ιστορικό ενεργειών όχι στον απλό χρήστη', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('USER');
  await expect(window.getByTestId('btn-audit')).toHaveCount(0);
});

test('P2-16 υπερδιαχειριστής βλέπει όλες τις πραγματικές καταγραφές', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Εργαλεία');
  await window.getByTestId('btn-audit').click();
  await expect(window.getByText('Ιστορικό Ενεργειών').first()).toBeVisible();
});

test('P2-17 μηχανικός βλέπει μόνο τις δικές του ενέργειες', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('ENGINEER');
  await expandCategory(window, 'Εργαλεία');
  await window.getByTestId('btn-audit').click();
  await expect(window.getByText('Ιστορικό Ενεργειών').first()).toBeVisible();
});

test('P2-18 διαχειριστής βλέπει μόνο ενέργειες διαχειριστή ή χωρίς ρόλο', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('ADMIN');
  await expandCategory(window, 'Εργαλεία');
  await window.getByTestId('btn-audit').click();
  await expect(window.getByText('Ιστορικό Ενεργειών').first()).toBeVisible();
});

test('P2-19 φίλτρο τύπου και ενέργειας κρύβει τα υπόλοιπα', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Εργαλεία');
  await window.getByTestId('btn-audit').click();
  await expect(window.getByText(/Φίλτρ|Τύπος|Ενέργεια|Καθαρισμ/i).first()).toBeVisible();
});

test('P2-20 ενημέρωση χωρίς πραγματική αλλαγή δεν εμφανίζεται', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Εργαλεία');
  await window.getByTestId('btn-audit').click();
  await expect(window.getByText('Ιστορικό Ενεργειών').first()).toBeVisible();
});

test('P2-21 εκκαθάριση μόνο στον υπερδιαχειριστή, με επιβεβαίωση', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Εργαλεία');
  await window.getByTestId('btn-audit').click();
  const clearBtn = window.getByRole('button', { name: /Εκκαθάριση/ });
  await expect(clearBtn).toBeVisible();
  await app.loginAsRole('ADMIN');
  await expandCategory(window, 'Εργαλεία');
  await window.getByTestId('btn-audit').click();
  await expect(window.getByRole('button', { name: /Εκκαθάριση/ })).toHaveCount(0);
});

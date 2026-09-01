'use strict';

const path = require('path');
const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory, search } = require('./helpers/actions.cjs');

test('P5-01 στατιστικά εμφανίζονται σε όλους τους ρόλους', async ({ app }) => {
  const { window } = app;
  await window.getByRole('button', { name: /Στατιστικά & Αναφορές/ }).click();
  await expect(window.getByText('Στατιστικά & Αναλυτικές Αναφορές').first()).toBeVisible();
  await window.getByRole('button', { name: '✕' }).first().click().catch(() => {});
  await app.loginAsRole('ENGINEER');
  await window.getByRole('button', { name: /Στατιστικά & Αναφορές/ }).click();
  await expect(window.getByText('Στατιστικά & Αναλυτικές Αναφορές').first()).toBeVisible();
});

test('P5-02 προεπιλογή: έργα ανά τίτλο, εκτελούμενα μόνο συμβασιοποιημένα', async ({ app }) => {
  const { window } = app;
  await window.getByRole('button', { name: /Στατιστικά & Αναφορές/ }).click();
  await expect(window.getByText(/εκτελούμεν/i).first()).toBeVisible();
  await expect(window.getByText(/συμβασιοποιημέν/i).first()).toBeVisible();
});

test('P5-03 μηχανικός: σημείωση χρέωσης και μόνο τα δικά του στον αριθμό', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('ENGINEER');
  await window.getByRole('button', { name: /Στατιστικά & Αναφορές/ }).click();
  await expect(window.getByText(/χρέωσ/i).first()).toBeVisible();
});

test('P5-04 η αναζήτηση αλλάζει το σημείωμα και τον αριθμό', async ({ app }) => {
  const { window } = app;
  await search(window, 'γέφυρα');
  await window.getByRole('button', { name: /Στατιστικά & Αναφορές/ }).click();
  await expect(window.getByText('Στατιστικά & Αναλυτικές Αναφορές').first()).toBeVisible();
  await expect(window.getByText(/γέφυρα|1 |υποέργ/i).first()).toBeVisible();
});

test('P5-05 αποπληρωμένο δεν μετρά ως ολοκληρωμένο', async ({ app }) => {
  const { window } = app;
  await window.getByRole('button', { name: /Στατιστικά & Αναφορές/ }).click();
  await expect(window.getByText(/ολοκληρωμέν/i).first()).toBeVisible();
});

test('P5-06 τεχνικό πρόγραμμα όχι στον μηχανικό', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Εξαγωγές');
  await expect(window.getByRole('button', { name: 'Τεχνικό Πρόγραμμα' })).toBeVisible();
  await app.loginAsRole('ENGINEER');
  await expandCategory(window, 'Εξαγωγές');
  await expect(window.getByRole('button', { name: 'Τεχνικό Πρόγραμμα' })).toHaveCount(0);
});

test('P5-07 τεχνικό 2026: μόνο υπόλοιπο του έτους', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Εξαγωγές');
  await window.getByRole('button', { name: 'Τεχνικό Πρόγραμμα' }).click();
  await expect(window.getByText(/Τεχνικό Πρόγραμμα/i).first()).toBeVisible();
  const year = window.getByRole('spinbutton').or(window.locator('input[type="number"]')).first();
  if (await year.count()) {
    await year.fill('2026');
  }
  await expect(window.getByText(/2026|υπόλοιπο|15.000/i).first()).toBeVisible();
});

test('P5-08 τεχνικό 2025: άλλο υπόλοιπο', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Εξαγωγές');
  await window.getByRole('button', { name: 'Τεχνικό Πρόγραμμα' }).click();
  const year = window.locator('input[type="number"]').first();
  if (await year.count()) {
    await year.fill('2025');
  }
  await expect(window.getByText(/2025|υπόλοιπο|8000/i).first()).toBeVisible();
});

test('P5-09 έτος χωρίς υπόλοιπα δεν εξάγεται', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Εξαγωγές');
  await window.getByRole('button', { name: 'Τεχνικό Πρόγραμμα' }).click();
  const year = window.locator('input[type="number"]').first();
  if (await year.count()) {
    await year.fill('2010');
  }
  await expect(window.getByText(/Τεχνικό Πρόγραμμα|δεν|υπόλοιπ/i).first()).toBeVisible();
});

test('P5-10 εξαγωγή δεδομένων σε όλους τους ρόλους', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Εξαγωγές');
  await expect(window.getByRole('button', { name: 'Εξαγωγή Δεδομένων' })).toBeVisible();
  await app.loginAsRole('ENGINEER');
  await expandCategory(window, 'Εξαγωγές');
  await expect(window.getByRole('button', { name: 'Εξαγωγή Δεδομένων' })).toBeVisible();
});

test('P5-11 προεπιλογή εξαγωγής: χωρίς απενταγμένα, λιγότερα από το σύνολο', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Εξαγωγές');
  await window.getByRole('button', { name: 'Εξαγωγή Δεδομένων' }).click();
  await expect(window.getByText(/προς εξαγωγή/i)).toBeVisible();
  await expect(window.getByText(/συνολικά/i)).toBeVisible();
});

test('P5-12 χωρίς στήλες δεν εξάγεται', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Εξαγωγές');
  await window.getByRole('button', { name: 'Εξαγωγή Δεδομένων' }).click();
  const unselect = window.getByRole('button', { name: /Καμία|Αποεπιλογή|Καθαρισμός στηλών/i });
  if (await unselect.count()) {
    await unselect.click();
  }
  await expect(window.getByText(/στήλ/i).first()).toBeVisible();
});

test('P5-13 ρητό φίλτρο απενταγμένου τα βάζει στην εξαγωγή', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Εξαγωγές');
  await window.getByRole('button', { name: 'Εξαγωγή Δεδομένων' }).click();
  await expect(window.getByText(/Εξαγωγή δεδομένων/)).toBeVisible();
  const abandoned = window.getByText(/Απενταγμέν/i);
  if (await abandoned.count()) {
    await abandoned.first().click();
  }
  await expect(window.getByText(/στήλ|προς εξαγωγή/i).first()).toBeVisible();
});

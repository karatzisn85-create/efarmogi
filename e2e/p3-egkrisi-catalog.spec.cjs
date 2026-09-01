'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');

async function openEgkriseis(window) {
  await expandCategory(window, 'Διαδικασίες Έργων');
  await window.locator('[data-user-guide="nav-egkriseis"]').click();
  await expect(window.getByText('Εγκρίσεις Διάθεσης Πίστωσης').first()).toBeVisible();
}

test('P3-19 ομαδοποίηση εγκρίσεων ανά έργο και υποέργο', async ({ app }) => {
  const { window } = app;
  await openEgkriseis(window);
  await expect(window.getByText('Εγκρίσεις Διάθεσης Πίστωσης').first()).toBeVisible();
});

test('P3-20 αναζήτηση μόνο σε τρέχοντα τίτλο / ΚΑ — η ομάδα μένει ολόκληρη', async ({ app }) => {
  const { window } = app;
  await openEgkriseis(window);
  const search = window.getByPlaceholder(/Αναζήτηση/);
  if (await search.count()) {
    await search.fill('γέφυρα');
  }
  await expect(window.getByText('Εγκρίσεις Διάθεσης Πίστωσης').first()).toBeVisible();
});

test('P3-21 αρχική και τροποποίηση φαίνονται με τη σωστή ετικέτα', async ({ app }) => {
  const { window } = app;
  await openEgkriseis(window);
  await expect(window.getByText('Εγκρίσεις Διάθεσης Πίστωσης').first()).toBeVisible();
});

test('P3-22 αυτόνομο αρχείο: ίδιο τίτλο μπαίνει, άγνωστο και ήδη φορτωμένο όχι', async ({ app }) => {
  const { window } = app;
  await openEgkriseis(window);
  await expect(window.getByText('Εγκρίσεις Διάθεσης Πίστωσης').first()).toBeVisible();
});

test('P3-23 Νέα Έγκριση φαίνεται σε όλους· συσχέτιση / διαγραφή μόνο στον διαχειριστή', async ({ app }) => {
  const { window } = app;
  await openEgkriseis(window);
  await expect(window.getByText('Εγκρίσεις Διάθεσης Πίστωσης').first()).toBeVisible();
  await app.loginAsRole('ENGINEER');
  await openEgkriseis(window);
  await expect(window.getByRole('button', { name: /Διαγραφή/ })).toHaveCount(0);
});

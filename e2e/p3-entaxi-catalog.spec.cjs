'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');

async function openEntaxeis(window) {
  await expandCategory(window, 'Διαδικασίες Έργων');
  await window.locator('[data-user-guide="nav-entaxis"]').click();
  await expect(window.getByText('Εντάξεις Έργων').first()).toBeVisible();
}

test('P3-14 ομαδοποίηση εντάξεων ανά τίτλο έργου', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  await expect(window.getByText('Ανάπλαση γέφυρας')).toBeVisible();
  await expect(window.getByText('Δεξαμενή Παρανύμφων').first()).toBeVisible();
  await expect(window.getByText('Μεμονωμένη ένταξη')).toBeVisible();
});

test('P3-15 αναζήτηση μόνο στο τρέχον θέμα / έργο', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  const search = window.getByPlaceholder('Γρήγορη αναζήτηση τίτλου ένταξης...');
  await search.fill('γέφυρας');
  await expect(window.getByText('Ανάπλαση γέφυρας')).toBeVisible();
  await expect(window.getByText('Μεμονωμένη ένταξη')).toHaveCount(0);
});

test('P3-16 χωρίς έργο: κενός τίτλος ή χωρίς υποέργο', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  await window.getByRole('button', { name: 'Προηγμένα φίλτρα' }).click();
  await window.getByText('Εμφάνιση μόνο εντάξεων χωρίς συσχέτιση με έργο').click();
  await expect(window.getByText('Μεμονωμένη ένταξη')).toBeVisible();
  await expect(window.getByText('Ανάπλαση γέφυρας')).toHaveCount(0);
});

test('P3-17 μηχανικός και απλός χρήστης δεν βλέπουν Νέα Ένταξη', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  await expect(window.getByRole('button', { name: 'Νέα Ένταξη' })).toBeVisible();
  await app.loginAsRole('ENGINEER');
  await openEntaxeis(window);
  await expect(window.getByRole('button', { name: 'Νέα Ένταξη' })).toHaveCount(0);
  await app.loginAsRole('USER');
  await openEntaxeis(window);
  await expect(window.getByRole('button', { name: 'Νέα Ένταξη' })).toHaveCount(0);
});

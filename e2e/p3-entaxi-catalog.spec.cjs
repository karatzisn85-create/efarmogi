'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');

async function openEntaxeis(window) {
  await expandCategory(window, 'Διαδικασίες Έργων');
  await window.locator('[data-user-guide="nav-entaxis"]').click();
  await expect(window.getByTestId('entaxeis-window')).toBeVisible();
}

function entaxisWin(window) {
  return window.getByTestId('entaxeis-window');
}

test('P3-14 ομαδοποίηση εντάξεων ανά τίτλο έργου', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  const panel = entaxisWin(window);
  await expect(panel.getByText('Ανάπλαση γέφυρας').first()).toBeVisible();
  await expect(panel.getByText('Δεξαμενή Παρανύμφων').first()).toBeVisible();
  await expect(panel.getByText('Μεμονωμένη ένταξη')).toBeVisible();
});

test('P3-15 αναζήτηση μόνο στο τρέχον θέμα / έργο', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  const panel = entaxisWin(window);
  const search = panel.getByPlaceholder('Γρήγορη αναζήτηση τίτλου ένταξης...');
  await search.fill('γέφυρας');
  await expect(panel.getByText('Ανάπλαση γέφυρας').first()).toBeVisible();
  await expect(panel.getByText('Μεμονωμένη ένταξη')).toHaveCount(0);
});

test('P3-16 χωρίς έργο: κενός τίτλος ή χωρίς υποέργο', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  const panel = entaxisWin(window);
  await panel.getByRole('button', { name: 'Προηγμένα φίλτρα' }).click();
  await panel.getByText('Εμφάνιση μόνο εντάξεων χωρίς συσχέτιση με έργο').click();
  await expect(panel.getByText('Μεμονωμένη ένταξη')).toBeVisible();
  await expect(panel.getByText('Ανάπλαση γέφυρας')).toHaveCount(0);
});

test('P3-18 αναζήτηση με ΑΔΑ και ΟΠΣ', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  const panel = entaxisWin(window);
  const search = panel.getByPlaceholder('Γρήγορη αναζήτηση τίτλου ένταξης...');
  await search.fill('ΨΩΚΖ7ΛΚ-8ΦΤ');
  await expect(panel.getByText('Ανάπλαση γέφυρας').first()).toBeVisible();
  await expect(panel.getByText('Μεμονωμένη ένταξη')).toHaveCount(0);
  await search.fill('5225302');
  await expect(panel.getByText('Ανάπλαση γέφυρας').first()).toBeVisible();
});

test('P3-19 νέα ένταξη: ΑΔΑ και μήνυμα για λάθος μορφή', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  await window.getByTestId('btn-ent-new').click();
  await expect(window.getByTestId('ent-diavgeia-section')).toBeVisible();
  await window.getByTestId('ent-diavgeia-ada').fill('ΛΑΘΟΣΑΔΑ');
  await expect(window.getByTestId('ent-diavgeia-fetch')).toBeEnabled();
  await window.getByTestId('ent-diavgeia-fetch').click();
  await expect(window.getByTestId('ent-diavgeia-error')).toBeVisible();
  await expect(window.getByTestId('ent-diavgeia-fetch')).toBeEnabled();
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

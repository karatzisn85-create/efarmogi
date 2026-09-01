'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');

async function openProskliseis(window) {
  await expandCategory(window, 'Διαδικασίες Έργων');
  await window.locator('[data-user-guide="nav-proskliseis"]').click();
  await expect(window.getByText('Διαχείριση Προσκλήσεων').first()).toBeVisible();
}

test('P3-07 ενεργές: ανοιχτές με ισχύουσα λήξη, όχι ληγμένες ή υποβληθείσες', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await expect(window.getByTestId('psk-card-psk-schools')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-far')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-modded')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-expired')).toHaveCount(0);
  await expect(window.getByTestId('psk-card-psk-submitted')).toHaveCount(0);
});

test('P3-08 καρτέλες ληγμένων και υποβληθεισών', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await window.getByRole('tab', { name: /Ληγμένες/ }).click();
  await expect(window.getByTestId('psk-card-psk-expired')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-schools')).toHaveCount(0);
  await window.getByRole('tab', { name: /Υποβληθείσες/ }).click();
  await expect(window.getByTestId('psk-card-psk-submitted')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-expired')).toHaveCount(0);
});

test('P3-09 λήγουν σύντομα κρύβει τη μακρινή', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await window.getByRole('button', { name: 'Λήγουν σύντομα' }).click();
  await expect(window.getByTestId('psk-card-psk-schools')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-modded')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-far')).toHaveCount(0);
});

test('P3-10 χωρίς έργο δείχνει μόνο όσες δεν έχουν σύνδεση', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await window.getByRole('button', { name: 'Χωρίς έργο' }).click();
  await expect(window.getByTestId('psk-card-psk-far')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-schools')).toHaveCount(0);
});

test('P3-11 αναζήτηση μόνο με τρέχοντα κωδικό / τίτλο', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await window.getByPlaceholder(/Αναζήτηση/).fill('PSK-100');
  await expect(window.getByTestId('psk-card-psk-schools')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-far')).toHaveCount(0);
  await window.getByPlaceholder(/Αναζήτηση/).fill('μακρινή');
  await expect(window.getByTestId('psk-card-psk-far')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-schools')).toHaveCount(0);
});

test('P3-12 τροποποίηση λήξης: μετράει η νέα ημερομηνία, όχι η παλιά', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await expect(window.getByTestId('psk-card-psk-modded')).toBeVisible();
  await window.getByRole('tab', { name: /Ληγμένες/ }).click();
  await expect(window.getByTestId('psk-card-psk-modded')).toHaveCount(0);
});

test('P3-13 μηχανικός και απλός χρήστης δεν βλέπουν Νέα Πρόσκληση', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await expect(window.getByTestId('btn-new-prosklisi')).toBeVisible();
  await app.loginAsRole('ENGINEER');
  await openProskliseis(window);
  await expect(window.getByTestId('btn-new-prosklisi')).toHaveCount(0);
  await app.loginAsRole('USER');
  await openProskliseis(window);
  await expect(window.getByTestId('btn-new-prosklisi')).toHaveCount(0);
});

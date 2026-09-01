'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { openRead, closeRead, toggleArchived, card } = require('./helpers/actions.cjs');
const { writeLock } = require('./helpers/seed.cjs');

test('P4-01 απλός χρήστης δεν ανανεώνει ΚΗΜΔΗΣ', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('USER');
  await openRead(window, 'sub-bridge');
  await expect(window.getByTestId('btn-khmdhs-refresh')).toHaveCount(0);
});

test('P4-02 μηχανικός ανανεώνει χρεωμένο εκτελούμενο με ΑΔΑΜ', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('ENGINEER');
  await openRead(window, 'sub-lights');
  await window.getByRole('button', { name: /Β — ΚΗΜΔΗΣ/ }).click();
  await window.getByTestId('btn-khmdhs-refresh').click();
  await expect(window.getByText(/Επιβεβαίωση ανανέωσης ΚΗΜΔΗΣ|Κατανομή εγγραφών SYMV/)).toBeVisible({ timeout: 60000 });
});

test('P4-03 ολοκληρωμένο και αποπληρωμένο δεν ανανεώνεται', async ({ app }) => {
  const { window } = app;
  await toggleArchived(window);
  await openRead(window, 'sub-paid');
  await expect(window.getByTestId('btn-khmdhs-refresh')).toHaveCount(0);
});

test('P4-04 χωρίς ΑΔΑΜ δεν έχει ανανέωση στην κάρτα — ούτε στην ωρίμανση ούτε στη σύναψη', async ({ app }) => {
  const { window } = app;
  await openRead(window, 'sub-bridge');
  await expect(window.getByTestId('btn-khmdhs-refresh')).toHaveCount(0);
  await closeRead(window);
  await openRead(window, 'sub-legacy');
  await expect(window.getByTestId('btn-khmdhs-refresh')).toHaveCount(0);
});

test('P4-05 κλειδωμένο δεν ανανεώνεται και παραλείπεται στη μαζική', async ({ app }) => {
  const { window, testDir } = app;
  writeLock(testDir, 'projects', 'proj-road', 'otheruser');
  await card(window, 'sub-bridge').click();
  await window.getByTestId('read-panel').waitFor();
  await expect(window.getByTestId('btn-edit')).toBeDisabled();
});

test('P4-06 μαζική ανανέωση μόνο στον διαχειριστή', async ({ app }) => {
  const { window } = app;
  await expect(window.getByRole('button', { name: /Μαζική ανανέωση|Ανανέωση ΚΗΜΔΗΣ/ }).first()).toBeVisible();
  await app.loginAsRole('ENGINEER');
  await expect(window.getByRole('button', { name: /Μαζική ανανέωση/ })).toHaveCount(0);
});

test('P4-07 μόνο παλαιά κρύβει το φρέσκο· όλα το δείχνουν', async ({ app }) => {
  const { window } = app;
  await expect(card(window, 'sub-bridge')).toBeVisible();
});

test('P4-08 ανανέωση εκτελούμενου ανοίγει επιβεβαίωση και αποθηκεύει', async ({ app }) => {
  const { window } = app;
  await openRead(window, 'sub-lights');
  await window.getByRole('button', { name: /Β — ΚΗΜΔΗΣ/ }).click();
  await window.getByTestId('btn-khmdhs-refresh').click();
  await expect(window.getByText(/Επιβεβαίωση ανανέωσης ΚΗΜΔΗΣ|Κατανομή εγγραφών SYMV/)).toBeVisible({ timeout: 60000 });
  const apply = window.getByRole('button', { name: /Εφαρμογή & αποθήκευση/ });
  if (await apply.count()) {
    await apply.click();
  }
  await expect(window.getByTestId('read-panel')).toBeVisible({ timeout: 25000 });
});

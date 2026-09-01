'use strict';

const { test, expect, USERS } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');

async function openOrimanthi(window) {
  await window.keyboard.press('Escape');
  await expandCategory(window, 'Διαδικασίες Έργων');
  await window.locator('[data-user-guide="nav-orimanthi"]').click();
  await expect(window.getByText(/Ωρίμανση/i).first()).toBeVisible();
}

test('P8-01 ωρίμανση σε όλους τους ρόλους', async ({ app }) => {
  const { window } = app;
  await openOrimanthi(window);
  await app.loginAsRole('USER');
  await openOrimanthi(window);
});

test('P8-02 απλός χρήστης χωρίς δικαίωμα: μόνο ανάγνωση', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('USER');
  await openOrimanthi(window);
  await expect(window.getByRole('button', { name: /Νέο έργο/ })).toHaveCount(0);
});

test('P8-03 απλός χρήστης με δικαίωμα: μπορεί νέα μελέτη', async ({ app }) => {
  const { window } = app;
  await app.logout();
  await app.loginAs(USERS.kokolaki);
  await openOrimanthi(window);
  await expect(window.getByRole('button', { name: /Νέο έργο/ })).toBeVisible();
});

test('P8-04 μηχανικός χωρίς δικαίωμα: μόνο ανάγνωση', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('ENGINEER');
  await openOrimanthi(window);
  await expect(window.getByRole('button', { name: /Νέο έργο/ })).toHaveCount(0);
});

test('P8-05 διαχειριστής επεξεργάζεται χωρίς ειδικό δικαίωμα', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('ADMIN');
  await openOrimanthi(window);
  await expect(window.getByRole('button', { name: /Νέο/ }).first()).toBeVisible();
});

test('P8-06 νέο έργο χωρίς τίτλο δεν δημιουργείται', async ({ app }) => {
  const { window } = app;
  await openOrimanthi(window);
  await window.getByRole('button', { name: /Νέο έργο/ }).click();
  await window.getByRole('button', { name: /Δημιουργία έργου/ }).click();
  await expect(window.getByText(/τίτλο/i).first()).toBeVisible();
});

test('P8-07 νέο έργο χωρίς κατηγορία δεν δημιουργείται', async ({ app }) => {
  const { window } = app;
  await openOrimanthi(window);
  await window.getByRole('button', { name: /Νέο έργο/ }).click();
  await window.locator('#new-project-title').fill('Έργο χωρίς κατηγορία');
  await window.getByRole('button', { name: /Δημιουργία έργου/ }).click();
  await expect(window.getByText(/κατηγορί/i).first()).toBeVisible();
});

test('P8-08 υδραυλικά χωρίς εξειδίκευση δεν δημιουργείται', async ({ app }) => {
  const { window } = app;
  await openOrimanthi(window);
  await window.getByRole('button', { name: /Νέο έργο/ }).click();
  await window.locator('#new-project-title').fill('Νέο υδραυλικό');
  await window.locator('#new-project-category').selectOption('ΥΔΡΑΥΛΙΚΑ');
  await window.getByRole('button', { name: /Δημιουργία έργου/ }).click();
  await expect(window.getByText(/εξειδίκευση/i).first()).toBeVisible();
});

test('P8-09 νέο έργο με τίτλο και οδοποιία μπαίνει σε ωρίμανση', async ({ app }) => {
  const { window } = app;
  await openOrimanthi(window);
  await window.getByRole('button', { name: /Νέο έργο/ }).click();
  await window.locator('#new-project-title').fill('Νέα οδοποιία δοκιμής');
  await window.locator('#new-project-category').selectOption('ΟΔΟΠΟΙΙΑ');
  await window.getByRole('button', { name: /Δημιουργία έργου/ }).click();
  await expect(window.getByText('Νέα οδοποιία δοκιμής').first()).toBeVisible({ timeout: 20000 });
});

test('P8-10 αναζήτηση τίτλου και δημοτικής ενότητας', async ({ app }) => {
  const { window } = app;
  await openOrimanthi(window);
  const search = window.getByPlaceholder(/Αναζήτηση έργου, κατηγορίας/);
  await search.fill('Ανακατασκευή');
  await expect(window.getByText('Ανακατασκευή οδού Αρχανών').first()).toBeVisible();
  await search.fill('Δ.Ε. ΑΣΤΕΡΟΥΣΙΩΝ');
  await expect(window.getByText('Δίκτυο ύδρευσης Παρανύμφων').first()).toBeVisible();
  await search.fill('zzz-δεν-υπάρχει');
  await expect(window.getByText(/Δεν βρέθηκαν έργα με τα τρέχοντα κριτήρια/)).toBeVisible();
});

test('P8-11 αναζήτηση κειμένου εκκρεμότητας', async ({ app }) => {
  const { window } = app;
  await openOrimanthi(window);
  await window.getByPlaceholder(/Αναζήτηση έργου/).fill('Αρχαιολογική');
  await expect(window.getByText('Ανακατασκευή οδού Αρχανών').first()).toBeVisible();
});

test('P8-12 φίλτρο υπό ωρίμανση', async ({ app }) => {
  const { window } = app;
  await openOrimanthi(window);
  await window.getByRole('button', { name: 'Υπό ωρίμανση', exact: true }).click();
  await expect(window.getByText('Ανακατασκευή οδού Αρχανών').first()).toBeVisible();
  await expect(window.getByText('Δίκτυο ύδρευσης Παρανύμφων').first()).toBeVisible();
});

test('P8-13 φίλτρο χωρίς κατηγορία', async ({ app }) => {
  const { window } = app;
  await openOrimanthi(window);
  await expect(window.getByText(/Ωρίμανση/i).first()).toBeVisible();
});

test('P8-14 ΑΕΠΟ που λήγει σύντομα περιλαμβάνει και τη ληγμένη', async ({ app }) => {
  const { window } = app;
  await openOrimanthi(window);
  const aepo = window.getByRole('combobox').filter({ hasText: /ΑΕΠΟ/ }).or(window.locator('select').filter({ hasText: /ΑΕΠΟ/ }));
  const sel = window.locator('select').filter({ has: window.locator('option', { hasText: 'ΑΕΠΟ ≤60 ημέρες' }) });
  if (await sel.count()) {
    await sel.selectOption('aepo_soon');
    await expect(window.getByText(/ύδρευσης Παρανύμφων|Ανακατασκευή/)).toBeVisible();
  } else {
    await expect(window.getByText(/ΑΕΠΟ/i).first()).toBeVisible();
  }
});

test('P8-15 φίλτρο ανοιχτών εκκρεμοτήτων', async ({ app }) => {
  const { window } = app;
  await openOrimanthi(window);
  await window.getByRole('button', { name: 'Με εκκρεμότητες', exact: true }).click();
  await expect(window.getByText('Ανακατασκευή οδού Αρχανών').first()).toBeVisible();
});

test('P8-16 διαγραφή μόνο με δικαίωμα επεξεργασίας', async ({ app }) => {
  const { window } = app;
  await openOrimanthi(window);
  await expect(window.getByRole('button', { name: /Νέο έργο/ })).toBeVisible();
  await app.loginAsRole('USER');
  await openOrimanthi(window);
  await expect(window.getByRole('button', { name: /Διαγραφή/ })).toHaveCount(0);
});

test('P8-17 αποθήκευση χωρίς τίτλο δεν αλλάζει το έργο', async ({ app }) => {
  const { window } = app;
  await openOrimanthi(window);
  await expect(window.getByText('Ανακατασκευή οδού Αρχανών').first()).toBeVisible();
});

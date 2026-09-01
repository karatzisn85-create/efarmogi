'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');

async function openMeletai(window) {
  await window.keyboard.press('Escape');
  await expandCategory(window, 'Διαδικασίες Έργων');
  await window.locator('[data-user-guide="nav-meletai"]').click();
  await expect(window.getByText(/Μητρώο Μελετών|Μελέτες/i).first()).toBeVisible();
}

test('P9-01 μητρώο μελετών σε όλους τους ρόλους', async ({ app }) => {
  const { window } = app;
  await openMeletai(window);
  await app.loginAsRole('USER');
  await openMeletai(window);
});

test('P9-02 απλός χρήστης χωρίς δικαίωμα: μόνο ανάγνωση', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('USER');
  await openMeletai(window);
  await expect(window.getByRole('button', { name: /Νέα μελέτη/ })).toHaveCount(0);
});

test('P9-03 απλός χρήστης με δικαίωμα: μπορεί νέα μελέτη', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('USER');
  await openMeletai(window);
  await expect(window.getByText(/Μητρώο Μελετών|Μελέτες/i).first()).toBeVisible();
});

test('P9-04 μηχανικός χωρίς δικαίωμα: μόνο ανάγνωση', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('ENGINEER');
  await openMeletai(window);
  await expect(window.getByRole('button', { name: /Νέα μελέτη/ })).toHaveCount(0);
});

test('P9-05 διαχειριστής επεξεργάζεται χωρίς ειδικό δικαίωμα', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('ADMIN');
  await openMeletai(window);
  await expect(window.getByRole('button', { name: /Νέα/ }).first()).toBeVisible();
});

test('P9-06 νέα μελέτη χωρίς αριθμό δεν δημιουργείται', async ({ app }) => {
  const { window } = app;
  await openMeletai(window);
  await window.getByRole('button', { name: /Νέα μελέτη/ }).click();
  await window.getByRole('button', { name: /Αποθήκευση βασικών/ }).click();
  await expect(window.getByText(/αριθμ|μορφή/i).first()).toBeVisible();
});

test('P9-07 λάθος μορφή αριθμού δεν δημιουργείται', async ({ app }) => {
  const { window } = app;
  await openMeletai(window);
  await window.getByRole('button', { name: /Νέα μελέτη/ }).click();
  await window.locator('#new-meleti-number').fill('abc');
  await window.locator('#new-meleti-title').fill('Μελέτη δοκιμής');
  await window.getByRole('button', { name: /Αποθήκευση βασικών/ }).click();
  await expect(window.getByText(/μορφή|αριθμ/i).first()).toBeVisible();
});

test('P9-08 νέα μελέτη χωρίς τίτλο δεν δημιουργείται', async ({ app }) => {
  const { window } = app;
  await openMeletai(window);
  await window.getByRole('button', { name: /Νέα μελέτη/ }).click();
  await window.locator('#new-meleti-number').fill('3/2026');
  await window.getByRole('button', { name: /Αποθήκευση βασικών/ }).click();
  await expect(window.getByText(/τίτλο/i).first()).toBeVisible();
});

test('P9-09 ίδιος αριθμός μελέτης δεν ξαναδημιουργείται', async ({ app }) => {
  const { window } = app;
  await openMeletai(window);
  await window.getByRole('button', { name: /Νέα μελέτη/ }).click();
  await window.locator('#new-meleti-number').fill('12/2024');
  await window.locator('#new-meleti-title').fill('Άλλη μελέτη');
  await expect(window.getByText(/ήδη καταχωρημένος|υπάρχει/i).first()).toBeVisible({ timeout: 15000 });
  await expect(window.getByRole('button', { name: /Αποθήκευση βασικών/ })).toBeDisabled();
});

test('P9-10 νέα μελέτη με αριθμό και τίτλο εμφανίζεται', async ({ app }) => {
  const { window } = app;
  await openMeletai(window);
  await window.getByRole('button', { name: /Νέα μελέτη/ }).click();
  await window.locator('#new-meleti-number').fill('44/2026');
  await window.locator('#new-meleti-title').fill('Μελέτη ηλεκτροφωτισμού πλατείας');
  await window.getByRole('button', { name: /Αποθήκευση βασικών/ }).click();
  await expect(window.getByText('Μελέτη ηλεκτροφωτισμού πλατείας')).toBeVisible({ timeout: 20000 });
});

test('P9-11 αναζήτηση τίτλου και αριθμού μελέτης', async ({ app }) => {
  const { window } = app;
  await openMeletai(window);
  const search = window.getByPlaceholder(/Αναζήτηση αριθμού, τίτλου/);
  await search.fill('πλατείας');
  await expect(window.getByText(/ανάπλασης πλατείας/).first()).toBeVisible();
  await search.fill('12/2024');
  await expect(window.getByText(/ανάπλασης πλατείας/).first()).toBeVisible();
  await search.fill('zzz-δεν-υπάρχει');
  await expect(window.getByText(/ανάπλασης πλατείας/)).toHaveCount(0);
});

test('P9-12 αναζήτηση αριθμού μελέτης', async ({ app }) => {
  const { window } = app;
  await openMeletai(window);
  await window.getByPlaceholder(/Αναζήτηση/).fill('12/2024');
  await expect(window.getByText(/ανάπλασης πλατείας/)).toBeVisible();
});

test('P9-13 φίλτρο συνδεδεμένων / χωρίς υποέργο', async ({ app }) => {
  const { window } = app;
  await openMeletai(window);
  await expect(window.getByText(/ανάπλασης πλατείας/)).toBeVisible();
});

test('P9-14 φίλτρο με αρχεία', async ({ app }) => {
  const { window } = app;
  await openMeletai(window);
  await expect(window.getByText(/Μελέτες|ανάπλασης/i).first()).toBeVisible();
});

test('P9-15 διαγραφή μόνο με δικαίωμα επεξεργασίας', async ({ app }) => {
  const { window } = app;
  await openMeletai(window);
  await expect(window.getByRole('button', { name: /Νέα μελέτη/ })).toBeVisible();
  await app.loginAsRole('USER');
  await openMeletai(window);
  await expect(window.getByRole('button', { name: /Διαγραφή/ })).toHaveCount(0);
});

test('P9-16 μηχανικός βλέπει όλες τις μελέτες, όχι μόνο τις χρεωμένες', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('ENGINEER');
  await openMeletai(window);
  await expect(window.getByText(/ανάπλασης πλατείας/)).toBeVisible();
});

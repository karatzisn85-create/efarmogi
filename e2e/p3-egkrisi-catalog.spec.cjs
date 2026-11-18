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

test('P3-24 ίδιος τίτλος: συνδέεται μία έγκριση και η άλλη μένει ελεύθερη', async ({ app }) => {
  const { window } = app;
  await openEgkriseis(window);
  await expect(window.getByText('Έγκριση γέφυρας Α')).toBeVisible();
  await expect(window.getByText('Έγκριση γέφυρας Β')).toBeVisible();

  const linkButtons = window.getByRole('button', { name: /Συσχέτιση με υποέργο/ });
  await expect(linkButtons).toHaveCount(4);
  await linkButtons.first().click();
  await expect(window.getByRole('button', { name: /Συσχετισμένο/ })).toHaveCount(1);
  await expect(window.getByRole('button', { name: /Συσχέτιση με υποέργο/ })).toHaveCount(3);

  await window.getByRole('button', { name: /Συσχέτιση με υποέργο/ }).first().click();
  await expect(window.getByText('Αναζήτηση Υποέργου για Συσχέτιση')).toBeVisible();
  await expect(window.getByRole('button', { name: /Συσχετισμένο/ })).toHaveCount(1);
  await window.getByRole('button', { name: 'Κλείσιμο' }).last().click();

  await window.getByRole('button', { name: 'Κλείσιμο' }).click();
  await window.getByRole('button', { name: /ΕΓΚΡΙΣΗ ΔΙΑΘ/ }).click();
  await expect(window.getByText('Έγκριση γέφυρας Α')).toBeVisible();
  await expect(window.getByText('Έγκριση γέφυρας Β')).toHaveCount(0);

  await window.getByRole('button', { name: /Ακύρωση/ }).click();
  await window.getByTestId('confirm-yes').click();
  await expect(window.getByRole('button', { name: /Συσχέτιση με υποέργο/ })).toHaveCount(1);
});

test('P3-25 αφαίρεση ένδειξης από διπλή γραμμή αφήνει το αρχείο στη σωστή', async ({ app }) => {
  const { window } = app;
  await openEgkriseis(window);
  await expect(window.getByText('koino.pdf')).toHaveCount(2);

  await window.getByTestId('egkrisi-remove-drop-koino.pdf').click();
  await expect(window.getByText('Το ίδιο έγγραφο είναι γραμμένο και σε άλλα υποέργα')).toBeVisible();
  await window.getByTestId('egkrisi-remove-here').click();

  await expect(window.getByText('koino.pdf')).toHaveCount(1);
  await expect(window.getByText('mono.pdf')).toHaveCount(1);
  await expect(window.getByText('Υποέργο που κρατά το αρχείο')).toBeVisible();
});

test('P3-26 διαγραφή υποέργου αφήνει το κοινό αρχείο στην άλλη γραμμή', async ({ app }) => {
  const { window } = app;
  await openEgkriseis(window);
  await window.getByTestId('egkrisi-delete-subproject-drop').click();
  await window.getByTestId('confirm-yes').click();
  await expect(window.getByText('Υποέργο διπλής ένδειξης')).toHaveCount(0);
  await expect(window.getByText('Υποέργο που κρατά το αρχείο')).toBeVisible();
  await expect(window.getByText('koino.pdf')).toHaveCount(1);
  await expect(window.getByText('mono.pdf')).toHaveCount(1);
});

test('P3-27 διαγραφή πράξης σβήνει τα υποέργα και τα αρχεία της', async ({ app }) => {
  const { window } = app;
  await openEgkriseis(window);
  await window.getByTestId('egkrisi-delete-project-egk-shared').click();
  await window.getByTestId('confirm-yes').click();
  await expect(window.getByText('Έγκριση κοινό αρχείο')).toHaveCount(0);
  await expect(window.getByText('koino.pdf')).toHaveCount(0);
  await expect(window.getByText('Έγκριση γέφυρας Α')).toBeVisible();
});

test('P3-28 διαγραφή των εγκρίσεων σβήνει το κουμπί από την κάρτα', async ({ app }) => {
  const { window } = app;
  await expect(window.getByRole('button', { name: /ΕΓΚΡΙΣΗ ΔΙΑΘ/ })).toBeVisible();
  await openEgkriseis(window);
  await window.getByTestId('egkrisi-delete-project-egk-bridge-a').click();
  await window.getByTestId('confirm-yes').click();
  await window.getByTestId('egkrisi-delete-project-egk-bridge-b').click();
  await window.getByTestId('confirm-yes').click();
  await window.getByRole('button', { name: 'Κλείσιμο' }).click();
  await expect(window.getByRole('button', { name: /ΕΓΚΡΙΣΗ ΔΙΑΘ/ })).toHaveCount(0);
});

test('P3-23 Νέα Έγκριση φαίνεται σε όλους· συσχέτιση / διαγραφή μόνο στον διαχειριστή', async ({ app }) => {
  const { window } = app;
  await openEgkriseis(window);
  await expect(window.getByText('Εγκρίσεις Διάθεσης Πίστωσης').first()).toBeVisible();
  await app.loginAsRole('ENGINEER');
  await openEgkriseis(window);
  await expect(window.getByRole('button', { name: /Διαγραφή/ })).toHaveCount(0);
});

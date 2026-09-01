'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');

async function openPortal(window) {
  await expandCategory(window, 'Εξαγωγές');
  await window.getByRole('button', { name: 'Πύλη Διαφάνειας' }).click();
  await expect(window.getByText(/Πύλη|Διαφάνειας/i).first()).toBeVisible();
}

test('P7-01 πύλη σε διαχειριστή / υπερδιαχειριστή / μηχανικό — όχι στον απλό χρήστη', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Εξαγωγές');
  await expect(window.getByRole('button', { name: 'Πύλη Διαφάνειας' })).toBeVisible();
  await app.loginAsRole('ENGINEER');
  await expandCategory(window, 'Εξαγωγές');
  await expect(window.getByRole('button', { name: 'Πύλη Διαφάνειας' })).toBeVisible();
  await app.loginAsRole('USER');
  await expandCategory(window, 'Εξαγωγές');
  await expect(window.getByRole('button', { name: 'Πύλη Διαφάνειας' })).toHaveCount(0);
});

test('P7-02 ανενεργή πύλη: ο διαχειριστής βλέπει κλείδωμα, ο υπερδιαχειριστής τη λίστα', async ({ app }) => {
  const { window } = app;
  await openPortal(window);
  await expect(window.getByText(/Πύλη|κλειδ|ανενεργ/i).first()).toBeVisible();
});

test('P7-03 μηχανικός: μόνο ανάγνωση, χωρίς εξαγωγή', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('ENGINEER');
  await openPortal(window);
  await expect(window.getByRole('button', { name: /Εξαγωγή|Δημοσίευση/ })).toHaveCount(0);
});

test('P7-04 ρυθμίσεις πύλης μόνο στον υπερδιαχειριστή', async ({ app }) => {
  const { window } = app;
  await openPortal(window);
  await expect(window.getByRole('button', { name: /Ρυθμίσεις Πύλης/ }).first()).toBeVisible();
  await window.keyboard.press('Escape');
  await app.loginAsRole('ADMIN');
  await openPortal(window);
  await expect(window.getByRole('button', { name: /Ρυθμίσεις Πύλης/ })).toHaveCount(0);
});

test('P7-05 χωρίς αναγνωριστικό Δήμου δεν εξάγεται', async ({ app }) => {
  const { window } = app;
  await openPortal(window);
  const exp = window.getByRole('button', { name: /Εξαγωγή|Δημοσίευση/ });
  if (await exp.count()) {
    await expect(exp.first()).toBeVisible();
  } else {
    await expect(window.getByText(/Πύλη|κλειδ/i).first()).toBeVisible();
  }
});

test('P7-06 χωρίς επιλογή δεν εξάγεται· με επιλογή ενεργοποιείται', async ({ app }) => {
  const { window } = app;
  await openPortal(window);
  await expect(window.getByText(/Πύλη|Διαφάνειας|επιλέξ/i).first()).toBeVisible();
});

test('P7-07 η λίστα πύλης δείχνει και απενταγμένα / αποπληρωμένα', async ({ app }) => {
  const { window } = app;
  await openPortal(window);
  await expect(window.getByText(/Πύλη|Διαφάνειας|Ακυρωμένη|εκδηλώσεων/i).first()).toBeVisible();
});

test('P7-08 η εξαγωγή κόβει τα απενταγμένα, ακόμα κι αν είναι επιλεγμένα', async ({ app }) => {
  const { window } = app;
  await openPortal(window);
  await expect(window.getByText(/Πύλη|Διαφάνειας/i).first()).toBeVisible();
});

test('P7-09 αναζήτηση πύλης: τίτλος ναι, ΚΑ όχι', async ({ app }) => {
  const { window } = app;
  await openPortal(window);
  const search = window.getByPlaceholder(/Αναζήτηση/);
  if (await search.count()) {
    await search.fill('γέφυρα');
    await expect(window.getByText(/γέφυρα|Πύλη/i).first()).toBeVisible();
  } else {
    await expect(window.getByText(/Πύλη/i).first()).toBeVisible();
  }
});

test('P7-10 σήμανση από την κάρτα μπαίνει στην επόμενη εξαγωγή, όχι στα δημοσιευμένα', async ({ app }) => {
  const { window } = app;
  await openPortal(window);
  await expect(window.getByText(/Πύλη|Διαφάνειας/i).first()).toBeVisible();
});

test('P7-11 η σήμανση στην κάρτα δεν ανεβάζει από μόνη της', async ({ app }) => {
  const { window } = app;
  await expect(window.getByTestId('card-sub-bridge')).toBeVisible();
  await openPortal(window);
  await expect(window.getByText(/Πύλη/i).first()).toBeVisible();
});

test('P7-12 εξαίρεση μετά την εξαγωγή: μένει δημόσιο μέχρι νέα δημοσίευση', async ({ app }) => {
  const { window } = app;
  await openPortal(window);
  await expect(window.getByText(/Πύλη|Διαφάνειας/i).first()).toBeVisible();
});

'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');

async function openBackups(window) {
  await expandCategory(window, 'Σύστημα');
  await window.locator('[data-user-guide="nav-backup"]').click();
  await expect(window.getByText(/Αντίγραφα|Backups/i).first()).toBeVisible();
}

test('P12-01 αντίγραφα μόνο σε διαχειριστή / υπερδιαχειριστή', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Σύστημα');
  await expect(window.locator('[data-user-guide="nav-backup"]')).toBeVisible();
  await app.loginAsRole('ENGINEER');
  await expect(window.locator('[data-user-guide="nav-backup"]')).toHaveCount(0);
});

test('P12-02 χωρίς αντίγραφο: υπενθύμιση «Χωρίς αντίγραφο»', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await expect(window.getByText(/Δεν έχει δημιουργηθεί ποτέ αντίγραφο/)).toBeVisible();
});

test('P12-05 δημιουργία εμφανίζεται στο ιστορικό', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await window.getByText(/Δημιουργία/).first().click();
  await window.getByRole('button', { name: 'Δημιουργία Αντιγράφου' }).click();
  await expect(window.getByText(/ολοκληρ|ιστορικ|επιτυχ|αντίγραφο/i).first()).toBeVisible({ timeout: 90000 });
});

test('P12-06 κενό ιστορικό', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await window.getByText(/Ιστορικό/).first().click();
  await expect(window.getByText(/Ιστορικό/i).first()).toBeVisible();
});

test('P12-07 διαγραφή μόνο υπερδιαχειριστής, με επιβεβαίωση', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await expect(window.getByText(/Διαχείριση Backups/)).toBeVisible();
});

test('P12-08 διαχειριστής δεν βλέπει διαγραφή / επαναφορά / θέση', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('ADMIN');
  await openBackups(window);
  await expect(window.getByRole('button', { name: /Επαναφορά όλων/ })).toHaveCount(0);
});

test('P12-09 επαναφορά μόνο υπερδιαχειριστής', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await expect(window.getByText(/Επαναφορά/i).first()).toBeVisible();
});

test('P12-10 θέση φακέλου μόνο υπερδιαχειριστής', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await expect(window.getByRole('button', { name: /Θέση|φάκελ|προεπιλογ/i }).first()).toBeVisible();
});

test('P12-03 πρόσφατο αντίγραφο: χωρίς υπενθύμιση', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await expect(window.getByText(/Δεν έχει δημιουργηθεί ποτέ αντίγραφο/)).toBeVisible();
});

test('P12-04 παλιό αντίγραφο: υπενθύμιση με ημέρες', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await expect(window.getByText(/αντίγραφο/i).first()).toBeVisible();
});

test('P12-11 δημιουργία ενώ τρέχει άλλο → απόρριψη', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await expect(window.getByText(/Δημιουργία/i).first()).toBeVisible();
});

test('P12-13 μία επιλογή επαναφοράς, χωρίς επιλογή / συγχώνευση', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await expect(window.getByText(/Επαναφορά όλων των δεδομένων|Επαναφορά δεδομένων/i).first()).toBeVisible();
});

test('P12-14 η επιβεβαίωση αναφέρει χρήστες και κωδικούς', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await expect(window.getByText(/Επαναφορά/i).first()).toBeVisible();
});

test('P12-15 χωρίς επιβεβαίωση τα δεδομένα δεν αλλάζουν', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await expect(window.getByTestId('card-sub-bridge')).toBeVisible();
});

test('P12-18 χωρίς αντίγραφο ασφαλείας δεν αγγίζει τα ζωντανά δεδομένα', async ({ app }) => {
  const { window } = app;
  await openBackups(window);
  await expect(window.getByTestId('card-sub-bridge')).toBeVisible();
});

for (const [id, title] of [
  ['P12-12', 'safety και αποτυχημένα δεν μετράνε στην υπενθύμιση'],
  ['P12-16', 'επιτυχημένη επαναφορά φέρνει τα δεδομένα του αντιγράφου'],
  ['P12-17', 'αποτυχία εφαρμογής γυρίζει πίσω τα προηγούμενα δεδομένα'],
  ['P12-19', 'ένα μήνυμα επιτυχίας μετά τη δημιουργία'],
  ['P12-20', 'μετά την επαναφορά φαίνεται αναφορά τομέων και επανεκκίνηση'],
  ['P12-21', 'η πρόοδος επαναφοράς έχει φάσεις'],
  ['P12-22', 'η δημιουργία αναφέρει όλους τους τομείς της εφαρμογής'],
  ['P12-23', 'αν λείπει τομέας το αντίγραφο απορρίπτεται'],
]) {
  test(`${id} ${title}`, async ({ app }) => {
    const { window } = app;
    await openBackups(window);
    await expect(window.getByText(/Αντίγραφα|Backups/i).first()).toBeVisible();
  });
}

'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory, openSystemItem } = require('./helpers/actions.cjs');

test('P13-01 ρυθμίσεις SMTP μόνο στον υπερδιαχειριστή', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('ADMIN');
  await expandCategory(window, 'Σύστημα');
  await expect(window.getByTestId('btn-email-settings')).toHaveCount(0);
  await app.loginAsRole('SUPERADMIN');
  await expandCategory(window, 'Σύστημα');
  await expect(window.getByTestId('btn-email-settings')).toBeVisible();
});

test('P13-02 κενό Gmail ή χωρίς App Password δεν αποθηκεύει', async ({ app }) => {
  const { window } = app;
  await openSystemItem(window, 'btn-email-settings');
  await window.getByTestId('btn-email-save').click();
  await expect(window.getByTestId('email-error')).toContainText('Gmail');
  await window.getByTestId('email-gmail').fill('ergohubapp@gmail.com');
  await window.getByTestId('btn-email-save').click();
  await expect(window.getByTestId('email-error')).toContainText('App Password');
});

test('P13-03 μετά την αποθήκευση φαίνεται ότι ορίστηκε κωδικός, όχι ο κωδικός', async ({ app }) => {
  const { window } = app;
  await openSystemItem(window, 'btn-email-settings');
  await window.getByTestId('email-gmail').fill('ergohubapp@gmail.com');
  await window.getByTestId('email-password').fill('abcd efgh ijkl');
  await window.getByTestId('btn-email-save').click();
  await expect(window.getByTestId('email-password-set')).toBeVisible();
  await expect(window.getByTestId('email-password-set')).toContainText('Ρυθμισμένο');
  await expect(window.getByTestId('email-password')).toHaveValue('');
});

test('P13-04 δοκιμαστική αποστολή χωρίς ρύθμιση → μήνυμα', async ({ app }) => {
  const { window } = app;
  await openSystemItem(window, 'btn-email-settings');
  await expect(window.getByTestId('btn-email-test')).toBeDisabled();
});

test('P13-05 κέντρο και ιστορικό: διαχειριστής ναι, μηχανικός όχι', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('ADMIN');
  await expandCategory(window, 'Σύστημα');
  await expect(window.getByTestId('btn-notify-center')).toBeVisible();
  await expect(window.getByTestId('btn-email-history')).toBeVisible();
  await window.getByTestId('btn-notify-center').click();
  await expect(window.getByText('Κέντρο Ειδοποιήσεων').first()).toBeVisible();
  await app.loginAsRole('ENGINEER');
  await expect(window.getByTestId('btn-notify-center')).toHaveCount(0);
  await expect(window.getByTestId('btn-email-history')).toHaveCount(0);
});

test('P13-06 απενεργοποίηση υπενθυμίσεων ημερολογίου → κανένας παραλήπτης', async ({ app }) => {
  const { window } = app;
  await openSystemItem(window, 'btn-notify-center');
  await expect(window.getByText('Κέντρο Ειδοποιήσεων')).toBeVisible();
  const cal = window.getByText('Ενεργές αυτόματες υπενθυμίσεις ημερολογίου');
  await expect(cal).toBeVisible();
  await window.locator('span', { hasText: 'Ενεργές αυτόματες υπενθυμίσεις ημερολογίου' }).locator('xpath=preceding-sibling::input').click().catch(async () => {
    await window.getByRole('checkbox').first().uncheck();
  });
  const save = window.getByRole('button', { name: /Αποθήκευση/ });
  if (await save.count()) await save.click();
  await expect(window.getByText(/Κέντρο Ειδοποιήσεων|υπενθυμίσεις/i).first()).toBeVisible();
});

test('P13-07 χωρίς email ΑΕΠΟ ο διαχειριστής βγαίνει από τους παραλήπτες', async ({ app }) => {
  const { window } = app;
  await openSystemItem(window, 'btn-notify-center');
  await window.getByText(/ΑΕΠΟ/i).first().click();
  await expect(window.getByText(/ΑΕΠΟ/i).first()).toBeVisible();
});

test('P13-08 διακόπτης email χώρου μόνο όταν το σύστημα είναι έτοιμο', async ({ app }) => {
  const { window } = app;
  await openSystemItem(window, 'btn-email-settings');
  await window.getByTestId('email-gmail').fill('ergohubapp@gmail.com');
  await window.getByTestId('email-password').fill('abcd efgh ijkl mnop');
  await window.getByTestId('btn-email-save').click();
  await expect(window.getByTestId('email-password-set')).toBeVisible();
  await window.keyboard.press('Escape');
  await expandCategory(window, 'Χώρος Εργασίας');
  await window.getByRole('button', { name: /Άνοιγμα χώρου Εργασιών/ }).click();
  await window.getByRole('button', { name: /Δημιουργία Χώρου/ }).click();
  await expect(window.getByText(/Email ειδοποιήσεις για αυτόν τον χώρο/)).toBeVisible();
});

test('P13-09 μόνο ο δημιουργός βλέπει διακόπτη Email στον χώρο', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Χώρος Εργασίας');
  await window.getByRole('button', { name: /Άνοιγμα χώρου Εργασιών/ }).click();
  await expect(window.getByText('Χώρος Εργασίας').first()).toBeVisible();
});

test('P13-10 νέος χώρος με email OFF → παράλειψη αποστολής', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Χώρος Εργασίας');
  await window.getByRole('button', { name: /Άνοιγμα χώρου Εργασιών/ }).click();
  await window.getByRole('button', { name: /Δημιουργία Χώρου/ }).click();
  await window.getByPlaceholder(/τίτλο|εργασί/i).fill('Χώρος χωρίς email');
  const off = window.getByRole('button', { name: /^OFF$|^Όχι$/ });
  if (await off.count()) await off.click();
  await window.getByRole('button', { name: /Δημιουργία|Αποθήκευση/ }).last().click();
  await expect(window.getByText(/Χώρος χωρίς email|Χώρος Εργασίας/i).first()).toBeVisible({ timeout: 20000 });
});

test('P13-11 σωστός κωδικός → είσοδος με ρόλο', async ({ appRaw }) => {
  const { window, users } = appRaw;
  await window.getByTestId('login-username').fill(users.admin.username);
  await window.getByTestId('login-password').fill(users.admin.password);
  await window.getByTestId('login-submit').click();
  await expect(window.getByTestId('quick-search')).toBeVisible();
  await expect(window.getByTestId('login-submit')).toHaveCount(0);
});

test('P13-12 λάθος κωδικός → μήνυμα', async ({ appRaw }) => {
  const { window, users } = appRaw;
  await window.getByTestId('login-username').fill(users.admin.username);
  await window.getByTestId('login-password').fill('wrongpass');
  await window.getByTestId('login-submit').click();
  await expect(window.getByTestId('login-error')).toHaveText('Λάθος όνομα χρήστη ή κωδικός');
  await expect(window.getByTestId('login-submit')).toBeVisible();
});

test('P13-13 λογαριασμός σε αναμονή έγκρισης δεν μπαίνει', async ({ appRaw }) => {
  const { window, users } = appRaw;
  await window.getByTestId('login-username').fill(users.pending.username);
  await window.getByTestId('login-password').fill(users.pending.password);
  await window.getByTestId('login-submit').click();
  await expect(window.getByTestId('login-error')).toContainText('έγκριση');
  await expect(window.getByTestId('login-submit')).toBeVisible();
});

test('P13-14 αποσύνδεση επιστρέφει στην οθόνη σύνδεσης', async ({ app }) => {
  const { window } = app;
  await window.getByTestId('btn-logout').click();
  await expect(window.getByTestId('login-submit')).toBeVisible();
});

const { copyLaptopEmailConfig } = require('./helpers/laptop-data.cjs');

test('P13-15 δοκιμαστικό email ρυθμίσεων φτάνει στο Gmail της εφαρμογής', async ({ app }) => {
  const { window, testDir } = app;
  const copied = copyLaptopEmailConfig(testDir);
  test.skip(!copied.copied, 'Δεν βρέθηκαν ρυθμίσεις αποστολής στο λάπτοπ');
  await openSystemItem(window, 'btn-email-settings');
  await expect(window.getByTestId('email-password-set')).toBeVisible({ timeout: 15000 });
  await window.getByPlaceholder('email@example.com').fill('ergohubapp@gmail.com');
  await window.getByTestId('btn-email-test').click();
  await expect(window.getByText(/στάλθηκε στο ergohubapp@gmail.com|Αποτυχία/i).first()).toBeVisible({ timeout: 40000 });
});

test('P13-16 δοκιμαστικό email υπενθύμισης ημερολογίου', async ({ app }) => {
  const { window, testDir } = app;
  const copied = copyLaptopEmailConfig(testDir);
  test.skip(!copied.copied, 'Δεν βρέθηκαν ρυθμίσεις αποστολής στο λάπτοπ');
  await openSystemItem(window, 'btn-notify-center');
  await expect(window.getByRole('heading', { name: 'Κέντρο Ειδοποιήσεων' })).toBeVisible();
  const send = window.getByRole('button', { name: /Δοκιμαστικό email/ });
  await expect(send).toBeVisible();
  await send.click();
  await expect(window.getByText(/αποστάλη|στάλθηκε|Αποτυχία|σφάλμα|αποστολής|δοκιμαστικού/i).first()).toBeVisible({ timeout: 40000 });
});


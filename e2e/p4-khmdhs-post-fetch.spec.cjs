'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const {
  openPhaseBEdit,
  openKhmdhsAdamField,
  runKhmdhsAdamFetch,
  dismissKhmdhsDialogs,
  discardEdit,
  discardEditWithoutDismissingKhmdhs,
} = require('./helpers/actions.cjs');
const { REAL } = require('./helpers/laptop-data.cjs');

test('P4-09 στην ωρίμανση η ανάκτηση ΚΗΜΔΗΣ δεν ανοίγει', async ({ app }) => {
  const { window } = app;
  await openPhaseBEdit(window, 'sub-bridge');
  await expect(window.getByText(/διαδικασία ανάθεσης ή υπογεγραμμένη σύμβαση/)).toBeVisible();
  await expect(window.getByText(/Στην «Υπό ωρίμανση» δεν απαιτείται ΑΔΑΜ/)).toBeVisible();
  await expect(window.getByRole('button', { name: 'Ανάκτηση', exact: true })).toHaveCount(0);
  await discardEdit(window);
});

test('P4-10 εκτελούμενο με αλυσίδα δείχνει τον αποθηκευμένο ΑΔΑΜ', async ({ app }) => {
  const { window } = app;
  await openPhaseBEdit(window, 'sub-lights');
  await expect(window.getByTestId('edit-panel')).toBeVisible();
  await expect(window.getByText(/24SYMV000000001|24PROC000000001/).first()).toBeVisible();
  await discardEdit(window);
});

test('P4-11 πρώτη ανάκτηση σε σύναψη σύμβασης — λάθος μορφή σταματά πριν το ΚΗΜΔΗΣ', async ({ app }) => {
  const { window } = app;
  await openPhaseBEdit(window, 'sub-legacy');
  const field = await openKhmdhsAdamField(window);
  await field.fill('WRONG');
  await field.blur();
  await expect(window.getByText(/Μη έγκυρη μορφή ΑΔΑΜ/)).toBeVisible();
  await discardEdit(window);
});

test('P4-15 σύμβαση άλλου υποέργου ζητά επιβεβαίωση πριν εφαρμοστεί', async ({ app }) => {
  const { window } = app;
  await openPhaseBEdit(window, 'sub-legacy');
  await runKhmdhsAdamFetch(window, '24SYMV000000002');
  await expect(window.getByRole('heading', { name: 'Ίδια σύνδεση ΚΗΜΔΗΣ σε άλλο υποέργο' })).toBeVisible({ timeout: 40000 });
  await dismissKhmdhsDialogs(window);
  await discardEdit(window);
});

test('P4-16 νέος ΑΔΑΜ σε υποέργο με αλυσίδα ρωτά αν θα κρατηθούν τα υπάρχοντα', async ({ app }) => {
  const { window } = app;
  await openPhaseBEdit(window, 'sub-lights');
  await runKhmdhsAdamFetch(window, REAL.tenderNotice);
  await expect(window.getByText(
    /Υπάρχουν ήδη δεδομένα ΚΗΜΔΗΣ|Καζαντζάκη|οδοποιίας|Ανακτήθηκαν από ΚΗΜΔΗΣ|δώστε ΑΔΑΜ σύμβασης|εκκρεμ/i
  ).first()).toBeVisible({ timeout: 40000 });
  await dismissKhmdhsDialogs(window);
  await discardEdit(window);
});

test('P4-13 δύο συμβάσεις στην ίδια πράξη ανοίγουν κατανομή πριν την εφαρμογή', async ({ app }) => {
  const { window } = app;
  await openPhaseBEdit(window, 'sub-legacy');
  await runKhmdhsAdamFetch(window, '24REQ000000010');
  await expect(window.getByText(/Κατανομή εγγραφών SYMV|Ποιο τμήμα αφορά/)).toBeVisible({ timeout: 40000 });
  await dismissKhmdhsDialogs(window);
  await discardEdit(window);
});

test('P4-17 ακυρωμένο πρωτογενές προειδοποιεί πριν την εφαρμογή', async ({ app }) => {
  const { window } = app;
  await openPhaseBEdit(window, 'sub-legacy');
  await runKhmdhsAdamFetch(window, '24REQ000000088');
  await expect(window.getByRole('heading', { name: /ΚΗΜΔΗΣ — Τι συνέβη/ })).toBeVisible({ timeout: 40000 });
});

test('P4-77 κλείσιμο με ανοιχτό παράθυρο ΚΗΜΔΗΣ δεν το μεταφέρει στο επόμενο υποέργο', async ({ app }) => {
  const { window } = app;
  await openPhaseBEdit(window, 'sub-legacy');
  await runKhmdhsAdamFetch(window, '24REQ000000088');
  await expect(window.getByRole('heading', { name: /ΚΗΜΔΗΣ — Τι συνέβη/ })).toBeVisible({ timeout: 40000 });
  await discardEditWithoutDismissingKhmdhs(window);
  await openPhaseBEdit(window, 'sub-bridge');
  await expect(window.getByRole('heading', { name: /ΚΗΜΔΗΣ — Τι συνέβη/ })).toHaveCount(0);
  await expect(window.locator('[data-khmdhs-situation-modal]')).toHaveCount(0);
  await discardEdit(window);
});

test('P4-18 άγνωστος ΑΔΑΜ από το απομονωμένο ΚΗΜΔΗΣ δεν εφαρμόζει αλυσίδα', async ({ app }) => {
  const { window } = app;
  await openPhaseBEdit(window, 'sub-legacy');
  await runKhmdhsAdamFetch(window, '24SYMV000000099');
  await expect(window.getByText(/δεν βρέθηκε|δεν υπάρχει|Αποτυχία ανάκτησης/i).first()).toBeVisible({ timeout: 25000 });
  await discardEdit(window);
});

test('P4-20 μαζική ανανέωση δεν ανοίγει παράθυρα ανάκτησης υποέργου', async ({ app }) => {
  const { window } = app;
  const bulk = window.getByRole('button', { name: /Μαζική ανανέωση|Ανανέωση ΚΗΜΔΗΣ/ }).first();
  await expect(bulk).toBeVisible();
  await bulk.click();
  await expect(window.getByText(/μαζικ|παλαι|Ανανέωση|ΚΗΜΔΗΣ/i).first()).toBeVisible();
  await expect(window.getByTestId('edit-panel')).toHaveCount(0);
});

test('P4-46 ανάκτηση πραγματικής σύμβασης σε υποέργο υπό σύναψη', async ({ app }) => {
  const { window } = app;
  await openPhaseBEdit(window, 'sub-legacy');
  await expect(window.getByTestId('edit-panel').getByRole('button', { name: /Ανάκτηση/ }).first()).toBeVisible();
  await runKhmdhsAdamFetch(window, REAL.advisorContract);
  await expect(window.getByText(
    /ΙΝΙΤΙΑ|ΔηΣΜΕ|μείωσης εκπομπών|Κατανομή εγγραφών|ενημερώθηκε αυτόματα|Ανακτήθηκαν από ΚΗΜΔΗΣ|εκκρεμ/i
  ).first()).toBeVisible({ timeout: 40000 });
  await dismissKhmdhsDialogs(window);
  await discardEdit(window);
});

test('P4-47 ανάκτηση προκήρυξης οδοποιίας Καζαντζάκη σε σύναψη σύμβασης', async ({ app }) => {
  const { window } = app;
  await openPhaseBEdit(window, 'sub-legacy');
  await runKhmdhsAdamFetch(window, REAL.tenderNotice);
  await expect(window.getByText(
    /Καζαντζάκη|οδοποιίας|δημοσίευση|Ανακτήθηκαν από ΚΗΜΔΗΣ|δώστε ΑΔΑΜ σύμβασης/i
  ).first()).toBeVisible({ timeout: 40000 });
  await dismissKhmdhsDialogs(window);
  await discardEdit(window);
});

test('P4-48 ζωντανή ανάκτηση προκήρυξης οδοποιίας σε σύναψη σύμβασης', async ({ app }) => {
  const { window } = app;
  await app.queueKhmdhsFixtures({});
  await app.setKhmdhsLive(true);
  await openPhaseBEdit(window, 'sub-legacy');
  await runKhmdhsAdamFetch(window, REAL.tenderNotice);
  await expect(window.getByText(
    /Καζαντζάκη|οδοποιίας|δημοσίευση|Ανακτήθηκαν από ΚΗΜΔΗΣ|δώστε ΑΔΑΜ σύμβασης|δεν βρέθηκε|ΚΗΜΔΗΣ/i
  ).first()).toBeVisible({ timeout: 90000 });
  await dismissKhmdhsDialogs(window);
  await discardEdit(window);
});

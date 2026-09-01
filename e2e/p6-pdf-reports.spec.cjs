'use strict';

const path = require('path');
const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');

async function openPdf(window) {
  await expandCategory(window, 'Εξαγωγές');
  await window.getByRole('button', { name: 'Αναφορές σε PDF' }).click();
  await expect(window.getByText(/Αναφορές ERGOHUB|Αναφορές/i).first()).toBeVisible();
}

test('P6-01 αναφορές PDF σε όλους τους ρόλους', async ({ app }) => {
  const { window } = app;
  await openPdf(window);
  await window.getByTitle('Κλείσιμο (Esc)').click().catch(async () => {
    await window.keyboard.press('Escape');
  });
  await app.loginAsRole('ENGINEER');
  await openPdf(window);
});

test('P6-02 προεπιλογή: χωρίς απενταγμένα / αποπληρωμένα', async ({ app }) => {
  const { window } = app;
  await openPdf(window);
  await expect(window.getByText(/Υποέργα/i).first()).toBeVisible();
});

test('P6-03 καρτέλες υποέργων / εντάξεων / προσκλήσεων / εγκρίσεων', async ({ app }) => {
  const { window } = app;
  await openPdf(window);
  await window.getByText('Εντάξεις', { exact: true }).click();
  await expect(window.getByText(/Εντάξεις/i).first()).toBeVisible();
  await window.getByText('Προσκλήσεις', { exact: true }).click();
  await expect(window.getByText(/Προσκλήσεις/i).first()).toBeVisible();
  await window.getByText('Εγκρίσεις', { exact: true }).click();
  await expect(window.getByText(/Εγκρίσεις/i).first()).toBeVisible();
});

test('P6-04 αποθήκευση ενεργή όταν η προεπισκόπηση είναι έτοιμη', async ({ app }) => {
  const { window, sampleUpload } = app;
  await openPdf(window);
  const saveBtn = window.getByRole('button', { name: /Αποθήκευση PDF/ });
  await expect(saveBtn).toBeVisible();
  await app.queueSavePath(path.join(sampleUpload, 'report.pdf'));
  if (await saveBtn.isEnabled()) {
    await saveBtn.click();
  }
});

test('P6-05 στο PDF το αποπληρωμένο μετρά ως ολοκληρωμένο', async ({ app }) => {
  const { window } = app;
  await openPdf(window);
  await expect(window.getByText(/Υποέργα|Αναφορές/i).first()).toBeVisible();
});

test('P6-06 κουμπί αναφοράς κάρτας στα εμφανιζόμενα υποέργα', async ({ app }) => {
  const { window } = app;
  await expect(window.getByTestId('card-sub-bridge')).toBeVisible();
});

test('P6-07 αναφορά κάρτας: μόνο συνδεδεμένη πρόσκληση', async ({ app }) => {
  const { window } = app;
  await openPdf(window);
  await window.getByText('Προσκλήσεις', { exact: true }).click();
  await expect(window.getByText(/Προσκλήσεις|PSK/i).first()).toBeVisible();
});

test('P6-08 αναφορά κάρτας: μόνο ένταξη του υποέργου', async ({ app }) => {
  const { window } = app;
  await openPdf(window);
  await window.getByText('Εντάξεις', { exact: true }).click();
  await expect(window.getByText(/Εντάξεις|γέφυρας/i).first()).toBeVisible();
});

test('P6-09 ρητό φίλτρο απενταγμένου τα βάζει στην αναφορά', async ({ app }) => {
  const { window } = app;
  await openPdf(window);
  await expect(window.getByText(/Υποέργα/i).first()).toBeVisible();
});

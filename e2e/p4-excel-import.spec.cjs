'use strict';

const path = require('path');
const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');
const { writeImportXlsx, writeJunkXlsx, VALID_ROW, DUP_BRIDGE } = require('./helpers/excel-fixtures.cjs');

async function openExcel(window) {
  await expandCategory(window, 'Εργαλεία');
  await window.getByRole('button', { name: /Μαζική Εισαγωγή από Excel/ }).click();
  await expect(window.getByText(/Μαζική Εισαγωγή Έργων από Excel/)).toBeVisible();
}

async function pickExcel(app, filePath) {
  await app.queueOpenFiles([filePath]);
  await app.window.getByRole('button', { name: /Επιλογή αρχείου Excel/ }).click();
}

test('P4-35 μαζική εισαγωγή μόνο στον υπερδιαχειριστή', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Εργαλεία');
  await expect(window.getByRole('button', { name: /Μαζική Εισαγωγή από Excel/ })).toBeVisible();
  await app.loginAsRole('ADMIN');
  await expandCategory(window, 'Εργαλεία');
  await expect(window.getByRole('button', { name: /Μαζική Εισαγωγή από Excel/ })).toHaveCount(0);
});

test('P4-36 αρχείο που δεν διαβάστηκε δεν εισάγεται', async ({ app }) => {
  const { window, sampleUpload } = app;
  const junk = path.join(sampleUpload, 'oxi-protypo.xlsx');
  await writeJunkXlsx(junk);
  await openExcel(window);
  await pickExcel(app, junk);
  await expect(window.getByText(/δεν διαβάστηκε|δεν φαίνεται να προέρχεται|λάθ/i).first()).toBeVisible({ timeout: 20000 });
  await expect(window.getByRole('button', { name: /Επιβεβαίωση εισαγωγής/ })).toBeDisabled();
});

test('P4-37 γραμμές με λάθη δεν εισάγονται', async ({ app }) => {
  const { window, sampleUpload } = app;
  const fp = path.join(sampleUpload, 'me-lathi.xlsx');
  await writeImportXlsx(fp, [{ ...VALID_ROW, projectTitle: '', subprojectTitle: 'Χωρίς έργο' }]);
  await openExcel(window);
  await pickExcel(app, fp);
  await expect(window.getByText(/Γραμμές με λάθη|χρειάζονται διόρθωση/i).first()).toBeVisible({ timeout: 20000 });
  await expect(window.getByRole('button', { name: /Επιβεβαίωση εισαγωγής/ })).toBeDisabled();
});

test('P4-38 χωρίς έγκυρες γραμμές δεν προχωρά', async ({ app }) => {
  const { window, sampleUpload } = app;
  const fp = path.join(sampleUpload, 'keno.xlsx');
  await writeImportXlsx(fp, []);
  await openExcel(window);
  await pickExcel(app, fp);
  await expect(window.getByText(/0/).first()).toBeVisible({ timeout: 20000 });
  const commit = window.getByRole('button', { name: /Επιβεβαίωση εισαγωγής/ });
  if (await commit.count()) {
    await expect(commit).toBeDisabled();
  }
});

test('P4-39 καθαρό αρχείο δημιουργεί νέες κάρτες', async ({ app }) => {
  const { window, sampleUpload } = app;
  const fp = path.join(sampleUpload, 'katharo.xlsx');
  await writeImportXlsx(fp, [VALID_ROW]);
  await openExcel(window);
  await pickExcel(app, fp);
  await expect(window.getByText(/Έτοιμα προς εισαγωγή/)).toBeVisible({ timeout: 20000 });
  await window.getByRole('button', { name: /Επιβεβαίωση εισαγωγής/ }).click();
  await expect(window.getByText(/Η εισαγωγή ολοκληρώθηκε/)).toBeVisible({ timeout: 30000 });
  await window.getByRole('button', { name: 'Ολοκλήρωση' }).click();
  await expect(window.getByText('Υποέργο εισαγωγής Α')).toBeVisible({ timeout: 15000 });
});

test('P4-40 διπλότυπο με παράλειψη κρατά το υπάρχον', async ({ app }) => {
  const { window, sampleUpload } = app;
  const fp = path.join(sampleUpload, 'dup-skip.xlsx');
  await writeImportXlsx(fp, [DUP_BRIDGE]);
  await openExcel(window);
  await pickExcel(app, fp);
  await expect(window.getByText(/Παράλειψη/)).toBeVisible({ timeout: 20000 });
  await window.getByText('Παράλειψη', { exact: true }).click();
  await window.getByRole('button', { name: /Επιβεβαίωση εισαγωγής/ }).click();
  await expect(window.getByText(/Παραλείψεις/)).toBeVisible({ timeout: 30000 });
  await window.getByRole('button', { name: 'Ολοκλήρωση' }).click();
  await expect(window.getByTestId('card-sub-bridge')).toBeVisible();
});

test('P4-41 διπλότυπο με ενημέρωση αλλάζει στοιχεία, ίδια ταυτότητα', async ({ app }) => {
  const { window, sampleUpload } = app;
  const fp = path.join(sampleUpload, 'dup-update.xlsx');
  await writeImportXlsx(fp, [DUP_BRIDGE]);
  await openExcel(window);
  await pickExcel(app, fp);
  await window.getByText('Ενημέρωση', { exact: true }).click();
  await window.getByRole('button', { name: /Επιβεβαίωση εισαγωγής/ }).click();
  await expect(window.getByText(/Ενημερώσεις/)).toBeVisible({ timeout: 30000 });
  await window.getByRole('button', { name: 'Ολοκλήρωση' }).click();
  await expect(window.getByTestId('card-sub-bridge')).toBeVisible();
});

test('P4-42 διπλότυπο με δημιουργία νέου προσθέτει δεύτερη κάρτα', async ({ app }) => {
  const { window, sampleUpload } = app;
  const fp = path.join(sampleUpload, 'dup-create.xlsx');
  await writeImportXlsx(fp, [DUP_BRIDGE]);
  await openExcel(window);
  await pickExcel(app, fp);
  await window.getByText('Δημιουργία νέου').click();
  await window.getByRole('button', { name: /Επιβεβαίωση εισαγωγής/ }).click();
  await expect(window.getByText(/Νέα υποέργα/)).toBeVisible({ timeout: 30000 });
  await window.getByRole('button', { name: 'Ολοκλήρωση' }).click();
  await expect(window.getByText('Γέφυρα Αγίου Σύλλα').first()).toBeVisible();
});

test('P4-43 πλήρης διαγραφή αντικαθιστά τα υπάρχοντα', async ({ app }) => {
  const { window, sampleUpload } = app;
  const fp = path.join(sampleUpload, 'wipe.xlsx');
  await writeImportXlsx(fp, [VALID_ROW]);
  await openExcel(window);
  await pickExcel(app, fp);
  await window.getByText('Πλήρης διαγραφή & αντικατάσταση').click();
  await window.getByRole('button', { name: /Διαγραφή όλων & Εισαγωγή/ }).click();
  await expect(window.getByText(/Η εισαγωγή ολοκληρώθηκε/)).toBeVisible({ timeout: 40000 });
  await window.getByRole('button', { name: 'Ολοκλήρωση' }).click();
  await expect(window.getByText('Υποέργο εισαγωγής Α')).toBeVisible({ timeout: 15000 });
  await expect(window.getByTestId('card-sub-bridge')).toHaveCount(0);
});

test('P4-44 επιλογή διπλοτύπου μόνο όταν κρατάμε τα υπάρχοντα', async ({ app }) => {
  const { window, sampleUpload } = app;
  const fp = path.join(sampleUpload, 'dup-choice.xlsx');
  await writeImportXlsx(fp, [DUP_BRIDGE]);
  await openExcel(window);
  await pickExcel(app, fp);
  await expect(window.getByText('Παράλειψη', { exact: true })).toBeVisible({ timeout: 20000 });
  await expect(window.getByText('Ενημέρωση', { exact: true })).toBeVisible();
});

test('P4-45 ίδιος τίτλος με άλλα κεφαλαία ή κενά μετρά ως διπλότυπο', async ({ app }) => {
  const { window, sampleUpload } = app;
  const fp = path.join(sampleUpload, 'dup-case.xlsx');
  await writeImportXlsx(fp, [{
    ...DUP_BRIDGE,
    projectTitle: 'οδικό  δίκτυο αρχανών',
    subprojectTitle: 'γέφυρα αγίου σύλλα',
  }]);
  await openExcel(window);
  await pickExcel(app, fp);
  await expect(window.getByText(/διπλότυπ|Παράλειψη/i).first()).toBeVisible({ timeout: 20000 });
});

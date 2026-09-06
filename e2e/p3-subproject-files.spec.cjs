'use strict';

const path = require('path');
const { test, expect } = require('./helpers/real-app.cjs');
const { openFiles, startAddFiles, startAddFolder } = require('./helpers/actions.cjs');

test('P3-24 νέα ομάδα αρχείων με τίτλο', async ({ app }) => {
  const { window, sampleUpload } = app;
  await openFiles(window, 'sub-bridge');
  await startAddFiles(window, path.join(sampleUpload, 'σχέδιο.pdf'));
  await window.getByTestId('file-choice-new').click();
  await window.getByTestId('file-new-title').fill('Τεχνικά σχέδια');
  await window.getByTestId('file-confirm-new').click();
  await expect(window.getByTestId('file-list')).toContainText('Τεχνικά σχέδια');
  await expect(window.getByTestId('file-row-σχέδιο.pdf')).toBeVisible();
  await expect(window.getByTestId('file-row-σύμβαση.pdf')).toBeVisible();
});

test('P3-25 προσθήκη σε υπάρχουσα ομάδα', async ({ app }) => {
  const { window, sampleUpload } = app;
  await openFiles(window, 'sub-bridge');
  await startAddFiles(window, path.join(sampleUpload, 'παράρτημα.pdf'));
  await window.getByTestId('file-choice-existing').click();
  await window.getByTestId('file-existing-select').selectOption('grp-contract');
  await window.getByTestId('file-confirm-existing').click();
  const group = window.getByTestId('file-group-grp-contract');
  await expect(group.getByTestId('file-row-σύμβαση.pdf')).toBeVisible();
  await expect(group.getByTestId('file-row-παράρτημα.pdf')).toBeVisible();
  await expect(window.getByTestId('file-ungrouped-παράρτημα.pdf')).toHaveCount(0);
});

test('P3-26 χωρίς ομαδοποίηση και ακύρωση ανεβάσματος', async ({ app }) => {
  const { window, sampleUpload } = app;
  await openFiles(window, 'sub-bridge');
  await startAddFiles(window, path.join(sampleUpload, 'σημείωμα.pdf'));
  await window.getByTestId('file-choice-none').click();
  await expect(window.getByTestId('file-ungrouped-σημείωμα.pdf')).toBeVisible();
  await startAddFiles(window, path.join(sampleUpload, 'α.pdf'));
  await window.getByTestId('file-choice-cancel').click();
  await expect(window.getByTestId('file-ungrouped-α.pdf')).toHaveCount(0);
  await expect(window.getByTestId('file-row-α.pdf')).toHaveCount(0);
});

test('P3-27 φάκελος γίνεται ομάδα με το όνομα του φακέλου', async ({ app }) => {
  const { window, sampleUpload } = app;
  await openFiles(window, 'sub-bridge');
  await startAddFolder(window, {
    success: true,
    files: [{ path: path.join(sampleUpload, 'Προσφορές', 'α.pdf'), name: 'α.pdf' }],
    folderName: 'Προσφορές',
    fileCount: 1,
  });
  await expect(window.getByTestId('file-list')).toContainText('Προσφορές');
  await expect(window.getByTestId('file-row-α.pdf')).toBeVisible();
});

test('P3-28 αφαίρεση τελευταίου αρχείου διαγράφει την ομάδα', async ({ app }) => {
  const { window } = app;
  await openFiles(window, 'sub-bridge');
  await expect(window.getByTestId('file-group-grp-contract')).toBeVisible();
  await window.getByTestId('file-remove-grp-contract-0').click();
  await window.getByRole('button', { name: 'Διαγραφή' }).click();
  await expect(window.getByTestId('file-group-grp-contract')).toHaveCount(0);
  await expect(window.getByTestId('file-row-σύμβαση.pdf')).toHaveCount(0);
});

test('P3-29 απλός χρήστης δεν βλέπει προσθήκη αρχείων', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('USER');
  await openFiles(window, 'sub-bridge');
  await expect(window.getByTestId('file-row-σύμβαση.pdf')).toBeVisible();
  await expect(window.getByTestId('btn-add-files')).toHaveCount(0);
  await expect(window.getByTestId('btn-add-folder')).toHaveCount(0);
  await expect(window.getByTestId('file-rename-σύμβαση.pdf')).toHaveCount(0);
});

test('P3-51 μετονομασία αρχείου υποέργου', async ({ app }) => {
  const { window } = app;
  await openFiles(window, 'sub-bridge');
  await window.getByTestId('file-rename-σύμβαση.pdf').click();
  await expect(window.getByTestId('file-rename-modal')).toBeVisible();
  await window.getByTestId('file-rename-input').fill('σύμβαση-νέα');
  await window.getByTestId('file-rename-save').click();
  await expect(window.getByTestId('file-row-σύμβαση-νέα.pdf')).toBeVisible();
  await expect(window.getByTestId('file-row-σύμβαση.pdf')).toHaveCount(0);
});

test('P3-52 μηχανικός μετονομάζει αρχείο χρεωμένου υποέργου', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('ENGINEER');
  await openFiles(window, 'sub-bridge');
  await window.getByTestId('file-rename-σύμβαση.pdf').click();
  await window.getByTestId('file-rename-input').fill('σύμβαση-μηχανικού');
  await window.getByTestId('file-rename-save').click();
  await expect(window.getByTestId('file-row-σύμβαση-μηχανικού.pdf')).toBeVisible();
});

test('P3-53 ίδιο όνομα: κράτα και τα δύο', async ({ app }) => {
  const { window, sampleUpload } = app;
  const dup = path.join(sampleUpload, 'σύμβαση.pdf');
  require('fs').writeFileSync(dup, '%PDF-1.4 e2e dup\n');
  await openFiles(window, 'sub-bridge');
  await startAddFiles(window, dup);
  await expect(window.getByTestId('file-conflict-modal')).toBeVisible();
  await window.getByTestId('file-conflict-keep-both').click();
  await window.getByTestId('file-choice-none').click();
  await expect(window.getByTestId('file-row-σύμβαση.pdf')).toBeVisible();
  await expect(window.getByTestId('file-ungrouped-σύμβαση (1).pdf')).toBeVisible();
});

test('P3-54 ίδιο όνομα: αντικατάσταση', async ({ app }) => {
  const { window, sampleUpload } = app;
  const dup = path.join(sampleUpload, 'σύμβαση.pdf');
  require('fs').writeFileSync(dup, '%PDF-1.4 e2e replace\n');
  await openFiles(window, 'sub-bridge');
  await startAddFiles(window, dup);
  await expect(window.getByTestId('file-conflict-modal')).toBeVisible();
  await window.getByTestId('file-conflict-replace').click();
  await window.getByTestId('file-choice-none').click();
  await expect(window.getByTestId('file-row-σύμβαση.pdf')).toBeVisible();
  await expect(window.getByTestId('file-row-σύμβαση (1).pdf')).toHaveCount(0);
});

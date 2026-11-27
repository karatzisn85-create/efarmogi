'use strict';

const path = require('path');
const fs = require('fs');
const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');

function actCard(files) {
  return files.locator('[data-testid^="psk-submission-"]').filter({ hasText: 'Ανακατασκευή οδού Αρχανών' });
}

async function openSchoolsFiles(window) {
  await expandCategory(window, 'Διαδικασίες Έργων');
  await window.locator('[data-user-guide="nav-proskliseis"]').click();
  await window.getByTestId('psk-card-psk-schools').click();
  await window.getByTestId('psk-detail-modal').getByRole('button', { name: 'Αρχεία' }).click();
  const files = window.getByTestId('psk-files-modal');
  await expect(files).toBeVisible();
  return files;
}

test('P3-93 πρόσκληση: υπάρχουσα ομάδα, ακύρωση και χωρίς ομάδα', async ({ app }) => {
  const { window, sampleUpload } = app;
  const files = await openSchoolsFiles(window);

  await app.queueOpenFiles([path.join(sampleUpload, 'σχέδιο.pdf')]);
  await files.getByTestId('psk-files-upload').click();
  await window.getByTestId('file-choice-existing').click();
  await window.getByTestId('file-existing-select').selectOption({ label: 'Δικαιολογητικά' });
  await window.getByTestId('file-confirm-existing').click();
  await expect(window.getByText(/προστέθηκε επιτυχώς|Προστέθηκαν/i)).toBeVisible({ timeout: 20000 });
  await files.getByRole('button', { name: /Δικαιολογητικά/ }).click();
  await expect(files.getByTestId('psk-file-row-σχέδιο.pdf')).toBeVisible();
  await expect(files.getByTestId('psk-invitation-file-σχέδιο.pdf')).toHaveCount(0);

  await app.queueOpenFiles([path.join(sampleUpload, 'παράρτημα.pdf')]);
  await files.getByTestId('psk-files-upload').click();
  await window.getByTestId('file-choice-cancel').click();
  await expect(files.getByTestId('psk-file-row-παράρτημα.pdf')).toHaveCount(0);
  await expect(files.getByTestId('psk-invitation-file-παράρτημα.pdf')).toHaveCount(0);

  await app.queueOpenFiles([path.join(sampleUpload, 'σημείωμα.pdf')]);
  await files.getByTestId('psk-files-upload').click();
  await window.getByTestId('file-choice-none').click();
  await expect(files.getByTestId('psk-invitation-file-σημείωμα.pdf')).toBeVisible({ timeout: 20000 });
  await expect(files.getByTestId('psk-file-row-σημείωμα.pdf')).toHaveCount(0);
});

test('P3-94 πράξη: νέα ομάδα, υπάρχουσα, υποομάδα και ακύρωση', async ({ app }) => {
  const { window, sampleUpload } = app;
  const files = await openSchoolsFiles(window);

  await app.queueOpenFiles([path.join(sampleUpload, 'σχέδιο.pdf')]);
  await actCard(files).getByRole('button', { name: 'Προσθήκη αρχείων' }).click();
  await window.getByTestId('file-choice-new').click();
  await window.getByTestId('file-new-title').fill('Φάκελος πράξης');
  await window.getByTestId('file-confirm-new').click();
  await expect(files.getByTestId('psk-invitation-file-σχέδιο.pdf')).toHaveCount(0);
  await files.getByRole('button', { name: /Φάκελος πράξης/ }).click();
  await expect(files.getByTestId('psk-file-row-σχέδιο.pdf')).toBeVisible();

  await app.queueOpenFiles([path.join(sampleUpload, 'παράρτημα.pdf')]);
  await actCard(files).getByRole('button', { name: 'Προσθήκη αρχείων' }).click();
  await window.getByTestId('file-choice-existing').click();
  await window.getByTestId('file-existing-select').selectOption({ label: 'Φάκελος πράξης' });
  await window.getByTestId('file-confirm-existing').click();
  await expect(files.getByTestId('psk-file-row-παράρτημα.pdf')).toBeVisible({ timeout: 20000 });
  await expect(files.getByTestId('psk-invitation-file-παράρτημα.pdf')).toHaveCount(0);

  await app.queueOpenFiles([path.join(sampleUpload, 'σημείωμα.pdf')]);
  await actCard(files).getByRole('button', { name: 'Προσθήκη αρχείων' }).click();
  await window.getByTestId('file-choice-subgroup').click();
  await window.getByTestId('file-subgroup-parent').selectOption({ label: 'Φάκελος πράξης' });
  await window.getByTestId('file-subgroup-title').fill('Υποφάκελος πράξης');
  await window.getByTestId('file-confirm-subgroup').click();
  await files.getByRole('button', { name: /Υποφάκελος πράξης/ }).click();
  await expect(files.getByTestId('psk-file-row-σημείωμα.pdf')).toBeVisible();
  await expect(files.getByTestId('psk-invitation-file-σημείωμα.pdf')).toHaveCount(0);

  await app.queueOpenFiles([path.join(sampleUpload, 'α.pdf')]);
  await actCard(files).getByRole('button', { name: 'Προσθήκη αρχείων' }).click();
  await window.getByTestId('file-choice-none').click();
  await expect(actCard(files).getByText('α.pdf', { exact: true })).toBeVisible({ timeout: 20000 });
  await expect(files.getByTestId('psk-invitation-file-α.pdf')).toHaveCount(0);

  const cancelFile = path.join(app.testDir, 'ακυρο-πραξη.pdf');
  fs.copyFileSync(path.join(sampleUpload, 'α.pdf'), cancelFile);
  await app.queueOpenFiles([cancelFile]);
  await actCard(files).getByRole('button', { name: 'Προσθήκη αρχείων' }).click();
  await window.getByTestId('file-choice-cancel').click();
  await expect(actCard(files).getByText('ακυρο-πραξη.pdf', { exact: true })).toHaveCount(0);
  await expect(actCard(files).getByText('α.pdf', { exact: true })).toHaveCount(1);

  await app.queueFolderPick({
    success: true,
    folderName: 'Φάκελος κάρτας',
    fileCount: 1,
    files: [{ filePath: path.join(sampleUpload, 'σχέδιο.pdf'), fileName: 'εξώφυλλο-πράξης.pdf' }],
  });
  await actCard(files).getByRole('button', { name: 'Προσθήκη φακέλου' }).click();
  await expect(window.getByText(/Προστέθηκε ο φάκελος «Φάκελος κάρτας»/)).toBeVisible({ timeout: 20000 });
  await actCard(files).getByRole('button', { name: /Φάκελος κάρτας/ }).click();
  await expect(actCard(files).getByText('εξώφυλλο-πράξης.pdf', { exact: true })).toBeVisible();
  await expect(files.getByTestId('psk-invitation-file-εξώφυλλο-πράξης.pdf')).toHaveCount(0);
});

test('P3-95 νέα πρόσκληση: οι τέσσερις επιλογές ομαδοποίησης πριν την αποθήκευση', async ({ app }) => {
  const { window, sampleUpload } = app;
  await expandCategory(window, 'Διαδικασίες Έργων');
  await window.locator('[data-user-guide="nav-proskliseis"]').click();
  await window.getByTestId('btn-new-prosklisi').click();
  const form = window.getByTestId('psk-form');
  const pick = form.getByRole('button', { name: /Επιλογή Αρχείων/ });

  await app.queueOpenFiles([path.join(sampleUpload, 'σχέδιο.pdf')]);
  await pick.click();
  await window.getByTestId('file-choice-cancel').click();
  await expect(form.getByText('σχέδιο.pdf')).toHaveCount(0);

  await app.queueOpenFiles([path.join(sampleUpload, 'σχέδιο.pdf')]);
  await pick.click();
  await window.getByTestId('file-choice-none').click();
  await expect(form.getByText('σχέδιο.pdf')).toBeVisible();
  await expect(form.getByText('Ομάδες Αρχείων:')).toHaveCount(0);

  await app.queueOpenFiles([path.join(sampleUpload, 'παράρτημα.pdf')]);
  await pick.click();
  await window.getByTestId('file-choice-new').click();
  await window.getByTestId('file-new-title').fill('Μελέτες');
  await window.getByTestId('file-confirm-new').click();
  await expect(form.getByText('Μελέτες')).toBeVisible();
  await expect(form.getByText('παράρτημα.pdf')).toBeVisible();

  await app.queueOpenFiles([path.join(sampleUpload, 'σημείωμα.pdf')]);
  await pick.click();
  await window.getByTestId('file-choice-existing').click();
  await window.getByTestId('file-existing-select').selectOption({ label: 'Μελέτες' });
  await window.getByTestId('file-confirm-existing').click();
  await expect(form.getByText('σημείωμα.pdf')).toBeVisible();

  await app.queueOpenFiles([path.join(sampleUpload, 'α.pdf')]);
  await pick.click();
  await window.getByTestId('file-choice-subgroup').click();
  await window.getByTestId('file-subgroup-parent').selectOption({ label: 'Μελέτες' });
  await window.getByTestId('file-subgroup-title').fill('Σχέδια');
  await window.getByTestId('file-confirm-subgroup').click();
  await expect(form.getByText('Σχέδια')).toBeVisible();
  await expect(form.getByText(/^📄 α\.pdf$/)).toBeVisible();
});

'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');

async function openEntaxeis(window) {
  await expandCategory(window, 'Διαδικασίες Έργων');
  await window.locator('[data-user-guide="nav-entaxis"]').click();
  await expect(window.getByTestId('entaxeis-window')).toBeVisible();
}

function entaxisWin(window) {
  return window.getByTestId('entaxeis-window');
}

test('P3-14 ομαδοποίηση εντάξεων ανά τίτλο έργου', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  const panel = entaxisWin(window);
  await expect(panel.getByText('Ανάπλαση γέφυρας').first()).toBeVisible();
  await expect(panel.getByText('Δεξαμενή Παρανύμφων').first()).toBeVisible();
  await expect(panel.getByText('Μεμονωμένη ένταξη')).toBeVisible();
});

test('P3-15 αναζήτηση μόνο στο τρέχον θέμα / έργο', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  const panel = entaxisWin(window);
  const search = panel.getByPlaceholder('Γρήγορη αναζήτηση τίτλου ένταξης...');
  await search.fill('γέφυρας');
  await expect(panel.getByText('Ανάπλαση γέφυρας').first()).toBeVisible();
  await expect(panel.getByText('Μεμονωμένη ένταξη')).toHaveCount(0);
});

test('P3-16 χωρίς έργο: κενός τίτλος ή χωρίς υποέργο', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  const panel = entaxisWin(window);
  await panel.getByRole('button', { name: 'Προηγμένα φίλτρα' }).click();
  await panel.getByText('Εμφάνιση μόνο εντάξεων χωρίς συσχέτιση με έργο').click();
  await expect(panel.getByText('Μεμονωμένη ένταξη')).toBeVisible();
  await expect(panel.getByText('Ανάπλαση γέφυρας')).toHaveCount(0);
});

test('P3-18 αναζήτηση με ΑΔΑ και ΟΠΣ', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  const panel = entaxisWin(window);
  const search = panel.getByPlaceholder('Γρήγορη αναζήτηση τίτλου ένταξης...');
  await search.fill('ΨΩΚΖ7ΛΚ-8ΦΤ');
  await expect(panel.getByText('Ανάπλαση γέφυρας').first()).toBeVisible();
  await expect(panel.getByText('Μεμονωμένη ένταξη')).toHaveCount(0);
  await search.fill('5225302');
  await expect(panel.getByText('Ανάπλαση γέφυρας').first()).toBeVisible();
});

test('P3-19 νέα ένταξη: ΑΔΑ και μήνυμα για λάθος μορφή', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  await window.getByTestId('btn-ent-new').click();
  await expect(window.getByTestId('ent-diavgeia-section')).toBeVisible();
  await window.getByTestId('ent-diavgeia-ada').fill('ΛΑΘΟΣΑΔΑ');
  await expect(window.getByTestId('ent-diavgeia-fetch')).toBeEnabled();
  await window.getByTestId('ent-diavgeia-fetch').click();
  await expect(window.getByTestId('ent-diavgeia-error')).toBeVisible();
  await expect(window.getByTestId('ent-diavgeia-fetch')).toBeEnabled();
});

test('P3-17 μηχανικός και απλός χρήστης δεν βλέπουν Νέα Ένταξη', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  await expect(window.getByRole('button', { name: 'Νέα Ένταξη' })).toBeVisible();
  await app.loginAsRole('ENGINEER');
  await openEntaxeis(window);
  await expect(window.getByRole('button', { name: 'Νέα Ένταξη' })).toHaveCount(0);
  await app.loginAsRole('USER');
  await openEntaxeis(window);
  await expect(window.getByRole('button', { name: 'Νέα Ένταξη' })).toHaveCount(0);
});

test('P3-20 κλικ στην κάρτα ανοίγει λεπτομέρειες με τροποποίηση', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  await window.getByTestId('ent-card-ent-road').click();
  const detail = window.getByTestId('ent-detail-modal');
  await expect(detail).toBeVisible();
  await expect(detail.getByTestId('ent-detail-subject')).toHaveText('Ανάπλαση γέφυρας');
  await expect(detail.getByTestId('ent-detail-ops')).toContainText('5225302');
  await expect(detail.getByTestId('ent-detail-ada')).toContainText('ΨΩΚΖ7ΛΚ-8ΦΤ');
  await expect(detail.getByTestId('ent-detail-mod-count')).toHaveText('1');
  await expect(detail.getByTestId('ent-detail-mod-1')).toContainText('Αύξηση προϋπολογισμού γέφυρας');
  await expect(detail.getByTestId('ent-detail-current-amount')).toContainText('120.000,00');
  await expect(detail.getByRole('button', { name: 'Επεξεργασία' })).toBeVisible();
  await detail.getByTestId('ent-detail-close').click();
  await expect(detail).toHaveCount(0);
});

test('P3-21 αναφορά ένταξης αποθηκεύει PDF', async ({ app }) => {
  const fs = require('fs');
  const path = require('path');
  const { window } = app;
  await openEntaxeis(window);
  await window.getByTestId('ent-card-ent-road').click();
  await expect(window.getByTestId('ent-detail-modal')).toBeVisible();
  await window.getByTestId('ent-detail-report').click();
  await expect(window.getByTestId('save-pdf-dialog')).toBeVisible({ timeout: 45000 });
  await app.queueFolderPick({ success: true, path: app.testDir });
  await window.getByTestId('save-pdf-browse').click();
  await expect(window.getByTestId('save-pdf-folder')).toHaveText(app.testDir);
  await window.getByTestId('save-pdf-confirm').click();
  await expect.poll(() => {
    const names = fs.existsSync(app.testDir) ? fs.readdirSync(app.testDir) : [];
    return names.some((n) => n.startsWith('ERGOHUB_Αναφορά_Ένταξης_') && n.endsWith('.pdf'));
  }, { timeout: 20000 }).toBe(true);
  const pdfName = fs.readdirSync(app.testDir).find((n) => n.startsWith('ERGOHUB_Αναφορά_Ένταξης_') && n.endsWith('.pdf'));
  expect(fs.statSync(path.join(app.testDir, pdfName)).size).toBeGreaterThan(1000);
});

test('P3-22 απλός χρήστης βλέπει λεπτομέρειες και αναφορά χωρίς επεξεργασία', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('USER');
  await openEntaxeis(window);
  await window.getByTestId('ent-card-ent-road').click();
  const detail = window.getByTestId('ent-detail-modal');
  await expect(detail).toBeVisible();
  await expect(detail.getByTestId('ent-detail-subject')).toHaveText('Ανάπλαση γέφυρας');
  await expect(detail.getByTestId('ent-detail-report')).toBeVisible();
  await expect(detail.getByRole('button', { name: 'Επεξεργασία' })).toHaveCount(0);
  await expect(detail.getByRole('button', { name: 'Νέα τροποποίηση' })).toHaveCount(0);
});

test('P3-23 κλείσιμο φορμών δεν αδειάζει τη λίστα εντάξεων', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  await window.getByTestId('ent-card-ent-road').click();
  const detail = window.getByTestId('ent-detail-modal');
  await expect(detail).toBeVisible();
  await detail.getByRole('button', { name: 'Επεξεργασία' }).click();
  await expect(window.getByRole('heading', { name: 'Επεξεργασία ένταξης' })).toBeVisible();
  await window.getByTestId('ent-form-close').click();
  await expect(window.getByRole('heading', { name: 'Επεξεργασία ένταξης' })).toHaveCount(0);
  await expect(window.getByText('Φόρτωση εντάξεων...')).toHaveCount(0);
  await expect(window.getByTestId('ent-card-ent-road')).toBeVisible();

  await window.getByTestId('btn-ent-new').click();
  await expect(window.getByRole('heading', { name: 'Νέα ένταξη έργου' })).toBeVisible();
  await window.getByTestId('ent-form-close').click();
  await expect(window.getByRole('heading', { name: 'Νέα ένταξη έργου' })).toHaveCount(0);
  await expect(window.getByText('Φόρτωση εντάξεων...')).toHaveCount(0);
  await expect(window.getByTestId('ent-card-ent-road')).toBeVisible();

  await window.getByTestId('ent-card-ent-road').click();
  await expect(window.getByTestId('ent-detail-modal')).toBeVisible();
  await window.getByTestId('ent-detail-modal').getByRole('button', { name: 'Νέα τροποποίηση' }).click();
  await expect(window.getByRole('heading', { name: 'Νέα τροποποίηση ένταξης' })).toBeVisible();
  await window.getByTestId('ent-mod-form-close').click();
  await expect(window.getByRole('heading', { name: 'Νέα τροποποίηση ένταξης' })).toHaveCount(0);
  await expect(window.getByText('Φόρτωση εντάξεων...')).toHaveCount(0);
  await expect(window.getByTestId('ent-card-ent-road')).toBeVisible();
});

test('P3-24 Enter στο πεδίο ΑΔΑ ξεκινά ανάκτηση σε ένταξη και τροποποίηση', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  await window.getByTestId('btn-ent-new').click();
  await expect(window.getByTestId('ent-diavgeia-section')).toBeVisible();
  await window.getByTestId('ent-diavgeia-ada').fill('ΛΑΘΟΣΑΔΑ');
  await window.getByTestId('ent-diavgeia-ada').press('Enter');
  await expect(window.getByTestId('ent-diavgeia-error')).toBeVisible();
  await expect(window.getByRole('heading', { name: 'Νέα ένταξη έργου' })).toBeVisible();
  await window.getByTestId('ent-form-close').click();

  await window.getByTestId('ent-card-ent-road').click();
  await expect(window.getByTestId('ent-detail-modal')).toBeVisible();
  await window.getByTestId('ent-detail-modal').getByRole('button', { name: 'Νέα τροποποίηση' }).click();
  await expect(window.getByRole('heading', { name: 'Νέα τροποποίηση ένταξης' })).toBeVisible();
  await window.getByTestId('ent-diavgeia-ada').fill('ΛΑΘΟΣΑΔΑ');
  await window.getByTestId('ent-diavgeia-ada').press('Enter');
  await expect(window.getByTestId('ent-diavgeia-error')).toBeVisible();
  await expect(window.getByRole('heading', { name: 'Νέα τροποποίηση ένταξης' })).toBeVisible();
});

test('P3-25 ένταξη συνδέεται με υποέργα από δύο έργα', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  await window.getByTestId('ent-card-ent-road').click();
  const detail = window.getByTestId('ent-detail-modal');
  await expect(detail).toBeVisible();
  await detail.getByRole('button', { name: 'Επεξεργασία' }).click();
  await expect(window.getByRole('heading', { name: 'Επεξεργασία ένταξης' })).toBeVisible();
  await window.getByTestId('ent-link-project-search').fill('Ύδρευση');
  await window.getByTestId('ent-link-option-proj-water').click();
  await expect(window.getByTestId('ent-linked-project-proj-water')).toBeVisible();
  await window.getByTestId('ent-sub-sub-tank').check();
  await expect(window.getByTestId('ent-sub-sub-bridge')).toBeChecked();
  await window.getByTestId('ent-form-save').click();
  await expect(window.getByRole('heading', { name: 'Επεξεργασία ένταξης' })).toHaveCount(0);
  await window.getByTestId('ent-card-ent-road').click();
  await expect(window.getByTestId('ent-detail-projects')).toContainText('Οδικό δίκτυο Αρχανών');
  await expect(window.getByTestId('ent-detail-projects')).toContainText('Ύδρευση Αστερουσίων');
  await expect(window.getByTestId('ent-detail-sub-count')).toHaveText('2');
});

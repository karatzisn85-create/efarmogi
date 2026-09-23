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
  await expect(detail.getByTestId('ent-detail-mod-1')).toContainText('1η');
  await expect(detail.getByTestId('ent-detail-mod-1')).toContainText('Νέο σύνολο');
  await expect(detail.getByTestId('ent-detail-current-amount')).toContainText('120.000,00');
  await expect(detail.getByRole('button', { name: 'Επεξεργασία' })).toBeVisible();
  await expect(detail.getByTestId('ent-detail-acceptance-search')).toBeVisible();
  await expect(detail.getByTestId('ent-detail-mod-acceptance-search-1')).toBeVisible();
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
  await expect(detail.getByTestId('ent-detail-acceptance-search')).toHaveCount(0);
  await expect(detail.getByTestId('ent-detail-mod-acceptance-search-1')).toHaveCount(0);
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

test('P3-26 ασυσχέτιστη ένταξη: έλεγχος αποδοχής Δ.Σ. και πρόταση δημιουργίας', async ({ app }) => {
  const { window } = app;
  await app.queueDiavgeiaAcceptance({
    decisions: [
      {
        ada: '624ΙΩΨΜ-Ζ12',
        subject: '230/2025 απόφαση Δημοτικού Συμβουλίου :Τροποποίηση προϋπολογισμού οικονομικού έτους 2025 για την εκτέλεση του χρηματοδοτούμενου έργου «Μεμονωμένη ένταξη» ΟΠΣ 5225999',
        issueDate: '2025-11-18',
        protocolNumber: '230/2025',
      },
    ],
  });
  await openEntaxeis(window);
  await window.getByTestId('ent-card-ent-free').click();
  const detail = window.getByTestId('ent-detail-modal');
  await expect(detail).toBeVisible();
  await expect(detail.getByTestId('ent-detail-acceptance-search')).toBeVisible();
  await detail.getByTestId('ent-detail-acceptance-search').click();
  const search = window.getByTestId('ent-acceptance-modal');
  await expect(search).toBeVisible();
  await expect(window.getByTestId('ent-card-ent-free')).toContainText('🔒');
  await expect(search.getByTestId('ent-acceptance-candidate-624ΙΩΨΜ-Ζ12')).toBeVisible();
  await search.getByTestId('ent-acceptance-candidate-624ΙΩΨΜ-Ζ12').click();
  await search.getByTestId('ent-acceptance-confirm').click();
  await expect(search.getByTestId('ent-acceptance-saved')).toBeVisible();
  await expect(search.getByTestId('ent-acceptance-create')).toBeVisible();
  await search.getByTestId('ent-acceptance-close').click();
  await expect(search).toHaveCount(0);
  await expect(window.getByTestId('ent-card-ent-free')).toContainText('🔓');
  await expect(detail.getByTestId('ent-detail-create-from-acceptance')).toBeVisible();
  await expect(detail.getByTestId('ent-detail-acceptance-search')).toBeVisible();
  await detail.getByTestId('ent-detail-create-from-acceptance').click();
  await expect(window.getByTestId('edit-panel')).toBeVisible();
  await expect(window.getByTestId('edit-project-title')).toHaveValue(/Μεμονωμένη ένταξη/i);
});

test('P3-27 συσχετισμένη ένταξη: έλεγχος αποδοχής χωρίς δημιουργία υποέργου', async ({ app }) => {
  const { window } = app;
  await app.queueDiavgeiaAcceptance({
    decisions: [
      {
        ada: '624ΙΩΨΜ-Ζ12',
        subject: '230/2025 απόφαση Δημοτικού Συμβουλίου :Τροποποίηση προϋπολογισμού οικονομικού έτους 2025 για την εκτέλεση του χρηματοδοτούμενου έργου «Ανάπλαση γέφυρας» ΟΠΣ 5225302',
        issueDate: '2025-01-10',
        protocolNumber: '12/2025',
      },
    ],
  });
  await openEntaxeis(window);
  await window.getByTestId('ent-card-ent-road').click();
  const detail = window.getByTestId('ent-detail-modal');
  await expect(detail.getByTestId('ent-detail-acceptance-search')).toBeVisible();
  await detail.getByTestId('ent-detail-acceptance-search').click();
  const search = window.getByTestId('ent-acceptance-modal');
  await expect(search).toBeVisible();
  await expect(search.getByTestId('ent-acceptance-candidate-624ΙΩΨΜ-Ζ12')).toBeVisible();
  await search.getByTestId('ent-acceptance-candidate-624ΙΩΨΜ-Ζ12').click();
  await search.getByTestId('ent-acceptance-confirm').click();
  await expect(search.getByTestId('ent-acceptance-saved')).toBeVisible();
  await expect(search.getByTestId('ent-acceptance-create')).toHaveCount(0);
  await search.getByTestId('ent-acceptance-close').click();
  await expect(detail.getByTestId('ent-detail-create-from-acceptance')).toHaveCount(0);
  await expect(detail.getByTestId('ent-detail-acceptance-search')).toBeVisible();
});

test('P3-28 αποδοχή χρηματοδότησης δέχεται επιπλέον αρχείο οποιασδήποτε μορφής', async ({ app }) => {
  const fs = require('fs');
  const path = require('path');
  const extra = path.join(app.testDir, 'σημείωμα-αλε.txt');
  fs.writeFileSync(extra, 'ΚΑ 64-6692.001');
  const { window } = app;
  await openEntaxeis(window);
  await window.getByTestId('ent-card-ent-road').click();
  await expect(window.getByTestId('ent-detail-modal')).toBeVisible();
  await window.getByTestId('ent-detail-files').click();
  const files = window.getByTestId('ent-files-modal');
  await expect(files).toBeVisible();
  await expect(window.getByTestId('ent-card-ent-road')).toContainText('🔒');
  await app.queueOpenFiles([extra]);
  await files.getByTestId('ent-files-approval-add').click();
  await expect(files.getByText('σημείωμα-αλε.txt')).toBeVisible();
  await files.getByTestId('ent-files-close').click();
  await expect(files).toHaveCount(0);
  await expect(window.getByTestId('ent-card-ent-road')).toContainText('🔓');
});

test('P3-29 έλεγχος αποδοχής: αποθήκευση Επιτροπής και Δ.Σ. μαζί', async ({ app }) => {
  const { window } = app;
  await app.queueDiavgeiaAcceptance({
    decisions: [
      {
        ada: '624ΙΩΨΜ-Ζ12',
        subject: '230/2025 απόφαση Δημοτικού Συμβουλίου :Τροποποίηση προϋπολογισμού οικονομικού έτους 2025 για την εκτέλεση του χρηματοδοτούμενου έργου «Μεμονωμένη ένταξη» ΟΠΣ 5225999',
        issueDate: '2025-11-18',
        protocolNumber: '230/2025',
      },
      {
        ada: '6ΞΧΜΩΨΜ-ΚΟΟ',
        subject: 'Απόφαση Δημοτικής Επιτροπής (360/2025): "Αποδοχή μεταβολής χρηματοδότησης υποέργων του έργου Μεμονωμένη ένταξη ΟΠΣ 5225999"',
        issueDate: '2025-11-18',
        protocolNumber: '360/2025',
      },
    ],
  });
  await openEntaxeis(window);
  await window.getByTestId('ent-card-ent-free').click();
  const detail = window.getByTestId('ent-detail-modal');
  await detail.getByTestId('ent-detail-acceptance-search').click();
  const search = window.getByTestId('ent-acceptance-modal');
  await expect(search.getByTestId('ent-acceptance-candidate-624ΙΩΨΜ-Ζ12')).toBeVisible();
  await expect(search.getByTestId('ent-acceptance-candidate-6ΞΧΜΩΨΜ-ΚΟΟ')).toBeVisible();
  await search.getByTestId('ent-acceptance-candidate-624ΙΩΨΜ-Ζ12').click();
  await search.getByTestId('ent-acceptance-candidate-6ΞΧΜΩΨΜ-ΚΟΟ').click();
  await expect(search.getByTestId('ent-acceptance-confirm')).toHaveText(/2 πράξεων/);
  await search.getByTestId('ent-acceptance-confirm').click();
  await expect(search.getByTestId('ent-acceptance-saved')).toContainText('2 αρχεία');
});

test('P3-30 διαγραφή αρχείων αποδοχής καθαρίζει την αποθηκευμένη αποδοχή', async ({ app }) => {
  const { window } = app;
  await app.queueDiavgeiaAcceptance({
    decisions: [
      {
        ada: '624ΙΩΨΜ-Ζ12',
        subject: '230/2025 απόφαση Δημοτικού Συμβουλίου :Τροποποίηση προϋπολογισμού οικονομικού έτους 2025 για την εκτέλεση του χρηματοδοτούμενου έργου «Μεμονωμένη ένταξη» ΟΠΣ 5225999',
        issueDate: '2025-11-18',
        protocolNumber: '230/2025',
      },
    ],
  });
  await openEntaxeis(window);
  await window.getByTestId('ent-card-ent-free').click();
  const detail = window.getByTestId('ent-detail-modal');
  await detail.getByTestId('ent-detail-acceptance-search').click();
  const search = window.getByTestId('ent-acceptance-modal');
  await search.getByTestId('ent-acceptance-candidate-624ΙΩΨΜ-Ζ12').click();
  await search.getByTestId('ent-acceptance-confirm').click();
  await expect(search.getByTestId('ent-acceptance-saved')).toBeVisible();
  await search.getByTestId('ent-acceptance-close').click();
  await expect(detail.getByTestId('ent-detail-create-from-acceptance')).toBeVisible();
  await detail.getByTestId('ent-detail-files').click();
  const files = window.getByTestId('ent-files-modal');
  await expect(files).toBeVisible();
  await files.getByTestId('file-delete-Αποδοχή Δ.Σ. — Διαύγεια 624ΙΩΨΜ-Ζ12.pdf').click();
  await window.getByTestId('confirm-yes').click();
  await expect(files.getByText('Αποδοχή Δ.Σ. — Διαύγεια 624ΙΩΨΜ-Ζ12.pdf')).toHaveCount(0);
  await files.getByTestId('ent-files-close').click();
  await expect(detail.getByTestId('ent-detail-create-from-acceptance')).toHaveCount(0);
  await expect(detail.getByTestId('ent-detail-acceptance-search')).toHaveText(/Έλεγχος αποδοχής/);
});

test('P3-31 τροποποίηση: έλεγχος αποδοχής Επιτροπής και Δ.Σ. στα αρχεία της τροποποίησης', async ({ app }) => {
  const { window } = app;
  await app.queueDiavgeiaAcceptance({
    decisions: [
      {
        ada: 'Ψ1ΘΟΩΨΜ-ΧΨΓ',
        subject: '195/2025 απόφαση Δημοτικού Συμβουλίου :Τροποποίηση προϋπολογισμού οικονομικού έτους 2025 για την εκτέλεση της πράξης «Ανάπλαση γέφυρας» ΟΠΣ 5225302',
        issueDate: '2025-03-10',
        protocolNumber: '195/2025',
      },
      {
        ada: 'ΨΓ25ΩΨΜ-ΘΓ4',
        subject: 'Απόφαση Δημοτικής Επιτροπής (299/2025): "Αποδοχή τροποποίησης πράξης: «Ανάπλαση γέφυρας» και εισήγηση για τροποποίηση προϋπολογισμού" ΟΠΣ 5225302',
        issueDate: '2025-03-04',
        protocolNumber: '299/2025',
      },
    ],
  });
  await openEntaxeis(window);
  await window.getByTestId('ent-card-ent-road').click();
  const detail = window.getByTestId('ent-detail-modal');
  await expect(detail.getByTestId('ent-detail-mod-acceptance-search-1')).toBeVisible();
  await detail.getByTestId('ent-detail-mod-acceptance-search-1').click();
  const search = window.getByTestId('ent-mod-acceptance-modal');
  await expect(search).toBeVisible();
  await expect(window.getByTestId('ent-card-ent-road')).toContainText('🔒');
  await expect(search.getByTestId('ent-mod-acceptance-candidate-Ψ1ΘΟΩΨΜ-ΧΨΓ')).toBeVisible();
  await expect(search.getByTestId('ent-mod-acceptance-candidate-ΨΓ25ΩΨΜ-ΘΓ4')).toBeVisible();
  await search.getByTestId('ent-mod-acceptance-candidate-Ψ1ΘΟΩΨΜ-ΧΨΓ').click();
  await search.getByTestId('ent-mod-acceptance-candidate-ΨΓ25ΩΨΜ-ΘΓ4').click();
  await expect(search.getByTestId('ent-mod-acceptance-confirm')).toHaveText(/2 πράξεων/);
  await search.getByTestId('ent-mod-acceptance-confirm').click();
  await expect(search.getByTestId('ent-mod-acceptance-saved')).toContainText('2 αρχεία');
  await expect(search.getByTestId('ent-acceptance-create')).toHaveCount(0);
  await search.getByTestId('ent-mod-acceptance-close').click();
  await expect(search).toHaveCount(0);
  await expect(window.getByTestId('ent-card-ent-road')).toContainText('🔓');
  await expect(detail.getByTestId('ent-detail-mod-1')).toContainText('Αποδοχή Δ.Σ. — Διαύγεια Ψ1ΘΟΩΨΜ-ΧΨΓ.pdf');
  await expect(detail.getByTestId('ent-detail-mod-1')).toContainText('Αποδοχή Επιτροπής — Διαύγεια ΨΓ25ΩΨΜ-ΘΓ4.pdf');
  await expect(detail.getByTestId('ent-detail-create-from-acceptance')).toHaveCount(0);
  await expect(detail.getByTestId('ent-detail-mod-acceptance-search-1')).toHaveText(/Νέος έλεγχος αποδοχής/);
});

test('P3-32 διαγραφή αποδοχής τροποποίησης καθαρίζει την αποθηκευμένη αποδοχή', async ({ app }) => {
  const { window } = app;
  await app.queueDiavgeiaAcceptance({
    decisions: [
      {
        ada: 'Ψ1ΘΟΩΨΜ-ΧΨΓ',
        subject: '195/2025 απόφαση Δημοτικού Συμβουλίου :Τροποποίηση προϋπολογισμού οικονομικού έτους 2025 για την υλοποίηση της πράξης «Ανάπλαση γέφυρας» ΟΠΣ 5225302',
        issueDate: '2025-03-10',
        protocolNumber: '195/2025',
      },
    ],
  });
  await openEntaxeis(window);
  await window.getByTestId('ent-card-ent-road').click();
  const detail = window.getByTestId('ent-detail-modal');
  await detail.getByTestId('ent-detail-mod-acceptance-search-1').click();
  const search = window.getByTestId('ent-mod-acceptance-modal');
  await search.getByTestId('ent-mod-acceptance-candidate-Ψ1ΘΟΩΨΜ-ΧΨΓ').click();
  await search.getByTestId('ent-mod-acceptance-confirm').click();
  await expect(search.getByTestId('ent-mod-acceptance-saved')).toBeVisible();
  await search.getByTestId('ent-mod-acceptance-close').click();
  await detail.getByTestId('ent-detail-close').click();
  const card = window.getByTestId('ent-card-ent-road');
  await card.getByRole('button', { name: /Προβολή τροποποιήσεων/ }).click();
  await expect(card.getByText('Αποδοχή Δ.Σ. — Διαύγεια Ψ1ΘΟΩΨΜ-ΧΨΓ.pdf')).toBeVisible();
  await card.getByTestId('mod-file-delete-Αποδοχή Δ.Σ. — Διαύγεια Ψ1ΘΟΩΨΜ-ΧΨΓ.pdf').click();
  await window.getByTestId('confirm-yes').click();
  await expect(card.getByText('Αποδοχή Δ.Σ. — Διαύγεια Ψ1ΘΟΩΨΜ-ΧΨΓ.pdf')).toHaveCount(0);
  await card.getByText('Ανάπλαση γέφυρας').first().click();
  await expect(detail.getByTestId('ent-detail-mod-acceptance-search-1')).toHaveText(/Έλεγχος αποδοχής τροποποίησης/);
});

test('P3-33 ένδειξη αποδοχής στην κάρτα και φίλτρα', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  await expect(window.getByTestId('ent-card-acceptance-ent-free')).toHaveText('Χωρίς αποδοχή');
  await expect(window.getByTestId('ent-card-acceptance-ent-road')).toHaveText('Χωρίς αποδοχή');
  await window.getByTestId('ent-filter-no-acceptance').click();
  await expect(window.getByTestId('ent-card-ent-free')).toBeVisible();
  await expect(window.getByTestId('ent-card-ent-road')).toBeVisible();
  await window.getByTestId('ent-filter-ready-project').click();
  await expect(window.getByTestId('ent-card-ent-road')).toHaveCount(0);
  await expect(window.getByTestId('ent-card-ent-water')).toHaveCount(0);
  await window.getByTestId('ent-filter-mod-no-acceptance').click();
  await expect(window.getByTestId('ent-card-ent-road')).toBeVisible();
  await expect(window.getByTestId('ent-card-ent-free')).toHaveCount(0);
});

test('P3-34 λεπτομέρειες ένταξης δείχνουν τίτλο υποέργου και ωρίμανση', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  await window.getByTestId('ent-card-ent-road').click();
  const detail = window.getByTestId('ent-detail-modal');
  await expect(detail.getByTestId('ent-detail-sub-titles')).toContainText('Γέφυρα Αγίου Σύλλα');
  await expect(detail.getByTestId('ent-detail-sub-sub-bridge')).toContainText('Γέφυρα Αγίου Σύλλα');
  await expect(detail.getByTestId('ent-detail-orimanthi')).toContainText('Ανακατασκευή οδού Αρχανών');
});

test('P3-35 από ένταξη η ωρίμανση και το υποέργο επιστρέφουν στις λεπτομέρειες', async ({ app }) => {
  const { window } = app;
  await openEntaxeis(window);
  await window.getByTestId('ent-card-ent-road').click();
  const detail = window.getByTestId('ent-detail-modal');
  await expect(detail).toBeVisible();
  await detail.getByTestId('ent-detail-orimanthi-a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d').click();
  await expect(window.getByTestId('orimanthi-window')).toBeVisible({ timeout: 15000 });
  await window.getByTestId('orimanthi-back').click();
  await expect(window.getByTestId('orimanthi-window')).toHaveCount(0);
  await expect(window.getByTestId('ent-detail-modal')).toBeVisible({ timeout: 15000 });
  await expect(window.getByTestId('ent-detail-subject')).toContainText('Ανάπλαση γέφυρας');
  await window.getByTestId('ent-detail-sub-sub-bridge').click();
  await expect(window.getByTestId('sub-detail-close')).toBeVisible({ timeout: 15000 });
  await window.getByTestId('sub-detail-close').click();
  await expect(window.getByTestId('ent-detail-modal')).toBeVisible({ timeout: 15000 });
  await expect(window.getByTestId('ent-detail-subject')).toContainText('Ανάπλαση γέφυρας');
});

test('P3-36 μετονομασία αποδοχής από Διαύγεια δεν χάνει το αρχείο', async ({ app }) => {
  const fs = require('fs');
  const path = require('path');
  const { window, testDir } = app;
  const filesDir = path.join(testDir, 'entaxeis', 'ent-free', 'ΑΡΧΕΙΑ_ΕΝΤΑΞΗΣ');
  const dataPath = path.join(testDir, 'entaxeis', 'ent-free', 'data.json');
  fs.mkdirSync(filesDir, { recursive: true });
  fs.writeFileSync(path.join(filesDir, 'απόφαση-ένταξης.pdf'), '%PDF-1.1\n');
  const before = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  before.entaxiPDFs = ['απόφαση-ένταξης.pdf'];
  fs.writeFileSync(dataPath, JSON.stringify(before));

  await app.queueDiavgeiaAcceptance({
    decisions: [
      {
        ada: '624ΙΩΨΜ-Ζ12',
        subject: '230/2025 απόφαση Δημοτικού Συμβουλίου :Τροποποίηση προϋπολογισμού οικονομικού έτους 2025 για την εκτέλεση του χρηματοδοτούμενου έργου «Μεμονωμένη ένταξη» ΟΠΣ 5225999',
        issueDate: '2025-11-18',
        protocolNumber: '230/2025',
      },
    ],
  });
  await openEntaxeis(window);
  await window.getByTestId('ent-card-ent-free').click();
  const detail = window.getByTestId('ent-detail-modal');
  await detail.getByTestId('ent-detail-acceptance-search').click();
  const search = window.getByTestId('ent-acceptance-modal');
  await search.getByTestId('ent-acceptance-candidate-624ΙΩΨΜ-Ζ12').click();
  await search.getByTestId('ent-acceptance-confirm').click();
  await expect(search.getByTestId('ent-acceptance-saved')).toBeVisible();
  await search.getByTestId('ent-acceptance-close').click();
  await detail.getByTestId('ent-detail-files').click();
  const files = window.getByTestId('ent-files-modal');
  const oldName = 'Αποδοχή Δ.Σ. — Διαύγεια 624ΙΩΨΜ-Ζ12.pdf';
  await expect(files.getByTestId('ent-files-approval').getByText(oldName)).toBeVisible();
  await expect(files.getByTestId('ent-files-decisions').getByText('απόφαση-ένταξης.pdf')).toBeVisible();
  await files.getByTestId(`file-rename-${oldName}`).click();
  await expect(window.getByTestId('file-rename-modal')).toBeVisible();
  await window.getByTestId('file-rename-input').fill('Αποδοχή ανανεωμένη');
  await window.getByTestId('file-rename-save').click();
  const newName = 'Αποδοχή ανανεωμένη.pdf';
  await expect(files.getByTestId('ent-files-approval').getByText(newName)).toBeVisible();
  await expect(files.getByTestId('ent-files-decisions').getByText(newName)).toHaveCount(0);
  await expect(files.getByText(oldName)).toHaveCount(0);
  const saved = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  expect(saved.approvalPDFs).toContain(newName);
  expect(saved.diavgeiaAcceptanceMeta.pdfFileName).toBe(newName);
  expect(saved.diavgeiaAcceptanceAda).toBe('624ΙΩΨΜ-Ζ12');
  expect(saved.entaxiPDFs).toContain('απόφαση-ένταξης.pdf');
});

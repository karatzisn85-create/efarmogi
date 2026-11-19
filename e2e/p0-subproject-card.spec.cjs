'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const {
  card,
  enterEdit,
  setPrimaryCharge,
  setOutsideCharge,
  saveEdit,
  discardEdit,
  search,
  readPersisted,
} = require('./helpers/actions.cjs');

test('P0-01 αλλαγή χρέωσης από κατάλογο — η κάρτα δείχνει τον νέο, τα ids μένουν ίδια', async ({ app }) => {
  const { window, testDir } = app;
  await expect(card(window, 'sub-bridge').locator('[data-field="charge"]')).toHaveText('Μαρία Παπαδοπούλου');
  await enterEdit(window, 'sub-bridge');
  const projectId = await window.locator('[data-testid="edit-project-id"]').innerText();
  const subprojectId = await window.locator('[data-testid="edit-subproject-id"]').innerText();
  await setPrimaryCharge(window, 'user:nikos');
  await saveEdit(window);
  await expect(card(window, 'sub-bridge').locator('[data-field="charge"]')).toHaveText('Νίκος Γεωργίου');
  const saved = readPersisted(testDir, projectId, subprojectId);
  expect(saved.projectId).toBe(projectId);
  expect(saved.subprojectId).toBe(subprojectId);
  expect(saved.supervisorEngineerIds).toEqual(['user:nikos']);
  expect(saved.supervisor).toBeUndefined();
});

test('P0-02 χρέωση εκτός καταλόγου — η κάρτα δείχνει το ελεύθερο κείμενο', async ({ app }) => {
  const { window, testDir } = app;
  await enterEdit(window, 'sub-bridge');
  await setOutsideCharge(window, 'Διεύθυνση Τεχνικών Υπηρεσιών');
  await saveEdit(window);
  await expect(card(window, 'sub-bridge').locator('[data-field="charge"]')).toHaveText('Διεύθυνση Τεχνικών Υπηρεσιών');
  const saved = readPersisted(testDir, 'proj-road', 'sub-bridge');
  expect(saved.supervisorEngineerIds).toEqual([]);
  expect(saved.supervisorChargeOutsideEngineers).toBe(true);
  expect(saved.supervisorChargeFreePrimary).toBe('Διεύθυνση Τεχνικών Υπηρεσιών');
});

test('P0-03 απόρριψη μη αποθηκευμένης αλλαγής χρέωσης — μένει η παλιά', async ({ app }) => {
  const { window } = app;
  await enterEdit(window, 'sub-bridge');
  await setPrimaryCharge(window, 'user:elena');
  await discardEdit(window);
  await expect(card(window, 'sub-bridge').locator('[data-field="charge"]')).toHaveText('Μαρία Παπαδοπούλου');
});

test('P0-04 αλλαγή τίτλου και ΚΑ — τα ids ίδια, αναζήτηση μόνο με τα νέα στοιχεία', async ({ app }) => {
  const { window, testDir } = app;
  await enterEdit(window, 'sub-bridge');
  const projectId = await window.locator('[data-testid="edit-project-id"]').innerText();
  const subprojectId = await window.locator('[data-testid="edit-subproject-id"]').innerText();
  await window.getByTestId('edit-project-title').fill('Νέο οδικό δίκτυο');
  await window.getByTestId('edit-ka').fill('10-0999.100');
  await saveEdit(window);
  const saved = readPersisted(testDir, projectId, subprojectId);
  expect(saved.projectId).toBe(projectId);
  expect(saved.subprojectId).toBe(subprojectId);
  expect(saved.projectTitle).toBe('Νέο οδικό δίκτυο');
  expect(saved.kaCode).toBe('10-0999.100');
  await search(window, 'Νέο οδικό');
  await expect(card(window, 'sub-bridge')).toBeVisible();
  await search(window, 'Οδικό δίκτυο Αρχανών');
  await expect(card(window, 'sub-bridge')).toHaveCount(0);
});

test('P0-05 παλιά εγγραφή μόνο με επιβλέποντα — η κάρτα τον δείχνει και η αποθήκευση δεν χάνει το όνομα', async ({ app }) => {
  const { window, testDir } = app;
  await expect(card(window, 'sub-legacy').locator('[data-field="charge"]')).toHaveText('Παλιός Επιβλέπων');
  await enterEdit(window, 'sub-legacy');
  await saveEdit(window);
  await expect(card(window, 'sub-legacy').locator('[data-field="charge"]')).toHaveText('Παλιός Επιβλέπων');
  const saved = readPersisted(testDir, 'proj-old', 'sub-legacy');
  expect(saved.supervisor).toBeUndefined();
  expect(saved.supervisorChargeFreePrimary).toBe('Παλιός Επιβλέπων');
  expect(saved.supervisorChargeOutsideEngineers).toBe(true);
});

test('P0-06 μηχανικός βλέπει μόνο τα υποέργα που του είναι χρεωμένα', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('ENGINEER');
  await expect(card(window, 'sub-bridge')).toBeVisible();
  await expect(card(window, 'sub-lights')).toBeVisible();
  await expect(card(window, 'sub-tank')).toHaveCount(0);
  await expect(card(window, 'sub-legacy')).toHaveCount(0);
});

test('P0-08 σημείωση ανοίγει μη χρεωμένο υποέργο μόνο για ανάγνωση', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('ENGINEER');
  await expect(card(window, 'sub-tank')).toHaveCount(0);
  await window.getByTestId('btn-notes').click({ force: true });
  await window.getByTestId('note-item-note-share-tank').click();
  await window.getByTestId('note-linked-subproject-sub-tank').click();
  await expect(window.getByTestId('read-panel')).toBeVisible({ timeout: 15000 });
  await expect(window.getByTestId('read-subproject-title')).toHaveText('Δεξαμενή Παρανύμφων');
  await expect(window.getByTestId('btn-edit')).toHaveCount(0);
  await expect(window.getByTestId('shared-readonly-banner')).toBeVisible();
  await window.locator('[data-testid="read-panel"] button[aria-label="Κλείσιμο"]').click();
  await expect(card(window, 'sub-tank')).toHaveCount(0);
  await expect(card(window, 'sub-bridge')).toBeVisible();
});

test('P0-09 μηχανικός καρφιτσώνει μόνο χρεωμένα έργα/υποέργα· ένταξη όλες', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('ENGINEER');
  await window.getByTestId('btn-notes').click({ force: true });
  await window.getByTestId('btn-new-note').click();
  const search = window.getByTestId('note-link-search');
  await search.fill('Παρανύμφων');
  await expect(window.getByTestId('note-link-result-entaxi-ent-water')).toBeVisible({ timeout: 15000 });
  await expect(window.getByTestId('note-link-result-subproject-sub-tank')).toHaveCount(0);
  await search.fill('Γέφυρα');
  await expect(window.getByTestId('note-link-result-subproject-sub-bridge')).toBeVisible();
  await search.fill('Αστερουσίων');
  await expect(window.getByTestId('note-link-result-project-proj-water')).toHaveCount(0);
});

test('P0-07 δεύτερη αλλαγή χρέωσης — φαίνεται ο τελευταίος, τα ids ίδια', async ({ app }) => {
  const { window, testDir } = app;
  await enterEdit(window, 'sub-bridge');
  const projectId = await window.locator('[data-testid="edit-project-id"]').innerText();
  await setPrimaryCharge(window, 'user:nikos');
  await saveEdit(window);
  await enterEdit(window, 'sub-bridge');
  await setPrimaryCharge(window, 'user:elena');
  await saveEdit(window);
  await expect(card(window, 'sub-bridge').locator('[data-field="charge"]')).toHaveText('Ελένη Αντωνίου');
  const saved = readPersisted(testDir, projectId, 'sub-bridge');
  expect(saved.projectId).toBe(projectId);
  expect(saved.subprojectId).toBe('sub-bridge');
  expect(saved.supervisorEngineerIds).toEqual(['user:elena']);
});

test('P0-10 αναφορά υποέργου — επιλογή πλήρους ή συνοπτικής και αποθήκευση συνοπτικής', async ({ app }) => {
  const fs = require('fs');
  const path = require('path');
  const { window } = app;
  const reportButton = () => card(window, 'sub-bridge').getByRole('button', { name: 'Λήψη αναφοράς υποέργου' });
  const openReport = () => reportButton().click({ force: true });

  await openReport();
  const modal = window.getByTestId('subproject-report-choice');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Πλήρης αναφορά');
  await expect(modal).toContainText('Συνοπτική αναφορά');
  await window.getByTestId('subproject-report-cancel').click();
  await expect(modal).toHaveCount(0);

  await openReport();
  await expect(modal).toBeVisible();
  await window.getByTestId('subproject-report-option-summary').click();
  await window.getByTestId('subproject-report-export').click();
  await expect(window.getByTestId('save-pdf-dialog')).toBeVisible({ timeout: 45000 });
  await app.queueFolderPick({ success: true, path: app.testDir });
  await window.getByTestId('save-pdf-browse').click();
  await expect(window.getByTestId('save-pdf-folder')).toHaveText(app.testDir);
  await window.getByTestId('save-pdf-confirm').click();
  await expect.poll(() => {
    const names = fs.existsSync(app.testDir) ? fs.readdirSync(app.testDir) : [];
    return names.some((n) => n.startsWith('ERGOHUB_Συνοπτική_') && n.endsWith('.pdf'));
  }, { timeout: 20000 }).toBe(true);
  const pdfName = fs.readdirSync(app.testDir).find((n) => n.startsWith('ERGOHUB_Συνοπτική_') && n.endsWith('.pdf'));
  expect(fs.statSync(path.join(app.testDir, pdfName)).size).toBeGreaterThan(1000);
  await expect(modal).toHaveCount(0);
});

test('P0-12 φάκελος υποέργου — κανονικός φάκελος με αναφορά, αρχεία, ένταξη και πρόσκληση', async ({ app }) => {
  test.setTimeout(180000);
  const fs = require('fs');
  const path = require('path');
  const { window } = app;
  const destParent = path.join(path.dirname(app.testDir), `folder-export-${Date.now()}`);
  fs.mkdirSync(destParent, { recursive: true });
  const looseDir = path.join(app.testDir, 'proj-road', 'sub-bridge', 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ');
  fs.mkdirSync(looseDir, { recursive: true });
  fs.writeFileSync(path.join(looseDir, 'εκτος-καταλογου.pdf'), 'loose e2e');
  const reportButton = () => card(window, 'sub-bridge').getByRole('button', { name: 'Λήψη αναφοράς υποέργου' });

  await reportButton().click({ force: true });
  const modal = window.getByTestId('subproject-report-choice');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Φάκελος υποέργου');
  await window.getByTestId('subproject-report-option-folder').click();
  await expect(window.getByTestId('subproject-report-export')).toHaveText('Εξαγωγή φακέλου');
  await window.getByTestId('subproject-report-export').click();
  await expect(window.getByTestId('save-pdf-dialog')).toBeVisible({ timeout: 20000 });
  await expect(window.getByTestId('save-pdf-dialog')).toContainText('Όνομα φακέλου');
  await app.queueFolderPick({ success: true, path: destParent });
  await window.getByTestId('save-pdf-browse').click();
  await expect(window.getByTestId('save-pdf-folder')).toHaveText(destParent);
  await window.getByTestId('save-pdf-confirm').click();

  const dest = path.join(destParent, 'Γέφυρα Αγίου Σύλλα');
  await expect.poll(
    () => fs.existsSync(path.join(dest, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ', 'Σύμβαση', 'σύμβαση.pdf')),
    { timeout: 150000 }
  ).toBe(true);

  expect(fs.statSync(dest).isDirectory()).toBe(true);
  expect(fs.readdirSync(destParent).some((name) => name.toLowerCase().endsWith('.zip'))).toBe(false);
  expect(fs.readFileSync(path.join(dest, 'ΑΝΑΦΟΡΑ ΥΠΟΕΡΓΟΥ.pdf')).subarray(0, 4).toString()).toBe('%PDF');
  expect(fs.readFileSync(path.join(dest, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ', 'Σύμβαση', 'σύμβαση.pdf'), 'utf8')).toContain('e2e contract');
  expect(fs.readFileSync(path.join(dest, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ', 'εκτος-καταλογου.pdf'), 'utf8')).toContain('loose e2e');
  expect(fs.existsSync(path.join(dest, 'ΕΝΤΑΞΗ', 'ΕΝΤΑΞΗ.pdf'))).toBe(true);
  expect(fs.existsSync(path.join(dest, 'ΕΝΤΑΞΗ', 'ΤΡΟΠΟΠΟΙΗΣΗ 1 ΕΝΤΑΞΗΣ.pdf'))).toBe(true);
  const inviteDirs = fs.readdirSync(dest).filter((name) => name.startsWith('ΠΡΟΣΚΛΗΣΗ'));
  const schools = inviteDirs
    .map((name) => path.join(dest, name))
    .find((dir) => fs.existsSync(path.join(dir, 'πρόσκληση-όροι.pdf')));
  expect(schools).toBeTruthy();
  expect(fs.existsSync(path.join(schools, 'Δικαιολογητικά', 'βεβαίωση.pdf'))).toBe(true);
  expect(fs.existsSync(path.join(schools, `${path.basename(schools)}.pdf`))).toBe(true);
  const withMod = inviteDirs
    .map((name) => path.join(dest, name))
    .find((dir) => fs.existsSync(path.join(dir, 'ΤΡΟΠΟΠΟΙΗΣΗ 1 ΠΡΟΣΚΛΗΣΗΣ.pdf')));
  expect(withMod).toBeTruthy();
  expect(fs.readFileSync(path.join(app.testDir, 'proj-road', 'sub-bridge', 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ', 'σύμβαση.pdf'), 'utf8')).toContain('e2e contract');
  await expect(modal).toHaveCount(0);
  fs.rmSync(destParent, { recursive: true, force: true });
});

test('P0-11 η ένταξη από την κάρτα ανοίγει σε ψηλό παράθυρο', async ({ app }) => {
  const { window } = app;
  await card(window, 'sub-bridge').getByTestId('btn-entaxi-sub-bridge').click();
  const detail = window.getByTestId('ent-detail-modal');
  await expect(detail).toBeVisible({ timeout: 15000 });
  const dialog = detail.getByRole('dialog');
  await expect.poll(async () => dialog.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(520);
});

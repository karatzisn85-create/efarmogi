'use strict';

const fs = require('fs');
const path = require('path');
const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function openApologismos(window) {
  await expandCategory(window, 'Εργαλεία');
  await window.getByRole('button', { name: /Απολογισμού Δημοτικής Περιόδου/ }).click();
  await expect(window.getByText(/Απολογισμός/i).first()).toBeVisible();
}

function pickerBox(window) {
  return window.getByText('Επιλογή ολοκληρωμένου / αποπληρωμένου υποέργου').locator('xpath=..');
}

async function addHall(window) {
  await window.getByRole('button', { name: '+ Από ολοκληρωμένα' }).click();
  await expect(window.getByText('Επιλογή ολοκληρωμένου / αποπληρωμένου υποέργου')).toBeVisible();
  await pickerBox(window).getByText('Αίθουσα εκδηλώσεων').click();
  await expect(window.getByText('Εκκρεμές')).toBeVisible({ timeout: 15000 });
}

async function editHall(window) {
  await window.getByText('Αίθουσα εκδηλώσεων').first().click();
  await window.getByRole('button', { name: 'Επεξεργασία στοιχείων' }).click();
  await expect(window.getByText('Επεξεργασία κάρτας')).toBeVisible();
}

async function chooseByField(window, fieldName, optionText) {
  const select = window.getByText(fieldName, { exact: true }).first()
    .locator('xpath=ancestor::*[.//select][1]//select')
    .first();
  await select.selectOption({ label: optionText });
}

async function fillReadyCard(window, vizLabel) {
  await editHall(window);
  await chooseByField(window, 'Κατηγορία απολογισμού', 'Κτιριακά, σχολεία & αθλητισμός');
  await chooseByField(window, 'Κύριος τρόπος', vizLabel);
  const narrative = window.locator('textarea').last();
  await narrative.fill('Η αίθουσα παραδόθηκε και χρησιμοποιείται από τον σύλλογο.');
  await window.getByRole('button', { name: 'Αποθήκευση κάρτας' }).click();
  await expect(window.getByText('Η κάρτα αποθηκεύτηκε')).toBeVisible({ timeout: 20000 });
}

test('P11-16 φωτογραφία απολογισμού περνάει από το παράθυρο αρχείων και αποθηκεύεται', async ({ app }) => {
  const { window, testDir } = app;
  const photo = path.join(testDir, 'dokimi-foto.png');
  fs.writeFileSync(photo, TINY_PNG);
  await openApologismos(window);
  await addHall(window);
  await editHall(window);
  await chooseByField(window, 'Κατηγορία απολογισμού', 'Κτιριακά, σχολεία & αθλητισμός');
  await chooseByField(window, 'Κύριος τρόπος', 'Φωτογραφίες «Μετά»');
  await window.locator('textarea').last().fill('Φωτογραφία μετά την παράδοση της αίθουσας.');
  await app.queueOpenFiles([photo]);
  await window.getByRole('button', { name: 'Προσθήκη φωτογραφιών' }).click();
  await expect(window.getByText(/φωτογραφίες προστέθηκαν/i)).toBeVisible({ timeout: 30000 });
  const log = await window.evaluate(async () => window.electronAPI.invoke('e2e-dialog-log'));
  expect(log.success).toBe(true);
  expect((log.calls || []).some((row) => row.kind === 'open' && /φωτογραφιών απολογισμού/.test(row.title || ''))).toBe(true);
});

test('P11-17 ο χάρτης δεν αποθηκεύεται κενός', async ({ app }) => {
  const { window } = app;
  await openApologismos(window);
  await addHall(window);
  await editHall(window);
  await chooseByField(window, 'Κατηγορία απολογισμού', 'Κτιριακά, σχολεία & αθλητισμός');
  await chooseByField(window, 'Κύριος τρόπος', 'Χάρτης σημείου / διαδρομής');
  await window.locator('textarea').last().fill('Η αίθουσα σημειώνεται στον χάρτη της περιοχής.');
  const openMap = window.getByRole('button', { name: 'Άνοιγμα επεξεργαστή χάρτη' });
  await expect(openMap).toBeVisible({ timeout: 15000 });
  await openMap.click();
  await expect(window.getByText('Χάρτης έργου')).toBeVisible({ timeout: 20000 });
  await expect(window.getByRole('button', { name: 'Αποθήκευση χάρτη' })).toBeDisabled();
});

test('P11-18 η εξαγωγή εγγράφου απολογισμού γράφει αρχείο PDF', async ({ app }) => {
  const { window, testDir } = app;
  await openApologismos(window);
  await addHall(window);
  await fillReadyCard(window, 'Μόνο κείμενο');
  await window.getByRole('button', { name: 'Εξαγωγή εγγράφου' }).click();
  await expect(window.getByTestId('save-pdf-dialog')).toBeVisible({ timeout: 60000 });
  await app.queueFolderPick({ success: true, path: testDir });
  await window.getByTestId('save-pdf-browse').click();
  await expect(window.getByTestId('save-pdf-folder')).toHaveText(testDir);
  await window.getByTestId('save-pdf-confirm').click();
  await expect.poll(() => {
    const names = fs.existsSync(testDir) ? fs.readdirSync(testDir) : [];
    return names.some((name) => name.startsWith('Απολογισμός_') && name.endsWith('.pdf'));
  }, { timeout: 40000 }).toBe(true);
  const pdfName = fs.readdirSync(testDir).find((name) => name.startsWith('Απολογισμός_') && name.endsWith('.pdf'));
  expect(fs.statSync(path.join(testDir, pdfName)).size).toBeGreaterThan(1000);
});

test('P11-19 η εξαγωγή διαφανειών γράφει αρχείο παρουσίασης', async ({ app }) => {
  const { window, testDir } = app;
  const dest = path.join(testDir, 'apologismos-dokimi.pptx');
  await openApologismos(window);
  await addHall(window);
  await fillReadyCard(window, 'Μόνο κείμενο');
  await app.queueSavePath(dest);
  await window.getByRole('button', { name: 'Εξαγωγή διαφανειών' }).click();
  await expect.poll(() => fs.existsSync(dest) && fs.statSync(dest).size > 1000, { timeout: 40000 }).toBe(true);
});

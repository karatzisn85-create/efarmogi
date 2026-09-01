'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');

async function openProskliseis(window) {
  await expandCategory(window, 'Διαδικασίες Έργων');
  await window.locator('[data-user-guide="nav-proskliseis"]').click();
  await expect(window.getByText('Διαχείριση Προσκλήσεων').first()).toBeVisible();
}

test('P3-07 ενεργές: ανοιχτές με ισχύουσα λήξη, όχι ληγμένες ή υποβληθείσες', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await expect(window.getByTestId('psk-card-psk-schools')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-far')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-modded')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-expired')).toHaveCount(0);
  await expect(window.getByTestId('psk-card-psk-submitted')).toHaveCount(0);
});

test('P3-08 καρτέλες ληγμένων και υποβληθεισών', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await window.getByRole('tab', { name: /Ληγμένες/ }).click();
  await expect(window.getByTestId('psk-card-psk-expired')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-schools')).toHaveCount(0);
  await window.getByRole('tab', { name: /Υποβληθείσες/ }).click();
  await expect(window.getByTestId('psk-card-psk-submitted')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-expired')).toHaveCount(0);
});

test('P3-09 λήγουν σύντομα κρύβει τη μακρινή', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await window.getByRole('button', { name: 'Λήγουν σύντομα' }).click();
  await expect(window.getByTestId('psk-card-psk-schools')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-modded')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-far')).toHaveCount(0);
});

test('P3-10 χωρίς έργο δείχνει μόνο όσες δεν έχουν σύνδεση', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await window.getByRole('button', { name: 'Χωρίς έργο' }).click();
  await expect(window.getByTestId('psk-card-psk-far')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-schools')).toHaveCount(0);
});

test('P3-11 αναζήτηση μόνο με τρέχοντα κωδικό / τίτλο', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await window.getByPlaceholder(/Αναζήτηση/).fill('PSK-100');
  await expect(window.getByTestId('psk-card-psk-schools')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-far')).toHaveCount(0);
  await window.getByPlaceholder(/Αναζήτηση/).fill('μακρινή');
  await expect(window.getByTestId('psk-card-psk-far')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-schools')).toHaveCount(0);
});

test('P3-12 τροποποίηση λήξης: μετράει η νέα ημερομηνία, όχι η παλιά', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await expect(window.getByTestId('psk-card-psk-modded')).toBeVisible();
  await window.getByRole('tab', { name: /Ληγμένες/ }).click();
  await expect(window.getByTestId('psk-card-psk-modded')).toHaveCount(0);
});

test('P3-13 μηχανικός και απλός χρήστης δεν βλέπουν Νέα Πρόσκληση', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await expect(window.getByTestId('btn-new-prosklisi')).toBeVisible();
  await app.loginAsRole('ENGINEER');
  await openProskliseis(window);
  await expect(window.getByTestId('btn-new-prosklisi')).toHaveCount(0);
  await app.loginAsRole('USER');
  await openProskliseis(window);
  await expect(window.getByTestId('btn-new-prosklisi')).toHaveCount(0);
});

test('P3-14 η καρτέλα Ενεργές μετράει όσες φαίνονται, όχι τις άλλες καρτέλες', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await expect(window.getByTestId('psk-stat-total')).toHaveText('5');
  await expect(window.getByTestId('psk-stat-visible')).toHaveText('3');
  await expect(window.getByTestId('psk-stat-filtered-all')).toHaveCount(0);
  await expect(window.getByTestId('psk-card-psk-schools')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-far')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-modded')).toBeVisible();
});

test('P3-15 εξαγωγή προεπιλογή: όσες βλέπω στις Ενεργές, όχι τις ληγμένες', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await window.getByTestId('btn-export-proskliseis').click();
  await expect(window.getByTestId('psk-export-count')).toHaveText('3');
  await window.getByTestId('psk-export-scope-all').click();
  await expect(window.getByTestId('psk-export-count')).toHaveText('5');
  await window.getByRole('button', { name: 'Ακύρωση' }).click();
});

test('P3-16 λήγουν σύντομα: μόνο ανοιχτές εντός 30 ημερών, όχι ήδη ληγμένες', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await window.getByRole('button', { name: 'Λήγουν σύντομα' }).click();
  await expect(window.getByTestId('psk-stat-visible')).toHaveText('2');
  await expect(window.getByTestId('psk-stat-filtered-all')).toHaveCount(0);
  await expect(window.getByTestId('psk-filter-chip-expiringSoon')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-schools')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-modded')).toBeVisible();
  await window.getByRole('tab', { name: /Ληγμένες/ }).click();
  await expect(window.getByTestId('psk-card-psk-expired')).toHaveCount(0);
  await window.getByRole('tab', { name: /Ενεργές/ }).click();
  await window.getByTestId('btn-export-proskliseis').click();
  await expect(window.getByTestId('psk-export-count')).toHaveText('2');
  await window.getByTestId('psk-export-scope-all').click();
  await expect(window.getByTestId('psk-export-count')).toHaveText('2');
  await window.getByRole('button', { name: 'Ακύρωση' }).click();
});

test('P3-17 ετικέτα φίλτρου αφαιρεί μόνο εκείνο το φίλτρο', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await window.getByRole('button', { name: 'Λήγουν σύντομα' }).click();
  await expect(window.getByTestId('psk-card-psk-far')).toHaveCount(0);
  await window.getByTestId('psk-filter-chip-expiringSoon').click();
  await expect(window.getByTestId('psk-filter-chip-expiringSoon')).toHaveCount(0);
  await expect(window.getByTestId('psk-card-psk-far')).toBeVisible();
});

test('P3-18 προηγμένα: λίστα άξονα, χωρίς δεύτερη κατάσταση, φιλτράρει σωστά', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await window.getByRole('button', { name: 'Προηγμένα φίλτρα' }).click();
  await expect(window.getByTestId('psk-advanced-filters')).toBeVisible();
  await expect(window.getByText('Κατάσταση (επιπλέον φίλτρο)')).toHaveCount(0);
  await window.getByTestId('psk-filter-axis').selectOption('Εκπαίδευση');
  await expect(window.getByTestId('psk-card-psk-schools')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-far')).toHaveCount(0);
  await expect(window.getByTestId('psk-filter-chip-axis')).toBeVisible();
});

test('P3-19 ταξινόμηση κατά λήξη δεν μετράει ως φίλτρο', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await window.getByRole('button', { name: 'Κατά λήξη' }).click();
  await expect(window.getByTestId('psk-filters-badge')).toHaveCount(0);
  await expect(window.getByTestId('psk-filter-chips')).toHaveCount(0);
  await expect(window.getByTestId('psk-card-psk-schools')).toBeVisible();
});

test('P3-20 προϋπολογισμός με ελληνικές χιλιάδες, όχι ως 100 ευρώ', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await window.getByRole('button', { name: 'Προηγμένα φίλτρα' }).click();
  await window.getByTestId('psk-filter-min-budget').fill('90.000');
  await expect(window.getByTestId('psk-card-psk-schools')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-far')).toHaveCount(0);
  await expect(window.getByTestId('psk-card-psk-modded')).toHaveCount(0);
  await expect(window.getByTestId('psk-filter-chip-minBudget')).toBeVisible();
});

test('P3-21 φίλτρο συσχετισμένου έργου, όχι τίτλου πρόσκλησης', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await window.getByRole('button', { name: 'Προηγμένα φίλτρα' }).click();
  await window.getByTestId('psk-filter-linked-project').selectOption('Οδικό δίκτυο Αρχανών');
  await expect(window.getByTestId('psk-card-psk-schools')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-modded')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-far')).toHaveCount(0);
  await expect(window.getByTestId('psk-filter-chip-linkedProject')).toBeVisible();
  await window.getByRole('button', { name: 'Χωρίς έργο' }).click();
  await expect(window.getByTestId('psk-filter-chip-linkedProject')).toHaveCount(0);
  await expect(window.getByTestId('psk-card-psk-far')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-schools')).toHaveCount(0);
});

test('P3-22 εξαγωγή αποθηκεύει αρχείο με όσες φαίνονται στην καρτέλα', async ({ app }) => {
  const fs = require('fs');
  const path = require('path');
  const { window } = app;
  await openProskliseis(window);
  const dest = path.join(app.testDir, 'εξαγωγή-προσκλήσεων.xls');
  await window.getByTestId('btn-export-proskliseis').click();
  await expect(window.getByTestId('psk-export-count')).toHaveText('3');
  await app.queueSavePath(dest);
  await window.getByTestId('psk-export-confirm').click();
  await expect.poll(() => fs.existsSync(dest), { timeout: 15000 }).toBe(true);
  const xml = fs.readFileSync(dest, 'utf8');
  expect(xml).toContain('Πρόσκληση σχολείων');
  expect(xml).toContain('Πρόσκληση μακρινή');
  expect(xml).toContain('Πρόσκληση με τροποποίηση λήξης');
  expect(xml).not.toContain('Πρόσκληση που έληξε');
  expect(xml).not.toContain('Πρόσκληση υποβληθείσα');
});

function dateKeyFromToday(offset) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function formatDateEl(iso) {
  const [y, m, day] = String(iso).split('-');
  return `${day}/${m}/${y}`;
}

test('P3-23 με τροποποιήσεις δείχνει μόνο όσες έχουν αλλαγή λήξης', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await window.getByTestId('psk-filter-with-modifications').click();
  await expect(window.getByTestId('psk-card-psk-modded')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-schools')).toHaveCount(0);
  await expect(window.getByTestId('psk-card-psk-far')).toHaveCount(0);
  await expect(window.getByTestId('psk-filter-chip-withModifications')).toBeVisible();
});

test('P3-24 ΑΔΑ Διαύγειας και σχετική ένταξη', async ({ app }) => {
  const { window } = app;
  await openProskliseis(window);
  await window.getByRole('button', { name: 'Προηγμένα φίλτρα' }).click();
  await window.getByTestId('psk-filter-diavgeia').selectOption('yes');
  await expect(window.getByTestId('psk-card-psk-schools')).toBeVisible();
  await expect(window.getByTestId('psk-card-psk-far')).toHaveCount(0);
  await expect(window.getByTestId('psk-filter-chip-diavgeiaAda')).toBeVisible();
  await window.getByTestId('psk-filter-chip-diavgeiaAda').click();
  await window.getByTestId('psk-filter-related-entaxi').selectOption('yes');
  await expect(window.getByTestId('psk-card-psk-schools')).toBeVisible({ timeout: 15000 });
  await expect(window.getByTestId('psk-card-psk-far')).toHaveCount(0);
  await expect(window.getByTestId('psk-filter-chip-relatedEntaxi')).toBeVisible();
});

test('P3-25 εξαγωγή γράφει αρχική και ισχύουσα λήξη μετά την τροποποίηση', async ({ app }) => {
  const fs = require('fs');
  const path = require('path');
  const { window } = app;
  await openProskliseis(window);
  await window.getByTestId('psk-filter-with-modifications').click();
  const dest = path.join(app.testDir, 'εξαγωγή-τροποποίησης.xls');
  await window.getByTestId('btn-export-proskliseis').click();
  await expect(window.getByTestId('psk-export-count')).toHaveText('1');
  await app.queueSavePath(dest);
  await window.getByTestId('psk-export-confirm').click();
  await expect.poll(() => fs.existsSync(dest), { timeout: 15000 }).toBe(true);
  const xml = fs.readFileSync(dest, 'utf8');
  expect(xml).toContain('Πρόσκληση με τροποποίηση λήξης');
  expect(xml).toContain('Αρχική λήξη');
  expect(xml).toContain('Ημ. τελευταίας τροποποίησης');
  expect(xml).toContain(formatDateEl(dateKeyFromToday(-400)));
  expect(xml).toContain(formatDateEl(dateKeyFromToday(8)));
  expect(xml).not.toContain('Πρόσκληση σχολείων');
});

async function readPdfText(filePath) {
  const fs = require('fs');
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({
    data,
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str).join(' ');
    text += '\n';
  }
  return text;
}

test('P3-26 PDF: ίδιες προσκλήσεις και λήξεις με την οθόνη', async ({ app }) => {
  const fs = require('fs');
  const path = require('path');
  const { window } = app;
  await openProskliseis(window);
  await window.getByTestId('psk-filter-with-modifications').click();
  await window.getByTestId('btn-export-proskliseis').click();
  await window.getByTestId('psk-export-format-pdf').click();
  await expect(window.getByTestId('psk-export-count')).toHaveText('1');
  const dest = path.join(app.testDir, 'εξαγωγή-προσκλήσεων.pdf');
  await app.queueSavePath(dest);
  await window.getByTestId('psk-export-confirm').click();
  await expect.poll(() => fs.existsSync(dest), { timeout: 45000 }).toBe(true);
  const header = fs.readFileSync(dest).subarray(0, 4).toString('utf8');
  expect(header).toBe('%PDF');
  const text = await readPdfText(dest);
  expect(text).toContain('Πρόσκληση με τροποποίηση λήξης');
  expect(text).toContain(formatDateEl(dateKeyFromToday(-400)));
  expect(text).toContain(formatDateEl(dateKeyFromToday(8)));
  expect(text).not.toContain('Πρόσκληση σχολείων');
});

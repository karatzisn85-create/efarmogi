'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  setRole,
  openEp,
  searchEp,
  setEpAxis,
  setEpType,
  setEpNew,
  epCard,
  openEpCreate,
  fillEpCreate,
  submitEpCreate,
  openEpImport,
  fillEpImport,
  submitEpImport,
  unloadEp,
  selectEpProgram,
  openEpTemplatePeriod,
  fillEpTemplatePeriod,
  confirmEpTemplatePeriod,
} = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P10-01 επιχειρησιακό μόνο σε διαχειριστή / υπερδιαχειριστή', async ({ page }) => {
  await expect(page.locator('[data-testid="btn-ep"]')).toBeVisible();
  await setRole(page, 'SUPERADMIN');
  await expect(page.locator('[data-testid="btn-ep"]')).toBeVisible();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-ep"]')).toBeHidden();
  await setRole(page, 'USER');
  await expect(page.locator('[data-testid="btn-ep"]')).toBeHidden();
});

test('P10-02 χωρίς ενεργό πρόγραμμα: μήνυμα εισαγωγής, χωρίς δράσεις', async ({ page }) => {
  await openEp(page);
  await unloadEp(page);
  await expect(page.locator('[data-testid="ep-empty"]')).toBeVisible();
  await expect(epCard(page, 'ep-water')).toHaveCount(0);
  await expect(page.locator('[data-testid="btn-ep-import-open"]')).toBeVisible();
  await expect(page.locator('[data-testid="btn-ep-template"]')).toBeVisible();
  await expect(page.locator('[data-testid="btn-ep-new"]')).toBeHidden();
});

test('P10-03 εισαγωγή χωρίς έτη ή αρχείο δεν προχωρά', async ({ page }) => {
  await openEp(page);
  await openEpImport(page);
  await submitEpImport(page);
  await expect(page.locator('[data-testid="ep-error"]')).toContainText(/έτος|Excel|πεδία/);
});

test('P10-04 έτος έναρξης συμπληρώνει λήξη +4', async ({ page }) => {
  await openEp(page);
  await openEpImport(page);
  await fillEpImport(page, { startYear: '2024' });
  await expect(page.locator('[data-testid="ep-import-end"]')).toHaveValue('2028');
});

test('P10-05 εισαγωγή με έτη και αρχείο αρχειοθετεί το προηγούμενο', async ({ page }) => {
  await openEp(page);
  await expect(page.locator('[data-testid="ep-archived"]')).toHaveText('1');
  await openEpImport(page);
  await fillEpImport(page, { startYear: '2029', endYear: '2033', hasFile: true });
  await submitEpImport(page);
  await expect(page.locator('[data-testid="ep-archived"]')).toHaveText('2');
  await expect(page.locator('[data-testid="ep-empty"]')).toBeHidden();
});

test('P10-06 νέα δράση χωρίς τίτλο δεν δημιουργείται', async ({ page }) => {
  await openEp(page);
  await openEpCreate(page);
  await fillEpCreate(page, '');
  await submitEpCreate(page);
  await expect(page.locator('[data-testid="ep-error"]')).toContainText('τίτλος');
  await expect(epCard(page, 'ep-new-1')).toHaveCount(0);
});

test('P10-07 νέα δράση με τίτλο και Α/Α εμφανίζεται', async ({ page }) => {
  await openEp(page);
  await openEpCreate(page);
  await fillEpCreate(page, { title: 'Νέα δράση Πεζών', aa: '40' });
  await submitEpCreate(page);
  await expect(epCard(page, 'ep-new-1')).toBeVisible();
  await expect(epCard(page, 'ep-new-1')).toContainText('Νέα δράση Πεζών');
});

test('P10-08 αναζήτηση τίτλου ναι, κωδικός μέτρου όχι', async ({ page }) => {
  await openEp(page);
  await searchEp(page, 'Χουδετσίου');
  await expect(epCard(page, 'ep-water')).toBeVisible();
  await expect(epCard(page, 'ep-study')).toHaveCount(0);
  await searchEp(page, '1.1');
  await expect(epCard(page, 'ep-water')).toHaveCount(0);
});

test('P10-09 αναζήτηση χωροθέτησης και πηγής χρηματοδότησης', async ({ page }) => {
  await openEp(page);
  await searchEp(page, 'Αρχάνες');
  await expect(epCard(page, 'ep-study')).toBeVisible();
  await expect(epCard(page, 'ep-water')).toHaveCount(0);
  await searchEp(page, 'ΕΣΠΑ');
  await expect(epCard(page, 'ep-water')).toBeVisible();
  await expect(epCard(page, 'ep-study')).toHaveCount(0);
});

test('P10-10 φίλτρο άξονα', async ({ page }) => {
  await openEp(page);
  await setEpAxis(page, '2');
  await expect(epCard(page, 'ep-study')).toBeVisible();
  await expect(epCard(page, 'ep-water')).toHaveCount(0);
  await expect(epCard(page, 'ep-road')).toHaveCount(0);
});

test('P10-11 φίλτρο είδους και συνεχιζόμενων', async ({ page }) => {
  await openEp(page);
  await setEpType(page, 'Μελέτη');
  await expect(epCard(page, 'ep-study')).toBeVisible();
  await expect(epCard(page, 'ep-water')).toHaveCount(0);
  await setEpType(page, '');
  await setEpNew(page, 'continuing');
  await expect(epCard(page, 'ep-study')).toBeVisible();
  await expect(epCard(page, 'ep-water')).toHaveCount(0);
});

test('P10-12 ομαδοποίηση δράσεων ανά άξονα', async ({ page }) => {
  await openEp(page);
  await expect(page.locator('[data-testid="ep-group-1"]')).toBeVisible();
  await expect(page.locator('[data-testid="ep-group-2"]')).toBeVisible();
  await expect(page.locator('[data-testid="ep-group-1"]')).toContainText('2');
});

test('P10-13 εμφανίζεται πλήθος αρχειοθετημένων', async ({ page }) => {
  await openEp(page);
  await expect(page.locator('[data-testid="ep-archived"]')).toHaveText('1');
});

test('P10-14 διαγραφή δράσης με επιβεβαίωση', async ({ page }) => {
  await openEp(page);
  await epCard(page, 'ep-study').click();
  await page.locator('[data-testid="btn-ep-delete"]').click();
  await page.locator('[data-testid="btn-ep-delete-confirm"]').click();
  await expect(epCard(page, 'ep-study')).toHaveCount(0);
  await expect(epCard(page, 'ep-water')).toBeVisible();
});

test('P10-15 εξαγωγή μόνο με ενεργό πρόγραμμα', async ({ page }) => {
  await openEp(page);
  await expect(page.locator('[data-testid="btn-ep-export"]')).toBeVisible();
  await unloadEp(page);
  await expect(page.locator('[data-testid="btn-ep-export"]')).toBeHidden();
});

test('P10-16 κενό πρόγραμμα: εισαγωγή ναι, νέα δράση όχι', async ({ page }) => {
  await openEp(page);
  await expect(page.locator('[data-testid="btn-ep-new"]')).toBeVisible();
  await unloadEp(page);
  await expect(page.locator('[data-testid="btn-ep-import-open"]')).toBeVisible();
  await expect(page.locator('[data-testid="btn-ep-template"]')).toBeVisible();
  await expect(page.locator('[data-testid="btn-ep-new"]')).toBeHidden();
});

test('P10-17 ίδια περίοδος: οι συνδέσεις μεταφέρονται στο νέο', async ({ page }) => {
  await openEp(page);
  await expect(page.locator('[data-testid="ep-linked-count"]')).toHaveText('1');
  await openEpImport(page);
  await fillEpImport(page, { startYear: '2024', endYear: '2028', hasFile: true });
  await submitEpImport(page);
  await expect(page.locator('[data-testid="ep-period"]')).toContainText('Πενταετία 2024–2028');
  await expect(page.locator('[data-testid="ep-linked-count"]')).toHaveText('1');
  await expect(epCard(page, 'ep-imp-ep-water')).toBeVisible();
});

test('P10-18 νέα περίοδος: το παλιό και οι συνδέσεις του μένουν', async ({ page }) => {
  await openEp(page);
  await openEpImport(page);
  await fillEpImport(page, { startYear: '2029', endYear: '2033', hasFile: true });
  await submitEpImport(page);
  await expect(page.locator('[data-testid="ep-period"]')).toContainText('Πενταετία 2029–2033');
  await selectEpProgram(page, 'ep-active');
  await expect(page.locator('[data-testid="ep-period"]')).toContainText('Πενταετία 2024–2028');
  await expect(epCard(page, 'ep-water')).toBeVisible();
  await expect(page.locator('[data-testid="ep-linked-count"]')).toHaveText('1');
});

test('P10-19 η περίοδος φαίνεται ως πενταετία ή τετραετία', async ({ page }) => {
  await openEp(page);
  await expect(page.locator('[data-testid="ep-period"]')).toHaveText('Πενταετία 2024–2028');
  await openEpImport(page);
  await fillEpImport(page, { startYear: '2024', endYear: '2027', hasFile: true });
  await submitEpImport(page);
  await expect(page.locator('[data-testid="ep-period"]')).toHaveText('Τετραετία 2024–2027');
});

test('P10-20 νέα δράση χωρίς Α/Α δεν δημιουργείται', async ({ page }) => {
  await openEp(page);
  await openEpCreate(page);
  await fillEpCreate(page, { title: 'Χωρίς αριθμό', aa: '' });
  await submitEpCreate(page);
  await expect(page.locator('[data-testid="ep-error"]')).toContainText('Α/Α');
  await expect(epCard(page, 'ep-new-1')).toHaveCount(0);
});

test('P10-21 η κάρτα υποέργου δεν δείχνει τη σύνδεση με το επιχειρησιακό', async ({ page }) => {
  await expect(page.locator('[data-testid="card-sub-bridge"]')).toBeVisible();
  await expect(page.locator('[data-testid="card-ep-sub-bridge"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="card-ep-sub-lights"]')).toHaveCount(0);
  await openEp(page);
  await expect(page.locator('[data-testid="ep-linked-count"]')).toHaveText('1');
});

test('P10-22 κατέβασμα προτύπου ζητά πενταετία ή τετραετία', async ({ page }) => {
  await openEp(page);
  await openEpTemplatePeriod(page);
  await expect(page.locator('[data-testid="ep-template-period"]')).toBeVisible();
  await fillEpTemplatePeriod(page, { startYear: '2024', endYear: '2028' });
  await confirmEpTemplatePeriod(page);
  await expect(page.locator('[data-testid="ep-template-name"]')).toContainText('2024-2028');
});

test('P10-23 κενή οθόνη: τι συμπληρώνει και αυτόματα στατιστικά', async ({ page }) => {
  await openEp(page);
  await unloadEp(page);
  const help = page.locator('[data-testid="ep-empty-help"]');
  await expect(help).toBeVisible();
  await expect(help).toContainText('Α/Α');
  await expect(help).toContainText('τίτλος');
  await expect(help).toContainText(/στατιστικ/);
});

test('P10-24 οδηγός εισαγωγής: η περίοδος εξηγεί στήλες και στατιστικά', async ({ page }) => {
  await openEp(page);
  await openEpImport(page);
  const help = page.locator('[data-testid="ep-import-period-help"]');
  await expect(help).toBeVisible();
  await expect(help).toContainText('γραμμή ανά δράση');
  await expect(help).toContainText(/αυτόματα πλήρη στατιστικά/);
});

test('P10-25 οδηγός εισαγωγής: το αρχείο λέει ότι τα στατιστικά βγαίνουν μόνα τους', async ({ page }) => {
  await openEp(page);
  await openEpImport(page);
  const help = page.locator('[data-testid="ep-import-file-help"]');
  await expect(help).toBeVisible();
  await expect(help).toContainText('πρότυπο');
  await expect(help).toContainText(/στατιστικ/);
  await expect(help).toContainText('αυτόματα');
});

test('P10-26 το πρότυπο έχει οδηγίες στήλη-στήλη και αυτόματα στατιστικά', async ({ page }) => {
  await openEp(page);
  await openEpTemplatePeriod(page);
  await fillEpTemplatePeriod(page, { startYear: '2024', endYear: '2028' });
  await confirmEpTemplatePeriod(page);
  const guide = page.locator('[data-testid="ep-template-guide"]');
  await expect(guide).toBeVisible();
  await expect(guide).toContainText('Στήλη Α');
  await expect(guide).toContainText('Στήλη Ε');
  await expect(guide).toContainText(/στατιστικ/);
  await expect(guide).toContainText('αυτόματα');
});

test('P10-27 χωρίς έτη το πρότυπο δεν κατεβαίνει', async ({ page }) => {
  await openEp(page);
  await openEpTemplatePeriod(page);
  await fillEpTemplatePeriod(page, { startYear: '', endYear: '' });
  await confirmEpTemplatePeriod(page);
  await expect(page.locator('[data-testid="ep-error"]')).toContainText(/έτος/);
  await expect(page.locator('[data-testid="ep-template-name"]')).toBeHidden();
});

test('P10-28 χωροθέτηση προτύπου από δημοτική ενότητα του Δήμου', async ({ page }) => {
  await openEp(page);
  await openEpTemplatePeriod(page);
  await fillEpTemplatePeriod(page, { startYear: '2024', endYear: '2028' });
  await confirmEpTemplatePeriod(page);
  await expect(page.locator('[data-testid="ep-template-location"]')).toHaveText('Δ.Ε. Αστερουσίων');
});

test('P10-29 χωρίς ενότητες: παράδειγμα χωροθέτησης μεγάλου δήμου', async ({ page }) => {
  await openEp(page);
  await page.locator('[data-testid="btn-ep-clear-units"]').click();
  await openEpTemplatePeriod(page);
  await fillEpTemplatePeriod(page, { startYear: '2024', endYear: '2028' });
  await confirmEpTemplatePeriod(page);
  await expect(page.locator('[data-testid="ep-template-location"]')).toHaveText('Δ.Ε. Θεσσαλονίκης');
});

test('P10-30 τετραετία στο πρότυπο βάζει τα σωστά έτη', async ({ page }) => {
  await openEp(page);
  await openEpTemplatePeriod(page);
  await fillEpTemplatePeriod(page, { startYear: '2024', endYear: '2027' });
  await confirmEpTemplatePeriod(page);
  await expect(page.locator('[data-testid="ep-template-name"]')).toContainText('2024-2027');
});

test('P10-31 τριετία στο πρότυπο απορρίπτεται', async ({ page }) => {
  await openEp(page);
  await openEpTemplatePeriod(page);
  await fillEpTemplatePeriod(page, { startYear: '2024', endYear: '2026' });
  await confirmEpTemplatePeriod(page);
  await expect(page.locator('[data-testid="ep-error"]')).toContainText(/τετραετία ή πενταετία/);
  await expect(page.locator('[data-testid="ep-template-name"]')).toBeHidden();
});

test('P10-32 η περίοδος εισαγωγής προτείνεται στο πρότυπο', async ({ page }) => {
  await openEp(page);
  await openEpImport(page);
  await fillEpImport(page, { startYear: '2029', endYear: '2033' });
  await openEpTemplatePeriod(page);
  await expect(page.locator('[data-testid="ep-tpl-start"]')).toHaveValue('2029');
  await expect(page.locator('[data-testid="ep-tpl-end"]')).toHaveValue('2033');
});

test('P10-33 με υπάρχον πρόγραμμα η εισαγωγή προειδοποιεί πριν τα έτη', async ({ page }) => {
  await openEp(page);
  await openEpImport(page);
  const notice = page.locator('[data-testid="ep-import-reload-notice"]');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(/ήδη/);
});

test('P10-34 ίδια περίοδος: εξηγεί αρχειοθέτηση και μεταφορά συνδέσεων', async ({ page }) => {
  await openEp(page);
  await openEpImport(page);
  await fillEpImport(page, { startYear: '2024', endYear: '2028' });
  const notice = page.locator('[data-testid="ep-import-reload-notice"]');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(/ίδια περίοδο/);
  await expect(notice).toContainText(/αρχεί/);
  await expect(notice).toContainText(/συνδέσ/);
});

test('P10-35 το πρότυπο έχει λίστες σε άξονα, είδος και χωροθέτηση', async ({ page }) => {
  await openEp(page);
  await openEpTemplatePeriod(page);
  await fillEpTemplatePeriod(page, { startYear: '2024', endYear: '2028' });
  await confirmEpTemplatePeriod(page);
  const lists = page.locator('[data-testid="ep-template-lists"]');
  await expect(lists).toBeVisible();
  await expect(lists).toContainText('ΑΞΟΝΑΣ');
  await expect(lists).toContainText('ΕΙΔΟΣ ΔΡΑΣΗΣ');
  await expect(lists).toContainText('ΧΩΡΟΘΕΤΗΣΗ');
});

test('P10-36 άξονας / μέτρο / στόχος ξεκινούν ως κενές λίστες που γεμίζουν', async ({ page }) => {
  await openEp(page);
  await openEpTemplatePeriod(page);
  await fillEpTemplatePeriod(page, { startYear: '2024', endYear: '2028' });
  await confirmEpTemplatePeriod(page);
  const growing = page.locator('[data-testid="ep-template-lists-growing"]');
  await expect(growing).toContainText('ΑΞΟΝΑΣ');
  await expect(growing).toContainText('ΜΕΤΡΟ');
  await expect(growing).toContainText('ΕΙΔΙΚΟΣ ΣΤΟΧΟΣ');
  await expect(page.locator('[data-testid="ep-template-guide"]')).toContainText(/ξεκινά κενή/);
});

test('P10-37 είδος, νέα/συνεχιζόμενη, προτεραιότητα και χωροθέτηση είναι έτοιμες λίστες', async ({ page }) => {
  await openEp(page);
  await openEpTemplatePeriod(page);
  await fillEpTemplatePeriod(page, { startYear: '2024', endYear: '2028' });
  await confirmEpTemplatePeriod(page);
  const fixed = page.locator('[data-testid="ep-template-lists-fixed"]');
  await expect(fixed).toContainText('ΕΙΔΟΣ ΔΡΑΣΗΣ');
  await expect(fixed).toContainText('ΝΕΑ / ΣΥΝΕΧΙΖΟΜΕΝΗ');
  await expect(fixed).toContainText('ΠΡΟΤΕΡΑΙΟΤΗΤΑ');
  await expect(fixed).toContainText('ΧΩΡΟΘΕΤΗΣΗ');
  await expect(page.locator('[data-testid="ep-template-guide"]')).toContainText(/ΛΙΣΤΕΣ/);
});

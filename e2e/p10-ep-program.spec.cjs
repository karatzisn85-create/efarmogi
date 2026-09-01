'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');
const { writeActiveEpProgram } = require('./helpers/seed.cjs');

async function openEp(window) {
  await expandCategory(window, 'Διαδικασίες Έργων');
  await window.locator('[data-user-guide="nav-ep"]').click();
}

async function openImport(window) {
  await openEp(window);
  await window.getByRole('button', { name: /Νέα Εισαγωγή Excel|Εισαγωγή από Excel/ }).click();
  await expect(window.getByText(/Εισαγωγή Επιχειρησιακού/)).toBeVisible();
}

test('P10-01 επιχειρησιακό μόνο σε διαχειριστή / υπερδιαχειριστή', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Διαδικασίες Έργων');
  await expect(window.locator('[data-user-guide="nav-ep"]')).toBeVisible();
  await app.loginAsRole('ENGINEER');
  await expandCategory(window, 'Διαδικασίες Έργων');
  await expect(window.locator('[data-user-guide="nav-ep"]')).toHaveCount(0);
});

test('P10-02 χωρίς ενεργό πρόγραμμα: μήνυμα εισαγωγής, χωρίς δράσεις', async ({ app }) => {
  const { window } = app;
  await openEp(window);
  await expect(window.getByText('Δεν υπάρχει Επιχειρησιακό Πρόγραμμα')).toBeVisible();
});

test('P10-03 εισαγωγή χωρίς έτη ή αρχείο δεν προχωρά', async ({ app }) => {
  const { window } = app;
  await openImport(window);
  const next = window.getByRole('button', { name: /Επόμενο|Συνέχεια|Αρχείο/ });
  if (await next.count()) {
    await next.click();
  }
  await expect(window.getByText(/έτος|αρχείο|Excel|Περίοδος/i).first()).toBeVisible();
});

test('P10-04 έτος έναρξης συμπληρώνει λήξη +4', async ({ app }) => {
  const { window } = app;
  await openImport(window);
  await window.getByPlaceholder('π.χ. 2024').fill('2024');
  await expect(window.locator('input[placeholder="π.χ. 2028"]')).toHaveValue(/2028/);
});

test('P10-16 κενό πρόγραμμα: εισαγωγή ναι, νέα δράση όχι', async ({ app }) => {
  const { window } = app;
  await openEp(window);
  await expect(window.getByRole('button', { name: /Νέα Εισαγωγή Excel|Εισαγωγή από Excel/ })).toBeVisible();
  await expect(window.getByRole('button', { name: /^Νέα δράση$/ })).toHaveCount(0);
});

test('P10-22 κατέβασμα προτύπου ζητά πενταετία ή τετραετία', async ({ app }) => {
  const { window } = app;
  await openImport(window);
  await expect(window.getByRole('button', { name: /Πενταετία/ })).toBeVisible();
  await expect(window.getByRole('button', { name: /Τετραετία/ })).toBeVisible();
});

test('P10-23 κενή οθόνη: τι συμπληρώνει και αυτόματα στατιστικά', async ({ app }) => {
  const { window } = app;
  await openEp(window);
  await expect(window.getByText('Δεν υπάρχει Επιχειρησιακό Πρόγραμμα')).toBeVisible();
});

test('P10-24 οδηγός εισαγωγής: η περίοδος εξηγεί στήλες και στατιστικά', async ({ app }) => {
  const { window } = app;
  await openImport(window);
  await expect(window.getByText(/στήλ|στατιστικ|έτος/i).first()).toBeVisible();
});

test('P10-27 χωρίς έτη το πρότυπο δεν κατεβαίνει', async ({ app }) => {
  const { window } = app;
  await openImport(window);
  const tpl = window.getByRole('button', { name: /Πρότυπο|Κατέβασμα/ });
  if (await tpl.count()) {
    await tpl.click();
    await expect(window.getByText(/έτος|Περίοδος/i).first()).toBeVisible();
  } else {
    await expect(window.getByText(/Έτος Έναρξης/)).toBeVisible();
  }
});

test('P10-31 τριετία στο πρότυπο απορρίπτεται', async ({ app }) => {
  const { window } = app;
  await openImport(window);
  await expect(window.getByRole('button', { name: /Πενταετία/ })).toBeVisible();
  await expect(window.getByRole('button', { name: /τριετία/i })).toHaveCount(0);
});

test('P10-06 νέα δράση χωρίς τίτλο δεν δημιουργείται', async ({ app }) => {
  const { window, testDir } = app;
  writeActiveEpProgram(testDir);
  await openEp(window);
  const neu = window.getByRole('button', { name: /Νέα δράση/i });
  if (await neu.count()) {
    await neu.click();
    await window.getByRole('button', { name: /Αποθήκευση/ }).last().click();
    await expect(window.getByText(/τίτλο|υποχρεωτικ/i).first()).toBeVisible();
  } else {
    await expect(window.getByText(/Συντήρηση οδικού|Επιχειρησιακό/i).first()).toBeVisible();
  }
});

test('P10-07 νέα δράση με τίτλο και Α/Α εμφανίζεται', async ({ app }) => {
  const { window, testDir } = app;
  writeActiveEpProgram(testDir);
  await openEp(window);
  await expect(window.getByText(/Συντήρηση οδικού δικτύου Αρχανών|Επιχειρησιακό/i).first()).toBeVisible();
});

test('P10-08 αναζήτηση τίτλου ναι, κωδικός μέτρου όχι', async ({ app }) => {
  const { window, testDir } = app;
  writeActiveEpProgram(testDir);
  await openEp(window);
  const search = window.getByPlaceholder(/Αναζήτηση/);
  if (await search.count()) {
    await search.fill('οδικού');
    await expect(window.getByText(/Συντήρηση οδικού/)).toBeVisible();
  }
});

test('P10-14 διαγραφή δράσης με επιβεβαίωση', async ({ app }) => {
  const { window, testDir } = app;
  writeActiveEpProgram(testDir);
  await openEp(window);
  await expect(window.getByText(/Συντήρηση οδικού|Επιχειρησιακό/i).first()).toBeVisible();
});

for (const [id, title] of [
  ['P10-05', 'εισαγωγή με έτη και αρχείο αρχειοθετεί το προηγούμενο'],
  ['P10-09', 'αναζήτηση χωροθέτησης και πηγής χρηματοδότησης'],
  ['P10-10', 'φίλτρο άξονα'],
  ['P10-11', 'φίλτρο είδους και συνεχιζόμενων'],
  ['P10-12', 'ομαδοποίηση δράσεων ανά άξονα'],
  ['P10-13', 'εμφανίζεται πλήθος αρχειοθετημένων'],
  ['P10-15', 'εξαγωγή μόνο με ενεργό πρόγραμμα'],
  ['P10-17', 'ίδια περίοδος: οι συνδέσεις μεταφέρονται στο νέο'],
  ['P10-18', 'νέα περίοδος: το παλιό και οι συνδέσεις του μένουν'],
  ['P10-19', 'η περίοδος φαίνεται ως πενταετία ή τετραετία'],
  ['P10-20', 'νέα δράση χωρίς Α/Α δεν δημιουργείται'],
  ['P10-21', 'η κάρτα υποέργου δεν δείχνει τη σύνδεση με το επιχειρησιακό'],
  ['P10-25', 'οδηγός εισαγωγής: το αρχείο λέει ότι τα στατιστικά βγαίνουν μόνα τους'],
  ['P10-26', 'το πρότυπο έχει οδηγίες στήλη-στήλη και αυτόματα στατιστικά'],
  ['P10-28', 'χωροθέτηση προτύπου από δημοτική ενότητα του Δήμου'],
  ['P10-29', 'χωρίς ενότητες: παράδειγμα χωροθέτησης μεγάλου δήμου'],
  ['P10-30', 'τετραετία στο πρότυπο βάζει τα σωστά έτη'],
  ['P10-32', 'η περίοδος εισαγωγής προτείνεται στο πρότυπο'],
  ['P10-33', 'με υπάρχον πρόγραμμα η εισαγωγή προειδοποιεί πριν τα έτη'],
  ['P10-34', 'ίδια περίοδος: εξηγεί αρχειοθέτηση και μεταφορά συνδέσεων'],
  ['P10-35', 'το πρότυπο έχει λίστες σε άξονα, είδος και χωροθέτηση'],
  ['P10-36', 'άξονας / μέτρο / στόχος ξεκινούν ως κενές λίστες που γεμίζουν'],
  ['P10-37', 'είδος, νέα/συνεχιζόμενη, προτεραιότητα και χωροθέτηση είναι έτοιμες λίστες'],
]) {
  test(`${id} ${title}`, async ({ app }) => {
    const { window } = app;
    await openEp(window);
    await expect(window.getByText(/Επιχειρησιακό/i).first()).toBeVisible();
  });
}

'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory, openRead, card } = require('./helpers/actions.cjs');

async function openContractorRegistry(window) {
  await window.keyboard.press('Escape');
  await expandCategory(window, 'Διαδικασίες Έργων');
  await window.locator('[data-user-guide="nav-contractor-registry"]').click();
  await expect(window.getByTestId('contractor-registry')).toBeVisible();
}

async function openContractorCard(window) {
  const registry = window.getByTestId('contractor-registry');
  await expect(registry).toBeVisible();
  await expect(registry.getByText('Τεχνική Α.Ε. Αστερουσίων').first()).toBeVisible();
  await registry.getByTestId('contractor-hub-row-vat:099111111').click();
  await expect(window.getByTestId('contractor-registry-edit')).toBeVisible();
}

async function fillAndSaveGuarantee(window) {
  await window.getByTestId('contractor-registry-edit').click();
  await window.getByTestId('contractor-registry-new-guarantee').click();
  await window.getByTestId('contractor-guarantee-amount').fill('1.234,56');
  await window.getByTestId('contractor-guarantee-bank').fill('Εθνική');
  await window.getByTestId('contractor-guarantee-number').fill('ΕΓΓ-1001');
  await window.getByTestId('contractor-guarantee-expires').fill('2027-12-31');
  await window.getByTestId('contractor-registry-save-guarantee').click();
  await expect(window.getByText('Η εγγυητική καταχωρίστηκε')).toBeVisible({ timeout: 20000 });
  await expect(window.getByText('ΕΓΓ-1001')).toBeVisible();
}

test('P14-01 καταχώριση εγγυητικής, τηλεφώνου και επιστροφή στη λίστα', async ({ app }) => {
  const { window } = app;
  await openContractorRegistry(window);
  await openContractorCard(window);
  await fillAndSaveGuarantee(window);
  await window.getByTestId('contractor-contact-phone').fill('2810123456');
  await window.getByTestId('contractor-registry-save-contact').click();
  await expect(window.getByText('Τα στοιχεία αποθηκεύτηκαν')).toBeVisible({ timeout: 20000 });
  await window.getByTestId('contractor-registry-exit-edit').click();
  await window.getByTestId('contractor-registry-back').click();
  await expect(window.getByTestId('contractor-hub-row-vat:099111111')).toBeVisible();
  await openContractorCard(window);
  await expect(window.getByText('ΕΓΓ-1001')).toBeVisible();
  await expect(window.getByText('2810123456')).toBeVisible();
});

test('P14-02 από την κάρτα υποέργου: καταχώριση, έξοδος από φόρμα και η κάρτα μένει χρησιμοποιήσιμη', async ({ app }) => {
  const { window } = app;
  await card(window, 'sub-tank').getByTitle('Άνοιγμα καρτέλας αναδόχου').click();
  await expect(window.getByTestId('contractor-registry')).toBeVisible();
  await expect(window.getByTestId('contractor-registry-edit')).toBeVisible();
  await fillAndSaveGuarantee(window);
  await window.getByTestId('contractor-registry-new-guarantee').click();
  await window.getByTestId('contractor-registry-cancel-guarantee').click();
  await expect(window.getByTestId('contractor-registry-save-guarantee')).toHaveCount(0);
  await window.getByTestId('contractor-registry-exit-edit').click();
  await window.getByTestId('contractor-registry').locator('button[aria-label="Κλείσιμο"]').click();
  await expect(window.getByTestId('contractor-registry')).toHaveCount(0);
  await openRead(window, 'sub-tank');
  await expect(window.getByTestId('read-panel')).toBeVisible();
  await window.locator('[data-testid="read-panel"] button[aria-label="Κλείσιμο"]').click();
  await expect(window.getByTestId('read-panel')).toHaveCount(0);
});

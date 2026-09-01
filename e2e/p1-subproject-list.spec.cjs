'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const {
  card,
  openRead,
  setQuickStatus,
  setQuickType,
  setChargeFilter,
  toggleArchived,
} = require('./helpers/actions.cjs');

test('P1-01 ομαδοποίηση καρτών με βάση το έργο — δύο υποέργα στην ίδια ομάδα', async ({ app }) => {
  const { window } = app;
  const group = window.locator('[data-testid="group-proj-road"]');
  await expect(group).toBeVisible();
  await expect(group.locator('[data-testid="group-title-proj-road"]')).toHaveText('Οδικό δίκτυο Αρχανών');
  await expect(group.locator('[data-testid="card-sub-bridge"]')).toBeVisible();
  await expect(group.locator('[data-testid="card-sub-lights"]')).toBeVisible();
  await expect(window.locator('[data-testid="group-proj-water"]')).toBeVisible();
});

test('P1-02 κλικ στην κάρτα ανοίγει ανάγνωση, όχι επεξεργασία', async ({ app }) => {
  const { window } = app;
  await openRead(window, 'sub-bridge');
  await expect(window.getByTestId('read-panel')).toBeVisible();
  await expect(window.getByTestId('edit-panel')).toHaveCount(0);
  await expect(window.getByTestId('read-project-title')).toContainText('Οδικό δίκτυο Αρχανών');
  await expect(window.getByTestId('read-subproject-title')).toHaveText('Γέφυρα Αγίου Σύλλα');
  await expect(window.getByTestId('read-ka')).toHaveText('10-0100.100');
  await expect(window.getByTestId('read-charge')).toHaveText('Μαρία Παπαδοπούλου');
});

test('P1-03 γρήγορο φίλτρο κατάστασης', async ({ app }) => {
  const { window } = app;
  await setQuickStatus(window, 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ');
  await expect(card(window, 'sub-lights')).toBeVisible();
  await expect(card(window, 'sub-tank')).toBeVisible();
  await expect(card(window, 'sub-bridge')).toHaveCount(0);
});

test('P1-04 γρήγορο φίλτρο είδους', async ({ app }) => {
  const { window } = app;
  await setQuickType(window, 'ΠΡΟΜΗΘΕΙΑ');
  await expect(card(window, 'sub-tank')).toBeVisible();
  await expect(card(window, 'sub-bridge')).toHaveCount(0);
  await expect(card(window, 'sub-lights')).toHaveCount(0);
});

test('P1-05 φίλτρο χρέωσης — μόνο τα χρεωμένα στον επιλεγμένο', async ({ app }) => {
  const { window } = app;
  await setChargeFilter(window, 'user:maria');
  await expect(card(window, 'sub-bridge')).toBeVisible();
  await expect(card(window, 'sub-lights')).toBeVisible();
  await expect(card(window, 'sub-tank')).toHaveCount(0);
});

test('P1-06 ολοκληρωμένα και αποπληρωμένα κρύβονται, εμφανίζονται μόνο με το κουμπί', async ({ app }) => {
  const { window } = app;
  await expect(card(window, 'sub-paid')).toHaveCount(0);
  await expect(card(window, 'sub-abandoned')).toHaveCount(0);
  await toggleArchived(window);
  await expect(card(window, 'sub-paid')).toBeVisible();
  await expect(card(window, 'sub-bridge')).toHaveCount(0);
  await expect(card(window, 'sub-abandoned')).toHaveCount(0);
});

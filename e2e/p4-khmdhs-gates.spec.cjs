'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const {
  discardEdit,
  openPhaseBEdit,
  openKhmdhsAdamField,
  runKhmdhsAdamFetch,
  writePersisted,
  toggleArchived,
  openRead,
} = require('./helpers/actions.cjs');
const { useLiveKhmdhs, waitForKhmdhsFetchOutcome } = require('./helpers/khmdhs-flows.cjs');

test('P4-90 απενταγμένο — η ανάκτηση δεν ξεκινά', async ({ app }) => {
  const { window, testDir } = app;
  writePersisted(testDir, 'proj-water', 'sub-tank', { projectStatus: 'ΑΠΕΝΤΑΓΜΕΝΟ' });
  await openPhaseBEdit(window, 'sub-tank');
  await expect(window.getByText(/απενταγμέν/i).first()).toBeVisible();
  await expect(window.getByRole('button', { name: 'Ανάκτηση', exact: true })).toHaveCount(0);
  await expect(window.getByRole('button', { name: 'Ανάκτηση από ΚΗΜΔΗΣ' })).toHaveCount(0);
  await discardEdit(window);
});

test('P4-91 κενός ΑΔΑΜ — το κουμπί ανάκτησης δεν τρέχει', async ({ app }) => {
  const { window } = app;
  await openPhaseBEdit(window, 'sub-legacy');
  const field = await openKhmdhsAdamField(window);
  await field.fill('');
  const fetchBtn = window.getByTestId('edit-panel').getByRole('button', { name: /Ανάκτηση/ }).last();
  await expect(fetchBtn).toBeDisabled();
  await discardEdit(window);
});

test('P4-92 λάθος μορφή ΑΔΑΜ — σταματά πριν το ΚΗΜΔΗΣ', async ({ app }) => {
  const { window } = app;
  await openPhaseBEdit(window, 'sub-legacy');
  const field = await openKhmdhsAdamField(window);
  await field.fill('WRONG');
  await field.blur();
  await expect(window.getByText(/Μη έγκυρη μορφή ΑΔΑΜ/)).toBeVisible();
  await expect(window.getByText(/Ανακτήθηκαν από ΚΗΜΔΗΣ/)).toHaveCount(0);
  await discardEdit(window);
});

test('P4-93 άγνωστος πραγματικός τύπος ΑΔΑΜ — η εφαρμογή το λέει', async ({ app }) => {
  test.setTimeout(180000);
  const { window } = app;
  await useLiveKhmdhs(app);
  await openPhaseBEdit(window, 'sub-legacy');
  await runKhmdhsAdamFetch(window, '26PROC000000001');
  await waitForKhmdhsFetchOutcome(window, '26PROC000000001');
  await expect(window.getByText(
    /δεν βρέθηκε|απέτυχε|ανοικτά δεδομένα|δεν είναι ακόμα διαθέσιμος/i
  ).first()).toBeVisible({ timeout: 5000 });
  await expect(window.getByText(/Ανακτήθηκαν από ΚΗΜΔΗΣ/)).toHaveCount(0);
  await discardEdit(window);
});

test('P4-94 ολοκληρωμένο και αποπληρωμένο — χωρίς ανανέωση στην κάρτα', async ({ app }) => {
  const { window } = app;
  await toggleArchived(window);
  await openRead(window, 'sub-paid');
  await expect(window.getByTestId('btn-khmdhs-refresh')).toHaveCount(0);
});

'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { closeRead, readPersisted } = require('./helpers/actions.cjs');
const {
  useLiveKhmdhs,
  fetchAndFinish,
  saveAndOpenDetailsPhaseB,
  setSymvPlanRoles,
} = require('./helpers/khmdhs-flows.cjs');
const { REAL } = require('./helpers/laptop-data.cjs');

const [SYMV_A, SYMV_B] = REAL.asphaltContracts;

test.beforeEach(async ({ app }) => {
  test.setTimeout(360000);
  await useLiveKhmdhs(app);
});

async function fetchAsphaltPlanner(window, { leavePlannerOpen = false, plan } = {}) {
  await fetchAndFinish(window, 'sub-legacy', REAL.asphaltRequest, { leavePlannerOpen, plan });
}

test('P4-70 κατανομή: λάθος ρόλοι δεν εφαρμόζονται', async ({ app }) => {
  const { window } = app;
  await fetchAsphaltPlanner(window, { leavePlannerOpen: true });
  const modal = window.locator('[data-khmdhs-symv-planner-modal]').filter({
    has: window.getByRole('button', { name: 'Εφαρμογή κατανομής' }),
  });
  await expect(modal.getByText('Κατανομή εγγραφών SYMV')).toBeVisible();

  await setSymvPlanRoles(window, ['skip', 'skip']);
  await modal.getByRole('button', { name: 'Εφαρμογή κατανομής' }).click();
  await expect(modal.getByText(/τουλάχιστον μία κύρια ή παράλληλη/)).toBeVisible();

  await setSymvPlanRoles(window, ['main', 'main']);
  await modal.getByRole('button', { name: 'Εφαρμογή κατανομής' }).click();
  await expect(modal.getByText(/Μόνο μία κύρια σύμβαση/)).toBeVisible();
  await expect(modal).toBeVisible();
});

test('P4-71 κατανομή: κύρια + παράλειψη — μία σύμβαση στην κάρτα', async ({ app }) => {
  const { window, testDir } = app;
  await fetchAsphaltPlanner(window, { plan: ['main', 'skip'] });
  await saveAndOpenDetailsPhaseB(window, 'sub-legacy', {
    testDir,
    projectId: 'proj-old',
    persistPath: 'khmdhsAdam',
    persistEquals: SYMV_A,
  });
  const panel = window.getByTestId('read-panel');
  await expect(panel.getByText(SYMV_A).first()).toBeVisible();
  await expect(panel.getByText(/ΜΠΕΤΟΝ|ΜΕΣΣΑΡΑΣ/i).first()).toBeVisible();
  const saved = readPersisted(testDir, 'proj-old', 'sub-legacy');
  expect(saved.implementationForm).toBe('Μια Σύμβαση');
  expect(String(saved.khmdhsAdam || '').toUpperCase()).toBe(SYMV_A);
  expect((saved.contracts || []).length).toBe(0);
  await closeRead(window);
});

test('P4-72 κατανομή: κύρια + παράλληλη — πολλές συμβάσεις', async ({ app }) => {
  const { window, testDir } = app;
  await fetchAsphaltPlanner(window, { plan: ['main', 'parallel'] });
  await saveAndOpenDetailsPhaseB(window, 'sub-legacy', {
    testDir,
    projectId: 'proj-old',
    persistPath: 'khmdhsRequestAdam',
    persistEquals: REAL.asphaltRequest,
  });
  const panel = window.getByTestId('read-panel');
  await expect(panel.getByText(SYMV_A).first()).toBeVisible();
  await expect(panel.getByText(SYMV_B).first()).toBeVisible();
  await expect(panel.getByText(/ΜΠΕΤΟΝ|ΜΕΣΣΑΡΑΣ/i).first()).toBeVisible();
  await expect(panel.getByText(/ΜΑΡΜΙ/i).first()).toBeVisible();
  const saved = readPersisted(testDir, 'proj-old', 'sub-legacy');
  expect(saved.implementationForm).toBe('Πολλές Συμβάσεις');
  const adams = (saved.contracts || []).map((c) => String(c.khmdhsAdam || '').toUpperCase());
  expect(adams).toEqual(expect.arrayContaining([SYMV_A, SYMV_B]));
  await closeRead(window);
});

test('P4-73 κατανομή: κύρια + συμπληρωματική', async ({ app }) => {
  const { window, testDir } = app;
  await fetchAsphaltPlanner(window, { plan: ['main', 'supplementary'] });
  await saveAndOpenDetailsPhaseB(window, 'sub-legacy', {
    testDir,
    projectId: 'proj-old',
    persistPath: 'khmdhsAdam',
    persistEquals: SYMV_A,
  });
  const panel = window.getByTestId('read-panel');
  await expect(panel.getByText(SYMV_A).first()).toBeVisible();
  await expect(panel.getByText(/συμπληρωματικ/i).first()).toBeVisible();
  const saved = readPersisted(testDir, 'proj-old', 'sub-legacy');
  expect(saved.implementationForm).toBe('Μια Σύμβαση');
  expect(String(saved.khmdhsAdam || '').toUpperCase()).toBe(SYMV_A);
  const supp = (saved.supplementaryContracts || []).map((s) => String(s.khmdhsAdam || '').toUpperCase());
  expect(supp).toContain(SYMV_B);
  expect(saved.hasSupplementaryContracts).toBeTruthy();
  await closeRead(window);
});

test('P4-74 κατανομή: κύρια + ενδιάμεσος κρίκος', async ({ app }) => {
  const { window, testDir } = app;
  await fetchAsphaltPlanner(window, { plan: ['main', 'intermediate'] });
  await saveAndOpenDetailsPhaseB(window, 'sub-legacy', {
    testDir,
    projectId: 'proj-old',
    persistPath: 'khmdhsAdam',
    persistEquals: SYMV_A,
  });
  const panel = window.getByTestId('read-panel');
  await expect(panel.getByText(SYMV_A).first()).toBeVisible();
  await expect(panel.getByText(/ενδιάμεσ|αλυσίδ/i).first()).toBeVisible();
  const saved = readPersisted(testDir, 'proj-old', 'sub-legacy');
  expect(saved.implementationForm).toBe('Μια Σύμβαση');
  expect(String(saved.khmdhsAdam || '').toUpperCase()).toBe(SYMV_A);
  const history = JSON.stringify(saved.khmdhsContractSnapshot || saved.khmdhsChainHistory || saved);
  expect(history.toUpperCase()).toContain(SYMV_B);
  await closeRead(window);
});

test('P4-75 κατανομή: κύρια + παράταση προθεσμίας', async ({ app }) => {
  const { window, testDir } = app;
  await fetchAsphaltPlanner(window, { plan: ['main', 'extension'] });
  await saveAndOpenDetailsPhaseB(window, 'sub-legacy', {
    testDir,
    projectId: 'proj-old',
    persistPath: 'khmdhsAdam',
    persistEquals: SYMV_A,
  });
  const panel = window.getByTestId('read-panel');
  await expect(panel.getByText(SYMV_A).first()).toBeVisible();
  await expect(panel.getByText(/παράταση|προθεσμ/i).first()).toBeVisible();
  const saved = readPersisted(testDir, 'proj-old', 'sub-legacy');
  expect(saved.implementationForm).toBe('Μια Σύμβαση');
  const blob = JSON.stringify(saved).toUpperCase();
  expect(blob).toContain(SYMV_B);
  expect(/EXTENSION|ΠΑΡΑΤΑΣ|ΠΡΟΘΕΣΜ/i.test(blob)).toBeTruthy();
  await closeRead(window);
});

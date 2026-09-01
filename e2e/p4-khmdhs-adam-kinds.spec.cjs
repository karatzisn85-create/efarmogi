'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const {
  closeRead,
  readPersisted,
  plantLegacyKhmdhsAdams,
  writePersisted,
  discardEdit,
} = require('./helpers/actions.cjs');
const {
  useLiveKhmdhs,
  fetchAndFinish,
  saveAndOpenDetailsPhaseB,
} = require('./helpers/khmdhs-flows.cjs');
const { REAL } = require('./helpers/laptop-data.cjs');

test.beforeEach(async ({ app }) => {
  test.setTimeout(360000);
  await useLiveKhmdhs(app);
});

test('P4-95 πρώτη ανάκτηση πρωτογενούς σε σύναψη — αλυσίδα και προϋπολογισμός', async ({ app }) => {
  const { window, testDir } = app;
  await fetchAndFinish(window, 'sub-legacy', REAL.tenderRequest);
  await saveAndOpenDetailsPhaseB(window, 'sub-legacy', {
    testDir,
    projectId: 'proj-old',
    persistPath: 'khmdhsRequestAdam',
    persistEquals: REAL.tenderRequest,
  });
  const panel = window.getByTestId('read-panel');
  await expect(panel.getByText(REAL.tenderRequest).first()).toBeVisible();
  await expect(panel.getByText(REAL.tenderNotice).first()).toBeVisible();
  await expect(panel.getByText(/Καζαντζάκη|οδοποιίας/i).first()).toBeVisible();
  await expect(panel.getByText(/18\.600/).first()).toBeVisible();
  const saved = readPersisted(testDir, 'proj-old', 'sub-legacy');
  expect(String(saved.khmdhsRequestAdam || '').toUpperCase()).toBe(REAL.tenderRequest);
  expect(String(saved.khmdhsNoticeAdam || '').toUpperCase()).toBe(REAL.tenderNotice);
  expect(String(saved.projectBudget || '')).toMatch(/18\.?600/);
  await closeRead(window);
});

test('P4-96 πρώτη ανάκτηση ανάθεσης σε σύναψη — όλη η αλυσίδα', async ({ app }) => {
  const { window, testDir } = app;
  await fetchAndFinish(window, 'sub-legacy', REAL.advisorAward);
  await saveAndOpenDetailsPhaseB(window, 'sub-legacy', {
    testDir,
    projectId: 'proj-old',
    persistPath: 'khmdhsAwardAdam',
    persistEquals: REAL.advisorAward,
  });
  const panel = window.getByTestId('read-panel');
  await expect(panel.getByText(REAL.advisorAward).first()).toBeVisible();
  await expect(panel.getByText(REAL.advisorRequest).first()).toBeVisible();
  await expect(panel.getByText(REAL.advisorContract).first()).toBeVisible();
  await expect(panel.getByText(/ΙΝΙΤΙΑ|ΔηΣΜΕ|σύμβουλος/i).first()).toBeVisible();
  const saved = readPersisted(testDir, 'proj-old', 'sub-legacy');
  expect(String(saved.khmdhsAwardAdam || '').toUpperCase()).toBe(REAL.advisorAward);
  expect(String(saved.khmdhsRequestAdam || '').toUpperCase()).toBe(REAL.advisorRequest);
  expect(String(saved.khmdhsAdam || '').toUpperCase()).toBe(REAL.advisorContract);
  expect(String(saved.projectBudget || '')).toMatch(/30\.?876/);
  await closeRead(window);
});

test('P4-97 συρραφή από την αρχή με προκήρυξη σε συμβασιοποιημένο — δεν αποθηκεύει χωρίς σύμβαση', async ({ app }) => {
  const { window, testDir } = app;
  plantLegacyKhmdhsAdams(testDir, 'proj-road', 'sub-lights', {
    noticeAdam: REAL.advisorNotice,
    contractAdam: REAL.advisorContract,
  });
  await fetchAndFinish(window, 'sub-lights', REAL.tenderNotice, { stitch: 'fresh' });
  const form = window.getByTestId('edit-panel');
  await expect(form.getByText(REAL.tenderNotice).first()).toBeVisible();
  await window.getByTestId('btn-save').click();
  await expect(form).toBeVisible();
  await expect(form.getByText(/Απαιτείται ημερομηνία υπογραφής|Απαιτείται ποσό σύμβασης/).first()).toBeVisible();
  const saved = readPersisted(testDir, 'proj-road', 'sub-lights');
  expect(String(saved.khmdhsNoticeAdam || '').toUpperCase()).toBe(REAL.advisorNotice);
  expect(String(saved.khmdhsAdam || '').toUpperCase()).toBe(REAL.advisorContract);
  await discardEdit(window);
});

test('P4-98 ο προϋπολογισμός από το πρωτογενές αρκεί για αποθήκευση', async ({ app }) => {
  const { window, testDir } = app;
  await fetchAndFinish(window, 'sub-legacy', REAL.advisorContract, { skipReview: true });
  await window.getByTestId('btn-save').click();
  const keep = window.getByRole('button', { name: 'Κράτηση δεδομένων' });
  try {
    await keep.waitFor({ timeout: 2000 });
    await keep.click();
  } catch {
    /* χωρίς προειδοποίηση */
  }
  await window.getByTestId('edit-panel').waitFor({ state: 'hidden', timeout: 25000 });
  const saved = readPersisted(testDir, 'proj-old', 'sub-legacy');
  expect(String(saved.khmdhsAdam || '').toUpperCase()).toBe(REAL.advisorContract);
  expect(String(saved.khmdhsRequestAdam || '').toUpperCase()).toBe(REAL.advisorRequest);
  expect(String(saved.projectBudget || '')).toMatch(/30\.?876/);
});

test('P4-99 ολοκληρωμένο υποέργο — η ανάκτηση δεν αλλάζει την κατάσταση', async ({ app }) => {
  const { window, testDir } = app;
  writePersisted(testDir, 'proj-old', 'sub-legacy', { projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ' });
  await fetchAndFinish(window, 'sub-legacy', REAL.advisorContract);
  await saveAndOpenDetailsPhaseB(window, 'sub-legacy', {
    testDir,
    projectId: 'proj-old',
    persistPath: 'khmdhsAdam',
    persistEquals: REAL.advisorContract,
  });
  const saved = readPersisted(testDir, 'proj-old', 'sub-legacy');
  expect(saved.projectStatus).toBe('ΟΛΟΚΛΗΡΩΜΕΝΟ');
  expect(String(saved.khmdhsAdam || '').toUpperCase()).toBe(REAL.advisorContract);
  await closeRead(window);
});

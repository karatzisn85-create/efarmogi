'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { openRead, closeRead, readPersisted, discardEdit, plantLegacyKhmdhsAdams } = require('./helpers/actions.cjs');
const {
  useLiveKhmdhs,
  fetchAndFinish,
  saveAndOpenDetailsPhaseB,
  saveKhmdhsAndClose,
  openPhaseBEdit,
  applySymvPlan,
} = require('./helpers/khmdhs-flows.cjs');
const { REAL } = require('./helpers/laptop-data.cjs');

test.beforeEach(async ({ app }) => {
  test.setTimeout(360000);
  await useLiveKhmdhs(app);
});

test('P4-60 στην ωρίμανση η ανάκτηση δεν ξεκινά — σωστή πύλη', async ({ app }) => {
  const { window } = app;
  await openPhaseBEdit(window, 'sub-bridge');
  await expect(window.getByText(/διαδικασία ανάθεσης ή υπογεγραμμένη σύμβαση/)).toBeVisible();
  await expect(window.getByRole('button', { name: 'Ανάκτηση', exact: true })).toHaveCount(0);
  await discardEdit(window);
});

test('P4-61 πρώτη ανάκτηση προκήρυξης σε σύναψη — όλη η αλυσίδα και λεπτομέρειες', async ({ app }) => {
  const { window, testDir } = app;
  await fetchAndFinish(window, 'sub-legacy', REAL.tenderNotice);
  await saveAndOpenDetailsPhaseB(window, 'sub-legacy', {
    testDir,
    projectId: 'proj-old',
    persistPath: 'khmdhsNoticeAdam',
    persistEquals: REAL.tenderNotice,
  });
  const panel = window.getByTestId('read-panel');
  await expect(panel.getByText(REAL.tenderNotice).first()).toBeVisible();
  await expect(panel.getByText(REAL.tenderRequest).first()).toBeVisible();
  await expect(panel.getByText(/Καζαντζάκη|οδοποιίας/i).first()).toBeVisible();
  await expect(panel.getByText(/18\.600/).first()).toBeVisible();
  const saved = readPersisted(testDir, 'proj-old', 'sub-legacy');
  expect(String(saved.khmdhsNoticeAdam || '').toUpperCase()).toBe(REAL.tenderNotice);
  expect(String(saved.khmdhsRequestAdam || '').toUpperCase()).toBe(REAL.tenderRequest);
  expect(String(saved.projectBudget || '')).toMatch(/18\.?600/);
  expect(String(saved.khmdhsNoticeSnapshot?.title || saved.khmdhsRequestSnapshot?.title || '')).toMatch(/Καζαντζάκη|οδοποιίας/i);
  await closeRead(window);
});

test('P4-62 πρώτη ανάκτηση σύμβασης σε σύναψη — χαρακτηρισμός, πρωτογενές, λεπτομέρειες', async ({ app }) => {
  const { window, testDir } = app;
  await fetchAndFinish(window, 'sub-legacy', REAL.advisorContract);
  await saveAndOpenDetailsPhaseB(window, 'sub-legacy', {
    testDir,
    projectId: 'proj-old',
    persistPath: 'khmdhsAdam',
    persistEquals: REAL.advisorContract,
  });
  const panel = window.getByTestId('read-panel');
  await expect(panel.getByText(REAL.advisorContract).first()).toBeVisible();
  await expect(panel.getByText(REAL.advisorRequest).first()).toBeVisible();
  await expect(panel.getByText(/ΙΝΙΤΙΑ|ΔηΣΜΕ|μείωσης εκπομπών|σύμβουλος/i).first()).toBeVisible();
  await expect(panel.getByText(/30\.876/).first()).toBeVisible();
  const saved = readPersisted(testDir, 'proj-old', 'sub-legacy');
  expect(String(saved.khmdhsAdam || '').toUpperCase()).toBe(REAL.advisorContract);
  expect(String(saved.khmdhsRequestAdam || '').toUpperCase()).toBe(REAL.advisorRequest);
  expect(String(saved.projectBudget || '')).toMatch(/30\.?876/);
  expect(String(
    saved.khmdhsContractSnapshot?.anadoxosName
    || saved.khmdhsContractSnapshot?.title
    || ''
  )).toMatch(/ΙΝΙΤΙΑ|σύμβουλος|ΔηΣΜΕ/i);
  await expect(panel.getByText(/ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ|ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ/)).toBeVisible();
  await closeRead(window);
});

test('P4-63 δύο συμβάσεις από πραγματικό πρωτογενές — κατανομή και κάρτα', async ({ app }) => {
  const { window, testDir } = app;
  await fetchAndFinish(window, 'sub-legacy', REAL.asphaltRequest, { plan: ['main', 'skip'] });
  await saveAndOpenDetailsPhaseB(window, 'sub-legacy', {
    testDir,
    projectId: 'proj-old',
    persistPath: 'khmdhsRequestAdam',
    persistEquals: REAL.asphaltRequest,
  });
  const panel = window.getByTestId('read-panel');
  await expect(panel.getByText(new RegExp(REAL.asphaltContracts.join('|'))).first()).toBeVisible();
  const saved = readPersisted(testDir, 'proj-old', 'sub-legacy');
  const adams = [
    saved.khmdhsAdam,
    ...(saved.contracts || []).map((c) => c.khmdhsAdam),
  ].map((x) => String(x || '').toUpperCase());
  expect(adams.some((a) => REAL.asphaltContracts.includes(a))).toBeTruthy();
  expect(String(saved.khmdhsRequestAdam || '').toUpperCase()).toBe(REAL.asphaltRequest);
  await closeRead(window);
});

test('P4-64 νέος πραγματικός ΑΔΑΜ σε υπάρχουσα πραγματική αλυσίδα — διατήρηση', async ({ app }) => {
  const { window, testDir } = app;
  plantLegacyKhmdhsAdams(testDir, 'proj-road', 'sub-lights', {
    noticeAdam: REAL.advisorNotice,
    contractAdam: REAL.advisorContract,
  });
  await fetchAndFinish(window, 'sub-lights', REAL.tenderNotice, { stitch: 'keep' });
  await saveAndOpenDetailsPhaseB(window, 'sub-lights', {
    testDir,
    projectId: 'proj-road',
    persistPath: 'khmdhsAdam',
    persistEquals: REAL.advisorContract,
  });
  const panel = window.getByTestId('read-panel');
  await expect(panel.getByText(REAL.advisorContract).first()).toBeVisible();
  const saved = readPersisted(testDir, 'proj-road', 'sub-lights');
  expect(String(saved.khmdhsAdam || '').toUpperCase()).toBe(REAL.advisorContract);
  await closeRead(window);
});

test('P4-65 ανανέωση κάρτας μετά από κανονική ανάκτηση — ίδια στοιχεία', async ({ app }) => {
  const { window, testDir } = app;
  await fetchAndFinish(window, 'sub-legacy', REAL.tenderNotice);
  await saveAndOpenDetailsPhaseB(window, 'sub-legacy', {
    testDir,
    projectId: 'proj-old',
    persistPath: 'khmdhsNoticeAdam',
    persistEquals: REAL.tenderNotice,
  });
  await window.getByTestId('btn-khmdhs-refresh').click();
  await expect(window.getByText(/Επιβεβαίωση ανανέωσης ΚΗΜΔΗΣ|Κατανομή εγγραφών SYMV/)).toBeVisible({ timeout: 90000 });
  if (await window.getByText('Κατανομή εγγραφών SYMV').count()) {
    await applySymvPlan(window);
    await expect(window.getByText('Επιβεβαίωση ανανέωσης ΚΗΜΔΗΣ')).toBeVisible({ timeout: 40000 });
  }
  await window.getByRole('button', { name: /Εφαρμογή & αποθήκευση/ }).click();
  await expect(window.getByTestId('read-panel')).toBeVisible({ timeout: 25000 });
  await window.getByRole('button', { name: /Β — ΚΗΜΔΗΣ/ }).click();
  const panel = window.getByTestId('read-panel');
  await expect(panel.getByText(REAL.tenderNotice).first()).toBeVisible();
  await expect(panel.getByText(REAL.tenderRequest).first()).toBeVisible();
  await expect(panel.getByText(/18\.600/).first()).toBeVisible();
  await closeRead(window);
});

test('P4-66 ίδια σύμβαση σε δεύτερο υποέργο — συνέχεια και λεπτομέρειες', async ({ app }) => {
  const { window, testDir } = app;
  await fetchAndFinish(window, 'sub-legacy', REAL.advisorContract);
  await saveKhmdhsAndClose(window, {
    testDir,
    projectId: 'proj-old',
    subId: 'sub-legacy',
    persistPath: 'khmdhsAdam',
    persistEquals: REAL.advisorContract,
  });
  await fetchAndFinish(window, 'sub-lights', REAL.advisorContract, {
    allowDuplicate: true,
    stitch: 'fresh',
  });
  await saveAndOpenDetailsPhaseB(window, 'sub-lights', {
    testDir,
    projectId: 'proj-road',
    persistPath: 'khmdhsAdam',
    persistEquals: REAL.advisorContract,
  });
  const panel = window.getByTestId('read-panel');
  await expect(panel.getByText(REAL.advisorContract).first()).toBeVisible();
  await expect(panel.getByText(/ΙΝΙΤΙΑ|ΔηΣΜΕ|σύμβουλος/i).first()).toBeVisible();
  const saved = readPersisted(testDir, 'proj-road', 'sub-lights');
  expect(String(saved.khmdhsAdam || '').toUpperCase()).toBe(REAL.advisorContract);
  expect(String(saved.khmdhsRequestAdam || '').toUpperCase()).toBe(REAL.advisorRequest);
  await closeRead(window);
});

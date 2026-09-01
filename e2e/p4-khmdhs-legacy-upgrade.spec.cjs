'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const {
  closeRead,
  readPersisted,
  plantLegacyKhmdhsAdams,
  discardEdit,
  openPhaseBEdit,
} = require('./helpers/actions.cjs');
const {
  useLiveKhmdhs,
  upgradeLegacyAndFinish,
  saveAndOpenDetailsPhaseB,
} = require('./helpers/khmdhs-flows.cjs');
const { REAL } = require('./helpers/laptop-data.cjs');

test('P4-80 παλιά κάρτα δείχνει αναβάθμιση αλυσίδας ΚΗΜΔΗΣ', async ({ app }) => {
  const { window } = app;
  await openPhaseBEdit(window, 'sub-lights');
  await expect(window.getByText(/Αναβάθμιση από παλιά μορφή/)).toBeVisible();
  await expect(window.getByRole('button', { name: 'Ανάκτηση από ΚΗΜΔΗΣ' })).toBeVisible();
  await discardEdit(window);
});

test('P4-81 αναβάθμιση παλιάς κάρτας με πραγματικό ΑΔΑΜ — ανάκτηση, χαρακτηρισμοί, λεπτομέρειες', async ({ app }) => {
  test.setTimeout(360000);
  const { window, testDir } = app;
  await useLiveKhmdhs(app);
  plantLegacyKhmdhsAdams(testDir, 'proj-road', 'sub-lights', {
    noticeAdam: REAL.advisorNotice,
    contractAdam: REAL.advisorContract,
  });
  await upgradeLegacyAndFinish(window, 'sub-lights', {
    seedAdam: REAL.advisorNotice,
  });
  await saveAndOpenDetailsPhaseB(window, 'sub-lights', {
    testDir,
    projectId: 'proj-road',
    persistPath: 'khmdhsAdam',
    persistEquals: REAL.advisorContract,
  });
  const panel = window.getByTestId('read-panel');
  await expect(panel.getByText(REAL.advisorNotice).first()).toBeVisible();
  await expect(panel.getByText(REAL.advisorContract).first()).toBeVisible();
  await expect(panel.getByText(REAL.advisorRequest).first()).toBeVisible();
  await expect(panel.getByText(/ΙΝΙΤΙΑ|ΔηΣΜΕ|μείωσης εκπομπών|σύμβουλος/i).first()).toBeVisible();
  await expect(panel.getByText(/30\.876/).first()).toBeVisible();
  const saved = readPersisted(testDir, 'proj-road', 'sub-lights');
  expect(String(saved.khmdhsNoticeAdam || '').toUpperCase()).toBe(REAL.advisorNotice);
  expect(String(saved.khmdhsAdam || '').toUpperCase()).toBe(REAL.advisorContract);
  expect(String(saved.khmdhsRequestAdam || '').toUpperCase()).toBe(REAL.advisorRequest);
  expect(String(saved.projectBudget || '')).toMatch(/30\.?876/);
  expect(String(
    saved.khmdhsContractSnapshot?.anadoxosName
    || saved.khmdhsContractSnapshot?.title
    || ''
  )).toMatch(/ΙΝΙΤΙΑ|σύμβουλος|ΔηΣΜΕ/i);
  expect(saved.khmdhsAdamChainMeta?.resolvedAt).toBeTruthy();
  await closeRead(window);
});

test('P4-82 ψεύτικος ΑΔΑΜ στην αναβάθμιση — η εφαρμογή το αναφέρει', async ({ app }) => {
  test.setTimeout(180000);
  const { window } = app;
  await useLiveKhmdhs(app);
  await openPhaseBEdit(window, 'sub-lights');
  await expect(window.getByText(/Αναβάθμιση από παλιά μορφή/)).toBeVisible();
  await window.getByRole('button', { name: 'Ανάκτηση από ΚΗΜΔΗΣ' }).click();
  await expect(window.getByText(
    /δεν βρέθηκε|απέτυχε|ανοικτά δεδομένα|Μη έγκυρος|δεν είναι ακόμα διαθέσιμος/i
  ).first()).toBeVisible({ timeout: 120000 });
  await discardEdit(window);
});

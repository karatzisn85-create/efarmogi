'use strict';

const {
  openRead,
  closeRead,
  openPhaseBEdit,
  runKhmdhsAdamFetch,
  readPersisted,
  dismissKhmdhsDialogs,
} = require('./actions.cjs');

async function pause(window, ms = 350) {
  await window.waitForTimeout(ms);
}

async function visible(locator) {
  return (await locator.count()) > 0 && locator.first().isVisible().catch(() => false);
}

async function clickIf(locator) {
  if (!(await visible(locator))) return false;
  await locator.first().click({ timeout: 8000 }).catch(() => locator.first().click({ force: true }));
  return true;
}

async function useLiveKhmdhs(app) {
  await app.queueKhmdhsFixtures({});
  await app.setKhmdhsLive(true);
}

function reviewModal(window) {
  return window.locator('[data-khmdhs-review-modal]');
}

async function reviewIsOpen(window) {
  return (await reviewModal(window).count()) > 0;
}

async function fillCurrentReviewField(window) {
  const modal = reviewModal(window);
  if (!(await modal.count())) return false;

  const kind = modal.getByLabel('Είδος εγγράφου');
  if (await kind.count()) {
    const current = await kind.first().inputValue().catch(() => '');
    if (!current) {
      await kind.first().selectOption('contract').catch(async () => {
        await kind.first().selectOption({ label: /Αρχική σύμβαση/ });
      });
    }
    const deadline = modal.locator('input[type="date"]').first();
    if (await deadline.count()) {
      const v = await deadline.inputValue().catch(() => '');
      if (!v) await deadline.fill('2026-12-31');
    }
    const saveKind = modal.getByRole('button', { name: /Αποθήκευση χαρακτηρισμού|Συμπλήρωση στοιχείων/ });
    if (await saveKind.count() && !(await saveKind.first().isDisabled().catch(() => true))) {
      await saveKind.first().click();
      await pause(window, 450);
      return true;
    }
  }

  const assignment = modal.locator('select').filter({ has: window.locator('option', { hasText: 'ΑΝΟΙΚΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ' }) });
  if (await assignment.count()) {
    const v = await assignment.first().inputValue().catch(() => '');
    if (!v) await assignment.first().selectOption('ΑΝΟΙΚΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ');
  }

  const dateInput = modal.locator('input[type="date"]').first();
  if (await dateInput.count()) {
    const v = await dateInput.inputValue().catch(() => '');
    if (!v) await dateInput.fill('2026-01-15');
  }

  const applySuggest = modal.getByRole('button', { name: /Χρήση πρότασης ΚΗΜΔΗΣ|Πρόταση/ });
  if (await applySuggest.count()) {
    await applySuggest.first().click();
    await pause(window, 300);
  }

  const saveValue = modal.getByRole('button', { name: 'Αποθήκευση τιμής' });
  if (await saveValue.count() && !(await saveValue.first().isDisabled().catch(() => true))) {
    await saveValue.first().click();
    await pause(window, 450);
    return true;
  }

  const confirm = modal.getByRole('button', { name: /^Επιβεβαίωση$/ });
  if (await confirm.count() && !(await confirm.first().isDisabled().catch(() => true))) {
    await confirm.first().click();
    await pause(window, 450);
    return true;
  }

  const savePay = modal.getByRole('button', { name: /Αποθήκευση χαρακτηρισμ/ });
  if (await savePay.count() && !(await savePay.first().isDisabled().catch(() => true))) {
    await savePay.first().click();
    await pause(window, 450);
    return true;
  }

  const ack = modal.getByRole('button', { name: /Εντάξει — ελέγχθηκαν|Ελέγχθηκαν τα εντάλματα/ });
  if (await ack.count()) {
    await ack.first().click();
    await pause(window, 450);
    return true;
  }

  return false;
}

async function completeDataReview(window) {
  for (let step = 0; step < 20; step += 1) {
    if (!(await reviewIsOpen(window))) return;

    const applyAll = window.getByRole('button', { name: /Εφαρμογή όλων των προτάσεων/ });
    if (await applyAll.count()) {
      await applyAll.first().click();
      await pause(window, 500);
    }

    const done = window.getByRole('button', { name: 'Ολοκλήρωση ελέγχου' });
    if (await done.count()) {
      await done.click();
      await pause(window, 400);
      return;
    }

    if (await fillCurrentReviewField(window)) continue;

    const next = reviewModal(window).getByRole('button', { name: '→' });
    if (await next.count() && !(await next.isDisabled().catch(() => true))) {
      await next.click();
      await pause(window, 300);
      continue;
    }
  }

  if (await reviewIsOpen(window)) {
    const done = window.getByRole('button', { name: 'Ολοκλήρωση ελέγχου' });
    if (await done.count()) {
      await done.click();
      await pause(window, 400);
    }
  }
}

async function completeDocumentRegistry(window, { accept = true } = {}) {
  const modal = window.locator('[data-khmdhs-document-registry-modal]');
  if (!(await modal.count())) return false;
  if (accept) {
    const record = modal.getByRole('button', { name: /Καταγραφή/ });
    if (await record.count() && !(await record.first().isDisabled().catch(() => true))) {
      await record.first().click();
      await pause(window, 500);
      return true;
    }
  }
  const skip = modal.getByRole('button', { name: 'Όχι τώρα' });
  if (await skip.count()) {
    await skip.first().click();
    await pause(window, 400);
    return true;
  }
  return false;
}

function symvPlannerDialog(window) {
  return window.locator('[data-khmdhs-symv-planner-modal]').filter({
    has: window.getByRole('button', { name: 'Εφαρμογή κατανομής' }),
  });
}

async function setSymvPlanRoles(window, roles) {
  const modal = symvPlannerDialog(window);
  await modal.waitFor({ timeout: 20000 });
  const selects = modal.getByLabel(/Ρόλος για/);
  const n = await selects.count();
  const plan = Array.isArray(roles) && roles.length
    ? roles
    : ['main', ...Array.from({ length: Math.max(0, n - 1) }, () => 'skip')];
  for (let i = 0; i < n; i += 1) {
    await selects.nth(i).selectOption(plan[i] || 'skip');
  }
  const dates = modal.locator('input[type="date"]');
  const dateCount = await dates.count();
  for (let i = 0; i < dateCount; i += 1) {
    const v = await dates.nth(i).inputValue().catch(() => '');
    if (!v) await dates.nth(i).fill('2026-05-26');
  }
  return modal;
}

async function applySymvPlan(window, roles) {
  const modal = await setSymvPlanRoles(window, roles);
  await modal.getByRole('button', { name: 'Εφαρμογή κατανομής' }).click();
  await modal.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
  await pause(window, 400);
}

async function completeKhmdhsAfterFetch(window, {
  allowDuplicate = false,
  stitch = 'keep',
  acceptRegistry = true,
  plan,
  leavePlannerOpen = false,
  skipReview = false,
} = {}) {
  for (let i = 0; i < 24; i += 1) {
    if (await completeDocumentRegistry(window, { accept: acceptRegistry })) {
      continue;
    }
    if (await window.getByRole('heading', { name: 'Υπάρχουν ήδη δεδομένα ΚΗΜΔΗΣ' }).count()) {
      if (stitch === 'fresh') {
        await window.getByRole('button', { name: /Από την αρχή/ }).click();
      } else {
        await window.getByRole('button', { name: /Διατήρηση/ }).click();
      }
      await pause(window, 800);
      continue;
    }
    if (await window.getByRole('heading', { name: 'Ίδια σύνδεση ΚΗΜΔΗΣ σε άλλο υποέργο' }).count()) {
      if (allowDuplicate) {
        await window.getByRole('button', { name: /Συνέχεια ούτως ή άλλως/ }).click();
      } else {
        await window.getByRole('button', { name: 'Ακύρωση' }).last().click();
        return;
      }
      await pause(window, 800);
      continue;
    }
    if (await window.getByText('Κατανομή εγγραφών SYMV').count()) {
      if (leavePlannerOpen) break;
      await applySymvPlan(window, plan);
      continue;
    }
    if (await window.getByRole('heading', { name: /Ποιο τμήμα αφορά/ }).count()) {
      await window.getByRole('button', { name: 'Επιβεβαίωση κλάδου' }).click();
      await pause(window, 800);
      continue;
    }
    const pending = window.locator('[data-khmdhs-pending-tasks-modal]');
    if (await pending.count()) {
      if (skipReview) {
        if (await clickIf(pending.getByRole('button', { name: /θα συνεχίσω αργότερα|Επιστροφή στη φόρμα/ }))) {
          break;
        }
      }
      if (await clickIf(pending.getByRole('button', { name: 'Άνοιγμα ελέγχου' }))) {
        await pause(window, 500);
        await completeDataReview(window);
        continue;
      }
      if (await clickIf(pending.getByRole('button', { name: /Ναι, να θυμάται/ }))) {
        await pause(window, 400);
        continue;
      }
      if (await clickIf(pending.getByRole('button', { name: 'Παράλειψη' }))) {
        await pause(window, 400);
        continue;
      }
      if (await clickIf(pending.getByRole('button', { name: 'Διατήρηση τρέχοντος' }))) {
        await pause(window, 400);
        continue;
      }
      if (await clickIf(pending.getByRole('button', { name: 'Όχι τώρα' }))) {
        await pause(window, 400);
        continue;
      }
      if (await clickIf(pending.getByRole('button', { name: 'Το είδα' }))) {
        await pause(window, 400);
        continue;
      }
      if (await clickIf(pending.getByRole('button', { name: 'Επιστροφή στη φόρμα' }))) {
        await pause(window, 400);
        break;
      }
      if (await clickIf(pending.getByRole('button', { name: /θα συνεχίσω αργότερα/ }))) {
        await pause(window, 400);
        break;
      }
    }
    if (skipReview) {
      if (await clickIf(window.getByRole('button', { name: /θα συνεχίσω αργότερα|Θα το ελέγξω αργότερα/ }))) {
        break;
      }
    } else if (await clickIf(window.getByRole('button', { name: /ΕΛΕΓΧΟΣ/ }))) {
      await pause(window, 400);
      await completeDataReview(window);
      continue;
    } else if (await reviewIsOpen(window) || await window.getByLabel('Είδος εγγράφου').count()) {
      await completeDataReview(window);
      continue;
    }
    const situation = window.locator('[data-khmdhs-situation-modal]');
    if (await situation.count()) {
      const act = situation.getByRole('button', { name: /Κράτησ|Συνέχεια|Εφαρμογ|Το είδα|Παράλειψη|Αποδοχή/ });
      if (await act.count()) await act.first().click();
      else await situation.getByRole('button', { name: 'Κλείσιμο' }).click({ force: true });
      await pause(window, 500);
      continue;
    }
    break;
  }
}

function khmdhsFetchOutcome(window) {
  return window.getByText(
    /Ανακτήθηκαν από ΚΗΜΔΗΣ|Εκκρεμότητες μετά|Κατανομή εγγραφών|Υπάρχουν ήδη δεδομένα|Ίδια σύνδεση|Τι συνέβη|ενημερώθηκε αυτόματα|Έλεγχος & συμπλήρωση|Καταγραφή εγγράφων|δεν βρέθηκε|απέτυχε|ανοικτά δεδομένα|δεν είναι ακόμα διαθέσιμος|Η ανάκτηση από το ΚΗΜΔΗΣ/i
  ).or(window.locator('[data-khmdhs-document-registry-modal]'))
    .or(window.locator('[data-khmdhs-pending-tasks-modal]'))
    .or(window.locator('[data-khmdhs-review-modal]'))
    .or(window.locator('[data-khmdhs-situation-modal]'))
    .or(window.locator('[data-khmdhs-symv-planner-modal]').filter({
      has: window.getByRole('button', { name: 'Εφαρμογή κατανομής' }),
    }));
}

/** Περιμένει μόνο μέχρι να φανεί αποτέλεσμα — σταματά αμέσως, δεν καίει όλο το όριο. */
async function waitForKhmdhsFetchOutcome(window, adam) {
  const outcome = khmdhsFetchOutcome(window);
  try {
    await outcome.first().waitFor({ state: 'visible', timeout: 180000 });
  } catch {
    throw new Error(`Η ανάκτηση από ΚΗΜΔΗΣ για ${adam} δεν έδειξε αποτέλεσμα στην οθόνη.`);
  }
}

async function fetchAndFinish(window, subId, adam, opts = {}) {
  await openPhaseBEdit(window, subId);
  await runKhmdhsAdamFetch(window, adam);
  await waitForKhmdhsFetchOutcome(window, adam);
  await completeKhmdhsAfterFetch(window, opts);
}

async function upgradeLegacyAndFinish(window, subId, opts = {}) {
  await openPhaseBEdit(window, subId);
  const banner = window.getByText(/Αναβάθμιση από παλιά μορφή/);
  await banner.waitFor({ timeout: 15000 });
  await window.getByRole('button', { name: 'Ανάκτηση από ΚΗΜΔΗΣ' }).click();
  await waitForKhmdhsFetchOutcome(window, opts.seedAdam || '');
  await completeKhmdhsAfterFetch(window, { stitch: 'keep', ...opts });
}

function readNested(obj, path) {
  return String(path).split('.').reduce((cur, key) => (cur == null ? cur : cur[key]), obj);
}

async function openReviewFromBanner(window) {
  const openBtn = window.getByRole('button', { name: /Άνοιγμα ελέγχου/ });
  if (await openBtn.count()) {
    await openBtn.first().click();
    await pause(window, 400);
    await completeDataReview(window);
    return true;
  }
  return false;
}

function persistMatches(saved, persistPath, persistEquals) {
  const value = persistPath ? readNested(saved, persistPath) : null;
  if (persistEquals) {
    return String(value || '').toUpperCase() === String(persistEquals).toUpperCase();
  }
  return persistPath ? !!value : true;
}

async function saveKhmdhsAndClose(window, { testDir, projectId, subId, persistPath, persistEquals }) {
  await completeKhmdhsAfterFetch(window);
  await openReviewFromBanner(window);
  await completeDocumentRegistry(window);
  await window.getByTestId('btn-save').click();
  const keep = window.getByRole('button', { name: 'Κράτηση δεδομένων' });
  try {
    await keep.waitFor({ timeout: 2000 });
    await keep.click();
  } catch {
    /* χωρίς προειδοποίηση */
  }

  if (await reviewIsOpen(window)) {
    await completeDataReview(window);
    if (await window.getByTestId('btn-save').count()) {
      await window.getByTestId('btn-save').click();
    }
  }

  const deadline = Date.now() + 25000;
  let saved = null;
  while (Date.now() < deadline) {
    saved = readPersisted(testDir, projectId, subId);
    if (persistMatches(saved, persistPath, persistEquals)) break;
    if (await reviewIsOpen(window)) {
      await completeDataReview(window);
      if (await window.getByTestId('btn-save').count()) {
        await window.getByTestId('btn-save').click();
      }
    }
    await pause(window, 400);
  }
  if ((persistPath || persistEquals) && !persistMatches(saved, persistPath, persistEquals)) {
    const hints = await window.getByTestId('edit-panel').locator('text=/Απαιτείται|σφάλμα|Μη έγκυρ/i').allTextContents().catch(() => []);
    const got = persistPath ? readNested(saved, persistPath) : '';
    throw new Error(`Η αποθήκευση δεν κράτησε το ${persistPath} (τιμή: ${got || 'κενό'}). ${hints.join(' | ')}`);
  }
  if (await window.getByTestId('edit-panel').count()) {
    await dismissKhmdhsDialogs(window);
    await completeDataReview(window);
    await window.getByTestId('btn-discard').click({ force: true });
    const confirm = window.getByTestId('unsaved-discard');
    try {
      await confirm.waitFor({ timeout: 1500 });
      await confirm.click();
    } catch {
      /* καθαρή φόρμα */
    }
    await window.getByTestId('edit-panel').waitFor({ state: 'hidden', timeout: 20000 });
  }
  return saved;
}

async function saveAndOpenDetailsPhaseB(window, subId, persist = {}) {
  await saveKhmdhsAndClose(window, { subId, ...persist });
  await openRead(window, subId);
  await window.getByRole('button', { name: /Β — ΚΗΜΔΗΣ/ }).click();
}

async function expectDetailsShow(window, patterns) {
  const panel = window.getByTestId('read-panel');
  await panel.waitFor({ timeout: 15000 });
  for (const pattern of patterns) {
    await panel.getByText(pattern).first().waitFor({ timeout: 15000 });
  }
}

module.exports = {
  useLiveKhmdhs,
  completeKhmdhsAfterFetch,
  completeDataReview,
  completeDocumentRegistry,
  applySymvPlan,
  setSymvPlanRoles,
  fetchAndFinish,
  upgradeLegacyAndFinish,
  saveKhmdhsAndClose,
  saveAndOpenDetailsPhaseB,
  expectDetailsShow,
  openPhaseBEdit,
  closeRead,
  waitForKhmdhsFetchOutcome,
};

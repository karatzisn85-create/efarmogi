'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  card,
  enterEdit,
  setPrimaryCharge,
  setOutsideCharge,
  saveEdit,
  discardEdit,
  search,
  setRole,
  readPersisted,
} = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P0-01 αλλαγή χρέωσης από κατάλογο — η κάρτα δείχνει τον νέο, τα ids μένουν ίδια', async ({ page }) => {
  await expect(card(page, 'sub-bridge').locator('[data-field="charge"]')).toHaveText('Μαρία Παπαδοπούλου');
  await enterEdit(page, 'sub-bridge');
  const projectId = await page.locator('[data-testid="edit-project-id"]').innerText();
  const subprojectId = await page.locator('[data-testid="edit-subproject-id"]').innerText();
  await setPrimaryCharge(page, 'user:nikos');
  await saveEdit(page);
  await expect(card(page, 'sub-bridge').locator('[data-field="charge"]')).toHaveText('Νίκος Γεωργίου');
  const saved = await readPersisted(page);
  expect(saved.projectId).toBe(projectId);
  expect(saved.subprojectId).toBe(subprojectId);
  expect(saved.supervisorEngineerIds).toEqual(['user:nikos']);
  expect(saved.supervisor).toBeUndefined();
});

test('P0-02 χρέωση εκτός καταλόγου — η κάρτα δείχνει το ελεύθερο κείμενο', async ({ page }) => {
  await enterEdit(page, 'sub-bridge');
  await setOutsideCharge(page, 'Διεύθυνση Τεχνικών Υπηρεσιών');
  await saveEdit(page);
  await expect(card(page, 'sub-bridge').locator('[data-field="charge"]')).toHaveText('Διεύθυνση Τεχνικών Υπηρεσιών');
  const saved = await readPersisted(page);
  expect(saved.supervisorEngineerIds).toEqual([]);
  expect(saved.supervisorChargeOutsideEngineers).toBe(true);
  expect(saved.supervisorChargeFreePrimary).toBe('Διεύθυνση Τεχνικών Υπηρεσιών');
});

test('P0-03 απόρριψη μη αποθηκευμένης αλλαγής χρέωσης — μένει η παλιά', async ({ page }) => {
  await enterEdit(page, 'sub-bridge');
  await setPrimaryCharge(page, 'user:elena');
  await expect(page.locator('[data-testid="unsaved-hint"]')).toBeVisible();
  await discardEdit(page);
  await expect(card(page, 'sub-bridge').locator('[data-field="charge"]')).toHaveText('Μαρία Παπαδοπούλου');
});

test('P0-04 αλλαγή τίτλου και ΚΑ — τα ids ίδια, αναζήτηση μόνο με τα νέα στοιχεία', async ({ page }) => {
  await enterEdit(page, 'sub-bridge');
  const projectId = await page.locator('[data-testid="edit-project-id"]').innerText();
  const subprojectId = await page.locator('[data-testid="edit-subproject-id"]').innerText();
  await page.locator('[data-testid="edit-project-title"]').fill('Νέο οδικό δίκτυο');
  await page.locator('[data-testid="edit-ka"]').fill('ΚΑ-999');
  await saveEdit(page);
  const saved = await readPersisted(page);
  expect(saved.projectId).toBe(projectId);
  expect(saved.subprojectId).toBe(subprojectId);
  expect(saved.projectTitle).toBe('Νέο οδικό δίκτυο');
  expect(saved.kaCode).toBe('ΚΑ-999');
  await search(page, 'Νέο οδικό');
  await expect(card(page, 'sub-bridge')).toBeVisible();
  await search(page, 'Οδικό δίκτυο Αρχανών');
  await expect(card(page, 'sub-bridge')).toHaveCount(0);
});

test('P0-05 παλιά εγγραφή μόνο με επιβλέποντα — η κάρτα τον δείχνει και η αποθήκευση δεν χάνει το όνομα', async ({ page }) => {
  await expect(card(page, 'sub-legacy').locator('[data-field="charge"]')).toHaveText('Παλιός Επιβλέπων');
  await enterEdit(page, 'sub-legacy');
  await saveEdit(page);
  await expect(card(page, 'sub-legacy').locator('[data-field="charge"]')).toHaveText('Παλιός Επιβλέπων');
  const saved = await readPersisted(page);
  expect(saved.supervisor).toBeUndefined();
  expect(saved.supervisorChargeFreePrimary).toBe('Παλιός Επιβλέπων');
  expect(saved.supervisorChargeOutsideEngineers).toBe(true);
});

test('P0-06 μηχανικός βλέπει μόνο τα υποέργα που του είναι χρεωμένα', async ({ page }) => {
  await setRole(page, 'ENGINEER');
  await expect(card(page, 'sub-bridge')).toBeVisible();
  await expect(card(page, 'sub-lights')).toBeVisible();
  await expect(card(page, 'sub-tank')).toHaveCount(0);
  await expect(card(page, 'sub-legacy')).toHaveCount(0);
});

test('P0-07 δεύτερη αλλαγή χρέωσης — φαίνεται ο τελευταίος, τα ids ίδια', async ({ page }) => {
  await enterEdit(page, 'sub-bridge');
  const projectId = await page.locator('[data-testid="edit-project-id"]').innerText();
  await setPrimaryCharge(page, 'user:nikos');
  await saveEdit(page);
  await setPrimaryCharge(page, 'user:elena');
  await saveEdit(page);
  await expect(card(page, 'sub-bridge').locator('[data-field="charge"]')).toHaveText('Ελένη Αντωνίου');
  const saved = await readPersisted(page);
  expect(saved.projectId).toBe(projectId);
  expect(saved.subprojectId).toBe('sub-bridge');
  expect(saved.supervisorEngineerIds).toEqual(['user:elena']);
});

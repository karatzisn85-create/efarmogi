'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  setRole,
  openUsers,
  userCard,
  userPending,
  openNewUser,
  fillNewUser,
  submitNewUser,
  approveUser,
  requestUserDelete,
  confirmWorkflowDelete,
} = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P2-09 διαχείριση χρηστών μόνο στον υπερδιαχειριστή', async ({ page }) => {
  await expect(page.locator('[data-testid="btn-users"]')).toBeHidden();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-users"]')).toBeHidden();
  await setRole(page, 'USER');
  await expect(page.locator('[data-testid="btn-users"]')).toBeHidden();
  await setRole(page, 'SUPERADMIN');
  await expect(page.locator('[data-testid="btn-users"]')).toBeVisible();
});

test('P2-10 κενή φόρμα νέου χρήστη δεν αποθηκεύει', async ({ page }) => {
  await setRole(page, 'SUPERADMIN');
  await openUsers(page);
  await openNewUser(page);
  await submitNewUser(page);
  await expect(page.locator('[data-testid="user-create-error"]')).toBeVisible();
  await expect(page.locator('[data-testid="user-create-error"]')).toHaveText('Εισάγετε όνομα χρήστη');
  await expect(page.locator('[data-testid="user-create-panel"]')).toBeVisible();
  await expect(userPending(page, 'giorgos')).toHaveCount(0);
});

test('P2-11 νέος χρήστης εμφανίζεται στα αιτήματα, όχι στους ενεργούς', async ({ page }) => {
  await setRole(page, 'SUPERADMIN');
  await openUsers(page);
  await openNewUser(page);
  await fillNewUser(page, {
    username: 'giorgos',
    fullName: 'Γιώργος Νικολάου',
    code: 'secret123',
    role: 'USER',
  });
  await submitNewUser(page);
  await expect(page.locator('[data-testid="user-create-panel"]')).toBeHidden();
  await expect(userPending(page, 'giorgos')).toBeVisible();
  await expect(userPending(page, 'giorgos')).toContainText('Γιώργος Νικολάου');
  await expect(userCard(page, 'giorgos')).toHaveCount(0);
});

test('P2-12 έγκριση μεταφέρει τον χρήστη στους ενεργούς', async ({ page }) => {
  await setRole(page, 'SUPERADMIN');
  await openUsers(page);
  await expect(userPending(page, 'pending')).toBeVisible();
  await approveUser(page, 'pending');
  await expect(userPending(page, 'pending')).toHaveCount(0);
  await expect(userCard(page, 'pending')).toBeVisible();
});

test('P2-13 διαγραφή άλλου χρήστη με επιβεβαίωση τον αφαιρεί', async ({ page }) => {
  await setRole(page, 'SUPERADMIN');
  await openUsers(page);
  await expect(userCard(page, 'admin')).toBeVisible();
  await requestUserDelete(page, 'admin');
  await expect(page.locator('[data-testid="workflow-delete-title"]')).toHaveText('Διαγραφή Χρήστη');
  await confirmWorkflowDelete(page);
  await expect(userCard(page, 'admin')).toHaveCount(0);
  await expect(userCard(page, 'superadmin')).toBeVisible();
  await expect(userCard(page, 'superadmin').locator('[data-testid="user-delete-superadmin"]')).toHaveCount(0);
});

test('P2-14 ίδιο όνομα χρήστη δεν ξαναδημιουργείται', async ({ page }) => {
  await setRole(page, 'SUPERADMIN');
  await openUsers(page);
  await openNewUser(page);
  await fillNewUser(page, {
    username: 'Admin',
    code: 'secret123',
    role: 'USER',
  });
  await submitNewUser(page);
  await expect(page.locator('[data-testid="user-create-error"]')).toHaveText('Το όνομα χρήστη υπάρχει ήδη');
  await expect(page.locator('[data-testid="user-create-panel"]')).toBeVisible();
});

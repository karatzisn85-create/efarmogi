'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  setRole,
  openAudit,
  auditLog,
  setAuditEntity,
  setAuditAction,
  requestAuditClear,
  confirmWorkflowDelete,
} = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P2-15 ιστορικό ενεργειών όχι στον απλό χρήστη', async ({ page }) => {
  await expect(page.locator('[data-testid="btn-audit"]')).toBeVisible();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-audit"]')).toBeVisible();
  await setRole(page, 'SUPERADMIN');
  await expect(page.locator('[data-testid="btn-audit"]')).toBeVisible();
  await setRole(page, 'USER');
  await expect(page.locator('[data-testid="btn-audit"]')).toBeHidden();
});

test('P2-16 υπερδιαχειριστής βλέπει όλες τις πραγματικές καταγραφές', async ({ page }) => {
  await setRole(page, 'SUPERADMIN');
  await openAudit(page);
  await expect(auditLog(page, 'aud-create-bridge')).toBeVisible();
  await expect(auditLog(page, 'aud-update-tank')).toBeVisible();
  await expect(auditLog(page, 'aud-delete-user')).toBeVisible();
  await expect(auditLog(page, 'aud-old-psk')).toBeVisible();
  await expect(page.locator('[data-testid="audit-stat-total"]')).toHaveText('4');
});

test('P2-17 μηχανικός βλέπει μόνο τις δικές του ενέργειες', async ({ page }) => {
  await setRole(page, 'ENGINEER');
  await openAudit(page);
  await expect(auditLog(page, 'aud-update-tank')).toBeVisible();
  await expect(auditLog(page, 'aud-update-tank')).toContainText('Μαρία Παπαδοπούλου');
  await expect(auditLog(page, 'aud-create-bridge')).toHaveCount(0);
  await expect(auditLog(page, 'aud-delete-user')).toHaveCount(0);
  await expect(auditLog(page, 'aud-old-psk')).toHaveCount(0);
});

test('P2-18 διαχειριστής βλέπει μόνο ενέργειες διαχειριστή ή χωρίς ρόλο', async ({ page }) => {
  await openAudit(page);
  await expect(auditLog(page, 'aud-create-bridge')).toBeVisible();
  await expect(auditLog(page, 'aud-old-psk')).toBeVisible();
  await expect(auditLog(page, 'aud-update-tank')).toHaveCount(0);
  await expect(auditLog(page, 'aud-delete-user')).toHaveCount(0);
});

test('P2-19 φίλτρο τύπου και ενέργειας κρύβει τα υπόλοιπα', async ({ page }) => {
  await setRole(page, 'SUPERADMIN');
  await openAudit(page);
  await setAuditEntity(page, 'subproject');
  await expect(auditLog(page, 'aud-create-bridge')).toBeVisible();
  await expect(auditLog(page, 'aud-update-tank')).toBeVisible();
  await expect(auditLog(page, 'aud-delete-user')).toHaveCount(0);
  await expect(auditLog(page, 'aud-old-psk')).toHaveCount(0);
  await setAuditEntity(page, '');
  await setAuditAction(page, 'delete');
  await expect(auditLog(page, 'aud-delete-user')).toBeVisible();
  await expect(auditLog(page, 'aud-create-bridge')).toHaveCount(0);
});

test('P2-20 ενημέρωση χωρίς πραγματική αλλαγή δεν εμφανίζεται', async ({ page }) => {
  await openAudit(page);
  await expect(auditLog(page, 'aud-empty-update')).toHaveCount(0);
  await expect(auditLog(page, 'aud-create-bridge')).toBeVisible();
});

test('P2-21 εκκαθάριση μόνο στον υπερδιαχειριστή, με επιβεβαίωση', async ({ page }) => {
  await openAudit(page);
  await expect(page.locator('[data-testid="btn-audit-clear"]')).toBeHidden();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-audit-clear"]')).toBeHidden();
  await setRole(page, 'SUPERADMIN');
  await expect(page.locator('[data-testid="btn-audit-clear"]')).toBeVisible();
  await requestAuditClear(page);
  await expect(page.locator('[data-testid="workflow-delete-title"]')).toHaveText('Εκκαθάριση Ιστορικού Ενεργειών');
  await confirmWorkflowDelete(page);
  await expect(page.locator('[data-testid="audit-empty"]')).toBeVisible();
  await expect(auditLog(page, 'aud-create-bridge')).toHaveCount(0);
  await expect(page.locator('[data-testid="btn-audit-clear"]')).toBeHidden();
});

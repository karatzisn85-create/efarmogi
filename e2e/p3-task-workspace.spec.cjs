'use strict';

const { test, expect } = require('@playwright/test');
const {
  openHarness,
  setRole,
  openTasks,
  taskCard,
} = require('./harness/harness-helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ergohub-e2e-subprojects');
  });
  await openHarness(page);
});

test('P3-30 χώρος κρύβει ολοκληρωμένα· αποθήκη δείχνει μόνο αυτά', async ({ page }) => {
  await openTasks(page);
  await expect(taskCard(page, 'task-open')).toBeVisible();
  await expect(taskCard(page, 'task-progress')).toBeVisible();
  await expect(taskCard(page, 'task-done')).toHaveCount(0);
  await page.locator('[data-testid="tab-archive"]').click();
  await expect(taskCard(page, 'task-done')).toBeVisible();
  await expect(taskCard(page, 'task-open')).toHaveCount(0);
});

test('P3-31 κλειστός από αναθέτη: ο συνάδελφος δεν τον βλέπει', async ({ page }) => {
  await openTasks(page);
  await expect(taskCard(page, 'task-withdrawn')).toBeVisible();
  await setRole(page, 'ENGINEER');
  await expect(taskCard(page, 'task-open')).toBeVisible();
  await expect(taskCard(page, 'task-withdrawn')).toHaveCount(0);
  await expect(taskCard(page, 'task-progress')).toHaveCount(0);
});

test('P3-32 αποχώρηση από αποθήκη: ο συνάδελφος δεν τη βλέπει', async ({ page }) => {
  await openTasks(page);
  await page.locator('[data-testid="tab-archive"]').click();
  await expect(taskCard(page, 'task-left')).toBeVisible();
  await setRole(page, 'ENGINEER');
  await expect(taskCard(page, 'task-done')).toBeVisible();
  await expect(taskCard(page, 'task-left')).toHaveCount(0);
});

test('P3-33 αναζήτηση στον τρέχοντα τίτλο του χώρου', async ({ page }) => {
  await openTasks(page);
  await page.locator('[data-testid="task-search"]').fill('γέφυρα');
  await expect(taskCard(page, 'task-open')).toBeVisible();
  await expect(taskCard(page, 'task-progress')).toHaveCount(0);
  await page.locator('[data-testid="task-search"]').fill('αποτύπωση');
  await expect(taskCard(page, 'task-done')).toHaveCount(0);
});

test('P3-34 Δημιουργία Χώρου μόνο στον αναθέτη και όχι στην αποθήκη', async ({ page }) => {
  await openTasks(page);
  await expect(page.locator('[data-testid="btn-new-task"]')).toBeVisible();
  await page.locator('[data-testid="tab-archive"]').click();
  await expect(page.locator('[data-testid="btn-new-task"]')).toBeHidden();
  await page.locator('[data-testid="tab-workspace"]').click();
  await setRole(page, 'ENGINEER');
  await expect(page.locator('[data-testid="btn-new-task"]')).toBeHidden();
});

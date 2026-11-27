'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');

async function besideClose(window, minimizeId, closeId) {
  const minimize = window.getByTestId(minimizeId);
  const close = window.getByTestId(closeId);
  await expect(minimize).toBeVisible();
  const minimizeBox = await minimize.boundingBox();
  const closeBox = await close.boundingBox();
  expect(minimizeBox, minimizeId).toBeTruthy();
  expect(closeBox, closeId).toBeTruthy();
  const minimizeMid = minimizeBox.y + minimizeBox.height / 2;
  const closeMid = closeBox.y + closeBox.height / 2;
  expect(Math.abs(minimizeMid - closeMid), `${minimizeId} ύψος`).toBeLessThan(8);
  const gap = closeBox.x - (minimizeBox.x + minimizeBox.width);
  expect(gap, `${minimizeId} απόσταση`).toBeGreaterThan(-2);
  expect(gap, `${minimizeId} απόσταση`).toBeLessThan(24);
  const view = window.viewportSize();
  expect(minimizeBox.y).toBeGreaterThanOrEqual(0);
  expect(minimizeBox.y + minimizeBox.height).toBeLessThanOrEqual((view?.height || 800) + 1);
}

test('P3-92 η σύμπτυξη μένει δίπλα στο κλείσιμο σε κάθε ανοιχτό παράθυρο', async ({ app }) => {
  const { window } = app;

  await expandCategory(window, 'Διαδικασίες Έργων');
  await window.locator('[data-user-guide="nav-entaxis"]').click();
  await besideClose(window, 'ent-window-minimize', 'ent-window-close');
  await window.getByTestId('btn-ent-new').click();
  await expect(window.getByTestId('ent-field-subject')).toBeVisible();
  await besideClose(window, 'ent-window-minimize', 'ent-window-close');
  await window.getByTestId('ent-form-close').click();
  await window.getByTestId('ent-card-ent-free').click();
  await expect(window.getByTestId('ent-detail-modal')).toBeVisible();
  await besideClose(window, 'ent-window-minimize', 'ent-window-close');
  await window.getByTestId('ent-detail-files').click();
  await expect(window.getByTestId('ent-files-modal')).toBeVisible();
  await besideClose(window, 'ent-window-minimize', 'ent-window-close');
  await window.getByTestId('ent-files-close').click();
  await window.getByTestId('ent-detail-close').click();
  await window.getByTestId('ent-window-close').click();

  await window.locator('[data-user-guide="nav-proskliseis"]').click();
  await besideClose(window, 'psk-window-minimize', 'psk-window-close');
  await window.getByTestId('btn-new-prosklisi').click();
  await expect(window.getByTestId('psk-form')).toBeVisible();
  await besideClose(window, 'psk-window-minimize', 'psk-window-close');
  await window.getByTestId('psk-form-close').click();
  await window.getByTestId('psk-card-psk-schools').click();
  await expect(window.getByTestId('psk-detail-modal')).toBeVisible();
  await besideClose(window, 'psk-window-minimize', 'psk-window-close');
  await window.getByTestId('psk-detail-modal').getByRole('button', { name: 'Αρχεία' }).click();
  await expect(window.getByTestId('psk-files-modal')).toBeVisible();
  await besideClose(window, 'psk-window-minimize', 'psk-window-close');
  await window.getByTestId('psk-files-modal').getByRole('button', { name: '✖' }).click();
  await window.getByTestId('psk-detail-close').click();
  await window.getByTestId('psk-window-close').click();

  await window.locator('[data-user-guide="nav-orimanthi"]').click();
  await besideClose(window, 'orimanthi-window-minimize', 'orimanthi-close');
  await window.getByRole('button', { name: /Νέο έργο/ }).click();
  await expect(window.locator('#new-project-title')).toBeVisible();
  await besideClose(window, 'orimanthi-window-minimize', 'orimanthi-close');
  await window.getByRole('button', { name: 'Ακύρωση' }).click();
  await window.getByTestId('orimanthi-hub-export-excel').click();
  await expect(window.getByTestId('orimanthi-hub-excel-modal')).toBeVisible();
  await besideClose(window, 'orimanthi-window-minimize', 'orimanthi-close');
  await window.getByTestId('orimanthi-window-minimize').click();

  await expandCategory(window, 'Εργαλεία');
  await window.getByTestId('nav-templates').click();
  await besideClose(window, 'templates-window-minimize', 'templates-window-close');
  await window.getByRole('button', { name: 'Νέα Κατηγορία' }).click();
  await expect(window.getByTestId('templates-new-category-name')).toBeVisible();
  await besideClose(window, 'templates-window-minimize', 'templates-window-close');
});

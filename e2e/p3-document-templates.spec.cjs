'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');

async function openTemplates(window) {
  await expandCategory(window, 'Εργαλεία');
  await window.getByTestId('nav-templates').click();
  await expect(window.getByTestId('templates-window')).toBeVisible();
}

test('P3-88 η φόρμα ένταξης μένει στο ίδιο σημείο μετά τη σύμπτυξη', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Διαδικασίες Έργων');
  await window.locator('[data-user-guide="nav-entaxis"]').click();
  await window.getByTestId('btn-ent-new').click();
  const subject = window.getByTestId('ent-field-subject');
  const before = await subject.evaluate((el) => {
    let node = el.parentElement;
    while (node && node.scrollHeight <= node.clientHeight + 8) node = node.parentElement;
    if (!node) return { top: 0, max: 0 };
    node.scrollTop = node.scrollHeight;
    return { top: node.scrollTop, max: node.scrollHeight };
  });
  expect(before.top).toBeGreaterThan(40);
  await window.getByTestId('ent-window-minimize').click();
  await window.getByTestId('dock-restore-entaxi').click();
  const after = await subject.evaluate((el) => {
    let node = el.parentElement;
    while (node && node.scrollHeight <= node.clientHeight + 8) node = node.parentElement;
    return node ? node.scrollTop : 0;
  });
  expect(after).toBeGreaterThan(40);
});

test('P3-89 η φόρμα πρόσκλησης μένει στο ίδιο σημείο μετά τη σύμπτυξη', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Διαδικασίες Έργων');
  await window.locator('[data-user-guide="nav-proskliseis"]').click();
  await window.getByTestId('btn-new-prosklisi').click();
  const form = window.getByTestId('psk-form');
  const before = await form.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
    return node.scrollTop;
  });
  expect(before).toBeGreaterThan(40);
  await window.getByTestId('psk-window-minimize').click();
  await window.getByTestId('dock-restore-prosklisi').click();
  const after = await form.evaluate((node) => node.scrollTop);
  expect(after).toBeGreaterThan(40);
});

test('P3-90 μετά τη σύμπτυξη το πληκτρολόγιο δεν γράφει στην κρυμμένη φόρμα', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Διαδικασίες Έργων');
  await window.locator('[data-user-guide="nav-entaxis"]').click();
  await window.getByTestId('btn-ent-new').click();
  const subject = window.getByTestId('ent-field-subject');
  await subject.fill('πριν');
  await window.getByTestId('ent-window-minimize').click();
  await expect(window.getByTestId('entaxeis-window')).toBeHidden();
  await expect(subject).toBeHidden();
  await window.keyboard.type('ΜΕΤΑ');
  await window.getByTestId('dock-restore-entaxi').click();
  await expect(subject).toHaveValue('πριν');

  const minimizeBox = await window.getByTestId('ent-window-minimize').boundingBox();
  const closeBox = await window.getByTestId('ent-window-close').boundingBox();
  expect(Math.abs((minimizeBox.y + minimizeBox.height / 2) - (closeBox.y + closeBox.height / 2))).toBeLessThan(8);
  expect(closeBox.x - (minimizeBox.x + minimizeBox.width)).toBeGreaterThan(-2);
  expect(closeBox.x - (minimizeBox.x + minimizeBox.width)).toBeLessThan(24);
});

test('P3-87 τα υποδείγματα συμπτύσσονται και κρατούν αναζήτηση και νέα κατηγορία', async ({ app }) => {
  const { window } = app;
  await openTemplates(window);
  await window.waitForTimeout(400);
  const minimizeBox = await window.getByTestId('templates-window-minimize').boundingBox();
  const closeBox = await window.getByTestId('templates-window-close').boundingBox();
  expect(Math.abs((minimizeBox.y + minimizeBox.height / 2) - (closeBox.y + closeBox.height / 2))).toBeLessThan(8);
  expect(closeBox.x - (minimizeBox.x + minimizeBox.width)).toBeGreaterThan(-2);
  expect(closeBox.x - (minimizeBox.x + minimizeBox.width)).toBeLessThan(24);

  const search = window.getByTestId('templates-search');
  await search.fill('να μείνει η αναζήτηση');
  await window.getByTestId('templates-window-minimize').click();
  await expect(window.getByTestId('templates-window')).toBeHidden();
  await expect(window.getByTestId('dock-restore-templates')).toContainText('να μείνει η αναζήτηση');
  await window.getByTestId('dock-restore-templates').click();
  await expect(search).toHaveValue('να μείνει η αναζήτηση');

  await window.getByRole('button', { name: 'Νέα Κατηγορία' }).click();
  const name = window.getByTestId('templates-new-category-name');
  await name.fill('Κατηγορία που μένει');
  const overModal = await window.getByTestId('templates-window-minimize').boundingBox();
  const closeWhileModal = await window.getByTestId('templates-window-close').boundingBox();
  expect(Math.abs((overModal.y + overModal.height / 2) - (closeWhileModal.y + closeWhileModal.height / 2))).toBeLessThan(8);
  await expect(window.getByTestId('templates-window-minimize')).toBeVisible();
  await window.getByTestId('templates-window-minimize').click();
  await expect(window.getByTestId('templates-window')).toBeHidden();
  await expect(window.getByTestId('dock-restore-templates')).toContainText('Κατηγορία που μένει');
  await window.getByTestId('dock-restore-templates').click();
  await expect(name).toHaveValue('Κατηγορία που μένει');
  await window.getByRole('button', { name: 'Ακύρωση' }).click();

  await window.getByTestId('templates-window-minimize').click();
  await expect(window.getByTestId('dock-restore-templates')).toBeVisible();
  await expandCategory(window, 'Διαδικασίες Έργων');
  await window.locator('[data-user-guide="nav-entaxis"]').click();
  await expect(window.getByTestId('entaxeis-window')).toBeVisible();
  await window.getByTestId('ent-window-minimize').click();
  await expect(window.getByText('Υπάρχουν ήδη συμπτυγμένα υποδείγματα')).toBeVisible();
  await expect(window.getByTestId('entaxeis-window')).toBeVisible();
  await expect(window.getByTestId('dock-restore-templates')).toBeVisible();

  await window.getByTestId('dock-close-templates').click();
  await window.getByTestId('confirm-no').click();
  await expect(window.getByTestId('dock-restore-templates')).toBeVisible();
  await window.getByTestId('dock-close-templates').click();
  await window.getByTestId('confirm-yes').click();
  await expect(window.getByTestId('dock-restore-templates')).toHaveCount(0);

  await window.getByTestId('ent-window-close').click();
  await expect(window.getByTestId('entaxeis-window')).toHaveCount(0);
  await window.getByTestId('nav-templates').click();
  await expect(window.getByTestId('templates-search')).toHaveValue('');
});

test('P3-91 η σύμπτυξη κάθεται δίπλα στο κλείσιμο σε προσκλήσεις και ωρίμανση', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Διαδικασίες Έργων');
  await window.locator('[data-user-guide="nav-proskliseis"]').click();
  await window.getByTestId('btn-new-prosklisi').click();
  const pskMin = await window.getByTestId('psk-window-minimize').boundingBox();
  const pskClose = await window.getByTestId('psk-window-close').boundingBox();
  expect(Math.abs((pskMin.y + pskMin.height / 2) - (pskClose.y + pskClose.height / 2))).toBeLessThan(8);
  expect(pskClose.x - (pskMin.x + pskMin.width)).toBeGreaterThan(-2);
  expect(pskClose.x - (pskMin.x + pskMin.width)).toBeLessThan(24);
  await window.getByTestId('psk-window-minimize').click();
  await expect(window.getByTestId('psk-form')).toBeHidden();

  await window.locator('[data-user-guide="nav-orimanthi"]').click();
  const oriMin = await window.getByTestId('orimanthi-window-minimize').boundingBox();
  const oriClose = await window.getByTestId('orimanthi-close').boundingBox();
  expect(Math.abs((oriMin.y + oriMin.height / 2) - (oriClose.y + oriClose.height / 2))).toBeLessThan(8);
  expect(oriClose.x - (oriMin.x + oriMin.width)).toBeGreaterThan(-2);
  expect(oriClose.x - (oriMin.x + oriMin.width)).toBeLessThan(24);
});


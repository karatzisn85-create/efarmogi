'use strict';

const { test, expect } = require('./helpers/real-app.cjs');

async function expectFullyOnScreen(window, locator) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  const size = await window.evaluate(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }));
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(size.h + 1);
  expect(box.x + box.width).toBeLessThanOrEqual(size.w + 1);
}

test('P16-01 η κάρτα της Δημοδομής ανοίγει ολόκληρη στη μέση', async ({ app }) => {
  const { window } = app;
  await window.getByTestId('house-mark').click();
  const modal = window.getByTestId('family-modal');
  await expect(modal).toBeVisible();
  await expect(window.getByRole('heading', { name: 'Δημοδομή' })).toBeVisible();
  await expectFullyOnScreen(window, modal);
  await expectFullyOnScreen(window, window.getByTestId('family-close'));
  await expect(window.getByTestId('family-ergohub')).toContainText('Ανοιχτή τώρα');

  await window.getByTestId('family-ydro-vlaves').click();
  await expect(window.getByTestId('family-detail')).toContainText('ΥδροΒλάβες');
  await expectFullyOnScreen(window, modal);

  await window.getByTestId('family-back').click();
  await expect(window.getByTestId('family-ergohub')).toBeVisible();
  await window.getByTestId('family-close').click();
  await expect(modal).toHaveCount(0);
});

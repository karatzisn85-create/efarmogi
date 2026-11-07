'use strict';

const fs = require('fs');
const path = require('path');
const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory, openSystemItem } = require('./helpers/actions.cjs');

test('P13-21 το δοκιμαστικό email μένει στον υπολογιστή και δεν φεύγει έξω', async ({ app }) => {
  const { window } = app;
  await openSystemItem(window, 'btn-email-settings');
  await window.getByTestId('email-gmail').fill('elegxos.ergohub@gmail.com');
  await window.getByTestId('email-password').fill('abcd efgh ijkl');
  await window.getByTestId('btn-email-save').click();
  await expect(window.getByTestId('email-password-set')).toBeVisible({ timeout: 15000 });
  await window.getByPlaceholder('email@example.com').fill('paraliptis@example.com');
  await window.getByTestId('btn-email-test').click();
  await expect(window.getByText(/στάλθηκε στο paraliptis@example.com/)).toBeVisible({ timeout: 20000 });
  const out = await window.evaluate(async () => window.electronAPI.invoke('e2e-mail-outbox'));
  expect(out.success).toBe(true);
  expect((out.messages || []).some((row) => row.to === 'paraliptis@example.com' && row.subject)).toBe(true);
});

test('P7-13 η δημοσίευση πύλης γράφει τοπικό πακέτο και δεν ανεβαίνει έξω', async ({ app }) => {
  const { window, testDir } = app;
  await expandCategory(window, 'Εξαγωγές');
  await window.getByRole('button', { name: 'Πύλη Διαφάνειας' }).click();
  await window.getByRole('button', { name: /Ρυθμίσεις Πύλης/ }).first().click();
  await expect(window.getByText('Ρυθμίσεις Πύλης Διαφάνειας')).toBeVisible();
  await window.getByPlaceholder('π.χ. archanes-asterousion').fill('dokimi-dimos');
  await window.getByRole('button', { name: /Αποθήκευση/ }).last().click();
  await expect(window.getByText(/dokimi-dimos/).first()).toBeVisible({ timeout: 15000 });
  await window.getByRole('button', { name: 'Επιλογή φιλτ.' }).click();
  await window.getByRole('button', { name: /Εξαγωγή & Δημοσίευση/ }).click();
  const packed = path.join(testDir, 'e2e-portal-erga.json');
  await expect.poll(() => fs.existsSync(packed), { timeout: 20000 }).toBe(true);
  const body = JSON.parse(fs.readFileSync(packed, 'utf8'));
  expect(Array.isArray(body.erga)).toBe(true);
  expect(body.erga.length).toBeGreaterThan(0);
  expect(body.erga.some((row) => /Αίθουσα|Γέφυρα|Φωτισμός/.test(String(row.titlos || '')))).toBe(true);
});

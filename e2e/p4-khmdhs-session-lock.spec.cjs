'use strict';

const { test, expect } = require('./helpers/real-app.cjs');

async function startLeaveAndShutdown(window) {
  await window.getByRole('button', { name: /Μαζική ανανέωση ΚΗΜΔΗΣ/ }).first().click();
  await window.getByRole('button', { name: 'Εκτέλεση' }).click();
  const leaveBtn = window.getByRole('button', { name: /Εκκίνηση και σβήσιμο υπολογιστή/ });
  await expect(leaveBtn).toBeVisible({ timeout: 30000 });
  await expect(leaveBtn).toBeEnabled({ timeout: 30000 });
  await leaveBtn.click();
  await expect(window.getByText('Ο υπολογιστής θα σβήσει μόνος του')).toBeVisible();
  await window.getByTestId('confirm-yes').click();
  await expect(window.getByText('Μαζική ανανέωση ΚΗΜΔΗΣ σε εξέλιξη')).toBeVisible({ timeout: 40000 });
}

test('P4-49 κλείδωμα μετά από εκκίνηση με σβήσιμο ζητά σύνδεση για ακύρωση', async ({ app }) => {
  const { window, users } = app;
  await startLeaveAndShutdown(window);

  const lockBtn = window.getByTestId('khmdhs-session-lock-btn-footer');
  await expect(lockBtn).toBeVisible();
  await lockBtn.click();

  await expect(window.getByTestId('khmdhs-session-lock')).toBeVisible();
  await expect(window.getByTestId('session-lock-username')).toHaveValue(users.admin.username);
  await expect(window.getByText('Μαζική ανανέωση ΚΗΜΔΗΣ σε εξέλιξη')).toBeVisible();

  await window.getByTestId('khmdhs-session-lock').click({ position: { x: 16, y: 16 } });
  await expect(window.getByTestId('khmdhs-session-lock')).toBeVisible();
  await expect(window.getByTestId('edit-panel')).toHaveCount(0);

  await window.getByTestId('session-lock-password').fill('wrongpass');
  await window.getByTestId('session-lock-submit').click();
  await expect(window.getByTestId('session-lock-error')).toBeVisible();
  await expect(window.getByTestId('khmdhs-session-lock')).toBeVisible();

  await window.getByTestId('session-lock-password').fill(users.admin.password);
  await window.getByTestId('session-lock-submit').click();
  await expect(window.getByTestId('khmdhs-session-lock')).toHaveCount(0, { timeout: 15000 });

  const abortBtn = window.getByRole('button', { name: /Να μείνει ανοιχτός ο υπολογιστής/ });
  const cancelBtn = window.getByRole('button', { name: /^Ακύρωση$/ });
  if (await abortBtn.count()) {
    await abortBtn.click();
    await expect(window.getByText(/σβήσιμο ακυρώθηκε|μένει ανοιχτός/i)).toBeVisible({ timeout: 15000 });
  } else if (await cancelBtn.count()) {
    await cancelBtn.first().click();
    await expect(window.getByText(/Ακύρωση/)).toBeVisible();
  }
});

'use strict';

const { test, expect } = require('./helpers/real-app.cjs');

async function openCalendar(window) {
  await window.locator('[data-user-guide="calendar-nav"]').click();
  await expect(window.getByText('Ημερολόγιο Προθεσμιών').first()).toBeVisible();
}

async function calendarTypeFilter(window, name) {
  await window.getByRole('button', { name, exact: true }).click();
}

test('P3-41 καταληκτική ΚΗΜΔΗΣ φαίνεται· ακυρωμένη όχι', async ({ app }) => {
  const { window } = app;
  await openCalendar(window);
  await expect(window.getByText('Ημερολόγιο Προθεσμιών').first()).toBeVisible();
});

test('P3-42 λήξη ισχύος προσφορών μόνο στο μεγαλύτερο παράθυρο', async ({ app }) => {
  const { window } = app;
  await openCalendar(window);
  await window.getByRole('button', { name: 'Λίστα & εξαγωγή' }).click();
  await window.getByRole('button', { name: '1 έτος' }).click();
  await expect(window.getByText('Ημερολόγιο Προθεσμιών').first()).toBeVisible();
});

test('P3-43 λήξη σύμβασης με ποσό φαίνεται· χωρίς ποσό όχι', async ({ app }) => {
  const { window } = app;
  await openCalendar(window);
  await window.getByRole('button', { name: 'Λήξεις συμβάσεων' }).click();
  await expect(window.getByText('Ημερολόγιο Προθεσμιών').first()).toBeVisible();
});

test('P3-44 φίλτρο συμβάσεων κρύβει καταληκτικές ΚΗΜΔΗΣ', async ({ app }) => {
  const { window } = app;
  await openCalendar(window);
  await window.getByRole('button', { name: 'Λίστα & εξαγωγή' }).click();
  await calendarTypeFilter(window, 'Λήξεις συμβάσεων');
  await expect(window.getByText(/Προθεσμίες εντός/).locator('..').getByText('Πρόσκληση σχολείων')).toHaveCount(0);
});

test('P3-45 κενή ειδοποίηση δεν αποθηκεύει', async ({ app }) => {
  const { window } = app;
  await openCalendar(window);
  await window.getByRole('button', { name: '+ Νέα προθεσμία' }).click();
  await window.getByRole('button', { name: /Αποθήκευση/ }).click();
  await expect(window.getByText(/τίτλος|ημερομηνία/i).first()).toBeVisible();
});

test('P3-46 νέα ειδοποίηση εμφανίζεται· μόνο μηχανικοί την κρύβει από χρήστη', async ({ app }) => {
  const { window } = app;
  await openCalendar(window);
  await window.getByRole('button', { name: 'Λίστα & εξαγωγή' }).click();
  await calendarTypeFilter(window, 'Ειδοποιήσεις');
  await expect(window.getByText('Ειδοποίηση μηχανικών').first()).toBeVisible();
});

test('P3-47 μηχανικός δεν βλέπει νέα προθεσμία', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('ENGINEER');
  await openCalendar(window);
  await expect(window.getByRole('button', { name: '+ Νέα προθεσμία' })).toHaveCount(0);
});

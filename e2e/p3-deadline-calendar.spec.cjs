'use strict';

const { test, expect } = require('./helpers/real-app.cjs');

async function openCalendar(window) {
  await window.locator('[data-user-guide="calendar-nav"]').click();
  await expect(window.getByText('Ημερολόγιο Προθεσμιών').first()).toBeVisible();
}

async function calendarTypeFilter(window, name) {
  await window.getByRole('button', { name, exact: true }).click();
}

async function openCalendarList(window) {
  await openCalendar(window);
  await window.getByRole('button', { name: 'Λίστα & εξαγωγή' }).click();
}

test('P3-01 κοντινή πρόσκληση φαίνεται στο ραντάρ και στη λίστα', async ({ app }) => {
  const { window } = app;
  await openCalendarList(window);
  await expect(window.getByText('Πρόσκληση σχολείων').first()).toBeVisible();
});

test('P3-02 μακρινή πρόσκληση κρύβεται στον μήνα και φαίνεται στο έτος', async ({ app }) => {
  const { window } = app;
  await openCalendarList(window);
  await expect(window.getByText('Πρόσκληση μακρινή')).toHaveCount(0);
  await window.getByRole('button', { name: '1 έτος' }).click();
  await expect(window.getByText('Πρόσκληση μακρινή').first()).toBeVisible();
});

test('P3-03 φίλτρο ειδοποιήσεων κρύβει τις προσκλήσεις', async ({ app }) => {
  const { window } = app;
  await openCalendarList(window);
  await calendarTypeFilter(window, 'Ειδοποιήσεις');
  await expect(window.getByText('Ειδοποίηση για όλους').first()).toBeVisible();
  await expect(window.getByText(/Προθεσμίες εντός/).locator('..').getByText('Πρόσκληση σχολείων')).toHaveCount(0);
});

test('P3-04 χρήστης δεν βλέπει ειδοποίηση μόνο για μηχανικούς', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('USER');
  await openCalendarList(window);
  await calendarTypeFilter(window, 'Ειδοποιήσεις');
  await expect(window.getByText('Ειδοποίηση για όλους').first()).toBeVisible();
  await expect(window.getByText('Ειδοποίηση μηχανικών')).toHaveCount(0);
  await app.loginAsRole('ENGINEER');
  await openCalendarList(window);
  await calendarTypeFilter(window, 'Ειδοποιήσεις');
  await expect(window.getByText('Ειδοποίηση μηχανικών').first()).toBeVisible();
});

test('P3-05 φίλτρο προσκλήσεων δείχνει μόνο προσκλήσεις', async ({ app }) => {
  const { window } = app;
  await openCalendarList(window);
  await calendarTypeFilter(window, 'Προσκλήσεις');
  await expect(window.getByText('Πρόσκληση σχολείων').first()).toBeVisible();
  await expect(window.getByText(/Προθεσμίες εντός/).locator('..').getByText('Ειδοποίηση για όλους')).toHaveCount(0);
});

test('P3-06 κλικ στην πρόσκληση ανοίγει την προθεσμία', async ({ app }) => {
  const { window } = app;
  await openCalendarList(window);
  await window.getByText('Πρόσκληση σχολείων').first().click();
  await expect(window.getByText(/Λήξη υποβολής|Πρόσκληση σχολείων/).first()).toBeVisible();
});

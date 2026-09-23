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

test('P3-05β φίλτρο εντάξεων δείχνει ΝοΔε και λήξη πράξης', async ({ app }) => {
  const { window } = app;
  await openCalendarList(window);
  await calendarTypeFilter(window, 'Εντάξεις');
  await expect(window.getByText('Ανάπλαση γέφυρας').first()).toBeVisible();
  await expect(window.getByText('Προθεσμία νομικής δέσμευσης (NoΔε)').first()).toBeVisible();
  await expect(window.getByText('Λήξη πράξης ένταξης').first()).toBeVisible();
  await expect(window.getByText(/Προθεσμίες εντός/).locator('..').getByText('Πρόσκληση σχολείων')).toHaveCount(0);
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

test('P3-06β υποβληθείσα πρόσκληση δεν εμφανίζεται ως λήξη υποβολής', async ({ app }) => {
  const { window } = app;
  await openCalendarList(window);
  await calendarTypeFilter(window, 'Προσκλήσεις');
  await expect(window.getByText('Πρόσκληση σχολείων').first()).toBeVisible();
  await expect(window.getByText('Πρόσκληση υποβληθείσα με ανοιχτή λήξη')).toHaveCount(0);
});

test('P3-72 ημερομηνία ΑΕΠΟ ωρίμανσης φαίνεται στο ημερολόγιο', async ({ app }) => {
  const { window } = app;
  await openCalendarList(window);
  await calendarTypeFilter(window, 'ΑΕΠΟ');
  await expect(window.getByText('Ανακατασκευή οδού Αρχανών').first()).toBeVisible();
  await window.getByText('Συμπερίληψη ληγμένων').click();
  await expect(window.getByText('Δίκτυο ύδρευσης Παρανύμφων').first()).toBeVisible();
});

test('P3-73 μακρινή ΑΕΠΟ εμφανίζεται στον μήνα της ημερομηνίας', async ({ app }) => {
  const { window } = app;
  await openCalendar(window);
  await calendarTypeFilter(window, 'ΑΕΠΟ');
  const nextMonth = window.getByRole('button', { name: '›' });
  let found = false;
  for (let i = 0; i < 18; i += 1) {
    if (await window.getByText(/Μακρινή ΑΕΠΟ/).count()) {
      found = true;
      break;
    }
    await nextMonth.click();
  }
  expect(found).toBe(true);
});

test('P3-74 μετάβαση ημερολογίου σε συγκεκριμένη ημερομηνία ΑΕΠΟ', async ({ app }) => {
  const { window } = app;
  await openCalendar(window);
  await calendarTypeFilter(window, 'ΑΕΠΟ');
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 400);
  const jumpTo = d.toISOString().slice(0, 10);
  await window.getByTestId('calendar-jump-date').fill(jumpTo);
  await expect(window.getByText(/Μακρινή ΑΕΠΟ/)).toBeVisible();
});

test('P3-75 κλικ σε ΑΕΠΟ ανοίγει το συγκεκριμένο έργο ωρίμανσης', async ({ app }) => {
  const { window } = app;
  await openCalendarList(window);
  await calendarTypeFilter(window, 'ΑΕΠΟ');
  await window.getByText('Ανακατασκευή οδού Αρχανών').first().click();
  await expect(window.getByTestId('orimanthi-window')).toBeVisible();
  await expect(window.getByTestId('orimanthi-back')).toBeVisible();
  await expect(window.getByTestId('orimanthi-tab-details')).toBeVisible();
  await window.getByTestId('orimanthi-tab-details').click();
  await expect(window.getByText('Ανακατασκευή οδού Αρχανών').first()).toBeVisible();
});

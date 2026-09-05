'use strict';

const { test, expect } = require('./helpers/real-app.cjs');
const { expandCategory } = require('./helpers/actions.cjs');

async function openTasks(window) {
  await expandCategory(window, 'Χώρος Εργασίας');
  await window.getByRole('button', { name: /Άνοιγμα χώρου Εργασιών/ }).click();
  await expect(window.getByText('Χώρος Εργασίας').first()).toBeVisible();
}

async function showCreatedTasks(window) {
  await window.getByTestId('workspace-view-created').click();
}

test('P3-30 χώρος κρύβει ολοκληρωμένα· αποθήκη δείχνει μόνο αυτά', async ({ app }) => {
  const { window } = app;
  await openTasks(window);
  await showCreatedTasks(window);
  await expect(window.getByTestId('assigner-person-maria')).toBeVisible();
  await expect(window.getByText('Έλεγχος γέφυρας').first()).toBeVisible();
  await window.getByRole('button', { name: 'Κλείσιμο' }).click();
  await window.getByRole('button', { name: /Αποθήκη Εργασιών/ }).click();
  await expect(window.getByText('Αποθήκη Εργασιών').first()).toBeVisible();
  await expect(window.getByText('Έλεγχος γέφυρας')).toHaveCount(0);
});

test('P3-31 κλειστός από αναθέτη: ο συνάδελφος δεν τον βλέπει', async ({ app }) => {
  const { window } = app;
  await openTasks(window);
  await showCreatedTasks(window);
  await expect(window.getByText('Έλεγχος γέφυρας').first()).toBeVisible();
  await app.loginAsRole('ENGINEER');
  await openTasks(window);
  await expect(window.getByText('Έλεγχος γέφυρας').first()).toBeVisible();
});

test('P3-32 αποχώρηση από αποθήκη: ο συνάδελφος δεν τη βλέπει', async ({ app }) => {
  const { window } = app;
  await expandCategory(window, 'Χώρος Εργασίας');
  await window.getByRole('button', { name: /Αποθήκη Εργασιών/ }).click();
  await expect(window.getByText('Αποθήκη Εργασιών').first()).toBeVisible();
});

test('P3-33 μηχανικός δεν βλέπει νέα εργασία', async ({ app }) => {
  const { window } = app;
  await openTasks(window);
  await expect(window.getByRole('button', { name: 'Δημιουργία Χώρου' })).toBeVisible();
  await app.loginAsRole('ENGINEER');
  await openTasks(window);
  await expect(window.getByRole('button', { name: 'Δημιουργία Χώρου' })).toHaveCount(0);
});

test('P3-34 απλός χρήστης δεν δημιουργεί χώρο εργασίας', async ({ app }) => {
  const { window } = app;
  await app.loginAsRole('USER');
  await expandCategory(window, 'Χώρος Εργασίας');
  await window.getByRole('button', { name: /Άνοιγμα χώρου Εργασιών/ }).click();
  await expect(window.getByText('Χώρος Εργασίας').first()).toBeVisible();
  await expect(window.getByRole('button', { name: 'Δημιουργία Χώρου' })).toHaveCount(0);
});

test('P3-48 προϊστάμενος βλέπει χρεώσεις ανά άτομο· ομαδικός χώρος και στους δύο', async ({ app }) => {
  const { window } = app;
  await openTasks(window);
  await expect(window.getByTestId('workspace-view-help')).toBeVisible();
  await window.getByTestId('workspace-view-help-dismiss').click();
  await expect(window.getByTestId('workspace-view-help')).toHaveCount(0);
  await window.getByRole('button', { name: 'Κλείσιμο' }).click();
  await expect(window.getByTestId('workspace-view-created')).toHaveCount(0);
  await window.getByRole('button', { name: /Άνοιγμα χώρου Εργασιών/ }).click();
  await expect(window.getByText('Χώρος Εργασίας').first()).toBeVisible();
  await expect(window.getByTestId('workspace-view-help')).toHaveCount(0);
  await window.getByRole('button', { name: 'Εμφάνιση βοήθειας' }).click();
  await expect(window.getByTestId('workspace-view-help')).toBeVisible();
  await window.getByTestId('workspace-view-help-dismiss').click();
  await showCreatedTasks(window);
  await expect(window.getByTestId('assigner-roster-summary')).toContainText('2 ανοιχτοί χώροι');
  await expect(window.getByTestId('assigner-person-maria')).toBeVisible();
  await expect(window.getByTestId('assigner-person-nikos')).toBeVisible();
  await window.getByTestId('assigner-person-maria').click();
  await expect(window.getByTestId('assigner-person-pane')).toContainText('Έλεγχος γέφυρας');
  await expect(window.getByTestId('assigner-person-pane')).toContainText('Προσφυγή αυθαίρετου');
  await expect(window.getByTestId('assigner-person-pane')).toContainText('μαζί με Νίκος Γεωργίου');
  await window.getByTestId('assigner-person-nikos').click();
  await expect(window.getByTestId('assigner-person-pane')).toContainText('Προσφυγή αυθαίρετου');
  await expect(window.getByTestId('assigner-person-pane')).toContainText('μαζί με Μαρία Παπαδοπούλου');
  await expect(window.getByTestId('assigner-person-pane').getByText('Έλεγχος γέφυρας')).toHaveCount(0);
  await window.getByTestId('task-card-task-group').click();
  await expect(window.getByTestId('assigner-back-people')).toBeVisible();
  await window.getByTestId('assigner-back-people').click();
  await expect(window.getByTestId('assigner-roster-summary')).toBeVisible();
  await expect(window.getByTestId('assigner-person-nikos')).toBeVisible();
  await window.getByTestId('assigner-person-maria').click();
  await window.getByTestId('assigner-mode-completed').click();
  await expect(window.getByTestId('assigner-person-pane')).toContainText('Απολογισμός δαπανών');
  await window.getByTestId('task-card-task-done').click();
  await expect(window.getByTestId('assigner-back-people')).toBeVisible();
  await expect(window.getByRole('heading', { name: 'Αποθήκη Εργασιών' })).toHaveCount(0);
  await window.getByTestId('assigner-back-people').click();
  await expect(window.getByTestId('assigner-roster-summary')).toBeVisible();
});

test('P3-49 συμμετέχω δεν δείχνει χώρους που δημιούργησα εγώ', async ({ app }) => {
  const { window } = app;
  await openTasks(window);
  const help = window.getByTestId('workspace-view-help-dismiss');
  if (await help.count()) await help.click();
  await window.getByTestId('workspace-view-assigned').click();
  await expect(window.getByTestId('task-card-task-open')).toHaveCount(0);
  await expect(window.getByTestId('task-card-task-group')).toHaveCount(0);
  await expect(window.getByText(/Όσα δημιουργήσατε εσείς είναι στο/)).toBeVisible();
});

test('P3-50 συμμετέχων προσθέτει συναδέλφους· ο δημιουργός δεν αλλάζει', async ({ app }) => {
  const { window } = app;
  await openTasks(window);
  const help = window.getByTestId('workspace-view-help-dismiss');
  if (await help.count()) await help.click();
  await window.getByRole('button', { name: 'Δημιουργία Χώρου' }).click();
  await window.getByPlaceholder('Σύντομος τίτλος θέματος').fill('Χρέωση τμήματος έργων');
  await window.getByText('Διαχειριστής Δοκιμών').click();
  await window.getByRole('button', { name: 'Αποθήκευση' }).click();
  await expect(window.getByRole('heading', { name: 'Χρέωση τμήματος έργων' })).toBeVisible();
  await window.getByRole('button', { name: 'Κλείσιμο', exact: true }).click();
  await app.loginAsRole('ADMIN');
  await openTasks(window);
  const help2 = window.getByTestId('workspace-view-help-dismiss');
  if (await help2.count()) await help2.click();
  await window.getByTestId('workspace-view-assigned').click();
  await window.locator('[data-testid^="task-card-"]').filter({ hasText: 'Χρέωση τμήματος έργων' }).click();
  await window.getByTestId('workspace-add-assignees').click();
  await window.getByTestId('invite-assignee-maria').check();
  await window.getByTestId('invite-assignee-nikos').check();
  await window.getByTestId('workspace-invite-submit').click();
  await expect(window.getByTestId('workspace-created-by')).toContainText('E2E Υπερδιαχειριστής');
  await expect(window.getByTestId('workspace-assignees')).toContainText('Μαρία Παπαδοπούλου');
  await expect(window.getByTestId('workspace-assignees')).toContainText('Νίκος Γεωργίου');
  await expect(window.getByRole('button', { name: 'Επεξεργασία' })).toHaveCount(0);
  await window.getByRole('button', { name: 'Κλείσιμο', exact: true }).click();
  await app.loginAsRole('ENGINEER');
  await openTasks(window);
  await window.locator('[data-testid^="task-card-"]').filter({ hasText: 'Χρέωση τμήματος έργων' }).click();
  await expect(window.getByTestId('workspace-add-assignees')).toHaveCount(0);
  await expect(window.getByTestId('workspace-created-by')).toContainText('E2E Υπερδιαχειριστής');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

test('η αποθήκευση στον δίσκο καλεί τον κοινό πυρήνα, όχι δεύτερο αντίγραφο', () => {
  const electron = read('public/electron.js');
  assert.match(electron, /require\('\.\.\/app\/core\/subprojectCard'\)/);
  assert.match(electron, /sanitizeSubprojectForPersist/);
  assert.doesNotMatch(
    electron,
    /function stripLegacySupervisorField\(obj\) \{\s*if \(obj && typeof obj === 'object'/
  );
});

test('η φόρμα υποέργου καλεί τις συναρτήσεις χρέωσης του πυρήνα', () => {
  const form = read('src/components/ProjectForm.js');
  assert.match(form, /from '\.\.\/\.\.\/app\/core\/subprojectCard'/);
  assert.match(form, /loadChargeFieldsFromProject/);
  assert.match(form, /normalizeChargeFromForm/);
  assert.match(form, /applyOutsideChargeToggle/);
  assert.match(form, /mergeSupervisorEngineerIds/);
});

test('η γρήγορη αναζήτηση του καταλόγου καλεί τον πυρήνα', () => {
  const dash = read('src/components/Dashboard.js');
  assert.match(dash, /from '\.\.\/\.\.\/app\/core\/subprojectCard'/);
  assert.match(dash, /subprojectMatchesQuickSearch/);
});

test('ο κατάλογος καλεί τον πυρήνα λίστας για ομάδες και ορατότητα', () => {
  const dash = read('src/components/Dashboard.js');
  assert.match(dash, /from '\.\.\/\.\.\/app\/core\/subprojectList'/);
  assert.match(dash, /groupSubprojectsByProjectId/);
  assert.match(dash, /applyArchivedAbandonedVisibility/);
  assert.match(dash, /projectMatchesQuickStatus/);
  const formOptions = read('src/data/formOptions.js');
  assert.match(formOptions, /from '\.\.\/\.\.\/app\/core\/subprojectList'/);
  assert.match(formOptions, /normalizeProjectType/);
});

test('η εμφάνιση χρέωσης στην κάρτα περνά από τον πυρήνα', () => {
  const display = read('src/utils/supervisorChargeDisplay.js');
  assert.match(display, /from '\.\.\/\.\.\/app\/core\/subprojectCard'/);
  assert.match(display, /getProjectChargeDisplay/);
});

test('ο χώρος εργασιών καλεί τον κοινό πυρήνα', () => {
  const manager = read('src/components/TaskAssignmentManager.js');
  assert.match(manager, /from '\.\.\/\.\.\/app\/core\/taskWorkspace'/);
  assert.match(manager, /applyTaskDailyFilters/);
  assert.match(manager, /showCreateTaskButton/);
  const display = read('src/utils/taskAssignmentDisplay.js');
  assert.match(display, /from '\.\.\/\.\.\/app\/core\/taskWorkspace'/);
  assert.match(display, /isTaskWithdrawnByAssigner/);
  const service = read('public/taskAssignmentService.js');
  assert.match(service, /require\('\.\.\/app\/core\/taskWorkspace'\)/);
  assert.match(service, /listTasksForView/);
  assert.match(service, /canAccessTask/);
});

test('τα αρχεία υποέργου καλούν τον κοινό πυρήνα', () => {
  const form = read('src/components/ProjectForm.js');
  assert.match(form, /from '\.\.\/\.\.\/app\/core\/subprojectFiles'/);
  assert.match(form, /applyFormFileGrouping/);
  assert.match(form, /isUploadGroupingCancelled/);
  assert.match(form, /applyFolderAsNewGroup/);
  assert.match(form, /removeFileFromGroup/);
  const upload = read('src/utils/uploadSubprojectFiles.js');
  assert.match(upload, /from '\.\.\/\.\.\/app\/core\/subprojectFiles'/);
  assert.match(upload, /isUploadGroupingCancelled/);
  assert.match(upload, /folderGroupTitle/);
  const dash = read('src/components/Dashboard.js');
  assert.match(dash, /from '\.\.\/\.\.\/app\/core\/subprojectFiles'/);
  assert.match(dash, /showSubprojectFileUpload/);
  assert.match(dash, /isSubprojectFileUploadBlocked/);
});

test('ο κατάλογος εγκρίσεων καλεί τον κοινό πυρήνα', () => {
  const manager = read('src/components/EgkriseisManager.js');
  assert.match(manager, /from '\.\.\/\.\.\/app\/core\/egkrisiCatalog'/);
  assert.match(manager, /filterEgkrisiProjectGroups/);
  assert.match(manager, /mergeStandaloneEgkriseis/);
  assert.match(manager, /canManageEgkrisiActions/);
  assert.match(manager, /showNewEgkrisiButton/);
});

test('ο κατάλογος εντάξεων καλεί τον κοινό πυρήνα', () => {
  const amounts = read('src/utils/entaxiAmountUtils.js');
  assert.match(amounts, /from '\.\.\/\.\.\/app\/core\/entaxiCatalog'/);
  assert.match(amounts, /getEntaxiCurrentTotal/);
  const manager = read('src/components/EntaxisManager.js');
  assert.match(manager, /from '\.\.\/\.\.\/app\/core\/entaxiCatalog'/);
  assert.match(manager, /groupEntaxeisByProjectTitle/);
  assert.match(manager, /isEntaxiUnlinked/);
  assert.match(manager, /showNewEntaxiButton/);
});

test('ο κατάλογος προσκλήσεων καλεί τον κοινό πυρήνα', () => {
  const utils = read('src/utils/prosklisiDeadlineUtils.js');
  assert.match(utils, /from '\.\.\/\.\.\/app\/core\/prosklisiCatalog'/);
  assert.match(utils, /applyProsklisiDailyFilters/);
  const manager = read('src/components/ProsklisisManager.js');
  assert.match(manager, /applyProsklisiDailyFilters/);
  assert.match(manager, /showNewProsklisiButton/);
  const helper = read('public/prosklisiDeadlineHelper.js');
  assert.match(helper, /require\('\.\.\/app\/core\/prosklisiCatalog'\)/);
  assert.match(helper, /getEffectiveProsklisiDeadline/);
});

test('το ημερολόγιο προθεσμιών καλεί τον κοινό πυρήνα', () => {
  const alerts = read('src/utils/calendarAlerts.js');
  assert.match(alerts, /from '\.\.\/\.\.\/app\/core\/calendarDeadlines'/);
  assert.match(alerts, /buildCalendarDeadlineAlerts/);
  const custom = read('src/utils/customCalendarEvents.js');
  assert.match(custom, /from '\.\.\/\.\.\/app\/core\/calendarDeadlines'/);
  assert.match(custom, /userCanSeeCustomEvent/);
  const prosklisi = read('src/utils/prosklisiCalendarEvents.js');
  assert.match(prosklisi, /from '\.\.\/\.\.\/app\/core\/calendarDeadlines'/);
  assert.match(prosklisi, /buildProsklisiCalendarEvents/);
  const procurement = read('src/utils/procurementCalendarEvents.js');
  assert.match(procurement, /from '\.\.\/\.\.\/app\/core\/calendarDeadlines'/);
  assert.match(procurement, /filterCalendarEventsByType/);
  const service = read('public/calendarCustomEventsService.js');
  assert.match(service, /require\('\.\.\/app\/core\/calendarDeadlines'\)/);
  assert.match(service, /userCanSeeCustomEvent/);
});

test('δημιουργία και διαγραφή υποέργου καλούν τον κοινό πυρήνα', () => {
  const electron = read('public/electron.js');
  assert.match(electron, /require\('\.\.\/app\/core\/subprojectLifecycle'\)/);
  assert.match(electron, /resolveProjectIdWhenMissing/);
  assert.match(electron, /evaluateSubprojectDelete/);
  const form = read('src/components/ProjectForm.js');
  assert.match(form, /from '\.\.\/\.\.\/app\/core\/subprojectLifecycle'/);
  assert.match(form, /collectPhaseARequiredErrors/);
  assert.match(form, /applyAddToExistingChoice/);
  assert.match(form, /showDeleteOnForm/);
  const dash = read('src/components/Dashboard.js');
  assert.match(dash, /from '\.\.\/\.\.\/app\/core\/subprojectLifecycle'/);
  assert.match(dash, /evaluateSubprojectDelete/);
  const merge = read('src/utils/mergeLoadedSubproject.js');
  assert.match(merge, /from '\.\.\/\.\.\/app\/core\/subprojectLifecycle'/);
  assert.match(merge, /removeSubprojectFromList/);
});

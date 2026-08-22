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
  assert.match(manager, /evaluateEntaxiDelete/);
  const form = read('src/components/EntaxisForm.js');
  assert.match(form, /from '\.\.\/\.\.\/app\/core\/entaxiCatalog'/);
  assert.match(form, /collectEntaxiRequiredErrors/);
  const electron = read('public/electron.js');
  assert.match(electron, /require\('\.\.\/app\/core\/entaxiCatalog'\)/);
  assert.match(electron, /evaluateEntaxiDelete/);
});

test('ο κατάλογος προσκλήσεων καλεί τον κοινό πυρήνα', () => {
  const utils = read('src/utils/prosklisiDeadlineUtils.js');
  assert.match(utils, /from '\.\.\/\.\.\/app\/core\/prosklisiCatalog'/);
  assert.match(utils, /applyProsklisiDailyFilters/);
  assert.match(utils, /evaluateProsklisiDelete/);
  const manager = read('src/components/ProsklisisManager.js');
  assert.match(manager, /applyProsklisiDailyFilters/);
  assert.match(manager, /showNewProsklisiButton/);
  assert.match(manager, /evaluateProsklisiDelete/);
  const form = read('src/components/ProsklisisForm.js');
  assert.match(form, /from '\.\.\/\.\.\/app\/core\/prosklisiCatalog'/);
  assert.match(form, /collectProsklisiRequiredErrors/);
  const helper = read('public/prosklisiDeadlineHelper.js');
  assert.match(helper, /require\('\.\.\/app\/core\/prosklisiCatalog'\)/);
  assert.match(helper, /getEffectiveProsklisiDeadline/);
  const electron = read('public/electron.js');
  assert.match(electron, /require\('\.\.\/app\/core\/prosklisiCatalog'\)/);
  assert.match(electron, /evaluateProsklisiDelete/);
});

test('το ημερολόγιο προθεσμιών καλεί τον κοινό πυρήνα', () => {
  const alerts = read('src/utils/calendarAlerts.js');
  assert.match(alerts, /from '\.\.\/\.\.\/app\/core\/calendarDeadlines'/);
  assert.match(alerts, /buildCalendarDeadlineAlerts/);
  const custom = read('src/utils/customCalendarEvents.js');
  assert.match(custom, /from '\.\.\/\.\.\/app\/core\/calendarDeadlines'/);
  assert.match(custom, /userCanSeeCustomEvent/);
  assert.match(custom, /collectCustomEventRequiredErrors/);
  assert.match(custom, /canCreateCustomCalendarEvent/);
  const prosklisi = read('src/utils/prosklisiCalendarEvents.js');
  assert.match(prosklisi, /from '\.\.\/\.\.\/app\/core\/calendarDeadlines'/);
  assert.match(prosklisi, /buildProsklisiCalendarEvents/);
  const procurement = read('src/utils/procurementCalendarEvents.js');
  assert.match(procurement, /from '\.\.\/\.\.\/app\/core\/calendarDeadlines'/);
  assert.match(procurement, /filterCalendarEventsByType/);
  assert.match(procurement, /buildNoticeDeadlineCalendarEvents/);
  assert.match(procurement, /shouldShowContractEndEvent/);
  assert.match(procurement, /mapContractEndToCalendarRow/);
  const form = read('src/components/CalendarCustomEventForm.js');
  assert.match(form, /collectCustomEventRequiredErrors/);
  assert.match(form, /isoFromDateAndTime/);
  const calendar = read('src/components/ProcurementCalendar.js');
  assert.match(calendar, /canCreateCustomCalendarEvent/);
  const service = read('public/calendarCustomEventsService.js');
  assert.match(service, /require\('\.\.\/app\/core\/calendarDeadlines'\)/);
  assert.match(service, /userCanSeeCustomEvent/);
  assert.match(service, /collectCustomEventRequiredErrors/);
  assert.match(service, /removeCustomEventFromList/);
  const builder = read('public/calendarEventsBuilder.js');
  assert.match(builder, /require\('\.\.\/app\/core\/calendarDeadlines'\)/);
  assert.match(builder, /isActiveProcurementProject/);
  assert.match(builder, /shouldShowContractEndEvent/);
});

test('η ροή μετά την ανάκτηση ΚΗΜΔΗΣ καλεί τον κοινό πυρήνα', () => {
  const queue = read('src/utils/khmdhsPostApplyQueue.js');
  assert.match(queue, /from '\.\.\/\.\.\/app\/core\/khmdhsPostFetch'/);
  assert.match(queue, /resolvePostFetchUi/);
  assert.match(queue, /mergePostApplyQueues/);
  const fields = read('src/utils/khmdhsChainKindFields.js');
  assert.match(fields, /from '\.\.\/\.\.\/app\/core\/khmdhsPostFetch'/);
  assert.match(fields, /validateChainKindDraft/);
  const options = read('src/utils/khmdhsChainKindOptions.js');
  assert.match(options, /from '\.\.\/\.\.\/app\/core\/khmdhsPostFetch'/);
  assert.match(options, /buildChainKindSelectOptions/);
  const form = read('src/components/ProjectForm.js');
  assert.match(form, /from '\.\.\/\.\.\/app\/core\/khmdhsPostFetch'/);
  assert.match(form, /resolveFetchStartGate/);
  assert.match(form, /resolvePreApplyGate/);
  const review = read('src/components/KhmdhsDataReviewModal.js');
  assert.match(review, /from '\.\.\/\.\.\/app\/core\/khmdhsPostFetch'/);
  assert.match(review, /canSaveKindCard/);
});

test('η ανανέωση ΚΗΜΔΗΣ καλεί τον κοινό πυρήνα', () => {
  const dash = read('src/components/Dashboard.js');
  assert.match(dash, /from '\.\.\/\.\.\/app\/core\/khmdhsRefresh'/);
  assert.match(dash, /showBatchRefreshButton/);
  const modal = read('src/components/SubprojectDetailModal.js');
  assert.match(modal, /from '\.\.\/\.\.\/app\/core\/khmdhsRefresh'/);
  assert.match(modal, /showCardRefreshButton/);
  const refreshUtil = read('src/utils/khmdhsChainRefresh.js');
  assert.match(refreshUtil, /from '\.\.\/\.\.\/app\/core\/khmdhsRefresh'/);
  assert.match(refreshUtil, /canUserRefreshKhmdhs/);
  const formOptions = read('src/data/formOptions.js');
  assert.match(formOptions, /from '\.\.\/\.\.\/app\/core\/khmdhsRefresh'/);
  assert.match(formOptions, /isKhmdhsChainClosedSubproject/);
  const seed = read('public/khmdhsChainRefreshSeed.js');
  assert.match(seed, /require\('\.\.\/app\/core\/khmdhsRefresh'\)/);
  assert.match(seed, /canUserRefreshKhmdhs/);
  const widget = read('src/components/KhmdhsBatchRefreshWidget.js');
  assert.match(widget, /from '\.\.\/\.\.\/app\/core\/khmdhsRefresh'/);
  assert.match(widget, /isBatchItemStale/);
  const electron = read('public/electron.js');
  assert.match(electron, /require\('\.\.\/app\/core\/khmdhsRefresh'\)/);
  assert.match(electron, /evaluateBatchRefreshAccess/);
  assert.match(electron, /evaluateSingleRefreshStart/);
  assert.match(electron, /classifyForBatchRefresh/);
});

test('το ιστορικό ενεργειών καλεί τον κοινό πυρήνα', () => {
  const dash = read('src/components/Dashboard.js');
  assert.match(dash, /from '\.\.\/\.\.\/app\/core\/auditCatalog'/);
  assert.match(dash, /showAuditLogButton/);
  const viewer = read('src/components/AuditLogViewer.js');
  assert.match(viewer, /from '\.\.\/\.\.\/app\/core\/auditCatalog'/);
  assert.match(viewer, /dropEmptyUpdateLogs/);
  assert.match(viewer, /showClearAuditButton/);
  assert.match(viewer, /getAuditVisibilityText/);
  const electron = read('public/electron.js');
  assert.match(electron, /require\('\.\.\/app\/core\/auditCatalog'\)/);
  assert.match(electron, /evaluateGetAuditLog/);
  assert.match(electron, /evaluateClearAuditLog/);
  assert.match(electron, /shouldSkipEmptyUpdate/);
  assert.match(electron, /clearAuditLogs/);
});

test('η διαχείριση χρηστών καλεί τον κοινό πυρήνα', () => {
  const dash = read('src/components/Dashboard.js');
  assert.match(dash, /from '\.\.\/\.\.\/app\/core\/userCatalog'/);
  assert.match(dash, /showUserManagementButton/);
  const form = read('src/components/UserManagement.js');
  assert.match(form, /from '\.\.\/\.\.\/app\/core\/userCatalog'/);
  assert.match(form, /collectCreateUserRequiredErrors/);
  assert.match(form, /partitionUsersByApproval/);
  assert.match(form, /showUserDeleteAction/);
  const electron = read('public/electron.js');
  assert.match(electron, /require\('\.\.\/app\/core\/userCatalog'\)/);
  assert.match(electron, /evaluateCreateUser/);
  assert.match(electron, /evaluateRegisterUser/);
  assert.match(electron, /evaluateDeleteUser/);
  assert.match(electron, /newUserStartsApproved/);
  assert.match(electron, /removeUserFromList/);
});

test('στατιστικά και εξαγωγές καλούν τον κοινό πυρήνα', () => {
  const dash = read('src/components/Dashboard.js');
  assert.match(dash, /from '\.\.\/\.\.\/app\/core\/reportsExport'/);
  assert.match(dash, /showStatisticsButton/);
  assert.match(dash, /showTechnicalProgramButton/);
  assert.match(dash, /showDataExportButton/);
  assert.match(dash, /resolveExportProjects/);
  assert.match(dash, /buildStatisticsFilterNote/);
  const stats = read('src/components/Statistics.js');
  assert.match(stats, /from '\.\.\/\.\.\/app\/core\/reportsExport'/);
  assert.match(stats, /countOverviewStatistics/);
  const exp = read('src/components/ExportData.js');
  assert.match(exp, /from '\.\.\/\.\.\/app\/core\/reportsExport'/);
  assert.match(exp, /evaluateDataExport/);
  assert.match(exp, /canCommitDataExport/);
  const tech = read('src/components/TechnicalProgramExport.js');
  assert.match(tech, /from '\.\.\/\.\.\/app\/core\/reportsExport'/);
  assert.match(tech, /buildTechnicalProgramRows/);
  assert.match(tech, /evaluateTechnicalExport/);
  assert.match(dash, /showPdfReportsButton/);
  const pdfModal = read('src/components/ReportsModal.js');
  assert.match(pdfModal, /from '\.\.\/\.\.\/app\/core\/reportsExport'/);
  assert.match(pdfModal, /canSavePdfReport/);
  assert.match(pdfModal, /PDF_TABS/);
  const pdfDoc = read('src/components/pdf/SubprojectsReport.js');
  assert.match(pdfDoc, /countPdfSubprojectsSummary/);
  const reportData = read('src/utils/subprojectReportData.js');
  assert.match(reportData, /from '\.\.\/\.\.\/app\/core\/reportsExport'/);
  assert.match(reportData, /getLinkedEntaxeis/);
  assert.match(reportData, /getLinkedProskliseis/);
  const card = read('src/components/ProjectCard.js');
  assert.match(card, /showCardReportButton/);
});

test('η πύλη διαφάνειας καλεί τον κοινό πυρήνα', () => {
  const dash = read('src/components/Dashboard.js');
  assert.match(dash, /from '\.\.\/\.\.\/app\/core\/portalCatalog'/);
  assert.match(dash, /showPortalButton/);
  assert.match(dash, /togglePublishedId/);
  const hub = read('src/components/PortalHubModal.js');
  assert.match(hub, /from '\.\.\/\.\.\/app\/core\/portalCatalog'/);
  assert.match(hub, /filterPortalHubProjects/);
  assert.match(hub, /evaluatePortalExport/);
  assert.match(hub, /previewPortalSelection/);
  assert.match(hub, /normalizePortalPublishedRecord/);
  assert.match(hub, /lastExportedIds/);
  const detail = read('src/components/SubprojectDetailModal.js');
  assert.match(detail, /showPortalCardSection/);
  assert.match(detail, /canTogglePortalOnCard/);
  assert.match(detail, /resolvePortalCardStatus/);
  const settings = read('src/components/PortalSettingsModal.js');
  assert.match(settings, /evaluatePortalSettings/);
  const electron = read('public/electron.js');
  assert.match(electron, /require\('\.\.\/app\/core\/portalCatalog'\)/);
  assert.match(electron, /buildErgonEntry/);
  assert.match(electron, /selectProjectsForPortalExport/);
  assert.match(electron, /evaluatePortalExportAccess/);
  assert.match(electron, /lastExportedIds/);
  assert.match(electron, /normalizePortalPublishedRecord/);
  const checklist = read('src/utils/postSetupChecklist.js');
  assert.match(checklist, /from '\.\.\/\.\.\/app\/core\/portalCatalog'/);
});

test('η μαζική εισαγωγή από Excel καλεί τον κοινό πυρήνα', () => {
  const dash = read('src/components/Dashboard.js');
  assert.match(dash, /from '\.\.\/\.\.\/app\/core\/excelImport'/);
  assert.match(dash, /showExcelImportButton/);
  const modal = read('src/components/SubprojectExcelImportModal.js');
  assert.match(modal, /from '\.\.\/\.\.\/app\/core\/excelImport'/);
  assert.match(modal, /canCommitImport/);
  assert.match(modal, /showDuplicatePolicyChoice/);
  const importer = read('public/subprojectExcelImport.js');
  assert.match(importer, /require\('\.\.\/app\/core\/excelImport'\)/);
  assert.match(importer, /normalizeTitleKey/);
  const electron = read('public/electron.js');
  assert.match(electron, /require\('\.\.\/app\/core\/excelImport'\)/);
  assert.match(electron, /buildDupKey/);
  assert.match(electron, /evaluateExcelImportAccess/);
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

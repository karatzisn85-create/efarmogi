import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

test('το πακέτο εγκατάστασης περιλαμβάνει τον κοινό πυρήνα', () => {
  const pkg = JSON.parse(read('package.json'));
  const files = pkg.build && pkg.build.files;
  assert.ok(Array.isArray(files), 'λείπει η λίστα αρχείων εγκατάστασης');
  assert.ok(
    files.some((entry) => String(entry).replace(/\\/g, '/').includes('app/core')),
    'χωρίς app/core η εγκατεστημένη εφαρμογή δεν ανοίγει'
  );
});

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
  assert.match(service, /canInviteAssigneesToTask/);
  assert.match(service, /addAssignees/);
  const preload = read('public/preload.js');
  assert.match(preload, /add-task-assignment-assignees/);
  const electron = read('public/electron.js');
  assert.match(electron, /add-task-assignment-assignees/);
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
  assert.match(calendar, /buildContractorRadarCalendarEvents/);
  const widget = read('src/components/CalendarDeadlineWidget.js');
  assert.match(widget, /buildContractorRadarCalendarEvents/);
  assert.match(widget, /onOpenContractorRegistry/);
  const service = read('public/calendarCustomEventsService.js');
  assert.match(service, /require\('\.\.\/app\/core\/calendarDeadlines'\)/);
  assert.match(service, /userCanSeeCustomEvent/);
  assert.match(service, /collectCustomEventRequiredErrors/);
  assert.match(service, /removeCustomEventFromList/);
  const builder = read('public/calendarEventsBuilder.js');
  assert.match(builder, /require\('\.\.\/app\/core\/calendarDeadlines'\)/);
  assert.match(builder, /isActiveProcurementProject/);
  assert.match(builder, /shouldShowContractEndEvent/);
  assert.match(builder, /CONTRACTOR_REGISTRY/);
  assert.match(builder, /collectGuaranteeReminderItems/);
  const notifyCenter = read('src/components/NotificationSettingsCenter.js');
  assert.match(notifyCenter, /CONTRACTOR_REGISTRY/);
  const calCfg = read('public/calendarConfigService.js');
  assert.match(calCfg, /CONTRACTOR_REGISTRY: 'contractor_registry'/);
  const reminderSvc = read('public/procurementCalendarReminderService.js');
  assert.match(reminderSvc, /loadContractorRecords/);
  assert.match(reminderSvc, /contractorRecords/);
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
  assert.match(electron, /evaluateAuthenticate/);
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
  assert.match(card, /onOpenContractorRegistry/);
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

test('η ωρίμανση έργων καλεί τον κοινό πυρήνα', () => {
  const dash = read('src/components/Dashboard.js');
  assert.match(dash, /from '\.\.\/\.\.\/app\/core\/orimanthiCatalog'/);
  assert.match(dash, /showOrimanthiButton/);
  assert.match(dash, /includeAepoInCalendar/);
  const manager = read('src/components/OrimanthiManager.js');
  assert.match(manager, /from '\.\.\/\.\.\/app\/core\/orimanthiCatalog'/);
  assert.match(manager, /isOrimanthiReadOnly/);
  assert.match(manager, /evaluateNewProposal/);
  assert.match(manager, /evaluateProposalSave/);
  assert.match(manager, /filterOrimanthiHub/);
  assert.match(manager, /evaluateProposalDelete/);
  const users = read('src/components/UserManagement.js');
  assert.match(users, /from '\.\.\/\.\.\/app\/core\/orimanthiCatalog'/);
  assert.match(users, /orimanthiEditEligibleRole/);
  const electron = read('public/electron.js');
  assert.match(electron, /require\('\.\.\/app\/core\/orimanthiCatalog'\)/);
  assert.match(electron, /canManageOrimanthi/);
  assert.match(electron, /evaluateProposalSave/);
});

test('το επιχειρησιακό πρόγραμμα καλεί τον κοινό πυρήνα', () => {
  const dash = read('src/components/Dashboard.js');
  assert.match(dash, /from '\.\.\/\.\.\/app\/core\/epProgramCatalog'/);
  assert.match(dash, /showEpProgramButton/);
  const manager = read('src/components/EpProgramManager.js');
  assert.match(manager, /from '\.\.\/\.\.\/app\/core\/epProgramCatalog'/);
  assert.match(manager, /filterEpActionsHub/);
  assert.match(manager, /evaluateEpImport/);
  assert.match(manager, /evaluateImportWizardStep/);
  assert.match(manager, /evaluateEpActionSave/);
  assert.match(manager, /describeEpPeriod/);
  assert.match(manager, /canDownloadEpTemplate/);
  assert.match(manager, /epImportScreenCopy/);
  assert.match(manager, /evaluateTemplateDownload/);
  assert.match(manager, /describeEpImportReload/);
  assert.match(manager, /download-ep-program-template/);
  const electron = read('public/electron.js');
  assert.match(electron, /require\('\.\.\/app\/core\/epProgramCatalog'\)/);
  assert.match(electron, /canManageEpProgram/);
  assert.match(electron, /evaluateEpImport/);
  assert.match(electron, /preview-ep-program/);
  assert.match(electron, /download-ep-program-template/);
  assert.match(electron, /evaluateTemplateDownload/);
  assert.match(electron, /loadMunicipalUnitsConfig/);
  assert.match(electron, /evaluateEpActionSave/);
  const service = read('public/epProgramService.js');
  assert.match(service, /require\('\.\.\/app\/core\/epProgramCatalog'\)/);
  assert.match(service, /transferEpActionLinks/);
  assert.match(service, /isEpTemplateExampleTitle/);
  const template = read('public/epProgramTemplate.js');
  assert.match(template, /require\('\.\.\/app\/core\/epProgramCatalog'\)/);
  assert.match(template, /buildEpImportTemplateModel/);
  assert.match(template, /listModel/);
  assert.match(template, /applyEpTemplateDropdowns/);
  assert.match(template, /exceljs/);
  assert.match(template, /definedNames/);
  const catalog = read('app/core/epProgramCatalog.js');
  assert.match(catalog, /formatEpCardLinkLabel/);
});

test('ο απολογισμός καλεί τον κοινό πυρήνα', () => {
  const dash = read('src/components/Dashboard.js');
  assert.match(dash, /from '\.\.\/\.\.\/app\/core\/apologismosCatalog'/);
  assert.match(dash, /showApologismosButton/);
  const ui = read('src/utils/apologismosCardUi.js');
  assert.match(ui, /from '\.\.\/\.\.\/app\/core\/apologismosCatalog'/);
  assert.match(ui, /filterApologismosCards/);
});

test('τα αντίγραφα ασφαλείας καλούν τον κοινό πυρήνα', () => {
  const dash = read('src/components/Dashboard.js');
  assert.match(dash, /from '\.\.\/\.\.\/app\/core\/backupCatalog'/);
  assert.match(dash, /showBackupButton/);
  assert.match(dash, /backupReminderTitle/);
  const manager = read('src/components/BackupManager.js');
  assert.match(manager, /from '\.\.\/\.\.\/app\/core\/backupCatalog'/);
  assert.match(manager, /canDeleteBackup/);
  assert.match(manager, /canRestoreBackup/);
  assert.match(manager, /canSeeBackupLocation/);
  assert.match(manager, /evaluateCreateBackup/);
  assert.match(manager, /restoreKindLabel/);
  assert.match(manager, /restoreConfirmDetail/);
  assert.match(manager, /announceCreateBackupFromEvent/);
  assert.match(manager, /evaluateRestoreOutcome/);
  assert.match(manager, /restoreProgressLabel/);
  assert.match(manager, /Επανεκκίνηση τώρα/);
  assert.match(manager, /Περιλαμβάνονται/);
  const electron = read('public/electron.js');
  assert.match(electron, /require\('\.\.\/app\/core\/backupCatalog'\)/);
  assert.match(electron, /require\('\.\/backupRestoreApply'\)/);
  assert.match(electron, /evaluateBackupReminder/);
  assert.match(electron, /evaluateRestoreReadyToApply/);
  assert.match(electron, /applyFullRestore/);
  assert.match(electron, /summarizeRestoredAreas/);
  assert.match(electron, /evaluateBackupCoverage/);
  assert.match(electron, /listZipTopLevelNames/);
  assert.match(electron, /if \(!coverage\.ok\)/);
  assert.match(electron, /restore-extract/);
  const catalog = read('app/core/backupCatalog.js');
  assert.match(catalog, /evaluateBackupCoverage/);
  assert.match(catalog, /selectBackupEntryNames/);
});

test('το email και η σύνδεση καλούν τον κοινό πυρήνα', () => {
  const dash = read('src/components/Dashboard.js');
  assert.match(dash, /from '\.\.\/\.\.\/app\/core\/emailCatalog'/);
  assert.match(dash, /showEmailSettingsButton/);
  assert.match(dash, /canOpenNotificationCenter/);
  const modal = read('src/components/EmailSettingsModal.js');
  assert.match(modal, /evaluateSaveEmailConfig/);
  const electron = read('public/electron.js');
  assert.match(electron, /require\('\.\.\/app\/core\/emailCatalog'\)/);
  assert.match(electron, /evaluateSaveEmailConfig/);
  assert.match(electron, /sanitizeEmailConfigForClient/);
  assert.match(electron, /evaluateAuthenticate/);
  const email = read('app/core/emailCatalog.js');
  assert.match(email, /evaluateSaveEmailConfig/);
  assert.match(email, /sanitizeEmailConfigForClient/);
  const users = read('app/core/userCatalog.js');
  assert.match(users, /evaluateAuthenticate/);
  const harness = read('e2e/harness/workspace.js');
  assert.match(harness, /ErgoHubEmailCatalog/);
  assert.match(harness, /evaluateAuthenticate/);
});

test('το μητρώο αναδόχων καλεί τον κοινό πυρήνα', () => {
  const dash = read('src/components/Dashboard.js');
  assert.match(dash, /from '\.\.\/\.\.\/app\/core\/contractorRegistry'/);
  assert.match(dash, /showContractorRegistryButton/);
  assert.match(dash, /ContractorRegistryManager/);
  const manager = read('src/components/ContractorRegistryManager.js');
  assert.match(manager, /from '\.\.\/\.\.\/app\/core\/contractorRegistry'/);
  assert.match(manager, /isContractorRegistryReadOnly/);
  assert.match(manager, /filterContractorHub/);
  assert.match(manager, /buildContractorHubRows/);
  assert.match(manager, /evaluateGuarantee/);
  assert.match(manager, /upsertGuaranteeInList/);
  assert.match(manager, /evaluateAcceptance/);
  assert.match(manager, /upsertAcceptanceInList/);
  assert.match(manager, /initialRowKey/);
  assert.match(manager, /focusNonce/);
  assert.match(manager, /contractorPendingLockId/);
  assert.match(dash, /contractorRegistryFocusNonce/);
  assert.match(dash, /onOpenContractorRegistry/);
  assert.match(dash, /openContractorRegistryCard/);
  const display = read('src/utils/projectCardDisplay.js');
  assert.match(display, /from '\.\.\/\.\.\/app\/core\/contractorRegistry'/);
  assert.match(display, /contractorIdentityKey/);
  const card = read('src/components/ProjectCard.js');
  assert.match(card, /onOpenContractorRegistry/);
  const electron = read('public/electron.js');
  assert.match(electron, /require\('\.\.\/app\/core\/contractorRegistry'\)/);
  assert.match(electron, /save-contractor-registry-record/);
  assert.match(electron, /engineerMayAccessRecord/);
  assert.match(electron, /contractorPendingLockId/);
  assert.match(electron, /filterRecordsForViewer/);
  assert.match(electron, /presentContractorRegistryRecords/);
  assert.match(manager, /delete-contractor-registry-record/);
  assert.match(manager, /canEditContactField/);
  assert.match(manager, /upload-contractor-registry-files/);
  assert.match(manager, /get-contractor-registry-files/);
  assert.match(manager, /open-contractor-registry-file/);
  assert.match(manager, /delete-contractor-registry-file/);
  const preload = read('public/preload.js');
  assert.match(preload, /load-contractor-registry/);
  assert.match(preload, /upload-contractor-registry-files/);
  assert.match(electron, /upload-contractor-registry-files/);
  assert.match(electron, /get-contractor-registry-files/);
  assert.match(electron, /open-contractor-registry-file/);
  assert.match(electron, /delete-contractor-registry-file/);
  const core = read('app/core/contractorRegistry.js');
  assert.match(core, /listAllGuaranteeExpiryItems/);
  const calDead = read('app/core/calendarDeadlines.js');
  assert.match(calDead, /GUARANTEE_EXPIRY/);
  assert.match(calDead, /buildGuaranteeExpiryCalendarEvents/);
  const svc = read('public/contractorRegistryService.js');
  assert.match(svc, /uploadFiles/);
  assert.match(svc, /listFiles/);
  assert.match(svc, /deleteGuaranteeFiles/);
  assert.match(electron, /mutate: true/);
});

test('το μητρώο μελετών καλεί τον κοινό πυρήνα', () => {
  const dash = read('src/components/Dashboard.js');
  assert.match(dash, /from '\.\.\/\.\.\/app\/core\/meletaiCatalog'/);
  assert.match(dash, /showMeletaiButton/);
  const manager = read('src/components/MeletaiManager.js');
  assert.match(manager, /from '\.\.\/\.\.\/app\/core\/meletaiCatalog'/);
  assert.match(manager, /isMeletaiReadOnly/);
  assert.match(manager, /evaluateNewMeleti/);
  assert.match(manager, /filterMeletaiHub/);
  assert.match(manager, /evaluateMeletiDelete/);
  const helpers = read('src/utils/meletaiHelpers.js');
  assert.match(helpers, /from '\.\.\/\.\.\/app\/core\/meletaiCatalog'/);
  assert.match(helpers, /validateStudyNumberFormat/);
  const users = read('src/components/UserManagement.js');
  assert.match(users, /meletaiEditEligibleRole/);
  const service = read('public/meletaiService.js');
  assert.match(service, /require\('\.\.\/app\/core\/meletaiCatalog'\)/);
  assert.match(service, /evaluateNewMeleti/);
  const electron = read('public/electron.js');
  assert.match(electron, /require\('\.\.\/app\/core\/meletaiCatalog'\)/);
  assert.match(electron, /canManageMeletai/);
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

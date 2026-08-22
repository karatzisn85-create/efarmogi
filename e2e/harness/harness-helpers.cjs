'use strict';

const HARNESS_PATH = '/e2e/harness/workspace.html';

async function openHarness(page) {
  await page.goto(HARNESS_PATH);
  await page.locator('[data-testid="card-list"]').waitFor();
}

function card(page, subprojectId) {
  return page.locator(`[data-testid="card-${subprojectId}"]`);
}

async function openRead(page, subprojectId) {
  await card(page, subprojectId).click();
  await page.locator('[data-testid="read-panel"]').waitFor();
}

async function enterEdit(page, subprojectId) {
  await openRead(page, subprojectId);
  await page.locator('[data-testid="btn-edit"]').click();
  await page.locator('[data-testid="edit-panel"]').waitFor();
}

async function setPrimaryCharge(page, engineerId) {
  await page.locator('[data-testid="edit-primary"]').selectOption(engineerId);
}

async function setOutsideCharge(page, text) {
  const box = page.locator('[data-testid="edit-outside"]');
  if (!(await box.isChecked())) {
    await box.check();
  }
  await page.locator('[data-testid="edit-free"]').fill(text);
}

async function saveEdit(page) {
  await page.locator('[data-testid="btn-save"]').click();
}

async function discardEdit(page) {
  await page.locator('[data-testid="btn-discard"]').click();
}

async function search(page, term) {
  await page.locator('[data-testid="quick-search"]').fill(term);
}

async function setRole(page, role) {
  await page.locator('[data-testid="role-select"]').selectOption(role);
}

async function setQuickStatus(page, status) {
  await page.locator('[data-testid="quick-status"]').selectOption(status);
}

async function setQuickType(page, type) {
  await page.locator('[data-testid="quick-type"]').selectOption(type);
}

async function setChargeFilter(page, key) {
  await page.locator('[data-testid="charge-filter"]').selectOption(key);
}

async function toggleArchived(page) {
  await page.locator('[data-testid="btn-archived"]').click();
}

async function readPersisted(page) {
  const raw = await page.locator('[data-testid="persist-dump"]').textContent();
  return raw ? JSON.parse(raw) : null;
}

async function openCreate(page) {
  await page.locator('[data-testid="btn-new"]').click();
  await page.locator('[data-testid="create-panel"]').waitFor();
}

async function fillCreatePhaseA(page, values) {
  const data = values || {};
  if (data.projectTitle != null) {
    await page.locator('[data-testid="create-project-title"]').fill(data.projectTitle);
  }
  if (data.subprojectTitle != null) {
    await page.locator('[data-testid="create-subproject-title"]').fill(data.subprojectTitle);
  }
  if (data.kaCode != null) {
    await page.locator('[data-testid="create-ka"]').fill(data.kaCode);
  }
  if (data.projectType != null) {
    await page.locator('[data-testid="create-type"]').selectOption(data.projectType);
  }
  if (data.projectStatus != null) {
    await page.locator('[data-testid="create-status"]').selectOption(data.projectStatus);
  }
  if (data.fundingSource != null) {
    await page.locator('[data-testid="create-funding-source"]').selectOption(data.fundingSource);
  }
  if (data.fundingDetails != null) {
    await page.locator('[data-testid="create-funding-details"]').selectOption(data.fundingDetails);
  }
  if (data.approvedAmount != null) {
    await page.locator('[data-testid="create-amount"]').fill(data.approvedAmount);
  }
}

async function submitCreate(page) {
  await page.locator('[data-testid="btn-create-save"]').click();
}

async function attachYes(page) {
  await page.locator('[data-testid="btn-attach-yes"]').click();
}

async function attachNo(page) {
  await page.locator('[data-testid="btn-attach-no"]').click();
}

async function requestDelete(page) {
  await page.locator('[data-testid="btn-delete"]').click();
  await page.locator('[data-testid="delete-confirm"]').waitFor();
}

async function confirmDelete(page) {
  await page.locator('[data-testid="btn-delete-confirm"]').click();
}

async function openCalendar(page) {
  await page.locator('[data-testid="btn-calendar"]').click();
  await page.locator('[data-testid="calendar-panel"]').waitFor();
}

async function setCalendarType(page, type) {
  await page.locator('[data-testid="calendar-type"]').selectOption(type);
}

async function setCalendarWindow(page, days) {
  await page.locator('[data-testid="calendar-window"]').selectOption(String(days));
}

function calEvent(page, id) {
  return page.locator(`[data-testid="cal-event-${id}"]`);
}

function calRadar(page, id) {
  return page.locator(`[data-testid="cal-radar-${id}"]`);
}

async function openCustomCreate(page) {
  await page.locator('[data-testid="btn-new-custom"]').click();
  await page.locator('[data-testid="custom-create-panel"]').waitFor();
}

async function fillCustomCreate(page, values) {
  const data = values || {};
  if (data.title != null) {
    await page.locator('[data-testid="custom-create-title"]').fill(data.title);
  }
  if (data.date != null) {
    await page.locator('[data-testid="custom-create-date"]').fill(data.date);
  }
  const eng = page.locator('[data-testid="custom-create-eng-only"]');
  if (data.engineerOnly) await eng.check();
  else if (data.engineerOnly === false) await eng.uncheck();
}

async function submitCustomCreate(page) {
  await page.locator('[data-testid="btn-custom-create-save"]').click();
}

async function openProskliseis(page) {
  await page.locator('[data-testid="btn-proskliseis"]').click();
  await page.locator('[data-testid="prosklisi-panel"]').waitFor();
}

async function setProsklisiTab(page, tab) {
  await page.locator(`[data-testid="tab-${tab}"]`).click();
}

async function searchProskliseis(page, term) {
  await page.locator('[data-testid="prosklisi-search"]').fill(term);
}

async function toggleExpiringSoon(page) {
  await page.locator('[data-testid="btn-expiring"]').click();
}

async function toggleUnlinked(page) {
  await page.locator('[data-testid="btn-unlinked"]').click();
}

function pskCard(page, id) {
  return page.locator(`[data-testid="psk-card-${id}"]`);
}

async function openEntaxeis(page) {
  await page.locator('[data-testid="btn-entaxeis"]').click();
  await page.locator('[data-testid="entaxi-panel"]').waitFor();
}

async function searchEntaxeis(page, term) {
  await page.locator('[data-testid="entaxi-search"]').fill(term);
}

async function toggleEntaxiUnlinked(page) {
  await page.locator('[data-testid="btn-entaxi-unlinked"]').click();
}

function entCard(page, id) {
  return page.locator(`[data-testid="ent-card-${id}"]`);
}

async function openNewEntaxi(page) {
  await page.locator('[data-testid="btn-new-entaxi"]').click();
  await page.locator('[data-testid="entaxi-create-panel"]').waitFor();
}

async function fillNewEntaxi(page, values) {
  const data = values || {};
  if (data.documentDate != null) {
    await page.locator('[data-testid="ent-create-date"]').fill(data.documentDate);
  }
  if (data.fundingAuthority != null) {
    await page.locator('[data-testid="ent-create-authority"]').fill(data.fundingAuthority);
  }
  if (data.initialAmount != null) {
    await page.locator('[data-testid="ent-create-amount"]').fill(data.initialAmount);
  }
  if (data.subject != null) {
    await page.locator('[data-testid="ent-create-subject"]').fill(data.subject);
  }
  const pdf = page.locator('[data-testid="ent-create-has-pdf"]');
  if (data.hasPdf) await pdf.check();
  else if (data.hasPdf === false) await pdf.uncheck();
}

async function submitNewEntaxi(page) {
  await page.locator('[data-testid="btn-ent-create-save"]').click();
}

async function requestEntaxiDelete(page, id) {
  await page.locator(`[data-testid="ent-delete-${id}"]`).click();
  await page.locator('[data-testid="workflow-delete-confirm"]').waitFor();
}

async function openNewProsklisi(page) {
  await page.locator('[data-testid="btn-new-prosklisi"]').click();
  await page.locator('[data-testid="psk-create-panel"]').waitFor();
}

async function fillNewProsklisi(page, values) {
  const data = values || {};
  if (data.title != null) {
    await page.locator('[data-testid="psk-create-title"]').fill(data.title);
  }
  if (data.axis != null) {
    await page.locator('[data-testid="psk-create-axis"]').fill(data.axis);
  }
}

async function submitNewProsklisi(page) {
  await page.locator('[data-testid="btn-psk-create-save"]').click();
}

async function requestProsklisiDelete(page, id) {
  await page.locator(`[data-testid="psk-delete-${id}"]`).click();
  await page.locator('[data-testid="workflow-delete-confirm"]').waitFor();
}

async function confirmWorkflowDelete(page) {
  await page.locator('[data-testid="btn-workflow-delete-confirm"]').click();
}

async function cancelWorkflowDelete(page) {
  await page.locator('[data-testid="btn-workflow-delete-cancel"]').click();
}

async function openEgkriseis(page) {
  await page.locator('[data-testid="btn-egkriseis"]').click();
  await page.locator('[data-testid="egkrisi-panel"]').waitFor();
}

async function searchEgkriseis(page, term) {
  await page.locator('[data-testid="egkrisi-search"]').fill(term);
}

function egkCard(page, id) {
  return page.locator(`[data-testid="egk-card-${id}"]`);
}

function egkSub(page, subprojectId) {
  return page.locator(`[data-testid="egk-sub-${subprojectId}"]`);
}

async function openFiles(page, subprojectId) {
  await openRead(page, subprojectId);
  await page.locator('[data-testid="btn-files"]').click();
  await page.locator('[data-testid="files-panel"]').waitFor();
}

async function openTasks(page) {
  await page.locator('[data-testid="btn-tasks"]').click();
  await page.locator('[data-testid="task-panel"]').waitFor();
}

function taskCard(page, id) {
  return page.locator(`[data-testid="task-card-${id}"]`);
}

async function openUsers(page) {
  await page.locator('[data-testid="btn-users"]').click();
  await page.locator('[data-testid="users-panel"]').waitFor();
}

function userCard(page, username) {
  return page.locator(`[data-testid="user-card-${username}"]`);
}

function userPending(page, username) {
  return page.locator(`[data-testid="user-pending-${username}"]`);
}

async function openNewUser(page) {
  await page.locator('[data-testid="btn-new-user"]').click();
  await page.locator('[data-testid="user-create-panel"]').waitFor();
}

async function fillNewUser(page, values) {
  const data = values || {};
  if (data.username != null) {
    await page.locator('[data-testid="user-create-username"]').fill(data.username);
  }
  if (data.fullName != null) {
    await page.locator('[data-testid="user-create-fullname"]').fill(data.fullName);
  }
  if (data.code != null) {
    await page.locator('[data-testid="user-create-password"]').fill(data.code);
  }
  if (data.role != null) {
    await page.locator('[data-testid="user-create-role"]').selectOption(data.role);
  }
}

async function submitNewUser(page) {
  await page.locator('[data-testid="btn-user-create-save"]').click();
}

async function approveUser(page, username) {
  await page.locator(`[data-testid="user-approve-${username}"]`).click();
}

async function requestUserDelete(page, username) {
  await page.locator(`[data-testid="user-delete-${username}"]`).click();
  await page.locator('[data-testid="workflow-delete-confirm"]').waitFor();
}

async function openAudit(page) {
  await page.locator('[data-testid="btn-audit"]').click();
  await page.locator('[data-testid="audit-panel"]').waitFor();
}

function auditLog(page, id) {
  return page.locator(`[data-testid="audit-log-${id}"]`);
}

async function setAuditEntity(page, value) {
  await page.locator('[data-testid="audit-entity"]').selectOption(value);
}

async function setAuditAction(page, value) {
  await page.locator('[data-testid="audit-action"]').selectOption(value);
}

async function requestAuditClear(page) {
  await page.locator('[data-testid="btn-audit-clear"]').click();
  await page.locator('[data-testid="workflow-delete-confirm"]').waitFor();
}

async function openKhmdhsBatch(page) {
  await page.locator('[data-testid="btn-batch-khmdhs"]').click();
  await page.locator('[data-testid="khmdhs-batch-panel"]').waitFor();
}

function khmdhsEligible(page, id) {
  return page.locator(`[data-testid="khmdhs-eligible-${id}"]`);
}

function khmdhsSkipped(page, id) {
  return page.locator(`[data-testid="khmdhs-skipped-${id}"]`);
}

async function setKhmdhsAll(page) {
  await page.locator('[data-testid="btn-khmdhs-all"]').click();
}

async function refreshKhmdhsFromRead(page) {
  await page.locator('[data-testid="btn-khmdhs-refresh"]').click();
}

async function openPostFetch(page) {
  await page.locator('[data-testid="btn-post-fetch"]').click();
  await page.locator('[data-testid="post-fetch-setup"]').waitFor();
}

async function runFetchScenario(page, name) {
  await openPostFetch(page);
  await page.locator('[data-testid="fetch-scenario"]').selectOption(name);
  await page.locator('[data-testid="btn-run-fetch-scenario"]').click();
}

function pendingTask(page, id) {
  return page.locator(`[data-testid="pending-task-${id}"]`);
}

async function openPendingTask(page, id) {
  await page.locator(`[data-testid="open-task-${id}"]`).click();
  await page.locator('[data-testid="pending-detail"]').waitFor();
}

async function openExcel(page) {
  await page.locator('[data-testid="btn-excel"]').click();
  await page.locator('[data-testid="excel-panel"]').waitFor();
}

async function runExcelScenario(page, name) {
  await openExcel(page);
  await page.locator('[data-testid="excel-scenario"]').selectOption(name);
  await page.locator('[data-testid="btn-excel-preview"]').click();
}

async function setExcelExisting(page, mode) {
  await page.locator(`input[name="excel-existing"][value="${mode}"]`).check();
}

async function setExcelDupPolicy(page, policy) {
  await page.locator(`input[name="excel-dup"][value="${policy}"]`).check();
}

async function commitExcel(page) {
  await page.locator('[data-testid="btn-excel-commit"]').click();
}

async function openStats(page) {
  await page.locator('[data-testid="btn-stats"]').click();
  await page.locator('[data-testid="stats-panel"]').waitFor();
}

async function openTechnical(page) {
  await page.locator('[data-testid="btn-technical"]').click();
  await page.locator('[data-testid="technical-panel"]').waitFor();
}

async function setTechnicalYear(page, year) {
  await page.locator('[data-testid="technical-year"]').selectOption(String(year));
}

async function openExportData(page) {
  await page.locator('[data-testid="btn-export"]').click();
  await page.locator('[data-testid="export-panel"]').waitFor();
}

async function openPdfReports(page) {
  await page.locator('[data-testid="btn-pdf"]').click();
  await page.locator('[data-testid="pdf-panel"]').waitFor();
}

async function setPdfTab(page, id) {
  await page.locator(`[data-testid="pdf-tab-${id}"]`).click();
}

async function openCardReport(page, subprojectId) {
  await page.locator(`[data-testid="card-report-${subprojectId}"]`).click();
  await page.locator('[data-testid="card-report-panel"]').waitFor();
}

async function openPortal(page) {
  await page.locator('[data-testid="btn-portal"]').click();
  await page.locator('[data-testid="portal-panel"]').waitFor();
}

async function togglePortalEnabled(page) {
  await page.locator('[data-testid="btn-portal-toggle-enabled"]').click();
}

async function searchPortal(page, term) {
  await page.locator('[data-testid="portal-search"]').fill(term);
}

async function setPortalPublishedFilter(page, value) {
  await page.locator('[data-testid="portal-filter-published"]').selectOption(value);
}

async function startAddFiles(page, names) {
  if (names) {
    await page.locator('[data-testid="file-pending-names"]').fill(names);
  }
  await page.locator('[data-testid="btn-add-files"]').click();
  await page.locator('[data-testid="file-group-choice"]').waitFor();
}

async function setLocked(page, locked) {
  const box = page.locator('[data-testid="edit-locked"]');
  if (locked) await box.check();
  else await box.uncheck();
}

module.exports = {
  openHarness,
  card,
  enterEdit,
  setPrimaryCharge,
  setOutsideCharge,
  saveEdit,
  discardEdit,
  search,
  setRole,
  setQuickStatus,
  setQuickType,
  setChargeFilter,
  toggleArchived,
  openRead,
  readPersisted,
  openCreate,
  fillCreatePhaseA,
  submitCreate,
  attachYes,
  attachNo,
  requestDelete,
  confirmDelete,
  setLocked,
  openCalendar,
  setCalendarType,
  setCalendarWindow,
  calEvent,
  calRadar,
  openCustomCreate,
  fillCustomCreate,
  submitCustomCreate,
  openProskliseis,
  setProsklisiTab,
  searchProskliseis,
  toggleExpiringSoon,
  toggleUnlinked,
  pskCard,
  openEntaxeis,
  searchEntaxeis,
  toggleEntaxiUnlinked,
  entCard,
  openNewEntaxi,
  fillNewEntaxi,
  submitNewEntaxi,
  requestEntaxiDelete,
  openNewProsklisi,
  fillNewProsklisi,
  submitNewProsklisi,
  requestProsklisiDelete,
  confirmWorkflowDelete,
  cancelWorkflowDelete,
  openEgkriseis,
  searchEgkriseis,
  egkCard,
  egkSub,
  openFiles,
  startAddFiles,
  openTasks,
  taskCard,
  openUsers,
  userCard,
  userPending,
  openNewUser,
  fillNewUser,
  submitNewUser,
  approveUser,
  requestUserDelete,
  openAudit,
  auditLog,
  setAuditEntity,
  setAuditAction,
  requestAuditClear,
  openKhmdhsBatch,
  khmdhsEligible,
  khmdhsSkipped,
  setKhmdhsAll,
  refreshKhmdhsFromRead,
  openPostFetch,
  runFetchScenario,
  pendingTask,
  openPendingTask,
  openExcel,
  runExcelScenario,
  setExcelExisting,
  setExcelDupPolicy,
  commitExcel,
  openStats,
  openTechnical,
  setTechnicalYear,
  openExportData,
  openPdfReports,
  setPdfTab,
  openCardReport,
  openPortal,
  togglePortalEnabled,
  searchPortal,
  setPortalPublishedFilter,
};

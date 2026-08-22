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
  openEgkriseis,
  searchEgkriseis,
  egkCard,
  egkSub,
  openFiles,
  startAddFiles,
  openTasks,
  taskCard,
};

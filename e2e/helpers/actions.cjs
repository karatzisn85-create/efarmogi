'use strict';

const fs = require('fs');
const path = require('path');

const COMPLETE_PHASE_A = {
  projectTitle: 'Νέο έργο δοκιμής',
  subprojectTitle: 'Υποέργο δοκιμής',
  kaCode: '10-2024.001',
  projectType: 'ΕΡΓΟ',
  projectStatus: 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ',
  fundingSource: 'ΕΣΠΑ 2021_2027',
  fundingDetails: '0501. ΕΠ Ανταγωνιστικότητα',
  approvedAmount: '10000',
};

function persistedPath(testDir, projectId, subprojectId) {
  return path.join(testDir, projectId, subprojectId, 'data.json');
}

function readPersisted(testDir, projectId, subprojectId) {
  if (projectId && subprojectId) {
    return JSON.parse(fs.readFileSync(persistedPath(testDir, projectId, subprojectId), 'utf8'));
  }
  const skip = new Set([
    'entaxeis', 'ΠΡΟΣΚΛΗΣΕΙΣ', 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ',
    'ANATHESEIS_ERGASION', 'ΑΠΟΛΟΓΙΣΜΟΣ', 'locks', 'config', '_e2e_uploads',
    'ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ', 'ΜΕΛΕΤΕΣ', 'backups',
  ]);
  const newest = { mtime: 0, data: null };
  for (const projectDir of fs.readdirSync(testDir)) {
    if (skip.has(projectDir) || projectDir.startsWith('.')) continue;
    const projectPath = path.join(testDir, projectDir);
    if (!fs.statSync(projectPath).isDirectory()) continue;
    for (const sub of fs.readdirSync(projectPath)) {
      const dataFile = path.join(projectPath, sub, 'data.json');
      if (!fs.existsSync(dataFile)) continue;
      const st = fs.statSync(dataFile);
      if (st.mtimeMs >= newest.mtime) {
        newest.mtime = st.mtimeMs;
        newest.data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      }
    }
  }
  return newest.data;
}

function writePersisted(testDir, projectId, subprojectId, patch) {
  const fp = persistedPath(testDir, projectId, subprojectId);
  const data = { ...JSON.parse(fs.readFileSync(fp, 'utf8')), ...patch };
  Object.entries(patch).forEach(([key, value]) => {
    if (value === undefined) delete data[key];
  });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
  try {
    const { upsertProjectsIndexEntry } = require('../../public/projectsIndex');
    upsertProjectsIndexEntry(testDir, data);
  } catch {
    /* το ευρετήριο ανανεώνεται στην επόμενη φόρτωση */
  }
  return data;
}

/** Παλιά κάρτα με πραγματικό ΑΔΑΜ, χωρίς πλήρη αλυσίδα — όπως θα ήταν στον Δήμο. */
function plantLegacyKhmdhsAdams(testDir, projectId, subprojectId, { noticeAdam, contractAdam }) {
  return writePersisted(testDir, projectId, subprojectId, {
    khmdhsNoticeAdam: noticeAdam || '',
    khmdhsAdam: contractAdam || '',
    khmdhsAwardAdam: '',
    khmdhsRequestAdam: '',
    khmdhsNoticeSnapshot: null,
    khmdhsContractSnapshot: null,
    khmdhsAwardSnapshot: null,
    khmdhsRequestSnapshot: null,
    khmdhsNoticeFetchedAt: '',
    khmdhsFetchedAt: '',
    khmdhsChainSeedAdam: '',
    khmdhsAdamChainMeta: undefined,
  });
}

function subprojectExists(testDir, subprojectId) {
  const skip = new Set([
    'entaxeis', 'ΠΡΟΣΚΛΗΣΕΙΣ', 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ',
    'ANATHESEIS_ERGASION', 'ΑΠΟΛΟΓΙΣΜΟΣ', 'locks', 'config', '_e2e_uploads',
    'ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ', 'ΜΕΛΕΤΕΣ', 'backups',
  ]);
  for (const projectDir of fs.readdirSync(testDir)) {
    if (skip.has(projectDir) || projectDir.startsWith('.')) continue;
    const projectPath = path.join(testDir, projectDir);
    if (!fs.statSync(projectPath).isDirectory()) continue;
    if (fs.existsSync(path.join(projectPath, subprojectId, 'data.json'))) return true;
  }
  return false;
}

function card(window, subprojectId) {
  return window.getByTestId(`card-${subprojectId}`);
}

function visibleCards(window) {
  return window.locator('[data-testid^="card-"]');
}

async function search(window, term) {
  await window.getByTestId('quick-search').fill(term);
}

async function setQuickStatus(window, status) {
  await window.getByTestId('quick-status').selectOption(status);
}

async function setQuickType(window, type) {
  await window.getByTestId('quick-type').selectOption(type);
}

async function toggleArchived(window) {
  await window.getByTestId('btn-archived').click();
}

async function openRead(window, subprojectId) {
  const target = card(window, subprojectId);
  await target.waitFor({ timeout: 15000 });
  await target.locator('[data-field="subproject-title"]').click();
  await window.getByTestId('read-panel').waitFor({ timeout: 15000 });
}

async function closeRead(window) {
  const closeBtn = window.locator('[data-testid="read-panel"] button[aria-label="Κλείσιμο"]');
  if (await closeBtn.count()) {
    await closeBtn.click();
  }
}

async function enterEdit(window, subprojectId) {
  await openRead(window, subprojectId);
  await window.getByTestId('btn-edit').click();
  await window.getByTestId('edit-panel').waitFor({ timeout: 20000 });
}

async function saveEdit(window) {
  await window.getByTestId('btn-save').click();
  const keepKhmdhs = window.getByRole('button', { name: 'Κράτηση δεδομένων' });
  try {
    await keepKhmdhs.waitFor({ timeout: 1500 });
    await keepKhmdhs.click();
  } catch {
    /* χωρίς προειδοποίηση ΚΗΜΔΗΣ */
  }
  await window.getByTestId('btn-save').filter({ hasText: /^Αποθήκευση$/ }).waitFor({ timeout: 25000 });
  await window.getByTestId('btn-discard').click();
  const confirm = window.getByTestId('unsaved-discard');
  try {
    await confirm.waitFor({ timeout: 1500 });
    await confirm.click();
  } catch {
    /* χωρίς μη αποθηκευμένες αλλαγές */
  }
  await window.getByTestId('edit-panel').waitFor({ state: 'hidden', timeout: 15000 });
}

async function discardEdit(window) {
  await dismissKhmdhsDialogs(window);
  await window.getByTestId('btn-discard').click();
  const confirm = window.getByTestId('unsaved-discard');
  try {
    await confirm.waitFor({ timeout: 2500 });
    await confirm.click();
  } catch {
    /* χωρίς μη αποθηκευμένες αλλαγές */
  }
}

async function setPrimaryCharge(window, engineerId) {
  await window.getByTestId('edit-primary').selectOption(engineerId);
}

async function setOutsideCharge(window, text) {
  const box = window.getByTestId('edit-outside');
  if (!(await box.isChecked())) {
    await box.check();
  }
  await window.getByTestId('edit-free').fill(text);
}

async function openCreate(window) {
  await window.getByTestId('btn-new').click();
  await window.getByTestId('edit-panel').waitFor({ timeout: 20000 });
}

async function fillCreatePhaseA(window, fields = {}) {
  const data = { ...COMPLETE_PHASE_A, ...fields };
  await window.getByTestId('edit-project-title').fill(data.projectTitle);
  await window.getByTestId('edit-subproject-title').fill(data.subprojectTitle);
  if (data.kaCode != null) {
    await window.getByTestId('edit-ka').fill(data.kaCode);
  }
  if (data.projectType) {
    await window.getByTestId('edit-type').selectOption(data.projectType);
  }
  if (data.fundingSource) {
    await window.getByTestId('edit-funding-source').selectOption(data.fundingSource);
  }
  if (data.fundingDetails) {
    await window.getByTestId('edit-funding-details').selectOption(data.fundingDetails);
  }
  if (data.approvedAmount != null) {
    await window.getByTestId('edit-approved-amount').fill(String(data.approvedAmount));
  }
  if (data.projectStatus) {
    await window.getByTestId('edit-status').selectOption(data.projectStatus);
  }
}

async function submitCreate(window) {
  await window.getByTestId('btn-save').click();
}

async function confirmYes(window) {
  await window.getByTestId('confirm-yes').click();
}

async function confirmNo(window) {
  await window.getByTestId('confirm-no').click();
}

async function attachYes(window) {
  await window.getByTestId('attach-yes').waitFor({ timeout: 15000 });
  await window.getByTestId('attach-yes').click();
}

async function attachNo(window) {
  await window.getByTestId('attach-no').waitFor({ timeout: 15000 });
  await window.getByTestId('attach-no').click();
}

async function requestDelete(window) {
  await window.getByTestId('btn-delete').click();
}

async function confirmDelete(window) {
  await confirmYes(window);
}

async function openFiles(window, subprojectId) {
  await window.getByTestId(`btn-files-${subprojectId}`).click();
  await window.getByTestId('file-manager').waitFor({ timeout: 15000 });
}

async function startAddFiles(window, filePath) {
  const paths = Array.isArray(filePath) ? filePath : [filePath];
  await window.evaluate(async (list) => {
    await window.electronAPI.invoke('e2e-queue-open-files', list);
  }, paths);
  await window.getByTestId('btn-add-files').click();
}

async function startAddFolder(window, payload) {
  await window.evaluate(async (body) => {
    await window.electronAPI.invoke('e2e-queue-folder-pick', body);
  }, payload);
  await window.getByTestId('btn-add-folder').click();
}

async function expandCategory(window, title) {
  const header = window.locator('span', { hasText: title }).first();
  await header.click();
}

async function openNav(window, guide) {
  const loc = window.locator(`[data-user-guide="${guide}"]`);
  if (await loc.count()) {
    await loc.first().click();
    return;
  }
  await window.getByTestId(guide).click();
}

async function openSystemItem(window, testId) {
  await expandCategory(window, 'Σύστημα');
  await window.getByTestId(testId).click();
}

async function setChargeFilter(window, chargeValue) {
  await window.getByTestId('btn-filters').click();
  await window.getByRole('button', { name: /Κατηγορίες/ }).click();
  await window.getByTestId('filter-charge').selectOption(chargeValue);
  await window.getByTestId('filter-apply').click();
}

async function waitDashboard(window) {
  await window.getByTestId('quick-search').waitFor({ timeout: 45000 });
}

async function savePhaseAIfNeeded(window) {
  const panel = window.getByTestId('edit-panel');
  const saveBtn = panel.getByTestId('btn-save');
  const saveText = ((await saveBtn.textContent()) || '').trim();
  const locked = panel.getByText(/Αποθηκεύστε τις αλλαγές της Φάσης Α|Αποθηκεύστε πρώτα τη Φάση Α/);
  if (/Φάσης Α/.test(saveText) || (await locked.count())) {
    await saveBtn.click();
    await panel.getByTestId('btn-save').filter({ hasText: /^Αποθήκευση$/ }).waitFor({ timeout: 25000 });
  }
}

async function openPhaseBEdit(window, subprojectId) {
  await enterEdit(window, subprojectId);
  await savePhaseAIfNeeded(window);
  await window.getByRole('button', { name: /Β — ΚΗΜΔΗΣ/ }).click();
}

async function openKhmdhsAdamField(window) {
  const panel = window.getByTestId('edit-panel');
  const field = panel.getByPlaceholder(/π\.χ\. 26REQ|π\.χ\. 26PROC|π\.χ\. 26SYMV/);
  if ((await field.count()) === 0) {
    const strip = panel.getByTitle(/Νέος κωδικός ΑΔΑΜ|Ανάκτηση από ΚΗΜΔΗΣ/);
    if (await strip.count()) await strip.first().click();
    else {
      throw new Error('Δεν εμφανίζεται πεδίο ανάκτησης ΚΗΜΔΗΣ στη Φάση Β');
    }
  }
  return panel.getByPlaceholder(/π\.χ\. 26REQ|π\.χ\. 26PROC|π\.χ\. 26SYMV/).first();
}

async function runKhmdhsAdamFetch(window, adam) {
  const panel = window.getByTestId('edit-panel');
  const field = await openKhmdhsAdamField(window);
  await field.fill(adam);
  await panel.getByRole('button', { name: /Ανάκτηση/ }).last().click();
}

async function dismissKhmdhsDialogs(window) {
  for (let i = 0; i < 4; i += 1) {
    const later = window.getByRole('button', { name: /θα συνεχίσω αργότερα|Επιστροφή στη φόρμα/ });
    if (await later.count()) {
      await later.click();
      continue;
    }
    const plannerClose = window.locator('[data-khmdhs-symv-planner-modal]').getByRole('button', { name: 'Κλείσιμο' });
    if (await plannerClose.count()) {
      await plannerClose.click();
      continue;
    }
    const situationClose = window.locator('[data-khmdhs-situation-modal]').getByRole('button', { name: 'Κλείσιμο' });
    if (await situationClose.count()) {
      await situationClose.click({ force: true });
      continue;
    }
    const registry = window.locator('[data-khmdhs-document-registry-modal]');
    if (await registry.count()) {
      const skip = registry.getByRole('button', { name: 'Όχι τώρα' });
      if (await skip.count()) await skip.click();
      continue;
    }
    if (await window.getByRole('heading', { name: 'Υπάρχουν ήδη δεδομένα ΚΗΜΔΗΣ' }).count()) {
      await window.getByRole('button', { name: 'Ακύρωση' }).last().click();
      continue;
    }
    if (await window.getByRole('heading', { name: 'Ίδια σύνδεση ΚΗΜΔΗΣ σε άλλο υποέργο' }).count()) {
      await window.getByRole('button', { name: 'Ακύρωση' }).last().click();
      continue;
    }
    break;
  }
}

module.exports = {
  COMPLETE_PHASE_A,
  card,
  visibleCards,
  search,
  setQuickStatus,
  setQuickType,
  toggleArchived,
  openRead,
  closeRead,
  enterEdit,
  saveEdit,
  discardEdit,
  setPrimaryCharge,
  setOutsideCharge,
  openCreate,
  fillCreatePhaseA,
  submitCreate,
  confirmYes,
  confirmNo,
  attachYes,
  attachNo,
  requestDelete,
  confirmDelete,
  openFiles,
  startAddFiles,
  startAddFolder,
  expandCategory,
  openNav,
  openSystemItem,
  setChargeFilter,
  waitDashboard,
  openPhaseBEdit,
  openKhmdhsAdamField,
  runKhmdhsAdamFetch,
  dismissKhmdhsDialogs,
  readPersisted,
  writePersisted,
  plantLegacyKhmdhsAdams,
  subprojectExists,
};

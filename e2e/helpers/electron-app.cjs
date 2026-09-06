'use strict';

const { _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { seedTestDir, USERS } = require('./seed.cjs');
const { buildKhmdhsFixtures } = require('./laptop-data.cjs');

const ROOT = path.resolve(__dirname, '../..');
const MAIN_JS = path.join(ROOT, 'public', 'electron.js');

async function launchAppAt({ testDir, userDataDir, seed = false } = {}) {
  const dataDir = testDir || fs.mkdtempSync(path.join(os.tmpdir(), 'ergohub-e2e-'));
  const udDir = userDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'ergohub-e2e-ud-'));
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(udDir, { recursive: true });
  const seeded = seed ? seedTestDir(dataDir) : { users: USERS, sampleUpload: null };

  const electronApp = await electron.launch({
    args: [MAIN_JS, `--user-data-dir=${udDir}`],
    cwd: ROOT,
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      ERGOHUB_E2E: '1',
      NODE_ENV: 'test',
      ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
    },
    timeout: 90000,
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await queueKhmdhsFixtures(window, buildKhmdhsFixtures());
  return {
    electronApp,
    window,
    testDir: dataDir,
    userDataDir: udDir,
    users: seeded.users,
    sampleUpload: seeded.sampleUpload,
  };
}

async function launchIsolatedApp() {
  return launchAppAt({ seed: true });
}

async function dismissTour(window) {
  const skip = window.getByRole('button', { name: 'Θα το δω αργότερα' });
  try {
    await skip.waitFor({ timeout: 4000 });
    await skip.click();
  } catch {
    /* η ξενάγηση δεν εμφανίστηκε */
  }
}

async function dismissSetupBanner(window) {
  const hide = window.getByRole('button', { name: 'Απόκρυψη για τώρα' });
  if (await hide.isVisible()) {
    await hide.click();
  }
}

async function loginAs(window, user) {
  const u = user || USERS.admin;
  await window.getByTestId('login-username').waitFor({ timeout: 45000 });
  await window.getByTestId('login-username').fill(u.username);
  await window.getByTestId('login-password').fill(u.password);
  await window.getByTestId('login-submit').click();
  await window.getByTestId('quick-search').waitFor({ timeout: 45000 });
  await dismissTour(window);
  await dismissSetupBanner(window);
}

async function logout(window) {
  for (let i = 0; i < 8; i += 1) {
    const closers = [
      window.getByTitle('Κλείσιμο (Esc)'),
      window.getByRole('button', { name: /^Κλείσιμο$/ }),
      window.getByRole('button', { name: '✕' }),
      window.getByRole('button', { name: /^Ακύρωση$/ }),
    ];
    let closed = false;
    for (const loc of closers) {
      if (await loc.count()) {
        await loc.last().click({ force: true, timeout: 2000 }).catch(() => {});
        closed = true;
        break;
      }
    }
    if (!closed) await window.keyboard.press('Escape');
  }
  const btn = window.getByTestId('btn-logout');
  if ((await btn.count()) === 0) return;
  await btn.click({ force: true, timeout: 15000 });
  await window.getByTestId('login-submit').waitFor({ timeout: 20000 });
}

async function loginAsRole(window, users, role) {
  const map = {
    SUPERADMIN: users.superadmin,
    ADMIN: users.manager,
    ENGINEER: users.maria,
    USER: users.viewer,
  };
  await logout(window);
  await loginAs(window, map[role] || users.superadmin);
}

async function closeIsolatedApp(ctx) {
  if (!ctx?.electronApp) return;
  const proc = typeof ctx.electronApp.process === 'function' ? ctx.electronApp.process() : null;
  try {
    await Promise.race([
      ctx.electronApp.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('electron close timeout')), 12000)),
    ]);
  } catch {
    if (proc && !proc.killed) {
      try { proc.kill(); } catch { /* already gone */ }
    }
  }
}

async function queueOpenFiles(window, filePaths) {
  await window.evaluate(async (paths) => {
    await window.electronAPI.invoke('e2e-queue-open-files', paths);
  }, filePaths);
}

async function queueSavePath(window, filePath) {
  await window.evaluate(async (dest) => {
    await window.electronAPI.invoke('e2e-queue-save-path', dest);
  }, filePath);
}

async function queueKhmdhsFixtures(window, byAdam) {
  await window.evaluate(async (map) => {
    await window.electronAPI.invoke('e2e-queue-khmdhs-fixtures', map);
  }, byAdam);
}

async function setKhmdhsLive(window, enabled) {
  await window.evaluate(async (on) => {
    await window.electronAPI.invoke('e2e-set-khmdhs-live', on);
  }, !!enabled);
}

async function queueFolderPick(window, payload) {
  await window.evaluate(async (body) => {
    await window.electronAPI.invoke('e2e-queue-folder-pick', body);
  }, payload);
}

module.exports = {
  launchIsolatedApp,
  launchAppAt,
  loginAs,
  logout,
  loginAsRole,
  closeIsolatedApp,
  queueOpenFiles,
  queueSavePath,
  queueKhmdhsFixtures,
  setKhmdhsLive,
  queueFolderPick,
  USERS,
};

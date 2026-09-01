'use strict';

const { test: base, expect } = require('@playwright/test');
const {
  launchIsolatedApp,
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
} = require('./electron-app.cjs');

function attachHelpers(launched) {
  launched.loginAs = (user) => loginAs(launched.window, user);
  launched.logout = () => logout(launched.window);
  launched.loginAsRole = (role) => loginAsRole(launched.window, launched.users, role);
  launched.queueOpenFiles = (paths) => queueOpenFiles(launched.window, paths);
  launched.queueSavePath = (filePath) => queueSavePath(launched.window, filePath);
  launched.queueKhmdhsFixtures = (map) => queueKhmdhsFixtures(launched.window, map);
  launched.setKhmdhsLive = (on) => setKhmdhsLive(launched.window, on);
  launched.queueFolderPick = (payload) => queueFolderPick(launched.window, payload);
  return launched;
}

const test = base.extend({
  appRaw: async ({}, use) => {
    const launched = attachHelpers(await launchIsolatedApp());
    await use(launched);
    await closeIsolatedApp(launched);
  },
  app: async ({ appRaw }, use) => {
    await loginAs(appRaw.window, appRaw.users.admin);
    await use(appRaw);
  },
});

module.exports = { test, expect, USERS };

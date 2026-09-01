'use strict';

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  testMatch: 'p*-*.spec.cjs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 20000 },
  reporter: 'list',
  use: {
    locale: 'el-GR',
    trace: 'on-first-retry',
  },
});

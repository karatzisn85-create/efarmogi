'use strict';

const { spawnSync } = require('child_process');
const os = require('os');
const path = require('path');

if (process.platform === 'win32' && !process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(
    os.homedir(),
    'AppData',
    'Local',
    'ms-playwright'
  );
}
process.env.CI = process.env.CI || 'true';

const steps = [
  { name: 'Unit (node --test)', cmd: 'npm', args: ['run', 'test:unit'] },
  { name: 'Jest (εφαρμογή)', cmd: 'npm', args: ['run', 'test:jest'] },
  { name: 'E2E (Playwright)', cmd: 'npm', args: ['run', 'test:e2e:core'] },
];

for (const step of steps) {
  console.log(`\n========== ${step.name} ==========\n`);
  const result = spawnSync(step.cmd, step.args, {
    stdio: 'inherit',
    shell: true,
    env: process.env,
    cwd: path.join(__dirname, '..'),
  });
  if (result.status !== 0) {
    console.error(`\nΑπέτυχε: ${step.name}`);
    process.exit(result.status == null ? 1 : result.status);
  }
}

console.log('\n========== Όλοι οι έλεγχοι πέρασαν ==========\n');

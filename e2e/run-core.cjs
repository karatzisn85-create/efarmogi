'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

if (process.platform === 'win32' && !process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(
    os.homedir(),
    'AppData',
    'Local',
    'ms-playwright'
  );
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true, cwd: ROOT, env: process.env });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`));
    });
  });
}

async function ensureBuild() {
  const indexPath = path.join(ROOT, 'build', 'index.html');
  if (fs.existsSync(indexPath)) return;
  console.log('Δεν υπάρχει build της εφαρμογής — δημιουργείται πριν τους ελέγχους οθόνης…');
  await run('npm', ['run', 'build']);
}

async function main() {
  await ensureBuild();
  await run('npx', ['playwright', 'test', '--config=playwright.config.cjs']);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

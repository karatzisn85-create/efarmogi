'use strict';

const { spawn } = require('child_process');
const { startServer } = require('./harness/static-server.cjs');

async function main() {
  const server = await startServer();
  const child = spawn(
    'npx',
    ['playwright', 'test', '--config=playwright.config.cjs'],
    { stdio: 'inherit', shell: true }
  );

  const shutdown = () => {
    try { server.close(); } catch { /* already closed */ }
  };

  child.on('exit', (code) => {
    shutdown();
    process.exit(code == null ? 1 : code);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const version = packageJson.version || '1.0.0';
const outputDir = packageJson.build?.directories?.output || 'dist';
const artifactName = `EFARMOGI-App-${version}.exe`;
const artifactPath = path.join(outputDir, artifactName);
const runStartedAt = Date.now();

const builderArgs = ['electron-builder', '--win', 'portable', '--x64', '--publish', 'never'];

const child = spawn('npx.cmd', builderArgs, {
  cwd: projectRoot,
  shell: false,
  windowsHide: false,
  env: {
    ...process.env,
    CSC_IDENTITY_AUTO_DISCOVERY: 'false'
  }
});

child.stdout.on('data', (chunk) => process.stdout.write(chunk.toString()));
child.stderr.on('data', (chunk) => process.stderr.write(chunk.toString()));

child.on('error', (err) => {
  console.error(`[dist-safe] electron-builder spawn error: ${err.message}`);
  process.exit(1);
});

child.on('close', (code) => {
  if (code === 0) {
    process.exit(0);
  }

  let artifactStat = null;
  try {
    artifactStat = fs.statSync(artifactPath);
  } catch (_) {
    artifactStat = null;
  }

  const artifactLooksValid =
    Boolean(artifactStat) &&
    artifactStat.isFile() &&
    artifactStat.size > 0 &&
    artifactStat.mtimeMs >= runStartedAt - 10000;

  if (artifactLooksValid) {
    console.warn(
      `[dist-safe] electron-builder returned code=${String(code)}, but artifact exists: ${artifactPath}`
    );
    console.warn('[dist-safe] Treating build as successful because executable was produced.');
    process.exit(0);
  }

  process.exit(code ?? 1);
});

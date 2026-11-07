'use strict';

/**
 * Ξεχωριστός έλεγχος πακεταρίσματος για αναβάθμιση κινητήρα.
 * Φτιάχνει τον φάκελο της εφαρμογής (όχι το αργό αρχείο εγκατάστασης NSIS)
 * και σταματά αν δεν βγει το εκτελέσιμο.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist', 'win-unpacked');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      shell: true,
      stdio: 'inherit',
      env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} σταμάτησε με κωδικό ${code}`));
    });
  });
}

async function main() {
  await run('npx', ['electron-builder', '--win', 'dir', '--x64', '--publish', 'never']);
  const names = fs.existsSync(outDir) ? fs.readdirSync(outDir) : [];
  const exe = names.find((name) => name.toLowerCase().endsWith('.exe'));
  if (!exe) {
    throw new Error(`Δεν βρέθηκε εκτελέσιμο στο ${outDir}`);
  }
  const size = fs.statSync(path.join(outDir, exe)).size;
  if (size < 1000000) {
    throw new Error(`Το ${exe} είναι πολύ μικρό (${size} bytes)`);
  }
  console.log(`Πακέτο έτοιμο: ${exe} (${size} bytes)`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

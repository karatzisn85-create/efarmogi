/**
 * Συγχρονίζει τα DejaVu TTF στο public/fonts/apologismos από το npm πακέτο.
 * Τρέχει μετά το npm install ώστε η εφαρμογή να έχει τοπικές γραμματοσειρές offline.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'node_modules', 'dejavu-fonts-ttf', 'ttf');
const DEST_DIR = path.join(ROOT, 'public', 'fonts', 'apologismos');
const FILES = [
  'DejaVuSans.ttf',
  'DejaVuSans-Bold.ttf',
  'DejaVuSans-Oblique.ttf',
  'DejaVuSans-BoldOblique.ttf',
];

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.warn('[sync-apologismos-fonts] dejavu-fonts-ttf δεν βρέθηκε — παράλειψη');
    return;
  }
  fs.mkdirSync(DEST_DIR, { recursive: true });
  for (const name of FILES) {
    const from = path.join(SRC_DIR, name);
    const to = path.join(DEST_DIR, name);
    if (!fs.existsSync(from)) {
      console.warn(`[sync-apologismos-fonts] λείπει ${name}`);
      continue;
    }
    fs.copyFileSync(from, to);
  }
  console.log('[sync-apologismos-fonts] OK → public/fonts/apologismos');
}

main();

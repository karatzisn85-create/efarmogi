import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const handler = require('../../public/prosklisiExportHandler.js');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('εξαγωγή πρόσκλησης αντιγράφει φακέλους/υποφακέλους και γράφει αναφορά Word', async () => {
  const srcRoot = makeTempDir('psk-export-src-');
  const destParent = makeTempDir('psk-export-dest-');
  const filesRoot = path.join(srcRoot, 'ΑΡΧΕΙΑ_ΠΡΟΣΚΛΗΣΗΣ');
  fs.mkdirSync(path.join(filesRoot, 'Φάκελος μελετών'), { recursive: true });
  fs.mkdirSync(path.join(filesRoot, 'Επισυναπτόμενα Αρχεία Υποβολής', 'Δικαιολογητικά'), { recursive: true });
  fs.writeFileSync(path.join(filesRoot, 'πρόσκληση-όροι.pdf'), 'invite');
  fs.writeFileSync(path.join(filesRoot, 'Φάκελος μελετών', 'μελέτη.pdf'), 'study');
  fs.writeFileSync(
    path.join(filesRoot, 'Επισυναπτόμενα Αρχεία Υποβολής', 'Δικαιολογητικά', 'βεβαίωση.pdf'),
    'cert'
  );

  const linkedSrc = path.join(srcRoot, 'τοπογραφικο.pdf');
  fs.writeFileSync(linkedSrc, 'topo');

  const result = await handler.exportProsklisi({
    prosklisi: {
      title: 'Πρόσκληση σχολείων',
      code: 'PSK-100',
      axis: 'Εκπαίδευση',
      fundingSource: 'ΕΣΠΑ 2021-2027',
      budgetRange: '100.000 - 200.000',
      status: 'Υπό Υποβολή',
      deadline: '2026-10-15',
      originalDeadline: '2026-09-01',
      diavgeiaAda: 'Ψ1234ΩΞΞ-ΑΑΑ',
      linkedProjectsLabel: 'Οδικό δίκτυο Αρχανών',
      linkedOrimanthiLabel: 'Ανακατασκευή οδού Αρχανών',
    },
    destParentDir: destParent,
    filesRoot,
    linkedOrimanthiFiles: [{
      categoryLabel: 'ΜΕΛΕΤΕΣ ΕΡΓΟΥ',
      subtitle: 'ΤΟΠΟΓΡΑΦΙΚΑ',
      fileName: 'τοπογραφικο.pdf',
      originalName: 'τοπογραφικο.pdf',
      sourcePath: linkedSrc,
    }],
    modifications: [{
      modificationDocumentDate: '2026-08-01',
      diavgeiaAda: 'ΨΜΟΔ7ΛΚ-8ΦΤ',
      changes: { deadline: { original: '2026-09-01', current: '2026-10-15' } },
    }],
    exportedBy: 'Ελένη',
    appVersion: '1.4.121',
  });

  assert.equal(result.success, true);
  const exportRoot = result.exportPath;
  assert.equal(path.basename(exportRoot), 'Πρόσκληση σχολείων');
  assert.equal(fs.existsSync(path.join(exportRoot, handler.WORD_FILE_NAME)), true);
  assert.equal(fs.existsSync(path.join(exportRoot, handler.FILES_EXPORT_FOLDER, 'πρόσκληση-όροι.pdf')), true);
  assert.equal(fs.existsSync(path.join(exportRoot, handler.FILES_EXPORT_FOLDER, 'Φάκελος μελετών', 'μελέτη.pdf')), true);
  assert.equal(
    fs.existsSync(path.join(
      exportRoot,
      handler.FILES_EXPORT_FOLDER,
      'Επισυναπτόμενα Αρχεία Υποβολής',
      'Δικαιολογητικά',
      'βεβαίωση.pdf'
    )),
    true
  );
  assert.equal(
    fs.existsSync(path.join(
      exportRoot,
      handler.LINKED_EXPORT_FOLDER,
      'ΜΕΛΕΤΕΣ ΕΡΓΟΥ',
      'ΤΟΠΟΓΡΑΦΙΚΑ',
      'τοπογραφικο.pdf'
    )),
    true
  );

  const word = fs.readFileSync(path.join(exportRoot, handler.WORD_FILE_NAME), 'utf8');
  assert.match(word, /Πρόσκληση σχολείων/);
  assert.match(word, /PSK-100/);
  assert.match(word, /πρόσκληση-όροι\.pdf/);
  assert.match(word, /μελέτη\.pdf/);
  assert.match(word, /βεβαίωση\.pdf/);
  assert.match(word, /τοπογραφικο\.pdf/);
  assert.match(word, /Οδικό δίκτυο Αρχανών/);
  assert.match(word, /Ψ1234ΩΞΞ-ΑΑΑ/);
  assert.match(word, /Τροποποίηση 1/);
  assert.equal(result.stats.missingCount, 0);
});

test('εξαγωγή χωρίς αρχεία δημιουργεί μόνο την αναφορά', async () => {
  const destParent = makeTempDir('psk-export-empty-');
  const result = await handler.exportProsklisi({
    prosklisi: { title: 'Κενή πρόσκληση', status: 'Υπό Ωρίμανση' },
    destParentDir: destParent,
    filesRoot: path.join(destParent, 'missing-files'),
    exportedBy: 'Νίκος',
  });
  assert.equal(result.success, true);
  assert.equal(fs.existsSync(path.join(result.exportPath, handler.WORD_FILE_NAME)), true);
  assert.equal(fs.existsSync(path.join(result.exportPath, handler.FILES_EXPORT_FOLDER)), false);
  const word = fs.readFileSync(path.join(result.exportPath, handler.WORD_FILE_NAME), 'utf8');
  assert.match(word, /Κενή πρόσκληση/);
});

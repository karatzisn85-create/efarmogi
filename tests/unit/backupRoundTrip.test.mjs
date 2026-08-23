import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWriteStream,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
  rmSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const bk = require('../../app/core/backupCatalog.js');
const apply = require('../../public/backupRestoreApply.js');
const archiver = require('archiver');
const yauzl = require('yauzl');

const PROJECT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const SUB_ID = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

const SECTORS = [
  'ΠΡΟΣΚΛΗΣΕΙΣ',
  'entaxeis',
  'EGKRISEIS_DIATHESIS_PISTOSIS',
  'ΜΕΛΕΤΕΣ',
  'ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ',
  'ΕΠΙΧΕΙΡΗΣΙΑΚΟ_ΠΡΟΓΡΑΜΜΑ',
  'ΑΠΟΛΟΓΙΣΜΟΣ',
  'ANATHESEIS_ERGASION',
  'config',
  'ΣΗΜΕΙΩΣΕΙΣ',
  'ektelestea_erga',
];

function makeDir(prefix = 'ergohub-rt-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

function walkFiles(root, relative = '') {
  const here = relative ? join(root, relative) : root;
  const out = [];
  for (const name of readdirSync(here)) {
    const rel = relative ? `${relative}/${name}` : name;
    const full = join(here, name);
    if (statSync(full).isDirectory()) out.push(...walkFiles(root, rel));
    else out.push(rel.replace(/\\/g, '/'));
  }
  return out.sort();
}

function seedLiveApp(dir) {
  writeFileSync(join(dir, 'users.json'), JSON.stringify({ name: 'Νίκος', role: 'SUPERADMIN' }));
  writeFileSync(join(dir, 'audit_log.json'), JSON.stringify({ logs: [{ id: 1 }] }));
  writeFileSync(join(dir, 'funding_options.json'), JSON.stringify({ items: ['ΕΣΠΑ'] }));
  SECTORS.forEach((name) => {
    mkdirSync(join(dir, name), { recursive: true });
  });
  writeFileSync(join(dir, 'ΠΡΟΣΚΛΗΣΕΙΣ', 'psk.json'), '{"id":"psk-1"}');
  writeFileSync(join(dir, 'entaxeis', 'ent.json'), '{"id":"ent-1"}');
  writeFileSync(join(dir, 'EGKRISEIS_DIATHESIS_PISTOSIS', 'egk.json'), '{"id":"egk-1"}');
  writeFileSync(join(dir, 'ΜΕΛΕΤΕΣ', 'meleti.json'), '{"id":"mlt-1"}');
  writeFileSync(join(dir, 'ΕΠΙΧΕΙΡΗΣΙΑΚΟ_ΠΡΟΓΡΑΜΜΑ', 'ep.json'), '{"id":"ep-1"}');
  writeFileSync(join(dir, 'ΑΠΟΛΟΓΙΣΜΟΣ', 'period.json'), '{"year":2026}');
  writeFileSync(join(dir, 'ANATHESEIS_ERGASION', 'task.json'), '{"id":"t-1"}');
  writeFileSync(join(dir, 'config', 'calendar.json'), '{"alerts":true}');
  writeFileSync(join(dir, 'ΣΗΜΕΙΩΣΕΙΣ', 'note.txt'), 'σημείωση');
  mkdirSync(join(dir, PROJECT_ID, SUB_ID, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ'), { recursive: true });
  writeFileSync(join(dir, PROJECT_ID, SUB_ID, 'data.json'), '{"title":"Γέφυρα"}');
  writeFileSync(join(dir, PROJECT_ID, SUB_ID, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ', 'σύμβαση.txt'), 'περιεχόμενο-σύμβασης');

  mkdirSync(join(dir, 'backups'));
  writeFileSync(join(dir, 'backups', 'keep.zip'), 'ΜΗ-ΜΠΕΙ');
  mkdirSync(join(dir, 'locks'));
  writeFileSync(join(dir, 'locks', 'x.lock'), 'lock');
  writeFileSync(join(dir, 'users.json.bak'), '{"old":true}');
  writeFileSync(join(dir, 'app-config.json'), '{"setupCompleted":true}');
  writeFileSync(join(dir, 'backup_location.json'), '{"location":"X:\\\\out"}');
}

function listLiveDataNames(dir) {
  return readdirSync(dir).filter((name) => !bk.isSkippedBackupEntry(name) && name !== 'backups');
}

function collectEntries(dir, names) {
  return names.map((name) => {
    const full = join(dir, name);
    return {
      path: full,
      relativePath: name,
      type: statSync(full).isDirectory() ? 'dir' : 'file',
    };
  });
}

async function packLikeProduction(dir, zipPath, { omit = [] } = {}) {
  const selected = listLiveDataNames(dir).filter((n) => !omit.includes(n));
  const entries = collectEntries(dir, selected);
  const emptySelectedDirs = [];
  await new Promise((resolve, reject) => {
    const out = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', reject);
    out.on('close', resolve);
    out.on('error', reject);
    archive.pipe(out);
    for (const file of entries) {
      if (bk.isSkippedBackupEntry(file.relativePath)) continue;
      if (!existsSync(file.path)) continue;
      const st = statSync(file.path);
      if (st.isDirectory()) {
        const kids = readdirSync(file.path);
        if (kids.length === 0) {
          emptySelectedDirs.push(file.relativePath);
          archive.append(Buffer.alloc(0), { name: `${file.relativePath.replace(/\\/g, '/')}/` });
        } else {
          archive.directory(file.path, file.relativePath);
        }
      } else {
        archive.file(file.path, { name: file.relativePath });
      }
    }
    archive.finalize();
  });
  return { selected, emptySelectedDirs };
}

function extractZip(zipPath, dest) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err);
        return;
      }
      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        const safe = apply.resolveSafeExtractPath(dest, entry.fileName);
        if (!safe) {
          zipfile.readEntry();
          return;
        }
        if (/\/$/.test(entry.fileName)) {
          mkdirSync(safe, { recursive: true });
          zipfile.readEntry();
          return;
        }
        mkdirSync(dirname(safe), { recursive: true });
        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr) {
            reject(streamErr);
            return;
          }
          const writeStream = createWriteStream(safe);
          readStream.pipe(writeStream);
          writeStream.on('close', () => zipfile.readEntry());
          writeStream.on('error', reject);
        });
      });
      zipfile.on('end', resolve);
      zipfile.on('error', reject);
    });
  });
}

async function createVerifiedBackup(liveDir, zipPath, opts) {
  const packed = await packLikeProduction(liveDir, zipPath, opts);
  const zipTopLevel = await apply.listZipTopLevelNames(zipPath);
  const coverage = bk.evaluateBackupCoverage({
    liveEntries: listLiveDataNames(liveDir),
    selectedEntries: packed.selected,
    zipTopLevel,
    emptySelectedDirs: packed.emptySelectedDirs,
  });
  return { ...packed, zipTopLevel, coverage };
}

test('κύκλος αντιγράφου: πληρότητα και επαναφορά όλων των τομέων χωρίς απώλεια αρχείων', async () => {
  const live = makeDir();
  const zipDir = makeDir();
  const extractTo = makeDir();
  const restored = makeDir();
  seedLiveApp(live);
  mkdirSync(join(restored, 'backups'));
  writeFileSync(join(restored, 'backups', 'keep.zip'), 'ΜΗ-ΜΠΕΙ');
  writeFileSync(join(restored, 'users.json'), '{"name":"παλιό"}');

  const zipPath = join(zipDir, 'full.zip');
  const created = await createVerifiedBackup(live, zipPath);
  assert.equal(created.coverage.ok, true, created.coverage.message);
  assert.deepEqual(bk.missingExpectedRestoreAreas(created.coverage.areas), []);
  assert.ok(created.coverage.areas.some((a) => a.startsWith('Έργα / υποέργα')));
  assert.ok(created.emptySelectedDirs.includes('ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ'));
  assert.ok(created.emptySelectedDirs.includes('ektelestea_erga'));
  assert.ok(created.zipTopLevel.includes('ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ'));
  assert.ok(!created.zipTopLevel.includes('backups'));
  assert.ok(!created.zipTopLevel.includes('users.json.bak'));
  assert.ok(!created.zipTopLevel.includes('app-config.json'));

  await extractZip(zipPath, extractTo);
  const sourceDir = apply.resolveExtractedSourceDir(extractTo);
  const result = await apply.applyFullRestore({
    dataDir: restored,
    sourceDir,
    backupDir: join(restored, 'backups'),
  });

  assert.equal(JSON.parse(readFileSync(join(restored, 'users.json'), 'utf8')).name, 'Νίκος');
  assert.equal(readFileSync(join(restored, 'ΠΡΟΣΚΛΗΣΕΙΣ', 'psk.json'), 'utf8'), '{"id":"psk-1"}');
  assert.equal(readFileSync(join(restored, 'entaxeis', 'ent.json'), 'utf8'), '{"id":"ent-1"}');
  assert.equal(readFileSync(join(restored, 'EGKRISEIS_DIATHESIS_PISTOSIS', 'egk.json'), 'utf8'), '{"id":"egk-1"}');
  assert.equal(readFileSync(join(restored, 'ΜΕΛΕΤΕΣ', 'meleti.json'), 'utf8'), '{"id":"mlt-1"}');
  assert.equal(readFileSync(join(restored, 'ΕΠΙΧΕΙΡΗΣΙΑΚΟ_ΠΡΟΓΡΑΜΜΑ', 'ep.json'), 'utf8'), '{"id":"ep-1"}');
  assert.equal(readFileSync(join(restored, 'ΑΠΟΛΟΓΙΣΜΟΣ', 'period.json'), 'utf8'), '{"year":2026}');
  assert.equal(readFileSync(join(restored, 'ANATHESEIS_ERGASION', 'task.json'), 'utf8'), '{"id":"t-1"}');
  assert.equal(readFileSync(join(restored, 'config', 'calendar.json'), 'utf8'), '{"alerts":true}');
  assert.equal(readFileSync(join(restored, 'ΣΗΜΕΙΩΣΕΙΣ', 'note.txt'), 'utf8'), 'σημείωση');
  assert.equal(JSON.parse(readFileSync(join(restored, PROJECT_ID, SUB_ID, 'data.json'), 'utf8')).title, 'Γέφυρα');
  assert.equal(
    readFileSync(join(restored, PROJECT_ID, SUB_ID, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ', 'σύμβαση.txt'), 'utf8'),
    'περιεχόμενο-σύμβασης'
  );
  assert.ok(existsSync(join(restored, 'ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ')));
  assert.equal(readFileSync(join(restored, 'backups', 'keep.zip'), 'utf8'), 'ΜΗ-ΜΠΕΙ');
  assert.equal(existsSync(join(restored, 'users.json.bak')), false);

  const liveFiles = walkFiles(live).filter((rel) => !bk.isSkippedBackupEntry(rel.split('/')[0]));
  const restoredFiles = walkFiles(restored).filter((rel) => !bk.isSkippedBackupEntry(rel.split('/')[0]));
  assert.deepEqual(restoredFiles, liveFiles);
  liveFiles.forEach((rel) => {
    assert.equal(
      readFileSync(join(restored, rel), 'utf8'),
      readFileSync(join(live, rel), 'utf8'),
      rel
    );
  });
  assert.ok(result.applied.includes('ΑΠΟΛΟΓΙΣΜΟΣ'));
  assert.ok(result.applied.includes('ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ'));
  assert.ok(result.applied.includes(PROJECT_ID));

  rmSync(live, { recursive: true, force: true });
  rmSync(zipDir, { recursive: true, force: true });
  rmSync(extractTo, { recursive: true, force: true });
  rmSync(restored, { recursive: true, force: true });
});

test('κύκλος αντιγράφου: αν λείπει γεμάτος τομέας το zip απορρίπτεται και τα ζωντανά μένουν', async () => {
  const live = makeDir();
  const zipDir = makeDir();
  seedLiveApp(live);
  writeFileSync(join(live, 'users.json'), '{"name":"τρέχον-ασφαλές"}');
  const zipPath = join(zipDir, 'bad.zip');
  const created = await createVerifiedBackup(live, zipPath, { omit: ['ΑΠΟΛΟΓΙΣΜΟΣ'] });
  assert.equal(created.coverage.ok, false);
  assert.ok(created.coverage.missing.includes('ΑΠΟΛΟΓΙΣΜΟΣ'));
  assert.match(created.coverage.message, /Απολογισμός/);
  assert.equal(JSON.parse(readFileSync(join(live, 'users.json'), 'utf8')).name, 'τρέχον-ασφαλές');
  assert.ok(existsSync(join(live, 'ΑΠΟΛΟΓΙΣΜΟΣ', 'period.json')));
  rmSync(live, { recursive: true, force: true });
  rmSync(zipDir, { recursive: true, force: true });
});

test('κύκλος αντιγράφου: λείπει ωρίμανση ή έργα → απόρριψη', async () => {
  const live = makeDir();
  const zipDir = makeDir();
  seedLiveApp(live);
  writeFileSync(join(live, 'ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ', 'card.json'), '{"id":"ori-1"}');
  const zipPath = join(zipDir, 'no-ori.zip');
  const created = await createVerifiedBackup(live, zipPath, { omit: ['ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ', PROJECT_ID] });
  assert.equal(created.coverage.ok, false);
  assert.ok(created.coverage.missing.includes('ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ'));
  assert.ok(created.coverage.missing.includes(PROJECT_ID));
  rmSync(live, { recursive: true, force: true });
  rmSync(zipDir, { recursive: true, force: true });
});

test('κύκλος αντιγράφου: ημιτελές / κατεστραμμένο zip δεν διαβάζεται ως πλήρες', async () => {
  const dir = makeDir();
  const zipPath = join(dir, 'broken.zip');
  writeFileSync(zipPath, 'αυτό-δεν-είναι-zip');
  await assert.rejects(() => apply.listZipTopLevelNames(zipPath));
  rmSync(dir, { recursive: true, force: true });
});

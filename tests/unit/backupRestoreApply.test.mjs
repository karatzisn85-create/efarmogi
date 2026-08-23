import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWriteStream, mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const apply = require('../../public/backupRestoreApply.js');
const archiver = require('archiver');

function makeDir() {
  return mkdtempSync(join(tmpdir(), 'ergohub-restore-'));
}

test('επαναφορά: αντικαθιστά ζωντανά, σβήνει περισσευούμενα, δεν αγγίζει αντίγραφα', async () => {
  const live = makeDir();
  const source = makeDir();
  const backups = join(live, 'backups');
  mkdirSync(backups);
  writeFileSync(join(backups, 'keep.zip'), 'zip');
  writeFileSync(join(live, 'users.json'), '{"name":"τρέχον"}');
  writeFileSync(join(live, 'extra.json'), 'περισσευούμενο');
  mkdirSync(join(live, 'proj-old'));
  writeFileSync(join(live, 'proj-old', 'data.json'), '{"t":"παλιό"}');
  writeFileSync(join(source, 'users.json'), '{"name":"από αντίγραφο"}');
  mkdirSync(join(source, 'proj-new'));
  writeFileSync(join(source, 'proj-new', 'data.json'), '{"t":"νέο"}');

  const result = await apply.applyFullRestore({ dataDir: live, sourceDir: source, backupDir: backups });
  assert.ok(result.applied.includes('users.json'));

  assert.equal(JSON.parse(readFileSync(join(live, 'users.json'), 'utf8')).name, 'από αντίγραφο');
  assert.equal(existsSync(join(live, 'extra.json')), false);
  assert.equal(existsSync(join(live, 'proj-old')), false);
  assert.equal(JSON.parse(readFileSync(join(live, 'proj-new', 'data.json'), 'utf8')).t, 'νέο');
  assert.equal(readFileSync(join(backups, 'keep.zip'), 'utf8'), 'zip');
});

test('επαναφορά: κενό αντίγραφο δεν εφαρμόζεται', async () => {
  const live = makeDir();
  const source = makeDir();
  writeFileSync(join(live, 'users.json'), '{"name":"τρέχον"}');
  mkdirSync(join(source, 'backups'));
  await assert.rejects(
    () => apply.applyFullRestore({ dataDir: live, sourceDir: source }),
    /κενό/
  );
  assert.equal(JSON.parse(readFileSync(join(live, 'users.json'), 'utf8')).name, 'τρέχον');
});

test('επαναφορά: αποτυχία μετά μερική αλλαγή → γύρισμα από αντίγραφο ασφαλείας', async () => {
  const live = makeDir();
  const restored = makeDir();
  const safety = makeDir();
  writeFileSync(join(live, 'users.json'), '{"name":"τρέχον"}');
  writeFileSync(join(safety, 'users.json'), '{"name":"τρέχον"}');
  writeFileSync(join(restored, 'users.json'), '{"name":"από αντίγραφο"}');
  writeFileSync(join(restored, 'only-in-backup.json'), 'x');

  await apply.applyFullRestore({ dataDir: live, sourceDir: restored });
  assert.equal(JSON.parse(readFileSync(join(live, 'users.json'), 'utf8')).name, 'από αντίγραφο');
  assert.equal(existsSync(join(live, 'only-in-backup.json')), true);

  await apply.applyFullRestore({ dataDir: live, sourceDir: safety });
  assert.equal(JSON.parse(readFileSync(join(live, 'users.json'), 'utf8')).name, 'τρέχον');
  assert.equal(existsSync(join(live, 'only-in-backup.json')), false);
});

test('επαναφορά: εφαρμόζονται όλοι οι επιμέρους τομείς', async () => {
  const live = makeDir();
  const source = makeDir();
  const folders = [
    'ΠΡΟΣΚΛΗΣΕΙΣ', 'entaxeis', 'EGKRISEIS_DIATHESIS_PISTOSIS', 'ΜΕΛΕΤΕΣ',
    'ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ', 'ΕΠΙΧΕΙΡΗΣΙΑΚΟ_ΠΡΟΓΡΑΜΜΑ', 'ΑΠΟΛΟΓΙΣΜΟΣ',
    'ANATHESEIS_ERGASION', 'config', 'ΣΗΜΕΙΩΣΕΙΣ'
  ];
  writeFileSync(join(source, 'users.json'), '{"ok":1}');
  folders.forEach((name) => {
    mkdirSync(join(source, name));
    writeFileSync(join(source, name, 'marker.json'), JSON.stringify({ name }));
  });
  mkdirSync(join(source, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'));
  writeFileSync(join(source, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'data.json'), '{"t":1}');

  const result = await apply.applyFullRestore({ dataDir: live, sourceDir: source });
  assert.ok(existsSync(join(live, 'users.json')));
  folders.forEach((name) => {
    assert.ok(existsSync(join(live, name, 'marker.json')), name);
  });
  assert.ok(existsSync(join(live, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'data.json')));
  assert.ok(result.applied.includes('ΑΠΟΛΟΓΙΣΜΟΣ'));
  assert.ok(result.applied.includes('ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ'));
  assert.ok(result.applied.includes('ΕΠΙΧΕΙΡΗΣΙΑΚΟ_ΠΡΟΓΡΑΜΜΑ'));
});

test('επαναφορά: παλιό zip με φάκελο dedomena_ergon', () => {
  const extract = makeDir();
  const nested = join(extract, 'dedomena_ergon');
  mkdirSync(nested);
  writeFileSync(join(nested, 'users.json'), '{"ok":true}');
  const source = apply.resolveExtractedSourceDir(extract);
  assert.equal(source, nested);
  assert.equal(apply.isExtractedRestoreReady(source), true);
});

test('αντίγραφο: η λίστα κορυφαίων ονομάτων του zip', async () => {
  const dir = makeDir();
  const zipPath = join(dir, 'pack.zip');
  const src = join(dir, 'src');
  mkdirSync(src);
  writeFileSync(join(src, 'users.json'), '{"ok":1}');
  mkdirSync(join(src, 'ΑΠΟΛΟΓΙΣΜΟΣ'));
  writeFileSync(join(src, 'ΑΠΟΛΟΓΙΣΜΟΣ', 'x.json'), '{}');
  await new Promise((resolve, reject) => {
    const out = createWriteStream(zipPath);
    const archive = archiver('zip');
    archive.on('error', reject);
    out.on('close', resolve);
    archive.pipe(out);
    archive.file(join(src, 'users.json'), { name: 'users.json' });
    archive.directory(join(src, 'ΑΠΟΛΟΓΙΣΜΟΣ'), 'ΑΠΟΛΟΓΙΣΜΟΣ');
    archive.finalize();
  });
  const names = await apply.listZipTopLevelNames(zipPath);
  assert.ok(names.includes('users.json'));
  assert.ok(names.includes('ΑΠΟΛΟΓΙΣΜΟΣ'));
});

test('διαδρομή εξαγωγής δεν βγαίνει εκτός φακέλου', () => {
  const root = makeDir();
  assert.equal(apply.resolveSafeExtractPath(root, '..\\outside.txt'), null);
  assert.ok(apply.resolveSafeExtractPath(root, 'users.json'));
});

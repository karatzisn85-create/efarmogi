import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const apply = require('../../public/backupRestoreApply.js');

function makeDir() {
  return mkdtempSync(join(tmpdir(), 'ergohub-restore-'));
}

test('επαναφορά: αντικαθιστά ζωντανά, σβήνει περισσευούμενα, δεν αγγίζει αντίγραφα', () => {
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

  apply.applyFullRestore({ dataDir: live, sourceDir: source, backupDir: backups });

  assert.equal(JSON.parse(readFileSync(join(live, 'users.json'), 'utf8')).name, 'από αντίγραφο');
  assert.equal(existsSync(join(live, 'extra.json')), false);
  assert.equal(existsSync(join(live, 'proj-old')), false);
  assert.equal(JSON.parse(readFileSync(join(live, 'proj-new', 'data.json'), 'utf8')).t, 'νέο');
  assert.equal(readFileSync(join(backups, 'keep.zip'), 'utf8'), 'zip');
});

test('επαναφορά: κενό αντίγραφο δεν εφαρμόζεται', () => {
  const live = makeDir();
  const source = makeDir();
  writeFileSync(join(live, 'users.json'), '{"name":"τρέχον"}');
  mkdirSync(join(source, 'backups'));
  assert.throws(
    () => apply.applyFullRestore({ dataDir: live, sourceDir: source }),
    /κενό/
  );
  assert.equal(JSON.parse(readFileSync(join(live, 'users.json'), 'utf8')).name, 'τρέχον');
});

test('επαναφορά: αποτυχία μετά μερική αλλαγή → γύρισμα από αντίγραφο ασφαλείας', () => {
  const live = makeDir();
  const restored = makeDir();
  const safety = makeDir();
  writeFileSync(join(live, 'users.json'), '{"name":"τρέχον"}');
  writeFileSync(join(safety, 'users.json'), '{"name":"τρέχον"}');
  writeFileSync(join(restored, 'users.json'), '{"name":"από αντίγραφο"}');
  writeFileSync(join(restored, 'only-in-backup.json'), 'x');

  apply.applyFullRestore({ dataDir: live, sourceDir: restored });
  assert.equal(JSON.parse(readFileSync(join(live, 'users.json'), 'utf8')).name, 'από αντίγραφο');
  assert.equal(existsSync(join(live, 'only-in-backup.json')), true);

  apply.applyFullRestore({ dataDir: live, sourceDir: safety });
  assert.equal(JSON.parse(readFileSync(join(live, 'users.json'), 'utf8')).name, 'τρέχον');
  assert.equal(existsSync(join(live, 'only-in-backup.json')), false);
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

test('διαδρομή εξαγωγής δεν βγαίνει εκτός φακέλου', () => {
  const root = makeDir();
  assert.equal(apply.resolveSafeExtractPath(root, '..\\outside.txt'), null);
  assert.ok(apply.resolveSafeExtractPath(root, 'users.json'));
});

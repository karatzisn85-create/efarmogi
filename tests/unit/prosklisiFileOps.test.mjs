import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ops = require('../../public/prosklisiFileOps.js');

function makeProsklisiDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'psk-files-'));
  const main = path.join(dir, ops.FILES_ROOT_NAME);
  fs.mkdirSync(main, { recursive: true });
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify({
    title: 'Δοκιμή',
    prosklisiFiles: [],
    fileGroups: [],
  }));
  return dir;
}

test('διαγραφή ομάδας με υποομάδα δεν αφήνει άδειο φάκελο στη λίστα', () => {
  const dir = makeProsklisiDir();
  const src = path.join(dir, 'src.pdf');
  fs.writeFileSync(src, 'x');
  ops.persistProsklisiData(dir, {
    title: 'Δοκιμή',
    prosklisiFiles: [{ fileName: 'src.pdf', originalName: 'src.pdf', targetFolder: 'attachments' }],
    fileGroups: [],
  });
  fs.mkdirSync(path.join(dir, ops.FILES_ROOT_NAME, 'Επισυναπτόμενα Αρχεία Υποβολής'), { recursive: true });
  fs.renameSync(src, path.join(dir, ops.FILES_ROOT_NAME, 'Επισυναπτόμενα Αρχεία Υποβολής', 'src.pdf'));

  const parent = ops.organizeFiles(dir, { action: 'new', title: 'Δικαιολογητικά', fileNames: [] });
  assert.equal(parent.ok, true);
  const sub = ops.organizeFiles(dir, {
    action: 'subgroup',
    parentGroupId: parent.groupId,
    title: 'Φορολογικά',
    fileNames: ['src.pdf'],
  });
  assert.equal(sub.ok, true);
  const nested = path.join(dir, ops.FILES_ROOT_NAME, 'Δικαιολογητικά', 'Φορολογικά', 'src.pdf');
  assert.equal(fs.existsSync(nested), true);

  const deleted = ops.deleteGroup(dir, parent.groupId);
  assert.equal(deleted.ok, true);
  assert.equal(fs.existsSync(path.join(dir, ops.FILES_ROOT_NAME, 'Δικαιολογητικά')), false);
  const listed = ops.listForUi(dir);
  assert.equal(listed.folders.main.some((f) => f.folderName === 'Δικαιολογητικά'), false);
  assert.equal(listed.fileGroups.length, 0);
  assert.equal(listed.files.attachments.some((f) => f.fileName === 'src.pdf'), true);
});

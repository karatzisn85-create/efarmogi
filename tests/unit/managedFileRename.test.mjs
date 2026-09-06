import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const rename = require('../../public/managedFileRename.js');

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ergohub-rename-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('μετονομασία μέσα στον φάκελο αποτυγχάνει αν το νέο όνομα υπάρχει ήδη', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'α.pdf'), 'a');
    fs.writeFileSync(path.join(dir, 'β.pdf'), 'b');
    const res = rename.renamePhysicalFile(dir, 'α.pdf', 'β.pdf');
    assert.equal(res.ok, false);
    assert.match(res.error, /υπάρχει ήδη/i);
  });
});

test('εύρεση αρχείου αγνοεί πεζά/κεφαλαία στο όνομα', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'Σύμβαση.pdf'), 'x');
    const found = rename.findNamedFile(dir, 'σύμβαση.pdf');
    assert.ok(found);
    assert.equal(path.basename(found), 'Σύμβαση.pdf');
  });
});

test('μετονομασία μόνο πεζών/κεφαλαίων στα Windows', { skip: process.platform !== 'win32' }, () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'File.pdf'), 'x');
    const res = rename.renamePhysicalFile(dir, 'File.pdf', 'file.pdf');
    assert.equal(res.ok, true);
    assert.equal(res.newName, 'file.pdf');
    assert.equal(fs.existsSync(path.join(dir, 'file.pdf')), true);
    const names = fs.readdirSync(dir);
    assert.deepEqual(names.map((n) => n.toLowerCase()), ['file.pdf']);
  });
});

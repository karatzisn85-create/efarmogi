import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function coveredIdsFromRoadmap(markdown) {
  const ids = [];
  const re = /`(P\d+-\d+)`[^\n]*καλύφθηκε/gi;
  let m;
  while ((m = re.exec(markdown))) ids.push(m[1]);
  return ids;
}

function specIds(specDir) {
  const found = new Set();
  const files = readdirSync(specDir).filter((f) => f.endsWith('.spec.cjs') && /^(p\d+-)/i.test(f));
  files.forEach((file) => {
    const text = readFileSync(join(specDir, file), 'utf8');
    const re = /test\('((?:P\d+-\d+)[^']*)'/g;
    let m;
    while ((m = re.exec(text))) {
      const id = m[1].match(/P\d+-\d+/);
      if (id) found.add(id[0]);
    }
  });
  return { files, ids: found };
}

test('κάθε id του ROADMAP που λέει καλύφθηκε υπάρχει σε spec', () => {
  const roadmap = readFileSync(join(root, 'e2e/ROADMAP.md'), 'utf8');
  const covered = coveredIdsFromRoadmap(roadmap);
  assert.ok(covered.length > 0, 'το ROADMAP πρέπει να έχει τουλάχιστον ένα καλύφθηκε id');
  const { ids } = specIds(join(root, 'e2e'));
  covered.forEach((id) => {
    assert.ok(ids.has(id), `λείπει spec για ${id}`);
  });
});

test('τα σταθερά specs δεν ανοίγουν Electron ούτε κάνουν login', () => {
  const { files } = specIds(join(root, 'e2e'));
  assert.ok(files.length > 0);
  files.forEach((file) => {
    const text = readFileSync(join(root, 'e2e', file), 'utf8');
    assert.equal(/electron/i.test(text), false, `${file} δεν πρέπει να αναφέρει Electron`);
    assert.equal(/login|password/i.test(text), false, `${file} δεν πρέπει να κάνει login`);
  });
});

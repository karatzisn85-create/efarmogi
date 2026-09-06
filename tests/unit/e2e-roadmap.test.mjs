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
    const add = (raw) => {
      const id = String(raw || '').match(/P\d+-\d+/);
      if (id) found.add(id[0]);
    };
    let m;
    const reTest = /test\(['`]((?:P\d+-\d+)[^'`]*)['`]/g;
    while ((m = reTest.exec(text))) add(m[1]);
    const rePair = /\[\s*['"](P\d+-\d+)['"]\s*,/g;
    while ((m = rePair.exec(text))) add(m[1]);
  });
  return { files, ids: found };
}

test('κάθε id του ROADMAP που λέει καλύφθηκε υπάρχει σε spec', () => {
  const roadmap = readFileSync(join(root, 'e2e/ROADMAP.md'), 'utf8');
  const covered = coveredIdsFromRoadmap(roadmap);
  assert.ok(covered.length > 0, 'το ROADMAP πρέπει να έχει τουλάχιστον ένα καλύφθηκε id');
  const { ids } = specIds(join(root, 'e2e'));
  const missing = covered.filter((id) => !ids.has(id));
  assert.deepEqual(missing, [], `λείπουν specs: ${missing.join(', ')}`);
});

// Τα σταθερά specs ανοίγουν την πραγματική εφαρμογή σε προσωρινό φάκελο (real-app),
// όχι το παλιό harness στο πρόγραμμα περιήγησης.
test('τα σταθερά specs τρέχουν πάνω στην πραγματική εφαρμογή', () => {
  const { files } = specIds(join(root, 'e2e'));
  assert.ok(files.length > 0);
  files.forEach((file) => {
    const text = readFileSync(join(root, 'e2e', file), 'utf8');
    assert.match(
      text,
      /require\('\.\/helpers\/real-app\.cjs'\)/,
      `${file} πρέπει να ανοίγει την πραγματική εφαρμογή`
    );
    (text.match(/page\.goto\(\s*['"][^'"]*['"]/g) || []).forEach((call) => {
      assert.doesNotMatch(
        call,
        /\/e2e\/harness\//,
        `${file} δεν πρέπει να ανοίγει σελίδες του παλιού harness`
      );
    });
  });
});

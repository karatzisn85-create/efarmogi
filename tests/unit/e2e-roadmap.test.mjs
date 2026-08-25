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

// Τα σταθερά specs τρέχουν πάνω στο harness, ποτέ πάνω στην πραγματική εφαρμογή.
// Ελέγχουμε τα πραγματικά σημάδια εξάρτησης — όχι λέξεις όπως «login», που ανήκουν
// κανονικά στο λεξιλόγιο των σεναρίων (π.χ. προσομοιωμένη οθόνη σύνδεσης του harness).
const REAL_APP_SIGNALS = [
  { re: /electron/i, why: 'δεν πρέπει να αναφέρει Electron' },
  { re: /passwordAuth|hashPassword|passwordHash|users\.json/i, why: 'δεν πρέπει να αγγίζει τον πραγματικό μηχανισμό κωδικών' },
  { re: /require\(\s*['"](?:fs|path|os|child_process)['"]\s*\)/, why: 'δεν πρέπει να αγγίζει το σύστημα αρχείων' }
];

test('τα σταθερά specs τρέχουν μόνο πάνω στο harness', () => {
  const { files } = specIds(join(root, 'e2e'));
  assert.ok(files.length > 0);
  files.forEach((file) => {
    const text = readFileSync(join(root, 'e2e', file), 'utf8');
    REAL_APP_SIGNALS.forEach(({ re, why }) => {
      assert.equal(re.test(text), false, `${file} ${why}`);
    });
    (text.match(/page\.goto\(\s*['"][^'"]*['"]/g) || []).forEach((call) => {
      assert.match(call, /\/e2e\/harness\//, `${file} επιτρέπεται να ανοίγει μόνο σελίδες του harness`);
    });
  });
});

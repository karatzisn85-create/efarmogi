import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const {
  pickGreekSpellLanguage,
  installBundledGreekDictionary,
  GREEK_DICT_FILENAME,
} = require('../../public/greekSpellcheck.js');

test('προτιμά el-GR όταν υπάρχει στη λίστα γλωσσών', () => {
  assert.equal(pickGreekSpellLanguage(['en-US', 'el-GR', 'fr']), 'el-GR');
  assert.equal(pickGreekSpellLanguage(['el']), 'el');
  assert.equal(pickGreekSpellLanguage([]), 'el-GR');
});

test('αντιγράφει το ελληνικό λεξικό στον φάκελο Dictionaries', () => {
  const root = mkdtempSync(join(tmpdir(), 'ergohub-dict-'));
  const src = join(root, GREEK_DICT_FILENAME);
  writeFileSync(src, 'dummy-bdic');
  const userData = join(root, 'user');
  const res = installBundledGreekDictionary(userData, src);
  assert.equal(res.ok, true);
  assert.equal(existsSync(res.dest), true);
  assert.equal(readFileSync(res.dest, 'utf8'), 'dummy-bdic');
});

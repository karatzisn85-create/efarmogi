import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { extractPdfText } = require('../../public/pdfTextExtract.js');
const dg = require('../../public/diavgeiaOpenData.js');
const parse = require('../../app/core/entaxiDiavgeiaParse.js');

test('ανάγνωση πραγματικού PDF ένταξης από Διαύγεια (ΨΩΚΖ7ΛΚ-8ΦΤ)', async (t) => {
  const ada = 'ΨΩΚΖ7ΛΚ-8ΦΤ';
  const dl = await dg.downloadDiavgeiaDecisionPdf(ada, {
    fileName: `Ένταξη — Διαύγεια ${ada}.pdf`,
  });
  if (!dl.success) {
    t.skip(dl.error || 'Η Διαύγεια δεν απάντησε');
    return;
  }
  assert.ok(fs.existsSync(dl.path));
  const extracted = await extractPdfText(dl.path, { maxPages: 8 });
  assert.equal(extracted.success, true, extracted.error || 'ανάγνωση PDF');
  const fields = parse.parseEntaxiPdfText(extracted.text);
  assert.equal(fields.legalCommitmentDeadline, '2025-02-24');
  assert.equal(fields.initialAmount, '37.200,00');
  assert.equal(fields.opsCode, '5225302');
  try { fs.unlinkSync(dl.path); } catch { /* temp */ }
  const leftover = path.join(os.tmpdir(), path.basename(dl.path));
  assert.ok(leftover);
});

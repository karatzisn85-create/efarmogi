import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const pdf = require('../../public/khmdhsPdfBrowserView.js');

test('URL PDF attachment ανά τύπο ΑΔΑΜ', () => {
  assert.equal(
    pdf.buildKhmdhsAttachmentUrl('24SYMV015882030'),
    'https://cerpp.eprocurement.gov.gr/khmdhs-opendata/contract/attachment/24SYMV015882030'
  );
  assert.equal(
    pdf.buildKhmdhsAttachmentUrl('25REQ016832258'),
    'https://cerpp.eprocurement.gov.gr/khmdhs-opendata/request/attachment/25REQ016832258'
  );
  assert.equal(pdf.buildKhmdhsAttachmentUrl('invalid'), null);
});

test('πύλη ΚΗΜΔΗΣ έχει URL με τον ΑΔΑΜ — δεν χρησιμοποιείται ως κύρια προβολή', () => {
  const url = pdf.buildKhmdhsPortalViewUrl('24SYMV015882030');
  assert.match(url, /upgkimdis\/unprotected\/home\.xhtml/);
  assert.match(url, /referenceNumber=24SYMV015882030/);
});

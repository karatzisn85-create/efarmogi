const { friendlyKhmdhsTransientHttpError } = require('./khmdhsHttpErrors');

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { pathToFileURL } = require('url');
const { shell } = require('electron');

const KHMDHS_BASE = 'https://cerpp.eprocurement.gov.gr';
const ATTACHMENT_SEGMENT = {
  REQ: 'request',
  PROC: 'notice',
  AWRD: 'auction',
  SYMV: 'contract',
  PAY: 'payment',
};

function normalizeAdam(adamRaw) {
  return String(adamRaw || '').trim().toUpperCase().replace(/\*+$/, '');
}

function buildKhmdhsAttachmentUrl(adamRaw) {
  const adam = normalizeAdam(adamRaw);
  const m = /^(\d{2})([A-Z]{3,4})(\d{9})$/i.exec(adam);
  if (!m) return null;
  const seg = ATTACHMENT_SEGMENT[m[2].toUpperCase()];
  if (!seg) return null;
  return `${KHMDHS_BASE}/khmdhs-opendata/${seg}/attachment/${encodeURIComponent(adam)}`;
}

function fetchUrlBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error('Πολλές ανακατευθύνσεις'));
      return;
    }
    const req = https.get(
      url,
      { headers: { Accept: 'application/pdf,application/octet-stream,*/*' } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          res.resume();
          fetchUrlBuffer(next, redirects + 1).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          const friendly = friendlyKhmdhsTransientHttpError(res.statusCode);
          reject(new Error(
            friendly || 'Προσωρινό πρόβλημα κατά την ανάκτηση του εγγράφου από το ΚΗΜΔΗΣ. Δοκιμάστε ξανά σε λίγο.'
          ));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy(new Error('Η ανάκτηση του εγγράφου διήρκεσε πολύ'));
    });
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function openKhmdhsPdfInBrowser(adamRaw, label = '') {
  const adam = normalizeAdam(adamRaw);
  if (!adam) return { success: false, error: 'Λείπει ΑΔΑΜ' };

  const pdfUrl = buildKhmdhsAttachmentUrl(adam);
  if (!pdfUrl) return { success: false, error: 'Άγνωστος τύπος ΑΔΑΜ για προβολή PDF' };

  const buffer = await fetchUrlBuffer(pdfUrl);
  if (!buffer?.length) {
    return { success: false, error: 'Κενό αρχείο από ΚΗΜΔΗΣ' };
  }
  if (buffer.slice(0, 5).toString('ascii') !== '%PDF-') {
    return { success: false, error: 'Το έγγραφο δεν είναι έγκυρο PDF' };
  }

  const dir = path.join(os.tmpdir(), 'ergohub-khmdhs-view');
  fs.mkdirSync(dir, { recursive: true });
  const safeAdam = adam.replace(/[^A-Z0-9]/gi, '') || 'doc';
  const pdfPath = path.join(dir, `${safeAdam}.pdf`);
  const htmlPath = path.join(dir, `${safeAdam}.html`);
  fs.writeFileSync(pdfPath, buffer);

  const title = escapeHtml(label || `ΚΗΜΔΗΣ — ${adam}`);
  const pdfFileName = path.basename(pdfPath);
  const html = `<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    html, body { margin: 0; height: 100%; background: #525659; overflow: hidden; }
    embed { width: 100%; height: 100%; border: 0; display: block; }
  </style>
</head>
<body>
  <embed src="${pdfFileName}" type="application/pdf" />
</body>
</html>`;
  fs.writeFileSync(htmlPath, html, 'utf8');

  // Καθαρισμός παλιών αρχείων (αρχεία > 2 ωρών)
  try {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    const existing = fs.readdirSync(dir);
    for (const fname of existing) {
      if (fname === path.basename(pdfPath) || fname === path.basename(htmlPath)) continue;
      try {
        const fpath = path.join(dir, fname);
        const stat = fs.statSync(fpath);
        if (stat.mtimeMs < cutoff) fs.unlinkSync(fpath);
      } catch { /* αγνοούμε σφάλματα ανά αρχείο */ }
    }
  } catch { /* αγνοούμε αν το directory δεν είναι προσβάσιμο */ }

  // shell.openExternal επιστρέφει Promise<void> σε νεότερο Electron — δεν ελέγχουμε return value
  await shell.openExternal(pathToFileURL(htmlPath).href).catch((e) => {
    throw new Error(`Αδυναμία ανοίγματος εγγράφου: ${e.message}`);
  });
  return { success: true };
}

module.exports = {
  openKhmdhsPdfInBrowser,
  buildKhmdhsAttachmentUrl,
};

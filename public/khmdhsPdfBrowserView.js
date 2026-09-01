const { friendlyKhmdhsTransientHttpError } = require('./khmdhsHttpErrors');

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { pathToFileURL } = require('url');

const KHMDHS_BASE = 'https://cerpp.eprocurement.gov.gr';
const ATTACHMENT_SEGMENT = {
  REQ: 'request',
  PROC: 'notice',
  AWRD: 'auction',
  SYMV: 'contract',
  PAY: 'payment',
};
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DOWNLOAD_TIMEOUT_MS = 120000;
const prefetching = new Set();

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

/** Σελίδα πράξης στην πύλη — ανοίγει αμέσως, χωρίς να περιμένει λήψη PDF. */
function buildKhmdhsPortalViewUrl(adamRaw) {
  const adam = normalizeAdam(adamRaw);
  if (!adam) return `${KHMDHS_BASE}/upgkimdis/unprotected/home.xhtml`;
  const url = new URL(`${KHMDHS_BASE}/upgkimdis/unprotected/home.xhtml`);
  url.searchParams.set('referenceNumber', adam);
  return url.toString();
}

function viewDir() {
  return path.join(os.tmpdir(), 'ergohub-khmdhs-view');
}

function cachePaths(adam) {
  const dir = viewDir();
  const safeAdam = adam.replace(/[^A-Z0-9]/gi, '') || 'doc';
  return {
    dir,
    pdfPath: path.join(dir, `${safeAdam}.pdf`),
    htmlPath: path.join(dir, `${safeAdam}.html`),
  };
}

function readCachedPdfPath(adamRaw) {
  const adam = normalizeAdam(adamRaw);
  if (!adam) return null;
  const { pdfPath } = cachePaths(adam);
  try {
    const stat = fs.statSync(pdfPath);
    if (!stat.isFile() || stat.size < 8) return null;
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return null;
    const fd = fs.openSync(pdfPath, 'r');
    const header = Buffer.alloc(5);
    fs.readSync(fd, header, 0, 5, 0);
    fs.closeSync(fd);
    if (header.toString('ascii') !== '%PDF-') return null;
    return pdfPath;
  } catch {
    return null;
  }
}

function fetchUrlBuffer(url, { redirects = 0, timeoutMs = 120000 } = {}) {
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
          fetchUrlBuffer(next, { redirects: redirects + 1, timeoutMs }).then(resolve).catch(reject);
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
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Η ανάκτηση του εγγράφου διήρκεσε πολύ'));
    });
  });
}

function getShell() {
  return require('electron').shell;
}

async function openLocalPdf(pdfPath) {
  const resolved = path.resolve(pdfPath);
  cleanupOldCache([path.basename(resolved)]);
  const openErr = await getShell().openPath(resolved);
  if (!openErr) return;
  await getShell().openExternal(pathToFileURL(resolved).href).catch((e) => {
    throw new Error(`Αδυναμία ανοίγματος εγγράφου: ${e.message || openErr}`);
  });
}

function cleanupOldCache(keepBasenames) {
  try {
    const dir = viewDir();
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    const keep = new Set(keepBasenames || []);
    const existing = fs.readdirSync(dir);
    for (const fname of existing) {
      if (keep.has(fname)) continue;
      try {
        const fpath = path.join(dir, fname);
        const stat = fs.statSync(fpath);
        if (stat.mtimeMs < cutoff) fs.unlinkSync(fpath);
      } catch { /* αγνοούμε σφάλματα ανά αρχείο */ }
    }
  } catch { /* αγνοούμε αν το directory δεν είναι προσβάσιμο */ }
}

async function downloadKhmdhsPdfToCache(adamRaw) {
  const adam = normalizeAdam(adamRaw);
  const pdfUrl = buildKhmdhsAttachmentUrl(adam);
  if (!adam || !pdfUrl) {
    throw new Error('Άγνωστος τύπος ΑΔΑΜ για προβολή PDF');
  }
  if (readCachedPdfPath(adam)) return readCachedPdfPath(adam);
  if (prefetching.has(adam)) {
    const started = Date.now();
    while (prefetching.has(adam) && Date.now() - started < DOWNLOAD_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 200));
      if (readCachedPdfPath(adam)) return readCachedPdfPath(adam);
    }
  }
  prefetching.add(adam);
  try {
    const buffer = await fetchUrlBuffer(pdfUrl, { timeoutMs: DOWNLOAD_TIMEOUT_MS });
    if (!buffer?.length || buffer.slice(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error('Το ΚΗΜΔΗΣ δεν επέστρεψε έγκυρο αρχείο PDF');
    }
    const { dir, pdfPath } = cachePaths(adam);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${pdfPath}.part`;
    fs.writeFileSync(tmp, buffer);
    fs.renameSync(tmp, pdfPath);
    return pdfPath;
  } finally {
    prefetching.delete(adam);
  }
}

async function openKhmdhsPdfInBrowser(adamRaw, label = '') {
  const adam = normalizeAdam(adamRaw);
  if (!adam) return { success: false, error: 'Λείπει ΑΔΑΜ' };

  const pdfUrl = buildKhmdhsAttachmentUrl(adam);
  if (!pdfUrl) {
    const portalUrl = buildKhmdhsPortalViewUrl(adam);
    await getShell().openExternal(portalUrl).catch((e) => {
      throw new Error(`Αδυναμία ανοίγματος εγγράφου: ${e.message}`);
    });
    return {
      success: true,
      via: 'portal',
      warning: 'Δεν υπάρχει αρχείο PDF για αυτόν τον τύπο πράξης — ανοίγει η σελίδα του ΚΗΜΔΗΣ.',
    };
  }

  try {
    const cachedBefore = !!readCachedPdfPath(adam);
    const pdfPath = await downloadKhmdhsPdfToCache(adam);
    await openLocalPdf(pdfPath);
    return { success: true, via: 'pdf', cached: cachedBefore };
  } catch (e) {
    return {
      success: false,
      error: e?.message || 'Δεν ήταν δυνατή η προβολή του εγγράφου.',
    };
  }
}

async function prefetchKhmdhsPdfs(adamList) {
  try {
    const { isE2EProcess } = require('./e2eMode');
    if (isE2EProcess()) {
      return { success: true, queued: 0, ready: 0 };
    }
  } catch { /* χωρίς e2e stub συνεχίζουμε κανονικά */ }
  const seen = new Set();
  const adams = [];
  (Array.isArray(adamList) ? adamList : []).forEach((raw) => {
    const adam = normalizeAdam(raw);
    if (!adam || seen.has(adam) || !buildKhmdhsAttachmentUrl(adam)) return;
    seen.add(adam);
    adams.push(adam);
  });
  const queued = adams.slice(0, 12);
  let ready = 0;
  for (const adam of queued) {
    try {
      await downloadKhmdhsPdfToCache(adam);
      ready += 1;
    } catch {
      /* η προετοιμασία είναι καλύτερη προσπάθεια — το κλικ θα ξαναδοκιμάσει */
    }
  }
  return { success: true, queued: queued.length, ready };
}

module.exports = {
  openKhmdhsPdfInBrowser,
  prefetchKhmdhsPdfs,
  buildKhmdhsAttachmentUrl,
  buildKhmdhsPortalViewUrl,
  readCachedPdfPath,
};

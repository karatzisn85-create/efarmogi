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
const activePdfGets = new Map();
const cancelledViewAdams = new Set();

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

function fetchUrlBuffer(url, { redirects = 0, timeoutMs = 120000, adam = '' } = {}) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error('Πολλές ανακατευθύνσεις'));
      return;
    }
    const key = normalizeAdam(adam);
    if (key && cancelledViewAdams.has(key)) {
      reject(new Error('Ακυρώθηκε'));
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
          if (key) activePdfGets.delete(key);
          fetchUrlBuffer(next, { redirects: redirects + 1, timeoutMs, adam }).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          if (key) activePdfGets.delete(key);
          const friendly = friendlyKhmdhsTransientHttpError(res.statusCode);
          reject(new Error(
            friendly || 'Προσωρινό πρόβλημα κατά την ανάκτηση του εγγράφου από το ΚΗΜΔΗΣ. Δοκιμάστε ξανά σε λίγο.'
          ));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          if (key) activePdfGets.delete(key);
          resolve(Buffer.concat(chunks));
        });
      }
    );
    if (key) activePdfGets.set(key, req);
    req.on('error', (err) => {
      if (key) activePdfGets.delete(key);
      reject(err);
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Η ανάκτηση του εγγράφου διήρκεσε πολύ'));
    });
  });
}

function abortTrackedPdfGet(adam) {
  const key = normalizeAdam(adam);
  const req = key ? activePdfGets.get(key) : null;
  if (req) {
    try { req.destroy(new Error('Ακυρώθηκε')); } catch { /* ήδη κλειστό */ }
    activePdfGets.delete(key);
  }
}

function cancelKhmdhsPdfView(adamRaw) {
  const adam = normalizeAdam(adamRaw);
  if (adam) {
    cancelledViewAdams.add(adam);
    abortTrackedPdfGet(adam);
    prefetching.delete(adam);
  } else {
    [...activePdfGets.keys()].forEach((key) => {
      cancelledViewAdams.add(key);
      abortTrackedPdfGet(key);
    });
    prefetching.clear();
  }
  return { success: true };
}

function wasPdfViewCancelled(adamRaw) {
  return cancelledViewAdams.has(normalizeAdam(adamRaw));
}

function clearPdfViewCancelled(adamRaw) {
  cancelledViewAdams.delete(normalizeAdam(adamRaw));
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
      if (wasPdfViewCancelled(adam)) {
        throw new Error('Ακυρώθηκε');
      }
      await new Promise((r) => setTimeout(r, 200));
      if (readCachedPdfPath(adam)) return readCachedPdfPath(adam);
    }
  }
  prefetching.add(adam);
  try {
    if (wasPdfViewCancelled(adam)) {
      throw new Error('Ακυρώθηκε');
    }
    const buffer = await fetchUrlBuffer(pdfUrl, { timeoutMs: DOWNLOAD_TIMEOUT_MS, adam });
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
  clearPdfViewCancelled(adam);

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
    if (wasPdfViewCancelled(adam)) {
      return { success: false, cancelled: true };
    }
    await openLocalPdf(pdfPath);
    return { success: true, via: 'pdf', cached: cachedBefore };
  } catch (e) {
    if (wasPdfViewCancelled(adam) || /Ακυρώθηκε/.test(String(e?.message || ''))) {
      return { success: false, cancelled: true };
    }
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
  cancelKhmdhsPdfView,
  buildKhmdhsAttachmentUrl,
  buildKhmdhsPortalViewUrl,
  readCachedPdfPath,
};

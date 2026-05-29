/**
 * ERGOHUB - Portal Diafanias Dropbox Uploader
 *
 * Handles upload of erga.json to the shared Dropbox account used
 * for the public Transparency Portal of the municipality.
 *
 * Credentials are bundled at build time via environment variables
 * (PORTAL_DROPBOX_APP_KEY, PORTAL_DROPBOX_APP_SECRET, PORTAL_DROPBOX_REFRESH_TOKEN).
 * Set these in .env before building.
 */

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// ── Credentials (replace with real values before building) ─────────────────
// These must be hardcoded strings for the packaged Electron app.
// process.env is NOT available at runtime in the packaged exe.
const PORTAL_APP_KEY       = process.env.PORTAL_DROPBOX_APP_KEY     || 'mh35tdf8w14yyj9';
const PORTAL_APP_SECRET    = process.env.PORTAL_DROPBOX_APP_SECRET  || 'obzpbuph6jx8xya';
const PORTAL_REFRESH_TOKEN = process.env.PORTAL_DROPBOX_REFRESH_TOKEN || 'uHg8qKI_NVkAAAAAAAAAAcksBOQuKDinef1-7dgI-fynyaIkRDRvGOjI61tjtpqy';
// ────────────────────────────────────────────────────────────────────────────

const TOKEN_CACHE_FILE = () => path.join(app.getPath('userData'), 'portal-dropbox-token-cache.json');

function loadCachedToken() {
  try {
    const f = TOKEN_CACHE_FILE();
    if (fs.existsSync(f)) {
      return JSON.parse(fs.readFileSync(f, 'utf8'));
    }
  } catch (_) {}
  return null;
}

function saveCachedToken(data) {
  try {
    fs.writeFileSync(TOKEN_CACHE_FILE(), JSON.stringify(data, null, 2), 'utf8');
  } catch (_) {}
}

async function getAccessToken() {
  if (
    !PORTAL_APP_KEY || PORTAL_APP_KEY === 'REPLACE_WITH_APP_KEY' ||
    !PORTAL_APP_SECRET || PORTAL_APP_SECRET === 'REPLACE_WITH_APP_SECRET' ||
    !PORTAL_REFRESH_TOKEN || PORTAL_REFRESH_TOKEN === 'REPLACE_WITH_REFRESH_TOKEN'
  ) {
    throw new Error(
      'Τα credentials Dropbox για την Πύλη Διαφάνειας δεν έχουν οριστεί. ' +
      'Επεξεργαστείτε το αρχείο public/portalDropboxUploader.js και αντικαταστήστε τα REPLACE_WITH_* με τα πραγματικά credentials.'
    );
  }

  const cached = loadCachedToken();
  if (cached && cached.expires_at > Date.now() + 300_000) {
    return cached.access_token;
  }

  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${PORTAL_APP_KEY}:${PORTAL_APP_SECRET}`).toString('base64')}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: PORTAL_REFRESH_TOKEN
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Dropbox token refresh απέτυχε: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const cacheData = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000
  };
  saveCachedToken(cacheData);
  return cacheData.access_token;
}

function escapeUnicode(str) {
  return str.replace(/[\u0080-\uFFFF]/g, (c) => {
    return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
  });
}

/**
 * Upload a Buffer or string as a file to Dropbox (overwrite mode).
 * @param {Buffer|string} content
 * @param {string} dropboxPath  e.g. "/portal/archanes-asterousion/erga.json"
 * @param {string} accessToken
 */
async function uploadFile(content, dropboxPath, accessToken) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');

  const apiArg = escapeUnicode(JSON.stringify({
    path: dropboxPath,
    mode: 'overwrite',
    autorename: false,
    mute: false
  }));

  const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': apiArg
    },
    body: buffer
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Dropbox upload απέτυχε: ${response.status} - ${errText}`);
  }

  return await response.json();
}

/**
 * Ensure the Dropbox folder exists (creates it if not; ignores conflict error).
 */
async function ensureFolder(folderPath, accessToken) {
  const response = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ path: folderPath, autorename: false })
  });

  if (response.ok) return;

  const errText = await response.text();
  if (!errText.includes('path/conflict/folder')) {
    throw new Error(`Δεν ήταν δυνατή η δημιουργία φακέλου Dropbox: ${response.status} - ${errText}`);
  }
}

/**
 * Get public share link for a file (creates one if it doesn't exist).
 * Returns the direct-download URL (dl=1).
 */
async function getOrCreateShareLink(dropboxPath, accessToken) {
  // Try to create
  const createResp = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      path: dropboxPath,
      settings: { requested_visibility: 'public' }
    })
  });

  if (createResp.ok) {
    const result = await createResp.json();
    return toDlLink(result.url);
  }

  if (createResp.status === 409) {
    const errText = await createResp.text();
    if (errText.includes('shared_link_already_exists')) {
      return await getExistingShareLink(dropboxPath, accessToken);
    }
    throw new Error(`Σφάλμα δημιουργίας link Dropbox: ${createResp.status} - ${errText}`);
  }

  const errText = await createResp.text();
  throw new Error(`Σφάλμα δημιουργίας link Dropbox: ${createResp.status} - ${errText}`);
}

async function getExistingShareLink(dropboxPath, accessToken) {
  const resp = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ path: dropboxPath })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Αποτυχία ανάκτησης link Dropbox: ${resp.status} - ${errText}`);
  }

  const result = await resp.json();
  const link = result.links.find(l => l.path_lower === dropboxPath.toLowerCase());
  if (link) return toDlLink(link.url);
  throw new Error('Δεν βρέθηκε υπάρχον link Dropbox για το αρχείο.');
}

function toDlLink(url) {
  return url.replace(/[?&]dl=0/, (m) => m.charAt(0) + 'dl=1');
}

/**
 * Main entry point used by the IPC handler.
 *
 * @param {string} jsonContent  The UTF-8 JSON string to upload
 * @param {string} dimosUid     e.g. "archanes-asterousion"
 * @returns {{ dropboxLink: string }}
 */
async function uploadPortalJson(jsonContent, dimosUid) {
  const accessToken = await getAccessToken();
  const folderPath = `/portal/${dimosUid}`;
  const filePath   = `${folderPath}/erga.json`;

  await ensureFolder('/portal', accessToken);
  await ensureFolder(folderPath, accessToken);
  await uploadFile(jsonContent, filePath, accessToken);

  const dropboxLink = await getOrCreateShareLink(filePath, accessToken);
  return { dropboxLink };
}

module.exports = { uploadPortalJson };

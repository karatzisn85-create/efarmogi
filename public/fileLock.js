const fs = require('fs');
const os = require('os');

const STALE_MS = 15000;
const MAX_RETRIES = 10;
const RETRY_INTERVAL_MS = 200;

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* busy-wait — acceptable for sub-second sync pauses in Electron main process */
  }
}

function isLockStale(lockPath) {
  try {
    const raw = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    return !raw.ts || (Date.now() - raw.ts) > STALE_MS;
  } catch {
    return true;
  }
}

function acquireServiceLock(lockPath) {
  const payload = JSON.stringify({ pid: process.pid, host: os.hostname(), ts: Date.now() });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      fs.writeFileSync(lockPath, payload, { flag: 'wx' });
      return true;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      if (isLockStale(lockPath)) {
        try { fs.unlinkSync(lockPath); } catch {}
        continue;
      }
      if (attempt < MAX_RETRIES - 1) sleepSync(RETRY_INTERVAL_MS);
    }
  }
  console.warn('[fileLock] Could not acquire lock after', MAX_RETRIES, 'attempts:', lockPath);
  return false;
}

function releaseServiceLock(lockPath) {
  try { fs.unlinkSync(lockPath); } catch {}
}

function withServiceLock(lockPath, fn) {
  const acquired = acquireServiceLock(lockPath);
  try {
    return fn();
  } finally {
    if (acquired) releaseServiceLock(lockPath);
  }
}

module.exports = { acquireServiceLock, releaseServiceLock, withServiceLock };

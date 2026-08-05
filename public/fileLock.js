const fs = require('fs');
const os = require('os');

const STALE_MS = 15000;
/** Λιγότερα retries = λιγότερο μπλοκάρισμα main thread σε κοινό φάκελο (πριν: 8×100ms). */
const MAX_RETRIES = 4;
const RETRY_INTERVAL_MS = 120;

/**
 * Σύγχρονη παύση χωρίς spin-loop (λιγότερο κάψιμο CPU στο main process).
 * Το νήμα εξακολουθεί να περιμένει — γι' αυτό κρατάμε μικρότερα retries από πριν.
 */
function sleepSync(ms) {
  const waitMs = Math.max(0, Number(ms) || 0);
  if (waitMs <= 0) return;
  try {
    const sab = new SharedArrayBuffer(4);
    const ia = new Int32Array(sab);
    Atomics.wait(ia, 0, 0, waitMs);
    return;
  } catch {
    /* SharedArrayBuffer / Atomics μη διαθέσιμα */
  }
  const end = Date.now() + waitMs;
  while (Date.now() < end) {
    /* fallback busy-wait */
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
  // Χωρίς αποκλειστικό κλείδωμα δεν γράφουμε: δύο ταυτόχρονες ενημερώσεις
  // στο ευρετήριο θα μπορούσαν να σβήσουν η μία την άλλη.
  if (!acquired) {
    console.warn('[fileLock] Skipping protected write — lock not acquired:', lockPath);
    return undefined;
  }
  try {
    return fn();
  } finally {
    releaseServiceLock(lockPath);
  }
}

module.exports = {
  acquireServiceLock,
  releaseServiceLock,
  withServiceLock,
  STALE_MS,
  MAX_RETRIES,
  RETRY_INTERVAL_MS,
};

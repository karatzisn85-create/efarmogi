/**
 * @jest-environment node
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  acquireServiceLock,
  releaseServiceLock,
  withServiceLock,
  MAX_RETRIES,
  RETRY_INTERVAL_MS,
} = require('../../public/fileLock');

describe('fileLock — απόδοση σε κοινό φάκελο', () => {
  let lockPath;

  beforeEach(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eh-lock-'));
    lockPath = path.join(dir, 'test.lock');
  });

  afterEach(() => {
    try { releaseServiceLock(lockPath); } catch { /* ignore */ }
    try {
      fs.rmSync(path.dirname(lockPath), { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  test('όρια retries μειωμένα ώστε να μην μπλοκάρει έως 800ms', () => {
    expect(MAX_RETRIES).toBeLessThanOrEqual(4);
    expect(MAX_RETRIES * RETRY_INTERVAL_MS).toBeLessThanOrEqual(600);
  });

  test('withServiceLock εκτελεί και απελευθερώνει', () => {
    let ran = false;
    const result = withServiceLock(lockPath, () => {
      ran = true;
      expect(fs.existsSync(lockPath)).toBe(true);
      return 42;
    });
    expect(ran).toBe(true);
    expect(result).toBe(42);
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  test('δεύτερο κλείδωμα αποτυγχάνει όσο κρατάει το πρώτο — χωρίς εγγραφή', () => {
    expect(acquireServiceLock(lockPath)).toBe(true);
    const started = Date.now();
    const second = acquireServiceLock(lockPath);
    const elapsed = Date.now() - started;
    expect(second).toBe(false);
    // 3 παύσεις × 120ms ≈ 360ms σε ήσυχο μηχάνημα. Σε φορτωμένο Windows
    // (antivirus, παράλληλα tests) το Atomics.wait ξεφεύγει — δεν είναι
    // αποτυχία πολιτικής όσο μένει κάτω από μερικά δευτερόλεπτα.
    // Τα σταθερά όρια retries ελέγχονται στο προηγούμενο test.
    expect(elapsed).toBeGreaterThanOrEqual(RETRY_INTERVAL_MS);
    expect(elapsed).toBeLessThan(3000);
    releaseServiceLock(lockPath);
  });

  test('withServiceLock χωρίς κλείδωμα επιστρέφει undefined και δεν τρέχει fn', () => {
    expect(acquireServiceLock(lockPath)).toBe(true);
    let ran = false;
    const result = withServiceLock(lockPath, () => {
      ran = true;
      return 'nope';
    });
    expect(ran).toBe(false);
    expect(result).toBeUndefined();
    releaseServiceLock(lockPath);
  });
});

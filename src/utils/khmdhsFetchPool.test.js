/**
 * @jest-environment node
 */
const {
  runWithKhmdhsFetchContext,
  mapWithConcurrency,
  cachedFetch,
  reportKhmdhsProgress,
  getKhmdhsFetchContext,
} = require('../../public/khmdhsFetchPool');

describe('khmdhsFetchPool', () => {
  test('mapWithConcurrency περιορίζει ταυτόχρονα και διατηρεί σειρά', async () => {
    let live = 0;
    let maxLive = 0;
    const items = [1, 2, 3, 4, 5, 6];
    const out = await mapWithConcurrency(items, 2, async (n) => {
      live += 1;
      maxLive = Math.max(maxLive, live);
      await new Promise((r) => setTimeout(r, 15));
      live -= 1;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50, 60]);
    expect(maxLive).toBeLessThanOrEqual(2);
  });

  test('cachedFetch καλεί μία φορά για το ίδιο κλειδί', async () => {
    let calls = 0;
    await runWithKhmdhsFetchContext({}, async () => {
      const a = await cachedFetch('contract', 'A1', async () => {
        calls += 1;
        return { adam: 'A1' };
      });
      const b = await cachedFetch('contract', 'A1', async () => {
        calls += 1;
        return { adam: 'SHOULD_NOT' };
      });
      expect(a).toEqual({ adam: 'A1' });
      expect(b).toEqual({ adam: 'A1' });
      expect(calls).toBe(1);
    });
  });

  test('cachedFetch dedupe παράλληλων in-flight', async () => {
    let calls = 0;
    await runWithKhmdhsFetchContext({}, async () => {
      const p1 = cachedFetch('contract', 'X', async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 30));
        return 42;
      });
      const p2 = cachedFetch('contract', 'X', async () => {
        calls += 1;
        return 99;
      });
      const [a, b] = await Promise.all([p1, p2]);
      expect(a).toBe(42);
      expect(b).toBe(42);
      expect(calls).toBe(1);
    });
  });

  test('κοινό cache μεταξύ διαδοχικών run με το ίδιο Map', async () => {
    const contractCache = new Map();
    let calls = 0;
    const fetchOnce = () => cachedFetch('contract', 'S1', async () => {
      calls += 1;
      return 'ok';
    });
    await runWithKhmdhsFetchContext({ contractCache }, fetchOnce);
    await runWithKhmdhsFetchContext({ contractCache }, fetchOnce);
    expect(calls).toBe(1);
    expect(contractCache.get('S1')).toBe('ok');
  });

  test('cachedFetch δεν αποθηκεύει soft-failure null', async () => {
    let calls = 0;
    await runWithKhmdhsFetchContext({}, async () => {
      const a = await cachedFetch('contract', 'MISS', async () => {
        calls += 1;
        return null;
      });
      const b = await cachedFetch('contract', 'MISS', async () => {
        calls += 1;
        return { adam: 'MISS' };
      });
      expect(a).toBeNull();
      expect(b).toEqual({ adam: 'MISS' });
      expect(calls).toBe(2);
    });
  });

  test('reportKhmdhsProgress καλεί onProgress', async () => {
    const seen = [];
    await runWithKhmdhsFetchContext({
      onProgress: (p) => seen.push(p),
    }, async () => {
      expect(getKhmdhsFetchContext()).toBeTruthy();
      reportKhmdhsProgress('contracts', 'Συμβάσεις 1/2', { current: 1, total: 2 });
    });
    expect(seen).toEqual([{
      phase: 'contracts',
      message: 'Συμβάσεις 1/2',
      current: 1,
      total: 2,
    }]);
  });
});

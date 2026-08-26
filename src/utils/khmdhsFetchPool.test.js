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

  test('cachedFetch αλυσίδας: ίδιος ΑΔΑΜ μία φορά, άλλος ΑΔΑΜ νέα κλήση', async () => {
    let calls = 0;
    await runWithKhmdhsFetchContext({}, async () => {
      const fetchChain = (adam) => cachedFetch('chain', adam, async () => {
        calls += 1;
        return { success: true, adamChain: { requests: [adam] } };
      });
      const a = await fetchChain('26REQ000000001');
      const b = await fetchChain('26REQ000000001');
      const c = await fetchChain('26REQ000000002');
      expect(a.adamChain.requests).toEqual(['26REQ000000001']);
      expect(b).toBe(a);
      expect(c.adamChain.requests).toEqual(['26REQ000000002']);
      expect(calls).toBe(2);
    });
  });

  test('cachedFetch δεν μπερδεύει αλυσίδα με αίτημα στον ίδιο ΑΔΑΜ', async () => {
    const seen = [];
    await runWithKhmdhsFetchContext({}, async () => {
      await cachedFetch('chain', '26REQ000000001', async () => {
        seen.push('chain');
        return { success: true, kind: 'chain' };
      });
      await cachedFetch('request', '26REQ000000001', async () => {
        seen.push('request');
        return { success: true, kind: 'request' };
      });
      const again = await cachedFetch('chain', '26REQ000000001', async () => {
        seen.push('chain-again');
        return { success: true, kind: 'wrong' };
      });
      expect(seen).toEqual(['chain', 'request']);
      expect(again).toEqual({ success: true, kind: 'chain' });
    });
  });

  test('cachedFetch δεν αποθηκεύει success:false ώστε να ξαναδοκιμάσει', async () => {
    let calls = 0;
    await runWithKhmdhsFetchContext({}, async () => {
      const a = await cachedFetch('notice', '26PROC000000001', async () => {
        calls += 1;
        return { success: false, error: 'προσωρινό' };
      });
      const b = await cachedFetch('notice', '26PROC000000001', async () => {
        calls += 1;
        return { success: true, snapshot: { title: 'ok' } };
      });
      expect(a.success).toBe(false);
      expect(b.success).toBe(true);
      expect(calls).toBe(2);
    });
  });

  test('χωρίς κοινό Map, δεύτερη ανάκτηση ξαναρωτά — δεν διαρρέει μεταξύ resolve', async () => {
    let calls = 0;
    const fetchOnce = () => cachedFetch('auction', '26AWRD000000001', async () => {
      calls += 1;
      return { success: true, snapshot: { title: 'awrd' } };
    });
    await runWithKhmdhsFetchContext({}, fetchOnce);
    await runWithKhmdhsFetchContext({}, fetchOnce);
    expect(calls).toBe(2);
  });

  test('κοινό chainCache μεταξύ διαδοχικών run με το ίδιο Map (συρραφή ίδιου υποέργου)', async () => {
    const chainCache = new Map();
    let calls = 0;
    const fetchOnce = () => cachedFetch('chain', '26REQ000000001', async () => {
      calls += 1;
      return { success: true, adamChain: {} };
    });
    await runWithKhmdhsFetchContext({ chainCache }, fetchOnce);
    await runWithKhmdhsFetchContext({ chainCache }, fetchOnce);
    expect(calls).toBe(1);
    expect(chainCache.get('26REQ000000001').success).toBe(true);
  });

  test('άγνωστο είδος δεν γράφει στο cache συμβάσεων', async () => {
    const contractCache = new Map();
    let calls = 0;
    await runWithKhmdhsFetchContext({ contractCache }, async () => {
      await cachedFetch('not-a-kind', '26SYMV000000001', async () => {
        calls += 1;
        return { leaked: true };
      });
      await cachedFetch('not-a-kind', '26SYMV000000001', async () => {
        calls += 1;
        return { leaked: true };
      });
    });
    expect(calls).toBe(2);
    expect(contractCache.size).toBe(0);
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

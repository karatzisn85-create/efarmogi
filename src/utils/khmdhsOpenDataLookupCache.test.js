/**
 * @jest-environment node
 *
 * Μέσα σε μία ανάκτηση, ο ίδιος ΑΔΑΜ αλυσίδας/αιτήματος/δημοσίευσης/ανάθεσης
 * δεν ξαναχτυπά το ΚΗΜΔΗΣ. Χωρίς πλαίσιο ανάκτησης δεν υπάρχει cache.
 */
const {
  runWithKhmdhsFetchContext,
} = require('../../public/khmdhsFetchPool');
const {
  fetchKhmdhsAdamChain,
  fetchKhmdhsRequestByAdam,
  fetchKhmdhsNoticeByAdam,
  fetchKhmdhsAuctionByAdam,
} = require('../../public/khmdhsOpenData');

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  const text = JSON.stringify(body);
  return {
    ok,
    status,
    headers: { get: () => null },
    text: async () => text,
    json: async () => body,
  };
}

describe('προσωρινή μνήμη ανάκτησης ΚΗΜΔΗΣ (αλυσίδα / πράξεις)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('ίδιος ΑΔΑΜ αλυσίδας μέσα στο πλαίσιο: ένα αίτημα δικτύου', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      requests: ['26REQ018492003'],
      notices: [],
      auctions: [],
      contracts: [],
      payments: [],
    }));
    await runWithKhmdhsFetchContext({}, async () => {
      const a = await fetchKhmdhsAdamChain('26REQ018492003');
      const b = await fetchKhmdhsAdamChain('26REQ018492003');
      expect(a.success).toBe(true);
      expect(b.success).toBe(true);
      expect(b.adamChain.requests).toEqual(['26REQ018492003']);
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('διαφορετικοί ΑΔΑΜ αλυσίδας: δύο αιτήματα δικτύου', async () => {
    global.fetch.mockImplementation(async (url) => {
      const adam = String(url).split('/').pop();
      return jsonResponse({ requests: [adam], notices: [], auctions: [], contracts: [], payments: [] });
    });
    await runWithKhmdhsFetchContext({}, async () => {
      await fetchKhmdhsAdamChain('26REQ018492003');
      await fetchKhmdhsAdamChain('26REQ018492004');
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('χωρίς πλαίσιο ανάκτησης δεν κρατά cache', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      requests: ['26REQ018492003'],
      notices: [],
      auctions: [],
      contracts: [],
      payments: [],
    }));
    await fetchKhmdhsAdamChain('26REQ018492003');
    await fetchKhmdhsAdamChain('26REQ018492003');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('αποτυχία αλυσίδας δεν κλειδώνει — η επόμενη προσπάθεια ξαναρωτά', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ message: 'not found' }, { ok: false, status: 404 }))
      .mockResolvedValueOnce(jsonResponse({
        requests: ['26REQ018492003'],
        notices: [],
        auctions: [],
        contracts: [],
        payments: [],
      }));
    await runWithKhmdhsFetchContext({}, async () => {
      const first = await fetchKhmdhsAdamChain('26REQ018492003');
      const second = await fetchKhmdhsAdamChain('26REQ018492003');
      expect(first.success).toBe(false);
      expect(second.success).toBe(true);
    });
    expect(global.fetch.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test('ακύρωση δεν επιστρέφει παλιά αλυσίδα από cache', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      requests: ['26REQ018492003'],
      notices: [],
      auctions: [],
      contracts: [],
      payments: [],
    }));
    const controller = new AbortController();
    await runWithKhmdhsFetchContext({}, async () => {
      const ok = await fetchKhmdhsAdamChain('26REQ018492003');
      expect(ok.success).toBe(true);
      controller.abort();
      const aborted = await fetchKhmdhsAdamChain('26REQ018492003', { signal: controller.signal });
      expect(aborted.success).toBe(false);
      expect(aborted.aborted).toBe(true);
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('ίδιο αίτημα REQ μέσα στο πλαίσιο: ένα POST', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      content: [{
        referenceNumber: '26REQ018492003',
        title: 'Πρωτογενές',
        isInitial: true,
      }],
    }));
    await runWithKhmdhsFetchContext({}, async () => {
      const a = await fetchKhmdhsRequestByAdam('26REQ018492003');
      const b = await fetchKhmdhsRequestByAdam('26REQ018492003');
      expect(a.success).toBe(true);
      expect(b.snapshot.title).toBe('Πρωτογενές');
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('ίδια δημοσίευση PROC μέσα στο πλαίσιο: ένα POST', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      content: [{
        referenceNumber: '26PROC018492003',
        title: 'Πρόσκληση',
        noticeType: { value: 'Πρόσκληση υποβολής προσφορών' },
      }],
    }));
    await runWithKhmdhsFetchContext({}, async () => {
      const a = await fetchKhmdhsNoticeByAdam('26PROC018492003');
      const b = await fetchKhmdhsNoticeByAdam('26PROC018492003');
      expect(a.success).toBe(true);
      expect(b.snapshot.title).toBe('Πρόσκληση');
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('ίδια ανάθεση AWRD μέσα στο πλαίσιο: ένα POST', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      content: [{
        referenceNumber: '26AWRD018492003',
        title: 'Ανάθεση',
      }],
    }));
    await runWithKhmdhsFetchContext({}, async () => {
      const a = await fetchKhmdhsAuctionByAdam('26AWRD018492003');
      const b = await fetchKhmdhsAuctionByAdam('26AWRD018492003');
      expect(a.success).toBe(true);
      expect(b.snapshot.title).toBe('Ανάθεση');
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('αλυσίδα και αίτημα για τον ίδιο ΑΔΑΜ είναι δύο διαφορετικές κλήσεις', async () => {
    global.fetch.mockImplementation(async (url) => {
      if (String(url).includes('adamChain')) {
        return jsonResponse({
          requests: ['26REQ018492003'],
          notices: [],
          auctions: [],
          contracts: [],
          payments: [],
        });
      }
      return jsonResponse({
        content: [{
          referenceNumber: '26REQ018492003',
          title: 'Πρωτογενές',
          isInitial: true,
        }],
      });
    });
    await runWithKhmdhsFetchContext({}, async () => {
      await fetchKhmdhsAdamChain('26REQ018492003');
      await fetchKhmdhsRequestByAdam('26REQ018492003');
      await fetchKhmdhsAdamChain('26REQ018492003');
      await fetchKhmdhsRequestByAdam('26REQ018492003');
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

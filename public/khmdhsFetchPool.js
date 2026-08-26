/**
 * Κοινό πλαίσιο ανάκτησης ΚΗΜΔΗΣ: cache ανά ΑΔΑΜ, μικρή παραλληλία, πρόοδος.
 * Ισχύει μόνο εντός ενός resolve (AsyncLocalStorage) — δεν μοιράζεται μεταξύ χρηστών/υποέργων.
 */

const { AsyncLocalStorage } = require('async_hooks');

const khmdhsFetchStore = new AsyncLocalStorage();

/** Ασφαλές ρυθμός προς το portal — αρκετά χαμηλός για να αποφεύγονται 429. */
const CONTRACT_FETCH_CONCURRENCY = 4;
const PAYMENT_FETCH_CONCURRENCY = 3;

/** Είδη πράξης που θυμόμαστε μέσα στην ίδια ανάκτηση (όχι μεταξύ υποέργων). */
const FETCH_CACHE_KINDS = ['contract', 'payment', 'chain', 'request', 'notice', 'auction'];

function pickCacheMap(ctx, kind) {
  const passed = ctx?.[`${kind}Cache`];
  return passed instanceof Map ? passed : new Map();
}

function mapsForKind(ctx, kind) {
  if (ctx?.caches?.[kind] && ctx?.inflight?.[kind]) {
    return { cache: ctx.caches[kind], inflight: ctx.inflight[kind] };
  }
  if (kind === 'payment' && ctx?.paymentCache && ctx?.paymentInflight) {
    return { cache: ctx.paymentCache, inflight: ctx.paymentInflight };
  }
  if (kind === 'contract' && ctx?.contractCache && ctx?.contractInflight) {
    return { cache: ctx.contractCache, inflight: ctx.contractInflight };
  }
  return null;
}

/**
 * @param {{
 *   contractCache?: Map<string, any>,
 *   paymentCache?: Map<string, any>,
 *   chainCache?: Map<string, any>,
 *   requestCache?: Map<string, any>,
 *   noticeCache?: Map<string, any>,
 *   auctionCache?: Map<string, any>,
 *   signal?: AbortSignal|null,
 *   onProgress?: (payload: object) => void,
 * }} ctx
 * @param {() => Promise<any>} fn
 */
function runWithKhmdhsFetchContext(ctx, fn) {
  const caches = {};
  const inflight = {};
  FETCH_CACHE_KINDS.forEach((kind) => {
    caches[kind] = pickCacheMap(ctx, kind);
    inflight[kind] = new Map();
  });
  return khmdhsFetchStore.run({
    contractCache: caches.contract,
    paymentCache: caches.payment,
    contractInflight: inflight.contract,
    paymentInflight: inflight.payment,
    caches,
    inflight,
    signal: ctx?.signal || null,
    onProgress: typeof ctx?.onProgress === 'function' ? ctx.onProgress : null,
  }, fn);
}

function getKhmdhsFetchContext() {
  return khmdhsFetchStore.getStore() || null;
}

function reportKhmdhsProgress(phase, message, extra = {}) {
  const ctx = khmdhsFetchStore.getStore();
  if (!ctx?.onProgress) return;
  try {
    ctx.onProgress({
      phase: String(phase || ''),
      message: String(message || ''),
      ...extra,
    });
  } catch (_) {
    /* αγνόηση σφαλμάτων UI callback */
  }
}

/**
 * Παράλληλη επεξεργασία με σταθερό όριο concurrency (διατηρεί σειρά αποτελεσμάτων).
 * @template T, R
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<R>} mapper
 * @returns {Promise<R[]>}
 */
async function mapWithConcurrency(items, concurrency, mapper) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];
  const limit = Math.max(1, Math.min(Number(concurrency) || 1, list.length));
  const out = new Array(list.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= list.length) return;
      out[i] = await mapper(list[i], i);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return out;
}

/**
 * Cache + dedupe in-flight για το ίδιο κλειδί μέσα στο ενεργό resolve.
 * @param {'contract'|'payment'|'chain'|'request'|'notice'|'auction'|string} kind
 * @param {string} key
 * @param {() => Promise<any>} fetcher
 */
async function cachedFetch(kind, key, fetcher) {
  const ctx = khmdhsFetchStore.getStore();
  if (!ctx || !key) return fetcher();

  const maps = mapsForKind(ctx, kind);
  if (!maps) return fetcher();
  const { cache, inflight } = maps;

  if (cache.has(key)) return cache.get(key);
  if (inflight.has(key)) return inflight.get(key);

  const pending = (async () => {
    try {
      const value = await fetcher();
      // Μην κλειδώνουμε soft-failures (null / success:false) — επιτρέπει επανάληψη
      // σε επόμενο βήμα ή στον επόμενο σπόρο συρραφής.
      const isSoftFail = value == null
        || (typeof value === 'object' && value.success === false);
      if (!isSoftFail) cache.set(key, value);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, pending);
  return pending;
}

module.exports = {
  runWithKhmdhsFetchContext,
  getKhmdhsFetchContext,
  reportKhmdhsProgress,
  mapWithConcurrency,
  cachedFetch,
  CONTRACT_FETCH_CONCURRENCY,
  PAYMENT_FETCH_CONCURRENCY,
  FETCH_CACHE_KINDS,
};

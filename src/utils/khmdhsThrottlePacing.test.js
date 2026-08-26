/**
 * @jest-environment node
 *
 * Προσαρμογή ρυθμού όταν το ΚΗΜΔΗΣ αρχίζει να απορρίπτει αιτήματα.
 * Κρίσιμο: όσο όλα πάνε καλά, η συμπεριφορά πρέπει να είναι ΑΚΡΙΒΩΣ η προηγούμενη.
 */
const {
  noteKhmdhsThrottleSignal,
  noteKhmdhsTimeoutSignal,
  getKhmdhsThrottleLevel,
  getKhmdhsPacing,
  resetKhmdhsThrottleState,
  THROTTLE_WINDOW_MS,
} = require('../../public/khmdhsThrottleState');
const {
  CONTRACT_FETCH_CONCURRENCY,
  PAYMENT_FETCH_CONCURRENCY,
} = require('../../public/khmdhsFetchPool');
const {
  parseRetryAfterMs,
  computeRetryDelayMs,
} = require('../../public/khmdhsOpenData');

describe('ρυθμός αιτημάτων ΚΗΜΔΗΣ', () => {
  beforeEach(() => {
    resetKhmdhsThrottleState();
    jest.useRealTimers();
  });

  afterEach(() => {
    resetKhmdhsThrottleState();
    jest.useRealTimers();
  });

  test('χωρίς σημάδια φόρτου, ο ρυθμός είναι ο προεπιλεγμένος και χωρίς επιπλέον αναμονή', () => {
    const pacing = getKhmdhsPacing();
    expect(pacing.level).toBe(0);
    expect(pacing.throttled).toBe(false);
    expect(pacing.contractConcurrency).toBe(CONTRACT_FETCH_CONCURRENCY);
    expect(pacing.paymentConcurrency).toBe(PAYMENT_FETCH_CONCURRENCY);
    expect(pacing.itemGapMs).toBe(0);
  });

  test('επιτυχίες και σφάλματα άσχετα με φόρτο δεν αλλάζουν τον ρυθμό', () => {
    [200, 400, 401, 404, 500].forEach((status) => {
      expect(noteKhmdhsThrottleSignal(status)).toBe(false);
    });
    expect(getKhmdhsThrottleLevel()).toBe(0);
    expect(getKhmdhsPacing().itemGapMs).toBe(0);
  });

  test('μία άρνηση 429 φρενάρει ήπια', () => {
    expect(noteKhmdhsThrottleSignal(429)).toBe(true);
    const pacing = getKhmdhsPacing();
    expect(pacing.level).toBe(1);
    expect(pacing.throttled).toBe(true);
    expect(pacing.contractConcurrency).toBeLessThan(CONTRACT_FETCH_CONCURRENCY);
    expect(pacing.itemGapMs).toBeGreaterThan(0);
  });

  test('επαναλαμβανόμενες αρνήσεις φρενάρουν έντονα, ένα αίτημα τη φορά', () => {
    noteKhmdhsThrottleSignal(429);
    noteKhmdhsThrottleSignal(503);
    noteKhmdhsThrottleSignal(429);
    const pacing = getKhmdhsPacing();
    expect(pacing.level).toBe(2);
    expect(pacing.contractConcurrency).toBe(1);
    expect(pacing.paymentConcurrency).toBe(1);
    expect(pacing.itemGapMs).toBeGreaterThanOrEqual(5000);
  });

  test('η αργή πύλη (λήξη χρόνου) φρενάρει το ίδιο με την άρνηση', () => {
    noteKhmdhsTimeoutSignal();
    expect(getKhmdhsThrottleLevel()).toBe(1);
    noteKhmdhsTimeoutSignal();
    noteKhmdhsTimeoutSignal();
    expect(getKhmdhsThrottleLevel()).toBe(2);
    expect(getKhmdhsPacing().itemGapMs).toBeGreaterThanOrEqual(5000);
  });

  test('όταν η πύλη ηρεμήσει, ο ρυθμός επανέρχεται μόνος του', () => {
    const realNow = Date.now;
    try {
      noteKhmdhsThrottleSignal(429);
      noteKhmdhsThrottleSignal(429);
      noteKhmdhsThrottleSignal(429);
      expect(getKhmdhsThrottleLevel()).toBe(2);

      const later = realNow() + THROTTLE_WINDOW_MS + 1000;
      Date.now = () => later;
      expect(getKhmdhsThrottleLevel()).toBe(0);
      expect(getKhmdhsPacing().contractConcurrency).toBe(CONTRACT_FETCH_CONCURRENCY);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('Retry-After από το ΚΗΜΔΗΣ', () => {
  test('δευτερόλεπτα', () => {
    expect(parseRetryAfterMs('12')).toBe(12000);
  });

  test('ημερομηνία στο μέλλον', () => {
    const future = new Date(Date.now() + 10000).toUTCString();
    expect(parseRetryAfterMs(future)).toBeGreaterThan(0);
  });

  test('κενό, ασυνάρτητο ή παρελθόν → καμία απαίτηση αναμονής', () => {
    expect(parseRetryAfterMs('')).toBe(0);
    expect(parseRetryAfterMs(null)).toBe(0);
    expect(parseRetryAfterMs(undefined)).toBe(0);
    expect(parseRetryAfterMs('αύριο')).toBe(0);
    expect(parseRetryAfterMs('0')).toBe(0);
    expect(parseRetryAfterMs(new Date(Date.now() - 60000).toUTCString())).toBe(0);
  });

  test('παράλογη τιμή κόβεται στο ανώτατο όριο — ποτέ δεν κολλάει η εφαρμογή', () => {
    expect(parseRetryAfterMs('99999')).toBeLessThanOrEqual(60000);
  });
});

describe('αναμονή πριν την επόμενη προσπάθεια', () => {
  test('σε άρνηση ρυθμού περιμένουμε δευτερόλεπτα, όχι κλάσματα', () => {
    expect(computeRetryDelayMs(0, 429, 0)).toBeGreaterThanOrEqual(5000);
    expect(computeRetryDelayMs(1, 429, 0)).toBeGreaterThan(computeRetryDelayMs(0, 429, 0));
    expect(computeRetryDelayMs(0, 503, 0)).toBeGreaterThanOrEqual(5000);
    expect(computeRetryDelayMs(0, 502, 0)).toBeGreaterThanOrEqual(5000);
    expect(computeRetryDelayMs(0, 504, 0)).toBeGreaterThanOrEqual(5000);
    expect(computeRetryDelayMs(0, 'timeout', 0)).toBeGreaterThanOrEqual(5000);
  });

  test('σε απλό προσωρινό σφάλμα κρατάμε την παλιά, γρήγορη επανάληψη', () => {
    expect(computeRetryDelayMs(0, 500, 0)).toBe(1500);
    expect(computeRetryDelayMs(1, 500, 0)).toBe(3000);
    expect(computeRetryDelayMs(0, 0, 0)).toBe(1500);
  });

  test('αν ο διακομιστής ζητήσει μεγαλύτερη αναμονή, τη σεβόμαστε', () => {
    expect(computeRetryDelayMs(0, 429, 30000)).toBe(30000);
    expect(computeRetryDelayMs(0, 500, 20000)).toBe(20000);
  });

  test('αν ζητήσει μικρότερη, κρατάμε τη δική μας ασφαλή αναμονή', () => {
    expect(computeRetryDelayMs(0, 429, 1000)).toBeGreaterThanOrEqual(5000);
  });
});

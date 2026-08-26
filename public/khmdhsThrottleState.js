/**
 * Προσαρμογή ρυθμού αιτημάτων προς το ΚΗΜΔΗΣ.
 *
 * Όσο η πύλη απαντά κανονικά, οι τιμές είναι ακριβώς οι προεπιλεγμένες
 * (επίπεδο 0 → καμία αλλαγή συμπεριφοράς). Μόλις αρχίσει να απορρίπτει
 * αιτήματα (429/503) ή να «λυγίζει» (502/504), η εφαρμογή χαμηλώνει μόνη της
 * την ένταση για την υπόλοιπη εκτέλεση και επανέρχεται σταδιακά.
 */

const {
  CONTRACT_FETCH_CONCURRENCY,
  PAYMENT_FETCH_CONCURRENCY,
} = require('./khmdhsFetchPool');

/** Πόσο κρατάει ένα σημάδι υπερφόρτωσης πριν «ξεχαστεί». */
const THROTTLE_WINDOW_MS = 90000;
/** Από πόσα σημάδια και πάνω πάμε στο πιο συντηρητικό επίπεδο. */
const HEAVY_THROTTLE_SIGNALS = 3;

/** Καταστάσεις HTTP που δείχνουν ότι πιέζουμε την πύλη. */
const THROTTLE_STATUS_CODES = new Set([429, 502, 503, 504]);

const state = {
  signals: [],
  totalSignals: 0,
};

function pruneSignals(now) {
  const cutoff = now - THROTTLE_WINDOW_MS;
  while (state.signals.length && state.signals[0] < cutoff) {
    state.signals.shift();
  }
}

/**
 * Καταγράφει ένδειξη υπερφόρτωσης. Ανεκτικό σε ό,τι του δώσουν —
 * ποτέ δεν πετάει σφάλμα, ώστε να μη μπορεί να χαλάσει μια ανάκτηση.
 * @param {number|string} httpStatus
 * @returns {boolean} true αν μετρήθηκε ως σημάδι υπερφόρτωσης
 */
function noteKhmdhsThrottleSignal(httpStatus) {
  const status = Number(httpStatus);
  if (!THROTTLE_STATUS_CODES.has(status)) return false;
  recordSignal();
  return true;
}

/**
 * Λήξη χρόνου: η πύλη δεν μας αρνήθηκε, απλώς δεν πρόλαβε να απαντήσει.
 * Είναι εξίσου καθαρή ένδειξη υπερφόρτωσης και κοστίζει πολύ χρόνο,
 * οπότε μετράει το ίδιο για το φρενάρισμα.
 */
function noteKhmdhsTimeoutSignal() {
  recordSignal();
  return true;
}

function recordSignal() {
  const now = Date.now();
  pruneSignals(now);
  state.signals.push(now);
  state.totalSignals += 1;
}

/**
 * Τρέχον επίπεδο πίεσης: 0 = κανονικά, 1 = ήπιο φρενάρισμα, 2 = έντονο.
 */
function getKhmdhsThrottleLevel() {
  pruneSignals(Date.now());
  if (state.signals.length >= HEAVY_THROTTLE_SIGNALS) return 2;
  if (state.signals.length >= 1) return 1;
  return 0;
}

/**
 * Ρυθμός που πρέπει να τηρείται αυτή τη στιγμή.
 * Στο επίπεδο 0 οι τιμές ταυτίζονται με τις προεπιλογές και το `itemGapMs`
 * είναι 0, δηλαδή «μη βάλεις επιπλέον καθυστέρηση».
 */
function getKhmdhsPacing() {
  const level = getKhmdhsThrottleLevel();
  if (level >= 2) {
    return {
      level,
      throttled: true,
      contractConcurrency: 1,
      paymentConcurrency: 1,
      itemGapMs: 5000,
      totalSignals: state.totalSignals,
    };
  }
  if (level === 1) {
    return {
      level,
      throttled: true,
      contractConcurrency: 2,
      paymentConcurrency: 2,
      itemGapMs: 2000,
      totalSignals: state.totalSignals,
    };
  }
  return {
    level: 0,
    throttled: false,
    contractConcurrency: CONTRACT_FETCH_CONCURRENCY,
    paymentConcurrency: PAYMENT_FETCH_CONCURRENCY,
    itemGapMs: 0,
    totalSignals: state.totalSignals,
  };
}

/** Μηδενισμός — στην αρχή κάθε μαζικής εκτέλεσης και στους ελέγχους. */
function resetKhmdhsThrottleState() {
  state.signals = [];
  state.totalSignals = 0;
}

module.exports = {
  noteKhmdhsThrottleSignal,
  noteKhmdhsTimeoutSignal,
  getKhmdhsThrottleLevel,
  getKhmdhsPacing,
  resetKhmdhsThrottleState,
  THROTTLE_WINDOW_MS,
  HEAVY_THROTTLE_SIGNALS,
};

/**
 * Διακόπτης ανανέωσης ΚΗΜΔΗΣ: πλήρης εξερεύνηση vs ελαφρύ ξαναδιάβασμα εγγράφων.
 *
 * Fail-closed: οτιδήποτε αβέβαιο → πλήρης διαδρομή (ίδια με σήμερα).
 * Ελαφρύ μόνο όταν η λίστα ζωντανών ΑΔΑΜ της αλυσίδας είναι ακριβώς ίδια με την αποθηκευμένη.
 */

const STAGE_KEYS = [
  'requests',
  'approvedRequests',
  'budgetCommitments',
  'notices',
  'auctions',
  'contracts',
  'payments',
];

function normalizeAdamKey(value) {
  const t = String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .replace(/\*+$/, '');
  return /^(\d{2})[A-Z]{3,4}\d{9}$/.test(t) ? t : '';
}

function addAdam(set, raw) {
  const adam = normalizeAdamKey(raw);
  if (adam) set.add(adam);
}

function collectAdamsFromLinked(linked) {
  const out = new Set();
  if (!linked || typeof linked !== 'object') return out;
  STAGE_KEYS.forEach((key) => {
    const list = linked[key];
    if (!Array.isArray(list)) return;
    list.forEach((item) => addAdam(out, item));
  });
  return out;
}

function collectAdamsFromStages(stages) {
  const out = new Set();
  if (!stages || typeof stages !== 'object') return out;
  STAGE_KEYS.forEach((key) => {
    const list = stages[key];
    if (!Array.isArray(list)) return;
    list.forEach((item) => {
      if (item && typeof item === 'object') addAdam(out, item.adam);
      else addAdam(out, item);
    });
  });
  return out;
}

function setsEqual(a, b) {
  if (!(a instanceof Set) || !(b instanceof Set)) return false;
  if (a.size !== b.size) return false;
  const iter = a.values();
  let step = iter.next();
  while (!step.done) {
    if (!b.has(step.value)) return false;
    step = iter.next();
  }
  return true;
}

function full(reason) {
  return { mode: 'full', reason: String(reason || 'full') };
}

function light(reason) {
  return { mode: 'light', reason: String(reason || 'light') };
}

/**
 * @param {{
 *   preferLight?: boolean,
 *   usesStitchPlan?: boolean,
 *   storedLinkedAdams?: object|null,
 *   storedPrimaryReqAdam?: string,
 *   seedAdam?: string,
 *   incomingStages?: object|null,
 *   chainFetchOk?: boolean,
 * }} input
 * @returns {{ mode: 'full'|'light', reason: string }}
 */
function decideKhmdhsRefreshMode(input) {
  const opts = input && typeof input === 'object' ? input : {};
  if (opts.preferLight !== true) return full('prefer-off');
  if (opts.usesStitchPlan === true) return full('stitch');
  if (opts.chainFetchOk === false) return full('chain-failed');

  const storedLive = collectAdamsFromLinked(opts.storedLinkedAdams);
  if (!storedLive.size) return full('no-stored-membership');

  const primary = normalizeAdamKey(opts.storedPrimaryReqAdam);
  if (!primary) return full('no-primary');

  const incomingLive = collectAdamsFromStages(opts.incomingStages);
  if (!incomingLive.size) return full('empty-incoming');

  const seed = normalizeAdamKey(opts.seedAdam);
  if (seed && !incomingLive.has(seed)) return full('seed-absent');
  if (!incomingLive.has(primary)) return full('primary-absent');

  if (!setsEqual(storedLive, incomingLive)) {
    const extra = [...incomingLive].filter((a) => !storedLive.has(a));
    if (extra.length) return full('new-adam');
    return full('missing-adam');
  }

  return light('membership-unchanged');
}

module.exports = {
  decideKhmdhsRefreshMode,
  collectAdamsFromLinked,
  collectAdamsFromStages,
  normalizeAdamKey,
};

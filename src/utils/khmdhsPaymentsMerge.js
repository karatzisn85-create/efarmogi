/**
 * Συγχώνευση ενταλμάτων πληρωμής μετά ανάκτηση αλυσίδας ΚΗΜΔΗΣ.
 * Διατηρεί υπάρχοντα εντάλματα όταν το νέο fetch είναι ελλιπές ή αποτυγχάνει στις λεπτομέρειες.
 * Αφαιρεί μόνο κρίκους με επιβεβαιωμένη ακύρωση στο ΚΗΜΔΗΣ ή ρητά άσχετα εντάλματα.
 */

function normalizePaymentAdam(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .replace(/\*+$/, '');
}

const USER_PAYMENT_FIELDS = ['userDocumentRole', 'userDocumentLabel', 'userActualAmount'];

function carryUserFields(prev, incoming) {
  if (!prev) return { ...incoming };
  const out = { ...incoming };
  USER_PAYMENT_FIELDS.forEach((key) => {
    if (prev[key] != null && prev[key] !== '') {
      out[key] = prev[key];
    }
  });
  return out;
}

/**
 * @param {Array} prevPayments — αποθηκευμένα εντάλματα υποέργου
 * @param {Array} incomingPayments — αποτέλεσμα νέας ανάκτησης (chainRes.payments)
 * @param {{ skippedUnrelated?: Array<{ adam?: string }>, cancelledAdams?: string[] }} [opts]
 * @returns {Array}
 */
export function mergeKhmdhsPaymentsFromChain(prevPayments, incomingPayments, opts = {}) {
  const prevList = Array.isArray(prevPayments) ? prevPayments : [];
  const incoming = Array.isArray(incomingPayments) ? incomingPayments : [];
  const unrelatedSet = new Set(
    (opts.skippedUnrelated || [])
      .map((e) => normalizePaymentAdam(e?.adam))
      .filter(Boolean)
  );
  const cancelledSet = new Set(
    (opts.cancelledAdams || [])
      .map((a) => normalizePaymentAdam(a))
      .filter(Boolean)
  );

  const prevByAdam = new Map();
  prevList.forEach((p) => {
    const a = normalizePaymentAdam(p?.adam);
    if (a) prevByAdam.set(a, p);
  });

  const merged = [];
  const seen = new Set();

  incoming.forEach((inc) => {
    const a = normalizePaymentAdam(inc?.adam);
    if (!a || unrelatedSet.has(a) || cancelledSet.has(a)) return;
    if (inc?.snapshot?.cancelled === true) {
      cancelledSet.add(a);
      return;
    }
    seen.add(a);
    const prev = prevByAdam.get(a);

    if (inc.snapshot) {
      merged.push(carryUserFields(prev, {
        ...inc,
        adam: a,
        snapshot: inc.snapshot,
        fetchedAt: inc.fetchedAt || new Date().toISOString(),
        error: '',
      }));
      return;
    }

    // Αποτυχία λεπτομερειών: κράτα μόνο αν ήδη υπήρχε καταχώριση.
    // Νέα stubs χωρίς snapshot δεν προστίθενται — χωρίς λεπτομέρειες δεν ξέρουμε
    // αν το ένταλμα ανήκει στο υποέργο (και η μαζική ανανέωση τα εμφάνιζε λανθασμένα ως «νέα»).
    if (prev) {
      merged.push({
        ...prev,
        adam: a,
        error: inc.error || prev.error || '',
      });
    }
  });

  // Παλιά εντάλματα που λείπουν από το νέο fetch — διατήρηση (εκτός ρητά άσχετων / ακυρωμένων)
  prevList.forEach((prev) => {
    const a = normalizePaymentAdam(prev?.adam);
    if (!a || seen.has(a) || unrelatedSet.has(a) || cancelledSet.has(a)) return;
    if (prev?.snapshot?.cancelled === true) return;
    merged.push(prev);
  });

  return merged;
}

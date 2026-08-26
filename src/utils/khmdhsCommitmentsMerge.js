/**
 * Συγχώνευση αποφάσεων ανάληψης υποχρέωσης μετά ανάκτηση αλυσίδας ΚΗΜΔΗΣ.
 * Διατηρεί υπάρχουσες αποφάσεις όταν το νέο fetch είναι ελλιπές ή αποτυγχάνει στις λεπτομέρειες.
 * Αφαιρεί μόνο κρίκους με επιβεβαιωμένη ακύρωση στο ΚΗΜΔΗΣ.
 */

function normalizeCommitmentAdam(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .replace(/\*+$/, '');
}

/**
 * @param {Array} prevCommitments — αποθηκευμένες αποφάσεις υποέργου
 * @param {Array} incomingCommitments — αποτέλεσμα νέας ανάκτησης
 * @param {{ cancelledAdams?: string[] }} [opts]
 * @returns {Array}
 */
export function mergeKhmdhsCommitmentsFromChain(prevCommitments, incomingCommitments, opts = {}) {
  const prevList = Array.isArray(prevCommitments) ? prevCommitments : [];
  const incoming = Array.isArray(incomingCommitments) ? incomingCommitments : [];
  const cancelledSet = new Set(
    (opts.cancelledAdams || [])
      .map((a) => normalizeCommitmentAdam(a))
      .filter(Boolean)
  );

  const prevByAdam = new Map();
  prevList.forEach((d) => {
    const a = normalizeCommitmentAdam(d?.adam);
    if (a) prevByAdam.set(a, d);
  });

  const merged = [];
  const seen = new Set();

  incoming.forEach((inc) => {
    const a = normalizeCommitmentAdam(inc?.adam);
    if (!a || cancelledSet.has(a)) return;
    if (inc?.snapshot?.cancelled === true) {
      cancelledSet.add(a);
      return;
    }
    seen.add(a);
    const prev = prevByAdam.get(a);

    if (inc.snapshot) {
      merged.push({
        ...inc,
        adam: a,
        snapshot: inc.snapshot,
        fetchedAt: inc.fetchedAt || new Date().toISOString(),
        error: '',
      });
      return;
    }

    // Αποτυχία λεπτομερειών: κράτα μόνο αν ήδη υπήρχε καταχώριση.
    // Νέα stubs χωρίς snapshot δεν προστίθενται.
    if (prev) {
      merged.push({
        ...prev,
        adam: a,
        error: inc.error || prev.error || '',
      });
    }
  });

  // Παλιές αποφάσεις που λείπουν από το νέο fetch — διατήρηση, εκτός επιβεβαιωμένης ακύρωσης
  prevList.forEach((prev) => {
    const a = normalizeCommitmentAdam(prev?.adam);
    if (!a || seen.has(a)) return;
    if (cancelledSet.has(a) || prev?.snapshot?.cancelled === true) return;
    merged.push(prev);
  });

  return merged;
}

/** Επιλογή κύριας απόφασης: χρονολογικά πρώτη με snapshot, αλλιώς πρώτη της λίστας. */
export function pickPrimaryCommitmentDecision(decisions) {
  const list = Array.isArray(decisions) ? decisions.filter((d) => d && d.adam) : [];
  if (!list.length) return null;
  const withSnap = list.filter((d) => d.snapshot);
  const pool = withSnap.length ? withSnap : list;
  const sorted = [...pool].sort((a, b) => {
    const da = a?.snapshot?.signedDate || a?.snapshot?.submissionDate || '';
    const db = b?.snapshot?.signedDate || b?.snapshot?.submissionDate || '';
    if (da && db) return da < db ? -1 : da > db ? 1 : 0;
    if (da) return -1;
    if (db) return 1;
    return 0;
  });
  return sorted[0] || null;
}

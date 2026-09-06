/**
 * Κατηγοριοποίηση και σύντομη επικεφαλίδα αποτυχίας ανάκτησης ΚΗΜΔΗΣ για αναφορές UI.
 * Το πλήρες μήνυμα μένει στο item.error (από το main process).
 */

export const KHMDHS_FAILURE_CAUSES = {
  LOCKED: 'locked',
  NOT_AVAILABLE: 'not_available',
  INVALID_ADAM: 'invalid_adam',
  CONNECTION: 'connection',
  BUSY: 'busy',
  OTHER: 'other',
};

/** Σύντομη επικεφαλίδα ανά αιτία — αυτό βλέπει ο χρήστης δίπλα σε κάθε υποέργο. */
const CAUSE_SUMMARY = {
  [KHMDHS_FAILURE_CAUSES.LOCKED]: 'Κλειδωμένο από άλλον χρήστη',
  [KHMDHS_FAILURE_CAUSES.NOT_AVAILABLE]: 'Ο ΑΔΑΜ δεν είναι ακόμα διαθέσιμος — δοκιμάστε αργότερα',
  [KHMDHS_FAILURE_CAUSES.INVALID_ADAM]: 'Μη έγκυρος ΑΔΑΜ — ελέγξτε τον κωδικό',
  [KHMDHS_FAILURE_CAUSES.CONNECTION]: 'Δεν υπάρχει σύνδεση στο διαδίκτυο',
  [KHMDHS_FAILURE_CAUSES.BUSY]: 'Προσωρινό πρόβλημα στο ΚΗΜΔΗΣ — δοκιμάστε ξανά',
  [KHMDHS_FAILURE_CAUSES.OTHER]: 'Δεν ολοκληρώθηκε η ανανέωση',
};

/** Επεξήγηση ανά αιτία για τη σύνοψη της αναφοράς — λέει και ποιος «φταίει». */
const CAUSE_EXPLANATION = {
  [KHMDHS_FAILURE_CAUSES.LOCKED]: 'κλειδωμένα από άλλον χρήστη',
  [KHMDHS_FAILURE_CAUSES.NOT_AVAILABLE]: 'δεν έχουν περάσει ακόμη στα ανοικτά δεδομένα του ΚΗΜΔΗΣ',
  [KHMDHS_FAILURE_CAUSES.INVALID_ADAM]: 'με λανθασμένο ή ελλιπή ΑΔΑΜ στο υποέργο',
  [KHMDHS_FAILURE_CAUSES.CONNECTION]: 'δεν υπάρχει σύνδεση στο διαδίκτυο',
  [KHMDHS_FAILURE_CAUSES.BUSY]: 'λόγω φόρτου ή καθυστέρησης του ΚΗΜΔΗΣ',
  [KHMDHS_FAILURE_CAUSES.OTHER]: 'από άλλη αιτία',
};

/** Τι μπορεί να κάνει ο χρήστης για κάθε αιτία. */
const CAUSE_ADVICE = {
  [KHMDHS_FAILURE_CAUSES.LOCKED]: 'Δοκιμάστε ξανά όταν ελευθερωθούν.',
  [KHMDHS_FAILURE_CAUSES.NOT_AVAILABLE]: 'Η επανάληψη τώρα δεν βοηθά — χρειάζονται ώρες ή η επόμενη εργάσιμη.',
  [KHMDHS_FAILURE_CAUSES.INVALID_ADAM]: 'Χρειάζεται έλεγχος του κωδικού στην καρτέλα του υποέργου.',
  [KHMDHS_FAILURE_CAUSES.CONNECTION]: 'Ελέγξτε το δίκτυο και δοκιμάστε ξανά — δεν φταίει ο ΑΔΑΜ.',
  [KHMDHS_FAILURE_CAUSES.BUSY]: 'Η «Επανάληψη» συνήθως τα μαζεύει.',
  [KHMDHS_FAILURE_CAUSES.OTHER]: '',
};

/**
 * Σε ποια αιτία οφείλεται η αποτυχία.
 * @param {string} errorText — το πλήρες μήνυμα σφάλματος
 * @returns {string} τιμή από το KHMDHS_FAILURE_CAUSES
 */
export function classifyKhmdhsFailure(errorText) {
  const raw = String(errorText || '').trim();
  if (!raw) return KHMDHS_FAILURE_CAUSES.OTHER;
  if (/κλειδωμ/i.test(raw)) return KHMDHS_FAILURE_CAUSES.LOCKED;
  if (/ανοικτ[άα] δεδομέν|δεν βρέθηκε|δεν είναι ακόμα διαθέσιμος|δοκιμάστε ξανά αργότερα|μόλις αναρτήθηκε/i.test(raw)) {
    return KHMDHS_FAILURE_CAUSES.NOT_AVAILABLE;
  }
  if (/μη έγκυρος|μορφή/i.test(raw)) return KHMDHS_FAILURE_CAUSES.INVALID_ADAM;
  if (/πολλά αιτήματα|προσωριν|διήρκεσε πάρα πολύ|υπερφορτ|ETIMEDOUT|TimeoutError/i.test(raw)) {
    return KHMDHS_FAILURE_CAUSES.BUSY;
  }
  if (/σύνδεσ|δικτύ|fetch failed|ECONNRESET|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|socket hang up|δεν υπάρχει σύνδεση στο διαδίκτυο/i.test(raw)) {
    return KHMDHS_FAILURE_CAUSES.CONNECTION;
  }
  return KHMDHS_FAILURE_CAUSES.OTHER;
}

/** Σύντομη επικεφαλίδα αποτυχίας για την αναφορά. */
export function summarizeKhmdhsFetchFailure(errorText) {
  return CAUSE_SUMMARY[classifyKhmdhsFailure(errorText)] || CAUSE_SUMMARY[KHMDHS_FAILURE_CAUSES.OTHER];
}

/**
 * Ομαδοποιεί τις αποτυχίες ανά αιτία, από τη συχνότερη στη σπανιότερη.
 * @param {Array<{ error?: string, reason?: string }>} items
 * @returns {Array<{ cause: string, count: number, explanation: string, advice: string }>}
 */
export function groupKhmdhsFailuresByCause(items) {
  const list = Array.isArray(items) ? items : [];
  const counts = new Map();
  list.forEach((item) => {
    const cause = classifyKhmdhsFailure(item?.error || item?.reason);
    counts.set(cause, (counts.get(cause) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([cause, count]) => ({
      cause,
      count,
      explanation: CAUSE_EXPLANATION[cause] || CAUSE_EXPLANATION[KHMDHS_FAILURE_CAUSES.OTHER],
      advice: CAUSE_ADVICE[cause] || '',
    }))
    .sort((a, b) => b.count - a.count);
}

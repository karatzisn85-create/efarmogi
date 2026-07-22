/**
 * Φιλικά μηνύματα για προσωρινά σφάλματα HTTP από το ΚΗΜΔΗΣ.
 */

const KHMDHS_DOC_KIND_LABELS = {
  request: 'πρωτογενές / εγκεκριμένο αίτημα',
  req: 'πρωτογενές / εγκεκριμένο αίτημα',
  notice: 'δημοσίευση / πρόσκληση',
  proc: 'δημοσίευση / πρόσκληση',
  award: 'ανάθεση',
  awrd: 'ανάθεση',
  contract: 'σύμβαση',
  symv: 'σύμβαση',
  payment: 'πληρωμή',
  pay: 'πληρωμή',
  chain: 'πράξη',
};

/**
 * Μήνυμα όταν ο ΑΔΑΜ δεν βρίσκεται στα ανοικτά δεδομένα του ΚΗΜΔΗΣ.
 * Εξηγεί την καθυστέρηση πύλης→API και τι να κάνει ο χρήστης.
 * @param {{ adam?: string, kind?: string }} [opts]
 */
function friendlyKhmdhsAdamNotFoundError(opts = {}) {
  const adam = String(opts.adam || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  const kindKey = String(opts.kind || '').trim().toLowerCase();
  let kindLabel = KHMDHS_DOC_KIND_LABELS[kindKey] || '';
  if (!kindLabel && adam) {
    const m = /^(\d{2})([A-Z]{3,4})(\d{9})$/.exec(adam);
    if (m) kindLabel = KHMDHS_DOC_KIND_LABELS[m[2].toLowerCase()] || '';
  }
  if (!kindLabel) kindLabel = 'πράξη';

  const adamPart = adam
    ? `Ο ΑΔΑΜ ${adam} (${kindLabel})`
    : `Ο ΑΔΑΜ (${kindLabel})`;

  return (
    `${adamPart} δεν βρέθηκε ακόμα στα ανοικτά δεδομένα του ΚΗΜΔΗΣ που διαβάζει η εφαρμογή. `
    + 'Αν μόλις αναρτήθηκε στην ιστοσελίδα του ΚΗΜΔΗΣ, αυτό είναι συνηθισμένο: η πύλη τον δείχνει συχνά νωρίτερα από τα ανοικτά δεδομένα (καθυστέρηση ωρών ή μέχρι την επόμενη εργάσιμη). '
    + 'Τι να κάνετε: (1) ελέγξτε ότι ο κωδικός είναι σωστός, χωρίς κενά ή τυπογραφικό λάθος· '
    + '(2) κρατήστε τον ΑΔΑΜ στο υποέργο και δοκιμάστε ξανά αργότερα την ανάκτηση/ανανέωση· '
    + '(3) δεν χρειάζεται να διαγράψετε το υποέργο.'
  );
}

/** Σύντομη επικεφαλίδα για αναφορά μαζικής ανανέωσης (όχι το πλήρες κείμενο). */
function summarizeKhmdhsFetchFailure(errorText) {
  const raw = String(errorText || '').trim();
  if (!raw) return 'Δεν ολοκληρώθηκε η ανανέωση';
  if (/κλειδωμ/i.test(raw)) return 'Κλειδωμένο από άλλον χρήστη';
  if (/ανοικτ[άα] δεδομέν|δεν βρέθηκε|δεν είναι ακόμα διαθέσιμος|δοκιμάστε ξανά αργότερα|μόλις αναρτήθηκε/i.test(raw)) {
    return 'Ο ΑΔΑΜ δεν είναι ακόμα διαθέσιμος — δοκιμάστε αργότερα';
  }
  if (/μη έγκυρος|μορφή/i.test(raw)) return 'Μη έγκυρος ΑΔΑΜ — ελέγξτε τον κωδικό';
  if (/πολλά αιτήματα|προσωριν/i.test(raw)) return 'Προσωρινό πρόβλημα στο ΚΗΜΔΗΣ — δοκιμάστε ξανά';
  return 'Δεν ολοκληρώθηκε η ανανέωση';
}

function friendlyKhmdhsTransientHttpError(httpStatus) {
  const status = Number(httpStatus);
  if (!Number.isFinite(status)) return null;
  if (status === 429) {
    return 'Το ΚΗΜΔΗΣ δέχεται πολλά αιτήματα αυτή τη στιγμή. Περιμένετε λίγα δευτερόλεπτα και δοκιμάστε ξανά — συνήθως διορθώνεται με την επόμενη προσπάθεια.';
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'Ο διακομιστής του ΚΗΜΔΗΣ δεν είναι προσωρινά διαθέσιμος. Δοκιμάστε ξανά σε λίγα λεπτά.';
  }
  if (status === 500) {
    return 'Προσωρινό πρόβλημα στο ΚΗΜΔΗΣ. Δοκιμάστε ξανά σε λίγο.';
  }
  return null;
}

function friendlyKhmdhsInvalidResponseError(httpStatus) {
  const transient = friendlyKhmdhsTransientHttpError(httpStatus);
  if (transient) return transient;
  return 'Λάβαμε απροσδόκητη απάντηση από το ΚΗΜΔΗΣ. Δοκιμάστε ξανά σε λίγο.';
}

function resolveKhmdhsHttpError(message, httpStatus, fallback) {
  const transient = friendlyKhmdhsTransientHttpError(httpStatus);
  if (transient) return transient;
  const raw = String(message || '').trim();
  if (raw && !/^HTTP\s+\d{3}$/i.test(raw)) return raw;
  if (typeof fallback === 'function') return fallback(message, httpStatus);
  if (fallback) return String(fallback);
  const status = Number(httpStatus);
  if (Number.isFinite(status) && status > 0) {
    return 'Προσωρινό πρόβλημα επικοινωνίας με το ΚΗΜΔΗΣ. Δοκιμάστε ξανά σε λίγο.';
  }
  return 'Προσωρινό πρόβλημα επικοινωνίας με το ΚΗΜΔΗΣ. Δοκιμάστε ξανά.';
}

module.exports = {
  friendlyKhmdhsAdamNotFoundError,
  summarizeKhmdhsFetchFailure,
  friendlyKhmdhsTransientHttpError,
  friendlyKhmdhsInvalidResponseError,
  resolveKhmdhsHttpError,
};

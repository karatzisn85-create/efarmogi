/**
 * Φιλικά μηνύματα για προσωρινά σφάλματα HTTP από το ΚΗΜΔΗΣ.
 */

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
  friendlyKhmdhsTransientHttpError,
  friendlyKhmdhsInvalidResponseError,
  resolveKhmdhsHttpError,
};

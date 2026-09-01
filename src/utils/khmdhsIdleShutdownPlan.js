/**
 * Κανόνες για «μαζική ανανέωση και σβήσιμο υπολογιστή».
 * Το πραγματικό shutdown.exe / αποτροπή ύπνου γίνεται στον κύριο διεργασία.
 */

export const KHMDHS_IDLE_SHUTDOWN_DELAY_SEC = 60;
/** Το shutdown.exe καθυστερεί λίγο περισσότερο από την ένδειξη, ώστε το κλείσιμο από τα Windows να μην ακυρώσει το σβήσιμο. */
export const KHMDHS_IDLE_SHUTDOWN_OS_DELAY_SEC = 75;

export const KHMDHS_IDLE_SHUTDOWN_COMMENT =
  'ERGOHUB: η μαζική ανανέωση ΚΗΜΔΗΣ ολοκληρώθηκε';

export function sanitizeKhmdhsIdleShutdownComment(text) {
  return String(text || KHMDHS_IDLE_SHUTDOWN_COMMENT)
    .replace(/[\r\n"]/g, ' ')
    .trim()
    .slice(0, 200);
}

export function clampKhmdhsIdleShutdownDelaySec(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return KHMDHS_IDLE_SHUTDOWN_DELAY_SEC;
  return Math.max(1, Math.min(600, Math.round(n)));
}

/** Ορίσματα shutdown.exe χωρίς κέλυφος — δεν μπαίνει κείμενο χρήστη εκτός από το σχόλιο. */
export function buildKhmdhsIdleShutdownArgv(delaySec, comment) {
  const t = clampKhmdhsIdleShutdownDelaySec(delaySec);
  return ['/s', '/t', String(t), '/f', '/c', sanitizeKhmdhsIdleShutdownComment(comment)];
}

export function buildKhmdhsIdleShutdownAbortArgv() {
  return ['/a'];
}

/**
 * Σβήσιμο μόνο μετά από κανονικό πέρασμα που ο χρήστης ζήτησε φεύγοντας,
 * ολοκληρώθηκε χωρίς ακύρωση, και δεν έμεινε αποτυχία / κλείδωμα / εκκρεμές fetch.
 * Ακύρωση, χειροκίνητη επανάληψη, κενή λίστα ή εναπομείνασες αποτυχίες δεν σβήνουν τον υπολογιστή.
 */
export function shouldCommitKhmdhsIdleShutdown({
  shutdownAfter = false,
  isRetry = false,
  cancelled = false,
  refreshedCount = 0,
  remainingRetryCount = 0,
} = {}) {
  if (!shutdownAfter || isRetry || cancelled) return false;
  if (Number(remainingRetryCount) > 0) return false;
  return Number(refreshedCount) > 0;
}

/**
 * Επιπλέον αυτόματα περάσματα όταν ο χρήστης ζήτησε σβήσιμο:
 * ξανατρέχουν μόνο όσα απέτυχαν, μέχρι να αδειάσει η ουρά ή να εξαντληθούν τα περάσματα.
 */
export const KHMDHS_SHUTDOWN_RETRY_MAX_ROUNDS = 80;

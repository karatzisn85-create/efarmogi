/**
 * Κλείδωμα οθόνης όσο τρέχει «μαζική ανανέωση και σβήσιμο».
 * Δεν αποσυνδέει τον χρήστη — η ανανέωση συνεχίζει με την ίδια συνεδρία.
 */

export const KHMDHS_SESSION_AUTO_LOCK_SEC = 20;

export function sameKhmdhsSessionUsername(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
    && String(a || '').trim() !== '';
}

export function shouldShowKhmdhsSessionLock({
  idleShutdownArmed,
  sessionLocked,
} = {}) {
  return !!idleShutdownArmed || !!sessionLocked;
}

/** Αυτόματο κλείδωμα μόνο την πρώτη φορά — όχι ξανά μόλις ξεκλειδώσει για να δουλέψει. */
export function shouldStartKhmdhsAutoLock({
  idleShutdownArmed,
  sessionLocked,
  alreadyAutoLocked,
} = {}) {
  return !!idleShutdownArmed && !sessionLocked && !alreadyAutoLocked;
}

/** Το Χ του παραθύρου ακυρώνει το σβήσιμο μόνο αν ο χρήστης έχει ξεκλειδώσει. */
export function shouldDisarmIdleShutdownOnWindowClose({
  sessionLocked,
  shutdownPending,
} = {}) {
  return !!shutdownPending && !sessionLocked;
}

export function applyPendingIdleShutdownArmedOff({
  sessionLocked,
  pendingArmedOff,
} = {}) {
  if (sessionLocked) return { accept: false, armed: true, keepPending: true };
  if (pendingArmedOff) return { accept: true, armed: false, keepPending: false };
  return { accept: false, armed: null, keepPending: false };
}

export function evaluateKhmdhsSessionUnlock({
  locked,
  sessionUsername,
  attemptUsername,
} = {}) {
  if (!locked) return { ok: true };
  if (!sameKhmdhsSessionUsername(sessionUsername, attemptUsername)) {
    return { ok: false, error: 'Λάθος όνομα χρήστη ή κωδικός' };
  }
  return { ok: true };
}

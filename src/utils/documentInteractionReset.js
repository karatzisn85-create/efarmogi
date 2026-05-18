/**
 * Επαναφέρει καθολικά στυλ στο document/body που συχνά «κολλάνε» μετά από
 * full-screen overlay, modal ή native dialog (confirm/alert) στο Electron.
 */

/** Αυξάνεται σε κάθε πλήρες reset — ακυρώνει εκκρεμείς rAF από scheduleDocumentInteractionRecovery (π.χ. μετά από αποσύνδεση). */
let interactionRecoveryEpoch = 0;

/**
 * Μόνο όταν true επιτρέπεται να ξανακλειδωθεί το scroll (π.χ. ανοιχτός Χώρος Εργασίας).
 * Μετά από αποσύνδεση / κλείσιμο overlay παραμένει false — αποφεύγει κολλημένα πεδία login.
 */
let interactionLockAllowed = false;

function applyDomInteractionUnlock() {
  if (typeof document === 'undefined') return;
  try {
    const targets = [document.body, document.documentElement, document.getElementById('root')].filter(
      Boolean
    );
    targets.forEach((el) => {
      el.style.removeProperty('overflow');
      el.style.removeProperty('padding-right');
      el.style.removeProperty('pointer-events');
    });
    document.body.removeAttribute('inert');
  } catch {
    /* ignore */
  }
}

export function resetDocumentInteractionState() {
  if (typeof document === 'undefined') return;
  interactionRecoveryEpoch += 1;
  interactionLockAllowed = false;
  applyDomInteractionUnlock();
}

/** Επιτρέπει lock scroll μόνο όσο είναι ανοιχτό full-screen overlay (π.χ. TaskAssignmentManager). */
export function allowDocumentInteractionLock() {
  interactionLockAllowed = true;
}

/**
 * Μετά από window.confirm / alert: διπλό rAF ώστε να προλάβει το Electron να
 * απελευθερώσει focus/pointer-events πριν ξανακλειδώσουμε scroll (αν χρειάζεται).
 * Οι εκκρεμείς rAF ακυρώνονται όταν καλεστεί resetDocumentInteractionState() (π.χ. αποσύνδεση).
 */
export function scheduleDocumentInteractionRecovery({ lockScroll = false } = {}) {
  if (typeof document === 'undefined') return;

  const epoch = interactionRecoveryEpoch;
  const run = () => {
    if (epoch !== interactionRecoveryEpoch) return;
    applyDomInteractionUnlock();
    if (lockScroll && interactionLockAllowed && epoch === interactionRecoveryEpoch) {
      document.body.style.overflow = 'hidden';
    }
  };

  run();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      if (epoch !== interactionRecoveryEpoch) return;
      run();
      requestAnimationFrame(() => {
        if (epoch !== interactionRecoveryEpoch) return;
        run();
      });
    });
  } else {
    setTimeout(() => {
      if (epoch !== interactionRecoveryEpoch) return;
      run();
    }, 0);
    setTimeout(() => {
      if (epoch !== interactionRecoveryEpoch) return;
      run();
    }, 16);
  }
}

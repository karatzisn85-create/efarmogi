/**
 * Επαναφέρει καθολικά στυλ στο document/body που συχνά «κολλάνε» μετά από
 * full-screen overlay, modal ή native dialog (confirm/alert) στο Electron.
 */
import { forceUnlockBodyScroll } from './bodyScrollLock';

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
  forceUnlockBodyScroll();
  applyDomInteractionUnlock();
}

/** Επιτρέπει lock scroll μόνο όσο είναι ανοιχτό full-screen overlay (π.χ. TaskAssignmentManager). */
export function allowDocumentInteractionLock() {
  interactionLockAllowed = true;
}

/**
 * Επιστρέφει αν υπάρχει ενεργό «direct lock» (π.χ. TaskAssignmentManager).
 * Χρησιμοποιείται από InteractionGuard για να διακρίνει legitimate από stale lock.
 */
export function isInteractionLockAllowed() {
  return interactionLockAllowed;
}

/**
 * Μετά από κλείσιμο overlay/modal/alert: διπλό rAF ώστε να προλάβει το Electron να
 * απελευθερώσει focus/pointer-events πριν ξανακλειδώσουμε scroll (αν χρειάζεται).
 * Στο τελευταίο rAF (cleanup path) εκτελείται και window.blur+focus ώστε να
 * επαναφερθεί σωστά η δρομολόγηση keyboard events — γνωστό Electron bug μετά από
 * αφαίρεση focused element από το DOM.
 * Οι εκκρεμείς rAF ακυρώνονται όταν καλεστεί resetDocumentInteractionState() (π.χ. αποσύνδεση).
 */
export function scheduleDocumentInteractionRecovery({ lockScroll = false } = {}) {
  if (typeof document === 'undefined') return;

  const epoch = interactionRecoveryEpoch;
  const run = () => {
    if (epoch !== interactionRecoveryEpoch) return;
    if (!lockScroll) {
      forceUnlockBodyScroll();
    }
    applyDomInteractionUnlock();
    if (lockScroll && interactionLockAllowed && epoch === interactionRecoveryEpoch) {
      document.body.style.overflow = 'hidden';
      document.body.setAttribute('data-modal-open', 'true');
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
        // OS-level BrowserWindow focus cycle μέσω main process.
        // window.blur/focus() (DOM API) δεν αρκεί — χρειάζεται mainWindow.blur/focus()
        // από τον main process για πλήρη επαναφορά keyboard routing στο Electron.
        if (!lockScroll) {
          try { window.electronAPI.invoke('refocus-window').catch(() => {}); } catch { /* ignore */ }
        }
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
      if (!lockScroll) {
        try { window.electronAPI.invoke('refocus-window').catch(() => {}); } catch { /* ignore */ }
      }
    }, 32);
  }
}

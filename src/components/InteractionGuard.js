import { useEffect } from 'react';
import { getHolderCount, forceUnlockBodyScroll } from '../utils/bodyScrollLock';
import { isInteractionLockAllowed } from '../utils/documentInteractionReset';

/**
 * Δίχτυ ασφαλείας: κάθε 2 δευτερόλεπτα ελέγχει αν body/html/#root
 * έχουν κολλημένα styles.
 *
 * ── Λογική (Φάση 1) ──
 * Υπάρχουν δύο νόμιμες πηγές scroll-lock:
 *   1. lockBodyScroll() → bodyScrollLock.holders (ref-counted)
 *   2. scheduleDocumentInteractionRecovery({ lockScroll: true }) → interactionLockAllowed
 *
 * Αν κανένας νόμιμος holder δεν είναι ενεργός, το data-modal-open / overflow:hidden
 * είναι αδιαμφισβήτητα stale → αφαίρεση αμέσως.
 *
 * pointer-events:none / inert στο body/root είναι ΠΑΝΤΑ κολλημένα — αφαιρούνται ανεξάρτητα.
 */
export default function InteractionGuard() {
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document === 'undefined') return;

      const targets = [
        document.body,
        document.documentElement,
        document.getElementById('root'),
      ].filter(Boolean);

      // ── 1. pointer-events:none / inert: ΠΑΝΤΑ κολλημένα αν βρίσκονται στο body/root ──
      targets.forEach((el) => {
        if (el.style.pointerEvents === 'none') el.style.removeProperty('pointer-events');
      });
      if (document.body.hasAttribute('inert')) document.body.removeAttribute('inert');

      // ── 2. overflow:hidden / data-modal-open: μόνο αν δεν υπάρχει νόμιμος holder ──
      const hasLegitLock = getHolderCount() > 0 || isInteractionLockAllowed();
      if (hasLegitLock) return;

      targets.forEach((el) => {
        if (el.style.overflow === 'hidden') el.style.removeProperty('overflow');
      });
      if (document.body.hasAttribute('data-modal-open')) {
        document.body.removeAttribute('data-modal-open');
        forceUnlockBodyScroll();
      }
    }, 2000);

    return () => clearInterval(id);
  }, []);

  return null;
}

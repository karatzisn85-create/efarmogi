/**
 * Ref-counted body scroll lock — πολλά modals μπορούν να ζητήσουν lock
 * ταυτόχρονα χωρίς να κάνουν conflict μεταξύ τους.
 */

const holders = new Set();

export function lockBodyScroll(holderId) {
  if (typeof document === 'undefined') return;
  holders.add(holderId);
  document.body.style.overflow = 'hidden';
  document.body.setAttribute('data-modal-open', 'true');
}

export function unlockBodyScroll(holderId) {
  if (typeof document === 'undefined') return;
  holders.delete(holderId);
  if (holders.size === 0) {
    document.body.style.overflow = '';
    document.body.removeAttribute('data-modal-open');
  }
}

export function forceUnlockBodyScroll() {
  if (typeof document === 'undefined') return;
  holders.clear();
  document.body.style.overflow = '';
  document.body.removeAttribute('data-modal-open');
}

export function isBodyScrollLocked() {
  return holders.size > 0;
}

/** Αριθμός ενεργών holders — χρησιμοποιείται από InteractionGuard για ανίχνευση stale lock. */
export function getHolderCount() {
  return holders.size;
}

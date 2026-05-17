/**
 * Επαναφέρει καθολικά στυλ στο document/body που συχνά «κολλάνε» μετά από
 * full-screen overlay, modal ή native dialog (confirm/alert) στο Electron.
 */
export function resetDocumentInteractionState() {
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

/**
 * Μετά από window.confirm / alert: διπλό rAF ώστε να προλάβει το Electron να
 * απελευθερώσει focus/pointer-events πριν ξανακλειδώσουμε scroll (αν χρειάζεται).
 */
export function scheduleDocumentInteractionRecovery({ lockScroll = false } = {}) {
  if (typeof document === 'undefined') return;

  const run = () => {
    resetDocumentInteractionState();
    if (lockScroll) {
      document.body.style.overflow = 'hidden';
    }
  };

  run();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
  } else {
    setTimeout(run, 0);
    setTimeout(run, 16);
  }
}

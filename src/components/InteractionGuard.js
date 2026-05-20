import { useEffect } from 'react';

/**
 * Δίχτυ ασφαλείας: κάθε 2 δευτερόλεπτα ελέγχει αν body/html/#root
 * έχουν κολλημένα styles χωρίς να υπάρχει κάποιο ανοιχτό modal.
 * Αν ναι, τα αφαιρεί αυτόματα.
 */
export default function InteractionGuard() {
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document === 'undefined') return;
      const modalOpen = document.body.hasAttribute('data-modal-open');
      if (modalOpen) return;

      const targets = [document.body, document.documentElement, document.getElementById('root')].filter(Boolean);
      targets.forEach((el) => {
        if (el.style.overflow === 'hidden') el.style.removeProperty('overflow');
        if (el.style.pointerEvents === 'none') el.style.removeProperty('pointer-events');
      });
      if (document.body.hasAttribute('inert')) document.body.removeAttribute('inert');
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return null;
}

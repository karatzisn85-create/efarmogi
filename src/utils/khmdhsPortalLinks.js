/** Σύνδεσμοι προβολής εγγράφων / πύλης ΚΗΜΔΗΣ (όχι το opendata API root). */

const KHMDHS_BASE = 'https://cerpp.eprocurement.gov.gr';

/** Δημόσια αρχική σελίδα αναζήτησης πράξεων */
export const KHMDHS_PORTAL_HOME_URL = `${KHMDHS_BASE}/upgkimdis/unprotected/home.xhtml`;

/** @deprecated — χρήση buildKhmdhsOpenUrl / KHMDHS_PORTAL_HOME_URL */
export const KHMDHS_PORTAL_SEARCH_URL = KHMDHS_PORTAL_HOME_URL;

const ATTACHMENT_SEGMENT = {
  REQ: 'request',
  PROC: 'notice',
  AWRD: 'auction',
  SYMV: 'contract',
  PAY: 'payment',
};

function normalizePortalAdam(adamRaw) {
  return String(adamRaw || '').trim().toUpperCase().replace(/\*+$/, '');
}

function adamType(adam) {
  const m = /^(\d{2})([A-Z]{3,4})(\d{9})$/i.exec(String(adam || ''));
  return m ? m[2].toUpperCase() : '';
}

/**
 * Σελίδα προβολής πράξης στην πύλη ΚΗΜΔΗΣ (λεπτομέρειες + προβολή PDF μέσα στο site).
 * Δεν είναι το opendata attachment endpoint που προκαλεί άμεση λήψη αρχείου.
 */
export function buildKhmdhsPortalViewUrl(adamRaw) {
  const adam = normalizePortalAdam(adamRaw);
  if (!adam) return KHMDHS_PORTAL_HOME_URL;
  const url = new URL(`${KHMDHS_BASE}/upgkimdis/unprotected/home.xhtml`);
  url.searchParams.set('referenceNumber', adam);
  return url.toString();
}

/**
 * URL PDF εγγράφου πράξης στο ΚΗΜΔΗΣ (opendata attachment endpoint — λήψη αρχείου).
 * @returns {string|null}
 */
export function buildKhmdhsDocumentUrl(adamRaw) {
  const adam = normalizePortalAdam(adamRaw);
  const segment = ATTACHMENT_SEGMENT[adamType(adam)];
  if (!segment) return null;
  return `${KHMDHS_BASE}/khmdhs-opendata/${segment}/attachment/${encodeURIComponent(adam)}`;
}

/** URL προβολής PDF πράξης (inline σε παράθυρο Electron) */
export function buildKhmdhsDocumentViewUrl(adamRaw) {
  return buildKhmdhsDocumentUrl(adamRaw);
}

/** Προβολή πράξης — PDF αν υπάρχει, αλλιώς πύλη */
export function buildKhmdhsOpenUrl(adamRaw) {
  return buildKhmdhsDocumentUrl(adamRaw) || buildKhmdhsPortalViewUrl(adamRaw);
}

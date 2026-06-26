/** Ετικέτες σταδίων ΚΗΜΔΗΣ για τον χρήστη — χωρίς εσωτερικούς κωδικούς τύπου */

export const KHMDHS_STAGE_LABELS_EL = {
  REQ: 'πρωτογενές αίτημα',
  PROC: 'δημοσίευση',
  AWRD: 'ανάθεση',
  SYMV: 'σύμβαση',
  PAY: 'ένταλμα πληρωμής',
};

export function khmdhsStageLabelEl(type) {
  return KHMDHS_STAGE_LABELS_EL[String(type || '').toUpperCase()] || 'έγγραφο';
}

export function formatKhmdhsFoundLines(found = {}) {
  const lines = [];
  if (found.request) lines.push({ label: 'Πρωτογενές αίτημα', value: found.request });
  if (found.notice) lines.push({ label: 'Δημοσίευση', value: found.notice });
  if (found.auction) lines.push({ label: 'Ανάθεση', value: found.auction });
  if (found.contract) lines.push({ label: 'Σύμβαση', value: found.contract });
  return lines;
}

/** Μετατροπή πηγής ποσού (από ανάκτηση) σε απλή φράση */
export function plainContractAmountSource(source) {
  const s = String(source || '').trim();
  if (!s) return '';
  if (/σύμβαση/i.test(s)) return 'από τη σύμβαση στο ΚΗΜΔΗΣ';
  if (/ανάθεση/i.test(s) || /awrd/i.test(s)) return 'από την απόφαση ανάθεσης';
  if (/διαγων/i.test(s) || /proc/i.test(s) || /δημοσιεύ/i.test(s)) return 'από τη δημοσίευση';
  return 'από συνδεδεμένη πράξη της ίδιας υπόθεσης';
}

/**
 * Χρονολογική σειρά εγγράφων ΚΗΜΔΗΣ (παλαιότερο → νεότερο).
 * Χρησιμοποιείται σε getters ανάγνωσης — όχι σε αποθήκευση.
 */

import { parseAppDate } from './dateFormat';

const SNAPSHOT_DATE_FIELDS = [
  'signedDate',
  'issueDate',
  'submissionDate',
  'publicationDate',
];

/**
 * Ακατέργαστη τιμή ημερομηνίας από snapshot / πεδίο registry / fetchedAt.
 * @param {{ snapshot?: object|null, date?: string, adam?: string, fetchedAt?: string }} item
 * @returns {string}
 */
export function resolveKhmdhsDocumentDateValue(item) {
  const snap = item?.snapshot;
  if (snap && typeof snap === 'object') {
    for (let i = 0; i < SNAPSHOT_DATE_FIELDS.length; i += 1) {
      const raw = snap[SNAPSHOT_DATE_FIELDS[i]];
      if (raw != null && String(raw).trim()) return String(raw).trim();
    }
  }
  if (item?.date != null && String(item.date).trim()) return String(item.date).trim();
  if (item?.fetchedAt != null && String(item.fetchedAt).trim()) {
    return String(item.fetchedAt).trim();
  }
  return '';
}

/**
 * @returns {number|null} epoch ms ή null αν δεν υπάρχει έγκυρη ημερομηνία
 */
export function khmdhsDocumentTimestamp(item) {
  const raw = resolveKhmdhsDocumentDateValue(item);
  if (!raw) return null;
  const d = parseAppDate(raw);
  if (d) return d.getTime();
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function adamKey(item) {
  return String(item?.adam || item?.snapshot?.referenceNumber || '').trim();
}

/**
 * Σύγκριση παλαιότερο → νεότερο.
 * Χωρίς ημερομηνία στο τέλος· ισοπαλία κατά ΑΔΑΜ.
 */
export function compareKhmdhsDocumentsByDateAsc(a, b) {
  const ta = khmdhsDocumentTimestamp(a);
  const tb = khmdhsDocumentTimestamp(b);
  const hasA = ta != null;
  const hasB = tb != null;
  if (hasA && hasB && ta !== tb) return ta - tb;
  if (hasA && !hasB) return -1;
  if (!hasA && hasB) return 1;
  return adamKey(a).localeCompare(adamKey(b), 'el');
}

export function sortKhmdhsDocumentsByDateAsc(items) {
  return [...(items || [])].sort(compareKhmdhsDocumentsByDateAsc);
}

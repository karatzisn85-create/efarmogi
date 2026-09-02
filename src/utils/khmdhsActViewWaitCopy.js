/** Κείμενο αναμονής όταν ανοίγει έγγραφο από το ΚΗΜΔΗΣ (όχι από την εφαρμογή). */

export const KHMDHS_ACT_VIEW_WAIT_TITLE = 'Αναμονή απάντησης από ΚΗΜΔΗΣ';

export const KHMDHS_ACT_VIEW_WAIT_BODY =
  'Η εφαρμογή ζήτησε το αρχείο και είναι έτοιμη να το ανοίξει. '
  + 'Η καθυστέρηση οφείλεται στο ΚΗΜΔΗΣ (το μητρώο του Δημοσίου), που συχνά αργεί να στείλει το έγγραφο. '
  + 'Μπορείτε να ακυρώσετε την αναμονή και να συνεχίσετε την εργασία σας.';

export const KHMDHS_ACT_VIEW_WAIT_CANCEL = 'Ακύρωση αναμονής';

export const KHMDHS_ACT_VIEW_WAIT_MIN_MS = 500;

export function buildKhmdhsActViewWaitLabel(label) {
  const text = String(label || '').trim();
  return text ? `Έγγραφο: ${text}` : '';
}

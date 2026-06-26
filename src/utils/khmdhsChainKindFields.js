/**
 * Πεδία ανά είδος πράξης αλυσίδας — ο χρήστης επιλέγει τύπο, η εφαρμογή δείχνει μόνο τα σχετικά.
 */

import { parseGreekAmountString } from './khmdhsFields';
import { CHAIN_KIND, MOD_AMOUNT_TYPE } from './khmdhsChainActions';

export function getChainKindFieldProfile(kind, {
  hasKhmdhsAmount = false,
  hasKhmdhsDate = false,
} = {}) {
  switch (kind) {
    case CHAIN_KIND.EXTENSION:
      return {
        title: 'Στοιχεία παράτασης',
        hint: 'Για παράταση χρόνου δεν χρειάζεται ποσό — μόνο η νέα προθεσμία εκτέλεσης.',
        needsEndDate: true,
        needsModAmount: false,
        needsModAmountType: false,
        needsModDate: false,
        needsRepublicationTarget: false,
      };
    case CHAIN_KIND.MODIFICATION:
      return {
        title: 'Στοιχεία συμπληρωματικής σύμβασης',
        hint: hasKhmdhsAmount
          ? 'Ελέγξτε το ποσό από το έγγραφο — διορθώστε αν διαφέρει από ΚΗΜΔΗΣ. Δηλώστε αν είναι διαφορά ή νέα συνολική αξία.'
          : 'Το ποσό λείπει από την ηλεκτρονική καταχώριση — συμπληρώστε το από το PDF και δηλώστε αν είναι διαφορά ή νέα συνολική αξία.',
        needsEndDate: false,
        needsModAmount: true,
        needsModAmountType: true,
        needsModDate: !hasKhmdhsDate,
        needsRepublicationTarget: false,
      };
    case CHAIN_KIND.REPUBLICATION:
      return {
        title: 'Στοιχεία ορθής επανάληψης',
        hint: 'Δηλώστε ποιο έγγραφο διορθώνει και τι αλλάζει — δεν προστίθεται ως νέα γραμμή.',
        needsEndDate: false,
        needsModAmount: false,
        needsModAmountType: false,
        needsModDate: false,
        needsRepublicationTarget: true,
      };
    case CHAIN_KIND.OTHER:
      return {
        title: 'Σημείωση',
        hint: 'Καταγράφεται ως σχετική πράξη — χωρίς αυτόματη επίπτωση σε ποσά ή ημερομηνίες.',
        needsEndDate: false,
        needsModAmount: false,
        needsModAmountType: false,
        needsModDate: false,
        needsRepublicationTarget: false,
      };
    default:
      return null;
  }
}

export function validateChainKindDraft({
  kind,
  endDate = '',
  modAmount = '',
  modAmountType = '',
  modDate = '',
  correctsAdam = '',
  correctsParts = [],
  hasKhmdhsAmount = false,
  hasKhmdhsDate = false,
} = {}) {
  if (!kind) return { ok: false, message: 'Επιλέξτε το είδος του εγγράφου.' };

  const profile = getChainKindFieldProfile(kind, { hasKhmdhsAmount, hasKhmdhsDate });
  if (!profile) return { ok: false, message: 'Μη έγκυρος χαρακτηρισμός.' };

  if (profile.needsEndDate && String(endDate || '').trim().length < 8) {
    return { ok: false, message: 'Συμπληρώστε τη νέα ημερομηνία λήξης.' };
  }

  if (profile.needsModDate && String(modDate || '').trim().length < 8) {
    return { ok: false, message: 'Συμπληρώστε την ημερομηνία της συμπληρωματικής σύμβασης.' };
  }

  if (profile.needsModAmount) {
    const n = parseGreekAmountString(modAmount);
    if (!n) return { ok: false, message: 'Συμπληρώστε το ποσό της συμπληρωματικής από το έγγραφο.' };
  }

  if (profile.needsModAmountType && !modAmountType) {
    return { ok: false, message: 'Δηλώστε αν το ποσό είναι διαφορά ή νέα συνολική αξία.' };
  }

  if (profile.needsRepublicationTarget) {
    if (!correctsAdam) {
      return { ok: false, message: 'Επιλέξτε ποιο έγγραφο διορθώνει.' };
    }
    if (!correctsParts?.length) {
      return { ok: false, message: 'Επιλέξτε τι διορθώνει (τίτλος, ποσό ή ημερομηνία).' };
    }
  }

  return { ok: true };
}

/** Επιστρέφει modAmountType προεπιλογή για τροποποίηση */
export function defaultModAmountType() {
  return MOD_AMOUNT_TYPE.DELTA;
}

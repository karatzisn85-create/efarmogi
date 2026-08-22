/**
 * Πεδία ανά είδος πράξης αλυσίδας — ο χρήστης επιλέγει τύπο, η εφαρμογή δείχνει μόνο τα σχετικά.
 */

import khmdhsPostFetch from '../../app/core/khmdhsPostFetch';
import { MOD_AMOUNT_TYPE } from './khmdhsChainActions';

export function getChainKindFieldProfile(kind, {
  hasKhmdhsAmount = false,
  hasKhmdhsDate = false,
} = {}) {
  return khmdhsPostFetch.getChainKindFieldProfile(kind, { hasKhmdhsAmount, hasKhmdhsDate });
}

export function validateChainKindDraft(draft = {}) {
  return khmdhsPostFetch.validateChainKindDraft(draft);
}

/** Επιστρέφει modAmountType προεπιλογή για τροποποίηση */
export function defaultModAmountType() {
  return MOD_AMOUNT_TYPE.DELTA;
}

/**
 * Ανίχνευση αποθηκευμένης αλυσίδας ΚΗΜΔΗΣ — ανεξάρτητα από το αν θυμάται η φόρμα τον αρχικό κωδικό ανάκτησης.
 */

import { projectHasKhmdhsFormResults } from '../components/KhmdhsFormStageResults';
import { collectAllChainAdams } from './khmdhsChainFormAccess';
import { parseKhmdhsAdamType } from './khmdhsAdamGuidance';
import { isMultipleContractsForm } from './khmdhsFields';

function normalizeAdam(value) {
  return String(value || '').trim().toUpperCase().replace(/\*+$/, '').replace(/\s+/g, '');
}

export function getStoredChainSeedAdam(form, project = null) {
  const fromForm = normalizeAdam(form?.khmdhsChainSeedAdam);
  if (fromForm) return fromForm;

  const fromMeta = normalizeAdam(form?.khmdhsAdamChainMeta?.seedAdam);
  if (fromMeta) return fromMeta;

  if (project) {
    const fromProject = normalizeAdam(project.khmdhsChainSeedAdam)
      || normalizeAdam(project.khmdhsAdamChainMeta?.seedAdam);
    if (fromProject) return fromProject;
  }

  return normalizeAdam(form?.khmdhsRequestAdam)
    || normalizeAdam(form?.khmdhsNoticeAdam)
    || normalizeAdam(form?.khmdhsAwardAdam)
    || normalizeAdam(form?.khmdhsAdam)
    || '';
}

/** Υπάρχει ήδη ανακτημένη/αποθηκευμένη αλυσίδα στο υποέργο */
export function formHasStoredKhmdhsChain(form) {
  if (!form || !projectHasKhmdhsFormResults(form)) return false;

  if (collectAllChainAdams(form).length > 0) return true;

  if (!isMultipleContractsForm(form?.implementationForm)) {
    return !!(
      normalizeAdam(form.khmdhsAdam)
      || normalizeAdam(form.khmdhsRequestAdam)
      || normalizeAdam(form.khmdhsNoticeAdam)
    );
  }

  return (form.contracts || []).some((c) => normalizeAdam(c?.khmdhsAdam));
}

/**
 * Νέος SYMV στο ενιαίο πεδίο ανάκτησης → προσθήκη συμπληρωματικής, όχι αντικατάσταση αλυσίδας.
 *
 * Μόνο όταν υπάρχει ήδη ΚΥΡΙΑ σύμβαση. Αν η αλυσίδα είναι μερική (π.χ. μόνο
 * αίτημα/δημοσίευση, χωρίς SYMV), ο νέος SYMV πρέπει να περάσει από κανονική
 * ανάκτηση / συρραφή ώστε να συμπληρώσει το κενό στάδιο σύμβασης — όχι από
 * τη ροή «συμπληρωματική» (που δεν επιτρέπει επιλογή «κύρια σύμβαση»).
 */
export function shouldRouteAdamAsSupplementaryAdd(form, adam, { contractIndex = null } = {}) {
  const seed = normalizeAdam(adam);
  if (!seed || parseKhmdhsAdamType(seed) !== 'SYMV') return false;
  if (!formHasStoredKhmdhsChain(form)) return false;

  const multi = isMultipleContractsForm(form?.implementationForm);

  if (multi && contractIndex != null) {
    const row = form.contracts?.[contractIndex];
    if (!normalizeAdam(row?.khmdhsAdam)) return false;
    if (!row?.khmdhsContractSnapshot) return false;
    return !collectAllChainAdams(form, contractIndex).includes(seed);
  }

  if (!multi && contractIndex == null) {
    // Χωρίς κύρια σύμβαση ακόμα → όχι συμπληρωματική· πιθανή συρραφή / συμπλήρωση σταδίου.
    const hasPrimaryContract = !!(
      normalizeAdam(form?.khmdhsAdam)
      || form?.khmdhsContractSnapshot
    );
    if (!hasPrimaryContract) return false;
    return !collectAllChainAdams(form).includes(seed);
  }

  return false;
}

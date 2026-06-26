/**
 * Έλεγχος προσθήκης συμπληρωματικής — διαφορετική ανάθεση / άλλη υπόθεση.
 */

import { isMultipleContractsForm } from './khmdhsFields';

function normalizeAdam(value) {
  return String(value || '').trim().toUpperCase().replace(/\*+$/, '').replace(/\s+/g, '');
}

export function normalizeAuctionRef(value) {
  return String(value || '').trim().toUpperCase().replace(/\*+$/, '').replace(/\s+/g, '');
}

export function getPrimaryContractAuctionRef(form, contractIndex = null) {
  if (!form) return '';
  const multi = isMultipleContractsForm(form.implementationForm);
  const snap = multi && contractIndex != null
    ? form.contracts?.[contractIndex]?.khmdhsContractSnapshot
    : form.khmdhsContractSnapshot;
  return normalizeAuctionRef(snap?.auctionRefNo);
}

export function getPrimaryContractAdam(form, contractIndex = null) {
  if (!form) return '';
  const multi = isMultipleContractsForm(form.implementationForm);
  if (multi && contractIndex != null) {
    return normalizeAdam(form.contracts?.[contractIndex]?.khmdhsAdam);
  }
  return normalizeAdam(form.khmdhsAdam);
}

export function assessSupplementaryCrossAct(supplementarySnapshot, form, contractIndex = null) {
  const suppAuction = normalizeAuctionRef(supplementarySnapshot?.auctionRefNo);
  const primaryAuction = getPrimaryContractAuctionRef(form, contractIndex);

  if (!suppAuction || !primaryAuction) {
    return { ok: true, needsConfirmation: false };
  }

  if (suppAuction === primaryAuction) {
    return { ok: true, needsConfirmation: false };
  }

  return {
    ok: false,
    needsConfirmation: true,
    suppAuction,
    primaryAuction,
    message: `Η συμπληρωματική συνδέεται με διαφορετική ανάθεση (${suppAuction}) από την κύρια σύμβαση (${primaryAuction}). Είστε σίγουροι ότι ανήκει σε αυτό το υποέργο;`,
  };
}

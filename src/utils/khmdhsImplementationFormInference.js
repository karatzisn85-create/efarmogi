/**
 * Αυτόματος ορισμός «Μορφή Υλοποίησης» από αποτελέσματα αλυσίδας ΚΗΜΔΗΣ.
 */

import {
  ensureParallelMultiContractFromChainMeta,
  resolveParallelContractSiblings,
} from './khmdhsParallelContractApply';
import { shouldOfferSymvChainPlanner } from './khmdhsSymvChainPlanner';

function shouldSkipParallelAutoBootstrap(prev, chainRes) {
  if (prev?.khmdhsSymvChainPlan?.items?.length) return true;
  return shouldOfferSymvChainPlanner(chainRes);
}

function normalizeAdamRef(value) {
  return String(value || '').trim().toUpperCase().replace(/\*+$/, '').replace(/\s+/g, '');
}

/**
 * @returns {'Μια Σύμβαση'|'Πολλές Συμβάσεις'|null}
 */
export function inferImplementationFormFromChainResult(chainRes, { userSelectedBranch = false } = {}) {
  if (!chainRes?.success) return null;
  // Ο χρήστης επέλεξε ρητά ποιος κλάδος ανήκει στο υποέργο — μία σύμβαση, όχι «Πολλές»
  if (userSelectedBranch) {
    return 'Μια Σύμβαση';
  }
  // 2+ SYMV στην αλυσίδα → κατανομή από χρήστη (SymvChainPlanner), όχι αυτόματη εικασία
  if (shouldOfferSymvChainPlanner(chainRes)) {
    return null;
  }
  if (resolveParallelContractSiblings(chainRes).length > 1) {
    return 'Πολλές Συμβάσεις';
  }
  return 'Μια Σύμβαση';
}

/**
 * Όταν η μορφή υλοποίησης είναι κενή, συμπληρώνει implementationForm και (αν χρειάζεται) γραμμές συμβάσεων.
 */
export function prepareFormForInferredImplementationForm(prev, chainRes, {
  contractIndex = -1,
  userSelectedBranch = false,
  selectedSiblings = null,
} = {}) {
  const inferredForm = inferImplementationFormFromChainResult(chainRes, { userSelectedBranch });
  const parallelBoot = shouldSkipParallelAutoBootstrap(prev, chainRes)
    ? { form: prev, upgraded: false }
    : ensureParallelMultiContractFromChainMeta(prev, chainRes, { selectedSiblings });
  const bootForm = parallelBoot.form;

  if (bootForm?.implementationForm) {
    // Ίδια μορφή — αλλά μπορεί να λείπουν γραμμές παράλληλων συμβάσεων (parallelBoot τα συμπληρώνει)
    if (!inferredForm || bootForm.implementationForm === inferredForm) {
      return {
        form: bootForm,
        contractIndex,
        inferredForm: parallelBoot.upgraded ? 'Πολλές Συμβάσεις' : null,
      };
    }
    // Ποτέ αυτόματη υποβάθμιση: Πολλές → Μια
    if (bootForm.implementationForm === 'Πολλές Συμβάσεις') {
      return {
        form: bootForm,
        contractIndex,
        inferredForm: parallelBoot.upgraded ? 'Πολλές Συμβάσεις' : null,
      };
    }
    // Αναβάθμιση επιτρέπεται: Μια Σύμβαση → Πολλές Συμβάσεις — συνεχίζουμε παρακάτω
  }

  if (!inferredForm) {
    return {
      form: bootForm,
      contractIndex,
      inferredForm: parallelBoot.upgraded ? 'Πολλές Συμβάσεις' : null,
    };
  }

  let form = { ...bootForm, implementationForm: inferredForm };
  let idx = contractIndex;

  if (inferredForm === 'Πολλές Συμβάσεις' && !shouldSkipParallelAutoBootstrap(prev, chainRes)) {
    const parallelReady = ensureParallelMultiContractFromChainMeta(form, chainRes, { selectedSiblings });
    form = parallelReady.form;
    const siblings = selectedSiblings?.length
      ? selectedSiblings
      : resolveParallelContractSiblings(chainRes);
    if (siblings.length > 1) {
      const contractAdam = normalizeAdamRef(chainRes.contract?.adam);
      const seedAdam = normalizeAdamRef(chainRes.chainMeta?.seedAdam);
      const matchIdx = siblings.findIndex((a) => {
        const n = normalizeAdamRef(a);
        return n === contractAdam || n === seedAdam;
      });
      idx = matchIdx >= 0 ? matchIdx : 0;
    } else if (idx < 0) {
      idx = 0;
    }
  }

  return { form, contractIndex: idx, inferredForm };
}

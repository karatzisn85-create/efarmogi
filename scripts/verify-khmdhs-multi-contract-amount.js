/**
 * Έλεγχος: πολλές συμβάσεις στην ίδια ανάθεση — όχι λάθος fallback στο συνολικό ποσό.
 */
const { resolveKhmdhsAdamChain } = require('../public/khmdhsAdamChainService');
const { resolveKhmdhsContractAmount } = require('../public/khmdhsOpenData');

const TARGET_ADAM = '25SYMV016457416';
const WRONG_AMOUNT = '43.400,00';

async function main() {
  const chain = await resolveKhmdhsAdamChain(TARGET_ADAM);
  if (!chain.success) throw new Error(chain.error || 'chain failed');

  const linked = chain.chainMeta?.linkedAdams?.contracts || [];
  if (linked.length < 2) {
    throw new Error(`expected multiple contracts, got ${linked.length}`);
  }

  const ff = chain.contract?.formFields || {};
  if (ff.contractAmount === WRONG_AMOUNT) {
    throw new Error(`formFields still propose award total ${WRONG_AMOUNT}`);
  }
  if (chain.contractAmount === WRONG_AMOUNT) {
    throw new Error(`top-level contractAmount still ${WRONG_AMOUNT}`);
  }

  const amountItem = (chain.dataQualityReport?.items || []).find((i) => i.fieldId === 'contractAmount');
  if (!amountItem) throw new Error('contractAmount review item missing');
  if (amountItem.displayValue === `${WRONG_AMOUNT} €`.replace(' € €', ' €')) {
    throw new Error('review item still shows award total');
  }
  if (amountItem.status !== 'missing') {
    throw new Error(`expected missing status, got ${amountItem.status}`);
  }

  const snap = chain.contract?.snapshot;
  const resolved = resolveKhmdhsContractAmount(snap, {
    linkedContractCount: linked.length,
    auctionSnapshot: chain.auction?.snapshot,
  });
  if (resolved.amount != null) {
    throw new Error('resolveKhmdhsContractAmount should not fallback with multiple contracts');
  }
  if (!resolved.multipleContracts) {
    throw new Error('expected multipleContracts flag');
  }

  console.log('OK verify-khmdhs-multi-contract-amount', {
    linkedContracts: linked.length,
    reviewStatus: amountItem.status,
    formAmount: ff.contractAmount || '(empty)',
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Έλεγχοι λογικής αλυσίδας (backend modules).
 */
const { isSupplementaryModificationEntry } = require('../public/khmdhsChainKindClassifier');
const { resolveKhmdhsAdamChain } = require('../public/khmdhsAdamChainService');

async function main() {
  const r = await resolveKhmdhsAdamChain('24SYMV014848518');
  const ext = r.contractChainHistory?.find((h) => h.adam === '24SYMV016093873');
  if (!ext) throw new Error('extension ADAM missing');
  if (isSupplementaryModificationEntry(ext)) {
    throw new Error('extension must not be supplementary candidate');
  }
  const amountMissing = (r.dataQualityReport?.items || []).filter(
    (i) => i.fieldId === 'supplementaryAmount' && i.status === 'missing'
  );
  if (amountMissing.length) throw new Error('should not require supplementary amount for extension');

  console.log('OK verify-khmdhs-chain-phases (backend)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

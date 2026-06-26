/**
 * Έλεγχος: 24SYMV014848518 — παράταση 24SYMV016093873 δεν πρέπει να ζητά ποσό πριν τον χαρακτηρισμό.
 */
const { resolveKhmdhsAdamChain } = require('../public/khmdhsAdamChainService');
const { isSupplementaryModificationEntry } = require('../public/khmdhsChainKindClassifier');

const SEED = '24SYMV014848518';
const EXT_ADAM = '24SYMV016093873';

async function main() {
  const result = await resolveKhmdhsAdamChain(SEED);
  if (!result.success) {
    console.error('FAIL: chain resolve', result.error);
    process.exit(1);
  }

  const ext = result.contractChainHistory.find((h) => h.adam === EXT_ADAM);
  if (!ext) {
    console.error('FAIL: extension ADAM not in chain');
    process.exit(1);
  }

  const report = result.dataQualityReport;
  const amountItems = (report?.items || []).filter((i) => i.fieldId === 'supplementaryAmount');
  const kindItems = (report?.items || []).filter((i) => i.fieldId === 'chainKindReview' && i.chainAdam === EXT_ADAM);

  console.log('Extension entry:', {
    adam: ext.adam,
    kind: ext.kind,
    suggestedKind: ext.suggestedKind,
    confidence: ext.confidence,
    needsReview: ext.needsReview,
    kindNote: ext.kindNote,
    isSupplementary: isSupplementaryModificationEntry(ext),
  });
  console.log('Review items:', {
    supplementaryAmountCount: amountItems.length,
    chainKindReview: kindItems.length,
    pendingActions: (report?.items || []).filter(
      (i) => i.status === 'missing' || i.status === 'needs_review'
    ).map((i) => `${i.fieldId}${i.chainAdam ? `(${i.chainAdam})` : ''}`),
  });

  let ok = true;
  if (ext.suggestedKind !== 'extension') {
    console.error('FAIL: expected suggestedKind extension, got', ext.suggestedKind);
    ok = false;
  }
  if (isSupplementaryModificationEntry(ext)) {
    console.error('FAIL: extension should not be supplementary candidate');
    ok = false;
  }
  if (amountItems.some((i) => i.status === 'missing')) {
    console.error('FAIL: should not have missing supplementaryAmount for extension');
    ok = false;
  }
  if (!kindItems.length) {
    console.error('FAIL: expected chainKindReview for extension ADAM');
    ok = false;
  }

  if (ok) {
    console.log('OK: extension case handled correctly');
    process.exit(0);
  }
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

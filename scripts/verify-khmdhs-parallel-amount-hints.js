/**
 * Έλεγχος: παράλληλες συμβάσεις — αυτόματα ποσά από εντάλματα πληρωμής.
 */
const { resolveKhmdhsAdamChain } = require('../public/khmdhsAdamChainService');
const {
  buildParallelContractAmountHints,
  allSiblingsHaveAmountHints,
} = require('../public/khmdhsParallelContractAmounts');

const SEED = '23REQ013743699';

function testOfflineHints() {
  const hints = buildParallelContractAmountHints({
    siblingAdams: ['24SYMV015347394', '24SYMV015352975'],
    payments: [
      { snapshot: { contractRefNo: '24SYMV015347394', totalCostWithVAT: 256680, cancelled: false } },
      { snapshot: { contractRefNo: '24SYMV015352975', totalCostWithVAT: 379621.99, cancelled: false } },
    ],
  });
  if (!allSiblingsHaveAmountHints(['24SYMV015347394', '24SYMV015352975'], hints)) {
    throw new Error('offline hints: not all siblings covered');
  }
  if (Math.abs(hints['24SYMV015347394'].gross - 256680) > 0.01) {
    throw new Error('offline CIPARTS amount');
  }
  if (Math.abs(hints['24SYMV015352975'].gross - 379621.99) > 0.01) {
    throw new Error('offline VENERIS amount');
  }
}

async function testLiveChain() {
  const r = await resolveKhmdhsAdamChain(SEED);
  if (!r.success) throw new Error(r.error || 'chain failed');

  const siblings = r.chainMeta?.parallelContracts || [];
  if (siblings.length !== 2) {
    throw new Error(`expected 2 parallel contracts, got ${siblings.length}`);
  }

  if (!r.chainMeta?.parallelAmountsFullyInferred) {
    throw new Error('expected parallelAmountsFullyInferred');
  }

  const hints = r.chainMeta.parallelContractAmountsByAdam || {};
  const ciparts = hints['24SYMV015347394'];
  const veneris = hints['24SYMV015352975'];
  if (!ciparts || Math.abs(ciparts.gross - 256680) > 0.02) {
    throw new Error(`CIPARTS amount expected 256680, got ${ciparts?.gross}`);
  }
  if (!veneris || Math.abs(veneris.gross - 379621.99) > 0.02) {
    throw new Error(`VENERIS amount expected 379621.99, got ${veneris?.gross}`);
  }

  const parallelSit = (r.situationReport?.situations || []).find(
    (s) => s.id === 'parallel_contracts_same_case'
  );
  if (!parallelSit) throw new Error('parallel situation missing');
  if (parallelSit.requiresDecision) {
    throw new Error('parallel situation should not require decision when amounts inferred');
  }
  if (parallelSit.severity !== 'info') {
    throw new Error(`expected info severity, got ${parallelSit.severity}`);
  }

  const dqrAmountItems = (r.dataQualityReport?.items || []).filter((i) => i.fieldId === 'contractAmount');
  if (dqrAmountItems.length !== 2) {
    throw new Error(`expected 2 contractAmount DQR items, got ${dqrAmountItems.length}`);
  }

  console.log('OK verify-khmdhs-parallel-amount-hints (live)', {
    siblings: siblings.length,
    amounts: hints,
    dqrAmounts: dqrAmountItems.map((i) => i.displayValue),
  });
}

async function main() {
  testOfflineHints();
  await testLiveChain();
  console.log('OK verify-khmdhs-parallel-amount-hints (offline + live)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

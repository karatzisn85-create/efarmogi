/**
 * Έλεγχος Φάσης Λ4 — παράλληλες συμβάσεις, ορφανή συμπληρωματική, διορθωμένη ανάθεση, ΦΠΑ.
 */
const assert = require('assert');
const { resolveKhmdhsAdamChain, resolveKhmdhsSupplementaryContract } = require('../public/khmdhsAdamChainService');
const {
  detectParallelContractSiblings,
  validateOrphanSupplementaryCandidate,
} = require('../public/khmdhsParallelContracts');
const {
  inferKhmdhsVatRate,
  resolveKhmdhsGrossAmountDetailed,
} = require('../public/khmdhsVatHelper');

async function testParallelContractsFromSymv() {
  const r = await resolveKhmdhsAdamChain('25SYMV016457416');
  if (!r.success) throw new Error(r.error || 'chain failed');
  if (r.contract?.adam !== '25SYMV016457416') {
    throw new Error(`expected seed contract, got ${r.contract?.adam}`);
  }
  const siblings = r.chainMeta?.parallelContracts || [];
  if (siblings.length < 2) {
    throw new Error(`expected parallel siblings, got ${siblings.length}`);
  }
  if (!r.chainMeta?.hasParallelContracts) {
    throw new Error('hasParallelContracts flag missing');
  }
  console.log('OK parallel contracts from SYMV seed', { siblings: siblings.length });
}

async function testNoWrongContractFromAwrd() {
  const r = await resolveKhmdhsAdamChain('25AWRD016385693');
  if (!r.success) throw new Error(r.error || 'chain failed');
  if (r.contract?.adam) {
    throw new Error(`AWRD seed should not auto-pick contract among parallels, got ${r.contract.adam}`);
  }
  if (!(r.chainMeta?.parallelContracts || []).length) {
    throw new Error('expected parallelContracts in meta');
  }
  if (!r.auction?.adam) throw new Error('auction should resolve from AWRD seed');
  const parallelSituation = (r.situationReport?.situations || []).find(
    (s) => s.id === 'parallel_contracts_same_case'
  );
  if (!parallelSituation) throw new Error('parallel_contracts situation missing');
  console.log('OK AWRD seed avoids arbitrary contract pick');
}

async function testRejectParallelAsSupplementary() {
  const res = await resolveKhmdhsSupplementaryContract('25SYMV016457416', {
    primaryContractAdam: '25SYMV016406876',
    existingChainAdams: ['25SYMV016406876'],
  });
  if (res.success) throw new Error('should reject parallel sibling as supplementary');
  if (!/παράλληλη/i.test(res.error || '')) {
    throw new Error(`unexpected error: ${res.error}`);
  }
  console.log('OK reject parallel sibling supplementary');
}

function testVatInference() {
  const rate = inferKhmdhsVatRate(10000, 11300);
  assert.ok(Math.abs(rate - 0.13) < 0.001);
  const gross = resolveKhmdhsGrossAmountDetailed({ withoutVAT: 10000, withVAT: 11300 });
  assert.strictEqual(gross.amount, 11300);
  assert.ok(Math.abs(gross.vatRate - 0.13) < 0.001);
  console.log('OK VAT inference (13%)');
}

function testParallelDetectionUnit() {
  const map = new Map([
    ['A', { prevReferenceNo: null }],
    ['B', { prevReferenceNo: null }],
  ]);
  const info = detectParallelContractSiblings(map);
  assert.strictEqual(info.parallel, true);
  console.log('OK parallel detection unit');
}

async function main() {
  testVatInference();
  testParallelDetectionUnit();
  await testParallelContractsFromSymv();
  await testNoWrongContractFromAwrd();
  await testRejectParallelAsSupplementary();
  console.log('\nΦάση Λ4: όλοι οι έλεγχοι πέρασαν.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

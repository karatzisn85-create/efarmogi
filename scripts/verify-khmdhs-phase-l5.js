/**
 * Έλεγχος Φάσης Λ5 — ποσό ανά αλυσίδα, μετάβαση μορφής, παράλληλες.
 */
const assert = require('assert');
const { resolveKhmdhsAdamChain } = require('../public/khmdhsAdamChainService');
const { buildKhmdhsAmountContext, resolveKhmdhsContractAmount } = require('../public/khmdhsOpenData');

async function testParallelStillBlocksAward() {
  const r = await resolveKhmdhsAdamChain('25SYMV016457416');
  if (!r.success) throw new Error(r.error);
  if (r.contract?.formFields?.contractAmount === '43.400,00') {
    throw new Error('still proposing award total');
  }
  console.log('OK parallel SYMV still blocks wrong award amount');
}

async function testLinearChainAllowsFallback() {
  const r = await resolveKhmdhsAdamChain('24SYMV014848518');
  if (!r.success) throw new Error(r.error);
  const ctx = buildKhmdhsAmountContext({
    stages: { contracts: r.chainMeta?.linkedAdams?.contracts?.map((a) => ({ adam: a })) || [] },
    contractWalk: { primaryAdam: r.contract?.adam },
    parallelContractInfo: { parallel: false, siblingRoots: [r.contract?.adam] },
    auctionSnapshot: r.auction?.snapshot,
    noticeSnapshot: r.notice?.snapshot,
  });
  if (ctx.linkedContractCount !== 1) {
    throw new Error(`expected linkedContractCount 1 for linear chain, got ${ctx.linkedContractCount}`);
  }
  console.log('OK linear chain linkedContractCount=1');
}

function testAmountContextParallel() {
  const ctx = buildKhmdhsAmountContext({
    stages: { contracts: [1, 2, 3] },
    contractWalk: { primaryAdam: '25SYMV016457416' },
    parallelContractInfo: {
      parallel: true,
      siblingRoots: ['25SYMV016406876', '25SYMV016457416', '25SYMV016401992'],
    },
    auctionSnapshot: { totalCostWithoutVAT: 43400, totalCostWithVAT: 53776 },
  });
  const res = resolveKhmdhsContractAmount({ contractBudget: null }, ctx);
  assert.strictEqual(res.multipleContracts, true);
  assert.strictEqual(res.amount, null);
  console.log('OK buildKhmdhsAmountContext parallel block');
}

async function main() {
  testAmountContextParallel();
  await testParallelStillBlocksAward();
  await testLinearChainAllowsFallback();
  console.log('\nΦάση Λ5: όλοι οι έλεγχοι πέρασαν.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

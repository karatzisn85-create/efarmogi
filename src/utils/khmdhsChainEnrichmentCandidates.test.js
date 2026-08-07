/**
 * @jest-environment node
 */
const { collectChainEnrichmentCandidates } = require('../../public/khmdhsAdamChainService');

describe('collectChainEnrichmentCandidates', () => {
  test('περιλαμβάνει PROC δημοσιεύσεις πέρα από REQ/ανάληψη', () => {
    const stages = {
      requests: [{ adam: '26REQ019508965' }],
      approvedRequests: [{ adam: '26REQ019523405' }],
      notices: [{ adam: '26PROC012281700' }, { adam: '26PROC019569916' }],
      auctions: [],
      contracts: [],
      payments: [],
    };
    const candidates = collectChainEnrichmentCandidates(stages, '26REQ019523405');
    expect(candidates).toContain('26REQ019508965');
    expect(candidates).toContain('26PROC012281700');
    expect(candidates).toContain('26PROC019569916');
    expect(candidates).not.toContain('26REQ019523405');
  });

  test('extraAdams περνάνε ως υποψήφιοι', () => {
    const stages = {
      requests: [],
      approvedRequests: [],
      notices: [{ adam: '26PROC012281700' }],
      auctions: [],
      contracts: [],
      payments: [],
    };
    const candidates = collectChainEnrichmentCandidates(
      stages,
      '26REQ019523405',
      ['26PROC019569916']
    );
    expect(candidates).toContain('26PROC012281700');
    expect(candidates).toContain('26PROC019569916');
  });
});

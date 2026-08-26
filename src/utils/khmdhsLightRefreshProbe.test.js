/**
 * @jest-environment node
 *
 * Ο ανιχνευτής ελαφριάς ανανέωσης: σε αμφιβολία δεν παρακάμπτει την εξερεύνηση.
 */
jest.mock('../../public/khmdhsOpenData', () => {
  const actual = jest.requireActual('../../public/khmdhsOpenData');
  return {
    ...actual,
    fetchKhmdhsAdamChain: jest.fn(),
  };
});

const { fetchKhmdhsAdamChain } = require('../../public/khmdhsOpenData');
const { probeKhmdhsLightRefresh } = require('../../public/khmdhsAdamChainService');

const PRIMARY = '26REQ018492003';
const SYMV = '26SYMV018492003';

const storedMeta = {
  actRootReqAdam: PRIMARY,
  linkedAdams: {
    requests: [PRIMARY],
    approvedRequests: [],
    budgetCommitments: ['26REQ018492010'],
    notices: ['26PROC018492003'],
    auctions: ['26AWRD018492003'],
    contracts: [SYMV],
    payments: ['26PAY018492003'],
  },
};

function matchingChain() {
  return {
    success: true,
    adamChain: {
      requests: [PRIMARY],
      approvedRequests: ['26REQ018492010'],
      notices: ['26PROC018492003'],
      auctions: ['26AWRD018492003'],
      contracts: [SYMV],
      payments: ['26PAY018492003'],
    },
  };
}

describe('probeKhmdhsLightRefresh', () => {
  beforeEach(() => {
    fetchKhmdhsAdamChain.mockReset();
  });

  test('χωρίς προτίμηση ελαφρού δεν ρωτά το ΚΗΜΔΗΣ', async () => {
    const out = await probeKhmdhsLightRefresh({ preferLightRefresh: false }, SYMV, null);
    expect(out.skipDoorHunt).toBe(false);
    expect(out.decision.reason).toBe('prefer-off');
    expect(fetchKhmdhsAdamChain).not.toHaveBeenCalled();
  });

  test('τεχνητή αλυσίδα δεν ρωτά — πλήρης διαδρομή', async () => {
    const out = await probeKhmdhsLightRefresh({
      preferLightRefresh: true,
      usesStitchPlan: true,
      storedChainMeta: storedMeta,
    }, SYMV, null);
    expect(out.skipDoorHunt).toBe(false);
    expect(out.decision.reason).toBe('stitch');
    expect(fetchKhmdhsAdamChain).not.toHaveBeenCalled();
  });

  test('ίδια λίστα από το πρωτογενές → παράκαμψη εξερεύνησης πόρτας', async () => {
    fetchKhmdhsAdamChain.mockResolvedValue(matchingChain());
    const out = await probeKhmdhsLightRefresh({
      preferLightRefresh: true,
      storedChainMeta: storedMeta,
    }, SYMV, null);
    expect(out.skipDoorHunt).toBe(true);
    expect(out.decision.mode).toBe('light');
    expect(out.storedPrimary).toBe(PRIMARY);
    expect(fetchKhmdhsAdamChain).toHaveBeenCalledTimes(1);
    expect(fetchKhmdhsAdamChain.mock.calls[0][0]).toBe(PRIMARY);
  });

  test('νέο ένταλμα στη λίστα → δεν παρακάμπτει (πλήρης εξερεύνηση)', async () => {
    const chain = matchingChain();
    chain.adamChain.payments = ['26PAY018492003', '26PAY018499999'];
    fetchKhmdhsAdamChain.mockResolvedValue(chain);
    const out = await probeKhmdhsLightRefresh({
      preferLightRefresh: true,
      storedChainMeta: storedMeta,
    }, SYMV, null);
    expect(out.skipDoorHunt).toBe(false);
    expect(out.decision.reason).toBe('new-adam');
  });

  test('ανάληψη έφυγε από τους ζωντανούς → πλήρες (ακύρωση υπάρχοντος κρίκου)', async () => {
    const chain = matchingChain();
    chain.adamChain.approvedRequests = [];
    fetchKhmdhsAdamChain.mockResolvedValue(chain);
    const out = await probeKhmdhsLightRefresh({
      preferLightRefresh: true,
      storedChainMeta: storedMeta,
    }, SYMV, null);
    expect(out.skipDoorHunt).toBe(false);
    expect(out.decision.reason).toBe('missing-adam');
  });

  test('αποτυχία πίνακα περιεχομένων → πλήρες', async () => {
    fetchKhmdhsAdamChain.mockResolvedValue({ success: false, error: 'down' });
    const out = await probeKhmdhsLightRefresh({
      preferLightRefresh: true,
      storedChainMeta: storedMeta,
    }, SYMV, null);
    expect(out.skipDoorHunt).toBe(false);
    expect(out.decision.reason).toBe('chain-failed');
  });

  test('ακύρωση χρήστη διαδίδεται', async () => {
    fetchKhmdhsAdamChain.mockResolvedValue({
      success: false,
      aborted: true,
      error: 'Η διαδικασία ακυρώθηκε.',
    });
    const out = await probeKhmdhsLightRefresh({
      preferLightRefresh: true,
      storedChainMeta: storedMeta,
    }, SYMV, null);
    expect(out.aborted).toBeTruthy();
    expect(out.skipDoorHunt).toBe(false);
  });
});

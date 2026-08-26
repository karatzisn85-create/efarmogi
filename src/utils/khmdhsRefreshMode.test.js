/**
 * @jest-environment node
 *
 * Διακόπτης ελαφριάς ανανέωσης: πλήρης διαδρομή σε κάθε αβεβαιότητα.
 */
const {
  decideKhmdhsRefreshMode,
  collectAdamsFromLinked,
  collectAdamsFromStages,
} = require('../../public/khmdhsRefreshMode');

const storedLinked = {
  requests: ['26REQ018492003'],
  approvedRequests: [],
  budgetCommitments: ['26REQ018492010'],
  notices: ['26PROC018492003'],
  auctions: ['26AWRD018492003'],
  contracts: ['26SYMV018492003'],
  payments: ['26PAY018492003'],
};

const incomingSame = {
  requests: [{ adam: '26REQ018492003' }],
  approvedRequests: [{ adam: '26REQ018492010' }],
  notices: [{ adam: '26PROC018492003' }],
  auctions: [{ adam: '26AWRD018492003' }],
  contracts: [{ adam: '26SYMV018492003' }],
  payments: [{ adam: '26PAY018492003' }],
};

function decide(overrides) {
  return decideKhmdhsRefreshMode({
    preferLight: true,
    usesStitchPlan: false,
    storedLinkedAdams: storedLinked,
    storedPrimaryReqAdam: '26REQ018492003',
    seedAdam: '26SYMV018492003',
    incomingStages: incomingSame,
    chainFetchOk: true,
    ...overrides,
  });
}

describe('decideKhmdhsRefreshMode', () => {
  test('ίδια λίστα ζωντανών ΑΔΑΜ → ελαφρύ', () => {
    const d = decide();
    expect(d.mode).toBe('light');
    expect(d.reason).toBe('membership-unchanged');
  });

  test('χωρίς προτίμηση ελαφρού → πλήρες', () => {
    expect(decide({ preferLight: false }).mode).toBe('full');
    expect(decide({ preferLight: false }).reason).toBe('prefer-off');
  });

  test('τεχνητή αλυσίδα → πλήρες', () => {
    expect(decide({ usesStitchPlan: true })).toEqual({ mode: 'full', reason: 'stitch' });
  });

  test('αποτυχία πίνακα περιεχομένων → πλήρες', () => {
    expect(decide({ chainFetchOk: false })).toEqual({ mode: 'full', reason: 'chain-failed' });
  });

  test('χωρίς αποθηκευμένους κωδικούς → πλήρες', () => {
    expect(decide({ storedLinkedAdams: null }).reason).toBe('no-stored-membership');
    expect(decide({ storedLinkedAdams: {} }).reason).toBe('no-stored-membership');
  });

  test('χωρίς πρωτογενές αίτημα → πλήρες', () => {
    expect(decide({ storedPrimaryReqAdam: '' }).reason).toBe('no-primary');
  });

  test('κενή νέα λίστα → πλήρες', () => {
    expect(decide({ incomingStages: { contracts: [] } }).reason).toBe('empty-incoming');
  });

  test('νέος ΑΔΑΜ στη λίστα → πλήρες (όχι μόνο μεταγενέστερα «τυφλά»)', () => {
    const incoming = {
      ...incomingSame,
      payments: [{ adam: '26PAY018492003' }, { adam: '26PAY018499999' }],
    };
    const d = decide({ incomingStages: incoming });
    expect(d).toEqual({ mode: 'full', reason: 'new-adam' });
  });

  test('ακυρωμένη ανάληψη (έφυγε από τους ζωντανούς) → πλήρες', () => {
    const incoming = {
      ...incomingSame,
      approvedRequests: [],
    };
    const d = decide({ incomingStages: incoming });
    expect(d).toEqual({ mode: 'full', reason: 'missing-adam' });
  });

  test('ο σπόρος λείπει από τη νέα λίστα → πλήρες', () => {
    const incoming = {
      ...incomingSame,
      contracts: [{ adam: '26SYMV018400000' }],
    };
    const d = decide({ incomingStages: incoming, seedAdam: '26SYMV018492003' });
    expect(d.mode).toBe('full');
    expect(['seed-absent', 'missing-adam', 'new-adam']).toContain(d.reason);
  });

  test('τροποποίηση ίδιου κρίκου (ίδιοι ΑΔΑΜ) δεν μπλοκάρει το ελαφρύ — θα ξανανοίξουν τα έγγραφα', () => {
    const incoming = {
      ...incomingSame,
      contracts: [{ adam: '26SYMV018492003', modified: true }],
    };
    expect(decide({ incomingStages: incoming }).mode).toBe('light');
  });

  test('collectAdamsFromLinked ενώνει αναλήψεις που έχουν χωριστεί από τα αιτήματα', () => {
    const set = collectAdamsFromLinked(storedLinked);
    expect(set.has('26REQ018492003')).toBe(true);
    expect(set.has('26REQ018492010')).toBe(true);
    expect(set.size).toBe(6);
  });

  test('collectAdamsFromStages διαβάζει adam από markers', () => {
    const set = collectAdamsFromStages(incomingSame);
    expect(set.has('26REQ018492010')).toBe(true);
    expect(set.has('26PAY018492003')).toBe(true);
  });
});

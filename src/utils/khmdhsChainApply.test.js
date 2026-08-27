/**
 * @jest-environment node
 */
import {
  applyAdamChainResult,
  applyChainCharacterizationToForm,
  applyStitchRefreshResults,
  mergeSharedKhmdhsFromChain,
  mergeKhmdhsChainMetaForStitch,
} from './khmdhsChainApply';
import { buildKhmdhsRefreshChangeReport } from './khmdhsChainRefresh';
import { resolveReusablePlanForKhmdhsRefresh, SYMV_CHAIN_ROLE } from './khmdhsSymvChainPlanner';

describe('applyAdamChainResult payments merge', () => {
  test('μετά ανανέωση δεν χάνει ένταλμα που έλειπε από το νέο fetch', () => {
    const prev = {
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      implementationForm: 'Έργο',
      khmdhsPayments: [
        {
          adam: '26PAY000000001',
          snapshot: { referenceNumber: '26PAY000000001', totalCostWithVAT: 1000 },
        },
        {
          adam: '26PAY000000002',
          snapshot: null,
          error: 'πολλά αιτήματα',
        },
      ],
    };
    const chainRes = {
      success: true,
      payments: [
        {
          adam: '26PAY000000001',
          snapshot: { referenceNumber: '26PAY000000001', totalCostWithVAT: 1000 },
          fetchedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
      contract: {
        adam: '25SYMV000000001',
        snapshot: { referenceNumber: '25SYMV000000001' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        formFields: {},
      },
    };

    const { form } = applyAdamChainResult(prev, chainRes, { seedAdam: '25SYMV000000001' });

    expect(form.khmdhsPayments).toHaveLength(2);
    expect(form.khmdhsPayments.map((p) => p.adam).sort()).toEqual([
      '26PAY000000001',
      '26PAY000000002',
    ]);
  });

  test('αφαιρεί επιβεβαιωμένα ακυρωμένο ένταλμα και κρατά όσα δεν ακυρώθηκαν', () => {
    const prev = {
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      implementationForm: 'Έργο',
      khmdhsPayments: [
        {
          adam: '26PAY000000001',
          snapshot: { referenceNumber: '26PAY000000001', totalCostWithVAT: 1000 },
        },
        {
          adam: '26PAY000000002',
          snapshot: { referenceNumber: '26PAY000000002', totalCostWithVAT: 2000 },
        },
      ],
    };
    const chainRes = {
      success: true,
      payments: [
        {
          adam: '26PAY000000001',
          snapshot: { referenceNumber: '26PAY000000001', totalCostWithVAT: 1000 },
          fetchedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
      chainMeta: {
        confirmedCancelledAdams: ['26PAY000000002'],
      },
      contract: {
        adam: '25SYMV000000001',
        snapshot: { referenceNumber: '25SYMV000000001' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        formFields: {},
      },
    };

    const { form } = applyAdamChainResult(prev, chainRes, { seedAdam: '25SYMV000000001' });

    expect(form.khmdhsPayments).toHaveLength(1);
    expect(form.khmdhsPayments[0].adam).toBe('26PAY000000001');
  });

  test('συρραφή κόβει εντάλματα άλλων συμβάσεων και κρατά όσα ανήκουν στο δεύτερο πρωτογενές', () => {
    const prev = {
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      implementationForm: 'Έργο',
      khmdhsAdam: '25SYMV016948065',
      khmdhsContractSnapshot: {
        referenceNumber: '25SYMV016948065',
        requestRefNo: '25REQ016832258',
      },
      khmdhsRequestAdam: '25REQ016832258',
      khmdhsRequestSnapshot: { referenceNumber: '25REQ016832258' },
      khmdhsAdamChainMeta: {
        linkedAdams: { requests: ['25REQ016832258'] },
        requestSnapshotsByAdam: {
          '25REQ016832258': { referenceNumber: '25REQ016832258' },
        },
      },
      khmdhsPayments: [],
    };
    const chainRes = {
      success: true,
      request: {
        adam: '24REQ015252599',
        snapshot: { referenceNumber: '24REQ015252599' },
      },
      contract: {
        adam: '25SYMV016948065',
        snapshot: { referenceNumber: '25SYMV016948065', requestRefNo: '25REQ016832258' },
        fetchedAt: '2026-08-01T00:00:00.000Z',
        formFields: {},
      },
      payments: [
        {
          adam: '25PAY000000001',
          snapshot: {
            referenceNumber: '25PAY000000001',
            contractRefNo: '25SYMV016948065',
          },
        },
        {
          adam: '24PAY099999999',
          snapshot: {
            referenceNumber: '24PAY099999999',
            contractRefNo: '24SYMV999999999',
          },
        },
        {
          adam: '24PAY000000010',
          snapshot: {
            referenceNumber: '24PAY000000010',
            requestRefNo: '24REQ015252599',
          },
        },
      ],
    };

    const { form } = applyAdamChainResult(prev, chainRes, {
      seedAdam: '24REQ015252599',
      applyMode: 'stitch',
    });

    const adams = (form.khmdhsPayments || []).map((p) => p.adam);
    expect(adams).toContain('25PAY000000001');
    expect(adams).toContain('24PAY000000010');
    expect(adams).not.toContain('24PAY099999999');
  });
});

describe('mergeSharedKhmdhsFromChain', () => {
  test('διατηρεί υπάρχον ένταλμα όταν το νέο fetch επιστρέφει λιγότερα', () => {
    const prev = {
      khmdhsPayments: [
        {
          adam: '26PAY000000001',
          snapshot: { referenceNumber: '26PAY000000001', totalCostWithVAT: 1000 },
        },
        {
          adam: '26PAY000000002',
          snapshot: null,
          error: 'πολλά αιτήματα',
        },
      ],
    };
    const chainRes = {
      payments: [
        {
          adam: '26PAY000000001',
          snapshot: { referenceNumber: '26PAY000000001', totalCostWithVAT: 1000 },
          fetchedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
    };

    const { next } = mergeSharedKhmdhsFromChain(prev, chainRes);

    expect(next.khmdhsPayments).toHaveLength(2);
    expect(next.khmdhsPayments.map((p) => p.adam).sort()).toEqual([
      '26PAY000000001',
      '26PAY000000002',
    ]);
  });

  test('διατηρεί τη χειροκίνητη διαδικασία ανάθεσης όταν το ΚΗΜΔΗΣ δεν την προσδιορίζει', () => {
    const prev = {
      khmdhsNoticeAdam: '',
      assignmentProcedure: 'Απευθείας ανάθεση (χειροκίνητη καταχώριση)',
    };
    const chainRes = {
      notice: {
        adam: '24PROC012345678',
        snapshot: {},
        fetchedAt: '2026-07-01T00:00:00.000Z',
        // Το ΚΗΜΔΗΣ δεν βρήκε/χαρτογράφησε τη διαδικασία ανάθεσης αυτή τη φορά.
        mappedAssignmentProcedure: '',
      },
    };

    const { next } = mergeSharedKhmdhsFromChain(prev, chainRes);

    expect(next.assignmentProcedure).toBe('Απευθείας ανάθεση (χειροκίνητη καταχώριση)');
    expect(next.khmdhsNoticeAdam).toBe('24PROC012345678');
  });

  test('χρησιμοποιεί την αυτόματη διαδικασία όταν το ΚΗΜΔΗΣ την προσδιορίζει', () => {
    const prev = { khmdhsNoticeAdam: '', assignmentProcedure: '' };
    const chainRes = {
      notice: {
        adam: '24PROC012345678',
        snapshot: {},
        fetchedAt: '2026-07-01T00:00:00.000Z',
        mappedAssignmentProcedure: 'Ανοικτός διαγωνισμός',
      },
    };

    const { next } = mergeSharedKhmdhsFromChain(prev, chainRes);

    expect(next.assignmentProcedure).toBe('Ανοικτός διαγωνισμός');
  });

  test('protect ενώνει τις δημοσιεύσεις των δύο πρωτογενών αντί να κρατά μόνο την πρώτη', () => {
    const prev = {
      khmdhsNoticeAdam: '25PROC000000001',
      khmdhsNoticeSnapshot: { referenceNumber: '25PROC000000001', title: 'Πρόσκληση Α' },
      khmdhsRequestAdam: '25REQ000000001',
      khmdhsRequestSnapshot: { referenceNumber: '25REQ000000001' },
      khmdhsAdamChainMeta: {
        linkedAdams: { notices: ['25PROC000000001', '25PROC000000002'] },
        noticeSnapshotsByAdam: {
          '25PROC000000002': { referenceNumber: '25PROC000000002', title: 'Πρόσκληση Β' },
        },
      },
    };
    const chainRes = {
      request: {
        adam: '24REQ000000099',
        snapshot: { referenceNumber: '24REQ000000099' },
      },
      notice: {
        adam: '24PROC000000099',
        snapshot: { referenceNumber: '24PROC000000099', title: 'Διακήρυξη 2024' },
      },
      chainMeta: {
        linkedAdams: { notices: ['24PROC000000099'] },
        noticeSnapshotsByAdam: {},
      },
    };
    const { next, warnings } = mergeSharedKhmdhsFromChain(prev, chainRes, { protect: true });
    expect(warnings).toContain('noticeConflict');
    expect(next.khmdhsNoticeAdam).toBe('25PROC000000001');
    expect(next.khmdhsRequestAdam).toBe('25REQ000000001');
    const noticeAdams = Object.keys(next.khmdhsAdamChainMeta.noticeSnapshotsByAdam || {});
    expect(noticeAdams).toEqual(expect.arrayContaining([
      '25PROC000000001',
      '25PROC000000002',
      '24PROC000000099',
    ]));
    expect(next.khmdhsAdamChainMeta.linkedAdams.requests).toEqual(
      expect.arrayContaining(['24REQ000000099'])
    );
  });
});

describe('applyAdamChainResult — Φάση Β: διατήρηση σταδίων σε μερική ανάκτηση', () => {
  const basePrev = {
    projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
    implementationForm: 'Έργο',
    khmdhsAdam: '25SYMV000000001',
    khmdhsContractSnapshot: { referenceNumber: '25SYMV000000001' },
    khmdhsContractFetchedAt: '2026-01-01T00:00:00.000Z',
    khmdhsNoticeAdam: '24PROC012345678',
    khmdhsNoticeSnapshot: { referenceNumber: '24PROC012345678' },
    khmdhsAwardAdam: '24AWRD011111111',
    khmdhsAwardSnapshot: { referenceNumber: '24AWRD011111111' },
    khmdhsRequestAdam: '24REQ022222222',
    khmdhsRequestSnapshot: { referenceNumber: '24REQ022222222' },
  };

  test('όταν λείπει η δημοσίευση από την ανάκτηση, διατηρείται η προηγούμενη', () => {
    const chainRes = {
      success: true,
      contract: {
        adam: '25SYMV000000001',
        snapshot: { referenceNumber: '25SYMV000000001' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        formFields: {},
      },
      // notice/auction/request λείπουν (μερική ανάκτηση)
    };
    const { form, warnings } = applyAdamChainResult(basePrev, chainRes, { seedAdam: '25SYMV000000001' });
    expect(form.khmdhsNoticeAdam).toBe('24PROC012345678');
    expect(form.khmdhsNoticeSnapshot).toEqual({ referenceNumber: '24PROC012345678' });
    expect(form.khmdhsAwardAdam).toBe('24AWRD011111111');
    expect(form.khmdhsRequestAdam).toBe('24REQ022222222');
    expect(warnings).toEqual(expect.arrayContaining([
      'stagePreserved:notice',
      'stagePreserved:award',
      'stagePreserved:request',
    ]));
  });

  test('όταν λείπει η σύμβαση, διατηρείται η προηγούμενη σύμβαση και το ιστορικό της', () => {
    const prev = {
      ...basePrev,
      khmdhsContractChainHistory: [{ adam: '25SYMV000000001', isRoot: true }],
      khmdhsContractAmendments: [{ adam: '25SYMV000000001' }],
    };
    const chainRes = {
      success: true,
      // contract λείπει
      notice: {
        adam: '24PROC012345678',
        snapshot: { referenceNumber: '24PROC012345678' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
      },
    };
    const { form, warnings } = applyAdamChainResult(prev, chainRes, { seedAdam: '24PROC012345678' });
    expect(form.khmdhsAdam).toBe('25SYMV000000001');
    expect(form.khmdhsContractSnapshot).toEqual({ referenceNumber: '25SYMV000000001' });
    // Το ιστορικό διατηρείται (μπορεί να εμπλουτιστεί με effectiveKind/label — δεν χάνεται).
    expect(form.khmdhsContractChainHistory).toHaveLength(1);
    expect(form.khmdhsContractChainHistory[0].adam).toBe('25SYMV000000001');
    expect(form.khmdhsContractChainHistory[0].isRoot).toBe(true);
    expect(warnings).toContain('stagePreserved:contract');
  });

  test('όταν έρθει πλήρες στάδιο, αντικαθιστά κανονικά (χωρίς preserve warning)', () => {
    const chainRes = {
      success: true,
      contract: {
        adam: '25SYMV000000001',
        snapshot: { referenceNumber: '25SYMV000000001' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        formFields: {},
      },
      notice: {
        adam: '24PROC012345678',
        snapshot: { referenceNumber: '24PROC012345678' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
      },
      auction: {
        adam: '24AWRD011111111',
        snapshot: { referenceNumber: '24AWRD011111111' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
      },
      request: {
        adam: '24REQ022222222',
        snapshot: { referenceNumber: '24REQ022222222' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
      },
    };
    const { warnings } = applyAdamChainResult(basePrev, chainRes, { seedAdam: '25SYMV000000001' });
    expect(warnings.filter((w) => String(w).startsWith('stagePreserved:'))).toHaveLength(0);
  });

  test('πρώτη ανάκτηση (χωρίς προηγούμενα) δεν παράγει preserve warnings', () => {
    const prev = { projectStatus: '', implementationForm: 'Έργο' };
    const chainRes = {
      success: true,
      contract: {
        adam: '25SYMV000000001',
        snapshot: { referenceNumber: '25SYMV000000001' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        formFields: {},
      },
    };
    const { warnings } = applyAdamChainResult(prev, chainRes, { seedAdam: '25SYMV000000001' });
    expect(warnings.filter((w) => String(w).startsWith('stagePreserved:'))).toHaveLength(0);
  });

  test('διαφορετική δημοσίευση με στοιχεία → noticeConflict, διατηρείται η παλιά', () => {
    const chainRes = {
      success: true,
      contract: {
        adam: '25SYMV000000001',
        snapshot: { referenceNumber: '25SYMV000000001' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        formFields: {},
      },
      notice: {
        adam: '24PROC999999999',
        snapshot: { referenceNumber: '24PROC999999999', mappedAssignmentProcedure: 'Άλλη διαδικασία' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        mappedAssignmentProcedure: 'Άλλη διαδικασία',
      },
    };
    const { form, warnings } = applyAdamChainResult(basePrev, chainRes, { seedAdam: '25SYMV000000001' });
    expect(warnings).toContain('noticeConflict');
    expect(form.khmdhsNoticeAdam).toBe('24PROC012345678');
    expect(form.khmdhsNoticeSnapshot).toEqual({ referenceNumber: '24PROC012345678' });
    expect(form.khmdhsAdamChainMeta?.linkedAdams?.notices).toEqual(
      expect.arrayContaining(['24PROC999999999'])
    );
    expect(form.khmdhsAdamChainMeta?.noticeSnapshotsByAdam?.['24PROC999999999']?.referenceNumber)
      .toBe('24PROC999999999');
  });

  test('μερική αντικατάσταση ενώνει τις προηγούμενες προσκλήσεις στο meta αντί να τις σβήσει', () => {
    const prev = {
      ...basePrev,
      khmdhsAdamChainMeta: {
        linkedAdams: { notices: ['24PROC012345678', '25PROC000000002'] },
        noticeSnapshotsByAdam: {
          '25PROC000000002': { referenceNumber: '25PROC000000002', title: 'Πρόσκληση 2' },
        },
      },
    };
    const chainRes = {
      success: true,
      contract: {
        adam: '25SYMV000000001',
        snapshot: { referenceNumber: '25SYMV000000001' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        formFields: {},
      },
      notice: {
        adam: '24PROC999999999',
        snapshot: { referenceNumber: '24PROC999999999', title: 'Νέα διακήρυξη' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
      },
    };
    const { form } = applyAdamChainResult(prev, chainRes, { seedAdam: '25SYMV000000001' });
    expect(form.khmdhsNoticeAdam).toBe('24PROC012345678');
    expect(form.khmdhsAdamChainMeta?.linkedAdams?.notices).toEqual(
      expect.arrayContaining(['24PROC012345678', '25PROC000000002', '24PROC999999999'])
    );
    expect(form.khmdhsAdamChainMeta?.noticeSnapshotsByAdam?.['25PROC000000002']?.title)
      .toBe('Πρόσκληση 2');
  });
});

describe('applyAdamChainResult — πολλαπλές συμβάσεις: προστασία γραμμής χωρίς snapshot (#1)', () => {
  const row1 = {
    khmdhsAdam: '25SYMV000000001',
    khmdhsContractSnapshot: { referenceNumber: '25SYMV000000001', title: 'Σύμβαση Α' },
    khmdhsContractFetchedAt: '2026-01-01T00:00:00.000Z',
    khmdhsContractRoleLabel: 'Αρχική σύμβαση',
    amount: '100.000,00',
    date: '2025-01-15',
    contractEndDate: '2026-01-15',
    khmdhsContractChainHistory: [{ adam: '25SYMV000000001', isRoot: true }],
    khmdhsContractAmendments: [{ adam: '25SYMV000000001' }],
  };
  const row2 = {
    khmdhsAdam: '25SYMV000000002',
    khmdhsContractSnapshot: { referenceNumber: '25SYMV000000002', title: 'Σύμβαση Β' },
    amount: '50.000,00',
    date: '2025-06-01',
    khmdhsContractChainHistory: [{ adam: '25SYMV000000002', isRoot: true }],
  };

  const baseMulti = {
    projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
    implementationForm: 'Πολλές Συμβάσεις',
    contracts: [row1, row2],
  };

  test('σύμβαση χωρίς στοιχεία δεν μηδενίζει υπάρχουσα γραμμή', () => {
    const chainRes = {
      success: true,
      contract: {
        adam: '25SYMV000000001',
        snapshot: null,
        fetchedAt: '2026-07-01T00:00:00.000Z',
        formFields: { contractAmount: '999.999,00', contractDate: '2099-01-01' },
      },
    };
    const { form, warnings, statusAutoUpdated } = applyAdamChainResult(baseMulti, chainRes, {
      seedAdam: '25SYMV000000001',
      contractIndex: 0,
    });
    expect(form.contracts[0].khmdhsContractSnapshot).toEqual(row1.khmdhsContractSnapshot);
    expect(form.contracts[0].amount).toBe('100.000,00');
    expect(form.contracts[0].date).toBe('2025-01-15');
    expect(form.contracts[0].contractEndDate).toBe('2026-01-15');
    expect(form.contracts[0].khmdhsContractRoleLabel).toBe('Αρχική σύμβαση');
    // Το ιστορικό διατηρείται (μπορεί να εμπλουτιστεί με effectiveKind/label — δεν χάνεται).
    expect(form.contracts[0].khmdhsContractChainHistory).toHaveLength(1);
    expect(form.contracts[0].khmdhsContractChainHistory[0].adam).toBe('25SYMV000000001');
    expect(form.contracts[0].khmdhsContractChainHistory[0].isRoot).toBe(true);
    expect(form.contracts[0].khmdhsContractAmendments).toEqual(row1.khmdhsContractAmendments);
    expect(warnings).toContain('stagePreserved:contract');
    // Χωρίς πραγματικά στοιχεία δεν αλλάζει αυτόματα η κατάσταση έργου
    expect(statusAutoUpdated).toBeFalsy();
  });

  test('η δεύτερη γραμμή δεν αγγίζεται όταν ανανεώνεται η πρώτη χωρίς snapshot', () => {
    const chainRes = {
      success: true,
      contract: { adam: '25SYMV000000001', snapshot: null, formFields: {} },
    };
    const { form } = applyAdamChainResult(baseMulti, chainRes, {
      seedAdam: '25SYMV000000001',
      contractIndex: 0,
    });
    expect(form.contracts[1]).toMatchObject({
      khmdhsAdam: '25SYMV000000002',
      amount: '50.000,00',
      date: '2025-06-01',
    });
    expect(form.contracts[1].khmdhsContractSnapshot).toEqual(row2.khmdhsContractSnapshot);
  });

  test('πλήρες snapshot ενημερώνει κανονικά τη γραμμή (χωρίς stagePreserved)', () => {
    const chainRes = {
      success: true,
      contract: {
        adam: '25SYMV000000001',
        snapshot: { referenceNumber: '25SYMV000000001', title: 'Σύμβαση Α ενημερωμένη' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        formFields: { contractAmount: '120.000,00', contractDate: '2025-02-01' },
        roleLabel: 'Αρχική σύμβαση',
      },
    };
    const { form, warnings } = applyAdamChainResult(baseMulti, chainRes, {
      seedAdam: '25SYMV000000001',
      contractIndex: 0,
    });
    expect(form.contracts[0].khmdhsContractSnapshot.title).toBe('Σύμβαση Α ενημερωμένη');
    expect(form.contracts[0].amount).toBe('120.000,00');
    expect(form.contracts[0].date).toBe('2025-02-01');
    expect(warnings).not.toContain('stagePreserved:contract');
  });

  test('κενή γραμμή: καταγράφεται μόνο ΑΔΑΜ, χωρίς ψεύτικο snapshot', () => {
    const prev = {
      ...baseMulti,
      contracts: [{ date: '', amount: '', apeAmount: '', comments: '' }],
    };
    const chainRes = {
      success: true,
      contract: {
        adam: '25SYMV000000099',
        snapshot: null,
        roleLabel: 'Υποψήφια',
        formFields: {},
      },
    };
    const { form, warnings } = applyAdamChainResult(prev, chainRes, {
      seedAdam: '25SYMV000000099',
      contractIndex: 0,
    });
    expect(form.contracts[0].khmdhsAdam).toBe('25SYMV000000099');
    expect(form.contracts[0].khmdhsContractSnapshot == null).toBe(true);
    expect(warnings).not.toContain('stagePreserved:contract');
  });

  test('αναφορά: stagePreserved:contract είναι ανεπιβεβαίωση, όχι ενέργεια', () => {
    const report = buildKhmdhsRefreshChangeReport({}, {}, {
      warnings: ['stagePreserved:contract'],
    });
    expect(report.category).toBe('unchanged');
    expect(report.incompleteLines.some((l) => l.includes('σύμβαση') && l.includes('διατηρήθηκε'))).toBe(true);
    expect(report.attentionLines).toHaveLength(0);
  });
});

describe('applyAdamChainResult — πολλαπλές συμβάσεις: κοινά στάδια χωρίς snapshot', () => {
  const row1 = {
    khmdhsAdam: '25SYMV000000001',
    khmdhsContractSnapshot: { referenceNumber: '25SYMV000000001', title: 'Σύμβαση Α' },
    amount: '100.000,00',
    date: '2025-01-15',
  };
  const row2 = {
    khmdhsAdam: '25SYMV000000002',
    khmdhsContractSnapshot: { referenceNumber: '25SYMV000000002', title: 'Σύμβαση Β' },
    amount: '50.000,00',
    date: '2025-06-01',
  };
  const baseMultiShared = {
    projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
    implementationForm: 'Πολλές Συμβάσεις',
    contracts: [row1, row2],
    khmdhsNoticeAdam: '24PROC012345678',
    khmdhsNoticeSnapshot: { referenceNumber: '24PROC012345678', title: 'Διακήρυξη' },
    khmdhsNoticeFetchedAt: '2026-01-01T00:00:00.000Z',
    assignmentProcedure: 'Ανοικτός διαγωνισμός',
    khmdhsAwardAdam: '24AWRD011111111',
    khmdhsAwardSnapshot: { referenceNumber: '24AWRD011111111', title: 'Ανάθεση' },
    khmdhsAwardFetchedAt: '2026-01-01T00:00:00.000Z',
    khmdhsRequestAdam: '24REQ022222222',
    khmdhsRequestSnapshot: { referenceNumber: '24REQ022222222', title: 'Αίτημα' },
    khmdhsRequestFetchedAt: '2026-01-01T00:00:00.000Z',
  };

  test('μερική ανάκτηση (ADAM χωρίς snapshot) διατηρεί δημοσίευση/ανάθεση/αίτημα + warnings', () => {
    const chainRes = {
      success: true,
      contract: {
        adam: '25SYMV000000001',
        snapshot: { referenceNumber: '25SYMV000000001', title: 'Σύμβαση Α' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        formFields: {},
      },
      notice: { adam: '24PROC012345678', snapshot: null, error: 'πολλά αιτήματα' },
      auction: { adam: '24AWRD011111111', snapshot: null, error: 'πολλά αιτήματα' },
      request: { adam: '24REQ022222222', snapshot: null, error: 'πολλά αιτήματα' },
    };
    const { form, warnings } = applyAdamChainResult(baseMultiShared, chainRes, {
      seedAdam: '25SYMV000000001',
      contractIndex: 0,
    });
    expect(form.khmdhsNoticeAdam).toBe('24PROC012345678');
    expect(form.khmdhsNoticeSnapshot).toEqual(baseMultiShared.khmdhsNoticeSnapshot);
    expect(form.assignmentProcedure).toBe('Ανοικτός διαγωνισμός');
    expect(form.khmdhsAwardAdam).toBe('24AWRD011111111');
    expect(form.khmdhsAwardSnapshot).toEqual(baseMultiShared.khmdhsAwardSnapshot);
    expect(form.khmdhsRequestAdam).toBe('24REQ022222222');
    expect(form.khmdhsRequestSnapshot).toEqual(baseMultiShared.khmdhsRequestSnapshot);
    expect(warnings).toEqual(expect.arrayContaining([
      'stagePreserved:notice',
      'stagePreserved:award',
      'stagePreserved:request',
    ]));
  });

  test('πλήρες snapshot ενημερώνει κοινά στάδια χωρίς stagePreserved', () => {
    const chainRes = {
      success: true,
      contract: {
        adam: '25SYMV000000001',
        snapshot: { referenceNumber: '25SYMV000000001', title: 'Σύμβαση Α' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        formFields: {},
      },
      notice: {
        adam: '24PROC012345678',
        snapshot: { referenceNumber: '24PROC012345678', title: 'Διακήρυξη νέα' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        mappedAssignmentProcedure: 'Ανοικτός διαγωνισμός',
      },
      auction: {
        adam: '24AWRD011111111',
        snapshot: { referenceNumber: '24AWRD011111111', title: 'Ανάθεση νέα' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
      },
      request: {
        adam: '24REQ022222222',
        snapshot: { referenceNumber: '24REQ022222222', title: 'Αίτημα νέο' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
      },
    };
    const { form, warnings } = applyAdamChainResult(baseMultiShared, chainRes, {
      seedAdam: '25SYMV000000001',
      contractIndex: 0,
    });
    expect(form.khmdhsNoticeSnapshot.title).toBe('Διακήρυξη νέα');
    expect(form.khmdhsAwardSnapshot.title).toBe('Ανάθεση νέα');
    expect(form.khmdhsRequestSnapshot.title).toBe('Αίτημα νέο');
    expect(warnings.filter((w) => String(w).startsWith('stagePreserved:'))).toHaveLength(0);
  });

  test('αναφορά: stagePreserved notice/award/request είναι ανεπιβεβαίωση', () => {
    const report = buildKhmdhsRefreshChangeReport({}, {}, {
      warnings: ['stagePreserved:notice', 'stagePreserved:award', 'stagePreserved:request'],
    });
    expect(report.category).toBe('unchanged');
    expect(report.incompleteLines.some((l) => l.includes('δημοσίευση') && l.includes('διατηρήθηκε'))).toBe(true);
    expect(report.incompleteLines.some((l) => l.includes('ανάθεσης') && l.includes('διατηρήθηκε'))).toBe(true);
    expect(report.incompleteLines.some((l) => l.includes('αίτημα') && l.includes('διατηρήθηκε'))).toBe(true);
  });
});

describe('applyAdamChainResult commitments merge', () => {
  test('μετά ανανέωση δεν χάνει απόφαση ανάληψης που έλειπε από το νέο fetch', () => {
    const prev = {
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      implementationForm: 'Έργο',
      khmdhsCommitmentDecisions: [
        {
          adam: '25REQ016195275',
          snapshot: { referenceNumber: '25REQ016195275', title: 'Απόφαση 1', signedDate: '2025-03-01' },
        },
        {
          adam: '25REQ016195999',
          snapshot: null,
          error: 'πολλά αιτήματα',
        },
      ],
      khmdhsCommitmentAdam: '25REQ016195275',
      khmdhsCommitmentSnapshot: {
        referenceNumber: '25REQ016195275',
        title: 'Απόφαση 1',
        signedDate: '2025-03-01',
      },
    };
    const chainRes = {
      success: true,
      commitmentDecisions: [
        {
          adam: '25REQ016195275',
          snapshot: { referenceNumber: '25REQ016195275', title: 'Απόφαση 1', signedDate: '2025-03-01' },
          fetchedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
      contract: {
        adam: '25SYMV000000001',
        snapshot: { referenceNumber: '25SYMV000000001' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        formFields: {},
      },
    };

    const { form } = applyAdamChainResult(prev, chainRes, { seedAdam: '25SYMV000000001' });

    expect(form.khmdhsCommitmentDecisions).toHaveLength(2);
    expect(form.khmdhsCommitmentDecisions.map((d) => d.adam).sort()).toEqual([
      '25REQ016195275',
      '25REQ016195999',
    ]);
  });

  test('αφαιρεί επιβεβαιωμένα ακυρωμένη ανάληψη και καθαρίζει την κύρια αν μείνει κενή', () => {
    const prev = {
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      implementationForm: 'Έργο',
      khmdhsCommitmentDecisions: [
        {
          adam: '25REQ016195999',
          snapshot: { referenceNumber: '25REQ016195999', title: 'Ακυρωμένη', signedDate: '2025-04-01' },
        },
      ],
      khmdhsCommitmentAdam: '25REQ016195999',
      khmdhsCommitmentSnapshot: {
        referenceNumber: '25REQ016195999',
        title: 'Ακυρωμένη',
        signedDate: '2025-04-01',
      },
      khmdhsCommitmentFetchedAt: '2026-01-01T00:00:00.000Z',
    };
    const chainRes = {
      success: true,
      commitmentDecisions: [],
      chainMeta: {
        confirmedCancelledAdams: ['25REQ016195999'],
      },
      contract: {
        adam: '25SYMV000000001',
        snapshot: { referenceNumber: '25SYMV000000001' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        formFields: {},
      },
    };

    const { form } = applyAdamChainResult(prev, chainRes, { seedAdam: '25SYMV000000001' });

    expect(form.khmdhsCommitmentDecisions).toEqual([]);
    expect(form.khmdhsCommitmentAdam).toBe('');
    expect(form.khmdhsCommitmentSnapshot).toBeNull();
    expect(form.khmdhsCommitmentFetchedAt).toBe('');
  });

  test('αφαιρεί μόνο την ακυρωμένη ανάληψη και κρατά την άλλη ως κύρια', () => {
    const prev = {
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      implementationForm: 'Έργο',
      khmdhsCommitmentDecisions: [
        {
          adam: '25REQ016195275',
          snapshot: { referenceNumber: '25REQ016195275', title: 'Ζωντανή', signedDate: '2025-03-01' },
        },
        {
          adam: '25REQ016195999',
          snapshot: { referenceNumber: '25REQ016195999', title: 'Ακυρωμένη', signedDate: '2025-04-01' },
        },
      ],
      khmdhsCommitmentAdam: '25REQ016195999',
      khmdhsCommitmentSnapshot: {
        referenceNumber: '25REQ016195999',
        title: 'Ακυρωμένη',
        signedDate: '2025-04-01',
      },
    };
    const chainRes = {
      success: true,
      commitmentDecisions: [
        {
          adam: '25REQ016195275',
          snapshot: { referenceNumber: '25REQ016195275', title: 'Ζωντανή', signedDate: '2025-03-01' },
          fetchedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
      chainMeta: {
        confirmedCancelledAdams: ['25REQ016195999'],
      },
      contract: {
        adam: '25SYMV000000001',
        snapshot: { referenceNumber: '25SYMV000000001' },
        fetchedAt: '2026-07-01T00:00:00.000Z',
        formFields: {},
      },
    };

    const { form } = applyAdamChainResult(prev, chainRes, { seedAdam: '25SYMV000000001' });

    expect(form.khmdhsCommitmentDecisions).toHaveLength(1);
    expect(form.khmdhsCommitmentDecisions[0].adam).toBe('25REQ016195275');
    expect(form.khmdhsCommitmentAdam).toBe('25REQ016195275');
    expect(form.khmdhsCommitmentSnapshot.title).toBe('Ζωντανή');
  });
});

describe('applyAdamChainResult SYMV reuse after refresh', () => {
  test('με auto-skip νέο έγγραφο και σχέδιο κατανομής δεν ζητά ξανά χαρακτηρισμό', () => {
    const existingPlan = {
      items: [
        { adam: '22SYMV011799800', role: SYMV_CHAIN_ROLE.MAIN, date: '2022-06-01', amount: '100' },
        { adam: '22SYMV011327633', role: SYMV_CHAIN_ROLE.SKIP },
      ],
    };
    const prev = {
      implementationForm: 'Έργο',
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      khmdhsAdam: '22SYMV011799800',
      khmdhsSymvChainPlan: existingPlan,
    };
    const chainRes = {
      success: true,
      contract: {
        adam: '22SYMV011799800',
        snapshot: { referenceNumber: '22SYMV011799800', title: 'ΚΥΡΙΑ' },
        formFields: {},
      },
      contractChainHistory: [
        { adam: '22SYMV011799800', isRoot: true, label: 'Αρχική σύμβαση' },
        { adam: '22SYMV011327633', label: 'Σύμβαση 2' },
        { adam: '25SYMV088888888', label: 'Ορθή επανάληψη' },
      ],
      chainMeta: {
        contractRootAdam: '22SYMV011799800',
        contractSnapshotsByAdam: {
          '22SYMV011799800': { title: 'ΚΥΡΙΑ', referenceNumber: '22SYMV011799800' },
          '22SYMV011327633': { title: 'ΑΛΛΟ ΕΓΓΡΑΦΟ', referenceNumber: '22SYMV011327633' },
          '25SYMV088888888': {
            title: 'ΟΡΘΗ ΕΠΑΝΑΛΗΨΗ ΑΠΟΦΑΣΗΣ',
            referenceNumber: '25SYMV088888888',
          },
        },
        parallelContractCandidates: [
          '22SYMV011799800',
          '22SYMV011327633',
          '25SYMV088888888',
        ],
      },
    };

    const reusable = resolveReusablePlanForKhmdhsRefresh(existingPlan, { chainRes });
    expect(reusable).not.toBeNull();

    const result = applyAdamChainResult(prev, chainRes, {
      seedAdam: '22SYMV011799800',
      applyMode: 'stitch',
      symvChainPlan: reusable,
    });

    expect(result.warnings).not.toContain('symvPlannerRequired');
    expect(result.form.khmdhsAdam).toBe('22SYMV011799800');
    expect(result.form.khmdhsSymvChainPlan.items.find((i) => i.adam === '22SYMV011327633')?.role)
      .toBe(SYMV_CHAIN_ROLE.SKIP);
    expect(result.form.khmdhsSymvChainPlan.items.find((i) => i.adam === '25SYMV088888888')?.role)
      .toBe(SYMV_CHAIN_ROLE.SKIP);
  });
});

describe('mergeKhmdhsChainMetaForStitch cancelled commitments', () => {
  test('δεν ξαναβάζει ακυρωμένη ανάληψη στο allBudgetCommitments ούτε στα linked', () => {
    const cancelled = '25REQ016195999';
    const live = '25REQ016195275';
    const merged = mergeKhmdhsChainMetaForStitch(
      {
        allBudgetCommitments: [
          { adam: live, snapshot: { title: 'Ζωντανή' } },
          { adam: cancelled, snapshot: { title: 'Ακυρωμένη' } },
        ],
        linkedAdams: {
          budgetCommitments: [live, cancelled],
          payments: ['26PAY000000001', '26PAY000000002'],
        },
        confirmedCancelledAdams: [],
      },
      {
        allBudgetCommitments: [],
        linkedAdams: { budgetCommitments: [], payments: [] },
        confirmedCancelledAdams: [cancelled, '26PAY000000002'],
      },
      {
        khmdhsCommitmentDecisions: [{ adam: live }],
        khmdhsCommitmentAdam: live,
        khmdhsPayments: [{ adam: '26PAY000000001' }],
      }
    );

    expect(merged.allBudgetCommitments.map((d) => d.adam)).toEqual([live]);
    expect(merged.linkedAdams.budgetCommitments).toEqual([live]);
    expect(merged.linkedAdams.payments).toEqual(['26PAY000000001']);
    expect(merged.confirmedCancelledAdams).toEqual(
      expect.arrayContaining([cancelled, '26PAY000000002'])
    );
  });
});

describe('applyAdamChainResult stitch + κατανομή SYMV', () => {
  test('Keep + σχέδιο δεν σβήνει την υπάρχουσα σύμβαση του άλλου πρωτογενούς', () => {
    const prev = {
      implementationForm: 'Μια Σύμβαση',
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      khmdhsRequestAdam: '25REQ016832258',
      khmdhsRequestSnapshot: { referenceNumber: '25REQ016832258' },
      khmdhsAdam: '25SYMV016948065',
      khmdhsContractSnapshot: { referenceNumber: '25SYMV016948065' },
      khmdhsChainSeedAdam: '25REQ016832258',
      contractAmount: '18600',
      contractDate: '2025-06-01',
    };
    const chainRes = {
      success: true,
      request: {
        adam: '24REQ015252599',
        snapshot: { referenceNumber: '24REQ015252599' },
        fetchedAt: '2026-08-01T00:00:00.000Z',
      },
      contract: {
        adam: '24SYMV015890933',
        snapshot: { referenceNumber: '24SYMV015890933' },
        formFields: { contractAmount: '10000', contractDate: '2025-01-15' },
      },
      chainMeta: {
        contractSnapshotsByAdam: {
          '24SYMV015890933': { referenceNumber: '24SYMV015890933' },
          '25SYMV016155296': { referenceNumber: '25SYMV016155296' },
        },
      },
    };
    const plan = {
      items: [
        { adam: '24SYMV015890933', role: SYMV_CHAIN_ROLE.MAIN, date: '2025-01-15', amount: '10000' },
        { adam: '25SYMV016155296', role: SYMV_CHAIN_ROLE.PARALLEL, date: '2025-02-15', amount: '2313,20' },
      ],
    };

    const { form, stitchFilledStages } = applyAdamChainResult(prev, chainRes, {
      seedAdam: '24REQ015252599',
      applyMode: 'stitch',
      symvChainPlan: plan,
    });

    const adams = (form.contracts || []).map((c) => c.khmdhsAdam);
    expect(adams).toEqual(expect.arrayContaining([
      '25SYMV016948065',
      '24SYMV015890933',
      '25SYMV016155296',
    ]));
    expect(adams).toHaveLength(3);
    expect(form.khmdhsRequestAdam).toBe('25REQ016832258');
    expect(form.implementationForm).toBe('Πολλές Συμβάσεις');
    expect(stitchFilledStages).toContain('SYMV');
  });

  test('συρραφή χωρίς σχέδιο προσθέτει διαφορετική σύμβαση ως νέα γραμμή', () => {
    const prev = {
      implementationForm: 'Μια Σύμβαση',
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      khmdhsRequestAdam: '24REQ015252599',
      khmdhsAdam: '24SYMV015890933',
      khmdhsContractSnapshot: { referenceNumber: '24SYMV015890933' },
      khmdhsChainSeedAdam: '24REQ015252599',
      contracts: [],
    };
    const chainRes = {
      success: true,
      request: {
        adam: '25REQ016832258',
        snapshot: { referenceNumber: '25REQ016832258' },
      },
      contract: {
        adam: '25SYMV016948065',
        snapshot: { referenceNumber: '25SYMV016948065' },
        fetchedAt: '2026-08-01T00:00:00.000Z',
        formFields: { contractAmount: '18600', contractDate: '2025-06-01' },
      },
    };

    const { form } = applyAdamChainResult(prev, chainRes, {
      seedAdam: '25REQ016832258',
      applyMode: 'stitch',
    });

    expect(form.implementationForm).toBe('Πολλές Συμβάσεις');
    expect(form.contracts.map((c) => c.khmdhsAdam)).toEqual([
      '24SYMV015890933',
      '25SYMV016948065',
    ]);
    expect(form.khmdhsRequestAdam).toBe('24REQ015252599');
  });

  test('ανανέωση με νέα κατανομή συρράφει — δεν αντικαθιστά την κάρτα από την αρχή', () => {
    const project = {
      implementationForm: 'Πολλές Συμβάσεις',
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      khmdhsRequestAdam: '25REQ016832258',
      khmdhsRequestSnapshot: { referenceNumber: '25REQ016832258' },
      khmdhsChainSeedAdam: '25REQ016832258',
      contracts: [
        {
          khmdhsAdam: '25SYMV016948065',
          khmdhsContractSnapshot: { referenceNumber: '25SYMV016948065' },
          amount: '18600',
        },
        {
          khmdhsAdam: '24SYMV015890933',
          khmdhsContractSnapshot: { referenceNumber: '24SYMV015890933' },
          amount: '10000',
        },
      ],
    };
    const plan = {
      items: [
        { adam: '24SYMV015890933', role: SYMV_CHAIN_ROLE.MAIN, date: '2025-01-15', amount: '10000' },
        { adam: '25SYMV016155296', role: SYMV_CHAIN_ROLE.SKIP },
      ],
    };
    const chain24 = {
      success: true,
      request: {
        adam: '24REQ015252599',
        snapshot: { referenceNumber: '24REQ015252599' },
      },
      contract: {
        adam: '24SYMV015890933',
        snapshot: { referenceNumber: '24SYMV015890933' },
        formFields: { contractAmount: '10000', contractDate: '2025-01-15' },
      },
      chainMeta: {
        contractSnapshotsByAdam: {
          '24SYMV015890933': { referenceNumber: '24SYMV015890933' },
        },
      },
    };

    const replaced = applyAdamChainResult(project, chain24, {
      seedAdam: '24REQ015252599',
      symvChainPlan: plan,
    });
    expect(replaced.form.khmdhsRequestAdam).toBe('24REQ015252599');
    expect((replaced.form.contracts || []).map((c) => c.khmdhsAdam)).not.toContain('25SYMV016948065');

    const stitched = applyStitchRefreshResults(project, [
      {
        success: true,
        seedAdam: '25REQ016832258',
        chainRes: {
          success: true,
          request: {
            adam: '25REQ016832258',
            snapshot: { referenceNumber: '25REQ016832258' },
          },
          contract: {
            adam: '25SYMV016948065',
            snapshot: { referenceNumber: '25SYMV016948065' },
            formFields: { contractAmount: '18600' },
          },
        },
      },
      {
        success: true,
        seedAdam: '24REQ015252599',
        chainRes: chain24,
      },
    ], {
      fallbackChainRes: chain24,
      fallbackSeedAdam: '24REQ015252599',
      symvChainPlan: plan,
    });
    expect(stitched.form.khmdhsRequestAdam).toBe('25REQ016832258');
    expect(stitched.form.contracts.map((c) => c.khmdhsAdam)).toEqual(
      expect.arrayContaining(['25SYMV016948065', '24SYMV015890933'])
    );
  });
});

describe('applyChainCharacterizationToForm with SYMV plan', () => {
  test('ενημερώνει ετικέτες κρίκων χωρίς να ξαναϋπολογίζει ποσά κατανομής', () => {
    const form = {
      implementationForm: 'Πολλές Συμβάσεις',
      khmdhsSymvChainPlan: {
        items: [{ adam: '24SYMV015890933', role: SYMV_CHAIN_ROLE.MAIN, amount: '10.000,00' }],
      },
      contracts: [{
        amount: '10.000,00',
        khmdhsAdam: '24SYMV015890933',
        khmdhsContractChainHistory: [
          { adam: '24SYMV015890933', isRoot: true, order: 0, contractAmount: '10.000,00' },
          {
            adam: '25SYMV016155296',
            isRoot: false,
            order: 1,
            contractAmount: '2.313,00',
            label: 'Ενδιάμεσος κρίκος',
            kind: 'uncertain',
          },
        ],
      }],
    };
    const review = {
      resolutions: {
        'chainKindReview::25SYMV016155296': { value: 'extension' },
      },
    };
    const next = applyChainCharacterizationToForm(form, review, { fullRecompute: true });
    expect(next.contracts[0].amount).toBe('10.000,00');
    expect(next.contracts[0].khmdhsContractChainHistory[1].label).toBe('Παράταση');
    expect(next.contracts[0].khmdhsContractChainHistory[1].effectiveKind).toBe('extension');
  });
});

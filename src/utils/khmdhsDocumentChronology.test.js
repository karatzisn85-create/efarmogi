/**
 * @jest-environment node
 */
import {
  compareKhmdhsDocumentsByDateAsc,
  khmdhsDocumentTimestamp,
  resolveKhmdhsDocumentDateValue,
  sortKhmdhsDocumentsByDateAsc,
} from './khmdhsDocumentChronology';
import {
  collectKhmdhsCommitmentDecisions,
  getKhmdhsPaymentEntries,
  pickLatestKhmdhsCommitmentDecision,
} from './khmdhsChainExtraFields';
import { buildKhmdhsLifecycleRailColumns } from './khmdhsLifecycleRailGraph';
import { sortRegistryEntries } from './khmdhsDocumentRegistry';

describe('khmdhsDocumentChronology', () => {
  test('προτιμά signedDate έναντι submissionDate', () => {
    const item = {
      adam: '21REQ001',
      snapshot: {
        signedDate: '2021-06-15',
        submissionDate: '2021-01-01T00:00:00.000Z',
      },
    };
    expect(resolveKhmdhsDocumentDateValue(item)).toBe('2021-06-15');
    expect(khmdhsDocumentTimestamp(item)).toBe(new Date(2021, 5, 15).getTime());
  });

  test('χωρίς ημερομηνία εγγράφου χρησιμοποιεί fetchedAt', () => {
    const item = {
      adam: '21REQ001',
      snapshot: { referenceNumber: '21REQ001' },
      fetchedAt: '2024-03-01T12:00:00.000Z',
    };
    expect(resolveKhmdhsDocumentDateValue(item)).toBe('2024-03-01T12:00:00.000Z');
    expect(khmdhsDocumentTimestamp(item)).toBeTruthy();
  });

  test('ascending: παλαιότερο πρώτο, χωρίς ημερομηνία στο τέλος, ισοπαλία κατά ADAM', () => {
    const items = [
      { adam: '22REQB', snapshot: { signedDate: '2022-01-01' } },
      { adam: '20REQA', snapshot: { signedDate: '2020-01-01' } },
      { adam: '99REQZ', snapshot: { title: 'χωρίς ημερομηνία' } },
      { adam: '21REQM', snapshot: { signedDate: '2021-06-01' } },
      { adam: '99REQA', snapshot: { title: 'επίσης χωρίς' } },
    ];
    const sorted = sortKhmdhsDocumentsByDateAsc(items).map((i) => i.adam);
    expect(sorted).toEqual(['20REQA', '21REQM', '22REQB', '99REQA', '99REQZ']);
  });

  test('συγκρίνει ημερομηνίες registry σε μορφή DD/MM/YYYY', () => {
    const a = { adam: '24PAYB', date: '15/03/2024', stage: 'PAY' };
    const b = { adam: '22PAYA', date: '01/01/2022', stage: 'PAY' };
    expect(compareKhmdhsDocumentsByDateAsc(a, b)).toBeGreaterThan(0);
    expect(compareKhmdhsDocumentsByDateAsc(b, a)).toBeLessThan(0);
  });
});

describe('collectKhmdhsCommitmentDecisions / getKhmdhsPaymentEntries chronology', () => {
  test('αναλήψεις επιστρέφονται παλαιότερο → νεότερο ανεξάρτητα από σειρά αποθήκευσης', () => {
    const project = {
      khmdhsCommitmentDecisions: [
        {
          adam: '21REQ016000002',
          snapshot: { referenceNumber: '21REQ016000002', signedDate: '2021-05-01' },
        },
        {
          adam: '20REQ016000001',
          snapshot: { referenceNumber: '20REQ016000001', signedDate: '2020-03-01' },
        },
        {
          adam: '22REQ016000003',
          snapshot: { referenceNumber: '22REQ016000003', signedDate: '2022-01-15' },
        },
      ],
    };
    const adams = collectKhmdhsCommitmentDecisions(project).map((d) => d.adam);
    expect(adams).toEqual(['20REQ016000001', '21REQ016000002', '22REQ016000003']);
  });

  test('pickLatest επιλέγει τη νεότερη χρονολογικά, όχι την τελευταία της ascending λίστας όταν υπάρχει undated', () => {
    const project = {
      khmdhsCommitmentDecisions: [
        {
          adam: '22REQNEW',
          snapshot: { referenceNumber: '22REQNEW', signedDate: '2022-01-01' },
        },
        {
          adam: '20REQOLD',
          snapshot: { referenceNumber: '20REQOLD', signedDate: '2020-01-01' },
        },
        {
          adam: '99REQNONE',
          snapshot: { referenceNumber: '99REQNONE', title: 'χωρίς ημερομηνία' },
        },
      ],
    };
    expect(pickLatestKhmdhsCommitmentDecision(project).adam).toBe('22REQNEW');
  });

  test('εντάλματα επιστρέφονται παλαιότερο → νεότερο', () => {
    const project = {
      khmdhsPayments: [
        {
          adam: '24PAY003',
          snapshot: { referenceNumber: '24PAY003', signedDate: '2024-06-01' },
        },
        {
          adam: '22PAY001',
          snapshot: { referenceNumber: '22PAY001', signedDate: '2022-01-10' },
        },
        {
          adam: '23PAY002',
          snapshot: { referenceNumber: '23PAY002', issueDate: '2023-03-01' },
        },
      ],
    };
    const adams = getKhmdhsPaymentEntries(project).map((p) => p.adam);
    expect(adams).toEqual(['22PAY001', '23PAY002', '24PAY003']);
  });

  test('δεν εμφανίζει ανάληψη που το ΚΗΜΔΗΣ έχει επιβεβαιώσει ως ακυρωμένη, ακόμα κι αν μείνει στο chainMeta', () => {
    const project = {
      khmdhsCommitmentDecisions: [
        {
          adam: '25REQ016195275',
          snapshot: { referenceNumber: '25REQ016195275', signedDate: '2025-03-01' },
        },
      ],
      khmdhsAdamChainMeta: {
        confirmedCancelledAdams: ['25REQ016195999'],
        allBudgetCommitments: [
          {
            adam: '25REQ016195275',
            snapshot: { referenceNumber: '25REQ016195275', signedDate: '2025-03-01' },
          },
          {
            adam: '25REQ016195999',
            snapshot: { referenceNumber: '25REQ016195999', signedDate: '2025-04-01', title: 'Ακυρωμένη' },
          },
        ],
      },
    };
    expect(collectKhmdhsCommitmentDecisions(project).map((d) => d.adam)).toEqual([
      '25REQ016195275',
    ]);
  });

  test('δεν εμφανίζει ανάληψη με snapshot.cancelled', () => {
    const project = {
      khmdhsCommitmentDecisions: [
        {
          adam: '25REQ016195275',
          snapshot: { referenceNumber: '25REQ016195275', cancelled: true },
        },
      ],
    };
    expect(collectKhmdhsCommitmentDecisions(project)).toEqual([]);
  });
});

describe('lifecycle rail chronological labels', () => {
  test('Ανάλ. 1 / Εντ. 1 αντιστοιχούν στο παλαιότερο ΑΔΑΜ', () => {
    const project = {
      implementationForm: 'Μια Σύμβαση',
      khmdhsCommitmentDecisions: [
        {
          adam: '21REQB',
          snapshot: { referenceNumber: '21REQB', signedDate: '2021-06-01' },
        },
        {
          adam: '20REQA',
          snapshot: { referenceNumber: '20REQA', signedDate: '2020-01-01' },
        },
      ],
      khmdhsAdam: '24SYMV001',
      khmdhsContractSnapshot: { referenceNumber: '24SYMV001' },
      khmdhsPayments: [
        {
          adam: '24PAYB',
          snapshot: { referenceNumber: '24PAYB', signedDate: '2024-08-01' },
        },
        {
          adam: '22PAYA',
          snapshot: { referenceNumber: '22PAYA', signedDate: '2022-02-01' },
        },
      ],
    };

    const columns = buildKhmdhsLifecycleRailColumns(project);
    const commitCols = columns.filter((c) => c.primary.stageId === 'COMMIT');
    expect(commitCols).toHaveLength(2);
    expect(commitCols[0].primary.shortLabel).toBe('Ανάλ. 1');
    expect(commitCols[0].primary.adam).toBe('20REQA');
    expect(commitCols[1].primary.shortLabel).toBe('Ανάλ. 2');
    expect(commitCols[1].primary.adam).toBe('21REQB');

    const payCols = columns.filter((c) => c.primary.stageId === 'PAY');
    expect(payCols).toHaveLength(2);
    expect(payCols[0].primary.shortLabel).toBe('Εντ. 1');
    expect(payCols[0].primary.adam).toBe('22PAYA');
    expect(payCols[1].primary.shortLabel).toBe('Εντ. 2');
    expect(payCols[1].primary.adam).toBe('24PAYB');
  });
});

describe('sortRegistryEntries chronology', () => {
  test('μέσα στο ίδιο stage ταξινομεί κατά ημερομηνία, όχι μόνο κατά ADAM', () => {
    const sorted = sortRegistryEntries([
      { adam: '24PAYZ', stage: 'PAY', date: '01/06/2024' },
      { adam: '22PAYA', stage: 'PAY', date: '15/01/2022' },
      { adam: '23PAYM', stage: 'PAY', date: '10/03/2023' },
      { adam: '21REQ1', stage: 'COMMIT', date: '01/01/2021' },
    ]);
    expect(sorted.map((e) => e.adam)).toEqual([
      '21REQ1',
      '22PAYA',
      '23PAYM',
      '24PAYZ',
    ]);
  });

  test('χωρίς ημερομηνία μέσα στο stage πάει μετά τα χρονολογημένα', () => {
    const sorted = sortRegistryEntries([
      { adam: '24PAYZ', stage: 'PAY', date: '' },
      { adam: '22PAYA', stage: 'PAY', date: '15/01/2022' },
    ]);
    expect(sorted.map((e) => e.adam)).toEqual(['22PAYA', '24PAYZ']);
  });
});

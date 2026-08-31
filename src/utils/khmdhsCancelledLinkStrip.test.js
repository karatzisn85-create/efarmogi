/**
 * @jest-environment node
 */
import {
  stripConfirmedCancelledChainLinks,
  describeCancelledLinkRemoval,
  collectRecordedLinkAdamsByStage,
} from './khmdhsCancelledLinkStrip';

describe('stripConfirmedCancelledChainLinks', () => {
  test('αφαιρεί ακυρωμένη κύρια δημοσίευση και προάγει τη νεότερη ενεργή', () => {
    const form = {
      khmdhsNoticeAdam: '26PROC000000001',
      khmdhsNoticeSnapshot: {
        referenceNumber: '26PROC000000001',
        title: 'Παλιά',
        signedDate: '2026-08-10T00:00:00',
        finalSubmissionDate: '2026-09-07T14:00:00',
      },
      khmdhsAdamChainMeta: {
        linkedAdams: { notices: ['26PROC000000001', '26PROC000000002'] },
        noticeSnapshotsByAdam: {
          '26PROC000000002': {
            referenceNumber: '26PROC000000002',
            title: 'Νέα',
            signedDate: '2026-08-25T00:00:00',
            finalSubmissionDate: '2026-09-14T14:00:00',
            mappedAssignmentProcedure: 'ΑΝΟΙΚΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ',
          },
        },
      },
      khmdhsDocumentRegistry: [
        { adam: '26PROC000000001', title: 'Παλιά' },
        { adam: '26PROC000000002', title: 'Νέα' },
      ],
    };

    const { form: next, promoted } = stripConfirmedCancelledChainLinks(form, ['26PROC000000001']);

    expect(next.khmdhsNoticeAdam).toBe('26PROC000000002');
    expect(next.khmdhsNoticeSnapshot.finalSubmissionDate).toBe('2026-09-14T14:00:00');
    expect(next.assignmentProcedure).toBe('ΑΝΟΙΚΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ');
    expect(next.khmdhsAdamChainMeta.linkedAdams.notices).toEqual(['26PROC000000002']);
    expect(next.khmdhsAdamChainMeta.noticeSnapshotsByAdam['26PROC000000001']).toBeUndefined();
    expect(next.khmdhsDocumentRegistry.map((e) => e.adam)).toEqual(['26PROC000000002']);
    expect(promoted).toEqual([
      { stage: 'notice', fromAdam: '26PROC000000001', toAdam: '26PROC000000002' },
    ]);
  });

  test('χωρίς άλλο ενεργό κρίκο αδειάζει το στάδιο', () => {
    const form = {
      khmdhsAwardAdam: '26AWRD000000001',
      khmdhsAwardSnapshot: { referenceNumber: '26AWRD000000001' },
      khmdhsAwardFetchedAt: '2026-08-01T00:00:00.000Z',
    };
    const { form: next } = stripConfirmedCancelledChainLinks(form, ['26AWRD000000001']);
    expect(next.khmdhsAwardAdam).toBe('');
    expect(next.khmdhsAwardSnapshot).toBeNull();
    expect(next.khmdhsAwardFetchedAt).toBe('');
  });

  test('άδειασμα κύριας (wipe ανανέωσης) προάγει την ενεργή από τον χάρτη', () => {
    const form = {
      khmdhsNoticeAdam: '',
      khmdhsNoticeSnapshot: null,
      khmdhsAdamChainMeta: {
        linkedAdams: { notices: ['26PROC000000002'] },
        noticeSnapshotsByAdam: {
          '26PROC000000002': {
            referenceNumber: '26PROC000000002',
            title: 'Ενεργή επανέκδοση',
            signedDate: '2026-08-25T00:00:00',
            finalSubmissionDate: '2026-09-14T14:00:00',
          },
        },
        confirmedCancelledAdams: ['26PROC000000001'],
      },
    };
    const { form: next } = stripConfirmedCancelledChainLinks(form, ['26PROC000000001']);
    expect(next.khmdhsNoticeAdam).toBe('26PROC000000002');
    expect(next.khmdhsNoticeSnapshot.finalSubmissionDate).toBe('2026-09-14T14:00:00');
  });

  test('δεν προάγει τροποποίηση σύμβασης ως κύρια όταν ακυρώνεται η ρίζα', () => {
    const form = {
      khmdhsAdam: '25SYMV000000001',
      khmdhsContractSnapshot: { referenceNumber: '25SYMV000000001' },
      khmdhsContractChainHistory: [
        { adam: '25SYMV000000001', isRoot: true, snapshot: { referenceNumber: '25SYMV000000001' } },
        { adam: '25SYMV000000099', isRoot: false, snapshot: { referenceNumber: '25SYMV000000099' } },
      ],
    };
    const { form: next } = stripConfirmedCancelledChainLinks(form, ['25SYMV000000001']);
    expect(next.khmdhsAdam).toBe('');
    expect(next.khmdhsContractSnapshot).toBeNull();
  });

  test('παλιά καταγραφή ακύρωσης δεν σβήνει κρίκο που ήρθε ενεργός σε αυτή την ανάκτηση', () => {
    const form = {
      khmdhsNoticeAdam: '26PROC000000001',
      khmdhsNoticeSnapshot: {
        referenceNumber: '26PROC000000001',
        title: 'Ενεργή ξανά',
        noticeType: 'Προκήρυξη',
      },
      khmdhsAdamChainMeta: {
        confirmedCancelledAdams: ['26PROC000000001'],
        linkedAdams: { notices: ['26PROC000000001'] },
      },
    };
    const { form: next } = stripConfirmedCancelledChainLinks(form, []);
    expect(next.khmdhsNoticeAdam).toBe('26PROC000000001');
  });

  test('προαγωγή προτιμά προκήρυξη έναντι τευχών δημοπράτησης', () => {
    const form = {
      khmdhsNoticeAdam: '',
      khmdhsNoticeSnapshot: null,
      khmdhsAdamChainMeta: {
        noticeSnapshotsByAdam: {
          '26PROC000000099': {
            referenceNumber: '26PROC000000099',
            title: 'Τεύχη Δημοπράτησης',
            noticeType: 'Διακήρυξη',
            signedDate: '2026-08-28T00:00:00',
            finalSubmissionDate: '2026-09-20T14:00:00',
          },
          '26PROC000000002': {
            referenceNumber: '26PROC000000002',
            title: 'Προκήρυξη ανοικτού διαγωνισμού',
            noticeType: 'Προκήρυξη',
            signedDate: '2026-08-25T00:00:00',
            finalSubmissionDate: '2026-09-14T14:00:00',
          },
        },
      },
    };
    const { form: next } = stripConfirmedCancelledChainLinks(form, ['26PROC000000001']);
    expect(next.khmdhsNoticeAdam).toBe('26PROC000000002');
  });

  test('δεν αφαιρεί κρίκο που απλώς έλειψε από την ανάκτηση', () => {
    const form = {
      khmdhsNoticeAdam: '26PROC000000001',
      khmdhsNoticeSnapshot: { referenceNumber: '26PROC000000001', title: 'Ζωντανή' },
    };
    const { form: next, removed } = stripConfirmedCancelledChainLinks(form, []);
    expect(next.khmdhsNoticeAdam).toBe('26PROC000000001');
    expect(removed).toEqual([]);
  });

  test('αφαιρεί ακυρωμένη σύμβαση ΚΗΜΔΗΣ χωρίς να σβήσει το ποσό του χρήστη', () => {
    const form = {
      khmdhsAdam: '25SYMV000000001',
      khmdhsContractSnapshot: { referenceNumber: '25SYMV000000001' },
      contractAmount: '162000',
      contractDate: '2026-01-15',
      khmdhsAdamChainMeta: {
        linkedAdams: { contracts: ['25SYMV000000001'] },
      },
    };
    const { form: next } = stripConfirmedCancelledChainLinks(form, ['25SYMV000000001']);
    expect(next.khmdhsAdam).toBe('');
    expect(next.khmdhsContractSnapshot).toBeNull();
    expect(next.contractAmount).toBe('162000');
    expect(next.contractDate).toBe('2026-01-15');
    expect(next.khmdhsAdamChainMeta.linkedAdams.contracts).toEqual([]);
  });
});

describe('describeCancelledLinkRemoval', () => {
  test('δημοσίευση χωρίς αντικαταστάτη', () => {
    expect(describeCancelledLinkRemoval('notice', '26PROC000000001')).toMatch(
      /Αφαιρέθηκε ακυρωμένη δημοσίευση 26PROC000000001/
    );
    expect(describeCancelledLinkRemoval('notice', '26PROC000000001')).toMatch(/δεν εμφανίζεται πλέον στην κάρτα/);
  });

  test('δημοσίευση με νέα ισχύουσα', () => {
    const line = describeCancelledLinkRemoval('notice', '26PROC000000001', '26PROC000000002');
    expect(line).toMatch(/Ισχύει πλέον η 26PROC000000002/);
    expect(line).not.toMatch(/δεν εμφανίζεται πλέον/);
  });
});

describe('collectRecordedLinkAdamsByStage', () => {
  test('μαζεύει κύρια και συνδεδεμένες δημοσιεύσεις', () => {
    const sets = collectRecordedLinkAdamsByStage({
      khmdhsNoticeAdam: '26PROC000000001',
      khmdhsAdamChainMeta: {
        linkedAdams: { notices: ['26PROC000000002'] },
        noticeSnapshotsByAdam: { '26PROC000000003': { title: 'X' } },
      },
    });
    expect([...sets.notice].sort()).toEqual([
      '26PROC000000001',
      '26PROC000000002',
      '26PROC000000003',
    ]);
  });
});

/**
 * @jest-environment node
 */
import {
  applyAutoDocumentRegistryFromChain,
  buildRegistryModalPayloadAfterReview,
  collectKhmdhsRegistryCandidatesFromChainRes,
  collectKhmdhsRegistryCandidatesFromProject,
  enrichRegistryLinkLabel,
  annotateRegistryLinkLabels,
  shouldIncludeChainHistoryInRegistry,
  filterRegistryCandidatesBySymvPlan,
  shouldOfferRegistryAfterReview,
  isTenderDocumentTitle,
  publicationDocumentLabel,
  pickRegistryDominantTitle,
  shouldShowRegistryEntryTitle,
  resyncRegistryEntryTitles,
  mergeRegistryCandidateLists,
} from './khmdhsDocumentRegistry';
import { CHAIN_KIND } from './khmdhsChainActions';
import { SYMV_CHAIN_ROLE } from './khmdhsSymvChainPlanner';
import { buildKhmdhsContractDisplayGroups } from './khmdhsContractDisplayFields';

describe('khmdhsDocumentRegistry deferred flow', () => {
  const modAdam = '24SYMV015124092';
  const rootAdam = '22SYMV011799800';

  const chainRes = {
    success: true,
    fetchedAt: '2026-01-01T00:00:00.000Z',
    request: { adam: '21REQ009553549', snapshot: { referenceNumber: '21REQ009553549' } },
    notice: { adam: '22PROC010072052', snapshot: { referenceNumber: '22PROC010072052' } },
    auction: { adam: '22AWRD011136485', snapshot: { referenceNumber: '22AWRD011136485' } },
    contract: {
      adam: rootAdam,
      snapshot: { referenceNumber: rootAdam, title: 'Αρχική σύμβαση' },
    },
    contractChainHistory: [
      {
        adam: modAdam,
        label: 'Παράταση',
        snapshot: { referenceNumber: modAdam, title: 'Παράταση' },
      },
    ],
    payments: [],
  };

  it('does not include chain history amendments in raw chain fetch collection', () => {
    const candidates = collectKhmdhsRegistryCandidatesFromChainRes(chainRes);
    const adams = candidates.map((c) => c.adam);
    expect(adams).toContain(rootAdam);
    expect(adams).not.toContain(modAdam);
  });

  it('uses fetched notice snapshot for secondary PROC instead of a nameless stub', () => {
    const secondNoticeAdam = '22PROC010072999';
    const chainResWithSecondNotice = {
      ...chainRes,
      chainMeta: {
        linkedAdams: { notices: ['22PROC010072052', secondNoticeAdam] },
        noticeSnapshotsByAdam: {
          [secondNoticeAdam]: {
            referenceNumber: secondNoticeAdam,
            title: 'ΤΕΥΧΗ ΔΗΜΟΠΡΑΤΗΣΗΣ',
          },
        },
      },
    };
    const candidates = collectKhmdhsRegistryCandidatesFromChainRes(chainResWithSecondNotice);
    const secondEntry = candidates.find((c) => c.adam === secondNoticeAdam);
    expect(secondEntry).toBeTruthy();
    expect(secondEntry.isStub).not.toBe(true);
    expect(secondEntry.title).toBe('ΤΕΥΧΗ ΔΗΜΟΠΡΑΤΗΣΗΣ');
  });

  it('applyAutoDocumentRegistryFromChain προσθέτει δεύτερο PROC με τίτλο στα Αρχεία', () => {
    const secondNoticeAdam = '26PROC019569916';
    const project = {
      khmdhsNoticeAdam: '22PROC010072052',
      khmdhsDocumentRegistry: [
        { adam: '22PROC010072052', title: 'Πρόσκληση', stage: 'PROC' },
      ],
    };
    const chainResWithSecondNotice = {
      ...chainRes,
      notice: {
        adam: '22PROC010072052',
        snapshot: { referenceNumber: '22PROC010072052', title: 'Πρόσκληση' },
      },
      chainMeta: {
        linkedAdams: { notices: ['22PROC010072052', secondNoticeAdam] },
        noticeSnapshotsByAdam: {
          [secondNoticeAdam]: {
            referenceNumber: secondNoticeAdam,
            title: 'ΤΕΥΧΗ ΔΗΜΟΠΡΑΤΗΣΗΣ ΕΡΓΟΥ',
          },
        },
      },
    };
    const next = applyAutoDocumentRegistryFromChain(project, [chainResWithSecondNotice], {
      nowIso: '2026-08-07T10:00:00.000Z',
    });
    const second = next.find((e) => e.adam === secondNoticeAdam);
    expect(second).toBeTruthy();
    expect(second.title).toMatch(/ΤΕΥΧΗ/i);
  });

  it('δεν καταχωρεί REQ/PROC/AWRD χωρίς snapshot από το κύριο αποτέλεσμα αλυσίδας', () => {
    const bare = {
      success: true,
      request: { adam: '23REQ000000001' }, // χωρίς snapshot
      notice: { adam: '23PROC000000001' },
      auction: { adam: '23AWRD000000001' },
      contract: {
        adam: rootAdam,
        snapshot: { referenceNumber: rootAdam, title: 'Σύμβαση' },
      },
    };
    const adams = collectKhmdhsRegistryCandidatesFromChainRes(bare).map((c) => c.adam);
    expect(adams).toContain(rootAdam);
    expect(adams).not.toContain('23REQ000000001');
    expect(adams).not.toContain('23PROC000000001');
    expect(adams).not.toContain('23AWRD000000001');
  });

  it('falls back to a nameless stub when no fresh snapshot is available for a linked PROC', () => {
    const secondNoticeAdam = '22PROC010072999';
    const chainResWithSecondNotice = {
      ...chainRes,
      chainMeta: {
        linkedAdams: { notices: ['22PROC010072052', secondNoticeAdam] },
        noticeSnapshotsByAdam: {},
      },
    };
    const candidates = collectKhmdhsRegistryCandidatesFromChainRes(chainResWithSecondNotice);
    const secondEntry = candidates.find((c) => c.adam === secondNoticeAdam);
    expect(secondEntry).toBeTruthy();
    expect(secondEntry.isStub).toBe(true);
  });

  it('includes chain history only after user characterization', () => {
    const unresolved = {
      khmdhsAdam: rootAdam,
      khmdhsContractSnapshot: { referenceNumber: rootAdam },
      khmdhsContractChainHistory: [
        { adam: modAdam, label: 'Παράταση', snapshot: { referenceNumber: modAdam } },
      ],
      khmdhsDataQualityReview: { resolutions: {} },
    };
    expect(collectKhmdhsRegistryCandidatesFromProject(unresolved).map((c) => c.adam))
      .not.toContain(modAdam);

    const resolved = {
      ...unresolved,
      khmdhsDataQualityReview: {
        resolutions: {
          [`chainKindReview::${modAdam}`]: { value: CHAIN_KIND.EXTENSION },
        },
      },
    };
    const withMod = collectKhmdhsRegistryCandidatesFromProject(resolved).map((c) => c.adam);
    expect(withMod).toContain(modAdam);
  });

  it('shouldIncludeChainHistoryInRegistry respects root vs characterized', () => {
    expect(shouldIncludeChainHistoryInRegistry({ adam: rootAdam, isRoot: true }, null)).toBe(true);
    expect(shouldIncludeChainHistoryInRegistry({ adam: modAdam }, null)).toBe(false);
    expect(
      shouldIncludeChainHistoryInRegistry(
        { adam: modAdam },
        { resolutions: { [`chainKindReview::${modAdam}`]: { value: CHAIN_KIND.MODIFICATION } } }
      )
    ).toBe(true);
  });

  it('excludes SYMV plan SKIP from registry and contract next-act hints', () => {
    const skippedAdam = '25SYMV017590502';
    const project = {
      khmdhsAdam: rootAdam,
      khmdhsContractSnapshot: { referenceNumber: rootAdam, nextRefNo: skippedAdam, nextModified: true },
      khmdhsSymvChainPlan: {
        items: [{ adam: skippedAdam, role: SYMV_CHAIN_ROLE.SKIP }],
      },
      khmdhsContractChainHistory: [
        { adam: rootAdam, isRoot: true, label: 'Αρχική σύμβαση' },
        { adam: skippedAdam, label: 'Συμπληρωματική σύμβαση', kind: 'modification' },
      ],
    };
    expect(shouldIncludeChainHistoryInRegistry({ adam: skippedAdam }, null, project)).toBe(false);
    const adams = collectKhmdhsRegistryCandidatesFromProject(project).map((c) => c.adam);
    expect(adams).not.toContain(skippedAdam);

    const chainRes = {
      success: true,
      contract: { adam: rootAdam, snapshot: { referenceNumber: rootAdam } },
      contractChainHistory: [
        { adam: skippedAdam, label: 'Συμπληρωματική σύμβαση', kind: 'modification' },
      ],
    };
    const { candidates } = buildRegistryModalPayloadAfterReview(project, '2026-01-01', chainRes);
    expect(candidates.map((c) => c.adam)).not.toContain(skippedAdam);

    const groups = buildKhmdhsContractDisplayGroups(project.khmdhsContractSnapshot, {
      symvChainPlan: project.khmdhsSymvChainPlan,
    });
    const linkRows = groups.filter((g) => g.id === 'links').flatMap((g) => g.rows || []);
    expect(linkRows.some((r) => /Επόμενη πράξη/i.test(r.label))).toBe(false);
    expect(linkRows.some((r) => /Επόμ\. ΑΔΑΜ/i.test(r.label))).toBe(false);
  });

  it('collectKhmdhsRegistryCandidatesFromChainRes excludes SKIP SYMV όταν δοθεί project', () => {
    const skippedAdam = '25SYMV017590502';
    const project = {
      khmdhsSymvChainPlan: { items: [{ adam: skippedAdam, role: SYMV_CHAIN_ROLE.SKIP }] },
    };
    const chainRes = {
      success: true,
      contract: { adam: rootAdam, snapshot: { referenceNumber: rootAdam } },
      contractChainHistory: [
        { adam: skippedAdam, label: 'Συμπληρωματική σύμβαση', kind: 'modification' },
      ],
    };
    const withProject = collectKhmdhsRegistryCandidatesFromChainRes(chainRes, null, project).map((c) => c.adam);
    expect(withProject).not.toContain(skippedAdam);
    // Χωρίς project (παλιά συμπεριφορά) η ίδια πράξη θα περνούσε.
    const withoutProject = collectKhmdhsRegistryCandidatesFromChainRes(chainRes, null).map((c) => c.adam);
    expect(withoutProject).toContain(skippedAdam);
  });

  it('filterRegistryCandidatesBySymvPlan removes skipped adams', () => {
    const skipped = '25SYMV017590502';
    const kept = '25SYMV017590605';
    const project = {
      khmdhsSymvChainPlan: {
        items: [
          { adam: skipped, role: SYMV_CHAIN_ROLE.SKIP },
          { adam: kept, role: SYMV_CHAIN_ROLE.EXTENSION },
        ],
      },
    };
    const filtered = filterRegistryCandidatesBySymvPlan([
      { adam: skipped, stage: 'SYMV' },
      { adam: kept, stage: 'SYMV' },
    ], project);
    expect(filtered.map((c) => c.adam)).toEqual([kept]);
  });

  it('shouldOfferRegistryAfterReview respects dismissed flag', () => {
    const project = {
      khmdhsAdam: rootAdam,
      khmdhsContractSnapshot: { referenceNumber: rootAdam },
      khmdhsDocumentRegistry: [{ adam: rootAdam }],
      khmdhsDocumentRegistryDismissed: true,
    };
    expect(shouldOfferRegistryAfterReview(project)).toBe(false);
    expect(shouldOfferRegistryAfterReview(project, { dismissed: true })).toBe(false);
  });

  it('buildRegistryModalPayloadAfterReview merges chainRes with partial project', () => {
    const fullChain = {
      success: true,
      request: { adam: '23REQ012556069', snapshot: { referenceNumber: '23REQ012556069', isInitial: true } },
      notice: { adam: '23PROC012643596', snapshot: { referenceNumber: '23PROC012643596' } },
      auction: { adam: '23AWRD012744400', snapshot: { referenceNumber: '23AWRD012744400' } },
      contract: { adam: '23SYMV012797214', snapshot: { referenceNumber: '23SYMV012797214' } },
      payments: [{ adam: '23PAY012800001', snapshot: { referenceNumber: '23PAY012800001' } }],
    };
    const project = {
      khmdhsNoticeAdam: '23PROC012643596',
      khmdhsNoticeSnapshot: { referenceNumber: '23PROC012643596' },
      khmdhsAwardAdam: '23AWRD012744400',
      khmdhsAwardSnapshot: { referenceNumber: '23AWRD012744400' },
      khmdhsAdam: '23SYMV012797214',
      khmdhsContractSnapshot: { referenceNumber: '23SYMV012797214' },
    };
    const { candidates } = buildRegistryModalPayloadAfterReview(project, '2026-01-01', fullChain);
    const adams = candidates.map((c) => c.adam);
    expect(adams).toContain('23REQ012556069');
    expect(adams).toContain('23PROC012643596');
    expect(adams).toContain('23PAY012800001');
  });

  it('enrichRegistryLinkLabel appends date, amount and payment totals', () => {
    expect(enrichRegistryLinkLabel('Αρχική σύμβαση', {
      stage: 'SYMV',
      roleLabel: 'Αρχική σύμβαση',
      amount: '332.101,10',
    })).toBe('Αρχική σύμβαση 332.101,10€');

    expect(enrichRegistryLinkLabel('Παράταση', {
      stage: 'SYMV',
      roleLabel: 'Παράταση',
      date: '2026-05-02',
    })).toBe('Παράταση 02-05-2026');

    expect(enrichRegistryLinkLabel('Συμπληρωματική σύμβαση', {
      stage: 'SYMV',
      roleLabel: 'Συμπληρωματική σύμβαση',
      amount: '74155.85',
    })).toBe('Συμπληρωματική σύμβαση 74.155,85€');

    expect(enrichRegistryLinkLabel('Ένταλμα πληρωμής 1', {
      stage: 'PAY',
      amount: '25.258,56 €',
    })).toBe('Ένταλμα πληρωμής 1 : 25.258,56€');
  });

  it('annotateRegistryLinkLabels enriches stored registry entries', () => {
    const [pay] = annotateRegistryLinkLabels([{
      id: 'p1',
      adam: '24PAY016000001',
      stage: 'PAY',
      type: 'PAY',
      amount: '25258.56',
    }]);
    expect(pay.linkLabel).toMatch(/Ένταλμα πληρωμής.*25\.258,56€/);
  });

  it('PAY candidates προτιμούν το χειροκίνητο πραγματικό ποσό αντί του ποσού ΚΗΜΔΗΣ', () => {
    const project = {
      khmdhsPayments: [
        {
          adam: '25PAY000000001',
          userActualAmount: 12000.5,
          snapshot: {
            referenceNumber: '25PAY000000001',
            title: 'Ενταλμα',
            signedDate: '2025-06-01',
            costs: [{ costType: 'GROSS', amount: 33888.7 }],
          },
        },
        {
          adam: '25PAY000000002',
          userActualAmount: 8000,
          snapshot: {
            referenceNumber: '25PAY000000002',
            title: 'Ενταλμα 2',
            signedDate: '2025-07-01',
            costs: [{ costType: 'GROSS', amount: 33888.7 }],
          },
        },
      ],
    };
    const pays = collectKhmdhsRegistryCandidatesFromProject(project)
      .filter((c) => c.stage === 'PAY');
    expect(pays).toHaveLength(2);
    expect(pays[0].linkLabel).toMatch(/12\.000,50€/);
    expect(pays[1].linkLabel).toMatch(/8\.000,00€/);
    expect(pays.every((c) => !/33\.888,70/.test(c.linkLabel))).toBe(true);
    expect(pays.every((c) => c.amountSource === 'user')).toBe(true);
  });

  it('mergeRegistryCandidateLists δεν αντικαθιστά χειροκίνητο ποσό PAY με ποσό ΚΗΜΔΗΣ', () => {
    const merged = mergeRegistryCandidateLists(
      [{
        adam: '25PAY000000001',
        stage: 'PAY',
        type: 'PAY',
        amount: '12.000,50',
        amountSource: 'user',
        title: 'A',
      }],
      [{
        adam: '25PAY000000001',
        stage: 'PAY',
        type: 'PAY',
        amount: '33.888,70',
        amountSource: 'khmdhs',
        title: 'A',
      }]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].amount).toBe('12.000,50');
    expect(merged[0].amountSource).toBe('user');
  });

  it('resyncRegistryEntryTitles δεν αντικαθιστά υπάρχον ποσό PAY με μεικτό ΚΗΜΔΗΣ', () => {
    const existing = [{
      id: 'p1',
      adam: '25PAY000000001',
      stage: 'PAY',
      type: 'PAY',
      title: 'Ενταλμα',
      amount: '12.000,50',
      amountSource: 'user',
    }];
    const [updated] = resyncRegistryEntryTitles(existing, [{
      adam: '25PAY000000001',
      stage: 'PAY',
      title: 'Ενταλμα ενημερωμένο',
      amount: '33.888,70',
      amountSource: 'khmdhs',
    }]);
    expect(updated.title).toBe('Ενταλμα ενημερωμένο');
    expect(updated.amount).toBe('12.000,50');
    expect(updated.amountSource).toBe('user');
  });

  describe('isTenderDocumentTitle — αναγνώριση Τευχών Δημοπράτησης', () => {
    it('αναγνωρίζει τον τίτλο ανεξαρτήτως τόνων/κεφαλαίων', () => {
      expect(isTenderDocumentTitle('ΤΕΥΧΗ ΔΗΜΟΠΡΑΤΗΣΗΣ ΕΡΓΟΥ')).toBe(true);
      expect(isTenderDocumentTitle('τευχη δημοπρατησης')).toBe(true);
      expect(isTenderDocumentTitle('Τεύχη Δημοπράτησης')).toBe(true);
      expect(isTenderDocumentTitle('τεύχος δημοπράτησης')).toBe(true);
      expect(isTenderDocumentTitle('ΤΕΥΧΗ ΔΙΑΓΩΝΙΣΜΟΥ')).toBe(true);
    });

    it('δεν αναγνωρίζει άσχετους ή κενούς τίτλους', () => {
      expect(isTenderDocumentTitle('ΑΞΙΟΠΟΙΗΣΗ ΑΡΔΕΥΤΙΚΟΥ ΝΕΡΟΥ ΤΟΥ ΔΗΜΟΥ')).toBe(false);
      expect(isTenderDocumentTitle('Διακήρυξη ανοιχτής διαδικασίας')).toBe(false);
      expect(isTenderDocumentTitle('')).toBe(false);
      expect(isTenderDocumentTitle(null)).toBe(false);
    });
  });

  it('annotateRegistryLinkLabels ξεχωρίζει τα Τεύχη Δημοπράτησης από γενικές δημοσιεύσεις', () => {
    const [tender, generic] = annotateRegistryLinkLabels([
      {
        id: 'n1',
        adam: '23PROC013450673',
        stage: 'PROC',
        type: 'PROC',
        title: 'ΤΕΥΧΗ ΔΗΜΟΠΡΑΤΗΣΗΣ ΕΡΓΟΥ',
        noticeType: 'Διακήρυξη',
      },
      {
        id: 'n2',
        adam: '23PROC013450674',
        stage: 'PROC',
        type: 'PROC',
        title: 'ΑΞΙΟΠΟΙΗΣΗ ΑΡΔΕΥΤΙΚΟΥ ΝΕΡΟΥ',
        noticeType: 'Διακήρυξη',
      },
    ]);
    expect(tender.linkLabel).toBe('Τεύχη Δημοπράτησης');
    expect(generic.linkLabel).toBe('Διακήρυξη 2');
  });

  it('Πρόσκληση + Διακήρυξη (τίτλος έργου) → η Διακήρυξη εμφανίζεται ως Τεύχη Δημοπράτησης', () => {
    const labeled = annotateRegistryLinkLabels([
      {
        id: 'n1',
        adam: '26PROC012281700',
        stage: 'PROC',
        type: 'PROC',
        title: 'ΜΕΤΑΤΟΠΙΣΗ ΘΕΣΕΩΝ ΜΕΤΡΗΤΩΝ ΤΗΣ ΔΕΔΔΗΕ',
        noticeType: 'Πρόσκληση υποβολής προσφορών',
      },
      {
        id: 'n2',
        adam: '26PROC019569916',
        stage: 'PROC',
        type: 'PROC',
        title: 'ΜΕΤΑΤΟΠΙΣΗ ΘΕΣΕΩΝ ΜΕΤΡΗΤΩΝ ΤΗΣ ΔΕΔΔΗΕ',
        noticeType: 'Διακήρυξη',
      },
    ]);
    const invitation = labeled.find((e) => e.adam === '26PROC012281700');
    const tender = labeled.find((e) => e.adam === '26PROC019569916');
    expect(invitation.linkLabel).toMatch(/Πρόσκληση/);
    expect(tender.linkLabel).toBe('Τεύχη Δημοπράτησης');
  });

  it('publicationDocumentLabel αναγνωρίζει τα Τεύχη Δημοπράτησης όταν δοθεί ο τίτλος', () => {
    expect(publicationDocumentLabel('Διακήρυξη', 1, 1, 'ΤΕΥΧΗ ΔΗΜΟΠΡΑΤΗΣΗΣ')).toBe('Τεύχη Δημοπράτησης');
    expect(publicationDocumentLabel('Διακήρυξη', 1, 1)).toBe('Διακήρυξη');
  });

  describe('πραγματικός τίτλος εγγράφου σε κρίκους πέραν του PROC', () => {
    const dominant = 'ΑΞΙΟΠΟΙΗΣΗ ΑΡΔΕΥΤΙΚΟΥ ΝΕΡΟΥ ΤΟΥ ΔΗΜΟΥ';

    it('pickRegistryDominantTitle εντοπίζει τον επαναλαμβανόμενο τίτλο του υποέργου', () => {
      const dominantTitle = pickRegistryDominantTitle([
        { title: dominant },
        { title: dominant },
        { title: 'ΤΕΧΝΙΚΗ ΕΚΘΕΣΗ ΓΙΑ ΤΟ ΕΡΓΟ' },
      ]);
      expect(dominantTitle).toBe(dominant);
    });

    it('shouldShowRegistryEntryTitle κρύβει τίτλους ίδιους με τον κυρίαρχο', () => {
      expect(shouldShowRegistryEntryTitle({ title: dominant }, dominant)).toBe(false);
      expect(shouldShowRegistryEntryTitle({ title: 'ΤΕΧΝΙΚΗ ΕΚΘΕΣΗ ΓΙΑ ΤΟ ΕΡΓΟ' }, dominant)).toBe(true);
      expect(shouldShowRegistryEntryTitle({ title: '' }, dominant)).toBe(false);
    });

    it('annotateRegistryLinkLabels δεν εμφανίζει πλέον υπότιτλο με τον τίτλο του εγγράφου (μόνο η ετικέτα του κρίκου)', () => {
      // Ο τίτλος που καταχωρεί το ΚΗΜΔΗΣ ανά πράξη (π.χ. σε αποφάσεις ανάληψης υποχρέωσης)
      // συχνά διαφέρει σε διατύπωση/περικοπή χωρίς να σημαίνει κάτι διαφορετικό, οπότε δεν
      // εμφανίζεται πλέον σαν υπότιτλος — μόνο η σταθερή ετικέτα του κρίκου.
      const [req, commit] = annotateRegistryLinkLabels([
        {
          id: 'r1',
          adam: '21REQ009553549',
          stage: 'REQ',
          type: 'REQ',
          title: dominant,
        },
        {
          id: 'c1',
          adam: '21COMMIT009553549',
          stage: 'COMMIT',
          type: 'COMMIT',
          title: 'ΤΕΧΝΙΚΗ ΕΚΘΕΣΗ ΓΙΑ ΤΟ ΕΡΓΟ',
        },
      ]);
      expect(req.distinctTitle).toBeUndefined();
      expect(commit.distinctTitle).toBeUndefined();
    });

    it('annotateRegistryLinkLabels αναγνωρίζει τα Τεύχη Δημοπράτησης μόνο μέσω της ετικέτας', () => {
      const [tender] = annotateRegistryLinkLabels([{
        id: 'n1',
        adam: '23PROC013450673',
        stage: 'PROC',
        type: 'PROC',
        title: 'ΤΕΥΧΗ ΔΗΜΟΠΡΑΤΗΣΗΣ ΕΡΓΟΥ',
        noticeType: 'Διακήρυξη',
      }]);
      expect(tender.linkLabel).toBe('Τεύχη Δημοπράτησης');
      expect(tender.distinctTitle).toBeUndefined();
    });
  });

  describe('resyncRegistryEntryTitles — ενημέρωση τίτλων ήδη καταγεγραμμένων εγγράφων', () => {
    it('ενημερώνει τον τίτλο μιας ήδη καταγεγραμμένης δημοσίευσης ώστε να αναγνωριστεί ως Τεύχη Δημοπράτησης', () => {
      const existing = [{
        id: 'n1',
        adam: '23PROC013450673',
        stage: 'PROC',
        type: 'PROC',
        title: 'Παλιός γενικός τίτλος',
        noticeType: 'Διακήρυξη',
        linkLabel: 'Διακήρυξη',
      }];
      const candidates = [{
        adam: '23PROC013450673',
        title: 'ΤΕΥΧΗ ΔΗΜΟΠΡΑΤΗΣΗΣ ΕΡΓΟΥ',
        noticeType: 'Διακήρυξη',
      }];
      const [updated] = resyncRegistryEntryTitles(existing, candidates);
      expect(updated.title).toBe('ΤΕΥΧΗ ΔΗΜΟΠΡΑΤΗΣΗΣ ΕΡΓΟΥ');
      expect(updated.linkLabel).toBe('Τεύχη Δημοπράτησης');
    });

    it('δεν αλλάζει τίποτα όταν δεν υπάρχει αντίστοιχος φρέσκος υποψήφιος', () => {
      const existing = [{ id: 'n1', adam: '23PROC013450673', stage: 'PROC', title: 'Χ' }];
      expect(resyncRegistryEntryTitles(existing, [])).toBe(existing);
      expect(resyncRegistryEntryTitles(existing, [{ adam: '99PROC000000000', title: 'Άλλο' }])).toBe(existing);
    });

    it('μετατρέπει ένα ήδη καταγεγραμμένο «γυμνό» ΑΔΑΜ (χωρίς τίτλο) σε Τεύχη Δημοπράτησης μετά από ανανέωση', () => {
      const secondNoticeAdam = '22PROC010072999';
      const existing = [{
        id: 'n2',
        adam: secondNoticeAdam,
        stage: 'PROC',
        type: 'PROC',
        title: '',
        isStub: true,
        linkLabel: 'Δημοσίευση 2',
      }];
      const chainResWithSecondNotice = {
        ...chainRes,
        chainMeta: {
          linkedAdams: { notices: ['22PROC010072052', secondNoticeAdam] },
          noticeSnapshotsByAdam: {
            [secondNoticeAdam]: { referenceNumber: secondNoticeAdam, title: 'ΤΕΥΧΗ ΔΗΜΟΠΡΑΤΗΣΗΣ' },
          },
        },
      };
      const freshCandidates = collectKhmdhsRegistryCandidatesFromChainRes(chainResWithSecondNotice);
      const [updated] = resyncRegistryEntryTitles(existing, freshCandidates);
      expect(updated.title).toBe('ΤΕΥΧΗ ΔΗΜΟΠΡΑΤΗΣΗΣ');
      expect(updated.linkLabel).toBe('Τεύχη Δημοπράτησης');
    });

    it('δεν επηρεάζει καταγραφές χωρίς αντιστοιχία ΑΔΑΜ στους φρέσκους υποψήφιους', () => {
      const existing = [
        { id: 'p1', adam: '24PAY016000001', stage: 'PAY', title: 'Ένταλμα' },
      ];
      const candidates = [{ adam: '23PROC013450673', title: 'Άσχετο έγγραφο' }];
      expect(resyncRegistryEntryTitles(existing, candidates)).toEqual(existing);
    });
  });
});

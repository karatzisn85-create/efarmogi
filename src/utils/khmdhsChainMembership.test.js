/**
 * @jest-environment node
 */
import {
  CHAIN_LINK_KEEP_ROLE,
  awardBelongsToThisCard,
  paymentAdamBelongsToThisCard,
  collectExtraChainLinkDocuments,
  extraLinkNeedsUserDecision,
  inferExtraLinkDefaultRole,
} from './khmdhsChainMembership';
import {
  collectKhmdhsAwardAdams,
  collectKhmdhsAwardEntries,
} from './khmdhsAwardFields';
import {
  applyAutoDocumentRegistryFromChain,
  collectKhmdhsRegistryCandidatesFromProject,
} from './khmdhsDocumentRegistry';
import { filterUnrelatedPayments } from './khmdhsPaymentReconciliation';
import { getKhmdhsPaymentEntries } from './khmdhsChainExtraFields';
import { SYMV_CHAIN_ROLE, resolveReusableSymvChainPlan } from './khmdhsSymvChainPlanner';

const OWN_AWARD = '22AWRD011136485';
const EXTRA_AWARD = '23AWRD012025114';
const SIBLING_AWARD = '25AWRD099999999';
const KEPT_SYMV = '24SYMV015124092';
const SKIP_SYMV = '25SYMV099999999';
const OWN_PAY = '25PAY016915101';
const EXTRA_PAY = '25PAY016448732';
const SIBLING_PAY = '25PAY099999999';

function pezaLikeProject(overrides = {}) {
  return {
    khmdhsAwardAdam: OWN_AWARD,
    khmdhsAwardSnapshot: { referenceNumber: OWN_AWARD, title: 'Κατακύρωση 1' },
    khmdhsAdam: KEPT_SYMV,
    khmdhsContractSnapshot: { referenceNumber: KEPT_SYMV },
    khmdhsSymvChainPlan: {
      items: [
        { adam: KEPT_SYMV, role: SYMV_CHAIN_ROLE.MAIN, stage: 'SYMV' },
        { adam: SKIP_SYMV, role: SYMV_CHAIN_ROLE.SKIP, stage: 'SYMV' },
      ],
    },
    khmdhsAdamChainMeta: {
      linkedAdams: {
        auctions: [OWN_AWARD, EXTRA_AWARD, SIBLING_AWARD],
        payments: [OWN_PAY, EXTRA_PAY, SIBLING_PAY],
        contracts: [KEPT_SYMV, SKIP_SYMV],
      },
      awardSnapshotsByAdam: {
        [OWN_AWARD]: { referenceNumber: OWN_AWARD, title: 'Κατακύρωση 1', contractRefNos: [KEPT_SYMV] },
        [SIBLING_AWARD]: {
          referenceNumber: SIBLING_AWARD,
          title: 'Κατακύρωση άλλου τμήματος',
          contractRefNos: [SKIP_SYMV],
        },
      },
    },
    khmdhsDocumentRegistry: [
      { adam: OWN_AWARD, stage: 'AWRD', title: 'Κατακύρωση 1' },
      { adam: EXTRA_AWARD, stage: 'AWRD', title: 'Ανάθεση 2', isStub: true },
      {
        adam: EXTRA_PAY,
        stage: 'PAY',
        title: '3ος λογ.',
        snapshot: { referenceNumber: EXTRA_PAY, title: '3ος λογ.', contractRefNo: KEPT_SYMV },
      },
    ],
    khmdhsPayments: [
      { adam: OWN_PAY, snapshot: { referenceNumber: OWN_PAY, contractRefNo: KEPT_SYMV, title: '4ος λογ.' } },
    ],
    ...overrides,
  };
}

describe('khmdhsChainMembership', () => {
  test('κατακύρωση άλλου τμήματος (SKIP σύμβαση) δεν ανήκει στην κάρτα', () => {
    const project = pezaLikeProject();
    expect(awardBelongsToThisCard(project, SIBLING_AWARD)).toBe(false);
    expect(collectKhmdhsAwardAdams(project)).toEqual(expect.arrayContaining([OWN_AWARD, EXTRA_AWARD]));
    expect(collectKhmdhsAwardAdams(project)).not.toContain(SIBLING_AWARD);
  });

  test('δεύτερη κατακύρωση ήδη στα Αρχεία αυτής της κάρτας ανήκει στην αλυσίδα', () => {
    const project = pezaLikeProject();
    expect(awardBelongsToThisCard(project, EXTRA_AWARD)).toBe(true);
    expect(collectKhmdhsAwardEntries(project).map((e) => e.adam)).toEqual(
      expect.arrayContaining([OWN_AWARD, EXTRA_AWARD])
    );
  });

  test('ένταλμα άλλου τμήματος κόβεται — ένταλμα κρατημένης σύμβασης μένει', () => {
    const project = pezaLikeProject();
    expect(paymentAdamBelongsToThisCard(project, EXTRA_PAY, { contractRefNo: KEPT_SYMV })).toBe(true);
    expect(paymentAdamBelongsToThisCard(project, SIBLING_PAY, { contractRefNo: SKIP_SYMV })).toBe(false);
    const kept = filterUnrelatedPayments([
      { adam: OWN_PAY, snapshot: { contractRefNo: KEPT_SYMV } },
      { adam: EXTRA_PAY, snapshot: { contractRefNo: KEPT_SYMV } },
      { adam: SIBLING_PAY, snapshot: { contractRefNo: SKIP_SYMV } },
    ], project).map((p) => p.adam);
    expect(kept).toEqual(expect.arrayContaining([OWN_PAY, EXTRA_PAY]));
    expect(kept).not.toContain(SIBLING_PAY);
  });

  test('ένταλμα ήδη στα Αρχεία εμφανίζεται στα αποτελέσματα ακόμα κι αν έλειπε από khmdhsPayments', () => {
    const project = pezaLikeProject();
    const adams = getKhmdhsPaymentEntries(project).map((p) => p.adam);
    expect(adams).toEqual(expect.arrayContaining([OWN_PAY, EXTRA_PAY]));
    expect(adams).not.toContain(SIBLING_PAY);
  });

  test('ανανέωση δεν αφαιρεί τη δεύτερη κατακύρωση / το ένταλμα της κάρτας από τα Αρχεία', () => {
    const project = pezaLikeProject();
    const chainRes = {
      success: true,
      auction: { adam: OWN_AWARD, snapshot: { referenceNumber: OWN_AWARD, title: 'Κατακύρωση 1' } },
      contract: { adam: KEPT_SYMV, snapshot: { referenceNumber: KEPT_SYMV, title: 'Σύμβαση' } },
      payments: [
        { adam: OWN_PAY, snapshot: { referenceNumber: OWN_PAY, contractRefNo: KEPT_SYMV, title: '4ος λογ.' } },
        { adam: EXTRA_PAY, snapshot: { referenceNumber: EXTRA_PAY, contractRefNo: KEPT_SYMV, title: '3ος λογ.' } },
      ],
      chainMeta: {
        linkedAdams: {
          auctions: [OWN_AWARD, EXTRA_AWARD, SIBLING_AWARD],
          payments: [OWN_PAY, EXTRA_PAY],
          contracts: [KEPT_SYMV],
        },
        awardSnapshotsByAdam: {
          [OWN_AWARD]: { referenceNumber: OWN_AWARD, title: 'Κατακύρωση 1' },
        },
      },
    };
    const next = applyAutoDocumentRegistryFromChain(project, [chainRes]);
    expect(next.find((e) => e.adam === EXTRA_AWARD)).toBeTruthy();
    expect(next.find((e) => e.adam === EXTRA_PAY)).toBeTruthy();
    expect(next.find((e) => e.adam === SIBLING_AWARD)).toBeFalsy();
  });

  test('γυμνή κατακύρωση άλλου τμήματος δεν μπαίνει ως υποψήφια στα Αρχεία', () => {
    const project = {
      khmdhsAwardAdam: OWN_AWARD,
      khmdhsAwardSnapshot: { referenceNumber: OWN_AWARD, title: 'Κατακύρωση κάρτας' },
      khmdhsAdamChainMeta: {
        linkedAdams: { auctions: [OWN_AWARD, SIBLING_AWARD] },
        awardSnapshotsByAdam: {
          [OWN_AWARD]: { referenceNumber: OWN_AWARD, title: 'Κατακύρωση κάρτας' },
          [SIBLING_AWARD]: { referenceNumber: SIBLING_AWARD, title: 'Κατακύρωση άλλου τμήματος' },
        },
      },
    };
    const adams = collectKhmdhsRegistryCandidatesFromProject(project).map((c) => c.adam);
    expect(adams).toContain(OWN_AWARD);
    expect(adams).not.toContain(SIBLING_AWARD);
  });

  test('νέα κατακύρωση δεμένη μόνο με αποκλεισμένη σύμβαση δεν ξαναρωτά', () => {
    const existingPlan = {
      items: [
        { adam: KEPT_SYMV, role: SYMV_CHAIN_ROLE.MAIN },
        { adam: SKIP_SYMV, role: SYMV_CHAIN_ROLE.SKIP },
      ],
    };
    const chainRes = {
      success: true,
      contract: { adam: KEPT_SYMV, snapshot: { referenceNumber: KEPT_SYMV, title: 'Σύμβαση' } },
      auction: { adam: OWN_AWARD, snapshot: { referenceNumber: OWN_AWARD } },
      chainMeta: {
        linkedAdams: { contracts: [KEPT_SYMV, SKIP_SYMV], auctions: [OWN_AWARD, SIBLING_AWARD] },
        contractSnapshotsByAdam: {
          [KEPT_SYMV]: { referenceNumber: KEPT_SYMV, title: 'Σύμβαση', contractSignedDate: '2025-01-01' },
        },
        awardSnapshotsByAdam: {
          [SIBLING_AWARD]: { referenceNumber: SIBLING_AWARD, contractRefNos: [SKIP_SYMV] },
        },
      },
    };
    const form = { khmdhsAdam: KEPT_SYMV, khmdhsSymvChainPlan: existingPlan };
    const extras = collectExtraChainLinkDocuments(chainRes, form);
    const sibling = extras.find((d) => d.adam === SIBLING_AWARD);
    expect(sibling).toBeTruthy();
    expect(inferExtraLinkDefaultRole(sibling, form)).toBe('skip');
    expect(extraLinkNeedsUserDecision(sibling, form, new Set([KEPT_SYMV, SKIP_SYMV]))).toBe(false);
  });

  test('ασαφής κατακύρωση κοινού διαγωνισμού ξαναρωτά χαρακτηρισμό', () => {
    const existingPlan = {
      items: [{ adam: KEPT_SYMV, role: SYMV_CHAIN_ROLE.MAIN }],
    };
    const form = {
      khmdhsAdam: KEPT_SYMV,
      khmdhsSymvChainPlan: existingPlan,
      khmdhsAdamChainMeta: {
        parallelContracts: [KEPT_SYMV, SKIP_SYMV],
        linkedAdams: { contracts: [KEPT_SYMV, SKIP_SYMV] },
        contractSnapshotsByAdam: {
          [SKIP_SYMV]: { referenceNumber: SKIP_SYMV, title: 'Σύμβαση άλλου τμήματος' },
        },
      },
    };
    const doc = {
      adam: SIBLING_AWARD,
      stage: 'AWRD',
      snapshot: { referenceNumber: SIBLING_AWARD, title: 'Άγνωστο τμήμα' },
    };
    expect(extraLinkNeedsUserDecision(doc, form, new Set([KEPT_SYMV]))).toBe(true);
  });

  test('KEEP στην κατανομή επαναχρησιμοποιείται στην επόμενη ανανέωση', () => {
    const existingPlan = {
      items: [
        { adam: KEPT_SYMV, role: SYMV_CHAIN_ROLE.MAIN, stage: 'SYMV' },
        { adam: EXTRA_AWARD, role: CHAIN_LINK_KEEP_ROLE, stage: 'AWRD' },
      ],
    };
    const chainRes = {
      success: true,
      contract: { adam: KEPT_SYMV, snapshot: { referenceNumber: KEPT_SYMV, title: 'Σύμβαση' } },
      auction: { adam: OWN_AWARD, snapshot: { referenceNumber: OWN_AWARD } },
      chainMeta: {
        linkedAdams: { contracts: [KEPT_SYMV], auctions: [OWN_AWARD, EXTRA_AWARD] },
        contractSnapshotsByAdam: {
          [KEPT_SYMV]: { referenceNumber: KEPT_SYMV, title: 'Σύμβαση', contractSignedDate: '2025-01-01' },
        },
      },
    };
    const reusable = resolveReusableSymvChainPlan(existingPlan, chainRes, {
      form: { khmdhsAdam: KEPT_SYMV, khmdhsSymvChainPlan: existingPlan },
    });
    expect(reusable).toBeTruthy();
    expect(reusable.items.find((i) => i.adam === EXTRA_AWARD)?.role).toBe(CHAIN_LINK_KEEP_ROLE);
  });

  test('δεύτερη κατακύρωση του ίδιου υποέργου (χωρίς άλλη σύμβαση στο γράφημα) μένει στην αλυσίδα', () => {
    const project = {
      khmdhsAdam: KEPT_SYMV,
      khmdhsAwardAdam: OWN_AWARD,
      khmdhsAwardSnapshot: { referenceNumber: OWN_AWARD, title: 'Κατακύρωση 1' },
      khmdhsAdamChainMeta: {
        linkedAdams: { auctions: [OWN_AWARD, EXTRA_AWARD], contracts: [KEPT_SYMV] },
        awardSnapshotsByAdam: {
          [OWN_AWARD]: { referenceNumber: OWN_AWARD, title: 'Κατακύρωση 1' },
          [EXTRA_AWARD]: { referenceNumber: EXTRA_AWARD, title: 'Ανάθεση 2 / τροποποίηση' },
        },
      },
    };
    expect(awardBelongsToThisCard(project, EXTRA_AWARD)).toBe(true);
    expect(collectKhmdhsAwardAdams(project)).toEqual(expect.arrayContaining([OWN_AWARD, EXTRA_AWARD]));
  });

  test('ένταλμα χωρίς σύμβαση σε κοινό διαγωνισμό ζητά χαρακτηρισμό και δεν μπαίνει μόνο του', () => {
    const form = {
      khmdhsAdam: KEPT_SYMV,
      khmdhsSymvChainPlan: {
        items: [
          { adam: KEPT_SYMV, role: SYMV_CHAIN_ROLE.MAIN, stage: 'SYMV' },
          { adam: SKIP_SYMV, role: SYMV_CHAIN_ROLE.SKIP, stage: 'SYMV' },
        ],
      },
      khmdhsAdamChainMeta: {
        parallelContracts: [KEPT_SYMV, SKIP_SYMV],
        linkedAdams: { contracts: [KEPT_SYMV, SKIP_SYMV], payments: [SIBLING_PAY] },
        contractSnapshotsByAdam: {
          [SKIP_SYMV]: { referenceNumber: SKIP_SYMV, title: 'Σύμβαση άλλου τμήματος' },
        },
      },
    };
    const doc = { adam: SIBLING_PAY, stage: 'PAY', snapshot: { referenceNumber: SIBLING_PAY } };
    expect(inferExtraLinkDefaultRole(doc, form)).toBe('skip');
    expect(extraLinkNeedsUserDecision(doc, form, new Set([KEPT_SYMV, SKIP_SYMV]))).toBe(true);
    expect(paymentAdamBelongsToThisCard(form, SIBLING_PAY, doc.snapshot)).toBe(false);
  });

  test('συγχρηματοδότηση: δύο εντάλματα της ίδιας σύμβασης ανήκουν και τα δύο στην κάρτα', () => {
    const project = {
      khmdhsAdam: KEPT_SYMV,
      coFinanced: true,
      khmdhsPayments: [
        { adam: OWN_PAY, snapshot: { referenceNumber: OWN_PAY, contractRefNo: KEPT_SYMV, organization: 'Δήμος' } },
        { adam: EXTRA_PAY, snapshot: { referenceNumber: EXTRA_PAY, contractRefNo: KEPT_SYMV, organization: 'Περιφερειακό Ταμείο' } },
      ],
    };
    expect(paymentAdamBelongsToThisCard(project, OWN_PAY, project.khmdhsPayments[0].snapshot)).toBe(true);
    expect(paymentAdamBelongsToThisCard(project, EXTRA_PAY, project.khmdhsPayments[1].snapshot)).toBe(true);
  });

  test('τροποποίηση κατακύρωσης που διορθώνει την κύρια ανάθεση ανήκει στην κάρτα', () => {
    const project = {
      khmdhsAdam: KEPT_SYMV,
      khmdhsAwardAdam: OWN_AWARD,
      khmdhsAwardSnapshot: { referenceNumber: OWN_AWARD },
      khmdhsAdamChainMeta: {
        parallelContracts: [KEPT_SYMV, SKIP_SYMV],
        linkedAdams: { contracts: [KEPT_SYMV, SKIP_SYMV], auctions: [OWN_AWARD, EXTRA_AWARD] },
        contractSnapshotsByAdam: {
          [SKIP_SYMV]: { referenceNumber: SKIP_SYMV, title: 'Σύμβαση άλλου τμήματος' },
        },
        awardSnapshotsByAdam: {
          [EXTRA_AWARD]: {
            referenceNumber: EXTRA_AWARD,
            amendedAuctionADAM: OWN_AWARD,
            title: 'Τροποποίηση ανάθεσης',
          },
        },
      },
    };
    expect(awardBelongsToThisCard(project, EXTRA_AWARD)).toBe(true);
  });
});

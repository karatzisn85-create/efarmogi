/**
 * @jest-environment node
 */
import {
  buildRegistryModalPayloadAfterReview,
  collectKhmdhsRegistryCandidatesFromChainRes,
  collectKhmdhsRegistryCandidatesFromProject,
  enrichRegistryLinkLabel,
  annotateRegistryLinkLabels,
  shouldIncludeChainHistoryInRegistry,
  filterRegistryCandidatesBySymvPlan,
  shouldOfferRegistryAfterReview,
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
});

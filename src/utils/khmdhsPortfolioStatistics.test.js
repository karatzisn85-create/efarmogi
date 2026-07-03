/**
 * @jest-environment node
 */
import { buildKhmdhsPortfolioStatistics } from './khmdhsPortfolioStatistics';

describe('buildKhmdhsPortfolioStatistics', () => {
  const baseProject = {
    subprojectId: 'sp-1',
    projectTitle: 'Έργο Α',
    subprojectTitle: 'Υποέργο 1',
    approvedAmount: '100.000,00',
    projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
    khmdhsRequestAdam: '25REQ000000001',
    khmdhsRequestSnapshot: {
      title: 'Αίτημα',
      referenceNumber: '25REQ000000001',
      totalCostWithVAT: 90000,
    },
    khmdhsNoticeAdam: '25PROC000000001',
    khmdhsNoticeSnapshot: {
      title: 'Δημοσίευση',
      referenceNumber: '25PROC000000001',
      totalCostWithVAT: 85000,
    },
    khmdhsAwardAdam: '25AWRD000000001',
    khmdhsAwardSnapshot: {
      title: 'Ανάθεση',
      referenceNumber: '25AWRD000000001',
      totalCostWithVAT: 84000,
    },
    khmdhsAdam: '25SYMV000000001',
    khmdhsContractSnapshot: {
      title: 'Σύμβαση',
      referenceNumber: '25SYMV000000001',
      contractBudget: 80000,
      contractSignedDate: '2025-06-15',
    },
    khmdhsPayments: [{
      adam: '26PAY000000001',
      snapshot: {
        title: 'Εντάλμα',
        referenceNumber: '26PAY000000001',
        totalCostWithVAT: 40000,
        signedDate: '2025-08-10',
      },
    }],
  };

  it('aggregates funnel and pipeline totals', () => {
    const stats = buildKhmdhsPortfolioStatistics([baseProject]);
    expect(stats.total).toBe(1);
    expect(stats.funnel.REQ).toContain('sp-1');
    expect(stats.funnel.SYMV).toContain('sp-1');
    expect(stats.funnel.PAY).toContain('sp-1');
    expect(stats.pipeline.approved).toBeGreaterThan(0);
    expect(stats.pipeline.symvTotal).toBeGreaterThan(0);
    expect(stats.pipeline.payTotal).toBe(40000);
  });

  it('builds variance rows with execution percentage', () => {
    const stats = buildKhmdhsPortfolioStatistics([baseProject]);
    expect(stats.varianceRows).toHaveLength(1);
    const row = stats.varianceRows[0];
    expect(row.subprojectId).toBe('sp-1');
    expect(row.symvAmount).toBeGreaterThan(0);
    expect(row.payAmount).toBe(40000);
    expect(row.executionPct).toBeGreaterThan(0);
    expect(row.executionPct).toBeLessThanOrEqual(100);
  });

  it('tracks payment amounts by month', () => {
    const stats = buildKhmdhsPortfolioStatistics([baseProject]);
    expect(stats.payByMonthAmounts['2025-08']).toBe(40000);
  });

  it('computes reliability score and attention list', () => {
    const stats = buildKhmdhsPortfolioStatistics([baseProject]);
    expect(stats.reliabilityScore).toBeGreaterThan(0);
    expect(stats.reliabilityScore).toBeLessThanOrEqual(100);
    expect(stats.scoreParts.khmdhsCoverage).toBe(100);
    expect(stats.healthBar.fullChain).toBeDefined();
    expect(Array.isArray(stats.attentionList)).toBe(true);
  });

  it('returns empty metrics for empty list', () => {
    const stats = buildKhmdhsPortfolioStatistics([]);
    expect(stats.total).toBe(0);
    expect(stats.varianceRows).toEqual([]);
    expect(stats.payVsSymvPct).toBeNull();
    expect(stats.reliabilityScore).toBeNull();
    expect(stats.scoreParts).toBeNull();
    expect(stats.attentionList).toEqual([]);
  });

  it('counts full chain without separate COMMIT stage', () => {
    const stats = buildKhmdhsPortfolioStatistics([baseProject]);
    expect(stats.fullChainIds).toContain('sp-1');
  });

  it('does not flag a recently published notice without award as stuck', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const project = {
      subprojectId: 'sp-2',
      projectTitle: 'Έργο Β',
      subprojectTitle: 'Υποέργο 1',
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      khmdhsNoticeAdam: '25PROC000000002',
      khmdhsNoticeSnapshot: {
        referenceNumber: '25PROC000000002',
        finalSubmissionDate: yesterday,
      },
    };
    const stats = buildKhmdhsPortfolioStatistics([project]);
    expect(stats.gaps.proc_no_awrd.map((g) => g.subprojectId)).not.toContain('sp-2');
    expect(stats.stuckIds).not.toContain('sp-2');
    expect(stats.inProgressIds).toContain('sp-2');
  });

  it('flags a notice without award as stuck once the grace period has passed', () => {
    const longAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const project = {
      subprojectId: 'sp-3',
      projectTitle: 'Έργο Γ',
      subprojectTitle: 'Υποέργο 1',
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      khmdhsNoticeAdam: '25PROC000000003',
      khmdhsNoticeSnapshot: {
        referenceNumber: '25PROC000000003',
        finalSubmissionDate: longAgo,
      },
    };
    const stats = buildKhmdhsPortfolioStatistics([project]);
    expect(stats.gaps.proc_no_awrd.map((g) => g.subprojectId)).toContain('sp-3');
    expect(stats.stuckIds).toContain('sp-3');
  });

  it('does not flag a recently awarded project without a contract yet as stuck', () => {
    const recently = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const project = {
      subprojectId: 'sp-4',
      projectTitle: 'Έργο Δ',
      subprojectTitle: 'Υποέργο 1',
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      khmdhsAwardAdam: '25AWRD000000002',
      khmdhsAwardSnapshot: {
        referenceNumber: '25AWRD000000002',
        awardDate: recently,
      },
    };
    const stats = buildKhmdhsPortfolioStatistics([project]);
    expect(stats.gaps.awrd_no_symv.map((g) => g.subprojectId)).not.toContain('sp-4');
    expect(stats.stuckIds).not.toContain('sp-4');
  });

  it('does not flag a recently signed contract without payments yet as stuck', () => {
    const recently = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const project = {
      subprojectId: 'sp-5',
      projectTitle: 'Έργο Ε',
      subprojectTitle: 'Υποέργο 1',
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      khmdhsAdam: '25SYMV000000002',
      khmdhsContractSnapshot: {
        referenceNumber: '25SYMV000000002',
        contractBudget: 50000,
        contractSignedDate: recently,
      },
    };
    const stats = buildKhmdhsPortfolioStatistics([project]);
    expect(stats.gaps.symv_no_pay.map((g) => g.subprojectId)).not.toContain('sp-5');
    expect(stats.stuckIds).not.toContain('sp-5');
  });

  it('portfolio payment total respects manual actual amount corrections', () => {
    const project = {
      subprojectId: 'sp-pay-1',
      projectTitle: 'Έργο ΣΤ',
      subprojectTitle: 'Υποέργο 1',
      khmdhsPayments: [{
        adam: '26PAY000000010',
        snapshot: {
          title: 'Εντάλμα',
          referenceNumber: '26PAY000000010',
          totalCostWithVAT: 40000,
          signedDate: '2025-08-10',
        },
        userActualAmount: 25000,
      }],
    };
    const stats = buildKhmdhsPortfolioStatistics([project]);
    expect(stats.pipeline.payTotal).toBe(25000);
    expect(stats.payByMonthAmounts['2025-08']).toBe(25000);
  });

  it('portfolio payment total excludes cancelled payment orders', () => {
    const project = {
      subprojectId: 'sp-pay-2',
      projectTitle: 'Έργο Ζ',
      subprojectTitle: 'Υποέργο 1',
      khmdhsPayments: [{
        adam: '26PAY000000011',
        snapshot: {
          title: 'Εντάλμα (ακυρωμένο)',
          referenceNumber: '26PAY000000011',
          totalCostWithVAT: 15000,
          signedDate: '2025-09-01',
          cancelled: true,
        },
      }],
    };
    const stats = buildKhmdhsPortfolioStatistics([project]);
    expect(stats.pipeline.payTotal).toBe(0);
    expect(stats.payByMonthAmounts['2025-09']).toBeUndefined();
  });

  it('portfolio payment total excludes documents the user classified as non-counting', () => {
    const project = {
      subprojectId: 'sp-pay-3',
      projectTitle: 'Έργο Η',
      subprojectTitle: 'Υποέργο 1',
      khmdhsPayments: [{
        adam: '26PAY000000012',
        snapshot: {
          title: 'Ενημερωτικό έγγραφο',
          referenceNumber: '26PAY000000012',
          totalCostWithVAT: 12000,
          signedDate: '2025-10-05',
        },
        userDocumentRole: 'informative',
      }],
    };
    const stats = buildKhmdhsPortfolioStatistics([project]);
    expect(stats.pipeline.payTotal).toBe(0);
  });

  it('uses latest annual commitment amount, not sum of all years', () => {
    const project = {
      ...baseProject,
      khmdhsCommitmentDecisions: [
        {
          adam: '24BUDGET001',
          snapshot: {
            referenceNumber: '24BUDGET001',
            totalCostWithVAT: 100000,
            signedDate: '2024-03-01',
          },
        },
        {
          adam: '25BUDGET001',
          snapshot: {
            referenceNumber: '25BUDGET001',
            totalCostWithVAT: 65000,
            signedDate: '2025-03-01',
          },
        },
      ],
    };
    const stats = buildKhmdhsPortfolioStatistics([project]);
    expect(stats.pipeline.commitTotal).toBe(65000);
    expect(stats.pipeline.commitCount).toBe(1);
  });
});

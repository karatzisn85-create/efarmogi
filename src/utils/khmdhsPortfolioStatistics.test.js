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

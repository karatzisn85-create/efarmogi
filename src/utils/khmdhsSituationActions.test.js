/**
 * @jest-environment node
 */
import {
  refineSituationReportForBranchSelection,
  shouldShowKhmdhsSituationModal,
  KHMDHS_SITUATION_ID_PARALLEL_CONTRACTS,
} from './khmdhsSituationActions';

describe('refineSituationReportForBranchSelection', () => {
  const parallelReport = {
    hasSituations: true,
    requiresDecision: true,
    primarySeverity: 'warning',
    situations: [
      { id: KHMDHS_SITUATION_ID_PARALLEL_CONTRACTS, requiresDecision: true, severity: 'warning' },
      { id: 'incomplete_fields', requiresDecision: false, severity: 'info' },
    ],
  };

  test('removes parallel contracts situation after branch selection', () => {
    const refined = refineSituationReportForBranchSelection(parallelReport, {
      userSelectedBranch: true,
    });
    expect(refined.situations).toHaveLength(1);
    expect(refined.situations[0].id).toBe('incomplete_fields');
    expect(refined.requiresDecision).toBe(false);
    expect(shouldShowKhmdhsSituationModal(refined)).toBe(false);
  });

  test('leaves report unchanged without branch selection', () => {
    const refined = refineSituationReportForBranchSelection(parallelReport, {
      userSelectedBranch: false,
    });
    expect(refined).toBe(parallelReport);
    expect(shouldShowKhmdhsSituationModal(refined)).toBe(true);
  });
});

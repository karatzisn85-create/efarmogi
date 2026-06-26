/**
 * @jest-environment node
 */
import {
  branchPickerAllowsAllBranches,
  buildBranchCandidatesFromChainRes,
  inferActRootReqAdam,
  needsBranchPicker,
} from './khmdhsBranchAnchor';

describe('khmdhsBranchAnchor — branch picker', () => {
  test('needsBranchPicker when multiple SYMV roots', () => {
    const candidates = [
      { adam: '23SYMV012797214', type: 'SYMV' },
      { adam: '23SYMV012797999', type: 'SYMV' },
    ];
    expect(needsBranchPicker(candidates)).toBe(true);
    expect(branchPickerAllowsAllBranches(candidates)).toBe(true);
  });

  test('branchPickerAllowsAllBranches false for distinct PROC branches', () => {
    const candidates = [
      { adam: '23PROC012643596', type: 'PROC' },
      { adam: '23PROC012699999', type: 'PROC' },
    ];
    expect(needsBranchPicker(candidates)).toBe(true);
    expect(branchPickerAllowsAllBranches(candidates)).toBe(false);
  });

  test('inferActRootReqAdam prefers chainMeta.actRootReqAdam', () => {
    const chainRes = {
      chainMeta: {
        actRootReqAdam: '23REQ012556069',
        linkedAdams: { requests: ['23REQ012556485'] },
      },
      request: { adam: '23REQ012556485' },
    };
    expect(inferActRootReqAdam(chainRes, '23PROC012643596')).toBe('23REQ012556069');
  });

  test('buildBranchCandidates includes contract root even when filtered from parallelContracts', () => {
    const chainRes = {
      success: true,
      contract: { adam: '22SYMV011799800', snapshot: { title: 'ΔΙΑΚΗΡΥΞΗ' } },
      chainMeta: {
        contractRootAdam: '22SYMV011799800',
        parallelContracts: ['22SYMV011327633', '22SYMV011308661', '24SYMV015482244'],
        parallelContractCandidates: [
          '22SYMV011799800',
          '22SYMV011327633',
          '22SYMV011308661',
          '24SYMV015482244',
        ],
        contractSnapshotsByAdam: {
          '22SYMV011799800': { title: 'ΔΙΑΚΗΡΥΞΗ' },
          '24SYMV015482244': { title: 'ΣΥΜΠΛΗΡΩΜΑΤΙΚΗ' },
        },
      },
    };
    const candidates = buildBranchCandidatesFromChainRes(chainRes);
    const adams = candidates.map((c) => c.adam);
    expect(adams).toContain('22SYMV011799800');
    expect(adams.length).toBeGreaterThanOrEqual(3);
  });
});

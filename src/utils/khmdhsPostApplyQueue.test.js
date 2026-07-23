/**
 * @jest-environment node
 */
import {
  buildPostApplyQueue,
  filterPostApplySituations,
  getFollowUpQueue,
  removeTaskFromQueue,
  POST_APPLY_TASK,
} from './khmdhsPostApplyQueue';

describe('khmdhsPostApplyQueue', () => {
  test('data review comes first and follow-up excludes it', () => {
    const formAfter = {
      projectStatus: 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ',
      khmdhsDataQualityReview: {
        items: [{
          fieldId: 'contractAmount',
          status: 'needs_review',
          label: 'Ποσό',
          contractIndex: null,
        }],
        resolutions: {},
        acknowledgedFieldIds: [],
      },
    };
    const queue = buildPostApplyQueue({
      formAfter,
      dqr: formAfter.khmdhsDataQualityReview,
      stitchPromptBPayload: {
        segments: [
          { seedAdam: '23REQ001', coversStages: ['REQ'] },
          { seedAdam: '24SYMV001', coversStages: ['SYMV'] },
        ],
      },
      apeConflict: { current: '1', suggested: '2' },
      skipExpiry: true,
    });
    expect(queue.needsDataReviewFirst).toBe(true);
    expect(queue.tasks[0].type).toBe(POST_APPLY_TASK.DATA_REVIEW);
    expect(queue.tasks.some((t) => t.type === POST_APPLY_TASK.STITCH_B)).toBe(true);
    expect(queue.tasks.some((t) => t.type === POST_APPLY_TASK.APE)).toBe(true);

    const follow = getFollowUpQueue(queue);
    expect(follow.tasks.every((t) => t.type !== POST_APPLY_TASK.DATA_REVIEW)).toBe(true);
    expect(follow.hasFollowUpTasks).toBe(true);
  });

  test('filters orphan_symv after stitch keep', () => {
    const { shouldShow, filteredReport } = filterPostApplySituations({
      hasSituations: true,
      requiresDecision: false,
      primarySeverity: 'warning',
      situations: [
        { id: 'orphan_symv_seed', severity: 'warning', title: 'Ορφανή' },
        { id: 'other', severity: 'warning', title: 'Άλλο', requiresDecision: true },
      ],
    }, { stitchApplyMode: 'stitch' });
    expect(filteredReport.situations.some((s) => s.id === 'orphan_symv_seed')).toBe(false);
    expect(shouldShow).toBe(true);
  });

  test('removeTaskFromQueue drops completed item', () => {
    const queue = {
      tasks: [
        { id: POST_APPLY_TASK.STITCH_B, type: POST_APPLY_TASK.STITCH_B },
        { id: POST_APPLY_TASK.APE, type: POST_APPLY_TASK.APE },
      ],
      needsDataReviewFirst: false,
      hasFollowUpTasks: true,
    };
    const next = removeTaskFromQueue(queue, POST_APPLY_TASK.STITCH_B);
    expect(next.tasks.map((t) => t.id)).toEqual([POST_APPLY_TASK.APE]);
  });

  test('no empty queue when nothing pending', () => {
    const queue = buildPostApplyQueue({
      formAfter: {
        projectStatus: 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ',
        khmdhsDataQualityReview: { items: [], resolutions: {} },
      },
      skipExpiry: true,
    });
    expect(queue.needsDataReviewFirst).toBe(false);
    expect(queue.hasFollowUpTasks).toBe(false);
    expect(queue.tasks).toHaveLength(0);
  });
});

/**
 * @jest-environment node
 */
const {
  getEffectiveProsklisiDeadline,
} = require('../../public/prosklisiDeadlineHelper');

describe('prosklisiDeadlineHelper (main)', () => {
  test('applies modification deadline over stale root', () => {
    const effective = getEffectiveProsklisiDeadline(
      { deadline: '2019-10-31' },
      [{
        modificationDocumentDate: '2025-10-01',
        changes: {
          deadline: { original: '2019-10-31', current: '2025-12-31' },
        },
      }]
    );
    expect(effective).toBe('2025-12-31');
  });
});

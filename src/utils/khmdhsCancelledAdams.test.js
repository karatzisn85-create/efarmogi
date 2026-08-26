/**
 * @jest-environment node
 */
const {
  collectConfirmedCancelledAdams,
  normalizeCancelledAdam,
} = require('../../public/khmdhsCancelledAdams');

describe('collectConfirmedCancelledAdams', () => {
  test('μαζεύει ΑΔΑΜ από skipped με αστερίσκους και extraAdams χωρίς διπλότυπα', () => {
    const list = collectConfirmedCancelledAdams({
      skippedCancelled: [
        { adam: '25REQ016195999', original: '25REQ016195999**' },
        { adam: '25REQ016195999', original: '25REQ016195999**' },
      ],
      extraAdams: ['26PAY000000002', '26PAY000000002**'],
    });
    expect(list.sort()).toEqual(['25REQ016195999', '26PAY000000002']);
  });

  test('αγνοεί τιμές που δεν είναι ΑΔΑΜ', () => {
    expect(normalizeCancelledAdam('όχι-adam')).toBe('');
    expect(collectConfirmedCancelledAdams({
      extraAdams: ['', null, 'foo'],
    })).toEqual([]);
  });
});

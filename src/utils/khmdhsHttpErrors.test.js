/**
 * @jest-environment node
 */
const {
  friendlyKhmdhsTransientHttpError,
  friendlyKhmdhsInvalidResponseError,
  resolveKhmdhsHttpError,
} = require('../../public/khmdhsHttpErrors');

describe('khmdhsHttpErrors', () => {
  test('429 returns friendly rate-limit message', () => {
    const msg = friendlyKhmdhsTransientHttpError(429);
    expect(msg).toMatch(/πολλά αιτήματα/i);
    expect(msg).toMatch(/επόμενη προσπάθεια/i);
    expect(msg).not.toMatch(/429/);
  });

  test('502/503/504 return temporary server message', () => {
    expect(friendlyKhmdhsTransientHttpError(503)).toMatch(/προσωρινά διαθέσιμος/i);
  });

  test('invalid JSON response maps 429 to friendly message', () => {
    expect(friendlyKhmdhsInvalidResponseError(429)).toMatch(/πολλά αιτήματα/i);
  });

  test('resolveKhmdhsHttpError prefers transient over raw HTTP code', () => {
    expect(resolveKhmdhsHttpError('HTTP 429', 429)).toMatch(/πολλά αιτήματα/i);
  });
});

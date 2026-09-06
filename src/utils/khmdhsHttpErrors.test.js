/**
 * @jest-environment node
 */
const {
  friendlyKhmdhsAdamNotFoundError,
  friendlyKhmdhsOfflineError,
  isKhmdhsNetworkError,
  summarizeKhmdhsFetchFailure,
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

  test('ADAM not found explains portal delay and next steps', () => {
    const msg = friendlyKhmdhsAdamNotFoundError({ adam: '26REQ019495415', kind: 'request' });
    expect(msg).toMatch(/26REQ019495415/);
    expect(msg).toMatch(/αίτημα/i);
    expect(msg).toMatch(/ανοικτά δεδομένα/i);
    expect(msg).toMatch(/μόλις αναρτήθηκε/i);
    expect(msg).toMatch(/δοκιμάστε ξανά αργότερα/i);
    expect(msg).toMatch(/δεν χρειάζεται να διαγράψετε/i);
  });

  test('summarizeKhmdhsFetchFailure shortens not-found for report header', () => {
    const full = friendlyKhmdhsAdamNotFoundError({ adam: '26REQ019495415' });
    expect(summarizeKhmdhsFetchFailure(full)).toMatch(/δεν είναι ακόμα διαθέσιμος/i);
  });

  test('χωρίς διαδίκτυο δεν μοιάζει με αποτυχία ΚΗΜΔΗΣ', () => {
    expect(isKhmdhsNetworkError({ code: 'ENOTFOUND', message: 'getaddrinfo' })).toBe(true);
    expect(friendlyKhmdhsOfflineError()).toMatch(/δεν υπάρχει σύνδεση στο διαδίκτυο/i);
    expect(friendlyKhmdhsOfflineError()).not.toMatch(/ΑΔΑΜ/i);
    expect(summarizeKhmdhsFetchFailure(friendlyKhmdhsOfflineError())).toMatch(/διαδίκτυο/i);
  });

  test('λήξη χρόνου δεν εμφανίζεται ως «χωρίς διαδίκτυο»', () => {
    expect(summarizeKhmdhsFetchFailure('connect ETIMEDOUT')).toMatch(/προσωρινό πρόβλημα/i);
    expect(summarizeKhmdhsFetchFailure('connect ETIMEDOUT')).not.toMatch(/διαδίκτυο/i);
  });
});

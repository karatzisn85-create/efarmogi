/**
 * @jest-environment node
 */
import {
  KHMDHS_SESSION_AUTO_LOCK_SEC,
  evaluateKhmdhsSessionUnlock,
  sameKhmdhsSessionUsername,
  shouldShowKhmdhsSessionLock,
  shouldStartKhmdhsAutoLock,
  shouldDisarmIdleShutdownOnWindowClose,
  applyPendingIdleShutdownArmedOff,
} from './khmdhsSessionLock';

describe('khmdhsSessionLock', () => {
  test('το κουμπί κλειδώματος φαίνεται μόνο όταν έχει ζητηθεί σβήσιμο στο τέλος', () => {
    expect(shouldShowKhmdhsSessionLock({ idleShutdownArmed: true })).toBe(true);
    expect(shouldShowKhmdhsSessionLock({ idleShutdownArmed: false })).toBe(false);
    expect(shouldShowKhmdhsSessionLock({ sessionLocked: true })).toBe(true);
    expect(shouldShowKhmdhsSessionLock({})).toBe(false);
  });

  test('ξεκλείδωμα μόνο από τον ίδιο συνδεδεμένο χρήστη', () => {
    expect(evaluateKhmdhsSessionUnlock({
      locked: true,
      sessionUsername: 'e2eadmin',
      attemptUsername: 'e2eadmin',
    })).toEqual({ ok: true });
    expect(evaluateKhmdhsSessionUnlock({
      locked: true,
      sessionUsername: 'E2EAdmin',
      attemptUsername: 'e2eadmin',
    }).ok).toBe(true);
    expect(evaluateKhmdhsSessionUnlock({
      locked: true,
      sessionUsername: 'e2eadmin',
      attemptUsername: 'maria',
    }).ok).toBe(false);
    expect(evaluateKhmdhsSessionUnlock({
      locked: false,
      sessionUsername: 'e2eadmin',
      attemptUsername: 'maria',
    }).ok).toBe(true);
  });

  test('κενό όνομα δεν θεωρείται ίδιος χρήστης', () => {
    expect(sameKhmdhsSessionUsername('', '')).toBe(false);
    expect(sameKhmdhsSessionUsername('e2eadmin', '')).toBe(false);
  });

  test('μετά την επιβεβαίωση κλειδώνει μόνο του σε λίγα δευτερόλεπτα', () => {
    expect(KHMDHS_SESSION_AUTO_LOCK_SEC).toBe(20);
  });

  test('το Χ του παραθύρου δεν ακυρώνει το σβήσιμο όσο είναι κλειδωμένη', () => {
    expect(shouldDisarmIdleShutdownOnWindowClose({
      sessionLocked: true,
      shutdownPending: true,
    })).toBe(false);
    expect(shouldDisarmIdleShutdownOnWindowClose({
      sessionLocked: false,
      shutdownPending: true,
    })).toBe(true);
    expect(shouldDisarmIdleShutdownOnWindowClose({
      sessionLocked: false,
      shutdownPending: false,
    })).toBe(false);
  });

  test('αν το σβήσιμο ακυρώθηκε όσο έλειπε, μετά το ξεκλείδωμα φεύγει και το κουμπί', () => {
    expect(applyPendingIdleShutdownArmedOff({
      sessionLocked: true,
      pendingArmedOff: true,
    })).toEqual({ accept: false, armed: true, keepPending: true });
    expect(applyPendingIdleShutdownArmedOff({
      sessionLocked: false,
      pendingArmedOff: true,
    })).toEqual({ accept: true, armed: false, keepPending: false });
  });

  test('δεν ξανακλειδώνει μόνο του αφού ο χρήστης ξεκλειδώσει', () => {
    expect(shouldStartKhmdhsAutoLock({
      idleShutdownArmed: true,
      sessionLocked: false,
      alreadyAutoLocked: false,
    })).toBe(true);
    expect(shouldStartKhmdhsAutoLock({
      idleShutdownArmed: true,
      sessionLocked: false,
      alreadyAutoLocked: true,
    })).toBe(false);
    expect(shouldStartKhmdhsAutoLock({
      idleShutdownArmed: true,
      sessionLocked: true,
      alreadyAutoLocked: false,
    })).toBe(false);
  });
});

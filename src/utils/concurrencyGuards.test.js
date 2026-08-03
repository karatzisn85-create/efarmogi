/** @jest-environment node */

const { resolveBusyStatus, detectSaveConflict } = require('../../public/concurrencyGuards');

describe('resolveBusyStatus', () => {
  const locks = {
    'sub-1': { locked: true, lockedBy: 'maria' },
    'proj-1': { locked: true, lockedBy: 'giorgos' },
  };
  const readLock = (key) => locks[key] || { locked: false };

  test('ελεύθερο όταν κανένα κλειδί δεν είναι πιασμένο', () => {
    expect(resolveBusyStatus(['sub-9', 'proj-9'], 'nikos', readLock)).toEqual({ locked: false });
  });

  test('πιασμένο από το κλειδί του υποέργου', () => {
    expect(resolveBusyStatus(['sub-1'], 'nikos', readLock)).toEqual({
      locked: true, lockedBy: 'maria',
    });
  });

  test('πιασμένο από το κλειδί του έργου — η δεύτερη κλειδαριά δεν αγνοείται', () => {
    expect(resolveBusyStatus(['sub-9', 'proj-1'], 'nikos', readLock)).toEqual({
      locked: true, lockedBy: 'giorgos',
    });
  });

  test('ο ίδιος χρήστης δεν μπλοκάρεται από το δικό του κλείδωμα', () => {
    expect(resolveBusyStatus(['sub-1'], 'maria', readLock)).toEqual({ locked: false });
  });

  test('κλείδωμα χωρίς κάτοχο δεν μπλοκάρει', () => {
    const anonymous = () => ({ locked: true, lockedBy: '' });
    expect(resolveBusyStatus(['sub-1'], 'maria', anonymous)).toEqual({ locked: false });
  });

  test('κενά κλειδιά προσπερνιούνται', () => {
    expect(resolveBusyStatus(['', null, 'sub-1'], 'nikos', readLock)).toEqual({
      locked: true, lockedBy: 'maria',
    });
  });
});

describe('detectSaveConflict', () => {
  const A = '2026-08-01T10:00:00.000Z';
  const B = '2026-08-01T11:30:00.000Z';

  test('ίδια έκδοση — καμία σύγκρουση', () => {
    expect(detectSaveConflict(A, A)).toEqual({ conflict: false });
  });

  test('άλλαξε στο μεταξύ — σύγκρουση με την τρέχουσα έκδοση', () => {
    expect(detectSaveConflict(A, B)).toEqual({ conflict: true, updatedAt: B });
  });

  test('χωρίς δηλωμένη έκδοση δεν μπλοκάρεται τίποτα', () => {
    expect(detectSaveConflict(undefined, B)).toEqual({ conflict: false });
    expect(detectSaveConflict('', B)).toEqual({ conflict: false });
  });

  test('νέο υποέργο χωρίς προηγούμενη έκδοση δεν μπλοκάρεται', () => {
    expect(detectSaveConflict(A, undefined)).toEqual({ conflict: false });
  });
});

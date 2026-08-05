/**
 * @jest-environment node
 */
const {
  pickThresholdTriggers,
  isWithinQuietHours,
  resolveRecipients,
} = require('../../public/procurementCalendarReminderService');

const DAYS = [7, 3, 1, 0];

describe('pickThresholdTriggers (catch-up ημερολογίου)', () => {
  test('ακριβής μέρα 7 χωρίς προηγούμενη αποστολή', () => {
    expect(pickThresholdTriggers(7, DAYS, [])).toEqual([7]);
  });

  test('χάθηκε η 7 · άνοιγμα στις 6 → catch-up της 7', () => {
    expect(pickThresholdTriggers(6, DAYS, [])).toEqual([7]);
  });

  test('χάθηκε η 7 · άνοιγμα στις 3 → μόνο η 3 (όχι καθυστερημένη 7)', () => {
    expect(pickThresholdTriggers(3, DAYS, [])).toEqual([3]);
  });

  test('ήδη στάλθηκε η 7 · στις 6 δεν ξαναστέλνει', () => {
    expect(pickThresholdTriggers(6, DAYS, [7])).toEqual([]);
  });

  test('ήδη στάλθηκε η 7 · στις 3 στέλνει την 3', () => {
    expect(pickThresholdTriggers(3, DAYS, [7])).toEqual([3]);
  });

  test('catch-up της 3 στις 2 μέρες πριν (παράθυρο μέχρι την επόμενη)', () => {
    expect(pickThresholdTriggers(2, DAYS, [7])).toEqual([3]);
  });

  test('στις 0 μέρες χωρίς καμία αποστολή → μόνο το κατώφλι 0', () => {
    expect(pickThresholdTriggers(0, DAYS, [])).toEqual([0]);
  });

  test('διπλό άνοιγμα την ίδια μέρα: δεύτερη φορά άδειο', () => {
    expect(pickThresholdTriggers(6, DAYS, [7])).toEqual([]);
    expect(pickThresholdTriggers(7, DAYS, [7])).toEqual([]);
  });

  test('χωρίς αρνητικές / άκυρες τιμές', () => {
    expect(pickThresholdTriggers(-1, DAYS, [])).toEqual([]);
    expect(pickThresholdTriggers(null, DAYS, [])).toEqual([]);
  });

  test('μερική λίστα κατωφλίων [7, 1]', () => {
    expect(pickThresholdTriggers(5, [7, 1], [])).toEqual([7]);
    expect(pickThresholdTriggers(1, [7, 1], [])).toEqual([1]);
    expect(pickThresholdTriggers(1, [7, 1], [7])).toEqual([1]);
  });
});

describe('isWithinQuietHours', () => {
  test('ανενεργό → ποτέ ήσυχες ώρες', () => {
    const noon = new Date(2026, 7, 5, 12, 0, 0);
    expect(isWithinQuietHours({ quietHoursEnabled: false }, noon)).toBe(false);
  });

  test('διανυκτέρευση 22:00–08:00', () => {
    const prefs = { quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '08:00' };
    expect(isWithinQuietHours(prefs, new Date(2026, 7, 5, 23, 0, 0))).toBe(true);
    expect(isWithinQuietHours(prefs, new Date(2026, 7, 5, 3, 0, 0))).toBe(true);
    expect(isWithinQuietHours(prefs, new Date(2026, 7, 5, 10, 0, 0))).toBe(false);
  });
});

describe('resolveRecipients · προσωπικές προτιμήσεις', () => {
  const baseConfig = {
    enabled: true,
    daysBefore: [7, 3, 1, 0],
    eventTypeSettings: {
      deadline: { enabled: true, recipientRoles: ['ADMIN'], recipientUsernames: [] },
    },
  };

  test('αποκλείει χρήστη με calendarEmail: false', () => {
    const users = [
      {
        username: 'admin1',
        role: 'ADMIN',
        email: 'a@example.com',
        active: true,
        approved: true,
        notificationPreferences: { calendarEmail: false },
      },
    ];
    expect(resolveRecipients(baseConfig, users)).toHaveLength(0);
  });

  test('δέχεται χρήστη με calendarEmail ενεργό', () => {
    const users = [
      {
        username: 'admin1',
        role: 'ADMIN',
        email: 'a@example.com',
        active: true,
        approved: true,
        notificationPreferences: { calendarEmail: true },
      },
    ];
    expect(resolveRecipients(baseConfig, users)).toHaveLength(1);
  });
});

/**
 * @jest-environment node
 */
const {
  pickThresholdTriggers,
} = require('../../public/procurementCalendarReminderService');
const {
  reminderKey,
  recipientReminderKey,
  collectAepoBatchesForRecipient,
  resolveRecipientUsers,
  getSentThresholdsForProposal,
} = require('../../public/orimanthiAepoReminderService');

const THRESHOLDS = [90, 60, 30];

describe('ΑΕΠΟ reminders — dedup ανά πρόταση + κατώφλι', () => {
  test('reminderKey δεν εξαρτάται από την ημερομηνία αποστολής', () => {
    expect(reminderKey('prop-1', 30)).toBe('prop-1:30');
    expect(reminderKey('prop-1', 30)).not.toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  test('στις 90 μέρες χωρίς ιστορικό → κατώφλι 90', () => {
    const proposals = [{ id: 'p1', title: 'Α', aepoRenewalDate: offsetIso(90) }];
    const batches = collectAepoBatchesForRecipient(proposals, THRESHOLDS, { sent: {} }, 'a@ex.com');
    expect([...batches.keys()]).toEqual([90]);
    expect(batches.get(90)).toHaveLength(1);
  });

  test('στις 85 μέρες (χάθηκε η 90) → catch-up της 90', () => {
    expect(pickThresholdTriggers(85, THRESHOLDS, [])).toEqual([90]);
    const proposals = [{ id: 'p1', title: 'Α', aepoRenewalDate: offsetIso(85) }];
    const batches = collectAepoBatchesForRecipient(proposals, THRESHOLDS, { sent: {} }, 'a@ex.com');
    expect([...batches.keys()]).toEqual([90]);
  });

  test('ήδη στάλθηκε η 90 · στις 85 δεν ξαναστέλνει', () => {
    const log = { sent: { [recipientReminderKey('a@ex.com', 'p1', 90)]: '2026-01-01T00:00:00.000Z' } };
    const proposals = [{ id: 'p1', title: 'Α', aepoRenewalDate: offsetIso(85) }];
    const batches = collectAepoBatchesForRecipient(proposals, THRESHOLDS, log, 'a@ex.com');
    expect(batches.size).toBe(0);
  });

  test('ήδη στάλθηκε η 90 · στις 60 στέλνει την 60', () => {
    const log = { sent: { [recipientReminderKey('a@ex.com', 'p1', 90)]: '2026-01-01T00:00:00.000Z' } };
    const proposals = [{ id: 'p1', title: 'Α', aepoRenewalDate: offsetIso(60) }];
    const batches = collectAepoBatchesForRecipient(proposals, THRESHOLDS, log, 'a@ex.com');
    expect([...batches.keys()]).toEqual([60]);
  });

  test('παλιό ημερήσιο κλειδί (σήμερα:90) δεν μπλοκάρει σωστό per-proposal send', () => {
    const today = new Date().toISOString().slice(0, 10);
    const log = { sent: { [`${today}:90`]: '2026-01-01T00:00:00.000Z' } };
    const proposals = [{ id: 'p1', title: 'Α', aepoRenewalDate: offsetIso(90) }];
    const batches = collectAepoBatchesForRecipient(proposals, THRESHOLDS, log, 'a@ex.com');
    expect([...batches.keys()]).toEqual([90]);
  });

  test('δεύτερη πρόταση ανεξάρτητη από την πρώτη', () => {
    const log = {
      sent: { [recipientReminderKey('a@ex.com', 'p1', 90)]: '2026-01-01T00:00:00.000Z' },
    };
    const proposals = [
      { id: 'p1', title: 'Α', aepoRenewalDate: offsetIso(90) },
      { id: 'p2', title: 'Β', aepoRenewalDate: offsetIso(90) },
    ];
    const batches = collectAepoBatchesForRecipient(proposals, THRESHOLDS, log, 'a@ex.com');
    expect(batches.get(90).map((p) => p.id)).toEqual(['p2']);
  });
});

describe('ΑΕΠΟ — προτίμηση aepoEmail', () => {
  const config = { aepoReminders: { useAdminEmails: true, recipientEmails: [] } };

  test('αποκλείει admin με aepoEmail: false', () => {
    const users = [
      {
        username: 'admin1',
        role: 'ADMIN',
        email: 'a@example.com',
        active: true,
        approved: true,
        notificationPreferences: { aepoEmail: false },
      },
    ];
    expect(resolveRecipientUsers(config, users)).toHaveLength(0);
  });

  test('δέχεται admin με aepoEmail ενεργό', () => {
    const users = [
      {
        username: 'admin1',
        role: 'ADMIN',
        email: 'a@example.com',
        active: true,
        approved: true,
        notificationPreferences: { aepoEmail: true },
      },
    ];
    expect(resolveRecipientUsers(config, users)).toHaveLength(1);
  });

  test('δέχεται παλιό admin χωρίς πεδία active/approved', () => {
    const users = [
      { username: 'legacy', role: 'ADMIN', email: 'legacy@example.com' },
    ];
    expect(resolveRecipientUsers(config, users)).toHaveLength(1);
  });

  test('αποκλείει ρητά ανενεργό ή μη εγκεκριμένο admin', () => {
    const users = [
      { username: 'off', role: 'ADMIN', email: 'off@example.com', active: false, approved: true },
      { username: 'pend', role: 'ADMIN', email: 'pend@example.com', active: true, approved: false },
    ];
    expect(resolveRecipientUsers(config, users)).toHaveLength(0);
  });
});

describe('getSentThresholdsForProposal', () => {
  test('διαβάζει per-recipient κλειδιά', () => {
    const log = {
      sent: {
        [recipientReminderKey('a@ex.com', 'p1', 90)]: 'x',
        [recipientReminderKey('a@ex.com', 'p1', 60)]: 'y',
      },
    };
    expect(getSentThresholdsForProposal(log, 'a@ex.com', 'p1').sort((a, b) => b - a)).toEqual([90, 60]);
  });
});

function offsetIso(daysFromToday) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

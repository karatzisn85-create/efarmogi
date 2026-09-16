/**
 * @jest-environment node
 */
import { buildAepoCalendarEvents } from './aepoCalendarEvents';
import { CALENDAR_EVENT_TYPES } from './procurementCalendarEvents';

describe('aepoCalendarEvents', () => {
  test('maps AEPO alerts to calendar rows', () => {
    const events = buildAepoCalendarEvents([
      {
        id: 'prop-1',
        title: 'Έργο δοκιμής',
        aepoRenewalDate: '2026-12-15',
        daysLeft: 20,
        status: 'Ενεργό',
        projectCategory: 'Υποδομές',
      },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe(CALENDAR_EVENT_TYPES.AEPO_RENEWAL);
    expect(events[0].orimanthiProposalId).toBe('prop-1');
    expect(events[0].label).toBe('Ανανέωση ΑΕΠΟ');
  });

  test('maps far-future and past AEPO dates onto the calendar day', () => {
    const events = buildAepoCalendarEvents([
      { id: 'far', title: 'Μακρινή', aepoRenewalDate: '2028-03-20', daysLeft: 550 },
      { id: 'past', title: 'Ληγμένη', aepoRenewalDate: '2026-01-02', daysLeft: -5 },
    ]);
    expect(events).toHaveLength(2);
    expect(events.find((e) => e.orimanthiProposalId === 'far').dateKey).toBe('2028-03-20');
    expect(events.find((e) => e.orimanthiProposalId === 'past').urgency).toBe('past');
  });
});

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
});

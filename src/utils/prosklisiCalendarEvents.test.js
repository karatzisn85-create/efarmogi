import { CALENDAR_EVENT_TYPES } from './procurementCalendarEvents';
import {
  buildProsklisiCalendarEvents,
  mapProsklisiToCalendarRow,
  prosklisiDeadlineToIsoDate
} from './prosklisiCalendarEvents';

describe('prosklisiCalendarEvents', () => {
  test('converts greek and iso deadlines to YYYY-MM-DD', () => {
    expect(prosklisiDeadlineToIsoDate('2026-08-15')).toBe('2026-08-15');
    expect(prosklisiDeadlineToIsoDate('15-08-2026')).toBe('2026-08-15');
    expect(prosklisiDeadlineToIsoDate('-')).toBe('');
  });

  test('maps prosklisi with deadline to calendar row', () => {
    const row = mapProsklisiToCalendarRow({
      prosklisiId: 'p1',
      title: 'Πρόσκληση Α',
      deadline: '2026-08-15',
      status: 'Υπό Υποβολή',
      linkedProjects: [{ id: 'x', title: 'Έργο 1' }]
    });
    expect(row).toMatchObject({
      type: CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE,
      prosklisiId: 'p1',
      dateIso: '2026-08-15',
      label: 'Λήξη υποβολής πρόσκλησης',
      projectTitle: 'Έργο 1',
      isProsklisiDeadline: true
    });
  });

  test('skips prosklisi without usable deadline', () => {
    expect(mapProsklisiToCalendarRow({ prosklisiId: 'p2', title: 'Χ', deadline: '' })).toBeNull();
    expect(buildProsklisiCalendarEvents([
      { prosklisiId: 'a', title: 'A', deadline: '2026-09-01' },
      { prosklisiId: 'b', title: 'B', deadline: '' }
    ])).toHaveLength(1);
  });

  test('modification-updated deadline is what the calendar uses', () => {
    const before = mapProsklisiToCalendarRow({
      prosklisiId: 'p1',
      title: 'Π',
      deadline: '2026-07-01'
    });
    const after = mapProsklisiToCalendarRow({
      prosklisiId: 'p1',
      title: 'Π',
      deadline: '2026-12-31'
    });
    expect(before.dateIso).toBe('2026-07-01');
    expect(after.dateIso).toBe('2026-12-31');
  });
});

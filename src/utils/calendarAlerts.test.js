/**
 * @jest-environment node
 */
import { buildCalendarDeadlineAlerts, CALENDAR_TIME_WINDOWS } from './calendarAlerts';
import { CALENDAR_EVENT_TYPES } from './procurementCalendarEvents';

describe('calendarAlerts', () => {
  const sampleEvents = [
    {
      type: CALENDAR_EVENT_TYPES.DEADLINE,
      subprojectId: 'a',
      dateKey: '2026-07-01',
      dateIso: '2026-07-01T12:00:00.000Z',
      daysLeft: 10,
      subprojectTitle: 'Υποέργο Α',
      label: 'Καταληκτική',
      urgency: 'soon',
    },
    {
      type: CALENDAR_EVENT_TYPES.CUSTOM,
      customEventId: 'c1',
      dateKey: '2026-08-01',
      dateIso: '2026-08-01T10:00:00.000Z',
      daysLeft: 45,
      subprojectTitle: 'Εσωτερική εργασία',
      label: 'Ειδοποίηση',
      urgency: 'normal',
      isCustom: true,
    },
    {
      type: CALENDAR_EVENT_TYPES.CONTRACT_END,
      subprojectId: 'b',
      dateKey: '2026-05-01',
      dateIso: '2026-05-01',
      daysLeft: -5,
      subprojectTitle: 'Παλιά λήξη',
      label: 'Λήξη σύμβασης',
      urgency: 'past',
    },
  ];

  test('filters alerts within maxDays window', () => {
    const { alerts: rows } = buildCalendarDeadlineAlerts(sampleEvents, { maxDays: 30 });
    expect(rows).toHaveLength(1);
    expect(rows[0].subprojectId).toBe('a');
  });

  test('excludes past deadlines by default', () => {
    const { alerts: rows } = buildCalendarDeadlineAlerts(sampleEvents, { maxDays: 90, includePast: false });
    expect(rows.some((r) => r.daysLeft < 0)).toBe(false);
  });

  test('includes past when requested', () => {
    const { alerts: rows } = buildCalendarDeadlineAlerts(sampleEvents, { maxDays: 90, includePast: true });
    expect(rows.some((r) => r.daysLeft < 0)).toBe(true);
  });

  test('always includes compliance violations in widget alerts', () => {
    const withCompliance = [
      ...sampleEvents,
      {
        type: CALENDAR_EVENT_TYPES.COMPLIANCE_12M,
        subprojectId: 'v1',
        dateKey: '2020-01-01',
        dateIso: '2020-01-01',
        daysLeft: -400,
        subprojectTitle: 'Παράβαση δοκιμής',
        label: 'Παράβαση κανόνα 12 μηνών',
        complianceSummary: 'Σύνοψη',
        urgency: 'past',
      },
    ];
    const { alerts, totalCount } = buildCalendarDeadlineAlerts(withCompliance, { maxDays: 30, limit: 2 });
    expect(totalCount).toBeGreaterThanOrEqual(2);
    expect(alerts.some((r) => r.type === CALENDAR_EVENT_TYPES.COMPLIANCE_12M)).toBe(true);
  });

  test('defines standard time windows', () => {
    expect(CALENDAR_TIME_WINDOWS.map((w) => w.days)).toEqual([7, 14, 30, 60, 90, 180, 365]);
  });

  test('alert ids differ for multiple contracts on same day', () => {
    const sameDay = '2027-06-01';
    const events = [
      {
        type: CALENDAR_EVENT_TYPES.CONTRACT_END,
        subprojectId: 'sub-x',
        contractIndex: 0,
        adam: 'A1',
        dateKey: sameDay,
        dateIso: sameDay,
        daysLeft: 5,
        subprojectTitle: 'Υποέργο',
        label: 'Λήξη σύμβασης',
      },
      {
        type: CALENDAR_EVENT_TYPES.CONTRACT_END,
        subprojectId: 'sub-x',
        contractIndex: 1,
        adam: 'A2',
        dateKey: sameDay,
        dateIso: sameDay,
        daysLeft: 5,
        subprojectTitle: 'Υποέργο',
        label: 'Λήξη σύμβασης',
      },
    ];
    const { alerts } = buildCalendarDeadlineAlerts(events, { maxDays: 30 });
    expect(alerts).toHaveLength(2);
    expect(alerts[0].id).not.toBe(alerts[1].id);
  });
});

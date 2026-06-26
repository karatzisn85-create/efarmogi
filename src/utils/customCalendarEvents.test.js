/**
 * @jest-environment node
 */
import {
  userCanSeeCustomEvent,
  buildCustomCalendarEvents,
  describeCustomVisibility,
} from './customCalendarEvents';
import { CALENDAR_EVENT_TYPES } from './procurementCalendarEvents';

describe('customCalendarEvents', () => {
  const baseEvent = {
    id: 'evt-1',
    title: 'Ειδοποίηση υπηρεσίας',
    description: 'Λεπτομέρειες',
    dateIso: '2026-12-01T10:00:00.000Z',
    visibilityRoles: ['ENGINEER'],
    visibilityUsernames: [],
    createdBy: 'admin',
    createdByFullName: 'Admin User',
  };

  test('empty visibility means everyone can see the event', () => {
    const ev = { ...baseEvent, visibilityRoles: [], visibilityUsernames: [] };
    expect(userCanSeeCustomEvent(ev, { username: 'user1', role: 'USER' }, { adminSeesAll: false })).toBe(true);
  });

  test('role-restricted event is hidden from other roles', () => {
    expect(userCanSeeCustomEvent(baseEvent, { username: 'user1', role: 'USER' }, { adminSeesAll: false })).toBe(false);
    expect(userCanSeeCustomEvent(baseEvent, { username: 'eng1', role: 'ENGINEER' }, { adminSeesAll: false })).toBe(true);
  });

  test('username visibility works alongside roles', () => {
    const ev = { ...baseEvent, visibilityRoles: [], visibilityUsernames: ['user1'] };
    expect(userCanSeeCustomEvent(ev, { username: 'user1', role: 'USER' }, { adminSeesAll: false })).toBe(true);
    expect(userCanSeeCustomEvent(ev, { username: 'user2', role: 'USER' }, { adminSeesAll: false })).toBe(false);
  });

  test('admins see all events when adminSeesAll is enabled', () => {
    expect(userCanSeeCustomEvent(baseEvent, { username: 'admin', role: 'ADMIN' }, { adminSeesAll: true })).toBe(true);
  });

  test('admins respect visibility unless they created the event', () => {
    const byOther = { ...baseEvent, createdBy: 'otheradmin' };
    expect(userCanSeeCustomEvent(byOther, { username: 'admin', role: 'ADMIN' })).toBe(false);
    expect(userCanSeeCustomEvent(
      { ...baseEvent, createdBy: 'admin' },
      { username: 'admin', role: 'ADMIN' }
    )).toBe(true);
  });

  test('maps custom events to calendar rows', () => {
    const rows = buildCustomCalendarEvents([baseEvent]);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe(CALENDAR_EVENT_TYPES.CUSTOM);
    expect(rows[0].subprojectTitle).toBe('Ειδοποίηση υπηρεσίας');
  });

  test('describeCustomVisibility summarizes audience', () => {
    expect(describeCustomVisibility({ visibilityRoles: [], visibilityUsernames: [] })).toBe('Όλοι οι χρήστες');
    expect(describeCustomVisibility({ visibilityRoles: ['ADMIN'], visibilityUsernames: ['eng1'] }))
      .toContain('Διαχειριστές');
  });
});

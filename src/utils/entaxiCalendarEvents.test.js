/**
 * @jest-environment node
 */
import { CALENDAR_EVENT_TYPES } from './procurementCalendarEvents';
import {
  buildEntaxiCalendarEvents,
  mapEntaxiToCalendarRow,
} from './entaxiCalendarEvents';

describe('entaxiCalendarEvents', () => {
  test('maps ένταξη with NoDe to calendar row', () => {
    const row = mapEntaxiToCalendarRow({
      entaxiId: 'ent-1',
      subject: 'Ένταξη μελέτης Αρχανών',
      projectTitle: 'Ανάπλαση Αρχανών',
      opsCode: '5225302',
      legalCommitmentDeadline: '2025-02-24',
      diavgeiaAda: 'ΨΩΚΖ7ΛΚ-8ΦΤ',
    });
    expect(row).toMatchObject({
      type: CALENDAR_EVENT_TYPES.ENTAXI_NODE_DEADLINE,
      entaxiId: 'ent-1',
      dateIso: '2025-02-24',
      label: 'Προθεσμία νομικής δέσμευσης (NoΔε)',
      projectTitle: 'Ανάπλαση Αρχανών',
      isEntaxiNodeDeadline: true,
    });
    expect(row.description).toContain('5225302');
  });

  test('skips ένταξη without NoDe date', () => {
    expect(mapEntaxiToCalendarRow({ entaxiId: 'ent-2', subject: 'Χ' })).toBeNull();
    expect(buildEntaxiCalendarEvents([
      { entaxiId: 'a', subject: 'A', legalCommitmentDeadline: '2026-09-01' },
      { entaxiId: 'b', subject: 'B' },
    ])).toHaveLength(1);
  });

  test('puts λήξη πράξης on the calendar even without NoΔε', () => {
    const events = buildEntaxiCalendarEvents([{
      entaxiId: 'ent-kifi',
      subject: 'Προμήθεια μέσου μεταφοράς ΚΗΦΗ',
      endDate: '2029-08-31',
    }]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: CALENDAR_EVENT_TYPES.ENTAXI_END_DATE,
      dateIso: '2029-08-31',
      label: 'Λήξη πράξης ένταξης',
      isEntaxiEndDate: true,
    });
  });

  test('μία ένταξη με ΝοΔε και λήξη δίνει δύο εγγραφές', () => {
    const events = buildEntaxiCalendarEvents([{
      entaxiId: 'ent-both',
      subject: 'Πράξη',
      legalCommitmentDeadline: '2026-09-01',
      endDate: '2029-08-31',
    }]);
    expect(events.map((e) => e.type).sort()).toEqual([
      CALENDAR_EVENT_TYPES.ENTAXI_END_DATE,
      CALENDAR_EVENT_TYPES.ENTAXI_NODE_DEADLINE,
    ].sort());
  });

  test('uses the latest modification NoDe date', () => {
    const row = mapEntaxiToCalendarRow({
      entaxiId: 'ent-3',
      subject: 'Πράξη',
      legalCommitmentDeadline: '2025-02-24',
      modifications: [
        { date: '2025-03-01', legalCommitmentDeadline: '2025-08-31' },
      ],
    });
    expect(row.dateIso).toBe('2025-08-31');
  });
});

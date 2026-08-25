/**
 * @jest-environment node
 */
import { buildContractorRadarCalendarEvents } from './contractorRadarCalendarEvents';
import { CALENDAR_EVENT_TYPES } from './procurementCalendarEvents';

describe('contractorRadarCalendarEvents', () => {
  const projects = [{
    projectId: 'p1',
    subprojectId: 'sub-a',
    projectTitle: 'Έργο',
    subprojectTitle: 'Ύδρευση',
    projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
    contracts: [{ anadoxosName: 'ΤΕΧΝΙΚΗ Α.Ε.', anadoxosAfm: '123456789', amount: '1000' }],
  }];
  const records = [{
    id: 'rec-1',
    name: 'ΤΕΧΝΙΚΗ Α.Ε.',
    vat: '123456789',
    identityKey: 'vat:123456789',
    guarantees: [{
      id: 'g1',
      type: 'καλής εκτέλεσης',
      status: 'ενεργή',
      expiresOn: '2026-09-10',
      subprojectId: 'sub-a',
    }],
    acceptances: [],
  }];

  test('διαχειριστής βλέπει λήξη εγγυητικής στο ραντάρ', () => {
    const events = buildContractorRadarCalendarEvents({
      projects,
      records,
      role: 'ADMIN',
      todayIso: '2026-08-24',
      warnDays: 30,
      urgentDays: 7,
    });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe(CALENDAR_EVENT_TYPES.CONTRACTOR_REGISTRY);
    expect(events[0].contractorName).toBe('ΤΕΧΝΙΚΗ Α.Ε.');
  });

  test('ανάγνωση δεν παίρνει ειδοποίηση', () => {
    const events = buildContractorRadarCalendarEvents({
      projects,
      records,
      role: 'USER',
      todayIso: '2026-08-24',
      warnDays: 30,
    });
    expect(events).toHaveLength(0);
  });

  test('μηχανικός μόνο χρεωμένα υποέργα', () => {
    const events = buildContractorRadarCalendarEvents({
      projects,
      records,
      role: 'ENGINEER',
      visibleSubprojectIds: new Set(['sub-z']),
      todayIso: '2026-08-24',
      warnDays: 30,
    });
    expect(events).toHaveLength(0);
    const own = buildContractorRadarCalendarEvents({
      projects,
      records,
      role: 'ENGINEER',
      visibleSubprojectIds: new Set(['sub-a']),
      todayIso: '2026-08-24',
      warnDays: 30,
    });
    expect(own).toHaveLength(1);
  });
});

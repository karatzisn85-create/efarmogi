/**
 * @jest-environment node
 */
import {
  buildProcurementCalendarEvents,
  filterCalendarEventsByType,
  eventsWithinDays,
  CALENDAR_EVENT_TYPES,
  resolveContractEndDateIso,
  calendarEventRowKey,
  isDateOnlyCalendarIso,
  formatEventDateTime,
} from './procurementCalendarEvents';

const futureDeadline = () => {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString();
};

const futureEnd = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
};

describe('procurementCalendarEvents', () => {
  const activeNoticeProject = {
    subprojectId: 'sub-1',
    projectId: 'proj-1',
    subprojectTitle: 'Δοκιμαστικό υποέργο',
    projectTitle: 'Έργο',
    projectStatus: 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ',
    khmdhsNoticeAdam: '24PROC000000001',
    khmdhsNoticeSnapshot: {
      title: 'Προκήρυξη δοκιμής',
      referenceNumber: '24PROC000000001',
      finalSubmissionDate: futureDeadline(),
      offersValidTime: 3,
      offersValidTimeUnit: 'μήνες',
      cancelled: false,
    },
  };

  const signedProject = {
    subprojectId: 'sub-2',
    projectId: 'proj-2',
    subprojectTitle: 'Υποέργο με σύμβαση',
    projectTitle: 'Έργο 2',
    projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
    contractAmount: '50.000,00',
    contractDate: '2024-01-15',
    contractEndDate: futureEnd(),
    khmdhsAdam: '24SYMV000000002',
    khmdhsContractSnapshot: {
      referenceNumber: '24SYMV000000002',
      endDate: futureEnd(),
      noEndDate: false,
    },
  };

  test('builds notice deadline and offers expiry from ΚΗΜΔΗΣ snapshot', () => {
    const events = buildProcurementCalendarEvents([activeNoticeProject], { userRole: 'ADMIN' });
    const types = events.map((e) => e.type);
    expect(types).toContain(CALENDAR_EVENT_TYPES.DEADLINE);
    expect(types).toContain(CALENDAR_EVENT_TYPES.OFFERS_EXPIRY);
  });

  test('offers expiry uses months from ΚΗΜΔΗΣ unit (not days)', () => {
    const project = {
      ...activeNoticeProject,
      khmdhsNoticeSnapshot: {
        ...activeNoticeProject.khmdhsNoticeSnapshot,
        finalSubmissionDate: '2026-08-07T14:00:00',
        offersValidTime: 12,
        offersValidTimeUnit: 'Μήνες',
      },
    };
    const events = buildProcurementCalendarEvents([project], { userRole: 'ADMIN' });
    const expiry = events.find((e) => e.type === CALENDAR_EVENT_TYPES.OFFERS_EXPIRY);
    expect(expiry).toBeTruthy();
    expect(expiry.dateKey).toBe('2027-08-07');
  });

  test('offers expiry understands ΚΗΜΔΗΣ numeric unit code 3 = months', () => {
    const project = {
      ...activeNoticeProject,
      khmdhsNoticeSnapshot: {
        ...activeNoticeProject.khmdhsNoticeSnapshot,
        finalSubmissionDate: '2026-08-07T14:00:00',
        offersValidTime: 12,
        offersValidTimeUnit: '3',
      },
    };
    const events = buildProcurementCalendarEvents([project], { userRole: 'ADMIN' });
    const expiry = events.find((e) => e.type === CALENDAR_EVENT_TYPES.OFFERS_EXPIRY);
    expect(expiry?.dateKey).toBe('2027-08-07');
  });

  test('skips offers expiry when unit is missing (no day-guess)', () => {
    const project = {
      ...activeNoticeProject,
      khmdhsNoticeSnapshot: {
        ...activeNoticeProject.khmdhsNoticeSnapshot,
        finalSubmissionDate: '2026-08-07T14:00:00',
        offersValidTime: 12,
        offersValidTimeUnit: null,
      },
    };
    const events = buildProcurementCalendarEvents([project], { userRole: 'ADMIN' });
    expect(events.some((e) => e.type === CALENDAR_EVENT_TYPES.DEADLINE)).toBe(true);
    expect(events.some((e) => e.type === CALENDAR_EVENT_TYPES.OFFERS_EXPIRY)).toBe(false);
  });

  test('builds contract end date for signed projects', () => {
    const events = buildProcurementCalendarEvents([signedProject], { userRole: 'ADMIN' });
    expect(events.some((e) => e.type === CALENDAR_EVENT_TYPES.CONTRACT_END)).toBe(true);
  });

  test('deadlines filter includes both submission deadline and offers expiry', () => {
    const events = buildProcurementCalendarEvents([activeNoticeProject], { userRole: 'ADMIN' });
    const filtered = filterCalendarEventsByType(events, 'deadlines');
    expect(filtered.some((e) => e.type === CALENDAR_EVENT_TYPES.DEADLINE)).toBe(true);
    expect(filtered.some((e) => e.type === CALENDAR_EVENT_TYPES.OFFERS_EXPIRY)).toBe(true);
  });

  test('contracts filter shows only contract end events', () => {
    const events = buildProcurementCalendarEvents(
      [activeNoticeProject, signedProject],
      { userRole: 'ADMIN' }
    );
    const filtered = filterCalendarEventsByType(events, 'contracts');
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((e) => e.type === CALENDAR_EVENT_TYPES.CONTRACT_END)).toBe(true);
  });

  test('resolveContractEndDateIso uses chain extension when project end date is empty', () => {
    const end = resolveContractEndDateIso({
      khmdhsContractChainHistory: [
        { adam: '24SYMV001', isRoot: true, order: 0, endDate: '2024-12-31' },
        { adam: '24SYMV002', isRoot: false, order: 1, kind: 'extension', endDate: '2025-09-30' },
      ],
      khmdhsDataQualityReview: {
        items: [],
        resolutions: {
          'chainKindReview:24SYMV002': {
            value: 'extension',
            source: 'user_confirmed',
          },
        },
      },
    });
    expect(end).toBe('2025-09-30');
  });

  test('USER role sees all project deadlines', () => {
    const events = buildProcurementCalendarEvents([activeNoticeProject], { userRole: 'USER' });
    expect(events.some((e) => e.type === CALENDAR_EVENT_TYPES.DEADLINE)).toBe(true);
  });

  test('ENGINEER role filters to assigned subprojects only', () => {
    const engineerProject = { ...activeNoticeProject, subprojectId: 'eng-sub', supervisorEngineerIds: ['eng1'] };
    const otherProject = {
      ...activeNoticeProject,
      subprojectId: 'other-sub',
      supervisorEngineerIds: ['other-eng'],
    };
    const events = buildProcurementCalendarEvents(
      [engineerProject, otherProject],
      {
        userRole: 'ENGINEER',
        currentUser: { username: 'eng1', assignedSupervisors: [] },
        engineerCatalog: [{ username: 'eng1', fullName: 'Eng 1' }],
      }
    );
    const ids = new Set(events.map((e) => e.subprojectId));
    expect(ids.has('eng-sub')).toBe(true);
    expect(ids.has('other-sub')).toBe(false);
  });

  test('eventsWithinDays always includes compliance violations', () => {
    const events = [
      {
        type: CALENDAR_EVENT_TYPES.COMPLIANCE_12M,
        subprojectId: 'x',
        daysLeft: -200,
        dateIso: '2020-01-01',
      },
      {
        type: CALENDAR_EVENT_TYPES.DEADLINE,
        subprojectId: 'y',
        daysLeft: -200,
        dateIso: '2020-01-01',
      },
    ];
    const inWindow = eventsWithinDays(events, 30, { includePastDeadlines: false });
    expect(inWindow.some((e) => e.type === CALENDAR_EVENT_TYPES.COMPLIANCE_12M)).toBe(true);
    expect(inWindow.some((e) => e.type === CALENDAR_EVENT_TYPES.DEADLINE)).toBe(false);
  });

  test('resolveContractEndDateIso prefers per-contract snapshot', () => {
    const end = resolveContractEndDateIso(
      { contractEndDate: '2026-12-31' },
      { khmdhsContractSnapshot: { endDate: '2027-03-15', noEndDate: false } }
    );
    expect(end).toBe('2027-03-15');
  });

  test('resolveContractEndDateIso uses stored per-contract end date', () => {
    const end = resolveContractEndDateIso(
      { contractEndDate: '2026-12-31' },
      { contractEndDate: '2027-06-01', khmdhsContractSnapshot: null }
    );
    expect(end).toBe('2027-06-01');
  });

  test('resolveContractEndDateIso prefers later supplementary extension date over contractEndDate', () => {
    const end = resolveContractEndDateIso({
      contractEndDate: '2025-08-14',
      supplementaryContracts: [
        {
          date: '2026-08-14',
          khmdhsAdam: '25SYMV017748918',
          comments: 'Παράταση',
        },
      ],
      khmdhsContractChainHistory: [
        { adam: '24SYMV001', isRoot: true, order: 0, endDate: '2025-08-14' },
        { adam: '25SYMV017748918', isRoot: false, order: 1, kind: 'extension', endDate: '2025-08-14' },
      ],
      khmdhsDataQualityReview: {
        items: [],
        resolutions: {
          'chainKindReview:25SYMV017748918': {
            value: 'extension',
            source: 'user_confirmed',
            meta: { endDate: '2025-08-14' },
          },
        },
      },
    });
    expect(end).toBe('2026-08-14');
  });

  test('resolveContractEndDateIso uses latest of multiple extensions', () => {
    const end = resolveContractEndDateIso({
      contractEndDate: '2024-08-14',
      supplementaryContracts: [
        {
          date: '2025-08-14',
          khmdhsAdam: '25SYMV001',
          comments: 'Παράταση',
        },
        {
          date: '2026-08-14',
          khmdhsAdam: '25SYMV002',
          comments: 'Παράταση',
        },
      ],
      khmdhsContractChainHistory: [
        { adam: '24SYMV000', isRoot: true, order: 0, endDate: '2024-08-14' },
        { adam: '25SYMV001', isRoot: false, order: 1, kind: 'extension', endDate: '2025-08-14' },
        { adam: '25SYMV002', isRoot: false, order: 2, kind: 'extension', endDate: '2025-08-14' },
      ],
      khmdhsDataQualityReview: {
        items: [],
        resolutions: {
          'chainKindReview:25SYMV001': {
            value: 'extension',
            source: 'user_confirmed',
            meta: { endDate: '2025-08-14' },
          },
          'chainKindReview:25SYMV002': {
            value: 'extension',
            source: 'user_confirmed',
            meta: { endDate: '2025-08-14' },
          },
        },
      },
    });
    expect(end).toBe('2026-08-14');
  });

  test('resolveContractEndDateIso includes manual (χειροκίνητη) contract extension', () => {
    const end = resolveContractEndDateIso({
      implementationForm: 'Μια Σύμβαση',
      contractEndDate: '2025-08-14',
      contractExtensions: [
        { id: 'ext-1', newEndDate: '2026-02-28', documentDate: '2025-12-01', comments: 'Απόφαση Δημάρχου' },
      ],
    });
    expect(end).toBe('2026-02-28');
  });

  test('resolveContractEndDateIso picks the latest date between manual extension and ΚΗΜΔΗΣ extension', () => {
    const end = resolveContractEndDateIso({
      contractEndDate: '2024-08-14',
      contractExtensions: [
        { id: 'ext-1', newEndDate: '2025-05-01', documentDate: '2025-01-01' },
      ],
      khmdhsContractChainHistory: [
        { adam: '24SYMV000', isRoot: true, order: 0, endDate: '2024-08-14' },
        { adam: '25SYMV001', isRoot: false, order: 1, kind: 'extension', endDate: '2026-08-14' },
      ],
      khmdhsDataQualityReview: {
        items: [],
        resolutions: {
          'chainKindReview:25SYMV001': {
            value: 'extension',
            source: 'user_confirmed',
            meta: { endDate: '2026-08-14' },
          },
        },
      },
    });
    expect(end).toBe('2026-08-14');
  });

  test('resolveContractEndDateIso reads contractExtensions per-contract in Πολλές Συμβάσεις', () => {
    const end = resolveContractEndDateIso(
      { implementationForm: 'Πολλές Συμβάσεις', contracts: [] },
      { contractEndDate: '2025-01-01', contractExtensions: [{ id: 'e1', newEndDate: '2025-11-11' }] }
    );
    expect(end).toBe('2025-11-11');
  });

  test('calendarEventRowKey distinguishes multi-contract same day', () => {
    const base = { type: CALENDAR_EVENT_TYPES.CONTRACT_END, subprojectId: 'sub-1', dateKey: '2027-01-15' };
    const k1 = calendarEventRowKey({ ...base, contractIndex: 0, adam: 'ADAM-1' });
    const k2 = calendarEventRowKey({ ...base, contractIndex: 1, adam: 'ADAM-2' });
    expect(k1).not.toBe(k2);
  });

  test('formatEventDateTime hides time for date-only custom iso', () => {
    expect(isDateOnlyCalendarIso('2026-08-01T12:00:00.000Z')).toBe(true);
    const label = formatEventDateTime('2026-08-01T12:00:00.000Z');
    expect(label).not.toMatch(/\d{1,2}:\d{2}/);
  });
});

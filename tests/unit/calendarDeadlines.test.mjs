import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const cal = require('../../app/core/calendarDeadlines.js');

function isoDaysFromToday(offset) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return cal.toDateKey(d);
}

test('πρόσκληση χωρίς ημερομηνία δεν μπαίνει στο ημερολόγιο', () => {
  assert.equal(cal.mapProsklisiToCalendarRow({ prosklisiId: 'p', title: 'Χ', deadline: '' }), null);
  assert.equal(cal.prosklisiDeadlineToIsoDate('15-08-2026'), '2026-08-15');
});

test('παράθυρο ημερών αποκλείει μακρινές προθεσμίες', () => {
  const events = [
    { type: cal.CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE, daysLeft: 5, dateIso: isoDaysFromToday(5) },
    { type: cal.CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE, daysLeft: 200, dateIso: isoDaysFromToday(200) },
  ];
  const month = cal.eventsWithinDays(events, 30);
  assert.equal(month.length, 1);
  assert.equal(month[0].daysLeft, 5);
});

test('φίλτρο τύπου προσκλήσεων', () => {
  const events = [
    { type: cal.CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE, prosklisiId: 'a' },
    { type: cal.CALENDAR_EVENT_TYPES.CUSTOM, customEventId: 'b' },
  ];
  assert.equal(cal.filterCalendarEventsByType(events, 'proskliseis').length, 1);
  assert.equal(cal.filterCalendarEventsByType(events, 'custom').length, 1);
});

test('ραντάρ: εντός παραθύρου, χωρίς παρελθόν', () => {
  const events = [
    { type: cal.CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE, daysLeft: 10, subprojectTitle: 'Κοντά', dateIso: isoDaysFromToday(10) },
    { type: cal.CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE, daysLeft: 80, subprojectTitle: 'Μακριά', dateIso: isoDaysFromToday(80) },
    { type: cal.CALENDAR_EVENT_TYPES.CONTRACT_END, daysLeft: -3, subprojectTitle: 'Παλιά', dateIso: isoDaysFromToday(-3) },
  ];
  const { alerts } = cal.buildCalendarDeadlineAlerts(events, { maxDays: 30, limit: 0 });
  assert.deepEqual(alerts.map((a) => a.title), ['Κοντά']);
});

test('ειδοποίηση μόνο για μηχανικούς κρύβεται από απλό χρήστη', () => {
  const ev = {
    id: 'evt-eng',
    title: 'Μόνο μηχανικοί',
    dateIso: isoDaysFromToday(3),
    visibilityRoles: ['ENGINEER'],
    createdBy: 'admin',
  };
  assert.equal(cal.userCanSeeCustomEvent(ev, { username: 'viewer', role: 'USER' }), false);
  assert.equal(cal.userCanSeeCustomEvent(ev, { username: 'maria', role: 'ENGINEER' }), true);
  assert.equal(cal.userCanSeeCustomEvent(ev, { username: 'admin', role: 'ADMIN' }), true);
});

test('καταληκτική ΚΗΜΔΗΣ: ενεργή προκήρυξη, όχι ακυρωμένη', () => {
  const tender = {
    subprojectId: 'sub-tender',
    projectStatus: 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ',
    subprojectTitle: 'Διαγωνισμός Η/Υ',
    khmdhsNoticeAdam: '24PROC1',
    khmdhsNoticeSnapshot: {
      title: 'Προκήρυξη',
      referenceNumber: '24PROC1',
      finalSubmissionDate: isoDaysFromToday(10),
      offersValidTime: 3,
      offersValidTimeUnit: 'μήνες',
      cancelled: false,
    },
  };
  const events = cal.buildNoticeDeadlineCalendarEvents(tender);
  assert.equal(events.some((e) => e.type === cal.CALENDAR_EVENT_TYPES.DEADLINE), true);
  assert.equal(events.some((e) => e.type === cal.CALENDAR_EVENT_TYPES.OFFERS_EXPIRY), true);
  assert.deepEqual(cal.buildNoticeDeadlineCalendarEvents({
    ...tender,
    khmdhsNoticeSnapshot: { ...tender.khmdhsNoticeSnapshot, cancelled: true },
  }), []);
});

test('επανέκδοση κρίκου: νεότερη ενεργή δημοσίευση υπερισχύει της παλιάς προθεσμίας', () => {
  const base = {
    subprojectId: 'sub-reissue',
    projectStatus: 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ',
    subprojectTitle: 'Επαναδημοσίευση',
    khmdhsNoticeAdam: '26PROC_OLD',
    khmdhsNoticeSnapshot: {
      title: 'Παλιά προκήρυξη',
      referenceNumber: '26PROC_OLD',
      noticeType: 'Προκήρυξη',
      signedDate: '2026-08-10T00:00:00',
      finalSubmissionDate: '2026-09-07T14:00:00',
      cancelled: false,
    },
    khmdhsAdamChainMeta: {
      noticeSnapshotsByAdam: {
        '26PROC_NEW': {
          title: 'Νέα επανέκδοση',
          referenceNumber: '26PROC_NEW',
          noticeType: 'Διακήρυξη',
          signedDate: '2026-08-25T00:00:00',
          finalSubmissionDate: '2026-09-14T14:00:00',
          cancelled: false,
        },
      },
    },
  };

  // Η κύρια δημοσίευση παραμένει η παλιά (7/9), αλλά η ισχύουσα προθεσμία ακολουθεί
  // τη νεότερη ενεργή επανέκδοση (14/9) — χωρίς να χρειάζεται ακύρωση της παλιάς.
  const eff = cal.resolveEffectiveNoticeSnapshot(base);
  assert.equal(eff.referenceNumber, '26PROC_NEW');
  const deadline = cal.buildNoticeDeadlineCalendarEvents(base)
    .find((e) => e.type === cal.CALENDAR_EVENT_TYPES.DEADLINE);
  assert.equal(deadline.dateIso, '2026-09-14T14:00:00');

  const onlyInMap = {
    subprojectId: 'sub-map',
    projectStatus: 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ',
    subprojectTitle: 'Μόνο στον χάρτη',
    khmdhsNoticeAdam: '',
    khmdhsNoticeSnapshot: null,
    khmdhsAdamChainMeta: {
      noticeSnapshotsByAdam: {
        '26PROC_NEW': {
          title: 'Νέα επανέκδοση',
          referenceNumber: '26PROC_NEW',
          signedDate: '2026-08-25T00:00:00',
          finalSubmissionDate: '2026-09-14T14:00:00',
          cancelled: false,
        },
      },
    },
  };
  assert.equal(cal.isActiveProcurementProject(onlyInMap), true);
  assert.equal(
    cal.buildNoticeDeadlineCalendarEvents(onlyInMap)
      .find((e) => e.type === cal.CALENDAR_EVENT_TYPES.DEADLINE).dateIso,
    '2026-09-14T14:00:00'
  );

  // Αν η νεότερη επανέκδοση ματαιωθεί, επιστρέφουμε στην παλιά ενεργή προθεσμία.
  const withCancelledReissue = {
    ...base,
    khmdhsAdamChainMeta: {
      noticeSnapshotsByAdam: {
        '26PROC_NEW': { ...base.khmdhsAdamChainMeta.noticeSnapshotsByAdam['26PROC_NEW'], cancelled: true },
      },
    },
  };
  assert.equal(cal.resolveEffectiveNoticeSnapshot(withCancelledReissue).referenceNumber, '26PROC_OLD');
});

test('λήξη σύμβασης: χρειάζεται ποσό· χωρίς ποσό δεν μπαίνει', () => {
  const signed = {
    subprojectId: 'sub-signed',
    subprojectTitle: 'Σύμβαση φωτισμού',
    contractAmount: '50.000,00',
    contractEndDate: isoDaysFromToday(20),
  };
  assert.equal(cal.buildSimpleContractEndCalendarEvents(signed).length, 1);
  assert.equal(cal.buildSimpleContractEndCalendarEvents({
    ...signed,
    contractAmount: '0',
  }).length, 0);
  assert.equal(cal.buildSimpleContractEndCalendarEvents({
    ...signed,
    projectStatus: 'ΑΠΕΝΤΑΓΜΕΝΟ',
  }).length, 0);
});

test('ειδοποίηση: τίτλος και ημερομηνία· χωρίς ώρα μεσημέρι UTC', () => {
  const empty = cal.collectCustomEventRequiredErrors({});
  assert.equal(empty.title, 'Συμπληρώστε τίτλο.');
  assert.equal(empty.date, 'Επιλέξτε ημερομηνία.');
  assert.deepEqual(cal.collectCustomEventRequiredErrors({ title: 'ΕΑΔΗΣΥ', date: '2026-09-01' }), {});
  assert.equal(cal.isoFromDateAndTime('2026-09-01', ''), '2026-09-01T12:00:00.000Z');
  assert.equal(cal.canCreateCustomCalendarEvent({ role: 'ADMIN', username: 'admin' }), true);
  assert.equal(cal.canCreateCustomCalendarEvent({ role: 'ENGINEER', username: 'maria' }), false);
});

test('μηχανικός βλέπει στο ημερολόγιο μόνο χρεωμένα υποέργα', () => {
  const projects = [
    { subprojectId: 'a', supervisorEngineerIds: ['user:maria'] },
    { subprojectId: 'b', supervisorEngineerIds: ['user:nikos'] },
  ];
  const visible = cal.filterProjectsForCalendar(projects, {
    userRole: 'ENGINEER',
    currentUser: { username: 'maria', role: 'ENGINEER' },
  });
  assert.deepEqual(visible.map((p) => p.subprojectId), ['a']);
});

test('ραντάρ αναδόχου: έληξε η ενεργή εγγυητική μένει στη λίστα', () => {
  const mapped = cal.mapContractorRadarItemToCalendarRow({
    kind: 'guarantee',
    dateIso: '2026-08-01',
    daysLeft: -23,
    urgency: 'past',
    label: 'Εγγυητική καλής εκτέλεσης λήγει',
    contractorName: 'ΤΕΧΝΙΚΗ Α.Ε.',
    rowKey: 'rec-1',
    recordId: 'rec-1',
    guaranteeId: 'g1',
    subprojectId: 'sub-a',
  });
  assert.equal(mapped.type, cal.CALENDAR_EVENT_TYPES.CONTRACTOR_REGISTRY);
  assert.equal(mapped.isContractorRegistry, true);
  assert.equal(mapped.contractorRowKey, 'rec-1');
  const { alerts } = cal.buildCalendarDeadlineAlerts([mapped], { maxDays: 30, limit: 0 });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].contractorRowKey, 'rec-1');
  assert.equal(cal.filterCalendarEventsByType([mapped], 'contractors').length, 1);
  assert.equal(cal.eventsWithinDays([mapped], 30, { includePastDeadlines: false }).length, 1);
});

/**
 * Ημερολόγιο προθεσμιών: τύποι, παράθυρο, φίλτρο, προσκλήσεις, ορατότητα ειδοποιήσεων.
 * Ίδιες αποφάσεις με το widget και το πλήρες ημερολόγιο.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root === 'object' && root) {
    root.ErgoHubCalendarDeadlines = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var CALENDAR_EVENT_TYPES = {
    DEADLINE: 'deadline',
    OFFERS_EXPIRY: 'offers_expiry',
    CONTRACT_END: 'contract_end',
    COMPLIANCE_12M: 'compliance_12m',
    CUSTOM: 'custom',
    AEPO_RENEWAL: 'aepo_renewal',
    PROSKLISI_DEADLINE: 'prosklisi_deadline'
  };

  var CALENDAR_EVENT_LABELS = {};
  CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.DEADLINE] = 'Καταληκτική υποβολής προσφορών';
  CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.OFFERS_EXPIRY] = 'Λήξη ισχύος προσφορών';
  CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.CONTRACT_END] = 'Λήξη σύμβασης';
  CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.COMPLIANCE_12M] = 'Παράβαση κανόνα 12 μηνών';
  CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.CUSTOM] = 'Ειδοποίηση ημερολογίου';
  CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.AEPO_RENEWAL] = 'Ανανέωση ΑΕΠΟ';
  CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE] = 'Λήξη υποβολής πρόσκλησης';

  var PROCUREMENT_DEADLINE_EVENT_TYPES = [
    CALENDAR_EVENT_TYPES.DEADLINE,
    CALENDAR_EVENT_TYPES.OFFERS_EXPIRY
  ];

  var ALL_CALENDAR_EVENT_TYPES = PROCUREMENT_DEADLINE_EVENT_TYPES.concat([
    CALENDAR_EVENT_TYPES.CONTRACT_END,
    CALENDAR_EVENT_TYPES.COMPLIANCE_12M,
    CALENDAR_EVENT_TYPES.CUSTOM,
    CALENDAR_EVENT_TYPES.AEPO_RENEWAL,
    CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE
  ]);

  var PAST_DEADLINE_EVENT_TYPES = [
    CALENDAR_EVENT_TYPES.DEADLINE,
    CALENDAR_EVENT_TYPES.OFFERS_EXPIRY,
    CALENDAR_EVENT_TYPES.CONTRACT_END,
    CALENDAR_EVENT_TYPES.CUSTOM,
    CALENDAR_EVENT_TYPES.AEPO_RENEWAL,
    CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE
  ];

  var CALENDAR_TIME_WINDOWS = [
    { days: 7, label: '7 ημέρες' },
    { days: 14, label: '2 εβδομάδες' },
    { days: 30, label: '1 μήνας' },
    { days: 60, label: '2 μήνες' },
    { days: 90, label: '3 μήνες' },
    { days: 180, label: '6 μήνες' },
    { days: 365, label: '1 έτος' }
  ];

  function cardApi() {
    try {
      if (typeof require === 'function') return require('./subprojectCard');
    } catch (e) { /* browser harness */ }
    return (root && root.ErgoHubSubprojectCard) || {};
  }

  function parseIsoDate(iso) {
    if (!iso) return null;
    var s = String(iso);
    var dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (dateOnly) {
      return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 0, 0, 0, 0);
    }
    var d = iso instanceof Date ? iso : new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function toDateKey(isoOrDate) {
    var d = isoOrDate instanceof Date ? isoOrDate : parseIsoDate(isoOrDate);
    if (!d) return '';
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function isDateOnlyCalendarIso(iso) {
    var s = String(iso || '');
    if (!s.includes('T')) return true;
    return /^\d{4}-\d{2}-\d{2}T12:00:00(\.000)?Z$/i.test(s)
      || /^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?Z$/i.test(s);
  }

  function formatDateEl(iso) {
    var key = toDateKey(iso);
    if (!key) return '';
    var parts = key.split('-');
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function daysUntilDate(isoDate) {
    if (!isoDate) return null;
    var target = parseIsoDate(isoDate);
    if (!target) return null;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / (24 * 60 * 60 * 1000));
  }

  function urgencyFromDaysLeft(daysLeft) {
    if (daysLeft == null) return 'normal';
    if (daysLeft < 0) return 'past';
    if (daysLeft <= 7) return 'urgent';
    if (daysLeft <= 30) return 'soon';
    return 'normal';
  }

  function calendarEventRowKey(ev, prefix) {
    prefix = prefix || '';
    if (ev && ev.customEventId) {
      return prefix + ev.type + '-' + ev.customEventId + '-' + ev.dateKey;
    }
    if (ev && ev.orimanthiProposalId) {
      return prefix + ev.type + '-' + ev.orimanthiProposalId + '-' + ev.dateKey;
    }
    if (ev && ev.prosklisiId) {
      return prefix + ev.type + '-' + ev.prosklisiId + '-' + ev.dateKey;
    }
    var contractPart = ev && ev.contractIndex != null
      ? '-c' + ev.contractIndex
      : (ev && ev.adam ? '-a' + ev.adam : '');
    var id = ((ev && ev.subprojectId) || 'x') + contractPart;
    return prefix + ((ev && ev.type) || '') + '-' + id + '-' + ((ev && ev.dateKey) || '');
  }

  function filterProjectsForCalendar(projects, options) {
    var opts = options || {};
    var list = Array.isArray(projects) ? projects : [];
    if (opts.userRole !== 'ENGINEER') return list;
    var card = cardApi();
    var assigned = Array.isArray(opts.currentUser && opts.currentUser.assignedSupervisors)
      ? opts.currentUser.assignedSupervisors.map(function (s) { return String(s || '').trim(); }).filter(Boolean)
      : [];
    var ctx = card.buildEngineerVisibilityContext
      ? card.buildEngineerVisibilityContext(opts.currentUser, assigned)
      : null;
    if (!card.projectVisibleToAssignedEngineer) return list;
    return list.filter(function (p) {
      return card.projectVisibleToAssignedEngineer(p, ctx);
    });
  }

  function filterCalendarEventsByType(events, filterKey) {
    var list = events || [];
    if (!filterKey || filterKey === 'all') {
      return list.filter(function (e) { return ALL_CALENDAR_EVENT_TYPES.indexOf(e.type) !== -1; });
    }
    if (filterKey === 'deadlines') {
      return list.filter(function (e) { return PROCUREMENT_DEADLINE_EVENT_TYPES.indexOf(e.type) !== -1; });
    }
    if (filterKey === 'contracts') {
      return list.filter(function (e) { return e.type === CALENDAR_EVENT_TYPES.CONTRACT_END; });
    }
    if (filterKey === 'compliance') {
      return list.filter(function (e) { return e.type === CALENDAR_EVENT_TYPES.COMPLIANCE_12M; });
    }
    if (filterKey === 'custom') {
      return list.filter(function (e) { return e.type === CALENDAR_EVENT_TYPES.CUSTOM; });
    }
    if (filterKey === 'aepo') {
      return list.filter(function (e) { return e.type === CALENDAR_EVENT_TYPES.AEPO_RENEWAL; });
    }
    if (filterKey === 'proskliseis') {
      return list.filter(function (e) { return e.type === CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE; });
    }
    return list;
  }

  function eventsInMonth(events, year, monthIndex) {
    return (events || []).filter(function (e) {
      var d = parseIsoDate(e.dateIso);
      if (!d) return false;
      return d.getFullYear() === year && d.getMonth() === monthIndex;
    });
  }

  function eventsWithinDays(events, maxDays, options) {
    var opts = options || {};
    var includePast = opts.includePastDeadlines !== false;
    return (events || []).filter(function (e) {
      if (e.type === CALENDAR_EVENT_TYPES.COMPLIANCE_12M) return true;
      if (e.daysLeft == null) return false;
      if (e.daysLeft >= 0 && e.daysLeft <= maxDays) return true;
      if (includePast && e.daysLeft < 0 && PAST_DEADLINE_EVENT_TYPES.indexOf(e.type) !== -1) {
        return Math.abs(e.daysLeft) <= maxDays;
      }
      return false;
    });
  }

  function mapEventToAlertRow(ev) {
    return {
      id: calendarEventRowKey(ev),
      subprojectId: ev.subprojectId || '',
      customEventId: ev.customEventId || '',
      title: ev.subprojectTitle || ev.label || '(Χωρίς τίτλο)',
      projectTitle: ev.projectTitle || '',
      label: ev.label || CALENDAR_EVENT_LABELS[ev.type] || ev.type,
      type: ev.type,
      dateIso: ev.dateIso,
      dateLabel: formatDateEl(ev.dateIso),
      daysLeft: ev.daysLeft,
      urgency: ev.urgency,
      adam: ev.adam || '',
      description: ev.description || ev.complianceSummary || '',
      orimanthiProposalId: ev.orimanthiProposalId || '',
      prosklisiId: ev.prosklisiId || '',
      isCustom: !!ev.isCustom || ev.type === CALENDAR_EVENT_TYPES.CUSTOM,
      isOrimanthiAepo: !!ev.isOrimanthiAepo || ev.type === CALENDAR_EVENT_TYPES.AEPO_RENEWAL,
      isProsklisiDeadline: !!ev.isProsklisiDeadline || ev.type === CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE
    };
  }

  function buildCalendarDeadlineAlerts(events, options) {
    var opts = options || {};
    var maxDays = opts.maxDays != null ? opts.maxDays : 30;
    var minDays = opts.minDays != null ? opts.minDays : 0;
    var limit = opts.limit != null ? opts.limit : 8;
    var includePast = !!opts.includePast;
    var rows = [];
    var list = events || [];
    for (var i = 0; i < list.length; i += 1) {
      var ev = list[i];
      if (ev.type === CALENDAR_EVENT_TYPES.COMPLIANCE_12M) {
        rows.push(mapEventToAlertRow(ev));
        continue;
      }
      if (ev.daysLeft == null) continue;
      if (!includePast && ev.daysLeft < 0) continue;
      if (includePast && ev.daysLeft < 0 && Math.abs(ev.daysLeft) > maxDays) continue;
      if (ev.daysLeft >= 0 && ev.daysLeft > maxDays) continue;
      if (ev.daysLeft >= 0 && ev.daysLeft < minDays) continue;
      rows.push(mapEventToAlertRow(ev));
    }
    rows.sort(function (a, b) {
      var aPast = a.daysLeft != null && a.daysLeft < 0;
      var bPast = b.daysLeft != null && b.daysLeft < 0;
      if (aPast !== bPast) return aPast ? 1 : -1;
      return (a.daysLeft == null ? 9999 : a.daysLeft) - (b.daysLeft == null ? 9999 : b.daysLeft)
        || String(a.title || '').localeCompare(String(b.title || ''), 'el', { sensitivity: 'base' });
    });
    var totalCount = rows.length;
    var alerts = typeof limit === 'number' && limit > 0 ? rows.slice(0, limit) : rows;
    return { alerts: alerts, totalCount: totalCount };
  }

  function formatCalendarDaysLabel(daysLeft) {
    if (daysLeft == null) return '';
    if (daysLeft < 0) {
      var n = Math.abs(daysLeft);
      return n === 1 ? 'Έληξε χθες' : 'Έληξε πριν ' + n + ' ημ.';
    }
    if (daysLeft === 0) return 'Σήμερα';
    if (daysLeft === 1) return '1 ημέρα';
    return daysLeft + ' ημέρες';
  }

  function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
  }

  function userCanSeeCustomEvent(event, user, options) {
    var opts = options || {};
    if (!event || !user) return false;
    var role = String(user.role || '').trim().toUpperCase();
    var username = normalizeUsername(user.username);
    var createdBy = normalizeUsername(event.createdBy);

    if (role === 'SUPERADMIN') return true;
    if (username && createdBy && username === createdBy) return true;
    if (opts.adminSeesAll && role === 'ADMIN') return true;

    var roles = Array.isArray(event.visibilityRoles) ? event.visibilityRoles : [];
    var usernames = Array.isArray(event.visibilityUsernames) ? event.visibilityUsernames : [];
    if (!roles.length && !usernames.length) return true;

    if (username && usernames.map(function (u) { return normalizeUsername(u); }).indexOf(username) !== -1) {
      return true;
    }

    var viewerRoles = role === 'SUPERADMIN' ? ['SUPERADMIN', 'ADMIN'] : [role];
    return roles.some(function (r) {
      return viewerRoles.indexOf(String(r || '').trim().toUpperCase()) !== -1;
    });
  }

  function canManageCustomEvent(event, user) {
    if (!user) return false;
    var role = String(user.role || '').trim().toUpperCase();
    if (role === 'SUPERADMIN') return true;
    if (role !== 'ADMIN') return false;
    if (!event) return true;
    var createdBy = normalizeUsername(event.createdBy);
    var username = normalizeUsername(user.username);
    return !createdBy || createdBy === username;
  }

  function mapCustomEventToCalendarRow(event) {
    if (!event || !event.id || !event.dateIso) return null;
    var daysLeft = daysUntilDate(event.dateIso);
    return {
      type: CALENDAR_EVENT_TYPES.CUSTOM,
      customEventId: event.id,
      label: 'Ειδοποίηση ημερολογίου',
      subprojectTitle: event.title || '(Χωρίς τίτλο)',
      projectTitle: '',
      description: event.description || '',
      dateIso: String(event.dateIso),
      dateKey: toDateKey(event.dateIso),
      daysLeft: daysLeft,
      urgency: urgencyFromDaysLeft(daysLeft),
      priority: 'high',
      createdBy: event.createdBy || '',
      createdByFullName: event.createdByFullName || '',
      visibilityRoles: event.visibilityRoles || [],
      visibilityUsernames: event.visibilityUsernames || [],
      isCustom: true
    };
  }

  function buildCustomCalendarEvents(customEvents) {
    return (customEvents || []).map(mapCustomEventToCalendarRow).filter(Boolean);
  }

  function mergeCalendarEventLists() {
    var merged = [];
    for (var i = 0; i < arguments.length; i += 1) {
      (arguments[i] || []).forEach(function (ev) { merged.push(ev); });
    }
    merged.sort(function (a, b) {
      var da = new Date(a.dateIso).getTime() || 0;
      var db = new Date(b.dateIso).getTime() || 0;
      return da - db
        || String(a.subprojectTitle || '').localeCompare(String(b.subprojectTitle || ''), 'el', { sensitivity: 'base' });
    });
    return merged;
  }

  function parseProsklisiDeadline(dateString) {
    if (!dateString || dateString === '-') return null;
    var raw = String(dateString).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      var iso = new Date(raw.slice(0, 10) + 'T00:00:00');
      return Number.isNaN(iso.getTime()) ? null : iso;
    }
    if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(raw)) {
      var sep = raw.indexOf('/') !== -1 ? '/' : '-';
      var bits = raw.split(sep);
      var dmy = new Date(bits[2] + '-' + bits[1] + '-' + bits[0] + 'T00:00:00');
      return Number.isNaN(dmy.getTime()) ? null : dmy;
    }
    var d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function prosklisiDeadlineToIsoDate(deadline) {
    var d = parseProsklisiDeadline(deadline);
    if (!d) return '';
    return toDateKey(d);
  }

  function mapProsklisiToCalendarRow(prosklisi) {
    if (!prosklisi || !prosklisi.prosklisiId) return null;
    var dateIso = prosklisiDeadlineToIsoDate(prosklisi.deadline);
    if (!dateIso) return null;
    var daysLeft = daysUntilDate(dateIso);
    var linked = Array.isArray(prosklisi.linkedProjects)
      ? prosklisi.linkedProjects
        .map(function (lp) {
          return typeof lp === 'string' ? lp : ((lp && (lp.title || lp.projectTitle)) || '');
        })
        .filter(Boolean)
      : [];
    return {
      type: CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE,
      prosklisiId: prosklisi.prosklisiId,
      label: 'Λήξη υποβολής πρόσκλησης',
      subprojectTitle: prosklisi.title || '(Χωρίς τίτλο)',
      projectTitle: linked[0] || '',
      description: [
        prosklisi.status ? 'Κατάσταση: ' + prosklisi.status : '',
        linked.length ? 'Έργα: ' + linked.join(' · ') : '',
        prosklisi.code ? 'Κωδικός: ' + prosklisi.code : ''
      ].filter(Boolean).join(' · '),
      dateIso: dateIso,
      dateKey: toDateKey(dateIso),
      daysLeft: daysLeft,
      urgency: urgencyFromDaysLeft(daysLeft),
      priority: daysLeft != null && daysLeft <= 30 ? 'high' : 'medium',
      isProsklisiDeadline: true
    };
  }

  function buildProsklisiCalendarEvents(proskliseis) {
    return (proskliseis || []).map(mapProsklisiToCalendarRow).filter(Boolean);
  }

  function visibleCustomEventsForUser(customEvents, user) {
    return (customEvents || []).filter(function (ev) {
      return userCanSeeCustomEvent(ev, user);
    });
  }

  return {
    CALENDAR_EVENT_TYPES: CALENDAR_EVENT_TYPES,
    CALENDAR_EVENT_LABELS: CALENDAR_EVENT_LABELS,
    PROCUREMENT_DEADLINE_EVENT_TYPES: PROCUREMENT_DEADLINE_EVENT_TYPES,
    ALL_CALENDAR_EVENT_TYPES: ALL_CALENDAR_EVENT_TYPES,
    CALENDAR_TIME_WINDOWS: CALENDAR_TIME_WINDOWS,
    toDateKey: toDateKey,
    isDateOnlyCalendarIso: isDateOnlyCalendarIso,
    daysUntilDate: daysUntilDate,
    calendarEventRowKey: calendarEventRowKey,
    filterProjectsForCalendar: filterProjectsForCalendar,
    filterCalendarEventsByType: filterCalendarEventsByType,
    eventsInMonth: eventsInMonth,
    eventsWithinDays: eventsWithinDays,
    buildCalendarDeadlineAlerts: buildCalendarDeadlineAlerts,
    formatCalendarDaysLabel: formatCalendarDaysLabel,
    userCanSeeCustomEvent: userCanSeeCustomEvent,
    canManageCustomEvent: canManageCustomEvent,
    mapCustomEventToCalendarRow: mapCustomEventToCalendarRow,
    buildCustomCalendarEvents: buildCustomCalendarEvents,
    mergeCalendarEventLists: mergeCalendarEventLists,
    parseProsklisiDeadline: parseProsklisiDeadline,
    prosklisiDeadlineToIsoDate: prosklisiDeadlineToIsoDate,
    mapProsklisiToCalendarRow: mapProsklisiToCalendarRow,
    buildProsklisiCalendarEvents: buildProsklisiCalendarEvents,
    visibleCustomEventsForUser: visibleCustomEventsForUser
  };
});

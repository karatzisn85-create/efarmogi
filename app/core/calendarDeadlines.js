/**
 * Ημερολόγιο προθεσμιών: τύποι, παράθυρο, φίλτρο, προσκλήσεις,
 * ΚΗΜΔΗΣ / λήξη σύμβασης, καταχώριση ειδοποίησης.
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
    PROSKLISI_DEADLINE: 'prosklisi_deadline',
    CONTRACTOR_REGISTRY: 'contractor_registry'
  };

  var CALENDAR_EVENT_LABELS = {};
  CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.DEADLINE] = 'Καταληκτική υποβολής προσφορών';
  CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.OFFERS_EXPIRY] = 'Λήξη ισχύος προσφορών';
  CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.CONTRACT_END] = 'Λήξη σύμβασης';
  CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.COMPLIANCE_12M] = 'Παράβαση κανόνα 12 μηνών';
  CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.CUSTOM] = 'Ειδοποίηση ημερολογίου';
  CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.AEPO_RENEWAL] = 'Ανανέωση ΑΕΠΟ';
  CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE] = 'Λήξη υποβολής πρόσκλησης';
  CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.CONTRACTOR_REGISTRY] = 'Μητρώο αναδόχων';

  var PROCUREMENT_DEADLINE_EVENT_TYPES = [
    CALENDAR_EVENT_TYPES.DEADLINE,
    CALENDAR_EVENT_TYPES.OFFERS_EXPIRY
  ];

  var ALL_CALENDAR_EVENT_TYPES = PROCUREMENT_DEADLINE_EVENT_TYPES.concat([
    CALENDAR_EVENT_TYPES.CONTRACT_END,
    CALENDAR_EVENT_TYPES.COMPLIANCE_12M,
    CALENDAR_EVENT_TYPES.CUSTOM,
    CALENDAR_EVENT_TYPES.AEPO_RENEWAL,
    CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE,
    CALENDAR_EVENT_TYPES.CONTRACTOR_REGISTRY
  ]);

  var PROJECT_STATUS_CONTRACT_PROCESS = 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ';
  var STATUSES_WITH_KHMDHS_ADAM = [
    'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
    'ΟΛΟΚΛΗΡΩΜΕΝΟ',
    'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ'
  ];

  var PAST_DEADLINE_EVENT_TYPES = [
    CALENDAR_EVENT_TYPES.DEADLINE,
    CALENDAR_EVENT_TYPES.OFFERS_EXPIRY,
    CALENDAR_EVENT_TYPES.CONTRACT_END,
    CALENDAR_EVENT_TYPES.CUSTOM,
    CALENDAR_EVENT_TYPES.AEPO_RENEWAL,
    CALENDAR_EVENT_TYPES.PROSKLISI_DEADLINE,
    CALENDAR_EVENT_TYPES.CONTRACTOR_REGISTRY
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

  function listApi() {
    try {
      if (typeof require === 'function') return require('./subprojectList');
    } catch (e) { /* browser harness */ }
    return (root && root.ErgoHubSubprojectList) || {};
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

  function isContractorCalendarEvent(ev) {
    return !!(ev && (ev.isContractorRegistry || ev.type === CALENDAR_EVENT_TYPES.CONTRACTOR_REGISTRY));
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
    if (isContractorCalendarEvent(ev)) {
      var contractorPart = (ev && (ev.guaranteeId || ev.acceptanceId || ev.contractorRowKey)) || 'x';
      return prefix + ((ev && ev.type) || '') + '-' + contractorPart + '-' + ((ev && ev.dateKey) || '');
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
    if (filterKey === 'contractors') {
      return list.filter(isContractorCalendarEvent);
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
      if (e.type === CALENDAR_EVENT_TYPES.COMPLIANCE_12M || isContractorCalendarEvent(e)) return true;
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
      contractorRowKey: ev.contractorRowKey || '',
      isContractorRegistry: isContractorCalendarEvent(ev),
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
      if (ev.type === CALENDAR_EVENT_TYPES.COMPLIANCE_12M || isContractorCalendarEvent(ev)) {
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

  function mapContractorRadarItemToCalendarRow(item) {
    if (!item || !item.dateIso) return null;
    var dateIso = toDateKey(item.dateIso);
    if (!dateIso) return null;
    return {
      type: CALENDAR_EVENT_TYPES.CONTRACTOR_REGISTRY,
      isContractorRegistry: true,
      contractorRowKey: item.rowKey || item.recordId || item.identityKey || '',
      contractorRecordId: item.recordId || '',
      contractorName: item.contractorName || '',
      subprojectId: item.subprojectId || '',
      guaranteeId: item.guaranteeId || '',
      acceptanceId: item.acceptanceId || '',
      label: item.label || CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.CONTRACTOR_REGISTRY],
      subprojectTitle: item.contractorName || item.label || '',
      projectTitle: '',
      description: item.label || '',
      dateIso: dateIso,
      dateKey: dateIso,
      daysLeft: item.daysLeft,
      urgency: item.urgency || urgencyFromDaysLeft(item.daysLeft),
      priority: item.urgency === 'urgent' || item.urgency === 'past' ? 'high' : 'medium'
    };
  }

  function buildContractorRadarCalendarEvents(items) {
    return (items || []).map(mapContractorRadarItemToCalendarRow).filter(Boolean);
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

  function pickKhmdhsNoticeSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    var title = snapshot.title != null ? String(snapshot.title).trim() : '';
    if (!title && !snapshot.referenceNumber) return null;
    return snapshot;
  }

  function projectHasKhmdhsNoticeData(project) {
    var adam = String((project && project.khmdhsNoticeAdam) || '').trim();
    var snap = pickKhmdhsNoticeSnapshot(project && project.khmdhsNoticeSnapshot);
    return !!(adam || snap);
  }

  function projectHasSignedContractStatus(project) {
    return STATUSES_WITH_KHMDHS_ADAM.indexOf(project && project.projectStatus) !== -1;
  }

  function parseCalendarAmount(val) {
    if (val == null || val === '') return 0;
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
    var cleaned = String(val).trim().replace(/[^\d,.-]/g, '');
    if (!cleaned) return 0;
    var hasComma = cleaned.indexOf(',') !== -1;
    var hasDot = cleaned.indexOf('.') !== -1;
    var normalized = cleaned;
    if (hasComma && hasDot) normalized = cleaned.replace(/\./g, '').replace(',', '.');
    else if (hasComma) normalized = cleaned.replace(',', '.');
    var n = parseFloat(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  function projectProcurementPhaseConcluded(project) {
    if (!project) return false;
    if (projectHasSignedContractStatus(project)) return true;
    if (parseCalendarAmount(project.contractAmount) <= 0) return false;
    if (project.contractDate) return true;
    if (Array.isArray(project.contracts) && project.contracts.some(function (c) { return c && c.date; })) {
      return true;
    }
    return false;
  }

  function isActiveProcurementProject(project, options) {
    var opts = options || {};
    if (!project) return false;
    if (project.projectStatus !== PROJECT_STATUS_CONTRACT_PROCESS) return false;
    var concluded = opts.phaseConcluded;
    if (concluded == null) concluded = projectProcurementPhaseConcluded(project);
    if (concluded) return false;
    if (!projectHasKhmdhsNoticeData(project)) return false;
    var snap = pickKhmdhsNoticeSnapshot(project.khmdhsNoticeSnapshot);
    return !!(snap && !snap.cancelled);
  }

  /**
   * ΚΗΜΔΗΣ μονάδες: "1" ημέρες, "2" εβδομάδες, "3" μήνες, "4" έτη.
   * Άγνωστη μονάδα → null (όχι εικασία σε ημέρες).
   */
  function resolveDurationUnitKind(unit) {
    var raw = unit;
    if (raw && typeof raw === 'object') {
      raw = raw.value != null && String(raw.value).trim() !== '' ? raw.value : raw.key;
    }
    var u = String(raw || '').trim().toLowerCase();
    if (!u) return null;
    if (u === '1' || /ημέρ|ημερ|day/i.test(u)) return 'days';
    if (u === '2' || /εβδομ|week/i.test(u)) return 'weeks';
    if (u === '3' || /μήν|μην|month/i.test(u)) return 'months';
    if (u === '4' || /έτ|ετ|year/i.test(u)) return 'years';
    return null;
  }

  function addDurationToIso(isoStart, amount, unit) {
    var n = Number(amount);
    var start = isoStart ? new Date(isoStart) : null;
    if (!start || Number.isNaN(start.getTime()) || Number.isNaN(n) || n <= 0) return null;
    var kind = resolveDurationUnitKind(unit);
    if (!kind) return null;
    var d = new Date(start);
    if (kind === 'months') d.setMonth(d.getMonth() + n);
    else if (kind === 'years') d.setFullYear(d.getFullYear() + n);
    else if (kind === 'weeks') d.setDate(d.getDate() + Math.round(n * 7));
    else d.setDate(d.getDate() + Math.round(n));
    return d.toISOString();
  }

  function mapNoticeDeadlineRow(project, snap, type, dateIso) {
    var daysLeft = daysUntilDate(dateIso);
    return {
      type: type,
      priority: type === CALENDAR_EVENT_TYPES.DEADLINE ? 'high' : 'medium',
      label: CALENDAR_EVENT_LABELS[type],
      dateIso: String(dateIso),
      dateKey: toDateKey(dateIso),
      daysLeft: daysLeft,
      urgency: urgencyFromDaysLeft(daysLeft),
      subprojectId: project.subprojectId,
      projectId: project.projectId,
      subprojectTitle: project.subprojectTitle || (snap && snap.title) || '(Χωρίς τίτλο)',
      projectTitle: project.projectTitle || '',
      adam: (snap && snap.referenceNumber) || project.khmdhsNoticeAdam || ''
    };
  }

  function buildNoticeDeadlineCalendarEvents(project, options) {
    if (!isActiveProcurementProject(project, options)) return [];
    var snap = pickKhmdhsNoticeSnapshot(project.khmdhsNoticeSnapshot);
    if (!snap || !snap.finalSubmissionDate) return [];
    var events = [];
    events.push(mapNoticeDeadlineRow(
      project,
      snap,
      CALENDAR_EVENT_TYPES.DEADLINE,
      snap.finalSubmissionDate
    ));
    if (snap.offersValidTime != null && snap.offersValidTime !== '') {
      var expiryIso = addDurationToIso(
        snap.finalSubmissionDate,
        snap.offersValidTime,
        snap.offersValidTimeUnit
      );
      if (expiryIso && toDateKey(expiryIso) !== toDateKey(snap.finalSubmissionDate)) {
        events.push(mapNoticeDeadlineRow(
          project,
          snap,
          CALENDAR_EVENT_TYPES.OFFERS_EXPIRY,
          expiryIso
        ));
      }
    }
    return events;
  }

  function shouldShowContractEndEvent(project, options) {
    var opts = options || {};
    if (!project || !project.subprojectId) return false;
    var list = listApi();
    if (list.isAbandonedSubproject && list.isAbandonedSubproject(project)) return false;
    var hasAmount = typeof opts.hasPositiveAmount === 'boolean'
      ? opts.hasPositiveAmount
      : parseCalendarAmount(project.contractAmount) > 0;
    return hasAmount;
  }

  function mapContractEndToCalendarRow(project, endIso, extras) {
    if (!endIso) return null;
    var extra = extras || {};
    var daysLeft = daysUntilDate(endIso);
    var titleSuffix = extra.contractLabel ? ' (' + extra.contractLabel + ')' : '';
    var snap = project && project.khmdhsContractSnapshot;
    return {
      type: CALENDAR_EVENT_TYPES.CONTRACT_END,
      priority: 'medium',
      label: CALENDAR_EVENT_LABELS[CALENDAR_EVENT_TYPES.CONTRACT_END],
      dateIso: String(endIso),
      dateKey: toDateKey(endIso),
      daysLeft: daysLeft,
      urgency: urgencyFromDaysLeft(daysLeft),
      contractIndex: extra.contractIndex != null ? extra.contractIndex : null,
      subprojectId: project.subprojectId,
      projectId: project.projectId,
      subprojectTitle: (project.subprojectTitle || '(Χωρίς τίτλο)') + titleSuffix,
      projectTitle: project.projectTitle || '',
      adam: extra.contractAdam || (snap && snap.referenceNumber) || project.khmdhsAdam || project.khmdhsNoticeAdam || ''
    };
  }

  function resolveSimpleContractEndDateIso(project) {
    if (!project) return '';
    if (project.contractEndDate) return String(project.contractEndDate);
    var snap = project.khmdhsContractSnapshot;
    if (snap && !snap.noEndDate && snap.endDate) return String(snap.endDate);
    return '';
  }

  function buildSimpleContractEndCalendarEvents(project, options) {
    if (!shouldShowContractEndEvent(project, options)) return [];
    var endIso = resolveSimpleContractEndDateIso(project);
    var row = mapContractEndToCalendarRow(project, endIso, {});
    return row ? [row] : [];
  }

  function buildProcurementCalendarEvents(projects, options) {
    var scoped = filterProjectsForCalendar(projects, options);
    var events = [];
    scoped.forEach(function (p) {
      buildNoticeDeadlineCalendarEvents(p, options).forEach(function (ev) { events.push(ev); });
      buildSimpleContractEndCalendarEvents(p, options).forEach(function (ev) { events.push(ev); });
    });
    return events;
  }

  function isoFromDateAndTime(dateStr, timeStr) {
    var date = String(dateStr || '').trim();
    if (!date) return '';
    var time = String(timeStr || '').trim();
    if (!time) return date + 'T12:00:00.000Z';
    return date + 'T' + time + ':00';
  }

  function collectCustomEventRequiredErrors(form) {
    var fd = form || {};
    var errors = {};
    if (!String(fd.title || '').trim()) {
      errors.title = 'Συμπληρώστε τίτλο.';
    }
    if (!String(fd.date || '').trim()) {
      errors.date = 'Επιλέξτε ημερομηνία.';
    }
    return errors;
  }

  function canCreateCustomCalendarEvent(user) {
    return canManageCustomEvent(null, user);
  }

  function removeCustomEventFromList(events, eventId) {
    var id = String(eventId || '').trim();
    var list = Array.isArray(events) ? events : [];
    if (!id) return list.slice();
    return list.filter(function (e) {
      return String((e && e.id) || '') !== id;
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
    isContractorCalendarEvent: isContractorCalendarEvent,
    mapContractorRadarItemToCalendarRow: mapContractorRadarItemToCalendarRow,
    buildContractorRadarCalendarEvents: buildContractorRadarCalendarEvents,
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
    visibleCustomEventsForUser: visibleCustomEventsForUser,
    PROJECT_STATUS_CONTRACT_PROCESS: PROJECT_STATUS_CONTRACT_PROCESS,
    STATUSES_WITH_KHMDHS_ADAM: STATUSES_WITH_KHMDHS_ADAM,
    pickKhmdhsNoticeSnapshot: pickKhmdhsNoticeSnapshot,
    projectHasKhmdhsNoticeData: projectHasKhmdhsNoticeData,
    projectHasSignedContractStatus: projectHasSignedContractStatus,
    projectProcurementPhaseConcluded: projectProcurementPhaseConcluded,
    isActiveProcurementProject: isActiveProcurementProject,
    resolveDurationUnitKind: resolveDurationUnitKind,
    addDurationToIso: addDurationToIso,
    buildNoticeDeadlineCalendarEvents: buildNoticeDeadlineCalendarEvents,
    shouldShowContractEndEvent: shouldShowContractEndEvent,
    mapContractEndToCalendarRow: mapContractEndToCalendarRow,
    resolveSimpleContractEndDateIso: resolveSimpleContractEndDateIso,
    buildSimpleContractEndCalendarEvents: buildSimpleContractEndCalendarEvents,
    buildProcurementCalendarEvents: buildProcurementCalendarEvents,
    isoFromDateAndTime: isoFromDateAndTime,
    collectCustomEventRequiredErrors: collectCustomEventRequiredErrors,
    canCreateCustomCalendarEvent: canCreateCustomCalendarEvent,
    removeCustomEventFromList: removeCustomEventFromList
  };
});

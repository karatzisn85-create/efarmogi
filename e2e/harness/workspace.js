/* global ErgoHubSubprojectCard, ErgoHubSubprojectList, ErgoHubSubprojectLifecycle, ErgoHubCalendarDeadlines, ErgoHubProsklisiCatalog, ErgoHubEntaxiCatalog, ErgoHubEgkrisiCatalog, ErgoHubSubprojectFiles, ErgoHubTaskWorkspace */
(function () {
  var core = window.ErgoHubSubprojectCard;
  var list = window.ErgoHubSubprojectList;
  var life = window.ErgoHubSubprojectLifecycle;
  var cal = window.ErgoHubCalendarDeadlines;
  var psk = window.ErgoHubProsklisiCatalog;
  var ent = window.ErgoHubEntaxiCatalog;
  var egk = window.ErgoHubEgkrisiCatalog;
  var files = window.ErgoHubSubprojectFiles;
  var tw = window.ErgoHubTaskWorkspace;

  function isoDaysFromToday(offset) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return cal.toDateKey(d);
  }
  var STORE_KEY = 'ergohub-e2e-subprojects';

  var CATALOG = [
    { id: 'user:maria', username: 'maria', fullName: 'Μαρία Παπαδοπούλου' },
    { id: 'user:nikos', username: 'nikos', fullName: 'Νίκος Γεωργίου' },
    { id: 'user:elena', username: 'elena', fullName: 'Ελένη Αντωνίου' }
  ];

  var SEED = [
    {
      projectId: 'proj-road',
      subprojectId: 'sub-bridge',
      projectTitle: 'Οδικό δίκτυο Αρχανών',
      subprojectTitle: 'Γέφυρα Αγίου Σύλλα',
      kaCode: 'ΚΑ-100',
      projectStatus: 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ',
      projectType: 'ΕΡΓΟ',
      createdAt: '2024-01-10T08:00:00.000Z',
      updatedAt: '2024-01-10T08:00:00.000Z',
      supervisorEngineerIds: ['user:maria'],
      supervisorChargeOutsideEngineers: false,
      supervisorChargeFreePrimary: '',
      supervisorChargeFreeParticipants: ''
    },
    {
      projectId: 'proj-road',
      subprojectId: 'sub-lights',
      projectTitle: 'Οδικό δίκτυο Αρχανών',
      subprojectTitle: 'Φωτισμός κόμβου',
      kaCode: 'ΚΑ-101',
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      projectType: 'ΕΡΓΟ',
      createdAt: '2024-01-12T08:00:00.000Z',
      updatedAt: '2024-01-12T08:00:00.000Z',
      supervisorEngineerIds: ['user:maria'],
      supervisorChargeOutsideEngineers: false,
      supervisorChargeFreePrimary: '',
      supervisorChargeFreeParticipants: ''
    },
    {
      projectId: 'proj-water',
      subprojectId: 'sub-tank',
      projectTitle: 'Ύδρευση Αστερουσίων',
      subprojectTitle: 'Δεξαμενή Παρανύμφων',
      kaCode: 'ΚΑ-200',
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      projectType: 'ΠΡΟΜΗΘΕΙΑ',
      createdAt: '2024-02-01T08:00:00.000Z',
      updatedAt: '2024-02-01T08:00:00.000Z',
      supervisorEngineerIds: ['user:nikos'],
      supervisorChargeOutsideEngineers: false,
      supervisorChargeFreePrimary: '',
      supervisorChargeFreeParticipants: ''
    },
    {
      projectId: 'proj-old',
      subprojectId: 'sub-legacy',
      projectTitle: 'Παλιό έργο πλατείας',
      subprojectTitle: 'Ανάπλαση κεντρικής πλατείας',
      kaCode: 'ΚΑ-300',
      projectStatus: 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ',
      projectType: 'ΕΡΓΟ',
      createdAt: '2022-05-01T08:00:00.000Z',
      updatedAt: '2022-05-01T08:00:00.000Z',
      supervisor: 'Παλιός Επιβλέπων'
    },
    {
      projectId: 'proj-done',
      subprojectId: 'sub-paid',
      projectTitle: 'Ολοκληρωμένο έργο σχολείου',
      subprojectTitle: 'Αίθουσα εκδηλώσεων',
      kaCode: 'ΚΑ-400',
      projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ',
      projectType: 'ΕΡΓΟ',
      createdAt: '2021-01-01T08:00:00.000Z',
      updatedAt: '2023-01-01T08:00:00.000Z',
      supervisorEngineerIds: ['user:maria']
    },
    {
      projectId: 'proj-drop',
      subprojectId: 'sub-abandoned',
      projectTitle: 'Απενταγμένο έργο',
      subprojectTitle: 'Ακυρωμένη μελέτη',
      kaCode: 'ΚΑ-500',
      projectStatus: 'ΑΠΕΝΤΑΓΜΕΝΟ',
      projectType: 'ΜΕΛΕΤΗ',
      createdAt: '2020-01-01T08:00:00.000Z',
      updatedAt: '2020-06-01T08:00:00.000Z',
      supervisorEngineerIds: ['user:maria']
    }
  ];

  var state = {
    projects: [],
    role: 'ADMIN',
    query: '',
    status: '',
    type: '',
    chargeKey: '',
    showArchived: false,
    readingId: null,
    editingId: null,
    creating: false,
    draft: null,
    calendarOpen: false,
    calendarType: 'all',
    calendarWindow: 30,
    proskliseis: [
      {
        prosklisiId: 'psk-schools',
        title: 'Πρόσκληση σχολείων',
        deadline: isoDaysFromToday(5),
        status: 'Υπό Υποβολή',
        code: 'PSK-100',
        linkedProjects: [{ title: 'Οδικό δίκτυο Αρχανών' }]
      },
      {
        prosklisiId: 'psk-far',
        title: 'Πρόσκληση μακρινή',
        deadline: isoDaysFromToday(200),
        status: 'Υπό Υποβολή',
        code: 'PSK-200'
      },
      {
        prosklisiId: 'psk-expired',
        title: 'Πρόσκληση που έληξε',
        deadline: isoDaysFromToday(-4),
        status: 'Υπό Υποβολή',
        code: 'PSK-300',
        linkedProjects: [{ title: 'Ύδρευση Αστερουσίων' }]
      },
      {
        prosklisiId: 'psk-submitted',
        title: 'Πρόσκληση υποβληθείσα',
        deadline: isoDaysFromToday(-400),
        status: 'Υποβληθέν ΤΔΠ',
        code: 'PSK-400',
        linkedProjects: [{ title: 'Οδικό δίκτυο Αρχανών' }]
      },
      {
        prosklisiId: 'psk-modded',
        title: 'Πρόσκληση με τροποποίηση λήξης',
        deadline: isoDaysFromToday(-400),
        status: 'Υπό Ωρίμανση',
        code: 'PSK-500',
        linkedProjects: [{ title: 'Οδικό δίκτυο Αρχανών' }]
      }
    ],
    prosklisiModifications: {
      'psk-modded': [
        {
          modificationDocumentDate: isoDaysFromToday(-10),
          changes: {
            deadline: { original: isoDaysFromToday(-400), current: isoDaysFromToday(8) }
          }
        }
      ]
    },
    prosklisiOpen: false,
    prosklisiTab: 'active',
    prosklisiSearch: '',
    prosklisiExpiring: false,
    prosklisiUnlinked: false,
    entaxeis: [
      {
        entaxiId: 'ent-road',
        subject: 'Ανάπλαση γέφυρας',
        projectTitle: 'Οδικό δίκτυο Αρχανών',
        initialAmount: '100.000,00',
        subprojectIds: ['sub-bridge']
      },
      {
        entaxiId: 'ent-mod',
        subject: 'Τροποποιημένη ένταξη οδικού',
        projectTitle: 'Οδικό δίκτυο Αρχανών',
        initialAmount: '160.000,00',
        subprojectIds: ['sub-lights'],
        modifications: [
          { modificationId: 'm1', changeAmount: false, amount: '' },
          { modificationId: 'm2', changeAmount: true, amount: '155.285,47' }
        ]
      },
      {
        entaxiId: 'ent-water',
        subject: 'Δεξαμενή Παρανύμφων',
        projectTitle: 'Ύδρευση Αστερουσίων',
        initialAmount: '50.000,00',
        subprojectIds: ['sub-tank']
      },
      {
        entaxiId: 'ent-free',
        subject: 'Μεμονωμένη ένταξη',
        projectTitle: '',
        initialAmount: '10.000,00',
        subprojectIds: []
      },
      {
        entaxiId: 'ent-orphan',
        subject: 'Ένταξη με τίτλο χωρίς υποέργο',
        projectTitle: 'Οδικό δίκτυο Αρχανών',
        initialAmount: '8.000,00',
        subprojectIds: []
      }
    ],
    entaxiOpen: false,
    entaxiSearch: '',
    entaxiUnlinked: false,
    egkriseisByProjectId: {
      'proj-road': [
        {
          subprojectId: 'sub-bridge',
          egkriseis: [
            { id: 'egk-bridge-1', fileName: 'ΑΔΑ-XYZ.pdf', type: 'initial' }
          ]
        },
        {
          subprojectId: 'sub-lights',
          egkriseis: [
            { id: 'egk-lights-1', fileName: 'φωτισμός-αρχική.pdf', type: 'initial' },
            { id: 'egk-lights-2', fileName: 'φωτισμός-τροπ.pdf', type: 'modification' }
          ]
        }
      ],
      'proj-water': [
        {
          subprojectId: 'sub-tank',
          egkriseis: [
            { id: 'egk-tank-1', fileName: 'δεξαμενή.pdf', type: 'initial' }
          ]
        }
      ]
    },
    standaloneEgkriseis: {
      projects: {
        'Οδικό δίκτυο Αρχανών': {
          title: 'Οδικό δίκτυο Αρχανών',
          subprojects: {
            'Φωτισμός_κόμβου': {
              title: 'Φωτισμός κόμβου',
              pdfs: ['should-not-appear.pdf']
            }
          }
        },
        plateia: {
          title: 'Παλιό έργο πλατείας',
          subprojects: {
            anaplasi: {
              title: 'Ανάπλαση κεντρικής πλατείας',
              pdfs: ['πλατεία-αρχική.pdf', 'πλατεία-τροπ.pdf']
            }
          }
        },
        unknown: {
          title: 'Άγνωστο έργο',
          subprojects: {
            ghost: { title: 'Κάτι', pdfs: ['ghost.pdf'] }
          }
        }
      }
    },
    linkedEgkriseis: {
      'egk-bridge-1': { subprojectId: 'sub-bridge', subprojectTitle: 'Γέφυρα Αγίου Σύλλα' }
    },
    egkrisiOpen: false,
    egkrisiSearch: '',
    filesBySid: {
      'sub-bridge': {
        fileGroups: [
          { id: 'grp-contract', title: 'Σύμβαση', files: [{ name: 'σύμβαση.pdf' }] }
        ],
        ungroupedFiles: []
      }
    },
    filesSid: null,
    filesOpen: false,
    fileSeq: 1,
    tasks: [
      {
        id: 'task-open',
        title: 'Έλεγχος γέφυρας',
        description: 'Επίσκεψη στο πεδίο',
        status: 'pending',
        createdBy: 'admin',
        assignees: ['maria'],
        updatedAt: '2026-08-20T10:00:00.000Z'
      },
      {
        id: 'task-progress',
        title: 'Μελέτη φωτισμού',
        status: 'in_progress',
        createdBy: 'admin',
        assignees: ['nikos'],
        updatedAt: '2026-08-19T10:00:00.000Z'
      },
      {
        id: 'task-done',
        title: 'Ολοκληρωμένη αποτύπωση',
        status: 'completed',
        createdBy: 'admin',
        assignees: ['maria'],
        updatedAt: '2026-08-18T10:00:00.000Z'
      },
      {
        id: 'task-withdrawn',
        title: 'Κλειστός χώρος συναδέλφου',
        status: 'cancelled',
        withdrawnByAssigner: true,
        createdBy: 'admin',
        assignees: ['maria'],
        updatedAt: '2026-08-17T10:00:00.000Z'
      },
      {
        id: 'task-left',
        title: 'Αποθήκη από την οποία αποχώρησε',
        status: 'completed',
        leftArchiveBy: ['maria'],
        createdBy: 'admin',
        assignees: ['maria'],
        updatedAt: '2026-08-16T10:00:00.000Z'
      }
    ],
    taskOpen: false,
    taskScreen: 'workspace',
    taskSearch: '',
    customEvents: [
      {
        id: 'evt-eng',
        title: 'Ειδοποίηση μόνο για μηχανικούς',
        dateIso: isoDaysFromToday(3),
        visibilityRoles: ['ENGINEER'],
        visibilityUsernames: [],
        createdBy: 'admin'
      },
      {
        id: 'evt-all',
        title: 'Ειδοποίηση για όλους',
        dateIso: isoDaysFromToday(10),
        visibilityRoles: [],
        visibilityUsernames: [],
        createdBy: 'admin'
      }
    ]
  };

  function currentUser() {
    if (state.role === 'ENGINEER') {
      return { username: 'maria', role: 'ENGINEER', assignedSupervisors: [] };
    }
    if (state.role === 'USER') {
      return { username: 'viewer', role: 'USER' };
    }
    return { username: 'admin', role: 'ADMIN' };
  }

  function calendarEvents() {
    var visibleCustom = cal.visibleCustomEventsForUser(state.customEvents, currentUser());
    return cal.mergeCalendarEventLists(
      cal.buildProsklisiCalendarEvents(state.proskliseis),
      cal.buildCustomCalendarEvents(visibleCustom)
    );
  }

  function renderEventRow(host, ev, prefix) {
    var el = document.createElement('article');
    el.className = 'card';
    el.dataset.testid = prefix + (ev.prosklisiId || ev.customEventId || ev.subprojectId || 'x');
    if (ev.prosklisiId) el.setAttribute('data-prosklisi-id', ev.prosklisiId);
    if (ev.customEventId) el.setAttribute('data-custom-id', ev.customEventId);
    el.setAttribute('data-event-type', ev.type);
    el.innerHTML =
      '<h3>' + escapeHtml(ev.subprojectTitle || ev.label || '') + '</h3>' +
      '<p>' + escapeHtml(ev.label || '') + '</p>' +
      '<p data-field="days">' + escapeHtml(cal.formatCalendarDaysLabel(ev.daysLeft)) + '</p>';
    el.addEventListener('click', function () { openCalendarDetail(ev); });
    host.appendChild(el);
  }

  function renderCalendar() {
    var radarHost = document.getElementById('calendar-radar');
    var listHost = document.getElementById('calendar-list');
    radarHost.innerHTML = '';
    listHost.innerHTML = '';
    var all = calendarEvents();
    var radar = cal.buildCalendarDeadlineAlerts(all, { maxDays: state.calendarWindow, limit: 0 });
    radar.alerts.forEach(function (row) {
      var ev = all.find(function (e) { return cal.calendarEventRowKey(e) === row.id; }) || row;
      renderEventRow(radarHost, Object.assign({}, ev, { daysLeft: row.daysLeft }), 'cal-radar-');
    });
    var listed = cal.eventsWithinDays(
      cal.filterCalendarEventsByType(all, state.calendarType),
      state.calendarWindow,
      { includePastDeadlines: true }
    );
    listed.forEach(function (ev) { renderEventRow(listHost, ev, 'cal-event-'); });
  }

  function openCalendar() {
    state.calendarOpen = true;
    document.getElementById('calendar-panel').hidden = false;
    document.getElementById('calendar-detail').hidden = true;
    renderCalendar();
  }

  function closeCalendar() {
    state.calendarOpen = false;
    document.getElementById('calendar-panel').hidden = true;
    document.getElementById('calendar-detail').hidden = true;
  }

  function renderProskliseis() {
    var host = document.getElementById('prosklisi-list');
    host.innerHTML = '';
    var filtered = psk.applyProsklisiDailyFilters(state.proskliseis, {
      searchTerm: state.prosklisiSearch,
      showExpiringSoonOnly: state.prosklisiExpiring,
      showUnlinkedOnly: state.prosklisiUnlinked,
      modificationsById: state.prosklisiModifications
    });
    var parts = psk.partitionProskliseisByViewTab(filtered, state.prosklisiModifications);
    var rows = parts[state.prosklisiTab] || [];
    rows.forEach(function (p) {
      var effective = psk.getEffectiveProsklisiDeadline(p, state.prosklisiModifications[p.prosklisiId] || []);
      var el = document.createElement('article');
      el.className = 'card';
      el.dataset.testid = 'psk-card-' + p.prosklisiId;
      el.setAttribute('data-prosklisi-id', p.prosklisiId);
      el.innerHTML =
        '<h3>' + escapeHtml(p.title) + '</h3>' +
        '<p data-field="code">' + escapeHtml(p.code || '') + '</p>' +
        '<p data-field="deadline">' + escapeHtml(effective) + '</p>';
      host.appendChild(el);
    });
    document.getElementById('btn-new-prosklisi').hidden = !psk.showNewProsklisiButton(state.role);
    document.getElementById('btn-expiring').setAttribute('aria-pressed', state.prosklisiExpiring ? 'true' : 'false');
    document.getElementById('btn-unlinked').setAttribute('aria-pressed', state.prosklisiUnlinked ? 'true' : 'false');
  }

  function openProskliseis() {
    state.prosklisiOpen = true;
    document.getElementById('prosklisi-panel').hidden = false;
    renderProskliseis();
  }

  function renderEntaxeis() {
    var host = document.getElementById('entaxi-list');
    host.innerHTML = '';
    var filtered = ent.applyEntaxiDailyFilters(state.entaxeis, {
      quickSearchTerm: state.entaxiSearch,
      showUnlinkedOnly: state.entaxiUnlinked
    });
    var groups = ent.groupEntaxeisByProjectTitle(filtered);
    Object.keys(groups).forEach(function (title) {
      var section = document.createElement('section');
      section.className = 'group';
      section.dataset.testid = title === ent.UNLINKED_GROUP_TITLE ? 'ent-group-unlinked' : 'ent-group-' + title;
      var h = document.createElement('h3');
      h.textContent = title;
      section.appendChild(h);
      groups[title].forEach(function (e) {
        var card = document.createElement('article');
        card.className = 'card';
        card.dataset.testid = 'ent-card-' + e.entaxiId;
        card.innerHTML =
          '<h3>' + escapeHtml(e.subject) + '</h3>' +
          '<p data-field="project">' + escapeHtml(e.projectTitle || '') + '</p>' +
          '<p data-field="amount">' + escapeHtml(ent.formatEntaxiAmount(ent.getEntaxiCurrentTotal(e))) + '</p>';
        section.appendChild(card);
      });
      host.appendChild(section);
    });
    document.getElementById('btn-new-entaxi').hidden = !ent.showNewEntaxiButton(state.role);
    document.getElementById('btn-entaxi-unlinked').setAttribute('aria-pressed', state.entaxiUnlinked ? 'true' : 'false');
  }

  function openEntaxeis() {
    state.entaxiOpen = true;
    document.getElementById('entaxi-panel').hidden = false;
    renderEntaxeis();
  }

  function closeEntaxeis() {
    state.entaxiOpen = false;
    document.getElementById('entaxi-panel').hidden = true;
  }

  function renderEgkriseis() {
    var host = document.getElementById('egkrisi-list');
    host.innerHTML = '';
    var groups = egk.filterEgkrisiProjectGroups(
      egk.toEgkrisiProjectGroups(state.projects),
      state.egkrisiSearch
    );
    var data = egk.mergeStandaloneEgkriseis(
      state.egkriseisByProjectId,
      state.standaloneEgkriseis,
      egk.toEgkrisiProjectGroups(state.projects)
    );
    var canManage = egk.canManageEgkrisiActions(state.role);
    groups.forEach(function (projectGroup) {
      var projectId = projectGroup[0].projectId;
      var projectTitle = projectGroup[0].projectTitle;
      var section = document.createElement('section');
      section.className = 'group';
      section.dataset.testid = 'egk-group-' + projectTitle;
      var h = document.createElement('h3');
      h.textContent = projectTitle;
      section.appendChild(h);
      projectGroup.forEach(function (sub) {
        var subEl = document.createElement('article');
        subEl.className = 'card';
        subEl.dataset.testid = 'egk-sub-' + sub.subprojectId;
        subEl.innerHTML =
          '<h3>' + escapeHtml(sub.subprojectTitle) + '</h3>' +
          '<p data-field="ka">ΚΑ: ' + escapeHtml(sub.kaCode || '') + '</p>';
        var rows = egk.getEgkriseisForSubproject(data, projectId, sub.subprojectId);
        rows.forEach(function (e) {
          var card = document.createElement('div');
          card.className = 'card';
          card.dataset.testid = 'egk-card-' + e.id;
          var typeLabel = egk.formatEgkrisiType(e.type);
          var linked = egk.isEgkrisiLinked(e, state.linkedEgkriseis);
          card.innerHTML =
            '<p data-field="file">' + escapeHtml(e.fileName || '') + '</p>' +
            (typeLabel ? '<p data-field="type">' + escapeHtml(typeLabel) + '</p>' : '') +
            (linked ? '<p data-field="linked">Συσχετισμένο</p>' : '') +
            '<button type="button" data-testid="egk-link-' + e.id + '"' + (canManage ? '' : ' hidden') + '>Συσχέτιση</button>' +
            '<button type="button" data-testid="egk-delete-' + e.id + '"' + (canManage ? '' : ' hidden') + '>Διαγραφή</button>';
          subEl.appendChild(card);
        });
        section.appendChild(subEl);
      });
      host.appendChild(section);
    });
    document.getElementById('btn-new-egkrisi').hidden = !egk.showNewEgkrisiButton(state.role);
  }

  function openEgkriseis() {
    state.egkrisiOpen = true;
    document.getElementById('egkrisi-panel').hidden = false;
    renderEgkriseis();
  }

  function closeEgkriseis() {
    state.egkrisiOpen = false;
    document.getElementById('egkrisi-panel').hidden = true;
  }

  function closeProskliseis() {
    state.prosklisiOpen = false;
    document.getElementById('prosklisi-panel').hidden = true;
  }

  function openCalendarDetail(ev) {
    document.getElementById('calendar-detail').hidden = false;
    document.querySelector('[data-testid="calendar-detail-title"]').textContent = ev.subprojectTitle || '';
    document.querySelector('[data-testid="calendar-detail-label"]').textContent = ev.label || '';
    document.querySelector('[data-testid="calendar-detail-date"]').textContent = ev.dateIso || '';
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) { /* fresh seed */ }
    return SEED.map(function (p) { return Object.assign({}, p); });
  }

  function persistAll() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.projects));
  }

  function visibleList() {
    var rows = core.filterProjectsForRole(
      state.projects,
      state.role,
      { username: 'maria' },
      []
    );
    rows = rows.filter(function (p) {
      return core.subprojectMatchesQuickSearch(p, state.query, { catalog: CATALOG });
    });
    rows = rows.filter(function (p) { return list.projectMatchesQuickStatus(p, state.status); });
    rows = rows.filter(function (p) { return list.projectMatchesQuickType(p, state.type); });
    if (state.chargeKey) {
      rows = rows.filter(function (p) {
        return core.projectMatchesChargeFilters(p, [state.chargeKey]);
      });
    }
    return list.applyArchivedAbandonedVisibility(rows, {
      showArchivedProjects: state.showArchived,
      quickSearchStatus: state.status,
      filterStatuses: []
    });
  }

  function findBySid(sid) {
    return state.projects.find(function (p) { return p.subprojectId === sid; }) || null;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderCards() {
    var host = document.getElementById('card-list');
    host.innerHTML = '';
    var groups = list.groupSubprojectsByProjectId(visibleList());
    list.sortGroupedEntries(groups).forEach(function (entry) {
      var projectId = entry[0];
      var subs = list.sortSubprojectsInGroup(entry[1]);
      var group = document.createElement('section');
      group.className = 'group';
      group.dataset.testid = 'group-' + projectId;
      group.setAttribute('data-project-id', projectId);
      var header = document.createElement('h2');
      header.dataset.testid = 'group-title-' + projectId;
      header.textContent = list.pickDisplayProjectTitleForGroup(subs);
      group.appendChild(header);
      subs.forEach(function (p) {
        var charge = core.getProjectChargeDisplay(p, CATALOG);
        var el = document.createElement('article');
        el.className = 'card';
        el.dataset.testid = 'card-' + p.subprojectId;
        el.setAttribute('data-subproject-id', p.subprojectId);
        el.innerHTML =
          '<h3 data-field="project-title">' + escapeHtml(p.projectTitle) + '</h3>' +
          '<p data-field="subproject-title">' + escapeHtml(p.subprojectTitle) + '</p>' +
          '<p data-field="ka">ΚΑ: ' + escapeHtml(p.kaCode || '—') + '</p>' +
          '<p class="charge" data-field="charge">' + escapeHtml(charge.displayChargePrimary || '—') + '</p>';
        el.addEventListener('click', function () { openRead(p.subprojectId); });
        group.appendChild(el);
      });
      host.appendChild(group);
    });
    document.getElementById('btn-archived').setAttribute('aria-pressed', state.showArchived ? 'true' : 'false');
    document.getElementById('btn-new').hidden = state.role !== 'ADMIN';
  }

  function openRead(sid) {
    var project = findBySid(sid);
    if (!project) return;
    state.readingId = sid;
    state.editingId = null;
    state.creating = false;
    state.draft = null;
    document.getElementById('edit-panel').hidden = true;
    document.getElementById('create-panel').hidden = true;
    document.getElementById('attach-panel').hidden = true;
    document.getElementById('delete-confirm').hidden = true;
    document.getElementById('read-panel').hidden = false;
    var charge = core.getProjectChargeDisplay(project, CATALOG);
    document.querySelector('[data-testid="read-project-title"]').textContent = project.projectTitle || '';
    document.querySelector('[data-testid="read-subproject-title"]').textContent = project.subprojectTitle || '';
    document.querySelector('[data-testid="read-ka"]').textContent = project.kaCode || '';
    document.querySelector('[data-testid="read-charge"]').textContent = charge.displayChargePrimary || '';
    document.querySelector('[data-testid="read-status"]').textContent = project.projectStatus || '';
  }

  function ensureFiles(sid) {
    if (!state.filesBySid[sid]) {
      state.filesBySid[sid] = { fileGroups: [], ungroupedFiles: [] };
    }
    return state.filesBySid[sid];
  }

  function nextGroupId() {
    state.fileSeq += 1;
    return 'grp-new-' + state.fileSeq;
  }

  function pendingFileList() {
    return String(document.getElementById('file-pending-names').value || 'νέο.pdf')
      .split(',')
      .map(function (n) { return { name: n.trim() }; })
      .filter(function (f) { return f.name; });
  }

  function renderFiles() {
    var host = document.getElementById('file-list');
    host.innerHTML = '';
    if (!state.filesSid) return;
    var bag = ensureFiles(state.filesSid);
    bag.fileGroups.forEach(function (g) {
      var section = document.createElement('section');
      section.className = 'group';
      section.dataset.testid = 'file-group-' + g.id;
      var h = document.createElement('h3');
      h.textContent = g.title;
      section.appendChild(h);
      (g.files || []).forEach(function (f, idx) {
        var row = document.createElement('div');
        row.className = 'card';
        row.dataset.testid = 'file-row-' + f.name;
        row.innerHTML =
          '<p data-field="name">' + escapeHtml(f.name) + '</p>' +
          '<button type="button" data-testid="file-remove-' + g.id + '-' + idx + '">Αφαίρεση</button>';
        row.querySelector('button').addEventListener('click', function () {
          bag.fileGroups = files.removeFileFromGroup(bag.fileGroups, g.id, idx);
          renderFiles();
        });
        section.appendChild(row);
      });
      host.appendChild(section);
    });
    bag.ungroupedFiles.forEach(function (f) {
      var row = document.createElement('div');
      row.className = 'card';
      row.dataset.testid = 'file-ungrouped-' + f.name;
      row.innerHTML = '<p data-field="name">' + escapeHtml(f.name) + '</p>';
      host.appendChild(row);
    });
    var canUpload = files.showSubprojectFileUpload(state.role);
    document.getElementById('btn-add-files').hidden = !canUpload;
    document.getElementById('btn-add-folder').hidden = !canUpload;
    document.getElementById('file-group-choice').hidden = true;
    document.getElementById('file-new-group').hidden = true;
    document.getElementById('file-existing-group').hidden = true;
  }

  function openFiles(sid) {
    state.filesSid = sid;
    state.filesOpen = true;
    document.getElementById('files-panel').hidden = false;
    renderFiles();
  }

  function closeFiles() {
    state.filesOpen = false;
    state.filesSid = null;
    document.getElementById('files-panel').hidden = true;
    document.getElementById('file-group-choice').hidden = true;
    document.getElementById('file-new-group').hidden = true;
    document.getElementById('file-existing-group').hidden = true;
  }

  function applyFileChoice(choice) {
    var bag = ensureFiles(state.filesSid);
    var next = files.applyFormFileGrouping(
      bag.fileGroups,
      bag.ungroupedFiles,
      choice,
      pendingFileList(),
      nextGroupId()
    );
    bag.fileGroups = next.fileGroups;
    bag.ungroupedFiles = next.ungroupedFiles;
    renderFiles();
  }

  function taskCanAssign() {
    return state.role === 'ADMIN';
  }

  function renderTasks() {
    var host = document.getElementById('task-list');
    host.innerHTML = '';
    var listed = tw.listTasksForView(state.tasks, {
      actingUsername: currentUser().username,
      view: 'asAssignee',
      listScope: state.taskScreen === 'workArchive' ? 'workArchive' : 'default',
      canAssign: taskCanAssign()
    });
    listed = tw.applyTaskDailyFilters(listed, {
      isWorkArchive: state.taskScreen === 'workArchive',
      search: state.taskSearch
    });
    listed.forEach(function (t) {
      var el = document.createElement('article');
      el.className = 'card';
      el.dataset.testid = 'task-card-' + t.id;
      el.innerHTML =
        '<h3>' + escapeHtml(t.title) + '</h3>' +
        '<p data-field="status">' + escapeHtml((tw.TASK_STATUS_LABELS[t.status] || t.status)) + '</p>';
      host.appendChild(el);
    });
    document.getElementById('btn-new-task').hidden = !tw.showCreateTaskButton(taskCanAssign(), state.taskScreen === 'workArchive');
    document.getElementById('tab-workspace').setAttribute('aria-pressed', state.taskScreen === 'workspace' ? 'true' : 'false');
    document.getElementById('tab-archive').setAttribute('aria-pressed', state.taskScreen === 'workArchive' ? 'true' : 'false');
  }

  function openTasks() {
    state.taskOpen = true;
    document.getElementById('task-panel').hidden = false;
    renderTasks();
  }

  function closeTasks() {
    state.taskOpen = false;
    document.getElementById('task-panel').hidden = true;
  }

  function closeRead() {
    state.readingId = null;
    document.getElementById('read-panel').hidden = true;
  }

  function fillPrimarySelect(selected) {
    var sel = document.getElementById('edit-primary');
    sel.innerHTML = '<option value="">— Καμία επιλογή —</option>';
    CATALOG.forEach(function (eng) {
      var opt = document.createElement('option');
      opt.value = eng.id;
      opt.textContent = eng.fullName;
      if (eng.id === selected) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function syncChargeUi(draft) {
    var outside = !!draft.supervisorChargeOutsideEngineers;
    document.getElementById('edit-outside').checked = outside;
    document.getElementById('catalog-charge').hidden = outside;
    document.getElementById('free-charge').hidden = !outside;
    document.getElementById('edit-free').value = draft.supervisorChargeFreePrimary || '';
    fillPrimarySelect((draft.supervisorEngineerIds || [])[0] || '');
  }

  function enterEdit(sid) {
    var project = findBySid(sid);
    if (!project) return;
    var charge = core.loadChargeFieldsFromProject(project);
    state.editingId = sid;
    state.creating = false;
    state.draft = Object.assign({}, project, charge);
    document.getElementById('read-panel').hidden = true;
    document.getElementById('create-panel').hidden = true;
    document.getElementById('attach-panel').hidden = true;
    document.getElementById('edit-panel').hidden = false;
    document.querySelector('[data-testid="edit-project-id"]').textContent = project.projectId;
    document.querySelector('[data-testid="edit-subproject-id"]').textContent = project.subprojectId;
    document.getElementById('edit-project-title').value = project.projectTitle || '';
    document.getElementById('edit-subproject-title').value = project.subprojectTitle || '';
    document.getElementById('edit-ka').value = project.kaCode || '';
    document.getElementById('edit-locked').checked = false;
    document.getElementById('delete-confirm').hidden = true;
    document.getElementById('delete-error').hidden = true;
    document.getElementById('btn-delete').hidden = !life.showDeleteOnForm(state.draft);
    syncChargeUi(state.draft);
    updateUnsavedHint();
  }

  function readDraftFromForm() {
    if (!state.draft) return null;
    return Object.assign({}, state.draft, {
      projectTitle: document.getElementById('edit-project-title').value,
      subprojectTitle: document.getElementById('edit-subproject-title').value,
      kaCode: document.getElementById('edit-ka').value,
      supervisorChargeOutsideEngineers: document.getElementById('edit-outside').checked,
      supervisorChargeFreePrimary: document.getElementById('edit-free').value,
      supervisorEngineerIds: document.getElementById('edit-outside').checked
        ? []
        : core.mergeSupervisorEngineerIds(document.getElementById('edit-primary').value, [])
    });
  }

  function pickCompare(p) {
    if (!p) return null;
    return {
      projectTitle: p.projectTitle || '',
      subprojectTitle: p.subprojectTitle || '',
      kaCode: p.kaCode || '',
      supervisorEngineerIds: p.supervisorEngineerIds || [],
      supervisorChargeOutsideEngineers: !!p.supervisorChargeOutsideEngineers,
      supervisorChargeFreePrimary: p.supervisorChargeFreePrimary || ''
    };
  }

  function updateUnsavedHint() {
    var hint = document.getElementById('unsaved-hint');
    if (!state.editingId) {
      hint.hidden = true;
      return;
    }
    hint.hidden = JSON.stringify(pickCompare(findBySid(state.editingId))) === JSON.stringify(pickCompare(readDraftFromForm()));
  }

  function saveDraft() {
    var draft = readDraftFromForm();
    if (!draft) return;
    var existing = findBySid(state.editingId);
    var charge = core.normalizeChargeFromForm(draft);
    var incoming = Object.assign({}, draft, charge);
    var saved = core.sanitizeSubprojectForPersist(incoming, existing, {
      projectId: existing.projectId,
      subprojectId: existing.subprojectId,
      nowIso: new Date().toISOString()
    });
    state.projects = state.projects.map(function (p) {
      return p.subprojectId === saved.subprojectId ? saved : p;
    });
    persistAll();
    document.getElementById('persist-dump').textContent = JSON.stringify(saved);
    state.draft = Object.assign({}, saved, core.loadChargeFieldsFromProject(saved));
    renderCards();
    enterEdit(saved.subprojectId);
  }

  function discardDraft() {
    if (!state.editingId) return;
    document.getElementById('edit-panel').hidden = true;
    document.getElementById('delete-confirm').hidden = true;
    state.editingId = null;
    state.draft = null;
    renderCards();
  }

  function clearCreateForm() {
    document.getElementById('create-project-title').value = '';
    document.getElementById('create-subproject-title').value = '';
    document.getElementById('create-ka').value = '';
    document.getElementById('create-type').value = '';
    document.getElementById('create-status').value = '';
    document.getElementById('create-funding-source').value = '';
    document.getElementById('create-funding-details').value = '';
    document.getElementById('create-amount').value = '';
    showCreateErrors({});
  }

  function readCreateForm() {
    return {
      projectTitle: document.getElementById('create-project-title').value,
      subprojectTitle: document.getElementById('create-subproject-title').value,
      kaCode: document.getElementById('create-ka').value,
      projectType: document.getElementById('create-type').value,
      projectStatus: document.getElementById('create-status').value,
      fundingSource: document.getElementById('create-funding-source').value,
      fundingDetails: document.getElementById('create-funding-details').value,
      approvedAmount: document.getElementById('create-amount').value
    };
  }

  function showCreateErrors(errors) {
    var host = document.getElementById('create-errors');
    var keys = Object.keys(errors || {});
    host.hidden = keys.length === 0;
    host.innerHTML = keys.map(function (k) {
      return '<li data-error-field="' + k + '">' + escapeHtml(errors[k]) + '</li>';
    }).join('');
  }

  function closeCreate() {
    state.creating = false;
    document.getElementById('create-panel').hidden = true;
    document.getElementById('attach-panel').hidden = true;
    clearCreateForm();
  }

  function openCreate() {
    if (state.role !== 'ADMIN') return;
    state.creating = true;
    state.readingId = null;
    state.editingId = null;
    state.draft = null;
    document.getElementById('read-panel').hidden = true;
    document.getElementById('edit-panel').hidden = true;
    document.getElementById('delete-confirm').hidden = true;
    document.getElementById('attach-panel').hidden = true;
    document.getElementById('create-panel').hidden = false;
    clearCreateForm();
  }

  function tryCreateSave() {
    var form = readCreateForm();
    var errors = life.collectPhaseARequiredErrors(form);
    showCreateErrors(errors);
    if (Object.keys(errors).length) return;
    var existing = life.findExistingProjectByTitle(state.projects, form.projectTitle);
    if (existing) {
      document.getElementById('attach-panel').hidden = false;
      document.querySelector('[data-testid="attach-title"]').textContent = existing.projectTitle || '';
      return;
    }
    commitCreate(false);
  }

  function commitCreate(addToExisting) {
    var form = readCreateForm();
    var errors = life.collectPhaseARequiredErrors(form);
    showCreateErrors(errors);
    if (Object.keys(errors).length) return;
    var existing = life.findExistingProjectByTitle(state.projects, form.projectTitle);
    var placement = life.applyAddToExistingChoice(existing, addToExisting);
    var resolved = life.resolveProjectIdWhenMissing(placement.projectId, form.projectTitle, state.projects);
    var now = new Date().toISOString();
    var projectId = resolved.projectId || ('proj-' + Date.now().toString(36));
    var subprojectId = 'sub-' + Date.now().toString(36);
    var incoming = Object.assign({}, form, {
      projectId: projectId,
      subprojectId: subprojectId,
      createdAt: now,
      supervisorEngineerIds: [],
      supervisorChargeOutsideEngineers: false
    });
    var saved = core.sanitizeSubprojectForPersist(incoming, null, {
      projectId: projectId,
      subprojectId: subprojectId,
      nowIso: now
    });
    state.projects = state.projects.concat([saved]);
    persistAll();
    document.getElementById('persist-dump').textContent = JSON.stringify(saved);
    closeCreate();
    renderCards();
  }

  function requestDelete() {
    if (!life.showDeleteOnForm(state.draft)) return;
    document.getElementById('delete-error').hidden = true;
    document.getElementById('delete-confirm').hidden = false;
  }

  function cancelDelete() {
    document.getElementById('delete-confirm').hidden = true;
    document.getElementById('delete-error').hidden = true;
  }

  function confirmDelete() {
    var project = findBySid(state.editingId);
    var gate = life.evaluateSubprojectDelete({
      projectId: project && project.projectId,
      subprojectId: project && project.subprojectId,
      locked: document.getElementById('edit-locked').checked
    });
    if (!gate.ok) {
      var err = document.getElementById('delete-error');
      err.hidden = false;
      err.textContent = gate.reason === 'locked'
        ? 'Το υποέργο είναι κλειδωμένο από άλλον χρήστη. Κλείστε πρώτα την επεξεργασία.'
        : 'Σφάλμα: Μη έγκυρα δεδομένα για διαγραφή';
      return;
    }
    var result = life.removeSubprojectFromList(state.projects, project.subprojectId);
    state.projects = result.projects;
    persistAll();
    document.getElementById('persist-dump').textContent = JSON.stringify({ deleted: project.subprojectId });
    document.getElementById('delete-confirm').hidden = true;
    document.getElementById('edit-panel').hidden = true;
    state.editingId = null;
    state.draft = null;
    renderCards();
  }

  document.getElementById('role-select').addEventListener('change', function (e) {
    state.role = e.target.value;
    renderCards();
    if (state.calendarOpen) renderCalendar();
    if (state.prosklisiOpen) renderProskliseis();
    if (state.entaxiOpen) renderEntaxeis();
    if (state.egkrisiOpen) renderEgkriseis();
    if (state.filesOpen) renderFiles();
    if (state.taskOpen) renderTasks();
  });
  document.getElementById('quick-search').addEventListener('input', function (e) {
    state.query = e.target.value;
    renderCards();
  });
  document.getElementById('quick-status').addEventListener('change', function (e) {
    state.status = e.target.value;
    renderCards();
  });
  document.getElementById('quick-type').addEventListener('change', function (e) {
    state.type = e.target.value;
    renderCards();
  });
  document.getElementById('charge-filter').addEventListener('change', function (e) {
    state.chargeKey = e.target.value;
    renderCards();
  });
  document.getElementById('btn-archived').addEventListener('click', function () {
    state.showArchived = !state.showArchived;
    renderCards();
  });
  document.getElementById('btn-edit').addEventListener('click', function () {
    if (state.readingId) enterEdit(state.readingId);
  });
  document.getElementById('btn-files').addEventListener('click', function () {
    if (state.readingId) openFiles(state.readingId);
  });
  document.getElementById('btn-close-read').addEventListener('click', closeRead);
  document.getElementById('btn-close-files').addEventListener('click', closeFiles);
  document.getElementById('btn-add-files').addEventListener('click', function () {
    var bag = ensureFiles(state.filesSid);
    document.getElementById('file-choice-existing').hidden = bag.fileGroups.length === 0;
    document.getElementById('file-group-choice').hidden = false;
    document.getElementById('file-new-group').hidden = true;
    document.getElementById('file-existing-group').hidden = true;
  });
  document.getElementById('btn-add-folder').addEventListener('click', function () {
    var bag = ensureFiles(state.filesSid);
    var names = pendingFileList();
    if (!names.length) return;
    bag.fileGroups = files.applyFolderAsNewGroup(
      bag.fileGroups,
      document.getElementById('file-folder-name').value,
      names,
      nextGroupId()
    );
    renderFiles();
  });
  document.getElementById('file-choice-new').addEventListener('click', function () {
    document.getElementById('file-group-choice').hidden = true;
    document.getElementById('file-new-group').hidden = false;
    document.getElementById('file-new-title').value = '';
  });
  document.getElementById('file-choice-existing').addEventListener('click', function () {
    var bag = ensureFiles(state.filesSid);
    var sel = document.getElementById('file-existing-select');
    sel.innerHTML = '';
    bag.fileGroups.forEach(function (g) {
      var opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.title;
      sel.appendChild(opt);
    });
    document.getElementById('file-group-choice').hidden = true;
    document.getElementById('file-existing-group').hidden = false;
  });
  document.getElementById('file-choice-none').addEventListener('click', function () {
    applyFileChoice(false);
  });
  document.getElementById('file-choice-cancel').addEventListener('click', function () {
    if (files.isUploadGroupingCancelled(null)) renderFiles();
  });
  document.getElementById('file-confirm-new').addEventListener('click', function () {
    var title = document.getElementById('file-new-title').value;
    if (!files.isNewGroupTitleValid(title)) return;
    applyFileChoice({ action: 'new', title: String(title).trim() });
  });
  document.getElementById('file-confirm-existing').addEventListener('click', function () {
    applyFileChoice({
      action: 'existing',
      groupId: document.getElementById('file-existing-select').value
    });
  });
  document.getElementById('btn-tasks').addEventListener('click', openTasks);
  document.getElementById('btn-close-tasks').addEventListener('click', closeTasks);
  document.getElementById('tab-workspace').addEventListener('click', function () {
    state.taskScreen = 'workspace';
    renderTasks();
  });
  document.getElementById('tab-archive').addEventListener('click', function () {
    state.taskScreen = 'workArchive';
    renderTasks();
  });
  document.getElementById('task-search').addEventListener('input', function (e) {
    state.taskSearch = e.target.value;
    renderTasks();
  });
  document.getElementById('edit-outside').addEventListener('change', function (e) {
    state.draft = core.applyOutsideChargeToggle(readDraftFromForm(), e.target.checked);
    syncChargeUi(state.draft);
    updateUnsavedHint();
  });
  ['edit-project-title', 'edit-subproject-title', 'edit-ka', 'edit-primary', 'edit-free'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', updateUnsavedHint);
    document.getElementById(id).addEventListener('change', updateUnsavedHint);
  });
  document.getElementById('btn-save').addEventListener('click', saveDraft);
  document.getElementById('btn-discard').addEventListener('click', discardDraft);
  document.getElementById('btn-new').addEventListener('click', openCreate);
  document.getElementById('btn-create-save').addEventListener('click', tryCreateSave);
  document.getElementById('btn-create-cancel').addEventListener('click', closeCreate);
  document.getElementById('btn-attach-yes').addEventListener('click', function () { commitCreate(true); });
  document.getElementById('btn-attach-no').addEventListener('click', function () { commitCreate(false); });
  document.getElementById('btn-delete').addEventListener('click', requestDelete);
  document.getElementById('btn-delete-confirm').addEventListener('click', confirmDelete);
  document.getElementById('btn-delete-cancel').addEventListener('click', cancelDelete);
  document.getElementById('btn-calendar').addEventListener('click', openCalendar);
  document.getElementById('btn-close-calendar').addEventListener('click', closeCalendar);
  document.getElementById('btn-close-cal-detail').addEventListener('click', function () {
    document.getElementById('calendar-detail').hidden = true;
  });
  document.getElementById('calendar-type').addEventListener('change', function (e) {
    state.calendarType = e.target.value;
    renderCalendar();
  });
  document.getElementById('calendar-window').addEventListener('change', function (e) {
    state.calendarWindow = Number(e.target.value);
    renderCalendar();
  });
  document.getElementById('btn-proskliseis').addEventListener('click', openProskliseis);
  document.getElementById('btn-close-proskliseis').addEventListener('click', closeProskliseis);
  document.getElementById('tab-active').addEventListener('click', function () {
    state.prosklisiTab = psk.PROSKLISI_VIEW_TABS.ACTIVE;
    renderProskliseis();
  });
  document.getElementById('tab-expired').addEventListener('click', function () {
    state.prosklisiTab = psk.PROSKLISI_VIEW_TABS.EXPIRED;
    renderProskliseis();
  });
  document.getElementById('tab-submitted').addEventListener('click', function () {
    state.prosklisiTab = psk.PROSKLISI_VIEW_TABS.SUBMITTED;
    renderProskliseis();
  });
  document.getElementById('prosklisi-search').addEventListener('input', function (e) {
    state.prosklisiSearch = e.target.value;
    renderProskliseis();
  });
  document.getElementById('btn-expiring').addEventListener('click', function () {
    state.prosklisiExpiring = !state.prosklisiExpiring;
    renderProskliseis();
  });
  document.getElementById('btn-unlinked').addEventListener('click', function () {
    state.prosklisiUnlinked = !state.prosklisiUnlinked;
    renderProskliseis();
  });
  document.getElementById('btn-entaxeis').addEventListener('click', openEntaxeis);
  document.getElementById('btn-close-entaxeis').addEventListener('click', closeEntaxeis);
  document.getElementById('entaxi-search').addEventListener('input', function (e) {
    state.entaxiSearch = e.target.value;
    renderEntaxeis();
  });
  document.getElementById('btn-entaxi-unlinked').addEventListener('click', function () {
    state.entaxiUnlinked = !state.entaxiUnlinked;
    renderEntaxeis();
  });
  document.getElementById('btn-egkriseis').addEventListener('click', openEgkriseis);
  document.getElementById('btn-close-egkriseis').addEventListener('click', closeEgkriseis);
  document.getElementById('egkrisi-search').addEventListener('input', function (e) {
    state.egkrisiSearch = e.target.value;
    renderEgkriseis();
  });

  state.projects = loadStore();
  renderCards();
})();

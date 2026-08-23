/* global ErgoHubSubprojectCard, ErgoHubSubprojectList, ErgoHubSubprojectLifecycle, ErgoHubCalendarDeadlines, ErgoHubProsklisiCatalog, ErgoHubEntaxiCatalog, ErgoHubEgkrisiCatalog, ErgoHubSubprojectFiles, ErgoHubTaskWorkspace, ErgoHubUserCatalog, ErgoHubAuditCatalog, ErgoHubKhmdhsRefresh, ErgoHubKhmdhsPostFetch, ErgoHubExcelImport, ErgoHubReportsExport, ErgoHubPortalCatalog, ErgoHubOrimanthiCatalog, ErgoHubMeletaiCatalog, ErgoHubEpProgramCatalog, ErgoHubApologismosCatalog, ErgoHubBackupCatalog */
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
  var usersCore = window.ErgoHubUserCatalog;
  var auditCore = window.ErgoHubAuditCatalog;
  var khmdhs = window.ErgoHubKhmdhsRefresh;
  var pf = window.ErgoHubKhmdhsPostFetch;
  var excel = window.ErgoHubExcelImport;
  var reports = window.ErgoHubReportsExport;
  var portal = window.ErgoHubPortalCatalog;
  var ori = window.ErgoHubOrimanthiCatalog;
  var mlt = window.ErgoHubMeletaiCatalog;
  var ep = window.ErgoHubEpProgramCatalog;
  var apo = window.ErgoHubApologismosCatalog;
  var bk = window.ErgoHubBackupCatalog;

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
      supervisorChargeFreeParticipants: '',
      khmdhsNoticeAdam: '24PROC000000001',
      khmdhsNoticeFetchedAt: isoDaysFromToday(-40),
      remainingAmount: '15.000,00',
      remainingAmountYear: '2026',
      fundingSource: 'ΕΣΠΑ',
      projectBudget: '120.000,00',
      khmdhsAdam: '24SYMV000000001'
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
      supervisorChargeFreeParticipants: '',
      khmdhsAdam: '24SYMV000000002',
      khmdhsContractFetchedAt: isoDaysFromToday(-5),
      remainingAmount: '8000',
      remainingAmountYear: '2025',
      fundingSource: 'Ίδιοι Πόροι'
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
      supervisor: 'Παλιός Επιβλέπων',
      khmdhsAdam: '24SYMV000000003'
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
      supervisorEngineerIds: ['user:maria'],
      khmdhsAdam: '24SYMV000000099',
      approvedAmount: '80.000,00',
      contractAmount: '75.000,00',
      municipalUnit: 'Αρχανών'
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
    pendingWorkflowDelete: null,
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
    calendarProjects: [
      {
        subprojectId: 'sub-tender',
        projectId: 'proj-tender',
        projectTitle: 'Προμήθεια εξοπλισμού',
        subprojectTitle: 'Διαγωνισμός Η/Υ',
        projectStatus: 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ',
        khmdhsNoticeAdam: '24PROC000000001',
        khmdhsNoticeSnapshot: {
          title: 'Προκήρυξη Η/Υ',
          referenceNumber: '24PROC000000001',
          finalSubmissionDate: isoDaysFromToday(10),
          offersValidTime: 3,
          offersValidTimeUnit: 'μήνες',
          cancelled: false
        }
      },
      {
        subprojectId: 'sub-notice-cancelled',
        projectId: 'proj-tender',
        projectTitle: 'Προμήθεια εξοπλισμού',
        subprojectTitle: 'Ακυρωμένος διαγωνισμός',
        projectStatus: 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ',
        khmdhsNoticeAdam: '24PROC000000099',
        khmdhsNoticeSnapshot: {
          title: 'Ακυρωμένη προκήρυξη',
          referenceNumber: '24PROC000000099',
          finalSubmissionDate: isoDaysFromToday(8),
          cancelled: true
        }
      },
      {
        subprojectId: 'sub-signed',
        projectId: 'proj-signed',
        projectTitle: 'Οδικό δίκτυο Αρχανών',
        subprojectTitle: 'Σύμβαση φωτισμού',
        projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
        contractAmount: '50.000,00',
        contractDate: '2024-01-15',
        contractEndDate: isoDaysFromToday(20),
        khmdhsAdam: '24SYMV000000002',
        khmdhsContractSnapshot: {
          referenceNumber: '24SYMV000000002',
          endDate: isoDaysFromToday(20),
          noEndDate: false
        }
      },
      {
        subprojectId: 'sub-zero-contract',
        projectId: 'proj-signed',
        projectTitle: 'Οδικό δίκτυο Αρχανών',
        subprojectTitle: 'Σύμβαση χωρίς ποσό',
        projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
        contractAmount: '0',
        contractEndDate: isoDaysFromToday(12)
      }
    ],
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
    ],
    users: [
      { username: 'superadmin', role: 'SUPERADMIN', fullName: 'Υπερδιαχειριστής', approved: true, active: true },
      { username: 'admin', role: 'ADMIN', fullName: 'Διαχειριστής Δήμου', approved: true, active: true },
      { username: 'pending', role: 'USER', fullName: 'Αναμονή έγκρισης', approved: false, active: true },
      { username: 'maria', role: 'ENGINEER', fullName: 'Μαρία Παπαδοπούλου', approved: true, active: true }
    ],
    usersOpen: false,
    auditLogs: [
      {
        id: 'aud-create-bridge',
        timestamp: '2026-08-20T10:00:00.000Z',
        userFullName: 'Διαχειριστής Δήμου',
        userRole: 'ADMIN',
        user: 'Διαχειριστής Δήμου',
        action: 'create',
        entityType: 'subproject',
        entityId: 'sub-bridge',
        entityTitle: 'Γέφυρα Αγίου Σύλλα',
        details: 'Νέο υποέργο'
      },
      {
        id: 'aud-update-tank',
        timestamp: '2026-08-19T10:00:00.000Z',
        userFullName: 'Μαρία Παπαδοπούλου',
        userRole: 'ENGINEER',
        user: 'Μαρία Παπαδοπούλου',
        action: 'update',
        entityType: 'subproject',
        entityId: 'sub-tank',
        entityTitle: 'Δεξαμενή Παρανύμφων',
        changes: { 'Τίτλος υποέργου': { old: 'Παλιό όνομα', new: 'Δεξαμενή Παρανύμφων' } }
      },
      {
        id: 'aud-delete-user',
        timestamp: '2026-08-18T10:00:00.000Z',
        userFullName: 'Υπερδιαχειριστής',
        userRole: 'SUPERADMIN',
        user: 'Υπερδιαχειριστής',
        action: 'delete',
        entityType: 'user',
        entityId: 'old-user',
        entityTitle: 'Παλιός χρήστης'
      },
      {
        id: 'aud-empty-update',
        timestamp: '2026-08-17T10:00:00.000Z',
        userFullName: 'Διαχειριστής Δήμου',
        userRole: 'ADMIN',
        user: 'Διαχειριστής Δήμου',
        action: 'update',
        entityType: 'subproject',
        entityId: 'sub-lights',
        entityTitle: 'Φωτισμός κόμβου',
        changes: { 'Τίτλος': { old: 'Φωτισμός κόμβου', new: 'Φωτισμός  κόμβου' } }
      },
      {
        id: 'aud-old-psk',
        timestamp: '2026-08-16T10:00:00.000Z',
        userFullName: 'Παλιά καταγραφή',
        userRole: '',
        user: 'Παλιά καταγραφή',
        action: 'create',
        entityType: 'prosklisi',
        entityId: 'psk-old',
        entityTitle: 'Παλιά πρόσκληση'
      }
    ],
    auditOpen: false,
    auditEntity: '',
    auditAction: '',
    khmdhsLocks: { 'sub-legacy': true },
    khmdhsOpen: false,
    khmdhsOnlyStale: true,
    postFetchQueue: null,
    postFetchActiveTask: null,
    postFetchKind: {
      kind: '',
      endDate: '',
      modAmount: '',
      modAmountType: '',
      modDate: '',
      correctsAdam: '',
      correctsParts: [],
      hasKhmdhsAmount: false,
      hasKhmdhsDate: false,
      isRoot: false
    },
    portalOpen: false,
    portalEnabled: true,
    portalDimosUid: 'archanes-asterousion',
    portalPublishedIds: [],
    portalLastExportedIds: [],
    portalSelectedIds: [],
    portalSearch: '',
    portalFilterPublished: 'all',
    portalFilterStatus: '',
    portalMergeCompleted: false,
    portalExportError: '',
    portalExported: false,
    orimanthiOpen: false,
    orimanthiCanEdit: false,
    orimanthiSearch: '',
    orimanthiStatus: '',
    orimanthiCategory: '',
    orimanthiQuick: '',
    orimanthiSelectedId: '',
    orimanthiError: '',
    orimanthiCreateOpen: false,
    orimanthiConfirmDelete: false,
    orimanthiNextId: 1,
    orimanthiProposals: [
      {
        id: 'ori-water',
        title: 'Ύδρευση Χουδετσίου',
        projectCategory: 'ΥΔΡΑΥΛΙΚΑ',
        infrastructureSpecialization: 'ΥΔΡΕΥΣΗ',
        municipalUnit: 'Αρχάνες',
        settlement: 'Χουδέτσι',
        status: 'maturing',
        description: 'Αντικατάσταση δικτύου',
        notes: '',
        aepoRenewalDate: isoDaysFromToday(20),
        pendingItems: [{ text: 'Αρχαιολογική έκθεση', done: false }],
        fileGroups: [{ files: [{ name: 'ΚΑ-888-σύμβαση.pdf' }] }]
      },
      {
        id: 'ori-road',
        title: 'Ανάπλαση πλατείας Πεζών',
        projectCategory: 'ΟΔΟΠΟΙΙΑ',
        infrastructureSpecialization: '',
        municipalUnit: 'Αστερούσια',
        settlement: 'Πεζά',
        status: 'ready',
        description: '',
        notes: '',
        aepoRenewalDate: isoDaysFromToday(200),
        pendingItems: [],
        fileGroups: []
      },
      {
        id: 'ori-expired',
        title: 'Γεώτρηση Αχεντριά',
        projectCategory: 'ΓΕΩΤΡΗΣΕΙΣ',
        infrastructureSpecialization: '',
        municipalUnit: 'Αστερούσια',
        settlement: 'Αχεντριάς',
        status: 'approved',
        description: '',
        notes: '',
        aepoRenewalDate: isoDaysFromToday(-10),
        pendingItems: [{ text: 'Έγινε υδρομέτρηση', done: true }],
        fileGroups: []
      },
      {
        id: 'ori-draft',
        title: 'Κτίριο δημοτικού',
        projectCategory: '',
        infrastructureSpecialization: '',
        municipalUnit: '',
        settlement: '',
        status: 'draft',
        description: '',
        notes: 'αναμονή τοπογραφικού',
        aepoRenewalDate: '',
        pendingItems: [],
        fileGroups: []
      }
    ],
    meletaiOpen: false,
    meletaiCanEdit: false,
    meletaiSearch: '',
    meletaiQuick: '',
    meletaiSelectedId: '',
    meletaiError: '',
    meletaiCreateOpen: false,
    meletaiConfirmDelete: false,
    meletaiNextId: 1,
    meletai: [
      {
        id: 'mlt-water',
        studyNumber: '2/2026',
        title: 'Ύδρευση Χουδετσίου',
        assignedTo: 'Μαρία Παπαδοπούλου',
        category: 'ΥΔΡΑΥΛΙΚΑ',
        notes: '',
        linkedSubprojectId: 'sub-bridge',
        linkedSubprojectTitle: 'Γέφυρα Αγίου Σύλλα',
        linkedProjectTitle: 'Οδικό δίκτυο Αρχανών',
        fileGroups: [{ files: [{ name: 'ΚΑ-777-μελέτη.pdf' }] }]
      },
      {
        id: 'mlt-square',
        studyNumber: '15/2025',
        title: 'Ανάπλαση πλατείας',
        assignedTo: '',
        category: 'ΑΝΑΠΛΑΣΕΙΣ',
        notes: 'αναμονή τοπογραφικού',
        linkedSubprojectId: null,
        linkedSubprojectTitle: '',
        linkedProjectTitle: '',
        fileGroups: []
      },
      {
        id: 'mlt-road',
        studyNumber: '3/2026',
        title: 'Μελέτη οδοποιίας',
        assignedTo: 'Νίκος Γεωργίου',
        category: 'ΟΔΟΠΟΙΙΑ',
        notes: '',
        linkedSubprojectId: 'sub-tank',
        linkedSubprojectTitle: 'Δεξαμενή Παρανύμφων',
        linkedProjectTitle: 'Ύδρευση Αστερουσίων',
        fileGroups: []
      }
    ],
    epOpen: false,
    epSearch: '',
    epAxis: '',
    epType: '',
    epNew: '',
    epSelectedId: '',
    epError: '',
    epCreateOpen: false,
    epImportOpen: false,
    epImportStart: '',
    epImportEnd: '',
    epImportHasFile: false,
    epConfirmDelete: false,
    epExported: false,
    epTemplateName: '',
    epTemplateGuide: '',
    epTemplateLocation: '',
    epTemplateLists: '',
    epTemplateListsGrowing: '',
    epTemplateListsFixed: '',
    epTemplatePeriodOpen: false,
    epTplStart: '',
    epTplEnd: '',
    municipalUnits: ['Αστερουσίων'],
    epNextId: 1,
    epViewId: 'ep-active',
    epPrograms: [
      {
        id: 'ep-old',
        title: 'ΕΠΙΧΕΙΡΗΣΙΑΚΟ ΠΡΟΓΡΑΜΜΑ 2019-2023',
        startYear: 2019,
        endYear: 2023,
        isActive: false,
        actions: []
      },
      {
        id: 'ep-active',
        title: 'ΕΠΙΧΕΙΡΗΣΙΑΚΟ ΠΡΟΓΡΑΜΜΑ 2024-2028',
        startYear: 2024,
        endYear: 2028,
        isActive: true,
        actions: null
      }
    ],
    epActions: [
      {
        id: 'ep-water',
        aa: 1,
        axisCode: '1',
        measureCode: '1.1',
        objectiveCode: '1.1.1',
        title: 'Ύδρευση Χουδετσίου',
        actionType: 'Έργο',
        isNew: true,
        location: 'Χουδέτσι',
        responsibleService: 'Διεύθυνση Τεχνικών Υπηρεσιών',
        fundingSources: ['ΕΣΠΑ 2021-2027'],
        linkedSubprojectIds: ['sub-bridge']
      },
      {
        id: 'ep-study',
        aa: 2,
        axisCode: '2',
        measureCode: '2.1',
        objectiveCode: '2.1.1',
        title: 'Μελέτη πλατείας Αρχανών',
        actionType: 'Μελέτη',
        isNew: false,
        location: 'Αρχάνες',
        responsibleService: '',
        fundingSources: []
      },
      {
        id: 'ep-road',
        aa: 3,
        axisCode: '1',
        measureCode: '1.2',
        objectiveCode: '1.2.1',
        title: 'Οδοποιία Αστερουσίων',
        actionType: 'Έργο',
        isNew: true,
        location: '',
        responsibleService: 'ΔΟΥ',
        fundingSources: ['Ίδιοι πόροι']
      }
    ],
    apoOpen: false,
    apoSearch: '',
    apoFilter: 'all',
    apoError: '',
    apoEligibleOpen: false,
    apoLegacyOpen: false,
    apoConfirmDelete: false,
    apoSelectedId: '',
    apoPresent: '',
    apoPeriodStart: '2024',
    apoPeriodEnd: '2028',
    apoNextId: 1,
    apoPeriod: apo.createDefaultPeriod(),
    apoCards: [],
    backupOpen: false,
    backupHistoryOpen: false,
    backupInProgress: false,
    backupError: '',
    backupPendingDeleteId: '',
    backupPendingRestoreId: '',
    backupRestored: false,
    backupRolledBack: false,
    backupLiveTitle: 'τρέχον έργο',
    backupFailNextApply: false,
    backupFailSafety: false,
    backupFailExtract: false,
    backupToastCount: 0,
    backupToastText: '',
    backupRestorePhase: '',
    backupCoverage: [],
    backupCreateCoverage: [],
    backupLiveEntries: [
      'users.json', 'ΠΡΟΣΚΛΗΣΕΙΣ', 'entaxeis', 'EGKRISEIS_DIATHESIS_PISTOSIS',
      'ΜΕΛΕΤΕΣ', 'ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ', 'ΕΠΙΧΕΙΡΗΣΙΑΚΟ_ΠΡΟΓΡΑΜΜΑ', 'ΑΠΟΛΟΓΙΣΜΟΣ',
      'ANATHESEIS_ERGASION', 'config', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    ],
    backupOmitFromZip: [],
    backupRestarted: false,
    backupNowMs: Date.parse('2026-08-23T12:00:00.000Z'),
    backups: [],
    backupNextId: 1
  };

  function currentUser() {
    if (state.role === 'ENGINEER') {
      return { username: 'maria', role: 'ENGINEER', fullName: 'Μαρία Παπαδοπούλου', assignedSupervisors: [] };
    }
    if (state.role === 'USER') {
      return { username: 'viewer', role: 'USER', fullName: 'Απλός χρήστης' };
    }
    if (state.role === 'SUPERADMIN') {
      return { username: 'superadmin', role: 'SUPERADMIN', fullName: 'Υπερδιαχειριστής' };
    }
    return { username: 'admin', role: 'ADMIN', fullName: 'Διαχειριστής Δήμου' };
  }

  function calendarEvents() {
    var visibleCustom = cal.visibleCustomEventsForUser(state.customEvents, currentUser());
    return cal.mergeCalendarEventLists(
      cal.buildProsklisiCalendarEvents(state.proskliseis),
      cal.buildCustomCalendarEvents(visibleCustom),
      cal.buildProcurementCalendarEvents(state.calendarProjects, {
        userRole: state.role,
        currentUser: currentUser()
      })
    );
  }

  function renderEventRow(host, ev, prefix) {
    var el = document.createElement('article');
    el.className = 'card';
    el.dataset.testid = prefix + (ev.prosklisiId || ev.customEventId || (ev.type && ev.subprojectId ? ev.type + '-' + ev.subprojectId : '') || 'x');
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
    document.getElementById('btn-new-custom').hidden = !cal.canCreateCustomCalendarEvent(currentUser());
  }

  function openCustomCreate() {
    if (!cal.canCreateCustomCalendarEvent(currentUser())) return;
    document.getElementById('custom-create-title').value = '';
    document.getElementById('custom-create-date').value = '';
    document.getElementById('custom-create-eng-only').checked = false;
    var err = document.getElementById('custom-create-error');
    err.hidden = true;
    err.textContent = '';
    document.getElementById('custom-create-panel').hidden = false;
  }

  function closeCustomCreate() {
    document.getElementById('custom-create-panel').hidden = true;
    document.getElementById('custom-create-error').hidden = true;
  }

  function saveCustomCreate() {
    var title = document.getElementById('custom-create-title').value;
    var date = document.getElementById('custom-create-date').value;
    var errors = cal.collectCustomEventRequiredErrors({ title: title, date: date });
    var first = errors.title || errors.date;
    var err = document.getElementById('custom-create-error');
    if (first) {
      err.hidden = false;
      err.textContent = first;
      return;
    }
    var user = currentUser();
    state.customEvents.push({
      id: 'evt-created',
      title: String(title).trim(),
      dateIso: cal.isoFromDateAndTime(date, ''),
      visibilityRoles: document.getElementById('custom-create-eng-only').checked ? ['ENGINEER'] : [],
      visibilityUsernames: [],
      createdBy: user.username
    });
    closeCustomCreate();
    renderCalendar();
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
      if (psk.showProsklisiDeleteAction(state.role)) {
        var pskDel = document.createElement('button');
        pskDel.type = 'button';
        pskDel.dataset.testid = 'psk-delete-' + p.prosklisiId;
        pskDel.textContent = 'Διαγραφή';
        pskDel.addEventListener('click', function (ev) {
          ev.stopPropagation();
          requestWorkflowDelete('prosklisi', p.prosklisiId);
        });
        el.appendChild(pskDel);
      }
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
        if (ent.showEntaxiDeleteAction(state.role)) {
          var entDel = document.createElement('button');
          entDel.type = 'button';
          entDel.dataset.testid = 'ent-delete-' + e.entaxiId;
          entDel.textContent = 'Διαγραφή';
          entDel.addEventListener('click', function (ev) {
            ev.stopPropagation();
            requestWorkflowDelete('entaxi', e.entaxiId);
          });
          card.appendChild(entDel);
        }
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

  function showFieldErrors(listId, errors) {
    var host = document.getElementById(listId);
    var keys = Object.keys(errors || {});
    host.hidden = keys.length === 0;
    host.innerHTML = keys.map(function (k) {
      return '<li data-error-field="' + k + '">' + escapeHtml(errors[k]) + '</li>';
    }).join('');
  }

  function openEntaxiCreate() {
    if (!ent.showNewEntaxiButton(state.role)) return;
    document.getElementById('ent-create-date').value = '';
    document.getElementById('ent-create-authority').value = '';
    document.getElementById('ent-create-amount').value = '';
    document.getElementById('ent-create-subject').value = '';
    document.getElementById('ent-create-has-pdf').checked = false;
    showFieldErrors('ent-create-errors', {});
    document.getElementById('entaxi-create-panel').hidden = false;
  }

  function closeEntaxiCreate() {
    document.getElementById('entaxi-create-panel').hidden = true;
    showFieldErrors('ent-create-errors', {});
  }

  function readEntaxiCreateForm() {
    return {
      documentDate: document.getElementById('ent-create-date').value,
      fundingAuthority: document.getElementById('ent-create-authority').value,
      initialAmount: document.getElementById('ent-create-amount').value,
      subject: document.getElementById('ent-create-subject').value,
      entaxiPDFs: document.getElementById('ent-create-has-pdf').checked
        ? [{ fileName: 'ένταξη.pdf' }]
        : []
    };
  }

  function saveEntaxiCreate() {
    var form = readEntaxiCreateForm();
    var errors = ent.collectEntaxiRequiredErrors(form, { isNew: true });
    showFieldErrors('ent-create-errors', errors);
    if (Object.keys(errors).length) return;
    state.entaxeis.push({
      entaxiId: 'ent-created',
      subject: form.subject,
      projectTitle: '',
      initialAmount: form.initialAmount,
      subprojectIds: [],
      documentDate: form.documentDate,
      fundingAuthority: form.fundingAuthority,
      entaxiPDFs: form.entaxiPDFs
    });
    closeEntaxiCreate();
    renderEntaxeis();
  }

  function openProsklisiCreate() {
    if (!psk.showNewProsklisiButton(state.role)) return;
    document.getElementById('psk-create-title').value = '';
    document.getElementById('psk-create-axis').value = '';
    showFieldErrors('psk-create-errors', {});
    document.getElementById('psk-create-panel').hidden = false;
  }

  function closeProsklisiCreate() {
    document.getElementById('psk-create-panel').hidden = true;
    showFieldErrors('psk-create-errors', {});
  }

  function saveProsklisiCreate() {
    var form = {
      title: document.getElementById('psk-create-title').value,
      axis: document.getElementById('psk-create-axis').value
    };
    var errors = psk.collectProsklisiRequiredErrors(form);
    showFieldErrors('psk-create-errors', errors);
    if (Object.keys(errors).length) return;
    state.proskliseis.push({
      prosklisiId: 'psk-created',
      title: String(form.title).trim(),
      axis: String(form.axis).trim(),
      deadline: '',
      status: 'Υπό Ωρίμανση',
      code: '',
      linkedProjects: []
    });
    closeProsklisiCreate();
    renderProskliseis();
  }

  function requestWorkflowDelete(kind, id) {
    state.pendingWorkflowDelete = { kind: kind, id: id };
    var titleEl = document.getElementById('workflow-delete-title');
    var msgEl = document.querySelector('[data-testid="workflow-delete-message"]');
    if (kind === 'entaxi') {
      titleEl.textContent = 'Διαγραφή Ένταξης';
      msgEl.textContent = 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την ένταξη;';
    } else if (kind === 'user') {
      titleEl.textContent = 'Διαγραφή Χρήστη';
      msgEl.textContent = 'Είστε σίγουροι ότι θέλετε να διαγράψετε τον χρήστη "' + id + '";';
    } else if (kind === 'audit-clear') {
      titleEl.textContent = 'Εκκαθάριση Ιστορικού Ενεργειών';
      msgEl.textContent = 'Πρόκειται να διαγράψετε όλες τις καταγραφές από το ιστορικό ενεργειών.';
    } else {
      titleEl.textContent = 'Διαγραφή Πρόσκλησης';
      msgEl.textContent = 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την πρόσκληση;';
    }
    document.getElementById('workflow-delete-error').hidden = true;
    document.getElementById('workflow-delete-confirm').hidden = false;
  }

  function cancelWorkflowDelete() {
    state.pendingWorkflowDelete = null;
    document.getElementById('workflow-delete-confirm').hidden = true;
    document.getElementById('workflow-delete-error').hidden = true;
  }

  function confirmWorkflowDelete() {
    var pending = state.pendingWorkflowDelete;
    if (!pending) return;
    var err = document.getElementById('workflow-delete-error');
    if (pending.kind === 'entaxi') {
      var entDecision = ent.evaluateEntaxiDelete(pending.id);
      if (!entDecision.ok) {
        err.hidden = false;
        err.textContent = 'Λείπει η ταυτότητα της ένταξης';
        return;
      }
      state.entaxeis = ent.removeEntaxiFromList(state.entaxeis, pending.id);
      cancelWorkflowDelete();
      renderEntaxeis();
      return;
    }
    if (pending.kind === 'user') {
      var target = state.users.filter(function (u) { return u.username === pending.id; })[0] || null;
      var userDecision = usersCore.evaluateDeleteUser({
        actorIsSuperAdmin: state.role === 'SUPERADMIN',
        target: target,
        users: state.users
      });
      if (!userDecision.ok) {
        err.hidden = false;
        err.textContent = userDecision.error;
        return;
      }
      state.users = usersCore.removeUserFromList(state.users, pending.id);
      cancelWorkflowDelete();
      renderUsers();
      return;
    }
    if (pending.kind === 'audit-clear') {
      var clearDecision = auditCore.evaluateClearAuditLog(state.role === 'SUPERADMIN');
      if (!clearDecision.ok) {
        err.hidden = false;
        err.textContent = clearDecision.error;
        return;
      }
      var cleared = auditCore.clearAuditLogs(state.auditLogs, 0);
      state.auditLogs = cleared.logs;
      cancelWorkflowDelete();
      renderAudit();
      return;
    }
    var pskDecision = psk.evaluateProsklisiDelete(pending.id);
    if (!pskDecision.ok) {
      err.hidden = false;
      err.textContent = 'Λείπει η ταυτότητα της πρόσκλησης';
      return;
    }
    state.proskliseis = psk.removeProsklisiFromList(state.proskliseis, pending.id);
    cancelWorkflowDelete();
    renderProskliseis();
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
      var epMap = ep.buildEpSubprojectLinkMap(programsWithActions());
      subs.forEach(function (p) {
        var charge = core.getProjectChargeDisplay(p, CATALOG);
        var el = document.createElement('article');
        el.className = 'card';
        el.dataset.testid = 'card-' + p.subprojectId;
        el.setAttribute('data-subproject-id', p.subprojectId);
        var epLink = epMap[p.subprojectId];
        el.innerHTML =
          '<h3 data-field="project-title">' + escapeHtml(p.projectTitle) + '</h3>' +
          '<p data-field="subproject-title">' + escapeHtml(p.subprojectTitle) + '</p>' +
          '<p data-field="ka">ΚΑ: ' + escapeHtml(p.kaCode || '—') + '</p>' +
          '<p class="charge" data-field="charge">' + escapeHtml(charge.displayChargePrimary || '—') + '</p>' +
          (epLink
            ? '<p data-testid="card-ep-' + p.subprojectId + '">' + escapeHtml(ep.formatEpCardLinkLabel(epLink)) + '</p>'
            : '');
        el.addEventListener('click', function () { openRead(p.subprojectId); });
        if (reports.showCardReportButton()) {
          var reportBtn = document.createElement('button');
          reportBtn.type = 'button';
          reportBtn.dataset.testid = 'card-report-' + p.subprojectId;
          reportBtn.textContent = 'Αναφορά υποέργου';
          reportBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            openCardReport(p.subprojectId);
          });
          el.appendChild(reportBtn);
        }
        group.appendChild(el);
      });
      host.appendChild(group);
    });
    document.getElementById('btn-archived').setAttribute('aria-pressed', state.showArchived ? 'true' : 'false');
    document.getElementById('btn-new').hidden = state.role !== 'ADMIN';
    document.getElementById('btn-users').hidden = !usersCore.showUserManagementButton(state.role);
    document.getElementById('btn-audit').hidden = !auditCore.showAuditLogButton(state.role);
    document.getElementById('btn-batch-khmdhs').hidden = !khmdhs.showBatchRefreshButton(state.role);
    document.getElementById('btn-excel').hidden = !excel.showExcelImportButton(state.role);
    document.getElementById('btn-stats').hidden = !reports.showStatisticsButton(state.role);
    document.getElementById('btn-technical').hidden = !reports.showTechnicalProgramButton(state.role);
    document.getElementById('btn-export').hidden = !reports.showDataExportButton(state.role);
    document.getElementById('btn-pdf').hidden = !reports.showPdfReportsButton(state.role);
    document.getElementById('btn-portal').hidden = !portal.showPortalButton(state.role);
    document.getElementById('btn-orimanthi').hidden = !ori.showOrimanthiButton(state.role);
    document.getElementById('btn-meletai').hidden = !mlt.showMeletaiButton(state.role);
    document.getElementById('btn-ep').hidden = !ep.showEpProgramButton(state.role);
    document.getElementById('btn-apo').hidden = !apo.showApologismosButton(state.role);
    document.getElementById('btn-backup').hidden = !bk.showBackupButton(state.role);
    renderBackupDeck();
    if (state.statsOpen) renderStats();
    if (state.pdfOpen) renderPdfReports();
    if (state.portalOpen) renderPortal();
    if (state.orimanthiOpen) renderOrimanthi();
    if (state.meletaiOpen) renderMeletai();
    if (state.epOpen) renderEp();
    if (state.apoOpen) renderApo();
    if (state.backupOpen) renderBackup();
    if (state.technicalOpen) renderTechnical();
    if (state.exportOpen) renderExport();
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
    renderReadPortal(project);
    syncReadKhmdhsButton();
  }

  function renderReadPortal(project) {
    var box = document.getElementById('read-portal');
    var show = portal.showPortalCardSection(state.portalEnabled);
    box.hidden = !show;
    if (!show) return;
    var status = portal.resolvePortalCardStatus({
      selectedForNext: (state.portalSelectedIds || []).indexOf(project.subprojectId) >= 0,
      lastExported: (state.portalLastExportedIds || []).indexOf(project.subprojectId) >= 0
    });
    document.querySelector('[data-testid="read-portal-status"]').textContent = status.title;
    document.querySelector('[data-testid="read-portal-status"]').setAttribute('data-kind', status.kind);
    var btn = document.getElementById('btn-read-portal-toggle');
    var canToggle = portal.canTogglePortalOnCard(state.role);
    btn.hidden = !canToggle;
    btn.textContent = status.button;
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

  function renderUsers() {
    var parts = usersCore.partitionUsersByApproval(state.users);
    var me = currentUser();
    var pendingHost = document.getElementById('users-pending');
    var approvedHost = document.getElementById('users-approved');
    pendingHost.innerHTML = '';
    approvedHost.innerHTML = '';
    parts.pending.forEach(function (u) {
      var row = document.createElement('article');
      row.className = 'card';
      row.dataset.testid = 'user-pending-' + u.username;
      row.innerHTML = '<h3>' + escapeHtml(u.username) + '</h3><p>' + escapeHtml(u.fullName || '') + '</p>';
      var approve = document.createElement('button');
      approve.type = 'button';
      approve.dataset.testid = 'user-approve-' + u.username;
      approve.textContent = 'Έγκριση';
      approve.addEventListener('click', function () {
        state.users = usersCore.approveUserInList(state.users, u.username);
        renderUsers();
      });
      var reject = document.createElement('button');
      reject.type = 'button';
      reject.dataset.testid = 'user-reject-' + u.username;
      reject.textContent = 'Απόρριψη';
      reject.addEventListener('click', function () {
        requestWorkflowDelete('user', u.username);
      });
      row.appendChild(approve);
      row.appendChild(reject);
      pendingHost.appendChild(row);
    });
    parts.approved.forEach(function (u) {
      var row = document.createElement('article');
      row.className = 'card';
      row.dataset.testid = 'user-card-' + u.username;
      row.innerHTML = '<h3>' + escapeHtml(u.username) + '</h3><p>' + escapeHtml(u.fullName || '') + '</p>';
      if (usersCore.showUserDeleteAction(me.username, u)) {
        var del = document.createElement('button');
        del.type = 'button';
        del.dataset.testid = 'user-delete-' + u.username;
        del.textContent = 'Διαγραφή';
        del.addEventListener('click', function () {
          requestWorkflowDelete('user', u.username);
        });
        row.appendChild(del);
      }
      approvedHost.appendChild(row);
    });
    document.getElementById('btn-users').hidden = !usersCore.showUserManagementButton(state.role);
  }

  function openUsers() {
    if (!usersCore.showUserManagementButton(state.role)) return;
    state.usersOpen = true;
    document.getElementById('users-panel').hidden = false;
    renderUsers();
  }

  function closeUsers() {
    state.usersOpen = false;
    document.getElementById('users-panel').hidden = true;
    document.getElementById('user-create-panel').hidden = true;
  }

  function openUserCreate() {
    if (!usersCore.showUserManagementButton(state.role)) return;
    document.getElementById('user-create-username').value = '';
    document.getElementById('user-create-fullname').value = '';
    document.getElementById('user-create-password').value = '';
    document.getElementById('user-create-role').value = 'USER';
    var err = document.getElementById('user-create-error');
    err.hidden = true;
    err.textContent = '';
    document.getElementById('user-create-panel').hidden = false;
  }

  function closeUserCreate() {
    document.getElementById('user-create-panel').hidden = true;
    document.getElementById('user-create-error').hidden = true;
  }

  function saveUserCreate() {
    var form = {
      username: document.getElementById('user-create-username').value,
      fullName: document.getElementById('user-create-fullname').value,
      password: document.getElementById('user-create-password').value,
      role: document.getElementById('user-create-role').value
    };
    var decision = usersCore.evaluateCreateUser({
      actorIsSuperAdmin: state.role === 'SUPERADMIN',
      noUsersYet: state.users.length === 0,
      username: form.username,
      password: form.password,
      role: form.role,
      users: state.users
    });
    var err = document.getElementById('user-create-error');
    if (!decision.ok) {
      err.hidden = false;
      err.textContent = decision.error;
      return;
    }
    var username = String(form.username).trim();
    state.users.push({
      username: username,
      role: form.role,
      fullName: String(form.fullName).trim() || username,
      approved: usersCore.newUserStartsApproved(form.role),
      active: true
    });
    closeUserCreate();
    renderUsers();
  }

  function visibleAuditLogs() {
    var actor = currentUser();
    var result = auditCore.evaluateGetAuditLog(state.auditLogs, actor, {
      entityType: state.auditEntity || null,
      action: state.auditAction || null
    });
    if (!result.ok) return [];
    return auditCore.dropEmptyUpdateLogs(result.logs);
  }

  function renderAudit() {
    var actor = currentUser();
    document.getElementById('audit-visibility').textContent = auditCore.getAuditVisibilityText(actor.role);
    var logs = visibleAuditLogs();
    var stats = auditCore.summarizeAuditStats(logs);
    document.querySelector('[data-testid="audit-stat-total"]').textContent = String(stats.total);
    document.querySelector('[data-testid="audit-stat-creates"]').textContent = String(stats.creates);
    document.querySelector('[data-testid="audit-stat-updates"]').textContent = String(stats.updates);
    document.querySelector('[data-testid="audit-stat-deletes"]').textContent = String(stats.deletes);
    document.getElementById('btn-audit-clear').hidden = !auditCore.showClearAuditButton(actor.role, logs.length);
    var empty = document.getElementById('audit-empty');
    var host = document.getElementById('audit-list');
    host.innerHTML = '';
    if (!logs.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    logs.forEach(function (log) {
      var el = document.createElement('article');
      el.className = 'card';
      el.dataset.testid = 'audit-log-' + log.id;
      el.setAttribute('data-audit-id', log.id);
      el.innerHTML =
        '<h3 data-field="audit-title">' + escapeHtml(log.entityTitle) + '</h3>' +
        '<p data-field="audit-user">' + escapeHtml(log.userFullName || log.user || '') + '</p>' +
        '<p data-field="audit-type">' + escapeHtml(auditCore.getEntityTypeLabel(log.entityType)) + '</p>' +
        '<p data-field="audit-action">' + escapeHtml(auditCore.getActionLabel(log.action)) + '</p>';
      host.appendChild(el);
    });
  }

  function openAudit() {
    if (!auditCore.showAuditLogButton(state.role)) return;
    state.auditOpen = true;
    document.getElementById('audit-panel').hidden = false;
    renderAudit();
  }

  function closeAudit() {
    state.auditOpen = false;
    document.getElementById('audit-panel').hidden = true;
  }

  function requestAuditClear() {
    if (!auditCore.showClearAuditButton(state.role, visibleAuditLogs().length)) return;
    requestWorkflowDelete('audit-clear', '');
  }

  function engineerSeesProject(project) {
    var ctx = core.buildEngineerVisibilityContext(currentUser(), currentUser().assignedSupervisors);
    return core.projectVisibleToAssignedEngineer(project, ctx);
  }

  function syncReadKhmdhsButton() {
    var btn = document.getElementById('btn-khmdhs-refresh');
    var err = document.getElementById('khmdhs-refresh-error');
    err.hidden = true;
    err.textContent = '';
    var project = state.readingId ? findBySid(state.readingId) : null;
    if (!project) {
      btn.hidden = true;
      return;
    }
    var canRefresh = khmdhs.canUserRefreshKhmdhs(currentUser(), project, {
      visibleToEngineer: engineerSeesProject(project)
    });
    var hasSeed = !!khmdhs.getKhmdhsRefreshSeedAdam(project).adam;
    btn.hidden = !khmdhs.showCardRefreshButton(canRefresh, hasSeed);
  }

  function startSingleKhmdhsRefresh() {
    var project = state.readingId ? findBySid(state.readingId) : null;
    var err = document.getElementById('khmdhs-refresh-error');
    var actor = currentUser();
    var decision = khmdhs.evaluateSingleRefreshStart({
      username: actor.username,
      actor: actor,
      subprojectId: state.readingId,
      project: project,
      locked: !!(project && state.khmdhsLocks[project.subprojectId]),
      lockedBy: 'Νίκος',
      seedAdam: project ? khmdhs.getKhmdhsRefreshSeedAdam(project).adam : '',
      visibleToEngineer: project ? engineerSeesProject(project) : false
    });
    if (!decision.ok) {
      err.hidden = false;
      err.textContent = decision.error;
      return;
    }
    project.khmdhsChainLastRefreshedAt = new Date().toISOString();
    err.hidden = true;
    if (state.khmdhsOpen) renderKhmdhsBatch();
  }

  function batchRows() {
    return khmdhs.classifyProjectsForBatch(state.projects, {
      locks: state.khmdhsLocks,
      onlyStale: state.khmdhsOnlyStale
    });
  }

  function renderKhmdhsBatch() {
    var rows = batchRows();
    var eligHost = document.getElementById('khmdhs-eligible');
    var skipHost = document.getElementById('khmdhs-skipped');
    eligHost.innerHTML = '';
    skipHost.innerHTML = '';
    rows.eligible.forEach(function (row) {
      var el = document.createElement('article');
      el.className = 'card';
      el.dataset.testid = 'khmdhs-eligible-' + row.id;
      el.textContent = row.label;
      eligHost.appendChild(el);
    });
    rows.skipped.forEach(function (row) {
      var el = document.createElement('article');
      el.className = 'card';
      el.dataset.testid = 'khmdhs-skipped-' + row.id;
      el.setAttribute('data-reason', row.reason);
      el.innerHTML = escapeHtml(row.label) + ' — ' + escapeHtml(row.reason);
      skipHost.appendChild(el);
    });
    document.getElementById('khmdhs-batch-empty').hidden = rows.eligible.length > 0;
    document.getElementById('btn-khmdhs-stale').setAttribute('aria-pressed', state.khmdhsOnlyStale ? 'true' : 'false');
    document.getElementById('btn-khmdhs-all').setAttribute('aria-pressed', state.khmdhsOnlyStale ? 'false' : 'true');
  }

  function openKhmdhsBatch() {
    if (!khmdhs.showBatchRefreshButton(state.role)) return;
    state.khmdhsOpen = true;
    document.getElementById('khmdhs-batch-panel').hidden = false;
    renderKhmdhsBatch();
  }

  function closeKhmdhsBatch() {
    state.khmdhsOpen = false;
    document.getElementById('khmdhs-batch-panel').hidden = true;
  }

  function syncResumePending() {
    var btn = document.getElementById('btn-resume-pending');
    var has = pf.queueHasPendingWork(state.postFetchQueue);
    var listOpen = !document.getElementById('pending-list').hidden;
    btn.hidden = !has || listOpen;
  }

  function hidePostFetchPanels() {
    document.getElementById('post-fetch-setup').hidden = true;
    document.getElementById('post-fetch-gate').hidden = true;
    document.getElementById('pending-list').hidden = true;
    document.getElementById('pending-detail').hidden = true;
    syncResumePending();
  }

  function openPostFetchSetup() {
    hidePostFetchPanels();
    document.getElementById('post-fetch-setup').hidden = false;
  }

  function showGate(kind, title) {
    hidePostFetchPanels();
    document.getElementById('post-fetch-gate').hidden = false;
    document.querySelector('[data-testid="post-fetch-gate-title"]').textContent = title || '';
    document.querySelector('[data-testid="post-fetch-gate-kind"]').textContent = kind || '';
  }

  function showPendingList() {
    document.getElementById('post-fetch-setup').hidden = true;
    document.getElementById('post-fetch-gate').hidden = true;
    document.getElementById('pending-detail').hidden = true;
    document.getElementById('pending-list').hidden = false;
    renderPendingList();
    syncResumePending();
  }

  function renderPendingList() {
    var box = document.getElementById('pending-tasks');
    var empty = document.getElementById('pending-empty');
    box.innerHTML = '';
    var tasks = (state.postFetchQueue && state.postFetchQueue.tasks) || [];
    empty.hidden = tasks.length > 0;
    tasks.forEach(function (task) {
      var row = document.createElement('div');
      row.setAttribute('data-testid', 'pending-task-' + task.id);
      var q = document.createElement('p');
      q.textContent = task.question;
      var d = document.createElement('p');
      d.textContent = task.detail || '';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Άνοιγμα';
      btn.setAttribute('data-testid', 'open-task-' + task.id);
      btn.addEventListener('click', function () { openPendingTask(task.id); });
      row.appendChild(q);
      row.appendChild(d);
      row.appendChild(btn);
      box.appendChild(row);
    });
  }

  function resetKindDraft(extra) {
    state.postFetchKind = {
      kind: '',
      endDate: '',
      modAmount: '',
      modAmountType: '',
      modDate: '',
      correctsAdam: '',
      correctsParts: [],
      hasKhmdhsAmount: false,
      hasKhmdhsDate: false,
      isRoot: false
    };
    if (extra) {
      Object.keys(extra).forEach(function (k) { state.postFetchKind[k] = extra[k]; });
    }
  }

  function fillKindSelect() {
    var sel = document.getElementById('chain-kind');
    var current = sel.value;
    sel.innerHTML = '';
    var blank = document.createElement('option');
    blank.value = '';
    blank.textContent = 'Επιλέξτε είδος';
    sel.appendChild(blank);
    pf.buildChainKindSelectOptions().forEach(function (opt) {
      var o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      sel.appendChild(o);
    });
    sel.value = current || state.postFetchKind.kind || '';
  }

  function readKindDraftFromForm() {
    var parts = [];
    ['title', 'amount', 'date'].forEach(function (part) {
      var el = document.querySelector('[data-testid="kind-part-' + part + '"]');
      if (el && el.checked) parts.push(part);
    });
    state.postFetchKind.kind = document.getElementById('chain-kind').value;
    state.postFetchKind.endDate = document.getElementById('kind-end-date').value;
    state.postFetchKind.modAmount = document.getElementById('kind-mod-amount').value;
    state.postFetchKind.modAmountType = document.getElementById('kind-mod-type').value;
    state.postFetchKind.modDate = document.getElementById('kind-mod-date').value;
    state.postFetchKind.correctsAdam = document.getElementById('kind-corrects-adam').value;
    state.postFetchKind.correctsParts = parts;
    return state.postFetchKind;
  }

  function renderKindForm() {
    var draft = state.postFetchKind;
    var showCard = pf.shouldShowCharacterizationCard(draft);
    document.getElementById('kind-form').hidden = false;
    document.querySelector('[data-testid="kind-root-note"]').hidden = showCard;
    document.getElementById('chain-kind').disabled = !showCard;
    fillKindSelect();
    document.getElementById('chain-kind').value = draft.kind || '';
    var profile = draft.kind ? pf.getChainKindFieldProfile(draft.kind, draft) : null;
    document.getElementById('kind-profile-title').textContent = profile ? profile.title : '';
    document.getElementById('kind-profile-hint').textContent = profile ? profile.hint : '';
    document.getElementById('kind-end-wrap').hidden = !(profile && profile.needsEndDate);
    document.getElementById('kind-amount-wrap').hidden = !(profile && profile.needsModAmount);
    document.getElementById('kind-type-wrap').hidden = !(profile && profile.needsModAmountType);
    document.getElementById('kind-mod-date-wrap').hidden = !(profile && profile.needsModDate);
    document.getElementById('kind-corrects-wrap').hidden = !(profile && profile.needsRepublicationTarget);
    document.getElementById('kind-parts-wrap').hidden = !(profile && profile.needsRepublicationTarget);
    document.getElementById('kind-end-date').value = draft.endDate || '';
    document.getElementById('kind-mod-amount').value = draft.modAmount || '';
    document.getElementById('kind-mod-type').value = draft.modAmountType || '';
    document.getElementById('kind-mod-date').value = draft.modDate || '';
    document.getElementById('kind-corrects-adam').value = draft.correctsAdam || '';
    ['title', 'amount', 'date'].forEach(function (part) {
      var el = document.querySelector('[data-testid="kind-part-' + part + '"]');
      if (el) el.checked = (draft.correctsParts || []).indexOf(part) >= 0;
    });
    var validation = pf.validateChainKindDraft(draft);
    var err = document.getElementById('kind-error');
    if (!showCard || validation.ok) {
      err.hidden = true;
      err.textContent = '';
      return;
    }
    err.hidden = false;
    err.textContent = validation.message || '';
  }

  function openPendingTask(taskId) {
    var task = ((state.postFetchQueue && state.postFetchQueue.tasks) || []).find(function (t) {
      return t.id === taskId;
    });
    if (!task) return;
    state.postFetchActiveTask = task;
    hidePostFetchPanels();
    document.getElementById('pending-detail').hidden = false;
    document.querySelector('[data-testid="pending-detail-title"]').textContent = task.question;
    document.querySelector('[data-testid="pending-detail-body"]').textContent = task.detail || '';
    if (task.type === pf.POST_APPLY_TASK.DATA_REVIEW) {
      resetKindDraft(state.postFetchKindScenario || {});
      renderKindForm();
    } else {
      document.getElementById('kind-form').hidden = true;
    }
  }

  function completeActiveTask() {
    if (!state.postFetchActiveTask) return;
    if (state.postFetchActiveTask.type === pf.POST_APPLY_TASK.DATA_REVIEW) {
      var draft = readKindDraftFromForm();
      if (!pf.shouldShowCharacterizationCard(draft)) {
        // ρίζα: δεν χρειάζεται χαρακτηρισμός
      } else if (!pf.validateChainKindDraft(draft).ok) {
        renderKindForm();
        return;
      }
    }
    var next = pf.removeTaskFromQueue(state.postFetchQueue, state.postFetchActiveTask.id);
    state.postFetchQueue = next;
    state.postFetchActiveTask = null;
    var ret = pf.resolveReturnToPendingList(next);
    if (ret.openPendingTasks) showPendingList();
    else {
      hidePostFetchPanels();
      document.getElementById('pending-empty').hidden = false;
      document.getElementById('pending-list').hidden = false;
      renderPendingList();
    }
  }

  function laterFromDetail() {
    var reopen = pf.resolveReopenPendingList(state.postFetchQueue);
    state.postFetchActiveTask = null;
    if (reopen.openPendingTasks) showPendingList();
    else hidePostFetchPanels();
  }

  function laterFromList() {
    hidePostFetchPanels();
  }

  function applyQueueAndUi(queue, uiOpts) {
    state.postFetchQueue = queue;
    var ui = pf.resolvePostFetchUi(queue, uiOpts || {});
    if (ui.openPendingTasks) showPendingList();
    else {
      hidePostFetchPanels();
      if (uiOpts && (uiOpts.suppress || uiOpts.skip)) {
        showGate('suppress', 'Η μαζική ανανέωση δεν ανοίγει παράθυρα.');
      } else {
        showGate('none', 'Δεν υπάρχουν εκκρεμότητες.');
      }
    }
  }

  function runFetchScenario() {
    var name = document.getElementById('fetch-scenario').value;
    if (!name) return;
    state.postFetchKindScenario = { hasKhmdhsAmount: false, hasKhmdhsDate: false, isRoot: false };
    var startMap = {
      invalid_adam: { invalidAdam: true },
      dup_symv: { duplicateSymv: true },
      supplementary: { routeSupplementary: true }
    };
    if (startMap[name]) {
      var start = pf.resolveFetchStartGate(startMap[name]);
      showGate(start.next, pf.fetchStartTitle(start.next));
      return;
    }

    var preMap = {
      branch: { needsBranchPicker: true },
      planner: { offerSymvPlanner: true },
      planner_reuse: { offerSymvPlanner: true, reusableSymvPlan: true },
      duplicate_anchor: { hasDuplicateConflict: true },
      stitch_a: { offerStitchA: true },
      defer: { deferCancelledSeed: true }
    };
    if (preMap[name]) {
      var pre = pf.resolvePreApplyGate(preMap[name]);
      if (pre.next !== pf.PRE_APPLY.APPLY) {
        showGate(pre.next, pf.preApplyTitle(pre.next));
        return;
      }
      if (name === 'planner_reuse') {
        showGate('apply', 'Το αποθηκευμένο σχέδιο εφαρμόζεται χωρίς νέο σχεδιασμό.');
        return;
      }
    }

    if (name === 'failed_reopen') {
      var prev = pf.assemblePostApplyTasks({ unresolvedReviewCount: 2 });
      state.postFetchQueue = prev;
      var reopen = pf.resolveReopenAfterFailedFetch(prev, { listAlreadyOpen: false });
      if (reopen.openPendingTasks) showPendingList();
      else showGate('none', 'Δεν υπάρχουν εκκρεμότητες.');
      return;
    }

    if (name === 'merge_supp') {
      var previous = pf.assemblePostApplyTasks({
        offerRegistry: true,
        apeConflict: { contractLabel: 'Σύμβαση 1' }
      });
      var incoming = pf.assemblePostApplyTasks({ unresolvedReviewCount: 1 });
      var merged = pf.mergePostApplyQueues(previous, incoming);
      applyQueueAndUi(merged);
      return;
    }

    if (name === 'root_no_card') {
      state.postFetchKindScenario = { isRoot: true };
      applyQueueAndUi(pf.assemblePostApplyTasks({ unresolvedReviewCount: 1 }));
      return;
    }

    if (name === 'review_from_khmdhs') {
      state.postFetchKindScenario = { hasKhmdhsAmount: true, hasKhmdhsDate: true, isRoot: false };
      applyQueueAndUi(pf.assemblePostApplyTasks({ unresolvedReviewCount: 1 }));
      return;
    }

    var taskFlags = {
      clean: {},
      review: { unresolvedReviewCount: 2 },
      situation: { showSituation: true, situation: { title: 'Ελέγξτε τις προειδοποιήσεις της ανάκτησης.', message: 'Το αίτημα έχει προειδοποιήσεις.', requiresDecision: true } },
      stitch_b: { stitchBSegments: [{}, {}] },
      registry: { offerRegistry: true },
      ape: { apeConflict: { contractLabel: 'Σύμβαση 1' } },
      expiry: { expiry: { summary: 'Η σύμβαση έληξε.' } },
      all_tasks: {
        unresolvedReviewCount: 1,
        showSituation: true,
        situation: { title: 'Ελέγξτε τις προειδοποιήσεις της ανάκτησης.', message: 'Υπάρχουν αποφάσεις.', requiresDecision: true },
        stitchBSegments: [{}, {}],
        offerRegistry: true,
        apeConflict: { contractLabel: 'Σύμβαση 1' },
        expiry: { summary: 'Η σύμβαση έληξε.' }
      },
      batch_suppress: { unresolvedReviewCount: 2 }
    };
    var flags = taskFlags[name] || taskFlags.clean;
    var queue = pf.assemblePostApplyTasks(flags);
    applyQueueAndUi(queue, name === 'batch_suppress' ? { suppress: true } : {});
  }

  function excelScenarioRows(name) {
    if (name === 'clean_new') {
      return [
        { excelRow: 2, projectTitle: 'Άρδευση Τεμένους', subprojectTitle: 'Δίκτυο Άνω Αρχανών', kaCode: 'ΚΑ-800' },
        { excelRow: 3, projectTitle: 'Άρδευση Τεμένους', subprojectTitle: 'Αντλιοστάσιο', kaCode: 'ΚΑ-801' }
      ];
    }
    if (name === 'with_duplicate') {
      return [
        { excelRow: 2, projectTitle: 'Οδικό δίκτυο Αρχανών', subprojectTitle: 'Γέφυρα Αγίου Σύλλα', kaCode: 'ΚΑ-999' },
        { excelRow: 3, projectTitle: 'Νέο έργο εισαγωγής', subprojectTitle: 'Νέο υποέργο εισαγωγής', kaCode: 'ΚΑ-700' }
      ];
    }
    if (name === 'case_spaces') {
      return [
        { excelRow: 2, projectTitle: '  Οδικό δίκτυο Αρχανών  ', subprojectTitle: 'γέφυρα αγίου σύλλα', kaCode: 'ΚΑ-999' }
      ];
    }
    return [];
  }

  function buildExcelReport(name) {
    if (name === 'parse_error') {
      return {
        parseErrors: [{ message: 'Το αρχείο δεν διαβάστηκε σωστά.' }],
        errorRows: [],
        validRows: [],
        validCount: 0,
        totalRows: 0,
        existingCount: state.projects.length,
        existingDuplicates: [],
        versionOk: false
      };
    }
    if (name === 'row_errors') {
      return {
        parseErrors: [],
        errorRows: [{ excelRow: 2, messages: ['Λείπει ο τίτλος υποέργου'] }],
        validRows: [],
        validCount: 0,
        totalRows: 1,
        existingCount: state.projects.length,
        existingDuplicates: [],
        versionOk: true
      };
    }
    if (name === 'empty_valid') {
      return {
        parseErrors: [],
        errorRows: [],
        validRows: [],
        validCount: 0,
        totalRows: 0,
        existingCount: state.projects.length,
        existingDuplicates: [],
        versionOk: true
      };
    }
    var validRows = excelScenarioRows(name);
    return {
      parseErrors: [],
      errorRows: [],
      validRows: validRows,
      validCount: validRows.length,
      totalRows: validRows.length,
      existingCount: state.projects.length,
      existingDuplicates: excel.collectExistingDuplicates(validRows, state.projects),
      versionOk: true
    };
  }

  function selectedExcelExistingMode() {
    var wipe = document.querySelector('input[name="excel-existing"][value="wipe"]');
    return wipe && wipe.checked ? 'wipe' : 'keep';
  }

  function selectedExcelDupPolicy() {
    var update = document.querySelector('input[name="excel-dup"][value="update"]');
    var create = document.querySelector('input[name="excel-dup"][value="create"]');
    if (update && update.checked) return 'update';
    if (create && create.checked) return 'create';
    return 'skip';
  }

  function hideExcelPanel() {
    document.getElementById('excel-panel').hidden = true;
    state.excelOpen = false;
  }

  function resetExcelSteps() {
    document.getElementById('excel-intro').hidden = false;
    document.getElementById('excel-preview').hidden = true;
    document.getElementById('excel-result').hidden = true;
    state.excelReport = null;
  }

  function openExcel() {
    if (!excel.showExcelImportButton(state.role)) return;
    state.excelOpen = true;
    resetExcelSteps();
    document.getElementById('excel-panel').hidden = false;
  }

  function renderExcelPreview() {
    var report = state.excelReport;
    if (!report) return;
    document.getElementById('excel-intro').hidden = true;
    document.getElementById('excel-preview').hidden = false;
    document.getElementById('excel-result').hidden = true;
    document.querySelector('[data-testid="excel-total"]').textContent = String(report.totalRows || 0);
    document.querySelector('[data-testid="excel-valid"]').textContent = String(report.validCount || 0);
    document.querySelector('[data-testid="excel-errors"]').textContent = String((report.errorRows || []).length);
    document.getElementById('excel-block').hidden = !((report.parseErrors && report.parseErrors.length) || (report.errorRows && report.errorRows.length));
    document.getElementById('excel-empty').hidden = !!(report.parseErrors && report.parseErrors.length) || !!(report.errorRows && report.errorRows.length) || report.validCount > 0;
    document.getElementById('excel-existing-choice').hidden = !excel.showExistingWorksChoice(report);
    document.getElementById('excel-dup-choice').hidden = !excel.showDuplicatePolicyChoice(report, selectedExcelExistingMode());
    document.querySelector('[data-testid="excel-dup-count"]').textContent = String((report.existingDuplicates || []).length);
    document.getElementById('btn-excel-commit').disabled = !excel.canCommitImport(report);
  }

  function previewExcelScenario() {
    var name = document.getElementById('excel-scenario').value;
    if (!name) return;
    state.excelReport = buildExcelReport(name);
    renderExcelPreview();
  }

  function commitExcelImport() {
    var report = state.excelReport;
    var policy = selectedExcelDupPolicy();
    var wipe = selectedExcelExistingMode() === 'wipe';
    var gate = excel.evaluateCommitImport(report, policy);
    if (!gate.ok) return;
    var result = excel.applyImportPlan(state.projects, report.validRows, {
      wipeExisting: wipe,
      duplicatePolicy: policy
    });
    state.projects = result.projects;
    persistAll();
    document.getElementById('persist-dump').textContent = JSON.stringify(result);
    document.getElementById('excel-preview').hidden = true;
    document.getElementById('excel-intro').hidden = true;
    document.getElementById('excel-result').hidden = false;
    document.querySelector('[data-testid="excel-created"]').textContent = String(result.created);
    document.querySelector('[data-testid="excel-updated"]').textContent = String(result.updated);
    document.querySelector('[data-testid="excel-skipped"]').textContent = String(result.skipped);
    document.getElementById('excel-deleted-wrap').hidden = !result.wipeExisting;
    document.querySelector('[data-testid="excel-deleted"]').textContent = String(result.deletedProjects || 0);
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
    if (state.usersOpen) renderUsers();
    if (state.auditOpen) renderAudit();
    if (state.khmdhsOpen) renderKhmdhsBatch();
    if (state.readingId) syncReadKhmdhsButton();
    document.getElementById('btn-users').hidden = !usersCore.showUserManagementButton(state.role);
    document.getElementById('btn-audit').hidden = !auditCore.showAuditLogButton(state.role);
    document.getElementById('btn-batch-khmdhs').hidden = !khmdhs.showBatchRefreshButton(state.role);
    document.getElementById('btn-excel').hidden = !excel.showExcelImportButton(state.role);
    document.getElementById('btn-stats').hidden = !reports.showStatisticsButton(state.role);
    document.getElementById('btn-technical').hidden = !reports.showTechnicalProgramButton(state.role);
    document.getElementById('btn-export').hidden = !reports.showDataExportButton(state.role);
    document.getElementById('btn-pdf').hidden = !reports.showPdfReportsButton(state.role);
    document.getElementById('btn-portal').hidden = !portal.showPortalButton(state.role);
    document.getElementById('btn-orimanthi').hidden = !ori.showOrimanthiButton(state.role);
    document.getElementById('btn-meletai').hidden = !mlt.showMeletaiButton(state.role);
    document.getElementById('btn-ep').hidden = !ep.showEpProgramButton(state.role);
    document.getElementById('btn-apo').hidden = !apo.showApologismosButton(state.role);
    document.getElementById('btn-backup').hidden = !bk.showBackupButton(state.role);
    renderBackupDeck();
    if (state.orimanthiOpen) renderOrimanthi();
    if (state.meletaiOpen) renderMeletai();
    if (state.epOpen) renderEp();
    if (state.apoOpen) renderApo();
    if (state.backupOpen) renderBackup();
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
  document.getElementById('btn-users').addEventListener('click', openUsers);
  document.getElementById('btn-close-users').addEventListener('click', closeUsers);
  document.getElementById('btn-audit').addEventListener('click', openAudit);
  document.getElementById('btn-batch-khmdhs').addEventListener('click', openKhmdhsBatch);
  document.getElementById('btn-close-khmdhs').addEventListener('click', closeKhmdhsBatch);
  document.getElementById('btn-khmdhs-stale').addEventListener('click', function () {
    state.khmdhsOnlyStale = true;
    renderKhmdhsBatch();
  });
  document.getElementById('btn-khmdhs-all').addEventListener('click', function () {
    state.khmdhsOnlyStale = false;
    renderKhmdhsBatch();
  });
  document.getElementById('btn-khmdhs-refresh').addEventListener('click', startSingleKhmdhsRefresh);
  document.getElementById('btn-post-fetch').addEventListener('click', openPostFetchSetup);
  document.getElementById('btn-resume-pending').addEventListener('click', function () {
    var reopen = pf.resolveReopenPendingList(state.postFetchQueue);
    if (reopen.openPendingTasks) showPendingList();
  });
  document.getElementById('btn-close-post-fetch-setup').addEventListener('click', hidePostFetchPanels);
  document.getElementById('btn-run-fetch-scenario').addEventListener('click', runFetchScenario);
  document.getElementById('btn-close-gate').addEventListener('click', hidePostFetchPanels);
  document.getElementById('btn-pending-later').addEventListener('click', laterFromList);
  document.getElementById('btn-review-later').addEventListener('click', laterFromDetail);
  document.getElementById('btn-detail-done').addEventListener('click', completeActiveTask);
  document.getElementById('chain-kind').addEventListener('change', function () {
    readKindDraftFromForm();
    renderKindForm();
  });
  ['kind-end-date', 'kind-mod-amount', 'kind-mod-type', 'kind-mod-date', 'kind-corrects-adam'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', function () {
      readKindDraftFromForm();
      renderKindForm();
    });
    document.getElementById(id).addEventListener('change', function () {
      readKindDraftFromForm();
      renderKindForm();
    });
  });
  ['title', 'amount', 'date'].forEach(function (part) {
    document.querySelector('[data-testid="kind-part-' + part + '"]').addEventListener('change', function () {
      readKindDraftFromForm();
      renderKindForm();
    });
  });
  document.getElementById('btn-kind-save').addEventListener('click', function () {
    readKindDraftFromForm();
    renderKindForm();
    var draft = state.postFetchKind;
    var validation = pf.validateChainKindDraft(draft);
    if (!pf.shouldShowCharacterizationCard(draft)) return;
    if (!pf.canSaveKindCard(draft.kind, validation) && !validation.ok) return;
    if (!validation.ok) return;
    completeActiveTask();
  });
  document.getElementById('btn-close-audit').addEventListener('click', closeAudit);
  document.getElementById('btn-audit-clear').addEventListener('click', requestAuditClear);
  document.getElementById('audit-entity').addEventListener('change', function (e) {
    state.auditEntity = e.target.value;
    renderAudit();
  });
  document.getElementById('audit-action').addEventListener('change', function (e) {
    state.auditAction = e.target.value;
    renderAudit();
  });
  document.getElementById('btn-new-user').addEventListener('click', openUserCreate);
  document.getElementById('btn-user-create-save').addEventListener('click', saveUserCreate);
  document.getElementById('btn-user-create-cancel').addEventListener('click', closeUserCreate);
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
  document.getElementById('btn-new-custom').addEventListener('click', openCustomCreate);
  document.getElementById('btn-custom-create-save').addEventListener('click', saveCustomCreate);
  document.getElementById('btn-custom-create-cancel').addEventListener('click', closeCustomCreate);
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
  document.getElementById('btn-new-entaxi').addEventListener('click', openEntaxiCreate);
  document.getElementById('btn-ent-create-save').addEventListener('click', saveEntaxiCreate);
  document.getElementById('btn-ent-create-cancel').addEventListener('click', closeEntaxiCreate);
  document.getElementById('btn-new-prosklisi').addEventListener('click', openProsklisiCreate);
  document.getElementById('btn-psk-create-save').addEventListener('click', saveProsklisiCreate);
  document.getElementById('btn-psk-create-cancel').addEventListener('click', closeProsklisiCreate);
  document.getElementById('btn-workflow-delete-confirm').addEventListener('click', confirmWorkflowDelete);
  document.getElementById('btn-workflow-delete-cancel').addEventListener('click', cancelWorkflowDelete);
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
  function catalogRows() {
    return visibleList();
  }

  function statisticsScopeProjects() {
    return state.role === 'ENGINEER'
      ? core.filterProjectsForRole(state.projects, state.role, { username: 'maria' }, [])
      : state.projects;
  }

  function renderStats() {
    var rows = reports.applyPortfolioDrill(catalogRows(), state.statsDrillIds);
    var overview = reports.countOverviewStatistics(rows);
    var scopeNote = reports.engineerStatisticsScopeNote(state.role, statisticsScopeProjects().length);
    var note = reports.buildStatisticsFilterNote({
      scopeNote: scopeNote,
      searchText: state.query,
      status: state.status,
      type: state.type,
      scopeCount: rows.length
    });
    document.getElementById('stats-filter-note').textContent = note;
    var scopeEl = document.getElementById('stats-scope-note');
    scopeEl.hidden = !scopeNote;
    scopeEl.textContent = scopeNote;
    document.getElementById('stats-empty').hidden = rows.length > 0;
    document.querySelector('[data-testid="stats-unique"]').textContent = String(overview.uniqueProjects);
    document.querySelector('[data-testid="stats-total"]').textContent = String(overview.totalProjects);
    document.querySelector('[data-testid="stats-progress"]').textContent = String(overview.inProgressCount);
    document.querySelector('[data-testid="stats-completed"]').textContent = String(overview.completedCount);
  }

  function openStats() {
    if (!reports.showStatisticsButton(state.role)) return;
    state.statsOpen = true;
    document.getElementById('stats-panel').hidden = false;
    renderStats();
  }

  function closeStats() {
    state.statsOpen = false;
    document.getElementById('stats-panel').hidden = true;
  }

  function technicalProjects() {
    return reports.excludeAbandoned(state.projects);
  }

  function renderTechnical() {
    var year = document.getElementById('technical-year').value;
    var all = technicalProjects();
    var rows = reports.buildTechnicalProgramRows(all, year);
    var gate = reports.evaluateTechnicalExport(rows, year);
    document.querySelector('[data-testid="technical-all"]').textContent = String(all.length);
    document.querySelector('[data-testid="technical-rows"]').textContent = String(rows.length);
    var host = document.getElementById('technical-list');
    host.innerHTML = '';
    rows.forEach(function (row) {
      var el = document.createElement('div');
      el.dataset.testid = 'tech-row-' + row.project.subprojectId;
      el.textContent = row.project.subprojectTitle + ' · ' + row.amount;
      host.appendChild(el);
    });
    var empty = document.getElementById('technical-empty');
    empty.hidden = gate.ok;
    empty.textContent = gate.ok ? '' : gate.error;
    document.getElementById('btn-technical-export').disabled = !reports.canCommitTechnicalExport(rows);
  }

  function openTechnical() {
    if (!reports.showTechnicalProgramButton(state.role)) return;
    state.technicalOpen = true;
    document.getElementById('technical-panel').hidden = false;
    renderTechnical();
  }

  function closeTechnical() {
    state.technicalOpen = false;
    document.getElementById('technical-panel').hidden = true;
  }

  function exportFieldCount() {
    return state.exportFieldCount == null ? 3 : state.exportFieldCount;
  }

  function renderExport() {
    var filtered = catalogRows();
    var rows = reports.resolveExportProjects({
      filteredProjects: filtered,
      explicitAbandoned: state.status === reports.STATUS_ABANDONED
    });
    var total = reports.excludeAbandoned(state.projects).length;
    var fields = exportFieldCount();
    document.querySelector('[data-testid="export-total"]').textContent = String(total);
    document.querySelector('[data-testid="export-count"]').textContent = String(rows.length);
    var banner = document.getElementById('export-filter-banner');
    if (reports.isExportFilterActive(rows.length, total)) {
      banner.textContent = 'Ενεργά φίλτρα: θα εξαχθούν ' + rows.length + ' από ' + total + ' υποέργα.';
    } else {
      banner.textContent = 'Θα εξαχθούν όλα τα ' + total + ' υποέργα.';
    }
    var host = document.getElementById('export-list');
    host.innerHTML = '';
    rows.forEach(function (p) {
      var el = document.createElement('div');
      el.dataset.testid = 'export-row-' + p.subprojectId;
      el.textContent = p.subprojectTitle;
      host.appendChild(el);
    });
    document.querySelector('[data-testid="export-fields"]').textContent = String(fields);
    document.getElementById('btn-export-commit').disabled = !reports.canCommitDataExport(fields);
    document.getElementById('export-error').hidden = true;
  }

  function openExport() {
    if (!reports.showDataExportButton(state.role)) return;
    state.exportOpen = true;
    state.exportFieldCount = 3;
    document.getElementById('export-panel').hidden = false;
    renderExport();
  }

  function closeExport() {
    state.exportOpen = false;
    document.getElementById('export-panel').hidden = true;
  }

  function pdfCatalogProjects() {
    return reports.resolveExportProjects({
      filteredProjects: catalogRows(),
      explicitAbandoned: state.status === reports.STATUS_ABANDONED
    });
  }

  function renderPdfReports() {
    var tab = state.pdfTab || 'subprojects';
    var rows = pdfCatalogProjects();
    var summary = reports.countPdfSubprojectsSummary(rows);
    document.querySelector('[data-testid="pdf-total"]').textContent = String(summary.total);
    document.querySelector('[data-testid="pdf-executing"]').textContent = String(summary.executing);
    document.querySelector('[data-testid="pdf-completed"]').textContent = String(summary.completed);
    document.getElementById('pdf-tab-name').textContent = reports.PDF_TAB_NAMES[tab] || '';
    var tabs = document.getElementById('pdf-tabs');
    tabs.innerHTML = '';
    reports.PDF_TABS.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.testid = 'pdf-tab-' + t.id;
      btn.textContent = t.label;
      if (t.id === tab) btn.setAttribute('aria-current', 'true');
      btn.addEventListener('click', function () {
        state.pdfTab = t.id;
        renderPdfReports();
      });
      tabs.appendChild(btn);
    });
    var host = document.getElementById('pdf-list');
    host.innerHTML = '';
    rows.forEach(function (p) {
      var el = document.createElement('div');
      el.dataset.testid = 'pdf-row-' + p.subprojectId;
      el.textContent = p.subprojectTitle;
      host.appendChild(el);
    });
    document.getElementById('btn-pdf-save').disabled = !reports.canSavePdfReport({
      saving: !!state.pdfSaving,
      generating: !!state.pdfGenerating
    });
  }

  function openPdfReports() {
    if (!reports.showPdfReportsButton(state.role)) return;
    state.pdfOpen = true;
    state.pdfTab = 'subprojects';
    state.pdfGenerating = false;
    state.pdfSaving = false;
    document.getElementById('pdf-panel').hidden = false;
    renderPdfReports();
  }

  function closePdfReports() {
    state.pdfOpen = false;
    document.getElementById('pdf-panel').hidden = true;
  }

  function openCardReport(sid) {
    var project = findBySid(sid);
    if (!project || !reports.showCardReportButton()) return;
    document.getElementById('card-report-panel').hidden = false;
    document.querySelector('[data-testid="card-report-title"]').textContent = project.subprojectTitle || '';
    var ents = reports.getLinkedEntaxeis(state.entaxeis, project.subprojectId);
    var psks = reports.getLinkedProskliseis(state.proskliseis, project);
    var entHost = document.getElementById('card-report-entaxeis');
    entHost.innerHTML = '';
    ents.forEach(function (e) {
      var el = document.createElement('div');
      el.dataset.testid = 'card-report-ent-' + e.entaxiId;
      el.textContent = e.subject;
      entHost.appendChild(el);
    });
    var pskHost = document.getElementById('card-report-proskliseis');
    pskHost.innerHTML = '';
    psks.forEach(function (p) {
      var el = document.createElement('div');
      el.dataset.testid = 'card-report-psk-' + p.prosklisiId;
      el.textContent = p.title;
      pskHost.appendChild(el);
    });
  }

  function closeCardReport() {
    document.getElementById('card-report-panel').hidden = true;
  }

  function portalLastExportedIds() {
    return state.portalLastExportedIds || [];
  }

  function renderPortal() {
    document.getElementById('portal-panel').hidden = !state.portalOpen;
    document.querySelector('[data-testid="portal-state"]').textContent = state.portalEnabled ? 'ΕΝΕΡΓΗ' : 'ΑΝΕΝΕΡΓΗ';
    document.getElementById('portal-uid').value = state.portalDimosUid || '';
    document.getElementById('portal-settings').hidden = !portal.showPortalSettingsButton(state.role);
    var canSee = portal.canSeePortalWorkspace(state.role, state.portalEnabled);
    document.getElementById('portal-locked').hidden = canSee;
    document.getElementById('portal-workspace').hidden = !canSee || portal.isEngineerPortalReadOnly(state.role);
    document.getElementById('portal-readonly').hidden = !(canSee && portal.isEngineerPortalReadOnly(state.role));
    if (!canSee || portal.isEngineerPortalReadOnly(state.role)) {
      document.getElementById('btn-portal-export').hidden = true;
      return;
    }
    document.getElementById('btn-portal-export').hidden = false;
    var rows = portal.filterPortalHubProjects(state.projects, {
      search: state.portalSearch,
      filterPublished: state.portalFilterPublished,
      filterStatus: state.portalFilterStatus,
      publishedIds: portalLastExportedIds()
    });
    document.querySelector('[data-testid="portal-list-count"]').textContent = String(rows.length);
    document.querySelector('[data-testid="portal-selected-count"]').textContent = String((state.portalSelectedIds || []).length);
    var preview = portal.previewPortalSelection(state.projects, state.portalSelectedIds);
    document.querySelector('[data-testid="portal-budget"]').textContent = String(preview.totalBudget);
    var host = document.getElementById('portal-list');
    host.innerHTML = '';
    rows.forEach(function (p) {
      var wrap = document.createElement('div');
      wrap.dataset.testid = 'portal-row-' + p.subprojectId;
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.testid = 'portal-check-' + p.subprojectId;
      cb.checked = (state.portalSelectedIds || []).indexOf(p.subprojectId) >= 0;
      cb.addEventListener('change', function () {
        var next = {};
        (state.portalSelectedIds || []).forEach(function (id) { next[id] = true; });
        if (cb.checked) next[p.subprojectId] = true;
        else delete next[p.subprojectId];
        state.portalSelectedIds = Object.keys(next);
        renderPortal();
      });
      wrap.appendChild(cb);
      var title = document.createElement('span');
      title.textContent = p.subprojectTitle;
      wrap.appendChild(title);
      var live = portalLastExportedIds().indexOf(p.subprojectId) >= 0;
      var queued = cb.checked && !live;
      if (live) {
        var badge = document.createElement('span');
        badge.dataset.testid = 'portal-published-' + p.subprojectId;
        badge.textContent = 'Δημοσιευμένο';
        wrap.appendChild(badge);
      }
      if (live && !cb.checked) {
        var leaving = document.createElement('span');
        leaving.dataset.testid = 'portal-leaving-' + p.subprojectId;
        leaving.textContent = 'Θα φύγει';
        wrap.appendChild(leaving);
      }
      if (queued) {
        var nextBadge = document.createElement('span');
        nextBadge.dataset.testid = 'portal-queued-' + p.subprojectId;
        nextBadge.textContent = 'Στην επόμενη';
        wrap.appendChild(nextBadge);
      }
      host.appendChild(wrap);
    });
    document.getElementById('btn-portal-export').disabled = !portal.canCommitPortalExport({
      role: state.role,
      selectedCount: (state.portalSelectedIds || []).length,
      dimosUid: state.portalDimosUid,
      exporting: false
    });
    var err = document.getElementById('portal-export-error');
    if (state.portalExportError) {
      err.hidden = false;
      err.textContent = state.portalExportError;
    } else {
      err.hidden = true;
    }
  }

  function openPortal() {
    if (!portal.showPortalButton(state.role)) return;
    state.portalOpen = true;
    state.portalExportError = '';
    state.portalExported = false;
    document.getElementById('portal-export-preview').hidden = true;
    document.getElementById('portal-panel').hidden = false;
    renderPortal();
  }

  function closePortal() {
    state.portalOpen = false;
    document.getElementById('portal-panel').hidden = true;
  }

  function commitPortalExport() {
    var gate = portal.evaluatePortalExport({
      role: state.role,
      selectedCount: (state.portalSelectedIds || []).length,
      dimosUid: state.portalDimosUid,
      exporting: false
    });
    if (!gate.ok) {
      state.portalExportError = gate.error || '';
      renderPortal();
      return;
    }
    var exported = portal.selectProjectsForPortalExport(state.projects, state.portalSelectedIds);
    state.portalLastExportedIds = exported.map(function (p) { return p.subprojectId; });
    state.portalExportError = '';
    state.portalExported = true;
    var host = document.getElementById('portal-export-preview');
    host.hidden = false;
    host.innerHTML = '';
    exported.forEach(function (p) {
      var entry = portal.buildErgonEntry(p, portal.PORTAL_EXPORT_FIELDS_DEFAULT, state.portalMergeCompleted);
      var el = document.createElement('div');
      el.dataset.testid = 'portal-export-' + entry.id;
      el.textContent = (entry.titlos || '') + ' · ' + (entry.katastasi || '') + (entry.adam ? ' · ' + entry.adam : '');
      if (entry.adam) el.setAttribute('data-adam', entry.adam);
      el.setAttribute('data-status', entry.katastasi || '');
      host.appendChild(el);
    });
    renderPortal();
  }

  function commitExport() {
    var gate = reports.evaluateDataExport(exportFieldCount());
    var err = document.getElementById('export-error');
    if (!gate.ok) {
      err.hidden = false;
      err.textContent = gate.error;
      return;
    }
    err.hidden = true;
  }

  document.getElementById('btn-excel').addEventListener('click', openExcel);
  document.getElementById('btn-close-excel').addEventListener('click', hideExcelPanel);
  document.getElementById('btn-excel-preview').addEventListener('click', previewExcelScenario);
  document.getElementById('btn-excel-back').addEventListener('click', resetExcelSteps);
  document.getElementById('btn-excel-commit').addEventListener('click', commitExcelImport);
  document.getElementById('btn-stats').addEventListener('click', openStats);
  document.getElementById('btn-close-stats').addEventListener('click', closeStats);
  document.getElementById('btn-technical').addEventListener('click', openTechnical);
  document.getElementById('btn-close-technical').addEventListener('click', closeTechnical);
  document.getElementById('technical-year').addEventListener('change', function () {
    if (state.technicalOpen) renderTechnical();
  });
  document.getElementById('btn-export').addEventListener('click', openExport);
  document.getElementById('btn-close-export').addEventListener('click', closeExport);
  document.getElementById('btn-export-clear-fields').addEventListener('click', function () {
    state.exportFieldCount = 0;
    renderExport();
  });
  document.getElementById('btn-export-commit').addEventListener('click', commitExport);
  document.getElementById('btn-pdf').addEventListener('click', openPdfReports);
  document.getElementById('btn-close-pdf').addEventListener('click', closePdfReports);
  document.getElementById('btn-close-card-report').addEventListener('click', closeCardReport);
  function orimanthiActor() {
    return { role: state.role, orimanthiCanEdit: !!state.orimanthiCanEdit };
  }

  function visibleOrimanthi() {
    return ori.filterOrimanthiHub(state.orimanthiProposals, {
      search: state.orimanthiSearch,
      statusFilter: state.orimanthiStatus,
      categoryFilter: state.orimanthiCategory,
      quickFilter: state.orimanthiQuick
    });
  }

  function renderOrimanthi() {
    document.getElementById('orimanthi-panel').hidden = !state.orimanthiOpen;
    var readOnly = ori.isOrimanthiReadOnly(orimanthiActor());
    document.getElementById('orimanthi-readonly').hidden = !readOnly;
    document.getElementById('btn-orimanthi-new').hidden = readOnly;
    document.getElementById('btn-orimanthi-delete').hidden = readOnly;
    document.getElementById('orimanthi-create').hidden = readOnly || !state.orimanthiCreateOpen;
    var selected = state.orimanthiProposals.find(function (p) { return p.id === state.orimanthiSelectedId; });
    document.getElementById('orimanthi-edit').hidden = readOnly || !selected;
    if (selected && document.activeElement !== document.getElementById('orimanthi-edit-title')) {
      document.getElementById('orimanthi-edit-title').value = selected.title || '';
    }
    document.querySelector('[data-testid="orimanthi-aepo-calendar"]').textContent =
      ori.includeAepoInCalendar(orimanthiActor()) ? 'ΝΑΙ' : 'ΟΧΙ';
    document.getElementById('orimanthi-search').value = state.orimanthiSearch;
    document.getElementById('orimanthi-status').value = state.orimanthiStatus;
    document.getElementById('orimanthi-category').value = state.orimanthiCategory;
    document.getElementById('orimanthi-quick').value = state.orimanthiQuick;
    var host = document.getElementById('orimanthi-list');
    host.innerHTML = '';
    visibleOrimanthi().forEach(function (p) {
      var el = document.createElement('div');
      el.dataset.testid = 'ori-card-' + p.id;
      el.textContent = p.title + ' · ' + (p.status || '');
      if (state.orimanthiSelectedId === p.id) el.setAttribute('data-selected', 'true');
      el.addEventListener('click', function () {
        state.orimanthiSelectedId = p.id;
        state.orimanthiConfirmDelete = false;
        renderOrimanthi();
      });
      host.appendChild(el);
    });
    var err = document.getElementById('orimanthi-error');
    if (state.orimanthiError) {
      err.hidden = false;
      err.textContent = state.orimanthiError;
    } else {
      err.hidden = true;
    }
    document.getElementById('orimanthi-delete-confirm').hidden = !state.orimanthiConfirmDelete;
  }

  function openOrimanthi() {
    if (!ori.showOrimanthiButton(state.role)) return;
    state.orimanthiOpen = true;
    state.orimanthiError = '';
    state.orimanthiCreateOpen = false;
    state.orimanthiConfirmDelete = false;
    renderOrimanthi();
  }

  function closeOrimanthi() {
    state.orimanthiOpen = false;
    document.getElementById('orimanthi-panel').hidden = true;
  }

  function submitOrimanthiCreate() {
    var draft = {
      title: document.getElementById('orimanthi-new-title').value,
      projectCategory: document.getElementById('orimanthi-new-category').value,
      infrastructureSpecialization: document.getElementById('orimanthi-new-spec').value
    };
    var gate = ori.evaluateNewProposal(draft);
    if (!gate.ok) {
      state.orimanthiError = gate.error || '';
      renderOrimanthi();
      return;
    }
    var id = 'ori-new-' + state.orimanthiNextId;
    state.orimanthiNextId += 1;
    state.orimanthiProposals = [{
      id: id,
      title: String(draft.title || '').trim(),
      projectCategory: draft.projectCategory,
      infrastructureSpecialization: draft.infrastructureSpecialization || '',
      municipalUnit: '',
      settlement: '',
      status: gate.status || ori.NEW_PROPOSAL_STATUS,
      description: '',
      notes: '',
      aepoRenewalDate: '',
      pendingItems: [],
      fileGroups: []
    }].concat(state.orimanthiProposals);
    state.orimanthiError = '';
    state.orimanthiCreateOpen = false;
    state.orimanthiSelectedId = id;
    document.getElementById('orimanthi-new-title').value = '';
    document.getElementById('orimanthi-new-category').value = '';
    document.getElementById('orimanthi-new-spec').value = '';
    renderOrimanthi();
  }

  function requestOrimanthiDelete() {
    var gate = ori.evaluateProposalDelete({
      role: state.role,
      orimanthiCanEdit: state.orimanthiCanEdit,
      proposalId: state.orimanthiSelectedId
    });
    if (!gate.ok) {
      state.orimanthiError = gate.error || '';
      state.orimanthiConfirmDelete = false;
      renderOrimanthi();
      return;
    }
    state.orimanthiConfirmDelete = true;
    state.orimanthiError = '';
    renderOrimanthi();
  }

  function saveOrimanthiEdit() {
    var selected = state.orimanthiProposals.find(function (p) { return p.id === state.orimanthiSelectedId; });
    if (!selected || ori.isOrimanthiReadOnly(orimanthiActor())) return;
    var nextTitle = document.getElementById('orimanthi-edit-title').value;
    var gate = ori.evaluateProposalSave({ title: nextTitle });
    if (!gate.ok) {
      state.orimanthiError = gate.error || '';
      renderOrimanthi();
      return;
    }
    selected.title = String(nextTitle || '').trim();
    state.orimanthiError = '';
    renderOrimanthi();
  }

  function confirmOrimanthiDelete() {
    var gate = ori.evaluateProposalDelete({
      role: state.role,
      orimanthiCanEdit: state.orimanthiCanEdit,
      proposalId: state.orimanthiSelectedId
    });
    if (!gate.ok) {
      state.orimanthiError = gate.error || '';
      renderOrimanthi();
      return;
    }
    var id = state.orimanthiSelectedId;
    state.orimanthiProposals = state.orimanthiProposals.filter(function (p) { return p.id !== id; });
    state.orimanthiSelectedId = '';
    state.orimanthiConfirmDelete = false;
    renderOrimanthi();
  }

  document.getElementById('btn-orimanthi').addEventListener('click', openOrimanthi);
  document.getElementById('btn-close-orimanthi').addEventListener('click', closeOrimanthi);
  document.getElementById('btn-orimanthi-new').addEventListener('click', function () {
    if (ori.isOrimanthiReadOnly(orimanthiActor())) return;
    state.orimanthiCreateOpen = true;
    state.orimanthiError = '';
    renderOrimanthi();
  });
  document.getElementById('btn-orimanthi-create-save').addEventListener('click', submitOrimanthiCreate);
  document.getElementById('btn-orimanthi-save').addEventListener('click', saveOrimanthiEdit);
  document.getElementById('btn-orimanthi-delete').addEventListener('click', requestOrimanthiDelete);
  document.getElementById('btn-orimanthi-delete-confirm').addEventListener('click', confirmOrimanthiDelete);
  document.getElementById('orimanthi-search').addEventListener('input', function (e) {
    state.orimanthiSearch = e.target.value;
    if (state.orimanthiOpen) renderOrimanthi();
  });
  document.getElementById('orimanthi-status').addEventListener('change', function (e) {
    state.orimanthiStatus = e.target.value;
    if (state.orimanthiOpen) renderOrimanthi();
  });
  document.getElementById('orimanthi-category').addEventListener('change', function (e) {
    state.orimanthiCategory = e.target.value;
    if (state.orimanthiOpen) renderOrimanthi();
  });
  document.getElementById('orimanthi-quick').addEventListener('change', function (e) {
    state.orimanthiQuick = e.target.value;
    if (state.orimanthiOpen) renderOrimanthi();
  });
  document.getElementById('orimanthi-can-edit').addEventListener('change', function (e) {
    state.orimanthiCanEdit = !!e.target.checked;
    if (state.orimanthiOpen) renderOrimanthi();
  });

  function meletaiActor() {
    return { role: state.role, meletaiCanEdit: !!state.meletaiCanEdit };
  }

  function visibleMeletai() {
    return mlt.filterMeletaiHub(state.meletai, {
      search: state.meletaiSearch,
      quickFilter: state.meletaiQuick
    });
  }

  function renderMeletai() {
    document.getElementById('meletai-panel').hidden = !state.meletaiOpen;
    var readOnly = mlt.isMeletaiReadOnly(meletaiActor());
    document.getElementById('meletai-readonly').hidden = !readOnly;
    document.getElementById('btn-meletai-new').hidden = readOnly;
    document.getElementById('btn-meletai-delete').hidden = readOnly;
    document.getElementById('meletai-create').hidden = readOnly || !state.meletaiCreateOpen;
    document.getElementById('meletai-search').value = state.meletaiSearch;
    document.getElementById('meletai-quick').value = state.meletaiQuick;
    var host = document.getElementById('meletai-list');
    host.innerHTML = '';
    visibleMeletai().forEach(function (row) {
      var el = document.createElement('div');
      el.dataset.testid = 'mlt-card-' + row.id;
      el.textContent = (row.studyNumber || '') + ' · ' + (row.title || '');
      if (state.meletaiSelectedId === row.id) el.setAttribute('data-selected', 'true');
      el.addEventListener('click', function () {
        state.meletaiSelectedId = row.id;
        state.meletaiConfirmDelete = false;
        renderMeletai();
      });
      host.appendChild(el);
    });
    var err = document.getElementById('meletai-error');
    if (state.meletaiError) {
      err.hidden = false;
      err.textContent = state.meletaiError;
    } else {
      err.hidden = true;
    }
    document.getElementById('meletai-delete-confirm').hidden = !state.meletaiConfirmDelete;
  }

  function openMeletai() {
    if (!mlt.showMeletaiButton(state.role)) return;
    state.meletaiOpen = true;
    state.meletaiError = '';
    state.meletaiCreateOpen = false;
    state.meletaiConfirmDelete = false;
    renderMeletai();
  }

  function closeMeletai() {
    state.meletaiOpen = false;
    document.getElementById('meletai-panel').hidden = true;
  }

  function studyNumberTaken(studyNumber) {
    var key = mlt.normalizeStudyNumberKey(studyNumber);
    return state.meletai.some(function (row) {
      return mlt.normalizeStudyNumberKey(row.studyNumber) === key;
    });
  }

  function submitMeletaiCreate() {
    var draft = {
      studyNumber: document.getElementById('meletai-new-number').value,
      title: document.getElementById('meletai-new-title').value
    };
    var gate = mlt.evaluateNewMeleti(draft);
    if (!gate.ok) {
      state.meletaiError = gate.error || '';
      renderMeletai();
      return;
    }
    if (studyNumberTaken(gate.studyNumber)) {
      state.meletaiError = 'Ο αριθμός υπάρχει ήδη';
      renderMeletai();
      return;
    }
    var id = 'mlt-new-' + state.meletaiNextId;
    state.meletaiNextId += 1;
    state.meletai = [{
      id: id,
      studyNumber: gate.studyNumber,
      title: gate.title,
      assignedTo: '',
      category: '',
      notes: '',
      linkedSubprojectId: null,
      linkedSubprojectTitle: '',
      linkedProjectTitle: '',
      fileGroups: []
    }].concat(state.meletai);
    state.meletaiError = '';
    state.meletaiCreateOpen = false;
    state.meletaiSelectedId = id;
    document.getElementById('meletai-new-number').value = '';
    document.getElementById('meletai-new-title').value = '';
    renderMeletai();
  }

  function requestMeletaiDelete() {
    var gate = mlt.evaluateMeletiDelete({
      role: state.role,
      meletaiCanEdit: state.meletaiCanEdit,
      meletiId: state.meletaiSelectedId
    });
    if (!gate.ok) {
      state.meletaiError = gate.error || '';
      state.meletaiConfirmDelete = false;
      renderMeletai();
      return;
    }
    state.meletaiConfirmDelete = true;
    state.meletaiError = '';
    renderMeletai();
  }

  function confirmMeletaiDelete() {
    var gate = mlt.evaluateMeletiDelete({
      role: state.role,
      meletaiCanEdit: state.meletaiCanEdit,
      meletiId: state.meletaiSelectedId
    });
    if (!gate.ok) {
      state.meletaiError = gate.error || '';
      renderMeletai();
      return;
    }
    var id = state.meletaiSelectedId;
    state.meletai = state.meletai.filter(function (row) { return row.id !== id; });
    state.meletaiSelectedId = '';
    state.meletaiConfirmDelete = false;
    renderMeletai();
  }

  document.getElementById('btn-meletai').addEventListener('click', openMeletai);
  document.getElementById('btn-close-meletai').addEventListener('click', closeMeletai);
  document.getElementById('btn-meletai-new').addEventListener('click', function () {
    if (mlt.isMeletaiReadOnly(meletaiActor())) return;
    state.meletaiCreateOpen = true;
    state.meletaiError = '';
    renderMeletai();
  });
  document.getElementById('btn-meletai-create-save').addEventListener('click', submitMeletaiCreate);
  document.getElementById('btn-meletai-delete').addEventListener('click', requestMeletaiDelete);
  document.getElementById('btn-meletai-delete-confirm').addEventListener('click', confirmMeletaiDelete);
  document.getElementById('meletai-search').addEventListener('input', function (e) {
    state.meletaiSearch = e.target.value;
    if (state.meletaiOpen) renderMeletai();
  });
  document.getElementById('meletai-quick').addEventListener('change', function (e) {
    state.meletaiQuick = e.target.value;
    if (state.meletaiOpen) renderMeletai();
  });
  document.getElementById('meletai-can-edit').addEventListener('change', function (e) {
    state.meletaiCanEdit = !!e.target.checked;
    if (state.meletaiOpen) renderMeletai();
  });

  function epActor() {
    return { role: state.role };
  }

  function activeEpProgram() {
    return ep.findActiveProgram(state.epPrograms);
  }

  function viewedEpProgram() {
    if (state.epViewId) {
      return state.epPrograms.filter(function (p) { return p.id === state.epViewId; })[0] || null;
    }
    return activeEpProgram();
  }

  function programsWithActions() {
    var viewed = viewedEpProgram();
    return state.epPrograms.map(function (p) {
      if (viewed && p.id === viewed.id) return Object.assign({}, p, { actions: state.epActions });
      return p;
    });
  }

  function visibleEpActions() {
    return ep.filterEpActionsHub(state.epActions, {
      search: state.epSearch,
      filterAxis: state.epAxis,
      filterType: state.epType,
      filterNew: state.epNew
    });
  }

  function renderEp() {
    document.getElementById('ep-panel').hidden = !state.epOpen;
    var program = viewedEpProgram();
    var hasActive = !!activeEpProgram();
    var viewing = !!program;
    document.getElementById('ep-empty').hidden = hasActive || !!state.epViewId;
    var importCopy = ep.epImportScreenCopy();
    var emptyHelp = document.getElementById('ep-empty-help');
    emptyHelp.textContent = importCopy.emptyHelp;
    emptyHelp.hidden = hasActive || !!state.epViewId;
    var periodHelp = document.getElementById('ep-import-period-help');
    periodHelp.textContent = importCopy.periodHelpTitle + ' ' + importCopy.periodHelp;
    periodHelp.hidden = !state.epImportOpen;
    var fileHelp = document.getElementById('ep-import-file-help');
    fileHelp.textContent = importCopy.fileHelpTitle + ' ' + importCopy.fileHelp;
    fileHelp.hidden = !state.epImportOpen;
    var reload = ep.describeEpImportReload(state.epPrograms, state.epImportStart, state.epImportEnd);
    var reloadEl = document.getElementById('ep-import-reload-notice');
    reloadEl.textContent = reload.show ? (reload.title + ' ' + reload.body) : '';
    reloadEl.hidden = !state.epImportOpen || !reload.show;
    document.getElementById('ep-search').hidden = !hasActive;
    document.getElementById('ep-axis').hidden = !hasActive;
    document.getElementById('ep-type').hidden = !hasActive;
    document.getElementById('ep-new').hidden = !hasActive;
    var viewed = viewedEpProgram();
    var period = viewed ? ep.describeEpPeriod(viewed.startYear, viewed.endYear) : null;
    document.getElementById('ep-period').textContent = period ? period.label : '';
    document.getElementById('ep-linked-count').textContent = String(state.epActions.filter(function (row) {
      return (row.linkedSubprojectIds || []).length > 0;
    }).length);
    var sel = document.getElementById('ep-program');
    sel.innerHTML = '';
    state.epPrograms.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = ep.describeEpPeriod(p.startYear, p.endYear).label + (p.isActive ? ' ενεργό' : ' αρχείο');
      sel.appendChild(opt);
    });
    if (viewed) sel.value = viewed.id;
    document.getElementById('ep-archived').textContent = String(ep.countArchivedPrograms(state.epPrograms));
    document.getElementById('btn-ep-new').hidden = !ep.canCreateEpAction({
      role: state.role,
      hasActiveProgram: !!(program && program.isActive)
    });
    document.getElementById('btn-ep-export').hidden = !ep.canExportEpProgram({
      role: state.role,
      hasActiveProgram: viewing
    });
    document.getElementById('btn-ep-import-open').hidden = !ep.canManageEpProgram(epActor());
    document.getElementById('btn-ep-template').hidden = !ep.canDownloadEpTemplate(epActor());
    var templateName = document.getElementById('ep-template-name');
    templateName.textContent = state.epTemplateName || '';
    templateName.hidden = !state.epTemplateName;
    var templateGuide = document.getElementById('ep-template-guide');
    templateGuide.textContent = state.epTemplateGuide || '';
    templateGuide.hidden = !state.epTemplateGuide;
    var templateLocation = document.getElementById('ep-template-location');
    templateLocation.textContent = state.epTemplateLocation || '';
    templateLocation.hidden = !state.epTemplateLocation;
    var templateLists = document.getElementById('ep-template-lists');
    templateLists.textContent = state.epTemplateLists || '';
    templateLists.hidden = !state.epTemplateLists;
    var growingEl = document.getElementById('ep-template-lists-growing');
    growingEl.textContent = state.epTemplateListsGrowing || '';
    growingEl.hidden = !state.epTemplateListsGrowing;
    var fixedEl = document.getElementById('ep-template-lists-fixed');
    fixedEl.textContent = state.epTemplateListsFixed || '';
    fixedEl.hidden = !state.epTemplateListsFixed;
    document.getElementById('ep-template-period').hidden = !state.epTemplatePeriodOpen;
    document.getElementById('ep-tpl-start').value = state.epTplStart || '';
    document.getElementById('ep-tpl-end').value = state.epTplEnd || '';
    document.getElementById('btn-ep-delete').hidden = !ep.canManageEpProgram(epActor()) || !(program && program.isActive);
    document.getElementById('ep-create').hidden = !state.epCreateOpen;
    document.getElementById('ep-import').hidden = !state.epImportOpen;
    document.getElementById('ep-search').value = state.epSearch;
    document.getElementById('ep-axis').value = state.epAxis;
    document.getElementById('ep-type').value = state.epType;
    document.getElementById('ep-new').value = state.epNew;
    document.getElementById('ep-import-start').value = state.epImportStart;
    document.getElementById('ep-import-end').value = state.epImportEnd;
    document.getElementById('ep-import-file').checked = !!state.epImportHasFile;
    var list = document.getElementById('ep-list');
    list.innerHTML = '';
    var groups = document.getElementById('ep-groups');
    groups.innerHTML = '';
    if (viewing) {
      var visible = visibleEpActions();
      var grouped = ep.groupEpActionsByAxis(visible);
      ep.sortedAxisKeys(grouped).forEach(function (axisCode) {
        var label = document.createElement('div');
        label.dataset.testid = 'ep-group-' + axisCode;
        label.textContent = 'Άξονας ' + axisCode + ' (' + grouped[axisCode].length + ')';
        groups.appendChild(label);
      });
      visible.forEach(function (row) {
        var el = document.createElement('div');
        el.dataset.testid = 'ep-card-' + row.id;
        el.textContent = (row.title || '');
        if (state.epSelectedId === row.id) el.setAttribute('data-selected', 'true');
        el.addEventListener('click', function () {
          state.epSelectedId = row.id;
          state.epConfirmDelete = false;
          renderEp();
        });
        list.appendChild(el);
      });
    }
    var err = document.getElementById('ep-error');
    if (state.epError) {
      err.hidden = false;
      err.textContent = state.epError;
    } else {
      err.hidden = true;
    }
    document.getElementById('ep-delete-confirm').hidden = !state.epConfirmDelete;
    if (state.epExported) {
      document.getElementById('btn-ep-export').setAttribute('data-exported', 'true');
    } else {
      document.getElementById('btn-ep-export').removeAttribute('data-exported');
    }
  }

  function openEp() {
    if (!ep.showEpProgramButton(state.role)) return;
    state.epOpen = true;
    state.epError = '';
    state.epCreateOpen = false;
    state.epImportOpen = false;
    state.epConfirmDelete = false;
    renderEp();
  }

  function closeEp() {
    state.epOpen = false;
    document.getElementById('ep-panel').hidden = true;
  }

  function submitEpCreate() {
    var existingAas = state.epActions.map(function (row) { return row.aa; });
    var gate = ep.evaluateEpActionSave({
      title: document.getElementById('ep-new-title').value,
      aa: document.getElementById('ep-new-aa').value,
      existingAas: existingAas
    });
    if (!gate.ok) {
      state.epError = gate.error || '';
      renderEp();
      return;
    }
    var id = 'ep-new-' + state.epNextId;
    state.epNextId += 1;
    state.epActions = [{
      id: id,
      aa: gate.aa,
      axisCode: '1',
      title: gate.title,
      actionType: 'Έργο',
      isNew: true,
      location: '',
      responsibleService: '',
      fundingSources: []
    }].concat(state.epActions);
    state.epError = '';
    state.epCreateOpen = false;
    state.epSelectedId = id;
    document.getElementById('ep-new-title').value = '';
    document.getElementById('ep-new-aa').value = '';
    renderEp();
  }

  function submitEpImport() {
    var gate = ep.evaluateEpImport({
      startYear: document.getElementById('ep-import-start').value,
      endYear: document.getElementById('ep-import-end').value,
      filePath: state.epImportHasFile ? 'C:\\tmp\\ep.xlsx' : ''
    });
    if (!gate.ok) {
      state.epError = gate.error || '';
      renderEp();
      return;
    }
    var full = programsWithActions();
    var source = ep.pickLinkSourceProgram(full, gate.startYear, gate.endYear);
    var incoming = source
      ? (source.actions || []).map(function (row) {
        return Object.assign({}, row, {
          id: 'ep-imp-' + row.id,
          linkedSubprojectIds: []
        });
      })
      : [];
    var transfer = source
      ? ep.transferEpActionLinks(source.actions || [], incoming)
      : { actions: incoming, transferred: 0, unmatched: 0 };
    var newId = 'ep-imported-' + state.epNextId;
    state.epNextId += 1;
    state.epPrograms = full.map(function (row) {
      return Object.assign({}, row, { isActive: false });
    }).concat([{
      id: newId,
      title: (gate.period && gate.period.title) || ('ΕΠΙΧΕΙΡΗΣΙΑΚΟ ΠΡΟΓΡΑΜΜΑ ' + gate.startYear + '-' + gate.endYear),
      startYear: gate.startYear,
      endYear: gate.endYear,
      isActive: true,
      actions: transfer.actions
    }]);
    state.epViewId = newId;
    state.epActions = transfer.actions;
    state.epError = '';
    state.epImportOpen = false;
    renderEp();
  }

  function requestEpDelete() {
    var gate = ep.evaluateEpActionDelete({
      role: state.role,
      actionId: state.epSelectedId
    });
    if (!gate.ok) {
      state.epError = gate.error || '';
      state.epConfirmDelete = false;
      renderEp();
      return;
    }
    state.epConfirmDelete = true;
    state.epError = '';
    renderEp();
  }

  function confirmEpDelete() {
    var gate = ep.evaluateEpActionDelete({
      role: state.role,
      actionId: state.epSelectedId
    });
    if (!gate.ok) {
      state.epError = gate.error || '';
      renderEp();
      return;
    }
    var id = state.epSelectedId;
    state.epActions = state.epActions.filter(function (row) { return row.id !== id; });
    state.epSelectedId = '';
    state.epConfirmDelete = false;
    renderEp();
  }

  document.getElementById('btn-ep').addEventListener('click', openEp);
  document.getElementById('btn-close-ep').addEventListener('click', closeEp);
  document.getElementById('btn-ep-new').addEventListener('click', function () {
    if (!ep.canCreateEpAction({ role: state.role, hasActiveProgram: !!activeEpProgram() })) return;
    state.epCreateOpen = true;
    state.epError = '';
    renderEp();
  });
  document.getElementById('btn-ep-create-save').addEventListener('click', submitEpCreate);
  document.getElementById('btn-ep-import-open').addEventListener('click', function () {
    if (!ep.canManageEpProgram(epActor())) return;
    state.epImportOpen = true;
    state.epError = '';
    renderEp();
  });
  document.getElementById('btn-ep-import-save').addEventListener('click', submitEpImport);
  document.getElementById('btn-ep-template').addEventListener('click', function () {
    if (!ep.canDownloadEpTemplate(epActor())) return;
    var draft = ep.suggestTemplatePeriodDraft({
      startYear: document.getElementById('ep-import-start').value,
      endYear: document.getElementById('ep-import-end').value,
      nowYear: 2026
    });
    state.epTplStart = draft.startYear;
    state.epTplEnd = draft.endYear;
    state.epTemplatePeriodOpen = true;
    state.epError = '';
    renderEp();
  });
  document.getElementById('btn-ep-template-confirm').addEventListener('click', function () {
    if (!ep.canDownloadEpTemplate(epActor())) return;
    var period = ep.evaluateTemplateDownload({
      startYear: document.getElementById('ep-tpl-start').value,
      endYear: document.getElementById('ep-tpl-end').value
    });
    if (!period.ok) {
      state.epError = period.error || '';
      renderEp();
      return;
    }
    var model = ep.buildEpImportTemplateModel(period.startYear, period.endYear, {
      municipalUnits: state.municipalUnits
    });
    if (!model.ok) {
      state.epError = model.error || '';
      renderEp();
      return;
    }
    state.epTemplateName = model.filename;
    state.epTemplateGuide = ep.flattenEpTemplateInstructions(model);
    state.epTemplateLocation = model.exampleLocation;
    var growing = ((model.listModel && model.listModel.growing) || []).map(function (col) { return col.header; });
    var fixed = ((model.listModel && model.listModel.fixed) || []).map(function (col) { return col.header; });
    state.epTemplateLists = growing.concat(fixed).join(' · ');
    state.epTemplateListsGrowing = growing.join(' · ');
    state.epTemplateListsFixed = fixed.join(' · ');
    state.epTemplatePeriodOpen = false;
    state.epError = '';
    renderEp();
  });
  document.getElementById('btn-ep-clear-units').addEventListener('click', function () {
    state.municipalUnits = [];
    renderEp();
  });
  document.getElementById('btn-ep-export').addEventListener('click', function () {
    if (!ep.canExportEpProgram({ role: state.role, hasActiveProgram: !!activeEpProgram() })) return;
    state.epExported = true;
    renderEp();
  });
  document.getElementById('btn-ep-delete').addEventListener('click', requestEpDelete);
  document.getElementById('btn-ep-delete-confirm').addEventListener('click', confirmEpDelete);
  document.getElementById('btn-ep-unload').addEventListener('click', function () {
    state.epPrograms = programsWithActions().map(function (row) {
      return Object.assign({}, row, { isActive: false });
    });
    state.epViewId = '';
    state.epCreateOpen = false;
    state.epConfirmDelete = false;
    renderEp();
  });
  document.getElementById('ep-program').addEventListener('change', function (e) {
    var cur = viewedEpProgram();
    if (cur) {
      state.epPrograms = state.epPrograms.map(function (p) {
        return p.id === cur.id ? Object.assign({}, p, { actions: state.epActions }) : p;
      });
    }
    state.epViewId = e.target.value;
    var next = viewedEpProgram();
    state.epActions = (next && next.actions) || [];
    renderEp();
  });
  document.getElementById('ep-search').addEventListener('input', function (e) {
    state.epSearch = e.target.value;
    if (state.epOpen) renderEp();
  });
  document.getElementById('ep-axis').addEventListener('change', function (e) {
    state.epAxis = e.target.value;
    if (state.epOpen) renderEp();
  });
  document.getElementById('ep-type').addEventListener('change', function (e) {
    state.epType = e.target.value;
    if (state.epOpen) renderEp();
  });
  document.getElementById('ep-new').addEventListener('change', function (e) {
    state.epNew = e.target.value;
    if (state.epOpen) renderEp();
  });
  document.getElementById('ep-import-start').addEventListener('input', function (e) {
    state.epImportStart = ep.filterImportYearInput(e.target.value);
    var end = ep.defaultImportEndYear(state.epImportStart);
    if (end) state.epImportEnd = end;
    if (state.epOpen) renderEp();
  });
  document.getElementById('ep-import-end').addEventListener('input', function (e) {
    state.epImportEnd = ep.filterImportYearInput(e.target.value);
    if (state.epOpen) renderEp();
  });
  document.getElementById('ep-import-file').addEventListener('change', function (e) {
    state.epImportHasFile = !!e.target.checked;
    if (state.epOpen) renderEp();
  });
  document.getElementById('ep-tpl-start').addEventListener('input', function (e) {
    state.epTplStart = ep.filterImportYearInput(e.target.value);
    var end = ep.defaultImportEndYear(state.epTplStart);
    if (end) state.epTplEnd = end;
    if (state.epOpen) renderEp();
  });
  document.getElementById('ep-tpl-end').addEventListener('input', function (e) {
    state.epTplEnd = ep.filterImportYearInput(e.target.value);
    if (state.epOpen) renderEp();
  });

  function apoSelected() {
    return state.apoCards.filter(function (c) { return c.id === state.apoSelectedId; })[0] || null;
  }

  function renderApo() {
    document.getElementById('apo-panel').hidden = !state.apoOpen;
    if (!state.apoOpen) return;
    document.getElementById('apo-period-label').textContent = state.apoPeriod.label;
    document.getElementById('apo-period-start').value = state.apoPeriodStart;
    document.getElementById('apo-period-end').value = state.apoPeriodEnd;
    var readyCount = state.apoCards.filter(function (c) { return c.ready; }).length;
    document.getElementById('apo-counts').textContent =
      state.apoCards.length + ' κάρτες · ' + readyCount + ' έτοιμες';
    var visible = apo.filterApologismosCards(state.apoCards, {
      search: state.apoSearch,
      status: state.apoFilter
    });
    document.getElementById('apo-empty').hidden = state.apoCards.length !== 0;
    document.getElementById('apo-none').hidden = !(state.apoCards.length && !visible.length);
    var err = document.getElementById('apo-error');
    err.textContent = state.apoError || '';
    err.hidden = !state.apoError;
    var present = document.getElementById('apo-present');
    present.textContent = state.apoPresent || '';
    present.hidden = !state.apoPresent;
    document.getElementById('apo-search').value = state.apoSearch;
    document.getElementById('apo-filter').value = state.apoFilter;
    document.getElementById('apo-eligible').hidden = !state.apoEligibleOpen;
    document.getElementById('apo-legacy').hidden = !state.apoLegacyOpen;
    document.getElementById('apo-delete-confirm').hidden = !state.apoConfirmDelete;
    var list = document.getElementById('apo-list');
    list.innerHTML = '';
    visible.forEach(function (card) {
      var el = document.createElement('article');
      el.setAttribute('data-testid', 'apo-card-' + card.id);
      el.textContent = (card.ready ? 'Έτοιμο · ' : 'Εκκρεμές · ') + card.title
        + (card.area ? ' · ' + card.area : '');
      el.addEventListener('click', function () {
        state.apoSelectedId = card.id;
        state.apoError = '';
        renderApo();
      });
      list.appendChild(el);
    });
    var eligibleHost = document.getElementById('apo-eligible-list');
    eligibleHost.innerHTML = '';
    var eligible = apo.listEligibleSubprojects(state.projects, state.apoCards);
    document.getElementById('apo-eligible-empty').hidden = !state.apoEligibleOpen || eligible.length > 0;
    eligible.forEach(function (sub) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-testid', 'apo-eligible-' + sub.subprojectId);
      btn.textContent = sub.subprojectTitle || sub.projectTitle;
      btn.addEventListener('click', function () { addApoFromSub(sub); });
      eligibleHost.appendChild(btn);
    });
  }

  function openApo() {
    if (!apo.showApologismosButton(state.role)) return;
    state.apoOpen = true;
    state.apoError = '';
    state.apoPresent = '';
    renderApo();
  }

  function addApoFromSub(sub) {
    var check = apo.canAddLinkedSubproject(sub, state.apoCards);
    if (!check.ok) {
      state.apoError = check.error;
      renderApo();
      return;
    }
    var mapped = apo.mapSubprojectToCardFields(sub);
    var card = apo.withReadiness(Object.assign({
      id: 'apo-' + state.apoNextId,
      categoryId: '',
      narrative: '',
      primaryViz: ''
    }, mapped));
    state.apoNextId += 1;
    state.apoCards.push(card);
    state.apoSelectedId = card.id;
    state.apoEligibleOpen = false;
    state.apoError = '';
    renderApo();
  }

  function submitApoLegacy() {
    var input = {
      title: document.getElementById('apo-legacy-title').value,
      area: document.getElementById('apo-legacy-area').value,
      completionYear: document.getElementById('apo-legacy-year').value,
      approvedAmount: document.getElementById('apo-legacy-approved').value,
      contractAmount: document.getElementById('apo-legacy-contract').value
    };
    var check = apo.validateLegacyCardInput(input, state.apoPeriod);
    if (!check.ok) {
      state.apoError = check.errors.join(' · ');
      renderApo();
      return;
    }
    var card = apo.withReadiness({
      id: 'apo-' + state.apoNextId,
      source: 'legacy',
      title: check.normalized.title,
      area: check.normalized.area,
      completionYear: check.normalized.completionYear,
      approvedAmount: check.normalized.approvedAmount,
      contractAmount: check.normalized.contractAmount,
      categoryId: '',
      narrative: '',
      primaryViz: ''
    });
    state.apoNextId += 1;
    state.apoCards.push(card);
    state.apoSelectedId = card.id;
    state.apoLegacyOpen = false;
    state.apoError = '';
    renderApo();
  }

  document.getElementById('btn-apo').addEventListener('click', openApo);
  document.getElementById('btn-close-apo').addEventListener('click', function () {
    state.apoOpen = false;
    renderApo();
  });
  document.getElementById('btn-apo-eligible').addEventListener('click', function () {
    state.apoEligibleOpen = !state.apoEligibleOpen;
    state.apoLegacyOpen = false;
    state.apoError = '';
    renderApo();
  });
  document.getElementById('btn-apo-legacy').addEventListener('click', function () {
    state.apoLegacyOpen = !state.apoLegacyOpen;
    state.apoEligibleOpen = false;
    state.apoError = '';
    renderApo();
  });
  document.getElementById('btn-apo-legacy-save').addEventListener('click', submitApoLegacy);
  document.getElementById('btn-apo-present').addEventListener('click', function () {
    if (!apo.canStartPresentation(state.apoCards)) {
      state.apoPresent = 'Δεν υπάρχουν έτοιμες κάρτες για παρουσίαση';
    } else {
      state.apoPresent = 'Παρουσίαση έτοιμη';
    }
    renderApo();
  });
  document.getElementById('btn-apo-complete').addEventListener('click', function () {
    var selected = apoSelected();
    if (!selected) {
      state.apoError = 'Απαιτείται κάρτα';
      renderApo();
      return;
    }
    state.apoCards = state.apoCards.map(function (c) {
      return c.id === selected.id ? apo.completeAsSimpleCard(c) : c;
    });
    state.apoError = '';
    renderApo();
  });
  document.getElementById('btn-apo-delete').addEventListener('click', function () {
    var gate = apo.evaluateCardRemove(state.apoSelectedId);
    if (!gate.ok) {
      state.apoError = gate.error;
      renderApo();
      return;
    }
    state.apoConfirmDelete = true;
    renderApo();
  });
  document.getElementById('btn-apo-delete-confirm').addEventListener('click', function () {
    state.apoCards = state.apoCards.filter(function (c) { return c.id !== state.apoSelectedId; });
    state.apoSelectedId = '';
    state.apoConfirmDelete = false;
    renderApo();
  });
  document.getElementById('btn-apo-period-save').addEventListener('click', function () {
    var gate = apo.evaluateApologismosPeriod(state.apoPeriodStart, state.apoPeriodEnd);
    if (!gate.ok) {
      state.apoError = gate.error;
      renderApo();
      return;
    }
    state.apoPeriod = {
      id: gate.id,
      startYear: gate.startYear,
      endYear: gate.endYear,
      label: gate.label,
      isCurrent: true
    };
    state.apoError = '';
    renderApo();
  });
  document.getElementById('apo-search').addEventListener('input', function (e) {
    state.apoSearch = e.target.value;
    renderApo();
  });
  document.getElementById('apo-filter').addEventListener('change', function (e) {
    state.apoFilter = e.target.value;
    renderApo();
  });
  document.getElementById('apo-period-start').addEventListener('input', function (e) {
    state.apoPeriodStart = apo.filterYearInput(e.target.value);
    if (state.apoOpen) renderApo();
  });
  document.getElementById('apo-period-end').addEventListener('input', function (e) {
    state.apoPeriodEnd = apo.filterYearInput(e.target.value);
    if (state.apoOpen) renderApo();
  });

  document.getElementById('btn-portal').addEventListener('click', openPortal);
  document.getElementById('btn-close-portal').addEventListener('click', closePortal);
  document.getElementById('btn-portal-export').addEventListener('click', commitPortalExport);
  document.getElementById('btn-portal-select-filtered').addEventListener('click', function () {
    var rows = portal.filterPortalHubProjects(state.projects, {
      search: state.portalSearch,
      filterPublished: state.portalFilterPublished,
      filterStatus: state.portalFilterStatus,
      publishedIds: portalLastExportedIds()
    });
    state.portalSelectedIds = portal.applySelectFiltered(rows);
    renderPortal();
  });
  document.getElementById('portal-search').addEventListener('input', function (e) {
    state.portalSearch = e.target.value;
    if (state.portalOpen) renderPortal();
  });
  document.getElementById('portal-filter-published').addEventListener('change', function (e) {
    state.portalFilterPublished = e.target.value;
    if (state.portalOpen) renderPortal();
  });
  document.getElementById('portal-uid').addEventListener('input', function (e) {
    state.portalDimosUid = e.target.value;
    if (state.portalOpen) renderPortal();
  });
  document.getElementById('btn-portal-toggle-enabled').addEventListener('click', function () {
    state.portalEnabled = !state.portalEnabled;
    if (state.portalOpen) renderPortal();
    if (state.readingId) {
      var cur = findBySid(state.readingId);
      if (cur) renderReadPortal(cur);
    }
  });
  document.getElementById('btn-read-portal-toggle').addEventListener('click', function () {
    if (!state.readingId || !portal.canTogglePortalOnCard(state.role)) return;
    state.portalSelectedIds = portal.togglePublishedId(state.portalSelectedIds, state.readingId);
    renderReadPortal(findBySid(state.readingId));
    if (state.portalOpen) renderPortal();
  });
  document.querySelectorAll('input[name="excel-existing"]').forEach(function (el) {
    el.addEventListener('change', function () {
      if (state.excelReport) renderExcelPreview();
    });
  });

  function renderBackupDeck() {
    var rem = bk.evaluateBackupReminder(state.backups, state.backupNowMs);
    var show = bk.showBackupButton(state.role) && rem.reminderDue;
    document.getElementById('backup-deck-reminder').hidden = !show;
    if (!show) return;
    document.getElementById('backup-deck-title').textContent = bk.backupReminderTitle(rem.hasBackup);
    document.getElementById('backup-deck-detail').textContent = bk.backupReminderDetail(rem.hasBackup);
    var days = document.getElementById('backup-deck-days');
    if (rem.hasBackup && rem.daysSince != null) {
      days.textContent = rem.daysSince + ' ημ.';
      days.hidden = false;
    } else {
      days.textContent = '';
      days.hidden = true;
    }
  }

  function renderBackup() {
    document.getElementById('backup-panel').hidden = !state.backupOpen;
    renderBackupDeck();
    if (!state.backupOpen) return;
    var rem = bk.evaluateBackupReminder(state.backups, state.backupNowMs);
    document.getElementById('backup-status').textContent = rem.hasBackup
      ? 'Τελευταίο αντίγραφο ασφαλείας'
      : 'Δεν έχει δημιουργηθεί ποτέ αντίγραφο ασφαλείας.';
    var err = document.getElementById('backup-error');
    err.textContent = state.backupError || '';
    err.hidden = !state.backupError;
    document.getElementById('backup-location').hidden = !bk.canSeeBackupLocation(state.role);
    document.getElementById('backup-history').hidden = !state.backupHistoryOpen;
    document.getElementById('backup-empty').hidden = !(state.backupHistoryOpen && !state.backups.length);
    document.getElementById('backup-live').textContent = state.backupLiveTitle;
    var toast = document.getElementById('backup-toast');
    toast.textContent = state.backupToastText || '';
    toast.hidden = !state.backupToastText;
    document.getElementById('backup-toast-count').textContent = String(state.backupToastCount);
    var createReport = document.getElementById('backup-create-report');
    createReport.innerHTML = '';
    if (state.backupCreateCoverage.length) {
      createReport.hidden = false;
      state.backupCreateCoverage.forEach(function (area) {
        var li = document.createElement('p');
        li.textContent = area;
        createReport.appendChild(li);
      });
    } else {
      createReport.hidden = true;
    }
    document.getElementById('backup-delete-confirm').hidden = !state.backupPendingDeleteId;
    document.getElementById('backup-restore-confirm').hidden = !state.backupPendingRestoreId;
    document.getElementById('backup-restore-kind').textContent = state.backupPendingRestoreId ? bk.restoreKindLabel() : '';
    document.getElementById('backup-restore-confirm-title').textContent = state.backupPendingRestoreId ? bk.restoreConfirmTitle() : '';
    document.getElementById('backup-restore-confirm-detail').textContent = state.backupPendingRestoreId ? bk.restoreConfirmDetail() : '';
    var done = document.getElementById('backup-restore-done');
    done.textContent = state.backupRestored ? bk.evaluateRestoreOutcome({ applyOk: true }).message : '';
    done.hidden = !state.backupRestored;
    var rolled = document.getElementById('backup-restore-rolled');
    rolled.textContent = state.backupRolledBack ? bk.evaluateRestoreOutcome({ applyOk: false, rolledBack: true }).message : '';
    rolled.hidden = !state.backupRolledBack;
    var prog = document.getElementById('backup-restore-progress');
    prog.textContent = state.backupRestorePhase ? bk.restoreProgressLabel(state.backupRestorePhase) : '';
    prog.hidden = !state.backupRestorePhase;
    var report = document.getElementById('backup-restore-report');
    report.innerHTML = '';
    if (state.backupRestored && state.backupCoverage.length) {
      state.backupCoverage.forEach(function (area) {
        var li = document.createElement('p');
        li.textContent = area;
        report.appendChild(li);
      });
      report.hidden = false;
    } else {
      report.hidden = true;
    }
    document.getElementById('btn-backup-restart').hidden = !state.backupRestored;
    var list = document.getElementById('backup-list');
    list.innerHTML = '';
    if (!state.backupHistoryOpen) return;
    state.backups.forEach(function (b) {
      var row = document.createElement('article');
      row.setAttribute('data-testid', 'backup-item-' + b.backupId);
      var name = document.createElement('p');
      name.textContent = b.fileName || b.backupId;
      row.appendChild(name);
      if (b.status === 'success' && bk.canRestoreBackup(state.role)) {
        var rest = document.createElement('button');
        rest.type = 'button';
        rest.setAttribute('data-testid', 'btn-backup-restore-' + b.backupId);
        rest.textContent = 'Επαναφορά';
        rest.addEventListener('click', function () {
          var check = bk.evaluateRestoreBackup({ role: state.role, backupId: b.backupId });
          if (!check.ok) {
            state.backupError = check.error;
            renderBackup();
            return;
          }
          state.backupPendingRestoreId = b.backupId;
          state.backupError = '';
          renderBackup();
        });
        row.appendChild(rest);
      }
      if (bk.canDeleteBackup(state.role)) {
        var del = document.createElement('button');
        del.type = 'button';
        del.setAttribute('data-testid', 'btn-backup-delete-' + b.backupId);
        del.textContent = 'Διαγραφή';
        del.addEventListener('click', function () {
          var check = bk.evaluateDeleteBackup({ role: state.role, backupId: b.backupId });
          if (!check.ok) {
            state.backupError = check.error;
            renderBackup();
            return;
          }
          state.backupPendingDeleteId = b.backupId;
          state.backupError = '';
          renderBackup();
        });
        row.appendChild(del);
      }
      list.appendChild(row);
    });
  }

  function openBackup() {
    if (!bk.showBackupButton(state.role)) return;
    state.backupOpen = true;
    state.backupError = '';
    state.backupRestored = false;
    state.backupRolledBack = false;
    renderBackup();
  }

  function createHarnessBackup() {
    var check = bk.evaluateCreateBackup({
      role: state.role,
      inProgress: state.backupInProgress
    });
    if (!check.ok) {
      state.backupError = check.error;
      renderBackup();
      return;
    }
    var live = state.backupLiveEntries || [];
    var selected = bk.selectBackupEntryNames(live);
    var omit = state.backupOmitFromZip || [];
    var zipTop = selected.filter(function (n) { return omit.indexOf(n) === -1; });
    var coverage = bk.evaluateBackupCoverage({
      liveEntries: live,
      selectedEntries: selected,
      zipTopLevel: zipTop
    });
    if (!coverage.ok) {
      state.backupError = coverage.message;
      state.backupCreateCoverage = [];
      renderBackup();
      return;
    }
    var id = 'b' + state.backupNextId;
    state.backupNextId += 1;
    state.backups.unshift({
      backupId: id,
      fileName: 'ERGOHUB_backup_' + id + '.zip',
      status: 'success',
      type: 'manual',
      timestamp: new Date(state.backupNowMs).toISOString(),
      createdBy: { fullName: currentUser().fullName },
      contents: { areas: coverage.areas }
    });
    state.backupCreateCoverage = coverage.areas;
    state.backupError = '';
    state.backupHistoryOpen = true;
    state.backupToastCount += 1;
    state.backupToastText = 'Το backup ολοκληρώθηκε επιτυχώς!';
    renderBackup();
  }

  document.getElementById('btn-backup').addEventListener('click', openBackup);
  document.getElementById('btn-backup-now').addEventListener('click', openBackup);
  document.getElementById('btn-close-backup').addEventListener('click', function () {
    state.backupOpen = false;
    renderBackup();
  });
  document.getElementById('btn-backup-create').addEventListener('click', createHarnessBackup);
  document.getElementById('btn-backup-history').addEventListener('click', function () {
    state.backupHistoryOpen = true;
    renderBackup();
  });
  document.getElementById('btn-backup-delete-confirm').addEventListener('click', function () {
    if (!state.backupPendingDeleteId) return;
    var check = bk.evaluateDeleteBackup({ role: state.role, backupId: state.backupPendingDeleteId });
    if (!check.ok) {
      state.backupError = check.error;
      state.backupPendingDeleteId = '';
      renderBackup();
      return;
    }
    state.backups = state.backups.filter(function (b) {
      return b.backupId !== state.backupPendingDeleteId;
    });
    state.backupPendingDeleteId = '';
    state.backupError = '';
    renderBackup();
  });
  document.getElementById('btn-backup-restore-confirm').addEventListener('click', function () {
    if (!state.backupPendingRestoreId) return;
    var check = bk.evaluateRestoreBackup({ role: state.role, backupId: state.backupPendingRestoreId });
    if (!check.ok) {
      state.backupError = check.error;
      state.backupPendingRestoreId = '';
      renderBackup();
      return;
    }
    var ready = bk.evaluateRestoreReadyToApply({
      safetyOk: !state.backupFailSafety,
      extractedReady: !state.backupFailSafety && !state.backupFailExtract
    });
    if (!ready.canApply) {
      state.backupError = ready.error;
      state.backupPendingRestoreId = '';
      state.backupRestored = false;
      state.backupRolledBack = false;
      renderBackup();
      return;
    }
    state.backupRestorePhase = 'restore-safety';
    renderBackup();
    if (state.backupFailNextApply) {
      state.backupFailNextApply = false;
      state.backupRestorePhase = 'restore-rollback';
      state.backupRolledBack = true;
      state.backupRestored = false;
      state.backupError = bk.evaluateRestoreOutcome({ applyOk: false, rolledBack: true }).message;
      state.backupPendingRestoreId = '';
      renderBackup();
      return;
    }
    state.backupRestorePhase = 'restore-apply';
    state.backupLiveTitle = 'δεδομένα αντιγράφου';
    state.backupRestored = true;
    state.backupRolledBack = false;
    state.backupCoverage = bk.summarizeRestoredAreas([
      'aaaaaaaa-1111-2222-3333-444444444444',
      'users.json',
      'ΠΡΟΣΚΛΗΣΕΙΣ',
      'entaxeis',
      'EGKRISEIS_DIATHESIS_PISTOSIS',
      'ΜΕΛΕΤΕΣ',
      'ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ',
      'ΕΠΙΧΕΙΡΗΣΙΑΚΟ_ΠΡΟΓΡΑΜΜΑ',
      'ΑΠΟΛΟΓΙΣΜΟΣ',
      'ANATHESEIS_ERGASION',
      'config'
    ]);
    state.backupPendingRestoreId = '';
    state.backupError = '';
    state.backupRestorePhase = '';
    renderBackup();
  });

  window.__e2eSeedBackups = function (items, nowMs) {
    state.backups = (items || []).slice();
    if (nowMs != null) state.backupNowMs = nowMs;
    if (state.backupOpen) renderBackup();
    else renderBackupDeck();
  };
  window.__e2eSetBackupInProgress = function (flag) {
    state.backupInProgress = !!flag;
  };
  window.__e2eFailNextRestoreApply = function (flag) {
    state.backupFailNextApply = !!flag;
  };
  window.__e2eFailSafetyBackup = function (flag) {
    state.backupFailSafety = !!flag;
  };
  window.__e2eFailRestoreExtract = function (flag) {
    state.backupFailExtract = !!flag;
  };
  window.__e2eOmitBackupFromZip = function (names) {
    state.backupOmitFromZip = names || [];
  };
  document.getElementById('btn-backup-restart').addEventListener('click', function () {
    state.backupRestarted = true;
    renderBackup();
  });

  state.projects = loadStore();
  renderCards();
})();

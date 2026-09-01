'use strict';

const fs = require('fs');
const path = require('path');
const { hashPassword } = require('../../public/passwordAuth');
const { upsertProjectsIndexEntry } = require('../../public/projectsIndex');

const PASSWORD = 'TestPass12!';

const USERS = {
  superadmin: { username: 'e2eadmin', password: PASSWORD, fullName: 'E2E Υπερδιαχειριστής', role: 'SUPERADMIN' },
  admin: { username: 'e2eadmin', password: PASSWORD, fullName: 'E2E Υπερδιαχειριστής', role: 'SUPERADMIN' },
  maria: { username: 'maria', password: PASSWORD, fullName: 'Μαρία Παπαδοπούλου', role: 'ENGINEER' },
  nikos: { username: 'nikos', password: PASSWORD, fullName: 'Νίκος Γεωργίου', role: 'ENGINEER' },
  elena: { username: 'elena', password: PASSWORD, fullName: 'Ελένη Αντωνίου', role: 'ENGINEER' },
  viewer: { username: 'viewer', password: PASSWORD, fullName: 'Απλός Χρήστης', role: 'USER' },
  manager: { username: 'manager', password: PASSWORD, fullName: 'Διαχειριστής Δοκιμών', role: 'ADMIN' },
  pending: { username: 'pending', password: PASSWORD, fullName: 'Σε Αναμονή', role: 'USER' },
  kokolaki: { username: 'kokolaki', password: PASSWORD, fullName: 'Μαρία Κοκολάκη', role: 'USER' },
};

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function isoDaysFromToday(offset) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString();
}

function dateKeyFromToday(offset) {
  return isoDaysFromToday(offset).slice(0, 10);
}

function buildUsers() {
  const now = new Date().toISOString();
  return [
    {
      username: 'e2eadmin',
      passwordHash: hashPassword(PASSWORD),
      role: 'SUPERADMIN',
      fullName: 'E2E Υπερδιαχειριστής',
      email: 'ergohubapp@gmail.com',
      active: true,
      approved: true,
      assignedSupervisors: [],
      taskAssignment: { canAssign: true, assignableScope: 'all', assignableUsernames: [] },
      createdAt: now,
    },
    {
      username: 'manager',
      passwordHash: hashPassword(PASSWORD),
      role: 'ADMIN',
      fullName: 'Διαχειριστής Δοκιμών',
      email: 'ergohubapp@gmail.com',
      active: true,
      approved: true,
      assignedSupervisors: [],
      taskAssignment: { canAssign: true, assignableScope: 'all', assignableUsernames: [] },
      createdAt: now,
    },
    {
      username: 'maria',
      passwordHash: hashPassword(PASSWORD),
      role: 'ENGINEER',
      fullName: 'Μαρία Παπαδοπούλου',
      email: 'ergohubapp@gmail.com',
      active: true,
      approved: true,
      assignedSupervisors: [],
      taskAssignment: { canAssign: false, assignableScope: 'none', assignableUsernames: [] },
      createdAt: now,
    },
    {
      username: 'nikos',
      passwordHash: hashPassword(PASSWORD),
      role: 'ENGINEER',
      fullName: 'Νίκος Γεωργίου',
      email: 'ergohubapp@gmail.com',
      active: true,
      approved: true,
      assignedSupervisors: [],
      taskAssignment: { canAssign: false, assignableScope: 'none', assignableUsernames: [] },
      createdAt: now,
    },
    {
      username: 'elena',
      passwordHash: hashPassword(PASSWORD),
      role: 'ENGINEER',
      fullName: 'Ελένη Αντωνίου',
      email: 'ergohubapp@gmail.com',
      active: true,
      approved: true,
      assignedSupervisors: [],
      taskAssignment: { canAssign: false, assignableScope: 'none', assignableUsernames: [] },
      createdAt: now,
    },
    {
      username: 'viewer',
      passwordHash: hashPassword(PASSWORD),
      role: 'USER',
      fullName: 'Απλός Χρήστης',
      email: 'ergohubapp@gmail.com',
      active: true,
      approved: true,
      assignedSupervisors: [],
      taskAssignment: { canAssign: false, assignableScope: 'none', assignableUsernames: [] },
      createdAt: now,
    },
    {
      username: 'kokolaki',
      passwordHash: hashPassword(PASSWORD),
      role: 'USER',
      fullName: 'Μαρία Κοκολάκη',
      email: 'ergohubapp@gmail.com',
      active: true,
      approved: true,
      orimanthiCanEdit: true,
      assignedSupervisors: [],
      taskAssignment: { canAssign: false, assignableScope: 'none', assignableUsernames: [] },
      createdAt: now,
    },
    {
      username: 'pending',
      passwordHash: hashPassword(PASSWORD),
      role: 'USER',
      fullName: 'Σε Αναμονή',
      email: 'ergohubapp@gmail.com',
      active: true,
      approved: false,
      assignedSupervisors: [],
      createdAt: now,
    },
  ];
}

function withSavablePhaseA(p) {
  const implOk = p.implementationForm === 'Μια Σύμβαση' || p.implementationForm === 'Πολλές Συμβάσεις';
  return {
    ...p,
    implementationForm: implOk ? p.implementationForm : 'Μια Σύμβαση',
    fundingSource: 'ΕΣΠΑ 2021_2027',
    fundingDetails: '0501. ΕΠ Ανταγωνιστικότητα',
    approvedAmount: p.approvedAmount || '100.000,00',
  };
}

function buildSubprojects() {
  return [
    withSavablePhaseA({
      projectId: 'proj-road',
      subprojectId: 'sub-bridge',
      projectTitle: 'Οδικό δίκτυο Αρχανών',
      subprojectTitle: 'Γέφυρα Αγίου Σύλλα',
      kaCode: '10-0100.100',
      projectStatus: 'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ',
      projectType: 'ΕΡΓΟ',
      implementationForm: 'Μια Σύμβαση',
      createdAt: '2024-01-10T08:00:00.000Z',
      updatedAt: '2024-01-10T08:00:00.000Z',
      supervisorEngineerIds: ['user:maria'],
      supervisorChargeOutsideEngineers: false,
      supervisorChargeFreePrimary: '',
      supervisorChargeFreeParticipants: '',
      remainingAmount: '15.000,00',
      remainingAmountYear: '2026',
      projectBudget: '120.000,00',
      fileGroups: [
        { id: 'grp-contract', title: 'Σύμβαση', files: ['σύμβαση.pdf'] },
      ],
      khmdhsDocumentRegistry: [],
      khmdhsRelatedDocuments: [],
      contracts: [],
      egkriseisDialthesisPistosis: [],
    }),
    withSavablePhaseA({
      projectId: 'proj-road',
      subprojectId: 'sub-lights',
      projectTitle: 'Οδικό δίκτυο Αρχανών',
      subprojectTitle: 'Φωτισμός κόμβου',
      kaCode: '10-0101.100',
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      projectType: 'ΕΡΓΟ',
      implementationForm: 'Μια Σύμβαση',
      createdAt: '2024-01-12T08:00:00.000Z',
      updatedAt: '2024-01-12T08:00:00.000Z',
      supervisorEngineerIds: ['user:maria'],
      supervisorChargeOutsideEngineers: false,
      supervisorChargeFreePrimary: '',
      supervisorChargeFreeParticipants: '',
      khmdhsNoticeAdam: '24PROC000000001',
      khmdhsNoticeFetchedAt: isoDaysFromToday(-40),
      khmdhsAdam: '24SYMV000000001',
      fileGroups: [],
      contracts: [],
      egkriseisDialthesisPistosis: [],
    }),
    withSavablePhaseA({
      projectId: 'proj-water',
      subprojectId: 'sub-tank',
      projectTitle: 'Ύδρευση Αστερουσίων',
      subprojectTitle: 'Δεξαμενή Παρανύμφων',
      kaCode: '10-0200.100',
      projectStatus: 'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ',
      projectType: 'ΠΡΟΜΗΘΕΙΑ',
      implementationForm: 'Μια Σύμβαση',
      createdAt: '2024-02-01T08:00:00.000Z',
      updatedAt: '2024-02-01T08:00:00.000Z',
      supervisorEngineerIds: ['user:nikos'],
      supervisorChargeOutsideEngineers: false,
      supervisorChargeFreePrimary: '',
      supervisorChargeFreeParticipants: '',
      khmdhsAdam: '24SYMV000000002',
      remainingAmount: '8000',
      remainingAmountYear: '2025',
      fileGroups: [],
      contracts: [],
      egkriseisDialthesisPistosis: [],
    }),
    withSavablePhaseA({
      projectId: 'proj-old',
      subprojectId: 'sub-legacy',
      projectTitle: 'Παλιό έργο πλατείας',
      subprojectTitle: 'Ανάπλαση κεντρικής πλατείας',
      kaCode: '10-0300.100',
      projectStatus: 'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ',
      assignmentProcedure: 'ΑΝΟΙΚΤΟΣ ΔΙΑΓΩΝΙΣΜΟΣ',
      contractProcessStartDate: '2024-03-01',
      projectType: 'ΕΡΓΟ',
      implementationForm: 'Μια Σύμβαση',
      createdAt: '2022-05-01T08:00:00.000Z',
      updatedAt: '2022-05-01T08:00:00.000Z',
      supervisorEngineerIds: [],
      supervisorChargeOutsideEngineers: true,
      supervisorChargeFreePrimary: 'Παλιός Επιβλέπων',
      supervisorChargeFreeParticipants: '',
      fileGroups: [],
      contracts: [],
      egkriseisDialthesisPistosis: [],
    }),
    withSavablePhaseA({
      projectId: 'proj-done',
      subprojectId: 'sub-paid',
      projectTitle: 'Ολοκληρωμένο έργο σχολείου',
      subprojectTitle: 'Αίθουσα εκδηλώσεων',
      kaCode: '10-0400.100',
      projectStatus: 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ',
      projectType: 'ΕΡΓΟ',
      implementationForm: 'Μια Σύμβαση',
      createdAt: '2021-01-01T08:00:00.000Z',
      updatedAt: '2023-01-01T08:00:00.000Z',
      supervisorEngineerIds: ['user:maria'],
      approvedAmount: '80.000,00',
      contractAmount: '75.000,00',
      municipalUnit: 'Αρχανών',
      fileGroups: [],
      contracts: [],
      egkriseisDialthesisPistosis: [],
    }),
    withSavablePhaseA({
      projectId: 'proj-drop',
      subprojectId: 'sub-abandoned',
      projectTitle: 'Απενταγμένο έργο',
      subprojectTitle: 'Ακυρωμένη μελέτη',
      kaCode: '10-0500.100',
      projectStatus: 'ΑΠΕΝΤΑΓΜΕΝΟ',
      projectType: 'ΜΕΛΕΤΗ',
      implementationForm: 'Μια Σύμβαση',
      createdAt: '2020-01-01T08:00:00.000Z',
      updatedAt: '2020-06-01T08:00:00.000Z',
      supervisorEngineerIds: ['user:maria'],
      fileGroups: [],
      contracts: [],
      egkriseisDialthesisPistosis: [],
    }),
  ];
}

function writeSubproject(dataDir, project) {
  const dir = path.join(dataDir, project.projectId, project.subprojectId);
  const filesDir = path.join(dir, 'ΑΡΧΕΙΑ ΥΠΟΕΡΓΟΥ');
  fs.mkdirSync(filesDir, { recursive: true });
  writeJson(path.join(dir, 'data.json'), project);
  if (project.subprojectId === 'sub-bridge') {
    fs.writeFileSync(path.join(filesDir, 'σύμβαση.pdf'), '%PDF-1.4 e2e contract\n', 'utf8');
  }
  upsertProjectsIndexEntry(dataDir, project);
}

function seedProskliseis(dataDir) {
  const items = [
    {
      prosklisiId: 'psk-schools',
      title: 'Πρόσκληση σχολείων',
      deadline: dateKeyFromToday(5),
      status: 'Υπό Υποβολή',
      code: 'PSK-100',
      axis: 'Εκπαίδευση',
      linkedProjects: [{ title: 'Οδικό δίκτυο Αρχανών', projectId: 'proj-road' }],
    },
    {
      prosklisiId: 'psk-far',
      title: 'Πρόσκληση μακρινή',
      deadline: dateKeyFromToday(200),
      status: 'Υπό Υποβολή',
      code: 'PSK-200',
      axis: 'Υποδομές',
    },
    {
      prosklisiId: 'psk-expired',
      title: 'Πρόσκληση που έληξε',
      deadline: dateKeyFromToday(-4),
      status: 'Υπό Υποβολή',
      code: 'PSK-300',
      linkedProjects: [{ title: 'Ύδρευση Αστερουσίων', projectId: 'proj-water' }],
    },
    {
      prosklisiId: 'psk-submitted',
      title: 'Πρόσκληση υποβληθείσα',
      deadline: dateKeyFromToday(-400),
      status: 'Υποβληθέν ΤΔΠ',
      code: 'PSK-400',
      linkedProjects: [{ title: 'Οδικό δίκτυο Αρχανών', projectId: 'proj-road' }],
    },
    {
      prosklisiId: 'psk-modded',
      title: 'Πρόσκληση με τροποποίηση λήξης',
      deadline: dateKeyFromToday(-400),
      status: 'Υπό Ωρίμανση',
      code: 'PSK-500',
      linkedProjects: [{ title: 'Οδικό δίκτυο Αρχανών', projectId: 'proj-road' }],
    },
  ];
  items.forEach((p) => {
    const dir = path.join(dataDir, 'ΠΡΟΣΚΛΗΣΕΙΣ', p.prosklisiId);
    writeJson(path.join(dir, 'data.json'), {
      ...p,
      createdAt: '2024-06-01T08:00:00.000Z',
      updatedAt: '2024-06-01T08:00:00.000Z',
      fileGroups: [],
    });
  });
  writeJson(path.join(dataDir, 'ΠΡΟΣΚΛΗΣΕΙΣ', 'psk-modded', 'modifications.json'), [
    {
      modificationId: 'mod-psk-1',
      modificationDocumentDate: dateKeyFromToday(-10),
      createdAt: isoDaysFromToday(-10),
      changes: {
        deadline: { original: dateKeyFromToday(-400), current: dateKeyFromToday(8) },
      },
    },
  ]);
}

function seedEntaxeis(dataDir) {
  const items = [
    {
      entaxiId: 'ent-road',
      subject: 'Ανάπλαση γέφυρας',
      projectTitle: 'Οδικό δίκτυο Αρχανών',
      initialAmount: '100.000,00',
      subprojectIds: ['sub-bridge'],
    },
    {
      entaxiId: 'ent-water',
      subject: 'Δεξαμενή Παρανύμφων',
      projectTitle: 'Ύδρευση Αστερουσίων',
      initialAmount: '50.000,00',
      subprojectIds: ['sub-tank'],
    },
    {
      entaxiId: 'ent-free',
      subject: 'Μεμονωμένη ένταξη',
      projectTitle: '',
      initialAmount: '10.000,00',
      subprojectIds: [],
    },
  ];
  items.forEach((e) => {
    writeJson(path.join(dataDir, 'entaxeis', e.entaxiId, 'data.json'), {
      ...e,
      createdAt: '2024-03-01T08:00:00.000Z',
      updatedAt: '2024-03-01T08:00:00.000Z',
    });
  });
}

function seedMunicipalAndCalendar(dataDir) {
  writeJson(path.join(dataDir, 'config', 'municipal-units.json'), {
    units: ['Δ.Ε. ΑΡΧΑΝΩΝ', 'Δ.Ε. ΑΣΤΕΡΟΥΣΙΩΝ', 'Δ.Ε. Ν. ΚΑΖΑΝΤΖΑΚΗ'],
    updatedAt: '2026-08-11T16:54:08.652Z',
  });
  writeJson(path.join(dataDir, 'config', 'calendar_config.json'), {
    enabled: true,
    recipientRoles: ['ADMIN', 'ENGINEER', 'USER'],
    recipientUsernames: [],
    daysBefore: [30, 7, 1],
    notifyEventTypes: ['deadline', 'offers_expiry', 'contract_end', 'compliance_12m', 'custom'],
    eventTypeSettings: {
      deadline: { enabled: true, recipientRoles: ['ADMIN', 'ENGINEER', 'USER'], recipientUsernames: [] },
      offers_expiry: { enabled: true, recipientRoles: ['ADMIN', 'ENGINEER', 'USER'], recipientUsernames: [] },
      contract_end: { enabled: true, recipientRoles: ['ADMIN', 'ENGINEER', 'USER'], recipientUsernames: [] },
      compliance_12m: { enabled: true, recipientRoles: ['ADMIN', 'ENGINEER', 'USER'], recipientUsernames: [] },
      custom: { enabled: true, recipientRoles: ['ADMIN', 'ENGINEER', 'USER'], recipientUsernames: [] },
    },
    urgentRepeat: { enabled: false, maxCount: 3, intervalHours: 24 },
  });
}

function seedOrimanthi(dataDir) {
  const roadId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  const hydroId = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
  writeJson(path.join(dataDir, 'ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ', roadId, 'data.json'), {
    id: roadId,
    title: 'Ανακατασκευή οδού Αρχανών',
    projectCategory: 'ΟΔΟΠΟΙΙΑ',
    status: 'maturing',
    municipalUnit: 'Δ.Ε. ΑΡΧΑΝΩΝ',
    settlement: 'Αρχάνες',
    aepoRenewalDate: dateKeyFromToday(12),
    pendingItems: [
      { id: 'pend-arch', text: 'Αρχαιολογική έγκριση', done: false },
      { id: 'pend-topo', text: 'Τοπογραφικό διάγραμμα', done: true },
    ],
    createdAt: '2025-03-01T08:00:00.000Z',
    updatedAt: '2025-03-01T08:00:00.000Z',
  });
  writeJson(path.join(dataDir, 'ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ', hydroId, 'data.json'), {
    id: hydroId,
    title: 'Δίκτυο ύδρευσης Παρανύμφων',
    projectCategory: 'ΥΔΡΑΥΛΙΚΑ',
    infrastructureSpecialization: 'ΥΔΡΕΥΣΗ',
    status: 'maturing',
    municipalUnit: 'Δ.Ε. ΑΣΤΕΡΟΥΣΙΩΝ',
    aepoRenewalDate: dateKeyFromToday(-5),
    pendingItems: [{ id: 'pend-aepo', text: 'Ανανέωση / έκδοση ΑΕΠΟ', done: false }],
    createdAt: '2025-04-01T08:00:00.000Z',
    updatedAt: '2025-04-01T08:00:00.000Z',
  });
}

function seedMeletai(dataDir) {
  const id = 'c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f';
  writeJson(path.join(dataDir, 'ΜΕΛΕΤΕΣ', id, 'data.json'), {
    id,
    studyNumber: '12/2024',
    title: 'Μελέτη ανάπλασης πλατείας Αρχανών',
    category: 'ΚΤΙΡΙΑΚΑ',
    assignedTo: 'Μαρία Παπαδοπούλου',
    linkedSubprojectId: null,
    fileGroups: [],
    createdAt: '2024-09-01T08:00:00.000Z',
    updatedAt: '2024-09-01T08:00:00.000Z',
  });
}

function seedCustomCalendar(dataDir) {
  writeJson(path.join(dataDir, 'config', 'calendar_custom_events.json'), {
    events: [
      {
        id: 'evt-all',
        title: 'Ειδοποίηση για όλους',
        description: '',
        dateIso: isoDaysFromToday(6),
        visibilityRoles: [],
        visibilityUsernames: [],
        createdBy: 'e2eadmin',
        createdByFullName: 'E2E Υπερδιαχειριστής',
        createdAt: isoDaysFromToday(-2),
        updatedAt: isoDaysFromToday(-2),
      },
      {
        id: 'evt-eng',
        title: 'Ειδοποίηση μηχανικών',
        description: '',
        dateIso: isoDaysFromToday(7),
        visibilityRoles: ['ENGINEER'],
        visibilityUsernames: [],
        createdBy: 'e2eadmin',
        createdByFullName: 'E2E Υπερδιαχειριστής',
        createdAt: isoDaysFromToday(-2),
        updatedAt: isoDaysFromToday(-2),
      },
    ],
  });
}

function seedTasks(dataDir) {
  const task = {
    id: 'task-open',
    title: 'Έλεγχος γέφυρας',
    description: 'Επίσκεψη στο πεδίο',
    status: 'pending',
    priority: 'normal',
    assignees: ['maria'],
    createdBy: 'e2eadmin',
    files: [],
    comments: [],
    statusHistory: [],
    withdrawnByAssigner: false,
    leftArchiveBy: [],
    departedAssignees: [],
    createdAt: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-08-20T10:00:00.000Z',
  };
  writeJson(path.join(dataDir, 'ANATHESEIS_ERGASION', 'task-open', 'data.json'), task);
  fs.mkdirSync(path.join(dataDir, 'ANATHESEIS_ERGASION', 'task-open', 'ARXEIA'), { recursive: true });
  writeJson(path.join(dataDir, 'ANATHESEIS_ERGASION', 'index.json'), {
    version: 1,
    tasks: [
      {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assignees: task.assignees,
        createdBy: task.createdBy,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        withdrawnByAssigner: false,
        leftArchiveBy: [],
      },
    ],
    updatedAt: task.updatedAt,
  });
  writeJson(path.join(dataDir, 'ANATHESEIS_ERGASION', 'notifications.json'), {
    version: 1,
    items: [],
    updatedAt: task.updatedAt,
  });
}

function writeLock(dataDir, entityType, entityId, username) {
  writeJson(path.join(dataDir, 'locks', entityType, `${entityId}.lock`), {
    hostname: 'OTHER-PC',
    username: username || 'otheruser',
    pid: 999999,
    createdAt: new Date().toISOString(),
  });
}

function writeActiveEpProgram(dataDir) {
  const id = 'd4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a';
  const program = {
    id,
    title: 'Επιχειρησιακό Πρόγραμμα 2024–2028',
    startYear: 2024,
    endYear: 2028,
    isActive: true,
    budgetYears: [2024, 2025, 2026, 2027, 2028],
    axes: [{ code: '1', title: 'Άξονας υποδομών' }],
    measures: [{ code: '1.1', axisCode: '1', title: 'Μέτρο οδών' }],
    objectives: [],
    actions: [
      {
        id: 'act-roads',
        aa: '1',
        axisCode: '1',
        measureCode: '1.1',
        title: 'Συντήρηση οδικού δικτύου Αρχανών',
        actionType: 'Έργο',
        isNew: true,
        location: 'Δ.Ε. ΑΡΧΑΝΩΝ',
        fundingSources: ['ΕΣΠΑ 2021_2027'],
        linkedSubprojectIds: [],
        createdAt: '2024-01-01T08:00:00.000Z',
        updatedAt: '2024-01-01T08:00:00.000Z',
      },
    ],
    importedAt: '2024-01-01T08:00:00.000Z',
  };
  writeJson(path.join(dataDir, 'ΕΠΙΧΕΙΡΗΣΙΑΚΟ_ΠΡΟΓΡΑΜΜΑ', `2024_2028_${id}.json`), program);
}

function seedTestDir(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  writeJson(path.join(dataDir, 'app-config.json'), {
    setupCompleted: true,
    dataDir,
    organizationType: 'ΔΗΜΟΣ',
    organizationName: 'ΑΡΧΑΝΩΝ - ΑΣΤΕΡΟΥΣΙΩΝ',
    organizationFullName: 'ΔΗΜΟΣ ΑΡΧΑΝΩΝ - ΑΣΤΕΡΟΥΣΙΩΝ',
    department: 'Τεχνική Υπηρεσία',
  });
  writeJson(path.join(dataDir, 'users.json'), buildUsers());
  writeJson(path.join(dataDir, 'audit_log.json'), {
    logs: [
      {
        id: 'audit-seed-1',
        timestamp: '2026-08-20T10:00:00.000Z',
        userFullName: 'E2E Υπερδιαχειριστής',
        userRole: 'SUPERADMIN',
        user: 'E2E Υπερδιαχειριστής',
        action: 'create',
        entityType: 'subproject',
        entityId: 'sub-bridge',
        entityTitle: 'Γέφυρα Αγίου Σύλλα',
        details: 'Δοκιμαστική καταγραφή',
        changes: { projectTitle: { old: '', new: 'Οδικό δίκτυο Αρχανών' } },
      },
    ],
  });
  writeJson(path.join(dataDir, 'backup_settings.json'), {});
  [
    'entaxeis',
    'ΠΡΟΣΚΛΗΣΕΙΣ',
    'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ',
    'ANATHESEIS_ERGASION',
    'ΑΠΟΛΟΓΙΣΜΟΣ',
    'locks',
    'config',
    'ΩΡΙΜΑΝΣΗ_ΕΡΓΩΝ',
    'ΜΕΛΕΤΕΣ',
    'backups',
  ].forEach((sub) => fs.mkdirSync(path.join(dataDir, sub), { recursive: true }));

  buildSubprojects().forEach((p) => writeSubproject(dataDir, p));
  seedProskliseis(dataDir);
  seedEntaxeis(dataDir);
  seedMunicipalAndCalendar(dataDir);
  seedCustomCalendar(dataDir);
  seedOrimanthi(dataDir);
  seedMeletai(dataDir);
  seedTasks(dataDir);

  const sampleUpload = path.join(dataDir, '_e2e_uploads');
  fs.mkdirSync(sampleUpload, { recursive: true });
  fs.writeFileSync(path.join(sampleUpload, 'σχέδιο.pdf'), '%PDF-1.4 e2e drawing\n', 'utf8');
  fs.writeFileSync(path.join(sampleUpload, 'παράρτημα.pdf'), '%PDF-1.4 e2e annex\n', 'utf8');
  fs.writeFileSync(path.join(sampleUpload, 'σημείωμα.pdf'), '%PDF-1.4 e2e note\n', 'utf8');
  fs.writeFileSync(path.join(sampleUpload, 'α.pdf'), '%PDF-1.4 e2e a\n', 'utf8');
  fs.mkdirSync(path.join(sampleUpload, 'Προσφορές'), { recursive: true });
  fs.writeFileSync(path.join(sampleUpload, 'Προσφορές', 'α.pdf'), '%PDF-1.4 e2e a\n', 'utf8');

  return {
    dataDir,
    users: USERS,
    sampleUpload,
  };
}

module.exports = {
  seedTestDir,
  USERS,
  PASSWORD,
  isoDaysFromToday,
  dateKeyFromToday,
  writeLock,
  writeActiveEpProgram,
};

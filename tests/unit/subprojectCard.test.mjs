import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const core = require('../../app/core/subprojectCard.js');

const catalog = [
  { id: 'user:maria', username: 'maria', fullName: 'Μαρία Παπαδοπούλου' },
  { id: 'user:nikos', username: 'nikos', fullName: 'Νίκος Γεωργίου' },
];

test('loadChargeFieldsFromProject: ελεύθερο κείμενο χωρίς ids → εκτός καταλόγου', () => {
  const loaded = core.loadChargeFieldsFromProject({
    supervisorChargeFreePrimary: 'Υπηρεσία',
    supervisorEngineerIds: [],
  });
  assert.equal(loaded.supervisorChargeOutsideEngineers, true);
  assert.equal(loaded.supervisorChargeFreePrimary, 'Υπηρεσία');
});

test('normalizeChargeFromForm: κατάλογος καθαρίζει ελεύθερο κείμενο', () => {
  const out = core.normalizeChargeFromForm({
    supervisorChargeOutsideEngineers: false,
    supervisorEngineerIds: ['user:maria'],
    supervisorChargeFreePrimary: 'δεν πρέπει να μείνει',
    supervisorChargeFreeParticipants: 'ούτε αυτό',
  });
  assert.deepEqual(out.supervisorEngineerIds, ['user:maria']);
  assert.equal(out.supervisorChargeFreePrimary, '');
  assert.equal(out.supervisorChargeOutsideEngineers, false);
});

test('sanitize: projectId/subprojectId/createdAt δεν αλλάζουν', () => {
  const existing = {
    projectId: 'folder-id',
    subprojectId: 'sub-1',
    createdAt: '2020-01-01T00:00:00.000Z',
    supervisorEngineerIds: ['user:maria'],
  };
  const saved = core.sanitizeSubprojectForPersist(
    {
      projectId: 'forged',
      subprojectId: 'other',
      createdAt: '2099-01-01T00:00:00.000Z',
      projectTitle: 'Νέος τίτλος',
      supervisorEngineerIds: ['user:nikos'],
    },
    existing,
    { projectId: 'folder-id', subprojectId: 'sub-1', nowIso: '2026-08-22T10:00:00.000Z' }
  );
  assert.equal(saved.projectId, 'folder-id');
  assert.equal(saved.subprojectId, 'sub-1');
  assert.equal(saved.createdAt, '2020-01-01T00:00:00.000Z');
  assert.equal(saved.updatedAt, '2026-08-22T10:00:00.000Z');
  assert.deepEqual(saved.supervisorEngineerIds, ['user:nikos']);
});

test('sanitize: δεν αποθηκεύει το κουτάκι αποστολής email χρέωσης', () => {
  const saved = core.sanitizeSubprojectForPersist(
    {
      projectTitle: 'Πλατεία',
      supervisorEngineerIds: ['user:maria'],
      __sendChargeGreetingEmail: true,
      __expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
    },
    {},
    { projectId: 'p', subprojectId: 's', nowIso: '2026-08-22T10:00:00.000Z' }
  );
  assert.equal(Object.prototype.hasOwnProperty.call(saved, '__sendChargeGreetingEmail'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(saved, '__expectedUpdatedAt'), false);
});

test('regression: παλιός επιβλέπων δεν χάνεται στην αποθήκευση', () => {
  const existing = {
    projectId: 'p',
    subprojectId: 's',
    createdAt: '2022-01-01T00:00:00.000Z',
    supervisor: 'Παλιός Επιβλέπων',
  };
  const fromForm = {
    projectTitle: 'Πλατεία',
    supervisorEngineerIds: [],
    supervisorChargeOutsideEngineers: false,
    supervisorChargeFreePrimary: '',
  };
  const saved = core.sanitizeSubprojectForPersist(fromForm, existing, {
    projectId: 'p',
    subprojectId: 's',
    nowIso: '2026-08-22T10:00:00.000Z',
  });
  assert.equal(Object.prototype.hasOwnProperty.call(saved, 'supervisor'), false);
  assert.equal(saved.supervisorChargeFreePrimary, 'Παλιός Επιβλέπων');
  assert.equal(saved.supervisorChargeOutsideEngineers, true);
  assert.equal(core.getProjectChargeDisplay(saved, catalog).displayChargePrimary, 'Παλιός Επιβλέπων');
});

test('αναζήτηση μόνο στα τρέχοντα στοιχεία', () => {
  const project = {
    projectTitle: 'Νέο οδικό δίκτυο',
    subprojectTitle: 'Γέφυρα',
    kaCode: 'ΚΑ-999',
    supervisorEngineerIds: ['user:maria'],
  };
  assert.equal(core.subprojectMatchesQuickSearch(project, 'Νέο οδικό', { catalog }), true);
  assert.equal(core.subprojectMatchesQuickSearch(project, 'Οδικό δίκτυο Αρχανών', { catalog }), false);
  assert.equal(core.subprojectMatchesQuickSearch(project, 'Παπαδοπούλου', { catalog }), true);
});

test('μηχανικός βλέπει μόνο χρεωμένα σε αυτόν', () => {
  const projects = [
    { subprojectId: 'a', supervisorEngineerIds: ['user:maria'] },
    { subprojectId: 'b', supervisorEngineerIds: ['user:nikos'] },
  ];
  const visible = core.filterProjectsForRole(projects, 'ENGINEER', { username: 'maria' });
  assert.deepEqual(visible.map((p) => p.subprojectId), ['a']);
});

test('φόρμα κάρτας μόνο σε διαχειριστή· σημείωση χωρίς χρέωση = ανάγνωση', () => {
  assert.equal(core.canEditSubprojectCard('SUPERADMIN'), true);
  assert.equal(core.canEditSubprojectCard('ADMIN'), true);
  assert.equal(core.canEditSubprojectCard('ENGINEER'), false);
  assert.equal(core.canEditSubprojectCard('USER'), false);

  const charged = { subprojectId: 'a', supervisorEngineerIds: ['user:maria'] };
  const other = { subprojectId: 'b', supervisorEngineerIds: ['user:nikos'] };
  const ctx = core.buildEngineerVisibilityContext({ username: 'maria' });

  assert.equal(core.isSharedReadOnlySubprojectView('ENGINEER', other, ctx), true);
  assert.equal(core.isSharedReadOnlySubprojectView('ENGINEER', charged, ctx), false);
  assert.equal(core.isSharedReadOnlySubprojectView('ADMIN', other, ctx), false);

  assert.equal(core.canMutateSubprojectFiles('ENGINEER', charged, ctx), true);
  assert.equal(core.canMutateSubprojectFiles('ENGINEER', other, ctx), false);
  assert.equal(core.canMutateSubprojectFiles('ADMIN', other, ctx), true);
  assert.equal(core.canMutateSubprojectFiles('USER', charged, ctx), false);
});

test('σημείωση μηχανικού: έργα/υποέργα μόνο χρεωμένα· εντάξεις όλες', () => {
  const entities = [
    { type: 'project', id: 'proj-road', title: 'Οδικό' },
    { type: 'project', id: 'proj-water', title: 'Ύδρευση' },
    { type: 'subproject', id: 'sub-bridge', title: 'Γέφυρα' },
    { type: 'subproject', id: 'sub-tank', title: 'Δεξαμενή' },
    { type: 'entaxi', id: 'ent-water', title: 'Δεξαμενή Παρανύμφων' },
    { type: 'prosklisi', id: 'psk-1', title: 'Πρόσκληση' },
    { type: 'egkrisi', id: 'eg-1', title: 'Έγκριση' },
  ];
  const picked = core.filterNoteLinkEntitiesForRole(
    entities,
    'ENGINEER',
    ['proj-road'],
    ['sub-bridge']
  );
  assert.deepEqual(picked.map((e) => e.id), ['proj-road', 'sub-bridge', 'ent-water', 'psk-1', 'eg-1']);
  const adminAll = core.filterNoteLinkEntitiesForRole(entities, 'ADMIN', [], []);
  assert.equal(adminAll.length, entities.length);
});

test('applyOutsideChargeToggle καθαρίζει την άλλη πλευρά', () => {
  const on = core.applyOutsideChargeToggle({
    supervisorEngineerIds: ['user:maria'],
    supervisorChargeFreePrimary: '',
  }, true);
  assert.deepEqual(on.supervisorEngineerIds, []);
  const off = core.applyOutsideChargeToggle({
    supervisorEngineerIds: [],
    supervisorChargeFreePrimary: 'Υπηρεσία',
    supervisorChargeFreeParticipants: 'Άλλος',
  }, false);
  assert.equal(off.supervisorChargeFreePrimary, '');
  assert.equal(off.supervisorChargeFreeParticipants, '');
});

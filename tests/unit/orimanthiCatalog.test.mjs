import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ori = require('../../app/core/orimanthiCatalog.js');

function daysFromToday(offset) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

test('κουμπί ωρίμανσης σε όλους τους ρόλους', () => {
  assert.equal(ori.showOrimanthiButton('ADMIN'), true);
  assert.equal(ori.showOrimanthiButton('SUPERADMIN'), true);
  assert.equal(ori.showOrimanthiButton('ENGINEER'), true);
  assert.equal(ori.showOrimanthiButton('USER'), true);
});

test('επεξεργασία: διαχειριστές πάντα· χρήστης/μηχανικός μόνο με δικαίωμα', () => {
  assert.equal(ori.isOrimanthiReadOnly({ role: 'ADMIN', orimanthiCanEdit: false }), false);
  assert.equal(ori.isOrimanthiReadOnly({ role: 'SUPERADMIN', orimanthiCanEdit: false }), false);
  assert.equal(ori.isOrimanthiReadOnly({ role: 'USER', orimanthiCanEdit: false }), true);
  assert.equal(ori.isOrimanthiReadOnly({ role: 'USER', orimanthiCanEdit: true }), false);
  assert.equal(ori.isOrimanthiReadOnly({ role: 'ENGINEER', orimanthiCanEdit: false }), true);
  assert.equal(ori.isOrimanthiReadOnly({ role: 'ENGINEER', orimanthiCanEdit: true }), false);
  assert.equal(ori.orimanthiEditEligibleRole('USER'), true);
  assert.equal(ori.orimanthiEditEligibleRole('ADMIN'), false);
});

test('δικαίωμα αποθήκευσης: ανενεργός ή μη εγκεκριμένος αποκλείεται', () => {
  assert.equal(ori.canManageOrimanthi({ role: 'ADMIN', active: true, approved: true }), true);
  assert.equal(ori.canManageOrimanthi({ role: 'ADMIN', active: false, approved: true }), false);
  assert.equal(ori.canManageOrimanthi({ role: 'USER', orimanthiCanEdit: true, active: true, approved: false }), false);
  assert.equal(ori.canManageOrimanthi({ role: 'USER', orimanthiCanEdit: true, active: true, approved: true }), true);
  assert.equal(ori.canManageOrimanthi({ role: 'USER', orimanthiCanEdit: false, active: true, approved: true }), false);
});

test('ΑΕΠΟ στο ημερολόγιο: όποιος ανοίγει την ωρίμανση', () => {
  assert.equal(ori.includeAepoInCalendar({ role: 'ADMIN', orimanthiCanEdit: false }), true);
  assert.equal(ori.includeAepoInCalendar({ role: 'USER', orimanthiCanEdit: false }), true);
  assert.equal(ori.includeAepoInCalendar({ role: 'USER', orimanthiCanEdit: true }), true);
  assert.equal(ori.includeAepoInCalendar({ role: 'ENGINEER', orimanthiCanEdit: false }), true);
});

test('αποθήκευση χωρίς τίτλο απορρίπτεται', () => {
  assert.match(ori.evaluateProposalSave({ title: '' }).error, /τίτλο/);
  assert.match(ori.evaluateProposalSave({ title: '   ' }).error, /τίτλο/);
  assert.equal(ori.evaluateProposalSave({ title: 'Ύδρευση Χουδετσίου' }).ok, true);
});

test('νέο έργο: τίτλος, κατηγορία, εξειδίκευση στα υδραυλικά', () => {
  assert.match(ori.evaluateNewProposal({ title: '', projectCategory: 'ΟΔΟΠΟΙΙΑ' }).error, /τίτλο/);
  assert.match(ori.evaluateNewProposal({ title: 'Νέο', projectCategory: '' }).error, /κατηγορία/);
  assert.match(ori.evaluateNewProposal({ title: 'Νέο', projectCategory: 'ΥΔΡΑΥΛΙΚΑ' }).error, /εξειδίκευση/);
  const ok = ori.evaluateNewProposal({ title: 'Νέο', projectCategory: 'ΟΔΟΠΟΙΙΑ' });
  assert.equal(ok.ok, true);
  assert.equal(ok.status, 'maturing');
  assert.equal(ori.evaluateNewProposal({
    title: 'Νέο',
    projectCategory: 'ΥΔΡΑΥΛΙΚΑ',
    infrastructureSpecialization: 'ΥΔΡΕΥΣΗ',
  }).ok, true);
});

test('αναζήτηση: τίτλος και εκκρεμότητα ναι, όνομα αρχείου όχι', () => {
  const row = {
    title: 'Ύδρευση Χουδετσίου',
    projectCategory: 'ΥΔΡΑΥΛΙΚΑ',
    settlement: 'Χουδέτσι',
    notes: 'αναμονή τοπογραφικού',
    pendingItems: [{ text: 'Αρχαιολογική έκθεση', done: false }],
    fileGroups: [{ files: [{ name: 'ΚΑ-888-σύμβαση.pdf' }] }],
  };
  assert.equal(ori.parseProjectSearch(row, 'Χουδέτσι'), true);
  assert.equal(ori.parseProjectSearch(row, 'Αρχαιολογική'), true);
  assert.equal(ori.parseProjectSearch(row, 'τοπογραφικού'), true);
  assert.equal(ori.parseProjectSearch(row, 'ΚΑ-888'), false);
});

test('φίλτρα: κατάσταση, χωρίς κατηγορία, ΑΕΠΟ σύντομα, εκκρεμότητες', () => {
  const rows = [
    {
      id: 'a',
      title: 'Α',
      projectCategory: 'ΟΔΟΠΟΙΙΑ',
      status: 'ready',
      aepoRenewalDate: daysFromToday(200),
      pendingItems: [],
    },
    {
      id: 'b',
      title: 'Β',
      projectCategory: '',
      status: 'draft',
      aepoRenewalDate: daysFromToday(20),
      pendingItems: [{ text: 'Άδεια', done: false }],
    },
    {
      id: 'c',
      title: 'Γ',
      projectCategory: 'ΚΤΙΡΙΑΚΑ',
      status: 'approved',
      aepoRenewalDate: daysFromToday(-10),
      pendingItems: [{ text: 'Έγινε', done: true }],
    },
  ];
  assert.deepEqual(ori.filterOrimanthiHub(rows, { statusFilter: 'ready' }).map((p) => p.id), ['a']);
  assert.deepEqual(
    ori.filterOrimanthiHub(rows, { categoryFilter: ori.HUB_UNCATEGORIZED_FILTER }).map((p) => p.id),
    ['b']
  );
  assert.deepEqual(
    ori.filterOrimanthiHub(rows, { quickFilter: 'aepo_soon' }).map((p) => p.id),
    ['b', 'c']
  );
  assert.deepEqual(
    ori.filterOrimanthiHub(rows, { quickFilter: 'pending' }).map((p) => p.id),
    ['b']
  );
  assert.deepEqual(
    ori.filterOrimanthiHub(rows, { quickFilter: 'maturing' }).map((p) => p.id),
    ['b']
  );
});

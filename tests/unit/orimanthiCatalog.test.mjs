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

test('αναζήτηση: τίτλος και σημειώσεις ναι, όνομα αρχείου όχι', () => {
  const row = {
    title: 'Ύδρευση Χουδετσίου',
    actionResponsible: 'Ελένη Μαρκάκη',
    projectCategory: 'ΥΔΡΑΥΛΙΚΑ',
    settlement: 'Χουδέτσι',
    notes: 'αναμονή τοπογραφικού — αρχαιολογική έγκριση',
    pendingItems: [{ text: 'Αυτό δεν αναζητείται πια', done: false }],
    fileGroups: [{ files: [{ name: 'ΚΑ-888-σύμβαση.pdf' }] }],
  };
  assert.equal(ori.parseProjectSearch(row, 'Χουδέτσι'), true);
  assert.equal(ori.parseProjectSearch(row, 'αρχαιολογική'), true);
  assert.equal(ori.parseProjectSearch(row, 'τοπογραφικού'), true);
  assert.equal(ori.parseProjectSearch(row, 'δεν αναζητείται'), false);
  assert.equal(ori.parseProjectSearch(row, 'ΚΑ-888'), false);
  assert.equal(ori.parseProjectSearch(row, 'Μαρκάκη'), true);
  assert.equal(ori.parseProjectSearch({
    ...row,
    implementationSubprojectTitles: ['Ηλεκτροφωτισμός πλατείας'],
  }, 'ηλεκτροφωτισμός'), true);
});

test('φίλτρα: κατάσταση, χωρίς κατηγορία, ΑΕΠΟ σύντομα', () => {
  const rows = [
    {
      id: 'a',
      title: 'Α',
      projectCategory: 'ΟΔΟΠΟΙΙΑ',
      status: 'ready',
      aepoRenewalDate: daysFromToday(200),
    },
    {
      id: 'b',
      title: 'Β',
      projectCategory: '',
      status: 'draft',
      aepoRenewalDate: daysFromToday(20),
    },
    {
      id: 'c',
      title: 'Γ',
      projectCategory: 'ΚΤΙΡΙΑΚΑ',
      status: 'approved',
      aepoRenewalDate: daysFromToday(-10),
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
    ori.filterOrimanthiHub(rows, { quickFilter: 'maturing' }).map((p) => p.id),
    ['b']
  );
});

test('φίλτρο εκκρεμεί άδεια: μόνο όσα έχουν αδειοδότηση χωρίς έκδοση', () => {
  const rows = [
    {
      id: 'pending',
      title: 'Εκκρεμεί',
      fileGroups: [
        { fileCategoryRoot: 'adeiodotiseis', fileCategorySpec: 'ΕΦΟΡΕΙΑ ΑΡΧΑΙΟΤΗΤΩΝ', permitIssued: false },
      ],
    },
    {
      id: 'done',
      title: 'Εκδόθηκαν',
      fileGroups: [
        { fileCategoryRoot: 'adeiodotiseis', fileCategorySpec: 'ΔΙΕΥΘΥΝΣΗ ΔΑΣΩΝ', permitIssued: true },
      ],
    },
    { id: 'none', title: 'Χωρίς άδειες', fileGroups: [] },
  ];
  assert.deepEqual(
    ori.filterOrimanthiHub(rows, { quickFilter: 'permit_pending' }).map((p) => p.id),
    ['pending']
  );
  assert.equal(ori.hasPendingOrimanthiPermit(rows[0]), true);
  assert.equal(ori.hasPendingOrimanthiPermit(rows[1]), false);
});

test('κάρτα υποέργου: ένα έργο ανοίγει κατευθείαν, πολλά μένουν φιλτραρισμένα', () => {
  assert.deepEqual(ori.normalizeFocusProposalIds(null), []);
  assert.deepEqual(ori.normalizeFocusProposalIds(['a', 'a', '', { id: 'b' }]), ['a', 'b']);
  assert.deepEqual(ori.resolveOrimanthiOpenFromLinks([{ id: 'only' }]), {
    focusIds: ['only'],
    proposalId: 'only',
  });
  assert.deepEqual(ori.resolveOrimanthiOpenFromLinks([{ id: 'a' }, { id: 'b' }]), {
    focusIds: ['a', 'b'],
    proposalId: null,
  });
  const rows = [{ id: 'a', title: 'Α' }, { id: 'b', title: 'Β' }, { id: 'c', title: 'Γ' }];
  assert.deepEqual(
    ori.filterOrimanthiHub(rows, { focusProposalIds: ['b', 'c'] }).map((p) => p.id),
    ['b', 'c']
  );
  assert.equal(ori.resolveOrimanthiHubExportIds({}), null);
  assert.deepEqual(
    ori.resolveOrimanthiHubExportIds({
      isScopedHub: true,
      filteredIds: ['b', 'c'],
    }),
    ['b', 'c']
  );
  assert.deepEqual(
    ori.resolveOrimanthiHubExportIds({
      hubHasActiveFilters: true,
      filteredIds: [],
    }),
    []
  );
});
